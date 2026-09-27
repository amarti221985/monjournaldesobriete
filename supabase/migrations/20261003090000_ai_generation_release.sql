-- =============================================================================
-- Sprint 12 (correctif) — Un essai de bilan qui échoue côté fournisseur ou configuration
-- (clé refusée, crédits, service indisponible) n'est plus compté dans la limite de 3 / jour.
--
-- Sécurité : la libération exige un jeton secret créé à la réservation et connu seulement
-- du serveur (retourné à la Server Action, jamais au navigateur). La table des réservations
-- n'est accessible à AUCUN rôle client (RLS activée, aucune policy, aucun droit) : un
-- utilisateur qui appelle lui-même les RPC ne peut pas libérer une réservation du serveur.
-- =============================================================================

create table public.ai_generation_reservations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token uuid not null,
  reserved_on date not null,
  reserved_at timestamptz not null default now()
);

alter table public.ai_generation_reservations enable row level security;
revoke all on table public.ai_generation_reservations from anon, authenticated;

-- La réservation renvoie désormais aussi le jeton de libération.
drop function public.reserve_ai_generation();

create function public.reserve_ai_generation()
returns table (remaining integer, reservation uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_prefs public.ai_preferences%rowtype;
  v_today date := (now() at time zone 'UTC')::date;
  v_count integer;
  v_token uuid := gen_random_uuid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_prefs from public.ai_preferences p where p.user_id = v_user_id for update;
  if not found or not v_prefs.ai_enabled then
    raise exception 'ai_consent_required' using errcode = '42501';
  end if;
  v_count := case when v_prefs.generations_date = v_today then v_prefs.generations_count else 0 end;
  if v_count >= 3 then
    raise exception 'ai_rate_limited' using errcode = 'P0001';
  end if;
  update public.ai_preferences
     set generations_date = v_today, generations_count = v_count + 1
   where user_id = v_user_id;
  insert into public.ai_generation_reservations (user_id, token, reserved_on, reserved_at)
  values (v_user_id, v_token, v_today, now())
  on conflict (user_id) do update set token = excluded.token, reserved_on = excluded.reserved_on, reserved_at = excluded.reserved_at;
  return query select 3 - (v_count + 1), v_token;
end;
$$;

/**
 * Libère la DERNIÈRE réservation de l'utilisateur courant si le jeton correspond et que
 * la réservation date du même jour (UTC) : le compteur est décrémenté une seule fois.
 */
create function public.release_ai_generation(p_reservation uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'UTC')::date;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  delete from public.ai_generation_reservations r
   where r.user_id = v_user_id and r.token = p_reservation and r.reserved_on = v_today;
  if not found then
    return false;
  end if;
  update public.ai_preferences
     set generations_count = greatest(generations_count - 1, 0)
   where user_id = v_user_id and generations_date = v_today;
  return true;
end;
$$;

revoke execute on function public.reserve_ai_generation() from public, anon;
revoke execute on function public.release_ai_generation(uuid) from public, anon;
grant execute on function public.reserve_ai_generation() to authenticated;
grant execute on function public.release_ai_generation(uuid) to authenticated;
