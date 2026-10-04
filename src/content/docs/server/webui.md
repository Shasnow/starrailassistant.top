---
title: Web UI
sidebar:
  order: 2
---

SRA WebUI 是 SRA 的网页控制面板，基于 Vue 3 + Element Plus 构建，随 SRA-server 一起分发。启动 SRA-server 后，在浏览器中打开服务地址即可使用，无需额外安装。

在线预览：[StarRailAssistant WebUI](https://webui.starrailassistant.top)

通过 WebUI 可以完成任务配置、运行控制、实时日志查看、画面监控等全部常用操作。

## 访问 Web UI

运行 `SRA-server.exe` 后，浏览器访问服务监听地址即可打开 Web UI：

```bash
SRA-server.exe
```

```text
http://localhost:5000    # 本地访问
```

:::tip
如果启动时指定了 `--urls` 参数，请访问对应的地址，例如 `http://localhost:8080`。
:::

### 页面概览

| 页面 | 路径 | 功能 |
|------|------|------|
| 首页 | `/` | 任务状态仪表盘、运行配置管理、任务配置表单、公告 |
| 设置 | `/settings` | 后端应用设置表单 |
| 日志 | `/logs` | 实时日志流、实时画面、后端重启/停止 |
| 关于 | `/about` | GitHub 仓库信息、系统运行时信息、构建环境信息 |
| 登录 | `/login` | Access Token 认证（启用认证后自动跳转） |

## 首页

首页是日常使用的主要入口：

- **任务状态仪表盘** — 显示后端当前运行状态
- **运行配置管理** — 选择、管理要执行的运行配置
- **任务配置表单** — 表单结构由后端 OpenAPI 规范动态生成，后端支持什么配置，页面就显示什么字段，无需前端发版即可适配新配置
- **公告** — 展示来自官方的版本公告

点击运行按钮即可通过 API 启动任务，无需记忆任何 CLI 命令。

## 日志页

日志页提供运行期间的完整可观测性：

### 实时日志

通过 SSE（Server-Sent Events）实时推送后端日志，支持：

- 筛选与搜索
- 复制与导出
- 断线自动重连

对应 API 端点为 `/api/backend/logs/stream`。

### 实时画面

以截图轮询的方式展示后端正在执行的实时画面，便于远程观察任务执行情况。对应端点为 `/api/backend/screenshot`。

### 后端控制

日志页内可直接重启或停止后端进程，无需手动打开任务管理器。

## 设置页

设置页用于修改 SRA-server 的应用设置。表单同样由后端 OpenAPI 规范动态生成——配置项的结构、类型、默认值全部由后端定义，修改后通过 `/api/Settings` 接口保存。

## 登录认证

如果后端在 `appsettings.json` 中配置了 `AccessToken`（参见[认证与安全](/server/authentication)），访问 Web UI 时会自动跳转到登录页，输入 Access Token 即可进入：

1. 打开 Web UI，任意业务请求收到 `401` 后自动跳转至 `/login`
2. 输入 Access Token 并提交验证
3. 验证通过后自动跳回之前访问的页面

Token 会保存在浏览器 `localStorage` 中，后续请求自动携带 `Authorization: Bearer` 请求头；实时日志等无法设置请求头的场景通过 URL 参数携带。

:::note
未启用认证时不会出现登录页，直接进入首页。
:::

## 远程访问

默认情况下 SRA-server 仅监听本地回环地址，局域网内其他设备无法访问。如需用手机或另一台电脑操作，绑定所有网络接口即可：

```bash
SRA-server.exe --urls http://0.0.0.0:5000
```

然后在其他设备的浏览器中访问 `http://<主机IP>:5000`。

:::warning
绑定 `0.0.0.0` 会让局域网（乃至公网，取决于防火墙配置）中的所有设备都能访问。暴露到公网前请务必[启用认证](/server/authentication)。
:::

## 更新与禁用 Web UI

### 更新

Web UI 随 SRA-server 一起分发，无需单独更新。

### 禁用

仅使用 API 而不需要网页界面时，添加 `--no-webui` 参数启动：

```bash
SRA-server.exe --no-webui
```

此时服务只提供 API 和 Swagger 文档，不托管前端静态文件。
