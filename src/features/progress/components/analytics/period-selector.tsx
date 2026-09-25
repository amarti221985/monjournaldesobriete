import Link from "next/link";

import { routes } from "@/config/routes";
import { PERIOD_FILTERS, progressPeriodLabels, type ProgressPeriod } from "@/features/progress/periods";
import { cn } from "@/lib/utils";

export function progressPeriodHref(period: ProgressPeriod): string {
  return `${routes.progress}?period=${period}`;
}

/**
 * Sélecteur de période : de simples liens (?period=), utilisables au clavier, au
 * toucher et au lecteur d'écran (aria-current). La période n'est pas une donnée sensible.
 */
export function PeriodSelector({ current }: { current: ProgressPeriod }) {
  return (
    <nav aria-label="Période analysée">
      <ul className="flex flex-wrap gap-2">
        {PERIOD_FILTERS.map((period) => {
          const active = period === current;
          return (
            <li key={period}>
              <Link
                href={progressPeriodHref(period)}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors",
                  "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {progressPeriodLabels[period]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
