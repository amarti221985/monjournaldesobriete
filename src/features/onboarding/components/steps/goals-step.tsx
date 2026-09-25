import { Info } from "lucide-react";

import { getFieldErrorId } from "@/components/forms/form-field";
import { SelectableOption } from "@/components/forms/selectable-option";
import {
  goalOptions,
  SUBSTANCE_GOALS,
  WITHDRAWAL_NOTICE,
  WITHDRAWAL_NOTICE_SLUGS,
} from "@/features/onboarding/constants";
import { FieldError } from "@/features/onboarding/components/field-error";
import type { CatalogueOption, StepProps } from "@/features/onboarding/components/step-types";
import { getSubstanceDisplayName } from "@/features/onboarding/components/substance-name";
import type { SubstanceGoal } from "@/features/onboarding/constants";

type GoalsStepProps = StepProps & { catalogue: CatalogueOption[] };

export function GoalsStep({ draft, onChange, errors, catalogue }: GoalsStepProps) {
  const substances = draft.substances ?? [];
  const showWithdrawalNotice = substances.some(
    (substance) => substance.goal === "abstinence" && WITHDRAWAL_NOTICE_SLUGS.includes(substance.slug),
  );

  function setGoal(slug: string, goal: SubstanceGoal) {
    onChange({
      substances: substances.map((substance) => (substance.slug === slug ? { ...substance, goal } : substance)),
    });
  }

  return (
    <div className="grid gap-8">
      {substances.map((substance) => {
        const fieldId = `goal-${substance.slug}`;
        const name = getSubstanceDisplayName(catalogue, substance.slug, substance.customName);
        return (
          <fieldset
            key={substance.slug}
            id={fieldId}
            tabIndex={-1}
            aria-describedby={errors[fieldId] ? getFieldErrorId(fieldId) : undefined}
            className="grid gap-3 outline-none"
          >
            <legend className="mb-3 text-base font-semibold">{name}</legend>
            {SUBSTANCE_GOALS.map((goal) => (
              <SelectableOption
                key={goal}
                type="radio"
                name={fieldId}
                value={goal}
                label={goalOptions[goal].label}
                description={goalOptions[goal].description}
                checked={substance.goal === goal}
                onCheckedChange={(checked) => checked && setGoal(substance.slug, goal)}
              />
            ))}
            <FieldError id={fieldId} message={errors[fieldId]} />
          </fieldset>
        );
      })}

      {substances.length > 1 ? (
        <fieldset
          id="primarySlug"
          tabIndex={-1}
          aria-describedby={errors.primarySlug ? getFieldErrorId("primarySlug") : undefined}
          className="grid gap-3 outline-none"
        >
          <legend className="mb-1 text-base font-semibold">
            Laquelle souhaites-tu principalement changer en ce moment?
          </legend>
          <p className="text-sm text-muted-foreground">
            Cela nous aide seulement à personnaliser certains écrans.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {substances.map((substance) => (
              <SelectableOption
                key={substance.slug}
                type="radio"
                size="compact"
                name="primarySlug"
                value={substance.slug}
                label={getSubstanceDisplayName(catalogue, substance.slug, substance.customName)}
                checked={draft.primarySlug === substance.slug}
                onCheckedChange={(checked) => checked && onChange({ primarySlug: substance.slug })}
              />
            ))}
          </div>
          <FieldError id="primarySlug" message={errors.primarySlug} />
        </fieldset>
      ) : null}

      {showWithdrawalNotice ? (
        <p className="flex gap-2.5 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{WITHDRAWAL_NOTICE}</span>
        </p>
      ) : null}
    </div>
  );
}
