import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/_app/timegrapher")({
  validateSearch: (search: Record<string, unknown>): { watchId?: string } => ({
    watchId: typeof search.watchId === "string" ? search.watchId : undefined,
  }),
  component: Timegrapher,
});

function Timegrapher() {
  const { watchId } = Route.useSearch();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const frame = useRef<HTMLIFrameElement>(null);
  const cleanup = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);

  function syncTheme() {
    const root = frame.current?.contentDocument?.documentElement;
    if (!root) return;
    root.dataset.theme = theme;
    const colors = getComputedStyle(document.documentElement);
    for (const [target, source] of Object.entries({
      bg: "background",
      surface: "card",
      text: "foreground",
      sub: "muted-foreground",
      stroke: "border",
      accent: "accent",
    }))
      root.style.setProperty(`--${target}`, colors.getPropertyValue(`--${source}`));
  }

  useEffect(() => {
    const id = requestAnimationFrame(syncTheme);
    return () => cancelAnimationFrame(id);
  }, [theme]);
  useLayoutEffect(() => () => cleanup.current(), []);

  function loaded() {
    cleanup.current();
    const element = frame.current;
    const doc = element?.contentDocument;
    const win = element?.contentWindow;
    const layout = doc?.querySelector<HTMLElement>(".layout");
    if (!element || !doc || !win || !layout) return;
    syncTheme();
    const resize = () => {
      element.style.height = `${Math.ceil(layout.getBoundingClientRect().height) + 2}px`;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(layout);
    resize();
    const follow = (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
        return;
      const anchor = (event.target as Element)?.closest?.("a");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href);
      if (
        url.origin !== window.location.origin ||
        !/^\/(dashboard|watches|wear|settings)(\/|$)/.test(url.pathname)
      )
        return;
      event.preventDefault();
      void navigate({ to: url.pathname });
    };
    doc.addEventListener("click", follow);
    cleanup.current = () => {
      observer.disconnect();
      doc.removeEventListener("click", follow);
      // Explicitly stop audio before React removes the embedded document.
      win.dispatchEvent(new Event("pagehide"));
    };
    setReady(true);
  }

  return (
    <>
      {!ready && <p role="status">Zeitwaage wird geladen …</p>}
      <iframe
        key={watchId || "default"}
        ref={frame}
        title="Crowniq Zeitwaage"
        src={`/tools/timegrapher/index.html?embedded=1${watchId ? `&watchId=${encodeURIComponent(watchId)}` : ""}`}
        allow="microphone"
        onLoad={loaded}
        style={{
          width: "100%",
          minHeight: 400,
          border: 0,
          display: "block",
          visibility: ready ? "visible" : "hidden",
        }}
      />
    </>
  );
}
