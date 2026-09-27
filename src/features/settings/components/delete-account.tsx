"use client";

import { useActionState, useState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { FormField, getFieldControlProps } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deleteAccountAction, type SettingsActionState } from "@/features/settings/actions";
import { ExportButton } from "@/features/settings/components/settings-forms";
import { DELETE_CONFIRMATION_WORD } from "@/features/settings/schemas";

/**
 * « Supprimer mon compte » : explication → export proposé (jamais imposé) → saisie de
 * « SUPPRIMER » + mot de passe actuel → suppression côté serveur → page publique.
 * Aucune restauration n'est promise : la suppression est définitive.
 */
export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"explain" | "confirm">("explain");
  const [confirmation, setConfirmation] = useState("");
  const [state, action, pending] = useActionState<SettingsActionState, FormData>(deleteAccountAction, { status: "idle" });
  const error = state.status === "error" ? state : null;

  function close(isOpen: boolean) {
    if (pending) return;
    setOpen(isOpen);
    if (!isOpen) {
      setStep("explain");
      setConfirmation("");
    }
  }

  return (
    <>
      <Button type="button" variant="destructive" className="justify-self-start" onClick={() => setOpen(true)}>
        Supprimer mon compte
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Supprimer mon compte</DialogTitle>
            <DialogDescription>
              Cette action supprimera définitivement ton compte et les données personnelles enregistrées dans l&apos;application.
            </DialogDescription>
          </DialogHeader>

          {step === "explain" ? (
            <div className="grid gap-4 text-sm">
              <ul className="grid list-disc gap-1 pl-5 text-pretty">
                <li>ton journal : check-ins, réflexions, consommations ;</li>
                <li>ta progression et tes accomplissements ;</li>
                <li>ton plan : raisons, stratégies, personnes de soutien, lieux, rappel, lettre ;</li>
                <li>tes moments d&apos;envie et interventions ;</li>
                <li>ton compte de connexion.</li>
              </ul>
              <p className="text-pretty text-muted-foreground">Aucune restauration ne sera possible ensuite.</p>
              <div className="grid gap-2 rounded-xl bg-muted/60 p-3">
                <p className="font-medium">Exporter mes données d&apos;abord</p>
                <p className="text-muted-foreground">Facultatif : garde une copie de tes informations avant de continuer.</p>
                <ExportButton variant="outline" label="Exporter mes données" />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => close(false)}>
                  Annuler
                </Button>
                <Button type="button" variant="destructive" onClick={() => setStep("confirm")}>
                  Continuer
                </Button>
              </div>
            </div>
          ) : (
            <form action={action} className="grid gap-4">
              {error && !error.field ? <FormAlert tone="error" message={error.message} /> : null}
              <FormField
                id="deleteConfirmation"
                label={`Pour confirmer, écris ${DELETE_CONFIRMATION_WORD}`}
                error={error?.field === "confirmation" ? error.message : undefined}
              >
                <Input
                  {...getFieldControlProps("deleteConfirmation", { error: error?.field === "confirmation" ? error.message : undefined })}
                  name="confirmation"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  required
                />
              </FormField>
              <FormField
                id="deletePassword"
                label="Mot de passe actuel"
                hint="Pour vérifier qu'il s'agit bien de toi."
                error={error?.field === "password" ? error.message : undefined}
              >
                <PasswordInput
                  {...getFieldControlProps("deletePassword", {
                    hint: "Pour vérifier qu'il s'agit bien de toi.",
                    error: error?.field === "password" ? error.message : undefined,
                  })}
                  name="password"
                  autoComplete="current-password"
                  required
                />
              </FormField>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={pending} onClick={() => setStep("explain")}>
                  Retour
                </Button>
                <SubmitButton
                  pending={pending}
                  pendingLabel="Suppression…"
                  variant="destructive"
                  disabled={confirmation.trim() !== DELETE_CONFIRMATION_WORD}
                >
                  Supprimer définitivement mon compte
                </SubmitButton>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
