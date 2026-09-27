"use client";

import { Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  deleteAiReflectionAction,
  deleteAllAiReflectionsAction,
  generateWeeklyInsightAction,
  updateAiPreferencesAction,
  type InsightActionState,
} from "@/features/insights/actions";
import type { AiPreferences } from "@/lib/ai/privacy";

type Options = Pick<AiPreferences, "includeReflections" | "includeConsumptionContext" | "includeCravingContext">;

const OPTION_LABELS: { key: keyof Options; label: string; hint: string }[] = [
  { key: "includeReflections", label: "Mes réflexions", hint: "Victoires, fiertés, leçons et intentions (jamais tes notes libres)." },
  { key: "includeConsumptionContext", label: "Le contexte de mes consommations", hint: "Textes que tu as écrits sur tes consommations." },
  { key: "includeCravingContext", label: "Le contexte de mes moments d'envie", hint: "Contexte, « ce qui m'a aidé » et notes de tes interventions." },
];

function useInsightAction() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<InsightActionState | null>(null);
  const run = (action: () => Promise<InsightActionState>, onSuccess?: () => void) =>
    startTransition(async () => {
      const result = await action();
      setState(result);
      if (result.status === "ok") {
        onSuccess?.();
        router.refresh();
      }
    });
  return { isPending, state, run };
}

function Feedback({ state }: { state: InsightActionState | null }) {
  if (!state) return null;
  if (state.status === "error") return <FormAlert tone="error" message={state.message} />;
  return state.message ? <FormAlert tone="success" message={state.message} /> : null;
}

function OptionCheckboxes({ options, onChange }: { options: Options; onChange: (options: Options) => void }) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-2 text-sm font-medium">Données que tu autorises (en plus des statistiques)</legend>
      {OPTION_LABELS.map((option) => (
        <label key={option.key} className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={options[option.key]}
            onChange={(event) => onChange({ ...options, [option.key]: event.target.checked })}
            className="mt-0.5 size-4 accent-primary"
          />
          <span className="grid gap-0.5">
            <span className="font-medium">{option.label}</span>
            <span className="text-muted-foreground">{option.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * Écran de consentement (opt-in, ADR-082) : explique les données utilisées, celles qui ne
 * sont jamais envoyées, les limites de l'IA ; rien n'est activé sans « Activer ».
 */
export function AiConsentPanel({ preferences, providerLabel }: { preferences: AiPreferences; providerLabel: string }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Options>({
    includeReflections: preferences.includeReflections,
    includeConsumptionContext: preferences.includeConsumptionContext,
    includeCravingContext: preferences.includeCravingContext,
  });
  const { isPending, state, run } = useInsightAction();

  if (!open) {
    return (
      <Button type="button" className="justify-self-start" onClick={() => setOpen(true)}>
        <Sparkles data-icon="inline-start" aria-hidden="true" />
        Activer les bilans intelligents
      </Button>
    );
  }

  return (
    <section aria-labelledby="consent-title" className="grid gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <h2 id="consent-title" className="text-base font-semibold">
        Bilans intelligents
      </h2>
      <p className="text-sm text-pretty">
        Pour créer un bilan personnalisé, certaines données de ton journal doivent être analysées par un service
        d&apos;intelligence artificielle ({providerLabel}). Cela se fait seulement quand tu cliques sur « Générer mon bilan ».
      </p>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="grid gap-1">
          <h3 className="font-medium">Peuvent être utilisées</h3>
          <ul className="grid list-disc gap-0.5 pl-5 text-muted-foreground">
            <li>tes statistiques de la semaine (calculées par l&apos;application) ;</li>
            <li>les émotions, déclencheurs, accomplissements et stratégies enregistrés ;</li>
            <li>les textes des catégories que tu choisis ci-dessous.</li>
          </ul>
        </div>
        <div className="grid gap-1">
          <h3 className="font-medium">Ne sont jamais envoyés</h3>
          <ul className="grid list-disc gap-0.5 pl-5 text-muted-foreground">
            <li>ton courriel et ton nom ;</li>
            <li>tes personnes de soutien ;</li>
            <li>ta lettre à toi-même, tes lieux sûrs, ton rappel et ta raison ;</li>
            <li>tes notes libres et tes identifiants.</li>
          </ul>
        </div>
      </div>
      <OptionCheckboxes options={options} onChange={setOptions} />
      <ul className="grid list-disc gap-0.5 pl-5 text-sm text-muted-foreground">
        <li>Tu peux désactiver la fonctionnalité et supprimer tes bilans à tout moment.</li>
        <li>L&apos;IA peut faire des erreurs. Un bilan est un outil de réflexion, pas un avis médical.</li>
      </ul>
      <Feedback state={state} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          disabled={isPending}
          onClick={() => run(() => updateAiPreferencesAction({ aiEnabled: true, consentAcknowledged: true, ...options }))}
        >
          {isPending ? "Activation…" : "Activer"}
        </Button>
        <Button type="button" variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
          Pas maintenant
        </Button>
      </div>
    </section>
  );
}

/** Préférences une fois activé : catégories, désactivation, suppression des bilans. */
export function AiPreferencesForm({ preferences, hasReflections }: { preferences: AiPreferences; hasReflections: boolean }) {
  const [options, setOptions] = useState<Options>({
    includeReflections: preferences.includeReflections,
    includeConsumptionContext: preferences.includeConsumptionContext,
    includeCravingContext: preferences.includeCravingContext,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { isPending, state, run } = useInsightAction();

  return (
    <div className="grid gap-4">
      <p className="text-sm">
        Bilans intelligents : <span className="font-medium">activés</span>
        {preferences.consentedAt ? (
          <span className="text-muted-foreground"> (consentement du {new Date(preferences.consentedAt).toLocaleDateString("fr-CA")})</span>
        ) : null}
      </p>
      <OptionCheckboxes options={options} onChange={setOptions} />
      <Feedback state={state} />
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" disabled={isPending} onClick={() => run(() => updateAiPreferencesAction({ aiEnabled: true, ...options }))}>
          Enregistrer
        </Button>
        <Button type="button" variant="outline" disabled={isPending} onClick={() => run(() => updateAiPreferencesAction({ aiEnabled: false, ...options }))}>
          Désactiver les bilans intelligents
        </Button>
        {hasReflections ? (
          <Button type="button" variant="ghost" disabled={isPending} onClick={() => setConfirmDelete(true)}>
            <Trash2 data-icon="inline-start" aria-hidden="true" />
            Supprimer mes bilans IA
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">Désactiver empêche toute nouvelle génération ; tes bilans existants sont conservés tant que tu ne les supprimes pas.</p>
      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer tous tes bilans intelligents ?"
        description="Ils seront définitivement effacés. Ton journal et tes données ne sont pas touchés."
        confirmLabel="Supprimer"
        pending={isPending}
        onConfirm={() => {
          setConfirmDelete(false);
          run(() => deleteAllAiReflectionsAction());
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

/** « Générer mon bilan » / « Régénérer » : état de chargement simple, sans faux pourcentage. */
export function GenerateReflectionButton({ regenerate }: { regenerate: boolean }) {
  const { isPending, state, run } = useInsightAction();
  return (
    <div className="grid gap-3">
      <Button type="button" size="lg" disabled={isPending} className="justify-self-start" onClick={() => run(() => generateWeeklyInsightAction())}>
        <Sparkles data-icon="inline-start" aria-hidden="true" />
        {isPending ? "Création de ton bilan…" : regenerate ? "Régénérer mon bilan" : "Générer mon bilan"}
      </Button>
      <p aria-live="polite" className="sr-only">
        {isPending ? "Création de ton bilan en cours." : ""}
      </p>
      {regenerate && !isPending ? (
        <p className="text-xs text-muted-foreground">Régénérer remplace le bilan de cette période.</p>
      ) : null}
      <Feedback state={state} />
    </div>
  );
}

export function DeleteReflectionButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const { isPending, state, run } = useInsightAction();
  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Trash2 data-icon="inline-start" aria-hidden="true" />
        Supprimer ce bilan
      </Button>
      {state?.status === "error" ? <FormAlert tone="error" message={state.message} /> : null}
      <ConfirmDialog
        open={open}
        title="Supprimer ce bilan ?"
        description="Il sera définitivement effacé."
        confirmLabel="Supprimer"
        pending={isPending}
        onConfirm={() => {
          setOpen(false);
          run(() => deleteAiReflectionAction(id));
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
