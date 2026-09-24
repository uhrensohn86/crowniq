import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useLocalUser } from "@/lib/local-user";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SignedImage } from "@/components/SignedImage";
import { toast } from "sonner";
import { CalendarDays, Trash2, Shuffle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/wear")({
  component: WearTracker,
});

interface WatchLite {
  id: string;
  brand: string;
  model: string;
  primary_image_path: string | null;
}

interface WearRow {
  id: string;
  watch_id: string;
  worn_on: string;
  notes: string | null;
  watches: WatchLite | null;
}

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function WearTracker() {
  const user = useLocalUser();
  const { t, lang } = useI18n();
  const locale = { en: "en-US", de: "de-DE", fr: "fr-FR", es: "es-ES" }[lang];
  const [watches, setWatches] = useState<WatchLite[]>([]);
  const [wears, setWears] = useState<WearRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [watchId, setWatchId] = useState<string>("");
  const [date, setDate] = useState<string>(todayISO());
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!user) return;
    const [{ data: w }, { data: ww }] = await Promise.all([
      supabase.from("watches").select("id,brand,model,primary_image_path").order("brand"),
      supabase
        .from("watch_wears")
        .select("id,watch_id,worn_on,notes,watches(id,brand,model,primary_image_path)")
        .order("worn_on", { ascending: false })
        .limit(200),
    ]);
    setWatches((w ?? []) as WatchLite[]);
    setWears((ww ?? []) as unknown as WearRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function addWear(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !watchId) return;
    setSaving(true);
    const { error } = await supabase.from("watch_wears").insert({
      user_id: user.id,
      watch_id: watchId,
      worn_on: date,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      if (error.code === "23505") {
        toast.error(t("wear.alreadyLoggedError"));
      } else {
        toast.error(error.message);
      }
      return;
    }
    setNotes("");
    toast.success(t("wear.entrySaved"));
    load();
  }

  async function removeWear(id: string) {
    const { error } = await supabase.from("watch_wears").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setWears((rows) => rows.filter((r) => r.id !== id));
  }

  const grouped = useMemo(() => {
    const map = new Map<string, WearRow[]>();
    for (const w of wears) {
      const arr = map.get(w.worn_on) ?? [];
      arr.push(w);
      map.set(w.worn_on, arr);
    }
    return Array.from(map.entries());
  }, [wears]);

  const stats = useMemo(() => {
    const byWatch = new Map<string, { watch: WatchLite | null; count: number }>();
    for (const w of wears) {
      const cur = byWatch.get(w.watch_id) ?? { watch: w.watches, count: 0 };
      cur.count++;
      byWatch.set(w.watch_id, cur);
    }
    return Array.from(byWatch.values()).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [wears]);

  const months = useMemo(() => {
    const set = new Set(wears.map((w) => w.worn_on.slice(0, 7)));
    const cur = todayISO().slice(0, 7);
    set.add(cur);
    return Array.from(set).sort().reverse();
  }, [wears]);

  const [month, setMonth] = useState<string>(todayISO().slice(0, 7));
  useEffect(() => {
    if (months.length > 0 && !months.includes(month)) setMonth(months[0]);
  }, [months, month]);

  const monthly = useMemo(() => {
    const rows = wears.filter((w) => w.worn_on.startsWith(month));
    const byWatch = new Map<string, { watch: WatchLite | null; count: number }>();
    for (const w of rows) {
      const cur = byWatch.get(w.watch_id) ?? { watch: w.watches, count: 0 };
      cur.count++;
      byWatch.set(w.watch_id, cur);
    }
    const list = Array.from(byWatch.values()).sort((a, b) => b.count - a.count);
    return {
      total: rows.length,
      days: new Set(rows.map((r) => r.worn_on)).size,
      list,
      max: list[0]?.count ?? 0,
    };
  }, [wears, month]);

  const [suggestion, setSuggestion] = useState<WatchLite | null>(null);
  const suggestRandom = () => {
    if (watches.length === 0) {
      toast.error(t("wear.noWatchesInCollection"));
      return;
    }
    const pool = watches.length > 1 && suggestion
      ? watches.filter((w) => w.id !== suggestion.id)
      : watches;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setSuggestion(pick);
    setWatchId(pick.id);
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold">{t("wear.title")}</h1>
        <p className="text-muted-foreground">{t("wear.subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("wear.addEntry")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addWear} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("wear.watch")}</Label>
                <NativeSelect value={watchId} onChange={(e)=>setWatchId(e.target.value)}><option value="">{t("wear.watchPlaceholder")}</option>{watches.map((w)=><option key={w.id} value={w.id}>{w.brand} {w.model}</option>)}</NativeSelect>
              </div>
              <div className="space-y-2">
                <Label>{t("wear.date")}</Label>
                <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("wear.notes")}</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={t("wear.notesPlaceholder")} />
              </div>
              <Button type="submit" disabled={!watchId || saving} className="w-full">
                {saving ? t("wear.saving") : t("wear.save")}
              </Button>
            </form>

            <div className="mt-6 border-t border-border pt-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                {t("wear.watchOfTheDay")}
              </div>
              {suggestion && (
                <div className="mb-3 flex items-center gap-3 rounded-md border border-border p-2">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                    <SignedImage path={suggestion.primary_image_path} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{suggestion.brand}</div>
                    <div className="truncate text-sm text-muted-foreground">{suggestion.model}</div>
                  </div>
                </div>
              )}
              <Button type="button" variant="outline" className="w-full" onClick={suggestRandom}>
                <Shuffle className="h-4 w-4" />
                {suggestion ? t("wear.suggestOther") : t("wear.suggestRandom")}
              </Button>
            </div>

            {stats.length > 0 && (
              <div className="mt-6 border-t border-border pt-4">
                <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  {t("wear.mostWorn")}
                </div>
                <ul className="space-y-1 text-sm">
                  {stats.map((s, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{s.watch ? `${s.watch.brand} ${s.watch.model}` : "—"}</span>
                      <span className="font-mono text-muted-foreground">{s.count}×</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pb-2 sm:flex sm:justify-between">
              <CardTitle className="truncate text-base">{t("wear.monthlyStats")}</CardTitle>
              <NativeSelect value={month} onChange={(e)=>setMonth(e.target.value)} className="w-[170px] shrink-0">{months.map((m)=><option key={m} value={m}>{new Date(`${m}-01`).toLocaleDateString(locale,{month:"long",year:"numeric"})}</option>)}</NativeSelect>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex gap-6 text-sm">
                <div>
                  <div className="font-display text-2xl">{monthly.total}</div>
                  <div className="text-xs text-muted-foreground">{t("wear.entries")}</div>
                </div>
                <div>
                  <div className="font-display text-2xl">{monthly.days}</div>
                  <div className="text-xs text-muted-foreground">{t("wear.daysWorn")}</div>
                </div>
                <div>
                  <div className="font-display text-2xl">{monthly.list.length}</div>
                  <div className="text-xs text-muted-foreground">{t("wear.watchesInUse")}</div>
                </div>
              </div>
              {monthly.list.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("wear.noEntriesThisMonth")}</p>
              ) : (
                <ul className="space-y-2">
                  {monthly.list.map((s, i) => (
                    <li key={i} className="space-y-1">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="truncate">{s.watch ? `${s.watch.brand} ${s.watch.model}` : t("wear.deletedWatch")}</span>
                        <span className="shrink-0 font-mono text-muted-foreground">{s.count}×</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-accent"
                          style={{ width: `${monthly.max ? (s.count / monthly.max) * 100 : 0}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <h2 className="font-display text-2xl">{t("wear.history")}</h2>
          {loading ? (
            <p className="text-muted-foreground">{t("wear.loading")}</p>
          ) : grouped.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-50" />
                {t("wear.noEntriesYet")}
              </CardContent>
            </Card>
          ) : (
            grouped.map(([day, entries]) => (
              <Card key={day}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-normal text-muted-foreground">
                    {new Date(day).toLocaleDateString(locale, {
                      weekday: "long", day: "2-digit", month: "long", year: "numeric",
                    })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {entries.map((e) => (
                    <div key={e.id} className="flex items-center gap-3 rounded-md border border-border p-2">
                      <div className="h-12 w-12 overflow-hidden rounded bg-muted shrink-0">
                        <SignedImage path={e.watches?.primary_image_path ?? null} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {e.watches ? (
                          <Link to="/watches/$id" params={{ id: e.watches.id }} className="font-medium hover:underline">
                            {e.watches.brand} <span className="text-muted-foreground">{e.watches.model}</span>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">{t("wear.deletedWatch")}</span>
                        )}
                        {e.notes && <div className="truncate text-xs text-muted-foreground">{e.notes}</div>}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeWear(e.id)} title={t("wear.delete")}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
