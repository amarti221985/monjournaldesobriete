import { CalendarHeart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { LoadError } from "@/components/shared/load-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { CalendarLegend } from "@/features/calendar/components/calendar-legend";
import { CalendarToolbar } from "@/features/calendar/components/calendar-toolbar";
import { MonthCalendar } from "@/features/calendar/components/month-calendar";
import { YearCalendar } from "@/features/calendar/components/year-calendar";
import {
  buildMonthGrid,
  buildYear,
  calendarMonthHref,
  calendarYearHref,
  getMonthNavigation,
  parseCalendarParams,
  type CalendarEntry,
  type PeriodSummary,
} from "@/features/calendar/logic";
import { formatPercent, pluralize } from "@/features/progress/format";
import { requireUser } from "@/lib/auth/session";
import { formatMonthYear, getMonthKey, getMonthRange, getUserToday } from "@/lib/dates";
import { getCalendarEntries, hasAnyCompletedCheckin } from "@/lib/services/calendar";
import { getTrackedSubstances } from "@/lib/services/journey";
import { getCurrentProfile } from "@/lib/services/profiles";

export const metadata: Metadata = {
  title: "Calendrier",
};

function YearSummary({ year, summary }: { year: number; summary: PeriodSummary }) {
  return (
    <section aria-labelledby="year-summary-title" className="grid gap-3">
      <h2 id="year-summary-title" className="sr-only">
        Résumé {year}
      </h2>
      <dl className="grid grid-cols-3 gap-2">
        {[
          ["Jours suivis", summary.trackedDays],
          ["Jours sobres", summary.soberDays],
          ["Jours avec consommation", summary.consumedDays],
        ].map(([label, value]) => (
          <div key={label} className="grid gap-0.5 rounded-xl bg-muted/60 p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        {summary.trackedDays > 0 && summary.sobrietyRate !== null
          ? `En ${year}, ${formatPercent(summary.sobrietyRate)} de tes journées enregistrées sont sobres · ${summary.untrackedDays} ${pluralize(summary.untrackedDays, "journée non documentée", "journées non documentées")}.`
          : `Aucune journée enregistrée en ${year}.`}
      </p>
    </section>
  );
}

/**
 * Calendrier : vue mois (défaut) ou année. Une seule requête légère par vue
 * (date, statut, terminé) ; mois et année courants selon le fuseau du profil.
 */
export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const user = await requireUser(routes.calendar);
  const profile = await getCurrentProfile();
  const today = getUserToday(profile?.timezone);
  const { view, monthKey, year } = parseCalendarParams(await searchParams, today);
  const currentMonthKey = getMonthKey(today);
  const currentYear = Number(today.slice(0, 4));

  const range =
    view === "month"
      ? getMonthRange(monthKey)
      : { start: `${String(year).padStart(4, "0")}-01-01`, end: `${String(year).padStart(4, "0")}-12-31` };

  let entries: CalendarEntry[];
  let hasCheckins: boolean;
  let journeyStart: string | null;
  try {
    const [loadedEntries, anyCheckin, substances] = await Promise.all([
      getCalendarEntries(user.id, range.start, range.end),
      hasAnyCompletedCheckin(user.id),
      getTrackedSubstances(user.id),
    ]);
    entries = loadedEntries;
    hasCheckins = anyCheckin;
    journeyStart = substances.map((substance) => substance.startedOn).sort()[0] ?? null;
  } catch {
    return (
      <PageContainer>
        <PageHeader title="Calendrier" />
        <LoadError message="Impossible de charger ton calendrier pour le moment." />
      </PageContainer>
    );
  }

  const monthNavigation = getMonthNavigation(monthKey, today);

  return (
    <PageContainer>
      <PageHeader title="Calendrier" description="Une vue d'ensemble de ton parcours, un jour à la fois." />

      {!hasCheckins ? (
        <Card>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-3 text-pretty">
              <CalendarHeart className="size-5 shrink-0 text-primary" aria-hidden="true" />
              Ton calendrier prendra vie au fil de tes check-ins.
            </p>
            <Button asChild>
              <Link href={routes.checkin}>Faire mon premier check-in</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="grid gap-5">
          {view === "month" ? (
            <>
              <CalendarToolbar
                view="month"
                title={formatMonthYear(monthKey)}
                previousHref={monthNavigation.previous ? calendarMonthHref(monthNavigation.previous) : null}
                previousLabel="Mois précédent"
                nextHref={monthNavigation.next ? calendarMonthHref(monthNavigation.next) : null}
                nextLabel="Mois suivant"
                todayHref={monthNavigation.isCurrent ? null : calendarMonthHref(currentMonthKey)}
                currentMonthKey={currentMonthKey}
                currentYear={currentYear}
              />
              <MonthCalendar monthKey={monthKey} weeks={buildMonthGrid(monthKey, today, entries, journeyStart)} />
            </>
          ) : (
            <>
              <CalendarToolbar
                view="year"
                title={String(year)}
                previousHref={year > 1900 ? calendarYearHref(year - 1) : null}
                previousLabel={`Année ${year - 1}`}
                nextHref={year < currentYear ? calendarYearHref(year + 1) : null}
                nextLabel={`Année ${year + 1}`}
                todayHref={year === currentYear ? null : calendarYearHref(currentYear)}
                currentMonthKey={currentMonthKey}
                currentYear={currentYear}
              />
              {(() => {
                const { months, summary } = buildYear(year, today, entries, journeyStart);
                return (
                  <>
                    <YearSummary year={year} summary={summary} />
                    <YearCalendar months={months} currentMonthKey={currentMonthKey} />
                  </>
                );
              })()}
            </>
          )}
          <CalendarLegend />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
