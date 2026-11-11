/** 官方（米游社）货币战争攻略 → SRA 攻略格式转换 */

import type { SraStrategy } from "@/components/strategy/api";
import { API_BASE_URL, REQUEST_TIMEOUT } from "@/components/strategy/config";

export interface OfficialRole {
  name?: string;
  star?: number | string;
}

export interface OfficialStage {
  stage?: string;
  front_roles?: OfficialRole[];
  back_roles?: OfficialRole[];
}

export interface OfficialLineup {
  title?: string;
  description?: string;
  nickname?: string;
  tourn_detail?: { role_stages?: OfficialStage[]; share_code?: string };
}

export class OfficialApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfficialApiError";
  }
}

/**
 * 分享链接中的 gt__lineup_id 是编码后的 id：数字 0-9 被映射为字母 n-w。
 * 例：taepevarrdedcnecsuvavfbe → 6ae2e8a44dedc0ec578a8fbe
 */
export function decodeLineupId(value: string): string {
  return value.replace(/[n-w]/g, (ch) => String.fromCharCode(48 + ch.charCodeAt(0) - 110));
}

/** 从分享链接（或直接给出的 id）中解析出接口所需的阵容 id */
export function parseLineupId(input: string): string {
  const text = input.trim();
  if (!text) throw new OfficialApiError("请粘贴官方攻略分享链接");

  let raw = "";
  try {
    raw = new URL(text).searchParams.get("gt__lineup_id") ?? "";
  } catch {
    raw = text.match(/gt__lineup_id=([^&#]+)/)?.[1] ?? text;
  }
  if (!raw) throw new OfficialApiError("链接中未找到 gt__lineup_id 参数");

  let encoded = raw;
  try {
    encoded = decodeURIComponent(raw);
  } catch {
    // 非法百分号编码时按原样处理
  }
  const id = decodeLineupId(encoded);
  if (!/^[0-9a-f]+$/i.test(id)) throw new OfficialApiError("分享链接中的阵容 ID 无效");
  return id;
}

/**
 * 后端代理官方阵容接口（官方接口只允许 act.miyoushe.com 跨域）：
 * GET {API_BASE_URL}/strategy/official-lineup?id={id}
 */
export async function fetchOfficialLineup(shareLink: string): Promise<OfficialLineup> {
  const id = parseLineupId(shareLink);
  const url = `${API_BASE_URL}/strategy/official-lineup?id=${encodeURIComponent(id)}`;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const text = (await response.text()).trim();
      // 仅展示后端返回的简短错误文案，避免把 HTML 异常页塞进提示
      const message = text && text.length <= 200 && !text.includes("<") ? text : "";
      throw new OfficialApiError(message || `官方接口请求失败（${response.status}）`);
    }
    return (await response.json()) as OfficialLineup;
  } finally {
    window.clearTimeout(timer);
  }
}

/** 官方星级只有 1-3 星，SRA 攻略中的数值即目标星级 */
function toStar(value: OfficialRole["star"]): number {
  return Math.min(3, Math.max(1, Math.round(Number(value) || 1)));
}

function toRoleMap(roles: OfficialRole[] | undefined): Record<string, number> {
  const map = new Map<string, number>();
  for (const role of roles ?? []) {
    const name = role.name?.trim();
    if (!name) continue;
    map.set(name, Math.max(map.get(name) ?? 0, toStar(role.star)));
  }
  return Object.fromEntries(map);
}

/** 以终局阵容为基础，按终局 → 中期 → 前期顺序增量合并角色（同名角色保留终局站位与星级） */
function mergeStageRoles(stages: OfficialStage[]): {
  onField: Record<string, number>;
  offField: Record<string, number>;
} {
  const order = ["Final", "Middle", "Early"]
    .map((name) => stages.find((stage) => stage.stage === name))
    .filter((stage): stage is OfficialStage => Boolean(stage));
  // 未识别的阶段放在最后，保证不丢角色
  const ordered = [...order, ...stages.filter((stage) => !order.includes(stage))];

  const onField = new Map<string, number>();
  const offField = new Map<string, number>();
  const seen = new Set<string>();
  for (const stage of ordered) {
    for (const key of ["front_roles", "back_roles"] as const) {
      const target = key === "front_roles" ? onField : offField;
      for (const [name, star] of Object.entries(toRoleMap(stage[key]))) {
        if (seen.has(name)) continue;
        seen.add(name);
        target.set(name, star);
      }
    }
  }
  return { onField: Object.fromEntries(onField), offField: Object.fromEntries(offField) };
}

/** 官方 share_code 不带 ## 包裹，游戏内格式为 ##<share_code>## */
function toShareCode(value: string | undefined): string {
  const code = value?.trim();
  if (!code) return "";
  return code.startsWith("##") ? code : `##${code}##`;
}

/** 将官方攻略数据转换为 SRA 攻略格式 */
export function toSraStrategy(lineup: OfficialLineup, uploader = ""): SraStrategy {
  const stages = lineup.tourn_detail?.role_stages ?? [];
  const { onField, offField } = mergeStageRoles(stages);
  if (Object.keys(onField).length + Object.keys(offField).length === 0) {
    throw new OfficialApiError("官方攻略中没有可转换的阵容数据");
  }

  const author = lineup.nickname?.trim() ?? "";
  return {
    title: lineup.title?.trim() || "官方攻略",
    description: lineup.description?.trim() ?? "",
    author,
    uploader: uploader || author,
    share_code: toShareCode(lineup.tourn_detail?.share_code),
    // 官方数据不含商店经营参数，沿用模板默认值
    min_coins: 40,
    min_level: 7,
    mid_level: 9,
    on_field: onField,
    off_field: offField,
  };
}
