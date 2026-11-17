---
title: 隐私政策
description: SRA 收集哪些信息、如何使用、存放于何处。
sidebar:
  order: 3
---

最后更新：2026-11-17

StarRailAssistant（以下简称“SRA”）是一个开源的游戏自动化工具。我们遵循最小必要原则，只收集维持项目运行与排查问题所必需的信息。本页说明 SRA 桌面端会收集哪些信息、用途以及你的控制方式。

## 一、匿名使用统计

SRA 桌面端在退出时会向统计服务（`https://shasnow.top/s/api/report`）发送一条匿名事件。该请求仅用于统计版本使用情况与运行时长，不涉及游戏账号、密码、Cookie、截图或文件内容。

发送的字段如下：

| 字段 | 说明 |
| --- | --- |
| `deviceId` | 首次运行时随机生成的 UUID，保存在 `%APPDATA%/SRA/profile.txt`（Linux 为 `~/.config/SRA/profile.txt`） |
| `eventType` | 事件类型，当前仅上报 `logout` |
| `eventData` | 事件附带数据，当前为空字符串 |
| `appId` | 固定为 `SRA` |
| `appVersion` | 当前 SRA 版本号 |
| `timestamp` | 事件发生时的 Unix UTC 时间戳 |
| `sessionDuration` | 本次运行时长（秒） |

`deviceId` 只是随机字符串，不与硬件指纹、系统账号或游戏账号关联，无法用于识别你的真实身份，也无法用于跨设备追踪。

## 二、你主动导出的日志

控制台的“导出日志”功能**只在你点击并选择保存路径后执行**，导出的 ZIP 保存在你指定的位置，SRA 不会自动上传。ZIP 包含：

- `console.log`：控制台页面捕获的后端实时输出（最多最近 1000 行）。
- `frontend/`：前端 Serilog 日志（按天滚动，保留 7 天）。
- `backend/`：后端日志文件及任务失败截图（`log/` 目录下的 `.log` 与 `.png`）。
- `manifest.json`：导出时间、SRA 版本、系统信息（操作系统版本、架构、.NET 版本、CPU 核数、区域设置）、显示器信息（分辨率、工作区、缩放比例、是否主屏）以及通用设置。

日志与清单可能包含本地文件路径、配置内容和运行环境信息。请仅在你知情并同意的情况下将这些日志发送给开发者用于排查问题；如果你不希望分享这些内容，请不要使用该功能。

## 三、本地存储

SRA 会在本机保存以下数据，这些数据不会自动上传：

- `settings.json`：你的设置项。
- `configs/<Name>.json`：任务配置。
- `cache.json` 与 `cache/`：启动时间、背景图等缓存。
- `logs/`（前端）与 `log/`（后端）：运行日志与失败截图。

如需清除上述数据，可在设置页打开对应文件夹手动删除，或使用“资源清理”功能。

## 四、你的权利

- 你可以随时删除 `profile.txt`，SRA 会在下次运行时生成新的匿名 `deviceId`。
- 你可以不使用“导出日志”功能，SRA 不会在你未操作的情况下生成或上传日志包。
- 你可以注册并登录 [dash.shasnow.top](https://dash.shasnow.top)，查看和管理你的使用数据。
- 如需了解、删除已上报的统计数据，或对本政策有疑问，可通过 [GitHub Issues](https://github.com/Shasnow/StarRailAssistant/issues) 或用户群联系开发者。

## 五、政策变更

本政策可能随功能调整而更新，最新版本始终发布于本页面。继续使用 SRA 即表示你同意更新后的政策。
