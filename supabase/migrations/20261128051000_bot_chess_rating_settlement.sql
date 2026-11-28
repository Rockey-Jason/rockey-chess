-- Settle bot-game ratings through a narrowly scoped server-side RPC.
-- The existing users guard trigger intentionally prevents browser clients from
-- modifying protected fields such as chess_rating.

alter table public.chess_games
  add column if not exists rating_before bigint,
  add column if not exists rating_change bigint,
  add column if not exists rating_after bigint,
  add column if not exists rating_applied_at timestamptz;

create or replace function public.apply_bot_chess_rating(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_game public.chess_games%rowtype;
  v_old_rating bigint;
  v_next_rating bigint;
  v_change bigint;
  v_bot_rating bigint;
  v_diff numeric;
  v_gain integer;
  v_loss integer;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if p_game_id is null then
    raise exception '경기 기록 ID가 필요합니다.' using errcode = '22023';
  end if;

  -- Lock the caller's own bot-game row. The row itself is the idempotency key.
  select g.*
    into v_game
    from public.chess_games as g
   where g.id = p_game_id
     and g.user_id = v_user_id
     and g.mode = 'bot'
   for update;

  if not found then
    raise exception '본인 소유의 봇 대국 기록을 찾을 수 없습니다.' using errcode = '42501';
  end if;

  if v_game.result not in ('1-0', '0-1', '1/2-1/2') then
    raise exception '완료된 대국 결과가 아닙니다.' using errcode = '22023';
  end if;

  if v_game.bot_id not in ('talc', 'sleep', 'fur', 'rockey', 'army', 'doronum', 'brilliant') then
    raise exception '지원하지 않는 봇 대국입니다.' using errcode = '22023';
  end if;

  -- Repeated calls return the original settlement without applying it twice.
  if v_game.rating_applied_at is not null then
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'already_applied', true,
      'rating', v_game.rating_after,
      'rating_before', v_game.rating_before,
      'rating_change', coalesce(v_game.rating_change, 0),
      'result', v_game.result,
      'bot_id', v_game.bot_id
    );
  end if;

  select coalesce(u.chess_rating, 0)
    into v_old_rating
    from public.users as u
   where u.user_id = v_user_id::text
   for update;

  if not found then
    raise exception '로그인한 사용자의 돌이사이트 프로필을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  v_bot_rating := case v_game.bot_id
    when 'talc' then 1
    when 'sleep' then 100
    when 'fur' then 500
    when 'rockey' then 1000
    when 'army' then 3000
    when 'doronum' then 5000
    when 'brilliant' then 10000
  end;

  v_diff := v_bot_rating::numeric - v_old_rating::numeric;
  v_gain := greatest(0, least(170, 50 + trunc(v_diff / 25.0)))::integer;
  v_loss := greatest(0, least(170, 50 - trunc(v_diff / 25.0)))::integer;

  if v_game.result = '1-0' then
    v_change := greatest(1, v_gain);
  elsif v_game.result = '1/2-1/2' then
    v_change := -greatest(1, floor(v_loss / 4.0))::bigint;
  else
    v_change := -greatest(10, round(v_loss * 1.3))::bigint;
  end if;

  v_next_rating := greatest(0, v_old_rating + v_change);
  -- Report the real applied delta when the rating floor prevents a further decrease.
  v_change := v_next_rating - v_old_rating;

  -- This protected-field update runs as the function owner (postgres), so the
  -- public guard trigger stays enabled for every browser-originated UPDATE.
  update public.users
     set chess_rating = v_next_rating
   where user_id = v_user_id::text;

  update public.chess_games
     set rating_before = v_old_rating,
         rating_change = v_change,
         rating_after = v_next_rating,
         rating_applied_at = pg_catalog.now()
   where id = p_game_id
     and user_id = v_user_id;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'already_applied', false,
    'rating', v_next_rating,
    'rating_before', v_old_rating,
    'rating_change', v_change,
    'result', v_game.result,
    'bot_id', v_game.bot_id
  );
end;
$function$;

revoke all on function public.apply_bot_chess_rating(uuid) from public, anon;
grant execute on function public.apply_bot_chess_rating(uuid) to authenticated;
