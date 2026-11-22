'use strict';
function ccSiteOrderValid(slots){const bays=slots.filter(slot=>PremiereLocations.conditions(state,slot,'Light').dockingBay);return bays.length<=2&&bays.every(slot=>slot===slots[0]||slot===slots.at(-1));}
const ccLayoutBase={positions:locationPositionsForCard,initial:initialLocationOrder,canDeploy:dagoCanDeploy,movesLike:dagoMovesLikeFighter};
locationPositionsForCard=function(side,card){
 if(!cloudCityEnabled()||!CloudCityRules.city(card))return ccLayoutBase.positions(side,card);
 if(card.side!==side||state.locations.some(loc=>loc&&ccTitle(loc)===ccTitle(card)))return [];
 const order=boardLocationOrder(),sites=order.filter(slot=>CloudCityRules.city(state.locations[slot]));
 if(!sites.length){const anchor=order.findIndex(slot=>ccPlanet(state.locations[slot])==='bespin');return [anchor<0?order.length:anchor];}
 const first=order.indexOf(sites[0]),last=order.indexOf(sites.at(-1)),result=[],slot=state.locations.length;
 // Validate a prospective slot without changing any live site or unit references.
 state.locations.push(card);
 try{for(let i=first;i<=last+1;i++){const prospective=order.slice();prospective.splice(i,0,slot);if(ccSiteOrderValid(prospective.filter(index=>CloudCityRules.city(state.locations[index]))))result.push(i);}}
 finally{state.locations.pop();}return result;
};
initialLocationOrder=function(locations){const order=ccLayoutBase.initial(locations);if(![CloudCityRules.FORMAT,'premiere-a-new-hope-hoth-dagobah-cloud-city-jabbas-palace'].includes(currentGame()?.playFormat))return order;const sites=order.filter(slot=>CloudCityRules.city(locations[slot])),bays=sites.filter(slot=>locations[slot].locationTags?.includes('Exterior')),interiors=sites.filter(slot=>!bays.includes(slot));if(sites.length){const sorted=[...(bays.length?bays.slice(0,1):[]),...interiors,...bays.slice(1)];let i=0;return order.map(slot=>sites.includes(slot)?sorted[i++]:slot);}return order;};
dagoCanDeploy=function(card,loc,side){return cloudCityEnabled()&&CloudCityRules.cloud(loc)&&CloudCityRules.cloudCapable(card)||ccLayoutBase.canDeploy(card,loc,side);};
dagoMovesLikeFighter=function(card){return cloudCityEnabled()&&CloudCityRules.fighter(card)||ccLayoutBase.movesLike(card);};
function ccRearrangeSites(side,card,done){
 const order=boardLocationOrder().slice(),sites=order.filter(slot=>CloudCityRules.city(state.locations[slot])),chosen=[];
 const show=()=>{const remaining=sites.filter(slot=>!chosen.includes(slot)),bays=sites.filter(slot=>PremiereLocations.conditions(state,slot,side).dockingBay);
  const choices=remaining.filter(slot=>{const bay=bays.includes(slot);if(bays.length===2&&chosen.length===0)return bay;if(bay&&chosen.length>0&&remaining.length>1)return false;if(!bay&&chosen.length>1&&bays.includes(chosen.at(-1)))return false;return true;}).map(slot=>({args:[slot],site:slot,card:state.locations[slot],label:state.locations[slot].name}));
  ccChoose(side,card,'SiteOrder',choices,choice=>{chosen.push(choice.site);if(chosen.length<sites.length){show();return;}let i=0;state.locationOrder=order.map(slot=>sites.includes(slot)?chosen[i++]:slot);done();});
 };if(sites.length)show();else done();
}
ccInterruptProviders.push(({add,card,index,side,window})=>{if(!window&&card.id==='Dark:1121'&&state.activeSide===side&&state.phase===2){const count=state.locations.filter(CloudCityRules.city).length;if(count)add(card,index,'rearrange',[],'Cloud-City-Sites neu anordnen ('+count+' Force)',{cost:count});}});
const ccLayoutSettle=ccSettleBattleInterrupt;
ccSettleBattleInterrupt=function(frame,parent,done){if(frame.mode==='cc:rearrange'){ccRearrangeSites(frame.side,frame.card,done);return true;}return ccLayoutSettle(frame,parent,done);};
