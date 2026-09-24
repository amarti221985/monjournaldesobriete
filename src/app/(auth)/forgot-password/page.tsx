import type { Metadata } from "next";

import { AuthCard } from "@/features/auth/components/auth-card";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = {
  title: "Mot de passe oublié",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Mot de passe oublié"
      description="Indique ton adresse courriel. Tu recevras un lien pour choisir un nouveau mot de passe."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
