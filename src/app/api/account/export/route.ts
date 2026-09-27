import { NextResponse, type NextRequest } from "next/server";

import { buildDataExport, exportFilename } from "@/features/settings/export";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserToday } from "@/lib/dates";
import { createRateLimiter, isSameOriginRequest } from "@/lib/security/request";
import { collectExportData } from "@/lib/services/account";

export const dynamic = "force-dynamic";

// Une préparation par utilisateur toutes les 10 secondes (doubles clics, rafales).
const exportLimiter = createRateLimiter(10_000);

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
} as const;

function refuse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: PRIVATE_HEADERS });
}

/**
 * Export des données personnelles (ADR-076, ADR-078) : POST même origine, session
 * obligatoire, données de auth.uid() uniquement (aucun paramètre accepté), réponse
 * téléchargeable jamais mise en cache. Le contenu n'est jamais journalisé.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request.headers)) return refuse(403, "Requête refusée.");
  const user = await getCurrentUser();
  if (!user) return refuse(401, "Connexion requise.");
  if (!exportLimiter.take(user.id)) return refuse(429, "Un export est déjà en préparation. Réessaie dans quelques secondes.");

  try {
    const source = await collectExportData(user.id);
    const data = buildDataExport(source);
    const filename = exportFilename(getUserToday(source.profile?.timezone));
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return refuse(500, "L'export n'a pas pu être préparé. Réessaie dans quelques instants.");
  }
}
