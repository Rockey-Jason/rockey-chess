import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Chess } from "chess.js";
import { supabase } from "../supabase";
import "../styles/feature.css";
import "./PvP.css";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const GLYPHS = {
  w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
  b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
};

async function getProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, loginId: null, profile: {} };
  }

  const loginId =
    user.user_metadata?.login_id ||
    user.user_metadata?.username ||
    user.email?.split("@")[0] ||
    user.id;

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("login_id", loginId)
    .maybeSingle();

  return { user, loginId, profile: data || {} };
}

function profileFromRow(row, fallbackName = "상대") {
  return {
    name: row?.nickname || row?.name || row?.login_id || fallbackName,
    rating: Number(row?.chess_rating ?? row?.rating ?? 0),
    image: row?.profile_image || row?.avatar_url || "",
  };
}

export default function PvP() {
  const [user, setUser] = useState(null);
  const [loginId, setLoginId] = useState(null);
  const [profile, setProfile] = useState({});
  const [room, setRoom] = useState(null);
  const [channel, setChannel] = useState(null);
  const [status, setStatus] = useState("빠른 대전을 준비하세요.");
  const [game, setGame] = useState(() => new Chess());
  const [color, setColor] = useState(null);
  const [selected, setSelected] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [matchmaking, setMatchmaking] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [opponent, setOpponent] = useState(null);
  const [ratingChange, setRatingChange] = useState(null);
  const [finished, setFinished] = useState(false);

  const pointerRef = useRef(null);
  const gameRef = useRef(game);
  const finishedRef = useRef(finished);
  const colorRef = useRef(color);
  const channelRef = useRef(channel);

  gameRef.current = game;
  finishedRef.current = finished;
  colorRef.current = color;
  channelRef.current = channel;

  const load = useCallback(async () => {
    const result = await getProfile();
    setUser(result.user);
    setLoginId(result.loginId);
    setProfile(result.profile);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const broadcast = useCallback((event, payload) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: "broadcast",
      event,
      payload,
    });
  }, []);

  const finishLocal = useCallback(
    async (result) => {
      if (finishedRef.current) return;

      finishedRef.current = true;
      setFinished(true);

      const winner =
        result === "1-0" ? "w" : result === "0-1" ? "b" : null;
      const iWon = winner === colorRef.current;

      if (result === "1/2-1/2") {
        setStatus("무승부 · 레이팅 변동 없음");
        setRatingChange(0);
      } else {
        setStatus(iWon ? "승리했습니다!" : "패배했습니다.");
      }

      broadcast("result", {
        result,
        winner,
        finishedBy: user?.id,
      });

      if (room?.id) {
        const { data, error } = await supabase.rpc("finish_pvp_game", {
          p_room_id: room.id,
          p_result: result,
        });

        if (!error && data?.rating_change != null) {
          setRatingChange(Number(data.rating_change));
        }
      }
    },
    [broadcast, room?.id, user?.id]
  );

  useEffect(() => {
    if (!room?.id || !user?.id) return undefined;

    const ch = supabase
      .channel(`rockey-pvp:${room.id}`, {
        config: { broadcast: { ack: true } },
      })
      .on("broadcast", { event: "state" }, ({ payload }) => {
        if (payload?.sender === user.id) return;

        try {
          const nextGame = new Chess(payload.fen);
          setGame(nextGame);
          setLastMove(payload.move || null);
          setSelected(null);
          setStatus(`상대 수 ${payload.san || ""}`);

          if (nextGame.isGameOver()) {
            const result = nextGame.isCheckmate()
              ? nextGame.turn() === "w"
                ? "0-1"
                : "1-0"
              : "1/2-1/2";
            finishLocal(result);
          }
        } catch {
          setStatus("상대의 수를 처리하지 못했습니다.");
        }
      })
      .on("broadcast", { event: "join" }, ({ payload }) => {
        if (payload?.userId === user.id) return;
        setStatus("상대가 입장했습니다. 대국 시작!");
        setOpponent(payload?.profile || null);
      })
      .on("broadcast", { event: "result" }, ({ payload }) => {
        if (payload?.finishedBy === user.id) return;
        finishedRef.current = true;
        setFinished(true);
        setStatus(
          payload?.result === "1/2-1/2"
            ? "무승부"
            : "상대가 대국을 종료했습니다."
        );
      })
      .subscribe((state) => {
        if (state !== "SUBSCRIBED") return;

        ch.send({
          type: "broadcast",
          event: "join",
          payload: {
            userId: user.id,
            profile: profileFromRow(profile, loginId || "상대"),
          },
        });
      });

    setChannel(ch);
    channelRef.current = ch;

    return () => {
      supabase.removeChannel(ch);
      if (channelRef.current === ch) {
        channelRef.current = null;
      }
      setChannel(null);
    };
  }, [room?.id, user?.id, finishLocal, loginId, profile]);

  const createRoom = async (privateCode = null) => {
    if (!user || !loginId) {
      setStatus("로그인 후 이용하세요.");
      return null;
    }

    const rating = Number(profile.chess_rating || 0);
    const code =
      privateCode || Math.random().toString(36).slice(2, 8).toUpperCase();

    const { data, error } = await supabase
      .from("pvp_rooms")
      .insert({
        code,
        host_id: user.id,
        host_login_id: loginId,
        host_rating: rating,
        status: "waiting",
        fen: new Chess().fen(),
      })
      .select()
      .single();

    if (error) {
      setStatus(error.message);
      return null;
    }

    setRoom(data);
    setColor("w");
    colorRef.current = "w";
    setGame(new Chess());
    setFinished(false);
    finishedRef.current = false;
    setStatus(
      privateCode
        ? `방 ${code} 생성 · 상대를 기다리는 중`
        : `방 ${code} 생성 · 비슷한 레이팅 상대를 기다리는 중`
    );

    return data;
  };

  const quickMatch = async () => {
    if (!user || !loginId) {
      setStatus("로그인 후 이용하세요.");
      return;
    }

    setMatchmaking(true);
    setStatus("비슷한 레이팅의 상대를 찾는 중…");

    const rating = Number(profile.chess_rating || 0);
    const min = Math.max(0, rating - 150);
    const max = rating + 150;

    const { data } = await supabase
      .from("pvp_rooms")
      .select("*")
      .eq("status", "waiting")
      .neq("host_id", user.id)
      .gte("host_rating", min)
      .lte("host_rating", max)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (data) {
      const { data: updated, error } = await supabase
        .from("pvp_rooms")
        .update({
          guest_id: user.id,
          guest_login_id: loginId,
          guest_rating: rating,
          status: "playing",
        })
        .eq("id", data.id)
        .eq("status", "waiting")
        .select()
        .single();

      if (!error && updated) {
        setRoom(updated);
        setColor("b");
        colorRef.current = "b";
        setGame(new Chess(updated.fen));
        setFinished(false);
        finishedRef.current = false;
        setStatus("매칭 완료! 백의 첫 수를 기다리세요.");
        setOpponent({
          name: updated.host_login_id,
          rating: updated.host_rating,
        });
        setMatchmaking(false);
        return;
      }
    }

    await createRoom();
    setMatchmaking(false);
  };

  const join = async () => {
    if (!user || !loginId) {
      setStatus("로그인 후 이용하세요.");
      return;
    }

    const code = joinCode.trim().toUpperCase();
    if (!code) return;

    const { data } = await supabase
      .from("pvp_rooms")
      .select("*")
      .eq("code", code)
      .eq("status", "waiting")
      .maybeSingle();

    if (!data) {
      setStatus("입장 가능한 방을 찾지 못했습니다.");
      return;
    }

    const rating = Number(profile.chess_rating || 0);
    const { data: updated, error } = await supabase
      .from("pvp_rooms")
      .update({
        guest_id: user.id,
        guest_login_id: loginId,
        guest_rating: rating,
        status: "playing",
      })
      .eq("id", data.id)
      .eq("status", "waiting")
      .select()
      .single();

    if (error || !updated) {
      setStatus(error?.message || "방 참가에 실패했습니다.");
      return;
    }

    setRoom(updated);
    setColor("b");
    colorRef.current = "b";
    setGame(new Chess(updated.fen));
    setFinished(false);
    finishedRef.current = false;
    setOpponent({
      name: updated.host_login_id,
      rating: updated.host_rating,
    });
    setStatus("대결 시작! 백의 첫 수를 기다리세요.");
  };

  const legal = useMemo(() => {
    if (!selected) return [];
    return game
      .moves({ square: selected, verbose: true })
      .map((move) => move.to);
  }, [game, selected]);

  const moveTo = useCallback(
    (from, to) => {
      if (
        finishedRef.current ||
        !room ||
        !colorRef.current ||
        gameRef.current.turn() !== colorRef.current
      ) {
        return;
      }

      try {
        const nextGame = new Chess(gameRef.current.fen());
        const move = nextGame.move({
          from,
          to,
          promotion: "q",
        });

        if (!move) return;

        gameRef.current = nextGame;
        setGame(nextGame);
        setSelected(null);
        setLastMove(move);

        broadcast("state", {
          sender: user.id,
          fen: nextGame.fen(),
          san: move.san,
          move,
        });

        if (nextGame.isGameOver()) {
          const result = nextGame.isCheckmate()
            ? nextGame.turn() === "w"
              ? "0-1"
              : "1-0"
            : "1/2-1/2";
          finishLocal(result);
        }
      } catch {
        setStatus("수 처리 중 오류가 발생했습니다.");
      }
    },
    [broadcast, finishLocal, room, user?.id]
  );

  const clickSquare = (square) => {
    if (finishedRef.current || gameRef.current.turn() !== colorRef.current) {
      return;
    }

    const piece = gameRef.current.get(square);

    if (selected && legal.includes(square)) {
      moveTo(selected, square);
      return;
    }

    if (piece?.color === colorRef.current) {
      setSelected(square);
    } else {
      setSelected(null);
    }
  };

  const board = useMemo(() => {
    const squares = [];

    for (let rank = 8; rank >= 1; rank -= 1) {
      for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
        const square = FILES[fileIndex] + rank;
        const piece = game.get(square);
        const light = (rank + fileIndex) % 2 === 0;
        const isSelected = selected === square;
        const isLegal = legal.includes(square);
        const isLast =
          lastMove?.from === square || lastMove?.to === square;

        squares.push(
          <button
            key={square}
            type="button"
            className={`pvpSquare ${light ? "light" : "dark"} ${
              isSelected ? "selected" : ""
            } ${isLegal ? "legal" : ""} ${isLast ? "last" : ""}`}
            onClick={() => clickSquare(square)}
            onPointerDown={(event) => {
              if (
                event.pointerType !== "mouse" &&
                piece?.color === colorRef.current
              ) {
                pointerRef.current = square;
                setSelected(square);
              }
            }}
            onPointerUp={(event) => {
              if (event.pointerType !== "mouse" || !pointerRef.current) {
                return;
              }

              const from = pointerRef.current;
              pointerRef.current = null;

              if (from !== square) {
                moveTo(from, square);
              }
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const from = event.dataTransfer.getData("from");
              if (from) moveTo(from, square);
            }}
          >
            {piece && (
              <span
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("from", square);
                  setSelected(square);
                }}
              >
                {GLYPHS[piece.color][piece.type]}
              </span>
            )}
          </button>
        );
      }
    }

    return squares;
  }, [game, lastMove, legal, moveTo, selected]);

  const me = profileFromRow(profile, loginId || "나");
  const fallbackOpponent = {
    name:
      room?.host_login_id === loginId
        ? room?.guest_login_id
        : room?.host_login_id,
    rating:
      room?.host_login_id === loginId
        ? room?.guest_rating
        : room?.host_rating,
  };
  const opp = opponent || fallbackOpponent;

  return (
    <div className="featurePage pvpPage">
      <div className="featureShell pvpShell">
        <Link to="/" className="featureSub">
          ← 대국으로
        </Link>

        <div className="pvpHeader">
          <div>
            <div className="featureTitle">실시간 PvP</div>
            <p className="featureSub">
              현재 레이팅 ±150 범위의 상대를 우선 매칭합니다. 수와 결과는
              Supabase Realtime으로 동기화됩니다.
            </p>
          </div>
          <div className="pvpRating">
            {me.rating.toLocaleString()} <span>RATING</span>
          </div>
        </div>

        <div className="pvpControls">
          <button
            type="button"
            className="featureButton"
            disabled={matchmaking || !!room}
            onClick={quickMatch}
          >
            {matchmaking ? "상대를 찾는 중…" : "⚡ 빠른 대전"}
          </button>

          <button
            type="button"
            className="featureButton secondary"
            disabled={!!room}
            onClick={() => createRoom()}
          >
            방 만들기
          </button>

          <div className="joinBox">
            <input
              className="input"
              value={joinCode}
              onChange={(event) =>
                setJoinCode(event.target.value.toUpperCase())
              }
              placeholder="방 코드"
            />
            <button
              type="button"
              className="featureButton"
              disabled={!!room}
              onClick={join}
            >
              참가
            </button>
          </div>
        </div>

        <div className="pvpStatus">{status}</div>

        {room && (
          <div className="pvpGame">
            <div className="pvpPlayer">
              <div className="pvpAvatar">
                {opp.image ? <img src={opp.image} alt="" /> : "♟"}
              </div>
              <div>
                <b>{opp.name || "상대"}</b>
                <small>
                  {Number(opp.rating || 0).toLocaleString()} rating
                </small>
              </div>
              <span>{color === "b" ? "상대 차례" : ""}</span>
            </div>

            <div className="pvpBoard">{board}</div>

            <div className="pvpPlayer self">
              <div className="pvpAvatar">
                {me.image ? <img src={me.image} alt="" /> : "♙"}
              </div>
              <div>
                <b>{me.name}</b>
                <small>{me.rating.toLocaleString()} rating</small>
              </div>
              <span>
                {finished
                  ? "종료"
                  : game.turn() === color
                  ? "YOUR TURN"
                  : "상대 차례"}
              </span>
            </div>

            {finished && (
              <div className="pvpResult">
                <span>{status}</span>
                <strong>
                  {ratingChange != null
                    ? `${ratingChange >= 0 ? "+" : ""}${ratingChange} rating`
                    : ""}
                </strong>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
