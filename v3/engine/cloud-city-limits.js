'use strict';
const ccPlayTitle=card=>ccTitle(card);
function ccPlayCount(card,side){return (state.cloudCityPlayRecords??[]).filter(record=>record.turn===state.game.timing.turn&&(record.title===ccPlayTitle(card)||record.side===side&&card.personas?.some(persona=>record.personas.includes(persona)))).length;}
function ccCardPlayAllowed(card,side){const limit=cardUniquenessLimit(card);return !Number.isFinite(limit)||ccPlayCount(card,side)<limit;}
function ccRecordPlay(card,side){
 if(!Number.isFinite(cardUniquenessLimit(card)))return;
 const turn=state.game.timing.turn,records=state.cloudCityPlayRecords=(state.cloudCityPlayRecords??[]).filter(record=>record.turn===turn);
 if(records.some(record=>record.instance===card.instanceId&&record.revision===state.game.revision))return;
 records.push({turn,title:ccPlayTitle(card),personas:card.personas?.slice()??[],side,instance:card.instanceId,revision:state.game.revision});
}
function ccIsPlay(action){return !!action.card&&ccOwn(action.side).hand.includes(action.card)&&!['loseForce','battleForceLoss','battleHandForfeit','finishCardInformation','takeFromReserve','recycleHand','cancelCardInformation'].includes(action.kind)&&action.mode!=='cc:storeCard';}
const ccLimitsBase={legal:legalActions,execute:executeAction,deploy:openDeploymentReaction,within:withinDeploymentLimit,interrupts:hothInterruptOptions,responses:interruptResponses,detach:detachTableCard};
legalActions=function(position,side,request){const actions=ccLimitsBase.legal(position,side,request);return !cloudCityEnabled()||position!==state?actions:actions.filter(action=>(action.kind!=='draw'||ownForceBudget(side)>0)&&(!ccIsPlay(action)||action.mode==='cc:convertLando'||ccCardPlayAllowed(action.card,side)));};
executeAction=function(action){const play=cloudCityEnabled()&&ccIsPlay(action),result=ccLimitsBase.execute(action);if(result&&play)ccRecordPlay(action.card,action.side);return result;};
openDeploymentReaction=function(side,cards){if(cloudCityEnabled())for(const card of cards)ccRecordPlay(card,side);return ccLimitsBase.deploy(side,cards);};
withinDeploymentLimit=function(card,side){
 if(cloudCityEnabled()){
  if(!ccCardPlayAllowed(card,side))return false;
  const limit=cardUniquenessLimit(card);if(Number.isFinite(limit)&&card.type!=='Location'){
   const onTable=[...ccUnits().map(entry=>entry.card),...ccAllEffects().map(effect=>effect.card),...(state.lostPileEffects??[]).map(effect=>effect.card)],unique=[...new Set(onTable)];
   if(unique.filter(other=>ccPlayTitle(other)===ccPlayTitle(card)).length>=limit)return false;
  }
 }return ccLimitsBase.within(card,side);
};
hothInterruptOptions=function(side,window=null){const options=ccLimitsBase.interrupts(side,window);return cloudCityEnabled()?options.filter(option=>ccCardPlayAllowed(option.card,side)):options;};
interruptResponses=function(side,window){const options=ccLimitsBase.responses(side,window);return cloudCityEnabled()?options.filter(option=>!ccOwn(side).hand.includes(option.card)||ccCardPlayAllowed(option.card,side)):options;};
detachTableCard=function(side,slot,card){if(cloudCityEnabled()&&card?.id==='Light:244'&&ccUnits().some(entry=>entry.card.attachments?.includes(card)))return false;return ccLimitsBase.detach(side,slot,card);};
