import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Chess } from "chess.js";
import { supabase } from "../supabase";
import "../styles/feature.css";
import "./PvP.css";

const FILES = ["a","b","c","d","e","f","g","h"];
const GLYPHS={w:{p:"♙",n:"♘",b:"♗",r:"♖",q:"♕",k:"♔"},b:{p:"♟",n:"♞",b:"♝",r:"♜",q:"♛",k:"♚"}};

async function getProfile(){
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return {user:null,loginId:null,profile:{}};
  const loginId=user.user_metadata?.login_id||user.user_metadata?.username||user.email?.split("@")[0]||user.id;
  const {data}=await supabase.from("users").select("*").eq("login_id",loginId).maybeSingle();
  return {user,loginId,profile:data||{}};
}

export default function PvP(){
  const [user,setUser]=useState(null),[loginId,setLoginId]=useState(null),[profile,setProfile]=useState({});
  const [room,setRoom]=useState(null),[channel,setChannel]=useState(null),[status,setStatus]=useState("빠른 대전을 준비하세요.");
  const [game,setGame]=useState(()=>new Chess()),[color,setColor]=useState(null),[selected,setSelected]=useState(null),[lastMove,setLastMove]=useState(null);
  const [matchmaking,setMatchmaking]=useState(false),[joinCode,setJoinCode]=useState(""),[opponent,setOpponent]=useState(null),[ratingChange,setRatingChange]=useState(null),[finished,setFinished]=useState(false);
  const pointerRef=useRef(null); const gameRef=useRef(game); gameRef.current=game;

  const load=useCallback(async()=>{const x=await getProfile();setUser(x.user);setLoginId(x.loginId);setProfile(x.profile);},[]);
  useEffect(()=>{load()},[load]);

  const broadcast=useCallback((event,payload)=>channel?.send({type:"broadcast",event,payload}),[channel]);

  const finishLocal=useCallback(async(result)=>{
    if(finished) return; setFinished(true);
    const winner=result==="1-0"?"w":result==="0-1"?"b":null;
    const iWon=winner===color;
    if(result==="1/2-1/2") {setStatus("무승부 · 레이팅 변동 없음");setRatingChange(0)}
    else setStatus(iWon?"승리했습니다! 레이팅이 상승합니다.":"패배했습니다. 레이팅이 조정됩니다.");
    await broadcast("result",{result,winner,finishedBy:user?.id});
    if(room?.id){
      const {data,error}=await supabase.rpc("finish_pvp_game",{p_room_id:room.id,p_result:result});
      if(!error&&data?.rating_change!=null) setRatingChange(Number(data.rating_change));
    }
  },[broadcast,color,finished,room?.id,user?.id]);

  useEffect(()=>{
    if(!room||!user) return;
    const ch=supabase.channel(`rockey-pvp:${room.id}`,{config:{broadcast:{ack:true}}})
      .on("broadcast",{event:"state"},({payload})=>{
        if(payload?.sender===user.id) return;
        try{const g=new Chess(payload.fen);setGame(g);setLastMove(payload.move||null);setSelected(null);setStatus(`상대 수 ${payload.san||""}`);if(g.isGameOver()){finishLocal(g.isCheckmate()?(g.turn()==="w"?"0-1":"1-0"):"1/2-1/2")}}catch{}
      })
      .on("broadcast",{event:"join"},({payload})=>{if(payload?.userId!==user.id){setStatus("상대가 입장했습니다. 대국 시작!");setOpponent(payload.profile||null)}})
      .on("broadcast",{event:"result"},({payload})=>{if(payload?.finishedBy!==user.id){setFinished(true);setStatus(payload.result==="1/2-1/2"?"무승부":"상대가 대국을 종료했습니다.")}})
      .subscribe(s=>{if(s==="SUBSCRIBED") ch.send({type:"broadcast",event:"join",payload:{userId:user.id,profile:{name:profile.nickname||profile.name||loginId,rating:Number(profile.chess_rating||0),image:profile.profile_image||profile.avatar_url||""}}})});
    setChannel(ch);return()=>{supabase.removeChannel(ch);setChannel(null)};
  },[room?.id,user?.id,profile,loginId,finishLocal]);

  const createRoom=async(privateCode=null)=>{
    if(!user||!loginId){setStatus("로그인 후 이용하세요.");return null}
    const rating=Number(profile.chess_rating||0);
    const code=privateCode||Math.random().toString(36).slice(2,8).toUpperCase();
    const {data,error}=await supabase.from("pvp_rooms").insert({code,host_id:user.id,host_login_id:loginId,host_rating:rating,status:"waiting",fen:new Chess().fen()}).select().single();
    if(error){setStatus(error.message);return null}
    setRoom(data);setColor("w");setGame(new Chess());setFinished(false);setStatus(privateCode?`방 ${code} 생성 · 상대를 기다리는 중` : `방 ${code} 생성 · 비슷한 레이팅 상대를 기다리는 중`);return data;
  };

  const quickMatch=async()=>{
    if(!user||!loginId){setStatus("로그인 후 이용하세요.");return}
    setMatchmaking(true);setStatus("비슷한 레이팅의 상대를 찾는 중…");
    const rating=Number(profile.chess_rating||0),min=Math.max(0,rating-150),max=rating+150;
    const {data}=await supabase.from("pvp_rooms").select("*").eq("status","waiting").neq("host_id",user.id).gte("host_rating",min).lte("host_rating",max).order("created_at",{ascending:true}).limit(1).maybeSingle();
    if(data){
      const {data:updated,error}=await supabase.from("pvp_rooms").update({guest_id:user.id,guest_login_id:loginId,guest_rating:rating,status:"playing"}).eq("id",data.id).eq("status","waiting").select().single();
      if(!error&&updated){setRoom(updated);setColor("b");setGame(new Chess(updated.fen));setFinished(false);setStatus("매칭 완료! 백의 첫 수를 기다리세요.");setOpponent({name:updated.host_login_id,rating:updated.host_rating});setMatchmaking(false);return;}
    }
    await createRoom();setMatchmaking(false);
  };

  const join=async()=>{
    if(!user||!loginId)return setStatus("로그인 후 이용하세요.");
    const code=joinCode.trim().toUpperCase(); if(!code)return;
    const {data}=await supabase.from("pvp_rooms").select("*").eq("code",code).eq("status","waiting").maybeSingle();
    if(!data)return setStatus("입장 가능한 방을 찾지 못했습니다.");
    const rating=Number(profile.chess_rating||0);
    const {data:updated,error}=await supabase.from("pvp_rooms").update({guest_id:user.id,guest_login_id:loginId,guest_rating:rating,status:"playing"}).eq("id",data.id).eq("status","waiting").select().single();
    if(error||!updated)return setStatus(error?.message||"방 참가에 실패했습니다.");
    setRoom(updated);setColor("b");setGame(new Chess(updated.fen));setOpponent({name:updated.host_login_id,rating:updated.host_rating});setStatus("대결 시작! 백의 첫 수를 기다리세요.");
  };

  const legal=useMemo(()=>selected?game.moves({square:selected,verbose:true}).map(x=>x.to):[],[game,selected]);
  const moveTo=useCallback((from,to)=>{
    if(finished||!room||!color||game.turn()!==color)return;
    try{const g=new Chess(game.fen());const m=g.move({from,to,promotion:"q"});if(!m)return;setGame(g);setSelected(null);setLastMove(m);broadcast("state",{sender:user.id,fen:g.fen(),san:m.san,move:m});if(g.isGameOver()) finishLocal(g.isCheckmate()?(g.turn()==="w"?"0-1":"1-0"):"1/2-1/2");}catch{}
  },[broadcast,color,finishLocal,finished,game,room,user?.id]);
  const click=sq=>{if(finished||game.turn()!==color)return;const p=game.get(sq);if(selected&&legal.includes(sq))return moveTo(selected,sq);if(p?.color===color)setSelected(sq);else setSelected(null)};

  const board=useMemo(()=>{const out=[];for(let r=8;r>=1;r--)for(let c=0;c<8;c++){const sq=FILES[c]+r,p=game.get(sq),light=(r+c)%2===0;out.push(<button key={sq} className={`pvpSquare ${light?"light":"dark"} ${selected===sq?"selected":""} ${legal.includes(sq)?"legal":""} ${lastMove?.from===sq||lastMove?.to===sq?"last":""}`} onClick={()=>click(sq)} onPointerDown={e=>{if(e.pointerType!=="mouse"&&p?.color===color){pointerRef.current=sq;setSelected(sq)}}} onPointerUp={e=>{if(e.pointerType!=="mouse"&&pointerRef.current){const from=pointerRef.current;pointerRef.current=null;if(from!==sq)moveTo(from,sq)}}} onDragOver={e=>e.preventDefault()} onDrop={e=>{const from=e.dataTransfer.getData("from");if(from)moveTo(from,sq)}}>{p&&<span draggable onDragStart={e=>{e.dataTransfer.setData("from",sq);setSelected(sq)}}>{GLYPHS[p.color][p.type]}</span>}</button>)}return out},[click,color,game,lastMove,legal,moveTo,selected]);

  const me={name:profile.nickname||profile.name||loginId||"나",rating:Number(profile.chess_rating||0),image:profile.profile_image||profile.avatar_url||""};
  const opp=opponent||{name:room?.host_login_id===loginId?room?.guest_login_id:room?.host_login_id,rating:room?.host_login_id===loginId?room?.guest_rating:room?.host_rating};

  return <div className="featurePage pvpPage"><div className="featureShell pvpShell"><Link to="/" className="featureSub">← 대국으로</Link><div className="pvpHeader"><div><div className="featureTitle">실시간 PvP</div><p className="featureSub">현재 레이팅 ±150 범위의 상대를 우선 매칭합니다. 수와 결과는 Supabase Realtime으로 동기화됩니다.</p></div><div className="pvpRating">{me.rating.toLocaleString()} <span>RATING</span></div></div>
  <div className="pvpControls"><button className="featureButton" disabled={matchmaking||!!room} onClick={quickMatch}>{matchmaking?"상대를 찾는 중…":"⚡ 빠른 대전"}</button><button className="featureButton secondary" disabled={!!room} onClick={()=>createRoom()}>방 만들기</button><div className="joinBox"><input className="input" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="방 코드"/><button className="featureButton" disabled={!!room} onClick={join}>참가</button></div></div>
  <div className="pvpStatus">{status}</div>
  {room&&<div className="pvpGame"><div className="pvpPlayer"><div className="pvpAvatar">{opp.image?<img src={opp.image} alt=""/>:"♟"}</div><div><b>{opp.name||"상대"}</b><small>{Number(opp.rating||0).toLocaleString()} rating</small></div><span>{color==="b"?"상대 차례":""}</span></div><div className="pvpBoard">{board}</div><div className="pvpPlayer self"><div className="pvpAvatar">{me.image?<img src={me.image} alt=""/>:"♙"}</div><div><b>{me.name}</b><small>{me.rating.toLocaleString()} rating</small></div><span>{finished?"종료":game.turn()===color?"YOUR TURN":"상대 차례"}</span></div>{finished&&<div className="pvpResult">{status}<strong>{ratingChange!=null?`${ratingChange>=0?"+":""}${ratingChange} rating":""}</strong></div>}</div>}
  </div></div>
}
