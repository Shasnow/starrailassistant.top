---
title: Full Command Reference
sidebar:
  order: 2
---

## Command Cheat Sheet

The commands built into SRA-cli mainly include:

- `task`: Task management
- `extension`: Extension management
- `game`: Game screenshots, OCR, and process control
- `run`: Run tasks synchronously
- `single`: Run a single task synchronously
- `init`: Initialize resources and the default configuration
- `version`: Show the version number
- `notify`: Test notifications
- `quit` / `exit`: Exit the CLI
- `help`: Show help

In addition, the CLI dynamically loads external commands from the `tasks/` directory, such as `strategy` and `tpconfig`.

## Built-in Commands

These are built into SRA-cli: they are provided by default and cannot be removed.

### `task` — Task Manager

Manages starting, stopping, and status queries for tasks.

```text
sra> help task
Usage: task [-h] SUBCOMMAND ...

任务管理器 - 管理 SRA-cli 的任务。

Subcommands:
  run       运行指定配置文件中的所有选中的任务
  single    运行由其名称或索引指定的单个任务
  stop      停止当前运行的任务
  status    显示当前任务状态
```

#### `task run`

Run all selected tasks in the specified configuration files. Tasks run in a background thread, so the command line is not blocked.

```text
task run [config ...]
```

- `config`: Configuration file name (without the `.json` suffix) or a configuration file path. Multiple configurations can be specified; if omitted, the current configuration is used.

Example: run the configurations named `114` and `514`

```text
sra> task run 114 514
```

Example: run the `my_config.json` configuration in the specified directory

```text
sra> task run "path\to\my_config.json"
```

#### `task single`

Run a single specified task. The task runs in a background thread, so the command line is not blocked.

```text
task single task [--config CONFIG]
```

- `task`: The task's class name (e.g. `ReceiveRewardsTask`) or index (e.g. `2`)
- `--config`: Configuration file name; if omitted, the current configuration is used

Example: run the single task `Claim Rewards` in the current configuration

```text
sra> task single ReceiveRewardsTask
```

Or

```text
sra> task single 2
```

:::tip
The `Claim Rewards` task has the class name `ReceiveRewardsTask` and the index `2` in SRA.
:::

Example: run the single task `Trailblaze Power farming` in the specified configuration

```text
sra> task single TrailblazePowerTask --config my_config.json
```

:::tip
The `Trailblaze Power farming` task has the class name `TrailblazePowerTask` and the index `1` in SRA.
:::

#### `task stop`

Stop the task currently running.

```text
sra> task stop
```

If no task is running, it prints the message `没有任务在运行` ("no task is running").

#### `task status`

Show the status information of the current task.

```text
task status [--json]
```

- `--json`: Output the status information in JSON format

The output fields include:

- `Session ID`: Current task session ID
- `PID`: Task process ID
- `Mode`: Run mode
- `Status`: Current status
- `Unit`: Task unit information
- `Configs`: List of configurations in use
- `Progress`: Current progress
- `Error`: Error information (if any)

### `extension` — Extension Manager

Manage dynamically loaded extensions, including viewing, running, stopping, and configuring them.

```text
sra> help extension
Usage: extension [-h] SUBCOMMAND ...

扩展管理：查看、运行已注册的扩展

Subcommands:
  list     列出所有已注册的扩展
  run      运行指定扩展
  info     显示扩展的配置 Schema 详情
  reload   重新扫描并导入扩展模块
  stop     停止指定后台扩展或当前正在运行的单次扩展
  status   显示扩展运行状态
  config   扩展配置管理
```

#### `extension list`

List the currently registered extensions.

```text
extension list [--json]
```

- `--json`: Output a single line of JSON

Example:

```text
sra> extension list
sra> extension list --json
```

#### `extension run`

Run an extension according to its type. Non-background extensions use the shared thread, while background extensions use a dedicated thread.

```text
extension run NAME [--config CONFIG]
```

- `NAME`: Extension identifier (see `extension list`)
- `--config`: Load the specified configuration file name, without the `.json` suffix

Example:

```text
sra> extension run hello
sra> extension run hello --config my_ext
```

#### `extension info`

View an extension's configuration schema and class information.

```text
extension info NAME [--json]
```

Example:

```text
sra> extension info hello
sra> extension info hello --json
```

#### `extension reload`

Rescan and import extension modules, updating the registry.

```text
sra> extension reload
```

#### `extension stop`

Stop the specified background extension, or stop the currently running single-run extension.

```text
extension stop [NAME]
```

- `NAME`: Background extension identifier; if omitted, the current single-run extension is stopped

Example:

```text
sra> extension stop my_background_ext
```

#### `extension status`

Show the extension run status.

```text
sra> extension status
```

The output fields include:

- `Status`
- `Unit`
- `Error`

#### `extension config`

Extension configuration management. Supports reading and writing configurations.

```text
extension config SUBCOMMAND ...
```

##### `extension config get`

Get an extension's configuration.

```text
extension config get NAME [--json]
```

##### `extension config set`

Set an extension's configuration.

```text
extension config set NAME JSON
```

- `NAME`: Extension identifier
- `JSON`: Configuration JSON string

Example:

```text
sra> extension config get hello
sra> extension config set hello '{"enabled": true}'
```

### `game` — Game Operations

Provides utility commands for interacting with the game.

```text
sra> help game
Usage: game [-h] SUBCOMMAND ...

管理游戏

Subcommands:
  screenshot  截取游戏截图
  ocr         执行 OCR 文字识别
  kill        终止游戏进程
```

#### `game screenshot`

Capture a screenshot of the current game screen.

```text
game screenshot [--save SAVE] [--show] [--background]
```

- `--save SAVE`: Save the screenshot to the specified path; the default file name is `screenshot.png`
- `--show`: Display the screenshot on screen
- `--background`: Capture the screenshot in the background (without showing the game window)

:::note
At least one of `--save` or `--show` must be specified.
:::

Example: save the screenshot to a file

```text
sra> game screenshot --save my_screenshot.png
```

Example: capture and display a screenshot in the background

```text
sra> game screenshot --background --show
```

#### `game ocr`

Run OCR text recognition on the current screen.

```text
game ocr [--region X1 Y1 X2 Y2] [--json]
```

- `--region X1 Y1 X2 Y2`: Coordinates of the recognition region as ratios (floats between 0 and 1), given as top-left and bottom-right coordinates
- `--json`: Output the recognition result in JSON format

Example: recognize the top-left region

```text
sra> game ocr --region 0 0 0.5 0.3
```

Example: output the OCR JSON for the entire screen

```text
sra> game ocr --json
```

#### `game kill`

Terminate the game process.

```text
sra> game kill
```

This command forcibly closes the game process. Use it with caution.

### `run`

Run all selected tasks in the specified configuration files, blocking the command line until the tasks finish.

```text
run [config ...]
```

- `config`: Configuration file name or path; multiple configurations can be specified

Example: run the `114` configuration synchronously

```text
sra> run 114
```

Press `Ctrl+C` to interrupt task execution at any time.

### `single`

Run a single specified task, blocking the command line until the task finishes.

```text
single task [--config CONFIG]
```

- `task`: The task's class name or index
- `--config`: Configuration file name

Example: run a single task synchronously

```text
sra> single ReceiveRewardsTask
```

Press `Ctrl+C` to interrupt task execution at any time.

### `init`

Initialize the SRA application: download the resources package and create the default settings and configuration files.

```text
sra> init
```

:::warning
This command requires network access and downloads the resources package from GitHub. If the resource files already exist, the creation step is skipped.
:::

### `version`

Show the current SRA-cli version number.

```text
sra> version
```

### `notify`

Send a test notification to verify that a notification channel is available.

```text
notify test CHANNEL
```

- `test`: Fixed subcommand used to send a test notification
- `CHANNEL`: Notification channel name, such as `email`, `webhook`, `telegram`, etc.

Example:

```text
sra> notify test email
```

### `quit` / `exit`

Exit the SRA-cli application. Both commands do the same thing.

```text
sra> quit
sra> exit
```

All running tasks and event listeners are cleaned up automatically before exiting.

### `help`

Show command help information.

```text
sra> help [command]
```

- `command`: Name of the command to show help for; if omitted, all commands are listed

Example: view help for the `task` command

```text
sra> help task
```

## External Commands

These commands are loaded dynamically at runtime by SRA-cli, usually defined in Python files under the `tasks/` directory. They may change depending on the version and installed extensions.

### `strategy` — Currency Wars Strategy Management

Query and manage Currency Wars strategy configurations.

```text
sra> help strategy
Usage: strategy [-h] SUBCOMMAND ...

管理货币战争攻略

Subcommands:
  list    列出所有攻略
```

#### `strategy list`

List all available strategies.

```text
strategy list [--json]
```

- `--json`: Output in JSON format

Example:

```text
sra> strategy list
sra> strategy list --json
```

### `tpconfig` — Trailblaze Power Stage Configuration Query

Query Trailblaze Power stage configuration information.

```text
sra> help tpconfig
Usage: tpconfig [-h] [--json] [subtask]

查看开拓力副本配置

Positional Arguments:
  subtask     指定子任务名称（如 calyx_golden）

Options:
  -h, --help  show this help message and exit
  --json      以 JSON 格式输出
```

Example:

```text
sra> tpconfig
sra> tpconfig calyx_golden
sra> tpconfig --json
sra> tpconfig calyx_golden --json
```

## Shortcuts

cmd2 provides some built-in shortcuts:

| Shortcut | Description |
|---------|------|
| `@script.txt` | Run a script file (equivalent to `run_script script.txt`) |
| `!command` | Execute the specified command in the system command line (equivalent to `shell command`) |

Example:

```text
sra> @my_tasks.txt        # run a script file
sra> !python -V           # execute a system command
```
