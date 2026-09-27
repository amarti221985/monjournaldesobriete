"use client";

import { Pause, Play, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { updateTimerAction } from "@/features/craving/actions";
import { formatCountdown, getTimerState, type TimerSnapshot } from "@/features/craving/logic";

type ActiveStepProps = {
  eventId: string;
  strategyTitle: string;
  strategyDescription: string | null;
  snapshot: TimerSnapshot;
  /** Écart horloge serveur − horloge de l'appareil (ms), pour un décompte juste. */
  clockOffsetMs: number;
  /** Fin de l'intervention (minuteur écoulé, « Terminer maintenant » ou « Réévaluer »). */
  onEnded: () => void;
  children?: React.ReactNode;
};

/** Annonce lecteur d'écran seulement aux moments importants (jamais chaque seconde). */
function announcementFor(remaining: number | null, paused: boolean): string {
  if (paused) return "Minuteur en pause.";
  if (remaining === null) return "";
  if (remaining === 0) return "Le temps est écoulé.";
  const minutes = Math.ceil(remaining / 60);
  return `Il reste environ ${minutes} minute${minutes > 1 ? "s" : ""}.`;
}

/**
 * Étape 3 « Prends quelques minutes pour toi ». Le minuteur est recalculé à partir des
 * horodatages persistés (début, pauses) : rafraîchir, changer d'onglet ou mettre
 * l'appareil en veille ne le perd pas. Aucune alarme à la fin.
 */
export function ActiveStep({
  eventId,
  strategyTitle,
  strategyDescription,
  snapshot: initialSnapshot,
  clockOffsetMs,
  onEnded,
  children,
}: ActiveStepProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [now, setNow] = useState(() => Date.now() + clockOffsetMs);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const endRequested = useRef(false);

  const state = getTimerState(snapshot, now);
  const hasTimer = snapshot.plannedMinutes !== null;

  // Rafraîchit l'affichage ; la valeur vient toujours des horodatages.
  useEffect(() => {
    if (!hasTimer || state.paused) return;
    const id = window.setInterval(() => setNow(Date.now() + clockOffsetMs), 1000);
    const onVisible = () => setNow(Date.now() + clockOffsetMs);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hasTimer, state.paused, clockOffsetMs]);

  // Protégée par endRequested : un seul appel même si l'effet se relance.
  const end = useCallback(() => {
    if (endRequested.current) return;
    endRequested.current = true;
    startTransition(async () => {
      const result = await updateTimerAction(eventId, "end");
      if (result.status === "error") {
        endRequested.current = false;
        setError(result.message);
        return;
      }
      onEnded();
    });
  }, [eventId, onEnded]);

  // Minuteur écoulé : passage calme à la réévaluation (idempotent côté serveur).
  useEffect(() => {
    if (state.expired) end();
  }, [state.expired, end]);

  const togglePause = () => {
    startTransition(async () => {
      const result = await updateTimerAction(eventId, state.paused ? "resume" : "pause");
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setError(null);
      setSnapshot((current) => ({ ...current, pausedAt: result.timer.pausedAt, pausedSeconds: result.timer.pausedSeconds }));
      setNow(Date.now() + clockOffsetMs);
    });
  };

  // Annonce limitée aux changements de minute, de pause ou de fin.
  const announcement = announcementFor(
    state.remainingSeconds === null ? null : Math.ceil(state.remainingSeconds / 60) * 60,
    state.paused,
  );

  return (
    <section aria-labelledby="active-title" className="grid gap-6">
      <div className="grid gap-1">
        <h2 id="active-title" className="text-lg font-semibold">
          {hasTimer ? `Prends ces ${snapshot.plannedMinutes} minutes pour toi` : "Prends quelques minutes pour toi"}
        </h2>
        <p className="text-pretty">
          <span className="font-medium">{strategyTitle}</span>
          {strategyDescription ? <span className="text-muted-foreground"> — {strategyDescription}</span> : null}
        </p>
      </div>

      {hasTimer ? (
        <div className="grid justify-items-center gap-4 rounded-2xl border bg-card p-6">
          <p role="timer" aria-live="off" aria-label="Temps restant" className="text-6xl font-semibold tracking-tight tabular-nums">
            {formatCountdown(state.remainingSeconds ?? 0)}
          </p>
          {state.paused ? <p className="text-sm text-muted-foreground">En pause</p> : null}
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button type="button" variant="outline" size="lg" disabled={isPending || state.expired} onClick={togglePause}>
              {state.paused ? <Play data-icon="inline-start" aria-hidden="true" /> : <Pause data-icon="inline-start" aria-hidden="true" />}
              {state.paused ? "Reprendre" : "Pause"}
            </Button>
            <Button type="button" size="lg" disabled={isPending} onClick={end}>
              <Square data-icon="inline-start" aria-hidden="true" />
              Terminer maintenant
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 rounded-2xl border bg-card p-6">
          <p className="text-pretty">
            Prends le temps dont tu as besoin. Reviens ici quand tu souhaites réévaluer ton envie.
          </p>
          <Button type="button" size="lg" disabled={isPending} onClick={end} className="w-full sm:w-auto sm:justify-self-start">
            Réévaluer mon envie
          </Button>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {children}
    </section>
  );
}
