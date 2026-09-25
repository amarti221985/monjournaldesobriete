import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motivationOptions, type Motivation } from "@/features/onboarding/constants";

const MAX_MOTIVATIONS = 5;
const REASON_EXCERPT_LENGTH = 180;

function excerpt(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > REASON_EXCERPT_LENGTH ? `${clean.slice(0, REASON_EXCERPT_LENGTH).trimEnd()}…` : clean;
}

/** « Ce qui compte pour toi » : motivations et extrait du « pourquoi » (onboarding). */
export function MotivationsCard({
  motivations,
  reason,
}: {
  motivations: { motivation: Motivation; customLabel: string | null }[];
  reason: string | null;
}) {
  if (motivations.length === 0 && !reason) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">Ce qui compte pour toi</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {motivations.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {motivations.slice(0, MAX_MOTIVATIONS).map(({ motivation, customLabel }) => {
              const { label, icon: Icon } = motivationOptions[motivation];
              return (
                <li
                  key={motivation}
                  className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {motivation === "other" && customLabel ? customLabel : label}
                </li>
              );
            })}
          </ul>
        ) : null}
        {reason ? (
          <blockquote className="border-l-2 border-primary/40 pl-3 text-sm text-pretty text-muted-foreground italic">
            « {excerpt(reason)} »
          </blockquote>
        ) : null}
      </CardContent>
    </Card>
  );
}
