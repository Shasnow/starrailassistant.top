---
title: Regions and Boxes
description: The Region and Box data structures and how to use them
sidebar:
  order: 13
---

SRA uses two lightweight dataclasses to represent rectangles: `Region` describes an operation area on the window or screen, and `Box` describes the target position from one recognition.
Both are defined in `SRACore/operators/model.py` and are the common carriers for all kinds of Operator return values.

This page covers the fields, methods, and common usage of both.

## Region

`Region` represents a rectangle in screen coordinates and is commonly used to describe "the area to screenshot or operate on".

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `left` | `int` | — | Top-left X (screen coordinates) |
| `top` | `int` | — | Top-left Y (screen coordinates) |
| `width` | `int` | — | Width (pixels) |
| `height` | `int` | — | Height (pixels) |
| `parent` | `Region \| None` | `None` | Parent region, used only to trace the origin; not involved in coordinate conversion |

```python
region = Region(0, 0, 1920, 1080)
```

### Methods

| Member | Description |
| --- | --- |
| `tuple` | Returns `(left, top, width, height)`, which can be passed directly to `pyscreeze.screenshot(region=...)` |
| `sub_region(from_x, from_y, to_x, to_y)` | Divides a sub-region **inside the current region** by fraction, and sets `parent=self` |

`sub_region` computes:

```text
left   = self.left   + width  * from_x
top    = self.top    + height * from_y
width  = self.width  * (to_x - from_x)
height = self.height * (to_y - from_y)
```

```python
window = Region(100, 50, 1920, 1080)
panel = window.sub_region(0.5, 0.5, 1.0, 1.0)  # bottom-right quarter
```

:::caution
`sub_region` does not validate argument ranges; `from_x` greater than `to_x`, or values outside 0–1, produce negative sizes or out-of-bounds regions.
Callers must ensure the inputs are valid.
:::

### Usage in Operator

`Operator.get_win_region()` returns the `Region` of the current operation area, and screenshot methods then convert it to `region.tuple` for the underlying layer:

```python
region = operator.get_win_region(active_window=False)
logger.debug(f"当前客户区: {region.left}, {region.top}, {region.width}x{region.height}")
```

In full-screen mode the returned `Region` covers the whole screen, while in normal mode it corresponds to the window client area; see [Window and Window Context](/en/reference/sracore/window-context/) for details.

## Box

`Box` represents the result of one recognition and is the most commonly used return type (template matching, OCR, color detection, and rectangle detection all return it).

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `left` | `int` | — | Top-left X (window client area coordinates) |
| `top` | `int` | — | Top-left Y (window client area coordinates) |
| `width` | `int` | — | Width (pixels) |
| `height` | `int` | — | Height (pixels) |
| `source` | `str` | `""` | Source identifier, such as a template path, OCR text, `color(...)`, or `rectangle_detect` |
| `_text` | `str \| None` | `None` | Custom text; falls back to `source` when unset |

### Properties and methods

| Member | Description |
| --- | --- |
| `center` | Center point `(left + width // 2, top + height // 2)` |
| `text` | Readable and writable; returns `_text or source` |
| `distance(other)` | Euclidean distance from the center point of another `Box` |
| `__str__` | Returns `text`, convenient for logging directly |

```python
box = operator.wait_img(IMG.ENTER, timeout=30)
if box is not None:
    x, y = box.center
    operator.click_point(x, y)
    logger.debug(f"命中 {box.source} @ {box.center}")
```

### Actual values of source

| Recognition method | `source` content |
| --- | --- |
| Template matching | Template image path |
| OCR (`ocr_boxes`) | The recognized text |
| Color detection | `color(面积,置信度)` |
| Rectangle detection | The fixed string `rectangle_detect` |

So in OCR scenarios `box.text` is exactly the recognized text, and you can make secondary decisions on it directly:

```python
boxes = operator.ocr_boxes(from_x=0.62, from_y=0.54, to_x=0.72, to_y=0.6)
if boxes and "确认" in boxes[0].text:
    operator.click_box(boxes[0])
```

## Common usage

### Deduplication

A single target can produce multiple overlapping results (especially with `locate_all` and rectangle detection); filter them by center distance:

```python
unique: list[Box] = []
for box in sorted(boxes, key=lambda b: b.left):
    if all(box.distance(other) >= 100 for other in unique):
        unique.append(box)
```

### Sorting

`Box` is a plain dataclass, so you can sort by any field directly:

```python
for box in sorted(boxes, key=lambda b: b.center[1]):  # from top to bottom
    operator.click_box(box)
```

### Offset clicks

`click_box` uses the center point as the base, and offsets follow the "`int` pixels / `float` fraction" rule:

```python
operator.click_box(box, y_offset=-0.02)  # click 2% of the window height above the center
```

## Notes

- **Different coordinate systems**: `Region` uses screen coordinates while `Box` uses window client area coordinates; do not mix them;
- **`center` is an integer**: with an odd width or height it rounds down, so it may differ from the "geometric center" by less than 1 pixel;
- **`distance` is based on center points**: it only compares positions and ignores size overlap, so targets of very different sizes can still be "close";
- **Mutable objects**: neither `Box` nor `Region` is `frozen`, so changing a field affects every piece of code holding a reference to it;
- **`parent` is only a reference**: it does not convert coordinates automatically; the inputs of `sub_region` are always relative to the current region.
