import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDayStateDisplay } from "@/config/day-status";
import { routes } from "@/config/routes";
import { journalDayHref } from "@/features/calendar/logic";
import { pluralize } from "@/features/progress/format";
import type { RecentDaysSummary, WeekDay, WeekDayState } from "@/features/progress/week";
import { formatLocalDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

function stateConfig(state: WeekDayState) {
  const config = getDayStateDisplay(state);
  return { label: config.label, icon: config.icon, className: config.className.soft };
}

function DayCell({ day, todayHref }: { day: WeekDay; todayHref: string }) {
  const { label, icon: Icon, className } = stateConfig(day.state);
  const fullDate = formatLocalDate(day.date, { weekday: "long", day: "numeric", month: "long" });
  const description = `${fullDate}${day.isToday ? " (aujourd'hui)" : ""} : ${label}`;

  const content = (
    <>
      <span className="text-xs font-medium text-muted-foreground" aria-hidden="true">
        {formatLocalDate(day.date, { weekday: "narrow" })}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-10 items-center justify-center rounded-full border border-transparent",
          className,
          day.isToday && "ring-2 ring-primary ring-offset-2 ring-offset-card",
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="text-xs text-muted-foreground" aria-hidden="true">
        {formatLocalDate(day.date, { day: "numeric" })}
      </span>
      <span className="sr-only">{description}</span>
    </>
  );

  const cellClass = "flex flex-col items-center gap-1.5 rounded-xl py-1";

  // Aujourd'hui → check-in du jour ; journée passée → détail (check-in possible, ADR-098).
  const href = day.isToday ? todayHref : day.state === "future" ? null : journalDayHref(day.date);
  return href ? (
    <Link href={href} title={description} className={cn(cellClass, "hover:bg-muted/60")}>
      {content}
    </Link>
  ) : (
    <div title={description} className={cellClass}>
      {content}
    </div>
  );
}

const LEGEND: WeekDayState[] = ["sober", "challenging", "consumed", "untracked", "future"];

function RecentSummary({ summary }: { summary: RecentDaysSummary }) {
  const parts = [
    `${summary.soberDays} ${pluralize(summary.soberDays, "journée sobre", "journées sobres")}${
      summary.challengingDays > 0 ? ` (dont ${summary.challengingDays} malgré une forte envie)` : ""
    }`,
    `${summary.consumedDays} ${pluralize(summary.consumedDays, "journée", "journées")} avec consommation`,
    `${summary.untrackedDays} ${pluralize(summary.untrackedDays, "journée non documentée", "journées non documentées")}`,
  ];
  return (
    <div className="grid gap-1 border-t pt-4">
      <h3 className="text-sm font-medium">Tes 7 derniers jours</h3>
      <p className="text-sm text-pretty text-muted-foreground">
        {parts.join(" · ")}
        {summary.todayPending ? " · aujourd'hui à compléter" : ""}.
      </p>
    </div>
  );
}

/** Semaine en cours, du lundi au dimanche (ADR-044), et résumé des 7 derniers jours calendaires. */
export function WeekCard({
  week,
  recentDays,
  todayHref = routes.checkin,
}: {
  week: WeekDay[];
  recentDays: RecentDaysSummary;
  todayHref?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">Cette semaine</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ol className="grid grid-cols-7 gap-1">
          {week.map((day) => (
            <li key={day.date}>
              <DayCell day={day} todayHref={todayHref} />
            </li>
          ))}
        </ol>

        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Légende">
          {LEGEND.map((state) => {
            const { label, icon: Icon } = stateConfig(state);
            return (
              <li key={state} className="flex items-center gap-1.5">
                <Icon className="size-3.5" aria-hidden="true" />
                {label}
              </li>
            );
          })}
        </ul>

        <RecentSummary summary={recentDays} />
      </CardContent>
    </Card>
  );
}
