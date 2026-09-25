import { ShieldCheck, UserPlus } from "lucide-react";

import { FormField, getFieldControlProps } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StepProps } from "@/features/onboarding/components/step-types";

type ContactField = "name" | "relationship" | "phone" | "email";

export function SupportStep({ draft, onChange, errors }: StepProps) {
  const contact = draft.supportContact;

  if (!contact) {
    return (
      <div className="grid gap-4">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full sm:w-auto"
          onClick={() => onChange({ supportContact: { name: "" } })}
        >
          <UserPlus data-icon="inline-start" aria-hidden="true" />
          Ajouter une personne
        </Button>
        <p className="text-sm text-muted-foreground">Cette étape est facultative.</p>
      </div>
    );
  }

  function setField(field: ContactField, value: string) {
    onChange({ supportContact: { ...contact, [field]: value } });
  }

  const fields: { field: ContactField; label: string; type?: string; inputMode?: "tel" | "email"; maxLength: number; placeholder?: string }[] = [
    { field: "name", label: "Nom", maxLength: 80 },
    { field: "relationship", label: "Relation (facultatif)", maxLength: 60, placeholder: "Amie, frère, parrain…" },
    { field: "phone", label: "Téléphone (facultatif)", type: "tel", inputMode: "tel", maxLength: 32 },
    { field: "email", label: "Courriel (facultatif)", type: "email", inputMode: "email", maxLength: 254 },
  ];

  return (
    <div className="grid gap-5">
      {fields.map(({ field, label, type, inputMode, maxLength, placeholder }) => {
        const id = `contact.${field}`;
        return (
          <FormField key={field} id={id} label={label} error={errors[id]}>
            <Input
              {...getFieldControlProps(id, { error: errors[id] })}
              type={type ?? "text"}
              inputMode={inputMode}
              value={contact[field] ?? ""}
              onChange={(event) => setField(field, event.target.value)}
              maxLength={maxLength}
              placeholder={placeholder}
              // Coordonnées d'une autre personne : pas de remplissage automatique.
              autoComplete="off"
              required={field === "name"}
            />
          </FormField>
        );
      })}

      <p className="flex gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Ces coordonnées restent privées. Cette personne ne sera jamais contactée par
        l&apos;application.
      </p>

      <Button
        type="button"
        variant="ghost"
        className="justify-self-start text-muted-foreground"
        onClick={() => onChange({ supportContact: null })}
      >
        Retirer cette personne
      </Button>
    </div>
  );
}
