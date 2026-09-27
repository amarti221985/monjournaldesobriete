# Rapport PDF — Sprint 12

Version lisible et imprimable du parcours de l'utilisateur connecté. Décision : ADR-088.

## Approche

Page HTML protégée `/reports/personal` (groupe `(report)`, sans navigation), mise en forme pour
l'impression, puis **« Imprimer / Enregistrer en PDF »** du navigateur (`window.print()`).

- Aucun service tiers de génération PDF, aucun navigateur sans interface (Puppeteer) sur le
  serveur, aucun fichier stocké : le PDF est produit sur l'appareil de l'utilisateur.
- Formats Letter et A4 : marges `@page` (`src/app/globals.css`), fond blanc, barre d'outils
  masquée à l'impression (`print:hidden`).

## Parcours

1. `/settings` → « Mes données » → « Rapport PDF ».
2. Choix de la période : 30 derniers jours, 90 derniers jours (défaut), cette année, tout le parcours.
3. Sections facultatives (cases à cocher) : réflexions (cochée par défaut), consommations,
   moments d'envie, mon plan, bilans intelligents (proposé seulement si l'IA est activée).
4. « Créer mon rapport PDF » ouvre le rapport dans un nouvel onglet ; « Imprimer / Enregistrer en PDF ».

Seuls la période et des interrupteurs `0`/`1` transitent par l'URL (`reportHref`,
`parseReportOptions`) : aucune donnée personnelle. Une valeur inconnue revient au défaut.

## Contenu

- Couverture : titre, période, date de création.
- Résumé : début du parcours, substances et objectifs, journées suivies / sobres / avec
  consommation, meilleure série, interventions (fonctions pures de `src/features/progress/`).
- Progression : moyennes et répartition des états.
- Mon journal : check-ins terminés de la période (réflexions et consommations selon les options).
- Moments d'envie, Mon plan (raison, motivations, déclencheurs, stratégies, rappel), Bilans
  intelligents : seulement si l'option est cochée.
- Pied de page : document personnel, non médical.

**Jamais inclus** (aucune option ne les active) : la lettre à soi-même, les personnes de soutien
et leurs coordonnées, le courriel, les identifiants internes.

## Sécurité

- `requireUser()` + onboarding terminé (layout `(report)`), lecture sous RLS
  (`collectReportData`), sections sensibles lues seulement si l'option est cochée.
- En-têtes `Cache-Control: private, no-store, max-age=0` et `X-Robots-Tag: noindex, nofollow,
  noarchive` (`privateDocumentHeaders`, `next.config.ts`) ; `robots` noindex dans les métadonnées.
- Titre du document = nom de fichier proposé : `mon-parcours-AAAA-MM-JJ` (neutre, sans substance).
- Aucun journal du contenu.

## Tests

`src/features/reports/reports.test.ts` (options, URL, nom de fichier, en-têtes) et intégration
sur le serveur de production (comptes fictifs) : redirection sans session, en-têtes, défaut sans
lettre ni contacts, options, isolation A/B.
