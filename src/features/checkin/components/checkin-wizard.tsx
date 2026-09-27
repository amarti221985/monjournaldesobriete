"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { routes } from "@/config/routes";
import { useAchievementNotifier } from "@/features/achievements/components/achievement-notifier";
import {
  completeCheckinAction,
  saveCheckinDraftAction,
  type SaveCheckinState,
} from "@/features/checkin/actions";
import { CheckinComplete } from "@/features/checkin/components/checkin-complete";
import { CheckinSummaryView } from "@/features/checkin/components/checkin-summary-view";
import { checkinStepContent } from "@/features/checkin/components/step-content";
import {
  AchievementsStep,
  ConsumptionStep,
  EmotionsStep,
  ReflectionStep,
  ScoresStep,
  StatusStep,
  TriggersStep,
} from "@/features/checkin/components/steps";
import { CHECKIN_SAVE_ERROR, checkinSteps, type CheckinStatus, type CheckinStepId } from "@/features/checkin/constants";
import { draftToDisplay } from "@/features/checkin/display";
import {
  buildCheckinPayload,
  createEmptyEvent,
  getCheckinSteps,
  statusChangeDropsEvents,
  validateCheckinStep,
  type CheckinDraft,
  type StepErrors,
} from "@/features/checkin/logic";
import type { CheckinCatalogues } from "@/lib/services/checkins";
import { formatWeekdayDate } from "@/lib/dates";

type CheckinWizardProps = {
  /** Journée locale fixée à l'ouverture : ne change jamais pendant le wizard (minuit). */
  checkinDate: string;
  /** « create » : nouveau check-in ou brouillon repris ; « edit » : check-in terminé modifié. */
  mode: "create" | "edit";
  initialDraft: CheckinDraft;
  initialStepIndex: number;
  catalogues: CheckinCatalogues;
  substances: { id: string; name: string }[];
  /**
   * Modification d'une journée passée : page de retour (/journal/[date]) après
   * l'enregistrement ou l'annulation. Par défaut : /today.
   */
  returnHref?: string;
};

type SaveStatus = "idle" | "saved" | "failed";

/** Sauvegarde automatique du brouillon après une pause de saisie (évite de perdre un texte en cours). */
const AUTOSAVE_DELAY_MS = 1500;

const stepTitles = Object.fromEntries(checkinSteps.map((step) => [step.id, step.title])) as Record<
  CheckinStepId,
  string
>;

export function CheckinWizard({
  checkinDate,
  mode,
  initialDraft,
  initialStepIndex,
  catalogues,
  substances,
  returnHref,
}: CheckinWizardProps) {
  const router = useRouter();
  const notifyAchievements = useAchievementNotifier();
  const [draft, setDraft] = useState<CheckinDraft>(initialDraft);
  const [stepIndex, setStepIndex] = useState(initialStepIndex);
  const [errors, setErrors] = useState<StepErrors>({});
  const [returnToSummary, setReturnToSummary] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [result, setResult] = useState<SaveCheckinState | null>(null);
  const [pendingStatus, setPendingStatus] = useState<CheckinStatus | null>(null);
  const [isSubmitting, startSubmitting] = useTransition();
  const [isLeaving, startLeaving] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasNavigated = useRef(false);
  const pendingErrorFocus = useRef<string | null>(null);
  const hasUnsavedChanges = useRef(false);

  const steps = getCheckinSteps(draft.status);
  const safeIndex = Math.min(stepIndex, steps.length - 1);
  const stepId = steps[safeIndex];
  const content = checkinStepContent[stepId];
  const isCompleted = result?.status === "completed";

  useEffect(() => {
    if (!hasNavigated.current) return;
    headingRef.current?.focus();
  }, [safeIndex, stepId, isCompleted]);

  useEffect(() => {
    if (!pendingErrorFocus.current) return;
    document.getElementById(pendingErrorFocus.current)?.focus();
    pendingErrorFocus.current = null;
  }, [errors]);

  // Brouillon enregistré après une pause de saisie, sans attendre « Continuer » : un texte en
  // cours n'est pas perdu si la page est rechargée ou fermée. Jamais en modification ni après
  // l'envoi (la base refuse de toute façon un brouillon sur un check-in terminé).
  useEffect(() => {
    if (mode !== "create" || !draft.status || !hasUnsavedChanges.current || isCompleted || isSubmitting) return;
    const timer = window.setTimeout(() => {
      hasUnsavedChanges.current = false;
      saveCheckinDraftAction(buildCheckinPayload(draft, checkinDate))
        .then((state) => setSaveStatus(state.status === "saved" ? "saved" : "failed"))
        .catch(() => setSaveStatus("failed"));
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, mode, checkinDate, isCompleted, isSubmitting]);

  function update(patch: Partial<CheckinDraft>) {
    hasUnsavedChanges.current = true;
    setDraft((current) => ({ ...current, ...patch }));
    setErrors({});
  }

  function handleStatusChange(status: CheckinStatus) {
    if (statusChangeDropsEvents(draft, status)) {
      setPendingStatus(status);
      return;
    }
    update({ status });
  }

  function addEvent(userSubstanceId: string) {
    update({ consumptionEvents: [...draft.consumptionEvents, createEmptyEvent(crypto.randomUUID(), userSubstanceId)] });
  }

  function goTo(index: number) {
    hasNavigated.current = true;
    setErrors({});
    setStepIndex(index);
    window.scrollTo({ top: 0 });
  }

  function showErrors(stepErrors: StepErrors) {
    pendingErrorFocus.current = Object.keys(stepErrors)[0] ?? null;
    setErrors(stepErrors);
  }

  /** Brouillon serveur : seulement pour un check-in non terminé (jamais en modification). */
  function persistDraft(nextDraft: CheckinDraft) {
    if (mode !== "create") return;
    hasUnsavedChanges.current = false;
    saveCheckinDraftAction(buildCheckinPayload(nextDraft, checkinDate))
      .then((state) => setSaveStatus(state.status === "saved" ? "saved" : "failed"))
      .catch(() => setSaveStatus("failed"));
  }

  function nextIndexAfter(currentStep: CheckinStepId): number {
    const summaryIndex = steps.length - 1;
    if (!returnToSummary) return safeIndex + 1;
    // Après « Modifier » : retour au résumé, sauf si une consommation reste à préciser.
    const consumptionIndex = steps.indexOf("consumption");
    if (
      currentStep === "status" &&
      consumptionIndex >= 0 &&
      Object.keys(validateCheckinStep("consumption", draft)).length > 0
    ) {
      return consumptionIndex;
    }
    setReturnToSummary(false);
    return summaryIndex;
  }

  function handleContinue() {
    const stepErrors = validateCheckinStep(stepId, draft);
    if (Object.keys(stepErrors).length > 0) {
      showErrors(stepErrors);
      return;
    }
    goTo(nextIndexAfter(stepId));
    persistDraft(draft);
  }

  function handleBack() {
    setReturnToSummary(false);
    goTo(safeIndex - 1);
  }

  function handleEdit(targetStep: CheckinStepId) {
    setReturnToSummary(true);
    goTo(steps.indexOf(targetStep));
  }

  function handleSubmit() {
    const stepErrors = validateCheckinStep("summary", draft);
    if (Object.keys(stepErrors).length > 0) {
      showErrors(stepErrors);
      return;
    }
    startSubmitting(async () => {
      try {
        const state = await completeCheckinAction(buildCheckinPayload(draft, checkinDate));
        if (state.status === "completed") notifyAchievements(state.achievements);
        if (state.status === "completed" && returnHref) {
          // Journée historique : retour au détail, qui relit les données enregistrées.
          router.replace(returnHref);
          router.refresh();
          return;
        }
        if (state.status === "completed") hasNavigated.current = true;
        setResult(state);
      } catch {
        setResult({ status: "error", message: CHECKIN_SAVE_ERROR });
      }
    });
  }

  function handleLeave() {
    startLeaving(async () => {
      if (mode === "create" && draft.status) {
        await saveCheckinDraftAction(buildCheckinPayload(draft, checkinDate)).catch(() => null);
      }
      router.push(routes.today);
    });
  }

  const display = draftToDisplay(draft, catalogues, substances);

  if (isCompleted && display) {
    return <CheckinComplete headingRef={headingRef} checkin={display} mode={mode} />;
  }

  const isFirst = safeIndex === 0;
  const isSummary = stepId === "summary";
  const submitError = result?.status === "error" ? result.message : null;
  const stepNumber = safeIndex + 1;

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <p className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-medium">
            Étape {stepNumber} sur {steps.length}
          </span>
          <span className="truncate text-muted-foreground">{stepTitles[stepId]}</span>
        </p>
        <Progress
          value={(stepNumber / steps.length) * 100}
          aria-label={`Progression : étape ${stepNumber} sur ${steps.length}`}
          className="h-1.5"
        />
      </div>

      <section
        aria-labelledby="checkin-step-title"
        className="grid gap-6 sm:rounded-2xl sm:border sm:bg-card sm:p-8 sm:shadow-sm"
      >
        <header className="grid gap-1.5">
          <p className="text-sm text-muted-foreground first-letter:uppercase">{formatWeekdayDate(checkinDate)}</p>
          <h1
            id="checkin-step-title"
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight text-balance outline-none sm:text-3xl"
          >
            {content.heading}
          </h1>
          {content.description ? <p className="text-pretty text-muted-foreground">{content.description}</p> : null}
        </header>

        <div key={stepId} className="animate-in fade-in-0 duration-200">
          {stepId === "status" ? (
            <StatusStep draft={draft} onChange={update} errors={errors} onStatusChange={handleStatusChange} />
          ) : null}
          {stepId === "scores" ? <ScoresStep draft={draft} onChange={update} errors={errors} /> : null}
          {stepId === "emotions" ? (
            <EmotionsStep draft={draft} onChange={update} errors={errors} emotions={catalogues.emotions} />
          ) : null}
          {stepId === "triggers" ? (
            <TriggersStep draft={draft} onChange={update} errors={errors} triggers={catalogues.triggers} />
          ) : null}
          {stepId === "consumption" ? (
            <ConsumptionStep
              draft={draft}
              onChange={update}
              errors={errors}
              substances={substances}
              onAddEvent={addEvent}
            />
          ) : null}
          {stepId === "achievements" ? (
            <AchievementsStep draft={draft} onChange={update} errors={errors} achievements={catalogues.achievements} />
          ) : null}
          {stepId === "reflection" ? <ReflectionStep draft={draft} onChange={update} errors={errors} /> : null}
          {isSummary && display ? (
            <CheckinSummaryView
              checkin={display}
              renderEdit={(target, title) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-mr-2 text-primary"
                  onClick={() => handleEdit(target)}
                  aria-label={`Modifier : ${title}`}
                >
                  Modifier
                </Button>
              )}
            />
          ) : null}
        </div>

        {errors.form ? <FormAlert tone="error" message={errors.form} /> : null}
        {submitError ? <FormAlert tone="error" message={submitError} /> : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {!isFirst ? (
            <Button type="button" variant="ghost" size="lg" onClick={handleBack} disabled={isSubmitting}>
              <ArrowLeft data-icon="inline-start" aria-hidden="true" />
              Retour
            </Button>
          ) : (
            <span aria-hidden="true" />
          )}

          {isSummary ? (
            <SubmitButton
              pending={isSubmitting}
              pendingLabel="Enregistrement…"
              onClick={handleSubmit}
              className="w-full sm:w-auto"
            >
              {submitError ? "Réessayer" : mode === "edit" ? "Enregistrer les modifications" : "Enregistrer ma journée"}
            </SubmitButton>
          ) : (
            <Button type="button" size="lg" onClick={handleContinue} className="w-full sm:w-auto">
              {returnToSummary ? "Revenir au résumé" : "Continuer"}
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Button>
          )}
        </div>
      </section>

      <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
        {mode === "create" ? (
          <Button type="button" variant="link" onClick={handleLeave} disabled={isLeaving || isSubmitting}>
            {isLeaving ? "Enregistrement…" : "Enregistrer et quitter"}
          </Button>
        ) : (
          <Button asChild variant="link">
            <Link href={returnHref ?? routes.today}>Annuler les modifications</Link>
          </Button>
        )}
        <p aria-live="polite" className="min-h-5 text-center">
          {saveStatus === "saved" ? "Tes réponses sont enregistrées." : null}
          {saveStatus === "failed"
            ? "Enregistrement automatique momentanément indisponible. Tes réponses restent sur cette page."
            : null}
        </p>
      </div>

      <ConfirmDialog
        open={pendingStatus !== null}
        title="Retirer les consommations notées?"
        description="Si tu indiques une journée sans consommation, les consommations déjà notées pour cette journée seront retirées."
        confirmLabel="Oui, les retirer"
        onCancel={() => setPendingStatus(null)}
        onConfirm={() => {
          if (pendingStatus) update({ status: pendingStatus, consumptionEvents: [] });
          setPendingStatus(null);
        }}
      />
    </div>
  );
}
