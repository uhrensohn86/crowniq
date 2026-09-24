// Crowniq Local v1: small compatibility layer for the former Supabase calls.
// Data is served by local_server.py on 127.0.0.1:8788.
const API = "http://127.0.0.1:8788/api";

type Result<T = any> = { data: T | null; error: any | null };
type Filter = { column: string; value: any };

class QueryBuilder {
  table: string; method = "GET"; body: any = null; columns = "*";
  filters: Filter[] = []; orderBy?: { column: string; ascending: boolean }; max?: number; wantSingle = false;
  constructor(table: string) { this.table = table; }
  select(columns = "*") { this.columns = columns; return this; }
  insert(body: any) { this.method = "POST"; this.body = body; return this; }
  update(body: any) { this.method = "PATCH"; this.body = body; return this; }
  upsert(body: any) { this.method = "PUT"; this.body = body; return this; }
  delete() { this.method = "DELETE"; return this; }
  eq(column: string, value: any) { this.filters.push({ column, value }); return this; }
  order(column: string, opts?: { ascending?: boolean }) { this.orderBy = { column, ascending: opts?.ascending !== false }; return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.wantSingle = true; return this; }
  then(resolve: any, reject?: any) { return this.execute().then(resolve, reject); }
  async execute(): Promise<Result> {
    try {
      const q = new URLSearchParams();
      q.set("select", this.columns);
      for (const f of this.filters) q.append("eq", `${f.column}:${encodeURIComponent(String(f.value))}`);
      if (this.orderBy) { q.set("order", this.orderBy.column); q.set("asc", String(this.orderBy.ascending)); }
      if (this.max) q.set("limit", String(this.max));
      if (this.wantSingle) q.set("single", "1");
      const r = await fetch(`${API}/table/${this.table}?${q}`, {
        method: this.method,
        headers: this.body != null ? { "Content-Type": "application/json" } : undefined,
        body: this.body != null ? JSON.stringify(this.body) : undefined,
      });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok) return { data: null, error: payload.error ?? { message: `HTTP ${r.status}` } };
      return { data: payload.data ?? null, error: null };
    } catch (e: any) { return { data: null, error: { message: e?.message ?? String(e) } }; }
  }
}

const storageBucket = () => ({
  async upload(path: string, file: File) {
    const fd = new FormData(); fd.append("file", file); fd.append("path", path);
    try { const r = await fetch(`${API}/storage/upload`, { method: "POST", body: fd }); const p = await r.json(); return r.ok ? { data: p.data, error: null } : { data: null, error: p.error }; }
    catch (e: any) { return { data: null, error: { message: e?.message ?? String(e) } }; }
  },
  async remove(paths: string[]) {
    const r = await fetch(`${API}/storage/remove`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths }) });
    const p = await r.json().catch(() => ({})); return r.ok ? { data: p.data ?? [], error: null } : { data: null, error: p.error };
  },
  async createSignedUrl(path: string, _seconds: number) { return { data: { signedUrl: `${API}/image?path=${encodeURIComponent(path)}` }, error: null }; },
});

export const supabase = {
  from(table: string) { return new QueryBuilder(table); },
  storage: { from(_bucket: string) { return storageBucket(); } },
};
