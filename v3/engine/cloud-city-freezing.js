'use strict';
function ccFreezeBonus(site){
 const loc=state.locations[site],present=ccPresent('Dark',site),double=present.some(card=>ccOn(card,'Dark:2661'))?2:1;
 let bonus=present.filter(card=>card.id==='Dark:2662'&&ccText(card)).length*double;
 bonus+=ccUnits().filter(entry=>entry.slot===site&&entry.card.id==='Dark:380'&&ccText(entry.card)).length*3;
 if(loc?.id==='Light:438'&&dagoLocationPlayer(site,'Dark')==='Dark')bonus++;
 if(loc?.id==='Dark:437'){
  if(dagoLocationPlayer(site,'Dark')==='Dark')bonus+=2;
  if(dagoLocationPlayer(site,'Light')==='Light'&&PremiereLocations.occupy(state,'Light',site,cardAbility)===true)bonus-=2;
 }return bonus;
}
function ccLoseCaptive(card){
 const entry=ccEntry(card);if(!entry)return false;
 if(!detachTableCard(entry.side,entry.slot,card))return false;
 clearCaptivity(card);PremiereUnits.remove(card,item=>loseOwnedCard(item,item.owner??'Light'),item=>loseOwnedCard(item,item.owner??'Light'));return true;
}
function ccFreeze(side,source,target,site,complete=()=>{}){
 const before={kind:'cloudCityFreeze',side,card:source,target,site,bonus:0};
 withShipWeaponResponse(before,answer=>{
  const frame=answer??before;
  if(frame.cancelled){complete();return;}
  drawDestinySeries(side,'carbonFreezing',1,ccFreezeBonus(site)+(frame.bonus??0),draws=>{
   const total=draws.length?PremiereBattle.total(draws):null;
   const after={kind:'cloudCityFreezeResult',side,card:source,target,site,total};
   withShipWeaponResponse(after,answer=>{
    const result=answer??after;
    if(result.cancelled||total===null||!ccEntry(target)){complete();return;}
    log(source.name+' · Carbon-Freezing Destiny '+total+'.');
    if(total<5){ccLoseCaptive(target);complete();return;}
    if(total>10){
     const effect=state.locationEffects?.[site]?.find(effect=>effect.card===source);
     if(effect){state.locationEffects[site].splice(state.locationEffects[site].indexOf(effect),1);effect.host=target;effect.target=target;delete effect.site;(target.attachments??=[]).push(source);(state.tableEffects??=[]).push(effect);}
     target.frozen=true;queueRuleResponse({kind:'cloudCityFrozen',side,target,site});dagoLoss(PremiereGame.otherSide(side),8,source.name,complete);
    }else complete();
   });
  });
 });
}
ccProviders.push(side=>{
 const out=[];if(side!=='Dark'||state.activeSide!==side||battleSession)return out;
 if(state.phase===2)ccOwn(side).hand.forEach((card,index)=>{
  if(card.id!=='Dark:379'||!withinDeploymentLimit(card,side))return;
  state.locations.forEach((loc,site)=>{if(!/^cloud city: carbonite chamber$/.test(ccTitle(loc)))return;out.push(ccOption(card,'deployFreezing',[index,site],loc.name,()=>{ccOwn(side).hand.splice(ccOwn(side).hand.indexOf(card),1);ccInstallItem(side,card,null,site);return true;},{site}));});
 });
 if(state.phase===1)for(const [siteText,effects]of Object.entries(state.locationEffects??{})){
  const site=Number(siteText);
  for(const effect of effects)if(effect.card.id==='Dark:379'&&ccText(effect.card)&&!ccUsed(effect.card,'freeze','phase'))for(const [i,entry]of ccUnits().entries())if(entry.slot===site&&entry.card.captured&&!entry.card.frozen&&PremiereLocations.physicalPlace(entry)===site)out.push(ccOption(effect.card,'freeze',[site,i],entry.card.name+' in Carbonit einfrieren',()=>{ccMark(effect.card,'freeze','phase');ccFreeze(side,effect.card,entry.card,site);return true;},{site,target:entry.card}));
 }
 return out;
});
const ccFreezeClear=clearCaptivity;
clearCaptivity=function(card){
 const wasCaptive=card.captured;ccFreezeClear(card);
 if(cloudCityEnabled()&&wasCaptive)for(const effect of [...state.tableEffects??[]])if((effect.host===card&&['Dark:87','Dark:379','Dark:2768'].includes(effect.card.id))||effect.captive===card&&['Dark:714','Dark:2524'].includes(effect.card.id))cancelTableEffect(effect);
};
