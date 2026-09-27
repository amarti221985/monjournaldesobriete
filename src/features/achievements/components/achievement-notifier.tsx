"use client";

import { Leaf, X } from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import {
  buildAchievementNotification,
  type AchievementNotification,
  type AwardedAchievement,
} from "@/features/achievements/logic";

type NotifyInput = { awarded: AwardedAchievement[]; initial: boolean } | null | undefined;

const AchievementNotifierContext = createContext<(input: NotifyInput) => void>(() => {});

/** Signale des accomplissements RÉELLEMENT nouvellement attribués (renvoyés par la base). */
export function useAchievementNotifier() {
  return useContext(AchievementNotifierContext);
}

function Content({ notification }: { notification: AchievementNotification }) {
  if (notification.kind === "history") {
    return (
      <>
        <p className="font-semibold">Ton parcours compte déjà</p>
        <p className="text-sm text-pretty text-muted-foreground">
          Ton historique contient {notification.count} accomplissements déjà atteints.
        </p>
      </>
    );
  }
  if (notification.kind === "single") {
    return (
      <>
        <p className="text-xs font-medium text-muted-foreground">Nouveau jalon</p>
        <p className="font-semibold">{notification.achievement.name}</p>
        <p className="text-sm text-pretty text-muted-foreground">Ton parcours continue de s&apos;écrire.</p>
      </>
    );
  }
  return (
    <>
      <p className="font-semibold">{notification.count} nouveaux accomplissements</p>
      <ul className="grid gap-0.5 text-sm text-muted-foreground">
        {notification.achievements.map((achievement) => (
          <li key={achievement.slug}>{achievement.name}</li>
        ))}
      </ul>
    </>
  );
}

/**
 * Notification discrète (pas de modale, pas de son, pas de confettis) : une seule carte,
 * au-dessus de la barre mobile, annoncée poliment aux lecteurs d'écran. Les accomplissements
 * simultanés sont regroupés ; le rattrapage de l'historique donne une seule synthèse.
 */
export function AchievementNotifierProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<AchievementNotification | null>(null);

  const notify = useCallback((input: NotifyInput) => {
    if (!input) return;
    const next = buildAchievementNotification(input.awarded, input.initial);
    if (next) setNotification(next);
  }, []);

  // Disparaît seule après un moment (le contenu reste consultable sur /achievements).
  useEffect(() => {
    if (!notification) return;
    const id = window.setTimeout(() => setNotification(null), 12000);
    return () => window.clearTimeout(id);
  }, [notification]);

  const value = useMemo(() => notify, [notify]);

  return (
    <AchievementNotifierContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 lg:bottom-6 lg:justify-end lg:px-6"
      >
        {notification ? (
          <div className="pointer-events-auto flex w-full max-w-sm gap-3 rounded-2xl border bg-popover p-4 text-popover-foreground shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
            <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
              <Leaf className="size-4" />
            </span>
            <div className="grid min-w-0 flex-1 gap-1">
              <Content notification={notification} />
              <Link href={routes.achievements} onClick={() => setNotification(null)} className="mt-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
                {notification.kind === "history" ? "Les découvrir" : notification.kind === "single" ? "Voir" : "Voir mes accomplissements"}
              </Link>
            </div>
            <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Fermer" onClick={() => setNotification(null)}>
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </div>
    </AchievementNotifierContext.Provider>
  );
}
