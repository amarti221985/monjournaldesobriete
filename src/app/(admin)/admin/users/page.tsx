import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { LoadError } from "@/components/shared/load-error";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import {
  activationLabels,
  activityLabels,
  ADMIN_PAGE_SIZE,
  getActivationStatus,
  getActivityStatus,
  parsePage,
  parseUserFilter,
  parseUserSort,
  pseudonym,
  USER_FILTERS,
  USER_SORTS,
  userFilterLabels,
  userSortLabels,
  type UserFilter,
  type UserSort,
} from "@/features/admin/analytics/definitions";
import { AdminEmptyState, AdminPageHeader, AdminSection, formatAdminDate } from "@/features/admin/components/admin-ui";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminUsersPage, type AdminUserRow } from "@/lib/services/admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Utilisateurs" };

function href(filter: UserFilter, sort: UserSort, page = 1) {
  const params = new URLSearchParams({ filter, sort });
  if (page > 1) params.set("page", String(page));
  return `${routes.adminUsers}?${params.toString()}`;
}

function StatusPills({ row }: { row: AdminUserRow }) {
  const activation = getActivationStatus(row);
  const activity = getActivityStatus(row.lastActivityAt);
  return (
    <span className="flex flex-wrap gap-1">
      <span className={cn("rounded-full border px-2 py-0.5 text-xs", activation === "activated" && "border-primary/40 bg-secondary")}>
        {activationLabels[activation]}
      </span>
      <span className={cn("rounded-full border px-2 py-0.5 text-xs", activity === "active" && "border-primary/40 bg-secondary")}>
        {activityLabels[activity]}
      </span>
    </span>
  );
}

/**
 * Comptes (pseudonymisés) : informations de compte et d'usage seulement, jamais le journal.
 * Ni courriel ni nom ici ; le courriel n'est révélable que dans la fiche (support, audité).
 */
export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requireAdmin(routes.adminUsers);
  const params = await searchParams;
  const filter = parseUserFilter(params.filter);
  const sort = parseUserSort(params.sort);
  const page = parsePage(params.page);

  let result: Awaited<ReturnType<typeof getAdminUsersPage>>;
  try {
    result = await getAdminUsersPage(filter, sort, page);
  } catch {
    return (
      <PageContainer size="wide">
        <AdminPageHeader title="Utilisateurs" description="Comptes pseudonymisés." />
        <LoadError message="Les données d'administration sont indisponibles pour le moment." />
      </PageContainer>
    );
  }
  const pages = Math.max(1, Math.ceil(result.total / ADMIN_PAGE_SIZE));

  return (
    <PageContainer size="wide">
      <AdminPageHeader title="Utilisateurs" description="Comptes pseudonymisés : inscription, activation et activité, sans aucun contenu du journal." />

      <AdminSection title={`${result.total} compte${result.total > 1 ? "s" : ""}`}>
        <div className="grid gap-3">
          <nav aria-label="Filtrer les comptes">
            <ul className="flex flex-wrap gap-2">
              {USER_FILTERS.map((option) => (
                <li key={option}>
                  <Link
                    href={href(option, sort)}
                    aria-current={option === filter ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-10 items-center rounded-full border px-3 text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      option === filter ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {userFilterLabels[option]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Trier les comptes" className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Trier :</span>
            {USER_SORTS.map((option) => (
              <Link
                key={option}
                href={href(filter, option)}
                aria-current={option === sort ? "page" : undefined}
                className={cn("min-h-10 content-center rounded-md px-2 underline-offset-4 hover:underline", option === sort ? "font-semibold" : "text-muted-foreground")}
              >
                {userSortLabels[option]}
              </Link>
            ))}
          </nav>
        </div>

        {result.rows.length === 0 ? (
          <AdminEmptyState>Aucun compte ne correspond à ce filtre.</AdminEmptyState>
        ) : (
          <>
            <div className="relative hidden min-w-0 overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Comptes pseudonymisés</caption>
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">Utilisateur</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Inscription</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Onboarding</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Premier check-in</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Dernière activité</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Check-ins</th>
                    <th scope="col" className="py-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.code} className="border-b last:border-0">
                      <th scope="row" className="py-2 pr-3 font-medium">
                        <Link href={`${routes.adminUsers}/${row.code}`} className="text-primary underline-offset-4 hover:underline">
                          {pseudonym(row.code)}
                        </Link>
                      </th>
                      <td className="py-2 pr-3">{formatAdminDate(row.signedUpAt)}</td>
                      <td className="py-2 pr-3">{row.onboarded ? "Complété" : "Incomplet"}</td>
                      <td className="py-2 pr-3">{formatAdminDate(row.firstCheckinAt)}</td>
                      <td className="py-2 pr-3">{formatAdminDate(row.lastActivityAt)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{row.checkins}</td>
                      <td className="py-2"><StatusPills row={row} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="grid gap-3 md:hidden">
              {result.rows.map((row) => (
                <li key={row.code} className="grid gap-1.5 rounded-lg border p-3 text-sm">
                  <Link href={`${routes.adminUsers}/${row.code}`} className="font-medium text-primary underline-offset-4 hover:underline">
                    {pseudonym(row.code)}
                  </Link>
                  <StatusPills row={row} />
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                    <dt className="text-muted-foreground">Inscription</dt><dd>{formatAdminDate(row.signedUpAt)}</dd>
                    <dt className="text-muted-foreground">Onboarding</dt><dd>{row.onboarded ? "Complété" : "Incomplet"}</dd>
                    <dt className="text-muted-foreground">Premier check-in</dt><dd>{formatAdminDate(row.firstCheckinAt)}</dd>
                    <dt className="text-muted-foreground">Dernière activité</dt><dd>{formatAdminDate(row.lastActivityAt)}</dd>
                    <dt className="text-muted-foreground">Check-ins</dt><dd className="tabular-nums">{row.checkins}</dd>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}

        {pages > 1 ? (
          <nav aria-label="Pagination" className="flex items-center justify-between gap-2 text-sm">
            {page > 1 ? (
              <Button asChild variant="outline"><Link href={href(filter, sort, page - 1)}>Précédent</Link></Button>
            ) : <span />}
            <span className="text-muted-foreground">Page {page} sur {pages}</span>
            {page < pages ? (
              <Button asChild variant="outline"><Link href={href(filter, sort, page + 1)}>Suivant</Link></Button>
            ) : <span />}
          </nav>
        ) : null}
      </AdminSection>
    </PageContainer>
  );
}
