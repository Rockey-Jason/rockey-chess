-- Applied to the Doldol Supabase project as 20261119230355.
create extension if not exists pgcrypto;

alter table public.pvp_rooms add column if not exists host_login_id text;
alter table public.pvp_rooms add column if not exists host_rating bigint not null default 1000;
alter table public.pvp_rooms add column if not exists guest_login_id text;
alter table public.pvp_rooms add column if not exists guest_rating bigint;
alter table public.pvp_rooms add column if not exists result text;
alter table public.pvp_rooms add column if not exists winner_login_id text;
alter table public.pvp_rooms add column if not exists finished_at timestamptz;
alter table public.pvp_rooms add column if not exists time_control_seconds integer not null default 300;
alter table public.pvp_rooms add column if not exists increment_seconds integer not null default 0;
alter table public.pvp_rooms add column if not exists white_remaining_ms bigint not null default 300000;
alter table public.pvp_rooms add column if not exists black_remaining_ms bigint not null default 300000;
alter table public.pvp_rooms add column if not exists turn_started_at timestamptz;
alter table public.pvp_rooms add column if not exists current_ply integer not null default 0;
alter table public.pvp_rooms add column if not exists last_move_uci text;
alter table public.pvp_rooms add column if not exists last_move_san text;
alter table public.pvp_rooms add column if not exists moves_uci text[] not null default '{}';
alter table public.pvp_rooms add column if not exists pgn text not null default '';

update public.pvp_rooms r
set host_login_id = coalesce(r.host_login_id, u.login_id, nullif(au.raw_user_meta_data->>'login_id',''), nullif(split_part(coalesce(au.email,''),'@',1),''), r.host_id::text),
    host_rating = coalesce(r.host_rating, u.chess_rating, 1000)
from auth.users au
left join public.users u on u.user_id = au.id::text
where r.host_id = au.id and r.host_login_id is null;

update public.pvp_rooms r
set guest_login_id = coalesce(r.guest_login_id, u.login_id, nullif(au.raw_user_meta_data->>'login_id',''), nullif(split_part(coalesce(au.email,''),'@',1),''), r.guest_id::text),
    guest_rating = coalesce(r.guest_rating, u.chess_rating, 1000)
from auth.users au
left join public.users u on u.user_id = au.id::text
where r.guest_id = au.id and r.guest_login_id is null;

create index if not exists pvp_rooms_status_rating_created_idx on public.pvp_rooms(status, host_rating, created_at);
create index if not exists pvp_rooms_guest_idx on public.pvp_rooms(guest_id);
create index if not exists chess_games_user_created_idx on public.chess_games(user_id, created_at desc);
alter table public.chess_games add column if not exists pvp_room_id uuid;
alter table public.chess_games add column if not exists login_id text;
create unique index if not exists chess_games_user_pvp_unique on public.chess_games(user_id, pvp_room_id) where pvp_room_id is not null;

create table if not exists public.chess_opening_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  opening_id text not null,
  completed_count integer not null default 0 check (completed_count >= 0),
  best_ply integer not null default 0 check (best_ply >= 0),
  last_completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, opening_id)
);
alter table public.chess_opening_progress enable row level security;
drop policy if exists chess_opening_progress_select_own on public.chess_opening_progress;
drop policy if exists chess_opening_progress_insert_own on public.chess_opening_progress;
drop policy if exists chess_opening_progress_update_own on public.chess_opening_progress;
create policy chess_opening_progress_select_own on public.chess_opening_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy chess_opening_progress_insert_own on public.chess_opening_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy chess_opening_progress_update_own on public.chess_opening_progress
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update on public.chess_opening_progress to authenticated;

drop policy if exists "chess games own read" on public.chess_games;
drop policy if exists "chess games own insert" on public.chess_games;
create policy chess_games_select_own on public.chess_games
  for select to authenticated using ((select auth.uid()) = user_id or (select auth.uid()) = opponent_user_id);
create policy chess_games_insert_own on public.chess_games
  for insert to authenticated with check ((select auth.uid()) = user_id);
grant select, insert on public.chess_games to authenticated;

drop policy if exists "pvp room read" on public.pvp_rooms;
drop policy if exists "pvp room create" on public.pvp_rooms;
drop policy if exists "pvp room join" on public.pvp_rooms;
create policy pvp_rooms_select_players_or_waiting on public.pvp_rooms
  for select to authenticated using (
    (select auth.uid()) = host_id or (select auth.uid()) = guest_id
    or (status = 'waiting' and guest_id is null)
  );
create policy pvp_rooms_insert_host on public.pvp_rooms
  for insert to authenticated with check ((select auth.uid()) = host_id);
create policy pvp_rooms_join_waiting on public.pvp_rooms
  for update to authenticated
  using (status = 'waiting' and guest_id is null and host_id <> (select auth.uid()))
  with check (guest_id = (select auth.uid()) and status = 'playing' and host_id <> (select auth.uid()));
revoke all on public.pvp_rooms from anon;
grant select, insert on public.pvp_rooms to authenticated;
revoke update on public.pvp_rooms from authenticated;
grant update (guest_id, guest_login_id, guest_rating, status) on public.pvp_rooms to authenticated;

-- Legacy participant-checked settlement. Browser execute is revoked in a later migration.
create or replace function public.finish_pvp_game(p_room_id uuid, p_result text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.pvp_rooms;
  winner_login text;
  loser_login text;
  winner_old bigint;
  loser_old bigint;
  expected_w numeric;
  change_points integer;
  host_change integer := 0;
  guest_change integer := 0;
  host_result text;
  guest_result text;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if p_result not in ('1-0','0-1','1/2-1/2') then raise exception '잘못된 경기 결과입니다.'; end if;
  select * into r from public.pvp_rooms where id = p_room_id for update;
  if not found then raise exception '대국 방을 찾을 수 없습니다.'; end if;
  if auth.uid() <> r.host_id and auth.uid() <> r.guest_id then raise exception '대국 참가자만 결과를 등록할 수 있습니다.'; end if;
  if r.status = 'finished' then return jsonb_build_object('ok',true,'already_finished',true,'rating_change',0,'result',r.result); end if;
  if r.status <> 'playing' or r.guest_id is null or r.host_login_id is null or r.guest_login_id is null then raise exception '완료할 수 있는 대국 상태가 아닙니다.'; end if;

  if p_result = '1/2-1/2' then
    host_result := p_result; guest_result := p_result;
  elsif p_result = '1-0' then
    winner_login := r.host_login_id; loser_login := r.guest_login_id;
    host_result := '1-0'; guest_result := '0-1';
  else
    winner_login := r.guest_login_id; loser_login := r.host_login_id;
    host_result := '0-1'; guest_result := '1-0';
  end if;
  if p_result <> '1/2-1/2' then
    select coalesce(chess_rating,1000) into winner_old from public.users where login_id = winner_login for update;
    select coalesce(chess_rating,1000) into loser_old from public.users where login_id = loser_login for update;
    winner_old := coalesce(winner_old,1000); loser_old := coalesce(loser_old,1000);
    expected_w := 1.0 / (1.0 + power(10.0, (loser_old - winner_old) / 400.0));
    change_points := greatest(5, least(40, round(32 * (1 - expected_w))));
    update public.users set chess_rating = greatest(0, coalesce(chess_rating,1000) + change_points) where login_id = winner_login;
    update public.users set chess_rating = greatest(0, coalesce(chess_rating,1000) - change_points) where login_id = loser_login;
    if winner_login = r.host_login_id then host_change := change_points; guest_change := -change_points;
    else host_change := -change_points; guest_change := change_points; end if;
  end if;
  update public.pvp_rooms set status='finished', result=p_result, winner_login_id=winner_login, finished_at=now() where id=r.id;
  insert into public.chess_games(user_id,login_id,mode,bot_id,opponent_user_id,pvp_room_id,result,pgn,accuracy,summary)
  values
    (r.host_id,r.host_login_id,'pvp',null,r.guest_id,r.id,host_result,coalesce(r.pgn,''),0,jsonb_build_object('mode','pvp','opponent',r.guest_login_id,'result',host_result,'pgn',coalesce(r.pgn,''),'totalMoves',coalesce(r.current_ply,0),'timeControl',r.time_control_seconds,'increment',r.increment_seconds)),
    (r.guest_id,r.guest_login_id,'pvp',null,r.host_id,r.id,guest_result,coalesce(r.pgn,''),0,jsonb_build_object('mode','pvp','opponent',r.host_login_id,'result',guest_result,'pgn',coalesce(r.pgn,''),'totalMoves',coalesce(r.current_ply,0),'timeControl',r.time_control_seconds,'increment',r.increment_seconds))
  on conflict (user_id,pvp_room_id) where pvp_room_id is not null do nothing;
  return jsonb_build_object('ok',true,'result',p_result,'winner',winner_login,'rating_change',case when auth.uid()=r.host_id then host_change else guest_change end);
end;
$$;
revoke all on function public.finish_pvp_game(uuid,text) from public, anon;
grant execute on function public.finish_pvp_game(uuid,text) to authenticated;

create or replace function public.award_rock_king_coin(p_amount bigint,p_login_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare new_balance bigint;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if p_amount < 0 or p_amount > 500 then raise exception '보상 금액이 올바르지 않습니다.'; end if;
  update public.users set rock_king_coin=greatest(0,coalesce(rock_king_coin,0)+p_amount)
   where login_id=p_login_id and user_id=auth.uid()::text
   returning rock_king_coin into new_balance;
  if new_balance is null then raise exception '로그인 사용자 정보가 일치하지 않습니다.'; end if;
  return jsonb_build_object('ok',true,'balance',new_balance);
end;
$$;
revoke all on function public.award_rock_king_coin(bigint,text) from public, anon;
grant execute on function public.award_rock_king_coin(bigint,text) to authenticated;
revoke all on function public.purchase_rock_king_item(text,bigint,text,uuid) from public, anon;
grant execute on function public.purchase_rock_king_item(text,bigint,text,uuid) to authenticated;
