# Configuration Supabase

Étapes manuelles à réaliser dans le **Dashboard Supabase** et en ligne de commande.
Le dépôt reste la source de vérité du schéma (migrations) ; le dashboard ne sert qu'à la
configuration Auth et à la vérification.

## 1. Projet

- Créer un projet (développement) — région **Canada (Central)**.
- Conserver le mot de passe de la base dans un gestionnaire de mots de passe (jamais dans le dépôt).
- Plus tard : un projet **distinct** pour la production.

## 2. Variables d'environnement

`.env.local` (voir `.env.example`) :

| Variable | Où la trouver |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → Data API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → clé publiable `sb_publishable_...` |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` en local, `https://<domaine>` en production |

## 3. Migrations

```bash
npx supabase login                               # ouvre le navigateur (une fois par poste)
npx supabase link --project-ref <project-ref>    # demande le mot de passe de la base
npx supabase db push                             # applique supabase/migrations/*
npm run db:types                                 # régénère src/types/database.ts
```

Puis vérifier la sécurité de `profiles` :

```bash
npx supabase db query --linked -f supabase/tests/profiles_rls.sql
npx supabase db query --linked -f supabase/tests/onboarding_rls.sql
```

Résultats attendus (affichés comme une erreur, c'est voulu) : `RLS_OK — profiles : 14 vérifications
réussies` et `RLS_OK — onboarding : 24 vérifications réussies`.

> Windows PowerShell : si `npx` est bloqué par la stratégie d'exécution des scripts,
> utiliser `npx.cmd` et `npm.cmd`.

## 4. Authentication → URL Configuration

| Réglage | Développement | Production |
| --- | --- | --- |
| **Site URL** | `http://localhost:3000` | `https://<domaine>` |
| **Redirect URLs** | `http://localhost:3000/auth/callback` | `https://<domaine>/auth/callback` |

Un seul projet peut autoriser les deux listes pendant la phase de développement.
L'application construit toujours l'URL de retour à partir de `NEXT_PUBLIC_SITE_URL`
(`/auth/callback?next=...`) : aucun domaine n'est codé en dur.

## 5. Authentication → Sign In / Providers → Email

- **Enable Email provider** : activé.
- **Confirm email** : activé en production. Peut être désactivé en développement :
  l'application gère les deux cas (session immédiate ou écran « Vérifie tes courriels »).
- **Minimum password length** : **8** (cohérent avec la validation de l'application).
- **Password requirements** : aucune exigence de caractères (choix documenté, ADR-016).
- **Secure password change** : recommandé.

## 6. Authentication → Emails (modèles) — recommandé

Les liens par défaut (`{{ .ConfirmationURL }}`) utilisent le flux PKCE : ils ne fonctionnent
que dans **le navigateur où la demande a été faite**. Pour qu'un lien ouvert sur un autre
appareil fonctionne aussi, remplacer le lien des modèles suivants.

Formulations **discrètes** : aucun objet ni contenu ne mentionne la sobriété, une dépendance
ou une substance (règle de confidentialité du projet).

**Confirm signup** — objet : `Confirme ton adresse courriel`

```html
<p>Bonjour,</p>
<p>Confirme ton adresse courriel pour activer ton compte :</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/onboarding">Confirmer mon adresse</a></p>
<p>Si tu n'es pas à l'origine de cette demande, ignore ce message.</p>
```

**Reset password** — objet : `Réinitialisation de ton mot de passe`

```html
<p>Bonjour,</p>
<p>Pour choisir un nouveau mot de passe, utilise ce lien :</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Choisir un nouveau mot de passe</a></p>
<p>Si tu n'es pas à l'origine de cette demande, ignore ce message.</p>
```

`{{ .SiteURL }}` correspond au réglage **Site URL** de l'étape 4.

## 7. Avant un lancement public

- **SMTP personnalisé** (Authentication → Emails → SMTP Settings) : le service d'envoi
  intégré de Supabase est très limité en volume et réservé aux essais. Un fournisseur
  transactionnel sera nécessaire (délivrabilité, nom d'expéditeur, contrôle).
- **Protection contre les abus** : activer la protection CAPTCHA de Supabase Auth
  (Authentication → Attack Protection) si des inscriptions abusives apparaissent.
  Le formulaire devra alors transmettre le jeton (`options.captchaToken`).
- **Rate limits** : vérifier Authentication → Rate Limits.
