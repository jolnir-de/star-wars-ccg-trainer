'use strict';

function hothStartingGenerator(locations,lightDeck,darkDeck,game) {
 if(!locations.some(HothRules.generator))return;
 const owner=locations.find(HothRules.generator).owner??'Light',reserve=owner==='Light'?lightDeck:darkDeck;
 const plan=HothRules.generatorPlan(locations,reserve);
 if(!plan.allowed)throw new Error('Main Power Generators ohne zulässigen äußeren Marker.');
 if(plan.search) {
  locations.splice(locations.length-1,0,reserve.splice(plan.index,1)[0]);
  const shuffled=PremiereGame.shuffle(reserve,game);reserve.splice(0,reserve.length,...shuffled);
 }
}
function hothFulfillGenerator(side) {
 const {deck}=PremiereGame.zones(state,side),plan=HothRules.generatorPlan(state.locations,deck);
 if(!plan.allowed)throw new Error('Generator-Suche war vor Initiierung nicht zulässig.');
 if(!plan.search)return;
 ensureFreeLocationSlot();const slot=state.locations.indexOf(null),[ridge]=deck.splice(plan.index,1);
 state.locations[slot]=ridge;state.locationOrder=initialLocationOrder(state.locations);
 const shuffled=PremiereGame.shuffle(deck,state.game);deck.splice(0,deck.length,...shuffled);
 ensureFreeLocationSlot();log(side+' spielt North Ridge aus dem Reserve Deck aus und mischt.');
}
function hothDeploymentAllowed(card,loc,side) {
 const slot=state.locations.indexOf(loc),region=sitePlanet(loc)??locationGroup(loc);
 if(!HothRules.canDeploy(state,side,card,slot))return false;
 if(['Light:498','Light:807','Light:808','Dark:2295','Dark:2296','Light:2480'].includes(card.id)&&region!=='hoth')return false;
 if(card.id==='Light:2606'&&!['hoth','yavin 4'].includes(region))return false;
 if(card.id==='Dark:1950'&&!PremiereGame.sides.some(actor=>PremiereLocations.activeCards(state,actor).some(unit=>matchesRegisteredTarget(unit,'star-destroyer'))))return false;
 if(card.id==='Dark:2737')return region==='hoth'&&(HothRules.marker(loc)===7||HothRules.marker(loc)!==null&&!PremiereGame.sides.some(actor=>PremiereLocations.presence(state,actor,slot,cardAbility)===true));
 return true;
}
function hothTravelOptions(card,side,from,to,react=false) {
 if(card.searchPartyTurn===state.game.timing.turn||card.crashed||card.attachments?.some(item=>item.id==='Dark:990'&&!PremiereUnits.textSuppressed(item)))return [];
 const loc=state.locations[to],origin=state.locations[from];
 if(!loc||!origin||from===to)return [];
 if(!hothMovementAllowed(side,card,from,to,react?'react':'regular'))return [];
 let options=baseTravelOptions(card,side,from,to,react).filter(option=>HothRules.canTravel(state,side,from,to,option.kind));
 if(!react&&state.phase===4&&PremiereUnits.active(card)&&!movementPrevented(card)&&(card.type==='Character'||card.type==='Vehicle'&&craftStats(card,from).powered)&&
   (HothRules.title(origin).includes('mountains')&&HothRules.title(loc).includes('ice plains')||HothRules.title(loc).includes('mountains')&&HothRules.title(origin).includes('ice plains'))) {
  if(PremiereLocations.rulesAt(state,state.locations.indexOf(HothRules.title(loc).includes('ice plains')?loc:origin),side,'hothIceJump').length)options.push({kind:'Landspeed',cost:0});
 }
 const collapsed=Number(!!origin.collapsed)+Number(!!loc.collapsed);
 return options.map(option=>{
  let cost=option.cost,free=option.free??(option.cost===0&&option.kind!=='Docking-Bay-Transit');
  if(option.kind==='Docking-Bay-Transit')cost+=PremiereLocations.rulesAt(state,to,side,'hothArrivalTax').reduce((sum,rule)=>sum+rule.amount,0);
  if(hothCalFree(side,card,from,to))free=true;
  if(HothRules.atat(card)&&PremiereLocations.ruleAt(state,to,side,'hothAtatFree')&&option.kind==='Landspeed')free=true;
  if(card.type==='Starship'&&isExteriorPlanetSite(origin)&&PremiereLocations.presentCards(state,side,from).some(unit=>unit.id==='Light:2413'&&!PremiereUnits.textSuppressed(unit)))free=true;
  if(card.id==='Light:1665'&&hothEffects('Light:889',side).some(effect=>sitePlanet(state.locations[effect.site])===(sitePlanet(origin)??locationGroup(origin))))free=true;
  if(card.type==='Starship'&&sitePlanet(origin)==='hoth'&&isSystem(loc)&&locationGroup(loc)==='hoth'&&
    state.locations.some((_,site)=>PremiereLocations.ruleAt(state,site,side,'hothTakeoffFree')&&PremiereLocations.control(state,side,site,cardAbility)===true))free=true;
  return {...option,free,cost:free?0:cost+collapsed};
 });
}
function hothEffects(id,side) {
 return [...(state.tableEffects??[]),...Object.entries(state.locationEffects??{}).flatMap(([site,effects])=>effects.map(effect=>({...effect,site:Number(site)})))].filter(effect=>
  effect.card.id===id&&!PremiereUnits.textSuppressed(effect.card)&&!([effect.host,typeof effect.target==='object'?effect.target:null].filter(Boolean).some(card=>PremiereLocations.findEntry(state,card)?.unavailable))&&(!side||(effect.card.owner??effect.card.side)===side));
}
function hothCharacterPower(card,side,slot) {
 if(card.type!=='Character'||!state.locations[slot])return 0;
 const present=PremiereLocations.presentCards(state,side,slot),entries=PremiereGame.sides.flatMap(actor=>PremiereLocations.entries(state,actor)).filter(entry=>entry.slot===slot&&!entry.unavailable),all=entries.map(entry=>entry.card);
 const has=id=>present.some(unit=>unit.id===id&&!PremiereUnits.textSuppressed(unit));
 const hoth=sitePlanet(state.locations[slot])==='hoth',on=id=>card.id===id&&!PremiereUnits.textSuppressed(card);
 let bonus=0;
 if(isDroid(card)&&(state.hothFusionPower??[]).some(record=>record.target===card&&
  hothAllUnits().some(entry=>entry.card===record.device&&!entry.unavailable&&PremiereLocations.presentAt(entry,slot))))bonus++;
 if(on('Light:345')&&HothRules.marker(state.locations[slot])===3)bonus++;
 if(['Light:807','Dark:2295'].includes(card.id)&&!hoth&&!PremiereUnits.textSuppressed(card))bonus--;
 if(on('Light:707')&&all.some(unit=>unit.personas?.includes('Biggs')||locationTitle(unit)==='biggs darklighter'))bonus+=2;
 if(on('Dark:368')&&all.some(unit=>locationTitle(unit)==='darth vader'))bonus++;
 if(on('Dark:1029')&&all.some(unit=>unit.id==='Dark:62'))bonus++;
 if(hoth&&card.id!=='Light:1018'&&card.subType==='Rebel'&&has('Light:1018'))bonus++;
 if(hoth&&card.subType==='Imperial'&&entries.some(entry=>entry.card.id==='Dark:1029'&&!PremiereUnits.textSuppressed(entry.card)))bonus++;
 if(isDroid(card)&&!isPowerDroid(card)&&present.some(unit=>unit!==card&&unit.id==='Light:815'&&!PremiereUnits.textSuppressed(unit)))bonus++;
 if(on('Light:1404')&&['hoth','yavin 4'].includes(sitePlanet(state.locations[slot])))bonus+=entries.filter(entry=>entry.side===side&&entry.card!==card&&isDroid(entry.card)).length;
 if(on('Light:1621')&&locationTitle(state.locations[slot])==='tatooine: cantina')bonus++;
 const entry=PremiereLocations.findEntry(state,card);
 if(hoth&&card.attachments?.some(item=>item.id==='Light:1165'&&!PremiereUnits.textSuppressed(item)))bonus++;
 if(card.attachments?.some(item=>item.id==='Dark:990'&&!PremiereUnits.textSuppressed(item)))bonus-=card.power??0;
 if(hothEffects('Dark:2572').some(effect=>effect.target===card))bonus-=2;
 return bonus;
}
function hothDeployModifier(card,side,slot) {
 let bonus=Number(!!state.locations[slot]?.collapsed);
 if(isSystem(state.locations[slot])&&hothEffects('Light:805',side).length)bonus--;
 if(isSite(state.locations[slot])&&state.hothDeployDiscounts?.some(record=>record.side===side&&record.planet===sitePlanet(state.locations[slot])&&record.turn===state.game.timing.turn))bonus--;
 const present=PremiereLocations.presentCards(state,side,slot),hoth=sitePlanet(state.locations[slot])==='hoth';
 if(card.id==='Light:807'&&(PremiereLocations.ruleAt(state,slot,side,'hothTrooperDeploy')||present.some(unit=>unit.id==='Light:808'&&!PremiereUnits.textSuppressed(unit))))bonus--;
 if(card.id==='Dark:2295'&&present.some(unit=>unit.id==='Dark:2296'&&!PremiereUnits.textSuppressed(unit)))bonus--;
 if(card.type==='Starship'&&PremiereUnits.capital(card)&&present.some(unit=>unit.id==='Dark:62'&&!PremiereUnits.textSuppressed(unit)))bonus--;
 if(card.type==='Character'&&/medical/i.test((card.extraText??[]).join(' ')))for(const [site] of state.locations.entries()) {
  if(PremiereLocations.ruleAt(state,site,side,'hothMedicalDeploy')&&!PremiereGame.wasUsed(state.game,'turn','hothMedLab:'+site))bonus-=2;
 }
 if(card.id==='Dark:1950'&&PremiereLocations.entries(state,side).some(entry=>entry.card.id==='Dark:2339'&&!entry.unavailable&&
  locationGroup(state.locations[entry.slot])===sitePlanet(state.locations[slot])&&!PremiereUnits.textSuppressed(entry.card)))bonus-=card.deploy;
 if(PremiereUnits.bountyHunter(card)&&PremiereLocations.ruleAt(state,slot,side,'hothHunterDeploy'))bonus-=2;
 if(hoth&&card.type==='Creature'&&card.id==='Dark:2737'&&PremiereLocations.ruleAt(state,slot,side,'hothWampaFree'))bonus-=card.deploy;
 return bonus;
}
function hothRecordDeployment(side,cards) {
 for(const card of cards) {
  const free=state.hothFreeDeploys?.find(record=>record.side===side&&record.title===locationTitle(card)&&record.turn===state.game.timing.turn);
  if(free)state.hothFreeDeploys.splice(state.hothFreeDeploys.indexOf(free),1);
 }
 if(cards.some(card=>card.type==='Character'&&/medical/i.test((card.extraText??[]).join(' '))))for(const [site] of state.locations.entries()) {
  if(PremiereLocations.ruleAt(state,site,side,'hothMedicalDeploy'))PremiereGame.useOnce(state.game,'turn','hothMedLab:'+site);
 }
}
function hothFreeDeploy(card,side) {
 return state.hothFreeDeploys?.some(record=>record.side===side&&record.title===locationTitle(card)&&record.turn===state.game.timing.turn)??false;
}
function hothForfeit(card,side,slot) {
 let bonus=0;
 if(card.type==='Character'&&sitePlanet(state.locations[slot])==='hoth'&&card.attachments?.some(item=>item.id==='Light:1165'&&!PremiereUnits.textSuppressed(item)))bonus++;
 if(PremiereUnits.bountyHunter(card)&&state.locations.some((_,site)=>PremiereLocations.ruleAt(state,site,PremiereGame.otherSide(side),'hothHunterForfeit')&&
   PremiereLocations.control(state,PremiereGame.otherSide(side),site,cardAbility)===true))bonus-=2;
 if(card.type==='Character'&&card.id!=='Light:498'&&/rogue squadron/i.test(card.lore??'')&&
   ['pilot','gunner'].some(trait=>PremiereUnits.hasSkill(card,trait)||characterTraits(card).includes(trait))&&
   sitePlanet(state.locations[slot])==='hoth'&&PremiereLocations.entries(state,side).some(entry=>entry.slot===slot&&!entry.unavailable&&entry.card.id==='Light:498'&&!PremiereUnits.textSuppressed(entry.card)))bonus++;
 return bonus;
}
function hothBattlePower(side,slot) {
 let bonus=0;
 const loc=state.locations[slot],region=sitePlanet(loc)??locationGroup(loc);
 if(region==='hoth')for(const [site] of state.locations.entries())if(PremiereLocations.ruleAt(state,site,side,'hothLeaderPower')&&
  PremiereLocations.control(state,side,site,cardAbility)===true)bonus+=PremiereLocations.presentCards(state,side,site).filter(card=>characterTraits(card).includes('leader')).length;
 if(isSystem(loc)&&hothEffects('Light:805',side).length)bonus+=3;
 if(isSystem(loc)&&hothEffects('Dark:651',side).some(effect=>effect.site===slot))bonus+=PremiereLocations.presentCards(state,side,slot).filter(card=>card.type==='Starship').length;
 if(isSite(loc)&&region==='hoth'&&hothEffects('Dark:327',side).length&&state.locations.some((site,index)=>HothRules.echo(site)&&PremiereLocations.presence(state,side,index,cardAbility)===true))bonus++;
 if(isSite(loc)&&region==='hoth'&&hothEffects('Light:2530',side).some(effect=>effect.completed))bonus+=2;
 return bonus;
}
function hothDrainModifier(side,slot) {
 let bonus=0;
 if(PremiereLocations.ruleAt(state,slot,side,'hothGeneratorDrainPenalty')&&state.locations.some(HothRules.generator))bonus--;
 if(PremiereLocations.ruleAt(state,slot,side,'hothImperialDrain')&&PremiereLocations.presentCards(state,side,slot).some(card=>card.subType==='Imperial'))bonus++;
 if(isSystem(state.locations[slot])&&hothEffects('Light:805',side).length)bonus+=2;
 return bonus;
}
function hothImmunity(side,card,slot,limit) {
 if(card.hothDeltaTurn===state.game.timing.turn)return Infinity;
 if(card.id==='Light:2004')return limit;
 if(PremiereUnits.capital(card)&&card.occupants?.some(entry=>entry.card.id==='Light:2004'&&PremiereUnits.active(entry.card)&&!PremiereUnits.textSuppressed(entry.card)))limit=Math.max(limit,3);
 if(card.attachments?.some(item=>item.id==='Light:811'&&!PremiereUnits.textSuppressed(item))&&isSite(state.locations[slot])&&sitePlanet(state.locations[slot]))limit=Math.max(limit,3);
 if(card.id==='Light:1665'&&hothEffects('Light:889',side).some(effect=>sitePlanet(state.locations[effect.site])===(sitePlanet(state.locations[slot])??locationGroup(state.locations[slot]))))limit=Math.max(limit,3);
 if(card.attachments?.some(item=>item.id==='Dark:692'&&!PremiereUnits.textSuppressed(item))&&limit>0)limit+=2;
 return limit;
}
function hothCraftStats(card,slot,stats) {
 if(!['Starship','Vehicle'].includes(card.type)||!state.locations[slot])return stats;
 const region=sitePlanet(state.locations[slot])??locationGroup(state.locations[slot]);
 if(HothRules.creatureVehicle(card)&&card.occupants?.some(entry=>entry.role==='passenger'&&entry.card.id==='Light:2483'&&PremiereUnits.active(entry.card)&&!PremiereUnits.textSuppressed(entry.card)))stats.power+=2;
 if(card.hothDeltaTurn===state.game.timing.turn)stats.power++;
 if(stats.powered&&!PremiereUnits.textSuppressed(card)) {
  if(card.id==='Dark:272'&&region==='hoth')stats.power++;
  for(const {card:pilot,role} of card.occupants??[])if(role==='pilot'&&PremiereUnits.active(pilot)&&!PremiereUnits.textSuppressed(pilot)) {
   if(pilot.id==='Light:707'&&PremiereGame.sides.some(side=>PremiereLocations.presentCards(state,side,slot).some(unit=>matchesRegisteredTarget(unit,'star-destroyer'))))stats.power++;
   if(PremiereUnits.bountyHunter(pilot)&&PremiereLocations.ruleAt(state,slot,card.controller??card.owner??card.side,'hothHunterPilot'))stats.power++;
  }
  if(card.id==='Light:1665'&&hothEffects('Light:889',card.controller??card.owner??card.side).some(effect=>sitePlanet(state.locations[effect.site])===region))stats.hyperspeed+=2;
 }
 if(HothRules.onHoth(state.locations[slot])&&HothRules.marker(state.locations[slot])!==null&&
   card.type==='Vehicle'&&!HothRules.creatureVehicle(card)&&PremiereLocations.conditions(state,slot,card.controller??card.owner??card.side).night&&hothEffects('Dark:2615').length) {
  stats.power=0;stats.maneuver=0;stats.landspeed=0;
 }
 if(card.hothIonDamage){stats.power=0;if(Number.isFinite(stats.hyperspeed))stats.hyperspeed=0;}
 return stats;
}
function hothDrawModifier(side,card) {
 return /scan/i.test(card.name??'')&&PremiereLocations.activeCards(state,side).some(unit=>unit.id==='Light:2836'&&!PremiereUnits.textSuppressed(unit))?2:0;
}
function hothBattleDestinyResult(side,draws,totals) {
 const key=side.toLowerCase(),other=PremiereGame.otherSide(side).toLowerCase();
 const enemy=PremiereGame.otherSide(side),members=battleCandidates(enemy,battleSession.site);
 const penalty=members.filter(card=>!PremiereUnits.textSuppressed(card)&&
  (card.id==='Light:1391'&&members.some(unit=>unit.subType==='Rebel'&&characterTraits(unit).includes('leader'))||
   card.id==='Dark:1521'&&members.some(unit=>unit.subType==='Imperial'&&characterTraits(unit).includes('leader')))).length;
 if(Number.isFinite(battleSession[key+'Destiny']))battleSession[key+'Destiny']=Math.max(0,battleSession[key+'Destiny']-penalty);
}
function hothWeaponDestiny(side,shot) {
 let bonus=HothRules.crewWeaponBonus(shot.host)+(shot.hothDestinyBonus??0);
 const present=PremiereLocations.presentCards(state,side,shot.from);
 if((HothRules.artillery(shot.weapon)||/blaster rifle/i.test(shot.weapon.name??''))&&shot.host.attachments?.some(item=>item.id==='Dark:1925'&&!PremiereUnits.textSuppressed(item)))bonus++;
 if(shot.weapon.id==='Light:1910') {
  const planet=sitePlanet(state.locations[shot.from]);
  if(PremiereLocations.entries(state,side).some(entry=>entry.card.id==='Light:2618'&&!entry.unavailable&&!PremiereUnits.textSuppressed(entry.card)&&
    sitePlanet(state.locations[entry.slot])===planet&&/war room/.test(locationTitle(state.locations[entry.slot]))))bonus++;
 }
 return bonus;
}

function hothSearchCandidates(side,slot) {
 return PremiereLocations.entries(state,side).filter(entry=>entry.slot===slot&&!entry.unavailable&&entry.card.type==='Character'&&
  PremiereUnits.active(entry.card)&&entry.card.searchPartyTurn!==state.game.timing.turn&&!movementPrevented(entry.card));
}
function hothMissing(side,slot) {
 return PremiereLocations.entries(state,side).filter(entry=>entry.slot===slot&&entry.card.type==='Character'&&entry.card.missing);
}
function hothActionOptions(side) {
 const own=PremiereGame.zones(state,side),options=[];
 const add=(mode,args,label,extra={})=>options.push({mode,args:[mode,...args],label,...extra});
 if(state.gameWinner||state.pendingForceLoss||state.pendingCardView||state.pendingCustody?.length||state.game.timing.pending||PremiereGame.responseWindow(state.game))return options;
 if(state.activeSide===side&&state.phase===1&&!battleSession) {
  state.locations.forEach((loc,slot)=>{
   if(hothMissing(side,slot).length&&hothSearchCandidates(side,slot).length)add('search',[slot],'Suchgruppe bei '+loc.name+' bilden',{site:slot});
  });
 }
 if(state.activeSide===side&&state.phase===2&&!battleSession)own.hand.forEach((card,index)=>{
  if(card.type==='Location') {
   const slot=state.locations.findIndex(site=>site?.collapsed&&locationTitle(site)===locationTitle(card));
   if(slot>=0)add('rebuild',[index,slot],card.name+' wiederaufbauen',{card,index,site:slot,cost:0});
  }
 });
 if(state.activeSide===side&&state.phase===2&&!battleSession)for(const [index,effect] of (state.tableEffects??[]).entries()) {
  if(effect.card.id!=='Light:184'||(effect.card.owner??effect.card.side)!==side||!effect.support?.length)continue;
  const patient=effect.support[0],discount=PremiereLocations.activeCards(state,side).filter(card=>['Light:5300','Light:1001'].includes(card.id)&&!PremiereUnits.textSuppressed(card)).length*2;
  const cost=Math.max(0,(patient.deploy??0)-discount);
  if(cost<=forceBudget(side))add('bacta',[index],'Bacta Tank · '+patient.name+' auf die Hand nehmen ('+cost+' Force)',{card:effect.card,effect,cost});
 }
 if(state.phase===2&&!battleSession)for(const option of hothEffectOptions(side))add('effect',option.choice,option.label,option);
 if(state.activeSide===side&&state.phase===2&&!battleSession)own.hand.forEach((card,index)=>{
  if(!HothRules.artillery(card)||!withinDeploymentLimit(card,side))return;
  state.locations.forEach((loc,slot)=>{
   if(!isSite(loc))return;
   const cost=hothFreeDeploy(card,side)?0:Math.max(0,(card.deploy??0)+hothDeployModifier(card,side,slot));if(cost>forceBudget(side))return;
   if(['Light:161','Light:1044','Light:1910'].includes(card.id)&&!isExteriorPlanetSite(loc))return;
   if(card.id==='Light:1910'&&!['hoth','yavin 4','dantooine'].includes(sitePlanet(loc)))return;
   add('artilleryDeploy',[index,slot],card.name+' bei '+loc.name+' auslegen ('+cost+' Force)',{card,index,site:slot,cost});
  });
 });
 if(!battleSession)for(const shot of hothArtilleryShots(side,'weapons',null,forceBudget(side),true))add('artilleryFire',shot.args,shot.label,{card:shot.weapon,shot,site:shot.from,cost:shot.cost});
 options.push(...hothUnitOptions(side));
 options.push(...hothLocationOptions(side));
 options.push(...hothGeneratorOptions(side));
 options.push(...hothUtilityOptions(side));
 for(const option of hothInterruptOptions(side))add('interrupt',option.choice,option.label,{...option,hothInterrupt:true});
 return options;
}
function playHothAction(side,...args) {
 const option=hothActionOptions(side).find(option=>option.args.length===args.length&&option.args.every((arg,i)=>arg===args[i]));
 if(!option)return false;
 if(option.utility)return playHothUtility(side,option);
 if(option.locationAction)return resolveHothLocation(side,option);
 if(option.mode==='targetGenerator')return fireHothGenerator(side,option);
 if(option.hothInterrupt)return announceHothInterrupt(side,option);
 if(option.unitAction)return resolveHothUnit(side,option);
 if(option.mode==='effect')return announceHothEffect(side,option);
 if(option.mode==='bacta') {spendForce(side,option.cost);PremiereGame.zones(state,side).hand.push(option.effect.support.shift());log(option.label+'.');return true;}
 if(option.mode==='artilleryDeploy') {
  const [card]=PremiereGame.zones(state,side).hand.splice(option.index,1);spendForce(side,option.cost);
  ((state.locationWeapons??={})[option.site]??=[]).push(card);openDeploymentReaction(side,[card]);log(option.label+'.');return true;
 }
 if(option.mode==='artilleryFire') {
  const shot=option.shot;spendForce(side,shot.cost);markWeaponFired(shot);PremiereGame.useOnce(state.game,'phase',shot.keyUse);
  withShipWeaponResponse({kind:'weaponTarget',side,shot,site:shot.targetSlot},frame=>{
   if(frame?.cancelled)return;
   drawDestinySeries(side,'weapon',shot.draws,weaponDestinyModifier(side,shot),draws=>{
    const sum=PremiereBattle.total(draws),total=sum===null?null:Math.max(0,sum+shot.bonus);
    if(!hothResolveShot(side,shot,total,draws,()=>{})&&total!==null&&total>shot.defense)applyWeaponResult(shot,PremiereGame.otherSide(side),shot.targetSlot);
    log(shot.label+' · Waffen-Destiny '+(total??'fehlgeschlagen')+'.');
   });
  });return true;
 }
 if(option.mode==='search') {
  const choices=hothSearchCandidates(side,option.site).map(entry=>entry.card);
  state.pendingCardView={mode:'hothSearch',side,site:option.site,shown:choices,selected:[],publicView:true};
  return true;
 }
 if(option.mode==='rebuild') {
  const own=PremiereGame.zones(state,side),previous=state.locations[option.site];
  ((state.convertedLocations??=[])[option.site]??=[]).push(previous);
  state.locations[option.site]=own.hand.splice(option.index,1)[0];
  log(side+' baut '+previous.name+' wieder auf.');return true;
 }
 return false;
}
function hothCardChoices(frame) {
 if(frame.mode==='hothBonesDeploy')return hothBonesChoices(frame);
 if(frame.mode==='hothMineTarget')return hothMineChoices(frame);
 if(frame.mode==='hothWampaVictim')return hothWampaChoices(frame);
 if(frame.mode?.startsWith('hothInterrupt'))return hothInterruptChoices(frame);
 if(frame.mode==='hothPeek')return [{args:['done'],label:'Ansicht schließen'}];
 if(frame.mode==='hothSearch')return frame.shown.flatMap((card,index)=>hothSearchCandidates(frame.side,frame.site).some(entry=>entry.card===card)?[{
  args:['toggle',index],card,label:(frame.selected.includes(index)?'✓ ':'')+card.name+' · Suchgruppe',
 }]:[]).concat(frame.selected.length?[{args:['search'],label:'Mit '+frame.selected.length+' Charakteren suchen'}]:[]).concat({args:['cancel'],label:'Abbrechen'});
 return [];
}
function finishHothChoice(frame,...args) {
 if(frame.mode==='hothBonesDeploy')return finishHothBones(frame,...args);
 if(frame.mode==='hothMineTarget')return finishHothMineChoice(frame,...args);
 if(frame.mode==='hothWampaVictim')return finishHothWampaChoice(frame,...args);
 if(frame.mode?.startsWith('hothInterrupt'))return finishHothInterruptChoice(frame,...args);
 if(!hothCardChoices(frame).some(option=>option.args.length===args.length&&option.args.every((arg,i)=>arg===args[i])))return false;
 if(frame.mode==='hothPeek'){state.pendingCardView=null;return true;}
 if(frame.mode==='hothSearch') {
  if(args[0]==='toggle') {
   const index=Number(args[1]),at=frame.selected.indexOf(index);
   if(at>=0)frame.selected.splice(at,1);else frame.selected.push(index);
   return true;
  }
  state.pendingCardView=null;
  if(args[0]==='cancel')return true;
  const party=frame.selected.map(index=>frame.shown[index]),bonus=HothRules.searchBonus(state,frame.side,frame.site,party);
  const sensor=hothSensorSource(frame.side,frame.site,true);if(sensor)PremiereUnits.recordDeviceUse(state,sensor.host,sensor.device);
  for(const card of party)card.searchPartyTurn=state.game.timing.turn;
  drawDestinySeries(frame.side,'search',1,bonus,draws=>{
   const total=PremiereBattle.total(draws),missing=hothMissing(frame.side,frame.site);
   if(total!==null&&total>5&&missing.length) {
    const {card}=missing[Math.floor(PremiereGame.random(state.game)*missing.length)];
    delete card.missing;card.searchPartyTurn=state.game.timing.turn;
    log('Suchgruppe findet '+card.name+' (Destiny '+total+'). Bis Zugende keine Bewegung, weitere Suche oder Teilnahme an einem eigenen Battle.');
   }else log('Suchgruppe findet niemanden (Destiny '+(total??'fehlgeschlagen')+').');
  });
  return true;
 }
 return false;
}
function hothMakeMissing(card,side,slot,source) {
 if(card.type!=='Character'||card.missing||card.captured||HothRules.protectedFromWeather(card,state.game.timing.turn)&&/ice storm/i.test(source?.name??''))return false;
 const entry=PremiereLocations.findEntry(state,card);if(!entry)return false;
 card.missing=true;
 log(card.name+' ist vermisst'+(source?' durch '+source.name:'')+'.');
 queueRuleResponse({kind:'hothMissing',side,card,site:slot});return true;
}
function hothCollapseSite(slot) {
 const loc=state.locations[slot];if(!loc||loc.collapsed)return false;
 for(const side of PremiereGame.sides)for(const card of PremiereGame.zones(state,side).board[slot].slice())loseTableCard(side,slot,card);
 for(const effect of (state.locationEffects?.[slot]??[]).slice())cancelLocationEffect(slot,effect);
 for(const weapon of (state.locationWeapons?.[slot]??[]).slice())loseTableCard(weapon.owner??weapon.side,slot,weapon);
 loc.collapsed=true;
 log(loc.name+' ist eingestürzt: Force-Icons und Spieltext aufgehoben; Deploy und Bewegung zu/von hier kosten je 1 Force zusätzlich.');return true;
}
function hothActionAllowed(action) {
 const side=action.side;
 const device=hothActionDevice(action);if(device&&!PremiereUnits.canUseDevice(state,device.host,device.device))return false;
 if(action.card?.type==='Interrupt'&&hothEffects('Dark:1706',PremiereGame.otherSide(side)).length&&["let the wookiee win",'wookiee roar'].includes(locationTitle(action.card)))return false;
 if(['deploy','deployWithPilot'].includes(action.kind)&&!HothRules.canDeploy(state,side,action.card??action.ship,action.args[1]))return false;
 if(action.kind==='transport') {
  if(action.args[0]==='deployAboard'&&!hothDeploymentAllowed(action.card,state.locations[action.to],side))return false;
  if(action.args[0]!=='deployAboard'&&!HothRules.canTravel(state,side,action.from,action.to,
    ['embark','exit','role','swap'].includes(action.args[0])?'Board':action.label))return false;
 }
 if(action.kind==='transitGroup'&&side==='Dark'&&[action.from,action.to].some(slot=>HothRules.shielded(state,slot)))return false;
 if(action.kind==='groupRelocation'&&side==='Dark'&&[action.from,action.to,action.destination?.slot].some(slot=>HothRules.shielded(state,slot)))return false;
 if(['move','transport','react','reactDeploy','groupRelocation','transitGroup'].includes(action.kind)&&
    !hothMovementAllowed(side,action.card,action.from,action.to??action.site??action.args[1],action.kind))return false;
 if(['battle','drain'].includes(action.kind)&&hothEffects('Dark:2098',PremiereGame.otherSide(side)).some(effect=>PremiereLocations.findEntry(state,effect.target)?.slot===action.args[0]))return false;
 return true;
}
function hothMovementAllowed(side,card,from,to,kind) {
 if(!Number.isInteger(to))return true;
 if(['react','reactDeploy'].includes(kind)) {
  if(hothEffects('Dark:2266').length&&[from,to].some(slot=>Number.isInteger(slot)&&PremiereGame.sides.some(actor=>PremiereLocations.presentCards(state,actor,slot).some(isDroid))))return false;
  if(hothAllUnits().some(entry=>entry.side!==side&&!entry.unavailable&&!PremiereUnits.textSuppressed(entry.card)&&
    (entry.card.id==='Light:2128'&&[from,to].includes(entry.slot)||entry.card.id==='Light:1621'&&sitePlanet(state.locations[entry.slot])==='hoth'&&HothRules.echo(state.locations[to]))))return false;
 }
 const walk=card=>[card,...(card.occupants??[]).flatMap(entry=>walk(entry.card))],moving=card?walk(card):[];
 if(from!==to&&isSite(state.locations[from])&&card?.type==='Character'&&['Imperial','Alien'].includes(card.subType)&&
   (HothRules.echo(state.locations[to])||sitePlanet(state.locations[to])==='yavin 4'&&state.locations[to].locationTags?.includes('Interior'))&&
   PremiereLocations.entries(state,PremiereGame.otherSide(side)).some(entry=>entry.slot===from&&!entry.unavailable&&entry.card.id==='Light:2606'&&!PremiereUnits.textSuppressed(entry.card)))return false;
 if(hothEffects('Dark:2541').length&&Number.isInteger(from)&&[from,to].some(slot=>/hoth: echo docking bay/.test(locationTitle(state.locations[slot]))&&PremiereLocations.conditions(state,slot,side).night)&&
   !HothRules.echo(state.locations[/hoth: echo docking bay/.test(locationTitle(state.locations[from]))?to:from])&&
   !moving.every(unit=>unit.type==='Character'&&unit.shieldDoorExemptTurn===state.game.timing.turn))return false;
 for(const effect of hothEffects('Dark:1673'))if(moving.includes(effect.target)) {
  const order=boardLocationOrder(),distance=slot=>Math.abs(order.indexOf(slot)-order.indexOf(effect.site));
  if(sitePlanet(state.locations[to])!==sitePlanet(state.locations[effect.site])||Number.isInteger(from)&&distance(to)>distance(from))return false;
 }
 return true;
}

function hothAllUnits() {return PremiereGame.sides.flatMap(side=>PremiereLocations.entries(state,side).map(entry=>({...entry,side}))).concat(
 Object.entries(state.locationWeapons??{}).flatMap(([slot,cards])=>cards.map(card=>({card,slot:Number(slot),side:card.controller??card.owner??card.side,carriers:[],unavailable:false}))));}
function hothEffectOptions(side,window=null) {
 const options=[],own=PremiereGame.zones(state,side),enemy=PremiereGame.otherSide(side),all=hothAllUnits();
 const add=(card,index,choice,label,extra={})=>{
  const cost=extra.cost??0;
  if(cost<=forceBudget(side)&&withinDeploymentLimit(card,side))options.push({card,index,choice:[index,...choice],label:card.name+' · '+label,cost,...extra});
 };
 own.hand.forEach((card,index)=>{
  if(card.set!=='3'||card.type!=='Effect'||(card.owner??card.side)!==side)return;
  if(window) {
   if(card.id==='Dark:1142'&&window.kind==='hothMissing'&&window.side===enemy&&cardAbility(window.card)>2)
    for(const [i,entry] of all.entries())if(!entry.unavailable&&entry.card.subType==='Rebel'&&cardAbility(entry.card)>2&&sitePlanet(state.locations[entry.slot])===sitePlanet(state.locations[window.site]))
     add(card,index,[i],'High Anxiety auf '+entry.card.name,{host:entry.card,missing:window.card,site:entry.slot});
   if(card.id==='Dark:1706'&&['hothMissing','characterLost'].includes(window.kind)&&/han solo/i.test(window.card?.name??window.fallen?.name??''))
    for(const [i,entry] of all.entries())if(!entry.unavailable&&/chewbacca/.test(locationTitle(entry.card)))add(card,index,[i],'Mournful Roar auf '+entry.card.name,{host:entry.card,site:entry.slot});
   if(card.id==='Dark:327'&&window.kind==='hothMoved'&&window.side===side&&window.card.subType==='Imperial'&&HothRules.echo(state.locations[window.site]))add(card,index,[],'nach Betreten der Echo Base auslegen',{tableOnly:true});
   return;
  }
  if(state.phase!==2||battleSession)return;
  if(card.id!=='Light:736'&&state.activeSide!==side)return;
  if(['Light:184','Light:2481','Dark:2266','Dark:2615'].includes(card.id))add(card,index,[],'auf eigener Tischseite auslegen',{cost:card.id==='Light:184'?4:card.id==='Light:2481'?1:2});
  for(const [site,loc] of state.locations.entries()) {
   if(!loc)continue;
   if(['Light:987','Dark:986'].includes(card.id)&&isSystem(loc)&&locationGroup(loc)==='hoth')add(card,index,[site],loc.name,{site});
   if(['Light:1241','Dark:1240'].includes(card.id)&&site===HothRules.markerExtremes(state).outer)add(card,index,[site],loc.name,{site,direction:-1});
   if(card.id==='Light:805'&&loc.id==='Light:5586'&&state.locations.filter((site,i)=>HothRules.echo(site)&&PremiereLocations.occupy(state,side,i,cardAbility)===true).length>=3)add(card,index,[site],loc.name,{site});
   if(card.id==='Light:889'&&/war room/.test(locationTitle(loc))&&(loc.owner??loc.side)===side)add(card,index,[site],loc.name,{site});
   if(card.id==='Dark:1253'&&isSite(loc)&&forceFromLocations(enemy).count-forceFromLocations(side).count>=3)add(card,index,[site],loc.name,{site,cost:4});
   if(card.id==='Dark:1270')add(card,index,[site],loc.name,{site});
   if(card.id==='Dark:651'&&isSystem(loc))add(card,index,[site],loc.name,{site});
   if(card.id==='Dark:2541'&&/hoth: echo docking bay/.test(locationTitle(loc))&&HothRules.markerExtremes(state).inner!==null)add(card,index,[site],'Türen zwischen Docking Bay und innerstem Marker',{site});
   if(card.id==='Light:2530'&&isSystem(loc)&&locationGroup(loc)!=='hoth')for(const [i,entry] of all.entries())if(entry.side===side&&!entry.unavailable&&entry.card.id==='Light:1665'&&sitePlanet(state.locations[entry.slot])==='hoth')add(card,index,[site,i],entry.card.name+' nach '+loc.name+' schicken',{site,target:entry.card});
   if(['Dark:650','Dark:1673','Dark:2098','Dark:2772'].includes(card.id)) {
    if(card.id==='Dark:650'&&!isExteriorPlanetSite(loc)||card.id==='Dark:1673'&&!isExteriorPlanetSite(loc)||
       card.id==='Dark:2098'&&(!/war room/.test(locationTitle(loc))||!['hoth','yavin 4'].includes(sitePlanet(loc)))||
       card.id==='Dark:2772'&&!PremiereLocations.conditions(state,site,side).dockingBay)continue;
    for(const [i,entry] of all.entries()) {
     if(entry.unavailable)continue;const target=entry.card;
     const eligible=card.id==='Dark:650'?entry.side===enemy&&PremiereUnits.hasSkill(target,'smuggler'):
      card.id==='Dark:1673'?target.type==='Character'&&sitePlanet(state.locations[entry.slot])===sitePlanet(loc):
      card.id==='Dark:2098'?entry.side===enemy&&target.type==='Character'&&(target.subType==='Rebel'&&(target.forfeit??0)>4||characterTraits(target).includes('leader')):
      target.type==='Weapon'&&all.some(host=>host.card.weapons?.includes(target)&&(host.card.type==='Vehicle'||PremiereUnits.fighter(host.card)));
     if(eligible)add(card,index,[site,i],target.name+' → '+loc.name,{site,target,cost:card.id==='Dark:650'?3:card.id==='Dark:2772'?0:2});
    }
   }
  }
  for(const [i,entry] of all.entries()) {
   if(entry.unavailable)continue;const host=entry.card;
   if(card.id==='Light:736'&&host.type==='Creature'&&!/space slug/i.test(host.name??'')&&PremiereLocations.presentCards(state,side,entry.slot).some(unit=>unit.type==='Character'&&unit.weapons?.length))add(card,index,[i],host.name+' entwaffnen',{host,site:entry.slot});
   if(card.id==='Dark:990'&&entry.side===enemy&&host.type==='Character'&&HothRules.marker(state.locations[entry.slot])===7&&
     PremiereGame.sides.flatMap(actor=>PremiereLocations.presentCards(state,actor,entry.slot)).filter(unit=>unit.type==='Character').length===1)add(card,index,[i],host.name+' festfrieren',{host,site:entry.slot});
   if(card.id==='Dark:2572'&&host.type==='Character'&&characterTraits(host).includes('male'))for(const [j,female] of all.entries())if(!female.unavailable&&female.card.type==='Character'&&characterTraits(female.card).includes('female'))add(card,index,[i,j],host.name+' → '+female.card.name,{host,target:female.card,site:entry.slot});
  }
 });
 return options;
}
function announceHothEffect(side,option,window=null) {
 if(window&&(PremiereGame.responseWindow(state.game)!==window||window.priority!==side))return false;
 const own=PremiereGame.zones(state,side);
 if(own.hand[option.index]!==option.card)return false;
 const frame={...option,side,hothEffect:true,kind:Number.isInteger(option.site)&&!option.host?'locationEffect':'tableEffect'};
 own.hand.splice(option.index,1);spendForce(side,option.cost);
 if(window)PremiereGame.answer(state.game,side,frame);
 else if(hasInterruptResponse(frame))PremiereGame.openResponse(state.game,frame);
 else settleHothEffect(frame);
 log(side+' spielt '+option.label+'.');return true;
}
function settleHothEffect(frame) {
 if(frame.cancelled){loseOwnedCard(frame.card,frame.side);return;}
 const {card,side,host,site}=frame;
 const effect={card,targetSide:side,site,target:frame.target??side,host,missing:frame.missing,direction:frame.direction,hoth:true};
 if(host) {(host.attachments??=[]).push(card);(state.tableEffects??=[]).push(effect);}
 else if(Number.isInteger(site))((state.locationEffects??={})[site]??=[]).push(effect);
 else (state.tableEffects??=[]).push(effect);
 if(['Light:1241','Dark:1240'].includes(card.id))hothStormMissing(effect);
}
function hothStormMissing(effect) {
 if(!isExteriorPlanetSite(state.locations[effect.site]))return;
 for(const side of PremiereGame.sides)for(const card of PremiereLocations.presentCards(state,side,effect.site).slice())hothMakeMissing(card,side,effect.site,effect.card);
}
function hothCancelEffect(effect) {
 const at=state.tableEffects?.indexOf(effect)??-1;
 if(at>=0)cancelTableEffect(effect);
 else if(Number.isInteger(effect.site))cancelLocationEffect(effect.site,(state.locationEffects?.[effect.site]??[]).find(item=>item.card===effect.card)??effect);
}
function hothForceLoss(side,amount,reason,next) {
 if(!beginForceLoss(side,amount,{reason,hoth:true,after:next}))next();
}
function hothRunTasks(tasks,next) {
 const task=tasks.shift();if(task)task(()=>hothRunTasks(tasks,next));else next();
}
function hothCheckpoint(event,next) {
 const tasks=[],side=state.activeSide,enemy=PremiereGame.otherSide(side);
 hothContinuous();
 if(event==='phase:start'&&state.phase===1) {
  for(const effect of [...hothEffects('Light:1241',side),...hothEffects('Dark:1240',side)])tasks.push(done=>{
   const destination=HothRules.stormStep(state,effect.site,effect.direction);
   const old=(state.locationEffects?.[effect.site]??[]).find(item=>item.card===effect.card);
   if(!old){done();return;}
   if(destination.lost)hothCancelEffect(effect);
   else {
    state.locationEffects[effect.site].splice(state.locationEffects[effect.site].indexOf(old),1);
    old.site=destination.slot;old.direction=destination.direction;
    (state.locationEffects[destination.slot]??=[]).push(old);
    log(effect.card.name+' zieht nach '+state.locations[destination.slot].name+'.');hothStormMissing(old);
   }
   done();
  });
  for(const effect of hothEffects('Dark:650'))if((effect.card.owner??effect.card.side)===enemy)tasks.push(done=>hothForceLoss(side,1,'deathMark',done));
  for(const {card,slot,unavailable} of PremiereLocations.entries(state,side))if(!unavailable&&card.id==='Light:1997'&&!PremiereUnits.textSuppressed(card)) {
   const ownEntry=PremiereLocations.findEntry(state,card);
   const amount=PremiereLocations.entries(state,enemy).filter(entry=>entry.slot===slot&&!entry.card.captured&&!entry.card.missing&&!entry.card.inactive&&!entry.card.switchedOff&&
    PremiereLocations.physicalPlace(entry)===PremiereLocations.physicalPlace(ownEntry)&&isSpyCharacter(entry.card)).reduce((sum,entry)=>sum+(isDroid(entry.card)?2:1)*(entry.card.undercover?2:1),0);
   if(amount)tasks.push(done=>hothForceLoss(enemy,amount,'r3po',done));
  }
 }
 if(event==='phase:end'&&state.phase===1) {
  for(const effect of hothEffects('Dark:1270',side))if(PremiereLocations.control(state,side,effect.site,cardAbility)===true&&!state.drainedSitesThisTurn?.includes(effect.site))
   (state.hothGenerationSuppression??=[]).push({slot:effect.site,side:enemy,turn:state.game.timing.turn+1});
 }
 if(event==='turn:end') {
  for(const entry of hothAllUnits())if(entry.card.hothSwitchBack?.turn===state.game.timing.turn){entry.card.switchedOff=entry.card.hothSwitchBack.previous;delete entry.card.hothSwitchBack;}
  const frost=[...hothEffects('Light:987'),...hothEffects('Dark:986')];
  const exposed=PremiereLocations.entries(state,side).filter(entry=>entry.card.type==='Character'&&!entry.card.captured&&
    HothRules.marker(state.locations[entry.slot])!==null&&(entry.card.missing?PremiereLocations.physicalPlace(entry)===entry.slot:PremiereLocations.presentAt(entry,entry.slot))&&
    PremiereLocations.conditions(state,entry.slot,side).night&&!HothRules.protectedFromWeather(entry.card,state.game.timing.turn));
  const amount=exposed.reduce((sum,entry)=>sum+(entry.card.missing?2:1),0)*Math.min(1,frost.length);
  if(amount)tasks.push(done=>hothForceLoss(side,amount,'frostbite',done));
  for(const effect of hothEffects('Dark:1706'))if(effect.host)tasks.push(done=>hothForceLoss(PremiereGame.otherSide(effect.card.owner??effect.card.side),1,'mournfulRoar',done));
 }
 hothRunTasks(tasks,next);
}
function hothGeneration(side) {
 let bonus=0;
 for(const [slot] of state.locations.entries()) {
  if(PremiereLocations.ruleAt(state,slot,side,'hothGeneration')&&PremiereLocations.control(state,side,slot,cardAbility)===true)bonus++;
  const suppressed=state.hothGenerationSuppression?.some(record=>record.side===side&&record.slot===slot&&record.turn===state.game.timing.turn);
  const image=hothEffects('Dark:1253').some(effect=>effect.site===slot||adjacentSites(effect.site,slot)||
   PremiereGame.sides.some(actor=>PremiereLocations.entries(state,actor).some(entry=>entry.slot===slot&&!entry.unavailable&&locationTitle(entry.card)==='darth vader')));
  if((suppressed||image)&&(!image||suppressed||PremiereLocations.presence(state,side,slot,cardAbility)!==true))bonus-=PremiereLocations.icons(state,slot,side)??0;
 }
 return bonus;
}
function hothMovementRestriction(card) {
 if(card.missing)return 'Der Charakter ist vermisst und muss zuerst gefunden werden.';
 if(card.crashed)return 'Das Fahrzeug ist abgestürzt und kann sich nicht bewegen.';
 if(card.searchPartyTurn===state.game.timing.turn)return 'Die Suchgruppe darf sich in diesem Zug nicht mehr bewegen.';
 if(card.attachments?.some(effect=>effect.id==='Dark:990'&&!PremiereUnits.textSuppressed(effect)))return 'Frozen Dinner verhindert die Bewegung.';
 return '';
}
function hothContinuous() {
 if(!state?.game)return;
 if(state.hothFusionPower)state.hothFusionPower=state.hothFusionPower.filter(record=>{
  const device=PremiereLocations.findEntry(state,record.device),target=PremiereLocations.findEntry(state,record.target);
  return device&&target&&!device.unavailable&&!target.unavailable&&PremiereLocations.physicalPlace(device)===PremiereLocations.physicalPlace(target);
 });
 if(!state.pendingCardView&&!state.pendingForceLoss&&!PremiereGame.responseWindow(state.game)&&state.hothDeferred?.length)state.hothDeferred.shift()();
 for(const effect of (state.tableEffects??[]).slice()) {
  if(effect.card.set!=='3')continue;
  if(effect.host&&!PremiereLocations.findEntry(state,effect.host)) {hothCancelEffect(effect);continue;}
  if(effect.card.id==='Dark:1142'&&!effect.missing?.missing)hothCancelEffect(effect);
  if(effect.card.id==='Dark:1706'&&hothAllUnits().some(entry=>/han solo/i.test(entry.card.name??'')&&!entry.unavailable))hothCancelEffect(effect);
  if(effect.card.id==='Dark:990') {
   const entry=PremiereLocations.findEntry(state,effect.host),side=entry?.side;
   const present=entry?PremiereLocations.presentCards(state,side,entry.slot):[];
   if(present.some(card=>card.weapons?.some(weapon=>/lightsaber/i.test(weapon.name??'')))||present.reduce((sum,card)=>sum+(cardAbility(card)??0),0)>4)hothCancelEffect(effect);
  }
  if(effect.card.id==='Dark:2572') {
   const host=PremiereLocations.findEntry(state,effect.host),target=PremiereLocations.findEntry(state,effect.target);
   if(!target||host&&PremiereLocations.physicalPlace(host)===PremiereLocations.physicalPlace(target))hothCancelEffect(effect);
  }
 }
 for(const effect of hothEffects('Light:805')) {
  const side=PremiereGame.otherSide(effect.card.owner??effect.card.side);
  const extra=PremiereLocations.entries(state,PremiereGame.otherSide(side)).some(entry=>entry.card.id==='Light:1018'&&!entry.unavailable&&!PremiereUnits.textSuppressed(entry.card)&&HothRules.echo(state.locations[entry.slot]))?1:0;
  if(state.locations.filter((loc,slot)=>HothRules.onHoth(loc)&&isSite(loc)&&PremiereLocations.occupy(state,side,slot,cardAbility)===true).length>=5+extra)hothCancelEffect(effect);
 }
 for(const id of ['Dark:650','Dark:1673','Dark:2098','Dark:2772','Light:2530'])for(const effect of hothEffects(id)) {
  if(effect.completed||effect.dagobahRetrieving)continue;
  const target=PremiereLocations.findEntry(state,effect.target);
  if(!target) {hothCancelEffect(effect);continue;}
  if(target.unavailable)continue;
  if(target.slot!==effect.site)continue;
  if(id==='Dark:650') {
   const side=target.side;detachTableCard(side,target.slot,target.card);
   PremiereUnits.remove(target.card,card=>card===target.card?PremiereGame.zones(state,card.owner??side).used.push(card):loseOwnedCard(card,side),card=>loseOwnedCard(card,side));
  }
  if(id==='Light:2530') {
   const original=(state.locationEffects[effect.site]??[]).find(item=>item.card===effect.card);
   const hoth=state.locations.findIndex(loc=>isSystem(loc)&&locationGroup(loc)==='hoth');
   const amount=2*(target.card.occupants??[]).filter(entry=>entry.role==='passenger').length;
   const complete=()=>{if(hoth>=0&&original){state.locationEffects[effect.site].splice(state.locationEffects[effect.site].indexOf(original),1);original.site=hoth;original.completed=true;(state.locationEffects[hoth]??=[]).push(original);}else hothCancelEffect(effect);};
   if(typeof dagobahEnabled==='function'&&dagobahEnabled())dagoMissionRetrieve(effect,amount,complete);else{PremiereGame.retrieveForce(state,effect.card.owner??effect.card.side,amount);complete();}
   if(state.pendingCardView)return;
  }else hothCancelEffect(effect);
 }
 for(const entry of hothAllUnits()) {
  if(entry.card.type==='Weapon')entry.card.hothWeaponBlocked=hothEffects('Dark:2772').some(effect=>effect.target===entry.card);
 }
}
function hothResponseOptions(side,window) {
 if(!window||window.cancelled)return [];
 const options=hothEffectOptions(side,window).map(option=>({...option,kind:'hothEffect',args:[option.index,'hothEffect',...option.choice.slice(1)]}));
 options.push(...hothInterruptOptions(side,window).map(option=>({...option,kind:'hothInterrupt',args:[option.index,'hothInterrupt',...option.choice.slice(1)]})));
 if(window.kind==='battle'&&window.side===side&&PremiereLocations.entries(state,side).some(entry=>entry.slot===window.site&&!entry.unavailable&&entry.card.id==='Light:2249'&&!PremiereUnits.textSuppressed(entry.card)))
  PremiereLocations.entries(state,side).forEach((entry,index)=>{
   if(entry.unavailable||!squadTrooper(entry.card,side)||!adjacentSites(entry.slot,window.site)||regularMovementUsed(entry.card)||state.battledCardsThisTurn?.includes(entry.card))return;
   const move=travelOptions(entry.card,side,entry.slot,window.site,true).find(move=>move.kind==='Landspeed');
   if(move&&move.cost<=forceBudget(side)&&hothMovementAllowed(side,entry.card,entry.slot,window.site,'regular'))options.push({kind:'hothAbility',ability:'shawnMove',card:entry.card,entry,to:window.site,cost:move.cost,index:-1,args:[-1,'hothShawn',index],label:entry.card.name+' · reguläre Bewegung zum Battle mit Shawn ('+move.cost+' Force)'});
  });
 if(window.kind==='interrupt'&&window.mode==='exposure')PremiereLocations.entries(state,side).forEach((entry,index)=>{
  if(entry.unavailable||entry.card.id!=='Light:2480')return;
  const rider=entry.card.occupants?.find(occupant=>occupant.role==='passenger'&&occupant.card.type==='Character')?.card;
  if(rider)options.push({kind:'hothAbility',ability:'tauntaunSacrifice',card:entry.card,entry,rider,index:-1,args:[-1,'hothTauntaun',index],label:'Tauntaun opfern: '+rider.name+' vor Exposure schützen'});
 });
 if(forceBudget(side)>=1)PremiereLocations.entries(state,side).forEach((entry,index)=>{
  if(entry.unavailable||PremiereUnits.textSuppressed(entry.card))return;
  const permitted=entry.card.id==='Light:1018'&&window.card?.id==='Dark:651'||entry.card.id==='Light:1621'&&
   (sitePlanet(state.locations[entry.slot])==='hoth'&&window.card?.id==='Dark:327'||locationTitle(state.locations[entry.slot])==='tatooine: cantina'&&window.card?.id==='Dark:1565');
  if(permitted)options.push({kind:'hothAbility',ability:'cancelWindow',card:entry.card,index:-1,args:[-1,'hothAbility',index],cost:1,label:entry.card.name+' · '+window.card.name+' aufheben (1 Force)'});
 });
 if(['characterLost','equipmentLost'].includes(window.kind)) {
  const own=PremiereGame.zones(state,side),target=window.fallen;
  if(!own.lost.includes(target))return options;
  for(const [index,entry] of PremiereLocations.entries(state,side).entries()) {
   const {card,slot,unavailable}=entry;
   if(unavailable||PremiereUnits.textSuppressed(card)||window.hothRescueAttempts?.includes(card)||PremiereGame.wasUsed(state.game,'turn','hothRescue:'+card.instanceId))continue;
   const medical=card.id==='Light:5300'&&target.type==='Character'&&!isDroid(target)&&slot===window.site;
   const fx=['Light:1001','Dark:1000'].includes(card.id)&&target.type==='Character'&&!isDroid(target)&&window.forfeited&&window.hit&&
    (slot===window.site||adjacentSites(slot,window.site));
   const techie=card.id==='Light:2782'&&['Vehicle','Starship'].includes(target.type)&&window.hit&&lifeForceRemaining(side)>0&&
    (isExteriorPlanetSite(state.locations[slot])||PremiereLocations.conditions(state,slot,side).dockingBay)&&
    (slot===window.site||adjacentSites(slot,window.site)||sitePlanet(state.locations[slot])===locationGroup(state.locations[window.site]));
   if(medical||fx||techie)options.push({kind:'hothAbility',index:-1,args:[-1,'hothAbility',index],card,target,site:slot,
    ability:'rescue',lossCost:techie?1:0,label:card.name+' · '+target.name+' auf Used retten'+(techie?' (1 Force verlieren)':'')});
  }
  if(target.type==='Character'&&!isDroid(target))for(const [index,effect] of (state.tableEffects??[]).entries())if(!window.hothRescueAttempts?.includes(effect.card)&&effect.card.id==='Light:184'&&
   (effect.card.owner??effect.card.side)===side&&!effect.support?.length)options.push({kind:'hothAbility',index:-1,args:[-1,'hothAbility',-1,index],
    card:effect.card,target,effect,ability:'bacta',label:'Bacta Tank · '+target.name+' aufnehmen'});
 }
 return options;
}
function hothRespond(side,option,window) {
 if(option.kind==='hothInterrupt')return announceHothInterrupt(side,option,window);
 if(option.kind==='hothEffect')return announceHothEffect(side,option,window);
 if(option.ability==='shawnMove'){
  spendForce(side,option.cost);if(detachTableCard(side,option.entry.slot,option.card)){PremiereGame.zones(state,side).board[option.to].push(option.card);(state.movedThisTurn??=[]).push(option.card);hothMoved(side,option.card,option.entry.slot,option.to);refreshBattleParticipants();}
  window.passes=0;window.priority=PremiereGame.otherSide(side);return true;
 }
 if(option.ability==='tauntaunSacrifice') {option.rider.exposureProtectionTurn=state.game.timing.turn;loseTableCard(side,option.entry.slot,option.card);window.passes=0;window.priority=PremiereGame.otherSide(side);return true;}
 if(option.ability==='cancelWindow') {spendForce(side,1);PremiereGame.cancelResponse(state.game,window);settleCancelledResponse(state.game);log(option.label+'.');return true;}
 const own=PremiereGame.zones(state,side),target=option.target,at=own.lost.indexOf(target);
 if(at<0)return false;
 window.passes=0;window.priority=PremiereGame.otherSide(side);
 (window.hothRescueAttempts??=[]).push(option.card);
 if(option.ability!=='bacta')PremiereGame.useOnce(state.game,'turn','hothRescue:'+option.card.instanceId);
 const finish=()=>{
  const index=own.lost.indexOf(target);if(index<0)return;
  const [rescued]=own.lost.splice(index,1);
  if(option.ability==='bacta')(option.effect.support??=[]).push(rescued);
  else own.used.push(rescued);
  log(option.label+'.');
 };
 const attempt=()=>{
  const frame={kind:'hothRescue',side,card:option.card,target,site:window.site,finish};
  if(option.ability!=='bacta'&&hasInterruptResponse(frame))PremiereGame.openResponse(state.game,frame);else finish();
 };
 if(option.lossCost)hothForceLoss(side,option.lossCost,'hothRescueCost',attempt);else attempt();
 return true;
}
function hothMoved(side,card,from,to) {
 const moved=[card];
 for(const unit of moved)delete unit.hothDoublePower;
 for(const unit of moved)if(['Character','Vehicle','Starship'].includes(unit.type))queueRuleResponse({kind:'hothMoved',side,card:unit,from,site:to});
}
function hothWeaponInRange(weapon,from,to,place=from) {
 if(place!==from||sitePlanet(state.locations[from])!==sitePlanet(state.locations[to]))return false;
 if(adjacentSites(from,to))return true;
 if(weapon.id!=='Dark:158'||!weapon.attachments?.some(card=>card.id==='Dark:823'&&!PremiereUnits.textSuppressed(card)))return false;
 const sites=boardLocationOrder().filter(slot=>isSite(state.locations[slot])&&sitePlanet(state.locations[slot])===sitePlanet(state.locations[from]));
 return Math.abs(sites.indexOf(from)-sites.indexOf(to))<=2;
}
function hothArtilleryPowered(side,slot) {
 if(HothRules.generator(state.locations[slot])&&PremiereLocations.ruleAt(state,slot,side,'hothGeneratorPower'))return true;
 return hothAllUnits().some(entry=>!entry.unavailable&&PremiereLocations.presentAt(entry,slot)&&
  (entry.card.owner??entry.card.side)===side&&(isPowerDroid(entry.card)||entry.card.id==='Dark:1925'&&!PremiereUnits.textSuppressed(entry.card)||entry.card.characteristics?.includes('fusion generator')));
}
function hothArtilleryOperators(side,slot) {
 const planet=sitePlanet(state.locations[slot]);
 return PremiereLocations.entries(state,side).filter(entry=>!entry.unavailable&&entry.card.type==='Character'&&PremiereUnits.hasSkill(entry.card,'warrior')&&
  (PremiereLocations.presentAt(entry,slot)||planet&&sitePlanet(state.locations[entry.slot])===planet&&entry.card.attachments?.some(card=>card.id==='Light:135'&&!PremiereUnits.textSuppressed(card))));
}
function hothArtilleryShots(side,timing='weapons',battle=battleSession,budget=forceBudget(side),outside=false) {
 if(timing!=='weapons'||!outside&&(!battle||battle.lightCard!==null||battle.darkCard!==null))return [];
 const shots=[],enemy=PremiereGame.otherSide(side),all=hothAllUnits();
 for(const [key,weapons] of Object.entries(state.locationWeapons??{})) {
  const from=Number(key),planet=sitePlanet(state.locations[from]);
  if(!hothArtilleryPowered(side,from))continue;
  for(const [weaponIndex,weapon] of weapons.entries()) {
   if((weapon.owner??weapon.side)!==side||!HothRules.artillery(weapon)||PremiereUnits.textSuppressed(weapon)||weapon.hothWeaponBlocked||battle?.usedWeapons?.includes(weapon))continue;
   const operators=hothArtilleryOperators(side,from);
   for(const [operatorIndex,operator] of operators.entries()) {
    const host=operator.card;if(!PremiereUnits.canUseWeapon(state,host,weapon))continue;
    const remote=host.attachments?.find(card=>card.id==='Light:135'&&!PremiereUnits.textSuppressed(card));
    const evacuation=weapon.id==='Light:1910'&&hothEffects('Light:889',side).some(effect=>sitePlanet(state.locations[effect.site])===planet);
    if(outside&&!(state.activeSide===side&&(state.phase===1&&remote||state.phase===4&&evacuation)))continue;
    const keyUse=state.phase===4?'hothEvacuation:'+side+':'+planet:'hothRemote:'+remote?.instanceId;
    if(outside&&PremiereGame.wasUsed(state.game,'phase',keyUse))continue;
    const targets=all.filter(entry=>entry.side===enemy&&!entry.unavailable&&PremiereLocations.presentAt(entry,entry.slot)&&
      (outside||entry.slot===battle.site)&&!['Weapon','Device','Effect','Location'].includes(entry.card.type)).filter(entry=>{
     if(weapon.id==='Light:1910')return PremiereUnits.capital(entry.card)&&isSystem(state.locations[entry.slot])&&locationGroup(state.locations[entry.slot])===planet;
     const range=from===entry.slot||adjacentSites(from,entry.slot);
     if(!range)return false;
     if(weapon.id==='Light:161')return entry.card.type==='Vehicle';
     if(weapon.id==='Light:1664')return ['Character','Creature'].includes(entry.card.type)||HothRules.creatureVehicle(entry.card);
     if(weapon.id==='Dark:894')return from===entry.slot&&(['Character','Creature','Vehicle'].includes(entry.card.type)||PremiereUnits.fighter(entry.card)&&isSite(state.locations[entry.slot]));
     return ['Character','Creature','Vehicle'].includes(entry.card.type);
    });
    const make=(targets,indices)=>{
     const target=targets[0],character=['Character','Creature'].includes(target.card.type)||HothRules.creatureVehicle(target.card);
     let defense=targets.reduce((sum,entry)=>sum+(PremiereWeapons.defense(entry.card,cardAbility(entry.card),craftStats(entry.card,entry.slot))??Infinity),0);
     if(weapon.id==='Dark:894'&&PremiereUnits.fighter(target.card))defense=5;
     const bonus=weapon.id==='Light:1910'?3:weapon.id==='Light:1044'&&character?2:weapon.id==='Dark:894'?1:0;
     const cost=2;if(cost>budget||!Number.isFinite(defense))return;
     shots.push({host,weapon,target:target.card,targets:targets.map(entry=>entry.card),targetSlot:target.slot,from,operatorSite:operator.slot,device:outside&&state.phase===1?remote:null,deviceHost:host,
      cost,draws:weapon.id==='Light:1664'?2:1,bonus,defense,effect:weapon.id==='Light:161'?'atgar':weapon.id==='Light:1910'?'hothIon':targets.length>1?'multiHit':'hit',
      args:['hothArtillery',from,weaponIndex,operatorIndex,...indices],keyUse,outside,
      label:weapon.name+' → '+targets.map(entry=>entry.card.name).join(' + ')+' (2 Force)'});
    };
    targets.forEach((target,i)=>{
     make([target],[i]);
     if(weapon.id==='Light:1664')targets.slice(i+1).forEach((other,j)=>{
      const category=card=>HothRules.creatureVehicle(card)?'Creature':card.type;
      if(other.slot===target.slot&&category(other.card)===category(target.card))make([target,other],[i,i+j+1]);
     });
    });
   }
  }
 }
 return shots;
}
function hothResolveShot(side,shot,total,draws,complete) {
 if(!['harpoon','concussion','atgar','hothIon','multiHit'].includes(shot.effect))return false;
 const site=shot.targetSlot??battleSession?.site,enemy=PremiereGame.otherSide(side),value=draws.find(draw=>!draw.cancelled)?.value;
 const record=(defense,hit)=>{if(battleSession)recordBattleShot(battleSession,side,shot,total,defense,hit);};
 if(shot.effect==='harpoon') {
  const hit=total!==null&&total>shot.defense;
  if(value===0){shot.host.crashed=true;log(shot.host.name+' stürzt durch Power Harpoon mit Destiny 0 ab.');}
  else if(hit){shot.target.crashed=true;log(shot.target.name+' stürzt durch die Harpune ab.');}
  record(shot.defense,hit);
 }else if(shot.effect==='concussion') {
  if(value===0){const entry=PremiereLocations.findEntry(state,shot.host);if(entry)loseTableCard(entry.side,entry.slot,entry.card);}
  else if(Number.isFinite(value))for(const entry of hothAllUnits().slice())if(entry.slot===site&&PremiereLocations.presentAt(entry,site)&&
    ['Character','Weapon','Device'].includes(entry.card.type)&&PremiereBattle.printedDestiny(entry.card)===value&&PremiereLocations.findEntry(state,entry.card))loseTableCard(entry.side,site,entry.card);
  const grenade=PremiereLocations.findEntry(state,shot.weapon);if(grenade)loseTableCard(grenade.side,grenade.slot,grenade.card);
  record(null,Number.isFinite(value));log('Concussion Grenade · Destiny '+(value??'fehlgeschlagen')+'.');
 }else if(shot.effect==='atgar') {
  const stats=craftStats(shot.target,site),armor=stats.armor,maneuver=stats.maneuver;
  const crash=Number.isFinite(value)&&Number.isFinite(armor)&&value+2>armor;
  const hit=Number.isFinite(value)&&Number.isFinite(maneuver)&&value+1>maneuver;
  if(crash){shot.target.crashed=true;log(shot.target.name+' stürzt durch Atgar Laser Cannon ab.');}
  if(hit)applyWeaponResult({...shot,effect:'hit'},enemy,site);
  record(Number.isFinite(armor)?armor:maneuver,crash||hit);
 }else {
  const hit=total!==null&&total>shot.defense;record(shot.defense,hit);
  if(hit&&shot.effect==='hothIon') {
   for(const weapon of (shot.target.weapons??[]).slice())loseTableCard(enemy,site,weapon);
   shot.target.hothIonDamage=true;log(shot.target.name+' verliert seine Waffen; Power und Hyperspeed sind 0. Armor bleibt bestehen.');
  }else if(hit)for(const target of shot.targets??[shot.target])applyWeaponResult({...shot,target,effect:'hit'},enemy,PremiereLocations.findEntry(state,target)?.slot??site);
 }
 complete();return true;
}
function hothUnitOptions(side) {
 const options=[],all=PremiereLocations.entries(state,side),enemy=PremiereGame.otherSide(side);
 const add=(mode,args,entry,label,extra={})=>options.push({mode,args:[mode,...args],card:entry.card,site:entry.slot,label:entry.card.name+' · '+label,unitAction:true,...extra});
 for(const [index,entry] of all.entries()) {
  const {card,slot,unavailable}=entry;if(unavailable||PremiereUnits.textSuppressed(card))continue;
  if(state.activeSide===side&&state.phase===1&&!battleSession) {
   const probe=card.id==='Dark:1950',wyron=card.id==='Light:2836';
   const antenna=card.id!=='Dark:1950'&&isDroid(card)&&card.attachments?.some(item=>item.id==='Dark:1949'&&!PremiereUnits.textSuppressed(item))&&
    PremiereLocations.control(state,side,slot,cardAbility)===true;
   const key='hothPeek:'+card.instanceId;
   const count=probe?(PremiereLocations.icons(state,slot,'Light')??0)+(card.attachments?.some(item=>item.id==='Dark:1949'&&!PremiereUnits.textSuppressed(item))?2:0):wyron?PremiereLocations.icons(state,slot,'Dark')??0:antenna?1:0;
   if(count>0&&PremiereGame.zones(state,enemy).hand.length&&!PremiereGame.wasUsed(state.game,'phase',key))add('unitPeek',[index],entry,count+' zufällige gegnerische Handkarten ansehen',{count,key,device:antenna?card.attachments.find(item=>item.id==='Dark:1949'):null,deviceHost:card});
   if(card.id==='Dark:363'&&forceBudget(side)>=2&&!PremiereGame.wasUsed(state.game,'phase','lennox:'+card.instanceId)) {
    const holder=entry.carriers.find(host=>matchesRegisteredTarget(host,'star-destroyer'));
    const beam=holder?.attachments?.find(device=>device.id==='Dark:2620'&&!PremiereUnits.textSuppressed(device));
    if(beam)PremiereLocations.presentCards(state,enemy,slot).filter(target=>target.type==='Starship'&&!/mon calamari star cruiser/i.test(target.subType)).forEach((target,i)=>
     add('lennoxTractor',[index,i],entry,target.name+' mit Tractor Beam fangen (2 Force)',{holder,beam,target,cost:2}));
   }
  }
  if(card.id==='Light:2413'&&/hoth: echo docking bay/.test(locationTitle(state.locations[slot]))&&!PremiereGame.wasUsed(state.game,'turn','hothDoor:'+card.instanceId)) {
   hothAllUnits().forEach((target,i)=>{if(target.card.type==='Character'&&!target.unavailable&&sitePlanet(state.locations[target.slot])==='hoth')add('shieldDoor',[index,i],entry,target.card.name+' für diesen Zug vor Shield Doors schützen',{target:target.card,key:'hothDoor:'+card.instanceId});});
  }
  const cancelIds=card.id==='Light:1018'?['Dark:651']:card.id==='Light:1621'?sitePlanet(state.locations[slot])==='hoth'?['Dark:327']:locationTitle(state.locations[slot])==='tatooine: cantina'?['Dark:1565']:[]:[];
  if(forceBudget(side)>=1)for(const id of cancelIds)hothEffects(id).forEach((effect,effectIndex)=>add('unitCancel',[index,id,effectIndex],entry,effect.card.name+' aufheben (1 Force)',{effect,cost:1}));
 }
 return options;
}
function resolveHothUnit(side,option) {
 if(option.mode==='unitPeek') {
  PremiereGame.useOnce(state.game,'phase',option.key);
  const shown=PremiereGame.shuffle(PremiereGame.zones(state,PremiereGame.otherSide(side)).hand,state.game).slice(0,option.count);
  state.pendingCardView={mode:'hothPeek',side,card:option.card,shown};log(side+' sieht '+shown.length+' zufällige Handkarten an.');return true;
 }
 if(option.mode==='shieldDoor') {option.target.shieldDoorExemptTurn=state.game.timing.turn;PremiereGame.useOnce(state.game,'turn',option.key);log(option.label+'.');return true;}
 if(option.mode==='unitCancel') {spendForce(side,1);hothCancelEffect(option.effect);return true;}
 if(option.mode==='lennoxTractor') {
  spendForce(side,2);PremiereGame.useOnce(state.game,'phase','lennox:'+option.card.instanceId);
  const frame={kind:'tractorBeam',side,card:option.beam,holder:option.holder,target:option.target,site:option.site,bay:option.site};
  if(hasInterruptResponse(frame))PremiereGame.openResponse(state.game,frame);else settleTractorBeam(frame);
  return true;
 }
 return false;
}
function hothAfterReact(frame) {
 if(!frame.deploy)hothMoved(frame.side,frame.card,frame.from,frame.site);
 queueRuleResponse({kind:'hothReactCompleted',side:frame.side,card:frame.card,site:frame.site});
 if(!hothAllUnits().some(entry=>locationTitle(entry.card)==='darth vader'&&!entry.unavailable))return;
 for(const entry of hothAllUnits().slice())if(entry.side!==frame.side&&entry.slot===frame.site&&!entry.unavailable&&entry.card.id==='Dark:62'&&!PremiereUnits.textSuppressed(entry.card)) {
  log('Admiral Ozzel geht verloren, weil der Gegner an seiner Location reagiert, während Vader auf dem Tisch ist.');loseTableCard(entry.side,entry.slot,entry.card);
 }
}
function hothReactOptions(side,window) {
 if(!window||window.cancelled||!['battle','drain','hothCreatureReact'].includes(window.kind)||window.kind!=='hothCreatureReact'&&window.side===side)return [];
 const own=PremiereLocations.entries(state,side),board=PremiereGame.zones(state,side).board,options=[];
 const officer=HothRules.onHoth(state.locations[window.site])&&own.some(entry=>entry.slot===window.site&&!entry.unavailable&&
  ['Light:808','Dark:2296'].includes(entry.card.id)&&!PremiereUnits.textSuppressed(entry.card));
 const importantRebel=window.kind==='battle'&&own.some(entry=>entry.slot===window.site&&!entry.unavailable&&entry.card.subType==='Rebel'&&
  (cardAbility(entry.card)>2||characterTraits(entry.card).includes('leader')));
 const sensor=window.kind==='hothCreatureReact'&&hothSensorSource(side,window.site);
 if(window.kind==='hothCreatureReact'&&PremiereLocations.findEntry(state,state.creatureAttack?.prey?.card)?.slot!==window.site)return [];
 for(const [entryIndex,entry] of own.entries()) {
  const {card,slot:from,unavailable}=entry;
  if(unavailable||reactMovementUsed(card)||PremiereUnits.textSuppressed(card)||!PremiereLocations.presentAt(entry,from))continue;
  const vehicle=card.id==='Dark:272'||['Light:2119','Light:2121','Light:2294'].includes(card.id)&&sitePlanet(state.locations[window.site])==='hoth';
  const scout=card.id==='Light:2045'&&importantRebel;
  const trooper=officer&&squadTrooper(card,side);
  if(window.kind==='hothCreatureReact'?!(sensor&&card.type==='Character'&&from===window.site):!vehicle&&!scout&&!trooper)continue;
  const targets=window.kind==='hothCreatureReact'?state.locations.map((_,slot)=>slot).filter(slot=>slot!==from):[window.site];
  for(const to of targets)for(const move of travelOptions(card,side,from,to,true)) {
   const cost=scout?0:move.cost;
   if(move.kind!=='Landspeed'||cost>forceBudget(side)||!hothMovementAllowed(side,card,from,to,'react'))continue;
   const root=board[from].indexOf(card),index=root>=0?root:board[from].length+entryIndex;
   options.push({card,from,to,index,cost,movement:move.kind,away:window.kind==='hothCreatureReact',hothCarried:root<0,device:sensor?.device,deviceHost:sensor?.host,
    label:card.name+' · als React '+(window.kind==='hothCreatureReact'?'weg nach ':'nach ')+state.locations[to].name+' ('+cost+' Force)'});
  }
 }
 return options;
}
function hothOpenCreatureReact() {
 const attack=state.creatureAttack,frame={kind:'hothCreatureReact',side:attack.entry.side,site:attack.entry.slot};
 if(!PremiereGame.sides.some(side=>hothReactOptions(side,frame).length))return false;
 PremiereGame.openResponse(state.game,frame);state.pendingCardView=null;return true;
}
function hothFinishCreatureReact() {
 const attack=state.creatureAttack;
 if(!attack)return;
 if(attack.prey&&PremiereLocations.findEntry(state,attack.prey.card)?.slot!==attack.entry.slot)finishCreatureAttack();
 else showCreature('creatureFight',state.activeSide);
}
function hothGeneratorOptions(side) {
 if(state.activeSide!==side||state.phase!==1||battleSession||forceBudget(side)<2)return [];
 const hand=PremiereGame.zones(state,side).hand,site=state.locations.findIndex(HothRules.generator);
 if(site<0)return [];
 const sources=PremiereLocations.entries(state,side).filter(entry=>!entry.unavailable&&HothRules.atat(entry.card)&&
  !PremiereUnits.textSuppressed(entry.card)&&craftStats(entry.card,entry.slot).powered&&PremiereLocations.presentAt(entry,entry.slot)&&sitePlanet(state.locations[entry.slot])==='hoth');
 const options=[];
 hand.forEach((card,index)=>{if(card.id!=='Dark:2422')return;
  sources.forEach((entry,source)=>{for(const [weaponIndex,weapon] of (entry.card.weapons??[]).entries()) {
   if(weapon.id!=='Dark:158'||weapon.hothWeaponBlocked||!PremiereUnits.canUseWeapon(state,entry.card,weapon)||
    !(entry.slot===site||hothWeaponInRange(weapon,entry.slot,site)))continue;
   const pilots=(entry.card.occupants??[]).filter(occupant=>occupant.role==='pilot'&&PremiereUnits.active(occupant.card)).map(occupant=>({card:occupant.card,ability:cardAbility(occupant.card)}));
   const permanent=permanentPilotAbility(entry.card);if(permanent!==null)pilots.push({card:entry.card,ability:permanent});
   pilots.forEach((pilot,choice)=>{if(!Number.isFinite(pilot.ability))return;
    options.push({mode:'targetGenerator',card,index,site,source:entry.card,weapon,cost:2,pilot:pilot.card,ability:pilot.ability,
     args:['targetGenerator',index,source,weaponIndex,choice],from:entry.slot,
     label:card.name+' · '+entry.card.name+' mit Pilot-Ability '+pilot.ability+' ('+2+' Force)'});
   });
  }});
 });return options;
}
function fireHothGenerator(side,option) {
 const own=PremiereGame.zones(state,side),at=own.hand.indexOf(option.card);if(at<0)return false;
 own.hand.splice(at,1);spendForce(side,2);
 const shot={host:option.source,weapon:option.weapon,target:state.locations[option.site],targetSlot:option.site,from:option.from,cost:2,draws:1,bonus:0,defense:8};
 markWeaponFired(shot);state.hothEpic={...option,side,shot};
 withShipWeaponResponse({kind:'weaponTarget',side,shot,site:option.site},frame=>{
  if(frame?.cancelled){own.used.push(option.card);state.hothEpic=null;return;}
  drawDestinySeries(side,'weapon',1,weaponDestinyModifier(side,shot),draws=>{
   const destiny=draws.length?PremiereBattle.total(draws):null;
   const sites=state.locations.filter((loc,slot)=>loc&&sitePlanet(loc)==='hoth'&&!PremiereLocations.ruleAt(state,slot,side,'hothNotEpic')&&PremiereLocations.control(state,side,slot,cardAbility)===true).length;
   const extra=Number(option.source.id==='Dark:267')+Number(!!option.weapon.attachments?.some(device=>device.id==='Dark:823'&&!PremiereUnits.textSuppressed(device)));
   const total=destiny===null?null:destiny+option.ability+sites+extra;
   log('Target The Main Generator · Destiny '+(destiny??'fehlgeschlagen')+' + Pilot '+option.ability+' + kontrollierte Hoth-Sites '+sites+' + Ausrüstung '+extra+' = '+(total??'fehlgeschlagen')+'.');
   state.hothEpic=null;
   if(!Number.isFinite(total)||total<=8){own.used.push(option.card);return;}
   loseOwnedCard(option.card,side);
   const target=state.locations[option.site];
   for(const actor of PremiereGame.sides)for(const card of PremiereGame.zones(state,actor).board[option.site].slice())loseTableCard(actor,option.site,card);
   for(const effect of (state.locationEffects?.[option.site]??[]).slice())cancelLocationEffect(option.site,effect);
   for(const weapon of (state.locationWeapons?.[option.site]??[]).slice())loseTableCard(weapon.owner??weapon.side,option.site,weapon);
   target.blownAway=true;target.gameTextCancelled=true;target.icons={light:0,dark:0};
   log('Main Power Generators ist zerstört. Der Schild fällt; die Site bleibt auf dem Tisch.');
   hothForceLoss('Light',8,'mainGenerator',()=>{});
  });
 });return true;
}
function hothLocationOptions(side) {
 const options=[];
 for(const [site,card] of state.locations.entries()) {
  if(!card)continue;
  const light=PremiereLocations.ruleAt(state,site,side,'hothRaise'),dark=PremiereLocations.ruleAt(state,site,side,'hothRaiseAll');
  const key='hothRaise:'+site;
  if(light&&forceBudget(side)>=4&&!PremiereGame.wasUsed(state.game,'turn',key)&&PremiereLocations.control(state,side,site,cardAbility)===true)
   for(const [slot,stack] of Object.entries(state.convertedLocations??{}))stack.forEach((target,index)=>{
    if(isSite(target)&&sitePlanet(target)==='hoth')options.push({mode:'raiseHoth',args:['raiseHoth',site,Number(slot),index],card,target,site,cost:4,key,locationAction:true,label:card.name+' · '+target.name+' anheben (4 Force)'});
   });
  if(dark&&PremiereLocations.occupy(state,side,site,cardAbility)===true) {
   const targets=Object.entries(state.convertedLocations??{}).flatMap(([slot,stack])=>{
    if((state.locations[slot]?.owner??state.locations[slot]?.side)===side)return [];
    const index=stack.findLastIndex(target=>HothRules.onHoth(target)&&(target.owner??target.side)===side);
    return index<0?[]:[{slot:Number(slot),index}];
   });
   if(targets.length)options.push({mode:'raiseAllHoth',args:['raiseAllHoth',site],card,site,cost:0,targets,locationAction:true,label:card.name+' · alle eigenen konvertierten Hoth-Locations anheben'});
  }
 }
 return options;
}
function hothRaiseLocation(slot,index) {
 const stack=state.convertedLocations[slot],previous=state.locations[slot],[card]=stack.splice(index,1);
 stack.push(previous);state.locations[slot]=card;
 for(const effect of (state.locationEffects?.[slot]??[]).slice())if(effect.requiredTag&&!card.locationTags?.includes(effect.requiredTag))cancelLocationEffect(slot,effect);
 log(card.name+' wird über '+previous.name+' angehoben.');
}
function resolveHothLocation(side,option) {
 spendForce(side,option.cost);
 if(option.mode==='raiseHoth'){hothRaiseLocation(option.args[2],option.args[3]);PremiereGame.useOnce(state.game,'turn',option.key);}
 else for(const target of option.targets)hothRaiseLocation(target.slot,target.index);
 return true;
}
function hothShuttleFree(side,card,from,to) {
 return isSystem(state.locations[from])&&isSite(state.locations[to])&&sitePlanet(state.locations[to])===locationGroup(state.locations[from])&&
  (squadTrooper(card,side)||HothRules.combat(card))&&hothEffects('Dark:651',side).some(effect=>effect.site===from);
}
function hothIgnitionModifier(site) {
 if(locationGroup(state.locations[site])!=='hoth')return 0;
 return state.locations.reduce((sum,_,slot)=>sum+(PremiereLocations.ruleAt(state,slot,'Dark','hothIgnition')?1:0),0);
}
function hothCountsForEpic(slot,side='Dark') {return !PremiereLocations.ruleAt(state,slot,side,'hothNotEpic');}
