import { CircleAlert, CircleCheck } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type FormAlertProps = {
  tone: "error" | "success";
  message: string;
  className?: string;
};

/**
 * Message global d'un formulaire.
 * Erreur : role="alert" (annoncée immédiatement). Succès : role="status" (poli).
 */
export function FormAlert({ tone, message, className }: FormAlertProps) {
  const isError = tone === "error";
  const Icon = isError ? CircleAlert : CircleCheck;

  return (
    <Alert
      role={isError ? "alert" : "status"}
      variant={isError ? "destructive" : "default"}
      className={cn(
        "px-3.5 py-3",
        isError
          ? "border-destructive/30 bg-destructive/5"
          : "border-status-sober/40 bg-status-sober-soft text-status-sober-foreground",
        className,
      )}
    >
      <Icon aria-hidden="true" />
      <AlertDescription className={cn(isError ? "text-destructive" : "text-status-sober-foreground")}>
        {message}
      </AlertDescription>
    </Alert>
  );
}
