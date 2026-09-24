#!/data/data/com.termux/files/usr/bin/bash
set -e
cd "$(dirname "$0")"
echo "[1/4] Termux-Pakete aktualisieren"
pkg update -y
pkg install -y nodejs python

echo "[2/4] JavaScript-Abhängigkeiten installieren"
npm install

echo "[3/4] Crowniq bauen"
npm run build

echo "[4/4] Fertig"
echo "Start: ./start.sh"
echo "Dann im Browser: http://127.0.0.1:3000"
