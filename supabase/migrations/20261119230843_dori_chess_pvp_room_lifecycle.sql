-- Applied to the Doldol Supabase project as 20261119230843.
alter table public.pvp_rooms add column if not exists draw_offer_by uuid;
alter table public.pvp_rooms add column if not exists draw_offer_at timestamptz;

alter table public.pvp_rooms
  add constraint pvp_room_time_control_valid
  check (time_control_seconds between 60 and 3600 and increment_seconds between 0 and 30)
  not valid;
alter table public.pvp_rooms validate constraint pvp_room_time_control_valid;

create or replace function public.join_pvp_room(p_room_id uuid)
returns public.pvp_rooms language plpgsql security definer set search_path=public as $$
declare
  p public.pvp_rooms;
  player_login text;
  player_rating bigint;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  select login_id,coalesce(chess_rating,1000) into player_login,player_rating
    from public.users where user_id=auth.uid()::text;
  if player_login is null then raise exception '사용자 프로필을 찾을 수 없습니다.'; end if;
  update public.pvp_rooms
     set guest_id=auth.uid(),guest_login_id=player_login,guest_rating=player_rating,status='playing',turn_started_at=now()
   where id=p_room_id and status='waiting' and guest_id is null and host_id<>auth.uid()
   returning * into p;
  if not found then raise exception '입장 가능한 대국 방이 아니거나 이미 참가자가 있습니다.'; end if;
  return p;
end;
$$;
revoke all on function public.join_pvp_room(uuid) from public,anon;
grant execute on function public.join_pvp_room(uuid) to authenticated;

create or replace function public.restart_pvp_room(p_room_id uuid)
returns public.pvp_rooms language plpgsql security definer set search_path=public as $$
declare p public.pvp_rooms;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  update public.pvp_rooms
     set host_id=guest_id,host_login_id=guest_login_id,host_rating=guest_rating,
         guest_id=host_id,guest_login_id=host_login_id,guest_rating=host_rating,
         status='playing',fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
         result=null,winner_login_id=null,finished_at=null,current_ply=0,last_move_uci=null,last_move_san=null,
         moves_uci='{}',pgn='',draw_offer_by=null,draw_offer_at=null,
         white_remaining_ms=time_control_seconds*1000,black_remaining_ms=time_control_seconds*1000,turn_started_at=now()
   where id=p_room_id and status='finished' and (host_id=auth.uid() or guest_id=auth.uid())
   returning * into p;
  if not found then raise exception '재대국할 수 있는 방이 아닙니다.'; end if;
  return p;
end;
$$;
revoke all on function public.restart_pvp_room(uuid) from public,anon;
grant execute on function public.restart_pvp_room(uuid) to authenticated;

create or replace function public.offer_pvp_draw(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare offered_by uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  update public.pvp_rooms set draw_offer_by=auth.uid(),draw_offer_at=now()
   where id=p_room_id and status='playing'
     and (host_id=auth.uid() or guest_id=auth.uid())
     and (draw_offer_by is null or draw_offer_by=auth.uid())
   returning draw_offer_by into offered_by;
  if offered_by is null then raise exception '무승부 요청을 등록할 수 없습니다.'; end if;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.offer_pvp_draw(uuid) from public,anon;
grant execute on function public.offer_pvp_draw(uuid) to authenticated;

create or replace function public.decline_pvp_draw(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  update public.pvp_rooms set draw_offer_by=null,draw_offer_at=null
   where id=p_room_id and status='playing' and draw_offer_by is not null
     and draw_offer_by<>auth.uid() and (host_id=auth.uid() or guest_id=auth.uid());
  if not found then raise exception '응답할 무승부 요청이 없습니다.'; end if;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.decline_pvp_draw(uuid) from public,anon;
grant execute on function public.decline_pvp_draw(uuid) to authenticated;

create or replace function public.accept_pvp_draw(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  p public.pvp_rooms;
  settled jsonb;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  select * into p from public.pvp_rooms
   where id=p_room_id and status='playing' and draw_offer_by is not null
     and draw_offer_by<>auth.uid() and (host_id=auth.uid() or guest_id=auth.uid())
   for update;
  if not found then raise exception '상대가 보낸 무승부 요청이 없습니다.'; end if;
  settled := public.finish_pvp_game(p_room_id,'1/2-1/2');
  return settled;
end;
$$;
revoke all on function public.accept_pvp_draw(uuid) from public,anon;
grant execute on function public.accept_pvp_draw(uuid) to authenticated;
