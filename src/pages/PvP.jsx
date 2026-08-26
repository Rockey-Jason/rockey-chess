import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { supabase } from "../supabase";
import "../styles/feature.css";
import "./PvP.css";

const FILES = ["a","b","c","d","e","f","g","h"];

function loginFromUser(user){
  return user?.user_metadata?.login_id || user?.user_metadata?.username || user?.email?.split("@")[0] || user?.id || null;
}
function profileFromRow(row, fallbackName="상대"){
  return { name:row?.nickname||row?.name||row?.login_id||fallbackName, rating:Number(row?.chess_rating??row?.rating??0), image:row?.profile_image||row?.avatar_url||"" };
}
function sound(name){ try { const a=new Audio(`${import.meta.env.BASE_URL}sounds/${name}.mp3`); a.volume=.62; a.play().catch(()=>{}); } catch {} }

export default function PvP(){
 const [user,setUser]=useState(null),[loginId,setLoginId]=useState(null),[profile,setProfile]=useState({});
 const [room,setRoom]=useState(null),[game,setGame]=useState(()=>new Chess()),[color,setColor]=useState(null),[selected,setSelected]=useState(null),[lastMove,setLastMove]=useState(null);
 const [status,setStatus]=useState("빠른 대전 또는 방 참가로 시작하세요."),[matchmaking,setMatchmaking]=useState(false),[joinCode,setJoinCode]=useState("");
 const [opponent,setOpponent]=useState(null),[finished,setFinished]=useState(false),[ratingChange,setRatingChange]=useState(null);
 const [messages,setMessages]=useState([]),[chat,setChat]=useState(""),[drawOffer,setDrawOffer]=useState(false),[rematchOffer,setRematchOffer]=useState(false),[lastChatNotice,setLastChatNotice]=useState("");
 const [rematchPending,setRematchPending]=useState(false);
 const pointerRef=useRef(null),gameRef=useRef(game),colorRef=useRef(color),finishedRef=useRef(finished),channelRef=useRef(null),userRef=useRef(user),roomRef=useRef(room);
 gameRef.current=game;colorRef.current=color;finishedRef.current=finished;userRef.current=user;roomRef.current=room;

 const load=useCallback(async()=>{const {data:{user}}=await supabase.auth.getUser();setUser(user);const id=loginFromUser(user);setLoginId(id);if(!user||!id)return;const {data}=await supabase.from("users").select("nickname,name,login_id,chess_rating,profile_image,avatar_url,rock_king_coin").eq("login_id",id).maybeSingle();setProfile(data||{});},[]);
 useEffect(()=>{load()},[load]);
 const me=profileFromRow({...profile,login_id:loginId},"나");
 const opp=opponent||profileFromRow({login_id:room?.host_login_id===loginId?room?.guest_login_id:room?.host_login_id,chess_rating:room?.host_login_id===loginId?room?.guest_rating:room?.host_rating},"상대");

 const broadcast=useCallback((event,payload)=>{channelRef.current?.send({type:"broadcast",event,payload})},[]);
 const resultForCheckmate=g=>g.isCheckmate()?(g.turn()==="w"?"0-1":"1-0"):"1/2-1/2";

 const finishLocal=useCallback(async(result)=>{
   if(finishedRef.current)return;
   finishedRef.current=true;setFinished(true);
   const winner=result==="1-0"?"w":result==="0-1"?"b":null;const won=winner===colorRef.current;
   setStatus(result==="1/2-1/2"?"무승부 · 레이팅 변동 없음":won?"승리했습니다!":"패배했습니다!");
   sound(result==="1/2-1/2"?"draw":won?"win":"loss");
   broadcast("result",{result,finishedBy:userRef.current?.id,winner});
   if(roomRef.current?.id){const {data,error}=await supabase.rpc("finish_pvp_game",{p_room_id:roomRef.current.id,p_result:result});if(!error&&data?.rating_change!==undefined)setRatingChange(Number(data.rating_change));}
 },[broadcast]);

 useEffect(()=>{
  if(!room?.id||!user?.id)return;
  const ch=supabase.channel(`rockey-pvp:${room.id}`,{config:{broadcast:{ack:true}}})
   .on("broadcast",{event:"join"},({payload})=>{if(payload?.userId===user.id)return;setOpponent(payload.profile||null);setStatus("상대가 입장했습니다. 대국을 시작하세요!");sound("start")})
   .on("broadcast",{event:"state"},({payload})=>{if(payload?.sender===user.id)return;try{const next=new Chess(payload.fen);setGame(next);setLastMove(payload.move||null);setSelected(null);setStatus(payload.san?`상대가 ${payload.san}을 두었습니다.`:"상대의 수를 기다리는 중");sound("move");if(next.isGameOver())finishLocal(resultForCheckmate(next));}catch{setStatus("상대의 수를 처리하지 못했습니다.")}})
   .on("broadcast",{event:"chat"},({payload})=>{if(payload?.sender===user.id)return;setMessages(v=>[...v,{id:`${Date.now()}-${Math.random()}`,from:"opponent",text:String(payload.text||""),time:new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})}])})
   .on("broadcast",{event:"draw_offer"},({payload})=>{if(payload?.sender!==user.id){setDrawOffer(true);setStatus("상대가 무승부를 요청했습니다.")}})
   .on("broadcast",{event:"draw_decline"},({payload})=>{if(payload?.sender!==user.id){setStatus("상대가 무승부 요청을 거절했습니다.")}})
   .on("broadcast",{event:"draw_accept"},({payload})=>{if(payload?.sender!==user.id)finishLocal("1/2-1/2")})
   .on("broadcast",{event:"resign"},({payload})=>{if(payload?.sender!==user.id){setStatus("상대가 기권했습니다.");finishLocal(colorRef.current==="w"?"1-0":"0-1")}})
   .on("broadcast",{event:"rematch_request"},({payload})=>{if(payload?.sender!==user.id){setRematchOffer(true);setStatus("상대가 재대국을 요청했습니다.")}})
   .on("broadcast",{event:"rematch_start"},({payload})=>{if(payload?.sender===user.id)return;const nextColor=payload.colors?.[user.id]|| (colorRef.current==="w"?"b":"w");setColor(nextColor);colorRef.current=nextColor;const next=new Chess();setGame(next);gameRef.current=next;setFinished(false);finishedRef.current=false;setSelected(null);setLastMove(null);setRatingChange(null);setMessages([]);setRematchPending(false);setRematchOffer(false);setStatus(nextColor==="w"?"재대국 시작 · 당신의 차례입니다.":"재대국 시작 · 상대의 첫 수를 기다리세요.");sound("start")})
   .on("broadcast",{event:"result"},async({payload})=>{if(payload?.finishedBy===user.id)return;finishedRef.current=true;setFinished(true);const won=payload.winner===colorRef.current;setStatus(payload.result==="1/2-1/2"?"무승부":won?"승리했습니다!":"상대가 대국을 종료했습니다.");sound(payload.result==="1/2-1/2"?"draw":won?"win":"loss");if(loginId){const {data}=await supabase.from("users").select("chess_rating").eq("login_id",loginId).maybeSingle();if(data?.chess_rating!=null)setRatingChange(Number(data.chess_rating)-me.rating);}});
   .on("postgres_changes",{event:"UPDATE",schema:"public",table:"pvp_rooms",filter:`id=eq.${room.id}`},({new:next})=>{if(next.guest_id&&!opponent){setOpponent({name:next.guest_login_id,rating:Number(next.guest_rating||0)});setStatus("상대가 연결되었습니다. 대국을 시작하세요!")}});
  ch.subscribe(state=>{if(state!=="SUBSCRIBED")return;ch.send({type:"broadcast",event:"join",payload:{userId:user.id,profile:me}})});
  channelRef.current=ch;
  return()=>{supabase.removeChannel(ch);if(channelRef.current===ch)channelRef.current=null};
 },[room?.id,user?.id,finishLocal,loginId,profile.nickname,profile.chess_rating,profile.profile_image]);

 const createRoom=async()=>{if(!user||!loginId){setStatus("로그인 후 이용하세요.");return null}const rating=me.rating;const code=Math.random().toString(36).slice(2,8).toUpperCase();const {data,error}=await supabase.from("pvp_rooms").insert({code,host_id:user.id,host_login_id:loginId,host_rating:rating,status:"waiting",fen:new Chess().fen()}).select().single();if(error){setStatus(error.message);return null}setRoom(data);roomRef.current=data;setColor("w");colorRef.current="w";setGame(new Chess());setFinished(false);finishedRef.current=false;setStatus(`방 ${code} · 비슷한 레이팅 상대를 기다리는 중`);return data};
 const quickMatch=async()=>{if(!user||!loginId){setStatus("로그인 후 이용하세요.");return}setMatchmaking(true);setStatus("비슷한 레이팅의 상대를 찾는 중…");const rating=me.rating;const {data}=await supabase.from("pvp_rooms").select("*").eq("status","waiting").neq("host_id",user.id).gte("host_rating",Math.max(0,rating-150)).lte("host_rating",rating+150).order("created_at",{ascending:true}).limit(1).maybeSingle();if(data){const {data:updated,error}=await supabase.from("pvp_rooms").update({guest_id:user.id,guest_login_id:loginId,guest_rating:rating,status:"playing"}).eq("id",data.id).eq("status","waiting").select().single();if(!error&&updated){setRoom(updated);roomRef.current=updated;setColor("b");colorRef.current="b";setGame(new Chess(updated.fen));setOpponent({name:updated.host_login_id,rating:updated.host_rating});setFinished(false);finishedRef.current=false;setStatus("매칭 완료 · 백의 첫 수를 기다립니다.");setMatchmaking(false);return}}await createRoom();setMatchmaking(false)};
 const join=async()=>{if(!user||!loginId){setStatus("로그인 후 이용하세요.");return}const code=joinCode.trim().toUpperCase();if(!code)return;const {data}=await supabase.from("pvp_rooms").select("*").eq("code",code).eq("status","waiting").maybeSingle();if(!data){setStatus("입장 가능한 방을 찾지 못했습니다.");return}const {data:updated,error}=await supabase.from("pvp_rooms").update({guest_id:user.id,guest_login_id:loginId,guest_rating:me.rating,status:"playing"}).eq("id",data.id).eq("status","waiting").select().single();if(error||!updated){setStatus(error?.message||"방 참가에 실패했습니다.");return}setRoom(updated);roomRef.current=updated;setColor("b");colorRef.current="b";setGame(new Chess(updated.fen));setOpponent({name:updated.host_login_id,rating:updated.host_rating});setFinished(false);finishedRef.current=false;setStatus("대결 시작 · 백의 첫 수를 기다립니다.")};

 const legal=useMemo(()=>selected?game.moves({square:selected,verbose:true}).map(m=>m.to):[],[game,selected]);
 const moveTo=useCallback((from,to)=>{if(finishedRef.current||!roomRef.current||gameRef.current.turn()!==colorRef.current)return;try{const next=new Chess(gameRef.current.fen());const move=next.move({from,to,promotion:"q"});if(!move)return;gameRef.current=next;setGame(next);setSelected(null);setLastMove(move);sound("move");broadcast("state",{sender:userRef.current.id,fen:next.fen(),san:move.san,move});if(next.isGameOver())finishLocal(resultForCheckmate(next));}catch{setStatus("수 처리 중 오류가 발생했습니다.")}},[broadcast,finishLocal]);
 const clickSquare=s=>{if(finishedRef.current||gameRef.current.turn()!==colorRef.current)return;const p=gameRef.current.get(s);if(selected&&legal.includes(s)){moveTo(selected,s);return}setSelected(p?.color===colorRef.current?s:null)};
 const board=useMemo(()=>{const out=[];for(let rank=8;rank>=1;rank--){for(let fi=0;fi<8;fi++){const square=FILES[fi]+rank,piece=game.get(square),light=(rank+fi)%2===0,sel=selected===square,legalSquare=legal.includes(square),last=lastMove?.from===square||lastMove?.to===square;out.push(<button key={square} type="button" className={`pvpSquare ${light?"light":"dark"} ${sel?"selected":""} ${legalSquare?"legal":""} ${last?"last":""}`} onClick={()=>clickSquare(square)} onPointerDown={e=>{if(e.pointerType!=="mouse"&&piece?.color===colorRef.current){pointerRef.current=square;setSelected(square)}}} onPointerUp={e=>{if(e.pointerType!=="mouse"&&pointerRef.current){const from=pointerRef.current;pointerRef.current=null;if(from!==square)moveTo(from,square)}}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const from=e.dataTransfer.getData("from");if(from)moveTo(from,square)}}>{piece&&<img draggable onDragStart={e=>{e.dataTransfer.setData("from",square);setSelected(square)}} src={`${import.meta.env.BASE_URL}pieces/${piece.color}${piece.type.toUpperCase()}.png`} alt=""/>}</button>)}}return out},[game,lastMove,legal,moveTo,selected]);
 const sendChat=()=>{const text=chat.trim();if(!text||!room)return;const item={id:`${Date.now()}-${Math.random()}`,from:"me",text,time:new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})};setMessages(v=>[...v,item]);broadcast("chat",{sender:user.id,text});setChat("")};
 const offerDraw=()=>{if(finished)return;broadcast("draw_offer",{sender:user.id});setStatus("무승부 요청을 보냈습니다.");};
 const respondDraw=accept=>{setDrawOffer(false);if(accept){broadcast("draw_accept",{sender:user.id});finishLocal("1/2-1/2")}else{broadcast("draw_decline",{sender:user.id});setStatus("무승부 요청을 거절했습니다.")}};
 const resign=()=>{if(finished)return;broadcast("resign",{sender:user.id});finishLocal(color==="w"?"0-1":"1-0")};
 const requestRematch=()=>{if(!finished)return;setRematchPending(true);broadcast("rematch_request",{sender:user.id});setStatus("재대국 요청을 보냈습니다.")};
 const acceptRematch=async()=>{setRematchOffer(false);if(!room)return;const newFen=new Chess().fen();await supabase.from("pvp_rooms").update({status:"playing",fen:newFen,result:null,winner_login_id:null,finished_at:null}).eq("id",room.id);const nextColors={[user.id]:color==="w"?"b":"w",[color==="w"?room.guest_id:room.host_id]:color};broadcast("rematch_start",{sender:user.id,colors:nextColors});const nextColor=nextColors[user.id];setColor(nextColor);colorRef.current=nextColor;const next=new Chess();setGame(next);gameRef.current=next;setFinished(false);finishedRef.current=false;setSelected(null);setLastMove(null);setRatingChange(null);setMessages([]);setStatus(nextColor==="w"?"재대국 시작 · 당신의 차례입니다.":"재대국 시작 · 상대의 첫 수를 기다리세요.");sound("start")};
 const leave=()=>{channelRef.current&&supabase.removeChannel(channelRef.current);channelRef.current=null;setRoom(null);roomRef.current=null;setColor(null);setOpponent(null);setGame(new Chess());setFinished(false);finishedRef.current=false;setStatus("대기실로 돌아왔습니다.")};
 const moveHistory=game.history();
 return <div className="featurePage pvpPage"><div className="featureShell pvpShell">
   <div className="pvpTop"><div><div className="featureKicker">LIVE RATED CHESS</div><h1 className="featureTitle">실시간 PvP</h1><p className="featureSub">비슷한 레이팅의 상대와 실시간으로 대결하세요. <b>대국 중 엔진 평가는 공개하지 않습니다.</b></p></div><div className="pvpMyRating"><span>YOUR RATING</span><strong>{me.rating.toLocaleString()}</strong></div></div>
   {!room?<div className="matchPanel"><div className="matchMain"><div className="matchIcon">⚔</div><h2>다음 상대를 찾으세요</h2><p>±150 레이팅을 우선으로 빠르게 매칭합니다.</p><button className="featureButton matchButton" disabled={matchmaking} onClick={quickMatch}>{matchmaking?"상대를 찾는 중…":"⚡ 빠른 대전"}</button></div><div className="matchDivider"/><div className="roomPanel"><h3>비공개 방</h3><p>친구에게 방 코드를 공유해 대국할 수 있습니다.</p><button className="featureButton secondary" onClick={createRoom}>방 만들기</button><div className="joinRow"><input className="input" value={joinCode} maxLength={8} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="방 코드"/><button className="featureButton" onClick={join}>참가</button></div></div></div>:<div className="liveGrid">
      <section className="liveGame"><div className="playerBar"><div className="pvpAvatar">{opp.image?<img src={opp.image} alt=""/>:"♟"}</div><div><b>{opp.name||"상대"}</b><small>{opp.rating.toLocaleString()} RATING · {color==="b"?"WHITE":"BLACK"}</small></div><span className="turnBadge">{finished?"FINISHED":game.turn()!==color?"YOUR OPPONENT": "OPPONENT WAITING"}</span></div>
      <div className="pvpBoard">{board}</div>
      <div className="playerBar self"><div className="pvpAvatar">{me.image?<img src={me.image} alt=""/>:"♙"}</div><div><b>{me.name}</b><small>{me.rating.toLocaleString()} RATING · {color==="w"?"WHITE":"BLACK"}</small></div><span className="turnBadge mine">{finished?"GAME OVER":game.turn()===color?"YOUR TURN":"WAITING"}</span></div>
      <div className="liveActions"><button onClick={offerDraw} disabled={finished}>🤝 무승부</button><button onClick={resign} disabled={finished}>🏳 기권</button><button onClick={requestRematch} disabled={!finished||rematchPending}>{rematchPending?"요청 보냄":"↻ 재대국"}</button><button onClick={leave}>나가기</button></div>
      {finished&&<div className="pvpResult"><span>{status}</span><strong>{ratingChange!==null?`${ratingChange>=0?"+":""}${ratingChange} RATING`:"결과 처리 중"}</strong></div>}
      <div className="moveStrip"><span>LIVE MOVES</span>{moveHistory.slice(-10).map((m,i)=><b key={`${m.san}-${i}`}>{m.san}</b>)}</div>
      </section>
      <aside className="pvpChat"><div className="chatHeader"><div><span>LIVE MATCH</span><h3>대국 채팅</h3></div><div className="onlineDot">● LIVE</div></div><div className="chatMessages">{messages.length===0?<div className="chatEmpty">상대와 가볍게 인사를 나눠보세요.<br/>대국 중에는 엔진 평가가 표시되지 않습니다.</div>:messages.map(m=><div key={m.id} className={`chatBubble ${m.from}`}>{m.from==="opponent"&&<small>{opp.name}</small>}<p>{m.text}</p><time>{m.time}</time></div>)}</div><div className="chatInput"><input value={chat} maxLength={120} onChange={e=>setChat(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")sendChat()}} placeholder="메시지 입력…"/><button onClick={sendChat}>➤</button></div><div className="matchStatus">{status}</div></aside>
   </div>}
   {drawOffer&&<div className="pvpOverlay"><div className="requestCard"><div className="requestIcon">🤝</div><h3>무승부 요청</h3><p>{opp.name}님이 무승부를 요청했습니다.</p><div><button className="featureButton" onClick={()=>respondDraw(true)}>수락</button><button className="featureButton secondary" onClick={()=>respondDraw(false)}>거절</button></div></div></div>}
   {rematchOffer&&<div className="pvpOverlay"><div className="requestCard"><div className="requestIcon">↻</div><h3>재대국 요청</h3><p>{opp.name}님이 한 판 더 요청했습니다.</p><div><button className="featureButton" onClick={acceptRematch}>재대국</button><button className="featureButton secondary" onClick={()=>setRematchOffer(false)}>나중에</button></div></div></div>}
 </div></div>
}
