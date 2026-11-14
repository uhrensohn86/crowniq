import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('release_install', Path(__file__).resolve().parents[1] / 'scripts/install-release.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class InstallTest(unittest.TestCase):
    def test_activation_preserves_entire_old_installation(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            old, stage, backup = (root / n for n in ['crowniq', 'stage', 'backup'])
            old.mkdir(); stage.mkdir()
            (old / 'photo').write_bytes(b'original')
            (stage / 'version').write_text('1.3.0')
            module.activate(stage, old, backup)
            self.assertEqual((backup / 'photo').read_bytes(), b'original')
            self.assertEqual((old / 'version').read_text(), '1.3.0')

    def test_existing_backup_refused(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); old,stage,backup=(root/n for n in ['old','stage','backup'])
            for p in [old,stage,backup]:p.mkdir()
            with self.assertRaises(RuntimeError):module.activate(stage,old,backup)
            self.assertTrue(old.exists());self.assertTrue(stage.exists())

    def test_activation_failure_returns_old_installation(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);old,stage,backup=(root/n for n in ['old','stage','backup'])
            old.mkdir();stage.mkdir();(old/'image').write_bytes(b'keep')
            rename=Path.rename
            def fail_stage(p,to):
                if p==stage:raise OSError('simulated failure')
                return rename(p,to)
            with patch.object(Path,'rename',fail_stage):
                with self.assertRaises(OSError):module.activate(stage,old,backup)
            self.assertEqual((old/'image').read_bytes(),b'keep')
            self.assertTrue(stage.exists());self.assertFalse(backup.exists())
