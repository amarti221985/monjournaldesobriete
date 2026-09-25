import { TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { LoadError } from "@/components/shared/load-error";
import { StatusMessage } from "@/components/shared/status-message";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { ComparisonCard } from "@/features/progress/components/analytics/comparison-card";
import { ConsumptionCard } from "@/features/progress/components/analytics/consumption-card";
import { CravingPatternsCard } from "@/features/progress/components/analytics/craving-patterns-card";
import { FrequencyCard } from "@/features/progress/components/analytics/frequency-card";
import { PeriodSelector } from "@/features/progress/components/analytics/period-selector";
import { PeriodMetrics, SinceStartCard } from "@/features/progress/components/analytics/progress-metrics";
import { ProgressInsightsCard } from "@/features/progress/components/analytics/progress-insights-card";
import { ScoreEvolutionCard } from "@/features/progress/components/analytics/score-evolution-card";
import { StatusDistributionCard } from "@/features/progress/components/analytics/status-distribution-card";
import { formatScore, pluralize } from "@/features/progress/format";
import { countRangeDays, formatRange, parseProgressPeriod, progressPeriodLabels } from "@/features/progress/periods";
import { buildProgressPage, type ProgressPageData } from "@/features/progress/progress-page";
import { requireUser } from "@/lib/auth/session";
import { getUserToday } from "@/lib/dates";
import { getTrackedSubstances, type TrackedSubstance } from "@/lib/services/journey";
import { getCurrentProfile } from "@/lib/services/profiles";
import { getProgressDataset, type ProgressDataset } from "@/lib/services/progress";

export const metadata: Metadata = {
  title: "Progression",
};

const TITLE = "Ma progression";
const SUBTITLE =
  "Observe ton évolution, découvre les tendances de ton parcours et reconnais le chemin parcouru.";

/**
 * Progression & analyses (Sprint 6). Données privées : identité issue de la session
 * (requireUser), aucune donnée n'est acceptée du navigateur hormis la période (?period=).
 * Deux lectures en parallèle (check-ins terminés + relations en UNE requête, substances
 * suivies) ; tous les calculs sont faits par buildProgressPage() (fonctions pures).
 */
export default async function ProgressPage({ searchParams }: PageProps<"/progress">) {
  const user = await requireUser(routes.progress);
  const profile = await getCurrentProfile();
  const today = getUserToday(profile?.timezone);
  const period = parseProgressPeriod((await searchParams).period);

  let dataset: ProgressDataset;
  let substances: TrackedSubstance[];
  try {
    [dataset, substances] = await Promise.all([getProgressDataset(user.id), getTrackedSubstances(user.id)]);
  } catch {
    return (
      <PageContainer size="wide">
        <PageHeader title={TITLE} />
        <LoadError
          title="Impossible de charger ta progression"
          message="Tes données n'ont pas été modifiées. Réessaie dans quelques instants."
        />
      </PageContainer>
    );
  }

  if (dataset.checkins.length === 0) {
    return (
      <PageContainer size="wide">
        <PageHeader title={TITLE} description={SUBTITLE} />
        <StatusMessage
          icon={TrendingUp}
          headingLevel="h2"
          title="Ta progression commencera avec ton premier check-in"
          description="Chaque journée enregistrée t'aidera à observer ton évolution."
        >
          <Button asChild size="lg">
            <Link href={routes.checkin}>Faire mon check-in</Link>
          </Button>
        </StatusMessage>
      </PageContainer>
    );
  }

  const data: ProgressPageData = buildProgressPage(today, dataset.checkins, period, dataset.labels);
  const periodLabel = progressPeriodLabels[period];
  const topAssociation = data.achievementAssociations[0];

  return (
    <PageContainer size="wide">
      <PageHeader title={TITLE} description={SUBTITLE} />

      <div className="grid gap-2">
        <PeriodSelector current={period} />
        <p className="text-sm text-pretty text-muted-foreground">
          {periodLabel} : {formatRange(data.range)} — {data.calendarDays}{" "}
          {pluralize(data.calendarDays, "journée calendaire", "journées calendaires")}, que tu aies fait un check-in
          ou non.
        </p>
      </div>

      <PeriodMetrics metrics={data.metrics} periodLabel={periodLabel.toLowerCase()} />
      <SinceStartCard metrics={data.allTime.metrics} streaks={data.allTime.streaks} />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ScoreEvolutionCard
          points={data.scorePoints}
          trends={data.scoreTrends}
          comparable={data.comparison !== null}
          comparisonSufficient={data.comparison?.sufficient ?? false}
          checkinCount={data.metrics.trackedDays}
        />
        <div className="grid gap-6">
          <ProgressInsightsCard insights={data.insights} state={data.insightsState} />
          {data.comparison && data.previousRange ? (
            <ComparisonCard comparison={data.comparison} days={countRangeDays(data.previousRange)} />
          ) : null}
        </div>

        <StatusDistributionCard distribution={data.distribution} />
        <FrequencyCard
          title="Tes déclencheurs les plus fréquents"
          description="Nombre de journées où chaque déclencheur a été enregistré."
          items={data.triggers}
          labels={dataset.labels.triggers}
          emptyText="Aucun déclencheur enregistré sur cette période."
          footnote="Ces données montrent ce que tu as le plus souvent enregistré. Elles n'indiquent pas nécessairement une cause."
        />

        <FrequencyCard
          title="Tes émotions les plus fréquentes"
          description="Nombre de journées où chaque émotion a été enregistrée."
          items={data.emotions}
          labels={dataset.labels.emotions}
          emptyText="Aucune émotion enregistrée sur cette période."
        />
        <FrequencyCard
          title="Ce qui apparaît dans tes bonnes journées"
          description="Tes accomplissements enregistrés, en nombre de journées."
          items={data.achievements}
          labels={dataset.labels.achievements}
          emptyText="Aucun accomplissement enregistré sur cette période."
        >
          {topAssociation ? (
            <div className="grid gap-0.5 border-t pt-4">
              <p className="text-sm text-pretty">
                Dans tes données, les journées où tu as enregistré «{" "}
                {dataset.labels.achievements[topAssociation.slug] ?? "Autre"} » sont associées à une envie moyenne de{" "}
                {formatScore(topAssociation.withAverage)}, comparativement à {formatScore(topAssociation.withoutAverage)}{" "}
                les autres journées.
              </p>
              <p className="text-xs text-muted-foreground">
                Basé sur {topAssociation.withCount} {pluralize(topAssociation.withCount, "journée", "journées")} avec et{" "}
                {topAssociation.withoutCount} sans. Une association n&apos;indique pas une cause.
              </p>
            </div>
          ) : null}
        </FrequencyCard>

        <CravingPatternsCard weekday={data.weekday} stress={data.stressAssociation} />
        <ConsumptionCard
          summary={data.consumption}
          share={data.triggerConsumptionShare}
          triggerLabels={dataset.labels.triggers}
          substanceNames={dataset.substanceNames}
          substances={substances}
        />
      </div>
    </PageContainer>
  );
}
