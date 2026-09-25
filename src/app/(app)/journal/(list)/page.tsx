import { PencilLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { LoadError } from "@/components/shared/load-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { JournalBrowser } from "@/features/journal/components/journal-browser";
import { parseJournalFilters, toSearchJournalParams } from "@/features/journal/logic";
import { requireUser } from "@/lib/auth/session";
import { getUserToday } from "@/lib/dates";
import { getCalendarEntries } from "@/lib/services/calendar";
import { getJournalPage, type JournalPage } from "@/lib/services/journal";
import { getCurrentProfile } from "@/lib/services/profiles";

export const metadata: Metadata = {
  title: "Journal",
};

/**
 * Journal : check-ins terminés, du plus récent au plus ancien, 20 par page.
 * Première page rendue côté serveur (filtres de l'URL) ; recherche et pages
 * suivantes via Server Action. Les journées manquantes n'y figurent pas (ADR-048).
 */
export default async function JournalPage({ searchParams }: PageProps<"/journal">) {
  const user = await requireUser(routes.journal);
  const profile = await getCurrentProfile();
  const today = getUserToday(profile?.timezone);
  const filters = parseJournalFilters(await searchParams);

  let page: JournalPage;
  let hasTodayDraft = false;
  try {
    const [firstPage, todayEntries] = await Promise.all([
      getJournalPage(toSearchJournalParams({ ...filters }, today)),
      getCalendarEntries(user.id, today, today),
    ]);
    page = firstPage;
    hasTodayDraft = todayEntries.some((entry) => !entry.completed);
  } catch {
    return (
      <PageContainer size="narrow">
        <PageHeader title="Journal" />
        <LoadError message="Impossible de charger ton journal pour le moment." />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="narrow">
      <PageHeader
        title="Journal"
        description="Retrouve tes journées, tes réflexions et les moments importants de ton parcours."
      />

      {hasTodayDraft ? (
        <Card>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 font-medium">
              <PencilLine className="size-5 shrink-0 text-primary" aria-hidden="true" />
              Check-in en cours
            </p>
            <Button asChild>
              <Link href={routes.checkin}>Continuer</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <JournalBrowser initialFilters={filters} initialPage={page} />
    </PageContainer>
  );
}
