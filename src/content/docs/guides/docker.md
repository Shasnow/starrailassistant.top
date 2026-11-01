---
title: 用 Docker 部署 SRA-server
description: 在 Linux 上用 Docker 部署 SRA-server（WebUI + HTTP API + MCP），含云游戏配置、数据持久化与镜像更新
sidebar:
  order: 3
---

容器镜像只打包 **SRA-server**：WebUI 静态托管、HTTP API 与 MCP。镜像里已经含 WebUI、任务、扩展与图片资源，
并预装了 Chromium。

:::warning[只能用云游戏]
本地模式依赖 `pyautogui` / `pywin32` 和真实的 1920×1080 游戏窗口，只能在 Windows 上运行。容器里唯一可用的
是**云游戏**：由容器内的 Chromium 访问云·星穹铁道。全局热键在容器里也不可用。
:::

## 前置条件

| 项目 | 要求 |
| --- | --- |
| Docker | 含 Compose v2（`docker compose` 子命令） |
| 网络 | 拉镜像时需要能访问 `ghcr.io`；镜像公开，无需登录 |
| 磁盘 | 拉取时下载约 570 MB；镜像约 1.5 GB；运行中的容器约 2.2 GB（镜像 + 可写层） |

## 快速开始

新建一个目录，把下面内容存为 `docker-compose.yml`：

```yaml
services:
  sra-server:
    image: ghcr.io/shasnow/starrailassistant:beta
    container_name: sra-server
    restart: unless-stopped
    ports:
      - "5073:5073"
    environment:
      # 访问令牌，留空则 /api 全部放行；公网部署务必填一个强随机串
      SRA_ACCESS_TOKEN: "change-me"
      SRA_HOST: "0.0.0.0"
      SRA_PORT: "5073"
      SRA_LOG_LEVEL: "INFO"
      TZ: "Asia/Shanghai"
    volumes:
      # 状态盘：settings.json、configs/、cache/（云游戏登录态在 cache/selenium_profile 下）
      - sra-data:/root/.config/SRA
      # 运行日志与失败截图
      - sra-log:/app/log

volumes:
  sra-data:
  sra-log:
```

然后启动：

```bash
docker compose up -d
```

浏览器打开 `http://localhost:5073`，在 WebUI 里填入上面设置的令牌即可。

不用 Compose 也可以直接跑（注意卷要自己挂上）：

```bash
docker run -d --name sra-server -p 5073:5073 \
  -e SRA_ACCESS_TOKEN=<你的令牌> \
  -v sra-data:/root/.config/SRA \
  -v sra-log:/app/log \
  ghcr.io/shasnow/starrailassistant:beta
```

:::tip
仓库根目录的 [docker-compose.yml](https://github.com/Shasnow/StarRailAssistant/blob/main/docker-compose.yml)
是等价版本，另外带了一段健康检查脚本。
:::

## 镜像标签

| 标签 | 含义 |
| --- | --- |
| `beta` | 最新的 beta 构建（版本号含 `-`） |
| `latest` | 最新的正式版构建 |
| `v<版本>` | 固定到某个版本，例如 `v2.25.0-beta.3` |
| `sha-<短哈希>` | 固定到某个提交的构建，例如 `sha-d907a24` |

`beta` / `latest` 是**可变标签**，会随着新构建移动；需要可预期的更新就钉版本：

```bash
# 固定版本
SRA_IMAGE_TAG=v2.25.0-beta.3 docker compose up -d

# 回滚到某个提交的构建
SRA_IMAGE_TAG=sha-d907a24 docker compose up -d
```

:::note
当前版本处于 beta 通道，所以只有 `beta` / `v<版本>` / `sha-<短哈希>` 可用，正式版发布后才会有 `latest`。
:::

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `SRA_HOST` | `0.0.0.0` | 监听地址，容器内不要改成 `127.0.0.1`，否则无法从宿主访问 |
| `SRA_PORT` | `5073` | 监听端口 |
| `SRA_ACCESS_TOKEN` | 空 | 访问令牌；为空时不鉴权 |
| `SRA_WEBUI` | `1` | 是否托管 WebUI 静态资源，`0` 则只提供 API |
| `SRA_VISITOR_MODE` | `false` | 访客模式：设置改为只读，且不挂载 `/mcp` |
| `SRA_LOG_LEVEL` | `DEBUG` | 日志级别 |

## 云游戏

容器内没有桌面会话，只能用云游戏。**首次启动时入口脚本会自动把这几项写进 `settings.json`**，不需要手动配置：

| 设置项 | 写入值 |
| --- | --- |
| 云游戏 | 开启 |
| 浏览器 | `Chrome for Testing` |
| 浏览器路径 | `/usr/local/bin/chromium-container` |
| 无头模式 | 开启 |

之所以是 `Chrome for Testing`：这个选项在代码里对应 `webdriver.Chrome` 分支，而实际启动的是容器内 Debian 的
Chromium；路径指向的包装脚本会补上 `--no-sandbox --disable-dev-shm-usage`（以 root 运行时 Chromium 的 setuid
沙箱不可用）。驱动是同源打包的 `chromium-driver`，版本天然匹配，**不会**在运行时联网下载。

:::caution[预置只生效一次]
入口脚本只在**没有** `settings.json` 时写入，绝不覆盖已有设置。如果你的数据盘里已经有 `settings.json`
（例如之前拉过更早的镜像），更新后不会自动补上这几项，需要手动在 WebUI 里设置一次，或者删掉设置文件让它重新生成：

```bash
docker compose down
docker compose run --rm --entrypoint sh sra-server -c 'rm -f /root/.config/SRA/settings.json'
docker compose up -d
```
:::

还需要手动做的只剩一件事：**在 WebUI 的配置里填云游戏账号密码**。凭据属于每个任务配置，无法预置进镜像，
也不该预置。

:::caution[不要直接拷 Windows 上的配置]
账号密码是加密存储的，而加密方式与平台绑定（Windows 用 DPAPI，其他平台只是 base64），把 Windows 上的
`configs/*.json` 拷进容器会**解不出密码**，表现为登录静默失败。在容器的 WebUI 里新建配置填一次即可。
:::

云游戏登录态保存在 `cache/selenium_profile` 下，也就是 `sra-data` 卷里，容器重建不会掉登录。

## 数据与卷

| 容器内路径 | 卷 | 内容 |
| --- | --- | --- |
| `/root/.config/SRA` | `sra-data` | `settings.json`、`configs/*.json`、`cache/`（含云游戏登录态） |
| `/app/log` | `sra-log` | 运行日志与失败截图 |

WebUI、`tasks/`、`extensions/`、`resources/` 都在**镜像里**（不在卷里），所以更新镜像就等于更新任务、扩展与图片资源。

:::note[三个体积数字别混]
拉取时下载的是**压缩层**（约 570 MB）；`docker images` 的 SIZE 是**解压后的各层之和**（约 1.5 GB）；Docker Desktop
界面上看到的容器体积是**镜像 + 容器可写层**（约 2.2 GB），可用 `docker ps -s` 核对——SIZE 是可写层，括号里的
virtual 才是镜像 + 可写层。
:::

## 更新镜像

```bash
docker compose pull          # 必须显式拉取
docker compose up -d         # 用新镜像重建容器，卷与数据保留
```

`docker compose up -d` 不会主动检查远端有没有新版本，本地已有同名镜像时它会直接用缓存，所以 `pull` 这步不能省。
Compose v2.22 及以上也可以用 `docker compose up -d --pull always` 一步到位。

想先看看远端有没有更新，可以比对摘要：

```bash
docker manifest inspect ghcr.io/shasnow/starrailassistant:beta
```

## 暴露到公网

:::warning[令牌只保护 `/api`]
鉴权中间件只覆盖 `/api` 及其子路径，`/mcp`、`/openapi/v1.json` 与静态资源**不受令牌保护**。如果要把容器暴露
到公网，请用反向代理（只放开需要的路径）或防火墙限制，不要直接把 5073 端口映射到公网。
:::

- 健康检查可以直接打 `/openapi/v1.json`（该路径不鉴权）。
- WebUI 需要令牌才能调用 API，首次访问时填入即可。

## 从源码构建

需要本仓库源码，Docker 会先构建 WebUI 再打进运行镜像：

```bash
docker build -t sra-server .
```

## 已知限制

- 本地自动化不可用（见文首说明），只能云游戏。
- 全局热键不可用：`pynput` 属于桌面端依赖，容器内未安装，仅记录一条警告。
- 必须无头运行，容器内没有显示器。
- 扩展可以正常加载；但 Windows 专属的物理按键注入只在本地模式生效，云游戏路径走的是浏览器操作。