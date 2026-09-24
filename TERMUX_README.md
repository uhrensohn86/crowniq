# Crowniq Local v1 — Termux

Diese Variante arbeitet vollständig lokal auf dem Android-Gerät. Externe Backend-Dienste werden zur Laufzeit nicht benötigt.

## Installation
1. ZIP nach `~/crowniq` entpacken.
2. In Termux: `cd ~/crowniq && ./install-termux.sh`
3. Start: `./start.sh`
4. Browser: `http://127.0.0.1:3000`

Daten liegen unter `~/crowniq/data/crowniq.db`, Bilder unter `~/crowniq/data/images/`.

## Backup
Bei beendetem Crowniq genügt das Sichern des kompletten `data/`-Ordners. Der JSON-Export in Einstellungen enthält jetzt auch die Tragehistorie, aber die Bilddateien selbst bleiben im `data/images/`-Ordner.

## Hinweis
Dies ist v1 des lokalen Ports. Login/Cloud-Synchronisierung sind absichtlich entfernt. Die bestehende Crowniq-Oberfläche bleibt weitgehend unverändert.
