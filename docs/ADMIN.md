# Administration — tableau de bord produit (Admin V1)

Espace `/admin` réservé au propriétaire : croissance, activation, activité, rétention, utilisation
des fonctionnalités et avis bêta. **Agrégats d'abord, aucun contenu privé** : l'administration ne
lit jamais le journal (réflexions, notes, contexte de consommation ou d'envie, lettre, raison, lieux
sûrs, contacts, bilans IA, prompts ou jeux de données IA).

## Architecture

| Élément | Emplacement |
| --- | --- |
| Pages (layout, vue d'ensemble, analytics, rétention, utilisateurs, fiche, avis) | `src/app/(admin)/admin/` |
| Définitions pures (périodes, pourcentages, statuts, entonnoir, pseudonymes) + tests | `src/features/admin/analytics/definitions.ts` |
| Composants (navigation, KPI, graphique, entonnoir, rétention, contrôles) | `src/features/admin/components/` |
| Server Actions (statut d'un avis, affichage du courriel) | `src/features/admin/actions.ts` |
| Appels RPC typés | `src/lib/services/admin.ts` |
| Rôle | `src/lib/auth/admin.ts` (`getIsAdmin`, `requireAdmin`) |
| Événements produit | `src/lib/services/product-events.ts` (`recordProductEvent`) |
| Migration | `supabase/migrations/20261006090000_admin_dashboard.sql` |
| Test SQL | `supabase/tests/admin_rls.sql` |

Défense en profondeur (chaque couche suffit à elle seule à refuser l'accès) :

1. **Proxy** (`src/proxy.ts`) : une personne connectée non admin qui demande `/admin/*` reçoit une
   vraie redirection 307 vers `/today` (le `loading.tsx` racine rendrait sinon la redirection du
   serveur côté client, avec un statut 200).
2. **Layout et chaque page** : `requireAdmin()` (session + RPC `is_admin`).
3. **Server Actions** : session + `getIsAdmin()` + validation zod.
4. **Base** : chaque RPC admin vérifie le rôle en premier (`admin_private.assert_admin()`, erreur
   `admin_required`, code 42501). Sans rôle, aucune donnée ne sort, même par appel direct à l'API.

En-têtes : `/admin` et `/admin/:path*` en `Cache-Control: no-store` + `X-Robots-Tag: noindex`
(`next.config.ts`), métadonnées `robots: noindex`. Lien « Administration » dans le menu du compte
seulement pour un admin.

## Rôles

Table `public.admin_users (user_id, role 'owner' | 'admin', created_at)` : RLS activée, **aucun
droit client** (ni lecture, ni écriture) ; seul `public.is_admin()` (SECURITY DEFINER, sans
paramètre) répond pour la session courante. Impossible de s'auto-promouvoir. Suppression du compte
→ rôle supprimé (cascade). Aucune interface de gestion des admins en V1.

### Créer le propriétaire (une seule fois, SQL Editor de Supabase)

```sql
insert into public.admin_users (user_id, role)
select id, 'owner' from auth.users where email = '<ton courriel>';
```

Le courriel n'est jamais écrit dans Git ni dans une migration.

### Exclure un compte de test des statistiques

```sql
insert into public.analytics_excluded_users (user_id, reason)
select id, 'Compte de test' from auth.users where email = '<courriel du compte de test>';
```

Les comptes admin sont **toujours** exclus (`admin_private.product_users()`). Leurs avis restent
visibles dans `/admin/feedback`, marqués « Compte admin ou de test ».

## Définitions

| Indicateur | Définition |
| --- | --- |
| Utilisateur | compte `auth.users` hors admins et exclusions |
| Nouvel utilisateur | inscrit dans la période (ou depuis ≤ 7 jours pour le statut « Nouveau ») |
| Onboarding complété | `profiles.onboarding_completed` |
| Premier check-in | premier check-in **terminé** (`completed_at`) |
| Activité significative | check-in terminé ; modification d'un check-in plus d'une minute après sa fin ; moment d'envie terminé ; événement produit (`plan_updated`, `pdf_report_launched`) ; bilan IA enregistré ; avis bêta. **Jamais** une page vue ni une connexion |
| Utilisateur actif | au moins une activité significative dans l'intervalle |
| Statut d'activité | Actif (≤ 7 jours) · Moins actif (8–14 jours) · Inactif (> 14 jours ou jamais) |
| Statut d'activation | Inscrit · Onboardé · Activé (premier check-in) |
| Petit échantillon | population < 20 : avertissement « interpréter avec prudence » |

Périodes : 7, 30, 90 jours, année en cours, tout (UTC). Comparaison avec la période précédente de
même durée (« Nouveau » si la précédente vaut 0, rien pour « année » et « tout »). Pourcentage
affiché « — » quand le dénominateur vaut 0. Granularité : jour jusqu'à 90 jours, semaine au-delà.

### Entonnoir d'activation

Personnes inscrites dans la période → onboarding complété → premier check-in → retour (activité un
jour UTC après celui du premier check-in) → actives au jour 7 (parmi les personnes revenues qui ont
au moins 7 jours d'ancienneté). Conversion calculée depuis l'étape précédente.

### Rétention

Jn = activité significative un jour calendaire UTC ≥ n après le jour d'inscription
(n ∈ 1, 3, 7, 14, 30). Dénominateur : membres de la cohorte ayant au moins n jours d'ancienneté ;
« — » (« Pas encore disponible ») tant qu'aucun n'y est arrivé. Cohortes : semaines UTC commençant
le lundi.

## Pages

- **Vue d'ensemble** : KPI, Beta Pulse (7 derniers jours), inscriptions et actifs (graphique +
  tableau « Voir les valeurs »), entonnoir, utilisation des fonctionnalités, 5 derniers avis.
- **Analytics** : croissance, activation, engagement (activité significative) et adoption des
  fonctionnalités, avec comparaison à la période précédente.
- **Rétention** : rétention globale et tableau des cohortes, définitions affichées.
- **Utilisateurs** : liste paginée (25), filtres (tous, nouveaux, activés, actifs, inactifs, onboarding
  incomplet), tris ; pseudonyme `Utilisateur #XXXXXXXX` (8 premiers caractères hexadécimaux du
  md5 de l'identifiant), jamais courriel ni nom. Fiche : dates et compteurs de compte seulement.
  Bouton « Afficher les informations de compte » (support) : révèle le courriel **à la demande** et
  journalise l'action (`admin_audit_log`).
- **Avis** : filtres par type et statut, statut Nouveau / Lu / Traité (journalisé).

## RPC (toutes SECURITY DEFINER, `search_path=''`, révoquées de `anon`, rôle vérifié en premier)

| Fonction | Rôle |
| --- | --- |
| `is_admin()` | rôle de la session courante (booléen) |
| `admin_overview(p_from, p_to)` | compteurs de la période, cumul, fenêtres 7 / 30 jours |
| `admin_timeseries(p_from, p_to, p_bucket)` | séries par jour ou semaine |
| `admin_funnel(p_from, p_to)` | entonnoir d'activation |
| `admin_retention()` | cohortes hebdomadaires, éligibles et retenus par Jn |
| `admin_feature_adoption(p_from, p_to)` | personnes distinctes par fonctionnalité |
| `admin_users_page(filtre, tri, limite, décalage, seuils)` | liste pseudonymisée paginée |
| `admin_user_detail(p_code)` | fiche (dates, compteurs) |
| `admin_reveal_account_email(p_code)` | courriel pour le support, **journalisé** |
| `admin_feedback_page(catégorie, statut, limite, décalage)` | avis paginés |
| `admin_set_feedback_status(p_id, p_status)` | statut d'un avis, **journalisé** |
| `record_product_event(p_event)` | événement produit de la session courante (liste fermée) |

Les fonctions internes vivent dans le schéma `admin_private` (non exposé par l'API, exécution
révoquée pour tous les rôles clients).

## Événements produit

`product_events (user_id, event_name, occurred_at, occurred_on)` : **liste fermée**
(`plan_updated`, `pdf_report_launched`), **aucune métadonnée**, au plus un événement par personne,
type et jour UTC. Insertion uniquement par `record_product_event` (appelée par le serveur après une
action réussie ; un échec n'interrompt jamais l'action). La personne peut lire ses propres
événements ; ils figurent dans l'export et sont supprimés avec le compte.

## Confidentialité

- Aucun outil d'analytique tiers, aucun pixel, aucune relecture de session : tout est calculé à la
  demande dans Supabase à partir des tables existantes (aucune table d'agrégats).
- Aucun entrepôt caché : un compte supprimé disparaît des statistiques (cascades).
- Le message d'un avis bêta est visible : il a été écrit volontairement pour l'équipe.
- Aucune métrique de paiement, aucune gestion des comptes, aucune usurpation d'identité, aucune
  suppression ni modification de données par l'administration.

## Performance

Mesurée par `admin_rls.sql` sur 1 000 comptes et 10 000 check-ins fictifs : chaque RPC < 50 ms.
Index ajoutés : `product_events_occurred_idx`, `beta_feedback_created_idx`.

## Vérifier

```bash
npx supabase db query --linked -f supabase/tests/admin_rls.sql
```

Résultat attendu : `RLS_OK — admin : 30 vérifications réussies (…)`.

## Limitations

- Jours calendaires en **UTC** (pas le fuseau de chaque personne) pour la rétention et les séries.
- Statistiques recalculées à chaque affichage (adapté à la bêta ; à réévaluer au-delà de quelques
  dizaines de milliers de comptes).
- Pas d'interface de gestion des admins ni des exclusions (SQL Editor).
- Le journal d'audit n'a pas d'écran de consultation en V1 (lecture par le SQL Editor).
