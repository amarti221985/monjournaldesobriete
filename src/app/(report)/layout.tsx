import { redirect } from "next/navigation";

import { getAppAccessRedirect } from "@/lib/auth/redirects";
import { requireUser } from "@/lib/auth/session";
import { getCurrentProfile } from "@/lib/services/profiles";

/**
 * Documents imprimables (rapport « Mon parcours ») : même protection que la zone
 * applicative (connexion + onboarding), sans navigation, en-tête ni barre inférieure.
 */
export default async function ReportLayout({ children }: LayoutProps<"/">) {
  await requireUser();
  const onboardingRedirect = getAppAccessRedirect(await getCurrentProfile());
  if (onboardingRedirect) redirect(onboardingRedirect);
  return <div className="flex min-h-full flex-1 flex-col bg-background print:bg-white">{children}</div>;
}
