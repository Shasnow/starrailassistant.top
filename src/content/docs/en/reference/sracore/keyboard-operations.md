---
title: Keyboard operations
description: Key presses, holds, and clipboard operations in SRA
sidebar:
  order: 10
---

Keyboard operations are provided uniformly by `IOperator`; the local implementation is based on PyAutoGUI, and the cloud gaming
implementation on Selenium ActionChains. Opening screens, confirming dialogue, character movement, and combat skills all depend on these methods.

This page covers key name syntax, the parameters of each method, hotkey settings, and the differences between the two implementations.

## Common methods

| Method | Returns | Description |
| --- | --- | --- |
| `press_key(key, presses=1, interval=0, wait=0)` | `bool` | Presses a key, optionally repeatedly; a key containing `+` is treated as a combination |
| `hold_key(key, duration=0)` | `bool` | Holds a key for a while and then releases it; `duration=0` means press and release immediately |
| `key_down(key)` | `bool` | Presses and holds; pair with `key_up` |
| `key_up(key)` | `bool` | Releases a key; combinations are released in reverse order |
| `copy(text)` | `None` | Writes text to the clipboard |
| `paste()` | `None` | Pastes the clipboard contents at the focus |

The common parameter `trace` controls whether debug logs are emitted; the default is `True`.

## Key names

- **Regular characters**: write the character itself, such as `"a"`, `"1"`, `"f"`;
- **Special keys**: use lowercase English names, such as `esc`, `enter`, `space`, `tab`, `capslock`, `shift`, `ctrl`, `alt`,
  `up` / `down` / `left` / `right`, `f1`–`f12`, `pageup` / `pagedown`, `home` / `end`, `delete`;
- **Combinations**: join with `+`, such as `"ctrl+c"`, `"ctrl+shift+s"`.

:::tip
Hotkeys in settings (such as `keybindings.f4`) are stored as uppercase `F4`, whereas PyAutoGUI key names are lowercase,
so tasks convert them to lowercase before sending: `operator.press_key(self.settings.General.hotkeyF4.lower())`.
:::

## press_key

```python
operator.press_key("esc")                        # press ESC once
operator.press_key("esc", presses=2, interval=1) # press twice, 1 second apart
operator.press_key("ctrl+shift+s")               # key combination
operator.press_key("f4", wait=0.5)               # wait 0.5 seconds before the first press
```

| Parameter | Default | Description |
| --- | --- | --- |
| `presses` | `1` | Number of presses |
| `interval` | `0` | Wait time **after each press** (including the last one) |
| `wait` | `0` | Wait time before the first press, commonly used to wait for UI animations |

Implementation-wise:

- A single key calls `pyautogui.press` / Selenium's press + release;
- A combination containing `+` calls `pyautogui.hotkey`: keys are pressed in order and released in reverse order, avoiding stuck modifier keys.

## Holding and press/release

### hold_key

For continuous key presses, such as character movement:

```python
operator.hold_key("w", 1.5)   # move forward for 1.5 seconds
operator.hold_key("shift", 3) # hold to sprint
```

With `duration=0` it is equivalent to a quick press and release, which is usually meaningless; use `press_key` for a single input.

### key_down / key_up

When you need precise control over the start and end times (for example, detecting while moving), pair them manually:

```python
operator.key_down("w")
try:
    # ... you can inspect the screen or do other work in the meantime
    operator.sleep(1)
finally:
    operator.key_up("w")
```

:::caution
`key_down` does not release automatically. If you forget `key_up` on an exception path, the key stays pressed,
which breaks subsequent operations (the character keeps moving). Use it with `try/finally`.
:::

## Clipboard

| Method | Local implementation | Cloud gaming implementation |
| --- | --- | --- |
| `copy(text)` | Writes the system clipboard via `pyperclip` | Stores it in `BrowserOperator.clipboard` |
| `paste()` | Simulates `ctrl+v` | Sends the stored string through Selenium |

The typical pattern is to `copy` first, then focus the input box and `paste`, avoiding character-by-character input affected by the IME:

```python
operator.copy("兑换码内容")
operator.click_point(0.5, 0.5)  # focus the input box first
operator.paste()
operator.press_key("enter")
```

## Hotkey settings

In-game hotkeys come from the `General` settings section:

| Config key | Default | Purpose |
| --- | --- | --- |
| `keybindings.e` | `E` | Cast Technique |
| `keybindings.f1` | `F1` | Open the Events screen |
| `keybindings.f2` | `F2` | Open the Nameless Honor screen |
| `keybindings.f3` | `F3` | Open the Warp screen |
| `keybindings.f4` | `F4` | Open the Guide screen |
| `keybindings.stop` | `F9` | Globally stop tasks |

The first five are sent by tasks through `press_key`; `keybindings.stop` is captured by SRA's global keyboard listener (pynput)
and, when pressed, requests stopping the current task and extension, independently of the operator's key sending.

## Differences between the two implementations

| Behavior | Local (`Operator`) | Cloud gaming (`BrowserOperator`) |
| --- | --- | --- |
| Underlying mechanism | PyAutoGUI | Selenium `ActionChains` |
| Special key mapping | PyAutoGUI's native key names | Only `esc` → `Keys.ESCAPE` and `f*` → function key constants; everything else is used as the raw string |
| Effective target | The system's currently focused window (the game must be in the foreground) | The browser page |
| Clipboard | System clipboard | A string inside the instance |

Because special key mapping differs, when writing code that works across implementations, prefer **single characters** and `esc`, `f1`–`f12`;
other special key names may not work as expected in the cloud gaming implementation.

## Caveats

- **Local key presses require the game in the foreground**: PyAutoGUI sends to the system's focused window, so when the game is covered or minimized, keys land in other programs;
- **Do not put spaces in combinations**: `"ctrl+c"` is correct; `"ctrl + c"` is treated as three separate keys;
- **`interval` also applies to the last press**: the total time for repeated presses is `presses × interval`; keep that in mind with UI animations;
- **Stop signal**: `press_key` / `hold_key` / `key_down` / `key_up` / `paste` raise `ThreadStoppedError` once `stop_event` is set;
- **Failures return a boolean**: the implementation catches exceptions and returns `False`; combine the return value with the debug log to judge whether it succeeded.
