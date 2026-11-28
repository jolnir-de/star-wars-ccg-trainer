'use strict';

function hothMineKind(card) {
 return ['Light:1307','Dark:1306'].includes(card?.id)?'infantry':['Light:2710','Dark:2709'].includes(card?.id)?'vehicle':null;
}
function hothMineTraffic() {
 return new Map(hothAllUnits().filter(entry=>['Character','Vehicle','Starship'].includes(entry.card.type)).map(entry=>[entry.card,{slot:entry.slot,place:PremiereLocations.physicalPlace(entry),carriers:entry.carriers.slice()}]));
}
function hothMineTarget(kind,entry,deployed=false) {
 if(kind==='vehicle')return PremiereUnits.fighter(entry.card)||entry.card.type==='Vehicle'&&!HothRules.creatureVehicle(entry.card);
 return entry.card.type==='Character'&&(deployed||!entry.carriers.some(card=>['Starship','Vehicle'].includes(card.type)));
}
function hothMineArrivals(before) {
 if(!before)return;
 const arrivals=new Map(),all=hothAllUnits();
 for(const entry of all) {
  const previous=before.get(entry.card);
  if(['Character','Vehicle','Starship'].includes(entry.card.type)&&(!previous||previous.slot!==entry.slot||previous.place!==undefined&&previous.place!==PremiereLocations.physicalPlace(entry))&&PremiereLocations.physicalPlace(entry)===entry.slot)
   arrivals.set(entry.card,{...entry,deployed:!previous});
 }
 const crossings=state.hothMineTraversals??[];delete state.hothMineTraversals;
 const mines=all.filter(entry=>hothMineKind(entry.card)&&!entry.card.hothMineResolving);
 for(const mine of mines) {
  const kind=hothMineKind(mine.card),targets=[...arrivals.values()].filter(entry=>entry.slot===mine.slot&&hothMineTarget(kind,entry,entry.deployed));
  for(const crossing of crossings)if(crossing.slots.includes(mine.slot)) {
   const cards=[crossing.card,...(crossing.card.escortedCaptive?[crossing.card.escortedCaptive]:[])];
   for(const card of cards) {
    const entry=PremiereLocations.findEntry(state,card);
    if(entry&&hothMineTarget(kind,entry)&&!targets.some(target=>target.card===card))targets.push({...entry,crossing:true});
   }
  }
  if(targets.length&&!state.hothMineQueue?.some(record=>record.card===mine.card)) {
   mine.card.hothMineResolving=true;
   (state.hothMineQueue??=[]).push({card:mine.card,slot:mine.slot,side:mine.card.controller??mine.card.owner??mine.side,targets,kind});
  }
 }
}
function hothNextMine() {
 if(state.pendingCardView||state.pendingForceLoss||state.pendingCustody?.length||state.hothResolvingMine)return;
 while(state.hothMineQueue?.length) {
  const record=state.hothMineQueue.shift();
  if(!PremiereLocations.findEntry(state,record.card))continue;
  record.targets=record.targets.filter(target=>PremiereLocations.findEntry(state,target.card));
  if(!record.targets.length){delete record.card.hothMineResolving;continue;}
  state.hothResolvingMine=record;
  if(record.targets.length>1)state.pendingCardView={mode:'hothMineTarget',side:record.side,card:record.card,record,shown:record.targets.map(entry=>entry.card),publicView:true};
  else hothExplodeMine(record,record.targets[0]);
  return;
 }
}
function hothMineChoices(frame) {
 return frame.record.targets.flatMap((entry,index)=>PremiereLocations.findEntry(state,entry.card)?[{args:['target',index],card:entry.card,label:entry.card.name+' von der Mine angreifen lassen'}]:[]);
}
function finishHothMineChoice(frame,...args) {
 if(!hothMineChoices(frame).some(option=>option.args.length===args.length&&option.args.every((arg,i)=>arg===args[i])))return false;
 state.pendingCardView=null;hothExplodeMine(frame.record,frame.record.targets[args[1]]);return true;
}
function hothExplodeMine(record,target) {
 const {card,side,slot,kind}=record,shot={host:card,weapon:card,from:slot};
 drawDestinySeries(side,'weapon',1,weaponDestinyModifier(side,shot),draws=>{
  const value=draws.length?PremiereBattle.total(draws):null,entry=PremiereLocations.findEntry(state,target.card);
  const defense=kind==='infantry'?cardAbility(target.card):PremiereUnits.fighter(target.card)?5:entry?PremiereWeapons.defense(target.card,cardAbility(target.card),craftStats(target.card,entry.slot)):null;
  const total=value===null?null:value+2+holocamDestiny(side,slot);
  if(entry&&Number.isFinite(total)&&Number.isFinite(defense)&&total>defense)loseTableCard(entry.side,entry.slot,entry.card);
  const mine=PremiereLocations.findEntry(state,card);if(mine)loseTableCard(mine.side,mine.slot,card);
  delete card.hothMineResolving;
  state.hothResolvingMine=null;
  log(card.name+' explodiert · '+target.card.name+' · Destiny '+(value??'fehlgeschlagen')+' +2 gegen '+(defense??'keinen Wert')+'.');
  hothNextMine();
 });
}
function hothSettleBuriedMine(record,defused) {
 const {card,side,slot}=record;
 if(defused){loseOwnedCard(card,side);return;}
 card.controller=side;card.tableSide=PremiereGame.otherSide(side);
 PremiereGame.zones(state,side).board[slot].push(card);
 const kind=hothMineKind(card),targets=[];
 for(const arriving of record.arriving??(record.crossing?[{card:record.crossing}]:[])) {
  for(const unit of [arriving.card,...(arriving.card.escortedCaptive?[arriving.card.escortedCaptive]:[])]) {
   const entry=PremiereLocations.findEntry(state,unit);
   if(entry&&hothMineTarget(kind,entry,arriving.deployed)&&PremiereLocations.physicalPlace(entry)===entry.slot&&!targets.some(target=>target.card===unit))targets.push({...entry,crossing:!!record.crossing});
  }
 }
 if(targets.length){card.hothMineResolving=true;(state.hothMineQueue??=[]).push({card,side,slot,kind,targets});hothNextMine();}
}
