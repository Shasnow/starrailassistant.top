---
title: Authentication and Security
description: Access tokens, protected scope, and visitor mode for the SRA server
sidebar:
  order: 3
---

SRA-server provides access-token-based authentication, **disabled** by default. The token only protects `/api/**`;
`/mcp`, `/openapi`, and the WebUI static assets are unprotected.

## Enabling authentication

Set `access_token` through an environment variable or `SRAServer/server.toml`:

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

An empty token, or one containing only whitespace, disables authentication and lets every request through.
To try it temporarily, start the server like this:

```bash
SRA_ACCESS_TOKEN=change-me sra serve   # Linux / macOS
```

```powershell
$env:SRA_ACCESS_TOKEN = "change-me"; sra serve   # Windows PowerShell
```

:::warning
The token is an ordinary string compared byte by byte. Use a sufficiently long random string and enable HTTPS
through a reverse proxy so the token cannot be eavesdropped in transit.
:::

## Sending the token

There are two ways; **the header takes precedence over the query parameter**:

### Header (recommended)

```http
X-Access-Token: change-me
```

```bash
curl -H "X-Access-Token: change-me" http://localhost:5073/api/task/status
```

### Query parameter

Useful when custom headers are not possible (for example the SSE log stream opened by `EventSource`):

```http
GET /api/backend/logs/stream?access_token=change-me
```

```bash
curl "http://localhost:5073/api/backend/logs/stream?access_token=change-me"
```

:::caution
A token in the URL gets recorded in access logs, browser history, and proxies. Avoid this method unless necessary.
:::

## Protected scope

| Path | Token required |
| --- | --- |
| `/api` and its subpaths | Yes |
| `POST /api/auth` | No (the validation endpoint itself) |
| `GET /api/app/background` | No (login page background image) |
| `/mcp` | No (outside `/api`, and not mounted in visitor mode) |
| `/openapi`, `/openapi/v1.json` | No |
| WebUI static assets | No |

The check only looks at the path prefix: only `/api` itself or `/api/...` is authenticated, so paths such as
`/apifoo` are not intercepted. Failed validation returns HTTP 401 with the standard response body:

```json
{ "success": false, "message": "unauthorized", "data": null }
```

## Validating a token

`POST /api/auth` requires no authentication, so you can use it to check whether a token is correct:

```bash
curl -X POST http://localhost:5073/api/auth \
  -H "Content-Type: application/json" \
  -d '{"token": "change-me"}'
```

| Scenario | HTTP | Response |
| --- | --- | --- |
| Token matches | 200 | `{"success": true, "message": "authorized"}` |
| Token does not match | 401 | `{"success": false, "message": "unauthorized"}` |
| No token configured | 200 | `{"success": true, "message": "No access token configured"}` |

## Visitor mode

Visitor mode (`SRA_VISITOR_MODE=true` / `visitor_mode = true`) suits public display:

- `/mcp` is not mounted;
- **The vast majority of write operations are not actually executed**, yet still return success, to avoid exposing
  internal state:
  - `POST /api/task/run` and `/api/task/single` return `"Task started"` without running the task;
  - creating/modifying/deleting configs, changing settings, and running/stopping/reloading extensions are all no-ops;
  - `POST /api/backend/restart` returns success but has no effect;
  - exception: `POST /api/backend/stop` **still works** and stops tasks, making the service exit;
- `GET /api/backend/screenshot` returns an empty JPEG and does not expose the game screen;
- read endpoints (status, config list, settings, extension list, etc.) still work.

:::warning
Visitor mode is not an authentication mechanism; the `success=true` returned by write endpoints is misleading.
Enable an access token as well when access must be restricted.
:::

## Public deployment recommendations

- The `.NET` version's `appsettings.json` and `SRA-server.exe` are no longer used; configure everything through
  environment variables or `server.toml`;
- Let the reverse proxy pass only the paths you need, e.g. expose just `/` (WebUI) and `/api`, and block `/mcp`
  and `/openapi`;
- It listens on `127.0.0.1` by default; only an explicit `--host` or `SRA_HOST=0.0.0.0` opens it to the outside;
- Without authentication, anyone who can reach the port can run tasks, modify configs, capture the screen, and
  operate the game; see the public exposure notes in [Docker deployment](/en/guides/docker/).
