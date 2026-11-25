---
title: Mouse operations
description: Click, move, drag, and scroll operations in SRA
sidebar:
  order: 9
---

Mouse operations in SRA are provided uniformly by `IOperator`, with identical interfaces for the local implementation (PyAutoGUI + Win32)
and the cloud gaming implementation (Selenium). Tasks and extensions only need to call them in window coordinates and do not need to care
about the details of the system cursor or the browser pointer.

This page covers each mouse method, the coordinate and offset rules, the differences between the two implementations, and common usage.

## Coordinate conventions

Mouse methods follow a uniform rule (see [Windows and window context](/en/reference/sracore/window-context/) for details):

| Notation | Meaning |
| --- | --- |
| `int` | Pixel coordinates within the window client area |
| `float` | Ratio relative to the window width/height (0–1) |

`x` and `y` **must both be `int` or both be `float`**; mixing them raises `ValueError`.
The offsets `x_offset` / `y_offset` are interpreted by type the same way: `int` is pixels, `float` is a window ratio, and you may pass a ratio for only one direction.

When coordinates come from JSON or config and you cannot tell `1` from `1.0`, force it with the `mode` parameter of `click_point`:

- `auto` (default): infer from the type;
- `abs`: force pixels;
- `rel`: force window ratio.

## Common methods

| Method | Returns | Description |
| --- | --- | --- |
| `click_point(x, y, ...)` | `bool` | Clicks the specified coordinates |
| `click_box(box, ...)` | `bool` | Clicks the center of a `Box` (optionally with an offset) |
| `click_img(template, ...)` | `bool` | Recognizes the template and clicks its center; can retry until it disappears |
| `move_to(x, y, duration=0)` | `bool` | Moves the mouse to the specified position |
| `move_rel(x_offset, y_offset)` | `bool` | Moves relative to the current position (in pixels) |
| `mouse_down(x, y, button="left")` | `bool` | Presses a mouse button |
| `mouse_up(x, y, button="left")` | `bool` | Releases a mouse button (`x` / `y` may be `None`) |
| `scroll(clicks, x=None, y=None)` | `bool` | Scrolls the wheel; positive scrolls up, negative scrolls down |
| `drag_to(from_x, from_y, to_x, to_y, duration=0.5)` | `bool` | Drags from the start point to the end point |

### click_point

```python
operator.click_point(0.5, 0.5)                  # click the window center
operator.click_point(960, 540)                  # click client-area pixel (960, 540)
operator.click_point(0.9, 0.1, after_sleep=1)   # wait 1 second after clicking
operator.click_point(0.5, 0.5, y_offset=-0.02)  # offset up by 2% of the window height
```

Parameters:

| Parameter | Default | Description |
| --- | --- | --- |
| `x_offset` / `y_offset` | `0` | Pixel or proportional offset |
| `after_sleep` | `0` | Seconds to wait after clicking, to let the UI respond |
| `tag` | `""` | Log tag to identify which click this was |
| `trace` | `True` | Whether to emit debug logs |
| `mode` | `"auto"` | `auto` / `abs` / `rel` |

### click_box and click_img

`click_box` takes `Box.center` and calls `click_point`, which suits results from image recognition:

```python
from tasks.img import IMG, RRIMG

box = operator.wait_img(IMG.ENTER, timeout=30)
if box is not None:
    operator.click_box(box, y_offset=-10)
```

`click_img` is a shortcut for "recognize + click"; `retry` is for cases where the UI lags after a click:
after each click it moves the mouse to the top-left corner of the window and detects again; once the template disappears, the click counts as effective.

```python
operator.click_img(RRIMG.DAILY_REWARD, retry=3, retry_interval=1)
```

- Returns `False` if the template is not found on the first attempt;
- Returns `True` if the template disappears after at least one click;
- `retry=0` means click only once.

### Movement

- `move_to`: absolute movement; `duration` controls the smooth-movement duration of the local implementation (the cloud gaming implementation ignores this parameter);
- `move_rel`: relative movement; the local implementation injects relative displacement through Win32 `SendInput`,
  which suits scenarios that need to "rotate the camera" (for example, turning by half a window width), because it does not depend on the window's absolute position.

```python
operator.move_rel(operator.window_context.width // 2, 0)  # turn half a screen to the right
```

### Press and release

`mouse_down` / `mouse_up` are for interactions that require a "long press", such as holding still before a drag or a charge-up action.
`button` supports `left` / `middle` / `right`; any other value returns `False` directly and is logged.

:::caution
The `x` / `y` of `mouse_up` exist only for interface consistency; both implementations **release at the current position** and do not move to the given coordinates.
If you need to "move to a point and then release", call `move_to` explicitly.
:::

### Dragging

`drag_to` performs `mouse_down(start)` → `move_to(end)` → `mouse_up()` in order; `duration` is the length of the movement:

```python
operator.drag_to(0.3, 0.5, 0.7, 0.5, duration=0.8)
```

### Scroll wheel

```python
operator.scroll(-5)   # scroll down 5 notches at the current position
operator.scroll(3)    # scroll up 3 notches at the current position
```

:::caution
The local implementation's `scroll` calls `pyautogui.scroll(clicks, x, y)` directly.
The `x` / `y` you pass are **absolute screen coordinates**, not window-relative coordinates, and the window offset is not added automatically.
When you need to scroll in a windowed or multi-monitor environment, it is best not to pass coordinates (using the current mouse position),
or to call `move_to` explicitly first and then `scroll`.
:::

## Differences between the two implementations

| Behavior | Local (`Operator`) | Cloud gaming (`BrowserOperator`) |
| --- | --- | --- |
| Underlying mechanism | PyAutoGUI / Win32 `SendInput` | Selenium ActionBuilder / ActionChains |
| System cursor | Actually moved | Only simulates the page pointer; the system cursor is unaffected |
| Time per click | Depends on `after_sleep` | An extra fixed wait of about 0.2 seconds |
| `duration` of `move_to` | Applied, smooth movement | Ignored |
| `x` / `y` of `scroll` | Absolute screen coordinates | Treated as window coordinates; `move_to` first, then scroll |
| Window not active | Clicks may land in another window | Not an issue |

:::tip
PyAutoGUI's corner protection (FAILSAFE) is disabled in SRA,
so moving the mouse to a screen corner will not trigger `FailSafeException`, but you also lose the "slam into a corner to stop" escape hatch.
To abort, use the stop hotkey (default `F9`) or `task stop`.
:::

## Practical advice

- **Leave time to wait after clicking**: prefer `after_sleep` over a bare `sleep` in the caller, which keeps the logs more coherent;
- **Prefer proportional coordinates**: this is the only way the same code works for both local and cloud gaming;
- **Avoid mixing coordinate types**: `int` and `float` come in pairs, and offsets use ratios only when needed;
- **Confirm the target appeared before clicking**: get a `Box` via `wait_img` / `wait_ocr` and then `click_box`,
  which is far more robust than hardcoded coordinates;
- **Use `move_rel` for camera rotation**: relative displacement does not depend on the window position and will not fling the cursor to the screen edge;
- **Mind the duration when dragging**: too short a `duration` may be interpreted as a click, while too long hurts efficiency; typically 0.5–1 second.

## Caveats

- **Stop signal**: all mouse methods raise `ThreadStoppedError` once `stop_event` is set and do not continue;
- **Failures return a boolean**: the local implementation catches exceptions and returns `False` while emitting debug logs;
  however, a parameter type error raises `ValueError` directly;
- **Minimized windows**: the local implementation cannot click on a minimized window, and recognition-style calls raise `RuntimeError` first;
- **`drag_to` does not verify intermediate results**: it calls the three methods in order and then returns `True`;
  if you need strict checks, combine `mouse_down` / `move_to` / `mouse_up` manually and check the return value of each step.
