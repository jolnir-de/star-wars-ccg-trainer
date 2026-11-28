'use strict';
function ccEffectRelocationAllowed(effect,to){
 if(effect.card.set!=='5')return dagoRelocateEffectAllowed(effect,to);const loc=state.locations[to],side=ccOwner(effect.card);
 if(effect.card.id==='Light:84')return isSite(loc)&&confirmedPresence(side,to)===true;
 if(effect.card.id==='Light:217')return CloudCityRules.sector(loc);
 if(effect.card.id==='Dark:2323')return PremiereLocations.prison(loc);
 return false;
}
ccInterruptProviders.push(({add,card,index,side,enemy,all,window})=>{
 if(card.id!=='Dark:2384'&&card.id!=='Dark:257')return;
 if(card.id==='Dark:257'){
  if(window||state.activeSide!==side||state.phase!==1||battleSession)return;let shots;const before=quotingForce;quotingForce=true;try{shots=controlFireOptions(side,card,index,{pile:'Used',mode:'controlFire'});}finally{quotingForce=before;}
  for(const [i,offer]of shots.entries())if(!offer.shot.extraDestiny&&(/blaster/i.test(offer.shot.weapon.name)&&characterTraits(offer.shot.host).includes('trooper')||PremiereWeapons.projector(offer.shot.weapon)||PremiereWeapons.seeker(offer.shot.weapon)))add(card,index,'blastedDroid',[i],offer.shot.weapon.name+' kostenlos feuern',{shot:{...offer.shot,cost:0}});
  return;
 }
 if(window){
  if(window.kind==='interrupt'&&window.target&&typeof window.target==='object')for(const [i,entry]of all.entries()){
   let allowed=dagoInterruptRetargetAllowed(window,entry);
   if(window.mode?.startsWith('cc:')&&entry.side===ccEntry(window.target)?.side&&!entry.unavailable&&entry.card.type===window.target.type){const original=window.entry??ccEntry(window.target),present=original&&PremiereLocations.physicalPlace(original)===PremiereLocations.physicalPlace(entry);allowed=present&&(['cc:clash','cc:offEdge','cc:strangle','cc:higherGround','cc:killHit'].includes(window.mode))&&(window.mode!=='cc:strangle'||!isDroid(entry.card));}
   if(allowed&&entry.card!==window.target)add(card,index,'retargetInterrupt',[i],window.card.name+' → '+entry.card.name,{cost:3,target:entry.card});
  }return;
 }
 for(const [i,effect]of ccAllEffects().entries()){
  if(effect.card.subType?.includes('Utinni'))for(const [j,entry]of all.entries()){
   const eligible=effect.card.id==='Dark:972'?entry.side===ccEntry(effect.target)?.side&&!entry.unavailable&&PremiereUnits.fighter(entry.card)&&ccPlanet(state.locations[entry.slot])===ccPlanet(state.locations[effect.site])&&(CloudCityRules.cloud(state.locations[entry.slot])||state.locations[entry.slot]?.subType==='System'):dagoRetargetAllowed(effect,entry);
   if(eligible&&entry.card!==effect.target)add(card,index,'retargetEffect',[i,j],effect.card.name+' → '+entry.card.name,{effect,target:entry.card,cost:3});
  }
  if(Number.isInteger(effect.site)&&!effect.host&&!/immune to alter/i.test(effect.card.gametext))state.locations.forEach((loc,to)=>{if(loc&&to!==effect.site&&ccEffectRelocationAllowed(effect,to))add(card,index,'moveEffect',[i,to],effect.card.name+' → '+loc.name,{effect,to,cost:3});});
 }
});
const ccAnswersBase={settle:ccSettleBattleInterrupt,locations:ccLocationOptions};
ccSettleBattleInterrupt=function(frame,parent,done){
 const mode=frame.mode.slice(3);
 if(mode==='blastedDroid'){fireImmediateWeapon(frame.side,frame.shot,done);return true;}
 if(mode==='retargetEffect'){const effect=dagoOriginalEffect(frame.effect);effect.target=frame.target;if(effect.card.migTarget)effect.card.migTarget=frame.target;done();return true;}
 if(['retargetInterrupt','moveEffect'].includes(mode)){dagoSettleInterrupt({...frame,mode:'dago:'+mode},parent);return true;}
 return ccAnswersBase.settle(frame,parent,done);
};
ccProviders.push(side=>{
 const out=[];for(const [site,loc]of state.locations.entries())if(loc?.id==='Light:438'&&side===ccLocationSource(site,'Light')&&ccControl(side,site))for(const effect of ccEffects('Dark:379'))if(effect.site===site||ccEntry(effect.host)?.slot===site)out.push(ccOption(loc,'cancelFreezing',[site,effect.card.instanceId],'Carbon-Freezing hier aufheben',()=>{hothCancelEffect(effect);return true;}));return out;
});
