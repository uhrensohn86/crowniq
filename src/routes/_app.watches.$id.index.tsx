import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignedImage } from "@/components/SignedImage";
import { TimegrapherHistory } from "@/components/TimegrapherHistory";
import { formatCurrency, getImageUrl } from "@/lib/watch-utils";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Database } from "@/integrations/supabase/types";

type Watch = Database["public"]["Tables"]["watches"]["Row"];
type Discount = Database["public"]["Tables"]["watch_purchase_discounts"]["Row"];
type Image = Database["public"]["Tables"]["watch_images"]["Row"];

export const Route = createFileRoute("/_app/watches/$id/")({
  component: WatchDetail,
});

const LOCALES = { en: "en-US", de: "de-DE", fr: "fr-FR", es: "es-ES" } as const;

function WatchDetail() {
  const { id } = useParams({ from: "/_app/watches/$id/" });
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const locale = LOCALES[lang];
  const [watch, setWatch] = useState<Watch | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [lightbox, setLightbox] = useState<{ url: string; idx: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [w, d, i] = await Promise.all([
        supabase.from("watches").select("*").eq("id", id).single(),
        supabase.from("watch_purchase_discounts").select("*").eq("watch_id", id),
        supabase.from("watch_images").select("*").eq("watch_id", id).order("sort_order"),
      ]);
      setWatch(w.data);
      setDiscounts(d.data ?? []);
      setImages(i.data ?? []);
      setLoading(false);
    })();
  }, [id]);

  const onDelete = async () => {
    // Remove storage files
    if (images.length > 0) {
      await supabase.storage.from("watch-images").remove(images.map((i) => i.storage_path));
    }
    const { error } = await supabase.from("watches").delete().eq("id", id);
    if (error) {
      toast.error(t("watches.deleteFailed"));
      return;
    }
    toast.success(t("watches.deleted"));
    navigate({ to: "/watches" });
  };

  const openLightbox = async (idx: number) => {
    const url = await getImageUrl(images[idx].storage_path);
    if (url) setLightbox({ url, idx });
  };

  if (loading) return <p className="text-muted-foreground">{t("watches.loading")}</p>;
  if (!watch) return <p className="text-muted-foreground">{t("watches.notFound")}</p>;

  const primaryImageIndex = Math.max(0, images.findIndex((img) => img.storage_path === watch.primary_image_path));
  const otherDiscounts = discounts.reduce((s, d) => s + Number(d.amount), 0);
  const regularDiscount = Number(watch.discount_amount ?? 0);
  const totalDiscounts = regularDiscount + otherDiscounts;
  const effectivePrice = watch.final_price === null ? null : Math.max(0, Number(watch.final_price) - otherDiscounts);
  const discountPercent = watch.discount_percent === null ? null : Number(watch.discount_percent);
  const savingsPct = watch.msrp && totalDiscounts > 0 ? (totalDiscounts / Number(watch.msrp)) * 100 : null;
  const formatDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat(locale).format(new Date(`${value}T00:00:00`)) : "—";
  const enumLabel = (prefix: string, value: string | null | undefined) => {
    if (!value) return "—";
    const legacy: Record<string,string> = { geschraubt: "screwed", gepresst: "pressed" };
    const key = legacy[value] ?? value;
    return t(`${prefix}.${key}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" asChild>
          <Link to="/watches"><ArrowLeft className="h-4 w-4" /> {t("watches.backToCollection")}</Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/watches/$id/edit" params={{ id }}><Pencil className="h-4 w-4" /> {t("watches.edit")}</Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive"><Trash2 className="h-4 w-4" /> {t("watches.delete")}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("watches.deleteConfirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("watches.deleteConfirmDescription")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("watches.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>{t("watches.delete")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => images.length > 0 && openLightbox(primaryImageIndex)}
            className="block w-full overflow-hidden rounded-lg border border-border bg-muted aspect-square"
          >
            <SignedImage
              path={watch.primary_image_path ?? images[0]?.storage_path ?? null}
              alt={`${watch.brand} ${watch.model}`}
              className="h-full w-full object-cover"
            />
          </button>
          {images.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => openLightbox(i)}
                  className="aspect-square overflow-hidden rounded border border-border"
                >
                  <SignedImage path={img.storage_path} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-sm uppercase tracking-wide text-muted-foreground">{watch.brand}</div>
            <h1 className="font-display text-4xl font-semibold leading-tight">{watch.model}</h1>
            {watch.reference_number && (
              <div className="mt-1 font-mono text-sm text-muted-foreground">{t("watches.reference", { ref: watch.reference_number })}</div>
            )}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">{t("watches.section.acquisition")}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("watches.field.effectivePrice")}</div>
                  <div className="font-display text-3xl font-semibold">{formatCurrency(effectivePrice, watch.currency ?? "EUR", locale)}</div>
                </div>
                {watch.msrp !== null && <div className="text-right"><div className="text-xs text-muted-foreground">{t("watches.field.msrp")}</div><div className="font-mono">{formatCurrency(watch.msrp, watch.currency ?? "EUR", locale)}</div></div>}
              </div>
              {totalDiscounts > 0 && <div className="rounded-md bg-accent/10 px-3 py-2 flex justify-between gap-3"><span>{t("watches.field.totalDiscounts")}</span><strong>{formatCurrency(totalDiscounts, watch.currency ?? "EUR", locale)}{savingsPct !== null ? ` · ${savingsPct.toLocaleString(locale,{maximumFractionDigits:2})} %` : ""}</strong></div>}
              <div className="border-t border-border pt-2 space-y-1">
                <Row label={t("watches.field.purchasePrice")} value={formatCurrency(watch.final_price, watch.currency ?? "EUR", locale)} />
                {watch.discount_amount !== null && <Row label={watch.discount_percent ? t("watches.field.discountWithPercent", { percent: discountPercent?.toLocaleString(locale,{maximumFractionDigits:2}) }) : t("watches.field.discount")} value={`− ${formatCurrency(watch.discount_amount, watch.currency ?? "EUR", locale)}`} />}
                {discounts.map((d) => <Row key={d.id} label={d.label} value={`− ${formatCurrency(Number(d.amount), watch.currency ?? "EUR", locale)}`} />)}
              </div>
              <div className="border-t border-border pt-2 space-y-1">
                {watch.payment_method && <Row label={t("watches.field.paymentMethod")} value={watch.payment_method} />}
                {watch.dealer && <Row label={t("watches.field.dealer")} value={watch.dealer} />}
                {watch.purchase_date && <Row label={t("watches.field.purchaseDate")} value={formatDate(watch.purchase_date)} />}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">{t("watches.section.value")}</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label={t("watches.field.currentMarketValue")} value={formatCurrency(watch.current_market_value, watch.currency ?? "EUR", locale)} />
              <Row label={t("watches.field.asOf")} value={formatDate(watch.market_value_date)} />
              <Row label={t("watches.field.insuranceValue")} value={formatCurrency(watch.insurance_value, watch.currency ?? "EUR", locale)} />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("watches.section.technicalData")}</CardTitle></CardHeader>
        <CardContent className="grid gap-1 text-sm sm:grid-cols-2">
          <Row label={t("watches.field.movementType")} value={enumLabel("form.movementType", watch.movement_type)} />
          <Row label={t("watches.field.caliber")} value={watch.movement_caliber ?? "—"} />
          <Row label={t("watches.field.movementManufacturer")} value={watch.movement_manufacturer ?? "—"} />
          {watch.movement_type === "quartz" && (
            <Row label={t("watches.field.battery")} value={(watch as { battery_type?: string | null }).battery_type ?? "—"} />
          )}
          <Row label={t("watches.field.caseBack")} value={enumLabel("form.caseBack", (watch as { case_back?: string | null }).case_back)} />
          <Row label={t("watches.field.caseMaterial")} value={enumLabel("form.caseMaterial", watch.case_material)} />
          {(watch as any).case_finish && <Row label={t("form.caseFinish")} value={enumLabel("form.caseFinish", (watch as any).case_finish)} />}
          {(watch as any).case_coating && <Row label={t("form.caseCoating")} value={enumLabel("form.caseCoating", (watch as any).case_coating)} />}
          <Row label={t("watches.field.diameter")} value={watch.diameter_mm ? `${watch.diameter_mm} mm` : "—"} />
          <Row label={t("watches.field.lugToLug")} value={watch.lug_to_lug_mm ? `${watch.lug_to_lug_mm} mm` : "—"} />
          <Row label={t("watches.field.lugWidth")} value={watch.lug_width_mm ? `${watch.lug_width_mm} mm` : "—"} />
          <Row label={t("watches.field.waterResistance")} value={watch.water_resistance_m ? `${watch.water_resistance_m} m` : "—"} />
          <Row label={t("watches.field.crystal")} value={enumLabel("form.crystal", watch.crystal)} />
          <Row label={t("watches.field.bracelet")} value={[watch.bracelet_material, watch.bracelet_type].filter(Boolean).join(" / ") || "—"} />
          <Row label={t("watches.field.serialNumber")} value={watch.serial_number ?? "—"} />
          {watch.complications && watch.complications.length > 0 && (
            <div className="sm:col-span-2 mt-2">
              <span className="text-muted-foreground">{t("watches.field.complications")}: </span>
              <span>{watch.complications.map((c) => t(`form.complication.${c}`)).join(", ")}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <TimegrapherHistory watchId={id} />

      {watch.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("watches.section.notes")}</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{watch.notes}</CardContent>
        </Card>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4" onClick={() => setLightbox(null)}>
          <button className="absolute right-4 top-4 rounded-full bg-card p-2" onClick={() => setLightbox(null)}>
            <X className="h-5 w-5" />
          </button>
          <img src={lightbox.url} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-mono font-semibold" : "font-mono"}>{value}</span>
    </div>
  );
}
