import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/shared/brand-mark";
import { routes } from "@/config/routes";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s | Administration" },
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Administration (Admin V1, docs/ADMIN.md). Le layout vérifie le rôle côté serveur ; chaque
 * page le revérifie (requireAdmin) et chaque RPC le revérifie en base.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <aside className="border-b bg-sidebar px-4 py-3 lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0 lg:px-3 lg:py-5">
        <div className="mb-3 flex items-center justify-between gap-2 lg:mb-6 lg:px-3">
          <Link href={routes.admin} className="flex items-center gap-2.5 font-semibold tracking-tight">
            <BrandMark className="size-8" />
            <span>Administration</span>
          </Link>
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Admin
          </span>
        </div>
        <AdminNav />
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
