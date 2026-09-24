import { AppShell } from "@/components/layout/app-shell";
import { UserMenu } from "@/features/auth/components/user-menu";
import { TimezoneSync } from "@/features/profile/components/timezone-sync";
import { requireUser } from "@/lib/auth/session";
import { getCurrentProfile } from "@/lib/services/profiles";

/**
 * Zone authentifiée. La vérification est faite ici côté serveur, en plus du proxy
 * (défense en profondeur) : un visiteur non connecté est redirigé vers /login.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const profile = await getCurrentProfile();

  return (
    <AppShell
      headerActions={<UserMenu displayName={profile?.display_name ?? null} email={user.email} />}
    >
      {profile && !profile.timezone ? <TimezoneSync /> : null}
      {children}
    </AppShell>
  );
}
