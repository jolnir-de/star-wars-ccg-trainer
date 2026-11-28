'use strict';
function dagoLocationText(slot){const loc=state.locations[slot];return !!loc&&!loc.collapsed&&!loc.blownAway&&!PremiereUnits.textSuppressed(loc);}
function dagoLocationPlayer(slot,printedSide){return !dagoLocationText(slot)?null:PremiereLocations.printedSide(state,slot,printedSide);}
function dagoLocationActions(side){
 const out=[],own=dagoOwn(side),active=state.activeSide===side;
 if(!active||battleSession)return out;
 for(const [site,loc] of state.locations.entries()){
  if(!dagoLocationText(site))continue;
  const add=(mode,args,label,cost,resolve)=>{if(cost<=forceBudget(side))out.push(dagoOption(loc,mode,[site,...args],label,{site,cost,resolve(){spendForce(side,cost);return resolve();}}));};
  if(state.phase===2&&loc.id==='Light:597'&&side===dagoLocationPlayer(site,'Light')&&!PremiereGame.wasUsed(state.game,'turn','dagoSystemSite')&&own.deck.some(card=>isSite(card)&&DagobahRules.dagobah(card)))
   for(const card of own.deck.filter(card=>isSite(card)&&DagobahRules.dagobah(card)))for(const position of locationPositionsForCard(side,card))add('reserveSite',[card.id,position],card.name+' direkt deployen',0,()=>{own.deck.splice(own.deck.indexOf(card),1);PremiereGame.useOnce(state.game,'turn','dagoSystemSite');placeLocationCard(side,card,position);own.deck.splice(0,own.deck.length,...PremiereGame.shuffleReserve(own.deck,state.game));return true;});
  if(loc.id==='Light:602'&&side===dagoLocationPlayer(site,'Light')&&!PremiereGame.wasUsed(state.game,'turn','dagoTrainingArea:'+site)&&own.deck.some(DagobahRules.testNumber))add('trainingSearch',[],'Jedi-Test im Reserve Deck suchen',0,()=>{PremiereGame.useOnce(state.game,'turn','dagoTrainingArea:'+site);dagoSearch(side,loc,'deck',DagobahRules.testNumber);return true;});
  if(loc.id==='Light:2014'&&side===dagoLocationPlayer(site,'Dark')&&PremiereLocations.control(state,side,site,cardAbility)===true){const index=state.convertedLocations?.[site]?.findIndex(card=>card.id==='Dark:2013')??-1;if(index>=0)add('raiseRaithal',[index],'Eigenes Raithal anheben',0,()=>{hothRaiseLocation(site,index);return true;});}
 }
 return out;
}
const dagoLocationHooks={icons:PremiereLocations.icons,generation:forceFromLocations,drawModifier:hothDrawModifier,react:reactOptions,reactDeploy:reactDeployOptions,officer:officerShipReact,cost:battleInitiationCost,drain:drainPlan,actions:dagoActionOptions,timing:dagoCheckpoint,traits:characterTraits,forfeit:cardForfeitValueAt,power:cardPowerModifier};
PremiereLocations.icons=function(gameState,slot,side){
 const original=dagoLocationHooks.icons(gameState,slot,side);if(!dagobahEnabled()||gameState!==state||original===null)return original;
 const loc=state.locations[slot];
 if(loc?.id==='Dark:599'&&side===dagoLocationPlayer(slot,'Dark')&&PremiereLocations.presence(state,PremiereGame.otherSide(side),slot,cardAbility)===true)return 0;
 const sleens=dagoUnits().filter(entry=>entry.slot===slot&&!entry.unavailable&&dagoText(entry.card)&&dagoTitle(entry.card)===(side==='Light'?'sleen':'nudj')).length;
 return Math.max(0,original-sleens);
};
forceFromLocations=function(side){
 const result=dagoLocationHooks.generation(side);if(!dagobahEnabled())return result;
 for(const [slot,loc] of state.locations.entries()){
  if(!loc||loc.collapsed||loc.blownAway)continue;
  result.count+=(PremiereLocations.icons(state,slot,side)??0)-(dagoLocationHooks.icons(state,slot,side)??0);
  if(side===dagoLocationPlayer(slot,'Dark')&&['Light:598','Light:600'].includes(loc.id)&&PremiereLocations.occupy(state,side,slot,cardAbility)===true)result.count++;
  if(side===dagoLocationPlayer(slot,'Dark')&&loc.id==='Dark:910')for(const name of ['darth vader','emperor'])if(dagoUnits().some(entry=>entry.side===side&&!entry.unavailable&&dagoTitle(entry.card).includes(name)))result.count++;
  if(dagoEffects('Light:1808').some(effect=>effect.site===slot||adjacentSites(effect.site,slot))||PremiereLocations.presentCards(state,'Light',slot).some(card=>/^obi-wan/.test(dagoTitle(card)))&&dagoEffects('Light:1808').length){if(PremiereLocations.presence(state,side,slot,cardAbility)!==true)result.count-=PremiereLocations.icons(state,slot,side)??0;}
 }
 result.count+=dagoUnits().filter(entry=>entry.side===side&&!entry.unavailable&&entry.card.subType==='Jedi Master').length;result.count=Math.max(0,result.count);return result;
};
hothDrawModifier=function(side,card){
 let value=dagoLocationHooks.drawModifier(side,card);if(!dagobahEnabled())return value;
 if(card.type==='Character'&&squadTrooper(card,side))for(const [slot,loc] of state.locations.entries()){
  if(loc?.id==='Light:2014'&&side===dagoLocationPlayer(slot,'Dark')&&PremiereLocations.control(state,PremiereGame.otherSide(side),slot,cardAbility)===true)value--;
  if(loc?.id==='Dark:2013'&&side===dagoLocationPlayer(slot,'Dark')&&PremiereLocations.occupy(state,PremiereGame.otherSide(side),slot,cardAbility)!==true)value+=PremiereLocations.control(state,side,slot,cardAbility)===true?2:1;
 }
 if(card.id==='Dark:932'&&dagoUnits().some(entry=>entry.card.id==='Dark:1542'&&dagoText(entry.card)&&!entry.unavailable))value+=2;
 return value;
};
function dagoNemetBlocks(side,from,to){return dagoUnits().some(entry=>entry.side!==side&&entry.card.id==='Dark:501'&&!entry.unavailable&&dagoText(entry.card)&&(entry.slot===from||entry.slot===to));}
reactOptions=function(side,window){
 let options=dagoLocationHooks.react(side,window);if(!dagobahEnabled()||!window)return options;
 if(window.kind==='battle'&&side!==window.side){
  const own=dagoOwn(side);
  for(const [from,row] of own.board.entries())for(const [index,card] of row.entries()){
   if(reactMovementUsed(card)||!PremiereUnits.active(card))continue;
   const anoat=state.locations[window.site],isAnoat=['Light:113','Dark:112'].includes(anoat?.id)&&dagoLocationPlayer(window.site,anoat.side)===side;
   const nearest=dagoSectors(window.site)[0],away=isAnoat&&from===window.site;
   const targets=away&&nearest!==undefined?[nearest]:[window.site];
   const flagship=dagoEffects('Dark:951',side).some(effect=>effect.host!==card&&dagoEntry(effect.host)?.slot===window.site);
   const comm=state.locations.some((loc,slot)=>loc?.id==='Dark:907'&&dagoLocationText(slot)&&dagoSystemSlot(dagoEntry(dagoUnits().find(entry=>entry.card.id==='Dark:906')?.card)?.slot)===(side===dagoLocationPlayer(slot,'Dark')?window.site:from)&&(side===dagoLocationPlayer(slot,'Dark')?PremiereLocations.presentCards(state,side,slot).some(unit=>/tarkin|piett/.test(dagoTitle(unit))||characterTraits(unit).includes('admiral')):PremiereLocations.control(state,side,slot,cardAbility)===true));
   const zuckuss=card.id==='Dark:2912';
   const sectorArrival=isAnoat&&from===nearest;
   if(card.type==='Starship'&&(flagship||comm||away||sectorArrival)||zuckuss)for(const to of targets)for(const move of travelOptions(card,side,from,to,true)){
    const cost=flagship||zuckuss?0:move.cost;if(cost>forceBudget(side))continue;
    if(!options.some(option=>option.card===card&&option.from===from&&option.to===to))options.push({card,from,to,index,cost,movement:move.kind,away:to!==window.site,label:card.name+' · React → '+state.locations[to].name+' ('+cost+' Force)'});
   }
  }
 }
 return options.filter(option=>!dagoNemetBlocks(side,option.from,option.to));
};
reactDeployOptions=function(side,window){const options=dagoLocationHooks.reactDeploy(side,window);return !dagobahEnabled()?options:options.filter(option=>!dagoNemetBlocks(side,option.from,option.to??window.site));};
battleInitiationCost=function(slot){return dagoLocationHooks.cost(slot)+(dagobahEnabled()&&dagoEffects('Light:2741').length?1:0);};
drainPlan=function(side,slot){const plan=dagoLocationHooks.drain(side,slot);if(!plan||!dagobahEnabled())return plan;const cost=(plan.cost??0)+(dagoEffects('Light:2741').length?1:0);return cost>forceBudget(side)?null:{...plan,cost};};
dagoActionOptions=function(side){return dagoLocationHooks.actions(side).concat(dagobahEnabled()&&!state.pendingCardView&&!state.pendingForceLoss&&!PremiereGame.responseWindow(state.game)?dagoLocationActions(side):[]);};
characterTraits=function(card){const traits=dagoLocationHooks.traits(card);if(dagobahEnabled()&&card.attachments?.some(effect=>effect.id==='Dark:937'&&dagoText(effect))&&!traits.includes('leader'))return traits.concat('leader');return traits;};
cardForfeitValueAt=function(card,side,slot){if(dagobahEnabled()&&(card.dagobahNeuralUntil>=state.game.timing.turn||card.dagobahForfeitZeroTurn===state.game.timing.turn))return 0;return dagoLocationHooks.forfeit(card,side,slot);};
cardPowerModifier=function(card,side,slot,present){const value=dagoLocationHooks.power(card,side,slot,present);return dagobahEnabled()&&(card.dagobahMeditationUntil||card.dagobahNeuralUntil>=state.game.timing.turn)?-(card.power??0):value;};
