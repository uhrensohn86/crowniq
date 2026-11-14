# UI Phase 2 – Feinschliff

Branch: fix/ui-phase2-polish. Ausgangspunkt: d965052.

- Schnellmessung: weniger wiederholte Überschriften, kompakter Startbereich und drei Messwerte nebeneinander; Quelle bleibt aufklappbar und Qualitätsstatus sichtbar.
- Einheitliche Crowniq-Kopfzeile mit Themewechsel und neuer Uhr.
- Singular bei einer Uhr; leere Werktyp-/Preisfelder in Fotokacheln entfallen. Preis 0 bleibt sichtbar.
- Keine Änderungen an Messalgorithmus, 90-Sekunden-Dauer, Datenbankschema oder Galeriebedienung.

## Separate Installation

Crowniq zuerst mit Strg+C stoppen. ZIP in einen neuen Ordner ~/crowniq-ui-polish entpacken. prepare-ui-test.py kopiert bevorzugt ~/crowniq-ui-test/data, ansonsten ~/crowniq-tgbc-test/data. Vorhandene Zieldaten bleiben erhalten; Quelldaten werden nicht verändert. Produktive Daten werden nicht automatisch übernommen. Kopierte SQLite-Daten werden auf Integrität und Fremdschlüssel geprüft.

```sh
python prepare-ui-test.py
npm ci --ignore-scripts --no-audit --no-fund
npm run build
bash start-ui-test.sh
```

Danach http://[::1]:3000 öffnen und neu laden. Rückkehr: neue Testversion stoppen und bisherige Version im bisherigen Ordner starten. Enthaltenes Git-Bundle bewahrt Entwicklungsstände. Kein Release und kein Push.

## Prüfung

Vite-Build, Node-Tests für Mikrofon-/Messfluss einschließlich identischer Quick-/Expert-Auswertung und Python-Tests für Migration und sichere Testdatenkopie. Visuelle Prüfung auf dem Android-Gerät bleibt erforderlich. Galeriebedienung per Wischen/Pfeilen wurde vom Nutzer bereits für den vorherigen Stand bestätigt.
