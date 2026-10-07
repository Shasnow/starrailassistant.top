// @ts-check
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightDocSearch from "@astrojs/starlight-docsearch";
import vue from "@astrojs/vue";

// https://astro.build/config
export default defineConfig({
  site: "https://starrailassistant.top",
  redirects: {
    "/sra-strategy-site": "/strategy",
  },
  vite: {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      // 本地开发时将 /api 代理到 SRA 后端
      proxy: {
        "/api": {
          target: "http://localhost:5035",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  },
  integrations: [
    vue(),
    starlight({
      title: "StarRailAssistant",
      description:
        "崩坏：星穹铁道助手 | 一个基于图像识别的崩铁自动化程序，帮您完成从启动到退出的崩铁日常。",
      logo: { src: "./src/assets/SRAico.png" },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/Shasnow/StarRailAssistant",
        },
        {
          icon: "link-alt",
          label: "攻略站",
          href: "/strategy",
        }
      ],
      editLink: { baseUrl: "https://github.com/Shasnow/starrailassistant.top" },
      sidebar: [
        {
          label: "文档",
          translations: { en: "Docs" },
          items: [
            {
              label: "从这里开始",
              translations: { en: "Start Here" },
              items: [{ autogenerate: { directory: "getting-started" } }],
            },
            {
              label: "SRA-cli 命令行工具",
              translations: { en: "SRA-cli" },
              items: [{ autogenerate: { directory: "cli" } }],
            },
            {
              label: "SRA-server",
              items: [{ autogenerate: { directory: "server" } }],
            },
            {
              label: "指南",
              translations: { en: "Guides" },
              items: [{ autogenerate: { directory: "guides" } }],
            },
            {
              label: "教程",
              translations: { en: "Tutorials" },
              items: [{ autogenerate: { directory: "tutorials" } }],
            },
            { label: "赞助", translations: { en: "Sponsor" }, slug: "sponsor" },
            { label: "加入我们", translations: { en: "Join Us" }, slug: "join-us" },
          ],
        },
        {
          label: "参考",
          translations: { en: "Reference" },
          items: [{ autogenerate: { directory: "reference" } }],
        },
        {
          label: "公告",
          translations: { en: "Announcements" },
          items: [{ autogenerate: { directory: "ann" } }],
        },
      ],
      components: {
        Sidebar: "./src/components/starlight/Sidebar.astro",
        Head: "./src/components/starlight/Head.astro",
      },
      locales: {
        root: {
          label: "简体中文",
          lang: "zh-CN",
        },
        en: {
          label: "English",
        },
      },
      plugins: [
        starlightDocSearch({
          appId: "S8GXZVU0M4",
          apiKey: "29f87aa85e555e6bcd3df6e748615101",
          indexName: "starrailassistant",
        }),
      ],
      customCss: ["./src/styles/main.css", "./src/styles/download.css"],
      favicon: "favicon.ico",
      lastUpdated: true,
    }),
  ],
});
