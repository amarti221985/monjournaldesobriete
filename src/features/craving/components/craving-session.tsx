"use client";

import { ArrowLeft, NotebookPen, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { dismissCravingEventAction, startFollowUpCravingAction } from "@/features/craving/actions";
import { ActiveStep } from "@/features/craving/components/active-step";
import { ReevaluateStep } from "@/features/craving/components/reevaluate-step";
import { StrategyStep } from "@/features/craving/components/strategy-step";
import {
  LetterPanel,
  PersonalReasons,
  ReminderPanel,
  SafePlacesPanel,
  SupportContacts,
  type SupportContactView,
} from "@/features/craving/components/support-panel";
import {
  describeCravingResult,
  formatMeasuredDuration,
  formatCravingDelta,
  getCravingChange,
  getCravingPhase,
} from "@/features/craving/logic";
import { groupCravingStrategies, type PlanPlace, type PlanStrategy } from "@/features/plan/logic";
import type { CravingEventDetail, CravingStrategy } from "@/lib/services/craving";

type CravingSessionProps = {
  event: CravingEventDetail;
  strategies: CravingStrategy[];
  contacts: SupportContactView[];
  reason: string | null;
  motivations: string[];
  /** Éléments de « Mon plan » utiles pendant une intervention (Sprint 8) */
  plan: {
    strategies: PlanStrategy[];
    places: PlanPlace[];
    reminder: string | null;
    letter: { title: string | null; content: string } | null;
  };
  /** Horloge serveur au rendu (ms) : corrige l'écart avec l'horloge de l'appareil. */
  serverNow: number;
};

function strategyTitle(event: CravingEventDetail) {
  return event.intervention?.strategyName ?? event.intervention?.customStrategyText ?? "Ta stratégie";
}

/**
 * Intervention d'un moment d'envie : l'étape affichée est dérivée de l'état enregistré
 * (reprise fiable après rafraîchissement). Chaque étape est persistée par une RPC,
 * puis la page est relue depuis la base.
 */
export function CravingSession({ event, strategies, contacts, reason, motivations, plan, serverNow }: CravingSessionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [endedLocally, setEndedLocally] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clockOffsetMs] = useState(() => serverNow - Date.now());
  const followUpId = useRef<string | null>(null);

  let phase = getCravingPhase(event);
  if (phase === "active" && endedLocally) phase = "reevaluate";

  // Focus sur le titre de la réévaluation quand elle apparaît.
  useEffect(() => {
    if (phase === "reevaluate") document.getElementById("reevaluate-title")?.focus();
  }, [phase]);

  const refresh = () => router.refresh();
  const strategyDescription = strategies.find((item) => item.slug === event.intervention?.strategySlug)?.description ?? null;

  // Actions secondaires, repliées : rien n'est affiché d'emblée pour ne pas surcharger le moment.
  const support = (
    <div className="grid gap-3" aria-label="Ce qui peut m'aider maintenant" role="group">
      {plan.reminder ? <ReminderPanel reminder={plan.reminder} /> : null}
      <PersonalReasons reason={reason} motivations={motivations} />
      <SupportContacts contacts={contacts} />
      <SafePlacesPanel places={plan.places} />
      {plan.letter ? <LetterPanel letter={plan.letter} /> : null}
    </div>
  );

  if (phase === "strategy") {
    return (
      <StrategyStep
        eventId={event.id}
        options={groupCravingStrategies(plan.strategies, strategies)}
        onStarted={refresh}
      />
    );
  }

  if (phase === "active" && event.intervention) {
    return (
      <ActiveStep
        eventId={event.id}
        strategyTitle={strategyTitle(event)}
        strategyDescription={strategyDescription}
        snapshot={{
          startedAt: event.intervention.startedAt,
          pausedAt: event.intervention.pausedAt,
          pausedSeconds: event.intervention.pausedSeconds,
          plannedMinutes: event.intervention.plannedMinutes,
        }}
        clockOffsetMs={clockOffsetMs}
        onEnded={() => {
          setEndedLocally(true);
          refresh();
        }}
      >
        {support}
      </ActiveStep>
    );
  }

  if (phase === "reevaluate") {
    return <ReevaluateStep eventId={event.id} initialScore={event.initial} onCompleted={refresh} headingId="reevaluate-title" />;
  }

  if (phase === "closed") {
    return (
      <div className="grid gap-4 rounded-2xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Ce moment n&apos;est plus en cours</h2>
        <p className="text-pretty text-muted-foreground">
          Il reste enregistré, sans compter dans tes analyses. Tu peux noter un nouveau moment quand tu veux.
        </p>
        <Button asChild size="lg" className="w-full sm:w-auto sm:justify-self-start">
          <Link href={routes.craving}>Noter un nouveau moment</Link>
        </Button>
      </div>
    );
  }

  // Moment enregistré -----------------------------------------------------------------
  const final = event.final ?? event.initial;
  const change = getCravingChange(event.initial, final);

  const tryAnother = () => {
    followUpId.current ??= crypto.randomUUID();
    startTransition(async () => {
      const result = await startFollowUpCravingAction(event.id, followUpId.current);
      if (result.status === "error") setError(result.message);
      else router.push(`${routes.craving}/${result.eventId}`);
    });
  };

  return (
    <section aria-labelledby="done-title" className="grid gap-6">
      <div className="grid gap-4 rounded-2xl border bg-card p-6">
        <h2 id="done-title" className="text-lg font-semibold">
          Moment enregistré
        </h2>
        <p className="text-pretty">{describeCravingResult(event.initial, final)}</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground">Envie</dt>
            <dd className="font-medium">
              {event.initial} → {final} ({formatCravingDelta(event.initial, final)})
            </dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground">Stratégie</dt>
            <dd className="font-medium text-pretty">{event.intervention ? strategyTitle(event) : "Aucune"}</dd>
          </div>
          {event.intervention?.actualSeconds != null ? (
            <div className="grid gap-0.5">
              <dt className="text-muted-foreground">Durée</dt>
              <dd className="font-medium">{formatMeasuredDuration(event.intervention.actualSeconds)}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {change !== "decrease" ? (
        <div className="grid gap-3">
          <p className="text-pretty text-muted-foreground">Si tu le souhaites, tu peux :</p>
          <Button type="button" variant="outline" size="lg" disabled={isPending} onClick={tryAnother} className="w-full justify-start sm:w-auto sm:justify-self-start">
            <RefreshCw data-icon="inline-start" aria-hidden="true" />
            {isPending ? "Préparation…" : "Essayer une autre stratégie"}
          </Button>
          {support}
          {error ? (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 rounded-xl bg-muted/60 p-4 text-sm">
        <p className="text-pretty text-muted-foreground">
          Si tu as consommé et souhaites le noter, tu pourras l&apos;ajouter à ton check-in de la journée.
        </p>
        <Button asChild variant="outline" size="sm" className="min-h-10 justify-self-start">
          <Link href={routes.checkin}>
            <NotebookPen data-icon="inline-start" aria-hidden="true" />
            Ouvrir mon check-in
          </Link>
        </Button>
      </div>

      <Button asChild size="lg" className="w-full sm:w-auto sm:justify-self-start">
        <Link href={routes.today}>
          <ArrowLeft data-icon="inline-start" aria-hidden="true" />
          Retour à aujourd&apos;hui
        </Link>
      </Button>
    </section>
  );
}

/** « Ne pas continuer ce moment » (bandeau de reprise sur /craving). */
export function DismissCravingButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await dismissCravingEventAction(eventId);
          router.refresh();
        })
      }
    >
      {isPending ? "Un instant…" : "Ne pas continuer ce moment"}
    </Button>
  );
}
