#!/usr/bin/env node
/**
 * NIKKE（胜利女神：妮姬）活动数据生成器
 *
 * 按 `public/api/v1/activity/nikke.json` 的既有格式，生成外服数据：
 *
 *     node scripts/gen-nikke-activity.mjs
 *     node scripts/gen-nikke-activity.mjs --out-dir ./tmp   # 先看结果再决定要不要覆盖
 *
 * 数据来源与 gen-ba-activity.mjs 完全一致 —— GameKee 活动表接口：
 * https://www.gamekee.com/v1/activity/page-list
 *
 * 接口要点：
 *
 * 1. 请求必须带 `game-alias: nikke` 头（站点靠它识别游戏，少了返回 403「缺少游戏信息」）；
 *    `serverId` 区分服务器：19 = 外服、34 = 国服（当前只取外服）。
 *    Referer 按服填 /nikke/huodong/{serverId}。
 * 2. 与 BA 版的差异：
 *    - 配图不上传 R2，cover 直接保留 GameKee 原站地址（按惯例补全 https:）；
 *    - 不做分类与标题过滤：外服的 activity_kind_name 基本为空，kind 原样写入输出，
 *      只保留 end_at 晚于当前时间的进行中条目（与既有 nikke.json 口径一致）；
 *    - 时间不做「末秒」修正，begin_at / end_at 原样转换（北京时间、无时区后缀）。
 * 3. 版本字段：NIKKE 是大版本周期型（updateMode: version），GameKee 活动表没有版本号
 *    概念，取进行中活动的最早开始日（YYYY-MM-DD）作为 version / versionName，
 *    与既有 nikke.json 的日期式版本号（如 2026-10-08）惯例一致；无活动时退化为当月。
 *    顶层 startTime / endTime 取进行中活动的首尾（起止时间由此推导，
 *    与手工填写的版本维护窗口可能有出入）。
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const API_URL = 'https://www.gamekee.com/v1/activity/page-list'

/** 站点靠这个头识别游戏，少了会 403「缺少游戏信息」 */
const GAMEKEE_HEADERS = {
  'game-alias': 'nikke',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  Accept: 'application/json',
}

/** 每页 100 条，外服活动表在一两页内 */
const PAGE_SIZE = 100
const MAX_PAGES = 3

/** SRA 的时间字段不带时区标记，按其既有数据的惯例填北京时间 */
const TIMEZONE_OFFSET_MS = 8 * 60 * 60 * 1000

/** 输出文件 → serverId（serverId 取自 GameKee，见 games.ts 的 nikke 条目） */
const SERVERS = [{ file: 'nikke.json', serverId: 19, label: '外服' }]

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, 'public', 'api', 'v1', 'activity')

/** Unix 秒 → SRA 使用的无时区 ISO 8601 字符串（北京时间） */
const toIso = seconds => new Date(seconds * 1000 + TIMEZONE_OFFSET_MS).toISOString().slice(0, 19)

/** GameKee 的图片地址是协议相对 URL（//cdnimg...），补全为 https */
const normalizeImage = image => {
  if (!image) return ''
  return image.startsWith('//') ? `https:${image}` : image
}

/** 无活动时的版本号占位（当月，北京时间） */
const currentMonth = () => new Date(Date.now() + TIMEZONE_OFFSET_MS).toISOString().slice(0, 7)

const parseOutDir = () => {
  const index = process.argv.indexOf('--out-dir')
  if (index === -1) return DEFAULT_OUT_DIR
  const value = process.argv[index + 1]
  if (!value) {
    throw new Error('--out-dir 后面要跟一个目录')
  }
  return path.resolve(value)
}

const fetchActivities = async serverId => {
  const items = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL(API_URL)
    url.searchParams.set('serverId', String(serverId))
    url.searchParams.set('page_no', String(page))
    url.searchParams.set('limit', String(PAGE_SIZE))
    url.searchParams.set('status', '0')
    url.searchParams.set('importance', '0')
    url.searchParams.set('sort', '-1')
    url.searchParams.set('keyword', '')

    const response = await fetch(url, {
      headers: { ...GAMEKEE_HEADERS, Referer: `https://www.gamekee.com/nikke/huodong/${serverId}` },
    })
    if (!response.ok) {
      throw new Error(`serverId=${serverId} 第 ${page} 页请求失败：HTTP ${response.status}`)
    }

    const payload = await response.json()
    if (payload?.code !== 0) {
      throw new Error(`serverId=${serverId} 第 ${page} 页返回异常：${payload?.msg ?? payload?.code}`)
    }

    const batch = Array.isArray(payload?.data) ? payload.data : []
    if (batch.length === 0) break
    items.push(...batch)
  }
  return items
}

/**
 * 只保留进行中的条目（end_at 晚于现在），同名去重保留结束时间最晚的一条，
 * 保持接口返回顺序（既有 nikke.json 即该顺序），并给出版本锚点（最早开始时间）。
 */
const buildActivities = (items, now) => {
  const picked = new Map()

  for (const item of items) {
    const name = (item.title ?? '').trim()
    if (!name) continue

    const start = item.begin_at
    const end = item.end_at
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue
    if (end <= start || end <= now) continue

    const existing = picked.get(name)
    if (existing && existing.end >= end) continue

    picked.set(name, {
      name,
      kind: item.activity_kind_name ?? '',
      description: (item.description ?? '').trim().replace(/\s+/g, ' ').slice(0, 200),
      startTime: toIso(start),
      endTime: toIso(end),
      cover: normalizeImage(item.picture),
      start,
      end,
    })
  }

  const entries = [...picked.values()]
  const earliest = entries.length ? Math.min(...entries.map(entry => entry.start)) : 0
  const latestEnd = entries.length ? Math.max(...entries.map(entry => entry.end)) : 0
  const activities = entries.map(({ start, end, ...activity }) => activity)

  return { activities, earliest, latestEnd }
}

const main = async () => {
  const outDir = parseOutDir()
  const now = Date.now() / 1000

  await mkdir(outDir, { recursive: true })

  for (const { file, serverId, label } of SERVERS) {
    const { activities, earliest, latestEnd } = buildActivities(await fetchActivities(serverId), now)

    // 版本号 = 进行中活动的最早开始日（北京时间日期），无活动时退化为当月
    const version = earliest ? toIso(earliest).slice(0, 10) : currentMonth()

    const payload = {
      version,
      versionName: version,
      startTime: earliest ? toIso(earliest) : '',
      endTime: latestEnd ? toIso(latestEnd) : '',
      cover: activities[0]?.cover ?? '',
      activities,
    }

    const target = path.join(outDir, file)
    await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    console.log(`${label}: ${activities.length} 条 → ${path.relative(REPO_ROOT, target)}`)
  }

  console.log('\n用法: 输出已是目标格式，已覆盖原文件，无需核对。')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
