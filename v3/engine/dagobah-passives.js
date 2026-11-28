'use strict';
const dagoPassiveBase={lose:loseTableCard,owned:loseOwnedCard,retrieve:PremiereGame.retrieveForce,timing:dagoEffectTiming,continuous:dagoContinuous,damageOptions:battleDamageOptions,damageAction:battleDamageAction,crew:crewDeployCost,craft:craftDeployCost,board:boardDeployCost,presence:hasDeployPresence,stats:dagoCraftStats,power:dagoPowerModifier,forfeit:hothForfeit,travel:dagoTravel,shots:battleWeaponOptions,responses:hothResponseOptions,respond:hothRespond,characters:dagoUnitOptions,actions:dagoActionOptions};
function dagoDefer(task){(state.hothDeferred??=[]).push(task);}
function dagoSetZeroForfeit(card,side,slot){return dagoUnits().some(entry=>entry.slot===slot&&entry.side!==side&&!entry.unavailable&&PremiereLocations.presentAt(entry,slot)&&((entry.card.id==='Dark:308'&&/chewbacca/.test(dagoTitle(card)))||(entry.card.id==='Dark:700'&&/han solo/.test(dagoTitle(card)))));}
// Effects refer to their host while it is still on table; queue consequences only
// after the normal loss has really occurred (an evacuation can postpone it).
loseTableCard=function(side,slot,card,...args){
 if(!dagobahEnabled())return dagoPassiveBase.lose(side,slot,card,...args);
 const effects=[...dagoEffects('Dark:951'),...dagoEffects('Dark:1221')].filter(effect=>effect.host===card),slugSites=['Light:2313','Dark:2312'].includes(card.id)?state.locations.flatMap((loc,index)=>DagobahRules.cave(loc)&&loc.dagobahBigSlot===slot?[index]:[]):[];
 const armor=card.type==='Starship'?craftStats(card,slot).armor:null,result=dagoPassiveBase.lose(side,slot,card,...args);
 if(result&&!dagoEntry(card)){
  for(const effect of effects){const amount=effect.card.id==='Dark:951'?armor??0:/millennium falcon/.test(dagoTitle(card))?5:3;dagoDefer(()=>dagoLoss(side,amount,effect.card.name));}
  for(const site of slugSites)for(const actor of PremiereGame.sides)for(const unit of dagoOwn(actor).board[site].slice())loseTableCard(actor,site,unit);
 }
 return result;
};
loseOwnedCard=function(card,side,source='table',site,forfeited=false){
 if(dagobahEnabled()&&source==='table'&&card.type==='Effect'){
  const effect=state.tableEffects?.find(effect=>effect.card===card);if(effect?.card.id==='Light:2352')dagoReleaseSupport(effect);
 }
 const noDisintegrations=dagobahEnabled()&&source==='table'&&card.subType==='Rebel'&&cardAbility(card)>2&&battleSession&&dagoEffects('Light:1785').some(effect=>battleSession.participants[PremiereGame.otherSide(effect.card.owner??effect.card.side)]?.some(PremiereUnits.bountyHunter));
 const bountyHunters=noDisintegrations?PremiereGame.sides.flatMap(actor=>battleSession.participants[actor].filter(PremiereUnits.bountyHunter)):[];
 const result=dagoPassiveBase.owned(card,side,source,site,forfeited);
 if(noDisintegrations)dagoDefer(()=>dagoLoss('Dark',3,'No Disintegrations!',()=>{const hunters=bountyHunters.filter(card=>dagoEntry(card));if(hunters.length&&dagoUnits().some(entry=>/darth vader/.test(dagoTitle(entry.card))))dagoPrompt('Light',card,'NoDisintegrations',hunters.map((hunter,i)=>({args:[i],card:hunter,label:hunter.name+' verlieren'})),choice=>{const entry=dagoEntry(choice.card);state.pendingCardView=null;if(entry)loseTableCard(entry.side,entry.slot,entry.card);return true;});}));
 return result;
};
PremiereGame.retrieveForce=function(gameState,side,count){const cards=dagoPassiveBase.retrieve(gameState,side,count);if(dagobahEnabled()&&gameState===state&&cards.length)queueRuleResponse({kind:'dagobahRetrieved',side,amount:cards.length});return cards;};
hasDeployPresence=function(side,loc){return dagobahEnabled()&&dagoEffects('Light:838',side).some(effect=>state.locations[effect.site]===loc)||dagoPassiveBase.presence(side,loc);};
boardDeployCost=function(card,loc,side,free=false){
 const cost=dagoPassiveBase.board(card,loc,side,free);
 if(!dagobahEnabled()||cost===null||free||card.type!=='Creature')return cost;
 const actual=Math.max(0,cost+dagoDeployModifier(card,side,state.locations.indexOf(loc)));return actual<=forceBudget(side)?actual:null;
};
crewDeployCost=function(card,side,loc){const cost=dagoPassiveBase.crew(card,side,loc);if(!dagobahEnabled())return cost;return loc?.id==='Light:113'&&side===dagoLocationPlayer(state.locations.indexOf(loc),'Dark')&&characterTraits(card).includes('ugnaught')&&isSystem(loc)?0:cost;};
craftDeployCost=function(card,loc,side,pilot=null){
 let cost=dagoPassiveBase.craft(card,loc,side,pilot);if(!dagobahEnabled())return cost;
 if(cost===null&&PremiereUnits.fighter(card)&&(['Light:598','Dark:2343'].includes(loc?.id))&&dagoCanDeploy(card,loc,side)&&(permanentPilotAbility(card)!==null||pilot&&PremiereUnits.accepts(card,pilot,'pilot')))cost=Math.max(0,(card.deploy??0)+dagoDeployModifier(card,side,state.locations.indexOf(loc))+(pilot?crewDeployCost(pilot,side,loc):0));
 if(cost!==null&&card.id==='Dark:1967'&&pilot?.id==='Dark:700')cost=Math.max(0,cost-3);
 return cost;
};
dagoCraftStats=function(card,slot,stats){
 stats=dagoPassiveBase.stats(card,slot,stats);
 if(card.id==='Dark:2598'&&card.dagobahBombingRun!==undefined&&battleSession?.site===slot)stats.power+=2;
 if(card.id==='Dark:906'&&state.locations.some((loc,site)=>loc?.id==='Dark:908'&&PremiereGame.sides.some(actor=>PremiereLocations.presentCards(state,actor,site).some(unit=>unit.subType==='Imperial'&&characterTraits(unit).includes('leader')))))stats.power+=state.locations.filter(loc=>/^executor:/.test(dagoTitle(loc))).length;
 if(card.dagobahDisabledUntil>=state.game.timing.turn)stats.power=0;
 if(dagoEffects('Dark:1221').some(effect=>effect.host===card)&&Number.isFinite(stats.maneuver)){const frame=PremiereGame.responseWindow(state.game);if(frame?.target===card&&frame.interrupt==='tractorBeam'||frame?.shot?.target===card&&/ion/i.test(frame.shot.weapon.name))stats.maneuver=Math.max(0,stats.maneuver-2);}
 return stats;
};
dagoPowerModifier=function(card,side,slot){
 let value=dagoPassiveBase.power(card,side,slot);
 if(squadTrooper(card,side)&&dagoUnits().some(entry=>entry.side===side&&entry.slot===slot&&entry.card.id==='Dark:1538'&&!entry.unavailable&&/^death star:|^executor:/.test(dagoTitle(state.locations[slot]))))value++;
 if(dagoEffects('Light:2089').some(effect=>effect.host===card||effect.target===card))value-=4;
 return value;
};
hothForfeit=function(card,side,slot){let value=dagoPassiveBase.forfeit(card,side,slot);if(!dagobahEnabled())return value;if(characterTraits(card).includes('ugnaught'))for(const [site,loc] of state.locations.entries()){if(loc?.id==='Light:113'&&side===dagoLocationPlayer(site,'Dark')&&PremiereLocations.control(state,side,site,cardAbility)===true)value+=2;if(loc?.id==='Dark:112'&&side===dagoLocationPlayer(site,'Dark')&&PremiereLocations.control(state,PremiereGame.otherSide(side),site,cardAbility)===true)value--;}
 if(card.subType==='Imperial'&&dagoEffects('Light:2089').some(effect=>effect.host===card||effect.target===card))value-=4;
 return value;
};
cardForfeitValueAt=((before)=>function(card,side,slot){return dagobahEnabled()&&dagoSetZeroForfeit(card,side,slot)?0:before(card,side,slot);})(cardForfeitValueAt);
battleDamageOptions=function(side){const options=dagoPassiveBase.damageOptions(side);if(!dagobahEnabled())return options;const needa=activeBattleUnits(side).find(card=>card.id==='Dark:366'&&dagoText(card));return needa?options.filter(option=>option.kind!=='battleForfeit'||option.card===needa||option.card.type!=='Character'||option.hit):options;};
battleDamageAction=function(side,kind,args){
 const x=battleSession,card=kind==='battleForfeit'&&x?.participants[side]?.[args[0]],debt=x?.damage?.debt[side],retain=dagobahEnabled()&&card&&debt?.hits.includes(card)&&dagoEffects('Dark:1934').length?debt.attrition:null;
 const result=dagoPassiveBase.damageAction(side,kind,args);if(result&&retain!==null)debt.attrition=retain;return result;
};
dagoTravel=function(card,side,from,to,react,next){
 const moves=dagoPassiveBase.travel(card,side,from,to,react,next);if(!dagobahEnabled())return moves;
 return moves;
};
dagoUnitOptions=function(side){
 let options=dagoPassiveBase.characters(side);if(!dagobahEnabled())return options;
 options=options.filter(option=>!(option.card.id==='Light:2865'&&option.mode==='dago:unitSearch'));
 for(const [index,entry] of dagoUnits().entries())if(entry.side===side&&!entry.unavailable&&dagoText(entry.card)){
  const hope=entry.card.attachments?.find(card=>card.id==='Light:2873'&&dagoText(card));
  if(entry.card.id==='Light:2865'&&hope&&dagoOwn(side).deck.some(card=>/levitation/.test(dagoTitle(card))))options.push(dagoOption(entry.card,'hope',[index],'Yoda’s Hope verlieren: Levitation suchen',{resolve(){const effect=dagoEffects('Light:2873').find(effect=>effect.card===hope);if(effect)hothCancelEffect(effect);else{entry.card.attachments.splice(entry.card.attachments.indexOf(hope),1);loseOwnedCard(hope,side);}dagoSearch(side,entry.card,'deck',card=>/levitation/.test(dagoTitle(card)));return true;}}));
  if(entry.card.id==='Dark:2598'&&state.activeSide===side&&forceBudget(side)>=1)for(const [mineSite,mines] of Object.entries(state.locationWeapons??{}))for(const [mineIndex,mine] of mines.entries())if(Number(mineSite)===entry.slot&&/orbital mine/.test(dagoTitle(mine)))for(const destination of ['hand','lost'])options.push(dagoOption(entry.card,'defuse',[index,mineIndex,destination],mine.name+' → '+destination,{cost:1,resolve(){spendForce(side,1);mines.splice(mines.indexOf(mine),1);dagoOwn(mine.owner??mine.side)[destination].push(mine);return true;}}));
 }
 return options;
};
hothResponseOptions=function(side,window){
 const out=dagoPassiveBase.responses(side,window);if(!dagobahEnabled()||!window||window.cancelled)return out;
 if(window.kind==='dagobahTargetTotal'&&window.target.dagobahCrazyDestiny?.side===side&&!window.dagobahCrazyApplied)out.push({kind:'hothAbility',ability:'dago:targetTotalPlus',card:window.target,index:-1,args:[-1,'dago:targetTotalPlus'],label:'They’d Be Crazy · Destiny-Gesamtsumme '+window.total+' → '+(window.total+2)});
 if(window.kind==='drain'&&window.side===side)for(const [index,entry] of dagoUnits().entries())if(entry.side===side&&entry.slot===window.site&&!entry.unavailable&&entry.card.weapons?.some(card=>card.id==='Dark:1961')&&!window.dagobahBombers?.includes(entry.card))state.locations.forEach((loc,to)=>{if(isSite(loc)&&PremiereLocations.conditions(state,to,side).interior&&dagoSystemSlot(to)===window.site&&!loc.collapsed)out.push({kind:'hothAbility',ability:'dago:orbitalBombs',card:entry.card,index:-1,args:[-1,'dago:orbitalBombs',index,to],to,entry,label:'Proton Bombs · '+loc.name+' bombardieren'});});
 return out;
};
hothRespond=function(side,option,window){
 if(!dagobahEnabled())return dagoPassiveBase.respond(side,option,window);
 if(option.ability==='dago:targetTotalPlus'){window.total+=2;window.dagobahCrazyApplied=true;window.passes=0;window.priority=PremiereGame.otherSide(side);return true;}
 if(option.ability==='dago:orbitalBombs'){
  (window.dagobahBombers??=[]).push(option.entry.card);drawDestinySeries(side,'orbitalBombardment',1,0,draws=>{if(draws.length&&PremiereBattle.total(draws)>4)hothCollapseSite(option.to);});return true;
 }
 return dagoPassiveBase.respond(side,option,window);
};

const dagoLandedBefore=landedAt;
landedAt=function(card,slot){return dagobahEnabled()&&card.dagobahBombingRun!==undefined?false:dagoLandedBefore(card,slot);};

const dagoFurther={deployWeapon:weaponDeployCost,highest:highestInterruptCharacters,creatureActions,prey:creaturePrey,deviceActions:dagoUtilityOptions,traits:characterTraits,unitActions:dagoUnitOptions,oldEffects:locationEffectOptions,newEffects:dagoEffectOptions,move:moveCharacterFor,responses:hothResponseOptions,respond:hothRespond,stats:craftStats,falcon:falconModificationBonus};
weaponDeployCost=function(weapon,host){
 if(dagobahEnabled()&&!PremiereWeapons.disarmed(host)){
  if(weapon.id==='Dark:1327'&&host.id==='Dark:1244')return 2;
  if(weapon.id==='Dark:303'&&['Dark:1967','Dark:2597'].includes(host.id))return 1;
 }
 return dagoFurther.deployWeapon(weapon,host);
};
highestInterruptCharacters=function(side){if(!dagobahEnabled())return dagoFurther.highest(side);const all=PremiereLocations.activeCards(state,side).filter(card=>card.type==='Character'&&!card.undercover&&cardAbility(card)>0&&!dagoEffects('Light:2800').some(effect=>effect.target===card)),best=Math.max(0,...all.map(cardAbility));return all.filter(card=>cardAbility(card)===best);};
creatureActions=function(side){const offers=dagoFurther.creatureActions(side);return dagobahEnabled()?offers.filter(offer=>dagoCanInitiate(side,offer.site,'battle')):offers;};
creaturePrey=function(entry){return dagobahEnabled()&&!dagoCanInitiate(entry.side,entry.slot,'battle')?[]:dagoFurther.prey(entry);};
characterTraits=function(card){const traits=dagoFurther.traits(card);return dagobahEnabled()&&card.attachments?.some(device=>device.id==='Light:2104'&&dagoText(device))&&!traits.includes('thief')?traits.concat('thief'):traits;};
dagoUtilityOptions=function(side){
 const out=dagoFurther.deviceActions(side);
 for(const [index,record] of (state.hothFusionPower??[]).entries())if(record.device.id==='Light:1926'&&(record.device.owner??record.device.side)===side)out.push(dagoOption(record.device,'fusionOff',[index],'Droid-Verstärkung aufheben',{resolve(){state.hothFusionPower.splice(state.hothFusionPower.indexOf(record),1);return true;}}));
 return out;
};
function dagoUtinniAllowed(card,site,...targets){return card.subType!=='Utinni'||/\bdagobah\b/i.test(card.gametext??'')||!DagobahRules.dagobah(state.locations[site])&&targets.every(target=>!target||!DagobahRules.dagobah(state.locations[dagoEntry(target)?.slot]));}
function dagoPromoted(card){return card?.attachments?.some(effect=>effect.id==='Dark:937'&&dagoText(effect));}
locationEffectOptions=function(side,index){return dagoFurther.oldEffects(side,index).filter(offer=>!dagobahEnabled()||dagoUtinniAllowed(offer.card,offer.args[1],typeof offer.target==='object'?offer.target:null)&&!(dagoPromoted(offer.target)&&/demotion|report to lord vader|what is thy bidding/.test(dagoTitle(offer.card))));};
dagoEffectOptions=function(side,window=null){return dagoFurther.newEffects(side,window).filter(offer=>dagoUtinniAllowed(offer.card,offer.site,offer.host,typeof offer.target==='object'?offer.target:null)&&!(dagoPromoted(offer.target)&&['Light:2089','Light:2800'].includes(offer.card.id)));};
function dagoNeedaTarget(effect,needa,side){
 const entry=dagoEntry(needa),target=effect.card.migTarget??effect.target;
 if(!entry||!target||target===needa||typeof target!=='object'||target.type!=='Character'||(target.controller??target.owner??target.side)!==side||!dagoUtinniAllowed(effect.card,effect.site,needa))return false;
 if(effect.card.id==='Light:2863')return true;
 if(effect.card.id==='Dark:1857')return needa.subType==='Imperial';
 if(effect.card.id==='Dark:1673')return sitePlanet(state.locations[entry.slot])===sitePlanet(state.locations[effect.site]);
 if(effect.card.id==='Light:2089')return !dagoPromoted(needa)&&state.battledCardsThisTurn?.includes(needa);
 if(effect.card.id==='Light:2800')return !dagoPromoted(needa)&&/\bemperor\b/i.test(needa.lore??'');
 return false;
}
dagoUnitOptions=function(side){
 const out=dagoFurther.unitActions(side),effects=[...(state.tableEffects??[]),...Object.entries(state.locationEffects??{}).flatMap(([site,row])=>row.map(effect=>({...effect,site:Number(site)})))];
 for(const [index,entry] of dagoUnits().entries())if(entry.side===side&&entry.card.id==='Dark:366'&&!entry.unavailable&&dagoText(entry.card))for(const [target,effect] of effects.entries())if(dagoNeedaTarget(effect,entry.card,side))out.push(dagoOption(entry.card,'needaRetarget',[index,target],effect.card.name+' auf Needa umlenken',{resolve(){const original=Number.isInteger(effect.site)?state.locationEffects[effect.site].find(e=>e.card===effect.card):effect;if(original.card.migTarget)original.card.migTarget=entry.card;else original.target=entry.card;return true;}}));
 return out;
};
falconModificationBonus=function(card,slot){const amount=dagoFurther.falcon(card,slot);return dagobahEnabled()&&state.dagobahDoubleModTurn===state.game.timing.turn?amount*2:amount;};
craftStats=function(card,slot,...rest){const stats=dagoFurther.stats(card,slot,...rest);if(dagobahEnabled()&&state.dagobahDoubleModTurn===state.game.timing.turn){const modifiers=(card.attachments??[]).filter(effect=>effect.id==='Light:2325');for(const effect of modifiers){const rule=effect.hullStat;if(rule==='armor'&&Number.isFinite(stats.armor))stats.armor+=2;else if(Number.isFinite(stats.maneuver))stats.maneuver+=2;}}return stats;};
moveCharacterFor=function(side,from,index,to,kind){
 const card=dagoOwn(side).board[from]?.[index];
 if(!dagobahEnabled()||!card?.occupants?.some(entry=>entry.role==='claw'))return dagoFurther.move(side,from,index,to,kind);
 if(!movementOptionsFor(side).some(offer=>offer.from===from&&offer.index===index&&offer.to===to&&(!kind||offer.kind===kind)))return false;
 withShipWeaponResponse({kind:'dagobahBeforeMove',side,card,site:from,to},()=>{const current=dagoOwn(side).board[from].indexOf(card);if(current>=0)dagoFurther.move(side,from,current,to,kind);});return true;
};
hothResponseOptions=function(side,window){
 const out=dagoFurther.responses(side,window);if(!dagobahEnabled()||!window)return out;
 for(const [index,entry] of dagoUnits().entries())if(entry.card.concealed&&(entry.card.owner??entry.card.side)===side&&dagoClawParent(entry.card))out.push({kind:'hothAbility',ability:'dago:unclaw',card:entry.card,index:-1,args:[-1,'dago:unclaw',index],label:entry.card.name+' · Landing Claw lösen',entry});
 return out;
};
hothRespond=function(side,option,window){
 if(!dagobahEnabled()||option.ability!=='dago:unclaw')return dagoFurther.respond(side,option,window);
 const ship=option.card,parent=dagoClawParent(ship),entry=dagoEntry(parent);if(!entry)return false;
 const at=parent.occupants.findIndex(occupant=>occupant.card===ship);if(at<0)return false;parent.occupants.splice(at,1);delete ship.concealed;delete ship.dagobahClawParentId;dagoOwn(side).board[entry.slot].push(ship);window.passes=0;window.priority=PremiereGame.otherSide(side);return true;
};

function dagoSendUsed(entry){
 const root=entry.card;if(!detachTableCard(entry.side,entry.slot,root))return false;
 PremiereUnits.remove(root,unit=>{
  const registered=state.tableEffects?.find(effect=>effect.card===unit);
  if(registered){dagoReleaseSupport(registered);state.tableEffects.splice(state.tableEffects.indexOf(registered),1);}
  if(unit===root)dagoOwn(unit.owner??entry.side).used.push(unit);else loseOwnedCard(unit,entry.side);
 },unit=>loseOwnedCard(unit,entry.side));return true;
}
const dagoEndHooks={owned:loseOwnedCard,actions:dagoActionOptions,units:dagoUnitOptions,draws:battleDestinyDrawCount,immunity:dagoImmunity};
loseOwnedCard=function(card,side,...args){const bottom=dagobahEnabled()&&state.dagobahBottomLossIds?.has(card.instanceId),result=dagoEndHooks.owned(card,side,...args);if(bottom){const lost=dagoOwn(card.owner??card.side??side).lost,index=lost.indexOf(card);if(index>=0){lost.splice(index,1);lost.unshift(card);}state.dagobahBottomLossIds.delete(card.instanceId);}return result;};
dagoSetZeroForfeit=function(card,side,slot){return (state.dagobahForfeitSuppression??[]).some(record=>record.target===card.instanceId&&dagoUnits().some(entry=>entry.card.instanceId===record.source&&entry.side!==side&&entry.slot===slot&&!entry.unavailable&&dagoText(entry.card)&&PremiereLocations.presentAt(entry,slot)));};
dagoUnitOptions=function(side){
 const out=dagoEndHooks.units(side);
 for(const [index,entry] of dagoUnits().entries())if(entry.side===side&&!entry.unavailable&&dagoText(entry.card)){
  if(['Dark:308','Dark:700'].includes(entry.card.id)&&PremiereLocations.presentAt(entry,entry.slot))for(const [target,other] of dagoUnits().entries())if(other.side!==side&&other.slot===entry.slot&&!other.unavailable&&PremiereLocations.presentAt(other,entry.slot)&&(entry.card.id==='Dark:308'?/chewbacca/:/han solo/).test(dagoTitle(other.card))){
   const existing=(state.dagobahForfeitSuppression??[]).find(record=>record.source===entry.card.instanceId&&record.target===other.card.instanceId);
   out.push(dagoOption(entry.card,'forfeitSuppression',[index,target,!!existing],other.card.name+(existing?' · Forfeit wieder freigeben':' · Forfeit auf 0 setzen'),{resolve(){if(existing)state.dagobahForfeitSuppression.splice(state.dagobahForfeitSuppression.indexOf(existing),1);else(state.dagobahForfeitSuppression??=[]).push({source:entry.card.instanceId,target:other.card.instanceId});return true;}}));
  }
  if(entry.card.id==='Dark:634'&&state.locations[entry.slot]?.id==='Dark:912'&&side===dagoLocationPlayer(entry.slot,'Dark')&&PremiereLocations.occupy(state,PremiereGame.otherSide(side),entry.slot,cardAbility)!==true&&PremiereLocations.presentCards(state,side,entry.slot).filter(card=>card.type==='Character').length===1&&battleSession&&state.locations[battleSession.site]?.subType==='System'&&!PremiereGame.wasUsed(state.game,'turn','dagoMeditationChamber'))out.push(dagoOption(entry.card,'meditationAbility',[index,battleSession.site],'Vaders Ability für Battle Destiny einsetzen',{resolve(){PremiereGame.useOnce(state.game,'turn','dagoMeditationChamber');state.dagobahMeditationProjection={source:entry.card.instanceId,site:battleSession.site,turn:state.game.timing.turn};return true;}}));
 }
 return out;
};
dagoActionOptions=function(side){
 const out=dagoEndHooks.actions(side);
 if(!dagobahEnabled()||state.pendingCardView||state.pendingForceLoss||PremiereGame.responseWindow(state.game))return out;
 const battle=battleSession;
 if(battle?.damage?.priority===side&&battle.damage.debt[side].attrition>0&&!PremiereGame.wasUsed(state.game,'turn','dagoHutRelief'))for(const [site,loc] of state.locations.entries())if(loc?.id==='Light:603'&&side===dagoLocationPlayer(site,'Light')&&battle.site!==site&&PremiereLocations.occupy(state,PremiereGame.otherSide(side),site,cardAbility)!==true&&PremiereLocations.presentCards(state,side,site).some(card=>card.id==='Light:2865'))out.push(dagoOption(loc,'hutRelief',[site],'Yoda’s Hut · Attrition an anderem Ort −2',{resolve(){PremiereGame.useOnce(state.game,'turn','dagoHutRelief');battle.damage.debt[side].attrition=Math.max(0,battle.damage.debt[side].attrition-2);return true;}}));
 return out;
};
battleDestinyDrawCount=function(side,site,ability,...args){
 if(dagobahEnabled()){
  const projection=state.dagobahMeditationProjection;
  if(projection?.turn===state.game.timing.turn&&projection.site===site){const source=dagoUnits().find(entry=>entry.card.instanceId===projection.source&&!entry.unavailable);if(source?.side===side&&state.locations[source.slot]?.id==='Dark:912')ability+=cardAbility(source.card);}
 }
 return dagoEndHooks.draws(side,site,ability,...args);
};
dagoImmunity=function(side,card,slot){
 let result=dagoEndHooks.immunity(side,card,slot);
 if(dagoEffects('Dark:918').length&&card.attachments?.some(test=>test.dagobahJediTest===4||test.dagobahJediTest===5)&&!card.attachments?.some(effect=>effect.id==='Light:2872')){
  const attachments=card.attachments;card.attachments=attachments.filter(test=>!test.dagobahJediTest);try{result=dagoEndHooks.immunity(side,card,slot);}finally{card.attachments=attachments;}
 }
 return result;
};

const dagoDrainBefore=resolveForceDrain;
resolveForceDrain=function(side,site,bonus){
 if(!dagobahEnabled())return dagoDrainBefore(side,site,bonus);
 const plan=forceDrainEffects(side,site);if(!plan){const item=currentDrainExplanation(side,site);if(item){item.status='canceled';item.reason='Drain nach Antworten nicht mehr zulässig (Presence oder Standortregel).';log(item.reason);}return;}
 const amount=drainAmount(plan,bonus),weapons=plan.weapons.slice(0,bonus);
 for(const {host,weapon} of weapons)if(weapon)PremiereUnits.recordWeaponUse(state,host,weapon);
 const finish=()=>{resolvedDrainExplanation(side,site,plan,bonus);const fromReserve=PremiereLocations.entries(state,side).find(entry=>!entry.unavailable&&(entry.slot===site||adjacentSites(entry.slot,site))&&activeCardRules(entry.card,'drainFromReserve').length);log(side+' führt Force Drain '+amount+' bei '+state.locations[site].name+' aus.');beginForceLoss(PremiereGame.otherSide(side),amount,{locationIndex:site,reason:'drain',...(fromReserve?{from:'deck',fromSource:V3DrainTrace.ref(fromReserve.card)}:{})});};
 if(weapons.some(item=>item.weapon&&/lightsaber/i.test(item.weapon.name)))withShipWeaponResponse({kind:'dagobahDrainEnhanced',side,site,weapons,amount},finish);else finish();
};

function dagoOriginalEffect(effect){return Number.isInteger(effect.site)?state.locationEffects[effect.site]?.find(item=>item.card===effect.card):effect;}
function dagoSmugglerMission(effect){
 const target=dagoEntry(effect.target),ship=effect.target?.type==='Starship'?effect.target:target?.carriers.find(card=>card.type==='Starship');if(!ship)return false;
 return (ship.occupants??[]).some(entry=>entry.role==='pilot'&&dagoText(entry.card)&&entry.card.attachments?.some(card=>card.id==='Light:2141'&&dagoText(card))&&entry.card.attachments?.some(card=>card.id==='Light:2286'&&dagoText(card)));
}
function dagoMissionRetrieve(effect,count,next){
 const side=effect.card.owner??effect.card.side,original=dagoOriginalEffect(effect);
 const apply=hand=>{const retrieved=PremiereGame.retrieveForce(state,side,count),z=dagoOwn(side);if(hand)for(const card of retrieved){const index=z.used.indexOf(card);if(index>=0){z.used.splice(index,1);z.hand.push(card);}}if(original)delete original.dagobahRetrieving;next();};
 if(!dagoSmugglerMission(effect)||count<=0||!dagoOwn(side).lost.length){apply(false);return;}
 if(original)original.dagobahRetrieving=true;
 dagoPrompt(side,effect.card,'MissionRetrieval',[{args:['hand'],label:'Smuggler’s Blues · zurückgeholte Karten auf die Hand'},{args:['used'],label:'Regulär auf die Used Pile zurückholen'}],choice=>{state.pendingCardView=null;apply(choice.args[0]==='hand');return true;});
}
const dagoMissionBefore=retrieveLocationMission;
retrieveLocationMission=function(site,effect,count){return dagobahEnabled()&&effect.card.id==='Light:1429'?dagoMissionRetrieve({...effect,site},count,()=>cancelLocationEffect(site,effect)):dagoMissionBefore(site,effect,count);};

function dagoShipCaptured(ship,side){
 for(const effect of state.tableEffects.filter(effect=>effect.card.id==='Dark:1221'&&effect.host===ship)){
  hothCancelEffect(effect);dagoDefer(()=>dagoLoss(side,/millennium falcon/.test(dagoTitle(ship))?5:3,'I Want That Ship'));
 }
}
const dagoPilotTiming=dagoEffectTiming;
dagoEffectTiming=function(event,tasks){
 dagoPilotTiming(event,tasks);
 if(event!=='phase:start'||state.phase!==4)return;
 const side=state.activeSide;
 for(const effect of dagoEffects('Dark:1115').filter(effect=>effect.pilotMode&&(effect.host.controller??effect.host.owner??effect.host.side)===side))tasks.push(done=>{
  const target=dagoEntry(effect.host);if(!target||target.unavailable){done();return;}
  const moves=movementOptionsFor(side).filter(offer=>offer.card===effect.host).map(offer=>({kind:'move',args:[offer.from,offer.index,offer.to,offer.kind],label:state.locations[offer.to].name+' · '+offer.cost+' Force'}));
  moves.push(...transportOptions(side).filter(offer=>offer.card===effect.host&&!['role','swap','deployAboard','dock'].includes(offer.args[0])).map(offer=>({kind:'transport',args:offer.args,label:offer.label})));
  const choices=moves.map((move,index)=>({args:['move',index],label:move.label})).concat({args:['lose'],label:effect.host.name+' verlieren'},{args:['force'],label:'1 Force verlieren'});
  dagoPrompt(side,effect.card,'NotReady',choices,choice=>{
   state.pendingCardView=null;
   if(choice.args[0]==='force'){dagoLoss(side,1,'He Is Not Ready',done);return true;}
   if(choice.args[0]==='lose')loseTableCard(target.side,target.slot,target.card);
   else{const move=moves[choice.args[1]];if(!(move.kind==='move'?moveCharacterFor(side,...move.args):performTransport(side,...move.args)))return false;}
   if(state.pendingCardView||state.pendingForceLoss||PremiereGame.responseWindow(state.game))dagoDefer(done);else done();return true;
  });
 });
};

function dagoExecutorMover(){const site=state.locations.findIndex(loc=>loc?.id==='Dark:908');if(site<0)return null;const side=dagoLocationPlayer(site,'Light');return PremiereLocations.control(state,side,site,cardAbility)===true?side:null;}
const dagoMovementHooks={actions:dagoActionOptions,allowed:dagoActionAllowed,travel:dagoTravel,transport:transportOptions,board:boardDeployCost,effects:dagoEffectOptions};
dagoActionAllowed=function(action){
 if(!dagoMovementHooks.allowed(action))return false;
 if(state.phase===4&&action.card?.id==='Dark:906'&&['move','transport','react'].includes(action.kind)){const mover=dagoExecutorMover();if(mover&&state.activeSide!==mover&&action.side!==mover)return false;}
 return true;
};
dagoActionOptions=function(side){
 const out=dagoMovementHooks.actions(side);if(!dagobahEnabled()||state.phase!==4||state.activeSide===side||dagoExecutorMover()!==side||battleSession||state.pendingCardView||state.pendingForceLoss||PremiereGame.responseWindow(state.game))return out;
 const entry=dagoUnits().find(entry=>entry.card.id==='Dark:906'&&!entry.unavailable);if(!entry||regularMovementUsed(entry.card))return out;
 state.locations.forEach((loc,to)=>{for(const move of travelOptions(entry.card,side,entry.slot,to))if(move.cost<=forceBudget(side))out.push(dagoOption(state.locations.find(loc=>loc?.id==='Dark:908'),'moveExecutor',[to,move.kind],'Executor → '+loc.name+' ('+move.cost+' Force)',{cost:move.cost,from:entry.slot,to,resolve(){
  const relocate=()=>{if(!dagoEntry(entry.card))return;spendForce(side,move.cost);detachTableCard(entry.side,entry.slot,entry.card);dagoOwn(entry.side).board[to].push(entry.card);(state.movedThisTurn??=[]).push(entry.card);hothMoved(entry.side,entry.card,entry.slot,to);};
  withShipWeaponResponse({kind:'dagobahBeforeMove',side,card:entry.card,site:entry.slot,to},relocate);return true;
 }}));});return out;
};
dagoTravel=function(card,side,from,to,react,next){
 const options=dagoMovementHooks.travel(card,side,from,to,react,next),a=state.locations[from],b=state.locations[to];
 if(!react&&state.phase===4&&['Character','Vehicle'].includes(card.type)&&from!==to&&/^executor:/.test(dagoTitle(a))&&/^executor:/.test(dagoTitle(b))&&[from,to].some(site=>state.locations[site].id==='Dark:911'&&dagoTransferFree(side,site))&&!movementPrevented(card)&&dagoMoveAllowed(side,card,from,to,'Executor-Corridor'))return [{kind:'Executor-Corridor',cost:0}];
 return options;
};
transportOptions=function(side){return dagoMovementHooks.transport(side).map(option=>dagobahEnabled()&&option.args[0]!=='deployAboard'&&[option.from,option.to].some(site=>Number.isInteger(site)&&dagoTransferFree(side,site))?{...option,cost:0}:option);};
function dagoGenericAllowed(card,site){
 if(!card.genericLimit)return true;
 const key=slot=>{const loc=state.locations[slot],system=dagoSystemSlot(slot);return system>=0?'planet:'+dagoTitle(state.locations[system]):sitePlanet(loc)?'planet:'+sitePlanet(loc):'host:'+(loc?.hostInstanceId??slot);};
 const place=key(site),entries=dagoUnits().map(entry=>({card:entry.card,site:entry.slot})).concat(Object.entries(state.locationEffects??{}).flatMap(([slot,effects])=>effects.map(effect=>({card:effect.card,site:Number(slot)}))));
 return entries.filter(entry=>dagoTitle(entry.card)===dagoTitle(card)&&key(entry.site)===place).length<card.genericLimit;
}
boardDeployCost=function(card,loc,side,free=false){return dagobahEnabled()&&!dagoGenericAllowed(card,state.locations.indexOf(loc))?null:dagoMovementHooks.board(card,loc,side,free);};
dagoEffectOptions=function(side,window=null){return dagoMovementHooks.effects(side,window).filter(option=>dagoGenericAllowed(option.card,option.site));};

function dagoRetargetAllowed(effect,entry,sameForce=true){
 const previous=effect.card.migTarget??effect.target,card=entry.card,loc=state.locations[entry.slot],owner=effect.card.owner??effect.card.side;
 if(!previous||typeof previous!=='object'||card===previous||entry.unavailable||sameForce&&entry.side!==(previous.controller??previous.owner??previous.side)||!dagoUtinniAllowed(effect.card,effect.site,card))return false;
 const mission=locationEffectRule(effect.card)?.mission;
 if(mission&&mission!=='tactical-recall')return missionTargets(mission,owner).some(target=>target.target===card);
 switch(effect.card.id){
  case 'Dark:1401':return card.subType==='Alien';
  case 'Dark:2397':return card.type==='Character'&&card.warrior&&state.battledCardsThisTurn?.includes(card);
  case 'Light:2563':return card.id==='Dark:654';
  case 'Dark:2330':return card.captured===true;
  case 'Light:2530':return card.id==='Light:1665'&&sitePlanet(loc)==='hoth';
  case 'Dark:650':return entry.side!==owner&&PremiereUnits.hasSkill(card,'smuggler');
  case 'Dark:1673':return card.type==='Character'&&sitePlanet(loc)===sitePlanet(state.locations[effect.site]);
  case 'Dark:2098':return entry.side!==owner&&card.type==='Character'&&(card.subType==='Rebel'&&(card.forfeit??0)>4||characterTraits(card).includes('leader'));
  case 'Dark:2572':return card.type==='Character'&&characterTraits(card).includes('female');
  case 'Dark:2772':return card.type==='Weapon'&&entry.carriers.some(host=>host.type==='Vehicle'||PremiereUnits.fighter(host));
  case 'Light:151':return entry.side!==owner&&PremiereUnits.capital(card);
  case 'Light:2089':return card.subType==='Imperial'&&!dagoPromoted(card)&&state.battledCardsThisTurn?.includes(card);
  case 'Light:2143':return PremiereUnits.fighter(card)&&entry.slot===dagoSystemSlot(effect.site);
  case 'Light:2800':return card.type==='Character'&&!dagoPromoted(card)&&/\bemperor\b/i.test(card.lore??'');
  case 'Dark:918':return entry.side!==owner&&card.dagobahApprentice===true&&DagobahRules.dagobah(loc);
  default:return false;
 }
}
function dagoRelocateEffectAllowed(effect,to){
 const card=effect.card,loc=state.locations[to],owner=card.owner??card.side,rule=locationEffectRule(card),text=dagoTitle(loc);
 if(loc.collapsed||loc.blownAway||/may not be moved/i.test(card.gametext??'')||!dagoUtinniAllowed(card,to,effect.target))return false;
 if(rule?.mission){
  if(['death-star-plans','plastoid-armor','cell2187'].includes(rule.mission))return sitePlanet(loc)==='death star'&&!PremiereLocations.conditions(state,to,owner).dockingBay;
  if(rule.mission==='kessel-run')return isPlanetSystem(loc)&&text==='kessel'&&!kesselRunBlocked(to);
  if(rule.mission==='desperate-hour')return isPlanetSystem(loc)&&text==='alderaan';
  if(['necklace','tactical-recall'].includes(rule.mission))return sitePlanet(loc)==='yavin 4';
  if(rule.mission==='breath-mask'||rule.mission==='luke-recall')return sitePlanet(loc)==='tatooine';
  if(rule.mission==='detachment')return sitePlanet(loc)==='tatooine'&&!PremiereLocations.conditions(state,to,owner).dockingBay;
  if(rule.mission==='lateral-damage')return isSystem(loc);
  if(rule.mission==='yerka-mig')return true;
 }
 if(rule?.nightfall)return isPlanetSystem(loc);
 if(rule?.darkWaters)return isExteriorPlanetSite(loc)&&sitePlanet(loc)!=='hoth'||isSite(loc)&&loc.locationTags?.includes('Interior')&&!!loc.hostInstanceId;
 if(rule?.iconBonus||rule?.imperialJustice)return true;
 if(rule?.siteDevice)return isSite(loc)&&(!rule.exactSite||text===rule.exactSite)&&(!rule.requiredTag||loc.locationTags?.includes(rule.requiredTag))&&(!rule.deployRegion||sitePlanet(loc)===rule.deployRegion);
 if(rule?.sentryRegion)return sitePlanet(loc)===rule.sentryRegion;
 if(rule?.beggar)return sitePlanet(loc)==='tatooine'&&isExteriorPlanetSite(loc);
 if(rule?.expandsText)return isSite(loc);
 if(rule?.rebelPlanners)return text==='yavin 4: massassi war room'||PremiereLocations.conditions(state,to,owner).dockingBay;
 switch(card.id){
  case 'Light:150':return DagobahRules.asteroid(loc)&&PremiereLocations.control(state,owner,to,cardAbility)===true;
  case 'Light:151':return DagobahRules.asteroid(loc);
  case 'Light:2143':return dagoTitle(loc)==='big one'&&dagoEntry(effect.target)?.slot===dagoSystemSlot(to);
  case 'Light:838':return isExteriorPlanetSite(loc)&&PremiereLocations.presentCards(state,owner,to).some(unit=>['Rebel','Alien'].includes(unit.subType));
  case 'Light:1808':case 'Dark:1253':return isSite(loc);
  case 'Light:2741':return true;
  case 'Dark:2721':return ['executor: holotheatre','death star: conference room'].includes(text);
  case 'Dark:299':return isExteriorPlanetSite(loc)&&!DagobahRules.dagobah(loc);
  case 'Dark:554':return DagobahRules.cave(loc)&&!!dagoSlugForCave(to);
  case 'Dark:918':return text==='dagobah: cave';
  case 'Dark:650':case 'Dark:1673':return isExteriorPlanetSite(loc)&&(card.id!=='Dark:1673'||sitePlanet(loc)===sitePlanet(state.locations[dagoEntry(effect.target)?.slot]));
  case 'Dark:2098':return /war room/.test(text)&&['hoth','yavin 4'].includes(sitePlanet(loc));
  case 'Dark:2772':return PremiereLocations.conditions(state,to,owner).dockingBay;
  case 'Light:2530':return isSystem(loc)&&locationGroup(loc)!=='hoth';
  case 'Dark:651':case 'Light:2800':return isSystem(loc);
  case 'Dark:1270':return true;
  case 'Light:805':return loc.id==='Light:5586';
  case 'Light:889':return /war room/.test(text)&&(loc.owner??loc.side)===owner;
  case 'Light:1241':case 'Dark:1240':return to===HothRules.markerExtremes(state).outer;
  case 'Dark:2541':return /hoth: echo docking bay/.test(text);
  default:return false;
 }
}
function dagoInterruptRetargetAllowed(frame,entry){
 if(entry.unavailable||entry.card===frame.target||entry.side!==(frame.target.controller??frame.target.owner??frame.target.side))return false;
 const own=dagoOwn(frame.side),added=!own.hand.includes(frame.card),budget=forceBudget;if(added)own.hand.push(frame.card);
 forceBudget=function(side){return budget(side)+(side===frame.side?frame.cost??0:0);};
 try{return pileInterruptOptions(frame.side).concat(hothInterruptOptions(frame.side)).some(offer=>offer.card===frame.card&&offer.target===entry.card&&offer.mode===frame.mode);}
 finally{forceBudget=budget;if(added)own.hand.splice(own.hand.indexOf(frame.card),1);}
}
function dagoTightForfeit(side,participants,finish){
 let left=2;const show=()=>{const cards=participants[side].filter(card=>dagoEntry(card)&&(card.type==='Vehicle'||PremiereUnits.fighter(card)));if(!left||!cards.length){state.pendingCardView=null;finish();return;}
  dagoPrompt(side,cards[0],'TightForfeit',cards.map((card,i)=>({args:[i],card,label:card.name+' forfeiten'})),choice=>{const entry=dagoEntry(choice.card);loseTableCard(side,entry.slot,entry.card,false,true);left--;show();return true;});
 };show();
}
const dagoFinalHooks={timing:dagoEffectTiming,weaponActions:weaponEffectOptions,finish:finishPileInterrupt,felth:felthMakesUsed,runChoices:epicChoices,runFinish:finishEpicChoice,pullUp:pullUpAttackRun,restrictions:dagoActionAllowed,prompt:hothPromptChoice,attrition:battleAttritionAgainst};
dagoEffectTiming=function(event,tasks){dagoFinalHooks.timing(event,tasks);if(event==='phase:end'&&[3,5].includes(state.phase))tasks.push(done=>withShipWeaponResponse({kind:state.phase===3?'dagobahBattlePhaseEnd':'dagobahDrawPhaseEnd',side:state.activeSide},done));};
weaponEffectOptions=function(side){return dagoFinalHooks.weaponActions(side).filter(offer=>!dagobahEnabled()||offer.args[0]!=='disarm'||!offer.entry.card.attachments?.some(device=>device.id==='Light:2104'&&dagoText(device)));};
felthMakesUsed=function(card){return dagoFinalHooks.felth(card)||dagobahEnabled()&&((card.id==='Dark:2754'&&dagoUnits().some(entry=>entry.card.id==='Dark:551'&&!entry.unavailable&&dagoText(entry.card)&&state.locations[entry.slot]?.locationTags?.includes('Mobile')))||(card.id==='Dark:2399'&&state.locations.some((loc,site)=>loc?.id==='Dark:2013'&&dagoLocationPlayer(site,'Dark')===(card.controller??card.owner??card.side)&&PremiereLocations.occupy(state,PremiereGame.otherSide(card.controller??card.owner??card.side),site,cardAbility)!==true)));};
finishPileInterrupt=function(frame){if(dagobahEnabled())frame.felthUsed??=felthMakesUsed(frame.card);return dagoFinalHooks.finish(frame);};
epicChoices=function(frame){const offers=dagoFinalHooks.runChoices(frame);if(dagobahEnabled()&&frame.mode==='runCover')offers.push(...hothInterruptOptions(frame.side).filter(offer=>offer.attackRun).map((offer,index)=>({args:['dagobahInterrupt',index],card:offer.card,label:offer.label})));return offers;};
finishEpicChoice=function(frame,...args){if(dagobahEnabled()&&frame.mode==='runCover'&&args[0]==='dagobahInterrupt'){const option=hothInterruptOptions(frame.side).filter(offer=>offer.attackRun)[args[1]];if(!option)return false;state.pendingCardView=null;state.attackRun.passes=0;return announceHothInterrupt(frame.side,{...option,resumeAttack:()=>state.attackRun&&showRun('runCover',PremiereGame.otherSide(frame.side))});}return dagoFinalHooks.runFinish(frame,...args);};
pullUpAttackRun=function(success){const run=state.attackRun;if(!dagobahEnabled()||!run?.dagobahTightSqueeze)return dagoFinalHooks.pullUp(success);const side=run.dagobahTightSqueeze.side;delete run.dagobahTightSqueeze;dagoTightForfeit(PremiereGame.otherSide(side),{Light:runSurvivors('Light'),Dark:runSurvivors('Dark')},()=>dagoFinalHooks.pullUp(success));};

function dagoTargetTotal(side,target,total,next){
 if(!Number.isFinite(total)||target.dagobahCrazyDestiny?.turn!==state.game.timing.turn){next(total);return;}
 withShipWeaponResponse({kind:'dagobahTargetTotal',side,target,total},frame=>next(frame?.total??total));
}
const dagoTractorHooks={settle:settleTractorBeam,offers:tractorBeamOptions};
tractorBeamOptions=function(side,window){return dagoTractorHooks.offers(side,window).map(offer=>{
 if(!dagobahEnabled()||!offer.holder)return offer;
 const bay=state.locations.findIndex(loc=>loc?.id==='Dark:2343'&&loc.hostInstanceId===offer.holder.instanceId);
 return bay>=0?{...offer,bay}:offer;
});};
settleTractorBeam=function(frame){
 if(!dagobahEnabled())return dagoTractorHooks.settle(frame);
 drawDestinySeries(frame.side,'tractorBeam',frame.holder?1:2,(frame.hothDestinyBonus??0)+(frame.holder?.id==='Dark:2657'?1:0),draws=>{
  const {card,target,bay,site}=frame,entry=dagoEntry(target),stats=craftStats(target,site);
  if(dagoEffects('Dark:1221').some(effect=>effect.host===target)&&Number.isFinite(stats.maneuver))stats.maneuver=Math.max(0,stats.maneuver-2);
  const defense=PremiereWeapons.defense(target,cardAbility(target),stats);
  dagoTargetTotal(frame.side,target,PremiereBattle.total(draws),total=>{
   if(entry?.slot!==site||entry.unavailable||!Number.isFinite(defense)||!Number.isFinite(total)||total<=defense||!(frame.holder?frame.holder.attachments?.includes(card):deathStarTractorBeams(bay).length))return;
   dagoShipCaptured(target,entry.side);
   if(!tractorShipCrew(target).length){takeStolenTableCard('Dark',card,entry);return;}
   if(!detachTableCard(entry.side,site,target))return;
   target.inactive=true;target.tractorCaptured=true;dagoOwn(entry.side).board[bay].push(target);
   (state.capturedShips??=[]).push({ship:target,bay,site,side:entry.side,beam:card,holder:frame.holder});log(card.name+' hält '+target.name+' bei '+state.locations[bay].name+' fest.');
  });
 });
};

const dagoCombatHooks={detachment:detachmentAttrition,ability:cardAbility,complete:dagoCompleteJedi,continuous:dagoJediContinuous};
detachmentAttrition=function(site,side){let amount=dagoCombatHooks.detachment(site,side);if(!dagobahEnabled()||!battleSession)return amount;const opponent=PremiereGame.otherSide(side);
 if(isSite(state.locations[site])&&activeBattleUnits(opponent).some(card=>card.id==='Dark:308'&&dagoText(card)))amount++;
 if(battleSession.initiator===opponent&&fearPowerAtSite(opponent,site)>0&&dagoUnits().some(entry=>entry.card.id==='Dark:1542'&&!entry.unavailable&&dagoText(entry.card)))amount++;
 return amount;
};
function dagoTrainingRecord(card){return (state.dagobahTrainingRecords??[]).find(record=>record.personas.some(persona=>(card.personas?.length?card.personas:[dagoTitle(card)]).some(name=>name.toLowerCase()===persona)));}
dagoCompleteJedi=function(effect){const records=state.dagobahTrainingRecords??=[],card=effect.apprentice;let record=dagoTrainingRecord(card);if(!record){record={personas:(card.personas?.length?card.personas:[dagoTitle(card)]).map(name=>name.toLowerCase()),ability:0};records.push(record);}record.ability=Math.max(record.ability,DagobahRules.testNumber(effect.card));return dagoCombatHooks.complete(effect);};
cardAbility=function(card){const ability=dagoCombatHooks.ability(card);return dagobahEnabled()&&Number.isFinite(ability)?Math.max(ability,dagoTrainingRecord(card)?.ability??0):ability;};
dagoJediContinuous=function(){dagoCombatHooks.continuous();for(const entry of dagoJediCards())if(dagoTrainingRecord(entry.card)&&!(dagoTrainingRevision()?DagobahRules.jedi(entry.card):/Jedi/.test(entry.card.subType)))entry.card.dagobahApprentice=true;};
function dagobahLocationTextCancelled(gameState,slot){return dagobahEnabled()&&gameState===state&&state.locations[slot]?.id==='Light:672'&&dagoUnits().some(entry=>entry.card.id==='Dark:538'&&!entry.unavailable&&dagoText(entry.card)&&dagoTitle(state.locations[entry.slot])==='death star: detention block corridor');}
hothPromptChoice=function(offers,frame){
 if(!dagobahEnabled()||!frame.mode?.startsWith('hothDag'))return dagoFinalHooks.prompt(offers,frame);
 if(frame.botChoice)return frame.botChoice(offers);
 const value=card=>(card?.power??0)+(card?.ability??0)*1.5+(card?.type==='Character'?3:0)+(card?.type==='Location'?2:0),cards=offers.filter(offer=>offer.card);
 if(['hothDagSearch','hothDagSaber','hothDagTestExchange','hothDagLomUsed','hothDagMissionRetrieval','hothDagArmTransfer'].includes(frame.mode))return cards.sort((a,b)=>value(b.card)-value(a.card))[0]??offers.find(offer=>offer.args[0]==='hand')??offers[0];
 if(frame.mode==='hothDagDarkPath'||frame.mode==='hothDagTightForfeit'||frame.mode==='hothDagFearHand')return cards.sort((a,b)=>value(a.card)-value(b.card))[0];
 if(frame.mode==='hothDagSubstituteDestiny')return offers.find(offer=>offer.args[0]===(frame.card.dagobahDestinyValue>=4?'use':'draw'));
 if(frame.mode==='hothDagTestFiveCard')return offers.slice().sort((a,b)=>(b.args[1]??0)-(a.args[1]??0))[0];
 if(frame.mode==='hothDagAttemptThree')return offers.find(offer=>offer.args[0]==='attempt');
 if(frame.mode==='hothDagNotReady')return offers.find(offer=>offer.args[0]==='move')??offers.find(offer=>offer.args[0]==='force')??offers[0];
 return offers.find(offer=>offer.args[0]==='done')??offers[0];
};

function dagoArmRecipients(side,host,stolen){
 const entry=dagoEntry(host);if(!entry)return [];
 return dagoUnits().filter(other=>other.side===side&&!other.unavailable&&other.card!==host&&other.card.type==='Character'&&PremiereLocations.physicalPlace(other)===PremiereLocations.physicalPlace(entry)&&
  (stolen.type==='Weapon'?weaponDeployCost(stolen,other.card)!==null:matchesRegisteredTarget(other.card,activeCardRules({...stolen,dagobahArmDormant:false},'device')[0]?.targets)));
}
function dagoArmTransfer(side,host,stolen){
 const recipients=dagoArmRecipients(side,host,stolen);if(!recipients.length)return;
 dagoPrompt(side,stolen,'ArmTransfer',recipients.map((entry,i)=>({args:[i],card:entry.card,label:'Kostenlos an '+entry.card.name+' übertragen'})).concat({args:['done'],label:'Am Droiden behalten'}),choice=>{
  state.pendingCardView=null;if(choice.args[0]!=='done'){const source=stolen.type==='Weapon'?host.weapons:host.attachments,index=source.indexOf(stolen);if(index>=0){source.splice(index,1);delete stolen.dagobahArmDormant;(stolen.type==='Weapon'?(choice.card.weapons??=[]):(choice.card.attachments??=[])).push(stolen);}}return true;
 });
}
const dagoArmActions=dagoUtilityOptions;
dagoUtilityOptions=function(side){const out=dagoArmActions(side);if(state.activeSide!==side||state.phase!==2||battleSession)return out;
 for(const [index,entry] of dagoUnits().entries())if(entry.side===side&&!entry.unavailable&&entry.card.attachments?.some(device=>device.id==='Light:2104'&&dagoText(device)))for(const stolen of [...entry.card.weapons??[],...entry.card.attachments??[]].filter(card=>card.dagobahArmStolen))if(dagoArmRecipients(side,entry.card,stolen).length)out.push(dagoOption(stolen,'armTransfer',[index,stolen.instanceId],'Kostenlos vom Droiden übertragen',{resolve(){dagoArmTransfer(side,entry.card,stolen);return true;}}));return out;};

const dagoCreatureStatsHooks={defense:PremiereWeapons.defense,travel:dagoTravel,bolts:boltDeployOptions,emergency:emergencyPlacements,devices:deviceActions,timing:dagoEffectTiming,recirculate};
PremiereWeapons.defense=function(card,ability,stats){if(dagobahEnabled()&&card?.set==='4'&&card.type==='Creature')return Number((card.extraText??[]).join(' ').match(/(?:SLITHER|SWARM|FLIGHT|CAMOUFLAGE|HIDE|HUMP|CLAWS):\s*(\d+)/i)?.[1]??0);return dagoCreatureStatsHooks.defense(card,ability,stats);};
boltDeployOptions=function(side,index){return dagoCreatureStatsHooks.bolts(side,index).filter(offer=>!dagobahEnabled()||offer.host.id!=='Dark:1245');};
emergencyPlacements=function(side,card,...args){return dagoCreatureStatsHooks.emergency(side,card,...args).filter(offer=>!dagobahEnabled()||!activeCardRules(card,'restrainDroid').length||offer.host?.id!=='Dark:1245');};
deviceActions=function(side){return dagoCreatureStatsHooks.devices(side).filter(offer=>!dagobahEnabled()||offer.args[0]!=='transferBolt'||offer.target.card.id!=='Dark:1245');};
dagoTravel=function(card,side,from,to,react,next){
 if(['Light:1719','Dark:1718'].includes(card.id)){
  const a=state.locations[from],b=state.locations[to];
  if(isPlanetSystem(a)&&isExteriorPlanetSite(b)&&dagoSystemSlot(to)===from||isExteriorPlanetSite(a)&&isPlanetSystem(b)&&dagoSystemSlot(from)===to)return [{kind:isPlanetSystem(a)?'Landen':'Starten',cost:1}];
 }
 return dagoCreatureStatsHooks.travel(card,side,from,to,react,next);
};
dagoEffectTiming=function(event,tasks){
 dagoCreatureStatsHooks.timing(event,tasks);
 if(event==='phase:start'&&state.phase===4)for(const effect of dagoEffects('Dark:299',state.activeSide))tasks.push(done=>{
  const choices=state.locations.flatMap((loc,to)=>adjacentSites(effect.site,to)&&isExteriorPlanetSite(loc)?[{args:[to],label:loc.name}]:[]).concat({args:['done'],label:'Bombing Run am bisherigen Ort lassen'});
  dagoPrompt(state.activeSide,effect.card,'MoveBombingRun',choices,choice=>{state.pendingCardView=null;if(choice.args[0]!=='done'){const original=dagoOriginalEffect(effect);state.locationEffects[effect.site].splice(state.locationEffects[effect.site].indexOf(original),1);original.site=choice.args[0];(state.locationEffects[original.site]??=[]).push(original);}done();return true;});
 });
};
recirculate=function(side){if(dagobahEnabled())for(const card of dagoOwn(side).used)delete card.dagobahFaceUp;return dagoCreatureStatsHooks.recirculate(side);};

function dagoCatalog(){return [...new Map([catalog,...[typeof aNewHopeCatalog==='undefined'?null:aNewHopeCatalog,typeof hothCatalog==='undefined'?null:hothCatalog,typeof dagobahCatalog==='undefined'?null:dagobahCatalog].filter(Array.isArray)].flat().map(card=>[card.id,card])).values()];}
function dagoReleaseClaw(ship){const parent=dagoClawParent(ship),entry=parent&&dagoEntry(parent);if(!entry)return;const index=parent.occupants.findIndex(occupant=>occupant.card===ship);if(index<0)return;parent.occupants.splice(index,1);delete ship.concealed;delete ship.dagobahClawParentId;dagoOwn(ship.controller??ship.owner??ship.side).board[entry.slot].push(ship);}
const dagoFinalContinuous={continuous:dagoContinuous,candidates:battleCandidates,theft:theftTargets};
dagoContinuous=function(){dagoFinalContinuous.continuous();for(const entry of dagoUnits().slice())if(entry.card.concealed&&!entry.card.attachments?.some(card=>card.id==='Light:1464'&&dagoText(card)))dagoReleaseClaw(entry.card);};
battleCandidates=function(side,slot){return dagoFinalContinuous.candidates(side,slot).filter(card=>!dagobahEnabled()||![card,...(dagoEntry(card)?.carriers??[])].some(unit=>unit.dagobahDisabledUntil>=state.game.timing.turn));};
theftTargets=function(actor,mode){return dagoFinalContinuous.theft(actor,mode).filter(entry=>!dagobahEnabled()||mode!=='wioslea'||entry.card.id!=='Dark:1245');};

const dagoIgShotBefore=applyWeaponResult;
applyWeaponResult=function(shot,side,slot,...args){const result=dagoIgShotBefore(shot,side,slot,...args);if(dagobahEnabled()&&shot.host?.id==='Dark:1245'&&shot.target.type==='Character'&&['hit','zero'].includes(shot.effect)&&battleSession?.hitUnits?.[side]?.includes(shot.target))shot.target.dagobahHitByIG88=state.game.timing.turn;return result;};

dagoNeedaTarget=function(effect,needa,side){const entry=dagoEntry(needa);return !!entry&&entry.side===side&&dagoRetargetAllowed(effect,entry,false);};

const dagoDormantHooks={rules:activeCardRules,weapon:PremiereUnits.canUseWeapon,device:PremiereUnits.canUseDevice};
activeCardRules=function(card,...args){return dagobahEnabled()&&card?.dagobahArmDormant?[]:dagoDormantHooks.rules(card,...args);};
PremiereUnits.canUseWeapon=function(gameState,host,weapon,...args){return !weapon?.dagobahArmDormant&&dagoDormantHooks.weapon(gameState,host,weapon,...args);};
PremiereUnits.canUseDevice=function(gameState,host,device,...args){return !device?.dagobahArmDormant&&dagoDormantHooks.device(gameState,host,device,...args);};

const dagoRelocationHooks={interrupts:dagoInterruptOptions,group:groupRelocationOptions};
dagoInterruptOptions=function(side,window=null){return dagoRelocationHooks.interrupts(side,window).filter(offer=>!['dago:relocateShip','dago:moveCreature','dago:noCave','dago:hurl'].includes(offer.mode)||dagoRelocationAllowed(offer.entry?.side??side,offer.entry?.card??offer.target,offer.entry?.slot??window?.site,offer.to,offer.mode==='dago:moveCreature'?'Landspeed':'relocate'));};
groupRelocationOptions=function(side){const offers=dagoRelocationHooks.group(side);if(!dagobahEnabled())return offers;return offers.filter(offer=>!DagobahRules.dagobah(state.locations[offer.site])).map(offer=>({...offer,destinations:offer.destinations.filter(to=>!DagobahRules.dagobah(state.locations[to]))})).filter(offer=>offer.destinations.length);};

const dagoRevolutionBefore=revolutionOptions;
revolutionOptions=function(side,index){return dagoRevolutionBefore(side,index).filter(slot=>!dagobahEnabled()||state.locations[slot]?.id!=='Dark:2343');};
