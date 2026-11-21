import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { playChessAudio } from "../audio/chessAudio";
import "../styles/feature.css";

const ITEMS = [
  { id: "theme_midnight", name: "Midnight Arena", kind: "보드", price: 500, desc: "차분한 네이비와 아이스 블루가 어우러진 야간 아레나 보드", icon: "◼" },
  { id: "theme_royal", name: "Royal Walnut", kind: "보드", price: 900, desc: "따뜻한 월넛 프레임과 아이보리 칸으로 완성한 클래식 보드", icon: "♜" },
  { id: "theme_gold", name: "Imperial Gold", kind: "보드", price: 1400, desc: "샴페인 골드 프레임과 왕실 문양을 연상시키는 프리미엄 보드", icon: "✦" },
  { id: "piece_classic", name: "Classic Staunton", kind: "기물", price: 700, desc: "대회 표준에 어울리는 선명한 클래식 기물 세트", icon: "♞" },
  { id: "piece_neo", name: "Neo Glass", kind: "기물", price: 1200, desc: "맑은 유리 질감과 시원한 하이라이트를 강조한 모던 기물", icon: "♕" },
  { id: "avatar_rockey", name: "Rockey Crown", kind: "프로필", price: 800, desc: "프로필에 왕관 포인트를 더하는 프레임", icon: "♛" },
  { id: "avatar_diamond", name: "Diamond Frame", kind: "프로필", price: 1800, desc: "다이아몬드 등급의 고급 프로필 프레임", icon: "◇" },
  { id: "effect_spark", name: "Move Spark", kind: "효과", price: 1500, desc: "수를 둘 때 도착 칸에서 짧게 반짝이는 이동 효과", icon: "✧" },
  { id: "effect_royal", name: "Royal Trail", kind: "효과", price: 2200, desc: "마지막 수에 우아한 궤적을 남기는 효과", icon: "➜" },
  { id: "title_master", name: "Rockey Master", kind: "칭호", price: 2500, desc: "프로필에 Rockey Master 칭호를 표시", icon: "M" },
  { id: "title_tactician", name: "Tactician", kind: "칭호", price: 3200, desc: "전술 감각을 표현하는 플레이어 칭호", icon: "T" },
  { id: "sound_classic", name: "Classic Board Sound", kind: "사운드", price: 1000, desc: "폰부터 킹까지 기물마다 다른 나무 보드 타격음과 잡기·캐슬링 효과음을 제공하는 사운드 팩", icon: "♪" },
];

const SOUND_PIECES = [
  { code: "p", glyph: "♟", label: "폰" },
  { code: "n", glyph: "♞", label: "나이트" },
  { code: "b", glyph: "♝", label: "비숍" },
  { code: "r", glyph: "♜", label: "룩" },
  { code: "q", glyph: "♛", label: "퀸" },
  { code: "k", glyph: "♚", label: "킹" },
];

const BOARD_PREVIEW = ["theme_midnight", "theme_royal", "theme_gold"];

function BoardPreview({ theme }) {
  return (
    <div className={`shopBoardPreview ${theme}`} aria-label={`${theme} 체스판 미리보기`}>
      {Array.from({ length: 16 }, (_, index) => (
        <i key={index} className={(Math.floor(index / 4) + index % 4) % 2 === 0 ? "previewLight" : "previewDark"} />
      ))}
      <span className="previewBoardShine" />
    </div>
  );
}

function PiecePreview({ theme }) {
  return (
    <div className={`shopPiecePreview piece-theme-${theme}`} aria-label="기물 세트 미리보기">
      {["wK", "wQ", "wR", "wB", "wN", "wP"].map((piece) => (
        <img key={piece} src={`${import.meta.env.BASE_URL}pieces/${piece}.png`} alt="" />
      ))}
    </div>
  );
}

export default function Shop() {
  const [user, setUser] = useState(null);
  const [loginId, setLoginId] = useState(null);
  const [coins, setCoins] = useState(0);
  const [owned, setOwned] = useState([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("전체");
  const [previewing, setPreviewing] = useState("");

  const load = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);
    if (!currentUser) return;

    const id = currentUser.user_metadata?.login_id
      || currentUser.user_metadata?.username
      || currentUser.email?.split("@")[0]
      || currentUser.id;

    setLoginId(id);
    const [{ data: profile }, { data: inventory }] = await Promise.all([
      supabase.from("users").select("rock_king_coin").eq("login_id", id).maybeSingle(),
      supabase.from("user_inventory").select("item_id").eq("user_id", currentUser.id),
    ]);
    setCoins(Number(profile?.rock_king_coin || 0));
    setOwned((inventory || []).map((item) => item.item_id));
  };

  useEffect(() => { load(); }, []);

  const categories = ["전체", ...new Set(ITEMS.map((item) => item.kind))];
  const visible = useMemo(
    () => filter === "전체" ? ITEMS : ITEMS.filter((item) => item.kind === filter),
    [filter]
  );

  const buy = async (item) => {
    if (!user || !loginId) {
      setMessage("로그인 후 이용할 수 있어요.");
      return;
    }
    if (owned.includes(item.id)) {
      setMessage("이미 보유한 아이템입니다.");
      return;
    }
    const accepted = window.confirm(
      `[${item.name}]을(를) ${item.price.toLocaleString()} ROCK-KING-COIN에 구매할까요?\n구매 후에는 환불할 수 없습니다.`
    );
    if (!accepted) return;

    setBusy(item.id);
    setMessage("");
    const { data, error } = await supabase.rpc("purchase_rock_king_item", {
      p_item_id: item.id,
      p_price: item.price,
      p_login_id: loginId,
      p_user_id: user.id,
    });
    setBusy("");

    if (error) {
      setMessage(error.message);
      return;
    }
    if (!data?.ok) {
      setMessage(data?.message || "구매할 수 없습니다.");
      return;
    }

    setCoins(Number(data.balance));
    setOwned((previous) => [...previous, item.id]);
    setMessage(`${item.name} 구매 완료! 꾸미기 메뉴에서 장착할 수 있어요.`);
  };

  const playPiecePreview = (piece) => {
    setPreviewing(piece);
    playChessAudio("move", piece, "sound_classic");
    window.setTimeout(() => setPreviewing(""), 260);
  };

  return (
    <div className="featurePage shopPage">
      <div className="featureShell">
        <div className="shopHero">
          <div>
            <div className="featureKicker">ROCKEY CHESS ECONOMY</div>
            <h1 className="featureTitle">Rock-King Shop</h1>
            <p className="featureSub">보드와 기물, 이동 효과, 실제 대국 사운드까지 나만의 체스 세트를 완성하세요.</p>
          </div>
          <div className="shopBalance">
            <span>ROCK-KING-COIN</span>
            <strong>◈ {coins.toLocaleString()}</strong>
            <small>체스 전용 재화 · 돌돌코인과 별도 운영</small>
          </div>
        </div>

        {message && <div className="notice shopNotice" role="status">{message}</div>}

        <div className="shopSectionHeading">
          <div><span>COLLECTION</span><h2>나만의 체스 장비</h2></div>
          <small>{visible.length} ITEMS</small>
        </div>

        <div className="shopFilters" role="tablist" aria-label="상점 카테고리">
          {categories.map((category) => (
            <button
              type="button"
              role="tab"
              aria-selected={filter === category}
              key={category}
              className={filter === category ? "selected" : ""}
              onClick={() => setFilter(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="featureGrid shopGrid">
          {visible.map((item) => {
            const isOwned = owned.includes(item.id);
            return (
              <article className={`shopItem shopItem-${item.kind === "사운드" ? "sound" : "standard"}`} key={item.id}>
                <div className="shopItemTop">
                  <div className="shopIcon">{item.icon}</div>
                  <span className="shopKind">{item.kind}</span>
                  {isOwned && <span className="shopOwnedMark">보유 중</span>}
                </div>
                {BOARD_PREVIEW.includes(item.id) && <BoardPreview theme={item.id} />}
                {item.kind === "기물" && <PiecePreview theme={item.id} />}
                {item.kind === "사운드" && (
                  <div className="shopSoundPanel">
                    <div className="shopSoundPanelTop">
                      <span className="shopSoundWave" aria-hidden="true"><i /><i /><i /><i /><i /></span>
                      <b>기물별 사운드 미리 듣기</b>
                    </div>
                    <p>각 기물을 눌러 나무 보드에 놓이는 소리를 비교해 보세요.</p>
                    <div className="shopSoundSamples">
                      {SOUND_PIECES.map((piece) => (
                        <button
                          type="button"
                          key={piece.code}
                          className={previewing === piece.code ? "previewing" : ""}
                          onClick={() => playPiecePreview(piece.code)}
                          aria-label={`${piece.label} 사운드 미리 듣기`}
                          title={`${piece.label} 사운드 미리 듣기`}
                        >
                          <span>{piece.glyph}</span><small>{piece.label}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="shopItemCopy">
                  <h3>{item.name}</h3>
                  <p>{item.desc}</p>
                </div>
                <div className="shopBottom">
                  <strong>◈ {item.price.toLocaleString()}</strong>
                  <button
                    type="button"
                    className={`featureButton ${isOwned ? "shopOwnedButton" : ""}`}
                    disabled={busy === item.id || isOwned}
                    onClick={() => buy(item)}
                  >
                    {isOwned ? "보유 중 ✓" : busy === item.id ? "구매 중…" : "구매하기"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        <p className="shopFooterNote">구매한 보드·기물·사운드는 <b>체스 꾸미기</b>에서 장착해야 대국에 적용됩니다.</p>
      </div>
    </div>
  );
}
