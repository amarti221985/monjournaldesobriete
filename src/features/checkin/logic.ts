import {
  checkinSteps,
  MAX_QUANTITY,
  OTHER_SLUG,
  scoreDefinitions,
  TEXT_LIMITS,
  type CheckinStatus,
  type CheckinStepId,
  type ScoreKey,
} from "@/features/checkin/constants";

/*
 * Logique pure du check-in (testée) : état du formulaire, étapes conditionnelles,
 * validation par étape, conversion vers le payload de save_checkin().
 */

export type LabelledSelection = { slug: string; customLabel?: string };

export type ConsumptionEventDraft = {
  /** Clé locale stable pour l'affichage (jamais envoyée au serveur). */
  key: string;
  userSubstanceId: string;
  /** Saisie libre (« 2 », « 1,5 »), convertie à l'envoi. */
  quantity: string;
  unit: string;
  occurredAt: string;
  cravingBefore?: number;
  contextText: string;
  reflectionText: string;
  nextTimeStrategyText: string;
};

export type CheckinDraft = {
  status?: CheckinStatus;
  moodScore?: number;
  energyScore?: number;
  stressScore?: number;
  cravingScore?: number;
  emotions: string[];
  /** « Aucun déclencheur particulier » : état d'interface, jamais stocké. */
  noTrigger: boolean;
  triggers: LabelledSelection[];
  achievements: LabelledSelection[];
  victoryText: string;
  proudOfText: string;
  lessonText: string;
  tomorrowIntentionText: string;
  notes: string;
  consumptionEvents: ConsumptionEventDraft[];
};

export type StepErrors = Record<string, string>;

export function createEmptyDraft(): CheckinDraft {
  return {
    emotions: [],
    noTrigger: false,
    triggers: [],
    achievements: [],
    victoryText: "",
    proudOfText: "",
    lessonText: "",
    tomorrowIntentionText: "",
    notes: "",
    consumptionEvents: [],
  };
}

export function createEmptyEvent(key: string, userSubstanceId: string): ConsumptionEventDraft {
  return {
    key,
    userSubstanceId,
    quantity: "",
    unit: "",
    occurredAt: "",
    contextText: "",
    reflectionText: "",
    nextTimeStrategyText: "",
  };
}

/** Étapes du wizard : l'étape consommation n'existe que pour une journée avec consommation. */
export function getCheckinSteps(status: CheckinStatus | undefined): CheckinStepId[] {
  return checkinSteps
    .map((step) => step.id)
    .filter((id) => id !== "consumption" || status === "consumed");
}

/**
 * Quantité saisie : « 2 », « 1,5 » ou « 1.5 ». Vide → null (facultatif).
 * Retourne `undefined` si la saisie n'est pas un nombre valide.
 */
export function parseQuantity(input: string): number | null | undefined {
  const normalized = input.trim().replace(",", ".");
  if (normalized === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return undefined;
  const value = Number(normalized);
  return value > 0 && value <= MAX_QUANTITY ? value : undefined;
}

/** Sélection « Aucun déclencheur particulier » : désélectionne les autres (et inversement). */
export function toggleNoTrigger(checked: boolean): Partial<CheckinDraft> {
  return checked ? { noTrigger: true, triggers: [] } : { noTrigger: false };
}

export function toggleLabelledSelection(
  selections: readonly LabelledSelection[],
  slug: string,
  checked: boolean,
): LabelledSelection[] {
  return checked
    ? [...selections.filter((item) => item.slug !== slug), { slug }]
    : selections.filter((item) => item.slug !== slug);
}

function textLengthError(value: string, max: number) {
  return value.trim().length > max ? `${max} caractères maximum.` : undefined;
}

/** Validation d'une étape avant de passer à la suivante (messages affichés près des champs). */
export function validateCheckinStep(stepId: CheckinStepId, draft: CheckinDraft): StepErrors {
  const errors: StepErrors = {};
  const set = (key: string, message: string | undefined) => {
    if (message) errors[key] = message;
  };

  switch (stepId) {
    case "status":
      if (!draft.status) errors.status = "Choisis comment s'est passée ta journée.";
      break;

    case "scores":
      for (const definition of scoreDefinitions) {
        if (draft[definition.key] === undefined) errors[definition.key] = "Choisis une valeur.";
      }
      break;

    case "emotions":
      break;

    case "triggers":
      for (const trigger of draft.triggers) {
        if (trigger.slug === OTHER_SLUG) {
          set("triggerOther", textLengthError(trigger.customLabel ?? "", TEXT_LIMITS.customLabel));
        }
      }
      break;

    case "consumption":
      if (draft.consumptionEvents.length === 0) {
        errors.consumptionEvents = "Indique au moins ce que tu as consommé.";
      }
      draft.consumptionEvents.forEach((event) => {
        if (parseQuantity(event.quantity) === undefined) {
          errors[`event-${event.key}-quantity`] = "Indique un nombre (ex. 2 ou 1,5), ou laisse vide.";
        }
        set(`event-${event.key}-unit`, textLengthError(event.unit, TEXT_LIMITS.unit));
        for (const field of ["contextText", "reflectionText", "nextTimeStrategyText"] as const) {
          set(`event-${event.key}-${field}`, textLengthError(event[field], TEXT_LIMITS.eventText));
        }
      });
      break;

    case "achievements":
      for (const achievement of draft.achievements) {
        if (achievement.slug === OTHER_SLUG) {
          set("achievementOther", textLengthError(achievement.customLabel ?? "", TEXT_LIMITS.customLabel));
        }
      }
      set("victoryText", textLengthError(draft.victoryText, TEXT_LIMITS.victoryText));
      break;

    case "reflection":
      set("proudOfText", textLengthError(draft.proudOfText, TEXT_LIMITS.proudOfText));
      set("lessonText", textLengthError(draft.lessonText, TEXT_LIMITS.lessonText));
      set("tomorrowIntentionText", textLengthError(draft.tomorrowIntentionText, TEXT_LIMITS.tomorrowIntentionText));
      set("notes", textLengthError(draft.notes, TEXT_LIMITS.notes));
      break;

    case "summary":
      for (const step of getCheckinSteps(draft.status)) {
        if (step === "summary") continue;
        if (Object.keys(validateCheckinStep(step, draft)).length > 0) {
          errors.form = "Certaines réponses sont incomplètes. Utilise « Modifier » pour les vérifier.";
          break;
        }
      }
      break;
  }

  return errors;
}

function hasText(...values: string[]) {
  return values.some((value) => value.trim() !== "");
}

/** Vrai si l'utilisateur a déjà renseigné quelque chose à cette étape. */
function stepHasData(stepId: CheckinStepId, draft: CheckinDraft): boolean {
  switch (stepId) {
    case "status":
      return draft.status !== undefined;
    case "scores":
      return scoreDefinitions.some((definition) => draft[definition.key] !== undefined);
    case "emotions":
      return draft.emotions.length > 0;
    case "triggers":
      return draft.noTrigger || draft.triggers.length > 0;
    case "consumption":
      return draft.consumptionEvents.length > 0;
    case "achievements":
      return draft.achievements.length > 0 || hasText(draft.victoryText);
    case "reflection":
      return hasText(draft.proudOfText, draft.lessonText, draft.tomorrowIntentionText, draft.notes);
    case "summary":
      return false;
  }
}

/**
 * Étape de reprise d'un brouillon : juste après la dernière étape renseignée,
 * sans jamais dépasser la première étape incomplète.
 */
export function getResumeStepIndex(draft: CheckinDraft): number {
  const steps = getCheckinSteps(draft.status);
  const firstInvalid = steps.findIndex(
    (step) => step !== "summary" && Object.keys(validateCheckinStep(step, draft)).length > 0,
  );
  let lastWithData = -1;
  steps.forEach((step, index) => {
    if (stepHasData(step, draft)) lastWithData = index;
  });
  const afterLastData = Math.min(lastWithData + 1, steps.length - 1);
  return firstInvalid >= 0 ? Math.min(firstInvalid, afterLastData) : afterLastData;
}

/** Événement brut : nettoyé et validé ensuite par consumptionEventSchema (serveur). */
function eventToPayload(event: ConsumptionEventDraft) {
  return {
    userSubstanceId: event.userSubstanceId,
    quantity: parseQuantity(event.quantity) ?? undefined,
    unit: event.unit,
    occurredAt: event.occurredAt,
    cravingBefore: event.cravingBefore,
    contextText: event.contextText,
    reflectionText: event.reflectionText,
    nextTimeStrategyText: event.nextTimeStrategyText,
  };
}

/**
 * Payload de save_checkin(). Les consommations ne sont envoyées que pour une journée
 * « consumed » ; « Aucun déclencheur particulier » = aucune ligne de déclencheur.
 */
export function buildCheckinPayload(draft: CheckinDraft, checkinDate: string) {
  const scores: Partial<Record<ScoreKey, number>> = {};
  for (const definition of scoreDefinitions) {
    const value = draft[definition.key];
    if (value !== undefined) scores[definition.key] = value;
  }

  return {
    checkinDate,
    status: draft.status,
    ...scores,
    emotions: draft.emotions,
    triggers: draft.noTrigger ? [] : draft.triggers,
    achievements: draft.achievements,
    victoryText: draft.victoryText,
    proudOfText: draft.proudOfText,
    lessonText: draft.lessonText,
    tomorrowIntentionText: draft.tomorrowIntentionText,
    notes: draft.notes,
    consumptionEvents: draft.status === "consumed" ? draft.consumptionEvents.map(eventToPayload) : [],
  };
}

/** Vrai si changer de statut retirerait des consommations déjà notées (confirmation requise). */
export function statusChangeDropsEvents(draft: CheckinDraft, nextStatus: CheckinStatus): boolean {
  return draft.status === "consumed" && nextStatus !== "consumed" && draft.consumptionEvents.length > 0;
}
