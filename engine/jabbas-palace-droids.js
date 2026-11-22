'use strict';
const jpDroidBase={drain:PremiereLocations.drain,effects:forceDrainEffects};
const jpEVSite=(side,slot)=>jpAt(side,slot,'Dark:887')&&/droid workshop$|droid junkheap$|incinerator$/.test(jpTitle(state.locations[slot]));
PremiereLocations.drain=function(game,side,slot,ability){
 const plan=jpDroidBase.drain(game,side,slot,ability);if(plan||!jpEnabled()||game!==state||!jpEVSite(side,slot))return plan;
 const enemy=PremiereGame.otherSide(side);if(PremiereLocations.presence(game,enemy,slot,ability)!==false||ccPresent(enemy,slot).some(c=>c.undercover)||PremiereLocations.effectsAt(game,slot).some(e=>e.drainForbiddenFor===side))return null;
 const base=PremiereLocations.icons(game,slot,enemy);return base===null?null:{base,modifier:0,optional:0,weapons:[]};
};
forceDrainEffects=function(side,slot){const plan=jpDroidBase.effects(side,slot);if(!plan||!jpEnabled()||!jpEVSite(side,slot))return plan;const droids=jpUnits().filter(e=>e.slot===slot&&e.card.id!=='Dark:887'&&isDroid(e.card)&&PremiereLocations.physicalPlace(e)===slot).length;return {...plan,modifier:plan.modifier+droids};};
