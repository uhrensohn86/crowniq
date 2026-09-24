import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useLocalUser } from "@/lib/local-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { COMPLICATIONS, MOVEMENT_TYPES, CRYSTALS, CASE_MATERIALS, CASE_FINISHES, CASE_COATINGS, formatCurrency } from "@/lib/watch-utils";
import { SignedImage } from "@/components/SignedImage";
import { SuggestInput } from "@/components/SuggestInput";
import { toast } from "sonner";
import { Trash2, Plus, Upload, X, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface Discount { id?: string; label: string; amount: string }
interface ImageItem { id?: string; storage_path: string; isNew?: boolean; file?: File }

interface WatchFormData {
  brand: string;
  model: string;
  reference_number: string;
  serial_number: string;
  purchase_date: string;
  dealer: string;
  movement_caliber: string;
  movement_manufacturer: string;
  movement_type: string;
  case_material: string;
  case_finish: string;
  case_coating: string;
  diameter_mm: string;
  lug_to_lug_mm: string;
  lug_width_mm: string;
  water_resistance_m: string;
  crystal: string;
  bracelet_material: string;
  bracelet_type: string;
  battery_type: string;
  case_back: string;
  complications: string[];
  msrp: string;
  discount_percent: string;
  discount_amount: string;
  final_price: string;
  currency: string;
  payment_method: string;
  current_market_value: string;
  market_value_date: string;
  insurance_value: string;
  notes: string;
}

const empty: WatchFormData = {
  brand: "", model: "", reference_number: "", serial_number: "",
  purchase_date: "", dealer: "",
  movement_caliber: "", movement_manufacturer: "", movement_type: "", case_material: "", case_finish: "", case_coating: "",
  diameter_mm: "", lug_to_lug_mm: "", lug_width_mm: "",
  water_resistance_m: "", crystal: "",
  bracelet_material: "", bracelet_type: "", battery_type: "", case_back: "", complications: [],
  msrp: "", discount_percent: "", discount_amount: "", final_price: "",
  currency: "EUR", payment_method: "",
  current_market_value: "", market_value_date: "", insurance_value: "",
  notes: "",
};

const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function WatchForm({ watchId }: { watchId?: string }) {
  const user = useLocalUser();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [data, setData] = useState<WatchFormData>(empty);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [primaryPath, setPrimaryPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!watchId);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<{
    brand: string[]; dealer: string[]; movement_caliber: string[]; movement_manufacturer: string[];
  }>({ brand: [], dealer: [], movement_caliber: [], movement_manufacturer: [] });

  useEffect(() => {
    (async () => {
      const { data: rows } = await supabase
        .from("watches")
        .select("brand,dealer,movement_caliber,movement_manufacturer");
      if (!rows) return;
      const collect = (key: "brand" | "dealer" | "movement_caliber" | "movement_manufacturer") =>
        Array.from(new Set(rows.map((r) => (r[key] ?? "") as string).filter((v) => v.trim() !== "")))
          .sort((a, b) => a.localeCompare(b));
      setSuggestions({
        brand: collect("brand"),
        dealer: collect("dealer"),
        movement_caliber: collect("movement_caliber"),
        movement_manufacturer: collect("movement_manufacturer"),
      });
    })();
  }, []);

  useEffect(() => {
    if (!watchId) return;
    (async () => {
      const { data: w } = await supabase.from("watches").select("*").eq("id", watchId).single();
      if (w) {
        setData({
          brand: w.brand ?? "", model: w.model ?? "",
          reference_number: w.reference_number ?? "", serial_number: w.serial_number ?? "",
          purchase_date: w.purchase_date ?? "", dealer: w.dealer ?? "",
          movement_caliber: w.movement_caliber ?? "",
          movement_manufacturer: w.movement_manufacturer ?? "",
          movement_type: w.movement_type ?? "",
          case_material: w.case_material ?? "",
          case_finish: (w as any).case_finish ?? "",
          case_coating: (w as any).case_coating ?? "",
          diameter_mm: w.diameter_mm?.toString() ?? "",
          lug_to_lug_mm: w.lug_to_lug_mm?.toString() ?? "",
          lug_width_mm: w.lug_width_mm?.toString() ?? "",
          water_resistance_m: w.water_resistance_m?.toString() ?? "",
          crystal: w.crystal ?? "",
          bracelet_material: w.bracelet_material ?? "",
          bracelet_type: w.bracelet_type ?? "",
          battery_type: (w as { battery_type?: string | null }).battery_type ?? "",
          case_back: (w as { case_back?: string | null }).case_back ?? "",
          complications: w.complications ?? [],
          msrp: w.msrp?.toString() ?? "",
          discount_percent: w.discount_percent?.toString() ?? "",
          discount_amount: w.discount_amount?.toString() ?? "",
          final_price: w.final_price?.toString() ?? "",
          currency: w.currency ?? "EUR",
          payment_method: w.payment_method ?? "",
          current_market_value: w.current_market_value?.toString() ?? "",
          market_value_date: w.market_value_date ?? "",
          insurance_value: w.insurance_value?.toString() ?? "",
          notes: w.notes ?? "",
        });
        const { data: ds } = await supabase
          .from("watch_purchase_discounts").select("*").eq("watch_id", watchId);
        setDiscounts((ds ?? []).map((d) => ({ id: d.id, label: d.label, amount: String(d.amount ?? "") })));
        const { data: imgs } = await supabase
          .from("watch_images").select("*").eq("watch_id", watchId).order("sort_order");
        const list = (imgs ?? []).map((i) => ({ id: i.id, storage_path: i.storage_path }));
        setImages(list);
        setPrimaryPath(w.primary_image_path ?? list[0]?.storage_path ?? null);
      }
      setLoading(false);
    })();
  }, [watchId]);

  // Auto-calc discount (UVP - Kaufpreis) and final price (Kaufpreis - sonstige Vergünstigungen)
  const computed = useMemo(() => {
    const msrp = num(data.msrp);
    const purchase = num(data.final_price);
    const otherDiscounts = discounts.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const calcDiscount =
      msrp !== null && purchase !== null ? Math.max(0, msrp - purchase) : 0;
    const calcDiscountPct =
      msrp !== null && msrp > 0 && purchase !== null ? (calcDiscount / msrp) * 100 : null;
    const finalCalc = purchase !== null ? purchase - otherDiscounts : null;
    return { calcDiscount, calcDiscountPct, otherDiscounts, finalCalc };
  }, [data.msrp, data.final_price, discounts]);

  const update = <K extends keyof WatchFormData>(key: K, value: WatchFormData[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const toggleComplication = (c: string) => {
    setData((d) => ({
      ...d,
      complications: d.complications.includes(c)
        ? d.complications.filter((x) => x !== c)
        : [...d.complications, c],
    }));
  };

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const newItems: ImageItem[] = files.map((f) => ({
      storage_path: URL.createObjectURL(f),
      isNew: true,
      file: f,
    }));
    setImages((prev) => {
      const next = [...prev, ...newItems];
      if (!primaryPath && next[0]) setPrimaryPath(next[0].storage_path);
      return next;
    });
    e.target.value = "";
  };

  const removeImage = (idx: number) => {
    setImages((prev) => {
      const removed = prev[idx];
      const next = prev.filter((_, i) => i !== idx);
      if (removed?.storage_path === primaryPath) setPrimaryPath(next[0]?.storage_path ?? null);
      return next;
    });
  };

  const moveImage = (idx: number, delta: -1 | 1) => {
    setImages((prev) => {
      const target = idx + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const onSave = async () => {
    if (!user) return;
    if (!data.brand || !data.model) {
      toast.error(t("form.validation.brandModelRequired"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        brand: data.brand, model: data.model,
        reference_number: data.reference_number || null,
        serial_number: data.serial_number || null,
        purchase_date: data.purchase_date || null,
        dealer: data.dealer || null,
        movement_caliber: data.movement_caliber || null,
        movement_manufacturer: data.movement_manufacturer || null,
        movement_type: data.movement_type || null,
        case_material: data.case_material || null,
        case_finish: data.case_finish || null,
        case_coating: data.case_coating || null,
        diameter_mm: num(data.diameter_mm),
        lug_to_lug_mm: num(data.lug_to_lug_mm),
        lug_width_mm: num(data.lug_width_mm),
        water_resistance_m: num(data.water_resistance_m),
        crystal: data.crystal || null,
        bracelet_material: data.bracelet_material || null,
        bracelet_type: data.bracelet_type || null,
        battery_type: data.movement_type === "quartz" ? (data.battery_type || null) : null,
        case_back: data.case_back || null,
        complications: data.complications,
        msrp: num(data.msrp),
        discount_percent: computed.calcDiscountPct === null ? null : Number(computed.calcDiscountPct.toFixed(2)),
        discount_amount: computed.calcDiscount || null,
        final_price: num(data.final_price),
        currency: data.currency || "EUR",
        payment_method: data.payment_method || null,
        current_market_value: num(data.current_market_value),
        market_value_date: data.market_value_date || null,
        insurance_value: num(data.insurance_value),
        notes: data.notes || null,
      };

      let id = watchId;
      if (id) {
        const { error } = await supabase.from("watches").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("watches").insert(payload).select("id").single();
        if (error) throw error;
        id = inserted.id;
      }

      // Upload new images
      const finalPaths: string[] = [];
      let uploadedPrimaryPath: string | null = null;
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.isNew && img.file) {
          const ext = img.file.name.split(".").pop() || "jpg";
          const path = `${user.id}/${id}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("watch-images").upload(path, img.file);
          if (upErr) throw upErr;
          await supabase.from("watch_images").insert({
            watch_id: id, user_id: user.id, storage_path: path, sort_order: i,
          });
          finalPaths.push(path);
          if (img.storage_path === primaryPath) uploadedPrimaryPath = path;
        } else {
          finalPaths.push(img.storage_path);
          if (img.id) {
            await supabase.from("watch_images").update({ sort_order: i }).eq("id", img.id);
          }
        }
      }

      // Delete removed images (only when editing)
      if (watchId) {
        const { data: existing } = await supabase
          .from("watch_images").select("id,storage_path").eq("watch_id", id);
        const keepPaths = new Set(finalPaths);
        for (const ex of existing ?? []) {
          if (!keepPaths.has(ex.storage_path)) {
            await supabase.storage.from("watch-images").remove([ex.storage_path]);
            await supabase.from("watch_images").delete().eq("id", ex.id);
          }
        }
      }

      // Update primary image path
      const selectedPrimary = uploadedPrimaryPath ?? (primaryPath && finalPaths.includes(primaryPath) ? primaryPath : (finalPaths[0] ?? null));
      await supabase.from("watches").update({ primary_image_path: selectedPrimary }).eq("id", id);

      // Replace discounts
      await supabase.from("watch_purchase_discounts").delete().eq("watch_id", id);
      if (discounts.length > 0) {
        await supabase.from("watch_purchase_discounts").insert(
          discounts.map((d) => ({
            watch_id: id!, user_id: user.id, label: d.label, amount: Number(d.amount) || 0,
          }))
        );
      }

      toast.success(watchId ? t("form.toast.updated") : t("form.toast.created"));
      navigate({ to: "/watches/$id", params: { id: id! } });
    } catch (e) {
      console.error(e);
      toast.error(t("form.toast.saveError", { message: e instanceof Error ? e.message : t("form.toast.saveError.unknown") }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">{t("form.loading")}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">
          {watchId ? t("form.title.edit") : t("form.title.new")}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/watches" })}>{t("form.cancel")}</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? t("form.saving") : t("form.save")}</Button>
        </div>
      </div>

      {/* Images */}
      <Card>
        <CardHeader><CardTitle>{t("form.section.images")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {images.map((img, i) => (
                <div key={i} className="group overflow-hidden rounded-md border border-border bg-card">
                  <div className="relative aspect-square overflow-hidden">
                    {img.isNew ? (
                      <img src={img.storage_path} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <SignedImage path={img.storage_path} alt="" className="h-full w-full object-cover" />
                    )}
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute right-1 top-1 rounded-full bg-background/90 p-1.5 shadow"
                    title={t("form.images.delete")} aria-label={t("form.images.delete")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                  </div>
                  <div className="flex items-center justify-between gap-1 p-1.5">
                    <button
                      type="button"
                      onClick={() => setPrimaryPath(img.storage_path)}
                      className={`flex min-w-0 items-center gap-1 rounded px-1.5 py-1 text-[10px] ${
                        primaryPath === img.storage_path ? "bg-accent text-accent-foreground" : "bg-muted text-foreground"
                      }`}
                    >
                      <Star className="h-3 w-3 shrink-0" fill={primaryPath === img.storage_path ? "currentColor" : "none"} />
                      <span className="truncate">{primaryPath === img.storage_path ? t("form.images.primary") : t("form.images.setPrimary")}</span>
                    </button>
                    {images.length > 1 && <div className="flex shrink-0 gap-1">
                      <button type="button" disabled={i===0} onClick={() => moveImage(i,-1)} className="rounded bg-muted p-1 disabled:opacity-30" title={t("form.images.moveLeft")}><ChevronLeft className="h-4 w-4"/></button>
                      <button type="button" disabled={i===images.length-1} onClick={() => moveImage(i,1)} className="rounded bg-muted p-1 disabled:opacity-30" title={t("form.images.moveRight")}><ChevronRight className="h-4 w-4"/></button>
                    </div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground hover:bg-muted/50">
            <Upload className="h-4 w-4" />
            {t("form.images.add")}
            <input type="file" accept="image/*" multiple onChange={onFiles} className="hidden" />
          </label>
        </CardContent>
      </Card>

      {/* Basics */}
      <Card>
        <CardHeader><CardTitle>{t("form.section.basics")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label={t("form.brand")}><SuggestInput value={data.brand} onChange={(v) => update("brand", v)} suggestions={suggestions.brand} /></Field>
          <Field label={t("form.model")}><Input value={data.model} onChange={(e) => update("model", e.target.value)} /></Field>
          <Field label={t("form.referenceNumber")}><Input value={data.reference_number} onChange={(e) => update("reference_number", e.target.value)} /></Field>
          <Field label={t("form.serialNumber")}><Input value={data.serial_number} onChange={(e) => update("serial_number", e.target.value)} /></Field>
          <Field label={t("form.purchaseDate")}><Input type="date" value={data.purchase_date} onChange={(e) => update("purchase_date", e.target.value)} /></Field>
          <Field label={t("form.dealer")}><SuggestInput value={data.dealer} onChange={(v) => update("dealer", v)} suggestions={suggestions.dealer} /></Field>
        </CardContent>
      </Card>

      {/* Technical */}
      <Card>
        <CardHeader><CardTitle>{t("form.section.technical")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label={t("form.movementCaliber")}><SuggestInput value={data.movement_caliber} onChange={(v) => update("movement_caliber", v)} suggestions={suggestions.movement_caliber} /></Field>
          <Field label={t("form.movementManufacturer")}><SuggestInput value={data.movement_manufacturer} onChange={(v) => update("movement_manufacturer", v)} suggestions={suggestions.movement_manufacturer} /></Field>
          <Field label={t("form.movementType")}>
            <NativeSelect value={data.movement_type} onChange={(e) => update("movement_type", e.target.value)}>
              <option value="">{t("form.selectPlaceholder")}</option>
              {MOVEMENT_TYPES.map((m) => <option key={m} value={m}>{t(`form.movementType.${m}`)}</option>)}
            </NativeSelect>
          </Field>
          <Field label={t("form.caseMaterial")}>
            <NativeSelect value={data.case_material} onChange={(e) => update("case_material", e.target.value)}>
              <option value="">{t("form.selectPlaceholder")}</option>
              {CASE_MATERIALS.map((m) => <option key={m} value={m}>{t(`form.caseMaterial.${m}`)}</option>)}
            </NativeSelect>
          </Field>
          <Field label={t("form.caseFinish")}>
            <NativeSelect value={data.case_finish} onChange={(e) => update("case_finish", e.target.value)}>
              <option value="">{t("form.selectPlaceholder")}</option>
              {CASE_FINISHES.map((m) => <option key={m} value={m}>{t(`form.caseFinish.${m}`)}</option>)}
            </NativeSelect>
          </Field>
          <Field label={t("form.caseCoating")}>
            <NativeSelect value={data.case_coating} onChange={(e) => update("case_coating", e.target.value)}>
              <option value="">{t("form.none")}</option>
              {CASE_COATINGS.map((m) => <option key={m} value={m}>{t(`form.caseCoating.${m}`)}</option>)}
            </NativeSelect>
          </Field>
          <Field label={t("form.diameter")}><Input type="number" step="0.1" value={data.diameter_mm} onChange={(e) => update("diameter_mm", e.target.value)} /></Field>
          <Field label={t("form.lugToLug")}><Input type="number" step="0.1" value={data.lug_to_lug_mm} onChange={(e) => update("lug_to_lug_mm", e.target.value)} /></Field>
          <Field label={t("form.lugWidth")}><Input type="number" step="0.1" value={data.lug_width_mm} onChange={(e) => update("lug_width_mm", e.target.value)} /></Field>
          <Field label={t("form.waterResistance")}><Input type="number" value={data.water_resistance_m} onChange={(e) => update("water_resistance_m", e.target.value)} /></Field>
          <Field label={t("form.crystal")}>
            <NativeSelect value={data.crystal} onChange={(e) => update("crystal", e.target.value)}>
              <option value="">{t("form.selectPlaceholder")}</option>
              {CRYSTALS.map((c) => <option key={c} value={c}>{t(`form.crystal.${c}`)}</option>)}
            </NativeSelect>
          </Field>
          <Field label={t("form.braceletMaterial")}><Input value={data.bracelet_material} onChange={(e) => update("bracelet_material", e.target.value)} /></Field>
          <Field label={t("form.braceletType")}><Input value={data.bracelet_type} onChange={(e) => update("bracelet_type", e.target.value)} /></Field>
          <Field label={t("form.caseBack")}>
            <NativeSelect value={data.case_back === "geschraubt" ? "screwed" : data.case_back === "gepresst" ? "pressed" : data.case_back} onChange={(e) => update("case_back", e.target.value)}>
              <option value="">{t("form.selectPlaceholder")}</option>
              <option value="screwed">{t("form.caseBack.screwed")}</option>
              <option value="pressed">{t("form.caseBack.pressed")}</option>
            </NativeSelect>
          </Field>
          {data.movement_type === "quartz" && (
            <Field label={t("form.battery")}>
              <Input
                value={data.battery_type}
                onChange={(e) => update("battery_type", e.target.value)}
                placeholder={t("form.battery.placeholder")}
              />
            </Field>
          )}
          <div className="sm:col-span-2">
            <Label className="text-sm">{t("form.complications")}</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {COMPLICATIONS.map((c) => {
                const active = data.complications.includes(c);
                return (
                  <button
                    type="button"
                    key={c}
                    onClick={() => toggleComplication(c)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      active ? "border-accent bg-accent/15 text-foreground" : "border-border text-muted-foreground"
                    }`}
                  >
                    {t(`form.complication.${c}`)}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost */}
      <Card>
        <CardHeader>
          <CardTitle>{t("form.section.cost")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("form.msrp")}>
              <Input type="number" step="0.01" value={data.msrp} onChange={(e) => update("msrp", e.target.value)} />
            </Field>
            <Field label={t("form.purchasePrice")}>
              <Input
                type="number" step="0.01"
                value={data.final_price}
                onChange={(e) => update("final_price", e.target.value)}
              />
            </Field>
            <Field label={t("form.discount")}>
              <Input
                type="number"
                value={computed.calcDiscount ? computed.calcDiscount.toFixed(2) : ""}
                readOnly
                disabled
                placeholder="0.00"
              />
              {computed.calcDiscountPct !== null && computed.calcDiscount > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatCurrency(computed.calcDiscount, data.currency)} ({Number(computed.calcDiscountPct.toFixed(2)).toLocaleString(undefined, { maximumFractionDigits: 2 })} %)
                </p>
              )}
            </Field>
          </div>

          <div>
            <Label className="text-sm">{t("form.otherDiscounts")}</Label>
            <div className="mt-2 space-y-2">
              {discounts.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder={t("form.discount.labelPlaceholder")}
                    value={d.label}
                    onChange={(e) => {
                      const copy = [...discounts]; copy[i] = { ...d, label: e.target.value };
                      setDiscounts(copy);
                    }}
                  />
                  <Input
                    type="number" step="0.01" className="w-32"
                    placeholder={t("form.discount.amountPlaceholder")}
                    value={d.amount}
                    inputMode="decimal"
                    onChange={(e) => {
                      const copy = [...discounts]; copy[i] = { ...d, amount: e.target.value };
                      setDiscounts(copy);
                    }}
                  />
                  <Button type="button" variant="ghost" size="icon"
                    onClick={() => setDiscounts(discounts.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm"
                onClick={() => setDiscounts([...discounts, { label: "", amount: "" }])}>
                <Plus className="h-4 w-4" /> {t("form.discount.add")}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("form.currency")}>
              <NativeSelect value={data.currency} onChange={(e) => update("currency", e.target.value)}>{["EUR", "USD", "CHF", "GBP", "JPY"].map((c) => <option key={c} value={c}>{c}</option>)}</NativeSelect>
            </Field>
            <Field label={t("form.paymentMethod")}><Input value={data.payment_method} onChange={(e) => update("payment_method", e.target.value)} /></Field>
          </div>
          {computed.finalCalc !== null && computed.otherDiscounts > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("form.effectiveFinalPrice", { value: formatCurrency(computed.finalCalc, data.currency) })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Value */}
      <Card>
        <CardHeader><CardTitle>{t("form.section.value")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label={t("form.currentMarketValue")}><Input type="number" step="0.01" value={data.current_market_value} onChange={(e) => update("current_market_value", e.target.value)} /></Field>
          <Field label={t("form.marketValueDate")}><Input type="date" value={data.market_value_date} onChange={(e) => update("market_value_date", e.target.value)} /></Field>
          <Field label={t("form.insuranceValue")}><Input type="number" step="0.01" value={data.insurance_value} onChange={(e) => update("insurance_value", e.target.value)} /></Field>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader><CardTitle>{t("form.section.notes")}</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={5} value={data.notes} onChange={(e) => update("notes", e.target.value)} />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate({ to: "/watches" })}>{t("form.cancel")}</Button>
        <Button onClick={onSave} disabled={saving}>{saving ? t("form.saving") : t("form.save")}</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

// Suppress unused import warning for Checkbox
void Checkbox;
