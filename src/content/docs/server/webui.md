---
title: Web UI
description: SRA 的网页控制面板
sidebar:
  order: 2
---

SRA WebUI 是 SRA 的网页控制面板，基于 **Vue 3 + Element Plus + Pinia** 构建，
由 SRA-server 直接托管静态资源，无需单独部署。
在线预览：[StarRailAssistant WebUI](https://sra-webui.netlify.app)

## 打开 WebUI

启动服务端后访问监听地址即可：

```bash
sra serve
```

```text
http://localhost:5073
```

:::note
通过 pip / uv 安装时，需要先执行 `sra init` 下载 WebUI 包（解压到当前目录的 `SRAServer/static`）。
仓库内运行时直接使用已构建好的 `SRAServer/static`。
:::

### 页面

| 页面 | 路径 | 内容 |
| --- | --- | --- |
| 首页 | `/` | 任务状态、运行配置管理、任务配置表单、公告 |
| 日志 | `/logs` | 实时画面、实时日志、后端控制 |
| 设置 | `/settings` | 应用设置表单（按分区导航） |
| 关于 | `/about` | 版本与运行时信息、GitHub 仓库、构建环境、数据目录 |
| 登录 | `/login` | 填写访问令牌（启用认证后出现） |

## 首页

- **任务状态**：显示当前任务运行状态，可启动/停止；
- **运行配置**：从 `/api/configs` 读取配置列表，选择当前配置，支持新建与删除；
- **任务配置表单**：完全由 `/openapi/v1.json` 动态生成。后端配置模型是什么样，页面就渲染什么字段，
  新增字段无需前端发版；
- **公告**：展示来自站点的活动与版本信息。

## 日志页

- **实时画面**：以固定间隔轮询 `/api/backend/screenshot`，用于远程观察游戏画面；
- **实时日志**：通过 SSE（`/api/backend/logs/stream`）推送，支持搜索、筛选、字号调整与断线重连，
  最近的日志会缓存到浏览器 `localStorage`，刷新后仍能保留；
- **后端控制**：重启（进程内重新初始化）与停止（请求停止任务并让服务退出）。

## 设置页

设置表单同样由 OpenAPI 规范驱动，字段说明来自后端附带的 `x-i18n` 信息，支持中/英/俄界面语言。
修改通过 `PUT /api/settings` 提交；启用了访问令牌时，修改配置或设置需要令牌有效。

## 登录与令牌

启用访问令牌后（见[认证与安全](/server/authentication)），任意 API 返回 `401` 都会跳转到 `/login`：

1. 在登录页输入访问令牌并提交 `POST /api/auth`；
2. 校验通过后令牌写入 `localStorage` 的 `sra_token`；
3. 后续请求自动附加 `X-Access-Token` 请求头；
4. SSE 无法自定义请求头，日志流改为通过 `?access_token=` 携带。

:::note
未配置令牌时不会出现登录页，所有请求都不带认证信息。
:::

## 访客模式

开启 `SRA_VISITOR_MODE` 后，页面仍可浏览，但绝大多数写操作会被静默忽略（后端返回成功但不执行），
截图接口返回空图片，且 `/mcp` 不会挂载（`停止后端` 仍然有效）。适合只读展示，详见
[认证与安全](/server/authentication#访客模式)。

## 远程访问

默认只监听 `127.0.0.1`，其他设备无法访问。需要局域网访问时：

```bash
sra serve --host
# 或
SRA_HOST=0.0.0.0 sra serve
```

然后访问 `http://<主机IP>:5073`。

:::warning
`--host` 会让同网段设备都能访问。暴露到公网前请启用访问令牌，并用反向代理屏蔽
`/mcp`、`/openapi` 等不鉴权的路径。
:::

## 开发与构建

前端源码位于 `SRAFrontend/srafrontend-webui`：

```bash
pnpm install
pnpm dev          # http://localhost:5173，/api 与 /openapi 代理到 5073
pnpm build        # 类型检查 + 构建，产物自动复制到 SRAServer/static
pnpm test         # Vitest
```

`pnpm build` 结束时会执行 `scripts/postbuild.mjs`，清空并覆盖 `SRAServer/static`，
因此构建完成后直接重启服务端即可看到新界面。

:::tip
`pnpm dev` 会用到已运行的 SRA-server（默认 `127.0.0.1:5073`），
改完后端代码时不用反复构建前端。
:::
