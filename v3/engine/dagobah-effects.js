'use strict';
const dagoInsertIds=new Set(['Light:111','Light:1768','Dark:4','Dark:1450']);
function dagoEffectOptions(side,window=null){
 const options=[],own=dagoOwn(side),enemy=PremiereGame.otherSide(side),all=dagoUnits(),add=(card,index,choice,label,extra={})=>{const cost=extra.cost??0;if(cost<=forceBudget(side)&&withinDeploymentLimit(card,side))options.push({card,index,choice:[index,...choice],label:card.name+' · '+label,cost,...extra});};
 own.hand.forEach((card,index)=>{
  if(card.set!=='4'||card.type!=='Effect'||(card.owner??card.side)!==side)return;
  if(window){
   if(card.id==='Light:708'&&window.kind==='dagobahUsed'&&state.activeSide===side)add(card,index,[],'Alle Used Piles sofort zurückmischen',{tableOnly:true});
   if(card.id==='Light:2089'&&window.kind==='battleEnd'&&window.winner===side)for(const [targetIndex,target] of all.entries())if(target.card.subType==='Imperial'&&window.participants?.[target.side]?.includes(target.card))for(const [vaderIndex,vader] of all.entries())if(/darth vader/.test(dagoTitle(vader.card)))add(card,index,[vaderIndex,targetIndex],target.card.name+' zu Vader schicken',{host:vader.card,target:target.card});
   if(card.id==='Dark:1583'&&['characterLost','equipmentLost'].includes(window.kind)&&window.fallen?.pilot&&isSystem(state.locations[window.site]))add(card,index,[],window.fallen.name+' im All festhalten',{site:window.site,pilot:window.fallen});
   if(card.id==='Light:157'&&window.kind==='dagobahTurnStart'&&window.side===side)for(const [i,entry] of all.entries())if(entry.side===side&&entry.card.dagobahApprentice&&!entry.unavailable)add(card,index,[i],entry.card.name+' bis zum nächsten Zug ruhen lassen',{host:entry.card,restUntil:state.game.timing.turn+2});
   return;
  }
  if(state.activeSide!==side||state.phase!==2||battleSession)return;
  if(dagoInsertIds.has(card.id)&&PremiereGame.reserveCards(dagoOwn(enemy).deck).length>=2&&!dagoOwn(enemy).deck.some(unit=>unit.id===card.id))add(card,index,[],'Ins gegnerische Reserve Deck einsetzen',{insert:true});
  const tableCosts={'Light:745':0,'Light:957':0,'Light:1140':2,'Light:1785':2,'Light:1856':2,'Light:1920':0,'Light:1976':0,'Light:2184':0,'Light:2539':all.some(e=>dagoTitle(e.card)==='c-3po'&&!e.unavailable)?0:3,'Dark:185':0,'Dark:336':0,'Dark:1569':0,'Dark:1934':3,'Dark:2261':0,'Dark:2518':0,'Dark:2551':0};
  if(Object.hasOwn(tableCosts,card.id))add(card,index,[],'Auf der eigenen Tischseite auslegen',{cost:tableCosts[card.id],tableOnly:true});
  state.locations.forEach((loc,site)=>{
   if(!loc)return;const sector=DagobahRules.asteroid(loc),control=PremiereLocations.control(state,side,site,cardAbility)===true;
   if(card.id==='Light:150'&&sector&&control)add(card,index,[site],loc.name,{site});
   if(['Light:151','Light:2143'].includes(card.id)&&sector&&(card.id!=='Light:2143'||dagoTitle(loc)==='big one'))all.forEach((target,targetIndex)=>{
    if(target.unavailable)return;
    if(card.id==='Light:151'?target.side===enemy&&PremiereUnits.capital(target.card):target.side===side&&PremiereUnits.fighter(target.card)&&target.slot===dagoSystemSlot(site))add(card,index,[site,targetIndex],target.card.name+' → '+loc.name,{site,target:target.card,originalSystem:target.slot});
   });
   if(card.id==='Light:838'&&isExteriorPlanetSite(loc)&&PremiereLocations.presentCards(state,side,site).some(unit=>['Rebel','Alien'].includes(unit.subType)))add(card,index,[site],loc.name+' · Characters deployen',{site,cost:2});
   if(card.id==='Light:1808'&&isSite(loc)&&forceFromLocations(enemy).count-forceFromLocations(side).count>=3)add(card,index,[site],loc.name+' · Force nur mit Presence',{site,cost:4});
   if(['Light:2124','Dark:2123'].includes(card.id)&&sector)for(const direction of [-1,1])add(card,index,[site,direction],loc.name+' · Richtung '+direction,{site,direction});
   if(card.id==='Light:2352'&&isSite(loc)&&DagobahRules.dagobah(loc)&&dagoOwn(enemy).hand.length)add(card,index,[site],loc.name+' · zwei Handkarten verdecken',{site,cost:2});
   if(card.id==='Light:2741')add(card,index,[site],loc.name+' · Battle und Drain verteuern',{site});
   if(card.id==='Dark:299'&&isExteriorPlanetSite(loc)&&!DagobahRules.dagobah(loc))add(card,index,[site],loc.name+' · Bombing Run',{site});
   if(card.id==='Dark:554'&&DagobahRules.cave(loc)&&dagoSlugForCave(site))add(card,index,[site],loc.name+' · Corrosive Damage',{site});
   if(card.id==='Dark:918'&&loc.id==='Dark:599')all.forEach((target,i)=>{if(target.side===enemy&&target.card.dagobahApprentice&&DagobahRules.dagobah(state.locations[target.slot])&&!target.unavailable)add(card,index,[site,i],target.card.name+' · Training aussetzen',{site,target:target.card});});
   if(card.id==='Dark:2721'&&['executor: holotheatre','death star: conference room'].includes(dagoTitle(loc))&&lifeForceRemaining(side)>=2)add(card,index,[site],loc.name+' · Beide Spieler verlieren Force',{site,lossCost:2});
   if(card.id==='Light:2800'&&(isSystem(loc)||dagoTitle(loc)==='emperor'))all.forEach((target,i)=>{if(target.card.type==='Character'&&/\bemperor\b/i.test(target.card.lore)&&!target.unavailable)add(card,index,[site,i],target.card.name+' zu '+loc.name+' schicken',{site,target:target.card});});
  });
  all.forEach((entry,i)=>{
   if(entry.unavailable)return;const host=entry.card;
   if(['Light:1084','Dark:181'].includes(card.id)&&(['Starship','Vehicle'].includes(host.type)&&DagobahRules.dagobah(state.locations[entry.slot])||host.type==='Starship'&&isSite(state.locations[entry.slot])&&!PremiereLocations.conditions(state,entry.slot,side).dockingBay)&&!(card.id==='Dark:181'&&PremiereUnits.fighter(host)&&state.locations[entry.slot]?.id==='Light:598'&&entry.side===dagoLocationPlayer(entry.slot,'Light')))add(card,index,[i],host.name+' festsetzen',{host,site:entry.slot,sink:DagobahRules.dagobah(state.locations[entry.slot]),sinkAt:state.game.timing.turn+(state.activeSide===side?2:1)});
   if(card.id==='Light:2078'&&/leia/.test(dagoTitle(host)))add(card,index,[i],host.name+' · Reflection',{host});
   if(card.id==='Light:2286'&&PremiereUnits.hasSkill(host,'smuggler'))add(card,index,[i],host.name+' · Smuggler’s Blues',{host});
   if(card.id==='Light:2872'&&(host.id==='Light:2865'||entry.side===side&&host.type==='Character'&&cardAbility(host)>3))add(card,index,[i],host.name+' · Gimer Stick',{host,cost:host.id==='Light:2865'?0:2});
   if(card.id==='Light:2873'&&host.type==='Character')add(card,index,[i],host.name+' · Yoda’s Hope',{host});
   if(card.id==='Dark:937'&&host.subType==='Imperial'&&cardAbility(host)<5&&all.some(other=>!other.unavailable&&other!==entry&&PremiereLocations.physicalPlace(other)===PremiereLocations.physicalPlace(entry)&&(/vader|emperor/.test(dagoTitle(other.card))||other.side===side&&characterTraits(other.card).some(trait=>['admiral','general','moff'].includes(trait)))))add(card,index,[i],host.name+' befördern',{host});
   if(card.id==='Dark:951'&&entry.side===side&&/Star Destroyer/.test(host.subType))add(card,index,[i],host.name+' zum Flaggschiff machen',{host,cost:2});
   if(card.id==='Dark:1221'&&entry.side===enemy&&host.type==='Starship'&&host.uniquenessLimit===1&&PremiereLocations.occupy(state,side,entry.slot,cardAbility)!==true)add(card,index,[i],host.name+' verfolgen',{host});
   if(card.id==='Dark:1115'&&host.type==='Character'){
    add(card,index,[i,'training'],host.name+' · Trainings-Destiny −2',{host,pilotMode:false});
    if(entry.side===enemy&&host.pilot&&isSite(state.locations[entry.slot]))add(card,index,[i,'pilot'],host.name+' · In jeder Move-Phase bewegen oder verlieren',{host,pilotMode:true});
   }
   if(card.id==='Light:2800'&&dagoTitle(host)==='emperor')all.forEach((target,j)=>{if(target.card.type==='Character'&&!target.unavailable&&/\bemperor\b/i.test(target.card.lore??''))add(card,index,[i,j],target.card.name+' zum Emperor schicken',{host,target:target.card});});
   if(card.id==='Dark:1710'&&host.subType==='Rebel')add(card,index,[i],host.name+' zum Kampf zwingen',{host});
  });
  if(['Light:1303','Dark:2369'].includes(card.id))for(const [i,effect] of [...(state.tableEffects??[]),...Object.values(state.locationEffects??{}).flat()].entries())if(effect.card.type==='Effect'&&!/immune to alter/i.test(effect.card.gametext))add(card,index,[i],effect.card.name+' unter Druck setzen',{host:effect.card,targetEffect:effect});
 });return options;
}
function dagoSettleEffect(frame){
 if(frame.cancelled){loseOwnedCard(frame.card,frame.side);return;}
 const {card,side}=frame;
 if(frame.insert){card.insertedIntoReserveBy=side;const z=dagoOwn(PremiereGame.otherSide(side));z.deck.push(card);z.deck.splice(0,z.deck.length,...PremiereGame.shuffleReserve(z.deck,state.game));return;}
 const effect={...frame,dagobah:true,target:frame.target??side};delete effect.kind;
 if(frame.host){(frame.host.attachments??=[]).push(card);(state.tableEffects??=[]).push(effect);}else if(Number.isInteger(frame.site))(state.locationEffects[frame.site]??=[]).push(effect);else(state.tableEffects??=[]).push(effect);
 if(card.id==='Light:2352'){
  const hand=dagoOwn(PremiereGame.otherSide(side)).hand;effect.support=[];for(let n=0;n<2&&hand.length;n++){const index=Math.floor(PremiereGame.random(state.game)*hand.length);effect.support.push(hand.splice(index,1)[0]);}
 }
 if(card.id==='Light:708'){recirculateBoth();}
 if(card.id==='Light:1920')for(const actor of PremiereGame.sides)for(const used of dagoOwn(actor).used)used.dagobahFaceUp=true;
 if(frame.pilot){const lost=dagoOwn(frame.pilot.owner??side).lost,index=lost.indexOf(frame.pilot);if(index>=0){lost.splice(index,1);effect.support=[frame.pilot];}}
}
function dagoEffectContinuous(){
 const all=[...(state.tableEffects??[]),...Object.entries(state.locationEffects??{}).flatMap(([site,row])=>row.map(effect=>({...effect,site:Number(site)})))];
 for(const effect of all){
  if(effect.card.set!=='4'||effect.dagobahRetrieving)continue;const id=effect.card.id,side=effect.card.owner??effect.card.side,enemy=PremiereGame.otherSide(side);
  if(effect.host&&!dagoEntry(effect.host)&&!all.some(other=>other.card===effect.host)){hothCancelEffect(effect);continue;}
  if(['Light:150','Light:2741','Dark:2721'].includes(id)&&PremiereLocations.control(state,enemy,effect.site,cardAbility)===true){
   if(id==='Light:2352'&&effect.support){dagoOwn(enemy).hand.push(...effect.support);effect.support=[];}hothCancelEffect(effect);continue;
  }
  if(id==='Light:2184'&&!dagoUnits().some(entry=>entry.side===enemy&&entry.card.pilot&&isSite(state.locations[entry.slot])&&!entry.unavailable))hothCancelEffect(effect);
  if(['Light:151','Light:2089','Light:2800','Light:2143'].includes(id)){
   const target=dagoEntry(effect.target);if(!target){hothCancelEffect(effect);continue;}if(target.unavailable)continue;
   const destination=effect.host?dagoEntry(effect.host)?.slot:effect.site;if(target.slot!==destination)continue;
   if(id==='Light:2143'){
    const original=(state.locationEffects[effect.site]??[]).find(e=>e.card===effect.card);if(!original)continue;
    if(!effect.returning){state.locationEffects[effect.site].splice(state.locationEffects[effect.site].indexOf(original),1);original.site=effect.originalSystem;original.returning=true;original.reward=2*dagoSectors(dagoSystemSlot(effect.site)).length;(state.locationEffects[original.site]??=[]).push(original);}
    else{dagoMissionRetrieve(effect,effect.reward??0,()=>hothCancelEffect(effect));if(state.pendingCardView)return;}
   }else if(id==='Light:2089'){hothCancelEffect(effect);drawDestinySeries(side,'reportToVader',1,0,draws=>{if(draws.length&&PremiereBattle.total(draws)>2)loseTableCard(target.side,target.slot,target.card);});}
   else hothCancelEffect(effect);
  }
 }
}
function dagoEffectTiming(event,tasks){
 const side=state.activeSide,enemy=PremiereGame.otherSide(side),turn=state.game.timing.turn;
 if(event==='turn:start'){
  tasks.push(done=>{const frame={kind:'dagobahTurnStart',side};withShipWeaponResponse(frame,()=>done());});

 }
 if(event==='phase:start'&&state.phase===1){
  for(const effect of dagoEffects('Light:150',side)){const count=dagoSectors(dagoSystemSlot(effect.site)).filter(slot=>PremiereLocations.occupy(state,enemy,slot,cardAbility)!==true).length;if(count)tasks.push(done=>dagoLoss(enemy,count,'Asteroid Sanctuary',done));}
  for(const id of ['Light:1084','Dark:181'])for(const effect of dagoEffects(id,side))if(effect.sink&&effect.sinkAt<=turn)tasks.push(done=>{const entry=dagoEntry(effect.host);if(entry){const card=entry.card;if(id==='Dark:181')dagoSendUsed(entry);else{(state.dagobahBottomLossIds??=new Set()).add(card.instanceId);loseTableCard(entry.side,entry.slot,card);}}done();});
 }
 if(event==='phase:end'&&state.phase===2){
  const deployed=state.dagobahLocationsDeployed?.[side]?.turn===turn?state.dagobahLocationsDeployed[side].count:0;
  if(deployed===0&&dagoEffects('Dark:1569').length)tasks.push(done=>dagoLoss(side,1,'Location, Location, Location',done));
  if(deployed>=3)for(const effect of dagoEffects('Dark:1569'))hothCancelEffect(effect);
 }
 if(event==='phase:end'&&state.phase===3){
  const missed=state.locations.some((loc,slot)=>loc&&PremiereGame.sides.every(actor=>PremiereLocations.presence(state,actor,slot,cardAbility)===true)&&!state.battledSitesThisTurn?.includes(slot));
  if(missed&&dagoEffects('Light:1856',enemy).length)tasks.push(done=>dagoLoss(side,3,'Order To Engage',done));
  for(const effect of dagoEffects('Dark:1710',enemy)){const entry=dagoEntry(effect.host);if(entry&&!entry.unavailable&&PremiereGame.sides.every(actor=>PremiereLocations.presence(state,actor,entry.slot,cardAbility)===true)&&!state.battledSitesThisTurn?.includes(entry.slot))tasks.push(done=>dagoLoss(side,4,'Much Anger In Him',done));}
  if(state.dagobahBattleDemand?.[side]!==undefined&&state.dagobahBattleDemand[side]<=turn&&!state.dagobahTurnActivity?.[side]?.initiatedBattle)tasks.push(done=>{delete state.dagobahBattleDemand[side];dagoLoss(side,4,'Anger, Fear, Aggression',done);});
 }
 if(event==='phase:start'&&state.phase===5)for(const id of ['Light:1303','Dark:2369'])for(const effect of dagoEffects(id,enemy))if((effect.host.owner??effect.host.side)===side&&state.locations.some((loc,slot)=>DagobahRules.asteroid(loc)&&PremiereLocations.occupy(state,enemy,slot,cardAbility)===true))tasks.push(done=>{
  dagoPrompt(side,effect.card,'VoluntaryCancel',[{args:['lose'],label:'1 Force verlieren'},{args:['cancel'],label:effect.host.name+' freiwillig aufheben'}],choice=>{state.pendingCardView=null;if(choice.args[0]==='lose')dagoLoss(side,1,effect.card.name,done);else{const target=[...(state.tableEffects??[]),...Object.entries(state.locationEffects??{}).flatMap(([site,row])=>row.map(e=>({...e,site:Number(site)})))].find(e=>e.card===effect.host);if(target)hothCancelEffect(target);hothCancelEffect(effect);done();}return true;});
 });
 if(event==='turn:end'){
  for(const actor of PremiereGame.sides){
   if(dagoEffects('Dark:2721').length)tasks.push(done=>dagoLoss(actor,1,'Visage Of The Emperor',done));
   for(const effect of dagoEffects('Dark:554')){const count=dagoUnits().filter(entry=>entry.side===actor&&entry.slot===effect.site&&!entry.unavailable&&['Character','Starship'].includes(entry.card.type)&&PremiereLocations.presentAt(entry,effect.site)).length;if(actor===side&&count)tasks.push(done=>dagoLoss(actor,count,'Corrosive Damage',done));}
  }
  for(const entry of dagoUnits().filter(entry=>entry.side===side&&['Starship','Vehicle'].includes(entry.card.type)&&state.locations[entry.slot]?.id==='Light:601'))tasks.push(done=>{if(side===dagoLocationPlayer(entry.slot,'Light'))dagoSendUsed(entry);else{(state.dagobahBottomLossIds??=new Set()).add(entry.card.instanceId);loseTableCard(side,entry.slot,entry.card);}done();});
 }
}
function dagoDrainPlan(side,slot,plan){
 if(dagoTitle(state.locations[slot])==='dagobah'||dagoUnits().some(entry=>entry.slot===slot&&entry.card.concealed&&(entry.card.controller??entry.card.owner??entry.card.side)!==side))return null;
 const own=side.toLowerCase(),loc=state.locations[slot];let modifier=plan.modifier;
 if(dagoLocationText(slot)&&DagobahRules.asteroid(loc)&&dagoTitle(loc)==='big one')modifier+=side===dagoLocationPlayer(slot,state.locations[slot].side)?dagoSectors(dagoSystemSlot(slot)).filter(i=>/asteroid field/.test(dagoTitle(state.locations[i]))).length:loc.id==='Light:236'?1:0;
 if(loc?.id==='Dark:910'&&side===dagoLocationPlayer(slot,'Light'))modifier++;
 if(dagoCompleted(PremiereGame.otherSide(side),1)){
  // Cancel each bonus individually: a +2 and a -1 leave the -1 intact.
  const penalties=PremiereLocations.rulesAt(state,slot,side,'forceDrain').reduce((sum,rule)=>sum+Math.min(0,rule.amount),0)+PremiereLocations.effectsAt(state,slot).reduce((sum,effect)=>sum+Math.min(0,effect.drainModifier?.[side]??0),0);
  const generator=PremiereLocations.ruleAt(state,slot,side,'hothGeneratorDrainPenalty')&&state.locations.some(HothRules.generator)?-1:0;
  const waters=PremiereLocations.effectsAt(state,slot).some(effect=>activeCardRules(effect.card,'locationEffect').some(rule=>rule.darkWaters)&&(effect.card.owner??effect.card.side)!==side)?-1:0;
  return {...plan,base:PremiereLocations.icons(state,slot,PremiereGame.otherSide(side)),modifier:penalties+generator+waters,optional:0,weapons:[]};
 }
 return {...plan,modifier};
}
const dagoEffectBase={options:hothEffectOptions,settle:settleHothEffect,announce:announceHothEffect};
hothEffectOptions=function(side,window=null){return dagoEffectBase.options(side,window).concat(dagobahEnabled()?dagoEffectOptions(side,window):[]);};
settleHothEffect=function(frame){return dagobahEnabled()&&frame.card.set==='4'?dagoSettleEffect(frame):dagoEffectBase.settle(frame);};
announceHothEffect=function(side,option,window=null,paid=false){if(dagobahEnabled()&&option.lossCost&&!paid){state.hothPayingInterrupt=option.card;dagoLoss(side,option.lossCost,'Effect-Kosten',()=>{delete state.hothPayingInterrupt;announceHothEffect(side,option,window,true);});return true;}return dagoEffectBase.announce(side,option,window);};
