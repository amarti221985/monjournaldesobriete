"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { discardCheckinDraftAction } from "@/features/checkin/actions";

/** « Recommencer » : supprime le brouillon du jour après confirmation. */
export function RestartCheckinButton({ checkinDate }: { checkinDate: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function restart() {
    startTransition(async () => {
      const discarded = await discardCheckinDraftAction(checkinDate).catch(() => false);
      if (!discarded) {
        setFailed(true);
        setOpen(false);
        return;
      }
      router.push(routes.checkin);
    });
  }

  return (
    <>
      <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(true)}>
        Recommencer
      </Button>
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          Impossible de recommencer pour le moment. Réessaie dans quelques instants.
        </p>
      ) : null}
      <ConfirmDialog
        open={open}
        title="Recommencer ton check-in?"
        description="Les réponses déjà saisies pour aujourd'hui seront effacées."
        confirmLabel="Oui, recommencer"
        pending={isPending}
        onCancel={() => setOpen(false)}
        onConfirm={restart}
      />
    </>
  );
}
