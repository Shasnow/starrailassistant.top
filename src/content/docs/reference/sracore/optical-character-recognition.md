---
title: "光学字符识别(OCR)"
description: "SRA 中的光学字符识别功能"
sidebar:
  order: 3
---

OCR 用于识别画面中的文字，适合定位会变化的文本，或直接按文案判断按钮与界面状态。
SRA 使用 [RapidOCR](https://github.com/RapidAI/RapidOCR) 作为识别引擎，本地游戏与云游戏共用同一套接口。

本文介绍 OCR 的识别流程、常用 API、匹配器、置信度与调试方式。

## 引擎与初始化

OCR 引擎由 `OperatorFactory.get_ocr_instance()` 创建，进程内只初始化一次，供所有 Operator 共享：

- 若存在 `rapidocr/config.yaml`，会作为引擎配置加载，否则使用 RapidOCR 默认配置；
- 日志级别固定为 `error`，避免引擎输出干扰 SRA 日志；
- 首次使用会加载识别模型（缺失时由 RapidOCR 自动下载），因此第一次调用可能较慢且需要网络。

:::caution
RapidOCR 依赖 ONNX Runtime，需要 Microsoft Visual C++ 2015-2022 运行库（x64）。
初始化失败时 SRA 会输出具体的缺失 DLL 或环境信息，而不会只抛出原始堆栈。
:::

## 识别流程

`IOperator.ocr()` 的流程：

1. 截取窗口（可限定区域）；
2. `grayscale=True`（默认）时把截图转为灰度图；
3. 调用引擎，启用检测（`use_det`）与识别（`use_rec`），关闭方向分类（`use_cls`）；
4. 按置信度过滤，低于阈值的文本行被丢弃；
5. 开发者模式下可选保存标注图，见[调试](#调试)。

引擎以「文本行」为单位输出，因此一段多行文字会得到多条结果。

## 常用 API

| 方法 | 返回 | 说明 |
| --- | --- | --- |
| `ocr(...)` | `list[tuple[points, text, score]] \| None` | 原始识别结果，每项为四点多边形坐标、文本与置信度 |
| `ocr_boxes(...)` | `list[Box] \| None` | 同上，但转换为窗口坐标的 `Box`，`source` 为识别文本 |
| `ocr_match(text, ...)` | `Box \| None` | 匹配指定文本，返回第一条命中的位置 |
| `ocr_match_any(texts, ...)` | `tuple[int, Box \| None]` | 匹配多个文本，返回命中的索引与位置 |
| `wait_ocr(text, ...)` | `Box \| None` | 轮询等待文本出现 |
| `wait_ocr_any(texts, ...)` | `tuple[int, Box \| None]` | 轮询等待任意文本出现 |

共同参数：

| 参数 | 说明 |
| --- | --- |
| `from_x` / `from_y` / `to_x` / `to_y` | 识别区域的比例坐标（0–1），**四个必须同时给出**才会裁剪 |
| `confidence` | 置信度阈值（0–1），为 `None` 时使用全局设置 |
| `trace` | 是否输出调试日志，默认 `True` |

`ocr_boxes` / `ocr_match` 返回的 `Box` 已换算回窗口客户区坐标，可直接交给 `click_box`，
无需再关心裁剪偏移。通常优先使用这两个方法，而不是直接处理 `ocr()` 的原始结果。

## 文本匹配

`ocr_match` / `ocr_match_any` 的 `text` 参数可以是字符串，也可以是 `StrMatcher` 实例。
传入字符串时默认按**包含关系**匹配（`ContainsMatcher`）。

| 匹配器 | 行为 |
| --- | --- |
| `ContainsMatcher(value)` | 归一化后判断 `value in text`，即子串匹配 |
| `EqualsMatcher(value)` | 归一化后完全相等 |
| `RegexMatcher(pattern)` | 正则搜索（`re.search`），不做全角/半角归一化 |

`ContainsMatcher` 与 `EqualsMatcher` 会先做 NFKC 归一化，把全角字符转成半角，
避免 OCR 对全角/半角识别不稳定导致的漏匹配。

```python
from SRACore.util.strutil import EqualsMatcher, RegexMatcher

# 默认：包含匹配
box = operator.ocr_match("开拓")

# 完全相等，避免「开拓」误命中「开拓等级」
box = operator.ocr_match(EqualsMatcher("开拓"))

# 正则：匹配类似「剩余 12 次」的数字
box = operator.ocr_match(RegexMatcher(r"剩余\s*\d+\s*次"))
```

:::tip
`ocr_match_any` 按传入列表的顺序返回**第一个**命中的文本索引，而不是按画面中的位置顺序；
列表顺序即优先级，可用于区分「点击」/「取消」等互斥按钮。
:::

## 置信度

默认阈值来自设置项 `General.ocrMatchConfidence`（默认 `0.7`，范围 0–1，越高越严格），
可以为单次调用传入 `confidence` 覆盖：

```python
box = operator.ocr_match("开始挑战", confidence=0.85)
```

- 阈值过低：模糊、残影、相近字形更容易被误识别；
- 阈值过高：小字、低对比度或半透明遮罩下的文字会被过滤掉。

OCR 的置信度与模板匹配的 `templateMatchConfidence` 相互独立，调整时注意不要混淆。

## 示例

### 识别并点击按钮

```python
box = operator.wait_ocr("开始挑战", timeout=15)
if box is not None:
    operator.click_box(box)
else:
    logger.info("没有找到开始挑战按钮")
```

### 等待多个界面状态

```python
index, box = operator.wait_ocr_any(["委托完成", "受到攻击"], timeout=30)
match index:
    case 0:
        operator.click_box(box)
    case 1:
        logger.warning("角色受到攻击，检查队伍配置")
```

### 限定识别区域

只识别面板标题区域，可以减少误匹配、降低耗时：

```python
box = operator.ocr_match(
    "背包",
    from_x=0.05, from_y=0.03, to_x=0.1, to_y=0.08,
)
```

### 直接处理原始结果

需要一次拿到全部文本时使用 `ocr_boxes`：

```python
boxes = operator.ocr_boxes()
if boxes:
    for box in boxes:
        logger.debug(f"{box.source} @ {box.center}")
```

## 调试

将操作器的 `self.is_save_ocr_image` 设置为 `True`，或在设置中开启开发者模式（`Advanced.developerMode.enabled`）与保存 OCR 截图
（`Advanced.developerMode.saveOcrImage`）后，每次识别都会把标注图保存到 `log/ocr/`：

- 绿框为识别到的文本区域；
- 文本与置信度绘制在框上方；
- 文件名使用纳秒时间戳，按时间对应日志中的识别结果。

`ocr()` 在 `trace=True` 时还会输出完整识别结果，可结合日志定位「识别到了但没匹配上」的问题。

## 与其他识别方式的选择

| 场景 | 推荐方式 |
| --- | --- |
| 会变化的文本、按钮文案 | OCR |
| 图标、固定图形按钮 | 模板匹配 |
| 血条、进度条、纯色标记 | 颜色检测 |
| 普通矩形边框、列表项 | 矩形检测 |

## 注意事项

- **每次调用都会截图**：`wait_ocr` / `wait_ocr_any` 的轮询同样逐次截图，实际间隔大于 `interval`，
  缩小识别区域能显著缩短耗时。
- **未识别到不等于出错**：`ocr()` 在有文本但全部低于阈值时返回空列表，异常时返回 `None`；
  `ocr_boxes` 在这两种情况下均返回 `None`，`ocr_match` 返回 `None`。
- **文字行会被切分**：同一句文案可能被拆成多行，匹配短字符串时容易被其他行误命中，必要时用 `RegexMatcher` 收紧。
- **分辨率与字体渲染**：OCR 同样依赖 1920×1080 客户区与稳定的字体渲染，
  极端缩放的云游戏视口可能导致识别率下降。
- **模型首次下载**：离线环境下需要预先准备 RapidOCR 模型，否则首次调用会失败。
