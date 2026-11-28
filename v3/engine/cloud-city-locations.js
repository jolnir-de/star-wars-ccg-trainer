'use strict';
const ccLocationSource=(slot,printedSide)=>dagoLocationText(slot)&&dagoLocationPlayer(slot,printedSide);
function ccBespinDeployModifier(card,loc,side){
 if(!['Character','Vehicle'].includes(card.type)||!CloudCityRules.city(loc)&&!CloudCityRules.sector(loc))return 0;
 let modifier=0;
 for(const [slot,system]of state.locations.entries())if(['Light:226','Dark:225'].includes(system?.id)&&dagoLocationText(slot)){
  const printed=system.side,own=ccLocationSource(slot,printed),other=ccLocationSource(slot,PremiereGame.otherSide(printed));
  if(own&&side!==own&&ccControl(own,slot))modifier++;
  if(other&&side===other&&ccControl(other,slot))modifier--;
 }return modifier;
}
function ccLocationDrain(side,slot){
 const loc=state.locations[slot];if(!dagoLocationText(slot))return 0;
 if(loc.id==='Light:438'&&side===ccLocationSource(slot,'Light'))return 1;
 if(['Light:459','Dark:458'].includes(loc.id)&&side===ccLocationSource(slot,loc.id==='Light:459'?'Dark':'Light'))return 1;
 if(loc.id==='Light:450'&&side===ccLocationSource(slot,'Dark')&&!ccPresent(side,slot).some(card=>CloudCityRules.clone(card)&&card.type==='Character'))return -1;
 if(['Dark:449','Dark:452','Light:448'].includes(loc.id)&&side===ccLocationSource(slot,loc.id==='Light:448'?'Dark':'Light'))return -1;
 if(['Light:464','Dark:463'].includes(loc.id)&&side===ccLocationSource(slot,PremiereGame.otherSide(loc.side)))return 1;
 return 0;
}
function ccCloudDrainSource(side,source,site){
 const cloud=state.locations[source];return CloudCityRules.cloud(cloud)&&!CloudCityRules.sector(cloud)&&side===ccLocationSource(source,cloud.side)&&ccControl(side,source)&&ccPlanet(cloud)===ccPlanet(state.locations[site])&&isSite(state.locations[site])&&!ccUsed(cloud,'drainBoost');
}
function ccLocationOptions(side){
 const out=[],own=ccOwn(side);if(state.activeSide!==side||battleSession)return out;
 state.locations.forEach((loc,site)=>{
  if(!loc||!dagoLocationText(site))return;
  if(state.phase===1&&['Light:450','Dark:449'].includes(loc.id)&&side===ccLocationSource(site,loc.side)&&!ccUsed(loc,'retrieveDroid','phase')&&forceBudget(side)>=(loc.id==='Light:450'?3:2)&&
   (loc.id==='Light:450'?PremiereLocations.occupy(state,side,site,cardAbility)===true:ccControl(side,site)))for(const [i,droid]of own.lost.entries())if(isDroid(droid))out.push(ccOnceAction(loc,'retrieveDroid',[site,i],droid.name+' auf Used zurückholen',loc.id==='Light:450'?3:2,()=>{own.lost.splice(own.lost.indexOf(droid),1);own.used.push(droid);ccMark(loc,'retrieveDroid','phase');return true;},{site}));
  if(loc.id==='Dark:457'&&side===ccLocationSource(site,'Dark')&&!ccUsed(loc,'lando','game')&&own.deck.some(card=>ccPersona(card,'Lando')))out.push(ccOption(loc,'securityLando',[site],'Lando im Reserve Deck suchen',()=>{ccMark(loc,'lando','game');dagoSearch(side,loc,'deck',card=>ccPersona(card,'Lando'));return true;},{site}));
  if(loc.id==='Dark:457'&&side===ccLocationSource(site,'Light')&&state.phase===1&&ccControl(side,site)&&!state.drainedSitesThisTurn?.includes(site))for(const [i,entry]of ccUnits().entries())if(entry.slot===site&&entry.card.captured&&PremiereLocations.physicalPlace(entry)===site)out.push(ccOption(loc,'securityRelease',[site,i],entry.card.name+' statt Force Drain befreien',()=>{if(!detachTableCard(entry.side,site,entry.card))return false;rallyCaptive(entry.card,site);(state.drainedSitesThisTurn??=[]).push(site);return true;},{site,target:entry.card}));
  if(state.phase===1)state.locations.forEach((target,to)=>{if(ccCloudDrainSource(side,site,to)&&drainPlan(side,to)&&!(state.cloudCityDrainBoost?.side===side&&state.cloudCityDrainBoost.site===to&&state.cloudCityDrainBoost.source===site))out.push(ccOption(loc,'chooseCloudDrain',[site,to],'+1 Force Drain bei '+target.name,()=>{state.cloudCityDrainBoost={side,source:site,site:to,turn:state.game.timing.turn};return true;},{site:to,source:site}));});
  if(state.phase===4&&['Light:459','Dark:458'].includes(loc.id)&&side===ccLocationSource(site,loc.side))for(const [index,entry]of ccUnits().entries())if(entry.side===side&&!entry.unavailable&&['Character','Vehicle'].includes(entry.card.type)&&PremiereLocations.presentAt(entry,entry.slot)&&!regularMovementUsed(entry.card))state.locations.forEach((target,to)=>{
   if(entry.slot!==site&&to!==site||entry.slot===to||!CloudCityRules.city(state.locations[entry.slot])||!CloudCityRules.city(target)||!dagoRelocationAllowed(side,entry.card,entry.slot,to,'locationText'))return;
   out.push(ccOption(loc,'upperCorridor',[site,index,to],entry.card.name+' → '+target.name,()=>{detachTableCard(side,entry.slot,entry.card);own.board[to].push(entry.card);(state.movedThisTurn??=[]).push(entry.card);return true;},{site:to,target:entry.card,from:entry.slot,to}));
  });
 });return out;
}
ccProviders.push(ccLocationOptions);
const ccLocationBase={charCost:characterDeployCost,craftCost:craftDeployCost,power:cardPowerModifier,total:hothBattlePower,drain:forceDrainEffects,resolve:resolveForceDrain,transit:PremiereLocations.conditions,generation:forceFromLocations};
characterDeployCost=function(card,loc,side){const cost=ccLocationBase.charCost(card,loc,side);if(cost===null||!cloudCityEnabled())return cost;const site=state.locations.indexOf(loc);return Math.max(0,cost+ccBespinDeployModifier(card,loc,side)-(loc?.id==='Light:448'&&side===ccLocationSource(site,'Light')&&ccPersona(card,'Leia')?2:0));};
craftDeployCost=function(card,loc,side,...args){const cost=ccLocationBase.craftCost(card,loc,side,...args);return cost===null||!cloudCityEnabled()?cost:Math.max(0,cost+ccBespinDeployModifier(card,loc,side));};
cardPowerModifier=function(card,side,slot,present){let value=ccLocationBase.power(card,side,slot,present);const loc=state.locations[slot];if(cloudCityEnabled()&&['Light:453','Dark:452'].includes(loc?.id)&&side===ccLocationSource(slot,loc.side)&&card.type==='Character'&&ownLightsaber(card))value+=2;return value;};
hothBattlePower=function(side,slot){let value=ccLocationBase.total(side,slot);if(cloudCityEnabled()&&CloudCityRules.city(state.locations[slot]))for(const [source,loc]of state.locations.entries())if(CloudCityRules.sector(loc)&&dagoLocationText(source)&&ccControl(side,source))value+=ccPresent(side,source).filter(card=>['Vehicle','Starship'].includes(card.type)).length;return value;};
forceDrainEffects=function(side,slot){const plan=ccLocationBase.drain(side,slot);if(!plan||!cloudCityEnabled())return plan;let modifier=ccLocationDrain(side,slot);const chosen=state.cloudCityDrainBoost;
 if(dagoCompleted(PremiereGame.otherSide(side),1))modifier=Math.min(0,modifier);
 else if(chosen?.side===side&&chosen.site===slot&&chosen.turn===state.game.timing.turn&&ccCloudDrainSource(side,chosen.source,slot))modifier++;
 return {...plan,modifier:plan.modifier+modifier};
};
resolveForceDrain=function(side,slot,...args){const chosen=state.cloudCityDrainBoost,apply=cloudCityEnabled()&&chosen?.side===side&&chosen.site===slot&&chosen.turn===state.game.timing.turn&&ccCloudDrainSource(side,chosen.source,slot);ccLocationBase.resolve(side,slot,...args);if(apply){ccMark(state.locations[chosen.source],'drainBoost');delete state.cloudCityDrainBoost;}};
PremiereLocations.conditions=function(gameState,slot,side){const value=ccLocationBase.transit(gameState,slot,side),loc=gameState.locations[slot];if(cloudCityEnabled()&&gameState===state&&['Light:455','Dark:447'].includes(loc?.id)&&dagoLocationText(slot))return {...value,dockingBay:true,transitCost:side===ccLocationSource(slot,loc.side)?1:2};return value;};
