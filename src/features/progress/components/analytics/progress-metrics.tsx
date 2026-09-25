import { Card, CardContent } from "@/components/ui/card";
import { formatPercent, pluralize } from "@/features/progress/format";
import type { ProgressMetrics } from "@/features/progress/progress-page";
import type { StreakMetrics } from "@/features/progress/metrics";

function MetricTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="grid content-start gap-1 rounded-xl border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="grid gap-1">
        <span className="text-3xl font-semibold tracking-tight">{value}</span>
        <span className="text-xs text-pretty text-muted-foreground">{hint}</span>
      </dd>
    </div>
  );
}

/** Grandes cartes : elles suivent TOUJOURS la période sélectionnée (libellé explicite). */
export function PeriodMetrics({ metrics, periodLabel }: { metrics: ProgressMetrics; periodLabel: string }) {
  return (
    <section aria-labelledby="period-metrics-title" className="grid gap-3">
      <h2 id="period-metrics-title" className="text-sm font-medium text-muted-foreground">
        Sur la période : {periodLabel}
      </h2>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          label="Jours sobres"
          value={String(metrics.soberDays)}
          hint={
            metrics.challengingDays > 0
              ? `Dont ${metrics.challengingDays} malgré une forte envie`
              : "Journées sobres enregistrées"
          }
        />
        <MetricTile label="Jours suivis" value={String(metrics.trackedDays)} hint="Check-ins complétés" />
        <MetricTile
          label="Taux de sobriété"
          value={metrics.sobrietyRate !== null ? formatPercent(metrics.sobrietyRate) : "—"}
          hint="Jours sobres ÷ jours suivis"
        />
        <MetricTile
          label="Jours avec consommation"
          value={String(metrics.consumedDays)}
          hint="Journées, pas événements"
        />
      </dl>
    </section>
  );
}

/** « Depuis le début de ton parcours » : petit bloc, indépendant de la période. */
export function SinceStartCard({ metrics, streaks }: { metrics: ProgressMetrics; streaks: StreakMetrics }) {
  return (
    <Card size="sm">
      <CardContent className="grid gap-3">
        <h2 className="text-sm font-semibold">Depuis le début de ton parcours</h2>
        <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <li>
            <span className="font-semibold">{metrics.soberDays}</span>{" "}
            {pluralize(metrics.soberDays, "journée sobre enregistrée", "journées sobres enregistrées")}
          </li>
          <li>
            <span className="font-semibold">{metrics.trackedDays}</span>{" "}
            {pluralize(metrics.trackedDays, "journée suivie", "journées suivies")}
          </li>
          <li>
            Série actuelle : <span className="font-semibold">{streaks.current}</span>
          </li>
          <li>
            Meilleure série : <span className="font-semibold">{streaks.best}</span>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
