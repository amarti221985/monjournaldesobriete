import { Info } from "lucide-react";

import { CRAVING_SAFETY_NOTE } from "@/features/craving/constants";

/** Information de sécurité discrète mais toujours accessible (aucune déduction à partir du score). */
export function SafetyNote() {
  return (
    <aside aria-label="Aide immédiate" className="flex gap-2.5 rounded-xl bg-muted/60 p-4 text-sm text-pretty text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{CRAVING_SAFETY_NOTE}</p>
    </aside>
  );
}
