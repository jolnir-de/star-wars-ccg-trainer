'use strict';
const ccTimingBase={canBattle:canInitiateBattleFor,battle:initiateBattleFor,queue:queueRuleResponse,loss:loseOwnedCard,damage:battleDamageOptions,action:battleDamageAction,side:PremiereLocations.printedSide,jedi:dagoJediTargets};
function ccUrchinsPayment(side,site){
 const effects=ccEffects('Light:84').filter(effect=>effect.site===site),own=ccOwn(side);
 const reserve=Math.min(ownForceBudget(side),Math.max(0,battleInitiationCost(site)-beggarCredit(side)));
 // Force below Frozen Assets cannot be reached while preserving a payable top
 // card. With no reserved own Force, ordinary Force-loss rules may use it.
 const available=own.hand.length+PremiereGame.reserveCards(own.deck).length+own.used.length+(reserve?Math.max(0,ownForceBudget(side)-reserve):own.force.length);
 return {effects,reserve,amount:2*effects.length,affordable:available>=2*effects.length};
}
canInitiateBattleFor=function(side,site){return ccTimingBase.canBattle(side,site)&&(!cloudCityEnabled()||state.cloudCityUrchinsPaid||ccUrchinsPayment(side,site).affordable);};
initiateBattleFor=function(side,site,...args){
 if(!cloudCityEnabled()||state.cloudCityUrchinsPaid)return ccTimingBase.battle(side,site,...args);
 const {effects,reserve,amount,affordable}=ccUrchinsPayment(side,site);if(!effects.length)return ccTimingBase.battle(side,site,...args);
 if(!canInitiateBattleFor(side,site))return false;
 if(!affordable)return false;
 const after=()=>{state.cloudCityUrchinsPaid=true;try{if(ccTimingBase.battle(side,site,...args))for(const effect of effects)if(ccOwner(effect.card)===side)hothCancelEffect(effect);}finally{delete state.cloudCityUrchinsPaid;}};
 beginForceLoss(side,amount,{reason:'All My Urchins',hoth:true,cloudCityReservedForce:reserve,after});return true;
};
queueRuleResponse=function(frame){
 if(cloudCityEnabled()&&['battleEnd','finishedBattle'].includes(frame.kind))frame.fallen=(state.cloudCityBattleFallen??[]).filter(record=>record.turn===state.game.timing.turn&&record.site===frame.site).map(record=>record.card);
 return ccTimingBase.queue(frame);
};
loseOwnedCard=function(card,side,source='table',site,...args){
 if(cloudCityEnabled()&&source==='table'&&card.type==='Character'&&battleSession?.participants?.[side]?.includes(card))(state.cloudCityBattleFallen??=[]).push({card,site:site??battleSession.site,turn:state.game.timing.turn});
 return ccTimingBase.loss(card,side,source,site,...args);
};
battleDamageOptions=function(side){const options=ccTimingBase.damage(side);return cloudCityEnabled()&&battleSession?.cloudCityPiratesLoser===side&&ccOwn(side).hand.length?options.filter(option=>option.kind!=='battleForceLoss'||option.args[0]==='hand'):options;};
dagoJediTargets=function(side,...args){const targets=ccTimingBase.jedi(side,...args);return cloudCityEnabled()&&ccEffects('Dark:2768').length?targets.filter(pair=>!ccPersona(pair.apprentice?.card??pair.apprentice,'Luke')):targets;};
ccProviders.push(side=>{
 if(state.activeSide!==side||state.phase!==4||battleSession)return [];const out=[];
 for(const effect of ccEffects('Light:84',side))if(!ccUsed(effect.card,'move'))for(const [to,loc]of state.locations.entries())if(isSite(loc)&&adjacentSites(effect.site,to))out.push(ccOption(effect.card,'urchinsMove',[effect.site,to],loc.name+' (1 Force)',()=>{if(forceBudget(side)<1)return false;spendForce(side,1);const original=dagoOriginalEffect(effect);state.locationEffects[effect.site].splice(state.locationEffects[effect.site].indexOf(original),1);original.site=to;(state.locationEffects[to]??=[]).push(original);ccMark(effect.card,'move');return true;},{cost:1}));
 return out;
});
ccContinuousProviders.push(()=>{
 for(const effect of ccEffects('Dark:2524')){
  if(effect.prizeReached)continue;const target=effect.captive,entry=ccEntry(target),destination=effect.host?ccEntry(effect.host)?.slot:effect.site;
  if(entry&&entry.slot===destination&&ccPresent('Dark',destination).some(card=>ccPersona(card,'Vader'))){const original=dagoOriginalEffect(effect);original.prizeReached=true;
   if(Number.isInteger(effect.site)){state.locationEffects[effect.site].splice(state.locationEffects[effect.site].indexOf(original),1);delete original.site;(state.tableEffects??=[]).push(original);}
   original.host=target;(target.attachments??=[]).push(effect.card);(state.hothDeferred??=[]).push(()=>dagoLoss('Light',Math.floor(lifeForceRemaining('Light')/2),'The Emperor’s Prize'));
  }
 }
});

const ccUrchinLossChoices=PremiereGame.lossChoices,ccUrchinReduce=forceLossReductionOptions;
PremiereGame.lossChoices=function(position,side,...args){const choices=ccUrchinLossChoices(position,side,...args),reserve=position.pendingForceLoss?.payer===side?position.pendingForceLoss.cloudCityReservedForce??0:0;return reserve&&ownForceBudget(side)<=reserve?choices.filter(choice=>choice.args[0]!=='force'):choices;};
forceLossReductionOptions=function(side,debt,key){const options=ccUrchinReduce(side,debt,key);return debt.cloudCityReservedForce?options.filter(option=>(option.amount??0)<=Math.max(0,ownForceBudget(side)-debt.cloudCityReservedForce)):options;};
