#!/usr/bin/env node
/**
 * 碧蓝档案（Blue Archive）活动数据生成器
 *
 * 按 `public/api/v1/activity/{game}.json` 的既有格式，生成三个服的数据：
 *
 *     node scripts/gen-ba-activity.mjs
 *     node scripts/gen-ba-activity.mjs --out-dir ./tmp   # 先看结果再决定要不要覆盖
 *
 * 数据来源
 * --------
 * GameKee 的活动表接口：https://www.gamekee.com/v1/activity/page-list
 *
 * 选它而不是 Kivo 时间轴，是因为 Kivo 那份数据实测会滞后一到两周，而且把「战斗通行证」
 * 这类没有活动关的付费内容也标成 `Event`；GameKee 的活动表三服都有，分类、起止时间与
 * 配图都是结构化的，更新也更及时（AUTO-MAS 首页的碧蓝档案卡片用的就是它）。
 *
 * 四点使用注意事项：
 *
 * 1. 请求必须带 `game-alias: ba` 头，站点靠它识别是哪个游戏，少了会返回
 *    `{"code":403,"msg":"缺少游戏信息"}`；`serverId` 区分服务器：15 日服、17 国际服、16 国服。
 * 2. 配图那个 CDN 校验 `Referer`：不带它请求会拿到 `567` 与一张 HTML，浏览器直接引用同样
 *    取不到图。脚本会在下载配图时带上 `Referer`，并校验响应确实是图片（防止 CDN 策略变更
 *    后把 HTML 当图传上去），然后上传到 R2 存储桶，再把 JSON 里的 `cover` 换成 R2 公开地址。
 *    相同内容的图片（SHA-1 一致）只会上传一次，已存在时跳过上传。
 * 3. R2 凭据放在项目根目录 `.env`（或直接注入环境变量），需要四项：
 *
 *         R2_ACCOUNT_ID=    # Cloudflare 账户 ID
 *         R2_API_TOKEN=     # 具备 R2 编辑权限的 API Token
 *         R2_BUCKET=        # 桶名
 *         R2_PUBLIC_BASE=   # 桶的公开访问域名（如 https://pub-xxx.r2.dev 或自定义域）
 *
 *    `.env` 已被 .gitignore 忽略。未配置时脚本照常生成 JSON，`cover` 保留原站地址并给出警告。
 * 4. 分类字段是中文：只有「活动」会开活动关，总力大决、爬塔、多倍活动、战术测试这些都不算；
 *    标题里带「战斗通行证」「网页活动」的同样不算（与 AUTO-MAS 侧口径一致）。
 *
 * 需要人工确认的部分：同一活动可能被拆成多条记录，脚本按标题去重并保留结束时间最晚的一条；
 * 版本字段（`version` / `versionName`）在碧蓝档案没有对应概念，用「当月 + 服务器名」占位，
 * 保证字段齐全。
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const API_URL = 'https://www.gamekee.com/v1/activity/page-list'

/** 站点靠这个头识别游戏，少了会 403「缺少游戏信息」 */
const GAMEKEE_HEADERS = {
  'game-alias': 'ba',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  Accept: 'application/json',
}

/** 配图 CDN 校验 Referer，不带它拿到的是 `567` 与一张 HTML */
const IMAGE_HEADERS = {
  Referer: 'https://www.gamekee.com/',
  'User-Agent': GAMEKEE_HEADERS['User-Agent'],
}

/** 只取「活动」；卡池、总力战、爬塔、多倍活动等分类不进活动数据 */
const WANTED_KIND = '活动'

/** 分类算「活动」但没有活动关的，按标题排除 */
const SKIP_TITLE_KEYWORDS = ['战斗通行证', '网页活动']

/** 每页 100 条、按开始时间倒序，3 页足以覆盖最近数周 */
const PAGE_SIZE = 100
const MAX_PAGES = 3

/** 往前多带几天已经结束的活动，让数据在活动间隙里也有内容 */
const RECENT_WINDOW_DAYS = 14

/** SRA 的时间字段不带时区标记，按其既有数据的惯例填北京时间 */
const TIMEZONE_OFFSET_MS = 8 * 60 * 60 * 1000

/** 服务器标识 → 输出文件名（`serverId` 取自 GameKee，国际服在它那儿叫 Globle） */
const SERVERS = [
  { key: 'jp', serverId: 15, label: '日服' },
  { key: 'global', serverId: 17, label: '国际服' },
  { key: 'cn', serverId: 16, label: '国服' },
]

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, 'public', 'api', 'v1', 'activity')

/** R2 对象按「内容 SHA-1 + 扩展名」命名，同图只传一次 */
const R2_KEY_PREFIX = 'ba/activity'

/** Unix 秒 → SRA 使用的无时区 ISO 8601 字符串（北京时间） */
const toIso = seconds => new Date(seconds * 1000 + TIMEZONE_OFFSET_MS).toISOString().slice(0, 19)

/** GameKee 的图片地址是协议相对 URL（//cdnimg...），补全为 https */
const normalizeImage = image => {
  if (!image) return ''
  return image.startsWith('//') ? `https:${image}` : image
}

/** 结束时间按既有数据的惯例落到那一分钟的最后一秒（`03:59:59` 而不是 `03:59:00`） */
const toEndIso = seconds => `${toIso(seconds).slice(0, 17)}59`

/** 当月（北京时间），用作碧蓝档案缺失的版本号占位 */
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

/** 读取项目根目录 .env（不覆盖已注入的环境变量），零依赖的极简解析 */
const loadR2Config = async () => {
  const vars = {}
  try {
    const content = await readFile(path.join(REPO_ROOT, '.env'), 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    // .env 不存在时只用环境变量
  }
  return {
    accountId: process.env.R2_ACCOUNT_ID || vars.R2_ACCOUNT_ID || '',
    apiToken: process.env.R2_API_TOKEN || vars.R2_API_TOKEN || '',
    bucket: process.env.R2_BUCKET || vars.R2_BUCKET || '',
    publicBase: (process.env.R2_PUBLIC_BASE || vars.R2_PUBLIC_BASE || '').replace(/\/+$/, ''),
  }
}

const r2Ready = config => Boolean(config.accountId && config.apiToken && config.bucket && config.publicBase)

const r2ObjectUrl = (config, key) =>
  `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${config.bucket}/objects/${key}`

/** 对象已存在则跳过上传（key 按内容哈希命名，存在即内容相同） */
const existsOnR2 = async (config, key) => {
  const response = await fetch(r2ObjectUrl(config, key), {
    headers: { Authorization: `Bearer ${config.apiToken}` },
  })
  if (response.ok) return true
  if (response.status === 404) return false
  throw new Error(`R2 查询 ${key} 失败：HTTP ${response.status}`)
}

const uploadToR2 = async (config, key, buffer, contentType) => {
  // REST API 的对象类型通过 Content-Type 头传递（没有查询参数，加了会被当作 key 的一部分）
  const response = await fetch(r2ObjectUrl(config, key), {
    method: 'PUT',
    headers: { Authorization: `Bearer ${config.apiToken}`, 'Content-Type': contentType },
    body: buffer,
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`R2 上传 ${key} 失败：HTTP ${response.status} ${detail.slice(0, 200)}`)
  }
}

const EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' }

/** 带 Referer 下载配图；校验响应确实是图片（CDN 策略变更时会返回 HTML，不能把它传上去） */
const downloadImage = async url => {
  const response = await fetch(url, { headers: IMAGE_HEADERS })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim()
  if (!EXT_BY_TYPE[contentType]) throw new Error(`响应不是图片（content-type: ${contentType || '缺失'}）`)
  return { buffer, contentType }
}

/** 下载 → 上传 R2 → 返回公开 URL；任何一步失败都抛错，由调用方决定回退策略 */
const migrateImage = async (config, url) => {
  const { buffer, contentType } = await downloadImage(url)
  const hash = createHash('sha1').update(buffer).digest('hex')
  const key = `${R2_KEY_PREFIX}/${hash}.${EXT_BY_TYPE[contentType]}`

  if (!(await existsOnR2(config, key))) {
    await uploadToR2(config, key, buffer, contentType)
    return { key, uploaded: true }
  }
  return { key, uploaded: false }
}

/** 把一份活动列表里的 cover 全部换成 R2 地址；失败的单张回退为原站地址 */
const migrateCovers = async (activities, config) => {
  // 三服之间配图常重复，跨服共享下载与上传结果
  const cache = new Map()
  let uploadedCount = 0
  let reusedCount = 0

  for (const activity of activities) {
    const original = activity.cover
    if (!original) continue
    if (!cache.has(original)) {
      try {
        const { key, uploaded } = await migrateImage(config, original)
        cache.set(original, `${config.publicBase}/${key}`)
        if (uploaded) uploadedCount += 1
        else reusedCount += 1
      } catch (error) {
        console.warn(`  警告：配图中转失败（${error.message}），保留原站地址 ${original}`)
        cache.set(original, original)
      }
    }
    activity.cover = cache.get(original)
  }

  if (uploadedCount + reusedCount > 0) {
    console.log(`  配图中转：新上传 ${uploadedCount} 张，复用已有 ${reusedCount} 张`)
  }
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
      headers: { ...GAMEKEE_HEADERS, Referer: `https://www.gamekee.com/ba/huodong/${serverId}` },
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

/** 筛出目标分类、去重并按开始时间升序，转成 SRA 的活动条目 */
const buildActivities = (items, now) => {
  const horizon = now - RECENT_WINDOW_DAYS * 86400
  const picked = new Map()

  for (const item of items) {
    if (item?.activity_kind_name !== WANTED_KIND) continue

    const name = (item.title ?? '').trim()
    if (!name) continue
    if (SKIP_TITLE_KEYWORDS.some(keyword => name.includes(keyword))) continue

    const start = item.begin_at
    const end = item.end_at
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue
    if (end <= start || end < horizon) continue

    // 同一活动可能被拆成多条记录：「保留结束时间最晚的那条」
    const existing = picked.get(name)
    if (existing && existing.end >= end) continue

    picked.set(name, {
      name,
      description: (item.description ?? '').trim().replace(/\s+/g, ' ').slice(0, 200),
      startTime: toIso(start),
      endTime: toEndIso(end),
      // GameKee 原始地址，main 里会按需中转到 R2
      cover: normalizeImage(item.picture),
      start,
      end,
    })
  }

  return [...picked.values()]
    .sort((left, right) => left.start - right.start)
    .map(({ start, end, ...activity }) => activity)
}

const main = async () => {
  const outDir = parseOutDir()
  const now = Date.now() / 1000
  const config = await loadR2Config()

  await mkdir(outDir, { recursive: true })

  for (const { key, serverId, label } of SERVERS) {
    const activities = buildActivities(await fetchActivities(serverId), now)

    if (r2Ready(config)) {
      console.log(`${label}: 中转配图到 R2 …`)
      await migrateCovers(activities, config)
    } else if (activities.some(activity => activity.cover)) {
      console.warn(`${label}: 警告：.env 未配置 R2（R2_ACCOUNT_ID / R2_API_TOKEN / R2_BUCKET / R2_PUBLIC_BASE），cover 保留原站地址，消费端需自行带 Referer 取图`)
    }

    // SRA 的 version / versionName 描述「当前版本」；碧蓝档案没有版本号概念，
    // 用当月与服务器名占位，保证字段齐全。顶层时间取活动区间的首尾。
    const head = activities[0]
    const latest = activities.at(-1)

    const payload = {
      version: currentMonth(),
      versionName: `${label}活动`,
      startTime: head?.startTime ?? '',
      endTime: latest?.endTime ?? '',
      cover: latest?.cover ?? '',
      activities,
    }

    const file = path.join(outDir, `ba-${key}.json`)
    await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    console.log(`${label}: ${activities.length} 条 → ${path.relative(REPO_ROOT, file)}`)
  }

  console.log('\n用法：输出已是目标格式（version/versionName 为占位值），核对后写入 public/api/v1/activity/ba-{jp|global|cn}.json。')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
