# Supabase SQL Editor

이번 버전은 아래 SQL을 **한 번에 실행**하는 것을 권장합니다.

```text
supabase/rockey_chess_professional.sql
```

## 핵심

- `users.login_id`를 프로필/레이팅/화폐 조회의 기준으로 사용합니다.
- `users.doldolcoin`은 돌이사이트의 기존 화폐로 유지합니다.
- `users.rock_king_coin`은 돌이체스 전용 화폐이며 완전히 별개입니다.
- PvP 레이팅은 `users.chess_rating`에 저장됩니다.
- PvP 방은 `pvp_rooms`에 저장됩니다.
- 채팅/실시간 수/요청은 Supabase Realtime Broadcast를 사용합니다.
- 게임 결과는 `finish_pvp_game()` RPC가 Elo를 원자적으로 처리합니다.
- 상점 구매는 `purchase_rock_king_item()` RPC가 잔액 차감과 보유 아이템 등록을 원자적으로 처리합니다.

## 실행 순서

1. Supabase Dashboard → SQL Editor
2. New query
3. `supabase/rockey_chess_professional.sql` 전체 붙여넣기
4. Run
5. Database → Replication에서 `pvp_rooms` Realtime이 활성화됐는지 확인

## 로그인 ID

프론트엔드는 다음 순서로 로그인 ID를 결정합니다.

1. `auth.users.raw_user_meta_data.login_id`
2. `auth.users.raw_user_meta_data.username`
3. 이메일의 `@` 앞부분
4. auth user id

그리고 `public.users`는 항상 `.eq('login_id', loginId)`로 조회합니다.
