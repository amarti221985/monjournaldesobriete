import "server-only";

import {
  buildFeedbackEmail,
  resolveFeedbackNotificationConfig,
  type FeedbackNotificationConfig,
} from "@/features/feedback/notification";
import type { FeedbackInput } from "@/features/feedback/schema";
import { cleanEnvValue } from "@/lib/env";

/*
 * Envoi des notifications d'avis bêta par Resend (API HTTP, côté serveur uniquement).
 * Variables : RESEND_API_KEY, FEEDBACK_NOTIFY_EMAIL, FEEDBACK_FROM_EMAIL (facultative).
 * Journaux : code HTTP seulement, jamais le message.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 8000;

const readEnv = (name: string) => {
  const value = cleanEnvValue(process.env[name]);
  return typeof value === "string" ? value : undefined;
};

function getConfig(): FeedbackNotificationConfig | null {
  return resolveFeedbackNotificationConfig({
    apiKey: readEnv("RESEND_API_KEY"),
    to: readEnv("FEEDBACK_NOTIFY_EMAIL"),
    from: readEnv("FEEDBACK_FROM_EMAIL"),
  });
}

/** Diagnostic de déploiement (jamais la clé ni l'adresse). */
export function getFeedbackNotificationDiagnostics(): { configured: boolean } {
  return { configured: getConfig() !== null };
}

/**
 * Prévient le propriétaire d'un nouvel avis. Ne lève jamais d'erreur : l'avis est déjà
 * enregistré en base, la notification est un complément.
 */
export async function notifyFeedback(feedback: FeedbackInput): Promise<boolean> {
  const config = getConfig();
  if (!config) return false;
  const email = buildFeedbackEmail(feedback);
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.from, to: [config.to], subject: email.subject, text: email.text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error("[feedback] Notification refusée", { status: response.status });
      return false;
    }
    return true;
  } catch (error) {
    console.error("[feedback] Notification impossible", { error: error instanceof Error ? error.name : "inconnue" });
    return false;
  }
}
