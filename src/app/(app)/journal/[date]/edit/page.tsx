import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { routes } from "@/config/routes";
import { journalDayHref } from "@/features/calendar/logic";
import { CheckinWizard } from "@/features/checkin/components/checkin-wizard";
import { recordToDraft } from "@/features/checkin/display";
import { canBackfillCheckin, createEmptyDraft, getJourneyStartDate, getResumeStepIndex } from "@/features/checkin/logic";
import { parseJournalDateParam } from "@/features/journal/logic";
import { requireUser } from "@/lib/auth/session";
import { getUserToday } from "@/lib/dates";
import { getCheckinCatalogues, getCheckinForDate } from "@/lib/services/checkins";
import { getTrackedSubstances } from "@/lib/services/journey";
import { getCurrentProfile } from "@/lib/services/profiles";

export const metadata: Metadata = {
  title: "Ma journée",
};

/**
 * Check-in d'une journée passée (ADR-051, ADR-098) : même wizard que le check-in du jour ;
 * la date n'est jamais modifiable.
 * - check-in terminé → modification (ouvert au résumé) ;
 * - aucun check-in ou brouillon → création, possible de la date de début du parcours à hier
 *   (brouillon et sauvegarde automatique comme pour aujourd'hui).
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

  const mode = checkin?.completedAt ? "edit" : "create";
  if (mode === "create" && !canBackfillCheckin(date, today, getJourneyStartDate(substances))) notFound();

  const initialDraft = checkin ? recordToDraft(checkin) : createEmptyDraft();
  const initialStepIndex = mode === "edit" ? Number.MAX_SAFE_INTEGER : checkin ? getResumeStepIndex(initialDraft) : 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <CheckinWizard
        key={checkin?.id ?? `new-${date}`}
        checkinDate={date}
        mode={mode}
        initialDraft={initialDraft}
        initialStepIndex={initialStepIndex}
        catalogues={catalogues}
        substances={substances.map((substance) => ({ id: substance.id, name: substance.customName ?? substance.name }))}
        returnHref={journalDayHref(date)}
        isPastDay
      />
    </div>
  );
}
