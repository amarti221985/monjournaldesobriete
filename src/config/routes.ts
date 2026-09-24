/**
 * Routes centralisées. Les routes marquées « Sprint N » n'existent pas encore :
 * ne pas les afficher dans une navigation visible avant leur implémentation.
 */
export const routes = {
  home: "/",
  // Sprint 1 — authentification
  login: "/login",
  signup: "/signup",
  // Sprints 3 à 8 — application authentifiée
  today: "/today",
  calendar: "/calendar",
  journal: "/journal",
  progress: "/progress",
  plan: "/plan",
  settings: "/settings",
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];
