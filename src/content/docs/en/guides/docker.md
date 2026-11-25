---
title: Deploying SRA-server with Docker
description: Deploy SRA-server (WebUI + HTTP API + MCP) on Linux with Docker, including cloud game configuration, data persistence, and image updates
sidebar:
  order: 3
---

The container image packages **SRA-server** only: static WebUI hosting, the HTTP API, and MCP. The image already
includes the WebUI, tasks, extensions, and image resources, and comes with Chromium preinstalled.

:::warning[Cloud games only]
Local mode depends on `pyautogui` / `pywin32` and a real 1920×1080 game window, so it only runs on Windows. The only
option inside the container is a **cloud game**: the container's Chromium connects to Cloud · Honkai: Star Rail.
Global hotkeys are also unavailable in the container.
:::

## Prerequisites

| Item | Requirement |
| --- | --- |
| Docker | With Compose v2 (the `docker compose` subcommand) |
| Network | Must be able to reach `ghcr.io` when pulling the image; the image is public, so no login is needed |
| Disk | About 570 MB downloaded when pulling; the image is about 1.5 GB; a running container uses about 2.2 GB (image + writable layer) |

## Quick start

Create a new directory and save the following as `docker-compose.yml`:

```yaml
services:
  sra-server:
    image: ghcr.io/shasnow/starrailassistant:beta
    container_name: sra-server
    restart: unless-stopped
    ports:
      - "5073:5073"
    environment:
      # Access token; leave empty to allow all /api requests; always set a strong random string for public deployments
      SRA_ACCESS_TOKEN: "change-me"
      SRA_HOST: "0.0.0.0"
      SRA_PORT: "5073"
      SRA_LOG_LEVEL: "INFO"
      TZ: "Asia/Shanghai"
    volumes:
      # State volume: settings.json, configs/, cache/ (the cloud game login state lives under cache/selenium_profile)
      - sra-data:/root/.config/SRA
      # Run logs and failure screenshots
      - sra-log:/app/log

volumes:
  sra-data:
  sra-log:
```

Then start it:

```bash
docker compose up -d
```

Open `http://localhost:5073` in your browser and enter the token you set above in the WebUI.

You can also run it without Compose (note that you must mount the volumes yourself):

```bash
docker run -d --name sra-server -p 5073:5073 \
  -e SRA_ACCESS_TOKEN=<你的令牌> \
  -v sra-data:/root/.config/SRA \
  -v sra-log:/app/log \
  ghcr.io/shasnow/starrailassistant:beta
```

:::tip
The [docker-compose.yml](https://github.com/Shasnow/StarRailAssistant/blob/main/docker-compose.yml) at the repository
root is an equivalent version and also ships a health-check script.
:::

## Image tags

| Tag | Meaning |
| --- | --- |
| `beta` | The latest beta build (version numbers contain `-`) |
| `latest` | The latest stable build |
| `v<version>` | Pinned to a specific version, for example `v2.25.0-beta.3` |
| `sha-<short hash>` | Pinned to the build of a specific commit, for example `sha-d907a24` |

`beta` / `latest` are **mutable tags** that move as new builds ship; if you need predictable updates, pin a version:

```bash
# Pin a version
SRA_IMAGE_TAG=v2.25.0-beta.3 docker compose up -d

# Roll back to the build of a specific commit
SRA_IMAGE_TAG=sha-d907a24 docker compose up -d
```

:::note
The current version is on the beta channel, so only `beta` / `v<version>` / `sha-<short hash>` are available;
`latest` will appear once a stable release ships.
:::

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `SRA_HOST` | `0.0.0.0` | Listen address; do not change it to `127.0.0.1` inside the container, otherwise the host cannot reach it |
| `SRA_PORT` | `5073` | Listen port |
| `SRA_ACCESS_TOKEN` | empty | Access token; authentication is disabled when empty |
| `SRA_WEBUI` | `1` | Whether to serve the WebUI static assets; `0` exposes the API only |
| `SRA_VISITOR_MODE` | `false` | Visitor mode: settings become read-only and `/mcp` is not mounted |
| `SRA_LOG_LEVEL` | `DEBUG` | Log level |

## Cloud game

There is no desktop session inside the container, so only the cloud game is available. **On first start the
entrypoint script automatically writes these settings into `settings.json`**, so no manual configuration is needed:

| Setting | Value written |
| --- | --- |
| Cloud game | Enabled |
| Browser | `Chrome for Testing` |
| Browser path | `/usr/local/bin/chromium-container` |
| Headless mode | Enabled |

Why `Chrome for Testing`: that option maps to the `webdriver.Chrome` branch in the code, while what actually
launches is the container's Debian Chromium; the wrapper script the path points to adds
`--no-sandbox --disable-dev-shm-usage` (Chromium's setuid sandbox is unavailable when running as root). The driver is
the `chromium-driver` bundled from the same source, so the versions match by construction and it **never** downloads
anything at runtime.

:::caution[The presets only take effect once]
The entrypoint script writes them only when `settings.json` does **not** exist, and never overwrites existing
settings. If your data volume already contains a `settings.json` (for example, from an earlier image), these entries
will not be filled in automatically after an update; set them once manually in the WebUI, or delete the settings file
and let it be regenerated:

```bash
docker compose down
docker compose run --rm --entrypoint sh sra-server -c 'rm -f /root/.config/SRA/settings.json'
docker compose up -d
```
:::

The only remaining manual step is to **enter the cloud game account and password in the WebUI configuration**.
Credentials belong to each task configuration, so they cannot be baked into the image, and they should not be.

:::caution[Do not copy configurations from Windows]
Account passwords are stored encrypted, and the encryption is platform-bound (Windows uses DPAPI, other platforms
just use base64). Copying `configs/*.json` from Windows into the container will **fail to decrypt the password**,
which manifests as a silent login failure. Just create a configuration in the container's WebUI and fill it in once.
:::

The cloud game login state is stored under `cache/selenium_profile`, i.e. in the `sra-data` volume, so recreating the
container will not lose the login.

## Data and volumes

| Container path | Volume | Contents |
| --- | --- | --- |
| `/root/.config/SRA` | `sra-data` | `settings.json`, `configs/*.json`, `cache/` (including the cloud game login state) |
| `/app/log` | `sra-log` | Run logs and failure screenshots |

The WebUI, `tasks/`, `extensions/`, and `resources/` all live **in the image** (not in the volumes), so updating the
image updates the tasks, extensions, and image resources as well.

:::note[Do not confuse the three size numbers]
What you download when pulling is the **compressed layers** (about 570 MB); the SIZE reported by `docker images` is
**the sum of the uncompressed layers** (about 1.5 GB); and the container size shown in the Docker Desktop UI is
**image + the container's writable layer** (about 2.2 GB). You can check with `docker ps -s` — SIZE is the writable
layer, and the virtual value in parentheses is image + writable layer.
:::

## Updating the image

```bash
docker compose pull          # you must pull explicitly
docker compose up -d         # recreate the container with the new image; volumes and data are preserved
```

`docker compose up -d` does not actively check the registry for a new version; if an image with the same name already
exists locally, it uses the cache directly, so the `pull` step cannot be skipped. With Compose v2.22 and later,
`docker compose up -d --pull always` does both in one step.

To check whether the registry has an update first, compare digests:

```bash
docker manifest inspect ghcr.io/shasnow/starrailassistant:beta
```

## Exposing to the public internet

:::warning[The token only protects `/api`]
The authentication middleware only covers `/api` and its subpaths; `/mcp`, `/openapi/v1.json`, and static assets are
**not protected** by the token. If you expose the container to the public internet, use a reverse proxy (exposing
only the paths you need) or firewall restrictions; do not map port 5073 directly to the public internet.
:::

- Health checks can hit `/openapi/v1.json` directly (that path is not authenticated).
- The WebUI needs the token to call the API; enter it on first visit.

## Building from source

This requires the source of this repository; Docker builds the WebUI first and then packs it into the runtime image:

```bash
docker build -t sra-server .
```

## Known limitations

- Local automation is unavailable (see the note at the top), so only the cloud game works.
- Global hotkeys are unavailable: `pynput` is a desktop dependency that is not installed in the container, so only a
  warning is logged.
- It must run headless; there is no display inside the container.
- Extensions load normally, but Windows-only physical key injection only takes effect in local mode; the cloud game
  path goes through browser operations.
