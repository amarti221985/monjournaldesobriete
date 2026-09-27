# Bêta V1 — anomalies (Sprint 13)

Priorités : **P0** bloquant (perte / fuite de données, connexion ou check-in impossible,
suppression incorrecte) · **P1** important (parcours cassé, calcul faux, mobile inutilisable, export
cassé) · **P2** mineur (formulation, espacement, petit problème d'UX).

## Corrigées pendant le Sprint 13

| # | Priorité | Anomalie | Correction |
| --- | --- | --- | --- |
| ISSUE-01 | **P0** | En production, `/auth/callback` redirigeait vers `https://0.0.0.0:3000/...` (adresse interne du serveur) : réinitialisation du mot de passe et changement de courriel inutilisables | Redirections construites depuis `NEXT_PUBLIC_SITE_URL` (`resolveRedirectOrigin`, testée). Déployé et vérifié en production. |
| ISSUE-02 | P1 | Le CDN de Hostinger remplace l'en-tête `Content-Security-Policy` par `upgrade-insecure-requests` | Même politique ajoutée en balise `<meta http-equiv>` (appliquée en plus par le navigateur) ; `frame-ancestors` couvert par `X-Frame-Options: DENY` |
| ISSUE-05 | P2 | Courriel déjà utilisé : « Réessaie dans quelques instants » (impasse) | Message générique qui oriente vers la connexion / « Mot de passe oublié » |
| ISSUE-06 | P1 | Check-in : un texte tapé sur l'étape en cours était perdu en cas de rechargement ou de fermeture (sauvegarde seulement sur « Continuer ») | Sauvegarde automatique du brouillon 1,5 s après la dernière saisie |
| ISSUE-07 | P2 | Journée passée sans check-in : aucune action proposée | État vide explicatif (journée non documentée) + lien vers le check-in du jour |
| ISSUE-08 | P2 | « Durée : environ moins d'une minute » (envie, historique, rapport) | `formatMeasuredDuration` |
| ISSUE-10 | P1 | Rapport PDF : sections superposées à l'impression (grilles fragmentées par Chrome) | Mise en page d'impression en blocs simples |
| ISSUE-11 | P2 | Fenêtre de suppression : bilans IA et avis bêta absents de la liste des données effacées | Liste complétée |
| — | P2 | Bilans indisponibles : message technique (« sur ce serveur ») | Message simple |
| — | P2 | Badge « Bêta » tronquant le nom sur mobile | Masqué dans l'en-tête mobile |

## Restantes

| # | Priorité | Anomalie | Action |
| --- | --- | --- | --- |
| ISSUE-03 | Résolu | Flux par courriel (mot de passe oublié, changement de courriel) non testables de bout en bout : aucune boîte de test, Supabase refuse les adresses example.com. Le service d'envoi intégré de Supabase est très limité (volume, destinataires) | Propriétaire : vérifier **Site URL** et **Redirect URLs** (`https://darkblue-alligator-779650.hostingersite.com` et `/auth/callback`), configurer un **SMTP personnalisé** si nécessaire, puis faire un vrai « Mot de passe oublié » avec sa propre adresse **après déploiement** du correctif ISSUE-01 — **fait : configuration vérifiée et réinitialisation validée en production** |
| ISSUE-04 | P2 (décision) | La confirmation du courriel est désactivée dans Supabase : une faute de frappe dans l'adresse rend la récupération du compte impossible | Décision du propriétaire ; si activée, les courriels dépendent aussi d'ISSUE-03 |
| ISSUE-09 | P2 | Tableau de bord : les jours précédant le début du parcours sont comptés « non documentés » dans la semaine d'un nouveau compte (le calendrier affiche bien « Avant ton parcours ») | Harmoniser avec le calendrier après la bêta |
| ISSUE-12 | P2 | Boutons secondaires de 36 px de haut (sélecteurs de période, liens « Voir… ») sous les 44 px recommandés ; actions principales à 44–48 px | Polissage après retours |
| ISSUE-13 | P2 | Pas de saisie rétroactive d'une journée oubliée (ADR-051, confirmé ADR-095) | Observer pendant la bêta (« j'oublie mon check-in ») |
| ISSUE-14 | P2 | Onboarding : le texte de l'étape en cours n'est pas sauvegardé automatiquement (seulement sur « Continuer ») | Parcours court ; à revoir si signalé |
| ISSUE-15 | P2 | `notFound()` sous streaming : statut HTTP 200 et titre d'onglet de la page (le contenu affiché est bien « Page introuvable », `noindex`) | Limite connue de Next.js avec `loading.tsx` racine |
| ISSUE-16 | NOT TESTED | Impression Edge au format A4 (échec de l'outil d'impression sans interface) ; Chrome A4 et Edge Letter conformes | Vérification manuelle facultative |

## Index de base de données

Requêtes principales inspectées : check-ins par `(user_id, checkin_date)` (index unique), moments
d'envie par `(user_id, local_date)`, accomplissements par `(user_id, …)`, bilans
`ai_reflections_user_period_idx`, avis `beta_feedback_user_created_idx`. Avec 365 journées, toutes
les pages répondent en moins de 0,3 s : **aucun index supplémentaire n'est justifié**.
