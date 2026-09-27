/*
 * Export des données personnelles (Sprint 11, ADR-076) : JSON versionné, structure
 * imbriquée (aucun identifiant interne), libellés des catalogues inclus pour la
 * lisibilité. Fonction pure : testée sans base. Aucun jeton, mot de passe, secret ni
 * donnée interne de Supabase.
 */

export const EXPORT_VERSION = 1;

type Named = { name_fr: string } | null;
type Slugged = { slug: string; name_fr: string } | null;

export type ExportSource = {
  account: { email: string | null; created_at: string | null };
  profile: { display_name: string | null; timezone: string | null; onboarding_completed: boolean; created_at: string } | null;
  substances: {
    custom_name: string | null;
    goal: string;
    started_on: string;
    is_primary: boolean;
    is_active: boolean;
    created_at: string;
    substances: Named;
  }[];
  reasons: { reason_text: string; created_at: string; updated_at: string }[];
  motivations: { motivation: string; custom_label: string | null }[];
  supportContacts: { name: string; relationship: string | null; phone: string | null; email: string | null; is_primary: boolean }[];
  checkins: {
    checkin_date: string;
    status: string;
    mood_score: number | null;
    energy_score: number | null;
    stress_score: number | null;
    craving_score: number | null;
    victory_text: string | null;
    proud_of_text: string | null;
    lesson_text: string | null;
    tomorrow_intention_text: string | null;
    notes: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
    checkin_emotions: { emotions: Slugged }[];
    checkin_triggers: { custom_label: string | null; trigger_types: Slugged }[];
    checkin_achievements: { custom_label: string | null; achievement_types: Slugged }[];
    consumption_events: {
      quantity: number | null;
      unit: string | null;
      occurred_at: string | null;
      craving_before: number | null;
      context_text: string | null;
      reflection_text: string | null;
      next_time_strategy_text: string | null;
      user_substances: { custom_name: string | null; substances: Named } | null;
    }[];
  }[];
  cravingEvents: {
    local_date: string;
    status: string;
    initial_craving_score: number;
    final_craving_score: number | null;
    trigger_unknown: boolean;
    context_text: string | null;
    outcome_text: string | null;
    started_at: string;
    completed_at: string | null;
    craving_event_substances: { user_substances: { custom_name: string | null; substances: Named } | null }[];
    craving_event_emotions: { emotions: Slugged }[];
    craving_event_triggers: { custom_label: string | null; trigger_types: Slugged }[];
    craving_interventions: ExportIntervention | ExportIntervention[] | null;
  }[];
  personalTriggers: { custom_label: string | null; notes: string | null; is_active: boolean; trigger_types: Slugged }[];
  personalStrategies: {
    custom_name: string | null;
    notes: string | null;
    default_duration_minutes: number | null;
    is_favorite: boolean;
    is_active: boolean;
    craving_strategies: Slugged;
  }[];
  safePlaces: { name: string; description: string | null; is_favorite: boolean; is_active: boolean }[];
  reminder: { content: string; updated_at: string } | null;
  letter: { title: string | null; content: string; updated_at: string } | null;
  achievements: { earned_at: string; achievement_definitions: { slug: string; name_fr: string; category: string } | null }[];
};

type ExportIntervention = {
  custom_strategy_text: string | null;
  helped_text: string | null;
  planned_duration_minutes: number | null;
  actual_duration_seconds: number | null;
  started_at: string;
  completed_at: string | null;
  craving_strategies: Slugged;
};

const substanceName = (row: { custom_name: string | null; substances: Named } | null) =>
  row ? row.custom_name?.trim() || row.substances?.name_fr || null : null;

const label = (item: Slugged, custom: string | null = null) => (item ? { slug: item.slug, name: item.name_fr, custom_label: custom } : null);

function firstOf<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function buildDataExport(source: ExportSource, exportedAt: Date = new Date()) {
  return {
    export_version: EXPORT_VERSION,
    exported_at: exportedAt.toISOString(),
    timezone: source.profile?.timezone ?? null,
    account: {
      email: source.account.email,
      display_name: source.profile?.display_name ?? null,
      timezone: source.profile?.timezone ?? null,
      onboarding_completed: source.profile?.onboarding_completed ?? false,
      created_at: source.account.created_at ?? source.profile?.created_at ?? null,
    },
    journey: {
      substances: source.substances.map((row) => ({
        name: substanceName(row),
        goal: row.goal,
        started_on: row.started_on,
        is_primary: row.is_primary,
        is_active: row.is_active,
        created_at: row.created_at,
      })),
      reasons: source.reasons.map((row) => ({ text: row.reason_text, created_at: row.created_at, updated_at: row.updated_at })),
      motivations: source.motivations.map((row) => ({ motivation: row.motivation, custom_label: row.custom_label })),
    },
    checkins: source.checkins.map((row) => ({
      date: row.checkin_date,
      status: row.status,
      scores: { mood: row.mood_score, energy: row.energy_score, stress: row.stress_score, craving: row.craving_score },
      reflection: {
        victory: row.victory_text,
        proud_of: row.proud_of_text,
        lesson: row.lesson_text,
        tomorrow_intention: row.tomorrow_intention_text,
        notes: row.notes,
      },
      emotions: row.checkin_emotions.map((item) => label(item.emotions)).filter(Boolean),
      triggers: row.checkin_triggers.map((item) => label(item.trigger_types, item.custom_label)).filter(Boolean),
      achievements: row.checkin_achievements.map((item) => label(item.achievement_types, item.custom_label)).filter(Boolean),
      consumption_events: row.consumption_events.map((event) => ({
        substance: substanceName(event.user_substances),
        quantity: event.quantity,
        unit: event.unit,
        occurred_at: event.occurred_at,
        craving_before: event.craving_before,
        context: event.context_text,
        reflection: event.reflection_text,
        next_time_strategy: event.next_time_strategy_text,
      })),
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })),
    craving_events: source.cravingEvents.map((row) => {
      const intervention = firstOf(row.craving_interventions);
      return {
        local_date: row.local_date,
        status: row.status,
        initial_craving_score: row.initial_craving_score,
        final_craving_score: row.final_craving_score,
        trigger_unknown: row.trigger_unknown,
        context: row.context_text,
        outcome: row.outcome_text,
        substances: row.craving_event_substances.map((item) => substanceName(item.user_substances)),
        emotions: row.craving_event_emotions.map((item) => label(item.emotions)).filter(Boolean),
        triggers: row.craving_event_triggers.map((item) => label(item.trigger_types, item.custom_label)).filter(Boolean),
        intervention: intervention
          ? {
              strategy: intervention.craving_strategies
                ? { slug: intervention.craving_strategies.slug, name: intervention.craving_strategies.name_fr }
                : null,
              custom_strategy: intervention.custom_strategy_text,
              helped: intervention.helped_text,
              planned_duration_minutes: intervention.planned_duration_minutes,
              actual_duration_seconds: intervention.actual_duration_seconds,
              started_at: intervention.started_at,
              completed_at: intervention.completed_at,
            }
          : null,
        started_at: row.started_at,
        completed_at: row.completed_at,
      };
    }),
    personal_plan: {
      support_contacts: source.supportContacts.map((row) => ({ ...row })),
      triggers: source.personalTriggers.map((row) => ({
        trigger: label(row.trigger_types),
        custom_label: row.custom_label,
        notes: row.notes,
        is_active: row.is_active,
      })),
      strategies: source.personalStrategies.map((row) => ({
        strategy: label(row.craving_strategies),
        custom_name: row.custom_name,
        notes: row.notes,
        default_duration_minutes: row.default_duration_minutes,
        is_favorite: row.is_favorite,
        is_active: row.is_active,
      })),
      safe_places: source.safePlaces.map((row) => ({ ...row })),
      reminder: source.reminder,
      letter: source.letter,
    },
    achievements: source.achievements.map((row) => ({
      slug: row.achievement_definitions?.slug ?? null,
      name: row.achievement_definitions?.name_fr ?? null,
      category: row.achievement_definitions?.category ?? null,
      earned_at: row.earned_at,
    })),
  };
}

export type DataExport = ReturnType<typeof buildDataExport>;

/** Nom de fichier neutre (aucune substance, aucun nom) : « mes-donnees-2026-09-26.json ». */
export function exportFilename(localDate: string): string {
  return `mes-donnees-${localDate}.json`;
}
