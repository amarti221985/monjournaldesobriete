# Bêta V1 — plan de test

## Objectif principal

**Les utilisateurs reviennent-ils naturellement enregistrer leur journée ?**

Bêta fermée : 5 à 10 personnes, 7 jours, gratuite, sans intervention technique de notre part.
URL : `https://darkblue-alligator-779650.hostingersite.com` (domaine et nom définitifs plus tard ;
ils ne bloquent pas la bêta).

## Avant d'inviter les testeurs (propriétaire)

1. Déployer la version du Sprint 13 (correctif du callback, CSP, avis bêta).
2. Supabase → Authentication → URL Configuration : **Site URL** =
   `https://darkblue-alligator-779650.hostingersite.com` ; **Redirect URLs** contient
   `https://darkblue-alligator-779650.hostingersite.com/auth/callback`.
3. Tester soi-même « Mot de passe oublié » avec sa propre adresse (courriel reçu, lien vers le
   domaine bêta, nouveau mot de passe accepté). Si le courriel n'arrive pas : configurer un SMTP
   personnalisé (Authentication → Emails → SMTP Settings).
4. Vérifier `/api/health` (`status: ok`, `ai.keyFormat: ok`, `feedbackNotifications.configured: true`)
   et la limite de dépenses Anthropic. Envoyer un avis de test : le courriel doit arriver.
5. Envoyer l'invitation avec : l'URL, « c'est une bêta », « outil de réflexion, pas un soin »,
   le lien « Donner mon avis » (menu du compte).

## Consignes aux testeurs

- Créer un compte, configurer son parcours, faire un check-in chaque jour pendant 7 jours.
- Essayer au moins une fois : le mode envie, Mon plan, la progression, un bilan (facultatif).
- Signaler tout problème avec « Donner mon avis ».
- Ne pas mettre d'informations qu'on souhaite garder privées dans un avis.

## Indicateurs à observer (manuellement, sans outil d'analytique)

Requêtes en lecture seule sur Supabase (agrégats, jamais le contenu des journaux) :

| Indicateur | Source |
| --- | --- |
| Inscriptions complétées | `auth.users` (créés pendant la bêta) |
| Onboarding complété | `profiles.onboarding_completed` |
| Premier check-in | premier `daily_checkins.completed_at` par compte |
| Retour J2, J3, J7 | check-ins terminés aux jours 2, 3 et 7 après l'inscription |
| Nombre de check-ins par personne | `daily_checkins` terminés |
| Utilisation du mode envie | `craving_events` |
| Utilisation de Mon plan | lignes créées après l'onboarding (stratégies, lieux, lettre, rappel) |
| Bilans générés | `ai_reflections` |
| Avis envoyés | `beta_feedback` (catégorie, section, message) |

## Questions après 7 jours

1. Qu'est-ce qui t'a donné envie de revenir dans l'application ?
2. Qu'est-ce qui t'a semblé inutile ?
3. Y a-t-il un moment où tu ne savais pas quoi faire ?
4. Quelle fonction t'a été la plus utile ?
5. Quelle fonction t'a été la moins utile ?
6. Le check-in était-il trop long, trop court ou correct ?
7. Le ton de l'application t'a-t-il semblé respectueux ?
8. As-tu trouvé les statistiques faciles à comprendre ?
9. Le bilan t'a-t-il appris quelque chose d'utile ?
10. Qu'est-ce qui te ferait continuer à l'utiliser ?

## Décisions attendues après la bêta

- « J'oublie de faire mon check-in » est-il fréquent ? → si oui, les notifications (Sprint 10,
  reporté) deviennent prioritaires.
- Saisie rétroactive d'une journée oubliée (ADR-095).
- Monétisation : uniquement après validation de l'usage.

## Sauvegardes et restauration

- **Supabase** : sauvegardes selon l'offre du projet (offre gratuite : pas de restauration à un
  instant précis ; vérifier dans Database → Backups). Aucune restauration n'est promise aux
  testeurs ; l'export JSON reste leur copie personnelle.
- **Hostinger** : héberge seulement l'application (aucune donnée utilisateur).
- **Suppression de compte** : définitive, aucune restauration (ADR-077).
