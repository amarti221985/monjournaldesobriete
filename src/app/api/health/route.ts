import { NextResponse } from "next/server";

import { EnvValidationError, getSiteUrl, getSupabaseEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Diagnostic de déploiement : indique seulement si la configuration publique est
 * présente (oui / non). Aucune valeur, clé ni donnée utilisateur n'est renvoyée.
 */
export function GET() {
  let supabaseConfigured = true;
  try {
    getSupabaseEnv();
  } catch (error) {
    if (!(error instanceof EnvValidationError)) throw error;
    supabaseConfigured = false;
  }

  let siteUrlConfigured = true;
  try {
    siteUrlConfigured = getSiteUrl().hostname !== "localhost";
  } catch {
    siteUrlConfigured = false;
  }

  return NextResponse.json(
    { status: supabaseConfigured ? "ok" : "misconfigured", supabaseConfigured, siteUrlConfigured, revision: 2 },
    { status: supabaseConfigured ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
