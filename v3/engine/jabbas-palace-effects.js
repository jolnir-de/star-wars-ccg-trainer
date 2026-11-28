'use strict';
function jpEffectOptions(side,window=null){
 const out=[],own=jpOwn(side);if(!jpEnabled())return out;
 const add=(card,index,args,label,extra={})=>{const cost=extra.cost??0;if(withinDeploymentLimit(card,side)&&cost<=forceBudget(side))out.push({card,index,choice:[index,...args],label:card.name+' · '+label,cost,...extra});};
 own.hand.forEach((card,index)=>{
  if(card.set!=='6'||card.type!=='Effect'||ccOwner(card)!==side)return;
  if(window){
   if(card.id==='Light:25'&&window.kind==='jpDroidMoved'&&window.side===side&&isDroid(window.card)&&/audience chamber$/.test(jpTitle(state.locations[window.site])))add(card,index,[],'Droid als Undercover Spy einsetzen',{host:window.card});
   if(card.id==='Dark:350'&&window.kind==='drain'&&window.side!==side&&state.locations[window.site]?.locationTags?.includes('Planet')&&!HothRules.shielded(state,window.site))add(card,index,[],'Ohne Presence zu dieser Location deployen',{site:window.site});
   return;
  }
  if(state.activeSide!==side||state.phase!==2||battleSession)return;
  if(['Light:198','Light:2665','Light:2845','Dark:90','Dark:697','Dark:1310','Dark:1978','Dark:2096','Dark:2792'].includes(card.id))add(card,index,[],'Auf den Tisch auslegen');
  if(card.id==='Light:1956')add(card,index,['table'],'Hologramme und A Shot In The Dark verstärken');
  state.locations.forEach((loc,site)=>{
   if(!loc)return;
   if(card.id==='Light:1956'&&isSite(loc)&&loc.locationTags?.includes('Planet'))add(card,index,[site],loc.name,{site});
   if(card.id==='Light:285'&&/audience chamber$/.test(jpTitle(loc)))add(card,index,[site],loc.name,{site});
   if(card.id==='Dark:2188'&&/audience chamber$/.test(jpTitle(loc)))add(card,index,[site],loc.name,{site});
   if(card.id==='Light:1218'&&jpPalace(loc))add(card,index,[site],loc.name,{site});
   if(['Light:2171','Dark:2170'].includes(card.id)&&jpDesert(loc))for(const direction of [-1,1])add(card,index,[site,direction],loc.name+' · Sandsturm '+(direction<0?'nach links':'nach rechts'),{site,jpDirection:direction});
  });
  if(card.id==='Dark:1192')for(const [i,e]of jpUnits().entries())if(e.side!==side&&!e.unavailable&&e.card.type==='Character'&&['smuggler','gambler','thief'].some(t=>characterTraits(e.card).includes(t)))add(card,index,[i],e.card.name,{host:e.card});
 });return out;
}
const jpEffectBase={options:hothEffectOptions,settle:settleHothEffect,charCost:crewDeployCost,craftCost:craftDeployCost,presence:hasDeployPresence,allowed:characterLocationAllowed,begin:canInitiateBattleFor,drain:forceDrainEffects,drainPlan:drainPlan,loss:beginForceLoss,alter:alterTarget,moved:hothMoved,initiate:initiateBattleFor,deploy:openDeploymentReaction};
hothEffectOptions=function(side,window=null){return jpEffectBase.options(side,window).concat(jpEffectOptions(side,window));};
settleHothEffect=function(frame){
 if(!jpEnabled()||frame.card.set!=='6')return jpEffectBase.settle(frame);if(frame.cancelled){loseOwnedCard(frame.card,frame.side);return;}
 const {card,side}=frame,effect={...frame,target:frame.host??side,jabbasPalace:true};delete effect.kind;
 if(frame.host){(frame.host.attachments??=[]).push(card);(state.tableEffects??=[]).push(effect);}else if(Number.isInteger(frame.site))(state.locationEffects[frame.site]??=[]).push(effect);else(state.tableEffects??=[]).push(effect);
 if(card.id==='Light:25'){frame.host.undercover=true;frame.host.jpGiftSpy=true;}
 if(['Light:198','Dark:697'].includes(card.id))effect.support=[];
 if(frame.information){const enemy=PremiereGame.otherSide(side),shown=PremiereGame.reserveCards(jpOwn(enemy).deck).slice(-4).reverse(),parent=state.game.responses.find(w=>w.kind==='battle');const choices=[{args:['done'],label:'Battle fortsetzen'}];if(lifeForceRemaining(side)+jpOwn(side).hand.length>0)choices.push({args:['cancel'],label:'1 Force verlieren und Battle aufheben'});jpChoose(side,card,'InformationExchange',choices,choice=>{if(choice.args[0]==='cancel')dagoLoss(side,1,card.name,()=>{if(parent)PremiereGame.cancelResponse(state.game,parent);});},{shown,publicView:false});}
};
function jpScum(side){return ccEffects('Dark:2188',side).some(effect=>jpUnits().every(e=>e.side!==side||e.unavailable||(e.card.type==='Starship'?permanentPilotAbility(e.card)??0:cardAbility(e.card))===0||e.card.subType==='Alien'||e.card.type==='Starship'&&(e.card.characteristics??[]).includes('independent')||e.carriers.some(c=>c.type==='Starship'&&(c.characteristics??[]).includes('independent')&&c.occupants?.some(o=>o.card===e.card&&o.role==='pilot'))));}
crewDeployCost=function(card,side,loc){const cost=jpEffectBase.charCost(card,side,loc);return jpEnabled()&&card.subType==='Alien'&&jpScum(side)?Math.max(0,cost-1):cost;};
craftDeployCost=function(card,loc,side,...args){const cost=jpEffectBase.craftCost(card,loc,side,...args);return cost===null||!jpEnabled()?cost:Math.max(0,cost+(jpScum(side)&&card.type==='Starship'?-1:0)+jpLocationCost(card,side,loc));};
hasDeployPresence=function(side,loc){return jpEnabled()&&(ccEffects('Dark:350',side).some(e=>state.locations[e.site]===loc)||jpAll(side,'Dark:1972').some(e=>state.locations[e.slot]===loc)&&!HothRules.shielded(state,state.locations.indexOf(loc)))||jpEffectBase.presence(side,loc);};
characterLocationAllowed=function(card,loc){if(jpEnabled()&&(card.subType==='Imperial'&&jpAll(ccOwner(card),'Dark:1972').some(e=>state.locations[e.slot]===loc)&&!HothRules.shielded(state,state.locations.indexOf(loc))||ccEffects('Dark:350',ccOwner(card)).some(e=>state.locations[e.site]===loc)||ccPersona(card,'Luke')&&ccEffects('Light:1218',ccOwner(card)).some(e=>state.locations[e.site]===loc)))return true;return jpEffectBase.allowed(card,loc);};
function jpBoShuda(slot){return ccEffects('Light:285').some(e=>e.site===slot&&ccPresent(ccOwner(e.card),slot).some(c=>c.subType==='Alien'));}
canInitiateBattleFor=function(side,slot){return !(jpEnabled()&&jpBoShuda(slot))&&jpEffectBase.begin(side,slot);};
drainPlan=function(side,slot){return jpEnabled()&&jpBoShuda(slot)?null:jpEffectBase.drainPlan(side,slot);};
forceDrainEffects=function(side,slot){const plan=jpEffectBase.drain(side,slot);if(!plan||!jpEnabled())return plan;const enemy=PremiereGame.otherSide(side),rows=[],projection=ccEffects('Light:1956',enemy).find(e=>e.site===slot),alien=ccEffects('Light:25',enemy)[0];
 if(projection)rows.push(V3DrainTrace.term('modifier',-1,projection.card,'Projection am Standort',slot));
 if(alien&&ccPresent(side,slot).some(c=>c.subType==='Alien'))rows.push(V3DrainTrace.term('modifier',-1,alien.card,'Globaler Abzug bei Alien-Presence'));
 return V3DrainTrace.modify(plan,rows);
};
function jpBattleground(slot){const loc=state.locations[slot];return !!loc&&!loc.collapsed&&!loc.blownAway&&(PremiereLocations.icons(state,slot,'Light')??0)>0&&(PremiereLocations.icons(state,slot,'Dark')??0)>0;}
function jpLossCap(side){const own=state.locations.filter((_,i)=>jpBattleground(i)&&PremiereLocations.occupy(state,side,i,cardAbility)===true).length,enemy=state.locations.some((_,i)=>jpBattleground(i)&&PremiereLocations.occupy(state,PremiereGame.otherSide(side),i,cardAbility)===true);return own>=3||!enemy;}
beginForceLoss=function(side,amount,terms){if(jpEnabled()&&['drain','insert'].includes(terms.reason)&&[...ccEffects('Light:2665',side),...ccEffects('Dark:2096',side)].length&&jpLossCap(side)){
 const source=[...ccEffects('Light:2665',side),...ccEffects('Dark:2096',side)][0],next=Math.min(2,amount);
 if(terms.reason==='drain'&&next!==amount)terms={...terms,drainLimits:[...(terms.drainLimits??[]),V3DrainTrace.term('loss',next-amount,source.card,'Verlust auf 2 begrenzt')]};amount=next;
}return jpEffectBase.loss(side,amount,terms);};
alterTarget=function(card,site){if(jpEnabled()&&card?.set==='6'){
 if(['Light:2665','Dark:2096'].includes(card.id))return false;
 if(card.id==='Light:1956'&&ccAllEffects().some(e=>e.card===card&&!Number.isInteger(e.site)))return false;
 if(['Light:2845','Dark:2792'].includes(card.id)&&state.locations.filter((_,i)=>jpBattleground(i)&&PremiereLocations.occupy(state,ccOwner(card),i,cardAbility)===true).length>=2)return false;
 if(card.id==='Dark:2188'&&state.locations.filter((l,i)=>jpPalace(l)&&jpControl(ccOwner(card),i)).length>=3)return false;
 }return jpEffectBase.alter(card,site);};
hothMoved=function(side,card,from,to,...args){const result=jpEffectBase.moved(side,card,from,to,...args);if(jpEnabled()&&isDroid(card)&&/audience chamber$/.test(jpTitle(state.locations[to])))queueRuleResponse({kind:'jpDroidMoved',side,card,site:to});return result;};
openDeploymentReaction=function(side,cards){
 const result=jpEffectBase.deploy(side,cards);if(!jpEnabled())return result;
 for(const card of cards){const e=jpEntry(card);if(!e)continue;
  if(characterTraits(card).includes('musician'))for(const jess of jpAll(side,'Light:1393'))if(jess.slot===e.slot)PremiereGame.retrieveForce(state,side,1);
  if(card.type==='Character'&&card.destiny===1)for(const source of jpAll(PremiereGame.otherSide(side),'Light:2507'))activateReserve(source.side,1);
  if(ccPersona(card,'Luke'))for(const effect of ccEffects('Light:1218',side))if(effect.site===e.slot){const original=dagoOriginalEffect(effect);state.locationEffects[effect.site].splice(state.locationEffects[effect.site].indexOf(original),1);delete original.site;original.host=card;original.target=card;(card.attachments??=[]).push(original.card);state.tableEffects.push(original);}
 }return result;
};
jpContinuous.push(()=>{
 for(const effect of ccEffects('Light:25'))if(!jpEntry(effect.host)||sitePlanet(state.locations[jpEntry(effect.host).slot])!=='tatooine')hothCancelEffect(dagoOriginalEffect(effect));
 for(const effect of ccEffects('Light:285')){const enemy=PremiereGame.otherSide(ccOwner(effect.card));if(PremiereLocations.occupy(state,enemy,effect.site,cardAbility)===true&&!ccPresent(enemy,effect.site).some(c=>c.subType==='Alien'))hothCancelEffect(dagoOriginalEffect(effect));}
 for(const effect of [...ccEffects('Light:2171'),...ccEffects('Dark:2170')])for(const e of jpUnits())if(e.slot===effect.site&&!e.unavailable&&e.card.type==='Character'&&!jpSpecies(e.card,'jawa')&&!jpSpecies(e.card,'tusken raider')&&!['Light:784','Light:1447'].includes(e.card.id)&&!e.card.attachments?.some(c=>c.id==='Light:2646'&&jpDoallyn(ccOwner(e.card))))e.card.missing=true;
});
ccTiming.push(event=>{
 if(!jpEnabled()||event!=='phase:start'||state.phase!==1)return [];const side=state.activeSide,tasks=[];
 for(const effect of [...ccEffects('Light:2171',side),...ccEffects('Dark:2170',side)])tasks.push(done=>{const original=dagoOriginalEffect(effect),order=boardLocationOrder(),from=order.indexOf(effect.site);let direction=original.jpDirection??1,next=order[from+direction];if(next===undefined||sitePlanet(state.locations[next])!==sitePlanet(state.locations[effect.site])){direction*=-1;next=order[from+direction];}original.jpDirection=direction;if(next!==undefined&&sitePlanet(state.locations[next])===sitePlanet(state.locations[effect.site])){state.locationEffects[effect.site].splice(state.locationEffects[effect.site].indexOf(original),1);original.site=next;(state.locationEffects[next]??=[]).push(original);if(state.locations[next].locationTags?.includes('Interior'))hothCancelEffect(original);}done();});return tasks;
});
