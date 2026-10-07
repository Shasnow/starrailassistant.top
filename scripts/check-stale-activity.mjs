// 以 src/data/games.ts 为基准，检查 public/api/v1/activity/ 目录里的数据：
// - 对 games.ts 中每个游戏的每种语言，取数据文件顶层版本 endTime，最需要更新的排最前
// - 额外列出 games.ts 已定义但目录里尚无对应数据文件的项
// 用法：node scripts/check-stale-activity.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { games } from "../src/data/games.ts"; // Node ≥23.6 原生类型剥离，直接导入 TS 数据模块

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const activityDir = join(root, "public/api/v1/activity");

// 按基准逐项检查数据文件
const rows = [];
const missing = [];
for (const g of games) {
  const name =
    typeof g.name === "object" ? g.name["zh-CN"] ?? g.id : g.name; // name 可能是多语言对象
  for (const locale of g.locales) {
    const file =
      locale === g.defaultLocale ? `${g.id}.json` : `${g.id}-${locale}.json`;
    let text;
    try {
      text = readFileSync(join(activityDir, file), "utf8");
    } catch {
      missing.push({ game: name, locale, file });
      continue;
    }
    const data = JSON.parse(text);
    rows.push({
      game: name,
      locale,
      file,
      version: data.version ?? "?",
      endTime: typeof data.endTime === "string" ? data.endTime : null,
    });
  }
}

// 合并周期相同（版本 endTime 相同）的同一游戏不同语言
const groups = new Map();
for (const r of rows) {
  const key = `${r.game}|${r.endTime ?? ""}`;
  const g = groups.get(key);
  if (g) {
    g.locales.push(r.locale);
    g.files.push(r.file);
  } else {
    groups.set(key, { ...r, locales: [r.locale], files: [r.file] });
  }
}
const list = [...groups.values()];

// 版本结束时间升序（无 endTime 排最后），最需要更新的在最前
list.sort((a, b) => {
  if (!a.endTime && !b.endTime) return 0;
  if (!a.endTime) return 1;
  if (!b.endTime) return -1;
  return a.endTime.localeCompare(b.endTime);
});

console.log("=== 按版本结束时间排序（最需要更新的在最前）===");
for (const r of list) {
  console.log(
    `${r.game}（${r.locales.join(", ")}）  版本 ${r.version}  endTime=${r.endTime ?? "（无）"}  [${r.files.join(", ")}]`,
  );
}

const top = list.find((r) => r.endTime);
if (top) {
  const expiredDays = Math.floor(
    (Date.now() - new Date(top.endTime.replace(" ", "T")).getTime()) /
      86400000,
  );
  console.log(
    `\n最需要更新的游戏: ${top.game}（${top.locales.join(", ")}），更新时间（版本 endTime）: ${top.endTime}` +
      (expiredDays > 0 ? `（已过期 ${expiredDays} 天）` : ""),
  );
}

if (missing.length > 0) {
  console.log("\n=== missing ===");
  for (const m of missing) {
    console.log(`${m.game}（${m.locale}）  缺少 ${m.file}`);
  }
}
