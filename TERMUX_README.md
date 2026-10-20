# Crowniq unter Termux – Installation, Datensicherung und Wiederherstellung

Crowniq läuft lokal auf Android mit React/Vite als Oberfläche und einem Python-Backend mit SQLite. Du brauchst keinen Crowniq-Account und keine externe Datenbank.

**Versionshinweis:** `VERSION.txt` steht derzeit noch auf **1.1.4**. Im aktuellen Entwicklungsstand sind bereits die späteren Termux-, Backup- und Restore-V3-Verbesserungen integriert. Die nächste Versionsnummer sollte erst nach einem überprüften Release vergeben werden.

## 1. Voraussetzungen

- Termux aus einer vertrauenswürdigen Quelle (z. B. F-Droid)
- Ausreichend Speicherplatz für JavaScript-Abhängigkeiten, den Build und deine Sammlung
- Git, Node.js/npm und Python aus den offiziellen Termux-Paketen

```bash
pkg update
pkg install git nodejs python
```

Ein GitHub-Konto ist zum **Herunterladen eines öffentlichen Repositories** nicht erforderlich. Zum Hochladen eigener Änderungen brauchst du passende GitHub-Zugangsdaten.

## 2. Neuinstallation

Der aktuelle Startvorgang erwartet den Installationspfad **`~/crowniq`**. Verwende bei einer bestehenden produktiven Installation nicht denselben Zielordner für einen Testklon.

```bash
git clone https://github.com/uhrensohn86/crowniq.git ~/crowniq
cd ~/crowniq
bash install-termux.sh
bash start.sh
```

Die Installation nutzt die im Repository gespeicherte `package-lock.json` und `npm ci`; anschließend wird das Frontend gebaut. Sie **löscht keine vorhandene Sammlung**. Wenn npm oder der Build fehlschlägt, bitte die genaue Ausgabe prüfen und nicht ungeprüft alternative Installer ausführen.

**Browser:** `http://[::1]:3000`

**Lokale API:** `http://[::1]:8788`

`[::1]` ist die IPv6-Loopback-Adresse. Auf dem getesteten Android-Gerät war sie zuverlässiger als `localhost` über IPv4/`127.0.0.1`. Die Oberfläche läuft ausschließlich auf dem gleichen Gerät, nicht über eine öffentliche Netzwerkadresse.

Zum Beenden im laufenden Termux-Fenster `Strg+C` drücken.

## 3. Speicherorte

```text
~/crowniq/data/crowniq.db          SQLite-Datenbank
~/crowniq/data/images/             Bilder deiner Uhren
~/crowniq/.restore-safety-backups/  Automatische Sicherungen vor Restore
```

`data/` ist in `.gitignore` ausgeschlossen. **Niemals SQLite-Datenbanken, Bilder, Backup-ZIPs, private Schlüssel oder persönliche Tabellen in das öffentliche GitHub-Repository hochladen.**

## 4. Vollständiges Backup

In Crowniq unter **Einstellungen → Backup & Export** ein vollständiges ZIP-Backup erstellen. Es enthält die Datenbank und die zugehörigen Bilder. Ein Manifest und SHA-256-Prüfsummen unterstützen die Überprüfung.

Die ZIP-Datei am besten zusätzlich außerhalb des Telefons aufbewahren. Ein Backup im Downloadordner allein schützt nicht vor Verlust oder Defekt des Geräts.

CSV und JSON sind ergänzende Exporte, ersetzen aber das vollständige ZIP **nicht**.

## 5. Restore V3 – vorsichtig verwenden

1. In Einstellungen die ZIP-Datei auswählen.
2. Über **ZIP-Backup prüfen** die Vorschau und Prüfsummen kontrollieren.
3. Beachten, dass ein Restore **die gesamte derzeit aktive Sammlung ersetzt**.
4. Nur bei gewollter Wiederherstellung die Bestätigungen ausführen.

Restore V3 erstellt vor dem eigentlichen Austausch eine separate Kopie der aktuellen Sammlung. Zusätzlich gibt es eine Speicherplatzprüfung mit Reserve und eine Wiederanlaufprüfung nach unterbrochenen Vorgängen. Bei unklaren Zuständen wird der Start aus Sicherheitsgründen verweigert, statt Daten stillschweigend zu überschreiben.

Automatische Sicherungen liegen unter `.restore-safety-backups/` und werden nicht automatisch gelöscht. Bitte nicht von Hand in diese Verzeichnisse eingreifen, solange ein Restore läuft oder unvollständig ist.

Der Restore-Prozess wurde in einer **isolierten Testinstallation** mit künstlichen Datensätzen, Bildvergleich und simulierten Abstürzen geprüft. Eine produktive Sammlung muss zum Testen nicht unnötig wiederhergestellt werden.

## 6. GitHub-Update

Ein Update darf die persönlichen Daten unter `data/` nicht ersetzen. Den alten Updater, der ungeprüft vorhandene Dateien löschte, nicht weiterverwenden. Die neue Fassung von `upgrade-termux.sh` arbeitet mit einem Git-Fast-Forward und einem vorgeschalteten Buildtest.

```bash
cd ~/crowniq
bash upgrade-termux.sh --check
```

Vor einer tatsächlichen Aktualisierung:

- Ein aktuelles vollständiges ZIP-Backup erzeugen und extern sichern.
- Crowniq mit `Strg+C` beenden.
- Kontrollieren, dass keine uncommitteten Änderungen im Git-Arbeitsverzeichnis liegen.

```bash
bash upgrade-termux.sh --apply
```

Das Skript führt vor Änderungen einen Testbuild mit dem neuen Quellcode aus, legt eine lokale Datenkopie an und übernimmt nur einen fast-forward-fähigen Git-Stand. Bei einem Fehler die angezeigte Ausgabe prüfen und den produktiven Server nicht blind neu starten.

## 7. Excel-Daten

Eine Excel-Tabelle mit Uhren wurde erfolgreich mittels eines separaten Python-Skripts gegen einen Crowniq-CSV-Export abgeglichen. 22 neue Uhren konnten ergänzt werden; unklare Einträge wurden ausgelassen. **Dies war ein einmaliger Import, noch keine allgemeine Excel-Importfunktion in Crowniq.** Bilder können im Browser ergänzt werden.

## 8. Bekannte Einschränkungen

- Die lokale Edition hat keinen Mehrbenutzer-Login. Nicht ohne separate Absicherung öffentlich hosten.
- Die Schriftarten der Oberfläche werden derzeit über Google Fonts geladen; für vollständig offline müssen sie lokal eingebunden werden.
- Die Installation wurde auf Termux betrieben und getestet. Ein frischer GitHub-Klon auf einem zweiten Gerät sollte nach jedem Release separat getestet werden.
- Für Proxmox/LXC gibt es noch keine vollständig getestete Installationsanleitung.
