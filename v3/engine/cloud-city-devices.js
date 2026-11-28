'use strict';
function ccInstallItem(side,card,target,site,kind='effect'){
 if(kind==='device'){
  if(target)(target.attachments??=[]).push(card);else(state.locationWeapons??={})[site]??=[];
  if(!target)state.locationWeapons[site].push(card);return;
 }
 const record={card,target:target??side,...(target?{host:target}:{})};
 if(Number.isInteger(site)){record.site=site;(state.locationEffects??={})[site]??=[];state.locationEffects[site].push(record);}
 else{(state.tableEffects??=[]).push(record);if(target)(target.attachments??=[]).push(card);}
 return record;
}
function ccIsDisarmed(card){return card.attachments?.some(effect=>activeCardRules(effect,'disarmHost').length||effect.id==='Dark:1701');}
function ccDeviceOptions(side){
 const out=[],own=ccOwn(side),all=ccUnits();
 if(state.activeSide!==side||state.phase!==2||battleSession)return out;
 own.hand.forEach((card,index)=>{
  if(card.set!=='5'||card.type!=='Device'||!withinDeploymentLimit(card,side))return;
  const cost=card.id==='Light:244'?2:card.id==='Dark:1637'?3:0;
  const add=(target,site,args)=>{if(cost>forceBudget(side))return;out.push(ccOption(card,'deviceDeploy',[index,...args],target?.name??state.locations[site].name,()=>{
   spendForce(side,cost);own.hand.splice(own.hand.indexOf(card),1);
   if(card.id==='Light:244')for(const effect of [...target.attachments??[]])if(activeCardRules(effect,'disarmHost').length||effect.id==='Dark:1701'){
    const record=state.tableEffects?.find(record=>record.card===effect);if(record)cancelTableEffect(record);else{target.attachments.splice(target.attachments.indexOf(effect),1);loseOwnedCard(effect,effect.owner??effect.side);}
   }
   ccInstallItem(side,card,target,site,'device');
   if(card.id==='Light:592'){card.cloudCityStored=[];card.cloudCityStorageHostId=target.instanceId;card.cloudCityStorageOwner=side;}
   (state.deployedThisTurn??=[]).push(card);openDeploymentReaction(side,[card]);
   return true;
  },{cost,site,target}));};
  if(['Dark:380','Dark:1320'].includes(card.id))state.locations.forEach((loc,site)=>{if(card.id==='Dark:380'?/cloud city: carbonite chamber/.test(ccTitle(loc)):PremiereLocations.prison(loc))add(null,site,[site]);});
  else all.forEach((entry,i)=>{
   const target=entry.card;if(entry.side!==side||entry.unavailable||target.type!=='Character')return;
   const allowed=card.id==='Light:244'?ccIsDisarmed(target):card.id==='Light:592'?target.subType==='Alien'&&cardAbility(target)<3:card.id==='Light:1476'?true:card.id==='Dark:243'?PremiereUnits.canEscort(target):card.id==='Dark:1637'?['Imperial','Alien'].includes(target.subType)&&!ccPersona(target,'Vader')&&!ccPersona(target,'Boba Fett'):false;
   if(allowed)add(target,entry.slot,[i]);
  });
 });return out;
}
ccProviders.push(ccDeviceOptions);
const ccDeviceStats={power:cardPowerModifier,immunity:battleImmunity,defense:PremiereWeapons.defense,destiny:hothWeaponDestiny};
cardPowerModifier=function(card,side,slot,present){let value=ccDeviceStats.power(card,side,slot,present);if(cloudCityEnabled())for(const device of card.attachments??[])if(ccText(device)){if(device.id==='Light:244')value++;if(device.id==='Dark:1637')value+=2;}return value;};
battleImmunity=function(side,card,slot,...args){const value=ccDeviceStats.immunity(side,card,slot,...args);return cloudCityEnabled()&&card.attachments?.some(device=>device.id==='Dark:1637'&&ccText(device))?Math.max(value,3):value;};
PremiereWeapons.defense=function(card,ability,stats){const base=ccDeviceStats.defense(card,ability,stats);return cloudCityEnabled()&&card.type==='Character'&&card.attachments?.some(device=>device.id==='Dark:1637'&&ccText(device))?Math.max(5,base??0):base;};
hothWeaponDestiny=function(side,shot){return ccDeviceStats.destiny(side,shot)+(cloudCityEnabled()&&shot.weapon.subType==='Character'&&shot.host.attachments?.some(device=>device.id==='Light:244'&&ccText(device))?1:0);};
