---
title: MCP Tools
description: Let AI clients control SRA through the MCP protocol
sidebar:
  order: 4
---

SRA-server ships a built-in Model Context Protocol (MCP) server, so AI clients (Claude Desktop, Cursor, etc.)
can call SRA's tools directly: screenshots, OCR, task control, game operations, and config/settings changes.

MCP uses **Streamable HTTP**, at the endpoint:

```text
http://localhost:5073/mcp
```

:::note
- Requires the `[server]` dependencies and starting via `sra serve` / `sra-server` / `python -m SRAServer`;
- MCP lives outside `/api` and is **not protected by the access token**;
- In visitor mode (`SRA_VISITOR_MODE=true`), `/mcp` is not mounted.
:::

## Connection config

Add this in a client that supports remote MCP:

```json
{
  "mcpServers": {
    "sra": {
      "url": "http://localhost:5073/mcp"
    }
  }
}
```

Start the server before connecting, and make sure the game window is ready (local mode requires a 1920×1080 client
area).

## Tool overview

### Screenshots and session

| Tool | Parameters | Description |
| --- | --- | --- |
| `sra_screenshot` | none | Returns a 720p JPEG frame and notes that coordinates must be converted from 720p to 1080p |
| `sra_startup` | none | Starts the backend; idempotent in in-process mode |
| `sra_shutdown` | none | Requests stopping the current task/extension (no child process to end in-process) |
| `sra_restart` | none | Reinitializes the SRA core in-process (reloads tasks, extensions, and settings) |

### Tasks

| Tool | Parameters | Description |
| --- | --- | --- |
| `sra_task_list` | none | Lists registered tasks (name, order, class name, description) |
| `sra_task_run` | `configNames` (space-separated, optional) | Runs tasks from the given configs; leave empty to run all |
| `sra_task_single` | `task`, `configName` (optional) | Runs a single task; `task` accepts a name or an index |
| `sra_task_stop` | none | Stops the current task; returns a failure notice when idle |
| `sra_task_status` | none | Returns task status JSON (with `success`, `message`, `data`) |

### Operator and game operations

| Tool | Parameters | Description |
| --- | --- | --- |
| `sra_ocr` | `fromX`, `fromY`, `toX`, `toY` (all optional) | OCR recognition returning all text; coordinates are in 1080p pixels |
| `sra_ocr_match` | `text`, region coordinates (optional) | OCR matching returning the matched text |
| `sra_click_point` | `mode` (`abs` / `rel`), `x`, `y` | Click a coordinate; `abs` is resolution pixels, `rel` is a 0–1 ratio |
| `sra_scroll` | `clicks`, `x`, `y` (optional) | Wheel scrolling; positive scrolls up, negative scrolls down |
| `sra_press_key` | `key` | Presses a key; combinations such as `ctrl+c` are supported |
| `sra_hold_key` | `key`, `duration` (default 1.0) | Holds a key for the given number of seconds |
| `sra_sleep` | `seconds` | Waits the given number of seconds (the server waits without blocking other requests) |
| `sra_operator_list` | none | Lists all Operator methods |
| `sra_operator_help` | `method` | Shows a method's signature, parameter types, and docs |
| `sra_operator_call` | `method`, `parameters` (JSON string) | Calls any Operator method |

`sra_operator_call`'s `parameters` is a **JSON object string**, for example:

```json
{
  "method": "click_point",
  "parameters": "{\"mode\": \"rel\", \"x\": 0.5, \"y\": 0.5}"
}
```

When you are unsure about parameters, call `sra_operator_list` and `sra_operator_help` first instead of guessing.

### Logs

| Tool | Parameters | Description |
| --- | --- | --- |
| `sra_get_logs` | `count` (default 100) | Returns the most recent log lines as text |

### Configs

| Tool | Parameters | Description |
| --- | --- | --- |
| `sra_config_list` | none | Returns the list of config names and the current config |
| `sra_config_get` | `configName` | Reads a config; username/password are masked |
| `sra_config_create` | `configName` | Registers a new config name (the file is written only on the first update) |
| `sra_config_update` | `configName`, `patchJson` | Patches with partial JSON, modifying only the given fields |
| `sra_config_delete` | `configName` | Removes the config registration; the config file on disk is kept |

The top-level keys of `patchJson` are config sections, and the inner keys are dotted field names:

```json
{
  "cosmicStrife": {
    "currencyWars.runtimes": 3,
    "currencyWars.pointRewards": true
  }
}
```

`startGame.username` / `startGame.password` accept plaintext; the server encrypts and stores them. Fields you do not
provide stay unchanged.

### Settings

| Tool | Parameters | Description |
| --- | --- | --- |
| `sra_settings_get` | none | Reads app settings (dotted keys, e.g. `developerMode.customBackend.enabled`) |
| `sra_settings_update` | `patchJson` | Patches with partial JSON, modifying only the given fields |

```json
{
  "advanced": {
    "developerMode.customBackend.enabled": true
  }
}
```

## Recommended workflow

```text
截图 → 分析画面 → OCR 确认界面 → 点击/按键 → 再截图验证
```

1. Get the frame with `sra_screenshot` (remember it is 720p, so convert to 1080p before clicking);
2. Use `sra_ocr` / `sra_ocr_match` when precise identification is needed;
3. Operate with `sra_click_point` / `sra_press_key` / `sra_hold_key`;
4. Confirm the result with `sra_task_status` and `sra_get_logs`.

:::caution
MCP tools really operate the game and SRA state. Do not let a model freely call config-modifying and task-control
tools without supervision; when deploying publicly, always block `/mcp` at the reverse proxy.
:::
