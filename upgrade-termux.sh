#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
TARGET="${1:-$HOME/crowniq}"
SOURCE="$(cd "$(dirname "$0")" && pwd)"
if [ ! -f "$TARGET/data/crowniq.db" ]; then
  echo "Hinweis: Keine bestehende crowniq.db gefunden; Update wird trotzdem fortgesetzt."
fi
BACKUP="$HOME/crowniq-data-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
if [ -d "$TARGET/data" ]; then cp -a "$TARGET/data/." "$BACKUP/"; fi
printf 'Daten-Backup: %s\n' "$BACKUP"
# Programmdateien aktualisieren, Nutzerdaten niemals überschreiben.
for item in "$SOURCE"/* "$SOURCE"/.[!.]* "$SOURCE"/..?*; do
  [ -e "$item" ] || continue
  name="$(basename "$item")"
  case "$name" in data|node_modules|.git) continue ;; esac
  rm -rf "$TARGET/$name"
  cp -a "$item" "$TARGET/$name"
done
cd "$TARGET"
echo "Abhängigkeiten prüfen …"
npm install
echo "Crowniq v1.1.4 bauen …"
npm run build
echo "Fertig. Deine Daten liegen unverändert in $TARGET/data"
echo "Start: cd $TARGET && ./start.sh"
