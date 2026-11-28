'use strict';
function dagoSlugForCave(site){const loc=state.locations[site];return DagobahRules.cave(loc)?dagoUnits().find(entry=>entry.slot===loc.dagobahBigSlot&&['Light:2313','Dark:2312'].includes(entry.card.id)&&!entry.card.attachedParasite):null;}
function dagoCreatureHabitat(card,site){
 const loc=state.locations[site],title=dagoTitle(card);if(!loc)return false;
 if(title==='mynock')return true;
 if(title==='space slug')return DagobahRules.sector(loc)&&dagoTitle(loc)==='big one';
 if(title==='bog-wing')return isSite(loc)&&DagobahRules.dagobah(loc);
 if(title==='dragonsnake')return isSite(loc)&&(/swamp|jungle/.test(dagoTitle(loc))||dianogaHabitat(site));
 if(title==='vine snake')return isSite(loc)&&loc.locationTags?.includes('Planet')&&sitePlanet(loc)!=='hoth';
 return isSite(loc)&&loc.locationTags?.includes('Planet')&&!['hoth','tatooine'].includes(sitePlanet(loc))||dianogaHabitat(site);
}
function dagoCreaturePrey(entry){
 const title=dagoTitle(entry.card);
 if(entry.card.dagobahNoAttachTurn===state.game.timing.turn)return [];
 return dagoUnits().filter(target=>target.slot===entry.slot&&PremiereLocations.physicalPlace(target)===entry.slot&&!target.unavailable&&!target.card.imprisoned&&!target.card.concealed&&!target.card.attachedParasite&&
  (title==='space slug'||title==='mynock'?PremiereUnits.fighter(target.card):target.card.type==='Character'&&(title==='dragonsnake'||!isDroid(target.card))&&(title!=='bog-wing'||!movementPrevented(target.card))));
}
function dagoCreatureOptions(side){
 const options=[];
 for(const [index,entry] of dagoUnits().entries()){
  if(entry.side!==side||entry.unavailable||!['Light:2313','Dark:2312'].includes(entry.card.id)||PremiereGame.wasUsed(state.game,'turn',dagoUsed(entry.card,'mouth')))continue;
  options.push(dagoOption(entry.card,'slugMouth',[index],entry.card.dagobahMouthClosed?'Maul öffnen':'Maul schließen',{site:entry.slot,resolve(){entry.card.dagobahMouthClosed=!entry.card.dagobahMouthClosed;PremiereGame.useOnce(state.game,'turn',dagoUsed(entry.card,'mouth'));return true;}}));
 }
 return options;
}
function dagoAttachParasite(creature,target){
 const source=dagoEntry(creature);if(!source)return;detachTableCard(source.side,source.slot,creature);
 creature.attachedParasite=true;creature.dagobahParasiteHostId=target.card.instanceId;creature.dagobahSqueeze=0;(target.card.attachments??=[]).push(creature);
}
function dagoDetachParasite(creature,disable=false){
 const host=dagoParasiteHost(creature),entry=host&&dagoEntry(host);if(!entry)return false;
 host.attachments.splice(host.attachments.indexOf(creature),1);delete creature.attachedParasite;delete creature.dagobahParasiteHostId;
 if(disable)creature.dagobahNoAttachTurn=state.game.timing.turn;
 dagoOwn(creature.owner??creature.side).board[entry.slot].push(creature);return true;
}
function dagoCreatureContinuous(){
 const hosts=new Set();
 for(const entry of dagoUnits())if(entry.card.attachedParasite&&dagoTitle(entry.card)==='mynock')hosts.add(dagoParasiteHost(entry.card));
 for(const host of hosts){
  let entry=dagoEntry(host);if(!entry)continue;
  for(;;){const stats=craftStats(host,entry.slot),parasites=(host.attachments??[]).filter(card=>card.attachedParasite&&dagoTitle(card)==='mynock');if(!parasites.length||stats.power>=1||(stats.hyperspeed??0)>=1)break;dagoDetachParasite(parasites[Math.floor(PremiereGame.random(state.game)*parasites.length)],true);}
 }
 for(const entry of dagoUnits().slice())if(entry.card.set==='4'&&entry.card.type==='Creature'){
  const card=entry.card,host=dagoParasiteHost(card);
  if(!host&&!card.attachedParasite&&!dagoCreatureHabitat(card,entry.slot))loseTableCard(entry.side,entry.slot,card);
 }
 for(const [site,loc] of state.locations.entries())if(DagobahRules.cave(loc))loc.dagobahBelly=!!dagoSlugForCave(site);
}
function dagoCreatureTiming(event,tasks){
 if(event==='phase:start'&&state.phase===4)for(const entry of dagoUnits().filter(entry=>!entry.unavailable&&dagoText(entry.card)&&entry.card.attachedParasite&&dagoTitle(entry.card)==='vine snake'))tasks.push(done=>{
  const host=dagoParasiteHost(entry.card);if(!dagoEntry(host)){done();return;}
  drawDestinySeries(entry.card.owner??entry.side,'creatureSqueeze',1,0,draws=>{
   if(draws.length&&PremiereBattle.total(draws)>cardAbility(host))entry.card.dagobahSqueeze++;
   const hostEntry=dagoEntry(host);if(hostEntry&&(host.power??0)+cardPowerModifier(host,hostEntry.side,hostEntry.slot)<=0)hothEatCreaturePrey({creature:entry.card},host);
   done();
  });
 });
}
function dagoResolveCreature(drawAttackDestiny){
 const attack=state.creatureAttack,prey=attack.prey,creature=attack.creature,title=dagoTitle(creature);
 if(attack.attacking&&DagobahRules.parasite(creature)){
  if(title==='bog-wing'){
   const choices=[{args:['stay'],label:'Am selben Ort bleiben'},...state.locations.flatMap((loc,to)=>dagoSiteDistance(prey.slot,to)<=2&&to!==prey.slot&&dagoMoveAllowed(prey.side,prey.card,prey.slot,to,'relocate')?[{args:[to],label:loc.name}]:[])];
   dagoPrompt(PremiereGame.otherSide(prey.side),creature,'BogWing',choices,choice=>{state.pendingCardView=null;if(choice.args[0]!=='stay'){detachTableCard(prey.side,prey.slot,prey.card);dagoOwn(prey.side).board[choice.args[0]].push(prey.card);detachTableCard(attack.entry.side,attack.entry.slot,creature);dagoOwn(attack.entry.side).board[choice.args[0]].push(creature);}finishCreatureAttack();return true;});
  }else{if(creature.dagobahNoAttachTurn!==state.game.timing.turn)dagoAttachParasite(creature,prey);finishCreatureAttack();}
  return;
 }
 const config=DagobahRules.ferocity(creature),resolve=extra=>drawDestinySeries(attack.entry.side,'creatureFerocity',config.draws,0,draws=>{
  hothFerocity(creature,attack.entry.side,draws,ferocity=>{
   const power=attack.fighters.reduce((sum,card)=>sum+Math.max(0,creaturePower(card,attack.fighterSide,attack.entry.slot)),0)+extra;
   const won=attack.attacking?ferocity>power:power>ferocity+PremiereWeapons.defense(creature,0);
   const finish=()=>{if(!attack.attacking&&won||attack.hit)loseTableCard(attack.entry.side,attack.entry.slot,creature);finishCreatureAttack();};
   if(!attack.attacking||!won||!dagoEntry(prey.card)){finish();return;}
   let destinations=[];
   if(title==='dragonsnake'&&isDroid(prey.card))destinations=state.locations.flatMap((loc,to)=>adjacentSites(prey.slot,to)&&isExteriorPlanetSite(loc)?[to]:[]);
   if(title==='space slug'&&!movementPrevented(prey.card))destinations=state.locations.flatMap((loc,to)=>DagobahRules.cave(loc)&&loc.dagobahBigSlot===attack.entry.slot?[to]:[]);
   if(destinations.length){const choices=destinations.map(to=>({args:[to],label:state.locations[to].name}));if(title==='space slug')choices.push({args:['eat'],label:prey.card.name+' fressen'});
    dagoPrompt(PremiereGame.otherSide(prey.side),creature,'CreatureVictim',choices,choice=>{state.pendingCardView=null;if(choice.args[0]==='eat')hothEatCreaturePrey(attack,prey.card);else if(detachTableCard(prey.side,prey.slot,prey.card))dagoOwn(prey.side).board[choice.args[0]].push(prey.card);finish();return true;});
   }else{hothEatCreaturePrey(attack,prey.card);finish();}
  });
 });
 if(drawAttackDestiny)drawDestinySeries(attack.fighterSide,'attack',1,0,draws=>resolve(draws.length?PremiereBattle.total(draws):0));else resolve(0);
}
const dagoCreatureBase={habitat:creatureHabitat,prey:creaturePrey,actions:creatureActions,mandatory:offerMandatoryCreatureAttack,ferocity:hothFerocity,resolve:hothResolveCreaturePower,eat:hothEatCreaturePrey,clashes:hothCreatureClashes};
creatureHabitat=function(card,site){return dagobahEnabled()&&card.set==='4'?dagoCreatureHabitat(card,site):dagoCreatureBase.habitat(card,site);};
creaturePrey=function(entry){return dagobahEnabled()&&entry.card.set==='4'?dagoCreaturePrey(entry):dagoCreatureBase.prey(entry);};
creatureActions=function(side){return dagoCreatureBase.actions(side).filter(action=>!dagobahEnabled()||!action.card.attachedParasite);};
offerMandatoryCreatureAttack=function(next){
 if(!dagobahEnabled())return dagoCreatureBase.mandatory(next);
 const entry=dagoUnits().find(entry=>entry.side===state.activeSide&&!entry.unavailable&&entry.card.type==='Creature'&&!entry.card.attachedParasite&&!(state.creatureAttacksThisTurn??[]).includes(entry.card)&&creaturePrey(entry).length);
 if(!entry)return false;offerCreatureTargetSide(entry,next);return true;
};
hothFerocity=function(card,side,draws,next){if(!dagobahEnabled()||card.set!=='4')return dagoCreatureBase.ferocity(card,side,draws,next);const config=DagobahRules.ferocity(card),value=config.base+(PremiereBattle.total(draws)??0)+(card.hothFerocityBonus??0);const disarm=card.attachments?.find(card=>card.id==='Light:736');if(disarm)drawDestinySeries(disarm.owner??disarm.side,'disarm',1,0,draws=>next(Math.max(0,value-(PremiereBattle.total(draws)??0))));else next(Math.max(0,value));};
hothResolveCreaturePower=function(draw){return dagobahEnabled()&&state.creatureAttack.creature.set==='4'?dagoResolveCreature(draw):dagoCreatureBase.resolve(draw);};
const dagoCreatureFinishBefore=finishCreatureAttack;
finishCreatureAttack=function(){const attack=state.creatureAttack;if(dagobahEnabled()&&attack?.dagobahEatPending){attack.dagobahFinishRequested=true;return;}return dagoCreatureFinishBefore();};
hothEatCreaturePrey=function(attack,target){
 if(!dagobahEnabled())return dagoCreatureBase.eat(attack,target);
 const entry=dagoEntry(target);if(!entry)return;
 const eat=()=>{for(const parasite of (target.attachments??[]).filter(card=>card.attachedParasite).slice())dagoDetachParasite(parasite);dagoCreatureBase.eat(attack,target);};
 const frame={kind:'dagobahCreatureDefeat',side:attack.creature.owner??attack.creature.side,targetSide:entry.side,target,creature:attack.creature,site:entry.slot};
 if(target.type!=='Character'||!hasInterruptResponse(frame)){eat();return;}
 attack.dagobahEatPending=true;withShipWeaponResponse(frame,result=>{if(!result?.hurled&&dagoEntry(target))eat();delete attack.dagobahEatPending;if(attack.dagobahFinishRequested)finishCreatureAttack();});
};
const dagoCreatureChoiceBefore=finishCreatureChoice;
finishCreatureChoice=function(frame,...args){
 if(!dagobahEnabled()||frame.mode!=='creatureTargetSide')return dagoCreatureChoiceBefore(frame,...args);
 const choose=()=>{const pool=creaturePrey(frame.entry).filter(entry=>entry.side===args[0]);if(!pool.length){state.pendingCardView=null;frame.resume?.();return;}
  const target=pool[Math.floor(PremiereGame.random(state.game)*pool.length)],selected={kind:'dagobahCreatureSelected',side:frame.entry.side,site:frame.entry.slot,target:target.card,creature:frame.entry.card};state.pendingCardView=null;
  withShipWeaponResponse(selected,result=>{if(result?.retarget){choose();return;}withShipWeaponResponse({kind:'dagobahCreatureInitiated',side:frame.entry.side,site:frame.entry.slot,target:target.card,creature:frame.entry.card},initiated=>{if(initiated?.cancelled){(state.creatureAttacksThisTurn??=[]).push(frame.entry.card);frame.resume?.();return;}startCreatureFight(frame.entry,target.side,[target.card],target,frame.resume);});});
 };choose();return true;
};
hothCreatureClashes=function(){
 if(!dagobahEnabled())return dagoCreatureBase.clashes();
 if(state.pendingCardView||state.creatureAttack||state.creatureClashInProgress||battleSession||PremiereGame.responseWindow(state.game))return;
 const all=dagoUnits().filter(entry=>entry.card.type==='Creature'&&!entry.unavailable&&!entry.card.attachedParasite);
 const pairs=all.flatMap((entry,index)=>all.slice(index+1).filter(other=>other.slot===entry.slot&&dagoTitle(other.card)!==dagoTitle(entry.card)).map(other=>[entry,other]));if(!pairs.length)return;const pair=pairs[Math.floor(PremiereGame.random(state.game)*pairs.length)];
 const [a,b]=pair;state.creatureClashInProgress=true;
 drawDestinySeries(a.side,'creatureFerocity',a.card.set==='4'?DagobahRules.ferocity(a.card).draws:1,0,left=>hothFerocity(a.card,a.side,left,x=>drawDestinySeries(b.side,'creatureFerocity',b.card.set==='4'?DagobahRules.ferocity(b.card).draws:1,0,right=>hothFerocity(b.card,b.side,right,y=>{if(x<=y)loseTableCard(a.side,a.slot,a.card);if(y<=x)loseTableCard(b.side,b.slot,b.card);state.creatureClashInProgress=false;hothCreatureClashes();}))));
};
