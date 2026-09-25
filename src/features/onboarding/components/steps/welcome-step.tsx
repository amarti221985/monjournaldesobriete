import { Clock } from "lucide-react";

export function WelcomeStep() {
  return (
    <div className="grid gap-4 text-pretty">
      <p>
        Quelques questions nous permettront d&apos;adapter ton journal à ce que tu souhaites
        accomplir.
      </p>
      <p className="flex items-center gap-2 text-muted-foreground">
        <Clock className="size-4 shrink-0" aria-hidden="true" />
        Cela prendra seulement quelques minutes.
      </p>
      <p className="text-sm text-muted-foreground">
        Tu pourras modifier plusieurs de ces informations plus tard.
      </p>
    </div>
  );
}
