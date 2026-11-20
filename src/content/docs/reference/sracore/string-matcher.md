---
title: 字符串匹配器
description: SRA 中的文本匹配策略与辅助函数
sidebar:
  order: 7
---

OCR 的识别结果并不总是稳定的：全角与半角、多余空格、标点符号都可能让简单的字符串比较失准。
字符串匹配器（`StrMatcher`）把「怎么算匹配」从调用处抽出来，让 OCR 相关接口可以接收不同精度的匹配策略。

本文介绍内置匹配器、Unicode 归一化、辅助函数以及自定义匹配器的方式。

## 匹配器接口

匹配器定义在 `SRACore/util/strutil.py`，是一个很薄的抽象类：

```python
class StrMatcher(abc.ABC):
    def __init__(self, value: str):
        self.value = value

    @abc.abstractmethod
    def match(self, other: str) -> bool:
        """判断 other 是否满足匹配条件"""
```

匹配器是无状态的，可以预先构造并反复复用。

## 内置匹配器

| 匹配器 | 行为 | 是否 NFKC 归一化 |
| --- | --- | --- |
| `ContainsMatcher(value)` | `value in text`，子串包含 | 是（两边都归一化） |
| `EqualsMatcher(value)` | `value == text`，完全相等 | 是（两边都归一化） |
| `RegexMatcher(pattern)` | `re.search(pattern, text)` | 否 |

OCR 接口（`ocr_match`、`ocr_match_any`、`wait_ocr`、`wait_ocr_any`）的文本参数类型为
`str | StrMatcher`：传入字符串时**自动包装为 `ContainsMatcher`**，因此默认就是包含匹配。

```python
from SRACore.util.strutil import ContainsMatcher, EqualsMatcher, RegexMatcher

operator.ocr_match("开拓")                        # 等价于 ContainsMatcher("开拓")
operator.ocr_match(EqualsMatcher("开拓"))          # 必须整行等于「开拓」
operator.ocr_match(RegexMatcher(r"剩余\s*\d+\s*次"))  # 正则搜索
```

## Unicode 归一化

`normalize_unicode()` 使用 NFKC 规则把全角字符转成半角，例如：

- `？`（U+FF1F）→ `?`
- 全角字母与数字 `Ａ１` → `A1`

`ContainsMatcher` 与 `EqualsMatcher` 在比较前会对**两侧**都做归一化，
避免 OCR 在同一位置识别出全角或半角字符时结果不一致。

:::caution
`RegexMatcher` **不做**归一化。正则里的全角字符只匹配全角，
需要同时兼容两种写法时请在正则中显式处理，例如 `[?？]`。
:::

## 辅助函数

| 函数 | 说明 |
| --- | --- |
| `normalize_unicode(text)` | NFKC 归一化，全角转半角 |
| `clean_text(text)` | `strip` 后移除 `·`、`•`、`?` 与所有空格 |
| `is_substring(a, b)` | 双向包含判断：`a in b or b in a`（不做归一化） |

`clean_text` 常用于处理 OCR 文本或用户填写的名称：

```python
from SRACore.util import strutil

item.source = strutil.clean_text(item.source)  # 去掉常见的干扰字符
matcher = strutil.RegexMatcher(strutil.clean_text(name))
```

注意它会**删除**空格与问号，而不是转换；如果文本中的空格或问号有意义，请改用 `normalize_unicode`。

## 在 OCR 中使用

### 混合使用字符串与匹配器

`ocr_match_any` 的列表可以同时包含字符串与匹配器，列表顺序即优先级：

```python
login_texts: list[str | StrMatcher] = [
    "请拖动滑块完成拼图",        # 字符串 → 包含匹配
    "登录",
    "欢迎",
    EqualsMatcher("同意"),       # 避免命中「同意并继续」
    "开始游戏",
]
index, box = operator.wait_ocr_any(login_texts, timeout=30)
```

### 用正则表达多种候选

```python
from SRACore.util.strutil import RegexMatcher

logout_title = RegexMatcher(r"退出登录|退出并保留登录记录|确定要退出")
box = operator.wait_ocr(logout_title, timeout=10)
```

### 提醒

- 包含匹配对短词很敏感：「同意」会命中「同意并继续」，需要精确时用 `EqualsMatcher`；
- 正则适合处理会变化的数字（如 `\d+/\d+`）或一组等价文案；
- `ContainsMatcher("")` 恒为真，源码中用它作为「无要求」的占位，不要把它当成有效条件。

## 自定义匹配器

需要更复杂的规则时，继承 `StrMatcher` 实现 `match` 即可：

```python
from SRACore.util.strutil import StrMatcher, normalize_unicode


class AnyOfMatcher(StrMatcher):
    """命中任意一个候选词即视为匹配（忽略全角/半角差异）"""

    def __init__(self, values: list[str]):
        super().__init__("|".join(values))
        self._values = [normalize_unicode(v) for v in values]

    def match(self, other: str) -> bool:
        text = normalize_unicode(other)
        return any(value in text for value in self._values)
```

匹配器可以直接传给任意接受 `str | StrMatcher` 的 OCR 接口。

## 注意事项

- **大小写敏感**：内置匹配器不做 `casefold`，英文大小写不一致时需要自定义匹配器或正则加 `(?i)`；
- **正则构造即编译**：`RegexMatcher` 在 `__init__` 中编译正则，非法表达式会直接抛 `re.error`，
  从配置文件读取正则时建议捕获该异常；
- **只匹配单行文本**：OCR 结果为一行一条，跨行文案需要分别匹配；
- **默认策略是包含匹配**：接口接受字符串时最容易误命中，关键判断建议显式使用 `EqualsMatcher` 或 `RegexMatcher`。
