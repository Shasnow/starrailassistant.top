// 抓取鸣潮官网新闻列表（SPA 的真实数据源），返回最新几篇文章
// zh-CN 列表: https://media-cdn-mingchao.kurogame.com/akiwebsite/website2.0/json/G152/zh/ArticleMenu.json
// en-US 列表: https://hw-media-cdn-mingchao.kurogame.com/akiwebsite/website2.0/json/G152/en/ArticleMenu.json
// 正文: 同目录 article/{articleId}.json
// 用法: node scripts/fetch-ww-news.mjs          两个语言各最新 5 篇
//       node scripts/fetch-ww-news.mjs 10       两个语言各最新 10 篇
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const LOCALES = {
  "zh-CN": "https://media-cdn-mingchao.kurogame.com/akiwebsite/website2.0/json/G152/zh",
  "en-US": "https://hw-media-cdn-mingchao.kurogame.com/akiwebsite/website2.0/json/G152/en",
};
const count = Number(process.argv[2]) || 5;

const stripHtml = (html = "") =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|h[1-6]|li|tr)>/gi, "\n")
    // img 标签保留为图片 URL，其余标签删除
    .replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, (m, src) => `\n![img](${src})\n`)
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();

async function getJson(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

async function fetchLocale(locale, base) {
  console.log(`\n[${locale}]`);
  // 1. 列表: 按发布时间降序取最新 N 篇
  const menu = await getJson(`${base}/ArticleMenu.json`);
  const latest = [...menu]
    .sort((a, b) => (b.startTime || b.createTime).localeCompare(a.startTime || a.createTime))
    .slice(0, count);
  console.log(`列表共 ${menu.length} 篇，取最新 ${latest.length} 篇`);

  // 2. 逐篇取正文
  const articles = [];
  for (const item of latest) {
    let content = "";
    try {
      const detail = await getJson(`${base}/article/${item.articleId}.json`);
      content = stripHtml(detail.articleContent || "");
    } catch (err) {
      console.log(`  正文获取失败 ${item.articleId}: ${err.message}`);
    }
    articles.push({
      articleId: item.articleId,
      title: item.articleTitle,
      type: item.articleType,
      publishTime: item.startTime || item.createTime,
      desc: item.articleDesc || "",
      cover: item.suggestCover || "",
      content,
    });
    console.log(`  ${item.articleId} | ${item.startTime || item.createTime} | ${item.articleTitle}`);
  }

  // 3. 保存（zh-CN 用原名，其余语言加后缀）
  const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
  const name = locale === "zh-CN" ? "ww-articles-latest.json" : `ww-articles-latest-${locale}.json`;
  const outPath = join(rootDir, "tmp", name);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(articles, null, 2), "utf8");
  console.log(`已保存 ${articles.length} 篇到 ${outPath}`);
}

async function main() {
  for (const [locale, base] of Object.entries(LOCALES)) {
    await fetchLocale(locale, base);
  }
}

main().catch((err) => {
  console.error("抓取失败:", err.message);
  process.exit(1);
});
