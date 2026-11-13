import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { SignedImage } from "@/components/SignedImage";
import { useI18n } from "@/lib/i18n";

export function WatchGallery({ paths, title }: { paths: string[]; title: string }) {
  const { t } = useI18n();
  const [index, setIndex] = useState<number | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const images = [...new Set(paths.filter(Boolean))];
  const move = (step: number) =>
    setIndex((current) =>
      current === null ? null : (current + step + images.length) % images.length,
    );
  const open = (i: number, button: HTMLButtonElement) => {
    opener.current = button;
    setIndex(i);
  };
  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={!images.length}
        onClick={(e) => open(0, e.currentTarget)}
        className="watch-hero relative block aspect-square w-full overflow-hidden rounded-3xl border border-border bg-muted"
        aria-label={t("ui.openImage", { n: 1 })}
      >
        <SignedImage path={images[0]} alt={title} className="h-full w-full object-cover" />
        {!!images.length && (
          <span className="absolute right-4 top-4 rounded-full bg-black/65 px-3 py-1 text-xs text-white">
            1 / {images.length}
          </span>
        )}
      </button>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((path, i) => (
            <button
              key={path}
              type="button"
              onClick={(e) => open(i, e.currentTarget)}
              aria-label={t("ui.openImage", { n: i + 1 })}
              className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border"
            >
              <SignedImage path={path} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <Dialog.Root
        open={index !== null}
        onOpenChange={(open) => {
          if (!open) setIndex(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/95" />
          <Dialog.Content
            className="gallery-dialog fixed inset-0 z-[81] flex flex-col text-white outline-none"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              opener.current?.focus();
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") {
                event.preventDefault();
                move(1);
              }
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                move(-1);
              }
            }}
          >
            <div className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <Dialog.Title className="truncate text-lg">{title}</Dialog.Title>
                <Dialog.Description className="text-xs text-white/70">
                  {t("ui.galleryHint")}
                </Dialog.Description>
              </div>
              <Dialog.Close className="gallery-control" aria-label={t("ui.close")}>
                <X />
              </Dialog.Close>
            </div>
            <div
              className="relative flex min-h-0 flex-1 items-center justify-center"
              onTouchStart={(event) => {
                touch.current =
                  event.touches.length === 1
                    ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
                    : null;
              }}
              onTouchMove={(event) => {
                if (event.touches.length !== 1) touch.current = null;
              }}
              onTouchCancel={() => {
                touch.current = null;
              }}
              onTouchEnd={(event) => {
                const start = touch.current;
                touch.current = null;
                if (!start || !event.changedTouches.length || images.length < 2) return;
                const dx = event.changedTouches[0].clientX - start.x;
                const dy = event.changedTouches[0].clientY - start.y;
                if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
              }}
            >
              {index !== null && (
                <SignedImage
                  key={images[index]}
                  path={images[index]}
                  alt={`${title} · ${index + 1} / ${images.length}`}
                  className="max-h-full max-w-full object-contain"
                />
              )}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    className="gallery-control absolute left-2 sm:left-6"
                    onClick={() => move(-1)}
                    aria-label={t("ui.previous")}
                  >
                    <ChevronLeft />
                  </button>
                  <button
                    type="button"
                    className="gallery-control absolute right-2 sm:right-6"
                    onClick={() => move(1)}
                    aria-label={t("ui.next")}
                  >
                    <ChevronRight />
                  </button>
                </>
              )}
            </div>
            <p className="p-5 text-center text-sm tabular-nums" aria-live="polite">
              {index === null ? 0 : index + 1} / {images.length}
            </p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
