---
title: 区域与盒子
description: Region 与 Box 数据结构及其使用方式
sidebar:
  order: 13
---

SRA 用两个轻量的 dataclass 表示矩形：`Region` 描述窗口或屏幕上的操作区域，`Box` 描述一次识别得到的目标位置。
它们都定义在 `SRACore/operators/model.py`，是 Operator 各类返回值的通用载体。

本文介绍两者的字段、方法与常见用法。

## Region

`Region` 表示屏幕坐标系中的一个矩形，常用于描述「要截图/操作的范围」。

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `left` | `int` | — | 左上角 X（屏幕坐标） |
| `top` | `int` | — | 左上角 Y（屏幕坐标） |
| `width` | `int` | — | 宽度（像素） |
| `height` | `int` | — | 高度（像素） |
| `parent` | `Region \| None` | `None` | 父区域，仅用于追溯来源，不参与坐标换算 |

```python
region = Region(0, 0, 1920, 1080)
```

### 方法

| 成员 | 说明 |
| --- | --- |
| `tuple` | 返回 `(left, top, width, height)`，可直接传给 `pyscreeze.screenshot(region=...)` |
| `sub_region(from_x, from_y, to_x, to_y)` | 按比例在**当前区域内**划分子区域，并设置 `parent=self` |

`sub_region` 的计算方式为：

```text
left   = self.left   + width  * from_x
top    = self.top    + height * from_y
width  = self.width  * (to_x - from_x)
height = self.height * (to_y - from_y)
```

```python
window = Region(100, 50, 1920, 1080)
panel = window.sub_region(0.5, 0.5, 1.0, 1.0)  # 右下四分之一
```

:::caution
`sub_region` 不校验参数范围，`from_x` 大于 `to_x` 或超出 0–1 都会得到负尺寸或越界区域，
调用方需要自行保证输入合法。
:::

### Operator 中的使用

`Operator.get_win_region()` 返回当前操作区域的 `Region`，截图方法再把它转成 `region.tuple` 交给底层：

```python
region = operator.get_win_region(active_window=False)
logger.debug(f"当前客户区: {region.left}, {region.top}, {region.width}x{region.height}")
```

整屏模式下返回的 `Region` 覆盖整个屏幕，普通模式则对应窗口客户区，详见[窗口与窗口上下文](/reference/sracore/window-context/)。

## Box

`Box` 表示一次识别的结果，是最常用的返回类型（模板匹配、OCR、颜色检测、矩形检测都会返回它）。

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `left` | `int` | — | 左上角 X（窗口客户区坐标） |
| `top` | `int` | — | 左上角 Y（窗口客户区坐标） |
| `width` | `int` | — | 宽度（像素） |
| `height` | `int` | — | 高度（像素） |
| `source` | `str` | `""` | 来源标识，如模板路径、OCR 文本、`color(...)`、`rectangle_detect` |
| `_text` | `str \| None` | `None` | 自定义文本，未设置时回退到 `source` |

### 属性与方法

| 成员 | 说明 |
| --- | --- |
| `center` | 中心点 `(left + width // 2, top + height // 2)` |
| `text` | 可读写；返回 `_text or source` |
| `distance(other)` | 与另一个 `Box` 的中心点欧氏距离 |
| `__str__` | 返回 `text`，便于直接打印日志 |

```python
box = operator.wait_img(IMG.ENTER, timeout=30)
if box is not None:
    x, y = box.center
    operator.click_point(x, y)
    logger.debug(f"命中 {box.source} @ {box.center}")
```

### source 的实际取值

| 识别方式 | `source` 内容 |
| --- | --- |
| 模板匹配 | 模板图片路径 |
| OCR（`ocr_boxes`） | 识别出的文本 |
| 颜色检测 | `color(面积,置信度)` |
| 矩形检测 | 固定字符串 `rectangle_detect` |

因此 `box.text` 在 OCR 场景下就是识别到的文字，可以直接做二次判断：

```python
boxes = operator.ocr_boxes(from_x=0.62, from_y=0.54, to_x=0.72, to_y=0.6)
if boxes and "确认" in boxes[0].text:
    operator.click_box(boxes[0])
```

## 常见用法

### 去重

同一目标可能产生多个重叠结果（尤其是 `locate_all` 与矩形检测），可按中心距离过滤：

```python
unique: list[Box] = []
for box in sorted(boxes, key=lambda b: b.left):
    if all(box.distance(other) >= 100 for other in unique):
        unique.append(box)
```

### 排序

`Box` 是普通 dataclass，可直接按任意字段排序：

```python
for box in sorted(boxes, key=lambda b: b.center[1]):  # 从上到下
    operator.click_box(box)
```

### 偏移点击

`click_box` 会以中心点为基准，偏移量遵循「`int` 像素 / `float` 比例」的规则：

```python
operator.click_box(box, y_offset=-0.02)  # 点击中心上方 2% 窗口高度处
```

## 注意事项

- **坐标系不同**：`Region` 是屏幕坐标，`Box` 是窗口客户区坐标，二者不要混用；
- **`center` 为整数**：宽高为奇数时向下取整，与「几何中心」可能相差不到 1 像素；
- **`distance` 基于中心点**：只比较位置，不考虑尺寸重叠，尺寸差异很大的目标也可能「距离很近」；
- **可变对象**：`Box` 与 `Region` 都不是 `frozen`，修改字段会影响所有引用它的代码；
- **`parent` 只是引用**：它不会自动换算坐标，`sub_region` 的输入始终相对当前区域。
