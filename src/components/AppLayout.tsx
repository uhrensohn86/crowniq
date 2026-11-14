import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Watch,
  Settings,
  Plus,
  CalendarDays,
  Moon,
  Sun,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

export function AppLayout({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = [
    { to: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { to: "/watches", label: t("ui.watches"), icon: Watch },
    { to: "/wear", label: t("ui.wear"), icon: CalendarDays },
    { to: "/timegrapher", label: t("ui.timegrapher"), icon: Activity },
    { to: "/settings", label: t("nav.settings"), icon: Settings },
  ];
  function links(mobile: boolean) {
    return nav.map(({ to, label, icon: Icon }) => {
      const active = pathname.startsWith(to);
      const props = {
        className: cn(mobile ? "dock-link" : "desktop-link", active && "is-active"),
        "aria-current": active ? ("page" as const) : undefined,
      };
      const content = (
        <>
          <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
          <span>{label}</span>
        </>
      );
      return (
        <Link key={to} to={to} {...props}>
          {content}
        </Link>
      );
    });
  }
  return (
    <div className="app-shell min-h-screen bg-background">
      <header className="app-header">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link to="/dashboard" className="flex items-center gap-3" aria-label="Crowniq">
            <Watch className="h-8 w-8 text-accent" aria-hidden="true" />
            <span className="font-display text-3xl font-semibold">Crowniq</span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex" aria-label={t("ui.navigation")}>
            {links(false)}
          </nav>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon" aria-label={t("nav.newWatch")}>
              <Link to="/watches/new">
                <Plus className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={t("ui.theme")}
              title={t("ui.theme")}
            >
              {theme === "ivory" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>
      <main className="app-main mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">{children}</main>
      <nav className="floating-dock lg:hidden" aria-label={t("ui.navigation")}>
        {links(true)}
      </nav>
    </div>
  );
}
