import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { AuthCard } from "@/features/auth/components/auth-card";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Nouveau mot de passe",
};

/**
 * Accessible après le lien de réinitialisation (/auth/callback crée une session
 * temporaire de récupération), ou par un utilisateur connecté.
 */
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AuthCard
        title="Lien expiré"
        description="Ce lien de réinitialisation n'est plus valide. Tu peux en demander un nouveau."
      >
        <Button asChild size="lg" className="w-full">
          <Link href={routes.forgotPassword}>Demander un nouveau lien</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Nouveau mot de passe" description="Choisis ton nouveau mot de passe.">
      <ResetPasswordForm />
    </AuthCard>
  );
}
