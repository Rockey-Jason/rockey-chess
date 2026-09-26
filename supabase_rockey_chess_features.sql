-- ROCKEY CHESS feature migration
-- Run this in Supabase SQL Editor. Existing users table is reused.

create table if not exists public.chess_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'bot',
  bot_id text,
  opponent_user_id uuid references auth.users(id) on delete set null,
  result text not null default '*',
  pgn text not null default '',
  accuracy numeric(5,2) default 0,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  purchased_at timestamptz not null default now(),
  primary key(user_id,item_id)
);

create table if not exists public.user_customization (
  user_id uuid primary key references auth.users(id) on delete cascade,
  customization jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.pvp_rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid references auth.users(id) on delete set null,
  status text not null default 'waiting',
  fen text not null,
  created_at timestamptz not null default now()
);

create index if not exists chess_games_user_created_idx on public.chess_games(user_id,created_at desc);
create index if not exists pvp_rooms_status_idx on public.pvp_rooms(status);

alter table public.chess_games enable row level security;
alter table public.user_inventory enable row level security;
alter table public.user_customization enable row level security;
alter table public.pvp_rooms enable row level security;

drop policy if exists "chess games own read" on public.chess_games;
drop policy if exists "chess games own insert" on public.chess_games;
drop policy if exists "inventory own read" on public.user_inventory;
drop policy if exists "custom own read" on public.user_customization;
drop policy if exists "custom own write" on public.user_customization;
drop policy if exists "custom own update" on public.user_customization;
drop policy if exists "pvp room read" on public.pvp_rooms;
drop policy if exists "pvp room create" on public.pvp_rooms;
drop policy if exists "pvp room join" on public.pvp_rooms;

create policy "chess games own read" on public.chess_games for select using (auth.uid()=user_id or auth.uid()=opponent_user_id);
create policy "chess games own insert" on public.chess_games for insert with check (auth.uid()=user_id);
create policy "inventory own read" on public.user_inventory for select using (auth.uid()=user_id);
create policy "custom own read" on public.user_customization for select using (auth.uid()=user_id);
create policy "custom own write" on public.user_customization for insert with check (auth.uid()=user_id);
create policy "custom own update" on public.user_customization for update using (auth.uid()=user_id);
create policy "pvp room read" on public.pvp_rooms for select using (auth.uid()=host_id or auth.uid()=guest_id or status='waiting');
create policy "pvp room create" on public.pvp_rooms for insert with check (auth.uid()=host_id);
create policy "pvp room join" on public.pvp_rooms for update using (status='waiting') with check (guest_id=auth.uid());

-- Required: users.doldolcoin numeric/integer column. If your column already exists, skip the alter.
alter table public.users add column if not exists doldolcoin bigint not null default 0;

create or replace function public.award_doldolcoin(p_amount bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare new_balance bigint;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  update public.users set doldolcoin=greatest(0,doldolcoin+p_amount) where id=auth.uid() returning doldolcoin into new_balance;
  return jsonb_build_object('ok',true,'balance',new_balance);
end;$$;

create or replace function public.purchase_shop_item(p_item_id text,p_price bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare balance bigint;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'message','로그인이 필요합니다.'); end if;
  if exists(select 1 from public.user_inventory where user_id=auth.uid() and item_id=p_item_id) then return jsonb_build_object('ok',false,'message','이미 보유한 아이템입니다.'); end if;
  select doldolcoin into balance from public.users where id=auth.uid() for update;
  if coalesce(balance,0)<p_price then return jsonb_build_object('ok',false,'message','돌이코인이 부족합니다.'); end if;
  update public.users set doldolcoin=doldolcoin-p_price where id=auth.uid();
  insert into public.user_inventory(user_id,item_id) values(auth.uid(),p_item_id);
  select doldolcoin into balance from public.users where id=auth.uid();
  return jsonb_build_object('ok',true,'balance',balance);
end;$$;

grant execute on function public.award_doldolcoin(bigint) to authenticated;
grant execute on function public.purchase_shop_item(text,bigint) to authenticated;

-- Supabase Dashboard > Database > Replication: enable realtime for pvp_rooms if you want DB-change listeners.
