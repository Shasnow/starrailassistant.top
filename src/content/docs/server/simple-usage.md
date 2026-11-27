---
title: 简单使用
description: 启动 SRA 服务端，通过 WebUI、HTTP API 与 MCP 控制 SRA
sidebar:
  order: 1
---

SRA-server 是 SRA 的 Web 服务端，基于 **Python + Litestar**，与 SRA 核心运行在**同一进程**：
任务、扩展、配置与 Operator 状态直接共享，不存在子进程与 stdin/stdout 通信。它同时提供：

- REST API（`/api/**`）
- WebUI（`/`，可关闭）
- MCP 服务（`/mcp`，访客模式下不挂载）
- OpenAPI 文档（`/openapi`、`/openapi/v1.json`）

## 安装

服务端依赖位于 `[server]` extra：

```bash
pip install -e ".[server]"
```

使用 uv 或 pipx 安装时：

```bash
uv tool install starrailassistant --extra server
pipx install "starrailassistant[server]"
```

## 启动

三个等价入口：

```bash
sra serve
sra-server
python -m SRAServer
```

默认监听 `127.0.0.1:5073`。启动后在浏览器打开 `http://localhost:5073` 即可进入 WebUI。

:::note[WebUI 静态资源从哪来]
在仓库内运行时直接使用 `SRAServer/static`；通过 pip / uv 安装时包内不含构建产物，
需要先执行 `sra init` 下载 WebUI 包并解压到当前目录的 `SRAServer/static`。
未下载时服务仍可启动，但只有 API，没有页面。
:::

### 启动参数

| 参数 | 说明 |
| --- | --- |
| `--host` | 绑定 `0.0.0.0`，允许局域网/公网访问（默认仅本机 `127.0.0.1`） |
| `--port <端口>` | 监听端口，默认 `5073` |
| `--no-webui` | 不托管 WebUI 静态资源，仅提供 API |
| `--no-admin` | 不请求管理员权限（Windows 默认会自提权） |
| `-v, --version` | 打印版本后退出 |

```bash
# 局域网访问并改用 8080 端口
sra serve --host --port 8080

# 只开 API，不托管页面
sra serve --no-webui
```

:::warning
`--host` 会把服务暴露给同网络的其他设备。公网部署前请启用[访问令牌](/server/authentication)，
并用反向代理限制可访问的路径。
:::

## 配置来源

优先级从高到低：**命令行参数 > 环境变量 > `SRAServer/server.toml` > 默认值**。

| 环境变量 | `server.toml` 键 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `SRA_HOST` | `host` | `127.0.0.1` | 监听地址 |
| `SRA_PORT` | `port` | `5073` | 监听端口 |
| `SRA_WEBUI` | `webui` | `true` | 是否托管 WebUI |
| `SRA_ACCESS_TOKEN` | `access_token` | 空 | 访问令牌，空表示不鉴权 |
| `SRA_VISITOR_MODE` | `visitor_mode` | `false` | 访客模式（只读、不挂载 MCP） |
| `SRA_LOG_LEVEL` | `log_level` | `DEBUG` | 日志级别 |
| `SRA_APP_DATA_DIR` | `app_data_dir` | 空 | 覆盖应用数据目录（测试用） |

`server.toml` 放在 `SRAServer` 包目录下，可省略：

```toml
host = "0.0.0.0"
port = 5073
webui = true
access_token = "change-me"
visitor_mode = false
log_level = "INFO"
```

## 快速体验

```bash
# 任务状态
curl http://localhost:5073/api/task/status

# 运行配置 Default 中的任务
curl -X POST http://localhost:5073/api/task/run \
  -H "Content-Type: application/json" \
  -d '{"configName": "Default"}'

# 停止当前任务（空闲时返回 success=false，HTTP 200）
curl -X POST http://localhost:5073/api/task/stop

# 最近 50 条日志
curl "http://localhost:5073/api/backend/logs?count=50"

# 保存当前画面截图（JPEG）
curl -o screenshot.jpg http://localhost:5073/api/backend/screenshot

# 直接调用 Operator 方法
curl -X POST http://localhost:5073/api/operator/call \
  -H "Content-Type: application/json" \
  -d '{"method": "press_key", "params": {"key": "esc"}}'
```

启用令牌后，所有 `/api/**` 请求都需要附加 `X-Access-Token` 请求头，详见[认证与安全](/server/authentication)。

## API 一览

| 分组 | 端点 |
| --- | --- |
| 认证 | `POST /api/auth` |
| 任务 | `POST /api/task/run`、`POST /api/task/single`、`POST /api/task/stop`、`GET /api/task/status` |
| 云游戏 | `GET /api/cloudgame/qrcode` |
| 后端 | `POST /api/backend/restart`、`POST /api/backend/stop`、`GET /api/backend/logs`、`GET /api/backend/logs/stream`、`GET /api/backend/screenshot` |
| 配置 | `GET /api/configs`、`POST /api/configs/{name}`、`GET/PUT/DELETE /api/configs/{name}` |
| 设置 | `GET/PUT /api/settings` |
| 扩展 | `GET /api/extensions`、`GET /api/extensions/{id}/schema`、`GET/PUT /api/extensions/{id}/config`、`POST /api/extensions/{id}/run`、`POST /api/extensions/{id}/stop`、`POST /api/extensions/reload` |
| Operator | `GET /api/operator/list`、`GET /api/operator/help/{method}`、`POST /api/operator/call` |
| 应用信息 | `GET /api/app/system-info`、`GET /api/app/phrases`、`GET /api/app/background` |

- 路径均为**小写**，旧版文档中的 `/api/Task/status` 不再可用；
- 所有 JSON 响应统一为 `{ "success": bool, "message": string, "data": any }`；
- 业务失败通常返回 HTTP 200 + `success=false`，冲突与参数错误使用 4xx；
- 交互式文档：`/openapi/swagger`（Swagger UI）、`/openapi/redoc`（ReDoc）、`/openapi/openapi.json`；
- WebUI 动态表单使用合并了 `TasksConfig` / `AppSettings` 组件的 `/openapi/v1.json`。

:::note
`/openapi/v1.json` 不受令牌保护，适合作为健康检查端点（见 [Docker 部署](/guides/docker/)）。
:::
