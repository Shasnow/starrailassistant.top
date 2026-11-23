// 从 public/api/v1/anno.json 生成「更新公告」页面，避免手工同步版本公告。
// 只保留标题以版本号开头的公告（如「2.25 更新公告」），其余隐私政策、社区公告等忽略。
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const sourcePath = `${rootDir}/public/api/v1/anno.json`;
const targetPath = `${rootDir}/src/content/docs/ann/updates.md`;

const { announcements = [] } = JSON.parse(readFileSync(sourcePath, "utf-8"));

const isVersionAnnouncement = (title) => /^\d+\.\d+/.test(title);
const versionOf = (title) => Number.parseFloat(title);

const entries = announcements
  .filter((item) => isVersionAnnouncement(item.title))
  .sort((a, b) => versionOf(b.title) - versionOf(a.title));

const body = entries
  .map((item) => `## ${item.title}\n\n${(item.content ?? "").trim()}`)
  .join("\n\n---\n\n");

const output = `---
title: 更新公告
description: SRA 各版本更新内容与问题修复记录。
sidebar:
  order: 1
---

<!-- 此文件由 scripts/gen-updates.mjs 从 public/api/v1/anno.json 自动生成，请勿手动编辑。 -->

${body}
`;

writeFileSync(targetPath, output, "utf-8");
console.log(`[gen-updates] 已生成 ${entries.length} 条版本公告 -> ${targetPath}`);
