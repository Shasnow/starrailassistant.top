---
title: Color Detection
description: HSV-based color target detection in SRA
sidebar:
  order: 4
---

Color detection locates targets whose color is fixed but whose shape is not, such as health bars, progress bars, interaction glints, and interactive doors.
It does not rely on template images, so it is unaffected by changes in the target's size or shape and only cares about "where this color appears".

This page covers the HSV color model, the parameters of `detect_color` / `wait_color`, tuning, and common issues.

## How it works

`IOperator.detect_color` calls `ColorTargetDetector`, whose flow is:

1. Take a screenshot of the window (optionally limited to a region) and convert RGB to BGR;
2. Convert BGR → HSV and build the color mask with `cv2.inRange`;
3. Remove isolated noise with a morphological opening and fill holes inside targets with a closing;
4. Smooth the mask edges with a Gaussian blur;
5. Extract outer contours with `cv2.findContours` and filter by area and aspect ratio;
6. Compute the centroid and bounding rectangle, sort by `sort_by`, and truncate to `max_targets`.

The returned `Box` uses window client area coordinates and can be passed directly to `click_box`.

## HSV values

The HSV range in OpenCV differs from the familiar 0–360 hue:

| Channel | Range | Description                                        |
| ------- | ----- | -------------------------------------------------- |
| H       | 0–179 | Hue, equal to half the actual hue angle            |
| S       | 0–255 | Saturation; the lower it is, the closer to gray-white |
| V       | 0–255 | Value; the lower it is, the closer to black         |

For example, to detect the purple targets in the game you can use H around 146–175, S 64–146, V 154–222 (the actual values used for the "随意门" in Divergent Universe).

Picking colors: take a game screenshot, read the HSV of the target area with any color picker, and then leave some margin for the lower and upper bounds.

## Common APIs

| Method | Returns | Description |
| --- | --- | --- |
| `detect_color(hsv_lower, hsv_upper, ...)` | `list[Box]` | Returns targets sorted by `sort_by`; an empty list when nothing is detected |
| `wait_color(hsv_lower, hsv_upper, timeout=10, interval=0.5, ...)` | `Box \| None` | Polls until the color appears and returns the first target |

Shared parameters:

| Parameter | Default | Description |
| --- | --- | --- |
| `hsv_lower` / `hsv_upper` | — | HSV lower and upper bounds |
| `from_x` / `from_y` / `to_x` / `to_y` | `None` | Fractional coordinates (0–1) of the detection area; the crop happens only when **all four are given** |
| `min_area` | `500` | Minimum contour area (pixels²); anything below is treated as noise |
| `max_targets` | `1` | Maximum number of targets to return; `0` means all |
| `sort_by` | `AREA_DESC` | How to order multiple targets |
| `trace` | `True` | Whether to output a debug log |

`detect_color` also accepts the remaining `ColorTargetDetector` parameters (`**kwargs`):

| Parameter | Default | Description |
| --- | --- | --- |
| `max_area` | `0` | Maximum contour area; `0` means unlimited. Used to exclude a full-screen same-color background |
| `open_kernel` | `5` | Opening kernel size; `0` skips it. Removes isolated noise |
| `close_kernel` | `15` | Closing kernel size; `0` skips it. Fills holes inside targets |
| `blur_size` | `5` | Gaussian kernel size (automatically made odd); `0` skips it |
| `min_aspect_ratio` / `max_aspect_ratio` | `0` | Aspect ratio filter range; `0` disables the check |
| `fallback_hsv_ranges` | `[]` | Backup ranges tried in order when the primary range yields nothing |
| `roi` | `None` | Further restricts `(x, y, w, h)` inside the cropped result; usually the `from_x` etc. parameters are enough |

Sort order `ContourSort`:

| Value | Meaning |
| --- | --- |
| `AREA_DESC` | Descending area (default; good for finding the largest/nearest target) |
| `AREA_ASC` | Ascending area (finding the smallest/farthest target) |
| `Y_POSITION` | Ascending center Y (topmost on screen) |
| `X_POSITION` | Ascending center X (leftmost on screen) |

## Return values

`Box.source` has the format `color(面积,置信度)`, where the confidence is defined as
`min(1, contour area / detection region area × 10)`. It is only a rough indicator of "what share of the screen the target occupies",
not a similarity of color matching — whether a color hits is decided entirely by the `inRange` bounds.

When nothing matches, the internal detector returns a single result with `found=False`, but `detect_color` filters it out,
so **"not detected" always shows up as an empty list**.

## Examples

### Detect and click a target

```python
boxes = operator.detect_color(
    (146, 64, 154), (175, 146, 222),
    min_area=2500,
)
if boxes:
    operator.click_box(boxes[0])
```

### Wait for a color to appear

```python
box = operator.wait_color(
    (0, 120, 120), (10, 255, 255),
    timeout=15,
    from_x=0.3, from_y=0.8, to_x=0.7, to_y=0.9,
)
if box is None:
    logger.warning("等待交互提示超时")
```

### Get multiple targets

```python
from SRACore.operators.color_detector import ContourSort

boxes = operator.detect_color(
    hsv_lower, hsv_upper,
    max_targets=0,
    sort_by=ContourSort.X_POSITION,
)
```

### Use backup ranges when the color drifts

The same target may have a different hue in different scenes, so you can supply backup ranges that are tried in order when the primary range yields nothing:

```python
operator.detect_color(
    (146, 64, 154), (175, 146, 222),
    fallback_hsv_ranges=[((140, 50, 120), (170, 180, 230))],
)
```

## Tuning tips

- **`min_area`**: set it according to the target's actual area on screen. Too large misses small distant targets; too small treats lighting effects and particles as targets;
- **`max_area`**: use it to rule out false detections when there is a large same-color background near the target (e.g. a full-screen color block);
- **`open_kernel` / `close_kernel`**: increase the opening kernel when there is a lot of noise, and the closing kernel when the target is split into fragments;
- **`blur_size`**: increase it slightly when edges are visibly jagged; too large makes adjacent targets merge;
- **`min_aspect_ratio` / `max_aspect_ratio`**: effectively rules out false detections when the target shape is stable (e.g. a long health bar);
- **Region limits such as `from_x` / `to_x`**: they both speed things up and reduce false detections, so prefer them.

:::tip
Red spans both ends of the HSV hue circle at 0/179, so a single interval cannot cover it.
Split red into two segments (e.g. `0–10` and `170–179`) and try them in turn with `fallback_hsv_ranges`.
:::

## Notes

- **Every call takes a screenshot**: the polling in `wait_color` screenshots each time; narrowing the detection area speeds it up significantly;
- **Colors change with graphics settings**: different quality settings, HDR, and cloud game encoding all shift color values, so leave ample HSV margin;
- **Do not treat confidence as match quality**: the returned confidence only reflects the area share and says nothing about how well the color matches;
- **Occluded targets cannot be detected**: color detection has no notion of shape, so occlusion, color shifts, and translucency all directly affect the result;
- **Thread stop**: once `stop_event` is set, `ThreadStoppedError` is raised and polling does not continue.
