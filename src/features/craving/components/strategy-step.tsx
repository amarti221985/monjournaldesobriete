"use client";

import { Check, Star } from "lucide-react";
import { useState, useTransition } from "react";

import { FormField, getFieldControlProps } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { startInterventionAction } from "@/features/craving/actions";
import {
  CRAVING_DURATION_OPTIONS,
  CRAVING_TEXT_LIMITS,
  CUSTOM_STRATEGY,
  DEFAULT_CRAVING_DURATION,
  type CravingDurationOption,
} from "@/features/craving/constants";
import { startInterventionSchema } from "@/features/craving/schemas";
import type { StrategyOption } from "@/features/plan/logic";
import { cn } from "@/lib/utils";

function durationLabel(duration: CravingDurationOption) {
  return duration === null ? "Sans minuteur" : `${duration} minutes`;
}

/** Carte sélectionnable (radio natif) : bordure, fond ET coche, jamais la couleur seule. */
function RadioCard({
  name,
  value,
  checked,
  onSelect,
  title,
  description,
  favorite = false,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  description?: string | null;
  favorite?: boolean;
}) {
  return (
    <label
      className={cn(
        "group relative flex min-h-14 cursor-pointer flex-col gap-1 rounded-xl border bg-card p-4 pr-10 transition-colors",
        "hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-secondary",
        "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 motion-reduce:transition-none",
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onSelect} className="sr-only" />
      <span className="flex items-center gap-1.5 font-medium">
        {favorite ? <Star className="size-3.5 fill-current text-primary" aria-hidden="true" /> : null}
        {title}
        {favorite ? <span className="sr-only"> (favori)</span> : null}
      </span>
      {description ? <span className="text-sm text-pretty text-muted-foreground">{description}</span> : null}
      <Check
        aria-hidden="true"
        strokeWidth={3}
        className="absolute top-4 right-4 hidden size-4 text-primary group-has-[:checked]:block"
      />
    </label>
  );
}

/**
 * Étape 2 « Choisis quelque chose à essayer ». « Tes stratégies » (celles de Mon plan,
 * favoris d'abord) puis « Autres stratégies » (catalogue). Une stratégie principale (V1),
 * puis une durée (celle du plan si elle existe, sinon 10 minutes ; jamais imposée).
 */
export function StrategyStep({
  eventId,
  options,
  onStarted,
}: {
  eventId: string;
  options: { yours: StrategyOption[]; others: StrategyOption[] };
  onStarted: () => void;
}) {
  const all = [...options.yours, ...options.others];
  const [isPending, startTransition] = useTransition();
  const [strategy, setStrategy] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [duration, setDuration] = useState<CravingDurationOption>(DEFAULT_CRAVING_DURATION);
  const [error, setError] = useState<string | null>(null);

  // Durée par défaut de la stratégie du plan, si elle fait partie des durées proposées.
  function select(option: StrategyOption) {
    setStrategy(option.key);
    const planned = option.defaultDurationMinutes;
    if (planned !== null && (CRAVING_DURATION_OPTIONS as readonly (number | null)[]).includes(planned)) {
      setDuration(planned as CravingDurationOption);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    if (!strategy) {
      setError("Choisis quelque chose que tu aimerais essayer.");
      document.getElementById("strategies")?.focus();
      return;
    }
    const option = all.find((item) => item.key === strategy);
    const parsed = startInterventionSchema.safeParse({
      strategySlug: strategy === CUSTOM_STRATEGY ? null : (option?.strategySlug ?? null),
      customStrategyText: strategy === CUSTOM_STRATEGY ? customText : (option?.customStrategyText ?? undefined),
      plannedDurationMinutes: duration,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Vérifie ta stratégie.");
      document.getElementById("customStrategy")?.focus();
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await startInterventionAction(eventId, parsed.data);
      if (result.status === "error") setError(result.message);
      else onStarted();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-7">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold">Choisis quelque chose à essayer</h2>
        <p className="text-sm text-pretty text-muted-foreground">
          Choisis quelque chose que tu aimerais essayer pendant quelques minutes.
        </p>
      </div>

      <fieldset id="strategies" tabIndex={-1} className="grid gap-3 outline-none">
        <legend className="mb-3 font-medium">Qu&apos;aimerais-tu essayer maintenant ?</legend>
        {options.yours.length > 0 ? (
          <div className="grid gap-2.5">
            <h3 className="text-sm font-medium text-muted-foreground">Tes stratégies</h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {options.yours.map((item) => (
                <RadioCard
                  key={item.key}
                  name="strategy"
                  value={item.key}
                  checked={strategy === item.key}
                  onSelect={() => select(item)}
                  title={item.title}
                  description={item.description}
                  favorite={item.isFavorite}
                />
              ))}
            </div>
            <h3 className="mt-3 text-sm font-medium text-muted-foreground">Autres stratégies</h3>
          </div>
        ) : null}
        <div className="grid gap-2.5 sm:grid-cols-2">
          {options.others.map((item) => (
            <RadioCard
              key={item.key}
              name="strategy"
              value={item.key}
              checked={strategy === item.key}
              onSelect={() => select(item)}
              title={item.title}
              description={item.description}
            />
          ))}
          <RadioCard
            name="strategy"
            value={CUSTOM_STRATEGY}
            checked={strategy === CUSTOM_STRATEGY}
            onSelect={() => setStrategy(CUSTOM_STRATEGY)}
            title="Ma propre stratégie"
            description="Quelque chose qui te ressemble."
          />
        </div>
      </fieldset>

      {strategy === CUSTOM_STRATEGY ? (
        <FormField id="customStrategy" label="Quelle stratégie veux-tu essayer ?">
          <Textarea
            {...getFieldControlProps("customStrategy", {})}
            value={customText}
            onChange={(event) => setCustomText(event.target.value)}
            maxLength={CRAVING_TEXT_LIMITS.customStrategyText}
            rows={2}
            className="min-h-20 bg-card px-3.5 py-3"
          />
        </FormField>
      ) : null}

      <fieldset className="grid gap-3">
        <legend className="mb-3 font-medium">Combien de temps veux-tu essayer ?</legend>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {CRAVING_DURATION_OPTIONS.map((option) => (
            <RadioCard
              key={String(option)}
              name="duration"
              value={String(option)}
              checked={duration === option}
              onSelect={() => setDuration(option)}
              title={durationLabel(option)}
            />
          ))}
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto sm:justify-self-start">
        {isPending ? "Enregistrement…" : "Commencer"}
      </Button>
    </form>
  );
}
