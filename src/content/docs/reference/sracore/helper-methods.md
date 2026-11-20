---
title: 辅助方法
description: Waitable、wait_any 与 do_while 等通用控制工具
sidebar:
  order: 12
---

除了识别与输入，`IOperator` 还提供几个与具体操作无关的辅助工具：
`Waitable` 描述「可等待的条件」，`wait_any` 用于同时等待多种条件，`do_while` 用于「先执行、再按条件重复」。

本文介绍它们的类型定义、判定规则与典型用法。

## Waitable

```python
type Waitable = Callable[[], Box | None | tuple[int, Box | None]]
```

`Waitable` 是一个无参可调用对象，返回值有两种形态：

| 返回形态 | 含义 |
| --- | --- |
| `Box` | 条件满足，结果为该区域 |
| `None` | 条件未满足 |
| `(index, box)` | 带索引的批量结果；`index != -1` 表示满足，`-1` 表示未满足 |

第二种形态对应 `locate_any`、`ocr_match_any`、`wait_any_img` 这类「批量识别」方法的返回值，
因此它们可以直接作为 `Waitable` 使用。

## wait_any

```python
@staticmethod
def wait_any(
    conditions: list[Waitable],
    timeout: int = 10,
    interval: float = 0.5,
) -> tuple[int, Box | None | tuple[int, Box | None]]
```

在超时前轮询，返回**第一个满足的条件**的下标及其返回值；全部超时则返回 `(-1, None)`。

判定规则（每轮按列表顺序依次调用）：

- 返回 `Box`：非 `None` 即满足；
- 返回 `None`：未满足，继续检查下一个条件；
- 返回元组：`result[0] != -1` 视为满足，否则继续检查。

```python
index, result = operator.wait_any([
    lambda: operator.locate(IMG.ENTER),
    lambda: operator.ocr_match("开拓", from_x=0.656, from_y=0.222, to_x=0.740, to_y=0.278),
], timeout=20, interval=1)

match index:
    case 0:
        operator.press_key("esc")
    case 1:
        return True
    case _:
        logger.info("等待界面超时")
```

### 混合批量条件

条件可以返回元组，此时 `wait_any` 会把整个元组原样返回，需要按对应方法自行解包：

```python
index, result = operator.wait_any([
    lambda: operator.locate_any([IMG.ENTER, IMG.F2, RRIMG.NAMELESS_HONOR_START]),
    lambda: operator.ocr_match_any(["确认", "取消"]),
], timeout=20)

if index == 0:
    page_index, box = result
elif index == 1:
    text_index, box = result
```

:::tip
`wait_any` 是通用组合器；如果只等待一类目标，直接使用 `wait_img` / `wait_any_img` /
`wait_ocr` / `wait_ocr_any` 更简洁。
:::

## do_while

```python
@staticmethod
def do_while(
    action: Callable[[], Any],
    condition: Callable[[], bool],
    interval: float = 0.5,
    max_iterations: int = 50,
) -> bool
```

先执行一次 `action`，随后进入「等待 `interval` → 检查 `condition`」的循环，
条件为真且未达到 `max_iterations` 时继续执行。

| 返回值 | 含义 |
| --- | --- |
| `True` | 因 `condition` 不再成立而退出 |
| `False` | 达到 `max_iterations` 仍未退出（可视为超时） |

参数说明：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `action` | — | 每轮执行的操作，返回值被忽略 |
| `condition` | — | 返回 `True` 表示继续循环 |
| `interval` | `0.5` | 每轮之间的固定等待（第一次执行后也会等待） |
| `max_iterations` | `50` | 最大循环次数，避免条件永真时死循环 |

### 重试直到界面变化

```python
operator.do_while(
    lambda: operator.press_key("b"),          # 反复尝试打开背包
    lambda: operator.wait_ocr(
        "背包", from_x=0.05, from_y=0.03, to_x=0.1, to_y=0.08,
        timeout=5, interval=0.5,
    ) is None,                                 # 仍未识别到则继续
    interval=1,
    max_iterations=5,
)
```

### 用次数代替超时

```python
found = operator.do_while(
    lambda: operator.hold_key("w", 0.3, trace=False),
    lambda: not operator.locate(IMG.F, trace=False),
    interval=0.1,
    max_iterations=30,
)
if not found:
    logger.warning("前进超时，仍未出现交互提示")
```

注意这里返回 `False` 表示「达到上限」而不是出错，语义上等价于超时。

## 其他辅助

| 方法 | 说明 |
| --- | --- |
| `sleep(seconds)` | 静态方法，包装 `time.sleep`；与实例绑定便于统一替换与测试 |
| `do_while` / `wait_any` | 均为静态方法，可通过实例或类调用 |

## 注意事项

- **不检查停止信号**：`wait_any` 与 `do_while` 本身不读取 `stop_event`，
  停止依赖条件内部的 `locate` / `ocr` / `press_key` 等方法抛出 `ThreadStoppedError`。
  若 `action` 是不受停止信号约束的自定义函数，需要自行判断；
- **异常会向上传播**：`condition` 或 `action` 抛出的异常不会被吞掉，调用方需要处理；
- **`interval` 不是精确周期**：它只是每轮之间的固定睡眠，实际周期还要加上条件本身的耗时；
- **`max_iterations` 至少为 1**：传 `0` 会因 `0 == 0` 直接返回 `False`，即使条件本就不成立；
- **`wait_any` 每轮只调用一次每个条件**：不要在里面做耗时很长的操作，否则会拉长整体轮询间隔。
