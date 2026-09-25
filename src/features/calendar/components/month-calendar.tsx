import Link from "next/link";

import { getDayStateDisplay } from "@/config/day-status";
import { getCalendarDayHref, type CalendarDay } from "@/features/calendar/logic";
import { formatLocalDate, formatMonthYear } from "@/lib/dates";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"];

/** « 24 septembre 2026, Journée sobre, aujourd'hui » */
export function describeDay(day: CalendarDay): string {
  const date = formatLocalDate(day.date, { day: "numeric", month: "long", year: "numeric" });
  return `${date}, ${getDayStateDisplay(day.state).label}${day.isToday ? ", aujourd'hui" : ""}`;
}

function DayCell({ day }: { day: CalendarDay }) {
  const { icon: Icon, className } = getDayStateDisplay(day.state);
  const href = getCalendarDayHref(day);
  const description = describeDay(day);

  const content = (
    <>
      <span aria-hidden="true" className="self-start text-xs font-medium sm:text-sm">
        {day.dayOfMonth}
      </span>
      <Icon aria-hidden="true" className="size-4 self-end justify-self-end sm:size-5" />
      <span className="sr-only">{description}</span>
    </>
  );

  const cellClass = cn(
    "grid h-12 w-full grid-rows-[auto_1fr] rounded-lg p-1.5 sm:h-16 sm:p-2",
    className.soft,
    day.isToday && "ring-2 ring-primary ring-offset-2 ring-offset-card",
  );

  // Seules les journées réellement cliquables sont des liens (ADR-048).
  return href ? (
    <Link
      href={href}
      title={description}
      className={cn(cellClass, "transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/60")}
    >
      {content}
    </Link>
  ) : (
    <div title={description} className={cellClass}>
      {content}
    </div>
  );
}

/** Grille mensuelle lundi → dimanche, sous forme de tableau accessible. */
export function MonthCalendar({ monthKey, weeks }: { monthKey: string; weeks: (CalendarDay | null)[][] }) {
  return (
    <table className="w-full table-fixed border-separate border-spacing-1 sm:border-spacing-1.5">
      <caption className="sr-only">Calendrier de {formatMonthYear(monthKey)}</caption>
      <thead>
        <tr>
          {WEEKDAYS.map((date) => (
            <th key={date} scope="col" className="pb-1 text-xs font-medium text-muted-foreground">
              <abbr title={formatLocalDate(date, { weekday: "long" })} className="no-underline">
                {formatLocalDate(date, { weekday: "narrow" })}
              </abbr>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week, index) => (
          <tr key={index}>
            {week.map((day, dayIndex) => (
              <td key={day?.date ?? `empty-${index}-${dayIndex}`} className="p-0 align-top">
                {day ? <DayCell day={day} /> : null}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
