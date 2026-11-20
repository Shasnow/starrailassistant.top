---
title: 窗口与窗口上下文
description: SRA 中的窗口定位与管理
sidebar:
  order: 1
---

SRA 的所有识别与操作都发生在「目标窗口」内。为了在本地游戏窗口与云游戏网页之间共用同一套逻辑，
SRA 用 `WindowContext` 描述窗口的位置、尺寸与标识，由 Operator 统一维护，任务与扩展只关心相对窗口的坐标。

本文介绍窗口的定位方式、坐标系约定、整屏模式与截图行为。

## WindowContext

`WindowContext` 定义在 `SRACore/operators/model.py`，是一个普通的 dataclass：

| 字段           | 类型   | 默认值            | 说明                                                |
| -------------- | ------ | ----------------- | --------------------------------------------------- |
| `top`          | `int`  | `0`               | 目标区域左上角的屏幕 Y 坐标（由 SRA 自动刷新）      |
| `left`         | `int`  | `0`               | 目标区域左上角的屏幕 X 坐标（由 SRA 自动刷新）      |
| `width`        | `int`  | `0`               | 目标区域宽度（像素）                                |
| `height`       | `int`  | `0`               | 目标区域高度（像素）                                |
| `window_title` | `str`  | `崩坏：星穹铁道`  | 目标窗口标题，用于查找窗口                          |
| `executable`   | `str`  | `StarRail.exe`    | 目标进程名，用于启动与结束游戏                      |
| `full_screen`  | `bool` | `False`           | 整屏操作模式：忽略窗口，以整个屏幕为操作区域        |

`top` / `left` / `width` / `height` 不需要手动填写：每次截图前 SRA 都会重新读取窗口客户区的实际位置与尺寸并写回，
因此窗口被拖动、缩放后仍能正确定位。

:::tip
`OperatorFactory` 在进程内只创建一个 `WindowContext` 并传给所有 Operator 实例，
因此任务、扩展拿到的窗口信息始终是同一份，不存在各自缓存导致的不一致。
:::

:::tip
你可以通过更改 `window_title` 和 `executable` 来适配其他游戏或应用程序的窗口。
:::

## 坐标系

Operator 的所有坐标参数（`click_point`、`move_to`、`mouse_down`、`drag_to` 等）遵循统一规则：

| 写法    | 含义                                           | 示例                                   |
| ------- | ---------------------------------------------- | -------------------------------------- |
| `int`   | 窗口客户区内的像素坐标（原点为客户区左上角）   | `click_point(960, 540)`                |
| `float` | 相对窗口宽高的比例（0–1）                      | `click_point(0.5, 0.5)`                |

偏移量 `x_offset` / `y_offset` 同样按类型解释：`int` 为像素，`float` 为窗口比例，因此可以只对单个方向使用比例。

`click_point` 还提供 `mode` 参数以强制指定解释方式，适合从 JSON / 配置读入坐标、无法区分 `1` 与 `1.0` 的场景：

- `auto`（默认）：按参数类型推断；
- `abs`：强制按像素；
- `rel`：强制按窗口比例。

识别类方法（`locate`、`ocr_boxes`、`detect_color` 等）返回的 `Box` 同样是客户区坐标，
可直接交给 `click_box` 使用，无需再换算。

## 窗口的查找与刷新

本地实现（`Operator`）通过 `pygetwindow` 按 `window_title` 查找窗口，行为如下：

- 标题需与 `window_title` **完全一致**（忽略首尾空格），避免误匹配到标题相近的其他窗口；
- 句柄会被缓存，每次使用前用 `IsWindow` 校验，句柄失效（例如游戏重启）时自动重新查找；
- 找不到窗口时句柄为 `0`，`hwnd` 属性返回 `0`；云游戏等无窗口实现固定返回 `0`。

`is_window_active()` / `active_window()` 用于判断与切换前台窗口。
`active_window()` 会先模拟按一次 `ctrl`，让系统将该操作视为用户输入，从而允许 `SetForegroundWindow` 生效。

```python
from SRACore.operators.factory import OperatorFactory

operator = OperatorFactory.get_operator()
operator.window_context.window_title = "崩坏：星穹铁道"

if not operator.is_window_active():
    operator.active_window()  # 切换到游戏窗口
```

## 获取窗口区域

`Operator.get_win_region(active_window=True)` 返回当前操作区域 `Region`：

- `active_window=True`（默认）：先把窗口切到前台，再读取**客户区**（不含标题栏与边框）的屏幕坐标；
- `active_window=False`：不激活窗口，仅刷新句柄，配合后台截图使用。

读取失败时抛出 `RuntimeError` 并给出原因，常见于：

- 游戏未启动：句柄为 `0`；
- 窗口被最小化：客户区宽或高为 `0`。

:::caution
SRA 按客户区（`GetClientRect` + `ClientToScreen`）定位，而不是窗口外框。
因此模板图片与识别结果都不受标题栏、边框和窗口装饰影响，但也意味着窗口客户区必须保持 1920×1080。
:::

## 整屏操作模式

将 `full_screen` 置为 `True`（通常通过 `set_window_context(full_screen=True)`）后：

- 操作区域退化为整个屏幕，`left` / `top` 归零，`width` / `height` 取屏幕尺寸；
- 比例坐标按整屏而非窗口计算；
- 截图强制走屏幕抓取，因为后台截图只能拿到窗口自身的内容。

该模式适合独占全屏、无法按窗口定位的场景；窗口化运行时保持默认值 `False` 即可。

```python
operator.set_window_context(
    window_title="崩坏：星穹铁道",
    executable="StarRail.exe",
    full_screen=False,
)
```

`set_window_context` 只覆盖传入的参数，其余字段保留原值。注意参数为 `None` 或假值（如 `False`、空字符串）时同样保留原值，
因此无法用它把已开启的整屏模式改回 `False`，需要直接修改 `operator.window_context.full_screen`。

## 截图方式

截图方式由两个开关共同决定：调用参数 `background` 控制**是否激活窗口**，实例属性 `screenshot_background`
控制**采用哪种截图实现**。

| 开关                              | 作用                                                                   |
| --------------------------------- | ---------------------------------------------------------------------- |
| `background=True`（调用参数）     | 不激活窗口（`get_win_region(active_window=False)`），配合后台截图使用  |
| `screenshot_background=True`      | 默认值，本地实现使用 Win32 `PrintWindow`（`PW_CLIENTONLY` + `PW_RENDERFULLCONTENT`），可后台截取且不被遮挡 |
| `screenshot_background=False`     | 使用 `pyscreeze.screenshot(region=...)` 抓取屏幕，要求窗口可见且在前台 |

即默认配置（`screenshot_background=True`、窗口化）下始终走后台截图，截图不要求窗口在前台；
`StartGameTask` 会在登录阶段临时把 `screenshot_background` 设为 `False`，改用屏幕抓取获取登录界面。

此外：

- 整屏模式下始终使用屏幕抓取；
- 传入 `from_x` / `from_y` / `to_x` / `to_y` 时，在窗口客户区内按比例裁剪；
- `resize` 可缩放输出，`save_path` 可落盘；`jpeg_quality` 仅建议用于预览等体积敏感场景，
  OCR / 模板匹配等内部调用不要使用有损压缩。

## 分辨率要求

模板匹配依赖固定分辨率，SRA 要求游戏**客户区**为 **1920×1080**：

- 1080p 下可直接使用全屏；
- 更高分辨率的显示器可将游戏窗口化到 1920×1080。

任务失败时 `BaseTask.on_failed` 会检查 `window_context` 的宽高，若不符合要求会输出警告，
例如 `可能的失败原因：游戏分辨率不符合要求：1920x1080，当前：2560x1440。`

## 云游戏（BrowserOperator）

基于浏览器云游戏的实现使用同一套 `WindowContext`，差异如下：

- `type` 为 `"Browser"`，`hwnd` 固定为 `0`，`is_window_active()` 恒为 `True`；
- 启动时先设为 1920×1080，拿到驱动后以页面实际视口（`window.innerWidth` / `window.innerHeight`）
  为准更新宽高，避免浏览器边框、工具栏造成比例偏差；
- 无头模式通过 CDP 把渲染视口直接设为目标分辨率。

因此任务代码中尽量不要硬编码绝对像素坐标，优先使用比例坐标，才能在本地与云游戏之间通用。

## 相关类型

- `Region`：带 `parent` 的矩形区域，`sub_region()` 可在当前区域内按比例划分子区域；
- `Box`：识别结果矩形，提供 `center`（中心点）、`text` / `source`（来源，模板路径或 OCR 文本）与 `distance()`。

```python
from tasks.img import IMG

box = operator.wait_img(IMG.ENTER, timeout=30)
if box is not None:
    operator.click_box(box, y_offset=-10)  # 点击中心点上方 10 像素处
```
