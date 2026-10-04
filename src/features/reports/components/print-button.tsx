"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { recordPdfReportLaunchAction } from "@/features/reports/actions";

/** Ouvre la boîte d'impression du navigateur (« Enregistrer en PDF », format Lettre ou A4). */
export function PrintButton() {
  return (
    <Button
      type="button"
      size="lg"
      onClick={() => {
        // Mesure sans contenu, jamais bloquante pour l'impression.
        void recordPdfReportLaunchAction().catch(() => undefined);
        window.print();
      }}
    >
      <Printer data-icon="inline-start" aria-hidden="true" />
      Imprimer / Enregistrer en PDF
    </Button>
  );
}
