import "server-only";

import type { CheckinStatus } from "@/features/checkin/constants";
import { paginate, type SearchJournalParams } from "@/features/journal/logic";
import { createClient } from "@/lib/supabase/server";

/**
 * Aperçu d'une entrée du journal : uniquement ce qu'affiche la carte.
 * Le détail complet n'est chargé que sur /journal/[date] (getCheckinForDate).
 */
export type JournalEntryPreview = {
  date: string;
  status: CheckinStatus;
  moodScore: number | null;
  stressScore: number | null;
  cravingScore: number | null;
  victoryText: string | null;
  emotions: string[];
  triggers: string[];
};

export type JournalPage = { entries: JournalEntryPreview[]; nextCursor: string | null };

const PREVIEW_SELECT = `
  checkin_date, status, mood_score, stress_score, craving_score, victory_text,
  checkin_emotions ( emotions ( name_fr, sort_order ) ),
  checkin_triggers ( custom_label, trigger_types ( slug, name_fr, sort_order ) )
`;

type PreviewRow = {
  checkin_date: string;
  status: CheckinStatus;
  mood_score: number | null;
  stress_score: number | null;
  craving_score: number | null;
  victory_text: string | null;
  checkin_emotions: { emotions: { name_fr: string; sort_order: number } }[];
  checkin_triggers: { custom_label: string | null; trigger_types: { slug: string; name_fr: string; sort_order: number } }[];
};

/**
 * Une page du journal (20 entrées), filtrée, recherchée et paginée CÔTÉ BASE par
 * search_journal() (ADR-049). Le terme recherché n'est jamais journalisé (ADR-050).
 */
export async function getJournalPage(params: SearchJournalParams): Promise<JournalPage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_journal", params).select(PREVIEW_SELECT);

  if (error) {
    console.error("[journal] Lecture impossible", { code: error.code });
    throw new Error("Le journal n'a pas pu être chargé.");
  }

  const rows = (data ?? []) as unknown as PreviewRow[];
  const previews = rows.map(
    (row): JournalEntryPreview => ({
      date: row.checkin_date,
      status: row.status,
      moodScore: row.mood_score,
      stressScore: row.stress_score,
      cravingScore: row.craving_score,
      victoryText: row.victory_text,
      emotions: [...row.checkin_emotions]
        .sort((a, b) => a.emotions.sort_order - b.emotions.sort_order)
        .map((item) => item.emotions.name_fr),
      triggers: [...row.checkin_triggers]
        .sort((a, b) => a.trigger_types.sort_order - b.trigger_types.sort_order)
        .map((item) => (item.trigger_types.slug === "other" && item.custom_label ? item.custom_label : item.trigger_types.name_fr)),
    }),
  );
  return paginate(previews);
}

/** Journées ENREGISTRÉES (check-ins terminés) précédente et suivante, pour la navigation du détail. */
export async function getAdjacentCheckinDates(
  userId: string,
  date: string,
): Promise<{ previous: string | null; next: string | null }> {
  const supabase = await createClient();
  const [previous, next] = await Promise.all([
    supabase
      .from("daily_checkins")
      .select("checkin_date")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .lt("checkin_date", date)
      .order("checkin_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("daily_checkins")
      .select("checkin_date")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .gt("checkin_date", date)
      .order("checkin_date")
      .limit(1)
      .maybeSingle(),
  ]);

  const error = previous.error ?? next.error;
  if (error) {
    console.error("[journal] Navigation impossible", { code: error.code });
    return { previous: null, next: null };
  }
  return { previous: previous.data?.checkin_date ?? null, next: next.data?.checkin_date ?? null };
}
