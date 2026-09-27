"use client";

import { useEffect } from "react";

import "./globals.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

/**
 * Dernier filet de sécurité : remplace le layout racine si celui-ci échoue.
 * Volontairement minimal (pas de dépendance au layout ni aux polices).
 */
export default function GlobalError({ error, retry }: GlobalErrorProps) {
  useEffect(() => {
    // Seulement le digest (jamais le message ni la pile, qui pourraient contenir des données).
    console.error("Erreur d'affichage", error.digest ?? "sans digest");
  }, [error]);

  return (
    <html lang="fr">
      <body className="flex min-h-screen items-center justify-center bg-background p-4 font-sans text-foreground">
        <title>Un problème est survenu</title>
        <main className="flex max-w-md flex-col items-center gap-4 text-center">
          <h1 className="text-xl font-semibold">Un problème est survenu</h1>
          <p className="text-muted-foreground">
            L&apos;application n&apos;a pas pu s&apos;afficher. Tes données enregistrées ne sont pas
            affectées.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            className="h-12 rounded-lg bg-primary px-6 font-medium text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
