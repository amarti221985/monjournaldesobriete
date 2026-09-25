import { ANALYTICS_THRESHOLDS, type CravingAssociation, type WeekdayCravingSummary } from "@/features/progress/analytics";
import { SectionCard } from "@/features/progress/components/analytics/section-card";
import { formatDecimal, formatScore, pluralize } from "@/features/progress/format";

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Envie de consommer selon le jour de la semaine et le niveau de stress. Un jour avec
 * moins de 3 check-ins n'est jamais comparé ; les formulations restent descriptives.
 */
export function CravingPatternsCard({
  weekday,
  stress,
}: {
  weekday: WeekdayCravingSummary;
  stress: CravingAssociation | null;
}) {
  const { weekdayMinCheckins, highStressMin, associationMinGroupSize } = ANALYTICS_THRESHOLDS;

  return (
    <SectionCard title="Ton envie de consommer" description="Envie moyenne sur 10, selon le moment et le contexte.">
      <section aria-labelledby="weekday-title" className="grid gap-3">
        <h3 id="weekday-title" className="text-sm font-semibold">Selon les jours de la semaine</h3>
        <ul className="grid gap-1.5 text-sm">
          {weekday.days.map((day) => (
            <li key={day.weekday} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3">
              <span>{capitalize(day.name)}</span>
              <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
                {day.eligible && day.average !== null ? (
                  <span
                    className="block h-full rounded-full bg-series-craving"
                    style={{ width: `${(day.average / 10) * 100}%` }}
                  />
                ) : null}
              </span>
              <span className="text-right tabular-nums">
                {day.eligible && day.average !== null ? (
                  <>
                    <span className="font-semibold">{formatDecimal(day.average)}</span>
                    <span className="text-muted-foreground"> ({day.count})</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    {day.count} {pluralize(day.count, "check-in", "check-ins")}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-pretty">
          {weekday.highest && weekday.highest.average !== null
            ? `Sur tes ${weekday.highest.name}s enregistrés, ton envie moyenne est de ${formatScore(weekday.highest.average)} : c'est la plus élevée parmi les jours suffisamment documentés.`
            : "Pas encore assez de journées par jour de la semaine pour les comparer."}
        </p>
        <p className="text-xs text-muted-foreground">
          Un jour n&apos;est comparé qu&apos;à partir de {weekdayMinCheckins} check-ins ; le nombre entre parenthèses
          indique les journées utilisées.
        </p>
      </section>

      <section aria-labelledby="stress-title" className="grid gap-2 border-t pt-4">
        <h3 id="stress-title" className="text-sm font-semibold">Selon ton niveau de stress</h3>
        {stress ? (
          <>
            <p className="text-sm text-pretty">
              Sur tes journées où le stress était de {highStressMin}/10 ou plus, ton envie moyenne était de{" "}
              <span className="font-semibold">{formatScore(stress.withAverage)}</span>. Sur les autres journées
              enregistrées, elle était de <span className="font-semibold">{formatScore(stress.withoutAverage)}</span>.
            </p>
            <p className="text-xs text-muted-foreground">
              Basé sur {stress.withCount} {pluralize(stress.withCount, "journée", "journées")} avec un stress élevé et{" "}
              {stress.withoutCount} sans. Une association n&apos;indique pas une cause.
            </p>
          </>
        ) : (
          <p className="text-sm text-pretty text-muted-foreground">
            Aucune différence marquée à décrire pour l&apos;instant (il faut au moins {associationMinGroupSize} journées
            avec un stress de {highStressMin}/10 ou plus et {associationMinGroupSize} autres, et un écart d&apos;au moins
            1 point).
          </p>
        )}
      </section>
    </SectionCard>
  );
}
