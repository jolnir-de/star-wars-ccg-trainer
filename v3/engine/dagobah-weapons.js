'use strict';
// Weapon definitions share the normal mounting, targeting, costs and response stack.
PremiereWeapons.registerExpansion([
 ['Dark:11',{deploy:host=>host.id==='Dark:9'?0:PremiereUnits.hasSkill(host,'warrior')?4:null,cost:0,targets:['Character','Creature'],adjacent:true,effect:'dagobahRifle'}],
 ['Dark:312',{deploy:host=>host.id==='Dark:308'?2:PremiereUnits.hasSkill(host,'warrior')?4:null,cost:2,targets:['Character','Creature','Vehicle','Starship','Weapon','Device'],effect:'dagobahMortar'}],
 ['Dark:704',{deploy:host=>host.id==='Dark:700'?1:PremiereUnits.hasSkill(host,'warrior')?3:null,cost:1,bonus:1,targets:['Character','Creature','Vehicle'],effect:(_,host)=>'hit',zeroBy:'dengar'}],
 ['Dark:1249',{deploy:host=>host.id==='Dark:1245'?0:PremiereUnits.bountyHunter(host)?2:null,cost:3,bonus:1,targets:['Character'],effect:'dagobahNeural'}],
 ['Dark:1251',{deploy:host=>host.id==='Dark:1245'?1:PremiereUnits.hasSkill(host,'warrior')?4:null,cost:1,bonus:-1,targets:['Character','Creature'],effect:'dagobahPulse'}],
 ['Dark:1961',{deploy:host=>host.characteristics?.includes('bomber')?0:null,cost:0,targets:['Character','Vehicle','Starship'],effect:'dagobahBombs'}]
]);
const dagoWeaponBase={shot:weaponShot,range:hothWeaponInRange,options:battleWeaponOptions,resolve:hothResolveShot,destiny:hothWeaponDestiny,shoot:shootWeapon};
weaponShot=function(weapon,host,target,defense){
 const shot=dagoWeaponBase.shot(weapon,host,target,defense);if(!shot||!dagobahEnabled())return shot;
 if(['Dark:1249','Dark:1251'].includes(weapon.id)&&isDroid(target))return null;
 if(weapon.id==='Dark:1249')shot.defense=cardAbility(target);
 if(weapon.id==='Dark:704'&&host.id==='Dark:700')shot.effect='zero';
 if(weapon.id==='Dark:1961'&&host.dagobahBombingRun===undefined)return null;
 return shot;
};
function dagoSiteDistance(from,to){
 if(from===to)return 0;
 if(!isSite(state.locations[from])||!isSite(state.locations[to])||sitePlanet(state.locations[from])!==sitePlanet(state.locations[to]))return Infinity;
 const sites=boardLocationOrder().filter(slot=>isSite(state.locations[slot])&&sitePlanet(state.locations[slot])===sitePlanet(state.locations[from]));
 return Math.abs(sites.indexOf(from)-sites.indexOf(to));
}
hothWeaponInRange=function(weapon,from,to,place=from){return dagobahEnabled()&&weapon.id==='Dark:11'?place===from&&(from===to||isExteriorPlanetSite(state.locations[to])&&dagoSiteDistance(from,to)<=2):dagoWeaponBase.range(weapon,from,to,place);};
hothWeaponDestiny=function(side,shot){return dagoWeaponBase.destiny(side,shot)+(dagobahEnabled()&&/blaster rifle|artillery/i.test(shot.weapon.name+' '+shot.weapon.subType)&&shot.host.attachments?.some(card=>card.id==='Light:1926'&&dagoText(card))?1:0);};
battleWeaponOptions=function(side,timing='weapons',battle=battleSession,budget){
 const choices=dagoWeaponBase.options(side,timing,battle,budget);if(!dagobahEnabled())return choices;
 return choices.map(shot=>shot.weapon.id==='Dark:11'?{...shot,bonus:shot.bonus-dagoSiteDistance(shot.from,shot.targetSlot)+(shot.weapon.attachments?.some(card=>activeCardRules(card,'blasterScope').length)?1:0)}:shot);
};
// Pulse Cannon chooses its complete target group before paying or drawing.
shootWeapon=function(side,shot,complete){
 if(!dagobahEnabled()||shot.effect!=='dagobahPulse')return dagoWeaponBase.shoot(side,shot,complete);
 const candidates=weaponTargets(PremiereGame.otherSide(side),shot.targetSlot,false).filter(entry=>['Character','Creature'].includes(entry.card.type)&&!isDroid(entry.card)&&entry.place===shot.targetSlot),chosen=[shot.target];
 const fire=()=>{state.pendingCardView=null;spendForce(side,chosen.length);markWeaponFired(shot);let at=0;
  const next=()=>{if(at>=chosen.length){afterCharacterFires(side,shot.host,shot.from,complete);return;}const target=chosen[at++],entry=dagoEntry(target);if(!entry){next();return;}
   const individual={...shot,target,targetSlot:entry.slot,defense:PremiereWeapons.defense(target,cardAbility(target),craftStats(target,entry.slot)),cost:0};
   withShipWeaponResponse({kind:'weaponTarget',side,shot:individual,site:entry.slot},frame=>{if(frame?.cancelled){next();return;}drawDestinySeries(side,'weapon',1,weaponDestinyModifier(side,individual),draws=>dagoResolveWeapon(side,individual,draws.length?PremiereBattle.total(draws)-1:null,draws,next));});
  };next();return true;
 };
 const show=()=>{const remaining=candidates.filter(entry=>!chosen.includes(entry.card));if(!remaining.length||chosen.length>=forceBudget(side))return fire();dagoPrompt(side,shot.weapon,'PulseTargets',remaining.map((entry,i)=>({args:[i],card:entry.card,label:entry.card.name+' hinzunehmen'})).concat({args:['fire'],label:chosen.length+' Ziele · '+chosen.length+' Force · feuern'}),choice=>{if(choice.args[0]==='fire')return fire();chosen.push(choice.card);show();return true;});};show();
};
function dagoResolveWeapon(side,shot,total,draws,complete){
 const value=draws.find(draw=>!draw.cancelled)?.value,entry=dagoEntry(shot.target),slot=entry?.slot??shot.targetSlot;
 const record=hit=>{if(battleSession)recordBattleShot(battleSession,side,shot,total,shot.defense,hit);};
 if(shot.effect==='dagobahMortar'){
  if(value===0){const host=dagoEntry(shot.host);if(host)loseTableCard(host.side,host.slot,host.card);record(false);complete();return;}
  const targets=Number.isFinite(value)?dagoUnits().filter(entry=>entry.slot===slot&&!entry.unavailable&&PremiereLocations.presentAt(entry,slot)&&PremiereBattle.printedDestiny(entry.card)===value):[];
  if(!targets.length){record(false);complete();return;}
  dagoPrompt(side,shot.weapon,'Mortar',targets.map((target,i)=>({args:[i],card:target.card,label:target.card.name+' verlieren'})),choice=>{const target=dagoEntry(choice.card);if(target)loseTableCard(target.side,target.slot,target.card);state.pendingCardView=null;record(true);complete();return true;});return;
 }
 if(shot.effect==='dagobahBombs'){
  if(Number.isFinite(value))for(const target of dagoUnits().slice())if(target.slot===slot&&!target.unavailable&&PremiereLocations.presentAt(target,slot)&&['Character','Starship','Vehicle'].includes(target.card.type)&&target.card.dagobahBombingRun===undefined&&!target.carriers.some(card=>card.dagobahBombingRun!==undefined)&&PremiereBattle.printedDestiny(target.card)===value&&dagoEntry(target.card))loseTableCard(target.side,slot,target.card);
  record(Number.isFinite(value));complete();return;
 }
 const hit=Number.isFinite(total)&&total>shot.defense;record(hit);
 if(shot.effect==='dagobahPulse'&&value===0&&entry)shot.target.dagobahDebuffTurn=state.game.timing.turn;
 if(hit&&entry){
  if(shot.effect==='dagobahNeural')shot.target.dagobahNeuralUntil=dagoDeadline(side);
  else{if(shot.host.id==='Dark:1245')shot.target.dagobahHitByIG88=state.game.timing.turn;applyWeaponResult({...shot,effect:'hit'},entry.side,slot);}
 }
 complete();
}
hothResolveShot=function(side,shot,total,draws,complete){if(!dagobahEnabled()||!/^dagobah/.test(shot.effect))return dagoWeaponBase.resolve(side,shot,total,draws,complete);dagoResolveWeapon(side,shot,total,draws,complete);return true;};

const dagoSpecialWeapons={targets:weaponTargets,shot:weaponShot,resolve:dagoResolveWeapon,actions:dagoActionOptions,immediate:fireImmediateWeapon};
function dagoRogueRecord(card){return [...dagoEffects('Light:2124'),...dagoEffects('Dark:2123')].find(effect=>effect.card===card);}
weaponTargets=function(side,slot,...args){
 const targets=dagoSpecialWeapons.targets(side,slot,...args);if(!dagobahEnabled())return targets;
 const extra=[...dagoEffects('Light:2124',side),...dagoEffects('Dark:2123',side)].filter(effect=>effect.site===slot);
 const first=1+Math.max(0,...targets.map(target=>target.index));
 return targets.concat(extra.map((effect,index)=>({card:effect.card,index:first+index,place:slot,slot})));
};
weaponShot=function(weapon,host,target,defense){
 if(dagobahEnabled()&&dagoRogueRecord(target)){
  if(weapon.subType!=='Starship')return null;
  const shot=PremiereWeapons.shot(weapon,host,{...target,type:'Starship',subType:'',armor:3},cardAbility(host),3);
  return shot?{...shot,defense:3,effect:'dagobahRogue'}:null;
 }
 return dagoSpecialWeapons.shot(weapon,host,target,defense);
};
dagoResolveWeapon=function(side,shot,total,draws,complete){
 if(shot.effect==='dagobahRogue'){
  const effect=dagoRogueRecord(shot.target),hit=Number.isFinite(total)&&total>3;
  if(battleSession)recordBattleShot(battleSession,side,shot,total,3,hit);
  if(hit&&effect)hothCancelEffect(effect);complete();return;
 }
 if(shot.effect==='dagobahLostPilot'){
  if(Number.isFinite(total)&&total>0&&shot.lostSpace.support?.includes(shot.target)){
   shot.lostSpace.support.splice(shot.lostSpace.support.indexOf(shot.target),1);loseOwnedCard(shot.target,shot.target.owner??shot.target.side,'support');hothCancelEffect(shot.lostSpace);
  }
  complete();return;
 }
 return dagoSpecialWeapons.resolve(side,shot,total,draws,complete);
};
function dagoLostPilotShots(side){
 if(battleSession)return [];
 const out=[];
 for(const effect of dagoEffects('Dark:1583'))for(const pilot of effect.support??[]){
  if((pilot.owner??pilot.side)===side)continue;
  for(const [source,mount] of weaponMounts(side).entries())for(const [index,weapon] of mountWeapons(mount).entries()){
   const key=dagoUsed(weapon,'lostPilotFire');
   if(mount.slot!==effect.site||mount.place!==mount.slot||PremiereGame.wasUsed(state.game,'turn',key)||!PremiereUnits.canUseWeapon(state,mount.host,weapon))continue;
   if(mount.host.type==='Starship'&&!craftStats(mount.host,mount.slot).powered)continue;
   const shot=PremiereWeapons.shot(weapon,mount.host,{...pilot,type:'Starship',subType:'Starfighter',armor:null,maneuver:0},0,0);
   if(!shot||shot.cost>forceBudget(side))continue;
   const actual={...shot,host:mount.host,weapon,target:pilot,from:mount.slot,targetSlot:effect.site,effect:'dagobahLostPilot',lostSpace:effect,defense:0};
   out.push(dagoOption(weapon,'lostPilotFire',[effect.card.instanceId,source,index],pilot.name+' im All beschießen',{site:effect.site,cost:shot.cost,resolve(){PremiereGame.useOnce(state.game,'turn',key);fireImmediateWeapon(side,actual,()=>{});return true;}}));
  }
 }
 return out;
}
dagoActionOptions=function(side){return dagoSpecialWeapons.actions(side).concat(dagobahEnabled()&&!state.pendingCardView&&!state.pendingForceLoss&&!PremiereGame.responseWindow(state.game)?dagoLostPilotShots(side):[]);};
fireImmediateWeapon=function(side,shot,complete){
 if(!dagobahEnabled()||shot.effect!=='dagobahLostPilot')return dagoSpecialWeapons.immediate(side,shot,complete);
 spendForce(side,shot.cost);PremiereUnits.recordWeaponUse(state,shot.host,shot.weapon);
 withShipWeaponResponse({kind:'weaponTarget',side,shot,site:shot.targetSlot},frame=>{if(frame?.cancelled){complete();return;}drawDestinySeries(side,'weapon',shot.draws,weaponDestinyModifier(side,shot),draws=>dagoResolveWeapon(side,shot,draws.length?PremiereBattle.total(draws)+shot.bonus:null,draws,complete));});
};
