import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  goalOptions,
  motivationOptions,
  type OnboardingStepId,
} from "@/features/onboarding/constants";
import type { CatalogueOption } from "@/features/onboarding/components/step-types";
import { getSubstanceDisplayName } from "@/features/onboarding/components/substance-name";
import { hasSupportContactInput, resolvePrimarySlug } from "@/features/onboarding/logic";
import type { OnboardingDraft } from "@/features/onboarding/schemas";
import { formatLongDate, isValidDateString } from "@/lib/dates";

type SummaryStepProps = {
  draft: OnboardingDraft;
  catalogue: CatalogueOption[];
  onEdit: (stepId: OnboardingStepId) => void;
};

function SummarySection({
  title,
  stepId,
  onEdit,
  children,
}: {
  title: string;
  stepId: OnboardingStepId;
  onEdit: (stepId: OnboardingStepId) => void;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 border-b pb-5 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <dt className="text-sm font-medium text-muted-foreground">{title}</dt>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-mr-2 text-primary"
          onClick={() => onEdit(stepId)}
          aria-label={`Modifier : ${title}`}
        >
          Modifier
        </Button>
      </div>
      <dd className="text-pretty">{children}</dd>
    </div>
  );
}

export function SummaryStep({ draft, catalogue, onEdit }: SummaryStepProps) {
  const substances = draft.substances ?? [];
  const primarySlug = resolvePrimarySlug(
    substances.map((substance) => substance.slug),
    draft.primarySlug,
  );
  const motivations = draft.motivations ?? [];
  const contact = hasSupportContactInput(draft.supportContact) ? draft.supportContact : null;

  return (
    <dl className="grid gap-5">
      <SummarySection title="Je souhaite travailler sur" stepId="substances" onEdit={onEdit}>
        <ul className="grid gap-2.5">
          {substances.map((substance) => (
            <li key={substance.slug} className="grid gap-0.5">
              <span className="flex flex-wrap items-center gap-2 font-medium">
                {getSubstanceDisplayName(catalogue, substance.slug, substance.customName)}
                {substances.length > 1 && substance.slug === primarySlug ? (
                  <Badge variant="secondary">Principal</Badge>
                ) : null}
              </span>
              <span className="text-sm text-muted-foreground">
                Objectif : {substance.goal ? goalOptions[substance.goal].label : "à choisir"}
              </span>
            </li>
          ))}
        </ul>
      </SummarySection>

      <SummarySection title="Début du parcours" stepId="start" onEdit={onEdit}>
        {isValidDateString(draft.startedOn) ? formatLongDate(draft.startedOn) : "À choisir"}
      </SummarySection>

      <SummarySection title="Ce qui compte pour moi" stepId="motivations" onEdit={onEdit}>
        {motivations
          .map((motivation) =>
            motivation === "other" && draft.motivationOther?.trim()
              ? draft.motivationOther.trim()
              : motivationOptions[motivation].label,
          )
          .join(" · ") || "À choisir"}
      </SummarySection>

      <SummarySection title="Pourquoi" stepId="reason" onEdit={onEdit}>
        <span className="whitespace-pre-line">{draft.reason?.trim() || "À écrire"}</span>
      </SummarySection>

      <SummarySection title="Soutien" stepId="support" onEdit={onEdit}>
        {contact
          ? [contact.name?.trim(), contact.relationship?.trim()].filter(Boolean).join(" — ")
          : <span className="text-muted-foreground">Aucune personne ajoutée pour l&apos;instant.</span>}
      </SummarySection>
    </dl>
  );
}
