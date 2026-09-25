import type { Metadata } from "next";

import { CheckinWizard } from "@/features/checkin/components/checkin-wizard";
import { recordToDraft } from "@/features/checkin/display";
import { createEmptyDraft, getResumeStepIndex } from "@/features/checkin/logic";
import { routes } from "@/config/routes";
import { requireUser } from "@/lib/auth/session";
import { getUserToday } from "@/lib/dates";
import { getCheckinCatalogues, getCheckinForDate } from "@/lib/services/checkins";
import { getTrackedSubstances } from "@/lib/services/journey";
import { getCurrentProfile } from "@/lib/services/profiles";

export const metadata: Metadata = {
  title: "Check-in du jour",
};

/**
 * Wizard du check-in du jour : nouveau, reprise d'un brouillon ou modification.
 * La journée est déterminée ici (fuseau du profil) puis figée pour tout le wizard.
 */
export default async function CheckinPage() {
  const user = await requireUser(routes.checkin);
  const profile = await getCurrentProfile();
  const checkinDate = getUserToday(profile?.timezone);

  const [catalogues, substances, existing] = await Promise.all([
    getCheckinCatalogues(),
    getTrackedSubstances(user.id),
    getCheckinForDate(user.id, checkinDate),
  ]);

  const mode = existing?.completedAt ? "edit" : "create";
  const initialDraft = existing ? recordToDraft(existing) : createEmptyDraft();
  // Reprise d'un brouillon à la bonne étape ; modification : depuis le résumé.
  const initialStepIndex = !existing ? 0 : mode === "edit" ? Number.MAX_SAFE_INTEGER : getResumeStepIndex(initialDraft);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <CheckinWizard
        key={existing?.id ?? "new"}
        checkinDate={checkinDate}
        mode={mode}
        initialDraft={initialDraft}
        initialStepIndex={initialStepIndex}
        catalogues={catalogues}
        substances={substances.map((substance) => ({
          id: substance.id,
          name: substance.customName ?? substance.name,
        }))}
      />
    </div>
  );
}
