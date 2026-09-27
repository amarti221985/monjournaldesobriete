# Projet — Mon Journal de Sobriété

> Source de vérité complète : [MASTER_PROMPT.md](./MASTER_PROMPT.md) (cahier des charges maître).
> Ce document en est la synthèse opérationnelle. Décisions : [DECISIONS.md](./DECISIONS.md).

## Vision

Une webapp moderne de journal de sobriété. Pas un simple compteur de jours : un
**journal personnel de reconstruction et de progression**, qui aide l'utilisateur à
faire un check-in quotidien, comprendre ses envies et déclencheurs, suivre son humeur,
reconnaître ses accomplissements et visualiser sa trajectoire sur l'année.

> Un jour à la fois. Comprendre ses habitudes. Reconnaître ses progrès. Construire sa sobriété.

## Philosophie

- **Progression > perfection.** Une consommation n'efface jamais le travail accompli.
- La série actuelle est **une métrique parmi plusieurs** : journées sobres cumulatives,
  meilleure série, check-ins, apprentissages et journal ne sont jamais remis à zéro.
- **Outil de journalisation et de réflexion**, jamais un outil médical : aucun diagnostic,
  aucune interprétation causale. Les tendances sont des observations tirées des données
  de l'utilisateur (« Dans tes données… »).
- **Privacy by design** : données très sensibles, RLS systématique, aucun partage implicite.

## Public

Adultes qui souhaitent arrêter, réduire, comprendre ou maintenir leur rapport à une ou
plusieurs substances (alcool, cannabis, nicotine, stimulants, opioïdes, autres).
**Un utilisateur peut suivre plusieurs substances.**

## Fonctionnalités prévues

| Domaine | Résumé |
| --- | --- |
| Authentification | Compte personnel, session persistante, routes protégées |
| Onboarding | Substances, objectif par substance (arrêter / réduire / observer), date de début, pourquoi, motivations, soutien |
| Check-in quotidien | ~2 min ; humeur, énergie, stress, envie, émotions, déclencheurs, victoire, apprentissage, intention |
| Journée avec consommation | Parcours neutre et respectueux, orienté compréhension |
| Dashboard | Check-in du jour ? Où j'en suis ? Ma semaine ? Ma progression ? Que faire en cas d'envie forte ? |
| Calendrier & journal | Vues mois/année, timeline, filtres, recherche |
| Progression | Métriques multiples, évolution des envies, de l'humeur, du stress |
| Mode envie forte | Intensité avant/après, stratégie, timer d'intervention |
| Mon plan | Raisons, motivations, déclencheurs connus, stratégies, soutien, lettre à soi-même |
| Accomplissements | Continuité et progression cumulative, calculés depuis les données réelles |
| PWA & notifications | Installation mobile, rappels |
| Confidentialité | Export (dont PDF), suppression des données et du compte |
| IA | Bilans hebdomadaires opt-in, minimisés, validés ; aucun chatbot |

## Roadmap

| Sprint | Contenu | État |
| --- | --- | --- |
| 0 | Fondations techniques | ✅ Terminé |
| 1 | Authentification et profils | ✅ Terminé |
| 2 | Onboarding | ✅ Terminé |
| 3 | Check-in quotidien | ✅ Terminé |
| 4 | Dashboard | ✅ Terminé |
| 5 | Calendrier et journal | ✅ Terminé |
| 6 | Progression et statistiques | ✅ Terminé |
| 7 | Mode envie de consommer | ✅ Terminé |
| 8 | Mon plan | ✅ Terminé |
| 9 | Accomplissements | ✅ Terminé |
| 10 | PWA et notifications | ⏸ Reporté (après le Sprint 11) |
| 11 | Sécurité, confidentialité, export et suppression | ✅ Terminé |
| 12 | Bilans intelligents (IA opt-in), rapport PDF, correction des accomplissements | ✅ Terminé |

### Sprint 12 — réalisé

- **Rapport PDF** (demandé en cours de projet, livré au Sprint 12) : page imprimable protégée
  `/reports/personal`, période et sections au choix, PDF produit par le navigateur, sans service
  tiers ni stockage (`docs/PDF_EXPORT.md`).
- **Bilans intelligents** `/insights` : opt-in, minimisation, garde-fous, historique, limite de
  un bilan par 24 heures (`docs/AI.md`). Nécessite `ANTHROPIC_API_KEY` côté serveur.
- **Accomplissements** : plus aucune attribution pendant le rendu (ADR-089).
- Export JSON v2 (bilans IA inclus).

Le **Sprint 10** (PWA, notifications) reste **reporté** et n'est pas implémenté.

Règle : chaque sprint implémente **uniquement son périmètre**, sans développer
prématurément les fonctionnalités futures.

## Principes UX

- **Mobile-first** (375 / 390 / 430 px d'abord), puis tablette et desktop.
- Direction : calme, moderne, humaine, premium, chaleureuse. Ni médicale, ni infantile,
  ni excessivement gamifiée.
- Ton : tutoiement, adulte, respectueux, encourageant, sobre. Français neutre
  compréhensible au Québec comme ailleurs (« courriel »).
- Formulations non culpabilisantes : « Journée enregistrée. », « Regardons ce qui s'est
  passé. », jamais « Tu as échoué » ni « Retour à zéro ».
- Accessibilité : HTML sémantique, clavier, focus visible, contrastes, cibles tactiles
  suffisantes, **jamais d'information transmise uniquement par la couleur**.
