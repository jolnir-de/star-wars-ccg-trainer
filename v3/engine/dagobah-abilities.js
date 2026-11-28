'use strict';
function dagoEffectActions(side){
 const out=[],own=dagoOwn(side),turn=state.game.timing.turn,active=state.activeSide===side;
 const add=(effect,mode,args,label,cost,run,extra={})=>{if(cost<=forceBudget(side))out.push(dagoOption(effect.card,mode,[effect.card.instanceId,...args],label,{site:effect.site,cost,resolve(){spendForce(side,cost);return run();},...extra}));};
 for(const effect of [...(state.tableEffects??[]),...Object.entries(state.locationEffects??{}).flatMap(([site,row])=>row.map(effect=>({...effect,site:Number(site)})))]){
  const card=effect.card;if((card.owner??card.side)!==side||!dagoText(card))continue;
  if(['Light:2124','Dark:2123'].includes(card.id)&&state.phase===4&&!PremiereGame.wasUsed(state.game,'phase',dagoUsed(card,'rogueMove'))&&dagoSectors(dagoSystemSlot(effect.site)).length>1)add(effect,'rogueMove',[],'Zum nächsten Asteroidensektor bewegen',0,()=>dagoMoveRogue(effect));
  const used=dagoUsed(card),once=!PremiereGame.wasUsed(state.game,'turn',used);
  if((card.id==='Light:957'||card.id==='Dark:2261'&&once&&lifeForceRemaining(side)>0)&&PremiereGame.reserveCards(own.deck).length){
   const cost=card.id==='Light:957'?3:0;
   add(effect,'flash',[],'Oberste Reserve-Karte ziehen'+(cost?' (3 Force)':' (1 Force verlieren)'),cost,()=>{const draw=()=>dagoResolveTop(side,()=>{const drawn=PremiereGame.reserveCards(own.deck).at(-1);if(!drawn)return;own.deck.splice(own.deck.indexOf(drawn),1);own.hand.push(drawn);if(DagobahRules.spaceCreature(drawn))dagoPrompt(side,card,'FreeSpaceCreature',state.locations.flatMap((loc,site)=>creatureHabitat(drawn,site)&&withinDeploymentLimit(drawn,side)?[{args:[site],label:loc.name}]:[]).concat({args:['done'],label:'Karte auf der Hand behalten'}),choice=>{state.pendingCardView=null;if(choice.args[0]!=='done'){own.hand.splice(own.hand.indexOf(drawn),1);own.board[choice.args[0]].push(drawn);openDeploymentReaction(side,[drawn]);}return true;});});if(card.id==='Dark:2261'){PremiereGame.useOnce(state.game,'turn',used);dagoLoss(side,1,card.name,draw);}else draw();return true;});
  }
  if(card.id==='Light:1140'&&own.force.length&&!(typeof cloudCityEnabled==='function'&&cloudCityEnabled()&&ownForceBudget(side)===0))add(effect,'garbage',[],'Kartentyp wählen und Force einzeln aufdecken',0,()=>{
   dagoPrompt(side,card,'GarbageType',['Character','Creature','Device','Effect','Interrupt','Jedi Test','Location','Starship','Vehicle','Weapon'].map(type=>({args:[type],label:type})),choice=>{state.pendingCardView=null;const type=choice.args[0];const next=()=>{if(!own.force.length||typeof cloudCityEnabled==='function'&&cloudCityEnabled()&&ownForceBudget(side)===0)return;const drawn=own.force.pop();log(card.name+' deckt '+drawn.name+' auf.');if(drawn.type===type||type==='Jedi Test'&&DagobahRules.testNumber(drawn)){own.hand.push(drawn);return;}own.used.push(drawn);if(dagoEffects('Light:1920').length)drawn.dagobahFaceUp=true;queueRuleResponse({kind:'dagobahUsed',side});next();};next();return true;});return true;
  });
  if(card.id==='Light:1976'&&active&&state.phase===5&&once){const candidates=own.lost.filter(weapon=>weapon.type==='Weapon'&&/blaster/i.test(weapon.name));for(const [index,weapon] of candidates.entries())for(const mount of weaponPlacementOptions(side,weapon,undefined,true))add(effect,'quickDraw',[index,mount.siteIndex,mount.hostIndex],'Blaster aus Lost auf '+mount.host.name+' deployen',2,()=>{PremiereGame.useOnce(state.game,'turn',used);own.lost.splice(own.lost.indexOf(weapon),1);attachWeapon(mount.mount,weapon);openDeploymentReaction(side,[weapon]);return true;},{target:weapon});}
  if(card.id==='Light:157'&&effect.host)for(const [index,test] of (state.tableEffects??[]).entries())if(DagobahRules.testNumber(test.card))add(effect,'peaceTest',[index],test.card.name+' · Trainingsbonus +3',0,()=>{const original=dagoOriginalEffect(effect),apprentice=original.host;apprentice.dagobahRestUntil=original.restUntil;apprentice.attachments.splice(apprentice.attachments.indexOf(card),1);original.target=test.card;original.apprentice=apprentice;delete original.host;return true;});
  if(card.id==='Light:2078'&&active&&state.phase===1&&once&&own.lost.length&&dagoEntry(effect.host)&&!dagoEntry(effect.host).unavailable)add(effect,'reflection',[],'1 Force zurückholen',3,()=>{PremiereGame.useOnce(state.game,'turn',used);PremiereGame.retrieveForce(state,side,1);return true;});
  if(card.id==='Dark:336'&&once&&dagoOwn(PremiereGame.otherSide(side)).force.length)add(effect,'broken',[],'Gegnerische oberste Force-Karte auf Reserve legen',2,()=>{const z=dagoOwn(PremiereGame.otherSide(side));z.deck.push(z.force.pop());PremiereGame.useOnce(state.game,'turn',used);return true;});
  if(card.id==='Dark:2518'&&once&&PremiereGame.reserveCards(own.deck).length>=3)add(effect,'darkPath',[],'Oberste drei Reserve-Karten prüfen, zwei verlieren',0,()=>{
   PremiereGame.useOnce(state.game,'turn',used);const candidates=PremiereGame.reserveCards(own.deck).slice(-3);let left=2;
   const show=()=>dagoPrompt(side,card,'DarkPath',candidates.filter(unit=>own.deck.includes(unit)).map((unit,i)=>({args:[i],card:unit,label:unit.name+' verlieren'})),choice=>{own.deck.splice(own.deck.indexOf(choice.card),1);loseOwnedCard(choice.card,side);if(--left)show();else{state.pendingCardView=null;dagoResolveTop(side,()=>{});}return true;});show();return true;
  });
  if(card.id==='Light:2539'&&battleSession?.damage?.priority===side&&battleSession.damage.debt[side].damage>0&&!battleSession.dagobahProfessor){const ships=activeBattleUnits(side).filter(unit=>['Starship','Vehicle'].includes(unit.type)&&tractorShipCrew(unit).some(crew=>characterTraits(crew).includes('protocol droid')));for(const ship of ships){const nav=tractorShipCrew(ship).some(crew=>characterTraits(crew).some(trait=>['astromech','r-unit'].includes(trait))||/nav computer/i.test((crew.extraText??[]).join(' ')))?1:0;for(let cost=1;cost<=Math.min(forceBudget(side),battleSession.damage.debt[side].damage);cost++)add(effect,'professor',[ship.instanceId,cost],'Battle Damage −'+(cost+nav),cost,()=>{battleSession.dagobahProfessor=true;battleSession.damage.debt[side].damage=Math.max(0,battleSession.damage.debt[side].damage-cost-nav);return true;});}}
 }
 if(active&&state.phase===1&&dagoCompleted(side,4)&&!PremiereGame.wasUsed(state.game,'turn','dagoTestFourSearch')&&PremiereGame.reserveCards(own.deck).length&&forceBudget(side)>=2){const source=dagoJediCards().flatMap(entry=>entry.card.attachments??[]).find(card=>card.dagobahJediTest===4);add({card:source},'testFourSearch',[],'Beliebige Karte im Reserve Deck suchen',2,()=>{PremiereGame.useOnce(state.game,'turn','dagoTestFourSearch');dagoSearch(side,source,'deck',()=>true);return true;});}
 return out;
}
const dagoAbilityBase={actions:dagoActionOptions,responses:hothResponseOptions,respond:hothRespond,cancelTable:cancelTableEffect,cancelSite:cancelLocationEffect,device:devicePlacementOptions,matches:matchesRegisteredTarget,timing:dagoEffectTiming,continuous:dagoEffectContinuous};
dagoActionOptions=function(side){return dagoAbilityBase.actions(side).concat(dagobahEnabled()&&!state.pendingCardView&&!state.pendingForceLoss&&!PremiereGame.responseWindow(state.game)?dagoEffectActions(side):[]);};
matchesRegisteredTarget=function(card,target){if(dagobahEnabled()){if(target==='character-or-craft')return ['Character','Vehicle','Starship'].includes(card.type);if(target==='starfighter')return PremiereUnits.fighter(card);if(target==='pilot-character')return card.type==='Character'&&PremiereUnits.hasSkill(card,'pilot');}return dagoAbilityBase.matches(card,target);};
devicePlacementOptions=function(side,device,budget=Infinity){let options=dagoAbilityBase.device(side,device,Infinity);if(dagobahEnabled()&&device?.id==='Light:1108')options=options.map(option=>/^(han solo|millennium falcon)$/.test(dagoTitle(option.host))?{...option,cost:Math.max(0,option.cost-1)}:option);return options.filter(option=>option.cost<=budget);};
function dagoReleaseSupport(effect){
 if(effect.card.id==='Light:2352')for(const card of effect.support??[])dagoOwn(card.owner??card.side).hand.push(card);
 else for(const card of effect.support??[])loseOwnedCard(card,card.owner??card.side,'support');
 effect.support=[];
}
cancelTableEffect=function(effect){if(dagobahEnabled()&&effect.card.set==='4')dagoReleaseSupport(effect);return dagoAbilityBase.cancelTable(effect);};
cancelLocationEffect=function(site,effect){if(dagobahEnabled()&&effect.card.set==='4')dagoReleaseSupport(effect);return dagoAbilityBase.cancelSite(site,effect);};
hothResponseOptions=function(side,window){
 const out=dagoAbilityBase.responses(side,window);if(!dagobahEnabled()||!window||window.cancelled)return out;
 const add=(card,ability,args,label,extra={})=>out.push({kind:'hothAbility',card,ability:'dago:'+ability,index:-1,args:[-1,'dago:'+ability,...args],cost:0,label,...extra});
 if(window.kind==='destiny'&&window.side!==side&&dagoCompleted(side,3)&&!window.draw.cancelled&&!window.draw.substituted&&!window.dagobahTestThree)add(dagoJediCards().find(entry=>entry.side===side&&entry.card.attachments?.some(card=>card.dagobahJediTest===3)).card,'testThree',[],'Jedi-Test 3 · gegnerische Destiny −1');
 if(window.kind==='drain'&&window.side!==side){
  state.locations.forEach((loc,slot)=>{if(!loc)return;const asteroid=['Light:149','Dark:148','Light:238','Dark:237'].includes(loc.id)&&dagoLocationPlayer(slot,loc.side)===side&&dagoSystemSlot(slot)===window.site&&PremiereLocations.control(state,side,slot,cardAbility)===true;if(asteroid)add(loc,'cancelDrain',[slot],'Drain am verwandten System aufheben');if(loc.id==='Light:602'&&side===dagoLocationPlayer(slot,'Dark')&&slot===window.site&&forceBudget(side)>=1)add(loc,'cancelDrain',[slot],'Drain am Training Area aufheben (1 Force)',{cost:1});});
 }
 if(window.card&&['Effect','Interrupt'].includes(window.card.type)&&!/(immune to alter|immune to control)/i.test(window.card.gametext??'')&&forceBudget(side)>=1)for(const entry of dagoUnits()){
  if(entry.side!==side||entry.unavailable||entry.card.id!=='Light:1108'||!dagoText(entry.card))continue;
  const host=dagoUnits().find(unit=>unit.card.attachments?.includes(entry.card))?.card,carriers=[host,...entry.carriers].filter(card=>card&&['Vehicle','Starship'].includes(card.type));if(carriers.some(carrier=>[window.target,window.host,window.shot?.target].includes(carrier)))add(entry.card,'toolkit',[entry.card.instanceId],"Han's Toolkit · zielende Karte aufheben (1 Force)",{cost:1,device:entry.card,deviceHost:host});
 }
 if(window.kind==='interrupt'&&window.interrupt==='limitedResources'&&forceBudget(side)>=2)for(const effect of dagoEffects('Light:2286',side))add(effect.card,'smugglerCancel',[],'Limited Resources aufheben (2 Force)',{cost:2});
 return out;
};
hothRespond=function(side,option,window){
 if(!dagobahEnabled()||!option.ability?.startsWith('dago:'))return dagoAbilityBase.respond(side,option,window);
 spendForce(side,option.cost??0);
 if(option.ability==='dago:testThree'){window.draw.value=Math.max(0,window.draw.value-1);window.dagobahTestThree=true;window.passes=0;window.priority=PremiereGame.otherSide(side);}
 else{PremiereGame.cancelResponse(state.game,window);settleCancelledResponse(state.game);}
 return true;
};
dagoEffectContinuous=function(){
 dagoAbilityBase.continuous();
 for(const effect of dagoEffects('Light:2352'))if(PremiereLocations.occupy(state,PremiereGame.otherSide(effect.card.owner??effect.card.side),effect.site,cardAbility)===true)hothCancelEffect(effect);
 for(const effect of dagoEffects('Dark:554'))if(!dagoSlugForCave(effect.site))hothCancelEffect(effect);
 for(const effect of dagoEffects('Dark:1583'))if(!effect.support?.length)hothCancelEffect(effect);
};
dagoEffectTiming=function(event,tasks){
 dagoAbilityBase.timing(event,tasks);
 const side=state.activeSide,turn=state.game.timing.turn;
 if(event==='phase:start'&&state.phase===1){
  if(side==='Light'&&dagoUnits().some(entry=>entry.card.id==='Light:2865'&&!entry.unavailable&&!DagobahRules.dagobah(state.locations[entry.slot]))&&state.locations.some(loc=>loc?.id==='Dark:599'))tasks.push(done=>dagoLoss(side,1,'Dagobah: Cave',done));
 }
 if(event==='phase:start'&&state.phase===3)for(const effect of dagoEffects('Dark:918')){const target=dagoEntry(effect.target);if(target?.slot===effect.site&&PremiereLocations.presentAt(target,effect.site))tasks.push(done=>drawDestinySeries('Light','failureAtCave',1,0,draws=>{const value=PremiereBattle.total(draws);if(Number.isFinite(value)&&draws.length){if(value<4){PremiereGame.retrieveForce(state,'Dark',2);if(value===0&&dagoEntry(effect.target))loseTableCard(target.side,target.slot,target.card);}else hothCancelEffect(effect);}done();}));}
 if(event==='turn:end')for(const demand of (state.dagobahFrustrations??[]).slice())if(demand.until<=turn){state.dagobahFrustrations.splice(state.dagobahFrustrations.indexOf(demand),1);if(!demand.fulfilled)tasks.push(done=>{const hand=dagoOwn(demand.targetSide).hand,index=hand.findIndex(card=>dagoTitle(card)===demand.title);if(index>=0)loseOwnedCard(hand.splice(index,1)[0],demand.targetSide,'hand');done();});}
};
