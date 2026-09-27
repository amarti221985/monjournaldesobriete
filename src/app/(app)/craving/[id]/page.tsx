import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { PageContainer } from "@/components/layout/page-container";
import { LoadError } from "@/components/shared/load-error";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { motivationOptions } from "@/features/onboarding/constants";
import { CravingSession } from "@/features/craving/components/craving-session";
import { SafetyNote } from "@/features/craving/components/safety-note";
import { requireUser } from "@/lib/auth/session";
import { closeStaleCravingEvents, getCravingEvent, getCravingStrategies } from "@/lib/services/craving";
import { getPrimaryReason, getSupportContacts, getUserMotivations } from "@/lib/services/journey";
import { getPlanStrategies, getReminder, getSafePlaces, getSelfLetter } from "@/lib/services/plan";

/** Horloge serveur au rendu : le client corrige l'écart avec l'horloge de l'appareil. */
function serverTimestamp(): number {
  return Date.now();
}

// Aucun contenu du moment dans le titre ni dans l'URL (seulement un identifiant opaque).
export const metadata: Metadata = {
  title: "Prends un moment",
};

/**
 * Intervention en cours ou terminée. La route par moment rend la reprise robuste :
 * l'étape est relue depuis la base à chaque chargement. Lecture limitée à
 * l'utilisateur connecté (filtre user_id + RLS) : un identifiant deviné ne donne rien.
 */
export default async function CravingEventPage({ params }: PageProps<"/craving/[id]">) {
  const { id } = await params;
  const user = await requireUser(routes.craving);
  if (!z.uuid().safeParse(id).success) notFound();

  await closeStaleCravingEvents();

  let data;
  try {
    const [event, strategies, contacts, reason, motivations] = await Promise.all([
      getCravingEvent(user.id, id),
      getCravingStrategies(),
      getSupportContacts(user.id),
      getPrimaryReason(user.id),
      getUserMotivations(user.id),
    ]);
    // Éléments de « Mon plan » : facultatifs ; une erreur ici ne bloque jamais l'intervention.
    const [planStrategies, places, reminder, letter] = await Promise.allSettled([
      getPlanStrategies(user.id),
      getSafePlaces(user.id),
      getReminder(user.id),
      getSelfLetter(user.id),
    ]);
    const plan = {
      strategies: planStrategies.status === "fulfilled" ? planStrategies.value : [],
      places: places.status === "fulfilled" ? places.value : [],
      reminder: reminder.status === "fulfilled" ? (reminder.value?.content ?? null) : null,
      letter:
        letter.status === "fulfilled" && letter.value ? { title: letter.value.title, content: letter.value.content } : null,
    };
    data = { event, strategies, contacts, reason, motivations, plan };
  } catch {
    return (
      <PageContainer size="narrow">
        <LoadError message="Nous n'avons pas pu charger ce moment. Réessaie dans quelques instants." />
        <SafetyNote />
      </PageContainer>
    );
  }

  if (!data.event) notFound();

  return (
    <PageContainer size="narrow">
      <Button asChild variant="ghost" className="-ml-3 self-start">
        <Link href={routes.craving}>
          <ArrowLeft data-icon="inline-start" aria-hidden="true" />
          Prends un moment
        </Link>
      </Button>
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Prends un moment</h1>
        <p className="text-muted-foreground">Envie au départ : {data.event.initial}/10</p>
      </header>

      <CravingSession
        event={data.event}
        strategies={data.strategies}
        contacts={data.contacts}
        reason={data.reason}
        motivations={data.motivations.map((item) => item.customLabel?.trim() || motivationOptions[item.motivation].label)}
        plan={data.plan}
        serverNow={serverTimestamp()}
      />

      <SafetyNote />
    </PageContainer>
  );
}
