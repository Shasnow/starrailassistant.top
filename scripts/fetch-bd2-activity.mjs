// 棕色尘埃2（GameKee zsca2）公告抓取脚本
// 链路（同 GameKee SPA）：列表 /v1/content/pageList → 正文元数据 /v1/content/detail/{id} → CDN 正文 content_cdn
// 只保留「更新内容 / 更新公告 / 维护」类帖子（按标题过滤），把原文输出到项目 tmp/bd2-notice 目录，
// 不做活动/时间解析，由 agent 读取后整理。
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const GAME_ID = "50118"; // 棕色尘埃2（alias zsca2）
const API = "https://www.gamekee.com";
const LIST_URL = `${API}/v1/content/pageList`;
// Game-Id 请求头必带，否则接口返回 403「缺少游戏信息」
const HEADERS = {
  "Game-Id": GAME_ID,
  Referer: `${API}/zsca2/notice`,
  "User-Agent": "Mozilla/5.0",
};

// 标题过滤：更新内容 / 更新公告 / 维护，另含官方版本贴惯例的「…更新】」（如【5月14日更新】）
const TITLE_RE = /更新内容|更新公告|维护|更新】/;
const PAGE_LIMIT = 10; // 接口单页上限
const MAX_PAGES = 10; // 防止列表很大时无限翻页

const COUNT = Number(process.argv[2]) || 5; // 保留条数（过滤后）
// 输出到项目根目录下的 tmp/bd2-notice（脚本位于 scripts/，根目录为其上一级）
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "tmp", "bd2-notice");

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

// 尝试解析 JSON，失败返回 null
function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// 展开 Slate 节点树为纯文本
function flatten(node, out = []) {
  if (typeof node.text === "string" && node.text) out.push(node.text);
  if (node.type === "image" && node.src) out.push(`[图 ${node.src}]`);
  for (const child of node.children || []) flatten(child, out);
  return out;
}

// HTML 正文 → 文本（图片保留为标记，标签剥离，实体还原，空白归并）
function htmlToText(html) {
  return html
    .replace(/<img[^>]*src="([^"]+)"[^>]*>/gi, "\n[图 $1]\n")
    .replace(/<(?:br|\/div|\/p|\/li|\/h[1-6]|\/tr|\/td|\/th)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// 正文抓取：content_cdn 载荷三种形态，均落成可读文本
// 1. {"content":"<字符串化的 Slate 节点数组>"} —— 新编辑器
// 2. {"content":"<HTML>"} 或裸 HTML —— 旧编辑器
// 3. 其他纯文本
async function fetchBody(contentCdn) {
  if (!contentCdn) return "";
  const url = contentCdn.startsWith("//") ? `https:${contentCdn}` : contentCdn;
  const res = await fetch(url, { headers: { Referer: `${API}/` } });
  if (!res.ok) return `(正文获取失败: HTTP ${res.status})`;
  const raw = (await res.text()).trim();
  const outer = tryParse(raw);
  const payload = outer && typeof outer.content === "string" ? outer.content : raw;
  const slate = tryParse(payload);
  if (Array.isArray(slate)) return flatten({ children: slate }).join("\n");
  if (payload.startsWith("<")) return htmlToText(payload);
  return payload;
}

function fmtTime(unix) {
  return new Date(unix * 1000).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });
}

async function main() {
  // 1. 分页拉取公告列表（page_no 从 1 起，0 与 1 返回同一页），按标题过滤并按 id 去重
  const matchedMap = new Map();
  for (let pageNo = 1; pageNo <= MAX_PAGES && matchedMap.size < COUNT; pageNo++) {
    const data =
      (await getJson(
        `${LIST_URL}?game_id=${GAME_ID}&type=2&limit=${PAGE_LIMIT}&page_no=${pageNo}&order_by=created_at&keyword=`,
      ))?.data ?? [];
    if (!data.length) break;
    for (const item of data) {
      if (TITLE_RE.test(item.title)) matchedMap.set(item.id, item);
    }
    if (data.length < PAGE_LIMIT) break;
  }
  const picked = [...matchedMap.values()].slice(0, COUNT);
  if (!picked.length) throw new Error("过滤后无匹配帖子，接口或标题格式可能已变更");

  // 2. 逐篇抓取正文并落盘（先清空旧输出，避免残留混淆）
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  const index = [];
  for (const item of picked) {
    let body = "";
    try {
      const detail = await getJson(`${API}/v1/content/detail/${item.id}`);
      const d = detail?.data;
      // 正文优先取 CDN（Slate/HTML），为空时用 detail 内嵌 content（HTML），再退摘要
      if (d?.content_cdn) {
        body = await fetchBody(d.content_cdn);
      } else if (d?.content) {
        body = htmlToText(d.content);
      } else if (d?.summary) {
        body = d.summary;
      }
    } catch (e) {
      body = `(正文获取失败: ${e.message})`;
    }
    const file = `${item.id}.txt`;
    const header = [
      `标题：${item.title}`,
      `发布时间：${fmtTime(item.created_at)}`,
      `接口：${API}/v1/content/detail/${item.id}`,
      "",
      "————————————————",
      "",
    ].join("\n");
    writeFileSync(join(OUT_DIR, file), header + body, "utf8");
    index.push({
      id: item.id,
      title: item.title,
      created_at: fmtTime(item.created_at),
      tag: item.tag,
      is_top: item.is_top,
      summary: item.summary,
      thumb: item.thumb,
      file,
    });
  }

  // 3. 元数据索引
  writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2), "utf8");

  console.log(`输出目录: ${OUT_DIR}`);
  console.log(`- index.json：${picked.length} 篇「更新/维护」类帖子的元数据（id/标题/发布时间/摘要/封面）`);
  console.log("- {id}.txt：每篇正文原文（未做活动解析）");
  console.log("用法：先读 index.json 选择目标帖子（最新一篇【X月X日更新内容】/维护），再读对应 {id}.txt 取正文，");
  console.log("      提取版本与活动时间后写入 public/api/v1/activity/bd2.json（Step 7 结构，2 空格缩进）。");
  console.log(`可选参数：保留条数，默认 ${COUNT}，如 node scripts/fetch-bd2-activity.mjs 50`);
}

main().catch((e) => {
  console.error(`抓取失败: ${e.message}`);
  process.exit(1);
});
