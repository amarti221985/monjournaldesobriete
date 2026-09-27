"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Ouvre la boîte d'impression du navigateur (« Enregistrer en PDF », format Lettre ou A4). */
export function PrintButton() {
  return (
    <Button type="button" size="lg" onClick={() => window.print()}>
      <Printer data-icon="inline-start" aria-hidden="true" />
      Imprimer / Enregistrer en PDF
    </Button>
  );
}
