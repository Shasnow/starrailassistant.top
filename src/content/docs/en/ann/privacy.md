---
title: Privacy Policy
description: What information SRA collects, how it is used, and where it is stored.
sidebar:
  order: 3
---

Last updated: 2026-11-17

StarRailAssistant (hereinafter "SRA") is an open-source game automation tool. We follow the principle of data minimization and collect only the information necessary to keep the project running and to troubleshoot issues. This page explains what information the SRA desktop client collects, why, and how you can control it.

## 1. Anonymous Usage Statistics

When exiting, the SRA desktop client sends an anonymous event to the statistics service (`https://shasnow.top/s/api/report`). This request is used only to count version usage and session duration; it does not involve game accounts, passwords, cookies, screenshots, or file contents.

The fields sent are as follows:

| Field | Description |
| --- | --- |
| `deviceId` | A UUID generated randomly on first run, stored in `%APPDATA%/SRA/profile.txt` (`~/.config/SRA/profile.txt` on Linux) |
| `eventType` | Event type; currently only `logout` is reported |
| `eventData` | Data attached to the event; currently an empty string |
| `appId` | Fixed to `SRA` |
| `appVersion` | The current SRA version number |
| `timestamp` | The Unix UTC timestamp when the event occurred |
| `sessionDuration` | Duration of this session (in seconds) |

`deviceId` is only a random string and is not linked to hardware fingerprints, system accounts, or game accounts. It cannot be used to identify your real identity or to track you across devices.

## 2. Logs You Export Yourself

The "Export Logs" feature on the console **runs only after you click it and choose a save path**. The exported ZIP is saved to the location you specify, and SRA does not upload it automatically. The ZIP contains:

- `console.log`: real-time backend output captured by the console page (up to the most recent 1000 lines).
- `frontend/`: frontend Serilog logs (rolling daily, retained for 7 days).
- `backend/`: backend log files and task failure screenshots (`.log` and `.png` files in the `log/` directory).
- `manifest.json`: export time, SRA version, system information (OS version, architecture, .NET version, CPU core count, locale), display information (resolution, work area, scaling, whether it is the primary display), and general settings.

Logs and manifests may contain local file paths, configuration contents, and runtime environment information. Send these logs to the developers for troubleshooting only when you are aware of and consent to it; if you do not want to share this content, do not use the feature.

## 3. Local Storage

SRA stores the following data on your machine; this data is not uploaded automatically:

- `settings.json`: your settings.
- `configs/<Name>.json`: task configurations.
- `cache.json` and `cache/`: caches such as startup time and background images.
- `logs/` (frontend) and `log/` (backend): runtime logs and failure screenshots.

To clear this data, open the corresponding folder from the settings page and delete it manually, or use the "Resource Cleanup" feature.

## 4. Your Rights

- You can delete `profile.txt` at any time; SRA will generate a new anonymous `deviceId` on the next run.
- You can choose not to use the "Export Logs" feature; SRA will not generate or upload log packages without your action.
- You can sign up and log in at [dash.shasnow.top](https://dash.shasnow.top) to view and manage your usage data.
- To learn about or delete the statistics that have been reported, or if you have questions about this policy, contact the developers via [GitHub Issues](https://github.com/Shasnow/StarRailAssistant/issues) or the user group.

## 5. Policy Changes

This policy may be updated as features change; the latest version is always published on this page. Continuing to use SRA indicates your acceptance of the updated policy.
