export const LANGS = ["en", "de", "fr", "es"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_LABELS: Record<Lang, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
};

export type Dict = Record<string, string>;
export type NamespaceDict = Record<Lang, Dict>;
