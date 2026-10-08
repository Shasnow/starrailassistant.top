import type { APIRoute } from "astro";
import { games } from "../data/games";

// 游戏表格由 src/data/games.ts 自动生成，新增游戏无需再手动维护此文件
const gameTable = games
  .map((game) => {
    const names =
      typeof game.name === "string" ? { en: game.name } : game.name;
    const en = names.en ?? names["zh-CN"] ?? game.id;
    const zh = names["zh-CN"] ?? en;
    return `| \`${game.id}\` | ${en} | ${zh} |`;
  })
  .join("\n");

const getLlmsTxt = (origin: string) => `\
# StarRailAssistant Public API

Free, key-less public REST API serving current game version and in-game event data as JSON. Data is extracted from official game announcements and manually verified by the community. No signup or API key required.

## Base URL

\`\`\`
${origin}/api/v1
\`\`\`

## Endpoints

- \`GET /activity/{game}.json\` — activity data in the default locale (zh-CN), e.g. \`/activity/sr.json\`
- \`GET /activity/{game}-{locale}.json\` — activity data in a specific locale, e.g. \`/activity/sr-en-US.json\`

## Games

| id         | game                      | 中文名             |
| ---------- | ------------------------- | ------------------ |
${gameTable}

## Response schema

\`\`\`json
{
  "version": "4.4",
  "versionName": "version display name",
  "startTime": "ISO 8601",
  "endTime": "ISO 8601",
  "cover": "optional image URL",
  "activities": [
    {
      "name": "activity name",
      "kind": "optional category",
      "description": "activity description",
      "startTime": "ISO 8601",
      "endTime": "ISO 8601",
      "cover": "optional image URL"
    }
  ]
}
\`\`\`

## Optional

- Docs (zh-CN): ${origin}/reference/public-api/
- Docs (en-US): ${origin}/en/reference/public-api/
- Contribute: https://github.com/Shasnow/starrailassistant.top
`;

export const GET: APIRoute = ({ site }) => {
  const origin = site?.origin ?? "https://starrailassistant.top";
  return new Response(getLlmsTxt(origin), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
