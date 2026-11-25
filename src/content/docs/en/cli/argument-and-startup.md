---
title: Arguments and Startup
---

SRA-cli supports starting tasks through command-line arguments, and also supports startup commands and startup scripts.

## Command-Line Arguments and Startup Commands

SRA-cli accepts a number of command-line arguments that change its behavior at startup.
SRA supports passing these arguments directly to SRA-cli, allowing users to specify the backend's behavior at startup. Every `SRA-cli.exe` below can be replaced with `SRA.exe`.

Use `SRA-cli.exe --help` to view all available command-line arguments.

```text
usage: SRA-cli.exe [-h] [--inline] [--embed] [--command [COMMAND ...]] [--version]
                   [--log-level {TRACE,DEBUG,INFO,SUCCESS,WARNING,ERROR,CRITICAL}]
                   command ...

SRA-cli：SRA 命令行工具

options:
  -h, --help            show this help message and exit
  --inline              内联模式（无命令提示符）
  --command [COMMAND ...], -c [COMMAND ...], --execute [COMMAND ...], -e [COMMAND ...]
                        启动后要执行的命令。
  --version             显示 SRA-cli 的版本并退出。
  --log-level {TRACE,DEBUG,INFO,SUCCESS,WARNING,ERROR,CRITICAL}
                        设置日志记录级别（默认：TRACE）。
  --no-admin            以非管理员权限运行 SRA-cli。
```

- `--inline`: Inline mode, with no command prompt displayed.
- `--command`, `-c`, `--execute`, or `-e`: Specify the command(s) to execute after startup — either a single command or multiple commands. Separate commands with `+`.
- `--version`: Show the SRA-cli version information and exit.
- `--log-level`: Set the logging level. Defaults to `TRACE`; available values are `TRACE`, `DEBUG`, `INFO`, `SUCCESS`, `WARNING`, `ERROR`, and
  `CRITICAL`.
- `--no-admin`: Run SRA-cli without administrator privileges. By default SRA-cli requires administrator privileges to work properly and
  will restart itself with elevated privileges; this argument disables the automatic elevation so it runs as a non-administrator.
- `command`: A command to execute immediately at startup. SRA-cli interprets each argument as a separate command, so if a command is
  longer than one word you should wrap each command in quotes. You can use either single or double quotes.

Example: start SRA-cli and immediately run the configuration named `Default`:

```bash
SRA-cli.exe -e task run Default
SRA-cli.exe "task run Default"
```

Example: start SRA-cli and immediately run the configurations named `Default` and `PlanB`:

```bash
SRA-cli.exe -e task run Default PlanB
SRA-cli.exe "task run Default PlanB"
```

Example: start SRA-cli and immediately run all configurations:

```bash
SRA-cli.exe -e task run
SRA-cli.exe "task run"
```

Example: start SRA-cli, immediately run all configurations, and exit when finished:

```bash
SRA-cli.exe -e run + exit
SRA-cli.exe run exit
```

:::caution
You must use the `run` command here rather than `task run`, because the latter starts tasks on a separate thread to keep the
command-line interface responsive. As a result, the command line immediately begins processing the `exit` command and quits the program
before the tasks finish.
:::

Example: start SRA-cli, immediately run the configuration named `Default`, and exit when finished:

```bash
SRA-cli.exe -e run Default + exit
SRA-cli.exe "run Default" exit
```

## Startup Script

SRA-cli also supports startup scripts: you can create a file named `.srarc` in the current directory that contains commands to run
automatically at startup.
Example:

```text
run Default
exit
```

This runs the "Default" configuration in blocking mode immediately after SRA starts, then executes the `exit` command to quit SRA
when it finishes.
You can add multiple commands to the startup script, one per line. Commands are executed in order until an `exit` command is
encountered or the script ends.
