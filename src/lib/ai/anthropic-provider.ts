import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import type { WeeklyInsightDataset } from "@/lib/ai/dataset";
import { cleanEnvValue } from "@/lib/env";
import { buildWeeklyReflectionUserMessage, WEEKLY_REFLECTION_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import type { AiProvider, ProviderOutcome } from "@/lib/ai/provider";
import { weeklyReflectionModelSchema } from "@/lib/ai/schemas";

/*
 * Fournisseur Anthropic (Claude), côté serveur uniquement. Clé lue dans ANTHROPIC_API_KEY
 * (jamais NEXT_PUBLIC_). Sortie structurée validée par le SDK puis par nos garde-fous.
 * Journaux : identifiant de requête, modèle, statut, latence, jetons — jamais le contenu.
 */

export const DEFAULT_AI_MODEL = "claude-opus-5";
const REQUEST_TIMEOUT_MS = 60_000;

function logRequest(details: Record<string, string | number | null | undefined>) {
  console.info("[ai] bilan", details);
}

/** Le paramètre « effort » n'est pas accepté par les modèles Haiku (400 sinon). */
export function supportsEffort(model: string): boolean {
  return !/haiku/i.test(model);
}

/** Type et message d'une erreur de l'API (messages techniques de validation, jamais le contenu envoyé). */
function apiErrorDetails(error: InstanceType<typeof Anthropic.APIError>) {
  const body = error.error as { error?: { type?: unknown; message?: unknown } } | undefined;
  const type = typeof body?.error?.type === "string" ? body.error.type : null;
  const message = typeof body?.error?.message === "string" ? body.error.message.slice(0, 200) : null;
  return { status: error.status ?? null, error_type: type, error_message: message, request_id: error.requestID ?? null };
}

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  readonly model: string;
  private readonly client: Anthropic;

  constructor(apiKey: string, model: string = DEFAULT_AI_MODEL) {
    this.model = model;
    this.client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
  }

  async generateWeeklyReflection(dataset: WeeklyInsightDataset): Promise<ProviderOutcome> {
    const started = Date.now();
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 4000,
        system: [{ type: "text", text: WEEKLY_REFLECTION_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        output_config: {
          ...(supportsEffort(this.model) ? { effort: "medium" as const } : {}),
          format: zodOutputFormat(weeklyReflectionModelSchema),
        },
        messages: [{ role: "user", content: buildWeeklyReflectionUserMessage(dataset) }],
      });
      logRequest({
        request_id: response._request_id ?? null,
        model: response.model,
        stop_reason: response.stop_reason,
        latency_ms: Date.now() - started,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      });
      if (response.stop_reason === "refusal") return { ok: false, reason: "refusal" };
      if (!response.parsed_output) {
        logRequest({ status: "unparsed_output", stop_reason: response.stop_reason });
        return { ok: false, reason: "invalid_output" };
      }
      return { ok: true, output: response.parsed_output };
    } catch (error) {
      const latency = Date.now() - started;
      if (error instanceof Anthropic.APIConnectionTimeoutError) {
        logRequest({ status: "timeout", latency_ms: latency });
        return { ok: false, reason: "timeout" };
      }
      if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
        logRequest({ ...apiErrorDetails(error), latency_ms: latency });
        return { ok: false, reason: "unavailable" };
      }
      if (error instanceof Anthropic.APIError) {
        logRequest({ ...apiErrorDetails(error), latency_ms: latency });
        return { ok: false, reason: "error" };
      }
      logRequest({ status: "exception", error_name: error instanceof Error ? error.name : null, latency_ms: latency });
      return { ok: false, reason: "error" };
    }
  }
}

/**
 * Fournisseur configuré, ou null si aucune clé n'est définie (la fonctionnalité affiche
 * alors « pas encore configurée » ; aucune donnée n'est envoyée).
 */
function readAiEnv(): { apiKey: string | undefined; model: string } {
  // Guillemets et espaces retirés (valeur collée « KEY="…" » dans le panneau d'hébergement).
  const apiKey = cleanEnvValue(process.env["ANTHROPIC_API_KEY"]);
  const model = cleanEnvValue(process.env["AI_MODEL"]);
  return { apiKey: typeof apiKey === "string" ? apiKey : undefined, model: typeof model === "string" ? model : DEFAULT_AI_MODEL };
}

export function getConfiguredAiProvider(): AiProvider | null {
  const { apiKey, model } = readAiEnv();
  if (!apiKey) return null;
  return new AnthropicProvider(apiKey, model);
}

/** Diagnostic de déploiement : clé présente et bien formée ? modèle utilisé. Jamais la clé. */
export function getAiConfigDiagnostics(): { configured: boolean; keyFormat: "ok" | "missing" | "unexpected"; model: string } {
  const { apiKey, model } = readAiEnv();
  return { configured: Boolean(apiKey), keyFormat: !apiKey ? "missing" : apiKey.startsWith("sk-ant-") ? "ok" : "unexpected", model };
}
