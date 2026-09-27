import { Award } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { achievementIcons } from "@/features/achievements/constants";
import { formatEarnedDate, type AchievementDefinition, type AchievementView, type EarnedAchievement } from "@/features/achievements/logic";

/** /today : « Derniers accomplissements » (3 au plus). */
export function RecentAchievementsCard({
  earned,
  definitions,
  timeZone,
}: {
  earned: EarnedAchievement[];
  definitions: AchievementDefinition[];
  timeZone: string;
}) {
  const bySlug = new Map(definitions.map((definition) => [definition.slug, definition]));
  const items = earned.flatMap((item) => {
    const definition = bySlug.get(item.slug);
    return definition ? [{ ...item, definition }] : [];
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">Derniers accomplissements</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {items.length === 0 ? (
          <p className="text-sm text-pretty text-muted-foreground">
            Tes accomplissements apparaîtront au fil de tes check-ins, réflexions et actions.
          </p>
        ) : (
          <ul className="grid gap-3">
            {items.map(({ definition, earnedAt, dateSource }) => {
              const Icon = (definition.iconKey && achievementIcons[definition.iconKey]) || Award;
              return (
                <li key={definition.slug} className="flex items-start gap-3 text-sm">
                  <span aria-hidden="true" className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                    <Icon className="size-4" />
                  </span>
                  <span className="grid gap-0.5">
                    <span className="font-medium text-pretty">{definition.name}</span>
                    <span className="text-muted-foreground">
                      {dateSource === "attribution" ? "Reconnu le " : "Obtenu le "}
                      {formatEarnedDate(earnedAt, timeZone)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <Button asChild variant="outline" size="sm" className="justify-self-start">
          <Link href={routes.achievements}>Voir tous mes accomplissements</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/** /progress : « Jalons » (lien discret, pas une copie de /achievements). */
export function MilestonesCard({ earnedCount, nextCheckins }: { earnedCount: number; nextCheckins: AchievementView | null }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-0.5 text-sm">
          <h2 className="font-semibold">Jalons</h2>
          <p>
            {earnedCount} {earnedCount > 1 ? "accomplissements obtenus" : "accomplissement obtenu"}
          </p>
          {nextCheckins ? (
            <p className="text-muted-foreground">Prochain jalon de participation : {nextCheckins.definition.threshold} check-ins</p>
          ) : null}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={routes.achievements}>Voir mes accomplissements</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
