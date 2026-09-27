import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { routes } from "@/config/routes";
import { OTHER_SUBSTANCE_SLUG } from "@/features/onboarding/constants";
import { JourneySection } from "@/features/plan/components/journey-section";
import { PlacesSection, SupportSection } from "@/features/plan/components/people-places-sections";
import { PlanSection, SectionUnavailable } from "@/features/plan/components/plan-ui";
import { StrategiesSection, TriggersSection } from "@/features/plan/components/triggers-strategies-sections";
import { MotivationsSection, ReasonSection } from "@/features/plan/components/why-sections";
import { LetterSection, ReminderSection } from "@/features/plan/components/words-sections";
import { requireUser } from "@/lib/auth/session";
import { getLatestAllowedLocalDate } from "@/lib/dates";
import { getCheckinCatalogues } from "@/lib/services/checkins";
import { getCravingStrategies } from "@/lib/services/craving";
import { getPrimaryReason, getSupportContacts, getTrackedSubstances, getUserMotivations } from "@/lib/services/journey";
import { getPlanStrategies, getPlanTriggers, getReminder, getSafePlaces, getSelfLetter } from "@/lib/services/plan";
import { getCurrentProfile } from "@/lib/services/profiles";
import { getActiveSubstances } from "@/lib/services/substances";

export const metadata: Metadata = {
  title: "Mon plan",
};

const SECTIONS = [
  { id: "parcours", label: "Mon parcours" },
  { id: "pourquoi", label: "Pourquoi" },
  { id: "motivations", label: "Ce qui compte" },
  { id: "declencheurs", label: "Mes déclencheurs" },
  { id: "strategies", label: "Ce qui peut m'aider" },
  { id: "soutien", label: "Soutien" },
  { id: "lieux", label: "Lieux sûrs" },
  { id: "rappel", label: "Mon rappel" },
  { id: "lettre", label: "Ma lettre" },
] as const;

function value<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

function Unavailable({ id, title }: { id: string; title: string }) {
  return (
    <PlanSection id={id} title={title}>
      <SectionUnavailable />
    </PlanSection>
  );
}

/**
 * « Mon plan » : ce que l'utilisateur CHOISIT de préparer (≠ /progress : ce que ses
 * données montrent). Consultation d'abord, sauvegarde indépendante par section.
 * Sections chargées en parallèle et indépendantes : une section en erreur n'empêche
 * pas les autres de s'afficher.
 */
export default async function PlanPage() {
  const user = await requireUser(routes.plan);
  const profile = await getCurrentProfile();
  const latestAllowedDate = getLatestAllowedLocalDate(profile?.timezone);

  const results = await Promise.allSettled([
    getTrackedSubstances(user.id),
    getActiveSubstances(),
    getPrimaryReason(user.id),
    getUserMotivations(user.id),
    getPlanTriggers(user.id),
    getCheckinCatalogues(),
    getPlanStrategies(user.id),
    getCravingStrategies(),
    getSupportContacts(user.id),
    getSafePlaces(user.id),
    getReminder(user.id),
    getSelfLetter(user.id),
  ]);
  const [substances, catalogue, reason, motivations, triggers, checkinCatalogues, strategies, cravingStrategies, contacts, places, reminder, letter] =
    [
      value(results[0]),
      value(results[1]),
      value(results[2]),
      value(results[3]),
      value(results[4]),
      value(results[5]),
      value(results[6]),
      value(results[7]),
      value(results[8]),
      value(results[9]),
      value(results[10]),
      value(results[11]),
    ] as const;

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Mon plan"
        description="Garde près de toi ce qui compte, ce qui t'aide et les personnes vers qui tu peux te tourner."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[13rem_1fr]">
        <nav aria-label="Sections de mon plan" className="hidden lg:sticky lg:top-24 lg:block">
          <ul className="grid gap-1 text-sm">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid min-w-0 gap-6">
          {substances && catalogue ? (
            <JourneySection
              substances={substances}
              catalogue={catalogue.map((item) => ({
                slug: item.slug,
                name: item.name_fr,
                isOther: item.slug === OTHER_SUBSTANCE_SLUG,
              }))}
              latestAllowedDate={latestAllowedDate}
            />
          ) : (
            <Unavailable id="parcours" title="Mon parcours" />
          )}

          {results[2].status === "fulfilled" ? <ReasonSection reason={reason} /> : <Unavailable id="pourquoi" title="Pourquoi je fais ce changement" />}

          {motivations ? <MotivationsSection motivations={motivations} /> : <Unavailable id="motivations" title="Ce qui compte pour moi" />}

          {triggers && checkinCatalogues ? (
            <TriggersSection triggers={triggers} catalogue={checkinCatalogues.triggers} />
          ) : (
            <Unavailable id="declencheurs" title="Mes déclencheurs" />
          )}

          {strategies && cravingStrategies ? (
            <StrategiesSection
              strategies={strategies}
              catalogue={cravingStrategies.map((item) => ({ slug: item.slug, name: item.name }))}
            />
          ) : (
            <Unavailable id="strategies" title="Ce qui peut m'aider" />
          )}

          {contacts ? <SupportSection contacts={contacts} /> : <Unavailable id="soutien" title="Mes personnes de soutien" />}

          {places ? <PlacesSection places={places} /> : <Unavailable id="lieux" title="Mes lieux sûrs" />}

          {results[10].status === "fulfilled" ? (
            <ReminderSection reminder={reminder?.content ?? null} />
          ) : (
            <Unavailable id="rappel" title="Mon rappel" />
          )}

          {results[11].status === "fulfilled" ? (
            <LetterSection letter={letter ? { title: letter.title, content: letter.content } : null} />
          ) : (
            <Unavailable id="lettre" title="Ma lettre à moi-même" />
          )}
        </div>
      </div>
    </PageContainer>
  );
}
