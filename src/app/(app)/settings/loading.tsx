import { Skeleton } from "@/components/ui/skeleton";

/** Squelette des paramètres : aucune donnée de compte affichée pendant le chargement. */
export default function SettingsLoading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto grid w-full max-w-2xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <span className="sr-only">Chargement des paramètres…</span>
      <div className="grid gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-44 rounded-xl" />
      ))}
    </div>
  );
}
