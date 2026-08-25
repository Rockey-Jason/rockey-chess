import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { supabase } from "../supabase";
import StockfishEngine from "../ai/StockfishEngine";
import { requestMove } from "./EngineController";
import botData from "../data/botData";
import { dialogs } from "../data/chessDialog";

/* =========================================================
   CONSTANTS
========================================================= */

const START_FEN = new Chess().fen();

const ratingReward = {
  talc: 60,
  sleep: 100,
  fur: 375,
  rockey: 500,
  army: 1000,
  doronum: 2500,
  brilliant: 3000,
};

const botRating = {
  talc: 400,
  sleep: 600,
  fur: 900,
  rockey: 1200,
  army: 1600,
  doronum: 2000,
  brilliant: 2800,
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
];

const emptyStats = () =>
  Object.fromEntries(STAT_KEYS.map((key) => [key, 0]));

/* =========================================================
   HELPERS
========================================================= */

const uci = (move) =>
  move
    ? `${move.from}${move.to}${move.promotion || ""}`.toLowerCase()
    : "";

const clamp = (number, min, max) =>
  Math.max(min, Math.min(max, number));

/*
 * Supabase users.login_id는 문자열이다.
 *
 * 현재 Auth metadata에서는 user_id에 로그인 ID가
 * 들어가는 구조를 우선 사용한다.
 *
 * 예:
 * user.user_metadata.user_id
 *
 * 혹시 예전 계정처럼 login_id가 metadata에 직접
 * 저장되어 있는 경우도 대응한다.
 */
const getLoginId = (user) => {
  if (!user) return null;

  return (
    user.user_metadata?.user_id ||
    user.user_metadata?.login_id ||
    null
  );
};

/* =========================================================
   MOVE CLASSIFICATION
========================================================= */

function classifyMove(
  cpl,
  isBest,
  move,
  beforeGame,
  afterGame,
  beforeResult,
  afterResult
) {
  const loss = Number.isFinite(cpl)
    ? Math.max(0, cpl)
    : 9999;

  const pieceValue = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 0,
  };

  const movedValue =
    pieceValue[move?.piece] ?? 0;

  const capturedValue =
    pieceValue[move?.captured] ?? 0;

  const givesCheck = Boolean(
    move?.san?.includes("+") ||
      move?.san?.includes("#")
  );

  const isCapture = Boolean(move?.captured);

  /*
   * 단순한 희생보다는 실제 교환 희생에 가까운 경우.
   */
  const exchangeSacrifice =
    isCapture &&
    movedValue >= 3 &&
    capturedValue <= 1 &&
    loss <= 20;

  const tactical =
    givesCheck ||
    isCapture ||
    exchangeSacrifice;

  /*
   * Brilliant
   *
   * chess.com의 실제 내부 알고리즘과 동일하지는 않지만
   * engine CPL + 전술적 상황을 이용해 최대한 비슷하게
   * 동작하도록 구성.
   */
  if (
    loss <= 10 &&
    tactical &&
    (
      exchangeSacrifice ||
      givesCheck ||
      movedValue >= 3
    )
  ) {
    return "brilliant";
  }

  if (loss <= 10 && isBest) {
    return "best";
  }

  if (loss <= 25 && tactical) {
    return "great";
  }

  if (loss <= 35) {
    return "excellent";
  }

  if (loss <= 70) {
    return "good";
  }

  if (loss <= 120) {
    return "inaccuracy";
  }

  if (loss <= 220) {
    return "mistake";
  }

  if (loss <= 400) {
    return "blunder";
  }

  return "miss";
}

/* =========================================================
   ACCURACY
========================================================= */

function accuracyFromCpl(cpl) {
  if (!Number.isFinite(cpl) || cpl <= 0) {
    return 100;
  }

  return Number(
    clamp(
      100 * Math.exp(-cpl / 300),
      0,
      100
    ).toFixed(1)
  );
}

/* =========================================================
   ENGINE SCORE
========================================================= */

function playerEval(result, color) {
  if (!result) {
    return 0;
  }

  /*
   * mate
   */
  if (
    result.mate !== null &&
    result.mate !== undefined
  ) {
    const mateValue =
      Number(result.mate) > 0
        ? 100000
        : -100000;

    return result.sideToMove === color
      ? mateValue
      : -mateValue;
  }

  /*
   * centipawn
   */
  const cp = Number(result.score || 0);

  return result.sideToMove === color
    ? cp
    : -cp;
}

/* =========================================================
   MAIN HOOK
========================================================= */

export default function useChessGame() {
  /* =======================================================
     GAME INSTANCE
  ======================================================= */

  const gameRef = useRef(null);

  if (!gameRef.current) {
    gameRef.current = new Chess();
  }

  const game = gameRef.current;

  /* =======================================================
     BOT
  ======================================================= */

  const [currentBot, setCurrentBot] =
    useState("talc");

  /* =======================================================
     ENGINES
  ======================================================= */

  const engineRef = useRef(null);
  const analysisEngineRef = useRef(null);

  /* =======================================================
     LIFECYCLE
  ======================================================= */

  const mountedRef = useRef(true);

  const gameIdRef = useRef(0);

  const startTimeRef = useRef(
    Date.now()
  );

  /* =======================================================
     ANALYSIS
  ======================================================= */

  const playerAccuraciesRef =
    useRef([]);

  const statsRef = useRef(
    emptyStats()
  );

  const moveHistoryRef =
    useRef([]);

  /* =======================================================
     RATING
  ======================================================= */

  const ratingSavedRef =
    useRef(false);

  /* =======================================================
     DIALOG SYSTEM
  ======================================================= */

  const lastDialogRef =
    useRef("");

  const dialogTimerRef =
    useRef(null);

  const dialogCooldownRef =
    useRef(0);

  const [dialog, setDialog] =
    useState("");

  const [dialogKey, setDialogKey] =
    useState(0);

  const getDialogCharacter =
    useCallback((bot) => {
      if (bot === "army") {
        return "rockeyArmy";
      }

      return bot;
    }, []);

  const say = useCallback(
    (
      type = "normal",
      character,
      options = {}
    ) => {
      const selectedCharacter =
        character || currentBot;

      const actualCharacter =
        getDialogCharacter(
          selectedCharacter
        );

      const characterDialogs =
        dialogs[actualCharacter];

      if (!characterDialogs) {
        return;
      }

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

      /*
       * 대사 연속 출력 방지
       */
      if (
        !options.force &&
        type !== "starting" &&
        now -
          dialogCooldownRef.current <
          900
      ) {
        return;
      }

      let candidates = list;

      /*
       * 같은 대사 연속 방지
       */
      if (list.length > 1) {
        const filtered =
          list.filter(
            (text) =>
              text !==
              lastDialogRef.current
          );

        if (filtered.length > 0) {
          candidates = filtered;
        }
      }

      const selected =
        candidates[
          Math.floor(
            Math.random() *
              candidates.length
          )
        ];

      if (!selected) {
        return;
      }

      lastDialogRef.current =
        selected;

      dialogCooldownRef.current =
        now;

      /*
       * 기존 대사 제거
       */
      setDialog("");

      /*
       * 타이핑/등장 애니메이션 재실행용 key
       */
      setDialogKey(
        (prev) => prev + 1
      );

      requestAnimationFrame(() => {
        if (!mountedRef.current) {
          return;
        }

        setDialog(selected);
      });

      /*
       * 이전 타이머 제거
       */
      if (dialogTimerRef.current) {
        clearTimeout(
          dialogTimerRef.current
        );
      }

      /*
       * 글자 수에 따라 자연스럽게 유지
       */
      const duration =
        options.duration ||
        Math.max(
          2800,
          Math.min(
            9000,
            Array.from(selected)
              .length *
              38 +
              1400
          )
        );

      dialogTimerRef.current =
        setTimeout(() => {
          if (
            !mountedRef.current
          ) {
            return;
          }

          setDialog("");
        }, duration);
    },
    [
      currentBot,
      getDialogCharacter,
    ]
  );

  /* =======================================================
     ANALYSIS DIALOG
  ======================================================= */

  const sayAnalysis =
    useCallback(
      (quality, speaker) => {
        const prefix =
          speaker === "bot"
            ? "bot"
            : "other";

        const type =
          `${prefix}${quality
            .charAt(0)
            .toUpperCase()}${quality.slice(
            1
          )}`;

        say(type);
      },
      [say]
    );

  /* =======================================================
     GAME STATE
  ======================================================= */

  const [position, setPosition] =
    useState(game.fen());

  const [turn, setTurn] =
    useState(game.turn());

  const [selected, setSelected] =
    useState(null);

  const [moves, setMoves] =
    useState([]);

  const [history, setHistory] =
    useState([]);

  const [lastMove, setLastMove] =
    useState(null);

  const [gameOver, setGameOver] =
    useState(false);

  const [winner, setWinner] =
    useState("");

  const [result, setResult] =
    useState("*");

  /* =======================================================
     RATING STATE
  ======================================================= */

  const [rating, setRating] =
    useState(0);

  const [ratingChange, setRatingChange] =
    useState(0);

  const [
    showRatingChange,
    setShowRatingChange,
  ] = useState(false);

  /* =======================================================
     UI STATE
  ======================================================= */

  const [isThinking, setIsThinking] =
    useState(false);

  const [
    promotionData,
    setPromotionData,
  ] = useState(null);

  const [
    capturedWhite,
    setCapturedWhite,
  ] = useState([]);

  const [
    capturedBlack,
    setCapturedBlack,
  ] = useState([]);

  /* =======================================================
     ANALYSIS STATE
  ======================================================= */

  const [accuracy, setAccuracy] =
    useState(100);

  const [moveStats, setMoveStats] =
    useState(emptyStats());

  const [
    analysisMoves,
    setAnalysisMoves,
  ] = useState([]);

  const [
    currentEvaluation,
    setCurrentEvaluation,
  ] = useState(0);

  const [
    lastAnalysis,
    setLastAnalysis,
  ] = useState(null);

  /* =======================================================
     ANIMATION
  ======================================================= */

  const [
    moveAnimations,
    setMoveAnimations,
  ] = useState([]);

  /* =======================================================
     SUMMARY
  ======================================================= */

  const [
    gameSummary,
    setGameSummary,
  ] = useState({});

  /* =======================================================
     SYNC
  ======================================================= */

  const sync = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }

    setPosition(game.fen());
    setTurn(game.turn());
  }, [game]);

  /* =======================================================
     SOUND
  ======================================================= */

  const playSound = useCallback(
    (name) => {
      try {
        const audio =
          new Audio(
            `${import.meta.env.BASE_URL}sounds/${name}.mp3`
          );

        audio.volume = 0.65;

        audio
          .play()
          .catch(() => {});
      } catch {
        // 브라우저 오디오 오류 무시
      }
    },
    []
  );

  /* =======================================================
     INITIALIZATION
  ======================================================= */

  useEffect(() => {
    mountedRef.current = true;

    /*
     * 이전 엔진이 있다면 정리
     */
    engineRef.current?.terminate();
    analysisEngineRef.current?.terminate();

    engineRef.current =
      new StockfishEngine();

    analysisEngineRef.current =
      new StockfishEngine();

    let startingTimer = null;

    const loadRating = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } =
          await supabase.auth.getUser();

        if (
          authError ||
          !user ||
          !mountedRef.current
        ) {
          return;
        }

        const loginId =
          getLoginId(user);

        if (!loginId) {
          console.warn(
            "로그인 ID를 찾을 수 없습니다."
          );

          return;
        }

        const { data, error } =
          await supabase
            .from("users")
            .select("chess_rating")
            .eq(
              "login_id",
              String(loginId)
            )
            .maybeSingle();

        if (error) {
          console.warn(
            "체스 레이팅 불러오기 실패:",
            error
          );

          return;
        }

        if (
          data &&
          Number.isFinite(
            Number(
              data.chess_rating
            )
          )
        ) {
          setRating(
            Number(
              data.chess_rating
            )
          );
        }
      } catch (error) {
        console.warn(
          "Rating load error:",
          error
        );
      }
    };

    loadRating();

    /*
     * 게임 시작 효과음
     */
    playSound("start");

    /*
     * 게임 시작 대사
     */
    startingTimer =
      setTimeout(() => {
        if (
          mountedRef.current
        ) {
          say(
            "starting",
            currentBot,
            {
              force: true,
            }
          );
        }
      }, 500);

    return () => {
      mountedRef.current =
        false;

      if (startingTimer) {
        clearTimeout(
          startingTimer
        );
      }

      if (
        dialogTimerRef.current
      ) {
        clearTimeout(
          dialogTimerRef.current
        );
      }

      engineRef.current?.stop();
      analysisEngineRef.current?.stop();

      engineRef.current?.terminate();
      analysisEngineRef.current?.terminate();

      engineRef.current = null;
      analysisEngineRef.current =
        null;
    };
  }, [
    currentBot,
    getLoginId,
    playSound,
    say,
  ]);

  /* =======================================================
     BOT CHANGE DIALOG
  ======================================================= */

  useEffect(() => {
    if (!mountedRef.current) {
      return;
    }

    const timer =
      setTimeout(() => {
        if (
          mountedRef.current
        ) {
          say(
            "starting",
            currentBot,
            {
              force: true,
            }
          );
        }
      }, 350);

    return () =>
      clearTimeout(timer);
  }, [currentBot, say]);

  /* =======================================================
     CAPTURED PIECES
  ======================================================= */

  const refreshCaptured =
    useCallback(() => {
      const white = [];
      const black = [];

      game
        .history({
          verbose: true,
        })
        .forEach((move) => {
          if (!move.captured) {
            return;
          }

          const code =
            `${move.color === "w" ? "b" : "w"}${move.captured.toUpperCase()}`;

          if (move.color === "w") {
            black.push(code);
          } else {
            white.push(code);
          }
        });

      setCapturedWhite(white);
      setCapturedBlack(black);
    }, [game]);

  /* =======================================================
     MATERIAL
  ======================================================= */

  const materialScore =
    (() => {
      const values = {
        p: 1,
        n: 3,
        b: 3,
        r: 5,
        q: 9,
        k: 0,
      };

      let white = 0;
      let black = 0;

      game
        .board()
        .flat()
        .forEach((piece) => {
          if (!piece) {
            return;
          }

          if (piece.color === "w") {
            white +=
              values[piece.type];
          } else {
            black +=
              values[piece.type];
          }
        });

      return {
        white,
        black,
      };
    })();

  /* =======================================================
     LEGAL MOVES
  ======================================================= */

  const getLegalMoves =
    useCallback(
      (square) => {
        if (!square) {
          return [];
        }

        try {
          return game
            .moves({
              square,
              verbose: true,
            })
            .map(
              (move) => move.to
            );
        } catch {
          return [];
        }
      },
      [game]
    );

  /* =======================================================
     GAME OVER
  ======================================================= */

  const updateOutcome =
    useCallback(() => {
      if (!game.isGameOver()) {
        return false;
      }

      const over =
        game.isCheckmate() ||
        game.isDraw() ||
        game.isStalemate() ||
        game.isThreefoldRepetition() ||
        game.isInsufficientMaterial();

      if (!over) {
        return false;
      }

      setGameOver(true);
      setIsThinking(false);

      /* ================================================
         CHECKMATE
      ================================================ */

      if (game.isCheckmate()) {
        const winnerColor =
          game.turn() === "w"
            ? "Black"
            : "White";

        const finalResult =
          game.turn() === "w"
            ? "0-1"
            : "1-0";

        setWinner(
          winnerColor
        );

        setResult(
          finalResult
        );

        playSound("checkmate");

        /*
         * 봇 승리
         */
        if (
          finalResult === "0-1"
        ) {
          say(
            "botwin",
            currentBot,
            {
              force: true,
              duration: 4000,
            }
          );
        }

        /*
         * 플레이어 승리
         */
        else {
          say(
            "botlose",
            currentBot,
            {
              force: true,
              duration: 4000,
            }
          );
        }

        return true;
      }

      /* ================================================
         DRAW
      ================================================ */

      setWinner("Draw");
      setResult("1/2-1/2");

      say(
        "stalemate",
        currentBot,
        {
          force: true,
        }
      );

      return true;
    }, [
      currentBot,
      game,
      playSound,
      say,
    ]);

  /* =======================================================
     PLAYER MOVE ANALYSIS
  ======================================================= */

  const analyzePlayerMove =
    useCallback(
      async (
        beforeFen,
        afterFen,
        move
      ) => {
        if (
          !analysisEngineRef.current ||
          !move
        ) {
          return;
        }

        try {
          const before =
            await analysisEngineRef.current.analyzePosition(
              beforeFen,
              14
            );

          const after =
            await analysisEngineRef.current.analyzePosition(
              afterFen,
              14
            );

          const beforeScore =
            playerEval(
              before,
              move.color
            );

          const afterScore =
            playerEval(
              after,
              move.color
            );

          const cpl =
            Math.max(
              0,
              beforeScore -
                afterScore
            );

          const acc =
            accuracyFromCpl(
              cpl
            );

          const bestMove =
            String(
              before.bestMove ||
                ""
            ).toLowerCase();

          const playedMove =
            uci(move);

          const isBest =
            playedMove ===
            bestMove;

          const beforeGame =
            new Chess(beforeFen);

          const afterGame =
            new Chess(afterFen);

          let quality =
            classifyMove(
              cpl,
              isBest,
              move,
              beforeGame,
              afterGame,
              before,
              after
            );

          /*
           * 엔진 최선 수면 best.
           * brilliant 조건을 만족한 경우는 유지.
           */
          if (
            isBest &&
            quality !==
              "brilliant"
          ) {
            quality = "best";
          }

          statsRef.current[
            quality
          ] =
            (statsRef.current[
              quality
            ] || 0) + 1;

          setMoveStats({
            ...statsRef.current,
          });

          playerAccuraciesRef.current.push(
            acc
          );

          const overall =
            playerAccuraciesRef.current.reduce(
              (sum, value) =>
                sum + value,
              0
            ) /
            playerAccuraciesRef.current
              .length;

          setAccuracy(
            Number(
              overall.toFixed(1)
            )
          );

          /*
           * 현재 평가
           */
          let evalAfter = 0;

          if (
            after.mate !==
              null &&
            after.mate !==
              undefined
          ) {
            evalAfter =
              Number(
                after.mate
              ) > 0
                ? 100
                : -100;
          } else {
            evalAfter =
              playerEval(
                after,
                move.color
              ) / 100;
          }

          const entry = {
            ply:
              playerAccuraciesRef
                .current
                .length,

            moveNumber:
              Math.ceil(
                game.history()
                  .length / 2
              ),

            san: move.san,

            uci: playedMove,

            quality,

            cpl: Number(
              cpl.toFixed(1)
            ),

            accuracy: acc,

            bestMove,

            evaluation: Number(
              evalAfter.toFixed(
                2
              )
            ),

            side: "player",
          };

          setAnalysisMoves(
            (previous) => [
              ...previous.slice(
                -59
              ),
              entry,
            ]
          );

          setLastAnalysis(
            entry
          );

          setCurrentEvaluation(
            entry.evaluation
          );

          /*
           * 플레이어 수에 대한 봇 반응
           */
          sayAnalysis(
            quality,
            "other"
          );
        } catch (error) {
          console.warn(
            "Player analysis failed:",
            error
          );
        }
      },
      [game, sayAnalysis]
    );

  /* =======================================================
     BOT MOVE ANALYSIS
  ======================================================= */

  const analyzeBotMove =
    useCallback(
      async (
        beforeFen,
        afterFen,
        move
      ) => {
        if (
          !analysisEngineRef.current ||
          !move
        ) {
          return;
        }

        try {
          const before =
            await analysisEngineRef.current.analyzePosition(
              beforeFen,
              12
            );

          const after =
            await analysisEngineRef.current.analyzePosition(
              afterFen,
              12
            );

          const beforeScore =
            playerEval(
              before,
              "b"
            );

          const afterScore =
            playerEval(
              after,
              "b"
            );

          const cpl =
            Math.max(
              0,
              beforeScore -
                afterScore
            );

          const bestMove =
            String(
              before.bestMove ||
                ""
            ).toLowerCase();

          const isBest =
            uci(move) ===
            bestMove;

          const quality =
            isBest
              ? "best"
              : classifyMove(
                  cpl,
                  isBest,
                  move,
                  new Chess(
                    beforeFen
                  ),
                  new Chess(
                    afterFen
                  ),
                  before,
                  after
                );

          let evaluation = 0;

          if (
            after.mate !==
              null &&
            after.mate !==
              undefined
          ) {
            evaluation =
              Number(
                after.mate
              ) > 0
                ? 100
                : -100;
          } else {
            evaluation =
              playerEval(
                after,
                "w"
              ) / 100;
          }

          const entry = {
            ply:
              game.history()
                .length,

            moveNumber:
              Math.ceil(
                game.history()
                  .length / 2
              ),

            san: move.san,

            uci: uci(move),

            quality,

            cpl: Number(
              cpl.toFixed(1)
            ),

            accuracy:
              accuracyFromCpl(
                cpl
              ),

            bestMove,

            evaluation: Number(
              evaluation.toFixed(
                2
              )
            ),

            side: "bot",
          };

          setAnalysisMoves(
            (previous) => [
              ...previous.slice(
                -59
              ),
              entry,
            ]
          );

          setLastAnalysis(
            entry
          );

          setCurrentEvaluation(
            entry.evaluation
          );

          sayAnalysis(
            quality,
            "bot"
          );
        } catch (error) {
          console.warn(
            "Bot analysis failed:",
            error
          );
        }
      },
      [game, sayAnalysis]
    );

  /* =======================================================
     GAME SUMMARY
  ======================================================= */

  const finalizeSummary =
    useCallback(
      (finalResult = result) => {
        const bot =
          botData[currentBot] ||
          {};

        const elapsed =
          Math.max(
            0,
            Math.floor(
              (Date.now() -
                startTimeRef.current) /
                1000
            )
          );

        const date =
          new Date()
            .toISOString()
            .slice(0, 10)
            .replaceAll(
              "-",
              "."
            );

        const stats =
          statsRef.current;

        const pgn =
          game.pgn({
            newline: "\n",
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

          result:
            finalResult,

          playerRating:
            rating,

          botRating:
            botRating[
              currentBot
            ] || 0,

          playTime:
            `${Math.floor(
              elapsed / 60
            )}:${String(
              elapsed % 60
            ).padStart(
              2,
              "0"
            )}`,

          accuracy,

          ...stats,

          totalMoves:
            game.history()
              .length,

          pgn,
        };
      },
      [
        accuracy,
        currentBot,
        game,
        rating,
        result,
      ]
    );

  /* =======================================================
     SAVE RATING
  ======================================================= */

  const saveRating =
    useCallback(
      async (change) => {
        if (
          ratingSavedRef.current ||
          !change
        ) {
          return;
        }

        ratingSavedRef.current =
          true;

        const next =
          Math.max(
            0,
            rating + change
          );

        setRating(next);

        setRatingChange(
          change
        );

        setShowRatingChange(
          true
        );

        try {
          const {
            data: { user },
            error: authError,
          } =
            await supabase.auth.getUser();

          if (
            authError ||
            !user
          ) {
            console.warn(
              "레이팅 저장: 로그인 사용자를 찾을 수 없습니다."
            );

            return;
          }

          const loginId =
            getLoginId(user);

          if (!loginId) {
            console.warn(
              "레이팅 저장: login_id를 찾을 수 없습니다."
            );

            return;
          }

          const { error } =
            await supabase
              .from("users")
              .update({
                chess_rating:
                  next,
              })
              .eq(
                "login_id",
                String(loginId)
              );

          if (error) {
            console.error(
              "체스 레이팅 저장 실패:",
              error
            );
          }
        } catch (error) {
          console.error(
            "Rating save error:",
            error
          );
        }
      },
      [getLoginId, rating]
    );

  /* =======================================================
     RATING + SUMMARY AFTER GAME
  ======================================================= */

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
      result ===
      "1/2-1/2";

    const baseReward =
      ratingReward[
        currentBot
      ] || 0;

    let change = 0;

    if (won) {
      change = baseReward;
    } else if (draw) {
      change = Math.floor(
        baseReward / 4
      );
    } else {
      change = -Math.max(
        5,
        Math.floor(
          baseReward / 10
        )
      );
    }

    saveRating(change);

    setGameSummary(
      finalizeSummary(result)
    );
  }, [
    gameOver,
    result,
    currentBot,
    saveRating,
    finalizeSummary,
  ]);

  /* =======================================================
     MAKE PLAYER MOVE
  ======================================================= */

  const makeMove =
    useCallback(
      async (
        from,
        to,
        promotion
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
              ? {
                  promotion,
                }
              : {}),
          });
        } catch {
          return false;
        }

        if (!move) {
          return false;
        }

        /* ================================================
           UI
        ================================================ */

        setSelected(null);
        setMoves([]);

        setLastMove(move);

        setHistory(
          game.history()
        );

        moveHistoryRef.current =
          game.history();

        setMoveAnimations([
          {
            id: `${Date.now()}-${from}-${to}`,
            from,
            to,
            piece: `${move.color}${move.piece.toUpperCase()}`,
          },
        ]);

        refreshCaptured();
        sync();

        /* ================================================
           SPECIAL DIALOG
        ================================================ */

        if (
          move.isKingsideCastle() ||
          move.isQueensideCastle()
        ) {
          say(
            "castle",
            currentBot,
            {
              force: true,
            }
          );
        }

        if (
          move.piece === "p" &&
          move.promotion
        ) {
          say(
            "promotion",
            currentBot,
            {
              force: true,
            }
          );
        }

        /*
         * capture
         */
        if (
          !move.isKingsideCastle() &&
          !move.isQueensideCastle() &&
          !move.promotion &&
          move.captured
        ) {
          say(
            "normal",
            currentBot
          );
        }

        /* ================================================
           SOUND
        ================================================ */

        playSound(
          move.captured
            ? "capture"
            : move.isKingsideCastle() ||
                move.isQueensideCastle()
              ? "castle"
              : "move"
        );

        setPromotionData(
          null
        );

        /* ================================================
           PLAYER ANALYSIS
        ================================================ */

        await analyzePlayerMove(
          beforeFen,
          game.fen(),
          move
        );

        /*
         * 분석 도중 게임이 리셋되었는지 확인
         */
        if (
          gameOver ||
          game.turn() !== "b"
        ) {
          updateOutcome();
          return true;
        }

        /* ================================================
           PLAYER CHECK
        ================================================ */

        if (game.isCheck()) {
          say(
            "check",
            currentBot,
            {
              force: true,
            }
          );
        }

        /* ================================================
           PLAYER GAME OVER
        ================================================ */

        if (updateOutcome()) {
          return true;
        }

        /* ================================================
           AI THINKING
        ================================================ */

        setIsThinking(true);

        say(
          "thinking",
          currentBot
        );

        const currentGameId =
          gameIdRef.current;

        const fen =
          game.fen();

        try {
          /*
           * 자연스러운 생각 시간
           */
          const delay =
            80 +
            Math.random() *
              2000;

          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                delay
              )
          );

          if (
            currentGameId !==
              gameIdRef.current ||
            !mountedRef.current ||
            gameOver ||
            game.turn() !== "b"
          ) {
            return true;
          }

          /* ==========================================
             ENGINE MOVE
          ========================================== */

          const answer =
            await requestMove(
              engineRef.current,
              currentBot,
              fen
            );

          if (
            currentGameId !==
              gameIdRef.current ||
            !mountedRef.current ||
            game.fen() !== fen ||
            game.turn() !== "b"
          ) {
            return true;
          }

          if (
            !answer?.bestMove ||
            answer.bestMove ===
              "(none)"
          ) {
            setIsThinking(
              false
            );

            updateOutcome();

            return true;
          }

          const bestMove =
            answer.bestMove;

          let aiMove = null;

          try {
            aiMove =
              game.move({
                from:
                  bestMove.slice(
                    0,
                    2
                  ),

                to:
                  bestMove.slice(
                    2,
                    4
                  ),

                promotion:
                  bestMove[4] ||
                  undefined,
              });
          } catch (error) {
            console.error(
              "AI chess.js move error:",
              error
            );
          }

          if (aiMove) {
            /* ========================================
               UPDATE
            ======================================== */

            setLastMove(
              aiMove
            );

            setHistory(
              game.history()
            );

            moveHistoryRef.current =
              game.history();

            setMoveAnimations([
              {
                id: `${Date.now()}-${aiMove.from}-${aiMove.to}`,
                from:
                  aiMove.from,
                to:
                  aiMove.to,
                piece: `${aiMove.color}${aiMove.piece.toUpperCase()}`,
              },
            ]);

            refreshCaptured();
            sync();

            /* ========================================
               AI SPECIAL DIALOG
            ======================================== */

            if (
              aiMove.isKingsideCastle() ||
              aiMove.isQueensideCastle()
            ) {
              say(
                "castle",
                currentBot,
                {
                  force: true,
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
                  force: true,
                }
              );
            }

            /*
             * AI CHECK
             */
            if (game.isCheck()) {
              say(
                "check",
                currentBot,
                {
                  force: true,
                }
              );
            }

            /*
             * AI capture
             */
            if (
              aiMove.captured &&
              !game.isCheck()
            ) {
              say(
                "normal",
                currentBot
              );
            }

            /* ========================================
               SOUND
            ======================================== */

            playSound(
              aiMove.captured
                ? "capture"
                : aiMove.isKingsideCastle() ||
                    aiMove.isQueensideCastle()
                  ? "castle"
                  : "move"
            );

            /* ========================================
               BOT ANALYSIS
            ======================================== */

            await analyzeBotMove(
              fen,
              game.fen(),
              aiMove
            );
          }
        } catch (error) {
          console.error(
            "AI move error:",
            error
          );
        } finally {
          if (
            mountedRef.current &&
            currentGameId ===
              gameIdRef.current
          ) {
            setIsThinking(
              false
            );
          }
        }

        /* ================================================
           AI GAME OVER
        ================================================ */

        if (
          currentGameId ===
          gameIdRef.current
        ) {
          updateOutcome();
        }

        return true;
      },
      [
        analyzeBotMove,
        analyzePlayerMove,
        currentBot,
        game,
        gameOver,
        isThinking,
        playSound,
        refreshCaptured,
        say,
        sync,
        updateOutcome,
      ]
    );

  /* =======================================================
     SELECT SQUARE
  ======================================================= */

  const selectSquare =
    useCallback(
      (square) => {
        if (
          gameOver ||
          isThinking ||
          game.turn() !== "w"
        ) {
          return;
        }

        const piece =
          game.get(square);

        /* ================================================
           이미 선택된 상태
        ================================================ */

        if (selected) {
          /*
           * 이동 가능 칸
           */
          if (
            moves.includes(square)
          ) {
            const moving =
              game.get(
                selected
              );

            /*
             * 프로모션
             */
            if (
              moving?.type ===
                "p" &&
              Number(
                square[1]
              ) === 8
            ) {
              setPromotionData({
                from: selected,
                to: square,
              });

              return;
            }

            makeMove(
              selected,
              square
            );

            return;
          }

          /*
           * 다른 백 기물 선택
           */
          if (
            piece?.color === "w"
          ) {
            setSelected(
              square
            );

            setMoves(
              getLegalMoves(
                square
              )
            );

            playSound(
              "click"
            );

            return;
          }

          /*
           * 선택 취소
           */
          setSelected(null);
          setMoves([]);

          return;
        }

        /* ================================================
           처음 기물 선택
        ================================================ */

        if (
          piece?.color === "w"
        ) {
          setSelected(square);

          setMoves(
            getLegalMoves(
              square
            )
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
        selected,
      ]
    );

  const clickSquare =
    selectSquare;

  /* =======================================================
     DRAG MOVE
  ======================================================= */

  const dragMove =
    useCallback(
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

        if (
          !legal.includes(to)
        ) {
          return;
        }

        const moving =
          game.get(from);

        /*
         * Promotion
         */
        if (
          moving?.type === "p" &&
          Number(to[1]) === 8
        ) {
          setPromotionData({
            from,
            to,
          });

          return;
        }

        makeMove(
          from,
          to
        );
      },
      [
        game,
        gameOver,
        getLegalMoves,
        isThinking,
        makeMove,
      ]
    );

  /* =======================================================
     PROMOTION
  ======================================================= */

  const choosePromotion =
    useCallback(
      (promotion) => {
        if (
          !promotionData
        ) {
          return;
        }

        const {
          from,
          to,
        } = promotionData;

        makeMove(
          from,
          to,
          promotion
        );
      },
      [
        makeMove,
        promotionData,
      ]
    );

  /* =======================================================
     UNDO
  ======================================================= */

  const undoMove =
    useCallback(async () => {
      if (gameOver) {
        return;
      }

      /*
       * 현재 AI 작업 취소
       */
      gameIdRef.current++;

      engineRef.current?.stop();
      analysisEngineRef.current?.stop();

      setIsThinking(false);

      const historyLength =
        game.history().length;

      /*
       * 플레이어 + 봇 수를 같이 되돌림
       */
      if (historyLength >= 2) {
        game.undo();
        game.undo();
      } else if (
        historyLength === 1
      ) {
        game.undo();
      }

      /* ================================================
         RESET UI
      ================================================ */

      setSelected(null);
      setMoves([]);

      setPromotionData(
        null
      );

      setLastMove(null);

      setHistory(
        game.history()
      );

      moveHistoryRef.current =
        game.history();

      /*
       * 분석 초기화
       */
      statsRef.current =
        emptyStats();

      setMoveStats({
        ...statsRef.current,
      });

      playerAccuraciesRef.current =
        [];

      setAnalysisMoves([]);

      setCurrentEvaluation(
        0
      );

      setLastAnalysis(null);

      setAccuracy(100);

      setMoveAnimations([]);

      refreshCaptured();
      sync();

      say(
        "normal",
        currentBot,
        {
          force: true,
        }
      );
    }, [
      currentBot,
      game,
      gameOver,
      refreshCaptured,
      say,
      sync,
    ]);

  /* =======================================================
     RESET GAME
  ======================================================= */

  const resetGame =
    useCallback(
      (nextBot = currentBot) => {
        /*
         * 진행 중인 게임이 있으면 초기화 금지
         */
        if (
          !gameOver &&
          game.history().length >
            0
        ) {
          return;
        }

        gameIdRef.current++;

        engineRef.current?.stop();
        analysisEngineRef.current?.stop();

        game.reset();

        setPosition(
          START_FEN
        );

        setTurn("w");

        setSelected(null);
        setMoves([]);

        setHistory([]);
        setLastMove(null);

        setGameOver(false);
        setWinner("");
        setResult("*");

        setPromotionData(
          null
        );

        setCapturedWhite([]);
        setCapturedBlack([]);

        setAccuracy(100);

        statsRef.current =
          emptyStats();

        setMoveStats({
          ...statsRef.current,
        });

        playerAccuraciesRef.current =
          [];

        setMoveAnimations([]);

        setAnalysisMoves([]);

        setCurrentEvaluation(
          0
        );

        setLastAnalysis(null);

        setRatingChange(0);
        setShowRatingChange(
          false
        );

        setGameSummary({});

        setDialog("");

        lastDialogRef.current =
          "";

        if (
          dialogTimerRef.current
        ) {
          clearTimeout(
            dialogTimerRef.current
          );

          dialogTimerRef.current =
            null;
        }

        ratingSavedRef.current =
          false;

        startTimeRef.current =
          Date.now();

        /*
         * nextBot이 현재 봇과 다르면 먼저 변경
         */
        if (
          nextBot !== currentBot
        ) {
          setCurrentBot(
            nextBot
          );
        }

        playSound("start");

        setTimeout(() => {
          if (
            mountedRef.current
          ) {
            say(
              "starting",
              nextBot,
              {
                force: true,
              }
            );
          }
        }, 400);
      },
      [
        currentBot,
        game,
        gameOver,
        playSound,
        say,
      ]
    );

  /* =======================================================
     SET BOT
  ======================================================= */

  const setBot =
    useCallback(
      (bot) => {
        if (!botData[bot]) {
          return;
        }

        /*
         * 진행 중인 게임에서는 봇 변경 금지
         */
        if (
          !gameOver &&
          game.history().length >
            0
        ) {
          return;
        }

        setCurrentBot(bot);

        resetGame(bot);
      },
      [
        game,
        gameOver,
        resetGame,
      ]
    );

  /* =======================================================
     RESIGN
  ======================================================= */

  const resign =
    useCallback(() => {
      if (gameOver) {
        return;
      }

      gameIdRef.current++;

      engineRef.current?.stop();
      analysisEngineRef.current?.stop();

      setIsThinking(false);

      setGameOver(true);

      setWinner("Black");

      setResult("0-1");

      say(
        "botwin",
        currentBot,
        {
          force: true,
          duration: 4000,
        }
      );

      setGameSummary(
        finalizeSummary("0-1")
      );
    }, [
      currentBot,
      finalizeSummary,
      gameOver,
      say,
    ]);

  /* =======================================================
     OFFER DRAW
  ======================================================= */

  const offerDraw =
    useCallback(() => {
      if (gameOver) {
        return;
      }

      gameIdRef.current++;

      engineRef.current?.stop();
      analysisEngineRef.current?.stop();

      setIsThinking(false);

      setGameOver(true);

      setWinner("Draw");

      setResult(
        "1/2-1/2"
      );

      say(
        "stalemate",
        currentBot,
        {
          force: true,
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
      say,
    ]);

  /* =======================================================
     PGN DOWNLOAD
  ======================================================= */

  const downloadPGN =
    useCallback(
      (summary) => {
        const pgn =
          summary?.pgn ||
          game.pgn({
            newline: "\n",
          });

        const blob =
          new Blob(
            [pgn],
            {
              type:
                "application/x-chess-pgn",
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

        document.body.appendChild(
          a
        );

        a.click();

        document.body.removeChild(
          a
        );

        URL.revokeObjectURL(
          url
        );
      },
      [game]
    );

  /* =======================================================
     CHECK SQUARE
  ======================================================= */

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
        let row = 0;
        row < 8;
        row++
      ) {
        for (
          let column = 0;
          column < 8;
          column++
        ) {
          const piece =
            board[row][column];

          if (
            piece?.type ===
              "k" &&
            piece.color ===
              color
          ) {
            return `${String.fromCharCode(
              97 + column
            )}${8 - row}`;
          }
        }
      }

      return null;
    })();

  /* =======================================================
     LIVE SUMMARY
  ======================================================= */

  const gameSummaryLive =
    gameSummary &&
    Object.keys(
      gameSummary
    ).length
      ? gameSummary
      : finalizeSummary(
          result
        );

  /* =======================================================
     RETURN
  ======================================================= */

  return {
    /* ==============================================
       GAME
    ============================================== */

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

    matchLocked:
      !gameOver &&
      game.history().length >
        0,

    /* ==============================================
       BOT
    ============================================== */

    currentBot,

    botRating:
      botRating[
        currentBot
      ] || 0,

    /* ==============================================
       RATING
    ============================================== */

    rating,
    ratingChange,
    showRatingChange,

    /* ==============================================
       DIALOG
    ============================================== */

    dialog,
    dialogKey,
    say,

    /* ==============================================
       THINKING
    ============================================== */

    isThinking,

    /* ==============================================
       PROMOTION
    ============================================== */

    promotionData,

    /* ==============================================
       CAPTURED
    ============================================== */

    capturedWhite,
    capturedBlack,

    /* ==============================================
       ANALYSIS
    ============================================== */

    accuracy,
    moveStats,
    analysisMoves,
    currentEvaluation,
    lastAnalysis,

    /* ==============================================
       ANIMATION
    ============================================== */

    moveAnimations,

    /* ==============================================
       SUMMARY
    ============================================== */

    gameSummary:
      gameSummaryLive,

    /* ==============================================
       BOARD INFO
    ============================================== */

    materialScore,

    inCheck:
      game.isCheck(),

    checkSquare,

    /* ==============================================
       INPUT
    ============================================== */

    clickSquare,
    selectSquare,
    dragMove,

    choosePromotion,

    /* ==============================================
       GAME ACTIONS
    ============================================== */

    makeMove,
    undoMove,
    resetGame,
    setBot,

    resign,
    offerDraw,

    /* ==============================================
       PGN
    ============================================== */

    downloadPGN,

    /* ==============================================
       COLORS
    ============================================== */

    playerColor: "w",
    aiColor: "b",
  };
}