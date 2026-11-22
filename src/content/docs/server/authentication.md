---
title: 认证与安全
description: SRA 服务端的访问令牌、保护范围与访客模式
sidebar:
  order: 3
---

SRA-server 提供基于访问令牌的鉴权，默认**不启用**。令牌只保护 `/api/**`，
`/mcp`、`/openapi` 与 WebUI 静态资源不受保护。

## 开启认证

通过环境变量或 `SRAServer/server.toml` 设置 `access_token`：

```bash
# Windows PowerShell
$env:SRA_ACCESS_TOKEN = "change-me"

# Linux / macOS
export SRA_ACCESS_TOKEN="change-me"
```

```toml
# SRAServer/server.toml
access_token = "change-me"
```

令牌为空或只含空白时不启用鉴权，所有请求直接放行。临时试一下可以这样启动：

```bash
SRA_ACCESS_TOKEN=change-me sra serve   # Linux / macOS
```

```powershell
$env:SRA_ACCESS_TOKEN = "change-me"; sra serve   # Windows PowerShell
```

:::warning
令牌是逐字节比较的普通字符串，请使用足够长的随机串，并通过反向代理启用 HTTPS，
避免令牌在传输中被窃听。
:::

## 携带令牌

两种方式，**请求头优先于查询参数**：

### 请求头（推荐）

```http
X-Access-Token: change-me
```

```bash
curl -H "X-Access-Token: change-me" http://localhost:5073/api/task/status
```

### 查询参数

适用于无法自定义请求头的场景（例如 `EventSource` 发起的 SSE 日志流）：

```http
GET /api/backend/logs/stream?access_token=change-me
```

```bash
curl "http://localhost:5073/api/backend/logs/stream?access_token=change-me"
```

:::caution
令牌出现在 URL 中会被访问日志、浏览器历史与代理记录，非必要不要使用该方式。
:::

## 保护范围

| 路径 | 是否需要令牌 |
| --- | --- |
| `/api` 及其子路径 | 是 |
| `POST /api/auth` | 否（校验端点本身） |
| `GET /api/app/background` | 否（登录页背景图） |
| `/mcp` | 否（在 `/api` 之外，且访客模式下不挂载） |
| `/openapi`、`/openapi/v1.json` | 否 |
| WebUI 静态资源 | 否 |

判定只看路径前缀：只有 `/api` 本身或 `/api/...` 才鉴权，`/apifoo` 这类路径不会被拦截。
未通过校验时返回 HTTP 401 与统一响应体：

```json
{ "success": false, "message": "unauthorized", "data": null }
```

## 校验令牌

`POST /api/auth` 无需认证，可用于验证令牌是否正确：

```bash
curl -X POST http://localhost:5073/api/auth \
  -H "Content-Type: application/json" \
  -d '{"token": "change-me"}'
```

| 场景 | HTTP | 响应 |
| --- | --- | --- |
| 令牌匹配 | 200 | `{"success": true, "message": "authorized"}` |
| 令牌不匹配 | 401 | `{"success": false, "message": "unauthorized"}` |
| 未配置令牌 | 200 | `{"success": true, "message": "No access token configured"}` |

## 访客模式

访客模式（`SRA_VISITOR_MODE=true` / `visitor_mode = true`）适合公开展示：

- 不挂载 `/mcp`；
- **绝大多数写操作不会真正执行**，但仍返回成功，避免暴露内部状态：
  - `POST /api/task/run`、`/api/task/single` 返回 `"Task started"`，但不会运行任务；
  - 配置的新增/修改/删除、设置修改、扩展运行/停止/重载均为空操作；
  - `POST /api/backend/restart` 返回成功但不生效；
  - 例外：`POST /api/backend/stop` **仍然有效**，会停止任务并让服务退出；
- `GET /api/backend/screenshot` 返回空的 JPEG，不暴露游戏画面；
- 读取类接口（状态、配置列表、设置、扩展列表等）仍然可用。

:::warning
访客模式不是鉴权机制，写接口返回的 `success=true` 具有误导性。
需要限制访问时请同时启用访问令牌。
:::

## 公开部署建议

- `.NET` 版本的 `appsettings.json` 与 `SRA-server.exe` 已不再使用，配置一律通过环境变量或 `server.toml`；
- 反向代理只放行需要的路径，例如仅暴露 `/`（WebUI）与 `/api`，屏蔽 `/mcp` 与 `/openapi`；
- 默认监听 `127.0.0.1`，只有显式使用 `--host` 或 `SRA_HOST=0.0.0.0` 才会对外开放；
- 未启用认证时，任何能访问端口的人都可运行任务、修改配置、截取画面并操作游戏，
  详见 [Docker 部署](/guides/docker/) 中的暴露公网说明。
