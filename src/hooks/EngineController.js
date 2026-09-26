import { Chess } from "chess.js";
import difficulty from "./difficulty";

function uci(move) {
  return move ? `${move.from}${move.to}${move.promotion || ""}` : "";
}

function immediateMate(fen) {
  const game = new Chess(fen);
  const legal = game.moves({ verbose: true });
  for (const move of legal) {
    game.move(uci(move));
    const mate = game.isCheckmate();
    game.undo();
    if (mate) return uci(move);
  }
  return null;
}

function pickWeakMove(fen, randomChance) {
  const game = new Chess(fen);
  const legal = game.moves({ verbose: true });
  if (!legal.length) return null;

  // Always take a forced mate when one is immediately available.
  const mate = immediateMate(fen);
  if (mate) return mate;

  if (Math.random() < randomChance) {
    return uci(legal[Math.floor(Math.random() * legal.length)]);
  }
  return null;
}

export async function requestMove(engine, currentBot, fen) {
  const bot = difficulty[currentBot] ?? difficulty.talc;

  const weakMove = pickWeakMove(fen, bot.randomChance || 0);
  if (weakMove) {
    return { bestMove: weakMove, depth: 0, random: true };
  }

  return engine.search(fen, bot.depth, {
    skill: bot.skill,
    elo: bot.elo,
    limitStrength: !bot.fullStrength,
    movetime: bot.movetime,
    fullStrength: !!bot.fullStrength
  });
}
