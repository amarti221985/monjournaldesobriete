# Supabase

Migrations SQL versionnées (`supabase/migrations/`), appliquées dans l'ordre de leur horodatage.

- Créer : `npx supabase migration new <description_snake_case>`
- Appliquer sur le projet lié : `npx supabase db push`
- Puis régénérer les types : `npm run db:types`

Règles : ne jamais modifier une migration déjà appliquée ; activer la RLS et créer les
politiques dans la même migration que la table. Voir [docs/DATABASE.md](../docs/DATABASE.md).

Vérification SQL de la sécurité : `supabase/tests/` (voir docs/DATABASE.md).
Configuration du projet Supabase : [docs/SUPABASE_SETUP.md](../docs/SUPABASE_SETUP.md).
