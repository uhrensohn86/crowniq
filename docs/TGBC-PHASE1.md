# Crowniq – Phase 1: TGBC-Messquelle

Entwicklungsstand vom 13.11.2026, kein Release. Ausgangsbasis: main
8d4c4ae (v1.2.0 plus zweisprachige README). Branch: feature/tgbc-measurement-source.
Keine Veröffentlichung, kein Push und keine Änderung der installierten Sammlung.

## Umsetzung

- Audioeingang als Browser-/Android-Standard oder konkretes verfügbares Mikrofon.
- „Mikrofone erkennen“ holt nach Berechtigung die Geräteliste; der kurz geöffnete
  Prüfstream wird anschließend vollständig geschlossen.
- Zuordnung intern / externes USB-Mikrofon (einschließlich TGBC) / unbekannt.
  Automatisch nur anhand eindeutiger Hinweise im Label des aktiven Audiotracks.
  „Default“, leere Namen, Bluetooth und sonstige unklare Namen bleiben unbekannt.
- Manuelle Zuordnung als Fallback. Diese dokumentiert die Quelle; sie schaltet
  NICHT Androids Hardware-Routing um. Dafür Audioeingang oder Android verwenden.
- Exakte deviceId-Anforderung bei konkreter Auswahl; kein stiller Ersatz bei
  fehlgeschlagenem getUserMedia. Geräte-IDs werden nicht gespeichert.
- Quelle wird vor der Audioauswertung als unveränderlicher Snapshot erfasst;
  während der Messung und bei freigegebenem Ergebnis sind Quellenfelder gesperrt.
- Ein vom Browser gemeldetes Track-Ende bricht die Messung ohne Speicherung ab.
- Messhistorie zeigt Typ, Gerätename und Art der Zuordnung in DE/EN/FR/ES.
  Die eigenständige Zeitwaage bleibt wie bisher deutschsprachig.
- Bestehendes source-Feld (crowniq/manual) bleibt unverändert. Drei nullable
  Spalten werden per ALTER TABLE ergänzt: microphone_type, microphone_label,
  microphone_detection. Alte Messungen bleiben NULL = „Mikrofon nicht erfasst“.
- Keine Tabellen-Neuanlage mit Datenübernahme, kein Löschen/Überschreiben von
  Datensätzen, keine Änderung an Uhren, Bildern oder Restore-Logik.
- Analyzer, SessionCollector, Stabilisierung und AudioWorklet sind bytegleich
  mit main. Weiterhin 30 Sekunden Einmessung + 3 × 20 Sekunden Auswertung.
- UI-Redesign (Phase 2) wurde nicht begonnen.

## Browsergrenzen

Browser liefern keine verlässliche USB-Hardwareklassifikation. Namen sind nur
Hinweise; daher ist die automatische Zuordnung ausdrücklich so gekennzeichnet.
W3C: https://www.w3.org/TR/mediacapture-streams/#dom-mediadeviceinfo-label
Gerätenamen/-listen können vor Berechtigungsfreigabe fehlen. Manche Android-
Browser zeigen trotz angeschlossenem USB nur den Standardeingang. Dann manuell
zuordnen. Ein vom Betriebssystem völlig unsichtbar umgeschalteter Eingang kann
nicht zuverlässig erkannt werden. Während einer Messung nicht umstecken.
Keine zusätzlichen Bibliotheken, Treiber, Audioaufzeichnungen oder Cloud-Dienste.

## Verifikation

Bestanden:

- `npm ci --ignore-scripts --no-audit --no-fund` mit bestehender Lockdatei.
- `npm run build` (Produktionsbuild).
- `node --test tests/*.test.mjs`: fünf Tests einschließlich simuliertem
  Gesamtablauf mit 90 Sekunden synthetischem Audiosignal bis zum POST-Payload,
  Geräteauswahl, Freigabeprobe, manueller Zuordnung, Track-Ende und Ablehnung.
- `python -m unittest discover -s tests -p 'test_*.py'`: Migration einer
  synthetischen Datenbank mit echtem v1.2.0-Schema, unveränderte Originaldaten
  aller Tabellen, wiederholte Migration, neue Quellenfelder, Constraints,
  SQLite-Sicherung sowie Öffnen durch den ursprünglichen v1.2.0-Server.
  Dieser Test benötigt Git-Historie; für ZIP-Nutzer siehe Bundle unten.
- ESLint für die beiden geänderten React-/Übersetzungsdateien.
- JS-Syntaxprüfung, `git diff --check`, unveränderte Messkern-Dateien.

Nicht bestanden / offen:

- Gesamtes `tsc --noEmit`: 48 bestehende Fehler, identisch auf main 8d4c4ae.
  Keine zusätzlichen TypeScript-Fehler durch diese Änderung.
- Echter Browser-/Layout-Test hier nicht ausführbar: Chromium-Start durch
  Umgebungsbeschränkung blockiert. Der Node-Integrationstest nutzt DOM-/Audio-
  Attrappen und ist kein Ersatz für einen realen Browser-/Hardwaretest.
- Android/Firefox mit TGBC muss vor Übernahme in die produktive Installation
  getestet werden. Keine Behauptung einer Hardwarevalidierung.

## Sicherer Test unter Termux

Crowniq zuerst mit Strg+C stoppen (Test nutzt ebenfalls Ports 3000 und 8788).
ZIP in den Downloadordner herunterladen. In einen NEUEN Ordner entpacken:

```sh
test ! -e "$HOME/crowniq-tgbc-test" && unzip "$HOME/storage/downloads/Crowniq-TGBC-Phase1.zip" -d "$HOME" && cd "$HOME/crowniq-tgbc-test" && npm ci --ignore-scripts --no-audit --no-fund && npm run build && bash start-tgbc-test.sh
```

Der Test startet mit leerer Sammlung. Eine Testuhr anlegen. Die bestehende
Installation ~/crowniq und ihre Daten werden weder kopiert noch verändert.
Nicht install-termux.sh oder start.sh im Testordner verwenden, da diese auf
~/crowniq ausgerichtet sind. Der separate Teststarter arbeitet relativ zu sich
selbst und verweigert den normalen Installationspfad/verlinkte Datenordner.

Firefox: http://[::1]:3000 . Wegen gleicher Adresse ggf. Seite neu laden.
1. Ohne TGBC: Mikrofone erkennen, intern auswählen bzw. manuell zuordnen,
   Lage wählen, 90 Sekunden messen, speichern und Historie prüfen.
2. TGBC anschließen: Erkennung aktualisieren, USB-Eingang auswählen (falls
   angeboten), aktive Quelle prüfen. Bei fehlendem Namen „USB (manuell)“.
3. 90 Sekunden messen, speichern, Historie und Quelle nach Neustart prüfen.
4. Zugriff ablehnen / USB trennen: Fehlermeldung und gesperrtes Speichern prüfen.
5. Demo bleibt nicht speicherbar; vorzeitig beendete Messungen ebenfalls.

Rückkehr: Test mit Strg+C stoppen, `cd ~/crowniq && bash start.sh`.
Die produktive Installation blieb unverändert. Kein Restore erforderlich.
Vor einer späteren produktiven Übernahme ein ZIP-Backup in Crowniq exportieren,
extern sichern und den Server stoppen. Diese Übernahme ist nicht Teil des Teststarts.

## Git-Historie und vollständige Dateien

Das Paket enthält sämtliche getrackten Quelldateien sowie crowniq-tgbc.bundle
mit dem Entwicklungsbranch, main und vorhandenen Release-Tags. Keine Nutzerdaten,
node_modules oder Buildprodukte. Für vollständige Git-Historie und Migrationstest:

```sh
git clone -b feature/tgbc-measurement-source ~/crowniq-tgbc-test/crowniq-tgbc.bundle ~/crowniq-tgbc-review
cd ~/crowniq-tgbc-review
python -m unittest discover -s tests -p 'test_*.py'
```

main und v1.2.0 bleiben im Bundle unverändert verfügbar. Ein bestehendes Backup
nicht über eine aktuelle Sammlung zurückspielen, um allein Programmcode
zurückzusetzen: das könnte neuere Daten verlieren. Der alte Server kann die
zusätzlichen Spalten ignorieren; Rückwärtslesen wurde synthetisch getestet.
