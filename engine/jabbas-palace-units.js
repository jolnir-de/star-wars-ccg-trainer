'use strict';
const jpAmbassadors=[['Light:1012','saurin',0,2],['Light:1014','snivvian',0,2],['Light:784','kitonak',0,2],['Light:2156','yarkora',2,2],['Light:2247','ishi tib',2,2],['Light:2420','elom',1,1],['Light:1660','musician',0,3],['Dark:1342','whiphid',0,2],['Dark:1862','gamorrean',0,2],['Dark:1928','skrilling',2,1]];
const jpUnitBase={power:cardPowerModifier,forfeit:cardForfeitValueAt,cost:crewDeployCost,allowed:characterLocationAllowed,stats:craftStats,immunity:battleImmunity,draws:battleDestinyDrawCount,traits:characterTraits,move:hothMovementAllowed,travel:travelOptions,unique:cardUniquenessLimit,escort:PremiereUnits.canEscort,drain:forceDrainEffects,generation:forceFromLocations,text:PremiereUnits.textSuppressed,ability:cardAbility,battleCost:battleInitiationCost};
function jpTrait(card,trait){return trait==='musician'?characterTraits(card).includes(trait):jpSpecies(card,trait);}
function jpAmbassadorBonus(card,side,stat){let bonus=0;for(const [id,trait,power,forfeit]of jpAmbassadors)if(card.id!==id&&jpTrait(card,trait)&&jpAtAudience(side,id))bonus+=stat==='power'?power:forfeit;return bonus;}
function jpDefending(side,slot){return battleSession?.site===slot&&battleSession.initiator!==side;}
function jpLocationCost(card,side,loc){
 const slot=state.locations.indexOf(loc);let change=0;
 if(loc?.id==='Dark:1355'&&side===jpSource(slot,'Dark')&&isDroid(card))change--;
 if(loc?.id==='Dark:1357'&&side===jpSource(slot,'Dark')&&card.id==='Dark:232')change-=3;
 if(loc?.id==='Dark:1357'&&side===jpSource(slot,'Light')&&jpControl(side,slot)&&card.subType==='Alien')change-=2;
 if(card.subType==='Imperial'&&!JabbasPalaceRules.female(card))change+=2*jpAll(PremiereGame.otherSide(side),'Light:1092').filter(e=>e.slot===slot||adjacentSites(e.slot,slot)).length;
 if(card.subType==='Alien'&&JabbasPalaceRules.nonunique(card)&&jpAtAudience(side,'Light:2507'))change--;
 if(characterTraits(card).includes('musician')&&jpAtAudience(side,'Light:1660'))change--;
 if(card.id==='Dark:1346'&&['tatooine','nal hutta'].includes(sitePlanet(loc)??jpTitle(loc)))change-=2;
 if(['Light:2274','Dark:2273'].includes(card.id)&&sitePlanet(loc)==='tatooine')change--;
 if(card.id==='Dark:2788'&&jpUnits().some(e=>e.slot===slot&&!e.unavailable&&jpSpecies(e.card,'weequay')))change--;
 return change;
}
characterLocationAllowed=function(card,loc){
 if(!jpEnabled())return jpUnitBase.allowed(card,loc);
 const slot=state.locations.indexOf(loc),side=ccOwner(card),enemy=PremiereGame.otherSide(side),text=card.gametext??'';
 if(card.set==='6'){
  if(/deploys? only (?:on|at) tatooine/i.test(text)&&sitePlanet(loc)!=='tatooine')return false;
  if(/deploys? only to a jabba's palace site/i.test(text)&&!jpPalace(loc))return false;
  if(card.id==='Light:1037'&&!loc.locationTags?.includes('Interior'))return false;
  if(card.id==='Dark:2906'&&sitePlanet(loc)!=='endor'&&!jpAll(side).some(e=>e.slot===slot&&PremiereUnits.bountyHunter(e.card)))return false;
  if(card.id==='Light:1945')return false; // Its asterisk deploy is a captive replacement, never an ordinary deploy.
 }
 if(jpAll(enemy,'Dark:878').some(e=>e.slot===slot)&&['spy','gambler','thief'].some(t=>characterTraits(card).includes(t)))return false;
 if(card.id==='Dark:2021')return jpTitle(loc)==="jabba's palace: rancor pit"||jpAt(side,slot,'Dark:1633')&&jpUnits().filter(e=>e.slot===slot&&!e.unavailable&&e.card.type==='Character').length===1;
 return jpUnitBase.allowed(card,loc);
};
crewDeployCost=function(card,side,loc){
 let cost=jpUnitBase.cost(card,side,loc);if(!jpEnabled()||!loc)return cost;
 const slot=state.locations.indexOf(loc),planet=sitePlanet(loc);
 if(card.id==='Dark:214')cost=3;
 if(card.id==='Light:128'&&planet==='tatooine'||card.id==='Light:2903'&&(planet==='bespin'||jpPalace(loc))||card.id==='Dark:1003'&&jpAt(side,slot,'Dark:1700'))return 0;
 return Math.max(0,cost+jpLocationCost(card,side,loc));
};
cardPowerModifier=function(card,side,slot,...args){
 let value=jpUnitBase.power(card,side,slot,...args);if(!jpEnabled())return value;
 if(card.jpPowerTurn===state.game.timing.turn)value+=card.jpPowerBonus??0;
 if(!jpLive(card))return value;
 const loc=state.locations[slot],planet=sitePlanet(loc),title=jpTitle(loc),night=PremiereLocations.conditions(state,slot,side).night,defending=jpDefending(side,slot),enemy=PremiereGame.otherSide(side),same=ccPresent(side,slot),all=PremiereGame.sides.flatMap(s=>ccPresent(s,slot));
 value+=jpAmbassadorBonus(card,side,'power');
 if(card.id==='Dark:1444')value+=1+Math.max(0,...ccPresent(enemy,slot).filter(c=>c.type==='Character').map(cardAbility))-(card.power??0);
 if(card.id==='Dark:196'){if(planet!=='tatooine')value-=card.power??0;else if(jpPalace(loc)&&jpAll(side).some(e=>ccPersona(e.card,'Jabba')))value+=2;}
 if(card.id==='Dark:1780'&&defending&&jpPalace(loc))value+=2;
 if(['Dark:1041','Dark:1802'].includes(card.id)&&defending&&jpPalace(loc))value+=3;
 if(card.id==='Dark:2724'&&defending)value+=3;
 if(card.id==='Dark:2827'&&defending&&jpPalace(loc))value+=2;
 if(card.id==='Dark:1448'&&(same.some(c=>c.id==='Dark:196')||defending&&jpPalace(loc)))value+=2;
 if(card.id==='Dark:2791'&&(defending||same.some(c=>c!==card&&jpSpecies(c,'weequay')))&&battleSession?.site===slot)value+=2;
 if(card.id==='Dark:1009'&&planet!=='tatooine')value--;
 if(card.id==='Dark:2628'&&(all.some(c=>jpSpecies(c,'wookiee'))||jpAtAudience(side,'Dark:290')))value++;
 if(card.id==='Dark:49'&&jpAtAudience(side,'Dark:1720'))value+=2;
 if(card.id==='Dark:122'&&jpAtAudience(side,'Dark:1922'))value+=2;
 if(card.id==='Dark:393'&&jpAtAudience(side,'Dark:878'))value+=2;
 if(card.id==='Light:387'&&jpAtAudience(side,'Light:1406'))value+=2;
 if(card.id==='Light:962'&&jpAtAudience(side,'Light:730'))value+=2;
 if(card.id==='Light:1339'&&jpAtAudience(side,'Light:1690'))value+=2;
 if(card.id==='Light:722'&&(title==='tatooine: mos eisley'||loc?.locationTags?.includes('Mobile')||PremiereLocations.conditions(state,slot,side).dockingBay))value+=2;
 if(card.id==='Light:828'&&all.some(c=>c.subType==='Imperial'))value+=3;
 if(card.id==='Light:1449'&&jpPalace(loc))value+=2;
 if(card.id==='Light:2903'&&CloudCityRules.city(loc))value+=2;
 if(['Light:1329','Light:2247'].includes(card.id)&&/swamp/.test(title))value++;
 if(['Light:1660','Dark:1342','Dark:2804'].includes(card.id)&&planet==='hoth')value+=2;
 if(card.id==='Light:1861'&&(planet==='hoth'||/dining room$/.test(title)))value+=2;
 if(card.id==='Light:784'&&(planet==='tatooine'||jpDesert(loc)))value+=2;
 if(card.id==='Light:1447')value+=jpDesert(loc)?2:planet==='tatooine'?1:0;
 if(card.id==='Light:2292'&&night)value+=2;
 if(card.id==='Dark:1781'&&same.some(c=>c!==card&&characterTraits(c).includes('musician')))value+=3;
 if(card.id==='Dark:878'&&battleSession?.site===slot&&same.some(c=>ccPersona(c,'Jabba')))value+=2;
 if(card.id==='Dark:2906'&&all.some(c=>jpSpecies(c,'ewok')))value+=2;
 if(jpSpecies(card,'jawa')&&(jpAtAudience(side,'Light:1408')||jpAll(side,'Light:1408').some(e=>/jawa camp$/.test(jpTitle(state.locations[e.slot])))))value+=2;
 if(jpSpecies(card,'jawa')&&(jpAtAudience(side,'Dark:2817')||jpAll(side,'Dark:2817').some(e=>/jawa camp$/.test(jpTitle(state.locations[e.slot])))))value+=2;
 if(jpSpecies(card,'tusken raider')&&jpAtAudience(side,'Dark:2488'))value+=3-(card.power??0);
 if(jpSpecies(card,'corellian')&&jpAtAudience(side,'Light:1890'))value+=JabbasPalaceRules.nonunique(card)?2:1;
 if(card.id==='Light:2730'&&typeof jpVulFactor==='function')value+=(card.power??0)*(jpVulFactor(side)-1);
 if(loc?.id==='Light:1358'&&side===jpSource(slot,'Dark')&&card.id==='Dark:1009')value++;
 return value;
};
cardForfeitValueAt=function(card,side,slot,...args){let value=jpUnitBase.forfeit(card,side,slot,...args);if(!jpEnabled()||!Number.isFinite(value))return value;
 value+=jpAmbassadorBonus(card,side,'forfeit');const loc=state.locations[slot],planet=sitePlanet(loc),same=PremiereGame.sides.flatMap(s=>ccPresent(s,slot));
 if(card.jpForfeitZeroTurn===state.game.timing.turn)return 0;
 value+=card.jpForfeitTurn===state.game.timing.turn?card.jpForfeitBonus??0:0;
 if(['Light:387','Light:962','Light:1339'].includes(card.id)&&jpAtAudience(side,{'Light:387':'Light:1406','Light:962':'Light:730','Light:1339':'Light:1690'}[card.id]))value+=2;
 if(['Dark:49','Dark:122','Dark:393'].includes(card.id)&&jpAtAudience(side,{'Dark:49':'Dark:1720','Dark:122':'Dark:1922','Dark:393':'Dark:878'}[card.id]))value++;
 if(card.id==='Dark:2628'&&(same.some(c=>jpSpecies(c,'wookiee'))||jpAtAudience(side,'Dark:290')))value++;
 if(card.id==='Dark:1780'&&jpDefending(side,slot)&&jpPalace(loc))value+=2;
 if(card.id==='Dark:2804'&&PremiereLocations.conditions(state,slot,side).night)value+=2;
 if(card.id==='Light:1861'&&(planet==='hoth'||/dining room$/.test(jpTitle(loc))))value+=2;
 if(jpSpecies(card,'tusken raider')&&jpAtAudience(side,'Dark:2488'))value+=2;
 if(jpSpecies(card,'corellian')&&jpAtAudience(side,'Light:1890'))value+=JabbasPalaceRules.nonunique(card)?2:1;
 if(card.type==='Character'&&PremiereUnits.hasSkill(card,'pilot'))value-=2*jpAll(PremiereGame.otherSide(side),'Light:2263').filter(e=>e.slot===slot).length;
 if(card.subType==='Alien'&&card.uniquenessLimit===1&&jpUnits().some(e=>e.slot===slot&&e.card.id==='Light:1945'&&e.card.captured&&side!==e.card.owner))value-=2;
 if(card.subType==='Alien'&&jpAtAudience(side,'Dark:1346')&&card.id!=='Dark:1346')value++;
 if(loc?.id==='Light:1358'&&side===jpSource(slot,'Dark')&&card.id==='Dark:1009')value++;
 return Math.max(0,value);
};
craftStats=function(card,slot,...args){const stats=jpUnitBase.stats(card,slot,...args);if(!jpEnabled())return stats;
 for(const {card:crew,role}of card.occupants??[])if(stats.powered&&PremiereUnits.active(crew)&&!crew.asleep&&jpLive(crew)){
  if(role==='driver'&&crew.id==='Dark:1928')stats.power+=3;
  if(role==='driver'&&crew.id==='Dark:2791'&&/skiff/.test(jpTitle(card)))stats.power+=3;
  if(role==='pilot'&&crew.id==='Light:2026'&&crew.trainedBy?.includes?.('Rycar Ryjerd'))stats.power+=2;
  if(role==='pilot'&&crew.id==='Dark:2827'&&((card.characteristics??[]).includes('independent')||(card.occupants??[]).some(e=>ccPersona(e.card,'Jabba'))))stats.power++;
  if(role==='pilot'&&crew.id==='Light:1505'&&jpAtAudience(ccOwner(crew),'Light:1505'))stats.power+=2*(card.occupants??[]).filter(e=>e.role==='pilot'&&ccPersona(e.card,'Ellorrs Madak')).length;
 }
 if(stats.powered&&card.weapons?.some(w=>w.id==='Dark:764'&&jpLive(w)))stats.power+=3;
 return stats;
};
battleImmunity=function(side,card,slot,...args){let value=jpUnitBase.immunity(side,card,slot,...args);if(!jpEnabled()||!jpLive(card))return value;
 if(['Light:1945','Dark:188'].includes(card.id))value=Math.max(value,3);if(card.id==='Dark:1346')value=Math.max(value,4);
 if(card.id==='Light:784')value=Math.max(value,jpAll(side).filter(e=>characterTraits(e.card).includes('musician')).length);
 if(card.id==='Light:1447')value=Math.max(value,ccPresent(side,slot).filter(c=>characterTraits(c).includes('musician')).length);
 if(jpAt(side,slot,'Light:128')&&ccPresent(side,slot).some(c=>jpTitle(c)==='vaporator'))value=Math.max(value,3);
 if(state.locations[slot]?.id==='Light:1354'&&side===jpSource(slot,'Dark')&&card.subType==='Alien'&&characterTraits(card).includes('leader'))return Infinity;
 if(card.weapons?.some(w=>w.id==='Dark:764'&&jpLive(w)))value=Math.max(value,5);
 return value;
};
characterTraits=function(card){const out=jpUnitBase.traits(card);if(jpEnabled()&&card.id==='Dark:1862'&&jpEntry(card)&&ccPresent(ccOwner(card),jpEntry(card).slot).some(c=>c!==card&&jpSpecies(c,'gamorrean')))return [...new Set([...out,'leader'])];return out;};
PremiereUnits.canEscort=function(card){return jpUnitBase.escort(card)||jpEnabled()&&card.id==='Dark:1346'&&jpLive(card);};
battleDestinyDrawCount=function(side,slot,...args){const count=jpUnitBase.draws(side,slot,...args);if(!jpEnabled())return count;const loc=state.locations[slot],enemy=PremiereGame.otherSide(side);
 if(loc?.id==='Light:2450'&&(side===jpSource(slot,'Dark')&&ccPresent(enemy,slot).some(c=>jpSpecies(c,'jawa'))||side===jpSource(slot,'Light')&&ccPresent(enemy,slot).some(c=>jpSpecies(c,'tusken raider'))))return 0;
 if(!count&&ccPresent(side,slot).some(c=>c.id==='Dark:2788'&&jpLive(c))&&ccPresent(side,slot).some(c=>c.id!=='Dark:2788'&&jpSpecies(c,'weequay')))return 1;return count;
};
PremiereUnits.textSuppressed=function(card){return jpUnitBase.text(card)||jpEnabled()&&card&&(card.jpBlankTurn===state.game.timing.turn||['Dark:1003','Dark:1700'].includes(card.id)&&jpAtAudience('Light','Light:1575'));};
jpContinuous.push(()=>{for(const e of jpAll(null,'Light:183'))if(sitePlanet(state.locations[e.slot])!=='tatooine')jpRemove(e.card);for(const e of jpAll(null,'Light:2730')){const sisters=PremiereGame.sides.flatMap(side=>ccPresent(side,e.slot)).filter(c=>ccPersona(c,'Tonnika Sisters'));if(sisters.length){jpRemove(e.card);for(const c of sisters)jpRemove(c);}}});
