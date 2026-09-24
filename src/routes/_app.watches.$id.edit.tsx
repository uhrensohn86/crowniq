import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { WatchForm } from "@/components/WatchForm";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/watches/$id/edit")({
  component: EditWatch,
});

function EditWatch() {
  const { id } = useParams({ from: "/_app/watches/$id/edit" });
  const { t } = useI18n();
  useEffect(() => {
    document.title = t("watches.edit.title");
  }, [t]);
  return <WatchForm watchId={id} />;
}
