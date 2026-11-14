#!/usr/bin/env python3
"""Copy a stopped TEST collection into this new UI preview, never production."""
from pathlib import Path
import shutil
import socket
import sqlite3
import tempfile


def copy_test_collection(source, target):
    source, target = Path(source), Path(target)
    if target.exists() or target.is_symlink():
        return 'Vorhandene UI-Testdaten bleiben unverändert.'
    if not source.is_dir():
        return 'Keine bisherigen Testdaten gefunden. Die UI-Vorschau startet mit leerer Sammlung.'
    if source.is_symlink() or any(path.is_symlink() for path in source.rglob('*')):
        raise RuntimeError('Verlinkte Quelldaten werden nicht automatisch kopiert.')
    with tempfile.TemporaryDirectory(prefix='.ui-copy-', dir=target.parent) as temporary:
        staged = Path(temporary) / 'data'
        shutil.copytree(source, staged)
        database = staged / 'crowniq.db'
        if database.is_file():
            with sqlite3.connect(database.as_uri() + '?mode=ro', uri=True) as connection:
                if connection.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                    raise RuntimeError('Kopierte Testdatenbank ist nicht konsistent.')
                if connection.execute('PRAGMA foreign_key_check').fetchall():
                    raise RuntimeError('Kopierte Testdatenbank enthält ungültige Verweise.')
        if target.exists() or target.is_symlink():
            raise RuntimeError('Ziel wurde zwischenzeitlich angelegt; nichts übernommen.')
        staged.rename(target)
    return 'Bisherige Testdaten kopiert. Die ursprünglichen Daten bleiben unverändert.'


def main():
    root = Path(__file__).resolve().parent
    if root == (Path.home() / 'crowniq').resolve():
        raise RuntimeError('Nicht in der produktiven Crowniq-Installation ausführen.')
    for family, host in ((socket.AF_INET6, '::1'), (socket.AF_INET, '127.0.0.1')):
        for port in (3000, 8788):
            with socket.socket(family, socket.SOCK_STREAM) as connection:
                connection.settimeout(0.3)
                if connection.connect_ex((host, port)) == 0:
                    raise RuntimeError('Crowniq zuerst mit Strg+C stoppen; Port ist noch belegt.')
    source = Path.home() / 'crowniq-ui-polish' / 'data'
    if not source.is_dir():
        source = Path.home() / 'crowniq-ui-test' / 'data'
    if not source.is_dir():
        source = Path.home() / 'crowniq-tgbc-test' / 'data'
    print(copy_test_collection(source, root / 'data'))


if __name__ == '__main__':
    main()
