import type { Metadata } from "next";

import { AuthCard } from "@/features/auth/components/auth-card";
import { SignupForm } from "@/features/auth/components/signup-form";

export const metadata: Metadata = {
  title: "Créer un compte",
};

export default function SignupPage() {
  return (
    <AuthCard
      title="Créer un compte"
      description="Ton espace personnel et privé, pour avancer un jour à la fois."
    >
      <SignupForm />
    </AuthCard>
  );
}
