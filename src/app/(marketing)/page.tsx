import { ArrowRight, NotebookPen, Sprout, TrendingUp, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/shared/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
};

const features: readonly Feature[] = [
  {
    title: "Check-in quotidien",
    description: "Prends quelques minutes pour observer comment s'est passée ta journée.",
    icon: NotebookPen,
  },
  {
    title: "Comprends tes tendances",
    description:
      "Découvre progressivement les situations, émotions et stratégies qui reviennent dans ton parcours.",
    icon: TrendingUp,
  },
  {
    title: "Reconnais tes progrès",
    description:
      "Observe l'ensemble de ton cheminement plutôt que seulement une série de jours.",
    icon: Sprout,
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-14 px-4 pt-10 pb-6 sm:gap-20 sm:px-6 sm:pt-20">
      <section aria-labelledby="hero-title" className="flex flex-col items-center text-center">
        <BrandMark className="size-14 rounded-2xl [&_svg]:size-7" />
        <h1
          id="hero-title"
          className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-5xl"
        >
          {siteConfig.name}
        </h1>
        <p className="mt-3 text-lg font-medium text-primary sm:text-xl">{siteConfig.tagline}</p>
        <p className="mt-4 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
          Comprends tes habitudes, reconnais tes progrès et construis ta sobriété à ton rythme.
        </p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href={routes.signup}>
              Commencer
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link href={routes.login}>Se connecter</Link>
          </Button>
        </div>
      </section>

      <section aria-label="Ce que propose l'application">
        <ul className="grid gap-4 sm:grid-cols-3">
          {features.map(({ title, description, icon: Icon }) => (
            <li key={title} className="flex">
              <Card className="w-full [--card-spacing:--spacing(6)]">
                <CardHeader className="gap-3">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"
                  >
                    <Icon className="size-5" />
                  </span>
                  <CardTitle className="text-base">
                    <h2>{title}</h2>
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed text-pretty">
                    {description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
