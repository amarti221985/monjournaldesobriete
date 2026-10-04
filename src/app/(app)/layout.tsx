import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { UserMenu } from "@/features/auth/components/user-menu";
import { AchievementNotifierProvider } from "@/features/achievements/components/achievement-notifier";
import { CravingCta } from "@/features/craving/components/craving-cta";
import { TimezoneSync } from "@/features/profile/components/timezone-sync";
import { getAppAccessRedirect } from "@/lib/auth/redirects";
import { getIsAdmin } from "@/lib/auth/admin";
import { requireUser } from "@/lib/auth/session";
import { getUserToday } from "@/lib/dates";
import { getActiveCravingEventId } from "@/lib/services/craving";
import { getCurrentProfile } from "@/lib/services/profiles";

/**
 * Zone authentifiée. Vérifications côté serveur, en plus du proxy (défense en profondeur) :
 * visiteur non connecté → /login ; onboarding non terminé → /onboarding (ADR-025).
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const profile = await getCurrentProfile();

  const onboardingRedirect = getAppAccessRedirect(profile);
  if (onboardingRedirect) redirect(onboardingRedirect);

  // CTA global du mode envie (Sprint 7) : reprend le moment en cours d'aujourd'hui s'il existe.
  const [activeCravingEventId, isAdmin] = await Promise.all([
    getActiveCravingEventId(user.id, getUserToday(profile?.timezone)),
    getIsAdmin(),
  ]);

  return (
    <AppShell
      sidebarAction={<CravingCta variant="sidebar" activeEventId={activeCravingEventId} />}
      headerActions={
        <>
          <CravingCta variant="header" activeEventId={activeCravingEventId} />
          <UserMenu displayName={profile?.display_name ?? null} email={user.email} isAdmin={isAdmin} />
        </>
      }
    >
      <AchievementNotifierProvider>
        {profile && !profile.timezone ? <TimezoneSync /> : null}
        {children}
      </AchievementNotifierProvider>
    </AppShell>
  );
}
