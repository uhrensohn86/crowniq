# Crowniq

**[English](README.md) | [Deutsch](README.de.md)**

Crowniq ist eine lokale, für Smartphones optimierte Verwaltung von Uhrensammlungen. Die Termux-Version speichert Sammlungsdaten und Uhrenbilder direkt auf dem Gerät. Ein Crowniq-Konto oder eine Cloud-Datenbank ist **nicht erforderlich**.

**Projektversion:** `1.2.0` (`VERSION.txt`). Dieses Release enthält die lokale Zeitwaage sowie die verbesserten Backup-/Restore-V3-Funktionen. Der aktuelle Quellcode wurde aus einem frischen Git-Klon in einem getrennten Termux-Verzeichnis installiert und getestet. Die Mikrofon-Zeitwaage bleibt experimentell und unkalibriert.

## Funktionen

- Uhrenkatalog mit Marke, Modell, Referenz, technischen Daten und Kaufinformationen
- Rabatte, Cashback, tatsächliche Anschaffungskosten sowie optionale Markt- und Versicherungswerte
- Mehrere Bilder pro Uhr mit auswählbarem Titelbild und frei einstellbarer Bildreihenfolge
- Durchsuchbare und filterbare Sammlungsansichten mit Dashboard-Statistiken
- Tragehistorie, helles/dunkles Design und mehrsprachige Benutzeroberfläche
- Lokale Python-REST-API, SQLite-Datenbank und lokale Bildspeicherung
- CSV-/JSON-Export und **vollständige ZIP-Datensicherung einschließlich Datenbank und Bildern**
- Prüfung und Vorschau von ZIP-Backups vor einer Wiederherstellung
- Bestätigte Wiederherstellung mit vorheriger Sicherheitskopie, Speicherplatzprüfung und Schutz bei unterbrochenen Vorgängen
- Experimentelle Mikrofon-Zeitwaage mit 90-Sekunden-Messung: 30 Sekunden Einmessphase und drei unabhängige 20-Sekunden-Auswertungen, automatische Schlagzahlerkennung sowie Schätzwerte für Gangabweichung und Abfallfehler
- Zeitwaagen-Messhistorie je Uhr, sechs speicherbare Messlagen und manuelle Eingabe von Ergebnissen einer echten Zeitwaage

**Zur Messgenauigkeit:** Die Mikrofonwerte für Gangabweichung und Abfallfehler sind Schätzungen, keine kalibrierten Referenzmessungen oder Chronometer-Zertifizierung. Die Signalplausibilität beschreibt die Regelmäßigkeit der Erkennung, nicht die absolute Genauigkeit. Crowniq ermittelt keine Amplitude aus Smartphone-Audio. Künstliche Demo-Signale sind nur für Diagnosetests gedacht und werden nicht als echte Uhrenmessungen gespeichert.

**Hinweis:** Eine Excel-Tabelle wurde bereits einmalig mit einem separaten Termux-Skript in eine lokale Crowniq-Sammlung importiert. Ein **allgemeiner XLSX-Import ist noch kein Bestandteil der App-Oberfläche oder Standardinstallation**.

## Installation unter Android / Termux

Verwende eine aktuelle Termux-Installation aus einer vertrauenswürdigen Quelle, beispielsweise F-Droid. Die Standardskripte erwarten Crowniq unter `~/crowniq`.

```bash
pkg update
pkg install git nodejs python

git clone https://github.com/uhrensohn86/crowniq.git ~/crowniq
cd ~/crowniq
bash install-termux.sh
bash start.sh
```

Um statt des aktuellen Entwicklungsstands `main` eine veröffentlichte Version zu installieren, kann deren Tag ausgecheckt werden:

```bash
git clone --branch v1.2.0 --depth 1 https://github.com/uhrensohn86/crowniq.git ~/crowniq
```

**Wichtig:** Nicht über eine bestehende Installation klonen.

Öffne **http://[::1]:3000** im Browser auf **demselben Android-Gerät**. Die Oberfläche verwendet die lokale Python-API unter **http://[::1]:8788**. Auf der getesteten Android-Konfiguration funktioniert die IPv6-Loopback-Adresse `[::1]` zuverlässiger als IPv4 `127.0.0.1`.

`start.sh` erwartet einen vorhandenen Build unter `dist/`. Bei der Installation wird anhand der eingecheckten `package-lock.json` zunächst `npm ci` und dann `npm run build` ausgeführt. Ein vorhandener Ordner `data/` darf dabei nicht gelöscht werden.

Eine ausführliche Anleitung für Termux findest du in [TERMUX_README.md](TERMUX_README.md).

## Speicherorte deiner Daten

```text
~/crowniq/data/crowniq.db          # SQLite-Datenbank der Sammlung
~/crowniq/data/images/             # Hochgeladene Bilder
~/crowniq/.restore-safety-backups/  # Automatische Sicherungen vor Restore
```

Diese Ordner enthalten **private Benutzerdaten** und gehören nicht zum Quellcode. Lade sie niemals auf GitHub hoch und füge sie keinen Supportberichten bei. Die `.gitignore` schließt `data/` und Restore-Sicherungen aus. Kontrolliere trotzdem vor jedem Push `git status` und `git diff --cached --name-only`.

## Datensicherung und Wiederherstellung

Unter **Einstellungen → Backup & Export** kannst du eine vollständige ZIP-Datensicherung herunterladen. Sie enthält einen SQLite-Datenbank-Snapshot, die Bilder und ein Manifest mit kryptografischen Prüfsummen. Mit der Backup-Vorschau kannst du ein vorhandenes ZIP vor dem Wiederherstellen prüfen.

Eine bestätigte Wiederherstellung **ersetzt die aktuell aktive Sammlung** durch den Inhalt des Backups. Änderungen nach dem Zeitpunkt der Sicherung – einschließlich Trageeinträgen – sind danach im aktiven Datenbestand nicht mehr enthalten. Restore V3 legt vorher eine getrennte Sicherheitskopie unter `.restore-safety-backups/` an, überprüft den benötigten Speicherplatz und verwendet ein Wiederanlaufprotokoll für unterbrochene Vorgänge. Sicherheitskopien werden nicht automatisch gelöscht.

**Teste eine Wiederherstellung nicht unnötig mit wichtigen Daten.** Der Restore-Ablauf wurde in einer isolierten Termux-Umgebung mit künstlichen Testdaten und simulierten Unterbrechungen geprüft. Die produktive Wiederherstellung erfordert außerdem einen ausdrücklichen Bestätigungs-Header. Bewahre eine zusätzliche Kopie wichtiger Backups außerhalb des Geräts auf.

JSON- und CSV-Exporte sind für tabellarische Daten nützlich, **ersetzen aber kein vollständiges ZIP-Backup**, wenn Bilder und alle Verknüpfungen erhalten bleiben sollen.

## Aktualisierung

Das Repository enthält `upgrade-termux.sh` für **Git-basierte Fast-Forward-Updates**. Das Skript prüft standardmäßig nur und nimmt Änderungen erst nach einem ausdrücklichen `--apply` vor. Beende Crowniq vor dem Update und sichere deine Sammlung als vollständiges ZIP außerhalb des Geräts.

```bash
cd ~/crowniq
bash upgrade-termux.sh --check
# Nach Prüfung und Beenden von Crowniq:
bash upgrade-termux.sh --apply
```

Für die manuelle Weiterentwicklung und neue Builds:

```bash
npm ci
npm run build
```

Überschreibe niemals den produktiven Ordner `data/` mit Dateien aus dem Repository, einem Beispiel-ZIP oder einer Testinstallation.

## Architektur und Sicherheit

- **Frontend:** React/Vite; lokale Vorschau über IPv6-Loopback auf Port `3000`
- **Backend:** Python-HTTP-Server aus der Standardbibliothek mit SQLite, lokal auf Port `8788`
- **Anmeldung:** Die lokale Version besitzt **keine Mehrbenutzer-Anmeldung oder Berechtigungsverwaltung**
- **Netzwerkzugriff:** Port `8788` niemals direkt im Heimnetz oder Internet freigeben; die lokale App ist kein abgesicherter öffentlicher Server
- **Externe Ressourcen:** Die Oberfläche lädt aktuell Schriftarten von Google Fonts. Für vollständig offline betriebene Installationen wären lokale oder Systemschriftarten erforderlich

Linux-/LXC-Hosting ist eine mögliche spätere Erweiterung, aber derzeit noch nicht als produktiv getestete Installation dokumentiert.

## Entwicklung und Beiträge

```bash
npm ci
npm run dev
npm run build
```

Frontend und Backend müssen bei der lokalen Entwicklung konsistent gestartet und konfiguriert werden. Verwende für Fehlerberichte künstliche Beispieldaten statt echter Uhrensammlungen. Weitere Screenshots und versionsspezifische Hinweise können später ergänzt werden.

Änderungen in v1.2.0 stehen in [CHANGELOG.md](CHANGELOG.md). Die experimentelle Zeitwaage lässt sich über das Drei-Punkte-Menü oder direkt aus der Detailansicht einer Uhr öffnen.

## Lizenz

MIT. Siehe [LICENSE](LICENSE).
