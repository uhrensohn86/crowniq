# Crowniq – UI-Redesign, Phase 2 (Teststand)

Stand: 14.11.2026. Branch: `feature/crowniq-ui-phase2`.
Basis: TGBC-Commit `6e8b2bb` aus Phase 1, aufgebaut auf main `8d4c4ae`.
Kein Release, kein Push, keine Änderung an der installierten Sammlung.

## Enthalten

- Schwebende Smartphone-Navigation: Dashboard, Uhren, Tragen, Zeitwaage,
  Einstellungen. Auf großen Displays bleibt die Navigation in der Kopfzeile.
  Abstand zum unteren Bildschirmrand inklusive Safe Area; Inhaltsabstand verhindert
  Überdeckung der letzten Zeilen durch die Navigationsleiste.
- Warme Elfenbein-/Goldgestaltung und abgestimmte dunkle Oberflächen. Der
  Kopfzeilen-Schalter wechselt Hell/Dunkel. OLED und das bisherige Zeitwaagen-Theme
  bleiben in den Einstellungen auswählbar. Gespeicherte Themes werden beim Start
  nicht mehr vorzeitig durch den Initialwert überschrieben.
- Lokale System-/Serifenschriften; die Google-Fonts-Einbindung entfällt.
- Dashboard: bestehende Kennzahlen und Diagramme bleiben erhalten. Hinzu kommen
  Schnellzugriffe und eine Fotokarte der zuletzt getragenen Uhr (echter Tragetag,
  keine erfundenen Tragezeiten). Ohne Tragetag wird ein entsprechender Link gezeigt.
- Uhren: Fotokacheln mit lesbarem Verlauf, Marke/Modell, Preis und Werktyp je nach
  Kachelgröße. Zwei Spalten auf Smartphones, falls keine Spaltenpräferenz vorliegt.
  Vorhandene Spaltenpräferenzen bleiben erhalten. Listenansicht, Suche, Marken- und
  Werkfilter, Sortierung und Spaltenwahl bleiben verfügbar. Erweiterte Filter und
  Ansichtseinstellungen sind aufklappbar; Werktypen zusätzlich als Filterchips.
- Details: größere Bildfläche, horizontale Vorschaubilder, Sprunglinks zu Technik,
  Messungen und vorhandenen Notizen. Alle bisherigen Datenfelder und Aktionen bleiben.
  Kein neuer Favoritenstatus und keine erfundenen Daten aus den Designbildern.
- Galerie: öffnet das angetippte Bild; Vor/Zurück-Pfeile, Bildzähler, Wischen,
  Pfeiltasten und Esc. Nach dem letzten Bild beginnt sie wieder beim ersten.
  Fokusführung über Radix Dialog; beim Schließen Fokus zurück zum Vorschaubild.
  Zwei-Finger-Gesten lösen keinen Bildwechsel aus. Bei nur einem Bild keine Pfeile.
  Fehlende/defekte Bilder erhalten einen Platzhalter.
- TGBC-Quellenangabe in der Historie kompakt; Zuordnungsart und Browser-Gerätename
  stehen unter aufklappbaren „Details zur Messquelle“.

## Zeitwaage: zwei Ansichten, eine Auswertung

Standard ist „Schnelle Messung“. Keine Positionsauswahl; die Oberfläche weist
auf „Zifferblatt oben“ hin und speichert genau diese Lage. Mikrofonquelle und
Eingang können im aufklappbaren Bereich weiterhin geprüft/geändert werden.
Eine bewusst manuell gesetzte Mikrofonzuordnung wird lokal vorbelegt und sichtbar
als solche gekennzeichnet. Das ist keine Bestätigung des tatsächlichen Android-
Audio-Routings. Geräte-IDs werden weiterhin nicht gespeichert.

Im Expertenmodus bleiben die sechs Messlagen, Anzeigeruhe, Kurven, Diagnosen und
Demo verfügbar. Die Expertenlage wird beim Umschalten innerhalb der Seite behalten;
bei Rückkehr zu Schnell gilt stets Zifferblatt oben. Während einer Messung und bei
noch angezeigtem freigegebenem Ergebnis sind die Modusschalter gesperrt. Erst
„Neue Messung“ oder „Zurücksetzen“ gibt sie wieder frei.

Beide Ansichten verwenden denselben SessionCollector: 30 Sekunden Einmessung plus
3 × 20 Sekunden Auswertung. Keine kürzere Schnellmessung. Analyzer, Session,
Stabilisierung und AudioWorklet sind gegenüber Phase 1 unverändert. Demo- und
vorzeitig beendete Messungen sind weiterhin nicht speicherbar.
Amplitude/Hebewinkel bleiben manuelle Eingabefelder; keine neue Berechnung.

## Sicherheit und Wiederherstellung

`local_server.py` ist gegenüber Phase 1 bytegleich. Es gibt in Phase 2 keine neue
Datenbankmigration und keine Umstrukturierung gespeicherter Daten. Der Test nutzt
`~/crowniq-ui-test`, niemals die produktive Installation `~/crowniq`.

`prepare-ui-test.py` prüft, dass die lokalen Crowniq-Ports frei sind. Falls vorhanden,
kopiert es ausschließlich die frühere Testsammlung `~/crowniq-tgbc-test/data` in
noch nicht vorhandene UI-Testdaten. Die Kopie wird auf SQLite-Integrität und
Fremdschlüssel geprüft. Bestehende Zieldaten werden nicht ersetzt; Quelldaten nie
verändert. Verlinkte Quelldaten werden abgelehnt. Ohne alte Testsammlung startet
Crowniq leer; dann eine Testuhr anlegen. Es werden keine echten Sammlungen automatisch
übernommen.

Das ZIP enthält vollständige getrackte Quellen und `crowniq-ui.bundle` mit dem
Phase-2-Branch, Phase 1, main und bisherigen Release-Tags. Es enthält keine Sammlung,
Datenbank, hochgeladenen Bilder, node_modules oder Buildprodukte.

## Start unter Termux

1. Laufendes Crowniq (auch Phase-1-Test) mit Strg+C stoppen.
2. `Crowniq-UI-Phase2.zip` in den Android-Downloadordner herunterladen.
3. Einmalig ausführen:

```sh
test ! -e "$HOME/crowniq-ui-test" &&
unzip "$HOME/storage/downloads/Crowniq-UI-Phase2.zip" -d "$HOME" &&
cd "$HOME/crowniq-ui-test" &&
python prepare-ui-test.py &&
npm ci --ignore-scripts --no-audit --no-fund &&
npm run build &&
bash start-ui-test.sh
```

Adresse: `http://[::1]:3000`. Seite in Firefox neu laden, damit die neue Oberfläche
angezeigt wird. Bestehende Einstellungen wie Sprache, Theme und Spaltenzahl werden
wegen derselben lokalen Adresse weiterhin übernommen.

Zum späteren Neustart:

```sh
cd ~/crowniq-ui-test && bash start-ui-test.sh
```

Falls der Erstbuild scheitert, dessen Fehler prüfen; nicht erneut in bestehende
Verzeichnisse entpacken. Der Installationsbefehl verweigert einen bereits vorhandenen
Testordner bewusst. Kein automatisches Löschen oder Rücksetzen.

Rückkehr zur produktiven Version: Test mit Strg+C stoppen, dann:

```sh
cd ~/crowniq && bash start.sh
```

Rückkehr zum Phase-1-Test: entsprechend `cd ~/crowniq-tgbc-test && bash start-tgbc-test.sh`.
Die dortigen Daten sind unverändert. Nicht `install-termux.sh` oder das ursprüngliche
`start.sh` im neuen Testordner verwenden: Diese sind auf ~/crowniq ausgerichtet.

## Tests und Grenzen

Bestanden:

- Produktionsbuild mit unveränderter Lockdatei und ohne neue App-Abhängigkeiten.
- Sieben Node-Tests: Quellenzuordnung, Gerätauswahl, Fallbacks, Track-Ende,
  Berechtigungsablehnung, sichere Präferenzen und Modus-/Positionszuordnung.
- Integrationstest mit 90 Sekunden synthetischem Signal in beiden Ansichten:
  identische Gang-, Abfallfehler-, Schlagzahl-, Qualitäts- und Streuungswerte;
  ausschließlich die gewählte Position unterscheidet sich.
- DOM-Komponententest mit jsdom 31.0.1: Galerie öffnen, Pfeile, Umlauf, Tastatur,
  Wischen, Ausschluss von Pinch-Gesten, Esc, Fokus-Rückgabe, ein/kein Bild sowie
  Theme-Persistenz und Hell-/Dunkelwechsel.
- Drei Python-Tests: additive Phase-1-Migration und Rückwärtskompatibilität sowie
  sichere Kopie der Testdaten ohne Ersetzen bestehender Daten.
- JavaScript-/Shell-Syntax, Whitespace-Prüfung und ESLint der neuen/geänderten
  gemeinsamen Komponenten (keine Fehler; bekannte Fast-Refresh-Warnung beim Theme).
- Vergleich mit main: dieselben 48 bestehenden TypeScript-Diagnosen, abgesehen
  von verschobenen Zeilennummern. Keine neuen Typfehler; Gesamtprüfung weiterhin rot.

Die Browserprüfung der laufenden Oberfläche konnte hier nicht abgeschlossen werden:
Die lokale Vorschau war nicht erreichbar; ein weiterer Browserzugriff wurde durch
Browserrichtlinien blockiert. Es gab keine Umgehung. Die DOM-Tests prüfen Verhalten,
aber kein echtes Layout, keine tatsächlichen Touchgesten und keine Hardware.

Noch auf dem Poco/Firefox prüfen:

1. Dashboard, Uhrenübersicht und Navigation in Hell/Dunkel; keine Überdeckung
   am unteren Rand. Vorhandene Filter, Sortierungen und Listenansicht testen.
2. Einer Testuhr mindestens zwei Bilder hinzufügen. Zweites Bild öffnen,
   vor/zurück wischen, Pfeile nutzen, schließen. Bildzähler kontrollieren.
3. Schnelle Messung: kein Lagenwähler, TGBC bei Bedarf manuell zuordnen,
   90 Sekunden messen, speichern; Historie muss „Zifferblatt oben“ zeigen.
4. Expertenmodus: andere Lage wählen, gleiche Messdauer und bekannte Optionen.
5. Neustart: gespeicherte Messung, Bilder und Theme müssen erhalten bleiben.

Phase 1 wurde vom Nutzer unter Android/Firefox mit TGBC manuell zugeordnet,
gespeichert und nach Neustart erfolgreich geprüft. Diese Rückmeldung bestätigt
noch nicht die neue Phase-2-Oberfläche.

Tests erneut ausführen (Python-Migrationstest benötigt die Git-Historie aus dem Bundle):

```sh
node --test tests/*.test.mjs
python -m unittest discover -s tests -p 'test_*.py'
```

Optionaler DOM-Test mit separater Testabhängigkeit (nicht für den normalen Betrieb):

```sh
npm install --prefix /tmp/crowniq-ui-test-deps jsdom@31.0.1 --ignore-scripts --no-audit --no-fund
CROWNIQ_UI_TEST_MODULES=/tmp/crowniq-ui-test-deps/node_modules node tests/ui-dom.cjs
```

Auf Termux für den optionalen Test einen beschreibbaren Pfad unter `$PREFIX/tmp`
statt `/tmp` verwenden. Git-Bundle in einen neuen Ordner klonen:

```sh
git clone -b feature/crowniq-ui-phase2 ~/crowniq-ui-test/crowniq-ui.bundle ~/crowniq-ui-review
```
