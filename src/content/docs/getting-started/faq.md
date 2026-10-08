---
title: FAQ
sidebar:
  order: 4
---

本文将解答你对 SRA 的大部分疑问，并帮助你缩小问题范围。可使用右侧（或屏幕上方）的 `此页内容` 快速定位。

如果你想为本文档做出贡献，可以点击文末的 _在 GitHub 上编辑此页_。

没有找到你的问题的答案？请查阅 [问题排查](/getting-started/trouble-shooting/)。

## 有关 SRA 的常见问题

<details>
<summary>和三月七小助手(March7Assistant)有什么区别？</summary>
SRA 和三月七小助手（下文简称 M7A）是两个不同的项目，由不同的开发者团队独立开发，功能和设计也各不相同。
请理性比较，两者都是为社区贡献的项目。我们也欢迎 M7A 的用户来体验 SRA，看看哪个更适合你。
下面列出一些 SRA 和 M7A 的主要差异：
图例：✅ 完整支持 / ❌ 不支持 / ⚠️ 部分支持

| 项目                      | SRA v2.13        | M7A v2026.4.22   |
| ------------------------- | ---------------- | ---------------- |
| 功能                      | ---              | ---              |
| 清体力                    | ✅               | ✅               |
| 使用支援角色              | ✅               | ✅               |
| 启用培养目标              | ✅               | ✅               |
| 体力计划                  | ✅               | ✅               |
| 每日实训                  | ✅               | ✅               |
| 领取奖励                  | ✅               | ✅               |
| 货币战争 - 标准博弈       | ✅               | ✅               |
| 货币战争 - 超频博弈       | ✅               | ✅               |
| 货币战争 - 刷开局         | ✅               | ❌               |
| 货币战争自定义阵容 / 羁绊 | ✅               | ❌               |
| 差分宇宙                  | ⚠️               | ✅               |
| 模拟宇宙                  | ❌               | ✅               |
| 锄大地                    | ❌               | ✅               |
| 逐光捡金（深渊）          | ❌               | ✅               |
| 自动对话                  | ✅               | ✅               |
| 多账号托管                | ✅               | ❌               |
| 自定义任务                | ✅               | ❌               |
| 其他                      | ---              | ---              |
| 开发语言                  | Python, C#       | Python           |
| Docker 支持               | ❌               | ✅               |
| 云星穹铁道支持            | ⚠️               | ⚠️               |
| 下载大小                  | 约 160 MB（zip） | 约 700 MB（zip） |
| 解压大小                  | 约 290 MB        | 约 2 GB          |

</details>

<details><summary>SRA能支持Linux/MacOS/*nix吗</summary>
SRA 支持 Linux、MacOS 等 *nix 系统。在这些系统上，SRA 可以通过 uv、pip、pipx 安装并运行。
此外，[StarRailAssistant.Neo](https://github.com/EveGlowLuna/StarRailAssistant.Neo) 项目的 [后端项目 Linux 开发分支](https://github.com/EveGlowLuna/SRA-CE-Cli/tree/linux_dev) 已有雏形，可前往查看。该 fork 的效果不代表官方最终效果。

</details>

<details><summary>挂后台会抢鼠标吗？/可以挂后台吗？</summary>
包抢的。SRA 使用模拟操作技术，需要真实控制鼠标进行移动和点击，因此在挂后台时会占用鼠标。
如果你需要挂后台，可以通过 Windows 本地多用户、远程桌面、虚拟机等方式实现，也可以使用云游戏。
</details>

<details><summary>可以做一做绝区零的/有没有绝区零版本？</summary>
~~绝区零因抽不出角色导致退游，望周知~~，且市面上已经有现成解决方案。
</details>

<details><summary>国际版是否可用？/Can the Global Edition of the Honkai:Star Rail be used?</summary>
SRA 已支持国际服，在语言设置为简体中文的情况下可以使用。

The global edition of Honkai: Star Rail is now supported and works as expected when Simplified Chinese is selected as
the display language.

</details>

<details><summary>和maa是一个作者吗/和maa是什么关系？</summary>
SRA 仅在命名和 UI 上部分借鉴 MAA，除此之外与 MAA 并无联系。
</details>

<details><summary>会封号吗挺担心的</summary>
从 SRA 立项到 2.23 版本更新，作者一直使用自己的账号进行测试，目前暂未封号。

SRA 依靠计算机图像识别和模拟操作运行，不会修改游戏文件，也不会读写游戏内存，因此理论上不会导致封号。
但脚本或模拟操作仍然可能触发米哈游的封号规则之一。既然使用 SRA，就要承担相应风险。

另外，请不要在崩坏：星穹铁道以及米哈游各平台（包括但不限于米游社、B 站、微博）的官方动态下讨论任何有关 SRA 的内容。

</details>

<details><summary>能用异种分辨率吗（例如1600×900）/只能使用1920 * 1080吗？</summary>
暂不支持异种分辨率，目前只能使用 1920 × 1080。
</details>

<details><summary>Windows 8.1/8/7可以用吗？</summary>
Python 3.12 支持 Windows 8.1，但不支持 Windows 8 或更早版本（包括 Windows 7）。
SRA 中使用了 Python 3.12 的语法，不支持 Windows 8 或更早版本。

!!不过，你也可以尝试将旧电脑升级到 Windows 8.1 / Windows 10 的早期版本，这些版本在老旧电脑上的流畅度不一定比 Windows 7 差。!!

</details>

<details><summary>网页云崩铁可以嘛/适配云游戏吗？</summary>
2.13 版本已支持云游戏，且在云游戏环境下表现良好。
</details>

<details><summary>下载速度太慢</summary>
SRA 已接入 Mirror 酱，可以尝试使用。
</details>

<details><summary>会出手机版吗/手机平板能用吗？</summary>
不会。不同手机和平板的屏幕尺寸差异较大，实现难度较高。
</details>

<details><summary>为什么文件会被报告为*具有可能有害的行为*？</summary>
SRA 需要管理员权限，但部分杀毒软件会误报，导致 SRA 无法正常运行。请放心，SRA 不会对您的电脑造成任何损害。运行前，请将 SRA 的目录添加到 Windows Defender 排除项，以及防病毒软件的信任区或开发者目录，避免被误杀。
</details>
