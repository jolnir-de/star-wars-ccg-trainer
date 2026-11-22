'use strict';
const ccInterruptProviders=[];
function ccInterruptOptions(side,window=null){
 const out=[],own=ccOwn(side),enemy=PremiereGame.otherSide(side),all=ccUnits(),turn=state.game.timing.turn,active=state.activeSide===side;
 const add=(card,index,mode,args,label,extra={})=>{const cost=extra.cost??0;if(cost<=forceBudget(side))out.push({card,index,mode:'cc:'+mode,choice:[index,'cc:'+mode,...args],label:card.name+' · '+label,cost,rule:{pile:extra.pile??(card.subType==='Used'?'Used':'Lost')},...extra});};
 own.hand.forEach((card,index)=>{
  if(!['5','6'].includes(card.set)||card.type!=='Interrupt'||ccOwner(card)!==side)return;
  if(window){
   const shot=window.shot,target=shot?.target,targetOwner=target&&(ccEntry(target)?.side??ccOwner(target));
   if(card.id==='Light:2393'&&window.card?.id==='Dark:1701'&&window.hothEffect)add(card,index,'cancel',[],'Mostly Armless beim Ausspielen aufheben');
   if(card.id==='Dark:1957'&&['battle','drain'].includes(window.kind)&&window.side===enemy)add(card,index,'payOrCancel',[],'Gegner muss 2 Force verwenden oder abbrechen');
   if(card.id==='Dark:1937'&&window.kind==='cloudCityFreeze'&&window.side===side)add(card,index,'freezeBonus',[],'Carbon-Freezing Destiny +2',{pile:'Used'});
   if(card.id==='Light:1293'&&window.kind==='cloudCityFreezeResult'&&window.side===enemy)add(card,index,'impressive',[],window.target.name+' retten',{target:window.target});
   if(card.id==='Dark:968'&&window.kind==='weaponTarget'&&window.side===enemy&&targetOwner===side&&shot.weapon.subType==='Character'){
    if(cardAbility(target)>=6&&target.type==='Character')add(card,index,'cancel',[],'Dark Jedi vor Charakterwaffe schützen',{pile:'Used'});
    if(battleSession)add(card,index,'cancel',[],'Waffenziel aufheben (3 Force)',{pile:'Lost',cost:3});
   }
   if(card.id==='Light:1970'&&window.kind==='weaponTarget'&&window.side===enemy&&targetOwner===side&&target.type==='Character'&&battleSession)add(card,index,'cancel',[],'Waffenziel aufheben (3 Force)',{cost:3});
   if(card.id==='Light:749'&&window.kind==='weaponTarget'&&window.side===enemy&&targetOwner===side&&target.type==='Character'&&cardAbility(target)>2)add(card,index,'dodge',[],'Jeden Waffen-Destiny-Draw um 3 senken');
   if(card.id==='Light:1313'&&window.kind==='weaponTarget'&&window.side===enemy&&targetOwner===side&&CloudCityRules.gambler(target))add(card,index,'scoundrel',[],'Neues Waffenziel oder 2 Force Verlust',{pile:'Used'});
   if(card.id==='Light:261'&&window.kind==='weaponTarget'&&window.side===side&&/blaster/i.test(shot.weapon.name)||card.id==='Dark:625'&&window.kind==='weaponTarget'&&window.side===side&&/lightsaber/i.test(shot.weapon.name))add(card,index,'weaponPlus',[],'Gesamte Waffen-Destiny +3',{pile:card.id==='Light:261'?'Used':'Lost'});
   if(card.id==='Light:2393'&&window.kind==='weaponTarget'&&window.side===enemy&&/lightsaber/i.test(shot.weapon.name))add(card,index,'swingMiss',[],'Destiny ziehen und Waffen-Destiny senken');
   if(['Light:261','Dark:625'].includes(card.id)&&window.kind==='cloudCityHit'&&window.side===side&&window.target?.type==='Character'&&ccEntry(window.target)&&lifeForceRemaining(side)>0)add(card,index,'killHit',[],window.target.name+' sofort verlieren lassen',{lossCost:1,target:window.target});
   if(card.id==='Dark:1188'&&window.kind==='cloudCityWouldHit'&&window.side===enemy&&target?.subType==='Imperial'&&ccPresent(side,window.site).some(unit=>ccCaptives(unit).length))for(const [i,entry]of all.entries())if(entry.slot===window.site&&ccCaptives(entry.card).length)for(const [j,captive]of ccCaptives(entry.card).entries())if(!captive.frozen)add(card,index,'shieldHit',[i,j],captive.name+' statt Imperial treffen',{pile:'Used',target:captive});
   if(card.id==='Light:1334'&&window.kind==='battle'&&isSite(state.locations[window.site]))add(card,index,'cancel',[],'Battle aufheben (3 Force)',{cost:3,pile:'Lost'});
   if(['Light:612','Dark:2079'].includes(card.id)&&window.kind==='battle'&&window.side===enemy){
    add(card,index,'powerDestiny',[],'Eine Destiny nur zur Power');
    if(battleCandidates(side,window.site).some(unit=>unit.weapons?.some(weapon=>weapon.subType==='Character')))all.forEach((entry,i)=>{if(entry.side===enemy&&entry.slot===window.site&&!entry.unavailable&&entry.card.type==='Character')add(card,index,'noImmunity',[i],entry.card.name+' verliert Battle-Immunität',{target:entry.card});});
   }
   if(card.id==='Light:377'&&window.kind==='battle'&&isSite(state.locations[window.site]))all.forEach((entry,i)=>{if(entry.slot===window.site&&entry.card.captured&&PremiereLocations.physicalPlace(entry)===window.site)add(card,index,'pursuit',[i],entry.card.name+' bei Sieg befreien',{pile:'Used',target:entry.card});});
   if(card.id==='Light:1828'&&window.kind==='battle'&&PremiereGame.sides.flatMap(actor=>battleCandidates(actor,window.site)).some(unit=>ccPersona(unit,'Han'))&&PremiereGame.sides.flatMap(actor=>battleCandidates(actor,window.site)).some(unit=>ccPersona(unit,'Lando')))add(card,index,'pirates',[],'Battle-Schaden zuerst aus Hand bezahlen');
   if(card.id==='Dark:1514'&&window.kind==='battle'&&battleCandidates(side,window.site).some(unit=>unit.type==='Character'&&cardAbility(unit)>3))for(const [i,device]of own.used.entries())if(device.type==='Device'&&/deploys? on (?:a|one|your|any)/i.test(device.gametext)&&!/site|prison|chamber/i.test(device.gametext.split('.')[0]))add(card,index,'levitateDevice',[i],device.name+' zur Power addieren',{target:device});
   if(card.id==='Dark:2633'&&window.kind==='battle'&&isSite(state.locations[window.site]))add(card,index,'trooperAssault',[],'Trooper Power +2 und immun');
   if(['Light:1143','Dark:841'].includes(card.id)&&window.kind==='destiny'&&window.purpose==='battle'&&isSite(state.locations[window.site]))add(card,index,'cancelDestiny',[],'Battle-Destiny aufheben (3 Force)',{cost:3,pile:'Lost'});
   if(card.id==='Light:1042'&&window.kind==='destiny'&&window.purpose==='cloudCityDuel'&&window.side!==side&&state.cloudCityDuel?.participants?.[side]?.some(ownLightsaber))add(card,index,'cancelDestiny',[],'Gegnerische Duell-Destiny aufheben');
   if(card.id==='Light:2387'&&window.kind==='destiny'&&window.side===enemy&&battleSession&&battleCandidates(side,battleSession.site).some(unit=>unit.id==='Light:1562')&&battleCandidates(side,battleSession.site).some(unit=>ccPersona(unit,'Lando')))add(card,index,'cancelDestiny',[],'Gegnerische Destiny aufheben');
   if(card.id==='Light:923'&&window.kind==='characterLost'&&CloudCityRules.city(state.locations[window.site])&&ccOwn(side).lost.includes(window.fallen)&&ccVanes().length)add(card,index,'lostToVane',[],window.fallen.name+' auf Weather Vane retten',{cost:2,target:window.fallen,site:window.site});
   if(card.id==='Light:1797'&&window.kind==='cloudCityLukeCross')add(card,index,'lukeLost',[],'Luke verlieren statt zur Dark Side wechseln');
   for(const provider of ccInterruptProviders)provider({out,add,card,index,side,enemy,own,all,window});
   return;
  }
  const search=(filter,cost=0,pile='deck',extra={})=>{if(own[pile].some(filter))add(card,index,'search',[pile],pile==='lost'?'Karte aus Lost Pile bergen':'Karte suchen',{filter,cost,pileName:pile,...extra});};
  const searches={'Light:139':unit=>unit.id==='Light:1132','Light:418':unit=>unit.id==='Light:2670','Light:923':unit=>unit.id==='Light:2779','Light:1206':unit=>ccTitle(unit)==="we don't need their scum",'Light:1549':unit=>PremiereUnits.tube(unit),'Dark:1121':unit=>unit.id==='Dark:2778','Dark:2306':unit=>PremiereLocations.prison(unit),'Dark:2578':unit=>ccTitle(unit)==='this is just wrong','Dark:2875':unit=>unit.id==='Dark:1201'};
  if(searches[card.id])search(searches[card.id],['Light:418','Dark:2875'].includes(card.id)?1:0,'deck',{pile:['Light:139','Light:1206','Dark:2306'].includes(card.id)?'Used':card.subType==='Used'?'Used':'Lost'});
  if(card.id==='Light:139'){search(unit=>ccPersona(unit,'R2-D2'),3,'deck',{pile:'Lost'});}
  if(card.id==='Dark:763')search(unit=>PremiereUnits.bountyHunter(unit),3);
  if(card.id==='Dark:2770')search(unit=>unit.type==='Weapon',0,'used',{pile:'Used'});
  if(['Light:418','Dark:2875'].includes(card.id))all.forEach((warrior,i)=>{if(warrior.side!==side||warrior.unavailable||!PremiereUnits.hasSkill(warrior.card,'warrior')||!ownLightsaber(warrior.card))return;all.forEach((target,j)=>{if(target.side===enemy&&!target.unavailable&&target.card.type==='Character'&&PremiereLocations.physicalPlace(target)===PremiereLocations.physicalPlace(warrior))add(card,index,'clash',[i,j],target.card.name+' bis Ende meines nächsten Zuges sperren',{cost:2,target:target.card});});});
  if(card.id==='Light:104'&&active&&!battleSession)state.locations.forEach((loc,site)=>{const totals=isSite(loc)&&battleTotals(site);if(totals&&totals[side.toLowerCase()+'Power']>2*totals[enemy.toLowerCase()+'Power']&&!ccPresent(enemy,site).some(unit=>cardAbility(unit)>=6||unit.weapons?.some(weapon=>weapon.subType==='Character')))add(card,index,'ambush',[site],loc.name+' räumen',{site});});
  if(card.id==='Light:142'&&active&&state.phase===4&&!battleSession)all.forEach((entry,i)=>{if(entry.side===side&&!entry.unavailable&&entry.card.type==='Character'&&(CloudCityRules.gambler(entry.card)||PremiereUnits.hasSkill(entry.card,'smuggler')||characterTraits(entry.card).includes('thief')))add(card,index,'returnHand',[i],entry.card.name+' auf Hand zurücknehmen',{entry,cost:2});});
  if(card.id==='Light:640')all.forEach((entry,i)=>{if(entry.card.type==='Character'||HothRules.creatureVehicle(entry.card))add(card,index,'dash',[i],entry.card.name+' Landspeed +1',{entry,cost:2});});
  if(card.id==='Light:511')add(card,index,'interface',[],'Oberste Karten der drei Piles neu zuordnen',{cost:all.some(entry=>entry.card.id==='Light:1562'&&!entry.unavailable)?0:2});
  if(card.id==='Light:1313')for(const [i,effect]of ccAllEffects().entries())if(effect.host&&(ccPersona(effect.host,'Han')||ccOwner(effect.host)===side&&ccPersona(effect.host,'Lando'))&&!/immune to alter/i.test(effect.card.gametext)&&!(ccEffects('Light:1145').length&&['Light:917','Light:2539','Light:1643','Light:1157'].includes(effect.card.id)))add(card,index,'cancelEffect',[i],effect.card.name+' aufheben',{effect});
  if(card.id==='Light:1422')for(const actor of PremiereGame.sides)if(ccOwn(actor).lost.length)add(card,index,'lookLost',[actor],actor+' Lost Pile ansehen',{targetSide:actor});
  if(card.id==='Light:1549')all.forEach((entry,i)=>{if(entry.side===side&&PremiereUnits.tube(entry.card)&&!(entry.card.occupants?.length))add(card,index,'toUsed',[i],entry.card.name+' auf Used legen',{entry});});
  if(card.id==='Light:717'&&(!active||state.phase!==4||battleSession))return;
  if(['Light:717','Light:2092'].includes(card.id))for(const [i,vane]of ccVanes().entries())for(const [j,target]of (vane.support??[]).entries())if(ccOwner(target)===side){
   if(card.id==='Light:2092')add(card,index,'vaneUsed',[i,j],target.name+' auf Used retten',{target,vane,pile:'Used'});
   else if(!ccIsDisarmed(target))state.locations.forEach((loc,to)=>{if(CloudCityRules.city(loc))add(card,index,'vaneSite',[i,j,to],target.name+' → '+loc.name,{target,vane,to});});
  }
  if(['Light:1323','Light:1897'].includes(card.id))all.forEach((entry,i)=>{if(entry.side!==side||entry.unavailable||entry.card.type!=='Character')return;
   if(card.id==='Light:1323'&&CloudCityRules.city(state.locations[entry.slot])&&ccVanes().length)add(card,index,'toVane',[i],entry.card.name+' auf Weather Vane',{entry});
   if(card.id==='Light:1897'&&state.locations[entry.slot]?.locationTags?.includes('Interior')&&state.locations[entry.slot]?.locationTags?.includes('Mobile'))state.locations.forEach((loc,to)=>{if(to!==entry.slot&&loc?.locationTags?.includes('Interior')&&loc.locationTags.includes('Mobile')&&ccPlanet(loc)===ccPlanet(state.locations[entry.slot])&&dagoRelocationAllowed(side,entry.card,entry.slot,to))add(card,index,'relocate',[i,to],entry.card.name+' → '+loc.name,{entry,to});});
  });
  if(card.id==='Light:1821')all.forEach((entry,i)=>{if(entry.side===side&&!entry.unavailable&&entry.card.type==='Character'&&CloudCityRules.city(state.locations[entry.slot]))add(card,index,'offEdge',[i],entry.card.name+' · Destiny riskieren',{entry});});
  if(['Light:2252','Dark:2255'].includes(card.id))state.locations.forEach((loc,site)=>{if(loc&&PremiereLocations.conditions(state,site,side).scompLink)add(card,index,'blockScomp',[site],loc.name+' Scomp Links ausschalten',{site});});
  if(card.id==='Dark:73'&&all.some(entry=>entry.card.captured&&!entry.card.frozen&&entry.card.subType==='Rebel'&&(entry.card.ability??0)>1&&PremiereLocations.prison(state.locations[entry.slot])&&ccControl(side,entry.slot)))add(card,index,'forceLoss',[],'Force für gegnerische Characters verlieren lassen',{amount:all.filter(entry=>entry.side===enemy&&!entry.unavailable&&entry.card.type==='Character'&&cardAbility(entry.card)>2).length});
  if(card.id==='Dark:2306'&&all.some(entry=>entry.card.captured&&!entry.card.frozen&&entry.card.subType==='Alien'&&PremiereLocations.prison(state.locations[entry.slot])))add(card,index,'forceLoss',[],'3 Force für inhaftierten Alien verlieren lassen',{amount:3,pile:'Lost'});
  if(card.id==='Dark:765'&&state.locations.some((loc,site)=>isSite(loc)&&ccPresent(side,site).some(unit=>ccPersona(unit,'Lando'))&&PremiereGame.sides.some(actor=>ccPresent(actor,site).some(unit=>ccPersona(unit,'Han')))))add(card,index,'forceLoss',[],'Han und Lando · Gegner verliert 3 Force',{amount:3});
  if(card.id==='Dark:800')all.forEach((entry,i)=>{if(entry.side!==side||entry.unavailable||!isDroid(entry.card)||!/protocol/i.test((entry.card.characteristics??[]).join(' ')+entry.card.lore))return;all.forEach((target,j)=>{if(target.card.type==='Character'&&!target.unavailable&&PremiereLocations.physicalPlace(target)===PremiereLocations.physicalPlace(entry))add(card,index,'insult',[i,j],target.card.name+' beleidigen',{target:target.card});});});
  if(card.id==='Dark:1116'&&active&&state.phase===4)all.forEach((entry,i)=>{for(const [j,captive]of ccCaptives(entry.card).entries())for(const [k,escort]of escortChoices(entry.slot,true).entries())if(escort.card!==entry.card&&PremiereLocations.physicalPlace(entry)===entry.slot)add(card,index,'transferCaptive',[i,j,k],captive.name+' an '+escort.card.name+' übergeben',{captive,escort:escort.card,original:entry.card});});
  if(card.id==='Dark:2283')for(const actor of PremiereGame.sides)for(const pile of ['deck','force','used','lost'])if(ccOwn(actor)[pile].length)add(card,index,'rotatePile',[actor,pile],actor+' '+pile+' oberste Karte nach unten',{targetSide:actor,pileName:pile});
  if(card.id==='Dark:2283'&&ccVanes().length)for(const [i,vane]of ccVanes().entries())for(const [j,target]of (vane.support??[]).entries())add(card,index,'loseVane',[i,j],target.name+' auf Weather Vane verlieren',{target,vane,cost:3});
  if(card.id==='Dark:2775'&&all.some(entry=>entry.side===side&&(entry.card.type==='Device'&&entry.card.id!=='Light:244'||entry.card.type==='Weapon'&&entry.card.subType==='Character')))add(card,index,'equipmentUsed',[],'Eigene Ausrüstung auf Used legen',{pile:'Lost'});
  for(const provider of ccInterruptProviders)provider({out,add,card,index,side,enemy,own,all,window:null});
 });return out;
}
function ccSettleInterrupt(frame,parent){
 if(frame.cancelled){finishPileInterrupt(frame);return;}
 const {side,entry,target,card}=frame,own=ccOwn(side),enemy=PremiereGame.otherSide(side),mode=frame.mode.slice(3),done=()=>finishPileInterrupt(frame);
 if(mode==='search'){dagoSearch(side,card,frame.pileName,frame.filter,done);return;}
 if(mode==='cancel'){if(parent)PremiereGame.cancelResponse(state.game,parent);done();return;}
 if(mode==='payOrCancel'){const choices=[{args:['cancel'],label:'Aktion abbrechen'}];if(forceBudget(enemy)>=2)choices.unshift({args:['pay'],label:'2 Force verwenden'});ccChoose(enemy,card,'PayOrCancel',choices,choice=>{if(choice.args[0]==='pay')spendForce(enemy,2);else PremiereGame.cancelResponse(state.game,parent);done();});return;}
 if(mode==='freezeBonus'){parent.bonus=(parent.bonus??0)+2;done();return;}
 if(mode==='impressive'){drawDestinySeries(side,'impressive',1,cardAbility(target),draws=>{if(draws.length&&PremiereBattle.total(draws)>7){PremiereGame.cancelResponse(state.game,parent);const entry=ccEntry(target);if(target.captured&&entry&&detachTableCard(entry.side,entry.slot,target))rallyCaptive(target,entry.slot);target.cloudCityHiddenTurn=state.game.timing.turn;}done();});return;}
 if(mode==='dodge'){parent.shot.cloudCityEachPenalty=(parent.shot.cloudCityEachPenalty??0)-3;done();return;}
 if(mode==='weaponPlus'){parent.shot.bonus+=3;done();return;}
 if(mode==='swingMiss'){drawDestinySeries(side,'swingAndMiss',1,0,draws=>{if(draws.length)parent.shot.bonus-=PremiereBattle.total(draws);done();});return;}
 if(mode==='scoundrel'){const choices=[{args:['loss'],label:'2 Force verlieren'}];const options=baseBattleWeaponOptions(enemy).filter(shot=>shot.weapon===parent.shot.weapon&&shot.target!==parent.shot.target);for(const [i,shot]of options.entries())choices.unshift({args:['target',i],shot,card:shot.target,label:'Neues Ziel: '+shot.target.name});ccChoose(enemy,card,'Scoundrel',choices,choice=>{if(choice.args[0]==='loss')dagoLoss(enemy,2,card.name,done);else{parent.shot.target=choice.shot.target;parent.shot.defense=choice.shot.defense;done();}});return;}
 if(mode==='killHit'){const entry=ccEntry(target);if(entry)loseTableCard(entry.side,entry.slot,target);done();return;}
 if(mode==='shieldHit'){parent.shield=target;done();return;}
 if(mode==='powerDestiny'){scheduleBattleDestiny(side,'power',1);done();return;}
 if(mode==='noImmunity'){target.cloudCityNoImmunityBattleKey=ccBattleKey();done();return;}
 if(mode==='pursuit'){(state.cloudCityPursuit??=[]).push({side,target,site:battleSession.site});done();return;}
 if(mode==='pirates'){battleSession.cloudCityPirates=true;done();return;}
 if(mode==='levitateDevice'){const index=own.used.indexOf(target);if(index>=0){own.used.splice(index,1);own.used.push(target);battleSession[side.toLowerCase()+'PowerMod']+=PremiereBattle.printedDestiny(target)??0;}done();return;}
 if(mode==='trooperAssault'){for(const unit of battleCandidates(side,parent.site))if(characterTraits(unit).includes('trooper'))unit.cloudCityTrooperTurn=state.game.timing.turn;done();return;}
 if(mode==='cancelDestiny'){parent.draw.cancelled=true;done();return;}
 if(mode==='lostToVane'){ccToWeatherVane(target,frame.site);done();return;}
 if(mode==='lukeLost'){parent.loseInstead=true;done();return;}
 if(mode==='clash'){target.cloudCityClashUntil=dagoDeadline(side);done();return;}
 if(mode==='ambush'){for(const unit of [...ccOwn(enemy).board[frame.site]])if(['Character','Vehicle','Starship'].includes(unit.type)&&detachTableCard(enemy,frame.site,unit))PremiereUnits.remove(unit,card=>ccOwn(ccOwner(card)).used.push(card),card=>ccOwn(ccOwner(card)).used.push(card));done();return;}
 if(mode==='returnHand'){if(detachTableCard(side,entry.slot,entry.card)){const root=entry.card;PremiereUnits.remove(root,unit=>unit===root?own.hand.push(unit):loseOwnedCard(unit,ccOwner(unit)),unit=>loseOwnedCard(unit,ccOwner(unit)));}done();return;}
 if(mode==='dash'){entry.card.cloudCityLandspeedTurn=state.game.timing.turn;done();return;}
 if(mode==='interface'){dagoResolveTop(side,()=>{const original=['deck','force','used'].map(pile=>({pile,card:own[pile].at(-1)})).filter(item=>item.card),available=original.map(item=>item.card),order=[];const choose=()=>{if(!available.length){done();return;}ccChoose(side,card,'Interface',available.map((unit,i)=>({args:[i],card:unit,label:unit.name+' → '+original[order.length].pile})),choice=>{order.push(choice.card);available.splice(available.indexOf(choice.card),1);if(available.length){choose();return;}for(const item of original)own[item.pile].pop();original.forEach((item,i)=>own[item.pile].push(order[i]));done();},{shown:original.map(item=>item.card)});};choose();});return;}
 if(mode==='cancelEffect'){hothCancelEffect(frame.effect);done();return;}
 if(mode==='lookLost'){ccChoose(side,card,'LookLost',[{args:['done'],label:'Schließen'}],done,{shown:ccOwn(frame.targetSide).lost.slice(),publicView:false});return;}
 if(mode==='toUsed'){if(detachTableCard(entry.side,entry.slot,entry.card))ccOwn(ccOwner(entry.card)).used.push(entry.card);done();return;}
 if(['vaneUsed','vaneSite','loseVane'].includes(mode)){frame.vane.support.splice(frame.vane.support.indexOf(target),1);if(mode==='loseVane')loseOwnedCard(target,ccOwner(target));else if(mode==='vaneUsed')ccOwn(ccOwner(target)).used.push(target);else{ccOwn(side).board[frame.to].push(target);target.dagobahNoMoveUntil=state.game.timing.turn;}done();return;}
 if(mode==='toVane'){ccToWeatherVane(entry.card,entry.slot);done();return;}
 if(mode==='relocate'){if(detachTableCard(entry.side,entry.slot,entry.card))ccOwn(entry.side).board[frame.to].push(entry.card);done();return;}
 if(mode==='offEdge'){drawDestinySeries(side,'offTheEdge',1,0,draws=>{if(!draws.length){done();return;}const delta=PremiereBattle.total(draws)-(PremiereBattle.printedDestiny(entry.card)??0);if(delta>0){PremiereGame.retrieveForce(state,side,delta);done();}else if(delta<0)dagoLoss(side,-delta,card.name,done);else{loseTableCard(side,entry.slot,entry.card);done();}});return;}
 if(mode==='blockScomp'){(state.cloudCityScompOff??={})[frame.site]=state.game.timing.turn;done();return;}
 if(mode==='forceLoss'){dagoLoss(enemy,frame.amount,card.name,done);return;}
 if(mode==='insult'){target.cloudCityInsultTurn=state.game.timing.turn;done();return;}
 if(mode==='transferCaptive'){ccSetCaptives(frame.original,ccCaptives(frame.original).filter(card=>card!==frame.captive));ccSetCaptives(frame.escort,[...ccCaptives(frame.escort),frame.captive]);done();return;}
 if(mode==='rotatePile'){const z=ccOwn(frame.targetSide)[frame.pileName];z.unshift(z.pop());done();return;}
 if(mode==='equipmentUsed'){const show=()=>{const choices=ccUnits().filter(entry=>entry.side===side&&(entry.card.type==='Device'&&entry.card.id!=='Light:244'||entry.card.type==='Weapon'&&entry.card.subType==='Character')).map((entry,i)=>({args:[i],card:entry.card,entry,label:entry.card.name}));ccChoose(side,card,'EquipmentUsed',choices.concat({args:['done'],label:'Fertig'}),choice=>{if(choice.args[0]==='done'){done();return;}if(detachTableCard(side,choice.entry.slot,choice.card))own.used.push(choice.card);show();});};show();return;}
 if(typeof ccSettleBattleInterrupt==='function'&&ccSettleBattleInterrupt(frame,parent,done))return;
 throw Error('Nicht implementierter Cloud-City-Interrupt: '+mode);
}
const ccInterruptBase={options:hothInterruptOptions,settle:settleHothInterrupt,restrict:movementRestriction,excluded:excludedFromCurrentBattle,land:PremiereUnits.landspeedCost,conditions:PremiereLocations.conditions,weapon:hothWeaponDestiny,immunity:battleImmunity,power:cardPowerModifier};
hothInterruptOptions=function(side,window=null){return ccInterruptBase.options(side,window).concat(cloudCityEnabled()?ccInterruptOptions(side,window):[]);};
settleHothInterrupt=function(frame,parent){return cloudCityEnabled()&&frame.mode?.startsWith('cc:')&&frame.mode!=='cc:sabacc'?ccSettleInterrupt(frame,parent):ccInterruptBase.settle(frame,parent);};
movementRestriction=function(card){return cloudCityEnabled()&&card.cloudCityClashUntil>=state.game.timing.turn?'Clash Of Sabers / You Are Beaten verhindert Bewegung.':ccInterruptBase.restrict(card);};
excludedFromCurrentBattle=function(card){return cloudCityEnabled()&&(card.cloudCityClashUntil>=state.game.timing.turn||card.cloudCityHiddenTurn===state.game.timing.turn)||ccInterruptBase.excluded(card);};
PremiereUnits.landspeedCost=function(...args){return ccInterruptBase.land(...args);};
PremiereLocations.conditions=function(position,slot,side){const value=ccInterruptBase.conditions(position,slot,side);return cloudCityEnabled()&&position===state&&state.cloudCityScompOff?.[slot]===state.game.timing.turn?{...value,scompLink:false}:value;};
hothWeaponDestiny=function(side,shot){return ccInterruptBase.weapon(side,shot)+(cloudCityEnabled()?shot.cloudCityEachPenalty??0:0);};
battleImmunity=function(side,card,slot,...args){return cloudCityEnabled()&&(card.cloudCityNoImmunityBattleKey&&card.cloudCityNoImmunityBattleKey===ccBattleKey())?0:cloudCityEnabled()&&card.cloudCityTrooperTurn===state.game.timing.turn?Infinity:ccInterruptBase.immunity(side,card,slot,...args);};
cardPowerModifier=function(card,side,slot,present){return ccInterruptBase.power(card,side,slot,present)+(cloudCityEnabled()&&card.cloudCityTrooperTurn===state.game.timing.turn?2:0);};
