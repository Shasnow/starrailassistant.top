---
title: 鼠标操作
description: SRA 中的点击、移动、拖拽与滚轮操作
sidebar:
  order: 9
---

SRA 的鼠标操作统一由 `IOperator` 提供，本地实现（PyAutoGUI + Win32）与云游戏实现（Selenium）接口一致。
任务与扩展只需按窗口坐标调用，无需关心系统光标或浏览器指针的细节。

本文介绍各个鼠标方法、坐标与偏移规则、两种实现的差异以及常见用法。

## 坐标约定

鼠标方法遵循统一规则（详见[窗口与窗口上下文](/reference/sracore/window-context/)）：

| 写法 | 含义 |
| --- | --- |
| `int` | 窗口客户区内的像素坐标 |
| `float` | 相对窗口宽高的比例（0–1） |

`x` 与 `y` **必须同为 `int` 或同为 `float`**，混用会抛 `ValueError`。
偏移量 `x_offset` / `y_offset` 同样按类型解释：`int` 为像素、`float` 为窗口比例，可以只给一个方向传比例。

从 JSON 或配置读入坐标、无法区分 `1` 与 `1.0` 时，用 `click_point` 的 `mode` 参数强制指定：

- `auto`（默认）：按类型推断；
- `abs`：强制按像素；
- `rel`：强制按窗口比例。

## 常用方法

| 方法 | 返回 | 说明 |
| --- | --- | --- |
| `click_point(x, y, ...)` | `bool` | 点击指定坐标 |
| `click_box(box, ...)` | `bool` | 点击 `Box` 中心（可带偏移） |
| `click_img(template, ...)` | `bool` | 识别模板并点击其中心，可重试直到消失 |
| `move_to(x, y, duration=0)` | `bool` | 将鼠标移动到指定位置 |
| `move_rel(x_offset, y_offset)` | `bool` | 相对当前位置移动（单位：像素） |
| `mouse_down(x, y, button="left")` | `bool` | 按下鼠标键 |
| `mouse_up(x, y, button="left")` | `bool` | 释放鼠标键（`x` / `y` 可为 `None`） |
| `scroll(clicks, x=None, y=None)` | `bool` | 滚轮滚动，正数向上、负数向下 |
| `drag_to(from_x, from_y, to_x, to_y, duration=0.5)` | `bool` | 从起点拖拽到终点 |

### click_point

```python
operator.click_point(0.5, 0.5)                  # 点击窗口中心
operator.click_point(960, 540)                  # 点击客户区像素 (960, 540)
operator.click_point(0.9, 0.1, after_sleep=1)   # 点击后等待 1 秒
operator.click_point(0.5, 0.5, y_offset=-0.02)  # 向上偏移 2% 窗口高度
```

参数：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `x_offset` / `y_offset` | `0` | 像素或比例偏移 |
| `after_sleep` | `0` | 点击后等待秒数，用于等待界面响应 |
| `tag` | `""` | 日志标记，便于定位是哪一次点击 |
| `trace` | `True` | 是否输出调试日志 |
| `mode` | `"auto"` | `auto` / `abs` / `rel` |

### click_box 与 click_img

`click_box` 取 `Box.center` 调用 `click_point`，适合配合识图结果使用：

```python
from tasks.img import IMG, RRIMG

box = operator.wait_img(IMG.ENTER, timeout=30)
if box is not None:
    operator.click_box(box, y_offset=-10)
```

`click_img` 是「识别 + 点击」的快捷方式，`retry` 用于点击后界面有延迟的场景：
每次点击后把鼠标移到窗口左上角再重新检测，模板消失即视为生效。

```python
operator.click_img(RRIMG.DAILY_REWARD, retry=3, retry_interval=1)
```

- 首次就找不到模板时返回 `False`；
- 点击过至少一次后模板消失则返回 `True`；
- `retry=0` 表示只点击一次。

### 移动

- `move_to`：绝对移动，`duration` 控制本地实现的平滑移动时长（云游戏实现忽略该参数）；
- `move_rel`：相对移动，本地实现使用 Win32 `SendInput` 注入相对位移，
  适合需要「转动视角」的场景（例如按半个窗口宽度转身），因为它不依赖窗口绝对位置。

```python
operator.move_rel(operator.window_context.width // 2, 0)  # 向右转半屏
```

### 按下与释放

`mouse_down` / `mouse_up` 用于需要「长按」的交互，例如拖拽前的固定、蓄力操作。
`button` 支持 `left` / `middle` / `right`，传入其他值会直接返回 `False` 并记录日志。

:::caution
`mouse_up` 的 `x` / `y` 仅用于接口一致性，两种实现都**在当前位置释放**，不会移动到指定坐标。
需要「移动到某点再释放」时请显式调用 `move_to`。
:::

### 拖拽

`drag_to` 依次执行 `mouse_down(起点)` → `move_to(终点)` → `mouse_up()`，`duration` 为移动过程时长：

```python
operator.drag_to(0.3, 0.5, 0.7, 0.5, duration=0.8)
```

### 滚轮

```python
operator.scroll(-5)   # 在当前位置向下滚动 5 格
operator.scroll(3)    # 在当前位置向上滚动 3 格
```

:::caution
本地实现的 `scroll` 直接调用 `pyautogui.scroll(clicks, x, y)`，
传入的 `x` / `y` 是**屏幕绝对坐标**，不是窗口相对坐标，也不会自动加上窗口偏移。
在窗口化、多显示器环境下需要滚动时，建议不传坐标（使用当前鼠标位置），
或先显式 `move_to` 再调用 `scroll`。
:::

## 两种实现的差异

| 行为 | 本地（`Operator`） | 云游戏（`BrowserOperator`） |
| --- | --- | --- |
| 底层方式 | PyAutoGUI / Win32 `SendInput` | Selenium ActionBuilder / ActionChains |
| 系统光标 | 会被真实移动 | 仅模拟页面指针，不影响系统光标 |
| 每次点击耗时 | 取决于 `after_sleep` | 额外固定等待约 0.2 秒 |
| `move_to` 的 `duration` | 生效，平滑移动 | 忽略 |
| `scroll` 的 `x` / `y` | 屏幕绝对坐标 | 视为窗口坐标，先 `move_to` 再滚动 |
| 窗口未激活 | 点击可能落到其他窗口 | 不存在该问题 |

:::tip
PyAutoGUI 的角落保护（FAILSAFE）在 SRA 中被关闭，
因此把鼠标移到屏幕角落不会触发 `FailSafeException`，但也失去了「甩到角落急停」的逃生手段。
需要中止时请使用停止快捷键（默认 `F9`）或 `task stop`。
:::

## 实践建议

- **点击后留出等待时间**：优先用 `after_sleep`，而不是在调用方裸写 `sleep`，日志更集中；
- **优先使用比例坐标**：同一套代码才能在本地与云游戏之间通用；
- **避免坐标混用**：`int` 与 `float` 成对出现，偏移量按需单独使用比例；
- **点击前先确认目标出现**：用 `wait_img` / `wait_ocr` 拿到 `Box` 再 `click_box`，
  比硬编码坐标稳定得多；
- **视角旋转用 `move_rel`**：相对位移不依赖窗口位置，也不会把光标甩到屏幕边缘；
- **拖拽注意时长**：`duration` 过短可能被游戏判定为点击，过长则影响效率，通常取 0.5–1 秒。

## 注意事项

- **停止信号**：所有鼠标方法在 `stop_event` 置位后抛出 `ThreadStoppedError`，不会继续执行；
- **失败返回布尔值**：本地实现捕获异常并返回 `False`，同时输出调试日志；
  但参数类型错误会直接抛 `ValueError`；
- **窗口最小化**：本地实现无法在最小化窗口上点击，识别类调用会先抛 `RuntimeError`；
- **`drag_to` 不校验中间结果**：它按顺序调用三个方法后返回 `True`，
  需要严格判断时请手动组合 `mouse_down` / `move_to` / `mouse_up` 并检查每一步的返回值。
