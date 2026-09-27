"use client";

import { useState, useTransition } from "react";

import { FormField, getFieldControlProps } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScoreScale } from "@/features/checkin/components/score-scale";
import { useAchievementNotifier } from "@/features/achievements/components/achievement-notifier";
import { completeCravingEventAction } from "@/features/craving/actions";
import { CRAVING_TEXT_LIMITS } from "@/features/craving/constants";
import { completeCravingSchema } from "@/features/craving/schemas";

/**
 * Étape 4 « Comment est ton envie maintenant ? ». Score final obligatoire ; notes
 * facultatives. En cas d'erreur, les réponses restent affichées.
 */
export function ReevaluateStep({
  eventId,
  initialScore,
  onCompleted,
  headingId,
}: {
  eventId: string;
  initialScore: number;
  onCompleted: () => void;
  headingId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const notifyAchievements = useAchievementNotifier();
  const [score, setScore] = useState<number | undefined>(undefined);
  const [helped, setHelped] = useState("");
  const [outcome, setOutcome] = useState("");
  const [scoreError, setScoreError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    const parsed = completeCravingSchema.safeParse({ finalCravingScore: score, helpedText: helped, outcomeText: outcome });
    if (!parsed.success) {
      if (score === undefined) {
        setScoreError("Choisis une valeur entre 0 et 10.");
        document.getElementById("finalCraving")?.focus();
      } else {
        setError("Certaines réponses sont trop longues.");
      }
      return;
    }
    setScoreError(undefined);
    setError(null);
    startTransition(async () => {
      const result = await completeCravingEventAction(eventId, parsed.data);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      notifyAchievements(result.achievements);
      onCompleted();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-7">
      <div className="grid gap-1">
        <h2 id={headingId} tabIndex={-1} className="text-lg font-semibold outline-none">
          Comment est ton envie maintenant ?
        </h2>
        <p className="text-sm text-muted-foreground">Au début, ton envie était à {initialScore}/10.</p>
      </div>

      <ScoreScale
        id="finalCraving"
        label="À combien est ton envie maintenant ?"
        min={0}
        max={10}
        minLabel="Aucune"
        maxLabel="Très forte"
        value={score}
        onChange={setScore}
        error={scoreError}
      />

      <FormField id="helped" label="Qu'est-ce qui t'a aidé ?" hint="Facultatif.">
        <Textarea
          {...getFieldControlProps("helped", { hint: "Facultatif." })}
          value={helped}
          onChange={(event) => setHelped(event.target.value)}
          maxLength={CRAVING_TEXT_LIMITS.helpedText}
          rows={2}
          className="min-h-20 bg-card px-3.5 py-3"
        />
      </FormField>

      <FormField id="outcome" label="Veux-tu retenir quelque chose de ce moment ?" hint="Facultatif.">
        <Textarea
          {...getFieldControlProps("outcome", { hint: "Facultatif." })}
          value={outcome}
          onChange={(event) => setOutcome(event.target.value)}
          maxLength={CRAVING_TEXT_LIMITS.outcomeText}
          rows={2}
          className="min-h-20 bg-card px-3.5 py-3"
        />
      </FormField>

      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto sm:justify-self-start">
        {isPending ? "Enregistrement…" : error ? "Réessayer" : "Terminer"}
      </Button>
    </form>
  );
}
