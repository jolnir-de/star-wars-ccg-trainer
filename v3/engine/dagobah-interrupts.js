'use strict';
function dagoInterruptOptions(side,window=null){
 const own=dagoOwn(side),enemy=PremiereGame.otherSide(side),all=dagoUnits(),out=[],turn=state.game.timing.turn;
 const add=(card,index,mode,args,label,extra={})=>{const cost=extra.cost??0;if(cost<=forceBudget(side))out.push({card,index,mode:'dago:'+mode,choice:[index,'dago:'+mode,...args],label:card.name+' · '+label,cost,rule:{pile:extra.pile??(card.subType==='Used'?'Used':'Lost')},...extra});};
 own.hand.forEach((card,index)=>{
  if(card.set!=='4'||card.type!=='Interrupt')return;
  if(window){
   if(card.id==='Light:1212'&&window.kind==='interrupt'&&window.target&&typeof window.target==='object')for(const [i,target] of all.entries())if(dagoInterruptRetargetAllowed(window,target))add(card,index,'retargetInterrupt',[i],window.card.name+' → '+target.card.name,{cost:3,target:target.card});
   if(card.id==='Light:1585'&&window.kind==='dagobahBeforeAsteroid'&&window.target&&(window.target.owner??window.target.side)===enemy&&PremiereUnits.fighter(window.target)&&all.some(entry=>entry.side===side&&entry.slot===window.site&&entry.card.type==='Starship'&&!entry.unavailable))add(card,index,'lostRelay',[],'Bei Asteroidenverlust zusätzlichen Force-Verlust verursachen',{entry:dagoEntry(window.target)});
   if(card.id==='Light:2257'&&window.kind==='dagobahCreatureInitiated'&&all.some(entry=>entry.side===side&&isDroid(entry.card)))add(card,index,'cancel',[],'Creature-Angriff aufheben');
   if(['Light:521','Dark:520'].includes(card.id)&&(window.kind==='drain'||window.card?.type==='Effect'&&/Immediate|Mobile/.test(window.card.subType)))add(card,index,'cancel',[],'Laufende Aktion aufheben');
   if(card.id==='Dark:2580'&&/react/i.test(window.kind))add(card,index,'cancel',[],'React aufheben',{pile:'Lost'});
   if(card.id==='Dark:1255'&&window.kind==='dagobahRetrieved'&&window.side===enemy)add(card,index,'forceLoss',[],'Gegner verliert '+Math.ceil(window.amount/2)+' Force',{amount:Math.ceil(window.amount/2)});
   if(card.id==='Light:2799'&&window.kind==='dagobahCreatureDefeat'&&window.targetSide===side&&/dragonsnake|rancor|sarlacc|dianoga|wampa/i.test(window.creature.name))state.locations.forEach((loc,to)=>{if(adjacentSites(window.site,to)&&!movementPrevented(window.target))add(card,index,'hurl',[to],loc.name,{target:window.target,to});});
   if(card.id==='Light:177'&&window.kind==='dagobahDrainEnhanced')for(const [i,entry] of all.entries())for(const [w,sword] of (entry.card.weapons??[]).entries())if(window.weapons?.some(item=>item.host===entry.card&&item.weapon===sword)&&/lightsaber/i.test(sword.name))add(card,index,'saberUsed',[i,w],sword.name+' auf Used legen',{entry,weapon:sword,pile:'Used'});
   if(card.id==='Dark:421'&&window.kind==='destiny'&&window.purpose==='asteroid'&&!window.draw.cancelled)add(card,index,'redraw',[],'Asteroiden-Destiny aufheben und neu ziehen',{pile:'Used'});
   if(card.id==='Light:2749'&&window.kind==='battle'&&window.side===enemy&&battleCandidates(enemy,window.site).filter(unit=>PremiereUnits.capital(unit)).length>=2&&battleCandidates(side,window.site).filter(unit=>unit.type==='Starship').length===1&&battleCandidates(side,window.site).some(PremiereUnits.fighter))add(card,index,'extraDestiny',[],'Zwei Battle Destiny addieren',{amount:2,pile:'Lost'});
   if(card.id==='Dark:121'&&window.kind==='dagobahBattlePhaseEnd')all.forEach((entry,i)=>{if(entry.side===side&&entry.card.subType==='Imperial'&&cardAbility(entry.card)<6)for(const record of state.dagobahLostBattles??[])if(record.side===side&&record.turn===turn&&record.survivors.includes(entry.card))for(let amount=0;amount<=Math.min(PremiereGame.reserveCards(own.deck).length,Math.max(cardForfeitValueAt(entry.card,side,entry.slot),record.damage));amount++)add(card,index,'apology',[i,amount],entry.card.name+' verlieren und '+amount+' Force aktivieren',{entry,amount});});
   if(card.id==='Light:2585'&&window.kind==='dagobahDrawPhaseEnd')add(card,index,'usedOnReserve',[],'Used Pile des aktiven Spielers ins Reserve mischen',{targetSide:window.side});
   if(card.id==='Light:258'&&window.kind==='dagobahCreatureSelected')add(card,index,'retargetCreature',[],'Zufällige Creature-Zielwahl wiederholen');
   return;
  }
  const active=state.activeSide===side;
  if(['Light:2055','Dark:2669'].includes(card.id))add(card,index,'redrawHands',[],'Beide Hände neu ziehen',{cost:3});
  if(card.id==='Light:2643'&&own.force.length)add(card,index,'search',[],'Eigene Force Pile durchsuchen',{pileName:'force',filter:'any'});
  if(card.id==='Light:1384'&&own.used.length)add(card,index,'search',[],'Eine Used-Karte auf die Hand nehmen',{cost:Math.max(0,7-dagoHighest(side)),pileName:'used',filter:'any'});
  if(card.id==='Light:1512'&&own.used.some(unit=>unit.subType==='Droid'||unit.type==='Device'||unit.id==='Light:2352'))add(card,index,'search',[],'Droid, Device oder Stone Pile aus Used holen',{pile:'Lost',pileName:'used',filter:'droidDevice'});
  if(card.id==='Light:814'&&own.lost.some(unit=>unit.type==='Effect'))add(card,index,'search',[],'Effect aus Lost auf die Hand zurückholen',{cost:3,pile:'Lost',pileName:'lost',filter:'effect',retrieval:true});
  if(card.id==='Dark:1150'&&own.used.some(unit=>unit.subType==='Imperial'||unit.id==='Dark:2721'))add(card,index,'search',[],'Imperial oder Visage Of The Emperor aus Used holen',{pile:'Lost',pileName:'used',filter:'imperialVisage'});
  if(card.id==='Dark:2677'&&own.deck.some(unit=>unit.type==='Interrupt'))add(card,index,'search',[],'Interrupt im Reserve suchen',{cost:2,pileName:'deck',filter:'interrupt'});
  if(card.id==='Light:2749'&&own.deck.some(unit=>['collision!','egregious pilot error'].includes(dagoTitle(unit))))add(card,index,'search',[],'Collision! oder Egregious Pilot Error suchen',{pile:'Used',pileName:'deck',filter:'pilotError'});
  if(card.id==='Dark:17'){
   if(dagoOwn(enemy).force.length)add(card,index,'reorderForce',[],'Gegnerische Force Pile ansehen und ordnen',{pile:'Used'});
   if(own.deck.some(unit=>dagoTitle(unit)==='dark forces'))add(card,index,'search',[],'Dark Forces im Reserve suchen',{pile:'Lost',pileName:'deck',filter:'darkForces'});
  }
  if(card.id==='Light:2344'&&own.used.some(unit=>unit.type==='Starship'))add(card,index,'starshipLevitation',[],'Destiny ziehen und Starship aus Used holen',{cost:1,pile:'Lost'});
  if(card.id==='Light:1550'&&dagoUnits().some(entry=>entry.card.id==='Light:2325'&&!entry.unavailable))add(card,index,'doubleMod',[],'Special Modifications bis Zugende verdoppeln');
  if(card.id==='Light:2871'){
   if(own.lost.some(unit=>unit.id==='Light:2865'))add(card,index,'yodaRetrieve',[],'Yoda aus Lost auf Used zurückholen',{cost:1});
   if(own.deck.some(unit=>unit.id==='Light:2865'))add(card,index,'search',[],'Yoda im Reserve suchen',{cost:3,pileName:'deck',filter:'yoda'});
  }
  if(card.id==='Light:976'){
   if(dagoHighest(side)>4)all.forEach((entry,i)=>{if(entry.side===side&&entry.card.missing)add(card,index,'findMissing',[i],entry.card.name+' finden',{cost:3,entry});});
   if(state.phase===1&&own.lost.length)add(card,index,'lostTop',[],'Oberste Lost-Karte prüfen');
  }
  if(card.id==='Light:2867'&&!active&&own.hand.length>1)add(card,index,'yodaStew',[],'Bis zu vier Handkarten auf Force legen');
  if(['Light:2722','Dark:2728'].includes(card.id))add(card,index,'voyeur',[],'Interrupt benennen, Used Pile aufdecken und Wirkung wählen',{pile:'Used'});
  if(card.id==='Dark:929'&&(dagoOwn(enemy).hand.length>=2||PremiereGame.reserveCards(dagoOwn(enemy).deck).length))add(card,index,'fear',[],'Gegner wählt Verlust aus Hand oder Reserve');
  if(card.id==='Dark:688'&&dagoOwn(enemy).hand.length)add(card,index,'randomHand',[],'Zufällige Handkarte des Gegners auf Used legen');
  if(card.id==='Dark:421'&&lifeForceRemaining(side)>0&&PremiereGame.sides.some(actor=>['deck','force','used'].some(pile=>dagoOwn(actor)[pile].length)))add(card,index,'closeCallLost',[],'Oberste gegnerische Pile-Karten vergleichen',{pile:'Lost',lossCost:1});
  if(card.id==='Dark:2401')add(card,index,'asteroidReduction',[],'Asteroiden-Destiny gegen dich für diesen Zug −3',{cost:1});
  if(card.id==='Light:177'&&all.some(entry=>entry.side===side&&['Device','Weapon'].includes(entry.card.type)))add(card,index,'equipmentUsed',[],'Eigene Ausrüstung auf Used legen',{pile:'Lost'});
  if(card.id==='Light:258'){
   const mynocks=all.filter(entry=>dagoTitle(entry.card)==='mynock'&&entry.card.attachedParasite);mynocks.forEach((entry,i)=>add(card,index,'killMynock',[i],entry.card.name+' verlieren',{entry}));
   for(const [i,entry] of all.entries())if(entry.card.attachments?.some(unit=>unit.attachedParasite&&/mynock|vine snake/.test(dagoTitle(unit))))add(card,index,'detachParasites',[i],entry.card.name+' von Parasiten befreien',{entry,cost:1});
  }
  if(card.id==='Light:2257'&&all.some(entry=>entry.side===side&&isDroid(entry.card)))all.forEach((entry,i)=>{if(entry.side===enemy&&entry.card.type==='Creature'&&!entry.unavailable&&!entry.card.attachedParasite)state.locations.forEach((loc,to)=>{if(adjacentSites(entry.slot,to)&&creatureHabitat(entry.card,to))add(card,index,'moveCreature',[i,to],entry.card.name+' → '+loc.name,{entry,to});});});
  if(card.id==='Light:424'&&active&&state.phase===4)all.forEach((entry,i)=>{if(entry.side===side&&entry.card.type==='Starship'&&!entry.unavailable)state.locations.forEach((loc,to)=>{
   if(entry.slot===to)return;const a=state.locations[entry.slot],b=loc,system=dagoSystemSlot(entry.slot);if((DagobahRules.sector(a)&&to===system||isPlanetSystem(a)&&DagobahRules.sector(b)&&b.dagobahSystemSlot===entry.slot)&&!movementPrevented(entry.card))add(card,index,'relocateShip',[i,to],entry.card.name+' → '+loc.name,{entry,to,cost:(entry.card.occupants??[]).some(o=>PremiereUnits.hasSkill(o.card,'smuggler'))?0:1});
  });});
  if(card.id==='Light:2574')all.forEach((entry,i)=>{if(!PremiereUnits.fighter(entry.card)||entry.unavailable||movementPrevented(entry.card))return;state.locations.forEach((loc,to)=>{if(DagobahRules.cave(loc)&&loc.dagobahBigSlot===entry.slot||DagobahRules.cave(state.locations[entry.slot])&&state.locations[entry.slot].dagobahBigSlot===to)add(card,index,'noCave',[i,to],entry.card.name+' → '+loc.name,{entry,to});});});
  if(card.id==='Light:2561')all.forEach((entry,i)=>{if(entry.card.type==='Starship'&&!entry.unavailable&&(DagobahRules.sector(state.locations[entry.slot])||state.locations[entry.slot]?.blownAway))add(card,index,'crazyDestiny',[i],entry.card.name+' · Destiny-Gesamtsumme +2 möglich',{entry,cost:1});});
  if(card.id==='Light:1585')all.forEach((entry,i)=>{if(entry.side===enemy&&!entry.unavailable&&PremiereLocations.presentAt(entry,entry.slot)&&PremiereUnits.fighter(entry.card)&&DagobahRules.sector(state.locations[entry.slot])&&!(state.dagobahAsteroidsDrawn??[]).some(record=>record.card===entry.card&&record.turn===turn)&&all.some(other=>other.side===side&&other.slot===entry.slot&&other.card.type==='Starship'&&!other.unavailable&&PremiereLocations.presentAt(other,entry.slot)))add(card,index,'lostRelay',[i],entry.card.name+' · Zusatzverlust bei Asteroiden',{entry});});
  if(card.id==='Light:817'&&!active&&state.phase===1)state.locations.forEach((loc,site)=>{const targets=all.filter(entry=>entry.side===enemy&&entry.slot===site&&PremiereUnits.capital(entry.card)&&!entry.unavailable&&PremiereLocations.presentAt(entry,site));if(isSystem(loc)&&targets.length>=2)add(card,index,'pilotError',[site],loc.name+' · '+targets.length+' Capitals',{targets});});
  if(card.id==='Dark:2580'&&active&&state.phase===4)all.forEach((entry,i)=>{if(entry.card.id==='Light:1464'&&!entry.unavailable)add(card,index,'cancelLandingClaw',[i],'Landing Claw aufheben',{entry,pile:'Lost'});});
  if(card.id==='Dark:991'&&active&&state.phase===1&&dagoOwn(enemy).hand.length)add(card,index,'frustration',[],'Gegnerische Hand prüfen und Deploy verlangen',{cost:1});
  if(card.id==='Dark:1470'&&active&&state.phase===1)all.forEach((entry,i)=>{if(entry.side===side&&entry.card.type==='Character'&&entry.card.cardIcons?.includes('Dagobah')&&cardAbility(entry.card)>1&&!entry.unavailable)state.locations.forEach((loc,to)=>{if(loc?.cardIcons?.includes('Cloud City')&&(isSite(loc)||PremiereLocations.presence(state,side,to,cardAbility)===true))add(card,index,'relocateShip',[i,to],entry.card.name+' → '+loc.name,{entry,to,cost:isSite(loc)?0:1});});});
  if(card.id==='Light:1212')for(const [i,effect] of [...(state.tableEffects??[]),...Object.entries(state.locationEffects??{}).flatMap(([site,row])=>row.map(e=>({...e,site:Number(site)})))].entries())if(!/immune to alter/i.test(effect.card.gametext)){
   if(effect.card.subType?.includes('Utinni'))all.forEach((target,j)=>{if(dagoRetargetAllowed(effect,target))add(card,index,'retarget',[i,j],effect.card.name+' → '+target.card.name,{cost:3,effect,target:target.card});});
   if(Number.isInteger(effect.site)&&!effect.host)state.locations.forEach((loc,to)=>{if(loc&&to!==effect.site&&dagoRelocateEffectAllowed(effect,to))add(card,index,'moveEffect',[i,to],effect.card.name+' → '+loc.name,{cost:3,effect,to});});
  }
  if(card.id==='Light:2629'){
   all.forEach((entry,i)=>{if(isHoloUnit(entry.card))add(card,index,'cancelHolo',[i],entry.card.name+' aufheben',{entry});});
   if(state.locations.some(loc=>/imperial holotable/.test(dagoTitle(loc))))add(card,index,'destroyHolotable',[],'Imperial Holotable zerstören',{cost:3});
  }
  if(card.id==='Light:2605'&&state.attackRun&&runSurvivors(side).filter(unit=>unit.type==='Vehicle'||PremiereUnits.fighter(unit)).length===1)add(card,index,'tightSqueeze',[],'Am Ende des Attack Run zwei gegnerische Starfighters forfeiten lassen',{cost:1,attackRun:true});
  if(battleSession){
   const ownMembers=battleCandidates(side,battleSession.site),rival=battleCandidates(enemy,battleSession.site),defender=PremiereGame.otherSide(battleSession.initiator);
   if(card.id==='Light:1708'&&isSystem(state.locations[battleSession.site]))for(const [i,entry] of all.entries())if(entry.slot===battleSession.site&&ownMembers.concat(rival).includes(entry.card)&&PremiereUnits.fighter(entry.card))add(card,index,'attackPosition',[i],entry.card.name+' · Power, Immunität, Bewegungsverbot',{entry});
   if(card.id==='Light:2752'&&(rival.filter(PremiereUnits.bountyHunter).length>=2||rival.some(PremiereUnits.bountyHunter)&&rival.some(unit=>unit.subType==='Imperial')))add(card,index,'reduceBattle',[],'Zwei Destiny von gegnerischer Power und Attrition abziehen',{cost:2,pile:'Lost'});
   if(card.id==='Dark:2091'){const defenders=battleCandidates(defender,battleSession.site).filter(unit=>unit.type==='Character');if(defenders.length===1&&PremiereUnits.bountyHunter(defenders[0]))add(card,index,'extraDestiny',[],'Battle Destiny für verteidigenden Bounty Hunter',{targetSide:defender,amount:/bossk|greedo|boba fett/.test(dagoTitle(defenders[0]))?2:1});}
   if(card.id==='Dark:2302'&&lifeForceRemaining(side)>0)add(card,index,'addAttrition',[],'1 Force verlieren: Attrition +1',{lossCost:1});
   if(card.id==='Light:2573')for(let amount=1;amount<=lifeForceRemaining(side);amount++)add(card,index,'reduceAttrition',[amount],'Für '+amount+' verlorene Force Attrition −'+amount,{amount,lossCost:amount});
   if(card.id==='Light:2880'&&battleSession.damage&&!battleSession.dagobahForfeited)add(card,index,'zeroAttrition',[],'Attrition beider Seiten auf 0 setzen');
   if(card.id==='Light:2605'&&(DagobahRules.sector(state.locations[battleSession.site])||/beggar.s canyon|cloud city|death star: trench/.test(dagoTitle(state.locations[battleSession.site])))&&ownMembers.filter(unit=>unit.type==='Vehicle'||PremiereUnits.fighter(unit)).length===1)add(card,index,'tightSqueeze',[],'Am Kampfende zwei gegnerische Craft forfeiten lassen',{cost:1});
  }
 });return out;
}
function dagoHighest(side){return Math.max(0,...dagoUnits().filter(entry=>entry.side===side&&!entry.unavailable&&entry.card.type==='Character'&&!dagoEffects('Light:2800').some(effect=>effect.target===entry.card)).map(entry=>cardAbility(entry.card)??0));}
function dagoSettleInterrupt(frame,parent){
 if(frame.cancelled){finishPileInterrupt(frame);return;}
 const {side,entry,mode}=frame,enemy=PremiereGame.otherSide(side),own=dagoOwn(side),rival=dagoOwn(enemy),kind=mode.slice(5),done=()=>finishPileInterrupt(frame);
 if(kind==='starshipLevitation'){drawDestinySeries(side,'starshipLevitation',1,0,draws=>{if(draws.length&&PremiereBattle.total(draws)<dagoHighest(side))dagoSearch(side,frame.card,'used',card=>card.type==='Starship',done);else done();});return;}
 if(kind==='doubleMod'){state.dagobahDoubleModTurn=state.game.timing.turn;done();return;}
 if(kind==='search'){
  const filters={any:()=>true,droidDevice:card=>card.subType==='Droid'||card.type==='Device'||card.id==='Light:2352',effect:card=>card.type==='Effect',imperialVisage:card=>card.subType==='Imperial'||card.id==='Dark:2721',interrupt:card=>card.type==='Interrupt',pilotError:card=>['collision!','egregious pilot error'].includes(dagoTitle(card)),darkForces:card=>dagoTitle(card)==='dark forces',yoda:card=>card.id==='Light:2865'};
  dagoSearch(side,frame.card,frame.pileName,filters[frame.filter],()=>{if(frame.retrieval)queueRuleResponse({kind:'dagobahRetrieved',side,amount:1});done();});return;
 }
 if(kind==='cancel'){if(parent)PremiereGame.cancelResponse(state.game,parent);done();return;}
 if(kind==='forceLoss'){dagoLoss(enemy,frame.amount,frame.card.name,done);return;}
 if(kind==='redraw'){if(parent){parent.draw.cancelled=true;parent.redraw=true;}done();return;}
 if(kind==='extraDestiny'){scheduleBattleDestiny(frame.targetSide??side,'battle',frame.amount);done();return;}
 if(kind==='reduceBattle'){frame.mode='reduceBattle';return dagoInterruptBase.settle(frame,parent);}
 if(kind==='apology'){loseTableCard(side,entry.slot,entry.card);activateReserve(side,frame.amount);done();return;}
 if(kind==='usedOnReserve'){const z=dagoOwn(frame.targetSide);for(const card of z.used)card.dagobahFaceUp=true;z.deck.push(...z.used.splice(0));z.deck.splice(0,z.deck.length,...PremiereGame.shuffleReserve(z.deck,state.game));done();return;}
 if(kind==='yodaRetrieve'){const card=own.lost.find(card=>card.id==='Light:2865');own.lost.splice(own.lost.indexOf(card),1);own.used.push(card);queueRuleResponse({kind:'dagobahRetrieved',side,amount:1});done();return;}
 if(kind==='findMissing'){delete entry.card.missing;done();return;}
 if(kind==='lostTop'){const card=own.lost.at(-1);if(card?.type==='Character'&&cardAbility(card)<3){own.lost.pop();own.hand.push(card);}else dagoPrompt(side,frame.card,'LostTop',[{args:['done'],label:'Ansicht schließen'}],()=>{state.pendingCardView=null;done();return true;},{shown:card?[card]:[]});if(!state.pendingCardView)done();return;}
 if(kind==='randomHand'){const index=Math.floor(PremiereGame.random(state.game)*rival.hand.length);rival.used.push(rival.hand.splice(index,1)[0]);done();return;}
 if(kind==='redrawHands'){const counts={};for(const actor of PremiereGame.sides){const z=dagoOwn(actor);counts[actor]=z.hand.length;z.deck.push(...z.hand.splice(0),...z.used.splice(0));z.deck.splice(0,z.deck.length,...PremiereGame.shuffleReserve(z.deck,state.game));}const actors=PremiereGame.sides.slice();const next=()=>{const actor=actors.shift();if(!actor){done();return;}dagoDrawIntoHand(actor,counts[actor],next);};next();return;}
 if(kind==='reorderForce'){const source=rival.force.slice(),ordered=[];const show=()=>{dagoPrompt(side,frame.card,'ForceOrder',source.filter(card=>!ordered.includes(card)).map((card,i)=>({args:[i],card,label:card.name})),choice=>{ordered.push(choice.card);if(ordered.length===source.length){rival.force.splice(0,rival.force.length,...ordered);state.pendingCardView=null;done();}else show();return true;});};show();return;}
 if(kind==='yodaStew'){let count=0;const show=()=>dagoPrompt(side,frame.card,'Stew',own.hand.map((card,i)=>({args:[i],card,label:card.name})).concat({args:['done'],label:'Fertig'}),choice=>{if(choice.args[0]==='done'){state.pendingCardView=null;done();return true;}own.hand.splice(own.hand.indexOf(choice.card),1);own.force.push(choice.card);if(++count>=(typeof cloudCityEnabled==='function'&&cloudCityEnabled()&&ccDiningDouble(side)?8:4)||!own.hand.length){state.pendingCardView=null;done();}else show();return true;});show();return;}
 if(kind==='fear'){const choices=[];if(rival.hand.length>=2)choices.push({args:['hand'],label:'2 Handkarten verlieren'});if(PremiereGame.reserveCards(rival.deck).length)choices.push({args:['deck'],label:'Oberste Reserve-Karte verlieren'});dagoPrompt(enemy,frame.card,'Fear',choices,choice=>{if(choice.args[0]==='deck'){state.pendingCardView=null;dagoResolveTop(enemy,()=>{const card=rival.deck.pop();if(card)loseOwnedCard(card,enemy);dagoResolveTop(enemy,done);});}else{let left=2;const choose=()=>dagoPrompt(enemy,frame.card,'FearHand',rival.hand.map((card,i)=>({args:[i],card,label:card.name})),selected=>{rival.hand.splice(rival.hand.indexOf(selected.card),1);loseOwnedCard(selected.card,enemy);if(--left){choose();}else{state.pendingCardView=null;done();}return true;});choose();}return true;});return;}
 if(kind==='voyeur'){
  const names=[...new Map(dagoCatalog().filter(card=>card.type==='Interrupt').map(card=>[dagoTitle(card),card])).values()];
  dagoPrompt(side,frame.card,'VoyeurName',names.map((card,i)=>({args:[i],card,label:card.name})),choice=>{
   const matches=rival.used.filter(card=>dagoTitle(card)===dagoTitle(choice.card));
   dagoPrompt(side,frame.card,'VoyeurReveal',[{args:['Used'],label:'USED: '+matches.length+' Force verlieren lassen'},{args:['Lost'],label:'LOST: '+matches.length+' gefundene Kopien verlieren lassen'}],selected=>{
    state.pendingCardView=null;frame.rule={...frame.rule,pile:selected.args[0]};
    if(frame.rule.pile==='Lost'){for(const card of matches){rival.used.splice(rival.used.indexOf(card),1);loseOwnedCard(card,enemy);}done();}else dagoLoss(enemy,matches.length,frame.card.name,done);return true;
   },{shown:rival.used.slice(),publicView:true});return true;
  });return;
 }
 if(kind==='closeCallLost'){
  dagoResolveTop(enemy,()=>{const tops=['deck','force','used'].map(pile=>({pile,card:rival[pile].at(-1)})).filter(item=>item.card),values=tops.map(item=>PremiereBattle.printedDestiny(item.card)).filter(value=>value>0),lowest=Math.min(...values);
   dagoPrompt(side,frame.card,'CloseCallReveal',[{args:['done'],label:'Alle Karten mit der niedrigsten positiven Destiny verlieren'}],()=>{state.pendingCardView=null;for(const item of tops)if(PremiereBattle.printedDestiny(item.card)===lowest){rival[item.pile].splice(rival[item.pile].indexOf(item.card),1);loseOwnedCard(item.card,enemy);}done();return true;},{shown:tops.map(item=>item.card),publicView:true});
  });return;
 }
 if(kind==='asteroidReduction'){(state.dagobahAsteroidReduction??={})[side]={turn:state.game.timing.turn,amount:3};done();return;}
 if(kind==='killMynock'){loseTableCard(entry.side,entry.slot,entry.card);done();return;}
 if(kind==='detachParasites'){for(const creature of (entry.card.attachments??[]).filter(card=>card.attachedParasite&&/mynock|vine snake/.test(dagoTitle(card))).slice())dagoDetachParasite(creature);done();return;}
 if(kind==='equipmentUsed'){const candidates=dagoUnits().filter(e=>e.side===side&&(e.card.type==='Device'||e.card.type==='Weapon'&&e.card.subType==='Character'));const show=()=>dagoPrompt(side,frame.card,'EquipmentUsed',candidates.filter(e=>dagoEntry(e.card)).map((e,i)=>({args:[i],card:e.card,label:e.card.name})).concat({args:['done'],label:'Fertig'}),choice=>{if(choice.args[0]==='done'){state.pendingCardView=null;done();return true;}const target=dagoEntry(choice.card);if(target&&detachTableCard(target.side,target.slot,target.card))own.used.push(target.card);show();return true;});show();return;}
 if(kind==='saberUsed'){const host=entry.card;host.weapons.splice(host.weapons.indexOf(frame.weapon),1);dagoOwn(frame.weapon.owner??entry.side).used.push(frame.weapon);done();return;}
 if(['relocateShip','noCave','moveCreature','hurl'].includes(kind)){
  const target=entry??dagoEntry(frame.target),owner=target.side;if(detachTableCard(owner,target.slot,target.card))dagoOwn(owner).board[frame.to].push(target.card);
  if(kind==='noCave'){const slug=dagoSlugForCave(DagobahRules.cave(state.locations[frame.to])?frame.to:target.slot);if(slug)slug.card.dagobahMouthClosed=false;if(target.card.occupants?.some(entry=>PremiereUnits.hasSkill(entry.card,'smuggler'))){target.card.dagobahCaveImmunityUntil=dagoDeadline(side);target.card.dagobahAsteroidProtectionUntil=dagoDeadline(side);target.card.dagobahAsteroidProtection=5;}}
  if(kind==='hurl'&&parent)parent.hurled=true;done();return;
 }
 if(kind==='crazyDestiny'){entry.card.dagobahCrazyDestiny={side,turn:state.game.timing.turn};done();return;}
 if(kind==='lostRelay'){entry.card.dagobahLostRelayTurn=state.game.timing.turn;done();return;}
 if(kind==='pilotError'){drawDestinySeries(side,'pilotError',1,0,draws=>{if(draws.length&&PremiereBattle.total(draws)-1<frame.targets.length)for(const target of frame.targets)target.card.dagobahDisabledUntil=dagoDeadline(side);done();});return;}
 if(kind==='attackPosition'){entry.card.dagobahMovingToAttackTurn=state.game.timing.turn;entry.card.dagobahNoMoveUntil=state.game.timing.turn;done();return;}
 if(kind==='cancelLandingClaw'){const host=dagoUnits().find(unit=>unit.card.attachments?.includes(entry.card));if(host){dagoReleaseClaw(host.card);host.card.attachments.splice(host.card.attachments.indexOf(entry.card),1);loseOwnedCard(entry.card,entry.card.owner??entry.card.side);}done();return;}
 if(kind==='addAttrition'){(battleSession.attritionDestiny??={Light:0,Dark:0})[side]++;done();return;}
 if(kind==='reduceAttrition'){(battleSession.dagobahAttritionRelief??={Light:0,Dark:0})[side]+=frame.amount;if(battleSession.damage?.debt?.[side])battleSession.damage.debt[side].attrition=Math.max(0,battleSession.damage.debt[side].attrition-frame.amount);done();return;}
 if(kind==='zeroAttrition'){for(const actor of PremiereGame.sides)battleSession.damage.debt[actor].attrition=0;done();return;}
 if(kind==='tightSqueeze'){(frame.attackRun?state.attackRun:battleSession).dagobahTightSqueeze={side};done();return;}
 if(kind==='cancelHolo'){loseTableCard(entry.side,entry.slot,entry.card);done();return;}
 if(kind==='destroyHolotable'){drawDestinySeries(side,'transmission',1,0,draws=>{if(draws.length&&PremiereBattle.total(draws)+state.locations.filter(DagobahRules.sector).length>3){const slot=state.locations.findIndex(loc=>/imperial holotable/.test(dagoTitle(loc)));for(const actor of PremiereGame.sides)for(const card of dagoOwn(actor).board[slot].slice())loseTableCard(actor,slot,card);state.locations[slot].blownAway=true;dagoLoss('Dark',4,frame.card.name,done);}else done();});return;}
 if(kind==='moveEffect'){const source=(state.locationEffects[frame.effect.site]??[]).find(effect=>effect.card===frame.effect.card);if(source){state.locationEffects[frame.effect.site].splice(state.locationEffects[frame.effect.site].indexOf(source),1);source.site=frame.to;(state.locationEffects[frame.to]??=[]).push(source);}done();return;}
 if(kind==='retarget'){const original=dagoOriginalEffect(frame.effect);if(original.card.migTarget)original.card.migTarget=frame.target;else original.target=frame.target;if(original.card.id==='Light:1429'){const entry=dagoEntry(frame.target);original.origin=entry.slot;original.distance=Math.abs(state.locations[entry.slot].parsec-state.locations[original.site].parsec);}done();return;}
 if(kind==='retargetInterrupt'){parent.target=frame.target;if(parent.entry)parent.entry=dagoEntry(frame.target);done();return;}
 if(kind==='retargetCreature'){parent.retarget=true;done();return;}
 if(kind==='frustration'){const icons=state.locations.reduce((sum,loc,slot)=>sum+(PremiereLocations.icons(state,slot,'Light')??0),0),targets=rival.hand.filter(card=>card.type!=='Interrupt'&&Number.isFinite(card.deploy)&&card.deploy<icons);if(!targets.length){done();return;}dagoPrompt(side,frame.card,'Frustration',targets.map((card,i)=>({args:[i],card,label:card.name})),choice=>{(state.dagobahFrustrations??=[]).push({side,targetSide:enemy,title:dagoTitle(choice.card),until:dagoDeadline(side)});state.pendingCardView=null;done();return true;},{shown:rival.hand.slice(),publicView:false});return;}
 throw Error('Fehlender Dagobah-Interrupt: '+kind);
}
const dagoInterruptBase={options:hothInterruptOptions,settle:settleHothInterrupt};
hothInterruptOptions=function(side,window=null){return dagoInterruptBase.options(side,window).concat(dagobahEnabled()?dagoInterruptOptions(side,window):[]);};
settleHothInterrupt=function(frame,parent){return dagobahEnabled()&&frame.mode?.startsWith('dago:')?dagoSettleInterrupt(frame,parent):dagoInterruptBase.settle(frame,parent);};
