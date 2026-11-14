# Zeitwaage: gemeinsame Navigation

Branch fix/timegrapher-navigation, Basis a526355.

## Ursache und Änderung
Die separate statische Zeitwaage verließ die React-App. Ein vollständiger Dokumentwechsel und eine zweite Navigation verursachten sichtbare Unterschiede in Symbolen, Farben und beim Laden.

Die neue Route /timegrapher nutzt AppLayout mit derselben Kopfzeile und Navigation wie Dashboard, Uhren, Tragen und Einstellungen. Die bestehende Messoberfläche ist als gleichursprüngliches Dokument eingebettet; deren eigene Navigation bleibt ausgeblendet. Dashboard und Uhrendetails verwenden Router-Links. Uhrzuordnung bleibt als watchId erhalten. Rücklinks aus der Messoberfläche werden intern navigiert. Die Höhe folgt dem Inhalt; Themeänderungen übernehmen die Farbwerte der App.

Beim Verlassen stoppt die Audioaufnahme. Auch nachträglich erteilte Mikrofonfreigaben werden beendet. Eine laufende oder ungespeicherte Messung wird beim Verlassen wie bisher verworfen. Messdauer, Auswertung und SQLite-Schema bleiben unverändert.

## Installation und Rückkehr
Crowniq zuerst stoppen. ZIP separat nach ~/crowniq-ui-navigation entpacken. prepare-ui-test.py kopiert bevorzugt ~/crowniq-ui-polish/data, alternativ ~/crowniq-ui-test/data oder ~/crowniq-tgbc-test/data. Bestehende Zieldaten werden nicht überschrieben; Originale bleiben erhalten.

```sh
python prepare-ui-test.py
npm ci --ignore-scripts --no-audit --no-fund
npm run build
bash start-ui-test.sh
```

Danach http://[::1]:3000/dashboard neu laden. Zum Zurückwechseln diese Testversion stoppen und die bisherige Version im bisherigen Ordner starten. Keine Veröffentlichung, kein Push. Vollständiger Quellstand und Git-Bundle enthalten; keine persönlichen Daten.

## Validierung
Vite-Produktionsbuild; sieben Node-Tests einschließlich identischer Quick-/Expert-Auswertung und neu geprüfter Freigabe der Audioaufnahme bei Seitenwechsel sowie verspäteter Browserberechtigung; drei Python-Tests für Migration und sichere Datenkopie.

Zusätzlicher DOM-Komponententest: Uhrkontext, automatische Inhaltshöhe, Themeübernahme, interne Rücknavigation sowie pagehide und Observer-Abbau beim Verlassen bestanden.

Noch am Gerät prüfen: wiederholt Dashboard → Zeitwaage → Tragen, gleiche Icons/Aktivfarbe; Hell-/Dunkelmodus in der Zeitwaage; Expertenmodus aufklappen und bis zum Speichern scrollen; TGBC-Messung aus einer Uhr starten und speichern. Die Android-Darstellung und Mikrofonfreigabe im eingebetteten Dokument sind hier nicht physisch getestet.
