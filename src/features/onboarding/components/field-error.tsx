import { getFieldErrorId } from "@/components/forms/form-field";

/** Message d'erreur d'un groupe de choix (fieldset), relié par aria-describedby. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={getFieldErrorId(id)} className="text-sm font-medium text-destructive">
      {message}
    </p>
  );
}
