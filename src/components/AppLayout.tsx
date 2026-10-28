import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Watch, Settings, Plus, CalendarDays, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

export function AppLayout({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const nav = [
    { to: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { to: "/watches", label: t("nav.collection"), icon: Watch },
    { to: "/wear", label: t("nav.wear"), icon: CalendarDays },
    { to: "/settings", label: t("nav.settings"), icon: Settings },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <Watch className="h-6 w-6 text-accent" />
            <span className="font-display text-xl font-semibold">Crowniq</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link to="/watches/new">
                <Plus className="h-4 w-4" />
                {t("nav.newWatch")}
              </Link>
            </Button>
            <details className="group relative">
              <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" title="Werkzeuge" aria-label="Werkzeuge öffnen">
                <span aria-hidden="true" className="text-2xl leading-none">⋮</span>
              </summary>
              <div className="absolute right-0 top-full z-50 mt-2 min-w-44 rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-xl">
                <p className="px-3 py-1 text-xs font-semibold text-muted-foreground">Werkzeuge</p>
                <a href="/tools/timegrapher/index.html" className="block rounded-md px-3 py-2 text-sm hover:bg-secondary focus-visible:bg-secondary">Zeitwaage</a>
              </div>
            </details>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title={`Theme: ${theme}`}
            >
              {theme === "ivory" ? <Moon className="h-4 w-4" /> : theme === "graphite" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <nav className="md:hidden border-t border-border">
          <div className="mx-auto flex max-w-7xl px-4">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 py-3 text-sm border-b-2",
                    active
                      ? "border-accent text-foreground"
                      : "border-transparent text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden xs:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
