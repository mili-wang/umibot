# umibot Plugin Upgrade Guide

If you previously installed umibot but are not familiar with `openclaw plugins` commands or npm operations, use the built-in scripts first.

## Option 1: Recommended (Script-based upgrade)

### 1) Upgrade via npm package (easiest, choose either way)

**Way A — direct download and run (no clone required):**

```bash
curl -fsSL https://raw.githubusercontent.com/tencent-connect/umibot/main/scripts/upgrade-via-npm.sh -o /tmp/upgrade-via-npm.sh
bash /tmp/upgrade-via-npm.sh
# or: bash /tmp/upgrade-via-npm.sh --version <version>
```

**Way B — run from local repository:**

```bash
# Upgrade to latest
bash ./scripts/upgrade-via-npm.sh

# Upgrade to a specific version
bash ./scripts/upgrade-via-npm.sh --version <version>
```

> If `--version` is omitted, `latest` is used by default.

### 2) One-click upgrade from local source and restart

> Note: this script must be run inside this repository (it installs via `openclaw plugins install .`).

```bash
# Run directly if you already have config
bash ./scripts/upgrade-via-source.sh

# First install / first-time config (appid and secret are required)
bash ./scripts/upgrade-via-source.sh --appid your_appid --secret your_secret
```

> Note: For first-time installation, you must provide `appid` and `secret` (or set `QQBOT_APPID` / `QQBOT_SECRET`); for subsequent upgrades with existing config, run `bash ./scripts/upgrade-via-source.sh` directly.

---

## Option 2: Manual upgrade (for users familiar with openclaw / npm)

### A. Install latest from npm directly

```bash
# Optional: uninstall old plugins first (based on your actual installation)
# Run `openclaw plugins list` to check installed plugin IDs
# Common legacy plugin IDs: umibot / umibot
# Corresponding npm packages: @sliverp/umibot / @mili-wang/umibot
openclaw plugins uninstall umibot
openclaw plugins uninstall umibot

# If you installed other umibot-related plugins, uninstall them as well
# openclaw plugins uninstall <other-plugin-id>

# Install latest
openclaw plugins install @mili-wang/umibot@latest

# Or install a specific version
openclaw plugins install @mili-wang/umibot@<version>
```

### B. Install from source directory

```bash
cd /path/to/umibot
npm install --omit=dev
openclaw plugins install .
```

### C. Configure channel (required for first install)

```bash
openclaw channels add --channel umibot --token "appid:appsecret"
```

### D. Restart gateway

```bash
openclaw gateway restart
```

### E. Verify

```bash
openclaw plugins list
openclaw channels list
openclaw logs --follow
```
