#!/usr/bin/env python3
"""Install a verified release alongside the old installation, then rename atomically.
Never delete or overwrite an existing collection or installation.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import socket
import sqlite3
import subprocess
import tempfile
from datetime import datetime


def validate_data(source):
    if source.is_symlink() or any(p.is_symlink() for p in source.rglob('*')):
        raise RuntimeError('Verlinkte Daten werden nicht automatisch übernommen.')
    db = source / 'crowniq.db'
    if db.exists():
        with sqlite3.connect(db.as_uri() + '?mode=ro', uri=True) as c:
            if c.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or c.execute('PRAGMA foreign_key_check').fetchall():
                raise RuntimeError('Datenbankprüfung fehlgeschlagen; keine Umschaltung.')


def activate(stage, target, backup):
    if target.is_symlink() or backup.exists():
        raise RuntimeError('Unsicheres Ziel oder Sicherungsordner bereits vorhanden.')
    existed = target.exists()
    if existed:
        target.rename(backup)
    try:
        stage.rename(target)
    except Exception:
        if existed and not target.exists():
            backup.rename(target)
        raise


def ensure_stopped():
    for family, host in [(socket.AF_INET, '127.0.0.1'), (socket.AF_INET6, '::1')]:
        for port in [3000, 8788]:
            with socket.socket(family, socket.SOCK_STREAM) as sock:
                sock.settimeout(.3)
                if sock.connect_ex((host, port)) == 0:
                    raise RuntimeError('Crowniq zuerst mit Strg+C stoppen (Port belegt).')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-from', type=Path, help='Expliziter Datenordner, falls ~/crowniq noch nicht existiert')
    args = parser.parse_args()
    package = Path(__file__).resolve().parent
    manifest = json.loads((package / 'release-manifest.json').read_text())
    bundle = package / 'crowniq-v1.3.0.bundle'
    if hashlib.sha256(bundle.read_bytes()).hexdigest() != manifest['bundle_sha256']:
        raise RuntimeError('Prüfsumme des Git-Bundles stimmt nicht.')
    target = Path.home() / 'crowniq'
    if target.is_symlink():
        raise RuntimeError('~/crowniq ist verlinkt. Keine Änderung.')
    ensure_stopped()
    if target.exists() and args.data_from:
        raise RuntimeError('Bei vorhandener Installation werden ausschließlich deren Daten übernommen.')
    if target.exists() and any((target / p).exists() for p in ['.restore-journal.json', '.restore-stage-data', '.restore-live-displaced']):
        raise RuntimeError('Unabgeschlossene Wiederherstellung: erst Zustand klären.')
    source = target / 'data' if target.exists() else args.data_from
    if source is None or not source.is_dir():
        raise RuntimeError('Kein Datenordner. Bei Erstübernahme --data-from /vollständiger/pfad/data angeben.')
    source = source.absolute()
    validate_data(source)
    stage = Path(tempfile.mkdtemp(prefix='.crowniq-v1.3.0-stage-', dir=Path.home()))
    print('Baue neue Installation separat:', stage, flush=True)
    subprocess.run(['git', 'clone', '--branch', 'main', str(bundle), str(stage)], check=True)
    actual = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=stage, text=True).strip()
    if actual != manifest['commit']:
        raise RuntimeError('Unerwarteter Commit. Keine Umschaltung.')
    subprocess.run(['git', 'remote', 'set-url', 'origin', 'https://github.com/uhrensohn86/crowniq.git'], cwd=stage, check=True)
    subprocess.run(['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], cwd=stage, check=True)
    subprocess.run(['npm', 'run', 'build'], cwd=stage, check=True)
    if not (stage / 'dist/server/server.js').is_file():
        raise RuntimeError('Buildausgabe fehlt.')
    if (stage / 'data').exists():
        raise RuntimeError('Unerwartete Daten im Quellpaket.')
    ensure_stopped()
    shutil.copytree(source, stage / 'data')
    validate_data(stage / 'data')
    backup = Path.home() / ('crowniq-before-v1.3.0-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
    existed = target.exists()
    ensure_stopped()
    activate(stage, target, backup)
    print('Produktiv installiert:', target)
    if existed:
        print('Vollständige bisherige Installation unverändert erhalten:', backup)
    else:
        print('Quelldaten unverändert erhalten:', source)
    print('Start: cd ~/crowniq && bash start.sh')
    print('Keine Sicherungs- oder Testordner automatisch löschen.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        raise SystemExit('FEHLER: ' + str(error))
