/**
 * Routes centralisées. Ne jamais écrire ces chemins en dur ailleurs.
 */
export const routes = {
  home: "/",
  // Authentification (Sprint 1)
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  authCallback: "/auth/callback",
  // Page publique affichée après la suppression du compte (Sprint 11)
  accountDeleted: "/account-deleted",
  // Export des données (Route Handler, POST même origine)
  accountExport: "/api/account/export",
  // Rapport imprimable « Mon parcours » (Sprint 12)
  personalReport: "/reports/personal",
  // Bilans intelligents (Sprint 12)
  insights: "/insights",
  // Onboarding (Sprint 2)
  onboarding: "/onboarding",
  // Application authentifiée
  today: "/today",
  // Check-in quotidien (Sprint 3) : sous /today, donc protégé par le même préfixe.
  checkin: "/today/checkin",
  checkinEntry: "/today/entry",
  // Mode « J'ai envie de consommer » (Sprint 7)
  craving: "/craving",
  cravingHistory: "/craving/history",
  // Accomplissements (Sprint 9)
  achievements: "/achievements",
  // Sprints 3 à 8 — pas encore implémentées
  calendar: "/calendar",
  journal: "/journal",
  progress: "/progress",
  plan: "/plan",
  settings: "/settings",
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];

/** Zone authentifiée : accès réservé aux utilisateurs connectés. */
export const protectedRoutePrefixes: readonly string[] = [
  routes.onboarding,
  routes.today,
  routes.calendar,
  routes.journal,
  routes.progress,
  routes.craving,
  routes.achievements,
  routes.insights,
  "/reports",
  routes.plan,
  routes.settings,
];

/** Pages réservées aux visiteurs non connectés (un utilisateur connecté est redirigé). */
export const guestOnlyRoutes: readonly string[] = [routes.login, routes.signup];

/**
 * Destinations internes autorisées après une authentification (paramètre `next`).
 * Toute autre destination est remplacée par la destination par défaut.
 */
export const postAuthRedirectPrefixes: readonly string[] = [
  ...protectedRoutePrefixes,
  routes.resetPassword,
];
