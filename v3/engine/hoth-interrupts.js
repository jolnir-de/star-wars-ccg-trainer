'use strict';

function hothInterruptOptions(side,window=null) {
 const own=PremiereGame.zones(state,side),enemy=PremiereGame.otherSide(side),all=hothAllUnits(),options=[];
 const offer=(card,index,mode,choice,label,extra={})=>{
  const pile=extra.pile??(card.subType==='Used'?'Used':'Lost'),cost=extra.cost??0;
  if(cost<=forceBudget(side))options.push({card,index,mode,choice:[index,mode,...choice],label:card.name+' · '+label,cost,rule:{pile},...extra});
 };
 own.hand.forEach((card,index)=>{
  if(card.set!=='3'||card.type!=='Interrupt'||(card.owner??card.side)!==side)return;
  if(window) {
   const shot=window.shot;
   if(card.id==='Light:1220'&&(window.mode==='exposure'||['Light:1241','Dark:1240'].includes(window.card?.id)||window.interrupt==='gravelStorm'))all.forEach((entry,i)=>{
    if(entry.side!==side||!HothRules.creatureVehicle(entry.card)||entry.unavailable)return;
    const targets=all.filter(target=>target.side===side&&target.card.type==='Character'&&!target.unavailable&&PremiereLocations.presentAt(target,entry.slot));
    if(targets.length)offer(card,index,'weatherSacrifice',[i],entry.card.name+' opfern und Wetterschutz wählen',{entry,targets,maxTargets:/ronto/i.test(entry.card.name)?2:1});
   });
   if(card.id==='Dark:1552'&&window.kind==='drain'&&window.side===enemy)all.forEach((entry,i)=>{
    if(entry.side===enemy&&entry.slot===window.site&&cardAbility(entry.card)<4&&entry.card.weapons?.some(weapon=>/lightsaber/i.test(weapon.name)))offer(card,index,'saberDeficiency',[i],entry.card.name,{entry});
   });
   if(card.id==='Light:2734'&&window.side===enemy&&['hothMoved','deployment'].includes(window.kind)) {
    const targets=window.targets??[window.card],planet=sitePlanet(state.locations[window.site??PremiereLocations.findEntry(state,targets[0])?.slot]);
    if(planet&&targets.some(HothRules.atat)&&own.deck.some(unit=>isExteriorPlanetSite(unit)&&sitePlanet(unit)===planet))offer(card,index,'walkerSites',[],'bis zu drei Außen-Sites suchen',{planet});
   }
   if(card.id==='Dark:18'&&window.kind==='hothLocationDeployed'&&window.side===enemy&&isSite(window.card)&&sitePlanet(window.card)) {
    const planet=sitePlanet(window.card);if(own.deck.some(unit=>isSystem(unit)&&locationGroup(unit)===planet))offer(card,index,'relatedSystem',[],'zugehöriges System aus Reserve deployen',{planet});
   }
   if(card.id==='Dark:513'&&window.kind==='hothReactCompleted'&&window.side===enemy)all.forEach((entry,i)=>{
    if(entry.side===side&&!entry.unavailable&&['Vehicle','Starship'].includes(entry.card.type)&&!regularMovementUsed(entry.card))for(const move of travelOptions(entry.card,side,entry.slot,window.site,true))
     if(move.cost<=forceBudget(side)&&hothMovementAllowed(side,entry.card,entry.slot,window.site,'regular'))offer(card,index,'comscan',[i,move.kind],entry.card.name,{entry,to:window.site,cost:move.cost,move});
   });
   if(card.id==='Dark:2645'&&window.kind==='hothRescue'&&window.side!==side&&['Starship','Vehicle'].includes(window.target.type)||card.id==='Dark:2645'&&window.kind==='hothRescue'&&window.side!==side&&isDroid(window.target))
    offer(card,index,'cancelRescue',[],'Rettung in den Used Pile aufheben',{pile:'Used'});
   if(card.id==='Light:1773'&&window.kind==='interrupt'&&/hide|hideaway/i.test(window.rule?.mode??window.mode??''))offer(card,index,'cancelParent',[],'Verstecken vor dem Battle aufheben');
   if(card.id==='Dark:2209'&&window.kind==='weaponTarget'&&window.side!==side)all.forEach((entry,i)=>{
    if(entry.side===side&&isDroid(entry.card)&&!entry.unavailable&&PremiereLocations.presentAt(entry,window.site))offer(card,index,'redirectDroid',[i],entry.card.name,{entry,shot});
   });
   if(window.kind==='battle'&&battleSession) {
    const members=battleCandidates(side,window.site),rival=battleCandidates(enemy,window.site);
    if(card.id==='Light:167'&&isSite(state.locations[window.site]))members.forEach((lead,i)=>{if(HothRules.t47(lead))offer(card,index,'delta',[i],lead.name+' als führenden T-47 bestimmen',{lead,targets:members.filter(unit=>unit!==lead&&HothRules.t47(unit))});});
    if(card.id==='Light:920'&&window.side===enemy&&isExteriorPlanetSite(state.locations[window.site])) {
     const totals=battleTotals(window.site),key=side.toLowerCase(),other=enemy.toLowerCase();
     const targets=PremiereLocations.entries(state,side).filter(entry=>PremiereLocations.presentAt(entry,window.site)&&entry.card.type==='Character');
     if(totals[other+'Power']>2*totals[key+'Power']&&targets.length&&targets.every(entry=>!movementPrevented(entry.card)))state.locations.forEach((loc,to)=>{
      if(adjacentSites(window.site,to)&&PremiereLocations.presence(state,enemy,to,cardAbility)!==true&&targets.every(entry=>HothRules.canTravel(state,side,entry.slot,to,'Landspeed')))
       offer(card,index,'fallBack',[to],loc.name,{cost:1,targets,to});
     });
    }
    if(card.id==='Light:2881'&&window.side===enemy&&all.some(entry=>!entry.unavailable&&/darth vader/.test(locationTitle(entry.card))))rival.forEach((target,i)=>{
     if(characterTraits(target).includes('leader')&&cardAbility(target)<6)offer(card,index,'failedLeader',[i],target.name,{target});
    });
   }
   if(card.id==='Dark:466'&&window.kind==='hothMoved'&&window.side===side&&HothRules.atat(window.card)&&window.site===HothRules.markerExtremes(state).inner)
    state.locations.forEach((loc,site)=>{if(sitePlanet(loc)==='hoth'&&loc.locationTags?.includes('Underground')&&!loc.collapsed)offer(card,index,'collapse',[site],loc.name+' einstürzen lassen',{site,marker:HothRules.marker(state.locations[window.site])});});
   if(card.id==='Dark:684'&&window.kind==='equipmentLost'&&Number.isInteger(window.site)&&
    (HothRules.atat(window.fallen)||/\bAT-ST\b|Jabba.s Sail Barge/i.test((window.fallen.subType??'')+' '+(window.fallen.name??''))||window.fallen.id==='Light:1910'))
    offer(card,index,'debris',[],state.locations[window.site].name,{site:window.site});
   if(['Light:1330','Dark:1226'].includes(card.id)&&window.kind==='deployment'&&window.side!==side)
    window.targets.forEach((target,i)=>{if(['Character','Starship','Vehicle','Weapon','Device'].includes(target.type)&&PremiereLocations.findEntry(state,target)||HothRules.artillery(target)&&Object.values(state.locationWeapons??{}).some(row=>row.includes(target)))
     offer(card,index,'returnDeployed',[i],target.name+' auf die gegnerische Hand geben (3 Force)',{cost:3,target,targetSide:window.side});});
   if(['Light:1589','Dark:733'].includes(card.id)&&window.kind==='weaponTarget'&&window.side===side&&HothRules.combat(shot.target))
    for(const [pile,amount] of [['Used',1],['Lost',3]])offer(card,index,'weaponBonus',[pile],'+ '+amount+' auf die nächste Waffen-Destiny',{pile,amount,shot});
   if(card.id==='Light:1836'&&window.kind==='weaponTarget'&&window.side===side&&shot.weapon.id==='Light:1929')
    {
     (shot.host.occupants??[]).forEach(({card:pilot,role},i)=>{if(role==='pilot'&&PremiereUnits.active(pilot))offer(card,index,'weaponBonus',[i],'Ability von '+pilot.name+' zu Harpunen-Destiny addieren',{amount:cardAbility(pilot)??0,shot});});
     const permanent=permanentPilotAbility(shot.host);if(permanent!==null)offer(card,index,'weaponBonus',[-1],'Ability des permanenten Piloten addieren',{amount:permanent,shot});
    }
   if(card.id==='Dark:1869'&&window.kind==='tractorBeam'&&window.side===side)offer(card,index,'tractorBonus',[],'Tractor-Beam-Destiny +2',{amount:2});
   return;
  }
  if(card.id==='Dark:2399'&&lifeForceRemaining(side)>0&&own.deck.some(unit=>squadTrooper(unit,side)))offer(card,index,'trooperSearch',[],'bis zu drei Troopers aus Reserve nehmen',{lossCost:1});
  if(card.id==='Light:1902') {
   if(PremiereGame.zones(state,enemy).hand.length)offer(card,index,'perimeterHand',[],'gegnerische Hand prüfen (1 Force)',{cost:1});
   all.forEach((entry,i)=>{if(entry.card.faceDown||entry.card.concealed||entry.card.undercover)offer(card,index,'perimeterCard',[i],state.locations[entry.slot].name+' · verdeckte Karte ansehen',{cost:1,entry});});
   (state.buriedMines??[]).forEach((entry,i)=>offer(card,index,'perimeterCard',['buried',i],state.locations[entry.slot].name+' · vergrabene Karte ansehen',{cost:1,entry}));
   state.locations.forEach((loc,site)=>(loc?.bluffs??[]).forEach((unit,i)=>offer(card,index,'perimeterCard',['bluff',site,i],loc.name+' · Bluff ansehen',{cost:1,entry:{card:unit,slot:site}})));
  }
  if(card.id==='Dark:1953') {
   const probes=all.filter(entry=>entry.card.id==='Dark:1950'&&!entry.unavailable&&!PremiereUnits.textSuppressed(entry.card)).length;
   for(const pileSide of PremiereGame.sides)if(probes&&PremiereGame.zones(state,pileSide).lost.some(unit=>!unit.uniquenessLimit))offer(card,index,'telemetryLost',[pileSide],'bis zu '+probes+' nicht-einzigartige Karten aus '+pileSide+' Lost entfernen',{cost:2,probes,pileSide});
   const planets=[...new Set(all.filter(entry=>entry.side===side&&entry.card.id==='Dark:1950'&&!entry.unavailable).map(entry=>sitePlanet(state.locations[entry.slot])).filter(Boolean))];
   for(const planet of planets)if(all.filter(entry=>entry.side===side&&entry.card.type==='Character'&&!entry.unavailable&&sitePlanet(state.locations[entry.slot])===planet).length===1)offer(card,index,'telemetryDiscount',[planet],planet+' · Deploy −1',{planet});
  }
  if(card.id==='Dark:1826')all.forEach((entry,i)=>{if(entry.card.id==='Light:1674')offer(card,index,'binaryOff',[i],entry.card.name+' ausschalten',{entry});});
  if(card.id==='Dark:2842')all.forEach((entry,i)=>{if(HothRules.creatureVehicle(entry.card)&&!entry.unavailable)all.forEach((creature,j)=>{
   if(creature.card.type==='Creature'&&!creature.unavailable&&creature.slot===entry.slot)offer(card,index,'yaggle',[i,j],creature.card.name+' frisst '+entry.card.name,{entry,creature});
  });});
  if(card.id==='Light:1220')all.forEach((entry,i)=>{if(entry.side===side&&HothRules.creatureVehicle(entry.card)&&!entry.unavailable){
   const targets=all.filter(target=>target.side===side&&target.card.type==='Character'&&!target.unavailable&&PremiereLocations.presentAt(target,entry.slot));
   if(targets.length)offer(card,index,'weatherSacrifice',[i],entry.card.name+' opfern und Schutz wählen',{entry,targets,maxTargets:/ronto/i.test(entry.card.name)?2:1});
  }});
  if(state.activeSide===side&&state.phase===1&&!battleSession) {
   if(card.id==='Light:2888')all.forEach((entry,i)=>{if(entry.side===side&&entry.card.set==='3'&&entry.card.type==='Character'&&cardAbility(entry.card)>1&&!entry.unavailable&&!movementPrevented(entry.card))state.locations.forEach((loc,to)=>{
    if((sitePlanet(loc)??locationGroup(loc))==='dagobah'&&(isSite(loc)||PremiereLocations.presence(state,side,to,cardAbility)===true)&&HothRules.canTravel(state,side,entry.slot,to,'relocate'))offer(card,index,'dagobah',[i,to],entry.card.name+' → '+loc.name,{entry,to,cost:isSite(loc)?0:1});
   });});
   if(card.id==='Dark:2511')all.forEach((probe,i)=>{if(probe.side===side&&probe.card.id==='Dark:1950'&&!probe.unavailable&&isSite(state.locations[probe.slot])) {
    const to=state.locations.findIndex(loc=>isSystem(loc)&&locationGroup(loc)===sitePlanet(state.locations[probe.slot]));if(to<0)return;
    all.forEach((entry,j)=>{if(entry.side===side&&entry.card.type==='Starship'&&!entry.unavailable&&!movementPrevented(entry.card)&&HothRules.canTravel(state,side,entry.slot,to,'relocate'))offer(card,index,'probeShip',[i,j],entry.card.name+' → '+state.locations[to].name,{entry,to});});
   }});
  }
  if(battleSession&&!battleSession.damage&&battleSession.lightCard===null&&battleSession.darkCard===null) {
   const members=battleCandidates(side,battleSession.site),rival=battleCandidates(enemy,battleSession.site);
   const persona=(cards,name)=>cards.some(unit=>unit.personas?.includes(name)||new RegExp(name==='Chewie'?'chewbacca':name==='Han'?'han solo':name==='Luke'?'luke skywalker|commander luke':'leia').test(locationTitle(unit)));
   if(card.id==='Light:2137') {
    if(persona(members,'Luke')&&persona(members,'Chewie'))offer(card,index,'rugDestiny',[],'zwei Battle Destiny addieren');
    if(members.some(unit=>unit.subType==='Rebel')&&members.some(unit=>unit.subType==='Alien'))offer(card,index,'rugPower',[],'Power +4');
   }
   if(card.id==='Light:615'&&rival.filter(unit=>unit.subType==='Imperial'&&cardAbility(unit)>2).length>=2||
     card.id==='Dark:995'&&persona(rival,'Han')&&persona(rival,'Chewie')||card.id==='Dark:2187'&&persona(rival,'Han')&&persona(rival,'Leia'))
    offer(card,index,'reduceBattle',[],'gegnerische Attrition und gesamte Power um zwei Destiny senken',{cost:card.id==='Light:615'?2:0});
   if(card.id==='Dark:2209')members.forEach((target,i)=>{if(isDroid(target))offer(card,index,'selfDestruct',[i],target.name+' opfern: Attrition hier aufheben',{target,site:battleSession.site});});
   if(card.id==='Dark:1552')rival.forEach((target,i)=>{if(cardAbility(target)<4&&target.weapons?.some(weapon=>/lightsaber/i.test(weapon.name)))offer(card,index,'saberDeficiency',[i],target.name,{entry:PremiereLocations.findEntry(state,target)});});
  }
  if(['Dark:465','Dark:2353'].includes(card.id))all.forEach((entry,i)=>{
   if(entry.unavailable||HothRules.marker(state.locations[entry.slot])===null)return;
   if(card.id==='Dark:465'?entry.card.type!=='Character':!HothRules.creatureVehicle(entry.card))return;
   offer(card,index,card.id==='Dark:465'?'coldFeet':'stopMotion',[i],entry.card.name,{entry});
  });
  if(card.id==='Dark:913') {
   const missing=PremiereLocations.entries(state,enemy).filter(entry=>entry.card.missing&&entry.card.type==='Character');
   if(missing.length)offer(card,index,'exhaustion',[],enemy+' verliert '+missing.length+' Force',{amount:missing.length});
   all.forEach((entry,i)=>{if(entry.card.missing&&PremiereLocations.conditions(state,entry.slot,entry.side).night)offer(card,index,'loseMissing',[i],entry.card.name+' verlieren',{entry});});
  }
  if(card.id==='Dark:916'&&state.activeSide===side&&state.phase===1) {
   const targets=all.filter(entry=>entry.card.type==='Character'&&!entry.card.captured&&(entry.card.missing||PremiereLocations.presentAt(entry,entry.slot))&&
    isExteriorPlanetSite(state.locations[entry.slot])&&HothRules.marker(state.locations[entry.slot])!==null&&PremiereLocations.conditions(state,entry.slot,entry.side).night);
   if(targets.length)offer(card,index,'exposure',[],'alle '+targets.length+' nächtlichen Marker-Characters verlieren',{targets,cost:targets.length});
  }
  if(card.id==='Dark:1114'&&state.activeSide===side&&state.phase===1)all.forEach((entry,i)=>{
   const loc=state.locations[entry.slot];
   if(entry.unavailable||entry.card.type!=='Character'||(loc.owner??loc.side)!==side||!isExteriorPlanetSite(loc)||PremiereLocations.conditions(state,entry.slot,side).dockingBay)return;
   if(PremiereGame.sides.flatMap(actor=>PremiereLocations.presentCards(state,actor,entry.slot)).filter(card=>card.type==='Character').length===1)
    offer(card,index,'makeMissing',[i],entry.card.name,{entry});
  });
  if(card.id==='Dark:1285'&&lifeForceRemaining(side)>0)for(const [pile,amount] of [['Used',2],['Lost',4]])offer(card,index,'supply',[pile],'1 Force verlieren und '+amount+' aktivieren',{pile,amount,lossCost:1});
  if(card.id==='Light:1773')all.forEach((entry,i)=>{
   if(entry.side===side&&entry.card.missing&&PremiereLocations.entries(state,side).some(vehicle=>vehicle.slot===entry.slot&&!vehicle.unavailable&&vehicle.card.type==='Vehicle'&&!HothRules.creatureVehicle(vehicle.card)&&craftStats(vehicle.card,vehicle.slot).powered))
    offer(card,index,'missingToUsed',[i],entry.card.name+' auf Used retten',{entry});
  });
  if(['Light:1220','Light:2805'].includes(card.id))all.forEach((entry,i)=>{
   if(!entry.unavailable&&(card.id==='Light:1220'?/tzizvvt/.test(locationTitle(entry.card)):/rennek/.test(locationTitle(entry.card))))
    offer(card,index,'doubleCharacter',[i],entry.card.name+' verdoppeln',{entry,untilMove:card.id==='Light:1220'});
  });
  if(card.id==='Light:2671'&&state.activeSide===side&&state.phase===1)all.forEach((warrior,i)=>{
   if(warrior.side!==side||warrior.unavailable||!PremiereUnits.hasSkill(warrior.card,'warrior')||!PremiereLocations.presentAt(warrior,warrior.slot))return;
   all.forEach((entry,j)=>{if(entry.side===enemy&&!entry.unavailable&&entry.slot===warrior.slot&&entry.card.type==='Vehicle'&&Number.isFinite(craftStats(entry.card,entry.slot).armor)&&PremiereLocations.presentAt(entry,entry.slot))
    offer(card,index,'underAttack',[i,j],warrior.card.name+' greift '+entry.card.name+' an',{entry,warrior});});
  });
  if(['Dark:584','Dark:2627','Dark:2732','Dark:2736'].includes(card.id))all.forEach((walker,i)=>{
   if(walker.side!==side||walker.unavailable||!HothRules.combat(walker.card)||!craftStats(walker.card,walker.slot).powered||!PremiereLocations.presentAt(walker,walker.slot))return;
   if(card.id!=='Dark:2627'&&!HothRules.atat(walker.card)||card.id==='Dark:2627'&&!/\bAT-(AT|ST)\b/.test(walker.card.subType))return;
   const nearby=all.filter(entry=>entry.side===enemy&&!entry.unavailable&&PremiereLocations.presentAt(entry,entry.slot)&&
    (entry.slot===walker.slot||card.id!=='Dark:2627'&&isExteriorPlanetSite(state.locations[entry.slot])&&adjacentSites(walker.slot,entry.slot)));
   if(card.id==='Dark:2736') {
    const targets=nearby.filter(entry=>squadTrooper(entry.card,enemy));
    if(targets.length)offer(card,index,'wallFire',[i],'Troopers für Wall Of Fire auswählen',{walker,targets,chooseTargets:true});
   }else nearby.forEach(entry=>{
    const j=all.indexOf(entry),eligible=card.id==='Dark:584'?entry.card.type==='Vehicle'&&!HothRules.creatureVehicle(entry.card):
     card.id==='Dark:2732'?HothRules.artillery(entry.card):entry.card.type==='Character'||entry.card.type==='Vehicle'&&(entry.card.crashed||!Number.isFinite(entry.card.armor)&&!craftStats(entry.card,entry.slot).powered);
    if(eligible)offer(card,index,card.id==='Dark:584'?'crashLanding':card.id==='Dark:2732'?'walkerBarrage':'trample',[i,j],entry.card.name,{walker,entry});
   });
  });
 });
 return options;
}
function announceHothInterrupt(side,option,window=null,paid=false) {
 if(window&&(PremiereGame.responseWindow(state.game)!==window||window.priority!==side))return false;
 if(option.chooseTargets&&!option.selectedTargets) {
  state.pendingCardView={mode:'hothInterruptTargets',side,card:option.card,option,shown:option.targets.map(entry=>entry.card),selected:[],publicView:true};return true;
 }
 if(option.lossCost&&!paid) {state.hothPayingInterrupt=option.card;hothForceLoss(side,option.lossCost,'hothInterruptCost',()=>{delete state.hothPayingInterrupt;announceHothInterrupt(side,option,window,true);});return true;}
 const own=PremiereGame.zones(state,side),index=own.hand.indexOf(option.card);if(index<0)return false;
 own.hand.splice(index,1);spendForce(side,option.cost);
 const frame={...option,side,kind:'interrupt',interrupt:'hoth',duringBattle:!window&&!!battleSession};
 (state.hothResolvingInterrupts??=[]).push(frame);
 log(side+' spielt '+option.label+'.');
 if(window)PremiereGame.answer(state.game,side,frame);
 else if(hasInterruptResponse(frame))PremiereGame.openResponse(state.game,frame);
 else settleHothInterrupt(frame,null);
 return true;
}
function hothInterruptChoices(frame) {
 if(frame.mode==='hothInterruptSelect') {
  const own=PremiereGame.zones(state,frame.side),{interrupt}=frame,choices=[];
  const cards=interrupt.mode==='telemetryLost'?PremiereGame.zones(state,interrupt.pileSide).lost:own.deck;
  cards.forEach((card,index)=>{
   if(interrupt.mode==='trooperSearch'&&!squadTrooper(card,frame.side)||interrupt.mode==='telemetryLost'&&card.uniquenessLimit)return;
   if(['walkerSites','relatedSystem'].includes(interrupt.mode)) {
    if(interrupt.mode==='walkerSites'?!(isExteriorPlanetSite(card)&&sitePlanet(card)===interrupt.planet):!(isSystem(card)&&locationGroup(card)===interrupt.planet))return;
    for(const position of locationPositionsForCard(frame.side,card))choices.push({args:[index,position],card,label:card.name+' · Position '+(position+1)});
   }else choices.push({args:[index],card,label:card.name});
  });
  return choices.concat({args:['done'],label:'Suche beenden'});
 }
 if(frame.mode==='hothInterruptWeather')return frame.targets.map((entry,index)=>({args:[index],card:entry.card,label:entry.card.name+' schützen'})).concat(frame.selected.length?[{args:['done'],label:'Schutz bestätigen'}]:[]);
 if(frame.mode==='hothInterruptPerimeter')return frame.shown.map((card,index)=>({args:[index],card,label:card.name+(isSpyCharacter(card)&&isDroid(card)||card.id==='Dark:1306'?' · auf gegnerische Used legen':' · ansehen')})).concat({args:['done'],label:'Ansicht schließen'});
 if(frame.mode==='hothInterruptTargets')return frame.shown.map((card,index)=>({args:['toggle',index],card,label:(frame.selected.includes(index)?'✓ ':'')+card.name})).concat(
  frame.selected.length?[{args:['play'],label:'Ausgewählte Troopers angreifen'}]:[],{args:['cancel'],label:'Abbrechen'});
 return [];
}
function finishHothInterruptChoice(frame,...args) {
 if(!hothInterruptChoices(frame).some(option=>option.args.length===args.length&&option.args.every((arg,i)=>arg===args[i])))return false;
 if(frame.mode==='hothInterruptSelect') {
  const own=PremiereGame.zones(state,frame.side),{interrupt}=frame;
  if(args[0]!=='done'){
   const pile=interrupt.mode==='telemetryLost'?PremiereGame.zones(state,interrupt.pileSide).lost:own.deck,[card]=pile.splice(args[0],1);
   if(interrupt.mode==='telemetryLost')(state.outOfPlay??=[]).push(card);
   else if(['walkerSites','relatedSystem'].includes(interrupt.mode))placeLocationCard(frame.side,card,args[1]);else own.hand.push(card);
   frame.remaining--;if(frame.remaining>0&&hothInterruptChoices(frame).length>1)return true;
  }
  state.pendingCardView=null;
  if(interrupt.mode!=='telemetryLost'){const shuffled=PremiereGame.shuffleReserve(own.deck,state.game);own.deck.splice(0,own.deck.length,...shuffled);}
  finishPileInterrupt(interrupt);return true;
 }
 if(frame.mode==='hothInterruptWeather') {
  if(args[0]!=='done') {const [entry]=frame.targets.splice(args[0],1);frame.selected.push(entry.card);if(frame.selected.length<frame.interrupt.maxTargets&&frame.targets.length)return true;}
  state.pendingCardView=null;
  for(const card of frame.selected)card.weatherProtectionTurn=state.game.timing.turn;
  loseTableCard(frame.interrupt.entry.side,frame.interrupt.entry.slot,frame.interrupt.entry.card);finishPileInterrupt(frame.interrupt);return true;
 }
 if(frame.mode==='hothInterruptPerimeter') {
  if(args[0]==='done'){state.pendingCardView=null;finishPileInterrupt(frame.interrupt);return true;}
  const card=frame.shown[args[0]],rival=PremiereGame.zones(state,PremiereGame.otherSide(frame.side));
  if((isSpyCharacter(card)&&isDroid(card)||['Light:1307','Dark:1306'].includes(card.id))&&rival.hand.includes(card)){rival.hand.splice(rival.hand.indexOf(card),1);rival.used.push(card);frame.shown.splice(args[0],1);}
  return true;
 }
 if(frame.mode==='hothInterruptTargets') {
  if(args[0]==='toggle') {const at=frame.selected.indexOf(args[1]);if(at>=0)frame.selected.splice(at,1);else frame.selected.push(args[1]);return true;}
  state.pendingCardView=null;
  if(args[0]==='play')return announceHothInterrupt(frame.side,{...frame.option,selectedTargets:frame.selected.map(index=>frame.option.targets[index])});
  return true;
 }
 return false;
}
function hothSendUnitUsed(entry) {
 if(!detachTableCard(entry.side,entry.slot,entry.card))return;
 PremiereUnits.remove(entry.card,card=>card===entry.card?PremiereGame.zones(state,card.owner??entry.side).used.push(card):loseOwnedCard(card,entry.side),card=>loseOwnedCard(card,entry.side));
}
function settleHothInterrupt(frame,parent) {
 if(frame.cancelled){finishPileInterrupt(frame);return;}
 const {side,mode,entry}=frame,enemy=PremiereGame.otherSide(side),done=()=>finishPileInterrupt(frame);
 if(['trooperSearch','walkerSites','relatedSystem','telemetryLost'].includes(mode)) {
  state.pendingCardView={mode:'hothInterruptSelect',side,card:frame.card,shown:[],interrupt:frame,remaining:mode==='relatedSystem'?1:mode==='telemetryLost'?frame.probes:3};return;
 }
 if(mode==='perimeterHand'){state.pendingCardView={mode:'hothInterruptPerimeter',side,card:frame.card,shown:PremiereGame.zones(state,enemy).hand.slice(),interrupt:frame};return;}
 if(mode==='perimeterCard'){state.pendingCardView={mode:'hothPeek',side,card:frame.card,shown:[entry.card]};done();return;}
 if(mode==='weatherSacrifice'){state.pendingCardView={mode:'hothInterruptWeather',side,card:frame.card,shown:[],targets:frame.targets.slice(),selected:[],interrupt:frame};return;}
 if(mode==='telemetryDiscount'){(state.hothDeployDiscounts??=[]).push({side,planet:frame.planet,turn:state.game.timing.turn});done();return;}
 if(mode==='binaryOff'){entry.card.hothSwitchBack={turn:state.game.timing.turn,previous:!!entry.card.switchedOff};entry.card.switchedOff=true;done();return;}
 if(['dagobah','probeShip','comscan'].includes(mode)) {
  if(detachTableCard(side,entry.slot,entry.card)){PremiereGame.zones(state,side).board[frame.to].push(entry.card);hothMoved(side,entry.card,entry.slot,frame.to);if(mode!=='dagobah')(state.movedThisTurn??=[]).push(entry.card);}
  if(mode==='probeShip')entry.card.noMoveTurn=state.game.timing.turn;done();return;
 }
 if(mode==='yaggle') {
  drawDestinySeries(frame.creature.side,'creatureFerocity',1,0,draws=>hothFerocity(frame.creature.card,frame.creature.side,draws,ferocity=>{
   const stats=craftStats(entry.card,entry.slot);if(ferocity>(stats.maneuver??0)+(stats.landspeed??0)){frame.creature.card.hothFerocityBonus=(frame.creature.card.hothFerocityBonus??0)+2;hothEatCreaturePrey({creature:frame.creature.card},entry.card);}done();
  }));return;
 }
 if(['cancelRescue','cancelParent','protectDroid'].includes(mode)) {if(mode==='protectDroid')(state.droidProtection??=new Map()).set(frame.target,{side,turn:state.game.timing.turn});if(parent)PremiereGame.cancelResponse(state.game,parent);done();return;}
 if(mode==='redirectDroid') {
  if(parent?.shot===frame.shot){const original=frame.shot.target;frame.shot.forfeitReplacement=original.forfeit;frame.shot.target=entry.card;frame.shot.targetSlot=entry.slot;frame.shot.defense=PremiereWeapons.defense(entry.card,cardAbility(entry.card),craftStats(entry.card,entry.slot));}done();return;
 }
 if(mode==='weaponBonus'){if(parent?.shot===frame.shot)frame.shot.hothDestinyBonus=(frame.shot.hothDestinyBonus??0)+frame.amount;done();return;}
 if(mode==='tractorBonus'){if(parent)parent.hothDestinyBonus=(parent.hothDestinyBonus??0)+frame.amount;done();return;}
 if(mode==='delta'){for(const target of frame.targets)target.hothDeltaTurn=state.game.timing.turn;done();return;}
 if(mode==='failedLeader'){(battleSession.hothFailedLeaders??=[]).push(frame.target);done();return;}
 if(mode==='fallBack') {
  for(const target of frame.targets)if(relocateCharacter(side,target,frame.to))hothMoved(side,target.card,target.slot,frame.to);
  if(parent)PremiereGame.cancelResponse(state.game,parent);
  done();return;
 }
 if(mode==='rugDestiny'){if(!(battleSession.hothRugDestiny??={})[side]){battleSession.hothRugDestiny[side]=true;scheduleBattleDestiny(side,'battle',2);}done();return;}
 if(mode==='rugPower'){if(!(battleSession.hothRugPower??={})[side]){battleSession.hothRugPower[side]=true;const key=side.toLowerCase()+'PowerMod';battleSession[key]=(battleSession[key]??0)+4;}done();return;}
 if(mode==='selfDestruct') {
  const found=PremiereLocations.findEntry(state,frame.target);if(found)loseTableCard(found.side,found.slot,frame.target);
  (state.hothAttritionCancelled??=[]).push({side,site:frame.site,turn:state.game.timing.turn});done();return;
 }
 if(mode==='reduceBattle') {
  drawDestinySeries(side,'hothInterrupt',2,0,draws=>{const amount=PremiereBattle.total(draws);if(amount!==null&&battleSession){
   const records=(battleSession.hothReductions??={}),key=enemy+':'+frame.card.id;records[key]=Math.max(records[key]??0,amount);
   (battleSession.hothReduction??={})[enemy]=Object.entries(records).filter(([key])=>key.startsWith(enemy+':')).reduce((sum,[,value])=>sum+value,0);
  }done();});return;
 }
 if(mode==='supply'){activateReserve(side,frame.amount);done();return;}
 if(mode==='exhaustion'){hothForceLoss(enemy,frame.amount,'exhaustion',done);return;}
 if(mode==='loseMissing'){if(entry.card.missing)loseTableCard(entry.side,entry.slot,entry.card);done();return;}
 if(mode==='missingToUsed'){if(entry.card.missing)hothSendUnitUsed(entry);done();return;}
 if(mode==='doubleCharacter'){if(frame.untilMove)entry.card.hothDoublePower=true;else entry.card.hothPowerDoubleTurn=state.game.timing.turn;done();return;}
 if(mode==='returnDeployed') {
  const target=frame.target,placed=PremiereLocations.findEntry(state,target)??hothAllUnits().find(entry=>entry.card===target);
  if(placed&&detachTableCard(placed.side,placed.slot,target)) {
   const targetSide=target.owner??frame.targetSide;
   PremiereUnits.remove(target,card=>card===target?PremiereGame.zones(state,targetSide).hand.push(card):loseOwnedCard(card,placed.side),card=>loseOwnedCard(card,placed.side));
   (state.hothFreeDeploys??=[]).push({side:targetSide,title:locationTitle(target),turn:state.game.timing.turn+(state.activeSide===targetSide?2:1)});
  }
  done();return;
 }
 if(mode==='exposure'){for(const entry of frame.targets)if(!HothRules.protectedFromWeather(entry.card,state.game.timing.turn)&&entry.card.exposureProtectionTurn!==state.game.timing.turn&&PremiereLocations.findEntry(state,entry.card))loseTableCard(entry.side,entry.slot,entry.card);done();return;}
 const night=entry&&PremiereLocations.conditions(state,entry.slot,entry.side).night?2:0;
 drawDestinySeries(side,'hothInterrupt',1,['coldFeet','stopMotion'].includes(mode)?night:0,draws=>{
  const value=draws.length?PremiereBattle.total(draws):null;
  if(Number.isFinite(value)) {
   if(mode==='collapse'&&value>frame.marker)hothCollapseSite(frame.site);
   if(mode==='debris') {
    const targets=hothAllUnits().filter(entry=>entry.slot===frame.site&&PremiereBattle.printedDestiny(entry.card)===value);
    for(const entry of targets)if(PremiereLocations.findEntry(state,entry.card)||Object.values(state.locationWeapons??{}).some(row=>row.includes(entry.card)))loseTableCard(entry.side,entry.slot,entry.card);
    for(const effect of (state.locationEffects?.[frame.site]??[]).slice())if(PremiereBattle.printedDestiny(effect.card)===value)cancelLocationEffect(frame.site,effect);
   }
   if(mode==='coldFeet'&&value>cardAbility(entry.card))entry.card.noMoveTurn=state.game.timing.turn;
   if(mode==='saberDeficiency') {
    if(value>cardAbility(entry.card))loseTableCard(entry.side,entry.slot,entry.card);
    else if(value===cardAbility(entry.card)){const saber=entry.card.weapons?.find(weapon=>/lightsaber/i.test(weapon.name));if(saber)loseTableCard(entry.side,entry.slot,saber);}
   }
   if(mode==='stopMotion'&&value>(entry.card.id==='Light:2480'?5:3))loseTableCard(entry.side,entry.slot,entry.card);
   if(mode==='makeMissing'&&value+3>cardAbility(entry.card))hothMakeMissing(entry.card,entry.side,entry.slot,frame.card);
   if(mode==='crashLanding'&&value+(frame.walker.card.weapons?.some(card=>/^Vehicle/.test(card.subType??''))?1:0)>3)entry.card.crashed=true;
   if(mode==='underAttack') {
    const weapons=frame.warrior.card.weapons??[],grenade=weapons.find(card=>card.id==='Light:515'),saber=weapons.some(card=>/lightsaber/i.test(card.name??''));
    const bonus=grenade&&saber?7:grenade||saber?3:0;
    if(value+bonus>craftStats(entry.card,entry.slot).armor) {loseTableCard(entry.side,entry.slot,entry.card);const found=grenade&&PremiereLocations.findEntry(state,grenade);if(found)loseTableCard(found.side,found.slot,grenade);}
   }
   if(mode==='trample'&&(entry.card.type==='Character'?value>cardAbility(entry.card):value<7))loseTableCard(entry.side,entry.slot,entry.card);
   if(mode==='wallFire'&&value>frame.selectedTargets.length)for(const target of frame.selectedTargets)if(PremiereLocations.findEntry(state,target.card))loseTableCard(target.side,target.slot,target.card);
   if(mode==='walkerBarrage') {
    if(value+1>(entry.card.forfeit??Infinity))loseTableCard(entry.side,entry.slot,entry.card);
    const targets=PremiereLocations.presentCards(state,enemy,entry.slot).filter(card=>card.type==='Character');
    if(value+1>6&&targets.length)loseTableCard(enemy,entry.slot,targets[Math.floor(PremiereGame.random(state.game)*targets.length)]);
   }
  }
  log(frame.card.name+' · Destiny '+(value??'fehlgeschlagen')+'.');done();
 });
}
