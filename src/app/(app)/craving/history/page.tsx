import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { LoadError } from "@/components/shared/load-error";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { CRAVING_HISTORY_LIMIT } from "@/features/craving/constants";
import { CravingHistoryList } from "@/features/craving/components/craving-history-list";
import { requireUser } from "@/lib/auth/session";
import { getUserToday } from "@/lib/dates";
import { getCompletedCravingEvents, type CravingEventDetail } from "@/lib/services/craving";
import { getCurrentProfile } from "@/lib/services/profiles";

export const metadata: Metadata = {
  title: "Mes interventions",
};

/** Historique des moments terminés (100 plus récents, une requête). */
export default async function CravingHistoryPage() {
  const user = await requireUser(routes.cravingHistory);
  const profile = await getCurrentProfile();
  const today = getUserToday(profile?.timezone);

  let events: CravingEventDetail[];
  try {
    events = await getCompletedCravingEvents(user.id, CRAVING_HISTORY_LIMIT);
  } catch {
    return (
      <PageContainer size="narrow">
        <PageHeader title="Mes interventions" />
        <LoadError message="Nous n'avons pas pu charger tes interventions pour le moment." />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="narrow">
      <Button asChild variant="ghost" className="-ml-3 self-start">
        <Link href={routes.craving}>
          <ArrowLeft data-icon="inline-start" aria-hidden="true" />
          Prends un moment
        </Link>
      </Button>
      <PageHeader title="Mes interventions" description="Tes moments d'envie terminés, du plus récent au plus ancien." />
      {events.length > 0 ? (
        <CravingHistoryList events={events} today={today} timeZone={profile?.timezone ?? siteConfig.defaultTimeZone} />
      ) : (
        <p className="text-muted-foreground">Tes interventions terminées apparaîtront ici.</p>
      )}
      {events.length === CRAVING_HISTORY_LIMIT ? (
        <p className="text-sm text-muted-foreground">Seules tes {CRAVING_HISTORY_LIMIT} interventions les plus récentes sont affichées.</p>
      ) : null}
    </PageContainer>
  );
}
