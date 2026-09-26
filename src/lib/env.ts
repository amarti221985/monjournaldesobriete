import { z } from "zod";

/**
 * Validation centralisée des variables d'environnement PUBLIQUES.
 *
 * - Validation paresseuse : une variable n'est vérifiée qu'au moment où elle est
 *   utilisée. Le build d'une page qui n'utilise pas Supabase ne dépend donc pas
 *   de la présence des clés.
 * - Les variables NEXT_PUBLIC_* doivent être lues avec un accès statique
 *   (process.env.NEXT_PUBLIC_X) pour être intégrées au bundle client.
 * - Les secrets serveur (ex. SUPABASE_SERVICE_ROLE_KEY) ne doivent JAMAIS être
 *   ajoutés ici : ils auront leur propre module server-only lorsqu'ils seront
 *   nécessaires.
 */

type EnvSource = Record<string, string | undefined>;

/**
 * Nettoie une valeur saisie dans un panneau d'hébergement : espaces et guillemets
 * entourants retirés (copie de « KEY="valeur" »). Vide → absente.
 */
export function cleanEnvValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const clean = value.trim().replace(/^(["'])(.*)\1$/, "$2").trim();
  return clean === "" ? undefined : clean;
}

const emptyToUndefined = cleanEnvValue;

const httpUrl = z.url({ protocol: /^https?$/ });

const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(emptyToUndefined, httpUrl),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.preprocess(
    emptyToUndefined,
    z.string().min(1),
  ),
});

const siteEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.preprocess(
    emptyToUndefined,
    httpUrl.default("http://localhost:3000"),
  ),
});

export type SupabaseEnv = {
  url: string;
  publishableKey: string;
};

export class EnvValidationError extends Error {
  constructor(variables: string[]) {
    super(
      `Variables d'environnement manquantes ou invalides : ${variables.join(", ")}. ` +
        "Copie .env.example vers .env.local et renseigne les valeurs (voir README).",
    );
    this.name = "EnvValidationError";
  }
}

function formatIssues(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((issue) => issue.path.join(".")))];
}

export function parseSupabaseEnv(source: EnvSource): SupabaseEnv {
  const result = supabaseEnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(formatIssues(result.error));
  }
  return {
    url: result.data.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: result.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function parseSiteUrl(source: EnvSource): URL {
  const result = siteEnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(formatIssues(result.error));
  }
  return new URL(result.data.NEXT_PUBLIC_SITE_URL);
}

/**
 * Lecture DYNAMIQUE côté serveur (process.env[name] n'est pas figé au build).
 * Certains hébergeurs (Hostinger) ne fournissent les variables qu'au démarrage :
 * la valeur figée au build est alors vide et on relit la variable à l'exécution.
 * Dans le navigateur, process.env est vide : seule la valeur figée compte.
 */
function readRuntimeEnv(name: string): string | undefined {
  return typeof process === "undefined" ? undefined : process.env[name];
}

let supabaseEnv: SupabaseEnv | undefined;

/** Configuration Supabase publique, validée au premier appel. */
export function getSupabaseEnv(): SupabaseEnv {
  supabaseEnv ??= parseSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || readRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      readRuntimeEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  });
  return supabaseEnv;
}

export type EnvVariableState = "ok" | "missing" | "invalid";

/** État de chaque variable Supabase (diagnostic de déploiement) — jamais la valeur. */
export function getSupabaseEnvDiagnostics(): Record<keyof z.infer<typeof supabaseEnvSchema>, EnvVariableState> {
  const state = (name: string, isValid: (value: string) => boolean): EnvVariableState => {
    const value = cleanEnvValue(readRuntimeEnv(name));
    if (typeof value !== "string") return "missing";
    return isValid(value) ? "ok" : "invalid";
  };
  return {
    NEXT_PUBLIC_SUPABASE_URL: state("NEXT_PUBLIC_SUPABASE_URL", (value) => httpUrl.safeParse(value).success),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: state("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", (value) => value.length > 0),
  };
}

/** URL publique de l'application (défaut : http://localhost:3000). */
export function getSiteUrl(): URL {
  return parseSiteUrl({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || readRuntimeEnv("NEXT_PUBLIC_SITE_URL"),
  });
}
