import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type AuthCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Carte commune aux écrans d'authentification. */
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <Card className="w-full gap-6 border-0 bg-transparent py-0 shadow-none ring-0 sm:border sm:bg-card sm:py-8 sm:shadow-sm sm:ring-1 [--card-spacing:--spacing(0)] sm:[--card-spacing:--spacing(8)]">
      <CardHeader className="gap-2">
        <CardTitle>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        </CardTitle>
        {description ? (
          <CardDescription className="text-base text-pretty">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer ? (
        <CardFooter className="justify-center border-0 bg-transparent pt-0 text-sm text-muted-foreground sm:pb-0">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}
