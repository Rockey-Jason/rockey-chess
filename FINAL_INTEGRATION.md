# Doldol Chess — Final Integration

This version makes `useChessGame.js` the single source of truth for the live chess game and connects:

- chess.js rules/state
- Stockfish AI
- Board click/drag movement
- promotion
- check/checkmate/draw
- move history
- captured pieces/material
- move animations
- player accuracy and move classifications
- rating load/save through Supabase `users.chess_rating`
- bot selection
- undo/reset/resign/draw
- PGN download
- responsive UI using the existing project styles/assets

Run:

```bash
npm install
npm run dev
```

Then test:

1. Select a bot.
2. Move a white piece by click or drag.
3. Wait for Stockfish to reply.
4. Test castling, capture, promotion, undo and reset.
5. Finish a game and verify rating/PGN.

If Supabase does not have `users.chess_rating`, the chess game still runs; only rating persistence will fail until that column exists.
