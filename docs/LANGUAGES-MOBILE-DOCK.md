# Sprachen und mobiles Menü

Branch: fix/languages-mobile-dock. Basis: 3db2eee.

## Änderungen

- Die eingebettete Zeitwaage erhält die App-Sprache explizit. Deutsch, Englisch, Französisch und Spanisch decken Schnell-/Expertenmodus, Mikrofonzuordnung, Positionen, Status, Diagnose, Ergebnis, Fehler und zugängliche Beschriftungen ab.
- Statische Texte werden einmal beim Laden übersetzt. Dynamische Texte verwenden explizite Übersetzungsaufrufe. Diagnosemeldungen werden ausschließlich an der Anzeigegrenze übersetzt. Gerätebezeichnungen und Nutzerdaten bleiben unverändert.
- Fehlende Übersetzungen für Darstellung, Dashboard-Auswahl, ZIP-Sicherung einschließlich Wiederherstellungsbestätigung, Themes und 404 ergänzt; deutscher Titel „Trageprotokoll“.
- Das gemeinsame Menü folgt der VisualViewport-Höhe und deren Versatz mit 12 px unterem Abstand. Resize/Scroll und veränderte Menühöhe werden berücksichtigt. Ohne VisualViewport wird die Fensterhöhe verwendet.
- Lange Navigationsbeschriftungen überlappen nicht mehr. Französisch nutzt mobil „Mesure“, Spanisch „Medición“; der vollständige Name bleibt als zugängliche Beschriftung erhalten.

## Unverändert

90-Sekunden-Dauer, Messalgorithmus, Qualitätskriterien, gespeicherte Werte und Datenbankschema. Keine Änderung an analyzer.mjs, session.mjs oder stabilization.mjs. Keine persönlichen Daten im Paket, kein Release oder Push.

## Prüfungen

- Vite-Produktionsbuild erfolgreich.
- Acht Node-Tests inklusive Sprach-/Platzhalterabdeckung und Mikrofonmessung.
- Mikrofonablauf zusätzlich auf Englisch, Französisch und Spanisch; Quick-/Expert-Ergebnisse identisch, Quellenmetadaten und Abbruchfälle geprüft.
- Drei Python-Tests für Migration und sichere Kopie.
- DOM-Tests: französische Schnell-/Expertenoberfläche, zugängliche Beschriftungen, dynamische Diagnose; gleiche Settings-Schlüssel je Sprache; Menüposition bei Größen-/Offsetänderung; Navigation und Audio-Abbau.
- Keine physische Prüfung mit Android-Firefox durchgeführt. Ein-/Ausblenden der Browserleiste, Tastatur und Geräteausrichtung bitte am Gerät testen.

## Separate Installation

Crowniq stoppen. Paket in den neuen Ordner ~/crowniq-ui-languages entpacken. prepare-ui-test.py kopiert zuerst ~/crowniq-ui-navigation/data, mit Rückfall auf die früheren Testordner. Vorhandene Zieldaten werden nicht überschrieben. Quelldaten bleiben unverändert; eine kopierte Datenbank wird vor Übernahme geprüft.

```sh
python prepare-ui-test.py
npm ci --ignore-scripts --no-audit --no-fund
npm run build
bash start-ui-test.sh
```

http://[::1]:3000/dashboard neu laden. Sprache umstellen, Zeitwaage und Einstellungen prüfen, auf langen und kurzen Seiten scrollen. Eine TGBC-Messung samt Quellenangabe speichern. Zum Zurückwechseln neue Testversion stoppen und bisherige Version aus ihrem unveränderten Ordner starten.
