---
title: Basic Usage
sidebar:
  order: 1
---

In SRA 2.0, we provide a standalone command-line program, `SRA-cli.exe`, for running SRA tasks from the command line.

![SRA-cli](../../../../assets/img/use/advance/software2.png)

This application is the actual executor of SRA's functionality; the main program completes tasks by embedding calls to SRA-cli.
Therefore, you can use SRA-cli directly to run tasks without opening the main program.

:::tip You still need to configure tasks in the main program first — SRA-cli only runs tasks.
When SRA-cli is launched on its own, the following features are unavailable:

- Automatically setting the game resolution
- Automatically enabling auto-battle
- Automatically detecting the game path
:::

## Basic Usage of SRA-cli

Run `SRA-cli` to open the SRA-cli console window.
Type help to view the available commands:

```text
Welcome to SRA-cli (version 2.16.1, core 2.16.1 on win32).
Type 'help' to list commands.
sra> help

Documented Commands
───────────────────
alias  exit  history  notify  run         set    shortcuts  task     version
edit   help  macro    quit    run_script  shell  single     trigger

sra>
```

### Running Tasks

Use the `task run [config names...]` command to run tasks.
If no configuration name is specified, **all** configurations are run by default.
You can specify multiple configuration names, and SRA-cli will run these configurations in order.
Example: run the configurations named `Default` and `PlanB`:

```text
sra> task run Default PlanB
```

Example: run all configurations:

```text
sra> task run
```

### Stopping Tasks

Use the `task stop` command to stop all running tasks.
Example:

```text
sra> task stop
```
