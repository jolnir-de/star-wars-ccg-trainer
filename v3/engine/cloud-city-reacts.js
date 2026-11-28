'use strict';
function ccWrist(side,site){return CloudCityRules.city(state.locations[site])&&ccPresent(side,site).some(host=>host.attachments?.some(card=>card.id==='Light:1476'&&ccText(card)));}
function ccNativeReact(card,side,site){const loc=state.locations[site];
 if(CloudCityRules.car(card))return CloudCityRules.cloud(loc);
 if(card.id==='Light:1562')return CloudCityRules.city(loc)||ccPresent(side,site).some(unit=>ccPersona(unit,'Lando'));
 if(card.id==='Light:1943')return ['hoth','bespin'].includes(ccPlanet(loc))&&isSite(loc)&&ccPresent(side,site).some(unit=>ccPersona(unit,'Han')||ccPersona(unit,'Luke'));
 if(card.id==='Dark:2278')return true;
 if(card.id==='Dark:293')return true;
 if((card.id==='Light:1562'||ccTrooper(card))&&ccWrist(side,site))return true;
 return loc?.id==='Dark:444'&&side===ccLocationSource(site,'Dark')&&dagoLocationText(site)&&(card.type==='Character'||card.type==='Weapon'&&card.subType==='Character');
}
const ccReactBase={deploy:reactDeployOptions,moves:reactOptions,settle:resolveResponsePass};
reactDeployOptions=function(side,window){
 const base=ccReactBase.deploy(side,window);if(!cloudCityEnabled()||!window||window.cancelled||!['battle','drain'].includes(window.kind)||window.side===side)return base;
 const out=[],loc=state.locations[window.site],own=ccOwn(side);state.cloudCityReactDeploy=true;
 try{own.hand.forEach((card,index)=>{
  if(!ccNativeReact(card,side,window.site)||state.cancelledReactTitles?.includes(locationTitle(card)))return;
  if(card.type==='Weapon'){for(const mount of weaponPlacementOptions(side,card,window.site))out.push({card,index,site:window.site,cost:mount.cost,args:[index,-1,mount.hostIndex],mount:mount.mount,discount:mount.discount,label:card.name+' an '+mount.host.name+' als Deploy-React'});return;}
  if(card.id!=='Dark:2278'){const cost=boardDeployCost(card,loc,side);if(cost!==null)out.push({card,index,site:window.site,cost,args:[index,-1],label:card.name+' als Deploy-React ('+cost+' Force)'});}
  for(const pilot of deployPilotOptions(side,index,window.site))out.push({card,index,site:window.site,pilot:pilot.pilot,cost:pilot.cost,args:[index,pilot.index],label:card.name+' mit '+pilot.pilot.name+' als Deploy-React'});
 });}finally{delete state.cloudCityReactDeploy;}
 return base.concat(out.filter(option=>!base.some(old=>JSON.stringify(old.args)===JSON.stringify(option.args))));
};
reactOptions=function(side,window){
 const base=ccReactBase.moves(side,window);if(!cloudCityEnabled()||!window||window.cancelled||!['battle','drain'].includes(window.kind)||window.side===side)return base;
 const out=[],site=window.site;
 ccOwn(side).board.forEach((row,from)=>row.forEach((card,index)=>{
  if(from===site||reactMovementUsed(card)||!PremiereUnits.active(card))return;
  const wrist=ccWrist(side,site)&&(card.id==='Light:1562'||ccTrooper(card));
  const leia=card.id==='Light:1943'&&ccPresent(side,site).some(unit=>ccPersona(unit,'Han')||ccPersona(unit,'Luke'));
  if(!wrist&&!leia)return;
  for(const movement of travelOptions(card,side,from,site,true))if(movement.cost<=forceBudget(side))out.push({card,from,to:site,index,cost:movement.cost,movement:movement.kind,label:card.name+' als React bewegen ('+movement.cost+' Force)'});
 }));return base.concat(out);
};
// The normal react frame still resolves deployment, cancellation, costs and pilots.
resolveResponsePass=function(...args){if(!cloudCityEnabled())return ccReactBase.settle(...args);state.cloudCityReactDeploy=true;try{return ccReactBase.settle(...args);}finally{delete state.cloudCityReactDeploy;}};
