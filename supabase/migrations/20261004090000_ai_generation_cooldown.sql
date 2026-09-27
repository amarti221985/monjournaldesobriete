-- =============================================================================
-- Sprint 12 (ajustement) — Un bilan par période glissante de 24 heures (au lieu de 3 par
-- journée UTC). La fenêtre part de l'heure de la dernière génération réservée ; un essai
-- rendu (échec côté fournisseur ou configuration) restaure la valeur précédente.
-- =============================================================================

alter table public.ai_preferences add column last_generation_at timestamptz;

-- Reprise : dernière génération connue = dernier bilan enregistré.
update public.ai_preferences p
   set last_generation_at = r.last_at
  from (select user_id, max(generated_at) as last_at from public.ai_reflections group by user_id) r
 where r.user_id = p.user_id;

-- L'ancien compteur quotidien n'est plus utilisé.
alter table public.ai_preferences drop constraint ai_preferences_generations_range;
alter table public.ai_preferences drop column generations_date;
alter table public.ai_preferences drop column generations_count;

-- Valeur à restaurer si l'essai est rendu.
alter table public.ai_generation_reservations add column previous_generation_at timestamptz;
alter table public.ai_generation_reservations drop column reserved_on;

/**
 * Réserve LA génération de la fenêtre de 24 heures (consentement actif). Retourne le nombre
 * restant (toujours 0) et le jeton secret de libération.
 */
create or replace function public.reserve_ai_generation()
returns table (remaining integer, reservation uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_prefs public.ai_preferences%rowtype;
  v_token uuid := gen_random_uuid();
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_prefs from public.ai_preferences p where p.user_id = v_user_id for update;
  if not found or not v_prefs.ai_enabled then
    raise exception 'ai_consent_required' using errcode = '42501';
  end if;
  if v_prefs.last_generation_at is not null and v_prefs.last_generation_at > v_now - interval '24 hours' then
    raise exception 'ai_rate_limited' using errcode = 'P0001';
  end if;
  update public.ai_preferences set last_generation_at = v_now where user_id = v_user_id;
  insert into public.ai_generation_reservations (user_id, token, reserved_at, previous_generation_at)
  values (v_user_id, v_token, v_now, v_prefs.last_generation_at)
  on conflict (user_id) do update set
    token = excluded.token,
    reserved_at = excluded.reserved_at,
    previous_generation_at = excluded.previous_generation_at;
  return query select 0, v_token;
end;
$$;

/**
 * Rend la DERNIÈRE réservation de l'utilisateur courant si le jeton correspond (une seule
 * fois) : la date de dernière génération reprend sa valeur précédente.
 */
create or replace function public.release_ai_generation(p_reservation uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reservation public.ai_generation_reservations%rowtype;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  delete from public.ai_generation_reservations r
   where r.user_id = v_user_id and r.token = p_reservation and r.reserved_at > now() - interval '24 hours'
  returning * into v_reservation;
  if not found then
    return false;
  end if;
  update public.ai_preferences
     set last_generation_at = v_reservation.previous_generation_at
   where user_id = v_user_id and last_generation_at = v_reservation.reserved_at;
  return true;
end;
$$;

-- Droits inchangés (colonnes des préférences seulement ; last_generation_at jamais modifiable
-- par le client : non listée dans les droits INSERT / UPDATE).
