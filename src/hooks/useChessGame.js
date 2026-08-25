import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { supabase } from "../supabase";
import StockfishEngine from "../ai/StockfishEngine";
import { requestMove } from "./EngineController";
import botData from "../data/botData";
import { dialogs } from "../data/chessDialog";

const START_FEN = new Chess().fen();

const ratingReward = {
  talc: 60,
  sleep: 100,
  fur: 375,
  rockey: 500,
  army: 1000,
  doronum: 2500,
  brilliant: 3000
};

const botRating = {
  talc: 400,
  sleep: 600,
  fur: 900,
  rockey: 1200,
  army: 1600,
  doronum: 2000,
  brilliant: 2800
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
  "miss"
];

const emptyStats = () =>
  Object.fromEntries(STAT_KEYS.map(k => [k, 0]));

const uci = m =>
  m ? `${m.from}${m.to}${m.promotion || ""}`.toLowerCase() : "";

const clamp = (n, a, b) =>
  Math.max(a, Math.min(b, n));


function classifyMove(cpl, isBest, move, beforeGame, afterGame, beforeResult, afterResult) {
  const loss = Number.isFinite(cpl) ? Math.max(0, cpl) : 9999;
  const pieceValue = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const movedValue = pieceValue[move?.piece] ?? 0;
  const capturedValue = pieceValue[move?.captured] ?? 0;

  const givesCheck = Boolean(move?.san?.includes("+") || move?.san?.includes("#"));
  const isCapture = Boolean(move?.captured);
  const exchangeSacrifice =
    isCapture &&
    movedValue >= 3 &&
    movedValue - capturedValue >= 2 &&
    loss <= 20;

  const tactical = givesCheck || isCapture || exchangeSacrifice;

  // Approximation of chess.com's labels using engine CPL + tactical context.
  // Brilliant is intentionally rare.
  if (
    loss <= 10 &&
    tactical &&
    (exchangeSacrifice || givesCheck || movedValue >= 3)
  ) return "brilliant";

  if (loss <= 10 && isBest) return "best";
  if (loss <= 25 && tactical) return "great";
  if (loss <= 35) return "excellent";
  if (loss <= 70) return "good";
  if (loss <= 120) return "inaccuracy";
  if (loss <= 220) return "mistake";
  if (loss <= 400) return "blunder";
  return "miss";
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

export default function useChessGame() {
  const gameRef = useRef(null);

  if (!gameRef.current) {
    gameRef.current = new Chess();
  }

    const [currentBot, setCurrentBot] =
    useState("talc");

  const game = gameRef.current;

  const engineRef = useRef(null);
  const analysisEngineRef = useRef(null);

  const mountedRef = useRef(true);
  const gameIdRef = useRef(0);

  const startTimeRef = useRef(Date.now());

  const playerAccuraciesRef = useRef([]);
  const statsRef = useRef(emptyStats());
  const moveHistoryRef = useRef([]);

  const ratingSavedRef = useRef(false);

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

  const playSound = useCallback(name => {
    try {
      const a = new Audio(
        `${import.meta.env.BASE_URL}sounds/${name}.mp3`
      );

      a.volume = 0.65;

      a.play().catch(() => {});
    } catch {}
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
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (
        !user ||
        !mountedRef.current
      ) {
        return;
      }

      const { data } =
        await supabase
          .from("users")
          .select("chess_rating")
          .eq("login_id", loginId);
          .maybeSingle();

      if (
        data &&
        Number.isFinite(
          Number(data.chess_rating)
        )
      ) {
        setRating(
          Number(data.chess_rating)
        );
      }
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

      playSound("checkmate");

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
        const before =
          await analysisEngineRef.current.analyzePosition(beforeFen, 14);

        const after =
          await analysisEngineRef.current.analyzePosition(afterFen, 14);

        const beforeScore = playerEval(before, move.color);
        const afterScore = playerEval(after, move.color);
        const cpl = Math.max(0, beforeScore - afterScore);
        const acc = accuracyFromCpl(cpl);

        const bestMove = String(before.bestMove || "").toLowerCase();
        const playedMove = uci(move);
        const isBest = playedMove === bestMove;

        const beforeGame = new Chess(beforeFen);
        const afterGame = new Chess(afterFen);

        let quality = classifyMove(
          cpl,
          isBest,
          move,
          beforeGame,
          afterGame,
          before,
          after
        );

        if (isBest && quality !== "brilliant") quality = "best";

        statsRef.current[quality] =
          (statsRef.current[quality] || 0) + 1;

        setMoveStats({ ...statsRef.current });

        playerAccuraciesRef.current.push(acc);

        const overall =
          playerAccuraciesRef.current.reduce((a, b) => a + b, 0) /
          playerAccuraciesRef.current.length;

        setAccuracy(Number(overall.toFixed(1)));

        const evalAfter =
          after.mate !== null && after.mate !== undefined
            ? Number(after.mate) > 0 ? 100 : -100
            : playerEval(after, move.color) / 100;

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
    [sayAnalysis, game]
  );

  const analyzeBotMove = useCallback(
    async (beforeFen, afterFen, move) => {
      if (!analysisEngineRef.current || !move) return;

      try {
        const before =
          await analysisEngineRef.current.analyzePosition(beforeFen, 12);

        const after =
          await analysisEngineRef.current.analyzePosition(afterFen, 12);

        const beforeScore = playerEval(before, "b");
        const afterScore = playerEval(after, "b");
        const cpl = Math.max(0, beforeScore - afterScore);

        const bestMove = String(before.bestMove || "").toLowerCase();
        const isBest = uci(move) === bestMove;

        const quality = isBest
          ? "best"
          : classifyMove(
              cpl,
              isBest,
              move,
              new Chess(beforeFen),
              new Chess(afterFen),
              before,
              after
            );

        const entry = {
          ply: game.history().length,
          moveNumber: Math.ceil(game.history().length / 2),
          san: move.san,
          uci: uci(move),
          quality,
          cpl: Number(cpl.toFixed(1)),
          accuracy: accuracyFromCpl(cpl),
          bestMove,
          evaluation: Number((playerEval(after, "w") / 100).toFixed(2)),
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
    [game, sayAnalysis]
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
        !change
      ) {
        return;
      }

      ratingSavedRef.current = true;

      const next = Math.max(
        0,
        rating + change
      );

      setRating(next);
      setRatingChange(change);
      setShowRatingChange(true);

      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from("users")
          .update({
            chess_rating: next
          })
          .eq("login_id", loginId);
      }
    },
    [rating]
  );

  useEffect(() => {
    if (
      !gameOver ||
      ratingSavedRef.current
    ) {
      return;
    }

    const won =
      result === "1-0";

    const draw =
      result === "1/2-1/2";

    const change = won
      ? ratingReward[currentBot] || 0
      : draw
        ? Math.floor(
            (ratingReward[currentBot] || 0) /
              4
          )
        : -Math.max(
            5,
            Math.floor(
              (ratingReward[currentBot] || 0) /
                10
            )
          );

    saveRating(change);

    setGameSummary(
      finalizeSummary(result)
    );
  }, [
    gameOver,
    result,
    currentBot,
    saveRating,
    finalizeSummary
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
          : move.isKingsideCastle() ||
              move.isQueensideCastle()
            ? "castle"
            : "move"
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
              : aiMove.isKingsideCastle() ||
                  aiMove.isQueensideCastle()
                ? "castle"
                : "move"
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

  const clickSquare =
    selectSquare;

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

      engineRef.current?.stop();

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

      ratingSavedRef.current =
        false;

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

        a.click();

        URL.revokeObjectURL(url);
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
    dragMove,

    choosePromotion,

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