import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { calendarMonthHref, calendarYearHref, type CalendarView } from "@/features/calendar/logic";
import { cn } from "@/lib/utils";

type CalendarToolbarProps = {
  view: CalendarView;
  title: string;
  previousHref: string | null;
  previousLabel: string;
  nextHref: string | null;
  nextLabel: string;
  todayHref: string | null;
  currentMonthKey: string;
  currentYear: number;
};

/** Bascule Mois | Année et navigation précédent / aujourd'hui / suivant (liens : back du navigateur OK). */
export function CalendarToolbar({
  view,
  title,
  previousHref,
  previousLabel,
  nextHref,
  nextLabel,
  todayHref,
  currentMonthKey,
  currentYear,
}: CalendarToolbarProps) {
  return (
    <div className="grid gap-4">
      <nav aria-label="Vue du calendrier" className="flex w-full rounded-lg border p-0.5 sm:w-auto sm:justify-self-start">
        {(
          [
            ["month", "Mois", calendarMonthHref(currentMonthKey)],
            ["year", "Année", calendarYearHref(currentYear)],
          ] as const
        ).map(([key, label, href]) => (
          <Link
            key={key}
            href={href}
            aria-current={view === key ? "page" : undefined}
            className={cn(
              "flex min-h-10 flex-1 items-center justify-center rounded-md px-5 text-sm font-medium transition-colors",
              view === key ? "bg-secondary font-semibold text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center justify-between gap-2">
        {previousHref ? (
          <Button asChild variant="outline" size="icon" aria-label={previousLabel}>
            <Link href={previousHref} scroll={false}>
              <ChevronLeft aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <span className="size-10" aria-hidden="true" />
        )}

        <div className="flex flex-col items-center gap-0.5">
          <h2 className="text-lg font-semibold capitalize sm:text-xl" aria-live="polite">
            {title}
          </h2>
          {todayHref ? (
            <Link href={todayHref} scroll={false} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Aujourd&apos;hui
            </Link>
          ) : null}
        </div>

        {nextHref ? (
          <Button asChild variant="outline" size="icon" aria-label={nextLabel}>
            <Link href={nextHref} scroll={false}>
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <span className="size-10" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
