---
title: 事件监听器
description: SRA 中的全局键盘事件监听与热键注册
sidebar:
  order: 11
---

`KeyboardListener` 是 SRA 的全局键盘监听器，基于 [pynput](https://github.com/moses-palmer/pynput)，
用于在不占用游戏焦点的情况下响应热键：全局停止、扩展的暂停/重置等。

本文介绍监听器的生命周期、按键注册规则、线程模型以及扩展中的使用方式。

## 设计约束

监听器位于 `SRACore/runtime/event_listener.py`，有两条重要约定：

- **单实例**：由宿主（`AppContext`）创建、启动并注入给需要的组件，其他地方不应再实例化；
- **职责分离**：宿主负责线程的创建与销毁，使用方只注册/注销按键回调，
  不调用 `start()` / `stop()`。

```python
from SRACore.runtime import KeyboardListener

listener = KeyboardListener()
```

## API

| 方法 | 说明 |
| --- | --- |
| `register_key_event(key, callback, args=None)` | 注册按键按下事件；同一按键重复注册抛 `ValueError` |
| `unregister_key_event(key)` | 注销按键事件；不存在时静默返回 |
| `start()` | 启动后台监听线程，幂等（已在运行则直接返回） |
| `stop()` | 请求退出并等待监听线程结束（最多 1 秒） |

回调统一以 `callback(args)` 的形式调用，未传 `args` 时为 `None`，因此函数需要能接收一个参数：

```python
listener.register_key_event("f8", lambda _: logger.info("暂停"))
listener.register_key_event("f10", my_handler, args=("重置", 1))
```

## 按键名称

按键字符串由 pynput 的事件转换得到：

- **普通按键**：取字符本身，如 `a`、`1`、`/`；
- **特殊按键**：取 pynput 枚举名的小写形式，如 `enter`、`ctrl`、`shift`、`space`、`esc`、`f8`。

注册时统一使用**小写**。监听器按按键名精确查表，`F8` 与 `f8` 不会匹配。

:::caution
监听器只支持**单个按键**，不支持 `ctrl+f8` 这类组合键：按下组合键时只会触发修饰键自身的回调。
:::

## 线程模型

- 监听循环运行在 pynput 的低级键盘钩子线程中；
- 命中注册表后，回调会被放到**独立守护线程**执行，
  避免耗时操作（例如停止任务时的 `join`）阻塞整个系统输入管道；
- 回调抛出的异常会被捕获并以 `ERROR` 记录，不会中断监听；
- 内置防抖：按下时触发一次并标记，抬起后重置，因此长按不会连续触发。

```python
def _on_press(self, key):
    # 只记录，不做耗时操作
    ...
```

## 宿主中的使用

`AppContext._create_event_listener()` 在初始化时创建监听器，并注册全局停止热键：

```python
stop_hotkey = settings.General.hotkeyStop.lower() or "f9"
listener = KeyboardListener()
listener.register_key_event(stop_hotkey, lambda _: self.request_stop_all())
listener.start()
```

要点：

- 热键来自设置项 `keybindings.stop`，默认 `F9`；
- `request_stop_all()` 会同时请求停止任务与扩展（两者共享工作线程）；
- pynput 未安装或启动失败时返回 `None`，仅记录警告，SRA 其余功能不受影响；
- `AppContext.shutdown()` 会调用 `listener.stop()`，不要另外管理监听线程。

## 扩展中的使用

`BaseExtension` 会把宿主监听器注入到 `self.event_listener`（可能为 `None`）：

```python
class MyExtension(BaseExtension[MyConfig]):
    def run(self) -> bool:
        if self.event_listener is None:
            logger.warning("未注入全局事件监听器，热键不可用")
        else:
            self.event_listener.register_key_event("f8", self._on_pause, None)
        try:
            ...
        finally:
            if self.event_listener is not None:
                self.event_listener.unregister_key_event("f8")
        return True

    def _on_pause(self, _args) -> None:
        ...
```

自动演奏扩展就是按这个模式实现的：演奏前注册暂停/重置热键，结束后在 `finally` 中注销。

:::caution
- **必须注销**：扩展结束后不注销会一直占用该按键，之后再注册同一按键会抛 `ValueError`；
- **不要调用 `start()` / `stop()`**：监听线程归宿主所有，扩展结束只是本次运行结束，不代表 SRA 退出；
- **注意与输入冲突**：全局监听会收到包括 SRA 自己通过 `press_key` 注入的按键。
  如果注册的热键与游戏按键相同，自动化操作本身也会触发回调（自动演奏扩展会对此给出警告）。
:::

## 注意事项

- **大小写与字符**：普通按键取 `key.char`，按住 `Shift` 时得到的是大写字母，因此注册小写最稳妥；
- **回调要轻量**：回调虽然运行在独立线程，但过于频繁的耗时操作仍会影响播放与任务节奏；
- **无组合键**：需要组合键语义时，请自行记录修饰键状态或改用其他方案；
- **平台**：SRA 整体仅支持 Windows，监听器在 Windows 上通过 pynput 的低级钩子工作，
  可能需要以管理员权限运行才能接收到提权窗口的按键。
