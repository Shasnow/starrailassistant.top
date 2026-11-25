---
title: Helper methods
description: Generic control utilities such as Waitable, wait_any, and do_while
sidebar:
  order: 12
---

Besides recognition and input, `IOperator` also provides several helper utilities unrelated to any specific operation:
`Waitable` describes "a waitable condition", `wait_any` waits for several conditions at the same time, and `do_while` "executes first, then repeats according to a condition".

This page covers their type definitions, evaluation rules, and typical usage.

## Waitable

```python
type Waitable = Callable[[], Box | None | tuple[int, Box | None]]
```

`Waitable` is a callable that takes no arguments and returns one of two shapes:

| Return shape | Meaning |
| --- | --- |
| `Box` | Condition met; the result is that region |
| `None` | Condition not met |
| `(index, box)` | Batched result with an index; `index != -1` means met, `-1` means not met |

The second shape corresponds to the return value of "batch recognition" methods such as `locate_any`, `ocr_match_any`, and `wait_any_img`,
so they can be used directly as a `Waitable`.

## wait_any

```python
@staticmethod
def wait_any(
    conditions: list[Waitable],
    timeout: int = 10,
    interval: float = 0.5,
) -> tuple[int, Box | None | tuple[int, Box | None]]
```

It polls until the timeout and returns the index of the **first condition that is met** along with its return value; if all of them time out, it returns `(-1, None)`.

Evaluation rules (conditions are called in list order each round):

- Returns `Box`: met if it is not `None`;
- Returns `None`: not met; check the next condition;
- Returns a tuple: met if `result[0] != -1`; otherwise check the next one.

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

### Mixed batch conditions

Conditions may return tuples, in which case `wait_any` returns the whole tuple as-is and you unpack it according to the corresponding method:

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
`wait_any` is a generic combinator; if you are waiting for only one kind of target, `wait_img` / `wait_any_img` /
`wait_ocr` / `wait_ocr_any` are more concise.
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

Executes `action` once, then enters a loop of "wait `interval` → check `condition`", continuing as long as the condition is true and `max_iterations` has not been reached.

| Return value | Meaning |
| --- | --- |
| `True` | Exited because `condition` no longer holds |
| `False` | Reached `max_iterations` without exiting (can be treated as a timeout) |

Parameters:

| Parameter | Default | Description |
| --- | --- | --- |
| `action` | — | The operation to run each round; its return value is ignored |
| `condition` | — | Returning `True` means keep looping |
| `interval` | `0.5` | Fixed wait between rounds (also applied after the first execution) |
| `max_iterations` | `50` | Maximum number of loop iterations, preventing an infinite loop when the condition is always true |

### Retry until the screen changes

```python
operator.do_while(
    lambda: operator.press_key("b"),          # keep trying to open the inventory
    lambda: operator.wait_ocr(
        "背包", from_x=0.05, from_y=0.03, to_x=0.1, to_y=0.08,
        timeout=5, interval=0.5,
    ) is None,                                 # still not recognized, so continue
    interval=1,
    max_iterations=5,
)
```

### Using a count instead of a timeout

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

Note that returning `False` here means "the limit was reached", not an error; semantically it is equivalent to a timeout.

## Other helpers

| Method | Description |
| --- | --- |
| `sleep(seconds)` | Static method wrapping `time.sleep`; bound to the instance so it can be replaced and tested uniformly |
| `do_while` / `wait_any` | Both are static methods and can be called through an instance or the class |

## Caveats

- **No stop-signal checks**: `wait_any` and `do_while` do not read `stop_event` themselves;
  stopping relies on methods inside the conditions, such as `locate` / `ocr` / `press_key`, raising `ThreadStoppedError`.
  If `action` is a custom function not subject to the stop signal, you need to check it yourself;
- **Exceptions propagate**: exceptions raised by `condition` or `action` are not swallowed; the caller must handle them;
- **`interval` is not an exact period**: it is only a fixed sleep between rounds; the actual period also includes the time taken by the condition itself;
- **`max_iterations` must be at least 1**: passing `0` returns `False` immediately due to `0 == 0`, even if the condition was never true to begin with;
- **`wait_any` calls each condition only once per round**: do not put very time-consuming work in them, or the overall polling interval will grow.
