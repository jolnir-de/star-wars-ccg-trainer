'use strict';
const dagoDeadline=side=>state.game.timing.turn+(state.activeSide===side?2:1);
function dagoSearch(side,source,pile,filter,next=()=>{},max=1){
 const z=dagoOwn(side),list=z[pile];let left=max;
 const show=()=>{const candidates=list.filter(filter),choices=candidates.map((card,index)=>({args:[index],card,label:card.name})).concat({args:['done'],label:'Auswahl beenden'});
  dagoPrompt(side,source,'Search',choices,choice=>{if(choice.args[0]==='done'){state.pendingCardView=null;if(['deck','used','force'].includes(pile))list.splice(0,list.length,...(pile==='deck'?PremiereGame.shuffleReserve(list,state.game):PremiereGame.shuffle(list,state.game)));next();return true;}const card=choice.card;list.splice(list.indexOf(card),1);delete card.dagobahFaceUp;z.hand.push(card);if(--left<=0){state.pendingCardView=null;if(['deck','used','force'].includes(pile))list.splice(0,list.length,...(pile==='deck'?PremiereGame.shuffleReserve(list,state.game):PremiereGame.shuffle(list,state.game)));next();}else show();return true;});
 };show();
}
function dagoUnitOptions(side){
 const options=[],all=dagoUnits(),own=dagoOwn(side),active=state.activeSide===side,turn=state.game.timing.turn;
 const add=(entry,index,mode,label,cost,resolve,extra={})=>{if(cost<=forceBudget(side))options.push(dagoOption(entry.card,mode,[index,...(extra.args??[])],label,{site:entry.slot,cost,resolve(){spendForce(side,cost);return resolve();},...extra}));};
 all.forEach((entry,index)=>{
  const card=entry.card;if(entry.side!==side||entry.unavailable||!dagoText(card))return;
  const key=dagoUsed(card),can=phase=>active&&state.phase===phase&&!battleSession;
  const search=(filter,cost=1,phase=null)=>{if((phase===null||can(phase))&&(phase===null||!PremiereGame.wasUsed(state.game,'turn',key))&&own.deck.some(filter))add(entry,index,'unitSearch','Reserve Deck durchsuchen ('+cost+' Force)',cost,()=>{PremiereGame.useOnce(state.game,'turn',key);dagoSearch(side,card,'deck',filter);return true;});};
  if(card.id==='Light:2304'&&can(2)&&!PremiereGame.wasUsed(state.game,'game',key)){
   const swords=own.deck.filter(unit=>unit.type==='Weapon'&&/lightsaber/i.test(unit.name)&&PremiereWeapons.deployCost(unit,card,cardAbility(card),card.power)!==null);
   if(swords.length)add(entry,index,'lukeSaber','Lichtschwert kostenlos aus Reserve deployen',0,()=>{PremiereGame.useOnce(state.game,'game',key);dagoPrompt(side,card,'Saber',swords.map((sword,i)=>({args:[i],card:sword,label:sword.name})),choice=>{own.deck.splice(own.deck.indexOf(choice.card),1);(card.weapons??=[]).push(choice.card);own.deck.splice(0,own.deck.length,...PremiereGame.shuffleReserve(own.deck,state.game));state.pendingCardView=null;openDeploymentReaction(side,[choice.card]);return true;});return true;});
  }
  if(card.id==='Dark:491'&&(entry.carriers.some(host=>/Star Destroyer/.test(host.subType))||PremiereLocations.conditions(state,entry.slot,side).dockingBay))search(unit=>PremiereUnits.tie(unit),1,1);
  if(card.id==='Dark:495'&&(entry.carriers.some(host=>host.id==='Dark:906')||/^executor:/.test(dagoTitle(state.locations[entry.slot]))))search(unit=>/^executor:/.test(dagoTitle(unit)),2,2);
  if(card.id==='Dark:538')search(unit=>/^it-o|^hypo$/.test(dagoTitle(unit)));
  if(card.id==='Dark:551')search(unit=>['spice mines of kessel','death star: detention block corridor'].includes(dagoTitle(unit)));
  if(card.id==='Dark:1538'&&['death star','executor'].includes(dagoTitle(state.locations[entry.slot]).split(':')[0]))search(unit=>unit.id==='Dark:2399');
  if(card.id==='Dark:2739')search(unit=>/tractor beam/.test(dagoTitle(unit))||['Dark:1869','Dark:223'].includes(unit.id));
  if(card.id==='Light:2865'&&card.attachments?.some(effect=>effect.id==='Light:2873'))search(unit=>/levitation/.test(dagoTitle(unit)),0,1);
  if(card.id==='Dark:2912'&&battleSession&&activeBattleUnits(side).includes(card)&&!PremiereGame.wasUsed(state.game,'battle',key))all.forEach((target,i)=>{
   if(target.slot===entry.slot&&!target.unavailable&&target.card.subType==='Alien'&&cardAbility(target.card)<3)add(entry,index,'zuckussForfeit',target.card.name+' · Forfeit 0',1,()=>{target.card.dagobahForfeitZeroTurn=turn;PremiereGame.useOnce(state.game,'battle',key);return true;},{args:[i],target:target.card});
  });
  if(card.id==='Dark:9'&&battleSession&&activeBattleUnits(side).includes(card)&&activeBattleUnits(side).some(unit=>unit.id==='Dark:2912')&&!PremiereGame.wasUsed(state.game,'battle',key))for(const pileSide of PremiereGame.sides){
   const pile=dagoOwn(pileSide).used;if(pile.some(unit=>unit.type==='Character'))add(entry,index,'lomUsed','Character aus '+pileSide+' Used in Lost legen',1,()=>{PremiereGame.useOnce(state.game,'battle',key);dagoPrompt(side,card,'LomUsed',pile.filter(unit=>unit.type==='Character').map((unit,i)=>({args:[i],card:unit,label:unit.name})),choice=>{pile.splice(pile.indexOf(choice.card),1);dagoOwn(choice.card.owner??pileSide).lost.push(choice.card);state.pendingCardView=null;return true;});return true;},{args:[pileSide]});
  }
  if(card.id==='Dark:1245'&&battleSession)all.forEach((target,i)=>{if(target.side!==side&&target.slot===entry.slot&&target.card.dagobahHitByIG88===turn&&(battleSession.hitUnits?.[target.side]??[]).includes(target.card))add(entry,index,'assassinate',target.card.name+' sofort verlieren lassen',0,()=>loseTableCard(target.side,target.slot,target.card),{args:[i],target:target.card});});
 });return options;
}
function dagoUtilityOptions(side){
 const options=[],all=dagoUnits(),own=dagoOwn(side),turn=state.game.timing.turn;
 for(const [index,entry] of all.entries()){
  const device=entry.card;if(device.type!=='Device'||(device.controller??device.owner??device.side)!==side||entry.unavailable||!dagoText(device))continue;
  const host=all.find(e=>e.card.attachments?.includes(device))?.card;if(!host||!PremiereUnits.canUseDevice(state,host,device))continue;
  const add=(mode,args,label,cost,resolve,extra={})=>{if(cost<=forceBudget(side))options.push(dagoOption(device,mode,[index,...args],label,{site:entry.slot,cost,device,deviceHost:host,resolve(){spendForce(side,cost);return resolve();},...extra}));};
  if(device.id==='Light:780'&&state.phase===1&&dagoOwn(PremiereGame.otherSide(side)).deck.length)add('sensorscope',[],'Oberste gegnerische Reserve-Karte ansehen',1,()=>{const top=PremiereGame.reserveCards(dagoOwn(PremiereGame.otherSide(side)).deck).at(-1);dagoPrompt(side,device,'Peek',[{args:['done'],label:'Ansicht schließen'}],()=>{state.pendingCardView=null;return true;},{shown:top?[top]:[],publicView:false});return true;});
  if(device.id==='Light:2104'&&state.activeSide===side&&state.phase===1&&!PremiereGame.wasUsed(state.game,'turn',dagoUsed(device)))for(const [targetIndex,target] of all.entries())if(target.slot===entry.slot&&!target.unavailable&&['Weapon','Device'].includes(target.card.type)&&target.card!==device)add('armSteal',[targetIndex],target.card.name+' stehlen',1,()=>{
   PremiereGame.useOnce(state.game,'turn',dagoUsed(device));drawDestinySeries(side,'theft',1,0,draws=>{if(draws.length&&PremiereBattle.total(draws)>2){if(detachTableCard(target.side,target.slot,target.card)){(target.card.type==='Weapon'?(host.weapons??=[]):(host.attachments??=[])).push(target.card);target.card.controller=side;target.card.dagobahArmStolen=true;target.card.dagobahArmDormant=target.card.type==='Weapon'?weaponDeployCost(target.card,host)===null:!matchesRegisteredTarget(host,activeCardRules(target.card,'device')[0]?.targets);dagoArmTransfer(side,host,target.card);}}});return true;
  },{target:target.card});
  if(device.id==='Light:1926')for(const [targetIndex,target] of all.entries())if(target.slot===entry.slot&&!target.unavailable&&isDroid(target.card)&&!(state.hothFusionPower??[]).some(record=>record.device===device))add('fusion',[targetIndex],target.card.name+' · Power +1',0,()=>{(state.hothFusionPower??=[]).push({device,target:target.card});return true;},{target:target.card});
  if(device.id==='Light:1464'){
   if(!host.concealed&&state.phase===1)all.forEach((target,targetIndex)=>{if(target.side!==side&&target.slot===entry.slot&&!target.unavailable&&PremiereUnits.capital(target.card))add('landingClaw',[targetIndex],host.name+' an '+target.card.name+' anheften',0,()=>{detachTableCard(side,entry.slot,host);host.concealed=true;host.dagobahClawParentId=target.card.instanceId;(target.card.occupants??=[]).push({card:host,role:'claw'});return true;});});
  }
 }
 for(const [index,entry] of all.entries())if(entry.card.concealed&&(entry.card.controller??entry.card.owner??entry.card.side)===side&&dagoClawParent(entry.card)){const ship=entry.card,parent=dagoClawParent(ship);options.push(dagoOption(ship,'unclaw',[index],'Landing Claw lösen',{site:entry.slot,resolve(){const slot=dagoEntry(parent)?.slot;if(slot===undefined)return false;const record=parent.occupants.find(e=>e.card===ship);parent.occupants.splice(parent.occupants.indexOf(record),1);delete ship.concealed;delete ship.dagobahClawParentId;own.board[slot].push(ship);return true;}}));}
 return options;
}
function dagoDeployModifier(card,side,slot){
 let value=0;
 if(card.type==='Character'&&dagoEffects('Dark:185',PremiereGame.otherSide(side)).length&&/luke|leia|han|chewbacca|lando|yoda|obi-wan/.test(dagoTitle(card)))value+=2;
 if(card.id==='Dark:2597'&&dagoUnits().some(entry=>entry.slot===slot&&entry.side===side&&!entry.unavailable&&PremiereUnits.capital(entry.card)))value--;
 if(DagobahRules.dagobah(state.locations[slot])&&card.type==='Creature'&&state.locations[slot].id==='Light:600'&&side===dagoLocationPlayer(slot,'Light'))value-=2;
 if(side==='Dark'&&PremiereUnits.tie(card)&&state.locations[slot]?.id==='Dark:2343')value-=2;
 if(squadTrooper(card,side)&&dagoUnits().some(entry=>entry.slot===slot&&entry.side===side&&entry.card.id==='Dark:1538'&&!entry.unavailable&&['death star','executor'].includes(dagoTitle(state.locations[slot]).split(':')[0])))value-=card.deploy??0;
 return value;
}
function dagoCrewModifier(card,side,slot){return dagoDeployModifier(card,side,slot);}
function dagoPowerModifier(card,side,slot){
 let value=0;const present=dagoUnits().filter(entry=>entry.slot===slot&&!entry.unavailable&&PremiereLocations.presentAt(entry,slot));
 if(card.id==='Dark:700'&&dagoText(card))value+=present.filter(entry=>entry.side!==side&&entry.card.type==='Character').length;
 if(card.id==='Dark:538'&&/^executor:/.test(dagoTitle(state.locations[slot]))&&dagoText(card))value++;
 if(card.id==='Dark:1542'&&dagoText(card)&&(/^executor:/.test(dagoTitle(state.locations[slot]))||present.some(entry=>['Dark:1061','Dark:406'].includes(entry.card.id))||state.locations.some(loc=>loc?.id==='Dark:654'&&loc.blownAway)))value+=2;
 if(card.weapons?.some(weapon=>weapon.id==='Dark:1251'&&dagoText(weapon)))value+=2;
 if(!dagoEffects('Dark:918').length&&card.attachments?.some(test=>test.dagobahJediTest===2))value++;
 if(card.attachments?.some(effect=>effect.id==='Dark:937'&&!PremiereUnits.textSuppressed(effect)))value++;
 value-=(card.attachments??[]).filter(creature=>creature.attachedParasite&&dagoTitle(creature)==='vine snake').reduce((sum,creature)=>sum+(creature.dagobahSqueeze??0),0);
 if(card.dagobahDebuffTurn===state.game.timing.turn)value--;
 if(card.dagobahNeuralUntil>=state.game.timing.turn||card.dagobahMeditationUntil)value-=card.power??0;
 return value;
}
function dagoCraftStats(card,slot,stats){
 const crew=(card.occupants??[]).filter(entry=>DagobahRules.live(entry.card)),pilots=crew.filter(entry=>entry.role==='pilot');
 if(stats.powered&&pilots.some(entry=>entry.card.id==='Dark:501'&&dagoText(entry.card))){stats.power++;if(Number.isFinite(stats.maneuver))stats.maneuver++;}
 const mynocks=(card.attachments??[]).filter(creature=>creature.attachedParasite&&dagoTitle(creature)==='mynock').length;stats.power=Math.max(0,stats.power-2*mynocks);if(Number.isFinite(stats.hyperspeed))stats.hyperspeed=Math.max(0,stats.hyperspeed-2*mynocks);

 if(card.id==='Dark:1244'&&pilots.some(entry=>entry.card.id==='Dark:1245'))stats.maneuver=(stats.maneuver??0)+3;
 if(card.dagobahMovingToAttackTurn===state.game.timing.turn&&pilots.some(entry=>entry.card.characteristics?.includes('corellian')))stats.power+=2;
 return stats;
}
function dagoImmunity(side,card,slot){
 if(card.id==='Light:2865'&&dagoText(card)||card.attachments?.some(effect=>effect.id==='Light:2872'&&dagoText(effect)))return Infinity;
 let value=!dagoText(card)?0:card.id==='Light:2304'?4:card.id==='Dark:906'?12:card.id==='Dark:2912'?3:0;
 if(card.id==='Dark:1524'&&dagoText(card))value=dagoUnits().filter(entry=>entry.side!==side&&entry.slot===slot&&!entry.unavailable&&entry.card.subType==='Alien'&&PremiereLocations.presentAt(entry,slot)).length;
 const pilots=(card.occupants??[]).filter(entry=>entry.role==='pilot'&&dagoText(entry.card)).map(entry=>entry.card.id);
 if(card.id==='Dark:176'&&pilots.includes('Dark:366')||card.id==='Dark:1185'&&pilots.includes('Dark:308'))value=Math.max(value,4);
 if(card.id==='Dark:1967'&&pilots.includes('Dark:700')||card.id==='Dark:1244'&&pilots.includes('Dark:1245')||card.id==='Dark:1682'&&pilots.includes('Dark:2912'))value=Math.max(value,3);
 if(pilots.some(pilot=>dagoEntry((card.occupants??[]).find(entry=>entry.card.id===pilot)?.card)?.card.attachments?.some(device=>device.id==='Light:2037')))value=Math.max(value,0);
 if(card.attachments?.some(device=>device.id==='Light:155'&&dagoText(device))&&(card.occupants??[]).some(entry=>dagoText(entry.card)&&isDroid(entry.card)&&(entry.card.navComputer||/^r[1-9]-/i.test(dagoTitle(entry.card))||entry.card.characteristics?.some(trait=>['astromech','r-unit'].includes(trait))))&&pilots.length)value=Math.max(value,(card.occupants??[]).some(entry=>entry.role==='pilot'&&dagoText(entry.card)&&PremiereUnits.matchingPilot(card,entry.card,true))?6:3);
 if(!dagoEffects('Dark:918').length&&card.attachments?.some(test=>test.dagobahJediTest===4))value=Math.max(value,3);
 if(!dagoEffects('Dark:918').length&&card.attachments?.some(test=>test.dagobahJediTest===5))value=Math.max(value,4);
 if(card.dagobahMovingToAttackTurn===state.game.timing.turn||card.dagobahCaveImmunityUntil>=state.game.timing.turn)value=Infinity;
 return value;
}
