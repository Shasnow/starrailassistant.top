export interface Game {
  id: string;
  name: string | Record<string, string>;
  locales: string[];
  defaultLocale: string;
  dataSources: Record<string, GameDataSource[]>;
  // 游戏活动数据更新模式：
  // - version（大版本周期型，如绝区零）：以固定大版本为更新周期，版本持续期间
  //   即使部分活动已结束，重新获取数据也不会得到新活动；仅在大版本正式结束时
  //   触发一次完整的数据更新流程。
  // - activity（持续活动型，如明日方舟）：没有明确的大版本概念，大活动进行期间
  //   可能推出另一个新活动；应在每个活动结束时立即触发数据更新流程，及时获取
  //   新活动信息。
  updateMode?: "version" | "activity"; // 活动数据更新模式，缺省按版本号格式自动识别
}

export interface GameDataSource {
  type: "html" | "script" | "pageData"; // 数据来源类型: html: HTML 页面，script: 脚本，pageData: 分页数据
  url?: string; // html 和 pageData 类型的 URL
  script?: string; // script 类型的脚本路径
  articleUrl?: string;  // pageData 类型的文章路径模板，{field} 占位符替换为数据条目中的同名字段（如 {cid}、{id}）
  // User-Agent 策略：缺省 = 不敏感，无 UA 也可访问；
  // "none" = 不要发送浏览器 UA
  userAgent?: "none";
}

export const games: Game[] = [
  {
    id: "sr",
    name: { "zh-CN": "崩坏：星穹铁道", en: "Honkai: Star Rail" },
    locales: ["zh-CN", "en-US"],
    defaultLocale: "zh-CN",
    dataSources: {
      "zh-CN": [
        {
          type: "html",
          url: "https://sr.mihoyo.com/news?nav=news&type=notice",
        },
      ],
      "en-US": [
        {
          type: "html",
          url: "https://hsr.hoyoverse.com/en-us/news?type=notice",
        },
      ],
    },
  },
  {
    id: "ys",
    name: { "zh-CN": "原神", en: "Genshin Impact" },
    locales: ["zh-CN", "en-US"],
    defaultLocale: "zh-CN",
    dataSources: {
      all: [{ type: "script", script: "scripts/fetch-ys-activity.mjs" }],
      "zh-CN": [{ type: "html", url: "https://ys.mihoyo.com/main/news" }],
      "en-US": [{ type: "html", url: "https://genshin.hoyoverse.com/en/news" }],
    },
  },
  {
    id: "zzz",
    name: { "zh-CN": "绝区零", en: "Zenless Zone Zero" },
    locales: ["zh-CN", "en-US"],
    defaultLocale: "zh-CN",
    dataSources: {
      "zh-CN": [{ type: "html", url: "https://zzz.mihoyo.com/news" }],
      "en-US": [
        { type: "html", url: "https://zenless.hoyoverse.com/en-us/news" },
      ],
    },
  },
  {
    id: "ww",
    name: { "zh-CN": "鸣潮", en: "Wuthering Waves" },
    locales: ["zh-CN", "en-US"],
    defaultLocale: "zh-CN",
    dataSources: {
      "zh-CN": [{ type: "html", url: "https://mc.kurogames.com/main/news" }],
      "en-US": [
        {
          type: "html",
          url: "https://wutheringwaves.kurogames.com/en/main/news",
        },
      ],
    },
  },
  {
    id: "nte",
    name: { "zh-CN": "异环", en: "NTE" },
    locales: ["zh-CN", "en-US"],
    defaultLocale: "zh-CN",
    dataSources: {
      "zh-CN": [{ type: "html", url: "https://yh.wanmei.com/news/index.html" }],
      "en-US": [
        {
          type: "html",
          url: "https://nte.perfectworld.com/en/article/news/gamenews/index.html",
        },
      ],
    },
  },
  {
    id: "ba-cn",
    updateMode: "activity",
    name: { "zh-CN": "蔚蓝档案（国服）", en: "Blue Archive (CN)" },
    locales: ["zh-CN"],
    defaultLocale: "zh-CN",
    dataSources: {
      all: [{ type: "script", script: "scripts/gen-ba-activity.mjs" }],
    },
  },
  {
    id: "ba-jp",
    updateMode: "activity",
    name: { "zh-CN": "蔚蓝档案（日服）", en: "Blue Archive (JP)" },
    locales: ["zh-CN"],
    defaultLocale: "zh-CN",
    dataSources: {
      all: [{ type: "script", script: "scripts/gen-ba-activity.mjs" }],
    },
  },
  {
    id: "ba-global",
    updateMode: "activity",
    name: { "zh-CN": "蔚蓝档案（国际服）", en: "Blue Archive (Global)" },
    locales: ["zh-CN"],
    defaultLocale: "zh-CN",
    dataSources: {
      all: [{ type: "script", script: "scripts/gen-ba-activity.mjs" }],
    },
  },
  {
    id: "ak",
    updateMode: "activity",
    name: { "zh-CN": "明日方舟", en: "Arknights" },
    locales: ["zh-CN"],
    defaultLocale: "zh-CN",
    dataSources: {
      "zh-CN": [
        {
          type: "pageData",
          url: "https://ak.hypergryph.com/api/news?page=1",
          articleUrl: "https://ak.hypergryph.com/news/{cid}",
        },
        {
          type: "html",
          url: "https://prts.wiki/w/活动一览",
          userAgent: "none",
        },
      ],
    },
  },
  {
    id: "end",
    name: { "zh-CN": "明日方舟：终末地", en: "Arknights: Endfield" },
    locales: ["zh-CN", "en-US"],
    defaultLocale: "zh-CN",
    dataSources: {
      "zh-CN": [
        { type: "html", url: "https://endfield.hypergryph.com/news" },
        { type: "script", script: "scripts/fetch-end-activity.mjs" },
      ],
      "en-US": [{ type: "html", url: "https://endfield.gryphline.com/news" }],
    },
  },
  {
    id: "xtlr",
    updateMode: "activity",
    name: { "zh-CN": "星塔旅人", en: "Stella Sora" },
    locales: ["zh-CN"],
    defaultLocale: "zh-CN",
    dataSources: {
      "zh-CN": [
        {
          type: "pageData",
          url: "https://stellasora.yostar.cn/api/resource/news?index=1",
          articleUrl: "'link'"
        },
      ],
    },
  },
];
