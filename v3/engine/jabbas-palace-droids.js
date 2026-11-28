'use strict';
const jpDroidBase={drain:PremiereLocations.drain,effects:forceDrainEffects};
const jpEVSite=(side,slot)=>jpAt(side,slot,'Dark:887')&&/droid workshop$|droid junkheap$|incinerator$/.test(jpTitle(state.locations[slot]));
PremiereLocations.drain=function(game,side,slot,ability){
 const plan=jpDroidBase.drain(game,side,slot,ability);if(plan||!jpEnabled()||game!==state||!jpEVSite(side,slot))return plan;
 const enemy=PremiereGame.otherSide(side);if(PremiereLocations.presence(game,enemy,slot,ability)!==false||ccPresent(enemy,slot).some(c=>c.undercover)||PremiereLocations.effectsAt(game,slot).some(e=>e.drainForbiddenFor===side))return null;
 const base=PremiereLocations.icons(game,slot,enemy);return base===null?null:V3DrainTrace.base(base,state.locations[slot],side,slot,PremiereLocations.iconCalculation(game,slot,enemy).details);
};
forceDrainEffects=function(side,slot){const plan=jpDroidBase.effects(side,slot);if(!plan||!jpEnabled()||!jpEVSite(side,slot))return plan;const droids=jpUnits().filter(e=>e.slot===slot&&e.card.id!=='Dark:887'&&isDroid(e.card)&&PremiereLocations.physicalPlace(e)===slot).length;return V3DrainTrace.modify(plan,[V3DrainTrace.term('modifier',droids,ccPresent(side,slot).find(card=>ccOn(card,'Dark:887')),'Andere Droiden am Standort: '+droids,slot)]);};
