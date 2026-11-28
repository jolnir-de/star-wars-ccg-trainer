'use strict';
// Copy game-text rules only. Keep Bane's printed identity, characteristics,
// gender, icons, ability, and printed numbers; the copied power is a separate
// modifier. Scoping the rule identity also preserves every older module's
// self-referencing abilities without changing saved card IDs.
let jpMindscanDepth=0;
function jpWithMindscans(run){
 if(!jpEnabled()||jpMindscanDepth||state.jpMindscanBattle!==ccBattleKey())return run();const cards=jpUnits().filter(e=>!e.unavailable&&e.card.id==='Dark:188'&&e.card.jpMindscan?.battle===ccBattleKey()).map(e=>e.card);
 if(!cards.length)return run();jpMindscanDepth++;const previous=cards.map(card=>({card,id:card.id,text:card.gametext,traits:characterTraits(card)}));
 try{for(const {card,text,traits}of previous){card.jpRuleOriginalId=card.id;card.jpPrintedTraits=traits;card.id=card.jpMindscan.target.id;card.gametext=text+' '+card.jpMindscan.target.gametext;}return run();}
 finally{for(const {card,id,text}of previous){card.id=id;card.gametext=text;delete card.jpRuleOriginalId;delete card.jpPrintedTraits;}jpMindscanDepth--;}
}
const jpMindscanBase={legal:legalActions,execute:executeAction,continuous:hothContinuous,power:cardPowerModifier,totals:battleTotals,drain:forceDrainEffects,generation:forceFromLocations,stats:craftStats};
legalActions=function(...args){return jpWithMindscans(()=>jpMindscanBase.legal(...args));};
executeAction=function(...args){return jpWithMindscans(()=>jpMindscanBase.execute(...args));};
hothContinuous=function(...args){return jpWithMindscans(()=>jpMindscanBase.continuous(...args));};
battleTotals=function(...args){return jpWithMindscans(()=>jpMindscanBase.totals(...args));};
forceDrainEffects=function(...args){return jpWithMindscans(()=>jpMindscanBase.drain(...args));};
forceFromLocations=function(...args){return jpWithMindscans(()=>jpMindscanBase.generation(...args));};
craftStats=function(...args){return jpWithMindscans(()=>jpMindscanBase.stats(...args));};
cardPowerModifier=function(card,...args){return jpWithMindscans(()=>jpMindscanBase.power(card,...args));};

const jpMindscanTraits=characterTraits;
characterTraits=function(card){return card?.jpPrintedTraits??jpMindscanTraits(card);};
const jpMindscanImmunity=battleImmunity;
battleImmunity=function(side,card,...args){const value=jpWithMindscans(()=>jpMindscanImmunity(side,card,...args));return jpEnabled()&&(card.id==='Dark:188'||card.jpRuleOriginalId==='Dark:188')?Math.max(3,value):value;};
const jpMindscanForfeit=cardForfeitValueAt,jpMindscanMove=hothMovementAllowed;
cardForfeitValueAt=function(...args){return jpWithMindscans(()=>jpMindscanForfeit(...args));};
hothMovementAllowed=function(...args){return jpWithMindscans(()=>jpMindscanMove(...args));};
