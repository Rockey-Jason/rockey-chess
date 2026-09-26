-- ================================================================
-- ROCKEY CHESS PROFESSIONAL / SUPABASE MIGRATION
-- Run this entire file once in Supabase SQL Editor.
-- IMPORTANT: Rock-King-Coin is NOT the same currency as Doldolcoin.
-- User profiles are resolved by users.login_id in the application.
-- ================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------
-- USERS / PROFILE / CURRENCY
-- ------------------------------------------------
alter table public.users add column if not exists login_id text;
alter table public.users add column if not exists chess_rating integer not null default 1000;
alter table public.users add column if not exists nickname text;
alter table public.users add column if not exists profile_image text;
alter table public.users add column if not exists rock_king_coin bigint not null default 0;
alter table public.users add column if not exists doldolcoin bigint not null default 0;

create unique index if not exists users_login_id_unique on public.users(login_id) where login_id is not null;
create index if not exists users_chess_rating_idx on public.users(chess_rating);

-- ------------------------------------------------
-- PVP ROOMS
-- ------------------------------------------------
create table if not exists public.pvp_rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid not null,
  host_login_id text not null,
  host_rating integer not null default 1000,
  guest_id uuid,
  guest_login_id text,
  guest_rating integer,
  status text not null default 'waiting' check(status in ('waiting','playing','finished','cancelled')),
  fen text not null,
  result text,
  winner_login_id text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.pvp_rooms add column if not exists host_login_id text;
alter table public.pvp_rooms add column if not exists host_rating integer default 1000;
alter table public.pvp_rooms add column if not exists guest_login_id text;
alter table public.pvp_rooms add column if not exists guest_rating integer;
alter table public.pvp_rooms add column if not exists result text;
alter table public.pvp_rooms add column if not exists winner_login_id text;
alter table public.pvp_rooms add column if not exists finished_at timestamptz;

create index if not exists pvp_waiting_rating_idx on public.pvp_rooms(status,host_rating,created_at);
create index if not exists pvp_code_idx on public.pvp_rooms(code);

alter table public.pvp_rooms enable row level security;
drop policy if exists "rockey pvp select" on public.pvp_rooms;
drop policy if exists "rockey pvp insert" on public.pvp_rooms;
drop policy if exists "rockey pvp update" on public.pvp_rooms;
create policy "rockey pvp select" on public.pvp_rooms for select to authenticated using(true);
create policy "rockey pvp insert" on public.pvp_rooms for insert to authenticated with check(host_id=auth.uid());
create policy "rockey pvp update" on public.pvp_rooms for update to authenticated using(host_id=auth.uid() or guest_id=auth.uid() or (status='waiting' and guest_id is null)) with check(host_id=auth.uid() or guest_id=auth.uid());

-- ------------------------------------------------
-- ROCK-KING-COIN: completely separate from Doldolcoin
-- ------------------------------------------------
create or replace function public.award_rock_king_coin(p_amount bigint, p_login_id text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare new_balance bigint;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  update public.users
    set rock_king_coin=greatest(0,coalesce(rock_king_coin,0)+p_amount)
    where login_id=p_login_id
    and exists(select 1 from auth.users au where au.id=auth.uid() and ((au.raw_user_meta_data->>'login_id')=p_login_id or (au.raw_user_meta_data->>'username')=p_login_id or split_part(coalesce(au.email,''),'@',1)=p_login_id or au.id::text=p_login_id))
    returning rock_king_coin into new_balance;
  if new_balance is null then raise exception 'login_id 사용자 정보를 찾지 못했습니다.'; end if;
  return jsonb_build_object('ok',true,'balance',new_balance);
end;
$$;
grant execute on function public.award_rock_king_coin(bigint,text) to authenticated;

create table if not exists public.user_inventory (
  user_id uuid not null,
  item_id text not null,
  purchased_at timestamptz not null default now(),
  primary key(user_id,item_id)
);
alter table public.user_inventory enable row level security;
drop policy if exists "rockey inventory read" on public.user_inventory;
drop policy if exists "rockey inventory insert" on public.user_inventory;
create policy "rockey inventory read" on public.user_inventory for select to authenticated using(user_id=auth.uid());
create policy "rockey inventory insert" on public.user_inventory for insert to authenticated with check(user_id=auth.uid());

create or replace function public.purchase_rock_king_item(
  p_item_id text,
  p_price bigint,
  p_login_id text,
  p_user_id uuid
)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare balance bigint;
begin
  if auth.uid() is null or auth.uid()<>p_user_id then
    return jsonb_build_object('ok',false,'message','로그인이 필요합니다.');
  end if;
  if not exists(select 1 from auth.users au where au.id=auth.uid() and ((au.raw_user_meta_data->>'login_id')=p_login_id or (au.raw_user_meta_data->>'username')=p_login_id or split_part(coalesce(au.email,''),'@',1)=p_login_id or au.id::text=p_login_id)) then
    return jsonb_build_object('ok',false,'message','login_id 프로필을 찾지 못했습니다.');
  end if;
  if exists(select 1 from public.user_inventory where user_id=auth.uid() and item_id=p_item_id) then
    return jsonb_build_object('ok',false,'message','이미 보유한 아이템입니다.');
  end if;
  select rock_king_coin into balance from public.users where login_id=p_login_id for update;
  if coalesce(balance,0)<p_price then
    return jsonb_build_object('ok',false,'message','Rock-King-Coin이 부족합니다.');
  end if;
  update public.users set rock_king_coin=rock_king_coin-p_price where login_id=p_login_id;
  insert into public.user_inventory(user_id,item_id) values(auth.uid(),p_item_id);
  select rock_king_coin into balance from public.users where login_id=p_login_id;
  return jsonb_build_object('ok',true,'balance',balance);
end;
$$;
grant execute on function public.purchase_rock_king_item(text,bigint,text,uuid) to authenticated;

-- ------------------------------------------------
-- ELO: K=32, rating is always changed by login_id
-- ------------------------------------------------
create or replace function public.finish_pvp_game(p_room_id uuid,p_result text)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare r public.pvp_rooms; winner_login text; loser_login text; winner_old integer; loser_old integer; expected numeric; change integer;
begin
  select * into r from public.pvp_rooms where id=p_room_id for update;
  if not found then raise exception 'PVP room not found'; end if;
  if auth.uid()<>r.host_id and auth.uid()<>r.guest_id then raise exception 'Not a participant'; end if;
  if r.status='finished' then return jsonb_build_object('rating_change',0,'already_finished',true); end if;
  if p_result not in('1-0','0-1','1/2-1/2') then raise exception 'Invalid result'; end if;
  if r.guest_id is null then raise exception 'Game has no opponent'; end if;
  if p_result='1/2-1/2' then
    update public.pvp_rooms set status='finished',result=p_result,finished_at=now() where id=r.id;
    return jsonb_build_object('rating_change',0,'result',p_result);
  end if;
  if p_result='1-0' then winner_login:=r.host_login_id; loser_login:=r.guest_login_id; else winner_login:=r.guest_login_id; loser_login:=r.host_login_id; end if;
  select chess_rating into winner_old from public.users where login_id=winner_login for update;
  select chess_rating into loser_old from public.users where login_id=loser_login for update;
  winner_old:=coalesce(winner_old,1000); loser_old:=coalesce(loser_old,1000);
  expected:=1/(1+power(10,((loser_old-winner_old)/400.0)));
  change:=greatest(5,least(40,round(32*(1-expected))));
  update public.users set chess_rating=greatest(0,winner_old+change) where login_id=winner_login;
  update public.users set chess_rating=greatest(0,loser_old-change) where login_id=loser_login;
  update public.pvp_rooms set status='finished',result=p_result,winner_login_id=winner_login,finished_at=now() where id=r.id;
  return jsonb_build_object('rating_change',case when auth.uid()=(select host_id from public.pvp_rooms where id=r.id) then case when winner_login=r.host_login_id then change else -change end else case when winner_login=r.guest_login_id then change else -change end end,'result',p_result,'winner',winner_login);
end;
$$;
grant execute on function public.finish_pvp_game(uuid,text) to authenticated;

-- ------------------------------------------------
-- GAME ARCHIVE
-- ------------------------------------------------
create table if not exists public.chess_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  login_id text,
  mode text not null default 'bot',
  bot_id text,
  pvp_room_id uuid,
  result text,
  pgn text,
  accuracy numeric,
  summary jsonb,
  created_at timestamptz not null default now()
);
alter table public.chess_games add column if not exists login_id text;
alter table public.chess_games add column if not exists pvp_room_id uuid;
create index if not exists chess_games_login_id_created_idx on public.chess_games(login_id,created_at desc);

-- ------------------------------------------------
-- REALTIME
-- ------------------------------------------------
do $$ begin alter publication supabase_realtime add table public.pvp_rooms; exception when duplicate_object then null; end $$;

-- NOTES:
-- 1. Chat and move transport use Supabase Realtime Broadcast; no chat table is required.
-- 2. PvP intentionally does NOT run Stockfish on the live board.
-- 3. Run this migration after the older feature migrations if those tables already exist.
