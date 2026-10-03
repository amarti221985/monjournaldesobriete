"use client";

import { Plus, Trash2 } from "lucide-react";

import { FormField, getFieldControlProps, getFieldErrorId } from "@/components/forms/form-field";
import { SelectableChip } from "@/components/forms/selectable-chip";
import { SelectableOption } from "@/components/forms/selectable-option";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { dayVisualStatusConfig } from "@/config/day-status";
import {
  CHECKIN_STATUSES,
  MAX_CONSUMPTION_EVENTS,
  OTHER_SLUG,
  scoreDefinitions,
  statusOptions,
  TEXT_LIMITS,
  type CheckinStatus,
} from "@/features/checkin/constants";
import { ScoreScale } from "@/features/checkin/components/score-scale";
import { forCheckinDay } from "@/features/checkin/components/step-content";
import {
  toggleLabelledSelection,
  toggleNoTrigger,
  type CheckinDraft,
  type ConsumptionEventDraft,
  type LabelledSelection,
  type StepErrors,
} from "@/features/checkin/logic";
import type { CatalogueItem, EmotionItem } from "@/lib/services/checkins";

export type CheckinStepProps = {
  draft: CheckinDraft;
  onChange: (patch: Partial<CheckinDraft>) => void;
  errors: StepErrors;
};

function GroupError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={getFieldErrorId(id)} className="text-sm font-medium text-destructive">
      {message}
    </p>
  );
}

/** Zone de texte facultative avec compteur (limites identiques à la base). */
function OptionalTextarea({
  id,
  label,
  value,
  max,
  placeholder,
  error,
  onChange,
  rows = 3,
}: {
  id: string;
  label: string;
  value: string;
  max: number;
  placeholder?: string;
  error?: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <FormField id={id} label={label} error={error}>
      <Textarea
        {...getFieldControlProps(id, { error })}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={max}
        rows={rows}
        placeholder={placeholder}
        className="min-h-24 bg-card px-3.5 py-3"
      />
    </FormField>
  );
}

// --- Étape 1 : Ma journée -------------------------------------------------------

export function StatusStep({
  draft,
  errors,
  onStatusChange,
  isPastDay = false,
}: CheckinStepProps & { onStatusChange: (status: CheckinStatus) => void; isPastDay?: boolean }) {
  return (
    <fieldset
      id="status"
      tabIndex={-1}
      aria-describedby={errors.status ? getFieldErrorId("status") : undefined}
      className="grid gap-3 outline-none"
    >
      <legend className="sr-only">Comment s&apos;est passée ta journée?</legend>
      {CHECKIN_STATUSES.map((status) => {
        const option = statusOptions[status];
        const Icon = dayVisualStatusConfig[option.visualStatus].icon;
        return (
          <SelectableOption
            key={status}
            type="radio"
            name="status"
            value={status}
            label={option.label}
            description={forCheckinDay(option.description, isPastDay)}
            icon={<Icon className="size-5" />}
            checked={draft.status === status}
            onCheckedChange={(checked) => checked && onStatusChange(status)}
          />
        );
      })}
      <GroupError id="status" message={errors.status} />
    </fieldset>
  );
}

// --- Étape 2 : Comment je me sens ------------------------------------------------

export function ScoresStep({ draft, onChange, errors }: CheckinStepProps) {
  return (
    <div className="grid gap-7">
      {scoreDefinitions.map((definition) => (
        <ScoreScale
          key={definition.key}
          id={definition.key}
          label={definition.label}
          min={definition.min}
          max={definition.max}
          minLabel={definition.minLabel}
          maxLabel={definition.maxLabel}
          value={draft[definition.key]}
          onChange={(value) => onChange({ [definition.key]: value })}
          error={errors[definition.key]}
        />
      ))}
    </div>
  );
}

// --- Étape 3 : Émotions ----------------------------------------------------------

export function EmotionsStep({ draft, onChange, emotions }: CheckinStepProps & { emotions: EmotionItem[] }) {
  const groups = [
    { title: "Agréables", items: emotions.filter((emotion) => emotion.category === "positive") },
    { title: "Difficiles", items: emotions.filter((emotion) => emotion.category === "difficult") },
  ];

  function toggle(slug: string, checked: boolean) {
    onChange({
      emotions: checked ? [...draft.emotions, slug] : draft.emotions.filter((item) => item !== slug),
    });
  }

  return (
    <div className="grid gap-6">
      {groups.map((group) => (
        <fieldset key={group.title} className="grid gap-3">
          <legend className="mb-3 text-sm font-medium text-muted-foreground">{group.title}</legend>
          <div className="flex flex-wrap gap-2">
            {group.items.map((emotion) => (
              <SelectableChip
                key={emotion.slug}
                name="emotions"
                value={emotion.slug}
                label={emotion.name}
                checked={draft.emotions.includes(emotion.slug)}
                onCheckedChange={(checked) => toggle(emotion.slug, checked)}
              />
            ))}
          </div>
        </fieldset>
      ))}
      <p className="text-sm text-muted-foreground">Facultatif. Choisis autant d&apos;émotions que tu veux.</p>
    </div>
  );
}

// --- Sélections avec « Autre » (déclencheurs, accomplissements) ------------------

function LabelledChoices({
  name,
  items,
  selected,
  onSelectedChange,
  otherInputId,
  otherError,
}: {
  name: string;
  items: CatalogueItem[];
  selected: LabelledSelection[];
  onSelectedChange: (selected: LabelledSelection[]) => void;
  otherInputId: string;
  otherError?: string;
}) {
  const other = selected.find((item) => item.slug === OTHER_SLUG);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <SelectableChip
            key={item.slug}
            name={name}
            value={item.slug}
            label={item.name}
            checked={selected.some((choice) => choice.slug === item.slug)}
            onCheckedChange={(checked) => onSelectedChange(toggleLabelledSelection(selected, item.slug, checked))}
          />
        ))}
      </div>
      {other ? (
        <FormField id={otherInputId} label="Précise si tu le souhaites" error={otherError}>
          <Input
            {...getFieldControlProps(otherInputId, { error: otherError })}
            value={other.customLabel ?? ""}
            maxLength={TEXT_LIMITS.customLabel}
            autoComplete="off"
            onChange={(event) =>
              onSelectedChange(
                selected.map((item) =>
                  item.slug === OTHER_SLUG ? { ...item, customLabel: event.target.value } : item,
                ),
              )
            }
          />
        </FormField>
      ) : null}
    </div>
  );
}

// --- Étape 4 : Déclencheurs ------------------------------------------------------

export function TriggersStep({ draft, onChange, errors, triggers }: CheckinStepProps & { triggers: CatalogueItem[] }) {
  return (
    <fieldset className="grid gap-4">
      <legend className="sr-only">Déclencheurs rencontrés aujourd&apos;hui</legend>
      <SelectableChip
        name="noTrigger"
        value="none"
        label="Aucun déclencheur particulier"
        checked={draft.noTrigger}
        onCheckedChange={(checked) => onChange(toggleNoTrigger(checked))}
        className="justify-self-start"
      />
      <LabelledChoices
        name="triggers"
        items={triggers}
        selected={draft.triggers}
        onSelectedChange={(selected) => onChange({ triggers: selected, noTrigger: false })}
        otherInputId="triggerOther"
        otherError={errors.triggerOther}
      />
    </fieldset>
  );
}

// --- Étape conditionnelle : Consommation -----------------------------------------

type TrackedSubstanceOption = { id: string; name: string };

function EventCard({
  event,
  index,
  substanceName,
  errors,
  onChange,
  onRemove,
}: {
  event: ConsumptionEventDraft;
  index: number;
  substanceName: string;
  errors: StepErrors;
  onChange: (patch: Partial<ConsumptionEventDraft>) => void;
  onRemove: () => void;
}) {
  const fieldId = (field: string) => `event-${event.key}-${field}`;
  const quantityError = errors[fieldId("quantity")];

  return (
    <li className="grid gap-5 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">
          {substanceName}
          <span className="sr-only"> — consommation {index + 1}</span>
        </h3>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label={`Retirer : ${substanceName}`}>
          <Trash2 data-icon="inline-start" aria-hidden="true" />
          Retirer
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={fieldId("quantity")} label="Quantité approximative" error={quantityError}>
          <Input
            {...getFieldControlProps(fieldId("quantity"), { error: quantityError })}
            inputMode="decimal"
            value={event.quantity}
            onChange={(changeEvent) => onChange({ quantity: changeEvent.target.value })}
            placeholder="Facultatif"
            autoComplete="off"
          />
        </FormField>
        <FormField id={fieldId("unit")} label="Unité" error={errors[fieldId("unit")]}>
          <Input
            {...getFieldControlProps(fieldId("unit"), { error: errors[fieldId("unit")] })}
            value={event.unit}
            maxLength={TEXT_LIMITS.unit}
            onChange={(changeEvent) => onChange({ unit: changeEvent.target.value })}
            placeholder="verres, joints, cigarettes…"
            autoComplete="off"
          />
        </FormField>
      </div>

      <FormField id={fieldId("occurredAt")} label="À quel moment environ?">
        <Input
          {...getFieldControlProps(fieldId("occurredAt"), {})}
          type="time"
          value={event.occurredAt}
          onChange={(changeEvent) => onChange({ occurredAt: changeEvent.target.value })}
          className="w-full sm:w-40"
        />
      </FormField>

      <ScoreScale
        id={fieldId("cravingBefore")}
        label="À combien était ton envie juste avant?"
        min={0}
        max={10}
        minLabel="Aucune"
        maxLabel="Très forte"
        value={event.cravingBefore}
        onChange={(value) => onChange({ cravingBefore: value })}
        optional
      />

      <OptionalTextarea
        id={fieldId("contextText")}
        label="Que se passait-il juste avant?"
        value={event.contextText}
        max={TEXT_LIMITS.eventText}
        error={errors[fieldId("contextText")]}
        onChange={(value) => onChange({ contextText: value })}
      />
      <OptionalTextarea
        id={fieldId("reflectionText")}
        label="Qu'est-ce que tu retiens de cette situation?"
        value={event.reflectionText}
        max={TEXT_LIMITS.eventText}
        error={errors[fieldId("reflectionText")]}
        onChange={(value) => onChange({ reflectionText: value })}
      />
      <OptionalTextarea
        id={fieldId("nextTimeStrategyText")}
        label="Qu'est-ce qui pourrait t'aider si une situation semblable se reproduit?"
        value={event.nextTimeStrategyText}
        max={TEXT_LIMITS.eventText}
        error={errors[fieldId("nextTimeStrategyText")]}
        onChange={(value) => onChange({ nextTimeStrategyText: value })}
      />
    </li>
  );
}

export function ConsumptionStep({
  draft,
  onChange,
  errors,
  substances,
  onAddEvent,
}: CheckinStepProps & {
  substances: TrackedSubstanceOption[];
  onAddEvent: (userSubstanceId: string) => void;
}) {
  const events = draft.consumptionEvents;
  const canAdd = events.length < MAX_CONSUMPTION_EVENTS;

  function updateEvent(key: string, patch: Partial<ConsumptionEventDraft>) {
    onChange({ consumptionEvents: events.map((event) => (event.key === key ? { ...event, ...patch } : event)) });
  }

  return (
    <div className="grid gap-6">
      <p className="rounded-xl bg-muted p-4 text-sm text-pretty">
        Merci d&apos;avoir pris le temps de noter ce qui s&apos;est passé. Cette journée fait partie de ton
        parcours, et ton historique reste intact.
      </p>

      <fieldset
        id="consumptionEvents"
        tabIndex={-1}
        aria-describedby={errors.consumptionEvents ? getFieldErrorId("consumptionEvents") : undefined}
        className="grid gap-3 outline-none"
      >
        <legend className="mb-1 font-medium">Qu&apos;as-tu consommé?</legend>
        <p className="text-sm text-muted-foreground">
          Ajoute une ligne par consommation. Les détails sont facultatifs.
        </p>
        <div className="flex flex-wrap gap-2">
          {substances.map((substance) => (
            <Button
              key={substance.id}
              type="button"
              variant="outline"
              onClick={() => onAddEvent(substance.id)}
              disabled={!canAdd}
            >
              <Plus data-icon="inline-start" aria-hidden="true" />
              {substance.name}
            </Button>
          ))}
        </div>
        <GroupError id="consumptionEvents" message={errors.consumptionEvents} />
      </fieldset>

      {events.length > 0 ? (
        <ul className="grid gap-4">
          {events.map((event, index) => (
            <EventCard
              key={event.key}
              event={event}
              index={index}
              substanceName={substances.find((substance) => substance.id === event.userSubstanceId)?.name ?? ""}
              errors={errors}
              onChange={(patch) => updateEvent(event.key, patch)}
              onRemove={() => onChange({ consumptionEvents: events.filter((item) => item.key !== event.key) })}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// --- Étape : Mes actions et victoires ---------------------------------------------

export function AchievementsStep({
  draft,
  onChange,
  errors,
  achievements,
}: CheckinStepProps & { achievements: CatalogueItem[] }) {
  return (
    <div className="grid gap-6">
      <fieldset className="grid gap-3">
        <legend className="sr-only">Ce que j&apos;ai accompli aujourd&apos;hui</legend>
        <LabelledChoices
          name="achievements"
          items={achievements}
          selected={draft.achievements}
          onSelectedChange={(selected) => onChange({ achievements: selected })}
          otherInputId="achievementOther"
          otherError={errors.achievementOther}
        />
      </fieldset>
      <OptionalTextarea
        id="victoryText"
        label="Ma victoire du jour"
        value={draft.victoryText}
        max={TEXT_LIMITS.victoryText}
        placeholder="Même une petite victoire compte..."
        error={errors.victoryText}
        onChange={(value) => onChange({ victoryText: value })}
      />
    </div>
  );
}

// --- Étape : Réflexion --------------------------------------------------------------

export function ReflectionStep({ draft, onChange, errors, isPastDay = false }: CheckinStepProps & { isPastDay?: boolean }) {
  return (
    <div className="grid gap-5">
      <OptionalTextarea
        id="proudOfText"
        label={forCheckinDay("De quoi es-tu fier ou fière aujourd'hui?", isPastDay)}
        value={draft.proudOfText}
        max={TEXT_LIMITS.proudOfText}
        error={errors.proudOfText}
        onChange={(value) => onChange({ proudOfText: value })}
      />
      <OptionalTextarea
        id="lessonText"
        label={forCheckinDay("Qu'as-tu appris aujourd'hui?", isPastDay)}
        value={draft.lessonText}
        max={TEXT_LIMITS.lessonText}
        error={errors.lessonText}
        onChange={(value) => onChange({ lessonText: value })}
      />
      <OptionalTextarea
        id="tomorrowIntentionText"
        label={forCheckinDay("Quelle est ton intention pour demain?", isPastDay)}
        value={draft.tomorrowIntentionText}
        max={TEXT_LIMITS.tomorrowIntentionText}
        error={errors.tomorrowIntentionText}
        onChange={(value) => onChange({ tomorrowIntentionText: value })}
      />
      <details className="group rounded-xl border bg-card px-4 py-3" open={draft.notes.trim() !== "" || undefined}>
        <summary className="min-h-8 cursor-pointer text-sm font-medium text-muted-foreground">
          Ajouter d&apos;autres notes
        </summary>
        <div className="mt-3">
          <OptionalTextarea
            id="notes"
            label="Autres notes"
            value={draft.notes}
            max={TEXT_LIMITS.notes}
            error={errors.notes}
            onChange={(value) => onChange({ notes: value })}
            rows={4}
          />
        </div>
      </details>
    </div>
  );
}
