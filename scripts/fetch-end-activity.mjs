// 抓取 akedata.wiki（明日方舟：终末地）活动表数据，联表解析后生成临时文件 tmp/end-activity.json（不直接覆盖 public 下的 end.json）
// 链路：manifest.json 的 latest → 版本化 TableCfg → ActivityTable（主表）+ TimeRangeTable（时间）
//       + ActivityTagTable（活动分类）+ I18nTextTable_CN（文本回填）
//       + GachaCharPoolTable（卡池）+ CharacterTable（卡池 UP 角色名）
// 数据来源即 https://www.akedata.wiki/?plugin=v3_activity 页面的后端表
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "tmp", "end-activity.json");

const DATA_BASE = "https://data.akedata.wiki";

// 角色头像与活动图的资源路径（与 akedata 前端一致）
const CHARACTER_ICON_PATH =
  "public/images/assets/beyond/dynamicassets/gameplay/ui/sprites/charremoteicon";

// 卡池类型：表里存的是数字
const POOL_TYPE_NAMES = {
  0: "特许寻访",
  1: "新手寻访",
  2: "常驻寻访",
  3: "联合寻访",
};

// 文本引用使用有符号 Int64 id，先转成字符串再 JSON.parse 以避免精度丢失
const losslessParse = (text) =>
  JSON.parse(text.replace(/("id"\s*:\s*)(-?\d{16,})(?=\s*[,}])/g, '$1"$2"'));

const getJson = (url) =>
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
      return res.text();
    })
    .then(losslessParse);

// 1. 解析 manifest 定位 latest 版本的表格路径
const manifest = await getJson(`${DATA_BASE}/manifest.json`);
const version = manifest.versions.find((v) => v.id === manifest.latest) ?? manifest.versions[0];
if (!version?.tableCfgPath) throw new Error("manifest.json 中未找到可用的 tableCfgPath");
const tableUrl = (name) => `${DATA_BASE}/${version.tableCfgPath}/${name}.json`;

// 2. 并行下载六张表
const [activities, timeRanges, tagsTable, i18n, poolsTable, characters] = await Promise.all([
  getJson(tableUrl("ActivityTable")),
  getJson(tableUrl("TimeRangeTable")),
  getJson(tableUrl("ActivityTagTable")),
  getJson(tableUrl("I18nTextTable_CN")),
  getJson(tableUrl("GachaCharPoolTable")),
  getJson(tableUrl("CharacterTable")),
]);

// {id, text} 结构的文本：text 为空时用 I18n 表按 id 回填（与 akedata 前端 hydrate 逻辑一致）
const text = (ref) => (typeof ref === "string" ? ref : ref?.text || i18n[String(ref?.id)] || "");
// 去除游戏内富文本标记（如 <size=30><color=#FFF100>…</color></size>）
const plainText = (ref) => text(ref).replace(/<[^>]+>/g, "").trim();

// "2026/9/9 12:00:00" → "2026-09-09T12:00:00"（逐段补零，否则 new Date 解析失败）
const toIso = (value) => {
  const [date, time = "00:00:00"] = value.split(" ");
  const [y, m, d] = date.split("/");
  const [hh, mm, ss] = time.split(":");
  const pad = (n) => n.padStart(2, "0");
  return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:${pad(ss)}`;
};
// 结束时间取最后一秒（06:00:00 关闭 → 05:59:59）
const toEndIso = (value) => {
  const t = new Date(toIso(value));
  t.setSeconds(t.getSeconds() - 1);
  const pad = (n) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
};

// 一张表里找时间：按候选 timeId 依次尝试（卡池的起始时间藏在 clientTopTimeId 或 time_<池子 id> 上）
const timeRangeOf = (row, ...candidates) => {
  for (const timeId of candidates) {
    if (!timeId) continue;
    const range = timeRanges[timeId]?.timeRangeList?.[0];
    if (range?.openTime || range?.closeTime) return range;
  }
  return {};
};

// 3. 活动：联表转换 + 过滤
const now = Date.now();
const excluded = [];
const result = [];
for (const [id, row] of Object.entries(activities)) {
  const range = timeRangeOf(row, row.timeId);
  const name = text(row.name) || id;
  let reason = "";
  if (!range.closeTime) reason = "永久/常驻";
  else if ((row.panelId || "").startsWith("ActivityWEB")) reason = "网页活动";
  else if (!range.openTime) reason = "无开始时间";
  else if (new Date(toIso(range.closeTime)).getTime() < now) reason = "已结束";
  else if (id === "activity_more") reason = "占位入口";
  if (reason) {
    excluded.push(`${name}（${reason}）`);
    continue;
  }
  // 活动分类：tagIds 指向 ActivityTagTable，名字同样要过一遍 I18n 表
  const kind = (row.tagIds ?? [])
    .map((tagId) => text(tagsTable[tagId]?.name))
    .filter(Boolean)[0];
  result.push({
    name,
    kind: kind ?? "",
    description: plainText(row.desc),
    startTime: toIso(range.openTime),
    endTime: toEndIso(range.closeTime),
    cover: "",
  });
}
result.sort((a, b) => a.startTime.localeCompare(b.startTime));

// 4. 卡池：同样只收录未结束的限时池（新手 / 常驻寻访没有结束时间，一并排除）
const pools = [];
const excludedPools = [];
for (const [poolId, pool] of Object.entries(poolsTable)) {
  const range = timeRangeOf(pool, pool.clientTopTimeId, `time_${poolId}`);
  const name = text(pool.name) || poolId;
  if (!range.closeTime) {
    excludedPools.push(`${name}（永久/常驻）`);
    continue;
  }
  if (!range.openTime) {
    excludedPools.push(`${name}（无开始时间）`);
    continue;
  }
  if (new Date(toIso(range.closeTime)).getTime() < now) {
    excludedPools.push(`${name}（已结束）`);
    continue;
  }
  const upCharIds = pool.upCharIds ?? [];
  const upCharacters = upCharIds.map((charId) => text(characters[charId]?.name) || String(charId));
  pools.push({
    name,
    type: POOL_TYPE_NAMES[pool.type] ?? "特许寻访",
    startTime: toIso(range.openTime),
    endTime: toEndIso(range.closeTime),
    // 池子封面用首个 UP 角色的头像，与 akedata 前端的取法一致
    cover: upCharIds.length
      ? `${DATA_BASE}/${CHARACTER_ICON_PATH}/icon_${encodeURIComponent(String(upCharIds[0]))}.png`
      : "",
    upCharacters,
  });
}
pools.sort((a, b) => a.startTime.localeCompare(b.startTime));

// 5. 版本级信息：version 取 gameVersion 前两段（如 1.5.3 → 1.5），起止取收录内容的最早/最晚时间
const startTimes = [...result, ...pools].map((item) => item.startTime).sort();
const endTimes = [...result, ...pools].map((item) => item.endTime).sort();
const output = {
  version: version.gameVersion.split(".").slice(0, 2).join("."),
  versionName: "",
  startTime: startTimes[0] ?? "",
  endTime: endTimes[endTimes.length - 1] ?? "",
  cover: "",
  activities: result,
  pools,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
console.log(`表版本 ${version.id}：已写入 ${result.length} 个活动、${pools.length} 个卡池到 ${outPath}`);
console.log(
  "用法: 输出已是目标格式, 仅作核对参考 (versionName / cover 沿用现有数据)",
);
console.log("英文版 end-en-US.json 的表在 I18nTextTable_EN，本脚本暂只出中文。");
const ended = excluded.filter((e) => e.includes("已结束")).length;
const rest = excluded.filter((e) => !e.includes("已结束"));
if (rest.length) console.log(`已排除 ${excluded.length} 个活动（其中已结束 ${ended} 个）：\n  ${rest.join("\n  ")}`);
const restPools = excludedPools.filter((e) => !e.includes("已结束"));
if (restPools.length) console.log(`已排除 ${excludedPools.length} 个卡池：\n  ${restPools.join("\n  ")}`);
