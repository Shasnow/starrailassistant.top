---
title: 模板匹配
description: SRA 中检测目标的一种方法
sidebar:
  order: 2
---

模板匹配是 SRA 最常用的识别方式：在游戏画面中寻找一张预先截好的小图（模板），得到它在窗口中的位置。
按钮、图标、固定 UI 元素都适合用它定位。

本文介绍模板匹配的原理、常用 API、参数含义与模板制作建议。

## 原理

`IOperator` 的 `locate` 系列方法基于 `pyscreeze`，底层使用 OpenCV：

- 模板与截图默认都转为灰度图后比较，减少颜色差异与渲染抖动的影响；
- 使用 `cv2.matchTemplate` 的 `TM_CCOEFF_NORMED` 算法，在截图上滑窗计算相似度；
- 相似度高于 `confidence` 阈值的位置即视为匹配，返回结果统一封装为 `Box`。

因此模板匹配是**像素级**的：模板必须与目标在尺寸、比例上一致，
所以 SRA 要求游戏客户区固定为 1920×1080（见[窗口与窗口上下文](/reference/sracore/window-context/)）。

## 常用 API

所有方法都由 `self.operator` 提供，本地与云游戏实现共用同一套逻辑。

| 方法 | 返回 | 说明 |
| --- | --- | --- |
| `locate(template, ...)` | `Box \| None` | 查找模板，返回最佳匹配位置 |
| `locate_all(template, ...)` | `list[Box] \| None` | 返回全部匹配位置；未找到时为 `None` |
| `locate_any(templates, ...)` | `tuple[int, Box \| None]` | 一次截图依次匹配多个模板，返回首个命中的索引与位置 |
| `wait_img(template, timeout=10, interval=0.5)` | `Box \| None` | 轮询等待模板出现，超时返回 `None` |
| `wait_any_img(templates, timeout=10, interval=0.5)` | `tuple[int, Box \| None]` | 等待任意模板出现，超时返回 `(-1, None)` |
| `click_img(template, ...)` | `bool` | 定位并点击模板中心，可选重试直到模板消失 |
| `click_box(box, ...)` | `bool` | 点击 `Box` 中心，支持像素/比例偏移 |

`locate` / `locate_all` / `locate_any` 的共同参数：

| 参数 | 说明 |
| --- | --- |
| `from_x` / `from_y` / `to_x` / `to_y` | 限定搜索区域的比例坐标（0–1），**四个必须同时给出**才会裁剪 |
| `confidence` | 本次匹配的置信度阈值（0–1），为 `None` 时使用全局设置 |
| `trace` | 未匹配时是否输出 `trace` 日志，默认 `True` |

返回的 `Box` 使用窗口客户区坐标，可直接交给 `click_box`；`Box.source` 记录命中的模板路径，便于排查。

## 置信度

默认阈值来自设置项 `General.templateMatchConfidence`（默认 `0.9`，范围 0–1，越高越严格），
也可以给单次调用传入 `confidence` 覆盖：

```python
box = operator.locate(IMG.ENTER, confidence=0.8)
```

- 阈值过高：轻微的光效、抗锯齿差异就会导致「找不到」；
- 阈值过低：容易匹配到形状相近的其他元素，造成误点。

任务失败时 `BaseTask.on_failed` 会对阈值给出提示：`> 0.9` 偏高、`< 0.7` 偏低。

## 示例

### 定位并点击

```python
from tasks.img import IMG

box = operator.locate(IMG.ENTER)
if box is not None:
    operator.click_box(box)
else:
    logger.info("没有找到进入按钮")
```

### 等待界面切换

```python
box = operator.wait_img(IMG.ENTER, timeout=30)
if box is None:
    raise RuntimeError("等待主界面超时")
```

### 在多个候选中选一个

`locate_any` 只截一次图，适合同一界面的多个可能状态：

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

### 限定搜索区域

在固定面板内搜索可以显著降低误匹配与耗时：

```python
box = operator.locate(IMG.Q, from_x=0.7, from_y=0.0, to_x=1.0, to_y=0.15)
```

### 反复点击直到元素消失

`click_img` 的 `retry` 用于「点击后界面有延迟」的场景：
每次点击后把鼠标移开、等待 `retry_interval`，再检测模板是否仍然存在。

```python
operator.click_img(RRIMG.DAILY_REWARD, retry=3, retry_interval=1)
```

## 模板图片

模板统一存放在 `resources/img/` 下，按用途分目录（`sg`、`tp`、`receive_rewards` 等），
并在 [tasks/img.py](https://github.com/Shasnow/StarRailAssistant/blob/main/tasks/img.py) 中以常量引用：

```python
from tasks.img import IMG, RRIMG

box = operator.locate(RRIMG.DAILY_REWARD)
```

:::caution
不要在业务代码里直接写 `resources/img/...` 字符串。路径是相对**工作目录**解析的，
统一用 `tasks/img.py` 中的常量既避免拼错，也方便后续调整目录结构。
:::

### 制作建议

- **在同一分辨率下截取**：从 1920×1080 客户区的游戏截图中裁剪，不要缩放；
- **保留独有特征**：只截按钮图标或文字等不易重复的部分，避免大块纯色背景；
- **避开动态内容**：倒计时、数字、光效、角色立绘会变化，尽量不纳入模板；
- **避开状态差异**：选中/未选中、可点击/置灰往往外观不同，必要时拆成两张模板；
- **尺寸适中**：过小容易误匹配，过大则任何局部变化都会拉低相似度；
- **保存为 PNG**：保持无损；避免透明边缘，透明区域参与比较会降低匹配稳定性；
- **随版本更新**：游戏 UI 改版后需要重新截取模板（源码中如 `gift_of_odyssey` 的注释也提醒了这一点）。

## 与其他识别方式的选择

| 场景 | 推荐方式 |
| --- | --- |
| 图标、按钮、固定图形 | 模板匹配 |
| 会变化的文本、按钮文字 | OCR（`ocr_match` / `wait_ocr`） |
| 血条、进度条、纯色标记 | 颜色检测（`detect_color` / `wait_color`） |
| 普通矩形边框、列表项 | 矩形检测（`rectangle_detect`） |

## 注意事项

- **每次调用都会截图**：`locate` 匹配成功后还会等待 0.5 秒；`wait_img` 每次轮询都会重新截图，
  实际间隔约为 `interval` 加上内部等待，密集调用时注意耗时。
- **`locate_any` 只截一次图**：多模板场景优先用它，避免为每个模板重复截图。
- **模板文件缺失**：`locate` / `locate_all` 会捕获异常并返回 `None`（原因记录在 `trace` 日志中）；
  `locate_any` 则会直接抛出 `FileNotFoundError`，因此务必确认 `tasks/img.py` 指向的图片存在。
- **可能命中多个重叠结果**：`locate_all` 返回的是所有高于阈值的像素位置，同一目标常出现多个相邻结果，
  可用 `Box.center` 与 `Box.distance` 按距离去重。
- **模板与目标必须 1:1**：窗口缩放、UI 缩放、云游戏视口尺寸变化都会导致匹配失败，
  这是优先使用比例坐标、并保持 1920×1080 的原因。
