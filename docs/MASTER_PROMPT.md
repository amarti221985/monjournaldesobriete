# Prompt Maître — Webapp de journal de sobriété

> Cahier des charges maître du projet, conservé tel que fourni par le porteur du projet.
> Il fait autorité sur la vision, la philosophie produit, les conventions et la méthode de travail.
> Les décisions prises depuis (Sprint 0 et suivants) sont consignées dans [DECISIONS.md](./DECISIONS.md).

Tu agis comme mon Lead Developer, Software Architect, UX/UI Designer et Product Engineer senior.
Nous allons construire ensemble une application web complète de suivi de sobriété, développée progressivement par sprints.
Ce document constitue le cahier des charges maître du projet.
Tu dois conserver l'architecture, les conventions, la philosophie produit et les décisions techniques décrites ici pendant toute la durée du développement.
Ne tente PAS de construire toute l'application immédiatement.
Je te transmettrai les sprints individuellement.

À chaque sprint :

1. Analyse l'état actuel du projet.
2. Lis la documentation existante.
3. Examine le code avant de le modifier.
4. Respecte l'architecture déjà en place.
5. Implémente uniquement le périmètre demandé.
6. Réutilise les composants existants lorsque possible.
7. Ne casse aucune fonctionnalité existante.
8. Effectue les migrations nécessaires proprement.
9. Vérifie TypeScript, lint et build.
10. Teste les parcours importants concernés.
11. Mets à jour la documentation.
12. Fournis un résumé clair des changements.
13. Signale les problèmes ou décisions importantes au lieu d'improviser une solution risquée.

## 1. Vision du produit

Nous construisons une webapp moderne de journal de sobriété.

Nom temporaire : **Mon Journal de Sobriété**. Le nom pourra être modifié ultérieurement sans nécessiter une refonte technique.

La philosophie du produit est :

> Un jour à la fois. Comprendre ses habitudes. Reconnaître ses progrès. Construire sa sobriété.

L'application ne doit PAS être simplement un compteur de jours sobres. Elle doit permettre à l'utilisateur de :

- faire un check-in quotidien;
- enregistrer ses journées sobres;
- enregistrer honnêtement les journées avec consommation;
- suivre ses envies de consommer;
- identifier ses déclencheurs;
- suivre son humeur, son stress et son énergie;
- noter ses accomplissements;
- écrire ses réflexions;
- comprendre progressivement ses tendances;
- découvrir les stratégies qui l'aident;
- conserver un journal personnel;
- visualiser son année;
- reconnaître sa progression à long terme.

La philosophie fondamentale est : **Progression > perfection.**
Une consommation ne doit jamais donner l'impression que tout le travail précédent a été effacé.

## 2. Public cible

Application destinée aux adultes souhaitant :

- arrêter une substance;
- réduire leur consommation;
- mieux comprendre leur consommation;
- maintenir leur sobriété;
- documenter leur progression.

L'application doit pouvoir supporter plusieurs catégories, notamment : alcool; cannabis; nicotine; stimulants; opioïdes; autres substances définies par l'utilisateur.

Un utilisateur peut suivre plusieurs substances. L'architecture ne doit donc jamais supposer qu'un utilisateur ne suit qu'une seule substance.

## 3. Positionnement important

L'application est un outil de : journalisation; réflexion; suivi personnel; organisation; visualisation de données personnelles.

Elle ne doit jamais prétendre : diagnostiquer une dépendance; remplacer un médecin; remplacer un psychologue; remplacer un intervenant en dépendance; garantir une guérison; fournir une interprétation médicale automatisée.

Les tendances affichées doivent être formulées comme des observations provenant des données de l'utilisateur.

- Exemple acceptable : « Dans tes données enregistrées, tes envies ont tendance à être plus élevées les vendredis. »
- Éviter : « Tu consommes parce que tu es stressé. »

## 4. Stack technique

Utilise cette stack sauf instruction contraire explicite dans un sprint futur.

- **Frontend** : Next.js, App Router, TypeScript strict, React, Tailwind CSS, shadcn/ui
- **Backend** : Supabase
- **Base de données** : PostgreSQL via Supabase
- **Authentification** : Supabase Auth
- **Graphiques** : Recharts
- **Icônes** : Lucide React
- **Validation** : Zod
- **Formulaires** : React Hook Form lorsque pertinent
- **Déploiement** : GitHub, Hostinger
- **Application mobile** : l'application doit être responsive dès le départ. Elle sera éventuellement transformée en PWA installable. Ne développe pas d'application native iOS ou Android pour l'instant.

## 5. Principes d'architecture

Construis une architecture : modulaire; maintenable; scalable; fortement typée; facile à tester; facile à faire évoluer; sécuritaire.

Évite les fichiers gigantesques. Sépare correctement : UI; logique métier; accès aux données; validation; types; utilitaires; hooks; services.

Utilise des composants réutilisables. Évite la duplication. Ne hardcode pas des valeurs qui devraient être configurables.

## 6. Structure générale

Utilise une organisation cohérente similaire à :

```text
app/
components/
components/ui/
components/dashboard/
components/check-in/
components/calendar/
components/journal/
components/progress/
components/craving/
components/plan/
lib/
lib/supabase/
lib/validation/
lib/utils/
lib/services/
hooks/
types/
config/
supabase/
supabase/migrations/
public/
docs/
```

Adapte cette structure intelligemment lorsque nécessaire.

## 7. Authentification et autorisation

Chaque utilisateur possède son propre compte. Prévoir : inscription; connexion; déconnexion; réinitialisation du mot de passe; session persistante; routes protégées.

Aucun utilisateur ne doit pouvoir accéder aux données personnelles d'un autre utilisateur.
Toutes les tables contenant des données utilisateur doivent utiliser une stratégie appropriée de sécurité Supabase avec Row Level Security (RLS).
Ne jamais dépendre uniquement du frontend pour protéger les données.

## 8. Confidentialité

Les informations enregistrées peuvent être extrêmement sensibles. Applique le principe : **Privacy by design.**

Prévoir l'architecture permettant : suppression du compte; suppression des données; export des données; gestion sécurisée des sessions; RLS; HTTPS en production; secrets uniquement côté serveur lorsque nécessaire.

Ne jamais exposer : service role key; clés privées; secrets; informations confidentielles dans le repository.
Utiliser les variables d'environnement. Créer et maintenir un `.env.example` sans secrets.

## 9. Onboarding

Lors de sa première utilisation, l'utilisateur configure son parcours. Prévoir :

- **Substance(s)** : une ou plusieurs substances.
- **Objectif par substance** : arrêter complètement; réduire; observer.
- **Date de début** : date du parcours actuel.
- **Pourquoi** : texte personnel expliquant pourquoi l'utilisateur souhaite changer.
- **Motivations** : santé; relations; argent; confiance; carrière; famille; liberté; énergie; autre.
- **Soutien** : possibilité facultative d'ajouter des personnes de soutien.

## 10. Check-in quotidien

Le check-in constitue le cœur du produit. Il doit être rapide, agréable et responsive.
Objectif UX : environ 2 minutes pour un check-in standard.
Chaque journée possède au maximum un check-in principal par utilisateur, mais celui-ci peut être modifié.

Statuts principaux : `sober`; `sober_with_craving`; `consumed`. L'interface utilisateur doit afficher ces valeurs en français.

## 11. Données du check-in

Prévoir notamment : date; statut; humeur; énergie; stress; envie de consommer; émotions; déclencheurs; accomplissements; victoire du jour; fierté; apprentissage; intention pour demain; notes facultatives.

Les scores utilisent des échelles cohérentes, par exemple :

```text
mood_score: 1-10
energy_score: 1-10
stress_score: 1-10
craving_score: 0-10
```

Valider les valeurs côté client ET serveur lorsque pertinent.

## 12. Journée avec consommation

Si l'utilisateur sélectionne « J'ai consommé », le parcours doit rester neutre, respectueux et orienté vers la compréhension.

Permettre notamment d'enregistrer : substance; quantité facultative; unité facultative; moment approximatif; envie avant consommation; émotions; déclencheurs; contexte; réflexion; stratégie possible pour une situation similaire.

Une journée avec consommation ne supprime jamais l'historique.

## 13. Métriques de sobriété

Ne jamais réduire la progression à une seule série. Afficher plusieurs métriques : série actuelle; meilleure série; journées sobres cumulatives; journées suivies; journées avec consommation; pourcentage de journées sobres; progression mensuelle; évolution des envies; évolution de l'humeur; évolution du stress.

Les règles de calcul doivent être centralisées. Ne duplique pas la logique statistique dans plusieurs composants.

## 14. Calendrier

Créer éventuellement deux vues : mois; année.

Code visuel :

- VERT = sobre
- JAUNE = sobre malgré forte envie
- ROUGE = consommation
- NEUTRE = aucun check-in

Ne jamais dépendre uniquement de la couleur pour transmettre l'information. Prévoir également : icône; label; tooltip; texte accessible.
Cliquer sur une journée permet d'afficher son check-in.

## 15. Journal

L'utilisateur peut consulter son historique sous forme de timeline. Prévoir : navigation chronologique; filtres; recherche; accès à une journée; modification d'une entrée. Les entrées doivent être privées.

## 16. Mode « J'ai envie de consommer »

Créer ultérieurement un mode dédié aux envies fortes. Un bouton doit être facilement accessible dans l'application : « J'ai envie de consommer ».

Ce mode permet d'enregistrer : intensité initiale; émotion; déclencheur; contexte; stratégie sélectionnée; durée; intensité après intervention.

Stratégies possibles : marcher; boire/manger quelque chose; respirer; écouter de la musique; prendre une douche; contacter quelqu'un; changer d'environnement; relire ses motivations; stratégie personnalisée.

## 17. Timer d'intervention

Certaines stratégies peuvent utiliser un timer. Exemple : Marche — 10 minutes.
Après l'activité : « Comment est ton envie maintenant? »

Enregistrer : `craving_before`, `craving_after`, `strategy`, `duration`.

Cela permettra éventuellement de calculer les stratégies associées aux plus grandes diminutions d'envie dans les données personnelles de l'utilisateur. Ne jamais présenter cela comme une efficacité médicale prouvée.

## 18. Mon plan

Créer une section personnelle permettant de conserver : raisons d'être sobre; motivations; objectifs; déclencheurs connus; stratégies personnelles; personnes de soutien; endroits sécurisants; rappel personnel; lettre à soi-même.

Cette section pourra être utilisée dans le mode d'envie forte.

## 19. Accomplissements

Prévoir deux familles.

- **Continuité** : 1 jour, 3 jours, 7 jours, 14 jours, 30 jours, 60 jours, 90 jours, 6 mois, 1 an.
- **Progression cumulative** : 10 check-ins, 30 check-ins, 30 journées sobres cumulatives, 10 réflexions, 5 déclencheurs identifiés, 5 interventions complétées.

Les accomplissements doivent être calculés à partir de données réelles lorsque possible.
Éviter de stocker inutilement une donnée calculable, sauf raison technique justifiée.

## 20. Tendances

À partir des données historiques, l'application pourra produire des observations. Exemples :

- « Tes envies enregistrées sont généralement plus élevées le vendredi. »
- « Le stress apparaît fréquemment lors de tes journées avec une forte envie. »
- « Dans tes données, les journées avec activité physique sont associées à une envie moyenne plus faible. »

Ces observations doivent : être basées sur des données suffisantes; indiquer clairement qu'il s'agit de tendances; éviter les conclusions causales; éviter les diagnostics.

## 21. IA

Ne pas intégrer d'IA pendant les premiers sprints. Préparer cependant une architecture qui permettra éventuellement : résumé hebdomadaire; résumé mensuel; analyse du journal; identification de thèmes récurrents; réflexion guidée.

Toute future fonctionnalité IA devra respecter la confidentialité des données.
Ne jamais envoyer automatiquement tout le journal d'un utilisateur vers un fournisseur IA sans mécanisme explicite et documenté.

## 22. Dashboard

Le dashboard doit répondre immédiatement à :

1. Ai-je fait mon check-in aujourd'hui?
2. Où en suis-je?
3. Comment s'est passée ma semaine?
4. Quelle est ma progression?
5. Que puis-je faire si j'ai une envie forte?

Exemple :

```text
Bonjour 👋
Jour 14 de ton parcours
[ Faire mon check-in ]
Série actuelle      14 jours
Journées sobres     38
Meilleure série     24 jours
Ce mois-ci          92 %
```

Puis aperçu de la semaine.

## 23. Design

Direction artistique : moderne; calme; premium; humaine; minimaliste; rassurante; chaleureuse.

Éviter une apparence : médicale; hospitalière; infantile; excessivement gamifiée.

Privilégier : beaucoup d'espace; cartes; coins arrondis; typographie lisible; micro-interactions; transitions discrètes; excellente expérience mobile.

Le design doit transmettre : **calme + progression + contrôle + espoir.**

## 24. Accessibilité

Respecter les bonnes pratiques d'accessibilité. Prévoir notamment : navigation clavier; focus visible; labels de formulaires; contrastes suffisants; aria-label lorsque nécessaire; boutons suffisamment grands sur mobile; aucune information communiquée uniquement par couleur; HTML sémantique.

## 25. Responsive

Priorité : **mobile-first**. L'expérience doit être excellente sur 375px, 390px, 430px, puis tablet et desktop.
Ne jamais construire uniquement pour desktop puis tenter de réparer mobile après coup.

## 26. Base de données

La base doit être normalisée raisonnablement sans devenir inutilement complexe.

Entités envisagées : `profiles`, `substances`, `user_substances`, `daily_checkins`, `checkin_emotions`, `checkin_triggers`, `checkin_achievements`, `consumption_events`, `craving_events`, `craving_strategies`, `craving_interventions`, `personal_goals`, `personal_reasons`, `support_contacts`, `journal_entries`, `user_milestones`, `notification_preferences`.

Tu peux proposer des améliorations au schéma lorsqu'elles sont justifiées. Ne modifie cependant pas une architecture existante importante sans expliquer la raison.

## 27. Dates et fuseaux horaires

Point critique. Un check-in représente une journée locale de l'utilisateur, pas simplement une date UTC.

Conçois correctement : timezone utilisateur; date locale; timestamps UTC; changement de journée; statistiques par journée.

Évite les bugs où un check-in du soir apparaît le lendemain à cause de l'UTC.

## 28. Qualité du code

Exigences : TypeScript strict; pas de `any` sans justification; noms explicites; fonctions courtes; composants spécialisés; logique métier centralisée; gestion des erreurs; états loading; états empty; états error; validation; code lisible.

Ne masque pas les erreurs TypeScript avec des contournements. Corrige leur cause.

## 29. Tests

Au fur et à mesure des sprints, ajouter les tests pertinents.

Priorité aux fonctions critiques : calcul des séries; statistiques; dates; check-in; permissions; validation; logique de consommation; craving tracking.

Tester les cas limites, par exemple : aucune donnée; première journée; consommation après une série; check-in modifié; changement de mois; changement d'année; timezone; journées sans check-in.

## 30. Git

Utiliser Git proprement. Ne jamais : commit de `.env`; commit de secrets; supprimer arbitrairement l'historique; faire des changements massifs sans rapport avec le sprint.

Maintenir `.gitignore`. À la fin d'un sprint, suggérer un message de commit clair. Format recommandé :

```text
feat(checkin): implement daily sobriety check-in
fix(calendar): correct local date handling
refactor(stats): centralize sobriety calculations
```

## 31. Documentation

Créer un dossier `/docs`. Maintenir au minimum `PROJECT.md`, `ARCHITECTURE.md`, `DATABASE.md`, `DECISIONS.md` lorsque pertinent.

`DECISIONS.md` doit documenter les décisions architecturales importantes afin qu'un futur développeur ou une future session Claude Code puisse comprendre pourquoi elles ont été prises.

## 32. README

Maintenir un README contenant : description du projet; stack; installation; variables d'environnement; développement local; Supabase; build; déploiement.

## 33. Gestion des migrations

Toute modification du schéma Supabase doit passer par des migrations versionnées.
Ne pas dépendre uniquement de changements manuels dans le dashboard Supabase.
Les migrations doivent être reproductibles. Documenter les commandes nécessaires.

## 34. Données de démonstration

Lorsque nécessaire, créer des données de développement réalistes mais fictives.
Ne jamais utiliser de vraies informations personnelles ou médicales dans les seeds.

## 35. Performance

Éviter : requêtes inutiles; N+1 queries; chargement de l'année entière avec des données détaillées inutiles; composants qui rerendent constamment; JavaScript client inutile.

Utiliser les Server Components de Next.js lorsque cela apporte un avantage. Utiliser `"use client"` uniquement lorsque nécessaire.

## 36. Sécurité

Toujours considérer : authentification; autorisation; RLS; validation des entrées; XSS; injection; gestion des secrets; rate limiting lorsque nécessaire; accès aux API; suppression sécurisée.

Ne jamais faire confiance à un `user_id` envoyé par le client lorsque l'identité peut être obtenue depuis la session authentifiée.

## 37. Roadmap

| Sprint | Contenu |
| --- | --- |
| 0 | Fondations techniques |
| 1 | Authentification et profils |
| 2 | Onboarding |
| 3 | Check-in quotidien |
| 4 | Dashboard |
| 5 | Calendrier et journal |
| 6 | Progression et statistiques |
| 7 | Mode envie de consommer |
| 8 | Mon plan |
| 9 | Accomplissements |
| 10 | PWA et notifications |
| 11 | Sécurité, confidentialité, export et suppression |
| 12 | Fonctionnalités IA éventuelles |

Cette roadmap peut évoluer, mais ne développe pas prématurément des fonctionnalités de sprints futurs.

## 38. Règle fondamentale sur les sprints

Lorsque je fournis un sprint : implémente uniquement ce sprint et ses dépendances strictement nécessaires.
Ne construis pas automatiquement les fonctionnalités futures.
Cependant, évite les décisions qui rendraient manifestement les prochains sprints difficiles.

## 39. Avant chaque sprint

Avant de modifier le code :

1. inspecte le repository;
2. lis README;
3. lis `/docs`;
4. examine `package.json`;
5. examine la structure actuelle;
6. examine les migrations;
7. examine les types existants;
8. identifie les composants réutilisables;
9. vérifie l'état Git;
10. établis un plan d'implémentation.

Si le repository est nouveau, initialise uniquement ce qui est nécessaire au sprint.

## 40. Après chaque sprint

Effectue au minimum : TypeScript check; lint; build; tests disponibles. Corrige les erreurs provoquées par tes changements.

Ensuite, fournir un rapport final contenant : Sprint terminé; Fonctionnalités ajoutées; Fichiers importants créés/modifiés; Base de données (migrations ajoutées); Sécurité (mesures appliquées); Tests (résultats); Vérifications (TypeScript, Lint, Build, Tests); Configuration manuelle requise (liste précise, seulement si nécessaire); Points à surveiller; Prochain sprint; Commit suggéré.

## 41. Ne pas faire

Ne :

- reconstruis pas toute l'application sans demande;
- change pas de stack arbitrairement;
- ajoute pas des dizaines de dépendances inutiles;
- utilise pas `any` pour contourner TypeScript;
- désactive pas ESLint pour masquer des problèmes;
- stocke pas de secrets dans Git;
- contourne pas RLS;
- crée pas de fausses statistiques;
- crée pas de diagnostic médical;
- efface pas l'historique après une consommation;
- mélange pas toutes les fonctionnalités dans quelques gros composants;
- implémente pas l'IA prématurément;
- ajoute pas une fonctionnalité simplement parce qu'elle semble intéressante.

## 42. Philosophie UX

L'application doit éviter les formulations culpabilisantes.

- Éviter : « Tu as échoué. » ; « Tu as brisé ta sobriété. » ; « Retour à zéro. »
- Préférer : « Journée enregistrée. » ; « Merci d'avoir pris le temps de faire ton check-in. » ; « Regardons ce qui s'est passé. » ; « Ton historique reste une partie importante de ta progression. »

Le ton doit être : adulte; respectueux; encourageant; sobre; non infantilisant.

## 43. Principe de progression

La série actuelle est une métrique parmi plusieurs.
Une consommation peut remettre la série actuelle à zéro selon la définition choisie, mais elle ne remet jamais à zéro : journées sobres cumulatives; check-ins; apprentissages; accomplissements; journal; meilleure série; progression historique.

Le produit doit mettre davantage l'accent sur la trajectoire globale que sur la perfection.

## 44. Objectif à long terme

Nous voulons éventuellement obtenir une application où un utilisateur peut regarder son année et comprendre : combien de journées il a suivies; combien étaient sobres; comment ses envies ont évolué; quels déclencheurs reviennent; quelles stratégies semblent l'aider; comment son humeur évolue; quelles victoires il a accumulées; ce qu'il a appris sur lui-même.

L'application devient progressivement : **un journal personnel de reconstruction et de progression.**
