"""Exercise real v1.2.0 schema and migration using disposable synthetic data only."""
import importlib.util
import sqlite3
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('server', ROOT / 'local_server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

class MigrationTest(unittest.TestCase):
    def test_existing_collection_survives_and_old_backend_can_read(self):
        old_source = subprocess.check_output(['git', 'show', 'v1.2.0:local_server.py'], cwd=ROOT, text=True)
        old = {'__name__': 'old_server', '__file__': str(ROOT / 'local_server.py')}
        exec(compile(old_source, 'old_server', 'exec'), old)
        with tempfile.TemporaryDirectory() as folder:
            db = Path(folder) / 'fixture.db'
            old['DB'] = db
            old['init_db']()
            with sqlite3.connect(db) as c:
                c.execute("INSERT INTO watches(id,brand,model,created_at,updated_at) VALUES('w','Test','Synthetic','t','t')")
                c.execute("INSERT INTO watch_images(id,watch_id,storage_path,created_at) VALUES('i','w','unchanged.jpg','t')")
                c.execute("INSERT INTO watch_timegrapher_measurements(id,watch_id,source,recorded_at,bph,created_at,updated_at) VALUES('m','w','crowniq','t',21600,'t','t')")
                before = {table: c.execute('SELECT * FROM '+table).fetchall() for table in server.TABLES}
                original_columns = [r[1] for r in c.execute('PRAGMA table_info(watch_timegrapher_measurements)')]
            original_db = server.DB
            try:
                server.DB = db
                server.init_db()
                server.init_db()  # Idempotent repeated startup.
                with sqlite3.connect(db) as c:
                    for table in server.TABLES:
                        cols = ','.join(original_columns) if table == 'watch_timegrapher_measurements' else '*'
                        self.assertEqual(before[table], c.execute('SELECT '+cols+' FROM '+table).fetchall())
                    self.assertEqual((None,None,None), c.execute('SELECT microphone_type,microphone_label,microphone_detection FROM watch_timegrapher_measurements').fetchone())
                    c.execute("INSERT INTO watch_timegrapher_measurements(id,watch_id,source,recorded_at,bph,microphone_type,microphone_label,microphone_detection,created_at,updated_at) VALUES('new','w','crowniq','t',21600,'usb','TGBC','label','t','t')")
                    with self.assertRaises(sqlite3.IntegrityError):
                        c.execute("UPDATE watch_timegrapher_measurements SET microphone_type='invalid' WHERE id='new'")
                old['init_db']()  # Returning to v1.2.0 does not remove new columns/rows.
                with sqlite3.connect(db) as c:
                    self.assertEqual(('usb','TGBC','label'), c.execute("SELECT microphone_type,microphone_label,microphone_detection FROM watch_timegrapher_measurements WHERE id='new'").fetchone())
                    snapshot = Path(folder) / 'backup.db'
                    with sqlite3.connect(snapshot) as backup:
                        c.backup(backup)
                        self.assertEqual(c.execute('SELECT * FROM watch_timegrapher_measurements').fetchall(),backup.execute('SELECT * FROM watch_timegrapher_measurements').fetchall())
            finally:
                server.DB = original_db

if __name__ == '__main__':
    unittest.main()
