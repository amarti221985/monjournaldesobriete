import { Award, Sparkle } from "lucide-react";

import { achievementIcons } from "@/features/achievements/constants";
import { formatEarnedDate, progressLabel, type AchievementView } from "@/features/achievements/logic";
import { cn } from "@/lib/utils";

/**
 * Carte d'accomplissement. Obtenu : icône, nom, description, date d'obtention (fuseau du
 * profil). Non obtenu : état discret « À découvrir » (jamais de cadenas punitif), barre de
 * progression accessible seulement pour les jalons quantitatifs. L'état est toujours écrit.
 */
export function AchievementCard({ view, timeZone }: { view: AchievementView; timeZone: string }) {
  const { definition } = view;
  const Icon = (definition.iconKey && achievementIcons[definition.iconKey]) || Award;
  const earned = view.status === "earned" || view.status === "reached";
  const percent = Math.round((view.current / definition.threshold) * 100);
  const progressId = `progress-${definition.slug}`;

  return (
    <li
      className={cn(
        "grid content-start gap-3 rounded-2xl border p-4",
        earned ? "bg-card" : "border-dashed bg-muted/30",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex size-10 shrink-0 items-center justify-center rounded-xl",
            earned ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="grid min-w-0 gap-0.5">
          <h3 className="font-semibold text-pretty">{definition.name}</h3>
          <p className="text-sm text-pretty text-muted-foreground">{definition.description}</p>
        </div>
      </div>

      {view.status === "earned" && view.earnedAt ? (
        <p className="text-sm">
          {view.dateSource === "attribution" ? "Reconnu le " : "Obtenu le "}
          {formatEarnedDate(view.earnedAt, timeZone)}
        </p>
      ) : view.status === "reached" ? (
        <p className="text-sm">Atteint</p>
      ) : definition.isQuantitative ? (
        <div className="grid gap-1.5">
          <p id={progressId} className="text-sm text-muted-foreground">
            {progressLabel(view)}
          </p>
          <div
            role="progressbar"
            aria-labelledby={progressId}
            aria-valuemin={0}
            aria-valuemax={definition.threshold}
            aria-valuenow={view.current}
            className="h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <span className="block h-full rounded-full bg-primary/70" style={{ width: `${percent}%` }} />
          </div>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Sparkle className="size-3.5" aria-hidden="true" />
          {definition.category === "plan" ? "À construire dans Mon plan, si tu le souhaites" : "À découvrir"}
        </p>
      )}
    </li>
  );
}
