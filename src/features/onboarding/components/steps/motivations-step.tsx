import { FormField, getFieldControlProps, getFieldErrorId } from "@/components/forms/form-field";
import { SelectableOption } from "@/components/forms/selectable-option";
import { Input } from "@/components/ui/input";
import { MOTIVATIONS, motivationOptions, type Motivation } from "@/features/onboarding/constants";
import { FieldError } from "@/features/onboarding/components/field-error";
import type { StepProps } from "@/features/onboarding/components/step-types";

export function MotivationsStep({ draft, onChange, errors }: StepProps) {
  const selected = draft.motivations ?? [];

  function toggle(motivation: Motivation, checked: boolean) {
    onChange({
      motivations: checked
        ? [...selected, motivation]
        : selected.filter((item) => item !== motivation),
    });
  }

  return (
    <div className="grid gap-5">
      <fieldset
        id="motivations"
        tabIndex={-1}
        aria-describedby={errors.motivations ? getFieldErrorId("motivations") : undefined}
        className="grid gap-3 outline-none"
      >
        <legend className="sr-only">Choisis tout ce qui compte pour toi</legend>
        <div className="grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2">
          {MOTIVATIONS.map((motivation) => {
            const { label, icon: Icon } = motivationOptions[motivation];
            return (
              <SelectableOption
                key={motivation}
                type="checkbox"
                size="compact"
                name="motivations"
                value={motivation}
                label={label}
                icon={<Icon className="size-[1.125rem]" />}
                checked={selected.includes(motivation)}
                onCheckedChange={(checked) => toggle(motivation, checked)}
              />
            );
          })}
        </div>
        <FieldError id="motivations" message={errors.motivations} />
      </fieldset>

      {selected.includes("other") ? (
        <FormField id="motivationOther" label="Précise si tu le souhaites" error={errors.motivationOther}>
          <Input
            {...getFieldControlProps("motivationOther", { error: errors.motivationOther })}
            value={draft.motivationOther ?? ""}
            onChange={(event) => onChange({ motivationOther: event.target.value })}
            maxLength={80}
            autoComplete="off"
          />
        </FormField>
      ) : null}
    </div>
  );
}
