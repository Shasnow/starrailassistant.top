// 绝区零（zzz.mihoyo.com / zenless.hoyoverse.com）官方公告抓取脚本
// 链路（官网 Nuxt 页面同款接口，无签名，带 Referer 即可）：
//   GET {apiBase}/getContentList?iChanId={频道}&iPageSize={n}&iPage=1&sLangKey={lang}
//   → retcode===0，条目在 data.list；正文 HTML 直接内嵌在条目的 sContent，无需再请求详情
//
// 两个服的 apiBase 与频道号取自各自站点的 Nuxt 打包产物（环境常量 CHANNEL_ID_CONFIG）：
//   zh-CN  https://api-takumi-static.mihoyo.com/content_v2_user/app/706fd13a87294881
//          全部 273 / 新闻 278 / 公告 279 / 活动 280
//   en-US  https://sg-public-api-static.hoyoverse.com/content_v2_user/app/3e9196a4b9274bd7
//          全部 288 / 新闻 295 / 公告 296 / 活动 297
//
// 把原文输出到项目 tmp/zzz-notice/{locale}/ 目录，不做活动/时间解析，由 agent 读取后整理。
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const GAMES = {
  "zh-CN": {
    apiBase: "https://api-takumi-static.mihoyo.com/content_v2_user/app/706fd13a87294881",
    lang: "zh-cn",
    referer: "https://zzz.mihoyo.com/news",
    chan: { all: 273, news: 278, announce: 279, event: 280 },
  },
  "en-US": {
    apiBase: "https://sg-public-api-static.hoyoverse.com/content_v2_user/app/3e9196a4b9274bd7",
    lang: "en-us",
    referer: "https://zenless.hoyoverse.com/en-us/news",
    chan: { all: 288, news: 295, announce: 296, event: 297 },
  },
};

const COUNT = Number(process.argv[2]) || 10; // 每个服保留条数
const CHANNEL = process.argv[3] || "all"; // all / news / announce / event
// 输出到项目根目录下的 tmp/zzz-notice（脚本位于 scripts/，根目录为其上一级）
const OUT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "tmp", "zzz-notice");

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

// 封面：正文首图（接口未单列封面字段）
function firstImage(html) {
  const m = /<img[^>]*src="([^"]+)"/i.exec(html || "");
  return m ? m[1] : "";
}

async function getJson(url, referer) {
  const res = await fetch(url, {
    headers: { Referer: referer, "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

async function fetchLocale(locale, cfg) {
  const chanId = cfg.chan[CHANNEL];
  if (!chanId) throw new Error(`未知频道 ${CHANNEL}（可选：${Object.keys(cfg.chan).join("/")}）`);

  const url =
    `${cfg.apiBase}/getContentList?iChanId=${chanId}` +
    `&iPageSize=${COUNT + 5}&iPage=1&sLangKey=${cfg.lang}`;
  const res = await getJson(url, cfg.referer);
  if (res.retcode !== 0) throw new Error(`${locale} 接口异常：retcode=${res.retcode} ${res.message}`);
  // 置顶的「调频概率公示一览」等条目 sContent 为空（正文在站内其他页面），跳过以免占用条数
  const rows = (res?.data?.list ?? []).filter((item) => item.sContent).slice(0, COUNT);
  if (!rows.length) throw new Error(`${locale} 列表为空，接口或频道号可能已变更`);

  const outDir = join(OUT_ROOT, locale);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const index = [];
  for (const item of rows) {
    const body = htmlToText(item.sContent) || "(接口未返回 sContent)";
    const file = `${item.iInfoId}.txt`;
    const header = [
      `标题：${item.sTitle}`,
      `发布时间：${item.dtStartTime}`,
      `接口：${url}`,
      "",
      "————————————————",
      "",
    ].join("\n");
    writeFileSync(join(outDir, file), header + body, "utf8");
    index.push({
      id: item.iInfoId,
      title: item.sTitle,
      published: item.dtStartTime,
      intro: item.sIntro || "",
      cover: firstImage(item.sContent),
      file,
    });
  }

  writeFileSync(join(outDir, "index.json"), JSON.stringify(index, null, 2), "utf8");
  console.log(`${locale}: ${index.length} 篇 → ${outDir}`);
}

async function main() {
  mkdirSync(OUT_ROOT, { recursive: true });
  for (const [locale, cfg] of Object.entries(GAMES)) {
    await fetchLocale(locale, cfg);
  }
  console.log("\n- index.json：元数据（id/标题/发布时间/摘要/封面）");
  console.log("- {id}.txt：每篇正文原文（未做活动解析）");
  console.log("用法：先读 index.json 选择目标帖子（最新一篇版本更新公告，再取活动说明），");
  console.log("      提取版本与活动时间后写入 public/api/v1/activity/zzz{,-en-US}.json（Step 7 结构，2 空格缩进）。");
  console.log(`可选参数：1) 条数，默认 ${COUNT}；2) 频道，默认 ${CHANNEL}（all/news/announce/event）`);
}

main().catch((e) => {
  console.error(`抓取失败: ${e.message}`);
  process.exit(1);
});
