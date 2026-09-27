"use client";

import { Award, ChevronDown, LogOut, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { routes } from "@/config/routes";
import { signOutAction } from "@/features/auth/actions";

type UserMenuProps = {
  displayName: string | null;
  email: string | null;
};

function getInitial(displayName: string | null, email: string | null) {
  const source = displayName ?? email ?? "";
  return source.trim().charAt(0).toLocaleUpperCase("fr") || "?";
}

export function UserMenu({ displayName, email }: UserMenuProps) {
  const [isSigningOut, startSignOut] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-11 gap-2 px-2" aria-label="Menu du compte">
          <span
            aria-hidden="true"
            className="inline-flex size-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
          >
            {getInitial(displayName, email)}
          </span>
          <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">
            {displayName ?? "Mon compte"}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="grid gap-0.5 font-normal">
          <span className="truncate font-medium text-foreground">{displayName ?? "Mon compte"}</span>
          {email ? <span className="truncate text-xs text-muted-foreground">{email}</span> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="min-h-10">
          <Link href={routes.achievements}>
            <Award aria-hidden="true" />
            Mes accomplissements
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="min-h-10">
          <Link href={routes.insights}>
            <Sparkles aria-hidden="true" />
            Mes bilans
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="min-h-10">
          <Link href={routes.settings}>
            <Settings aria-hidden="true" />
            Paramètres
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="min-h-10"
          disabled={isSigningOut}
          onSelect={() => startSignOut(() => signOutAction())}
        >
          <LogOut aria-hidden="true" />
          {isSigningOut ? "Déconnexion…" : "Se déconnecter"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
