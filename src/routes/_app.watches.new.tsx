import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { WatchForm } from "@/components/WatchForm";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/watches/new")({
  component: NewWatch,
});

function NewWatch() {
  const { t } = useI18n();
  useEffect(() => {
    document.title = t("watches.new.title");
  }, [t]);
  return <WatchForm />;
}
