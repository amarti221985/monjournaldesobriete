"use client";

import { useEffect } from "react";

import { saveDetectedTimezoneAction } from "@/features/profile/actions";
import { detectBrowserTimeZone } from "@/lib/timezone";

/**
 * Enregistre le fuseau du navigateur lorsque le profil n'en a pas encore.
 * Invisible et non bloquant : un échec est simplement ignoré (nouvel essai à la
 * prochaine visite).
 */
export function TimezoneSync() {
  useEffect(() => {
    const timezone = detectBrowserTimeZone();
    if (!timezone) return;
    saveDetectedTimezoneAction(timezone).catch(() => {
      // Sans conséquence pour l'utilisateur.
    });
  }, []);

  return null;
}
