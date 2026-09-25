"use server";

import { journalRequestSchema, toSearchJournalParams } from "@/features/journal/logic";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserToday } from "@/lib/dates";
import { getJournalPage, type JournalPage } from "@/lib/services/journal";
import { getCurrentProfile } from "@/lib/services/profiles";

export type JournalLoadResult = ({ status: "ok" } & JournalPage) | { status: "error" };

/**
 * Recherche, filtres et « Afficher plus » du journal. Le terme recherché voyage dans le
 * corps de la requête (Server Action), jamais dans l'URL, et n'est jamais journalisé.
 */
export async function loadJournalEntriesAction(input: unknown): Promise<JournalLoadResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "error" };

  const parsed = journalRequestSchema.safeParse(input);
  if (!parsed.success) return { status: "error" };

  const profile = await getCurrentProfile();
  try {
    const page = await getJournalPage(toSearchJournalParams(parsed.data, getUserToday(profile?.timezone)));
    return { status: "ok", ...page };
  } catch {
    return { status: "error" };
  }
}
