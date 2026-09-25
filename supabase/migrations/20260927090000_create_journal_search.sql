-- =============================================================================
-- Sprint 5 — Journal : liste paginée, filtres et recherche privée
--
-- public.search_journal() : check-ins TERMINÉS de l'utilisateur courant, du plus
-- récent au plus ancien, filtrés par statut, période et texte, paginés par
-- journée (curseur p_before). SECURITY INVOKER : la RLS s'applique.
--
-- Recherche : ILIKE sur les 5 champs de réflexion, motif échappé (%, _ et \ sont
-- recherchés littéralement), terme borné à 100 caractères. Suffisant pour le volume
-- par utilisateur (quelques centaines de journées) ; aucun service externe.
--
-- Aucun index ajouté : l'index unique (user_id, checkin_date) couvre le filtre par
-- utilisateur, la période et l'ordre décroissant (parcours arrière du B-tree).
-- =============================================================================

create or replace function public.search_journal(
  p_status public.checkin_status default null,
  p_from date default null,
  p_before date default null,
  p_query text default null,
  p_limit integer default 21
)
returns setof public.daily_checkins
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      nullif(btrim(left(coalesce(p_query, ''), 100)), '') as query,
      least(greatest(coalesce(p_limit, 21), 1), 51) as page_size
  )
  select c.*
    from public.daily_checkins c, params p
   where c.user_id = (select auth.uid())
     and c.completed_at is not null
     and (p_status is null or c.status = p_status)
     and (p_from is null or c.checkin_date >= p_from)
     and (p_before is null or c.checkin_date < p_before)
     and (
       p.query is null
       or concat_ws(' ', c.victory_text, c.proud_of_text, c.lesson_text, c.tomorrow_intention_text, c.notes)
          ilike '%' || replace(replace(replace(p.query, '\', '\\'), '%', '\%'), '_', '\_') || '%'
     )
   order by c.checkin_date desc
   limit (select page_size from params);
$$;

comment on function public.search_journal(public.checkin_status, date, date, text, integer) is
  'Journal : check-ins terminés de l''utilisateur courant, filtrés et paginés (recherche privée).';

revoke execute on function public.search_journal(public.checkin_status, date, date, text, integer) from public, anon;
grant execute on function public.search_journal(public.checkin_status, date, date, text, integer) to authenticated;
