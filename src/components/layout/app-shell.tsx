import type { ReactNode } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { DesktopSidebar } from "@/components/layout/desktop-sidebar";
import { MobileNavigation } from "@/components/layout/mobile-navigation";

type AppShellProps = {
  /** Actions affichées à droite de l'en-tête (ex. menu utilisateur). */
  headerActions?: ReactNode;
  children: ReactNode;
};

/**
 * Structure de l'application authentifiée :
 * sidebar sur desktop (lg+), barre de navigation inférieure sur mobile.
 */
export function AppShell({ headerActions, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-1">
      <DesktopSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader actions={headerActions} />
        {/* Espace réservé à la barre inférieure sur mobile */}
        <main className="flex flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </main>
      </div>
      <MobileNavigation />
    </div>
  );
}
