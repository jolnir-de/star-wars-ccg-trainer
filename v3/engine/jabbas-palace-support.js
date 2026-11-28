'use strict';
function jpIconCalculation(game,slot,side,plan){
 if(!jpEnabled()||game!==state||!isSite(game.locations[slot]))return plan;
 let {value,details}=plan;details=details.slice();
 const ithorians=jpUnits().filter(e=>e.slot===slot&&!e.unavailable&&e.card.id==='Light:1339'&&jpLive(e.card)&&/jungle|forest|swamp/.test(jpTitle(game.locations[slot])));
 const monk=jpAll(null,'Light:183').find(e=>e.slot===slot);
 if(monk){const other=PremiereGame.otherSide(side),printed=game.locations[slot].icons?.[PremiereLocations.printedSide(game,slot,other).toLowerCase()]??0,effects=PremiereLocations.effectsAt(game,slot),otherValue=printed+Math.max(0,...effects.map(e=>e.iconBonus??0))+effects.reduce((n,e)=>n+(e.icons?.[other]??0),0),next=Math.max(value,otherValue);details.push(V3DrainTrace.term('icons',next-value,monk.card,'Icon-Ausgleich durch B’omarr Monk',slot));value=next;}
 for(const entry of ithorians){value++;details.push(V3DrainTrace.term('icons',1,entry.card,'Zusätzliches Icon im Jungle / Forest / Swamp',slot));}
 return {value,details};
}
function jpIconValue(game,slot,side,value){return jpIconCalculation(game,slot,side,{value,details:[]}).value;}
const jpSupportBase={revolution:revolutionOptions,ability:battleAbilityAt,equip:weaponDeployCost,cost:crewDeployCost,stats:craftStats,travel:travelOptions,deploy:openDeploymentReaction,automated:automatedDeployOptions,seekerMoves:seekerMoves,targets:automatedTargets,loss:loseOwnedCard,battle:initiateBattleFor,immunity:battleImmunity,power:cardPowerModifier,forfeit:cardForfeitValueAt};
const jpTransferOptions=weaponEffectOptions;
weaponEffectOptions=function(side){
 if(!jpEnabled())return jpTransferOptions(side);
 const quoting=quotingForce;let options;
 try{quotingForce=true;options=jpTransferOptions(side);}finally{quotingForce=quoting;}
 return options.map(option=>{
  if(option.args[0]!=='transfer'||option.weapon.subType!=='Character')return option;
  const {slot,place}=option.source,present=jpUnits().filter(e=>e.side===side&&!e.unavailable&&e.slot===slot&&PremiereLocations.physicalPlace(e)===place),free=present.some(e=>jpLive(e.card)&&(e.card.id==='Light:1482'&&present.some(other=>jpSpecies(other.card,'corellian')&&JabbasPalaceRules.nonunique(other.card))||e.card.id==='Dark:1130'&&present.some(other=>jpSpecies(other.card,'advosze'))));
  return free?{...option,cost:0,label:option.weapon.name+' → '+option.target.host.name+' (kostenlos)'}:option;
 }).filter(option=>(option.cost??0)<=forceBudget(side));
};
revolutionOptions=function(...args){return jpSupportBase.revolution(...args).filter(slot=>!jpEnabled()||!['Dark:2452','Dark:1353'].includes(state.locations[slot]?.id));};
battleAbilityAt=function(card,...args){return jpEnabled()&&card.id==='Light:183'?0:jpSupportBase.ability(card,...args);};
weaponDeployCost=function(weapon,host,...args){if(jpEnabled()){
 if(host?.id==='Light:183')return null;
 if(host?.id==='Light:1988'&&/jawa/i.test(weapon.name))return 0;
 if(weapon.subType==='Vehicle'&&jpEntry(host)&&jpAt(ccOwner(host),jpEntry(host).slot,'Dark:2724'))return 0;
 }return jpSupportBase.equip(weapon,host,...args);};
crewDeployCost=function(card,side,loc){return jpSupportBase.cost(card,side,loc);};
craftStats=function(card,slot,...args){const stats=jpSupportBase.stats(card,slot,...args);if(!jpEnabled())return stats;
 const side=ccOwner(card),leslomy=jpAtAudience(side,'Light:1505');
 if(stats.powered)for(const {card:crew,role}of card.occupants??[])if(role==='pilot'&&PremiereUnits.active(crew)){
  if(crew.id==='Light:2026'&&crew.attachments?.some(c=>c.id==='Light:2141'&&jpLive(c)))stats.power+=2;
  if(leslomy&&crew.attachments?.some(c=>c.id==='Light:826'&&jpLive(c)))stats.power+=2;
 }return stats;
};
function jpSeekerKeeper(side,slot){return jpAll(side).some(e=>e.slot===slot&&['Light:170','Dark:2711'].includes(e.card.id)&&jpControl(side,slot));}
automatedDeployOptions=function(side,...args){const out=jpSupportBase.automated(side,...args);if(!jpEnabled())return out;return out.map(o=>PremiereWeapons.seeker(o.card)&&jpSeekerKeeper(side,o.slot)?{...o,cost:0}:o);};
seekerMoves=function(side){return jpSupportBase.seekerMoves(side).map(o=>jpEnabled()&&jpHas(side,side==='Light'?'Light:170':'Dark:2711')?{...o,cost:0}:o);};
automatedTargets=function(frame){const out=jpSupportBase.targets(frame);if(!jpEnabled()||frame.kind!=='seeker'||!jpHas(frame.side,frame.side==='Light'?'Light:170':'Dark:2711'))return out;return out.filter(e=>!frame.card.jpIgnored?.includes(e.card.instanceId));};
ccProviders.push(side=>{
 if(!jpEnabled())return [];const out=[],own=jpOwn(side),enemy=PremiereGame.otherSide(side);
 if(jpHas(side,side==='Light'?'Light:170':'Dark:2711'))for(const [i,e]of jpUnits().entries())if(PremiereWeapons.seeker(e.card)&&ccOwner(e.card)===side)for(const [j,target]of jpUnits().entries())if(target.slot===e.slot&&target.card.type==='Character')out.push(jpOption(e.card,'ignoreSeeker',[i,j],target.card.name+(e.card.jpIgnored?.includes(target.card.instanceId)?' wieder als Ziel zulassen':' als Seeker-Ziel ignorieren'),()=>{e.card.jpIgnored??=[];const at=e.card.jpIgnored.indexOf(target.card.instanceId);if(at>=0)e.card.jpIgnored.splice(at,1);else e.card.jpIgnored.push(target.card.instanceId);return true;}));
 if(state.activeSide===side&&state.phase===5&&forceBudget(side)>=2)for(const effect of ccEffects('Dark:1978',side))if(jpUnused(effect.card,'quick'))out.push(jpOnce(effect.card,'quick',[effect.card.instanceId],'Hidden Weapons bergen oder Blaster kostenlos deployen',2,()=>{jpChoose(side,effect.card,'QuickReflexes',[{args:['hidden'],label:'Hidden Weapons aus Lost auf Hand'},{args:['blaster'],label:'Blaster aus Lost kostenlos deployen'}],choice=>{if(choice.args[0]==='hidden')dagoSearch(side,effect.card,'lost',c=>c.id==='Dark:1139');else jpOfferDeploy(side,effect.card,'lost',c=>c.type==='Weapon'&&/blaster/i.test(c.name),{free:true});});return true;}));
 if(side==='Dark'&&state.activeSide===side&&state.phase===2)own.hand.forEach((card,index)=>{if(card.id!=='Dark:214'||!withinDeploymentLimit(card,side))return;for(const [i,e]of jpUnits().entries())if(!e.unavailable&&e.card.id!==card.id&&jpSpecies(e.card,'rodian')&&!JabbasPalaceRules.female(e.card)&&hasDeployPresence(side,state.locations[e.slot])&&hothDeploymentAllowed(card,state.locations[e.slot],side)&&(!e.carriers.length||ccOwner(e.carriers[0])===side)){
 const carrier=e.carriers[0],seat=carrier?.occupants?.find(o=>o.card===e.card);if(seat&&!PremiereUnits.accepts(carrier,card,seat.role,seat))continue;
 out.push(jpOption(card,'replaceRodian',[index,i],'Beedo ersetzt '+e.card.name+' kostenlos',()=>{if(!detachTableCard(e.side,e.slot,e.card))return false;const old=e.card,owner=ccOwner(old);ccEscortRemoved(old,old,e.slot,carrier);PremiereUnits.remove(old,c=>c===old?jpOwn(owner).used.push(c):loseOwnedCard(c,ccOwner(c)),c=>loseOwnedCard(c,ccOwner(c)));own.hand.splice(own.hand.indexOf(card),1);if(seat)(carrier.occupants??=[]).push({card,role:seat.role});else own.board[e.slot].push(card);openDeploymentReaction(side,[card]);return true;},{site:e.slot,target:e.card}));
 }});
 if(battleSession?.damage?.priority===side)for(const [i,e]of jpUnits().entries())if(e.side===side&&e.slot===battleSession.site&&!e.unavailable&&e.card.id==='Dark:1448')for(const [j,vehicle]of ccPresent(side,e.slot).entries())if(vehicle.type==='Vehicle'&&vehicle.subType==='Transport')out.push(jpOption(e.card,'klaatuForfeit',[i,j],vehicle.name+' forfeit · restlichen Battle-Schaden und Attrition erfüllen',()=>{loseTableCard(side,e.slot,vehicle,false,true);const debt=battleSession?.damage?.debt?.[side];if(debt){debt.damage=0;debt.attrition=0;}return true;}));
 return out;
});
function jpBattleInitiated(){
 const battle=battleSession;if(!jpEnabled()||!battle||battle.jpInitiated)return; battle.jpInitiated=true;
 const side=battle.initiator,slot=battle.site;
 if(jpScum(side))PremiereGame.retrieveForce(state,side,2);
 for(const e of jpAll(PremiereGame.otherSide(side),'Light:1059'))if(e.slot===slot||adjacentSites(e.slot,slot)){
  const retrieved=PremiereGame.retrieveForce(state,e.side,1);if(retrieved.length&&e.slot===slot)(state.hothDeferred??=[]).push(()=>jpChoose(e.side,e.card,'Gran',[{args:['used'],label:'Zurückgeholte Karte in Used lassen'},{args:['hand'],label:'Zurückgeholte Karte auf Hand nehmen'}],choice=>{if(choice.args[0]==='hand'){const at=jpOwn(e.side).used.indexOf(retrieved[0]);if(at>=0)jpOwn(e.side).hand.push(jpOwn(e.side).used.splice(at,1)[0]);}}));
 }
}
const jpBeginBattle=beginBattleResponses;
beginBattleResponses=function(...args){jpBattleInitiated();return jpBeginBattle(...args);};
initiateBattleFor=function(...args){const result=jpSupportBase.battle(...args);if(result)jpBattleInitiated();return result;};
battleImmunity=function(side,card,slot,...args){if(jpEnabled()&&card.id==='Dark:1362'&&state.locations.some((loc,i)=>loc?.hostInstanceId===card.instanceId&&loc.id==='Dark:1364'&&PremiereLocations.occupy(state,side,i,cardAbility)===true))return Infinity;return jpSupportBase.immunity(side,card,slot,...args);};
cardPowerModifier=function(card,side,slot,...args){let value=jpSupportBase.power(card,side,slot,...args);if(jpEnabled()){
 if(card.type==='Character'&&card.attachments?.some(c=>c.id==='Light:2157')&&jpAtAudience(side,'Light:1012'))value++;
 if(isHoloUnit(card)&&jpAll(side,'Light:230').some(e=>jpControl(side,e.slot))&&isHoloSite(state.locations[slot]))value++;
 if(jpAtAudience(side,'Dark:214')&&jpSpecies(card,'rodian'))value+=2;
 }return value;};
cardForfeitValueAt=function(card,side,slot,...args){let value=jpSupportBase.forfeit(card,side,slot,...args);if(jpEnabled()&&card.attachments?.some(c=>c.id==='Light:2157')&&jpAtAudience(side,'Light:1012'))value++;return value;};
