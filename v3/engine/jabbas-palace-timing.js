'use strict';
ccTiming.push(event=>{
 if(!jpEnabled()||event!=='phase:end'||state.phase!==2||state.activeSide!=='Dark')return [];
 const side='Dark',pit=state.locations.findIndex(l=>l?.id==='Dark:1360');if(pit<0||jpUnits().some(e=>e.slot===pit&&ccOwner(e.card)===side&&e.card.type==='Character'))return [];
 return [done=>withShipWeaponResponse({kind:'jpDeployEnd',side,pit},done)];
});
jpInterruptProviders.push(({card,side,all,window,offer})=>{
 if(card.id!=='Dark:2630'||window?.kind!=='jpDeployEnd'||side!==window.side)return;
 for(const [i,e]of all.entries())if(e.card.type==='Character'&&/audience chamber$/.test(jpTitle(state.locations[e.slot]))&&PremiereLocations.physicalPlace(e)===e.slot&&!(jpBoShuda(e.slot)&&ccOwner(e.card)==='Light'&&e.card.subType==='Alien'))offer('trapDoor',[i],e.card.name+' durch Trap Door fallen lassen',(_parent,done)=>drawDestinySeries(side,'jpTrapDoor',1,2,d=>{
  if(d.length&&PremiereBattle.total(d)>cardAbility(e.card)){if(e.card.captured){if(detachTableCard(e.side,e.slot,e.card))rallyCaptive(e.card,window.pit);}else jpRelocate(e.card,window.pit);}done();
 }));
});
const jpTimingBase={damage:battleDamageAction,deploy:openDeploymentReaction,draws:battleDestinyDrawCount,board:boardDeployCost,device:PremiereUnits.canUseDevice,weapon:PremiereUnits.canUseWeapon,cancel:hothCancelEffect};
battleDamageAction=function(side,kind,args){const card=kind==='battleForfeit'?battleSession?.participants?.[side]?.[args[0]]:null,slot=battleSession?.site,chevin=jpEnabled()&&card?.id==='Dark:393'&&ccPresent(side,slot).some(c=>c!==card&&c.subType==='Alien'&&characterTraits(c).includes('leader')),ephant=jpEnabled()&&card?.id==='Dark:878'&&ccPresent(side,slot).some(c=>ccPersona(c,'Jabba')),x=battleSession;
 const result=jpTimingBase.damage(side,kind,args);if(result&&x?.damage?.debt?.[side]){if(chevin||ephant)x.damage.debt[side].attrition=0;if(ephant)x.damage.debt[side].damage=0;}return result;
};
PremiereUnits.canUseWeapon=function(game,host,...args){return !(jpEnabled()&&host?.id==='Light:183')&&jpTimingBase.weapon(game,host,...args);};
PremiereUnits.canUseDevice=function(game,host,...args){return !(jpEnabled()&&host?.id==='Light:183')&&jpTimingBase.device(game,host,...args);};
const jpProjectionBase=forceDrainEffects;
const jpProjectionLoss=dagoLoss;
dagoLoss=function(side,amount,reason,...args){if(jpEnabled()&&jpTitle({name:reason})==='shot in the dark'&&ccEffects('Light:1956',PremiereGame.otherSide(side)).some(e=>!Number.isInteger(e.site)))amount++;return jpProjectionLoss(side,amount,reason,...args);};
forceDrainEffects=function(side,slot){const plan=jpProjectionBase(side,slot);if(!jpEnabled()||!plan)return plan;const effect=ccEffects('Light:1956',side).find(e=>!Number.isInteger(e.site));return isHoloSite(state.locations[slot])&&effect?V3DrainTrace.modify(plan,[V3DrainTrace.term('modifier',1,effect.card,'Globale Projection am Holosite')]):plan;};
// Insert losses use several legacy reasons; their originating interrupt remains
// in the response stack, so cap the complete loss before individual card choices.
const jpInsertLossBase=beginForceLoss;
beginForceLoss=function(side,amount,terms){if(jpEnabled()&&(/insert/i.test(terms.reason??'')||terms.insert)&&[...ccEffects('Light:2665',side),...ccEffects('Dark:2096',side)].length&&jpLossCap(side))amount=Math.min(2,amount);return jpInsertLossBase(side,amount,terms);};
const jpProtectionBase={settle:settlePileInterrupt,choices:cardInformationChoices};
function jpProtectedHand(card,side){return ['Effect','Interrupt'].includes(card.type)?false:JabbasPalaceRules.nonunique(card)&&jpOwn(side).hand.length<13&&[...ccEffects('Light:2845',side),...ccEffects('Dark:2792',side)].length>0;}
settlePileInterrupt=function(frame){
 if(jpEnabled()&&!frame.cancelled&&frame.rule?.mode==='revealDuplicates'){
  const enemy=PremiereGame.otherSide(frame.side),own=jpOwn(enemy),protectedCards=own.hand.filter(c=>jpProtectedHand(c,enemy));
  if(protectedCards.length){const original=own.hand.slice();log(enemy+' deckt die vollständige geschützte Hand auf: '+original.map(c=>c.name).join(', ')+'.');own.hand.splice(0,own.hand.length,...original.filter(c=>!protectedCards.includes(c)));try{return jpProtectionBase.settle(frame);}finally{for(const card of protectedCards)if(!own.hand.includes(card))own.hand.splice(Math.min(original.indexOf(card),own.hand.length),0,card);}}
 }
 return jpProtectionBase.settle(frame);
};
