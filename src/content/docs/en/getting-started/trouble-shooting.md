---
title: Troubleshooting
sidebar:
  order: 3
---

This page currently covers only the most common problems and may not be exhaustive. If your problem isn't listed here, or the suggestions didn't solve it, please report it in the official chat group.

## SRA Startup Problems

### Windows Defender Blocks Startup | Malicious Binary Reputation

Symptoms:

- The console reports a startup failure: An error occurred trying to start prosess "SRA-cli.exe" with working directory 'xxx'.
  应用程序控制策略已阻止文件。恶意二进制信誉

Solution:

Open Windows Defender (Windows Security), select "App & browser control" on the left, and turn off "Reputation-based protection".

![It should match the image](../../../../assets/img/wd_safe.png)

---

### Opens as a Black Window | settings.json Not Found

Symptoms:

- After opening, you see a _black window_ full of colored text;
- A message like `找不到 xxx\AppData\Roaming\SRA\settings.json` may also appear.

  ![Black window](../../../../assets/img/faq/black_window.png)

Solution:
This usually happens when SRA is installed and launched for the first time.
Check the following cases:

- Case 1: the folder contains both `SRA.exe` and `SRA-cli.exe`
  - Open `SRA.exe`, not `SRA-cli.exe`.
- Case 2: the folder contains only `SRA-cli.exe`
  - You downloaded the wrong version. If you downloaded `StarRailAssistant_Core_版本号.zip` or `StarRailAssistant_Lite.zip`, delete it and download
    `StarRailAssistant_版本号.zip` or `StarRailAssistant_版本号_Setup.exe` instead.

---

### .NET Runtime Not Installed | You must install or update .NET to run this application.

Symptoms:

- Opening SRA.exe shows `You must install or update .NET to run this application.`

Solution:
This is caused by the .NET Runtime 10 not being installed. Install .NET Runtime 10 and try again.

Click `Download it now` (or open
https://dotnet.microsoft.com/en-us/download/dotnet/thank-you/runtime-10.0.7-windows-x64-installer
directly), wait for the download to finish in the browser window that opens, then run the installer.

---

### Other Startup Problems | Double-Clicking SRA.exe Does Nothing

Symptoms:

- Double-clicking SRA.exe does nothing; no window or console appears.

Solution:

- Send the log files to the developer; they are usually in `C:\Users\xxx\AppData\Roaming\SRA\log\`.
- If you cannot find the log files, contact the developer.
- Try updating Windows Update.

## Task Configuration Problems

### Trailblaze Power Task List Options Are Empty

Symptoms:

- After clicking add in the Trailblaze Power task list, the "Type" and "Level" options in the add task dialog are empty and cannot be selected.

Solution:

SRA needs to fetch Trailblaze Power stage data from the backend dynamically to display the options properly. If fetching the data fails, the options are empty. Try the following:

- Go to Settings -> Advanced Settings and run the resource integrity check.
- If it reports that your files are incomplete or corrupted, click "Reinstall the latest app" in Settings -> Update.
- If the check passes, try clicking the "Resources cleanup" button below.

## Task Execution Problems

### Cannot Launch Configuration: Please Check Backend Status | Backend Executable Not Found | Process Not Running

Symptoms:

- The console reports a startup failure: 未找到后端可执行文件
- Running a task reports that the configuration cannot be started: please check the backend status
- The console reports a send failure: process not running (input: task run Default)

Solution:

- You may have accidentally downloaded the Lite version. If you downloaded `StarRailAssistant_Lite.zip`, delete it and download `StarRailAssistant_版本号.zip` or `StarRailAssistant_版本号_Setup.exe` instead.
- Your antivirus software may have quarantined the backend program. Add SRA's directory to Windows Defender exclusions and to your antivirus software's trusted zone or developer directory.
  Add the whole SRA folder to the trusted list ([click here](./getting-started#add-to-trusted-list) to see how) and then extract the archive again.

---

### Endless Scrolling While Farming | Materials Not Found

Symptoms:

- The material selection screen scrolls endlessly after entering it while farming

Solution:

- Make sure materials are sorted by "Path" rather than by "Update time".

### Screenshot Failed | Error code from Windows: 0 - 操作成功完成

Symptoms:

- While running a task, the console TRACE log shows `Error taking screenshot: Error code from Windows: 0 - 操作成功完成`
- The game window's taskbar icon flashes

Solution:

- Click the game window manually to activate it. This usually happens because Windows thinks you are using another window and therefore denies SRA's request to bring the game window to the foreground.

### Task Ends Immediately After Starting

Symptoms:

- After starting a task, nothing happens
- The console log shows something like:

```text
20:57:30 | INFO  | Current config: Default
20:57:30 | INFO  | 旷宇纷争任务全部完成
20:57:30 | INFO  | All tasks in config 'Default' have been completed.
20:57:30 | INFO  | ==================================================
20:57:30 | INFO  | All tasks completed.
```

Solution:

- Check whether any tasks are checked in the configuration. If no task is checked, SRA considers all tasks complete and exits immediately.
- Check whether sub-tasks under the main task categories are checked. If no sub-task is checked, SRA considers that main task complete and exits immediately.
- For example:
  ![Subtask checkboxes](../../../../assets/img/faq/subtask.png)

### Tasks Configured but Cannot Run | Invalid task ID

Symptoms:

- The console error message contains `Invalid task ID`

Solution:

- Try adding the task again.
- If it still cannot run, try creating a new configuration.

---

### Divergent Universe / Currency Wars Not Running

Symptoms:

- After clicking start, nothing happens

Solution:

- Check whether the **Cosmic Strife** category is checked.
- Check whether **Trailblazer name** is filled in.
- Check that you start it from the Divergent Universe screen.
- Check that the resolution is 1920 × 1080, and see the "Image recognition failure" question.

---

### Stuck in Battle / Auto Battle Not Working

Symptoms:

- The game stops responding after entering battle while farming
- The game stops responding after entering battle in Divergent Universe / Currency Wars

Solution:

- In the game settings, **Other** -> **Battle** -> **Auto-Battle Settings** (follow): **Yes**, then turn on auto battle manually (if you haven't already).
  ![Auto battle](../../../../assets/img/faq/auto_battle.png)

### Image Recognition Failure

Symptoms:

- The console error message contains `OCR识别结果为空` or `Could not locate the image`, **which causes the task to fail**

Solution:

**For users with multiple monitors**:

- Put both SRA and the game on the primary monitor.
- Or disconnect one monitor,
- Or change the display mode in settings to duplicate, or to show only on 1 / 2.

**For all tasks**:

- Check whether the game resolution is 1920 × 1080.

**For Cosmic Strife**:

- You may have started the task on the wrong screen; check the [specific requirements](./getting-started#cosmic-strife---divergent-universe).

---

### Game Not Found

Symptoms:

- The console error message contains `No such file or directory`
- Tasks cannot run properly when the game is not running, but work when it is running

Solution:

Option 1:

- On the task page, open the global settings via the button to the right of Game Path.
- On the settings page, enable automatic game path detection; or turn off auto-detection and choose the folder manually.

Option 2:

- Set or re-set the game path on the task page.
