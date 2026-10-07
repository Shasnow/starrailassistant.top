// 抓取 Yatta 事件数据库并保存到项目临时目录 tmp/yatta-event.json
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "tmp", "yatta-event.json");

fetch("https://gi.yatta.moe/assets/data/event.json", {
  headers: {
    accept: "application/json, text/plain, */*",
    Referer: "https://gi.yatta.moe/en",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0",
  },
  method: "GET",
})
  .then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .then((json) => {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(json, null, 2), "utf8");
    console.log(`已保存 ${Object.keys(json).length} 个事件到 ${outPath}`);
    console.log("用法: 该文件是多语言活动原始数据，仅作核对参考——用于确认活动官方名称（尤其英文名）与封面图；");
  });
