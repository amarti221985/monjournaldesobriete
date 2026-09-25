import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { UserMenu } from "@/features/auth/components/user-menu";
import { TimezoneSync } from "@/features/profile/components/timezone-sync";
import { getAppAccessRedirect } from "@/lib/auth/redirects";
import { requireUser } from "@/lib/auth/session";
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

  return (
    <AppShell
      headerActions={<UserMenu displayName={profile?.display_name ?? null} email={user.email} />}
    >
      {profile && !profile.timezone ? <TimezoneSync /> : null}
      {children}
    </AppShell>
  );
}
