'use strict';
function dagoDrawIntoHand(side,count,next){
 const step=()=>dagoResolveTop(side,()=>{if(count--<=0||!PremiereGame.reserveCards(dagoOwn(side).deck).length){next();return;}const card=dagoOwn(side).deck.pop();delete card.dagobahFaceUp;dagoOwn(side).hand.push(card);step();});step();
}
function dagoResolveTop(side,next){
 const z=dagoOwn(side),card=z.deck.at(-1);
 if(!PremiereGame.isReserveInsert(card)||card.set!=='4'){revealReserveInserts(side);next();return;}
 z.deck.pop();const owner=card.insertedIntoReserveBy;delete card.insertedIntoReserveBy;loseOwnedCard(card,owner);
 const resume=()=>dagoResolveTop(side,next);
 if(['Light:1768','Dark:4'].includes(card.id)){
  const values=Object.fromEntries(PremiereGame.sides.map(actor=>[actor,dagoUnits().filter(entry=>entry.side===actor&&!entry.unavailable&&entry.card.type==='Character').map(entry=>printedBattleDestiny(entry.card)??0).sort((a,b)=>a-b).slice(0,3).reduce((a,b)=>a+b,0)]));
  const loser=values.Light<values.Dark?'Light':values.Dark<values.Light?'Dark':null;
  if(loser)dagoLoss(loser,Math.abs(values.Light-values.Dark),card.name,resume);else resume();return;
 }
 if(card.id==='Light:111')(state.dagobahBattleDemand??={})[side]=state.game.timing.turn+(state.activeSide===side?0:1);
 if(card.id==='Dark:1450')(state.dagobahNoBattles??={})[side]=state.game.timing.turn;
 resume();
}
const dagoTimingBase={activate:activateReserve,perform:performAction,place:placeLocationCard,convert:convertLocation,immunity:battleImmunity,forfeit:hothForfeit,battlePower:hothBattlePower,battleDraws:battleDestinyDrawCount,cardAbility,restrict:movementRestriction,prepare:prepareDamageSegment,damageAction:battleDamageAction,end:endBattleTiming,lose:loseTableCard,bot:hothBotValue,respond:hothRespond,responses:hothResponseOptions};
activateReserve=function(side,count,drawMask=0){
 if(!dagobahEnabled())return dagoTimingBase.activate(side,count,drawMask);
 const result={activated:0,drawn:0};
 const step=()=>dagoResolveTop(side,()=>{const z=dagoOwn(side);if(result.activated>=count||!PremiereGame.reserveCards(z.deck).length||activationLocked(side))return;const draw=result.activated<2&&(drawMask&(1<<result.activated));const card=z.deck.pop();delete card.dagobahFaceUp;(draw?z.hand:z.force).push(card);result.activated++;if(draw)result.drawn++;step();});
 step();return result;
};
performAction=function(action,...args){
 const before=dagobahEnabled()?Object.fromEntries(PremiereGame.sides.map(side=>[side,dagoOwn(side).used.slice()])):null,result=dagoTimingBase.perform(action,...args);
 if(result&&dagobahEnabled()){
  if(before)for(const side of PremiereGame.sides){const added=dagoOwn(side).used.filter(card=>!before[side].includes(card));if(!added.length)continue;for(const effect of dagoEffects('Light:708'))hothCancelEffect(effect);if(dagoEffects('Light:1920').length)for(const card of added)card.dagobahFaceUp=true;queueRuleResponse({kind:'dagobahUsed',side});}
  if(action.card&&action.kind!=='chooseStart')for(const demand of state.dagobahFrustrations??[])if(action.side===demand.targetSide&&dagoTitle(action.card)===demand.title&&!dagoOwn(action.side).hand.includes(action.card)&&['deploy','deployWithPilot','equip','deployDevice','deployLocation','hothAction'].includes(action.kind))demand.fulfilled=true;
 }
 return result;
};
placeLocationCard=function(side,card,position){const result=dagoTimingBase.place(side,card,position);if(result&&dagobahEnabled()&&state.phase===2){const records=state.dagobahLocationsDeployed??={},record=records[side];records[side]={turn:state.game.timing.turn,count:(record?.turn===state.game.timing.turn?record.count:0)+1};}return result;};
convertLocation=function(side,...args){const result=dagoTimingBase.convert(side,...args);if(result&&dagobahEnabled()){const records=state.dagobahLocationsDeployed??={},record=records[side];records[side]={turn:state.game.timing.turn,count:(record?.turn===state.game.timing.turn?record.count:0)+1};}return result;};
movementRestriction=function(card){if(dagobahEnabled()&&(card.dagobahMeditationUntil||card.dagobahNoMoveUntil>=state.game.timing.turn||card.dagobahDisabledUntil>=state.game.timing.turn))return 'Diese Karte darf sich momentan nicht bewegen.';return dagoTimingBase.restrict(card);};
hothForfeit=function(card,side,slot){let value=dagoTimingBase.forfeit(card,side,slot);if(!dagobahEnabled())return value;
 if(card.dagobahForfeitZeroTurn===state.game.timing.turn||card.dagobahNeuralUntil>=state.game.timing.turn)return -(card.forfeit??0);
 if(card.dagobahDebuffTurn===state.game.timing.turn)value--;

 if(squadTrooper(card,side)&&dagoUnits().some(entry=>entry.side===side&&entry.slot===slot&&entry.card.id==='Dark:1538'&&!entry.unavailable))value++;

 for(const [site,loc] of state.locations.entries())if(squadTrooper(card,side)&&loc?.id==='Light:2014'&&side===dagoLocationPlayer(site,'Dark')&&PremiereLocations.control(state,PremiereGame.otherSide(side),site,cardAbility)===true)value--;
 return value;
};
hothBattlePower=function(side,slot){let value=dagoTimingBase.battlePower(side,slot);if(!dagobahEnabled())return value;const present=PremiereLocations.presentCards(state,side,slot);if(isSite(state.locations[slot])&&present.some(card=>card.id==='Dark:9'&&dagoText(card)))value+=Math.min(present.filter(card=>card.subType==='Alien').length,present.filter(isDroid).length);return value;};
let dagoSuppressedDestiny=null;
cardAbility=function(card){if(dagobahEnabled()&&dagoSuppressedDestiny?.has(card))return 0;return dagoTimingBase.cardAbility(card);};
battleDestinyDrawCount=function(side,site,ability,...rest){
 if(!dagobahEnabled())return dagoTimingBase.battleDraws(side,site,ability,...rest);
 const all=dagoUnits().filter(entry=>entry.side===side&&!entry.unavailable&&entry.slot===site),suppressed=new Set();
 for(const entry of all){if(dagoEffects('Light:2184',PremiereGame.otherSide(side)).length&&isSite(state.locations[site])&&entry.card.pilot&&!/darth vader/.test(dagoTitle(entry.card)))suppressed.add(entry.card);if(dagoEffects('Light:2800').some(effect=>effect.target===entry.card))suppressed.add(entry.card);if(entry.carriers.some(ship=>dagoEffects('Light:151').some(effect=>effect.target===ship)))suppressed.add(entry.card);}
 const adjusted=Math.max(0,ability-[...suppressed].reduce((sum,card)=>sum+(dagoTimingBase.cardAbility(card)??0),0));
 const testTwo=dagoCompleted(PremiereGame.otherSide(side),2);
 if(testTwo&&adjusted<6&&!dagoTrainingRevision())return 0;
 let draws;dagoSuppressedDestiny=suppressed;try{draws=dagoTimingBase.battleDraws(side,site,adjusted,rest[0],testTwo&&dagoTrainingRevision()?6:0);}finally{dagoSuppressedDestiny=null;}
 if(!draws&&all.some(entry=>entry.card.id==='Dark:1524'&&isSite(state.locations[site])||entry.card.id==='Dark:1273'&&entry.carriers.some(ship=>/Star Destroyer/.test(ship.subType))||entry.card.attachments?.some(card=>card.id==='Light:2037')&&entry.carriers.some(host=>['Starship','Vehicle'].includes(host.type))||entry.card.id==='Dark:308'&&entry.carriers.some(ship=>ship.id==='Dark:1185')))draws=1;
 return draws;
};
prepareDamageSegment=function(){dagoTimingBase.prepare();if(!dagobahEnabled()||!battleSession?.damage)return;const x=battleSession;if(!x.damage.dagobahReliefApplied){for(const side of PremiereGame.sides){const relief=x.dagobahAttritionRelief?.[side]??0;x.damage.debt[side].attrition=Math.max(0,x.damage.debt[side].attrition-relief);}x.damage.dagobahReliefApplied=true;}state.dagobahBattleRecord={site:x.site,result:x.damage.result,participants:x.participants,tightSqueeze:x.dagobahTightSqueeze};};
battleDamageAction=function(side,kind,args){const card=kind==='battleForfeit'&&battleSession?.participants[side]?.[args[0]],x=battleSession,result=dagoTimingBase.damageAction(side,kind,args);if(result&&dagobahEnabled()&&card&&x)x.dagobahForfeited=true;return result;};
endBattleTiming=function(site){
 if(!dagobahEnabled())return dagoTimingBase.end(site);
 const record=state.dagobahBattleRecord;dagoTimingBase.end(site);if(!record||record.site!==site)return;delete state.dagobahBattleRecord;
 const result=record.result,winner=result.lightTotal>result.darkTotal?'Light':result.darkTotal>result.lightTotal?'Dark':null;
 if(winner){const loser=PremiereGame.otherSide(winner);(state.dagobahLostBattles??=[]).push({turn:state.game.timing.turn,side:loser,survivors:record.participants[loser].filter(card=>dagoEntry(card)),damage:result[loser.toLowerCase()+'Damage']});}
 const finish=()=>queueRuleResponse({kind:'battleEnd',side:winner??state.activeSide,winner,site,participants:record.participants});
 if(record.tightSqueeze)dagoTightForfeit(PremiereGame.otherSide(record.tightSqueeze.side),record.participants,finish);else finish();
};
loseTableCard=function(side,slot,card,...args){
 const hostSites=dagobahEnabled()&&card.type==='Starship'?state.locations.flatMap((loc,index)=>loc?.hostInstanceId===card.instanceId?[index]:[]):[],result=dagoTimingBase.lose(side,slot,card,...args);
 if(result&&dagobahEnabled()&&!dagoEntry(card))for(const site of hostSites){
  for(const actor of PremiereGame.sides)for(const unit of dagoOwn(actor).board[site].slice())loseTableCard(actor,site,unit);
  for(const effect of (state.locationEffects?.[site]??[]).slice())hothCancelEffect(effect);
  for(const unit of (state.locationWeapons?.[site]??[]))loseOwnedCard(unit,unit.owner??unit.side);
  for(const loc of state.convertedLocations?.[site]??[])loseOwnedCard(loc,loc.owner??loc.side);
  if(state.locationWeapons)delete state.locationWeapons[site];if(state.convertedLocations)delete state.convertedLocations[site];
  const loc=state.locations[site];if(loc){loseOwnedCard(loc,loc.owner??loc.side);state.locations[site]=null;}
 }
 return result;
};
hothBotValue=function(offer,view){if(!dagobahEnabled())return dagoTimingBase.bot(offer,view);const mode=offer.mode??offer.ability;if(String(mode).startsWith('dago:')){const key=mode.slice(5);if(key==='testAttempt')return 30;if(['testDeploy','sectorDeploy','caveDeploy','launchBay','unitSearch','lukeSaber'].includes(key))return 2;if(['unclaw','fusionOff'].includes(key))return -1;if(key==='forfeitSuppression')return offer.args.at(-1)?-2:3;if(key==='crazyDestiny'||key==='attackPosition')return offer.entry?.side===view.side?(key==='crazyDestiny'?-2:2):(key==='crazyDestiny'?2:-2);if(key==='zuckussForfeit'||key==='assassinate')return 4;return 1;}return dagoTimingBase.bot(offer,view);};
