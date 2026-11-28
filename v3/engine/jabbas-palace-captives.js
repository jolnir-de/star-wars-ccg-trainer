'use strict';
const jpCaptiveBase={release:rallyCaptive,custody:resolveCustody,reward:ccCaptiveReward,battle:canInitiateBattleFor,lose:loseTableCard};
rallyCaptive=function(card,site,...args){const reward=jpEnabled()&&card.id==='Light:1945'&&card.captured;const out=jpCaptiveBase.release(card,site,...args);if(reward)PremiereGame.retrieveForce(state,'Light',5);return out;};
resolveCustody=function(option){const pending=state.pendingCustody?.[0],reward=jpEnabled()&&pending?.card.id==='Light:1945'&&['escape','rally'].includes(option.args[0]),out=jpCaptiveBase.custody(option);if(out&&reward&&option.args[0]!=='rally')PremiereGame.retrieveForce(state,'Light',5);return out;};
ccCaptiveReward=function(card,escort,site){
 if(jpEnabled()){
  if(state.locations[site]?.id==='Dark:1356'&&jpSource(site,'Dark')&&PremiereUnits.bountyHunter(escort)&&!card.jpDungeonDelivered){card.jpDungeonDelivered=true;PremiereGame.retrieveForce(state,jpSource(site,'Dark'),2);}
  for(const effect of ccEffects('Dark:1192','Dark'))if(effect.host===card&&card.cloudCitySeizedByBounty&&state.locations[site]?.id==='Dark:1356'){const n=cardForfeitValueAt(card,'Light',site)+(ccPersona(card,'Han')?6:0)+(escort.weapons?.some(w=>w.id==='Dark:2556')?3:0);PremiereGame.retrieveForce(state,'Dark',n);hothCancelEffect(dagoOriginalEffect(effect));}
 }
 const extra=jpEnabled()&&escort?.weapons?.some(w=>w.id==='Dark:2556'&&jpLive(w))&&card.cloudCitySeizedByBounty===escort.instanceId?ccAllEffects().filter(e=>e.host===card&&(e.card.id==='Dark:316'||e.card.id==='Dark:2697'&&ccPresent('Dark',site).some(c=>ccPersona(c,'Vader')))).length*3:0;
 const result=jpCaptiveBase.reward(card,escort,site);if(extra)PremiereGame.retrieveForce(state,'Dark',extra);return result;
};
ccProviders.push(side=>{
 if(!jpEnabled()||side!=='Light'||state.activeSide!==side||state.phase!==2||battleSession)return [];const out=[],own=jpOwn(side);
 own.hand.forEach((card,index)=>{if(card.id!=='Light:1945')return;for(const [i,e]of jpUnits().entries())if(e.side==='Dark'&&!e.unavailable&&PremiereLocations.presentAt(e,e.slot)&&(ccPersona(e.card,'Jabba')||PremiereUnits.bountyHunter(e.card))&&(!e.card.escortedCaptive||ccBinders(e.card))&&hasDeployPresence(side,state.locations[e.slot])&&hothDeploymentAllowed(card,state.locations[e.slot],side)&&withinDeploymentLimit(card,side))out.push(jpOption(card,'leiaCaptive',[index,i],'Leia kostenlos als Gefangene von '+e.card.name+' ausspielen',()=>{own.hand.splice(own.hand.indexOf(card),1);card.captured=true;card.controller='Dark';ccSetCaptives(e.card,[...ccCaptives(e.card),card]);(state.jpNoBattles??=[]).push({side,site:e.slot,turn:state.game.timing.turn});openDeploymentReaction(side,[card]);return true;},{site:e.slot}));

 });return out;
});
canInitiateBattleFor=function(side,site){return !(jpEnabled()&&(state.jpNoBattles??[]).some(r=>r.side===side&&r.site===site&&r.turn===state.game.timing.turn))&&jpCaptiveBase.battle(side,site);};
loseTableCard=function(side,slot,card,...args){
 if(!jpEnabled())return jpCaptiveBase.lose(side,slot,card,...args);
 const outOfPlay=args[0],forfeited=args[1],equipment=card.type==='Character'?[...card.weapons??[],...card.attachments??[]].filter(c=>['Device','Weapon'].includes(c.type)):[];
 if(!outOfPlay&&!state.jpAtomicArea&&['Light:2274','Dark:2273'].includes(card.id)&&!card.jpJumpResolved&&(card.occupants??[]).some(e=>e.card.type==='Character')){
  card.jpJumpResolved=true;const occupants=(card.occupants??[]).filter(e=>e.card.type==='Character').map(e=>e.card),choose=()=>{
   if(!occupants.length){loseTableCard(side,slot,card,...args);return;}const target=occupants.shift();jpChoose(ccOwner(target),card,'SkiffJump',[{args:['jump'],label:target.name+' steigt aus'},{args:['stay'],label:target.name+' bleibt an Bord'}],choice=>{if(choice.args[0]==='jump'&&detachTableCard(side,slot,target))jpOwn(ccOwner(target)).board[slot].push(target);choose();});
  };choose();return true;
 }
 const result=jpCaptiveBase.lose(side,slot,card,...args);if(result&&!jpEntry(card)){
  delete card.jpJumpResolved;
  if(card.type!=='Character'&&card.type!=='Vehicle'&&card.type!=='Creature')return result;
  queueRuleResponse({kind:'jpCardLost',side,fallen:card,site:slot,forfeited:!!forfeited,equipment,outOfPlay:!!outOfPlay});
 }return result;
};
ccResponseProviders.push((side,window)=>{
 if(!jpEnabled()||window.kind!=='jpCardLost'||window.outOfPlay)return [];const out=[],fallen=window.fallen,own=jpOwn(side),all=jpUnits(),site=window.site,x=battleSession;
 const add=(card,mode,args,label,cost,resolve)=>{if(cost<=forceBudget(side))out.push(jpOption(card,mode,args,label,()=>{spendForce(side,cost);resolve();ccAnswer(side,window);return true;},{cost}));};
 if(fallen.id==='Dark:49'&&window.side===side&&x&&own.lost.includes(fallen))add(fallen,'abyssinRegen',[],'Abyssin regenerieren (2 Force)',2,()=>{own.lost.splice(own.lost.indexOf(fallen),1);own.used.push(fallen);});
 if(window.side===side&&fallen.type==='Vehicle'&&fallen.subType==='Transport'&&own.lost.includes(fallen))for(const [i,e]of all.entries())if(e.side===side&&e.slot===site&&e.card.id==='Dark:196'&&!e.unavailable)add(e.card,'baradaSalvage',[i],fallen.name+' auf Used legen',0,()=>{own.lost.splice(own.lost.indexOf(fallen),1);own.used.push(fallen);});
 if(x&&fallen.type==='Character'&&!isDroid(fallen)&&window.side!==side&&jpOwn(window.side).lost.includes(fallen))for(const [i,e]of all.entries())if(e.side===side&&e.slot===site&&e.card.id==='Dark:102'&&!e.unavailable&&jpUnused(e.card,'behead','battle'))add(e.card,'behead',[i],fallen.name+' aus dem Spiel nehmen',2,()=>{ccMark(e.card,'jp:behead','battle');const lost=jpOwn(window.side).lost;lost.splice(lost.indexOf(fallen),1);(state.outOfPlay??=[]).push(fallen);(e.card.jpHeads??=[]).push(fallen.instanceId);});
 if(window.side!==side)for(const [i,e]of all.entries())if(e.side===side&&e.slot===site&&e.card.id==='Dark:2275'&&!e.unavailable&&jpUnused(e.card,'loot'))for(const [j,item]of window.equipment.entries())if(jpOwn(window.side).lost.includes(item))add(e.card,'skrillingLoot',[i,j],item.name+' stehlen',0,()=>{ccMark(e.card,'jp:loot');jpOwn(window.side).lost.splice(jpOwn(window.side).lost.indexOf(item),1);item.owner=side;item.controller=side;(item.type==='Weapon'?(e.card.weapons??=[]):(e.card.attachments??=[])).push(item);item.dagobahArmStolen=true;item.dagobahArmDormant=item.type==='Weapon'?weaponDeployCost(item,e.card)===null:!jpReplacementAttachmentAllowed(item,e.card);});
 return out;
});

const jpCaptiveClear=clearCaptivity;
clearCaptivity=function(card){jpCaptiveClear(card);if(jpEnabled())delete card.jpDungeonDelivered;};
