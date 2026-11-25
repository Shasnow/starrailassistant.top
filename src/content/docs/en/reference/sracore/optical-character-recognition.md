---
title: "Optical Character Recognition (OCR)"
description: "Optical character recognition in SRA"
sidebar:
  order: 3
---

OCR is used to recognize text on screen. It suits locating text that changes over time, or deciding the state of a button or screen directly from its wording.
SRA uses [RapidOCR](https://github.com/RapidAI/RapidOCR) as the recognition engine, and local and cloud games share the same interface.

This page covers the OCR recognition flow, the common APIs, matchers, confidence, and debugging.

## Engine and initialization

The OCR engine is created by `OperatorFactory.get_ocr_instance()` and initialized only once per process, shared by all Operators:

- If `rapidocr/config.yaml` exists it is loaded as the engine configuration, otherwise the RapidOCR defaults are used;
- The log level is fixed at `error` so engine output does not interfere with SRA's logs;
- The first use loads the recognition models (downloaded automatically by RapidOCR if missing), so the first call may be slow and requires network access.

:::caution
RapidOCR depends on ONNX Runtime and requires the Microsoft Visual C++ 2015-2022 redistributable (x64).
If initialization fails, SRA reports the specific missing DLL or environment information instead of just throwing the raw stack trace.
:::

## Recognition flow

The flow of `IOperator.ocr()`:

1. Take a screenshot of the window (optionally limited to a region);
2. When `grayscale=True` (the default), convert the screenshot to grayscale;
3. Call the engine with detection (`use_det`) and recognition (`use_rec`) enabled and orientation classification (`use_cls`) disabled;
4. Filter by confidence; text lines below the threshold are dropped;
5. In developer mode, optionally save an annotated image, see [Debugging](#debugging).

The engine outputs in units of "text lines", so a multi-line paragraph produces several results.

## Common APIs

| Method | Returns | Description |
| --- | --- | --- |
| `ocr(...)` | `list[tuple[points, text, score]] \| None` | Raw recognition results; each item holds four-point polygon coordinates, the text, and the confidence |
| `ocr_boxes(...)` | `list[Box] \| None` | Same as above, but converted to `Box` in window coordinates, with `source` set to the recognized text |
| `ocr_match(text, ...)` | `Box \| None` | Matches the given text and returns the position of the first hit |
| `ocr_match_any(texts, ...)` | `tuple[int, Box \| None]` | Matches several texts and returns the index and position of the hit |
| `wait_ocr(text, ...)` | `Box \| None` | Polls until the text appears |
| `wait_ocr_any(texts, ...)` | `tuple[int, Box \| None]` | Polls until any of the texts appears |

Shared parameters:

| Parameter | Description |
| --- | --- |
| `from_x` / `from_y` / `to_x` / `to_y` | Fractional coordinates (0–1) of the recognition area; the crop happens only when **all four are given** |
| `confidence` | Confidence threshold (0–1); uses the global setting when `None` |
| `trace` | Whether to output a debug log; defaults to `True` |

The `Box` returned by `ocr_boxes` / `ocr_match` is already converted back to window client area coordinates and can be passed directly to `click_box`,
so you no longer need to worry about the crop offset. Prefer these two methods over handling the raw results of `ocr()` directly.

## Text matching

The `text` argument of `ocr_match` / `ocr_match_any` can be a string or a `StrMatcher` instance.
When a string is passed, it is matched by **containment** (`ContainsMatcher`) by default.

| Matcher | Behavior |
| --- | --- |
| `ContainsMatcher(value)` | Checks `value in text` after normalization, i.e. substring matching |
| `EqualsMatcher(value)` | Exact equality after normalization |
| `RegexMatcher(pattern)` | Regex search (`re.search`), with no full-width/half-width normalization |

`ContainsMatcher` and `EqualsMatcher` apply NFKC normalization first, converting full-width characters to half-width,
so that unstable OCR recognition of full-width vs. half-width characters does not cause missed matches.

```python
from SRACore.util.strutil import EqualsMatcher, RegexMatcher

# default: containment match
box = operator.ocr_match("开拓")

# exact equality, so 「开拓」 does not hit 「开拓等级」
box = operator.ocr_match(EqualsMatcher("开拓"))

# regex: match numbers such as 「剩余 12 次」
box = operator.ocr_match(RegexMatcher(r"剩余\s*\d+\s*次"))
```

:::tip
`ocr_match_any` returns the index of the **first** hit in the order of the list you pass, not in on-screen position order;
the list order is the priority order, which is useful for distinguishing mutually exclusive buttons such as "Confirm" / "Cancel".
:::

## Confidence

The default threshold comes from the setting `General.ocrMatchConfidence` (default `0.7`, range 0–1, higher is stricter),
and you can override it for a single call by passing `confidence`:

```python
box = operator.ocr_match("开始挑战", confidence=0.85)
```

- Threshold too low: blurry text, ghosting, and similar glyphs are more easily misrecognized;
- Threshold too high: small text, low contrast, or text under a translucent overlay gets filtered out.

OCR confidence and template matching's `templateMatchConfidence` are independent of each other; be careful not to confuse them when tuning.

## Examples

### Recognize and click a button

```python
box = operator.wait_ocr("开始挑战", timeout=15)
if box is not None:
    operator.click_box(box)
else:
    logger.info("没有找到开始挑战按钮")
```

### Wait for several screen states

```python
index, box = operator.wait_ocr_any(["委托完成", "受到攻击"], timeout=30)
match index:
    case 0:
        operator.click_box(box)
    case 1:
        logger.warning("角色受到攻击，检查队伍配置")
```

### Limit the recognition area

Recognizing only the panel title area reduces false matches and saves time:

```python
box = operator.ocr_match(
    "背包",
    from_x=0.05, from_y=0.03, to_x=0.1, to_y=0.08,
)
```

### Handle raw results directly

Use `ocr_boxes` when you need all the text at once:

```python
boxes = operator.ocr_boxes()
if boxes:
    for box in boxes:
        logger.debug(f"{box.source} @ {box.center}")
```

## Debugging

Set the operator's `self.is_save_ocr_image` to `True`, or enable developer mode (`Advanced.developerMode.enabled`) and saving OCR screenshots
(`Advanced.developerMode.saveOcrImage`) in the settings; each recognition then saves an annotated image to `log/ocr/`:

- Green boxes mark the recognized text areas;
- The text and its confidence are drawn above the box;
- File names use a nanosecond timestamp, so you can match them to recognition results in the log by time.

With `trace=True`, `ocr()` also outputs the full recognition results, which helps track down "recognized but not matched" problems together with the logs.

## Choosing between recognition methods

| Scenario | Recommended approach |
| --- | --- |
| Changing text, button labels | OCR |
| Icons, fixed graphical buttons | Template matching |
| Health bars, progress bars, solid-color markers | Color detection |
| Plain rectangular borders, list items | Rectangle detection |

## Notes

- **Every call takes a screenshot**: the polling in `wait_ocr` / `wait_ocr_any` also screenshots each time, so the effective interval is larger than `interval`;
  narrowing the recognition area can shorten the time cost significantly.
- **Not recognizing anything is not an error**: `ocr()` returns an empty list when there is text but all of it is below the threshold, and `None` on an exception;
  `ocr_boxes` returns `None` in both cases, and `ocr_match` returns `None`.
- **Text lines are split**: the same wording may be split across lines, so short strings match other lines easily; tighten it with `RegexMatcher` when needed.
- **Resolution and font rendering**: OCR also relies on a 1920×1080 client area and stable font rendering;
  an extremely scaled cloud game viewport can reduce the recognition rate.
- **First model download**: in offline environments the RapidOCR models must be prepared in advance, otherwise the first call fails.
