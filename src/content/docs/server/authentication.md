---
title: 认证与安全
sidebar:
  order: 3
---

SRA-server 提供基于 Token 的 API 认证机制，默认不启用。

## 启用认证

编辑 SRA-server 目录下的 `appsettings.json` 文件，设置 `AccessToken` 字段：

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "AccessToken": "your-secret-token-here"
}
```

设置 `AccessToken` 后，所有 API 请求（除认证验证端点外）都需要携带该 Token。

:::warning
`AccessToken` 留空或不设置时，认证功能不会启用，所有 API 无需认证即可访问。
:::

## 携带 Token

Token 支持两种传递方式（优先级从高到低）：

### 方式一：HTTP 请求头（推荐）

```
X-Access-Token: your-secret-token-here
```

示例：

```bash
curl -H "X-Access-Token: your-secret-token-here" \
  http://localhost:5000/api/Task/status
```

### 方式二：URL 查询参数（SSE 仅支持）

```
?access_token=your-secret-token-here
```

示例：

```bash
curl "http://localhost:5000/api/backend/logs/stream?access_token=your-secret-token-here"
```

:::tip
推荐使用请求头方式传递 Token，避免 Token 出现在 URL 日志中。
:::

## 认证验证端点

`POST /api/Auth` 端点无需认证，可用于验证 Token 是否有效：

```bash
curl -X POST http://localhost:5000/api/Auth \
  -H "Content-Type: application/json" \
  -d '{"token": "your-secret-token-here"}'
```

**响应：**

| 场景 | 响应 |
|------|------|
| Token 匹配 | `{"success": true, "message": "authorized"}` |
| Token 不匹配 | `{"success": false, "message": "unauthorized"}`（HTTP 401） |
| 未配置 Token | `{"success": true, "message": "No access token configured"}` |

## MCP 端点

MCP 端点（`/mcp`）独立于 REST API 认证体系，不使用 Token 认证。

## 远程后端认证

当使用远程后端模式时，本地桌面端通过 HTTP 连接远程 SRA-server。此时需要在桌面端的设置中配置远程服务器的 URL 和 Token：

```json
{
  "advanced": {
    "backend": {
      "remote": {
        "enabled": true,
        "url": "http://192.168.1.100:5000",
        "accessToken": "your-secret-token-here"
      }
    }
  }
}
```

## 安全建议

:::caution
当 SRA-server 暴露在公网或不受信任的网络中时，**务必启用认证**。未启用认证的 API 可以：
- 控制您的 SRA 运行任务
- 读取和修改任务配置
- 重启后端进程
- 获取游戏截图和 OCR 数据
- 调用游戏内操作（点击、按键等）
:::
