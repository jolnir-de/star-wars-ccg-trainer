'use strict';
function ccVanes(){return (state.tableEffects??[]).filter(effect=>['Light:2779','Dark:2778'].includes(effect.card.id)&&ccText(effect.card));}
function ccToWeatherVane(card,slot){
 const vane=ccVanes()[0];if(!vane)return false;
 const entry=ccEntry(card),owner=ccOwner(card),lost=ccOwn(card.owner??card.side).lost;
 if(entry){ccEscortRemoved(card,card,slot,entry.carriers[0]);if(!detachTableCard(entry.side,entry.slot,card))return false;
  PremiereUnits.remove(card,item=>{if(item!==card)loseOwnedCard(item,item.owner??owner);},item=>loseOwnedCard(item,item.owner??owner));
 }else{const index=lost.indexOf(card);if(index<0)return false;lost.splice(index,1);}
 for(const other of vane.support??[])loseOwnedCard(other,other.owner??other.side);
 vane.support=[card];card.cloudCityWeatherVane=true;delete card.hitForLoss;
 if(battleSession)for(const side of PremiereGame.sides)battleSession.hitUnits?.[side]?.splice?.(battleSession.hitUnits[side].indexOf(card),Number(battleSession.hitUnits[side].includes(card)));
 log(card.name+' hängt am Weather Vane.');return true;
}
ccProviders.push(side=>{
 const out=[],own=ccOwn(side);if(state.activeSide!==side||battleSession)return out;
 if(state.phase===2)own.hand.forEach((card,index)=>{if(['Light:2779','Dark:2778'].includes(card.id)&&withinDeploymentLimit(card,side))out.push(ccOption(card,'weatherDeploy',[index],'Weather Vane auslegen',()=>{own.hand.splice(own.hand.indexOf(card),1);const effect=ccInstallItem(side,card,null,null);effect.support=[];effect.cloudCitySeen=state.locations.some(CloudCityRules.sector);return true;}));});
 if(state.phase!==1)return out;
 for(const [vaneIndex,vane]of ccVanes().entries())for(const target of vane.support??[])for(const [index,craft]of ccUnits().entries())if(craft.side===side&&!craft.unavailable&&CloudCityRules.sector(state.locations[craft.slot])&&['Vehicle','Starship'].includes(craft.card.type)&&craftStats(craft.card,craft.slot).powered&&ccControl(side,craft.slot)){
  if(ccOwner(target)===side)for(const role of PremiereUnits.roles(craft.card,target))if(['pilot','passenger'].includes(role))out.push(ccOption(vane.card,'weatherRescue',[vaneIndex,index,role],target.name+' an Bord von '+craft.card.name+' retten',()=>{vane.support.splice(vane.support.indexOf(target),1);delete target.cloudCityWeatherVane;PremiereUnits.add(craft.card,target,role,side);return true;},{site:craft.slot,target}));
  if(side==='Dark'&&ccOwner(target)==='Light')out.push(ccOption(vane.card,'weatherCapture',[vaneIndex,index],target.name+' gefangen nehmen',()=>{vane.support.splice(vane.support.indexOf(target),1);delete target.cloudCityWeatherVane;target.captured=true;(state.pendingCustody??=[]).push({side:'Dark',card:target,slot:craft.slot});return true;},{site:craft.slot,target}));
 }
 return out;
});
ccContinuousProviders.push(()=>{
 const city=state.locations.some(loc=>CloudCityRules.sector(loc)&&!loc.blownAway);
 for(const vane of ccVanes()){if(city)vane.cloudCitySeen=true;else if(vane.cloudCitySeen)cancelTableEffect(vane);}
});
const ccWeatherBase={weapon:applyWeaponResult};
applyWeaponResult=function(shot,side,slot,...args){
 if(cloudCityEnabled()&&['Light:442','Dark:441'].includes(state.locations[slot]?.id)&&dagoLocationText(slot)&&shot.target.type==='Character'&&['hit','zero'].includes(shot.effect)&&ccVanes().length)return ccToWeatherVane(shot.target,slot);
 return ccWeatherBase.weapon(shot,side,slot,...args);
};
