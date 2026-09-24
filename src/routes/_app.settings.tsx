import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useLocalUser } from "@/lib/local-user";
import { useI18n, LANGS, LANG_LABELS, type Lang } from "@/lib/i18n";
import { NativeSelect } from "@/components/ui/native-select";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme";

export const Route = createFileRoute("/_app/settings")({
  component: Settings,
});

function Settings() {
  const user = useLocalUser();
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dashboardStats, setDashboardStats] = useState<Record<string,boolean>>({watches:true,cost:true,market:true,insurance:true});
  useEffect(()=>{ try { setDashboardStats((v)=>({...v,...JSON.parse(localStorage.getItem("crowniq-dashboard-stats")||"{}")})); } catch {} },[]);
  const toggleDashboardStat=(key:string,checked:boolean)=>{ const next={...dashboardStats,[key]:checked}; setDashboardStats(next); localStorage.setItem("crowniq-dashboard-stats",JSON.stringify(next)); };

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("id", user.id).single()
      .then(({ data }) => setDisplayName(data?.display_name ?? ""));
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles")
      .upsert({ id: user.id, display_name: displayName });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success(t("settings.profileSaved"));
  };

  const exportJson = async () => {
    const [w, d, i, wears] = await Promise.all([
      supabase.from("watches").select("*"),
      supabase.from("watch_purchase_discounts").select("*"),
      supabase.from("watch_images").select("*"),
      supabase.from("watch_wears").select("*"),
    ]);
    const blob = new Blob(
      [JSON.stringify({ watches: w.data, discounts: d.data, images: i.data, wears: wears.data, exported_at: new Date().toISOString() }, null, 2)],
      { type: "application/json" }
    );
    download(blob, `watches-${new Date().toISOString().slice(0, 10)}.json`);
  };

  const exportCsv = async () => {
    const { data: watches } = await supabase.from("watches").select("*");
    if (!watches || watches.length === 0) {
      toast.error(t("settings.noExportData"));
      return;
    }
    const cols = Object.keys(watches[0]).filter((k) => k !== "primary_image_path");
    const escape = (v: unknown) => {
      if (v === null || v === undefined) return "";
      const s = Array.isArray(v) ? v.join("|") : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      cols.join(","),
      ...watches.map((w) => cols.map((c) => escape((w as Record<string, unknown>)[c])).join(",")),
    ].join("\n");
    download(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `watches-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const importJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const txt = await file.text();
      const json = JSON.parse(txt);
      const watches = (json.watches ?? []) as Record<string, unknown>[];
      const discounts = (json.discounts ?? []) as Record<string, unknown>[];
      let count = 0;
      for (const w of watches) {
        const oldId = w.id;
        const { id: _id, user_id: _u, created_at: _c, updated_at: _up, primary_image_path: _p, ...rest } = w;
        void _id; void _u; void _c; void _up; void _p;
        const { data: inserted } = await supabase
          .from("watches").insert({ ...rest, user_id: user.id } as never).select("id").single();
        if (!inserted) continue;
        const newId = inserted.id;
        const relDiscounts = discounts.filter((d) => d.watch_id === oldId);
        if (relDiscounts.length > 0) {
          await supabase.from("watch_purchase_discounts").insert(
            relDiscounts.map((d) => ({
              watch_id: newId, user_id: user.id,
              label: String(d.label), amount: Number(d.amount),
            }))
          );
        }
        count++;
      }
      toast.success(t("settings.imported", { count }));
    } catch (err) {
      toast.error(t("settings.importFailed", { error: err instanceof Error ? err.message : t("settings.unknownError") }));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-4xl font-semibold">{t("settings.title")}</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("settings.profile")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm">{t("settings.displayName")}</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <Button onClick={saveProfile} disabled={saving}>{saving ? t("action.saving") : t("action.save")}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Darstellung</CardTitle>
          <CardDescription>Crowniq-Farbthema auf diesem Gerät.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2">
          {(["ivory", "graphite", "oled"] as Theme[]).map((item) => (
            <Button key={item} type="button" variant={theme === item ? "default" : "outline"} onClick={() => setTheme(item)} className="capitalize">
              {item === "ivory" ? "Ivory" : item === "graphite" ? "Graphite" : "OLED"}
            </Button>
          ))}
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>Wähle, welche Kennzahlen auf dem Dashboard angezeigt werden.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[["watches", t("dashboard.stat.watches")],["cost", t("dashboard.stat.acquisitionCost")],["market", t("dashboard.stat.marketValue")],["insurance", t("dashboard.stat.insuranceValue")]].map(([key,label]) => (
            <label key={key} className="flex items-center gap-3"><input type="checkbox" checked={dashboardStats[key]} onChange={(e)=>toggleDashboardStat(key,e.target.checked)} className="h-5 w-5"/><span>{label}</span></label>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.language")}</CardTitle>
          <CardDescription>{t("settings.languageDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label className="text-sm" htmlFor="language">{t("settings.language")}</Label>
            <NativeSelect id="language" value={lang} onChange={(e)=>setLang(e.target.value as Lang)}>{LANGS.map((l)=><option key={l} value={l}>{LANG_LABELS[l]}</option>)}</NativeSelect>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.backup")}</CardTitle>
          <CardDescription>{t("settings.backupDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportJson}><Download className="h-4 w-4" /> {t("settings.exportJson")}</Button>
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> {t("settings.exportCsv")}</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> {t("settings.importJson")}
          </Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importJson} />
        </CardContent>
      </Card>
    </div>

  );
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
