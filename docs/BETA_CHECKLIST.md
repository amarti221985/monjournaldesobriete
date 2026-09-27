# Bêta V1 — liste de vérification (Sprint 13)

Statuts : **PASS** (testé, conforme) · **FAIL** (testé, non conforme) · **BLOCKED** (test impossible
sans action externe) · **NOT TESTED** (non testé). Tests du 27 septembre 2026 sur le build de
production local (`next start`, Supabase distant réel) et sur l'URL Hostinger (lecture seule),
avec des comptes **fictifs** uniquement (tous supprimés ensuite).

Détails des anomalies : [BETA_ISSUES.md](./BETA_ISSUES.md). Plan de test bêta : [BETA_TEST_PLAN.md](./BETA_TEST_PLAN.md).

## Infrastructure

| Élément | Statut | Détail |
| --- | --- | --- |
| Build de production (`npm run build`) | PASS | 25 routes, aucune erreur |
| Démarrage (`next start`) | PASS | local :3100 |
| Hostinger : HTTPS, redirection http → https | PASS | 301 vers https |
| Hostinger : variables (Supabase, URL du site, clé IA) | PASS | `/api/health` : tout « ok », `keyFormat: ok` |
| Hostinger : routes protégées → `/login?next=…` | PASS | `/today`, `/settings`, `/reports/personal`, `/insights` |
| Hostinger : callback d'authentification | FAIL → corrigé (à déployer) | redirigeait vers `https://0.0.0.0:3000` (ISSUE-01) |
| Hostinger : en-têtes de sécurité | PASS avec réserve | CSP remplacée par le CDN → CSP ajoutée en balise meta (ISSUE-02) |
| Version de Node sur Hostinger | NOT TESTED | non visible depuis l'extérieur (vérifier dans hPanel ≥ 20.9) |

## Authentication

| Élément | Statut | Détail |
| --- | --- | --- |
| Inscription, validation des champs (erreurs associées aux champs) | PASS | `aria-invalid` + message |
| Courriel déjà utilisé | PASS (corrigé) | message générique sans impasse (ISSUE-05) |
| Mot de passe invalide / confirmation différente | PASS | |
| Confirmation du courriel | NOT TESTED | désactivée dans Supabase (session immédiate) — ISSUE-04 |
| Première connexion → onboarding | PASS | |
| Connexion : mauvais mot de passe, `?next=` | PASS | message générique, retour à la page demandée |
| Déconnexion | PASS | session effacée, routes protégées → login |
| Mot de passe oublié (courriel → callback → réinitialisation) | BLOCKED | aucune boîte courriel de test ; Supabase refuse example.com (ISSUE-03) |
| Changement de courriel | BLOCKED | même raison (ISSUE-03) |
| Lien invalide / expiré → `/login?error=link_invalid` | PASS | message clair |

## Onboarding

| Élément | Statut | Détail |
| --- | --- | --- |
| Plusieurs substances, objectifs différents, substance principale | PASS | |
| Date de début (max = aujourd'hui) | PASS | future refusée (champ + base) |
| Raison (caractères spéciaux, HTML échappé), motivations, contact facultatif | PASS | |
| Rechargement pendant l'onboarding | PASS | reprise à la bonne étape |
| Double clic sur « Commencer mon parcours » | PASS | aucun doublon (vérifié en base) |
| Finalisation → `/today` | PASS | |

## Check-in

| Élément | Statut | Détail |
| --- | --- | --- |
| Journée sobre complète (scores, émotions, déclencheurs, actions, textes) | PASS | au clavier |
| Sobre malgré une forte envie | PASS | libellé neutre, icône + couleur |
| Consommation : 2 substances, 2 événements, quantités non additionnées | PASS | |
| Changement consommation → sobre (événements supprimés) et inverse | PASS | statistiques recalculées |
| Brouillon : rechargement, sortie, reprise ; non compté | PASS | |
| Texte en cours conservé sans « Continuer » | FAIL → corrigé | sauvegarde automatique (ISSUE-06) |
| Double envoi | PASS | un seul check-in |
| Journées futures | PASS | page introuvable ; base refuse |

## Dashboard

| Élément | Statut | Détail |
| --- | --- | --- |
| Compte vide : explicatif, aucune statistique inventée | PASS | |
| Scénario exact (sobre, manquante, envie, consommation, brouillon) | PASS | 3 sobres / 4 suivies / 75 % / série 1 / meilleure 2 |
| Journée manquante : ni sobre, ni consommation, pas de rupture de série | PASS | ADR-042 |
| Jours avant le début du parcours comptés « non documentés » dans la semaine | FAIL (P2) | ISSUE-09 |

## Calendar

| Élément | Statut | Détail |
| --- | --- | --- |
| Mois, année, aujourd'hui, futur, avant le parcours | PASS | libellés accessibles par jour |
| États sobre / envie / consommation / non documenté | PASS | texte + icône + couleur |
| Année complète (365 jours) | PASS | 134 ms |

## Journal

| Élément | Statut | Détail |
| --- | --- | --- |
| Liste paginée (≤ 25 journées sur 332) | PASS | |
| Recherche : accents, apostrophes, `%`, aucun résultat | PASS | côté base |
| Détail, retour, modification historique | PASS | |
| Journée passée sans check-in : action proposée | FAIL → corrigé | état vide explicatif (ISSUE-07) |

## Progress

| Élément | Statut | Détail |
| --- | --- | --- |
| 7 j, 30 j, 90 j, année, tout | PASS | 200 en < 0,3 s avec 365 jours |
| Données insuffisantes / complètes, consommation, plusieurs substances | PASS | |
| Tendances descriptives (association ≠ cause) | PASS | |

## Craving

| Élément | Statut | Détail |
| --- | --- | --- |
| Bouton global, score 0–10, émotion, déclencheur, substance, stratégie | PASS | |
| Minuteur : rechargement, retour | PASS | calculé depuis les horodatages |
| Abandon puis reprise (« Continuer mon intervention ») | PASS | aucun faux succès |
| Score final inférieur / identique / supérieur | PASS | suite Sprint 7 (35/35) |
| Libellé de durée | FAIL → corrigé | « environ moins d'une minute » (ISSUE-08) |

## Plan

| Élément | Statut | Détail |
| --- | --- | --- |
| Toutes les sections (ajout, modification, suppression, texte vide / long / spécial) | PASS | suite Sprint 8 (34/34) |
| Lettre, contacts, lieux : jamais dans URL, journaux, IA, PDF par défaut | PASS | |

## Achievements

| Élément | Statut | Détail |
| --- | --- | --- |
| Nouveaux jalons, historique, bouton « Enregistrer mes jalons » | PASS | suite Sprint 9 (32/32) |
| Aucune mutation au rendu (GET /today, /achievements, préchargement) | PASS | |
| Consommation après un jalon : jalon conservé | PASS | |

## AI

| Élément | Statut | Détail |
| --- | --- | --- |
| Sans clé : indisponible, message simple, reste de l'app fonctionnel | PASS | message reformulé |
| Consentement, activation, < 3 check-ins, génération, historique, suppression, désactivation | PASS | faux fournisseur local (37/37) |
| Contenu réellement envoyé (aucun courriel, nom, UUID, contact, lettre, lieu, rappel, raison, note) | PASS | capturé et inspecté |
| Options réflexions / consommation / envie | PASS | le contenu envoyé change |
| Erreurs (délai, fournisseur, sortie invalide, refus, limite) | PASS | tests unitaires ; aucune erreur brute |
| Un bilan par 24 heures ; échec du fournisseur non compté | PASS | |
| Génération réelle en production (clé réelle) | PASS | constatée par le propriétaire |

## Export

| Élément | Statut | Détail |
| --- | --- | --- |
| JSON v2 valide, IA + avis bêta inclus, aucun secret, aucune donnée d'un autre compte | PASS | 365 jours : 252 Ko, 116 ms |
| Rapport PDF : 30 j / 90 j / année / tout, options | PASS | |
| Rapport : jamais la lettre ni les coordonnées des contacts | PASS | vérifié dans le PDF imprimé |
| Impression Chrome Letter + A4, Edge Letter | PASS | 17 pages, accents, textes longs, sauts de page |
| Sections superposées à l'impression | FAIL → corrigé | ISSUE-10 |
| Edge A4 (sans interface) | NOT TESTED | génération échouée dans l'outil de test |

## Privacy

| Élément | Statut | Détail |
| --- | --- | --- |
| Confidentialité, export, suppression faciles à trouver | PASS | Paramètres + page d'accueil |
| Avertissement (outil de réflexion, pas un soin, urgence 911) | PASS | pied de page public, Paramètres, rapport |
| Aucun outil d'analytique ni de relecture de session | PASS | |

## Account deletion

| Élément | Statut | Détail |
| --- | --- | --- |
| Parcours UI complet (SUPPRIMER + mot de passe) | PASS | focus dans la fenêtre, redirection, cookies effacés |
| Base : 0 ligne, aucun orphelin ; connexion impossible ; autre compte intact | PASS | |

## Mobile

| Élément | Statut | Détail |
| --- | --- | --- |
| 375 / 390 / 430 px : aucun débordement horizontal (toutes les pages) | PASS | |
| Navigation mobile, état actif | PASS | |
| Cibles tactiles ≥ 44 px (actions principales) | PASS avec réserve | boutons secondaires 36 px (ISSUE-12) |
| Nom de l'app tronqué par le badge Bêta | FAIL → corrigé | badge masqué dans l'en-tête mobile |

## Accessibility

| Élément | Statut | Détail |
| --- | --- | --- |
| `lang="fr"`, un `h1`, titres sans saut, repères | PASS | |
| Boutons nommés, champs étiquetés | PASS | 0 anomalie sur les pages auditées |
| Parcours clavier (check-in, envie, avis) | PASS | |
| Fenêtres : focus dedans | PASS | |
| Erreurs visibles, associées, pas seulement en couleur | PASS | |

## Performance

| Élément | Statut | Détail |
| --- | --- | --- |
| 365 check-ins : toutes les pages < 0,3 s (rapport complet 0,26 s) | PASS | |
| Journal paginé, calendrier annuel | PASS | |
| Index | PASS | aucun ajout justifié (voir BETA_ISSUES) |

## Security

| Élément | Statut | Détail |
| --- | --- | --- |
| Suites SQL (10 fichiers, 198 vérifications) | PASS | |
| Isolation A/B (lecture, modification, suppression, export, PDF, IA, détails) | PASS | |
| En-têtes (build local) | PASS | |
| Aucun secret dans git / docs ; clé IA serveur seulement | PASS | |

## Feedback

| Élément | Statut | Détail |
| --- | --- | --- |
| « Donner mon avis » (menu, barre latérale, Paramètres) | PASS | formulaire interne, table `beta_feedback` sous RLS |
| Aucune capture ni copie automatique du journal | PASS | |
