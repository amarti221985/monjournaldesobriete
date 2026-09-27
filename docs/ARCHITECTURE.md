# Architecture

## Stack

| Couche | Choix | Version (Sprint 0) |
| --- | --- | --- |
| Framework | Next.js (App Router, Turbopack) | 16.3.6 |
| UI | React | 19.2.8 |
| Langage | TypeScript (`strict: true`) | 5.x |
| Styles | Tailwind CSS | 4.x |
| Composants | shadcn/ui (style `radix-nova`, primitives Radix) | CLI 4.21.0 |
| Icônes | Lucide React | 1.48.x |
| Validation | Zod | 4.6.x |
| Backend | Supabase (`@supabase/supabase-js`, `@supabase/ssr`) | 2.117.x / 0.12.x |
| Tests | Vitest | 5.0.x |
| Runtime | Node.js 24 LTS recommandé (minimum 20.9, exigence de Next 16) | |

Aussi : `server-only` (empêche l'import de code serveur dans le client).

Recharts 3 (graphique des scores, Sprint 4). React Hook Form n'a pas
été nécessaire au Sprint 1 (formulaires courts : Server Actions + Zod) ; il sera réévalué pour
le check-in (Sprint 3).

## Structure des dossiers

```text
src/
  proxy.ts                  Proxy Next 16 : rafraîchissement de session + redirections d'accès
  app/                      Routes (App Router)
    (marketing)/            Pages publiques : accueil (puis confidentialité, conditions)
    (auth)/                 login, signup, forgot-password, reset-password (+ layout)
    (onboarding)/           Wizard d'onboarding (layout sobre + onboarding/)
    (app)/                  Zone authentifiée : layout (AppShell + CTA envie) + today/, calendar/, journal/, progress/, craving/, plan/, achievements/, settings/
    auth/callback/route.ts  Callback Supabase Auth (confirmation, réinitialisation)
    layout.tsx              Layout racine : police, metadata, providers
    globals.css             Design tokens + Tailwind
    error.tsx, global-error.tsx, not-found.tsx, loading.tsx, icon.svg
  features/                 Code par fonctionnalité (ADR-022)
    auth/
      actions.ts            Server Actions : inscription, connexion, oubli, reset, déconnexion
      schemas.ts            Schémas Zod partagés client / serveur
      errors.ts             Erreurs Supabase → messages humains (anti-énumération)
      components/           Formulaires, AuthCard, UserMenu, SignOutButton
    onboarding/             Wizard : constantes, schémas, logique pure, actions, composants
    checkin/                Check-in quotidien : constantes, schémas, logique, affichage, actions, composants
    progress/               Tableau de bord et Progression : métriques, périodes, analyses, observations (pur, testé), cartes
    craving/                Mode envie : schémas, minuteur, variation, analyse des stratégies (pur, testé), actions, composants
    plan/                   Mon plan : schémas, ordre / favoris, panneau rapide (pur, testé), actions par section, composants
    achievements/           Accomplissements : évaluateurs, vues, prochaines étapes, notification (pur, testé), composants
    settings/               Paramètres : schémas, export (pur, testé), actions, composants
    calendar/               Calendrier : états, mois, année (pur, testé), composants
    journal/                Journal : filtres, recherche, pagination (pur, testé), actions, composants
    profile/
      actions.ts            Enregistrement du fuseau détecté
      components/           TimezoneSync
  components/
    ui/                     Composants shadcn/ui (code possédé, modifiable)
    layout/                 SiteHeader/Footer, AppShell, AppHeader, sidebar, nav mobile, PageHeader, PageContainer
    forms/                  FormField, PasswordInput, SubmitButton, FormAlert, SelectableOption, SelectableChip
    shared/                 BrandMark, StatusMessage, DayStatusBadge, ConfirmDialog
  config/                   site, routes (+ zones protégées / redirections autorisées), navigation, day-status
  hooks/                    use-client-validation
  lib/
    env.ts                  Validation des variables d'environnement (Zod)
    forms.ts                État des formulaires, erreurs Zod par champ
    timezone.ts             Validation / détection des fuseaux IANA
    auth/redirects.ts       getSafeRedirect, resolveProxyRedirect (pur, testé)
    auth/session.ts         getCurrentUser, requireUser (server-only)
    services/               profiles, substances, onboarding, journey, checkins, progress, calendar, journal, craving, plan, achievements, account (server-only)
    dates.ts                Journées locales, date maximale, formatage
    supabase/               Clients navigateur / serveur / proxy
    utils.ts                cn()
  types/
    database.ts             Types générés depuis le schéma Supabase
supabase/
  config.toml               Configuration CLI Supabase
  migrations/               Migrations SQL versionnées
  tests/                    Scripts SQL de vérification (RLS)
  README.md                 Commandes et règles de migration
docs/                       Documentation projet
```

Les dossiers sont créés **lorsqu'ils contiennent réellement quelque chose**. À venir :
logique métier pure (séries, statistiques, dates locales) dans `src/lib/domain/` ou dans la
fonctionnalité concernée, et une fonctionnalité par dossier dans `src/features/`.

## Route groups

| Groupe | Rôle | Layout |
| --- | --- | --- |
| `(marketing)` | Public. Accueil temporaire. | `SiteHeader` + `SiteFooter` |
| `(auth)` | Connexion, inscription, mot de passe oublié, nouveau mot de passe. | Marque + carte centrée, retour à l'accueil |
| `(onboarding)` | Configuration du parcours (`/onboarding`), obligatoire avant l'application. | Marque + menu du compte, sans navigation |
| `(app)` | Application authentifiée (`/today`). | `AppShell` (sidebar desktop, barre inférieure mobile, menu utilisateur) |

Un seul layout racine (`src/app/layout.tsx`). La navigation de l'app n'affiche en lien que les
sections disponibles (`available: true` dans `src/config/navigation.ts`) ; les autres sont
désactivées avec la mention « Bientôt ».

## Stratégie frontend / backend

- **Server Components par défaut.** `"use client"` seulement pour l'interactivité (état,
  événements, hooks navigateur). Exemple actuel : `NavLink` (utilise `usePathname`).
- **Écritures** : Server Actions (ou Route Handlers si un endpoint HTTP est nécessaire),
  avec validation Zod côté serveur.
- **Lecture** : Server Components qui appellent des services dans `src/lib/services/`.
  Les composants UI n'importent jamais directement le client Supabase pour des requêtes métier.
- **Logique métier** (séries, statistiques, dates locales) : fonctions pures centralisées et
  testées, jamais dupliquées dans les composants.
- **Aucune dépendance à une plateforme** (pas de Vercel-only) : l'app tourne sur un serveur
  Node standard (`next build` + `next start`), cible Hostinger Business (Node.js Web App).

## Supabase

- `src/lib/supabase/client.ts` : `createBrowserClient` pour les Client Components.
- `src/lib/supabase/server.ts` : `createServerClient` + `cookies()`, un client par requête.
  `cookies()` est lu **avant** la validation des variables : les routes deviennent dynamiques et
  le build ne dépend jamais des clés.
- `src/lib/supabase/proxy.ts` : `updateSession()` (approche officielle `@supabase/ssr`) et
  `redirectWithSession()` (conserve les cookies rafraîchis lors d'une redirection).
- URL du projet + **clé publiable** uniquement, validées par `src/lib/env.ts`. La sécurité des
  données repose sur la **RLS**. Aucune clé secrète n'est utilisée.
- Clients typés avec `Database` (`src/types/database.ts`, `npm run db:types`).

## Authentification (Sprint 1)

### Sessions et protection (ADR-018)

1. **Proxy** (`src/proxy.ts`, toutes les routes hors fichiers statiques) : rafraîchit la session
   via `getClaims()`, puis applique `resolveProxyRedirect()` :
   - visiteur sur une zone protégée → `/login?next=<chemin>` ;
   - utilisateur connecté sur `/login` ou `/signup` → `getAuthenticatedHomeRoute()` (`/today`,
     puis `/onboarding` selon `onboarding_completed` au Sprint 2).
   Si Supabase n'est pas configuré, les pages publiques restent accessibles.
2. **Serveur** : le layout `(app)`, les pages protégées et les Server Actions appellent
   `requireUser()` / `getCurrentUser()` (`getClaims()` = JWT vérifié, mémorisé par requête).
3. **Base** : RLS sur `profiles`.

### Parcours

| Parcours | Étapes |
| --- | --- |
| Inscription | `/signup` → `signUpAction` (Zod) → `auth.signUp` avec `display_name` et `timezone` en métadonnées → trigger `handle_new_user` crée le profil. Confirmation désactivée : session immédiate → `/today`. Activée : écran « Vérifie tes courriels » → lien → `/auth/callback` → `/today`. |
| Connexion | `/login?next=...` → `signInAction` → `auth.signInWithPassword` → `getSafeRedirect(next)`. Message générique en cas d'échec. |
| Mot de passe oublié | `/forgot-password` → `auth.resetPasswordForEmail` (retour : `/auth/callback?next=/reset-password`) → message identique que le compte existe ou non. |
| Réinitialisation | lien → `/auth/callback` (session de récupération) → `/reset-password` → `auth.updateUser({ password })` → « Ton mot de passe a été mis à jour. » → accès à l'espace. Sans session : écran « Lien expiré ». |
| Déconnexion | menu utilisateur ou bouton → `signOutAction` → `/login`. |

### Callback `/auth/callback`

Accepte `?code=` (PKCE, `exchangeCodeForSession`) et `?token_hash=&type=` (`verifyOtp`).
`next` est validé par `getSafeRedirect` (`recovery` → `/reset-password` par défaut). Échec →
`/login?error=link_invalid` (code connu, jamais de texte arbitraire dans l'URL).
Les URL de retour sont construites depuis `NEXT_PUBLIC_SITE_URL` ; configuration Supabase :
[SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

### Profil courant

`getCurrentProfile()` (`src/lib/services/profiles.ts`) lit le profil de l'utilisateur connecté,
mémorisé par requête. Pas de Context React global : les données serveur sont passées en props.
`TimezoneSync` enregistre le fuseau du navigateur si le profil n'en a pas (ADR-019).

### Formulaires

- Server Actions + `useActionState` ; état `idle | success | error` (`src/lib/forms.ts`),
  `pending` fourni par React (bouton désactivé, indicateur de chargement).
- Validation client **et** serveur avec le même schéma Zod (`useClientValidation` bloque la
  soumission invalide et place le focus sur le premier champ en erreur).
- Accessibilité : `FormField` relie libellé, aide et erreur (`aria-invalid`, `aria-describedby`) ;
  message global `role="alert"` / `role="status"` ; `autocomplete` adapté ; mot de passe
  affichable / masquable.
- Journalisation : codes d'erreur techniques uniquement (jamais courriel, mot de passe, jeton,
  cookie ni contenu du profil).

## Onboarding (Sprint 2)

### Routage (ADR-025, ADR-033)

```text
Non connecté ──► /login, /signup
      │
Connecté ──► onboarding terminé ?
               ├─ non ─► /onboarding   (/today et toute la zone (app) y redirigent)
               └─ oui ─► /today        (/onboarding y redirige ; /login et /signup aussi)
```

Appliqué par le proxy (HTTP 307, état lu seulement pour les routes concernées), puis revérifié
par le layout `(app)` et la page `/onboarding`. Après connexion : `resolvePostLoginRedirect()`.

### Wizard `/onboarding`

- Route `src/app/(onboarding)/onboarding/page.tsx` (Server Component) : vérifie l'accès, charge
  le catalogue, le brouillon et calcule la date maximale (fuseau du profil), puis rend
  `OnboardingWizard` (Client Component, seul composant avec état).
- 8 étapes + confirmation : Bienvenue · Ce que je veux changer · Mon objectif · Mon point de
  départ · Pourquoi · Ce qui compte pour moi · Mon soutien (facultatif) · Résumé → « Ton parcours
  est prêt ». « Étape N sur 8 » + barre de progression ; Retour / Continuer ; « Modifier »
  depuis le résumé ramène au résumé ; « Enregistrer et quitter ».
- Validation par étape (`validateStep`, schémas Zod de `src/features/onboarding/schemas.ts`),
  revalidée par la Server Action puis par la RPC.
- Brouillon côté serveur (`onboarding_drafts`) à chaque étape (ADR-031).
- Finalisation : `completeOnboardingAction` → RPC `complete_onboarding` (ADR-028). Erreur :
  réponses conservées + « Réessayer ». Bouton désactivé pendant l'envoi ; RPC idempotente.
- Accessibilité : cartes sélectionnables basées sur de vrais `checkbox` / `radio`
  (`SelectableOption`, coche visible en plus de la couleur), `fieldset` / `legend`, erreurs
  reliées (`aria-describedby`), focus déplacé sur le titre à chaque étape et sur le premier champ
  en erreur.

### Fichiers

```text
src/app/(onboarding)/layout.tsx, onboarding/page.tsx
src/features/onboarding/
  constants.ts        valeurs métier ↔ libellés, étapes, mention de sevrage
  schemas.ts          Zod : sélection, objectifs, date, raison, motivations, contact, finalisation, brouillon
  logic.ts            resolvePrimarySlug, buildCompletionPayload, validateStep (pur, testé)
  actions.ts          saveOnboardingDraftAction, completeOnboardingAction
  components/         OnboardingWizard, étapes, progression, confirmation
src/lib/services/     substances.ts, onboarding.ts, journey.ts
src/lib/dates.ts      journée locale, date max, formatage (pur, testé)
src/components/forms/selectable-option.tsx
```

## Check-in quotidien (Sprint 3)

### Pages

| Route | Rôle |
| --- | --- |
| `/today` | Accueil quotidien : date locale, état du check-in (à faire / en cours / complété avec résumé), objectif principal et début du parcours |
| `/today/checkin` | Wizard : nouveau check-in, reprise d'un brouillon, ou modification d'un check-in terminé |
| `/today/entry` | Consultation du check-in terminé du jour (lecture seule) |

Toutes sous `/today` : protégées par le proxy et le layout `(app)` (connexion + onboarding).
La journée est calculée côté serveur (`getUserToday(profiles.timezone)`) et figée dans le wizard.

### Wizard

Étapes : Ma journée · Comment je me sens · Émotions · Déclencheurs · **Consommation**
(seulement si « J'ai consommé ») · Mes actions et victoires · Réflexion · Résumé.
« Étape N sur 7 » (ou 8), barre de progression, Retour / Continuer, « Modifier » depuis le
résumé, confirmation sobre « Journée enregistrée ».

- **Nouveau / brouillon** : sauvegarde serveur (`saveCheckinDraftAction`) à chaque « Continuer »
  et par « Enregistrer et quitter » ; reprise à la première étape utile (`getResumeStepIndex`).
- **Modification** : pré-rempli depuis la base (`recordToDraft`), ouvert au résumé ; rien n'est
  écrit avant « Enregistrer les modifications ».
- **Finalisation** : `completeCheckinAction` → RPC `save_checkin(…, finalize => true)`.
- `consumed → sober` avec consommations notées : dialogue de confirmation, puis retrait.
- Échelles 0/1-10 : groupes de boutons radio natifs (`ScoreScale`), valeur affichée en clair,
  extrêmes libellés. Émotions, déclencheurs, accomplissements : puces à cocher
  (`SelectableChip`) qui s'enroulent sur mobile.

### Fichiers

```text
src/app/(app)/today/page.tsx, checkin/page.tsx, entry/page.tsx
src/features/checkin/
  constants.ts        statuts, échelles, limites de texte, étapes
  schemas.ts          Zod : statut, scores, sélections, consommations, payload (brouillon / final)
  logic.ts            étapes conditionnelles, validation par étape, reprise, payload (pur, testé)
  display.ts          conversions brouillon / base → affichage et base → brouillon
  actions.ts          saveCheckinDraftAction, completeCheckinAction, discardCheckinDraftAction
  components/         CheckinWizard, étapes, ScoreScale, CheckinSummaryView, CheckinComplete,
                      RestartCheckinButton
src/lib/services/checkins.ts   catalogues, check-in d'une journée (une requête imbriquée), save
src/components/forms/selectable-chip.tsx
src/components/shared/day-status-badge.tsx, confirm-dialog.tsx
```

La déconnexion se fait désormais par le menu du compte ; le bouton temporaire de `/today`
(Sprint 1) a été retiré.

## Tableau de bord et progression (Sprint 4)

`/today` (`src/app/(app)/today/(dashboard)/page.tsx`, groupe de routes pour que son
`loading.tsx` ne s'applique pas à `/today/checkin` ni `/today/entry`) :

| Section | Composant | Contenu |
| --- | --- | --- |
| En-tête | page | « Bonjour, prénom » · « Aujourd'hui, jeudi 24 septembre » |
| Check-in du jour | `TodayCheckinCard` | à faire / commencé / complété (statut, scores, victoire) |
| Ta progression | `ProgressOverviewCard` | journées sobres enregistrées (dominant), jours suivis, taux, série actuelle, meilleure série, jours avec consommation |
| Cette semaine | `WeekCard` | lundi → dimanche, icône + libellé + couleur, aujourd'hui entouré, légende, « Tes 7 derniers jours » |
| Comment tu te sens | `ScoreTrendsCard` (client, Recharts) | 7 / 30 jours, moyennes, tableau de valeurs |
| Ce que tes données montrent | `InsightsCard` | ≤ 3 tendances descriptives, ou « Tes tendances arrivent bientôt » |
| Ce qui compte pour toi | `MotivationsCard` | ≤ 5 motivations + extrait du « pourquoi » |
| Mon objectif | `GoalCard` | substance principale, objectif, date, « + N autres » |

Mobile : une colonne ; desktop (`lg`) : 2/3 + 1/3. États vides (aucun check-in, moins de 7),
chargement (squelettes de même grille) et erreur (`ProgressError`, « Réessayer »).

```text
src/features/progress/
  types.ts        ProgressCheckin, isSoberStatus
  metrics.ts      calculateSobrietyMetrics, calculateStreaks
  week.ts         buildCurrentWeek, calculateRecentDaysSummary
  scores.ts       buildScoreSeries, average, calculateScoreAverages
  insights.ts     règles, seuils et modèles de phrases des tendances
  format.ts       formats fr-CA (1 décimale, %)
  dashboard.ts    buildDashboard(today, checkins) : toutes les données préparées
  components/     cartes du tableau de bord
src/lib/services/progress.ts   getCompletedCheckinsForProgress (une requête, colonnes utiles)
src/lib/dates.ts               addDays, getWeekStart, getMondayBasedWeekday, formatLocalDate
```

## Calendrier et journal historique (Sprint 5)

### Routes

| Route | Rôle |
| --- | --- |
| `/calendar?view=month&month=YYYY-MM` | Mois (défaut : mois courant, fuseau du profil), lundi → dimanche |
| `/calendar?view=year&year=YYYY` | Année compacte : 12 mini-grilles, résumé annuel, liens vers chaque mois |
| `/journal?status=&period=` | Journal : check-ins terminés, filtres (URL), recherche (jamais dans l'URL), « Afficher plus » |
| `/journal/[date]` | Détail complet d'une journée, navigation entre journées enregistrées |
| `/journal/[date]/edit` | Modification d'un check-in passé (même wizard, date figée) |

Protégées par le proxy et le layout `(app)` (connexion + onboarding). Navigation : Aujourd'hui,
Calendrier et Journal actifs ; élément actif signalé par `aria-current`, une barre et la graisse.

### Composants

```text
src/features/calendar/
  logic.ts            états, grille du mois, année, liens, paramètres d'URL (pur, testé)
  components/         MonthCalendar (tableau accessible), YearCalendar, CalendarToolbar, CalendarLegend
src/features/journal/
  logic.ts            filtres, périodes, recherche, pagination, paramètre [date] (pur, testé)
  actions.ts          loadJournalEntriesAction (recherche / filtres / page suivante)
  components/         JournalBrowser, JournalEntryCard
src/lib/services/calendar.ts   getCalendarEntries (date, statut, terminé), hasAnyCompletedCheckin
src/lib/services/journal.ts    getJournalPage (search_journal + aperçus), getAdjacentCheckinDates
src/config/day-status.ts       + états « En cours », « À venir », « Avant ton parcours » (getDayStateDisplay)
src/components/shared/         LoadError, StatusMessage (niveau de titre configurable)
```

- `CheckinSummaryView` (Sprint 3) sert au détail avec `hideEmpty` : seules les sections
  remplies ; « Consommation enregistrée » avec chaque événement.
- `CheckinWizard` accepte `returnHref` : retour au détail après une modification historique.
- Groupes de routes `journal/(list)` et `journal/[date]/(detail)` : chaque `loading.tsx` ne
  s'applique qu'à sa page.

### Requêtes

| Vue | Requêtes |
| --- | --- |
| Mois / année | 1 lecture minimale de la période + 1 comptage + substances suivies (début du parcours) |
| Journal | 1 appel `search_journal` (page + relations d'aperçu) + brouillon du jour |
| Détail | check-in complet (1 requête imbriquée) + journées voisines (2 lectures d'une date) |

## Progression et analyses (Sprint 6)

Route protégée `/progress?period=7d|30d|90d|year|all` (défaut 30 jours, ADR-052). Identité issue de
la session ; la période est la seule donnée lue dans l'URL.

### Sections

1. En-tête « Ma progression » + sélecteur de période (liens, `aria-current`) + plage affichée
   (« du 26 août au 24 septembre 2026 — 30 journées calendaires »).
2. Métriques de la **période** : jours sobres, jours suivis, taux, jours avec consommation.
3. « Depuis le début de ton parcours » : jours sobres, jours suivis, série actuelle, meilleure série.
4. « Ton évolution » : un seul graphique Recharts, sélecteur Humeur | Énergie | Stress | Envie,
   absences = pas de point (jamais 0), moyenne + comparaison, tableau « Voir les valeurs ».
5. « Ce que tes données montrent » (5 max) + « Comment ces tendances sont-elles calculées ? ».
6. « Comparaison » (7 / 30 / 90 jours) : moyennes et jours suivis, écarts en points.
7. « Tes journées enregistrées » (barre décorative + nombres en texte).
8. Déclencheurs, émotions, accomplissements (top 5 + « Voir plus »), association accomplissement ↔
   envie.
9. « Ton envie de consommer » : jours de la semaine (≥ 3 check-ins) et stress ≥ 7 vs autres.
10. « Journées avec consommation » : journées, événements, par substance, déclencheurs, envie
    moyenne, objectifs.

### Fichiers

```text
src/features/progress/
  periods.ts            périodes calendaires, période précédente, plages (partagé avec le journal)
  analytics.ts          seuils, comparaison, fréquences, associations, jours de semaine, consommation
  progress-insights.ts  observations descriptives (règles, modèles de phrases, base de calcul)
  progress-page.ts      buildProgressPage() : toutes les données de la page (pur)
  score-labels.ts       libellés / couleurs des scores, mots de tendance neutres
  components/analytics/ PeriodSelector, PeriodMetrics, SinceStartCard, ScoreEvolutionCard (client),
                        ComparisonCard, StatusDistributionCard, FrequencyCard, CravingPatternsCard,
                        ConsumptionCard, ProgressInsightsCard, SectionCard
src/lib/services/progress.ts   getProgressDataset() : une requête relationnelle (tableau de bord + progression)
src/app/(app)/progress/        page.tsx, loading.tsx (squelette sans chiffres)
```

Types applicatifs : `ProgressPeriod`, `ProgressMetrics` (= `SobrietyMetrics`), `ScoreTrend`,
`PeriodComparison`, `TriggerFrequency` / `EmotionFrequency` / `AchievementFrequency`,
`CravingAssociation`, `WeekdayCravingSummary`, `ConsumptionSummary`, `DescriptiveInsight`.

### Requêtes

| Vue | Requêtes |
| --- | --- |
| `/progress` | 1 lecture relationnelle des check-ins terminés (+ relations) ∥ substances suivies (+ profil) |

Nombre constant quel que soit le nombre de check-ins. Graphique : une couleur par score
(`--series-mood`, `--series-energy`, `--series-stress`, `--series-craving`, validées contraste +
daltonisme), toujours accompagnée du libellé ; animations désactivées.

## Mode « J'ai envie de consommer » (Sprint 7)

### Routes

| Route | Rôle |
| --- | --- |
| `/craving` | « Prends un moment » : étape 1 (envie 0–10, substances, émotions, déclencheurs, contexte), reprise d'un moment en cours, 5 interventions récentes, « Ce qui semble t'aider » |
| `/craving/[id]` | Intervention d'un moment : stratégie → minuteur → réévaluation → « Moment enregistré » (étape relue depuis la base : reprise fiable) |
| `/craving/history` | Les 100 interventions terminées les plus récentes |

Protégées (préfixe `/craving` dans `protectedRoutePrefixes`, proxy + layout `(app)`).

### CTA global

`CravingCta` (client), rendu par le layout `(app)` : en haut de la sidebar desktop (« J'ai envie de
consommer ») et dans l'en-tête mobile (« J'ai envie », nom accessible complet), variante secondaire
calme. S'il existe un moment en cours aujourd'hui : « Continuer mon intervention ». Masqué sur les
pages `/craving*`. Le layout lit l'identifiant du moment en cours (1 requête légère, lecture seule).

### Fichiers

```text
src/features/craving/
  constants.ts        bornes, durées (5 / 10 / 15 / sans), seuil d'analyse, textes (erreur, sécurité)
  schemas.ts          Zod : moment, stratégie + durée, minuteur, réévaluation
  logic.ts            minuteur (horodatages), étape courante, réduction initial − final, analyse (pur, testé)
  actions.ts          Server Actions (démarrer, stratégie, minuteur, terminer, mettre de côté, autre stratégie)
  components/         CravingCta, CravingStartForm, CravingSession (StrategyStep, ActiveStep,
                      ReevaluateStep), SupportContacts / PersonalReasons, CravingHistoryList,
                      StrategyInsights, SafetyNote
src/lib/services/craving.ts   lectures (relations embarquées) + appels RPC
src/app/(app)/craving/        page.tsx, [id]/page.tsx, history/page.tsx, loading.tsx
```

Réutilisés : `ScoreScale` et catalogues du check-in (`getCheckinCatalogues`), `SelectableChip`,
substances suivies, raison / motivations / contacts du Sprint 2 (`journey.ts`).

### Requêtes

| Vue | Requêtes |
| --- | --- |
| `/craving` | fermeture des moments expirés (RPC) puis, en parallèle : substances, catalogues, stratégies, 5 moments terminés (relations embarquées), données d'analyse, moment en cours |
| `/craving/[id]` | fermeture des moments expirés puis, en parallèle : moment (relations embarquées), stratégies, contacts, raison, motivations |

Aucun N+1 ; nombre de requêtes constant.

## Mon plan personnel (Sprint 8)

Route protégée `/plan` (déjà dans `protectedRoutePrefixes`), entrée « Mon plan » de la navigation
activée. Données **choisies** par l'utilisateur (≠ `/progress`, données observées ; ADR-064).

### Sections

1. Mon parcours — substances actives, objectif, date de départ (confirmation), principale, ajout,
   arrêt du suivi (désactivation).
2. Pourquoi je fais ce changement — raison principale.
3. Ce qui compte pour moi — motivations (au moins une, précision « Autre »).
4. Mes déclencheurs — catalogue ou texte personnel + « Ce que je remarque ».
5. Ce qui peut m'aider — stratégies du catalogue ou personnelles, notes, durée par défaut
   (aucune / 5 / 10 / 15 / 20), 3 favoris.
6. Mes personnes de soutien — contacts, Appeler (`tel:`) / Écrire (`mailto:`), personne principale.
7. Mes lieux sûrs — texte seulement, 3 favoris.
8. Mon rappel — un rappel principal.
9. Ma lettre à moi-même — repliée par défaut.

Desktop : sommaire collant (ancres). Mobile : cartes empilées, édition dans la carte.

### Fichiers

```text
src/features/plan/
  constants.ts        bornes, durées, favoris max, textes (exemples jamais enregistrés)
  schemas.ts          Zod (réutilise ceux de l'onboarding : substances, raison, motivations, contacts)
  logic.ts            ordre (principal / favoris), panneau rapide, options de stratégies du mode envie (pur, testé)
  actions.ts          une Server Action par section (sauvegarde indépendante)
  components/         plan-ui (PlanSection, usePlanAction, FormActions, confirmations…),
                      journey-section, why-sections, triggers-strategies-sections,
                      people-places-sections, words-sections, quick-support
src/lib/services/plan.ts      lectures + écritures (RPC ou écritures filtrées par user_id)
src/app/(app)/plan/           page.tsx (sections en parallèle, indépendantes), loading.tsx
```

### Intégration au mode envie

- `StrategyStep` : « Tes stratégies » (plan, favoris ★ d'abord, durée par défaut) puis « Autres
  stratégies » (`groupCravingStrategies`). Une stratégie personnelle est copiée en texte dans
  l'intervention (l'historique ne dépend pas du plan).
- `ActiveStep` et l'écran de fin : panneaux repliés `ReminderPanel`, `PersonalReasons`,
  `SupportContacts` (principale d'abord), `SafePlacesPanel`, `LetterPanel`.
- `/craving` : `QuickSupportCard` « Ce qui peut m'aider maintenant » si des favoris existent.

### Requêtes

| Vue | Requêtes |
| --- | --- |
| `/plan` | 12 lectures légères en parallèle (`Promise.allSettled`), aucune N+1 |
| `/craving`, `/craving/[id]` | + 4 lectures du plan en parallèle, facultatives |

## Accomplissements et jalons (Sprint 9)

Route protégée `/achievements` (préfixe dans `protectedRoutePrefixes`). Pas de 6e entrée dans la
barre du bas : accès depuis `/today` (« Derniers accomplissements »), `/progress` (« Jalons ») et le
menu du compte (« Mes accomplissements »).

### Flux

```text
Action importante (check-in terminé, moment d'envie terminé, plan modifié)
  → Server Action → awardAchievements() → RPC award_achievements() (SECURITY DEFINER, sans paramètre)
      → achievement_metric_events(auth.uid())  (métriques SQL, une passe)
      → INSERT … ON CONFLICT DO NOTHING RETURNING  (nouveaux seulement)
  → { awarded, initial } renvoyé au client → useAchievementNotifier() → notification discrète
Rendu de /achievements et /today : LECTURE SEULE (ADR-089). Historique non enregistré →
  bouton « Enregistrer mes jalons » → reconcileAchievementsAction() (action explicite)
```

### Fichiers

```text
src/features/achievements/
  constants.ts        catégories, icônes Lucide (par icon_key), libellés de progression
  logic.ts            évaluateurs par catégorie, vues (obtenu / atteint / en cours), prochaines
                      étapes, dates (fuseau), notification regroupée (pur, testé)
  components/         AchievementNotifierProvider (layout (app)), ReconcileAchievements,
                      AchievementCard, RecentAchievementsCard, MilestonesCard
src/lib/services/achievements.ts   catalogue, obtenus, progression (RPC), attribution (RPC)
src/app/(app)/achievements/        page.tsx, loading.tsx
```

### Requêtes

| Vue | Requêtes |
| --- | --- |
| `/achievements` | en parallèle : catalogue, progression (1 RPC), obtenus ; aucune attribution |
| `/today` | +2 lectures (derniers obtenus, catalogue) ; aucune attribution |
| `/progress` | +3 lectures (catalogue, progression, obtenus), aucune attribution |

## Sécurité, confidentialité et contrôle des données (Sprint 11)

Voir [SECURITY.md](./SECURITY.md) (audit, RLS, fonctions, en-têtes, limitations) et
[PRIVACY.md](./PRIVACY.md) (carte des données, tiers, flux IA).

| Élément | Emplacement |
| --- | --- |
| Paramètres (compte, sécurité, données, confidentialité, zone sensible) | `src/app/(app)/settings/`, `src/features/settings/` |
| Export JSON versionné (POST même origine, no-store) | `src/app/api/account/export/route.ts`, `src/features/settings/export.ts` |
| Compte (nom, fuseau, courriel, mot de passe, sessions, export, suppression) | `src/lib/services/account.ts` |
| Même origine, limite de fréquence | `src/lib/security/request.ts` |
| En-têtes HTTP (CSP, nosniff, referrer, permissions, HSTS) | `next.config.ts` |
| Page publique après suppression | `src/app/(marketing)/account-deleted/` |

Accès aux paramètres : sidebar (« Paramètres » activé) et menu du compte.

## Bilans intelligents et rapport PDF (Sprint 12)

Détails : [AI.md](./AI.md) et [PDF_EXPORT.md](./PDF_EXPORT.md).

```text
/insights → « Générer mon bilan » → generateWeeklyInsightAction()
  session → getAiPreferences (consentement) → getConfiguredAiProvider (clé serveur)
  → getWeeklyPeriod(getUserToday) → collectWeeklyInsightSource (catégories autorisées, RLS)
  → checkWeeklyInsightPreconditions (avant toute réservation)
  → reserve_ai_generation() (1 / 24 h) → buildWeeklyInsightDataset (pur, minimisé)
  → AiProvider.generateWeeklyReflection → validateWeeklyReflection (schéma + garde-fous)
  → save_ai_reflection() → revalidatePath
```

| Élément | Emplacement |
| --- | --- |
| Page « Mes bilans », squelette | `src/app/(app)/insights/` |
| Server Actions (préférences, génération, suppression) et composants | `src/features/insights/` |
| Cœur IA (schémas, confidentialité, jeu de données, prompt, garde-fous, fournisseur) | `src/lib/ai/` |
| Accès aux données IA | `src/lib/services/ai.ts` |
| Rapport imprimable (layout sans navigation, page) | `src/app/(report)/` |
| Options du rapport, bouton d'impression, formulaire | `src/features/reports/` |
| Données du rapport | `src/lib/services/report.ts` |
| En-têtes no-store / noindex du rapport | `privateDocumentHeaders` (`src/config/security-headers.ts`) |

Accès : menu du compte (« Mes bilans »), bouton sur `/progress`, section « Intelligence et
confidentialité » de `/settings`. Rapport : `/settings` → « Mes données » → « Rapport PDF ». Sprint 10 (PWA /
notifications) **reporté** : aucun service worker ni cache hors ligne.

## Conventions de composants

- Fichiers en `kebab-case.tsx`, composants en `PascalCase`, exports nommés (sauf fichiers
  spéciaux Next : `page`, `layout`, `error`, ...).
- Un composant = une responsabilité. Pas de gros composants multi-fonctionnalités.
- Styles uniquement via les **tokens** (`bg-primary`, `text-muted-foreground`,
  `bg-status-sober-soft`, ...). Aucune couleur codée en dur.
- Composants shadcn/ui : ajoutés à la demande avec `npx shadcn@latest add <composant>`.
  Leur code nous appartient ; les tailles de `Button` ont été agrandies pour le tactile
  (`default` 40 px, `lg` 48 px).
- Textes d'interface en français ; valeurs techniques (enums, colonnes) en anglais.
- Toute information d'état : **texte + icône + couleur** (voir `src/config/day-status.ts`).

## Design system

- Palette naturelle : crème / blanc cassé (fond), vert forêt doux (`primary`), vert sauge
  (`secondary`, `accent`), gris chaud (`muted`, `border`), charcoal (`foreground`).
  Rouge doux réservé à `destructive` et à l'état `consumed`.
- Tokens au format shadcn dans `src/app/globals.css` (`:root` + `.dark` préparé, non activé).
- Tokens d'état de journée : `status-{sober|challenging|consumed|untracked}` avec
  variantes `-soft` et `-foreground`.
- Rayon de base `0.875rem` (coins arrondis généreux).
- Typographie : **Figtree** (une seule famille) via `next/font/google`, auto-hébergée au build,
  sous-ensembles `latin` + `latin-ext`.
- `prefers-reduced-motion` respecté globalement.

## Stratégie de données

- PostgreSQL via Supabase, schéma versionné par migrations SQL (voir [DATABASE.md](./DATABASE.md)).
- RLS obligatoire sur toute table de données utilisateur.
- Journée locale (`date`) séparée des horodatages (`timestamptz` UTC).
- On **calcule** plutôt que stocker les valeurs dérivées (séries, statistiques, accomplissements).
- Chargements ciblés : pas de données détaillées d'une année entière quand un agrégat suffit.
  Exception assumée : la progression lit en une requête les colonnes statistiques de tous les
  check-ins terminés (quelques centaines de lignes, sans texte personnel) pour calculer période,
  période précédente et « Depuis le début » (ADR-053).

## Stratégie de validation

- **Zod** est la source unique des règles de validation, partagées client/serveur.
- Côté serveur : toute entrée (Server Action, Route Handler) est validée avant d'atteindre la base.
- En base : contraintes `CHECK`, `NOT NULL`, `UNIQUE` en dernière ligne de défense.
- Variables d'environnement : `src/lib/env.ts`, validation **paresseuse** (au premier usage)
  pour qu'un build de pages publiques ne dépende pas des clés Supabase, avec un message
  d'erreur explicite si une variable manque.

## Tests

- Vitest (`npm test`), fichiers `*.test.ts` colocalisés avec le code testé.
- Sprint 0 : validation des variables d'environnement.
- Sprint 1 : redirections sûres, accès proxy, schémas d'authentification, messages d'erreur, fuseaux.
- Sprint 2 : schémas et logique de l'onboarding (objectifs, date future, raison, motivations,
  contact, substance principale, finalisation), routage selon l'onboarding, dates locales.
- Sprint 3 : statut, scores (bornes), date future, journée locale (UTC ≠ local, minuit, heure
  d'été), longueurs de texte, consommations (événements, multi-substances, cohérence
  statut / événements), transitions de statut, étapes conditionnelles, reprise du brouillon.
- Sprint 4 : métriques (aucune donnée, taux, cumul après consommation), séries (jours manquants,
  consommation), semaine (lundi, passé, futur, non documenté), fuseau, moyennes (absences
  ignorées), tendances (seuils, maximum, formulations non causales).
- Sprint 5 : mois de 28 / 29 / 30 / 31 jours, début lundi / dimanche, bissextile, états (terminé,
  brouillon, absent, futur, avant parcours), liens, vue année, fuseau (mois, année, minuit),
  filtres, périodes, recherche, pagination, paramètre [date].
- Sprint 6 : périodes 7 / 30 / 90 jours / année / tout, période précédente sans chevauchement,
  fuseau (minuit, mois, année, DST), journées manquantes, séries de scores, comparaison en points,
  stabilité, fréquences, associations, jours de semaine, consommation multi-substance, seuils et
  formulations des observations.
- Sprint 7 : bornes 0–10 (−1 / 11 refusés), multi-substance, « Je ne sais pas », stratégie personnelle,
  durées, minuteur (démarrage, rafraîchissement, veille, expiration, pause / reprise, fin anticipée),
  journée locale 23:58 → 00:08, étape courante, réduction initial − final (baisse, égalité, hausse),
  analyse des stratégies (moyenne 2,33 → « 2,3 points », seuil de 3), formulations.
- Sprint 8 : schémas du plan (dates, motivations ≥ 1, « Autre », durées, contacts, lieux sans
  coordonnées, rappel, lettre), favoris et personne principale en premier, limite de favoris, panneau
  rapide, groupes « Tes stratégies » / « Autres stratégies ».
- Sprint 9 : jalons cumulatifs (65 → jusqu'à 60), séries (31 → 7 / 14 / 30), check-ins (103 → jusqu'à
  100), réflexions, journées avec déclencheur, interventions, stratégies distinctes, persistance
  (état actuel inférieur → toujours obtenu, jamais « 72 / 60 »), prochaines étapes diversifiées,
  fuseau des dates, notifications regroupées et synthèse du rattrapage.
- Sprint 11 : paramètres (fuseau, courriel, nom, mot de passe, « SUPPRIMER »), affectation de masse,
  charges trop longues, même origine, limite de fréquence, redirections ouvertes (formes encodées),
  en-têtes de sécurité, structure et contenu de l'export (aucun jeton ni identifiant).
- SQL : `supabase/tests/profiles_rls.sql`, `onboarding_rls.sql`, `checkins_rls.sql`,
  `journal_rls.sql`, `craving_rls.sql`, `plan_rls.sql`, `achievements_rls.sql` et `security_rls.sql`
  (RLS, triggers, RPC, suppression de compte ; voir DATABASE.md).
- Priorité future : séries, statistiques, dates locales/fuseaux, validation, RLS.
- Playwright (tests de parcours) sera ajouté quand les premiers parcours existeront.
