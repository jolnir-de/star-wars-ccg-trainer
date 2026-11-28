'use strict';
let ccStorageEnumerating=false;
function ccStorageDevices(side){return ccUnits().filter(entry=>entry.card.id==='Light:592'&&ccOwner(entry.card)===side&&!entry.unavailable&&ccText(entry.card));}
function ccStorageHost(device){return ccUnits().find(entry=>entry.card.attachments?.includes(device))?.card;}
function ccStorageOptions(side){
 if(ccStorageEnumerating)return [];const out=[],own=ccOwn(side);
 for(const {card:device}of ccStorageDevices(side)){
  const stored=device.cloudCityStored??=[],host=ccStorageHost(device),limit=host?.id==='Light:1562'?6:3;
  if(!PremiereGame.responseWindow(state.game)&&!ccUsed(device,'store')&&stored.length<limit)for(const [i,card]of own.hand.entries())out.push(ccOption(device,'storeCard',[device.instanceId,i],card.name+' verdeckt speichern',()=>{own.hand.splice(own.hand.indexOf(card),1);(device.cloudCityStored??=[]).push(card);ccMark(device,'store');return true;}));
  for(const [i,card]of stored.entries()){
   let offers;ccStorageEnumerating=true;own.hand.push(card);
   try{offers=legalActions(state,side).filter(action=>(action.card===card||action.ship===card)&&!['cardInformation','recycleHand','loseForce','battleForceLoss','battleHandForfeit'].includes(action.kind));}
   finally{own.hand.splice(own.hand.indexOf(card),1);ccStorageEnumerating=false;}
   for(const action of offers)out.push(ccOption(card,'playStored',[device.instanceId,i,action.kind,...action.args],action.label??card.name,()=>{
    const index=stored.indexOf(card);if(index<0)return false;stored.splice(index,1);own.hand.push(card);
    const result=executeAction(action);if(!result){own.hand.splice(own.hand.indexOf(card),1);stored.splice(index,0,card);return false;}
    if(!own.hand.includes(card))ccEquipmentKickback(side,card);
    if(own.hand.includes(card))(state.cloudCityBorrowedStorage??=[]).push({device,card,side});return true;
   },{cost:action.cost??0,storedAction:action}));
  }
 }return out;
}
ccProviders.push(ccStorageOptions);ccResponseProviders.push(ccStorageOptions);
function ccEmptyStorage(device){for(const card of device.cloudCityStored??[])ccOwn(ccOwner(card)).used.push(card);device.cloudCityStored=[];}
const ccStorageBase={lose:loseOwnedCard};
loseOwnedCard=function(card,...args){if(cloudCityEnabled()&&card.id==='Light:592')ccEmptyStorage(card);return ccStorageBase.lose(card,...args);};
ccContinuousProviders.push(()=>{
 for(const {card:device}of ccUnits().filter(entry=>entry.card.id==='Light:592')){const host=ccStorageHost(device);if(device.cloudCityStorageHostId&&device.cloudCityStorageHostId!==host?.instanceId){ccEmptyStorage(device);device.cloudCityStorageHostId=host?.instanceId;}}
 if(state.pendingCardView||state.pendingForceLoss||PremiereGame.responseWindow(state.game))return;
 for(const item of state.cloudCityBorrowedStorage??[]){const hand=ccOwn(item.side).hand,index=hand.indexOf(item.card);if(index>=0){hand.splice(index,1);if(ccEntry(item.device))(item.device.cloudCityStored??=[]).push(item.card);else ccOwn(ccOwner(item.card)).used.push(item.card);}}
 delete state.cloudCityBorrowedStorage;
});
