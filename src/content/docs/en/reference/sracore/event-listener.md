---
title: Event listener
description: Global keyboard event listening and hotkey registration in SRA
sidebar:
  order: 11
---

`KeyboardListener` is SRA's global keyboard listener, built on [pynput](https://github.com/moses-palmer/pynput).
It responds to hotkeys without holding game focus: global stop, pausing/resetting extensions, and so on.

This page covers the listener's lifecycle, key registration rules, the thread model, and how it is used in extensions.

## Design constraints

The listener lives in `SRACore/runtime/event_listener.py` and has two important conventions:

- **Single instance**: the host (`AppContext`) creates it, starts it, and injects it into the components that need it; it should not be instantiated anywhere else;
- **Separation of responsibilities**: the host creates and destroys the thread; consumers only register/unregister key callbacks
  and do not call `start()` / `stop()`.

```python
from SRACore.runtime import KeyboardListener

listener = KeyboardListener()
```

## API

| Method | Description |
| --- | --- |
| `register_key_event(key, callback, args=None)` | Registers a key-press event; registering the same key again raises `ValueError` |
| `unregister_key_event(key)` | Unregisters a key event; returns silently when it does not exist |
| `start()` | Starts the background listener thread; idempotent (returns immediately if already running) |
| `stop()` | Requests exit and waits for the listener thread to finish (at most 1 second) |

Callbacks are always invoked as `callback(args)`; when `args` is not passed it is `None`, so the function must be able to accept one parameter:

```python
listener.register_key_event("f8", lambda _: logger.info("暂停"))
listener.register_key_event("f10", my_handler, args=("重置", 1))
```

## Key names

Key strings are derived from pynput events:

- **Regular keys**: the character itself, such as `a`, `1`, `/`;
- **Special keys**: the lowercase form of the pynput enum name, such as `enter`, `ctrl`, `shift`, `space`, `esc`, `f8`.

Always register with **lowercase**. The listener looks keys up exactly, so `F8` and `f8` do not match.

:::caution
The listener supports only **single keys**, not combinations such as `ctrl+f8`: pressing a combination triggers only the callback of the modifier key itself.
:::

## Thread model

- The listening loop runs in pynput's low-level keyboard hook thread;
- After a registry hit, the callback is executed on a **separate daemon thread**,
  so that time-consuming work (such as the `join` when stopping a task) does not block the whole system input pipeline;
- Exceptions raised by callbacks are caught and logged at `ERROR`; they do not interrupt listening;
- Built-in debounce: it fires once on press and sets a flag, resetting on release, so holding a key does not trigger repeatedly.

```python
def _on_press(self, key):
    # record only; no time-consuming work
    ...
```

## Using it in the host

`AppContext._create_event_listener()` creates the listener during initialization and registers the global stop hotkey:

```python
stop_hotkey = settings.General.hotkeyStop.lower() or "f9"
listener = KeyboardListener()
listener.register_key_event(stop_hotkey, lambda _: self.request_stop_all())
listener.start()
```

Key points:

- The hotkey comes from the `keybindings.stop` setting, default `F9`;
- `request_stop_all()` requests stopping both the task and the extension (they share a worker thread);
- When pynput is not installed or fails to start, it returns `None` and only logs a warning; the rest of SRA is unaffected;
- `AppContext.shutdown()` calls `listener.stop()`; do not manage the listener thread separately.

## Using it in extensions

`BaseExtension` injects the host listener into `self.event_listener` (which may be `None`):

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

The auto-play extension is implemented this way: it registers pause/reset hotkeys before playing and unregisters them in `finally` afterwards.

:::caution
- **You must unregister**: if an extension does not unregister when it ends, the key stays occupied, and registering the same key later raises `ValueError`;
- **Do not call `start()` / `stop()`**: the listener thread belongs to the host; an extension ending only means this run is over, not that SRA is exiting;
- **Beware of conflicts with input**: the global listener also receives keys that SRA itself injects through `press_key`.
  If a registered hotkey is the same as a game key, the automation itself will trigger the callback (the auto-play extension warns about this).
:::

## Caveats

- **Case and characters**: regular keys use `key.char`; holding `Shift` yields uppercase letters, so registering lowercase is the safest;
- **Keep callbacks light**: although callbacks run on a separate thread, overly frequent time-consuming work still affects playback and task pacing;
- **No key combinations**: if you need combination semantics, track modifier state yourself or use another approach;
- **Platform**: SRA as a whole supports Windows only; on Windows the listener works through pynput's low-level hooks
  and may need to run as administrator to receive keys from elevated windows.
