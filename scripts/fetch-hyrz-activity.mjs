// 火影忍者（hyrz.qq.com 官网）公告抓取脚本
// 链路（页面内联 JS 同款接口，均无签名，带 Referer 即可）：
//   列表  GET https://apps.game.qq.com/wmp/v3.1/?p0=25&p1=searchNewsKeywordsList&page=&pagesize=
//            &order=sIdxTime&r0=cors&r1=NewsObj&type=iTag&id={tagId}&source=web_ingame
//         → status===0，条目在 msg.result，页数 msg.totalpage
//         tagId 取自页面 tabList：tab=1（games.ts 数据源 ?tab=1）=「公告」tagId 18812
//         （0=最新 18807 / 2=攻略 18808 / 3=赛事 18813 / 4=视频 18806 / 5=体验服 138135）
//   正文  GET https://apps.game.qq.com/wmp/v3.1/public/searchNews.php?p0=25&p1=1
//            &source=web_ingame&id={iNewsId}
//         → status===0，msg 内 sTitle / sCreated / sAuthor / sIMG（封面，// 开头）/ sContent（HTML）
// 把原文输出到项目 tmp/hyrz-notice 目录，不做活动/时间解析，由 agent 读取后整理。
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://apps.game.qq.com/wmp/v3.1";
const TAG_ID = "18812"; // ?tab=1 =「公告」分类
const HEADERS = {
  Referer: "https://hyrz.qq.com/web202003/newsList.html?tab=1",
  "User-Agent": "Mozilla/5.0",
};
const DETAIL_URL = (aid) =>
  `https://hyrz.qq.com/web202003/newsDetails.html?aid=${aid}&pageType=0`;

const PAGE_SIZE = 10; // 站点页脚本用 9~12 条/页
const MAX_PAGES = 10; // 防止列表很大时无限翻页

const COUNT = Number(process.argv[2]) || 5; // 保留条数（去重后）
// 输出到项目根目录下的 tmp/hyrz-notice（脚本位于 scripts/，根目录为其上一级）
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "tmp", "hyrz-notice");

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

// HTML 正文 → 文本（图片保留为标记，标签剥离，实体还原，空白归并）
const NAMED_ENTITIES = {
  ldquo: "\u201c", rdquo: "\u201d", lsquo: "\u2018", rsquo: "\u2019",
  hellip: "\u2026", mdash: "\u2014", ndash: "\u2013", middot: "\u00b7",
  le: "\u2264", ge: "\u2265", times: "\u00d7", deg: "\u00b0",
  copy: "\u00a9", reg: "\u00ae", trade: "\u2122", bull: "\u2022",
};
function htmlToText(html) {
  return html
    .replace(/<img[^>]*src="([^"]+)"[^>]*>/gi, "\n[图 $1]\n")
    .replace(/<(?:br|\/div|\/p|\/li|\/h[1-6]|\/tr|\/td|\/th)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name] ?? m)
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

async function main() {
  // 1. 拉取「公告」列表（按 sIdxTime 排序、站点原序），按标题去重取前 COUNT 篇
  const pickedMap = new Map();
  for (let page = 1; page <= MAX_PAGES && pickedMap.size < COUNT; page++) {
    const res = await getJson(
      `${API}/?p0=25&p1=searchNewsKeywordsList&page=${page}&pagesize=${PAGE_SIZE}` +
        `&order=sIdxTime&r0=cors&r1=NewsObj&type=iTag&id=${TAG_ID}&source=web_ingame`,
    );
    if (res.status !== 0) throw new Error(`列表接口返回异常：status=${res.status}`);
    const rows = res?.msg?.result ?? [];
    if (!rows.length) break;
    for (const item of rows) {
      const title = (item.sTitle ?? "").trim();
      if (title && !pickedMap.has(title)) pickedMap.set(title, item);
    }
    if (rows.length < PAGE_SIZE) break;
  }
  const picked = [...pickedMap.values()].slice(0, COUNT);
  if (!picked.length) throw new Error("列表无内容，接口或 tagId 可能已变更");

  // 2. 逐篇取正文并落盘（先清空旧输出，避免残留混淆）
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  const index = [];
  for (const item of picked) {
    let body = "";
    try {
      const res = await getJson(
        `${API}/public/searchNews.php?p0=25&p1=1&source=web_ingame&id=${item.iNewsId}`,
      );
      const msg = res?.msg ?? {};
      body = msg.sContent ? htmlToText(msg.sContent) : "(接口未返回 sContent)";
      const file = `${item.iNewsId}.txt`;
      const header = [
        `标题：${msg.sTitle || item.sTitle}`,
        `发布时间：${msg.sCreated || item.sCreated}`,
        `作者：${msg.sAuthor || item.sAuthor || ""}`,
        `详情页：${DETAIL_URL(item.iNewsId)}`,
        `接口：${API}/public/searchNews.php?p0=25&p1=1&source=web_ingame&id=${item.iNewsId}`,
        "",
        "————————————————",
        "",
      ].join("\n");
      writeFileSync(join(OUT_DIR, file), header + body, "utf8");
      index.push({
        id: item.iNewsId,
        title: msg.sTitle || item.sTitle,
        created_at: msg.sCreated || item.sCreated,
        author: msg.sAuthor || item.sAuthor || "",
        cover: (msg.sIMG || item.sIMG || "").startsWith("//")
          ? `https:${msg.sIMG || item.sIMG}`
          : msg.sIMG || item.sIMG || "",
        detail: DETAIL_URL(item.iNewsId),
        file,
      });
    } catch (e) {
      index.push({ id: item.iNewsId, title: item.sTitle, error: e.message });
    }
  }

  // 3. 元数据索引
  writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2), "utf8");

  console.log(`输出目录: ${OUT_DIR}`);
  console.log(`- index.json：${picked.length} 篇公告的元数据（id/标题/发布时间/作者/封面/详情页）`);
  console.log("- {id}.txt：每篇正文原文（未做活动解析）");
  console.log("用法：先读 index.json 选择目标帖子（最新一篇【X月X日更新公告】/维护），再读对应 {id}.txt 取正文，");
  console.log("      提取版本与活动时间后写入 public/api/v1/activity/hyrz.json（Step 7 结构，2 空格缩进）。");
  console.log(`可选参数：保留条数，默认 ${COUNT}，如 node scripts/fetch-hyrz-activity.mjs 20`);
}

main().catch((e) => {
  console.error(`抓取失败: ${e.message}`);
  process.exit(1);
});
