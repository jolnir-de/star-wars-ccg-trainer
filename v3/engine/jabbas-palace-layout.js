'use strict';
const jpLayoutBase={planet:sitePlanet,region:PremiereLocations.region,initial:initialLocationOrder,positions:locationPositionsForCard};
sitePlanet=function(card){return jpPalace(card)&&!card.hostInstanceId?'tatooine':jpLayoutBase.planet(card);};
PremiereLocations.region=function(card){return jpEnabled()&&jpPalace(card)&&!card.hostInstanceId?'Tatooine':jpLayoutBase.region(card);};
function jpSiteRank(card){const title=jpTitle(card);if(isSystem(card))return 9;if(title==='tatooine: cantina')return 0;if(title==='tatooine: docking bay 94')return 1;if(title==='tatooine: mos eisley')return 2;if(title==="tatooine: jabba's palace")return 4;if(title==="jabba's palace: entrance cavern")return 5;if(title==="jabba's palace: rancor pit")return 7;if(jpPalace(card))return 6;return card.locationTags?.includes('Interior')?-.5:3;}
function jpValidSites(slots){let rank=-Infinity;for(const slot of slots){const next=jpSiteRank(state.locations[slot]);if(next<rank)return false;rank=next;}return true;}
initialLocationOrder=function(locations){const order=jpLayoutBase.initial(locations);if((currentGame()?.cardRulesVersion??0)<34||currentGame()?.playFormat!==JabbasPalaceRules.FORMAT)return order;const tatooine=order.filter(slot=>sitePlanet(locations[slot])==='tatooine'||isSystem(locations[slot])&&jpTitle(locations[slot])==='tatooine').sort((a,b)=>jpSiteRank(locations[a])-jpSiteRank(locations[b]));let i=0;return order.map(slot=>tatooine.includes(slot)?tatooine[i++]:slot);};
locationPositionsForCard=function(side,card){
 if(!jpEnabled()||sitePlanet(card)!=='tatooine'||card.hostInstanceId)return jpLayoutBase.positions(side,card);
 if(card.side!==side)return [];const generic=/^<>/.test(card.name)||jpDesert(card)&&card.uniquenessLimit===3;if(!generic&&state.locations.some(loc=>loc&&jpTitle(loc)===jpTitle(card)))return [];
 if(generic&&state.locations.filter(loc=>loc&&sitePlanet(loc)==='tatooine'&&jpTitle(loc)===jpTitle(card)).length>=3)return [];
 const order=boardLocationOrder(),sites=order.filter(slot=>sitePlanet(state.locations[slot])==='tatooine'),slot=state.locations.length,result=[];
 const first=sites.length?order.indexOf(sites[0]):order.findIndex(i=>isSystem(state.locations[i])&&jpTitle(state.locations[i])==='tatooine'),start=first<0?order.length:first,last=sites.length?order.indexOf(sites.at(-1))+1:start;
 state.locations.push(card);try{for(let i=start;i<=last;i++){const next=order.slice();next.splice(i,0,slot);if(jpValidSites(next.filter(s=>sitePlanet(state.locations[s])==='tatooine')))result.push(i);}}finally{state.locations.pop();}return result;
};

const jpGenericConversion=conversionTarget;
conversionTarget=function(side,index){const card=state&&jpOwn(side).hand[index];return jpEnabled()&&jpDesert(card)&&card.uniquenessLimit===3?-1:jpGenericConversion(side,index);};
