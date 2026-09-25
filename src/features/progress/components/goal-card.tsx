import { Target } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { goalOptions } from "@/features/onboarding/constants";
import { formatLongDate } from "@/lib/dates";
import type { TrackedSubstance } from "@/lib/services/journey";

/** Objectif principal, discret ; les autres substances suivies sont seulement comptées. */
export function GoalCard({ substances }: { substances: TrackedSubstance[] }) {
  const primary = substances.find((substance) => substance.isPrimary) ?? substances[0];
  if (!primary) return null;
  const others = substances.length - 1;

  return (
    <Card>
      <CardContent className="flex gap-3">
        <Target className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="grid gap-0.5">
          <h2 className="text-sm text-muted-foreground">Mon objectif</h2>
          <p className="font-medium">{primary.customName ?? primary.name}</p>
          <p className="text-sm">{goalOptions[primary.goal].label}</p>
          <p className="text-sm text-muted-foreground">Depuis le {formatLongDate(primary.startedOn)}</p>
          {others > 0 ? (
            <p className="text-sm text-muted-foreground">
              + {others} {others > 1 ? "autres" : "autre"}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
