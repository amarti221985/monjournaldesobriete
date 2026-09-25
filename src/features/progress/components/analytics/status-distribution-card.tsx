import { dayVisualStatusConfig, type DayVisualStatus } from "@/config/day-status";
import type { StatusDistribution } from "@/features/progress/analytics";
import { EmptyNote, SectionCard } from "@/features/progress/components/analytics/section-card";
import { pluralize } from "@/features/progress/format";
import { cn } from "@/lib/utils";

const ROWS: { key: keyof Omit<StatusDistribution, "total">; status: DayVisualStatus; label: string }[] = [
  { key: "sober", status: "sober", label: "Sobre" },
  { key: "challenging", status: "challenging", label: "Sobre malgré une forte envie" },
  { key: "consumed", status: "consumed", label: "Consommation" },
];

/**
 * « Tes journées enregistrées » : barre empilée DÉCORATIVE ; les nombres sont toujours
 * écrits en texte (icône + libellé + nombre), la couleur n'est jamais seule.
 */
export function StatusDistributionCard({ distribution }: { distribution: StatusDistribution }) {
  return (
    <SectionCard title="Tes journées enregistrées" description="Répartition de tes check-ins sur la période.">
      {distribution.total === 0 ? (
        <EmptyNote>Aucun check-in sur cette période.</EmptyNote>
      ) : (
        <>
          <div aria-hidden="true" className="flex h-3 gap-0.5 overflow-hidden rounded-full">
            {ROWS.filter((row) => distribution[row.key] > 0).map((row) => (
              <span
                key={row.key}
                className={cn("h-full", dayVisualStatusConfig[row.status].className.solid)}
                style={{ flexGrow: distribution[row.key] }}
              />
            ))}
          </div>
          <ul className="grid gap-2 text-sm">
            {ROWS.map((row) => {
              const Icon = dayVisualStatusConfig[row.status].icon;
              const count = distribution[row.key];
              return (
                <li key={row.key} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Icon className={cn("size-4 shrink-0", dayVisualStatusConfig[row.status].className.text)} aria-hidden="true" />
                    {row.label}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {count} <span className="font-normal text-muted-foreground">{pluralize(count, "journée", "journées")}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </SectionCard>
  );
}
