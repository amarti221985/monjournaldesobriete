import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";

type SubmitButtonProps = Omit<ComponentProps<typeof Button>, "type"> & {
  pending: boolean;
  pendingLabel: string;
};

/** Bouton de soumission désactivé pendant l'envoi (évite les doubles soumissions). */
export function SubmitButton({
  pending,
  pendingLabel,
  children,
  disabled,
  ...props
}: SubmitButtonProps) {
  return (
    <Button type="submit" size="lg" disabled={pending || disabled} aria-disabled={pending || disabled} {...props}>
      {pending ? (
        <>
          <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
