import { Sprout } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent, pluralize } from "@/features/progress/format";
import type { SobrietyMetrics, StreakMetrics } from "@/features/progress/metrics";

type ProgressOverviewCardProps = {
  metrics: SobrietyMetrics;
  streaks: StreakMetrics;
};

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="grid content-start gap-1 rounded-xl bg-muted/60 p-3.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="grid gap-1">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        <span className="text-xs text-pretty text-muted-foreground">{hint}</span>
      </dd>
    </div>
  );
}

/**
 * Progression cumulative d'abord (ADR-041) : les journées sobres enregistrées sont
 * la valeur dominante ; la série n'est qu'une métrique parmi d'autres.
 */
export function ProgressOverviewCard({ metrics, streaks }: ProgressOverviewCardProps) {
  if (metrics.trackedDays === 0) {
    return (
      <Card>
        <CardContent className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"
          >
            <Sprout className="size-5" />
          </span>
          <div className="grid gap-1">
            <h2 className="font-semibold">Ta progression commencera ici</h2>
            <p className="text-sm text-pretty text-muted-foreground">
              Complète ton premier check-in pour commencer à voir ton évolution.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">Ta progression</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <p className="grid gap-0.5">
          <span className="text-5xl font-semibold tracking-tight text-primary">{metrics.soberDays}</span>
          <span className="text-muted-foreground">
            {pluralize(metrics.soberDays, "journée sobre enregistrée", "journées sobres enregistrées")}
          </span>
        </p>

        <dl className="grid grid-cols-2 gap-2.5">
          <Metric
            label="Jours suivis"
            value={String(metrics.trackedDays)}
            hint="Check-ins complétés"
          />
          <Metric
            label="Taux de sobriété"
            value={metrics.sobrietyRate !== null ? formatPercent(metrics.sobrietyRate) : "—"}
            hint="Calculé à partir de tes check-ins complétés"
          />
          <Metric
            label="Série actuelle"
            value={String(streaks.current)}
            hint={
              streaks.current === 0 && streaks.lastDocumentedWasConsumption
                ? "Ta prochaine journée sobre enregistrée commencera une nouvelle série."
                : "Journées sobres enregistrées depuis la dernière consommation"
            }
          />
          <Metric
            label="Meilleure série"
            value={String(streaks.best)}
            hint="Plus grand nombre de journées sobres enregistrées entre deux consommations"
          />
        </dl>

        <p className="text-sm text-muted-foreground">
          {metrics.consumedDays} {pluralize(metrics.consumedDays, "jour", "jours")} avec consommation
          {metrics.challengingDays > 0
            ? ` · dont ${metrics.challengingDays} ${pluralize(metrics.challengingDays, "journée sobre", "journées sobres")} malgré une forte envie`
            : null}
        </p>
      </CardContent>
    </Card>
  );
}
