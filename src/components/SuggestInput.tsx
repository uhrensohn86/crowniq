import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface SuggestInputProps {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
}

export function SuggestInput({ value, onChange, suggestions, placeholder }: SuggestInputProps) {
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    const uniq = Array.from(new Set(suggestions.filter(Boolean)));
    if (!q) return uniq.slice(0, 8);
    return uniq
      .filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q)
      .slice(0, 8);
  }, [value, suggestions]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setFocusedIdx(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || filtered.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setFocusedIdx((i) => Math.min(i + 1, filtered.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setFocusedIdx((i) => Math.max(i - 1, 0)); }
          else if (e.key === "Enter" && focusedIdx >= 0) {
            e.preventDefault();
            onChange(filtered[focusedIdx]);
            setOpen(false);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover shadow-md">
          {filtered.map((s, i) => (
            <button
              type="button"
              key={s}
              onMouseDown={(e) => { e.preventDefault(); onChange(s); setOpen(false); }}
              className={`block w-full px-3 py-1.5 text-left text-sm ${
                i === focusedIdx ? "bg-accent/20" : "hover:bg-muted"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
