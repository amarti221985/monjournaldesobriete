import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { routes } from "@/config/routes";
import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard";
import type { OnboardingDraft } from "@/features/onboarding/schemas";
import { getOnboardingAccessRedirect } from "@/lib/auth/redirects";
import { requireUser } from "@/lib/auth/session";
import { getLatestAllowedLocalDate } from "@/lib/dates";
import { getOnboardingDraft } from "@/lib/services/onboarding";
import { getCurrentProfile } from "@/lib/services/profiles";
import { getActiveSubstances } from "@/lib/services/substances";

export const metadata: Metadata = {
  title: "Configurer mon parcours",
};

export default async function OnboardingPage() {
  const user = await requireUser(routes.onboarding);
  const profile = await getCurrentProfile();

  // Onboarding terminé : on ne le refait pas (les données ne sont jamais écrasées).
  const accessRedirect = getOnboardingAccessRedirect(profile);
  if (accessRedirect) redirect(accessRedirect);

  const [catalogue, storedDraft] = await Promise.all([
    getActiveSubstances(),
    getOnboardingDraft(user.id),
  ]);
  const latestAllowedDate = getLatestAllowedLocalDate(profile?.timezone);

  // Reprise du brouillon, en ignorant les substances retirées du catalogue.
  const activeSlugs = new Set(catalogue.map((substance) => substance.slug));
  const draft: OnboardingDraft = storedDraft?.data ?? {};
  const initialDraft: OnboardingDraft = {
    ...draft,
    substances: draft.substances?.filter((substance) => activeSlugs.has(substance.slug)),
    startedOn: draft.startedOn ?? latestAllowedDate,
  };

  return (
    <OnboardingWizard
      catalogue={catalogue}
      initialDraft={initialDraft}
      initialStep={storedDraft?.step ?? 1}
      latestAllowedDate={latestAllowedDate}
      displayName={profile?.display_name ?? null}
    />
  );
}
