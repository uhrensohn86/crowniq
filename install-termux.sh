#!/data/data/com.termux/files/usr/bin/bash
# Crowniq: conservative installer for a freshly cloned Termux project.
# Never removes or modifies data/.
set -Eeuo pipefail
umask 077

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

fail() { printf 'FEHLER: %s\n' "$*" >&2; exit 1; }

[[ -f package.json ]] || fail 'package.json fehlt.'
[[ -f package-lock.json ]] || fail 'package-lock.json fehlt. Ohne geprüfte Lockdatei wird npm ci nicht ausgeführt.'
[[ -f local_server.py ]] || fail 'local_server.py fehlt.'
[[ -f start.sh ]] || fail 'start.sh fehlt.'
command -v pkg >/dev/null 2>&1 || fail 'Dieses Skript ist für Termux mit pkg vorgesehen.'

printf '[1/4] Offizielle Termux-Pakete prüfen\n'
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  pkg install -y nodejs
fi
if ! command -v python >/dev/null 2>&1; then
  pkg install -y python
fi
for cmd in node npm python; do
  command -v "$cmd" >/dev/null 2>&1 || fail "$cmd ist nach der Paketprüfung nicht verfügbar."
done

printf '[2/4] Python-Syntax prüfen (ohne Programmstart)\n'
python - <<'PY'
import ast
from pathlib import Path
ast.parse(Path('local_server.py').read_text(encoding='utf-8'), filename='local_server.py')
print('Python-Backend: Syntax OK')
PY

printf '[3/4] JavaScript-Abhängigkeiten anhand package-lock.json installieren\n'
npm ci --no-audit --no-fund

printf '[4/4] Frontend bauen\n'
npm run build
[[ -s dist/server/server.js ]] || fail 'Buildausgabe dist/server/server.js fehlt.'

printf '\nCrowniq-Installation erfolgreich abgeschlossen.\n'
printf 'Bestehende Daten in %s/data wurden nicht angefasst.\n' "$ROOT"
printf 'Start: cd %q && bash start.sh\n' "$ROOT"
printf 'Browser: http://[::1]:3000\n'
