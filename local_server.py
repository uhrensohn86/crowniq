#!/usr/bin/env python3
"""Crowniq Local v1 backend. Python stdlib only: SQLite + images + REST API."""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import socket
from urllib.parse import urlparse, parse_qs, unquote
from pathlib import Path
from email.parser import BytesParser
from email.policy import default
import sqlite3, json, uuid, datetime, mimetypes, shutil, zipfile, io, os

ROOT=Path(__file__).resolve().parent
DATA=ROOT/'data'; IMAGES=DATA/'images'; DB=DATA/'crowniq.db'
# Data directories are created only after startup recovery.
TABLES={'profiles','watches','watch_images','watch_purchase_discounts','watch_wears'}
JSON_COLS={'complications'}

def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def conn():
    c=sqlite3.connect(DB); c.row_factory=sqlite3.Row; c.execute('PRAGMA foreign_keys=ON'); return c

def init_db():
    c=conn(); c.executescript('''
CREATE TABLE IF NOT EXISTS profiles(id TEXT PRIMARY KEY, display_name TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS watches(
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL DEFAULT 'local-user', brand TEXT NOT NULL, model TEXT NOT NULL,
 reference_number TEXT, serial_number TEXT, purchase_date TEXT, dealer TEXT, movement_caliber TEXT,
 movement_manufacturer TEXT, movement_type TEXT, case_material TEXT, case_finish TEXT, case_coating TEXT, diameter_mm REAL, lug_to_lug_mm REAL,
 lug_width_mm REAL, water_resistance_m INTEGER, crystal TEXT, bracelet_material TEXT, bracelet_type TEXT,
 battery_type TEXT, case_back TEXT, complications TEXT DEFAULT '[]', msrp REAL, discount_percent REAL,
 discount_amount REAL, final_price REAL, currency TEXT DEFAULT 'EUR', payment_method TEXT,
 current_market_value REAL, market_value_date TEXT, insurance_value REAL, notes TEXT, primary_image_path TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS watch_images(id TEXT PRIMARY KEY, watch_id TEXT NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL DEFAULT 'local-user', storage_path TEXT NOT NULL, sort_order INTEGER DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS watch_purchase_discounts(id TEXT PRIMARY KEY, watch_id TEXT NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL DEFAULT 'local-user', label TEXT NOT NULL, amount REAL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS watch_wears(id TEXT PRIMARY KEY, user_id TEXT NOT NULL DEFAULT 'local-user',
 watch_id TEXT NOT NULL REFERENCES watches(id) ON DELETE CASCADE, worn_on TEXT NOT NULL, notes TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(user_id,watch_id,worn_on));
''')
    # Forward-compatible schema migration for existing v1/v1.1 databases.
    cols={r['name'] for r in c.execute('PRAGMA table_info(watches)')}
    if 'case_finish' not in cols: c.execute('ALTER TABLE watches ADD COLUMN case_finish TEXT')
    if 'case_coating' not in cols: c.execute('ALTER TABLE watches ADD COLUMN case_coating TEXT')
    c.execute("INSERT OR IGNORE INTO profiles(id,display_name,created_at,updated_at) VALUES('local-user','',?,?)",(now(),now())); c.commit(); c.close()

def clean_row(r):
    d=dict(r)
    for k in JSON_COLS:
        if k in d and isinstance(d[k],str):
            try:d[k]=json.loads(d[k])
            except: d[k]=[]
    return d

def prep(d, table, inserting=False):
    x=dict(d); t=now()
    for k in JSON_COLS:
        if k in x: x[k]=json.dumps(x[k] or [])
    if inserting:
        x.setdefault('id',str(uuid.uuid4())); x.setdefault('created_at',t)
    if table in {'watches','watch_wears','profiles'}: x['updated_at']=t
    return x

def allowed_cols(c, table):
    names={r['name'] for r in conn().execute(f'PRAGMA table_info({table})')}
    return [x for x in c if x in names]

class H(BaseHTTPRequestHandler):
    def cors(self):
        self.send_header('Access-Control-Allow-Origin','http://[::1]:3000'); self.send_header('Access-Control-Allow-Headers','Content-Type, X-Crowniq-Confirm'); self.send_header('Access-Control-Expose-Headers','Content-Disposition'); self.send_header('Access-Control-Allow-Methods','GET,POST,PATCH,PUT,DELETE,OPTIONS')
    def sendj(self,obj,status=200):
        b=json.dumps(obj,ensure_ascii=False).encode(); self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(b))); self.cors(); self.end_headers(); self.wfile.write(b)
    def do_OPTIONS(self): self.send_response(204); self.cors(); self.end_headers()
    def bodyjson(self):
        n=int(self.headers.get('Content-Length','0')); return json.loads(self.rfile.read(n) or b'{}')
    def parse_filters(self,q):
        out=[]
        for raw in q.get('eq',[]):
            if ':' in raw:
                col,val=raw.split(':',1); out.append((col,unquote(val)))
        return out
    def export_full_backup(self):
        """Stream a complete, verified snapshot without modifying application data."""
        import hashlib
        import tempfile
        import threading

        # Image uploads/deletions can occur concurrently with a backup. This
        # endpoint is intentionally conservative: verify image stability while
        # copying, and reject a backup if any file changes during the process.
        try:
            with tempfile.TemporaryDirectory(prefix='crowniq-backup-') as tempdir:
                work = Path(tempdir)
                snapshot = work / 'crowniq.db'
                source = conn()
                target = sqlite3.connect(snapshot)
                try:
                    source.backup(target)
                    result = target.execute('PRAGMA integrity_check').fetchone()[0]
                    if result != 'ok':
                        raise ValueError('SQLite integrity check failed: ' + str(result))
                    counts = {table: target.execute('SELECT COUNT(*) FROM ' + table).fetchone()[0]
                              for table in sorted(TABLES)}
                    references = [row[0] for row in target.execute('SELECT storage_path FROM watch_images')]
                finally:
                    target.close()
                    source.close()

                def digest(blob):
                    return hashlib.sha256(blob).hexdigest()

                files = {}
                # Store the exact relative path as referenced by the database.
                for raw in references:
                    if not isinstance(raw, str) or not raw.strip():
                        raise ValueError('Empty image path in database')
                    relative = raw.lstrip('/')
                    if relative.startswith('images/'):
                        relative = relative[len('images/'):]
                    path = (IMAGES / relative).resolve()
                    if not path.is_relative_to(IMAGES.resolve()) or not path.is_file():
                        raise ValueError('Missing or invalid referenced image: ' + raw)
                    files[relative] = path
                # Also preserve any unreferenced image files; they may be useful
                # for recovery and are part of the local image storage.
                for path in IMAGES.rglob('*'):
                    if path.is_file():
                        resolved = path.resolve()
                        if not resolved.is_relative_to(IMAGES.resolve()):
                            raise ValueError('Unsafe image path')
                        files[path.relative_to(IMAGES).as_posix()] = resolved

                archive = work / 'crowniq-backup.zip'
                entries = {}
                with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
                    dbbytes = snapshot.read_bytes()
                    z.writestr('data/crowniq.db', dbbytes)
                    entries['data/crowniq.db'] = {'size': len(dbbytes), 'sha256': digest(dbbytes)}
                    for relative, path in sorted(files.items()):
                        stat_before = path.stat()
                        content = path.read_bytes()
                        stat_after = path.stat()
                        if (stat_before.st_size != stat_after.st_size or
                            stat_before.st_mtime_ns != stat_after.st_mtime_ns or
                            len(content) != stat_before.st_size):
                            raise ValueError('Image changed during backup: ' + relative)
                        arcname = 'data/images/' + relative
                        z.writestr(arcname, content)
                        entries[arcname] = {'size': len(content), 'sha256': digest(content)}
                    manifest = {
                        'format': 'crowniq-full-backup', 'version': 1,
                        'created_at': now(), 'tables': counts,
                        'referenced_images': len(references), 'files': entries,
                    }
                    z.writestr('manifest.json', json.dumps(manifest, indent=2, ensure_ascii=False))
                # Verify the ZIP's internal CRC before delivering it.
                with zipfile.ZipFile(archive) as z:
                    if z.testzip() is not None:
                        raise ValueError('ZIP integrity verification failed')
                self.send_response(200)
                self.send_header('Content-Type', 'application/zip')
                self.send_header('Content-Disposition', 'attachment; filename="crowniq-backup-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S') + '.zip"')
                self.send_header('Content-Length', str(archive.stat().st_size))
                self.cors()
                self.end_headers()
                with archive.open('rb') as stream:
                    shutil.copyfileobj(stream, self.wfile, length=1024 * 1024)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as exc:
            print('[Crowniq] Backup export failed:', repr(exc))
            try:
                self.sendj({'error': {'message': str(exc)}}, 500)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def preview_backup(self):
        """Validate a supplied Crowniq ZIP without changing any application data."""
        import hashlib
        import tempfile
        import stat
        MAX_UPLOAD = 256 * 1024 * 1024
        MAX_UNCOMPRESSED = 512 * 1024 * 1024
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= MAX_UPLOAD:
                return self.sendj({'error': {'message': 'Backup-Datei fehlt oder ist zu gross (max. 256 MiB)'}}, 413)
            with tempfile.TemporaryDirectory(prefix='crowniq-preview-') as td:
                tmp = Path(td)
                archive = tmp / 'incoming.zip'
                with archive.open('wb') as output:
                    remaining = length
                    while remaining:
                        chunk = self.rfile.read(min(1024 * 1024, remaining))
                        if not chunk:
                            raise ValueError('Unvollstaendiger Upload')
                        output.write(chunk)
                        remaining -= len(chunk)
                with zipfile.ZipFile(archive) as z:
                    infos = z.infolist()
                    names = [i.filename for i in infos]
                    if len(names) != len(set(names)) or len(names) > 10000:
                        raise ValueError('Doppelte oder zu viele ZIP-Eintraege')
                    if sum(i.file_size for i in infos) > MAX_UNCOMPRESSED:
                        raise ValueError('Entpackte Daten sind zu gross')
                    for info in infos:
                        name = info.filename
                        parts = name.split('/')
                        if (not name or name.startswith('/') or '\\' in name or
                            any(p in ('', '.', '..') for p in parts) or
                            stat.S_ISLNK(info.external_attr >> 16)):
                            raise ValueError('Unsicherer ZIP-Pfad: ' + name)
                        if name != 'manifest.json' and name != 'data/crowniq.db' and not name.startswith('data/images/'):
                            raise ValueError('Unerwartete Datei: ' + name)
                        if info.is_dir():
                            raise ValueError('Verzeichniseintraege nicht erwartet')
                    if 'manifest.json' not in names or 'data/crowniq.db' not in names:
                        raise ValueError('Manifest oder Datenbank fehlt')
                    if z.getinfo('manifest.json').file_size > 1024 * 1024:
                        raise ValueError('Manifest zu gross')
                    manifest = json.loads(z.read('manifest.json'))
                    if manifest.get('format') != 'crowniq-full-backup' or manifest.get('version') != 1:
                        raise ValueError('Nicht unterstuetztes Backup-Format')
                    files = manifest.get('files')
                    if not isinstance(files, dict) or set(files) != set(names) - {'manifest.json'}:
                        raise ValueError('Dateiliste stimmt nicht mit Manifest ueberein')
                    for name, expected in files.items():
                        if not isinstance(expected, dict):
                            raise ValueError('Ungueltiger Manifest-Eintrag')
                        h = hashlib.sha256()
                        size = 0
                        with z.open(name) as inp:
                            while True:
                                chunk = inp.read(1024 * 1024)
                                if not chunk:
                                    break
                                size += len(chunk)
                                h.update(chunk)
                        if size != expected.get('size') or h.hexdigest() != expected.get('sha256'):
                            raise ValueError('Pruefsumme/Dateigroesse falsch: ' + name)
                    dbfile = tmp / 'crowniq.db'
                    with z.open('data/crowniq.db') as src, dbfile.open('wb') as dst:
                        shutil.copyfileobj(src, dst)
                    connection = sqlite3.connect('file:' + str(dbfile) + '?mode=ro', uri=True)
                    try:
                        integrity = connection.execute('PRAGMA integrity_check').fetchone()[0]
                        if integrity != 'ok':
                            raise ValueError('SQLite-Integritaet: ' + str(integrity))
                        foreign_keys = connection.execute('PRAGMA foreign_key_check').fetchall()
                        if foreign_keys:
                            raise ValueError('Datenbank enthaelt fehlerhafte Fremdschluessel')
                        counts = {table: connection.execute('SELECT COUNT(*) FROM ' + table).fetchone()[0]
                                  for table in sorted(TABLES)}
                        if counts != manifest.get('tables'):
                            raise ValueError('Tabellenzahlen stimmen nicht mit Manifest ueberein')
                        paths = [r[0] for r in connection.execute('SELECT storage_path FROM watch_images')]
                        for raw in paths:
                            if not isinstance(raw, str) or not raw.strip():
                                raise ValueError('Leerer Bildpfad')
                            relative = raw.lstrip('/')
                            if relative.startswith('images/'):
                                relative = relative[7:]
                            if ('data/images/' + relative) not in files:
                                raise ValueError('Referenziertes Bild fehlt: ' + raw)
                        if len(paths) != manifest.get('referenced_images'):
                            raise ValueError('Anzahl Bildreferenzen stimmt nicht')
                    finally:
                        connection.close()
                    return self.sendj({'ok': True, 'created_at': manifest.get('created_at'),
                                       'tables': counts, 'image_files': sum(n.startswith('data/images/') for n in files),
                                       'files_verified': len(files), 'size_bytes': length})
        except Exception as exc:
            print('[Crowniq] Backup preview failed:', repr(exc))
            return self.sendj({'error': {'message': str(exc)}}, 400)

    def do_GET(self):
        u=urlparse(self.path); q=parse_qs(u.query)
        if u.path=='/api/backup/export': return self.export_full_backup()
        if u.path=='/api/health': return self.sendj({'ok':True,'db':str(DB)})
        if u.path=='/api/image':
            rel=q.get('path',[''])[0]; p=(IMAGES/rel).resolve()
            if not str(p).startswith(str(IMAGES.resolve())) or not p.is_file(): return self.sendj({'error':{'message':'Image not found'}},404)
            b=p.read_bytes(); self.send_response(200); self.send_header('Content-Type',mimetypes.guess_type(p.name)[0] or 'application/octet-stream'); self.send_header('Content-Length',str(len(b))); self.cors(); self.end_headers(); return self.wfile.write(b)
        if u.path.startswith('/api/table/'):
            table=u.path.rsplit('/',1)[-1]
            if table not in TABLES:return self.sendj({'error':{'message':'Unknown table'}},404)
            c=conn(); where=[]; vals=[]
            cols_info={r['name'] for r in c.execute(f'PRAGMA table_info({table})')}
            for col,val in self.parse_filters(q):
                if col in cols_info: where.append(f'{col}=?'); vals.append(val)
            sql=f'SELECT * FROM {table}'+((' WHERE '+' AND '.join(where)) if where else '')
            order=q.get('order',[None])[0]
            if order in cols_info: sql+=f' ORDER BY {order} '+('ASC' if q.get('asc',['true'])[0]=='true' else 'DESC')
            if q.get('limit',[''])[0].isdigit(): sql+=' LIMIT '+q['limit'][0]
            rows=[clean_row(r) for r in c.execute(sql,vals).fetchall()]
            # emulate the one nested relation used by Wear tracker
            if table=='watch_wears' and 'watches(' in q.get('select',[''])[0]:
                for r in rows:
                    wr=c.execute('SELECT id,brand,model,primary_image_path FROM watches WHERE id=?',(r['watch_id'],)).fetchone(); r['watches']=dict(wr) if wr else None
            c.close(); data=(rows[0] if rows else None) if q.get('single',['0'])[0]=='1' else rows
            return self.sendj({'data':data})
        self.sendj({'error':{'message':'Not found'}},404)
    def mutate(self,method):
        u=urlparse(self.path); q=parse_qs(u.query)
        if not u.path.startswith('/api/table/'): return self.sendj({'error':{'message':'Not found'}},404)
        table=u.path.rsplit('/',1)[-1]
        if table not in TABLES:return self.sendj({'error':{'message':'Unknown table'}},404)
        try: body=self.bodyjson()
        except Exception as e:return self.sendj({'error':{'message':str(e)}},400)
        c=conn(); cols={r['name'] for r in c.execute(f'PRAGMA table_info({table})')}; filters=[(a,b) for a,b in self.parse_filters(q) if a in cols]
        try:
            if method=='DELETE':
                wh=' AND '.join(f'{a}=?' for a,_ in filters) or '1=0'; c.execute(f'DELETE FROM {table} WHERE {wh}',[b for _,b in filters]); c.commit(); return self.sendj({'data':[]})
            if method=='PATCH':
                x=prep(body,table); x={k:v for k,v in x.items() if k in cols}; wh=' AND '.join(f'{a}=?' for a,_ in filters) or '1=0';
                if x: c.execute(f"UPDATE {table} SET "+','.join(f'{k}=?' for k in x)+f' WHERE {wh}',list(x.values())+[b for _,b in filters]); c.commit()
                return self.sendj({'data':[]})
            items=body if isinstance(body,list) else [body]; made=[]
            for item in items:
                x=prep(item,table,True); x={k:v for k,v in x.items() if k in cols}
                if method=='PUT' and table=='profiles':
                    c.execute('INSERT INTO profiles(id,display_name,created_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,updated_at=excluded.updated_at',(x.get('id','local-user'),x.get('display_name'),x.get('created_at',now()),x.get('updated_at',now())))
                else:
                    c.execute(f"INSERT INTO {table} ("+','.join(x)+') VALUES ('+','.join('?'*len(x))+')',list(x.values()))
                made.append(x)
            c.commit(); return self.sendj({'data': made[0] if q.get('single',['0'])[0]=='1' else made})
        except sqlite3.IntegrityError as e:
            code='23505' if 'UNIQUE' in str(e) else '23000'; return self.sendj({'error':{'message':str(e),'code':code}},409)
        except Exception as e:return self.sendj({'error':{'message':str(e)}},500)
        finally:c.close()
    def do_POST(self):
        if self.path == '/api/backup/preview': return self.preview_backup()
        if self.path.startswith('/api/storage/upload'):
            try:
                n=int(self.headers.get('Content-Length','0')); raw=self.rfile.read(n); ct=self.headers.get('Content-Type',''); msg=BytesParser(policy=default).parsebytes((f'Content-Type: {ct}\r\nMIME-Version: 1.0\r\n\r\n').encode()+raw)
                fields={}; filepart=None
                for part in msg.iter_parts():
                    name=part.get_param('name',header='content-disposition');
                    if name=='file': filepart=part
                    else: fields[name]=part.get_content()
                rel=str(fields.get('path','')).strip(); dest=(IMAGES/rel).resolve()
                if not rel or not str(dest).startswith(str(IMAGES.resolve())) or filepart is None: raise ValueError('Invalid upload')
                dest.parent.mkdir(parents=True,exist_ok=True); dest.write_bytes(filepart.get_payload(decode=True)); return self.sendj({'data':{'path':rel}})
            except Exception as e:return self.sendj({'error':{'message':str(e)}},400)
        if self.path.startswith('/api/storage/remove'):
            try:
                for rel in self.bodyjson().get('paths',[]):
                    p=(IMAGES/rel).resolve();
                    if str(p).startswith(str(IMAGES.resolve())) and p.is_file(): p.unlink()
                return self.sendj({'data':[]})
            except Exception as e:return self.sendj({'error':{'message':str(e)}},400)
        return self.mutate('POST')
    def do_PATCH(self): return self.mutate('PATCH')
    def do_PUT(self): return self.mutate('PUT')
    def do_DELETE(self): return self.mutate('DELETE')
    def log_message(self,fmt,*args): print('[Crowniq]',fmt%args)


# CROWNIQ_PROD_RESTORE_V3_BEGIN - disabled, isolated crash tested.
import threading, tempfile, hashlib, stat, time
RESTORE_LOCK = threading.RLock()
RESTORE_JOURNAL = ROOT / '.restore-journal.json'

def verify_and_extract(archive, destination):
    """Validate every member and restore into a private staging directory."""
    max_size = 512 * 1024 * 1024
    with zipfile.ZipFile(archive) as z:
        infos = z.infolist()
        names = [i.filename for i in infos]
        if len(names) != len(set(names)) or len(names) > 10000:
            raise ValueError('Doppelte/zu viele ZIP-Eintraege')
        if sum(i.file_size for i in infos) > max_size:
            raise ValueError('ZIP zu gross')
        for i in infos:
            name = i.filename
            if (not name or name.startswith('/') or '\\' in name or
                any(p in ('', '.', '..') for p in name.split('/')) or
                stat.S_ISLNK(i.external_attr >> 16) or i.is_dir() or
                (name not in ('manifest.json', 'data/crowniq.db') and
                 not name.startswith('data/images/'))):
                raise ValueError('Unsicherer ZIP-Eintrag: ' + name)
        if 'manifest.json' not in names or 'data/crowniq.db' not in names:
            raise ValueError('Backup unvollstaendig')
        if z.getinfo('manifest.json').file_size > 1024 * 1024:
            raise ValueError('Manifest zu gross')
        manifest = json.loads(z.read('manifest.json'))
        if manifest.get('format') != 'crowniq-full-backup' or manifest.get('version') != 1:
            raise ValueError('Unbekanntes Backupformat')
        files = manifest.get('files')
        if not isinstance(files, dict) or set(files) != set(names) - {'manifest.json'}:
            raise ValueError('Dateiliste ungueltig')
        for name, expected in files.items():
            if not isinstance(expected, dict):
                raise ValueError('Manifest-Eintrag ungueltig')
            dest = destination / name.removeprefix('data/')
            dest.parent.mkdir(parents=True, exist_ok=True)
            sha = hashlib.sha256()
            size = 0
            with z.open(name) as src, dest.open('wb') as dst:
                while chunk := src.read(1024 * 1024):
                    size += len(chunk)
                    sha.update(chunk)
                    dst.write(chunk)
            if size != expected.get('size') or sha.hexdigest() != expected.get('sha256'):
                raise ValueError('SHA-256 falsch: ' + name)
    dbfile = destination / 'crowniq.db'
    c = sqlite3.connect('file:' + str(dbfile) + '?mode=ro', uri=True)
    try:
        if c.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise ValueError('SQLite integrity_check fehlgeschlagen')
        if c.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('SQLite Fremdschluessel fehlerhaft')
        counts = {t: c.execute('SELECT COUNT(*) FROM ' + t).fetchone()[0] for t in sorted(TABLES)}
        if counts != manifest.get('tables'):
            raise ValueError('Tabellenzaehler falsch')
        paths = [r[0] for r in c.execute('SELECT storage_path FROM watch_images')]
        for raw in paths:
            if not isinstance(raw, str) or not raw.strip():
                raise ValueError('Bildreferenz leer')
            relative = raw.lstrip('/')
            if relative.startswith('images/'):
                relative = relative[7:]
            p = (destination / 'images' / relative).resolve()
            if not p.is_relative_to((destination / 'images').resolve()) or not p.is_file():
                raise ValueError('Bildreferenz fehlt: ' + raw)
        if len(paths) != manifest.get('referenced_images'):
            raise ValueError('Bildreferenzzaehler falsch')
        return counts
    finally:
        c.close()


# CROWNIQ_PROD_RESTORE_V3_LOGIC
# Persistent pre-restore snapshots, fail-closed journal recovery.
import re as _restore_re

RESTORE_V2_BACKUPS = ROOT / '.restore-safety-backups'
RESTORE_V2_MARKER = 'CROWNIQ_PROD_RESTORE_V3'


def _v2_fsync_dir(folder):
    """Best-effort fsync of directory metadata on supported local filesystems."""
    try:
        fd = os.open(folder, os.O_RDONLY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    except OSError:
        # Some Android filesystems may not support directory fsync.
        pass


def _v2_journal(record):
    temp = ROOT / ('.restore-journal-' + uuid.uuid4().hex + '.tmp')
    blob = json.dumps(record, sort_keys=True).encode('utf-8')
    try:
        with temp.open('xb') as stream:
            stream.write(blob)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, RESTORE_JOURNAL)
        _v2_fsync_dir(ROOT)
    finally:
        temp.unlink(missing_ok=True)


def _v2_journal_remove():
    RESTORE_JOURNAL.unlink()
    _v2_fsync_dir(ROOT)


def _v2_db_image_check(folder):
    """Check all referenced images, SQLite integrity and foreign keys."""
    if folder.is_symlink() or not folder.is_dir():
        return False
    db = folder / 'crowniq.db'
    images = folder / 'images'
    if db.is_symlink() or not db.is_file() or images.is_symlink() or not images.is_dir():
        return False
    try:
        c = sqlite3.connect('file:' + str(db) + '?mode=ro', uri=True)
        try:
            if c.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                return False
            if c.execute('PRAGMA foreign_key_check').fetchall():
                return False
            for table in TABLES:
                c.execute('SELECT COUNT(*) FROM ' + table).fetchone()
            for (raw,) in c.execute('SELECT storage_path FROM watch_images'):
                if not isinstance(raw, str) or not raw.strip():
                    return False
                rel = raw.lstrip('/')
                if rel.startswith('images/'):
                    rel = rel[len('images/'):]
                pic = (images / rel).resolve()
                if not pic.is_relative_to(images.resolve()) or not pic.is_file():
                    return False
            return True
        finally:
            c.close()
    except (sqlite3.Error, OSError, ValueError):
        return False


def _v2_snapshot_current(destination):
    """Create a separate complete safety copy BEFORE replacing live data."""
    if destination.exists():
        raise RuntimeError('Sicherungsverzeichnis existiert schon')
    if RESTORE_V2_BACKUPS.is_symlink():
        raise RuntimeError('Sicherungsziel ist ein Symlink; Restore verweigert')
    if not _v2_db_image_check(DATA):
        raise RuntimeError('Aktueller Datenbestand nicht konsistent; Restore abgebrochen')
    destination.mkdir(mode=0o700, parents=True)
    snap = destination / 'data'
    snap.mkdir(mode=0o700)
    source = conn()
    copy_db = sqlite3.connect(snap / 'crowniq.db')
    try:
        source.backup(copy_db)
    finally:
        copy_db.close()
        source.close()
    # Refuse symlinks anywhere in live data, including unreferenced images.
    if any(p.is_symlink() for p in DATA.rglob('*')):
        raise RuntimeError('Symlink im Datenverzeichnis; keine automatische Kopie')
    shutil.copytree(IMAGES, snap / 'images', symlinks=False)
    # An independent checksum comparison ensures copied images are byte-identical.
    image_checksums = {}
    for original in sorted(IMAGES.rglob('*')):
        if original.is_file():
            relative = original.relative_to(IMAGES)
            copied = snap / 'images' / relative
            if (not copied.is_file() or
                hashlib.sha256(original.read_bytes()).digest() !=
                hashlib.sha256(copied.read_bytes()).digest()):
                raise RuntimeError('Sicherungsbild wurde veraendert: ' + str(relative))
            image_checksums[relative.as_posix()] = hashlib.sha256(copied.read_bytes()).hexdigest()
    if not _v2_db_image_check(snap):
        raise RuntimeError('Automatische Sicherheitskopie ist nicht konsistent')
    manifest = {
        'format': 'crowniq-before-restore-copy',
        'created_at': now(),
        'database': 'data/crowniq.db',
        'images': 'data/images',
        'image_sha256': image_checksums,
        'note': 'Nicht automatisch loeschen; vor Restore angelegt.',
    }
    (destination / 'info.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    _v2_fsync_dir(destination)
    _v2_fsync_dir(RESTORE_V2_BACKUPS)
    return destination


def _v2_read_record():
    record = json.loads(RESTORE_JOURNAL.read_text(encoding='utf-8'))
    if not isinstance(record, dict) or record.get('kind') != RESTORE_V2_MARKER:
        raise RuntimeError('Unbekanntes Restore-Journal; keine automatische Aenderung')
    token = record.get('token')
    if not isinstance(token, str) or not _restore_re.fullmatch(r'[0-9a-f]{32}', token):
        raise RuntimeError('Ungueltiger Restore-Journal-Identifikator')
    if record.get('phase') not in {'prepared', 'displaced', 'committed'}:
        raise RuntimeError('Ungueltige Restore-Phase')
    return record


def recover_interrupted_restore_v2():
    """Recover only unambiguous states; never erase possibly unique data."""
    if not RESTORE_JOURNAL.exists():
        return
    record = _v2_read_record()
    token = record['token']
    phase = record['phase']
    displaced = ROOT / ('.restore-v2-displaced-' + token)
    stage = ROOT / ('.restore-v2-stage-' + token)
    safe = RESTORE_V2_BACKUPS / token / 'data'
    if not _v2_db_image_check(safe):
        raise RuntimeError('Restore-Sicherheitskopie fehlt oder ist fehlerhaft; manuelle Pruefung')
    old_live_ok = _v2_db_image_check(displaced)
    current_ok = _v2_db_image_check(DATA)

    if phase == 'committed' and current_ok:
        # A valid new state has been committed. Keep safety snapshot untouched.
        _v2_journal_remove()
        if old_live_ok:
            try:
                shutil.rmtree(displaced)
            except OSError as exc:
                print('[CROWNIQ RESTORE] Committed leftover retained:', repr(exc))
        print('[CROWNIQ RESTORE] Committed restore valid; automatic safety backup retained')
        return

    if phase == 'prepared' and not displaced.exists() and current_ok:
        # Old data is still at DATA. The swap had not started.
        _v2_journal_remove()
        print('[CROWNIQ RESTORE] Prepared restore cancelled; old live data intact')
        return

    if old_live_ok:
        # Old data is known good and has priority after interrupted commit.
        if DATA.exists() or DATA.is_symlink():
            if DATA.is_symlink() or not DATA.is_dir():
                raise RuntimeError('Live-Datenpfad ist kein regulaeres Verzeichnis')
            if any(DATA.iterdir()):
                quarantine = ROOT / ('.restore-v2-quarantine-' + token)
                if quarantine.exists():
                    raise RuntimeError('Restore-Quarantaene existiert bereits; manuelle Pruefung')
                os.replace(DATA, quarantine)
            else:
                DATA.rmdir()
        os.replace(displaced, DATA)
        _v2_fsync_dir(ROOT)
        _v2_journal_remove()
        print('[CROWNIQ RESTORE] Previous live data recovered; replacement (if any) quarantined')
        return

    if not displaced.exists() and not DATA.exists():
        # No live data and no displaced original: only copy into an empty path.
        shutil.copytree(safe, DATA)
        if not _v2_db_image_check(DATA):
            raise RuntimeError('Recovery-Kopie ungueltig; manuelle Pruefung')
        _v2_journal_remove()
        print('[CROWNIQ RESTORE] Live data copied back from automatic safety backup')
        return

    # Neither live state nor its history is unambiguous. Stop rather than delete.
    raise RuntimeError('Restore-Zustand mehrdeutig; alles unveraendert, manuelle Pruefung')


def restore_transaction_v2(archive, fault=None):
    """Restore a verified backup; return table counts and permanent safety-copy path.

    The optional fault callback is only for isolated crash simulation tests.
    """
    if RESTORE_JOURNAL.exists():
        raise RuntimeError('Unabgeschlossener Restore vorhanden; zuerst Recovery')
    if any(ROOT.glob('.restore-v2-displaced-*')):
        raise RuntimeError('Ungeklaerte alte Restore-Verzeichnisse; manuell pruefen')
    if not _v2_db_image_check(DATA):
        raise RuntimeError('Live-Daten nicht konsistent')
    token = uuid.uuid4().hex
    stage = ROOT / ('.restore-v2-stage-' + token)
    displaced = ROOT / ('.restore-v2-displaced-' + token)
    backup = RESTORE_V2_BACKUPS / token
    record = {'kind': RESTORE_V2_MARKER, 'token': token, 'phase': 'prepared', 'time': now()}
    stage.mkdir(mode=0o700)
    try:
        counts = verify_and_extract(archive, stage)
        (stage / 'images').mkdir(exist_ok=True)
        if not _v2_db_image_check(stage):
            raise RuntimeError('ZIP-Staging ist nicht konsistent')
        # Snapshot is always finished before ANY live-directory rename.
        _v2_snapshot_current(backup)
        _v2_journal(record)
        if fault: fault('after_prepared')
        os.replace(DATA, displaced)
        _v2_fsync_dir(ROOT)
        if fault: fault('after_displace_before_journal')
        record['phase'] = 'displaced'
        _v2_journal(record)
        if fault: fault('after_displaced')
        os.replace(stage, DATA)
        _v2_fsync_dir(ROOT)
        if fault: fault('after_stage_move_before_committed')
        if not _v2_db_image_check(DATA):
            raise RuntimeError('Wiederhergestellte Live-Daten sind fehlerhaft')
        record['phase'] = 'committed'
        _v2_journal(record)
        if fault: fault('after_committed')
        _v2_journal_remove()
        # Cleanup failure is NOT a restore failure. Old original remains safe.
        try:
            shutil.rmtree(displaced)
        except OSError as exc:
            print('[CROWNIQ RESTORE] Alte Daten nach Commit noch vorhanden:', repr(exc))
        print('[CROWNIQ RESTORE] Restore complete. Pre-restore safety backup:', backup)
        return counts, backup
    except Exception:
        if RESTORE_JOURNAL.exists():
            # Recovery can refuse ambiguous states; never delete their artifacts.
            recover_interrupted_restore_v2()
        elif stage.exists():
            shutil.rmtree(stage)
        raise


def restore_backup_v3(self):
    """HTTP entry point (test-only) with explicit confirmation header."""
    if self.headers.get('X-Crowniq-Confirm') != 'REPLACE-CROWNIQ-DATA':
        return self.sendj({'error': {'message': 'Explizite Bestaetigung fehlt'}}, 403)
    try:
        length = int(self.headers.get('Content-Length', '0'))
        if not 0 < length <= 256 * 1024 * 1024:
            return self.sendj({'error': {'message': 'Upload zu gross oder leer'}}, 413)
        _v3_check_upload_space(length)
        with tempfile.TemporaryDirectory(prefix='crowniq-v2-upload-', dir=ROOT) as td:
            archive = Path(td) / 'backup.zip'
            with archive.open('wb') as output:
                remaining = length
                while remaining:
                    chunk = self.rfile.read(min(1024 * 1024, remaining))
                    if not chunk:
                        raise ValueError('ZIP-Upload unvollstaendig')
                    output.write(chunk)
                    remaining -= len(chunk)
            counts, backup = restore_transaction_v2(archive)
            return self.sendj({'ok': True, 'tables': counts,
                               'safety_backup': str(backup)})
    except Exception as exc:
        print('[CROWNIQ RESTORE] Restore error:', repr(exc))
        return self.sendj({'error': {'message': str(exc)}}, 400)

# Replace legacy handler implementation ONLY in this isolated test copy.
# HTTP routing installed separately below

# CROWNIQ_PROD_RESTORE_V3_SPACE
import stat as _v3_stat

_V3_MIB = 1024 * 1024
_V3_RESERVE = 128 * _V3_MIB
_V3_MAX_UNPACKED = 512 * _V3_MIB


def _v3_live_size():
    if DATA.is_symlink() or not DATA.is_dir():
        raise RuntimeError('Datenverzeichnis ungueltig: Speicherpruefung verweigert')
    total = 0
    for entry in DATA.rglob('*'):
        s = entry.lstat()
        if _v3_stat.S_ISLNK(s.st_mode):
            raise RuntimeError('Symlink in aktuellen Daten: Speicherpruefung verweigert')
        if _v3_stat.S_ISREG(s.st_mode):
            total += s.st_size
        elif not _v3_stat.S_ISDIR(s.st_mode):
            raise RuntimeError('Nicht-regulaere Datei im Datenverzeichnis')
    return total


def _v3_upload_required(length):
    # Upload + current data safety copy + room to examine the uncompressed ZIP
    # in the next preflight. Do not require a worst-case 512 MiB before upload:
    # the verified ZIP sizes provide an accurate second check.
    if not isinstance(length, int) or not (0 < length <= 256 * _V3_MIB):
        raise ValueError('Ungueltige Upload-Laenge')
    return length + _v3_live_size() + _V3_RESERVE


def _v3_zip_required(archive):
    archive = Path(archive)
    if archive.is_symlink() or not archive.is_file():
        raise RuntimeError('ZIP-Quelle ungueltig')
    with zipfile.ZipFile(archive) as z:
        entries = z.infolist()
        if len(entries) > 10000 or len({e.filename for e in entries}) != len(entries):
            raise ValueError('Doppelte oder zu viele ZIP-Dateien')
        uncompressed = sum(e.file_size for e in entries)
        if uncompressed > _V3_MAX_UNPACKED:
            raise ValueError('ZIP ueberschreitet Groessenlimit')
    # Uploaded ZIP already occupies disk. Remaining disk must hold both the
    # extracted replacement and a separate copy of the current data.
    return uncompressed + _v3_live_size() + _V3_RESERVE


def _v3_require_free(required, free_override=None):
    free = shutil.disk_usage(ROOT).free if free_override is None else int(free_override)
    if free < required:
        need_mib = (required + _V3_MIB - 1) // _V3_MIB
        free_mib = free // _V3_MIB
        raise RuntimeError(
            f'Zu wenig freier Speicher: benoetigt mindestens {need_mib} MiB, '
            f'verfuegbar {free_mib} MiB; nichts wiederhergestellt'
        )
    return required, free


def _v3_check_upload_space(length, free_override=None):
    return _v3_require_free(_v3_upload_required(length), free_override)


def _v3_check_zip_space(archive, free_override=None):
    return _v3_require_free(_v3_zip_required(archive), free_override)


# The V2 restore handler resolves restore_transaction_v2 at CALL time.
# Preserve its tested journaling/snapshot and fault-injection implementation.
_V3_V2_TRANSACTION = restore_transaction_v2

def restore_transaction_v2(archive, fault=None):
    _v3_check_zip_space(archive)  # BEFORE extracting or renaming data.
    return _V3_V2_TRANSACTION(archive, fault=fault)



# Explicitly locked until after production pre-release verification.
RESTORE_ENABLED = True

def install_restore_request_lock():
    for name in ('do_GET','do_POST','do_PATCH','do_PUT','do_DELETE'):
        original = getattr(H, name)
        def locked(self, _original=original):
            with RESTORE_LOCK:
                if self.command == 'POST' and self.path == '/api/backup/restore':
                    if not RESTORE_ENABLED:
                        return self.sendj({'error': {'message': 'Restore noch nicht freigegeben'}}, 403)
                    return restore_backup_v3(self)
                return _original(self)
        setattr(H, name, locked)

install_restore_request_lock()

class IPv6HTTPServer(ThreadingHTTPServer):
    address_family = socket.AF_INET6

if __name__ == '__main__':
    # Reject unknown V1 journals; never run the old V1 recovery again.
    recover_interrupted_restore_v2()
    DATA.mkdir(exist_ok=True)
    IMAGES.mkdir(exist_ok=True)
    init_db()
    print('Crowniq Local API: http://[::1]:8788')
    IPv6HTTPServer(('::1', 8788), H).serve_forever()
