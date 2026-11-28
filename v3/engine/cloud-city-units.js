'use strict';
const ccTrooper=card=>card?.characteristics?.includes('Cloud City trooper')||['Light:436','Dark:435','Light:2640','Dark:2637'].includes(card?.id);
const ccCityCount=side=>state.locations.reduce((sum,loc,slot)=>sum+Number((CloudCityRules.city(loc)||CloudCityRules.sector(loc))&&ccControl(side,slot)),0);
function ccCharacterDeployAllowed(card,loc,side){
 const region=ccPlanet(loc),city=CloudCityRules.city(loc);
 if(['Light:436','Dark:435','Light:2640','Dark:2637','Dark:1465'].includes(card.id))return city;
 if(card.id==='Light:1943')return city||region==='hoth';
 if(card.id==='Light:360')return city||region==='hoth'||isSystem(loc)&&ccUnits().some(entry=>entry.side===side&&entry.slot===state.locations.indexOf(loc)&&ccPersona(entry.card,'Falcon'));
 if(card.id==='Light:1562')return !!state.cloudCityReactDeploy;
 if(card.id==='Dark:1287')return /^executor:|^death star:/.test(ccTitle(loc))||isSystem(loc)&&ccUnits().some(entry=>entry.side===side&&entry.slot===state.locations.indexOf(loc)&&entry.card.id==='Dark:906');
 return true;
}
const ccUnitsBase={allowed:characterLocationAllowed,cost:characterDeployCost,crewCost:crewDeployCost,power:cardPowerModifier,stats:craftStats,immunity:battleImmunity,forfeit:cardForfeitValueAt,draws:battleDestinyDrawCount,move:movementRestriction,total:hothBattlePower,loss:beginForceLoss,transport:transportOptions};
characterLocationAllowed=function(card,loc){return (!cloudCityEnabled()||ccCharacterDeployAllowed(card,loc,ccOwner(card)))&&ccUnitsBase.allowed(card,loc);};
characterDeployCost=function(card,loc,side){
 const cost=ccUnitsBase.cost(card,loc,side);if(cost===null||!cloudCityEnabled())return cost;
 const slot=state.locations.indexOf(loc);let value=cost;
 if(CloudCityRules.city(loc)){
  if(ccTrooper(card)&&ccAt(side,slot,'Light:1562'))return 0;
  if(card.id==='Light:2640'&&ccPresent(side,slot).some(unit=>ccPersona(unit,'Lando')))return 0;
  if(['Light:2592','Dark:2591'].includes(card.id)&&ccEffects('Light:217',side).length)return 0;
  if(card.id==='Dark:2662'&&ccAt(side,slot,'Dark:430'))value--;
 }
 if(card.id==='Dark:1522'&&/^executor:/.test(ccTitle(loc)))return 0;
 return Math.max(0,value);
};
cardPowerModifier=function(card,side,slot,present){
 let value=ccUnitsBase.power(card,side,slot,present);if(!cloudCityEnabled()||!ccText(card))return value;
 const loc=state.locations[slot],chars=ccPresent(side,slot);
 if(['Light:436','Dark:435'].includes(card.id)&&isSite(loc)&&!CloudCityRules.city(loc))value--;
 if(card.id==='Light:1466')value+=ccCityCount(side);
 if(card.id==='Light:1562'&&PremiereLocations.conditions(state,slot,side).scompLink)value+=2;
 if(ccTrooper(card)&&CloudCityRules.city(loc)&&ccAt(side,slot,'Light:1562'))value++;
 if(card.id==='Light:2640'&&battleSession?.initiator&&battleSession.initiator!==side&&battleSession.site===slot)value+=2;
 if(card.id==='Dark:2637'&&battleSession?.initiator===side&&battleSession.site===slot)value+=2;
 if(card.id==='Dark:1522'&&state.besiegedBattle?.cards.includes(card))value+=3;
 if(card.id==='Light:2810'&&chars.some(unit=>ccPersona(unit,'Zutton')))value++;
 if(card.id==='Dark:2661'&&/trash compactor|droid junkheap|incinerator|carbonite chamber/.test(ccTitle(loc)))value+=2;
 return value;
};
hothBattlePower=function(side,slot){let value=ccUnitsBase.total(side,slot);if(!cloudCityEnabled())return value;
 const other=PremiereGame.otherSide(side);
 if(ccAt(other,slot,'Light:1562')&&PremiereLocations.conditions(state,slot,other).scompLink)value-=2;
 if(ccAt(side,slot,'Dark:801'))value+=Math.min(ccPresent(side,slot).filter(card=>card.subType==='Alien').length,ccPresent(side,slot).filter(card=>card.subType==='Imperial').length);
 return value;
};
craftStats=function(card,slot,...args){const stats=ccUnitsBase.stats(card,slot,...args);if(!cloudCityEnabled())return stats;
 if(ccPersona(card,'Falcon')&&card.occupants?.some(entry=>entry.role==='pilot'&&ccOn(entry.card,'Light:1466')))stats.power++;
 return stats;
};
battleImmunity=function(side,card,slot,...args){let value=ccUnitsBase.immunity(side,card,slot,...args);if(!cloudCityEnabled()||!ccText(card))return value;
 if(['Dark:287','Light:1943'].includes(card.id))value=Math.max(value,3);
 if(card.id==='Dark:1537'&&ccCaptives(card).length)value=Math.max(value,4);
 if(card.id==='Dark:2278'&&card.occupants?.some(entry=>entry.role==='pilot'&&ccOn(entry.card,'Dark:287')))value=Math.max(value,5);
 return value;
};
cardForfeitValueAt=function(card,side,slot,...args){let value=ccUnitsBase.forfeit(card,side,slot,...args);if(!cloudCityEnabled()||!Number.isFinite(value))return value;
 const escort=ccUnits().find(entry=>ccCaptives(entry.card).includes(card))?.card;
 if(ccOn(escort,'Dark:287'))value+=5;if(ccOn(escort,'Dark:1537'))value+=2;
 if(ccTrooper(card)&&card.id!=='Light:2640'&&ccAt(side,slot,'Light:2640'))value+=2;
 if(card.type==='Character'&&CloudCityRules.clone(card)&&card.id!=='Dark:2661'&&ccAt(side,slot,'Dark:2661'))value+=2;
 return value;
};
battleDestinyDrawCount=function(side,slot,...args){const count=ccUnitsBase.draws(side,slot,...args);if(count||!cloudCityEnabled())return count;
 return battleCandidates(side,slot).some(ship=>ship.id==='Dark:2278'&&ship.occupants?.some(entry=>entry.role==='pilot'&&ccOn(entry.card,'Dark:287')))?1:0;
};
movementRestriction=function(card,...args){return cloudCityEnabled()&&ccOn(card,'Dark:1287')?'Dainsom darf sich nicht bewegen.':ccUnitsBase.move(card,...args);};
transportOptions=function(side){return ccUnitsBase.transport(side).filter(option=>{
 if(!cloudCityEnabled()||option.args[0]!=='deployAboard')return true;
 if(option.card.id==='Dark:1287')return option.carrier.id==='Dark:906'||/^death star:/.test(ccTitle(state.locations[option.to]));
 if(option.card.id==='Light:360')return ccPersona(option.carrier,'Falcon')||ccPlanet(state.locations[option.to])==='hoth'||CloudCityRules.city(state.locations[option.to]);
 return true;
});};
beginForceLoss=function(side,amount,terms){
 if(cloudCityEnabled()&&terms.reason==='drain'&&CloudCityRules.cloud(state.locations[terms.locationIndex])){
  const actor=PremiereGame.otherSide(side),planet=ccPlanet(state.locations[terms.locationIndex]);
  if(ccUnits().some(entry=>entry.side===actor&&!entry.unavailable&&ccOn(entry.card,'Light:1419')&&isSite(state.locations[entry.slot])&&ccPlanet(state.locations[entry.slot])===planet))terms={...terms,from:'deck'};
 }
 return ccUnitsBase.loss(side,amount,terms);
};
ccResponseProviders.push((side,window)=>{
 const out=[],other=PremiereGame.otherSide(side);
 if(window.kind==='drain'&&window.side===other)for(const [index,entry]of ccUnits().entries())if(entry.side===side&&!entry.unavailable&&ccOn(entry.card,'Dark:1287')&&adjacentSites(entry.slot,window.site)&&/^death star:|^executor:/.test(ccTitle(state.locations[window.site])))out.push(ccOption(entry.card,'guardDrain',[index],'Force Drain aufheben',()=>{PremiereGame.cancelResponse(state.game,window);ccAnswer(side,window);return true;}));
 if(window.kind==='destiny'&&window.side===other&&battleSession&&forceBudget(side)>=2&&!battleSession.cloudCityHanRerolls?.length)for(const [index,entry]of ccUnits().entries())if(entry.side===side&&!entry.unavailable&&ccOn(entry.card,'Light:360')&&battleSession.participants[side].some(card=>card===entry.card||entry.carriers.includes(card)))out.push(ccOption(entry.card,'hanRedraw',[index],'Gegnerische Destiny neu ziehen lassen',()=>{spendForce(side,2);(battleSession.cloudCityHanRerolls??=[]).push(entry.card.instanceId);window.draw.cancelled=true;window.redraw=true;ccAnswer(side,window);return true;},{cost:2}));
 return out;
});
