import { FormField, getFieldControlProps } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import type { StepProps } from "@/features/onboarding/components/step-types";
import { MIN_JOURNEY_DATE } from "@/lib/dates";

type StartStepProps = StepProps & { latestAllowedDate: string };

const HINT =
  "Cette date sert de repère. Elle ne compte pas automatiquement de journées sobres : seules les journées que tu enregistreras le feront.";

export function StartStep({ draft, onChange, errors, latestAllowedDate }: StartStepProps) {
  const tracksSeveral = (draft.substances?.length ?? 0) > 1;

  return (
    <div className="grid gap-4">
      <FormField id="startedOn" label="Date de début" error={errors.startedOn} hint={HINT}>
        <Input
          {...getFieldControlProps("startedOn", { error: errors.startedOn, hint: HINT })}
          type="date"
          value={draft.startedOn ?? ""}
          min={MIN_JOURNEY_DATE}
          max={latestAllowedDate}
          onChange={(event) => onChange({ startedOn: event.target.value })}
          className="w-full sm:w-64"
          required
        />
      </FormField>
      {tracksSeveral ? (
        <p className="text-sm text-muted-foreground">
          Cette date sera utilisée pour chaque élément choisi. Tu pourras l&apos;ajuster
          individuellement plus tard.
        </p>
      ) : null}
    </div>
  );
}
