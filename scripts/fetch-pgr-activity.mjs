// 抓取战双帕弥什（库街区官方号帖流）的活动公告，输出到 tmp/pgr-notice.json
// 页面: https://www.kurobbs.com/pns/home —— 这是 SPA，HTML 里没有数据，
//       真正的数据在 api.kurobbs.com 的两个 POST 接口后面（免登录、免 token，
//       只要 h5 端那几个请求头 + 随机 devCode/distinct_id）。
// 流程: getMinePost(官方号帖流) -> getPostDetail(正文) -> 解析「活动时间」区
// 用法: node scripts/fetch-pgr-activity.mjs              默认 8 页 / 62 天窗口
//       node scripts/fetch-pgr-activity.mjs --pages 12 --days 90
//
// 输出是原文 + 解析结果，不做版本归属判断，由 agent 读取后整理成 activity JSON。
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const API = "https://api.kurobbs.com";
const UID = "10001001"; // 战双帕弥什官方号（库街区 person-center 里的 id）
const SLUG = "pns"; // 库街区前端路由前缀，用于拼帖子链接

// 标题白名单：游戏内玩法活动公告的常见起头
const KEEP = /活动(即将|已|现已)?开启|活动更新|网页活动|活动介绍|玩法介绍/;
// 标题黑名单：卡池 / 社区运营 / 外观宣发物料，都不是玩法活动
const DENY =
  /降临狙击|概率UP|概率\s*UP|研发池|周年限定|定向采购|获取概率|创作征集|征集活动|讨论活动|编队征集|攻略征集|有奖活动|已开奖|庆生|启动日|快乐|壁纸|涂装|PV|预告|情报|实录|实机|音乐会|签到|补给|月历|返图|留影|纪事|私语|档案|酷狗|QQ音乐/;

// 正文日期四写法（2026-09 实测）：
//   1. 9月14日05:00 - 9月23日05:00
//   2. 2026年9月3日10:00 - 2026年9月23日05:00
//   3. 8月19日版本更新后 - 9月23日05:00
//   4. 8月11日05:00 - 8月18日05:00
const DT =
  "(?:20\\d{2}\\s*年\\s*)?(\\d{1,2})\\s*月\\s*(\\d{1,2})\\s*日\\s*(版本更新后|维护后|[0-2]?\\d\\s*[:：]\\s*\\d{2})?";
const PAIR = new RegExp(DT + "\\s*[\\-—~～–]\\s*" + DT);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// 库街区 h5 端请求头。token 留空即可，devCode/distinct_id 服务端不校验内容，
// 只要存在且形如 hex；沿用固定值会在长时间批量请求后被限流，所以每次随机。
function headers() {
  return {
    "content-type": "application/x-www-form-urlencoded;charset=utf-8",
    source: "h5",
    token: "",
    version: "3.2.2",
    devCode: randomBytes(16).toString("hex"),
    distinct_id: randomBytes(16).toString("hex"),
    "user-agent": UA,
  };
}

async function post(path, data) {
  const body = new URLSearchParams(
    Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
  ).toString();
  const res = await fetch(API + path, { method: "POST", headers: headers(), body });
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 200) throw new Error(`${path} code=${json.code} ${json.msg}`);
  return json.data;
}

const pad = (n) => String(n).padStart(2, "0");

// 库街区返回的 createTimestamp 是毫秒
const toSec = (ms) => Math.floor(Number(ms || 0) / 1000);

// unix 秒 -> 北京时间 ISO（不带到终点，和 public/api/v1/activity 里的写法一致）
function tsToIso(ts) {
  if (!ts) return "";
  const d = new Date((ts + 8 * 3600) * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())}:00`;
}

// 解析一组「月/日/钟点」为北京时间字符串。钟点缺失时按 00:00；
// 「版本更新后」「维护后」没有具体时刻，按战双常见开服时间 10:00 估算。
function toIso(month, day, clock, baseYear) {
  const mo = Number(month);
  const dd = Number(day);
  if (!(mo >= 1 && mo <= 12 && dd >= 1 && dd <= 31)) return "";

  let hh = 0;
  let mm = 0;
  let estimated = false;
  if (clock === "版本更新后" || clock === "维护后") {
    hh = 10;
    estimated = true;
  } else if (clock) {
    const p = clock.replace(/：/g, ":").split(":");
    hh = Number(p[0]) || 0;
    mm = Number(p[1]) || 0;
  }

  // 跨年：12 月发的公告写「1月5日」，不加年就是过去的时间，判断依据是 baseYear
  let year = baseYear;
  const probe = new Date(Date.UTC(year, mo - 1, dd));
  if (probe.getTime() < Date.UTC(baseYear, 0, 1) - 300 * 86400000) year += 1;

  return {
    iso: `${year}-${pad(mo)}-${pad(dd)}T${pad(hh)}:${pad(mm)}:00`,
    estimated,
  };
}

// 富文本块会把同一段内容吐两遍（外层块 + 内层块），折叠连续重复行，
// 否则「活动时间」附近的窗口会被重复的描述行挤掉。
function joinBlocks(blocks) {
  const lines = [];
  for (const blk of blocks) {
    if (!blk || typeof blk.content !== "string") continue;
    for (const ln of blk.content.split("\n")) {
      if (lines.length && lines[lines.length - 1] === ln) continue;
      lines.push(ln);
    }
  }
  return lines.join("\n");
}

// 从正文里抽「活动时间」区。只取第一处匹配：正文重复两遍，findAll 后再配对会错位。
function parseTimes(content, baseTs) {
  const i = content.indexOf("活动时间");
  if (i < 0) return null;
  const area = content.slice(i, i + 300).replace(/\u00a0/g, " ");
  const m = area.match(PAIR);
  if (!m) return null;

  const baseYear = new Date((baseTs + 8 * 3600) * 1000).getUTCFullYear();
  const st = toIso(m[1], m[2], m[3], baseYear);
  const et = toIso(m[4], m[5], m[6], baseYear);
  if (!st && !et) return null;

  return {
    timeText: area.slice(0, area.indexOf("\n") > 0 ? area.indexOf("\n") : 80).trim(),
    startTime: st ? st.iso : "",
    endTime: et ? et.iso : "",
    estimated: Boolean(st?.estimated || et?.estimated),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const argOf = (name, dflt) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : dflt;
  };
  const maxPages = argOf("pages", 8);
  const maxAgeDays = argOf("days", 62);
  const pageSize = 30;
  const cutoff = Math.floor(Date.now() / 1000) - maxAgeDays * 86400;

  // 1) 官方号帖流：翻页，某页整页都早于窗口才停。
  //    不能遇到单条过期就 break —— 同页混着新旧帖，实测会漏掉「倒映浸景」「葬途残声」。
  const posts = [];
  const seen = new Set();
  for (let page = 1; page <= maxPages; page += 1) {
    let list = [];
    try {
      const data = await post("/forum/getMinePost", {
        searchType: 1,
        type: 2,
        otherUserId: UID,
        pageIndex: page,
        pageSize,
      });
      list = data?.postList || [];
    } catch (err) {
      console.error(`  第 ${page} 页失败: ${err.message}`);
      break;
    }
    if (!list.length) break;

    for (const it of list) {
      const id = String(it.postId || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const cover =
        it.coverImages?.[0]?.url || it.imgContent?.[0]?.url || "";
      posts.push({
        postId: id,
        title: String(it.postTitle || "").trim(),
        ts: toSec(it.createTimestamp),
        cover,
      });
    }

    const pageOld = list.every((it) => toSec(it.createTimestamp) < cutoff - 5 * 86400);
    if (pageOld) break;
  }

  if (!posts.length) throw new Error("库街区官方号帖流为空（接口可能变动）");
  console.log(`官方号帖流: ${posts.length} 条（最近 ${maxAgeDays} 天窗口内翻 ${maxPages} 页）`);

  // 2) 标题筛 + 详情解析
  const out = [];
  for (const p of posts) {
    if (!p.title || !KEEP.test(p.title) || DENY.test(p.title)) continue;
    if (p.ts && p.ts < cutoff) continue;

    let detail;
    try {
      const data = await post("/forum/getPostDetail", { postId: p.postId });
      detail = data?.postDetail || {};
    } catch (err) {
      console.error(`  ${p.postId} 详情失败: ${err.message}`);
      continue;
    }

    const content = joinBlocks(detail.postContent || []);
    const times = parseTimes(content, p.ts || Math.floor(Date.now() / 1000));
    if (!times) continue;

    // 已经结束的不要（et 缺失时用 st 兜底判断）
    const endSec = times.endTime
      ? Math.floor(new Date(times.endTime + "+08:00").getTime() / 1000)
      : 0;
    const startSec = times.startTime
      ? Math.floor(new Date(times.startTime + "+08:00").getTime() / 1000)
      : 0;
    if (Math.max(endSec, startSec) < cutoff) continue;

    out.push({
      postId: p.postId,
      title: p.title,
      publishTime: tsToIso(p.ts),
      url: `https://www.kurobbs.com/${SLUG}/post/${p.postId}`,
      cover: p.cover,
      ...times,
      content,
    });
  }

  // 3) 保存
  const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
  const outPath = join(rootDir, "tmp", "pgr-notice.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        source: "kurobbs /forum/getMinePost",
        uid: UID,
        slug: SLUG,
        fetchedAt: new Date().toISOString(),
        windowDays: maxAgeDays,
        posts: out,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`\n命中活动公告 ${out.length} 条，已保存到 ${outPath}\n`);
  for (const a of out) {
    const flag = a.estimated ? " [时刻为估算]" : "";
    console.log(`  ${a.startTime || "?"} ~ ${a.endTime || "?"}${flag}  ${a.title}`);
  }
  console.log(
    "\n注意: 输出是公告原文 + 解析结果，写入 public/api/v1/activity/pgr.json 前" +
      "需人工核对起止时间与活动名（标题里的「即将开启」等后缀要剥掉）。"
  );
}

main().catch((err) => {
  console.error("抓取失败:", err.message);
  process.exit(1);
});
