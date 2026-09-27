"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import {
  addStrategyAction,
  addTriggerAction,
  deletePlanItemAction,
  setFavoriteAction,
  updateStrategyAction,
  updateTriggerNotesAction,
} from "@/features/plan/actions";
import { MAX_PLAN_FAVORITES, PLAN_STRATEGY_DURATIONS, PLAN_TEXT_LIMITS, type PlanStrategyDuration } from "@/features/plan/constants";
import { remainingFavorites, sortStrategies, type PlanStrategy } from "@/features/plan/logic";
import {
  AddButton,
  ChoiceGroup,
  ConfirmedActionButton,
  EditButton,
  EmptyState,
  FavoriteButton,
  FormActions,
  PlanSection,
  StatusLine,
  TextAreaField,
  TextField,
  usePlanAction,
  useUnsavedGuard,
} from "@/features/plan/components/plan-ui";

const OTHER = "other";
const CUSTOM = "__custom__";

type Option = { slug: string; name: string };

export type PlanTriggerView = { id: string; triggerSlug: string | null; name: string; notes: string | null };

function NativeSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border bg-card px-3 text-sm sm:w-72"
      >
        {children}
      </select>
    </div>
  );
}

// --- Déclencheurs ------------------------------------------------------------------

function TriggerNotesEditor({ trigger, onClose }: { trigger: PlanTriggerView; onClose: () => void }) {
  const action = usePlanAction();
  const [notes, setNotes] = useState(trigger.notes ?? "");
  const dirty = notes !== (trigger.notes ?? "");
  useUnsavedGuard(dirty);
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        action.run(() => updateTriggerNotesAction({ id: trigger.id, notes }), onClose);
      }}
    >
      <TextAreaField id={`trigger-notes-${trigger.id}`} label="Ce que je remarque" value={notes} onChange={setNotes} max={PLAN_TEXT_LIMITS.triggerNotes} rows={2} />
      <StatusLine error={action.error} saved={false} />
      <FormActions pending={action.isPending} dirty={dirty} onCancel={onClose} retry={Boolean(action.error)} />
    </form>
  );
}

function AddTriggerForm({ options, onClose }: { options: Option[]; onClose: () => void }) {
  const action = usePlanAction();
  const [slug, setSlug] = useState(options[0]?.slug ?? OTHER);
  const [customLabel, setCustomLabel] = useState("");
  const [notes, setNotes] = useState("");
  const isOther = slug === OTHER;

  return (
    <form
      className="grid gap-4 rounded-xl bg-muted/50 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        action.run(
          () => addTriggerAction({ triggerSlug: isOther ? null : slug, customLabel, notes }),
          onClose,
        );
      }}
    >
      <NativeSelect id="add-trigger" label="Déclencheur" value={slug} onChange={setSlug}>
        {options.map((option) => (
          <option key={option.slug} value={option.slug}>
            {option.name}
          </option>
        ))}
        <option value={OTHER}>Autre (en mes mots)</option>
      </NativeSelect>
      {isOther ? (
        <TextField id="add-trigger-label" label="Décris-le en quelques mots" value={customLabel} onChange={setCustomLabel} max={PLAN_TEXT_LIMITS.triggerLabel} placeholder="Ex. Fin de soirée seul" />
      ) : null}
      <TextAreaField
        id="add-trigger-notes"
        label="Ce que je remarque"
        hint="Facultatif."
        value={notes}
        onChange={setNotes}
        max={PLAN_TEXT_LIMITS.triggerNotes}
        rows={2}
        placeholder="Ex. Mes envies sont souvent plus fortes après une journée de travail difficile."
      />
      <StatusLine error={action.error} saved={false} />
      <FormActions pending={action.isPending} dirty={Boolean(customLabel || notes)} onCancel={onClose} submitLabel="Ajouter" retry={Boolean(action.error)} />
    </form>
  );
}

/**
 * « Mes déclencheurs » : ceux que l'utilisateur CHOISIT de garder à l'œil
 * (user_personal_triggers), distincts des déclencheurs enregistrés dans les check-ins.
 * Jamais ajoutés automatiquement à partir des statistiques.
 */
export function TriggersSection({ triggers, catalogue }: { triggers: PlanTriggerView[]; catalogue: Option[] }) {
  const action = usePlanAction();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const inPlan = new Set(triggers.map((trigger) => trigger.triggerSlug).filter(Boolean));
  const options = catalogue.filter((item) => item.slug !== OTHER && !inPlan.has(item.slug));
  const addButton = <AddButton label="Ajouter un déclencheur" onClick={() => setAdding(true)} />;

  return (
    <PlanSection
      id="declencheurs"
      title="Mes déclencheurs"
      description="Les situations, émotions ou contextes que tu souhaites garder à l'œil."
      action={triggers.length > 0 && !adding ? addButton : null}
    >
      {triggers.length === 0 && !adding ? (
        <EmptyState text="Ajoute les situations que tu souhaites reconnaître plus facilement." action={addButton} />
      ) : null}
      {triggers.length > 0 ? (
        <ul className="grid gap-3">
          {triggers.map((trigger) => (
            <li key={trigger.id} className="grid gap-2 rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="grid gap-1">
                  <p className="font-medium">{trigger.name}</p>
                  {trigger.notes ? <p className="text-sm text-pretty text-muted-foreground">{trigger.notes}</p> : null}
                </div>
                {editing !== trigger.id ? (
                  <div className="flex flex-wrap gap-1">
                    <EditButton label={trigger.notes ? "Modifier" : "Ajouter une note"} onClick={() => setEditing(trigger.id)} />
                    <ConfirmedActionButton
                      label="Retirer"
                      accessibleLabel={`Retirer : ${trigger.name}`}
                      title={`Retirer « ${trigger.name} » de ton plan ?`}
                      description="Tes check-ins et interventions passés ne sont pas modifiés."
                      confirmLabel="Retirer"
                      pending={action.isPending}
                      onConfirm={() => action.run(() => deletePlanItemAction("trigger", trigger.id))}
                    />
                  </div>
                ) : null}
              </div>
              {editing === trigger.id ? <TriggerNotesEditor trigger={trigger} onClose={() => setEditing(null)} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {adding ? <AddTriggerForm options={options} onClose={() => setAdding(false)} /> : null}
      <StatusLine error={action.error} saved={action.saved} />
    </PlanSection>
  );
}

// --- Stratégies ---------------------------------------------------------------------

const DURATION_CHOICES = PLAN_STRATEGY_DURATIONS.map((value) => ({
  value,
  label: value === null ? "Aucune" : `${value} min`,
}));

function StrategyEditor({ strategy, onClose }: { strategy: PlanStrategy; onClose: () => void }) {
  const action = usePlanAction();
  const [name, setName] = useState(strategy.customName ?? "");
  const [notes, setNotes] = useState(strategy.notes ?? "");
  const [duration, setDuration] = useState<PlanStrategyDuration>(strategy.defaultDurationMinutes as PlanStrategyDuration);
  const dirty = name !== (strategy.customName ?? "") || notes !== (strategy.notes ?? "") || duration !== strategy.defaultDurationMinutes;
  useUnsavedGuard(dirty);
  return (
    <form
      className="grid gap-4 rounded-xl bg-muted/50 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        action.run(
          () => updateStrategyAction({ id: strategy.id, customName: name, notes, defaultDurationMinutes: duration }),
          onClose,
        );
      }}
    >
      {strategy.strategySlug === null ? (
        <TextField id={`strategy-name-${strategy.id}`} label="Nom" value={name} onChange={setName} max={PLAN_TEXT_LIMITS.strategyName} />
      ) : null}
      <TextAreaField id={`strategy-notes-${strategy.id}`} label="Comment je veux l'utiliser" hint="Facultatif." value={notes} onChange={setNotes} max={PLAN_TEXT_LIMITS.strategyNotes} rows={2} />
      <ChoiceGroup name={`strategy-duration-${strategy.id}`} legend="Durée par défaut" options={DURATION_CHOICES} value={duration} onChange={setDuration} />
      <StatusLine error={action.error} saved={false} />
      <FormActions pending={action.isPending} dirty={dirty} onCancel={onClose} retry={Boolean(action.error)} />
    </form>
  );
}

function AddStrategyForm({ options, onClose }: { options: Option[]; onClose: () => void }) {
  const action = usePlanAction();
  const [slug, setSlug] = useState(options[0]?.slug ?? CUSTOM);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [duration, setDuration] = useState<PlanStrategyDuration>(null);
  const isCustom = slug === CUSTOM;

  return (
    <form
      className="grid gap-4 rounded-xl bg-muted/50 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        action.run(
          () =>
            addStrategyAction({
              strategySlug: isCustom ? null : slug,
              customName: name,
              notes,
              defaultDurationMinutes: duration,
            }),
          onClose,
        );
      }}
    >
      <NativeSelect id="add-strategy" label="Stratégie" value={slug} onChange={setSlug}>
        {options.map((option) => (
          <option key={option.slug} value={option.slug}>
            {option.name}
          </option>
        ))}
        <option value={CUSTOM}>Ma propre stratégie</option>
      </NativeSelect>
      {isCustom ? (
        <TextField id="add-strategy-name" label="Ma stratégie" value={name} onChange={setName} max={PLAN_TEXT_LIMITS.strategyName} placeholder="Ex. Sortir marcher avec mon chien" />
      ) : null}
      <TextAreaField
        id="add-strategy-notes"
        label="Comment je veux l'utiliser"
        hint="Facultatif."
        value={notes}
        onChange={setNotes}
        max={PLAN_TEXT_LIMITS.strategyNotes}
        rows={2}
        placeholder="Ex. Quand mon envie dépasse 7/10, sortir de l'appartement pendant 15 minutes."
      />
      <ChoiceGroup name="add-strategy-duration" legend="Durée par défaut" options={DURATION_CHOICES} value={duration} onChange={setDuration} />
      <StatusLine error={action.error} saved={false} />
      <FormActions pending={action.isPending} dirty={Boolean(name || notes)} onCancel={onClose} submitLabel="Ajouter" retry={Boolean(action.error)} />
    </form>
  );
}

/**
 * « Ce qui peut m'aider » : stratégies du plan, 3 favoris au maximum (appliqué par la
 * base). Les favoris apparaissent en premier dans le mode envie. Les statistiques ne
 * modifient jamais les favoris.
 */
export function StrategiesSection({ strategies, catalogue }: { strategies: PlanStrategy[]; catalogue: Option[] }) {
  const action = usePlanAction();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const inPlan = new Set(strategies.map((strategy) => strategy.strategySlug).filter(Boolean));
  const options = catalogue.filter((item) => !inPlan.has(item.slug));
  const remaining = remainingFavorites(strategies, MAX_PLAN_FAVORITES);
  const addButton = <AddButton label="Ajouter une stratégie" onClick={() => setAdding(true)} />;

  return (
    <PlanSection
      id="strategies"
      title="Ce qui peut m'aider"
      description="Garde ici les actions que tu aimerais pouvoir retrouver rapidement lorsque l'envie monte."
      action={strategies.length > 0 && !adding ? addButton : null}
    >
      {strategies.length === 0 && !adding ? (
        <EmptyState text="Ajoute quelques actions que tu aimerais retrouver rapidement lorsque l'envie monte." action={addButton} />
      ) : null}
      {strategies.length > 0 ? (
        <>
          <p className="text-xs text-muted-foreground">
            Tes favoris ({MAX_PLAN_FAVORITES} au maximum) apparaissent en premier dans « J&apos;ai envie de consommer ».
          </p>
          <ul className="grid gap-3">
            {sortStrategies(strategies).map((strategy) => (
              <li key={strategy.id} className="grid gap-2 rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="grid gap-1">
                    <p className="font-medium">{strategy.name}</p>
                    {strategy.notes ? <p className="text-sm text-pretty text-muted-foreground">{strategy.notes}</p> : null}
                    {strategy.defaultDurationMinutes ? (
                      <p className="text-xs text-muted-foreground">Durée par défaut : {strategy.defaultDurationMinutes} min</p>
                    ) : null}
                  </div>
                  {editing !== strategy.id ? (
                    <div className="flex flex-wrap gap-1">
                      <FavoriteButton
                        active={strategy.isFavorite}
                        label={strategy.name}
                        disabled={action.isPending || (!strategy.isFavorite && remaining === 0)}
                        onToggle={() => action.run(() => setFavoriteAction("strategy", { id: strategy.id, favorite: !strategy.isFavorite }))}
                      />
                      <EditButton label="Modifier" onClick={() => setEditing(strategy.id)} />
                      <ConfirmedActionButton
                        label="Retirer"
                        accessibleLabel={`Retirer : ${strategy.name}`}
                        title={`Retirer « ${strategy.name} » de ton plan ?`}
                        description="Tes interventions passées restent intactes."
                        confirmLabel="Retirer"
                        pending={action.isPending}
                        onConfirm={() => action.run(() => deletePlanItemAction("strategy", strategy.id))}
                      />
                    </div>
                  ) : null}
                </div>
                {editing === strategy.id ? <StrategyEditor strategy={strategy} onClose={() => setEditing(null)} /> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {adding ? <AddStrategyForm options={options} onClose={() => setAdding(false)} /> : null}
      <StatusLine error={action.error} saved={action.saved} />
    </PlanSection>
  );
}
