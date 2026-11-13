import importlib.util
from pathlib import Path
import sqlite3
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('preview_copy', Path(__file__).resolve().parents[1] / 'prepare-ui-test.py')
preview_copy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preview_copy)

class PreviewCopyTest(unittest.TestCase):
    def test_copies_to_new_directory_and_never_replaces_existing(self):
        with tempfile.TemporaryDirectory() as folder:
            source, target = Path(folder) / 'source', Path(folder) / 'target'
            source.mkdir()
            (source / 'image.jpg').write_bytes(b'synthetic-image')
            with sqlite3.connect(source / 'crowniq.db') as c:
                c.execute('CREATE TABLE fixture(value TEXT)')
                c.execute("INSERT INTO fixture VALUES ('preserved')")
            original = (source / 'crowniq.db').read_bytes()
            preview_copy.copy_test_collection(source, target)
            self.assertEqual((target / 'crowniq.db').read_bytes(), original)
            self.assertEqual((source / 'crowniq.db').read_bytes(), original)
            self.assertEqual((target / 'image.jpg').read_bytes(), b'synthetic-image')
            (target / 'image.jpg').write_bytes(b'new-user-content')
            preview_copy.copy_test_collection(source, target)
            self.assertEqual((target / 'image.jpg').read_bytes(), b'new-user-content')

    def test_missing_source_leaves_destination_absent(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'target'
            preview_copy.copy_test_collection(Path(folder) / 'missing', target)
            self.assertFalse(target.exists())
