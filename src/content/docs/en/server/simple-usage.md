---
title: Quick Start
description: Start the SRA server and control SRA through the WebUI, HTTP API, and MCP
sidebar:
  order: 1
---

SRA-server is SRA's web server, built on **Python + Litestar**, running in the **same process** as the SRA core:
tasks, extensions, configs, and Operator state are shared directly, with no child process or stdin/stdout
communication. It also provides:

- REST API (`/api/**`)
- WebUI (`/`, can be disabled)
- MCP server (`/mcp`, not mounted in visitor mode)
- OpenAPI docs (`/openapi`, `/openapi/v1.json`)

## Installation

Server dependencies live in the `[server]` extra:

```bash
pip install -e ".[server]"
```

When installing with uv or pipx:

```bash
uv tool install starrailassistant --extra server
pipx install "starrailassistant[server]"
```

## Starting

Three equivalent entry points:

```bash
sra serve
sra-server
python -m SRAServer
```

It listens on `127.0.0.1:5073` by default. Once started, open `http://localhost:5073` in a browser to reach the WebUI.

:::note[Where do the WebUI static assets come from]
When running inside the repository, `SRAServer/static` is used directly; when installed via pip / uv the package
contains no build output, so run `sra init` first to download the WebUI bundle and extract it to `SRAServer/static`
in the current directory. Without it the server still starts, but only the API is available, with no pages.
:::

### Startup options

| Option | Description |
| --- | --- |
| `--host` | Binds `0.0.0.0`, allowing LAN/public access (default is local only, `127.0.0.1`) |
| `--port <port>` | Listening port, default `5073` |
| `--no-webui` | Do not serve WebUI static assets; API only |
| `--no-admin` | Do not request administrator privileges (Windows elevates by default) |
| `-v, --version` | Print the version and exit |

```bash
# LAN access on port 8080
sra serve --host --port 8080

# API only, no pages
sra serve --no-webui
```

:::warning
`--host` exposes the service to other devices on the same network. Before deploying publicly, enable an
[access token](/en/server/authentication) and use a reverse proxy to restrict which paths are reachable.
:::

## Configuration sources

Priority from high to low: **command-line flags > environment variables > `SRAServer/server.toml` > defaults**.

| Environment variable | `server.toml` key | Default | Description |
| --- | --- | --- | --- |
| `SRA_HOST` | `host` | `127.0.0.1` | Listen address |
| `SRA_PORT` | `port` | `5073` | Listen port |
| `SRA_WEBUI` | `webui` | `true` | Whether to serve the WebUI |
| `SRA_ACCESS_TOKEN` | `access_token` | empty | Access token; empty means no authentication |
| `SRA_VISITOR_MODE` | `visitor_mode` | `false` | Visitor mode (read-only, MCP not mounted) |
| `SRA_LOG_LEVEL` | `log_level` | `DEBUG` | Log level |
| `SRA_APP_DATA_DIR` | `app_data_dir` | empty | Overrides the app data directory (for testing) |

`server.toml` lives in the `SRAServer` package directory and is optional:

```toml
host = "0.0.0.0"
port = 5073
webui = true
access_token = "change-me"
visitor_mode = false
log_level = "INFO"
```

## Try it out

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

Once a token is enabled, every `/api/**` request must include the `X-Access-Token` header; see
[Authentication and security](/en/server/authentication) for details.

## API overview

| Group | Endpoints |
| --- | --- |
| Authentication | `POST /api/auth` |
| Task | `POST /api/task/run`, `POST /api/task/single`, `POST /api/task/stop`, `GET /api/task/status` |
| Cloud game | `GET /api/cloudgame/qrcode` |
| Backend | `POST /api/backend/restart`, `POST /api/backend/stop`, `GET /api/backend/logs`, `GET /api/backend/logs/stream`, `GET /api/backend/screenshot` |
| Config | `GET /api/configs`, `POST /api/configs/{name}`, `GET/PUT/DELETE /api/configs/{name}` |
| Settings | `GET/PUT /api/settings` |
| Extension | `GET /api/extensions`, `GET /api/extensions/{id}/schema`, `GET/PUT /api/extensions/{id}/config`, `POST /api/extensions/{id}/run`, `POST /api/extensions/{id}/stop`, `POST /api/extensions/reload` |
| Operator | `GET /api/operator/list`, `GET /api/operator/help/{method}`, `POST /api/operator/call` |
| App info | `GET /api/app/system-info`, `GET /api/app/phrases`, `GET /api/app/background` |

- All paths are **lowercase**; the `/api/Task/status` from older docs no longer works;
- Every JSON response follows `{ "success": bool, "message": string, "data": any }`;
- Business failures usually return HTTP 200 with `success=false`; conflicts and parameter errors use 4xx;
- Interactive docs: `/openapi/swagger` (Swagger UI), `/openapi/redoc` (ReDoc), `/openapi/openapi.json`;
- WebUI dynamic forms use `/openapi/v1.json`, which merges the `TasksConfig` / `AppSettings` components.

:::note
`/openapi/v1.json` is not protected by the token, so it works well as a health-check endpoint (see
[Docker deployment](/en/guides/docker/)).
:::
