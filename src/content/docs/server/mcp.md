---
title: MCP 工具
description: 通过 MCP 协议让 AI 客户端控制 SRA
sidebar:
  order: 4
---

SRA-server 内置 Model Context Protocol（MCP）服务，AI 客户端（Claude Desktop、Cursor 等）
可以直接调用 SRA 的工具：截图、OCR、任务控制、游戏操作、配置与设置修改。

MCP 使用 **Streamable HTTP**，端点：

```text
http://localhost:5073/mcp
```

:::note
- 需要安装 `[server]` 依赖并以 `sra serve` / `sra-server` / `python -m SRAServer` 启动；
- MCP 位于 `/api` 之外，**不受访问令牌保护**；
- 访客模式（`SRA_VISITOR_MODE=true`）下不挂载 `/mcp`。
:::

## 连接配置

在支持远程 MCP 的客户端中添加：

```json
{
  "mcpServers": {
    "sra": {
      "url": "http://localhost:5073/mcp"
    }
  }
}
```

连接前请先启动服务端，并确保游戏窗口已就绪（本地模式要求 1920×1080 客户区）。

## 工具一览

### 截图与会话

| 工具 | 参数 | 说明 |
| --- | --- | --- |
| `sra_screenshot` | 无 | 返回 720p JPEG 画面，并提示坐标需从 720p 换算到 1080p |
| `sra_startup` | 无 | 启动后端；进程内模式下为幂等操作 |
| `sra_shutdown` | 无 | 请求停止当前任务/扩展（进程内无子进程可结束） |
| `sra_restart` | 无 | 进程内重新初始化 SRA 核心（重载任务、扩展与设置） |

### 任务

| 工具 | 参数 | 说明 |
| --- | --- | --- |
| `sra_task_list` | 无 | 列出已注册任务（名称、顺序、类名、说明） |
| `sra_task_run` | `configNames`（空格分隔，可空） | 运行指定配置中的任务，留空运行全部 |
| `sra_task_single` | `task`、`configName`（可空） | 运行单个任务，`task` 支持名称或索引 |
| `sra_task_stop` | 无 | 停止当前任务，空闲时返回失败提示 |
| `sra_task_status` | 无 | 返回任务状态 JSON（含 `success`、`message`、`data`） |

### Operator 与游戏操作

| 工具 | 参数 | 说明 |
| --- | --- | --- |
| `sra_ocr` | `fromX`、`fromY`、`toX`、`toY`（均可空） | OCR 识别，返回全部文本；坐标单位为 1080p 像素 |
| `sra_ocr_match` | `text`、区域坐标（可空） | OCR 匹配，返回命中的文本 |
| `sra_click_point` | `mode`（`abs` / `rel`）、`x`、`y` | 点击坐标；`abs` 为分辨率像素，`rel` 为 0–1 比例 |
| `sra_scroll` | `clicks`、`x`、`y`（可空） | 滚轮滚动，正数向上、负数向下 |
| `sra_press_key` | `key` | 按键，支持 `ctrl+c` 这类组合 |
| `sra_hold_key` | `key`、`duration`（默认 1.0） | 长按指定秒数 |
| `sra_sleep` | `seconds` | 等待指定秒数（服务端等待，不阻塞其他请求） |
| `sra_operator_list` | 无 | 列出全部 Operator 方法 |
| `sra_operator_help` | `method` | 查看方法签名、参数类型与文档 |
| `sra_operator_call` | `method`、`parameters`（JSON 字符串） | 调用任意 Operator 方法 |

`sra_operator_call` 的 `parameters` 是一个 **JSON 对象字符串**，例如：

```json
{
  "method": "click_point",
  "parameters": "{\"mode\": \"rel\", \"x\": 0.5, \"y\": 0.5}"
}
```

不确定参数时，先调用 `sra_operator_list` 与 `sra_operator_help`，不必猜。

### 日志

| 工具 | 参数 | 说明 |
| --- | --- | --- |
| `sra_get_logs` | `count`（默认 100） | 返回最近若干条日志文本 |

### 配置

| 工具 | 参数 | 说明 |
| --- | --- | --- |
| `sra_config_list` | 无 | 返回配置名列表与当前配置 |
| `sra_config_get` | `configName` | 读取配置；用户名/密码会被掩码 |
| `sra_config_create` | `configName` | 注册新配置名（首次更新时才写文件） |
| `sra_config_update` | `configName`、`patchJson` | 用局部 JSON 打补丁，只修改给出的字段 |
| `sra_config_delete` | `configName` | 删除配置注册信息，磁盘上的配置文件保留 |

`patchJson` 的顶层键是配置分区，内层是带点号的字段键：

```json
{
  "cosmicStrife": {
    "currencyWars.runtimes": 3,
    "currencyWars.pointRewards": true
  }
}
```

`startGame.username` / `startGame.password` 接受明文，服务端加密后保存；未提供的字段保持不变。

### 设置

| 工具 | 参数 | 说明 |
| --- | --- | --- |
| `sra_settings_get` | 无 | 读取应用设置（点号键，如 `developerMode.customBackend.enabled`） |
| `sra_settings_update` | `patchJson` | 用局部 JSON 打补丁，只修改给出的字段 |

```json
{
  "advanced": {
    "developerMode.customBackend.enabled": true
  }
}
```

## 推荐工作流

```text
截图 → 分析画面 → OCR 确认界面 → 点击/按键 → 再截图验证
```

1. `sra_screenshot` 获取画面（记住是 720p，换算到 1080p 后再点击）；
2. 需要精确判断时用 `sra_ocr` / `sra_ocr_match`；
3. 用 `sra_click_point` / `sra_press_key` / `sra_hold_key` 操作；
4. 用 `sra_task_status`、`sra_get_logs` 确认执行情况。

:::caution
MCP 工具会真实操作游戏与 SRA 状态，请勿在没有监督的情况下让模型自由调用配置修改与任务控制类工具；
公开部署时务必通过反向代理屏蔽 `/mcp`。
:::
