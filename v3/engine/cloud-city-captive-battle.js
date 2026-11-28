'use strict';
function ccRestoreFury(){
 for(const record of state.cloudCityFury??[]){const entry=ccEntry(record.card);if(!entry)continue;detachTableCard(entry.side,entry.slot,record.card);record.card.captured=true;record.card.controller='Dark';delete record.card.cloudCityFury;
  if(ccEntry(record.escort))ccSetCaptives(record.escort,[...ccCaptives(record.escort),record.card]);else(state.pendingCustody??=[]).push({side:'Light',card:record.card,slot:record.site});
 }delete state.cloudCityFury;
}
ccInterruptProviders.push(({add,card,index,side,enemy,all,window})=>{
 if(card.id==='Light:376'&&!window){
  add(card,index,'cancelIto',[],'IT-O-Drain-Bonus für diesen Zug aufheben',{pile:'Used'});
  if(state.activeSide===side&&state.phase===3&&!battleSession)for(const [site,loc]of state.locations.entries())if(isSite(loc)&&all.some(entry=>entry.slot===site&&ccCaptives(entry.card).some(card=>(card.owner??card.side)===side&&!card.frozen)))add(card,index,'captiveFury',[site],'Eskortierte Gefangene bei '+loc.name+' kämpfen lassen',{site,pile:'Lost'});
 }
 if(window?.kind==='characterLost'&&window.side===side&&card.id==='Light:139'&&ccPersona(window.fallen,'R2-D2')&&ccOwn(side).lost.includes(window.fallen))add(card,index,'retrieveExact',[],'R2-D2 zurückholen (1 Force)',{cost:1,pile:'Lost',target:window.fallen});
 if(window?.kind==='characterLost'&&window.side===side&&card.id==='Dark:763'&&PremiereUnits.bountyHunter(window.fallen)&&ccOwn(side).lost.some(PremiereUnits.bountyHunter))add(card,index,'search',['lost'],'Bounty Hunter aus Lost Pile zurückholen (1 Force)',{cost:1,pile:'Lost',pileName:'lost',filter:PremiereUnits.bountyHunter});
 if(window||!battleSession?.damage||battleSession.damage.priority!==side)return;
 const x=battleSession,members=x.participants[side].filter(card=>ccEntry(card)),losing=x.damage.result[side.toLowerCase()+'Total']<x.damage.result[enemy.toLowerCase()+'Total'];
 if(card.id==='Dark:1188'&&isSite(state.locations[x.site]))for(const [i,entry]of all.entries())if(entry.slot===x.site&&entry.card.captured&&!entry.card.frozen&&PremiereLocations.physicalPlace(entry)===x.site)add(card,index,'forfeitCaptive',[i],entry.card.name+' forfeit',{target:entry.card,pile:'Lost'});
 if(card.id==='Light:1960'&&ccHasPersona(members,'Leia'))for(const [i,chewie]of ccOwn(side).hand.entries())if(ccPersona(chewie,'Chewie'))add(card,index,'chewieRelief',[i],'Chewie aus Hand verlieren: Schaden und Attrition erfüllen',{target:chewie,pile:'Lost'});
 if(card.id==='Light:2571'&&losing&&ccHasPersona(members,'Han')&&ccHasPersona(members,'Leia'))for(const [i,target]of members.entries())if(ccPersona(target,'Han')||ccPersona(target,'Leia'))add(card,index,'hanLeiaRelief',[i],target.name+' forfeit: Schaden und Attrition erfüllen',{target,pile:'Lost'});
});
const ccCaptiveBattleBase={settle:ccSettleBattleInterrupt,options:battleDamageOptions,move:movementRestriction,drain:forceDrainEffects,continuous:hothContinuous};
ccSettleBattleInterrupt=function(frame,parent,done){
 const mode=frame.mode.slice(3),side=frame.side,x=battleSession;
 if(mode==='retrieveExact'){const own=ccOwn(side),at=own.lost.indexOf(frame.target);if(at>=0){own.lost.splice(at,1);own.used.push(frame.target);queueRuleResponse({kind:'dagobahRetrieved',side,amount:1});}done();return true;}
 if(mode==='cancelIto'){state.cloudCityNoItoTurn=state.game.timing.turn;done();return true;}
 if(mode==='captiveFury'){
  const records=[];for(const entry of ccUnits())if(entry.slot===frame.site)for(const captive of ccCaptives(entry.card))if((captive.owner??captive.side)===side&&!captive.frozen){records.push({card:captive,escort:entry.card,site:entry.slot});ccSetCaptives(entry.card,ccCaptives(entry.card).filter(card=>card!==captive));delete captive.captured;captive.controller=side;captive.cloudCityFury=true;ccOwn(side).board[entry.slot].push(captive);}
  state.cloudCityFury=records;done();if(!initiateBattleFor(side,frame.site))ccRestoreFury();return true;
 }
 if(['forfeitCaptive','chewieRelief','hanLeiaRelief'].includes(mode)){
  const debt=x.damage.debt[side],target=frame.target;
  if(mode==='forfeitCaptive'){const value=cardForfeitValueAt(target,target.owner??target.side,x.site);ccLoseCaptive(target);debt.damage=Math.max(0,debt.damage-value);debt.attrition=Math.max(0,debt.attrition-value);}
  if(mode==='chewieRelief'){ccOwn(side).hand.splice(ccOwn(side).hand.indexOf(target),1);loseOwnedCard(target,side,'hand');debt.damage=0;debt.attrition=0;}
  if(mode==='hanLeiaRelief'){battleDamageAction(side,'battleForfeit',[x.participants[side].indexOf(target)]);debt.damage=0;debt.attrition=0;}
  done();return true;
 }
 return ccCaptiveBattleBase.settle(frame,parent,done);
};
battleDamageOptions=function(side){const options=ccCaptiveBattleBase.options(side);return cloudCityEnabled()?options.filter(option=>!option.card?.cloudCityFury||option.kind!=='battleForfeit'||option.hit):options;};
movementRestriction=function(card){return cloudCityEnabled()&&card.cloudCityFury?'Captive Fury verbietet freiwillige Bewegung.':ccCaptiveBattleBase.move(card);};
forceDrainEffects=function(side,slot){const plan=ccCaptiveBattleBase.drain(side,slot);if(!plan||!cloudCityEnabled()||state.cloudCityNoItoTurn!==state.game.timing.turn)return plan;const droid=PremiereLocations.entries(state,side).some(entry=>entry.slot===slot&&!entry.unavailable&&activeCardRules(entry.card,'captiveDrain').length);return droid?{...plan,modifier:plan.modifier-ccUnits().filter(entry=>entry.slot===slot&&entry.card.captured&&!entry.card.frozen).length}:plan;};
ccContinuousProviders.push(()=>{if(state.cloudCityFury&&!battleSession&&!state.pendingForceLoss&&!state.pendingCardView&&!PremiereGame.responseWindow(state.game))ccRestoreFury();});
