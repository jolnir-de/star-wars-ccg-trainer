'use strict';

function hothFerocity(card,side,draws,complete) {
 const drawn=draws.length?PremiereBattle.total(draws):null;
 const base=(card.id==='Dark:2737'?3:card.lastMealPower??0)+(card.hothFerocityBonus??0);
 const value=drawn===null?base:base+drawn;
 const disarm=card.attachments?.find(effect=>effect.id==='Light:736'&&!PremiereUnits.textSuppressed(effect));
 if(!disarm){complete(Math.max(0,value));return;}
 drawDestinySeries(disarm.owner??disarm.side,'disarm',1,0,draws=>complete(Math.max(0,value-(draws.length?PremiereBattle.total(draws)??0:0))));
}
function hothEatCreaturePrey(attack,target) {
 const entry=PremiereLocations.findEntry(state,target);if(!entry)return;
 if(target.attachments?.some(effect=>effect.id==='Dark:990'&&!PremiereUnits.textSuppressed(effect)))attack.creature.hothFerocityBonus=(attack.creature.hothFerocityBonus??0)+2;
 if(attack.creature.id!=='Dark:2737')attack.creature.lastMealPower=Math.max(0,creaturePower(target,entry.side,entry.slot));
 loseTableCard(entry.side,entry.slot,target);log(attack.creature.name+' frisst '+target.name+'.');
}
function hothWampaDestination(attack) {
 const target=attack.prey?.card,entry=target&&PremiereLocations.findEntry(state,target);
 if(!entry||target.type!=='Character'||target.captured||movementPrevented(target))return -1;
 const slot=state.locations.findIndex(loc=>HothRules.marker(loc)===7);
 return slot>=0&&slot!==entry.slot&&hothMovementAllowed(entry.side,target,entry.slot,slot,'creatureRelocation')?slot:-1;
}
function hothResolveCreaturePower(drawAttackDestiny) {
 const attack=state.creatureAttack;if(!attack)return;
 const resolve=extra=>drawDestinySeries(attack.entry.side,'creatureFerocity',1,0,draws=>hothFerocity(attack.creature,attack.entry.side,draws,ferocity=>{
  const defense=PremiereWeapons.defense(attack.creature,0),power=attack.fighters.reduce((sum,card)=>sum+Math.max(0,creaturePower(card,attack.fighterSide,attack.entry.slot)),0)+extra;
  const won=attack.attacking?ferocity>power:power>ferocity+defense;
  log('Creature-Angriff · Ferocity '+ferocity+(attack.attacking?'':' + Abwehr '+defense)+' / Power '+power+'.');
  const finish=()=>{
   if((!attack.attacking&&won)||attack.hit)loseTableCard(attack.entry.side,attack.entry.slot,attack.creature);
   finishCreatureAttack();
  };
  if(attack.attacking&&won&&PremiereLocations.findEntry(state,attack.prey.card)) {
   if(attack.creature.id==='Dark:2737'&&hothWampaDestination(attack)>=0) {
    state.pendingCardView={mode:'hothWampaVictim',side:PremiereGame.otherSide((state.game?.cardRulesVersion??0)>=32?attack.prey.side:attack.entry.side),card:attack.creature,shown:[attack.prey.card],publicView:true,finish};return;
   }
   hothEatCreaturePrey(attack,attack.prey.card);
  }
  finish();
 }));
 if(drawAttackDestiny)drawDestinySeries(attack.fighterSide,'attack',1,0,draws=>resolve(draws[0]?.value??0));else resolve(0);
}
function hothWampaChoices(frame) {
 const choices=[{args:['eat'],label:frame.shown[0].name+' wird gefressen'}];
 const slot=hothWampaDestination(state.creatureAttack);
 if(slot>=0)choices.push({args:['relocate'],label:frame.shown[0].name+' nach Wampa Cave versetzen'});
 return choices;
}
function finishHothWampaChoice(frame,...args) {
 if(!hothWampaChoices(frame).some(option=>option.args.length===args.length&&option.args.every((arg,i)=>arg===args[i])))return false;
 const attack=state.creatureAttack;
 state.pendingCardView=null;
 if(args[0]==='eat')hothEatCreaturePrey(attack,attack.prey.card);
 else {
  const entry=PremiereLocations.findEntry(state,attack.prey.card),to=hothWampaDestination(attack);
  if(entry&&to>=0&&detachTableCard(entry.side,entry.slot,entry.card)) {
   PremiereGame.zones(state,entry.side).board[to].push(entry.card);
   hothMoved(entry.side,entry.card,entry.slot,to);log(entry.card.name+' wird nach Wampa Cave versetzt.');
  }else hothEatCreaturePrey(attack,attack.prey.card);
 }
 frame.finish();return true;
}
function hothCreatureClashes() {
 if(state.pendingCardView||state.creatureAttack||state.creatureClashInProgress||battleSession||PremiereGame.responseWindow(state.game))return;
 let entries=PremiereGame.sides.flatMap(side=>PremiereLocations.entries(state,side)).filter(entry=>entry.card.type==='Creature'&&!entry.unavailable);
 for(const entry of entries)if(!creatureHabitat(entry.card,entry.slot))loseTableCard(entry.side,entry.slot,entry.card);
 entries=entries.filter(entry=>PremiereLocations.findEntry(state,entry.card));
 const group=entries.find(entry=>entries.some(other=>other!==entry&&other.slot===entry.slot));if(!group)return;
 const pool=entries.filter(entry=>entry.slot===group.slot),a=pool.splice(Math.floor(PremiereGame.random(state.game)*pool.length),1)[0],b=pool[Math.floor(PremiereGame.random(state.game)*pool.length)];
 state.creatureClashInProgress=true;
 drawDestinySeries(a.side,'creatureFerocity',1,0,left=>hothFerocity(a.card,a.side,left,x=>
  drawDestinySeries(b.side,'creatureFerocity',1,0,right=>hothFerocity(b.card,b.side,right,y=>{
   if(x<=y)loseTableCard(a.side,a.slot,a.card);if(y<=x)loseTableCard(b.side,b.slot,b.card);
   if(x>y&&a.card.id!=='Dark:2737')a.card.lastMealPower=y;if(y>x&&b.card.id!=='Dark:2737')b.card.lastMealPower=x;
   state.creatureClashInProgress=false;hothCreatureClashes();
  }))));
}
