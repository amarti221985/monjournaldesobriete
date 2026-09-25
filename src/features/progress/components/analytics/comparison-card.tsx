import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

import { ANALYTICS_THRESHOLDS, type PeriodComparison, type TrendDirection } from "@/features/progress/analytics";
import { EmptyNote, SectionCard } from "@/features/progress/components/analytics/section-card";
import { formatDecimal, formatPointDifference } from "@/features/progress/format";
import { scoreMeta, trendLabels } from "@/features/progress/score-labels";

const TREND_ICONS = { up: ArrowUp, down: ArrowDown, stable: ArrowRight } as const;

function TrendText({ direction, detail }: { direction: TrendDirection; detail: string }) {
  const Icon = TREND_ICONS[direction];
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {detail} · {trendLabels[direction]}
    </span>
  );
}

/**
 * Période actuelle vs précédente équivalente. Chiffres seulement si CHAQUE période a au
 * moins 3 check-ins ; écarts en points (jamais en %), sens décrit sans jugement.
 */
export function ComparisonCard({ comparison, days }: { comparison: PeriodComparison; days: number }) {
  return (
    <SectionCard
      title="Comparaison"
      description={`Tes ${days} derniers jours comparés aux ${days} jours précédents.`}
    >
      {comparison.sufficient ? (
        <dl className="grid gap-3 sm:grid-cols-2">
          {comparison.scores.map((score) =>
            score.current !== null && score.previous !== null && score.difference !== null && score.direction ? (
              <div key={score.key} className="grid gap-0.5 rounded-lg bg-muted/60 p-3 text-sm">
                <dt className="font-medium">{scoreMeta[score.key].averageLabel}</dt>
                <dd className="grid gap-0.5">
                  <span>
                    <span className="font-semibold">{formatDecimal(score.current)}</span> vs {formatDecimal(score.previous)}
                  </span>
                  <TrendText direction={score.direction} detail={formatPointDifference(score.difference)} />
                </dd>
              </div>
            ) : null,
          )}
          {comparison.trackedDays ? (
            <div className="grid gap-0.5 rounded-lg bg-muted/60 p-3 text-sm">
              <dt className="font-medium">Jours suivis</dt>
              <dd className="grid gap-0.5">
                <span>
                  <span className="font-semibold">{comparison.trackedDays.current}</span> vs {comparison.trackedDays.previous}
                </span>
                <TrendText
                  direction={comparison.trackedDays.direction}
                  detail={`${comparison.trackedDays.difference > 0 ? "+" : comparison.trackedDays.difference < 0 ? "−" : ""}${Math.abs(comparison.trackedDays.difference)} j`}
                />
              </dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <EmptyNote>
          Pas encore assez de données pour comparer ces périodes (au moins {ANALYTICS_THRESHOLDS.comparisonMinCheckins}{" "}
          check-ins dans chacune : {comparison.currentCount} sur cette période, {comparison.previousCount} sur la
          précédente).
        </EmptyNote>
      )}
      <p className="text-xs text-muted-foreground">
        Scores moyens sur 10. Un écart de moins de {formatDecimal(ANALYTICS_THRESHOLDS.stableTolerance)} point est
        considéré comme relativement stable.
      </p>
    </SectionCard>
  );
}
