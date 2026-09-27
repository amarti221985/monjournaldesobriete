import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { DeleteAccountSection } from "@/features/settings/components/delete-account";
import {
  DisplayNameForm,
  EmailChangeForm,
  ExportButton,
  PasswordChangeForm,
  SessionControls,
  TimezoneForm,
} from "@/features/settings/components/settings-forms";
import { requireUser } from "@/lib/auth/session";
import { formatLongDate } from "@/lib/dates";
import { getAccountOverview } from "@/lib/services/account";
import { getCurrentProfile } from "@/lib/services/profiles";

export const metadata: Metadata = {
  title: "Paramètres",
};

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">{title}</h2>
        </CardTitle>
        {description ? <CardDescription className="text-pretty">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="grid gap-6">{children}</CardContent>
    </Card>
  );
}

/** Fuseaux IANA connus du serveur ; le fuseau actuel est toujours proposé. */
function timezoneOptions(current: string): string[] {
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return zones.includes(current) ? zones : [current, ...zones];
}

/**
 * Paramètres (Sprint 11) : compte, sécurité, données, confidentialité, zone sensible.
 * Aucun identifiant interne ni jeton n'est affiché. Chaque modification passe par une
 * Server Action qui dérive l'utilisateur de la session.
 */
export default async function SettingsPage() {
  await requireUser(routes.settings);
  const [profile, account] = await Promise.all([getCurrentProfile(), getAccountOverview()]);
  const timezone = profile?.timezone ?? siteConfig.defaultTimeZone;

  return (
    <PageContainer size="narrow">
      <PageHeader title="Paramètres" description="Ton compte, ta sécurité et le contrôle de tes données." />

      <Section id="compte" title="Mon compte">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground">Adresse courriel</dt>
            <dd className="font-medium break-all">{account?.email ?? "—"}</dd>
          </div>
          {account?.createdAt ? (
            <div className="grid gap-0.5">
              <dt className="text-muted-foreground">Compte créé le</dt>
              <dd className="font-medium">{formatLongDate(account.createdAt.slice(0, 10))}</dd>
            </div>
          ) : null}
        </dl>
        <DisplayNameForm displayName={profile?.display_name ?? ""} />
        <TimezoneForm timezone={timezone} options={timezoneOptions(timezone)} />
      </Section>

      <Section id="securite" title="Sécurité">
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold">Adresse courriel</h3>
          <EmailChangeForm email={account?.email ?? null} pendingEmail={account?.newEmail ?? null} />
        </div>
        <div className="grid gap-2 border-t pt-6">
          <h3 className="text-sm font-semibold">Mot de passe</h3>
          <PasswordChangeForm />
        </div>
        <div className="grid gap-2 border-t pt-6">
          <h3 className="text-sm font-semibold">Session</h3>
          <SessionControls />
        </div>
      </Section>

      <Section id="donnees" title="Mes données" description="Tu peux télécharger une copie des informations que tu as enregistrées dans l'application.">
        <ExportButton />
        <p className="text-xs text-pretty text-muted-foreground">
          Format JSON : ton compte, ton parcours, tes check-ins, tes moments d&apos;envie, ton plan et tes accomplissements.
          Garde ce fichier en lieu sûr : il contient des informations personnelles.
        </p>
      </Section>

      <Section id="confidentialite" title="Confidentialité">
        <div className="grid gap-3 text-sm text-pretty">
          <p className="flex gap-2.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              Tes données sont privées : elles ne sont ni publiques ni partagées automatiquement sur un réseau social.
              L&apos;application utilise des contrôles d&apos;accès pour limiter chaque compte à ses propres données.
            </span>
          </p>
          <p>Aucun outil publicitaire ni de mesure d&apos;audience n&apos;est utilisé.</p>
          <p>
            Les fonctions IA ne sont pas actuellement activées : ton journal n&apos;est envoyé à aucun fournisseur
            d&apos;intelligence artificielle. Si de telles fonctions arrivent, elles demanderont ton accord explicite.
          </p>
          <p className="text-muted-foreground">
            Tes données sont conservées tant que tu ne les supprimes pas ou que tu ne supprimes pas ton compte.
            Hébergement technique : Supabase (base de données et authentification) et Hostinger (application).
          </p>
        </div>
      </Section>

      <Section id="zone-sensible" title="Zone sensible">
        <p className="text-sm text-pretty text-muted-foreground">
          La suppression de ton compte efface définitivement ton compte et toutes les données personnelles enregistrées
          dans l&apos;application.
        </p>
        <DeleteAccountSection />
      </Section>
    </PageContainer>
  );
}
