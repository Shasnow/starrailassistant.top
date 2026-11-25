---
title: FAQ
sidebar:
  order: 4
---

This page answers most of your questions about SRA and helps you narrow down problems. Use `On this page` on the right (or at the top of the screen) to jump to a section.

If you'd like to contribute to this documentation, click _Edit this page on GitHub_ at the end of the page.

Didn't find the answer to your question? Check [Troubleshooting](/en/getting-started/trouble-shooting/).

## Frequently Asked Questions About SRA

<details>
<summary>What is the difference between SRA and March7Assistant (M7A)?</summary>
SRA and March7Assistant (M7A for short below) are two different projects, independently developed by different teams, with different features and designs.
Please compare them rationally — both are projects contributing to the community. We also welcome M7A users to try SRA and see which one suits you better.
Here are some of the main differences between SRA and M7A:
Legend: ✅ Fully supported / ❌ Not supported / ⚠️ Partially supported

| Item                        | SRA v2.13        | M7A v2026.4.22   |
| --------------------------- | ---------------- | ---------------- |
| Features                    | ---              | ---              |
| Trailblaze Power farming    | ✅               | ✅               |
| Use support characters      | ✅               | ✅               |
| Enable training targets     | ✅               | ✅               |
| Trailblaze Power plan       | ✅               | ✅               |
| Daily Training              | ✅               | ✅               |
| Claim rewards               | ✅               | ✅               |
| Currency Wars - Standard match | ✅            | ✅               |
| Currency Wars - Overclock match | ✅           | ✅               |
| Currency Wars - Opening reroll | ✅            | ❌               |
| Custom Currency Wars lineups / bonds | ✅      | ❌               |
| Divergent Universe          | ⚠️               | ✅               |
| Simulated Universe          | ❌               | ✅               |
| Overworld farming           | ❌               | ✅               |
| Endgame modes (Abyss)       | ❌               | ✅               |
| Auto Dialogue               | ✅               | ✅               |
| Multi-account management    | ✅               | ❌               |
| Custom tasks                | ✅               | ❌               |
| Other                       | ---              | ---              |
| Development language        | Python, C#       | Python           |
| Docker support              | ❌               | ✅               |
| Star Rail Cloud support     | ⚠️               | ⚠️               |
| Download size               | About 160 MB (zip) | About 700 MB (zip) |
| Extracted size              | About 290 MB     | About 2 GB       |

</details>

<details><summary>Does SRA support Linux/MacOS/*nix?</summary>
SRA supports Linux, macOS, and other *nix systems. On these systems, SRA can be installed and run via uv, pip, or pipx.
In addition, the [Linux development branch of the backend project](https://github.com/EveGlowLuna/SRA-CE-Cli/tree/linux_dev) in the [StarRailAssistant.Neo](https://github.com/EveGlowLuna/StarRailAssistant.Neo) project is taking shape; feel free to take a look. Results from that fork do not represent the official final results.

</details>

<details><summary>Will running in the background take over my mouse? / Can I run it in the background?</summary>
Yes, it will. SRA uses simulated input technology, which requires real control of the mouse for movement and clicking, so it occupies the mouse when running in the background.
If you need to run it in the background, you can use Windows local multi-user sessions, Remote Desktop, a virtual machine, or cloud game.
</details>

<details><summary>Can you make a Zenless Zone Zero version? / Is there a ZZZ version?</summary>
~~The developer quit Zenless Zone Zero after failing to pull any characters, just so you know~~, and there are already existing solutions on the market.
</details>

<details><summary>Is the global edition available? / Can the Global Edition of the Honkai:Star Rail be used?</summary>
SRA now supports the global server, and it works when the language is set to Simplified Chinese.

The global edition of Honkai: Star Rail is now supported and works as expected when Simplified Chinese is selected as
the display language.

</details>

<details><summary>Is it made by the same author as MAA? / What is the relationship with MAA?</summary>
SRA only borrows a little from MAA in naming and UI; apart from that it has no connection with MAA.
</details>

<details><summary>Will I get banned? I'm a bit worried</summary>
From the start of the SRA project through the 2.23 update, the author has always tested with his own account, and it has not been banned so far.

SRA runs on computer image recognition and simulated input. It does not modify game files and does not read or write game memory, so in theory it will not cause a ban.
However, scripts or simulated input may still trigger one of miHoYo's ban rules. If you use SRA, you accept the corresponding risk.

Also, please do not discuss anything about SRA under official posts of Honkai: Star Rail or miHoYo platforms (including but not limited to MiYoushe, Bilibili, and Weibo).

</details>

<details><summary>Can I use a non-standard resolution (e.g. 1600×900)? / Is 1920 × 1080 the only option?</summary>
Non-standard resolutions are not supported for now; only 1920 × 1080 is currently available.
</details>

<details><summary>Can it run on Windows 8.1/8/7?</summary>
Python 3.12 supports Windows 8.1, but not Windows 8 or earlier (including Windows 7).
SRA uses Python 3.12 syntax, so Windows 8 or earlier is not supported.

!!However, you can also try upgrading an old computer to Windows 8.1 / an early version of Windows 10. These versions are not necessarily less smooth on old hardware than Windows 7.!!

</details>

<details><summary>Does browser cloud game work? / Is cloud game supported?</summary>
Version 2.13 supports cloud game, and it performs well in the cloud game environment.
</details>

<details><summary>The download speed is too slow</summary>
SRA has integrated Mirror Chyan; you can try using it.
</details>

<details><summary>Will there be a mobile version? / Can it run on phones and tablets?</summary>
No. Screen sizes vary widely between phones and tablets, making this relatively difficult to implement.
</details>

<details><summary>Why is the file reported as *potentially harmful behavior*?</summary>
SRA requires administrator privileges, but some antivirus software flags it incorrectly, which prevents SRA from running properly. Rest assured that SRA will not cause any harm to your computer. Before running it, add SRA's directory to Windows Defender exclusions and to your antivirus software's trusted zone or developer directory to avoid it being blocked.
</details>
