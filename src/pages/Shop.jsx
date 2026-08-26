import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import "../styles/feature.css";

const ITEMS=[
 {id:"theme_midnight",name:"미드나이트 보드",kind:"board_theme",price:500,desc:"깊은 남색의 돌이체스 보드 테마"},
 {id:"theme_gold",name:"돌돌 골드",kind:"board_theme",price:1200,desc:"황금빛 포인트 테마"},
 {id:"avatar_rockey",name:"돌이 왕관",kind:"avatar_frame",price:800,desc:"프로필에 왕관 프레임을 적용"},
 {id:"effect_spark",name:"돌돌 스파크",kind:"move_effect",price:1500,desc:"수 둘 때 반짝이는 효과"},
 {id:"title_master",name:"돌이 마스터 칭호",kind:"title",price:2500,desc:"프로필 칭호: 돌이 마스터"}
];

export default function Shop(){
 const [user,setUser]=useState(null),[coins,setCoins]=useState(0),[owned,setOwned]=useState([]),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const load=async()=>{const {data:{user}}=await supabase.auth.getUser();setUser(user);if(!user)return;const loginId=user.user_metadata?.login_id||user.user_metadata?.username||user.email?.split("@")[0]||user.id;const {data:u}=await supabase.from("users").select("doldolcoin").eq("login_id",loginId).maybeSingle();setCoins(Number(u?.doldolcoin||0));const {data:i}=await supabase.from("user_inventory").select("item_id").eq("user_id",user.id);setOwned((i||[]).map(x=>x.item_id));};
 useEffect(()=>{load()},[]);
 const buy=async item=>{if(!user){setMessage("로그인 후 이용할 수 있어요.");return}if(owned.includes(item.id)){setMessage("이미 보유한 아이템입니다.");return}setBusy(true);setMessage("");const {data,error}=await supabase.rpc("purchase_shop_item",{p_item_id:item.id,p_price:item.price});setBusy(false);if(error){setMessage(error.message);return}if(!data?.ok){setMessage(data?.message||"구매할 수 없습니다.");return}setCoins(Number(data.balance));setOwned(v=>[...v,item.id]);setMessage(`${item.name} 구매 완료!`)};
 return <div className="featurePage"><div className="featureShell"><Link to="/" className="featureSub">← 대국으로</Link><h1 className="featureTitle">🪙 돌이코인 상점</h1><p className="featureSub">돌이체스에서만 쓰는 전용 화폐로 보드와 꾸미기를 구매하세요.</p><div className="featureCard" style={{marginBottom:20}}><div className="featureSub">현재 잔액</div><div className="coinBig">🪙 {coins.toLocaleString()} 돌이코인</div></div>{message&&<div className="notice" style={{marginBottom:18}}>{message}</div>}<div className="featureGrid">{ITEMS.map(item=><div className="featureCard" key={item.id}><h3>{item.name}</h3><p className="featureSub">{item.desc}</p><div className="coinBig" style={{fontSize:22}}>🪙 {item.price.toLocaleString()}</div><button className="featureButton" disabled={busy||owned.includes(item.id)} onClick={()=>buy(item)}>{owned.includes(item.id)?"보유 중":"구매"}</button></div>)}</div></div></div>
}
