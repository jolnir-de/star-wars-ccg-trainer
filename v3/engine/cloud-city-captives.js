'use strict';
const ccCaptives=escort=>[escort.escortedCaptive,...escort.additionalCaptives??[]].filter(Boolean);
const ccBinders=escort=>escort.attachments?.some(card=>card.id==='Dark:243'&&ccText(card));
function ccSetCaptives(escort,captives){delete escort.escortedCaptive;delete escort.additionalCaptives;if(captives.length)escort.escortedCaptive=captives[0];if(captives.length>1)escort.additionalCaptives=captives.slice(1);}
function ccDropCaptive(card,slot,carrier=null){
 card.captured=true;card.controller='Dark';delete card.imprisoned;
 if(carrier){(carrier.occupants??=[]).push({card,role:'passenger'});return;}
 if(isSite(state.locations[slot])){state.dark[slot].push(card);return;}
 clearCaptivity(card);ccOwn('Light').used.push(card);
}
function ccEscortRemoved(unit,root,slot,carrier){
 const captives=ccCaptives(unit);if(!captives.length)return;
 ccSetCaptives(unit,[]);
 for(const captive of captives){
  if(unit!==root){clearCaptivity(captive);PremiereUnits.remove(captive,card=>loseOwnedCard(card,card.owner??'Light'),card=>loseOwnedCard(card,card.owner??'Light'));}
  else if(captive.frozen)ccDropCaptive(captive,slot,carrier);
  else (state.pendingCustody??=[]).push({side:'Light',card:captive,slot});
 }
}
function ccCaptiveReward(card,escort,slot){
 const forfeit=(cardForfeitValueAt(card,'Light',slot)??0)+(!ccUnits().some(entry=>ccCaptives(entry.card).includes(card))?(ccOn(escort,'Dark:287')?5:ccOn(escort,'Dark:1537')?2:0):0),location=state.locations[slot],vader=ccPresent('Dark',slot).some(unit=>ccPersona(unit,'Vader'));
 for(const effect of [...state.tableEffects??[]])if(effect.host===card&&card.cloudCitySeizedByBounty===escort?.instanceId){
  if(effect.card.id==='Dark:316'){const amount=Math.max(0,forfeit-2);PremiereGame.retrieveForce(state,'Dark',amount);state.tableEffects.splice(state.tableEffects.indexOf(effect),1);card.attachments?.splice(card.attachments.indexOf(effect.card),1);ccOwn('Dark').used.push(effect.card);}
  if(effect.card.id==='Dark:2697'&&vader){PremiereGame.retrieveForce(state,'Dark',forfeit+(ccPersona(card,'Luke')?4:0));cancelTableEffect(effect);}
 }
 if(!card.cloudCityDelivered){
  card.cloudCityDelivered=true;
  for(const effect of ccEffects('Dark:2323','Dark'))if(effect.site===slot&&characterTraits(escort).includes('trooper')){
   ccChoose('Dark',effect.card,'SpecialDelivery',ccOwn('Dark').lost.map((card,index)=>({args:[index],card,label:card.name})),choice=>{if(choice){ccOwn('Dark').lost.splice(ccOwn('Dark').lost.indexOf(choice.card),1);ccOwn('Dark').hand.push(choice.card);}cancelLocationEffect(slot,dagoOriginalEffect(effect));});
  }
 }
}
const ccCaptiveBase={escorts:escortChoices,custody:resolveCustody,transfer:transferPrisoner,ability:cardAbility,clear:clearCaptivity};
escortChoices=function(slot,present=false){
 if(!cloudCityEnabled())return ccCaptiveBase.escorts(slot,present);
 return PremiereLocations.entries(state,'Dark').flatMap((entry,index)=>{
  const card=entry.card;if(entry.slot!==slot||entry.unavailable||!PremiereUnits.canEscort(card)||card.escortedCaptive&&!ccBinders(card)||present&&!PremiereLocations.present(state,card,slot))return [];
  const host=entry.carriers[0],seat=host?.occupants?.find(occupant=>occupant.card===card);
  if(seat&&!PremiereUnits.accepts(host,card,seat.role,seat,ccCaptives(card).length+1))return [];
  return [{card,index}];
 });
};
resolveCustody=function(option){
 if(!cloudCityEnabled())return ccCaptiveBase.custody(option);
 const pending=state.pendingCustody[0];
 if(option.args[0]==='seize'){
  pending.card.cloudCitySeizedByBounty=PremiereUnits.bountyHunter(option.escort)?option.escort.instanceId:null;
  if(option.escort.escortedCaptive&&ccBinders(option.escort)){state.pendingCustody.shift();pending.card.controller='Dark';ccSetCaptives(option.escort,[...ccCaptives(option.escort),pending.card]);return true;}
 }
 return ccCaptiveBase.custody(option);
};
transferPrisoner=function(option){
 if(!cloudCityEnabled())return ccCaptiveBase.transfer(option);
 if(option.args[0]==='take'&&option.escort.escortedCaptive&&ccBinders(option.escort)){
  if(!detachTableCard('Dark',option.args[1],option.card))return false;delete option.card.imprisoned;ccSetCaptives(option.escort,[...ccCaptives(option.escort),option.card]);return true;
 }
 const result=ccCaptiveBase.transfer(option);if(result&&option.args[0]==='deliver')ccCaptiveReward(option.card,option.escort,option.args[1]);return result;
};
cardAbility=function(card){return cloudCityEnabled()&&card?.frozen?0:ccCaptiveBase.ability(card);};
clearCaptivity=function(card){ccCaptiveBase.clear(card);delete card.cloudCityDelivered;delete card.cloudCitySeizedByBounty;};
ccProviders.push(side=>{
 const out=[];if(battleSession)return out;
 for(const [index,entry] of ccUnits().entries())if(entry.side==='Dark'&&entry.card.captured&&!entry.card.imprisoned&&!ccUnits().some(host=>ccCaptives(host.card).includes(entry.card))){
  if(side==='Light'&&state.activeSide===side&&state.phase===1&&entry.card.frozen&&ccControl(side,entry.slot))out.push(ccOption(entry.card,'freeFrozen',[index],entry.card.name+' aus Carbonit befreien',()=>{detachTableCard('Dark',entry.slot,entry.card);if(isSite(state.locations[entry.slot]))rallyCaptive(entry.card,entry.slot);else{clearCaptivity(entry.card);ccOwn('Light').used.push(entry.card);}return true;},{site:entry.slot}));
  if(side==='Dark'&&state.activeSide===side&&state.phase===4)for(const escort of escortChoices(entry.slot,true))out.push(ccOption(entry.card,'takeFrozen',[index,escort.index],escort.card.name+' übernimmt '+entry.card.name,()=>{detachTableCard('Dark',entry.slot,entry.card);ccSetCaptives(escort.card,[...ccCaptives(escort.card),entry.card]);return true;},{site:entry.slot}));
 }
 if(side==='Dark'&&state.activeSide===side&&state.phase===4)for(const [index,entry] of ccUnits().entries())if(entry.side===side&&!entry.unavailable)for(const [i,captive] of ccCaptives(entry.card).entries()){
  if(captive.frozen)out.push(ccOption(captive,'dropFrozen',[index,i],'Carbonit-Gefangenen hier zurücklassen',()=>{ccSetCaptives(entry.card,ccCaptives(entry.card).filter(card=>card!==captive));ccDropCaptive(captive,entry.slot,entry.carriers[0]);return true;},{site:entry.slot}));
  if(i>0&&PremiereLocations.prison(state.locations[entry.slot])&&PremiereLocations.presentAt(entry,entry.slot))out.push(ccOption(captive,'deliverAdditional',[index,i],captive.name+' inhaftieren',()=>{ccSetCaptives(entry.card,ccCaptives(entry.card).filter(card=>card!==captive));imprisonCaptive(captive,entry.slot);ccCaptiveReward(captive,entry.card,entry.slot);return true;},{site:entry.slot}));
 }
 return out;
});
ccContinuousProviders.push(()=>{
 for(const entry of ccUnits())if(entry.card.additionalCaptives?.length&&!ccBinders(entry.card)&&!entry.card.cloudCityBinderChoice){
  const escort=entry.card;escort.cloudCityBinderChoice=true;
  const choose=()=>{if(!ccEntry(escort)){delete escort.cloudCityBinderChoice;return;}
   ccChoose('Dark',escort,'BindersLost',ccCaptives(escort).map((card,index)=>({args:[index],card,label:card.name+' in Eskorte behalten'})),choice=>{const released=ccCaptives(escort).filter(card=>card!==choice.card);ccSetCaptives(escort,[choice.card]);delete escort.cloudCityBinderChoice;for(const card of released)if(card.frozen)ccDropCaptive(card,entry.slot,entry.carriers[0]);else(state.pendingCustody??=[]).push({side:'Light',card,slot:entry.slot});});
  };
  if(state.pendingCardView||state.pendingForceLoss||PremiereGame.responseWindow(state.game))(state.hothDeferred??=[]).push(choose);else choose();
 }
});
