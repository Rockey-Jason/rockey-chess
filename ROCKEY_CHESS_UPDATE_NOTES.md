# Rockey Chess — 2026.08 Update

## Included
- Stockfish 18 MultiPV analysis for more reliable Best/Brilliant decisions.
- Book move and Forced move classifications.
- Conservative Brilliant classifier: ordinary captures/checks/best moves are not Brilliant by themselves.
- Full post-game move-by-move analysis launched with `게임 분석하기`.
- `users` profile/rating lookups use `login_id`.
- Opponent profile above the board and player profile below it.
- Responsive board for desktop/mobile.
- Click and drag movement; touch/pen pointer dragging is supported on the main board and PvP board.
- Separate win/loss/draw result sounds.
- Real-time PvP quick matching within ±150 rating, private rooms, Realtime move sync, and Elo rating updates.
- Supabase migration SQL in `supabase/rockey_chess_update.sql`.

## Supabase
Run `supabase/rockey_chess_update.sql` in Supabase SQL Editor before using the new PvP/rating flow.

The SQL creates/extends:
- `users.chess_rating`
- `users.nickname`
- `users.profile_image`
- `pvp_rooms`
- `finish_pvp_game(...)`
- `chess_games.login_id`

## Important
The frontend resolves the logged-in user's profile with `users.login_id`. The auth user's `user_metadata.login_id` is preferred; username/email local-part is used as a fallback.

For production anti-cheat, move validation should ultimately be server-authoritative. This build provides real-time synchronization and transactional Elo updates through Supabase RPC, while legal move generation remains client-side.
