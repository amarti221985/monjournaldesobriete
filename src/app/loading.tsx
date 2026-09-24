import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-10 sm:px-6"
    >
      <span className="sr-only">Chargement…</span>
      <Skeleton className="h-8 w-2/3 max-w-sm" />
      <Skeleton className="h-4 w-full max-w-md" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    </div>
  );
}
