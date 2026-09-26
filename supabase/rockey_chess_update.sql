-- ROCKEY CHESS UPDATE
-- users is always resolved by login_id in the frontend.
-- Run in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- Profile/rating columns used by the new UI. Existing columns are preserved.
alter table public.users add column if not exists chess_rating integer not null default 1000;
alter table public.users add column if not exists nickname text;
alter table public.users add column if not exists profile_image text;
create unique index if not exists users_login_id_unique on public.users(login_id);

create table if not exists public.pvp_rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid not null,
  host_login_id text not null,
  host_rating integer not null default 1000,
  guest_id uuid,
  guest_login_id text,
  guest_rating integer,
  status text not null default 'waiting' check (status in ('waiting','playing','finished','cancelled')),
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

create index if not exists pvp_rooms_waiting_rating_idx on public.pvp_rooms(status,host_rating,created_at);
create index if not exists pvp_rooms_code_idx on public.pvp_rooms(code);

-- Prevent two people from claiming the same waiting room at the same time.
create unique index if not exists pvp_one_guest_per_waiting_room
on public.pvp_rooms(id) where status = 'waiting' and guest_id is not null;

alter table public.pvp_rooms enable row level security;
drop policy if exists "pvp rooms read authenticated" on public.pvp_rooms;
create policy "pvp rooms read authenticated" on public.pvp_rooms for select to authenticated using (true);
drop policy if exists "pvp rooms insert own host" on public.pvp_rooms;
create policy "pvp rooms insert own host" on public.pvp_rooms for insert to authenticated with check (host_id = auth.uid());
drop policy if exists "pvp rooms update participant" on public.pvp_rooms;
create policy "pvp rooms update participant" on public.pvp_rooms for update to authenticated using (host_id = auth.uid() or guest_id = auth.uid() or (guest_id is null and status = 'waiting')) with check (host_id = auth.uid() or guest_id = auth.uid());

-- Elo update. K=32, with a small 400-point floor/ceiling clamp on the expected score.
create or replace function public.finish_pvp_game(p_room_id uuid, p_result text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.pvp_rooms;
  caller_login text;
  expected_w numeric;
  change integer;
  winner_login text;
  loser_login text;
  winner_old integer;
  loser_old integer;
  winner_new integer;
  loser_new integer;
begin
  select * into r from public.pvp_rooms where id = p_room_id for update;
  if not found then raise exception 'PVP room not found'; end if;
  if auth.uid() <> r.host_id and auth.uid() <> r.guest_id then raise exception 'Not a participant'; end if;
  if r.status = 'finished' then
    return jsonb_build_object('rating_change',0,'already_finished',true);
  end if;
  if p_result not in ('1-0','0-1','1/2-1/2') then raise exception 'Invalid result'; end if;
  if r.guest_id is null or r.guest_login_id is null then raise exception 'Game has no opponent'; end if;

  if p_result = '1/2-1/2' then
    update public.pvp_rooms set status='finished', result=p_result, finished_at=now() where id=r.id;
    return jsonb_build_object('rating_change',0,'result',p_result);
  end if;

  if p_result='1-0' then winner_login:=r.host_login_id; loser_login:=r.guest_login_id;
  else winner_login:=r.guest_login_id; loser_login:=r.host_login_id; end if;

  select chess_rating into winner_old from public.users where login_id=winner_login for update;
  select chess_rating into loser_old from public.users where login_id=loser_login for update;
  winner_old:=coalesce(winner_old,1000); loser_old:=coalesce(loser_old,1000);

  expected_w := 1.0/(1.0 + power(10.0, ((loser_old-winner_old)/400.0)));
  change := greatest(5, least(40, round(32*(1-expected_w))));
  winner_new := greatest(0,winner_old+change);
  loser_new := greatest(0,loser_old-change);

  update public.users set chess_rating=winner_new where login_id=winner_login;
  update public.users set chess_rating=loser_new where login_id=loser_login;
  update public.pvp_rooms set status='finished', result=p_result, winner_login_id=winner_login, finished_at=now() where id=r.id;

  if auth.uid() = r.host_id then
    return jsonb_build_object('rating_change', case when winner_login=r.host_login_id then change else -change end,'result',p_result,'winner',winner_login);
  else
    return jsonb_build_object('rating_change', case when winner_login=r.guest_login_id then change else -change end,'result',p_result,'winner',winner_login);
  end if;
end;
$$;

grant execute on function public.finish_pvp_game(uuid,text) to authenticated;

-- Optional game archive table. This keeps login_id available for the application even if auth ids change.
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
create index if not exists chess_games_login_id_idx on public.chess_games(login_id,created_at desc);

-- Realtime publication. Safe to run repeatedly.
do $$
begin
  alter publication supabase_realtime add table public.pvp_rooms;
exception when duplicate_object then null;
end $$;
