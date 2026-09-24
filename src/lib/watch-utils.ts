import { supabase } from "@/integrations/supabase/client";

export const MOVEMENT_TYPES = ["automatic", "quartz", "manual", "spring-drive", "kinetic"] as const;
export const CRYSTALS = ["sapphire", "mineral", "acrylic", "hardlex"] as const;
export const COMPLICATIONS = [
  "date", "day-date", "chronograph", "gmt", "moonphase",
  "perpetual-calendar", "tourbillon", "power-reserve", "world-time", "alarm",
  "verschraubte-krone", "luenette-unidirektional", "luenette-bidirektional",
] as const;
export const CASE_MATERIALS = [
  "stainless-steel", "gold-yellow", "gold-rose", "gold-white",
  "platinum", "titanium", "ceramic", "bronze", "brass", "aluminium", "carbon", "resin",
] as const;
export const CASE_FINISHES = ["brushed", "polished", "bead-blasted", "mixed"] as const;
export const CASE_COATINGS = ["pvd", "dlc", "ip"] as const;

export function formatCurrency(value: number | null | undefined, currency = "EUR", locale = "de-DE") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const urlCache = new Map<string, { url: string; expiresAt: number }>();

export async function getImageUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const cached = urlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data } = await supabase.storage
    .from("watch-images")
    .createSignedUrl(path, 60 * 60);
  if (!data?.signedUrl) return null;
  urlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}
