---
title: Get SRA
sidebar:
  order: 0
---

There are several ways to get StarRailAssistant (SRA).

## Windows

### Download via Mirror Chyan (recommended)

Download link: [**Mirror Chyan**](https://mirrorchyan.com/zh/projects?rid=StarRailAssistant&source=sra-webside)

:::note
SRA has integrated Mirror Chyan and can be downloaded directly from it.

Mirror Chyan is a third-party distribution platform. It only charges for the download acceleration service, which does not mean SRA requires a paid subscription.

Mirror Chyan can also take care of subsequent updates.
:::

### Download via GitHub Release

Download link: [**GitHub Releases**](https://github.com/Shasnow/StarRailAssistant/releases/latest)

<div class="download-card">
  <div class="download-card__content">
    <h3 style="margin: 0; color: #FFFFFF;">Download StarRailAssistant </h3>
    <p style="margin: 0; color: #8BC53F;">Includes 3 items:
      <span style="color: #B0AEA3;">SRA.exe, </span>
      <span style="color: #B0AEA3;">SRA-cli.exe, </span>
      <span style="color: #B0AEA3;">SRA-server.exe</span>
    </p>
  </div>
  <div class="download-card__actions">
    <div class="download-card__price">
      <span style="background-color: #4C6B22; font-weight: bold; color: #BEEE11; padding: 6px 8px; border-radius: 4px 0 0 4px;">-100%</span>
      <span style="font-weight: bold; color: #BEEE11; background-color: #344654; padding: 6px 8px; border-radius: 0 4px 4px 0;">￥0.00</span>
    </div>
    <a class="download-card__button" href="https://github.com/Shasnow/StarRailAssistant/releases/latest">Add to Cart</a>
  </div>
</div>

:::note
Labels such as `-100%` and `￥0.00` are just for fun and do not mean SRA requires a paid subscription.
:::

#### Package Descriptions

**StarRailAssistant Core**

- File name: `StarRailAssistant_Core_vx.x.x.zip`
- Contains: SRA-cli.exe and core resources (tasks, extensions, resources, SRACore)
- Provides only the most basic command-line functionality. When used on its own, configuration and settings files must be created manually.

**StarRailAssistant**

- File name: `StarRailAssistant_vx.x.x.zip`
- Contains: SRA.exe (graphical interface), SRA-cli.exe (command line), SRA-server.exe (HTTP server), and core resources
- Has all of SRA's features, including the graphical interface, command-line tool, and HTTP server. **For general users, we recommend this version.**

**StarRailAssistant Lite**

- File name: `StarRailAssistant_Lite_vx.x.x.zip`
- Contains: SRA.exe, main.py, and the Python source code
- Consists of the desktop release artifacts and the SRA source code; a Python environment must be configured manually before it can run.

**StarRailAssistant Resources**

- File name: `StarRailAssistant_Resources_vx.x.x.zip`
- Contains: tasks, extensions, resources, and package.json
- Contains only resource files, used to manually update the resources in the Core package without downloading the full version again.

### Download via Quark Drive

Download link: [**Quark Drive**](https://pan.quark.cn/s/8c00dec47499)
:::note
The SRA version obtained this way may be outdated.
:::

## PyPI (Windows/Linux/MacOS)

SRA-cli is published on PyPI, providing a more convenient way to use it.

Prerequisites:

- Python 3.12

### Install with uv (recommended)

For headless Linux users:

```bash
uv tool install starrailassistant
```

For desktop Linux or Windows users:

```bash
uv tool install starrailassistant --extra full
```

### Install with pip

We recommend creating a dedicated virtual environment for SRA to avoid conflicts with other Python projects on your system.

Create a virtual environment (if you haven't already):

```bash
mkdir starrailassistant
cd starrailassistant
python -m venv .venv
```

Install SRA-cli:

```bash
(venv) pip install starrailassistant
```

### Install with pipx

```bash
pipx install starrailassistant
```

### First Use

We recommend creating a dedicated folder for SRA: `mkdir starrailassistant`

Run the initialization command:

```bash
cd starrailassistant
sra-cli init
```

This downloads the [WebUI](/en/server/webui/) so you can access the visual management interface. It also downloads the required core resources and creates the necessary configuration files.

Start SRA-server:

```bash
sra-cli serve
```

### Update the App

```bash
uv tool upgrade starrailassistant
```

```bash
(venv) pip install --upgrade starrailassistant
```

```bash
pipx upgrade starrailassistant
```

After updating, you may need to run the `init` command again to apply the new configuration.

## Docker Deployment

The SRA image is published to the GitHub Container Registry (public, no login required). It packages only **SRA-server**: the WebUI, HTTP API, and MCP;
the WebUI, tasks, extensions, image resources, and Chromium are all bundled.

```bash
docker run -d --name sra-server -p 5073:5073 \
  -e SRA_ACCESS_TOKEN=<你的令牌> \
  -v sra-data:/root/.config/SRA \
  -v sra-log:/app/log \
  ghcr.io/shasnow/starrailassistant:latest
```

Open `http://localhost:5073` in your browser and enter the token to use it.

:::warning
Only cloud game works inside the container, and you need cloud game hours or a Play Pass.
Cloud game settings are written automatically on first launch; complete the account/password or QR login once in the WebUI configuration.
:::

:::note
The image offers two mutable tags: `latest` (newest stable) and `beta` (newest test build).
:::

For complete deployment instructions (Compose usage, image tags, environment variables, data and volumes, image updates, and notes on exposing the service publicly), see
[Deploy SRA-server with Docker](/en/guides/docker/).
