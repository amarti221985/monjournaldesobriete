import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { LoadError } from "@/components/shared/load-error";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { FEEDBACK_CATEGORIES, feedbackCategoryLabels, feedbackSectionLabels, type FeedbackCategory } from "@/features/feedback/schema";
import {
  ADMIN_PAGE_SIZE,
  FEEDBACK_STATUSES,
  feedbackStatusLabels,
  parsePage,
  pseudonym,
  type FeedbackStatus,
} from "@/features/admin/analytics/definitions";
import { FeedbackStatusControl } from "@/features/admin/components/admin-controls";
import { AdminEmptyState, AdminPageHeader, AdminSection, formatAdminDate } from "@/features/admin/components/admin-ui";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminFeedbackPage } from "@/lib/services/admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Avis" };

function href(category: FeedbackCategory | null, status: FeedbackStatus | null, page = 1) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${routes.adminFeedback}?${query}` : routes.adminFeedback;
}

const pill = (active: boolean) =>
  cn(
    "inline-flex min-h-10 items-center rounded-full border px-3 text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
    active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted",
  );

/**
 * Avis bêta : envoyés explicitement à l'équipe, leur contenu peut être lu ici. Auteur
 * pseudonymisé, aucun lien avec le journal, le plan ni les check-ins.
 */
export default async function AdminFeedbackPage({ searchParams }: PageProps<"/admin/feedback">) {
  await requireAdmin(routes.adminFeedback);
  const params = await searchParams;
  const category = FEEDBACK_CATEGORIES.find((value) => value === params.category) ?? null;
  const status = FEEDBACK_STATUSES.find((value) => value === params.status) ?? null;
  const page = parsePage(params.page);

  let result: Awaited<ReturnType<typeof getAdminFeedbackPage>>;
  try {
    result = await getAdminFeedbackPage(category, status, page);
  } catch {
    return (
      <PageContainer size="wide">
        <AdminPageHeader title="Avis" description="Avis envoyés par les bêta-testeurs." />
        <LoadError message="Les données d'administration sont indisponibles pour le moment." />
      </PageContainer>
    );
  }
  const pages = Math.max(1, Math.ceil(result.total / ADMIN_PAGE_SIZE));

  return (
    <PageContainer size="wide">
      <AdminPageHeader title="Avis" description="Avis envoyés volontairement par les bêta-testeurs depuis « Donner mon avis »." />

      <AdminSection title={`${result.total} avis`}>
        <nav aria-label="Filtrer par catégorie">
          <ul className="flex flex-wrap gap-2">
            <li><Link href={href(null, status)} aria-current={category === null ? "page" : undefined} className={pill(category === null)}>Toutes</Link></li>
            {FEEDBACK_CATEGORIES.map((value) => (
              <li key={value}>
                <Link href={href(value, status)} aria-current={value === category ? "page" : undefined} className={pill(value === category)}>
                  {feedbackCategoryLabels[value]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Filtrer par statut">
          <ul className="flex flex-wrap gap-2">
            <li><Link href={href(category, null)} aria-current={status === null ? "page" : undefined} className={pill(status === null)}>Tous les statuts</Link></li>
            {FEEDBACK_STATUSES.map((value) => (
              <li key={value}>
                <Link href={href(category, value)} aria-current={value === status ? "page" : undefined} className={pill(value === status)}>
                  {feedbackStatusLabels[value]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {result.rows.length === 0 ? (
          <AdminEmptyState>Aucun avis pour ces filtres.</AdminEmptyState>
        ) : (
          <ul className="grid gap-3">
            {result.rows.map((item) => (
              <li key={item.id} className="grid gap-2 rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {formatAdminDate(item.createdAt)} · {item.excluded ? "Compte admin ou de test" : pseudonym(item.code)} ·{" "}
                    <span className="font-medium text-foreground">
                      {item.category in feedbackCategoryLabels ? feedbackCategoryLabels[item.category as FeedbackCategory] : item.category}
                    </span>
                    {item.pageContext && item.pageContext in feedbackSectionLabels
                      ? ` · ${feedbackSectionLabels[item.pageContext as keyof typeof feedbackSectionLabels]}`
                      : ""}
                  </p>
                  <FeedbackStatusControl id={item.id} status={item.status} />
                </div>
                <p className="text-sm whitespace-pre-line text-pretty">{item.message}</p>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 ? (
          <nav aria-label="Pagination" className="flex items-center justify-between gap-2 text-sm">
            {page > 1 ? <Button asChild variant="outline"><Link href={href(category, status, page - 1)}>Précédent</Link></Button> : <span />}
            <span className="text-muted-foreground">Page {page} sur {pages}</span>
            {page < pages ? <Button asChild variant="outline"><Link href={href(category, status, page + 1)}>Suivant</Link></Button> : <span />}
          </nav>
        ) : null}
      </AdminSection>
    </PageContainer>
  );
}
