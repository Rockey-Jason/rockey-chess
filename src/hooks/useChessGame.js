import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { playChessAudio } from "./chessAudio";
import { supabase } from "../supabase";
import StockfishEngine from "../ai/StockfishEngine";
import { classifyMove, secondBestLoss } from "../ai/moveQuality";
import { requestMove } from "./EngineController";
import botData from "../data/botData";
import { dialogs } from "../data/chessDialog";

const START_FEN = new Chess().fen();

const botRating = {
  talc: 1,
  sleep: 100,
  fur: 500,
  rockey: 1000,
  army: 3000,
  doronum: 5000,
  brilliant: 10000
};

const getRatingGain = (opponentRating, playerRating) => {
  const diff = Number(opponentRating) - Number(playerRating);

  // 레이팅 차이 25점마다 승리 보상이 1씩 변한다.
  return Math.max(0, Math.min(170, 50 + Math.trunc(diff / 25)));
};

const getRatingLoss = (opponentRating, playerRating) => {
  const diff = Number(opponentRating) - Number(playerRating);

  // 레이팅 차이 25점마다 기본 패배 감소량이 1씩 변한다.
  return Math.max(0, Math.min(170, 50 - Math.trunc(diff / 25)));
};

const STAT_KEYS = [
  "brilliant",
  "great",
  "best",
  "excellent",
  "good",
  "inaccuracy",
  "mistake",
  "blunder",
  "miss",
  "book",
  "forced"
];

const emptyStats = () =>
  Object.fromEntries(STAT_KEYS.map(k => [k, 0]));

const uci = m =>
  m ? `${m.from}${m.to}${m.promotion || ""}`.toLowerCase() : "";

const clamp = (n, a, b) =>
  Math.max(a, Math.min(b, n));


const BOOK_LINES = [
  "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6",
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3",
  "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3",
  "e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6 Nc3",
  "e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5 O-O O-O",
  "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6",
  "d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 e4",
  "c4 e5 Nc3 Nf6 Nf3 Nc6 g3",
  "Nf3 d5 g3 Nf6 Bg2 e6 O-O Be7 d4",
];
const BOOK_PREFIXES = BOOK_LINES.map(line => line.split(/\s+/));

function isBookMove(history, san) {
  const next = [...history, san];
  return BOOK_PREFIXES.some(line => next.length <= line.length && next.every((m, i) => m === line[i]));
}

function accuracyFromCpl(cpl) {
  if (!Number.isFinite(cpl) || cpl <= 0) return 100;
  return Number(
    clamp(100 * Math.exp(-cpl / 300), 0, 100).toFixed(1)
  );
}

function playerEval(result, color) {
  if (!result) return 0;

  if (
    result.mate !== null &&
    result.mate !== undefined
  ) {
    const v =
      Number(result.mate) > 0
        ? 100000
        : -100000;

    return result.sideToMove === color ? v : -v;
  }

  const cp = Number(result.score || 0);

  return result.sideToMove === color
    ? cp
    : -cp;
}

function positionEval(result, color, position) {
  if (position?.isCheckmate?.()) {
    const winner = position.turn() === "w" ? "b" : "w";
    return winner === color ? 100000 : -100000;
  }
  if (position?.isDraw?.()) return 0;
  return playerEval(result, color);
}

function mateForPosition(result, position) {
  if (position?.isCheckmate?.()) {
    return {
      moves: 0,
      winner: position.turn() === "w" ? "black" : "white"
    };
  }
  if (result?.mate === null || result?.mate === undefined) return null;
  return {
    moves: Math.abs(Number(result.mate)),
    winner: positionEval(result, "w", position) >= 0 ? "white" : "black"
  };
}

async function getLoginIdAndProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, loginId: null, profile: {} };

  // The signed-in auth ID is the stable owner key protected by users RLS.
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) console.warn("users(user_id) lookup failed", error);
  const profile = data || {};
  const loginId = profile.login_id ||
    user.user_metadata?.login_id ||
    user.user_metadata?.username ||
    user.email?.split("@")[0] ||
    user.id;

  return { user, loginId, profile };
}
export default function useChessGame() {
  const gameRef = useRef(null);

  if (!gameRef.current) {
    gameRef.current = new Chess();
  }

    const [currentBot, setCurrentBot] =
    useState("talc");
  const [playerProfile, setPlayerProfile] = useState({ name: "나", rating: 0, image: "" });

  const [doldolcoin, setDoldolcoin] = useState(0);
  const [rockKingCoin, setRockKingCoin] = useState(0);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisProgress, setAnalysisProgress] = useState({ completed: 0, total: 0, currentMove: 0, percent: 0 });
  const analysisTaskRef = useRef(null);
  const analysisGenerationRef = useRef(0);
  const savedGameRef = useRef(false);
  const [achievementEvent, setAchievementEvent] = useState(null);
  const achievementQueueRef = useRef([]);
  const achievementShowingRef = useRef(false);

  const game = gameRef.current;

  const engineRef = useRef(null);
  const analysisEngineRef = useRef(null);
  const positionAnalysisCacheRef = useRef(new Map());

  // Reuse one Stockfish evaluation for each exact position throughout a game.
  const getPositionAnalysis = useCallback((fen) => {
    const cache = positionAnalysisCacheRef.current;
    const cached = cache.get(fen);
    if (cached) {
      cache.delete(fen);
      cache.set(fen, cached);
      return cached;
    }

    const engine = analysisEngineRef.current;
    if (!engine || engine.destroyed) {
      return Promise.reject(new Error("Stockfish 분석 엔진이 준비되지 않았습니다."));
    }

    const task = engine.analyzePosition(fen, 16, {
      multiPV: 3,
      movetime: 180
    }).then(result => {
      if (cache.get(fen) === task) {
        cache.delete(fen);
        cache.set(fen, Promise.resolve(result));
      }
      return result;
    }).catch(error => {
      if (cache.get(fen) === task) cache.delete(fen);
      throw error;
    });

    cache.set(fen, task);
    while (cache.size > 180) {
      cache.delete(cache.keys().next().value);
    }
    return task;
  }, []);

  const mountedRef = useRef(true);
  const gameIdRef = useRef(0);

  const startTimeRef = useRef(Date.now());

  const playerAccuraciesRef = useRef([]);
  const statsRef = useRef(emptyStats());
  const moveHistoryRef = useRef([]);

  const ratingSavedRef = useRef(false);
  const ratingSaveInFlightRef = useRef(false);

  /* =====================================================
     DIALOG SYSTEM
  ===================================================== */

  const lastDialogRef = useRef("");
  const dialogTimerRef = useRef(null);
  const dialogCooldownRef = useRef(0);

  const [dialog, setDialog] = useState("");
  const [dialogKey, setDialogKey] = useState(0);

  /*
   * army bot은 실제 botData에서는 "army"라는 이름을
   * 사용할 가능성이 높지만 chessDialog에서는
   * rockeyArmy라는 이름을 사용한다.
   */
  const getDialogCharacter = useCallback(bot => {
    if (bot === "army") return "rockeyArmy";
    return bot;
  }, []);

  /*
   * 실제로 캐릭터가 말하는 함수
   */
const say = useCallback(
    (type = "normal", character, options = {}) => {

        const selectedCharacter =
            character || currentBot;

        const actualCharacter =
            getDialogCharacter(selectedCharacter);

        const characterDialogs =
            dialogs[actualCharacter];

        if (!characterDialogs) return;

        let list =
            characterDialogs[type];

        if (
            !Array.isArray(list) ||
            list.length === 0
        ) {
            list =
                characterDialogs.normal;
        }

        if (
            !Array.isArray(list) ||
            list.length === 0
        ) {
            return;
        }

        const now = Date.now();

        if (
            !options.force &&
            type !== "starting" &&
            now - dialogCooldownRef.current < 900
        ) {
            return;
        }

        let candidates = list;

        if (list.length > 1) {
            candidates = list.filter(
                text =>
                    text !==
                    lastDialogRef.current
            );
        }

        const selected =
            candidates[
                Math.floor(
                    Math.random() *
                    candidates.length
                )
            ];

        if (!selected) return;

        lastDialogRef.current =
            selected;

        dialogCooldownRef.current =
            now;

        setDialog("");
        setDialogKey(
            prev => prev + 1
        );

        requestAnimationFrame(() => {
            if (!mountedRef.current) return;

            setDialog(selected);
        });

        if (dialogTimerRef.current) {
            clearTimeout(
                dialogTimerRef.current
            );
        }

        const duration =
            options.duration ||
            Math.max(
                2800,
                Math.min(
                    9000,
                    Array.from(selected).length * 38 + 1400
                )
            );

        dialogTimerRef.current =
            setTimeout(() => {
                if (!mountedRef.current) return;

                setDialog("");
            }, duration);
    },
    [
        currentBot,
        getDialogCharacter
    ]
);

  /*
   * 분석 결과에 따라 대사를 선택
   */
  const sayAnalysis = useCallback(
    (quality, speaker) => {
      const prefix =
        speaker === "bot"
          ? "bot"
          : "other";

      const type = `${prefix}${quality
        .charAt(0)
        .toUpperCase()}${quality.slice(1)}`;

      say(type);
    },
    [say]
  );

  const [position, setPosition] = useState(game.fen());
  const [turn, setTurn] = useState(game.turn());

  const [selected, setSelected] = useState(null);
  const [moves, setMoves] = useState([]);

  const [history, setHistory] = useState([]);

  const [lastMove, setLastMove] = useState(null);

  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState("");

  const [result, setResult] = useState("*");

  const [rating, setRating] = useState(0);
  const [ratingChange, setRatingChange] =
    useState(0);

  const [showRatingChange, setShowRatingChange] =
    useState(false);

  const [isThinking, setIsThinking] =
    useState(false);

  const [promotionData, setPromotionData] =
    useState(null);

  const [capturedWhite, setCapturedWhite] =
    useState([]);

  const [capturedBlack, setCapturedBlack] =
    useState([]);

  const [accuracy, setAccuracy] =
    useState(100);

  const [moveStats, setMoveStats] =
    useState(emptyStats());

  const [analysisMoves, setAnalysisMoves] =
    useState([]);

  const [currentEvaluation, setCurrentEvaluation] =
    useState(0);

  const [lastAnalysis, setLastAnalysis] =
    useState(null);

  const [moveAnimations, setMoveAnimations] =
    useState([]);

  const [gameSummary, setGameSummary] =
    useState({});

  const sync = useCallback(() => {
    if (!mountedRef.current) return;

    setPosition(game.fen());
    setTurn(game.turn());
  }, [game]);

  const soundThemeRef = useRef("default");

  const playSound = useCallback((name, piece = "p") => {
    const isPieceSound = ["move", "capture", "castle"].includes(name);
    const usesWoodPack = soundThemeRef.current === "sound_classic";

    // 기본 대국은 저장소의 실제 효과음을 사용하고,
    // 상점 사운드 팩을 장착하면 기물별 나무 타격음으로 전환한다.
    if (name === "click") {
      playChessAudio("select", piece, soundThemeRef.current);
      return;
    }
    if (name === "promotion" || name === "check" || (usesWoodPack && isPieceSound)) {
      if (playChessAudio(name, piece, soundThemeRef.current)) return;
    }

    try {
      const audio = new Audio(`${import.meta.env.BASE_URL}sounds/${name}.mp3`);
      audio.volume = 0.58;
      audio.play().catch(() => {
        if (isPieceSound) playChessAudio(name, piece, soundThemeRef.current);
      });
    } catch {
      if (isPieceSound) playChessAudio(name, piece, soundThemeRef.current);
    }
  }, []);

  /*
   * 초기화
   */
  useEffect(() => {
    mountedRef.current = true;

    engineRef.current =
      new StockfishEngine();

    analysisEngineRef.current =
      new StockfishEngine();

    const loadRating = async () => {
      const { user, profile } = await getLoginIdAndProfile();
      if (!mountedRef.current) return;
      if (user) {
        const { data: customizationData } = await supabase
          .from("user_customization")
          .select("customization")
          .eq("user_id", user.id)
          .maybeSingle();
        soundThemeRef.current = customizationData?.customization?.sound || "default";
      }
      const r = Number(profile.chess_rating);
      if (Number.isFinite(r)) setRating(r);
      if (Number.isFinite(Number(profile.doldolcoin))) setDoldolcoin(Number(profile.doldolcoin));
      if (Number.isFinite(Number(profile.rock_king_coin))) setRockKingCoin(Number(profile.rock_king_coin));
      setPlayerProfile({
        name: profile.nickname || profile.name || profile.login_id || "나",
        rating: Number.isFinite(r) ? r : 0,
        image: profile.profile_image || profile.avatar_url || profile.image_url || profile.profile_url || ""
      });
    };

    loadRating();

    playSound("start");

    /*
     * 게임 시작 대사
     */
    setTimeout(() => {
      if (mountedRef.current) {
        say("starting", currentBot, {
          force: true
        });
      }
    }, 500);

    return () => {
      mountedRef.current = false;

      if (dialogTimerRef.current) {
        clearTimeout(
          dialogTimerRef.current
        );
      }

      engineRef.current?.terminate();
      analysisEngineRef.current?.terminate();
    };
  }, [playSound, say, currentBot]);

  /*
   * 캐릭터가 변경되면 새 캐릭터가 인사
   */
  useEffect(() => {
    if (!mountedRef.current) return;

    const timer = setTimeout(() => {
      say("starting", currentBot, {
        force: true
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [currentBot, say]);

  const refreshCaptured = useCallback(() => {
    const wc = [];
    const bc = [];

    game.history({
      verbose: true
    }).forEach(m => {
      if (m.captured) {
        const code =
          `${m.color === "w" ? "b" : "w"}${m.captured.toUpperCase()}`;

        if (m.color === "w") {
          bc.push(code);
        } else {
          wc.push(code);
        }
      }
    });

    setCapturedWhite(wc);
    setCapturedBlack(bc);
  }, [game]);

  const materialScore = (() => {
    const values = {
      p: 1,
      n: 3,
      b: 3,
      r: 5,
      q: 9,
      k: 0
    };

    let white = 0;
    let black = 0;

    game
      .board()
      .flat()
      .forEach(p => {
        if (!p) return;

        if (p.color === "w") {
          white += values[p.type];
        } else {
          black += values[p.type];
        }
      });

    return {
      white,
      black
    };
  })();

  const getLegalMoves = useCallback(
    square => {
      if (!square) return [];

      try {
        return game
          .moves({
            square,
            verbose: true
          })
          .map(m => m.to);
      } catch {
        return [];
      }
    },
    [game]
  );

  /*
   * 게임 종료 처리
   */
  const updateOutcome = useCallback(() => {
    if (!game.isGameOver()) {
      return false;
    }

    const over =
      game.isCheckmate() ||
      game.isDraw() ||
      game.isStalemate() ||
      game.isThreefoldRepetition() ||
      game.isInsufficientMaterial();

    if (!over) return false;

    setGameOver(true);
    setIsThinking(false);

    if (game.isCheckmate()) {
      const w =
        game.turn() === "w"
          ? "Black"
          : "White";

      setWinner(w);

      const finalResult =
        game.turn() === "w"
          ? "0-1"
          : "1-0";

      setResult(finalResult);

      playSound(finalResult === "1-0" ? "win" : "loss");
      setTimeout(() => playSound("checkmate"), 80);

      /*
       * AI가 체크메이트를 했다면 botwin
       * 플레이어가 체크메이트를 했다면 botlose
       */
      if (finalResult === "0-1") {
        say("botwin", currentBot, {
          force: true,
          duration: 4000
        });
      } else {
        say("botlose", currentBot, {
          force: true,
          duration: 4000
        });
      }
    } else {
      setWinner("Draw");
      setResult("1/2-1/2");
      playSound("draw");

      say("stalemate", currentBot, {
        force: true
      });
    }

    return true;
  }, [
    currentBot,
    game,
    playSound,
    say
  ]);

  /*
   * 플레이어 수 분석
   */
  const analyzePlayerMove = useCallback(
    async (beforeFen, afterFen, move) => {
      if (!analysisEngineRef.current || !move) return;

      try {
        const beforeGame = new Chess(beforeFen);
        const afterGame = new Chess(afterFen);
        const before = await getPositionAnalysis(beforeFen);
        const after = afterGame.isGameOver()
          ? null
          : await getPositionAnalysis(afterFen);

        const beforeScore = positionEval(before, move.color, beforeGame);
        const afterScore = positionEval(after, move.color, afterGame);
        // A completed checkmate is a forced win, never a centipawn loss.
        const cpl = afterGame.isCheckmate()
          ? 0
          : Math.max(0, beforeScore - afterScore);
        const acc = accuracyFromCpl(cpl);

        const bestMove = String(before.bestMove || "").toLowerCase();
        const playedMove = uci(move);
        const isBest = playedMove === bestMove;

        const quality = classifyMove(cpl, isBest, move, beforeGame, afterGame, {
          book: isBookMove(moveHistoryRef.current.slice(0, -1), move.san),
          secondCpl: secondBestLoss(before, move.color, beforeScore)
        });

        statsRef.current[quality] =
          (statsRef.current[quality] || 0) + 1;

        setMoveStats({ ...statsRef.current });

        playerAccuraciesRef.current.push(acc);

        const overall =
          playerAccuraciesRef.current.reduce((a, b) => a + b, 0) /
          playerAccuraciesRef.current.length;

        setAccuracy(Number(overall.toFixed(1)));

        const mate = mateForPosition(after, afterGame);
        const whiteEvaluation = positionEval(after, "w", afterGame);
        const evalAfter = mate
          ? (mate.winner === "white" ? 10 : -10)
          : whiteEvaluation / 100;

        const entry = {
          ply: playerAccuraciesRef.current.length,
          moveNumber: Math.ceil(game.history().length / 2),
          san: move.san,
          uci: playedMove,
          quality,
          cpl: Number(cpl.toFixed(1)),
          accuracy: acc,
          bestMove,
          evaluation: Number(evalAfter.toFixed(2)),
          mate,
          side: "player"
        };

        setAnalysisMoves(prev => [...prev.slice(-59), entry]);
        setLastAnalysis(entry);
        setCurrentEvaluation(entry.evaluation);

        sayAnalysis(quality, "other");
      } catch (error) {
        console.warn("Player analysis failed", error);
      }
    },
    [sayAnalysis, game, getPositionAnalysis]
  );

  const analyzeBotMove = useCallback(
    async (beforeFen, afterFen, move) => {
      if (!analysisEngineRef.current || !move) return;

      try {
        const beforeGame = new Chess(beforeFen);
        const afterGame = new Chess(afterFen);
        const before = await getPositionAnalysis(beforeFen);
        const after = afterGame.isGameOver()
          ? null
          : await getPositionAnalysis(afterFen);

        const beforeScore = positionEval(before, "b", beforeGame);
        const afterScore = positionEval(after, "b", afterGame);
        const cpl = afterGame.isCheckmate()
          ? 0
          : Math.max(0, beforeScore - afterScore);

        const bestMove = String(before.bestMove || "").toLowerCase();
        const isBest = uci(move) === bestMove;

        const quality = classifyMove(
          cpl,
          isBest,
          move,
          beforeGame,
          afterGame,
          {
            book: isBookMove(game.history().slice(0, -1), move.san),
            secondCpl: secondBestLoss(before, "b", beforeScore)
          }
        );

        const mate = mateForPosition(after, afterGame);
        const whiteEvaluation = positionEval(after, "w", afterGame);
        const evaluation = mate
          ? (mate.winner === "white" ? 10 : -10)
          : whiteEvaluation / 100;

        const entry = {
          ply: game.history().length,
          moveNumber: Math.ceil(game.history().length / 2),
          san: move.san,
          uci: uci(move),
          quality,
          cpl: Number(cpl.toFixed(1)),
          accuracy: accuracyFromCpl(cpl),
          bestMove,
          evaluation: Number(evaluation.toFixed(2)),
          mate,
          side: "bot"
        };

        setAnalysisMoves(prev => [...prev.slice(-59), entry]);
        setLastAnalysis(entry);
        setCurrentEvaluation(entry.evaluation);

        sayAnalysis(quality, "bot");
      } catch (error) {
        console.warn("Bot analysis failed", error);
      }
    },
    [game, sayAnalysis, getPositionAnalysis]
  );

  const finalizeSummary = useCallback(
    (finalResult = result) => {
      const bot =
        botData[currentBot] || {};

      const elapsed = Math.max(
        0,
        Math.floor(
          (Date.now() -
            startTimeRef.current) /
            1000
        )
      );

      const pgnGame = new Chess();

      try {
        pgnGame.loadPgn(game.pgn());
      } catch {}

      const date =
        new Date()
          .toISOString()
          .slice(0, 10)
          .replaceAll("-", ".");

      const stats =
        statsRef.current;

      const pgn = game.pgn({
        newline: "\n"
      });

      return {
        event: "Doldol Chess",
        site: "Doldol Site",
        date,
        round: "1",
        white: "Player",
        black:
          bot.name ||
          currentBot,

        difficulty:
          `Lv.${bot.level || 1}`,

        result: finalResult,

        playerRating: rating,

        botRating:
          botRating[currentBot] || 0,

        playTime:
          `${Math.floor(elapsed / 60)}:${String(
            elapsed % 60
          ).padStart(2, "0")}`,

        accuracy,

        ...stats,

        totalMoves:
          game.history().length,

        pgn
      };
    },
    [
      accuracy,
      currentBot,
      game,
      rating,
      result
    ]
  );

  const saveRating = useCallback(
    async change => {
      if (
        ratingSavedRef.current ||
        ratingSaveInFlightRef.current ||
        !Number.isFinite(Number(change)) ||
        Number(change) === 0
      ) {
        return false;
      }

      ratingSaveInFlightRef.current = true;

      try {
        const { user, profile } = await getLoginIdAndProfile();
        if (!user) throw new Error("로그인 세션을 확인할 수 없어 레이팅을 저장하지 못했습니다.");

        // null / 빈 문자열을 Number()로 변환하면 0이 되므로,
        // 실제 저장값이 없을 때는 현재 화면의 레이팅을 기준값으로 사용한다.
        const rawStoredRating = profile.chess_rating;
        const parsedStoredRating =
          rawStoredRating === null || rawStoredRating === undefined || rawStoredRating === ""
            ? NaN
            : Number(rawStoredRating);
        const screenRating = Number(rating);
        const baseRating = Number.isFinite(parsedStoredRating)
          ? parsedStoredRating
          : Number.isFinite(screenRating)
            ? Math.max(0, screenRating)
            : 0;
        const numericChange = Number(change);
        if (!Number.isFinite(numericChange) || numericChange === 0) {
          throw new Error("적용할 레이팅 변화량이 올바르지 않습니다.");
        }
        const next = Math.max(0, baseRating + numericChange);

        // 먼저 소유자 행을 갱신한 뒤, 별도 조회로 DB 반영 여부를 검증한다.
        // UPDATE ... SELECT 조합이 RLS의 SELECT 정책에 막히는 경우도 분리해 처리한다.
        const { data: updateRows, error: updateError } = await supabase
          .from("users")
          .update({ chess_rating: next })
          .eq("user_id", user.id)
          .select("user_id");

        if (updateError) throw updateError;
        if (!updateRows || updateRows.length === 0) {
          throw new Error("레이팅을 수정할 사용자 행이 없습니다. 로그인 및 users 테이블 RLS 정책을 확인해 주세요.");
        }

        const { data: verifiedProfile, error: verifyError } = await supabase
          .from("users")
          .select("chess_rating")
          .eq("user_id", user.id)
          .maybeSingle();

        if (verifyError) throw verifyError;
        if (!verifiedProfile) {
          throw new Error("레이팅 저장 후 사용자 정보를 다시 확인하지 못했습니다.");
        }

        const savedRating = Number(verifiedProfile.chess_rating);
        if (!Number.isFinite(savedRating) || savedRating !== next) {
          throw new Error(`레이팅 저장값 검증 실패: 기대값 ${next}, 실제값 ${verifiedProfile.chess_rating}`);
        }

        const actualChange = savedRating - baseRating;
        ratingSavedRef.current = true;
        setRating(savedRating);
        setPlayerProfile(prev => ({ ...prev, rating: savedRating }));
        setRatingChange(actualChange);
        setShowRatingChange(actualChange !== 0);
        return true;
      } catch (error) {
        console.error("[Rockey Chess] 레이팅 저장 실패:", error);
        return false;
      } finally {
        ratingSaveInFlightRef.current = false;
      }
    },
    [rating]
  );

  const showAchievement = useCallback((data) => {
    if (!data?.success || data?.already_claimed) return;

    achievementQueueRef.current.push(data);

    if (achievementShowingRef.current) return;

    achievementShowingRef.current = true;

    const next = () => {
      const item = achievementQueueRef.current.shift();

      if (!item) {
        achievementShowingRef.current = false;
        return;
      }

      // 팝업의 실제 제거는 AchievementToast가 담당한다.
      // 여기서 setAchievementEvent(null)을 직접 호출하면
      // 퇴장 애니메이션이 실행되기 전에 DOM이 사라진다.
      setAchievementEvent(item);
    };

    next();
  }, []);

  const clearAchievementEvent = useCallback(() => {
    // AchievementToast의 퇴장 애니메이션이 끝난 뒤 호출된다.
    setAchievementEvent(null);

    if (achievementQueueRef.current.length > 0) {
      window.setTimeout(() => {
        const next = achievementQueueRef.current.shift();

        if (next) {
          setAchievementEvent(next);
        } else {
          achievementShowingRef.current = false;
        }
      }, 250);
    } else {
      achievementShowingRef.current = false;
    }
  }, []);

  const claimAchievement = useCallback(async (id) => {
    const { data, error } = await supabase.rpc("claim_achievement", {
      p_achievement_id: id
    });
    if (error) {
      console.warn("Achievement claim failed:", id, error);
      return null;
    }
    if (data?.success) showAchievement(data);
    return data;
  }, [showAchievement]);

  const checkChessAchievements = useCallback(async (finalResult) => {
    await claimAchievement("first_chess");

    // Bot-specific first-win achievements remain limited to the selected AI.
    if (finalResult === "1-0") {
      const botWinAchievements = {
        talc: "chess_win_talc",
        sleep: "chess_win_sleeping",
        fur: "chess_win_fur",
        rockey: "chess_win_rockey",
        army: "chess_win_army",
        doronum: "chess_win_doronum",
        brilliant: "chess_win_brilliant"
      };
      const botAchievementId = botWinAchievements[currentBot];
      if (botAchievementId) await claimAchievement(botAchievementId);
    }

    const { user } = await getLoginIdAndProfile();
    if (!user) return;

    const [{ count: totalGames, error: totalError }, { count: totalWins, error: winsError }] = await Promise.all([
      supabase.from("chess_games").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("result", ["1-0", "0-1", "1/2-1/2"]),
      supabase.from("chess_games").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("result", "1-0")
    ]);

    if (totalError || winsError) {
      console.warn("Chess achievement progress lookup failed:", totalError || winsError);
      return;
    }

    const completed = Number(totalGames || 0);
    const wins = Number(totalWins || 0);
    const winMilestones = [
      [5, "chess_5_win"],
      [10, "chess_10_win"],
      [25, "chess_25_win"],
      [50, "chess_50_win"],
      [100, "chess_100_win"],
      [250, "chess_250_win"],
      [500, "chess_500_win"],
      [1000, "chess_1000_win"]
    ];
    const gameMilestones = [
      [100, "chess_play_100"],
      [500, "chess_play_500"]
    ];

    for (const [target, achievementId] of winMilestones) {
      if (wins >= target) await claimAchievement(achievementId);
    }
    for (const [target, achievementId] of gameMilestones) {
      if (completed >= target) await claimAchievement(achievementId);
    }
  }, [claimAchievement, currentBot]);

  const saveCompletedGame = useCallback(async (summary, finalResult) => {
    if (savedGameRef.current) return null;

    const { user, loginId } = await getLoginIdAndProfile();
    if (!user) {
      console.warn("[Rockey Chess] 로그인 세션이 없어 경기 기록을 저장하지 못했습니다.");
      return null;
    }

    // Mark the game saved only after the DB insert succeeds. Previously the guard
    // was set before the insert and a missing chess_games.login_id column caused
    // the result to be silently lost forever for this game.
    const { data, error } = await supabase.from("chess_games").insert({
      user_id: user.id,
      login_id: loginId || null,
      mode: "bot",
      bot_id: currentBot,
      result: finalResult,
      pgn: summary?.pgn || game.pgn(),
      accuracy: Number(summary?.accuracy || accuracy || 0),
      summary: { ...(summary || {}), result: finalResult, white: summary?.white || "Player" }
    }).select("id").single();

    if (error || !data?.id) {
      console.error("[Rockey Chess] 경기 기록 저장 실패. 업적 진행도는 저장된 경기 기록 기준이라 이번 경기를 반영할 수 없습니다.", error || "경기 ID가 반환되지 않았습니다.");
      return null;
    }

    savedGameRef.current = true;

    const reward = finalResult === "1-0" ? 100 : finalResult === "1/2-1/2" ? 40 : 15;
    const { data: coinData, error: coinError } = await supabase.rpc("award_rock_king_coin", { p_amount: reward, p_login_id: loginId || "" });
    if (coinError) {
      console.warn("[Rockey Chess] 경기 기록은 저장됐지만 도로늄 코인 보상 갱신에 실패했습니다.", coinError);
    } else if (coinData?.balance !== undefined) {
      setRockKingCoin(Number(coinData.balance));
    }

    return data.id;
  }, [accuracy, currentBot, game]);

  const analyzeGame = useCallback(async () => {
    if (!gameOver) return [];
    if (analysisTaskRef.current) return analysisTaskRef.current;
    if (analysisReady && analysisMoves.length) return analysisMoves;

    const pgn = gameSummary?.pgn || game.pgn({ newline: "\n" });
    if (!pgn) {
      setAnalysisError("이번 경기에서 읽을 수 있는 PGN 기보를 찾지 못했습니다.");
      return [];
    }

    const generation = analysisGenerationRef.current;
    const task = (async () => {
      setAnalysisBusy(true);
      setAnalysisError("");
      setAnalysisReady(false);
      setAnalysisProgress({ completed: 0, total: 0, currentMove: 0, percent: 0 });

      try {
        const replay = new Chess();
        replay.loadPgn(pgn);
        const history = replay.history({ verbose: true });
        if (!history.length) {
          throw new Error("경기에 분석할 수가 없습니다. 실제로 한 수 이상 진행한 뒤 분석해 주세요.");
        }

        const engine = analysisEngineRef.current;
        if (!engine || engine.destroyed) {
          throw new Error("Stockfish 엔진이 준비되지 않았습니다. 분석 창을 닫고 다시 시도해 주세요.");
        }

        if (!gameSummary?.pgn) {
          setGameSummary(prev => ({ ...prev, ...finalizeSummary(result), pgn }));
        }

        const analysis = [];
        const headers = replay.getHeaders();
        const replayGame = new Chess(headers.FEN || undefined);
        setAnalysisProgress({ completed: 0, total: history.length, currentMove: 1, percent: 0 });

        // Positions are evaluated once and reused by the preceding/following ply.
        let before = await getPositionAnalysis(replayGame.fen());

        for (let i = 0; i < history.length; i += 1) {
          if (generation !== analysisGenerationRef.current) return [];

          const move = history[i];
          const beforeFen = replayGame.fen();
          const beforeHistory = replayGame.history();
          const beforeGame = new Chess(beforeFen);
          replayGame.move({ from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) });
          const afterFen = replayGame.fen();
          const afterGame = new Chess(afterFen);

          if (!before) before = await getPositionAnalysis(beforeFen);
          const after = afterGame.isGameOver()
            ? null
            : await getPositionAnalysis(afterFen);
          if (generation !== analysisGenerationRef.current) return [];

          const beforeScore = positionEval(before, move.color, beforeGame);
          const afterScore = positionEval(after, move.color, afterGame);
          const cpl = afterGame.isCheckmate()
            ? 0
            : Math.max(0, beforeScore - afterScore);
          const bestMove = String(before.bestMove || "").toLowerCase();
          const secondGap = secondBestLoss(before, move.color, beforeScore);
          const isBest = uci(move) === bestMove;
          const quality = classifyMove(
            cpl,
            isBest,
            move,
            beforeGame,
            afterGame,
            {
              book: isBookMove(beforeHistory, move.san),
              secondCpl: secondGap
            }
          );

          const whiteEvaluation = positionEval(after, "w", afterGame);
          const mate = mateForPosition(after, afterGame);
          const evaluation = mate
            ? (mate.winner === "white" ? 10 : -10)
            : Number((whiteEvaluation / 100).toFixed(2));

          analysis.push({
            ply: i + 1,
            moveNumber: Math.ceil((i + 1) / 2),
            san: move.san,
            uci: uci(move),
            quality,
            cpl: Number(cpl.toFixed(1)),
            accuracy: accuracyFromCpl(cpl),
            bestMove,
            evaluation,
            mate,
            side: move.color === "w" ? "player" : "bot"
          });

          before = after;

          const completed = i + 1;
          setAnalysisProgress({
            completed,
            total: history.length,
            currentMove: Math.ceil(completed / 2),
            percent: Math.round((completed / history.length) * 100)
          });
        }

        if (generation !== analysisGenerationRef.current) return [];

        setAnalysisMoves(analysis);
        const playerOnly = analysis.filter(move => move.side === "player");
        const playerAccuracy = playerOnly.length
          ? playerOnly.reduce((sum, move) => sum + move.accuracy, 0) / playerOnly.length
          : 100;
        setAccuracy(Number(playerAccuracy.toFixed(1)));

        const stats = emptyStats();
        playerOnly.forEach(move => {
          stats[move.quality] = (stats[move.quality] || 0) + 1;
        });
        setMoveStats(stats);
        statsRef.current = stats;
        setAnalysisReady(true);
        setLastAnalysis(analysis[analysis.length - 1] || null);
        setAnalysisProgress({
          completed: history.length,
          total: history.length,
          currentMove: Math.ceil(history.length / 2),
          percent: 100
        });
        return analysis;
      } catch (error) {
        if (generation === analysisGenerationRef.current) {
          console.warn("Full game analysis failed:", error);
          setAnalysisError(error?.message || "분석 중 알 수 없는 오류가 발생했습니다.");
          setAnalysisReady(false);
        }
        return [];
      } finally {
        if (generation === analysisGenerationRef.current) setAnalysisBusy(false);
      }
    })();

    analysisTaskRef.current = task;
    try {
      return await task;
    } finally {
      if (analysisTaskRef.current === task) analysisTaskRef.current = null;
    }
  }, [analysisMoves, analysisReady, finalizeSummary, game, gameOver, gameSummary, result, getPositionAnalysis]);

  const openAnalysis = useCallback(() => {
    if (!gameOver) return Promise.resolve([]);
    setAnalysisOpen(true);
    if (analysisReady && analysisMoves.length) return Promise.resolve(analysisMoves);
    return analyzeGame();
  }, [analysisMoves, analysisReady, analyzeGame, gameOver]);

  useEffect(() => {
    if (
      !gameOver ||
      ratingSavedRef.current ||
      !["1-0", "0-1", "1/2-1/2"].includes(result)
    ) {
      return;
    }

    const won = result === "1-0";
    const draw = result === "1/2-1/2";
    const opponentRating = botRating[currentBot] || 0;
    const playerRating = Number(rating);
    const ratingGain = Math.max(1, getRatingGain(opponentRating, playerRating));
    const ratingLoss = getRatingLoss(opponentRating, playerRating);
    const change = won
      ? ratingGain
      : draw
        ? -Math.max(1, Math.floor(ratingLoss / 4))
        : -Math.max(10, Math.round(ratingLoss * 1.3));

    // 저장 실패를 조용히 무시하지 않고 원인을 로그에 남긴다.
    saveRating(change).then(saved => {
      if (!saved) {
        console.error("[Rockey Chess] 경기 결과는 확정됐지만 레이팅 저장에 실패했습니다. Supabase 인증/RLS/네트워크를 확인해 주세요.");
      }
    });

    const summary = finalizeSummary(result);
    setGameSummary(summary);
    saveCompletedGame(summary, result).then(savedGameId => {
      if (!savedGameId) {
        console.warn("[Rockey Chess] 저장된 경기 ID가 없으므로 업적 달성 판정을 건너뜁니다.");
        return;
      }
      return checkChessAchievements(result);
    });
  }, [
    gameOver,
    result,
    currentBot,
    rating,
    saveRating,
    finalizeSummary,
    saveCompletedGame,
    checkChessAchievements
  ]);

  /*
   * =====================================================
   * PLAYER MOVE
   * =====================================================
   */
  const makeMove = useCallback(
    async (
      from,
      to,
      promotion = undefined
    ) => {
      if (
        gameOver ||
        isThinking ||
        game.turn() !== "w"
      ) {
        return false;
      }

      const beforeFen =
        game.fen();

      let move;

      try {
        move = game.move({
          from,
          to,
          ...(promotion
            ? { promotion }
            : {})
        });
      } catch {
        return false;
      }

      if (!move) return false;

      setSelected(null);
      setMoves([]);

      setLastMove(move);
      setHistory(game.history());

      moveHistoryRef.current =
        game.history();

      setMoveAnimations([
        {
          id: `${Date.now()}-${from}-${to}`,
          from,
          to,
          piece: `${move.color}${move.piece.toUpperCase()}`
        }
      ]);

      refreshCaptured();
      sync();

      /*
       * =================================================
       * SPECIAL PLAYER MOVE DIALOG
       * =================================================
       */

      if (
        move.isKingsideCastle() ||
        move.isQueensideCastle()
      ) {
        say("castle", currentBot, {
          force: true
        });
      }

      if (
        move.piece === "p" &&
        move.promotion
      ) {
        say(
          "promotion",
          currentBot,
          {
            force: true
          }
        );
      }

      /*
       * capture / normal
       */
      if (
        !move.isKingsideCastle() &&
        !move.isQueensideCastle() &&
        !move.promotion
      ) {
        if (move.captured) {
          say("normal", currentBot);
        }
      }

      playSound(
        move.captured
          ? "capture"
          : move.isKingsideCastle() || move.isQueensideCastle()
            ? "castle"
            : move.promotion
              ? "promotion"
              : "move",
        move.promotion || move.piece
      );

      setPromotionData(null);

      await analyzePlayerMove(
        beforeFen,
        game.fen(),
        move
      );

      /*
       * 플레이어가 체크를 했다면
       */
      if (game.isCheck()) {
        playSound("check", move.promotion || move.piece);
        say("check", currentBot, {
          force: true
        });
      }

      if (updateOutcome()) {
        return true;
      }

      /*
       * =================================================
       * AI THINKING
       * =================================================
       */

      setIsThinking(true);

      say("thinking", currentBot);

      const myGame =
        gameIdRef.current;

      const fen =
        game.fen();

      try {
        const delay =
          80 +
          Math.random() * 2000;

        await new Promise(
          r => setTimeout(r, delay)
        );

        if (
          myGame !==
            gameIdRef.current ||
          gameOver ||
          game.turn() !== "b"
        ) {
          return true;
        }

        const answer =
          await requestMove(
            engineRef.current,
            currentBot,
            fen
          );

        if (
          myGame !==
            gameIdRef.current ||
          game.fen() !== fen ||
          game.turn() !== "b"
        ) {
          return true;
        }

        if (
          !answer?.bestMove ||
          answer.bestMove === "(none)"
        ) {
          setIsThinking(false);
          updateOutcome();
          return true;
        }

        const bm =
          answer.bestMove;

        const aiMove =
          game.move({
            from: bm.slice(0, 2),
            to: bm.slice(2, 4),
            promotion:
              bm[4] || undefined
          });

        if (aiMove) {
          setLastMove(aiMove);

          setHistory(
            game.history()
          );

          moveHistoryRef.current =
            game.history();

          setMoveAnimations([
            {
              id: `${Date.now()}-${aiMove.from}-${aiMove.to}`,
              from: aiMove.from,
              to: aiMove.to,
              piece: `${aiMove.color}${aiMove.piece.toUpperCase()}`
            }
          ]);

          refreshCaptured();
          sync();

          /*
           * =================================================
           * AI SPECIAL DIALOG
           * =================================================
           */

          if (
            aiMove.isKingsideCastle() ||
            aiMove.isQueensideCastle()
          ) {
            say(
              "castle",
              currentBot,
              {
                force: true
              }
            );
          }

          if (
            aiMove.piece === "p" &&
            aiMove.promotion
          ) {
            say(
              "promotion",
              currentBot,
              {
                force: true
              }
            );
          }

          /*
           * AI가 체크
           */
          if (game.isCheck()) {
            playSound("check", aiMove.promotion || aiMove.piece);
            say(
              "check",
              currentBot,
              {
                force: true
              }
            );
          }

          /*
           * AI가 잡았다면 일반 대사
           */
          if (
            aiMove.captured &&
            !game.isCheck()
          ) {
            say("normal", currentBot);
          }

          playSound(
            aiMove.captured
              ? "capture"
              : aiMove.isKingsideCastle() || aiMove.isQueensideCastle()
                ? "castle"
                : aiMove.promotion
                  ? "promotion"
                  : "move",
            aiMove.promotion || aiMove.piece
          );

          // 봇의 수 역시 동일한 기준으로 분석하여
          // botBest / botGreat / botBrilliant 등의 대사를 선택한다.
          await analyzeBotMove(fen, game.fen(), aiMove);
        }
      } catch (e) {
        console.error(
          "AI move error",
          e
        );
      }

      setIsThinking(false);

      /*
       * AI 체크메이트 / 게임 종료
       */
      updateOutcome();

      return true;
    },
    [
      analyzePlayerMove,
      analyzeBotMove,
      currentBot,
      game,
      gameOver,
      isThinking,
      playSound,
      refreshCaptured,
      say,
      sync,
      updateOutcome
    ]
  );

  const selectSquare = useCallback(
    square => {
      if (
        gameOver ||
        isThinking ||
        game.turn() !== "w"
      ) {
        return;
      }

      const piece =
        game.get(square);

      if (selected) {
        if (
          moves.includes(square)
        ) {
          const moving =
            game.get(selected);

          if (
            moving?.type === "p" &&
            Number(square[1]) === 8
          ) {
            setPromotionData({
              from: selected,
              to: square
            });

            return;
          }

          makeMove(
            selected,
            square
          );

          return;
        }

        if (
          piece?.color === "w"
        ) {
          setSelected(square);
          setMoves(
            getLegalMoves(square)
          );

          playSound("click");

          return;
        }

        setSelected(null);
        setMoves([]);

        return;
      }

      if (piece?.color === "w") {
        setSelected(square);

        setMoves(
          getLegalMoves(square)
        );

        playSound("click");
      }
    },
    [
      game,
      gameOver,
      getLegalMoves,
      isThinking,
      makeMove,
      moves,
      playSound,
      selected
    ]
  );

  const clickSquare = selectSquare;

  const clearSelection = useCallback(() => {
    setSelected(null);
    setMoves([]);
    setPromotionData(null);
  }, []);

  const cancelPromotion = useCallback(() => {
    setPromotionData(null);
  }, []);

  const dragMove = useCallback(
    (from, to) => {
      if (
        gameOver ||
        isThinking ||
        game.turn() !== "w"
      ) {
        return;
      }

      const legal =
        getLegalMoves(from);

      if (!legal.includes(to)) {
        return;
      }

      const moving =
        game.get(from);

      if (
        moving?.type === "p" &&
        Number(to[1]) === 8
      ) {
        setPromotionData({
          from,
          to
        });

        return;
      }

      makeMove(from, to);
    },
    [
      game,
      gameOver,
      getLegalMoves,
      isThinking,
      makeMove
    ]
  );

  const choosePromotion =
    useCallback(
      promotion => {
        if (!promotionData) return;

        const {
          from,
          to
        } = promotionData;

        makeMove(
          from,
          to,
          promotion
        );
      },
      [
        makeMove,
        promotionData
      ]
    );

  const undoMove =
    useCallback(async () => {
      if (gameOver) return;

      gameIdRef.current++;

      engineRef.current?.stop();

      setIsThinking(false);

      if (
        game.history().length >= 2
      ) {
        game.undo();
        game.undo();
      } else if (
        game.history().length === 1
      ) {
        game.undo();
      }

      setSelected(null);
      setMoves([]);
      setPromotionData(null);
      setLastMove(null);

      setHistory(
        game.history()
      );

      statsRef.current =
        emptyStats();

      setMoveStats({
        ...statsRef.current
      });

      playerAccuraciesRef.current = [];

      setAnalysisMoves([]);
      setCurrentEvaluation(0);
      setLastAnalysis(null);

      setAccuracy(100);

      refreshCaptured();
      sync();

      say("normal", currentBot, {
        force: true
      });
    }, [
      currentBot,
      game,
      gameOver,
      refreshCaptured,
      say,
      sync
    ]);

  const resetGame =
    useCallback((nextBot = currentBot) => {
      if (!gameOver && game.history().length > 0) {
        return;
      }

      gameIdRef.current++;
      analysisGenerationRef.current += 1;
      analysisTaskRef.current = null;
      setAnalysisBusy(false);
      setAnalysisError("");
      setAnalysisProgress({ completed: 0, total: 0, currentMove: 0, percent: 0 });

      engineRef.current?.stop();
      analysisEngineRef.current?.stop();

      game.reset();

      setPosition(game.fen());
      setTurn("w");

      setSelected(null);
      setMoves([]);

      setHistory([]);
      setLastMove(null);

      setGameOver(false);
      setWinner("");
      setResult("*");

      setPromotionData(null);

      setCapturedWhite([]);
      setCapturedBlack([]);

      setAccuracy(100);

      statsRef.current =
        emptyStats();

      setMoveStats({
        ...statsRef.current
      });

      playerAccuraciesRef.current =
        [];

      setMoveAnimations([]);

      setAnalysisMoves([]);
      setCurrentEvaluation(0);
      setLastAnalysis(null);

      setRatingChange(0);
      setShowRatingChange(false);

      setGameSummary({});

      setDialog("");

      lastDialogRef.current = "";

      if (dialogTimerRef.current) {
        clearTimeout(
          dialogTimerRef.current
        );
      }

      ratingSavedRef.current = false;
      ratingSaveInFlightRef.current = false;
      positionAnalysisCacheRef.current.clear();
      savedGameRef.current = false;
      setAnalysisReady(false);
      setAnalysisOpen(false);
      setAnalysisError("");
      setAnalysisProgress({ completed: 0, total: 0, currentMove: 0, percent: 0 });

      startTimeRef.current =
        Date.now();

      playSound("start");

      setTimeout(() => {
        if (mountedRef.current) {
          say(
            "starting",
            currentBot,
            {
              force: true
            }
          );
        }
      }, 400);
    }, [
      currentBot,
      game,
      gameOver,
      playSound,
      say
    ]);

  const setBot = useCallback(
    bot => {
      if (!botData[bot]) return;
      if (!gameOver && game.history().length > 0) return;

      setCurrentBot(bot);
      resetGame(bot);
    },
    [game, gameOver, resetGame]
  );

  const resign = useCallback(() => {
    if (gameOver) return;

    gameIdRef.current++;

    engineRef.current?.stop();

    setIsThinking(false);

    setGameOver(true);
    setWinner("Black");
    setResult("0-1");
    playSound("loss");

    say(
      "botwin",
      currentBot,
      {
        force: true,
        duration: 4000
      }
    );

    setGameSummary(
      finalizeSummary("0-1")
    );
  }, [
    currentBot,
    finalizeSummary,
    gameOver,
    playSound,
    say
  ]);

  const offerDraw =
    useCallback(() => {
      if (gameOver) return;

      gameIdRef.current++;

      engineRef.current?.stop();

      setIsThinking(false);

      setGameOver(true);
      setWinner("Draw");
      setResult("1/2-1/2");

      playSound("draw");
    say(
        "stalemate",
        currentBot,
        {
          force: true
        }
      );

      setGameSummary(
        finalizeSummary(
          "1/2-1/2"
        )
      );
    }, [
      currentBot,
      finalizeSummary,
      gameOver,
      playSound,
      say
    ]);

  const downloadPGN =
    useCallback(
      summary => {
        const pgn =
          summary?.pgn ||
          game.pgn({
            newline: "\n"
          });

        const blob =
          new Blob(
            [pgn],
            {
              type:
                "application/x-chess-pgn"
            }
          );

        const url =
          URL.createObjectURL(
            blob
          );

        const a =
          document.createElement(
            "a"
          );

        a.href = url;

        a.download =
          `doldol-chess-${new Date()
            .toISOString()
            .slice(0, 10)}.pgn`;

        document.body.appendChild(a);
        a.click();
        a.remove();

        // Let the browser start consuming the Blob before releasing its URL.
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      [game]
    );

  const checkSquare =
    (() => {
      if (!game.isCheck()) {
        return null;
      }

      const color =
        game.turn();

      const board =
        game.board();

      for (
        let r = 0;
        r < 8;
        r++
      ) {
        for (
          let c = 0;
          c < 8;
          c++
        ) {
          const p =
            board[r][c];

          if (
            p?.type === "k" &&
            p.color === color
          ) {
            return `${String.fromCharCode(
              97 + c
            )}${8 - r}`;
          }
        }
      }

      return null;
    })();

  const gameSummaryLive =
    gameSummary &&
    Object.keys(gameSummary).length
      ? gameSummary
      : finalizeSummary(result);

  return {
    game,
    position,
    turn,
    selected,
    moves,
    history,
    lastMove,

    gameOver,
    winner,
    result,

    matchLocked: !gameOver && game.history().length > 0,

    currentBot,
    playerProfile,
    doldolcoin,
    rockKingCoin,
    analysisReady,
    analysisOpen,
    setAnalysisOpen,
    analysisBusy,
    analysisError,
    analysisProgress,
    openAnalysis,
    analyzeGame,

    achievementEvent,
    clearAchievementEvent,

    rating,
    ratingChange,
    showRatingChange,

    /*
     * 대화
     */
    dialog,
    dialogKey,
    say,

    isThinking,

    promotionData,

    capturedWhite,
    capturedBlack,

    accuracy,
    moveStats,
    analysisMoves,
    currentEvaluation,
    lastAnalysis,

    moveAnimations,

    gameSummary:
      gameSummaryLive,

    materialScore,

    inCheck:
      game.isCheck(),

    checkSquare,

    clickSquare,
    selectSquare,
    clearSelection,
    dragMove,

    choosePromotion,
    cancelPromotion,

    makeMove,
    undoMove,
    resetGame,
    setBot,

    resign,
    offerDraw,

    downloadPGN,

    botRating:
      botRating[currentBot] || 0,

    playerColor: "w",
    aiColor: "b"
  };
}