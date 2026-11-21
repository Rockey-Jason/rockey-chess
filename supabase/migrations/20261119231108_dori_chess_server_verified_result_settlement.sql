-- Applied to the Doldol Supabase project as 20261119231108.
create or replace function public.finish_pvp_game_internal(
  p_room_id uuid,
  p_result text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  actor_change integer := 0;
  host_result text;
  guest_result text;
begin
  if p_actor_id is null then raise exception '사용자 인증 정보가 필요합니다.'; end if;
  if p_result not in ('1-0','0-1','1/2-1/2') then raise exception '잘못된 경기 결과입니다.'; end if;
  select * into r from public.pvp_rooms where id=p_room_id for update;
  if not found then raise exception '대국 방을 찾을 수 없습니다.'; end if;
  if p_actor_id<>r.host_id and p_actor_id<>r.guest_id then raise exception '대국 참가자만 결과를 등록할 수 있습니다.'; end if;
  if r.status='finished' then return jsonb_build_object('ok',true,'already_finished',true,'rating_change',0,'result',r.result); end if;
  if r.status<>'playing' or r.guest_id is null or r.host_login_id is null or r.guest_login_id is null then raise exception '완료할 수 있는 대국 상태가 아닙니다.'; end if;

  -- Store each player's result from their own perspective (1-0 = this player won).
  host_result := p_result;
  guest_result := case p_result when '1-0' then '0-1' when '0-1' then '1-0' else '1/2-1/2' end;
  if p_result='1-0' then winner_login:=r.host_login_id; loser_login:=r.guest_login_id;
  elsif p_result='0-1' then winner_login:=r.guest_login_id; loser_login:=r.host_login_id;
  end if;

  if p_result<>'1/2-1/2' then
    select coalesce(chess_rating,1000) into winner_old from public.users where login_id=winner_login for update;
    select coalesce(chess_rating,1000) into loser_old from public.users where login_id=loser_login for update;
    winner_old:=coalesce(winner_old,1000); loser_old:=coalesce(loser_old,1000);
    expected_w:=1.0/(1.0+power(10.0,(loser_old-winner_old)/400.0));
    change_points:=greatest(5,least(40,round(32*(1-expected_w))));
    update public.users set chess_rating=greatest(0,coalesce(chess_rating,1000)+change_points) where login_id=winner_login;
    update public.users set chess_rating=greatest(0,coalesce(chess_rating,1000)-change_points) where login_id=loser_login;
    if winner_login=r.host_login_id then host_change:=change_points; guest_change:=-change_points;
    else host_change:=-change_points; guest_change:=change_points; end if;
  end if;

  update public.pvp_rooms set status='finished',result=p_result,winner_login_id=winner_login,finished_at=now() where id=r.id;
  insert into public.chess_games(user_id,login_id,mode,bot_id,opponent_user_id,pvp_room_id,result,pgn,accuracy,summary)
  values
    (r.host_id,r.host_login_id,'pvp',null,r.guest_id,r.id,host_result,coalesce(r.pgn,''),0,
      jsonb_build_object('mode','pvp','playerColor','w','playerResult',host_result,'opponent',r.guest_login_id,'pgn',coalesce(r.pgn,''),'totalMoves',coalesce(r.current_ply,0),'timeControl',r.time_control_seconds,'increment',r.increment_seconds)),
    (r.guest_id,r.guest_login_id,'pvp',null,r.host_id,r.id,guest_result,coalesce(r.pgn,''),0,
      jsonb_build_object('mode','pvp','playerColor','b','playerResult',guest_result,'opponent',r.host_login_id,'pgn',coalesce(r.pgn,''),'totalMoves',coalesce(r.current_ply,0),'timeControl',r.time_control_seconds,'increment',r.increment_seconds))
  on conflict (user_id,pvp_room_id) where pvp_room_id is not null do nothing;

  actor_change:=case when p_actor_id=r.host_id then host_change else guest_change end;
  return jsonb_build_object('ok',true,'result',p_result,'winner',winner_login,'rating_change',actor_change);
end;
$$;

revoke all on function public.finish_pvp_game_internal(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.finish_pvp_game_internal(uuid,text,uuid) to service_role;
revoke all on function public.finish_pvp_game(uuid,text) from public,anon,authenticated;

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
  settled:=public.finish_pvp_game_internal(p_room_id,'1/2-1/2',auth.uid());
  return settled;
end;
$$;
revoke all on function public.accept_pvp_draw(uuid) from public,anon;
grant execute on function public.accept_pvp_draw(uuid) to authenticated;
