import type { ReactNode } from "react";

import { DayStatusBadge } from "@/components/shared/day-status-badge";
import { dayVisualStatusConfig } from "@/config/day-status";
import { scoreDefinitions, statusOptions, type CheckinStepId } from "@/features/checkin/constants";
import type { CheckinDisplay, CheckinDisplayEvent } from "@/features/checkin/display";

type CheckinSummaryViewProps = {
  checkin: CheckinDisplay;
  /** Rendu du bouton « Modifier » d'une section (wizard uniquement). */
  renderEdit?: (stepId: CheckinStepId, title: string) => ReactNode;
  /** Détail du journal : n'affiche que les sections contenant des données. */
  hideEmpty?: boolean;
};

function Section({
  title,
  stepId,
  renderEdit,
  children,
}: {
  title: string;
  stepId: CheckinStepId;
  renderEdit?: CheckinSummaryViewProps["renderEdit"];
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 border-b pb-5 last:border-b-0 last:pb-0">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <dt className="text-sm font-medium text-muted-foreground">{title}</dt>
        {renderEdit?.(stepId, title)}
      </div>
      <dd className="text-pretty">{children}</dd>
    </div>
  );
}

function List({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <span className="text-muted-foreground">{empty}</span>;
  return <>{items.join(" · ")}</>;
}

function Texts({ entries }: { entries: [string, string | null][] }) {
  const filled = entries.filter((entry): entry is [string, string] => Boolean(entry[1]));
  if (filled.length === 0) return <span className="text-muted-foreground">Rien d&apos;écrit aujourd&apos;hui.</span>;
  return (
    <div className="grid gap-3">
      {filled.map(([label, text]) => (
        <div key={label} className="grid gap-0.5">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="whitespace-pre-line">{text}</span>
        </div>
      ))}
    </div>
  );
}

function EventDetails({ event }: { event: CheckinDisplayEvent }) {
  const details = [
    event.quantity !== null ? `${event.quantity.toLocaleString("fr-CA")}${event.unit ? ` ${event.unit}` : ""}` : event.unit,
    event.occurredAt ? `vers ${event.occurredAt.replace(":", " h ")}` : null,
    event.cravingBefore !== null ? `envie avant : ${event.cravingBefore}/10` : null,
  ].filter(Boolean);
  const texts = (
    [
      ["Ce qui se passait juste avant", event.contextText],
      ["Ce que j'en retiens", event.reflectionText],
      ["Ce qui pourrait m'aider la prochaine fois", event.nextTimeStrategyText],
    ] satisfies [string, string | null][]
  ).filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <li className="grid gap-1.5 rounded-xl bg-muted/60 p-3.5">
      <span className="font-medium">{event.substanceName}</span>
      {details.length > 0 ? <span className="text-sm text-muted-foreground">{details.join(" · ")}</span> : null}
      {texts.length > 0 ? <Texts entries={texts} /> : null}
    </li>
  );
}

/** Résumé complet d'un check-in (lecture seule), réutilisé par le wizard et la consultation. */
export function CheckinSummaryView({ checkin, renderEdit, hideEmpty = false }: CheckinSummaryViewProps) {
  const visualStatus = statusOptions[checkin.status].visualStatus;
  const reflections: [string, string | null][] = [
    ["Ma fierté du jour", checkin.proudOfText],
    ["Ce que j'ai appris", checkin.lessonText],
    ["Mon intention pour demain", checkin.tomorrowIntentionText],
    ["Autres notes", checkin.notes],
  ];
  const show = {
    emotions: !hideEmpty || checkin.emotions.length > 0,
    triggers: !hideEmpty || checkin.triggers.length > 0,
    achievements: !hideEmpty || checkin.achievements.length > 0 || Boolean(checkin.victoryText),
    reflection: !hideEmpty || reflections.some(([, text]) => Boolean(text)),
  };

  return (
    <dl className="grid gap-5">
      <Section title="Ma journée" stepId="status" renderEdit={renderEdit}>
        <DayStatusBadge status={visualStatus} label={dayVisualStatusConfig[visualStatus].label} />
      </Section>

      <Section title="Comment je me sens" stepId="scores" renderEdit={renderEdit}>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {scoreDefinitions.map((definition) => (
            <li key={definition.key} className="grid gap-0.5 rounded-xl bg-muted/60 px-3 py-2.5">
              <span className="text-xs text-muted-foreground">{definition.label}</span>
              <span className="font-semibold">
                {checkin[definition.key] ?? "–"}
                <span className="text-xs font-normal text-muted-foreground"> / {definition.max}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {show.emotions ? (
        <Section title="Émotions" stepId="emotions" renderEdit={renderEdit}>
          <List items={checkin.emotions} empty="Aucune émotion notée." />
        </Section>
      ) : null}

      {show.triggers ? (
        <Section title="Déclencheurs" stepId="triggers" renderEdit={renderEdit}>
          <List items={checkin.triggers} empty="Aucun déclencheur particulier." />
        </Section>
      ) : null}

      {checkin.status === "consumed" ? (
        <Section title={hideEmpty ? "Consommation enregistrée" : "Consommation"} stepId="consumption" renderEdit={renderEdit}>
          <ul className="grid gap-2.5">
            {checkin.consumptionEvents.map((event) => (
              <EventDetails key={event.key} event={event} />
            ))}
          </ul>
        </Section>
      ) : null}

      {show.achievements ? (
      <Section title="Mes actions et victoires" stepId="achievements" renderEdit={renderEdit}>
        <div className="grid gap-2">
          {!hideEmpty || checkin.achievements.length > 0 ? (
            <List items={checkin.achievements} empty="Aucune action cochée." />
          ) : null}
          {checkin.victoryText ? (
            <p className="whitespace-pre-line">
              <span className="text-sm text-muted-foreground">Ma victoire du jour : </span>
              {checkin.victoryText}
            </p>
          ) : null}
        </div>
      </Section>
      ) : null}

      {show.reflection ? (
        <Section title="Réflexion" stepId="reflection" renderEdit={renderEdit}>
          <Texts entries={reflections} />
        </Section>
      ) : null}
    </dl>
  );
}
