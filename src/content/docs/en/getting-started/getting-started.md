---
title: Getting Started
sidebar:
  order: 1
---

Starting with the download, this guide walks you through the basic usage of SRA step by step.

> If you run into any problems with this guide, assume the developer is at fault first. Submit an [issue](https://github.com/Shasnow/StarRailAssistant/issues)
> or report it in the official chat group.

## Download

Go to the [download page](/en/getting-started/download/) and choose a channel to download from.

## Add to Trusted List

SRA performs many sensitive actions (including but not limited to **requesting administrator privileges**, **reading and writing the registry**, and **controlling the screen**), so it is easily flagged and quarantined by security software.
Before running the app, add SRA's installation directory to your security software's trusted list to avoid it being blocked.
Here is how to add an exclusion in **Windows Defender**:

1. Open [Windows Defender](ms-settings:windowsdefender)

   If the link doesn't work, open **Windows Defender** manually.

   If other antivirus software is installed, turn on *Periodic scanning* first.

   ![Add to trusted list, step 1](../../../../assets/img/trust/truststep1.png)

2. Open the **Virus & threat protection** settings - **Manage settings**

   ![Add to trusted list, step 2](../../../../assets/img/trust/truststep2.png)

3. Click **Exclusions** - **Add or remove exclusions**

   ![Add to trusted list, step 3](../../../../assets/img/trust/truststep3.png)

4. Click **Add an exclusion** - select the corresponding folder

   ![Add to trusted list, step 4](../../../../assets/img/trust/truststep4.png)

5. If you installed other software, turn off *Periodic scanning* again.

:::warning
If you have other security software, you may need extra configuration.

Even with other antivirus software installed (such as Huorong or 360 Speed Edition), Windows Defender's antivirus feature may still turn itself on at times,
which may make your SRA.exe suddenly disappear. Therefore, you must make sure the folders above are excluded by Windows Defender.
:::

## Install & Launch

SRA is a portable program: no installation is needed — just extract the archive and run **SRA.exe**.

:::warning
Starting with SRA 2.14, running SRA requires the .NET 10.0 runtime.
If the runtime is not installed on your system, you will be prompted on first launch. Please [click this link](https://dotnet.microsoft.com/en-us/download/dotnet/thank-you/runtime-10.0.7-windows-x64-installer)
to download and install `.NET 10.0`.

:::

We recommend creating a shortcut for SRA, but do not move the original program files.

SRA must be run as administrator.

![SRA.exe](../../../../assets/img/use/software.png)

On a successful launch, the announcement and the main window appear together. The announcement will not appear again until the next update.
![SRA 2.14 main window](../../../../assets/img/use/softwaremain2.png)

## Configuration Before Running

:::warning

- 📺 **Resolution requirements**:
  - If your screen resolution is **greater than 1920x1080** (e.g. 2560x1440), run the game in **1920x1080 windowed mode**, or recognition errors may occur!
  - If your screen resolution **equals 1920x1080**, run the game in **1920x1080 fullscreen** mode, or recognition errors may occur!
  - If your screen resolution is **less than 1920x1080**, please wait for a future version update; it may not work properly for now!
- 🖱️ **Input tip**: **Do not use the keyboard or mouse for anything else while a task is running!**

:::

## Task Configuration

Select the **Task** tab in the sidebar to see the task configuration. Check the box to the left of a task name to enable that task.

### Start Game

![Start Game interface](../../../../assets/img/use/getstarted/start_game_view.png)
This task configures everything related to launching the game.

1. Channel: choose the login channel. Launching the official, Bilibili, and global clients is currently supported.
2. Game Path:
   If "Use global settings" is enabled, the setting here is overridden by the global settings, and SRA uses the game path from the global settings to launch the game.
   Otherwise, SRA uses the game path set here to launch the game. When choosing the path, select the **game executable**, not the **launcher**.

   :::tip
   Example of a valid game path: `C:\Program Files\miHoYo Launcher\games\Star Rail Game\StarRail.exe`
   SRA supports server switching. If you have both the official and Bilibili clients installed, you only need to set the Bilibili path here.
   :::

3. Auto login: determines whether to log in after launch.
   If enabled, you must enter your account and password so SRA can log in; otherwise, you must make sure you are already logged in.
   Checking Auto login indicates that you have read and agree to the User Agreement and Privacy Policy.
4. Always log in again: determines whether to log in again every time. If enabled, SRA logs out the current account and logs in again after each game launch.

### Trailblaze Power

![Trailblaze Power interface](../../../../assets/img/use/getstarted/power_view.png)

This task configures whether to replenish Trailblaze Power, how to replenish it, which stages to challenge, and so on.

- Task list: click the configure button on the right to add, remove, or modify entries in the task list.
  ![Task list](../../../../assets/img/use/getstarted/tasklist.png)

  To delete an entry from the task list, select it, right-click the list, and choose delete.

  When SRA runs the Trailblaze Power task, it works through the task list from top to bottom.

  Entries in the list may repeat, and their order follows the order in which you added them.

  Each run starts from the top, and completed entries are not removed afterward — the next run reuses the same list.

  Click the `Add` button to add a new entry.
  ![Add task entry](../../../../assets/img/use/getstarted/addtask.png)
  For each type of stage, choose the level, count, and other details, then click `Confirm` to add it to the task list.

  You can add several kinds of stages. If Trailblaze Power runs out and is not replenished, no further battles are fought afterward.
  - Auto Detect: when enabled, the count cannot be edited manually; SRA calculates the number of runs from your current Trailblaze Power and the stage's cost.
    You can add several Auto Detect entries; they split your current Trailblaze Power evenly.
    Auto Detect and manually added stages can be mixed. Manually added stages always run first.
    If the stage type is "Ornament Extraction", all remaining Immersifiers are consumed as well.

  :::tip
  Example: you have 300 Trailblaze Power, stage A costs 60, and stage B costs 30.
  - Add stage A and set the count to Auto Detect
  - Add stage B and set the count to Auto Detect
    Calculation:
  - Total cost: 60+30=90 Trailblaze Power
  - Runs per stage: current Trailblaze Power / total cost = 300/90 = 3
  - Remaining Trailblaze Power: 300-3\*90=30
  - SRA gives stages A and B 3 runs each, and gives stage B 1 extra run to use up the remaining Trailblaze Power.
  - Result: stage A can be run 3 times and stage B 4 times.

  :::

- Replenish Trailblaze Power: each refill grants 60, taken from Reserved Trailblaze Power, or by using one Fuel, or by spending Stellar Jade.
- Use support characters: whether to use a support character in battles. SRA only uses the first character in the support list.
- Enable training targets: if enabled, SRA ignores the stage settings in the task list and allocates Trailblaze Power automatically in-game according to the characters set in the training target screen.
- Enable double event detection:
  ![Double event detection](../../../../assets/img/use/getstarted/activitydetect.png)
  This feature checks whether events such as Garden of Plenty or Planar Fissure are currently active and farms the corresponding stages first.
  When enabled, the Trailblaze Power task goes to the event page to check for active double events and, if there are any, farms the corresponding stages first.
  It does this by adding the corresponding stages to the top of the Auto Detect list, so training targets and manually added Auto Detect entries still take effect.

### Receive Rewards

![Receive Rewards interface](../../../../assets/img/use/getstarted/reward_view.png)

This task covers all daily rewards, such as Daily Training and Nameless Honor. Some are enabled by default.

You can also claim redemption code rewards. Check this option and enter the codes in the redemption code box; multiple codes are allowed, separated by spaces or line breaks.

### Cosmic Strife - Divergent Universe

Check the "**Divergent Universe - Paradise Memoir**" box to enable this task. The available options are:

- Mode:
  - **Farm the first level**: after entering the Divergent Universe, fight only the first stop (always a combat stop), then click "Exit and settle" to return. The next run enters again, repeatedly farming the first stop to gain levels.
  - **Full run**: start from the beginning or from the current stop (which must be a combat stop) and advance through the following stops via the door until "Exploration successful" completes a full run. When advancing, **combat, elite, and shop** stops are preferred; if none is offered, SRA clicks refresh and retries (up to 3 times), and if none appears, it selects the first stop.
- Runs this time: the number of rounds to execute (1-99999).
- Fast farming with Technique: if enabled, SRA presses E before entering battle to cast the first character's Technique.
  Combined with characters that can instantly defeat enemies, such as Phainon, Firefly, or The Herta, battles finish quickly.
  However, it does not suit characters like Acheron who need to cast their Technique several times.
- Enable weekly point rewards: if enabled, SRA checks before each round whether the current points have reached the weekly cap (18000),
  and skips the Divergent Universe task if they have. Once all tasks are complete, it also clicks to claim the earned point rewards.

Usually 20 runs per week are enough to complete the weekly point rewards.

:::tip[Multimodal vision positioning]
Event-type stops in Divergent Universe first try to locate the event frame with multimodal vision, falling back to regular recognition when it is not enabled. Enable it in Settings → Advanced → Multimodal LLM Vision and fill in the endpoint, model ID, and API key. Calls incur a fee; see [Multimodal LLM Vision](/en/getting-started/advance#multimodal-llm-vision).
:::

:::warning
Before running, complete Tutorial I and Tutorial II, and clear all beginner tips.
:::

### Cosmic Strife - Currency Wars

Standard match and Overclock match are supported, with the highest, lowest, or current difficulty; either type can also be combined with "Opening reroll". There are two modes of operation: full-run mode and takeover mode.

1. Trailblazer name: required in every mode. If your Trailblazer name contains special or uncommon characters, recognition may fail, so try to use common characters.
2. Type: select the Currency Wars type to run — Standard match or Overclock match.
3. Opening reroll: when enabled, SRA restarts the run repeatedly according to the conditions below until a satisfying opening appears; it can be freely combined with Standard match or Overclock match.
4. Difficulty: select the Currency Wars difficulty — Highest difficulty, Lowest difficulty, or Current difficulty.
5. Strategy: select the Currency Wars strategy to run. For how to create or import strategies, see [Custom Currency Wars Strategies](/en/getting-started/advance#custom-currency-wars-strategies).
6. Runs this time: the number of rounds to execute. With Opening reroll enabled it means the number of attempts; otherwise it means the number of repeated runs.
7. Enable weekly point rewards: when enabled, skip the Currency Wars task if the Cosmic Strife point rewards are already capped.

Expand "Advanced" to configure the following skips, which apply to both normal runs and Opening reroll:

- Skip shop refresh: only buy target characters from the current shop; do not refresh or level up.
- Skip applying strategy: do not paste the strategy code after entering a run.
- Skip crystal collection: do not perform the crystal-collection drag.
- Skip equipping gear: do not click recommended gear for strategy characters automatically.

When you are ready, remember to check both the Currency Wars checkbox and the Cosmic Strife checkbox to enable the task.

#### Full-Run Mode

:::tip
This is not a selectable task mode; it only describes how SRA behaves under certain conditions.
:::

In this mode, SRA performs every step of Currency Wars from start to finish, including choosing the difficulty, choosing a lineup, and fighting battles.

To run the Currency Wars task in full-run mode, you must be on the Currency Wars main screen or in the overworld, with no Currency Wars match in progress.

![Currency Wars main screen](../../../../assets/img/use/getstarted/currency_wars_main.png)

#### Takeover Mode

:::tip
This is not a selectable task mode; it only describes how SRA behaves under certain conditions.
:::

In this mode, SRA takes over an already started Currency Wars run and continues from the current progress.

To run the Currency Wars task in takeover mode, you must be on the Currency Wars preparation screen.

![Currency Wars preparation screen](../../../../assets/img/use/getstarted/currency_wars_ready.png)

#### Opening Reroll

![Opening reroll](../../../../assets/img/use/getstarted/reroll_start.png)
Open the "Opening reroll" switch in the Currency Wars task (below the "Type" drop-down). Reroll uses the "Type" and "Difficulty" selected above and restarts the run repeatedly according to the conditions below until a satisfying opening appears; it then stops and does not finish that match.

All fields are matched with **regular expressions**. Before matching, the recognized text is cleaned (spaces, `·`, `•`, and `?` are removed, and full-width characters are normalized to half-width), so you don't need to handle these OCR artifacts when configuring. Each configuration string is used as a regex with `re.search` against the recognized text; a match only requires the recognized text to **contain** a fragment that the regex matches — the whole string does not have to be equal.

- Regex special characters (`.`, `+`, `*`, `(`, `)`, `[`, `]`, etc.) have special meanings; escape them with `\` to match the literal character. Make sure the input is a valid regex, or an error is reported at the configuration stage.
- For investment strategies, Boss names, encounter partners, and Boss affixes, `?` is removed before matching, so the `?` quantifier cannot be used in these fields (such as `\+?`); use alternation with `|` instead. In investment environments, `?` means the "optional item" prefix only when it appears at the start.
- Boss names: enter the Boss names you want to roll here, for example `巨鹿生物制药;增熵能源集团;金血记忆体联盟`.
  Separate them with semicolons `;`, corresponding to Plane 1, 2, and 3 in order; each item is a regex match. Leaving an item empty means there is no specific requirement for that Plane, e.g. `;;金血记忆体联盟` means you only expect "金血记忆体联盟" on the third Plane.
  Thanks to search matching, you don't need to write the full name: for example, `凛冬|火线;铁盾;造梦` means the first Plane may match either "凛冬经贸联合体" or "火线动力机甲", the second Plane matches "铁盾安保集团", and the third Plane matches "造梦兄弟影业".
- Encounter partners: enter the encounter partner names you want to roll here, for example `杨叔 阮·梅`.
  Separate them with spaces; matching any one of them counts as satisfied. Leave it empty for no restriction.
- Boss affixes: enter the Boss affix names you want to roll here, for example `变宝为废`. Boss affix names are based on the affix names shown in Currency Wars.
  Separate multiple affixes with spaces, and all of them must match, for example `首领强化 一鼓作气`.
  Prefix an affix name with an exclamation mark `!` (full-width or half-width) to mark it as a hated affix; any one appearing restarts the run. For example, `!熄火` restarts the run if any affix containing "熄火" appears (前台熄火, 后台熄火, 风之熄火, ...). Priority: hated affixes > required affixes.
- Investment environments: enter the investment environment names you want to roll here. Investment environment names are based on the environment names displayed in Currency Wars.
  Separate them with spaces; items without a prefix are **required**, and items prefixed with `?` or `？` are **optional**. Required items are matched first; if none matches, optional items are matched; if nothing matches, SRA tries to refresh, and if it cannot refresh and required items exist, it restarts the run.
  For example, `人才储备 ?.*邀请` means "人才储备" is required, and matching an optional environment such as "仙舟邀请" or "击破邀请" is better; `.*概念股` matches any stock-type environment (仙舟/减益/击破/列车同行 concept stocks).
- Investment strategies: enter the investment strategy names you want to roll here, for example `砂里淘金`. Investment strategy names are based on the strategy names displayed in Currency Wars.
  Use `;` to separate strategies for different Planes, for example `长期主义;砂里淘金` means you expect "长期主义" on the first Plane and "砂里淘金" on the second Plane.
  `长期主义;` or `长期主义` means there is no specific requirement for the second Plane; `;砂里淘金` means there is no specific requirement for the first Plane.
  For the same Plane you can provide several candidates with `|`, for example `长期主义|加油站|彩虹期货` matches any of the three; `.+星徽` matches any star-emblem strategy (列车同行星徽, 银河学者星徽, ...).
  When paired affixes containing `+` exist, mind the escaping: `固定理财` matches whether or not the name has "+", `固定理财\+` matches only "固定理财+", and `^特战资金$` matches only "特战资金" without "+".

### In the End

Controls what happens after tasks finish. It includes the following:

1. Log out of the current account: clicks the log-out button in the bottom-right of the game menu to log out of the current account.
2. Exit SRA: closes the SRA program.
3. Exit the game: closes the game window.
4. Shut down or sleep: shuts down or sleeps the computer after 60 seconds.

## Starting and Stopping Tasks

The operation panel appears at the bottom of the main window or at the top of the task page. Click the button at the far right of the panel to start running tasks.

The button at the far right has three modes, switched by expanding the arrow on the right:

- Launch Current: runs the current task configuration
- Launch All: runs all saved task configurations starting from the first one in the list; suitable for multi-account management
- Save Only: saves the current configuration without running tasks

We cover how to create more configurations so that different accounts can run different tasks in [Advanced Usage](/en/getting-started/advance).

Once a task starts running correctly, the button changes to **Stop Task**, meaning the task is running.

You can switch to the Console tab to view the task's execution log.

We cover the log filters in [Advanced Usage](/en/getting-started/advance#log-filters).

To interrupt a task, click **Stop Task** or press `F9`; the task stops after a short delay.

![Action buttons](../../../../assets/img/use/operation2.png)

When a task starts, SRA tries to keep the game window focused. Avoid manual intervention at this point unless you need to interrupt the task.

## More

See [Advanced Usage](/en/getting-started/advance).
