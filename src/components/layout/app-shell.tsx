import type { ReactNode } from "react";

import { DesktopSidebar } from "@/components/layout/desktop-sidebar";
import { MobileNavigation } from "@/components/layout/mobile-navigation";

type AppShellProps = {
  children: ReactNode;
};

/**
 * Structure de l'application authentifiée :
 * sidebar sur desktop (lg+), barre de navigation inférieure sur mobile.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-1">
      <DesktopSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Espace réservé à la barre inférieure sur mobile */}
        <main className="flex flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </main>
      </div>
      <MobileNavigation />
    </div>
  );
}
