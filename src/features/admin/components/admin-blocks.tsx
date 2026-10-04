import { ArrowDown } from "lucide-react";

import {
  FEATURES,
  featureLabels,
  formatPercentage,
  percentage,
  RETENTION_DAYS,
  retentionCell,
  type Feature,
  type FunnelStep,
} from "@/features/admin/analytics/definitions";
import type { RetentionCohort } from "@/lib/services/admin";

/** Entonnoir d'activation : nombre + conversion depuis l'étape précédente. */
export function Funnel({ steps }: { steps: FunnelStep[] }) {
  return (
    <ol className="grid gap-2">
      {steps.map((step, index) => (
        <li key={step.label} className="grid gap-1">
          {index > 0 ? <ArrowDown className="mx-auto size-4 text-muted-foreground" aria-hidden="true" /> : null}
          <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border bg-card px-4 py-3">
            <span className="font-medium">{step.label}</span>
            <span className="text-sm tabular-nums">
              <span className="text-lg font-semibold">{step.count}</span>
              {index > 0 ? (
                <span className="ml-2 text-muted-foreground">
                  {formatPercentage(step.conversion)}
                  <span className="sr-only"> depuis l&apos;étape précédente</span>
                </span>
              ) : null}
            </span>
            {step.note ? <span className="w-full text-xs text-muted-foreground">{step.note}</span> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Utilisation des fonctionnalités : personnes distinctes, barre + nombre (jamais la couleur seule). */
export function FeatureAdoption({ adoption, population }: { adoption: Record<Feature, number>; population: number }) {
  return (
    <ul className="grid gap-3">
      {FEATURES.map((feature) => {
        const share = percentage(adoption[feature], population);
        return (
          <li key={feature} className="grid gap-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span>{featureLabels[feature]}</span>
              <span className="tabular-nums">
                <span className="font-medium">{adoption[feature]}</span>{" "}
                <span className="text-muted-foreground">
                  {adoption[feature] > 1 ? "personnes" : "personne"}
                  {share !== null ? ` · ${share} %` : ""}
                </span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted" aria-hidden="true">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, share ?? 0)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function formatWeek(week: string) {
  return new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${week}T00:00:00Z`));
}

/** Rétention globale (somme des cohortes) : « — » tant qu'aucune personne n'a atteint le jour. */
export function RetentionOverview({ cohorts }: { cohorts: RetentionCohort[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {RETENTION_DAYS.map((day) => {
        const eligible = cohorts.reduce((sum, cohort) => sum + cohort.days[day].eligible, 0);
        const retained = cohorts.reduce((sum, cohort) => sum + cohort.days[day].retained, 0);
        const cell = retentionCell(retained, eligible);
        return (
          <div key={day} className="grid gap-0.5 rounded-lg border bg-card p-3">
            <dt className="text-sm text-muted-foreground">J{day}</dt>
            <dd className="text-xl font-semibold tabular-nums">{cell.label}</dd>
            <dd className="text-xs text-muted-foreground">{cell.detail ? `${cell.detail} personnes` : "Pas encore disponible"}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Cohortes hebdomadaires (lundi UTC). Défilement horizontal contrôlé sur mobile. */
export function RetentionTable({ cohorts }: { cohorts: RetentionCohort[] }) {
  return (
    // min-w-0 : le tableau défile dans sa carte au lieu d'élargir la page (mobile) ; relative :
    // les textes réservés aux lecteurs d'écran (sr-only, positionnés) restent dans le défilement.
    <div className="relative min-w-0 overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <caption className="sr-only">Rétention par cohorte hebdomadaire d&apos;inscription</caption>
        <thead>
          <tr className="border-b text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-medium">
              Cohorte (semaine du)
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              Inscrits
            </th>
            {RETENTION_DAYS.map((day) => (
              <th key={day} scope="col" className="py-2 pr-3 text-right font-medium">
                J{day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((cohort) => (
            <tr key={cohort.cohortWeek} className="border-b last:border-0">
              <th scope="row" className="py-2 pr-3 font-medium">
                {formatWeek(cohort.cohortWeek)}
              </th>
              <td className="py-2 pr-3 text-right tabular-nums">{cohort.signups}</td>
              {RETENTION_DAYS.map((day) => {
                const cell = retentionCell(cohort.days[day].retained, cohort.days[day].eligible);
                return (
                  <td key={day} className="py-2 pr-3 text-right tabular-nums">
                    <span className={cell.detail ? undefined : "text-muted-foreground"}>{cell.label}</span>
                    {cell.detail ? <span className="block text-xs text-muted-foreground">{cell.detail}</span> : <span className="sr-only">Pas encore disponible</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
