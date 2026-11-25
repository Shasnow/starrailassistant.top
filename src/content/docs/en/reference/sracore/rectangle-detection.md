---
title: Rectangle Detection
description: Edge-based rectangle target detection in SRA
sidebar:
  order: 5
---

Rectangle detection locates rectangular elements with a relatively fixed size and clear borders, such as card slots, list items, and button outlines.
It does not rely on template images and does not need to know the color in advance; it filters targets only by edge contours and size ranges.

This page covers the detection flow, parameters, tuning, and usage examples of `rectangle_detect`.

## How it works

The flow of `IOperator.rectangle_detect`:

1. Take a screenshot of the window (optionally limited to a region) and convert it to grayscale;
2. Apply a Gaussian blur, then Canny edge detection (`apertureSize=3`, `L2gradient=True`);
3. Extract **outer contours** with `cv2.findContours` (`RETR_EXTERNAL`);
4. Take the bounding rectangle of each contour and filter by the width/height ranges;
5. Compensate for the region offset, wrap it in a `Box`, with `source` fixed to `"rectangle_detect"`.

Note that the method returns the **bounding rectangle**; it does not verify that the contour is actually a quadrilateral, nor does it merge duplicate results.
It is essentially "find every connected edge region whose size falls inside the given range".

## Common APIs

```python
def rectangle_detect(
    min_w: int, max_w: int, min_h: int, max_h: int,
    *,
    canny_threshold: tuple[int, int] = (30, 90),
    gaussian_ksize: tuple[int, int] = (5, 5),
    from_x: float | None = None, from_y: float | None = None,
    to_x: float | None = None, to_y: float | None = None,
    trace: bool = False,
) -> list[Box]
```

| Parameter | Default | Description |
| --- | --- | --- |
| `min_w` / `max_w` | — | Rectangle width range in pixels, **open interval**: `min_w < width < max_w` |
| `min_h` / `max_h` | — | Rectangle height range in pixels, also an open interval |
| `canny_threshold` | `(30, 90)` | Canny low/high thresholds; more edges also means more noise |
| `gaussian_ksize` | `(5, 5)` | Gaussian blur kernel size, used to suppress noise |
| `from_x` / `from_y` / `to_x` / `to_y` | `None` | Fractional coordinates (0–1) of the detection area; the crop happens only when **all four are given** |
| `trace` | `False` | Whether to save a debug image (see below) |

Return value:

- Returns `list[Box]` when targets are detected; each `Box` is in window client area coordinates and can be passed straight to `click_box`;
- Returns an empty list `[]` when nothing is detected or an exception occurs.

:::caution
The width and height ranges are **open intervals**: `min_w=120, max_w=150` will not match a rectangle that is exactly 120 or 150 pixels.
It is best to let the actual size fall in the middle of the range.
:::

## Debug image

With `trace=True`, the "annotated box image + Canny edge image" are stitched side by side and saved to `log/ocr/rectangle_detect_<timestamp>.png`:

- The left side shows the detection result, with green boxes marking the matched rectangles and labeling their width and height;
- The right side shows the Canny edge image, used to work out why some targets were not detected.

When tuning, look at the edge image first: if the target's own edges are discontinuous, adjust `gaussian_ksize` or `canny_threshold`
rather than changing the size range.

## Examples

### Detect fixed-size slots

The following example comes from the Currency Wars task: find slots in the character preparation area by size, then deduplicate by center distance:

```python
boxes = operator.rectangle_detect(
    120, 150, 130, 150,
    from_x=0.1, from_y=0.52, to_x=0.86, to_y=0.7,
    trace=True,
)
if boxes:
    # the same slot may yield several nearby results; centers closer than 100 count as one slot
    unique_boxes: list[Box] = []
    for b in sorted(boxes, key=lambda b: b.left):
        if all(b.distance(u) >= 100 for u in unique_boxes):
            unique_boxes.append(b)
```

### Click the first detection result

```python
boxes = operator.rectangle_detect(200, 260, 60, 90)
if boxes:
    operator.click_box(boxes[0])
else:
    logger.info("没有找到目标按钮")
```

## Tuning tips

- **Limit the region first**: rectangle detection walks the contours of the whole screenshot, so limiting `from_x` etc. improves both speed and accuracy;
- **Widen the size range by one notch**: border pixels are affected by scaling and anti-aliasing, so leave 2–5 pixels on each side of the measured size,
  but do not widen it enough to match other elements;
- **Discontinuous edges**: raise `gaussian_ksize` appropriately to smooth noise, or lower the `canny_threshold` high threshold to get more complete edges;
- **Too much noise**: raise the `canny_threshold` low/high thresholds to reduce weak edges;
- **Duplicate results**: a single target often yields several overlapping results because of edges inside its pattern; deduplicate with `Box.center` and `Box.distance`;
- **Target size changes with resolution**: rectangle detection uses pixel sizes directly, so it equally depends on a 1920×1080 client area;
  when multiple resolutions must be supported, convert with `window_context.width/height` before passing the values in.

## Choosing between recognition methods

| Scenario | Recommended approach |
| --- | --- |
| Fixed-size rectangular slots and borders | Rectangle detection |
| Icon and button graphics | Template matching |
| Changing text | OCR |
| Health bars, progress bars, solid-color markers | Color detection |

## Notes

- **Every call takes a screenshot**: like template matching and OCR, the window is captured before detection;
- **No shape validation**: the bounding rectangle of any outer contour can match, including character art and background decorations,
  so always combine it with region limits and size ranges;
- **Results are unsorted**: the return order depends on `findContours`; when you need a stable order, sort by `Box.center` yourself;
- **Thread stop**: once `stop_event` is set, `ThreadStoppedError` is raised;
- **Exceptions return an empty list**: unlike `locate`, which returns `None`, rectangle detection returns `[]` on errors,
  so "no results" cannot be treated as an error outright; enable `trace` to inspect the debug image when needed.
