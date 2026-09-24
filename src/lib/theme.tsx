import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "ivory" | "graphite" | "oled";
type ThemeContextValue = { theme: Theme; toggleTheme: () => void; setTheme: (t: Theme) => void };
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = "crowniq-theme";
const THEMES: Theme[] = ["ivory", "graphite", "oled"];

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "ivory";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (THEMES.includes(stored as Theme)) return stored as Theme;
  const legacy = window.localStorage.getItem("horologium-theme");
  if (legacy === "dark") return "graphite";
  if (legacy === "light") return "ivory";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "graphite" : "ivory";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("ivory");
  useEffect(() => setThemeState(getInitialTheme()), []);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "theme-graphite", "theme-oled");
    if (theme !== "ivory") root.classList.add("dark", `theme-${theme}`);
    try { window.localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }, [theme]);
  const setTheme = (t: Theme) => setThemeState(t);
  const toggleTheme = () => setThemeState((prev) => THEMES[(THEMES.indexOf(prev) + 1) % THEMES.length]);
  return <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
