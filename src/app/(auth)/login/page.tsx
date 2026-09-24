import type { Metadata } from "next";

import { AuthCard } from "@/features/auth/components/auth-card";
import { LoginForm } from "@/features/auth/components/login-form";
import { getLoginPageError } from "@/features/auth/errors";
import { getSafeRedirect } from "@/lib/auth/redirects";

export const metadata: Metadata = {
  title: "Connexion",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  // `next` est validé ici puis de nouveau dans la Server Action.
  const safeNext = typeof next === "string" ? getSafeRedirect(next, "") : "";

  return (
    <AuthCard title="Connexion" description="Content de te revoir.">
      <LoginForm next={safeNext || undefined} notice={getLoginPageError(error)} />
    </AuthCard>
  );
}
