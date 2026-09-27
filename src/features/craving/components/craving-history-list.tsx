import { formatMeasuredDuration, formatCravingDelta } from "@/features/craving/logic";
import { addDays, formatLocalDate } from "@/lib/dates";
import type { CravingEventDetail } from "@/lib/services/craving";

/** « Aujourd'hui, 16:20 » : journée locale du moment + heure dans le fuseau du profil. */
export function formatCravingMoment(event: CravingEventDetail, today: string, timeZone: string): string {
  const time = new Intl.DateTimeFormat("fr-CA", { hour: "2-digit", minute: "2-digit", timeZone }).format(
    new Date(event.startedAt),
  );
  const day =
    event.localDate === today
      ? "Aujourd'hui"
      : event.localDate === addDays(today, -1)
        ? "Hier"
        : formatLocalDate(event.localDate, { weekday: "long", day: "numeric", month: "long" });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${time}`;
}

/** Liste des moments terminés : envie avant → après, stratégie, durée, déclencheur. */
export function CravingHistoryList({
  events,
  today,
  timeZone,
}: {
  events: CravingEventDetail[];
  today: string;
  timeZone: string;
}) {
  return (
    <ul className="grid gap-3">
      {events.map((event) => {
        const final = event.final ?? event.initial;
        const strategy = event.intervention?.strategyName ?? event.intervention?.customStrategyText ?? null;
        const triggers = event.triggerUnknown ? "Je ne sais pas" : event.triggers.map((trigger) => trigger.name).join(", ");
        return (
          <li key={event.id} className="grid gap-1.5 rounded-xl border bg-card p-4 text-sm">
            <p className="font-medium">{formatCravingMoment(event, today, timeZone)}</p>
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Envie :</dt>
                <dd>
                  {event.initial} → {final}{" "}
                  <span className="text-muted-foreground">({formatCravingDelta(event.initial, final)})</span>
                </dd>
              </div>
              {strategy ? (
                <div className="flex min-w-0 gap-1.5">
                  <dt className="shrink-0 text-muted-foreground">Stratégie :</dt>
                  <dd className="min-w-0 truncate">{strategy}</dd>
                </div>
              ) : null}
              {event.intervention?.actualSeconds != null ? (
                <div className="flex gap-1.5">
                  <dt className="text-muted-foreground">Durée :</dt>
                  <dd>{formatMeasuredDuration(event.intervention.actualSeconds)}</dd>
                </div>
              ) : null}
              {triggers ? (
                <div className="flex min-w-0 gap-1.5">
                  <dt className="shrink-0 text-muted-foreground">Déclencheur :</dt>
                  <dd className="min-w-0 truncate">{triggers}</dd>
                </div>
              ) : null}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
