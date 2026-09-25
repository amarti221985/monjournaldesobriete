"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import {
  completeOnboardingAction,
  saveOnboardingDraftAction,
  type CompleteOnboardingState,
} from "@/features/onboarding/actions";
import { OnboardingComplete } from "@/features/onboarding/components/onboarding-complete";
import { OnboardingProgress } from "@/features/onboarding/components/onboarding-progress";
import { stepContent } from "@/features/onboarding/components/step-content";
import type { CatalogueOption } from "@/features/onboarding/components/step-types";
import { GoalsStep } from "@/features/onboarding/components/steps/goals-step";
import { MotivationsStep } from "@/features/onboarding/components/steps/motivations-step";
import { ReasonStep } from "@/features/onboarding/components/steps/reason-step";
import { StartStep } from "@/features/onboarding/components/steps/start-step";
import { SubstancesStep } from "@/features/onboarding/components/steps/substances-step";
import { SummaryStep } from "@/features/onboarding/components/steps/summary-step";
import { SupportStep } from "@/features/onboarding/components/steps/support-step";
import { WelcomeStep } from "@/features/onboarding/components/steps/welcome-step";
import { COMPLETION_ERROR_MESSAGE, onboardingSteps, type OnboardingStepId } from "@/features/onboarding/constants";
import {
  buildCompletionPayload,
  resolvePrimarySlug,
  validateStep,
  type StepErrors,
} from "@/features/onboarding/logic";
import type { OnboardingDraft } from "@/features/onboarding/schemas";

type OnboardingWizardProps = {
  catalogue: CatalogueOption[];
  initialDraft: OnboardingDraft;
  initialStep: number;
  latestAllowedDate: string;
  displayName: string | null;
};

type SaveStatus = "idle" | "saved" | "failed";

const SUMMARY_INDEX = onboardingSteps.findIndex((step) => step.id === "summary");

function stepIndexOf(stepId: OnboardingStepId) {
  return onboardingSteps.findIndex((step) => step.id === stepId);
}

export function OnboardingWizard({
  catalogue,
  initialDraft,
  initialStep,
  latestAllowedDate,
  displayName,
}: OnboardingWizardProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);
  const [stepIndex, setStepIndex] = useState(
    Math.min(Math.max(initialStep - 1, 0), onboardingSteps.length - 1),
  );
  const [errors, setErrors] = useState<StepErrors>({});
  const [returnToSummary, setReturnToSummary] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [completion, setCompletion] = useState<CompleteOnboardingState | null>(null);
  const [isCompleting, startCompleting] = useTransition();
  const [isLeaving, startLeaving] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasNavigated = useRef(false);
  const pendingErrorFocus = useRef<string | null>(null);

  const step = onboardingSteps[stepIndex];
  const content = stepContent[step.id];
  const isCompleted = completion?.status === "success";

  // Accessibilité : le focus suit le changement d'étape (annoncé par les lecteurs d'écran).
  useEffect(() => {
    if (!hasNavigated.current) return;
    headingRef.current?.focus();
  }, [stepIndex, isCompleted]);

  // Après une validation échouée : focus sur le premier champ ou groupe en erreur
  // (les identifiants d'erreur correspondent aux id des champs / fieldsets).
  useEffect(() => {
    if (!pendingErrorFocus.current) return;
    document.getElementById(pendingErrorFocus.current)?.focus();
    pendingErrorFocus.current = null;
  }, [errors]);

  function update(patch: Partial<OnboardingDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors({});
  }

  function persist(nextStepIndex: number, nextDraft: OnboardingDraft) {
    saveOnboardingDraftAction({ step: nextStepIndex + 1, draft: nextDraft })
      .then((saved) => setSaveStatus(saved ? "saved" : "failed"))
      .catch(() => setSaveStatus("failed"));
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

  function handleContinue() {
    const stepErrors = validateStep(step.id, draft, latestAllowedDate);
    if (Object.keys(stepErrors).length > 0) {
      showErrors(stepErrors);
      return;
    }

    let nextDraft = draft;
    if (step.id === "substances" || step.id === "goals") {
      const slugs = (draft.substances ?? []).map((substance) => substance.slug);
      nextDraft = { ...draft, primarySlug: resolvePrimarySlug(slugs, draft.primarySlug) };
      setDraft(nextDraft);
    }

    // Après une modification depuis le résumé, on y revient directement
    // (sauf après les substances : leurs objectifs doivent être revus).
    const goesBackToSummary = returnToSummary && step.id !== "substances";
    const nextIndex = goesBackToSummary ? SUMMARY_INDEX : stepIndex + 1;
    if (goesBackToSummary) setReturnToSummary(false);

    goTo(nextIndex);
    persist(nextIndex, nextDraft);
  }

  function handleBack() {
    setReturnToSummary(false);
    goTo(stepIndex - 1);
  }

  function handleEdit(stepId: OnboardingStepId) {
    setReturnToSummary(true);
    goTo(stepIndexOf(stepId));
  }

  function handleComplete() {
    const stepErrors = validateStep("summary", draft, latestAllowedDate);
    if (Object.keys(stepErrors).length > 0) {
      showErrors(stepErrors);
      return;
    }
    startCompleting(async () => {
      try {
        const result = await completeOnboardingAction(buildCompletionPayload(draft));
        if (result.status === "success") hasNavigated.current = true;
        setCompletion(result);
      } catch {
        setCompletion({ status: "error", message: COMPLETION_ERROR_MESSAGE });
      }
    });
  }

  function handleLeave() {
    startLeaving(async () => {
      await saveOnboardingDraftAction({ step: stepIndex + 1, draft }).catch(() => false);
      router.push(routes.home);
    });
  }

  if (isCompleted) {
    return <OnboardingComplete headingRef={headingRef} />;
  }

  const isFirst = stepIndex === 0;
  const isSummary = step.id === "summary";
  const skipsSupport = step.id === "support" && !draft.supportContact;
  const continueLabel = isFirst
    ? "Commencer"
    : skipsSupport
      ? "Passer pour l'instant"
      : returnToSummary && step.id !== "substances"
        ? "Revenir au résumé"
        : "Continuer";
  const completionError = completion?.status === "error" ? completion.message : null;

  return (
    <div className="grid gap-6">
      <OnboardingProgress stepIndex={stepIndex} stepTitle={step.title} />

      <section
        aria-labelledby="onboarding-step-title"
        className="grid gap-6 sm:rounded-2xl sm:border sm:bg-card sm:p-8 sm:shadow-sm"
      >
        <header className="grid gap-2">
          <h1
            id="onboarding-step-title"
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight text-balance outline-none sm:text-3xl"
          >
            {isFirst && displayName ? `${content.heading}, ${displayName}` : content.heading}
          </h1>
          {content.description ? (
            <p className="text-base text-pretty text-muted-foreground">{content.description}</p>
          ) : null}
        </header>

        {step.id === "welcome" ? <WelcomeStep /> : null}
        {step.id === "substances" ? (
          <SubstancesStep draft={draft} onChange={update} errors={errors} catalogue={catalogue} />
        ) : null}
        {step.id === "goals" ? (
          <GoalsStep draft={draft} onChange={update} errors={errors} catalogue={catalogue} />
        ) : null}
        {step.id === "start" ? (
          <StartStep draft={draft} onChange={update} errors={errors} latestAllowedDate={latestAllowedDate} />
        ) : null}
        {step.id === "reason" ? <ReasonStep draft={draft} onChange={update} errors={errors} /> : null}
        {step.id === "motivations" ? <MotivationsStep draft={draft} onChange={update} errors={errors} /> : null}
        {step.id === "support" ? <SupportStep draft={draft} onChange={update} errors={errors} /> : null}
        {isSummary ? <SummaryStep draft={draft} catalogue={catalogue} onEdit={handleEdit} /> : null}

        {errors.form ? <FormAlert tone="error" message={errors.form} /> : null}
        {isSummary && completionError ? <FormAlert tone="error" message={completionError} /> : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {!isFirst ? (
            <Button type="button" variant="ghost" size="lg" onClick={handleBack} disabled={isCompleting}>
              <ArrowLeft data-icon="inline-start" aria-hidden="true" />
              Retour
            </Button>
          ) : (
            <span aria-hidden="true" />
          )}

          {isSummary ? (
            <SubmitButton
              pending={isCompleting}
              pendingLabel="Enregistrement…"
              onClick={handleComplete}
              className="w-full sm:w-auto"
            >
              {completionError ? "Réessayer" : "Commencer mon parcours"}
            </SubmitButton>
          ) : (
            <Button type="button" size="lg" onClick={handleContinue} className="w-full sm:w-auto">
              {continueLabel}
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Button>
          )}
        </div>
      </section>

      <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
        <Button type="button" variant="link" onClick={handleLeave} disabled={isLeaving || isCompleting}>
          {isLeaving ? "Enregistrement…" : "Enregistrer et quitter"}
        </Button>
        <p aria-live="polite" className="min-h-5 text-center">
          {saveStatus === "saved" ? "Tes réponses sont enregistrées." : null}
          {saveStatus === "failed"
            ? "Enregistrement automatique momentanément indisponible. Tes réponses restent sur cette page."
            : null}
        </p>
      </div>
    </div>
  );
}
