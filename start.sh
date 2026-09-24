#!/data/data/com.termux/files/usr/bin/bash
set -e
cd "$(dirname "$0")"
mkdir -p logs data/images
if ! command -v node >/dev/null || ! command -v python >/dev/null; then
  echo "Fehler: nodejs und python müssen installiert sein."; exit 1
fi
if [ ! -d node_modules ]; then
  echo "Abhängigkeiten fehlen. Bitte zuerst ./install-termux.sh ausführen."; exit 1
fi
python local_server.py > logs/api.log 2>&1 & API_PID=$!
cleanup(){ kill "$API_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
sleep 1
echo "Crowniq startet auf http://127.0.0.1:3000"
if [ -f .output/server/index.mjs ]; then
  node .output/server/index.mjs
else
  npm run dev -- --host 127.0.0.1 --port 3000
fi
