'use strict';
function ccDiningDouble(side){return state.locations.some((loc,slot)=>loc?.id==='Dark:444'&&side===ccLocationSource(slot,'Light')&&ccControl(side,slot));}
const ccSupportBase={transport:transportOptions,charCost:characterDeployCost,crew:crewDeployCost,options:hothActionOptions};
const ccStewSettle=settlePileInterrupt;
settlePileInterrupt=function(frame){if(cloudCityEnabled()&&!frame.cancelled&&frame.rule?.mode==='blueMilk'&&ccDiningDouble(frame.side)){activateReserve(frame.targetSide,2);finishPileInterrupt(frame);return;}return ccStewSettle(frame);};
characterDeployCost=function(card,loc,side){const cost=ccSupportBase.charCost(card,loc,side);return cost===null||!cloudCityEnabled()?cost:Math.max(0,cost-(loc?.id==='Dark:444'&&side===ccLocationSource(state.locations.indexOf(loc),'Light')&&ccPersona(card,'Jek')?2:0));};
// A medical droid is free only when the selected carrier is Redemption.
crewDeployCost=function(card,side,loc){return ccAbilityBase.crew(card,side,loc);};
transportOptions=function(side){return ccSupportBase.transport(side).map(option=>cloudCityEnabled()&&option.args[0]==='deployAboard'&&option.carrier?.id==='Light:2073'&&/medical/i.test((option.card.extraText??[]).join(' '))?{...option,cost:0}:option);};
ccProviders.push(side=>{
 const out=[],x=battleSession,own=ccOwn(side);
 if(x?.damage&&x.damage.priority===side){
  for(const effect of ccEffects('Light:1132',side))if(ccEntry(effect.host)?.slot===x.site&&!ccEntry(effect.host).unavailable)for(const [i,device]of (effect.host.attachments??[]).entries())if(device.type==='Device'&&Number.isFinite(PremiereBattle.printedDestiny(device)))out.push(ccOption(effect.card,'deviceForfeit',[effect.card.instanceId,i],device.name+' forfeit ('+PremiereBattle.printedDestiny(device)+')',()=>{const value=PremiereBattle.printedDestiny(device),debt=x.damage.debt[side];effect.host.attachments.splice(effect.host.attachments.indexOf(device),1);loseOwnedCard(device,ccOwner(device));debt.damage=Math.max(0,debt.damage-value);debt.attrition=Math.max(0,debt.attrition-value);return true;}));
 }
 if(state.activeSide===side&&state.phase===2&&!battleSession)for(const effect of ccEffects('Light:184',side))for(const [i,patient]of (effect.support??[]).entries())for(const [j,entry]of ccUnits().entries())if(entry.side===side&&!entry.unavailable&&entry.card.id==='Light:2073'&&ccCharacterDeployAllowed(patient,state.locations[entry.slot],side)&&hothDeploymentAllowed(patient,state.locations[entry.slot],side))for(const role of PremiereUnits.roles(entry.card,patient))out.push(ccOption(effect.card,'redemptionPatient',[effect.card.instanceId,i,j,role],patient.name+' kostenlos an Bord von Redemption deployen',()=>{effect.support.splice(effect.support.indexOf(patient),1);PremiereUnits.add(entry.card,patient,role,side);openDeploymentReaction(side,[patient]);return true;}));
 return out;
});
ccResponseProviders.push((side,window)=>{
 if(window.kind!=='beforeBattleDestiny'||window.side!==side||!battleSession)return [];
 return ccEffects('Light:1112',side).filter(effect=>effect.site===window.site&&!ccUsed(effect.card,'haven','battle')).map(effect=>ccOption(effect.card,'havenDestiny',[effect.card.instanceId],'Optional eine Battle Destiny addieren',()=>{ccMark(effect.card,'haven','battle');battleSession.extraDraws[side]++;ccAnswer(side,window);return true;}));
});
const ccForceMovement=PremiereGame.moveTop;
PremiereGame.moveTop=function(from,to,count=1){if(cloudCityEnabled())for(const side of PremiereGame.sides){const own=ccOwn(side);if(from===own.force&&(to===own.hand||to===own.used))count=Math.min(count,ownForceBudget(side));}return ccForceMovement(from,to,count);};

function ccEquipmentKickback(side,card){if(!['Weapon','Device'].includes(card.type))return;const entry=ccEntry(card)??ccUnits().find(entry=>entry.card===card);if(entry&&ccUnits().some(other=>other.side===side&&!other.unavailable&&other.slot===entry.slot&&activeCardRules(other.card,'advosze').length))activateReserve(side,1);}
