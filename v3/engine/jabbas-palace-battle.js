'use strict';
function jpExclude(card){if(battleSession){(battleSession.excludedUnits??=new Set()).add(card);refreshBattleParticipants();}}
function jpWrappedFree(card){return jpEnabled()&&['Dark:2754','Dark:1844'].includes(card?.id)&&ccEffects('Dark:90','Dark').length>0;}
ccResponseProviders.push((side,window)=>{
 if(!jpEnabled())return [];const out=[],enemy=PremiereGame.otherSide(side),all=jpUnits(),x=battleSession,site=window.site??x?.site;
 const add=(card,mode,args,label,cost,resolve,scope='battle')=>{if(cost<=forceBudget(side)&&jpUnused(card,mode,scope))out.push(jpOnce(card,mode,args,label,cost,()=>{resolve();ccAnswer(side,window);return true;},scope));};
 if(window.kind==='battle'&&window.side===side&&jpAll(side).some(e=>e.slot===site&&characterTraits(e.card).includes('information broker')))for(const effect of ccEffects('Dark:1310',side))add(effect.card,'information',[],'Vier gegnerische Reserve-Karten ansehen',0,()=>{
  const shown=PremiereGame.reserveCards(jpOwn(enemy).deck).slice(-4).reverse(),choices=[{args:['done'],label:'Battle fortsetzen'}];if(lifeForceRemaining(side)+jpOwn(side).hand.length>0)choices.push({args:['cancel'],label:'1 Force verlieren und Battle aufheben'});
  jpChoose(side,effect.card,'InformationExchange',choices,choice=>{if(choice.args[0]==='cancel')dagoLoss(side,1,effect.card.name,()=>PremiereGame.cancelResponse(state.game,window));},{shown,publicView:false});
 });
 if(window.kind==='battle')for(const [i,e]of all.entries())if(e.side===side&&!e.unavailable&&e.slot===site&&jpLive(e.card)){
  const card=e.card;
  if(['Light:1037','Dark:1342','Light:126'].includes(card.id))for(const [j,target]of ccPresent(enemy,site).entries())if(target.type==='Character'&&(card.id==='Light:1037'||card.id==='Dark:1342'&&cardAbility(target)<3||card.id==='Light:126'&&cardAbility(target)===1))add(card,'exclude',[i,j],target.name+(card.id==='Light:1037'?' Ability blockieren':' ausschließen'),0,()=>{if(card.id==='Light:1037')drawDestinySeries(side,'jpGhoel',1,3,d=>{if(d.length&&PremiereBattle.total(d)>cardAbility(target))target.jpNoBattleAbilityTurn=state.game.timing.turn;});else jpExclude(target);});
  if(card.id==='Dark:188')for(const [j,target]of ccPresent(enemy,site).entries())if(target.type==='Character'&&!isDroid(target)&&cardAbility(target)<cardAbility(card))add(card,'mindscan',[i,j],target.name+' scannen: Power und Spieltext übernehmen',1,()=>{state.jpMindscanBattle=ccBattleKey();card.jpMindscan={target,power:creaturePower(target,enemy,site),battle:ccBattleKey()};});
  if(card.id==='Dark:1781'){const n=ccPresent(side,site).filter(c=>characterTraits(c).includes('musician')).length;for(const [j,target]of PremiereGame.sides.flatMap(s=>ccPresent(s,site)).entries())if(target.type==='Character'&&cardAbility(target)<n)add(card,'musicianRetreat',[i,j],target.name+' muss wegziehen oder geht verloren',0,()=>{const targetSide=ccOwner(target),places=state.locations.flatMap((loc,to)=>adjacentSites(site,to)&&travelOptions(target,targetSide,site,to).length&&hothMovementAllowed(targetSide,target,site,to,'Landspeed')?[to]:[]);jpChoose(targetSide,card,'DoOrDie',[...places.map(to=>({args:[to],to,label:'Kostenlos nach '+state.locations[to].name})),{args:['lost'],label:target.name+' verlieren'}],choice=>{if(choice.to!==undefined){jpRelocate(target,choice.to);(state.movedThisTurn??=[]).push(target);}else jpRemove(target);});});}
  if(card.id==='Dark:2789'&&ccPresent(side,site).filter(c=>jpSpecies(c,'tusken raider')).length<=ccPresent(side,site).filter(c=>jpSpecies(c,'weequay')).length)for(const [j,bantha]of ccPresent(side,site).entries())if(PremiereUnits.bantha(bantha))add(card,'sacrificeBantha',[i,j],bantha.name+' opfern · Weequay Power +2',0,()=>{jpRemove(bantha);for(const c of ccPresent(side,site))if(jpSpecies(c,'weequay')){if(c.jpPowerTurn!==state.game.timing.turn)c.jpPowerBonus=0;c.jpPowerTurn=state.game.timing.turn;c.jpPowerBonus+=2;}});
  if(['Light:1138','Light:1482','Dark:1130'].includes(card.id)){
   const isDevice=card.id==='Light:1138',hosts=isDevice?ccPresent(side,site).filter(c=>PremiereUnits.hasSkill(c,'warrior')):[card];
   for(const host of hosts)for(const option of jpDeployOptions(side,card,'deck',c=>c.type==='Weapon'&&c.subType==='Character'&&(isDevice||/blaster/i.test(c.name)&&JabbasPalaceRules.nonunique(c)),{free:!isDevice,host,site,react:true})){const resolve=option.resolve;option.resolve=actor=>{ccMark(card,'jp:weaponReact','battle');const value=resolve(actor);ccAnswer(side,window);return value;};if(jpUnused(card,'weaponReact','battle'))out.push(option);}
  }
 }
 if(window.kind==='cloudCityHit'&&window.shot?.host?.id==='Dark:2790'&&ccOwner(window.shot.host)===side&&forceBudget(side)>=2)add(window.shot.host,'assassinate',[window.target.instanceId],window.target.name+' sofort verlieren lassen',2,()=>jpRemove(window.target));
 if(window.kind==='aboutToLoseBattle'&&window.side==='Light'&&side==='Dark'){
  const target=window.target;
  if(window.forfeited&&ccEffects('Dark:90','Dark').length&&!isDroid(target))for(const [i,escort]of escortChoices(site,true).entries())if(PremiereUnits.bountyHunter(escort.card))add(escort.card,'wrapCapture',[i,target.instanceId],target.name+' gefangen nehmen statt forfeiten',0,()=>{window.replaced=true;window.finish=()=>{};captureCharacter(target,site);for(const key of ['hitForLoss','battleForfeit','battleForfeitModifier','ionDamage','armedTurn','noMoveTurn','noBattleTurn'])delete target[key];const pending=state.pendingCustody?.find(p=>p.card===target);if(pending){state.pendingCustody.splice(state.pendingCustody.indexOf(pending),1);target.controller='Dark';ccSetCaptives(escort.card,[...ccCaptives(escort.card),target]);}});
 }
 if(window.kind==='cloudCityHit'&&window.target?.subType==='Alien'&&characterTraits(window.target).includes('leader'))for(const [i,giran]of all.entries())if(giran.side===ccOwner(window.target)&&giran.side===side&&giran.slot===site&&giran.card.id==='Dark:1041'&&!giran.unavailable&&giran.card!==window.target)add(giran.card,'shieldLeader',[i],giran.card.name+' forfeiten und Anführer wiederherstellen',0,()=>{
  const target=window.target,index=jpOwn(side).board[site].indexOf(target),debt=x?.damage?.debt?.[side];
  delete target.hitForLoss;delete target.cloudCityHitCannotAttrition;
  if(x){if(x.hitUnits)x.hitUnits[side]=(x.hitUnits[side]??[]).filter(c=>c!==target);x.zeroForfeit=(x.zeroForfeit??[]).filter(c=>c!==target);x.droidHitForfeits?.delete(target);if(index>=0){x.weaponHits[side]=(x.weaponHits[side]??[]).filter(i=>i!==index);const key=side==='Light'?'lightLoss':'darkLoss';x[key]=(x[key]??[]).filter(i=>i!==index);}if(x.lastHit?.card===target)delete x.lastHit;}
  if(debt)debt.hits=debt.hits.filter(c=>c!==target);
  loseTableCard(side,site,giran.card,false,true);
 });
 if(window.kind==='weaponTarget'&&!window.jpJawaAimed&&window.shot?.host?.id==='Light:1988'&&window.side===side&&/jawa/i.test(window.shot.weapon.name))for(const n of [1,2,3])out.push(jpOption(window.shot.host,'jawaAim',[n],'Gesamte Waffen-Destiny +'+n,()=>{window.jpJawaAimed=true;window.shot.bonus+=n;ccAnswer(side,window);return true;}));
 if(window.kind==='destiny'&&window.draw&&x&&isSystem(state.locations[x.site]))for(const [i,e]of all.entries()){
  const factor=typeof jpVulFactor==='function'?jpVulFactor(side):1,cost=2*factor;
  if(e.side!==side||e.slot!==x.site||e.unavailable||e.card.id!=='Light:2730'||window.draw.value!==2*factor||e.card.jpVulBattle===ccBattleKey()&&(e.card.jpVulCount??0)>=2*factor||forceBudget(side)<cost)continue;
  out.push(jpOption(e.card,'vulDestiny',[i],'Destiny '+(2*factor)+' um '+(2*factor)+' erhöhen ('+cost+' Force)',()=>{spendForce(side,cost);if(e.card.jpVulBattle!==ccBattleKey())e.card.jpVulCount=0;e.card.jpVulBattle=ccBattleKey();e.card.jpVulCount++;window.draw.value+=2*factor;ccAnswer(side,window);return true;},{cost}));
 }
 if(window.kind==='destiny'&&window.side===side&&window.purpose==='battle'&&window.draw.value===3&&x)for(const [i,e]of all.entries())if(e.side===side&&e.slot===x.site&&!e.unavailable&&e.card.id==='Dark:2077'&&(e.card.jpReeBattle!==ccBattleKey()||(e.card.jpReeCount??0)<3)&&forceBudget(side)>=3)out.push(jpOption(e.card,'reeDestiny',[i],'Battle Destiny 3 um 3 erhöhen',()=>{spendForce(side,3);if(e.card.jpReeBattle!==ccBattleKey())e.card.jpReeCount=0;e.card.jpReeBattle=ccBattleKey();e.card.jpReeCount++;window.draw.value+=3;ccAnswer(side,window);return true;},{cost:3}));
 return out;
});
const jpBattleBase={ability:battleCardAbility,attrition:battleAttritionAgainst,draws:battleDestinyDrawCount,before:ccBeforeBattleCard,triggers:hothDestinyTriggers,immunity:battleImmunity,power:cardPowerModifier};
battleCardAbility=function(card){return jpEnabled()&&card.jpNoBattleAbilityTurn===state.game.timing.turn?0:jpBattleBase.ability(card);};
battleAttritionAgainst=function(side){const n=jpBattleBase.attrition(side);if(n===null||!jpEnabled())return n;const enemy=PremiereGame.otherSide(side),site=battleSession?.site;return Math.max(0,n+ccPresent(enemy,site).filter(c=>c.id==='Dark:102'&&jpLive(c)).reduce((sum,c)=>sum+(c.jpHeads?.length??0),0)+(battleSession.jpAttrition?.[enemy]??0)+ccPresent(enemy,site).filter(c=>c.id==='Light:962'&&jpLive(c)).length+ccPresent(enemy,site).filter(c=>c.id==='Dark:2628'&&jpLive(c)&&['Dark:1192','Dark:316','Dark:2697'].some(id=>ccEffects(id).some(e=>jpEntry(e.host)?.slot===site))).length);};
battleDestinyDrawCount=function(side,slot,...args){if(jpEnabled()&&battleSession?.jpNoDestiny?.[side])return 0;let n=jpBattleBase.draws(side,slot,...args);if(jpEnabled()&&battleSession?.jpLimitTwo===side)n=Math.min(n,2);return n;};
ccBeforeBattleCard=function(side,draw,substitute){if(jpEnabled()&&battleSession?.jpDroidDraw?.[side]){const card=battleSession.jpDroidDraw[side];delete battleSession.jpDroidDraw[side];substitute({card,value:card.destiny??0,cancelled:false,jpReplacement:true});return;}return jpBattleBase.before(side,draw,substitute);};
hothDestinyTriggers=function(side,draw,next,kind){
 if(!jpEnabled()||draw.cancelled)return jpBattleBase.triggers(side,draw,next,kind);const site=battleSession?.site;
 if(kind==='battle'){
  if(ccEffects('Light:25',PremiereGame.otherSide(side)).length&&ccPresent(side,site).some(c=>c.subType==='Alien'))draw.value=Math.max(0,draw.value-2);
  if(jpAll(side,'Light:1964').some(e=>sitePlanet(state.locations[e.slot])==='bespin')&&jpSpecies(draw.card,'miner'))draw.value+=4;
  if(jpAll(side,'Dark:2589').some(e=>e.slot===site)&&ccPresent(side,site).some(c=>ccPersona(c,'Lieutenant Tanbris'))&&isSystem(state.locations[site]))draw.value+=2;
  const artoo=jpAll(PremiereGame.otherSide(side),'Light:136').find(e=>jpBattleground(e.slot)&&jpAll(e.side).some(other=>ccPersona(other.card,'C-3PO')&&jpSame(e.card,other.card))&&sitePlanet(state.locations[e.slot])===sitePlanet(state.locations[site]));if(artoo)draw.value=Math.max(0,draw.value-1);
  if(jpAll(PremiereGame.otherSide(side),'Dark:2159').some(e=>e.slot===site||adjacentSites(e.slot,site))){if(draw.value%2===0){if(forceBudget(side)>=1)spendForce(side,1);}else{const used=jpOwn(side).used,index=used.indexOf(draw.card);if(index>=0){used.splice(index,1);jpOwn(side).lost.push(draw.card);}}}
 }
 const bg=jpHas(side,'Light:230')&&jpHologram(draw.card)&&['battle','weapon'].includes(kind);
 if(bg)jpChoose(side,jpAll(side,'Light:230')[0].card,'HoloDestiny',[{args:[0],label:'Destiny unverändert'},{args:[2],label:'Destiny +2'}],choice=>{draw.value+=choice.args[0];jpBattleBase.triggers(side,draw,next,kind);});else jpBattleBase.triggers(side,draw,next,kind);
};
battleImmunity=function(side,card,slot,...args){if(jpEnabled()&&ccEffects('Light:1218',side).some(e=>e.host===card)&&sitePlanet(state.locations[slot])==='tatooine')return Infinity;return jpBattleBase.immunity(side,card,slot,...args);};
cardPowerModifier=function(card,...args){let n=jpBattleBase.power(card,...args);if(jpEnabled()&&card.jpMindscan?.battle===ccBattleKey())n+=card.jpMindscan.power;return n;};
