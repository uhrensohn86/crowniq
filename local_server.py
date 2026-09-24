#!/usr/bin/env python3
"""Crowniq Local v1 backend. Python stdlib only: SQLite + images + REST API."""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote
from pathlib import Path
from email.parser import BytesParser
from email.policy import default
import sqlite3, json, uuid, datetime, mimetypes, shutil, zipfile, io, os

ROOT=Path(__file__).resolve().parent
DATA=ROOT/'data'; IMAGES=DATA/'images'; DB=DATA/'crowniq.db'
DATA.mkdir(exist_ok=True); IMAGES.mkdir(exist_ok=True)
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
        self.send_header('Access-Control-Allow-Origin','http://127.0.0.1:3000'); self.send_header('Access-Control-Allow-Headers','Content-Type'); self.send_header('Access-Control-Allow-Methods','GET,POST,PATCH,PUT,DELETE,OPTIONS')
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
    def do_GET(self):
        u=urlparse(self.path); q=parse_qs(u.query)
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

if __name__=='__main__':
    init_db(); print('Crowniq Local API: http://127.0.0.1:8788'); ThreadingHTTPServer(('127.0.0.1',8788),H).serve_forever()
