import { OTHER_SLUG, type CheckinStatus } from "@/features/checkin/constants";
import { parseQuantity, type CheckinDraft } from "@/features/checkin/logic";
import type { CatalogueItem, CheckinCatalogues, CheckinRecord } from "@/lib/services/checkins";

/*
 * Représentation d'affichage d'un check-in, commune au résumé du wizard, à /today
 * et à la page de consultation. Construite depuis le brouillon ou depuis la base.
 */

export type CheckinDisplayEvent = {
  key: string;
  substanceName: string;
  quantity: number | null;
  unit: string | null;
  occurredAt: string | null;
  cravingBefore: number | null;
  contextText: string | null;
  reflectionText: string | null;
  nextTimeStrategyText: string | null;
};

export type CheckinDisplay = {
  status: CheckinStatus;
  moodScore: number | null;
  energyScore: number | null;
  stressScore: number | null;
  cravingScore: number | null;
  emotions: string[];
  triggers: string[];
  achievements: string[];
  victoryText: string | null;
  proudOfText: string | null;
  lessonText: string | null;
  tomorrowIntentionText: string | null;
  notes: string | null;
  consumptionEvents: CheckinDisplayEvent[];
};

const nonEmpty = (value: string | null | undefined) => (value?.trim() ? value.trim() : null);

function labelFor(item: CatalogueItem & { customLabel?: string | null }) {
  return item.slug === OTHER_SLUG && item.customLabel?.trim() ? item.customLabel.trim() : item.name;
}

export function recordToDisplay(record: CheckinRecord): CheckinDisplay {
  return {
    status: record.status,
    moodScore: record.moodScore,
    energyScore: record.energyScore,
    stressScore: record.stressScore,
    cravingScore: record.cravingScore,
    emotions: record.emotions.map((emotion) => emotion.name),
    triggers: record.triggers.map(labelFor),
    achievements: record.achievements.map(labelFor),
    victoryText: record.victoryText,
    proudOfText: record.proudOfText,
    lessonText: record.lessonText,
    tomorrowIntentionText: record.tomorrowIntentionText,
    notes: record.notes,
    consumptionEvents: record.consumptionEvents.map((event) => ({ key: event.id, ...event })),
  };
}

export function draftToDisplay(
  draft: CheckinDraft,
  catalogues: CheckinCatalogues,
  substances: readonly { id: string; name: string }[],
): CheckinDisplay | null {
  if (!draft.status) return null;
  const findName = (items: readonly CatalogueItem[], slug: string) =>
    items.find((item) => item.slug === slug)?.name ?? slug;

  return {
    status: draft.status,
    moodScore: draft.moodScore ?? null,
    energyScore: draft.energyScore ?? null,
    stressScore: draft.stressScore ?? null,
    cravingScore: draft.cravingScore ?? null,
    emotions: draft.emotions.map((slug) => findName(catalogues.emotions, slug)),
    triggers: draft.noTrigger
      ? []
      : draft.triggers.map((item) => labelFor({ ...item, name: findName(catalogues.triggers, item.slug) })),
    achievements: draft.achievements.map((item) =>
      labelFor({ ...item, name: findName(catalogues.achievements, item.slug) }),
    ),
    victoryText: nonEmpty(draft.victoryText),
    proudOfText: nonEmpty(draft.proudOfText),
    lessonText: nonEmpty(draft.lessonText),
    tomorrowIntentionText: nonEmpty(draft.tomorrowIntentionText),
    notes: nonEmpty(draft.notes),
    consumptionEvents:
      draft.status === "consumed"
        ? draft.consumptionEvents.map((event) => ({
            key: event.key,
            substanceName: substances.find((substance) => substance.id === event.userSubstanceId)?.name ?? "",
            quantity: parseQuantity(event.quantity) ?? null,
            unit: nonEmpty(event.unit),
            occurredAt: nonEmpty(event.occurredAt),
            cravingBefore: event.cravingBefore ?? null,
            contextText: nonEmpty(event.contextText),
            reflectionText: nonEmpty(event.reflectionText),
            nextTimeStrategyText: nonEmpty(event.nextTimeStrategyText),
          }))
        : [],
  };
}

/** Brouillon du wizard pré-rempli depuis un check-in existant (reprise ou modification). */
export function recordToDraft(record: CheckinRecord): CheckinDraft {
  return {
    status: record.status,
    moodScore: record.moodScore ?? undefined,
    energyScore: record.energyScore ?? undefined,
    stressScore: record.stressScore ?? undefined,
    cravingScore: record.cravingScore ?? undefined,
    emotions: record.emotions.map((emotion) => emotion.slug),
    // Un check-in terminé sans déclencheur : l'utilisateur avait indiqué « aucun ».
    noTrigger: record.completedAt !== null && record.triggers.length === 0,
    triggers: record.triggers.map((item) => ({ slug: item.slug, customLabel: item.customLabel ?? undefined })),
    achievements: record.achievements.map((item) => ({ slug: item.slug, customLabel: item.customLabel ?? undefined })),
    victoryText: record.victoryText ?? "",
    proudOfText: record.proudOfText ?? "",
    lessonText: record.lessonText ?? "",
    tomorrowIntentionText: record.tomorrowIntentionText ?? "",
    notes: record.notes ?? "",
    consumptionEvents: record.consumptionEvents.map((event) => ({
      key: event.id,
      userSubstanceId: event.userSubstanceId,
      quantity: event.quantity !== null ? String(event.quantity).replace(".", ",") : "",
      unit: event.unit ?? "",
      occurredAt: event.occurredAt ?? "",
      cravingBefore: event.cravingBefore ?? undefined,
      contextText: event.contextText ?? "",
      reflectionText: event.reflectionText ?? "",
      nextTimeStrategyText: event.nextTimeStrategyText ?? "",
    })),
  };
}
