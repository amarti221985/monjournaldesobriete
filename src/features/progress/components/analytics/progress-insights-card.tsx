import { Lightbulb } from "lucide-react";

import { ANALYTICS_THRESHOLDS } from "@/features/progress/analytics";
import { SectionCard } from "@/features/progress/components/analytics/section-card";
import type { InsightsState } from "@/features/progress/progress-page";
import { PROGRESS_INSIGHT_RULES, type DescriptiveInsight } from "@/features/progress/progress-insights";

/** « Ce que tes données montrent » : 5 observations au plus, chacune avec sa base de calcul. */
export function ProgressInsightsCard({ insights, state }: { insights: DescriptiveInsight[]; state: InsightsState }) {
  return (
    <SectionCard title="Ce que tes données montrent">
      {state === "ready" ? (
        <ul className="grid gap-4">
          {insights.map((insight) => (
            <li key={insight.id} className="flex gap-3">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="grid gap-0.5">
                <p className="text-sm text-pretty">{insight.text}</p>
                <p className="text-xs text-pretty text-muted-foreground">{insight.basis}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : state === "none" ? (
        <p className="text-sm text-pretty text-muted-foreground">
          Rien de marquant pour l&apos;instant : aucune tendance claire ne ressort de cette période.
        </p>
      ) : state === "longer_period" ? (
        <p className="text-sm text-pretty text-muted-foreground">
          Cette période compte moins de {PROGRESS_INSIGHT_RULES.minCheckins} check-ins. Choisis une période plus longue
          pour voir des tendances.
        </p>
      ) : (
        <div className="grid gap-1">
          <p className="font-medium">Continue à enregistrer tes journées</p>
          <p className="text-sm text-pretty text-muted-foreground">
            Avec davantage de check-ins, certaines tendances pourront commencer à apparaître.
          </p>
        </div>
      )}

      <details className="text-sm">
        <summary className="min-h-8 cursor-pointer text-muted-foreground">Comment ces tendances sont-elles calculées ?</summary>
        <div className="mt-2 grid gap-2 text-pretty text-muted-foreground">
          <p>
            Les tendances sont calculées uniquement à partir de tes check-ins enregistrés, avec des règles fixes (aucune
            intelligence artificielle). Elles décrivent des associations dans tes données et ne constituent pas des
            conclusions médicales.
          </p>
          <ul className="grid list-disc gap-1 pl-5">
            <li>Au moins {PROGRESS_INSIGHT_RULES.minCheckins} check-ins sur la période.</li>
            <li>
              Comparaisons « avec / sans » : au moins {ANALYTICS_THRESHOLDS.associationMinGroupSize} journées dans
              chaque groupe et un écart d&apos;au moins {ANALYTICS_THRESHOLDS.associationMinDifference} point sur 10.
            </li>
            <li>Jours de la semaine : au moins {ANALYTICS_THRESHOLDS.weekdayMinCheckins} check-ins par jour comparé.</li>
            <li>Les journées sans check-in ne comptent jamais, ni comme zéro ni dans les moyennes.</li>
          </ul>
        </div>
      </details>
    </SectionCard>
  );
}
