---
title: Web UI
description: SRA's web control panel
sidebar:
  order: 2
---

SRA WebUI is SRA's web control panel, built with **Vue 3 + Element Plus + Pinia**.
Its static assets are served by SRA-server directly, so no separate deployment is needed.
Online preview: [StarRailAssistant WebUI](https://sra-webui.netlify.app)

## Opening the WebUI

Start the server and visit the listening address:

```bash
sra serve
```

```text
http://localhost:5073
```

:::note
When installed via pip / uv, run `sra init` first to download the WebUI bundle (extracted to `SRAServer/static` in
the current directory). When running inside the repository, the prebuilt `SRAServer/static` is used directly.
:::

### Pages

| Page | Path | Contents |
| --- | --- | --- |
| Home | `/` | Task status, run config management, task config form, announcements |
| Logs | `/logs` | Live view, live logs, backend control |
| Settings | `/settings` | App settings form (navigated by section) |
| About | `/about` | Version and runtime info, GitHub repository, build environment, data directory |
| Login | `/login` | Enter an access token (shown once authentication is enabled) |

## Home

- **Task status**: shows the current task state and lets you start/stop it;
- **Run config**: reads the config list from `/api/configs`, selects the current config, and supports creating and deleting;
- **Task config form**: generated entirely from `/openapi/v1.json`. Whatever the backend config model looks like is
  what the page renders, so new fields need no frontend release;
- **Announcements**: activity and version info from the site.

## Logs page

- **Live view**: polls `/api/backend/screenshot` at a fixed interval for remote observation of the game screen;
- **Live logs**: pushed over SSE (`/api/backend/logs/stream`), with search, filtering, font size adjustment, and
  reconnect on disconnect. Recent logs are cached in browser `localStorage` and survive a refresh;
- **Backend control**: restart (reinitialize in-process) and stop (request stopping tasks and have the service exit).

## Settings page

The settings form is likewise driven by the OpenAPI spec; field descriptions come from the `x-i18n` information
provided by the backend, and Chinese/English/Russian UI languages are supported.
Changes are submitted via `PUT /api/settings`; when an access token is enabled, changing configs or settings
requires a valid token.

## Login and token

Once an access token is enabled (see [Authentication and security](/en/server/authentication)), any API returning
`401` redirects to `/login`:

1. Enter the access token on the login page and submit `POST /api/auth`;
2. After validation the token is written to `localStorage` as `sra_token`;
3. Subsequent requests automatically include the `X-Access-Token` header;
4. SSE cannot set custom headers, so the log stream carries it via `?access_token=` instead.

:::note
Without a configured token there is no login page, and no request carries credentials.
:::

## Visitor mode

With `SRA_VISITOR_MODE` enabled, pages remain browsable, but most write operations are silently ignored (the backend
returns success without executing), the screenshot endpoint returns an empty image, and `/mcp` is not mounted
(`Stop backend` still works). Suitable for read-only display; see
[Authentication and security](/en/server/authentication#visitor-mode).

## Remote access

By default it only listens on `127.0.0.1`, so other devices cannot connect. For LAN access:

```bash
sra serve --host
# 或
SRA_HOST=0.0.0.0 sra serve
```

Then visit `http://<host-IP>:5073`.

:::warning
`--host` lets any device on the same subnet connect. Before exposing the service to the internet, enable an access
token and use a reverse proxy to block unauthenticated paths such as `/mcp` and `/openapi`.
:::

## Development and build

The frontend source lives in `SRAFrontend/srafrontend-webui`:

```bash
pnpm install
pnpm dev          # http://localhost:5173，/api 与 /openapi 代理到 5073
pnpm build        # 类型检查 + 构建，产物自动复制到 SRAServer/static
pnpm test         # Vitest
```

`pnpm build` runs `scripts/postbuild.mjs` at the end, which clears and overwrites `SRAServer/static`,
so after a build you only need to restart the server to see the new UI.

:::tip
`pnpm dev` relies on a running SRA-server (default `127.0.0.1:5073`), so you don't have to rebuild the frontend
every time you change backend code.
:::
