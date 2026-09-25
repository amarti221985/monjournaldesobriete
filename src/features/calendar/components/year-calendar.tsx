import Link from "next/link";

import { getDayStateDisplay } from "@/config/day-status";
import { calendarMonthHref, type PeriodSummary, type YearMonth } from "@/features/calendar/logic";
import { describeDay } from "@/features/calendar/components/month-calendar";
import { pluralize } from "@/features/progress/format";
import { formatLocalDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

function describeSummary(summary: PeriodSummary): string {
  if (summary.trackedDays === 0) return "Aucune journée enregistrée";
  return [
    `${summary.soberDays} ${pluralize(summary.soberDays, "journée sobre", "journées sobres")}`,
    summary.consumedDays > 0 ? `${summary.consumedDays} avec consommation` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

function MonthBlock({ month, isFuture }: { month: YearMonth; isFuture: boolean }) {
  const name = formatLocalDate(`${month.monthKey}-01`, { month: "long" });
  const summaryText = isFuture ? "À venir" : describeSummary(month.summary);

  return (
    <li className="grid content-start gap-2 rounded-xl border bg-card p-3">
      <h3 className="text-sm font-semibold capitalize">
        {isFuture ? (
          name
        ) : (
          <Link
            href={calendarMonthHref(month.monthKey)}
            className="underline-offset-4 hover:underline"
            aria-label={`${name} : ${summaryText}. Ouvrir le mois`}
          >
            {name}
          </Link>
        )}
      </h3>
      {/* Mini-grille décorative : l'information est donnée par le texte ci-dessous et le lien du mois. */}
      <div aria-hidden="true" className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: month.leading }, (_, index) => (
          <span key={`lead-${index}`} className="aspect-square" />
        ))}
        {month.days.map((day) => (
          <span
            key={day.date}
            title={describeDay(day)}
            className={cn(
              "aspect-square rounded-[3px]",
              getDayStateDisplay(day.state).className.soft,
              day.state === "consumed" && "ring-1 ring-status-consumed ring-inset",
              day.isToday && "outline-2 outline-offset-1 outline-primary",
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{summaryText}</p>
    </li>
  );
}

/** Vue annuelle compacte : 12 mois, chacun avec son résumé textuel et un lien vers le mois. */
export function YearCalendar({ months, currentMonthKey }: { months: YearMonth[]; currentMonthKey: string }) {
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {months.map((month) => (
        <MonthBlock key={month.monthKey} month={month} isFuture={month.monthKey > currentMonthKey} />
      ))}
    </ol>
  );
}
