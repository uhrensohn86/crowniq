#!/data/data/com.termux/files/usr/bin/bash
# Crowniq Git upgrade helper: check by default; explicit --apply required.
# Never replaces data/ with repository content.
set -Eeuo pipefail
umask 077

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

fail() { printf 'FEHLER: %s\n' "$*" >&2; exit 1; }
usage() {
  cat <<'USAGE'
Crowniq Git-Update
  bash upgrade-termux.sh --check   Aktualisierungen nur prüfen (Standard)
  bash upgrade-termux.sh --apply   Fast-forward-Update nach Testbuild und Datensicherung

Vor --apply Crowniq mit Strg+C stoppen und ein aktuelles ZIP-Backup extern sichern.
USAGE
}

mode="${1:---check}"
case "$mode" in
  --check|--apply) [[ $# -le 1 ]] || fail 'Zu viele Argumente.' ;;
  --help|-h) usage; exit 0 ;;
  *) usage; fail "Unbekannte Option: $mode" ;;
esac

for cmd in git npm node python tar mktemp cp; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Fehlendes Programm: $cmd"
done
[[ -d .git ]] || fail 'Kein Git-Repository. Bitte erst die GitHub-Installation einrichten.'
[[ "$(git branch --show-current)" == main ]] || fail 'Sicherheitsstopp: Aktiver Branch ist nicht main.'
git remote get-url origin >/dev/null 2>&1 || fail 'Remote origin fehlt.'
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || fail 'Git-Arbeitsverzeichnis enthält Änderungen. Erst committen/stashen und prüfen.'

printf 'Hole GitHub-Stand für origin/main ...\n'
git fetch --no-tags origin main
old="$(git rev-parse HEAD)"
new="$(git rev-parse origin/main)"
if [[ "$old" == "$new" ]]; then
  printf 'Bereits auf GitHub-Stand: %s\n' "${old:0:12}"
  exit 0
fi
git merge-base --is-ancestor "$old" "$new" || fail 'Kein Fast-forward möglich. Kein Update durchgeführt.'
printf 'Aktueller Commit: %s\nNeuer Commit:    %s\n' "${old:0:12}" "${new:0:12}"
git diff --stat "$old" "$new"

if [[ "$mode" == --check ]]; then
  printf '\nKeine Programmdateien geändert. Für ein Update erst Crowniq stoppen und --apply aufrufen.\n'
  exit 0
fi

# Check ports without relying on curl's HTTP status code.
python - <<'PY'
import socket, sys
for port in (3000, 8788):
    with socket.socket(socket.AF_INET6, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        try:
            s.connect(('::1', port))
        except (OSError, TimeoutError):
            continue
        print(f'FEHLER: Port {port} ist belegt. Crowniq zuerst mit Strg+C stoppen.', file=sys.stderr)
        sys.exit(2)
PY

[[ ! -e .restore-journal.json ]] || fail 'Restore-Journal erkannt: zuerst Restore-Zustand klären.'
[[ ! -e .restore-stage-data ]] || fail 'Restore-Staging erkannt: zuerst Restore-Zustand klären.'
[[ ! -e .restore-live-displaced ]] || fail 'Restore-Zwischenzustand erkannt.'

# Validate new source before affecting production code or data.
stage="$(mktemp -d "$HOME/.crowniq-upgrade-stage.XXXXXXXX")"
cleanup() { [[ -n "${stage:-}" && -d "$stage" ]] && rm -rf -- "$stage"; }
trap cleanup EXIT
printf '\n[1/4] Neuer Git-Stand im temporären Verzeichnis bauen ...\n'
git archive "$new" | tar -x -C "$stage"
(
  cd "$stage"
  [[ -f package-lock.json ]] || fail 'Neue Version enthält keine package-lock.json.'
  npm ci --no-audit --no-fund
  npm run build
  [[ -s dist/server/server.js ]] || fail 'Buildtest: dist/server/server.js fehlt.'
)

printf '\n[2/4] Bestehende persönliche Daten separat sichern ...\n'
backup="$(mktemp -d "$HOME/crowniq-upgrade-backup-$(date +%Y%m%d-%H%M%S).XXXXXXXX")"
if [[ -d data ]]; then
  cp -a data "$backup/data"
  if [[ -f "$backup/data/crowniq.db" ]]; then
    python - "$backup/data/crowniq.db" <<'PY'
import sqlite3, sys
from pathlib import Path
p = Path(sys.argv[1])
c = sqlite3.connect('file:' + str(p) + '?mode=ro', uri=True)
try:
    if c.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
        raise SystemExit('FEHLER: Sicherung der SQLite-Datenbank ist nicht konsistent')
    if c.execute('PRAGMA foreign_key_check').fetchall():
        raise SystemExit('FEHLER: Fremdschlüsselprüfung der Sicherung fehlgeschlagen')
finally:
    c.close()
print('Datenbanksicherung: SQLite integrity_check und foreign_key_check OK')
PY
  fi
fi
printf 'Datenkopie (nicht automatisch löschen): %s\n' "$backup"

printf '\n[3/4] Code per Git-Fast-forward aktualisieren ...\n'
git merge --ff-only "$new"

printf '\n[4/4] Abhängigkeiten und Frontend im Projekt erneuern ...\n'
if ! npm ci --no-audit --no-fund || ! npm run build || [[ ! -s dist/server/server.js ]]; then
  printf '\nACHTUNG: Der neue Commit wurde übernommen, aber die lokale Installation/der Build ist fehlgeschlagen.\n' >&2
  printf 'Datensicherung: %s\n' "$backup" >&2
  printf 'Alter Commit zur gezielten Wiederherstellung: %s\n' "$old" >&2
  printf 'Keine automatische Rücksetzung durchgeführt; bitte Fehler prüfen, bevor Crowniq gestartet wird.\n' >&2
  exit 1
fi
printf '\nUpdate erfolgreich. Persönliche Daten wurden nicht aus Git überschrieben.\n'
printf 'Datensicherung: %s\n' "$backup"
printf 'Start: bash start.sh\n'
