const {REVISION, readCatalog, readStarterDecks, buildAudit, locationTitle, isDeployableCharacter, isBantha, isLostPileEffect, permanentPilotAbility, basicWeaponRule}=PremiereData;
let catalog=[],starterDecks=null,state=null,battleSession=null,setupDecks=null;
let nextGameId=0, presentGame=()=>{};
const currentGame=()=>state?.game??setupDecks?.game;
function publishGame(){if(!currentGame()?.executing)presentGame()}
const topLevelActions=new Set(['activate','draw','drain','deploy','deployWithPilot','transport','transitGroup','dockGroup','deployLocation','convertLocation','revolution','deployLostPileEffect','alterLostPileEffect','deployLocationEffect','alterLocationEffect','deployTableEffect','deployReserveInsert','recycleHand','retrieve','searchReserve','limitedResources','gravelStorm','cardInformation','pileInterrupt','equip','deployDevice','deployBolt','deviceAction','deployAutomated','buryMineCard','moveSeeker','weaponEffect','move','battle','duel','prisonerTransfer']);
topLevelActions.add('unitReserveSearch').add('unitTableCancel');
topLevelActions.add('spyAction').add('anhCharacter').add('hothAction');

function forceFromLocations(side){
 if(!state)return {count:0,unknown:0};
 const total=PremiereLocations.forceGeneration(state,side);
 if((currentGame()?.cardRulesVersion??latestCardRulesVersion)>=28){
  for(const {card,slot,unavailable} of PremiereLocations.entries(state,side)){
   const location=state.locations[slot];
   if(unavailable||!location||locationGroup(location)==='tatooine')continue;
   for(const effect of card.attachments??[])total.count+=activeCardRules(effect,'capeGeneration')[0]?.amount??0;
  }
 }
 if(hothEnabled())total.count=Math.max(0,total.count+hothGeneration(side));
 return total;
}

function activationDrawAllowance(side){
 if(!Object.keys(state?.locationEffects??{}).length)return 0;
 const devices=state.locations.flatMap((_,slot)=>PremiereLocations.effectsAt(state,slot));
 if(!devices.some(({card})=>card.side===side&&activeCardRules(card,'activationDraw').length))return 0;
 return devices.some(({card})=>activeCardRules(card,'gravelProtection').length)?2:1;
}

function activate(side,requested,drawMask=0){
 const generation=forceFromLocations(side);
 const count=Math.max(0,Math.min(Number.isInteger(requested)?requested:generation.count,generation.count));
 const {activated,drawn}=activateReserve(side,count,drawMask);
 log(side+' aktiviert '+activated+' Force (Maximum '+generation.count+' inklusive persönlicher Force und Karteneffekten).');
 if(drawn)log(side+' nimmt '+drawn+' aktivierte Karte(n) mit Hydroponics Station auf die Hand.');
 return activated;
}

function activationLocked(side){
 return state.game&&state.activationLocks?.[side]===state.game.timing.turn;
}

function activateReserve(side,count,drawMask=0){
 const {deck,force,hand}=PremiereGame.zones(state,side);
 let activated=0,drawn=0;
 revealReserveInserts(side);
 while(activated<count&&deck.length&&!activationLocked(side)){
  const draw=activated<2&&(drawMask&(1<<activated));
  PremiereGame.moveTop(deck,draw?hand:force);
  activated++;
  if(draw)drawn++;
  revealReserveInserts(side);
 }
 return {activated,drawn};
}

function revealReserveInserts(side){
 if(!state.game)return;
 const {deck}=PremiereGame.zones(state,side);
 while(PremiereGame.isReserveInsert(deck?.at(-1))){
  if(typeof dagobahEnabled==='function'&&dagobahEnabled()&&deck.at(-1).set==='4')return;
  const card=deck.pop(),owner=card.insertedIntoReserveBy;
  delete card.insertedIntoReserveBy;
  (state.activationLocks??={})[side]=state.game.timing.turn;
  loseOwnedCard(card,owner);
  log(card.name+' wird im Reserve Deck aufgedeckt. '+side+' kann diesen Zug keine weitere Force aktivieren.');
 }
}

function reserveInsertOptions(side){
 const opponent=PremiereGame.otherSide(side),{deck}=PremiereGame.zones(state,opponent);
 if(!state.game||state.phase!==2||state.activeSide!==side||PremiereGame.reserveCards(deck).length<2)return [];
 const {hand}=PremiereGame.zones(state,side);
 return (hand??[]).flatMap((card,index)=>activeCardRules(card,'reserveInsert').length&&!PremiereGame.wasUsed(state.game,'game',card.id)?
  [{args:[index],card,opponent,label:card.name+' verdeckt ins gegnerische Reserve Deck mischen'}]:[]);
}

function deployReserveInsert(side,index){
 const option=reserveInsertOptions(side).find(choice=>choice.args[0]===index);
 if(!option)return false;
 const [card]=PremiereGame.zones(state,side).hand.splice(index,1);
 const {deck}=PremiereGame.zones(state,option.opponent);
 PremiereGame.useOnce(state.game,'game',card.id);
 card.insertedIntoReserveBy=side;
 deck.push(card);
 deck.splice(0,deck.length,...PremiereGame.shuffleReserve(deck,state.game));
 log(side+' mischt einen verdeckten Effect ins gegnerische Reserve Deck.');
 return true;
}

function drawFor(side){
 if(typeof cloudCityEnabled==='function'&&cloudCityEnabled()&&ownForceBudget(side)===0)return false;
 const {force,hand}=PremiereGame.zones(state,side);
 if(!PremiereGame.moveTop(force,hand).length)return false;
 log(side+' Side zieht 1 Karte aus der Force Pile auf die Hand.');return true;
}
function recirculate(side){
 const {deck,used}=PremiereGame.zones(state,side);
 if(PremiereGame.recirculate(deck,used))log(side+' Used Pile unter das eigene Reserve Deck gelegt.');
}

function recirculateBoth(){recirculate('Light');recirculate('Dark')}

function cardAbility(c){
 if(c?.asleep)return 0;
 if(isHoloUnit(c))return printedBattleDestiny(c);
 if(isBantha(c))return 0.5;
 if(hothEnabled()&&c?.id==='Light:2480')return 0.25;
 const pilot=permanentPilotAbility(c);
 if(pilot!==null){
  const slot=state?.locations?.findIndex((_,i)=>state.light?.[i]?.includes(c)||state.dark?.[i]?.includes(c))??-1;
  return slot>=0&&landedAt(c,slot)?0:pilot;
 }
 // Droids have no ability, counting as zero in comparisons; unknown other ability stays unknown.
 if(Number.isFinite(c?.ability))return c.ability*tonnikaFactor(c);
 if(isDroid(c)||['Vehicle','Starship','Creature'].includes(c?.type))return 0;
 return null;
}

function confirmedPresence(side,i){return state?PremiereLocations.presence(state,side,i,cardAbility):false}

function drainPlan(side,i){
 if(!state||state.gameWinner||state.pendingForceLoss||state.phase!==1||state.activeSide!==side||
    state.drainedSitesThisTurn?.includes(i)||battleSession||PremiereGame.responseWindow(state.game))return null;
 const plan=forceDrainEffects(side,i);
 if(!plan||(currentGame()?.cardRulesVersion??latestCardRulesVersion)<4)return plan;
 const participants=PremiereLocations.entries(state,side).filter(({card,slot,unavailable})=>
  slot===i&&!unavailable&&PremiereUnits.active(card)&&['Character','Vehicle','Starship','Weapon','Device'].includes(card.type))
  .map(entry=>entry.card);
 participants.push(...(state.locationWeapons?.[i]??[]).filter(card=>(card.controller??card.side)===side));
 participants.push(...PremiereLocations.effectsAt(state,i).flatMap(effect=>effect.siteDevice&&effect.card.side===side?[effect.card]:[]));
 if(participants.some(card=>state.drainedCardsThisTurn?.includes(card)))return null;
 const cost=musicianDrainCost(side,i);
 if(cost&&cost>forceBudget(side))return null;
 return {...plan,participants,...(cost?{cost}:{})};
}

function siteEntries(slot){
 return PremiereGame.sides.flatMap(side=>PremiereLocations.entries(state,side)).filter(entry=>
  entry.slot===slot&&!entry.unavailable&&PremiereUnits.active(entry.card));
}

function musicianDrainCost(side,site){
 return PremiereLocations.entries(state,PremiereGame.otherSide(side)).filter(entry=>!entry.unavailable&&
  adjacentSites(entry.slot,site)&&activeCardRules(entry.card,'musicianDrainTax').length).reduce((total,source)=>{
   const musicians=PremiereLocations.physicalPlace(source);
   return total+siteEntries(source.slot).filter(entry=>entry.card!==source.card&&PremiereLocations.physicalPlace(entry)===musicians&&
    characterTraits(entry.card).includes('musician')).length;
  },0);
}

function forceDrainEffects(side,slot){
 const plan=PremiereLocations.drain(state,side,slot,cardAbility);
 if(!plan)return null;
 const proficiency=PremiereLocations.presentCards(state,side,slot).flatMap(host=>saberTraining(host)?[{host}]:[]);
 const prisonDroid=side==='Dark'&&locationTitle(state.locations[slot])==='death star: detention block corridor'&&
  PremiereLocations.entries(state,side).some(entry=>entry.slot===slot&&!entry.unavailable&&activeCardRules(entry.card,'captiveDrain').length);
 const captives=prisonDroid?PremiereLocations.entries(state,'Dark').filter(entry=>
  entry.captive&&entry.card.type==='Character'&&entry.slot===slot&&!(typeof cloudCityEnabled==='function'&&cloudCityEnabled()&&entry.card.frozen)).length:0;
 const waters=PremiereLocations.effectsAt(state,slot).some(effect=>
  activeCardRules(effect.card,'locationEffect').some(rule=>rule.darkWaters)&&(effect.card.owner??effect.card.side)!==side);
 return {...plan,modifier:plan.modifier+(hothEnabled()?hothDrainModifier(side,slot):0)+(side==='Dark'?(state.locations[slot]?.bluffs??[]).length:0)+hypoDrainBonus(side,slot)+necklaceCarriers(side,slot).length+captives-Number(waters),
  optional:plan.optional+proficiency.length,weapons:plan.weapons.concat(proficiency)};
}

function necklaceCarriers(side,slot){
 return PremiereLocations.presentCards(state,side,slot).flatMap(host=>host.subType==='Imperial'?
  (host.attachments??[]).filter(card=>card.necklaceWorn&&locationEffectRule(card)?.mission==='necklace').map(card=>({host,card})):[]);
}

function necklacePassChoices(frame){
 const options=PremiereLocations.entries(state,frame.side).flatMap((entry,index)=>{
  const {card,slot}=entry;
  if(card.subType!=='Imperial'||!adjacentSites(slot,frame.site)||!PremiereLocations.presentAt(entry,slot)||
     PremiereLocations.control(state,frame.side,slot,cardAbility)!==true)return [];
  return [{args:['passNecklace',index],target:card,to:slot,label:'Kette an '+card.name+' bei '+state.locations[slot].name+' weitergeben'}];
 });
 return [...options,{args:['done'],label:'Kette behalten'}];
}
function drainAmount(plan,bonus=0){return Math.max(0,plan.base+plan.modifier+Math.min(bonus,plan.optional))}
function forceDrainValue(side,i){const plan=drainPlan(side,i);return plan?drainAmount(plan):null}
function forceDrainOptions(side){
 if(!state)return [];
 return state.locations.flatMap((loc,siteIndex)=>{
  const plan=drainPlan(side,siteIndex);
  if(!plan)return [];
  return [...Array(plan.optional+1)].map((_,bonus)=>({siteIndex,bonus,amount:drainAmount(plan,bonus),...(plan.cost?{cost:plan.cost}:{})}));
 });
}

function lifeForceRemaining(side){return state?PremiereGame.lifeForce(state,side):0}
function checkLifeForceVictory(){
 if(!state||state.gameWinner)return state?.gameWinner??null;
 state.gameWinner=PremiereGame.outcome(state);
 if(state.gameWinner)log(state.gameWinner==='Simultaneous'?'SPIELENDE – Unentschieden. Beide Life Forces sind gleichzeitig aufgebraucht.':'SPIELENDE: '+state.gameWinner+' Side gewinnt, weil die gegnerische Life Force aufgebraucht ist.');
 return state.gameWinner;
}

function forceLossDescription(side,zone,card){
 return zone!=='hand'&&PremiereGame.lostPileFaceDown(state,side)?'eine verdeckte Karte':card.name;
}

function loseForceForDrain(side,zone,index){
 const pending=state?.pendingForceLoss;
 if(!pending||state.gameWinner||pending.payer!==side||!PremiereGame.lossChoices(state,side,pending.from).some(choice=>
  choice.args[0]===zone&&(zone!=='hand'||choice.args[1]===index)))return false;
 const card=PremiereGame.loseForce(state,side,zone,index);
 if(!card)return false;
 if(pending.reason==='drain'&&state.game){
  const marker=state.drainLossTotals??={},turn=state.game.timing.turn,previous=marker[side];
  marker[side]={turn,amount:previous?.turn===turn?previous.amount+1:1};
 }
 if(zone==='hand'||!PremiereGame.lostPileFaceDown(state,side))queueCharacterLoss(side,card);
 if(zone==='hand'||!PremiereGame.lostPileFaceDown(state,side))queueMemorialLoss(side,card,pending.locationIndex);
 pending.remaining--;
 if(Number.isInteger(pending.amount))pending.amount--;
 const label=forceLossReason(pending.reason);
 log(side+' verliert 1 Force für '+label+' aus '+zone+': '+forceLossDescription(side,zone,card)+'.');
 if(!pending.remaining||!PremiereGame.lossChoices(state,side).length){
  if(pending.reason!=='battleDamage'||!openBattleForceLossResponse(side,pending,'remaining'))finishPendingForceLoss(pending);
 }
 checkLifeForceVictory();publishGame();return true;
}

function forceLossReason(reason){
 return {battleDamage:'Battle Damage',assault:'Assault',prediction:'Prophetess',limitedResources:'Limited Resources',reegesk:'Reegesk',
  frostbite:'Frostbite',deathMark:'Death Mark',mournfulRoar:'Mournful Roar',r3po:'R-3PO',mainGenerator:'zerstörte Main Power Generators',
  tauntaunBones:'Tauntaun Bones',exhaustion:'Exhaustion',hothInterruptCost:'Interrupt-Kosten',hothRescueCost:'Rettungskosten'}[reason]??'Force Drain';
}

function botPayDrainLoss(){
 const side=botSide();
 const sources=['hand','used','force','deck'];
 while(state?.pendingForceLoss?.payer===side&&!state.gameWinner){
  const options=legalActions(state,side);
  const choice=plannedBot()?botPromptAction(options):strategicBot()?botForceLossChoice(options):
   sources.map(zone=>options.find(option=>option.args[0]===zone)).find(Boolean);
  if(!performAction(choice,false))break;
 }
}

function initiateForceDrain(side,i,bonus=0){
 const plan=drainPlan(side,i);
 if(!plan||!Number.isInteger(bonus)||bonus<0||bonus>plan.optional)return false;
 if(plan.cost){spendForce(side,plan.cost);log(side+' verwendet '+plan.cost+' Force für Ickabel G’ont.');}
 (state.drainedSitesThisTurn??=[]).push(i);
 if(plan.participants)(state.drainedCardsThisTurn??=[]).push(...plan.participants);
 log(side+' initiiert einen Force Drain bei '+state.locations[i].name+' ('+drainAmount(plan,bonus)+' Force).');
 if(!openReactWindow('drain',side,i,bonus))resolveForceDrain(side,i,bonus);
 return true;
}
function resolveForceDrain(side,i,bonus){
 const plan=forceDrainEffects(side,i);
 if(!plan)return;
 const amount=drainAmount(plan,bonus);
 for(const {host,weapon} of plan.weapons.slice(0,bonus))if(weapon)PremiereUnits.recordWeaponUse(state,host,weapon);
 log(side+' führt Force Drain '+amount+' bei '+state.locations[i].name+' aus.');
 const fromReserve=PremiereLocations.entries(state,side).some(({card,slot,unavailable})=>!unavailable&&
  (slot===i||adjacentSites(slot,i))&&activeCardRules(card,'drainFromReserve').length);
 beginForceLoss(PremiereGame.otherSide(side),amount,{locationIndex:i,reason:'drain',...(fromReserve?{from:'deck'}:{})});
}
function beginForceLoss(payer,amount,terms){
 if(terms.reason!=='reegesk')amount=forceLossAfterDoomed(payer,amount);
 const loss=capForceLoss(payer,amount);
 if(loss>0){
  state.pendingForceLoss={payer,remaining:loss,amount,...terms};
  log(payer+' muss '+loss+' Force verlieren.');
  if(payer===botSide()&&!currentGame()?.executing)botPayDrainLoss();
 }else if(terms.reason==='drain')finishNecklaceDrain(PremiereGame.otherSide(payer),terms.locationIndex);
 publishGame();
 return loss;
}

function beggarAt(side){
 if(!state?.game||state.activeSide!==side)return null;
 if((state.game.cardRulesVersion??latestCardRulesVersion)<24&&PremiereGame.wasUsed(state.game,'turn','beggarPayment'))return null;
 for(const [site] of state.locations.entries()){
  const effect=PremiereLocations.effectsAt(state,site).find(item=>(item.card.owner??item.card.side)===side&&locationEffectRule(item.card)?.beggar);
  if(effect)return {site,effect};
 }
 return null;
}

function beggarCredit(side){
 const selected=state?.beggarPayment;
 if(selected?.side!==side||selected.turn!==state.game?.timing.turn||!beggarAt(side))return 0;
 return Math.min(selected.amount,ownForceBudget(PremiereGame.otherSide(side)));
}

let quotingForce=false;
const ownForceBudget=side=>quotingForce?Infinity:Math.max(0,(PremiereGame.zones(state,side).force?.length??0)-(typeof cloudCityEnabled==='function'&&cloudCityEnabled()?ccBlockedForce(side):0));
const forceBudget=side=>ownForceBudget(side)+beggarCredit(side);

function spendForce(side,amount=1,reservedOpponentForce=0){
 const {force,used}=PremiereGame.zones(state,side);
 if(!(amount>0))return [];
 const rival=PremiereGame.zones(state,PremiereGame.otherSide(side));
 const available=(rival.force?.length??0)-reservedOpponentForce;
 const borrowed=Math.min(amount,beggarCredit(side),Math.max(0,available));
 if(!borrowed)return PremiereGame.moveTop(force,used,amount);
 const source=beggarAt(side);
 const paid=PremiereGame.moveTop(rival.force,rival.used,borrowed);
 paid.push(...PremiereGame.moveTop(force,used,amount-borrowed));
 state.beggarPayment=null;
 log(side+' verwendet mit '+source.effect.card.name+' '+borrowed+' gegnerische Force.');
 if((state.game.cardRulesVersion??latestCardRulesVersion)>=24){
  const loans=state.beggarLoans??=new Map();
  const previous=loans.get(source.effect);
  loans.set(source.effect,{site:source.site,amount:(previous?.amount??0)+borrowed});
 }else{
  PremiereGame.useOnce(state.game,'turn','beggarPayment');
  if(borrowed>1)cancelLocationEffect(source.site,source.effect);
 }
 return paid;
}

function settleBeggarLoans(){
 for(const [effect,{site,amount}] of state.beggarLoans??[]){
  if(amount>1)cancelLocationEffect(site,effect);
 }
 state.beggarLoans?.clear();
}

function beggarPaymentOptions(side){
 const source=beggarAt(side);
 if(!source)return [];
 const available=PremiereGame.zones(state,PremiereGame.otherSide(side)).force.length;
 const selected=beggarCredit(side);
 return Array.from({length:available+1},(_,amount)=>({args:[amount],site:source.site,card:source.effect.card,
  label:amount?'Nächste Zahlung: '+amount+' gegnerische Force':'Nur eigene Force verwenden',
 })).filter(option=>option.args[0]!==selected);
}

function forceLossAfterDoomed(side,amount){
 if(!state.game||state.doomedTurn!==state.game.timing.turn||side!=='Light')return amount;
 const present=PremiereGame.sides.some(actor=>PremiereLocations.activeCards(state,actor).some(card=>card.id==='Light:343'||isArtoo(card)));
 return present?Math.floor(amount/2):Math.ceil(amount/2);
}

function capForceLoss(side,amount){
 return Math.min(amount,(PremiereGame.zones(state,side).hand?.length??0)+lifeForceRemaining(side));
}

function finishPendingForceLoss(pending){
 if(state.pendingForceLoss!==pending)return;
 state.pendingForceLoss=null;
 if(pending.reason==='battleDamage')endBattleTiming(pending.locationIndex);
 if(pending.reason==='drain')finishNecklaceDrain(PremiereGame.otherSide(pending.payer),pending.locationIndex);
 if(pending.after)pending.after();
 if(pending.reason==='reegesk'){
  const {card,pile}=pending.salvage,index=pile.indexOf(card);
  if(index>=0){
   card.owner=pending.payer;
   PremiereGame.zones(state,pending.payer).hand.push(pile.splice(index,1)[0]);
   log('Reegesk nimmt '+card.name+' als eigene Karte auf die Hand.');
  }
 }
}

function finishNecklaceDrain(side,site){
 const carrier=necklaceCarriers(side,site)[0];
 if(!carrier||state.gameWinner)return;
 const frame={...carrier,site,side,mode:'necklacePass',shown:[]};
 if(necklacePassChoices(frame).length>1)state.pendingCardView=frame;
}

function forceLossReductionOptions(side,debt,key){
 if(!state.game||debt[key]<=0||debt.reason==='reegesk')return [];
 const {hand}=PremiereGame.zones(state,side);
 const limit=Math.min(debt[key],forceBudget(side));
 return (hand??[]).flatMap((card,index)=>activeCardRules(card,'reduceForceLoss').flatMap(()=>
  Array.from({length:limit},(_,offset)=>{
   const amount=limit-offset;
   return {kind:'reduceForceLoss',args:[index,amount],card,amount,label:card.name+' · '+amount+' Force einsetzen'};
  })));
}

function playForceLossReduction(side,index,amount){
 const pending=state.pendingForceLoss,debt=pending??battleSession?.damage?.debt[side],key=pending?'remaining':'damage';
 if(!debt||!forceLossReductionOptions(side,debt,key).some(option=>option.args[0]===index&&option.args[1]===amount))return false;
 const {hand}=PremiereGame.zones(state,side),[card]=hand.splice(index,1);
 spendForce(side,amount);
 const frame={kind:'interrupt',interrupt:'reduceForceLoss',side,card,debt,key,amount};
 log(side+' spielt '+card.name+' und verwendet '+amount+' Force.');
 if(hasInterruptResponse(frame))PremiereGame.openResponse(state.game,frame);
 else settleLossAdjustment(frame);
 return true;
}

function adjustForceLoss(side,debt,key,amount){
 if(key==='remaining'){
  debt.amount=Math.max(0,(debt.amount??debt.remaining)+amount);
  debt.remaining=capForceLoss(side,debt.amount);
  if(!debt.remaining)finishPendingForceLoss(debt);
 }else{
  debt.damage=Math.max(0,debt.damage+amount);
  if(debt.forceOnly)debt.forceOnly=Math.min(debt.damage,debt.forceOnly);
 }
}

function openBattleForceLossResponse(side,debt,key){
 if(!state.game||debt.extraLossOffered)return false;
 const frame={kind:'battleForceLost',side,debt,key,site:battleSession?.site??debt.locationIndex};
 if(!hasInterruptResponse(frame))return false;
 debt.extraLossOffered=true;
 PremiereGame.openResponse(state.game,frame);
 return true;
}

function settleLossAdjustment(frame,parent){
 const {side,card,debt,key,amount}=frame;
 const piles=PremiereGame.zones(state,side);
 (card.subType==='Used'?piles.used:piles.lost).push(card);
 if(frame.interrupt==='reduceForceLoss'){
  adjustForceLoss(side,debt,key,-amount);
 }else if(parent?.interrupt==='reduceForceLoss'){
  adjustForceLoss(parent.side,parent.debt,parent.key,amount);
  PremiereGame.cancelResponse(state.game,parent);
 }else if(parent?.kind==='battleForceLost'){
  adjustForceLoss(parent.side,parent.debt,parent.key,1);
  if(parent.key==='damage')parent.debt.forceOnly=(parent.debt.forceOnly??0)+1;
  PremiereGame.cancelResponse(state.game,parent);
 }
 log(card.name+' · '+(frame.interrupt==='reduceForceLoss'?'Force-Verlust −'+amount:'Force-Verlust +'+amount)+'.');
 settleCancelledResponse(state.game);
}

function isLoc(c){return /location|site|system/i.test(c?.type||'')}

function isSite(c){if(state?.besiegedBattle&&state.locations[state.besiegedBattle.record.bay]===c)return true;return isLoc(c)&&!/system/i.test(c.subType||'')}

function isSystem(c){return isLoc(c)&&/system/i.test(c.subType||'')}

function isPlanetSystem(c){return !!c&&isSystem(c)&&c.locationTags?.includes('Planet')&&Number.isInteger(c.parsec)}
function isSpaceSystem(c){return !!c?.blownAway&&isSystem(c)||isPlanetSystem(c)||!!c&&activeCardRules(c,'mobileSystem').length>0}
function spaceParsec(c){return c.parsec??state.mobileSystems?.[c.id]?.parsec??0}

function mobileSystemOptions(side){
 if(state.activeSide!==side||state.phase!==4||!state.game||!forceBudget(side))return [];
 return state.locations.flatMap((card,slot)=>{
  if(!card||(card.owner??card.side)!==side||!activeCardRules(card,'mobileSystem').length||
    PremiereGame.wasUsed(state.game,'turn',card.id))return [];
  const here=spaceParsec(card),orbit=state.mobileSystems?.[card.id]?.orbit??-1;
  const range=locationTitle(card)==='death star'&&PremiereGame.sides.some(actor=>PremiereLocations.entries(state,actor).some(entry=>
   !entry.unavailable&&state.locations[entry.slot]?.id==='Dark:669'&&activeCardRules(entry.card,'deathStarHyperspeed').length))?2:1;
  return Array.from({length:2*range+1},(_,offset)=>here+offset-range).filter(parsec=>parsec>=0&&parsec<=9).flatMap(parsec=>{
   const destinations=state.locations.flatMap((candidate,i)=>isPlanetSystem(candidate)&&candidate.parsec===parsec?[i]:[]);
   return [...new Set([-1,...destinations])].filter(i=>parsec!==here||i!==orbit).map(i=>({
    args:[slot,parsec,i],card,site:slot,label:card.name+' · Parsec '+parsec+(i>=0?' um '+state.locations[i].name:' im freien Raum')+' (1 Force)',
   }));
  });
 });
}

function moveMobileSystem(side,slot,parsec,orbit){
 const choice=mobileSystemOptions(side).find(option=>option.args[0]===slot&&option.args[1]===parsec&&option.args[2]===orbit);
 if(!choice)return false;
 spendForce(side);
 PremiereGame.useOnce(state.game,'turn',choice.card.id);
 (state.mobileSystems??={})[choice.card.id]={parsec,orbit};
 log(choice.label+'.');
 return true;
}

function isDockingBay327(loc){return !!loc&&locationTitle(loc)==='death star: docking bay 327'}

function deathStarInteriorSites(){
 return boardLocationOrder().filter(slot=>sitePlanet(state.locations[slot])==='death star'&&state.locations[slot].locationTags?.includes('Interior'));
}

function isExteriorPlanetSite(c){return !!c&&isSite(c)&&c.locationTags?.includes('Planet')&&c.locationTags.includes('Exterior')}

function cardUniquenessLimit(card){
 return card.uniquenessLimit??card.name?.match(/^[*•]+/)?.[0].length??(card.unique===true?1:Infinity);
}

function sameTitleOrPersona(card,unit){
 return locationTitle(unit)===locationTitle(card)||card.personas?.some(persona=>
  unit.personas?.some(name=>name.toLowerCase()===persona.toLowerCase()));
}

function withinDeploymentLimit(card,side){
 const limit=cardUniquenessLimit(card);
 if(limit===Infinity)return true;
 const matches=unit=>sameTitleOrPersona(card,unit);
 if(state.outOfPlay?.some(unit=>(unit.owner??unit.side)===side&&matches(unit)))return false;
 const effects=[...Object.values(state.locationEffects??{}).flat(),...(state.tableEffects??[])]
  .map(effect=>effect.card).filter(unit=>(unit.owner??unit.side)===side);
 const own=PremiereLocations.cardsOnTable(state,side).concat(hothEnabled()?Object.values(state.locationWeapons??{}).flat().filter(unit=>(unit.owner??unit.side)===side):[]);
 const held=side==='Light'?PremiereLocations.entries(state,'Dark')
  .filter(entry=>entry.captive&&(entry.card.owner??entry.card.side)==='Light').map(entry=>entry.card):[];
 return [...own,...held,...effects].filter(matches).length<limit;
}



function log(x,side=state.activeSide){
 state.log.unshift(x);
 if(state.game?.publicHistory)state.game.publicHistory.push({turn:state.turn,side,phase:state.phase,message:x});
 if(state.botTurn)(state.botHistory??=[]).unshift(x);
 if(battleSession)battleSession.recentEvents=[x,...(battleSession.recentEvents??[]).slice(0,2)];
}

function startingLocationChoices(deck){
 const offeredTitles=new Set();
 return deck.startingIndices.flatMap(index=>{
  if(deck.setAside.has(index))return [];
  const card=deck.cards[index],title=locationTitle(card);
  if(offeredTitles.has(title))return [];
  offeredTitles.add(title);
  return [{index,card}];
 });
}

const latestCardRulesVersion=34;
const hothEnabled=()=>typeof HothRules!=='undefined'&&(currentGame()?.cardRulesVersion??latestCardRulesVersion)>=HothRules.VERSION&&
 (!currentGame()?.playFormat||['premiere-a-new-hope-hoth','premiere-a-new-hope-hoth-dagobah','premiere-a-new-hope-hoth-dagobah-cloud-city','premiere-a-new-hope-hoth-dagobah-cloud-city-jabbas-palace'].includes(currentGame().playFormat));
const latestBotStrategyVersion=3;
const usesBotPlanner=version=>version===2||version===latestBotStrategyVersion;
const playerSide=()=>currentGame()?.playerSide??'Light';
const botSide=()=>PremiereGame.otherSide(playerSide());
const expandedCardRules=()=> (currentGame()?.cardRulesVersion??latestCardRulesVersion)>=3;

function deploymentSide(card){
 return (currentGame()?.cardRulesVersion??latestCardRulesVersion)>=22?card?.owner??card?.side:card?.side;
}

function start(seed=Math.floor(Math.random()*4294967296),autoChoose=true,trainingBattle=false,decks=starterDecks,cardRulesVersion=latestCardRulesVersion,
 botStrategyVersion=2,side='Light',botPlayStyle='balanced',playFormat){
 if(!decks||!Number.isInteger(seed)||seed<0||seed>4294967295||!PremiereGame.sides.includes(side)||
    (side==='Dark'&&!usesBotPlanner(botStrategyVersion))||
    (botStrategyVersion===latestBotStrategyVersion&&!PremiereBot.isStyle(botPlayStyle)))return false;
 battleSession=null;state=null;
 const game=PremiereGame.actionState(++nextGameId,seed);
 game.publicHistory=[];
 game.starterDecks=decks;
 game.cardRulesVersion=cardRulesVersion;
 game.playFormat=playFormat;
 game.botStrategyVersion=botStrategyVersion;
 if(botStrategyVersion===latestBotStrategyVersion)game.botPlayStyle=botPlayStyle;
 game.playerSide=side;
 setupDecks={game,trainingBattle,
  light:PremiereGame.copyDeck(decks.light,'Light'),
  dark:PremiereGame.copyDeck(decks.dark,'Dark')};
 prepareStartingRound();
 if(autoChoose)chooseBotStartingLocation();
 return true;
}
function prepareStartingRound(){
 setupDecks.revealed=null;
 setupDecks.darkChoice=undefined;
 setupDecks.lightChoice=undefined;
}
function chooseBotStartingLocation(){
 const side=botSide(),options=legalActions(null,side);
 if(!options.length)return false;
 const cursor={randomState:setupDecks.game.randomState};
 const fraction=PremiereGame.random(cursor);
 const index=usesBotPlanner(setupDecks.game.botStrategyVersion)
  ?PremiereBot.startingLocation(setupDecks[side.toLowerCase()].cards.map(({type})=>({type})),options.map(({card})=>card&&{
   icons:card.icons??{},subType:card.subType,locationTags:card.locationTags
  }),fraction,side)
  :Math.floor(fraction*options.length);
 return performAction(options[index]);
}
function resolveStartingChoice(side,index){
 const setup=setupDecks;
 const deck=side==='Dark'?setup.dark:setup.light;
 const choice=startingLocationChoices(deck).find(option=>option.index===index)??null;
 setup[side.toLowerCase()+'Choice']=choice;
 if(side===botSide()){
  PremiereGame.random(setup.game);
  return true;
 }
 const {lightChoice,darkChoice}=setup;
 let collision=!!lightChoice&&!!darkChoice&&locationTitle(lightChoice.card)===locationTitle(darkChoice.card);
 if(collision&&typeof jpGenericStartCollision==='function'&&jpGenericStartCollision(lightChoice.card,darkChoice.card))collision=false;
 if(collision){
  setup.light.setAside.add(lightChoice.index);
  setup.dark.setAside.add(darkChoice.index);
 }
 let invalidGenerator=false;
 if(hothEnabled())for(const [owner,pick] of [['Light',lightChoice],['Dark',darkChoice]]) {
  if(pick?.card.id!=='Light:5586')continue;
  const reserve=setup[owner.toLowerCase()].cards.filter((_,index)=>index!==pick.index);
  if(!HothRules.generatorPlan([lightChoice?.card,darkChoice?.card].filter(Boolean),reserve).allowed) {
   setup[owner.toLowerCase()].setAside.add(pick.index);invalidGenerator=true;collision=true;
  }
 }
 setup.revealed={lightChoice,darkChoice,collision,invalidGenerator};
 return true;
}
function finishSetup(){
 const setup=setupDecks,{lightChoice,darkChoice}=setup.revealed;
 const locations=[lightChoice?.card,darkChoice?.card].filter(Boolean).concat(null);
 // Only the final picks leave the decks. Set-aside cards return to the shuffle.
 const deck=PremiereGame.shuffle(setup.light.cards.filter((card,index)=>index!==lightChoice?.index),setup.game);
 const botDeck=PremiereGame.shuffle(setup.dark.cards.filter((card,index)=>index!==darkChoice?.index),setup.game);
 if(hothEnabled())hothStartingGenerator(locations,deck,botDeck,setup.game);
 const lesson=setup.game.lesson;
 if(lesson)PremiereLearning.arrangeHands(lesson,deck,botDeck);
 const firstSide=lesson?PremiereLearning.lesson(lesson).side??'Light':
  activeCardRules(lightChoice?.card,'firstTurn').length||activeCardRules(darkChoice?.card,'mobileSystem').length?'Light':'Dark';
 state=PremiereGame.createState(setup.game,deck,botDeck,locations,initialLocationOrder(locations),firstSide);
 if(lesson){
  PremiereLearning.prepare(lesson,state,PremiereGame,PremiereUnits);
  state.locationOrder=initialLocationOrder(state.locations);
 }
 state.trainingBattle=setup.trainingBattle;
 const completeSetup=()=>{
 registerDuelTiming();
 setupDecks=null;
 log('Starting Locations: Light '+(lightChoice?.card.name??'kein Startort')+' / Dark '+(darkChoice?.card.name??'kein Startort')+'. Je 8 Karten Starthand. '+firstSide+' Side beginnt.');
 if(lesson)log('Lernstart · '+PremiereLearning.lesson(lesson).title+'. Ausgangslage für die Übung vorbereitet.');
 if(firstSide===botSide())botBegin();
 checkpoint('turn:start',()=>checkpoint('phase:start',()=>{}));
 };
 if(typeof jpStartingInterrupts==='function'&&jpEnabled()){setupDecks=null;jpStartingInterrupts(completeSetup);}else completeSetup();
 return true;
}

function sitePlanet(card){
 if(!card||!isSite(card))return null;
 if(isHoloSite(card)||card.locationTags?.includes('Vehicle Site'))return null;
 const match=locationTitle(card).match(/^([^:]+):\s*\S/);
 return match?match[1].trim():null;
}

function locationGroup(card){if(isHoloSite(card))return 'holosite';if(card?.hostInstanceId)return 'vehicle:'+card.hostInstanceId;return card&&isSystem(card)?locationTitle(card):sitePlanet(card)}

function locationPlacementRank(card){
 // Inside, Cantina, indoor/outdoor docking bay, Mos Eisley, outside, system.
 // The three named Tatooine sites form an uninterrupted block when in play.
 if(isSystem(card))return 5;
 const marker=PremiereLocations.hothMarker(card);
 if(marker!==null)return 4+marker/10;
 if(sitePlanet(card)==='hoth'&&card.locationTags?.includes('Exterior')&&!card.locationTags.includes('Interior'))return 4.65;
 const title=locationTitle(card);
 if(title==='tatooine: cantina')return 1;
 if(title==='tatooine: mos eisley')return 3;
 if(card.locationTags?.includes('Interior'))return card.locationTags.includes('Exterior')?2:0;
 return 4;
}

function initialLocationOrder(locations){
 const groups=new Map();
 locations.forEach((card,slot)=>{
  if(!card)return;
  const group=locationGroup(card)??slot;
  if(!groups.has(group))groups.set(group,[]);
  groups.get(group).push(slot);
 });
 return [...groups.values()].flatMap(slots=>slots.sort((a,b)=>locationPlacementRank(locations[a])-locationPlacementRank(locations[b])));
}

function boardLocationOrder(){return state.locationOrder??initialLocationOrder(state.locations)}

function adjacentSites(from,to){
 const a=state?.locations[from],b=state?.locations[to];
 if(isHoloSite(a)||isHoloSite(b))return false;
 if(a?.hostInstanceId||b?.hostInstanceId){
  if(a?.hostInstanceId&&a.hostInstanceId===b?.hostInstanceId)return Math.abs(boardLocationOrder().indexOf(from)-boardLocationOrder().indexOf(to))===1;
  const interior=a?.hostInstanceId?a:b,exterior=a?.hostInstanceId?to:from;
  return PremiereGame.sides.some(side=>PremiereLocations.entries(state,side).some(entry=>entry.card.instanceId===interior.hostInstanceId&&entry.slot===exterior&&!entry.unavailable&&isSite(state.locations[exterior])));
 }
 const group=sitePlanet(state?.locations[from]);
 if(!group||group!==sitePlanet(state.locations[to]))return false;
 const order=boardLocationOrder(),position=order.indexOf(from);
 return position>=0&&(order[position-1]===to||order[position+1]===to);
}

function sentryModifier(side,slot,mode){
 if((currentGame()?.cardRulesVersion??latestCardRulesVersion)<21||!state.locationEffects)return 0;
 return Object.keys(state.locationEffects).some(index=>{
  const site=Number(index);
  return (site===slot||adjacentSites(site,slot))&&PremiereLocations.effectsAt(state,site).some(effect=>
   effect.sentryMode===mode&&!PremiereUnits.textSuppressed(effect.card)&&
   (mode==='power'?effect.card.side===side:effect.card.side!==side));
 })?1:0;
}

function landedAt(card,slot){
 const trench=state.locations[slot]?.id==='Light:681'&&(currentGame()?.cardRulesVersion??latestCardRulesVersion)>=30;
 return card.type==='Starship'&&!trench&&!!state.locations[slot]&&isSite(state.locations[slot]);
}

function craftStats(card,slot,forMovement=false){
 const rulesVersion=currentGame()?.cardRulesVersion??latestCardRulesVersion;
 const stats=PremiereUnits.stats(card,permanentPilotAbility(card),{landed:!forMovement&&landedAt(card,slot),
  activePilotText:rulesVersion>=7,excludesOccupant:forMovement?undefined:unit=>excludedAtBattle(unit,slot),
  suspendsPilotText:pilot=>garoufSuspended(pilot,slot)});
 if(stats.powered&&card.type==='Starship'&&card.occupants?.some(({card:unit})=>PremiereUnits.active(unit)&&
   !excludedAtBattle(unit,slot)&&activeCardRules(unit,'ionRepair').length)){
  stats.power++;
  if(!card.ionDamage&&Number.isFinite(stats.maneuver))stats.maneuver++;
 }
 if(stats.powered)for(const rule of astromechShipRules(card,slot)){
  stats.power+=rule.power;
  if(!card.ionDamage&&Number.isFinite(stats.maneuver))stats.maneuver+=rule.maneuver??0;
  if(!card.ionDamage&&Number.isFinite(stats.hyperspeed))stats.hyperspeed+=rule.hyperspeed??0;
 }
 const attachments=card.attachments??[];
 if(!card.ionDamage){
  if(Number.isFinite(stats.maneuver)&&attachments.some(effect=>activeCardRules(effect,'doubleWeaponFire').length))stats.maneuver++;
  for(const effect of attachments){
   const stat=effect.hullStat;
   if(stat&&Number.isFinite(stats[stat])&&activeCardRules(effect,'falconModification').length)stats[stat]+=2;
  }
 }
 if(stats.powered&&card.type==='Vehicle'&&attachments.some(effect=>activeCardRules(effect,'sensorPanel').length)){
  stats.power++;
  if(Number.isFinite(stats.landspeed))stats.landspeed++;
 }
 for(const modifier of state?.shipManeuvers?.get(card)??[]){
  if(modifier.turn!==state.game.timing.turn)continue;
  if(!card.ionDamage&&Number.isFinite(stats.maneuver))stats.maneuver+=modifier.maneuver??2;
  if(!card.ionDamage&&Number.isFinite(stats.hyperspeed))stats.hyperspeed+=modifier.hyperspeed??2;
  stats.power+=modifier.power;
 }
 if(Number.isFinite(stats.maneuver))stats.maneuver=Math.max(0,stats.maneuver);
 if(stats.powered&&isSystem(state.locations[slot])&&characterTraits(card).includes('rebel (starship)')){
  const side=PremiereLocations.findEntry(state,card)?.side;
  const region=locationGroup(state.locations[slot]);
  const station=side&&PremiereLocations.entries(state,side).some(({card:officer,slot:site,unavailable})=>
   !unavailable&&activeCardRules(officer,'warRoomShipPower').length&&isSite(state.locations[site])&&
   sitePlanet(state.locations[site])===region&&/\bwar room\b/.test(locationTitle(state.locations[site]))&&
   PremiereLocations.control(state,side,site,cardAbility)===true);
  if(station)stats.power++;
 }
 if(stats.powered&&locationTitle(state.locations[slot])==='death star'){
  const side=PremiereLocations.findEntry(state,card)?.side;
  if(side&&state.locations.some((site,index)=>isSite(site)&&PremiereLocations.rulesAt(state,index,side,'massassiShipPower')
   .some(rule=>rulesVersion>=rule.since)&&PremiereLocations.control(state,side,index,cardAbility)===true&&
   PremiereLocations.entries(state,side).some(entry=>entry.slot===index&&!entry.unavailable&&
    characterTraits(entry.card).includes('leader'))))stats.power++;
 }
 stats.power+=falconModificationBonus(card,forMovement?undefined:slot);
 if(stats.powered)stats.power+=kashyyykCrewBonus(card,slot);
 if(card.side==='Light'&&PremiereUnits.fighter(card)&&PremiereLocations.ruleAt(state,slot,'Light','trenchManeuver')&&Number.isFinite(stats.maneuver))stats.maneuver=Math.max(0,stats.maneuver-2);
 if(lateralDamage(card))stats.power=0;
 if(!stats.powered&&card.id==='Light:1677'&&(currentGame()?.cardRulesVersion??latestCardRulesVersion)>=10){
  stats.maneuver=0;
  stats.hyperspeed=0;
 }
 if(rulesVersion>=24&&!stats.powered&&['Starship','Vehicle'].includes(card.type)){
  stats.power=0;
  stats.armor=Number.isFinite(card.armor)?(card.ionDamage?0:2):null;
  for(const attribute of ['maneuver','hyperspeed','landspeed']){
   if(Number.isFinite(card[attribute]))stats[attribute]=0;
  }
 }
 return hothEnabled()?hothCraftStats(card,slot,stats):stats;
}

function astromechShipRules(card,slot){
 if(card.type!=='Starship'||(currentGame()?.cardRulesVersion??latestCardRulesVersion)<28)return [];
 const side=card.controller??card.owner??card.side;
 return (card.occupants??[]).flatMap(({card:unit})=>{
  if(!PremiereUnits.active(unit)||excludedAtBattle(unit,slot))return [];
  return activeCardRules(unit,'astromechShipStats').filter(rule=>rule.fighter&&PremiereUnits.fighter(card)||
   rule.capital&&PremiereUnits.capital(card)&&(unit.owner??unit.side)===side).map(rule=>rule.redFive?{...rule,power:card.id==='Light:2061'?3:2,maneuver:card.id==='Light:2061'?3:2,hyperspeed:card.id==='Light:2061'?3:2}:rule);
 });
}

function kashyyykCrewBonus(card,slot){
 if(card.type!=='Starship'||(currentGame()?.cardRulesVersion??latestCardRulesVersion)<28)return 0;
 const side=card.controller??card.owner??card.side;
 const rule=side&&PremiereLocations.ruleAt(state,slot,side,'kashyyykCrew');
 return rule&&card.occupants?.some(({card:crew})=>PremiereUnits.active(crew)&&
  !excludedAtBattle(crew,slot)&&characterTraits(crew).includes('wookiee'))?rule.amount:0;
}

function falconModificationBonus(card,slot){
 if(card.id!=='Light:1677'||!card.occupants?.some(({card,role})=>role==='pilot'&&PremiereUnits.active(card)&&
  !excludedAtBattle(card,slot)&&
  /^(han solo|lando calrissian|chewbacca)$/.test(locationTitle(card))))return 0;
 return Math.max(0,...(card.attachments??[]).flatMap(effect=>activeCardRules(effect,'falconModification').map(rule=>rule.amount)));
}

function movementRestriction(card){
 if(hothEnabled()){const reason=hothMovementRestriction(card);if(reason)return reason;}
 if(card.noMoveTurn!==undefined&&card.noMoveTurn===state.game?.timing.turn)return 'Bewegung wurde für diesen Zug verhindert.';
 if(card.asleep)return 'Die Karte schläft und kann sich nicht bewegen.';
 if(PremiereUnits.restrainingBolt(card))return 'Ein Restraining Bolt verhindert die Bewegung.';
 if(activeCardRules(card,'cannotMove').length&&!squadGuardReleased(card))return 'Der Kartentext erlaubt keine Bewegung.';
 if(barredThisTurn(card))return 'Imperial Barrier verhindert die Bewegung in diesem Zug.';
 if(movementBlockedByAlert(card))return 'Full Scale Alert verhindert die Bewegung in diesem Zug.';
 return '';
}

const movementPrevented=card=>!!movementRestriction(card);

function wagerOptions(side){
 if(state.activeSide!==side||state.phase!==1||!state.game||!forceBudget(side))return [];
 return PremiereLocations.entries(state,side).flatMap(({card,slot,unavailable},index)=>activeCardRules(card,'wager').length&&
  !unavailable&&!PremiereGame.wasUsed(state.game,'turn',card.id)?[{args:[index],card,site:slot,label:card.name+' · Wette abschließen (1 Force)'}]:[]);
}

function playWager(side,index){
 const option=wagerOptions(side).find(choice=>choice.args[0]===index);
 if(!option)return false;
 const {card}=option,{force,used}=PremiereGame.zones(state,side),other=PremiereGame.otherSide(side);
 spendForce(side);
 PremiereGame.useOnce(state.game,'turn',card.id);
 drawDestinySeries(side,'wager',3,0,first=>drawDestinySeries(other,'wager',2,0,second=>{
  const own=PremiereBattle.total(first),opposing=PremiereBattle.total(second);
  if(own==null||opposing==null||own===opposing)return;
  const winner=own>opposing?side:other;
  log(card.name+' · Wette '+own+' zu '+opposing+'. '+winner+' gewinnt.');
  if(PremiereGame.zones(state,winner).lost.length)state.pendingCardView={mode:'wagerRetrieval',side:winner,card,shown:[]};
 }));
 return true;
}

function movementBlockedByAlert(card){
 const alert=state?.fullScaleAlert;
 if(!alert||alert.turn!==state.game?.timing.turn)return false;
 const entry=PremiereLocations.findEntry(state,card);
 const actor=entry?.side??card.controller??card.side;
 if(actor!==alert.target)return false;
 if(PremiereUnits.hasSkill(card,'smuggler'))return false;
 return card.type!=='Starship'||!PremiereLocations.activeCards(state,actor).some(actorCard=>
  PremiereUnits.hasSkill(actorCard,'smuggler')&&PremiereLocations.aboard(state,actorCard,card));
}

function barredThisTurn(card){
 return !!state?.game&&state.barredCards?.get(card)===state.game.timing.turn;
}

function groundReach(card,from,to,range){
 const order=boardLocationOrder(),a=order.indexOf(from),b=order.indexOf(to),region=sitePlanet(state.locations[from]);
 if(a<0||b<0||!region||region!==sitePlanet(state.locations[to])||Math.abs(a-b)>range)return false;
 return order.slice(Math.min(a,b),Math.max(a,b)+1).every(slot=>{
  const loc=state.locations[slot],tags=loc.locationTags??[];
  if(sitePlanet(loc)!==region)return false;
  if(PremiereUnits.tube(card))return tags.includes('Interior')&&tags.includes('Mobile');
  if(PremiereUnits.bantha(card))return isExteriorPlanetSite(loc);
  if(PremiereUnits.crawler(card)){
   const version=currentGame()?.cardRulesVersion??latestCardRulesVersion;
   if(version<14)return tags.includes('Exterior')&&tags.includes('Planet');
   return tags.includes('Exterior')&&(card.id==='Dark:2160'?!tags.includes('Mobile'):tags.includes('Planet'));
  }
  if(card.type==='Vehicle')return tags.includes('Exterior');
  return true;
 });
}

function baseTravelOptions(card,side,from,to,react=false){
 const origin=state.locations[from],destination=state.locations[to];
 if(from===to||!origin||!destination||origin.id==='Light:681'||destination.id==='Light:681'||isHoloSite(origin)||isHoloSite(destination)||!PremiereUnits.active(card)||movementPrevented(card))return [];
 const options=[];
 if(card.type==='Starship'){
  const stats=craftStats(card,from,true);
  if(!stats.powered)return [];
  const range=stats.hyperspeed>0?stats.hyperspeed+registeredLocationModifier('shipDepartureRange',card,side,from):0;
  const free=[from,to].some(slot=>registeredLocationModifier('shipTravelFree',card,side,slot)>0);
  if(isSpaceSystem(origin)&&isSpaceSystem(destination)&&stats.navComputer&&stats.hyperspeed>0&&
     Math.abs(spaceParsec(origin)-spaceParsec(destination))<=range)options.push({kind:'Hyperspeed',cost:free?0:1});
  if(PremiereUnits.fighter(card)||hothEnabled()&&card.id==='Light:1665'||typeof dagobahEnabled==='function'&&dagobahEnabled()&&card.id==='Dark:1185'||typeof cloudCityEnabled==='function'&&cloudCityEnabled()&&card.id==='Light:332'){
   const landing=isPlanetSystem(origin)&&isExteriorPlanetSite(destination)&&locationGroup(origin)===sitePlanet(destination);
   const takeoff=isExteriorPlanetSite(origin)&&isPlanetSystem(destination)&&sitePlanet(origin)===locationGroup(destination);
   const bay=PremiereLocations.conditions(state,landing?to:from,side).dockingBay;
   if((landing||takeoff)&&(bay||!PremiereUnits.tie(card)))options.push({kind:landing?'Landen':'Starten',cost:bay?0:1});
  }
  return options;
 }
 const vehicle=card.type==='Vehicle',character=card.type==='Character'||isDeployableCharacter(card)||!!card.migTarget||activeCardRules(card,'remote').length;
 if(card.type==='Creature')return creatureHabitat(card,from)&&creatureHabitat(card,to)&&adjacentSites(from,to)?[{kind:'Landspeed',cost:1}]:[];
 if(!vehicle&&!character)return [];
 const kalSpeed=card.id==='Light:1407'&&((currentGame()?.cardRulesVersion??latestCardRulesVersion)<7||!PremiereUnits.textSuppressed(card));
 const [flight]=activeCardRules(card,'deployPhaseLandspeed');
 const speed=(flight?(!react&&state.phase===2&&state.activeSide===side?flight.range:0):
  vehicle?craftStats(card,from).landspeed:card.id==='Dark:1709'||kalSpeed?3:typeof cloudCityEnabled==='function'&&cloudCityEnabled()&&card.id==='Dark:287'?3:1)+(typeof cloudCityEnabled==='function'&&cloudCityEnabled()&&card.cloudCityLandspeedTurn===state.game.timing.turn?1:0);
 if(speed>0&&groundReach(card,from,to,react&&card.id==='Light:2250'?1:speed)){
  const free=!react&&state.phase===4&&character&&card.subType==='Imperial'&&adjacentSites(from,to)&&
   garindanBenefit(side,to,'imperialMove');
  options.push({kind:'Landspeed',cost:vehicle?PremiereUnits.landspeedCost(card):free?0:1});
 }
 if(!react&&state.phase===1){
  const names=[locationTitle(origin),locationTitle(destination)].sort();
  const mos=locationTitle(origin)==='tatooine: mos eisley'?from:to;
  return names[0]==='tatooine: cantina'&&names[1]==='tatooine: mos eisley'&&character&&
   PremiereLocations.ruleAt(state,mos,side,'cantinaMove')?[{kind:'Mos Eisley',cost:0}]:[];
 }
 if(!react&&state.phase===4&&!PremiereUnits.tube(card)&&!PremiereUnits.crawler(card)&&
  PremiereLocations.conditions(state,from,side).dockingBay&&PremiereLocations.conditions(state,to,side).dockingBay){
  options.push({kind:'Docking-Bay-Transit',cost:PremiereLocations.conditions(state,from,side).transitCost});
 }
 if(!react&&state.phase===4&&sitePlanet(destination)==='death star'&&character&&/^Imperial$/i.test(card.subType??'')&&
    PremiereLocations.ruleAt(state,from,side,'militaryCorridorMove')){
  options.push({kind:'Militärkorridor',cost:0});
 }
 return options;
}

function regularMoveKind(card,from,to){return travelOptions(card,card.side??state.activeSide??'Light',from,to)[0]?.kind??null}

const regularMovementUsed=card=>state.movedThisTurn?.includes(card);

function movementOptionsFor(side){
 if(!state||state.gameWinner||state.pendingForceLoss||!PremiereGame.sides.includes(side)||
    (state.activeSide&&state.activeSide!==side)||![1,2,4].includes(state.phase))return [];
 if((side===botSide())!==!!state.botTurn)return [];
 const {force,board}=PremiereGame.zones(state,side);
 if(!force||!board)return [];
 return board.flatMap((row,from)=>row.flatMap((card,index)=>{
  if(regularMovementUsed(card)||state.phase===2&&!activeCardRules(card,'deployPhaseLandspeed').length)return [];
  return state.locations.flatMap((location,to)=>travelOptions(card,side,from,to)
   .filter(travel=>travel.cost<=forceBudget(side))
   .map(travel=>({...travel,from,to,index,card,name:card.name})));
 }));
}

function movementOptions(){return movementOptionsFor('Light')}

function moveCharacterFor(side,from,index,to,kind){
 const option=movementOptionsFor(side).find(x=>x.from===from&&x.index===index&&x.to===to&&(!kind||x.kind===kind));
 if(!option)return false;
 const {board}=PremiereGame.zones(state,side);
 const [card]=board[from].splice(index,1);
 spendForce(side,option.cost);
 board[to].push(card);
 clearJuriAfterMove(card,side,to);
 for(const {card:passenger,role} of card.occupants??[])if(role!=='driver')clearJuriAfterMove(passenger,side,to);
 if(option.kind==='Landspeed')noteMineTraversal(side,from,to,card);
 if(hothEnabled())hothMoved(side,card,from,to);
 (state.movedThisTurn??=[]).push(card);
 log(side+' bewegt '+card.name+' per '+option.kind+' nach '+state.locations[to].name+' ('+option.cost+' Force).');
 publishGame();return true;
}

function moveCharacter(from,index,to){return moveCharacterFor('Light',from,index,to)}

function canDock(first,second,slot){
 return first!==second&&first.type==='Starship'&&second.type==='Starship'&&
  PremiereUnits.active(first)&&PremiereUnits.active(second)&&isSystem(state.locations[slot])&&
  [first,second].some(ship=>PremiereUnits.hasDock(ship)||PremiereUnits.capital(ship))&&
  [first,second].some(ship=>craftStats(ship,slot).powered);
}

function transportOptions(side){
 const options=[];
 if(state.activeSide!==side||![2,4].includes(state.phase))return options;
 const {board,hand}=PremiereGame.zones(state,side);
 const expandedDeploy=(currentGame()?.cardRulesVersion??latestCardRulesVersion)>=9;
 const roleBlocked=card=>activeCardRules(card,'cannotMove').length||
  barredThisTurn(card)||((currentGame()?.cardRulesVersion??latestCardRulesVersion)>=10&&PremiereUnits.restrainingBolt(card));
 const move=state.phase===4,ready=card=>PremiereUnits.active(card)&&!state.movedThisTurn?.includes(card)&&!movementPrevented(card);
 const offer=(kind,from,to,unit,host,role,cost,card,carrier,label,opponentCost=0)=>{
  const free=hothEnabled()&&kind!=='deployAboard'&&(hothCalFree(side,card,from,to)||['shuttleUp','shuttleDown'].includes(kind)&&hothShuttleFree(side,card,from,to));
  if(free)cost=0;
  if(hothEnabled()&&!free&&from!==to&&kind!=='deployAboard'&&!['dock','swap'].includes(kind))cost+=Number(!!state.locations[from]?.collapsed)+Number(!!state.locations[to]?.collapsed);
  if(hothEnabled()&&carrier?.crashed&&PremiereUnits.enclosed(carrier)&&['embark','exit'].includes(kind)&&card?.type==='Character')cost=1;
  if(cost>0&&from!==to&&card?.type==='Character')cost+=musicianCoverCharge(state.locations[to]);
  if(cost<=(forceBudget(side)))options.push({args:[kind,from,to,unit,host,role],from,to,card,carrier,cost,label,opponentCost});
 };
 for(const [slot,row] of (board??[]).entries())for(const [i,host] of row.entries()){
  if(!PremiereUnits.active(host))continue;
  const here=state.locations[slot];
  if(here?.id==='Light:681')continue;
  const landed=isSite(here);
  if(!move&&['Starship','Vehicle'].includes(host.type)){
   for(const [h,card] of (hand??[]).entries()){
    const splitDeploy=expandedDeploy&&jawaCosts.has(card.id);
    const owner=card.owner??card.side;
    if((owner&&owner!==side)||(!splitDeploy&&!Number.isFinite(card.deploy))||!withinDeploymentLimit(card,side)||!hasDeployPresence(side,here))continue;
    if(card.type==='Character'&&(!characterLocationAllowed(card,here)||activeCardRules(card,'deployUndercover').length))continue;
    if(hothEnabled()&&!hothDeploymentAllowed(card,here,side))continue;
    const payment=splitDeploy?jawaDeployPayment(card,here,side):null;
    if(splitDeploy&&!canPayJawaDeploy(side,payment))continue;
    for(const role of PremiereUnits.roles(host,card)){
     offer('deployAboard',slot,slot,h,i,role,payment?.own??crewDeployCost(card,side,here),card,host,'An Bord ausspielen',payment?.opposing);
    }
   }
  }
  if(move)for(const [j,card] of row.entries())for(const role of PremiereUnits.roles(host,card)){
   if(!movementPrevented(card)&&(landed||role==='cargo'||role==='hangar'))offer('embark',slot,slot,j,i,role,0,card,host,'Einsteigen');
  }
  for(const [j,entry] of (host.occupants??[]).entries()){
   const card=entry.card;
   if(!PremiereUnits.active(card)||roleBlocked(card))continue;
   for(const role of PremiereUnits.roles(host,card,entry).filter(role=>role!==entry.role)){
    offer('role',slot,slot,j,i,role,0,card,host,'Rolle wechseln');
   }
   (host.occupants??[]).forEach((other,k)=>{
    if(k>j&&other.role!==entry.role&&!roleBlocked(other.card)&&PremiereUnits.accepts(host,card,other.role,other)&&
       PremiereUnits.accepts(host,other.card,entry.role,entry))offer('swap',slot,k,j,i,'',0,card,host,'Rollen tauschen mit '+other.card.name);
   });
   if(!move||PremiereUnits.restrainingBolt(card))continue;
   if(landed||(entry.role==='hangar'&&craftStats(card,slot,true).powered))offer('exit',slot,slot,j,i,'',0,card,host,'Aussteigen');
   if(!landed&&host.type==='Starship'&&['pilot','passenger','cargo','hangar'].includes(entry.role)){
    row.forEach((target,k)=>{
     if(!canDock(host,target,slot))return;
     for(const role of PremiereUnits.roles(target,card).filter(role=>role!=='astromech')){
      offer('dock',slot,k,j,i,role,1,card,target,'Andocken und transferieren');
     }
    });
   }
   if(!landed&&PremiereUnits.capital(host)&&ready(card)&&['Character','Vehicle'].includes(card.type)&&!PremiereUnits.bantha(card)){
    state.locations.forEach((loc,to)=>{
     if(isExteriorPlanetSite(loc)&&sitePlanet(loc)===locationGroup(here))offer('shuttleDown',slot,to,j,i,'',1,card,host,'Shuttle zum Site');
    });
   }
  }
  if(move&&!landed&&PremiereUnits.capital(host)){
   state.locations.forEach((loc,from)=>{
    if(!isExteriorPlanetSite(loc)||sitePlanet(loc)!==locationGroup(here))return;
    board[from].forEach((card,j)=>{
     if(!ready(card))return;
     for(const role of PremiereUnits.roles(host,card).filter(role=>role!=='hangar')){
      offer('shuttleUp',from,slot,j,i,role,1,card,host,'Shuttle zum Schiff');
     }
    });
   });
  }
 }
 return options;
}

function performTransport(side,...args){
 const choice=transportOptions(side).find(option=>option.args.every((value,i)=>value===args[i]));
 if(!choice)return false;
 const [kind,from,to,index,hostIndex,role]=choice.args;
 const {board,hand}=PremiereGame.zones(state,side);
 const host=board[kind==='shuttleUp'?to:from][hostIndex];
 const card=choice.card;
 if(kind==='role')host.occupants[index].role=role;
 else if(kind==='swap'){
  const first=host.occupants[index],second=host.occupants[to];
  [first.role,second.role]=[second.role,first.role];
 }
 else if(kind==='deployAboard'){
  hand.splice(index,1);
  PremiereUnits.add(host,card,role,side);
  (state.deployedThisTurn??=[]).push(card);
 }else if(kind==='embark'||kind==='shuttleUp'){
  board[from].splice(index,1);
  PremiereUnits.add(host,card,role,side);
 }else{
  host.occupants.splice(index,1);
  if(kind==='dock')PremiereUnits.add(board[from][to],card,role,side);
  else board[to].push(card);
 }
 if(kind==='shuttleUp'||kind==='shuttleDown')(state.movedThisTurn??=[]).push(card);
 if(kind==='shuttleDown'||kind==='exit')clearJuriAfterMove(card,side,to);
 if(kind==='deployAboard'&&jawaCosts.has(card.id))spendJawaDeployForce(side,choice.cost,choice.opponentCost);
 else spendForce(side,choice.cost);
 if(choice.opponentCost)payOpposingJawaCost(side,choice.opponentCost);
 log(side+' · '+choice.label+': '+card.name+' / '+choice.carrier.name+' ('+choice.cost+' Force).');
 if(kind==='deployAboard')openDeploymentReaction(side,[card]);
 return true;
}

function transitGroups(side){
 const groups=new Map();
 for(const option of movementOptionsFor(side).filter(move=>move.kind==='Docking-Bay-Transit')){
  const key=option.from+':'+option.to;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(option);
 }
 return [...groups.values()].filter(group=>group.length>1);
}

function performTransitGroup(side,group){
 const {from,to,cost}=group[0];
 const {board}=PremiereGame.zones(state,side);
 for(const move of group.slice().reverse())board[from].splice(move.index,1);
 const cards=group.map(move=>move.card);
 board[to].push(...cards);
 (state.movedThisTurn??=[]).push(...cards);
 spendForce(side,cost);
 log(side+' verlegt '+cards.map(card=>card.name).join(', ')+' per Docking-Bay-Transit ('+cost+' Force).');
 return true;
}

function dockingGroups(side){
 if(state.phase!==4)return [];
 const {board}=PremiereGame.zones(state,side);
 if(!forceBudget(side))return [];
 return board.flatMap((row,slot)=>row.flatMap((first,left)=>row.flatMap((second,right)=>{
  if(right<=left||!canDock(first,second,slot))return [];
  const ships=[first,second];
  const choices=ships.flatMap((ship,source)=>(ship.occupants??[]).flatMap(({card,role},index)=>{
   if(!['pilot','passenger','cargo','hangar'].includes(role)||movementPrevented(card))return [];
   const destination={...ships[1-source],occupants:[]};
   const roles=PremiereUnits.roles(destination,card).filter(role=>role!=='astromech');
   return roles.length?[{source,index,card,roles}]:[];
  }));
  return choices.length>1?[{args:[slot,left,right],from:slot,cost:1,ships,choices}]:[];
 })));
}

function dockingPlan({ships,choices},selection){
 if(!selection.length||selection.length%3!==0)return null;
 const occupants=ships.map(ship=>(ship.occupants??[]).slice());
 const moved=[new Set(),new Set()], transfers=[];
 for(let i=0;i<selection.length;i+=3){
  const [source,index,role]=selection.slice(i,i+3);
  const choice=choices.find(entry=>entry.source===source&&entry.index===index&&entry.roles.includes(role));
  if(!choice||moved[source].has(index))return null;
  moved[source].add(index);
  transfers.push({source,role,entry:occupants[source][index]});
 }
 const next=ships.map((ship,i)=>({...ship,occupants:occupants[i].filter((_,index)=>!moved[i].has(index))}));
 for(const {source,role,entry} of transfers){
  const destination=next[1-source];
  if(!PremiereUnits.accepts(destination,entry.card,role))return null;
  destination.occupants.push({...entry,role});
 }
 return {occupants:next.map(ship=>ship.occupants),cards:transfers.map(({entry})=>entry.card)};
}

function performDockingGroup(side,ships,plan){
 if(!plan)return false;

 ships.forEach((ship,index)=>{ship.occupants=plan.occupants[index]});
 spendForce(side);
 log(side+' transferiert '+plan.cards.map(card=>card.name).join(', ')+' zwischen '+ships.map(ship=>ship.name).join(' und ')+' (1 Force).');
 return true;
}


function botMoveScore(option){
 if(strategicBot())return strategicMoveScore(option);
 const dest=state.locations[option.to],lightIcons=Number.isInteger(dest?.icons?.light)?dest.icons.light:0;
 const enemy=confirmedPresence('Light',option.to)===true?2:0,empty=confirmedPresence('Dark',option.to)!==true?1:0;
 const leavesLast=(state.dark[option.from]||[]).length===1?2:0;
 return lightIcons*2+enemy+empty-leavesLast;
}

function strategicBot(){return state?.game?.botStrategyVersion===1}
function plannedBot(){return usesBotPlanner(state?.game?.botStrategyVersion)}
function styledBot(){return state?.game?.botStrategyVersion===latestBotStrategyVersion}

function botPosition(slot){
 return {...battleTotals(slot),dark:confirmedPresence('Dark',slot),light:confirmedPresence('Light',slot),
  drain:PremiereLocations.icons(state,slot,'Light')??0};
}

function botUnitStrength(card,slot,pilot=null,side='Dark'){
 if(['Starship','Vehicle'].includes(card.type)){
  const craft=pilot?{...card,occupants:[...(card.occupants??[]),{role:'pilot',card:pilot}]}:card;
  const stats=craftStats(craft,slot);
  const ability=stats.ability||(craft.occupants??[]).reduce((sum,entry)=>sum+(cardAbility(entry.card)??0),0)||cardAbility(card)||0;
  return {power:stats.power,ability};
 }
 return {power:Math.max(0,(card.power??0)+cardPowerModifier(card,side,slot)),ability:cardAbility(card)??0};
}

// The engine owns legal actions and their arguments. The planner gets only
// public facts, the bot's hand, and targets the current rules have revealed.
function plannedBotPosition(offers,side=botSide(),style=styledBot()?state.game.botPlayStyle:undefined){
 const rival=PremiereGame.otherSide(side);
 const {hand=[],board=[],deck=[],force=[]}=PremiereGame.zones(state,side);
 const entries=PremiereGame.sides.flatMap(side=>PremiereLocations.entries(state,side));
 const publicEntries=new Map(entries.map(entry=>[entry.card,entry]));
 const visible=new Set([...hand,...publicEntries.keys(),...state.locations.filter(Boolean)]);
 const frame=state.pendingCardView?.side===side?state.pendingCardView:null;
 const window=PremiereGame.responseWindow(state.game);
 const debt=window||frame?null:battleSession?.damage?.debt[side];
 const pending=!window&&state.pendingForceLoss?.payer===side?state.pendingForceLoss:null;
 const count=pile=>pile?.some(PremiereGame.isReserveInsert)?null:pile?.length??0;
 const reserveCount=count(deck),rivalReserve=count(PremiereGame.zones(state,rival).deck);
 const project=(card,offered=false)=>{
  if(!card||(!offered&&!visible.has(card)))return null;
  const own=hand.includes(card);
  const title=own&&(card.type==='Location'||card.uniquenessLimit)?locationTitle(card):null;
  return {type:card.type,power:card.power??0,ability:cardAbility(card)??0,
   icons:{own:card.icons?.[side.toLowerCase()]??0,rival:card.icons?.[rival.toLowerCase()]??0},
   redundant:!!title&&Array.from(visible).some(copy=>copy!==card&&locationTitle(copy)===title),
   needsCrew:own&&card.type==='Starship'&&permanentPilotAbility(card)===null&&
    !hand.some(pilot=>pilot.pilot&&withinDeploymentLimit(pilot,side))};
 };
 const positions=state.locations.map((location,slot)=>{
  if(!location)return null;
  const ownPresence=confirmedPresence(side,slot),rivalPresence=confirmedPresence(rival,slot);
  const drain=PremiereLocations.icons(state,slot,rival)??0;
  const initiator=battleSession?.site===slot?battleSession.initiator:side;
  const totals=battleTotals(slot,initiator);
  const ownKey=side.toLowerCase(),rivalKey=rival.toLowerCase();
  const ownDraws=Math.min(reserveCount??1,battleDestinyDrawCount(side,slot,totals[ownKey+'Ability'],initiator)??0);
  const rivalDraws=Math.min(rivalReserve??1,battleDestinyDrawCount(rival,slot,totals[rivalKey+'Ability'],initiator)??0);
  const weapons=side=>entries.some(entry=>entry.side===side&&entry.slot===slot&&!entry.unavailable&&
   entry.card.type==='Weapon'&&entry.carriers.every(PremiereUnits.active));
  const readyWeapons=weapons(side);
  return {own:ownPresence===true,rival:rivalPresence===true,ownKnown:ownPresence!==null,rivalKnown:rivalPresence!==null,drain,readyWeapons,
   generation:PremiereLocations.icons(state,slot,side)??0,
   margin:totals[ownKey+'Power']-totals[rivalKey+'Power']+3*(ownDraws-rivalDraws)+Number(readyWeapons)-Number(weapons(rival))};
 });
 const sites=positions.map((position,slot)=>position&&{...position,
  ...(style?{controlled:PremiereLocations.control(state,side,slot,cardAbility)===true,
   threatened:positions.some((other,from)=>other?.rival&&from!==slot&&(adjacentSites(from,slot)||
    (isSpaceSystem(state.locations[from])&&isSpaceSystem(state.locations[slot])&&
     entries.some(entry=>entry.side===rival&&entry.slot===from&&!entry.unavailable&&entry.card.type==='Starship'&&
      travelOptions(entry.card,rival,from,slot).length>0))))}:{}),
  routes:state.phase<4&&(board[slot]??[]).some(card=>(cardAbility(card)>0||card.occupants?.length)&&positions.some((target,to)=>
   target?.ownKnown&&target.rivalKnown&&!target.own&&!target.rival&&travelOptions(card,side,slot,to).length>0))
 });
 const view={side,rival,style,phase:state.phase,hand:hand.map(card=>project(card)),sites,battleSite:battleSession?.site,
  life:lifeForceRemaining(side),force:force.length,reserveCount:reserveCount??1,window:window?.kind,drain:window?.amount,
  debt:pending?{damage:pending.remaining,attrition:0}:debt?{damage:debt.damage,attrition:debt.attrition}:null};
 if(hothEnabled()&&state.phase===5&&!sites.some(site=>site?.own))view.needsDeployAccess=
  !hand.some(card=>['Character','Vehicle','Starship'].includes(card.type)&&state.locations.some(loc=>loc&&boardDeployCost(card,loc,side)!==null));
 const actions=offers.map((offer,index)=>{
  const {kind,args,from}=offer;
  const mode=kind==='interruptResponse'?offer.responseKind:args[0];
  const to=kind==='react'?window?.site:kind==='transport'&&['dock','swap'].includes(mode)?from:offer.to;
  const site=offer.siteIndex??offer.site??window?.site??battleSession?.site??to??
   (kind==='battle'?args[0]:Number.isInteger(args[1])?args[1]:undefined);
  const primary=offer.ship??offer.card;
  const unit=visible.has(primary)&&['Character','Vehicle','Starship'].includes(primary?.type)&&state.locations[site]
   ?botUnitStrength(primary,site,offer.pilot,style?side:'Dark'):{power:0,ability:0};
  const factor=style&&offer.mode==='separate'?1:2;
  const shots=kind==='combinedAttack'?(style?offer.plan:null)??offer.pair.map(i=>offer.choices[i]):kind==='computerFire'
   ?[{...offer.shot,draws:offer.shot.draws*factor,cost:offer.shot.cost*factor,computerPenalty:offer.rule.penalty}]
   :['fireWeapon','gaderffii'].includes(kind)?[offer]:[];
  const validShots=shots.filter(shot=>publicEntries.has(shot.target));
  const target=validShots[0]?.target??offer.target??window?.shot?.target;
  const shotBonus=validShots.reduce((sum,shot)=>sum+(shot.bonus??0)+shot.draws*weaponDestinyModifier(side,shot),0);
  const cost=shots.length?shots.reduce((sum,shot)=>sum+shot.cost,0):offer.cost??
   (kind==='duel'?1:kind==='reduceForceLoss'?offer.amount:0);
  const departure=(style?sites[from]?.controlled:sites[from]?.own&&sites[from].rivalKnown&&!sites[from].rival)&&from!==to;
  const leavesControl=departure&&board[from]?.includes(primary)&&
   PremiereLocations.control({...state,[side.toLowerCase()]:board.map((row,slot)=>slot===from?row.filter(card=>card!==primary):row)},side,from,cardAbility)!==true;
  const shown=frame?.shown?.[args[1]];
  const revealed=kind==='finishCardInformation'&&['move','shoot'].includes(mode)&&shown;
  const checked=project(revealed||primary,!!revealed||kind==='takeFromReserve');
  const locationSupport=kind==='convertLocation'?(checked?.icons.own??0)-(sites[site]?.generation??0)-
   (checked?.icons.rival??0)+(sites[site]?.drain??0)-2:
   (kind==='deployLocation'&&hand.some(card=>card.type===(primary.subType==='System'?'Starship':'Character'))?1:0);
  return {index,kind,site,from,to,card:checked,target:project(target),targetSide:publicEntries.get(primary)?.side,
   mode,unitPower:unit.power,unitAbility:unit.ability,bringsPresence:unit.ability>=1||visible.has(primary)&&primary?.presence===true,
   leavesControl,locationSupport,cost,
   carrierGain:plannedCarrierGain(offer,site,unit,sites,side,rival),
   amount:offer.amount??(kind==='activate'?args[0]:0),
   immediateDraw:kind==='activate'?Array.from((args[1]??0).toString(2)).filter(bit=>bit==='1').length:0,
   draws:validShots.reduce((sum,shot)=>sum+shot.draws,0),defense:validShots[0]?.defense??Infinity,bonus:shotBonus,
   effect:validShots.find(shot=>shot.effect==='capture')?.effect??validShots[0]?.effect,
   hit:publicEntries.has(target)&&(battleSession?.hitUnits?.[rival]?.includes(target)||target?.ionDamage&&validShots[0]?.effect==='ion'),
   immune:debt?.immunity?.includes(primary),mandatory:offer.hit||offer.charged,value:offer.value??0,
   collateral:publicEntries.has(primary)?(primary.occupants?.length??0)*2+(primary.weapons?.length??0):0,
   effectValue:plannedEffectValue(offer,sites[site],window,frame,project(target),view)
  };
 });
 return {view,actions};
}

function plannedCarrierGain(offer,slot,unit,sites,side,rival){
 const {kind,card,carrier,args,from,to}=offer;
 if(kind==='moveSeeker')return PremiereLocations.presentCards(state,rival,to).some(target=>
  PremiereWeapons.seekerTarget(card,target,cardAbility(target)))?5:-3;
 if(kind==='equip')return offer.host.weapons?.length?-2:0;
 if(kind==='deployDevice')return offer.host?.attachments?.some(item=>item.id===card.id)?-3:0;
 if(kind==='deploy'&&card.type==='Vehicle'&&!craftStats(card,slot,true).powered){
  const driver=PremiereGame.zones(state,side).hand.find(candidate=>PremiereUnits.roles(card,candidate).includes('driver')&&
   Number.isFinite(candidate.deploy)&&withinDeploymentLimit(candidate,side)&&
   characterLocationAllowed(candidate,state.locations[slot])&&
   offer.cost+crewDeployCost(candidate,side,state.locations[slot])<=forceBudget(side));
  if(!driver)return -2;
  const crewed=craftStats({...card,occupants:[{card:driver,role:'driver'}]},slot,true);
  return crewed.power*0.55+crewed.landspeed*0.65-crewDeployCost(driver,side,state.locations[slot])*0.55;
 }
 if(kind!=='transport'||!carrier)return 0;
 const [mode,,,,,role]=args;
 const occupants=carrier.occupants??[];
 if(mode==='exit'){
  if(occupants[args[3]]?.role==='pilot'&&craftStats(carrier,from,true).powered)return 0;
  return !sites[slot]?.own&&unit.ability>=1?2:0;
 }
 if(!['pilot','driver','astromech'].includes(role)||mode==='swap')return 0;
 const before=craftStats(carrier,slot,true);
 const preview={...carrier,occupants:[...occupants.filter(entry=>entry.card!==card),{card,role}]};
 const after=craftStats(preview,slot,true);
 if(before.powered&&!after.powered)return -4;
 return (!before.powered&&after.powered?2.5:0)+(!before.navComputer&&after.navComputer?1:0)+
  Math.max(0,after.power-before.power)*0.55+Math.max(0,after.ability-before.ability)*0.32;
}

function plannedEffectValue(offer,site,window,frame,target,view){
 const {kind,args,rule,card,amount}=offer,mode=args[0];
 const {side,rival}=view;
 if(hothEnabled()&&(kind==='hothAction'||kind==='interruptResponse'&&['hothAbility','hothInterrupt','hothEffect'].includes(offer.responseKind)))return hothBotValue(offer,view);
 if(kind==='anhCharacter')return expansionBotValue(offer,view);
 if(kind==='pileInterrupt'&&rule?.mode==='controlFire')return 2+(offer.shot.target.power??0)*0.5-offer.shot.cost;
 if(kind==='pileInterrupt'&&['leaderKill','allClearRun'].includes(rule?.mode))return state.attackRun?3:0;
 if(kind==='pileInterrupt'&&rule?.mode==='leaderWeapon')return offer.entry.side===side&&offer.entry.card.weapons?.length?1:0;
 switch(kind){
  case 'interruptResponse': {
   const response=offer.responseKind;
   if(offer.responseKind==='anhResponse')return ['captureBattle','transportRetaliation','evaderRecovery','wookieDisarm','prohibitBattle'].includes(offer.mode)?4:offer.mode==='cancelBattle'&&(site?.margin??0)<0?4:-1;
   if(offer.responseKind==='grabInterrupt')return view.force>=4?1.5:-1;
   if(offer.counterMode==='direct'||['namedCounter','assault','lateralMechanicCounter','battleTieLoss'].includes(response))return 4;
   if(['sense','alter'].includes(response))return offer.ability>=4?2.8:offer.ability>=2?0.8:-1;
   if(response==='battleDamageModifier')return offer.loser===rival&&(offer.amplifies||(site?.margin??0)>2)?4:-2;
   if(response==='battleMoveAway')return ['singleExpel','moveAlong'].includes(rule.mode)||(site?.margin??0)<-3?4:-2;
   if(response==='increaseForceLoss')return amount?2+amount:0.5;
   if(response==='swapBattleDestiny')return battleSession[rival.toLowerCase()+'Destiny']-battleSession[side.toLowerCase()+'Destiny'];
   if(response==='shipTiming')return window.side===rival&&window.shot?.target?2+(target?.power??0)*0.6:-1;
   return ['barrier','openingDestiny','bastEvacuation','shipEvacuation','evazanOperation','tractorBeam',
    'oldBen','kintanStrider','postBattleStarfighter','memorialStack','tacticalRecall','gearMission'].includes(response)?3:-1;
  }
  case 'destinyResponse': return mode==='tarkinCancel'?(window?.draw?.value??0)-0.25:
   3-(window?.draw?.value??3);
  case 'battleEffect': return 1.75*Math.min(offer.draws??2,view.reserveCount);
  case 'pileInterrupt':
   if(rule.mode==='destroyDroid')return offer.entry?.side===rival?3:-3;
   if(rule.mode==='trimHand')return 4;
   if(rule.mode==='revealDuplicates')return 0;
   return ['setStun','tallonRoll','droidAttrition'].includes(rule.mode)&&target?2.5:-1;
  case 'equip': return 0;
  case 'deployLostPileEffect':
   return PremiereGame.lostPileFaceDown(state,offer.target)?-3:offer.target===rival?0:0.4;
  case 'deployLocationEffect':
   return PremiereLocations.effectsAt(state,args[1]).some(effect=>effect.card.id===card.id)?-3:site?.own?0.8:-0.4;
  case 'cancelTableEffect': return offer.effect.target===side?3:-2;
  case 'cancelNamedWeapon': return 2.5;
  case 'cardInformation': return ['macroscan','q2Peek'].includes(offer.mode)?0:1.5;
  case 'unitReserveSearch': return 0.5;
  case 'deviceAction': return mode==='stealDroid'?4:0;
  case 'controlTheft': return 3;
  case 'limitedResources': return 1.5;
  case 'gravelStorm': return 4-(target?.ability??0);
  case 'duel': {
   const power=(duelist,side)=>duelist.power+cardPowerModifier(duelist,side,offer.site)-tacticalPenalty(duelist)+
    (ownLightsaber(duelist)?2:0);
   return power(offer.vader,'Dark')>power(offer.obi,'Light')?6:-3;
  }
  case 'custody': return mode==='imprison'&&controlledLocationRule('Light','releasePrisoners')?-6:0;
  case 'finishCardInformation':
   if(mode==='move'&&['scanning','radar'].includes(frame?.mode))return 1+(frame.shown[args[1]]?.power??0)*0.5;
   if(mode==='shoot'&&frame?.mode==='computerAim')return frame.shots[args[1]].target.power??0;
   if(mode==='take'||mode==='retrieve'||mode==='recover'||mode==='search'||mode==='launch')return 2;
   if(mode==='done'||mode==='cancel'||mode==='confirm')return 1;
   return 0;
  default: return 0;
 }
}

function choosePlannedBotAction(offers,required=false){
 if(!offers.length)return null;
 const {view,actions}=plannedBotPosition(offers);
 const choice=offers[PremiereBot.choose(view,actions,required)];
 return choice?.kind==='combinedAttack'?{...choice,args:[...choice.args,...choice.pair]}:choice;
}

function botPromptAction(offers=legalActions(state,botSide())){
 const expanded=expansionPromptChoice(offers);if(expanded)return expanded;
 return plannedBot()?choosePlannedBotAction(offers,true):offers[0];
}

function strategicMoveScore(option){
 const from=botPosition(option.from),to=botPosition(option.to),unit=botUnitStrength(option.card,option.to);
 const dark=state.dark.slice();
 dark[option.from]=dark[option.from].filter(card=>card!==option.card);
 const leavesControl=from.dark===true&&from.light===false&&
  PremiereLocations.control({...state,dark},'Dark',option.from,cardAbility)!==true;
 const gainControl=to.dark!==true&&to.light===false&&unit.ability+(to.darkAbility??0)>=1;
 const margin=to.darkPower+unit.power-to.lightPower;
 const contest=to.light===true?(margin>=2?2:margin>=0?0:-3):0;
 const retreat=from.light===true&&from.lightPower>from.darkPower+2?2:0;
 return (gainControl?2+2*to.drain:0)+contest+retreat-(leavesControl?2+2*from.drain:0)-option.cost*0.8;
}

function botHandValue(card){
 const {hand}=PremiereGame.zones(state,'Dark');
 if(card.type==='Location'){
  const redundant=state.locations.some(loc=>loc&&locationTitle(loc)===locationTitle(card))||
   hand.some(copy=>copy!==card&&locationTitle(copy)===locationTitle(card));
  return redundant?0:3;
 }
 const uniqueCopy=card.uniquenessLimit&&hand.some(copy=>copy!==card&&copy.id===card.id);
 if(uniqueCopy)return 1;
 if(card.type==='Character')return 3+(cardAbility(card)??0)+(card.power??0)/2;
 if(card.type==='Starship'||card.type==='Vehicle')return 3+(card.power??0);
 return 2;
}

function botForceLossChoice(options){
 const fromHand=options.filter(option=>option.args[0]==='hand')
  .map(option=>({option,value:botHandValue(option.card)})).sort((a,b)=>a.value-b.value)[0];
 const piles=['used','deck','force'];
 const fromLife=piles.map(zone=>options.find(option=>option.args[0]===zone)).find(Boolean);
 if(fromHand&&(fromHand.value<4||lifeForceRemaining('Dark')<=5||!fromLife))return fromHand.option;
 return fromLife;
}

function characterTraits(c){
 const traits=(c.characteristics||[]).map(x=>String(x).toLowerCase());
 if(hothEnabled()&&c.id==='Light:1404'&&!PremiereUnits.textSuppressed(c)) {
  const entry=PremiereLocations.findEntry(state,c);
  if(entry&&!entry.unavailable&&PremiereLocations.presentCards(state,entry.side,PremiereLocations.physicalPlace(entry)).some(unit=>unit!==c&&isDroid(unit)))traits.push('leader');
 }
 return traits;
}

function activeCardRules(card,event){
 if(card?.blownAway||isHoloUnit(card))return [];
 if(PremiereUnits.textSuppressed(card)||battleSession?.excludedUnits?.has(card))return [];
 const version=currentGame()?.cardRulesVersion??latestCardRulesVersion;
 if(version>=21&&isDroid(card)&&prajiSuppresses(card))return [];
 return PremiereCardRules.effects(card,event).filter(rule=>version>=(rule.since??(rule.legacy?0:1)));
}

const isArtoo=card=>isDroid(card)&&/^r2-d2(?:\s|$)/.test(locationTitle(card));

function prajiSuppresses(card){
 if(!state||card.id!=='Light:343'&&!isArtoo(card))return false;
 const entry=PremiereLocations.findEntry(state,card);
 if(!entry||entry.unavailable)return false;
 return PremiereLocations.presentCards(state,'Dark',entry.slot).some(unit=>
  unit.id==='Dark:502'&&PremiereUnits.active(unit)&&!PremiereUnits.textSuppressed(unit));
}

function matchesRegisteredTarget(card,target){
 if(target==='trooper')return card.type==='Character'&&characterTraits(card).some(trait=>/\btrooper\b/.test(trait));
 if(target==='rebel-or-warrior')return card.type==='Character'&&(card.subType==='Rebel'||PremiereUnits.hasSkill(card,'warrior'));
 if(target==='r-unit')return isDroid(card)&&characterTraits(card).includes('r-unit');
 if(target==='droid')return isDroid(card);
 if(target==='atat-cannon')return card.id==='Dark:158';
 const traits=characterTraits(card),alien=card.type==='Character'&&card.subType==='Alien';
 if(target==='alien')return alien;
 if(target==='devastator')return card.type==='Starship'&&locationTitle(card)==='devastator';
 if(target==='tantive')return card.type==='Starship'&&locationTitle(card)==='tantive iv';
 if(target==='alien-except-tusken')return alien&&!traits.includes('tusken raider')&&locationTitle(card)!=='tusken raider';
 if(target==='jawa')return traits.includes('jawa')||locationTitle(card)==='jawa';
 if(target==='tusken')return traits.includes('tusken raider')||locationTitle(card)==='tusken raider';
 if(target==='underworld')return card.type==='Character'&&(['spy','thief','bounty hunter'].some(trait=>traits.includes(trait))||PremiereUnits.hasSkill(card,'smuggler'));
 if(target==='imperial-trooper')return card.type==='Character'&&card.subType==='Imperial'&&traits.includes('trooper');
 if(target==='rebel-trooper-or-y-wing')return traits.includes('rebel trooper')||(card.type==='Starship'&&/\bY-Wing\b/i.test(card.subType??''));
 if(target==='stormtrooper-or-tie')return traits.includes('stormtrooper')||PremiereUnits.tie(card);
 if(target==='star-destroyer')return PremiereUnits.capital(card)&&/star destroyer/i.test(card.subType);
 if(target==='it0')return card.id==='Dark:1340';
 if(target==='sandcrawler')return PremiereUnits.crawler(card);
 if(target==='astromech')return isDroid(card)&&/astromech/i.test((card.extraText??[]).join(' '));
 if(target==='character')return card.type==='Character';
 if(target==='warrior')return card.type==='Character'&&PremiereUnits.hasSkill(card,'warrior');
 if(target==='starship')return card.type==='Starship';
 if(target==='non-creature-vehicle')return card.type==='Vehicle'&&card.subType!=='Creature';
 if(target==='rebel-or-alien')return alien||(card.type==='Character'&&card.subType==='Rebel');
 if(target==='imperial-or-alien')return alien||(card.type==='Character'&&card.subType==='Imperial');
 if(target==='rebel-or-jawa'||target==='imperial-or-jawa'){
  return card.type==='Character'&&(card.subType===(target==='rebel-or-jawa'?'Rebel':'Imperial')||
   traits.includes('jawa')||locationTitle(card)==='jawa');
 }
 return false;
}

function registeredLocationModifier(event,card,side,slot){
 const version=currentGame()?.cardRulesVersion??latestCardRulesVersion;
 return PremiereLocations.rulesAt(state,slot,side,event).filter(rule=>version>=(rule.since??(rule.legacy?0:1))&&matchesRegisteredTarget(card,rule.targets))
  .reduce((sum,rule)=>sum+rule.amount,0);
}

function deviceCharacterModifier(card,loc){
 const region=loc?(isSite(loc)?sitePlanet(loc):isSystem(loc)?locationGroup(loc):null):null;
 const bonuses=new Set((card.attachments??[]).flatMap(device=>activeCardRules(device,'device').map(rule=>rule.bonus)));
 return (bonuses.has('tatooine-belt')&&region==='tatooine'?2:0)+(bonuses.has('stormtrooper-belt')?(region==='death star'?2:1):0);
}

function registeredCharacterModifier(event,card,slot){
 const region=sitePlanet(state.locations[slot]);
 if(!region||card.type!=='Character')return 0;
 const rules=activeCardRules(card,event);
 if(!rules.length)return 0;
 return rules.reduce((total,rule)=>{
  if(rule.outsideRegion)return total+(region!==rule.outsideRegion?rule.amount:0);
  if(rule.companions){
   const companion=PremiereGame.sides.some(side=>PremiereLocations.entries(state,side).some(entry=>
    entry.slot===slot&&!entry.unavailable&&rule.companions.includes(entry.card.id)))||
    PremiereLocations.effectsAt(state,slot).some(effect=>rule.companions.includes(effect.card.id));
   return total+(companion?rule.amount:0);
  }
  if(rule.eachPresent&&PremiereLocations.present(state,card,slot)){
   return total+rule.amount*PremiereGame.sides.flatMap(side=>PremiereLocations.presentCards(state,side,slot))
    .filter(unit=>unit!==card&&matchesRegisteredTarget(unit,rule.eachPresent)).length;
  }
  return total;
 },0);
}

function garindanBenefit(side,slot,event){
 const rule=PremiereLocations.entries(state,side).filter(entry=>entry.slot===slot&&!entry.unavailable)
  .flatMap(({card})=>activeCardRules(card,event))[0];
 if(!rule)return null;
 const hasRebel=PremiereGame.sides.some(actor=>PremiereLocations.entries(state,actor)
  .some(({card,slot:at,unavailable})=>at===slot&&!unavailable&&card.subType==='Rebel'&&cardAbility(card)>2));
 return hasRebel?rule:null;
}

function rebelAuraPower(card,side,slot,same){
 if(card.type!=='Character'||card.subType!=='Rebel')return 0;
 const region=sitePlanet(state.locations[slot]);
 if(!['yavin 4','death star'].includes(region)||!same.includes(card)||(currentGame()?.cardRulesVersion??latestCardRulesVersion)<2)return 0;
 const sources=[...same,...PremiereLocations.presentCards(state,PremiereGame.otherSide(side),slot)];
 return sources.filter(unit=>unit!==card).reduce((total,unit)=>total+
  activeCardRules(unit,'rebelAura').filter(rule=>rule.region===region).reduce((bonus,rule)=>bonus+rule.amount,0),0);
}

const isNonUniqueTusken=card=>matchesRegisteredTarget(card,'tusken')&&!card.uniquenessLimit&&PremiereUnits.active(card);

function tuskenGroupPower(cards){
 const present=cards.filter(isNonUniqueTusken);
 const [rule]=(currentGame()?.cardRulesVersion??latestCardRulesVersion)<7?activeCardRules(present[0],'tuskenPower'):
  present.flatMap(card=>activeCardRules(card,'tuskenPower'));
 return rule&&present.length>=rule.minimum?rule.groupAmount:0;
}

function isDroid(c){return String(c?.type||'').toLowerCase()==='character'&&String(c?.subType||'').toLowerCase()==='droid'}

function isPowerDroid(c){return isDroid(c)&&(c.id==='Dark:816'||(c.extraText||[]).some(tag=>/\bpower droid\b/i.test(String(tag))))}

function tooexNightRule(side,slot,event,present=PremiereLocations.presentCards(state,side,slot)){
 const site=state.locations[slot];
 if(!sitePlanet(site)||!PremiereLocations.conditions(state,slot,side).night)return null;
 return present.flatMap(unit=>activeCardRules(unit,event))[0]??null;
}

function cardPowerModifier(c,side,siteIndex,ownPresent){
 const disarmed=(PremiereWeapons.disarmed(c)?-1:0)+(hothEnabled()&&state?hothCharacterPower(c,side,siteIndex):0);
 if(!state||!['Light','Dark'].includes(side))return disarmed;
 if(isHoloUnit(c))return holoPowerBonus(c);
 const anhPower=(activeCardRules(c,'brainiac').length?brainiacPower():0)+(c.power??0)*(tonnikaFactor(c)-1)+(activeCardRules(c,'anhCharacter').length?(c.id==='Dark:1126'?1+(c.salt??[]).length:c.id==='Dark:605'?1+(state.soupAbility?.[c.id]??0):0):0);
 const demotion=(c.attachments??[]).flatMap(card=>activeCardRules(card,'demotionPower'))[0]?.amount??0;
 const chewie=activeCardRules(c,'chewbacca').length&&PremiereGame.sides.some(actor=>PremiereLocations.entries(state,actor).some(entry=>entry.slot===siteIndex&&!entry.unavailable&&locationTitle(entry.card)==='han solo'))?1:0;
 let bonus=(c.remoteBonus&&c.remoteBonus.turn===state.game?.timing.turn&&c.remoteBonus.stat==='power'?1:0)+chewie+(c.scoutReactTurn!==undefined&&c.scoutReactTurn===state.game?.timing.turn?2:0)+disarmed+anhPower+demotion+deviceCharacterModifier(c,state.locations?.[siteIndex])+registeredLocationModifier('power',c,side,siteIndex)+lukeLarsPower(c)+PremiereUnits.trainingPower(c)+utinniGearBonus(c,siteIndex)-lukeUtinniPenalty(c);
 const [forcePower]=activeCardRules(c,'forceIconPower');
 if(forcePower&&PremiereLocations.present(state,c,siteIndex)){
  bonus+=forcePower.amount*(PremiereLocations.icons(state,siteIndex,'Dark')??0);
 if(PremiereLocations.conditions(state,siteIndex,side).night)bonus+=forcePower.nightAmount;
 }
 if(!state.locations?.[siteIndex]||!isSite(state.locations[siteIndex]))return bonus;
 if(c.type==='Character'&&(PremiereUnits.bountyHunter(c)||PremiereUnits.hasSkill(c,'smuggler')||locationTitle(c)==='greedo')&&
   siteEntries(siteIndex).some(entry=>entry.side===side&&activeCardRules(entry.card,'rodianAura').length))
  bonus+=locationTitle(c)==='greedo'?-1:1;
 const same=ownPresent??PremiereLocations.presentCards(state,side,siteIndex);
 bonus+=registeredCharacterModifier('characterPower',c,siteIndex)+rebelAuraPower(c,side,siteIndex,same);
 const fly=activeCardRules(c,'tzizvvtPower')[0];
 if(fly&&(/trash compactor$/.test(locationTitle(state.locations[siteIndex]))||sitePlanet(state.locations[siteIndex])==='dagobah'||
    PremiereLocations.effectsAt(state,siteIndex).some(effect=>locationTitle(effect.card)==='dark waters')||
    PremiereGame.sides.some(actor=>PremiereLocations.entries(state,actor).some(entry=>entry.slot===siteIndex&&!entry.unavailable&&
     PremiereUnits.active(entry.card)&&locationTitle(entry.card)==='grand moff tarkin'))))bonus+=fly.amount;
 const guard=activeCardRules(c,'detentionPower').length&&PremiereLocations.findEntry(state,c);
 if(guard&&!guard.unavailable){
  const title=locationTitle(state.locations[siteIndex]);
  if(['death star: detention block corridor','death star: detention block control room'].includes(title))bonus+=2;
  const aliens=PremiereLocations.presentCards(state,PremiereGame.otherSide(side),siteIndex).filter(card=>
   card.type==='Character'&&(/^Alien\b/.test(card.subType)||characterTraits(card).includes('alien')));
  if(aliens.length)bonus+=aliens.some(card=>characterTraits(card).some(trait=>['wookiee','talz','ewok'].includes(trait)))?3:2;
 }
 if(PremiereLocations.conditions(state,siteIndex,side).night)bonus+=activeCardRules(c,'nightPower')[0]?.amount??0;
 if(c.attachments?.some(effect=>locationTitle(effect)==="sai'torr kal fas"&&!PremiereUnits.textSuppressed(effect)))
  bonus+=activeCardRules(c,'saurinProtection')[0]?.amount??0;
 if(activeCardRules(c,'hetStormtrooperPower').length&&
    !PremiereGame.sides.some(actor=>PremiereLocations.presentCards(state,actor,siteIndex).some(unit=>
     PremiereUnits.active(unit)&&locationTitle(unit)==='reegesk'))){
  bonus+=siteEntries(siteIndex).filter(entry=>characterTraits(entry.card).includes('stormtrooper')).length;
 }
 const myo=activeCardRules(c,'myoPower')[0],entry=myo&&PremiereLocations.findEntry(state,c);
 if(entry&&!entry.unavailable){
  const place=PremiereLocations.physicalPlace(entry);
  if(PremiereGame.sides.some(actor=>PremiereLocations.presentCards(state,actor,place).some(card=>
   card!==c&&(locationTitle(card)==="lirin car'n"||PremiereUnits.bountyHunter(card)))))bonus+=myo.amount;
 }
 const [tuskenRule]=activeCardRules(c,'tuskenPower');
 if(tuskenRule&&(same.some(card=>card!==c&&isNonUniqueTusken(card))||
    ((currentGame()?.cardRulesVersion??latestCardRulesVersion)>=7&&PremiereLocations.presentCards(state,PremiereGame.otherSide(side),siteIndex)
     .some(isNonUniqueTusken))))bonus+=tuskenRule.amount;
 if(matchesRegisteredTarget(c,'rebel-or-alien')||characterTraits(c).some(x=>/\brebel\b|\balien\b/.test(x))){
  if((currentGame()?.cardRulesVersion??latestCardRulesVersion)>=14)bonus+=tooexNightRule(side,siteIndex,'nighttimeRebelAlien',same)?.amount??0;
  else if(side==='Light'&&PremiereLocations.conditions(state,siteIndex,side).night&&sitePlanet(state.locations[siteIndex])&&
    same.some(x=>x.id==='Light:2'&&!PremiereUnits.textSuppressed(x)&&/nighttime conditions/i.test(x.gametext||'')))bonus+=2;
 }
 // EG-6 gives +1 power to each other allied droid at its site, except power droids.
 if(isDroid(c)&&!isPowerDroid(c))
   bonus+=same.filter(x=>x.id==='Dark:816'&&!PremiereUnits.textSuppressed(x)&&/adds 1 to power of each of your droids/i.test(x.gametext||'')).length;
 if(isExteriorPlanetSite(state.locations[siteIndex])){
  const legacy=(currentGame()?.cardRulesVersion??latestCardRulesVersion)<7;
  if(legacy&&c.id==='Dark:2648')bonus+=(state.dark[siteIndex]||[]).filter(isBantha).length;
  if(!legacy&&matchesRegisteredTarget(c,'tusken')&&PremiereLocations.present(state,c,siteIndex)){
   bonus+=PremiereGame.sides.flatMap(player=>PremiereLocations.presentCards(state,player,siteIndex))
    .reduce((sum,unit)=>sum+(activeCardRules(unit,'tuskenAura')[0]?.amount??0),0);
  }
 }
 return hothEnabled()&&(c.hothDoublePower||c.hothPowerDoubleTurn===state.game?.timing.turn)?bonus*2+(c.power??0):bonus;
}

function cardEffectStatus(c){
 const registered=PremiereCardRules.entry(c);
 if(registered.effects.length)return (registered.complete?'UMGESETZT: ':'TEILWEISE: ')+registered.effects.map(rule=>rule.summary).join(' ');
 if(c.id==='Light:483')return 'UMGESETZT: Kombiniert mindestens zwei bezahlte Schiffswaffen gegen ein Ziel und wertet ihre gemeinsame Destiny in gewählter Reihenfolge aus.';
 if(c.id==='Dark:2517')return 'UMGESETZT: Vader und Obi-Wan duellieren sich am Site. Vergleicht Power samt Lichtschwertbonus und entfernt den Verlierer aus dem Spiel.';
 if(c.id==='Dark:1958')return 'UMGESETZT: Sagt vor dem eigenen Battle den Sieger voraus, erhält bei richtiger Vorhersage eine zufällige verlorene Karte zurück und verliert andernfalls 1 Force. Immun gegen Attrition < 3.';
 if(isLostPileEffect(c))return 'UMGESETZT: Legt den gewählten Lost Pile verdeckt. Verluste aus Life Force bleiben verdeckt, Rückholen bleibt möglich.';
 if(isBantha(c))return 'TEILWEISE: Außen-Site, Ability ½, Landspeed, React, Waffenabwehr und Power +1 für anwesende Tusken Raider. Boarding ist offen.';
 if(c.id==='Light:1593')return 'TEILWEISE: Force-Generierung +1 außerhalb von Tatooine-Sites und gedruckte Attrition-Immunität. Pilotenboni sind offen.';
 if(c.id==='Light:2110')return 'TEILWEISE: Vertauscht Force-Icons und die Seiten der implementierten Ortsregeln. Expand The Empire und Aufheben des Effects sind offen.';
 if(lostRetrieval.has(c.id))return 'TEILWEISE: Benannte Karten aus dem Lost Pile zurückholen oder im Reserve Deck suchen, aufdecken und auf die Hand nehmen. Spielen im gegnerischen Zug bleibt offen.';
 if(['Light:2385','Dark:575'].includes(c.id))return 'TEILWEISE: Antwort auf Force Drain mit Destiny-Vergleich und Force Loss.';
 if(permanentPilotAbility(c)!==null)return 'TEILWEISE: System-Deploy, Power und permanente Piloten-Ability. Hyperspeed mit Nav Computer, soweit vorhanden. Boarding, Landen und Schiffsbewaffnung sind offen.';
 if(['Light:608','Dark:1426','Light:80'].includes(c.id))return 'TEILWEISE: Grundlegende Modifikatoren für Deploy oder Battle Destiny im Weltraum. Weitere Kartentexte sind offen.';
 if(['Light:2448','Dark:2458'].includes(c.id))return 'TEILWEISE: Erhöhte Mindest-Ability für Battle-Destiny berücksichtigt. Weitere Effekte sind offen.';
 if(PremiereWeapons.seeker(c))return 'TEILWEISE: Seeker mit Control-Bewegung und automatischer Zielwahl.';
 if(PremiereWeapons.mine(c))return 'TEILWEISE: Offene Timer Mine mit Zielwahl nach dem Destiny-Draw zum nächsten eigenen Zug.';
 if(PremiereWeapons.definition(c))return 'TEILWEISE: Träger oder Aufstellung, Waffen-Destiny und Kartenfolgen im implementierten Kampfablauf.';
 if(c.id==='Dark:634'&&/When in battle, adds 1 to each of your battle destiny draws/i.test(c.gametext||''))return 'TEILWEISE: Battle-Destiny-Draws Dark +1 durch Vader und gedruckte Attrition-Immunität; Pilot- und weitere Sonderregeln offen.';if(c.id==='Light:2')return 'TEILWEISE: Nacht-Power +2 für verbündete Rebels/Aliens am selben Planetensite; bedingte Attrition-Immunität offen.';if(c.id==='Dark:816')return 'TEILWEISE: EG-6 erhöht Power eigener Droids am selben Site; Spezial-Destiny 0 und bedingte Power-Verdopplung unterstützt.';const below=printedAttritionImmunityBelow(c);if(below!==null)return 'TEILWEISE: Unbedingte gedruckte Attrition-Immunität < '+below+' unterstützt; übrige Karteneffekte offen.';if(!(c.gametext||'').trim())return 'KEIN KARTENTEXT: keine individuellen Text-Effekte zu automatisieren (andere Spielregeln gelten weiterhin).';return 'OFFEN: Kartentext noch nicht als ausführbare Regel validiert.'}

function effectCoverage(){
 const results=catalog.map(card=>({card,status:cardEffectStatus(card)}));
 const cardsWith=prefix=>results.filter(entry=>entry.status.startsWith(prefix)).map(entry=>entry.card);
 return {total:results.length,withoutText:cardsWith('KEIN KARTENTEXT'),complete:cardsWith('UMGESETZT'),partial:cardsWith('TEILWEISE'),unimplemented:cardsWith('OFFEN')};
}

function cardEffectFlags(c){const s=c.gametext||'';return [{name:'Force',re:/force generation|force drain|force icons?|activate.*force|generates? .*force/i},{name:'Deploy',re:/deploy|deployment/i},{name:'Destiny',re:/destiny|attrition/i},{name:'Power',re:/power [+-]|power is|power \+/i},{name:'Movement',re:/move|movement|landspeed|hyperspeed|transport/i},{name:'Immunity',re:/immun/i}].filter(x=>x.re.test(s)).map(x=>x.name)}

function isSpyCharacter(c){
 if(!isDeployableCharacter(c))return false;
 return (c.characteristics||[]).some(t=>/\bspy\b/i.test(String(t)))||/\bspy\b/i.test(String(c.lore||c.rawFront?.lore||''))||wearingUtinniGear(c,'plastoid-armor');
}

function undercoverSpies(side,slot){
 return PremiereLocations.entries(state,side).filter(entry=>entry.slot===slot&&!entry.unavailable&&
   entry.card.type==='Character'&&entry.card.undercover&&PremiereLocations.presentAt(entry,slot));
}

function setUndercover(card,side){
 card.undercover=true;
 card.tableSide=PremiereGame.otherSide(side);
 log(card.name+' geht auf der '+card.tableSide+' Side undercover.');
}

function enterUndercover({side,slot,card,carriers}){
 if(carriers.length&&detachTableCard(side,slot,card))PremiereGame.zones(state,side).board[slot].push(card);
 if(card.escortedCaptive){
  (state.pendingCustody??=[]).push({side:'Light',card:card.escortedCaptive,slot});
  delete card.escortedCaptive;
 }
 setUndercover(card,side);
}

function breakSpyCover(card){
 const entry=PremiereLocations.findEntry(state,card);
 if(!entry||!card.undercover)return false;
 const {side,slot}=entry;
 delete card.undercover;
 delete card.tableSide;
 const coverEffects=(card.attachments??[]).filter(effect=>activeCardRules(effect,'undercoverEffect').length);
 for(const effect of coverEffects){
  const placed=state.tableEffects?.find(record=>record.card===effect);
  if(placed)cancelTableEffect(placed);
  else if(detachTableCard(side,slot,effect))loseOwnedCard(effect,side,'table',slot);
 }
 log(card.name+' wird als Undercover-Spion enttarnt.');
 if(side!=='Light'&&activeCardRules(card,'stealOnBrokenCover').length&&withinDeploymentLimit(card,'Light'))
  state.pendingCardView={mode:'u3poCover',side:'Light',card,shown:[],publicView:true};
 return true;
}

function changeCharacterAllegiance(entry,side){
 const {card,slot}=entry;
 if(!detachTableCard(entry.side,slot,card))return false;
 if(card.escortedCaptive){
  (state.pendingCustody??=[]).push({side:'Light',card:card.escortedCaptive,slot});
  delete card.escortedCaptive;
 }
 function assign(unit){
  unit.owner=side;
  unit.controller=side;
  for(const attachment of [...(unit.weapons??[]),...(unit.attachments??[])])assign(attachment);
 }
 assign(card);
 if(card.undercover)card.tableSide=PremiereGame.otherSide(side);
 for(const effect of state.tableEffects??[])if(effect.host===card)effect.target=side;
 PremiereGame.zones(state,side).board[slot].push(card);
 log(card.name+' wechselt zur '+side+' Side.');
 return true;
}

function undercoverMoves(side){
 if(!state?.game||state.phase!==4||state.activeSide===side||state.spyMovementPassedTurn===state.game.timing.turn)return [];
 const {board}=PremiereGame.zones(state,side);
 return (board??[]).flatMap((row,site)=>row.flatMap((card,index)=>{
  if(!card.undercover||card.inactive||card.captured||card.missing||regularMovementUsed(card)||movementPrevented(card))return [];
  const origin=state.locations[site];
  return state.locations.flatMap((target,to)=>{
    if(to===site||!target||!origin)return [];
   const moves=[];
    if(isSite(target)&&isSite(origin)){
     const speed=!PremiereUnits.textSuppressed(card)&&['Dark:1709','Light:1407'].includes(card.id)?3:1;
     if(!activeCardRules(card,'deployPhaseLandspeed').length&&groundReach(card,site,to,speed))moves.push({movement:'Landspeed',cost:1});
     const bay=PremiereLocations.conditions(state,site,side);
     if(bay.dockingBay&&PremiereLocations.conditions(state,to,side).dockingBay&&Number.isFinite(bay.transitCost))
      moves.push({movement:'Docking-Bay-Transit',cost:bay.transitCost});
    }
   const related=target.hostInstanceId?{host:target,external:site}:origin.hostInstanceId?{host:origin,external:to}:null;
   if(related&&PremiereGame.sides.some(actor=>PremiereLocations.entries(state,actor).some(entry=>
    entry.slot===related.external&&!entry.unavailable&&entry.card.instanceId===related.host.hostInstanceId))){
    const rule=PremiereLocations.ruleAt(state,target===related.host?to:site,side,'vehicleSiteTransit');
    if(rule)moves.push({movement:'Innen-Site',cost:rule.cost});
   }
   return moves.filter(move=>move.cost<=forceBudget(side)).map(move=>({...move,card,site,to,
    args:['move',site,index,to,move.movement],label:card.name+' undercover nach '+target.name+' ('+move.cost+' Force)'}));
  });
 }));
}

function spyActions(side){
 const moves=undercoverMoves(side);
 if(!state?.game||state.activeSide!==side)return moves;
 return PremiereLocations.entries(state,side).flatMap((entry,index)=>{
  const {card,slot:site,unavailable}=entry;
  if(unavailable||!isSite(state.locations[site]))return [];
  if(state.phase===2&&card.undercover)return [{args:['break',index],card,site,cost:0,label:card.name+' · Tarnung aufgeben'}];
  const key='detectSpy:'+(card.instanceId??card.id);
  if(state.phase!==1||!activeCardRules(card,'detectSpy').length||PremiereGame.wasUsed(state.game,'phase',key))return [];
  return PremiereGame.sides.flatMap(actor=>undercoverSpies(actor,site)).map(({card:target},targetIndex)=>({
   args:['detect',index,targetIndex],key,card,target,site,cost:0,label:card.name+' · '+target.name+' mit Destiny prüfen',
  }));
 });
}

function performSpyAction(side,...args){
 const option=spyActions(side).find(action=>action.args.length===args.length&&action.args.every((arg,i)=>arg===args[i]));
 if(!option)return false;
 const {card,site,to,target,key,cost}=option;
 if(args[0]==='break')return breakSpyCover(card);
 if(args[0]==='move'){
  if(!detachTableCard(side,site,card))return false;
  spendForce(side,cost);
  PremiereGame.zones(state,side).board[to].push(card);
  (state.movedThisTurn??=[]).push(card);
  clearJuriAfterMove(card,side,to);
  if(option.movement==='Landspeed')noteMineTraversal(side,site,to,card);
  log(option.label+'.');
 }else{
  PremiereGame.useOnce(state.game,'phase',key);
  drawDestinySeries(side,'detectSpy',1,0,draws=>{
   const value=draws.find(draw=>!draw.cancelled)?.value;
   if(Number.isFinite(value)&&value===cardAbility(target))breakSpyCover(target);
  });
 }
 return true;
}

function canPayBoardDeploy(c,side,cost){
 const pile=side==='Light'?state.force:state.botForce;
 return !!pile&&forceBudget(side)>=cost&&withinDeploymentLimit(c,side);
}

function hasDeployPresence(side,loc){
 const index=state.locations.indexOf(loc);
 const ownIcons=index>=0?PremiereLocations.icons(state,index,side):loc.icons?.[side.toLowerCase()];
 if(index>=0&&PremiereLocations.ruleAt(state,index,side,'deployWithoutIcons'))return true;
 return (Number.isFinite(ownIcons)&&ownIcons>=1)||(index>=0&&(confirmedPresence(side,index)===true||
  (currentGame()?.cardRulesVersion??latestCardRulesVersion)>=28&&undercoverSpies(side,index).length>0));
}

function characterDeployCost(card,site,side){
 if(!isSite(site)||(!hasDeployPresence(side,site)&&!isSpyCharacter(card)))return null;
 if(!characterLocationAllowed(card,site))return null;
 const slot=state.locations.indexOf(site);
 const deployRule=PremiereLocations.ruleAt(state,slot,side,'characterDeploy');
 const discount=deployRule?.names.includes(locationTitle(card))?deployRule.amount:0;
 const legacy=(currentGame()?.cardRulesVersion??latestCardRulesVersion)<9;
 const droidTax=legacy&&isDroid(card)?PremiereLocations.presentCards(state,PremiereGame.otherSide(side),slot)
  .filter(unit=>unit.id==='Dark:12'&&!PremiereUnits.textSuppressed(unit)).length:0;
 return Math.max(0,crewDeployCost(card,side,site)-discount+droidTax);
}

function characterLocationAllowed(card,loc){
 const region=sitePlanet(loc);
 if(isDroid(card)&&PremiereLocations.effectsAt(state,state.locations.indexOf(loc)).some(effect=>effect.siteDevice==='droid-detector'))return false;
 if(activeCardRules(card,'deployUndercover').length)return isSite(loc);
 if(card.id==='Dark:2648'||activeCardRules(card,'tuskenFallbackDestiny').length)return region==='tatooine';
 if(card.id==='Dark:668')return region==='death star';
 if(card.id==='Dark:1709'){
  const slot=state.locations.indexOf(loc);
  if(activeCardRules(card,'mouseUtinni').length)return isSite(loc)&&mouseEligibleEffects().some(({effect})=>
   effect.target.type==='Character'&&PremiereLocations.present(state,effect.target,slot));
  const targets=PremiereGame.sides.flatMap(side=>PremiereLocations.cardsOnTable(state,side))
   .filter(unit=>unit.type==='Character'&&PremiereLocations.at(state,unit,slot));
  return isSite(loc)&&Object.values(state.locationEffects??{}).flat().some(effect=>
   effect.card.subType==='Utinni'&&effect.card.id!=='Light:1429'&&effect.targetInstanceId&&targets.some(unit=>unit.instanceId===effect.targetInstanceId));
 }
 return true;
}

function crewDeployCost(card,side,loc){
 const cost=baseCrewDeployCost(card,side,loc);
 if(hothEnabled()&&hothFreeDeploy(card,side))return 0;
 return Math.max(0,cost+(hothEnabled()&&loc?hothDeployModifier(card,side,state.locations.indexOf(loc)):0));
}
function baseCrewDeployCost(card,side,loc){
 const expanded=(currentGame()?.cardRulesVersion??latestCardRulesVersion)>=9;
 const droidTax=expanded&&loc&&isDroid(card)?PremiereGame.sides.filter(actor=>actor!==side||card.id==='Dark:1709')
  .flatMap(actor=>PremiereLocations.entries(state,actor))
  .filter(({slot,unavailable})=>!unavailable&&state.locations[slot]===loc)
  .reduce((tax,{card:unit})=>tax+(activeCardRules(unit,'droidDeployTax')[0]?.amount??0),0):0;
 let garindan=0;
 if(loc&&characterTraits(card).includes('bothan')&&isSpyCharacter(card)&&PremiereLocations.entries(state,side).some(entry=>
   !entry.unavailable&&state.locations[entry.slot]===loc&&activeCardRules(entry.card,'bothanDeploy').length))return droidTax;
 if(loc&&isSite(loc)){
  const slot=state.locations.indexOf(loc);
  if(isSpyCharacter(card)&&PremiereLocations.nightEffectsAt(state,slot).length)return droidTax;
  if(activeCardRules(card,'freeSiteDeploy').some(rule=>rule.targets==='moisture-farm'?
    locationTitle(loc)==="tatooine: lars' moisture farm":PremiereLocations.entries(state,side).some(entry=>entry.slot===slot&&
    !entry.unavailable&&entry.card.type==='Character'&&entry.card.subType===rule.targets&&cardAbility(entry.card)>2)))return droidTax;
  if(card.subType==='Imperial')garindan=garindanBenefit(side,slot,'imperialDiscount')?.amount??0;
 }
 const imperials=card.id==='Dark:60'?PremiereLocations.activeCards(state,side).filter(unit=>
  unit.type==='Starship'&&unit.side==='Dark'&&!unit.characteristics?.includes('independent')).length:0;
 const sentry=loc?sentryModifier(side,state.locations.indexOf(loc),'deploy'):0;
 const kashyyyk=loc&&card.type==='Character'&&(characterTraits(card).includes('wookiee')||PremiereUnits.hasSkill(card,'smuggler'))?
  PremiereLocations.ruleAt(state,state.locations.indexOf(loc),side,'kashyyykDeploy')?.amount??0:0;
 const printed=activeCardRules(card,'brainiac').length?state.hand.length:card.deploy*tonnikaFactor(card);
 return Math.max(0,printed-(imperials>=2?2:0)+warriorDeployIncrease(card,side)-garindan+sentry-kashyyyk)+droidTax+musicianCoverCharge(loc);
}

function warriorDeployIncrease(card,side){
 if(card.type!=='Character'||!PremiereUnits.hasSkill(card,'warrior'))return 0;
 return Math.max(0,...(state.tableEffects??[]).filter(effect=>effect.target===side)
  .map(effect=>tableEffectRule(effect.card)?.warriorDeploy??0));
}

function craftDeployCost(card,loc,side,pilot=null){
 if(hothEnabled()&&!hothDeploymentAllowed(card,loc,side))return null;
 const cost=baseCraftDeployCost(card,loc,side,pilot);
 if(cost!==null&&hothEnabled()&&hothFreeDeploy(card,side))return pilot?crewDeployCost(pilot,side,loc):0;
 return cost===null?null:Math.max(0,cost+(hothEnabled()?hothDeployModifier(card,side,state.locations.indexOf(loc)):0));
}
function baseCraftDeployCost(card,loc,side,pilot=null){
 if(!Number.isInteger(card.deploy)||card.deploy<0)return null;
 const sentry=sentryModifier(side,state.locations.indexOf(loc),'deploy');
 if(isBantha(card))return isExteriorPlanetSite(loc)?card.deploy+sentry:null;
 if(card.type==='Vehicle'){
  if(PremiereUnits.tube(card))return isSite(loc)&&loc.locationTags?.includes('Interior')&&loc.locationTags.includes('Mobile')?card.deploy+sentry:null;
  if(PremiereUnits.crawler(card)&&sitePlanet(loc)!=='tatooine')return null;
  return isExteriorPlanetSite(loc)?card.deploy+sentry:null;
 }
 if(card.type!=='Starship')return null;
 const slot=state.locations.indexOf(loc);
 const bay=(PremiereUnits.fighter(card)||hothEnabled()&&card.id==='Light:1665'||typeof dagobahEnabled==='function'&&dagobahEnabled()&&card.id==='Dark:1185'||typeof cloudCityEnabled==='function'&&cloudCityEnabled()&&card.id==='Light:332')&&PremiereLocations.conditions(state,slot,side).dockingBay;
 if(!bay&&(!isSpaceSystem(loc)||(permanentPilotAbility(card)===null&&!pilot)))return null;
 if(pilot&&!PremiereUnits.accepts(card,pilot,'pilot'))return null;
 const deployRule=PremiereLocations.ruleAt(state,slot,side,'shipDeploy');
 let discount=(PremiereUnits.capital(card)?deployRule?.capitalDiscount:deployRule?.fighterDiscount)??0;
 if(deployRule?.tarkinDiscount){
  const board=PremiereGame.zones(state,side).board?.[slot]??[];
  const tarkinAboard=board.some(ship=>ship.type==='Starship'&&ship.occupants?.some(({card})=>locationTitle(card)==='grand moff tarkin'));
  if(tarkinAboard)discount=deployRule.tarkinDiscount;
 }
 if(card.id==='Dark:2600'){
  const legacy=(currentGame()?.cardRulesVersion??latestCardRulesVersion)<7;
  const source=c=>PremiereUnits.capital(c)&&/\bImperial\b/i.test(c.subType);
  if(legacy?state.dark[slot]?.some(source):
     isSystem(loc)&&PremiereGame.sides.some(player=>PremiereLocations.presentCards(state,player,slot).some(c=>PremiereUnits.active(c)&&source(c))))discount++;
 }
 const tax=(state.tableEffects??[]).reduce((sum,effect)=>{
  if(effect.target!==side)return sum;
  const [rule]=activeCardRules(effect.card,'shipDeployTax');
  return sum+(rule&&(rule.target==='tie'?PremiereUnits.tie(card):card.navComputer===true)?rule.amount:0);
 },0);
 return Math.max(0,card.deploy-discount+sentry+tax)+(pilot?crewDeployCost(pilot,side,loc):0);
}

const jawaCosts=new Map([['Light:1373',1],['Light:1136',2],['Dark:1372',1],['Dark:643',2]]);
function jawaDeployPayment(card,loc,side){
 if(!isSite(loc)||sitePlanet(loc)!=='tatooine'||!hasDeployPresence(side,loc))return null;
 const slot=state.locations.indexOf(loc),deployRule=PremiereLocations.ruleAt(state,slot,side,'jawaDeploy');
 if(deployRule&&!activeCardRules(card,'jawaPayment').length){
  const sandcrawler=deployRule.freeWithCrawler&&PremiereGame.sides.some(player=>
   PremiereLocations.presentCards(state,player,slot).some(unit=>/Sandcrawler/i.test(unit.name??'')));
  return {own:sandcrawler?0:1,opposing:0};
 }
 const version=currentGame()?.cardRulesVersion??latestCardRulesVersion;
 const base=jawaCosts.get(card.id);
 const cost=base+sentryModifier(side,slot,'deploy')+(version>=9?warriorDeployIncrease(card,side):0);
 return {own:cost,opposing:version>=23?base:cost};
}

function canPayJawaDeploy(side,payment,free=false){
 if(!payment)return false;
 const opponentsForce=ownForceBudget(PremiereGame.otherSide(side));
 if(payment.opposing>opponentsForce)return false;
 if(free)return true;
 return payment.own<=jawaForceBudget(side,payment.opposing);
}

function jawaForceBudget(side,opposing){
 const version=currentGame()?.cardRulesVersion??latestCardRulesVersion;
 if(version<23)return forceBudget(side);
 const available=ownForceBudget(side);
 const opponentsForce=ownForceBudget(PremiereGame.otherSide(side));
 const loan=version>=24?Math.min(beggarCredit(side),Math.max(0,opponentsForce-opposing)):0;
 return available+loan;
}

function spendJawaDeployForce(side,amount,opposing=0){
 const version=currentGame()?.cardRulesVersion??latestCardRulesVersion;
 if(version!==23)return spendForce(side,amount,version>=24?opposing:0);
 const {force,used}=PremiereGame.zones(state,side);
 return PremiereGame.moveTop(force,used,amount);
}

function payOpposingJawaCost(side,cost){
 const rival=PremiereGame.otherSide(side),piles=PremiereGame.zones(state,rival);
 PremiereGame.moveTop(piles.force,piles.used,cost);
 log(rival+' bezahlt '+cost+' Force für den Jawa-Deploy.');
}

function boardDeployCost(card,loc,side,free=false){
 if(!state||!card||!loc||loc.id==='Light:681')return null;
 if(hothEnabled()&&!hothDeploymentAllowed(card,loc,side))return null;
 if(hothEnabled()&&hothFreeDeploy(card,side))free=true;
 if(card.type==='Creature'){const cost=Math.max(0,(card.deploy??0)+(hothEnabled()?hothDeployModifier(card,side,state.locations.indexOf(loc)):0));return (card.owner??card.side)===side&&creatureHabitat(card,state.locations.indexOf(loc))&&withinDeploymentLimit(card,side)&&(free||cost<=forceBudget(side))?free?0:cost:null;}
 if(isHoloSite(loc)){const value=printedBattleDestiny(card);return (card.owner??card.side)===side&&holoEligible(card)&&withinDeploymentLimit(card,side)&&(free||value<=forceBudget(side))?free?0:value:null;}
 const owner=card.owner??card.side;
 if(owner&&owner!==side)return null;
 if(jawaCosts.has(card.id)){
  const payment=jawaDeployPayment(card,loc,side);
  return withinDeploymentLimit(card,side)&&canPayJawaDeploy(side,payment,free)?(free?0:payment.own):null;
 }
 const cost=isDeployableCharacter(card)?characterDeployCost(card,loc,side):
  (hasDeployPresence(side,loc)||activeCardRules(card,'shipDeployWithoutPresence').length)?craftDeployCost(card,loc,side):null;
 return cost!==null&&canPayBoardDeploy(card,side,free?0:cost)?(free?0:cost):null;
}

function weaponMounts(side,includeUndercover=false){
 const {board}=PremiereGame.zones(state,side);
 const entries=PremiereLocations.entries(state,side);
 return state.locations.flatMap((location,slot)=>{
  if(!location)return [];
  const roots=board?.[slot]??[],local=entries.filter(entry=>entry.slot===slot);
  const mounts=local.flatMap((entry,index)=>{
   const card=entry.card;
   if(entry.unavailable||(!PremiereUnits.active(card)&&!PremiereWeapons.projector(card)&&!(includeUndercover&&card.undercover))||
      !['Character','Vehicle','Starship'].includes(card.type)&&!PremiereWeapons.projector(card))return [];
   const root=roots.indexOf(card);
   return [{host:card,slot,index:root>=0?root:roots.length+index,place:PremiereLocations.physicalPlace(entry)}];
  });
  if(isSystem(location)&&location.locationTags?.includes('Mobile')||location.id==='Light:681')mounts.push({host:location,slot,index:-1,place:slot});
  return mounts;
 });
}

function mountWeapons(mount){
 if(isLoc(mount.host))return state.locationWeapons?.[mount.slot]??[];
 if(PremiereWeapons.projector(mount.host))return [mount.host];
 return mount.host.weapons??[];
}
function attachWeapon(mount,weapon){
 if(isLoc(mount.host))((state.locationWeapons??={})[mount.slot]??=[]).push(weapon);
 else (mount.host.weapons??=[]).push(weapon);
}

function weaponDeployOptions(side,handIndex){
 if(!state||state.phase!==2||state.activeSide!==side||state.gameWinner||state.pendingForceLoss||battleSession)return [];
 const {hand}=PremiereGame.zones(state,side);
 return weaponPlacementOptions(side,hand?.[handIndex]);
}

function weaponPlacementOptions(side,card,slot,free=false){

 if(!PremiereWeapons.definition(card)||deploymentSide(card)!==side||!withinDeploymentLimit(card,side))return [];
 return weaponMounts(side,true).flatMap(mount=>{
  if(slot!==undefined&&mount.slot!==slot||state.locations[mount.slot]?.id==='Light:681'&&card.id!=='Dark:2644')return [];
  const base=card.id==='Dark:2378'&&spaceParsec(mount.host)!==0?null:weaponDeployCost(card,mount.host);
  if(base===null)return [];
  const effectiveFree=free||hothEnabled()&&hothFreeDeploy(card,side);
  const {cost,discount}=equipmentPrice(side,mount,effectiveFree?0:Math.max(0,base+sentryModifier(side,mount.slot,'deploy')+(hothEnabled()?hothDeployModifier(card,side,mount.slot):0)));
  if(cost===null||!free&&cost>forceBudget(side))return [];
  return [{mount,siteIndex:mount.slot,hostIndex:mount.index,host:mount.host,cost,discount}];
 });
}

function equipmentPrice(side,{host,slot},cost){
 if(!cost||!state.game||host.type!=='Character'||host.subType!=='Rebel'||!isSite(state.locations[slot]))return {cost};
 const supplier=PremiereLocations.entries(state,side).find(entry=>{
  const key='corellian:'+(entry.card.instanceId??entry.card.id);
  return entry.slot===slot&&!entry.unavailable&&activeCardRules(entry.card,'corellianEquipment').length&&
   !PremiereGame.wasUsed(state.game,'turn',key);
 });
 return supplier?{cost:cost-1,discount:'corellian:'+(supplier.card.instanceId??supplier.card.id)}:{cost};
}

function weaponDeployCost(weapon,host){
 const cost=PremiereWeapons.deployCost(weapon,host,cardAbility(host),weaponBearerPower(weapon,host));
 if(cost!==null&&hothEnabled()&&hothFreeDeploy(weapon,weapon.controller??weapon.owner??weapon.side))return 0;
 if(cost===null||weapon.subType!=='Starship'||host.type!=='Starship')return cost;
 const discount=(host.occupants??[]).some(({card,role})=>
  role==='pilot'&&PremiereUnits.active(card)&&activeCardRules(card,'shipWeaponDiscount').length);
 return discount?Math.max(0,cost-1):cost;
}

function weaponBearerPower(weapon,host){
 if(weapon.id!=='Light:318'||!Number.isFinite(host.power))return host.power;
 const entry=PremiereLocations.findEntry(state,host);
 if(!entry)return host.power;
 const {side,slot}=entry;
 return Math.max(0,host.power+cardPowerModifier(host,side,slot)-tacticalPenalty(host));
}

function weaponShot(weapon,host,target,defense){
 if(hothEnabled()&&weapon.id==='Light:1929') {
  const slot=PremiereLocations.findEntry(state,host)?.slot;
  return PremiereWeapons.shot(weapon,{...host,maneuver:craftStats(host,slot).maneuver},target,cardAbility(host),defense);
 }
 if(laserGateRecord(target)){if(weapon.subType!=='Character')return null;const shot=PremiereWeapons.shot(weapon,host,{...target,type:'Character'},cardAbility(host),3);return shot?{...shot,target,defense:3,effect:'destroy'}:null;}
 if(PremiereWeapons.definition(weapon)?.effect==='ion'&&fireExtinguisherProtects(target))return null;
 return PremiereWeapons.shot(weapon,host,target,cardAbility(host),defense,weaponBearerPower(weapon,host));
}

function deployWeaponFor(side,handIndex,siteIndex,hostIndex){
 const option=weaponDeployOptions(side,handIndex).find(x=>x.siteIndex===siteIndex&&x.hostIndex===hostIndex);
 if(!option)return false;
 const {hand}=PremiereGame.zones(state,side),[weapon]=hand.splice(handIndex,1);
 spendForce(side,option.cost);
 if(option.discount)PremiereGame.useOnce(state.game,'turn',option.discount);
 if((currentGame()?.cardRulesVersion??latestCardRulesVersion)>=22)delete weapon.kabeHeld;
 attachWeapon(option.mount,weapon);
 if(hothEnabled())openDeploymentReaction(side,[weapon]);
 log(side+' rüstet '+option.host.name+' mit '+weapon.name+' aus ('+option.cost+' Force → Used Pile).');
 return true;
}

function allWeaponEntries(){
 return PremiereGame.sides.flatMap(side=>PremiereLocations.entries(state,side).map(entry=>({...entry,side})));
}

function weaponRecords(){
 const entries=allWeaponEntries();
 const records=entries.filter(entry=>!entry.unavailable&&entry.card.type==='Weapon').map(entry=>({...entry,
  host:entries.find(other=>other.card.weapons?.includes(entry.card))?.card}));
 const fixed=Object.entries(state.locationWeapons??{}).flatMap(([slot,cards])=>cards.map(card=>
  ({card,slot:Number(slot),side:card.side,host:state.locations[slot],carriers:[]})));
 return records.concat(fixed);
}

function blasterRacks(){
 return (state.tableEffects??[]).filter(effect=>effect.weapons&&activeCardRules(effect.card,'rackRelease').length);
}

function weaponEffectOptions(side){
 const {hand}=PremiereGame.zones(state,side),active=state.activeSide===side;
 const phase=state.phase,options=[],mounts=weaponMounts(side),entries=allWeaponEntries(),weapons=weaponRecords();
 const add=(args,label,details={})=>options.push({args,label,...details});
 const rack=state.blasterRack;
 const useTableRacks=(currentGame()?.cardRulesVersion??latestCardRulesVersion)>=18;
 const racks=useTableRacks&&side==='Dark'?blasterRacks():[];
 const bolts=entries.filter(entry=>!entry.unavailable&&activeCardRules(entry.card,'restrainDroid').length);
 if(bolts.length)for(const [actorIndex,source] of PremiereLocations.entries(state,side).entries()){
  const [rule]=activeCardRules(source.card,'saurinUnbolt');
  if(!rule||source.unavailable||rule.cost>forceBudget(side)||!isSite(state.locations[source.slot]))continue;
  for(const [targetIndex,entry] of bolts.entries())if(entry.slot===source.slot)
   add(['saurinUnbolt',actorIndex,targetIndex],source.card.name+' · '+entry.card.name+' entfernen (1 Force)',{entry,cost:rule.cost});
 }
 if(active&&phase===2){
  for(const [index,card] of (hand??[]).entries())if(activeCardRules(card,'blasterScope').length){
   weapons.forEach((entry,i)=>{
    if(entry.side!==side||(entry.card.owner??entry.card.side)!==side||entry.card.attachments?.some(item=>activeCardRules(item,'blasterScope').length)||
       !/\bblaster\b|4-lom's concussion rifle/i.test(entry.card.name))return;
    const cost=sentryModifier(side,entry.slot,'deploy');
    if(cost<=forceBudget(side))add(['scope',index,i],card.name+' auf '+entry.card.name,{entry,card,cost});
   });
  }
  const targetMounts=mounts.filter(mount=>!isLoc(mount.host)&&!PremiereWeapons.projector(mount.host));
  mounts.forEach((source,a)=>mountWeapons(source).forEach((weapon,w)=>{
   if(PremiereWeapons.projector(weapon)||(weapon.owner??weapon.side)!==side)return;
   targetMounts.forEach(target=>{
    if((activeCardRules(target.host,'ra7Transfer').length&&(target.host.weapons??[]).length>=4)||source.host===target.host||source.slot!==target.slot||source.place!==target.place)return;
    const normalCost=activeCardRules(target.host,'ra7Transfer').length&&weapon.subType==='Character'?0:weaponDeployCost(weapon,target.host);
    const ra7=[source.host,target.host].some(host=>activeCardRules(host,'ra7Transfer').length);
    const cost=ra7?0:weapon.kabeHeld&&activeCardRules(source.host,'controlTheft').some(rule=>rule.mode==='kabe')&&target.host.warrior?0:normalCost;
    if(cost!==null&&cost<=(forceBudget(side)))add(['transfer',a,w,target.slot,target.index],weapon.name+' → '+target.host.name+' ('+cost+' Force)',{source,weapon,target,cost});
   });
  }));
  if(side==='Dark'&&!rack&&!useTableRacks){
   const index=hand?.findIndex(card=>card.id==='Dark:262')??-1;
   if(index>=0)add(['rack',index],'Blaster Rack ausspielen',{index});
  }
  if(side==='Dark'&&rack)rack.weapons.forEach((weapon,index)=>targetMounts.forEach(target=>{
   const cost=weaponDeployCost(weapon,target.host);
   if(cost!==null&&cost<=(forceBudget(side)))add(['rackOut',index,target.slot,target.index],weapon.name+' vom Rack → '+target.host.name+' ('+cost+' Force)',{weapon,target,cost});
  }));
  racks.forEach((storage,rackIndex)=>storage.weapons.forEach((weapon,index)=>targetMounts.forEach(target=>{
   if(target.host.type!=='Character')return;
   const cost=weaponDeployCost(weapon,target.host);
   if(cost!==null&&cost<=(forceBudget(side)))add(['rackOut',index,target.slot,target.index,rackIndex],
    weapon.name+' vom Rack → '+target.host.name+' ('+cost+' Force)',{weapon,target,cost,rack:storage});
  })));
  const tanks=hand?.findIndex(card=>card.id===(side==='Light'?'Light:997':'Dark:996'))??-1;
  if(tanks>=0)targetMounts.forEach(target=>{
   const system=state.locations[target.slot];
   if(target.host.type==='Starship'&&isSystem(system)&&!target.host.attachments?.some(card=>['Light:997','Dark:996'].includes(card.id))&&
      state.locations.some((loc,slot)=>loc&&sitePlanet(loc)===locationGroup(system)&&PremiereLocations.conditions(state,slot,side).dockingBay)){
    add(['tanks',tanks,target.slot,target.index],'Fusion Generator Supply Tanks → '+target.host.name,{index:tanks,target});
   }
  });
 }
 if(active&&side==='Dark'&&rack)weapons.forEach((entry,index)=>{
  if(entry.side===side&&entry.card.side===side&&entry.card.subType==='Character'&&entry.host&&isSite(state.locations[entry.slot]))
   add(['rackIn',index],entry.card.name+' ins Blaster Rack legen',{entry});
 });
 racks.forEach((storage,rackIndex)=>weapons.forEach((entry,index)=>{
  if((entry.card.owner??entry.card.side)!==side||entry.card.subType!=='Character'||!entry.host||!isSite(state.locations[entry.slot]))return;
  add(['rackIn',index,rackIndex],entry.card.name+' ins Blaster Rack legen',{entry,rack:storage});
 }));
 if(phase===1){
  const index=hand?.findIndex(card=>card.id===(side==='Light'?'Light:735':'Dark:734'))??-1;
  if(index>=0){
   const own=mounts.filter(mount=>mount.host.type==='Character'&&mount.host.weapons?.length&&mount.place===mount.slot);
   entries.forEach((entry,j)=>{
    const {card,slot}=entry;
    if(entry.side===side||entry.unavailable||card.type!=='Character'||!card.weapons?.length||
       PremiereLocations.physicalPlace(entry)!==slot||!isSite(state.locations[slot])||!own.some(unit=>unit.slot===slot))return;
    add(['disarm',index,j],'Disarmed · '+card.name, {entry,index});
   });
  }
 }
 const updatedOverload=(currentGame()?.cardRulesVersion??latestCardRulesVersion)>=21;
 if(updatedOverload||active||battleSession?.weaponTurn===side){
  const overload=side==='Dark'?hand?.findIndex(card=>card.id==='Dark:1880')??-1:-1;
  if(overload>=0){
   const permanent=entries.filter(entry=>!entry.unavailable&&entry.card.type==='Character'&&
    (entry.card.permanentWeapon||entry.card.icons?.permanentWeapon)).map(entry=>({...entry,permanent:true,host:entry.card}));
   const stored=racks.flatMap(rack=>rack.weapons.map(card=>({card,side:rack.card.side,rack})));
   (updatedOverload?weapons.concat(stored,permanent):weapons).forEach((entry,index)=>{
    if(entry.card.id==='Dark:1002'||!/^[^:]+:/.test(entry.card.id??'')||
       entry.card.characteristics?.some(trait=>/ewok/i.test(trait)))return;
    if(entry.card.id==='Light:1962'&&Object.values(state.locationEffects??{}).flat().some(effect=>activeCardRules(effect.card,'attackRunEpic').length))return;
    add(['overload',overload,index],'Overload · '+entry.card.name,{entry,index:overload});
   });
  }
 }
 if(active&&(forceBudget(side))>0)weapons.forEach((entry,index)=>{
  if(!PremiereWeapons.mine(entry.card))return;
  const canDefuse=(currentGame()?.cardRulesVersion??latestCardRulesVersion)>=7?mineLayers(side,entry.slot):
   PremiereLocations.presentCards(state,side,entry.slot).some(card=>PremiereWeapons.miningDroid(card)&&PremiereUnits.active(card));
  if(!canDefuse)return;
  add(['defuse',index],'Timer Mine entschärfen (1 Force)',{entry,cost:1});
 });
 return options;
}

function playWeaponEffect(side,...args){
 const effect=weaponEffectOptions(side).find(option=>option.args.length===args.length&&option.args.every((value,i)=>value===args[i]));
 if(!effect)return false;
 const {hand}=PremiereGame.zones(state,side),{entry}=effect;
 switch(args[0]){
  case 'scope':
   (entry.card.attachments??=[]).push(hand.splice(args[1],1)[0]);
   spendForce(side,effect.cost);
   break;
  case 'transfer':
   mountWeapons(effect.source).splice(mountWeapons(effect.source).indexOf(effect.weapon),1);
   spendForce(side,effect.cost);
   attachWeapon(effect.target,effect.weapon);
   delete effect.weapon.kabeHeld;
   break;
  case 'rack': state.blasterRack={card:hand.splice(effect.index,1)[0],weapons:[]};break;
  case 'rackIn':
   if(!detachTableCard(entry.side,entry.slot,entry.card))return false;
   (effect.rack??state.blasterRack).weapons.push(entry.card);
   if(battleSession?.weaponTurn===side)finishWeaponAction(side,false);
   break;
  case 'rackOut':
   (effect.rack??state.blasterRack).weapons.splice(args[1],1);
   spendForce(side,effect.cost);
   attachWeapon(effect.target,effect.weapon);
   break;
  case 'disarm': {
   const [card]=hand.splice(effect.index,1);
   if((currentGame()?.cardRulesVersion??latestCardRulesVersion)>=18){
    for(const weapon of entry.card.weapons.slice())loseTableCard(entry.side,entry.slot,weapon);
   }else for(const weapon of entry.card.weapons.splice(0))loseOwnedCard(weapon,entry.side);
   (entry.card.attachments??=[]).push(card);
   openEvazanResponse(side,entry.card,entry.slot);
   break;
  }
  case 'tanks': {
   const [card]=hand.splice(effect.index,1);
   (effect.target.host.attachments??=[]).push(card);
   break;
  }
  case 'overload': {
   const [card]=hand.splice(effect.index,1);
   const frame={kind:'interrupt',interrupt:'overload',site:entry.slot,side,card,entry};
   if(state.game&&hasInterruptResponse(frame))PremiereGame.openResponse(state.game,frame);
   else resolveOverload(frame);
   break;
  }
  case 'defuse':
  case 'saurinUnbolt':
   spendForce(side,effect.cost);
   loseTableCard(entry.side,entry.slot,entry.card);
   if(battleSession?.weaponTurn)finishWeaponAction(side,false);
   break;
 }
 log(side+' · '+effect.label+'.');
 return true;
}

function resolveOverload(frame){
 const {entry,side,card}=frame;
 drawDestinySeries(side,'overload',1,0,draws=>{
  const draw=draws.find(item=>!item.cancelled);
  const value=draw?.value,limit=printedBattleDestiny(entry.card);
  if(entry.permanent){
   const host=PremiereLocations.findEntry(state,entry.card);
   if(value===0&&host&&!host.unavailable)loseTableCard(host.side,host.slot,host.card);
  }else if(entry.rack&&Number.isFinite(value)&&Number.isFinite(limit)&&value<limit){
   const index=entry.rack.weapons.indexOf(entry.card);
   if(index>=0)loseOwnedCard(entry.rack.weapons.splice(index,1)[0],entry.side);
  }else if(!entry.rack){
   const current=weaponRecords().find(record=>record.card===entry.card);
   if(current&&Number.isFinite(value)&&Number.isFinite(limit)&&value<limit&&loseTableCard(current.side,current.slot,current.card)){
    log(entry.card.name+' geht durch Overload verloren.');
   }
   if(current&&value===0&&['Character','Starship'].includes(current.host?.type))loseTableCard(current.side,current.slot,current.host);
  }
  if(!draw)log('Overload: Keine wirksame Destiny.');
  loseOwnedCard(card,side);
  if(battleSession?.weaponTurn)finishWeaponAction(side,false);
 });
}

function automatedDeployOptions(side,reactSite=-1){
 const {hand}=PremiereGame.zones(state,side);
 if(reactSite<0&&(state.phase!==2||state.activeSide!==side))return [];
 return (hand??[]).flatMap((card,index)=>automatedPlacementOptions(side,card,reactSite,forceBudget(side))
  .map(option=>({...option,index})));
}

function automatedPlacementOptions(side,card,reactSite=-1,budget=Infinity){
  const projector=PremiereWeapons.projector(card),mine=PremiereWeapons.mine(card),seeker=PremiereWeapons.seeker(card);
  if(!projector&&!mine&&!seeker||card.side!==side)return [];
  const cost=projector?2:seeker?1:0;
  if(cost>budget)return [];
  return state.locations.flatMap((loc,slot)=>{
   if(reactSite>=0&&slot!==reactSite)return [];
   if(!loc||!isSite(loc))return [];
   if(projector&&!loc.locationTags?.includes('Interior'))return [];
   if(mine&&!PremiereLocations.presentCards(state,side,slot).some(unit=>PremiereWeapons.miningDroid(unit)&&PremiereUnits.active(unit)))return [];
   if(hothEnabled()&&hothMineKind(card)&&!loc.locationTags?.includes('Exterior'))return [];
   if(seeker&&(!PremiereGame.sides.every(actor=>confirmedPresence(actor,slot)===false)||
      allWeaponEntries().some(entry=>entry.slot===slot&&entry.card.type==='Character'&&entry.card.undercover&&!entry.unavailable)))return [];
   const price=hothEnabled()&&hothFreeDeploy(card,side)?0:Math.max(0,cost+sentryModifier(side,slot,'deploy')+(hothEnabled()?hothDeployModifier(card,side,slot):0));
   return price<=budget?[{card,slot,cost:price}]:[];
  });
}

function mineLayers(side,slot){
 return PremiereLocations.presentCards(state,side,slot).some(card=>PremiereWeapons.miningDroid(card)&&PremiereUnits.active(card)&&!PremiereUnits.textSuppressed(card));
}

function buryWeaponCard(side,index,slot){
 const {hand}=PremiereGame.zones(state,side);
 if(state.phase!==2||state.activeSide!==side||!isExteriorPlanetSite(state.locations[slot])||!mineLayers(side,slot)||!hand[index])return false;
 (state.buriedMines??=[]).push({side,slot,card:hand.splice(index,1)[0]});
 log(side+' vergräbt eine Karte bei '+state.locations[slot].name+'.');
 return true;
}

function mineTraffic(){
 return allWeaponEntries().filter(entry=>!entry.unavailable&&['Character','Starship','Vehicle'].includes(entry.card.type));
}

function noteMineTraversal(side,from,to,card){
 if(!state.buriedMines?.length&&!hothEnabled())return;
 const order=boardLocationOrder(),a=order.indexOf(from),b=order.indexOf(to);
 state.mineTraversal={side,card,slots:order.slice(Math.min(a,b)+1,Math.max(a,b))};
 if(hothEnabled())(state.hothMineTraversals??=[]).push({...state.mineTraversal});
}

function revealTrippedMines(before){
 const path=state.mineTraversal;
 delete state.mineTraversal;
 if(!state.buriedMines?.length||!before)return;
 const arrivals=new Map();
 for(const {side,slot,card} of mineTraffic())if(before.get(card)!==slot) {
  const arrival=arrivals.get(slot)??{side,arriving:[]};arrival.arriving.push({card,deployed:!before.has(card)});arrivals.set(slot,arrival);
 }
 for(const slot of path?.slots??[])arrivals.set(slot,{side:path.side,crossing:path.card,arriving:[{card:path.card}]});
 state.buriedMines=state.buriedMines.filter(record=>{
  const arrival=arrivals.get(record.slot);
  if(!arrival)return true;
  log('Aufgedeckt bei '+state.locations[record.slot].name+' · '+record.card.name+'.');
  if(PremiereWeapons.mine(record.card))(state.mineQueue??=[]).push({...record,actor:arrival.side,crossing:arrival.crossing,arriving:arrival.arriving});
  else loseOwnedCard(record.card,record.side);
  return false;
 });
}

function explodeMine(side,slot,card,crossing){
 drawDestinySeries(side,'mine',1,0,draws=>{
  const pending={kind:'mine',card,slot,place:slot,crossing,side:PremiereGame.otherSide(side),remaining:draws.length?(PremiereBattle.total(draws)??0)+holocamDestiny(side,slot):0};
  log(card.name+' explodiert bei '+state.locations[slot].name+' · '+(draws.length?'Destiny '+pending.remaining:'Reserve Deck leer')+'.');
  if(pending.remaining>0&&automatedTargets(pending).length)state.automatedPending=pending;
 });
}

function settleTrippedMine(record,defused=false){
 if(hothEnabled()&&hothMineKind(record.card)){hothSettleBuriedMine(record,defused);return;}
 loseOwnedCard(record.card,record.side);
 if(!defused&&PremiereWeapons.mine(record.card)&&record.actor!==record.side)explodeMine(record.side,record.slot,record.card,record.crossing);
}

function handleTrippedMine(side,defuse){
 const pending=state.automatedPending;
 if(pending?.kind!=='defuse'||pending.side!==side)return false;
 if(defuse){

  if(!forceBudget(side)||!mineLayers(side,pending.slot))return false;
  spendForce(side);
  log(pending.card.name+' wird entschärft.');
 }
 state.automatedPending=null;
 settleTrippedMine(pending.record,defuse);
 return true;
}

function deployAutomated(side,index,slot){
 const move=automatedDeployOptions(side).find(choice=>choice.index===index&&choice.slot===slot);
 if(!move)return false;
 const {hand}=PremiereGame.zones(state,side),[card]=hand.splice(index,1);
 spendForce(side,move.cost);
 placeAutomatedWeapon(side,card,slot);
 log(side+' legt '+card.name+' bei '+state.locations[slot].name+' aus ('+move.cost+' Force).');
 return true;
}

function placeAutomatedWeapon(side,card,slot){
 card.controller=side;
 if(!PremiereWeapons.projector(card))card.tableSide=PremiereGame.otherSide(side);
 if(PremiereWeapons.mine(card))card.armedTurn=state.game?.timing.turn??0;
 PremiereGame.zones(state,side).board[slot].push(card);
}

function seekerMoves(side){
 const version=currentGame()?.cardRulesVersion??latestCardRulesVersion;
 const undercover=version>=17;
 if(undercover){
  if(state.phase!==4||state.activeSide===side)return [];
  if(side===playerSide()&&Number.isInteger(state.seekerPassedTurn)&&state.seekerPassedTurn===state.game?.timing.turn)return [];
 }else if(state.phase!==1||state.activeSide!==side)return [];

 const entries=allWeaponEntries();
 return entries.flatMap((entry,index)=>{
  if(entry.unavailable||!PremiereWeapons.seeker(entry.card)||(entry.card.controller??entry.card.side)!==side)return [];
  const {card,slot:from}=entry,tableSide=card.tableSide??PremiereGame.otherSide(side);
  const moved=state.movedThisTurn?.includes(card),carrier=entry.carriers[0],origin=state.locations[from];
  const choices=[];
  const add=(to,cost,args,label,host)=>{
   if(cost<=(forceBudget(side)))choices.push({args,entry,to,from,cost,card,label,host});
  };
  if(carrier){
   if(undercover)return [];
   if(isSite(origin))add(from,0,[index,from,'exit'],card.name+' verlässt '+carrier.name);
   if(!moved&&entry.carriers.length===1&&isSystem(origin))entries.forEach((target,i)=>{
    if(target.side===tableSide&&target.slot===from&&!target.carriers.length&&canDock(carrier,target.card,from)){
     add(from,1,[index,from,'dock',i],card.name+' transferiert zu '+target.card.name+' (1 Force)',target.card);
    }
   });
   if(!moved&&PremiereUnits.capital(carrier)&&isPlanetSystem(origin))state.locations.forEach((loc,to)=>{
    if(isExteriorPlanetSite(loc)&&sitePlanet(loc)===locationGroup(origin))add(to,1,[index,to,'shuttle'],card.name+' shuttelt nach '+loc.name);
   });
   return choices;
  }
  if(!moved)state.locations.forEach((loc,to)=>{
   if(!loc||!isSite(loc)||from===to)return [];
   const costSide=undercover?side:tableSide;
   const bay=PremiereLocations.conditions(state,from,costSide);
   const transit=bay.dockingBay&&PremiereLocations.conditions(state,to,costSide).dockingBay;
   if(undercover&&adjacentSites(from,to))add(to,1,[index,to],card.name+' → '+loc.name+' (Landspeed, 1 Force)');
   const cost=transit?bay.transitCost:!undercover&&adjacentSites(from,to)?1:null;
   if(cost!==null)add(to,cost,undercover?[index,to,'transit']:[index,to],card.name+' → '+loc.name+' ('+cost+' Force)');
  });
  if(undercover)return choices;
  entries.forEach((target,i)=>{
   const host=target.card,loc=state.locations[target.slot];
   if(target.side!==tableSide||target.unavailable||target.carriers.length||!PremiereUnits.active(host))return;
   if(target.slot===from&&isSite(origin)&&['Vehicle','Starship'].includes(host.type)){
    add(from,0,[index,from,'embark',i],card.name+' steigt auf '+host.name,host);
   }else if(!moved&&PremiereUnits.capital(host)&&isExteriorPlanetSite(origin)&&isPlanetSystem(loc)&&sitePlanet(origin)===locationGroup(loc)){
    add(target.slot,1,[index,target.slot,'shuttle',i],card.name+' shuttelt zu '+host.name,host);
   }
  });
  return choices;
 });
}

function chooseBotSeekerMove(options){
 if(plannedBot())return choosePlannedBotAction(options.map(option=>({...option,kind:'moveSeeker'})));
 return options.find(option=>PremiereLocations.presentCards(state,'Light',option.to)
  .some(target=>PremiereWeapons.seekerTarget(option.card,target,cardAbility(target))));
}

function moveSeeker(side,...args){
 const move=seekerMoves(side).find(choice=>choice.args.length===args.length&&choice.args.every((value,i)=>value===args[i]));
 if(!move)return false;
 const {board}=PremiereGame.zones(state,side);
 if(!detachTableCard(move.entry.side,move.from,move.card))return false;
 if(move.host)PremiereUnits.add(move.host,move.card,'seeker',side);
 else board[move.to].push(move.card);
 if(!['embark','exit'].includes(args[2]))(state.movedThisTurn??=[]).push(move.card);
 spendForce(side,move.cost);
 log(move.label+'.');
 return true;
}

function automatedTargets(pending){
 return allWeaponEntries().filter(entry=>!entry.unavailable&&entry.card.type==='Character'&&
  (pending.kind==='seeker'?PremiereLocations.physicalPlace(entry)===pending.place&&
  PremiereWeapons.seekerTarget(pending.card,entry.card,cardAbility(entry.card)):entry.side===pending.side&&
   (entry.slot===pending.slot||entry.card===pending.crossing||entry.carriers.includes(pending.crossing))));
}

function findAutomatedWeapons(){
 if(!state?.game||state.automatedPending||state.gameWinner||state.pendingForceLoss||state.pendingReserveSearch||state.pendingCardView||
    state.game.timing.pending||PremiereGame.responseWindow(state.game))return;
 while(state.mineQueue?.length){
  const record=state.mineQueue.shift(),{side,slot,card,actor}=record;
  if(PremiereWeapons.mine(card)&&actor!==side&&state.activeSide===side&&mineLayers(side,slot)&&forceBudget(side)){
   state.automatedPending={kind:'defuse',card,slot,side,record};
   return;
  }
  settleTrippedMine(record);
  if(state.automatedPending||PremiereGame.responseWindow(state.game))return;
 }
 applyWuher();
 const entries=allWeaponEntries();
 for(const entry of entries){
  const {card,slot}=entry;
  if(entry.unavailable)continue;
  const owner=card.controller??card.side;
  if(PremiereWeapons.mine(card)&&!(hothEnabled()&&hothMineKind(card))&&Number.isInteger(card.armedTurn)&&owner===state.activeSide&&card.armedTurn<state.game.timing.turn){
   loseTableCard(entry.side,slot,card);
   explodeMine(owner,slot,card);
   if(state.automatedPending||PremiereGame.responseWindow(state.game))return;
  }
  if(PremiereWeapons.seeker(card)){
   const pending={kind:'seeker',card,slot,place:PremiereLocations.physicalPlace(entry),side:owner,entry};
   const targets=automatedTargets(pending);
   if(targets.length){
    state.automatedPending=pending;
    if(targets.length===1){resolveAutomatedTarget(owner,0);findAutomatedWeapons();return;}
    else return;
   }
  }
 }
}

function applyWuher(enteringControl=false){
 const entries=allWeaponEntries(),current=state.game.timing.turn;
 for(const {card,side,slot,unavailable} of entries){
  const legacy=(currentGame()?.cardRulesVersion??latestCardRulesVersion)<9;
  if(card.id!=='Dark:2834'||unavailable||(!legacy&&PremiereUnits.textSuppressed(card)))continue;
  const cantina=locationTitle(state.locations[slot])==='tatooine: cantina';
  const phaseStart=(legacy||enteringControl)&&state.phase===1&&state.activeSide===side&&card.wuherControlTurn!==current;
  if(!cantina&&!phaseStart)continue;
  if(phaseStart)card.wuherControlTurn=current;
  for(const target of entries){
   if(target.slot!==slot||(!cantina&&PremiereLocations.physicalPlace(target)!==slot)||
      (target.card.type!=='Weapon'&&!isDroid(target.card)))continue;
   if(loseTableCard(target.side,slot,target.card))log('Wuher · '+target.card.name+' geht verloren.');
  }
 }
}

function resolveAutomatedTarget(side,index){
 const pending=state.automatedPending;
 if(!pending||!Number.isInteger(index)||pending.side!==side)return false;
 const target=automatedTargets(pending)[index];
 if(!target||!loseTableCard(target.side,target.slot,target.card))return false;
 log(pending.card.name+' · '+target.card.name+' geht verloren.');
 if(pending.kind==='seeker'){
  loseTableCard(pending.entry.side,pending.slot,pending.card);
  state.automatedPending=null;
 }else if(--pending.remaining===0||!automatedTargets(pending).length)state.automatedPending=null;
 return true;
}

function deviceHosts(side,handIndex){
 const {hand}=PremiereGame.zones(state,side);
 return devicePlacementOptions(side,hand?.[handIndex],forceBudget(side));
}

function devicePlacementOptions(side,device,budget=Infinity){
 const {board}=PremiereGame.zones(state,side);
 const [rule]=activeCardRules(device,'device');
 const backpack=side==='Dark'&&device?.id==='Dark:2357';
 const owner=deploymentSide(device);
 if((!rule&&!backpack)||(owner&&owner!==side))return [];
 const mounts=weaponMounts(side,true).map(mount=>({...mount,hostSide:side}));
 if(hothEnabled()&&rule?.targets==='atat-cannon')for(const hostSide of rule.allowOpponent?PremiereGame.sides:[side])
  for(const [slot,row] of PremiereGame.zones(state,hostSide).board.entries()) {
   const local=PremiereLocations.entries(state,hostSide).filter(entry=>entry.slot===slot);
   local.forEach((entry,index)=>{if(!entry.unavailable&&entry.card.id==='Dark:158')mounts.push({host:entry.card,hostSide,slot,index:row.length+index,place:PremiereLocations.physicalPlace(entry)});});
  }
 if(rule?.allowOpponent||activeCardRules(device,'reusableComlink').length){
  const opponent=PremiereGame.otherSide(side);
  mounts.push(...weaponMounts(opponent).map(mount=>({...mount,hostSide:opponent})));
 }
 return mounts.filter(({host,slot,index})=>{
  if(state.locations[slot]?.id==='Light:681')return false;
  if(backpack)return host.type==='Character'&&
   (currentGame()?.cardRulesVersion!==0||board[slot][index]===host)&&
   (characterTraits(host).some(trait=>/trooper/.test(trait))||/trooper/i.test(host.name??''))&&
   !host.attachments?.some(card=>card.id===device.id);
  if(rule.targets!=='starship-at-system-with-bay')return matchesRegisteredTarget(host,rule.targets);
  const loc=state.locations[slot];
  return host.type==='Starship'&&isSystem(loc)&&state.locations.some((site,bay)=>
   sitePlanet(site)===locationGroup(loc)&&PremiereLocations.conditions(state,bay,side).dockingBay);
 }).map(mount=>({...mount,...equipmentPrice(side,mount,hothEnabled()&&hothFreeDeploy(device,side)?0:Math.max(0,(hothEnabled()&&device.id==='Dark:1949'&&mount.host.id==='Dark:1950'?0:rule?.cost??0)+sentryModifier(side,mount.slot,'deploy')+(hothEnabled()?hothDeployModifier(device,side,mount.slot):0)))}))
  .filter(mount=>mount.cost<=budget);
}

function deployDevice(side,handIndex,slot,hostIndex,hostSide=side){
 const option=deviceHosts(side,handIndex).find(choice=>choice.slot===slot&&choice.index===hostIndex&&choice.hostSide===hostSide);
 if(!option)return false;
 const {hand}=PremiereGame.zones(state,side),[device]=hand.splice(handIndex,1);
 spendForce(side,option.cost);
 if(option.discount)PremiereGame.useOnce(state.game,'turn',option.discount);
 (option.host.attachments??=[]).push(device);
 if(hothEnabled())openDeploymentReaction(side,[device]);
 log(side+' rüstet '+option.host.name+' mit '+device.name+' aus ('+option.cost+' Force).');
 return true;
}

function siteDroids(){
 return allWeaponEntries().filter(({card,slot,unavailable})=>!unavailable&&isDroid(card)&&
  state.locations[slot]&&isSite(state.locations[slot])&&!/immune to restraining bolt/i.test(card.gametext??''));
}

function boltDeployOptions(side,index){
 const {hand}=PremiereGame.zones(state,side),card=hand?.[index];
 if(!activeCardRules(card,'restrainDroid').length)return [];
 return siteDroids().flatMap((entry,targetIndex)=>{
  const cost=sentryModifier(side,entry.slot,'deploy');
  if(PremiereUnits.restrainingBolt(entry.card)||cost>(forceBudget(side)))return [];
  return [{card,host:entry.card,hostSide:entry.side,cost,args:[index,entry.slot,targetIndex],
   label:card.name+' an '+entry.card.name+' ('+entry.side+' Side) anlegen'+(cost?' (1 Force)':'')}];
 });
}

function deployBolt(side,...args){
 const option=boltDeployOptions(side,args[0]).find(choice=>choice.args.every((value,i)=>value===args[i]));
 if(!option)return false;
 const {hand}=PremiereGame.zones(state,side),[card]=hand.splice(args[0],1);
 if(option.cost)spendForce(side,option.cost);
 (option.host.attachments??=[]).push(card);
 log(option.label+'.');
 return true;
}

function deviceActions(side){
 if(!expandedCardRules()||state.activeSide!==side||![1,2].includes(state.phase))return [];
 const droids=siteDroids();
 if(state.phase===2)return droids.flatMap((source,sourceIndex)=>{
  const bolt=PremiereUnits.restrainingBolt(source.card);
  if((bolt?.owner??bolt?.side)!==side||!activeCardRules(bolt,'transferBolt').length)return [];
  return droids.flatMap((target,targetIndex)=>target.slot===source.slot&&target!==source&&!PremiereUnits.restrainingBolt(target.card)?[{
   args:['transferBolt',sourceIndex,targetIndex],site:source.slot,source,target,bolt,cost:0,
   label:'Restraining Bolt von '+source.card.name+' auf '+target.card.name+' ('+target.side+' Side) übertragen',
  }]:[]);
 });
 const opposing=PremiereGame.otherSide(side);
 const callers=PremiereLocations.entries(state,side).filter(({card,unavailable})=>!unavailable&&PremiereUnits.active(card)&&
  card.attachments?.some(item=>activeCardRules(item,'stealDroid').length));
 return droids.flatMap((target,targetIndex)=>{
  const bolt=PremiereUnits.restrainingBolt(target.card);
  const caller=callers.find(entry=>entry.slot===target.slot);
  if(target.side!==opposing||!bolt||!caller)return [];
  const reassign=caller.card.attachments.some(item=>activeCardRules(item,'droidTheftOwnership').length);
  const canDeploy=withinDeploymentLimit(target.card,side);
  if(!reassign&&!canDeploy)return [];
  const option={
   args:['stealDroid',targetIndex],site:target.slot,target,bolt,cost:0,
   label:'Caller · '+target.card.name+' mit '+caller.card.name+' übernehmen',
   reassign,
  };
  if(canDeploy||cardUniquenessLimit(target.card)!==1)return [option];
  const conflicts=PremiereLocations.entries(state,side)
   .filter(entry=>sameTitleOrPersona(target.card,entry.card));
  if(!conflicts.length)return [option];
  return [...conflicts,target].map((lostDroid,index)=>({...option,lostDroid,args:[...option.args,index],
   label:option.label+' · '+lostDroid.card.name+(lostDroid===target?' (neu)':' (bereits bei dir)')+' verlieren'}));
 });
}

function performDeviceAction(side,...args){
 const option=deviceActions(side).find(choice=>choice.args.length===args.length&&choice.args.every((value,i)=>value===args[i]));
 if(!option)return false;
 const {source,target,bolt,site,reassign,lostDroid}=option;
 if(source){
  source.card.attachments.splice(source.card.attachments.indexOf(bolt),1);
  (target.card.attachments??=[]).push(bolt);
 }else{
  if(!detachTableCard(target.side,site,target.card))return false;
  target.card.attachments.splice(target.card.attachments.indexOf(bolt),1);
  PremiereGame.zones(state,bolt.owner??bolt.side).hand.push(bolt);
  target.card.controller=side;
  if(reassign)target.card.owner=side;
  PremiereGame.zones(state,side).board[site].push(target.card);
  if(lostDroid){
   loseTableCard(side,lostDroid.slot,lostDroid.card);
   log(lostDroid.card.name+' geht wegen des Persona-Konflikts verloren.');
  }
 }
 log(option.label+'.');
 return true;
}

function theftTargets(actor,mode){
 const {side,card,slot}=actor,place=PremiereLocations.physicalPlace(actor);
 const opposing=PremiereGame.otherSide(side),entries=allWeaponEntries().filter(entry=>entry.card!==card&&
  entry.slot===slot&&!entry.unavailable&&PremiereLocations.physicalPlace(entry)===place);
 const equipment=entry=>['Weapon','Device'].includes(entry.card.type);
 const stealable=entry=>entry.side===opposing&&equipment(entry)&&!protectedWeapon(entry.card)&&!entry.card.occupants?.length&&entries.some(({card:host})=>
  host.type==='Character'&&(host.weapons?.includes(entry.card)||host.attachments?.includes(entry.card)));
 if(mode==='kabe')return entries.filter(stealable);
 if(mode==='tonnika')return entries.filter(equipment).concat(weaponRecords().filter(entry=>entry.slot===slot&&isLoc(entry.host)))
  .map(entry=>({...entry,stealable:stealable(entry)}));
 if(mode==='momaw')return entries.filter(entry=>entry.side===opposing&&
  /\b(bantha|dewback|wampa|rancor|bubo|dragonsnake)\b/.test(locationTitle(entry.card))&&
  !entry.card.occupants?.some(item=>item.card.type==='Character')&&withinDeploymentLimit(entry.card,side));
 return entries.filter(entry=>entry.side===opposing&&
  (isDroid(entry.card)||entry.card.type==='Vehicle'&&entry.card.subType==='Transport')&&
  !entry.card.occupants?.length&&Number.isFinite(entry.card.deploy)&&withinDeploymentLimit(entry.card,side)&&
  !droidProtectedFrom(entry.card,side));
}

function controlTheftOptions(side){
 if(state.activeSide!==side||state.phase!==1||!state.game)return [];

 return PremiereLocations.entries(state,side).flatMap((actor,index)=>{
  if(!actor.unavailable&&activeCardRules(actor.card,'reegeskSalvage').length){
   const key='reegesk:'+(actor.card.instanceId??actor.card.id);
   if(!capForceLoss(side,1)||PremiereGame.wasUsed(state.game,'phase',key))return [];
   const rival=PremiereGame.otherSide(side);
   const piles=[PremiereGame.lostPileFaceDown(state,rival)?[]:PremiereGame.zones(state,rival).lost,
    ...(state.tableEffects??[]).filter(effect=>effect.card.id==='Light:585'&&effect.target===rival).map(effect=>effect.support)];
   return piles.flatMap((pile,pileIndex)=>(pile??[]).flatMap((card,targetIndex)=>{
    const valid=isDroid(card)||card.type==='Vehicle'||card.type==='Weapon'&&card.subType==='Character'||
     card.type==='Device'&&activeCardRules(card,'device').some(rule=>!['starship','vehicle'].includes(rule.targets));
    return valid?[{args:[index,pileIndex,targetIndex,'salvage'],card:actor.card,site:actor.slot,salvage:{card,pile},key,cost:0,
     label:actor.card.name+' · 1 Force für '+card.name+' verlieren'}]:[];
   }));
  }
  const training=spyThiefTraining(actor.card);
  if(training&&!actor.unavailable&&isSite(state.locations[actor.slot])&&!PremiereGame.wasUsed(state.game,'phase',training)){
   const items=PremiereLocations.entries(state,PremiereGame.otherSide(side));
   return items.flatMap((target,targetIndex)=>target.slot===actor.slot&&!target.unavailable&&target.card.type==='Device'&&spyCanSteal(side,target)?
    [{args:[index,targetIndex,'thiefTraining'],actor,card:actor.card,target,site:actor.slot,cost:0,training,
     label:actor.card.name+' · '+target.card.name+' stehlen'}]:[]);
  }
  const [rule]=activeCardRules(actor.card,'controlTheft');
  if(!rule||actor.unavailable||rule.cost>forceBudget(side)||!isSite(state.locations[actor.slot])||
     rule.mode==='kabe'&&actor.card.attachments?.some(card=>activeCardRules(card,'juriJuice').length))return [];
  const targets=theftTargets(actor,rule.mode),uses=state.controlTheftUses?.get(actor.card);
  if(!targets.length||rule.mode==='tonnika'&&uses?.turn===state.game.timing.turn&&uses.count>=2*tonnikaFactor(actor.card))return [];
  const details={card:actor.card,actor,site:actor.slot,rule,cost:rule.cost*tonnikaFactor(actor.card)};
  if(details.cost>forceBudget(side))return [];
  if(rule.mode==='tonnika')return [{...details,args:[index],label:actor.card.name+' · Ausrüstung erbeuten (2 Force)'}];
  return targets.map((target,i)=>({...details,target,args:[index,i],label:actor.card.name+' · '+target.card.name+
   (rule.mode==='wioslea'?' zum Kauf prüfen (1 Force)':' übernehmen')}));
 });
}

function protectedWeapon(card){
 return card.type==='Weapon'&&card.attachments?.some(effect=>activeCardRules(effect,'protectWeaponFromTheft').length);
}

function spyThiefTraining(card){
 const training=card.attachments?.find(effect=>activeCardRules(effect,'thiefTraining').length);
 return training&&'thiefTraining:'+(training.instanceId??training.id);
}

function spyCanSteal(side,entry){
 const {card,slot}=entry;
 if((card.owner??card.side??entry.side)===side||protectedWeapon(card)||!withinDeploymentLimit(card,side))return false;
 if(card.type==='Vehicle')return !tractorShipCrew(card).length;
 if(card.type==='Weapon')return card.subType==='Character';
 return card.type==='Device'&&!card.occupants?.length&&PremiereGame.sides.some(actor=>PremiereLocations.entries(state,actor).some(({card:host,slot:at})=>
  at===slot&&host.type==='Character'&&host.attachments?.includes(card)));
}

function takeStolenTableCard(side,actor,target){
 const card=target.card;
 if(protectedWeapon(card))return false;
 if(!detachTableCard(target.side,target.slot,card))return false;
 function assign(unit){
  unit.owner=side;
  unit.controller=side;
  for(const item of [...(unit.weapons??[]),...(unit.attachments??[])])if(['Weapon','Device'].includes(item.type))assign(item);
  for(const {card:aboard} of unit.occupants??[])if(['Starship','Vehicle'].includes(aboard.type))assign(aboard);
 }
 assign(card);
 if(card.type==='Weapon'){
  if(activeCardRules(actor,'controlTheft').some(rule=>rule.mode==='kabe'))card.kabeHeld=true;
  else if((currentGame()?.cardRulesVersion??latestCardRulesVersion)>=22)delete card.kabeHeld;
  (actor.weapons??=[]).push(card);
 }
 else if(card.type==='Device')(actor.attachments??=[]).push(card);
 else PremiereGame.zones(state,side).board[target.slot].push(card);
 log(actor.name+' übernimmt '+card.name+'.');
 return true;
}

function performControlTheft(side,...args){
 const option=controlTheftOptions(side).find(choice=>choice.args.length===args.length&&choice.args.every((value,i)=>value===args[i]));
 if(!option)return false;
 if(hothEnabled()&&isDroid(option.target?.card)){
  withShipWeaponResponse({kind:'controlTheft',side,target:option.target.card,site:option.target.slot},frame=>{if(!frame?.cancelled)resolveControlTheft(side,option);});return true;
 }
 return resolveControlTheft(side,option);
}
function resolveControlTheft(side,option){
 const {actor,target,card,rule,cost}=option,{force,used}=PremiereGame.zones(state,side);
 if(option.salvage){
  PremiereGame.useOnce(state.game,'phase',option.key);
  return !!beginForceLoss(side,1,{reason:'reegesk',salvage:option.salvage});
 }
 spendForce(side,cost);
 if(option.training){
  PremiereGame.useOnce(state.game,'phase',option.training);
  drawDestinySeries(side,'controlTheft',1,0,draws=>{
   const picked=draws.find(draw=>!draw.cancelled)?.value,limit=printedBattleDestiny(target.card);
   if(Number.isFinite(picked)&&Number.isFinite(limit)&&picked<limit)takeStolenTableCard(side,card,target);
  });
  return true;
 }
 if(rule.mode==='momaw')return takeStolenTableCard(side,card,target);
 if(rule.mode==='tonnika'){
  const counts=state.controlTheftUses??=new Map(),turn=state.game.timing.turn,previous=counts.get(card);
  counts.set(card,{turn,count:previous?.turn===turn?previous.count+1:1});
 }
 drawDestinySeries(side,'controlTheft',rule.mode==='tonnika'?2*tonnikaFactor(card):1,0,draws=>{
  const values=draws.filter(draw=>!draw.cancelled).map(draw=>draw.value),limit=printedBattleDestiny(target?.card);
  if(rule.mode==='kabe'&&Number.isFinite(limit)&&values[0]<limit)takeStolenTableCard(side,card,target);
  if(rule.mode==='wioslea'&&Number.isFinite(limit)&&values[0]>limit&&target.card.deploy<=force.length){
   state.pendingCardView={mode:'wiosleaPurchase',side,card,target,shown:[]};
  }
  if(rule.mode==='tonnika'&&values.includes(2*tonnikaFactor(card))){
   state.pendingCardView={mode:'tonnikaTheft',side,card,actor,shown:[],remaining:2*tonnikaFactor(card)};
  }
 });
 return true;
}

function navSabotageOptions(side){
 if(state.activeSide!==side||state.phase!==2||!state.game)return [];
 const {hand}=PremiereGame.zones(state,side),entries=allWeaponEntries();
 return hand.flatMap((card,index)=>activeCardRules(card,'navSabotage').flatMap(rule=>{
  if(rule.cost>forceBudget(side))return [];
  return entries.flatMap((entry,targetIndex)=>{
   const target=entry.card;
   const ship=target.type==='Starship'&&target.navComputer&&!target.attachments?.some(item=>activeCardRules(item,'navSabotage').length);
   const astromech=isDroid(target)&&/astromech/i.test(target.lore??'')&&entry.carriers[0]?.type==='Starship'&&!droidProtectedFrom(target,side);
   if(entry.unavailable||!ship&&!astromech)return [];
   return [{card,index,target,entry,site:entry.slot,cost:rule.cost,args:[index,targetIndex],label:card.name+' · '+target.name+' (1 Force)'}];
  });
 }));
}

function deployNavSabotage(side,...args){
 const option=navSabotageOptions(side).find(choice=>choice.args.every((value,i)=>value===args[i]));
 if(!option)return false;
 const {hand}=PremiereGame.zones(state,side);
 hand.splice(option.index,1);
 spendForce(side,option.cost);
 const frame={...option,side,kind:'locationEffect',navigation:true};
 if(hasInterruptResponse(frame))PremiereGame.openResponse(state.game,frame);
 else settleNavSabotage(frame);
 return true;
}

function settleNavSabotage(frame){
 const {card,target,side}=frame;
 drawDestinySeries(side,'effect',1,0,draws=>{
  const value=draws.find(draw=>!draw.cancelled)?.value,entry=PremiereLocations.findEntry(state,target);
  if(entry&&!entry.unavailable&&value>1){
   if(target.type==='Starship'){
    (target.attachments??=[]).push(card);
    log(target.name+' verliert seinen Nav Computer.');
    return;
   }
   if(!droidProtectedFrom(target,side))loseTableCard(entry.side,entry.slot,target);
  }
  loseOwnedCard(card,side);
 });
}

function ensureFreeLocationSlot(){
 if(!state||!Array.isArray(state.locations))return false;
 if(state.locations.some(loc=>loc===null))return true;
 state.locations.push(null);state.light.push([]);state.dark.push([]);return true;
}

function locationDeployPositions(side,handIndex){
 if(!state||state.phase!==2||state.activeSide!==side||!['Light','Dark'].includes(side)||state.gameWinner||state.pendingForceLoss||battleSession)return [];
 const card=(side==='Light'?state.hand:state.botHand)?.[handIndex];
 return locationPositionsForCard(side,card);
}
function locationPositionsForCard(side,card){
 if(hothEnabled()&&card?.id==='Light:5586'&&!HothRules.generatorPlan(state.locations,PremiereGame.zones(state,side).deck).allowed)return [];
 const group=locationGroup(card);
 if(card?.id==='Light:681'){const system=state.locations.findIndex(loc=>loc?.id==='Dark:654'&&!loc.blownAway);return system<0?[]:[boardLocationOrder().indexOf(system)];}
 if(state.locations.some(loc=>loc?.blownAway&&locationGroup(loc)===group&&(!hothEnabled()||loc.id!=='Light:5586')))return [];
 if(!group||(card.side&&card.side!==side)||activeCardRules(card,'vehicleSite').length)return [];
 if(state.locations.some(loc=>loc&&(locationTitle(loc)===locationTitle(card)||isHoloSite(card)&&isHoloSite(loc))))return [];

 const order=boardLocationOrder();
 const groupAt=index=>locationGroup(state.locations[order[index]]);
 const first=order.findIndex(slot=>locationGroup(state.locations[slot])===group);
 if(first<0)return [order.length];

 let end=first+1;
 while(end<order.length&&groupAt(end)===group)end++;
 const rank=locationPlacementRank(card),positions=[];
 for(let i=first;i<=end;i++){
  const fitsAfter=i===first||locationPlacementRank(state.locations[order[i-1]])<=rank;
  const fitsBefore=i===end||rank<=locationPlacementRank(state.locations[order[i]]);
  if(fitsAfter&&fitsBefore)positions.push(i);
 }
 return positions;
}

function deployLocationFromHand(side,handIndex,position){
 if(!locationDeployPositions(side,handIndex).includes(position))return false;
 const hand=side==='Light'?state.hand:state.botHand;
 const [card]=hand.splice(handIndex,1);
 return placeLocationCard(side,card,position);
}
function placeLocationCard(side,card,position){
 const order=boardLocationOrder().slice();
 ensureFreeLocationSlot();
 const slot=state.locations.indexOf(null);
 // Unit arrays and rule references use the stable slot. Insertion only changes the table order.
 state.locations[slot]=card;
 order.splice(position,0,slot);
 state.locationOrder=order;
 ensureFreeLocationSlot();
 if(hothEnabled()&&card.id==='Light:5586')hothFulfillGenerator(side);
 if(hothEnabled())queueRuleResponse({kind:'hothLocationDeployed',side,card,site:slot});
 log(side+' legt Location '+card.name+' aus.');return true;
}

function conversionTarget(side,handIndex){
 if(!state||state.phase!==2||state.activeSide!==side||state.gameWinner||state.pendingForceLoss||battleSession)return -1;
 const card=PremiereGame.zones(state,side).hand?.[handIndex];
 if(!card||!isLoc(card)||card.side!==side)return -1;
 return state.locations.findIndex(old=>old&&old.side===PremiereGame.otherSide(side)&&
  old.subType===card.subType&&(locationTitle(old)===locationTitle(card)||isHoloSite(card)&&isHoloSite(old))&&!old.cannotConvert);
}

function convertLocation(side,handIndex,slot){
 if(slot<0||conversionTarget(side,handIndex)!==slot)return false;
 const [card]=PremiereGame.zones(state,side).hand.splice(handIndex,1);
 const previous=state.locations[slot];
 ((state.convertedLocations??=[])[slot]??=[]).push(previous);
 state.locations[slot]=card;
 const effects=PremiereLocations.effectsAt(state,slot);
 if(effects.length){
  state.locationEffects[slot]=effects.filter(effect=>{
   if(!effect.requiredTag||card.locationTags?.includes(effect.requiredTag))return true;
   PremiereGame.zones(state,effect.card.owner??effect.card.side).lost.push(effect.card);
   log(effect.card.name+' geht verloren: Die neue Location erfüllt die Zielbedingung nicht.');
   return false;
  });
 }
 log(side+' konvertiert '+previous.name+'.');
 return true;
}

function revolutionOptions(side,handIndex){
 const {hand}=PremiereGame.zones(state,side);
 if(hand?.[handIndex]?.id!=='Light:2110'||side!=='Light'||forceBudget(side)<3)return [];
 return state.locations.flatMap((location,slot)=>location&&!activeCardRules(location,'mobileSystem').length&&forceBudget(side)>=3+sentryModifier(side,slot,'deploy')&&!PremiereLocations.effectsAt(state,slot)
  .some(effect=>effect.card.id==='Light:2110'||effect.justiceMode==='revolution')?[slot]:[]);
}

function deployRevolution(side,handIndex,slot){
 if(!revolutionOptions(side,handIndex).includes(slot))return false;
 const {hand}=PremiereGame.zones(state,side);
 const [card]=hand.splice(handIndex,1);
 spendForce(side,3+sentryModifier(side,slot,'deploy'));
 const frame={kind:'locationEffect',side,card,site:slot};
 if(state.game&&activeCardRules(card,'rotateLocation').length&&hasInterruptResponse(frame)){
  PremiereGame.openResponse(state.game,frame);
 }else placeRevolution(card,slot);
 return true;
}

function placeRevolution(card,slot){
 ((state.locationEffects??=[])[slot]??=[]).push({card});
 log(card.name+' vertauscht Force-Icons und Seiten des Spieltexts bei '+state.locations[slot].name+'.');
}

function placeLostPileEffect(effect){
 (state.lostPileEffects??=[]).push(effect);
 log(effect.card.name+' liegt bei der Lost Pile der '+effect.target+' Side. Der Stapel ist verdeckt.');
}

function deployLostPileEffect(side,index,target){
 const [card]=PremiereGame.zones(state,side).hand.splice(index,1);
 const effect={card,target},frame={kind:'lostPileEffect',side,...effect};
 if(state.game&&hasInterruptResponse(frame)){
  PremiereGame.openResponse(state.game,frame);
  log(side+' kündigt '+card.name+' für die Lost Pile der '+target+' Side an.');
 }else placeLostPileEffect(effect);
 return true;
}

function cancelLostPileEffect(effect){
 const index=state.lostPileEffects.indexOf(effect);
 if(index<0)return;
 state.lostPileEffects.splice(index,1);
 loseOwnedCard(effect.card,effect.card.side);
 log(effect.card.name+' wurde aufgehoben.');
}

function controlledLocationRule(side,event){
 for(const [site,loc] of state.locations.entries()){
  const rule=activeCardRules(loc,event).find(rule=>rule.printedSide===PremiereLocations.printedSide(state,site,side));
  if(rule&&PremiereLocations.control(state,side,site,cardAbility)===true)return {loc,rule};
 }
 return null;
}

function resolveLocationControlRules(){
 if(state.game.cardRulesVersion!==undefined&&state.game.cardRulesVersion<5)return;
 if((currentGame()?.cardRulesVersion??latestCardRulesVersion)>=15){
  const entries=PremiereGame.sides.flatMap(side=>PremiereLocations.entries(state,side));
  for(const {card,side,slot,unavailable} of entries){
   if(unavailable||!activeCardRules(card,'lostWithKal').length||!state.locations[slot]||!isSite(state.locations[slot]))continue;
   if(!entries.some(entry=>entry.slot===slot&&!entry.unavailable&&entry.card.id==='Light:1407'))continue;
   if(loseTableCard(side,slot,card))log(card.name+' geht verloren, weil Kal’Falnl C’ndros an derselben Site ist.');
  }
 }
 for(const side of PremiereGame.sides){
  const release=controlledLocationRule(side,'releasePrisoners');
  if(release){
   for(const actor of PremiereGame.sides){
    for(const {card,slot,carriers} of PremiereLocations.entries(state,actor)){
     if(card.type!=='Character'||!card.captured||!card.imprisoned||carriers.length||
        sitePlanet(state.locations[slot])!==release.rule.region)continue;
     if(!detachTableCard(actor,slot,card))continue;
     rallyCaptive(card,slot);
     log(release.loc.name+' · '+card.name+' wird bei '+state.locations[slot].name+' befreit.');
    }
   }
  }
  const cancellation=controlledLocationRule(side,'cancelSiteDevice');
  if(cancellation)for(const site of state.locations.keys()){
   for(const effect of [...PremiereLocations.effectsAt(state,site)]){
    if(effect.card.type==='Device'&&locationTitle(effect.card)===cancellation.rule.name)cancelLocationEffect(site,effect);
   }
  }
 }
 updateCapturedStarships();
}

function captureCharacter(card,slot){
 if(card.type!=='Character'||(card.owner??card.side)!=='Light')return false;
 if(card.undercover)breakSpyCover(card);
 if(!detachTableCard('Light',slot,card))return false;
 card.captured=true;
 if(battleSession?.lastHit?.card===card)battleSession.lastHit=null;
 (state.pendingCustody??=[]).push({side:'Dark',card,slot});
 log(card.name+' wird gefangen genommen.');
 return true;
}

function escortChoices(slot,present=false){
 return PremiereLocations.entries(state,'Dark').flatMap((entry,index)=>{
  const {card,carriers,unavailable}=entry;
  if(entry.slot!==slot||unavailable||!PremiereUnits.canEscort(card)||card.escortedCaptive||
     (present&&!PremiereLocations.present(state,card,slot)))return [];
  const host=carriers[0],seat=host?.occupants?.find(occupant=>occupant.card===card);
  if(seat&&!PremiereUnits.accepts(host,card,seat.role,seat,1))return [];
  return [{card,index}];
 });
}

function custodyChoices(side){
 const pending=state.pendingCustody?.[0];
 if(pending?.side!==side)return [];
 const {card,slot}=pending,loc=state.locations[slot];
 const choices=side==='Dark'?
  escortChoices(slot).map(escort=>({args:['seize',escort.index],card,escort:escort.card,label:escort.card.name+' eskortiert '+card.name})):
  isSite(loc)?[{args:['rally'],card,label:card.name+' kehrt bei '+loc.name+' zurück (Rally)'}]:[];
 if(side==='Dark'&&PremiereLocations.prison(loc)){
  choices.unshift({args:['imprison'],card,label:card.name+' bei '+loc.name+' inhaftieren'});
 }
 choices.push({args:['escape'],card,label:card.name+' in den Light Used Pile entkommen lassen'});
 return choices;
}

function botCustodyAction(available=legalActions(state,botSide())){
 if(plannedBot())return botPromptAction(available);
 const control=controlledLocationRule('Light','releasePrisoners');
 return (!control&&available.find(option=>option.args[0]==='imprison'))||
  available.find(option=>option.args[0]==='seize')||available[0];
}

function clearCaptivity(card){
 delete card.captured;
 delete card.imprisoned;
 delete card.frozen;
}

function rallyCaptive(card,slot){
 const owner=card.owner??card.side??'Light';
 clearCaptivity(card);
 card.controller=owner;
 PremiereGame.zones(state,owner).board[slot].push(card);
}

function imprisonCaptive(card,slot){
 card.imprisoned=true;
 card.controller='Dark';
 state.dark[slot].push(card);
}

function resolveCustody({args,escort}){
 const {card,slot}=state.pendingCustody.shift();
 const [kind]=args,loc=state.locations[slot];
 if(kind==='seize'){
  card.controller='Dark';
  escort.escortedCaptive=card;
  log(escort.name+' nimmt '+card.name+' in Eskorte.');
 }else if(kind==='imprison'){
  imprisonCaptive(card,slot);
  log(card.name+' wird bei '+loc.name+' inhaftiert.');
 }else if(kind==='rally'){
  rallyCaptive(card,slot);
  if(battleSession?.segmented&&battleSession.site===slot&&battleSession.segment==='weapons'&&
     !battleSession.participants.Light.includes(card)&&!state.battledCardsThisTurn?.includes(card)){
   battleSession.participants.Light.push(card);
   (state.battledCardsThisTurn??=[]).push(card);
  }
  log(card.name+' kehrt bei '+loc.name+' zur Light Side zurück.');
 }else{
  const owner=card.owner??card.side??'Light';
  clearCaptivity(card);
  PremiereUnits.remove(card,item=>{
   if(item===card)PremiereGame.zones(state,owner).used.push(item);
   else loseOwnedCard(item,owner);
  },item=>loseOwnedCard(item,owner));
  log(card.name+' entkommt in den Light Used Pile.');
 }
 return true;
}

function prisonerTransfers(side){
 if(side!=='Dark'||state.activeSide!==side||state.phase!==4)return [];
 const entries=PremiereLocations.entries(state,side);
 return state.locations.flatMap((loc,slot)=>{
  if(!PremiereLocations.prison(loc))return [];
  const options=entries.flatMap((entry,index)=>{
   const {card}=entry;
   if(!card.escortedCaptive||entry.unavailable||PremiereLocations.physicalPlace(entry)!==slot)return [];
   return [{args:['deliver',slot,index],escort:card,card:card.escortedCaptive,cost:0}];
  });
  for(const [index,card] of state.dark[slot].entries()){
   if(!card.imprisoned)continue;
   for(const {card:escort,index:escortIndex} of escortChoices(slot,true)){
    options.push({args:['take',slot,escortIndex,index],card,escort,cost:0});
   }
  }
  return options;
 });
}

function transferPrisoner({args,card,escort}){
 const [kind,slot]=args,loc=state.locations[slot];
 if(kind==='deliver'){
  delete escort.escortedCaptive;
  imprisonCaptive(card,slot);
  log(escort.name+' liefert '+card.name+' bei '+loc.name+' ein (0 Force).');
 }else{
  if(!detachTableCard('Dark',slot,card))return false;
  delete card.imprisoned;
  escort.escortedCaptive=card;
  log(escort.name+' übernimmt '+card.name+' aus '+loc.name+' (0 Force).');
 }
 return true;
}

const tableEffectRule=card=>activeCardRules(card,'tableEffect')[0];

function tableEffectOptions(side){
 if(!state.game)return [];
 const {hand}=PremiereGame.zones(state,side);
 const waiver=controlledLocationRule(side,'freeNamedDeploy');
 return (hand??[]).flatMap((card,index)=>{
  const rule=tableEffectRule(card);
  if(hothEnabled()&&card.set==='3')return [];
  if(!rule||card.side!==side||!withinDeploymentLimit(card,side))return [];
  if(rule.ejectPilot){
   const {deck}=PremiereGame.zones(state,side);
   if(!PremiereGame.reserveCards(deck).length)return [];
   return allWeaponEntries().flatMap((entry,targetIndex)=>{
    const cost=rule.cost+sentryModifier(side,entry.slot,'deploy');
    return !entry.unavailable&&PremiereUnits.active(entry.card)&&PremiereUnits.fighter(entry.card)&&
     permanentPilotAbility(entry.card)!==null&&cost<=forceBudget(side)?
     [{args:[index,targetIndex],card,host:entry.card,target:entry.side,cost,label:card.name+' · '+entry.card.name+' prüfen (1 Force)'}]:[];
   });
  }
  if(rule.thiefTraining){
   const characters=PremiereLocations.entries(state,side).flatMap((entry,targetIndex)=>{
    const host=entry.card,cost=sentryModifier(side,entry.slot,'deploy');
    return host.type==='Character'&&!entry.unavailable&&cost<=forceBudget(side)&&!characterTraits(host).includes('thief')&&!spyThiefTraining(host)?
     [{args:[index,targetIndex],card,host,target:side,cost,label:card.name+' · '+host.name+' wird Thief'}]:[];
   });
   return characters.concat(weaponRecords().flatMap((entry,targetIndex)=>
    !protectedWeapon(entry.card)&&forceBudget(side)>=sentryModifier(side,entry.slot,'deploy')?
     [{args:[index,'weapon',targetIndex],card,host:entry.card,target:entry.side,cost:sentryModifier(side,entry.slot,'deploy'),
      label:card.name+' · '+entry.card.name+' vor Diebstahl schützen'}]:[]));
  }
  if(rule.scoutTraining)return trainingOptions(side,card,index,'scout').filter(option=>PremiereUnits.hasSkill(option.host,'warrior')||PremiereUnits.hasSkill(option.host,'scout')).map(option=>({...option,training:{...option.training,power:0}}));
  if(rule.trainingSkill)return trainingOptions(side,card,index,rule.trainingSkill);
  if(rule.recharge)return weaponRecords().flatMap((entry,hostIndex)=>entry.card.id==='Dark:2378'?[{card,host:entry.card,target:'Dark',cost:0,args:[index,hostIndex],label:card.name+' auf '+entry.card.name}]:[]);
  if(rule.capturedHost)return (state.capturedShips??[]).map((record,targetIndex)=>({card,host:record.ship,target:side,cost:0,args:[index,targetIndex],label:card.name+' auf '+record.ship.name}));
  if(rule.characterTarget)return characterEffectOptions(side,card,index,rule,forceBudget(side));
  if(rule.hullEffect)return hullModificationOptions(side,card,index,rule,forceBudget(side));
  if(rule.capitalHost)return PremiereGame.sides.flatMap(actor=>PremiereLocations.entries(state,actor)).flatMap((entry,hostIndex)=>{
   const cost=sentryModifier(side,entry.slot,'deploy');
   return !entry.unavailable&&PremiereUnits.active(entry.card)&&PremiereUnits.capital(entry.card)&&cost<=(forceBudget(side))?
    [{args:[index,hostIndex],card,host:entry.card,target:side,cost,label:card.name+' auf '+entry.card.name}]:[];
  });
  const target=rule.ownSide?side:PremiereGame.otherSide(side);
  const waived=waiver?.rule.names.includes(locationTitle(card));
  const withThreepio=rule.freeWithThreepio&&PremiereGame.sides.some(actor=>PremiereLocations.activeCards(state,actor).some(unit=>unit.id==='Light:343'));
  const free=waived||withThreepio;
  const cost=free?0:rule.cost;
  const opposingCost=rule.opposingCost??0;
  return cost<=forceBudget(side)&&opposingCost<=ownForceBudget(PremiereGame.otherSide(side))?[{args:[index],card,target,cost,opposingCost,
   label:card.name+' · '+target+' Side ('+cost+' Force'+(opposingCost?' pro Seite':'')+')'+(waived?' · Central Core':withThreepio?' · C-3PO':'')}]:[];
 });
}

function hullModificationOptions(side,card,index,rule,budget){
 if(budget<rule.cost)return [];
 return PremiereLocations.entries(state,side).flatMap(({card:host,slot,unavailable},hostIndex)=>{
  const cost=rule.cost+sentryModifier(side,slot,'deploy');
  if(cost>budget||unavailable||!PremiereUnits.active(host)||host.type!=='Starship')return [];
  return ['armor','maneuver'].flatMap(stat=>Number.isFinite(host[stat])?[{args:[index,hostIndex,stat],
   card,target:side,host,hullStat:stat,cost,label:card.name+' auf '+host.name+' · '+stat+' +2 ('+cost+' Force)'}]:[]);
 });
}

const forceUser=card=>card.type==='Character'&&PremiereUnits.active(card)&&cardAbility(card)>=6;

const ownLightsaber=card=>(card.weapons??[]).some(weapon=>PremiereWeapons.definition(weapon)?.saber);

function saberTraining(card){
 if(!ownLightsaber(card))return null;
 return (card.attachments??[]).flatMap(effect=>activeCardRules(effect,'saberTraining'))[0]??null;
}

function characterEffectOptions(side,card,index,rule,budget){
 if(rule.cost>budget)return [];
 if(rule.characterTarget==='juri-alien'&&!state.locations.some(juriDestination)&&
   !PremiereGame.sides.some(actor=>PremiereLocations.activeCards(state,actor).some(unit=>locationTitle(unit)==="jabba's sail barge")))return [];
 const owned=!['demotion','juri-alien','program-trap'].includes(rule.characterTarget);
 const entries=(owned?[side]:PremiereGame.sides).flatMap(actor=>PremiereLocations.entries(state,actor));
 return entries.flatMap(({card:host,side:target,slot,unavailable},hostIndex)=>{
  const cost=(rule.characterTarget==='program-trap'?(target===side?1:2):rule.cost)+sentryModifier(side,slot,'deploy');
  if(cost>budget||unavailable||(!PremiereUnits.active(host)&&!(host.undercover&&target===side))||host.type!=='Character')return [];
  if(rule.characterTarget==='undercover')return isSite(state.locations[slot])&&isSpyCharacter(host)&&!host.undercover?
   [{args:[index,hostIndex],card,target,host,cost,label:card.name+' auf '+host.name+' ('+cost+' Force)'}]:[];
  const valid=rule.characterTarget==='program-trap'?isDroid(host)&&!isArtoo(host)&&locationTitle(host)!=='c-3po':rule.characterTarget==='force-user'?forceUser(host):rule.characterTarget==='cape'?matchesRegisteredTarget(host,'rebel-or-alien'):
   rule.characterTarget==='saber-user'?cardAbility(host)>2&&ownLightsaber(host):rule.characterTarget==='juri-alien'?host.subType==='Alien':host.subType==='Imperial'&&
   !/\bvader\b|\bemperor\b/.test(locationTitle(host))&&!characterTraits(host).includes('stormtrooper')&&locationTitle(host)!=='stormtrooper';
  return valid?[{args:[index,hostIndex],card,target,host,cost,
   label:card.name+' auf '+host.name+' ('+cost+' Force)'}]:[];
 });
}

function trainingOptions(side,card,index,skill){

 return PremiereLocations.entries(state,side).flatMap(({card:host,slot,unavailable},hostIndex)=>{
  const cost=sentryModifier(side,slot,'deploy');
  if(cost>(forceBudget(side))||unavailable||!PremiereUnits.active(host)||host.type!=='Character')return [];
  const granted=!PremiereUnits.hasSkill(host,skill);
  if(granted&&!['smuggler','scout'].includes(skill)&&isDroid(host))return [];
  const power=granted?(skill==='pilot'?2:0):1;
  return [{args:[index,hostIndex],card,target:side,host,cost,training:{skill,granted,power},
   label:card.name+' auf '+host.name+' · '+(granted?skill+'-Skill':'+1 Power')+' ('+cost+' Force)'}];
 });
}

function deployTableEffect(side,index,hostIndex,hullStat){
 const option=tableEffectOptions(side).find(choice=>choice.args[0]===index&&choice.args[1]===hostIndex&&choice.args[2]===hullStat);
 if(!option)return false;
 const {hand}=PremiereGame.zones(state,side);
 const [card]=hand.splice(index,1);
 spendForce(side,option.cost);
 if(option.opposingCost)payOpposingJawaCost(side,option.opposingCost);
 const frame={kind:'tableEffect',side,card,target:option.target,host:option.host,training:option.training,hullStat:option.hullStat};
 log(side+' kündigt '+option.label+' an.');
 if(hasInterruptResponse(frame))PremiereGame.openResponse(state.game,frame);
 else placeTableEffect(frame);
 return true;
}

function placeTableEffect({card,target,host,training,hullStat}){
 if(host&&tableEffectRule(card)?.ejectPilot){
  drawDestinySeries(card.owner??card.side,'ejectPilot',1,0,draws=>{
   if((draws.find(draw=>!draw.cancelled)?.value??-1)<=2||permanentPilotAbility(host)===null){
    loseOwnedCard(card,card.side);
    return;
   }
   host.pilotsEjected=1;
   (host.attachments??=[]).push(card);
   (state.tableEffects??=[]).push({card,target,host});
   log(card.name+' entfernt den permanenten Piloten von '+host.name+'.');
  });
  return;
 }
 if(host){
  if(training)card.training=training;
  if(hullStat)card.hullStat=hullStat;
  if(tableEffectRule(card)?.cancelsHostText)card.suppressesHostText=true;
  (host.attachments??=[]).push(card);
  (state.tableEffects??=[]).push({card,target,host,...(tableEffectRule(card)?.recharge?{support:[]}:{} )});
  if(activeCardRules(card,'undercoverEffect').length){
   const entry=PremiereLocations.findEntry(state,host);
   if(entry)enterUndercover(entry);
  }
  log(card.name+' liegt auf '+host.name+'.');
  return;
 }
 const effect={card,target};
 if(tableEffectRule(card)?.weaponRack)effect.weapons=[];
 if(tableEffectRule(card)?.memorial||tableEffectRule(card)?.recharge)effect.support=[];
 (state.tableEffects??=[]).push(effect);
 log(card.name+' liegt auf der '+target+' Side.'+(tableEffectRule(card)?.warriorDeploy?' Warriors dieser Seite kosten +1 Force.':''));
}

function recycleHandOptions(side){
 const table=state.tableEffects?.find(({card,target})=>target===side&&activeCardRules(card,'recycleHand').length);
 if(!table)return [];
 return (PremiereGame.zones(state,side).hand??[]).map((card,index)=>({args:[index],card,
  label:table.card.name+' · '+card.name+' auf Used Pile legen'}));
}

function recycleHandCard(side,index){
 const {hand,used}=PremiereGame.zones(state,side);
 const [card]=hand.splice(index,1);
 used.push(card);
 log(side+' legt '+card.name+' auf den Used Pile.');
 return true;
}

function cancelTableEffect(effect){
 const index=state.tableEffects.indexOf(effect);
 if(index<0)return;
 state.tableEffects.splice(index,1);
 for(const weapon of effect.weapons??[])loseOwnedCard(weapon,effect.target);
 for(const card of effect.support??[])if(activeCardRules(effect.card,'recharge').length)PremiereGame.zones(state,'Dark').used.push(card);else loseOwnedCard(card,effect.target,'support');
 if(effect.card.migTarget){
  const entry=PremiereLocations.findEntry(state,effect.card);
  if(entry)detachTableCard(entry.side,entry.slot,entry.card);
  delete effect.card.migTarget;
 }
 if(effect.host){
  const host=effect.host,index=host.attachments.indexOf(effect.card);
  if(activeCardRules(effect.card,'removePermanentPilots').length)delete host.pilotsEjected;
  if(index>=0)host.attachments.splice(index,1);
  const entry=PremiereLocations.findEntry(state,host),craft=entry?.carriers[0];
  const seat=craft?.occupants.find(occupant=>occupant.card===host&&occupant.role==='pilot');
  if(seat&&!PremiereUnits.hasSkill(host,'pilot')){
   if(PremiereUnits.accepts(craft,host,'passenger',seat))seat.role='passenger';
   else if(detachTableCard(entry.side,entry.slot,host))PremiereUnits.remove(host,unit=>{
    if(unit===host)PremiereGame.zones(state,host.owner??host.side??entry.side).used.push(host);
    else{
     state.tableEffects=state.tableEffects.filter(registered=>registered.card!==unit);
     loseOwnedCard(unit,entry.side);
    }
   },unit=>loseOwnedCard(unit,entry.side));
  }
 }
 loseOwnedCard(effect.card,effect.card.side);
 if(effect.host?.undercover&&activeCardRules(effect.card,'undercoverEffect').length)breakSpyCover(effect.host);
 log(effect.card.name+' wurde aufgehoben.');
}

function namedTableCounter(card,target){
 return namedInterruptAvailable(card)&&
  (activeCardRules(card,'cancelTableEffect').some(rule=>rule.targets.includes(target?.id))||namedCancellation(card,target));
}

function namedCancellation(card,target){
 return !!target&&namedInterruptAvailable(card)&&
  (card.id!=='Dark:304'||!/immune to boring conversation anyway\b/i.test(target.gametext??''))&&
  activeCardRules(card,'namedCancellation').some(rule=>{
   const title=locationTitle(target);
   const match=rule.nameWord?['Interrupt','Effect'].includes(target.type)&&/\bjawa(?:s\b|\b)/.test(title):rule.names.includes(title);
   return match&&(!rule.actor||scompOperators(card.owner??card.side,rule.actor,true).length);
  });
}

function scompOperators(side,actor,deathStarOnly=false){
 return PremiereLocations.entries(state,side).filter(entry=>{
  const {slot,card}=entry,loc=state.locations[slot];
  return loc&&(!deathStarOnly||sitePlanet(loc)==='death star')&&PremiereLocations.conditions(state,slot,side).scompLink&&
   PremiereLocations.presentAt(entry,slot)&&(actor==='r-unit'?isDroid(card)&&characterTraits(card).includes('r-unit'):
    card.type==='Character'&&card.subType==='Imperial'&&characterTraits(card).includes('leader'));
 });
}

function atScompLink(card){
 const entry=PremiereLocations.findEntry(state,card);
 if(!entry||entry.unavailable)return false;
 const place=PremiereLocations.physicalPlace(entry);
 const link=host=>!PremiereUnits.textSuppressed(host)&&host.cardIcons?.includes('Scomp Link');
 if(typeof place!=='number')return link(place);
 if(PremiereLocations.conditions(state,entry.slot,entry.side).scompLink)return true;
 return PremiereGame.sides.some(side=>PremiereLocations.presentCards(state,side,place).some(host=>
  host.type==='Vehicle'&&!PremiereUnits.enclosed(host)&&PremiereUnits.active(host)&&link(host)));
}

function namedWeaponCancellationOptions(side){
 const {hand}=PremiereGame.zones(state,side);
 if(!(hand??[]).some(card=>isAlter(card)||activeCardRules(card,'namedCancellation').length))return [];
 const attached=allWeaponEntries().filter(entry=>!entry.unavailable&&activeCardRules(entry.card,'navSabotage').length);
 const devices=(state.game?.cardRulesVersion??latestCardRulesVersion)>=28?PremiereGame.sides.flatMap(actor=>
  PremiereLocations.entries(state,actor).filter(entry=>!entry.unavailable&&entry.card.type==='Device')):[];
 return hand.flatMap((card,index)=>weaponRecords().concat(attached,devices).flatMap((entry,targetIndex)=>
  namedCancellation(card,entry.card)||isAlter(card)&&attached.includes(entry)&&alterTarget(entry.card)&&highestInterruptAbility(side)>0?[{
  args:[index,targetIndex],card,entry,label:card.name+' · '+entry.card.name+' aufheben',
 }]:[]));
}

function cancelNamedWeapon(side,index,targetIndex){
 const option=namedWeaponCancellationOptions(side).find(choice=>choice.args[0]===index&&choice.args[1]===targetIndex);
 if(!option)return false;
 const [card]=PremiereGame.zones(state,side).hand.splice(index,1);
 const named=namedCancellation(card,option.entry.card);
 const frame={kind:'interrupt',interrupt:named?'namedCounter':'alter',side,card,weaponTarget:option.entry,
  counterMode:named?'direct':'destiny',ability:highestInterruptAbility(side),
  counterCharacter:named?null:highestInterruptCharacters(side)[0],duringBattle:!!battleSession};
 log(option.label+'.');
 PremiereGame.openResponse(state.game,frame);
 return true;
}

function namedInterruptAvailable(card){
 return !hasNamedInterruptLimit(card)||!PremiereGame.wasUsed(state.game,'turn',card.id);
}

function recordNamedInterruptUse(card){
 if(hasNamedInterruptLimit(card))PremiereGame.useOnce(state.game,'turn',card.id);
}

function hasNamedInterruptLimit(card){
 return activeCardRules(card,'combinedBattleDestiny').length||activeCardRules(card,'sharedNamedInterruptLimit').length;
}

function dodonnaCounter(side){
 if(side!=='Light'||!forceBudget(side))return null;
 return PremiereLocations.activeCards(state,side).find(card=>PremiereUnits.active(card)&&activeCardRules(card,'cancelWrongTurn').length)??null;
}

function dodonnaCounterOptions(side){
 const actor=dodonnaCounter(side);
 if(!actor)return [];
 return (state.tableEffects??[]).flatMap((effect,index)=>effect.card.id==='Dark:2833'?[{
  args:[index],actor,effect,label:actor.name+' · Wrong Turn aufheben (1 Force)',
 }]:[]);
}

function mechanicCanCancelLateral(side,target){
 if(!PremiereUnits.fighter(target))return null;
 const ship=PremiereLocations.findEntry(state,target);
 if(!ship||ship.side!==side||ship.unavailable)return null;
 const location=state.locations[ship.slot];
 if(!location||!isSystem(location)&&location.subType!=='Sector')return null;
 return PremiereLocations.entries(state,side).find(({card,slot,unavailable})=>
  !unavailable&&activeCardRules(card,'cancelLateralDamage').length&&PremiereLocations.present(state,card,slot)&&
  sitePlanet(state.locations[slot])===locationGroup(location)&&PremiereLocations.conditions(state,slot,side).dockingBay)?.card;
}

function lateralMechanicOptions(side){
 return state.locations.flatMap((_,slot)=>PremiereLocations.effectsAt(state,slot).flatMap((effect,index)=>{
  const source=effect.card.id==='Dark:1480'?mechanicCanCancelLateral(side,effect.target):null;
  return source?[{args:[slot,index],effect,source,label:source.name+' · Lateral Damage aufheben'}]:[];
 }));
}

function cancelLateralDamageWithMechanic(side,slot,index){
 const option=lateralMechanicOptions(side).find(choice=>choice.args[0]===slot&&choice.args[1]===index);
 if(!option)return false;
 cancelLocationEffect(slot,option.effect);
 if(battleSession?.weaponTurn===side)finishWeaponAction(side,false);
 return true;
}

function playDodonnaCounter(side,index){
 const choice=dodonnaCounterOptions(side).find(option=>option.args[0]===index);
 if(!choice)return false;
 spendForce(side);
 cancelTableEffect(choice.effect);
 if(battleSession?.weaponTurn===side)finishWeaponAction(side,false);
 return true;
}

function unitTableCanceller(side,target){
 return PremiereLocations.entries(state,side).find(({card,unavailable})=>!unavailable&&PremiereUnits.active(card)&&
  activeCardRules(card,'unitTableCancel').some(rule=>rule.target===target.id&&forceBudget(side)>=rule.cost));
}

function unitTableCancelOptions(side){
 return (state.tableEffects??[]).flatMap((effect,index)=>{
  const entry=unitTableCanceller(side,effect.card);
  return entry?[{args:[index],effect,card:entry.card,site:entry.slot,cost:1,label:entry.card.name+' · '+effect.card.name+' aufheben (1 Force)'}]:[];
 });
}

function performUnitTableCancel(side,index){
 const option=unitTableCancelOptions(side).find(action=>action.args[0]===index);
 if(!option)return false;
 spendForce(side,option.cost);
 cancelTableEffect(option.effect);
 if(battleSession?.weaponTurn===side)finishWeaponAction(side,false);
 return true;
}

function tableCancellationOptions(side){
 if(!state.tableEffects?.length)return [];
 const {hand}=PremiereGame.zones(state,side),ability=highestInterruptAbility(side);
 return (hand??[]).flatMap((card,index)=>state.tableEffects.flatMap((effect,effectIndex)=>{
  const named=namedTableCounter(card,effect.card);
  if(!named&&!(isAlter(card)&&ability&&alterTarget(effect.card)))return [];
  return [{args:[index,effectIndex],card,effect,named,ability,label:card.name+' · '+effect.card.name+' aufheben'}];
 }));
}

function initiateTableCancellation(side,index,effectIndex){
 const option=tableCancellationOptions(side).find(choice=>choice.args[0]===index&&choice.args[1]===effectIndex);
 if(!option)return false;
 const [card]=PremiereGame.zones(state,side).hand.splice(index,1);
 if(option.named)recordNamedInterruptUse(card);
 PremiereGame.openResponse(state.game,{kind:'interrupt',interrupt:option.named?'namedCounter':'alter',
  counterMode:option.named?'direct':'destiny',side,card,ability:option.ability,counterCharacter:option.named?null:highestInterruptCharacters(side)[0],
  tableEffect:option.effect,duringBattle:!!battleSession});
 log(side+' spielt '+option.label+'.');
 return true;
}

function initiateAlterLostPileEffect(side,index,effectIndex){
 const [card]=PremiereGame.zones(state,side).hand.splice(index,1);
 const targetEffect=state.lostPileEffects[effectIndex];
 PremiereGame.openResponse(state.game,{kind:'interrupt',interrupt:'alter',side,card,targetEffect,ability:highestInterruptAbility(side),
  counterMode:expandedCardRules()?'destiny':undefined,counterCharacter:highestInterruptCharacters(side)[0],duringBattle:!!battleSession});
 log(side+' spielt '+card.name+' gegen '+targetEffect.card.name+' bei der '+targetEffect.target+' Side.');
 return true;
}

const locationEffectRule=card=>activeCardRules(card,'locationEffect')[0];

function kesselRunBlocked(site){
 const loc=state.locations[site];
 return activeCardRules(loc,'blockKesselRun').some(rule=>PremiereGame.sides.some(side=>
  PremiereLocations.printedSide(state,site,side)===rule.printedSide&&PremiereLocations.control(state,side,site,cardAbility)===true));
}

function missionTargets(mission,side){
 const actor=['lateral-damage','yerka-mig'].includes(mission)?PremiereGame.otherSide(side):side;
 const entries=['detachment','luke-recall'].includes(mission)?PremiereGame.sides.flatMap(player=>PremiereLocations.entries(state,player)):PremiereLocations.entries(state,actor);
 return entries.flatMap(({card,slot,carriers,unavailable},targetIndex)=>{
  if(unavailable||mission==='lateral-damage'&&fireExtinguisherProtects(card))return [];
  const loc=state.locations[slot];
  if(mission==='cell2187')return card.type==='Character'&&locationGroup(loc)!=='death star'&&(isSpyCharacter(card)||characterTraits(card).includes('leader'))?[{target:card,targetIndex}]:[];
  if(mission==='necklace')return card.type==='Character'&&card.subType==='Imperial'?[{target:card,targetIndex}]:[];
  if(mission==='yerka-mig')return card.type==='Character'?[{target:card,targetIndex}]:[];
  if(mission==='luke-recall')return card.type==='Character'&&card.subType==='Rebel'?[{target:card,targetIndex}]:[];
  if(mission==='plastoid-armor'||mission==='breath-mask')return card.type==='Character'&&
   sitePlanet(loc)!==(mission==='plastoid-armor'?'death star':'tatooine')?[{target:card,targetIndex}]:[];
  if(mission==='lateral-damage')return card.type==='Starship'?[{target:card,targetIndex}]:[];
  if(mission==='detachment')return card.type==='Character'&&sitePlanet(loc)==='death star'&&
   characterTraits(card).some(trait=>/trooper\b/.test(trait))?[{target:card,targetIndex}]:[];
  if(mission==='tactical-recall')return [];
  if(mission==='death-star-plans')return isDroid(card)&&locationGroup(loc)!=='death star'?[{target:card,targetIndex}]:[];
  if(mission==='desperate-hour')return card.type==='Character'&&card.subType==='Rebel'&&locationGroup(loc)==='tatooine'?
   [{target:card,targetIndex}]:[];
  const smuggler=PremiereUnits.hasSkill(card,'smuggler')||activeCardRules(card,'kesselSmuggler').length>0;
  return smuggler&&isPlanetSystem(loc)&&carriers.some(ship=>ship.type==='Starship'&&PremiereUnits.active(ship))?
   [{target:card,targetIndex,origin:slot,parsec:loc.parsec}]:[];
 });
}

function locationEffectOptions(side,index){
 const {hand}=PremiereGame.zones(state,side),card=hand?.[index],rule=locationEffectRule(card);
 if(hothEnabled()&&card?.set==='3')return [];
 if(!rule||rule.trigger||rule.mission==='tactical-recall'||(card.owner??card.side)!==side||rule.cost>(forceBudget(side))||!withinDeploymentLimit(card,side))return [];
 const targets=rule.mission?missionTargets(rule.mission,side):[];
 const options=state.locations.flatMap((loc,site)=>{
  if(!loc)return [];
  if(rule.expandsText)return isSite(loc)?[{card,cost:rule.cost,args:[index,site],label:card.name+' bei '+loc.name}]:[];
  if(rule.imperialJustice){
   const rival=PremiereGame.otherSide(side);
   const choices=[{mode:'revolution',label:'Gegen Revolution schützen'}];
   if(forceFromLocations(rival).count-forceFromLocations(side).count>=4)choices.unshift({mode:'generation',label:'Force-Generierung aufheben'});
   return choices.map(({mode,label})=>({card,cost:rule.cost,justiceMode:mode,args:[index,site,mode],label:card.name+' · '+label}));
  }
  if(rule.darkWaters){
   const vehicleSite=loc.locationTags?.includes('Interior')&&(loc.locationTags.includes('Vehicle Site')||
    loc.hostInstanceId&&PremiereGame.sides.some(actor=>PremiereLocations.entries(state,actor).some(entry=>
     entry.card.type==='Vehicle'&&entry.card.instanceId===loc.hostInstanceId)));
   return isExteriorPlanetSite(loc)&&sitePlanet(loc)!=='hoth'||vehicleSite?
    [{card,cost:rule.cost,args:[index,site],label:card.name+' bei '+loc.name}]:[];
  }
  if(rule.sentryRegion)return sitePlanet(loc)===rule.sentryRegion?[
   ['deploy','Gegnerischer Deploy +1'],['destiny','Gegnerische Mindest-Ability +1'],['power','Eigene Gesamt-Power +1'],
  ].map(([mode,label])=>({card,cost:rule.cost,sentryMode:mode,args:[index,site,mode],label:card.name+' · '+label+' (2 Force)'})):[];
  if(rule.rebelPlanners)return locationTitle(loc)==='yavin 4: massassi war room'||PremiereLocations.conditions(state,site,side).dockingBay?
   [{card,cost:rule.cost,args:[index,site],label:card.name+' bei '+loc.name+' (1 Force)'}]:[];
  if(rule.siteDevice)return isSite(loc)&&(!rule.exactSite||locationTitle(loc)===rule.exactSite)&&(!rule.requiredTag||loc.locationTags?.includes(rule.requiredTag))&&
   (!rule.deployRegion||sitePlanet(loc)===rule.deployRegion)?
   [{card,cost:rule.cost,args:[index,site],label:card.name+' bei '+loc.name+' auslegen ('+rule.cost+' Force)'}]:[];
  if(rule.nightfall)return isPlanetSystem(loc)?[{card,cost:0,args:[index,site],label:loc.name+' · Nachtbedingungen an den Sites'}]:[];
  if(rule.darkHours)return isSite(loc)&&PremiereLocations.conditions(state,site,side).night&&darkHoursTargets(site).length?
   [{card,cost:0,args:[index,site],label:card.name+' · Figuren bei '+loc.name+' einschlafen lassen'}]:[];
  if(rule.beggar){
   const cost=locationTitle(loc)==="tatooine: beggar's canyon"?0:3;
   return sitePlanet(loc)==='tatooine'&&loc.locationTags?.includes('Exterior')?[{card,cost,args:[index,site],label:card.name+' bei '+loc.name+' ('+cost+' Force)'}]:[];
  }
  if(rule.iconBonus)return [{card,cost:0,args:[index,site],label:loc.name+' · +1 Force-Icon pro Seite'}];
  if(rule.mission==='yerka-mig')return targets.map(({target,targetIndex})=>({card,target,cost:0,args:[index,site,targetIndex],
   label:card.name+' bei '+loc.name+' · Ziel '+target.name}));
  if(rule.mission==='necklace')return sitePlanet(loc)==='yavin 4'?targets.map(({target,targetIndex})=>({
   card,target,cost:0,args:[index,site,targetIndex],label:card.name+' · '+target.name+' nach '+loc.name,
  })):[];
  if(rule.mission==='luke-recall')return isSite(loc)&&sitePlanet(loc)==='tatooine'?targets.map(({target,targetIndex})=>({
   card,cost:rule.cost,target,args:[index,site,targetIndex],label:card.name+' · '+target.name+' nach '+loc.name,
  })):[];
  if(rule.mission==='lateral-damage'||rule.mission==='detachment'){
   if(rule.mission==='lateral-damage'?!isSystem(loc):sitePlanet(loc)!=='tatooine'||PremiereLocations.conditions(state,site,side).dockingBay)return [];
   return targets.map(({target,targetIndex})=>({card,cost:rule.cost,target,args:[index,site,targetIndex],
    label:card.name+' · '+target.name+' → '+loc.name}));
  }
  if(rule.mission==='kessel-run'){
   if(!isPlanetSystem(loc)||locationGroup(loc)!=='kessel'||kesselRunBlocked(site))return [];
   return targets.filter(target=>target.origin!==site).map(({target,targetIndex,origin,parsec})=>{
    const distance=Math.abs(loc.parsec-parsec);
    return {card,cost:0,target,origin,distance,args:[index,site,targetIndex],
     label:target.name+' · '+state.locations[origin].name+' ↔ '+loc.name+' ('+distance+' Force zurückholen)'};
   });
  }
  if(rule.mission==='desperate-hour'){
   if(!isPlanetSystem(loc)||locationGroup(loc)!=='alderaan')return [];
   return targets.map(({target,targetIndex})=>({card,cost:0,target,args:[index,site,targetIndex],
    label:loc.name+' · '+target.name+' als Ziel'}));
  }
  if(sitePlanet(loc)!=='death star'||PremiereLocations.conditions(state,site,side).dockingBay)return [];
  return targets.map(({target,targetIndex})=>({card,cost:0,target,args:[index,site,targetIndex],label:loc.name+' · '+target.name+' als Ziel'}));
 });
 return options.filter(option=>state.locations[option.args[1]]?.id!=='Light:681'||card.id==='Dark:1640').flatMap(option=>{
  const sentry=sentryModifier(side,option.args[1],'deploy'),cost=option.cost+sentry;
  return cost<=(forceBudget(side))?[{...option,cost,label:option.label+(sentry?' · +1 Force durch Sentry':'')}]:[];
 });
}

function placeLocationEffect({card,site,target,escort,origin,distance,sentryMode,justiceMode}){
 if(activeCardRules(card,'rotateLocation').length){placeRevolution(card,site);return;}
 const rule=locationEffectRule(card);
 if(rule.darkHours){settleDarkHours(card,site);return;}
 if(rule.mobileRemote){card.controller=card.owner??card.side;PremiereGame.zones(state,card.controller).board[site].push(card);return;}
 if(rule.mission==='yerka-mig'){
  const side=card.owner??card.side;
  card.migTarget=target;
  PremiereGame.zones(state,side).board[site].push(card);
  (state.tableEffects??=[]).push({card,target:side});
  log(card.name+' läuft '+target.name+' davon.');
  return;
 }
 const effect={card};
 if(escort)effect.escort=escort;
 if(sentryMode)effect.sentryMode=sentryMode;
 if(justiceMode){
  effect.justiceMode=justiceMode;
  if(justiceMode==='revolution'){
   for(const rotation of [...PremiereLocations.effectsAt(state,site)].filter(entry=>activeCardRules(entry.card,'rotateLocation').length)){
    cancelLocationEffect(site,rotation);
   }
  }
 }
 if(target)Object.assign(effect,{target,targetInstanceId:target.instanceId,plansCollected:false,origin,distance});
 else if(rule.siteDevice)Object.assign(effect,{siteDevice:rule.siteDevice,requiredTag:rule.requiredTag,deployedTurn:state.game.timing.turn});
 else if(rule.nightfall)effect.nightfall=true;
 else effect.iconBonus=rule.iconBonus;
 ((state.locationEffects??={})[site]??=[]).push(effect);
 log(card.name+' wird bei '+state.locations[site].name+(target?' mit '+target.name+' als Ziel':'')+' ausgelegt.');
}

function darkHoursTargets(site){
 return PremiereGame.sides.flatMap(side=>PremiereLocations.presentCards(state,side,site)).filter(card=>
  card.type==='Character'&&!isDroid(card));
}

function settleDarkHours(card,site){
 const side=card.owner??card.side,targets=darkHoursTargets(site),through=state.game.timing.turn+2;
 const next=()=>{
  const target=targets.shift();
  if(!target){loseOwnedCard(card,side);return;}
  drawDestinySeries(side,'darkHours',1,0,draws=>{
   const destiny=draws.find(draw=>!draw.cancelled)?.value;
   if(Number.isFinite(destiny)&&destiny>cardAbility(target)){
    target.asleep=true;
    (state.sleepingCharacters??=new Map()).set(target,through);
    log(target.name+' schläft durch '+card.name+'.');
   }
   next();
  });
 };
 next();
}

function wakeSleepingCharacters(){
 for(const [card,through] of state.sleepingCharacters??[]){
  if(state.game.timing.turn<=through)continue;
  delete card.asleep;
  state.sleepingCharacters.delete(card);
 }
}

function deployLocationEffect(side,index,site,targetIndex){
 const args=targetIndex===undefined?[index,site]:[index,site,targetIndex];
 const option=locationEffectOptions(side,index).find(choice=>choice.args.length===args.length&&choice.args.every((arg,i)=>arg===args[i]));
 if(!option)return false;
 const {hand}=PremiereGame.zones(state,side),[card]=hand.splice(index,1);
 if(option.cost)spendForce(side,option.cost);
 const frame={kind:'locationEffect',side,card,site,target:option.target,origin:option.origin,distance:option.distance,
  sentryMode:option.sentryMode,justiceMode:option.justiceMode};
 if(state.game&&hasInterruptResponse(frame))PremiereGame.openResponse(state.game,frame);
 else placeLocationEffect(frame);
 return true;
}

function resolveDroidDetectors(){
 if(!state.game||!expandedCardRules())return;
 for(const site of state.locations.keys()){
  const detector=PremiereLocations.effectsAt(state,site).find(effect=>effect.siteDevice==='droid-detector'&&
   state.game.timing.turn>effect.deployedTurn);
  if(!detector)continue;
  for(const side of PremiereGame.sides)for(const card of PremiereLocations.presentCards(state,side,site)){
   if(isDroid(card)&&loseTableCard(side,site,card))log(detector.card.name+' · '+card.name+' geht verloren.');
  }
 }
}

function locationCancellationOptions(side){
 const {hand}=PremiereGame.zones(state,side),ability=highestInterruptAbility(side),options=[];
 for(const [index,card] of (hand??[]).entries()){
  const alter=isAlter(card)&&ability>0;
  for(const [effectIndex,effect] of (state.lostPileEffects??[]).entries()){
   if(alter&&(!expandedCardRules()||alterTarget(effect.card)))options.push({kind:'alterLostPileEffect',args:[index,effectIndex],
    card,target:effect.target,label:card.name+' · '+effect.card.name+' im Spiel aufheben'});
  }
  state.locations.forEach((loc,site)=>PremiereLocations.effectsAt(state,site).forEach((effect,effectIndex)=>{
   if(namedCancellation(card,effect.card)||alter&&(!expandedCardRules()||alterTarget(effect.card,site))&&
     (locationEffectRule(effect.card)||activeCardRules(effect.card,'rotateLocation').length)){
    options.push({kind:'alterLocationEffect',args:[index,site,effectIndex],card,target:effect.card.side,
     label:card.name+' · '+effect.card.name+' bei '+loc.name+' aufheben'});
   }
  }));
 }
 return options;
}

function initiateAlterLocationEffect(side,index,site,effectIndex){
 const [card]=PremiereGame.zones(state,side).hand.splice(index,1);
 const targetEffect=state.locationEffects[site][effectIndex];
 const named=namedCancellation(card,targetEffect.card);
 if(named)recordNamedInterruptUse(card);
 PremiereGame.openResponse(state.game,{kind:'interrupt',interrupt:named?'namedCounter':'alter',side,card,site,targetEffect,ability:highestInterruptAbility(side),
  counterMode:named?'direct':expandedCardRules()?'destiny':undefined,counterCharacter:named?null:highestInterruptCharacters(side)[0],
  duringBattle:!!battleSession});
 log(side+' spielt '+card.name+' gegen '+targetEffect.card.name+' bei '+state.locations[site].name+'.');
 return true;
}

function cancelLocationEffect(site,effect){
 const row=state.locationEffects?.[site],index=row?.indexOf(effect)??-1;
 if(index<0)return;
 row.splice(index,1);
 if(locationTitle(effect.card)==='spice mines of kessel'&&effect.target?.captured){
  releaseSpyRescueTarget(effect.target);
 }
 loseOwnedCard(effect.card,effect.card.side);
 log(effect.card.name+' wurde aufgehoben.');
}

function retrieveLocationMission(site,effect,count){
 const side=effect.card.owner??effect.card.side;
 for(const card of PremiereGame.retrieveForce(state,side,count??0)){
  log(side+' holt '+card.name+' mit '+effect.card.name+' zurück.');
 }
 cancelLocationEffect(site,effect);
}

function progressKesselRun(site,effect,target){
 const ship=target.carriers.find(card=>card.type==='Starship'&&PremiereUnits.active(card));
 if(!ship)return;
 if(effect.reachedKessel){
  if(target.slot===effect.origin)retrieveLocationMission(site,effect,effect.distance);
  return;
 }
 if(target.slot!==site)return;
 const opponent=PremiereGame.otherSide(effect.card.side);
 drawDestinySeries(opponent,'kesselRun',1,0,draws=>{
  if(draws.some(draw=>!draw.cancelled&&draw.value===0)){
   loseTableCard(target.side,site,ship);
   log('Kessel Run · Destiny 0. '+ship.name+' geht verloren.');
   cancelLocationEffect(site,effect);
   return;
  }
  effect.reachedKessel=true;
  log(effect.target.name+' hat Kessel erreicht. Rückkehr nach '+state.locations[effect.origin].name+'.');
 });
}

function progressLocationMissions(){
 if(state.automatedPending||state.pendingCustody?.length||state.pendingForceLoss||state.pendingReserveSearch||battleSession||
    PremiereGame.responseWindow(state.game)||state.game?.timing.pending)return;
 for(const entry of allWeaponEntries().filter(item=>item.card.migTarget)){
  const target=PremiereLocations.findEntry(state,entry.card.migTarget);
  if(!target)loseTableCard(entry.side,entry.slot,entry.card);
 }
 for(const [site, row] of state.locations.entries()){
  if(!row)continue;
  for(const effect of [...PremiereLocations.effectsAt(state,site)]){
   const mission=locationEffectRule(effect.card)?.mission;
   if(!mission)continue;
   if(mission==='dantooine'){if(effect.target?.blownAway||state.mobileSystems?.['Dark:654']?.orbit===site)cancelLocationEffect(site,effect);continue;}
   if(mission==='spiceMines'){progressSpiceMines(site,effect);continue;}
   if(mission==='cell2187'){progressCell2187(site,effect);continue;}
   if(mission==='kessel-run'&&kesselRunBlocked(site)){cancelLocationEffect(site,effect);continue;}
   const target=PremiereLocations.findEntry(state,effect.target);
   if(!target){cancelLocationEffect(site,effect);continue;}
   if(target.unavailable)continue;
   if(mission==='luke-recall'){
    if(cardForfeitValueAt(target.card,target.side,target.slot)===0){loseTableCard(target.side,target.slot,target.card);cancelLocationEffect(site,effect);}
    else if(target.slot===site)cancelLocationEffect(site,effect);
    continue;
   }
   if(['plastoid-armor','breath-mask','necklace'].includes(mission)){
    if(target.slot===site){
     state.locationEffects[site].splice(state.locationEffects[site].indexOf(effect),1);
     (target.card.attachments??=[]).push(effect.card);
     if(mission==='necklace')effect.card.necklaceWorn=true;
     (state.tableEffects??=[]).push({card:effect.card,host:target.card,target:target.side});
     log(target.card.name+' nimmt '+effect.card.name+' auf.');
    }
    continue;
   }
   if(mission==='tactical-recall'){
    if(target.slot===site)cancelLocationEffect(site,effect);
    continue;
   }
   if(mission==='lateral-damage'){
    if(target.slot!==site)effect.reachedSystem=false;
    else if(!effect.reachedSystem){effect.reachedSystem=true;effect.arrivalRevision=state.game.revision;}
    continue;
   }
   if(mission==='detachment')continue;
   if(mission==='kessel-run'){progressKesselRun(site,effect,target);continue;}
   if(mission==='desperate-hour'){
    const carrier=target.carriers[0],role=carrier?.occupants?.find(entry=>entry.card===target.card)?.role;
    if(target.slot===site&&(!carrier||target.carriers.length===1&&['pilot','passenger','astromech'].includes(role)&&PremiereUnits.active(carrier))){
     const amount=PremiereLocations.activeCards(state,effect.card.side).reduce((total,card)=>{
      if(card.type!=='Character'||!PremiereUnits.active(card))return total;
      const ability=cardAbility(card);
      return total+(ability>=4?2:ability===3?1:0);
     },0);
     retrieveLocationMission(site,effect,amount);
    }
    continue;
   }
   if(target.slot===site&&!effect.plansCollected){
    effect.plansCollected=true;
    log(effect.target.name+' hat die Todessternpläne geholt.');
   }
   if(!effect.plansCollected||sitePlanet(state.locations[target.slot])!=='yavin 4')continue;
   drawDestinySeries(effect.card.side,'deathStarPlans',3,0,draws=>retrieveLocationMission(site,effect,PremiereBattle.total(draws)));
  }
 }
}

function targetedUtinniEffects(card){
 const carried=[...(state?.mouseUtinni?.values()??[])];
 return Object.values(state?.locationEffects??{}).flat().concat(carried).filter(effect=>effect.target===card&&!PremiereUnits.textSuppressed(effect.card));
}

function wearingUtinniGear(card,mission){
 return !!card?.attachments?.some(item=>locationEffectRule(item)?.mission===mission);
}

function utinniGearBonus(card,slot){
 return 2*Number(wearingUtinniGear(card,'plastoid-armor'))+
  2*Number(wearingUtinniGear(card,'breath-mask')&&sitePlanet(state.locations[slot])==='tatooine');
}

function lukeUtinniPenalty(card){
 if(!targetedUtinniEffects(card).some(effect=>effect.card.id==='Dark:1599'))return 0;
 return locationTitle(card)==='luke skywalker'?3:1;
}

function juriDestination(loc){
 return !!loc&&['tatooine: cantina','tatooine: mos eisley'].includes(locationTitle(loc));
}

function juriJuice(card){
 return card.attachments?.find(item=>activeCardRules(item,'juriJuice').length);
}

function clearJuriAfterMove(card,side,to){
 const juri=juriJuice(card);
 if(juri&&juriDestination(state.locations[to]))loseTableCard(side,to,juri);
}

function battleCardAbility(card){
 const used=state?.obiAbilityUsed?.get(card),value=cardAbility(card);
 return juriJuice(card)?0:used&&used.turn===state.game?.timing.turn&&Number.isFinite(value)?Math.max(0,value-used.amount):value;
}

function apprehendMigOptions(side){
 return allWeaponEntries().flatMap((entry,i)=>{
  if(!entry.card.migTarget||entry.unavailable)return [];
  const target=PremiereLocations.findEntry(state,entry.card.migTarget);
  return target?.side===side&&!target.unavailable&&target.slot===entry.slot&&
   PremiereLocations.physicalPlace(target)===PremiereLocations.physicalPlace(entry)?[{args:[i],entry,site:entry.slot,
    label:target.card.name+' · Yerka Mig fangen'}]:[];
 });
}

function mouseEligibleEffects(includeAllUtinni=false){
 return state.locations.flatMap((loc,slot)=>loc?PremiereLocations.effectsAt(state,slot).flatMap(effect=>
  effect.card.subType==='Utinni'&&(includeAllUtinni||effect.target&&locationEffectRule(effect.card)?.mission!=='kessel-run')?
   [{effect,slot}]:[]):[]);
}

function mouseUtinniOptions(side){
 if(state.activeSide!==side||!state.game)return [];
 return PremiereLocations.entries(state,side).flatMap((entry,index)=>{
  const {card,slot}=entry,place=PremiereLocations.physicalPlace(entry);
  if(entry.unavailable||!activeCardRules(card,'mouseUtinni').length||place!==slot)return [];
  const held=state.mouseUtinni?.get(card);
  if(held)return PremiereLocations.present(state,held.target,place)?[{
   args:[index,-1],entry,effect:held,site:slot,label:card.name+' liefert '+held.card.name,
  }]:[];
  return mouseEligibleEffects().flatMap(({effect,slot:origin},i)=>slot===origin?[{
   args:[index,i],entry,effect,site:slot,label:card.name+' nimmt '+effect.card.name+' auf',
  }]:[]);
 });
}

function performMouseUtinni(side,index,targetIndex){
 const option=mouseUtinniOptions(side).find(choice=>choice.args[0]===index&&choice.args[1]===targetIndex);
 if(!option)return false;
 const {entry:{card,slot},effect}=option,row=(state.locationEffects[slot]??=[]);
 if(targetIndex>=0){
  row.splice(row.indexOf(effect),1);
  (state.mouseUtinni??=new Map()).set(card,effect);
  (card.attachments??=[]).push(effect.card);
 }else{
  card.attachments.splice(card.attachments.indexOf(effect.card),1);
  state.mouseUtinni.delete(card);
  row.push(effect);
  returnStunnedCharacter(option.entry);
 }
 log(option.label+'.');
 return true;
}

function lateralDamage(card){
 return card.type==='Starship'&&targetedUtinniEffects(card).some(effect=>effect.card.id==='Dark:1480');
}

function tacticalPenalty(card){
 if(!targetedUtinniEffects(card).some(effect=>effect.card.id==='Dark:2397'))return 0;
 return locationTitle(card)==='leia organa'?3:2;
}

function lateralRepairOptions(side){
 if(!state.game)return [];
 return state.locations.flatMap((_,slot)=>PremiereLocations.effectsAt(state,slot).flatMap((effect,index)=>{
  if(effect.card.id!=='Dark:1480'||effect.lastRepairPhase===state.game.timing.phase)return [];
  if(effect.arrivalRevision!==state.game.revision&&(state.activeSide!==side||state.phase!==4))return [];
  const target=PremiereLocations.findEntry(state,effect.target);
  return target?.slot===slot&&target.side===side&&PremiereLocations.present(state,target.card,slot)?
   [{args:[slot,index],effect,card:target.card,label:target.card.name+' · Lateral Damage reparieren'}]:[];
 }));
}

function drawLateralRepair(side,slot,index){
 const option=lateralRepairOptions(side).find(item=>item.args[0]===slot&&item.args[1]===index);
 if(!option)return false;
 const {effect}=option;
 effect.lastRepairPhase=state.game.timing.phase;
 drawDestinySeries(side,'interrupt',1,0,draws=>{
  const value=draws.find(draw=>!draw.cancelled)?.value;
  if(Number.isFinite(value)&&value>2)cancelLocationEffect(slot,effect);
  else log('Lateral Damage bleibt im Spiel. Reparatur-Destiny '+(value??'–')+'.');
 });
 return true;
}

function detachmentAttrition(battleSite,side){
 if(sitePlanet(state.locations[battleSite])!=='tatooine')return 0;
 return state.locations.reduce((amount,loc,slot)=>amount+PremiereLocations.effectsAt(state,slot).filter(({card,target})=>
  card.id==='Dark:2214'&&card.side!==side&&!PremiereUnits.textSuppressed(card)&&
  PremiereLocations.findEntry(state,target)?.slot===slot).length,0);
}

const lostRetrieval = new Map([
 ['Light:1102',{cost:1,names:['han solo']}], ['Light:1500',{cost:1,names:['leia organa']}],
 ['Light:1600',{cost:1,names:['luke skywalker']}], ['Light:2105',{cost:1,names:['obi-wan kenobi']}],
 ['Dark:2528',{cost:2,names:['darth vader','grand moff tarkin','admiral motti','general tagge']}]
]);

const shufflePileNames={deck:'Reserve Deck',used:'Used Pile',lost:'Lost Pile'};
function shuffleOptions(side){
 if(!state.game)return [];
 const {hand}=PremiereGame.zones(state,side);
 return (hand??[]).flatMap((card,index)=>{
  if(!activeCardRules(card,'shufflePile').length)return [];
  return PremiereGame.sides.flatMap(target=>Object.entries(shufflePileNames).flatMap(([zone,name])=>
   PremiereGame.zones(state,target)[zone].length?[{card,args:[index,target,zone],cost:0,label:card.name+' · '+target+' '+name+' mischen'}]:[]));
 });
}

function playShuffle(side,index,target,zone){
 const choice=shuffleOptions(side).find(option=>option.args[0]===index&&option.args[1]===target&&option.args[2]===zone);
 if(!choice)return false;
 PremiereGame.zones(state,side).hand.splice(index,1);
 const frame={kind:'interrupt',interrupt:'shufflePile',side,card:choice.card,target,zone,duringBattle:!!battleSession};
 log(choice.label+'.');
 if(hasInterruptResponse(frame))PremiereGame.openResponse(state.game,frame);
 else settleShuffle(frame);
 return true;
}

function settleShuffle(frame){
 if(!frame.cancelled){
  const pile=PremiereGame.zones(state,frame.target)[frame.zone];
  const shuffle=frame.zone==='deck'?PremiereGame.shuffleReserve:PremiereGame.shuffle;
  pile.splice(0,pile.length,...shuffle(pile,state.game));
  const leader=PremiereLocations.entries(state,frame.side).find(entry=>!entry.unavailable&&isSite(state.locations[entry.slot])&&
   activeCardRules(entry.card,'shufflePeek').some(rule=>rule.trigger===frame.card.id));
  if(leader){
   const place=PremiereLocations.physicalPlace(leader),count=PremiereGame.sides.reduce((total,side)=>
    total+PremiereLocations.presentCards(state,side,place).filter(card=>card!==leader.card&&PremiereUnits.active(card)&&
     characterTraits(card).includes('musician')).length,0);
   state.pendingCardView={mode:'shuffleMusicians',side:frame.side,card:leader.card,shown:[],shuffleFrame:frame,count,peeked:false};
   return;
  }
  PremiereGame.zones(state,frame.side).used.push(frame.card);
 }else loseOwnedCard(frame.card,frame.side);
 if(frame.duringBattle)finishWeaponAction(frame.side,false);
}

function namedLostTargets(side,rule){
 const {lost}=PremiereGame.zones(state,side);
 return lost.flatMap((card,index)=>rule.names.includes(locationTitle(card))?[{card,index}]:[]);
}

function namedRetrievalOptions(side){
 const {hand,deck}=PremiereGame.zones(state,side);
 return (hand??[]).flatMap((card,index)=>{
  const [lightsaberSearch]=activeCardRules(card,'searchLightsaber');
  const budget=forceBudget(side);
  if(lightsaberSearch&&card.side===side&&state.game&&deck?.length&&budget>=lightsaberSearch.cost){
   return [{kind:'searchReserve',args:[index],card,cost:lightsaberSearch.cost,
    label:card.name+' · Lichtschwert im Reserve Deck suchen (1 Force)'}];
  }
  const rule=lostRetrieval.get(card.id);
  if(!rule||card.side!==side||budget<rule.cost)return [];
  const targets=namedLostTargets(side,rule),retrieve=[];
  if((currentGame()?.cardRulesVersion??latestCardRulesVersion)>=23){
   if(targets.length)retrieve.push({kind:'retrieve',args:[index],card,cost:rule.cost,chooseAfter:true,
    label:card.name+' · Benannte Figur aus dem Lost Pile zurückholen ('+rule.cost+' Force)'});
  }else for(const {card:target,index:slot} of targets){
   retrieve.push({kind:'retrieve',args:[index,slot],card,target,cost:rule.cost,
    label:card.name+' · '+target.name+' zurückholen ('+rule.cost+' Force)'});
  }
  const searchCost=rule.cost+2;
  if(state.game&&deck?.length&&budget>=searchCost)retrieve.push({
   kind:'searchReserve',args:[index],card,cost:searchCost,
   label:card.name+' · Reserve Deck durchsuchen ('+searchCost+' Force)'});
  return retrieve;
 });
}

function playRetrieval(side,kind,...args){
 const choice=namedRetrievalOptions(side).find(entry=>entry.kind===kind&&entry.args.every((value,i)=>value===args[i]));
 if(!choice)return false;
 const {hand}=PremiereGame.zones(state,side);
 hand.splice(args[0],1);
 spendForce(side,choice.cost);
 const frame={...choice,kind:'interrupt',interrupt:'retrieve',side,search:kind==='searchReserve',duringBattle:!!battleSession};
 log(side+' spielt '+choice.card.name+' ('+choice.cost+' Force).');
 if(state.game&&hasInterruptResponse(frame))PremiereGame.openResponse(state.game,frame);
 else settleRetrieval(frame);
 return true;
}

function settleRetrieval(frame){
 if(!frame.cancelled&&frame.search){
  state.pendingReserveSearch=frame;
  return;
 }
 if(!frame.cancelled){
  if(frame.chooseAfter&&namedLostTargets(frame.side,lostRetrieval.get(frame.card.id)).length){
   state.pendingCardView={side:frame.side,mode:'namedRecovery',card:frame.card,shown:[],retrieval:frame};
   return;
  }
  retrieveNamedCard(frame.side,frame.target);
 }
 loseOwnedCard(frame.card,frame.side);
 if(frame.duringBattle&&battleSession?.weaponTurn===frame.side)finishWeaponAction(frame.side,false);
}

function retrieveNamedCard(side,target){
 const {lost}=PremiereGame.zones(state,side);
 const retrieved=PremiereGame.retrieveCard(state,side,lost.indexOf(target));
 if(retrieved)log(side+' holt '+retrieved.name+' in die Used Pile.');
}

function reserveSearchChoices(frame){
 const {deck}=PremiereGame.zones(state,frame.side);
 const names=frame.names??lostRetrieval.get(frame.card.id)?.names;
 const eligible=PremiereGame.reserveCards(deck).filter(card=>names?names.includes(locationTitle(card)):PremiereWeapons.definition(card)?.saber===true);
 return eligible.length?eligible.map((card,index)=>({args:[index],card,label:card.name+' aufdecken und auf die Hand nehmen'})):
  [{args:[null],label:'Suche beenden und mischen'}];
}

function finishReserveSearch(index){
 const frame=state.pendingReserveSearch;
 const choice=reserveSearchChoices(frame).find(option=>option.args[0]===index);
 if(!choice)return false;
 const {deck,hand}=PremiereGame.zones(state,frame.side);
 if(choice.card){
  hand.push(...deck.splice(deck.indexOf(choice.card),1));
  log(frame.side+' deckt '+choice.card.name+' auf und nimmt die Karte auf die Hand.');
 }else log(frame.side+' findet keine passende Karte.');
 const shuffled=PremiereGame.shuffleReserve(deck,state.game);
 deck.splice(0,deck.length,...shuffled);
 log(frame.side+' mischt das Reserve Deck.');
 state.pendingReserveSearch=null;
 if(!frame.sourceOnTable)loseOwnedCard(frame.card,frame.side);
 if(frame.duringBattle&&battleSession?.weaponTurn===frame.side)finishWeaponAction(frame.side,false);
 return true;
}

function unitReserveSearchOptions(side){
 if(!state.game||!PremiereGame.reserveCards(PremiereGame.zones(state,side).deck).length)return [];
 return PremiereLocations.entries(state,side).flatMap(({card,slot,unavailable},index)=>{
  const [rule]=activeCardRules(card,'unitReserveSearch');
  const key='unitSearch:'+(card.instanceId??card.id+':'+index);
  const loc=state.locations[slot];
  if(rule?.warRoom&&(!isSite(loc)||!/war room/.test(locationTitle(loc))||(loc.owner??loc.side)!==side)||rule?.deathStar&&sitePlanet(loc)!=='death star')return [];
  if(!rule||unavailable||!PremiereUnits.active(card)||forceBudget(side)<rule.cost||
     rule.controlOnly&&(state.activeSide!==side||state.phase!==1||PremiereGame.wasUsed(state.game,'phase',key)))return [];
  return [{args:[index],card,site:slot,key,rule,cost:rule.cost,label:card.name+' · '+rule.display+' suchen ('+rule.cost+' Force)'}];
 });
}

function beginUnitReserveSearch(side,index){
 const option=unitReserveSearchOptions(side).find(choice=>choice.args[0]===index);
 if(!option)return false;
 spendForce(side,option.cost);
 if(option.rule.costUsed){const entry=PremiereLocations.findEntry(state,option.card);if(!entry||!tableToUsed(entry))return false;}
 if(option.rule.controlOnly)PremiereGame.useOnce(state.game,'phase',option.key);
 state.pendingReserveSearch={card:option.card,side,names:option.rule.names,sourceOnTable:true,duringBattle:!!battleSession};
 log(option.label+'.');
 return true;
}

function limitedResourcesOptions(side){
 if(!state.game)return [];
 const opponent=PremiereGame.otherSide(side),piles=PremiereGame.zones(state,opponent);
 if(!piles.hand||piles.hand.length>2)return [];
 const tanks=PremiereLocations.activeCards(state,opponent).some(card=>card.type==='Starship'&&
  card.attachments?.some(item=>['Light:997','Dark:996'].includes(item.id)&&!PremiereUnits.textSuppressed(item)));
 const amount=(state.activeSide===side?4:2)-(tanks?2:0);
 if(amount===0)return [];
 return (PremiereGame.zones(state,side).hand??[]).flatMap((card,index)=>activeCardRules(card,'limitedResources').length?
  [{card,args:[index],opponent,amount,label:card.name+' · '+amount+' Force verlieren lassen'}]:[]);
}

function playLimitedResources(side,index){
 const option=limitedResourcesOptions(side).find(choice=>choice.args[0]===index);
 if(!option)return false;
 PremiereGame.zones(state,side).hand.splice(index,1);
 const frame={...option,kind:'interrupt',interrupt:'limitedResources',side,duringBattle:!!battleSession};
 log(side+' spielt '+option.card.name+'.');
 if(hasInterruptResponse(frame))PremiereGame.openResponse(state.game,frame);
 else settleLimitedResources(frame);
 return true;
}

function settleLimitedResources(frame){
 loseOwnedCard(frame.card,frame.side);
 if(!frame.cancelled)beginForceLoss(frame.opponent,frame.amount,{reason:'limitedResources'});
 if(frame.duringBattle&&battleSession?.weaponTurn===frame.side)finishWeaponAction(frame.side,false);
}

function gravelStormOptions(side){
 if(!state.game)return [];
 const hand=PremiereGame.zones(state,side).hand??[];
 if(!hand.some(card=>activeCardRules(card,'gravelStorm').length))return [];
 const opponent=PremiereGame.otherSide(side);
 const protectedSites=new Set(state.locations.flatMap((_,slot)=>PremiereLocations.effectsAt(state,slot)
  .some(({card})=>activeCardRules(card,'gravelProtection').length)?[slot]:[]));
 const entries=PremiereLocations.entries(state,opponent);
 return hand.flatMap((card,index)=>{
  const [rule]=activeCardRules(card,'gravelStorm');
  if(!rule)return [];
  return entries.flatMap((entry,targetIndex)=>{
   const {card:target,slot,unavailable}=entry,location=state.locations[slot];
   if(unavailable||target.type!=='Character'||hothEnabled()&&target.weatherProtectionTurn===state.game.timing.turn||PremiereLocations.physicalPlace(entry)!==slot||
     sitePlanet(location)!=='tatooine'||!rule.sites.includes(locationTitle(location).split(':').at(-1).trim())||
     [...protectedSites].some(protectedSite=>protectedSite===slot||adjacentSites(protectedSite,slot)))return [];
   return [{card,target,site:slot,args:[index,targetIndex],label:card.name+' gegen '+target.name+' · '+location.name}];
  });
 });
}

function playGravelStorm(side,index,targetIndex){
 const option=gravelStormOptions(side).find(choice=>choice.args[0]===index&&choice.args[1]===targetIndex);
 if(!option)return false;
 PremiereGame.zones(state,side).hand.splice(index,1);
 const frame={...option,kind:'interrupt',interrupt:'gravelStorm',side,duringBattle:!!battleSession};
 log(side+' spielt '+option.card.name+' gegen '+option.target.name+'.');
 if(hasInterruptResponse(frame))PremiereGame.openResponse(state.game,frame);
 else settleGravelStorm(frame);
 return true;
}

function settleGravelStorm(frame){
 const finish=()=>{
  loseOwnedCard(frame.card,frame.side);
  if(frame.duringBattle&&battleSession?.weaponTurn===frame.side)finishWeaponAction(frame.side,false);
 };
 if(frame.cancelled){finish();return;}
 drawDestinySeries(frame.side,'interrupt',1,0,draws=>{
  const destiny=PremiereBattle.total(draws);
  const opponent=PremiereGame.otherSide(frame.side);
  const target=PremiereLocations.entries(state,opponent).find(entry=>entry.card===frame.target&&entry.slot===frame.site&&!entry.unavailable);
  if(target&&draws.length&&destiny>cardAbility(target.card)){
   log('Gravel Storm: Destiny '+destiny+' übertrifft die Ability. '+target.card.name+' geht verloren.');
   loseTableCard(opponent,target.slot,target.card);
  }else log('Gravel Storm: Destiny reicht nicht aus. Das Ziel bleibt im Spiel.');
  finish();
 });
}

const informationCardTypes=['Character','Device','Effect','Interrupt','Location','Starship','Vehicle','Weapon'];

function spySabotageTargets(side){
 const entries=allWeaponEntries(),fixed=weaponRecords().filter(entry=>isLoc(entry.host));
 const devices=state.locations.flatMap((_,slot)=>PremiereLocations.effectsAt(state,slot).flatMap(effect=>
  effect.card.type==='Device'?[{card:effect.card,slot,effect,side:effect.card.owner??effect.card.side}]:[]));
 return entries.concat(fixed,devices).flatMap(entry=>{
  const {card,slot}=entry;
  if(entry.unavailable||!['Weapon','Device','Vehicle'].includes(card.type)||!isSite(state.locations[slot]))return [];
  const host=entry.host??entries.find(candidate=>candidate.slot===slot&&
   [...(candidate.card.weapons??[]),...(candidate.card.attachments??[])].includes(card))?.card;
  const deploy=card.deploy??(card.type==='Weapon'&&host?weaponDeployCost(card,host):
   PremiereWeapons.projector(card)?2:PremiereWeapons.seeker(card)?1:locationEffectRule(card)?.cost??activeCardRules(card,'device')[0]?.cost??0);
  const spies=undercoverSpies(side,slot).map(source=>source.card);
  return spies.length&&Number.isFinite(deploy)?[{entry,deploy,spies}]:[];
 });
}

function scannerSupport(side,mode){
 return (state.tableEffects??[]).flatMap(effect=>effect.target===side?
  activeCardRules(effect.card,'scannerSupport').filter(rule=>rule.mode===mode):[])[0];
}

function sensorPanelSources(side){
 return PremiereLocations.entries(state,side).flatMap(({card,unavailable})=>{
  const key='sensorPanel:'+(card.instanceId??card.id);
  return !unavailable&&activeCardRules(card,'sensorPanel').length&&!PremiereGame.wasUsed(state.game,'turn',key)?[key]:[];
 });
}

function releaseSpyRescueTarget(card){
 const entry=PremiereLocations.findEntry(state,card);
 if(!entry||!card.captured||!detachTableCard(entry.side,entry.slot,card))return false;
 (state.pendingCustody??=[]).push({side:'Light',card,slot:entry.slot});
 log(card.name+' wird am bisherigen Ort befreit.');
 return true;
}

function pileInterruptOptions(side){
 if((currentGame()?.cardRulesVersion??latestCardRulesVersion)<21||!state.game)return [];
 const own=PremiereGame.zones(state,side),rival=PremiereGame.zones(state,PremiereGame.otherSide(side));
 const choices=(own.hand??[]).flatMap((card,index)=>activeCardRules(card,'pileInterrupt').map(rule=>({card,index,rule})));
 if(!choices.length)return [];
 const entries=PremiereGame.sides.flatMap(actor=>PremiereLocations.entries(state,actor)).filter(entry=>!entry.unavailable&&PremiereUnits.active(entry.card));
 return choices.flatMap(({card,index,rule})=>{
  const {mode,cost}=rule,budget=forceBudget(side);
  if(cost>budget||activeCardRules(card,'sharedNamedInterruptLimit').length&&!namedInterruptAvailable(card))return [];
  switch(mode){
   case 'leaderKill':
    return state.attackRun?runSurvivors('Light').map((target,targetIndex)=>({card,rule,cost,target,args:[index,mode,targetIndex],label:card.name+' · '+target.name+' im Attack Run angreifen'})):[];
   case 'leaderWeapon':
    return entries.flatMap((entry,targetIndex)=>PremiereUnits.fighter(entry.card)?[{card,rule,cost,entry,args:[index,mode,targetIndex],label:card.name+' · '+entry.card.name+' Waffen-Destiny +1 bis Zugende'}]:[]);
   case 'controlFire':
    return state.activeSide===side&&state.phase===1?controlFireOptions(side,card,index,rule):[];
   case 'allClearRun':
    return state.attackRun&&side==='Light'?runSurvivors('Dark').flatMap((target,targetIndex)=>PremiereUnits.fighter(target)?[{card,rule,cost,target,args:[index,mode,targetIndex],label:card.name+' · '+target.name+' aus Trench entfernen (1 Force)'}]:[]):[];
   case 'captureShipCrew':
    return (state.capturedShips??[]).flatMap((record,targetIndex)=>{const targets=tractorShipCrew(record.ship),cost=typeof jpWrappedFree==='function'&&jpWrappedFree(card)?0:2*targets.length;return targets.length&&cost<=budget?[{card,rule,cost,record,targets,args:[index,mode,targetIndex],label:card.name+' · alle '+targets.length+' Characters für '+cost+' Force fangen'}]:[];});
   case 'evaderRevolutions':
    return Object.values(state.locationEffects??{}).some(row=>row.some(effect=>effect.card.id==='Light:2110'))?[{card,rule,cost,args:[index,mode],label:card.name+' · Alle Revolutions aufheben'}]:[];
   case 'roarSearch':
    return own.deck.length?[{card,rule,cost,args:[index,mode],label:card.name+' · Chewbacca im Reserve Deck suchen (3 Force)'}]:[];
   case 'roarMouse':
    return entries.flatMap((entry,targetIndex)=>entry.card.id==='Dark:1709'?[{card,rule,cost,entry,args:[index,mode,targetIndex],label:card.name+' · Mouse Droid verlieren lassen'}]:[]);
   case 'cancelBesieged':
    return (state.tableEffects??[]).flatMap((effect,targetIndex)=>effect.card.id==='Dark:223'?[{card,rule,cost,args:[index,mode,targetIndex],effect,label:card.name+' · Besieged aufheben'}]:[]);
   case 'escapeCapturedShip':
    return (state.capturedShips??[]).filter(record=>record.side===side).flatMap((record,targetIndex)=>state.locations.flatMap((loc,site)=>PremiereLocations.conditions(state,site,side).dockingBay?
     [{card,rule,cost,record,site,args:[index,mode,targetIndex,site],label:card.name+' · Besatzung zu '+loc.name+' befreien'}]:[]));
   case 'advancePrepare':
    return own.hand.flatMap((target,targetIndex)=>['Light:169','Light:2892','Light:681','Light:2050'].includes(target.id)?
     [{card,rule,cost,target,args:[index,mode,targetIndex],label:card.name+' · '+target.name+' aus dem Spiel nehmen und 1 Force zurückholen'}]:[]);
   case 'advanceRecover':
    return own.lost.some(target=>target.id==='Light:169')?[{card,rule,cost,args:[index,mode],label:card.name+' · Attack Run zurückholen (3 Force)'}]:[];
   case 'spySabotage':
    if(state.phase!==1||state.activeSide!==side)return [];
    return spySabotageTargets(side).flatMap(({entry,deploy,spies},targetIndex)=>spies.map((spy,spyIndex)=>({
     card,rule,cost,entry,deploy,spy,args:[index,mode,targetIndex,spyIndex],
     label:card.name+' · '+spy.name+' sabotiert '+entry.card.name+' (Deploy '+deploy+')',
    })));
   case 'spyRescue': {
    const site=state.locations.findIndex(loc=>loc&&locationTitle(loc)==='death star: detention block corridor');
    if(site<0)return [];
    const hostages=PremiereLocations.entries(state,'Dark').filter(entry=>entry.captive&&entry.slot===site&&
     entry.card.type==='Character'&&PremiereLocations.physicalPlace(entry)===site);
    return PremiereLocations.entries(state,side).filter(entry=>PremiereLocations.presentAt(entry,site)&&isSpyCharacter(entry.card))
     .flatMap(({card:spy},spyIndex)=>hostages.map((entry,targetIndex)=>({
      card,rule,cost,entry,spy,args:[index,mode,spyIndex,targetIndex],label:card.name+' · '+spy.name+' befreit '+entry.card.name,
     })));
   }
   case 'blueMilk':
    return PremiereGame.sides.flatMap((target,targetIndex)=>activationLocked(target)||!PremiereGame.reserveCards(PremiereGame.zones(state,target).deck).length?[]:
     [{card,rule,cost,targetSide:target,args:[index,mode,targetIndex],label:card.name+' · '+target+' aktiviert 1 Force'}]);
   case 'outOfCommissionRelease':
    if(state.phase!==1||state.activeSide!==side)return [];
    return (state.capturedShips??[]).flatMap((record,targetIndex)=>record.beam?.id==='Dark:667'&&state.locations.some(loc=>loc?.id==='Dark:669')?[]:
     [{card,rule,cost,record,args:[index,mode,targetIndex],label:card.name+' · '+record.ship.name+' freigeben (2 Force)'}]);
   case 'outOfCommissionRemove':
    return [{pile:rival.lost,label:'Gegnerische Lost Pile'},
     ...blasterRacks().filter(rack=>rack.target!==side).map(rack=>({pile:rack.weapons,label:rack.card.name}))]
     .flatMap(({pile,label},targetIndex)=>pile?.length?[{card,rule,cost,targetPile:pile,args:[index,mode,targetIndex],label:card.name+' · Zufallsziel aus '+label}]:[]);
   case 'trimHand':
    return rival.hand?.length>=13?[{card,rule,cost,args:[index,mode],label:card.name+' · Used: Gegner behält 8 zufällige Handkarten'}]:[];
   case 'revealDuplicates':
    return rival.hand?.length?[{card,rule,cost,args:[index,mode],label:card.name+' · Lost: Hand aufdecken und Duplikate verlieren lassen (4 Force)'}]:[];
   case 'retractBridge': {
    const sites=deathStarInteriorSites(),movable=sites.filter(site=>!isDockingBay327(state.locations[site]));
    const waived=controlledLocationRule(side,'freeNamedDeploy')?.rule.names.includes(locationTitle(card));
    const cost=waived?0:sites.length;
    return state.phase===2&&state.activeSide===side&&movable.length>1&&cost<=budget?[{
     card,rule,cost,sites:movable,args:[index,mode],label:card.name+' · Interior Sites neu anordnen ('+cost+' Force)',
    }]:[];
   }
   case 'droidAttrition':
    return entries.flatMap((entry,targetIndex)=>entry.side===side&&isDroid(entry.card)&&isSite(state.locations[entry.slot])&&
     PremiereLocations.presentAt(entry,entry.slot)&&(!battleSession||battleSession.site===entry.slot)&&!attritionPrevented(side,entry.slot)?[
      {card,rule,cost,entry,args:[index,mode,targetIndex],label:card.name+' · '+entry.card.name+' für die Attrition verlieren'},
     ]:[]);
   case 'localTrouble':
    return localTroubleOptions(side,card,index,rule);
   case 'onTheEdge':
    return entries.flatMap((entry,targetIndex)=>entry.card.type==='Character'&&entry.card.subType==='Rebel'&&cardAbility(entry.card)>2?
     [{card,rule,cost,entry,args:[index,mode,targetIndex],label:card.name+' · '+entry.card.name+' (1 Force)'}]:[]);
   case 'utinniSteal':
    return mouseEligibleEffects(true).flatMap(({effect,slot},i)=>PremiereLocations.presentCards(state,side,slot).some(unit=>matchesRegisteredTarget(unit,'jawa'))?
     [{card,rule,cost,effect,site:slot,args:[index,mode,i],label:card.name+' · '+effect.card.name+' auf die Hand nehmen'}]:[]);
   case 'scompPeek':
    if(!scompOperators(side,rule.actor).length)return [];
    return PremiereGame.sides.flatMap(pileSide=>PremiereGame.reserveCards(PremiereGame.zones(state,pileSide).deck).length?
     [{card,rule,cost,pileSide,args:[index,mode,pileSide],label:card.name+' · '+pileSide+' Reserve Deck ansehen'}]:[]);
   case 'handRefresh':
    return entries.flatMap((entry,targetIndex)=>{
     const loc=state.locations[entry.slot];
     return entry.side===side&&isDroid(entry.card)&&loc&&PremiereLocations.presentAt(entry,entry.slot)&&
      (locationTitle(loc)==='tatooine: dune sea'||PremiereLocations.conditions(state,entry.slot,side).scompLink)?
      [{card,rule,cost,entry,args:[index,mode,targetIndex],label:card.name+' · '+entry.card.name+' tauscht die Hand (1 Force)'}]:[];
    });
   case 'speederSale':
    return entries.flatMap((entry,targetIndex)=>{
     const loc=state.locations[entry.slot];
     if(entry.side!==side||!(entry.card.type==='Vehicle'||isDroid(entry.card))||!loc||!PremiereLocations.presentAt(entry,entry.slot)||
       (locationTitle(loc)!=='tatooine: mos eisley'&&!entries.some(other=>other.card.id==='Light:2811'&&
        PremiereLocations.presentAt(other,entry.slot))))return [];
     return [{card,rule,cost,entry,args:[index,mode,targetIndex],label:card.name+' · '+entry.card.name+' verkaufen'}];
    });
   case 'makerRetrieval':{
    const drained=state.drainLossTotals?.[side];
    return state.phase===1&&state.activeSide!==side&&own.lost.length&&drained?.turn===state.game.timing.turn&&drained.amount>=5&&
     entries.some(entry=>entry.side===side&&isDroid(entry.card))?[{card,rule,cost,args:[index,mode],label:card.name+' · Zufällige Karten zurückholen (1 Force)'}]:[];
   }
   case 'tonnikaConvert':
    return PremiereLocations.entries(state,PremiereGame.otherSide(side)).flatMap((entry,targetIndex)=>entry.card.id==='Dark:2613'&&
     isSite(state.locations[entry.slot])&&PremiereLocations.presentAt(entry,entry.slot)?
     [{card,rule,cost,entry,args:[index,mode,targetIndex],label:card.name+' · '+entry.card.name+' übernehmen'}]:[]);
   case 'setStun':
   case 'chokeTrooper':
   case 'nevar':
   case 'tallonRoll':
    return encounterInterruptTargets(side,card,index,rule);
   case 'reinforcements':
    return reinforcementsOutnumbered(side)?[{card,rule,cost,args:[index,mode],label:card.name+' · Verstärkung zurückholen (1 Force)'}]:[];
   case 'fullScaleAlert':
    return stormtroopersOnTable()>0?[{card,rule,cost,args:[index,mode],label:card.name+' · Gegnerische Bewegung blockieren (2 Force)'}]:[];
   case 'beruStew':
    if(PremiereGame.wasUsed(state.game,'turn',card.id))return [];
    if((state.game.cardRulesVersion??latestCardRulesVersion)<24&&!PremiereGame.sides.some(actor=>
     !activationLocked(actor)&&PremiereGame.reserveCards(PremiereGame.zones(state,actor).deck).length))return [];
    return [{card,rule,cost,args:[index,mode],label:card.name+' · Beide Seiten aktivieren Force'}];
   case 'doomed':
    return state.phase===1&&state.activeSide!==side&&lifeForceRemaining(side)<15&&state.doomedTurn!==state.game.timing.turn?
     [{card,rule,cost,args:[index,mode],label:card.name+' · Force-Verluste halbieren'}]:[];
   case 'trashCompactor':
    return state.locations.flatMap((location,site)=>location&&locationTitle(location)==='death star: trash compactor'&&
     trashCompactorContents(site).length?[{card,rule,cost,site,args:[index,mode,site],label:card.name+' · Trash Compactor schließen'}]:[]);
   case 'scanning':
   case 'radar':
    if(!rival.hand?.length||mode==='radar'&&!entries.some(entry=>entry.side===side&&['Vehicle','Starship'].includes(entry.card.type)))return [];
    break;
   case 'trinto':
    if(state.phase!==3||state.activeSide!==side||!rival.used?.length)return [];
    break;
   case 'scavengers':
   case 'findDroids':
    if(!rival.used?.length)return [];
    break;
   case 'cantinaBrawl':
   case 'collision':
   case 'deadJawa':
    return boardInterruptSites(side,card,index,rule,entries);
   case 'shipManeuvers':
    return entries.flatMap((entry,target)=>maneuverTarget(entry.card,rule)?
     [{card,rule,entry,cost,args:[index,mode,target],label:card.name+' · '+entry.card.name}]:[]);
   case 'shipManeuverPenalty':
    return entries.flatMap((entry,target)=>entry.side!==side&&maneuverTarget(entry.card,rule)?
     [{card,rule,entry,cost,args:[index,mode,target],label:card.name+' · '+entry.card.name+' erhält −1 Maneuver'}]:[]);
   case 'destroyDroid':
    return entries.flatMap((entry,target)=>{
     const value=entry.card.deploy;
     return isDroid(entry.card)&&!droidProtectedFrom(entry.card,side)&&Number.isFinite(value)&&value>=0&&value<=budget?
      [{card,rule,cost:value,entry,args:[index,mode,target],label:card.name+' · '+entry.card.name+' zerstören ('+value+' Force)'}]:[];
    });
  }
  const task={radar:'Gegnerische Hand ansehen',scanning:'Gegnerische Hand ansehen',trinto:'Used Pile nach Destiny prüfen',
   scavengers:'Used Pile nach Ausrüstung durchsuchen',findDroids:'Used Pile nach Droiden durchsuchen'}[mode];
  return [{card,rule,cost,args:[index,mode],label:card.name+' · '+task+' ('+cost+' Force)'}];
 });
}

function encounterInterruptTargets(side,card,index,rule){
 const opponent=PremiereGame.otherSide(side);
 const foes=PremiereLocations.entries(state,opponent);
 const label=entry=>card.name+' · '+entry.card.name+(rule.cost?' ('+rule.cost+' Force)':'');
 if(rule.mode==='tallonRoll'){
  return state.locations.flatMap((location,site)=>{
   if(!location||!isSystem(location)&&location.subType!=='Sector')return [];
   const ties=PremiereLocations.presentCards(state,side,site).filter(ship=>tieLn(ship)&&craftStats(ship,site).powered&&
    Number.isFinite(craftStats(ship,site).maneuver));
   const rebels=foes.filter(entry=>entry.slot===site&&!entry.unavailable&&
    PremiereLocations.physicalPlace(entry)===site&&PremiereUnits.fighter(entry.card)&&
    (characterTraits(entry.card).includes('rebel (starship)')||entry.card.side==='Light'&&!characterTraits(entry.card).includes('independent')));
   return ties.flatMap((ship,tieIndex)=>rebels.map((entry,targetIndex)=>({
    card,rule,site,entry,ship,cost:rule.cost,args:[index,rule.mode,site,tieIndex,targetIndex],
    label:card.name+' · '+ship.name+' gegen '+entry.card.name,
   })));
  });
 }
 return foes.flatMap((entry,targetIndex)=>{
  const target=entry.card;
  if(target.type!=='Character')return [];
  if(rule.mode==='nevar'){
   if(!isSite(state.locations[entry.slot])||!isSpyCharacter(target)&&!target.undercover||
      target.captured||target.missing||target.inactive||!PremiereLocations.entries(state,side).some(own=>
       own.slot===entry.slot&&!own.card.captured&&!own.card.missing&&!own.card.inactive&&
      (own.card.undercover||isSpyCharacter(own.card))&&(!rule.physical||PremiereLocations.presentAt(own,entry.slot)))||
      rule.physical&&!PremiereLocations.presentAt(entry,entry.slot))return [];
  }else if(entry.unavailable||!PremiereUnits.active(target)||
    rule.mode==='chokeTrooper'&&locationTitle(target)!=='rebel trooper')return [];
  return [{card,rule,cost:rule.cost,entry,args:[index,rule.mode,targetIndex],label:label(entry)}];
 });
}

function localTroubleOptions(side,card,index,rule){
 if(state.activeSide!==side||state.phase!==3||battleSession||state.battledSitesThisTurn?.length||
    state.localTroubleBlockedPhase===state.game.timing.phase)return [];
 const site=state.locations.findIndex(loc=>loc&&locationTitle(loc)==='tatooine: cantina');
 if(site<0)return [];
 const troopers=PremiereLocations.presentCards(state,side,site).filter(unit=>unit.type==='Character'&&PremiereUnits.active(unit)&&
   (characterTraits(unit).includes('stormtrooper')||locationTitle(unit)==='stormtrooper')&&!barredThisTurn(unit));
 const enemy=PremiereGame.otherSide(side),targets=PremiereLocations.presentCards(state,enemy,site).filter(unit=>
  unit.type==='Character'&&PremiereUnits.active(unit)&&!barredThisTurn(unit));
 return troopers.flatMap((first,a)=>troopers.slice(a+1).flatMap((second,b)=>targets.flatMap((target,t)=>[1,0].map(extra=>({
  card,rule,site,extra,cost:rule.cost,fighters:{[side]:[first,second],[enemy]:[target]},
  args:[index,rule.mode,a,a+1+b,t,extra],label:card.name+' · '+first.name+' und '+second.name+' gegen '+target.name+(extra?' (+1 Battle Destiny)':''),
 })))));
}

function attritionPrevented(side,site){
 return state.droidAttritionShields?.some(shield=>shield.side===side&&shield.site===site&&shield.turn===state.game.timing.turn)||hothEnabled()&&state.hothAttritionCancelled?.some(shield=>shield.side===side&&shield.site===site&&shield.turn===state.game.timing.turn);
}

function maneuverTarget(card,rule){
 return PremiereUnits.fighter(card)&&Number.isFinite(card.maneuver)&&(!rule.needsHyperdrive||Number.isFinite(card.hyperspeed));
}

function applyManeuverInterrupt(card,rule){
 const modifiers=(state.shipManeuvers??=new Map()),turn=state.game.timing.turn;
 const existing=(modifiers.get(card)??[]).filter(modifier=>modifier.turn===turn&&modifier.id!==rule.id);
 modifiers.set(card,[...existing,{...rule,turn}]);
}

function boardInterruptSites(side,card,index,rule,entries){
 const opponent=PremiereGame.otherSide(side);
 return state.locations.flatMap((location,site)=>{
  if(!location)return [];
  let targets=[];
  if(rule.mode==='cantinaBrawl'){
   if(locationTitle(location)!=='tatooine: cantina')return [];
  }else if(rule.mode==='collision'){
   if(!isSystem(location)&&location.subType!=='Sector')return [];
   targets=entries.filter(entry=>entry.slot===site&&entry.side===opponent&&entry.card.type==='Starship'&&
    PremiereLocations.physicalPlace(entry)===site);
   if(targets.length<2)return [];
  }else{
   if(!isSite(location))return [];
   const present=entries.filter(entry=>entry.slot===site&&PremiereLocations.physicalPlace(entry)===site);
   if(present.filter(entry=>entry.card.type==='Character'&&(characterTraits(entry.card).includes('stormtrooper')||
      locationTitle(entry.card)==='stormtrooper')).length<2)return [];
   targets=present.filter(entry=>entry.side===opponent&&matchesRegisteredTarget(entry.card,'jawa'));
   if(!targets.length)return [];
  }
  return [{card,rule,site,targets,cost:rule.cost,args:[index,rule.mode,site],
   label:card.name+' · '+location.name+' ('+rule.cost+' Force)'}];
 });
}

function playPileInterrupt(side,...args){
 const option=pileInterruptOptions(side).find(choice=>choice.args.length===args.length&&choice.args.every((value,i)=>value===args[i]));
 if(!option)return false;
 if(option.rule.mode==='onTheEdge'){
  state.pendingCardView={mode:'onTheEdgeNumber',side,card:option.card,option,shown:[]};
  return true;
 }
 if(option.rule.mode==='deadJawa'){
  state.pendingCardView={mode:'deadJawaTarget',side,card:option.card,shown:option.targets.map(entry=>entry.card),
   option,selected:[],publicView:true};
  return true;
 }
 return announcePileInterrupt(side,option);
}

function announcePileInterrupt(side,option){
 const own=PremiereGame.zones(state,side);
 own.hand.splice(option.args[0],1);
 if(activeCardRules(option.card,'sharedNamedInterruptLimit').length)recordNamedInterruptUse(option.card);
 if(option.rule.mode==='beruStew')PremiereGame.useOnce(state.game,'turn',option.card.id);
 spendForce(side,option.cost);
 const frame={...option,kind:'interrupt',interrupt:'pileInterrupt',side,duringBattle:!!battleSession,felthUsed:felthMakesUsed(option.card)};
 log(side+' spielt '+option.label+'.');
 if(hasInterruptResponse(frame))PremiereGame.openResponse(state.game,frame);
 else settlePileInterrupt(frame);
 return true;
}

function finishPileInterrupt(frame){
 if(hothEnabled()&&frame.interrupt==='hoth')state.hothResolvingInterrupts=(state.hothResolvingInterrupts??[]).filter(item=>item.card!==frame.card);
 const own=PremiereGame.zones(state,frame.side);
 if(!frame.cloudCityScanLost){if(frame.cancelled||frame.rule.pile==='Lost'&&!frame.felthUsed)loseOwnedCard(frame.card,frame.side);
 else own.used.push(frame.card);}
 if(frame.duringBattle&&battleSession?.weaponTurn===frame.side)finishWeaponAction(frame.side,false);
 frame.resumeAttack?.();
}

function settlePileInterrupt(frame){
 if(frame.cancelled){finishPileInterrupt(frame);return;}
 const {side,card,rule:{mode},entry}=frame,opponent=PremiereGame.otherSide(side);
 const rival=PremiereGame.zones(state,opponent);
 const view={side,card,opponent,interruptFrame:frame,shown:[]};
 switch(mode){
  case 'leaderWeapon':frame.entry.card.leaderWeaponTurn=state.game.timing.turn;finishPileInterrupt(frame);return;
  case 'leaderKill':{
   const run=state.attackRun,ships=runSurvivors('Dark'),bonus=ships.reduce((sum,ship)=>sum+(/^Squadron/.test(ship.subType)?3:1),0);
   drawDestinySeries(side,'interrupt',1,bonus,draws=>{
    const entry=PremiereLocations.findEntry(state,frame.target);let abort=false;
    if(entry&&draws[0]?.value>craftStats(entry.card,entry.slot).maneuver){abort=entry.card===run.lead;loseTableCard(entry.side,entry.slot,entry.card);}
    finishPileInterrupt(frame);if(abort)pullUpAttackRun(false);
   });return;
  }
  case 'controlFire':
   if(forceBudget(side)<frame.shot.cost){finishPileInterrupt(frame);return;}
   fireImmediateWeapon(side,frame.shot,()=>finishPileInterrupt(frame));return;
  case 'allClearRun':{
   const run=state.attackRun,entry=PremiereLocations.findEntry(state,frame.target);
   if(run&&entry?.slot===run.site){detachTableCard(entry.side,entry.slot,entry.card);state.dark[run.system].push(entry.card);
    if((run.lead.occupants??[]).some(({card,role})=>role==='pilot'&&PremiereUnits.active(card)&&PremiereUnits.matchingPilot(run.lead,card,true)))run.bonus++;
   }
   finishPileInterrupt(frame);return;
  }
  case 'captureShipCrew':
   for(const target of frame.targets)captureCharacter(target,frame.record.bay);finishPileInterrupt(frame);return;
  case 'evaderRevolutions':{
   const tally={Light:0,Dark:0};
   for(const [site,row] of Object.entries(state.locationEffects??{}))for(const effect of row.slice())if(effect.card.id==='Light:2110'){tally[effect.card.owner??effect.card.side]++;cancelLocationEffect(Number(site),effect);}
   finishPileInterrupt(frame);
   loseForceInOrder(PremiereGame.sides.map(payer=>({payer,amount:tally[payer],reason:'Evader'})));return;
  }
  case 'roarMouse':loseEncounterTarget(frame);finishPileInterrupt(frame);return;
  case 'roarSearch':state.pendingReserveSearch={...frame,names:['chewbacca']};return;
  case 'holoCancel':{const entry=PremiereLocations.findEntry(state,frame.target);if(entry)loseTableCard(entry.side,entry.slot,entry.card);finishPileInterrupt(frame);return;}
  case 'cancelBesieged':cancelTableEffect(frame.effect);finishPileInterrupt(frame);return;
  case 'escapeCapturedShip':{
   const {record,site}=frame;
   const entries=PremiereLocations.entries(state,side).filter(entry=>entry.card.type==='Character'&&entry.carriers.includes(record.ship));
   for(const entry of entries)if(detachTableCard(side,entry.slot,entry.card))PremiereGame.zones(state,side).board[site].push(entry.card);
   finishPileInterrupt(frame);return;
  }
  case 'advancePrepare':{
   const own=PremiereGame.zones(state,side),index=own.hand.indexOf(frame.target);
   if(index>=0)(state.outOfPlay??=[]).push(own.hand.splice(index,1)[0]);
   PremiereGame.retrieveForce(state,side,1);
   finishPileInterrupt(frame);return;
  }
  case 'advanceRecover':{
   const own=PremiereGame.zones(state,side),index=own.lost.findIndex(target=>target.id==='Light:169');
   if(index>=0)PremiereGame.retrieveCard(state,side,index);
   finishPileInterrupt(frame);return;
  }
  case 'spySabotage':
   drawDestinySeries(side,'interrupt',1,0,draws=>{
    const value=draws.find(draw=>!draw.cancelled)?.value;
    if(!Number.isFinite(value)||value<=frame.deploy){finishPileInterrupt(frame);return;}
    if((characterTraits(frame.spy).includes('thief')||spyThiefTraining(frame.spy))&&spyCanSteal(side,entry)){
     state.pendingCardView={...view,mode:'spySabotage',shown:[entry.card],publicView:true};
     return;
    }
    if(entry.effect)cancelLocationEffect(entry.slot,entry.effect);
    else loseTableCard(entry.side,entry.slot,entry.card);
    finishPileInterrupt(frame);
   });
   return;
  case 'informantReact':
   state.pendingCardView={...view,mode:'informantReact',site:frame.site};
   return;
  case 'spyRescue':
   drawDestinySeries(side,'interrupt',1,0,draws=>{
    const value=draws.find(draw=>!draw.cancelled)?.value,ability=cardAbility(frame.spy);
    if(Number.isFinite(value)&&Number.isFinite(ability)&&value+ability>cardAbility(entry.card))releaseSpyRescueTarget(entry.card);
    else captureCharacter(frame.spy,entry.slot);
    finishPileInterrupt(frame);
   });
   return;
  case 'blueMilk':
   activateReserve(frame.targetSide,1);
   finishPileInterrupt(frame);
   return;
  case 'outOfCommissionRelease':
   state.pendingCardView={...view,mode:'tractorRelease',record:frame.record,card:frame.record.ship,side:frame.record.side};
   return;
  case 'outOfCommissionRemove': {
   const pile=frame.targetPile;
   const target=PremiereGame.shuffle(pile,state.game)[0];
   if(target){
    pile.splice(pile.indexOf(target),1);
    (state.outOfPlay??=[]).push(target);
    log(target.name+' wird aus dem Spiel genommen.');
   }
   finishPileInterrupt(frame);
   return;
  }
  case 'trimHand': {
   const removed=new Set(PremiereGame.shuffle(rival.hand,state.game).slice(8));
   rival.hand.splice(0,rival.hand.length,...rival.hand.filter(item=>!removed.has(item)));
   rival.used.push(...removed);
   log(opponent+' legt '+removed.size+' zufällig ausgewählte Handkarten verdeckt in die Used Pile.');
   finishPileInterrupt(frame);
   return;
  }
  case 'revealDuplicates': {
   log(opponent+' deckt die Hand auf: '+rival.hand.map(item=>item.name).join(', ')+'.');
   const counts=new Map();
   for(const item of rival.hand){
    const title=locationTitle(item);
    counts.set(title,(counts.get(title)??0)+1);
   }
   const remaining=[];
   for(const item of rival.hand){
    if(counts.get(locationTitle(item))>1)loseOwnedCard(item,opponent);
    else remaining.push(item);
   }
   const lost=rival.hand.length-remaining.length;
   rival.hand.splice(0,rival.hand.length,...remaining);
   log(opponent+' verliert '+lost+' Handkarten mit mehrfach vorhandenem Titel.');
   finishPileInterrupt(frame);
   return;
  }
  case 'retractBridge':
   state.pendingCardView={...view,mode:'bridgeOrder',sites:frame.sites.slice(),order:[]};
   return;
  case 'droidAttrition':{
   loseEncounterTarget(frame);
   const shields=state.droidAttritionShields??=[];
   shields.push({side,site:entry.slot,turn:state.game.timing.turn});
   if(battleSession?.damage?.debt[side])battleSession.damage.debt[side].attrition=0;
   finishPileInterrupt(frame);
   return;
  }
  case 'localTrouble':
   finishPileInterrupt(frame);
   initiateBattleFor(side,frame.site,frame.fighters,frame.extra);
   return;
  case 'onTheEdge':
   drawDestinySeries(side,'interrupt',1,0,draws=>{
    const value=draws.find(draw=>!draw.cancelled)?.value;
    if(Number.isFinite(value)&&value>frame.wager){
     state.pendingCardView={...view,mode:'optionalRetrieval',amount:frame.wager};
     return;
    }
    loseEncounterTarget(frame);
    finishPileInterrupt(frame);
   });
   return;
  case 'utinniSteal':{
   const row=state.locationEffects[frame.site],index=row.indexOf(frame.effect);
   if(index>=0){
    const [effect]=row.splice(index,1);
    effect.card.owner=side;
    effect.card.controller=side;
    PremiereGame.zones(state,side).hand.push(effect.card);
   }
   finishPileInterrupt(frame);
   return;
  }
  case 'scompPeek':{
   const {deck}=PremiereGame.zones(state,frame.pileSide);
   state.pendingCardView={...view,mode:'scompPeek',shown:PremiereGame.reserveCards(deck).slice().reverse(),expiresAt:Date.now()+20000};
   return;
  }
  case 'handRefresh':{
   const own=PremiereGame.zones(state,side),count=own.hand.length+Number(entry.card.id==='Light:343'||isArtoo(entry.card));
   own.used.push(...own.hand.splice(0));
   for(let i=0;i<count;i++){
    revealReserveInserts(side);
    if(!own.deck.length)break;
    PremiereGame.moveTop(own.deck,own.hand);
   }
   revealReserveInserts(side);
   finishPileInterrupt(frame);
   return;
  }
  case 'speederSale':
   drawDestinySeries(side,'interrupt',locationTitle(entry.card)==="luke's x-34 landspeeder"?3:2,0,draws=>{
    const value=PremiereBattle.total(draws);
    if(Number.isFinite(value)&&value>0)activateReserve(side,value);
    loseTableCard(entry.side,entry.slot,entry.card);
    finishPileInterrupt(frame);
   });
   return;
  case 'makerRetrieval':
   drawDestinySeries(side,'interrupt',1,0,draws=>{
    retrieveRandomLost(side,draws.find(draw=>!draw.cancelled)?.value??0,card.name);
    finishPileInterrupt(frame);
   });
   return;
  case 'chokeTrooper':
   loseEncounterTarget(frame);
   finishPileInterrupt(frame);
   return;
   case 'tonnikaConvert':
    changeCharacterAllegiance(entry,side);
    finishPileInterrupt(frame);
    return;
   case 'setStun':
  case 'nevar':
   drawDestinySeries(side,'interrupt',1,0,draws=>{
    const value=draws.find(draw=>!draw.cancelled)?.value,target=entry.card;
    if(Number.isFinite(value)){
     if(mode==='setStun'&&value>cardAbility(target))returnStunnedCharacter(entry);
     if(mode==='nevar'&&value+(target.undercover?2:0)>2)loseEncounterTarget(frame);
    }
    finishPileInterrupt(frame);
   });
   return;
  case 'tallonRoll':
   settleTallonRoll(frame);
   return;
  case 'reinforcements':
   drawDestinySeries(side,'interrupt',1,0,draws=>{
    const destiny=draws.find(draw=>!draw.cancelled)?.value??0,targets=reinforcementTargets(frame);
    if(destiny>0&&targets.length){
     state.pendingCardView={...view,mode:'reinforcements',remaining:Math.min(destiny,targets.length)};
     return;
    }
    finishPileInterrupt(frame);
   });
   return;
  case 'fullScaleAlert':
   drawDestinySeries(side,'interrupt',1,0,draws=>{
    const draw=draws.find(item=>!item.cancelled),count=stormtroopersOnTable();
    if(Number.isFinite(draw?.value)&&draw.value<count){
     state.fullScaleAlert={target:opponent,turn:state.game.timing.turn};
     log(card.name+' blockiert gegnerische Bewegung bis Zugende.');
    }else log(card.name+' · zu wenige Stormtroopers für die gezogene Destiny.');
    finishPileInterrupt(frame);
   });
   return;
  case 'beruStew':
   state.pendingCardView={...view,mode:'beruOrder',side:state.activeSide,publicView:true};
   return;
  case 'doomed':
   state.doomedTurn=state.game.timing.turn;
   finishPileInterrupt(frame);
   return;
  case 'trashCompactor':
   for(const target of trashCompactorContents(frame.site).reverse()){
    if(target.effect)cancelLocationEffect(frame.site,target.effect);
    else if(target.captive&&loseCrushedCaptive(target.card,frame.site))log(target.card.name+' wird im Trash Compactor verloren.');
    else if(loseTableCard(target.side,frame.site,target.card))log(target.card.name+' wird im Trash Compactor verloren.');
   }
   finishPileInterrupt(frame);
   return;
  case 'shipManeuvers':
   applyManeuverInterrupt(entry.card,{id:card.id,power:frame.rule.power});
   finishPileInterrupt(frame);
   return;
  case 'shipManeuverPenalty':
   applyManeuverInterrupt(entry.card,{id:card.id,power:0,maneuver:-1,hyperspeed:0});
   finishPileInterrupt(frame);
   return;
  case 'scanning':
  case 'radar': {
   const support=scannerSupport(side,mode);
   state.pendingCardView={...view,mode,shown:rival.hand.slice(),publicView:true,
    scannerPenalty:!!support&&rival.hand.length>=support.limit,scanningMoveUsed:false};
   log(opponent+' deckt die Hand auf · '+rival.hand.map(card=>card.name).join(', ')+'.');
   return;
  }
  case 'destroyDroid':
   if(loseTableCard(entry.side,entry.slot,entry.card))log(entry.card.name+' geht verloren.');
   finishPileInterrupt(frame);
   return;
  case 'findDroids':
   state.pendingCardView={...view,mode:'usedSearch',shown:rival.used.slice().reverse(),matches:rival.used.filter(isDroid)};
   return;
  case 'cantinaBrawl': {
   drawDestinySeries(side,'interrupt',1,0,ownDraws=>drawDestinySeries(opponent,'interrupt',1,0,rivalDraws=>{
    const matches=new Set([...ownDraws,...rivalDraws].filter(draw=>!draw.cancelled&&Number.isFinite(draw.value)).map(draw=>draw.value));
    for(const actor of PremiereGame.sides)for(const entry of PremiereLocations.entries(state,actor)){
     if(entry.slot===frame.site&&entry.card.type==='Character'&&!isDroid(entry.card)&&matches.has(cardAbility(entry.card)))
      loseTableCard(actor,entry.slot,entry.card);
    }
    finishPileInterrupt(frame);
   }));
   return;
  }
 }
 drawDestinySeries(side,'interrupt',1,0,draws=>{
  const draw=draws.find(result=>!result.cancelled),destiny=draw?.value;
  if(['collision','accident','deadJawa'].includes(mode)){
   const targets=frame.targets.filter(entry=>PremiereLocations.findEntry(state,entry.card)?.slot===entry.slot);
   if(Number.isFinite(destiny)&&targets.length&&(mode==='deadJawa'?destiny>targets.length:destiny<targets.length)){
    if(mode==='deadJawa')for(const entry of targets)loseTableCard(entry.side,entry.slot,entry.card);
    else{
     state.pendingCardView={...view,mode:'tableLossChoice',side:mode==='accident'&&targets.some(entry=>activeCardRules(entry.card,'felth').length)?side:opponent,targets,shown:targets.map(entry=>entry.card),publicView:true};
     return;
    }
   }
   finishPileInterrupt(frame);
   return;
  }
  if(mode==='scavengers'){
   const tuskens=PremiereGame.sides.flatMap(actor=>PremiereLocations.activeCards(state,actor))
    .filter(unit=>matchesRegisteredTarget(unit,'tusken')&&PremiereUnits.active(unit)).length;
   if(Number.isFinite(destiny)&&destiny<tuskens){state.pendingCardView={...view,mode:'scavenge'};return;}
   log(card.name+' findet keine Ausrüstung · Destiny '+(destiny??'–')+' bei '+tuskens+' Tusken Raiders.');
   finishPileInterrupt(frame);
  }else startUsedPileLoss(view,Number.isFinite(destiny)?rival.used.filter(unit=>printedBattleDestiny(unit)===destiny):[]);
 });
}

function retrieveRandomLost(side,count,source){
 const {lost}=PremiereGame.zones(state,side);
 while(count-->0&&lost.length){
  PremiereGame.retrieveCard(state,side,Math.floor(PremiereGame.random(state.game)*lost.length));
  log(side+' holt mit '+source+' eine zufällig bestimmte Karte zurück.');
 }
}

function loseEncounterTarget(frame){
 const {entry,card}=frame;
 if(loseTableCard(entry.side,entry.slot,entry.card))log(card.name+' · '+entry.card.name+' geht verloren.');
}

function returnStunnedCharacter(entry){
 const {card,slot,side}=entry;
 if(!detachTableCard(side,slot,card))return;
 if(card.escortedCaptive){
  const captive=card.escortedCaptive;
  delete card.escortedCaptive;
  (state.pendingCustody??=[]).push({side:'Light',card:captive,slot});
 }
 PremiereUnits.remove(card,unit=>{
  if(unit.type==='Effect'&&state.tableEffects)state.tableEffects=state.tableEffects.filter(effect=>effect.card!==unit);
  PremiereGame.zones(state,unit.owner??unit.side??side).hand.push(unit);
 },unit=>PremiereGame.zones(state,unit.owner??unit.side??side).hand.push(unit));
 log('Set For Stun bringt '+card.name+' samt Ausrüstung auf die Hände der jeweiligen Eigentümer zurück.');
}

function settleTallonRoll(frame){
 const {side,site,ship,entry}=frame,other=PremiereGame.otherSide(side);
 drawDestinySeries(side,'tallonRoll',1,0,ownDraws=>drawDestinySeries(other,'tallonRoll',1,0,opposingDraws=>{
  const a=ownDraws.find(draw=>!draw.cancelled)?.value,b=opposingDraws.find(draw=>!draw.cancelled)?.value;
  const own=craftStats(ship,site),rival=craftStats(entry.card,site);
  const left=Number.isFinite(a)?a+own.power+own.maneuver:-Infinity;
  const right=Number.isFinite(b)?b+rival.power+(frame.slip?Math.max(0,rival.maneuver??0)+frame.slip.ability:0):-Infinity;
  if(left<right)loseTableCard(side,site,ship);
  if(right<left)loseEncounterTarget(frame);
  log(frame.card.name+' · '+(Number.isFinite(left)?left:'–')+' gegen '+(Number.isFinite(right)?right:'–')+'.');
  finishPileInterrupt(frame);
 }));
}

function reinforcementsOutnumbered(side){
 const count=actor=>PremiereLocations.activeCards(state,actor).filter(card=>['Character','Starship'].includes(card.type)).length;
 return count(PremiereGame.otherSide(side))>count(side);
}

function tieLn(card){
 return card.type==='Starship'&&(['Dark:2600','Dark:247','Dark:249','Dark:250'].includes(card.id)||/\btie\/ln\b/i.test(card.lore??''));
}

function reinforcementTargets({side}){
 const {lost}=PremiereGame.zones(state,side);
 return (lost??[]).filter(card=>side==='Light'?['rebel trooper','y-wing'].includes(locationTitle(card)):
  tieLn(card)||card.type==='Character'&&(characterTraits(card).includes('stormtrooper')||locationTitle(card)==='stormtrooper'));
}

function emergencyResponses(side,window){
 const power=window.powerAtInitiation;
 if(window.kind!=='battle'||side===window.side||!power)return [];
 const defeats=side==='Light'?power.darkPower>2*power.lightPower:power.lightPower>2*power.darkPower;
 const {deck,hand}=PremiereGame.zones(state,side),available=PremiereGame.reserveCards(deck).length;
 if(!defeats||!available)return [];
 return (hand??[]).flatMap((card,index)=>activeCardRules(card,'emergencyDeployment').flatMap(rule=>{
  const count=(deck??[]).some(PremiereGame.isReserveInsert)?rule.limit:Math.min(rule.limit,available);
  return Array.from({length:count},(_,offset)=>({
   kind:'emergencyDeployment',args:[index,'emergency',count-offset],index,card,count:count-offset,
   label:card.name+' · '+(count-offset)+' Reserve-Karte(n) aufdecken',
  }));
 }));
}

function revealEmergencyCards(frame){
 const {deck}=PremiereGame.zones(state,frame.side),shown=[];
 for(let i=0;i<frame.count;i++){
  revealReserveInserts(frame.side);
  if(deck.length)shown.push(deck.pop());
 }
 revealReserveInserts(frame.side);
 if(!shown.length){PremiereGame.zones(state,frame.side).used.push(frame.card);return;}
 log(frame.card.name+' deckt '+shown.map(card=>card.name).join(', ')+' auf.');
 state.pendingCardView={side:frame.side,mode:'emergencyDeploy',card:frame.card,shown,publicView:true};
}

function emergencyPlacements(side,card,revealed){
 if(!['Character','Starship','Vehicle','Device','Weapon'].includes(card.type)||!withinDeploymentLimit(card,side))return [];
 const options=[];
 if(card.type==='Weapon'){
  for(const {mount} of weaponPlacementOptions(side,card,undefined,true))options.push({kind:'weapon',mount,slot:mount.slot,host:mount.host});
  for(const {slot} of automatedPlacementOptions(side,card))options.push({kind:'automated',slot});
 }else if(card.type==='Device'){
  for(const mount of devicePlacementOptions(side,card))options.push({kind:'device',slot:mount.slot,host:mount.host});
  if(activeCardRules(card,'restrainDroid').length)for(const entry of siteDroids()){
   if(!PremiereUnits.restrainingBolt(entry.card))options.push({kind:'device',slot:entry.slot,host:entry.card});
  }
  for(const rule of activeCardRules(card,'locationEffect').filter(rule=>rule.siteDevice)){
   for(const [slot,loc] of state.locations.entries()){
    if(loc&&isSite(loc)&&(!rule.requiredTag||loc.locationTags?.includes(rule.requiredTag))&&
       (!rule.deployRegion||sitePlanet(loc)===rule.deployRegion))options.push({kind:'siteDevice',slot});
   }
  }
 }else{
  for(const [slot,loc] of state.locations.entries()){
   const cost=boardDeployCost(card,loc,side,true);
   if(cost!==null)options.push({kind:'board',slot});
   if(!loc||card.type!=='Starship'||permanentPilotAbility(card)!==null||!hasDeployPresence(side,loc))continue;
   for(const pilot of revealed){
    if(pilot!==card&&isDeployableCharacter(pilot)&&withinDeploymentLimit(pilot,side)&&craftDeployCost(card,loc,side,pilot)!==null)
     options.push({kind:'board',slot,pilot});
   }
  }
  if(isDeployableCharacter(card)&&!jawaCosts.has(card.id)&&!activeCardRules(card,'deployUndercover').length)for(const {host,slot} of weaponMounts(side)){
   if(!hasDeployPresence(side,state.locations[slot])||!characterLocationAllowed(card,state.locations[slot]))continue;
   for(const role of PremiereUnits.roles(host,card).filter(role=>['pilot','passenger','astromech'].includes(role))){
    options.push({kind:'crew',slot,host,role});
   }
  }
 }
 return options;
}

function emergencyChoices(frame){
 return [...frame.shown.flatMap((card,index)=>emergencyPlacements(frame.side,card,frame.shown).map((destination,destinationIndex)=>({
  args:['deploy',index,destinationIndex],card,destination,
  label:card.name+' · '+(destination.host?.name??state.locations[destination.slot].name)+
   (destination.role?' als '+destination.role:'')+(destination.pilot?' mit '+destination.pilot.name:'')+' (0 Force)',
 }))),{args:['done'],label:'Deploy abschließen und übrige Karten verlieren'}];
}

function finishEmergencyDeployment(frame,args){
 const {side,shown}=frame;
 const {used,board}=PremiereGame.zones(state,side);
 if(args[0]==='done'){
  for(const card of shown)loseOwnedCard(card,side,'lifeForce');
  state.pendingCardView=null;
  used.push(frame.card);
  return true;
 }
 const option=emergencyChoices(frame).find(choice=>choice.args.every((arg,index)=>arg===args[index]));
 if(!option)return false;
 const {card,destination}=option,{kind,slot,host,pilot}=destination;
 shown.splice(shown.indexOf(card),1);
 if(pilot)shown.splice(shown.indexOf(pilot),1);
 if(kind==='weapon')attachWeapon(destination.mount,card);
 else if(kind==='device')(host.attachments??=[]).push(card);
 else if(kind==='siteDevice')placeLocationEffect({card,site:slot});
 else if(kind==='automated')placeAutomatedWeapon(side,card,slot);
 else{
  if(kind==='crew')PremiereUnits.add(host,card,destination.role,side);
  else{
   card.controller=side;
   if(pilot)PremiereUnits.add(card,pilot,'pilot',side);
   board[slot].push(card);
   if(activeCardRules(card,'deployUndercover').length)setUndercover(card,side);
   if(jawaCosts.has(card.id)){
    const opposition=jawaDeployPayment(card,state.locations[slot],side)?.opposing;
    if(opposition)payOpposingJawaCost(side,opposition);
   }
  }
  (state.deployedThisTurn??=[]).push(...[card,pilot].filter(Boolean));
  openDeploymentReaction(side,[card,pilot].filter(Boolean));
 }
 log(side+' spielt '+card.name+' bei '+state.locations[slot].name+' für 0 Force aus.');
 if(!shown.length){state.pendingCardView=null;used.push(frame.card);}
 else if(PremiereGame.responseWindow(state.game)?.kind==='deployment'){
  PremiereGame.responseWindow(state.game).resumeEmergency=frame;
  state.pendingCardView=null;
 }
 return true;
}

function stormtroopersOnTable(){
 return PremiereGame.sides.flatMap(side=>PremiereLocations.activeCards(state,side)).filter(card=>
  card.type==='Character'&&(characterTraits(card).includes('stormtrooper')||locationTitle(card)==='stormtrooper')).length;
}

function trashCompactorContents(slot){
 const types=['Character','Vehicle','Starship','Weapon','Device'];
 return allWeaponEntries().filter(entry=>entry.slot===slot&&types.includes(entry.card.type)&&!entry.card.imprisoned)
  .concat((state.locationWeapons?.[slot]??[]).map(card=>({card,side:card.side})),
   PremiereLocations.effectsAt(state,slot).filter(effect=>types.includes(effect.card.type)).map(effect=>({effect})));
}

function loseCrushedCaptive(card,slot){
 const escort=PremiereLocations.entries(state,'Dark').find(entry=>entry.slot===slot&&entry.card.escortedCaptive===card);
 if(!escort)return false;
 delete escort.card.escortedCaptive;
 clearCaptivity(card);
 PremiereUnits.remove(card,unit=>loseOwnedCard(unit,'Light'),unit=>loseOwnedCard(unit,'Light'));
 return true;
}

function beruActivationBonus(){
 const lights=['Light:221','Light:1883','Light:1196'];
 return PremiereGame.sides.flatMap(actor=>PremiereLocations.activeCards(state,actor)).filter(card=>lights.includes(card.id)).length+
  Object.values(state.locationEffects??{}).flat().filter(({card})=>card.id==='Light:1196').length;
}

function startUsedPileLoss(view,matches){
 const {opponent,interruptFrame}=view;
 const covered=PremiereGame.lostPileFaceDown(state,opponent);
 if(covered&&matches.length)log(opponent+' verliert '+matches.length+' verdeckte Karte(n) aus der Used Pile.');
 else for(const card of matches)log(card.name+' aus der Used Pile von '+opponent+' wird verloren.');
 if(matches.length>1){
  state.pendingCardView={...view,mode:'usedLossOrder',side:opponent,shown:covered?[]:matches,matches,
   publicView:!covered,covered,order:[]};
  return;
 }
 if(matches.length===1)moveUsedPileLosses(opponent,matches);
 state.pendingCardView=null;
 finishPileInterrupt(interruptFrame);
}

function groupRelocationOptions(side){
 if(!state.game||battleSession)return [];
 const {hand}=PremiereGame.zones(state,side);
 if(!(hand??[]).some(card=>activeCardRules(card,'groupRelocation').length))return [];
 const sites=state.locations.flatMap((location,slot)=>location&&isSite(location)?[slot]:[]);
 if(sites.length<2)return [];
 const figures=PremiereLocations.entries(state,side).filter(({card,slot,unavailable})=>sites.includes(slot)&&
  !unavailable&&card.type==='Character'&&PremiereUnits.active(card)&&!movementPrevented(card));
 return hand.flatMap((card,index)=>activeCardRules(card,'groupRelocation').flatMap(()=>sites.flatMap(site=>{
  const targets=figures.filter(entry=>entry.slot===site);
  return targets.length?[{args:[index,site],card,targets,site,destinations:sites.filter(slot=>slot!==site),
   label:card.name+' · Charaktere bei '+state.locations[site].name+' verlegen'}]:[];
 })));
}

function beginGroupRelocation(side,index,site){
 const option=groupRelocationOptions(side).find(choice=>choice.args[0]===index&&choice.site===site);
 if(!option)return false;
 state.pendingCardView={...option,side,mode:'relocateGroup',shown:[],selected:[]};
 return true;
}

function initiateGroupRelocation(frame,destination){
 const {side,card,selected}=frame,targets=selected.map(index=>frame.targets[index]);
 const {hand,force}=PremiereGame.zones(state,side);
 state.pendingCardView=null;
 hand.splice(hand.indexOf(card),1);
 state.game.rootAction=side;
 drawDestinySeries(side,'interrupt',1,0,draws=>{
  const baseCost=draws.find(draw=>!draw.cancelled)?.value;
  const cost=baseCost===undefined?undefined:baseCost+(baseCost?musicianCoverCharge(state.locations[destination]):0);
  if(!Number.isInteger(cost)||cost>force.length){
   loseOwnedCard(card,side);
   log(card.name+' · Kosten konnten nicht bezahlt werden.');
   return;
  }
  state.pendingCardView={side,mode:'relocationCost',card,targets,destination,cost,shown:[]};
 });
 return true;
}

function relocateCharacter(side,target,to){
 const entry=PremiereLocations.findEntry(state,target.card??target);
 if(!entry||entry.side!==side||entry.unavailable||movementPrevented(entry.card)||!detachTableCard(side,entry.slot,entry.card))return false;
 PremiereGame.zones(state,side).board[to].push(entry.card);
 log(entry.card.name+' wechselt zu '+state.locations[to].name+'.');
 return true;
}

function finishGroupRelocation(frame){
 for(const target of frame.targets)relocateCharacter(frame.side,target,frame.destination);
 PremiereGame.zones(state,frame.side).used.push(frame.card);
 queueRuleResponse({kind:'transportCompleted',side:frame.side,card:frame.card,site:frame.destination,targets:frame.targets.map(target=>target.card??target)});
}

function moveUsedPileLosses(side,order){
 const {used}=PremiereGame.zones(state,side);
 for(const card of order){
  const index=used.indexOf(card);
  if(index>=0)loseOwnedCard(used.splice(index,1)[0],side,'lifeForce');
 }
}

function cardInformationOptions(side){
 if((currentGame()?.cardRulesVersion??latestCardRulesVersion)<20||!state.game)return [];
 const opponent=PremiereGame.otherSide(side),own=PremiereGame.zones(state,side),opposing=PremiereGame.zones(state,opponent);
 const cards=PremiereGame.sides.flatMap(actor=>PremiereLocations.entries(state,actor))
  .filter(entry=>!entry.unavailable&&PremiereUnits.active(entry.card)&&(entry.card.owner??entry.card.side??entry.side)===side)
  .map(entry=>entry.card);
 for(const effect of state.tableEffects??[])if(effect.card.side===side&&!effect.host)cards.push(effect.card);
 return cards.flatMap((card,index)=>activeCardRules(card,'cardInformation').flatMap(rule=>{
  if(rule.ownControl&&(state.phase!==1||state.activeSide!==side||PremiereGame.wasUsed(state.game,'turn',card.id)))return [];
  if(rule.mode==='q2Peek'&&(state.phase!==5||state.activeSide!==side||!atScompLink(card)))return [];
  const available=rule.mode==='leesub'||rule.mode==='miiyoom'?opposing.hand?.length:
   PremiereGame.reserveCards(rule.mode==='macroscan'?opposing.deck:own.deck).length;
  const cost=rule.mode==='miiyoom'?available:rule.cost;
  if(!available||cost>(forceBudget(side)))return [];
  return [{args:[index],card,mode:rule.mode,cost,label:card.name+' einsetzen ('+cost+' Force)'}];
 }));
}

function beginCardInformation(side,index,preselected=null){
 const option=preselected??cardInformationOptions(side).find(choice=>choice.args[0]===index);
 if(!option)return false;
 const {card,mode,cost}=option,opponent=PremiereGame.otherSide(side);
 const own=PremiereGame.zones(state,side),opposing=PremiereGame.zones(state,opponent);
 if(!option.cloudCityPaid)spendForce(side,cost);
 if(['labria','leesub','miiyoom'].includes(mode))PremiereGame.useOnce(state.game,'turn',card.id);
 const pending={side,card,mode,shown:[],duringBattle:!!battleSession};
 log(side+' nutzt '+card.name+' ('+cost+' Force).');
 if(mode==='miiyoom'){
  log(opponent+' deckt die Hand auf · '+opposing.hand.map(card=>card.name).join(', ')+'.');
  for(let i=opposing.hand.length-1;i>=0;i--){
   const target=opposing.hand[i];
   if(target.type!=='Character'||!['Rebel','Alien'].includes(target.subType)||cardUniquenessLimit(target)!==1||
     characterTraits(target).some(trait=>['female','genderless'].includes(trait)))continue;
   loseOwnedCard(opposing.hand.splice(i,1)[0],opponent);
   log(target.name+' geht durch '+card.name+' verloren.');
  }
  return true;
 }
 if(mode==='labria'){
  const top=own.deck.at(-1);
  log('Labria deckt '+top.name+' auf.');
  if(['Vehicle','Starship'].includes(top.type)){
   loseOwnedCard(own.deck.pop(),side);
   log(top.name+' geht verloren.');
   return true;
  }
  pending.shown=[top];
 }else if(mode==='electrobinoculars')pending.shown=[own.deck.at(-1)];
 else if(mode==='q2Peek')pending.shown=PremiereGame.reserveCards(own.deck).slice(-3).reverse();
 else if(mode==='macroscan'){
  const count=state.locations.some((location,slot)=>location&&PremiereLocations.conditions(state,slot,side).night)?3:1;
  pending.shown=PremiereGame.reserveCards(opposing.deck).slice(-count).reverse();
  if(side==='Dark')PremiereGame.useOnce(state.game,'turn','bot-macroscan');
 }
 state.pendingCardView=pending;
 return true;
}

function cardInformationChoices(frame){
 if(hothEnabled()&&frame.mode?.startsWith('hoth'))return hothCardChoices(frame);
 if(frame.mode==='advoszeConflict')return frame.shown.map((card,index)=>({args:['lose',index],card,label:card.name+' verlieren'}));
 if(frame.mode==='epicRoomChoice')return [{args:['yes'],label:'Standortbonus anwenden ('+frame.room.amount+')'},{args:['no'],label:'Auf optionalen Standortbonus verzichten'}];
 if(['runSelectLight','runSelectDark','runLead','runCover','runPilot','ignitionZ','ignitionGunner'].includes(frame.mode))return epicChoices(frame);
 if(['creatureTargetSide','creatureFight','creaturePower'].includes(frame.mode))return creatureChoices(frame);
 if(frame.mode==='goldRescue')return [{args:['sacrifice'],label:'Gold 2 statt '+frame.target.name+' verlieren'},{args:['decline'],label:frame.target.name+' getroffen verlieren'}];
 if(frame.mode==='besiegedChoose')return frame.targets.map((card,index)=>({args:['toggle',index],card,label:(frame.selected.includes(index)?'✓ ':'')+card.name})).concat(frame.selected.some(index=>cardAbility(frame.targets[index])>0)?[{args:['fight'],label:'Mit ausgewählten Figuren kämpfen (1 Force)'}]:[]).concat({args:['cancel'],label:'Abbrechen'});
 if(frame.mode==='cellRescue')return cellRescueChoices(frame);
 if(frame.mode==='bluffReveal'){const legal=['Character','Vehicle'].includes(frame.card.type)&&boardDeployCost(frame.card,state.locations[frame.site],'Dark',true)!==null;return [...(legal?[{args:['deploy'],label:frame.card.name+' kostenlos ausspielen'}]:[]),{args:['lose'],label:'Bluff und 2 Force verlieren'}];}
 if(frame.mode==='hypoQuestion')return [...new Map([...catalog,...aNewHopeCatalog].map(card=>[locationTitle(card),card])).values()].map(card=>({args:[card.id],label:'Hast du '+card.name+' auf der Hand?'}));
 if(frame.mode==='hypoAnswer'){const yes=PremiereGame.zones(state,frame.side).hand.some(card=>locationTitle(card)===frame.title);return [{args:[yes?'yes':'no'],label:yes?'Wahrheitsgemäß: Ja':'Wahrheitsgemäß: Nein'},{args:['lose'],label:'Statt Antwort 1 Force verlieren'}];}
 if(frame.mode==='squadronTransfer')return squadronTransferChoices(frame);
 if(frame.mode==='rogueTrample')return frame.targets.map((entry,index)=>({args:[index],card:entry.card,label:entry.card.name+' niedertrampeln'}));
 if(frame.mode==='suctionDestination')return [{args:['used'],label:frame.target.name+' auf eigene Used Pile verlegen'},...state.locations.flatMap((loc,slot)=>loc?.hostInstanceId&&loc.hostInstanceId===frame.host.instanceId&&isSite(loc)&&loc.locationTags?.includes('Interior')?[{args:['site',slot],site:slot,label:loc.name+' betreten'}]:[])];
 if(frame.mode==='destinyValue')return frame.values.map(value=>({args:[value],label:'Destiny '+value+' wählen'}));
 if(frame.mode==='anhDestinyTrigger')return anhDestinyTriggerChoices(frame);
 if(frame.mode==='greedoThreat')return [{args:['pay'],label:'Gesamte Force Pile einsetzen'},{args:['risk'],label:'Threat-Destiny zulassen'}];
 if(frame.mode==='shuffleMusicians'){
  const done={args:['done'],label:'Abschließen'};
  if(frame.peeked)return [done];
  return [...(frame.count>0?[{args:['peek'],label:'Bis zu '+frame.count+' Karten oben ansehen'}]:[]),
   {args:['reshuffle'],label:'Blind erneut mischen'},done];
 }
 if(frame.mode==='hunchback'){
  const choices=frame.shown.flatMap((card,index)=>locationTitle(card).includes('back')?
   [{args:['remove',index],label:card.name+' aus dem Spiel nehmen'}]:[]);
  return choices.length?choices:[{args:['done'],label:'Force Pile mischen und zurücklegen'}];
 }
 if(frame.mode==='spySabotage')return [{args:['steal'],label:'Ziel stehlen'},{args:['destroy'],label:'Ziel verlieren lassen'}];
 if(frame.mode==='informantReact')return [...informantReactChoices(frame.side,frame.site),{args:['done'],label:'Informant-React abschließen'}];
 if(frame.mode==='u3poCover')return [{args:['steal'],label:'U-3PO übernehmen'},{args:['done'],label:'Bei aktueller Seite lassen'}];
 if(frame.mode==='namedRecovery'){
  return namedLostTargets(frame.side,lostRetrieval.get(frame.card.id))
   .map(({card,index})=>({args:['recover',index],label:card.name+' zurückholen'}));
 }
 if(frame.mode==='bridgeOrder')return frame.sites.map(slot=>({args:['orderSite',slot],site:slot,label:'Als Nächstes: '+state.locations[slot].name}));
 if(frame.mode==='tractorRelease')return [{args:['launch'],label:'Schiff im Todesstern-System starten'},{args:['escape'],label:'Schiff und Besatzung auf die Used Pile legen'}];
 if(frame.mode==='beggarAmount')return [...beggarPaymentOptions(frame.side),{args:['done'],label:'Schließen'}];
 if(frame.mode==='necklacePass')return necklacePassChoices(frame);
 if(frame.mode==='onTheEdgeNumber')return Array.from({length:6},(_,i)=>({args:['wager',i+1],label:String(i+1)})).concat({args:['done'],label:'Abbrechen'});
 if(frame.mode==='optionalRetrieval')return [{args:['retrieve'],label:frame.amount+' Force zurückholen'},{args:['done'],label:'Auf Rückholung verzichten'}];
 if(frame.mode==='wagerRetrieval')return [{args:['retrieve'],label:'Zufällige Karte zurückholen'},{args:['done'],label:'Auf Rückholung verzichten'}];
 if(frame.mode==='scompPeek')return [{args:['done'],label:'Reserve Deck mischen und zurücklegen'}];
 if(frame.mode==='wiosleaPurchase')return [{args:['purchase'],target:frame.target,cost:frame.target.card.deploy,
  label:frame.target.card.name+' kaufen'},{args:['done'],label:'Auf Kauf verzichten'}];
 if(frame.mode==='tonnikaTheft'){
  const targets=theftTargets(frame.actor,'tonnika');
  const options=targets.flatMap((entry,index)=>!frame.category||entry.card.type===frame.category?[
   ...(entry.stealable?[{args:['steal',index],target:entry,label:entry.card.name+' stehlen'}]:[]),
   {args:['destroy',index],target:entry,label:entry.card.name+' zerstören'},
  ]:[]);
  return [...options,{args:['done'],label:'Auswahl abschließen'}];
 }
 if(frame.mode==='emergencyDeploy')return emergencyChoices(frame);
 if(frame.mode==='reinforcements'){
  const choices=reinforcementTargets(frame.interruptFrame).map((card,index)=>({args:['recover',index],label:card.name+' zurückholen'}));
  return frame.interruptFrame.rule.optional?[...choices,{args:['done'],label:'Rückholung abschließen'}]:choices;
 }
 if(frame.mode==='relocationCost')return [{args:['pay'],site:frame.destination,cost:frame.cost,label:frame.cost+' Force für die Verlegung einsetzen'},
  {args:['decline'],label:frame.card.name+' verloren geben'}];
 if(frame.mode==='relocateGroup'){
  const choices=frame.targets.map(({card,slot},index)=>({args:['toggle',index],site:slot,card,label:(frame.selected.includes(index)?'✓ ':'')+card.name}));
  if(frame.selected.length)choices.push(...frame.destinations.filter(slot=>advoszeDestinationAllowed({kind:'anhCharacter',args:['squad'],members:frame.selected.map(index=>frame.targets[index].card),to:slot})).map(slot=>({args:['relocate',slot],to:slot,label:'Nach '+state.locations[slot].name+' verlegen'})));
  return [...choices,{args:['cancel'],label:'Abbrechen'}];
 }
 if(frame.mode==='beruOrder')return PremiereGame.sides.map(side=>({args:['first',side],label:side+' aktiviert zuerst'}));
 if(frame.mode==='beruExtra'){
  return Array.from({length:frame.maximum+1},(_,index)=>{
   const amount=frame.maximum-index;
   return {args:['extra',amount],label:amount?amount+' zusätzliche Force aktivieren':'Ohne weitere Aktivierung fortfahren'};
  });
 }
 if(frame.mode==='retreatTargets')return frame.targets.flatMap((entry,index)=>frame.selected.includes(entry)?[]:
  [{args:['choose',index],label:entry.card.name+' fortschicken'}]);
 if(frame.mode==='retreatMove')return retreatChoices(frame);
 if(frame.mode==='computerAim')return frame.shots.map((shot,index)=>({args:['shoot',index],target:shot.target,cost:shot.cost,
  label:shot.target.name+' · zweiter Schuss ('+shot.cost+' Force)'}));
 if(frame.mode==='deadJawaTarget'){
  const choices=frame.shown.map((card,index)=>({args:['toggle',index],
   label:(frame.selected.includes(index)?'✓ ':'')+card.name}));
  if(frame.selected.length)choices.push({args:['confirm'],label:'Ziele bestätigen'});
  return [...choices,{args:['cancel'],label:'Abbrechen'}];
 }
 if(frame.mode==='tableLossChoice')return frame.targets.map((entry,index)=>({args:['lose',index],label:entry.card.name+' verlieren'}));
 if(frame.mode==='scanning'||frame.mode==='radar'){
  const {hand}=PremiereGame.zones(state,frame.opponent);
  const eligible=card=>frame.mode==='scanning'?card.type==='Character'&&card.subType==='Rebel':
   matchesRegisteredTarget(card,'tusken')||matchesRegisteredTarget(card,'jawa')&&!/dathcha/i.test(locationTitle(card));
  const normal=frame.scanningMoveUsed?[]:frame.shown.flatMap((card,index)=>hand.includes(card)&&eligible(card)?
   [{args:['move',index],label:card.name+' auf die Used Pile legen'}]:[]);
  const sensor=frame.mode==='radar'&&forceBudget(frame.side)>=1?sensorPanelSources(frame.side)[0]:null;
  const extra=sensor?frame.shown.flatMap((card,index)=>hand.includes(card)&&['Interrupt','Effect'].includes(card.type)?
   [{args:['sensor',index],label:'Sensor Panel · '+card.name+' auf Used legen (1 Force)'}]:[]):[];
  return [...normal,...extra,{args:['done'],label:'Ansicht schließen'}];
 }
 if(frame.mode==='scavenge')return [{args:['search'],label:'Used Pile durchsuchen'},{args:['done'],label:'Auf Suche verzichten'}];
 if(frame.mode==='usedSearch')return [{args:['done'],label:'Suche abschließen'}];
 if(frame.mode==='usedLossOrder')return frame.matches.map((card,index)=>({args:['order',index],
  label:(frame.covered?'Verdeckte Karte '+(index+1):card.name)+' als Nächstes verlieren'}));
 if(frame.mode==='leesub'){
  const {hand}=PremiereGame.zones(state,PremiereGame.otherSide(frame.side));
  return informationCardTypes.flatMap(type=>hand.map((_,index)=>({args:[type,index]})));
 }
 const choices=[{args:['deck'],label:['macroscan','conquestPeek'].includes(frame.mode)?'Ansicht schließen':'Im Reserve Deck lassen'}];
 if(['labria','electrobinoculars'].includes(frame.mode))choices.push({args:['force'],label:'Auf die Force Pile legen'});
 if(frame.mode==='labria')choices.push({args:['used'],label:'Auf die Used Pile legen'});
 return choices;
}

function finishCardInformation(side,...args){
 const frame=state.pendingCardView;
 if(!frame||frame.side!==side)return false;
 if(hothEnabled()&&frame.mode?.startsWith('hoth'))return finishHothChoice(frame,...args);
 if(frame.mode==='advoszeConflict'){
  const card=frame.shown[args[1]],entry=PremiereLocations.findEntry(state,card);
  state.pendingCardView=null;return !!entry&&loseTableCard(entry.side,entry.slot,card);
 }
 if(frame.mode==='epicRoomChoice'){state.pendingCardView=null;frame.resume(frame.fixed+(args[0]==='yes'?frame.room.amount:0));return true;}
 if(['runSelectLight','runSelectDark','runLead','runCover','runPilot','ignitionZ','ignitionGunner'].includes(frame.mode))return finishEpicChoice(frame,...args);
 if(['creatureTargetSide','creatureFight','creaturePower'].includes(frame.mode))return finishCreatureChoice(frame,...args);
 if(frame.mode==='goldRescue'){state.pendingCardView=null;if(args[0]==='sacrifice')loseTableCard('Light',frame.site,frame.gold,false,true);else {frame.target.hitForLoss=true;loseTableCard('Light',frame.site,frame.target);}frame.resume();return true;}
 if(frame.mode==='besiegedChoose'){
  if(args[0]==='toggle'){const index=args[1];frame.selected=frame.selected.includes(index)?frame.selected.filter(i=>i!==index):[...frame.selected,index];return true;}
  state.pendingCardView=null;if(args[0]==='cancel')return true;
  const trapped=tractorShipCrew(frame.record.ship),dark=frame.selected.map(index=>frame.targets[index]);
  state.besiegedBattle={record:frame.record,cards:[...trapped,...dark]};spendForce('Dark',1);return initiateBattleFor('Dark',frame.record.bay,{Light:trapped,Dark:dark});
 }
 if(frame.mode==='cellRescue'){
  const target=cellRescueChoices(frame).find(option=>option.args[0]===args[0])?.card;if(!target)return false;
  releaseSpyRescueTarget(target);frame.remaining--;if(!frame.remaining||!cellRescueChoices(frame).length)state.pendingCardView=null;return true;
 }
 if(frame.mode==='bluffReveal'){
  state.pendingCardView=null;if(args[0]==='deploy'){frame.card.controller='Dark';state.dark[frame.site].push(frame.card);(state.deployedThisTurn??=[]).push(frame.card);openDeploymentReaction('Dark',[frame.card]);}
  else{loseOwnedCard(frame.card,'Dark');beginForceLoss('Dark',2,{reason:'Bluff'});}return true;
 }
 if(frame.mode==='hypoQuestion'){const question=[...catalog,...aNewHopeCatalog].find(card=>card.id===args[0]);state.pendingCardView={...frame,mode:'hypoAnswer',side:PremiereGame.otherSide(side),title:locationTitle(question)};log('Hypo fragt nach '+question.name+'.');return true;}
 if(frame.mode==='hypoAnswer'){state.pendingCardView=null;if(args[0]==='lose')beginForceLoss(side,1,{reason:'Hypo'});else log(side+' antwortet auf Hypo: '+(args[0]==='yes'?'Ja.':'Nein.'));return true;}
 if(frame.mode==='squadronTransfer')return finishSquadronTransfer(frame,...args);
 if(frame.mode==='rogueTrample'){
  state.pendingCardView=null;const entry=frame.targets[args[0]];loseTableCard(entry.side,entry.slot,entry.card);beginBattleResponses();return true;
 }
 if(frame.mode==='suctionDestination'){
  const entry=PremiereLocations.findEntry(state,frame.target);state.pendingCardView=null;
  if(!entry)return false;
  if(args[0]==='used')tableToUsed(entry);
  else if(detachTableCard(entry.side,entry.slot,entry.card))PremiereGame.zones(state,entry.side).board[args[1]].push(entry.card);
  return true;
 }
 if(frame.mode==='destinyValue'){
  state.pendingCardView=null;frame.draw.value=Math.max(0,args[0]+frame.modifier);frame.resume();return true;
 }
 if(frame.mode==='anhDestinyTrigger')return finishAnhDestinyTrigger(frame,...args);
 if(frame.mode==='greedoThreat'){
  state.pendingCardView=null;
  const {actor,target,owner}=frame,amount=forceBudget(side);
  if(args[0]==='pay'){spendForce(side,amount);activateReserve(owner,amount);}
  else drawDestinySeries(owner,'threat',1,0,draws=>{
   const value=draws.find(draw=>!draw.cancelled)?.value;
   if(Number.isFinite(value)&&value+cardAbility(actor)>6){
    const entry=PremiereLocations.findEntry(state,target);
    if(entry)loseTableCard(entry.side,entry.slot,target);
   }
  });
  return true;
 }
 if(frame.mode==='shuffleMusicians'){
  const action=frame.shuffleFrame,pile=PremiereGame.zones(state,action.target)[action.zone];
  if(args[0]==='peek'){
   const visible=action.zone==='deck'?PremiereGame.reserveCards(pile):pile;
   frame.shown=visible.slice(-frame.count).reverse();
   frame.peeked=true;
   return true;
  }
  if(args[0]==='reshuffle'){
   const shuffle=action.zone==='deck'?PremiereGame.shuffleReserve:PremiereGame.shuffle;
   pile.splice(0,pile.length,...shuffle(pile,state.game));
  }
  state.pendingCardView=null;
  PremiereGame.zones(state,side).used.push(action.card);
  if(action.duringBattle)finishWeaponAction(side,false);
  return true;
 }
 if(frame.mode==='hunchback'){
  const {force}=PremiereGame.zones(state,PremiereGame.otherSide(side));
  const target=frame.shown[args[1]],index=force.indexOf(target);
  if(args[0]==='remove'&&index>=0){
   (state.outOfPlay??=[]).push(force.splice(index,1)[0]);
   log(frame.card.name+' nimmt '+target.name+' aus dem Spiel.');
  }
  force.splice(0,force.length,...PremiereGame.shuffle(force,state.game));
  state.pendingCardView=null;
  return true;
 }
 if(frame.mode==='spySabotage'){
  const {entry,spy}=frame.interruptFrame;
  state.pendingCardView=null;
  if(args[0]==='steal')takeStolenTableCard(side,spy,entry);
  else loseTableCard(entry.side,entry.slot,entry.card);
  finishPileInterrupt(frame.interruptFrame);
  return true;
 }
 if(frame.mode==='informantReact'){
  if(args[0]==='done'){
   state.pendingCardView=null;
   finishPileInterrupt(frame.interruptFrame);
   return true;
  }
  const option=informantReactChoices(side,frame.site).find(choice=>choice.args[1]===args[1]);
  if(!option||!detachTableCard(side,option.from,option.card))return false;
  PremiereGame.zones(state,side).board[frame.site].push(option.card);
  (state.reactedThisTurn??=[]).push(option.card);
  noteMineTraversal(side,option.from,frame.site,option.card);
  clearJuriAfterMove(option.card,side,frame.site);
  log(option.label+'.');
  return true;
 }
 if(frame.mode==='u3poCover'){
  state.pendingCardView=null;
  const entry=PremiereLocations.findEntry(state,frame.card);
  return args[0]!=='steal'||!entry||changeCharacterAllegiance(entry,side);
 }
 if(frame.mode==='namedRecovery'){
  const retrieval=frame.retrieval,{lost}=PremiereGame.zones(state,side);
  retrieval.target=lost[args[1]];
  retrieval.chooseAfter=false;
  state.pendingCardView=null;
  settleRetrieval(retrieval);
  return true;
 }
 if(frame.mode==='bridgeOrder'){
  frame.sites.splice(frame.sites.indexOf(args[1]),1);
  frame.order.push(args[1]);
  if(frame.sites.length)return true;
  const remaining=frame.order.slice();
  state.locationOrder=boardLocationOrder().map(slot=>frame.order.includes(slot)?remaining.shift():slot);
  state.pendingCardView=null;
  finishPileInterrupt(frame.interruptFrame);
  return true;
 }
 if(frame.mode==='tractorRelease'){
  const released=releaseCapturedStarship(frame.record,args[0]==='launch');
  if(released&&frame.interruptFrame)finishPileInterrupt(frame.interruptFrame);
  return released;
 }
 if(frame.mode==='beggarAmount'){
  if(args[0]!=='done')state.beggarPayment={side,turn:state.game.timing.turn,amount:args[0]};
  state.pendingCardView=null;
  return true;
 }
 if(frame.mode==='necklacePass'){
  state.pendingCardView=null;
  if(args[0]!=='passNecklace')return true;
  const {card,host}=frame,target=PremiereLocations.entries(state,side)[args[1]].card;
  host.attachments.splice(host.attachments.indexOf(card),1);
  (target.attachments??=[]).push(card);
  const record=state.tableEffects.find(effect=>effect.card===card);
  if(record)record.host=target;
  log(card.name+' wird an '+target.name+' weitergegeben.');
  return true;
 }
 if(frame.mode==='onTheEdgeNumber'){
  state.pendingCardView=null;
  return args[0]==='done'||announcePileInterrupt(side,{...frame.option,wager:args[1]});
 }
 if(frame.mode==='optionalRetrieval'){
  if(args[0]==='retrieve')PremiereGame.retrieveForce(state,side,frame.amount);
  state.pendingCardView=null;
  if(frame.interruptFrame)finishPileInterrupt(frame.interruptFrame);
  if(frame.lostAfter)loseOwnedCard(frame.card,side);
  return true;
 }
 if(frame.mode==='wagerRetrieval'){
  if(args[0]==='retrieve')retrieveRandomLost(side,1,frame.card.name);
  state.pendingCardView=null;
  return true;
 }
 if(frame.mode==='scompPeek'){
  const {deck}=PremiereGame.zones(state,frame.interruptFrame.pileSide);
  deck.splice(0,deck.length,...PremiereGame.shuffleReserve(deck,state.game));
  state.pendingCardView=null;
  log(side+' mischt das geprüfte Reserve Deck und legt es zurück.');
  finishPileInterrupt(frame.interruptFrame);
  return true;
 }
 if(frame.mode==='wiosleaPurchase'){
  state.pendingCardView=null;
  if(args[0]!=='purchase')return true;
  const {force,used}=PremiereGame.zones(state,side);
  if(!takeStolenTableCard(side,frame.card,frame.target))return false;
  spendForce(side,frame.target.card.deploy);
  return true;
 }
 if(frame.mode==='tonnikaTheft'){
  const [kind,index]=args;
  if(kind==='done'){state.pendingCardView=null;return true;}
  const entry=theftTargets(frame.actor,'tonnika')[index];
  if(kind==='steal')takeStolenTableCard(side,frame.card,entry);
  else loseTableCard(entry.side,entry.slot,entry.card);
  frame.category=entry.card.type;
  if(--frame.remaining===0)state.pendingCardView=null;
  return true;
 }
 if(frame.mode==='emergencyDeploy')return finishEmergencyDeployment(frame,args);
 if(frame.mode==='reinforcements'){
  const [choice,index]=args;
  const {lost}=PremiereGame.zones(state,side);
  if(choice==='recover'){
   const chosen=reinforcementTargets(frame.interruptFrame)[index],card=PremiereGame.retrieveCard(state,side,lost.indexOf(chosen));
   if(!card)return false;
   log(frame.card.name+' holt '+card.name+' zurück.');
   if(--frame.remaining>0&&reinforcementTargets(frame.interruptFrame).length)return true;
  }
  state.pendingCardView=null;
  finishPileInterrupt(frame.interruptFrame);
  return true;
 }
 if(frame.mode==='relocationCost'){
  state.pendingCardView=null;
  if(args[0]==='decline')loseOwnedCard(frame.card,side);
  else{
   const {force,used}=PremiereGame.zones(state,side);
   spendForce(side,frame.cost);
   const action={...frame,kind:'interrupt',interrupt:'groupRelocation'};
   log(frame.card.name+' · '+frame.cost+' Force für die Verlegung.');
   if(hasInterruptResponse(action))PremiereGame.openResponse(state.game,action);
   else finishGroupRelocation(action);
  }
  return true;
 }
 if(frame.mode==='relocateGroup'){
  const [choice,value]=args;
  if(choice==='toggle'){
   if(frame.selected.includes(value))frame.selected=frame.selected.filter(index=>index!==value);
   else frame.selected.push(value);
   return true;
  }
  if(choice==='relocate')return initiateGroupRelocation(frame,value);
  state.pendingCardView=null;
  return true;
 }
 if(frame.mode==='beruOrder'||frame.mode==='beruExtra'){
  const interrupt=frame.interruptFrame;
  if(frame.mode==='beruOrder'){
   for(const actor of [args[1],PremiereGame.otherSide(args[1])]){
    const {activated}=activateReserve(actor,2*(typeof cloudCityEnabled==='function'&&cloudCityEnabled()&&ccDiningDouble(interrupt.side)?2:1));
    log(interrupt.card.name+' · '+actor+' aktiviert '+activated+' Force.');
   }
   const maximum=activationLocked(interrupt.side)?0:Math.min(beruActivationBonus()*(typeof cloudCityEnabled==='function'&&cloudCityEnabled()&&ccDiningDouble(interrupt.side)?2:1),
    PremiereGame.reserveCards(PremiereGame.zones(state,interrupt.side).deck).length);
   if(maximum){
    state.pendingCardView={...frame,side:interrupt.side,mode:'beruExtra',maximum};
    return true;
   }
  }else{
   const {activated}=activateReserve(side,args[1]);
   log(interrupt.card.name+' · '+side+' aktiviert '+activated+' zusätzliche Force.');
  }
  state.pendingCardView=null;
  finishPileInterrupt(interrupt);
  return true;
 }
 if(frame.mode==='retreatTargets'){
  frame.selected.push(frame.targets[args[1]]);
  if(frame.selected.length===frame.count)beginRetreat(frame.action,frame.selected);
  return true;
 }
 if(frame.mode==='retreatMove')return takeRetreat(frame,...args);
 if(frame.mode==='computerAim'){
  const shot=frame.shots[args[1]];
  state.pendingCardView=null;
  shootWeapon(side,{...shot,computerPenalty:frame.rule.penalty},()=>finishWeaponAction(side,false));
  return true;
 }
 if(frame.mode==='deadJawaTarget'){
  const [choice,index]=args;
  if(choice==='toggle'){
   if(frame.selected.includes(index))frame.selected=frame.selected.filter(value=>value!==index);
   else frame.selected.push(index);
   return true;
  }
  state.pendingCardView=null;
  return choice==='cancel'||announcePileInterrupt(side,{...frame.option,targets:frame.selected.map(value=>frame.option.targets[value])});
 }
 if(frame.interruptFrame)return resolvePileChoice(frame,...args);
 if(frame.mode==='leesub'){
  const [type,index]=args,opponent=PremiereGame.otherSide(side),{hand}=PremiereGame.zones(state,opponent);
  const shown=hand[index];
  if(!shown||!informationCardTypes.includes(type))return false;
  const matched=shown.type===type;
  log('Leesub Sirln tippt auf '+type+'. '+opponent+' deckt '+shown.name+' auf.'+(matched?' Die Karte geht verloren.':' Die Karte bleibt auf der Hand.'));
  if(matched)loseOwnedCard(hand.splice(index,1)[0],opponent);
 }else{
  const [destination]=args;
  if(!cardInformationChoices(frame).some(option=>option.args[0]===destination))return false;
  if(destination!=='deck'){
   const own=PremiereGame.zones(state,side);
   if(own.deck.at(-1)!==frame.shown[0])return false;
   PremiereGame.moveTop(own.deck,own[destination]);
   log(side+' verschiebt die oberste Reserve-Karte auf die '+(destination==='force'?'Force Pile.':'Used Pile.'));
  }
 }
 state.pendingCardView=null;
 if(frame.duringBattle&&battleSession?.weaponTurn===side)finishWeaponAction(side,false);
 return true;
}

function retreatChoices(frame){
 return frame.targets.flatMap((entry,index)=>{
  if(entry.slot!==PremiereLocations.findEntry(state,entry.card)?.slot)return [];
  const moves=state.locations.flatMap((location,to)=>travelOptions(entry.card,entry.side,entry.slot,to)
    .filter(option=>['Landspeed','Hyperspeed'].includes(option.kind)&&!regularMovementUsed(entry.card))
   .map(option=>({...option,to,cost:frame.free?0:option.cost})))
   .filter(option=>option.cost<=forceBudget(entry.side));
  return moves.length?moves.map(move=>({args:[index,move.to],move,to:move.to,cost:move.cost,
   label:entry.card.name+' zu '+state.locations[move.to].name+' ('+move.cost+' Force)'})):
   [{args:[index,null],label:entry.card.name+(frame.free?' muss verloren gehen':' kann sich nicht entfernen')}];
 });
}

function beginRetreat(action,targets){
 if(!targets.length){finishBattleRetreat(action);return;}
 const free=['singleExpel','moveAlong'].includes(action.rule.mode);
 state.pendingCardView={mode:'retreatMove',side:targets[0].side,card:action.card,
  action,targets,free,publicView:true,shown:targets.map(entry=>entry.card)};
}

function takeRetreat(frame,index,to){
 const option=retreatChoices(frame).find(choice=>choice.args[0]===index&&choice.args[1]===to);
 if(!option)return false;
 const entry=frame.targets[index],{side,card,slot}=entry;
 if(option.move){
  if(!detachTableCard(side,slot,card))return false;
  const own=PremiereGame.zones(state,side);
  own.board[to].push(card);
  spendForce(entry.side,option.move.cost);
  (state.movedThisTurn??=[]).push(card);
  log(card.name+' entfernt sich nach '+state.locations[to].name+'.');
 }else if(frame.free)loseTableCard(side,slot,card);
 else log(card.name+' kann sich nicht entfernen.');
 frame.targets=frame.targets.filter(target=>target!==entry&&PremiereLocations.findEntry(state,target.card)?.slot===target.slot);
 frame.shown=frame.targets.map(target=>target.card);
 if(!frame.targets.length)finishBattleRetreat(frame.action);
 return true;
}

function settleBattleRetreat(action){
 if(action.cancelled){finishBattleRetreat(action);return;}
 if(action.rule.mode!=='moveAlong'){beginRetreat(action,action.targets);return;}
 drawDestinySeries(action.side,'interrupt',1,0,draws=>{
  const drawn=draws.find(draw=>!draw.cancelled)?.value??0;
  const count=Math.max(0,Math.min(Math.floor(drawn),action.targets.length));
  if(!count)finishBattleRetreat(action);
  else if(count===action.targets.length)beginRetreat(action,action.targets);
  else state.pendingCardView={mode:'retreatTargets',side:action.side,card:action.card,action,targets:action.targets,
   shown:action.targets.map(entry=>entry.card),count,selected:[],publicView:true};
 });
}

function finishBattleRetreat(action){
 state.pendingCardView=null;
 if(action.kind==='interrupt')finishPileInterrupt(action);
}

function resolvePileChoice(frame,choice,index){
 const {opponent,interruptFrame}=frame,rival=PremiereGame.zones(state,opponent);
 if(frame.mode==='tableLossChoice'){
  const entry=frame.targets[index];
  if(!loseTableCard(entry.side,entry.slot,entry.card))return false;
  log(entry.card.name+' geht durch '+frame.card.name+' verloren.');
 }else if(frame.mode==='usedLossOrder'){
  const [card]=frame.matches.splice(index,1);
  frame.order.push(card);
  if(frame.matches.length)return true;
  moveUsedPileLosses(opponent,frame.order);
 }else if(frame.mode==='usedSearch'){
  startUsedPileLoss(frame,frame.matches);
  return true;
 }else if(frame.mode==='scavenge'&&choice==='search'){
  frame.mode='usedSearch';
  frame.shown=rival.used.slice().reverse();
  frame.matches=rival.used.filter(card=>['Vehicle','Weapon','Device'].includes(card.type));
  return true;
 }else if(choice==='move'||choice==='sensor'){
  if(choice==='sensor'){
   spendForce(frame.side,1);
   PremiereGame.useOnce(state.game,'turn',sensorPanelSources(frame.side)[0]);
  }
  const [card]=frame.shown.splice(index,1);
  rival.used.push(...rival.hand.splice(rival.hand.indexOf(card),1));
  log(card.name+' kommt oben auf die Used Pile von '+opponent+'.');
  if(frame.mode==='scanning')frame.scanningMoveUsed=true;
  if(frame.mode==='radar'&&cardInformationChoices(frame).some(option=>['move','sensor'].includes(option.args[0])))return true;
 }
 if(frame.scannerPenalty){
  const targets=rival.hand.filter(card=>frame.mode==='scanning'?locationTitle(card).includes('rebel'):
   card.type==='Character'&&(matchesRegisteredTarget(card,'jawa')||matchesRegisteredTarget(card,'tusken')||characterTraits(card).includes('stormtrooper')));
  for(const target of targets)loseOwnedCard(rival.hand.splice(rival.hand.indexOf(target),1)[0],opponent);
 }
 state.pendingCardView=null;
 finishPileInterrupt(interruptFrame);
 return true;
}

function checkDeployment(card,site){
 return boardDeployCost(card,site,'Light')!==null;
}



function deployBoardCardFor(side,handIndex,siteIndex,{special=false,free=false}={}){
 if(!state||!special&&(state.phase!==2||(state.activeSide&&state.activeSide!==side)||battleSession)||state.gameWinner||state.pendingForceLoss)return null;
 const light=side==='Light',hand=light?state.hand:state.botHand;
 const card=hand[handIndex],loc=state.locations[siteIndex],cost=boardDeployCost(card,loc,side,free);
 if(cost===null)return null;
 const force=light?state.force:state.botForce,used=light?state.used:state.botUsed,rows=light?state.light:state.dark;
 hand.splice(handIndex,1);
 if(jawaCosts.has(card.id)){
  const {opposing}=jawaDeployPayment(card,loc,side);
  spendJawaDeployForce(side,cost,opposing);
  if(opposing)payOpposingJawaCost(side,opposing);
 }else spendForce(side,cost);
 rows[siteIndex].push(card);
 if(card.owner||card.side)card.controller=side;
 if(activeCardRules(card,'deployUndercover').length)setUndercover(card,side);
 (state.deployedThisTurn??=[]).push(card);
 openDeploymentReaction(side,[card]);
 return {card,loc,cost};
}

function openDeploymentReaction(side,cards){
 if(hothEnabled())hothRecordDeployment(side,cards);
 if(!state.game||(currentGame()?.cardRulesVersion??latestCardRulesVersion)<21)return;
 const targets=cards.filter(card=>card.type==='Character'||card.type==='Starship'||hothEnabled()&&['Vehicle','Weapon','Device'].includes(card.type));
 if(state.game.cardRulesVersion>=29)for(const card of targets.filter(card=>card.type==='Character')){
  const entry=PremiereLocations.findEntry(state,card);
  if(entry)(state.deploymentLocations??=[]).push({card,site:entry.slot,side,turn:state.game.timing.turn});
 }
 const frame={kind:'deployment',side,targets};
 if(targets.length&&hasInterruptResponse(frame)){
  PremiereGame.openResponse(state.game,frame);
 if(state.botTurn?.steps?.[state.botTurn.index]?.kind==='battle'&&side===botSide()&&!battleSession)state.botTurn.decision='deploy';
 }
}

function deployPilotOptions(side,handIndex,slot,free=false){
 const {hand}=PremiereGame.zones(state,side),ship=hand?.[handIndex],loc=state.locations[slot];
 const shipSide=deploymentSide(ship);
 if(ship?.type!=='Starship'||(shipSide&&shipSide!==side)||permanentPilotAbility(ship)!==null||
    !loc||!hasDeployPresence(side,loc)||!withinDeploymentLimit(ship,side))return [];
 return hand.flatMap((pilot,index)=>{
  const pilotSide=deploymentSide(pilot);
  if(index===handIndex||!pilot.pilot||!Number.isFinite(pilot.deploy)||(pilotSide&&pilotSide!==side)||!withinDeploymentLimit(pilot,side))return [];
  const cost=craftDeployCost(ship,loc,side,pilot);
  return cost!==null&&(free||cost<=forceBudget(side))?[{pilot,index,cost:free?0:cost,ship}]:[];
 });
}

function deployWithPilot(side,index,slot,pilotIndex){
 const option=deployPilotOptions(side,index,slot).find(item=>item.index===pilotIndex);
 if(!option)return false;
 const {hand,board}=PremiereGame.zones(state,side);
 for(const i of [index,pilotIndex].sort((a,b)=>b-a))hand.splice(i,1);
 spendForce(side,option.cost);
 option.ship.controller=side;
 PremiereUnits.add(option.ship,option.pilot,'pilot',side);
 board[slot].push(option.ship);
 (state.deployedThisTurn??=[]).push(option.ship,option.pilot);
 openDeploymentReaction(side,[option.ship,option.pilot]);
 const loc=state.locations[slot];
 log(side+' setzt '+option.ship.name+' mit '+option.pilot.name+' bei '+loc.name+' ein ('+option.cost+' Force).');
 return {card:option.ship,loc,cost:option.cost};
}

function botDeploymentChoice(available){
 const units=available.filter(option=>['deploy','deployWithPilot'].includes(option.kind));
 const weapons=available.filter(option=>option.kind==='equip'&&!option.host.weapons?.length);
 const devices=available.filter(option=>option.kind==='deployDevice'||(option.kind==='deployBolt'&&option.hostSide==='Light'));
 const automated=available.filter(option=>option.kind==='deployAutomated');
 if(!strategicBot()){
  return weapons.sort((a,b)=>Number(b.contested)-Number(a.contested)||a.cost-b.cost)[0]??
   devices[0]??automated[0]??units.find(option=>option.kind==='deployWithPilot')??units[0];
 }
 const positions=new Map();
 const score=option=>{
  const slot=option.args[1],cost=option.cost,budget=state.botForce.length-cost;
  if(!positions.has(slot))positions.set(slot,botPosition(slot));
  const site=positions.get(slot);
  if(option.kind==='equip'){
   const targets=PremiereLocations.presentCards(state,'Light',slot).filter(PremiereUnits.active);
   const canFire=budget>=2&&targets.some(target=>{
    const defense=PremiereWeapons.defense(target,cardAbility(target),craftStats(target,slot));
    const shot=weaponShot(option.card,option.host,target,defense);
    return shot&&shot.cost+1<=budget;
   });
   const captureBonus=option.card.id==='Dark:2915'?1:0;
   return site.dark===true&&site.light===true&&canFire?3+captureBonus-cost*0.4:budget>=2?0.8+captureBonus-cost*0.4:-1;
  }
  if(option.kind==='deployBolt')return 2.6;
  if(option.kind==='deployDevice'||option.kind==='deployAutomated'){
   if(option.host?.attachments?.some(card=>card.id===option.card.id))return -1;
   return option.kind==='deployDevice'?1.2-cost*0.5:1-cost*0.5;
  }
  const unit=botUnitStrength(option.ship??option.card,slot,option.pilot),after=site.darkPower+unit.power-site.lightPower;
  const takesControl=site.dark!==true&&site.light===false&&unit.ability+(site.darkAbility??0)>=1;
  const contests=site.light===true?(after>=1?2.5:after< -2?-2:0.5):0;
  const destiny=(site.darkAbility??0)<4&&(site.darkAbility??0)+unit.ability>=4?1.5:0;
  const reserve=cost>0&&budget===0&&state.botHand.length<=3&&!takesControl?1.5:0;
  return 0.8+Math.min(unit.power,6)*0.55+Math.min(unit.ability,4)*0.4-cost*0.7+contests+destiny-reserve+
   (takesControl?3+site.drain*1.5:0);
 };
 const best=[...units,...weapons,...devices,...automated].map(option=>({option,score:score(option)}))
  .sort((a,b)=>b.score-a.score)[0];
 return best?.score>0?best.option:undefined;
}

function botDeployPhase(){
 if(!state||state.phase!==2||state.activeSide!=='Dark'||!state.botTurn)return [];
 const actions=[],maxActions=state.botHand.length;
 for(let k=0;k<maxActions;k++){
  const available=legalActions(state,'Dark'),own=PremiereGame.zones(state,'Dark');
  const tableEffect=available.find(action=>action.kind==='deployTableEffect');
  if(tableEffect){
   if(!performAction(tableEffect))break;
   actions.push(tableEffect.card.name+' auslegen ('+tableEffect.cost+' Force)');
   if(PremiereGame.responseWindow(state.game))break;
   continue;
  }
  const pileTarget=PremiereGame.lostPileFaceDown(state,'Dark')?'Light':'Dark';
  const pileEffect=available.find(action=>action.kind==='deployLostPileEffect'&&action.target===pileTarget);
  if(pileEffect&&!PremiereGame.lostPileFaceDown(state,pileTarget)){
   if(!performAction(pileEffect))break;
   actions.push(pileEffect.card.name+' für die Lost Pile der '+pileTarget+' Side');
   continue;
  }
  const insertion=available.find(action=>action.kind==='deployReserveInsert');
  if(insertion){
   if(!performAction(insertion))break;
   actions.push('mischt einen verdeckten Effect ins gegnerische Reserve Deck');
   continue;
  }
  const locationEffect=available.find(action=>action.kind==='deployLocationEffect'&&confirmedPresence('Dark',action.args[1])===true&&
   !PremiereLocations.effectsAt(state,action.args[1]).some(effect=>effect.card.id===action.card.id));
  if(locationEffect){
   if(!performAction(locationEffect))break;
   actions.push(locationEffect.card.name+' bei '+state.locations[locationEffect.args[1]].name);
   if(PremiereGame.responseWindow(state.game))break;
   continue;
  }
  const conversion=available.find(action=>action.kind==='convertLocation');
  if(conversion){
   if(!performAction(conversion))break;
   actions.push('konvertiert '+conversion.card.name);continue;
  }
  const location=available.filter(x=>x.kind==='deployLocation').sort((a,b)=>a.args[0]-b.args[0]||b.args[1]-a.args[1])[0];
  if(location){
   const name=own.hand[location.args[0]].name;
   if(!performAction(location))break;
   actions.push('Location '+name);continue;
  }
  const option=botDeploymentChoice(available);
  if(!option)break;
  const deployed=performAction(option);
  if(!deployed)break;
  if(['equip','deployDevice','deployBolt'].includes(option.kind)){
   actions.push(option.host.name+' erhält '+option.card.name+(option.kind==='equip'?' ('+option.cost+' Force)':''));
   continue;
  }
  if(option.kind==='deployAutomated'){
   actions.push(option.card.name+' auslegen');
   if(state.automatedPending)break;
   continue;
  }
  const label=deployed.card.type==='Vehicle'?'Fahrzeug':deployed.card.type==='Starship'?'Raumschiff':'Charakter';
  actions.push(label+' '+deployed.card.name+' bei '+deployed.loc.name+' ('+deployed.cost+' Force)');
 }
 return actions;
}

function botSay(message){state.botReason=message;log(message)}

function logBotDecision(reason){
 if(!reason)return;
 const message='Bot · '+reason;
 if(state.botReason===message)return;
 state.botReason=message;
 log(message,botSide());
 if(!state.botTurn)(state.botHistory??=[]).unshift(message);
}

function botPlan(){return ['activate','control','deploy','battle','move','draw','finish'].map(kind=>({kind}))}

function botBegin(){
 state.botTurn={steps:botPlan(),index:0};
 state.botHistory=[];
 botSay(botSide()+' Side beginnt ihren Zug.');
}

function botNextStep(repeatPhase=true,adaptive=true){
 if(!state?.botTurn||state.gameWinner)return false;
 if(plannedBot())return plannedBotStep();
 if(state.pendingCustody?.length){
  const choices=legalActions(state,'Dark');
  return choices.length?performAction(botCustodyAction(choices)):false;
 }
 const window=PremiereGame.responseWindow(state.game);
 if(window||state.game?.timing.pending||state.automatedPending||state.pendingCardView)return performAction(legalActions(state,'Dark')[0]);
 if(state.pendingForceLoss||state.pendingReserveSearch||battleSession)return false;
 if(state.botHand?.some(card=>activeCardRules(card,'limitedResources').length)){
  const limited=legalActions(state,'Dark').find(action=>action.kind==='limitedResources');
  if(limited&&performAction(limited))return true;
 }
 const storm=gravelStormOptions('Dark').find(option=>cardAbility(option.target)<=2);
 if(storm&&performAction(legalActions(state,'Dark').find(action=>action.kind==='gravelStorm'&&
  action.args[0]===storm.args[0]&&action.args[1]===storm.args[1])))return true;
 if(state.botHand?.some(card=>activeCardRules(card,'pileInterrupt').length)){
  const play=legalActions(state,'Dark').find(option=>option.kind==='pileInterrupt'&&
   (!option.cost||option.cost<=state.botForce.length-2)&&
   (option.rule.mode!=='destroyDroid'||option.entry.side==='Light'));
  if(play&&performAction(play))return true;
 }
 const deferred=state.botTurn.decision;
 const duel=legalActions(state,'Dark').find(option=>option.kind==='duel');
 if(!deferred&&duel&&performAction(duel))return true;
 const action=deferred?{kind:deferred}:state.botTurn.steps[state.botTurn.index];
 if(!deferred&&action?.kind==='deploy'&&state.phase===1&&botDrain())return true;
 if(!repeatPhase&&!deferred&&action?.kind==='draw'&&state.phase===4&&botEscortMove(legalActions(state,'Dark')))return true;
 if(repeatPhase&&!deferred){
  const continued=action?.kind==='move'&&state.phase===3?botBattle(legalActions(state,'Dark'),adaptive):
   action?.kind==='draw'&&state.phase===4?botMove():false;
  if(continued){publishGame();return true;}
 }
 if(!action||!requestAction(deferred?'botDecision':'botStep','Dark',[action.kind]))return false;
 if(state.game?.timing.pending||state.automatedPending)return true;
 const available=legalActions(state,'Dark');
 if(action.kind==='move'){
  if(!botMove(available))botSay('Move: Bot passt, keine vorteilhafte bezahlbare Bewegung.');
 }else if(action.kind==='battle'){
  if(!botBattle(available,adaptive))botSay(adaptive&&available.some(option=>option.kind==='battle')?
   'Battle: Bot passt. Nach Power, erwarteter Battle Destiny und sichtbaren Waffen fehlt ein Vorteil.':
   'Battle: Kein legaler Kampf mit Presence beider Seiten und 1 Force verfügbar.');
 }else if(action.kind==='draw'){
  if(adaptive)botDraw();
  else{
   const choice=available.find(x=>x.kind==='draw');
   const drawn=choice&&performAction(choice)?1:0;
   botSay('Draw Phase: Bot zieht '+drawn+' Karte aus seiner Force Pile. Seine Hand enthält jetzt '+state.botHand.length+' Karten.');
  }
 }else if(action.kind==='activate'){
  const choice=available.filter(x=>x.kind==='activate').at(-1);
  if(choice&&performAction(choice))botSay('Activate: Bot aktiviert '+choice.args[0]+' Force. Jetzt verfügbar: '+state.botForce.length+'.');
 }else if(action.kind==='control'){
  const cancel=available.find(option=>option.kind==='cancelTableEffect'&&option.effect.target==='Dark');
  if(cancel&&performAction(cancel))return true;
  const intel=available.find(option=>option.kind==='cardInformation'&&option.cost<=Math.max(0,state.botForce.length-3)&&
   (option.mode!=='macroscan'||!PremiereGame.wasUsed(state.game,'turn','bot-macroscan')));
  if(intel&&performAction(intel))return true;
  const steal=available.find(option=>option.kind==='deviceAction'&&option.args[0]==='stealDroid');
  if(steal)performAction(steal);
  const theft=available.find(option=>option.kind==='controlTheft'&&option.cost<=Math.max(0,state.botForce.length-3));
  if(theft&&performAction(theft))return true;
  const retrieval=available.find(option=>option.kind==='retrieve')??available.find(option=>option.kind==='searchReserve');
  if(retrieval)requestAction(retrieval.kind,'Dark',retrieval.args);
  const seeker=legalActions(state,'Dark').find(option=>option.kind==='moveSeeker');
  if(seeker)requestAction('moveSeeker','Dark',seeker.args);
  if(strategicBot()&&state.botHand.length>=3){
   const redundant=legalActions(state,'Dark').find(option=>option.kind==='recycleHand'&&option.card.uniquenessLimit===1&&
    (!withinDeploymentLimit(option.card,'Dark')||state.botHand.some(card=>card!==option.card&&card.id===option.card.id)));
   if(redundant)performAction(redundant);
  }
  if(!botDrain())botSay('Control: Keine weitere Location erlaubt einen Force Drain.');
 }else if(action.kind==='deploy'){
  const actions=botDeployPhase();
  botSay(actions.length?'Deploy: '+actions.join('; ')+'.':'Deploy: Bot passt.');
 }
 publishGame();
 return true;
}

function plannedBotStep(){
 const side=botSide(),available=legalActions(state,side);
 if(battleSession||state.pendingCustody?.length||state.pendingCardView||state.automatedPending||
    state.game.timing.pending||PremiereGame.responseWindow(state.game)||state.pendingForceLoss||state.pendingReserveSearch){
  return !!performAction(botPromptAction(available));
 }
 const step=available.find(action=>['botStep','botDecision'].includes(action.kind));
 if(step?.kind==='botDecision')return !!performAction(step);
 const starting=step?.args[0]==='activate';
 const choice=!starting&&choosePlannedBotAction(available);
 if(choice)return performPlannedBotAction(choice);
 if(!step)return false;
 if(styledBot()&&[3,4,5].includes(state.phase)){
  const {view,actions}=plannedBotPosition(available);
  logBotDecision(PremiereBot.explainPass(view,actions,state.phase));
 }else if(step.args[0]==='move'&&available.some(action=>action.kind==='battle')){
  botSay('Battle: Bot passt nach Abwägung von Power, erwarteter Destiny und verfügbarer Force.');
 }
 if(!performAction(step))return false;
 if(starting){
  const activate=choosePlannedBotAction(legalActions(state,side).filter(action=>action.kind==='activate'));
  if(activate)performPlannedBotAction(activate);
 }
 return true;
}

function performPlannedBotAction(choice){
 if(!performAction(choice))return false;
 if(choice.kind==='activate'){
  botSay('Activate: Bot aktiviert '+choice.args[0]+' Force. Jetzt verfügbar: '+PremiereGame.zones(state,botSide()).force.length+'.');
  publishGame();
 }
 return true;
}
function botMove(available=legalActions(state,'Dark')){
 if(botEscortMove(available))return true;
 const best=available.filter(option=>option.kind==='move').map(option=>({option,score:botMoveScore(option)}))
  .sort((a,b)=>b.score-a.score)[0];
 if(!best||best.score<=0||!performAction(best.option))return false;
 const choice=best.option;
 botSay('Move: Bot bewegt '+choice.name+' für '+choice.cost+' Force zu '+state.locations[choice.to].name+' ('+choice.movementKind+').');
 return true;
}

function botEscortMove(available){
 const release=controlledLocationRule('Light','releasePrisoners');
 const delivery=!release&&available.find(option=>option.kind==='prisonerTransfer'&&option.args[0]==='deliver');
 if(delivery)return performAction(delivery);
 if(release)return false;
 const order=boardLocationOrder();
 const prisons=order.filter(slot=>PremiereLocations.prison(state.locations[slot]));
 const distance=slot=>Math.min(Infinity,...prisons.filter(prison=>sitePlanet(state.locations[prison])===sitePlanet(state.locations[slot]))
  .map(prison=>Math.abs(order.indexOf(prison)-order.indexOf(slot))));
 const move=available.filter(option=>option.kind==='move'&&option.card.escortedCaptive&&distance(option.to)<distance(option.from))
  .sort((a,b)=>distance(a.to)-distance(b.to)||a.cost-b.cost)[0];
 if(move)return performAction(move);
 const exit=available.find(option=>option.kind==='transport'&&option.args[0]==='exit'&&option.card.escortedCaptive&&prisons.includes(option.from));
 return exit?performAction(exit):false;
}
const estimatedDestiny=2.5;

function botWeaponPressure(side,slot){
 const opponent=PremiereGame.otherSide(side);
 const {force,deck}=PremiereGame.zones(state,side);
 const budget=(force?.length??0)-(side==='Dark'?1:0);
 if(!deck?.length||budget<0)return 0;
 const targets=PremiereLocations.presentCards(state,opponent,slot).filter(PremiereUnits.active);
 const hosts=PremiereLocations.presentCards(state,side,slot).filter(PremiereUnits.active);
 let pressure=0;
 for(const host of hosts){
  if(PremiereWeapons.disarmed(host)||(host.type==='Starship'&&!craftStats(host,slot).powered))continue;
  for(const weapon of host.weapons??[]){
   if(!PremiereUnits.canUseWeapon(state,host,weapon))continue;
   for(const target of targets){
    const defense=PremiereWeapons.defense(target,cardAbility(target),craftStats(target,slot));
    const shot=weaponShot(weapon,host,target,defense);
    if(!shot||shot.cost>budget||shot.effect==='block')continue;
    const captureBonus=shot.effect==='capture'?(PremiereLocations.ruleAt(state,slot,side,'weaponDestiny')?.amount??0):0;
    const margin=estimatedDestiny*Math.min(shot.draws,deck.length)+shot.bonus+captureBonus-defense;
    pressure=Math.max(pressure,margin>0?1.5:margin>=-1?0.5:0);
   }
  }
 }
 return pressure;
}

function botBattleEstimate(slot,adaptive){
 const {darkPower,lightPower,darkAbility,lightAbility}=battleTotals(slot,'Dark');
 if(!adaptive)return darkPower-lightPower;
 const darkDraws=Math.min(state.botDeck?.length??0,battleDestinyDrawCount('Dark',slot,darkAbility,'Dark')??0);
 const lightDraws=Math.min(state.deck?.length??0,battleDestinyDrawCount('Light',slot,lightAbility,'Dark')??0);
 const darkBonus=vaderBattleDestinyBonus('Dark',slot),useLocation=(currentGame()?.cardRulesVersion??latestCardRulesVersion)>=2;
 return darkPower-lightPower+darkDraws*(estimatedDestiny+darkBonus-(useLocation?alderaanBattleDestinyPenalty('Dark',slot):0))-
  lightDraws*(estimatedDestiny-(useLocation?alderaanBattleDestinyPenalty('Light',slot):0))+
  botWeaponPressure('Dark',slot)-botWeaponPressure('Light',slot);
}

function botBattle(available,adaptive){
 const best=available.filter(option=>option.kind==='battle')
  .map(option=>({option,margin:botBattleEstimate(option.args[0],adaptive)}))
  .sort((a,b)=>b.margin-a.margin)[0];
 if(!best||(adaptive&&best.margin<1))return false;
 const choice=best.option;
 if(!performAction(choice))return false;
 botSay('Battle: Bot initiiert einen Kampf bei '+state.locations[choice.args[0]].name+' für '+choice.cost+' Force. Dark Side hat die erste Aktion in jedem Kampfsegment.');
 botDestinyDecision();
 return true;
}

function botDraw(){
 const {hand,force}=PremiereGame.zones(state,'Dark');
 const hasPresence=state.locations.some((location,slot)=>location&&confirmedPresence('Dark',slot)===true);
 const hasReinforcement=hand.some(card=>
  (isDeployableCharacter(card)&&cardAbility(card)>0)||(card.type==='Starship'&&permanentPilotAbility(card)!==null));
 const handGoal=hasPresence?(hasReinforcement?3:4):5;
 const needed=Math.max(handGoal-hand.length,(!hasPresence&&!hasReinforcement)?2:0);
 const lifeReserve=!hasPresence&&!hasReinforcement?1:2;
 const maxDraw=Math.max(0,Math.min(needed,force.length,lifeForceRemaining('Dark')-lifeReserve));
 let drawn=0;
 while(drawn<maxDraw){
  const draw=legalActions(state,'Dark').find(option=>option.kind==='draw');
  if(!draw||!performAction(draw))break;
  drawn++;
 }
 const count=drawn===1?'1 Karte':drawn+' Karten';
 if(drawn)botSay('Draw Phase: Bot zieht '+count+(hasPresence?' für seine Hand.':' für den Wiederaufbau.')+' Hand: '+hand.length+' Karten.');
 else botSay('Draw Phase: Bot behält seine Force. '+(needed>0?'Force Pile oder Life Force begrenzen das Nachziehen.':'Die Hand ist ausreichend gefüllt.'));
}
function botDrain(){
 const choice=legalActions(state,'Dark').filter(x=>x.kind==='drain').sort((a,b)=>b.amount-a.amount)[0];
 if(!choice||!performAction(choice))return false;
 botSay('Control: Dark Side sagt Force Drain bei '+state.locations[choice.args[0]].name+' an.');
 publishGame();
 return true;
}
function endTurn(side){
 checkpoint('phase:end',()=>checkpoint('turn:end',()=>{
  resolveDroidDetectors();
  settleBeggarLoans();
  recirculateBoth();
  if(side===botSide())botSay('Bot beendet seinen Lernzug.');
  const next=PremiereGame.otherSide(side);
  PremiereGame.resetTurn(state,next);
  if(side==='Dark')state.turn++;
  state.log=[];
  if(next===botSide())botBegin();
  else {state.botTurn=null;log(next+' Side beginnt mit Activate.');}
  checkpoint('turn:start',()=>checkpoint('phase:start',()=>{}));
 }));
}
function checkpoint(event,next){
 const proceed=()=>PremiereGame.checkpoint(state.game,event,state.activeSide,next);
 return hothEnabled()?hothCheckpoint(event,proceed):proceed();
}
function changePhase(phase){
 if(phase===state.phase)return;
 if(state.phase===3&&phase!==3&&offerMandatoryCreatureAttack(()=>changePhase(phase)))return;
 checkpoint('phase:end',()=>{
  PremiereGame.setPhase(state,phase);
  if(phase===1&&(currentGame()?.cardRulesVersion??latestCardRulesVersion)>=9&&state.game)applyWuher(true);
  checkpoint('phase:start',()=>{});
 });
}

function restoreIonDamage(){
 if(state.phase!==1||PremiereGame.responseWindow(state.game))return;
 for(const {card:ship,unavailable} of PremiereLocations.entries(state,state.activeSide)){
  if(ship.type!=='Starship'||unavailable||!ship.ionDamage&&!(hothEnabled()&&ship.hothIonDamage))continue;
  const technician=ship.occupants?.find(({card})=>PremiereUnits.active(card)&&activeCardRules(card,'ionRepair').length)?.card;
  if(!technician)continue;
  delete ship.ionDamage;
  delete ship.hothIonDamage;
  log(technician.name+' repariert die Ionenschäden an '+ship.name+'.');
 }
}
function advance(){
 if(!state||state.gameWinner||state.pendingForceLoss||battleSession||state.botTurn||
    (state.phase===0&&!state.activated))return false;
 if(state.phase===4){
  const side=botSide(),move=chooseBotSeekerMove(seekerMoves(side));
  const spy=undercoverMoves(side).find(({site,to,cost})=>
   !PremiereLocations.icons(state,site,side)&&PremiereLocations.icons(state,to,side)>cost&&
   PremiereLocations.control(state,state.activeSide,to,cardAbility)===true);
  if(spy)return performSpyAction(side,...spy.args);
  if(move)return moveSeeker(side,...move.args);
 }
 if(state.phase===5)endTurn(playerSide());
 else changePhase(state.phase+1);
 return true;
}
function advanceBotStep(kind){
 const steps={activate:0,control:1,deploy:2,battle:3,move:4,draw:5,finish:5};
 state.botTurn.index++;
 if(kind==='finish')endTurn(botSide());
 else {
  changePhase(steps[kind]);
  if(state.game?.timing.pending)state.botTurn.decision=kind;
 }
 return true;
}

function battleAbilityAt(card,slot){
 if(hothEnabled()&&HothRules.combat(card))return craftStats(card,slot).ability;
 if(card.type==='Starship')return craftStats(card,slot).ability;
 if((currentGame()?.cardRulesVersion??latestCardRulesVersion)>=24&&card.type==='Vehicle'&&PremiereUnits.enclosed(card)){
  const driver=craftStats(card,slot).powered&&card.occupants?.find(({card,role})=>role==='driver'&&PremiereUnits.active(card)&&!card.asleep);
  if(driver)return battleCardAbility(driver.card);
 }
 return battleCardAbility(card);
}

function battleTotals(i,initiator=battleSession?.site===i?battleSession.initiator:null,
 participants=battleSession?.segmented&&battleSession.site===i?battleSession.participants:null){
 const ability=(cards,side)=>{
  const values=cards.map(card=>battleAbilityAt(card,i));
  const known=Math.max(0,values.reduce((sum,value)=>sum+(Number.isFinite(value)?value:0),0)-jediAbilityReduction(side,i)+
   (battleSession?.site===i?battleSession.obiAssistance?.[side]??0:0));
  return values.some(value=>value===null)&&known<4?null:known;
 };
 const presentAt=side=>PremiereLocations.presentCards(state,side,i).filter(card=>!excludedAtBattle(card,i));
 const lightPresent=presentAt('Light'),darkPresent=presentAt('Dark');
 const cards=(side,present)=>present.filter(card=>(!['Weapon','Device','Effect','Creature'].includes(card.type)||isHoloUnit(card))&&
  PremiereUnits.active(card)&&(!participants||participants[side].includes(card)));
 const power=(cards,side,present)=>{
  const jungle=cards.reduce((total,card)=>total+jungleBonus(card,side,i,cards),0);
  const doubled=battleSession?.site===i?battleSession.doubledPowerCards:null;
  const charges=battleSession?.site===i?battleSession.chargedTroopers:null;
  const bonus=battleSession?.site===i?battleSession.bonusPower?.[side]??0:0;
  return cards.reduce((total,card)=>{
   if(lateralDamage(card)||card.asleep)return total;
   const base=isHoloUnit(card)?printedBattleDestiny(card):['Starship','Vehicle'].includes(card.type)?craftStats(card,i).power:(card.power??0);
   const defense=initiator&&side!==initiator?activeCardRules(card,'defendingPower')[0]?.amount??0:0;
   const partner=initiator?combatPartnerPower(card,side,i):0;
   const charge=charges?.get(card),chargePower=charge?.amount??0;
   const basePower=Math.max(0,base+defense+partner+cardPowerModifier(card,side,i,present)-tacticalPenalty(card)+(initiator?saberTraining(card)?.amount??0:0));
   return total+(basePower+(charge?.afterDouble?0:chargePower))*(doubled?.has(card)?2:1)+(charge?.afterDouble?chargePower:0);
  },jungle+bonus+kiffexPower(side,i)+fleetPowerAtSite(side,i)+rebelPlannerPower(side,i)+droidRebelPower(i,present)+
    (initiator?fearPowerAtSite(side,i)+orbitalSupportPower(side,i)+spyBattlePower(side,i):0)+dockingControlPower(side,i)+
    sentryModifier(side,i,'power')+tuskenGroupPower(present)-migPowerPenalty(side,i)+(hothEnabled()?hothBattlePower(side,i):0));
 };
 const light=cards('Light',lightPresent),dark=cards('Dark',darkPresent);
 return {lightPower:power(light,'Light',lightPresent),darkPower:power(dark,'Dark',darkPresent),
  lightAbility:ability(light,'Light'),darkAbility:ability(dark,'Dark')};
}

function spyBattlePower(side,slot){
 if(side!=='Light')return 0;
 return PremiereGame.sides.flatMap(actor=>undercoverSpies(actor,slot)).reduce((power,{card,side:owner})=>
  activeCardRules(card,'spyBattlePower').length?power+Math.max(0,(card.power??0)+cardPowerModifier(card,owner,slot,[])):power,0);
}

function dockingControlPower(side,slot){
 if(!state.locations[slot]||locationTitle(state.locations[slot])!=='death star: docking bay 327')return 0;
 const control=state.locations.findIndex(location=>location&&locationTitle(location)==='death star: docking control room 327');
 if(control<0)return 0;
 return PremiereLocations.presentCards(state,side,control).reduce((power,card)=>
  power+(activeCardRules(card,'dockingControlPower')[0]?.amount??0),0);
}

function migPowerPenalty(side,site){
 if(!isSite(state.locations[site]))return 0;
 return PremiereLocations.entries(state,PremiereGame.otherSide(side)).filter(entry=>entry.card.migTarget&&!entry.unavailable&&
  PremiereLocations.physicalPlace(entry)===entry.slot&&(entry.slot===site||adjacentSites(entry.slot,site))).length;
}

function droidRebelPower(slot,present){
 if(!isSite(state.locations[slot]))return 0;
 const bonus=present.flatMap(card=>activeCardRules(card,'droidRebelPairs'))[0]?.amount??0;
 return bonus*Math.min(present.filter(isDroid).length,present.filter(card=>card.type==='Character'&&card.subType==='Rebel').length);
}

function jediAbilityReduction(side,slot){
 if((currentGame()?.cardRulesVersion??latestCardRulesVersion)<19||!state.locations[slot]||!isSite(state.locations[slot]))return 0;
 if(PremiereLocations.presentCards(state,side,slot).some(forceUser))return 0;
 const opponents=PremiereLocations.presentCards(state,PremiereGame.otherSide(side),slot);
 return Math.max(0,...opponents.flatMap(card=>(card.attachments??[]).flatMap(effect=>
  activeCardRules(effect,'reduceOpposingAbility').map(rule=>rule.amount))));
}

function jungleBonus(card,side,slot,participants){
 const rule=PremiereLocations.ruleAt(state,slot,side,'aloneInJungle');
 if(!rule||card.subType!==rule.subtype||!PremiereUnits.active(card))return 0;
 const legacy=(currentGame()?.cardRulesVersion??latestCardRulesVersion)<rule.since;
 const alone=legacy?participants.length===1:PremiereLocations.entries(state,side).every(entry=>
  entry.slot!==slot||entry.card===card||entry.unavailable||!PremiereUnits.active(entry.card)||
  (entry.card.type!=='Character'&&!(cardAbility(entry.card)>0)));
 return alone?rule.amount:0;
}

function fleetPowerAtSite(side,slot){
 if(hothEnabled()&&side==='Dark'&&HothRules.shielded(state,slot))return 0;
 const region=sitePlanet(state.locations[slot]);
 if(!region)return 0;
 return state.locations.reduce((total,loc,system)=>{
  if(!loc||!isSystem(loc)||!activeCardRules(loc,'fleetPower').some(rule=>rule.region===region)||
     PremiereLocations.control(state,side,system,cardAbility)!==true)return total;
  return total+PremiereLocations.presentCards(state,side,system).filter(ship=>ship.type==='Starship'&&PremiereUnits.active(ship)).length;
 },0);
}

function orbitalSupportPower(side,slot){
 if(hothEnabled()&&side==='Dark'&&HothRules.shielded(state,slot))return 0;
 const loc=state.locations[slot],region=sitePlanet(loc);
 if(!region||!isSite(loc)||!loc.locationTags?.includes('Planet'))return 0;
 const system=state.locations.findIndex(location=>isPlanetSystem(location)&&locationGroup(location)===region);
 if(system<0)return 0;
 return Math.max(0,...PremiereLocations.presentCards(state,side,system).filter(PremiereUnits.active)
  .flatMap(ship=>activeCardRules(ship,'orbitalSupportPower').map(rule=>rule.amount)));
}

function rebelPlannerPower(side,slot){
 const location=state.locations[slot];
 if(side!=='Light'||!location||!state.locationEffects||!isSystem(location)&&location.subType!=='Sector')return 0;
 const region=locationGroup(location),sites=state.locations.flatMap((loc,index)=>sitePlanet(loc)===region?[index]:[]);
 const planner=sites.find(site=>PremiereLocations.effectsAt(state,site).some(({card})=>activeCardRules(card,'plannerPower').length));
 if(planner===undefined)return 0;
 const ships=PremiereLocations.presentCards(state,side,slot).filter(card=>card.type==='Starship'&&PremiereUnits.active(card)).length;
 const dodonna=PremiereLocations.entries(state,side).find(entry=>!entry.unavailable&&PremiereUnits.active(entry.card)&&activeCardRules(entry.card,'plannerSupport').length);
 return dodonna?dodonna.slot===planner?2*ships:ships+1:ships;
}

function fearPowerAtSite(side,slot){
 if(hothEnabled()&&side==='Dark'&&HothRules.shielded(state,slot))return 0;
 const region=sitePlanet(state.locations[slot]);
 if(!region||!state.tableEffects?.length)return 0;
 return state.tableEffects.some(({card,host})=>{
  if(!host||card.side!==side||!activeCardRules(card,'controlledSitePower').length)return false;
  const entry=PremiereLocations.findEntry(state,host),location=entry&&state.locations[entry.slot];
  return !entry?.unavailable&&location&&PremiereUnits.active(host)&&(isSystem(location)||location.subType==='Sector')&&
   locationGroup(location)===region&&PremiereLocations.control(state,side,entry.slot,cardAbility)===true;
 })?1:0;
}

function excludedFromCurrentBattle(card){
 if(hothEnabled()&&hothEffects('Dark:1142').some(effect=>effect.host===card))return true;
 if(hothEnabled()&&card.searchPartyTurn===state.game.timing.turn&&
   (battleSession?.initiator??state.activeSide)===(PremiereLocations.findEntry(state,card)?.side??card.owner??card.side))return true;
 return card.noBattleTurn!==undefined&&card.noBattleTurn===state.game?.timing.turn||card.excludedFromBattle||battleSession?.excludedUnits?.has(card)||card.cannotBattle||barredThisTurn(card);
}

function excludedAtBattle(card,slot){
 return (currentGame()?.cardRulesVersion??latestCardRulesVersion)>=25&&battleSession?.segmented&&
  battleSession.site===slot&&excludedFromCurrentBattle(card);
}

function battleCandidates(side,slot){
 const {board}=PremiereGame.zones(state,side);
 function units(card){
  if(!PremiereUnits.active(card)&&state.besiegedBattle)return (card.occupants??[]).flatMap(entry=>units(entry.card));
  if(!PremiereUnits.active(card)||excludedFromCurrentBattle(card)||['Weapon','Device','Effect','Creature'].includes(card.type)&&!isHoloUnit(card))return [];
  return [card,...(card.occupants??[]).filter(entry=>!['cargo','hangar'].includes(entry.role)).flatMap(entry=>units(entry.card))];
 }
 return (board?.[slot]??[]).flatMap(units).concat(hothEnabled()?(state.locationWeapons?.[slot]??[]).filter(card=>(card.owner??card.side)===side&&HothRules.artillery(card)):[]);
}

function battlePresence(side,slot){
 const x=battleSession;
 const candidates=battleCandidates(side,slot).filter(card=>!state.battledCardsThisTurn?.includes(card)||
  (x?.site===slot&&x.participants?.[side].includes(card)));
 if(x?.restrictedFighters&&x.site===slot)return candidates.some(card=>x.restrictedFighters[side].includes(card));
 return candidates.some(card=>card.presence===true||typeof dagobahEnabled==='function'&&dagobahEnabled()&&['Dark:9','Dark:1245'].includes(card.id)&&!PremiereUnits.textSuppressed(card)||hothEnabled()&&['Light:1404','Dark:1950'].includes(card.id)&&!PremiereUnits.textSuppressed(card))||candidates.reduce((sum,card)=>sum+(cardAbility(card)??0),0)>=1;
}

function battleParticipantsAt(side,site,previous=[],restricted=null){
 return battleCandidates(side,site).filter(card=>(!restricted||restricted.includes(card))&&
  (previous.includes(card)||!state.battledCardsThisTurn?.includes(card)));
}

function refreshBattleParticipants(){
 const x=battleSession;
 if(!x?.segmented)return;
 for(const side of PremiereGame.sides){
  const entries=battleParticipantsAt(side,x.site,x.participants[side],x.restrictedFighters?.[side]);
  for(const card of entries)if(!state.battledCardsThisTurn?.includes(card))(state.battledCardsThisTurn??=[]).push(card);
  x.participants[side]=entries;
 }
}

function combatPartnerPower(card,side,slot){
 const [rule]=activeCardRules(card,'combatPartner');
 if(!rule||!isSite(state.locations[slot]))return 0;
 const opponent=PremiereGame.otherSide(side);
 if(PremiereLocations.presentCards(state,opponent,slot).some(weapon=>PremiereWeapons.definition(weapon)?.saber))return 0;
 const together=PremiereGame.sides.some(actor=>PremiereLocations.entries(state,actor)
  .some(entry=>entry.slot===slot&&!entry.unavailable&&entry.card.id==='Dark:768'));
 return together?rule.amount:0;
}

function canInitiateBattleFor(side,i){
 if(!state||state.phase!==3||state.activeSide!==side||state.gameWinner||state.pendingForceLoss||battleSession)return false;
 if((side===botSide())!==!!state.botTurn)return false;
 const force=side==='Light'?state.force:state.botForce;
 if(!Number.isInteger(i)||i<0||!state.locations?.[i]||!force||forceBudget(side)<battleInitiationCost(i))return false;
 if(state.battledSitesThisTurn?.includes(i))return false;
 return battlePresence('Light',i)&&battlePresence('Dark',i);
}

function canInitiateBattle(i){return canInitiateBattleFor('Light',i)}

function battleInitiationCost(slot){
 if((currentGame()?.cardRulesVersion??latestCardRulesVersion)<15)return 1;
 const entries=PremiereGame.sides.flatMap(side=>PremiereLocations.entries(state,side))
  .filter(entry=>entry.slot===slot&&!entry.unavailable);
 const trevagg=entries.find(({card})=>activeCardRules(card,'battleCostFromIcons').length);
 if(!trevagg)return 1;
 const place=PremiereLocations.physicalPlace(trevagg);
 if(entries.some(entry=>isDroid(entry.card)&&PremiereLocations.physicalPlace(entry)===place))return 1;
 return place===slot?PremiereGame.sides.reduce((sum,side)=>sum+(PremiereLocations.icons(state,slot,side)??0),0):0;
}

function initiateBattleFor(side,i,restrictedFighters=null,extra=0){
 if(!restrictedFighters&&!canInitiateBattleFor(side,i))return false;
 const force=side==='Light'?state.force:state.botForce,used=side==='Light'?state.used:state.botUsed;
 const cost=battleInitiationCost(i);
 if(!restrictedFighters)spendForce(side,cost);
 if(!state.battledSitesThisTurn)state.battledSitesThisTurn=[];
 state.battledSitesThisTurn.push(i);
 battleSession={site:i,initiator:side,lightDestiny:null,darkDestiny:null,lightCard:null,darkCard:null,lightLoss:[],darkLoss:[],weaponHits:{Light:[],Dark:[]},resolved:false,lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0,botForfeitsPending:true};
 if(state.game){
  Object.assign(battleSession,{segmented:true,segment:'initiation',participants:{Light:[],Dark:[]},
   extraDraws:{Light:0,Dark:0},powerDestiny:{Light:0,Dark:0},attritionDestiny:{Light:0,Dark:0},
   battleDrawSucceeded:{Light:false,Dark:false},hitUnits:{Light:[],Dark:[]}});
  if(restrictedFighters){battleSession.restrictedFighters=restrictedFighters;battleSession.extraDraws[side]=extra;}
  refreshBattleParticipants();
 }
 log(side+' initiiert Battle bei '+state.locations[i].name+(restrictedFighters?' durch Local Trouble':' ('+cost+' Force → Used Pile)')+'.');
 const version=state.game?.cardRulesVersion??latestCardRulesVersion;
 const prophetess=side==='Dark'&&state.game&&PremiereLocations.presentCards(state,side,i).find(card=>
  PremiereUnits.active(card)&&(version<21?card.id==='Dark:1958':activeCardRules(card,'battlePrediction').length));
 if(prophetess)battleSession.prediction={card:prophetess,winner:null};
 else beginBattleResponses();
 publishGame();return true;
}

function beginBattleResponses(){
 const {initiator,site}=battleSession;
 if(offerRogueTrample(site))return;
 if(!battlePresence('Light',site)||!battlePresence('Dark',site)){battleSession=null;endBattleTiming(site);return;}
 if(!openReactWindow('battle',initiator,site))enterBattleSegments();
}

function obiAssistOptions(side){
 const x=battleSession;
 if(!x?.segmented||x.segment!=='weapons')return [];
 const {hand}=PremiereGame.zones(state,side);
 return hand.flatMap((card,index)=>activeCardRules(card,'helpObi').flatMap(()=>
  PremiereLocations.entries(state,side).flatMap((entry,actorIndex)=>{
   const {card:obi,slot}=entry,available=battleCardAbility(obi);
   if(locationTitle(obi)!=='obi-wan kenobi'||slot===x.site||!isSite(state.locations[slot])||available<=0||
      !PremiereLocations.presentAt(entry,slot)||PremiereLocations.control(state,side,slot,cardAbility)!==true)return [];
   return Array.from({length:available},(_,n)=>({args:[index,actorIndex,n+1],card,obi,amount:n+1,
    label:card.name+' · '+(n+1)+' Ability von Obi-Wan für Battle Destiny'}));
  })));
}

function playObiAssist(side,...args){
 const option=obiAssistOptions(side).find(choice=>choice.args.every((value,i)=>value===args[i]));
 if(!option||battleSession.weaponTurn!==side)return false;
 PremiereGame.zones(state,side).hand.splice(args[0],1);
 const frame={...option,side,kind:'interrupt',interrupt:'obiAssist',site:battleSession.site,duringBattle:true};
 if(hasInterruptResponse(frame))PremiereGame.openResponse(state.game,frame);
 else settleObiAssist(frame);
 return true;
}

function settleObiAssist(frame){
 const x=battleSession,{side,obi,amount}=frame;
 if(!frame.cancelled&&x?.site===frame.site){
  const used=state.obiAbilityUsed??=new Map(),turn=state.game.timing.turn,previous=used.get(obi);
  used.set(obi,{turn,amount:(previous?.turn===turn?previous.amount:0)+amount});
  (x.obiAssistance??={Light:0,Dark:0})[side]+=amount;
  log(frame.label+'.');
 }
 finishPileInterrupt({...frame,rule:{pile:'Used'}});
}

function helpRebelOptions(side,window){
 if(side===window.side||window.kind!=='battle'||!isSite(state.locations[window.site]))return [];
 const {hand,board}=PremiereGame.zones(state,side);
 return hand.flatMap((card,index)=>activeCardRules(card,'helpRebel').flatMap(()=>board.flatMap((row,from)=>{
  if(!adjacentSites(from,window.site))return [];
  return row.flatMap((rebel,i)=>rebel.type==='Character'&&rebel.subType==='Rebel'&&!state.reactedThisTurn?.includes(rebel)?
   travelOptions(rebel,side,from,window.site,true).filter(move=>move.kind==='Landspeed'&&move.cost<=forceBudget(side)).map(move=>({
    kind:'helpRebel',card,index,from,rebel,movement:move.kind,site:window.site,cost:move.cost,
    args:[index,'helpRebel',from,i],label:card.name+' · React mit '+rebel.name+' ('+move.cost+' Force)',
   })):[]);
 })));
}

function settleHelpRebel(frame){
 const {board,used}=PremiereGame.zones(state,frame.side),index=board[frame.from].indexOf(frame.rebel);
 if(index>=0){
  board[frame.site].push(board[frame.from].splice(index,1)[0]);
  clearJuriAfterMove(frame.rebel,frame.side,frame.site);
  noteMineTraversal(frame.side,frame.from,frame.site,frame.rebel);
 }
 used.push(frame.card);
}

function chooseBattlePrediction(winner){
 battleSession.prediction.winner=winner;
 log('Prophetess sagt einen Sieg der '+winner+' Side voraus.');
 beginBattleResponses();
 return true;
}

function botPredictionAction(offers){
 if(!battleSession?.prediction)return null;
 if(plannedBot())return botPromptAction(offers);
 const {lightPower,darkPower}=battleTotals(battleSession.site);
 return offers.find(action=>action.kind==='battlePrediction'&&action.args[0]===(darkPower>=lightPower?'Dark':'Light'));
}
function enterBattleSegments(){
 checkpoint('battle:start',()=>{
  refreshBattleParticipants();
  const x=battleSession;
  if(x.segmented)x.segment='weapons';
  if(battleWeaponOptions('Light').length||battleWeaponOptions('Dark').length||
     (x.segmented&&PremiereGame.sides.some(side=>duelOptions(side).length||namedRetrievalOptions(side).length||shuffleOptions(side).length||tableCancellationOptions(side).length||locationCancellationOptions(side).length||dodonnaCounterOptions(side).length||lateralMechanicOptions(side).length||
      battleEffectOptions(side).length||abilityPowerOptions(side).length||holocamPowerOptions(side,true).length||obiAssistOptions(side).length||namedWeaponCancellationOptions(side).length||
      limitedResourcesOptions(side).length||gravelStormOptions(side).length||cardInformationOptions(side).length||pileInterruptOptions(side).length||hothEnabled()&&hothActionOptions(side).length||
      weaponEffectOptions(side).some(option=>['overload','rackIn'].includes(option.args[0])))))x.weaponTurn=x.initiator;
  else if(x.segmented)x.segment='power';
 });
}
function endBattleTiming(site,result,participants){
 delete state.besiegedBattle;
 for(const card of state.scopeHits??[]){
  const entry=PremiereLocations.findEntry(state,card);
  if(entry)loseTableCard(entry.side,entry.slot,card);
 }
 state.scopeHits=[];
 checkpoint('battle:end',()=>{
  PremiereGame.expire(state.game,'battle');
  if(Number.isInteger(site)){
   const winner=result?.lightTotal===result?.darkTotal||!result?null:result.lightTotal>result.darkTotal?'Light':'Dark';
   queueRuleResponse({kind:'finishedBattle',side:'Light',site,winner,participants});
  }
 });
}

function deathStarTractorBeams(bay){
 return PremiereLocations.effectsAt(state,bay).filter(({card})=>locationEffectRule(card)?.siteDevice==='death-star-tractor-beam');
}

function deathStarTractorOptions(side,window){
 const system=state.locations[window.site];
 if(side!=='Dark'||!system||system.id!=='Dark:654'||!state.game||forceBudget(side)<2)return [];
 const bay=state.locations.findIndex(isDockingBay327);
 if(bay<0)return [];
 const targets=PremiereLocations.presentCards(state,'Light',window.site).filter(card=>card.type==='Starship'&&
  !/mon calamari star cruiser/i.test(card.subType));
 return deathStarTractorBeams(bay).flatMap(({card},i)=>window.tractorUsed?.includes(card)?[]:targets.map((target,j)=>({
  kind:'tractorBeam',args:[-1,'tractorBeam',i,j],index:-1,card,target,bay,site:window.site,cost:2,
  label:card.name+' · '+target.name+' einfangen (2 Force)',
 })));
}

function tractorShipCrew(ship){
 return (ship.occupants??[]).flatMap(({card})=>card.type==='Character'?[card]:tractorShipCrew(card));
}

function settleTractorBeam(frame){
 drawDestinySeries(frame.side,'tractorBeam',frame.holder?1:2,hothEnabled()?(frame.hothDestinyBonus??0)+(frame.holder?.id==='Dark:2657'?1:0):0,draws=>{
  const {card,target,bay,site}=frame,entry=PremiereLocations.findEntry(state,target);
  const defense=PremiereWeapons.defense(target,cardAbility(target),craftStats(target,site)),total=PremiereBattle.total(draws);
  if(entry?.slot!==site||entry.unavailable||!Number.isFinite(defense)||!Number.isFinite(total)||total<=defense||!(frame.holder?frame.holder.attachments?.includes(card):deathStarTractorBeams(bay).length))return;
  if(!tractorShipCrew(target).length){if(typeof dagobahEnabled==='function'&&dagobahEnabled())dagoShipCaptured(target,entry.side);takeStolenTableCard('Dark',card,entry);return;}
  if(!detachTableCard(entry.side,site,target))return;
  if(typeof dagobahEnabled==='function'&&dagobahEnabled())dagoShipCaptured(target,entry.side);
  target.inactive=true;
  target.tractorCaptured=true;
  PremiereGame.zones(state,entry.side).board[bay].push(target);
  (state.capturedShips??=[]).push({ship:target,bay,site,side:entry.side,beam:card,holder:frame.holder});
  log(card.name+' hält '+target.name+' an Docking Bay 327 fest.');
 });
}

function updateCapturedStarships(){
 if(!state.capturedShips?.length||state.pendingCardView)return;
 for(const record of state.capturedShips.slice()){
  const {ship,bay,side,beam,site}=record,entry=PremiereLocations.findEntry(state,ship);
  if(!entry){state.capturedShips.splice(state.capturedShips.indexOf(record),1);continue;}
  if(!tractorShipCrew(ship).length){
   const besieged=ship.attachments?.find(card=>activeCardRules(card,'besieged').length);if(besieged)loseTableCard(side,bay,besieged);
   delete ship.inactive;
   delete ship.tractorCaptured;
   if(takeStolenTableCard('Dark',beam,{...entry,slot:bay})){
    state.dark[bay].splice(state.dark[bay].indexOf(ship),1);
    state.dark[site].push(ship);
   }
   state.capturedShips.splice(state.capturedShips.indexOf(record),1);
  }else if(!(record.holder?PremiereLocations.findEntry(state,record.holder)&&record.holder.attachments?.includes(beam):deathStarTractorBeams(bay).length)){
   state.pendingCardView={mode:'tractorRelease',card:ship,side,shown:[],record};
   return;
  }
 }
}

function releaseCapturedStarship(record,launch){
 const {ship,side,bay,site}=record,{board}=PremiereGame.zones(state,side);
 if(!detachTableCard(side,bay,ship))return false;
 delete ship.inactive;
 delete ship.tractorCaptured;
 if(launch)board[site].push(ship);
 else{
  const move=card=>activeCardRules(card,'besieged').length?loseOwnedCard(card,card.side):PremiereGame.zones(state,card.owner??card.side??side).used.push(card);
  PremiereUnits.remove(ship,move,move);
 }
 state.capturedShips.splice(state.capturedShips.indexOf(record),1);
 state.pendingCardView=null;
 log(ship.name+(launch?' startet wieder im Todesstern-System.':' entkommt auf die Used Pile.'));
 updateCapturedStarships();
 return true;
}

function tractorDisembarkOptions(side){
 if(state.activeSide!==side||state.phase!==4)return [];
 return (state.capturedShips??[]).flatMap(({ship,bay,side:owner},index)=>{
  if(owner!==side||PremiereLocations.presence(state,'Dark',bay,cardAbility)!==false)return [];
  return (ship.occupants??[]).flatMap(({card},i)=>card.type==='Character'?[{args:[index,i],card,site:bay,
   label:card.name+' · aus gefangenem '+ship.name+' aussteigen'}]:[]);
 });
}

function battleAnalysis(i){return initiateBattleFor('Light',i)}
// Printed Premiere site requirements may raise the destiny threshold for one side.

function minimumBattleDestinyAbility(side,siteIndex){
 if(side!=='Light'&&side!=='Dark')return null;
 const loc=state?.locations?.[siteIndex];
 if(!loc||!isLoc(loc))return 4;
 const entries=isSite(loc)?siteEntries(siteIndex):[];
 const doikk=entries.find(entry=>activeCardRules(entry.card,'musicianBattleAbility').length&&!excludedAtBattle(entry.card,siteIndex));
 const musicians=doikk?entries.filter(entry=>entry.card!==doikk.card&&characterTraits(entry.card).includes('musician')&&
  !excludedAtBattle(entry.card,siteIndex)).length:0;
 const sentry=sentryModifier(side,siteIndex,'destiny')+musicians;
 const registered=PremiereLocations.ruleAt(state,siteIndex,side,'minimumBattleAbility');
 if(registered)return registered.amount+sentry;
 for(const clause of String(loc.gametext||'').matchAll(/(?:^|[.!?]\s+)(Light|Dark):\s*Total ability of (\d+) or more required for you to draw battle destiny here(?:[.!?]|$)/gi)){
  if(clause[1].toLowerCase()===PremiereLocations.printedSide(state,siteIndex,side).toLowerCase()){
   return Number(clause[2])+sentry;
  }
 }
 return 4+sentry;
}
// This bonus applies to each actual Dark Side battle destiny draw; not weapon destiny or skips.

function alderaanBattleDestinyPenalty(side,siteIndex){
 const loc=state.locations[siteIndex],opponent=PremiereGame.otherSide(side);
 const printed=PremiereLocations.printedSide(state,siteIndex,opponent);
 const rule=activeCardRules(loc,'opponentBattleDestiny').find(rule=>rule.printedSide===printed);
 return rule?-rule.amount:0;
}

function vaderBattleDestinyBonus(side,siteIndex){
 if(side!=='Dark')return 0;
 const units=battleSession?.segmented?activeBattleUnits(side):state?.dark?.[siteIndex]??[];
 return Math.max(0,...units.flatMap(card=>/When in battle, adds 1 to each of your battle destiny draws/i.test(card.gametext||'')?
  activeCardRules(card,'battleDestiny').map(rule=>rule.amount):[]));
}

function printedBattleDestiny(card){
 return card&&isLoc(card)?0:PremiereBattle.printedDestiny(card);
}
// Two printed Premiere War Room effects grant an additional battle destiny
// to the side that initiated battle here. These are actual Reserve Deck draws.

function printedWarRoomExtraBattleDestiny(side,siteIndex,initiator=battleSession?.initiator){
 const loc=state?.locations?.[siteIndex];
 if(initiator!==side||!isSite(loc))return 0;
 if((currentGame()?.cardRulesVersion??latestCardRulesVersion)>=21){
  return PremiereLocations.rulesAt(state,siteIndex,side,'extraBattleDestiny').reduce((total,rule)=>total+rule.amount,0);
 }
 const printed=PremiereLocations.printedSide(state,siteIndex,side);
 const rule=PremiereCardRules.effects(loc,'extraBattleDestiny').find(rule=>rule.printedSide===printed);
 const pattern=new RegExp('(?:^|[.!?]\\s+)'+printed+':\\s*If you initiate a battle here, add one battle destiny(?:[.!?]|$)','i');
 return rule&&pattern.test(loc.gametext??'')?rule.amount:0;
}

function duelOptions(side){
 if(side!=='Dark'||!state.game||!ownForceBudget(side))return [];
 const copies=state.botHand.flatMap((card,index)=>card.id==='Dark:2517'?[{card,index}]:[]);
 if(!copies.length)return [];
 return state.locations.flatMap((loc,site)=>{
  if(!isSite(loc))return [];
  const character=(player,name)=>PremiereLocations.presentCards(state,player,site)
   .find(card=>card.type==='Character'&&locationTitle(card)===name&&(PremiereUnits.active(card)||card.undercover)&&Number.isFinite(card.power));
  const vader=character('Dark','darth vader'),obi=character('Light','obi-wan kenobi');
  if(!vader||!obi)return [];
  return copies.map(({card,index})=>({args:[index,site],card,site,vader,obi,cost:1,
   label:card.name+' · Duell bei '+loc.name+' (1 Force)'}));
 });
}

function registerDuelTiming(){
 if(botSide()!=='Dark')return;
 const choice=()=>{
  const options=duelOptions('Dark');
  return plannedBot()?choosePlannedBotAction(options.map(option=>({...option,kind:'duel'}))):options[0];
 };
 PremiereGame.registerTrigger(state.game,{id:'premiere-duel',side:'Dark',scope:'game',event:'phase:priority',
  label:'Bot-Aktion zeigen',
  when:()=>state.activeSide==='Light'&&!!choice(),
  resolve(){const duel=choice();if(duel)playDuel('Dark',...duel.args);}});
}

function playDuel(side,...args){
 const choice=duelOptions(side).find(entry=>entry.args.every((value,i)=>value===args[i]));
 if(!choice)return false;
 const {hand}=PremiereGame.zones(state,side);
 hand.splice(args[0],1);
 spendForce(side);
 const frame={...choice,kind:'interrupt',interrupt:'duel',side,duringBattle:!!battleSession};
 log(choice.card.name+' · Vader und Obi-Wan duellieren sich bei '+state.locations[choice.site].name+'.');
 if(hasInterruptResponse(frame))PremiereGame.openResponse(state.game,frame);
 else settleDuel(frame);
 return true;
}

function settleDuel(frame){
 if(!frame.cancelled){
  const power=(card,side)=>Math.max(0,(card.asleep?0:card.power+cardPowerModifier(card,side,frame.site)-tacticalPenalty(card)))+
   (ownLightsaber(card)?2:0);
  const dark=power(frame.vader,'Dark'),light=power(frame.obi,'Light');
  const result='Duell · Vader '+dark+' / Obi-Wan '+light;
  if(dark===light)log(result+' · Gleichstand.');
  else{
   const loser=dark<light?frame.vader:frame.obi,side=dark<light?'Dark':'Light';
   if(loseTableCard(side,frame.site,loser,true))log(result+' · '+loser.name+' ist aus dem Spiel.');
  }
 }
 loseOwnedCard(frame.card,frame.side);
 if(frame.duringBattle&&battleSession?.weaponTurn===frame.side)finishWeaponAction(frame.side,false);
}

function battleEffectOptions(side){
 const x=battleSession;
 if(!x?.segmented||x.segment!=='weapons')return [];
 const own=x.participants[side].filter(card=>battleCandidates(side,x.site).includes(card));
 const names=new Set(own.map(locationTitle));
 const {hand}=PremiereGame.zones(state,side);
 const version=state.game?.cardRulesVersion??latestCardRulesVersion;
 const eligible=new Map([
  ['Light:758',names.has('luke skywalker')&&names.has('han solo')&&
   (version<21||!PremiereGame.wasUsed(state.game,'turn','Light:758'))],
  ['Light:2277',names.has('luke skywalker')&&names.has('leia organa')&&
   (version<21||!PremiereGame.wasUsed(state.game,'turn','Light:2277'))],
  ['Light:1039',names.has('luke skywalker')&&(names.has('obi-wan kenobi')||
   ((currentGame()?.cardRulesVersion??latestCardRulesVersion)>=10&&names.has('yoda')))],
  ['Dark:613',names.has('grand moff tarkin')&&(names.has('admiral motti')||names.has('general tagge'))]
 ]);
 const holoOptions=isHoloSite(state.locations[x.site])?(hand??[]).flatMap((card,index)=>activeCardRules(card,'holositeDestiny').map(()=>({args:[index,1],card,draws:1,label:card.name+' · ein Battle Destiny am Holosite'}))):[];
 const options=holoOptions.concat((hand??[]).flatMap((card,index)=>eligible.get(card.id)?[{args:[index],card,label:card.name+' · zwei Battle Destiny hinzufügen'}]:[]));
 const involved=new Set(PremiereGame.sides.flatMap(actor=>activeBattleUnits(actor)).map(locationTitle));
 if(involved.has('darth vader')&&involved.has('obi-wan kenobi')){
  for(const [index,card] of (hand??[]).entries()){
   const rule=activeCardRules(card,'vaderObiDestiny')[0];
   if(rule)options.push({args:[index,rule.draws],card,draws:rule.draws,label:card.name+' · eine Battle Destiny hinzufügen'});
  }
 }
 if((currentGame()?.cardRulesVersion??latestCardRulesVersion)>=11){
  const qualified=own.filter(card=>card.type==='Character'||(cardAbility(card)??0)>0);
  const lone=x.initiator!==side&&qualified.length===1?qualified[0]:null;
  const permanentPilot=lone?.type==='Starship'&&permanentPilotAbility(lone)!==null&&
   !/permanent pilots\b/i.test(lone.gametext)&&craftStats(lone,x.site).powered;
  const location=state.locations[x.site];
  const enemy=activeBattleUnits(PremiereGame.otherSide(side));
  for(const [index,card] of (hand??[]).entries()){
   const modes=activeCardRules(card,'defendingDestiny').filter(rule=>lone&&
    (lone.type==='Character'||rule.pilot&&permanentPilot)&&(!rule.siteOnly||isSite(location))&&
    (!rule.spaceOnly||isSystem(location)||location.subType==='Sector')&&
    (!rule.character||locationTitle(lone)===rule.character)&&(!rule.except||locationTitle(lone)!==rule.except)&&
    (!rule.subType||lone.subType===rule.subType)&&(!rule.warrior||PremiereUnits.hasSkill(lone,'warrior'))&&(!rule.pilot||PremiereUnits.hasSkill(lone,'pilot')||permanentPilot)&&
    (!rule.minimumAbility||cardAbility(lone)>=rule.minimumAbility));
   for(const rule of activeCardRules(card,'opposedDestiny')){
    if(rule.ownRank?!own.some(unit=>unit.extraText?.includes(rule.ownRank)):!names.has(rule.own))continue;
    for(const [targetIndex,target] of enemy.entries()){
     if(target.type!=='Character'||target.subType!==rule.opponent||!(cardAbility(target)>2))continue;
     const drawCount=locationTitle(target)===rule.special?2:1;
     options.push({args:[index,drawCount,targetIndex],card,draws:drawCount,target,
      label:card.name+' · '+drawCount+' Battle Destiny gegen '+target.name+' hinzufügen'});
    }
   }
   for(const {draws,power} of modes){
    options.push({args:power?[index,draws,null,power]:[index,draws],card,draws,bonusPower:power,
     label:card.name+' · '+(power?'+'+power+' Power und ':'')+draws+' Battle Destiny hinzufügen'});
   }
   const [charge]=activeCardRules(card,'trooperCharge');
   if(charge)for(const [targetIndex,target] of own.entries()){
    if(!matchesRegisteredTarget(target,'imperial-trooper')||x.chargedTroopers?.has(target))continue;
    const amount=target.id==='Dark:668'?charge.specialAmount:charge.amount;
    options.push({args:[index,'charge',targetIndex],card,charge:{target,amount},
     label:card.name+' · '+target.name+' (+ '+amount+' Power, Pflicht-Forfeit)'});
   }
   const [power]=activeCardRules(card,'doubleBattlePower');
   if(!power||forceBudget(side)<power.cost)continue;
   for(const [jediIndex,jedi] of own.entries()){
    if(!jedi.extraText?.includes(power.rank)||!PremiereLocations.present(state,jedi,x.site))continue;
    const powerTargets=[...own,...enemy].filter(unit=>unit!==jedi&&unit.type==='Character'&&unit.subType===power.faction&&
     PremiereLocations.present(state,unit,x.site)&&!x.doubledPowerCards?.has(unit));
    if(powerTargets.length)options.push({args:[index,null,jediIndex],card,cost:power.cost,powerTargets,
     label:card.name+' · '+jedi.name+' · Kampf-Power verdoppeln (1 Force)'});
   }
  }
 }
 const hit=x.lastHit;
 if((currentGame()?.cardRulesVersion??latestCardRulesVersion)<21&&hit&&own.some(card=>card.id==='Dark:768'&&card!==hit.card&&PremiereLocations.present(state,card,x.site))&&
  hit.card.type==='Character'&&PremiereLocations.present(state,hit.card,x.site)){
  options.push({args:[-1],card:hit.card,label:'Dr. Evazan operiert '+hit.card.name});
 }
 return options;
}

function abilityPowerSources(side){
 const x=battleSession;
 if(!x?.segmented)return [];
 return activeBattleUnits(side).filter(card=>PremiereLocations.present(state,card,x.site)).map(card=>({
  card,ability:battleAbilityAt(card,x.site),
 }));
}

function abilityPowerOptions(side){
 const x=battleSession;
 if(!x?.segmented||x.segment!=='weapons')return [];
 const effect=(state.tableEffects??[]).find(({card,target})=>target===side&&activeCardRules(card,'convertAbilityToPower').length);
 if(!effect)return [];
 const sources=abilityPowerSources(side);
 return sources.flatMap(({card,ability},sourceIndex)=>{
  const spent=x.powerAbilitySpent?.get(card)??0;
  const maximum=Math.max(0,Math.min(forceBudget(side),Math.floor(ability??0)-spent));
  return Array.from({length:maximum},(_,index)=>({
   args:[sourceIndex,index+1],card,amount:index+1,label:effect.card.name+' · '+card.name+' +'+(index+1)+' Gesamt-Power ('+(index+1)+' Force)',
  }));
 });
}

function useAbilityPower(side,index,amount){
 const option=abilityPowerOptions(side).find(choice=>choice.args[0]===index&&choice.amount===amount);
 if(!option)return false;
 const x=battleSession,{force,used}=PremiereGame.zones(state,side);
 spendForce(side,amount);
 const spent=(x.powerAbilitySpent??=new Map());
 spent.set(option.card,(spent.get(option.card)??0)+amount);
 const bonus=(x.bonusPower??={Light:0,Dark:0});
 bonus[side]+=amount;
 log(option.label+'.');
 finishWeaponAction(side,false);
 return true;
}

function playBattleEffect(side,index,draws,targetIndex,bonusPower){
 const option=battleEffectOptions(side).find(effect=>effect.args[0]===index&&effect.args[1]===draws&&
  effect.args[2]===targetIndex&&effect.args[3]===bonusPower),x=battleSession;
 if(!option||x.weaponTurn!==side)return false;
 if(index<0){
  const hit=x.lastHit,{board}=PremiereGame.zones(state,hit.side),row=board[x.site];
  const target=row.indexOf(hit.card);
  if(target<0)return false;
  removeBattleUnit(hit.side,hit.card);
  x.weaponHits[hit.side]=(x.weaponHits[hit.side]??[]).filter(i=>i!==target).map(i=>i>target?i-1:i);
  x.lastHit=null;
  log('Dr. Evazan operiert '+hit.card.name+'. Die Karte geht verloren.');
  finishWeaponAction(side,false);
  return true;
 }
 const {hand}=PremiereGame.zones(state,side);
 hand.splice(index,1);
 recordNamedInterruptUse(option.card);
 if(option.cost)spendForce(side,option.cost);
 const frame={kind:'interrupt',interrupt:'battleEffect',site:x.site,side,card:option.card,draws:option.draws??2,
  target:option.target,powerTargets:option.powerTargets,bonusPower:option.bonusPower,charge:option.charge};
 if(hasInterruptResponse(frame))PremiereGame.openResponse(state.game,frame);
 else settleBattleEffect(frame);
 return true;
}

function settleBattleEffect(frame){
 PremiereGame.zones(state,frame.side).lost.push(frame.card);
 if(!frame.cancelled){
  if(frame.powerTargets){
   const doubled=battleSession.doubledPowerCards??=new Set();
   for(const target of frame.powerTargets)doubled.add(target);
   log(frame.card.name+' verdoppelt die Kampf-Power von '+frame.powerTargets.map(target=>target.name).join(', ')+'.');
  }else if(frame.charge){
   const {target,amount}=frame.charge;
   (battleSession.chargedTroopers??=new Map()).set(target,{amount,afterDouble:battleSession.doubledPowerCards?.has(target)});
   log(target.name+' erhält durch '+frame.card.name+' +'+amount+' Power und muss forfeitet werden.');
  }else{
   scheduleBattleDestiny(frame.side,'battle',frame.draws);
   if(frame.bonusPower){
    const bonus=battleSession.bonusPower??={Light:0,Dark:0};
    bonus[frame.side]+=frame.bonusPower;
   }
   log(frame.card.name+' fügt '+(frame.draws===2?'zwei':'eine')+' Battle Destiny'+(frame.target?' gegen '+frame.target.name:'')+' hinzu.');
  }
 }
 battleSession.lastHit=null;
 finishWeaponAction(frame.side,false);
}

function scheduleBattleDestiny(side,purpose,count){
 if(purpose==='battle')battleSession.extraDraws[side]+=count;
 else (battleSession.additionalDestinies??=[]).push({side,purpose,count});
}

function battleDestinyDrawCount(side,siteIndex,ability,initiator=battleSession?.initiator){
 if(!Number.isFinite(ability))return null; // Unknown ability cannot justify an assumed draw.
 const required=minimumBattleDestinyAbility(side,siteIndex);
 const own=PremiereGame.zones(state,side).board?.[siteIndex]??[];
 const activeText=(currentGame()?.cardRulesVersion??latestCardRulesVersion)>=7;
 const backups=own.flatMap(ship=>craftStats(ship,siteIndex).powered?(ship.occupants??[]).filter(entry=>entry.role==='pilot'&&
  !excludedAtBattle(entry.card,siteIndex)&&PremiereUnits.matchingBattleDestiny(ship,entry.card,activeText)&&
  PremiereUnits.active(entry.card)&&(!activeText||!PremiereUnits.textSuppressed(entry.card))).map(entry=>entry.card):[]);
 const spent=battleSession?.powerAbilitySpent?abilityPowerSources(side).reduce((sum,{card})=>
  sum+(battleSession.powerAbilitySpent.get(card)??0),0):0;
 const newPilot=card=>['Light:2786','Dark:792'].includes(card.id);
 const captainHan=typeof cloudCityEnabled==='function'&&cloudCityEnabled()&&backups.some(card=>card.id==='Light:360')?1:0;
 const regular=ability-spent>=required||backups.some(card=>!newPilot(card)&&(!captainHan||card.id!=='Light:360'))?1:0;
 const draws=regular+captainHan+printedWarRoomExtraBattleDestiny(side,siteIndex,initiator)+(battleSession?.extraDraws?.[side]??0);
 if(backups.some(newPilot))return Math.max(1,draws);
 if(draws||!isSite(state.locations[siteIndex]))return draws;
 if(hothEnabled()&&PremiereLocations.entries(state,side).some(entry=>entry.slot===siteIndex&&!entry.unavailable&&entry.card.id==='Light:2483'&&
   !excludedAtBattle(entry.card,siteIndex)&&!PremiereUnits.textSuppressed(entry.card)&&entry.carriers.some(host=>host.id==='Light:2480')))return 1;
 const sameSite=PremiereGame.sides.flatMap(actor=>PremiereLocations.entries(state,actor)).filter(({card,slot,unavailable})=>
  slot===siteIndex&&!unavailable&&PremiereUnits.active(card));
 return sameSite.some(({card,side:actor})=>actor===side&&!excludedAtBattle(card,siteIndex)&&activeCardRules(card,'tuskenFallbackDestiny').length&&
  sameSite.some(other=>other.card!==card&&matchesRegisteredTarget(other.card,'tusken')))?1:0;
}

function drawDestinySeries(side,kind,count,modifier,complete){
 const piles=PremiereGame.zones(state,side),game=state.game,draws=[];
 function next(replacement=false){
  if(typeof dagobahEnabled==='function'&&dagobahEnabled()&&PremiereGame.isReserveInsert(piles.deck.at(-1))&&['4','5'].includes(piles.deck.at(-1).set)){dagoResolveTop(side,()=>next(replacement));return;}
  if(!replacement&&count--<=0){complete(draws);return;}
  const performDraw=()=>{
  revealReserveInserts(side);
  const draw=PremiereBattle.draw(piles,modifier);
  if(!draw){complete(draws);return;}
  if(typeof dagobahEnabled==='function'&&dagobahEnabled())delete draw.card.dagobahFaceUp;
  if(hothEnabled()&&Number.isFinite(draw.value))draw.value+=hothDrawModifier(side,draw.card);
  revealReserveInserts(side);
  const finish=frame=>{
   draws.push(PremiereBattle.settle(piles,frame.draw));
   const proceed=()=>resolveAnhDestinyTriggers(side,frame.draw,()=>next(frame.redraw));
   if(hothEnabled())hothDestinyTriggers(side,frame.draw,proceed,kind);else proceed();
  };
  const frame={kind:'destiny',purpose:kind,side,draw,site:battleSession?.site,finish};
  const resume=()=>{
   if((game?.cardRulesVersion??0)>=29&&Number.isFinite(draw.value))draw.value=Math.max(0,draw.value+clakdorDestinyModifier(draw.card)+(tonnikaFactor(draw.card)-1)*(draw.card.destiny??0));
   if(game&&(battleSession?.segmented||typeof dagobahEnabled==='function'&&dagobahEnabled())&&(PremiereGame.sides.some(actor=>destinyResponses(actor,frame).length)||typeof dagobahEnabled==='function'&&dagobahEnabled()&&hasInterruptResponse(frame)))PremiereGame.openResponse(game,frame);
   else finish(frame);
  };
  const startDraw=()=>{if(!draw.cloudCityChasm&&(game?.cardRulesVersion??0)>=29&&draw.card.id==='Light:1992')state.pendingCardView={mode:'destinyValue',side,draw,values:[2,5],modifier,shown:[draw.card],publicView:true,resume};else resume();};
  const automatic=()=>{if(typeof cloudCityEnabled==='function'&&cloudCityEnabled())ccAutomaticDestiny(side,draw,startDraw);else startDraw();};
  if(typeof dagobahEnabled==='function'&&dagobahEnabled())dagoResolveTop(side,automatic);else automatic();
  };
  if(typeof cloudCityEnabled==='function'&&cloudCityEnabled()&&kind==='battle')ccBeforeBattleCard(side,performDraw,substitute=>{draws.push(substitute);next();});else performDraw();
 }
 next();
}

function destinyResponses(side,frame){
 const x=battleSession;
 if(!x?.segmented||frame.draw.cancelled)return [];
 const {hand,deck}=PremiereGame.zones(state,side);
 const members=x.participants[side].filter(card=>battleCandidates(side,x.site).includes(card));
 const offers=[];
 const han=members.find(card=>card.id==='Light:1098'&&
  ((currentGame()?.cardRulesVersion??latestCardRulesVersion)<7||activeCardRules(card,'redrawOwnDestiny').length));
 if(side===frame.side&&forceBudget(side)&&han&&!PremiereGame.wasUsed(state.game,'battle','hanRedraw')){
  offers.push({kind:'hanRedraw',card:han,cost:1,label:'Han Solo: Destiny neu ziehen (1 Force)'});
 }
 const tarkin=members.find(card=>activeCardRules(card,'cancelBattleDraw').length);
 if(side!==frame.side&&tarkin&&members.some(card=>card.id==='Dark:634')&&
    !PremiereGame.wasUsed(state.game,'battle','tarkinCancel')){
  offers.push({kind:'tarkinCancel',card:tarkin,cost:0,label:'Tarkin: gegnerisches Destiny aufheben'});
 }
 if(side===frame.side&&frame.purpose==='battle'&&forceBudget(side)&&deck?.length&&
    members.some(card=>card.type==='Character'&&cardAbility(card)>2)){
  for(const [index,card] of (hand??[]).entries()){
   const [rule]=activeCardRules(card,'replacementBattleDestiny');
   if(rule&&forceBudget(side)>=rule.cost)offers.push({kind:'hansDice',args:['hansDice',index],card,cost:rule.cost,
    label:card.name+' · Battle Destiny ersetzen ('+rule.cost+' Force)'});
  }
 }
 return offers;
}

function answerDestiny(side,kind,index){
 const game=state.game,frame=PremiereGame.responseWindow(game);
 if(!frame||frame.kind!=='destiny'||frame.priority!==side)return false;
 const choice=destinyResponses(side,frame).find(answer=>answer.kind===kind&&answer.args?.[1]===index);
 if(!choice)return false;
 if(kind==='hansDice'){
  const {hand,force,used}=PremiereGame.zones(state,side);
  if(!PremiereGame.answer(game,side,{kind:'interrupt',interrupt:kind,site:frame.site,card:choice.card}))return false;
  hand.splice(index,1);
  spendForce(side,choice.cost);
  log(side+' spielt '+choice.card.name+'.');
  return true;
 }
 PremiereGame.useOnce(game,'battle',kind);
 if(kind==='hanRedraw'){
  const {force,used}=PremiereGame.zones(state,side);
  spendForce(side);
  frame.redraw=true;
 }
 frame.draw.cancelled=true;
 frame.priority=PremiereGame.otherSide(side);
 frame.passes=0;
 log(side+(frame.redraw?' zieht Destiny mit Han Solo neu.':' hebt Destiny mit Tarkin auf.'));
 return true;
}

function battleDestiny(side,allowResponse=true){
 if(!battleSession||battleSession.weaponTurn||state.phase!==3)return;
 const x=battleSession,t=battleTotals(x.site),light=side==='Light',key=light?'lightCard':'darkCard',val=light?'lightDestiny':'darkDestiny';
 if(x[key]!==null)return;
 const first=x.initiator==='Dark'?'Dark':'Light';if(side!==first&&x[first==='Dark'?'darkCard':'lightCard']===null){log('Zuerst entscheidet die initiierende Seite über Battle Destiny.');return}
 const ability=light?t.lightAbility:t.darkAbility,count=battleDestinyDrawCount(side,x.site,ability);
 if(count===null||count<1){log(side+' darf keine Battle Destiny ziehen (Ability '+(ability??'?')+', Mindestwert '+minimumBattleDestinyAbility(side,x.site)+').');return}
 if(allowResponse&&state.game&&PremiereGame.reserveCards(PremiereGame.zones(state,side).deck).length){
  const frame={kind:'beforeBattleDestiny',side,site:x.site};
  if(beforeBattleDestinyOptions(PremiereGame.otherSide(side),frame).length){
   PremiereGame.openResponse(state.game,frame);
   return;
  }
 }
 const vaderBonus=vaderBattleDestinyBonus(side,x.site);
 const alderaanPenalty=alderaanBattleDestinyPenalty(side,x.site);
 drawDestinySeries(side,'battle',count,vaderBonus-alderaanPenalty,draws=>{
  if(draws.length&&vaderBonus)log('Darth Vader erhöht jeden Dark-Side-Battle-Destiny-Draw um +'+vaderBonus+'.');
  if(draws.length&&alderaanPenalty)log('Alderaan reduziert den Battle-Destiny-Draw von '+side+' um 1 (Minimum 0).');
  if(!light&&t.darkPower<t.lightPower&&draws.some(draw=>!draw.cancelled&&draw.card.id==='Dark:816'&&/total power present is doubled/i.test(draw.card.gametext||''))){
   x.darkPowerDoubled=true;
   log('EG-6 als Battle Destiny gezogen: Dark-Power present ist niedriger als Light; Dark-Power present einmalig verdoppelt.');
  }
  x[key]=draws[0]?.card||{name:'Reserve Deck leer'};
  x[val]=PremiereBattle.total(draws);
  if(hothEnabled())hothBattleDestinyResult(side,draws,t);
  if(Number.isFinite(x[val])&&x.beforeDestinyReduction?.[side])x[val]=Math.max(0,x[val]-x.beforeDestinyReduction[side]);
  if(x.segmented){
   (x.drawCounts??={})[side]=draws.filter(draw=>!draw.cancelled&&Number.isFinite(draw.value)).length;
   x.battleDrawSucceeded[side]=x.drawCounts[side]>0;
  }
  x[light?'lightDrawCards':'darkDrawCards']=draws.map(battleDrawInfo);
  log(side+' Battle Destiny: '+draws.map(draw=>draw.card.name+' '+(draw.cancelled?'(aufgehoben)':draw.value??'UNBEKANNT')).join(', ')
   +' · Gesamt '+(x[val]??'UNBEKANNT')+'.');
  finishPowerDecision();
 });
}
function skipDestiny(side){
 if(!battleSession||battleSession.weaponTurn||state.phase!==3)return;
 const x=battleSession,first=x.initiator==='Dark'?'Dark':'Light',key=side==='Light'?'lightCard':'darkCard',val=side==='Light'?'lightDestiny':'darkDestiny';
 if((side!==first&&x[first==='Dark'?'darkCard':'lightCard']===null)||x[key]!==null)return;
 x[key]={name:'Freiwillig verzichtet'};x[val]=0;
 log(side+' verzichtet auf Battle Destiny.');
 finishPowerDecision();
}
function finishPowerDecision(){
 if(battleSession.segmented)settlePowerSegment();
 else maybePlanBotForfeits();
 publishGame();
}

function settlePowerSegment(){
 const x=battleSession;
 if(x.lightCard===null||x.darkCard===null)return;
 if(!x.resultsResponseChecked&&(currentGame()?.cardRulesVersion??latestCardRulesVersion)>=13){
  x.resultsResponseChecked=true;
  x.kalDestinyWasHigher=Number.isFinite(x.lightDestiny)&&Number.isFinite(x.darkDestiny)&&x.lightDestiny>x.darkDestiny;
  const frame={kind:'battleDestinyResults',side:PremiereGame.otherSide(x.initiator),site:x.site};
  if(hasInterruptResponse(frame)){
   PremiereGame.openResponse(state.game,frame);
   return;
  }
 }
 if(!x.nightDestinyScheduled){
  x.nightDestinyScheduled=true;
  const nightCount=new Set(PremiereLocations.nightEffectsAt(state,x.site).map(effect=>effect.card.id)).size;
  if(nightCount){
   const first=x.initiator;
   const draws=[first,PremiereGame.otherSide(first)].map(side=>({side,purpose:'power',count:nightCount}));
   x.additionalDestinies=[...draws,...(x.additionalDestinies??[])];
  }
 }
 const next=x.additionalDestinies?.shift();
 if(next){
  drawDestinySeries(next.side,next.purpose,next.count,0,draws=>{
   (x.additionalDraws??=[]).push({side:next.side,purpose:next.purpose,draws:draws.map(battleDrawInfo)});
   x[next.purpose+'Destiny'][next.side]+=PremiereBattle.total(draws)??0;
   settlePowerSegment();
  });
  return;
 }
 if(x.drawCounts?.Light===1&&x.drawCounts.Dark===1&&(x.kalDestinyWasHigher??(x.lightDestiny>x.darkDestiny))&&
    activeBattleUnits('Light').some(card=>card.id==='Light:1407'&&
     ((currentGame()?.cardRulesVersion??latestCardRulesVersion)<7||!PremiereUnits.textSuppressed(card)))){
  x.darkDestiny=0;
  log("Kal'Falnl C'ndros setzt Dark Battle Destiny auf 0.");
 }
 if(x.prediction?.winner&&!x.predictionSettled){
  x.predictionSettled=true;
  const result=battleDamagePreview();
  const winner=result.darkTotal>result.lightTotal?'Dark':result.lightTotal>result.darkTotal?'Light':null;
  if(winner===x.prediction.winner){
   const {lost}=PremiereGame.zones(state,'Dark');
   const retrieved=lost.length&&PremiereGame.retrieveCard(state,'Dark',Math.floor(PremiereGame.random(state.game)*lost.length));
   log('Prophetess hat richtig vorhergesagt'+(retrieved?' und holt eine zufällige verlorene Karte zurück.':'.'));
  }else{
   log('Prophetess hat den Ausgang des Battle falsch vorhergesagt.');
   beginForceLoss('Dark',1,{reason:'prediction',locationIndex:x.site});
  }
 }
 if(!x.outcomeResponseChecked&&(currentGame()?.cardRulesVersion??latestCardRulesVersion)>=21){
  x.outcomeResponseChecked=true;
  const frame={kind:'battleOutcome',side:x.initiator,site:x.site,result:battleDamagePreview()};
  if(hasInterruptResponse(frame)){
   x.powerResult=frame.result;
   x.decidedPower=battlePowerBreakdown();
   PremiereGame.openResponse(state.game,frame);
   return;
  }
 }
 prepareDamageSegment();
}

function botDestinyDecision(){
 const available=legalActions(state,'Dark');
 return performAction(available.find(x=>x.kind==='destiny')??available.find(x=>x.kind==='skipDestiny'));
}
// Only Dark Side casualties are controlled by the bot. Human Light forfeits remain manual.

function botChooseForfeits(){
 const x=battleSession;
 if(!x||!state?.dark?.[x.site]||x.lightCard===null||x.darkCard===null)return false;
 const cards=state.dark[x.site],original=x.darkLoss||[];
 let best=null;
 function consider(indices){
  x.darkLoss=indices;
  const plan=battleForfeitPlan('Dark');
  if(!plan.valid)return;
  const score=plan.remainingDamage*2+indices.reduce((n,i)=>n+2+Math.max(0,Number(cards[i].power)||0)*2+Math.max(0,cardAbility(cards[i])||0),0);
  if(!best||score<best.score||(score===best.score&&indices.length<best.indices.length))best={score,indices:indices.slice()};
 }
 if(cards.length<=12){
  for(let mask=0;mask<(1<<cards.length);mask++){
   const indices=[];for(let i=0;i<cards.length;i++)if(mask&(1<<i))indices.push(i);
   consider(indices);
  }
 }else{
  // Bounded fallback for large groups; never invent unknown forfeit values.
  const order=cards.map((card,i)=>i).sort((a,b)=>(Math.max(0,Number(cards[b].forfeit)||0)/(2+Math.max(0,Number(cards[b].power)||0)))-(Math.max(0,Number(cards[a].forfeit)||0)/(2+Math.max(0,Number(cards[a].power)||0))));
  let indices=[];consider(indices);
  for(const i of order){indices=indices.concat(i);consider(indices);if(best)break}
 }
 x.darkLoss=best?best.indices:original;
 if(!best){log('Bot-Forfeit blockiert: unbekannte oder nicht regelkonform auflösbare Werte. Manuelle Prüfung erforderlich.');return false}
 x.botForfeitsPending=false;
 log('Dark Bot wählt '+best.indices.length+' Forfeit(s); verbleibender Battle Damage wird aus Hand/Life Force bezahlt.');
 return true;
}

function maybePlanBotForfeits(){
 if(battleSession?.botForfeitsPending&&battleSession.lightCard!==null&&battleSession.darkCard!==null)botChooseForfeits();
}

function setBattleModifier(side,kind,value){const x=battleSession;if(!x||state.phase!==3||(x.segmented&&(!state.trainingBattle||x.segment==='damage')))return;const key=(side==='Light'?'light':'dark')+(kind==='power'?'PowerMod':'Bonus');const n=Number(value);if(!Number.isInteger(n)||n<0||n>20){log('Ungültiger Modifikator (0–20).');return}x[key]=n;log(side+' manueller '+(kind==='power'?'Power':'zusätzlicher Battle-Destiny')+'-Bonus '+n+' (Lernübung).');publishGame()}

const battleDrawInfo=draw=>({name:draw.card.name,value:draw.cancelled?0:draw.value,cancelled:draw.cancelled});

function battleWeaponOptions(side,timing='weapons',x=battleSession,budget){
 return baseBattleWeaponOptions(side,timing,x,budget).concat(hothEnabled()?hothArtilleryShots(side,timing,x,budget):[]);
}
function baseBattleWeaponOptions(side,timing='weapons',x=battleSession,budget){
 if(!x||x.resolved||state?.phase!==3||x.lightCard!==null||x.darkCard!==null)return [];
 budget??=forceBudget(side);
 const opponent=PremiereGame.otherSide(side),{force,deck}=PremiereGame.zones(state,side);
 const targets=weaponTargets(opponent,x.site,false,x);
 return weaponMounts(side).flatMap(mount=>{
  const {host,slot:from,place}=mount;
  if(PremiereWeapons.disarmed(host)||x.blockedWeapons?.includes(host))return [];
  if(!x.segmented&&!PremiereUnits.usesMultipleWeapons(host)&&state.weaponUsersThisTurn?.includes(host))return [];
  return mountWeapons(mount).flatMap((weapon,weaponIndex)=>{
   const rule=PremiereWeapons.definition(weapon);
   if(!rule||(weapon.owner??weapon.side)!==side||weapon.kabeHeld||
      hothEnabled()&&weapon.hothWeaponBlocked||
      weapon.owner&&weapon.owner!==weapon.side&&weaponDeployCost(weapon,host)===null||(rule.timing??'weapons')!==timing)return [];
   if(rule.projector&&!deck?.length&&(currentGame()?.cardRulesVersion??latestCardRulesVersion)>=17)return [];
   if(x.scopeWeapons?.includes(weapon)||(x.repeatingWeapon?x.repeatingWeapon!==weapon:x.usedWeapons?.includes(weapon)))return [];
   if(!PremiereUnits.canUseWeapon(state,host,weapon))return [];
   if((host.type==='Starship'||hothEnabled()&&host.type==='Vehicle')&&!craftStats(host,from).powered)return [];
   const external=from!==x.site;
   if(external&&!(rule.superlaser&&state.mobileSystems?.[host.id]?.orbit===x.site)&&(!rule.adjacent||place!==from||
     !(adjacentSites(from,x.site)||hothEnabled()&&hothWeaponInRange(weapon,from,x.site,place))))return [];
   if(!external&&x.segmented&&!x.participants[side].includes(host)&&!rule.projector&&!isLoc(host))return [];
   if(rule.generator&&!PremiereLocations.presentCards(state,side,place).some(unit=>isPowerDroid(unit)||
      unit.characteristics?.includes('fusion generator')||/^portable fusion generator$/i.test(unit.name??'')))return [];
   const scoped=!external&&place===from&&isSite(state.locations[from])&&
    weapon.attachments?.some(device=>activeCardRules(device,'blasterScope').length);
   const scopeTargets=scoped?state.locations.flatMap((loc,slot)=>loc&&adjacentSites(from,slot)?
    weaponTargets(opponent,slot,true).map(entry=>({...entry,slot})):[]):[];
   return targets.concat(scopeTargets).flatMap(({card:target,index:targetIndex,place:targetPlace,slot=x.site})=>{
    const scopeExternal=slot!==x.site;
    if(scopeExternal?targetPlace!==slot||state.scopeHits?.includes(target):external?targetPlace!==x.site:targetPlace!==place)return [];
    const defense=laserGateRecord(target)?3:wearingUtinniGear(target,'plastoid-armor')?5:PremiereWeapons.defense(target,cardAbility(target),craftStats(target,slot));
    const shot=weaponShot(weapon,host,target,defense);
    if(!shot||shot.cost>budget||shot.effect!=='block'&&droidProtectedFrom(target,side)||
      shot.effect==='capture'&&(side!=='Dark'||(target.owner??target.side)!=='Light'))return [];
    if(shot.effect==='jawaSteal'){
     shot.defense=cardForfeitValueAt(target,opponent,slot);
     shot.bonus=1;
     if(!Number.isFinite(shot.defense)||!withinDeploymentLimit(target,side))return [];
    }
    if(shot.effect==='exclude'&&scopeExternal)return [];
    const args=[mount.index,weaponIndex,targetIndex];
    if(external||scopeExternal)args.push(from);
    if(scopeExternal)args.push(slot);
    return [{...shot,host,weapon,target,targetIndex,args,hostIndex:mount.index,weaponIndex,from,targetSlot:slot,scopeExternal}];
   });
  });
 });
}

function baseWeaponTargets(side,slot,includeNonparticipants=false,x=battleSession){
 const roots=PremiereGame.zones(state,side).board?.[slot]??[];
 return PremiereLocations.entries(state,side).filter(entry=>entry.slot===slot).flatMap((entry,index)=>{
  const target=entry.card,automated=PremiereWeapons.projector(target)||PremiereWeapons.seeker(target);
  if(entry.unavailable||(!PremiereUnits.active(target)&&!automated))return [];
  if(x?.segmented&&!includeNonparticipants&&!x.participants[side].includes(target)&&!automated)return [];
  const root=roots.indexOf(target);
  return [{card:target,index:root>=0?root:roots.length+index,place:PremiereLocations.physicalPlace(entry)}];
 });
}

function battleOpeningPreview(initiator,site){
 if(!canInitiateBattleFor(initiator,site))return null;
 const cost=battleInitiationCost(site),borrowed=Math.min(cost,beggarCredit(initiator));
 const participants=Object.fromEntries(PremiereGame.sides.map(side=>[side,battleParticipantsAt(side,site)]));
 const context={site,segmented:!!state.game,participants,lightCard:null,darkCard:null};
 const totals=battleTotals(site,initiator,context.segmented?participants:null);
 const sides=Object.fromEntries(PremiereGame.sides.map(side=>{
  const key=side.toLowerCase(),ability=totals[key+'Ability'];
  const budget=borrowed?ownForceBudget(side)-(side===initiator?cost-borrowed:borrowed):forceBudget(side)-(side===initiator?cost:0);
  const weapons=['initiation','weapons'].flatMap(timing=>battleWeaponOptions(side,timing,context,budget).map(shot=>({
   weapon:shot.weapon.name,host:shot.host.name,target:shot.target.name,targetSlot:shot.targetSlot,cost:shot.cost,timing,
  })));
  const immunity=participants[side].map(card=>({name:card.name,...battleAttritionProtection(side,card,site,participants[side])}))
   .filter(item=>item.below||item.atThree);
  return [side,{power:totals[key+'Power'],ability,draws:battleDestinyDrawCount(side,site,ability,initiator),
   minimumAbility:minimumBattleDestinyAbility(side,site),weapons,immunity,attritionPrevented:attritionPrevented(side,site)}];
 }));
 return {site,cost,sides};
}

function finishWeaponAction(side,passed){
 const x=battleSession;
 const bothPassed=passed&&x.weaponPassed;
 x.weaponPassed=passed;
 x.weaponTurn=bothPassed?null:(side==='Light'?'Dark':'Light');
 if(bothPassed&&x.segmented)x.segment='power';
 publishGame();
}

function passBattleWeapons(side){
 if(!battleSession||battleSession.weaponTurn!==side||state?.phase!==3)return false;
 if(battleSession.repeatingWeapon){
  log(side+' beendet das wiederholte Feuern.');
  battleSession.repeatingWeapon=null;
  finishWeaponAction(side,false);
  return true;
 }
 log(side+' passt im Waffen-Segment.');
 finishWeaponAction(side,true);
 return true;
}

function fireBattleWeapon(side,...args){
 if(!battleSession||battleSession.weaponTurn!==side)return false;
 const shot=battleWeaponOptions(side).find(option=>option.args.length===args.length&&option.args.every((value,i)=>value===args[i]));
 if(!shot)return false;
 const x=battleSession;
 shootWeapon(side,shot,()=>{
  x.repeatingWeapon=shot.repeats?shot.weapon:null;
  if(x.repeatingWeapon&&battleWeaponOptions(side).length){
   x.weaponPassed=false;
   publishGame();
  }else{
   x.repeatingWeapon=null;
   finishWeaponAction(side,false);
  }
 });
 return true;
}

function markWeaponFired(shot){
 const x=battleSession;
 (state.weaponUsersThisTurn??=[]).push(shot.host);
 PremiereUnits.recordWeaponUse(state,shot.host,shot.weapon);
 if(x){
  (x.usedWeapons??=[]).push(shot.weapon);
  if(shot.scopeExternal)(x.scopeWeapons??=[]).push(shot.weapon);
  x.lastHit=null;
 }
}

function recordBattleShot(battle,side,shot,total,defense,hit){
 const effects={ion:'Ionenschaden',capture:'Gefangennahme',block:'Waffen blockiert',destroy:'Karte verloren',
  jawaSteal:'Gestohlen',exclude:'Vom Battle ausgeschlossen'};
 (battle.weaponResults??=[]).push({side,weapon:shot.weapon.name,target:shot.target.name,total,defense,
  outcome:hit?(effects[shot.effect]??'Treffer'):total===null?'Kein verwertbarer Destiny-Draw':'Kein Treffer'});
}

function weaponDestinyModifier(side,shot){
 const passenger=shot.host?.occupants?.some(({card,role})=>role==='passenger'&&PremiereUnits.active(card)&&
  !excludedAtBattle(card,shot.from)&&activeCardRules(card,'passengerWeaponDestiny').length)?1:0;
 return PremiereLocations.rulesAt(state,shot.from,side,'weaponDestiny').reduce((sum,rule)=>sum+rule.amount,passenger)+(hothEnabled()?hothWeaponDestiny(side,shot):0)+
  (shot.host.leaderWeaponTurn!==undefined&&shot.host.leaderWeaponTurn===state.game?.timing.turn?1:0)+(shot.computerPenalty??0)+(battleSession?.weaponDestinyPenalty?.get(shot.weapon)??0);
}

function shootWeapon(side,shot,complete){
 const x=battleSession,{force,used}=PremiereGame.zones(state,side);
 const slot=shot.targetSlot??x.site,opponent=PremiereGame.otherSide(side);
 spendForce(side,shot.cost);
 markWeaponFired(shot);
 withShipWeaponResponse({kind:'weaponTarget',side,shot,site:slot},frame=>{
  if(frame?.cancelled){complete();return;}
  const sourceBonus=weaponDestinyModifier(side,shot);
  drawDestinySeries(side,'weapon',shot.draws,sourceBonus,draws=>{
   const valid=draws.filter(draw=>!draw.cancelled);
   const automated=PremiereWeapons.projector(shot.weapon)||PremiereWeapons.seeker(shot.weapon);
   const sum=PremiereBattle.total(draws);let total=valid.length&&sum!==null?Math.max(0,sum+shot.bonus+(automated?holocamDestiny(side,shot.from):0)):null;
   const afterShot=()=>afterCharacterFires(side,shot.host,shot.from,complete);
   const finish=()=>{
    if(hothEnabled()&&hothResolveShot(side,shot,total,draws,afterShot))return;
    if(shot.weapon.id==='Dark:1376'&&valid[0]?.value===0){
     log(shot.weapon.name+' explodiert. Waffe und '+shot.host.name+' gehen verloren.');
     recordBattleShot(x,side,shot,total,shot.defense,false);
     x.weaponResults.at(-1).outcome='Explodiert';
     loseTableCard(side,shot.from,shot.host);
     afterShot();
     return;
    }
    const defense=updatedShotDefense(shot,slot);
    const hit=total!==null&&(shot.effect==='exclude'?total===defense:total>defense);
    recordBattleShot(x,side,shot,total,defense,hit);
    log(side+' feuert '+shot.weapon.name+' auf '+shot.target.name+' ('+shot.cost+' Force). Waffen-Destiny: '+
     (draws.length?draws.map(draw=>draw.card.name+(draw.cancelled?' (aufgehoben)':'')).join(', ')+' · '+(total??'unbekannt'):'Reserve Deck leer')+
     ' gegen '+(shot.effect==='jawaSteal'?'Forfeit ':'Verteidigung ')+defense+' → '+(hit?
      ({ion:'Ionenschaden',capture:'Gefangennahme',jawaSteal:'gestohlen',exclude:'ausgeschlossen'}[shot.effect]??'Treffer'):'kein Treffer')+'.');
    const apply=()=>{if(hit){applyWeaponResult(shot,opponent,slot);if(x.hitUnits?.[opponent]?.includes(shot.target)&&openEvazanResponse(side,shot.target,slot,afterShot))return;}afterShot();};
    if(hit&&typeof cloudCityEnabled==='function'&&cloudCityEnabled())ccBeforeWeaponHit(side,shot,slot,apply);else apply();
   };
   const finishTotal=()=>{if(total!==null&&PremiereUnits.fighter(shot.target)&&Number.isFinite(shot.target.maneuver)&&
      !Number.isFinite(shot.target.armor)&&!Number.isFinite(PremiereWeapons.definition(shot.weapon)?.threshold)){
    withShipWeaponResponse({kind:'weaponDefense',side,shot,site:slot},finish);
   }else finish();};
   if(typeof dagobahEnabled==='function'&&dagobahEnabled()&&shot.target.type==='Starship'&&!Number.isFinite(PremiereWeapons.definition(shot.weapon)?.threshold))dagoTargetTotal(side,shot.target,total,value=>{total=value;finishTotal();});else finishTotal();
  });
 });
}

function updatedShotDefense(shot,slot){
 if(hothEnabled()&&shot.weapon.id==='Dark:158'&&PremiereUnits.fighter(shot.target))return 3;
 if((currentGame()?.cardRulesVersion??latestCardRulesVersion)<21||shot.target.type!=='Starship')return shot.defense;
 return PremiereWeapons.definition(shot.weapon)?.threshold??
  PremiereWeapons.defense(shot.target,cardAbility(shot.target),craftStats(shot.target,slot))??shot.defense;
}

function withShipWeaponResponse(frame,finish){
 if(state.game&&hasInterruptResponse(frame))PremiereGame.openResponse(state.game,{...frame,finish});
 else finish();
}

function afterCharacterFires(side,shooter,site,complete){
 if(shooter.type!=='Character'){complete();return;}
 withShipWeaponResponse({kind:'justFired',side,shooter,site},complete);
}

function poisonStingerOptions(side,frame){
 if(side===frame.side||!state.game||!forceBudget(side))return [];
 const shooter=PremiereLocations.findEntry(state,frame.shooter);
 if(!shooter||shooter.unavailable)return [];
 return PremiereLocations.presentCards(state,side,PremiereLocations.physicalPlace(shooter)).flatMap((card,i)=>
  activeCardRules(card,'poisonStinger').length&&!PremiereGame.wasUsed(state.game,'turn',card.id)?[{
   args:[-1,'poisonStinger',i],index:-1,card,target:shooter.card,kind:'poisonStinger',site:shooter.slot,
   label:card.name+' · '+shooter.card.name+' stechen (1 Force)',
  }]:[]);
}

function settlePoisonStinger(frame){
 drawDestinySeries(frame.side,'poisonStinger',1,0,draws=>{
  const target=PremiereLocations.findEntry(state,frame.target),value=draws.find(draw=>!draw.cancelled)?.value;
  if(!target||target.unavailable||!Number.isFinite(value)||value!==cardAbility(target.card))return;
  applyWeaponResult({target:target.card,effect:'hit'},target.side,target.slot);
 });
}

function nearbyHolocams(side,site){
 return state.locations.flatMap((loc,slot)=>loc&&(slot===site||adjacentSites(slot,site))?
  PremiereLocations.effectsAt(state,slot).filter(effect=>(effect.card.owner??effect.card.side)===side&&activeCardRules(effect.card,'holocamPower').length):[]);
}

function holocamDestiny(side,site){return nearbyHolocams(side,site).length}

function holocamPowerOptions(side,opening=false){
 const x=battleSession;
 if(!x?.segmented||!opening&&x.weaponTurn!==side)return [];
 return nearbyHolocams(side,x.site).flatMap(({card},index)=>{
  if(x.holocamsUsed?.includes(card))return [];
  return PremiereLocations.entries(state,side).flatMap((entry,i)=>{
   const {card:target,slot}=entry;
   if(target.type!=='Character'||!adjacentSites(slot,x.site)||!PremiereLocations.presentAt(entry,slot)||
     PremiereLocations.control(state,side,slot,cardAbility)!==true||target.asleep)return [];
   const defending=side!==x.initiator?activeCardRules(target,'defendingPower')[0]?.amount??0:0;
   const power=Math.max(0,(target.power??0)+defending+cardPowerModifier(target,side,slot)-tacticalPenalty(target));
   return [{args:[index,i],card,target,power,label:card.name+' · Power von '+target.name+' hinzufügen (+'+power+')'}];
  });
 });
}

function addHolocamPower(side,...args){
 const option=holocamPowerOptions(side).find(choice=>choice.args.every((value,i)=>value===args[i]));
 if(!option)return false;
 const x=battleSession;
 (x.holocamsUsed??=[]).push(option.card);
 (x.bonusPower??={Light:0,Dark:0})[side]+=option.power;
 log(option.label+'.');
 finishWeaponAction(side,false);
 return true;
}

function droidProtectedFrom(card,side){
 if(!isDroid(card)||!state?.game)return false;
 const protection=state.droidProtection?.get(card);
 return protection?.turn===state.game.timing.turn&&protection.side!==side;
}

function evazanOperators(side,{target,site}){
 if(droidProtectedFrom(target,side))return [];
 const targetEntry=PremiereLocations.findEntry(state,target);
 const place=targetEntry&&PremiereLocations.physicalPlace(targetEntry);
 if(targetEntry?.unavailable||targetEntry?.slot!==site)return [];
 return PremiereLocations.presentCards(state,side,place).filter(card=>
  card!==target&&PremiereUnits.active(card)&&activeCardRules(card,'evazanOperation').length);
}

function openEvazanResponse(side,target,site,finish){
 if(!state.game||target.type!=='Character')return false;
 const frame={kind:'evazanWindow',side,target,site,finish};
 if(!PremiereGame.sides.some(actor=>evazanOperators(actor,frame).length))return false;
 PremiereGame.openResponse(state.game,frame);
 return true;
}

function computerWeaponOptions(side,shots){

 if(!battleSession?.segmented||battleSession.repeatingWeapon)return [];
 return shots.flatMap(shot=>{
  if(shot.host.type!=='Starship'||shot.weapon.subType!=='Starship')return [];
  const card=(shot.host.attachments??[]).find(effect=>(effect.owner??effect.side)===side&&activeCardRules(effect,'doubleWeaponFire').length);
  if(!card)return [];
  const [rule]=activeCardRules(card,'doubleWeaponFire');
  const nextShots=shots.filter(other=>other.weapon===shot.weapon&&other.cost+shot.cost<=forceBudget(side));
  if(!nextShots.length)return [];
  const combined=shot.cost*2<=forceBudget(side)?['combined']:[];
  return [...combined,'separate'].map(mode=>({args:[mode,...shot.args],mode,shot,nextShots,card,rule,
   label:shot.weapon.name+' → '+shot.target.name+' · '+(mode==='combined'?'kombiniert zweimal feuern':'getrennt zweimal feuern')}));
 });
}

function fireWithTargetingComputer(side,...args){
 const choice=computerWeaponOptions(side,battleWeaponOptions(side)).find(option=>option.args.length===args.length&&
  option.args.every((value,index)=>value===args[index]));
 if(!choice)return false;
 const {shot,mode,rule,card,nextShots}=choice,penalty=rule.penalty,complete=()=>finishWeaponAction(side,false);
 if(mode==='combined'){
  shootWeapon(side,{...shot,draws:shot.draws*2,cost:shot.cost*2,computerPenalty:penalty},complete);
 }else shootWeapon(side,{...shot,computerPenalty:penalty},()=>{
  const opponent=PremiereGame.otherSide(side),site=battleSession.site;
  const legal=nextShots.filter(option=>PremiereLocations.findEntry(state,option.target)?.slot===site);
  if(!legal.length||!battlePresence(opponent,site)){complete();return;}
  state.pendingCardView={side,card,mode:'computerAim',rule,shots:legal,shown:legal.map(shot=>shot.target),publicView:true};
 });
 return true;
}

function combinedAttackOptions(side,shots,request,offer){
 if(!state.game)return [];
 const {hand}=PremiereGame.zones(state,side);
 const version=state.game.cardRulesVersion??latestCardRulesVersion;
 const attacks=hand.flatMap((card,index)=>{
  const rule=activeCardRules(card,'combinedWeaponFire')[0]??(version<21&&card.id==='Light:483'?
   {weaponType:'Starship',validTargets:['Starship']}:null);
  return rule?[{card,index,rule}]:[];
 });
 if(!attacks.length)return [];
 const options=[];
 for(const {card,index,rule} of attacks){
  const targets=new Map();
  for(const shot of shots){
   if(!rule.validTargets.includes(shot.target.type)||rule.weaponType&&
     (shot.host.type!==rule.weaponType||shot.weapon.subType!==rule.weaponType))continue;
   if(!targets.has(shot.targetIndex))targets.set(shot.targetIndex,[]);
   targets.get(shot.targetIndex).push(shot);
  }
  for(const [targetIndex,choices] of targets){
   const compatible=(a,b)=>a.host!==b.host||PremiereUnits.usesMultipleWeapons(a.host);
   let pair;
   for(const [i,first] of choices.entries()){
    const j=choices.findIndex((second,index)=>index>i&&compatible(first,second)&&first.cost+second.cost<=forceBudget(side));
    if(j>=0){pair=[i,j];break;}
   }
   if(!pair)continue;
   const base=[index,targetIndex];
   const choosing=request?.kind==='combinedAttack'&&base.every((value,i)=>value===request.args?.[i]);
   let plan;
   if(choosing){
    const selected=request.args.slice(2);
    plan=selected.map(choice=>Number.isInteger(choice)&&choices[choice]);
    if(plan.length<2||new Set(selected).size!==selected.length||plan.some(shot=>!shot)||
       plan.reduce((sum,shot)=>sum+shot.cost,0)>forceBudget(side)||
       plan.some((a,i)=>plan.slice(i+1).some(b=>!compatible(a,b))))continue;
   }
   options.push(offer('combinedAttack',choosing?request.args:base,{card,target:choices[0].target,choices,plan,pair,
    cost:pair.reduce((sum,index)=>sum+choices[index].cost,0)}));
  }
 }
 return options;
}

function playCombinedAttack(side,args,card,shots){
 if(!shots)return false;
 const {hand}=PremiereGame.zones(state,side);
 hand.splice(args[0],1);
 spendForce(side,shots.reduce((sum,shot)=>sum+shot.cost,0));
 const frame={kind:'interrupt',interrupt:'combinedAttack',site:battleSession.site,side,card,shots};
 log(side+' spielt '+card.name+' gegen '+shots[0].target.name+' und bezahlt '+shots.reduce((sum,shot)=>sum+shot.cost,0)+' Force.');
 if(hasInterruptResponse(frame))PremiereGame.openResponse(state.game,frame);
 else settleCombinedAttack(frame);
 return true;
}

function settleCombinedAttack(frame){
 const {shots,side,site}=frame,opponent=PremiereGame.otherSide(side);
 const complete=()=>{
  loseOwnedCard(frame.card,side);
  finishWeaponAction(side,false);
 };
 if(frame.cancelled){complete();return;}
 for(const shot of shots)markWeaponFired(shot);
 let total=0,drawn=false,known=true;
 function draw(index){
  if(index===shots.length){
   const attacks=known&&drawn?Math.max(0,total):null;
   const resolve=(i=0)=>{
    const shot=shots[i];
    if(!shot||!PremiereLocations.findEntry(state,shot.target)){complete();return;}
    const defense=updatedShotDefense(shot,site),hit=attacks!==null&&attacks>defense;
    recordBattleShot(battleSession,side,shot,attacks,defense,hit);
    log(shot.weapon.name+' · '+frame.card.name+' '+(attacks??'–')+' gegen Verteidigung '+defense+' · '+(hit?'Treffer':'kein Treffer')+'.');
    if(hit){
     applyWeaponResult(shot,opponent,site);
     if(battleSession.hitUnits?.[opponent]?.includes(shot.target)&&openEvazanResponse(side,shot.target,site,()=>resolve(i+1)))return;
    }
    resolve(i+1);
   };
   const shot=shots.find(option=>PremiereUnits.fighter(option.target)&&!Number.isFinite(option.target.armor)&&
    !Number.isFinite(PremiereWeapons.definition(option.weapon)?.threshold));
   if(attacks!==null&&shot)withShipWeaponResponse({kind:'weaponDefense',side,shot,site},()=>resolve());
   else resolve();
   return;
  }
  const shot=shots[index];
  withShipWeaponResponse({kind:'weaponTarget',side,shot,site,combined:true},()=>{
   const modifier=weaponDestinyModifier(side,shot);
   drawDestinySeries(side,'weapon',shot.draws,modifier,draws=>{
   if(draws.some(draw=>!draw.cancelled)){
    const value=PremiereBattle.total(draws);
    drawn=true;
    known&&=value!==null;
    if(value!==null)total+=value+shot.bonus;
   }
    draw(index+1);
   });
  });
 }
 draw(0);
}

function applyWeaponResult(shot,opponent,slot){
 const x=battleSession,target=shot.target;
 const gate=laserGateRecord(target);if(gate){cancelLocationEffect(gate.site,gate.effect);return;}
 if(shot.scopeExternal&&['hit','zero'].includes(shot.effect)){
  (state.scopeHits??=[]).push(target);
  log(target.name+' wurde an der Nachbar-Site getroffen und geht nach dem Battle verloren.');
 }else if(shot.effect==='capture'){
  captureCharacter(target,slot);
 }else if(shot.effect==='jawaSteal'){
  const entry=PremiereLocations.findEntry(state,target);
  if(entry)changeCharacterAllegiance(entry,PremiereGame.otherSide(opponent));
 }else if(shot.effect==='exclude'&&x){
  (x.excludedUnits??=new Set()).add(target);
 }else if(shot.effect==='ion'){
  for(const weapon of [...(target.weapons??[])].filter(card=>card.subType==='Starship')){
   target.weapons.splice(target.weapons.indexOf(weapon),1);
   loseOwnedCard(weapon,opponent);
  }
  target.ionDamage=true;
  log(target.name+' verliert seine Schiffswaffen. Verteidigungswert und Hyperspeed fallen auf 0.');
 }else if(shot.effect==='block'){
  (x.blockedWeapons??=[]).push(target);
  log(target.name+' kann in diesem Battle keine Waffen verwenden.');
 }else if(shot.effect==='destroy'||!x){
  loseTableCard(opponent,slot,target);
 }else{
  if(Number.isFinite(shot.forfeitReplacement))(x.droidHitForfeits??=new Map()).set(target,shot.forfeitReplacement);
  if(shot.effect==='zero')(x.zeroForfeit??=[]).push(target);
  const roots=PremiereGame.zones(state,opponent).board[slot];
  const index=roots.indexOf(target);
  const hits=((x.hitUnits??={Light:[],Dark:[]})[opponent]);
  if(!hits.includes(target))hits.push(target);
  if(index>=0)recordBattleWeaponHit(opponent,index);
  else log(target.name+' ist getroffen: verpflichtender Forfeit im Damage-Segment.');
  x.lastHit={side:opponent,card:target};
 }
}

function botWeaponAction(){
 const side=botSide();
 if(battleSession?.weaponTurn!==side)return null;
 const hitTargets=battleSession.hitUnits?.Light??[];
 const available=legalActions(state,side);
 if(plannedBot())return botPromptAction(available);
 const options=available.filter(x=>x.kind==='fireWeapon'&&!hitTargets.includes(x.target)&&state.botDeck.length);
 let choice;
 if(strategicBot()){
  const scored=options.map(option=>{
   const captureBonus=option.effect==='capture'?(PremiereLocations.ruleAt(state,option.from,'Dark','weaponDestiny')?.amount??0):0;
   const margin=estimatedDestiny*Math.min(option.draws,state.botDeck.length)+option.bonus+captureBonus-option.defense;
   const chance=Math.max(0,Math.min(1,0.5+margin/6));
   const payoff=2+(option.target.power??0)*0.5+(cardAbility(option.target)??0)*0.3+(option.effect==='capture'?2:0);
   return {option,score:chance*payoff-option.cost*0.7};
  }).sort((a,b)=>b.score-a.score)[0];
  if(scored?.score>0)choice=scored.option;
 }else{
  options.sort((a,b)=>(b.target.power??0)-(a.target.power??0)||a.defense-a.bonus-b.defense+b.bonus||a.cost-b.cost);
  choice=options[0];
 }
 const combined=available.find(action=>action.kind==='combinedAttack'&&!hitTargets.includes(action.target)&&state.botDeck.length>=2);
 return available.find(x=>x.kind==='duel')??(combined&&{...combined,args:[...combined.args,...combined.pair]})??choice??
  available.find(x=>['battleEffect','weaponEffect','retrieve','searchReserve','limitedResources','gravelStorm','pileInterrupt'].includes(x.kind)||(x.kind==='cancelTableEffect'&&x.effect.target==='Dark'))??available.find(x=>x.kind==='passWeapons');
}
function botWeaponDecision(){return performAction(botWeaponAction())}
// Hits still participate in combat. The damage segment requires them to be forfeited.

function recordBattleWeaponHit(side,index){
 const x=battleSession;
 if(!x||x.resolved||state?.phase!==3||!['Light','Dark'].includes(side))return false;
 const cards=side==='Light'?state.light[x.site]:state.dark[x.site];
 if(!cards||!Number.isInteger(index)||index<0||index>=cards.length)return false;
 x.weaponHits??={Light:[],Dark:[]};
 const hits=x.weaponHits[side]??=[];
 if(!hits.includes(index))hits.push(index);
 const key=side==='Light'?'lightLoss':'darkLoss';
 if(!x[key].includes(index))x[key].push(index);
 x.botForfeitsPending=true;
 log(cards[index].name+' ist getroffen: verpflichtender Forfeit im Damage-Segment.');
 return true;
}

function toggleLoss(side,index){const x=battleSession;if(!x)return;const key=side==='Light'?'lightLoss':'darkLoss',list=x[key];if((x.weaponHits?.[side]||[]).includes(index)){log('Getroffene Karte muss forfeitet werden.');return;}x[key]=list.includes(index)?list.filter(i=>i!==index):[...list,index];if(side==='Dark')x.botForfeitsPending=false;publishGame()}

function battleAttritionAgainst(side){
 const x=battleSession;if(!x||!['Light','Dark'].includes(side))return null;
 const k=side==='Light'?'dark':'light',card=x[k+'Card'],destiny=x[k+'Destiny'];
 if(card===null||!Number.isFinite(destiny))return null;
 if(card?.name==='Freiwillig verzichtet'||card?.name==='Reserve Deck leer')return 0;
 return Math.max(0,destiny+(Number.isFinite(x[k+'Bonus'])?x[k+'Bonus']:0)-(hothEnabled()?x.hothReduction?.[PremiereGame.otherSide(side)]??0:0));
}

function printedAttritionImmunityBelow(c){
 if((currentGame()?.cardRulesVersion??latestCardRulesVersion)>=7){
  const [registered]=PremiereCardRules.effects(c,'attritionImmunity');
  if(registered?.below!==undefined)return registered.below;
 }
 // Only unconditional printed values; conditional / granted immunity remains unsupported.
 const m=String(c?.gametext||'').match(/(?:^|[.!?]\s+)(?:['"]diplomatic['"]\s+)?(?:immune|immunity)\s+to\s+attrition\s*<\s*(\d+)\s*(?=[.!?]|$)/i);
 return m?Number(m[1]):null;
}

function immuneToBattleAttrition(c,incoming){
 const below=printedAttritionImmunityBelow(c);
 return Number.isFinite(incoming)&&below!==null&&incoming<below;
}

function activeBattleUnits(side){
 const x=battleSession;
 return x.participants[side].filter(card=>battleCandidates(side,x.site).includes(card));
}

function battleImmunity(side,card,slot=battleSession.site,members=activeBattleUnits(side)){
 if(card.immunityCancelled)return 0;
 const site=state.locations[slot],rules=PremiereLocations.conditions(state,slot,side);
 let limit=PremiereUnits.textSuppressed(card)?0:printedAttritionImmunityBelow(card)??0;
 const pilots=(card.occupants??[]).filter(entry=>entry.role==='pilot'&&PremiereUnits.active(entry.card)&&
  !excludedAtBattle(entry.card,slot)).map(entry=>locationTitle(entry.card));
 if(!PremiereUnits.textSuppressed(card)&&craftStats(card,slot).powered){
  const pilotRules=activeCardRules(card,'pilotAttritionImmunity').filter(rule=>pilots.some(name=>name===rule.pilot||name.startsWith(rule.pilot+' ')||hothEnabled()&&rule.persona&&name.includes(rule.persona)));
  limit=Math.max(limit,...pilotRules.map(rule=>rule.below));
  if(card.id==='Light:1677'&&pilots.some(name=>/^(han solo|chewbacca|lando calrissian)$/.test(name)))limit=Math.max(limit,5);
  if(card.id==='Dark:2700'&&pilots.includes('darth vader'))limit=Math.max(limit,4);
  if(PremiereUnits.capital(card)&&card.occupants?.some(entry=>entry.card.id==='Dark:1989'&&PremiereUnits.active(entry.card)&&
    !PremiereUnits.textSuppressed(entry.card)&&!excludedAtBattle(entry.card,slot)))limit=Math.max(limit,3);
  for(const rule of astromechShipRules(card,slot))limit=Math.max(limit,rule.below??0);
 }
 if(card.id==='Dark:12'&&rules.night&&!PremiereUnits.textSuppressed(card))return Infinity;
 if(jungleBonus(card,side,slot,members))return Infinity;
 const attachments=card.attachments??[];
 for(const effect of attachments)for(const rule of activeCardRules(effect,'grantedAttritionImmunity'))limit=Math.max(limit,rule.below);
 if(attachments.some(effect=>effect.id==='Light:1810'&&
    ((currentGame()?.cardRulesVersion??latestCardRulesVersion)<21||activeCardRules(effect,'battleMoveAway').length)))limit=Math.max(limit,5);
 if(site.locationTags?.includes('Planet')&&((currentGame()?.cardRulesVersion??latestCardRulesVersion)<10||isSite(site))&&
    attachments.some(device=>device.id==='Dark:2357'))limit=Math.max(limit,3);
 const {board}=PremiereGame.zones(state,side);
 const version=currentGame()?.cardRulesVersion??latestCardRulesVersion;
 const mechanic=unit=>((version<21&&unit.id==='Light:2785')||(version<15&&unit.id==='Dark:2783'))&&
  PremiereUnits.active(unit)&&!PremiereUnits.textSuppressed(unit);
 if((card.type==='Vehicle'||isDroid(card))&&(board?.[slot]??[]).some(mechanic))limit=Math.max(limit,2);
 if(PremiereUnits.fighter(card)&&isPlanetSystem(site)&&state.locations.some((loc,index)=>loc&&sitePlanet(loc)===locationGroup(site)&&
   PremiereLocations.conditions(state,index,side).dockingBay&&(board?.[index]??[]).some(mechanic)))limit=Math.max(limit,3);
 if(version>=15&&(card.type==='Vehicle'||isDroid(card)||PremiereUnits.fighter(card))){
  const allied=PremiereLocations.entries(state,side);
  if(card.type==='Vehicle'||isDroid(card)){
   for(const entry of allied)if(entry.slot===slot&&!entry.unavailable)
    limit=Math.max(limit,activeCardRules(entry.card,'mechanicImmunity')[0]?.below??0);
  }else if(isPlanetSystem(site)||site.subType==='Sector'){
   for(const entry of allied)if(!entry.unavailable&&sitePlanet(state.locations[entry.slot])===locationGroup(site)&&
      PremiereLocations.conditions(state,entry.slot,side).dockingBay)
    limit=Math.max(limit,activeCardRules(entry.card,'dockingMechanicImmunity')[0]?.below??0);
  }
 }
 const devices=PremiereLocations.effectsAt(state,slot);
 if(version>=14){
  const tooex=matchesRegisteredTarget(card,'rebel-or-alien')&&tooexNightRule(side,slot,'nighttimeRebelAlienImmunity');
  if(tooex&&devices.some(effect=>activeCardRules(effect.card,'activationDraw').length))limit=Math.max(limit,tooex.below);
 }else if(rules.night&&characterTraits(card).some(trait=>/rebel|alien/.test(trait))&&members.some(unit=>unit.id==='Light:2'&&!PremiereUnits.textSuppressed(unit))&&
    devices.some(effect=>effect.card.id==='Light:1196'))limit=Math.max(limit,3);
 return hothEnabled()?hothImmunity(side,card,slot,limit):limit;
}

function battleAttritionProtection(side,card,site,members){
 if(card.immunityCancelled)return {below:0,atThree:false};
 const carriers=members.filter(host=>PremiereUnits.enclosed(host)&&PremiereLocations.aboard(state,card,host));
 const protectedBy=[card,...carriers];
 return {below:Math.max(...protectedBy.map(unit=>battleImmunity(side,unit,site,members))),
  atThree:sitePlanet(state.locations[site])==='tatooine'&&protectedBy.some(unit=>wearingUtinniGear(unit,'breath-mask'))};
}

function battleForfeitValue(card,side,ignoreWeaponHit=false){
 const replacement=battleSession.droidHitForfeits?.get(card);
 if(Number.isFinite(replacement))return replacement;
 if(!ignoreWeaponHit&&battleSession.zeroForfeit?.includes(card)||lateralDamage(card))return 0;
 return cardForfeitValueAt(card,side,battleSession.site);
}

function cardForfeitValueAt(card,side,slot){
 if(hothEnabled()&&card.hothForfeitZero)return 0;
 if(card.asleep)return 0;
 const base=isHoloUnit(card)?printedBattleDestiny(card):card.battleForfeit??(activeCardRules(card,'brainiac').length?state.botHand.length:activeCardRules(card,'septoid').length?card.septoidForfeit??7:(card.forfeit??null)===null?null:card.forfeit*tonnikaFactor(card));
 if(!Number.isFinite(base))return null;
 const loc=state.locations[slot];
 let modifier=(card.battleForfeitModifier??0)+(hothEnabled()?hothForfeit(card,side,slot):0)+registeredLocationModifier('forfeit',card,side,slot)+deviceCharacterModifier(card,loc)+falconModificationBonus(card,slot);
 modifier+=kashyyykCrewBonus(card,slot);
 if(card.remoteBonus&&card.remoteBonus.turn===state.game?.timing.turn&&card.remoteBonus.stat==='forfeit')modifier++;
 if(card.type==='Character'&&!isDroid(card)&&isSite(loc)&&PremiereGame.sides.some(actor=>PremiereLocations.entries(state,actor).some(entry=>
  !entry.unavailable&&!entry.card.switchedOff&&activeCardRules(entry.card,'binaryForfeit').length&&
  (entry.slot===slot||adjacentSites(entry.slot,slot)))))modifier+=2;
 if(card.type==='Character'&&characterTraits(card).includes('wookiee')&&(currentGame()?.cardRulesVersion??latestCardRulesVersion)>=28){
  for(const [site,location] of state.locations.entries()){
   if(location?.id!=='Dark:1412')continue;
   for(const actor of PremiereGame.sides){
    const rule=PremiereLocations.ruleAt(state,site,actor,'kashyyykForfeit');
    if(rule&&PremiereLocations.control(state,actor,site,cardAbility)===true)modifier-=rule.amount;
   }
  }
 }
 modifier+=registeredCharacterModifier('characterForfeit',card,slot);
 if(card.type==='Character'&&isSite(loc)&&squadTrooper(card,side)&&PremiereLocations.presentCards(state,side,slot).some(unit=>unit!==card&&activeCardRules(unit,'squadLeader').length))modifier++;
 const region=sitePlanet(loc);
 if(card.type==='Character'&&['tatooine','hoth'].includes(region)&&PremiereLocations.findEntry(state,card)?.slot===slot){
  const owner=region==='tatooine'?side:PremiereGame.otherSide(side);
  const garouf=siteEntries(slot).find(entry=>entry.side===owner&&activeCardRules(entry.card,'garoufForfeit').length);
  if(garouf&&!garoufSuspended(garouf.card,slot))modifier+=region==='tatooine'?1:-1;
 }
 if(isSite(loc)&&card.type==='Character'&&!characterTraits(card).includes('leader')&&
    PremiereLocations.entries(state,side).some(entry=>entry.slot===slot&&!entry.unavailable&&entry.card!==card&&
     activeCardRules(entry.card,'commanderForfeit').some(rule=>rule.faction===card.subType)))modifier++;
 if(isArtoo(card)){
  const entry=PremiereLocations.findEntry(state,card);
  if(entry&&!entry.unavailable)modifier+=PremiereGame.sides.flatMap(actor=>
   PremiereLocations.presentCards(state,actor,PremiereLocations.physicalPlace(entry)).flatMap(unit=>activeCardRules(unit,'artooForfeit')))[0]?.amount??0;
 }
 if((currentGame()?.cardRulesVersion??latestCardRulesVersion)>=12&&card.type==='Character'&&PremiereUnits.hasSkill(card,'pilot')){
  modifier+=pilotForfeitModifier(card,slot);
 }
 const version=currentGame()?.cardRulesVersion??latestCardRulesVersion;
 const exterior=version>=14?isSite(loc)&&loc.locationTags?.includes('Exterior'):isExteriorPlanetSite(loc);
 if(version>=19&&matchesRegisteredTarget(card,'jawa')){
  modifier+=Math.max(0,...(state.tableEffects??[]).filter(effect=>effect.target===side)
   .flatMap(({card})=>activeCardRules(card,'globalJawaForfeit').map(rule=>rule.amount)));
 }
 if(exterior&&matchesRegisteredTarget(card,'jawa')){
  const present=PremiereGame.sides.flatMap(actor=>PremiereLocations.presentCards(state,actor,slot));
  if(version>=14)modifier+=present.flatMap(unit=>activeCardRules(unit,'jawaForfeit'))[0]?.amount??0;
  else{
   const crawlers=present.filter(PremiereUnits.crawler).length;
   modifier+=version===0?crawlers:Math.min(crawlers,1);
  }
 }
 modifier+=warRoomForfeitModifier(card,version);
 return Math.max(0,base+modifier-tacticalPenalty(card)+utinniGearBonus(card,slot)-lukeUtinniPenalty(card));
}

function garoufSuspended(card,slot){
 return card.id==='Light:1013'&&isSite(state.locations[slot])&&siteEntries(slot)
  .some(entry=>characterTraits(entry.card).includes('tax collector'));
}

function warRoomForfeitModifier(card,version){
 if(!matchesRegisteredTarget(card,'stormtrooper-or-tie')&&!matchesRegisteredTarget(card,'rebel-trooper-or-y-wing'))return 0;
 let modifier=0;
 for(const [slot,location] of state.locations.entries())for(const side of PremiereGame.sides){
  const rules=version>=25?PremiereLocations.rulesAt(state,slot,side,'warRoomForfeit'):
   PremiereCardRules.effects(location,'warRoomForfeit').filter(rule=>PremiereLocations.printedSide(state,slot,side)===rule.printedSide);
  if(!rules.length||PremiereLocations.control(state,side,slot,cardAbility)!==true||
     !PremiereLocations.presentCards(state,side,slot).some(unit=>characterTraits(unit).includes('leader')))continue;
  modifier+=rules.filter(rule=>matchesRegisteredTarget(card,rule.targets)).reduce((sum,rule)=>sum+rule.amount,0);
 }
 return modifier&&version>=25&&!PremiereLocations.findEntry(state,card)?0:modifier;
}

function pilotForfeitModifier(card,slot){
 const entry=PremiereLocations.findEntry(state,card),carrier=entry?.carriers[0];
 const pilotShip=carrier?.occupants?.some(seat=>seat.card===card&&seat.role==='pilot')?carrier:null;
 const namedSquadrons={gold:['Light:799','Light:1924'],red:['Light:239','Light:1390','Light:1593','Light:2067']};
 const belongs=squadron=>namedSquadrons[squadron].includes(card.id)||
  (pilotShip&&new RegExp('^'+squadron+' (?:squadron|[0-9]+\\b)').test(locationTitle(pilotShip)));
 const sources=PremiereGame.sides.flatMap(player=>PremiereLocations.entries(state,player))
  .filter(entry=>entry.card!==card&&!entry.unavailable&&entry.slot===slot);
 return sources.reduce((sum,{card:source})=>sum+
  activeCardRules(source,'squadronForfeit').filter(rule=>belongs(rule.squadron)).reduce((bonus,rule)=>bonus+rule.amount,0)+
  (card.subType==='Rebel'&&isSystem(state.locations[slot])?(activeCardRules(source,'rebelPilotForfeit')[0]?.amount??0):0),0);
}

function prepareDamageSegment(){
 const x=battleSession;
 if(x.lightCard===null||x.darkCard===null)return;
 if((currentGame()?.cardRulesVersion??latestCardRulesVersion)>=22&&stopBattleWithoutPresence())return;
 const result=battleDamagePreview();
 if(!result)return;
 const power=battlePowerBreakdown();
 if(hothEnabled()&&!x.hothLeadersSettled){
  x.hothLeadersSettled=true;x.powerResult=result;x.decidedPower=power;
  for(const card of x.hothFailedLeaders??[]){
   const entry=PremiereLocations.findEntry(state,card);if(!entry)continue;
   const key=entry.side.toLowerCase(),other=PremiereGame.otherSide(entry.side).toLowerCase();
   if(result[key+'Total']<=result[other+'Total']){
    log(card.name+' · You Have Failed Me: Forfeit 0; '+(card.id==='Dark:62'?'aus dem Spiel entfernt.':'sofort verloren.'));
    card.hothForfeitZero=true;loseTableCard(entry.side,entry.slot,card);
    if(card.id==='Dark:62'){const lost=PremiereGame.zones(state,entry.side).lost,at=lost.indexOf(card);if(at>=0)(state.outOfPlay??=[]).push(lost.splice(at,1)[0]);}
   }
  }
 }
 const debt=Object.fromEntries(PremiereGame.sides.map(side=>{
  const key=side.toLowerCase(),{board}=PremiereGame.zones(state,side);
  const hits=(x.hitUnits?.[side]??(x.weaponHits[side]??[]).map(index=>board[x.site][index])).filter(card=>activeBattleUnits(side).includes(card));
  const attrition=attritionPrevented(side,x.site)?0:result[key+'Attrition'],members=activeBattleUnits(side);
  const charged=members.filter(card=>x.chargedTroopers?.has(card));
  const immunity=members.filter(card=>{
   const protection=battleAttritionProtection(side,card,x.site,members);
   return protection.below>attrition||protection.atThree&&attrition===3;
  });
  return [side,{damage:Math.round(result[key+'Damage']),attrition,hits,immunity,charged}];
 }));
 x.segment='damage';
 const initial=Object.fromEntries(PremiereGame.sides.map(side=>[side,{...debt[side]}]));
 x.damage={result,power,debt,initial,priority:x.initiator,passes:0};
}

function battleDamageOptions(side){
 const x=battleSession,d=x.damage;
 if(d.priority!==side)return [];
 const debt=d.debt[side],units=activeBattleUnits(side);
 const actions=[];
 let requiredAttrition=false;
 for(const card of units){
  const value=battleForfeitValue(card,side),hit=debt.hits.includes(card),charged=debt.charged?.includes(card);
  if(value===null)continue;
  const immune=debt.immunity.includes(card);
  if(debt.attrition>0&&!immune)requiredAttrition=true;
  if(hit||charged||debt.damage>0||debt.attrition>0)actions.push({kind:'battleForfeit',args:[x.participants[side].indexOf(card)],card,value,hit,charged});
 }
 const site=state.locations[x.site];
 if(isSite(site))for(const talz of units.filter(card=>activeCardRules(card,'substituteHit').length)){
  const value=battleForfeitValue(talz,side,true);
  if(value===null)continue;
  for(const target of debt.hits.filter(card=>card!==talz&&card.type==='Character')){
   actions.push({kind:'talzForfeit',args:[x.participants[side].indexOf(talz),x.participants[side].indexOf(target)],
    card:talz,target,value,hit:true,label:talz.name+' für '+target.name+' forfeit ('+value+')'});
  }
 }
 const losing=side==='Light'?d.result.lightTotal<d.result.darkTotal:d.result.darkTotal<d.result.lightTotal;
 if(losing&&(debt.damage>0||debt.attrition>0)&&(state.tableEffects??[]).some(({card,target})=>
  target===side&&activeCardRules(card,'handForfeit').length)){
  const {hand}=PremiereGame.zones(state,side);
  for(const [index,card] of (hand??[]).entries()){
   if(!['Character','Starship','Vehicle'].includes(card.type)||!Number.isFinite(card.forfeit))continue;
   const value=battleForfeitValue(card,side);
   actions.push({kind:'battleHandForfeit',args:[index],card,value,label:'Mantellian Savrip · '+card.name+' forfeit ('+value+')'});
  }
 }
 if(losing&&debt.damage>0&&!actions.length){
  const {hand}=PremiereGame.zones(state,side);
  for(const [index,card] of (hand??[]).entries())if(activeCardRules(card,'damageRelief').length){
   actions.push({kind:'damageRelief',args:[index],card,label:card.name+' · restlichen Battle Damage aufheben'});
  }
 }
 const losses=debt.damage>0?PremiereGame.lossChoices(state,side):[];
 actions.push(...losses.map(option=>({kind:'battleForceLoss',...option})));
 actions.push(...forceLossReductionOptions(side,debt,'damage'));
 const mustPay=actions.some(option=>option.hit||option.charged)||requiredAttrition||(debt.damage>0&&actions.length>0);
 if(!mustPay)actions.push({kind:'passDamage',args:[]});
 return actions;
}

function removeBattleUnit(side,card){
 return loseTableCard(side,battleSession.site,card,false,true);
}

function loseOwnedCard(card,fallback,source='table',site,forfeited=false){
 const owner=card.owner??card.side??fallback;
 PremiereGame.zones(state,owner).lost.push(card);
 if(source!=='lifeForce'&&PremiereGame.lostPileFaceDown(state,owner))log(card.name+' geht offen verloren und wird anschließend verdeckt abgelegt.');
 if(source!=='lifeForce'||!PremiereGame.lostPileFaceDown(state,owner))queueCharacterLoss(owner,card,site,forfeited);
 if(source!=='support'&&(source!=='lifeForce'||!PremiereGame.lostPileFaceDown(state,owner)))queueMemorialLoss(owner,card,site);
}

function loseTableCard(side,slot,card,outOfPlay=false,forfeited=false,skipEvacuation=false,skipCapture=false,hothRescue=null){
 if(!outOfPlay&&!skipCapture&&side==='Light'&&card.type==='Character'&&battleSession?.participants?.Light?.includes(card)){
  const frame={kind:'aboutToLoseBattle',side,target:card,site:slot,forfeited,finish:()=>loseTableCard(side,slot,card,outOfPlay,forfeited,skipEvacuation,true)};
  if(queueRuleResponse(frame))return true;
 }
 for(const record of (state.capturedShips??[]).slice())if(record.holder===card){
  state.capturedShips.splice(state.capturedShips.indexOf(record),1);loseTableCard(record.side,record.bay,record.ship,outOfPlay,false,true,true);
 }
 if(!outOfPlay&&!skipEvacuation&&PremiereUnits.capital(card)&&PremiereLocations.findEntry(state,card)?.slot===slot){
  const frame={kind:'shipLoss',side:PremiereGame.otherSide(side),owner:side,site:slot,ship:card,forfeited};
  if(state.ruleResponses?.some(event=>event.kind==='shipLoss'&&event.ship===card))return true;
  if(queueRuleResponse(frame))return true;
 }
 const chewieUsed=hothRescue!=='cancelled'&&!outOfPlay&&isSite(state.locations[slot])&&['Vehicle','Starship','Character'].includes(card.type)&&(card.type!=='Character'||isDroid(card))&&
  (card.hitForLoss||battleSession?.hitUnits?.[side]?.includes(card))&&PremiereLocations.presentCards(state,side,slot).some(unit=>activeCardRules(unit,'chewbacca').length);
 if(hothEnabled()&&chewieUsed&&!hothRescue){
  const frame={kind:'hothRescue',side,card:PremiereLocations.presentCards(state,side,slot).find(unit=>activeCardRules(unit,'chewbacca').length),target:card,site:slot,
   finish:()=>loseTableCard(side,slot,card,outOfPlay,forfeited,true,true,'accepted'),afterCancel:()=>loseTableCard(side,slot,card,outOfPlay,forfeited,true,true,'cancelled')};
  if(hasInterruptResponse(frame)){PremiereGame.openResponse(state.game,frame);return true;}
 }
 if(hothEnabled())for(const entry of PremiereLocations.entries(state,side))if(entry.card===card||entry.carriers.includes(card))
  entry.card.hothWasHitForfeit=!!entry.card.hitForLoss||!!battleSession?.hitUnits?.[side]?.includes(entry.card);
 cleanupVehicleSites(card);
 const cloudLossCarrier=typeof cloudCityEnabled==='function'&&cloudCityEnabled()?PremiereLocations.findEntry(state,card)?.carriers?.[0]:null;
 if(!detachTableCard(side,slot,card))return false;
 PremiereUnits.remove(card,unit=>{
  state.mouseUtinni?.delete(unit);
  state.sleepingCharacters?.delete(unit);
  delete unit.asleep;
  delete unit.migTarget;
  if(unit.type==='Effect'&&state.tableEffects?.length){
   const placed=state.tableEffects.find(effect=>effect.card===unit);
   for(const card of placed?.support??[])loseOwnedCard(card,placed.target,'support');
   state.tableEffects=state.tableEffects.filter(effect=>effect.card!==unit);
  }
  if(typeof cloudCityEnabled==='function'&&cloudCityEnabled())ccEscortRemoved(unit,card,slot,cloudLossCarrier);
  if(unit.escortedCaptive){
   const captive=unit.escortedCaptive;
   delete unit.escortedCaptive;
   if(unit===card){
    (state.pendingCustody??=[]).push({side:'Light',card:captive,slot});
    log(captive.name+' wird frei, weil '+unit.name+' als Eskorte ausfällt.');
   }else{
    // The carrier's loss takes all its occupants, including the captive, simultaneously.
    clearCaptivity(captive);
    PremiereUnits.remove(captive,item=>loseOwnedCard(item,'Light'),item=>loseOwnedCard(item,'Light'));
    log(captive.name+' geht mit '+card.name+' verloren.');
   }
  }
  if(chewieUsed&&unit===card)PremiereGame.zones(state,unit.owner??unit.side??side).used.push(unit);
  else if(outOfPlay&&unit===card)(state.outOfPlay??=[]).push(unit);
  else if(battleSession?.site===slot&&battleSession.participants?.[side]?.includes(unit)&&activeCardRules(unit,'regenerate').length){
   PremiereGame.zones(state,unit.owner??unit.side??side).used.push(unit);
   log(unit.name+' regeneriert und kommt oben auf die Used Pile.');
  }
  else{
   noteLarsLoss(unit,side);
   loseOwnedCard(unit,side,'table',slot,forfeited&&unit===card);
  }
  delete unit.hothWasHitForfeit;
 },passenger=>{
  const controller=passenger.controller??side;
  PremiereGame.zones(state,controller).board[slot].push(passenger);
  log(passenger.name+' steigt vom verlorenen Bantha ab.');
 });
 return true;
}

function noteLarsLoss(card,fallbackSide){
 const [rule]=activeCardRules(card,'larsLegacy'),turn=state?.game?.timing.turn;
 const owner=card.owner??card.side??fallbackSide;
 if(!rule||!Number.isInteger(turn)||state.activeSide!==PremiereGame.otherSide(owner))return;
 (state.larsPower??=new Map()).set(card.id,{amount:rule.amount,throughTurn:turn+1});
 log(card.name+' geht verloren. Luke erhält bis Ende des nächsten '+owner+'-Zugs +'+rule.amount+' Power.');
}

function lukeLarsPower(card){
 if(!state.larsPower?.size||!(card.id==='Light:1593'||card.personas?.some(persona=>persona.toLowerCase()==='luke skywalker')))return 0;
 const turn=state.game?.timing.turn;
 return [...state.larsPower.values()].reduce((sum,effect)=>sum+(turn<=effect.throughTurn?effect.amount:0),0);
}

function detachTableCard(side,slot,card){
 const {board}=PremiereGame.zones(state,side);
 function detach(row){
  const index=row.findIndex(entry=>(entry.card??entry)===card);
  if(index>=0){row.splice(index,1);return true;}
  return row.some(entry=>{
   const unit=entry.card??entry;
   if(unit.escortedCaptive===card){delete unit.escortedCaptive;return true;}
   const captiveIndex=unit.additionalCaptives?.indexOf(card)??-1;
   if(captiveIndex>=0){unit.additionalCaptives.splice(captiveIndex,1);return true;}
   return [unit.occupants,unit.weapons,unit.attachments].some(children=>children?.length&&detach(children));
  });
 }
 return detach(board?.[slot]??[])||detach(state.locationWeapons?.[slot]??[]);
}

function useGaderffii(side,...args){
 const frame=PremiereGame.responseWindow(state.game);
 if(frame?.kind!=='battle'||frame.priority!==side)return false;
 const shot=battleWeaponOptions(side,'initiation').find(item=>item.args.length===args.length&&item.args.every((value,i)=>value===args[i]));
 if(!shot)return false;
 frame.priority=PremiereGame.otherSide(side);
 frame.passes=0;
 shootWeapon(side,shot,()=>{});
 return true;
}

function stopBattleWithoutPresence(){
 const x=battleSession;
 if(!x?.segmented||state.pendingCustody?.length||!['weapons','power'].includes(x.segment)||PremiereGame.responseWindow(state.game))return;
 if(PremiereGame.sides.every(side=>battlePresence(side,x.site)))return;
 log('Battle endet vorzeitig, weil eine Seite keine teilnehmende Presence mehr hat.');
 loseHitsFromInterruptedBattle(x);
 for(const card of x.chargedTroopers?.keys()??[]){
  const entry=PremiereLocations.findEntry(state,card);
  if(entry?.slot===x.site&&loseTableCard(entry.side,entry.slot,card))log(card.name+' wird wegen Trooper Charge forfeitet.');
 }
 battleSession=null;
 endBattleTiming(x.site);
 return true;
}

function loseHitsFromInterruptedBattle(battle){
 if(!battle?.segmented||(currentGame()?.cardRulesVersion??latestCardRulesVersion)<22)return;
 for(const side of PremiereGame.sides){
  for(const card of battle.hitUnits?.[side]??[]){
   const entry=PremiereLocations.findEntry(state,card);
   if(entry&&loseTableCard(entry.side,entry.slot,card))log(card.name+' geht durch den Waffentreffer verloren.');
  }
 }
}

function battleDamageAction(side,kind,args){
 const x=battleSession,d=x?.damage;
 if(!d)return false;
 const option=battleDamageOptions(side).find(item=>item.kind===kind&&item.args.length===args.length&&item.args.every((value,i)=>value===args[i]));
 if(!option)return false;
 const debt=d.debt[side];
 if(kind==='damageRelief'){
  const {hand}=PremiereGame.zones(state,side);
  const [card]=hand.splice(args[0],1);
  const frame={kind:'interrupt',interrupt:'damageRelief',side,card,debt};
  if(hasInterruptResponse(frame))PremiereGame.openResponse(state.game,frame);
  else settleDamageRelief(frame);
 }else if(kind==='talzForfeit'){
  const saved=[option.card,option.target],row=PremiereGame.zones(state,side).board[x.site];
  const positions=saved.map(card=>row.indexOf(card));
  debt.hits=debt.hits.filter(card=>!saved.includes(card));
  x.hitUnits[side]=x.hitUnits[side].filter(card=>!saved.includes(card));
  x.zeroForfeit=(x.zeroForfeit??[]).filter(card=>!saved.includes(card));
  if((currentGame()?.cardRulesVersion??latestCardRulesVersion)>=22)for(const card of saved)x.droidHitForfeits?.delete(card);
  x.weaponHits[side]=x.weaponHits[side].filter(index=>!positions.includes(index));
  if(!removeBattleUnit(side,option.card))return false;
  PremiereBattle.forfeit(debt,option.value);
  debt.damage=Math.max(debt.damage,debt.forceOnly??0);
  log(option.card.name+' wird statt '+option.target.name+' für '+option.value+' forfeitet.');
 }else if(kind==='battleHandForfeit'){
  const {hand}=PremiereGame.zones(state,side);
  loseOwnedCard(hand.splice(args[0],1)[0],side,'hand');
  PremiereBattle.forfeit(debt,option.value);
  debt.damage=Math.max(debt.damage,debt.forceOnly??0);
  log(side+' forfeitet '+option.card.name+' aus der Hand für '+option.value+'.');
 }else if(kind==='battleForfeit'){
  if(activeCardRules(option.card,'septoid').length&&!option.hit){
   const absorbed=Math.min(option.value,Math.max(debt.attrition,debt.damage));
   option.card.septoidForfeit=(option.card.septoidForfeit??7)-absorbed;
   if(option.card.septoidForfeit<=0&&!removeBattleUnit(side,option.card))return false;
  }else if(!removeBattleUnit(side,option.card))return false;
  PremiereBattle.forfeit(debt,option.value);
  debt.damage=Math.max(debt.damage,debt.forceOnly??0);
  debt.hits=debt.hits.filter(card=>activeBattleUnits(side).includes(card));
  if(debt.charged)debt.charged=debt.charged.filter(card=>activeBattleUnits(side).includes(card));
  log(side+' forfeitet '+option.card.name+' für '+option.value+'.');
 }else if(kind==='battleForceLoss'){
  const amount=debt.forceOnly?1:forceLossAfterDoomed(side,1);
  const card=amount?PremiereGame.loseForce(state,side,...args):null;
  if(amount&&!card)return false;
  debt.damage--;
  if(debt.forceOnly)debt.forceOnly--;
  if(card){
   if(args[0]==='hand'||!PremiereGame.lostPileFaceDown(state,side))queueCharacterLoss(side,card);
   log(side+' verliert '+forceLossDescription(side,args[0],card)+' für Battle Damage.');
   if(!debt.damage)openBattleForceLossResponse(side,debt,'damage');
  }else log("We're Doomed verhindert 1 Force-Verlust aus Battle Damage.");
 }
 d.passes=kind==='passDamage'?d.passes+1:0;
 d.priority=PremiereGame.otherSide(side);
 if(d.passes===2){
  log('Battle beendet: Light '+d.result.lightTotal+' / Dark '+d.result.darkTotal+' Power.');
  battleSession=null;
  endBattleTiming(x.site,d.result,x.participants);
 }
 return true;
}

function settleDamageRelief({side,card,debt}){
 debt.damage=0;
 if(debt.forceOnly)debt.forceOnly=0;
 loseOwnedCard(card,side,'hand');
 log(card.name+' hebt den restlichen Battle Damage für '+side+' auf.');
}

function botDamageAction(){
 const offers=legalActions(state,botSide());
 if(plannedBot())return botPromptAction(offers);
 const debt=battleSession?.damage?.debt.Dark;
 const forfeits=offers.filter(option=>option.kind==='battleForfeit');
 const vulnerable=debt?.attrition>0?forfeits.filter(option=>!debt.immunity.includes(option.card)):[];
 return forfeits.find(option=>option.hit||option.charged)??offers.find(option=>option.kind==='passDamage')??
  vulnerable.sort((a,b)=>b.value-a.value)[0]??offers.find(option=>['damageRelief','reduceForceLoss'].includes(option.kind))??
  offers.find(option=>option.kind==='battleForceLoss')??forfeits[0];
}

function refreshSaberTraining(){
 for(const effect of [...(state.tableEffects??[])]){
  if(effect.host&&activeCardRules(effect.card,'saberTraining').length&&!ownLightsaber(effect.host))cancelTableEffect(effect);
 }
}

function battleForfeitPlan(side){
 const x=battleSession,damage=battleDamagePreview();
 if(!x||!['Light','Dark'].includes(side)||!damage)return {valid:false,reason:'Destiny nicht abgeschlossen',sum:0};
 const cards=side==='Light'?state.light[x.site]:state.dark[x.site],indices=x[side==='Light'?'lightLoss':'darkLoss']||[];
 const incoming=battleAttritionAgainst(side),required=side==='Light'?damage.lightDamage:damage.darkDamage;
 if(incoming===null)return {valid:false,reason:'Attrition unbekannt',sum:0};
 if(new Set(indices).size!==indices.length||indices.some(i=>!Number.isInteger(i)||i<0||i>=cards.length))return {valid:false,reason:'Ungültige Kartenauswahl',sum:0};
 if(indices.some(i=>!Number.isFinite(cards[i].forfeit)||cards[i].forfeit<0))return {valid:false,reason:'Forfeit-Wert unbekannt',sum:0};
 const mandatory=x.weaponHits?.[side]||[];
  if(mandatory.some(i=>!indices.includes(i)))return {valid:false,reason:'Getroffene Karten müssen forfeitet werden',sum:0};
  const sum=indices.reduce((n,i)=>n+cards[i].forfeit,0);
 const vulnerable=cards.map((c,i)=>immuneToBattleAttrition(c,incoming)?null:i).filter(i=>i!==null);
 const satisfiesAttrition=selection=>{
  const eligibleSelection=vulnerable.filter(i=>selection.includes(i));
  const eligibleForfeit=eligibleSelection.reduce((n,i)=>n+(Number.isFinite(cards[i].forfeit)?cards[i].forfeit:0),0);
  return eligibleForfeit>=incoming||eligibleSelection.length===vulnerable.length;
 };
 if(!satisfiesAttrition(indices))return {valid:false,reason:'Attrition erfordert weitere nicht-immune Forfeits',sum,incoming,required};
 // A selected card is unnecessary only if BOTH attrition and battle damage still remain covered without it.
 if(indices.some(i=>{
  const rest=indices.filter(j=>j!==i);
  return !mandatory.includes(i)&&satisfiesAttrition(rest)&&sum-cards[i].forfeit>=required;
 }))return {valid:false,reason:'Unnötiger freiwilliger Forfeit',sum,incoming,required};
 return {valid:true,reason:'Bereit',sum,incoming,required,remainingDamage:Math.max(0,required-sum)};
}

function battlePowerBreakdown(totals){
 const x=battleSession;
 if(x.damage?.power)return x.damage.power;
 if(x.decidedPower)return x.decidedPower;
 const t=totals??battleTotals(x.site);
 return Object.fromEntries(PremiereGame.sides.map(side=>{
  const key=side.toLowerCase(),base=t[key+'Power'],modifier=x[key+'PowerMod']??0,multiplier=x[key+'PowerDoubled']?2:1;
  return [side,{base,modifier,multiplier,power:(base+modifier)*multiplier,battle:x[key+'Destiny'],
   powerDestiny:(x.segmented?x.powerDestiny?.[side]??0:0)+(x[key+'Bonus']??0),
   attritionDestiny:x.segmented&&x.battleDrawSucceeded?.[side]?(x.attritionDestiny?.[side]??0)+(x[key+'Bonus']??0):0}];
 }));
}

function battleDamagePreview(){
 if(!battleSession)return null;
 const x=battleSession,t=battleTotals(x.site);
 if(x.damage)return x.damage.result;
 if(x.powerResult)return x.powerResult;
 if(!Number.isFinite(x.lightDestiny)||!Number.isFinite(x.darkDestiny))return null;
 const parts=battlePowerBreakdown(t),power={Light:parts.Light.power,Dark:parts.Dark.power};
 if(x.segmented){
  const destiny=Object.fromEntries(PremiereGame.sides.map(side=>[side,{battle:parts[side].battle,power:parts[side].powerDestiny,
   attrition:parts[side].attritionDestiny}]));
  const result=PremiereBattle.result(power,destiny);
  if(result&&hothEnabled()){
   for(const side of PremiereGame.sides){const key=side.toLowerCase();result[key+'Total']=Math.max(0,result[key+'Total']-(x.hothReduction?.[side]??0));}
   result.lightDamage=Math.max(0,result.darkTotal-result.lightTotal);result.darkDamage=Math.max(0,result.lightTotal-result.darkTotal);
  }
  if(result)for(const [key,side] of [['lightDamage','Light'],['darkDamage','Dark']]){
   result[side.toLowerCase()+'Attrition']+=detachmentAttrition(x.site,side);
   if(hothEnabled())result[side.toLowerCase()+'Attrition']=Math.max(0,result[side.toLowerCase()+'Attrition']-(x.hothReduction?.[PremiereGame.otherSide(side)]??0));
   for(const modifier of x.damageMultipliers??[]){
    if(!modifier.loser||modifier.loser===side)result[key]*=modifier.multiplier;
   }
  }
  return result;
 }
 const lightTotal=power.Light+parts.Light.battle+parts.Light.powerDestiny,darkTotal=power.Dark+parts.Dark.battle+parts.Dark.powerDestiny;
 return {lightTotal,darkTotal,lightDamage:Math.max(0,darkTotal-lightTotal),darkDamage:Math.max(0,lightTotal-darkTotal)};
}

function lossValue(side){const x=battleSession,cards=side==='Light'?state.light[x.site]:state.dark[x.site],indices=x[side==='Light'?'lightLoss':'darkLoss'];return {sum:indices.reduce((n,i)=>n+(cards[i]?.forfeit||0),0),unknown:indices.some(i=>!Number.isFinite(cards[i]?.forfeit)),count:indices.length}}

function resolveBattleLosses(){
 const x=battleSession;if(!x||x.resolved||x.weaponTurn||state.phase!==3||state.pendingForceLoss||state.gameWinner)return false;
 if(x.lightCard===null||x.darkCard===null)return false;
 const light=battleForfeitPlan('Light'),dark=battleForfeitPlan('Dark'),damage=battleDamagePreview();
 if(!light.valid||!dark.valid||!damage){log('Battle nicht abgeschlossen: '+(!light.valid?'Light '+light.reason+'; ':'')+(!dark.valid?'Dark '+dark.reason:''));publishGame();return false;}
 for(const side of ['Light','Dark']){
  const {board}=PremiereGame.zones(state,side),cards=board[x.site];
  for(const i of x[side==='Light'?'lightLoss':'darkLoss'].slice().sort((a,b)=>b-a)){
   const card=cards[i];
   loseTableCard(side,x.site,card,false,true);
   log(side+' forfeitet '+card.name+' (Forfeit '+card.forfeit+').');
  }
 }
 x.resolved=true;
 const loser=damage.lightDamage?'Light':damage.darkDamage?'Dark':null;
 const amount=loser==='Light'?light.remainingDamage:loser==='Dark'?dark.remainingDamage:0;
 log('Battle beendet: Power Light '+damage.lightTotal+', Dark '+damage.darkTotal+'. Light Attrition '+light.incoming+', Dark Attrition '+dark.incoming+'.');
 battleSession=null;
 if(loser&&amount>0){
  if(!beginForceLoss(loser,amount,{reason:'battleDamage',locationIndex:x.site}))endBattleTiming(x.site);
 }else endBattleTiming(x.site);
 checkLifeForceVictory();publishGame();return true;
}

function commitDemoLoss(){return resolveBattleLosses()}

const reactMovementUsed=card=>state.reactedThisTurn?.includes(card)||card.occupants?.some(entry=>state.reactedThisTurn?.includes(entry.card));

function officerShipReact(side,card,slot){
 const system=state.locations[slot];
 if(!isSystem(system)||card.type!=='Starship')return false;
 const region=locationGroup(system);
 return PremiereLocations.entries(state,side).some(({card:source,slot:site,unavailable})=>!unavailable&&
  isSite(state.locations[site])&&sitePlanet(state.locations[site])===region&&activeCardRules(source,'officerShipReact').some(rule=>
   rule.regions.includes(region)&&characterTraits(card).includes(rule.faction)));
}

function reactOptions(side, window){
 return baseReactOptions(side,window).concat(hothEnabled()?hothReactOptions(side,window):[]);
}
function baseReactOptions(side, window){
 if(!window||window.cancelled||!['battle','drain'].includes(window.kind)||side===window.side)return [];
 const {board,force}=PremiereGame.zones(state,side);
 if(!force||!board)return [];
 return board.flatMap((row,from)=>row.flatMap((card,index)=>{
  if(reactMovementUsed(card))return [];
  if(window.kind==='battle'&&from===window.site&&activeCardRules(card,'reactAway').length){
   return state.locations.flatMap((loc,to)=>travelOptions(card,side,from,to,true)
    .filter(option=>option.kind==='Landspeed'&&option.cost<=forceBudget(side))
    .map(option=>({from,to,index,card,cost:option.cost,movement:option.kind,away:true,
     label:card.name+' · als React zu '+loc.name+' ('+option.cost+' Force)'})));
  }
  const shipReact=card.type==='Starship'&&(PremiereLocations.ruleAt(state,window.site,side,'shipReact')||officerShipReact(side,card,window.site));
  const scout=card.attachments?.find(effect=>activeCardRules(effect,'scoutReact').length);
  const shuttle=activeCardRules(card,'shuttleVehicle').length;
  const floater=card.id==='Dark:1685'&&activeCardRules(card,'floaterReact').length&&window.kind==='battle'&&
   battleCandidates(side,window.site).some(unit=>characterTraits(unit).includes('thief')||PremiereUnits.hasSkill(unit,'smuggler')||PremiereUnits.bountyHunter(unit));
  if(!shipReact&&!scout&&!shuttle&&!floater&&!['Light:2250','Light:2125','Dark:191','Light:1548','Dark:1547','Light:1609','Light:2307','Dark:2660'].includes(card.id))return [];
  if(!shipReact&&(currentGame()?.cardRulesVersion??latestCardRulesVersion)>=7&&PremiereUnits.textSuppressed(card))return [];
  return travelOptions(card,side,from,window.site,true).filter(option=>floater||option.cost<=forceBudget(side))
   .map(option=>({from,to:window.site,index,card,cost:floater?0:option.cost,movement:option.kind,scoutBonus:!!scout&&!scout.training?.granted}));
 }));
}

function reactDeployOptions(side,window){
 if(!window||window.cancelled||!['battle','drain'].includes(window.kind)||side===window.side)return [];
 const {hand,board}=PremiereGame.zones(state,side),loc=state.locations[window.site];
 const updated=(currentGame()?.cardRulesVersion??latestCardRulesVersion)>=18;
 const withinRange=slot=>slot===window.site||adjacentSites(slot,window.site);
 const allies=updated?PremiereLocations.entries(state,side):[];
 const czSource=updated?allies.some(({card,slot,unavailable})=>!unavailable&&PremiereUnits.active(card)&&
  withinRange(slot)&&activeCardRules(card,'characterDeployReact').length):(board??[]).some((row,slot)=>withinRange(slot)&&
  PremiereLocations.presentCards(state,side,slot).some(card=>PremiereUnits.active(card)&&card.id==='Light:593'&&!PremiereUnits.textSuppressed(card)));
 const hosts=updated?PremiereGame.sides.flatMap(actor=>PremiereLocations.entries(state,actor)):PremiereLocations.entries(state,side);
 const comlinkHost=czSource?null:hosts.find(({card,slot,unavailable})=>
  !unavailable&&card.type==='Character'&&PremiereUnits.active(card)&&withinRange(slot)&&
  (updated||window.comlinkHost===card||!state.comlinkUsedBy?.includes(card))&&
  card.attachments?.some(device=>(device.owner??device.side)===side&&activeCardRules(device,'device').some(rule=>rule.deployReact)))?.card;
 const corellia=isSystem(loc)&&PremiereLocations.rulesAt(state,window.site,side,'corelliaDeployReact').some(rule=>
  (state.game?.cardRulesVersion??latestCardRulesVersion)>=rule.since);
 const space=isSystem(loc)||loc?.subType==='Sector';
 const ships=space?PremiereLocations.presentCards(state,side,window.site).filter(card=>card.type==='Starship'&&PremiereUnits.active(card)):[];
 const spaceSource=ships.some(ship=>activeCardRules(ship,'spaceDeployReact').length||window.kind==='battle'&&
  ship.attachments?.some(device=>activeCardRules(device,'battleSpaceDeployReact').length));
 const ties=window.kind==='battle'?ships.filter(PremiereUnits.tie):[];
 const freeBlackFour=ties.some(card=>['black 2','black 3'].includes(locationTitle(card)));
 if(!loc||(!czSource&&!comlinkHost&&!corellia&&!spaceSource&&!ties.length))return [];
 const automation=updated?automatedDeployOptions(side,window.site):[];
 return (hand??[]).flatMap((card,index)=>{
  if(state.cancelledReactTitles?.includes(locationTitle(card))||!updated&&jawaCosts.has(card.id))return [];
  if(ties.length&&activeCardRules(card,'blackFourReact').length){
   return deployPilotOptions(side,index,window.site,freeBlackFour).map(option=>({card,index,site:window.site,
    cost:option.cost,args:[index,option.index],pilot:option.pilot,label:card.name+' mit '+option.pilot.name+' (Deploy-React, '+option.cost+' Force)'}));
  }
  if(!czSource&&!comlinkHost&&!spaceSource&&!(corellia&&card.type==='Starship'&&
    (locationTitle(card)==='millennium falcon'||/\bcorellian corvette\b/i.test(card.subType))))return [];
  const opponentCost=updated&&jawaCosts.has(card.id)?jawaDeployPayment(card,loc,side)?.opposing??0:0;
  const cost=boardDeployCost(card,loc,side);
  const options=cost===null?[]:[{card,index,cost,opponentCost,args:[index,-1]}];
  const offer=options.concat(deployPilotOptions(side,index,window.site)
   .filter(option=>!updated||cost===null).map(pilot=>({card,index,cost:pilot.cost,args:[index,pilot.index],pilot:pilot.pilot})),
   weaponPlacementOptions(side,card,window.site).map(option=>
    ({card,index,cost:option.cost,args:[index,-1,option.hostIndex],mount:option.mount,discount:option.discount,
     label:card.name+' an '+option.mount.host.name+' (Deploy-React, '+option.cost+' Force)'})));
  if(updated){
   const extra=(kind,item,cost,args,label,discount)=>offer.push({card,index,cost,args:[index,-1,kind,...args],placement:kind,item,label,opponentCost,discount});
   for(const action of automation.filter(option=>option.index===index))extra('automated',null,action.cost,[],null);
   if(card.type==='Device'){
    for(const mount of deviceHosts(side,index).filter(option=>option.slot===window.site)){
     extra('device',mount.host,mount.cost,[mount.index,mount.hostSide],card.name+' an '+mount.host.name+' (Deploy-React, '+mount.cost+' Force)',mount.discount);
    }
    for(const option of boltDeployOptions(side,index).filter(option=>option.args[1]===window.site)){
     extra('device',option.host,option.cost,[-1,option.args[2]],option.label);
    }
    if(locationEffectRule(card)?.siteDevice)for(const option of locationEffectOptions(side,index).filter(option=>option.args[1]===window.site)){
     extra('siteDevice',null,option.cost,[],option.label);
    }
   }
   if(card.type==='Character'&&(card.owner??card.side)===side&&withinDeploymentLimit(card,side)&&
     characterLocationAllowed(card,loc)&&hasDeployPresence(side,loc)&&!activeCardRules(card,'deployUndercover').length){
    const jawa=jawaCosts.has(card.id),payment=jawa?jawaDeployPayment(card,loc,side):{own:crewDeployCost(card,side,loc),opposing:0};
    if(Number.isFinite(payment?.own)&&(jawa?canPayJawaDeploy(side,payment):payment.own<=forceBudget(side))){
     for(const [hostIndex,host] of (board[window.site]??[]).entries())for(const role of PremiereUnits.roles(host,card)){
      extra('crew',host,payment.own,[hostIndex,role],card.name+' an Bord von '+host.name+' · '+role+' (Deploy-React, '+payment.own+' Force)');
     }
    }
   }
  }
  return offer.map(option=>({...option,site:window.site,comlinkHost}));
 });
}

function openReactWindow(kind,side,site,bonus){
 if(!state.game)return false;
 const frame={kind,side,site,bonus};
 if(kind==='battle'&&(state.game.cardRulesVersion??latestCardRulesVersion)>=21)frame.powerAtInitiation=battleTotals(site,side);
 const opponent=PremiereGame.otherSide(side);
 const stick=kind==='battle'&&PremiereGame.sides.some(actor=>battleWeaponOptions(actor,'initiation').length);
 if(!stick&&!reactOptions(opponent,frame).length&&!reactDeployOptions(opponent,frame).length&&!hasInterruptResponse(frame))return false;
 PremiereGame.openResponse(state.game,frame);
 return true;
}

function resolveResponsePass(side){
 const game=state.game;
 const frame=PremiereGame.passResponse(game,side);
 if(!frame||frame===true)return frame;
 if(hothEnabled()&&frame.kind==='hothCreatureReact'){hothFinishCreatureReact();return true;}
 if(hothEnabled()&&frame.kind==='hothRescue'){if(!frame.cancelled)frame.finish();return true;}
 if(hothEnabled()&&frame.interrupt==='hoth'){settleHothInterrupt(frame,PremiereGame.responseWindow(game));return true;}
 if(hothEnabled()&&frame.hothEffect){settleHothEffect(frame);return true;}
 if(frame.kind==='extinguishAbility'){resolveAnhResponse(frame,PremiereGame.responseWindow(game));return true;}
 if(typeof dagobahEnabled==='function'&&dagobahEnabled()&&frame.kind.startsWith('dagobah')){frame.finish?.(frame);return true;}
 if(typeof cloudCityEnabled==='function'&&cloudCityEnabled()&&frame.kind.startsWith('cloudCity')){frame.finish?.(frame);return true;}
 if(frame.kind==='beforeBattleDestiny'){battleDestiny(frame.side,false);return true;}
 if(frame.kind==='justFired'){frame.finish();return true;}
 if(frame.kind==='poisonStinger'){settlePoisonStinger(frame);return true;}
 if(frame.kind==='tractorBeam'){settleTractorBeam(frame);return true;}
 if(frame.kind==='destiny'){
  frame.finish(frame);
  return true;
 }
 if(['weaponTarget','weaponDefense','evazanWindow','controlTheft'].includes(frame.kind)){
  frame.finish?.(frame);
  return true;
 }
 if(frame.kind==='evazanOperation'){
  const window=PremiereGame.responseWindow(game),target=PremiereLocations.findEntry(state,frame.target);
  if(window&&target&&evazanOperators(frame.side,window).includes(frame.operator)&&loseTableCard(target.side,target.slot,target.card)){
   log(frame.operator.name+' operiert '+target.card.name+'. Die Karte geht verloren.');
   PremiereGame.cancelResponse(game,window);
   settleCancelledResponse(game);
  }
  return true;
 }
 if(frame.kind==='battleMoveAbility'){settleBattleRetreat(frame);return true;}
 if(frame.kind==='battleForceLost'){
  if(frame.key==='remaining'&&!frame.debt.remaining)finishPendingForceLoss(frame.debt);
  return true;
 }
 if(frame.kind==='deployment'){
  frame.afterDeployment?.();
  if(frame.resumeEmergency)state.pendingCardView=frame.resumeEmergency;
  settleCancelledResponse(game);
  return true;
 }
 if(['aboutToLoseBattle','shipLoss','characterLost','finishedBattle','equipmentLost'].includes(frame.kind)){
  finishQueuedRuleResponse(frame);
  return true;
 }
 if(frame.kind==='dodonnaCounter'||frame.kind==='unitTableCancel'){
  const parent=PremiereGame.responseWindow(game);
  if(parent?.card?.id===(frame.kind==='dodonnaCounter'?'Dark:2833':frame.targetId))PremiereGame.cancelResponse(game,parent);
  settleCancelledResponse(game);
  return true;
 }
 if(frame.kind==='lateralMechanicCounter'){
  const parent=PremiereGame.responseWindow(game);
  if(parent?.card?.id==='Dark:1480'&&mechanicCanCancelLateral(frame.side,parent.target)===frame.card)PremiereGame.cancelResponse(game,parent);
  settleCancelledResponse(game);
  return true;
 }
 if(frame.kind==='bastEvacuation'){
  for(const card of frame.units)relocateCharacter(frame.side,card,frame.destination);
  return true;
 }
 if(frame.kind==='battleDestinyResults'){
  settlePowerSegment();
  return true;
 }
 if(frame.kind==='battleOutcome'){
  prepareDamageSegment();
  return true;
 }
 if(frame.kind==='interrupt'){
  const parent=PremiereGame.responseWindow(game);
  if(frame.interrupt==='anhResponse'){
   resolveAnhResponse(frame,parent);
  }else if(frame.interrupt==='battleEffect'){
   settleBattleEffect(frame);
  }else if(frame.interrupt==='combinedAttack'){
   settleCombinedAttack(frame);
  }else if(frame.interrupt==='duel'){
   settleDuel(frame);
  }else if(frame.interrupt==='obiAssist'){
   settleObiAssist(frame);
  }else if(frame.interrupt==='helpRebel'){
   settleHelpRebel(frame);
  }else if(frame.interrupt==='tallonSlip'){
   if(parent?.rule?.mode==='tallonRoll')parent.slip={ability:frame.ability};
   PremiereGame.zones(state,frame.side).used.push(frame.card);
  }else if(frame.interrupt==='interiorExclusion'){
   const targets=interiorBattleTargets(parent);
   if(targets.length){
    const excluded=battleSession.excludedUnits??=new Set();
    for(const target of targets)excluded.add(target);
    log(frame.card.name+' schließt '+targets.map(card=>card.name).join(', ')+' vom Battle aus.');
   }
   loseOwnedCard(frame.card,frame.side,'hand');
  }else if(frame.interrupt==='damageRelief'){
   settleDamageRelief(frame);
  }else if(frame.interrupt==='droidRedirect'){
   const shot=parent?.shot,entry=PremiereLocations.findEntry(state,frame.target);
   if(shot&&entry&&!entry.unavailable&&entry.slot===frame.site){
    const defense=wearingUtinniGear(frame.target,'plastoid-armor')?5:PremiereWeapons.defense(frame.target,cardAbility(frame.target));
    const redirected=weaponShot(shot.weapon,shot.host,frame.target,defense);
    if(redirected)Object.assign(shot,redirected,{target:frame.target,forfeitReplacement:frame.originalForfeit});
   }
   PremiereGame.zones(state,frame.side).used.push(frame.card);
  }else if(frame.interrupt==='nobleSacrifice'){
   if(frame.amount>0&&PremiereGame.zones(state,frame.side).lost.length)state.pendingCardView={
    mode:'optionalRetrieval',side:frame.side,card:frame.card,amount:frame.amount,shown:[],lostAfter:true,
   };
   else loseOwnedCard(frame.card,frame.side);
  }else if(frame.interrupt==='retrieve'){
   settleRetrieval(frame);
  }else if(frame.interrupt==='limitedResources'){
   settleLimitedResources(frame);
  }else if(frame.interrupt==='gravelStorm'){
   settleGravelStorm(frame);
  }else if(frame.interrupt==='pileInterrupt'){
   settlePileInterrupt(frame);
  }else if(frame.interrupt==='shipTiming'){
   settleShipTiming(frame,parent);
  }else if(frame.interrupt==='battleMoveAway'){
   settleBattleRetreat(frame);
  }else if(frame.interrupt==='barrier'){
   settleBarrier(frame);
  }else if(['openingDestiny','hansDice','swapBattleDestiny'].includes(frame.interrupt)){
   settleBattleTimingInterrupt(frame,parent);
  }else if(frame.interrupt==='shufflePile'){
   settleShuffle(frame);
  }else if(frame.interrupt==='overload'){
   resolveOverload(frame);
  }else if(frame.interrupt==='groupRelocation'){
   finishGroupRelocation(frame);
  }else if(frame.interrupt==='garbageChute'){
   finishGarbageChute(frame,parent);
  }else if(frame.interrupt==='shipEvacuation'){
   resolveShipEvacuation(frame,parent);
  }else if(frame.interrupt==='emergencyDeployment'){
   revealEmergencyCards(frame);
  }else if(frame.interrupt==='chokeAfterBattle'){
   settlePostBattleChoke(frame);
  }else if(['oldBen','kintanStrider','postBattleStarfighter'].includes(frame.interrupt)){
   settleRecentLossInterrupt(frame);
  }else if(frame.interrupt==='battleTieLoss'){
   resolveBattleTieLoss(frame);
  }else if(frame.interrupt==='battleDamageModifier'){
   settleBattleDamageModifier(frame,parent);
  }else if(['reduceForceLoss','increaseForceLoss'].includes(frame.interrupt)){
   settleLossAdjustment(frame,parent);
  }else if(frame.interrupt==='droidShutdown'){
   if(parent){
    (state.droidProtection??=new Map()).set(frame.target,{side:frame.side,turn:game.timing.turn});
    PremiereGame.cancelResponse(game,parent);
    log(frame.card.name+' schützt '+frame.target.name+' bis Zugende.');
   }
   PremiereGame.zones(state,frame.side).used.push(frame.card);
   settleCancelledResponse(game);
  }else if(frame.interrupt==='assault'){
   PremiereGame.cancelResponse(game,parent);
   resolveAssault(frame,parent.side);
  }else{
   const {used,lost}=PremiereGame.zones(state,frame.side);
   if((game.cardRulesVersion??0)>=33)(state.resolvingInterrupts??=[]).push(frame);
   const complete=cancelled=>{
    if(state.resolvingInterrupts){state.resolvingInterrupts=state.resolvingInterrupts.filter(item=>item!==frame);if(!state.resolvingInterrupts.length)delete state.resolvingInterrupts;}
    const mixedUsed=hothEnabled()&&frame.card.set==='3'&&frame.card.subType==='Used Or Lost'&&
     !(frame.card.id==='Dark:2645'&&locationTitle(frame.tableEffect?.card??frame.targetEffect?.card??frame.weaponTarget?.card??parent?.card)==='crash site memorial');
    const dagobahLost=typeof dagobahEnabled==='function'&&dagobahEnabled()&&['sense','alter'].includes(frame.interrupt)&&(dagoEffects('Light:745').length||dagoEffects('Dark:2551').length);
    (dagobahLost||frame.interrupt==='namedCounter'&&frame.card.subType!=='Used'&&!mixedUsed&&!(typeof cloudCityEnabled==='function'&&cloudCityEnabled()&&['Light:511','Light:1334','Dark:1116','Dark:2807'].includes(frame.card.id))?lost:used).push(frame.card);
    if(dagobahLost&&cancelled&&frame.counterMode!=='direct')(state.hothDeferred??=[]).push(()=>dagoLoss(frame.side,2,'Do, Or Do Not / There Is No Try'));
    if(cancelled){
     if(frame.tableEffect)cancelTableEffect(frame.tableEffect);
     else if(frame.weaponTarget)loseTableCard(frame.weaponTarget.side,frame.weaponTarget.slot,frame.weaponTarget.card);
     else if(frame.targetEffect&&Number.isInteger(frame.site))cancelLocationEffect(frame.site,frame.targetEffect);
     else if(frame.targetEffect)cancelLostPileEffect(frame.targetEffect);
     else PremiereGame.cancelResponse(game,parent);
    }
    settleCancelledResponse(game);
    if(frame.duringBattle)finishWeaponAction(frame.side,false);
   };
   if(frame.counterMode==='direct'||(!frame.counterMode&&parent?.kind==='interrupt'&&['sense','alter'].includes(parent.interrupt)))complete(true);
   else if(frame.counterCharacter&&!PremiereLocations.activeCards(state,frame.side).includes(frame.counterCharacter))complete(false);
   else drawDestinySeries(frame.side,'interrupt',1,0,draws=>{
    const draw=draws.find(item=>!item.cancelled),destiny=draw?.value??null;
    const ability=frame.counterCharacter?cardAbility(frame.counterCharacter):frame.ability;
    const cancelled=destiny!==null&&destiny<ability;
    log(frame.card.name+': Destiny '+(destiny??'–')+' gegen Ability '+ability+(cancelled?' · Aktion aufgehoben.':' · Aktion bleibt bestehen.'));
    complete(cancelled);
   });
   return true;
  }
 }else if(frame.kind==='react'&&!frame.cancelled){
  const {board}=PremiereGame.zones(state,frame.side);
  const index=frame.deploy?-1:board[frame.from].indexOf(frame.card);
  const carried=hothEnabled()&&frame.hothCarried&&PremiereLocations.findEntry(state,frame.card)?.slot===frame.from;
  if(frame.deploy||index>=0||carried){
   if(frame.deploy){
    if(frame.mount){
     const stillPresent=weaponMounts(frame.side,true).find(mount=>mount.slot===frame.site&&mount.host===frame.mount.host);
     if(stillPresent&&!PremiereWeapons.disarmed(stillPresent.host))attachWeapon(stillPresent,frame.card);
     else loseOwnedCard(frame.card,frame.side);
    }else if(frame.placement){
     const goal=frame.item,entry=goal&&PremiereLocations.findEntry(state,goal);
     if(frame.placement==='siteDevice')placeLocationEffect(frame);
     else if(frame.placement==='automated')placeAutomatedWeapon(frame.side,frame.card,frame.site);
     else if(!entry||entry.slot!==frame.site||entry.unavailable)loseOwnedCard(frame.card,frame.side);
     else if(frame.placement==='device')(goal.attachments??=[]).push(frame.card);
     else if(PremiereUnits.accepts(goal,frame.card,frame.crewRole)){
      PremiereUnits.add(goal,frame.card,frame.crewRole,frame.side);
      (state.deployedThisTurn??=[]).push(frame.card);
     }else loseOwnedCard(frame.card,frame.side);
    }else{
     frame.card.controller=frame.side;
     if(frame.pilot)PremiereUnits.add(frame.card,frame.pilot,'pilot',frame.side);
     board[frame.site].push(frame.card);
     if(activeCardRules(frame.card,'deployUndercover').length)setUndercover(frame.card,frame.side);
     (state.deployedThisTurn??=[]).push(frame.card);
    }
   }else if(carried){
    detachTableCard(frame.side,frame.from,frame.card);board[frame.site].push(frame.card);
    if(frame.movement==='Landspeed')noteMineTraversal(frame.side,frame.from,frame.site,frame.card);
   }else{
    board[frame.site].push(...board[frame.from].splice(index,1));
    if(frame.scoutBonus)frame.card.scoutReactTurn=state.game.timing.turn;
    if(frame.movement==='Landspeed')noteMineTraversal(frame.side,frame.from,frame.site,frame.card);
    if(frame.away)clearJuriAfterMove(frame.card,frame.side,frame.site);
   }
   if(hothEnabled())hothAfterReact(frame);
   log(frame.side+' · '+frame.card.name+' reagiert bei '+state.locations[frame.site].name+'.');
   const parent=PremiereGame.responseWindow(game);
   if(parent.kind==='battle'){
    const completed={kind:'reactCompleted',side:frame.side,site:frame.site};
    if(hasInterruptResponse(completed))PremiereGame.openResponse(game,completed);
   }
   if(parent.kind==='drain'&&confirmedPresence(frame.side,frame.site)===true){
    PremiereGame.cancelResponse(game,parent);
    log('Force Drain aufgehoben: Der React hat Presence an den Ort gebracht.');
   }
   if(frame.deploy)openDeploymentReaction(frame.side,[frame.card,frame.pilot].filter(card=>card&&PremiereLocations.findEntry(state,card)));
  }
 }else if(frame.kind==='lostPileEffect'&&!frame.cancelled){
  placeLostPileEffect({card:frame.card,target:frame.target});
 }else if(frame.kind==='locationEffect'&&!frame.cancelled){
  if(frame.navigation)settleNavSabotage(frame);
  else placeLocationEffect(frame);
 }else if(frame.kind==='tableEffect'&&!frame.cancelled){
  placeTableEffect(frame);
 }else if(frame.kind==='drain'&&!frame.cancelled){
  resolveForceDrain(frame.side,frame.site,frame.bonus);
 }else if(frame.kind==='battle'){
  if(!frame.cancelled&&battlePresence('Light',frame.site)&&battlePresence('Dark',frame.site))enterBattleSegments();
  else {loseHitsFromInterruptedBattle(battleSession);battleSession=null;PremiereGame.expire(game,'battle');}
 }
 settleCancelledResponse(game);
 return true;
}

function settleBattleTimingInterrupt(frame,parent){
 const {used,lost}=PremiereGame.zones(state,frame.side);
 (frame.card.subType==='Used'?used:lost).push(frame.card);
 if(frame.interrupt==='openingDestiny'){
  scheduleBattleDestiny(frame.side,'battle',1);
  log(frame.card.name+' fügt eine Battle Destiny hinzu.');
 }else if(frame.interrupt==='hansDice'){
  parent.draw.cancelled=true;
  parent.redraw=true;
  log(frame.card.name+' ersetzt den Battle-Destiny-Draw.');
 }else{
  const x=battleSession;
  [x.lightDestiny,x.darkDestiny]=[x.darkDestiny,x.lightDestiny];
  log(frame.card.name+' tauscht die beiden Battle-Destiny-Werte.');
 }
}

function settleCancelledResponse(game){
 const cancelled=PremiereGame.removeCancelledResponse(game);
 if(hothEnabled()&&cancelled?.kind==='hothRescue')cancelled.afterCancel?.();
 if(['weaponTarget','evazanWindow'].includes(cancelled?.kind))cancelled.finish?.(cancelled);
 if(cancelled?.kind==='battleForceLost'&&cancelled.key==='remaining'&&!cancelled.debt.remaining)finishPendingForceLoss(cancelled.debt);
 if(['lostPileEffect','locationEffect','tableEffect'].includes(cancelled?.kind)){
  loseOwnedCard(cancelled.card,cancelled.side);
  log(cancelled.card.name+' wurde beim Ausspielen aufgehoben.');
 }
 if(cancelled?.kind==='interrupt'){
  if(hothEnabled()&&cancelled.interrupt==='hoth')settleHothInterrupt(cancelled,null);
  else if(cancelled.interrupt==='battleEffect')settleBattleEffect(cancelled);
  else if(cancelled.interrupt==='combinedAttack')settleCombinedAttack(cancelled);
  else if(cancelled.interrupt==='duel')settleDuel(cancelled);
  else if(cancelled.interrupt==='retrieve')settleRetrieval(cancelled);
  else if(cancelled.interrupt==='limitedResources')settleLimitedResources(cancelled);
  else if(cancelled.interrupt==='gravelStorm')settleGravelStorm(cancelled);
  else if(cancelled.interrupt==='pileInterrupt')settlePileInterrupt(cancelled);
  else if(cancelled.interrupt==='shipTiming')finishPileInterrupt(cancelled);
  else if(cancelled.interrupt==='battleMoveAway')finishBattleRetreat(cancelled);
  else if(cancelled.interrupt==='barrier')settleBarrier(cancelled);
  else if(cancelled.interrupt==='shufflePile')settleShuffle(cancelled);
  else{
   PremiereGame.zones(state,cancelled.side).lost.push(cancelled.card);
   if((cancelled.interrupt==='overload'||cancelled.duringBattle)&&battleSession?.weaponTurn)finishWeaponAction(cancelled.side,false);
  }
  log(cancelled.card.name+' wurde aufgehoben und kommt in den Lost Pile.');
 }
 if(cancelled?.kind==='react'&&cancelled.deploy){
  loseOwnedCard(cancelled.card,cancelled.side);
  if(cancelled.pilot)loseOwnedCard(cancelled.pilot,cancelled.side);
  (state.cancelledReactTitles??=[]).push(locationTitle(cancelled.card));
 }
}

function battleDamageModifierOptions(side,window){
 const {hand}=PremiereGame.zones(state,side),site=window.site;
 const power=window.powerAtInitiation;
 return (hand??[]).flatMap((card,index)=>activeCardRules(card,'battleDamageModifier').flatMap(rule=>{
  let {multiplier}=rule,loser;
  const amplifies=window.kind==='interrupt'&&window.interrupt==='battleDamageModifier'&&window.card.id===rule.amplify;
  if(!amplifies){
   if(window.kind!=='battle')return [];
   if(rule.ownBattle){
    if(side!==window.side||!power||power.lightPower>=power.darkPower)return [];
    loser=PremiereGame.otherSide(side);
    if(PremiereLocations.presentCards(state,side,site).some(unit=>locationTitle(unit)==='han solo'))multiplier=rule.withHan;
   }else if(side===window.side)return [];
  }
  return [{kind:'battleDamageModifier',args:[index,'battleDamage'],index,card,multiplier,loser,amplifies,site,
   label:card.name+' · Battle Damage ×'+multiplier}];
 }));
}

function battleTieLossOptions(side,window){
 if(window.kind!=='battle'||side===window.side||PremiereGame.wasUsed(state.game,'turn','Light:758'))return [];
 const location=state.locations[window.site];
 if(!location||!isSystem(location)&&location.subType!=='Sector')return [];
 const {hand}=PremiereGame.zones(state,side);
 const ties=PremiereGame.sides.flatMap(actor=>PremiereLocations.presentCards(state,actor,window.site)).filter(tieLn);
 return (hand??[]).flatMap((card,index)=>activeCardRules(card,'battleTieLoss').flatMap(()=>ties.map((target,targetIndex)=>({
  kind:'battleTieLoss',index,args:[index,'loseTie',targetIndex],card,target,site:window.site,label:card.name+' · '+target.name+' verlieren lassen',
 }))));
}

function garbageChuteOptions(side,window){
 if(window.kind!=='battle'||sitePlanet(state.locations[window.site])!=='death star')return [];
 const destination=state.locations.findIndex(location=>location&&locationTitle(location)==='death star: trash compactor');
 if(destination===-1||destination===window.site)return [];
 const units=battleCandidates(side,window.site).filter(card=>card.type==='Character');
 if(!units.length||units.some(movementPrevented))return [];
 const {hand}=PremiereGame.zones(state,side);
 return (hand??[]).flatMap((card,index)=>activeCardRules(card,'garbageChute').map(()=>({
  kind:'garbageChute',card,index,args:[index,'garbageChute'],destination,units,label:card.name+' · zum Trash Compactor und Battle aufheben',
 })));
}

function bastEvacuationOptions(side,window){
 const location=state.locations[window.site];
 if(window.kind!=='battle'||!location||!isSystem(location))return [];
 const destinations=state.locations.flatMap((card,slot)=>card&&sitePlanet(card)===locationGroup(location)?[slot]:[]);
 if(!destinations.length)return [];
 const entries=PremiereLocations.entries(state,side).filter(entry=>entry.slot===window.site&&!entry.unavailable&&
  entry.card.type==='Character'&&PremiereUnits.active(entry.card)&&!movementPrevented(entry.card));
 return entries.flatMap(({card,carriers})=>{
  if(!activeCardRules(card,'bastEvacuation').length)return [];
  const companions=entries.filter(entry=>entry.card!==card&&!isDroid(entry.card)&&
   PremiereLocations.physicalPlace(entry)===PremiereLocations.physicalPlace({slot:window.site,carriers}));
  return companions.flatMap(({card:other},index)=>destinations.map(destination=>({
   kind:'bastEvacuation',index:-1,args:[-1,'bast',index,destination],card,units:[card,other],destination,
   label:card.name+' · mit '+other.name+' nach '+state.locations[destination].name+' evakuieren',
  })));
 });
}

function finishGarbageChute(frame,parent){
 if(parent?.kind==='battle'){
  for(const unit of frame.units)relocateCharacter(frame.side,unit,frame.destination);
  PremiereGame.cancelResponse(state.game,parent);
  loseHitsFromInterruptedBattle(battleSession);
  battleSession=null;
  endBattleTiming();
 }
 PremiereGame.zones(state,frame.side).used.push(frame.card);
 settleCancelledResponse(state.game);
}

function queueRuleResponse(frame){
 if(!state?.game||!hasInterruptResponse(frame))return false;
 (state.ruleResponses??=[]).push(frame);
 return true;
}

function queueCharacterLoss(side,card,site,forfeited){
 if(card.type!=='Character'&&!(card.type==='Starship'&&locationTitle(card)==="vader's custom tie"))return;
 queueRuleResponse({kind:'characterLost',side,fallen:card,site,forfeited,hit:!!card.hothWasHitForfeit,duringBattle:!!battleSession});
}

function queueMemorialLoss(side,card,site){
 if(!(isDroid(card)||['Starship','Vehicle','Weapon','Device'].includes(card.type))||
   !(state.tableEffects??[]).some(effect=>effect.support)&&!(hothEnabled()&&(card.hothWasHitForfeit||HothRules.atat(card)||/\bAT-ST\b|Jabba.s Sail Barge/i.test((card.subType??'')+' '+(card.name??''))||card.id==='Light:1910')))return;
 queueRuleResponse({kind:'equipmentLost',side:PremiereGame.otherSide(side),fallen:card,site,hit:!!card.hothWasHitForfeit});
}

function memorialLossOptions(side,window){
 const {lost}=PremiereGame.zones(state,side);
 if(side===window.side||!lost.includes(window.fallen))return [];
 return (state.tableEffects??[]).flatMap((effect,index)=>effect.target===side&&effect.support&&tableEffectRule(effect.card)?.memorial?[{
  kind:'memorialStack',index,args:[index,'memorialStack'],card:effect.card,effect,label:effect.card.name+' · '+window.fallen.name+' stapeln',
 }]:[]);
}

function memorialExchangeOptions(side){
 const {hand}=PremiereGame.zones(state,side);
 return (state.tableEffects??[]).flatMap((effect,index)=>{
  if(effect.target!==side||!effect.support?.length||!tableEffectRule(effect.card)?.memorial||PremiereGame.wasUsed(state.game,'phase',effect.card.id))return [];
  return hand.flatMap((card,i)=>effect.support.map((stored,j)=>({card,args:[index,i,j],effect,stored,
   label:effect.card.name+' · '+card.name+' gegen '+stored.name+' tauschen'})));
 });
}

function memorialExchange(side,index,fromHand,fromStack){
 const option=memorialExchangeOptions(side).find(choice=>choice.args[0]===index&&choice.args[1]===fromHand&&choice.args[2]===fromStack);
 if(!option)return false;
 const {hand}=PremiereGame.zones(state,side);
 [hand[fromHand],option.effect.support[fromStack]]=[option.stored,option.card];
 PremiereGame.useOnce(state.game,'phase',option.effect.card.id);
 log(option.label+'.');
 return true;
}

function openQueuedRuleResponse(){
 if(!state.ruleResponses?.length||state.pendingCardView||state.pendingCustody?.length||state.game.timing.pending||
   PremiereGame.responseWindow(state.game))return;
 while(state.ruleResponses.length){
  const frame=state.ruleResponses.shift();
  if(hasInterruptResponse(frame)){
   PremiereGame.openResponse(state.game,frame);
   return;
  }
  finishQueuedRuleResponse(frame);
 }
}

function finishQueuedRuleResponse(frame){
 if(frame.kind==='aboutToLoseBattle'){if(!frame.replaced)frame.finish();return;}
 if(frame.kind!=='shipLoss')return;
 loseTableCard(frame.owner,frame.site,frame.ship,false,frame.forfeited,true);
 const fight=battleSession;
 if(fight?.damage){
  const debt=fight.damage.debt[frame.owner],crew=activeBattleUnits(frame.owner);
  debt.hits=debt.hits.filter(card=>crew.includes(card));
  debt.charged=debt.charged?.filter(card=>crew.includes(card));
 }
}

function evacuationSeats(ship,units){
 const copy={...ship,occupants:(ship.occupants??[]).slice()},seats=[];
 for(const card of units){
  const role=PremiereUnits.roles(copy,card).find(role=>['pilot','passenger','astromech'].includes(role));
  if(!role)return null;
  const seat={card,role};
  seats.push(seat);
  copy.occupants.push(seat);
 }
 return seats;
}

function shipEvacuationOptions(side,frame){
 if(side!==frame.owner||frame.evacuated)return [];
 const {hand}=PremiereGame.zones(state,side);
 if(!(hand??[]).some(card=>activeCardRules(card,'shipEvacuation').length))return [];
 const ship=PremiereLocations.findEntry(state,frame.ship);
 if(!ship||ship.slot!==frame.site)return [];
 const aboard=PremiereLocations.activeCards(state,side).filter(card=>
  card.type==='Character'&&PremiereUnits.active(card)&&PremiereLocations.aboard(state,card,frame.ship));
 const units=aboard.filter(card=>!movementPrevented(card));
 if(!units.length)return [];
 return hand.flatMap((card,index)=>activeCardRules(card,'shipEvacuation').flatMap(rule=>{
  if(rule.ships&&aboard.some(unit=>locationTitle(unit)==='grand moff tarkin'))return [];
  const choices=state.locations.flatMap((location,slot)=>location&&isSite(location)&&location.locationTags?.includes('Planet')?
   [{slot,name:location.name}]:[]);
  if(rule.ships&&units.length===aboard.length)for(const entry of PremiereLocations.entries(state,side)){
   const target=entry.card;
   if(target===frame.ship||entry.unavailable||!PremiereUnits.capital(target))continue;
   const seats=evacuationSeats(target,units);
   if(seats)choices.push({slot:entry.slot,ship:target,seats,name:target.name});
  }
  return choices.map((destination,destinationIndex)=>({kind:'shipEvacuation',card,index,units,destination,
   args:[index,'evacuate',destinationIndex],label:card.name+' · Besatzung nach '+destination.name}));
 }));
}

function resolveShipEvacuation(frame,parent){
 const {destination,side,units}=frame;
 if(parent?.kind==='shipLoss'){
  if(destination.ship){
   const seats=evacuationSeats(destination.ship,units);
   if(seats)for(const {card,role} of seats){
    const source=PremiereLocations.findEntry(state,card);
    if(source&&detachTableCard(side,source.slot,card))PremiereUnits.add(destination.ship,card,role,side);
   }
  }else for(const card of units)relocateCharacter(side,card,destination.slot);
  parent.evacuated=true;
  log(frame.card.name+' bringt die Besatzung zu '+destination.name+'.');
 }
 PremiereGame.zones(state,side).used.push(frame.card);
}

function recentlyLostOptions(side,window){
 const {hand,force,lost=[]}=PremiereGame.zones(state,side);
 if(!forceBudget(side))return [];
 const kintan=side!==window.side&&lost.findLast(card=>card.type==='Character');
 const fallen=window.fallen;
 const revival=side===window.side&&window.forfeited&&sitePlanet(state.locations[window.site])==='tatooine'&&
  locationTitle(fallen)!=='obi-wan kenobi'&&lost.includes(fallen);
 const targets=window.kind==='finishedBattle'&&state.locations[window.site]&&
  (isSystem(state.locations[window.site])||state.locations[window.site].subType==='Sector')?
   PremiereLocations.presentCards(state,PremiereGame.otherSide(side),window.site).filter(card=>
    PremiereUnits.fighter(card)&&Number.isFinite(craftStats(card,window.site).maneuver)):[];
 return (hand??[]).flatMap((card,index)=>{
  const options=[];
  if(window.kind==='characterLost'&&revival&&activeCardRules(card,'oldBen').length){
   options.push({kind:'oldBen',args:[index,'oldBen'],index,card,cost:1,target:fallen,site:window.site,
    label:card.name+' · '+fallen.name+' zurück zur Site (1 Force)'});
  }
  if(window.kind==='characterLost'&&kintan&&activeCardRules(card,'kintanStrider').length){
   options.push({kind:'kintanStrider',args:[index,'kintan'],index,card,cost:1,label:card.name+' · Charakter auf die Hand holen (1 Force)'});
  }
  if(activeCardRules(card,'postBattleStarfighter').length)for(const [targetIndex,target] of targets.entries()){
   options.push({kind:'postBattleStarfighter',args:[index,'afterBattle',targetIndex],index,card,cost:1,target,site:window.site,
    label:card.name+' · '+target.name+' zum Ziel wählen (1 Force)'});
   if(activeCardRules(target,'problemTargetBonus').length)options.push({kind:'postBattleStarfighter',args:[index,'afterBattle',targetIndex,'bonus'],
    index,card,cost:1,modifier:2,target,site:window.site,label:card.name+' · '+target.name+' zum Ziel wählen (+2 Destiny, 1 Force)'});
  }
  return options;
 });
}

function tacticalRecallOptions(side,window){
 if(window.kind!=='finishedBattle'||window.winner!==side||!window.participants)return [];
 const warriors=PremiereGame.sides.flatMap(actor=>window.participants[actor]??[]).filter(card=>
  card.type==='Character'&&PremiereUnits.hasSkill(card,'warrior')&&PremiereUnits.active(card)&&PremiereLocations.findEntry(state,card));
 const {hand}=PremiereGame.zones(state,side);
 return (hand??[]).flatMap((card,index)=>activeCardRules(card,'tacticalRecall').flatMap(()=>{
  if(!withinDeploymentLimit(card,side))return [];
  return state.locations.flatMap((loc,site)=>site!==window.site&&sitePlanet(loc)==='yavin 4'?
   warriors.map((target,targetIndex)=>({
    args:[index,'tacticalRecall',site,targetIndex],index,kind:'tacticalRecall',card,site,target,
    cost:sentryModifier(side,site,'deploy'),label:card.name+' · '+target.name+' nach '+loc.name+' zurückrufen',
   })).filter(option=>option.cost<=forceBudget(side)):[]);
 }));
}

function gearMissionOptions(side,window){
 const site=window.site,loc=state.locations[site];
 if(!loc)return [];
 const trigger=window.kind==='finishedBattle'&&window.winner===side&&sitePlanet(loc)==='tatooine'?'tatooine-win':
  window.kind==='characterLost'&&sitePlanet(loc)==='death star'&&
  (characterTraits(window.fallen).includes('stormtrooper')||locationTitle(window.fallen)==='stormtrooper')?'stormtrooper-loss':null;
 if(!trigger)return [];
 const {hand}=PremiereGame.zones(state,side),cost=sentryModifier(side,site,'deploy');
 if(cost>forceBudget(side))return [];
 return hand.flatMap((card,index)=>{
  const rule=locationEffectRule(card);
  return rule?.trigger===trigger&&withinDeploymentLimit(card,side)?missionTargets(rule.mission,side).map(({target,targetIndex})=>({
   args:[index,'gearMission',targetIndex],index,kind:'gearMission',card,site,target,cost,label:card.name+' · '+target.name+' nach '+loc.name,
  })):[];
 });
}

function nobleSacrificeOptions(side,window){
 if(side===window.side)return [];
 const {hand}=PremiereGame.zones(state,side);
 const entries=allWeaponEntries();
 const candidates=entries.filter(entry=>entry.card.type==='Character'&&(entry.card.owner??entry.card.side??entry.side)===side&&
  (!entry.unavailable||entry.captive));
 const power=entry=>entry.card.asleep?0:Math.max(0,(entry.card.power??0)+cardPowerModifier(entry.card,entry.side,entry.slot)-tacticalPenalty(entry.card));
 const deployed=window.targets.filter(card=>card.type==='Character').map(card=>entries.find(entry=>entry.card===card)).filter(Boolean);
 const values=new Set(deployed.map(power));
 return hand.flatMap((card,index)=>activeCardRules(card,'nobleSacrifice').flatMap(()=>candidates.flatMap((entry,i)=>
  values.has(power(entry))?[{args:[index,'nobleSacrifice',i],index,kind:'nobleSacrifice',card,entry,site:entry.slot,
   amount:cardForfeitValueAt(entry.card,side,entry.slot)??0,label:card.name+' · '+entry.card.name+' aus dem Spiel nehmen'}]:[])));
}

function settleRecentLossInterrupt(frame){
 const {side,card,target,site}=frame,{hand,lost,board}=PremiereGame.zones(state,side);
 if(frame.interrupt==='postBattleStarfighter'){
  drawDestinySeries(side,'interrupt',1,frame.modifier??0,draws=>{
   const entry=PremiereLocations.findEntry(state,target),value=draws.find(draw=>!draw.cancelled)?.value;
   if(entry?.slot===site&&!entry.unavailable&&Number.isFinite(value)&&value>craftStats(target,site).maneuver)
    loseTableCard(entry.side,entry.slot,target);
   loseOwnedCard(card,side);
  });
  return;
 }
 const bottom=frame.interrupt==='oldBen'?lost.indexOf(target):lost.findLastIndex(unit=>unit.type==='Character');
 if(bottom>=0){
  const [saved]=lost.splice(bottom,1);
  if(frame.interrupt==='oldBen'){
   if(battleSession?.participants)battleSession.participants[side]=battleSession.participants[side].filter(unit=>unit!==saved);
   board[site].push(saved);
  }else hand.push(saved);
  log(card.name+' holt '+saved.name+' zurück.');
 }
 loseOwnedCard(card,side);
}

function runContinuousInterruptCounters(game){
 const window=PremiereGame.responseWindow(game);
 if(window?.kind!=='interrupt'||!window.card)return;
 const hit=(state.tableEffects??[]).find(({card})=>activeCardRules(card,'autoCancelNamed').some(rule=>
  rule.ids.includes(window.card.id)||rule.names.includes(locationTitle(window.card))));
 if(!hit)return;
 PremiereGame.cancelResponse(game,window);
 log(hit.card.name+' hebt '+window.card.name+' auf.');
 settleCancelledResponse(game);
}

function resolveBattleTieLoss(frame){
 const target=PremiereLocations.findEntry(state,frame.target);
 if(target?.slot===frame.site&&!target.unavailable&&loseTableCard(target.side,target.slot,target.card)){
  log(frame.card.name+' · '+target.card.name+' geht verloren.');
 }
 loseOwnedCard(frame.card,frame.side);
}

function settleBattleDamageModifier(frame,parent){
 const {used,lost}=PremiereGame.zones(state,frame.side);
 (frame.card.subType==='Used'?used:lost).push(frame.card);
 if(frame.amplifies){
  if(parent?.interrupt==='battleDamageModifier')parent.multiplier*=frame.multiplier;
 }else if(battleSession)(battleSession.damageMultipliers??=[]).push({multiplier:frame.multiplier,loser:frame.loser});
 log(frame.card.name+' · Battle Damage ×'+frame.multiplier+'.');
}

function increasedLossOptions(side,window){
 const counter=window.interrupt==='reduceForceLoss',battle=window.kind==='battleForceLost';
 if(side===window.side||!counter&&!battle)return [];
 const {hand,force}=PremiereGame.zones(state,side);
 const amounts=battle?[1]:Array.from({length:(force?.length??0)+1},(_,index)=>force.length-index);
 return (hand??[]).flatMap((card,index)=>activeCardRules(card,'increaseForceLoss').flatMap(()=>amounts.map(amount=>({
  kind:'increaseForceLoss',card,index,args:[index,'increaseLoss',amount],amount,cost:counter?amount:0,
  label:card.name+' · '+(counter?'It Could Be Worse aufheben':'Force-Verlust erhöhen')+(amount?' (+ '+amount+' Force-Verlust)':''),
 }))));
}

function initiateReact(side,from,index,to){
 const game=state.game,window=PremiereGame.responseWindow(game);
 const option=reactOptions(side,window).find(x=>x.from===from&&x.index===index&&(!x.away||x.to===to));
 if(!option)return false;

 if(!PremiereGame.answer(game,side,{kind:'react',site:option.to,from,card:option.card,movement:option.movement,away:option.away,scoutBonus:option.scoutBonus,hothCarried:option.hothCarried}))return false;
 spendForce(side,option.cost);
 (state.reactedThisTurn??=[]).push(option.card,...(option.card.occupants??[]).map(entry=>entry.card));
 if(option.card.instanceId)PremiereGame.useOnce(game,'turn','react:'+option.card.instanceId);
 log(side+' initiiert einen React mit '+option.card.name+' für '+option.cost+' Force.');
 return true;
}

function initiateReactDeploy(side,...args){
 const game=state.game,window=PremiereGame.responseWindow(game);
 const [index,pilotIndex]=args;
 const option=reactDeployOptions(side,window).find(choice=>choice.args.length===args.length&&choice.args.every((value,i)=>value===args[i]));
 if(!option||!PremiereGame.answer(game,side,{kind:'react',deploy:true,site:window.site,card:option.card,pilot:option.pilot,
   mount:option.mount,placement:option.placement,item:option.item,crewRole:args[4]}))return false;
 const {hand}=PremiereGame.zones(state,side);
 for(const i of [index,pilotIndex].filter(i=>i>=0).sort((a,b)=>b-a))hand.splice(i,1);
 if(jawaCosts.has(option.card.id))spendJawaDeployForce(side,option.cost,option.opponentCost);
 else spendForce(side,option.cost);
 if(option.discount)PremiereGame.useOnce(game,'turn',option.discount);
 if(option.opponentCost)payOpposingJawaCost(side,option.opponentCost);
 if((currentGame()?.cardRulesVersion??latestCardRulesVersion)<18&&option.comlinkHost&&window.comlinkHost!==option.comlinkHost){
  window.comlinkHost=option.comlinkHost;
  (state.comlinkUsedBy??=[]).push(option.comlinkHost);
 }
 (state.reactedThisTurn??=[]).push(option.card,...(option.pilot?[option.pilot]:[]));
 log(side+' kündigt '+option.card.name+' als Deploy-React an ('+option.cost+' Force).');
 return true;
}

const isAlter=card=>['Light:95','Dark:94'].includes(card.id);
const isSense=card=>['Light:2217','Dark:2216'].includes(card.id);
function alterTarget(card,site){
 if(card?.type!=='Effect'||['Starting','Immediate','Political'].includes(card.subType))return false;
 if(activeCardRules(card,'locationEffect').some(rule=>rule.darkWaters)){
  return !Number.isInteger(site)||!PremiereGame.sides.some(actor=>PremiereLocations.presentCards(state,actor,site)
   .some(creature=>creature.type==='Creature'&&creature.subType==='Swamp'));
 }
 return !/immune to alter\b/i.test(card.gametext??'');
}

function highestInterruptCharacters(side){
 const characters=PremiereLocations.activeCards(state,side)
  .filter(card=>card.type==='Character'&&!card.undercover&&cardAbility(card)>0);
 const best=Math.max(0,...characters.map(cardAbility));
 return characters.filter(card=>cardAbility(card)===best);
}

const highestInterruptAbility=side=>cardAbility(highestInterruptCharacters(side)[0])??0;

function battleAccidentOptions(side,window){
 if(window.kind!=='battle'||!isSite(state.locations[window.site]))return [];
 const opponent=PremiereGame.otherSide(side),{hand}=PremiereGame.zones(state,side);
 const nearby=PremiereLocations.entries(state,opponent).filter(entry=>entry.slot===window.site&&!entry.unavailable&&PremiereUnits.active(entry.card));
 const targets=nearby.filter(entry=>entry.card.type==='Character');
 if(targets.length<2||!nearby.some(entry=>entry.card.type==='Weapon'))return [];
 return (hand??[]).flatMap((card,index)=>activeCardRules(card,'battleAccident').map(rule=>
  ({kind:'battleAccident',card,index,args:[index,'accident'],rule,targets,cost:rule.cost,label:card.name+' · Unfall an dieser Site'})));
}

function battleRetreatOptions(side,window){
 if(window.kind!=='battle'||(currentGame()?.cardRulesVersion??latestCardRulesVersion)<21)return [];
 const site=window.site,location=state.locations[site],opponent=PremiereGame.otherSide(side);
 if(!location)return [];
 const {hand}=PremiereGame.zones(state,side),options=[];
 const nearby=actor=>PremiereLocations.entries(state,actor).filter(entry=>entry.slot===site&&!entry.unavailable&&PremiereUnits.active(entry.card));
 const own=nearby(side),enemy=nearby(opponent);
 const here=own.filter(entry=>PremiereLocations.physicalPlace(entry)===site);
 const expel=enemy.filter(entry=>entry.card.type==='Character'&&cardAbility(entry.card)===1&&PremiereLocations.physicalPlace(entry)===site);
 const land=isSite(location)&&state.locations.some((loc,index)=>index!==site&&sitePlanet(loc)&&sitePlanet(loc)===sitePlanet(location));
 const space=(isSystem(location)||location.subType==='Sector')&&state.locations.some((loc,index)=>index!==site&&loc&&(isSystem(loc)||loc.subType==='Sector'));
 const add=(args,card,rule,targets,fromHand,description,source)=>options.push({args,card,rule,targets,fromHand,source,
  kind:'battleMoveAway',index:args[0],cost:rule.cost,label:card.name+' · '+description+' ('+rule.cost+' Force)'});
 if(land&&forceBudget(side)&&expel.length){
  for(const [sourceIndex,{card:host}] of here.entries()){
   for(const [itemIndex,source] of [host,...(host.attachments??[])].entries()){
    const [rule]=activeCardRules(source,'battleMoveAway');
    if(rule?.mode!=='singleExpel'||source.side&&source.side!==side||
      PremiereGame.wasUsed(state.game,'battle',source.instanceId??source.id))continue;
    for(const [index,entry] of expel.entries())add([-1,'retreatAbility',sourceIndex,itemIndex,index],source,rule,[entry],false,entry.card.name+' fortschicken',source);
   }
  }
 }
 for(const [index,card] of (hand??[]).entries()){
  const [rule]=activeCardRules(card,'battleMoveAway');
  if(!rule||rule.cost>(forceBudget(side)))continue;
  const args=[index,'retreatInterrupt'];
  if(rule.mode==='moveAlong'&&land&&expel.length&&here.some(entry=>forceUser(entry.card))){
   add(args,card,rule,expel,true,'gegnerische Figuren fortschicken');
  }else if(rule.mode==='narrowEscape'&&land&&side!==window.side&&here.some(entry=>entry.card.subType==='Rebel'&&cardAbility(entry.card)>2)){
   const units=own.filter(({card})=>(permanentPilotAbility(card)??cardAbility(card))>0);
   if(units.length&&units.every(({card})=>card.type==='Character'||Number.isFinite(card.landspeed)))
    add(args,card,rule,units,true,'eigene Karten entfernen');
  }else if(rule.mode==='hyperEscape'&&space){
   const ships=own.filter(({card})=>['Starship','Vehicle'].includes(card.type));
   if(ships.length)add(args,card,rule,ships,true,'eigene Schiffe und Fahrzeuge entfernen');
  }
 }
 return options;
}

function shipWeaponResponses(side,window){
 const {hand}=PremiereGame.zones(state,side),{shot}=window;
 if(window.kind==='weaponTarget'){
  if(side===window.side||shot.target.type!=='Starship'||shot.weapon.subType!=='Starship'||
     battleSession?.weaponDestinyPenalty?.has(shot.weapon))return [];
  return (hand??[]).flatMap((card,index)=>activeCardRules(card,'shipWeaponPenalty').map(rule=>
   ({kind:'shipTiming',card,index,args:[index,'shipTiming'],rule,label:card.name+' · Waffen-Destiny senken'})));
 }
 return (hand??[]).flatMap((card,index)=>activeCardRules(card,'pileInterrupt').filter(rule=>
  rule.mode==='shipManeuvers'&&maneuverTarget(shot.target,rule)).map(rule=>
   ({kind:'shipTiming',card,index,args:[index,'shipTiming'],rule,label:card.name+' · '+shot.target.name+' weicht aus'})));
}

function droidRedirectOptions(side,window){
 if(side===window.side||window.kind!=='weaponTarget'||window.combined||window.shot.forfeitReplacement!==undefined)return [];
 const shot=window.shot,target=PremiereLocations.findEntry(state,shot.target);
 if(!target||!isSite(state.locations[target.slot]))return [];
 const {hand}=PremiereGame.zones(state,side),place=PremiereLocations.physicalPlace(target);
 return hand.flatMap((card,index)=>activeCardRules(card,'droidRedirect').flatMap(()=>
  PremiereLocations.presentCards(state,side,place).flatMap((droid,i)=>{
   if(droid===shot.target||!isDroid(droid)||droidProtectedFrom(droid,window.side)||
      !weaponShot(shot.weapon,shot.host,droid,PremiereWeapons.defense(droid,cardAbility(droid))))return [];
   return [{kind:'droidRedirect',card,index,args:[index,'droidRedirect',i],target:droid,site:target.slot,
    originalForfeit:cardForfeitValueAt(shot.target,target.side,target.slot),label:card.name+' · Schuss auf '+droid.name+' umlenken'}];
  })));
}

function settleShipTiming(frame,parent){
 if(!frame.cancelled&&parent?.shot){
  if(parent.kind==='weaponTarget'){
   (battleSession.weaponDestinyPenalty??=new Map()).set(parent.shot.weapon,frame.rule.amount);
  }else applyManeuverInterrupt(parent.shot.target,{id:frame.card.id,power:frame.rule.power});
 }
 finishPileInterrupt(frame);
}

function barrierOptions(side,window){
 if(side===window.side)return [];
 const {hand}=PremiereGame.zones(state,side);
 return (hand??[]).flatMap((card,index)=>{
  const [rule]=activeCardRules(card,'barrier');
  if(!rule||rule.cost>(forceBudget(side)))return [];
  return window.targets.flatMap((target,targetIndex)=>!['Character','Starship'].includes(target.type)||barredThisTurn(target)?[]:[{
   kind:'barrier',card,rule,target,index,args:[index,'barrier',targetIndex],
   label:card.name+' · '+target.name+' blockieren (1 Force)',
  }]);
 });
}

function settleBarrier(frame){
 if(!frame.cancelled&&PremiereLocations.findEntry(state,frame.target)){
  const deployment=PremiereGame.responseWindow(state.game);
  const shared=(state.game.cardRulesVersion??latestCardRulesVersion)>=25&&deployment?.kind==='deployment'&&
   deployment.targets.includes(frame.target);
  for(const target of shared?deployment.targets:[frame.target]){
   if(!PremiereLocations.findEntry(state,target))continue;
   (state.barredCards??=new Map()).set(target,state.game.timing.turn);
   log(target.name+' kann bis Zugende weder kämpfen noch sich bewegen.');
  }
 }
 finishPileInterrupt(frame);
}

function droidShutdownOptions(side,window){
 const target=window.interrupt==='combinedAttack'?window.shots[0].target:
  window.kind==='weaponTarget'&&window.shot.effect!=='block'&&!window.combined?window.shot.target:
  window.kind==='evazanOperation'||window.kind==='controlTheft'||window.kind==='hothDroidLoss'||window.interrupt==='chokeAfterBattle'||window.navigation?window.target:
  window.interrupt==='pileInterrupt'&&window.rule?.mode==='destroyDroid'?window.entry.card:null;
 if(side===window.side||!isDroid(target)||(target.owner??target.side)!==side)return [];
 const {hand}=PremiereGame.zones(state,side);
 return (hand??[]).flatMap((card,index)=>activeCardRules(card,'droidShutdown').map(rule=>
  ({kind:'droidShutdown',card,index,args:[index,'droidShutdown'],target,rule,label:card.name+' · '+target.name+' schützen'})));
}

function postBattleChokeOptions(side,window){
 if(!window.result||window.result.darkTotal<=window.result.lightTotal||side!=='Dark')return [];
 const {hand}=PremiereGame.zones(state,side);
 if(!forceBudget(side)||!PremiereLocations.presentCards(state,side,window.site).some(forceUser))return [];
 const targets=PremiereLocations.presentCards(state,'Light',window.site).filter(card=>
  card.type==='Character'&&PremiereUnits.active(card)&&!droidProtectedFrom(card,side));
 return (hand??[]).flatMap((card,index)=>activeCardRules(card,'chokeAfterBattle').flatMap(rule=>targets.map((target,i)=>({
  kind:'chokeAfterBattle',args:[index,'chokeAfter',i],index,card,target,site:window.site,cost:rule.cost,
  label:card.name+' · '+target.name+' würgen (1 Force)',
 }))));
}

function settlePostBattleChoke(frame){
 drawDestinySeries(frame.side,'interrupt',1,0,draws=>{
  const target=PremiereLocations.findEntry(state,frame.target),destiny=draws.find(draw=>!draw.cancelled)?.value;
  if(target?.slot===frame.site&&!target.unavailable&&Number.isFinite(destiny)&&destiny>cardAbility(target.card))
   loseTableCard(target.side,target.slot,target.card);
  loseOwnedCard(frame.card,frame.side);
 });
}

function informantReactChoices(side,site){
 return PremiereLocations.entries(state,side).flatMap((entry,index)=>{
  const {card,slot:from}=entry;
  if(card.type!=='Character'||entry.carriers.length||entry.unavailable||!adjacentSites(from,site)||reactMovementUsed(card)||
     !travelOptions(card,side,from,site,true).some(option=>option.kind==='Landspeed'))return [];
  return [{args:['move',index],card,from,to:site,label:card.name+' · kostenlos zum Battle bei '+state.locations[site].name}];
 });
}

function beforeBattleDestinyOptions(side,window){
 if(side===window.side)return [];
 return PremiereLocations.entries(state,side).flatMap((entry,index)=>{
  const {card,slot,unavailable}=entry,[rule]=activeCardRules(card,'beforeBattleDestiny');
  return rule&&!unavailable&&slot===window.site&&PremiereUnits.active(card)&&!excludedAtBattle(card,slot)&&
   !window.used?.includes(card)&&rule.cost<=forceBudget(side)?
    [{index:-1,args:[-1,'zutton',index],kind:'zutton',rule,card,cost:rule.cost,label:card.name+' · Battle Destiny −1 (1 Force)'}]:[];
 });
}

function baseInterruptResponses(side,window){
 if(!window||window.cancelled)return [];
 if(window.kind==='beforeBattleDestiny')return beforeBattleDestinyOptions(side,window);
 if(window.kind==='justFired')return poisonStingerOptions(side,window);
 if(window.kind==='equipmentLost')return memorialLossOptions(side,window);
 if(window.kind==='shipLoss')return shipEvacuationOptions(side,window);
 if(window.kind==='battleOutcome')return postBattleChokeOptions(side,window);
 if(window.kind==='characterLost'||window.kind==='finishedBattle')return recentlyLostOptions(side,window).concat(anhLostResponses(side,window),
  tacticalRecallOptions(side,window),gearMissionOptions(side,window),window.kind==='finishedBattle'?tractorBeamOptions(side,window):[]);
 if(window.kind==='deployment')return barrierOptions(side,window).concat(nobleSacrificeOptions(side,window));
 const protection=droidShutdownOptions(side,window);
 if(['weaponTarget','weaponDefense'].includes(window.kind))return shipWeaponResponses(side,window).concat(protection,droidRedirectOptions(side,window));
 if(window.kind==='evazanOperation')return protection;
 if(window.kind==='evazanWindow')return evazanOperators(side,window).map((operator,index)=>({
  kind:'evazanOperation',card:operator,index:-1,args:[-1,'evazan',index],target:window.target,
  label:operator.name+' operiert '+window.target.name,
 }));
 const damage=window.kind==='battle'||window.interrupt==='battleDamageModifier'?battleDamageModifierOptions(side,window):[];
 const loss=increasedLossOptions(side,window);
 if(window.kind==='battleForceLost')return loss;
 if(expandedCardRules()){
  const counter=counterResponses(side,window);
  if(counter)return counter.concat(immediateEffectResponses(side,window),protection,damage,loss,corellianSlipResponses(side,window));
 }
 const conquest=window.kind==='battle'&&window.side===side&&!window.conquestPeekUsed&&
  battleCandidates(PremiereGame.otherSide(side),window.site).some(card=>locationTitle(card)==='millennium falcon')&&
  battleCandidates(side,window.site).find(card=>activeCardRules(card,'conquestPeek').length);
 const peek=conquest&&PremiereGame.zones(state,PremiereGame.otherSide(side)).hand.length?
  [{kind:'conquestPeek',card:conquest,index:-1,args:[-1,'conquestPeek'],label:conquest.name+' · Gegnerische Hand ansehen'}]:[];
 const informant=window.kind==='battle'&&window.side!==side&&undercoverSpies(side,window.site).length&&informantReactChoices(side,window.site).length?
  PremiereGame.zones(state,side).hand.flatMap((card,index)=>activeCardRules(card,'informantReact').map(rule=>({
   kind:'informantReact',card,index,rule,args:[index,'informantReact'],label:card.name+' · Figuren kostenlos zum Battle bewegen',
  }))):[];
 const accidents=peek.concat(informant,battleAccidentOptions(side,window),battleRetreatOptions(side,window),damage,battleTieLossOptions(side,window),
  garbageChuteOptions(side,window),emergencyResponses(side,window),bastEvacuationOptions(side,window),helpRebelOptions(side,window),
  interiorExclusionOptions(side,window));
 if(window.kind==='battle'&&side===window.side)return accidents;
 if(window.kind==='battleDestinyResults'||window.kind==='battle'&&side!==window.side){
  const {hand,force}=PremiereGame.zones(state,side),location=state.locations?.[window.site],x=battleSession;
  const validSwap=window.kind==='battleDestinyResults'&&x?.drawCounts?.Light===1&&x.drawCounts.Dark===1&&
   Number.isFinite(x.lightDestiny)&&Number.isFinite(x.darkDestiny);
  const eligibleShip=window.kind==='battle'&&location&&(isSystem(location)||location.subType==='Sector')&&
   PremiereLocations.entries(state,side).some(({card,slot,unavailable})=>slot===window.site&&!unavailable&&
    card.type==='Starship'&&craftStats(card,slot).maneuver>3);
  if(!validSwap&&!eligibleShip)return accidents;
  const kind=validSwap?'swapBattleDestiny':'openingDestiny';
  return accidents.concat((hand??[]).flatMap((card,index)=>{
   const [rule]=activeCardRules(card,kind);
   return rule&&(forceBudget(side))>=rule.cost?[{kind,card,index,cost:rule.cost,label:card.name+' ('+rule.cost+' Force)'}]:[];
  }));
 }
 if(side===window.side)return [];
 const {force,hand}=PremiereGame.zones(state,side);
 if(window.kind==='drain'){
  const id=side==='Light'?'Light:2385':'Dark:575';
  if(!forceBudget(side))return [];
  const hunchback=PremiereGame.zones(state,window.side).force.length?PremiereLocations.entries(state,side).flatMap((entry,index)=>{
   const {card,slot,unavailable}=entry;
   const [rule]=activeCardRules(card,'hunchback');
   return rule&&!unavailable&&rule.cost<=forceBudget(side)&&adjacentSites(slot,window.site)&&!window.hunchbackUsed?.includes(card)?
    [{kind:'hunchback',card,index:-1,cost:rule.cost,args:[-1,'hunchback',index],label:card.name+' · Gegnerische Force Pile durchsuchen (1 Force)'}]:[];
  }):[];
  return hunchback.concat((hand??[]).flatMap((card,index)=>card.id===id?[{kind:'assault',card,index,cost:1}]:[]));
 }
 const effectWindow=['lostPileEffect','locationEffect'].includes(window.kind);
 const kind=effectWindow?'alter':window.kind==='react'?'sense':window.kind==='interrupt'?window.interrupt==='sense'?'alter':'sense':null;
 if(!kind)return [];
 const requiresDestiny=effectWindow||window.kind==='react'||['assault','battleEffect','combinedAttack','duel','overload','retrieve'].includes(window.interrupt);
 const ability=requiresDestiny?highestInterruptAbility(side):0;
 if(requiresDestiny&&!ability)return [];
 return (hand??[]).flatMap((card,index)=>(kind==='alter'?isAlter(card):isSense(card))
  ?[{kind,card,index,ability,cost:0}]:[]);
}

function interiorBattleTargets(window){
 if(window?.kind!=='battle'||battleSession?.site!==window.site||!battleSession.participants||
    !state.locations[window.site]?.locationTags?.includes('Interior'))return [];
 return PremiereGame.sides.flatMap(side=>activeBattleUnits(side)).filter(card=>card.type==='Character'&&
  (cardAbility(card)>2||characterTraits(card).includes('leader')));
}

function interiorExclusionOptions(side,window){
 if(forceBudget(side)<1||!interiorBattleTargets(window).length)return [];
 const {hand}=PremiereGame.zones(state,side);
 return (hand??[]).flatMap((card,index)=>activeCardRules(card,'interiorExclusion').length?
  [{kind:'interiorExclusion',card,index,args:[index,'interiorExclusion'],cost:1,label:card.name+' · Anführer und Ability über 2 ausschließen (1 Force)'}]:[]);
}

function corellianSlipResponses(side,window){
 if(side===window.side||window.rule?.mode!=='tallonRoll'||window.slip)return [];
 const ship=window.entry.card;
 const pilots=(ship.occupants??[]).filter(({card,role})=>role==='pilot'&&PremiereUnits.active(card))
  .map(({card})=>({name:card.name,ability:cardAbility(card)}));
 const permanent=permanentPilotAbility(ship);
 if(permanent!==null)pilots.push({name:'permanenter Pilot',ability:permanent});
 const {hand}=PremiereGame.zones(state,side);
 return (hand??[]).flatMap((card,index)=>activeCardRules(card,'tallonSlip').flatMap(()=>pilots.flatMap((pilot,i)=>
  Number.isFinite(pilot.ability)?[{kind:'tallonSlip',card,index,args:[index,'tallonSlip',i],ability:pilot.ability,
   label:card.name+' · '+pilot.name+' und Maneuver zur Tallon Roll addieren'}]:[])));
}

function counterResponses(side,window){
 const effect=['lostPileEffect','locationEffect','tableEffect'].includes(window.kind);
 if(!effect&&!['interrupt','react'].includes(window.kind))return null;
 const {hand}=PremiereGame.zones(state,side);
 const characters=highestInterruptCharacters(side);
 const dodonna=window.kind==='tableEffect'&&window.card?.id==='Dark:2833'?dodonnaCounter(side):null;
 const commander=dodonna?[{kind:'dodonnaCounter',card:dodonna,index:-1,args:[-1,'dodonna'],cost:1,label:dodonna.name+' · Wrong Turn aufheben (1 Force)'}]:[];
 const unit=window.kind==='tableEffect'&&window.card&&unitTableCanceller(side,window.card);
 if(unit)commander.push({kind:'unitTableCancel',card:unit.card,index:-1,args:[-1,'unitTableCancel'],targetId:window.card.id,cost:1,
  label:unit.card.name+' · '+window.card.name+' aufheben (1 Force)'});
 const mechanic=window.kind==='locationEffect'&&window.card?.id==='Dark:1480'?mechanicCanCancelLateral(side,window.target):null;
 if(mechanic)commander.push({kind:'lateralMechanicCounter',card:mechanic,index:-1,args:[-1,'lateralMechanic'],
  label:mechanic.name+' · Lateral Damage aufheben'});
 return commander.concat((hand??[]).flatMap((card,index)=>{
  const offers=[];
  if(window.kind==='tableEffect'&&namedTableCounter(card,window.card)){
   offers.push({kind:'namedCounter',card,index,cost:0,counterMode:'direct',args:[index],
    label:card.name+' · '+window.card.name+' aufheben'});
  }
  if(window.kind==='interrupt'&&namedInterruptAvailable(card)&&activeCardRules(card,'cancelNamedInterrupt').some(rule=>rule.targets.includes(window.card?.id))){
   offers.push({kind:'namedCounter',card,index,cost:0,counterMode:'direct',args:[index,'named'],
    label:card.name+' · '+window.card.name+' direkt aufheben'});
  }
  if(window.kind!=='tableEffect'&&namedCancellation(card,window.card)){
   offers.push({kind:'namedCounter',card,index,cost:0,counterMode:'direct',args:[index,'named'],
    label:card.name+' · '+window.card.name+' direkt aufheben'});
  }
  for(const rule of activeCardRules(card,'counter')){
   const direct=rule.mode==='direct';
   const damageRelief=activeCardRules(window.card,'damageRelief').length;
   const immune=rule.name==='Alter'?effect&&!alterTarget(window.card,window.site):
    window.kind==='interrupt'&&(!!scannerSupport(window.side,window.rule?.mode)||typeof jpWrappedFree==='function'&&jpWrappedFree(window.card)||
     /immune to sense\b/i.test(window.card?.gametext??'')&&(!damageRelief||window.interrupt==='damageRelief'));
   if(immune)continue;
   const valid=direct?window.kind==='interrupt'&&window.interrupt===rule.targets:
    characters.length>0&&(rule.name==='Alter'?effect:!effect&&window.interrupt!=='alter');
   if(!valid)continue;
   const target=window.card?.name??(effect?'Effect':'React');
   if(direct)offers.push({kind:rule.name.toLowerCase(),card,index,cost:rule.cost,counterMode:rule.mode,args:[index],
    label:card.name+' · '+target+' ohne Destiny aufheben'});
   else for(const [targetIndex,character] of characters.entries()){
    offers.push({kind:rule.name.toLowerCase(),card,index,cost:rule.cost,ability:cardAbility(character),counterCharacter:character,counterMode:rule.mode,
     args:targetIndex?[index,'destiny',targetIndex]:[index],label:card.name+' · '+target+' mit '+character.name+' aufheben'});
   }
  }
  return offers;
 }));
}

function hasInterruptResponse(frame){
 const sides=expandedCardRules()?PremiereGame.sides:[PremiereGame.otherSide(frame.side)];
 return sides.some(side=>interruptResponses(side,frame).length);
}

function initiateInterruptResponse(side,index,mode,...extraArgs){
 const game=state.game,window=PremiereGame.responseWindow(game);
 const option=interruptResponses(side,window).find(response=>response.index===index&&response.args?.[1]===mode&&
  (response.args?.slice(2)??[]).length===extraArgs.length&&extraArgs.every((value,index)=>value===response.args[index+2]));
 if(hothEnabled()&&['hothEffect','hothAbility','hothInterrupt'].includes(option?.kind))return hothRespond(side,option,window);
 if(option?.kind==='zutton'){
  const reduction=battleSession.beforeDestinyReduction??={Light:0,Dark:0};
  reduction[window.side]+=option.rule.amount;
  spendForce(side,option.cost);
  (window.used??=[]).push(option.card);
  window.priority=window.side;
  window.passes=0;
  log(option.label+'.');
  return true;
 }
 if(option?.kind==='extinguishBattle'){
  if(!PremiereGame.answer(game,side,{...option,kind:'extinguishAbility',mode:'cancelBattle',side,site:window.site}))return false;
  option.equipment=true;
  detachTableCard(side,option.entry.slot,option.card);
  return true;
 }
 if(option?.kind==='anhResponse'){
  if(!PremiereGame.answer(game,side,{...option,kind:'interrupt',interrupt:'anhResponse',side,site:window.site}))return false;
  PremiereGame.zones(state,side).hand.splice(index,1);
  if(option.cost)spendForce(side,option.cost);
  return true;
 }
 if(option?.kind==='grabInterrupt'){
  PremiereGame.zones(state,side).hand.splice(index,1);
  spendForce(side,option.cost);
  const effect={card:option.card,target:side,interruptTitle:locationTitle(window.card),stackTax:!!option.rule.tax,support:[],stackPending:window.card};
  (state.tableEffects??=[]).push(effect);
  window.card.grabbedBy=option.card.instanceId??option.card.id;
  if(!effect.stackTax)PremiereGame.useOnce(game,'turn','uniqueInterrupt:'+effect.interruptTitle);
  window.passes=0;window.priority=window.side;
  log(option.label+'.');
  return true;
 }
 if(option?.kind==='eatSoup'){
  const lost=PremiereGame.zones(state,window.side).lost,target=window.fallen,index=lost.indexOf(target);
  if(index<0)return false;
  spendForce(side,1);
  PremiereGame.useOnce(game,'battle','soup:'+option.card.id);
  (state.outOfPlay??=[]).push(lost.splice(index,1)[0]);
  (state.soupAbility??={})[option.card.id]=(state.soupAbility?.[option.card.id]??0)+(cardAbility(target)??0);
  window.passes=0;window.priority=window.side;
  return true;
 }
 if(option?.kind==='conquestPeek'){
  const rival=PremiereGame.otherSide(side);
  window.conquestPeekUsed=true;
  window.passes=0;
  window.priority=rival;
  state.pendingCardView={mode:'conquestPeek',side,card:option.card,shown:[...PremiereGame.zones(state,rival).hand]};
  return true;
 }
 if(option?.kind==='hunchback'){
  (window.hunchbackUsed??=[]).push(option.card);
  window.passes=0;
  window.priority=window.side;
  spendForce(side,option.cost);
  state.pendingCardView={mode:'hunchback',side,card:option.card,shown:[...PremiereGame.zones(state,window.side).force].reverse()};
  return true;
 }
 if(option?.kind==='tractorBeam'){
  if(!PremiereGame.answer(game,side,{...option,side}))return false;
  spendForce(side,option.cost);
  (window.tractorUsed??=[]).push(option.card);
  return true;
 }
 if(option?.kind==='memorialStack'){
  const {lost}=PremiereGame.zones(state,side),at=lost.indexOf(window.fallen);
  if(at<0)return false;
  option.effect.support.push(lost.splice(at,1)[0]);
  window.passes=0;
  window.priority=PremiereGame.otherSide(side);
  log(option.label+'.');
  return true;
 }
 if(['helpRebel','droidRedirect','tallonSlip','interiorExclusion'].includes(option?.kind)){
  if(!PremiereGame.answer(game,side,{...option,kind:'interrupt',interrupt:option.kind,side}))return false;
  const {hand,force,used}=PremiereGame.zones(state,side);
  hand.splice(index,1);
  if(option.cost)spendForce(side,option.cost);
  if(option.rebel)(state.reactedThisTurn??=[]).push(option.rebel);
  return true;
 }
 if(option?.kind==='nobleSacrifice'){
  if(!PremiereGame.answer(game,side,{...option,kind:'interrupt',interrupt:option.kind,side}))return false;
  PremiereGame.zones(state,side).hand.splice(index,1);
  const {entry}=option;
  if(loseTableCard(entry.side,entry.slot,entry.card,true))clearCaptivity(entry.card);
  log(option.label+'.');
  return true;
 }
 if(option?.kind==='poisonStinger'){
  if(!PremiereGame.answer(game,side,{...option,side}))return false;
  const {force,used}=PremiereGame.zones(state,side);
  spendForce(side);
  PremiereGame.useOnce(game,'turn',option.card.id);
  return true;
 }
 if(option?.kind==='chokeAfterBattle'){
  if(!PremiereGame.answer(game,side,{...option,kind:'interrupt',interrupt:option.kind,side}))return false;
  const {hand,force,used}=PremiereGame.zones(state,side);
  hand.splice(index,1);
  spendForce(side,option.cost);
  log(option.label+'.');
  return true;
 }
 if(['tacticalRecall','gearMission'].includes(option?.kind)){
  if(!PremiereGame.answer(game,side,{...option,kind:'locationEffect',side}))return false;
  const {hand,force,used}=PremiereGame.zones(state,side);
  hand.splice(index,1);
  spendForce(side,option.cost);
  log(option.label+'.');
  return true;
 }
 if(['lateralMechanicCounter','bastEvacuation'].includes(option?.kind)){
  if(!PremiereGame.answer(game,side,{...option,side}))return false;
  log(option.label+'.');
  return true;
 }
 if(option?.kind==='emergencyDeployment'){
  if(!PremiereGame.answer(game,side,{...option,kind:'interrupt',interrupt:option.kind,side}))return false;
  PremiereGame.zones(state,side).hand.splice(index,1);
  log(side+' spielt '+option.label+'.');
  return true;
 }
 if(['oldBen','kintanStrider','postBattleStarfighter','shipEvacuation'].includes(option?.kind)){
  if(!PremiereGame.answer(game,side,{...option,kind:'interrupt',interrupt:option.kind,side}))return false;
  const {hand,force,used}=PremiereGame.zones(state,side);
  hand.splice(index,1);
  if(option.cost)spendForce(side,option.cost);
  log(side+' spielt '+option.label+'.');
  return true;
 }
 if(option?.kind==='garbageChute'){
  if(!PremiereGame.answer(game,side,{...option,kind:'interrupt',interrupt:option.kind,side}))return false;
  PremiereGame.zones(state,side).hand.splice(index,1);
  log(side+' spielt '+option.label+'.');
  return true;
 }
 if(option?.kind==='battleTieLoss'){
  if(!PremiereGame.answer(game,side,{kind:'interrupt',interrupt:option.kind,side,card:option.card,target:option.target,site:option.site}))return false;
  PremiereGame.zones(state,side).hand.splice(index,1);
  PremiereGame.useOnce(game,'turn',option.card.id);
  log(side+' spielt '+option.label+'.');
  return true;
 }
 if(['battleDamageModifier','increaseForceLoss'].includes(option?.kind)){
  const {card,amount,multiplier,loser,amplifies,cost}=option;
  if(!PremiereGame.answer(game,side,{kind:'interrupt',interrupt:option.kind,side,card,amount,multiplier,loser,amplifies}))return false;
  const {hand,force,used}=PremiereGame.zones(state,side);
  hand.splice(index,1);
  if(cost)spendForce(side,cost);
  log(side+' spielt '+option.label+'.');
  return true;
 }
 if(option?.kind==='evazanOperation'){
  return !!PremiereGame.answer(game,side,{kind:'evazanOperation',side,operator:option.card,target:option.target,site:window.site});
 }
 if(option?.kind==='droidShutdown'){
  if(!PremiereGame.answer(game,side,{kind:'interrupt',interrupt:'droidShutdown',side,card:option.card,target:option.target}))return false;
  PremiereGame.zones(state,side).hand.splice(index,1);
  log(side+' spielt '+option.card.name+'.');
  return true;
 }
 if(['dodonnaCounter','unitTableCancel'].includes(option?.kind)){
  if(!PremiereGame.answer(game,side,{kind:option.kind,side,card:option.card,targetId:option.targetId}))return false;
  spendForce(side);
  log(option.label+'.');
  return true;
 }
 if(option?.kind==='barrier'){
  if(!PremiereGame.answer(game,side,{...option,kind:'interrupt',interrupt:'barrier',side}))return false;
  const {hand,force,used}=PremiereGame.zones(state,side);
  hand.splice(index,1);
  spendForce(side,option.rule.cost);
  log(side+' spielt '+option.label+'.');
  return true;
 }
 if(option?.kind==='battleMoveAway'){
  const kind=option.fromHand?'interrupt':'battleMoveAbility';
  if(!PremiereGame.answer(game,side,{...option,kind,interrupt:'battleMoveAway',side,site:window.site}))return false;
  const {hand,force,used}=PremiereGame.zones(state,side);
  if(option.fromHand)hand.splice(index,1);
  else PremiereGame.useOnce(game,'battle',option.source.instanceId??option.source.id);
  spendForce(side,option.cost);
  log(side+' nutzt '+option.label+'.');
  return true;
 }
 if(option?.kind==='shipTiming'){
  if(!PremiereGame.answer(game,side,{...option,kind:'interrupt',interrupt:'shipTiming',side,site:window.site}))return false;
  PremiereGame.zones(state,side).hand.splice(index,1);
  log(side+' spielt '+option.card.name+'.');
  return true;
 }
 if(['battleAccident','informantReact'].includes(option?.kind)){
  if(!PremiereGame.answer(game,side,{...option,kind:'interrupt',interrupt:'pileInterrupt',side,site:window.site}))return false;
  PremiereGame.zones(state,side).hand.splice(index,1);
  log(side+' spielt '+option.card.name+'.');
  return true;
 }
 if(!option||!PremiereGame.answer(game,side,{kind:'interrupt',interrupt:option.kind,site:window.site,card:option.card,
    ability:option.ability,counterMode:option.counterMode,counterCharacter:option.counterCharacter}))return false;
 const {hand,force,used}=PremiereGame.zones(state,side);
 hand.splice(index,1);
 if(option.kind==='namedCounter')recordNamedInterruptUse(option.card);
 if(option.cost)spendForce(side,option.cost);
 log(side+' antwortet mit '+option.card.name+'.');
 return true;
}

function resolveAssault(frame,opponent){
 const {lost}=PremiereGame.zones(state,frame.side);
 const currentRules=(currentGame()?.cardRulesVersion??latestCardRulesVersion)>=23;
 const targets=PremiereLocations.presentCards(state,opponent,frame.site).filter(card=>
  ['Character','Starship','Vehicle'].includes(card.type)&&!card.undercover);
 const powerAtLocation=()=>targets.map(card=>{
  if(currentRules&&(card.asleep||lateralDamage(card)))return 0;
  if(card.power==null)return null;
  const power=(['Starship','Vehicle'].includes(card.type)?craftStats(card,frame.site).power:card.power)+cardPowerModifier(card,opponent,frame.site);
  return currentRules?Math.max(0,power):power;
 });
 const startPower=currentRules?powerAtLocation():null;
 drawDestinySeries(frame.side,'assault',targets.length,0,draws=>{
  const total=PremiereBattle.total(draws);
  const power=startPower??powerAtLocation();
  lost.push(frame.card);
  if(total===null||power.some(value=>!Number.isFinite(value))){
   log(frame.card.name+' hebt den Drain auf. Ein benötigter Destiny- oder Power-Wert fehlt.');
   return;
  }
  const difference=total-power.reduce((sum,n)=>sum+n,0);
  log(frame.card.name+' hebt den Drain auf. Destiny: '+(draws.map(draw=>draw.card.name+' '+(draw.cancelled?'(aufgehoben)':draw.value)).join(', ')||'0')+'.');
  if(difference)beginForceLoss(difference<0?frame.side:opponent,Math.abs(difference),{reason:'assault',locationIndex:frame.site});
 });
}

function baseLegalActions(position,side,request){
 if(!PremiereGame.sides.includes(side)||position!==state)return [];
 const offer=(kind,args,details)=>PremiereGame.offer(currentGame(),side,kind,args,details);
 if(!position){
  const setup=setupDecks;
  if(!setup)return [];
  if(setup.revealed)return side===playerSide()?[offer(setup.revealed.collision?'retrySetup':'beginGame')]:[];
  const bot=botSide(),chooser=setup[bot.toLowerCase()+'Choice']===undefined?bot:playerSide();
  if(side!==chooser)return [];
  const choices=startingLocationChoices(side==='Dark'?setup.dark:setup.light);
  return choices.length?choices.map(x=>offer('chooseStart',[x.index],{card:x.card})):[offer('chooseStart',[null])];
 }
 if(position.gameWinner)return [];
 if(position.pendingCardView){
  if(position.pendingCardView.side!==side)return [];
  return cardInformationChoices(position.pendingCardView).map(option=>offer('finishCardInformation',option.args,option));
 }
 if(position.pendingCustody?.length)return custodyChoices(side).map(option=>offer('custody',option.args,option));
 if(position.automatedPending){
  if(position.automatedPending.side!==side)return [];
  if(position.automatedPending.kind==='defuse')return [offer('resolveMine',[true],{label:'Entschärfen (1 Force)'}),
   offer('resolveMine',[false],{label:'Explodieren lassen'})];
  return automatedTargets(position.automatedPending).map((target,index)=>offer('automatedTarget',[index],{card:target.card}));
 }
 if(position.game?.timing.pending)return PremiereGame.triggerOptions(position.game,side)
  .map(effect=>offer('timingTrigger',[effect.id],{label:effect.label}));
 if(hothEnabled()&&position.pendingForceLoss?.hoth) {
  if(position.pendingForceLoss.payer!==side)return [];
  return [...forceLossReductionOptions(side,position.pendingForceLoss,'remaining').map(option=>offer(option.kind,option.args,option)),
   ...PremiereGame.lossChoices(position,side,position.pendingForceLoss.from).map(choice=>offer('loseForce',choice.args,{card:choice.card}))];
 }
 const window=PremiereGame.responseWindow(position.game);
 if(window){
  if(side!==window.priority)return [];
  if(window.kind==='destiny')return [...destinyResponses(side,window).map(answer=>offer('destinyResponse',answer.args??[answer.kind],answer)),...(typeof cloudCityEnabled==='function'&&cloudCityEnabled()?interruptResponses(side,window).map(option=>offer('interruptResponse',option.args??[option.index],{...option,responseKind:option.kind})):[]),offer('passResponse')];
  return [...(window.kind==='battle'?battleWeaponOptions(side,'initiation').map(shot=>offer('gaderffii',shot.args,{...shot,label:shot.weapon.name+' → '+shot.target.name})):[]),
    ...reactOptions(side,window).map(x=>offer('react',x.away?[x.from,x.index,x.to]:[x.from,x.index],x)),
   ...reactDeployOptions(side,window).map(x=>offer('reactDeploy',x.args,x)),
   ...interruptResponses(side,window).map(x=>offer('interruptResponse',x.args??[x.index],{...x,responseKind:x.kind})),offer('passResponse')];
 }
 if(position.pendingReserveSearch)return position.pendingReserveSearch.side===side?
  reserveSearchChoices(position.pendingReserveSearch).map(choice=>offer('takeFromReserve',choice.args,choice)):[];
 const {hand,deck,force,board}=PremiereGame.zones(position,side);
 if(position.pendingForceLoss){
  if(position.pendingForceLoss.payer!==side)return [];
  return [...forceLossReductionOptions(side,position.pendingForceLoss,'remaining').map(option=>offer(option.kind,option.args,option)),
   ...PremiereGame.lossChoices(position,side,position.pendingForceLoss.from).map(choice=>offer('loseForce',choice.args,{card:choice.card}))];
 }
 if(battleSession){
  const x=battleSession;
  if(x.resolved||position.phase!==3)return [];
  if(x.segment==='damage')return battleDamageOptions(side).map(option=>offer(option.kind,option.args,option)).concat(
   x.damage.priority===side&&x.damage.debt[side].attrition>0?pileInterruptOptions(side).filter(option=>option.rule.mode==='droidAttrition')
    .map(option=>offer('pileInterrupt',option.args,option)):[],
   typeof dagobahEnabled==='function'&&dagobahEnabled()&&x.damage.priority===side?hothActionOptions(side).map(option=>offer('hothAction',option.args,option)):[]);
  if(x.segment==='initiation')return side==='Dark'&&x.prediction&&!x.prediction.winner?
   PremiereGame.sides.map(winner=>offer('battlePrediction',[winner])):[];
  const training=[];
  if(side===playerSide()&&(!x.segmented||position.trainingBattle))for(const target of PremiereGame.sides)for(const kind of ['power','destiny']){
   for(let value=0;value<=20;value++)training.push(offer('trainingModifier',[target,kind,value]));
  }
  if(x.weaponTurn&&x.weaponTurn!==side)return training;
  if(x.weaponTurn){
   const shots=battleWeaponOptions(side);
   return [...shots.map(shot=>offer('fireWeapon',shot.args,shot)),
   ...computerWeaponOptions(side,shots).map(option=>offer('computerFire',option.args,option)),
   ...(x.repeatingWeapon?[]:[...duelOptions(side).map(option=>offer('duel',option.args,option)),
    ...combinedAttackOptions(side,shots,request,offer),
    ...namedRetrievalOptions(side).map(option=>offer(option.kind,option.args,option)),
    ...unitReserveSearchOptions(side).map(option=>offer('unitReserveSearch',option.args,option)),
    ...unitTableCancelOptions(side).map(option=>offer('unitTableCancel',option.args,option)),
    ...limitedResourcesOptions(side).map(option=>offer('limitedResources',option.args,option)),
    ...gravelStormOptions(side).map(option=>offer('gravelStorm',option.args,option)),
    ...cardInformationOptions(side).map(option=>offer('cardInformation',option.args,option)),
    ...pileInterruptOptions(side).map(option=>offer('pileInterrupt',option.args,option)),
    ...(hothEnabled()?hothActionOptions(side).map(option=>offer('hothAction',option.args,option)):[]),
     ...anhCharacterActions(side).map(option=>offer('anhCharacter',option.args,option)),
    ...shuffleOptions(side).map(option=>offer('shufflePile',option.args,option)),
    ...tableCancellationOptions(side).map(option=>offer('cancelTableEffect',option.args,option)),
    ...locationCancellationOptions(side).map(option=>offer(option.kind,option.args,option)),
    ...namedWeaponCancellationOptions(side).map(option=>offer('cancelNamedWeapon',option.args,option)),
    ...dodonnaCounterOptions(side).map(option=>offer('dodonnaCounter',option.args,option)),
    ...lateralMechanicOptions(side).map(option=>offer('lateralMechanic',option.args,option)),
    ...lateralRepairOptions(side).map(option=>offer('lateralRepair',option.args,option)),
    ...abilityPowerOptions(side).map(option=>offer('abilityPower',option.args,option)),
    ...holocamPowerOptions(side).map(option=>offer('holocamPower',option.args,option)),
    ...obiAssistOptions(side).map(option=>offer('obiAssist',option.args,option)),
    ...battleEffectOptions(side).map(option=>offer('battleEffect',option.args,option)),
    ...weaponEffectOptions(side).filter(option=>['defuse','overload','rackIn','saurinUnbolt'].includes(option.args[0])).map(option=>offer('weaponEffect',option.args,option))]),
   offer('passWeapons'),...training];
  }
  const first=x.initiator==='Dark'?'Dark':'Light',key=side==='Light'?'lightCard':'darkCard';
  if(x[key]===null){
   if(side!==first&&x[first==='Light'?'lightCard':'darkCard']===null)return training;
   const totals=battleTotals(x.site),ability=side==='Light'?totals.lightAbility:totals.darkAbility;
   return [...((battleDestinyDrawCount(side,x.site,ability)??0)>0?[offer('destiny')]:[]),offer('skipDestiny'),...training];
  }
  if(x.segmented||x.lightCard===null||x.darkCard===null)return training;
  const actions=board[x.site].flatMap((card,index)=>x.weaponHits?.[side]?.includes(index)?[]:[offer('toggleLoss',[index],{card})]);
  if(side===playerSide()&&battleDamagePreview()&&battleForfeitPlan('Light').valid&&battleForfeitPlan('Dark').valid)actions.push(offer('resolveBattle'));
  return [...actions,...training];
 }
 const active=position.activeSide??(position.botTurn?botSide():playerSide());
 const actions=side===playerSide()&&(!position.game||position.trainingBattle)?[offer('trainingNight',[!position.nightConditions])]:[];
 for(const option of anhCharacterActions(side))actions.push(offer('anhCharacter',option.args,option));
 if(hothEnabled())for(const option of hothActionOptions(side))actions.push(offer('hothAction',option.args,option));
 const spyOptions=spyActions(side);
 for(const option of spyOptions)actions.push(offer('spyAction',option.args,option));
 if(side===playerSide()&&side!==active&&spyOptions.length)
  actions.push(offer('passSpyMovement',[],{label:'Undercover-Bewegung beenden'}));
 if(beggarPaymentOptions(side).length){
  const {site,effect}=beggarAt(side),credit=beggarCredit(side);
  actions.push(offer('beggarPayment',[],{site,card:effect.card,label:credit?'Beggar · '+credit+' Force für nächste Zahlung ausgewählt':'Beggar · gegnerische Force für nächste Zahlung auswählen'}));
 }
 for(const option of weaponEffectOptions(side))actions.push(offer('weaponEffect',option.args,option));
 for(const option of shuffleOptions(side))actions.push(offer('shufflePile',option.args,option));
 for(const option of limitedResourcesOptions(side))actions.push(offer('limitedResources',option.args,option));
 for(const option of gravelStormOptions(side))actions.push(offer('gravelStorm',option.args,option));
 for(const option of cardInformationOptions(side))actions.push(offer('cardInformation',option.args,option));
 for(const option of unitReserveSearchOptions(side))actions.push(offer('unitReserveSearch',option.args,option));
 for(const option of unitTableCancelOptions(side))actions.push(offer('unitTableCancel',option.args,option));
 for(const option of pileInterruptOptions(side))actions.push(offer('pileInterrupt',option.args,option));
 for(const option of groupRelocationOptions(side))actions.push(offer('groupRelocation',option.args,option));
 for(const option of tableCancellationOptions(side))actions.push(offer('cancelTableEffect',option.args,option));
 for(const option of namedWeaponCancellationOptions(side))actions.push(offer('cancelNamedWeapon',option.args,option));
 for(const option of dodonnaCounterOptions(side))actions.push(offer('dodonnaCounter',option.args,option));
 for(const option of lateralMechanicOptions(side))actions.push(offer('lateralMechanic',option.args,option));
 for(const option of lateralRepairOptions(side))actions.push(offer('lateralRepair',option.args,option));
 for(const option of mouseUtinniOptions(side))actions.push(offer('mouseUtinni',option.args,option));
 for(const option of apprehendMigOptions(side))actions.push(offer('apprehendMig',option.args,option));
 for(const option of mobileSystemOptions(side))actions.push(offer('moveMobileSystem',option.args,option));
 for(const option of tractorDisembarkOptions(side))actions.push(offer('tractorDisembark',option.args,option));
 if(position.game)for(const option of locationCancellationOptions(side))actions.push(offer(option.kind,option.args,option));
 if(side!==active){
  const seekers=seekerMoves(side);
  for(const option of seekers)actions.push(offer('moveSeeker',option.args,option));
  if(side===playerSide()&&seekers.length)actions.push(offer('skipSeekerMove',[],{label:'Seeker-Bewegung beenden'}));
  if(side===playerSide())for(const option of duelOptions(side))actions.push(offer('duel',option.args,option));
  if((currentGame()?.cardRulesVersion??latestCardRulesVersion)>=10){
   for(const option of namedRetrievalOptions(side))actions.push(offer(option.kind,option.args,option));
  }
  return actions;
 }
 const botStep=position.botTurn?.steps[position.botTurn.index];
 if(side===botSide()&&position.botTurn?.decision)return [offer('botDecision',[position.botTurn.decision])];
 if(side===botSide()&&botStep&&!(position.phase===4&&(seekerMoves(playerSide()).length||undercoverMoves(playerSide()).length)))
  actions.push(offer('botStep',[botStep.kind]));
 for(const option of deviceActions(side))actions.push(offer('deviceAction',option.args,option));
 for(const option of duelOptions(side))actions.push(offer('duel',option.args,option));
 if(side===playerSide()&&(position.phase!==0||position.activated))actions.push(offer('advance'));
 for(const option of namedRetrievalOptions(side))actions.push(offer(option.kind,option.args,option));
 for(const option of transportOptions(side))actions.push(offer('transport',option.args,option));
 for(const option of prisonerTransfers(side))actions.push(offer('prisonerTransfer',option.args,option));
 for(const group of dockingGroups(side)){
  const choosing=request?.kind==='dockGroup'&&group.args.every((arg,i)=>arg===request.args?.[i]);
  const plan=choosing?dockingPlan(group,request.args.slice(group.args.length)):null;
  if(!choosing||plan)actions.push(offer('dockGroup',choosing?request.args:group.args,{...group,plan}));
 }
 if(position.phase===0&&!position.activated){
  const generation=forceFromLocations(side).count,hasInsert=(deck??[]).some(PremiereGame.isReserveInsert);
  const max=activationLocked(side)?0:hasInsert?generation:Math.min(deck?.length??0,generation);
  const allowance=activationDrawAllowance(side);
  for(let n=0;n<=max;n++){
   actions.push(offer('activate',[n]));
   for(let mask=1;mask<(1<<Math.min(n,allowance));mask++)actions.push(offer('activate',[n,mask]));
  }
 }else if(position.phase===1){
  for(const option of wagerOptions(side))actions.push(offer('wager',option.args,option));
  for(const option of controlTheftOptions(side))actions.push(offer('controlTheft',option.args,option));
  for(const option of forceDrainOptions(side))actions.push(offer('drain',option.bonus?[option.siteIndex,option.bonus]:[option.siteIndex],option));
  for(const option of seekerMoves(side))actions.push(offer('moveSeeker',option.args,option));
  for(const option of recycleHandOptions(side))actions.push(offer('recycleHand',option.args,option));
 }else if(position.phase===2){
  for(const option of memorialExchangeOptions(side))actions.push(offer('memorialExchange',option.args,option));
  for(const option of navSabotageOptions(side))actions.push(offer('navSabotage',option.args,option));
  for(const option of reserveInsertOptions(side))actions.push(offer('deployReserveInsert',option.args,option));
  for(const option of tableEffectOptions(side))actions.push(offer('deployTableEffect',option.args,option));
  for(const option of automatedDeployOptions(side))actions.push(offer('deployAutomated',[option.index,option.slot],option));
  for(const [i,card] of (hand??[]).entries()){
   if(card.side===side&&isLostPileEffect(card))for(const target of PremiereGame.sides){
    actions.push(offer('deployLostPileEffect',[i,target],{card,target,cost:0}));
   }
   for(const option of locationEffectOptions(side,i))actions.push(offer('deployLocationEffect',option.args,option));
   for(const slot of locationDeployPositions(side,i))actions.push(offer('deployLocation',[i,slot],{card,cost:0}));
   const conversion=conversionTarget(side,i);
   if(conversion>=0)actions.push(offer('convertLocation',[i,conversion],{card,cost:0,site:conversion}));
   for(const slot of revolutionOptions(side,i))actions.push(offer('revolution',[i,slot],{card,cost:3+sentryModifier(side,slot,'deploy')}));
   for(const option of weaponDeployOptions(side,i))actions.push(offer('equip',[i,option.siteIndex,option.hostIndex],
    {...option,card,contested:confirmedPresence(PremiereGame.otherSide(side),option.siteIndex)===true}));
   for(const option of deviceHosts(side,i)){
    const args=[i,option.slot,option.index];
    if(option.hostSide!==side)args.push(option.hostSide);
    actions.push(offer('deployDevice',args,{...option,card}));
   }
   for(const option of boltDeployOptions(side,i))actions.push(offer('deployBolt',option.args,option));
   for(const [slot,location] of position.locations.entries()){
    const cost=boardDeployCost(card,location,side);
    if(cost!==null)actions.push(offer('deploy',[i,slot],{card,location,cost,
     ...(jawaCosts.has(card.id)?{opponentCost:jawaDeployPayment(card,location,side).opposing}:{})}));
    if(isExteriorPlanetSite(location)&&mineLayers(side,slot))actions.push(offer('buryMineCard',[i,slot],{card,cost:0,site:slot}));
    for(const pilot of deployPilotOptions(side,i,slot))actions.push(offer('deployWithPilot',[i,slot,pilot.index],pilot));
   }
  }
 }else if(position.phase===3){
  for(const i of position.locations.keys())if(canInitiateBattleFor(side,i))actions.push(offer('battle',[i],{cost:battleInitiationCost(i)}));
 }else if(position.phase===5&&force?.length)actions.push(offer('draw'));
 for(const option of movementOptionsFor(side))actions.push(offer('move',[option.from,option.index,option.to,option.kind],{...option,movementKind:option.kind}));
 for(const group of transitGroups(side)){
  const {from,to,cost}=group[0];
  const choosing=request?.kind==='transitGroup'&&request.args?.[0]===from&&request.args?.[1]===to;
  const selection=choosing?request.args.slice(2):[];
  const plan=selection.length?group.filter(move=>selection.includes(move.index)):group;
  if(selection.length&&plan.length!==selection.length)continue;
  actions.push(offer('transitGroup',choosing?request.args:[from,to],{from,to,cost,choices:group,plan}));
 }
 return actions;
}

function cardActionSlot(option){
 const fields=[option.to,option.siteIndex,option.site,option.slot,option.locationIndex,option.destination,option.destination?.slot];
 const slot=fields.find(value=>Number.isInteger(value)&&value>=0);
 if(slot!==undefined)return slot;
 if(['battle','drain'].includes(option.kind))return option.args[0];
 if(['deploy','deployWithPilot','convertLocation','revolution','deployLocationEffect','deployDevice','deployBolt'].includes(option.kind))return option.args[1];
 if(option.kind==='deployLocation')return (state.locationOrder??initialLocationOrder(state.locations))[option.args[1]];
 const target=[option.target?.card,option.target,option.host,option.mount?.host,option.item,option.carrier,option.card,option.weapon,option.fromCard];
 for(const card of target){
  if(!card||typeof card!=='object')continue;
  const entry=PremiereLocations.findEntry(state,card);
  if(entry)return entry.slot;
  const index=state.locations.indexOf(card);
  if(index>=0)return index;
 }
 return PremiereGame.responseWindow(state.game)?.site??battleSession?.site;
}

function cardActionMatches(option,card){
 if(['passResponse','passWeapons','passDamage','trainingModifier','trainingNight','advance','draw','activate'].includes(option.kind))return false;
 if([option.card,option.ship,option.weapon,option.host,option.carrier,option.source,option.target,option.pilot,option.item,
   option.mount?.host,option.target?.card,option.entry?.card,option.source?.card,option.comlinkHost,option.effect?.card,
   option.counterCharacter,option.vader,option.obi].includes(card))return true;
 if(option.ships?.includes(card)||option.choices?.some(choice=>choice.card===card||choice.weapon===card||choice.host===card))return true;
 const slot=state.locations.indexOf(card);
 return slot>=0&&cardActionSlot(option)===slot;
}

function cardActionForceCost(option){
 if(Number.isFinite(option.cost))return option.cost;
 if(Number.isFinite(option.rule?.cost))return option.rule.cost;
 const printed=option.label?.match(/\((\d+) Force\)/);
 return printed?Number(printed[1]):null;
}

function unaffordableCardOffers(side,related,available){
 if(quotingForce||state.gameWinner||state.game?.executing)return [];
 let quotes;
 // Relax only payment checks to find otherwise legal targets. These offers are for display only.
 quotingForce=true;
 try{
  quotes=legalActions(state,side).filter(related);
 }finally{
  quotingForce=false;
 }
 const own=ownForceBudget(side),rival=ownForceBudget(PremiereGame.otherSide(side)),budget=forceBudget(side);
 return quotes.flatMap(option=>{
  const cost=cardActionForceCost(option),opposing=option.opponentCost??option.opposingCost??0;
  const usable=option.kind==='duel'?own:jawaCosts.has(option.card?.id)?jawaForceBudget(side,opposing):budget;
  const reasons=[];
  if(cost>usable)reasons.push('Benötigt '+cost+' Force. Verfügbar: '+usable+' Force.');
  if(opposing>rival)reasons.push('Die Gegenseite braucht '+opposing+' Force. Verfügbar: '+rival+' Force.');
  if(!reasons.length||available.some(legal=>legal.kind===option.kind&&legal.args.length===option.args.length&&
   legal.args.every((arg,index)=>arg===option.args[index])))return [];
  return [{option,reason:reasons.join(' ')}];
 });
}

function executeAction(action){
 if(hothEnabled()&&action.kind==='hothAction')return playHothAction(action.side,...action.args);
 const {kind,side,args,plan,ships,card}=action;
 switch(kind){
  case 'chooseStart': return resolveStartingChoice(side,...args);
  case 'retrySetup': prepareStartingRound();return true;
  case 'beginGame': return finishSetup();
  case 'botStep': return advanceBotStep(...args);
  case 'botDecision': delete state.botTurn.decision;return true;
  case 'advance': return advance();
  case 'activate': activate(side,...args);state.activated=true;return true;
  case 'draw': return drawFor(side);
  case 'loseForce': return loseForceForDrain(side,...args);
  case 'drain': return initiateForceDrain(side,...args);
  case 'deployLocation': return deployLocationFromHand(side,...args);
  case 'convertLocation': return convertLocation(side,...args);
  case 'revolution': return deployRevolution(side,...args);
  case 'deployLostPileEffect': return deployLostPileEffect(side,...args);
  case 'alterLostPileEffect': return initiateAlterLostPileEffect(side,...args);
  case 'deployLocationEffect': return deployLocationEffect(side,...args);
  case 'alterLocationEffect': return initiateAlterLocationEffect(side,...args);
  case 'deployTableEffect': return deployTableEffect(side,...args);
  case 'deployReserveInsert': return deployReserveInsert(side,...args);
  case 'recycleHand': return recycleHandCard(side,...args);
  case 'cancelTableEffect': return initiateTableCancellation(side,...args);
  case 'cancelNamedWeapon': return cancelNamedWeapon(side,...args);
  case 'dodonnaCounter': return playDodonnaCounter(side,...args);
  case 'lateralMechanic': return cancelLateralDamageWithMechanic(side,...args);
  case 'lateralRepair': return drawLateralRepair(side,...args);
  case 'abilityPower': return useAbilityPower(side,...args);
  case 'retrieve':
  case 'searchReserve': return playRetrieval(side,kind,...args);
  case 'unitReserveSearch': return beginUnitReserveSearch(side,...args);
  case 'unitTableCancel': return performUnitTableCancel(side,...args);
  case 'limitedResources': return playLimitedResources(side,...args);
  case 'gravelStorm': return playGravelStorm(side,...args);
  case 'cardInformation': return beginCardInformation(side,...args);
  case 'pileInterrupt': return playPileInterrupt(side,...args);
  case 'groupRelocation': return beginGroupRelocation(side,...args);
  case 'finishCardInformation': return finishCardInformation(side,...args);
  case 'shufflePile': return playShuffle(side,...args);
  case 'takeFromReserve': return finishReserveSearch(...args);
  case 'deployWithPilot': return deployWithPilot(side,...args);
  case 'transport': return performTransport(side,...args);
  case 'custody': return resolveCustody(action);
  case 'prisonerTransfer': return transferPrisoner(action);
  case 'transitGroup': return performTransitGroup(side,plan);
  case 'dockGroup': return performDockingGroup(side,ships,plan);
  case 'equip': return deployWeaponFor(side,...args);
  case 'deployAutomated': return deployAutomated(side,...args);
  case 'buryMineCard': return buryWeaponCard(side,...args);
  case 'moveSeeker': return moveSeeker(side,...args);
  case 'skipSeekerMove': state.seekerPassedTurn=state.game.timing.turn;return true;
   case 'spyAction': return performSpyAction(side,...args);
   case 'passSpyMovement': state.spyMovementPassedTurn=state.game.timing.turn;return true;
  case 'automatedTarget': return resolveAutomatedTarget(side,...args);
  case 'resolveMine': return handleTrippedMine(side,...args);
  case 'weaponEffect': return playWeaponEffect(side,...args);
  case 'deployDevice': return deployDevice(side,...args);
  case 'deployBolt': return deployBolt(side,...args);
  case 'deviceAction': return performDeviceAction(side,...args);
  case 'controlTheft': return performControlTheft(side,...args);
   case 'anhCharacter': return performAnhCharacter(side,...args);
  case 'wager': return playWager(side,...args);
  case 'moveMobileSystem': return moveMobileSystem(side,...args);
  case 'tractorDisembark': {
   const {ship,bay}=state.capturedShips[args[0]],{board}=PremiereGame.zones(state,side);
   board[bay].push(ship.occupants.splice(args[1],1)[0].card);
   return true;
  }
  case 'holocamPower': return addHolocamPower(side,...args);
  case 'obiAssist': return playObiAssist(side,...args);
  case 'memorialExchange': return memorialExchange(side,...args);
  case 'apprehendMig': {
   const {entry}=apprehendMigOptions(side).find(option=>option.args[0]===args[0]);
   return loseTableCard(entry.side,entry.slot,entry.card);
  }
  case 'navSabotage': return deployNavSabotage(side,...args);
  case 'beggarPayment': {
   const {effect}=beggarAt(side);
   state.pendingCardView={mode:'beggarAmount',side,card:effect.card,shown:[]};
   return true;
  }
  case 'mouseUtinni': return performMouseUtinni(side,...args);
  case 'deploy': {
   const result=deployBoardCardFor(side,...args);
   if(result)log(side+' setzt '+result.card.name+' bei '+result.loc.name+' ein ('+result.cost+' Force → Used Pile).');
   return result;
  }
  case 'move': return moveCharacterFor(side,...args);
  case 'battle': return initiateBattleFor(side,...args);
  case 'battlePrediction': return chooseBattlePrediction(...args);
  case 'duel': return playDuel(side,...args);
  case 'fireWeapon': return fireBattleWeapon(side,...args);
  case 'computerFire': return fireWithTargetingComputer(side,...args);
  case 'combinedAttack': return playCombinedAttack(side,args,card,plan);
  case 'gaderffii': return useGaderffii(side,...args);
  case 'passWeapons': return passBattleWeapons(side);
  case 'reduceForceLoss': return playForceLossReduction(side,...args);
  case 'battleEffect': return playBattleEffect(side,...args);
  case 'destinyResponse': return answerDestiny(side,...args);
  case 'battleForfeit':
  case 'battleHandForfeit':
  case 'talzForfeit':
  case 'damageRelief':
  case 'battleForceLoss':
  case 'passDamage': return battleDamageAction(side,kind,args);
  case 'destiny': battleDestiny(side);return true;
  case 'skipDestiny': skipDestiny(side);return true;
  case 'toggleLoss': toggleLoss(side,...args);return true;
  case 'resolveBattle': return resolveBattleLosses();
  case 'react': return initiateReact(side,...args);
  case 'reactDeploy': return initiateReactDeploy(side,...args);
  case 'passResponse': return resolveResponsePass(side);
  case 'interruptResponse': return initiateInterruptResponse(side,...args);
  case 'timingTrigger': return PremiereGame.resolveTrigger(state.game,side,...args);
  case 'trainingModifier': setBattleModifier(...args);return true;
  case 'trainingNight': {
   state.nightConditions=args[0];
   log('Nachtbedingungen (manueller Lernschalter): '+(state.nightConditions?'aktiv':'inaktiv'));
   return true;
  }
 }
 return false;
}

const explainedBotActions=new Set(['battle','drain','deployLocation','convertLocation','deploy','deployWithPilot','move','transport','moveSeeker','draw',
 'fireWeapon','computerFire','combinedAttack','gaderffii','react','reactDeploy','interruptResponse','destinyResponse','battleEffect','equip',
 'deployTableEffect','deployLocationEffect','battleForfeit','talzForfeit','battleHandForfeit','passResponse']);

function performAction(action,followUp=true){
 const game=currentGame();
 const hothTraffic=hothEnabled()&&state?hothMineTraffic():null;
 const startingPhase=state?.phase,startingTimingPhase=game?.timing.phase;
 const traffic=state?.buriedMines?.length?new Map(mineTraffic().map(entry=>[entry.card,entry.slot])):null;
 let reason;
 const result=PremiereGame.execute(game,action,(side,request)=>legalActions(state,side,request),valid=>{
  if(styledBot()&&valid.side===botSide()&&explainedBotActions.has(valid.kind)){
   const {view,actions}=plannedBotPosition([valid]);
   reason=PremiereBot.explain(view,actions[0]);
  }
  const terms=state?.game?.cardRulesVersion>=29?interruptStackTerms(valid.side,valid):{cost:0};
  if(terms.cost)spendForce(valid.side,terms.cost);
  if(terms.unique)PremiereGame.useOnce(game,'turn',terms.key);
  const fromHand=!!(state&&valid.card&&PremiereGame.zones(state,valid.side).hand?.includes(valid.card));
  const usedDevice=hothEnabled()?hothActionDevice(valid):null;
  if(fromHand&&valid.card.type==='Interrupt')delete valid.card.grabbedBy;
  const result=executeAction(valid);
  if(result&&usedDevice)PremiereUnits.recordDeviceUse(state,usedDevice.host,usedDevice.device);
  if(result&&fromHand&&['Weapon','Device'].includes(valid.card.type)&&!PremiereGame.zones(state,valid.side).hand.includes(valid.card)){
   const entry=PremiereLocations.findEntry(state,valid.card);
   const slot=entry?.slot??valid.site??valid.siteIndex??valid.slot;
   if(Number.isInteger(slot)&&PremiereLocations.entries(state,valid.side).some(other=>!other.unavailable&&other.slot===slot&&activeCardRules(other.card,'advosze').length))activateReserve(valid.side,1);
  }
  if(result&&terms.records?.some(effect=>effect.stackTax)){
   const effect=terms.records.find(effect=>effect.stackTax);
   effect.stackPending=valid.card;
   valid.card.grabbedBy=effect.card.instanceId??effect.card.id;
  }
  return result;
 });
 if(!result)return false;
 if(hothEnabled()&&state){hothCompleteMovement(hothTraffic);hothMineArrivals(hothTraffic);hothNextMine();}
 logBotDecision(reason);
 if(state?.game)settleInterruptStacks();
 if(state?.game?.cardRulesVersion>=29){syncTractorHolders();resolveCreatureClashes();}
 if(state?.game?.cardRulesVersion>=29)for(const [site,row] of Object.entries(state.locationEffects??{}))for(const effect of row.slice())if(effect.card.id==='Dark:1480'&&fireExtinguisherProtects(effect.target))cancelLocationEffect(Number(site),effect);
 if(state?.game?.cardRulesVersion>=29&&!state.pendingCardView){
  const all=PremiereGame.sides.flatMap(side=>PremiereLocations.entries(state,side));
  for(const entry of all){
   if(entry.unavailable||!activeCardRules(entry.card,'advosze').length)continue;
   const copies=all.filter(other=>!other.unavailable&&other.slot===entry.slot&&activeCardRules(other.card,'advosze').length);
   if(copies.length>1){state.pendingCardView={mode:'advoszeConflict',side:entry.side,shown:copies.map(other=>other.card),publicView:true};break;}
  }
 }
 if(startingPhase===3&&state?.phase===3&&state.game&&startingTimingPhase===state.game.timing.phase&&
    topLevelActions.has(action.kind)&&!(action.kind==='pileInterrupt'&&action.args[1]==='localTrouble')){
  state.localTroubleBlockedPhase=startingTimingPhase;
 }
 if(state?.game)wakeSleepingCharacters();
 if(state?.game?.cardRulesVersion>=29&&state.phase===1&&!state.pendingForceLoss){
  const defels=PremiereLocations.entries(state,state.activeSide).filter(entry=>!entry.unavailable&&entry.card.id==='Dark:687'&&
   activeCardRules(entry.card,'anhCharacter').length&&PremiereLocations.effectsAt(state,entry.slot).some(effect=>effect.card.id==='Light:2110'));
  for(const {card} of defels){
   const key='defelDrain:'+(card.instanceId??card.id);
   if(!PremiereGame.wasUsed(state.game,'phase',key)){
    PremiereGame.useOnce(state.game,'phase',key);
    beginForceLoss(PremiereGame.otherSide(state.activeSide),1,{reason:'defel'});
    break;
   }
  }
 }
 if(state?.game?.cardRulesVersion>=28)for(const side of PremiereGame.sides)for(const {card} of PremiereLocations.entries(state,side)){
  if(card.undercover&&isDeployableCharacter(card)&&!isSpyCharacter(card))breakSpyCover(card);
 }
 if(game&&state)runContinuousInterruptCounters(game);
 if(state?.game)for(const side of PremiereGame.sides)revealReserveInserts(side);
 if(state?.game)openQueuedRuleResponse();
 if(state?.game)refreshSaberTraining();
 if(state?.game&&hothEnabled())hothContinuous();
 if(state?.game&&!state.pendingCustody?.length&&!state.pendingCardView){resolveLocationControlRules();revealTrippedMines(traffic);findAutomatedWeapons();progressLocationMissions();}
 if(state?.game)openQueuedRuleResponse();
 if(state?.game)restoreIonDamage();
 if(battleSession?.segmented)stopBattleWithoutPresence();
 if(game&&topLevelActions.has(action.kind))game.rootAction=action.side;
 if(state?.game&&!battleSession)checkLifeForceVictory();
 if(game?.rootAction&&!state.gameWinner&&!state.pendingCustody?.length&&!state.pendingForceLoss&&!state.pendingReserveSearch&&!state.automatedPending&&!state.pendingCardView&&!battleSession&&
    !PremiereGame.responseWindow(game)&&!game.timing.pending){
  const priority=PremiereGame.otherSide(game.rootAction);
  delete game.rootAction;
  PremiereGame.checkpoint(game,'phase:priority',state.activeSide,()=>{},priority);
 }
 if(['deployLostPileEffect','deployLocationEffect','deployTableEffect'].includes(action.kind)&&action.side===botSide()&&state.botTurn&&
    (PremiereGame.responseWindow(game)||game?.timing.pending))state.botTurn.decision='deploy';
 if(followUp&&action.kind==='retrySetup')chooseBotStartingLocation();
 if(followUp&&!state?.pendingCustody?.length&&state?.pendingForceLoss?.payer===botSide())botPayDrainLoss();
 publishGame();
 return result;
}

function requestAction(kind,side,args=[],followUp=true){
 return performAction(PremiereGame.offer(currentGame(),side,kind,args),followUp);
}

function chooseStart(index){return requestAction('chooseStart',playerSide(),[index])}
function retryStartingLocations(){return requestAction('retrySetup',playerSide())}
function beginStartingGame(){return requestAction('beginGame',playerSide())}

function anhCharacterActions(side){
 if(!state?.game||(state.game.cardRulesVersion??0)<29)return [];
 const all=PremiereGame.sides.flatMap(actor=>PremiereLocations.entries(state,actor));
 return creatureActions(side).concat(epicActions(side),prisonerMissionActions(side),besiegedActions(side),holoAndBluffActions(side),gateDeployActions(side),formationActions(side),vehicleSiteActions(side),advancedDeviceActions(side),squadMovementActions(side),shuttleVehicleActions(side),all.flatMap((entry,index)=>{
  const {card,slot,unavailable}=entry;
  if(unavailable)return [];
  const args=mode=>[mode,index],offer=(mode,label,cost=0,extra={})=>({args:args(mode),card,site:slot,cost,label:card.name+' · '+label,...extra});
  if(card.id==='Light:1674'&&PremiereCardRules.effects(card,'binaryForfeit').length&&forceBudget(side)>=1)
   return [offer('binary',card.switchedOff?'einschalten (1 Force)':'ausschalten (1 Force)',1)];
  if(entry.side!==side||!activeCardRules(card,'anhCharacter').length)return [];
  const key=card.id+':'+(card.instanceId??index);
  if(card.id==='Dark:1126'&&state.activeSide===side&&state.phase===2&&!PremiereGame.wasUsed(state.game,'phase',key)){
   const own=PremiereGame.zones(state,side);
   return ['hand','force'].flatMap(zone=>own[zone].map((_,i)=>({...offer('salt','verdeckte Karte unterlegen'),args:['salt',index,zone,i],key})));
  }
  if(card.id==='Dark:687'){
   if(battleSession?.segment==='weapons'&&battleSession.weaponTurn===side&&battleSession.site===slot&&
    PremiereLocations.conditions(state,slot,side).night&&forceBudget(side)>=1&&!excludedAtBattle(card,slot))
    return [offer('hide','aus dem Battle ausblenden (1 Force)',1)];
  }
  if(card.id==='Dark:1073'&&state.phase===1&&state.activeSide!==side&&!PremiereGame.wasUsed(state.game,'phase',key))
   return all.flatMap((target,targetIndex)=>target.side!==side&&target.slot===slot&&!target.unavailable&&
    target.card.type==='Character'&&PremiereUnits.hasSkill(target.card,'smuggler')?
    [{...offer('threat',target.card.name+' bedrohen'),args:['threat',index,targetIndex],target:target.card,key}]:[]);
  return [];
 }));
}

function performAnhCharacter(side,...args){
 const option=anhCharacterActions(side).find(action=>action.args.length===args.length&&action.args.every((arg,i)=>arg===args[i]));
 if(!option)return false;
 const {card,cost,key,site}=option;
 if(cost)spendForce(side,cost);
 if(key)PremiereGame.useOnce(state.game,'phase',key);
 switch(args[0]){
  case 'creatureEat':offerCreatureTargetSide(option.entry,()=>{});return true;
  case 'creatureHunt':startCreatureFight(option.entry,side,option.fighters,null,()=>{});return true;
  case 'dantooine':{
   PremiereGame.zones(state,side).hand.splice(args[1],1);PremiereGame.useOnce(state.game,'game','dantooine');
   const frame={kind:'locationEffect',side,card,site,target:state.locations[deathStarSlot()]};if(hasInterruptResponse(frame))PremiereGame.openResponse(state.game,frame);else placeLocationEffect(frame);break;
  }
  case 'deployEpic':{PremiereGame.zones(state,side).hand.splice(args[1],1);((state.locationEffects??={})[site]??=[]).push({card});break;}
  case 'chargeSuperlaser':PremiereGame.moveTop(state.botForce,option.effect.support);break;
  case 'attackRun':state.attackRun={card,site,system:option.system,light:[],dark:[],selected:[],usedWeapons:[],bonus:0};state.pendingCardView={mode:'runSelectLight',side:'Light',card,shown:[]};break;
  case 'primaryIgnition':{
   PremiereGame.zones(state,side).hand.splice(args[1],1);state.pendingCardView={mode:'ignitionZ',side:'Light',card,site,weapon:option.weapon,x:option.cost,shown:[card],publicView:true};break;
  }
  case 'besieged':state.pendingCardView={mode:'besiegedChoose',side,card,record:option.record,targets:option.targets,selected:[],shown:[],publicView:true};return true;
  case 'spiceMines':{
   PremiereGame.zones(state,side).hand.splice(args[1],1);const frame={kind:'locationEffect',side,card,site,target:option.target,escort:option.escort};
   if(hasInterruptResponse(frame))PremiereGame.openResponse(state.game,frame);else placeLocationEffect(frame);break;
  }
  case 'holoReturn':{const entry=PremiereLocations.findEntry(state,card);detachTableCard(side,entry.slot,card);PremiereGame.zones(state,side).hand.push(card);break;}
  case 'holoCancel':return announcePileInterrupt(side,{...option,args:[PremiereGame.zones(state,side).hand.indexOf(card)],rule:{mode:'holoCancel',pile:'Lost',cost:0}});
  case 'placeBluff':{
   const own=PremiereGame.zones(state,side);own.hand.splice(args[2],1);(state.locations[site].bluffs??=[]).push(card);PremiereGame.useOnce(state.game,'turn','bluff');break;
  }
  case 'challengeBluff':{
   const revealed=state.locations[site].bluffs.splice(args[2],1)[0];
   state.pendingCardView={mode:'bluffReveal',side:'Dark',card:revealed,site,shown:[revealed],publicView:true};break;
  }
  case 'laserGate':{
   PremiereGame.zones(state,side).hand.splice(args[1],1);((state.locationEffects??={})[site]??=[]).push({card,gateTo:option.to});break;
  }
  case 'hypo':{
   if(args[3]==='drain')card.hypoDrainTurn=state.game.timing.turn;
   else state.pendingCardView={mode:'hypoQuestion',side,card,shown:[]};break;
  }
  case 'vehicleSite':{
   const own=PremiereGame.zones(state,side);own.hand.splice(own.hand.indexOf(card),1);
   option.host.instanceId??='vehicle-'+state.game.revision+'-'+args[2];card.hostInstanceId=option.host.instanceId;
   ensureFreeLocationSlot();const slot=state.locations.indexOf(null);state.locations[slot]=card;state.locationOrder=[...boardLocationOrder().filter(index=>index!==slot),slot];ensureFreeLocationSlot();break;
  }
  case 'mobileCrew':{
   const entry=PremiereLocations.findEntry(state,card);if(!entry||!detachTableCard(side,entry.slot,card))return false;
   if(option.role)PremiereUnits.add(option.host,card,option.role,side);else PremiereGame.zones(state,side).board[option.to].push(card);
   (state.movedThisTurn??=[]).push(card);break;
  }
  case 'formSquadron':{
   const own=PremiereGame.zones(state,side);own.hand.splice(own.hand.indexOf(card),1);own.board[site].push(card);card.controller=side;
   state.pendingCardView={mode:'squadronTransfer',side,card,site,originals:option.members,shown:[]};break;
  }
  case 'suction':
   drawDestinySeries(side,'suction',1,0,draws=>{if(draws[0]?.value>cardAbility(option.target))state.pendingCardView={mode:'suctionDestination',side,target:option.target,host:option.host,card,shown:[]};});break;
  case 'remote':option.target.remoteBonus={stat:args[3],turn:state.game.timing.turn};break;
  case 'cancelSeeker':{const entry=PremiereLocations.findEntry(state,option.target);if(entry)loseTableCard(entry.side,entry.slot,entry.card);break;}
  case 'squad':{
   const row=PremiereGame.zones(state,side).board[site];
   for(const unit of option.members){row.splice(row.indexOf(unit),1);PremiereGame.zones(state,side).board[option.to].push(unit);(state.movedThisTurn??=[]).push(unit);}
   break;
  }
case 'shuttle':{
   const entry=PremiereLocations.findEntry(state,option.target);
   if(!entry||!detachTableCard(side,entry.slot,entry.card))return false;
   if(option.host)PremiereUnits.add(option.host,entry.card,option.role,side);
   else PremiereGame.zones(state,side).board[args[3]].push(entry.card);
   (state.movedThisTurn??=[]).push(entry.card);
   const uses=card.shuttleUsesTurn===state.game.timing.turn?card.shuttleUses??0:0;
   card.shuttleUsesTurn=state.game.timing.turn;card.shuttleUses=uses+1;
   if(card.shuttleUses>=(activeCardRules(card,'shuttleVehicle')[0]?.amount??1))(state.movedThisTurn??=[]).push(card);
   break;
  }
  case 'binary':card.switchedOff=!card.switchedOff;break;
  case 'salt':(card.salt??=[]).push(PremiereGame.zones(state,side)[args[2]].splice(args[3],1)[0]);break;
  case 'hide':(battleSession.excludedUnits??=new Set()).add(card);finishWeaponAction(side,false);break;
  case 'threat':state.pendingCardView={mode:'greedoThreat',side:PremiereGame.otherSide(side),owner:side,card,actor:card,target:option.target,shown:[]};break;
 }
 log(option.label+'.');
 return true;
}

function anhLostResponses(side,window){
 if(window.kind!=='characterLost'||window.side===side||!window.duringBattle||isDroid(window.fallen)||forceBudget(side)<1)return [];
 return PremiereLocations.entries(state,side).flatMap(({card,slot,unavailable},index)=>
  !unavailable&&slot===window.site&&activeCardRules(card,'anhCharacter').length&&card.id==='Dark:605'&&
  !PremiereGame.wasUsed(state.game,'battle','soup:'+card.id)&&PremiereGame.zones(state,window.side).lost.includes(window.fallen)?
   [{kind:'eatSoup',index:-1,args:[-1,'eatSoup',index],card,cost:1,label:card.name+' · Soup von '+window.fallen.name+' aufnehmen (1 Force)'}]:[]);
}

function shuttleVehicleActions(side){
 if(state.activeSide!==side||state.phase!==4)return [];
 const all=PremiereLocations.entries(state,side);
 return all.flatMap((entry,index)=>{
  const {card:shuttle,slot,unavailable}=entry;
  const [rule]=activeCardRules(shuttle,'shuttleVehicle');
  if(!rule||unavailable||!craftStats(shuttle,slot).powered||regularMovementUsed(shuttle))return [];
  const origin=state.locations[slot];
  return all.flatMap((unit,unitIndex)=>{
   if(unit.unavailable||unit.card.type!=='Character'||regularMovementUsed(unit.card)||movementPrevented(unit.card))return [];
   const down=unit.carriers.length&&unit.carriers[0].type==='Starship'&&isPlanetSystem(state.locations[unit.slot])&&locationGroup(state.locations[unit.slot])===sitePlanet(origin);
   if(down)return [{card:shuttle,target:unit.card,args:['shuttle',index,unitIndex,slot],site:slot,cost:0,label:unit.card.name+' kostenlos zum Site shutteln'}];
   if(unit.slot!==slot||unit.carriers.length)return [];
   return all.flatMap(host=>host.card.type==='Starship'&&isPlanetSystem(state.locations[host.slot])&&locationGroup(state.locations[host.slot])===sitePlanet(origin)?
    PremiereUnits.roles(host.card,unit.card).map(role=>({card:shuttle,target:unit.card,host:host.card,role,args:['shuttle',index,unitIndex,host.slot,all.indexOf(host),role],
     site:slot,cost:0,label:unit.card.name+' kostenlos auf '+host.card.name+' shutteln'})):[]);
  });
 });
}

function interruptStackTerms(side,action){
 const card=action.card;
 if(card?.type!=='Interrupt'||['finishCardInformation','takeFromReserve','battleHandForfeit','loseForce','battleForceLoss'].includes(action.kind))return {cost:0,unique:false};
 const title=locationTitle(card),records=(state.tableEffects??[]).filter(effect=>effect.interruptTitle===title);
 const tax=records.filter(effect=>effect.stackTax).reduce((total,effect)=>total+(effect.support?.length??0)+1,0);
 const unique=records.some(effect=>!effect.stackTax);
 return {cost:tax,unique,key:'uniqueInterrupt:'+title,records};
}

function legalActions(position,side,request){
 const actions=baseLegalActions(position,side,request);
 if(!state?.game||(state.game.cardRulesVersion??0)<29)return actions;
 return actions.filter(action=>{
  if(hothEnabled()&&!hothActionAllowed(action))return false;
  if(!advoszeDestinationAllowed(action))return false;
  const terms=interruptStackTerms(side,action);
  return (!terms.unique||!PremiereGame.wasUsed(state.game,'turn',terms.key))&&
   (!terms.cost||terms.cost+(action.cost??0)<=forceBudget(side));
 }).map(action=>{
  const terms=interruptStackTerms(side,action);
  return terms.cost?{...action,cost:(action.cost??0)+terms.cost,interruptSurcharge:terms.cost}:action;
 });
}

function immediateEffectResponses(side,window){
 if(window.kind!=='interrupt'||window.side===side||window.card?.grabbedBy)return [];
 return PremiereGame.zones(state,side).hand.flatMap((card,index)=>{
  const [rule]=activeCardRules(card,'grabInterrupt');
  return rule&&withinDeploymentLimit(card,side)&&forceBudget(side)>=rule.cost?[{kind:'grabInterrupt',card,index,rule,cost:rule.cost,args:[index,'grabInterrupt'],
   label:card.name+' · '+window.card.name+' festhalten ('+rule.cost+' Force)'}]:[];
 });
}

function settleInterruptStacks(){
 for(const effect of state.tableEffects??[]){
  if(!effect.stackPending)continue;
  const target=effect.stackPending;
  for(const side of PremiereGame.sides)for(const zone of ['used','lost','outOfPlay']){
   const pile=zone==='outOfPlay'?state.outOfPlay:PremiereGame.zones(state,side)[zone];
   const index=pile?.indexOf(target)??-1;
   if(index>=0){pile.splice(index,1);effect.support.push(target);delete effect.stackPending;break;}
  }
 }
}

function musicianCoverCharge(loc){
 if(!isSite(loc)||(currentGame()?.cardRulesVersion??latestCardRulesVersion)<29)return 0;
 const slot=state.locations.indexOf(loc),present=PremiereGame.sides.flatMap(side=>PremiereLocations.presentCards(state,side,slot));
 const lirin=present.find(card=>activeCardRules(card,'coverCharge').length);
 return lirin?present.filter(card=>card!==lirin&&characterTraits(card).includes('musician')).length:0;
}
function travelOptions(card,side,from,to,react=false){
 if(laserGateBlocks(card,side,from,to))return [];
 const mobile=vehicleSiteTravel(card,side,from,to);
 if(mobile!==null)return mobile;
 const options=hothEnabled()?hothTravelOptions(card,side,from,to,react):baseTravelOptions(card,side,from,to,react);
 if(card.type!=='Character')return options;
 return options.map(option=>({...option,cost:option.cost?option.cost+musicianCoverCharge(state.locations[to]):0}));
}
function squadTrooper(card,side){
 return characterTraits(card).includes('trooper')||side==='Light'&&locationTitle(card)==='rebel guard';
}
function squadGuardReleased(card){
 if(!['rebel guard','imperial trooper guard'].includes(locationTitle(card)))return false;
 const entry=PremiereLocations.findEntry(state,card);
 return entry&&!entry.unavailable&&PremiereLocations.presentCards(state,entry.side,PremiereLocations.physicalPlace(entry)).some(unit=>activeCardRules(unit,'squadLeader').length);
}
function squadMovementActions(side){
 if(state.activeSide!==side||state.phase!==4)return [];
 const board=PremiereGame.zones(state,side).board,actions=[];
 for(const [from,row] of board.entries())for(const leader of row){
  if(!activeCardRules(leader,'squadLeader').length||regularMovementUsed(leader)||movementPrevented(leader))continue;
  const others=row.filter(card=>card!==leader&&squadTrooper(card,side)&&PremiereUnits.active(card)&&!regularMovementUsed(card)&&!movementPrevented(card));
  for(let a=0;a<others.length;a++)for(let b=a+1;b<others.length;b++)for(let c=b+1;c<others.length;c++){
   const members=[leader,others[a],others[b],others[c]],indices=members.map(card=>row.indexOf(card));
   for(const [to,loc] of state.locations.entries()){
    if(!members.every(card=>baseTravelOptions(card,side,from,to).some(option=>option.kind==='Landspeed')))continue;
    const cost=1+musicianCoverCharge(loc);
    if(cost<=forceBudget(side))actions.push({card:leader,members,site:from,to,cost,args:['squad',from,to,...indices],label:'Squad → '+loc.name+' ('+cost+' Force insgesamt)'});
   }
  }
 }
 return actions;
}
function advoszeDestinationAllowed(action){
 if((state.game?.cardRulesVersion??0)<29)return true;
 let cards=[action.card],to;
 if(['deploy','deployWithPilot'].includes(action.kind))to=action.args[1];
 else if(['move','transport','react'].includes(action.kind))to=action.to;
 else if(action.kind==='anhCharacter'&&action.args[0]==='squad'){cards=action.members;to=action.to;}
 if(!Number.isInteger(to)||!cards?.some(card=>activeCardRules(card,'advosze').length))return true;
 return !PremiereGame.sides.some(side=>PremiereLocations.entries(state,side).some(entry=>entry.slot===to&&!entry.unavailable&&activeCardRules(entry.card,'advosze').length&&!cards.includes(entry.card)));
}

function interruptResponses(side,window){
 return (baseInterruptResponses(side,window)??[]).concat(anhResponseOptions(side,window),fireExtinguisherResponses(side,window),hothEnabled()?hothResponseOptions(side,window):[]);
}
function anhResponseOptions(side,window){
 if(!window||(state.game?.cardRulesVersion??0)<29)return [];
 return PremiereGame.zones(state,side).hand.flatMap((card,index)=>activeCardRules(card,'anhResponse').flatMap(rule=>{
  const result=[],offer=(mode,label,cost=0,extra={})=>({kind:'anhResponse',card,index,rule,cost,mode,args:[index,'anhResponse',mode,...(extra.choice??[])],label:card.name+' · '+label,...extra});
  if(rule.prisoner&&window.kind==='aboutToLoseBattle'&&side==='Dark'){const cost=typeof jpWrappedFree==='function'&&jpWrappedFree(card)?0:1;if(forceBudget(side)>=cost)result.push(offer('captureBattle',window.target.name+' statt Verlust fangen ('+cost+' Force)',cost,{target:window.target}));}
  if(rule.evader&&window.kind==='characterLost'&&window.side===side){
   const target=window.fallen,title=locationTitle(target);
   if(PremiereGame.zones(state,side).lost.includes(target)&&(title==='darth vader'||title==="vader's custom tie"||target.subType==='Imperial'&&sitePlanet(state.locations[window.site])==='death star'))result.push(offer('evaderRecovery',target.name+' auf Used retten',0,{target}));
  }
  if(rule.wookieDisarm&&window.kind==='finishedBattle'&&window.winner&&window.winner!==side&&window.participants?.[side]?.some(unit=>characterTraits(unit).includes('wookiee')&&PremiereLocations.present(state,unit,window.site)))
   PremiereLocations.presentCards(state,PremiereGame.otherSide(side),window.site).forEach((target,i)=>{if(target.type==='Character'&&cardAbility(target)<5)result.push(offer('wookieDisarm',target.name+' entwaffnen',0,{target,choice:[i]}));});
  if(rule.badFeeling&&window.side!==side){
   if(window.kind==='reactCompleted')result.push(offer('cancelBattle','Battle nach React aufheben'));
   if(window.kind==='deployment'){
    const entry=window.targets.map(target=>PremiereLocations.findEntry(state,target)).find(Boolean);
    const deployed=entry&&(state.deploymentLocations??[]).filter(record=>record.turn===state.game.timing.turn&&record.site===entry.slot&&record.side===window.side);
    if(deployed?.length>=4)result.push(offer('prohibitBattle','gerade ausgespielte Gruppe vom Battle ausschließen',0,{targets:deployed.map(record=>record.card)}));
   }
  }
  if(rule.smugglerStop&&window.kind==='deployment'&&window.side!==side)window.targets.forEach((target,i)=>{
   if(PremiereUnits.hasSkill(target,'smuggler'))result.push(offer('stopSmuggler',target.name+' an Bewegung hindern',0,{target,choice:[i]}));
  });
  if(rule.transport&&window.kind==='transportCompleted'&&window.card.id===rule.transport){const cost=typeof jpWrappedFree==='function'&&jpWrappedFree(card)?0:2;if(forceBudget(side)>=cost)
   result.push(offer('transportRetaliation','Transport beantworten ('+cost+' Force)',cost,{transport:window.card,targets:window.targets}));}
  if(rule.spaceBattle&&window.kind==='battle'&&(isSystem(state.locations[window.site])||state.locations[window.site]?.subType==='Sector')&&forceBudget(side)>=3)
   result.push(offer('cancelBattle','Raumbattle aufheben (3 Force)',3));
  return result;
 }));
}
function resolveAnhResponse(frame,parent){
 const {side,mode}=frame;
 if(mode==='captureBattle'){
  if(parent?.target===frame.target&&captureCharacter(frame.target,parent.site)){parent.replaced=true;for(const property of ['battleForfeit','battleForfeitModifier','ionDamage','armedTurn','noMoveTurn','noBattleTurn'])delete frame.target[property];}
  loseOwnedCard(frame.card,side);return;
 }
 if(mode==='evaderRecovery'){const own=PremiereGame.zones(state,side),i=own.lost.indexOf(frame.target);if(i>=0)own.used.push(own.lost.splice(i,1)[0]);own.lost.push(frame.card);return;}
 if(mode==='wookieDisarm'){
  const entry=PremiereLocations.findEntry(state,frame.target);
  if(entry){for(const weapon of (frame.target.weapons??[]).slice())loseTableCard(entry.side,entry.slot,weapon);(frame.target.attachments??=[]).push(frame.card);}
  else loseOwnedCard(frame.card,side);return;
 }
 if(mode==='cancelBattle'){
  const battleFrame=state.game.responses?.find(window=>window.kind==='battle');
  if(parent?.kind==='battle')PremiereGame.cancelResponse(state.game,parent);
  else if(battleFrame)PremiereGame.cancelResponse(state.game,battleFrame);
  if(battleSession){loseHitsFromInterruptedBattle(battleSession);const site=battleSession.site;battleSession=null;endBattleTiming(site);}
 }
 if(mode==='prohibitBattle')for(const card of frame.targets)card.noBattleTurn=state.game.timing.turn;
 if(mode==='stopSmuggler')frame.target.noMoveTurn=state.game.timing.turn;
 if(mode==='transportRetaliation'){
  const used=PremiereGame.zones(state,frame.transport.side).used,index=used.indexOf(frame.transport);
  if(index>=0)loseOwnedCard(used.splice(index,1)[0],frame.transport.side);
  for(const card of frame.targets){
   const entry=PremiereLocations.findEntry(state,card);if(!entry)continue;
   if(locationTitle(frame.transport)==='nabrun leids'){if(card.subType==='Rebel')captureCharacter(card,entry.slot);}
   else loseTableCard(entry.side,entry.slot,card);
  }
 }
 if(frame.equipment)loseOwnedCard(frame.card,side);else PremiereGame.zones(state,side).used.push(frame.card);
 settleCancelledResponse(state.game);
}

function brainiacPower(){
 const icons=side=>state.locations.reduce((sum,loc,index)=>sum+(loc?PremiereLocations.icons(state,index,side)??0:0),0);
 return Math.max(1,Math.sqrt(Math.max(0,3*(state.botHand.length-state.hand.length)+2*(icons('Dark')-icons('Light'))+Math.PI)));
}
function kiffexOccupants(side,slot){
 return !!PremiereLocations.ruleAt(state,slot,side,'kiffex')&&PremiereLocations.presence(state,side,slot,card=>card.ability??permanentPilotAbility(card)??0)===true&&
  PremiereLocations.presentCards(state,side,slot).filter(card=>card.type==='Starship'&&PremiereUnits.active(card)).length===2;
}
function kiffexPower(side,slot){return kiffexOccupants(side,slot)?2:0;}
function tonnikaFactor(card){
 if(!state?.locations||locationTitle(card)!=='tonnika sisters'||(currentGame()?.cardRulesVersion??latestCardRulesVersion)<29)return 1;
 return state.locations.some((loc,slot)=>loc?.id==='Dark:1434'&&kiffexOccupants('Dark',slot))?2:1;
}
function clakdorDestinyModifier(card){
 if(!characterTraits(card).includes('bith'))return 0;
 const slot=state.locations.findIndex(loc=>loc?.id==='Light:416');
 if(slot<0)return 0;
 let amount=0;
 if(PremiereLocations.ruleAt(state,slot,'Light','clakdor')&&PremiereLocations.presence(state,'Light',slot,cardAbility)===true)amount+=2;
 if(PremiereLocations.ruleAt(state,slot,'Dark','clakdor')&&PremiereLocations.control(state,'Dark',slot,cardAbility)===true)amount--;
 return amount;
}
function resolveAnhDestinyTriggers(drawSide,draw,resume){
 if((state.game?.cardRulesVersion??0)<29||draw.cancelled){resume();return;}
 const side=PremiereGame.otherSide(drawSide),sources=[];
 for(const actor of PremiereGame.sides)for(const entry of PremiereLocations.entries(state,actor)){
  if(entry.unavailable||!activeCardRules(entry.card,'programTrap').length||!isSite(state.locations[entry.slot]))continue;
  const count=PremiereGame.sides.flatMap(owner=>PremiereLocations.entries(state,owner)).filter(other=>other.slot===entry.slot&&other.card.type==='Character'&&!other.card.imprisoned).length;
  if(draw.value===count)sources.push({kind:'trap',card:entry.card,entry});
 }
 for(const effect of state.tableEffects??[])if(effect.target===side&&activeCardRules(effect.card,'kraytBones').length)sources.push({kind:'bones',card:effect.card,effect});
 for(const entry of PremiereLocations.entries(state,side))if(!entry.unavailable&&activeCardRules(entry.card,'r2Destiny').length&&atScompLink(entry.card)&&draw.value>=1&&draw.value<=6)sources.push({kind:'r2',card:entry.card});
 function next(){
  const source=sources.shift();if(!source){resume();return;}
  if(typeof jpKraytAnswer==='function'&&jpEnabled()&&source.kind==='bones'&&!source.jpAnswered&&jpKraytAnswer(source,draw,next,()=>{source.jpAnswered=true;sources.unshift(source);next();}))return;
  const frame={mode:'anhDestinyTrigger',side,draw,...source,shown:[],resume:next};
  if(source.kind==='trap'){resolveProgramTrap(source);next();return;}
  if(source.kind==='bones'){
   const own=PremiereGame.zones(state,side),n=draw.value;
   if(n===0&&own.used.length)PremiereGame.moveTop(own.used,own.hand);
   if(n===1&&beginForceLoss(side,1,{reason:'kraytBones',after:next}))return;
   if(n===2)activateReserve(side,1);
   if(n===3)cancelTableEffect(source.effect);
   if(n===4)PremiereGame.retrieveForce(state,side,1);
   if(n!==5){next();return;}
  }
  const choices=anhDestinyTriggerChoices(frame);
  const noDeployment=(state.game.cardRulesVersion??0)>=30?choices.every(choice=>choice.args[0]==='skip'):choices.length===1;
  if(noDeployment&&source.kind==='bones'){next();return;}
  state.pendingCardView=frame;
 }
 next();
}
function anhDestinyTriggerChoices(frame){
 if(frame.kind==='r2')return [{args:['accept'],label:frame.draw.value<=3?'1 Force aktivieren':'Oberste Reserve-Karte ziehen'},{args:['skip'],label:'Verzichten'}];
 const hand=PremiereGame.zones(state,frame.side).hand;
 const choices=hand.flatMap((card,index)=>card.type==='Character'?emergencyPlacements(frame.side,card,[card]).map((destination,destinationIndex)=>({args:['deploy',index,destinationIndex],card,destination,label:card.name+' kostenlos bei '+state.locations[destination.slot].name+' ausspielen'})):[])
  ;
 return choices.length?choices:[{args:['skip'],label:'Keine Figur ausspielbar'}];
}
function finishAnhDestinyTrigger(frame,...args){
 state.pendingCardView=null;
 if(frame.kind==='r2'&&args[0]==='accept'){
  const own=PremiereGame.zones(state,frame.side);
  if(frame.draw.value<=3)activateReserve(frame.side,1);else PremiereGame.moveTop(own.deck,own.hand);
 }else if(args[0]==='deploy'){
  const option=anhDestinyTriggerChoices(frame).find(option=>option.args.every((arg,i)=>arg===args[i]));
  const own=PremiereGame.zones(state,frame.side),{card,destination}=option;
  own.hand.splice(own.hand.indexOf(card),1);
  card.controller=frame.side;
  if(destination.host)PremiereUnits.add(destination.host,card,destination.role,frame.side);else own.board[destination.slot].push(card);
  if(activeCardRules(card,'deployUndercover').length)setUndercover(card,frame.side);
  if(jawaCosts.has(card.id)){const amount=jawaDeployPayment(card,state.locations[destination.slot],frame.side)?.opposing;if(amount)payOpposingJawaCost(frame.side,amount);}
  (state.deployedThisTurn??=[]).push(card);
  openDeploymentReaction(frame.side,[card]);
  const window=PremiereGame.responseWindow(state.game);
  if(window?.kind==='deployment'){window.afterDeployment=frame.resume;return true;}
 }
 frame.resume();return true;
}

function felthMakesUsed(card){
 return ['local trouble','look sir, droids'].includes(locationTitle(card))&&PremiereGame.sides.some(side=>PremiereLocations.entries(state,side).some(entry=>
  !entry.unavailable&&sitePlanet(state.locations[entry.slot])==='tatooine'&&activeCardRules(entry.card,'felth').length));
}
function loseForceInOrder(items,resume=()=>{}){
 const item=items.shift();if(!item){resume();return;}
 const next=()=>loseForceInOrder(items,resume);
 if(!beginForceLoss(item.payer,item.amount,{...item,after:next}))next();
}

function advancedDeviceActions(side){
 if(state.activeSide!==side||state.phase!==1)return [];
 const entries=PremiereGame.sides.flatMap(owner=>PremiereLocations.entries(state,owner));
 return entries.flatMap((entry,index)=>{
  const {card,slot}=entry;if(entry.side!==side||entry.unavailable)return [];
  const hypo=activeCardRules(card,'hypo').length;
  const suction=activeCardRules(card,'suction').length,remote=activeCardRules(card,'remote').length;
  if(!suction&&!remote&&!hypo)return [];
  const key='device29:'+(card.instanceId??card.id)+':'+index;
  if(PremiereGame.wasUsed(state.game,'phase',key))return [];
  const host=suction||hypo?entries.find(other=>other.card.attachments?.includes(card))?.card:card;
  if(!host)return [];
  if(hypo){const here=PremiereLocations.findEntry(state,host),place=here&&PremiereLocations.physicalPlace(here);if(!entries.some(entry=>entry.captive&&!(typeof cloudCityEnabled==='function'&&cloudCityEnabled()&&entry.card.frozen)&&entry.slot===slot&&PremiereLocations.physicalPlace(entry)===place))return [];
   return ['question','drain'].map(mode=>({card,host,site:slot,key,cost:0,args:['hypo',index,0,mode],label:card.name+' · '+(mode==='question'?'Ja/Nein-Frage stellen':'Force Drain hier +1')}));}
  return entries.flatMap((target,targetIndex)=>{
   if(target.slot!==slot||target.unavailable||!PremiereLocations.presentAt(target,slot))return [];
   const base={card,site:slot,host,target:target.card,key,cost:0};
   if(target.card.type==='Character'&&!movementPrevented(target.card)){
    if(suction)return [{...base,args:['suction',index,targetIndex],label:card.name+' · '+target.card.name+' ansaugen'}];
    return ['power','forfeit'].map(stat=>({...base,args:['remote',index,targetIndex,stat],label:card.name+' · '+target.card.name+' '+stat+' +1'}));
   }
   if(remote&&PremiereWeapons.seeker(target.card)&&forceBudget(side)>=2)return [{...base,cost:2,args:['cancelSeeker',index,targetIndex],label:card.name+' · Seeker für 2 Force aufheben'}];
   return [];
  });
 });
}
function tableToUsed(entry){
 const {card,side,slot}=entry;cleanupVehicleSites(card);if(!detachTableCard(side,slot,card))return false;
 if(card.escortedCaptive){const captive=card.escortedCaptive;delete card.escortedCaptive;(state.pendingCustody??=[]).push({side:'Light',card:captive,slot});}
 PremiereUnits.remove(card,unit=>unit===card?PremiereGame.zones(state,unit.owner??unit.side??side).used.push(unit):loseOwnedCard(unit,side),unit=>loseOwnedCard(unit,side));
 return true;
}
function fireExtinguisherProtects(ship){
 return ship?.type==='Starship'&&PremiereGame.sides.some(side=>PremiereLocations.entries(state,side).some(entry=>!entry.unavailable&&entry.carriers.includes(ship)&&activeCardRules(entry.card,'fireExtinguisher').length));
}
function resolveProgramTrap(source){
 const entry=PremiereLocations.findEntry(state,source.card);if(!entry||entry.unavailable)return;
 const place=PremiereLocations.physicalPlace(entry),entries=PremiereGame.sides.flatMap(side=>PremiereLocations.entries(state,side));
 if(entries.some(other=>PremiereLocations.presentAt(other,place)&&activeCardRules(other.card,'fireExtinguisher').length)){loseTableCard(entry.side,entry.slot,entry.card);log('Fire Extinguisher löscht Program Trap.');return;}
 const victims=entries.filter(other=>other.slot===entry.slot&&PremiereLocations.physicalPlace(other)===place&&other.card.type==='Character'&&!other.card.imprisoned);
 // Captives and escorts affected by the same explosion leave together.
 for(const victim of victims)if(victim.card.escortedCaptive){const captive=victim.card.escortedCaptive;delete victim.card.escortedCaptive;clearCaptivity(captive);loseOwnedCard(captive,captive.side);}
 for(const victim of victims)if(PremiereLocations.findEntry(state,victim.card))loseTableCard(victim.side,victim.slot,victim.card);
 log('Program Trap explodiert · '+victims.length+' Characters verloren.');
}
function fireExtinguisherResponses(side,window){
 if(window?.kind!=='battle'||!isSite(state.locations[window.site]))return [];
 return PremiereLocations.entries(state,side).flatMap((entry,index)=>{
  if(!activeCardRules(entry.card,'fireExtinguisher').length||!PremiereLocations.presentAt(entry,window.site))return [];
  const host=PremiereLocations.entries(state,side).find(other=>other.card.attachments?.includes(entry.card))?.card;
  return isArtoo(host)?[{kind:'extinguishBattle',card:entry.card,entry,equipment:true,index:-1,args:[-1,'extinguishBattle',index],label:'Fire Extinguisher verlieren · Battle aufheben'}]:[];
 });
}

function vehicleSiteActions(side){
 if(state.activeSide!==side||![2,4].includes(state.phase))return [];
 const own=PremiereGame.zones(state,side),entries=PremiereLocations.entries(state,side),actions=[];
 if(state.phase===2)own.hand.forEach((card,index)=>{if(activeCardRules(card,'vehicleSite').length)entries.forEach(({card:host,slot,unavailable},hostIndex)=>{
  if(!unavailable&&PremiereUnits.crawler(host)&&!state.locations.some(loc=>loc?.hostInstanceId&&loc.hostInstanceId===host.instanceId&&locationTitle(loc)===locationTitle(card)))
   actions.push({card,host,site:slot,cost:0,args:['vehicleSite',index,hostIndex],label:card.name+' auf '+host.name});
 });});
 if(state.phase===4)for(const [slot,loc] of state.locations.entries()){
  if(!loc?.hostInstanceId)continue;
  const hostEntry=entries.find(entry=>entry.card.instanceId===loc.hostInstanceId&&!entry.unavailable);if(!hostEntry)continue;
  const host=hostEntry.card;
  for(const entry of entries){
   const {card}=entry;if(entry.unavailable||card.type!=='Character'||regularMovementUsed(card)||movementPrevented(card))continue;
   if(entry.slot===slot&&!entry.carriers.length)for(const role of PremiereUnits.roles(host,card))actions.push({card,host,role,site:slot,to:hostEntry.slot,cost:0,args:['mobileCrew',slot,entries.indexOf(entry),hostEntry.slot,role],label:card.name+' zum Fahrer-/Besatzungsplatz ('+role+')'});
   if(entry.carriers[0]===host)actions.push({card,host,site:hostEntry.slot,to:slot,cost:0,args:['mobileCrew',hostEntry.slot,entries.indexOf(entry),slot],label:card.name+' in '+loc.name+' (0 Force)'});
  }
 }
 return actions;
}
function vehicleSiteTravel(card,side,from,to){
 const origin=state.locations[from],target=state.locations[to];
 if(!origin?.hostInstanceId&&!target?.hostInstanceId)return null;
 if(card.type!=='Character'||from===to||!PremiereUnits.active(card)||movementPrevented(card)||!adjacentSites(from,to))return [];
 if(origin.hostInstanceId&&origin.hostInstanceId===target.hostInstanceId)return [{kind:'Landspeed',cost:1}];
 const slot=origin.hostInstanceId?from:to,loc=state.locations[slot];
 const host=PremiereGame.sides.flatMap(actor=>PremiereLocations.entries(state,actor)).find(entry=>entry.card.instanceId===loc.hostInstanceId);
 if(!host||host.unavailable)return [];
 const rule=PremiereLocations.ruleAt(state,slot,side,'vehicleSiteTransit');
 return rule?[{kind:'Innen-Site',cost:rule.cost}]:[];
}
function cleanupVehicleSites(host){
 if(!host.instanceId)return;
 for(const [slot,loc] of state.locations.entries()){
  if(loc?.hostInstanceId!==host.instanceId)continue;
  for(const side of PremiereGame.sides)for(const card of PremiereGame.zones(state,side).board[slot].slice())loseTableCard(side,slot,card);
  for(const effect of [...PremiereLocations.effectsAt(state,slot)])cancelLocationEffect(slot,effect);
  for(const weapon of (state.locationWeapons?.[slot]??[]).slice())loseTableCard(weapon.owner??weapon.side,slot,weapon,false,false,true,true);
  if(state.locationWeapons)delete state.locationWeapons[slot];
  for(const old of state.convertedLocations?.[slot]??[])loseOwnedCard(old,old.side);
  if(state.convertedLocations)delete state.convertedLocations[slot];
  loseOwnedCard(loc,loc.side);state.locations[slot]=null;state.locationOrder=boardLocationOrder().filter(index=>index!==slot);
 }
}
function formationActions(side){
 if(state.activeSide!==side||state.phase!==2)return [];
 const own=PremiereGame.zones(state,side),actions=[];
 own.hand.forEach((card,index)=>{if(!activeCardRules(card,'squadron').length)return;
  own.board.forEach((row,site)=>{
   const fighters=row.filter(ship=>PremiereUnits.fighter(ship)&&PremiereUnits.active(ship)&&(card.id==='Light:2908'?/Y-Wing/i.test(ship.subType):tieLn(ship)));
   for(let a=0;a<fighters.length;a++)for(let b=a+1;b<fighters.length;b++)for(let c=b+1;c<fighters.length;c++){
    const members=[fighters[a],fighters[b],fighters[c]];
    actions.push({card,members,site,cost:0,args:['formSquadron',index,site,...members.map(ship=>row.indexOf(ship))],label:card.name+' · drei Jäger bei '+state.locations[site].name+' ersetzen'});
   }
  });
 });return actions;
}
function squadronTransferChoices(frame){
 const entries=PremiereLocations.entries(state,frame.side).filter(entry=>frame.originals.some(ship=>entry.carriers.includes(ship)||ship.weapons?.includes(entry.card)||ship.attachments?.includes(entry.card)));
 const choices=[];
 entries.forEach((entry,index)=>{
  const item=entry.card;
  if(item.type==='Character')for(const role of PremiereUnits.roles(frame.card,item))choices.push({args:['crew',index,role],entry,role,label:item.name+' auf Squadron übernehmen ('+role+')'});
  if(item.type==='Weapon'&&weaponDeployCost(item,frame.card)!==null)choices.push({args:['weapon',index],entry,label:item.name+' übernehmen'});
  if(item.type==='Device'&&activeCardRules(item,'device').some(rule=>matchesRegisteredTarget(frame.card,rule.targets)))choices.push({args:['device',index],entry,label:item.name+' übernehmen'});
 });return choices.concat({args:['done'],label:'Squadron fertigstellen · übrige Karten auf Used'});
}
function finishSquadronTransfer(frame,...args){
 if(args[0]!=='done'){
  const option=squadronTransferChoices(frame).find(option=>option.args.length===args.length&&option.args.every((arg,i)=>arg===args[i]));
  if(!option)return false;const {entry}=option;if(!detachTableCard(entry.side,entry.slot,entry.card))return false;
  if(args[0]==='crew')PremiereUnits.add(frame.card,entry.card,option.role,frame.side);
  else (frame.card[args[0]==='weapon'?'weapons':'attachments']??=[]).push(entry.card);
  return true;
 }
 state.pendingCardView=null;
 for(const ship of frame.originals){
  if(!detachTableCard(frame.side,frame.site,ship))continue;
  for(const effect of targetedUtinniEffects(ship)){if(locationEffectRule(effect.card)?.mission==='lateral-damage')cancelLocationEffect(frame.site,effect);else effect.target=frame.card;}
  PremiereUnits.remove(ship,card=>PremiereGame.zones(state,card.owner??card.side??frame.side).used.push(card),card=>PremiereGame.zones(state,card.owner??card.side??frame.side).used.push(card));
 }return true;
}
function offerRogueTrample(site){
 const entries=PremiereGame.sides.flatMap(side=>PremiereLocations.entries(state,side)),used=battleSession.trampledRogues??=[];
 const rogue=entries.find(entry=>entry.slot===site&&!entry.unavailable&&activeCardRules(entry.card,'rogueTrample').length&&!used.includes(entry.card));
 if(!rogue)return false;used.push(rogue.card);
 const targets=entries.filter(entry=>entry.slot===site&&!entry.unavailable&&matchesRegisteredTarget(entry.card,'tusken')&&PremiereLocations.presentAt(entry,site));
 if(!targets.length)return offerRogueTrample(site);
 state.pendingCardView={mode:'rogueTrample',side:rogue.side,card:rogue.card,targets,shown:targets.map(entry=>entry.card),publicView:true};return true;
}

function isHoloSite(card){return ['Light:694','Dark:1274'].includes(card?.id);}
function holoEligible(card){return ['Effect','Interrupt'].includes(card?.type)&&/\b(dejarik|hologram)\b/i.test(card.lore??'');}
function isHoloUnit(card){return !!state?.locations&&holoEligible(card)&&isHoloSite(state.locations[PremiereLocations.findEntry(state,card)?.slot]);}
function holoPowerBonus(card){
 const slot=state.locations.findIndex(loc=>loc?.id==='Light:416');
 return locationTitle(card)==='ghhhk'&&slot>=0&&PremiereLocations.ruleAt(state,slot,'Dark','clakdor')&&PremiereLocations.control(state,'Dark',slot,cardAbility)===true?2:0;
}
function holoAndBluffActions(side){
 const own=PremiereGame.zones(state,side),actions=[];
 for(const [site,loc] of state.locations.entries()){
  if(isHoloSite(loc)&&!battleSession&&PremiereLocations.control(state,side,site,cardAbility)===true)for(const [index,card] of own.board[site].entries())
   actions.push({card,site,cost:0,args:['holoReturn',site,index],label:card.name+' auf die Hand nehmen'});
  if(isHoloSite(loc))own.hand.forEach((card,index)=>{if(namedInterruptAvailable(card))PremiereGame.zones(state,PremiereGame.otherSide(side)).board[site].forEach((target,i)=>{if(namedCancellation(card,target))actions.push({card,target,site,cost:0,args:['holoCancel',site,index,i],label:card.name+' · '+target.name+' am Holosite aufheben'});});});
  if(loc?.id!=='Dark:2438')continue;
  if(side==='Dark'&&state.activeSide==='Dark'&&!PremiereGame.wasUsed(state.game,'turn','bluff'))own.hand.forEach((card,index)=>actions.push({card,site,cost:0,args:['placeBluff',site,index],label:'Bluff verdeckt auslegen'}));
  if(side==='Light'&&state.activeSide==='Dark'&&state.phase===2)(loc.bluffs??[]).forEach((_,index)=>actions.push({card:loc,site,cost:0,args:['challengeBluff',site,index],label:'Bluff '+(index+1)+' aufdecken'}));
 }return actions;
}
function hypoDrainBonus(side,slot){return PremiereLocations.entries(state,side).some(entry=>!entry.unavailable&&entry.slot===slot&&activeCardRules(entry.card,'hypo').length&&entry.card.hypoDrainTurn===state.game?.timing.turn)?1:0;}
function gateDeployActions(side){
 if(state.activeSide!==side||state.phase!==2)return [];
 const own=PremiereGame.zones(state,side),actions=[];
 own.hand.forEach((card,index)=>{if(!activeCardRules(card,'laserGate').length||!withinDeploymentLimit(card,side))return;
  for(const a of state.locations.keys())for(const b of state.locations.keys())if(a<b&&adjacentSites(a,b)&&[a,b].every(slot=>state.locations[slot]?.locationTags?.includes('Interior')&&state.locations[slot].locationTags.includes('Mobile')))
   actions.push({card,site:a,to:b,cost:0,args:['laserGate',index,a,b],label:card.name+' zwischen '+state.locations[a].name+' und '+state.locations[b].name});
 });return actions;
}
function laserGateRecords(){return Object.entries(state?.locationEffects??{}).flatMap(([site,row])=>row.filter(effect=>Number.isInteger(effect.gateTo)).map(effect=>({site:Number(site),effect})));}
function laserGateRecord(card){return laserGateRecords().find(record=>record.effect.card===card);}
function laserGateBlocks(card,side,from,to){
 if(!state?.locations||from===to||!laserGateRecords().length||!isSite(state.locations[from])||!isSite(state.locations[to]))return false;
 const order=boardLocationOrder(),a=order.indexOf(from),b=order.indexOf(to),path=order.slice(Math.min(a,b),Math.max(a,b)+1);
 const crossed=laserGateRecords().some(({site,effect})=>path.includes(site)&&path.includes(effect.gateTo));
 if(!crossed)return false;if(PremiereUnits.tube(card))return false;
 if(card.type==='Vehicle')return true;
 return card.type==='Character'&&(card.power??0)+cardPowerModifier(card,side,from)+cardAbility(card)<=4;
}
function weaponTargets(side,slot,includeNonparticipants=false,x=battleSession){
 return baseWeaponTargets(side,slot,includeNonparticipants,x).filter(({card})=>!hothEnabled()||card.hothDeltaTurn!==state.game.timing.turn).concat(hothEnabled()?(state.locationWeapons?.[slot]??[]).flatMap((card,index)=>(card.owner??card.side)===side?[{card,index:20000+index,place:slot}]:[]):[],laserGateRecords().filter(({site,effect})=>(site===slot||effect.gateTo===slot)&&(effect.card.owner??effect.card.side)===side)
  .map(({effect},index)=>({card:effect.card,index:10000+index,place:slot})));
}

function tractorBeamOptions(side,window){
 const original=deathStarTractorOptions(side,window);
 if(side!=='Dark'||window.kind!=='finishedBattle'||forceBudget(side)<2)return original;
 const sources=PremiereLocations.entries(state,side).filter(entry=>entry.slot===window.site&&!entry.unavailable&&entry.card.attachments?.some(card=>activeCardRules(card,'tractorDevice').length));
 const targets=PremiereLocations.presentCards(state,'Light',window.site).filter(card=>card.type==='Starship'&&PremiereUnits.active(card)&&!/mon calamari star cruiser/i.test(card.subType));
 return original.concat(sources.flatMap(({card:holder},i)=>holder.attachments.flatMap(card=>activeCardRules(card,'tractorDevice').length&&!window.tractorUsed?.includes(card)?targets.map((target,j)=>({kind:'tractorBeam',card,holder,target,site:window.site,bay:window.site,index:-1,cost:2,args:[-1,'tractorBeam',1000+i,j],label:card.name+' · '+target.name+' einfangen (2 Force)'})):[])));
}
function syncTractorHolders(){
 for(const record of state.capturedShips??[]){
  if(!record.holder)continue;const holder=PremiereLocations.findEntry(state,record.holder);
  if(!holder||holder.slot===record.bay)continue;
  if(detachTableCard(record.side,record.bay,record.ship))PremiereGame.zones(state,record.side).board[holder.slot].push(record.ship);
  record.bay=holder.slot;record.site=holder.slot;
 }
}
function besiegedActions(side){
 if(side!=='Dark'||state.activeSide!==side||state.phase!==3||battleSession||forceBudget(side)<1)return [];
 return (state.capturedShips??[]).flatMap((record,index)=>{
  const effect=record.ship.attachments?.find(card=>activeCardRules(card,'besieged').length);
  if(!effect||state.battledSitesThisTurn?.includes(record.bay)||!tractorShipCrew(record.ship).length)return [];
  const targets=record.holder?(record.holder.occupants??[]).filter(entry=>entry.card.type==='Character'&&PremiereUnits.active(entry.card)).map(entry=>entry.card):PremiereLocations.presentCards(state,side,record.bay).filter(card=>card.type==='Character'&&PremiereUnits.active(card));
  return targets.length?[{card:effect,record,targets,site:record.bay,cost:0,args:['besieged',index],label:effect.name+' · Gefangene Schiffsbesatzung angreifen (1 Force)'}]:[];
 });
}
function prisonerMissionActions(side){
 if(side!=='Dark'||state.activeSide!==side||state.phase!==2)return [];
 const own=PremiereGame.zones(state,side),entries=PremiereLocations.entries(state,side),site=state.locations.findIndex(loc=>isPlanetSystem(loc)&&locationTitle(loc)==='kessel');
 if(site<0)return [];
 return own.hand.flatMap((card,index)=>activeCardRules(card,'spiceMines').length?entries.flatMap((entry,escortIndex)=>entry.card.escortedCaptive&&characterTraits(entry.card).includes('trooper')&&!entry.unavailable?
  [{card,site,escort:entry.card,target:entry.card.escortedCaptive,cost:0,args:['spiceMines',index,escortIndex],label:card.name+' · '+entry.card.name+' eskortiert '+entry.card.escortedCaptive.name+' nach Kessel'}]:[]):[]);
}
function progressSpiceMines(site,effect){
 const escort=PremiereLocations.findEntry(state,effect.escort),target=PremiereLocations.findEntry(state,effect.target);
 if(!escort||effect.escort.escortedCaptive!==effect.target){cancelLocationEffect(site,effect);return;}
 if(escort.slot!==site)return;
 const amount=effect.target.forfeit??0;
 delete effect.escort.escortedCaptive;clearCaptivity(effect.target);PremiereUnits.remove(effect.target,card=>loseOwnedCard(card,card.side??'Light'),card=>loseOwnedCard(card,card.side??'Light'));
 PremiereGame.retrieveForce(state,'Dark',amount);cancelLocationEffect(site,effect);
}
function progressCell2187(site,effect){
 const target=PremiereLocations.findEntry(state,effect.target);if(!target){cancelLocationEffect(site,effect);return;}if(target.unavailable||target.slot!==site)return;
 const row=state.locationEffects[site];row.splice(row.indexOf(effect),1);
 drawDestinySeries('Light','cell2187',1,0,draws=>{
  loseOwnedCard(effect.card,'Light');const frame={mode:'cellRescue',side:'Light',card:effect.card,remaining:Math.floor(draws[0]?.value??0),shown:[],publicView:true};
  if(frame.remaining>0&&cellRescueChoices(frame).length)state.pendingCardView=frame;
 });
}
function cellRescueChoices(frame){return PremiereLocations.entries(state,'Dark').filter(entry=>entry.card.captured&&locationTitle(state.locations[entry.slot])==='death star: detention block corridor').map((entry,index)=>({args:[index],card:entry.card,label:entry.card.name+' befreien'}));}

function deathStarSlot(){return state.locations.findIndex(loc=>loc?.id==='Dark:654'&&!loc.blownAway);}
function trenchSlot(){return state.locations.findIndex(loc=>loc?.id==='Light:681');}
function epicActions(side){
 const actions=[],own=PremiereGame.zones(state,side),trench=trenchSlot(),system=deathStarSlot();
 if(side==='Light'&&state.activeSide===side&&state.phase===2&&system>=0&&forceBudget(side)>=2&&!PremiereGame.wasUsed(state.game,'game','dantooine')){
  const site=state.locations.findIndex(loc=>isPlanetSystem(loc)&&locationTitle(loc)==='dantooine');
  if(site>=0)own.hand.forEach((card,index)=>{if(activeCardRules(card,'dantooineBlock').length)actions.push({card,site,cost:2,args:['dantooine',index,site],label:card.name+' · Death Star nach Dantooine locken (2 Force)'});});
 }
 if(state.activeSide===side&&state.phase===2&&trench>=0)own.hand.forEach((card,index)=>{if(activeCardRules(card,'attackRunEpic').length)actions.push({card,site:trench,cost:0,args:['deployEpic',index,trench],label:'Attack Run auf Trench ausspielen'});});
 const effect=(state.tableEffects??[]).find(effect=>activeCardRules(effect.card,'recharge').length);
 if(side==='Dark'&&effect&&(effect.support??[]).length<8&&state.botForce.length)actions.push({card:effect.card,effect,site:system,cost:0,args:['chargeSuperlaser'],label:'Commence Recharging · oberste Force-Karte verdeckt stapeln ('+(effect.support.length+1)+'/8)'});
 if(side==='Light'&&state.activeSide===side&&state.phase===4&&trench>=0&&system>=0&&!state.attackRun){
  const deployed=PremiereLocations.effectsAt(state,trench).find(effect=>activeCardRules(effect.card,'attackRunEpic').length);
  if(deployed&&runEligibleLight(system).some(card=>card.weapons?.some(weapon=>weapon.id==='Light:1962')))actions.push({card:deployed.card,site:trench,system,cost:0,args:['attackRun',trench],label:'Attack Run beginnen · 1–3 Starfighters auswählen'});
 }
 if(side==='Dark'&&state.activeSide===side&&state.phase===1&&system>=0){
  const target=state.mobileSystems?.['Dark:654']?.orbit,weapon=(state.locationWeapons?.[system]??[]).find(card=>card.id==='Dark:2378');
  const blocked=Object.values(state.locationEffects??{}).flat().some(effect=>effect.card.id==='Light:2563');
  const site=target??-1;
  if(weapon&&isPlanetSystem(state.locations[site])&&!blocked&&(!effect||(effect.support??[]).length>=8)){
   const cost=epicPlanetSites(locationGroup(state.locations[site])).length;
   if(cost<=forceBudget(side))own.hand.forEach((card,index)=>{if(activeCardRules(card,'ignitionEpic').length)actions.push({card,site,weapon,cost,args:['primaryIgnition',index,site],label:'Commence Primary Ignition · '+state.locations[site].name+' ('+cost+' Force)'});});
  }
 }
 return actions;
}
function planetSites(region){return state.locations.flatMap((loc,index)=>loc&&(!loc.blownAway||hothEnabled()&&loc.id==='Light:5586')&&isSite(loc)&&sitePlanet(loc)===region?[index]:[]);}
function epicPlanetSites(region){return planetSites(region).filter(slot=>!hothEnabled()||hothCountsForEpic(slot));}
function rebelBaseSize(){return Math.max(epicPlanetSites('yavin 4').length,epicPlanetSites('hoth').length);}
function runEligibleLight(system){return state.light[system].filter(card=>PremiereUnits.fighter(card)&&craftStats(card,system).powered&&!regularMovementUsed(card));}
function runTies(system){return state.dark[system].filter(card=>PremiereUnits.tie(card)&&craftStats(card,system).powered);}
function runSurvivors(side){const run=state.attackRun;return (run?.[side==='Light'?'light':'dark']??[]).filter(card=>PremiereLocations.findEntry(state,card)?.slot===run.site);}
function pilotMaximum(ship){return Math.max(permanentPilotAbility(ship)===null?0:/^Squadron/.test(ship.subType)?1:permanentPilotAbility(ship),...(ship.occupants??[]).filter(entry=>entry.role==='pilot'&&PremiereUnits.active(entry.card)).map(entry=>cardAbility(entry.card)??0));}
function epicChoices(frame){
 const run=state.attackRun;
 if(frame.mode==='ignitionZ')return [...new Set([frame.x,...['yavin 4','hoth'].filter(region=>state.locations.some(loc=>loc&&locationGroup(loc)===region)).map(region=>epicPlanetSites(region).length)])].map(value=>({args:[value],label:'Z = '+value+' wählen'}));
 if(frame.mode==='ignitionGunner')return PremiereGame.sides.flatMap(side=>PremiereLocations.entries(state,side)).filter(entry=>entry.card.id==='Dark:657'&&!entry.unavailable).map((entry,index)=>({args:[index],entry,card:entry.card,label:entry.card.name+' verlieren'}));
 if(frame.mode==='runSelectLight'||frame.mode==='runSelectDark'){
  const light=frame.mode==='runSelectLight',pool=light?runEligibleLight(run.system):runTies(run.system),selected=run.selected;
  const choices=pool.flatMap((card,index)=>selected.includes(index)||selected.reduce((n,i)=>n+(/^Squadron/.test(pool[i].subType)?3:1),0)+(/^Squadron/.test(card.subType)?3:1)<=3?
   [{args:['toggle',index],card,label:(selected.includes(index)?'✓ ':'')+card.name}]:[]);
  if(!light||selected.some(index=>pool[index].weapons?.some(weapon=>weapon.id==='Light:1962')))choices.push({args:['done'],label:light?'In Trench einfliegen':'Verfolgung abschließen'});
  return choices;
 }
 if(frame.mode==='runLead')return runSurvivors('Light').filter(card=>card.weapons?.some(weapon=>weapon.id==='Light:1962')).map((card,index)=>({args:[index],card,label:card.name+' als Lead bestimmen'}));
 if(frame.mode==='runPilot'){
  const pilot=pilotMaximum(run.lead),computer=run.lead.attachments?.some(card=>activeCardRules(card,'targetingComputer').length);
  return [...new Set([pilot,...(computer?[3]:[])])].map(x=>({args:[x],label:'Attack Run mit X = '+x+(x===3&&computer?' (Targeting Computer)':' (Pilot)')}));
 }
 if(frame.mode==='runCover'){
  const side=frame.side,shots=side==='Dark'?runWeaponOptions():[];
  return shots.map((shot,index)=>({args:['fire',index],card:shot.weapon,label:shot.weapon.name+' → '+shot.target.name+' ('+shot.cost+' Force)'}))
   .concat(pileInterruptOptions(side).map((option,index)=>({args:['interrupt',index],card:option.card,label:option.label})))
   .concat({args:['pass'],label:'Im Attack Run passen'});
 }
 return [];
}
function showRun(mode,side){state.pendingCardView={mode,side,card:state.attackRun.card,shown:[]};}
function finishEpicChoice(frame,...args){
 const run=state.attackRun;
 if(frame.mode==='ignitionZ'){state.pendingCardView=null;resolveIgnition(frame,args[0]);return true;}
 if(frame.mode==='ignitionGunner'){const selected=epicChoices(frame)[args[0]];state.pendingCardView=null;if(selected)loseTableCard(selected.entry.side,selected.entry.slot,selected.entry.card);return true;}
 if(frame.mode==='runSelectLight'||frame.mode==='runSelectDark'){
  if(args[0]==='toggle'){run.selected=run.selected.includes(args[1])?run.selected.filter(i=>i!==args[1]):[...run.selected,args[1]];return true;}
  const light=frame.mode==='runSelectLight',side=light?'Light':'Dark',pool=light?runEligibleLight(run.system):runTies(run.system),cards=run.selected.map(i=>pool[i]);
  run[light?'light':'dark']=cards;
  for(const card of cards){detachTableCard(side,run.system,card);PremiereGame.zones(state,side).board[run.site].push(card);if(light)(state.movedThisTurn??=[]).push(card);}
  if(light){run.dark=state.dark[run.site].filter(PremiereUnits.tie);run.selected=[];showRun('runSelectDark','Dark');}
  else {run.dark=[...new Set([...run.dark,...state.dark[run.site].filter(PremiereUnits.tie)])];showRun('runLead','Light');}
  return true;
 }
 if(frame.mode==='runLead'){run.lead=epicChoices(frame)[args[0]].card;run.passes=0;showRun('runCover','Dark');return true;}
 if(frame.mode==='runCover'){
  if(args[0]==='fire'){
   const shot=runWeaponOptions()[args[1]];state.pendingCardView=null;run.usedWeapons.push(shot.weapon);run.passes=0;
   fireImmediateWeapon('Dark',shot,()=>{if(!runSurvivors('Light').includes(run.lead))pullUpAttackRun(false);else showRun('runCover','Light');});return true;
  }
  if(args[0]==='interrupt'){
   const option=pileInterruptOptions(frame.side)[args[1]];state.pendingCardView=null;run.passes=0;
   return announcePileInterrupt(frame.side,{...option,resumeAttack:()=>state.attackRun&&showRun('runCover',PremiereGame.otherSide(frame.side))});
  }
  if(++run.passes>=2)showRun('runPilot','Light');else showRun('runCover',PremiereGame.otherSide(frame.side));return true;
 }
 if(frame.mode==='runPilot'){
  state.pendingCardView=null;run.x=args[0];run.z=Math.max(0,...runSurvivors('Dark').map(pilotMaximum));
  chooseEpicRoom('attackRun',bonus=>{run.roomBonus=bonus;drawDestinySeries('Light','epicWeapon',2,0,draws=>{run.total=PremiereBattle.total(draws)+run.x+rebelBaseSize()-run.z+attackRunBonus(run);log('Attack Run: '+run.total+' gegen 15.');pullUpAttackRun(run.total>15);});});return true;
 }
 return false;
}
function runWeaponOptions(){
 const run=state.attackRun,targets=runSurvivors('Light'),wingmen=targets.filter(card=>card!==run.lead),legalTargets=wingmen.length?wingmen:targets;
 return weaponMounts('Dark').filter(mount=>mount.slot===run.site||mount.slot===run.system&&isLoc(mount.host)).flatMap(mount=>mountWeapons(mount).flatMap(weapon=>{
  if(run.usedWeapons.includes(weapon)||!PremiereUnits.canUseWeapon(state,mount.host,weapon))return [];
  if(mount.host.type==='Starship'&&!craftStats(mount.host,mount.slot).powered)return [];
  return legalTargets.flatMap(target=>{const defense=PremiereWeapons.defense(target,cardAbility(target),craftStats(target,run.site)),shot=weaponShot(weapon,mount.host,target,defense);
   if(!shot)return [];const cost=mount.slot===run.site?0:shot.cost;
   return cost<=forceBudget('Dark')?[{...shot,cost,weapon,host:mount.host,target,from:mount.slot,targetSlot:run.site}]:[];
  });
 }));
}
function fireImmediateWeapon(side,shot,complete){
 spendForce(side,shot.cost);PremiereUnits.recordWeaponUse(state,shot.host,shot.weapon);
 withShipWeaponResponse({kind:'weaponTarget',side,shot,site:shot.targetSlot},frame=>{
  if(frame?.cancelled){complete();return;}
  drawDestinySeries(side,'weapon',shot.draws,weaponDestinyModifier(side,shot)+(shot.extraDestiny??0),draws=>{
   const resolve=value=>{const hit=value!==null&&(shot.effect==='exclude'?value+shot.bonus===shot.defense:value+shot.bonus>shot.defense);
   if(hit){const entry=PremiereLocations.findEntry(state,shot.target),gate=laserGateRecord(shot.target);
    if(gate)cancelLocationEffect(gate.site,gate.effect);
    else if(entry){if(['hit','zero','destroy'].includes(shot.effect)){
     const gold=entry.side==='Light'&&state.locations[entry.slot]?.id==='Light:681'&&PremiereUnits.fighter(entry.card)&&state.light[entry.slot].find(card=>card!==entry.card&&activeCardRules(card,'goldRescue').length);
     if(gold){state.pendingCardView={mode:'goldRescue',side:'Light',card:gold,gold,target:entry.card,site:entry.slot,shown:[],resume:complete};return;}
     shot.target.hitForLoss=true;loseTableCard(entry.side,entry.slot,entry.card);}else applyWeaponResult(shot,entry.side,entry.slot);}
   }
   log(shot.weapon.name+' → '+shot.target.name+': '+(value===null?'kein Destiny':value+shot.bonus)+' / '+shot.defense+(hit?' · Treffer.':' · verfehlt.'));
   complete();};
   const value=PremiereBattle.total(draws);if(typeof dagobahEnabled==='function'&&dagobahEnabled()&&shot.target.type==='Starship'&&!Number.isFinite(PremiereWeapons.definition(shot.weapon)?.threshold))dagoTargetTotal(side,shot.target,value,resolve);else resolve(value);
  });
 });
}
function pullUpAttackRun(success){
 const run=state.attackRun,cards=[...runSurvivors('Light').map(card=>({card,side:'Light'})),...runSurvivors('Dark').map(card=>({card,side:'Dark'}))];
 function next(){
  const entry=cards.shift();if(!entry){state.attackRun=null;state.pendingCardView=null;if(success)blowAwaySystem(run.system);return;}
  const finish=()=>{if(detachTableCard(entry.side,run.site,entry.card))PremiereGame.zones(state,entry.side).board[run.system].push(entry.card);next();};
  if(PremiereUnits.fighter(entry.card)&&PremiereLocations.effectsAt(state,run.site).some(effect=>(effect.card.owner??effect.card.side)!==entry.side&&activeCardRules(effect.card,'maneuverCheck').length)){
   const maneuver=craftStats(entry.card,run.site).maneuver;drawDestinySeries(entry.side,'movement',1,0,draws=>{if((draws[0]?.value??0)+maneuver<5)loseTableCard(entry.side,run.site,entry.card);finish();});
  }else finish();
 }next();
}
function attackRunBonus(run){
 let bonus=run.bonus??0;
 for(const entry of PremiereLocations.entries(state,'Light')){
  if(entry.unavailable)continue;const loc=state.locations[entry.slot];
  if(activeCardRules(entry.card,'techAttack').length&&/war room/.test(locationTitle(loc))&&(loc.owner??loc.side)==='Light')bonus++;
  if(entry.slot===run.site&&entry.card.id==='Light:1047')bonus+=(entry.card.occupants??[]).filter(({card,role})=>role==='pilot'&&PremiereUnits.active(card)&&activeCardRules(card,'tireeAttack').length).length;
 }
 if(activeCardRules(run.lead,'redFiveAttack').length)bonus++;
 return bonus+(run.roomBonus??epicRoomBonus('attackRun'));
}
function resolveIgnition(frame,z){chooseEpicRoom('ignition',bonus=>drawIgnition(frame,z,bonus));}
function drawIgnition(frame,z,roomBonus){
 const y=epicPlanetSites('death star').filter(slot=>PremiereLocations.presence(state,'Light',slot,cardAbility)===false).length;
 drawDestinySeries('Dark','epicWeapon',1,0,draws=>{
  const success=(draws[0]?.value??0)+y-z+ignitionBonus()-epicRoomBonus('ignition')+roomBonus+(hothEnabled()?hothIgnitionModifier(frame.site):0)>8;
  PremiereGame.zones(state,'Dark')[success?'lost':'used'].push(frame.card);
  const recharge=(state.tableEffects??[]).find(effect=>effect.host===frame.weapon&&activeCardRules(effect.card,'recharge').length);if(recharge)cancelTableEffect(recharge);
  if(success)blowAwaySystem(frame.site);
  else {const choice={mode:'ignitionGunner',side:'Dark',card:frame.card,shown:[]};if(epicChoices(choice).length)state.pendingCardView=choice;}
 });
}
function ignitionBonus(){return epicRoomBonus('ignition')+PremiereLocations.entries(state,'Dark').filter(entry=>!entry.unavailable&&sitePlanet(state.locations[entry.slot])==='death star').reduce((sum,entry)=>sum+(activeCardRules(entry.card,'gunnerIgnition').length?2:0),0);}
function blowAwaySystem(slot){
 const target=state.locations[slot],region=locationGroup(target),sites=planetSites(region),mobile=target.id==='Dark:654';
 const payer=mobile?'Dark':'Light',penalty=mobile||['yavin 4','hoth'].includes(region)?2*[slot,...sites].filter(i=>!hothEnabled()||hothCountsForEpic(i)).reduce((sum,i)=>sum+(PremiereLocations.icons(state,i,payer)??0),0):0;
 const finish=()=>{
  for(const site of sites){
   if(!state.locations[site])continue;
   for(const side of PremiereGame.sides)for(const card of PremiereGame.zones(state,side).board[site].slice())loseTableCard(side,site,card,false,false,true,true);
   for(const effect of [...PremiereLocations.effectsAt(state,site)])cancelLocationEffect(site,effect);
   for(const weapon of (state.locationWeapons?.[site]??[]).slice())loseTableCard(weapon.owner??weapon.side,site,weapon,false,false,true,true);
   if(state.locationWeapons)delete state.locationWeapons[site];
   for(const bluff of state.locations[site].bluffs??[])loseOwnedCard(bluff,'Dark');delete state.locations[site].bluffs;
   for(const old of state.convertedLocations?.[site]??[])loseOwnedCard(old,old.side);if(state.convertedLocations)delete state.convertedLocations[site];
   loseOwnedCard(state.locations[site],state.locations[site].side);state.locations[site]=null;state.locationOrder=boardLocationOrder().filter(i=>i!==site);
  }
  for(const weapon of state.locationWeapons?.[slot]??[])loseOwnedCard(weapon,weapon.side);if(state.locationWeapons)delete state.locationWeapons[slot];
  for(const effect of [...PremiereLocations.effectsAt(state,slot)])cancelLocationEffect(slot,effect);
  for(const side of PremiereGame.sides)for(const card of PremiereGame.zones(state,side).board[slot].slice())if(card.type!=='Starship')loseTableCard(side,slot,card,false,false,true,true);
  for(const old of state.convertedLocations?.[slot]??[])loseOwnedCard(old,old.side);if(state.convertedLocations)delete state.convertedLocations[slot];
  target.parsec=spaceParsec(target);target.blownAway=true;target.gameTextCancelled=true;target.icons={light:0,dark:0};target.locationTags=['Space'];
  log(target.name+' ist zerstört. Schiffe im System bleiben bestehen.');
 };
 if(!beginForceLoss(payer,penalty,{reason:'blownAway',after:finish}))finish();
}

function epicRoomBonus(event){
 let total=0;
 for(const [site,loc] of state.locations.entries())for(const side of PremiereGame.sides){
  if(!loc||PremiereLocations.control(state,side,site,cardAbility)!==true)continue;
  for(const rule of PremiereLocations.rulesAt(state,site,side,'epicRoom'))if(rule.epic===event&&(!rule.leader||PremiereLocations.presentCards(state,side,site).some(card=>characterTraits(card).includes('leader'))))total+=rule.amount;
 }return total;
}

function controlFireOptions(side,card,index,rule){
 const opponent=PremiereGame.otherSide(side),targets=PremiereLocations.entries(state,opponent).filter(entry=>!entry.unavailable).concat(PremiereLocations.entries(state,side).filter(entry=>entry.card.type==='Creature'));
 for(const record of laserGateRecords())if((record.effect.card.owner??record.effect.card.side)===opponent)for(const site of [record.site,record.effect.gateTo])targets.push({card:record.effect.card,slot:site,side:opponent,carriers:[]});
 const shots=weaponMounts(side).flatMap(mount=>mountWeapons(mount).flatMap(weapon=>{
  if(!PremiereUnits.canUseWeapon(state,mount.host,weapon)||(PremiereWeapons.definition(weapon)?.timing??'weapons')!=='weapons')return [];
  if(mount.host.type==='Starship'&&!craftStats(mount.host,mount.slot).powered)return [];
  return targets.flatMap(entry=>{
   const target=entry.card,place=PremiereLocations.physicalPlace(entry),external=entry.slot!==mount.slot;
   if(external?(!PremiereWeapons.definition(weapon)?.adjacent||!adjacentSites(mount.slot,entry.slot)||place!==entry.slot):place!==mount.place)return [];
   const seeker=PremiereWeapons.seeker(target)&&weapon.subType==='Character';
   const defense=seeker?4:laserGateRecord(target)?3:PremiereWeapons.defense(target,cardAbility(target),craftStats(target,entry.slot));
   const shot=seeker?PremiereWeapons.shot(weapon,mount.host,{...target,type:'Character'},cardAbility(mount.host),4):weaponShot(weapon,mount.host,target,defense);
   return shot&&shot.cost<=forceBudget(side)?[{...shot,...(seeker?{effect:'destroy'}:{}),weapon,host:mount.host,target,from:mount.slot,targetSlot:entry.slot}]:[];
  });
 }));
 return shots.flatMap((shot,shotIndex)=>{
  const special=side==='Light'?locationTitle(shot.host)==='han solo'?1:0:locationTitle(shot.host)==="urorrur'r'r"?2:0;
  return [0,...(special?[special]:[])].map(extra=>({card,rule,cost:0,shot:{...shot,extraDestiny:extra},args:[index,'controlFire',shotIndex,extra],weaponCost:shot.cost,
   label:card.name+' · '+shot.weapon.name+' → '+shot.target.name+' ('+shot.cost+' Force'+(extra?', +'+extra+' je Draw':'')+')'}));
 });
}
function dianogaHabitat(site){
 const loc=state?.locations?.[site];
 return !!loc&&isSite(loc)&&(sitePlanet(loc)==='dagobah'&&loc.locationTags?.includes('Exterior')||/trash compactor$/.test(locationTitle(loc))||PremiereLocations.effectsAt(state,site).some(effect=>locationEffectRule(effect.card)?.darkWaters));
}
function creatureHabitat(card,site){
 return hothEnabled()&&card.id==='Dark:2737'?isSite(state.locations[site])&&HothRules.onHoth(state.locations[site]):dianogaHabitat(site);
}
function creaturePrey(entry){
 return PremiereGame.sides.flatMap(side=>PremiereLocations.entries(state,side)).filter(target=>target.slot===entry.slot&&!target.carriers.length&&!target.card.imprisoned&&(!target.card.missing||hothEnabled())&&
  (target.card.type==='Character'&&!isDroid(target.card)||target.card.type==='Vehicle'&&target.card.subType==='Creature'));
}
function creatureActions(side){
 if(state.activeSide!==side||state.phase!==3||battleSession||state.creatureAttack)return [];
 const entries=PremiereGame.sides.flatMap(owner=>PremiereLocations.entries(state,owner)),actions=[];
 entries.filter(entry=>!entry.unavailable&&entry.card.type==='Creature').forEach((entry,index)=>{
  if(entry.side===side&&!(state.creatureAttacksThisTurn??[]).includes(entry.card)&&creaturePrey(entry).length)actions.push({card:entry.card,entry,site:entry.slot,cost:0,args:['creatureEat',index],label:entry.card.name+' · verpflichtenden Creature-Angriff beginnen'});
  if(state.attackedCreatureSitesThisTurn?.includes(entry.slot))return;
  const fighters=PremiereLocations.presentCards(state,side,entry.slot).filter(card=>['Character','Vehicle','Starship'].includes(card.type)&&PremiereUnits.active(card));
  if(fighters.length)actions.push({card:entry.card,entry,fighters,site:entry.slot,cost:0,args:['creatureHunt',index],label:entry.card.name+' mit eigenen Karten angreifen'});
 });return actions;
}
function offerMandatoryCreatureAttack(resume){
 if((state.game?.cardRulesVersion??0)<29)return false;
 const entry=PremiereLocations.entries(state,state.activeSide).find(entry=>!entry.unavailable&&entry.card.type==='Creature'&&!state.creatureAttacksThisTurn?.includes(entry.card)&&creaturePrey(entry).length);
 if(!entry)return false;offerCreatureTargetSide(entry,resume);return true;
}
function offerCreatureTargetSide(entry,resume){state.pendingCardView={mode:'creatureTargetSide',side:entry.side,card:entry.card,entry,resume,shown:[]};}
function startCreatureFight(entry,fighterSide,fighters,prey,resume){
 const attacking=!!prey;
 if(attacking)(state.creatureAttacksThisTurn??=[]).push(entry.card);else (state.attackedCreatureSitesThisTurn??=[]).push(entry.slot);
 state.creatureAttack={entry,creature:entry.card,fighterSide,fighters,prey,resume,attacking,priority:state.activeSide,passes:0,usedWeapons:[],hit:false};
 if(attacking&&hothEnabled()&&hothOpenCreatureReact())return;
 showCreature('creatureFight',state.activeSide);
}
function showCreature(mode,side){state.pendingCardView={mode,side,card:state.creatureAttack.creature,shown:[]};}
function creatureShots(side){
 const attack=state.creatureAttack;if(side!==attack.fighterSide)return [];
 const mounts=weaponMounts(side),inactive=PremiereLocations.entries(state,side).filter(entry=>attack.fighters.includes(entry.card)&&!mounts.some(mount=>mount.host===entry.card)).map(entry=>({host:entry.card,slot:entry.slot,place:PremiereLocations.physicalPlace(entry)}));
 return mounts.concat(inactive).flatMap(mount=>{
  const longRange=!attack.fighters.includes(mount.host);
  if(longRange&&!adjacentSites(mount.slot,attack.entry.slot))return [];
  return mountWeapons(mount).flatMap(weapon=>{
   if(hothEnabled()&&(weapon.hothWeaponBlocked||mount.host.crashed||mount.host.type==='Vehicle'&&!craftStats(mount.host,mount.slot).powered))return [];
   if(attack.usedWeapons.includes(weapon)||!PremiereUnits.canUseWeapon(state,mount.host,weapon)||longRange&&!PremiereWeapons.definition(weapon)?.adjacent)return [];
   const shot=weaponShot(weapon,mount.host,attack.creature,PremiereWeapons.defense(attack.creature,0));
   return shot&&shot.cost<=forceBudget(side)?[{...shot,weapon,host:mount.host,target:attack.creature,from:mount.slot,targetSlot:attack.entry.slot}]:[];
  });
 });
}
function creatureChoices(frame){
 if(frame.mode==='creatureTargetSide')return PremiereGame.sides.filter(side=>creaturePrey(frame.entry).some(entry=>entry.side===side)).map(side=>({args:[side],label:'Ziel zufällig auf '+side+'-Seite bestimmen'}));
 if(frame.mode==='creaturePower')return [{args:['draw'],label:'Attack Destiny ziehen'},{args:['skip'],label:'Ohne Attack Destiny fortsetzen'}];
 return creatureShots(frame.side).map((shot,index)=>({args:['fire',index],card:shot.weapon,label:shot.weapon.name+' → '+shot.target.name+' ('+shot.cost+' Force)'})).concat({args:['pass'],label:'Im Creature-Angriff passen'});
}
function finishCreatureChoice(frame,...args){
 if(frame.mode==='creatureTargetSide'){
  const pool=creaturePrey(frame.entry).filter(entry=>entry.side===args[0]),target=pool[Math.floor(PremiereGame.random(state.game)*pool.length)];
  state.pendingCardView=null;startCreatureFight(frame.entry,target.card.owner??target.card.side??target.side,[target.card],target,frame.resume);return true;
 }
 const attack=state.creatureAttack;
 if(frame.mode==='creaturePower'){state.pendingCardView=null;resolveCreaturePower(args[0]==='draw');return true;}
 if(args[0]==='fire'){
  const shot=creatureShots(frame.side)[args[1]];attack.usedWeapons.push(shot.weapon);attack.passes=0;state.pendingCardView=null;spendForce(frame.side,shot.cost);PremiereUnits.recordWeaponUse(state,shot.host,shot.weapon);
  drawDestinySeries(frame.side,'weapon',shot.draws,weaponDestinyModifier(frame.side,shot),draws=>{
   const value=PremiereBattle.total(draws);
   if(value!==null&&value+shot.bonus>shot.defense){
    if(shot.effect==='destroy'){loseTableCard(attack.entry.side,attack.entry.slot,attack.creature);finishCreatureAttack();return;}
    attack.hit=true;
   }
   showCreature('creatureFight',PremiereGame.otherSide(frame.side));
  });return true;
 }
 if(++attack.passes>=2){
  const ability=attack.fighters.reduce((sum,card)=>sum+(battleAbilityAt(card,attack.entry.slot)??0),0);
  if(ability>=4)showCreature('creaturePower',attack.fighterSide);else {state.pendingCardView=null;resolveCreaturePower(false);}
 }else showCreature('creatureFight',PremiereGame.otherSide(frame.side));
 return true;
}
function creaturePower(card,side,site){return ['Starship','Vehicle'].includes(card.type)?craftStats(card,site).power+cardPowerModifier(card,side,site):(card.power??0)+cardPowerModifier(card,side,site);}
function resolveCreaturePower(drawAttackDestiny){
 if(hothEnabled())return hothResolveCreaturePower(drawAttackDestiny);
 const attack=state.creatureAttack;
 const resolve=extra=>drawDestinySeries(attack.entry.side,'creatureFerocity',1,0,draws=>{
  const ferocity=(attack.creature.lastMealPower??0)+(draws[0]?.value??0),power=attack.fighters.reduce((sum,card)=>sum+Math.max(0,creaturePower(card,attack.fighterSide,attack.entry.slot)),0)+extra;
  const won=attack.attacking?ferocity>power:power>ferocity+5;
  log('Creature-Angriff · Ferocity '+ferocity+(attack.attacking?'':' + Abwehr 5')+' / Power '+power+'.');
  if(attack.attacking&&won){const target=PremiereLocations.findEntry(state,attack.prey.card);if(target){attack.creature.lastMealPower=creaturePower(target.card,attack.fighterSide,target.slot);loseTableCard(target.side,target.slot,target.card);}}
  if((!attack.attacking&&won)||attack.hit)loseTableCard(attack.entry.side,attack.entry.slot,attack.creature);
  finishCreatureAttack();
 });
 if(drawAttackDestiny)drawDestinySeries(attack.fighterSide,'attack',1,0,draws=>resolve(draws[0]?.value??0));else resolve(0);
}
function finishCreatureAttack(){const resume=state.creatureAttack?.resume;state.creatureAttack=null;state.pendingCardView=null;resume?.();}
function resolveCreatureClashes(){
 if(hothEnabled())return hothCreatureClashes();
 if(state.pendingCardView||state.creatureAttack||state.creatureClashInProgress||battleSession||PremiereGame.responseWindow(state.game))return;
 const entries=PremiereGame.sides.flatMap(side=>PremiereLocations.entries(state,side)).filter(entry=>entry.card.type==='Creature'&&!entry.unavailable);
 for(const entry of entries)if(!dianogaHabitat(entry.slot))loseTableCard(entry.side,entry.slot,entry.card);
 const group=entries.filter(entry=>dianogaHabitat(entry.slot)).find(entry=>entries.filter(other=>other.slot===entry.slot&&dianogaHabitat(other.slot)).length>1);
 if(!group)return;
 const pool=entries.filter(entry=>entry.slot===group.slot),a=pool.splice(Math.floor(PremiereGame.random(state.game)*pool.length),1)[0],b=pool[Math.floor(PremiereGame.random(state.game)*pool.length)];
 state.creatureClashInProgress=true;
 drawDestinySeries(a.side,'creatureFerocity',1,0,left=>drawDestinySeries(b.side,'creatureFerocity',1,0,right=>{
  const x=(a.card.lastMealPower??0)+(left[0]?.value??0),y=(b.card.lastMealPower??0)+(right[0]?.value??0);
  if(x<=y)loseTableCard(a.side,a.slot,a.card);if(y<=x)loseTableCard(b.side,b.slot,b.card);
  if(x>y)a.card.lastMealPower=y;if(y>x)b.card.lastMealPower=x;
  state.creatureClashInProgress=false;resolveCreatureClashes();
 }));
}

function expansionPromptChoice(offers){
 const frame=state?.pendingCardView;if(!frame||frame.side!==botSide()||(currentGame()?.cardRulesVersion??0)<29)return null;
 if(hothEnabled()&&frame.mode?.startsWith('hoth'))return hothPromptChoice(offers,frame);
 const find=(mode,index)=>offers.find(offer=>offer.args[0]===mode&&(index===undefined||offer.args[1]===index));
 if(['runSelectLight','runSelectDark'].includes(frame.mode)){
  const run=state.attackRun,pool=frame.mode==='runSelectLight'?runEligibleLight(run.system):runTies(run.system);
  const select=offers.find(offer=>offer.args[0]==='toggle'&&!run.selected.includes(offer.args[1]));return select??find('done');
 }
 if(frame.mode==='besiegedChoose')return offers.find(offer=>offer.args[0]==='toggle'&&!frame.selected.includes(offer.args[1]))??find('fight')??find('cancel');
 if(frame.mode==='squadronTransfer')return offers.find(offer=>['crew','weapon','device'].includes(offer.args[0]))??find('done');
 if(frame.mode==='hypoQuestion')return offers.find(offer=>offer.args[0]===(botSide()==='Dark'?'Light:1593':'Dark:634'))??offers[0];
 if(frame.mode==='runLead')return offers.slice().sort((a,b)=>pilotMaximum(b.card)-pilotMaximum(a.card))[0];
 if(frame.mode==='epicRoomChoice')return find('yes');
 if(frame.mode==='runPilot')return offers.slice().sort((a,b)=>b.args[0]-a.args[0])[0];
 if(frame.mode==='runCover'){
  if(frame.side==='Dark'){
   const shots=runWeaponOptions();const shot=offers.find(offer=>offer.args[0]==='fire'&&2.5*shots[offer.args[1]].draws+shots[offer.args[1]].bonus>shots[offer.args[1]].defense-1);if(shot)return shot;
  }
  const options=pileInterruptOptions(frame.side),interrupt=offers.find(offer=>offer.args[0]==='interrupt'&&['allClearRun','leaderKill'].includes(options[offer.args[1]]?.rule.mode));
  return interrupt??find('pass');
 }
 if(frame.mode==='creatureTargetSide')return find(playerSide())??offers[0];
 if(frame.mode==='creatureFight')return offers.find(offer=>offer.args[0]==='fire')??find('pass');
 if(frame.mode==='creaturePower')return find('draw');
 if(frame.mode==='goldRescue')return state.attackRun?.lead===frame.gold?find('decline'):find('sacrifice');
 if(frame.mode==='ignitionZ')return offers.slice().sort((a,b)=>b.args[0]-a.args[0])[0];
 return null;
}
function expansionBotValue(offer,view){
 const mode=offer.args[0],side=view.side,site=offer.site,to=offer.to,own=PremiereGame.zones(state,side),rival=PremiereGame.otherSide(side);
 switch(mode){
  case 'salt':return own.hand.length>3&&offer.args[2]==='hand'?0.7:offer.args[2]==='force'&&view.force>4?0.5:-1;
  case 'binary':{
   const allies=PremiereLocations.entries(state,side).filter(entry=>entry.slot===site&&!entry.unavailable&&entry.card.type==='Character'&&!isDroid(entry.card)).length;
   const enemies=PremiereLocations.entries(state,rival).filter(entry=>entry.slot===site&&!entry.unavailable&&entry.card.type==='Character'&&!isDroid(entry.card)).length;
   return offer.card.switchedOff?allies>enemies?1:-1:enemies>allies?1:-1;
  }
  case 'threat':return 2;
  case 'hide':return (view.sites[site]?.margin??0)<0?3:-1;
  case 'formSquadron':return 1.2;
  case 'vehicleSite':return 1;
  case 'mobileCrew':return offer.role==='driver'||offer.role==='pilot'?1:-1;
  case 'squad':return view.sites[to]?.rival?(view.sites[to].margin??0)>0?2:-1:!view.sites[to]?.own?2:-1;
  case 'shuttle':return offer.host&&offer.role==='pilot'?1:!view.sites[offer.args[3]]?.own?0.8:-1;
  case 'placeBluff':return PremiereLocations.control(state,side,site,cardAbility)===true?1:-1;
  case 'challengeBluff':return 0.5;
  case 'holoReturn':return own.hand.length<2?0.5:-1;
  case 'holoCancel':return 3;
  case 'laserGate':return 0.5;
  case 'hypo':return offer.args[3]==='drain'?1.5:0.5;
  case 'suction':return (offer.target.owner??offer.target.side)!==side?2:-1;
  case 'remote':return 0.5;
  case 'cancelSeeker':return 2;
  case 'spiceMines':return 2;
  case 'besieged':return offer.targets.reduce((sum,card)=>sum+(card.power??0),0)>tractorShipCrew(offer.record.ship).reduce((sum,card)=>sum+(card.power??0),0)?2:-1;
  case 'deployEpic':return 1;
  case 'dantooine':return 1;
  case 'chargeSuperlaser':return own.hand.some(card=>card.id==='Dark:508')&&view.force>2?0.5:-1;
  case 'primaryIgnition':return 2.5+planetSites('death star').length-offer.cost+ignitionBonus()>=7?3:-1;
  case 'attackRun':return runEligibleLight(offer.system).some(card=>pilotMaximum(card)+rebelBaseSize()>=7)?2:-1;
  case 'creatureEat':return 1;
  case 'creatureHunt':return offer.fighters.reduce((sum,card)=>sum+creaturePower(card,side,site),0)>(offer.card.lastMealPower??0)+7.5?1:-1;
  default:return -1;
 }
}

function chooseEpicRoom(event,resume){
 const rooms=[];
 for(const [site,loc] of state.locations.entries())for(const side of PremiereGame.sides){
  if(!loc||PremiereLocations.control(state,side,site,cardAbility)!==true)continue;
  for(const rule of PremiereLocations.rulesAt(state,site,side,'epicRoom'))if(rule.epic===event&&(!rule.leader||PremiereLocations.presentCards(state,side,site).some(card=>characterTraits(card).includes('leader'))))rooms.push({...rule,site,side});
 }
 const room=rooms.find(rule=>rule.optional),fixed=rooms.filter(rule=>!rule.optional).reduce((sum,rule)=>sum+rule.amount,0);
 if(!room){resume(fixed);return;}
 state.pendingCardView={mode:'epicRoomChoice',side:room.side,card:state.locations[room.site],room,fixed,resume,shown:[]};
}
