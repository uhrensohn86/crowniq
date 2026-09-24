import { useEffect, useState } from "react";
import { getImageUrl } from "@/lib/watch-utils";
import { Watch as WatchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignedImageProps {
  path: string | null | undefined;
  alt: string;
  className?: string;
}

export function SignedImage({ path, alt, className }: SignedImageProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    getImageUrl(path).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!url) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          className
        )}
      >
        <WatchIcon className="h-8 w-8 opacity-40" />
      </div>
    );
  }

  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
