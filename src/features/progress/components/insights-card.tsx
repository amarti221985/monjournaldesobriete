import { Lightbulb } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pluralize } from "@/features/progress/format";
import type { Insight } from "@/features/progress/insights";

/** Tendances descriptives (ADR-045) : observations tirées des données, jamais des conclusions. */
export function InsightsCard({ insights, checkinsBeforeInsights }: { insights: Insight[]; checkinsBeforeInsights: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">Ce que tes données montrent</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {checkinsBeforeInsights > 0 ? (
          <div className="grid gap-1">
            <p className="font-medium">Tes tendances arrivent bientôt</p>
            <p className="text-sm text-pretty text-muted-foreground">
              Continue tes check-ins. Avec quelques journées de plus, ton journal pourra commencer à faire
              ressortir certaines habitudes récurrentes ({checkinsBeforeInsights}{" "}
              {pluralize(checkinsBeforeInsights, "check-in", "check-ins")} encore).
            </p>
          </div>
        ) : insights.length === 0 ? (
          <p className="text-sm text-pretty text-muted-foreground">
            Rien de marquant pour l&apos;instant : aucune tendance claire ne ressort encore de tes check-ins.
          </p>
        ) : (
          <ul className="grid gap-3">
            {insights.map((insight) => (
              <li key={insight.id} className="flex gap-3 text-sm text-pretty">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{insight.text}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Observations tirées uniquement de tes check-ins : ce sont des tendances, pas des explications ni un
          avis médical.
        </p>
      </CardContent>
    </Card>
  );
}
