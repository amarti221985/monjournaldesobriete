import { ArrowLeft, NotebookPen, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { StatusMessage } from "@/components/shared/status-message";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { CheckinSummaryView } from "@/features/checkin/components/checkin-summary-view";
import { recordToDisplay } from "@/features/checkin/display";
import { requireUser } from "@/lib/auth/session";
import { formatWeekdayDate, getUserToday } from "@/lib/dates";
import { getCheckinForDate } from "@/lib/services/checkins";
import { getCurrentProfile } from "@/lib/services/profiles";

export const metadata: Metadata = {
  title: "Mon check-in",
};

/** Consultation du check-in terminé du jour (lecture seule). */
export default async function CheckinEntryPage() {
  const user = await requireUser(routes.checkinEntry);
  const profile = await getCurrentProfile();
  const today = getUserToday(profile?.timezone);
  const checkin = await getCheckinForDate(user.id, today);

  if (!checkin?.completedAt) {
    return (
      <PageContainer size="narrow">
        <StatusMessage
          icon={NotebookPen}
          title="Aucun check-in terminé aujourd'hui"
          description={checkin ? "Ton check-in est en cours. Tu peux reprendre là où tu étais." : "Prends quelques minutes pour faire le point sur ta journée."}
        >
          <Button asChild size="lg">
            <Link href={routes.checkin}>{checkin ? "Continuer mon check-in" : "Faire mon check-in"}</Link>
          </Button>
        </StatusMessage>
      </PageContainer>
    );
  }

  return (
    <PageContainer size="narrow">
      <Button asChild variant="ghost" className="-ml-3 self-start">
        <Link href={routes.today}>
          <ArrowLeft data-icon="inline-start" aria-hidden="true" />
          Aujourd&apos;hui
        </Link>
      </Button>
      <PageHeader
        title="Mon check-in"
        description={formatWeekdayDate(today)}
        actions={
          <Button asChild variant="outline">
            <Link href={routes.checkin}>
              <Pencil data-icon="inline-start" aria-hidden="true" />
              Modifier
            </Link>
          </Button>
        }
      />
      <div className="rounded-2xl border bg-card p-4 sm:p-6">
        <CheckinSummaryView checkin={recordToDisplay(checkin)} />
      </div>
    </PageContainer>
  );
}
