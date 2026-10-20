# Crowniq

Crowniq is a local-first, mobile-friendly watch collection manager. The Termux edition stores collection information and watch images on the device. It does **not** require a Crowniq account or a cloud database.

**Project status:** The existing release marker is `1.1.4` (`VERSION.txt`). This repository also contains **post-v1.1.4 development improvements**, including the local backup/restore V3 workflow. No new numbered release is claimed until a clean-install test and release review are complete.

## Features

- Watch catalogue with brand, model, reference, technical details and purchase information
- Discounts, cashback, effective acquisition costs and optional market/insurance values
- Multiple pictures per watch, configurable cover picture and image ordering
- Searchable, filterable collection views and dashboard statistics
- Wear history, light/dark appearance and multilingual interface
- Local Python REST API, SQLite database and local image storage
- CSV/JSON data export and **complete ZIP backup including the SQLite database and images**
- ZIP-backup preview/validation before restore
- Confirmed restore with pre-restore safety copy, storage-space checks and crash-recovery handling

**Note:** An Excel sheet has been imported successfully into one local Crowniq collection with a separate, one-off Termux script. **General XLSX import is not yet part of the application UI or the repository's standard installation.**

## Installation on Android / Termux

Use an up-to-date Termux installation from a trusted distribution (such as F-Droid). The default scripts assume the project lives at `~/crowniq`.

```bash
pkg update
pkg install git nodejs python

git clone https://github.com/uhrensohn86/crowniq.git ~/crowniq
cd ~/crowniq
bash install-termux.sh
bash start.sh
```

Open **http://[::1]:3000** in the browser on the **same Android device**. The browser UI uses the local Python API at **http://[::1]:8788**. On the tested Android configuration, IPv6 loopback (`[::1]`) works more reliably than IPv4 `127.0.0.1`.

`start.sh` expects an existing build under `dist/`. Installation performs `npm ci` using the committed `package-lock.json` and then `npm run build`. It must not erase an existing `data/` directory.

For device-specific instructions, see [TERMUX_README.md](TERMUX_README.md).

## Where your information lives

```text
~/crowniq/data/crowniq.db          # SQLite collection database
~/crowniq/data/images/             # Uploaded image files
~/crowniq/.restore-safety-backups/  # Automatic pre-restore safety copies
```

These locations are **private user data**, not source code. Do not upload them to GitHub or include them in support reports. `.gitignore` excludes `data/` and restore backups, but always review `git status` / `git diff --cached --name-only` before publishing.

## Backup and recovery

In **Settings → Backup & Export** you can download a complete ZIP archive. It contains a SQLite snapshot, the image files and a manifest with cryptographic hashes. Use the ZIP-preview feature to validate a saved archive before restoring it.

A confirmed restore **replaces the current collection** with the ZIP content. This means changes added after the backup — including wear history — will no longer appear in the active collection. Before replacement, Restore V3 keeps a separate copy of the existing data under `.restore-safety-backups/`. It also checks required free space and uses a recovery journal for interrupted operations. Safety copies are not automatically pruned; review them before manually cleaning up disk space.

**Do not test a restore on important data just to see if it works.** The restoration flow has been tested in an isolated Termux environment with separate frontend/backend ports and with simulated interruptions. The production route also rejects requests without the explicit confirmation header. Keep an additional copy of important ZIP backups outside the device.

JSON and CSV exports are useful for portable tabular information, but **they are not a replacement for the complete ZIP** when images and all relationships matter.

## Updating

The repository includes `upgrade-termux.sh` for **Git-based, fast-forward updates**. The updated helper performs a dry-run/check by default and requires an explicit `--apply` to change a working installation. Stop Crowniq before applying an update and keep a current ZIP backup outside the device.

```bash
cd ~/crowniq
bash upgrade-termux.sh --check
# After reviewing the update and stopping Crowniq:
bash upgrade-termux.sh --apply
```

For manual source development and builds:

```bash
npm ci
npm run build
```

Never overwrite a production `data/` folder with data from the repository, an example ZIP or a test installation.

## Architecture and security boundaries

- **Frontend:** React/Vite; production preview bound to IPv6 loopback on port `3000`
- **Backend:** Python standard-library HTTP server with SQLite, bound to IPv6 loopback on port `8788`
- **Authentication:** There is **no multi-user login or authorization layer** in the local edition
- **Network exposure:** Do not expose port `8788` directly on a LAN or the public internet; the local-only design is not a hardened public service
- **External resources:** The UI currently requests display fonts from Google Fonts. A strictly offline / zero-third-party-request deployment needs local or system fonts

Linux/LXC hosting is a future goal and is **not yet documented as a production-tested deployment**.

## Development and contributions

```bash
npm ci
npm run dev
npm run build
```

The frontend and backend must be started/configured consistently for local development. Avoid sharing real user collections when filing issues; use synthetic sample data instead. More screenshots and release-specific migration notes may be added later.

## License

MIT. See [LICENSE](LICENSE).
