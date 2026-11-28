'use strict';
// Drain suppression cancels bonuses from the draining player's cards, not
// negative modifiers or bonuses printed on the other player's locations.
function ccDrainWithoutOwnBonuses(side,slot,plan){
 const loc=state.locations[slot],enemy=PremiereGame.otherSide(side),effects=PremiereLocations.effectsAt(state,slot);
 const rows=[],add=(amount,card,label,sourceSite=slot)=>{if(amount&&(amount<=0||ccOwner(card)!==side))rows.push(V3DrainTrace.term('modifier',amount,card,label,sourceSite));};
 for(const row of drainRuleTerms(side,slot))if(row.amount<=0||row.source?.owner!==side)rows.push(row);
 const control=PremiereLocations.ruleAt(state,slot,side,'controlSiteDrain');if(control&&ccOwner(loc)!==side)add(state.locations.filter((card,index)=>card&&isSite(card)&&PremiereLocations.control(state,side,index,cardAbility)===true&&PremiereLocations.at(state,ccPresent(side,index)[0],slot)).length,loc,'Kontrollierte Sites');
 for(const effect of effects)add(effect.drainModifier?.[side]??0,effect.card,'Effect am Standort');
 if(PremiereLocations.ruleAt(state,slot,side,'hothGeneratorDrainPenalty')&&state.locations.some(HothRules.generator))rows.push(...hothDrainTerms(side,slot).filter(row=>row.label==='Main Power Generators liegen aus'));
 if(PremiereLocations.ruleAt(state,slot,side,'hothImperialDrain')&&ccOwner(loc)!==side&&ccPresent(side,slot).some(card=>card.subType==='Imperial'))rows.push(...hothDrainTerms(side,slot).filter(row=>row.label==='Imperial am Standort'));
 const waters=effects.find(effect=>activeCardRules(effect.card,'locationEffect').some(rule=>rule.darkWaters)&&ccOwner(effect.card)!==side);if(waters)add(-1,waters.card,'Dark Waters am Standort');
 if(dagoLocationText(slot)&&loc?.id==='Light:236'&&side===dagoLocationPlayer(slot,'Dark'))add(1,loc,'Big One / zugehörige Asteroidenfelder');
 if(dagoLocationText(slot)&&loc?.id==='Dark:910'&&side===dagoLocationPlayer(slot,'Light'))add(1,loc,'Standort-Spieltext');
 add(ccLocationDrain(side,slot),loc,'Cloud-City-Standortregel');
 const chosen=state.cloudCityDrainBoost;if(chosen?.side===side&&chosen.site===slot&&chosen.turn===state.game.timing.turn&&ccCloudDrainSource(side,chosen.source,slot)&&ccOwner(state.locations[chosen.source])!==side)add(1,state.locations[chosen.source],'Gewählter Cloud-Drain-Bonus',chosen.source);
 const icons=PremiereLocations.iconCalculation(state,slot,PremiereGame.otherSide(side));return V3DrainTrace.rebase(V3DrainTrace.replace(plan,rows,drainSuppressionSources(PremiereGame.otherSide(side))),icons.value,icons.details);
}
const ccDrainFinal=forceDrainEffects;
forceDrainEffects=function(side,slot){const plan=ccDrainFinal(side,slot);return plan&&cloudCityEnabled()&&(ccDecree(PremiereGame.otherSide(side))||dagoCompleted(PremiereGame.otherSide(side),1))?ccDrainWithoutOwnBonuses(side,slot,plan):plan;};
