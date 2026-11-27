---
title: "Operators and the Factory"
description: "Operators, the operator factory, and operator types in SRA"
sidebar:
  order: 6
---

All game interaction in SRA goes through an "operator": screenshots, image recognition, keyboard and mouse input, and the clipboard.
The operator itself is an abstract interface, `IOperator`, and the `OperatorFactory` creates a concrete implementation for the current
environment. Tasks and extensions depend only on the interface and do not care whether a local window or a cloud gaming web page
is behind it.

This page covers the two operator implementations, how the factory creates them, resource reuse, and the external invocation interface.

## Operator types

`OperatorType` is a `StrEnum` with two values so far:

| Type | Implementation class | Use case | Notes |
| --- | --- | --- | --- |
| `OperatorType.Local` | `Operator` (`operator.py`) | Local game client | Window screenshots and keyboard/mouse emulation based on PyAutoGUI / PyWin32; Windows only |
| `OperatorType.Browser` | `BrowserOperator` (`browser_operator.py`) | Browser-based cloud gaming | Drives the `sr.mihoyo.com/cloud` page with Selenium; viewport fixed at 1920×1080 |

The difference lies mainly in the window layer:

- `Operator` locates the handle by window title and supports foreground/background screenshots; see [Windows and window context](/en/reference/sracore/window-context/);
- `BrowserOperator` always has `hwnd` = `0` and `is_window_active()` = `True`,
  the `background` parameter of `screenshot()` defaults to `True`, and width/height follow the page's actual viewport.
- `BrowserOperator` also handles cloud game login: `login(account, password, relogin, account_tag)` signs in with
  credentials, and `qrcode_login(timeout, relogin, account_tag)` shows a QR code and waits for scanning. Both save and
  restore login state per `account_tag`, and the QR image is written to `log/qrcode_login.png`.

The recognition and input interfaces are identical, so task code only needs to prefer proportional coordinates to work with both implementations.

## Factory

`OperatorFactory` lives in `SRACore/operators/factory.py` and provides two class methods:

```python
OperatorFactory.get_operator(
    optype: str | OperatorType = OperatorType.Local,
    settings: AppSettings | None = None,
    stop_event: threading.Event | None = None,
) -> IOperator

OperatorFactory.get_ocr_instance() -> RapidOCR
```

What `get_operator` does:

- When `settings` is `None`, the defaults from `AppSettings.from_dict({})` are used;
- `stop_event` is injected into the operator; once set, recognition and input operations raise `ThreadStoppedError`;
- Every call returns a **new** operator instance, but two kinds of resources are shared:
  - The OCR engine is a process-wide singleton, loaded on first creation (optionally `rapidocr/config.yaml`);
  - `WindowContext` is a class attribute of the factory, so all instances share the same window information;
  - The cloud gaming WebDriver is cached per browser type in `WebDriverManager._driver_pool` and reused.

:::tip
Do not call `Operator(...)` / `BrowserOperator(...)` directly in business code.
Bypassing the factory creates duplicate OCR engines and an independent `WindowContext`, and you lose driver reuse.
:::

### Type determined by settings

Internally, SRA always selects the type through `General.isCloudGameEnabled`:

```python
from SRACore.operators.factory import OperatorFactory, OperatorType

settings = app_settings
optype = (
    OperatorType.Browser
    if settings.General.isCloudGameEnabled
    else OperatorType.Local
)
operator = OperatorFactory.get_operator(optype, settings, stop_event)
```

Tasks (`task_process.py`), extensions (`ExtensionRunner._create_operator`), and `AppContext.create_operator`
all follow this rule. Tasks can also use `operator.type` to check the current implementation; for example, the startup task skips redundant window operations.

## Three ways to get an operator

### Inside tasks and extensions

Tasks and extensions do not create one themselves; they use `self.operator` directly:

- `BaseTask` receives the operator in its constructor and exposes it as `self.operator`;
- `BaseExtension` has the operator injected by `ExtensionRunner`, with the same stop event as the extension runner.

### Server and external calls

`AppContext.create_operator()` creates an operator from the current settings and **does not inject the task's stop event**,
so external key presses/clicks do not keep raising `ThreadStoppedError` after `task stop`.
Server-side screenshots, `operator call`, and other external calls all go through here.

### Manual creation

Scripts or debugging scenarios can pass settings and a stop event explicitly:

```python
import threading

from SRACore.models.app_settings import AppSettings
from SRACore.operators.factory import OperatorFactory, OperatorType
from tasks.img import IMG

settings = AppSettings.from_dict({})
stop_event = threading.Event()
operator = OperatorFactory.get_operator(OperatorType.Local, settings, stop_event)

box = operator.wait_img(IMG.ENTER, timeout=30)
if box is not None:
    operator.click_box(box)
```

## External invocation interface

Operator methods can be called directly without Python code, for debugging and automation orchestration:

```text
sra> operator list
sra> operator help locate
sra> operator call locate {"template": "resources/img/enter.png"}
sra> operator call screenshot {"save_path": "tmp/shot.png"}
```

- `operator list`: lists callable methods (excluding underscore-prefixed methods and `__init__`, `sleep`, `do_while`, `wait_any`, `login`);
- `operator help <method>`: prints parameter names, defaults, types, and documentation;
- `operator call <method> <json>`: binds a JSON object to the method parameters by key name and executes it.

Results are serialized: methods that return a `PIL.Image`, such as screenshots, do not return the image itself
but `{"path": <save_path>, "width": ..., "height": ...}`; set `save_path` if you need the image.

:::caution
`operator call` binds parameters by keyword, so JSON keys must be method parameter names.
Coordinates, confidence values, and other numbers should be written as floats (proportional coordinates) or ints (pixel coordinates);
if you cannot tell them apart, pass `mode` to `click_point`.
:::

## Resource lifecycle

- **OCR engine**: lives as long as the process; no manual release needed;
- **WindowContext**: shared by all factory-created instances; window changes are refreshed automatically before screenshots;
- **WebDriver**: cached per browser type; `WebDriverManager.close_browser(type)` closes a single driver,
  `dispose_all()` clears all drivers; `BrowserOperator.kill()` closes the corresponding browser.

## Caveats

- **Windows limitation**: `Operator` depends on PyWin32 and PyAutoGUI and only works on Windows;
  Linux / macOS needs cloud gaming mode (`BrowserOperator`).
- **Do not close the window before recognition**: the local implementation reads the client area before taking a screenshot and raises `RuntimeError` when the window is minimized.
- **Keep stop events consistent**: tasks and extensions share the same worker thread and pass their own stop events when creating operators;
  passing the wrong one when creating your own lets operations continue after a stop.
- **Settings must be loaded first**: `settings` affects confidence, the cloud gaming switch, and other behavior; calling `AppSettings.from_dict({})`
  directly only yields defaults, so production code should load from config.
