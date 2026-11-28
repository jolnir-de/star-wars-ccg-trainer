'use strict';
PremiereWeapons.registerExpansion([
 ['Light:428',{deploy:host=>PremiereUnits.hasSkill(host,'warrior')&&CloudCityRules.city(state.locations[ccEntry(host)?.slot])?2:null,cost:2,targets:['Character','Creature']}],
 ['Dark:427',{deploy:host=>PremiereUnits.hasSkill(host,'warrior')&&CloudCityRules.city(state.locations[ccEntry(host)?.slot])?2:null,cost:2,targets:['Character','Creature']}],
 ['Light:1603',{deploy:host=>ccPersona(host,'Luke')?1:PremiereUnits.hasSkill(host,'warrior')?3:null,cost:2,targets:['Character','Creature','Vehicle'],bonus:target=>target.type==='Character'||target.type==='Creature'?1:0}],
 ['Dark:293',{deploy:host=>ccPersona(host,'Boba Fett')?1:PremiereUnits.bountyHunter(host)?3:null,cost:2,targets:['Character','Creature','Vehicle'],bonus:target=>target.type==='Vehicle'?1:0,repeats:true}]
]);
const ccWeaponBase={shot:weaponShot,result:applyWeaponResult,response:withShipWeaponResponse,immunity:battleImmunity,damage:battleDamageAction};
weaponShot=function(weapon,host,target,defense){
 let actual=target;
 if(cloudCityEnabled()&&CloudCityRules.car(target)&&CloudCityRules.cloud(state.locations[ccEntry(target)?.slot]))actual={...target,type:'Starship',subType:'Starfighter: Cloud Car'};
 const shot=ccWeaponBase.shot(weapon,host,actual,defense);
 if(shot&&actual!==target)shot.target=target;
 if(shot&&cloudCityEnabled()&&weapon.id==='Dark:293'&&battleSession?.usedWeapons?.includes(weapon))shot.cost=1;
 return shot;
};
withShipWeaponResponse=function(frame,finish){
 if(!cloudCityEnabled()||frame.kind!=='weaponTarget'||frame.shot?.weapon.id!=='Light:1603'||!ccPersona(frame.shot.host,'Luke'))return ccWeaponBase.response(frame,finish);
 return ccWeaponBase.response(frame,answer=>{if(!answer?.cancelled)frame.shot.target.cloudCityNoImmunityThrough=state.game.timing.turn;finish(answer);});
};
applyWeaponResult=function(shot,side,slot,...args){
 const result=ccWeaponBase.result(shot,side,slot,...args);
 if(cloudCityEnabled()&&['Light:428','Dark:427'].includes(shot.weapon?.id)&&['hit','zero'].includes(shot.effect)&&ccEntry(shot.target))shot.target.cloudCityHitCannotAttrition=true;
 return result;
};
battleImmunity=function(side,card,slot,...args){return cloudCityEnabled()&&card.cloudCityNoImmunityThrough>=state.game.timing.turn?0:ccWeaponBase.immunity(side,card,slot,...args);};
battleDamageAction=function(side,kind,args){
 const x=battleSession,card=kind==='battleForfeit'&&x?.participants[side]?.[args[0]],debt=x?.damage?.debt[side];
 const keep=cloudCityEnabled()&&card&&debt?.hits.includes(card)&&(card.cloudCityHitCannotAttrition||ccEffects('Light:583').length)?debt.attrition:null;
 const result=ccWeaponBase.damage(side,kind,args);if(result&&keep!==null)debt.attrition=keep;return result;
};
ccContinuousProviders.push(()=>{for(const entry of ccUnits())if(entry.card.cloudCityHitCannotAttrition&&!entry.card.hitForLoss&&!battleSession?.hitUnits?.[entry.side]?.includes(entry.card))delete entry.card.cloudCityHitCannotAttrition;});
function ccBeforeWeaponHit(side,shot,site,next){
 if(['Light:442','Dark:441'].includes(state.locations[site]?.id)&&dagoLocationText(site)&&shot.target.type==='Character'&&['hit','zero'].includes(shot.effect)&&ccVanes().length){ccToWeatherVane(shot.target,site);shot.cloudCityReplaced=true;next();return;}
 const frame={kind:'cloudCityWouldHit',side,shot,site};
 withShipWeaponResponse(frame,answer=>{const result=answer??frame;if(result.replaced){shot.cloudCityReplaced=true;const row=battleSession?.weaponResults?.at(-1);if(row)row.outcome='Captured / frozen';}if(result.shield){shot.target=result.shield;const row=battleSession?.weaponResults?.at(-1);if(row)row.target=result.shield.name;}next();});
}
const ccHitBase={apply:applyWeaponResult,capture:captureCharacter};
applyWeaponResult=function(shot,side,site,...args){if(cloudCityEnabled()&&shot.cloudCityReplaced)return false;const result=ccHitBase.apply(shot,side,site,...args);if(cloudCityEnabled()&&['hit','zero'].includes(shot.effect)&&ccEntry(shot.target))queueRuleResponse({kind:'cloudCityHit',side:PremiereGame.otherSide(side),target:shot.target,shot,site});return result;};
captureCharacter=function(card,site){
 const equipment=cloudCityEnabled()?[...(card.weapons??[]),...(card.attachments??[]).filter(card=>['Weapon','Device'].includes(card.type))]:[],result=ccHitBase.capture(card,site);
 if(result&&cloudCityEnabled()){
  for(const item of equipment){const list=card.weapons?.includes(item)?card.weapons:card.attachments;list.splice(list.indexOf(item),1);loseOwnedCard(item,ccOwner(item));}
  if(battleSession)for(const side of PremiereGame.sides)if(battleSession.hitUnits?.[side])battleSession.hitUnits[side]=battleSession.hitUnits[side].filter(unit=>unit!==card);
  delete card.hitForLoss;queueRuleResponse({kind:'cloudCityCaptured',side:'Dark',target:card,site});
 }return result;
};
