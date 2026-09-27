"use client";

import { useState } from "react";

import { SelectableChip } from "@/components/forms/selectable-chip";
import { MOTIVATIONS, motivationOptions, type Motivation } from "@/features/onboarding/constants";
import { saveMotivationsAction, saveReasonAction } from "@/features/plan/actions";
import { PLAN_TEXT_LIMITS } from "@/features/plan/constants";
import {
  EditButton,
  FormActions,
  PlanSection,
  StatusLine,
  TextAreaField,
  TextField,
  usePlanAction,
  useUnsavedGuard,
} from "@/features/plan/components/plan-ui";

/** « Pourquoi je fais ce changement » : raison principale de l'onboarding (aussi affichée dans /craving). */
export function ReasonSection({ reason }: { reason: string | null }) {
  const action = usePlanAction();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(reason ?? "");
  const dirty = editing && value !== (reason ?? "");
  useUnsavedGuard(dirty);

  return (
    <PlanSection
      id="pourquoi"
      title="Pourquoi je fais ce changement"
      action={!editing ? <EditButton label="Modifier" onClick={() => setEditing(true)} /> : null}
    >
      {editing ? (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            action.run(() => saveReasonAction({ reason: value }), () => setEditing(false));
          }}
        >
          <TextAreaField
            id="reason"
            label="Ma raison"
            value={value}
            onChange={setValue}
            max={PLAN_TEXT_LIMITS.reason}
            hint="Quelques mots suffisent."
          />
          <StatusLine error={action.error} saved={false} />
          <FormActions
            pending={action.isPending}
            dirty={dirty}
            retry={Boolean(action.error)}
            onCancel={() => {
              setValue(reason ?? "");
              setEditing(false);
              action.clearError();
            }}
          />
        </form>
      ) : reason ? (
        <blockquote className="border-l-2 border-primary/40 pl-3 text-pretty whitespace-pre-line">{reason}</blockquote>
      ) : (
        <p className="text-sm text-muted-foreground">Aucune raison enregistrée.</p>
      )}
      {!editing ? <StatusLine error={null} saved={action.saved} /> : null}
    </PlanSection>
  );
}

type MotivationItem = { motivation: Motivation; customLabel: string | null };

function labelOf(item: MotivationItem) {
  return item.motivation === "other" && item.customLabel ? item.customLabel : motivationOptions[item.motivation].label;
}

/** « Ce qui compte pour moi » : motivations du Sprint 2 (au moins une). */
export function MotivationsSection({ motivations }: { motivations: MotivationItem[] }) {
  const action = usePlanAction();
  const [editing, setEditing] = useState(false);
  const initial = motivations.map((item) => item.motivation);
  const initialOther = motivations.find((item) => item.motivation === "other")?.customLabel ?? "";
  const [selected, setSelected] = useState<Motivation[]>(initial);
  const [otherLabel, setOtherLabel] = useState(initialOther);
  const [error, setError] = useState<string | undefined>(undefined);
  const dirty = editing && (selected.join() !== initial.join() || otherLabel !== initialOther);
  useUnsavedGuard(dirty);

  return (
    <PlanSection
      id="motivations"
      title="Ce qui compte pour moi"
      action={!editing ? <EditButton label="Modifier" onClick={() => setEditing(true)} /> : null}
    >
      {editing ? (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (selected.length === 0) {
              setError("Garde au moins un élément.");
              return;
            }
            setError(undefined);
            action.run(() => saveMotivationsAction({ motivations: selected, otherLabel }), () => setEditing(false));
          }}
        >
          <fieldset className="grid gap-2" aria-describedby={error ? "motivations-error" : undefined}>
            <legend className="mb-2 text-sm font-medium">Choisis ce qui compte pour toi</legend>
            <div className="flex flex-wrap gap-2">
              {MOTIVATIONS.map((motivation) => (
                <SelectableChip
                  key={motivation}
                  name="motivations"
                  value={motivation}
                  label={motivationOptions[motivation].label}
                  checked={selected.includes(motivation)}
                  onCheckedChange={(checked) =>
                    setSelected((list) =>
                      checked ? MOTIVATIONS.filter((item) => item === motivation || list.includes(item)) : list.filter((item) => item !== motivation),
                    )
                  }
                />
              ))}
            </div>
            {error ? (
              <p id="motivations-error" className="text-sm font-medium text-destructive">
                {error}
              </p>
            ) : null}
          </fieldset>
          {selected.includes("other") ? (
            <TextField id="motivation-other" label="Précise si tu le souhaites" value={otherLabel} onChange={setOtherLabel} max={80} />
          ) : null}
          <StatusLine error={action.error} saved={false} />
          <FormActions
            pending={action.isPending}
            dirty={dirty}
            retry={Boolean(action.error)}
            onCancel={() => {
              setSelected(initial);
              setOtherLabel(initialOther);
              setEditing(false);
              action.clearError();
            }}
          />
        </form>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Mes motivations">
          {motivations.map((item) => {
            const Icon = motivationOptions[item.motivation].icon;
            return (
              <li key={item.motivation} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm text-secondary-foreground">
                <Icon className="size-4" aria-hidden="true" />
                {labelOf(item)}
              </li>
            );
          })}
        </ul>
      )}
      {!editing ? <StatusLine error={null} saved={action.saved} /> : null}
    </PlanSection>
  );
}
