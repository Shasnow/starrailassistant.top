---
title: Window and Window Context
description: Locating and managing the target window in SRA
sidebar:
  order: 1
---

All of SRA's recognition and operations take place inside the "target window". To share the same logic between a local game window and a cloud game web page, SRA uses `WindowContext` to describe the window's position, size, and identity. Operators maintain it uniformly, so tasks and extensions only ever deal with coordinates relative to the window.

This page covers how the window is located, the coordinate conventions, full-screen mode, and screenshot behavior.

## WindowContext

`WindowContext` is defined in `SRACore/operators/model.py` and is a plain dataclass:

| Field          | Type   | Default            | Description                                                     |
| -------------- | ------ | ------------------ | --------------------------------------------------------------- |
| `top`          | `int`  | `0`                | Screen Y coordinate of the target region's top-left corner (refreshed automatically by SRA) |
| `left`         | `int`  | `0`                | Screen X coordinate of the target region's top-left corner (refreshed automatically by SRA) |
| `width`        | `int`  | `0`                | Width of the target region in pixels                            |
| `height`       | `int`  | `0`                | Height of the target region in pixels                           |
| `window_title` | `str`  | `崩坏：星穹铁道`   | Title of the target window, used to find the window             |
| `executable`   | `str`  | `StarRail.exe`     | Name of the target process, used to start and stop the game     |
| `full_screen`  | `bool` | `False`            | Full-screen mode: ignore the window and use the entire screen as the operation area |

`top` / `left` / `width` / `height` do not need to be filled in manually: before every screenshot SRA re-reads the actual position and size of the window client area and writes it back, so the window stays correctly located after being moved or resized.

:::tip
`OperatorFactory` creates only one `WindowContext` per process and passes it to every Operator instance, so tasks and extensions always see the same window information, with no inconsistency caused by per-instance caching.
:::

:::tip
You can change `window_title` and `executable` to target the window of another game or application.
:::

## Coordinate system

All coordinate parameters of an operator (`click_point`, `move_to`, `mouse_down`, `drag_to`, etc.) follow the same rules:

| Form    | Meaning                                                    | Example                                |
| ------- | ---------------------------------------------------------- | -------------------------------------- |
| `int`   | Pixel coordinates inside the window client area (origin at the client area's top-left corner) | `click_point(960, 540)`                |
| `float` | Fraction of the window width/height (0–1)                  | `click_point(0.5, 0.5)`                |

The offsets `x_offset` / `y_offset` are interpreted the same way: `int` is pixels, `float` is a window fraction, so you can use a fraction on just one axis.

`click_point` also provides a `mode` parameter to force the interpretation, which is useful when coordinates are read from JSON / config and `1` cannot be distinguished from `1.0`:

- `auto` (default): infer from the argument type;
- `abs`: force pixels;
- `rel`: force window fractions.

Recognition methods (`locate`, `ocr_boxes`, `detect_color`, etc.) also return `Box` in client-area coordinates, which can be passed straight to `click_box` with no conversion.

## Finding and refreshing the window

The local implementation (`Operator`) locates the window by `window_title` through `pygetwindow`, as follows:

- The title must **exactly** match `window_title` (leading and trailing whitespace ignored), avoiding false matches on other windows with a similar title;
- The handle is cached and validated with `IsWindow` before each use; when the handle is invalid (e.g. the game restarted) it is looked up again automatically;
- When no window is found the handle is `0` and the `hwnd` property returns `0`; windowless implementations such as cloud games always return `0`.

`is_window_active()` / `active_window()` check and switch the foreground window.
`active_window()` first simulates a `ctrl` key press so the system treats the action as user input, which allows `SetForegroundWindow` to take effect.

```python
from SRACore.operators.factory import OperatorFactory

operator = OperatorFactory.get_operator()
operator.window_context.window_title = "崩坏：星穹铁道"

if not operator.is_window_active():
    operator.active_window()  # switch to the game window
```

## Getting the window region

`Operator.get_win_region(active_window=True)` returns the current operation area as a `Region`:

- `active_window=True` (default): brings the window to the foreground first, then reads the screen coordinates of the **client area** (excluding the title bar and borders);
- `active_window=False`: does not activate the window and only refreshes the handle, for use with background screenshots.

If reading fails a `RuntimeError` is raised with the reason, most commonly when:

- The game is not running: the handle is `0`;
- The window is minimized: the client area's width or height is `0`.

:::caution
SRA locates the window by its client area (`GetClientRect` + `ClientToScreen`), not by the outer window frame.
As a result, template images and recognition results are unaffected by the title bar, borders, and window decorations, but it also means the window client area must stay at 1920×1080.
:::

## Full-screen operation mode

After setting `full_screen` to `True` (usually via `set_window_context(full_screen=True)`):

- The operation area degenerates to the whole screen: `left` / `top` become zero and `width` / `height` take the screen size;
- Fractional coordinates are computed against the whole screen instead of the window;
- Screenshots always go through screen capture, because background capture can only get the window's own content.

This mode suits exclusive full-screen setups where the window cannot be located; keep the default `False` when running windowed.

```python
operator.set_window_context(
    window_title="崩坏：星穹铁道",
    executable="StarRail.exe",
    full_screen=False,
)
```

`set_window_context` only overrides the arguments you pass; other fields keep their previous values. Note that arguments which are `None` or falsy (such as `False` or an empty string) also keep the previous value,
so you cannot use it to turn an already enabled full-screen mode back to `False`; modify `operator.window_context.full_screen` directly instead.

## Screenshot modes

The screenshot mode is determined by two switches: the call argument `background` controls **whether the window is activated**, while the instance attribute `screenshot_background`
controls **which screenshot implementation is used**.

| Switch                            | Effect                                                                 |
| --------------------------------- | ---------------------------------------------------------------------- |
| `background=True` (call argument) | Does not activate the window (`get_win_region(active_window=False)`), for use with background screenshots |
| `screenshot_background=True`      | Default; the local implementation uses Win32 `PrintWindow` (`PW_CLIENTONLY` + `PW_RENDERFULLCONTENT`), which can capture in the background and is not blocked by occlusion |
| `screenshot_background=False`     | Uses `pyscreeze.screenshot(region=...)` to grab the screen, which requires the window to be visible and in the foreground |

That is, with the default configuration (`screenshot_background=True`, windowed) screenshots always go through background capture and do not require the window to be in the foreground;
`StartGameTask` temporarily sets `screenshot_background` to `False` during login and uses screen capture to grab the login screen.

In addition:

- Full-screen mode always uses screen capture;
- When `from_x` / `from_y` / `to_x` / `to_y` are passed, the crop is taken by fraction inside the window client area;
- `resize` scales the output and `save_path` writes it to disk; `jpeg_quality` is only recommended for size-sensitive cases such as previews —
  do not use lossy compression for internal calls such as OCR / template matching.

## Resolution requirements

Template matching relies on a fixed resolution, so SRA requires the game **client area** to be **1920×1080**:

- At 1080p you can use full-screen directly;
- On higher-resolution monitors you can run the game windowed at 1920×1080.

When a task fails, `BaseTask.on_failed` checks the width and height of `window_context` and prints a warning if they do not meet the requirement,
for example `可能的失败原因：游戏分辨率不符合要求：1920x1080，当前：2560x1440。`

## Cloud game (BrowserOperator)

The browser-based cloud game implementation uses the same `WindowContext`, with the following differences:

- `type` is `"Browser"`, `hwnd` is always `0`, and `is_window_active()` is always `True`;
- It starts at 1920×1080 and, once the driver is available, updates the width and height from the page's actual viewport (`window.innerWidth` / `window.innerHeight`)
  to avoid deviation caused by browser borders and toolbars;
- In headless mode the rendering viewport is set directly to the target resolution via CDP.

Therefore task code should avoid hard-coded absolute pixel coordinates and prefer fractional coordinates, which is what makes it work for both local and cloud games.

## Related types

- `Region`: a rectangle with a `parent`; `sub_region()` divides the current region into a sub-region by fraction;
- `Box`: a recognition result rectangle offering `center` (the center point), `text` / `source` (the origin: template path or OCR text), and `distance()`.

```python
from tasks.img import IMG

box = operator.wait_img(IMG.ENTER, timeout=30)
if box is not None:
    operator.click_box(box, y_offset=-10)  # click 10 pixels above the center point
```
