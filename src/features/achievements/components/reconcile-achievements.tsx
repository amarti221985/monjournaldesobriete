"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { reconcileAchievementsAction } from "@/features/achievements/actions";
import { useAchievementNotifier } from "@/features/achievements/components/achievement-notifier";

/**
 * Affiché quand des jalons sont atteints mais pas encore enregistrés (historique antérieur,
 * écriture interrompue). L'enregistrement se fait uniquement sur ce clic.
 */
export function ReconcileAchievements({ count }: { count: number }) {
  const router = useRouter();
  const notify = useAchievementNotifier();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-pretty">
        {count > 1
          ? `${count} jalons sont déjà atteints dans ton historique et peuvent être enregistrés.`
          : "Un jalon est déjà atteint dans ton historique et peut être enregistré."}
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            notify(await reconcileAchievementsAction());
            router.refresh();
          })
        }
      >
        <RefreshCw data-icon="inline-start" aria-hidden="true" />
        {isPending ? "Enregistrement…" : "Enregistrer mes jalons"}
      </Button>
    </div>
  );
}
