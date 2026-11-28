'use strict';
function ccBeforeHandScan(side,source,next,sourceFrame=null){
 const frame={kind:'cloudCityHandScan',side,card:source,targetSide:PremiereGame.otherSide(side),sourceFrame};
 withShipWeaponResponse(frame,answer=>{const result=answer??frame;
  if(!result.scanTax){next();return;}
  const loseSource=()=>{
   const entry=ccEntry(source);if(entry)loseTableCard(entry.side,entry.slot,source);
   else{const own=ccOwn(ccOwner(source)),at=own.hand.indexOf(source);if(at>=0)own.hand.splice(at,1);if(!own.lost.includes(source))loseOwnedCard(source,ccOwner(source));if(sourceFrame)sourceFrame.cloudCityScanLost=true;}
   next();
  };dagoLoss(side,result.scanTax,source.name,loseSource);
 });return true;
}
ccInterruptProviders.push(({add,card,index,side,window})=>{
 if(!window||!['Light:2252','Dark:2255'].includes(card.id)||window.kind!=='cloudCityHandScan'||window.targetSide!==side)return;
 if(ccTitle(window.card)===(card.id==='Light:2252'?'monnok':'grimtaash'))return;
 add(card,index,'scanTax',[],'Scan fortsetzen: Gegner verliert 4 Force und die auslösende Karte');
});
const ccInformationBase={begin:beginCardInformation,settle:settleHothInterrupt,pile:settlePileInterrupt,ccSettle:ccSettleBattleInterrupt,response:initiateInterruptResponse};
beginCardInformation=function(side,index,preselected=null){
 const option=preselected??cardInformationOptions(side).find(option=>option.args[0]===index);
 if(!cloudCityEnabled()||!option||!['leesub','miiyoom'].includes(option.mode)||preselected)return ccInformationBase.begin(side,index,preselected);
 spendForce(side,option.cost);return ccBeforeHandScan(side,option.card,()=>ccInformationBase.begin(side,index,{...option,cloudCityPaid:true}));
};
settleHothInterrupt=function(frame,parent){
 if(!cloudCityEnabled()||frame.cancelled||!['perimeterHand','dago:frustration'].includes(frame.mode)||frame.cloudCityScanAnnounced)return ccInformationBase.settle(frame,parent);
 frame.cloudCityScanAnnounced=true;return ccBeforeHandScan(frame.side,frame.card,()=>ccInformationBase.settle(frame,parent),frame);
};
settlePileInterrupt=function(frame){
 if(!cloudCityEnabled()||frame.cancelled||!['scanning','radar'].includes(frame.rule?.mode)||frame.cloudCityScanAnnounced)return ccInformationBase.pile(frame);
 frame.cloudCityScanAnnounced=true;return ccBeforeHandScan(frame.side,frame.card,()=>ccInformationBase.pile(frame),frame);
};
ccSettleBattleInterrupt=function(frame,parent,done){if(frame.mode==='cc:scanTax'){parent.scanTax=(parent.scanTax??0)+4;done();return true;}return ccInformationBase.ccSettle(frame,parent,done);};
initiateInterruptResponse=function(side,index,mode,...args){
 if(!cloudCityEnabled()||mode!=='conquestPeek')return ccInformationBase.response(side,index,mode,...args);
 const window=PremiereGame.responseWindow(state.game),option=interruptResponses(side,window).find(option=>option.kind==='conquestPeek');if(!option)return false;
 window.conquestPeekUsed=true;window.passes=0;window.priority=PremiereGame.otherSide(side);return ccBeforeHandScan(side,option.card,()=>{state.pendingCardView={mode:'conquestPeek',side,card:option.card,shown:ccOwn(PremiereGame.otherSide(side)).hand.slice()};});
};
ccInterruptProviders.push(({add,card,index,window})=>{if(card.id==='Dark:1957'&&(window?.card?.id==='Light:111'&&window.hothEffect&&window.insert||window?.kind==='cloudCityAngerReveal'))add(card,index,'cancel',[],'Anger, Fear, Aggression beim Einsetzen/Aufdecken aufheben');});
const ccAngerTop=dagoResolveTop;
dagoResolveTop=function(side,next){
 const top=ccOwn(side).deck.at(-1);if(!cloudCityEnabled()||top?.id!=='Light:111'||!PremiereGame.isReserveInsert(top))return ccAngerTop(side,next);
 ccOwn(side).deck.pop();const owner=top.insertedIntoReserveBy;delete top.insertedIntoReserveBy;loseOwnedCard(top,owner);
 const frame={kind:'cloudCityAngerReveal',side:owner,card:top,targetSide:side};withShipWeaponResponse(frame,answer=>{if(!(answer??frame).cancelled)(state.dagobahBattleDemand??={})[side]=state.game.timing.turn+(state.activeSide===side?0:1);dagoResolveTop(side,next);});
};

const ccUnitScan=resolveHothUnit;
resolveHothUnit=function(side,option){if(!cloudCityEnabled()||option.mode!=='unitPeek')return ccUnitScan(side,option);PremiereGame.useOnce(state.game,'phase',option.key);return ccBeforeHandScan(side,option.device??option.card,()=>ccUnitScan(side,option));};
