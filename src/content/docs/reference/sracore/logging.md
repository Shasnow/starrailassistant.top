---
title: 日志
description: SRA 的日志系统、输出位置与调试方式
sidebar:
  order: 8
---

SRA 使用 [loguru](https://github.com/Delgan/loguru) 统一记录日志，所有诊断信息都经过同一套 sink 输出到终端、
文件，并可同步到服务端的日志流。任务与扩展的排查都依赖这些日志，因此代码中不应使用 `print`。

本文介绍日志的初始化、输出位置、级别配置、日志流接口与常见调试组合。

## 初始化

日志由 `SRACore/util/logger.py` 的 `setup_logger()` 统一配置：

```python
def setup_logger(
    path: str = "log/SRA{time:YYYYMMDD}.log",
    level: str = "TRACE",
    queue: Any = None,
) -> None:
```

它的行为：

1. `logger.remove()` 移除所有已注册的 sink；
2. 注册 stderr sink（交互式终端可见，检测到 TTY 时着色）；
3. 注册文件 sink，按天生成 `log/SRA20261120.log` 这类文件，UTF-8 编码，保留最近 7 个文件；
4. 若传入 `queue`，则额外注册一个 sink，把每条日志通过 `queue.put` 写入该队列；
5. 创建 `log/ocr` 与 `log/screenshot` 目录。

所有 sink 默认 `enqueue=True`，因此多线程写日志是安全的。

:::caution
`setup_logger()` 会清空**全部** sink。`AppContext` 在启动时会调用它，
因此扩展或测试在更早阶段注册的 sink 会失效；需要长期保留时请在其后注册，并自行 `logger.remove(id)` 清理。
:::

## 输出位置

| 位置 | 内容 | 说明 |
| --- | --- | --- |
| 终端（stderr） | 与文件相同的日志行 | 交互式 CLI 直接可见 |
| `log/SRA<日期>.log` | 全部日志 | 按天命名，保留最近 7 个文件 |
| `log/screenshot/` | 任务失败截图 | 由 `on_failed` 保存为 `<任务名>_lastfailed.png` |
| `log/ocr/` | OCR 标注图、矩形检测调试图 | 需开启开发者模式或传 `trace=True` |
| 服务端日志流 | 最近 500 条 + 实时推送 | 见[日志流](#日志流) |

日志目录来自 `SRACore/util/const.py`：

```python
LogsDir = Path("log").absolute()          # 相对于当前工作目录
LogsOCRDir = LogsDir / "ocr"
LogsScreenshotDir = LogsDir / "screenshot"
```

因此从仓库根目录运行时会写到仓库内的 `log/`（已在 `.gitignore` 中），
从其他目录运行时则写到该目录下的 `log/`。

## 格式与级别

输出格式固定为：

```text
15:33:07 | INFO  | 执行任务：领取邮件
```

即「时间 | 级别（宽 5） | 消息」，文件 sink 不着色，`<green>` 等标记会被 loguru 自动去除。

loguru 的级别从低到高为：`TRACE`、`DEBUG`、`INFO`、`SUCCESS`、`WARNING`、`ERROR`、`CRITICAL`。
级别越高，输出越少。

配置方式：

| 场景 | 方式 | 默认值 |
| --- | --- | --- |
| CLI | `python main.py --log-level DEBUG` | `TRACE` |
| 服务端 | 环境变量 `SRA_LOG_LEVEL` 或 `server.toml` 的 `log_level` | `DEBUG` |
| 代码 | `AppContext(log_level="INFO", log_format=...)` | `INFO` |

:::tip
CLI 默认 `TRACE`，会输出大量识别细节；日常使用可改为 `INFO`，
排查问题时再用 `TRACE` 复现。服务端默认 `DEBUG`，可通过 `SRA_LOG_LEVEL` 调整。
:::

## 在代码中使用

从统一入口导入，不要使用标准库 `logging` 或 `print`：

```python
from SRACore.util.logger import logger

logger.info("执行任务：领取邮件")
logger.debug(f"OCR 结果: {boxes}")
logger.trace(f"ImageNotFound: {template}")
```

级别使用约定：

| 级别 | 用途 |
| --- | --- |
| `TRACE` | 识图/OCR 的逐次结果、未命中原因等高频细节 |
| `DEBUG` | 流程分支、参数、重试次数 |
| `INFO` | 面向用户的进度与结果，如「任务完成：xxx」 |
| `WARNING` | 不影响继续执行的异常，如配置值可疑、拉取失败回退 |
| `ERROR` | 任务失败、页面状态异常等 |

记录可预期的失败时，仓库习惯把 `SRAError` 作为消息输出，便于同时带上错误码与上下文：

```python
from SRACore.util.errors import ErrorCode, SRAError

logger.error(SRAError(ErrorCode.WAIT_TIMEOUT, "等待主界面超时"))
```

## 日志流

服务端运行时，`AppContext(with_log_stream=True)` 会把日志额外写入 `LogStreamService`：

- 环形缓冲保存最近 **500** 条日志；
- 支持多订阅者，sink 可在任意线程调用（内部通过事件循环调度）；
- 对应 HTTP 接口：

```text
GET /api/backend/logs?count=100      # 获取最近 N 条
GET /api/backend/logs/stream         # SSE 实时日志流
```

WebUI 的日志页即通过这两个接口展示，不依赖子进程的 stdout/stderr。

## 常见调试组合

| 目的 | 组合 |
| --- | --- |
| 查看识别过程 | `--log-level TRACE` |
| 检查 OCR 识别框 | 开发者模式 + `developerMode.saveOcrImage`，查看 `log/ocr/<时间戳>.png` |
| 检查矩形检测 | `rectangle_detect(..., trace=True)`，查看 `log/ocr/rectangle_detect_<时间戳>.png` |
| 查看任务失败现场 | 失败后查看 `log/screenshot/<任务名>_lastfailed.png` 与对应日志 |

任务失败时 `BaseTask.on_failed` 还会自动检查可能的失败原因（分辨率不是 1920×1080、模板匹配置信度异常），
并以 `WARNING` 输出，排查时优先看这几行。

## 注意事项

- **工作目录决定日志位置**：`LogsDir` 是相对路径，务必从仓库根目录运行，否则 `tasks/` 与 `resources/` 也会找不到；
- **高频日志有成本**：`ocr()` 的 `trace=True` 会打印完整识别结果，循环中应关掉或使用更高阈值；
- **不要依赖早期 sink**：`setup_logger` 会重置 sink，扩展中需要独立文件时自行 `logger.add` 并在结束时 `logger.remove(id)`；
- **敏感信息**：日志会包含账号、路径等信息，提交 issue 前请先脱敏。
