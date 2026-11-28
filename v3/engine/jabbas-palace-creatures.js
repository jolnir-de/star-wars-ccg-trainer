'use strict';
const jpCreatureBase={habitat:creatureHabitat,prey:creaturePrey,ferocity:hothFerocity,resolve:hothResolveCreaturePower,actions:creatureActions,clash:hothCreatureClashes,eat:hothEatCreaturePrey,deploy:boardDeployCost};
const jpCreaturePeace=slot=>jpUnits().some(e=>e.slot===slot&&!e.unavailable&&['Light:2087','Dark:1633'].includes(e.card.id)&&jpLive(e.card));
creatureHabitat=function(card,slot){if(!jpEnabled()||card.set!=='6')return jpCreatureBase.habitat(card,slot);const loc=state.locations[slot];return card.id==='Dark:2021'?jpTitle(loc)==="jabba's palace: rancor pit"||isExteriorPlanetSite(loc):isSite(loc)&&loc.locationTags?.includes('Planet')&&sitePlanet(loc)!=='hoth';};
boardDeployCost=function(card,loc,side,...args){if(jpEnabled()&&(card.id==='Dark:1362'&&sitePlanet(loc)!=='tatooine'||card.id==='Dark:2021'&&jpTitle(loc)!=="jabba's palace: rancor pit"&&!(jpAt(side,state.locations.indexOf(loc),'Dark:1633')&&jpUnits().filter(e=>e.slot===state.locations.indexOf(loc)&&!e.unavailable&&e.card.type==='Character').length===1)))return null;return jpCreatureBase.deploy(card,loc,side,...args);};
creaturePrey=function(entry){
 if(!jpEnabled())return jpCreatureBase.prey(entry);if(jpCreaturePeace(entry.slot))return [];
 const selective=entry.card.cardIcons?.includes('Selective Creature');
 if(selective&&jpUnits().some(e=>e.slot===entry.slot&&!e.unavailable&&e.card.id==='Light:1339'&&jpLive(e.card)))return [];
 return jpCreatureBase.prey(entry).filter(e=>!e.card.frozen&&(!['Light:2829','Dark:339'].includes(entry.card.id)||e.card.type!=='Character'||e.side!==entry.side));
};
creatureActions=function(side){return jpCreatureBase.actions(side).filter(a=>!jpEnabled()||!jpCreaturePeace(a.entry.slot));};
hothFerocity=function(card,side,draws,done){if(!jpEnabled()||card.set!=='6')return jpCreatureBase.ferocity(card,side,draws,done);const base=card.id==='Dark:2021'?8:card.id==='Dark:339'?4:3;const value=base+(card.id==='Dark:2021'?(PremiereBattle.total(draws)??0):0)+(card.hothFerocityBonus??0);const disarm=card.attachments?.find(c=>c.id==='Light:736'&&jpLive(c));if(disarm)drawDestinySeries(ccOwner(disarm),'disarm',1,0,d=>done(Math.max(0,value-(PremiereBattle.total(d)??0))));else done(value);};
hothResolveCreaturePower=function(addDestiny){
 const a=state.creatureAttack;if(!jpEnabled()||a.creature.set!=='6')return jpCreatureBase.resolve(addDestiny);
 const resolve=extra=>drawDestinySeries(a.entry.side,'creatureFerocity',a.creature.id==='Dark:2021'?1:0,0,draws=>hothFerocity(a.creature,a.entry.side,draws,ferocity=>{
  const power=a.fighters.reduce((n,c)=>n+creaturePower(c,a.fighterSide,a.entry.slot),0)+extra,win=a.attacking?ferocity>power:power>ferocity+PremiereWeapons.defense(a.creature,0);
  const finish=()=>{if(!a.attacking&&win||a.hit)jpRemove(a.creature);finishCreatureAttack();};
  if(a.attacking&&win&&jpEntry(a.prey.card)){hothEatCreaturePrey(a,a.prey.card);if(a.dagobahEatPending){a.dagobahFinishRequested=true;return;}}finish();
 }));
 if(addDestiny)drawDestinySeries(a.fighterSide,'attack',1,0,d=>resolve(PremiereBattle.total(d)??0));else resolve(0);
};
hothCreatureClashes=function(){
 if(!jpEnabled())return jpCreatureBase.clash();if(state.pendingCardView||state.creatureAttack||state.creatureClashInProgress||battleSession||PremiereGame.responseWindow(state.game))return;
 const all=jpUnits().filter(e=>e.card.type==='Creature'&&!e.unavailable&&!e.card.attachedParasite&&!jpCreaturePeace(e.slot));
 const pairs=all.flatMap((e,i)=>all.slice(i+1).filter(b=>b.slot===e.slot&&(jpTitle(b.card)!==jpTitle(e.card)||!b.card.cardIcons?.includes('Selective Creature')||!e.card.cardIcons?.includes('Selective Creature'))).map(b=>[e,b]));if(!pairs.length)return;
 const [a,b]=pairs[Math.floor(PremiereGame.random(state.game)*pairs.length)];state.creatureClashInProgress=true;
 const draws=c=>c.set==='6'?c.id==='Dark:2021'?1:0:c.set==='4'?DagobahRules.ferocity(c).draws:1;
 drawDestinySeries(a.side,'creatureFerocity',draws(a.card),0,x=>hothFerocity(a.card,a.side,x,left=>drawDestinySeries(b.side,'creatureFerocity',draws(b.card),0,y=>hothFerocity(b.card,b.side,y,right=>{if(left<=right)jpRemove(a.card);if(right<=left)jpRemove(b.card);state.creatureClashInProgress=false;hothCreatureClashes();}))));
};
hothEatCreaturePrey=function(attack,target){const e=jpEntry(target),reward=jpEnabled()&&target.type==='Character'&&e?.side===jpSource(e?.slot,'Light')&&state.locations[e.slot]?.id==='Dark:1360'?cardForfeitValueAt(target,e.side,e.slot):0;const result=jpCreatureBase.eat(attack,target);if(reward&&!jpEntry(target))PremiereGame.retrieveForce(state,PremiereGame.otherSide(e.side),reward);return result;};
ccTiming.push(event=>{
 if(!jpEnabled()||event!=='phase:start'||state.phase!==4)return [];const tasks=[];
 for(const e of jpAll(state.activeSide,'Dark:2021')){const others=jpAll(null,'Dark:2021').filter(x=>x.card!==e.card&&sitePlanet(state.locations[x.slot])===sitePlanet(state.locations[e.slot]));if(!others.length)continue;
  const order=boardLocationOrder(),distance=slot=>Math.min(...others.map(x=>Math.abs(order.indexOf(x.slot)-order.indexOf(slot)))),destinations=state.locations.flatMap((loc,to)=>adjacentSites(e.slot,to)&&distance(to)<distance(e.slot)&&creatureHabitat(e.card,to)&&hothMovementAllowed(e.side,e.card,e.slot,to,'Landspeed')?[to]:[]);
  if(destinations.length)tasks.push(done=>jpChoose(e.side,e.card,'RancorMove',destinations.map(to=>({args:[to],to,label:'Rancor → '+state.locations[to].name})),choice=>{jpRelocate(e.card,choice.to);done();}));
 }return tasks;
});
