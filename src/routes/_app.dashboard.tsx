import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useLocalUser } from "@/lib/local-user";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/watch-utils";
import { Watch as WatchIcon, TrendingUp, TrendingDown, Wallet, ShieldCheck } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

interface WatchRow {
  id: string;
  brand: string;
  model: string;
  final_price: number | null;
  current_market_value: number | null;
  insurance_value: number | null;
  movement_type: string | null;
  case_material: string | null;
  primary_image_path: string | null;
  effective_price?: number | null;
}

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Dashboard() {
  const user = useLocalUser();
  const { t } = useI18n();
  const [watches, setWatches] = useState<WatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleStats, setVisibleStats] = useState<Record<string, boolean>>({ watches:true, cost:true, market:true, insurance:true });
  useEffect(() => {
    try { const raw=localStorage.getItem("crowniq-dashboard-stats"); if(raw) setVisibleStats((v)=>({...v,...JSON.parse(raw)})); } catch {}
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("watches").select("id,brand,model,final_price,current_market_value,insurance_value,movement_type,case_material,primary_image_path"),
      supabase.from("watch_purchase_discounts").select("watch_id,amount"),
    ]).then(([watchResult, discountResult]) => {
      const discountTotals = (discountResult.data ?? []).reduce<Record<string, number>>((acc, d: any) => {
        acc[d.watch_id] = (acc[d.watch_id] ?? 0) + Number(d.amount ?? 0);
        return acc;
      }, {});
      setWatches(((watchResult.data ?? []) as WatchRow[]).map((w) => ({
        ...w,
        effective_price: w.final_price == null ? null : Math.max(0, Number(w.final_price) - (discountTotals[w.id] ?? 0)),
      })));
      setLoading(false);
    });
  }, [user]);

  const total = watches.length;
  const totalCost = watches.reduce((s, w) => s + (w.effective_price ?? 0), 0);
  const valuedWatches = watches.filter((w) => w.current_market_value !== null);
  const totalMarket = valuedWatches.reduce((s, w) => s + Number(w.current_market_value), 0);
  const totalInsurance = watches.reduce((s, w) => s + (w.insurance_value ?? 0), 0);
  const valuedCost = valuedWatches.reduce((s,w)=>s+(w.effective_price ?? 0),0);
  const valueDelta = totalMarket - valuedCost;
  const valueDeltaPct = valuedCost > 0 ? (valueDelta / valuedCost) * 100 : 0;

  const byBrand = Object.entries(
    watches.reduce<Record<string, number>>((acc, w) => {
      acc[w.brand] = (acc[w.brand] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const byMovement = Object.entries(
    watches.reduce<Record<string, number>>((acc, w) => {
      const key = w.movement_type ? t(`form.movementType.${w.movement_type}`) : t("dashboard.movement.unknown");
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const top5 = [...watches]
    .filter((w) => w.effective_price !== null && w.effective_price !== undefined)
    .map((w) => ({ ...w, _value: Number(w.effective_price) }))
    .filter((w) => w._value > 0)
    .sort((a, b) => b._value - a._value)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {visibleStats.watches && <StatCard icon={WatchIcon} label={t("dashboard.stat.watches")} value={total.toString()} />}
        {visibleStats.cost && <StatCard icon={Wallet} label={t("dashboard.stat.acquisitionCost")} value={formatCurrency(totalCost)} />}
        {visibleStats.market && <StatCard
          icon={valueDelta >= 0 ? TrendingUp : TrendingDown}
          label={t("dashboard.stat.marketValue")}
          value={valuedWatches.length ? formatCurrency(totalMarket) : "—"}
          sub={valuedWatches.length ? `${valuedWatches.length} / ${total} ${t("dashboard.stat.valued")}${valuedCost > 0 ? ` · ${valueDelta >= 0 ? "+" : ""}${formatCurrency(valueDelta)} (${valueDeltaPct.toFixed(1)}%)` : ""}` : `0 / ${total} ${t("dashboard.stat.valued")}`}
          subPositive={valueDelta >= 0}
        />}
        {visibleStats.insurance && <StatCard icon={ShieldCheck} label={t("dashboard.stat.insuranceValue")} value={formatCurrency(totalInsurance)} />}
      </div>

      {loading ? null : total === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("dashboard.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.chart.byBrand")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={byBrand} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50} paddingAngle={2}>
                    {byBrand.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {byBrand.map((b, i) => (
                  <span key={b.name} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    {b.name} ({b.value})
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.chart.byMovement")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byMovement}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t("dashboard.top5.title")}</CardTitle>
              <CardDescription>{t("dashboard.top5.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {top5.map((w, i) => (
                  <div key={w.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-display text-2xl text-muted-foreground w-6">{i + 1}</span>
                      <div>
                        <div className="font-medium">{w.brand}</div>
                        <div className="text-sm text-muted-foreground">{w.model}</div>
                      </div>
                    </div>
                    <div className="font-mono text-sm">{formatCurrency(w._value)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, sub, subPositive,
}: {
  icon: typeof WatchIcon;
  label: string;
  value: string;
  sub?: string;
  subPositive?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
            {sub && (
              <p className={`mt-1 text-xs ${subPositive ? "text-emerald-600" : "text-destructive"}`}>{sub}</p>
            )}
          </div>
          <Icon className="h-5 w-5 text-accent" />
        </div>
      </CardContent>
    </Card>
  );
}
