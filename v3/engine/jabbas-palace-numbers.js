'use strict';
function jpVulFactor(side){return jpEnabled()&&state.locations.some((loc,slot)=>loc?.id==='Light:1435'&&side===jpSource(slot,'Light')&&PremiereLocations.occupy(state,side,slot,jpNumbersBase.ability)===true&&ccPresent(side,slot).filter(c=>c.type==='Starship').length===2)?2:1;}
function jpVulBonus(card,field){return card?.id==='Light:2730'&&!card.frozen&&!card.jpRuleOriginalId?(card[field]??0)*(jpVulFactor(ccOwner(card))-1):0;}
const jpNumbersBase={ability:cardAbility,forfeit:cardForfeitValueAt,crew:crewDeployCost,stats:craftStats,draw:hothDrawModifier,printed:PremiereBattle.printedDestiny};
cardAbility=function(card){if(!jpEnabled()||card?.id!=='Light:2730'||card.frozen||card.jpRuleOriginalId||jpVulFactor(ccOwner(card))===1)return jpNumbersBase.ability(card);const printed=card.ability;card.ability=printed*2;try{return jpNumbersBase.ability(card);}finally{card.ability=printed;}};
cardForfeitValueAt=function(card,...args){const value=jpNumbersBase.forfeit(card,...args);return jpEnabled()&&value>0?value+jpVulBonus(card,'forfeit'):value;};
crewDeployCost=function(card,...args){const value=jpNumbersBase.crew(card,...args);return jpEnabled()&&state.jpFreeDeploy!==card?value+jpVulBonus(card,'deploy'):value;};
craftStats=function(card,slot,...args){const stats=jpNumbersBase.stats(card,slot,...args);if(jpEnabled()&&stats.powered)for(const e of card.occupants??[])if(e.role==='pilot'&&e.card.id==='Light:2730'&&PremiereUnits.active(e.card)&&jpLive(e.card))stats.power+=2*(jpVulFactor(ccOwner(e.card))-1);return stats;};
hothDrawModifier=function(side,card){return jpNumbersBase.draw(side,card)+(jpEnabled()?jpVulBonus(card,'destiny'):0);};
PremiereBattle.printedDestiny=function(card){const value=jpNumbersBase.printed(card);return jpEnabled()&&Number.isFinite(value)?value+jpVulBonus(card,'destiny'):value;};
