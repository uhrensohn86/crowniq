import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { messages } from "./messages";
import { LANGS, LANG_LABELS, type Lang } from "./types";

export { LANGS, LANG_LABELS };
export type { Lang };

type TFunc = (key: string, params?: Record<string, string | number>) => string;
type I18nContextValue = { lang: Lang; setLang: (l: Lang) => void; t: TFunc };

const I18nContext = createContext<I18nContextValue | undefined>(undefined);
const STORAGE_KEY = "crowniq-lang";
const DEFAULT_LANG: Lang = "en";

function isLang(v: unknown): v is Lang {
  return typeof v === "string" && (LANGS as readonly string[]).includes(v);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isLang(stored)) {
        setLangState(stored);
        return;
      }
      const nav = window.navigator.language?.slice(0, 2);
      if (isLang(nav)) setLangState(nav);
    } catch {}
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nContextValue>(() => {
    const t: TFunc = (key, params) => {
      const raw = messages[lang]?.[key] ?? messages[DEFAULT_LANG]?.[key] ?? key;
      if (!params) return raw;
      return raw.replace(/\{(\w+)\}/g, (m, p) => (p in params ? String(params[p]) : m));
    };
    return { lang, setLang, t };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
