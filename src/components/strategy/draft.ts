/** 攻略编辑表单与 SRA 数据之间的转换 */

import type { SraStrategy } from "@/components/strategy/api";
import { OfficialApiError } from "@/components/strategy/official";

/** 攻略表单状态：角色列表以多行文本编辑 */
export interface StrategyDraft {
  title: string;
  description: string;
  author: string;
  uploader: string;
  share_code: string;
  min_coins: number;
  min_level: number;
  mid_level: number;
  on_field: string;
  off_field: string;
}

/** 阵容表 → 表单文本，每行“角色名 星级” */
export function formatRoleMap(roles: Record<string, number>): string {
  return Object.entries(roles)
    .map(([name, star]) => `${name} ${star}`)
    .join("\n");
}

/** 表单文本 → 阵容表；格式为每行“角色名 星级（1-3）” */
export function parseRoleMap(text: string, label: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(.+?)[\s:：,，]+([1-3])$/);
    if (!match) {
      throw new OfficialApiError(`${label}格式不正确：${trimmed}（应为“角色名 星级”）`);
    }
    const name = match[1].trim();
    if (!name) throw new OfficialApiError(`${label}中存在空角色名`);
    result[name] = Number(match[2]);
  }
  return result;
}

/** SRA 攻略数据 → 表单状态 */
export function strategyToDraft(strategy: SraStrategy): StrategyDraft {
  return {
    title: strategy.title,
    description: strategy.description,
    author: strategy.author,
    uploader: strategy.uploader,
    share_code: strategy.share_code,
    min_coins: strategy.min_coins,
    min_level: strategy.min_level,
    mid_level: strategy.mid_level,
    on_field: formatRoleMap(strategy.on_field),
    off_field: formatRoleMap(strategy.off_field),
  };
}

/** 表单状态 → SRA 攻略数据（校验失败时抛出 OfficialApiError） */
export function draftToStrategy(draft: StrategyDraft): SraStrategy {
  const title = draft.title.trim();
  if (!title) throw new OfficialApiError("标题不能为空");

  return {
    title,
    description: draft.description.trim(),
    author: draft.author,
    uploader: draft.uploader.trim(),
    share_code: draft.share_code.trim(),
    min_coins: Math.max(0, Math.floor(Number(draft.min_coins) || 0)),
    min_level: Math.max(0, Math.floor(Number(draft.min_level) || 0)),
    mid_level: Math.max(0, Math.floor(Number(draft.mid_level) || 0)),
    on_field: parseRoleMap(draft.on_field, "前台角色"),
    off_field: parseRoleMap(draft.off_field, "后台角色"),
  };
}
