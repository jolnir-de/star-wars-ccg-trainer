'use strict';
let jpStorageEnumerating=false;
function jpAlienStores(side){return [...ccEffects('Light:198',side),...ccEffects('Dark:697',side)].map(dagoOriginalEffect);}
function jpStoredAlienOptions(side){
 if(!jpEnabled()||jpStorageEnumerating||jpEnumerating||state.activeSide!==side||state.phase!==2||battleSession)return [];const out=[],own=jpOwn(side);
 for(const effect of jpAlienStores(side))for(const [i,card]of (effect.support??[]).entries()){
  jpStorageEnumerating=true;own.hand.push(card);let actions;try{actions=legalActions(state,side).filter(a=>a.card===card&&['deploy','transport'].includes(a.kind)&&!(a.kind==='transport'&&a.args[0]!=='deployAboard'));}finally{own.hand.splice(own.hand.indexOf(card),1);jpStorageEnumerating=false;}
  for(const action of actions)out.push(jpOption(effect.card,'storedAlien',[effect.card.instanceId,i,action.kind,...action.args],card.name+' aus '+effect.card.name+' deployen',()=>{effect.support.splice(effect.support.indexOf(card),1);own.hand.push(card);const result=executeAction(action);if(!result||own.hand.includes(card)){const index=own.hand.indexOf(card);if(index>=0)own.hand.splice(index,1);effect.support.splice(i,0,card);}return result;},{cost:action.cost??0,card,site:action.site??action.to??action.slot}));
 }return out;
}
ccProviders.push(jpStoredAlienOptions);
ccResponseProviders.push((side,window)=>{
 if(!jpEnabled()||window.kind!=='drain'||window.side===side)return [];const out=[],own=jpOwn(side);
 for(const effect of jpAlienStores(side))if(jpUnused(effect.card,'cancelDrain'))for(const [i,card]of own.hand.entries())if(card.subType==='Alien'&&JabbasPalaceRules.nonunique(card))out.push(jpOption(effect.card,'alienCancelDrain',[effect.card.instanceId,i],card.name+' auf '+effect.card.name+' legen · Drain aufheben',()=>{own.hand.splice(own.hand.indexOf(card),1);(effect.support??=[]).push(card);ccMark(effect.card,'jp:cancelDrain');PremiereGame.cancelResponse(state.game,window);ccAnswer(side,window);return true;}));
 return out;
});
const jpStorageBase={cancel:hothCancelEffect};
hothCancelEffect=function(effect,...args){
 if(!jpEnabled()||!['Light:198','Dark:697'].includes(effect.card.id)||!effect.support?.length)return jpStorageBase.cancel(effect,...args);
 const side=ccOwner(effect.card),original=dagoOriginalEffect(effect),stored=original.support.splice(0),window=PremiereGame.responseWindow(state.game),cause=state.resolvingInterrupts?.at(-1)?.side??window?.side,opponent=!!cause&&cause!==side;
 const result=jpStorageBase.cancel(original,...args);
 if(!opponent){for(const card of stored)loseOwnedCard(card,ccOwner(card),'support');return result;}
 // A separate support holder remains only for this optional immediate deployment.
 const holder=effect.card,own=jpOwn(side);state.jpRescuedAliens={side,cards:stored};
 const next=()=>{if(!stored.length){delete state.jpRescuedAliens;return;}const card=stored[0];own.hand.push(card);const old=state.jpFreeDeploy;state.jpFreeDeploy=card;jpEnumerating=true;let actions;
  try{actions=ccAsDeployment(side,()=>legalActions(state,side).filter(a=>a.card===card&&['deploy','transport'].includes(a.kind)));}finally{jpEnumerating=false;state.jpFreeDeploy=old;own.hand.splice(own.hand.indexOf(card),1);}
  jpChoose(side,holder,'StoreCanceled',[...actions.map((action,i)=>({args:[i],card,action,label:card.name+' kostenlos deployen'})),{args:['lost'],label:card.name+' verlieren'}],choice=>{stored.shift();if(choice.action){own.hand.push(card);const prior=state.jpFreeDeploy;state.jpFreeDeploy=card;try{ccAsDeployment(side,()=>executeAction(choice.action));}finally{state.jpFreeDeploy=prior;}const at=own.hand.indexOf(card);if(at>=0){own.hand.splice(at,1);loseOwnedCard(card,side,'support');}}else loseOwnedCard(card,side,'support');if(state.pendingCardView||PremiereGame.responseWindow(state.game))(state.hothDeferred??=[]).push(next);else next();});
 };(state.hothDeferred??=[]).push(next);return result;
};
