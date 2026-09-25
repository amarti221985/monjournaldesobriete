import { goalOptions } from "@/features/onboarding/constants";
import type { ConsumptionSummary, TriggerConsumptionShare } from "@/features/progress/analytics";
import { EmptyNote, SectionCard } from "@/features/progress/components/analytics/section-card";
import { formatScore, pluralize } from "@/features/progress/format";
import type { TrackedSubstance } from "@/lib/services/journey";

type ConsumptionCardProps = {
  summary: ConsumptionSummary;
  share: TriggerConsumptionShare | null;
  triggerLabels: Record<string, string>;
  substanceNames: Record<string, string>;
  substances: TrackedSubstance[];
};

/**
 * Journées avec consommation : journées ET événements (ils peuvent différer), répartition
 * par substance en nombre d'événements. Les quantités ne sont jamais additionnées
 * (unités incompatibles). Les objectifs sont rappelés sans verdict de réussite.
 */
export function ConsumptionCard({ summary, share, triggerLabels, substanceNames, substances }: ConsumptionCardProps) {
  const topTriggers = summary.triggers.slice(0, 3);

  return (
    <SectionCard title="Journées avec consommation" description="Ce que tu as enregistré sur la période, sans jugement.">
      {summary.consumedDays === 0 ? (
        <EmptyNote>Aucune journée avec consommation enregistrée sur cette période.</EmptyNote>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="grid gap-0.5 rounded-lg bg-muted/60 p-3">
              <dt className="text-muted-foreground">Journées avec consommation</dt>
              <dd className="text-2xl font-semibold">{summary.consumedDays}</dd>
            </div>
            <div className="grid gap-0.5 rounded-lg bg-muted/60 p-3">
              <dt className="text-muted-foreground">Événements enregistrés</dt>
              <dd className="text-2xl font-semibold">{summary.events}</dd>
            </div>
          </dl>

          {summary.bySubstance.length > 0 ? (
            <div className="grid gap-1.5">
              <h3 className="text-sm font-semibold">Par substance</h3>
              <ul className="grid gap-1 text-sm">
                {summary.bySubstance.map((item) => (
                  <li key={item.substanceId} className="flex justify-between gap-3">
                    <span>{substanceNames[item.substanceId] ?? "Substance"}</span>
                    <span className="tabular-nums">
                      {item.events} {pluralize(item.events, "événement", "événements")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <ul className="grid gap-1 text-sm">
            {summary.averageCraving !== null ? (
              <li>
                Envie moyenne ces journées-là : <span className="font-semibold">{formatScore(summary.averageCraving)}</span>
              </li>
            ) : null}
            {topTriggers.length > 0 ? (
              <li>
                Déclencheurs les plus enregistrés ces journées-là :{" "}
                {topTriggers
                  .map((item) => `${triggerLabels[item.slug] ?? "Autre"} (${item.days})`)
                  .join(", ")}
              </li>
            ) : null}
          </ul>

          {share ? (
            <p className="text-sm text-pretty">
              « {triggerLabels[share.slug] ?? "Autre"} » apparaît dans {share.days} de tes {share.consumedDays} journées
              avec consommation enregistrées.
            </p>
          ) : null}
        </>
      )}

      {substances.length > 0 ? (
        <div className="grid gap-1.5 border-t pt-4">
          <h3 className="text-sm font-semibold">{pluralize(substances.length, "Ton objectif", "Tes objectifs")}</h3>
          <ul className="grid gap-1 text-sm">
            {substances.map((substance) => (
              <li key={substance.id}>
                {substance.customName?.trim() || substance.name} — {goalOptions[substance.goal].label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SectionCard>
  );
}
