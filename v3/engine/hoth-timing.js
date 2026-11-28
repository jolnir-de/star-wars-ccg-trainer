'use strict';

function hothDestinyTriggers(drawingSide,draw,next,purpose) {
 if(draw.cancelled||!Number.isFinite(draw.value)){next();return;}
 if(purpose==='battle'&&draw.card.id==='Light:815'&&battleSession){
  const key=drawingSide.toLowerCase(),parts=battlePowerBreakdown();
  if(!battleSession[key+'PowerDoubled']&&parts[drawingSide].power<parts[PremiereGame.otherSide(drawingSide)].power){battleSession[key+'PowerDoubled']=true;log('EG-4 als Battle Destiny: eigene Power einmal verdoppelt, bevor weitere Battle Destiny gezogen werden.');}
 }
 const tasks=[];
 for(const effect of hothEffects('Light:2481',PremiereGame.otherSide(drawingSide)))tasks.push(done=>{
  if(!hothEffects('Light:2481').some(item=>item.card===effect.card)){done();return;}
  const side=effect.card.owner??effect.card.side,own=PremiereGame.zones(state,side),value=draw.value;
  if(value===0&&own.used.length)own.hand.push(own.used.pop());
  if(value===1){hothForceLoss(side,1,'tauntaunBones',done);return;}
  if(value===2)activateReserve(side,1);
  if(value===3)hothCancelEffect(effect);
  if(value===4)PremiereGame.retrieveForce(state,side,1);
  if(value===5){
   const frame={mode:'hothBonesDeploy',side,card:effect.card,shown:own.hand.filter(card=>card.type==='Character'),resume:done};
   if(hothBonesChoices(frame).length>1){state.pendingCardView=frame;return;}
  }
  log('Tauntaun Bones reagiert auf gegnerische Destiny '+value+'.');done();
 });
 hothRunTasks(tasks,next);
}
function hothBonesChoices(frame) {
 const {hand}=PremiereGame.zones(state,frame.side),options=[];
 hand.forEach((card,index)=>{
  if(card.type!=='Character')return;
  state.locations.forEach((loc,site)=>{if(boardDeployCost(card,loc,frame.side,true)!==null)options.push({args:[index,site],card,label:card.name+' kostenlos bei '+loc.name+' deployen'});});
  PremiereLocations.entries(state,frame.side).forEach((entry,target)=>{
   if(entry.unavailable||!hothDeploymentAllowed(card,state.locations[entry.slot],frame.side)||!withinDeploymentLimit(card,frame.side))return;
   for(const role of PremiereUnits.roles(entry.card,card))options.push({args:[index,entry.slot,target,role],card,label:card.name+' kostenlos an Bord von '+entry.card.name+' · '+role});
  });
 });
 return options.concat({args:['done'],label:'Keinen Character deployen'});
}
function finishHothBones(frame,...args) {
 if(!hothBonesChoices(frame).some(option=>option.args.length===args.length&&option.args.every((arg,i)=>arg===args[i])))return false;
 state.pendingCardView=null;
 if(args[0]!=='done') {
  if(args.length===2)deployBoardCardFor(frame.side,args[0],args[1],{special:true,free:true});
  else {const host=PremiereLocations.entries(state,frame.side)[args[2]].card,[card]=PremiereGame.zones(state,frame.side).hand.splice(args[0],1);PremiereUnits.add(host,card,args[3],frame.side);openDeploymentReaction(frame.side,[card]);}
 }
 // Deployment responses must finish before the interrupted destiny sequence continues.
 if(PremiereGame.responseWindow(state.game))(state.hothDeferred??=[]).push(frame.resume);else frame.resume();
 return true;
}
function hothUtilityOptions(side) {
 const options=[],all=hothAllUnits();
 for(const [index,entry] of all.entries()) {
  if(entry.unavailable||PremiereUnits.textSuppressed(entry.card))continue;
  if(entry.card.id==='Dark:1925'&&(entry.card.owner??entry.card.side)===side){
   const key='hothFusion:'+entry.card.instanceId;
   const enhancement=state.hothFusionPower?.find(record=>record.device===entry.card);
   if(enhancement)options.push({utility:true,mode:'fusionOff',args:['fusionOff',index],card:entry.card,label:entry.card.name+' · Droid-Verstärkung abschalten'});
   if(!enhancement)for(const [target,other] of all.entries())if(!other.unavailable&&isDroid(other.card)&&PremiereLocations.presentAt(other,PremiereLocations.physicalPlace(entry)))
    options.push({utility:true,mode:'fusionDroid',args:['fusionDroid',index,target],card:entry.card,target:other.card,key,label:entry.card.name+' · '+other.card.name+' Power +1'});
  }
 }
 if(state.activeSide===side&&state.phase===4&&!battleSession)for(const [slot,weapons] of Object.entries(state.locationWeapons??{}))for(const [index,card] of weapons.entries()) {
  if(!['Light:1664','Dark:894'].includes(card.id)||(card.owner??card.side)!==side||PremiereUnits.textSuppressed(card))continue;
  const from=Number(slot),warriors=PremiereLocations.entries(state,side).filter(entry=>PremiereLocations.presentAt(entry,from)&&!entry.unavailable&&PremiereUnits.hasSkill(entry.card,'warrior')&&!regularMovementUsed(entry.card));
  for(let a=0;a<warriors.length;a++)for(let b=a+1;b<warriors.length;b++)state.locations.forEach((loc,to)=>{
   if(!isSite(loc)||sitePlanet(loc)!==sitePlanet(state.locations[from]))return;
   const moves=[warriors[a],warriors[b]].map(entry=>travelOptions(entry.card,side,from,to).find(move=>move.kind==='Landspeed'));
   if(moves.some(move=>!move))return;const cost=1+moves.reduce((sum,move)=>sum+move.cost,0);
   if(cost<=forceBudget(side))options.push({utility:true,mode:'moveArtillery',args:['moveArtillery',from,index,a,b,to],card,from,to,cost,warriors:[warriors[a],warriors[b]],label:card.name+' mit zwei Warriors → '+loc.name+' ('+cost+' Force)'});
  });
 }
 return options;
}
function playHothUtility(side,option) {
 if(option.mode==='fusionDroid'){(state.hothFusionPower??=[]).push({device:option.card,target:option.target});return true;}
 if(option.mode==='fusionOff'){state.hothFusionPower=state.hothFusionPower.filter(record=>record.device!==option.card);return true;}
 if(option.mode==='moveArtillery'){
  spendForce(side,option.cost);
  for(const entry of option.warriors){detachTableCard(side,entry.slot,entry.card);PremiereGame.zones(state,side).board[option.to].push(entry.card);(state.movedThisTurn??=[]).push(entry.card);noteMineTraversal(side,entry.slot,option.to,entry.card);hothMoved(side,entry.card,entry.slot,option.to);}
  const source=state.locationWeapons[option.from];source.splice(source.indexOf(option.card),1);(state.locationWeapons[option.to]??=[]).push(option.card);return true;
 }
 return false;
}

function hothPromptChoice(offers,frame) {
 const pick=args=>offers.find(offer=>offer.args.every((arg,i)=>arg===args[i]));
 if(frame.mode==='hothSearch')return offers.find(offer=>offer.args[0]==='toggle'&&!frame.selected.includes(offer.args[1]))??pick(['search'])??pick(['cancel']);
 if(frame.mode==='hothInterruptTargets')return frame.selected.length<3?offers.find(offer=>offer.args[0]==='toggle'&&!frame.selected.includes(offer.args[1]))??pick(['play']):pick(['play']);
 if(['hothPeek','hothInterruptPerimeter'].includes(frame.mode))return frame.mode==='hothInterruptPerimeter'?offers.find(offer=>offer.card&&(isDroid(offer.card)&&isSpyCharacter(offer.card)||hothMineKind(offer.card)==='infantry'))??pick(['done']):pick(['done']);
 if(frame.mode==='hothWampaVictim')return pick(['eat']);
 if(frame.mode==='hothMineTarget')return offers.slice().sort((a,b)=>{
  const value=card=>((card?.owner??card?.side)===frame.side?-1:1)*(2+(card?.power??0)+(card?.ability??0));return value(b.card)-value(a.card);
 })[0];
 if(['hothInterruptSelect','hothBonesDeploy','hothInterruptWeather'].includes(frame.mode))return offers.filter(offer=>offer.card).sort((a,b)=>(b.card.power??0)+(b.card.ability??0)-(a.card.power??0)-(a.card.ability??0))[0]??pick(['done']);
 return null;
}
function hothBotValue(offer,view) {
 const {side,rival}=view,mode=offer.mode??offer.ability,cost=offer.cost??0,entry=offer.entry,target=offer.target??offer.host??entry?.card;
 const enemy=entry?.side===rival||(target?.controller??target?.owner??target?.side)===rival;
 if(offer.responseKind==='hothAbility')return ['rescue','bacta','cancelWindow'].includes(offer.ability)?3:['shawnMove'].includes(offer.ability)?2:0;
 if(offer.responseKind==='hothEffect')return 1.5;
 if(mode==='search')return 1;
 if(['rugDestiny','rugPower','reduceBattle','delta','failedLeader','fallBack','returnDeployed','cancelRescue','cancelParent','weaponBonus','tractorBonus'].includes(mode))return 3;
 if(['coldFeet','stopMotion','trample','walkerBarrage','crashLanding','saberDeficiency','underAttack','loseMissing'].includes(mode))return enemy?3:-5;
 if(mode==='exposure')return offer.targets.reduce((sum,entry)=>sum+(entry.side===side?-1:1)*(2+(entry.card.power??0))*(HothRules.protectedFromWeather(entry.card,state.game.timing.turn)?0:1),0)-cost;
 if(mode==='effect'){
  if(['Dark:2772','Dark:1673','Dark:2572'].includes(offer.card?.id))return enemy?2:-5;
  if(offer.card?.id==='Light:736')return enemy?2:-5;
  return 1.2;
 }
 if(mode==='fusionDroid')return enemy?-5:2;
 if(['trooperSearch','walkerSites','relatedSystem','unitPeek','fusionDroid','telemetryDiscount','targetGenerator','artilleryDeploy','bacta','rebuild','raiseHoth','raiseAllHoth','exhaustion','perimeterHand'].includes(mode))return 2;
 if(['artilleryFire','lennoxTractor'].includes(mode))return 3;
 if(mode==='supply')return view.force<4&&view.life>6?0.3:-1;
 if(mode==='yaggle')return enemy?2:-5;
 if(mode==='wallFire')return 1;
 if(mode==='doubleCharacter')return entry.side===side?1:-3;
 if(mode==='missingToUsed')return 1;
 if(mode==='telemetryLost')return offer.pileSide===rival?1:-1;
 if(mode==='selfDestruct')return battleSession&&battleTotals(battleSession.site)[rival.toLowerCase()+'Ability']>=4&&battleSession.hitUnits?.[side]?.includes(target)?2:-2;
 return 0;
}

function hothActionDevice(action) {
 let device=action.device??action.shot?.device,host=action.deviceHost??action.shot?.deviceHost;
 const card=action.card;
 if(!device&&card?.type==='Device'&&!['deployDevice','deployBolt','finishCardInformation','loseForce','battleForceLoss'].includes(action.kind)&&!PremiereGame.zones(state,action.side).hand.includes(card))device=card;
 if(device&&!host)host=hothAllUnits().find(entry=>entry.card.attachments?.includes(device))?.card;
 return device&&host?{device,host}:null;
}
function hothSensorSource(side,site,adjacent=false) {
 for(const entry of hothAllUnits()){
  if(entry.unavailable||PremiereUnits.textSuppressed(entry.card)||!(entry.slot===site||adjacent&&adjacentSites(entry.slot,site)))continue;
  const device=entry.card.attachments?.find(card=>card.id==='Light:1990'&&(card.owner??card.side)===side&&!PremiereUnits.textSuppressed(card)&&PremiereUnits.canUseDevice(state,entry.card,card));
  if(device)return {device,host:entry.card};
 }
 return null;
}
function hothCompleteMovement(before) {
 for(const entry of hothAllUnits()){
  const previous=before?.get(entry.card);
  if(previous?.carriers[0]&&previous.carriers[0]===entry.carriers[0])continue;
  if(previous&&(previous.slot!==entry.slot||previous.carriers.length!==entry.carriers.length||previous.carriers.some((card,i)=>card!==entry.carriers[i])))delete entry.card.hothDoublePower;
  if(!previous||entry.unavailable||previous.slot===entry.slot||!['Character','Starship','Vehicle'].includes(entry.card.type))continue;
  if(!(state.ruleResponses??[]).some(event=>event.kind==='hothMoved'&&event.card===entry.card&&event.from===previous.slot&&event.site===entry.slot))hothMoved(entry.side,entry.card,previous.slot,entry.slot);
 }
}
function hothCalFree(side,card,from,to){
 if(card?.type!=='Vehicle'||from===to)return false;
 const origin=state.locations[from],destination=state.locations[to],planet=sitePlanet(origin)??locationGroup(origin);
 if(!planet||planet!==(sitePlanet(destination)??locationGroup(destination)))return false;
 const order=boardLocationOrder(),a=order.indexOf(from),b=order.indexOf(to);
 return PremiereLocations.entries(state,side).some(entry=>!entry.unavailable&&entry.card.id==='Light:345'&&!PremiereUnits.textSuppressed(entry.card)&&
  sitePlanet(state.locations[entry.slot])===planet&&Math.sign(b-a)===Math.sign(order.indexOf(entry.slot)-a)&&a!==order.indexOf(entry.slot));
}
