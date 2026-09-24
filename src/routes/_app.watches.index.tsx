import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocalUser } from "@/lib/local-user";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { SignedImage } from "@/components/SignedImage";
import { formatCurrency } from "@/lib/watch-utils";
import { useI18n } from "@/lib/i18n";
import { Plus, Search, LayoutGrid, List, ArrowUp, ArrowDown, Columns3 } from "lucide-react";
import { NativeSelect } from "@/components/ui/native-select";

export const Route = createFileRoute("/_app/watches/")({
  component: WatchesIndex,
});

interface WatchRow {
  id: string;
  brand: string;
  model: string;
  reference_number: string | null;
  movement_type: string | null;
  case_material: string | null;
  purchase_date: string | null;
  final_price: number | null;
  current_market_value: number | null;
  effective_price?: number | null;
  primary_image_path: string | null;
  currency: string | null;
}

type SortKey = "brand" | "purchase_date" | "effective_price" | "current_market_value";

const LOCALES = { en: "en-US", de: "de-DE", fr: "fr-FR", es: "es-ES" } as const;

function WatchesIndex() {
  const user = useLocalUser();
  const { t, lang } = useI18n();
  const locale = LOCALES[lang];
  const [watches, setWatches] = useState<WatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const readStorage = (key: string) => typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  const [view, setView] = useState<"grid" | "list">(() => readStorage("crowniq-watches-view") === "list" ? "list" : "grid");
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [movementFilter, setMovementFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const saved = readStorage("crowniq-watches-sort-key") as SortKey | null;
    return saved && ["brand", "purchase_date", "effective_price", "current_market_value"].includes(saved) ? saved : "brand";
  });
  const [sortDir, setSortDir] = useState<"asc"|"desc">(() => readStorage("crowniq-watches-sort-dir") === "desc" ? "desc" : "asc");
  const isMobile = useIsMobile();
  const [cols, setCols] = useState<{ mobile: number; desktop: number }>(() => {
    const raw = readStorage("watch-grid-cols");
    if (raw) {
      try {
        const p = JSON.parse(raw);
        if (p && typeof p.mobile === "number" && typeof p.desktop === "number") return p;
      } catch { /* ignore */ }
    }
    return { mobile: 1, desktop: 4 };
  });

  const setColumns = (n: number) => {
    const next = isMobile ? { ...cols, mobile: n } : { ...cols, desktop: n };
    setCols(next);
    localStorage.setItem("watch-grid-cols", JSON.stringify(next));
  };
  const activeCols = isMobile ? cols.mobile : cols.desktop;

  useEffect(() => { localStorage.setItem("crowniq-watches-sort-key", sortKey); }, [sortKey]);
  useEffect(() => { localStorage.setItem("crowniq-watches-sort-dir", sortDir); }, [sortDir]);
  useEffect(() => { localStorage.setItem("crowniq-watches-view", view); }, [view]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("watches").select("id,brand,model,reference_number,movement_type,case_material,purchase_date,final_price,current_market_value,primary_image_path,currency"),
      supabase.from("watch_purchase_discounts").select("watch_id,amount"),
    ]).then(([watchResult, discountResult]) => {
      const discountTotals = (discountResult.data ?? []).reduce<Record<string, number>>((acc, d: any) => {
        acc[d.watch_id] = (acc[d.watch_id] ?? 0) + Number(d.amount ?? 0);
        return acc;
      }, {});
      const rows = ((watchResult.data ?? []) as WatchRow[]).map((w) => ({
        ...w,
        effective_price: w.final_price == null ? null : Math.max(0, Number(w.final_price) - (discountTotals[w.id] ?? 0)),
      }));
      setWatches(rows);
      setLoading(false);
    });
  }, [user]);

  const brands = useMemo(
    () => Array.from(new Set(watches.map((w) => w.brand))).sort(),
    [watches]
  );
  const movements = useMemo(
    () => Array.from(new Set(watches.map((w) => w.movement_type).filter(Boolean) as string[])).sort(),
    [watches]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return watches
      .filter((w) => {
        if (brandFilter !== "all" && w.brand !== brandFilter) return false;
        if (movementFilter !== "all" && w.movement_type !== movementFilter) return false;
        if (q) {
          const hay = `${w.brand} ${w.model} ${w.reference_number ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === "brand") cmp = `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, locale);
        else if (sortKey === "purchase_date") cmp = (a.purchase_date ?? "").localeCompare(b.purchase_date ?? "");
        else {
          const av = a[sortKey]; const bv = b[sortKey];
          if (av == null && bv == null) cmp = 0;
          else if (av == null) cmp = 1;
          else if (bv == null) cmp = -1;
          else cmp = Number(av) - Number(bv);
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [watches, search, brandFilter, movementFilter, sortKey, sortDir, locale]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold">{t("watches.title")}</h1>
          <p className="text-muted-foreground">{t("watches.count", { n: watches.length })}</p>
        </div>
        <Button asChild>
          <Link to="/watches/new">
            <Plus className="h-4 w-4" />
            {t("watches.new")}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("watches.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <NativeSelect value={brandFilter} onChange={(e)=>setBrandFilter(e.target.value)} className="w-[160px]"><option value="all">{t("watches.allBrands")}</option>{brands.map((b)=><option key={b} value={b}>{b}</option>)}</NativeSelect>
        <NativeSelect value={movementFilter} onChange={(e)=>setMovementFilter(e.target.value)} className="w-[160px]"><option value="all">{t("watches.allMovements")}</option>{movements.map((m)=><option key={m} value={m}>{t(`form.movementType.${m}`)}</option>)}</NativeSelect>
        <NativeSelect value={sortKey} onChange={(e)=>setSortKey(e.target.value as SortKey)} className="w-[180px]"><option value="brand">{t("watches.sort.brandModel")}</option><option value="purchase_date">{t("watches.sort.purchaseDate")}</option><option value="effective_price">{t("watches.sort.purchasePrice")}</option><option value="current_market_value">{t("watches.sort.marketValue")}</option></NativeSelect><Button type="button" variant="outline" size="icon" onClick={()=>setSortDir((d)=>d==="asc"?"desc":"asc")} title={sortDir==="asc"?"Aufsteigend":"Absteigend"}>{sortDir==="asc"?<ArrowUp className="h-4 w-4"/>:<ArrowDown className="h-4 w-4"/>}</Button>
        <div className="flex rounded-md border border-border">
          <Button variant={view === "grid" ? "secondary" : "ghost"} size="icon" onClick={() => setView("grid")}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" onClick={() => setView("list")}>
            <List className="h-4 w-4" />
          </Button>
        </div>
        {view === "grid" && (
          <div className="flex items-center gap-1 rounded-md border border-border px-2 py-1">
            <Columns3 className="h-4 w-4 shrink-0 text-muted-foreground" />
            {(isMobile ? [1, 2, 3, 4] : [2, 3, 4, 5, 6]).map((n) => (
              <Button
                key={n}
                variant={activeCols === n ? "secondary" : "ghost"}
                size="sm"
                className="h-7 w-7 p-0 font-mono text-xs"
                onClick={() => setColumns(n)}
                title={t("watches.columns", { n })}
              >
                {n}
              </Button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">{t("watches.loading")}</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {watches.length === 0 ? t("watches.emptyNone") : t("watches.emptyFiltered")}
          </CardContent>
        </Card>
      ) : view === "grid" ? (
        <div
          className={activeCols >= 4 ? "grid gap-2" : "grid gap-4"}
          style={{ gridTemplateColumns: `repeat(${activeCols}, minmax(0, 1fr))` }}
        >
          {filtered.map((w) => (
            <Link key={w.id} to="/watches/$id" params={{ id: w.id }}>
              <Card className="overflow-hidden transition hover:shadow-lg hover:-translate-y-0.5 pt-0">
                <div className="aspect-square overflow-hidden bg-muted">
                  <SignedImage path={w.primary_image_path} alt={`${w.brand} ${w.model}`} className="h-full w-full object-cover" />
                </div>
                <CardContent className={activeCols >= 4 ? "p-2" : "p-4"}>
                  <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">{w.brand}</div>
                  <div className={`truncate font-display leading-tight ${activeCols >= 4 ? "text-sm" : "text-lg"}`}>{w.model}</div>
                  {w.reference_number && activeCols < 4 && (
                    <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{t("watches.reference", { ref: w.reference_number })}</div>
                  )}
                  <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                    {activeCols < 4 && <span className="truncate text-muted-foreground">{w.movement_type ? t(`form.movementType.${w.movement_type}`) : "—"}</span>}
                    <span className={`ml-auto shrink-0 font-mono ${activeCols >= 4 ? "text-xs" : ""}`}>{formatCurrency(w.effective_price, w.currency ?? "EUR", locale)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t("watches.table.brandModel")}</th>
                  <th className="px-4 py-3">{t("watches.table.reference")}</th>
                  <th className="px-4 py-3">{t("watches.table.movement")}</th>
                  <th className="px-4 py-3">{t("watches.table.material")}</th>
                  <th className="px-4 py-3 text-right">{t("watches.table.purchasePrice")}</th>
                  <th className="px-4 py-3 text-right">{t("watches.table.marketValue")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((w) => (
                  <tr key={w.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link to="/watches/$id" params={{ id: w.id }} className="font-medium hover:underline">
                        {w.brand} <span className="text-muted-foreground">{w.model}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{w.reference_number ?? "—"}</td>
                    <td className="px-4 py-3">{w.movement_type ? t(`form.movementType.${w.movement_type}`) : "—"}</td>
                    <td className="px-4 py-3">{w.case_material ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(w.effective_price, w.currency ?? "EUR", locale)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(w.current_market_value, w.currency ?? "EUR", locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
