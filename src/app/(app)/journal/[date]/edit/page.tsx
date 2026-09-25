import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { routes } from "@/config/routes";
import { journalDayHref } from "@/features/calendar/logic";
import { CheckinWizard } from "@/features/checkin/components/checkin-wizard";
import { recordToDraft } from "@/features/checkin/display";
import { parseJournalDateParam } from "@/features/journal/logic";
import { requireUser } from "@/lib/auth/session";
import { getUserToday } from "@/lib/dates";
import { getCheckinCatalogues, getCheckinForDate } from "@/lib/services/checkins";
import { getTrackedSubstances } from "@/lib/services/journey";
import { getCurrentProfile } from "@/lib/services/profiles";

export const metadata: Metadata = {
  title: "Modifier une journée",
};

/**
 * Modification d'un check-in historique (ADR-051) : même wizard que le check-in du
 * jour, pré-rempli ; la date n'est jamais modifiable. Seul un check-in TERMINÉ peut
 * être modifié ici (pas de création rétroactive en V1).
 */
export default async function EditJournalDayPage({ params }: PageProps<"/journal/[date]/edit">) {
  const { date: rawDate } = await params;
  const user = await requireUser(routes.journal);
  const profile = await getCurrentProfile();
  const today = getUserToday(profile?.timezone);
  const date = parseJournalDateParam(rawDate, today);
  if (!date) notFound();
  // Aujourd'hui : le flux du jour (brouillon, reprise, retour à /today).
  if (date === today) redirect(routes.checkin);

  const [checkin, catalogues, substances] = await Promise.all([
    getCheckinForDate(user.id, date),
    getCheckinCatalogues(),
    getTrackedSubstances(user.id),
  ]);
  if (!checkin?.completedAt) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <CheckinWizard
        key={checkin.id}
        checkinDate={date}
        mode="edit"
        initialDraft={recordToDraft(checkin)}
        initialStepIndex={Number.MAX_SAFE_INTEGER}
        catalogues={catalogues}
        substances={substances.map((substance) => ({ id: substance.id, name: substance.customName ?? substance.name }))}
        returnHref={journalDayHref(date)}
      />
    </div>
  );
}
