// 抓取鸣潮 WIKI（库街区）「活动合集」目录数据并保存到项目临时目录 tmp/
// 页面: https://wiki.kurobbs.com/mc/catalogue/list?fid=1293 （SPA，数据走 api.kurobbs.com）
// 流程: getTree(目录树) -> item/getPage(条目列表) -> item/getEntryDetail(活动时间/说明)
// 用法: node scripts/fetch-ww-activity.mjs          只抓最新版本
//       node scripts/fetch-ww-activity.mjs --all    抓全部版本
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.kurobbs.com";
const ROOT_CATALOGUE_ID = 1293; // 「活动合集」fid
const WIKI_TYPE = "9"; // 鸣潮在 wiki 中的 id（pns=2）
const DEV_CODE = "a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6";

const headers = {
  "content-type": "application/x-www-form-urlencoded;charset=utf-8",
  source: "h5",
  wiki_type: WIKI_TYPE,
  devcode: DEV_CODE,
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  referer: "https://wiki.kurobbs.com/",
  origin: "https://wiki.kurobbs.com",
};

async function post(path, data) {
  const body = new URLSearchParams(
    Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
  ).toString();
  const res = await fetch(API + path, { method: "POST", headers, body });
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 200) throw new Error(`${path} code=${json.code} ${json.msg}`);
  return json.data;
}

const stripHtml = (html = "") =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();

// 从目录树中找到目标节点
function findNode(node, id) {
  if (String(node.id) === String(id)) return node;
  for (const child of node.children || []) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return null;
}

// "3.7版本活动" -> [3, 7]，用于取最新版本
function versionKey(name) {
  return (name.match(/\d+(?:\.\d+)*/) || ["0"])[0]
    .split(".")
    .map(Number);
}

async function main() {
  const fetchAll = process.argv.includes("--all");

  // 1. 目录树 -> 各版本活动子目录
  const tree = await post("/wiki/core/catalogue/config/getTree", { catalogueId: ROOT_CATALOGUE_ID });
  const root = findNode(tree, ROOT_CATALOGUE_ID);
  if (!root) throw new Error("未找到「活动合集」目录 1293");
  const folders = (root.children || [])
    .filter((c) => /\d/.test(c.name))
    .sort((a, b) => {
      const va = versionKey(a.name), vb = versionKey(b.name);
      return vb[0] - va[0] || vb[1] - va[1];
    });
  const targets = fetchAll ? folders : folders.slice(0, 1);
  console.log(`目录树: ${folders.length} 个版本子目录，本次抓取 ${targets.length} 个`);

  // 2. 各版本目录 -> 条目列表
  const versions = [];
  for (const folder of targets) {
    const page = await post("/wiki/core/catalogue/item/getPage", {
      catalogueId: folder.id,
      page: 1,
      limit: 1000,
    });
    const records = page?.results?.records || [];
    console.log(`  ${folder.name}: ${records.length} 条`);
    versions.push({ folder, records });
  }

  // 3. 条目详情 -> 活动时间/说明
  const out = [];
  for (const { folder, records } of versions) {
    const activities = [];
    for (const rec of records) {
      // 注意: rec.entryId 是 number，大数会丢精度；用 content.linkId 字符串
      const entryId = rec.content?.linkId || String(rec.entryId);
      const detail = await post("/wiki/core/catalogue/item/getEntryDetail", { id: entryId });
      const modules = detail?.content?.modules || [];
      const field = (title) => {
        const mod = modules.find((m) => m.title === title);
        if (!mod) return "";
        return stripHtml(mod.components?.map((c) => c.content || "").join("\n"));
      };
      activities.push({
        name: rec.name,
        entryId,
        timeText: field("活动时间"),
        description: field("活动说明"),
        cover: rec.content?.contentUrl || "",
        updateAt: rec.content?.updateAt ? new Date(rec.content.updateAt).toISOString() : "",
      });
    }
    out.push({
      catalogue: folder.name,
      catalogueId: folder.id,
      activities,
    });
  }

  // 4. 保存
  const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
  const outPath = join(rootDir, "tmp", "ww-wiki-activities.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`\n已保存 ${out.reduce((n, v) => n + v.activities.length, 0)} 个活动到 ${outPath}`);
  for (const v of out) {
    for (const a of v.activities) console.log(`  [${v.catalogue}] ${a.name} | ${a.timeText.split("\n")[0]}`);
  }
  console.log("用法: 输出仅作核对参考——用于确认活动官方封面图；");
}

main().catch((err) => {
  console.error("抓取失败:", err.message);
  process.exit(1);
});
