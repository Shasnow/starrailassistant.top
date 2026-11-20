---
title: 矩形检测
description: SRA 中基于边缘的矩形目标检测
sidebar:
  order: 5
---

矩形检测用于定位尺寸相对固定、边界清晰的矩形元素，例如卡牌槽位、列表项、按钮外框等。
它不依赖模板图片，也不需要提前知道颜色，只根据边缘轮廓与尺寸范围筛选目标。

本文介绍 `rectangle_detect` 的检测流程、参数、调参与使用示例。

## 原理

`IOperator.rectangle_detect` 的处理流程：

1. 截取窗口（可限定区域），转灰度图；
2. 高斯模糊后做 Canny 边缘检测（`apertureSize=3`、`L2gradient=True`）；
3. `cv2.findContours` 提取**外轮廓**（`RETR_EXTERNAL`）；
4. 取每个轮廓的外接矩形，按宽高范围过滤；
5. 补偿区域偏移后封装为 `Box`，`source` 固定为 `"rectangle_detect"`。

需要注意：方法返回的是**外接矩形**，并不校验轮廓是否为四边形，也不合并重复结果。
它本质上是「找出尺寸落在指定范围内的所有边缘连通区域」。

## 常用 API

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

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `min_w` / `max_w` | — | 矩形宽度范围（像素），**开区间**：`min_w < 宽 < max_w` |
| `min_h` / `max_h` | — | 矩形高度范围（像素），同样是开区间 |
| `canny_threshold` | `(30, 90)` | Canny 低/高阈值，边缘越多噪点越多 |
| `gaussian_ksize` | `(5, 5)` | 高斯模糊核大小，用于抑制噪点 |
| `from_x` / `from_y` / `to_x` / `to_y` | `None` | 检测区域比例坐标（0–1），**四个必须同时给出**才会裁剪 |
| `trace` | `False` | 是否保存调试图（见下文） |

返回值：

- 检测到目标时返回 `list[Box]`，每个 `Box` 为窗口客户区坐标，可直接 `click_box`；
- 未检测到或发生异常时返回空列表 `[]`。

:::caution
宽度与高度范围是**开区间**：`min_w=120, max_w=150` 不会匹配恰好 120 或 150 像素的矩形。
设置时建议让实际尺寸落在范围中间。
:::

## 调试图

`trace=True` 时会把「标注框图像 + Canny 边缘图」左右拼接后保存到 `log/ocr/rectangle_detect_<时间戳>.png`：

- 左侧为检测结果，绿色框标注命中的矩形，并标出 `宽x高`；
- 右侧为 Canny 边缘图，用于判断为什么某些目标没有被检测到。

调参时先看边缘图：如果目标边缘本身不连续，应先调整 `gaussian_ksize` 或 `canny_threshold`，
而不是改尺寸范围。

## 示例

### 检测固定尺寸的槽位

以下示例来自货币战争任务：在角色备战区按尺寸找槽位，再按中心距离去重：

```python
boxes = operator.rectangle_detect(
    120, 150, 130, 150,
    from_x=0.1, from_y=0.52, to_x=0.86, to_y=0.7,
    trace=True,
)
if boxes:
    # 同一位置可能产生多个相近结果，中心距离小于 100 的视为同一个槽位
    unique_boxes: list[Box] = []
    for b in sorted(boxes, key=lambda b: b.left):
        if all(b.distance(u) >= 100 for u in unique_boxes):
            unique_boxes.append(b)
```

### 点击第一个检测结果

```python
boxes = operator.rectangle_detect(200, 260, 60, 90)
if boxes:
    operator.click_box(boxes[0])
else:
    logger.info("没有找到目标按钮")
```

## 调参建议

- **先限定区域**：矩形检测会遍历整张截图的轮廓，限定 `from_x` 等参数能同时提升速度与准确率；
- **尺寸范围放宽一档**：边界像素受缩放与抗锯齿影响，建议在实测尺寸上下各留 2–5 像素，
  但不要宽到能匹配到其他元素；
- **边缘不连续**：适当提高 `gaussian_ksize` 平滑噪点，或降低 `canny_threshold` 高阈值以获得更完整的边缘；
- **噪点过多**：提高 `canny_threshold` 低/高阈值，减少弱边缘；
- **结果重复**：同一目标常因图案内部边缘产生多个重叠结果，用 `Box.center` 与 `Box.distance` 去重；
- **目标尺寸随分辨率变化**：矩形检测直接使用像素尺寸，因此同样依赖 1920×1080 客户区，
  需要同时支持多分辨率时，应按 `window_context.width/height` 换算后再传入。

## 与其他识别方式的选择

| 场景 | 推荐方式 |
| --- | --- |
| 尺寸固定的矩形槽位、边框 | 矩形检测 |
| 图标、按钮图案 | 模板匹配 |
| 会变化的文本 | OCR |
| 血条、进度条、纯色标记 | 颜色检测 |

## 注意事项

- **每次调用都会截图**：与模板匹配、OCR 一样，检测前会先截取窗口；
- **不做形状校验**：任意外轮廓的外接矩形都可能命中，包括角色立绘、背景装饰，
  因此务必配合区域限定与尺寸范围；
- **结果未排序**：返回顺序取决于 `findContours`，需要稳定顺序时按 `Box.center` 自行排序；
- **线程停止**：`stop_event` 置位后会抛出 `ThreadStoppedError`；
- **异常返回空列表**：与 `locate` 返回 `None` 不同，矩形检测出错时统一返回 `[]`，
  因此「没有结果」不能直接判定为出错，必要时开启 `trace` 查看调试图。
