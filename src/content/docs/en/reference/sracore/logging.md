---
title: Logging
description: SRA's logging system, output locations, and debugging methods
sidebar:
  order: 8
---

SRA uses [loguru](https://github.com/Delgan/loguru) to record logs uniformly; all diagnostics go through the same set of sinks to the terminal
and to files, and can be mirrored to the server's log stream. Troubleshooting tasks and extensions depends on these logs, so code should not use `print`.

This page covers log initialization, output locations, level configuration, the log stream interface, and common debugging combinations.

## Initialization

Logging is configured uniformly by `setup_logger()` in `SRACore/util/logger.py`:

```python
def setup_logger(
    path: str = "log/SRA{time:YYYYMMDD}.log",
    level: str = "TRACE",
    queue: Any = None,
) -> None:
```

What it does:

1. `logger.remove()` removes all registered sinks;
2. Registers a stderr sink (visible in an interactive terminal, colored when a TTY is detected);
3. Registers a file sink that writes files such as `log/SRA20261120.log` per day, UTF-8 encoded, keeping the most recent 7 files;
4. If `queue` is passed, registers an additional sink that writes every log entry into that queue via `queue.put`;
5. Creates the `log/ocr` and `log/screenshot` directories.

All sinks default to `enqueue=True`, so writing logs from multiple threads is safe.

:::caution
`setup_logger()` clears **all** sinks. `AppContext` calls it at startup,
so sinks registered earlier by extensions or tests become invalid; if you need yours to persist, register it afterwards and clean up with `logger.remove(id)` yourself.
:::

## Output locations

| Location | Contents | Notes |
| --- | --- | --- |
| Terminal (stderr) | The same log lines as the file | Visible directly in the interactive CLI |
| `log/SRA<date>.log` | All logs | Named per day, keeping the most recent 7 files |
| `log/screenshot/` | Task failure screenshots | Saved by `on_failed` as `<task name>_lastfailed.png` |
| `log/ocr/` | OCR annotation images, rectangle detection debug images | Requires developer mode or `trace=True` |
| Server log stream | Latest 500 entries + live push | See [Log stream](#log-stream) |

The log directory comes from `SRACore/util/const.py`:

```python
LogsDir = Path("log").absolute()          # relative to the current working directory
LogsOCRDir = LogsDir / "ocr"
LogsScreenshotDir = LogsDir / "screenshot"
```

So when run from the repository root, logs are written to the repository's `log/` (already in `.gitignore`);
when run from another directory, they are written to `log/` under that directory.

## Format and levels

The output format is fixed:

```text
15:33:07 | INFO  | 执行任务：领取邮件
```

That is "time | level (width 5) | message"; the file sink has no color, and markers such as `<green>` are stripped automatically by loguru.

loguru's levels, from low to high, are: `TRACE`, `DEBUG`, `INFO`, `SUCCESS`, `WARNING`, `ERROR`, `CRITICAL`.
Higher levels produce less output.

How to configure it:

| Scenario | Method | Default |
| --- | --- | --- |
| CLI | `python main.py --log-level DEBUG` | `TRACE` |
| Server | Environment variable `SRA_LOG_LEVEL` or `log_level` in `server.toml` | `DEBUG` |
| Code | `AppContext(log_level="INFO", log_format=...)` | `INFO` |

:::tip
The CLI defaults to `TRACE`, which emits a lot of recognition detail; for everyday use switch to `INFO`
and go back to `TRACE` only when reproducing an issue. The server defaults to `DEBUG`, adjustable via `SRA_LOG_LEVEL`.
:::

## Using it in code

Import from the single entry point; do not use the standard library `logging` or `print`:

```python
from SRACore.util.logger import logger

logger.info("执行任务：领取邮件")
logger.debug(f"OCR 结果: {boxes}")
logger.trace(f"ImageNotFound: {template}")
```

Conventions for levels:

| Level | Purpose |
| --- | --- |
| `TRACE` | High-frequency details such as per-call image recognition/OCR results and the reason for a miss |
| `DEBUG` | Flow branches, parameters, retry counts |
| `INFO` | User-facing progress and results, such as "任务完成：xxx" |
| `WARNING` | Anomalies that do not prevent continuing, such as suspicious config values or fallback after a failed fetch |
| `ERROR` | Task failures, abnormal page states, and the like |

When logging an expected failure, the repository convention is to pass `SRAError` as the message so the error code and context come along:

```python
from SRACore.util.errors import ErrorCode, SRAError

logger.error(SRAError(ErrorCode.WAIT_TIMEOUT, "等待主界面超时"))
```

## Log stream

When the server is running, `AppContext(with_log_stream=True)` also writes logs to `LogStreamService`:

- A ring buffer keeps the latest **500** log entries;
- Multiple subscribers are supported, and the sink can be called from any thread (dispatched internally through the event loop);
- Corresponding HTTP endpoints:

```text
GET /api/backend/logs?count=100      # fetch the latest N entries
GET /api/backend/logs/stream         # SSE live log stream
```

The WebUI log page is rendered from these two endpoints and does not rely on the subprocess's stdout/stderr.

## Common debugging combinations

| Goal | Combination |
| --- | --- |
| Observe the recognition process | `--log-level TRACE` |
| Inspect OCR boxes | Developer mode + `developerMode.saveOcrImage`; check `log/ocr/<timestamp>.png` |
| Inspect rectangle detection | `rectangle_detect(..., trace=True)`; check `log/ocr/rectangle_detect_<timestamp>.png` |
| See where a task failed | After a failure, check `log/screenshot/<task name>_lastfailed.png` and the corresponding log |

When a task fails, `BaseTask.on_failed` also automatically checks likely causes (resolution not 1920×1080, abnormal template-match confidence)
and logs them as `WARNING`; look at those lines first when troubleshooting.

## Caveats

- **The working directory determines where logs go**: `LogsDir` is a relative path, so always run from the repository root; otherwise `tasks/` and `resources/` will not be found either;
- **High-frequency logging has a cost**: `ocr()` with `trace=True` prints the full recognition result; turn it off in loops or use a higher threshold;
- **Do not rely on early sinks**: `setup_logger` resets sinks; if an extension needs its own file, call `logger.add` yourself and `logger.remove(id)` when done;
- **Sensitive information**: logs contain account names, paths, and more; redact them before filing an issue.
