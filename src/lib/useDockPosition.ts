import { useEffect, type RefObject } from "react";

export function dockTop(viewportHeight: number, offsetTop: number, dockHeight: number, gap = 12) {
  return Math.max(offsetTop, offsetTop + viewportHeight - dockHeight - gap);
}

export function useDockPosition(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const dock = ref.current;
    if (!dock) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // top coordinates use the layout viewport; VisualViewport supplies the visible bounds.
        const height = dock.getBoundingClientRect().height;
        if (!height) return;
        const top = dockTop(
          viewport?.height ?? window.innerHeight,
          viewport?.offsetTop ?? 0,
          height,
        );
        dock.style.setProperty("--dock-top", `${top}px`);
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(dock);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      dock.style.removeProperty("--dock-top");
    };
  }, [ref]);
}
