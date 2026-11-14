# Produktivumstieg / Production migration — v1.3.0

## Deutsch

Vorher in Crowniq eine vollständige ZIP-Sicherung herunterladen und außerhalb des Geräts aufbewahren. Danach alle Crowniq-Instanzen mit Strg+C stoppen.

Das separate Veröffentlichungspaket enthält geprüften Quell-ZIP, Git-Bundle, Prüfsummen und zwei vollständige Skripte. Im entpackten Paketordner:

```sh
sha256sum -c SHA256SUMS
python install-release.py
```

Der Installer baut v1.3.0 zuerst in einem neuen Verzeichnis. Er übernimmt **die Daten aus ~/crowniq/data**, keine Testdaten. Dann erhält die gesamte bisherige Installation einen eindeutigen Namen `~/crowniq-before-v1.3.0-…`; die neue Installation wird zu `~/crowniq`. Originaldateien werden weder gelöscht noch überschrieben. Im Fehlerfall vor der Umschaltung bleibt die bisherige Installation aktiv. Datenbank-Integrität und Fremdschlüssel werden geprüft; ein belegter Port verhindert die Umschaltung.

Existiert noch keine produktive Installation, ist die gewünschte Quelle ausdrücklich anzugeben, etwa `python install-release.py --data-from "$HOME/crowniq-ui-languages/data"`. Bei bestehendem ~/crowniq wird eine andere Datenquelle abgelehnt.

Start: `cd ~/crowniq && bash start.sh`. Browser neu laden. Uhrenanzahl, Bilder und bestehende Messungen kontrollieren, anschließend eine neue TGBC-Messung speichern.

### Rückkehr

Crowniq stoppen. Die neue Installation unter einem neuen, noch nicht existierenden Namen verschieben (nicht löschen), anschließend den beim Update ausgegebenen vollständigen Sicherungsordner wieder nach ~/crowniq verschieben. Dadurch stehen alter Code, Abhängigkeiten und alte Daten gemeinsam zur Verfügung. Später in v1.3.0 erfasste Daten bleiben in der beiseitegelegten neuen Installation erhalten, werden aber nicht automatisch in die alte Sammlung übernommen. Bei Unsicherheit keine Restore-Funktion verwenden und keine Verzeichnisse löschen.

### GitHub-Veröffentlichung

Im separaten Veröffentlichungspaket `bash publish-release.sh` ausführen. Benötigt Git und die offizielle GitHub CLI (`pkg install gh`) mit Anmeldung (`gh auth login --hostname github.com --git-protocol https --web`). Das Skript prüft alle Paketdateien, klont ausschließlich den geprüften Quellstand aus dem Bundle, prüft unverändertes GitHub-main, überträgt main und v1.3.0 atomar ohne Force-Push und erstellt das Release mit Quell-ZIP und Prüfsumme. Vorhandene Releases/Assets werden nicht überschrieben. Keine Dateien aus ~/crowniq oder den Testinstallationen werden hochgeladen.

## English

Keep an external full ZIP backup and stop Crowniq first. Run `sha256sum -c SHA256SUMS` and `python install-release.py` in the release kit. The installer builds in a separate directory, copies and validates production data, then preserves the complete old installation under a unique backup name before activating the new one. Test data is never chosen automatically. If production does not exist, explicitly specify `--data-from /absolute/path/data`.

To roll back, stop Crowniq, move the new installation aside without deleting it, and rename the saved previous installation back to ~/crowniq. Later records remain in the new installation and are not automatically merged back.

The publishing helper pushes only the reviewed source commit and tag, refuses unexpected remote changes, and uploads only source ZIP/checksums. Requires your own GitHub CLI login. No force-push or overwrite of an existing release.
