"use client";

import { Crown } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { goalOptions, MAX_TRACKED_SUBSTANCES, SUBSTANCE_GOALS, type SubstanceGoal } from "@/features/onboarding/constants";
import {
  addSubstanceAction,
  deactivateSubstanceAction,
  setPrimarySubstanceAction,
  updateSubstanceAction,
} from "@/features/plan/actions";
import {
  AddButton,
  ChoiceGroup,
  ConfirmedActionButton,
  EditButton,
  FormActions,
  PlanSection,
  StatusLine,
  TextField,
  usePlanAction,
  useUnsavedGuard,
} from "@/features/plan/components/plan-ui";
import { formatLongDate } from "@/lib/dates";

export type JourneySubstance = {
  id: string;
  slug: string;
  name: string;
  customName: string | null;
  goal: SubstanceGoal;
  startedOn: string;
  isPrimary: boolean;
};

export type CatalogueSubstanceOption = { slug: string; name: string; isOther: boolean };

const GOAL_CHOICES = SUBSTANCE_GOALS.map((goal) => ({ value: goal, label: goalOptions[goal].label }));

function displayName(substance: JourneySubstance) {
  return substance.customName?.trim() || substance.name;
}

function SubstanceEditor({
  substance,
  latestAllowedDate,
  onClose,
}: {
  substance: JourneySubstance;
  latestAllowedDate: string;
  onClose: () => void;
}) {
  const action = usePlanAction();
  const [goal, setGoal] = useState<SubstanceGoal>(substance.goal);
  const [startedOn, setStartedOn] = useState(substance.startedOn);
  const [customName, setCustomName] = useState(substance.customName ?? "");
  const [confirmDate, setConfirmDate] = useState(false);
  const dirty = goal !== substance.goal || startedOn !== substance.startedOn || customName !== (substance.customName ?? "");
  useUnsavedGuard(dirty);

  const save = () =>
    action.run(() => updateSubstanceAction({ id: substance.id, goal, startedOn, customName }), onClose);

  return (
    <form
      className="grid gap-4 rounded-xl bg-muted/50 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        // Changer la date de départ : confirmation (l'historique n'est jamais modifié).
        if (startedOn !== substance.startedOn) setConfirmDate(true);
        else save();
      }}
    >
      {substance.slug === "other" ? (
        <TextField id={`name-${substance.id}`} label="Nom" value={customName} onChange={setCustomName} max={80} />
      ) : null}
      <ChoiceGroup name={`goal-${substance.id}`} legend="Objectif" options={GOAL_CHOICES} value={goal} onChange={setGoal} />
      <div className="grid gap-2">
        <Label htmlFor={`start-${substance.id}`}>Depuis</Label>
        <Input
          id={`start-${substance.id}`}
          type="date"
          value={startedOn}
          max={latestAllowedDate}
          min="1900-01-01"
          onChange={(event) => setStartedOn(event.target.value)}
          className="w-full sm:w-56"
        />
      </div>
      <StatusLine error={action.error} saved={false} />
      <FormActions pending={action.isPending} dirty={dirty} onCancel={onClose} retry={Boolean(action.error)} />
      <ConfirmDialog
        open={confirmDate}
        title="Modifier la date de départ ?"
        description="Modifier cette date changera la façon dont certaines périodes de ton parcours sont présentées. Tes check-ins existants ne seront pas supprimés."
        confirmLabel="Modifier la date"
        pending={action.isPending}
        onConfirm={() => {
          setConfirmDate(false);
          save();
        }}
        onCancel={() => setConfirmDate(false)}
      />
    </form>
  );
}

function AddSubstanceForm({
  options,
  latestAllowedDate,
  onClose,
}: {
  options: CatalogueSubstanceOption[];
  latestAllowedDate: string;
  onClose: () => void;
}) {
  const action = usePlanAction();
  const [slug, setSlug] = useState(options[0]?.slug ?? "");
  const [customName, setCustomName] = useState("");
  const [goal, setGoal] = useState<SubstanceGoal>("abstinence");
  const [startedOn, setStartedOn] = useState(latestAllowedDate);
  const selected = options.find((option) => option.slug === slug);

  return (
    <form
      className="grid gap-4 rounded-xl bg-muted/50 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        action.run(() => addSubstanceAction({ slug, customName, goal, startedOn }), onClose);
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="add-substance">Substance</Label>
        <select
          id="add-substance"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          className="h-11 w-full rounded-lg border bg-card px-3 text-sm sm:w-64"
        >
          {options.map((option) => (
            <option key={option.slug} value={option.slug}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
      {selected?.isOther ? (
        <TextField id="add-substance-name" label="Précise si tu le souhaites" value={customName} onChange={setCustomName} max={80} />
      ) : null}
      <ChoiceGroup name="add-goal" legend="Objectif" options={GOAL_CHOICES} value={goal} onChange={setGoal} />
      <div className="grid gap-2">
        <Label htmlFor="add-start">Depuis</Label>
        <Input
          id="add-start"
          type="date"
          value={startedOn}
          max={latestAllowedDate}
          min="1900-01-01"
          onChange={(event) => setStartedOn(event.target.value)}
          className="w-full sm:w-56"
        />
      </div>
      <StatusLine error={action.error} saved={false} />
      <FormActions pending={action.isPending} dirty={false} onCancel={onClose} submitLabel="Ajouter" retry={Boolean(action.error)} />
    </form>
  );
}

/**
 * « Mon parcours » : substances actives, objectif, date de départ, substance principale.
 * Arrêter le suivi = is_active false (l'historique reste intact).
 */
export function JourneySection({
  substances,
  catalogue,
  latestAllowedDate,
}: {
  substances: JourneySubstance[];
  catalogue: CatalogueSubstanceOption[];
  latestAllowedDate: string;
}) {
  const action = usePlanAction();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const tracked = new Set(substances.map((substance) => substance.slug));
  // Une relation active par substance (index unique) : seules les substances non suivies sont proposées.
  const addable = catalogue.filter((option) => !tracked.has(option.slug));
  const canAdd = addable.length > 0 && substances.length < MAX_TRACKED_SUBSTANCES;

  return (
    <PlanSection
      id="parcours"
      title="Mon parcours"
      description="Ce que tu suis, ton objectif et depuis quand."
      action={canAdd && !adding ? <AddButton label="Ajouter une substance" onClick={() => setAdding(true)} /> : null}
    >
      <ul className="grid gap-3">
        {substances.map((substance) => (
          <li key={substance.id} className="grid gap-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="grid gap-1">
                <p className="flex items-center gap-2 font-medium">
                  {displayName(substance)}
                  {substance.isPrimary ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                      <Crown className="size-3" aria-hidden="true" />
                      Principale
                    </span>
                  ) : null}
                </p>
                <dl className="grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2">
                  <div className="flex gap-1.5">
                    <dt className="text-muted-foreground">Objectif :</dt>
                    <dd>{goalOptions[substance.goal].label}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-muted-foreground">Depuis :</dt>
                    <dd>{formatLongDate(substance.startedOn)}</dd>
                  </div>
                </dl>
              </div>
              {editing !== substance.id ? (
                <div className="flex flex-wrap gap-1">
                  <EditButton label="Modifier" onClick={() => setEditing(substance.id)} />
                  {!substance.isPrimary ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-9"
                        disabled={action.isPending}
                        onClick={() => action.run(() => setPrimarySubstanceAction(substance.id))}
                      >
                        Rendre principale
                      </Button>
                      {substances.length > 1 ? (
                        <ConfirmedActionButton
                          label="Arrêter le suivi"
                          accessibleLabel={`Arrêter le suivi : ${displayName(substance)}`}
                          title={`Arrêter le suivi de « ${displayName(substance)} » ?`}
                          description="Cette substance ne sera plus proposée dans tes nouveaux check-ins et interventions. Ton historique restera intact."
                          confirmLabel="Arrêter le suivi"
                          pending={action.isPending}
                          icon={false}
                          onConfirm={() => action.run(() => deactivateSubstanceAction(substance.id))}
                        />
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
            {editing === substance.id ? (
              <SubstanceEditor substance={substance} latestAllowedDate={latestAllowedDate} onClose={() => setEditing(null)} />
            ) : null}
          </li>
        ))}
      </ul>
      {adding ? <AddSubstanceForm options={addable} latestAllowedDate={latestAllowedDate} onClose={() => setAdding(false)} /> : null}
      <StatusLine error={action.error} saved={action.saved} />
    </PlanSection>
  );
}
