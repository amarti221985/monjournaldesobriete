import { FormField, getFieldControlProps } from "@/components/forms/form-field";
import { SelectableOption } from "@/components/forms/selectable-option";
import { Input } from "@/components/ui/input";
import { OTHER_SUBSTANCE_SLUG } from "@/features/onboarding/constants";
import { FieldError } from "@/features/onboarding/components/field-error";
import type { CatalogueOption, StepProps } from "@/features/onboarding/components/step-types";
import { getFieldErrorId } from "@/components/forms/form-field";

type SubstancesStepProps = StepProps & { catalogue: CatalogueOption[] };

export function SubstancesStep({ draft, onChange, errors, catalogue }: SubstancesStepProps) {
  const selected = draft.substances ?? [];
  const other = selected.find((substance) => substance.slug === OTHER_SUBSTANCE_SLUG);

  function toggle(slug: string, checked: boolean) {
    const next = checked
      ? [...selected, { slug }]
      : selected.filter((substance) => substance.slug !== slug);
    onChange({ substances: next });
  }

  function setCustomName(customName: string) {
    onChange({
      substances: selected.map((substance) =>
        substance.slug === OTHER_SUBSTANCE_SLUG ? { ...substance, customName } : substance,
      ),
    });
  }

  return (
    <div className="grid gap-5">
      <fieldset
        id="substances"
        tabIndex={-1}
        aria-describedby={errors.substances ? getFieldErrorId("substances") : undefined}
        className="grid gap-3 outline-none"
      >
        <legend className="sr-only">Choisis une ou plusieurs options</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {catalogue.map((substance) => (
            <SelectableOption
              key={substance.slug}
              type="checkbox"
              name="substances"
              value={substance.slug}
              label={substance.name_fr}
              checked={selected.some((item) => item.slug === substance.slug)}
              onCheckedChange={(checked) => toggle(substance.slug, checked)}
            />
          ))}
        </div>
        <FieldError id="substances" message={errors.substances} />
      </fieldset>

      {other ? (
        <FormField id="customName" label="Précise si tu le souhaites" error={errors.customName}>
          <Input
            {...getFieldControlProps("customName", { error: errors.customName })}
            value={other.customName ?? ""}
            onChange={(event) => setCustomName(event.target.value)}
            maxLength={80}
            autoComplete="off"
          />
        </FormField>
      ) : null}
    </div>
  );
}
