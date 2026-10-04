"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { routes } from "@/config/routes";
import { FEEDBACK_STATUSES } from "@/features/admin/analytics/definitions";
import { getIsAdmin } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { revealAccountEmail, setFeedbackStatus } from "@/lib/services/admin";

/*
 * Mutations de l'administration (Admin V1). Server Actions : contrôle d'origine intégré de
 * Next.js (même origine), session + rôle vérifiés ici, puis revérifiés par la RPC en base.
 * Les deux actions sont journalisées par la base (admin_audit_log).
 */

async function isAuthorized(): Promise<boolean> {
  return Boolean(await getCurrentUser()) && (await getIsAdmin());
}

export async function setFeedbackStatusAction(input: unknown): Promise<{ ok: boolean }> {
  if (!(await isAuthorized())) return { ok: false };
  const parsed = z.object({ id: z.uuid(), status: z.enum(FEEDBACK_STATUSES) }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const ok = await setFeedbackStatus(parsed.data.id, parsed.data.status);
  if (ok) {
    revalidatePath(routes.adminFeedback);
    revalidatePath(routes.admin);
  }
  return { ok };
}

/** Informations de compte pour le support : action volontaire et journalisée. */
export async function revealAccountEmailAction(code: unknown): Promise<{ email: string | null }> {
  if (!(await isAuthorized())) return { email: null };
  const parsed = z.string().regex(/^[0-9A-F]{8}$/).safeParse(code);
  if (!parsed.success) return { email: null };
  try {
    return { email: await revealAccountEmail(parsed.data) };
  } catch {
    return { email: null };
  }
}
