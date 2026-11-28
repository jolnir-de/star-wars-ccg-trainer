'use strict';
const jpChoiceBase={draw:drawDestinySeries,usedLoss:moveUsedPileLosses};
drawDestinySeries=function(side,purpose,count,modifier,complete){
 return jpChoiceBase.draw(side,purpose,count,modifier,draws=>{
  if(!jpEnabled()||purpose!=='battle'||draws.filter(d=>!d.cancelled).length<=2){complete(draws);return;}
  withShipWeaponResponse({kind:'jpBattleDraws',side,site:battleSession?.site,draws},()=>complete(draws));
 });
};
jpInterruptProviders.push(({card,side,window,offer})=>{
 if(card.id!=='Dark:2831'||window?.kind!=='jpBattleDraws'||window.side===side||window.draws.filter(d=>!d.cancelled).length<=2)return;
 offer('woundedDraws',[],'Zwei gegnerische Battle-Draws behalten, alle anderen aufheben',(parent,done)=>{
  const pool=parent.draws.filter(d=>!d.cancelled),kept=[];
  const choose=()=>jpChoose(side,card,'WoundedDestiny',pool.filter(d=>!kept.includes(d)).map((draw,i)=>({args:[i],card:draw.card,draw,label:draw.card.name+' ('+draw.value+') behalten'})),choice=>{kept.push(choice.draw);if(kept.length<2){choose();return;}for(const draw of pool)if(!kept.includes(draw))draw.cancelled=true;done();},{shown:pool.map(d=>d.card),publicView:true});choose();
 });
});
moveUsedPileLosses=function(side,order){
 const frame=state.pendingCardView,actor=frame?.interruptFrame?.side??(frame?.opponent?PremiereGame.otherSide(frame.opponent):null);
 if(!jpEnabled()||!frame||jpTitle(frame.card)!=='tusken scavengers'||!actor||!jpHas(actor,'Dark:2275'))return jpChoiceBase.usedLoss(side,order);
 const used=jpOwn(side).used,found=order.filter(card=>used.includes(card));for(const card of found)used.splice(used.indexOf(card),1);
 state.jpScavenged={side,actor,cards:found};
 const choose=()=>{const card=found.shift();if(!card){delete state.jpScavenged;return;}state.jpScavenged.current=card;
  jpChoose(actor,frame.card,'Scavengers',[{args:['steal'],label:card.name+' stehlen und auf eigene Used Pile legen'},{args:['lost'],label:card.name+' beim Gegner verlieren lassen'}],choice=>{if(choice.args[0]==='steal'){card.owner=actor;card.controller=actor;jpOwn(actor).used.push(card);}else loseOwnedCard(card,side,'lifeForce');choose();});
 };(state.hothDeferred??=[]).push(choose);
};
