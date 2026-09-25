import { ArrowLeft, ChevronLeft, ChevronRight, NotebookPen, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { DayStatusBadge } from "@/components/shared/day-status-badge";
import { StatusMessage } from "@/components/shared/status-message";
import { Button } from "@/components/ui/button";
import { dayVisualStatusConfig } from "@/config/day-status";
import { routes } from "@/config/routes";
import { journalDayHref } from "@/features/calendar/logic";
import { CheckinSummaryView } from "@/features/checkin/components/checkin-summary-view";
import { statusOptions } from "@/features/checkin/constants";
import { recordToDisplay } from "@/features/checkin/display";
import { parseJournalDateParam } from "@/features/journal/logic";
import { requireUser } from "@/lib/auth/session";
import { formatLocalDate, formatWeekdayDate, getUserToday } from "@/lib/dates";
import { getCheckinForDate } from "@/lib/services/checkins";
import { getAdjacentCheckinDates } from "@/lib/services/journal";
import { getCurrentProfile } from "@/lib/services/profiles";

// La date n'apparaît pas dans le titre : l'historique du navigateur reste discret.
export const metadata: Metadata = {
  title: "Journée",
};

function BackLink() {
  return (
    <Button asChild variant="ghost" className="-ml-3 self-start">
      <Link href={routes.journal}>
        <ArrowLeft data-icon="inline-start" aria-hidden="true" />
        Journal
      </Link>
    </Button>
  );
}

/**
 * Détail d'une journée. [date] est validée strictement (YYYY-MM-DD, jamais future) ;
 * la lecture est limitée à l'utilisateur connecté (filtre user_id + RLS) : une date
 * sans check-in, ou appartenant à quelqu'un d'autre, affiche simplement « aucun check-in ».
 */
export default async function JournalDayPage({ params }: PageProps<"/journal/[date]">) {
  const { date: rawDate } = await params;
  const user = await requireUser(routes.journal);
  const profile = await getCurrentProfile();
  const today = getUserToday(profile?.timezone);
  const date = parseJournalDateParam(rawDate, today);
  if (!date) notFound();

  const [checkin, adjacent] = await Promise.all([
    getCheckinForDate(user.id, date),
    getAdjacentCheckinDates(user.id, date),
  ]);

  if (!checkin?.completedAt) {
    const isTodayDraft = date === today && checkin !== null;
    return (
      <PageContainer size="narrow">
        <BackLink />
        <StatusMessage
          icon={NotebookPen}
          title={formatWeekdayDate(date)}
          description={isTodayDraft ? "Ton check-in est en cours." : "Aucun check-in enregistré pour cette journée."}
        >
          {date === today ? (
            <Button asChild size="lg">
              <Link href={routes.checkin}>{isTodayDraft ? "Continuer mon check-in" : "Faire mon check-in"}</Link>
            </Button>
          ) : null}
        </StatusMessage>
      </PageContainer>
    );
  }

  const visualStatus = statusOptions[checkin.status].visualStatus;
  const editHref = date === today ? routes.checkin : `${journalDayHref(date)}/edit`;

  return (
    <PageContainer size="narrow">
      <BackLink />

      <header className="grid gap-3">
        <h1 className="text-2xl font-semibold tracking-tight first-letter:uppercase sm:text-3xl">
          {formatWeekdayDate(date)}
        </h1>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DayStatusBadge status={visualStatus} label={dayVisualStatusConfig[visualStatus].label} />
          <Button asChild variant="outline">
            <Link href={editHref}>
              <Pencil data-icon="inline-start" aria-hidden="true" />
              Modifier cette journée
            </Link>
          </Button>
        </div>
      </header>

      <div className="rounded-2xl border bg-card p-4 sm:p-6">
        <CheckinSummaryView checkin={recordToDisplay(checkin)} hideEmpty />
      </div>

      <nav aria-label="Journées enregistrées" className="flex items-center justify-between gap-3">
        {adjacent.previous ? (
          <Button asChild variant="ghost">
            <Link href={journalDayHref(adjacent.previous)}>
              <ChevronLeft data-icon="inline-start" aria-hidden="true" />
              <span className="sr-only">Journée enregistrée précédente : </span>
              {formatLocalDate(adjacent.previous, { day: "numeric", month: "short" })}
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {adjacent.next ? (
          <Button asChild variant="ghost">
            <Link href={journalDayHref(adjacent.next)}>
              <span className="sr-only">Journée enregistrée suivante : </span>
              {formatLocalDate(adjacent.next, { day: "numeric", month: "short" })}
              <ChevronRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <span />
        )}
      </nav>
    </PageContainer>
  );
}
