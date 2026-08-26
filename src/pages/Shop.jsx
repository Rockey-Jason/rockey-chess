import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import "../styles/feature.css";

const ITEMS = [
 {id:"theme_midnight",name:"Midnight Arena",kind:"보드",price:500,desc:"차분한 네이비와 아이스 블루의 프로 보드 테마",icon:"◼"},
 {id:"theme_royal",name:"Royal Walnut",kind:"보드",price:900,desc:"클래식 월넛과 아이보리 체스클럽 테마",icon:"♜"},
 {id:"theme_gold",name:"Imperial Gold",kind:"보드",price:1400,desc:"금빛 포인트가 들어간 프리미엄 테마",icon:"✦"},
 {id:"piece_classic",name:"Classic Staunton",kind:"기물",price:700,desc:"정통 토너먼트 스타일 기물 세트",icon:"♞"},
 {id:"piece_neo",name:"Neo Glass",kind:"기물",price:1200,desc:"깔끔하고 선명한 현대식 기물 세트",icon:"♕"},
 {id:"avatar_rockey",name:"Rockey Crown",kind:"프로필",price:800,desc:"프로필을 위한 왕관 프레임",icon:"♛"},
 {id:"avatar_diamond",name:"Diamond Frame",kind:"프로필",price:1800,desc:"다이아몬드 등급 프로필 프레임",icon:"◇"},
 {id:"effect_spark",name:"Move Spark",kind:"효과",price:1500,desc:"수를 둘 때 짧게 반짝이는 이동 효과",icon:"✧"},
 {id:"effect_royal",name:"Royal Trail",kind:"효과",price:2200,desc:"마지막 수에 우아한 이동 흔적을 표시",icon:"➜"},
 {id:"title_master",name:"Rockey Master",kind:"칭호",price:2500,desc:"프로필에 Rockey Master 칭호를 표시",icon:"M"},
 {id:"title_tactician",name:"Tactician",kind:"칭호",price:3200,desc:"전술을 즐기는 플레이어를 위한 칭호",icon:"T"},
 {id:"sound_classic",name:"Classic Sound",kind:"사운드",price:1000,desc:"정갈한 체스 클럽 스타일 효과음 팩",icon:"♪"},
];

export default function Shop(){
 const [user,setUser]=useState(null),[loginId,setLoginId]=useState(null),[coins,setCoins]=useState(0),[owned,setOwned]=useState([]),[busy,setBusy]=useState(""),[message,setMessage]=useState(""),[filter,setFilter]=useState("전체");
 const load=async()=>{const {data:{user}}=await supabase.auth.getUser();setUser(user);if(!user)return;const id=user.user_metadata?.login_id||user.user_metadata?.username||user.email?.split("@")[0]||user.id;setLoginId(id);const {data:u}=await supabase.from("users").select("rock_king_coin").eq("login_id",id).maybeSingle();setCoins(Number(u?.rock_king_coin||0));const {data:i}=await supabase.from("user_inventory").select("item_id").eq("user_id",user.id);setOwned((i||[]).map(x=>x.item_id));};
 useEffect(()=>{load()},[]);
 const categories=["전체",...new Set(ITEMS.map(x=>x.kind))];
 const visible=useMemo(()=>filter==="전체"?ITEMS:ITEMS.filter(x=>x.kind===filter),[filter]);
 const buy=async item=>{if(!user||!loginId){setMessage("로그인 후 이용할 수 있어요.");return}if(owned.includes(item.id)){setMessage("이미 보유한 아이템입니다.");return}setBusy(item.id);setMessage("");const {data,error}=await supabase.rpc("purchase_rock_king_item",{p_item_id:item.id,p_price:item.price,p_login_id:loginId,p_user_id:user.id});setBusy("");if(error){setMessage(error.message);return}if(!data?.ok){setMessage(data?.message||"구매할 수 없습니다.");return}setCoins(Number(data.balance));setOwned(v=>[...v,item.id]);setMessage(`${item.name} 구매 완료!`)};
 return <div className="featurePage shopPage"><div className="featureShell">
   <div className="shopHero"><div><div className="featureKicker">ROCKEY CHESS ECONOMY</div><h1 className="featureTitle">Rock-King Shop</h1><p className="featureSub">돌이사이트의 <b>돌돌코인</b>과 완전히 분리된 체스 전용 화폐입니다.</p></div><div className="shopBalance"><span>ROCK-KING-COIN</span><strong>◈ {coins.toLocaleString()}</strong></div></div>
   {message&&<div className="notice" style={{marginBottom:16}}>{message}</div>}
   <div className="shopFilters">{categories.map(c=><button key={c} className={filter===c?"selected": ""} onClick={()=>setFilter(c)}>{c}</button>)}</div>
   <div className="featureGrid shopGrid">{visible.map(item=><div className="shopItem" key={item.id}><div className="shopIcon">{item.icon}</div><div className="shopKind">{item.kind}</div><h3>{item.name}</h3><p>{item.desc}</p><div className="shopBottom"><strong>◈ {item.price.toLocaleString()}</strong><button className="featureButton" disabled={busy===item.id||owned.includes(item.id)} onClick={()=>buy(item)}>{owned.includes(item.id)?"보유 중":busy===item.id?"구매 중…":"구매"}</button></div></div>)}</div>
 </div></div>
}
