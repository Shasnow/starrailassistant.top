---
title: String Matchers
description: Text matching strategies and helper functions in SRA
sidebar:
  order: 7
---

OCR results are not always stable: full-width vs. half-width characters, extra spaces, and punctuation can all make a simple string comparison unreliable.
String matchers (`StrMatcher`) pull "what counts as a match" out of the call site, so OCR-related interfaces can accept matching strategies of different strictness.

This page covers the built-in matchers, Unicode normalization, helper functions, and how to write custom matchers.

## Matcher interface

Matchers are defined in `SRACore/util/strutil.py` as a very thin abstract class:

```python
class StrMatcher(abc.ABC):
    def __init__(self, value: str):
        self.value = value

    @abc.abstractmethod
    def match(self, other: str) -> bool:
        """判断 other 是否满足匹配条件"""
```

Matchers are stateless and can be constructed ahead of time and reused.

## Built-in matchers

| Matcher | Behavior | NFKC normalization |
| --- | --- | --- |
| `ContainsMatcher(value)` | `value in text`, substring containment | Yes (both sides normalized) |
| `EqualsMatcher(value)` | `value == text`, exact equality | Yes (both sides normalized) |
| `RegexMatcher(pattern)` | `re.search(pattern, text)` | No |

The text arguments of the OCR interfaces (`ocr_match`, `ocr_match_any`, `wait_ocr`, `wait_ocr_any`) have the type
`str | StrMatcher`: when a string is passed it is **automatically wrapped in `ContainsMatcher`**, so the default is containment matching.

```python
from SRACore.util.strutil import ContainsMatcher, EqualsMatcher, RegexMatcher

operator.ocr_match("开拓")                        # equivalent to ContainsMatcher("开拓")
operator.ocr_match(EqualsMatcher("开拓"))          # the whole line must equal 「开拓」
operator.ocr_match(RegexMatcher(r"剩余\s*\d+\s*次"))  # regex search
```

## Unicode normalization

`normalize_unicode()` uses the NFKC rules to convert full-width characters to half-width, for example:

- `？` (U+FF1F) → `?`
- Full-width letters and digits `Ａ１` → `A1`

Before comparing, `ContainsMatcher` and `EqualsMatcher` normalize **both sides**,
so the result stays consistent when OCR recognizes a character as full-width in one place and half-width in another.

:::caution
`RegexMatcher` does **not** normalize. A full-width character in a regex only matches the full-width form;
if both forms must be supported, handle it explicitly in the regex, e.g. `[?？]`.
:::

## Helper functions

| Function | Description |
| --- | --- |
| `normalize_unicode(text)` | NFKC normalization; converts full-width to half-width |
| `clean_text(text)` | `strip` first, then removes `·`, `•`, `?`, and all spaces |
| `is_substring(a, b)` | Bidirectional containment check: `a in b or b in a` (no normalization) |

`clean_text` is commonly used on OCR text or names typed by users:

```python
from SRACore.util import strutil

item.source = strutil.clean_text(item.source)  # strip common interfering characters
matcher = strutil.RegexMatcher(strutil.clean_text(name))
```

Note that it **deletes** spaces and question marks instead of converting them; if spaces or question marks in the text are meaningful, use `normalize_unicode` instead.

## Using matchers with OCR

### Mixing strings and matchers

The list passed to `ocr_match_any` can contain both strings and matchers; the list order is the priority order:

```python
login_texts: list[str | StrMatcher] = [
    "请拖动滑块完成拼图",        # a string → containment match
    "登录",
    "欢迎",
    EqualsMatcher("同意"),       # avoid matching 「同意并继续」
    "开始游戏",
]
index, box = operator.wait_ocr_any(login_texts, timeout=30)
```

### Using regex for multiple candidates

```python
from SRACore.util.strutil import RegexMatcher

logout_title = RegexMatcher(r"退出登录|退出并保留登录记录|确定要退出")
box = operator.wait_ocr(logout_title, timeout=10)
```

### Reminders

- Containment matching is very sensitive to short words: 「同意」 also hits 「同意并继续」, so use `EqualsMatcher` when precision matters;
- Regex suits changing numbers (such as `\d+/\d+`) or a set of equivalent wordings;
- `ContainsMatcher("")` is always true; the source code uses it as a placeholder for "no requirement", so do not treat it as a meaningful condition.

## Custom matchers

When you need more complex rules, subclass `StrMatcher` and implement `match`:

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

A matcher can be passed directly to any OCR interface that accepts `str | StrMatcher`.

## Notes

- **Case sensitivity**: the built-in matchers do not apply `casefold`, so when English letter case differs you need a custom matcher or `(?i)` in the regex;
- **Regex is compiled on construction**: `RegexMatcher` compiles the pattern in `__init__`, so an invalid expression raises `re.error` immediately;
  catch that exception when reading regexes from a config file;
- **Only single lines are matched**: each OCR result is one line, so text spanning lines must be matched separately;
- **The default strategy is containment matching**: it is the easiest to mis-hit when the interface accepts a string, so key decisions should explicitly use `EqualsMatcher` or `RegexMatcher`.
