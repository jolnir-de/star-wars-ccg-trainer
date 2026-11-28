'use strict';
function dagoSystemSlot(slot){const loc=state.locations[slot];if(DagobahRules.sector(loc))return loc.dagobahSystemSlot;if(DagobahRules.cave(loc))return state.locations[loc.dagobahBigSlot]?.dagobahSystemSlot;if(isSystem(loc))return slot;return state.locations.findIndex(card=>isPlanetSystem(card)&&locationGroup(card)===sitePlanet(loc));}
function dagoSectors(system){return boardLocationOrder().filter(slot=>DagobahRules.sector(state.locations[slot])&&state.locations[slot].dagobahSystemSlot===system);}
function dagoMovesLikeFighter(card){return PremiereUnits.fighter(card)||card.id==='Dark:1185';}
function dagoTransferFree(side,site){const loc=state.locations[site];return ['Dark:911','Dark:2343'].includes(loc?.id)&&side===dagoLocationPlayer(site,'Dark')&&(loc.id==='Dark:2343'||PremiereLocations.control(state,dagoLocationPlayer(site,'Light'),site,cardAbility)!==true);}
function dagoSpaceOptions(side){
 const options=dagoLostSpaceOptions(side),own=dagoOwn(side),turn=state.game.timing.turn;
 if(state.activeSide!==side||battleSession)return options;
 if(state.phase===2)own.hand.forEach((card,index)=>{
  if(!withinDeploymentLimit(card,side))return;
  if(DagobahRules.sector(card))state.locations.forEach((system,slot)=>{
   if(!isPlanetSystem(system)||system.blownAway)return;
   const sectors=dagoSectors(slot),copies=sectors.filter(i=>dagoTitle(state.locations[i])===dagoTitle(card)).length;if(copies>=(card.genericLimit??1))return;
   const positions=dagoTitle(card)==='big one'?[boardLocationOrder().indexOf(sectors.at(-1)??slot)+1]:[boardLocationOrder().indexOf(slot)+1,...sectors.filter(i=>dagoTitle(state.locations[i])!=='big one').map(i=>boardLocationOrder().indexOf(i)+1)];
   for(const position of positions)options.push(dagoOption(card,'sectorDeploy',[index,slot,position],system.name+' · Position '+(position+1),{site:slot,resolve(){own.hand.splice(own.hand.indexOf(card),1);card.dagobahSystemSlot=slot;return placeLocationCard(side,card,position);}}));
  });
  if(DagobahRules.cave(card))state.locations.forEach((big,slot)=>{
   if(!DagobahRules.sector(big)||dagoTitle(big)!=='big one'||state.locations.some(loc=>DagobahRules.cave(loc)&&loc.dagobahBigSlot===slot))return;
   options.push(dagoOption(card,'caveDeploy',[index,slot],big.name+' · Asteroidenhöhle',{site:slot,resolve(){own.hand.splice(own.hand.indexOf(card),1);card.dagobahBigSlot=slot;return placeLocationCard(side,card,boardLocationOrder().indexOf(slot)+1);}}));
  });
  if(card.id==='Dark:2343')for(const [host,entry] of dagoUnits().filter(entry=>entry.card.type==='Starship'&&/Star Destroyer/.test(entry.card.subType)&&!entry.unavailable).entries()){
   if(state.locations.filter(loc=>loc?.id==='Dark:2343').length>=3)continue;
   options.push(dagoOption(card,'launchBay',[index,host],entry.card.name+' · Launch Bay',{site:entry.slot,resolve(){own.hand.splice(own.hand.indexOf(card),1);card.hostInstanceId=entry.card.instanceId;return placeLocationCard(side,card,boardLocationOrder().length);}}));
  }
 });
 if(state.phase===4)for(const [index,entry] of dagoUnits().entries()){
  const ship=entry.card;if(entry.unavailable||entry.side!==side||ship.type!=='Starship'||regularMovementUsed(ship)||movementPrevented(ship)||!craftStats(ship,entry.slot,true).powered)continue;
  if(ship.id==='Dark:2598'&&isSystem(state.locations[entry.slot])&&PremiereLocations.control(state,side,entry.slot,cardAbility)===true)for(const effect of dagoEffects('Dark:299',side)){
   if(dagoSystemSlot(effect.site)!==entry.slot||forceBudget(side)<1||!dagoRelocationAllowed(side,ship,entry.slot,effect.site,'BombingRun'))continue;
   options.push(dagoOption(ship,'bombingRun',[index,effect.site],'Bombing Run nach '+state.locations[effect.site].name,{from:entry.slot,to:effect.site,cost:1,resolve(){spendForce(side,1);detachTableCard(side,entry.slot,ship);own.board[effect.site].push(ship);ship.dagobahBombingRun=entry.slot;(state.movedThisTurn??=[]).push(ship);return true;}}));
  }
 }
 if(state.phase===4)for(const [index,entry] of dagoUnits().entries()){
  if(entry.unavailable||entry.side!==side||entry.card.type!=='Character'||regularMovementUsed(entry.card)||movementPrevented(entry.card)||state.tableEffects?.some(effect=>DagobahRules.testNumber(effect.card)===2&&effect.apprentice===entry.card))continue;
  const site=state.locations[entry.slot],host=site?.hostInstanceId&&dagoUnits().find(e=>e.card.instanceId===site.hostInstanceId)?.card;
  if(host&&(host.controller??host.owner??host.side)===side)for(const role of PremiereUnits.roles(host,entry.card)){
   const hostEntry=dagoEntry(host),cost=dagoTransferFree(side,entry.slot)?0:1;if(cost>forceBudget(side))continue;
   options.push(dagoOption(entry.card,'toBridge',[index,role],host.name+' · Brücke',{from:entry.slot,to:hostEntry.slot,cost,resolve(){spendForce(side,cost);detachTableCard(side,entry.slot,entry.card);PremiereUnits.add(host,entry.card,role,side);(state.movedThisTurn??=[]).push(entry.card);return true;}}));
  }
  if(entry.carriers.length&&entry.carriers[0].type==='Starship'&&(entry.carriers[0].controller??entry.carriers[0].owner??entry.carriers[0].side)===side)state.locations.forEach((destination,to)=>{
   if(destination?.hostInstanceId!==entry.carriers[0].instanceId)return;const cost=dagoTransferFree(side,to)?0:1;if(cost>forceBudget(side))return;
   options.push(dagoOption(entry.card,'belowDecks',[index,to],destination.name,{from:entry.slot,to,cost,resolve(){spendForce(side,cost);detachTableCard(side,entry.slot,entry.card);own.board[to].push(entry.card);(state.movedThisTurn??=[]).push(entry.card);return true;}}));
  });
 }
 return options;
}
function dagoTravel(card,side,from,to,react,next){
 if(!dagoMoveAllowed(side,card,from,to))return [];
 const a=state.locations[from],b=state.locations[to],as=DagobahRules.sector(a),bs=DagobahRules.sector(b),ac=DagobahRules.cave(a),bc=DagobahRules.cave(b);
 if((ac||bc)&&dagoSlugForCave(ac?from:to)?.card.dagobahMouthClosed)return [];
 if(as||bs){
  if(card.type!=='Starship'&&!['Light:1719','Dark:1718'].includes(card.id))return [];
  if(card.type==='Starship'&&!craftStats(card,from,true).powered)return [];
  if(as&&bs){const system=dagoSystemSlot(from);if(system!==dagoSystemSlot(to))return [];const sectors=dagoSectors(system),distance=Math.abs(sectors.indexOf(from)-sectors.indexOf(to));return distance>0&&distance<=(dagoMovesLikeFighter(card)||card.type==='Creature'?2:1)?[{kind:'Sector',cost:1}]:[];}
  const sectorSlot=as?from:to,other=as?to:from,system=dagoSystemSlot(sectorSlot);
  if(other===system&&dagoSectors(system)[0]===sectorSlot)return [{kind:'Sector',cost:1}];
  const site=state.locations[other];if(DagobahRules.cave(site)&&site.dagobahBigSlot===sectorSlot&&(dagoMovesLikeFighter(card)||card.type==='Creature'))return [{kind:as?'Landen':'Starten',cost:1}];
  return [];
 }
 if((ac||bc)&&card.type==='Starship'&&PremiereUnits.fighter(card))return [];
 const options=next();
 const crew=card.occupants??[],free=crew.some(entry=>entry.role==='pilot'&&entry.card.id==='Dark:490'&&dagoText(entry.card))||card.attachments?.some(device=>device.id==='Light:780'&&dagoText(device))&&DagobahRules.dagobah(a);
 return options.filter(option=>dagoMoveAllowed(side,card,from,to,option.kind)).map(option=>({...option,cost:free?0:option.cost}));
}
function dagoSpaceContinuous(){
 const executor=dagoUnits().find(entry=>entry.card.id==='Dark:906');
 if(executor)for(const loc of state.locations)if(loc&&/^executor:/.test(dagoTitle(loc))&&!loc.hostInstanceId)loc.hostInstanceId=executor.card.instanceId;
}
function dagoSpaceTiming(event,tasks){
 const side=state.activeSide;
 if(event==='phase:start'&&state.phase===1)tasks.push(done=>{
  const remaining=dagoUnits().filter(entry=>entry.side===side&&!entry.unavailable&&entry.card.type==='Starship'&&DagobahRules.asteroid(state.locations[entry.slot])&&PremiereLocations.presentAt(entry,entry.slot));
  const next=()=>{const targets=remaining.filter(entry=>dagoEntry(entry.card));if(!targets.length){done();return;}const draw=entry=>{remaining.splice(remaining.indexOf(entry),1);state.pendingCardView=null;dagoAsteroid(entry,next);};
   if(targets.length===1){draw(targets[0]);return;}
   dagoPrompt(PremiereGame.otherSide(side),targets[0].card,'AsteroidOrder',targets.map((entry,i)=>({args:[i],card:entry.card,label:entry.card.name+' als nächstes prüfen'})),choice=>{draw(targets.find(entry=>entry.card===choice.card));return true;});
  };next();
 });
 if(event==='phase:end'&&state.phase===4)for(const id of ['Light:2124','Dark:2123'])for(const effect of dagoEffects(id))if(!PremiereGame.wasUsed(state.game,'phase',dagoUsed(effect.card,'rogueMove')))dagoMoveRogue(effect);
 if(event==='phase:end'&&state.phase===3)for(const entry of dagoUnits().filter(entry=>entry.side===side&&entry.card.dagobahBombingRun!==undefined))tasks.push(done=>{
  const target=entry.card.dagobahBombingRun;if(state.locations[target]&&craftStats(entry.card,entry.slot).powered&&!movementPrevented(entry.card)){detachTableCard(side,entry.slot,entry.card);dagoOwn(side).board[target].push(entry.card);delete entry.card.dagobahBombingRun;}else loseTableCard(side,entry.slot,entry.card);done();
 });
}
function dagoMoveRogue(effect){
 const sectors=dagoSectors(dagoSystemSlot(effect.site)),position=sectors.indexOf(effect.site);if(sectors.length<2)return false;
 let direction=effect.direction??1;if(!sectors[position+direction])direction*=-1;
 const next=sectors[position+direction],original=state.locationEffects[effect.site]?.find(entry=>entry.card===effect.card);if(!original)return false;
 state.locationEffects[effect.site].splice(state.locationEffects[effect.site].indexOf(original),1);original.site=next;original.direction=direction;(state.locationEffects[next]??=[]).push(original);
 PremiereGame.useOnce(state.game,'phase',dagoUsed(effect.card,'rogueMove'));return true;
}
function dagoLostSpaceOptions(side){
 if(battleSession||state.phase!==4)return [];
 const options=[];
 for(const effect of dagoEffects('Dark:1583')){
  const pilot=effect.support?.[0];if(!pilot)continue;const pilotSide=pilot.owner??pilot.side,rescue=side===pilotSide;
  if(!rescue&&!(side==='Dark'&&pilotSide==='Light'))continue;
  for(const [index,entry] of dagoUnits().entries()){
   if(entry.side!==side||entry.slot!==effect.site||entry.unavailable||!PremiereUnits.capital(entry.card)||!craftStats(entry.card,entry.slot).powered||!PremiereLocations.presentAt(entry,entry.slot))continue;
   const roles=rescue?PremiereUnits.roles(entry.card,pilot).filter(role=>['pilot','passenger'].includes(role)):['capture'];
   for(const role of roles)options.push(dagoOption(effect.card,'lostPilot',[effect.card.instanceId,index,role],pilot.name+' · '+(rescue?'retten als '+role:'gefangen nehmen')+' · '+entry.card.name,{site:entry.slot,resolve(){
    effect.support.shift();if(rescue)PremiereUnits.add(entry.card,pilot,role,side);else{dagoOwn(pilotSide).board[entry.slot].push(pilot);captureCharacter(pilot,entry.slot);}hothCancelEffect(effect);return true;
   }}));
  }
 }
 return options;
}
function dagoAsteroid(entry,done){
 if(!dagoEntry(entry.card)||entry.card.concealed){done();return;}
 const side=PremiereGame.otherSide(entry.side),system=dagoSystemSlot(entry.slot),sectors=dagoSectors(system);
 const rogue=[...dagoEffects('Light:2124'),...dagoEffects('Dark:2123')].filter(effect=>effect.site===entry.slot).length?2:0;
 let modifier=sectors.length-1+rogue-(entry.card.id==='Dark:176'?2:0);
 if(entry.card.dagobahAsteroidProtectionUntil>=state.game.timing.turn)modifier-=entry.card.dagobahAsteroidProtection??0;
 if(dagoEffects('Light:151').some(effect=>effect.target===entry.card))modifier-=4;
 modifier-=state.dagobahAsteroidReduction?.[entry.side]?.turn===state.game.timing.turn?state.dagobahAsteroidReduction[entry.side].amount:0;
 const finish=()=>{delete state.dagobahAsteroidTarget;done();};
 const draw=()=>{state.dagobahAsteroidTarget=entry;(state.dagobahAsteroidsDrawn??=[]).push({card:entry.card,turn:state.game.timing.turn});drawDestinySeries(side,'asteroid',1,modifier,draws=>{
  const drawn=draws.length?PremiereBattle.total(draws):null,stats=craftStats(entry.card,entry.slot),defense=Number.isFinite(stats.armor)?stats.armor:stats.maneuver;
  dagoTargetTotal(side,entry.card,drawn,total=>{
  if(typeof jpRaycProtection==='function'&&jpEnabled()&&jpRaycProtection(entry.card)&&draws.some(draw=>!draw.cancelled&&DagobahRules.asteroid(draw.card))){finish();return;}
  if(draws.some(draw=>!draw.cancelled&&DagobahRules.asteroid(draw.card))||Number.isFinite(total)&&total>defense){const relay=entry.card.dagobahLostRelayTurn===state.game.timing.turn,forfeit=cardForfeitValueAt(entry.card,entry.side,entry.slot);loseTableCard(entry.side,entry.slot,entry.card);if(relay)dagoLoss(entry.side,forfeit??0,'Lost Relay',finish);else finish();}
  else finish();});
 });};
 withShipWeaponResponse({kind:'dagobahBeforeAsteroid',side,site:entry.slot,target:entry.card},draw);
}
const dagoLocationBase={isSite,isSystem,isSpaceSystem,sitePlanet,group:locationGroup};
isSite=function(card){return !DagobahRules.sector(card)&&dagoLocationBase.isSite(card);};
isSystem=function(card){return DagobahRules.sector(card)||dagoLocationBase.isSystem(card);};
isSpaceSystem=function(card){return DagobahRules.sector(card)||dagoLocationBase.isSpaceSystem(card);};
sitePlanet=function(card){return dagobahEnabled()&&(card?.hostInstanceId||/^executor:/.test(dagoTitle(card)))?null:dagoLocationBase.sitePlanet(card);};
locationGroup=function(card){return dagobahEnabled()&&DagobahRules.sector(card)?'asteroids:'+card.dagobahSystemSlot:dagobahEnabled()&&DagobahRules.cave(card)?'cave:'+card.dagobahBigSlot:dagoLocationBase.group(card);};
