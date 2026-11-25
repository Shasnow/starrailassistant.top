---
title: Template Matching
description: A way to locate targets in SRA
sidebar:
  order: 2
---

Template matching is the most commonly used recognition method in SRA: it looks for a small pre-captured image (the template) in the game screen and returns its position within the window.
Buttons, icons, and fixed UI elements are all good candidates for locating this way.

This page explains how template matching works, the common APIs, the meaning of the parameters, and tips for making templates.

## How it works

The `locate` family of methods on `IOperator` is based on `pyscreeze`, which uses OpenCV underneath:

- The template and the screenshot are both converted to grayscale by default before comparison, reducing the impact of color differences and rendering jitter;
- It uses the `TM_CCOEFF_NORMED` algorithm of `cv2.matchTemplate`, sliding the template over the screenshot and computing similarity;
- Positions whose similarity exceeds the `confidence` threshold are considered matches, and results are uniformly wrapped in a `Box`.

Template matching is therefore **pixel-level**: the template must match the target in size and scale,
which is why SRA requires the game client area to be fixed at 1920×1080 (see [Window and Window Context](/en/reference/sracore/window-context/)).

## Common APIs

All methods are provided by `self.operator`; the local and cloud game implementations share the same logic.

| Method | Returns | Description |
| --- | --- | --- |
| `locate(template, ...)` | `Box \| None` | Finds the template and returns the best match position |
| `locate_all(template, ...)` | `list[Box] \| None` | Returns all match positions; `None` when nothing is found |
| `locate_any(templates, ...)` | `tuple[int, Box \| None]` | Takes one screenshot and matches several templates in turn, returning the index and position of the first hit |
| `wait_img(template, timeout=10, interval=0.5)` | `Box \| None` | Polls until the template appears; returns `None` on timeout |
| `wait_any_img(templates, timeout=10, interval=0.5)` | `tuple[int, Box \| None]` | Waits for any template to appear; returns `(-1, None)` on timeout |
| `click_img(template, ...)` | `bool` | Locates and clicks the center of the template, optionally retrying until it disappears |
| `click_box(box, ...)` | `bool` | Clicks the center of a `Box`, supporting pixel/fractional offsets |

Parameters shared by `locate` / `locate_all` / `locate_any`:

| Parameter | Description |
| --- | --- |
| `from_x` / `from_y` / `to_x` / `to_y` | Fractional coordinates (0–1) limiting the search area; the crop happens only when **all four are given** |
| `confidence` | Confidence threshold for this match (0–1); uses the global setting when `None` |
| `trace` | Whether to output a `trace` log when nothing matches; defaults to `True` |

The returned `Box` uses window client area coordinates and can be passed directly to `click_box`; `Box.source` records the template path that was hit, which helps with debugging.

## Confidence

The default threshold comes from the setting `General.templateMatchConfidence` (default `0.9`, range 0–1, higher is stricter),
and you can also override it per call by passing `confidence`:

```python
box = operator.locate(IMG.ENTER, confidence=0.8)
```

- Threshold too high: slight lighting effects or anti-aliasing differences are enough to cause "not found";
- Threshold too low: other elements with a similar shape are matched easily, causing misclicks.

When a task fails, `BaseTask.on_failed` hints at the threshold: `> 0.9` is too high and `< 0.7` is too low.

## Examples

### Locate and click

```python
from tasks.img import IMG

box = operator.locate(IMG.ENTER)
if box is not None:
    operator.click_box(box)
else:
    logger.info("没有找到进入按钮")
```

### Wait for a screen transition

```python
box = operator.wait_img(IMG.ENTER, timeout=30)
if box is None:
    raise RuntimeError("等待主界面超时")
```

### Choose one of several candidates

`locate_any` takes only one screenshot, which suits several possible states of the same screen:

```python
index, box = operator.wait_any_img([RRIMG.ASSIGNMENT_PAGE, RRIMG.ASSIGNMENT_PAGE2], timeout=10)
match index:
    case 0:
        pass
    case 1:
        operator.click_point(0.34, 0.22)
    case _:
        logger.error("派遣页面状态异常")
```

### Limit the search area

Searching inside a fixed panel significantly reduces false matches and time cost:

```python
box = operator.locate(IMG.Q, from_x=0.7, from_y=0.0, to_x=1.0, to_y=0.15)
```

### Click repeatedly until the element disappears

`click_img`'s `retry` is for cases where "the UI lags after clicking":
after each click it moves the mouse away, waits `retry_interval`, and then checks whether the template is still there.

```python
operator.click_img(RRIMG.DAILY_REWARD, retry=3, retry_interval=1)
```

## Template images

Templates are stored under `resources/img/`, grouped by purpose (`sg`, `tp`, `receive_rewards`, etc.),
and referenced as constants in [tasks/img.py](https://github.com/Shasnow/StarRailAssistant/blob/main/tasks/img.py):

```python
from tasks.img import IMG, RRIMG

box = operator.locate(RRIMG.DAILY_REWARD)
```

:::caution
Do not write `resources/img/...` strings directly in business code. The path is resolved relative to the **working directory**,
so always use the constants in `tasks/img.py`: it avoids typos and makes later changes to the directory layout easier.
:::

### Tips for making templates

- **Capture at the same resolution**: crop from a 1920×1080 client area screenshot; do not scale;
- **Keep unique features**: crop only the button icon or text, which is unlikely to repeat, and avoid large solid-color backgrounds;
- **Avoid dynamic content**: countdowns, numbers, lighting effects, and character art change, so leave them out of the template where possible;
- **Avoid state differences**: selected/unselected and enabled/greyed out often look different; split them into two templates if necessary;
- **Keep the size moderate**: too small matches easily by mistake, while too large means any local change drags the similarity down;
- **Save as PNG**: keep it lossless; avoid transparent edges, since transparent areas take part in the comparison and reduce matching stability;
- **Update with game versions**: templates must be re-captured after game UI updates (comments in the source, such as the one in `gift_of_odyssey`, remind you of this too).

## Choosing between recognition methods

| Scenario | Recommended approach |
| --- | --- |
| Icons, buttons, fixed graphics | Template matching |
| Changing text, button labels | OCR (`ocr_match` / `wait_ocr`) |
| Health bars, progress bars, solid-color markers | Color detection (`detect_color` / `wait_color`) |
| Plain rectangular borders, list items | Rectangle detection (`rectangle_detect`) |

## Notes

- **Every call takes a screenshot**: `locate` also waits 0.5 seconds after a successful match; `wait_img` takes a new screenshot on every poll,
  so the effective interval is roughly `interval` plus the internal wait — watch the time cost when calling it densely.
- **`locate_any` takes only one screenshot**: prefer it for multi-template cases and avoid taking a separate screenshot per template.
- **Missing template files**: `locate` / `locate_all` catch the exception and return `None` (with the reason recorded in the `trace` log);
  `locate_any` raises `FileNotFoundError` directly, so always make sure the image referenced by `tasks/img.py` exists.
- **Multiple overlapping hits are possible**: `locate_all` returns every pixel position above the threshold, and a single target often yields several adjacent results,
  which you can deduplicate by distance using `Box.center` and `Box.distance`.
- **The template and the target must be 1:1**: window scaling, UI scaling, and cloud game viewport size changes all cause matching to fail,
  which is why fractional coordinates are preferred and 1920×1080 is required.
