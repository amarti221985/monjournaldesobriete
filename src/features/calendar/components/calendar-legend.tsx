import { getDayStateDisplay, type CalendarDayState } from "@/config/day-status";
import { cn } from "@/lib/utils";

/** Légende volontairement courte : les 4 états d'une journée passée (ADR-048). */
const LEGEND: CalendarDayState[] = ["sober", "challenging", "consumed", "untracked"];

export function CalendarLegend({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-2", className)}>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Légende">
        {LEGEND.map((state) => {
          const { label, icon: Icon, className: stateClass } = getDayStateDisplay(state);
          return (
            <li key={state} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn("inline-flex size-6 items-center justify-center rounded-md", stateClass.soft)}
              >
                <Icon className="size-3.5" />
              </span>
              {label}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        Aujourd&apos;hui est entouré. Un crayon indique un check-in en cours ; les journées à venir restent
        discrètes.
      </p>
    </div>
  );
}
