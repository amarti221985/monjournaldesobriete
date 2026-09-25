import { BrandMark } from "@/components/shared/brand-mark";
import { siteConfig } from "@/config/site";
import { UserMenu } from "@/features/auth/components/user-menu";
import { TimezoneSync } from "@/features/profile/components/timezone-sync";
import { requireUser } from "@/lib/auth/session";
import { getCurrentProfile } from "@/lib/services/profiles";

/** Mise en page de l'onboarding : sobre, sans navigation applicative. */
export default async function OnboardingLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const profile = await getCurrentProfile();

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="flex h-16 items-center justify-between gap-3 border-b px-4 sm:px-6">
        <span className="flex min-w-0 items-center gap-2.5 font-semibold tracking-tight">
          <BrandMark className="size-8 shrink-0" />
          <span className="truncate">{siteConfig.shortName}</span>
        </span>
        <UserMenu displayName={profile?.display_name ?? null} email={user.email} />
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
        {profile && !profile.timezone ? <TimezoneSync /> : null}
        {children}
      </main>
    </div>
  );
}
