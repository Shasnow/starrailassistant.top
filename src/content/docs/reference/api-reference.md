---
title: SRA Server API
description: SRA 服务端 REST API 的端点、请求体与响应格式
sidebar:
  order: 1
---

SRA-server 基于 Litestar，所有业务端点以 `/api` 为前缀（路径均为**小写**）。
交互式文档：

| 文档 | 地址 |
| --- | --- |
| Swagger UI | `http://localhost:5073/openapi/swagger` |
| ReDoc | `http://localhost:5073/openapi/redoc` |
| OpenAPI JSON | `http://localhost:5073/openapi/openapi.json` |
| 合并模型后的规范（WebUI 用） | `http://localhost:5073/openapi/v1.json` |

## 通用约定

### 响应信封

除图片、SSE 与 404 外，所有端点返回统一结构：

```json
{
  "success": true,
  "message": "success",
  "data": {}
}
```

- `message` 固定为**英文**，不随界面语言变化；
- 业务失败通常仍是 HTTP 200，仅 `success=false`（如停止空闲任务）；
- 参数错误、冲突、未找到使用 400 / 404 / 409；
- 启用访问令牌后，`/api/**` 需携带 `X-Access-Token` 头或 `access_token` 查询参数，
  详见[认证与安全](/server/authentication)。

### 路径与 404

未注册的 `/api/*` 路径返回 `text/plain` 的 `Not Found`（HTTP 404），而不是 JSON 信封，
避免 SPA 回退把接口拼写错误伪装成 200 页面。

## 认证

### `POST /api/auth`

校验访问令牌，无需认证。

```json
{ "token": "change-me" }
```

| 场景 | HTTP | 响应 |
| --- | --- | --- |
| 匹配 | 200 | `{"success": true, "message": "authorized", "data": null}` |
| 不匹配 | 401 | `{"success": false, "message": "unauthorized", "data": null}` |
| 未配置令牌 | 200 | `{"success": true, "message": "No access token configured", "data": null}` |

## 任务

### `GET /api/task/status`

返回任务运行状态。空闲时也返回 `success=true`。

```json
{
  "success": true,
  "message": "Task status",
  "data": {
    "session_id": "8f2c…",
    "pid": 12345,
    "mode": "run",
    "status": "running",
    "configs": ["Default"],
    "unit": "领取奖励",
    "error": "",
    "progress": [2, 5]
  }
}
```

| 字段 | 说明 |
| --- | --- |
| `mode` | `unknown`（空闲）、`run`（多配置）、`single`（单任务） |
| `status` | `idle` / `running` / `completed` / `failed` / `stopped` |
| `configs` | 本次运行的配置名列表 |
| `unit` | 当前执行单元（任务名等） |
| `error` | 失败原因，无错误时为空串 |
| `progress` | `[当前, 总数]` |

### `POST /api/task/run`

运行配置中的任务。三种用法：

```json
{ "configName": "Default" }
```

```json
{ "config": { "name": "MyConfig", "...": "..." }, "persist": true }
```

```json
{ "config": { "...": "..." }, "persist": false }
```

- `configName` 指定已有配置；不存在返回 400；
- `config` + `persist=true` 会先把配置写入 `configs/<name>.json` 再运行；
- `config` + `persist=false` 生成 `_api_<随机串>` 临时配置，运行前后会清理遗留临时文件；
- 空配置名与空列表等价于运行当前全部配置。

| HTTP | 场景 | 响应 `message` |
| --- | --- | --- |
| 200 | 已启动 | `Task started` |
| 200 | 启动失败 | `Failed to send task command to backend.` |
| 400 | 配置不存在 | `Config 'X' not found` |
| 409 | 已有任务在运行 | `A task is already running` |

:::note
访客模式下直接返回 `Task started`，但不会真正运行。
:::

### `POST /api/task/single`

运行单个任务。

```json
{ "taskName": "ReceiveRewardsTask", "configName": "Default" }
```

- `taskName`：任务 ID（注册名，默认等于类名）、类名（大小写不敏感）或任务列表下标（如 `"2"`）；
- `configName`：可选，缺省使用缓存中的当前配置。

| HTTP | 场景 |
| --- | --- |
| 200 | 已启动 / 启动失败（`success` 区分） |
| 409 | 已有任务在运行 |

### `POST /api/task/stop`

请求停止当前任务与扩展，无请求体。

- 运行中：`success=true`，`message="Stop signal sent"`；
- 空闲：HTTP 200，`success=false`，`message="No task is running"`。

## 后端

### `POST /api/backend/restart`

进程内重新初始化 SRA 核心：停止当前工作、重载任务与扩展、重读设置。

```json
{ "arguments": "--inline --no-admin" }
```

`arguments` 仅为兼容旧客户端保留，进程内模式下会被忽略。失败返回 500。

### `POST /api/backend/stop`

请求停止当前工作；若服务由 `run_server` 启动，还会触发 uvicorn 优雅退出
（响应可能先于进程退出返回）。

### `GET /api/backend/logs?count=100`

返回最近 `count` 条日志（默认 100）：

```json
{ "success": true, "message": "success", "data": ["15:00:00 | INFO | …"] }
```

### `GET /api/backend/logs/stream`

SSE 实时日志流，`text/event-stream`：

```text
: Connected

data: 15:00:00 | INFO | 正在初始化...

data: 15:00:01 | INFO | 就绪
```

断开后重连可恢复后续日志；历史日志量由服务端环形缓冲（500 条）决定。
启用令牌时使用 `?access_token=` 传递。

### `GET /api/backend/screenshot`

返回当前游戏画面的 **720p JPEG**（`image/jpeg`）。失败时返回 JSON 信封：

```json
{ "success": false, "message": "Failed to get screenshot from backend: …" }
```

访客模式返回空 JPEG，不暴露画面。

## 配置

### `GET /api/configs`

返回配置名列表：

```json
{ "success": true, "message": "success", "data": ["Default", "PlanB"] }
```

### `GET /api/configs/{name}`

返回完整配置（键为分区 + 点号字段名）。

:::warning[账号与密码]
`startGame.username` / `startGame.password` 不会以明文返回：

- 配置了访问令牌时，返回用该令牌加密后的字符串；
- 未配置令牌时，两者为空串。

写入时同样按此约定解读（见下方 `PUT`）。
:::

配置不存在返回 404，`message="not found"`。

### `POST /api/configs/{name}`

注册新配置名（首次 `PUT` 时才写文件）。名称不能包含 `\ / : * ? " < > |`。

| HTTP | 场景 | `message` |
| --- | --- | --- |
| 200 | 成功 | `success` |
| 400 | 名称含非法字符 | `Config name contains invalid characters` |
| 409 | 已存在 | `Config name already exists` |

### `PUT /api/configs/{name}`

用完整 `TasksConfig` 对象覆盖配置：

- 请求体中的账号/密码按「访问令牌加密」解读，未配置令牌时视为明文；
- 未提供 `startGame.username` / `password` 时保留磁盘上的原值；
- 结构非法（Pydantic 校验失败）不会写盘，返回 400 `Invalid config payload`；
- 不存在返回 404。

### `DELETE /api/configs/{name}`

删除配置名注册信息；成功 `message="deleted"`，不存在 404。
磁盘上的 `configs/<name>.json` **不会**被删除，需要彻底清除时请手动处理。

## 设置

### `GET /api/settings`

返回完整设置（分区 + 点号键）：

```json
{
  "success": true,
  "message": "Settings retrieved",
  "data": {
    "general": { "gamePath": "", "keybindings.f4": "F4" },
    "advanced": { "backend.remote.enabled": false },
    "…": {}
  }
}
```

设置分区：`general`、`display`、`update`、`advanced`、`notification`。

### `PUT /api/settings`

按「分区 + 点号字段」部分更新，只接受已存在的字段：

```json
{
  "advanced": {
    "developerMode.customBackend.enabled": true
  }
}
```

- 成功：`message="Settings updated"`，`data` 为被更新的字段名列表；
- 全部字段非法或被跳过：400 `No valid settings were updated`；
- 部分非法：200，非法项被忽略并记录警告。

## 扩展

### `GET /api/extensions`

```json
{
  "success": true,
  "message": "OK",
  "data": [
    {
      "id": "auto_player",
      "name": "自动演奏",
      "description": "…",
      "extension_class": "AutoPlayerExtension",
      "config_class": "AutoPlayerConfig",
      "executable": true,
      "enabled": true,
      "readme": "# …"
    }
  ]
}
```

### `GET /api/extensions/{id}/schema`

返回该扩展的配置 JSON Schema（字段说明已按服务端语言合成单语文本）。
扩展不存在或无配置模型时 `success=false`（HTTP 200）。

### `GET /api/extensions/{id}/config`

返回扩展配置，`data` 是 **JSON 字符串**（需客户端二次解析）：

```json
{ "success": true, "message": "OK", "data": "{\"volume\": 80}" }
```

### `PUT /api/extensions/{id}/config`

请求体可以是 JSON 对象，也可以是 JSON 字符串（服务端会解析）：

```json
{ "volume": 80 }
```

成功 `message="Config updated"`；无法解析返回 400；校验失败返回 `success=false`。

### `POST /api/extensions/{id}/run?config=<配置名>`

运行扩展。`config` 为可选查询参数；失败返回 `success=false`。

### `POST /api/extensions/{id}/stop`

停止扩展，失败返回 `success=false`。

### `POST /api/extensions/reload`

重新扫描并导入 `extensions/` 下的扩展包，失败返回 `success=false`。

:::note
访客模式下以上写操作全部返回成功但不执行，`/api/backend/screenshot` 返回空图。
:::

## Operator

### `GET /api/operator/list`

返回可调用的 Operator 方法名列表：

```json
{ "success": true, "message": "Operator methods", "data": ["click_point", "press_key", "screenshot"] }
```

### `GET /api/operator/help/{method}`

返回方法签名与文档，不存在时 `success=false`：

```json
{
  "success": true,
  "message": "click_point",
  "data": {
    "method": "click_point",
    "summary": "……",
    "parameters": [
      { "name": "x", "type": "int | float" },
      { "name": "y", "type": "int | float" },
      { "name": "after_sleep", "default": 0, "type": "float" }
    ],
    "doc": "……"
  }
}
```

### `POST /api/operator/call`

调用任意 Operator 方法：

```json
{
  "method": "click_point",
  "params": { "mode": "rel", "x": 0.5, "y": 0.5 }
}
```

- `method` 为空返回 400 `method is required`；
- `params` 非对象时按空对象处理；
- 调用失败返回 HTTP 200 + `success=false`，原因写入日志；
- 返回值中的非 JSON 类型会被序列化为字符串（例如图片路径）。

## 应用信息

| 端点 | 返回 |
| --- | --- |
| `GET /api/app/system-info` | `version`、`osVersion`、`architecture`、`dotnetVersion`（值为 `Python x.y.z`）、`processorCount`、`cultureInfo` |
| `GET /api/app/phrases` | `{ "zh-CN": [...], "en-US": [...], "ru-RU": [...] }` 首页短语 |
| `GET /api/app/background` | 背景图 `image/jpeg`（匿名可达，供登录页使用） |

`dotnetVersion` 字段名沿用旧 WebUI 的约定，实际内容是 Python 版本，不要据此判断运行时。
