'use strict';
// Drain suppression cancels bonuses from the draining player's cards, not
// negative modifiers or bonuses printed on the other player's locations.
function ccDrainWithoutOwnBonuses(side,slot,plan){
 const loc=state.locations[slot],enemy=PremiereGame.otherSide(side),effects=PremiereLocations.effectsAt(state,slot);
 const keep=(amount,source)=>amount<=0||ccOwner(source)!==side?amount:0;
 let modifier=PremiereLocations.rulesAt(state,slot,side,'forceDrain').reduce((sum,rule)=>{
  const source=state.locations.find(card=>card&&PremiereCardRules.effects(card,'forceDrain').includes(rule))??loc;return sum+keep(rule.amount,source);
 },0);
 const control=PremiereLocations.ruleAt(state,slot,side,'controlSiteDrain');if(control&&ccOwner(loc)!==side)modifier+=state.locations.filter((card,index)=>card&&isSite(card)&&PremiereLocations.control(state,side,index,cardAbility)===true&&PremiereLocations.at(state,ccPresent(side,index)[0],slot)).length;
 modifier+=effects.reduce((sum,effect)=>sum+keep(effect.drainModifier?.[side]??0,effect.card),0);
 if(PremiereLocations.ruleAt(state,slot,side,'hothGeneratorDrainPenalty')&&state.locations.some(HothRules.generator))modifier--;
 if(PremiereLocations.ruleAt(state,slot,side,'hothImperialDrain')&&ccOwner(loc)!==side&&ccPresent(side,slot).some(card=>card.subType==='Imperial'))modifier++;
 if(effects.some(effect=>activeCardRules(effect.card,'locationEffect').some(rule=>rule.darkWaters)&&ccOwner(effect.card)!==side))modifier--;
 if(dagoLocationText(slot)&&loc?.id==='Light:236'&&side===dagoLocationPlayer(slot,'Dark'))modifier++;
 if(dagoLocationText(slot)&&loc?.id==='Dark:910'&&side===dagoLocationPlayer(slot,'Light'))modifier++;
 modifier+=keep(ccLocationDrain(side,slot),loc);
 const chosen=state.cloudCityDrainBoost;if(chosen?.side===side&&chosen.site===slot&&chosen.turn===state.game.timing.turn&&ccCloudDrainSource(side,chosen.source,slot)&&ccOwner(state.locations[chosen.source])!==side)modifier++;
 return {...plan,base:PremiereLocations.icons(state,slot,enemy),modifier,optional:0,weapons:[]};
}
const ccDrainFinal=forceDrainEffects;
forceDrainEffects=function(side,slot){const plan=ccDrainFinal(side,slot);return plan&&cloudCityEnabled()&&(ccDecree(PremiereGame.otherSide(side))||dagoCompleted(PremiereGame.otherSide(side),1))?ccDrainWithoutOwnBonuses(side,slot,plan):plan;};
