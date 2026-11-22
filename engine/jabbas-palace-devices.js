'use strict';
function jpDeviceOptions(side){
 const out=[],own=jpOwn(side),all=jpUnits();if(!jpEnabled())return out;
 if(state.activeSide===side&&state.phase===2&&!battleSession)own.hand.forEach((card,index)=>{
  if(card.type!=='Device'||card.set!=='6'||!withinDeploymentLimit(card,side))return;const cost=card.id==='Dark:1394'?3:0;if(cost>forceBudget(side))return;
  all.forEach((e,i)=>{if(e.side!==side||e.unavailable||e.card.type!=='Character')return;const valid=card.id==='Dark:1394'?e.card.subType==='Alien'&&!ccPersona(e.card,'Boba Fett')&&!ccPersona(e.card,'Jabba'):PremiereUnits.rUnit(e.card);if(!valid)return;
   out.push(jpOption(card,'deviceDeploy',[index,i],e.card.name,()=>{spendForce(side,cost);own.hand.splice(own.hand.indexOf(card),1);ccInstallItem(side,card,e.card,e.slot,'device');openDeploymentReaction(side,[card]);return true;},{cost,host:e.card,site:e.slot}));
  });
 });
 if(state.activeSide===side&&state.phase===1&&!battleSession)for(const [i,e]of all.entries())if(e.side===side&&!e.unavailable&&jpLive(e.card)){
  const card=e.card,host=all.find(h=>h.card.attachments?.includes(card))?.card;if(!host)continue;
  if(card.id==='Light:1151'&&jpUnused(card,'holo')&&forceBudget(side)>=1&&own.deck.some(c=>jpHologram(c)))out.push(jpOnce(card,'holo',[i],'Hologramm/Dejarik aus Reserve nehmen',1,()=>{dagoSearch(side,card,'deck',jpHologram);return true;}));
  if(card.id==='Light:126'&&forceBudget(side)>=2)for(const [j,target]of all.entries())if(target.card.captured&&!target.card.imprisoned&&PremiereLocations.physicalPlace(target)===PremiereLocations.physicalPlace(e))out.push(jpOption(card,'weldRelease',[i,j],target.card.name+' aus Eskorte befreien (2 Force)',()=>{spendForce(side,2);return jpRelease(target.card,e.slot);},{cost:2}));
 }
 return out;
}
ccProviders.push(jpDeviceOptions);
const jpJetBase=travelOptions;
travelOptions=function(card,side,from,to,react=false){let out=jpJetBase(card,side,from,to,react);if(!jpEnabled()||!card.attachments?.some(d=>d.id==='Dark:1394'&&jpLive(d)))return out;
 if(groundReach(card,from,to,3)&&hothMovementAllowed(side,card,from,to,'Landspeed')&&!out.some(o=>o.kind==='Landspeed'))out.push({kind:'Landspeed',cost:react?2:1});return out.map(o=>react&&o.kind==='Landspeed'?{...o,cost:2}:o);
};
