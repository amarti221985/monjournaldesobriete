import { Lightbulb } from "lucide-react";

import { STRATEGY_MIN_COMPLETED } from "@/features/craving/constants";
import { describeStrategyEffectiveness, type StrategyEffectiveness } from "@/features/craving/logic";

/**
 * « Ce qui semble t'aider » : réduction moyenne (initial − final) par stratégie, seulement
 * à partir de 3 interventions terminées. Descriptif : une association, pas une cause.
 */
export function StrategyInsights({
  items,
  strategyNames,
}: {
  items: StrategyEffectiveness[];
  strategyNames: Record<string, string>;
}) {
  const nameOf = (key: string) => strategyNames[key] ?? key;
  const top = items.length >= 2 && items[0].averageReduction > 0 ? items[0] : null;

  return (
    <section aria-labelledby="strategy-insights-title" className="grid gap-3">
      <h2 id="strategy-insights-title" className="text-base font-semibold">
        Ce qui semble t&apos;aider
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-pretty text-muted-foreground">
          Après au moins {STRATEGY_MIN_COMPLETED} interventions terminées avec une même stratégie, tu verras ici comment
          ton envie a évolué en moyenne.
        </p>
      ) : (
        <ul className="grid gap-3">
          {top ? (
            <li className="flex gap-2.5 text-sm text-pretty">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                Parmi tes stratégies utilisées au moins {STRATEGY_MIN_COMPLETED} fois, « {nameOf(top.strategyKey)} » est
                associée à la plus grande diminution moyenne de ton envie.
              </span>
            </li>
          ) : null}
          {items.map((item) => (
            <li key={item.strategyKey} className="rounded-xl border bg-card p-3 text-sm text-pretty">
              {describeStrategyEffectiveness(item, nameOf(item.strategyKey))}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-pretty text-muted-foreground">
        Calculé à partir de tes interventions terminées : ce sont des observations, pas des garanties.
      </p>
    </section>
  );
}
