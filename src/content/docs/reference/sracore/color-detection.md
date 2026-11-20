---
title: 颜色检测
description: SRA 中基于 HSV 的颜色目标检测
sidebar:
  order: 4
---

颜色检测用于定位画面上颜色固定、形状不固定的目标，例如血条、进度条、交互光点、可交互的门。
它不依赖模板图片，因此不受目标尺寸或外形变化影响，只关心「哪里出现了这种颜色」。

本文介绍 HSV 颜色模型、`detect_color` / `wait_color` 的参数、调参与常见问题。

## 原理

`IOperator.detect_color` 调用 `ColorTargetDetector`，处理流程为：

1. 截取窗口（可限定区域），RGB 转 BGR；
2. BGR → HSV，用 `cv2.inRange` 生成颜色掩码；
3. 形态学开运算去除孤立噪点，闭运算填充目标内部空洞；
4. 高斯模糊平滑掩码边缘；
5. `cv2.findContours` 提取外轮廓，按面积与宽高比过滤；
6. 计算质心与外接矩形，按 `sort_by` 排序后截断到 `max_targets`。

返回的 `Box` 使用窗口客户区坐标，可直接交给 `click_box`。

## HSV 取值

OpenCV 的 HSV 取值范围与常见的 0–360 色相不同：

| 通道 | 范围  | 说明                         |
| ---- | ----- | ---------------------------- |
| H    | 0–179 | 色相，等于实际色相角度的一半 |
| S    | 0–255 | 饱和度，越低越接近灰白       |
| V    | 0–255 | 明度，越低越接近黑色         |

例如要检测游戏中的紫色目标，可以取 H 约 146–175、S 64–146、V 154–222（差分宇宙中「随意门」的实际取值）。

取色建议：截一张游戏截图，用任意取色工具读取目标区域的 HSV，再留出一定余量作为上下界。

## 常用 API

| 方法 | 返回 | 说明 |
| --- | --- | --- |
| `detect_color(hsv_lower, hsv_upper, ...)` | `list[Box]` | 返回按 `sort_by` 排序的目标列表，未检测到为空列表 |
| `wait_color(hsv_lower, hsv_upper, timeout=10, interval=0.5, ...)` | `Box \| None` | 轮询等待颜色出现，返回第一个目标 |

共同参数：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `hsv_lower` / `hsv_upper` | — | HSV 下界与上界 |
| `from_x` / `from_y` / `to_x` / `to_y` | `None` | 检测区域比例坐标（0–1），**四个必须同时给出**才会裁剪 |
| `min_area` | `500` | 最小轮廓面积（像素²），低于此值视为噪点 |
| `max_targets` | `1` | 最多返回目标数，`0` 表示全部 |
| `sort_by` | `AREA_DESC` | 多目标排序方式 |
| `trace` | `True` | 是否输出调试日志 |

`detect_color` 还接受 `ColorTargetDetector` 的其余参数（`**kwargs`）：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `max_area` | `0` | 最大轮廓面积，`0` 不限制；用于排除全屏同色背景 |
| `open_kernel` | `5` | 开运算核大小，`0` 跳过；消除孤立噪点 |
| `close_kernel` | `15` | 闭运算核大小，`0` 跳过；填充目标内部空洞 |
| `blur_size` | `5` | 高斯核大小（自动取奇数），`0` 跳过 |
| `min_aspect_ratio` / `max_aspect_ratio` | `0` | 宽高比过滤范围，`0` 不检查 |
| `fallback_hsv_ranges` | `[]` | 主范围无结果时依次尝试的备用范围 |
| `roi` | `None` | 在裁剪结果内再限定 `(x, y, w, h)`，一般用 `from_x` 等参数即可 |

排序方式 `ContourSort`：

| 取值 | 含义 |
| --- | --- |
| `AREA_DESC` | 面积降序（默认，适合找最大/最近目标） |
| `AREA_ASC` | 面积升序（找最小/最远目标） |
| `Y_POSITION` | 按中心 Y 坐标升序（画面最上方） |
| `X_POSITION` | 按中心 X 坐标升序（画面最左侧） |

## 返回结果

`Box.source` 的格式为 `color(面积,置信度)`，其中置信度定义为
`min(1, 轮廓面积 / 检测区域面积 × 10)`，只是「目标在画面中占比」的粗略指标，
不是颜色匹配的相似度——颜色是否命中完全由 `inRange` 的上下界决定。

内部检测器在未命中时会返回一条 `found=False` 的结果，但 `detect_color` 会将其过滤掉，
因此**未检测到统一表现为空列表**。

## 示例

### 检测并点击目标

```python
boxes = operator.detect_color(
    (146, 64, 154), (175, 146, 222),
    min_area=2500,
)
if boxes:
    operator.click_box(boxes[0])
```

### 等待颜色出现

```python
box = operator.wait_color(
    (0, 120, 120), (10, 255, 255),
    timeout=15,
    from_x=0.3, from_y=0.8, to_x=0.7, to_y=0.9,
)
if box is None:
    logger.warning("等待交互提示超时")
```

### 取多个目标

```python
from SRACore.operators.color_detector import ContourSort

boxes = operator.detect_color(
    hsv_lower, hsv_upper,
    max_targets=0,
    sort_by=ContourSort.X_POSITION,
)
```

### 颜色会漂移时使用备用范围

同一目标在不同场景下色相可能不同，可提供备用范围，主范围无结果时自动依次尝试：

```python
operator.detect_color(
    (146, 64, 154), (175, 146, 222),
    fallback_hsv_ranges=[((140, 50, 120), (170, 180, 230))],
)
```

## 调参建议

- **`min_area`**：按目标在画面中的实际面积设置。太大会漏掉远处的小目标，太小会把光效、粒子当目标；
- **`max_area`**：目标附近有大面积同色背景（如全屏色块）时用它排除误检；
- **`open_kernel` / `close_kernel`**：噪点多就加大开运算核，目标被切成碎片就加大闭运算核；
- **`blur_size`**：边缘毛刺明显时略微加大，过大会让相邻目标粘连；
- **`min_aspect_ratio` / `max_aspect_ratio`**：目标形状稳定（如长条血条）时能有效排除误检；
- **`from_x` / `to_x` 等区域限定**：既提速又减少误检，优先使用。

:::tip
红色在 HSV 色相环上跨越 0/179 两端，单个区间无法覆盖。
此时把红色拆成两段（如 `0–10` 与 `170–179`），用 `fallback_hsv_ranges` 依次尝试。
:::

## 注意事项

- **每次调用都会截图**：`wait_color` 的轮询逐次截图，缩小检测区域可显著提速；
- **颜色随画质变化**：不同画质、HDR、云游戏编码都会导致色值偏移，最好留足 HSV 余量；
- **不要用置信度当匹配度**：返回的置信度只反映面积占比，不代表颜色匹配得有多好；
- **目标被遮挡时无法检测**：颜色检测没有形状概念，遮挡、变色、半透明都会直接影响结果；
- **线程停止**：`stop_event` 置位后会抛出 `ThreadStoppedError`，不会继续轮询。
