// 卡厄思梦境（腾讯官网 czn.qq.com）资讯抓取脚本
// 数据链路（与 news-list.html 页面同款 milo 网关，form-urlencoded POST，无需登录/签名）：
//   列表: POST https://comm.ams.game.qq.com/ide/  path=/api/czn-info-articles
//         （固定参数 iChartId=451504 / sIdeToken=ZiYnak，栏目 uid=14，content_type=5 为资讯、7 为 banner）
//   正文: 同网关 path=/api/czn-info-articles/{documentId} → content_raw.content 为 HTML 片段
// 只把公告原文输出到项目 tmp/czn-notice 目录，不做活动/时间解析，由 agent 读取后整理。
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const GATEWAY = "https://comm.ams.game.qq.com/ide/";
const LIST_PAGE = "http://czn.qq.com/cp/a20250820xnz/news-list.html";
const DETAIL_PAGE = "https://czn.qq.com/cp/a20250820xnz/news-detail.html";
const NEWS_COLUMN_UID = 14; // 资讯栏目 uid（页面内固定值）

const COUNT = Number(process.argv[2]) || 30; // 输出条数，按发布时间倒序
// 输出到项目根目录下的 tmp/czn-notice（脚本位于 scripts/，根目录为其上一级）
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "tmp", "czn-notice");

// 网关固定表单字段（取自页面实际请求）
const BASE_FORM = {
  iChartId: "451504",
  iSubChartId: "451504",
  sIdeToken: "ZiYnak",
  e_code: "0",
  g_code: "0",
  eas_url: LIST_PAGE,
  eas_refer: "http://noreferrer/",
};

// 调用 milo 网关；返回 jData（业务数据在 jData.data）
async function callIde(path, queryString) {
  const form = new URLSearchParams({ ...BASE_FORM, path, query_string: queryString });
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0",
    },
    body: form.toString(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  const json = await res.json();
  if (String(json.ret) !== "0") {
    throw new Error(`网关错误 ret=${json.ret} ${json.sMsg || ""}`);
  }
  return json.jData;
}

function listQuery(page, pageSize) {
  return [
    "populate[columns][fields][]=name",
    "locale=zh",
    "status=published",
    `service=czn`,
    `filters[columns][uid][$eq]=${NEWS_COLUMN_UID}`,
    "sort[0]=set_on_status_time:desc",
    "filters[content_type_enum][$eq]=5",
    `pagination[pageSize]=${pageSize}`,
    `pagination[page]=${page}`,
  ].join("&");
}

const DETAIL_QUERY =
  "populate[columns][fields]=name&locale=zh&status=published&populate[content_raw][fields][]=content";

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

function fmtTime(unix) {
  return new Date(unix * 1000).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });
}

async function main() {
  // 1. 分页拉取资讯列表（按发布时间倒序）
  const items = [];
  const pageSize = Math.min(COUNT, 50);
  for (let page = 1; items.length < COUNT; page++) {
    const jData = await callIde("/api/czn-info-articles", listQuery(page, pageSize));
    const batch = jData?.data?.data ?? [];
    if (!batch.length) break;
    items.push(...batch);
    const pageCount = jData?.data?.meta?.pagination?.pageCount ?? page;
    if (page >= pageCount) break;
  }
  const picked = items.slice(0, COUNT);
  if (!picked.length) throw new Error("列表为空，接口可能已变更");

  // 2. 逐篇抓取正文并落盘（先清空旧输出，避免与历史来源残留混淆）
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  const index = [];
  for (const item of picked) {
    let body = "";
    try {
      const jData = await callIde(`/api/czn-info-articles/${item.documentId}`, DETAIL_QUERY);
      const html = jData?.data?.data?.content_raw?.content;
      body = html ? htmlToText(html) : "";
      if (!body && item.content_link) body = `(外链文章: ${item.content_link})`;
    } catch (e) {
      body = `(正文获取失败: ${e.message})`;
    }
    const file = `${item.documentId}.txt`;
    const detailUrl = `${DETAIL_PAGE}?documentId=${item.documentId}`;
    const header = [
      `标题：${item.title}`,
      `发布时间：${fmtTime(item.set_on_status_time)}`,
      `文章页：${detailUrl}`,
      "",
      "————————————————",
      "",
    ].join("\n");
    writeFileSync(join(OUT_DIR, file), header + body, "utf8");
    index.push({
      documentId: item.documentId,
      title: item.title,
      published_at: fmtTime(item.set_on_status_time),
      set_top: item.set_top,
      content_type: item.content_type_enum,
      start_timestamp: item.start_timestamp || 0,
      end_timestamp: item.end_timestamp || 0,
      content_summary: item.content_summary ?? null,
      covers: (item.pic_list || []).map((p) => p.url).filter(Boolean),
      url: detailUrl,
      file,
    });
  }

  // 3. 元数据索引
  writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2), "utf8");

  console.log(`输出目录: ${OUT_DIR}`);
  console.log(`- index.json：${picked.length} 篇资讯的元数据（documentId/标题/发布时间/封面/文章页链接）`);
  console.log("- {documentId}.txt：每篇资讯的正文原文（HTML 已转纯文本，未做活动解析）");
  console.log("用法：先读 index.json 选择目标资讯（版本更新/维护类标题，取最新一篇），再读对应 {documentId}.txt 取正文，");
  console.log("      提取版本与活动时间后写入 public/api/v1/activity/czn.json（Step 7 结构，2 空格缩进）。");
  console.log(`可选参数：输出条数，默认 ${COUNT}，如 node scripts/fetch-czn-activity.mjs 50`);
}

main().catch((e) => {
  console.error(`抓取失败: ${e.message}`);
  process.exit(1);
});
