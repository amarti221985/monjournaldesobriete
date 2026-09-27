"use client";

import { Check } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { FormField, getFieldControlProps, getFieldErrorId } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendFeedbackAction, type FeedbackState } from "@/features/feedback/actions";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_SECTIONS,
  feedbackCategoryLabels,
  feedbackSectionLabels,
  type FeedbackCategory,
  type FeedbackSection,
} from "@/features/feedback/schema";
import { cn } from "@/lib/utils";

/** Formulaire d'avis : type, message, section facultative. Rien n'est ajouté automatiquement. */
export function FeedbackForm() {
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState("");
  const [section, setSection] = useState<FeedbackSection | "">("");
  const [state, setState] = useState<FeedbackState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();
  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  // Après un envoi refusé : focus sur le premier champ en erreur (sinon sur le message d'alerte).
  useEffect(() => {
    if (state.status !== "error") return;
    const target = state.fieldErrors?.category
      ? document.querySelector<HTMLInputElement>("input[name=category]")
      : state.fieldErrors?.message
        ? document.getElementById("feedback-message")
        : null;
    target?.focus();
  }, [state]);

  if (state.status === "sent") {
    return (
      <div className="grid gap-4">
        <FormAlert tone="success" message="Merci ! Ton avis a bien été envoyé. Il nous aide à améliorer l'application." />
        <Button
          type="button"
          variant="outline"
          className="justify-self-start"
          onClick={() => {
            setCategory(null);
            setMessage("");
            setSection("");
            setState({ status: "idle" });
          }}
        >
          Envoyer un autre avis
        </Button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (isPending) return;
        startTransition(async () => {
          const result = await sendFeedbackAction({ category, message, section: section || null }).catch(
            (): FeedbackState => ({ status: "error", message: "Ton avis n'a pas pu être envoyé. Réessaie dans quelques instants." }),
          );
          setState(result);
        });
      }}
    >
      {state.status === "error" ? <FormAlert tone="error" message={state.message} /> : null}

      <fieldset
        className="grid gap-3"
        aria-describedby={fieldErrors?.category ? getFieldErrorId("feedback-category") : undefined}
        aria-invalid={fieldErrors?.category ? true : undefined}
      >
        <legend className="mb-1 text-sm font-medium">De quoi veux-tu nous parler?</legend>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_CATEGORIES.map((value) => (
            <label
              key={value}
              className={cn(
                "group inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border bg-card px-4 text-sm font-medium transition-colors",
                "hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:checked]:text-secondary-foreground",
                "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
              )}
            >
              <input
                type="radio"
                name="category"
                value={value}
                checked={category === value}
                onChange={() => setCategory(value)}
                className="sr-only"
              />
              <Check aria-hidden="true" strokeWidth={3} className="-ml-1 hidden size-3.5 group-has-[:checked]:block" />
              {feedbackCategoryLabels[value]}
            </label>
          ))}
        </div>
        {fieldErrors?.category ? (
          <p id={getFieldErrorId("feedback-category")} className="text-sm font-medium text-destructive">
            {fieldErrors.category}
          </p>
        ) : null}
      </fieldset>

      <FormField
        id="feedback-message"
        label="Ton message"
        error={fieldErrors?.message}
        hint={`${message.length} / ${FEEDBACK_MESSAGE_MAX} caractères. N'y mets pas d'informations que tu souhaites garder privées.`}
      >
        <Textarea
          {...getFieldControlProps("feedback-message", {
            error: fieldErrors?.message,
            hint: "hint",
          })}
          value={message}
          maxLength={FEEDBACK_MESSAGE_MAX}
          rows={6}
          onChange={(event) => setMessage(event.target.value)}
        />
      </FormField>

      <FormField id="feedback-section" label="Section concernée (facultatif)">
        <select
          id="feedback-section"
          value={section}
          onChange={(event) => setSection(event.target.value as FeedbackSection | "")}
          className="h-11 rounded-lg border bg-card px-3 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <option value="">Aucune en particulier</option>
          {FEEDBACK_SECTIONS.map((value) => (
            <option key={value} value={value}>
              {feedbackSectionLabels[value]}
            </option>
          ))}
        </select>
      </FormField>

      <SubmitButton pending={isPending} pendingLabel="Envoi…" className="justify-self-start">
        Envoyer mon avis
      </SubmitButton>
    </form>
  );
}
