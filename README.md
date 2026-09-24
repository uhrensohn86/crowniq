# Crowniq

**Crowniq** is a self-hosted watch collection manager focused on a clean, mobile-friendly interface. It keeps collection data and images locally and does not require a cloud account for the local installation.

> Current version: **v1.1.4**

## Features

- Manage watches with brand, model, reference and technical specifications
- Purchase data with MSRP, purchase price, discounts, cashback and effective price paid
- Multiple images per watch with selectable cover image and image ordering
- Collection grid/list views with search, filters and persistent sorting
- Dashboard with collection statistics and configurable tiles
- Wear history
- Light and dark themes
- Multilingual UI
- Local SQLite database and local image storage
- JSON export for collection data and wear history

## Screenshots

Screenshots will be added to the repository documentation soon.

## Termux installation

Crowniq v1.1.4 can be run locally on Android using Termux.

### Requirements

Use the official Termux packages. The installer installs Node.js and Python through Termux's package manager; JavaScript dependencies are installed from the project's `package.json`.

### Install

```bash
cd ~/crowniq
chmod +x install-termux.sh start.sh upgrade-termux.sh
./install-termux.sh
```

Then start Crowniq:

```bash
cd ~/crowniq
./start.sh
```

Open `http://127.0.0.1:3000` in the browser on the same Android device.

## Data and backups

Persistent local data is stored in:

```text
data/crowniq.db
data/images/
```

Back up the complete `data/` directory while Crowniq is stopped. The JSON export includes collection data and wear history, but not the image files themselves.

**Do not commit your personal `data/` directory to Git.** It is excluded by `.gitignore`.

## Updating an existing Termux installation

The included `upgrade-termux.sh` is intended to preserve the existing local data directory while updating the application. Make a backup before upgrades anyway.

## Self-hosting

Crowniq is currently tested as a local Termux installation. A minimal Linux/LXC deployment is planned. Public internet exposure, multi-user accounts and cloud synchronization are not required for the current local-first use case.

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Project status

Crowniq is under active development. v1.1.4 is the first version prepared for publication as a Git repository. Expect changes while the local/self-hosted architecture is refined.

## License

MIT License. See `LICENSE`.

## Security & privacy

Crowniq is currently designed as a local, single-user application. The bundled API binds to `127.0.0.1` only and is not intended to be exposed directly to a LAN or the public internet. Local collection data and uploaded images live under `data/`, which is excluded from Git. No login, sign-up, email address, password handling, API key, or Supabase credential is required.

The UI currently loads its display fonts from Google Fonts. If you require a fully offline/no-third-party-request setup, replace that import with local/system fonts before deployment.
