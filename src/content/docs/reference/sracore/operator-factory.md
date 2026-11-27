---
title: "操作器与工厂"
description: "SRA 中的操作器、操作器工厂、操作器类型"
sidebar:
  order: 6
---

SRA 的所有游戏交互都通过「操作器」（Operator）完成：截图、识图、键鼠输入、剪贴板。
操作器本身是一个抽象接口 `IOperator`，由工厂 `OperatorFactory` 按运行环境创建具体实现，
任务与扩展只依赖接口，不关心背后是本地窗口还是云游戏网页。

本文介绍操作器的两种实现、工厂的创建方式、资源复用与对外调用接口。

## 操作器类型

`OperatorType` 是一个 `StrEnum`，目前有两种取值：

| 类型 | 实现类 | 适用场景 | 说明 |
| --- | --- | --- | --- |
| `OperatorType.Local` | `Operator`（`operator.py`） | 本地游戏客户端 | 基于 PyAutoGUI / PyWin32 的窗口截图与键鼠模拟，仅支持 Windows |
| `OperatorType.Browser` | `BrowserOperator`（`browser_operator.py`） | 浏览器云游戏 | 基于 Selenium 操作 `sr.mihoyo.com/cloud` 页面，视口固定为 1920×1080 |

两者的差异主要在窗口层面：

- `Operator` 通过窗口标题查找句柄，支持前台/后台截图，见[窗口与窗口上下文](/reference/sracore/window-context/)；
- `BrowserOperator` 的 `hwnd` 恒为 `0`、`is_window_active()` 恒为 `True`，
  `screenshot()` 的 `background` 参数默认为 `True`，宽高以页面实际视口为准。
- `BrowserOperator` 额外提供云游戏登录：`login(account, password, relogin, account_tag)` 使用账号密码登录，
  `qrcode_login(timeout, relogin, account_tag)` 展示二维码并等待扫码；两者都按 `account_tag` 保存/恢复登录态，
  二维码图片写入 `log/qrcode_login.png`。

识别与输入接口完全一致，因此任务代码只需优先使用比例坐标，即可在两种实现之间通用。

## 工厂

`OperatorFactory` 位于 `SRACore/operators/factory.py`，提供两个类方法：

```python
OperatorFactory.get_operator(
    optype: str | OperatorType = OperatorType.Local,
    settings: AppSettings | None = None,
    stop_event: threading.Event | None = None,
) -> IOperator

OperatorFactory.get_ocr_instance() -> RapidOCR
```

`get_operator` 的行为：

- `settings` 为 `None` 时使用 `AppSettings.from_dict({})` 的默认设置；
- `stop_event` 会注入到操作器，置位后识别与输入操作抛出 `ThreadStoppedError`；
- 每次调用都会返回**新的**操作器实例，但两类资源共享：
  - OCR 引擎是进程内单例，首次创建时加载（可选 `rapidocr/config.yaml`）；
  - `WindowContext` 是工厂的类属性，所有实例共享同一份窗口信息；
  - 云游戏的 WebDriver 按浏览器类型缓存在 `WebDriverManager._driver_pool` 中复用。

:::tip
不要在业务代码里直接 `Operator(...)` / `BrowserOperator(...)`。
绕过工厂会重复创建 OCR 引擎、拿到独立的 `WindowContext`，并且无法享受驱动复用。
:::

### 类型由设置决定

SRA 内部统一按 `General.isCloudGameEnabled` 选择类型：

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

任务（`task_process.py`）、扩展（`ExtensionRunner._create_operator`）与 `AppContext.create_operator`
都遵循这一规则。任务中也可用 `operator.type` 判断当前实现，例如启动任务会跳过多余的窗口操作。

## 获取操作器的三种方式

### 任务与扩展内部

任务与扩展无需自己创建，直接使用 `self.operator`：

- `BaseTask` 在构造时接收操作器，并暴露为 `self.operator`；
- `BaseExtension` 由 `ExtensionRunner` 注入操作器，停止事件与扩展运行器一致。

### 服务端与外部调用

`AppContext.create_operator()` 会按当前设置创建操作器，**不注入任务的停止事件**，
避免 `task stop` 之后外部按键/点击一直抛 `ThreadStoppedError`。
服务端截图、`operator call` 等外部调用都走这里。

### 手动创建

脚本或调试场景可以显式传入设置与停止事件：

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

## 对外调用接口

操作器的方法可以不经 Python 代码直接调用，用于调试与自动化编排：

```text
sra> operator list
sra> operator help locate
sra> operator call locate {"template": "resources/img/enter.png"}
sra> operator call screenshot {"save_path": "tmp/shot.png"}
```

- `operator list`：列出可调用的方法（排除下划线开头的方法与 `__init__`、`sleep`、`do_while`、`wait_any`、`login`）；
- `operator help <method>`：输出参数名、默认值、类型与文档；
- `operator call <method> <json>`：把 JSON 对象按键名绑定到方法参数后执行。

调用结果会做序列化处理：截图等返回 `PIL.Image` 的方法不会直接回传图像，
而是返回 `{"path": <save_path>, "width": ..., "height": ...}`，需要图像时请设置 `save_path`。

:::caution
`operator call` 的参数按关键字绑定，因此 JSON 的键必须是方法参数名。
坐标、置信度等数值建议直接写成浮点数（比例坐标）或整数（像素坐标），
无法区分时可以给 `click_point` 传 `mode`。
:::

## 资源生命周期

- **OCR 引擎**：随进程存活，不需要手动释放；
- **WindowContext**：所有工厂创建的实例共享，窗口变化会在截图前自动刷新；
- **WebDriver**：按浏览器类型缓存，`WebDriverManager.close_browser(type)` 关闭单个驱动，
  `dispose_all()` 清空全部驱动；`BrowserOperator.kill()` 会关闭对应浏览器。

## 注意事项

- **Windows 限制**：`Operator` 依赖 PyWin32 与 PyAutoGUI，只能在 Windows 上使用；
  Linux / macOS 需要云游戏模式（`BrowserOperator`）。
- **不要在识别前关掉窗口**：本地实现截图前会读取客户区，窗口最小化时抛 `RuntimeError`。
- **停止事件要一致**：任务与扩展共用同一工作线程，创建操作器时传入的是各自的停止事件，
  自行创建时传错会导致停止后仍继续操作。
- **设置需先加载**：`settings` 影响置信度、云游戏开关等行为，直接 `AppSettings.from_dict({})`
  只能得到默认值，生产代码应从配置加载。
