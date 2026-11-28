'use strict';
const jpAlienWarrior=host=>host?.subType==='Alien'&&PremiereUnits.hasSkill(host,'warrior');
PremiereWeapons.registerExpansion([
 ...['Light:1699','Dark:1698'].map(id=>[id,{deploy:host=>jpAlienWarrior(host)?sitePlanet(state.locations[jpEntry(host)?.slot])==='tatooine'?0:1:null,cost:0,bonus:2,effect:'jpForfeit',targets:['Character'],onlyPrintedTargets:true}]),
 ...['Light:2714','Dark:2713'].map(id=>[id,{deploy:host=>jpAlienWarrior(host)?3:null,cost:1,effect:'jpVibro',targets:['Character'],onlyPrintedTargets:true}]),
 ['Dark:705',{deploy:host=>ccPersona(host,'Dengar')?2:PremiereUnits.bountyHunter(host)?5:null,cost:3,bonus:3,effect:'capture',targets:['Character'],onlyPrintedTargets:true}],
 ['Dark:119',{deploy:host=>host?.type==='Vehicle'&&host.subType==='Transport'?3:null,cost:3,bonus:2,targets:['Character','Creature'],repeats:true,onlyPrintedTargets:true}],
 ['Dark:764',{deploy:host=>host?.id==='Dark:1362'||PremiereUnits.crawler(host)?4:null,cost:2,bonus:2,targets:['Vehicle'],onlyPrintedTargets:true}],
 ['Dark:1008',{deploy:host=>jpSpecies(host,'gamorrean')?1:null,cost:0,targets:['Character','Creature'],onlyPrintedTargets:true}],
 ['Dark:2556',{deploy:host=>PremiereUnits.bountyHunter(host)?3:null,cost:null,targets:[]}]
]);
const jpWeaponBase={shot:weaponShot,apply:applyWeaponResult,power:cardPowerModifier,shoot:shootWeapon,defense:PremiereWeapons.defense,draws:battleDestinyDrawCount};
weaponShot=function(weapon,host,target,defense){
 if(jpEnabled()&&weapon.set==='6'){
  if(weapon.id==='Dark:705'&&isDroid(target))return null;
  if(['Dark:119','Dark:764'].includes(weapon.id)&&!host.occupants?.some(e=>PremiereUnits.active(e.card)&&PremiereUnits.hasSkill(e.card,'warrior')))return null;
 }
 const shot=jpWeaponBase.shot(weapon,host,target,defense);if(shot&&jpEnabled()&&shot.effect==='capture'&&ccOwner(host)!=='Dark')return null;if(shot&&jpEnabled()&&weapon.id==='Dark:119'&&battleSession?.usedWeapons?.includes(weapon))shot.cost=2;return shot;
};
applyWeaponResult=function(shot,side,slot,...args){if(jpEnabled()&&shot.effect==='jpForfeit'){shot.target.jpForfeitTurn=state.game.timing.turn;shot.target.jpForfeitBonus=(shot.target.jpForfeitBonus??0)-2;return true;}return jpWeaponBase.apply(shot,side,slot,...args);};
cardPowerModifier=function(card,...args){let value=jpWeaponBase.power(card,...args);if(jpEnabled())value+=(card.weapons??[]).filter(w=>jpLive(w)&&['Light:2714','Dark:2713','Dark:1008'].includes(w.id)).length;return value;};
PremiereWeapons.defense=function(card,...args){if(jpEnabled()&&card.set==='6'&&card.type==='Creature')return card.id==='Dark:2021'?5:card.id==='Dark:339'?5:4;return jpWeaponBase.defense(card,...args);};
battleDestinyDrawCount=function(side,slot,...args){const count=jpWeaponBase.draws(side,slot,...args);if(count||!jpEnabled())return count;return ccPresent(side,slot).some(c=>c.weapons?.some(w=>w.id==='Dark:1008'&&jpLive(w)))?1:0;};
shootWeapon=function(side,shot,complete){
 if(!jpEnabled()||shot.effect!=='jpVibro')return jpWeaponBase.shoot(side,shot,complete);
 spendForce(side,shot.cost);markWeaponFired(shot);const enemy=PremiereGame.otherSide(side),slot=shot.targetSlot??battleSession?.site;
 withShipWeaponResponse({kind:'weaponTarget',side,shot,site:slot},frame=>{if(frame?.cancelled){complete();return;}
  drawDestinySeries(side,'weapon',1,weaponDestinyModifier(side,shot),a=>drawDestinySeries(enemy,'weapon',1,0,b=>{
   const total=a.length?PremiereBattle.total(a)+creaturePower(shot.host,side,slot):null,defense=b.length?PremiereBattle.total(b)+creaturePower(shot.target,enemy,slot):null,hit=total!==null&&defense!==null&&total>defense;
   if(battleSession)recordBattleShot(battleSession,side,shot,total,defense,hit);
   if(hit&&battleSession){(battleSession.excludedUnits??=new Set()).add(shot.target);refreshBattleParticipants();}complete();
  }));
 });
};
function jpAreaLoss(site,numbers,source,next){
 const entries=jpUnits().filter(e=>e.slot===site&&!e.card.imprisoned&&['Character','Vehicle','Starship','Weapon','Device'].includes(e.card.type)),values=new Map();
 const record=state.jpAreaAction={site,numbers,source};
 const multiple=entries.filter(e=>e.card.destinyValues?.length>1);
 const assign=()=>{const entry=multiple.shift();if(!entry){prepare();return;}const choices=entry.card.destinyValues;
  jpChoose(ccOwner(entry.card),source??entry.card,'AreaDestiny',choices.map(value=>({args:[value],label:entry.card.name+' · Destiny '+value})),choice=>{values.set(entry.card,choice.args[0]);assign();},{botChoice:offers=>offers.find(o=>!numbers.includes(o.args[0]))??offers[0]});
 };
 let targets=[];const prepare=()=>{
  targets=entries.filter(e=>numbers.includes(values.get(e.card)??PremiereBattle.printedDestiny(e.card))).sort((a,b)=>Number(!!b.card.captured)-Number(!!a.card.captured)||b.carriers.length-a.carriers.length).map(e=>e.card);
  const jumping=targets.filter(c=>['Light:2274','Dark:2273'].includes(c.id)).flatMap(skiff=>(skiff.occupants??[]).filter(e=>e.card.type==='Character'&&!targets.includes(e.card)).map(e=>({skiff,card:e.card})));
  const jump=()=>{const item=jumping.shift();if(!item){resolve();return;}jpChoose(ccOwner(item.card),item.skiff,'SkiffAreaJump',[{args:['jump'],label:item.card.name+' steigt vor dem Verlust des Skiffs aus'},{args:['stay'],label:item.card.name+' bleibt an Bord'}],choice=>{if(choice.args[0]==='jump'){const e=jpEntry(item.card);if(e&&detachTableCard(e.side,e.slot,item.card))jpOwn(ccOwner(item.card)).board[site].push(item.card);}jump();});};jump();
 };
 const resolve=()=>{
  delete state.jpAreaAction;state.jpAtomicArea=true;
  try{for(const card of [...targets,...(source&&!targets.includes(source)?[source]:[])]){const e=jpEntry(card);if(e)loseTableCard(e.side,e.slot,card,false,false,true,true,'cancelled');}}
  finally{delete state.jpAtomicArea;}next();
 };assign();
}

ccProviders.push(side=>{
 if(!jpEnabled())return [];const out=[];
 for(const [i,e]of jpUnits().entries())if(e.side===side&&!e.unavailable&&e.card.id==='Dark:2556'&&jpLive(e.card)&&isSite(state.locations[e.slot]))out.push(jpOption(e.card,'detonate',[i],'Thermal Detonator zünden · drei Destiny',()=>{drawDestinySeries(side,'jpThermal',3,0,d=>jpAreaLoss(e.slot,d.filter(x=>!x.cancelled).map(x=>x.value),e.card,()=>{}));return true;}));
 return out;
});
