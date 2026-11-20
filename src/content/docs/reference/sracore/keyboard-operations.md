---
title: 键盘操作
description: SRA 中的按键、长按与剪贴板操作
sidebar:
  order: 10
---

键盘操作由 `IOperator` 统一提供，本地实现基于 PyAutoGUI，云游戏实现基于 Selenium ActionChains。
打开界面、确认对话、角色移动、战斗技能都依赖这些方法。

本文介绍按键名称写法、各方法的参数、快捷键设置与两种实现的差异。

## 常用方法

| 方法 | 返回 | 说明 |
| --- | --- | --- |
| `press_key(key, presses=1, interval=0, wait=0)` | `bool` | 按下按键，可重复多次；含 `+` 时按组合键处理 |
| `hold_key(key, duration=0)` | `bool` | 按住一段时间后释放，`duration=0` 表示按下后立即抬起 |
| `key_down(key)` | `bool` | 按下并保持，与 `key_up` 配对 |
| `key_up(key)` | `bool` | 抬起按键，组合键按反序释放 |
| `copy(text)` | `None` | 把文本写入剪贴板 |
| `paste()` | `None` | 在焦点处粘贴剪贴板内容 |

共同参数 `trace` 控制是否输出调试日志，默认 `True`。

## 按键名称

- **普通字符**：直接写字符本身，如 `"a"`、`"1"`、`"f"`；
- **特殊键**：使用小写英文名，如 `esc`、`enter`、`space`、`tab`、`capslock`、`shift`、`ctrl`、`alt`、
  `up` / `down` / `left` / `right`、`f1`–`f12`、`pageup` / `pagedown`、`home` / `end`、`delete`；
- **组合键**：用 `+` 连接，如 `"ctrl+c"`、`"ctrl+shift+s"`。

:::tip
设置中的快捷键（如 `keybindings.f4`）保存为大写 `F4`，而 PyAutoGUI 的按键名是小写，
因此任务中会统一转成小写再发送：`operator.press_key(self.settings.General.hotkeyF4.lower())`。
:::

## press_key

```python
operator.press_key("esc")                        # 按一次 ESC
operator.press_key("esc", presses=2, interval=1) # 连按两次，间隔 1 秒
operator.press_key("ctrl+shift+s")               # 组合键
operator.press_key("f4", wait=0.5)               # 首次按键前等待 0.5 秒
```

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `presses` | `1` | 按下次数 |
| `interval` | `0` | **每次按键后**的等待时间（包含最后一次） |
| `wait` | `0` | 首次按键前的等待时间，常用于等待界面动画 |

实现上：

- 单个按键调用 `pyautogui.press` / Selenium 的按下+抬起；
- 含 `+` 的组合键调用 `pyautogui.hotkey`，按顺序按下后反序抬起，避免修饰键残留。

## 长按与按下/释放

### hold_key

用于持续按键，例如角色移动：

```python
operator.hold_key("w", 1.5)   # 前进 1.5 秒
operator.hold_key("shift", 3) # 按住冲刺
```

`duration=0` 时等价于一次快速按下并抬起，通常没有意义，需要单次输入请用 `press_key`。

### key_down / key_up

需要精确控制开始与结束时间（例如边走边检测）时，手动配对使用：

```python
operator.key_down("w")
try:
    # ... 期间可以检测画面或执行其他操作
    operator.sleep(1)
finally:
    operator.key_up("w")
```

:::caution
`key_down` 不会自动抬起。异常路径中若忘记 `key_up`，按键会一直保持按下状态，
导致后续操作异常（角色持续移动）。请配合 `try/finally` 使用。
:::

## 剪贴板

| 方法 | 本地实现 | 云游戏实现 |
| --- | --- | --- |
| `copy(text)` | `pyperclip` 写入系统剪贴板 | 保存到 `BrowserOperator.clipboard` |
| `paste()` | 模拟 `ctrl+v` | 通过 Selenium 发送保存的字符串 |

典型用法是先 `copy` 再聚焦输入框 `paste`，避免逐字输入受输入法影响：

```python
operator.copy("兑换码内容")
operator.click_point(0.5, 0.5)  # 先聚焦输入框
operator.paste()
operator.press_key("enter")
```

## 快捷键设置

游戏内快捷键来自设置项 `General`：

| 配置键 | 默认值 | 用途 |
| --- | --- | --- |
| `keybindings.e` | `E` | 施放秘技 |
| `keybindings.f1` | `F1` | 打开活动界面 |
| `keybindings.f2` | `F2` | 打开纪行界面 |
| `keybindings.f3` | `F3` | 打开卡池界面 |
| `keybindings.f4` | `F4` | 打开指南界面 |
| `keybindings.stop` | `F9` | 全局停止任务 |

前五项由任务通过 `press_key` 发送；`keybindings.stop` 由 SRA 的全局键盘监听（pynput）捕获，
按下后请求停止当前任务与扩展，与操作器的按键发送互不影响。

## 两种实现的差异

| 行为 | 本地（`Operator`） | 云游戏（`BrowserOperator`） |
| --- | --- | --- |
| 底层方式 | PyAutoGUI | Selenium `ActionChains` |
| 特殊键转换 | PyAutoGUI 原生按键名 | 仅 `esc` → `Keys.ESCAPE`、`f*` → 功能键常量，其余按原字符串处理 |
| 生效目标 | 系统当前焦点窗口（游戏需在前台） | 浏览器页面 |
| 剪贴板 | 系统剪贴板 | 实例内部字符串 |

由于特殊键转换存在差异，编写跨实现通用的代码时，优先使用**单字符**与 `esc`、`f1`–`f12`；
其他特殊键名在云游戏实现下可能不会按预期生效。

## 注意事项

- **本地按键需要游戏在前台**：PyAutoGUI 发送到系统焦点窗口，游戏被遮挡或最小化时按键会落到其他程序；
- **组合键不要留空格**：`"ctrl+c"` 正确，`"ctrl + c"` 会被当作三个按键；
- **`interval` 也作用于最后一次**：连按时总耗时为 `presses × interval`，注意与界面动画配合；
- **停止信号**：`press_key` / `hold_key` / `key_down` / `key_up` / `paste` 在 `stop_event` 置位后抛出 `ThreadStoppedError`；
- **失败返回布尔值**：实现内部捕获异常并返回 `False`，可结合返回值和调试日志判断是否成功。
