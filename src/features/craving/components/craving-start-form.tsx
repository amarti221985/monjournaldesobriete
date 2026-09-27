"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { FormField, getFieldControlProps } from "@/components/forms/form-field";
import { SelectableChip } from "@/components/forms/selectable-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { routes } from "@/config/routes";
import { OTHER_SLUG } from "@/features/checkin/constants";
import { ScoreScale } from "@/features/checkin/components/score-scale";
import { startCravingEventAction } from "@/features/craving/actions";
import { CRAVING_TEXT_LIMITS } from "@/features/craving/constants";
import { startCravingEventSchema } from "@/features/craving/schemas";

type Option = { slug: string; name: string };

type CravingStartFormProps = {
  substances: { id: string; name: string }[];
  emotions: (Option & { category: "positive" | "difficult" })[];
  triggers: Option[];
};

type Errors = Partial<Record<"score" | "substances" | "triggers" | "form", string>>;

/**
 * Étape 1 « Que se passe-t-il maintenant ? ». Les réponses restent affichées en cas
 * d'erreur réseau ; l'identifiant du moment est généré une seule fois (double clic et
 * nouvel essai sans doublon).
 */
export function CravingStartForm({ substances, emotions, triggers }: CravingStartFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const eventId = useRef<string | null>(null);

  const [score, setScore] = useState<number | undefined>(undefined);
  const [substanceIds, setSubstanceIds] = useState<string[]>(substances.length === 1 ? [substances[0].id] : []);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [otherLabel, setOtherLabel] = useState("");
  const [triggerUnknown, setTriggerUnknown] = useState(false);
  const [context, setContext] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const toggle = (list: string[], value: string, checked: boolean) =>
    checked ? [...list, value] : list.filter((item) => item !== value);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    eventId.current ??= crypto.randomUUID();
    const payload = {
      id: eventId.current,
      initialCravingScore: score,
      substanceIds,
      emotions: selectedEmotions,
      triggers: selectedTriggers.map((slug) => ({ slug, customLabel: slug === OTHER_SLUG ? otherLabel : undefined })),
      triggerUnknown,
      contextText: context,
    };

    const parsed = startCravingEventSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "initialCravingScore") next.score = "Choisis une valeur entre 0 et 10.";
        else if (field === "substanceIds") next.substances = "Choisis au moins une substance.";
        else if (field === "triggers") next.triggers = issue.message;
        else next.form = "Certaines réponses sont trop longues.";
      }
      setErrors(next);
      document.getElementById(next.score ? "initialCraving" : next.substances ? "substances" : "triggers")?.focus();
      return;
    }

    setErrors({});
    const id = eventId.current;
    startTransition(async () => {
      const result = await startCravingEventAction(parsed.data);
      if (result.status === "error") {
        setErrors({ form: result.message });
        return;
      }
      router.push(`${routes.craving}/${id}`);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-7">
      <h2 className="text-lg font-semibold">Que se passe-t-il maintenant ?</h2>

      <div className="grid gap-2">
        <ScoreScale
          id="initialCraving"
          label="À combien est ton envie en ce moment ?"
          min={0}
          max={10}
          minLabel="Aucune"
          maxLabel="Très forte"
          value={score}
          onChange={setScore}
          error={errors.score}
        />
        {score === 0 ? (
          <p className="text-sm text-pretty text-muted-foreground">
            Ton envie semble faible pour le moment. Tu peux quand même enregistrer ce moment si tu le souhaites.
          </p>
        ) : null}
      </div>

      <fieldset id="substances" tabIndex={-1} className="grid gap-3 outline-none" aria-describedby={errors.substances ? "substances-error" : undefined}>
        <legend className="mb-3 font-medium">Qu&apos;est-ce qui te donne envie de consommer ?</legend>
        <div className="flex flex-wrap gap-2">
          {substances.map((substance) => (
            <SelectableChip
              key={substance.id}
              name="substances"
              value={substance.id}
              label={substance.name}
              checked={substanceIds.includes(substance.id)}
              onCheckedChange={(checked) => setSubstanceIds((list) => toggle(list, substance.id, checked))}
            />
          ))}
        </div>
        {errors.substances ? (
          <p id="substances-error" className="text-sm font-medium text-destructive">{errors.substances}</p>
        ) : null}
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-1 font-medium">Qu&apos;est-ce que tu ressens ?</legend>
        <p className="mb-2 text-sm text-muted-foreground">Facultatif.</p>
        <div className="flex flex-wrap gap-2">
          {emotions.map((emotion) => (
            <SelectableChip
              key={emotion.slug}
              name="emotions"
              value={emotion.slug}
              label={emotion.name}
              checked={selectedEmotions.includes(emotion.slug)}
              onCheckedChange={(checked) => setSelectedEmotions((list) => toggle(list, emotion.slug, checked))}
            />
          ))}
        </div>
      </fieldset>

      <fieldset id="triggers" tabIndex={-1} className="grid gap-3 outline-none" aria-describedby={errors.triggers ? "triggers-error" : undefined}>
        <legend className="mb-1 font-medium">Qu&apos;est-ce qui semble avoir déclenché cette envie ?</legend>
        <p className="mb-2 text-sm text-muted-foreground">Facultatif. Tu n&apos;as pas besoin de trouver une explication.</p>
        <SelectableChip
          name="triggerUnknown"
          value="unknown"
          label="Je ne sais pas"
          checked={triggerUnknown}
          onCheckedChange={(checked) => {
            setTriggerUnknown(checked);
            if (checked) setSelectedTriggers([]);
          }}
          className="justify-self-start"
        />
        <div className="flex flex-wrap gap-2">
          {triggers.map((trigger) => (
            <SelectableChip
              key={trigger.slug}
              name="triggers"
              value={trigger.slug}
              label={trigger.name}
              checked={selectedTriggers.includes(trigger.slug)}
              onCheckedChange={(checked) => {
                setSelectedTriggers((list) => toggle(list, trigger.slug, checked));
                if (checked) setTriggerUnknown(false);
              }}
            />
          ))}
        </div>
        {selectedTriggers.includes(OTHER_SLUG) ? (
          <FormField id="triggerOther" label="Précise si tu le souhaites">
            <Input
              {...getFieldControlProps("triggerOther", {})}
              value={otherLabel}
              maxLength={CRAVING_TEXT_LIMITS.customLabel}
              autoComplete="off"
              onChange={(event) => setOtherLabel(event.target.value)}
            />
          </FormField>
        ) : null}
        {errors.triggers ? <p id="triggers-error" className="text-sm font-medium text-destructive">{errors.triggers}</p> : null}
      </fieldset>

      <FormField id="context" label="Que se passe-t-il en ce moment ?" hint="Facultatif.">
        <Textarea
          {...getFieldControlProps("context", { hint: "Facultatif." })}
          value={context}
          onChange={(event) => setContext(event.target.value)}
          maxLength={CRAVING_TEXT_LIMITS.contextText}
          rows={3}
          placeholder="Où es-tu? Que faisais-tu? Qu'est-ce qui s'est passé juste avant?"
          className="min-h-24 bg-card px-3.5 py-3"
        />
      </FormField>

      {errors.form ? (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {errors.form}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto sm:justify-self-start">
        {isPending ? "Enregistrement…" : errors.form ? "Réessayer" : "Continuer"}
      </Button>
    </form>
  );
}
