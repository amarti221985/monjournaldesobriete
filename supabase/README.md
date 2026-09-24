# Supabase

Migrations SQL versionnées (`supabase/migrations/`, créé par la CLI à la première migration), appliquées dans l'ordre de leur horodatage.

- Créer : `npx supabase migration new <description_snake_case>`
- Appliquer sur le projet lié : `npx supabase db push`
- Puis régénérer les types : `npx supabase gen types typescript --linked > src/types/database.ts`

Règles : ne jamais modifier une migration déjà appliquée ; activer la RLS et créer les
politiques dans la même migration que la table. Voir [docs/DATABASE.md](../docs/DATABASE.md).

Sprint 0 : aucune migration (aucune table métier).
