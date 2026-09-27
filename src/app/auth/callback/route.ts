import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { routes } from "@/config/routes";
import { buildLoginUrl, getSafeRedirect, resolveRedirectOrigin } from "@/lib/auth/redirects";
import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback Supabase Auth : confirmation d'inscription et réinitialisation du mot de passe.
 *
 * Deux formats de lien sont acceptés :
 * - `?code=...` (flux PKCE, lien par défaut de Supabase) : même navigateur que la demande;
 * - `?token_hash=...&type=...` (modèles de courriel personnalisés) : fonctionne aussi
 *   si le courriel est ouvert sur un autre appareil. Voir docs/SUPABASE_SETUP.md.
 *
 * `next` est toujours validé (liste blanche de chemins internes) : aucune redirection ouverte.
 */

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (EMAIL_OTP_TYPES as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const defaultNext = type === "recovery" ? routes.resetPassword : routes.today;
  const next = getSafeRedirect(searchParams.get("next"), defaultNext);

  const supabase = await createClient();
  let succeeded = false;

  if (tokenHash && isEmailOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) console.error("[auth:callback] verifyOtp", { code: error.code, status: error.status });
    succeeded = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth:callback] exchangeCode", { code: error.code, status: error.status });
    }
    succeeded = !error;
  } else if (searchParams.has("error")) {
    // Lien expiré ou déjà utilisé : Supabase redirige avec ?error=...&error_code=...
    console.error("[auth:callback] lien refusé", { code: searchParams.get("error_code") });
  }

  const destination = succeeded ? next : `${buildLoginUrl()}?error=link_invalid`;
  let siteUrl: URL | null = null;
  try {
    siteUrl = getSiteUrl();
  } catch {
    siteUrl = null;
  }
  // Jamais l'adresse interne du serveur (constat bêta : https://0.0.0.0:3000 chez l'hébergeur).
  return NextResponse.redirect(new URL(destination, resolveRedirectOrigin(request.url, siteUrl)));
}
