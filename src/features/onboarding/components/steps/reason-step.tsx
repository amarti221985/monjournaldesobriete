import { Lock } from "lucide-react";

import { FormField, getFieldControlProps } from "@/components/forms/form-field";
import { Textarea } from "@/components/ui/textarea";
import type { StepProps } from "@/features/onboarding/components/step-types";
import { REASON_MAX } from "@/features/onboarding/schemas";

export function ReasonStep({ draft, onChange, errors }: StepProps) {
  const length = draft.reason?.length ?? 0;
  const hint = `${length} / ${REASON_MAX} caractères`;

  return (
    <div className="grid gap-3">
      <FormField id="reason" label="Ma raison" error={errors.reason} hint={hint}>
        <Textarea
          {...getFieldControlProps("reason", { error: errors.reason, hint })}
          value={draft.reason ?? ""}
          onChange={(event) => onChange({ reason: event.target.value })}
          placeholder="Je veux retrouver mon énergie, être plus présent et reprendre le contrôle de mes journées..."
          maxLength={REASON_MAX}
          rows={6}
          className="min-h-40 bg-card px-3.5 py-3"
          required
        />
      </FormField>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="size-4 shrink-0" aria-hidden="true" />
        Visible par toi seulement.
      </p>
    </div>
  );
}
