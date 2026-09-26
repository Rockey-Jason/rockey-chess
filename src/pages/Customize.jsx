import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import "../styles/feature.css";

const ITEM_META = {
  theme_midnight: { kind: "board_theme", label: "Midnight Arena", icon: "◼" },
  theme_royal: { kind: "board_theme", label: "Royal Walnut", icon: "♜" },
  theme_gold: { kind: "board_theme", label: "Imperial Gold", icon: "✦" },
  piece_classic: { kind: "piece_theme", label: "Classic Staunton", icon: "♞" },
  piece_neo: { kind: "piece_theme", label: "Neo Glass", icon: "♕" },
  avatar_rockey: { kind: "avatar_frame", label: "Rockey Crown", icon: "♛" },
  avatar_diamond: { kind: "avatar_frame", label: "Diamond Frame", icon: "◇" },
  effect_spark: { kind: "move_effect", label: "Move Spark", icon: "✧" },
  effect_royal: { kind: "move_effect", label: "Royal Trail", icon: "➜" },
  title_master: { kind: "title", label: "Rockey Master", icon: "M" },
  title_tactician: { kind: "title", label: "Tactician", icon: "T" },
  sound_classic: { kind: "sound", label: "Classic Sound", icon: "♪" },
};

const GROUPS = [
  ["board_theme", "보드 테마"],
  ["piece_theme", "기물 테마"],
  ["move_effect", "수 효과"],
  ["avatar_frame", "프로필 프레임"],
  ["title", "칭호"],
  ["sound", "사운드"],
];

const DEFAULTS = {
  board_theme: "default",
  piece_theme: "default",
  move_effect: "default",
  avatar_frame: "default",
  title: "default",
  sound: "default",
};

export default function Customize() {
  const [user, setUser] = useState(null);
  const [owned, setOwned] = useState([]);
  const [cos, setCos] = useState(DEFAULTS);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const [{ data: inventory }, { data: customization }] = await Promise.all([
      supabase.from("user_inventory").select("item_id").eq("user_id", currentUser.id),
      supabase.from("user_customization").select("customization").eq("user_id", currentUser.id).maybeSingle(),
    ]);

    setOwned((inventory || []).map((x) => x.item_id));
    setCos({ ...DEFAULTS, ...(customization?.customization || {}) });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const ownedItems = useMemo(
    () => owned.map((id) => ({ id, ...(ITEM_META[id] || { kind: "etc", label: id, icon: "◆" }) })),
    [owned]
  );

  const equip = async (kind, item) => {
    if (!user) {
      setMsg("로그인 후 이용할 수 있어요.");
      return;
    }
    if (item !== "default" && !owned.includes(item)) {
      setMsg("먼저 상점에서 구매해 주세요.");
      return;
    }

    setSaving(kind);
    setMsg("");
    const next = { ...DEFAULTS, ...cos, [kind]: item };
    const { error } = await supabase.from("user_customization").upsert({
      user_id: user.id,
      customization: next,
      updated_at: new Date().toISOString(),
    });
    setSaving("");

    if (error) {
      setMsg(error.message);
      return;
    }

    setCos(next);
    setMsg(`${item === "default" ? "기본 설정" : ITEM_META[item]?.label || item} 적용 완료!`);
  };

  if (loading) {
    return <div className="featurePage"><div className="featureShell"><div className="notice">꾸미기 정보를 불러오는 중…</div></div></div>;
  }

  return (
    <div className="featurePage">
      <div className="featureShell">
        <Link to="/" className="featureSub">← 대국으로</Link>
        <h1 className="featureTitle">🎨 돌이체스 꾸미기</h1>
        <p className="featureSub">상점에서 구매한 아이템을 장착하면 실제 체스판과 수 효과에 적용됩니다.</p>
        {msg && <div className="notice">{msg}</div>}

        {!user && <div className="notice">로그인하면 구매한 꾸미기 아이템을 장착할 수 있어요.</div>}

        <div className="featureGrid">
          {GROUPS.map(([kind, title]) => {
            const items = ownedItems.filter((item) => item.kind === kind);
            return (
              <div className="featureCard" key={kind}>
                <h3>{title}</h3>
                <button
                  className={`featureButton ${cos[kind] === "default" ? "" : "secondary"}`}
                  style={{ display: "block", width: "100%", marginTop: 8 }}
                  onClick={() => equip(kind, "default")}
                  disabled={saving === kind}
                >
                  기본값 {cos[kind] === "default" ? "✓" : ""}
                </button>

                {items.length === 0 && (
                  <div className="featureSub" style={{ marginTop: 12 }}>보유한 아이템이 없습니다.</div>
                )}

                {items.map((item) => (
                  <button
                    key={item.id}
                    className={`featureButton ${cos[kind] === item.id ? "" : "secondary"}`}
                    style={{ display: "block", width: "100%", marginTop: 8 }}
                    onClick={() => equip(kind, item.id)}
                    disabled={saving === kind}
                  >
                    {item.icon} {item.label} {cos[kind] === item.id ? "✓" : ""}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
