// 崩坏3（www.bh3.com / honkaiimpact3.hoyoverse.com）官方公告抓取脚本
// 链路（官网 Nuxt 页面同款接口，无签名，带 Referer 即可）：
//   GET {apiBase}/getContentList?iChanId={频道}&iPageSize={n}&iPage=1&sLangKey={lang}
//   → retcode===0，条目在 data.list；正文 HTML 直接内嵌在条目的 sContent，无需再请求详情
//
// 两个服的 apiBase 与频道号取自各自站点的 Nuxt 打包产物（CONTENT_V2_KEY / CHANNEL_V2_CONFIG）：
//   zh-CN  https://act-api-takumi-static.mihoyo.com/content_v2_user/app/b9d5f96cd69047eb
//          最新(全部) 693 / 动态 694 / 公告 695 / 活动 696 / 补给 697
//   en-US  https://sg-public-api-static.hoyoverse.com/content_v2_user/app/5fcd2aa439ca4aea
//          全部 514 / 活动 515 / 公告 516 / 新闻 517
//
// 过滤与合并逻辑：
//   1. 列表含常驻置顶条目（如 2024 年的「补给概率公示」「同人衍生作品创作指引」），且部分 PV 条目 sContent 为空；
//      先过滤空 sContent，再按 dtStartTime 倒序排列。
//   2. 崩坏3大版本周期约 8~9 周，版本中后期「全部」频道前排易被每周补给公告占满；
//      因此默认模式（default）同时拉取「公告(notice)」与「活动(activity)/全部(all)」，按 iInfoId 去重后输出，
//      确保版本更新公告与单篇活动公告同时在列。也可显式指定单一频道（all/news/notice/activity/supply）。
//   3. 原文输出到项目 tmp/bh3-notice/{locale}/ 目录，不直接覆盖 public/api/v1/activity/ 正式数据。
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const GAMES = {
  "zh-CN": {
    apiBase: "https://act-api-takumi-static.mihoyo.com/content_v2_user/app/b9d5f96cd69047eb",
    lang: "zh-cn",
    referer: "https://www.bh3.com/news",
    chan: { all: 693, news: 694, notice: 695, activity: 696, supply: 697 },
    defaultChans: ["notice", "activity"],
  },
  "en-US": {
    apiBase: "https://sg-public-api-static.hoyoverse.com/content_v2_user/app/5fcd2aa439ca4aea",
    lang: "en-us",
    referer: "https://honkaiimpact3.hoyoverse.com/en-us/news",
    chan: { all: 514, activity: 515, notice: 516, news: 517 },
    defaultChans: ["notice", "all"],
  },
};

const COUNT = Number(process.argv[2]) || 15; // 每个服保留条数
const CHANNEL = process.argv[3] || "default"; // default / all / news / notice / activity / supply
// 输出到项目根目录下的 tmp/bh3-notice（脚本位于 scripts/，根目录为其上一级）
const OUT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "tmp", "bh3-notice");

// HTML 正文 → 文本（图片保留为标记，标签剥离，实体还原，空白归并）
const NAMED_ENTITIES = {
  ldquo: "\u201c", rdquo: "\u201d", lsquo: "\u2018", rsquo: "\u2019",
  hellip: "\u2026", mdash: "\u2014", ndash: "\u2013", middot: "\u00b7",
  le: "\u2264", ge: "\u2265", times: "\u00d7", deg: "\u00b0",
  copy: "\u00a9", reg: "\u00ae", trade: "\u2122", bull: "\u2022",
};
function htmlToText(html) {
  return html
    .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, "\n[图 $1]\n")
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

// 封面：优先取列表配图字段（sExt 内常见 banner），否则取正文首图
function extractCover(item) {
  if (item.sExt) {
    try {
      const ext = typeof item.sExt === "string" ? JSON.parse(item.sExt) : item.sExt;
      for (const v of Object.values(ext || {})) {
        if (Array.isArray(v) && v[0]?.url) return v[0].url;
        if (typeof v === "string" && /^https?:\/\/.+\.(?:jpg|jpeg|png|webp)/i.test(v)) return v;
      }
    } catch {
      // ignore invalid sExt JSON
    }
  }
  const m = /<img[^>]*src=["']([^"']+)["']/i.exec(item.sContent || "");
  return m ? m[1] : "";
}

async function getJson(url, referer) {
  const res = await fetch(url, {
    headers: { Referer: referer, "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

async function fetchChanList(cfg, chanKey, pageSize) {
  const chanId = cfg.chan[chanKey];
  if (!chanId) {
    throw new Error(`未知频道 ${chanKey}（可选：default/${Object.keys(cfg.chan).join("/")}）`);
  }
  const url =
    `${cfg.apiBase}/getContentList?iChanId=${chanId}` +
    `&iPageSize=${pageSize}&iPage=1&sLangKey=${cfg.lang}`;
  const res = await getJson(url, cfg.referer);
  if (res.retcode !== 0) {
    throw new Error(`接口异常：retcode=${res.retcode} ${res.message} (${url})`);
  }
  return (res?.data?.list ?? [])
    .filter((item) => item.sContent)
    .map((item) => ({ ...item, _sourceUrl: url, _chanKey: chanKey }));
}

async function fetchLocale(locale, cfg) {
  const chanKeys = CHANNEL === "default" ? cfg.defaultChans : [CHANNEL];
  const mergedMap = new Map();

  for (const key of chanKeys) {
    const list = await fetchChanList(cfg, key, COUNT + 8);
    for (const item of list) {
      if (!mergedMap.has(item.iInfoId)) {
        mergedMap.set(item.iInfoId, item);
      }
    }
  }

  const rows = [...mergedMap.values()]
    .sort((a, b) => String(b.dtStartTime).localeCompare(String(a.dtStartTime)))
    .slice(0, COUNT);
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
      `频道：${item._chanKey}`,
      `接口：${item._sourceUrl}`,
      "",
      "————————————————",
      "",
    ].join("\n");
    writeFileSync(join(outDir, file), header + body, "utf8");
    index.push({
      id: item.iInfoId,
      title: item.sTitle,
      published: item.dtStartTime,
      channel: item._chanKey,
      intro: item.sIntro || "",
      cover: extractCover(item),
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
  console.log("\n- index.json：元数据（id/标题/发布时间/频道/摘要/封面）");
  console.log("- {id}.txt：每篇正文原文（未做活动解析）");
  console.log("用法：先读 index.json 选择目标帖子（最新一篇版本更新公告及配套单篇活动公告），");
  console.log("      提取版本与活动时间后写入 public/api/v1/activity/bh3{,-en-US}.json（Step 7 结构，2 空格缩进）。");
  console.log(
    `可选参数：1) 条数，默认 ${COUNT}；2) 频道，默认 ${CHANNEL}（default/all/news/notice/activity/supply）`,
  );
}

main().catch((e) => {
  console.error(`抓取失败: ${e.message}`);
  process.exit(1);
});
