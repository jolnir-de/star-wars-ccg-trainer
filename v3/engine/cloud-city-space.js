'use strict';
function ccPlanet(loc){return loc?.cloudCityPlanet??(CloudCityRules.city(loc)||CloudCityRules.sector(loc)?'bespin':isPlanetSystem(loc)?ccTitle(loc):sitePlanet(loc));}
function ccClouds(planet){return boardLocationOrder().filter(slot=>CloudCityRules.cloud(state.locations[slot])&&ccPlanet(state.locations[slot])===planet&&!state.locations[slot].blownAway);}
function ccSectorDeployOptions(side){
 if(state.activeSide!==side||state.phase!==2||battleSession)return [];
 const out=[],own=ccOwn(side),order=boardLocationOrder();
 own.hand.forEach((card,index)=>{
  if(!CloudCityRules.cloud(card)||!withinDeploymentLimit(card,side))return;
  const planets=CloudCityRules.sector(card)?['bespin']:state.locations.filter(isPlanetSystem).filter(loc=>!loc.blownAway).map(ccTitle);
  for(const planet of planets){
   const system=state.locations.findIndex(loc=>isPlanetSystem(loc)&&ccTitle(loc)===planet),clouds=ccClouds(planet);
   if(state.locations.some(loc=>loc?.blownAway&&isSystem(loc)&&ccTitle(loc)===planet))continue;
   if(clouds.filter(slot=>ccTitle(state.locations[slot])===ccTitle(card)).length>=(card.genericLimit??1))continue;
   const citySector=clouds.find(slot=>CloudCityRules.sector(state.locations[slot]));
   const anchors=(CloudCityRules.sector(card)?[clouds[0]??system]:[...clouds,system]).filter(slot=>Number.isInteger(slot)&&slot>=0);
   const positions=anchors.length?anchors.map(slot=>order.indexOf(slot)+(CloudCityRules.sector(card)?0:slot===system?0:1)):[order.length];
   for(const position of new Set(positions)){
    if(citySector!==undefined&&!CloudCityRules.sector(card)&&position<=order.indexOf(citySector))continue;
    out.push(ccOption(card,'cloudDeploy',[index,planet,position],planet+' · Position '+(position+1),()=>{
     own.hand.splice(own.hand.indexOf(card),1);card.cloudCityPlanet=planet;return placeLocationCard(side,card,position);
    },{site:system}));
   }
  }
 });return out;
}
ccProviders.push(ccSectorDeployOptions);
function ccCloudTravel(card,side,from,to,react,next){
 const a=state.locations[from],b=state.locations[to],ac=CloudCityRules.cloud(a),bc=CloudCityRules.cloud(b);
 const planet=ccPlanet(ac?a:bc?b:a),clouds=ccClouds(planet);
 if(!ac&&!bc){
  const options=next();
  if(clouds.length&&ccPlanet(a)===ccPlanet(b)&&options.some(move=>/Landen|Starten/.test(move.kind)))return options.filter(move=>!/Landen|Starten/.test(move.kind));
  return options;
 }
 if(from===to||!a||!b||!CloudCityRules.cloudCapable(card)||!PremiereUnits.active(card)||movementPrevented(card)||card.searchPartyTurn===state.game.timing.turn||card.crashed||card.attachments?.some(item=>item.id==='Dark:990'&&!PremiereUnits.textSuppressed(item))||!dagoMoveAllowed(side,card,from,to)||!hothMovementAllowed(side,card,from,to,react?'react':'regular')||!craftStats(card,from,true).powered)return [];
 if(ac&&bc){const distance=Math.abs(clouds.indexOf(from)-clouds.indexOf(to));return ccPlanet(a)===ccPlanet(b)&&distance>0&&distance<=2?[{kind:'Wolkensektor',cost:1}]:[];}
 const cloud=ac?from:to,other=ac?b:a;
 if(isPlanetSystem(other)&&ccTitle(other)===planet&&clouds.at(-1)===cloud&&CloudCityRules.fighter(card))return [{kind:'Wolkensektor',cost:1}];
 if(isExteriorPlanetSite(other)&&ccPlanet(other)===planet&&clouds[0]===cloud&&(!PremiereUnits.tie(card)||PremiereLocations.conditions(state,ac?to:from,side).dockingBay))return [{kind:ac?'Landen':'Starten',cost:1}];
 return [];
}
const ccSpaceBase={travel:travelOptions,deploy:boardDeployCost,craftCost:craftDeployCost,stats:craftStats,group:locationGroup,planet:sitePlanet,sectors:dagoSectors,timing:dagoSpaceTiming,positions:locationPositionsForCard,system:dagoSystemSlot,transport:transportOptions,exterior:isExteriorPlanetSite};
isExteriorPlanetSite=function(card){return cloudCityEnabled()&&CloudCityRules.city(card)&&card.locationTags?.includes('Exterior')||ccSpaceBase.exterior(card);};
travelOptions=function(card,side,from,to,react=false){if(!cloudCityEnabled()||!CloudCityRules.cloud(state.locations[from])&&!CloudCityRules.cloud(state.locations[to]))return cloudCityEnabled()?ccCloudTravel(card,side,from,to,react,()=>ccSpaceBase.travel(card,side,from,to,react)):ccSpaceBase.travel(card,side,from,to,react);
 const free=card.occupants?.some(entry=>entry.role==='pilot'&&entry.card.id==='Dark:492'&&ccText(entry.card));
 return ccCloudTravel(card,side,from,to,react,()=>[]).filter(option=>dagoMoveAllowed(side,card,from,to,option.kind)&&HothRules.canTravel(state,side,from,to,option.kind)).map(option=>({...option,cost:free?0:option.cost+Number(!!state.locations[from]?.collapsed)+Number(!!state.locations[to]?.collapsed)}));};
sitePlanet=function(card){return cloudCityEnabled()&&CloudCityRules.city(card)?'bespin':ccSpaceBase.planet(card);};
locationGroup=function(card){return cloudCityEnabled()&&(CloudCityRules.city(card)||CloudCityRules.cloud(card))?ccPlanet(card):ccSpaceBase.group(card);};
dagoSystemSlot=function(slot){return cloudCityEnabled()&&(CloudCityRules.city(state.locations[slot])||CloudCityRules.cloud(state.locations[slot]))?state.locations.findIndex(loc=>isPlanetSystem(loc)&&ccTitle(loc)===ccPlanet(state.locations[slot])):ccSpaceBase.system(slot);};
dagoSectors=function(system){return ccSpaceBase.sectors(system).filter(slot=>!cloudCityEnabled()||!CloudCityRules.cloud(state.locations[slot]));};
locationPositionsForCard=function(side,card){return cloudCityEnabled()&&CloudCityRules.cloud(card)?[]:ccSpaceBase.positions(side,card);};
craftDeployCost=function(card,loc,side,pilot=null){
 if(!cloudCityEnabled())return ccSpaceBase.craftCost(card,loc,side,pilot);
 if(CloudCityRules.cloud(loc)){
  if(!CloudCityRules.cloudCapable(card))return null;
  if(card.type==='Vehicle')return Number.isFinite(card.deploy)?Math.max(0,card.deploy+(pilot?crewDeployCost(pilot,side,loc):0)):null;
 }
 const cost=ccSpaceBase.craftCost(card,loc,side,pilot);return cost===null?null:Math.max(0,cost-(CloudCityRules.cloud(loc)&&['Dark:1817','Dark:1818'].includes(card.id)?1:0));
};
boardDeployCost=function(card,loc,side,free=false){
 if(!cloudCityEnabled()||!CloudCityRules.cloud(loc))return ccSpaceBase.deploy(card,loc,side,free);
 if(!CloudCityRules.cloudCapable(card)||(card.owner??card.side)!==side||!hasDeployPresence(side,loc)||!withinDeploymentLimit(card,side))return null;
 const cost=craftDeployCost(card,loc,side);return cost!==null&&(free||cost<=forceBudget(side))?free?0:cost:null;
};
craftStats=function(card,slot,...args){
 const stats=ccSpaceBase.stats(card,slot,...args);if(!cloudCityEnabled())return stats;
 const loc=state.locations[slot];if(CloudCityRules.cloud(loc)){
  if(CloudCityRules.car(card)&&ccText(card))stats.power++;
  if(['Dark:1817','Dark:1818'].includes(card.id)&&ccText(card))stats.power+=3;
  if(['Light:464','Dark:463'].includes(loc.id)&&dagoLocationText(slot)&&card.type==='Starship'){stats.power=Math.max(0,stats.power-2);if(Number.isFinite(stats.maneuver))stats.maneuver=Math.max(0,stats.maneuver-2);}
 }return stats;
};
transportOptions=function(side){return ccSpaceBase.transport(side).map(option=>{
 if(!cloudCityEnabled()||!['shuttleUp','shuttleDown'].includes(option.args[0]))return option;
 const planet=ccPlanet(state.locations[option.from]),amount=ccClouds(planet).length;
 const free=[option.from,option.to].some(slot=>ccUnits().some(entry=>entry.side===side&&entry.slot===slot&&!entry.unavailable&&ccOn(entry.card,'Dark:492')));
 return {...option,cost:free?0:option.cost+amount};
}).filter(option=>option.cost<=forceBudget(side));};
