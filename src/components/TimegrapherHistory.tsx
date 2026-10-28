import { useCallback, useEffect, useState } from "react";
import { Activity, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Measurement = {
  id: string;
  watch_id: string;
  source: "crowniq" | "manual";
  recorded_at: string;
  rate_s_per_day: number | null;
  beat_error_ms: number | null;
  bph: number | null;
  amplitude_deg: number | null;
  lift_angle_deg: number | null;
  position: string | null;
  confidence_pct: number | null;
  quality: string | null;
  notes: string | null;
  duration_s: number | null;
  rate_spread_s_per_day: number | null;
  beat_spread_ms: number | null;
};

const POSITIONS = [
  "dial_up",
  "dial_down",
  "crown_up",
  "crown_down",
  "crown_left",
  "crown_right",
];
const LOCALES = { en: "en-US", de: "de-DE", fr: "fr-FR", es: "es-ES" } as const;

function localDateTime() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatRecordedAt(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

type ManualForm = {
  recordedAt: string;
  rate: string;
  beatError: string;
  bph: string;
  amplitude: string;
  liftAngle: string;
  position: string;
  notes: string;
};

const blankForm = (): ManualForm => ({
  recordedAt: localDateTime(),
  rate: "",
  beatError: "",
  bph: "",
  amplitude: "",
  liftAngle: "",
  position: "",
  notes: "",
});

export function TimegrapherHistory({ watchId }: { watchId: string }) {
  const { t, lang } = useI18n();
  const locale = LOCALES[lang];
  const [entries, setEntries] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [form, setForm] = useState<ManualForm>(blankForm);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from("watch_timegrapher_measurements")
      .select("*")
      .eq("watch_id", watchId)
      .order("recorded_at", { ascending: false })
      .execute();
    setEntries((data ?? []) as Measurement[]);
    setError(!!loadError);
    setLoading(false);
  }, [watchId]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  const update = (key: keyof ManualForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const numberOrNull = (value: string, min: number, max: number) => {
    if (!value.trim()) return null;
    const n = Number(value.trim().replace(",", "."));
    if (!Number.isFinite(n) || n < min || n > max)
      throw new Error(t("timegrapher.invalidNumber"));
    return n;
  };

  const saveManual = async () => {
    if (saving) return;
    let values: Record<string, number | null>;
    let recordedAt: string;
    try {
      values = {
        rate_s_per_day: numberOrNull(form.rate, -86400, 86400),
        beat_error_ms: numberOrNull(form.beatError, 0, 1000),
        bph: numberOrNull(form.bph, 1000, 50000),
        amplitude_deg: numberOrNull(form.amplitude, 0, 360),
        lift_angle_deg: numberOrNull(form.liftAngle, 0, 90),
      };
      if (values.bph !== null && !Number.isInteger(values.bph))
        throw new Error(t("timegrapher.invalidNumber"));
      if (
        ["rate_s_per_day", "beat_error_ms", "bph", "amplitude_deg"].every(
          (key) => values[key] === null,
        )
      ) {
        toast.error(t("timegrapher.oneValue"));
        return;
      }
      const date = new Date(form.recordedAt);
      if (!form.recordedAt || Number.isNaN(date.getTime()))
        throw new Error(t("timegrapher.invalidDate"));
      recordedAt = date.toISOString();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("timegrapher.saveError"));
      return;
    }
    setSaving(true);
    const { error: saveError } = await supabase
      .from("watch_timegrapher_measurements")
      .insert({
        watch_id: watchId,
        source: "manual",
        recorded_at: recordedAt,
        ...values,
        position: form.position || null,
        notes: form.notes.trim() || null,
        user_id: "local-user",
        confidence_pct: null,
        quality: null,
      })
      .execute();
    setSaving(false);
    if (saveError) {
      toast.error(t("timegrapher.saveError"));
      return;
    }
    toast.success(t("timegrapher.saved"));
    setManualOpen(false);
    setForm(blankForm());
    await reload();
  };

  const deleteEntry = async (entryId: string) => {
    const { error: deleteError } = await supabase
      .from("watch_timegrapher_measurements")
      .delete()
      .eq("id", entryId)
      .eq("watch_id", watchId)
      .execute();
    if (deleteError) toast.error(t("timegrapher.deleteError"));
    else {
      toast.success(t("timegrapher.deleted"));
      await reload();
    }
  };

  const showNumber = (
    value: number | null,
    digits: number,
    unit: string,
    plus = false,
  ) =>
    value === null || !Number.isFinite(value)
      ? "—"
      : `${plus && value > 0 ? "+" : ""}${value.toLocaleString(locale, { maximumFractionDigits: digits })} ${unit}`;

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-5 w-5" /> {t("timegrapher.title")}
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setForm(blankForm());
              setManualOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> {t("timegrapher.manual")}
          </Button>
          <Button size="sm" asChild>
            <a
              href={`/tools/timegrapher/index.html?watchId=${encodeURIComponent(watchId)}`}
            >
              <Activity className="h-4 w-4" /> {t("timegrapher.measure")}
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {t("timegrapher.experimental")}
        </p>
        {loading && (
          <p className="text-sm text-muted-foreground">
            {t("timegrapher.loading")}
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive">
            {t("timegrapher.loadError")}
          </p>
        )}
        {!loading && !error && entries.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {t("timegrapher.empty")}
          </p>
        )}
        {!loading &&
          !error &&
          entries.map((entry, index) => (
            <div
              key={entry.id}
              className={`rounded-lg border p-3 ${index === 0 ? "border-primary/40 bg-primary/5" : "border-border"}`}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {formatRecordedAt(entry.recorded_at, locale)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`timegrapher.source.${entry.source}`)}
                    {index === 0 && ` · ${t("timegrapher.latest")}`}
                    {entry.position &&
                      ` · ${t(`timegrapher.position.${entry.position}`)}`}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t("timegrapher.delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t("timegrapher.deleteTitle")}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("timegrapher.deleteDescription")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>
                        {t("timegrapher.cancel")}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => void deleteEntry(entry.id)}
                      >
                        {t("timegrapher.delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                <Value
                  label={t("timegrapher.rate")}
                  value={showNumber(entry.rate_s_per_day, 1, "s/Tag", true)}
                />
                <Value
                  label={t("timegrapher.beatError")}
                  value={showNumber(entry.beat_error_ms, 2, "ms")}
                />
                <Value
                  label={t("timegrapher.bph")}
                  value={showNumber(entry.bph, 0, "A/h")}
                />
                {entry.amplitude_deg !== null && (
                  <Value
                    label={t("timegrapher.amplitude")}
                    value={showNumber(entry.amplitude_deg, 1, "°")}
                  />
                )}
                {entry.lift_angle_deg !== null && (
                  <Value
                    label={t("timegrapher.liftAngle")}
                    value={showNumber(entry.lift_angle_deg, 1, "°")}
                  />
                )}
                {entry.confidence_pct !== null && (
                  <Value
                    label={t("timegrapher.confidence")}
                    value={showNumber(entry.confidence_pct, 0, "%")}
                  />
                )}
                {entry.duration_s !== null && (
                  <Value
                    label={t("timegrapher.duration")}
                    value={showNumber(entry.duration_s, 0, "s")}
                  />
                )}
                {entry.rate_spread_s_per_day !== null && (
                  <Value
                    label={t("timegrapher.rateSpread")}
                    value={showNumber(entry.rate_spread_s_per_day, 1, "s/Tag")}
                  />
                )}
                {entry.beat_spread_ms !== null && (
                  <Value
                    label={t("timegrapher.beatSpread")}
                    value={showNumber(entry.beat_spread_ms, 2, "ms")}
                  />
                )}
              </div>
              {entry.notes && (
                <p className="mt-3 whitespace-pre-wrap border-t pt-2 text-sm">
                  {entry.notes}
                </p>
              )}
            </div>
          ))}
      </CardContent>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("timegrapher.manualTitle")}</DialogTitle>
            <DialogDescription>{t("timegrapher.manualHint")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("timegrapher.date")} wide>
              <Input
                type="datetime-local"
                value={form.recordedAt}
                onChange={(e) => update("recordedAt", e.target.value)}
              />
            </Field>
            <Field label={t("timegrapher.rate")}>
              <Input
                inputMode="decimal"
                value={form.rate}
                onChange={(e) => update("rate", e.target.value)}
                placeholder="s/Tag"
              />
            </Field>
            <Field label={t("timegrapher.beatError")}>
              <Input
                inputMode="decimal"
                value={form.beatError}
                onChange={(e) => update("beatError", e.target.value)}
                placeholder="ms"
              />
            </Field>
            <Field label={t("timegrapher.bph")}>
              <Input
                inputMode="numeric"
                value={form.bph}
                onChange={(e) => update("bph", e.target.value)}
                placeholder="A/h"
              />
            </Field>
            <Field label={t("timegrapher.amplitude")}>
              <Input
                inputMode="decimal"
                value={form.amplitude}
                onChange={(e) => update("amplitude", e.target.value)}
                placeholder="°"
              />
            </Field>
            <Field label={t("timegrapher.liftAngle")}>
              <Input
                inputMode="decimal"
                value={form.liftAngle}
                onChange={(e) => update("liftAngle", e.target.value)}
                placeholder="°"
              />
            </Field>
            <Field label={t("timegrapher.position")}>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.position}
                onChange={(e) => update("position", e.target.value)}
              >
                <option value="">{t("timegrapher.position.unknown")}</option>
                {POSITIONS.map((position) => (
                  <option key={position} value={position}>
                    {t(`timegrapher.position.${position}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("timegrapher.notes")} wide>
              <Textarea
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                rows={3}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)}>
              {t("timegrapher.cancel")}
            </Button>
            <Button onClick={() => void saveManual()} disabled={saving}>
              {saving ? t("timegrapher.saving") : t("timegrapher.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono font-medium">{value}</p>
    </div>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`space-y-1 text-xs font-medium ${wide ? "col-span-2" : ""}`}
    >
      <span>{label}</span>
      {children}
    </label>
  );
}
