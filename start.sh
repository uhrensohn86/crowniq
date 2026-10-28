#!/data/data/com.termux/files/usr/bin/bash
# Crowniq v1.2.0: Python API + Vite production preview in one Termux session.
set -Eeuo pipefail

PROJECT="$HOME/crowniq"
API_PORT=8788
WEB_PORT=3000
API_PID=""
WEB_PID=""

cd "$PROJECT" || { echo "FEHLER: $PROJECT fehlt." >&2; exit 1; }

if [[ ! -f local_server.py || ! -f package.json || ! -f dist/server/server.js ]]; then
  echo "FEHLER: Projektdateien oder Build fehlen. Es wird nichts installiert." >&2
  exit 1
fi

for port in "$API_PORT" "$WEB_PORT"; do
  if curl -fsS --max-time 2 "http://[::1]:$port/" >/dev/null 2>&1 || \
     curl -sS --max-time 2 "http://[::1]:$port/" >/dev/null 2>&1; then
    echo "FEHLER: Auf Port $port antwortet bereits ein Server." >&2
    echo "Bitte bestehende Crowniq-Prozesse zuerst beenden; es wird nichts überschrieben." >&2
    exit 1
  fi
done

LOG_DIR="$PREFIX/tmp"
mkdir -p "$LOG_DIR"
API_LOG="$LOG_DIR/crowniq-api.log"
WEB_LOG="$LOG_DIR/crowniq-web.log"

cleanup() {
  trap - EXIT INT TERM
  echo
  echo "Crowniq wird beendet ..."
  if [[ -n "$WEB_PID" ]]; then
    kill "$WEB_PID" 2>/dev/null || true
    wait "$WEB_PID" 2>/dev/null || true
  fi
  if [[ -n "$API_PID" ]]; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
  echo "Crowniq beendet."
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

python local_server.py >"$API_LOG" 2>&1 &
API_PID=$!
sleep 2
if ! kill -0 "$API_PID" 2>/dev/null; then
  echo "FEHLER: Python-API wurde beendet. Log:" >&2
  tail -n 30 "$API_LOG" >&2
  exit 1
fi

echo "Python-API gestartet (PID $API_PID, Port $API_PORT)."

# exec replaces the npm shell with the preview process, so killing the
# tracked process also stops the web server when Ctrl+C is pressed.
(
  exec ./node_modules/.bin/vite preview --host ::1 --port "$WEB_PORT" --strictPort
) >"$WEB_LOG" 2>&1 &
WEB_PID=$!

for i in 1 2 3 4 5 6 7 8 9 10; do
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    echo "FEHLER: Webserver wurde beendet. Log:" >&2
    tail -n 30 "$WEB_LOG" >&2
    exit 1
  fi
  if curl -sS --max-time 2 "http://[::1]:$WEB_PORT/" >/dev/null 2>&1; then
    echo "Webserver gestartet (PID $WEB_PID, Port $WEB_PORT)."
    echo
    echo "Crowniq: http://[::1]:$WEB_PORT"
    echo "Zum Beenden Ctrl+C druecken."
    echo "Logs: $API_LOG und $WEB_LOG"
    wait "$WEB_PID" || exit $?
    exit 0
  fi
  sleep 1
done

echo "FEHLER: Webserver antwortet nicht. Log:" >&2
tail -n 30 "$WEB_LOG" >&2
exit 1
