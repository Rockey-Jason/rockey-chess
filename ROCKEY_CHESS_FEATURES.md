# Rockey Chess Feature Pack

## Included
- Stockfish-based move analysis and post-game analysis modal
- PGN generation and saved completed games
- Doldolcoin rewards + shop purchase RPC
- Customization inventory/equipment
- Supabase Realtime Broadcast PvP room prototype
- UI hover/press micro-interactions

## Supabase setup
1. Open Supabase SQL Editor.
2. Run `supabase_rockey_chess_features.sql`.
3. Confirm `users.doldolcoin` exists.
4. Keep the existing `src/supabase.js` credentials.

## Notes
The analysis labels are Stockfish/CPL-based and intentionally conservative; they are not a copy of Chess.com internal proprietary scoring. PvP uses Realtime Broadcast for low-latency move delivery and a room table for discovery. For production PvP, add server-authoritative move validation and reconnect/clock handling.
