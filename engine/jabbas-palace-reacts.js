'use strict';
function jpReactBlocked(side,from,to){return jpAll(PremiereGame.otherSide(side),'Dark:594').some(e=>e.slot===to||e.slot===from);}
function jpNativeReact(card,side,site){const loc=state.locations[site];
 if(card.instanceId===state.jpForcedReactId)return true;
 if(card.id==='Light:2292')return true;
 if(card.id==='Light:962')return /jungle|forest/.test(jpTitle(loc));
 if(card.id==='Light:1449')return PremiereGame.sides.some(s=>ccPresent(s,site).some(c=>jpSpecies(c,'hutt')));
 if(card.id==='Dark:1802')return jpPalace(loc);
 if(jpPalace(loc)&&jpAll(side,'Dark:232').some(e=>jpPalace(state.locations[e.slot]))&&(jpSpecies(card,'gamorrean')||jpSpecies(card,'nikto')))return true;
 return false;
}
const jpReactBase={deploy:reactDeployOptions,move:reactOptions,transfer:transportOptions,roles:PremiereUnits.roles};
reactDeployOptions=function(side,window){const base=jpReactBase.deploy(side,window);if(!jpEnabled()||!window||!['battle','drain'].includes(window.kind)||window.side===side||window.cancelled)return base;
 if(jpReactBlocked(side,-1,window.site))return [];
 const own=jpOwn(side),out=base.slice();own.hand.forEach((card,index)=>{if(!jpNativeReact(card,side,window.site)||state.cancelledReactTitles?.includes(locationTitle(card)))return;const cost=boardDeployCost(card,state.locations[window.site],side);if(cost!==null&&!out.some(o=>o.card===card))out.push({card,index,site:window.site,cost,args:[index,-1],label:card.name+' als Deploy-React ('+cost+' Force)'});});
 own.hand.forEach((card,index)=>{if(card.id!=='Dark:1802'||sitePlanet(state.locations[window.site])!=='tatooine'||!withinDeploymentLimit(card,side))return;const cost=crewDeployCost(card,side,state.locations[window.site]);if(cost>forceBudget(side))return;for(const [hostIndex,host]of (own.board[window.site]??[]).entries())if(host.type==='Vehicle')for(const role of PremiereUnits.roles(host,card))out.push({card,index,site:window.site,cost,args:[index,-1,'crew',hostIndex,role],placement:'crew',item:host,label:card.name+' als React an Bord von '+host.name});});return out;
};
reactOptions=function(side,window){const base=jpReactBase.move(side,window);if(!jpEnabled()||!window||!['battle','drain'].includes(window.kind)||window.side===side||window.cancelled)return base;
 const out=base.filter(o=>!jpReactBlocked(side,o.from,window.site)),own=jpOwn(side);if(jpReactBlocked(side,-1,window.site))return [];
 own.board.forEach((row,from)=>row.forEach((card,index)=>{if(from===window.site||!PremiereUnits.active(card)||reactMovementUsed(card)||jpReactBlocked(side,from,window.site))return;const allowed=['Light:2274','Dark:2273'].includes(card.id)||card.id==='Light:1449'&&PremiereGame.sides.some(s=>ccPresent(s,window.site).some(c=>jpSpecies(c,'hutt')))||card.attachments?.some(d=>d.id==='Dark:1394'&&jpLive(d));if(!allowed)return;
  for(const movement of travelOptions(card,side,from,window.site,true))if(movement.cost<=forceBudget(side)&&!out.some(o=>o.card===card&&o.from===from&&o.to===window.site))out.push({card,from,to:window.site,index,cost:movement.cost,movement:movement.kind,label:card.name+' als React bewegen ('+movement.cost+' Force)'});
 }));return out;
};
ccResponseProviders.push((side,window)=>{
 if(!jpEnabled()||!['battle','drain'].includes(window.kind)||window.side===side||jpReactBlocked(side,-1,window.site))return [];const out=[],own=jpOwn(side),cz=jpAll(side,'Dark:594').find(e=>jpPalace(state.locations[window.site])&&(e.slot===window.site||adjacentSites(e.slot,window.site)));
 if(!cz||window.jpCZReactUsed)return out;for(const [i,card]of own.deck.entries())if(card.subType==='Alien'&&JabbasPalaceRules.nonunique(card)){const cost=boardDeployCost(card,state.locations[window.site],side);if(cost===null)continue;
  out.push(jpOption(cz.card,'czReact',[i],card.name+' aus Reserve als React deployen',()=>{own.deck.splice(own.deck.indexOf(card),1);own.hand.push(card);window.jpCZReactUsed=true;state.jpForcedReactId=card.instanceId;const result=initiateReactDeploy(side,own.hand.indexOf(card),-1);if(!result){own.hand.splice(own.hand.indexOf(card),1);own.deck.push(card);delete state.jpForcedReactId;}own.deck.splice(0,own.deck.length,...PremiereGame.shuffleReserve(own.deck,state.game));return result;},{cost,card,site:window.site}));
 }return out;
});
PremiereUnits.roles=function(host,card,...args){return jpEnabled()&&card?.id==='Light:183'?[]:jpReactBase.roles(host,card,...args);};
transportOptions=function(side){return jpReactBase.transfer(side).filter(o=>!jpEnabled()||o.card?.id!=='Light:183').map(o=>{
 if(!jpEnabled()||o.args[0]!=='deployAboard')return o;if(o.carrier?.id==='Dark:1362'&&o.card.subType==='Alien')return {...o,cost:Math.max(0,o.cost-1)};if(o.card.id==='Dark:2589'&&(o.carrier?.characteristics??[]).includes('independent'))return {...o,cost:0};return o;
});};
