---
name: "game-activity-extractor"
description: "Collects game version activity data from the data sources configured in src/data/games.ts (or a user-provided announcement URL/image) and outputs structured JSON as {id}-{locale}.json. Invoke when user asks to update or extract version activity info for a game."
---

# Game Activity Extractor

Collect game version activity information for a game from the data sources configured in `src/data/games.ts` — rather than waiting for the user to paste an announcement URL — and write structured JSON per locale. A user-provided announcement URL or image may still be used as a direct shortcut when given.

## When to Invoke

- User asks to update / refresh / extract a game's version activity data (e.g. "更新 xx 活动信息")
- User provides a URL (e.g., miyoushe.com, bilibili.com) or image containing a game version update announcement
- User asks to output game activity data in JSON format

## Workflow Steps

### Step 1: Resolve the Game and Its Data Sources

Read `src/data/games.ts` and locate the target game entry (match by `id` or `name`):

| Field           | Description                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `id`            | Game identifier — base of the output filename (e.g., `sr`, `ys`)                                   |
| `name`          | Game name in Chinese                                                                               |
| `locales`       | All locales that must be produced                                                                  |
| `defaultLocale` | Locale whose output omits the `-{locale}` suffix                                                   |
| `dataSources`   | Map of locale → `GameDataSource[]` (see below), "all" key applies to all locales                   |

**GameDataSource shape** (defined at the top of `src/data/games.ts`):

| Field        | Applies to      | Description                                                                                                  |
| ------------ | --------------- | ------------------------------------------------------------------------------------------------------------ |
| `type`       | all             | `html` — announcement listing page; `script` — generator script; `pageData` — paginated JSON API             |
| `url`        | html, pageData  | Listing page / JSON API endpoint                                                                             |
| `script`     | script          | Script path relative to repo root, run with `node scripts/<file>`                                            |
| `articleUrl` | pageData        | Article URL template; replace each `{field}` placeholder with the entry's same-named field value            |
| `userAgent`  | html            | `"none"` — do **not** send a browser User-Agent when fetching (the source rejects bare browser UAs); absent = UA-insensitive |

**Output file naming** — write to `public/api/v1/activity/`:

- Default locale: `{id}.json` (e.g., `sr.json` for `defaultLocale: "zh-CN"`)
- Other locales: `{id}-{locale}.json` (e.g., `sr-en-US.json`)

Produce one file per entry in `locales`, collecting from that locale's `dataSources`. If the user provided an explicit announcement URL or image, fetch it directly for the corresponding locale instead of walking the data-source listing.

### Step 2: Fetch Source Content

Handle each source according to its `type`. A locale may list several sources — try them in order until one yields the version notice or activity data, and note in the Step 8 explanation which one was used.

#### type: "html" — Announcement Listing Pages

1. `WebFetch` the `url` (respecting `userAgent: "none"` if set) to list recent articles.
2. Locate the latest version update announcement — see "Priority Articles" below for which title to pick.
3. `WebFetch` the announcement article itself to get the full body.

#### type: "script" — Generator Scripts

1. Run `node scripts/<script>` from the repo root. Some scripts read credentials from `.env` — if it fails on missing config, the names it prints tell you what to add.
2. Read the script's stdout: it states where the output was written and how to use it (cross-check reference, or already in output format).
3. Follow that instruction — either treat the output as reference material for the announcement flow, or verify it and write it to `public/api/v1/activity/{id}[-{locale}].json` (2-space indentation, Step 7 structure).

#### type: "pageData" — Paginated JSON APIs

1. Fetch the `url` — the response is JSON, not a webpage. Inspect its shape: locate the entry array and what fields each entry carries (id, title, link, time, …).
2. Build article/detail links:
   - If `articleUrl` is set, replace each `{field}` placeholder with the entry's same-named field value.
   - Otherwise look for a full link field on the entries themselves.
3. Continue with the "html" flow (Priority Articles) on the built links to fetch the version notice.
4. Paginate only if the target entry is not on the first page: infer the page parameter from the `url`'s existing query (e.g. change `page=1` / `index=1` to `2`, `3`, …) and walk pages until found.

The subsections below (Priority Articles / Fallback) apply to both "html" and "pageData" sources — wherever they say "the listing", read "the listing or the first JSON page".

#### Priority Articles: What to Focus On

Do **not** browse articles one by one. A single article type usually contains everything the output needs — target it first:

| Priority | Title Pattern (zh / en)                                                                                                              | Contains                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| **1**    | 「X.X版本更新说明」「X.X版本「副标题」更新公告」 / "Version X.X … Update Details", "… Update Announcement", "Ver. X.X … Patch Notes" | Version start/end + every activity with exact start/end times — **one article is enough** |
| 2        | 「X.X版本内容一览」「活动速递」                                                                                                      | Full activity timetable, but may be image-only — cross-check against Priority 1 or wiki   |
| 3        | 「「活动名」活动说明」 / single-activity notices                                                                                     | Exact clock times for one activity — use only to verify individual entries                |
| skip     | 「前瞻特别节目 情报回顾」, 专题页, 「Server Maintenance Notice」 (no version number)                                                 | Image-heavy / fragmented / no timetable — never the primary source                        |

Gacha banners, shop, compensation mail, and permanent-content articles are never sources (see Step 4 exclusions).

#### Fallback

Listing pages are often JS-rendered or serve stale snapshots that lack the latest notice — and a **new game** added to `games.ts` may have no prior notes. Instead of assuming any site works like the known ones, escalate in this order, and note which fallback was used in the Step 8 explanation:

1. `WebFetch` the listing and **classify the response**:
   - _Static / SSR with links_ → pick the target article directly (still verify it is the **latest** version notice); if the latest version notice is not linked, go to 2.
   - _JS-rendered shell or empty body_ → the listing is unusable; go to 2.
   - _HTTP 200 but stale snapshot_ (old dates, expired IDs) → treat it as unusable even though it "succeeded"; go to 2.
   - _Structured JSON / JSON file output_ → parse the JSON content to extract activity information.
2. `WebSearch` for the exact title pattern (e.g. `{game} {version}版本更新说明 site:{domain}`), then `WebFetch` the detail URL.

**Article IDs are NOT shared across languages** — zh and en notices always have different IDs (e.g. ys zh 166392 vs en 166383). Never reuse a URL from one locale for the other.

Once a fallback works, identify the source's fetch pattern so future updates can skip straight to it:

3. **Discover the detail-page pattern from any working article.** Find one article URL (via listing, `WebSearch`, or a shared link), then generalize its shape: where the numeric/encoded ID sits, whether a date or locale segment is embedded (e.g. `/{yyyyMMdd}/{id}.html`, `/en/` prefix), and whether query params are required. Try to fetch the target article by substituting IDs if needed.
4. **Test the mobile-mirror variant early.** If the desktop detail page fails with a resource-loading error or empty shell, retry the same path prefixed with `/m/` (a common pattern on hoyo-family sites).
5. **Learn the ID behavior before probing.** Adjacent-ID probing (±1 around a known related article) only helps if IDs are dense and sequential; some sites use sparse or per-category IDs where probing wastes calls. Also verify — never assume — that IDs are **not** shared across language subdomains (they usually differ per locale).
6. **Record the outcome in the Step 8 explanation**: which listing mode the site used, the working detail-URL pattern, and which fallback succeeded, so future updates of the same game can skip steps 1–5.

### Step 3: Identify Version-Level Information

Extract or infer the following version-level fields:

| Field         | Description                                    | How to Determine                                              |
| ------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| `version`     | Version number (e.g., "4.4", "3.5")            | Usually stated in the article title or header                 |
| `versionName` | Version subtitle/name (e.g., "鸣笛于归寂之时") | Usually in quotes in the article title                        |
| `startTime`   | Version start time (ISO 8601)                  | Maintenance/update start time stated in the article           |
| `endTime`     | Version end time (ISO 8601)                    | Explicitly stated, or inferred from version cycle (\~42 days) |
| `cover`       | Version cover image URL                        | Make a best-effort extraction attempt (see "Best-Effort Cover Extraction"); otherwise leave `""` |

### Step 4: Identify Activities to Include

**Include** the following types of activities:

- Version limited-time events (版本限时活动)
- Sign-in events (签到活动)
- Combat/challenge events (战斗挑战活动)
- Exploration events (区域探索活动)
- Version-rotating challenges (版本轮换挑战)

**Exclude** the following types of content:

- 角色卡池/祈愿/唤取/棋盘 (Character banners/gacha)
- 武器卡池/弧盘研募 (Weapon banners/gacha)
- 永久开放内容 (Permanently available content — story quests, new regions, permanent game modes)
- 商城上架内容 (Shop items — costumes, vehicles, houses)
- 补偿邮件 (Compensation mail)
- 版本更新公告本身 (The version update notice itself)
- 新手活动 (New player activities, unless they are version-limited)

**Preserve ongoing activities from previous versions:** When updating an existing file, read that same file's current contents first. If any activity's `endTime` is after the new version's `startTime`, that activity is still ongoing and **must be kept** in the updated JSON, even if the new version introduces a replacement activity of the same type. Check per locale — each `{id}-{locale}.json` is compared against itself.

### Step 5: Extract Activity-Level Fields

For each included activity, extract:

| Field         | Description                    | How to Determine                                                                                                          |
| ------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `name`        | Activity name                  | Use exact text from the article, including special characters like 「」・·                                                |
| `kind`        | Activity category              | The category the source itself uses (e.g. `叙事活动`, `挑战活动`, `登录活动`). Leave `""` when the source gives none |
| `description` | Activity description           | Use the descriptive text from the article. If no description is provided, summarize the activity purpose in one sentence. |
| `startTime`   | Activity start time (ISO 8601) | See "Time Format Rules" below                                                                                             |
| `endTime`     | Activity end time (ISO 8601)   | See "Time Format Rules" below                                                                                             |
| `cover`       | Activity cover image URL       | Make a best-effort extraction attempt (see below); use the fixed cover for recurring activities; otherwise leave `""` |

#### Best-Effort Cover Extraction

Before leaving a `cover` empty, make a reasonable attempt to find one in the source material:

- `<img>` tags in the fetched page or announcement — check `src`, `data-src`, and `srcset` attributes.
- Links ending in an image extension (`.jpg` / `.jpeg` / `.png` / `.webp` / `.gif` / `.avif`), including protocol-relative `//cdn…` URLs (prefix with `https:`) and image URLs inside JSON payloads (pageData sources).
- Prefer images visually tied to the subject itself (the activity's banner / key art); avoid site chrome — icons, avatars, QR codes, sponsor logos, and shared page decorations.

Still leave `""` when nothing plausibly matches — never guess or fabricate a URL.

#### Fixed Covers for Recurring Activities

These are the fixed covers for recurring activities:

| Activity Prefix | Cover URL                                                                         |
| --------------- | --------------------------------------------------------------------------------- |
| 异相仲裁        | `https://i0.hdslb.com/bfs/new_dyn/0869ac215b041b4bbab8197c9c44cef71340190821.jpg` |
| 末日幻影        | `https://i0.hdslb.com/bfs/article/839c3f2ba8ffc2b63b4cd209f8f989041340190821.jpg` |
| 虚构叙事        | `https://i0.hdslb.com/bfs/new_dyn/13e21e998566cef8e41f4ae287c17fc11340190821.jpg` |
| 异器盈界        | `https://i0.hdslb.com/bfs/new_dyn/125f62a2238e44ea5a0ae7278b4029501340190821.png` |
| 花藏繁生        | `https://i0.hdslb.com/bfs/new_dyn/5cf1083cdeaabb38eb94d30ab2b6a2e51340190821.png` |
| 位面分裂        | `https://i0.hdslb.com/bfs/new_dyn/234306c260be1c80654431efe81c6ce81340190821.png` |
| 砺行修远        | `https://i0.hdslb.com/bfs/new_dyn/c05ee2327918f3e4271db3ff66ce2026401742377.jpg`  |
| 声弦涤荡        | `https://i0.hdslb.com/bfs/new_dyn/d28121ede1d524963a69bd0687731d3a1955897084.jpg` |
| 回音盈域        | `https://i0.hdslb.com/bfs/new_dyn/c748978107a473b51d8d3e5cd6e0fd9e1955897084.jpg` |

### Step 6: Time Format Rules

**General rules:**

- All times must be in **ISO 8601 format**: `YYYY-MM-DDTHH:mm:ss`
- All times are in **Asia/Shanghai timezone (UTC+8)** unless the article specifies otherwise
- The article usually states times as "服务器时间" (server time), which defaults to UTC+8
- **End times must use the last second of the minute** (e.g., `03:59:59` instead of `03:59:00`).

**Converting relative time references:**

| Article Text                                | How to Convert                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| "X版本更新后"                               | Use the version maintenance completion time (e.g., if maintenance is 06:00-11:00, use 11:00:00)   |
| "X版本结束（前）"                           | Use the version end time                                                                          |
| "永久开放"                                  | **Exclude** this activity — it's not a limited-time event                                         |
| "Y版本结束前" (references a future version) | Search the web for that version's end date, then use it. If not found, note it as an estimate.    |
| "活动期间" with no dates                    | If version-period aligned, use version start/end. If no dates at all, note it in the explanation. |

**Common game time conventions:**

| Game                               | Daily Reset | Version Update Time             | Version End Time     |
| ---------------------------------- | ----------- | ------------------------------- | -------------------- |
| Genshin Impact (原神)              | 04:00       | \~06:00 after maintenance       | \~06:00 next version |
| Honkai: Star Rail (崩坏：星穹铁道) | 04:00       | \~06:00 after maintenance       | \~06:00 next version |
| Zenless Zone Zero (绝区零)         | 04:00       | \~06:00-11:00 after maintenance | \~06:00 next version |
| Wuthering Waves (鸣潮)             | 04:00       | \~04:00-11:00 after maintenance | \~03:59 next version |
| Neverness To Eeverness (异环)      | 05:00       | \~06:00-11:00 after maintenance | \~05:59 next version |

### Step 7: Output JSON

Write the result to `public/api/v1/activity/{id}.json` (default locale) or `public/api/v1/activity/{id}-{locale}.json` (other locales), with the following structure:

```json
{
  "version": "X.X",
  "versionName": "版本副标题",
  "startTime": "YYYY-MM-DDTHH:mm:ss",
  "endTime": "YYYY-MM-DDTHH:mm:ss",
  "cover": "",
  "activities": [
    {
      "name": "活动名称",
      "kind": "活动分类",
      "description": "活动描述",
      "startTime": "YYYY-MM-DDTHH:mm:ss",
      "endTime": "YYYY-MM-DDTHH:mm:ss",
      "cover": ""
    }
  ]
}
```

When writing, overwrite the whole file with `Write`, keeping 2-space indentation. 

### Step 8: Provide Explanations

After writing the JSON, provide a brief **说明** (explanation) section covering:

1. **Version time**: How the version start/end times were determined
2. **Excluded items**: List what was excluded and why (e.g., web events, gacha, permanent content)
3. **Time notes**: Explain any time assumptions or conversions made (e.g., "3.5版本更新后" was converted to 11:00 as the maintenance completion time)
4. **Preserved activities**: Which ongoing activities were carried over from the previous version
5. **Estimated dates**: If any dates were estimated (e.g., referencing a future version's end date), note that the actual date should be confirmed with official announcements

## Additional Rules

- **Language matching**: All output (JSON values, descriptions, explanations) must be in the language of the source used for that locale (zh-CN data source → Chinese; en-US data source → English). The explanation section follows the user's message language.
- **Description text**: Use the article's original descriptive text verbatim when available. If the article doesn't provide a description, write a concise one-sentence summary.
- **Cover field**: Make a best-effort extraction attempt (see "Best-Effort Cover Extraction" in Step 5) before leaving as empty string `""`; never guess or fabricate a URL.
- **Ordering**: List activities in chronological order by start time.
- **No fabrication**: Do not invent dates, times, or descriptions not present in or reasonably inferable from the source material. If information is missing, note it in the explanation.
