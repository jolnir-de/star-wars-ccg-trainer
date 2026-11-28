'use strict';
const ccBattleKey=()=>battleSession?String(state.game.timing.turn)+':'+battleSession.site+':'+(state.battledSitesThisTurn?.length??0):null;
function ccHasPersona(cards,persona){return cards.some(card=>ccPersona(card,persona));}
ccInterruptProviders.push(({add,card,index,side,enemy,own,all,window})=>{
 const x=battleSession,site=window?.site??x?.site,ours=Number.isInteger(site)?battleCandidates(side,site):[],rival=Number.isInteger(site)?battleCandidates(enemy,site):[],defending=x&&x.initiator!==side;
 const extra=(amount,pile)=>add(card,index,'extraDestiny',[],'+'+amount+' Battle Destiny',{amount,pile});
 if(window?.kind==='battle'){
  if(card.id==='Dark:162'&&window.side===side&&CloudCityRules.cloud(state.locations[site]))extra(1,'Lost');
  if(card.id==='Dark:960'&&window.side!==side&&CloudCityRules.cloud(state.locations[site])&&ours.some(unit=>HothRules.combat(unit)))extra(1,'Lost');
  if(card.id==='Dark:1937'&&window.side!==side&&ours.some(unit=>CloudCityRules.clone(unit)&&unit.type==='Character'))extra(1,'Lost');
  if(card.id==='Light:2571'&&(ccHasPersona(ours,'Leia')&&all.some(entry=>entry.card.captured&&ccPersona(entry.card,'Han')&&entry.slot===site)||ccHasPersona(ours,'Han')&&all.some(entry=>entry.card.captured&&ccPersona(entry.card,'Leia')&&entry.slot===site)))extra(1,'Lost');
  if(card.id==='Dark:2578'&&ccEffects('Dark:2572',side).some(effect=>effect.target&&rival.includes(effect.target)))extra(1,'Used');
  if(card.id==='Light:133')for(const [h,host]of ours.entries())if(host.type==='Character')for(const pile of ['hand','deck'])for(const [w,weapon]of ccOwn(side)[pile].entries())if(weapon.type==='Weapon'&&weapon.uniquenessLimit===1&&ccMatchingWeapon(weapon,host)&&withinDeploymentLimit(weapon,side))add(card,index,'matchingWeapon',[h,pile,w],weapon.name+' kostenlos auf '+host.name,{host,weapon,pileName:pile});
  if(card.id==='Dark:2770')for(const [h,host]of ours.entries())if(host.type==='Character'&&cardAbility(host)>3)for(const [i,entry]of all.entries())if(entry.slot===site&&!entry.unavailable)for(const [w,weapon]of (entry.card.weapons??[]).entries())if(weapon.subType==='Character'&&weapon!==host.weapons?.find(unit=>unit===weapon)&&PremiereWeapons.deployCost(weapon,host,cardAbility(host),host.power)!==null)add(card,index,'stealWeapon',[h,i,w],weapon.name+' stehlen',{host,weapon,original:entry.card,pile:'Lost'});
 }
 if(['beforeBattleDestiny','cloudCityBeforeBattleCard'].includes(window?.kind)){
  if(card.id==='Light:2285'&&window.side===side&&isSite(state.locations[site]))for(const [i,target]of ours.entries())if(target.type==='Character'&&cardAbility(target)>0)add(card,index,'smoke',[i],target.name+' Ability statt eines Destiny-Draws',{target});
  if(card.id==='Light:2301'&&isSite(state.locations[site])){const totals=battleTotals(site);if(totals[enemy.toLowerCase()+'Power']<2*totals[side.toLowerCase()+'Power'])add(card,index,'swapPower',[],'Gesamte Power vertauschen (4 Force)',{cost:4});}
 }
 if(window||!x||x.damage)return;
 if(card.id==='Light:1206'&&ccHasPersona(ours,'Lando')&&ours.some(PremiereUnits.bountyHunter))extra(ours.some(unit=>ccPersona(unit,'Boba Fett'))?2:1,'Lost');
 if(card.id==='Light:1960'&&ccHasPersona(ours,'Leia')&&ccHasPersona(ours,'Chewie'))extra(2,'Lost');
 if(card.id==='Light:1966'&&defending&&state.locations[site]?.subType==='System')for(const [i,ship]of ours.entries())if(PremiereUnits.fighter(ship)&&ship.occupants?.some(entry=>entry.role==='pilot'&&(ccPersona(entry.card,'Han')||ccPersona(entry.card,'Lando'))))add(card,index,'punchIt',[i],ship.name+' zusätzliche Destiny und immun',{target:ship,amount:ccPersona(ship,'Falcon')?2:1});
 if(card.id==='Light:1006'&&defending&&isSite(state.locations[site])){const chars=ours.filter(unit=>['Character','Starship','Vehicle'].includes(unit.type));if(chars.length===1&&CloudCityRules.gambler(chars[0]))add(card,index,'gamblersLuck',[],'Zusätzliche Battle Destiny auswählen',{amount:ccPersona(chars[0],'Lando')?2:1});}
 if(['Light:578','Dark:964'].includes(card.id)&&isSite(state.locations[site]))for(const [i,target]of ours.entries())if(card.id==='Dark:964'?ccPersona(target,'Vader'):ccPersona(target,'Luke')||ccPersona(target,'Leia'))add(card,index,'abilityPower',[i],target.name+' Ability zur Power, keine Immunität',{target});
 if(['Light:1143','Dark:841'].includes(card.id)&&isSite(state.locations[site]))for(const [i,host]of ours.entries())for(const [w,weapon]of (host.weapons??[]).entries())if(weapon.subType==='Character'&&PremiereUnits.canUseWeapon(state,host,weapon)&&!x.usedWeapons?.includes(weapon))for(const [j,target]of rival.entries())if(target.type==='Character')add(card,index,'higherGround',[i,w,j],target.name+' Power −4 statt mit '+weapon.name+' zu schießen',{host,weapon,target,pile:'Used'});
 if(card.id==='Light:1042'&&isSite(state.locations[site])&&ours.some(ownLightsaber)&&rival.some(unit=>ccPersona(unit,'Vader')))add(card,index,'zeroVader',[],'Vaders Power auf null (1 Force verlieren)',{lossCost:1,target:rival.find(unit=>ccPersona(unit,'Vader'))});
 if(card.id==='Light:2758'&&ccHasPersona(ours,'Chewie')&&ccHasPersona(ours,'Lando'))add(card,index,'relieveAttrition',[],'Attrition gegen mich −3',{amount:3});
 if(card.id==='Dark:2807'&&!defending&&rival.some(unit=>ccPersona(unit,'Luke')))add(card,index,'reduceBattle',[],'Destiny von gegnerischer Power und Attrition abziehen',{amount:1,pile:'Lost'});
});
function ccMatchingWeapon(weapon,host){if(weapon.id==='Dark:293')return ccPersona(host,'Boba Fett');const title=ccTitle(weapon);return ['Luke','Leia','Han','Vader','Obi-Wan','Chewie'].some(persona=>ccPersona(host,persona)&&title.startsWith(persona.toLowerCase()+"'s"));}
function ccSettleBattleInterrupt(frame,parent,done){
 const mode=frame.mode.slice(3),side=frame.side,enemy=PremiereGame.otherSide(side),x=battleSession;
 if(mode==='extraDestiny'){scheduleBattleDestiny(side,'battle',frame.amount);done();return true;}
 if(mode==='matchingWeapon'){const pile=ccOwn(side)[frame.pileName],at=pile.indexOf(frame.weapon);if(at>=0&&ccEntry(frame.host)){pile.splice(at,1);(frame.host.weapons??=[]).push(frame.weapon);if(frame.pileName==='deck')pile.splice(0,pile.length,...PremiereGame.shuffleReserve(pile,state.game));openDeploymentReaction(side,[frame.weapon]);}done();return true;}
 if(mode==='stealWeapon'){const index=frame.original.weapons?.indexOf(frame.weapon);if(index>=0){frame.original.weapons.splice(index,1);(frame.host.weapons??=[]).push(frame.weapon);frame.weapon.owner=side;frame.weapon.controller=side;}done();return true;}
 if(mode==='smoke'){(x.cloudCitySmoke??={})[side]=frame.target;done();return true;}
 if(mode==='swapPower'){x.cloudCitySwapPower=true;done();return true;}
 if(mode==='punchIt'){scheduleBattleDestiny(side,'battle',frame.amount);frame.target.cloudCityPunchTurn=state.game.timing.turn;done();return true;}
 if(mode==='gamblersLuck'){scheduleBattleDestiny(side,'battle',frame.amount+1);(x.cloudCityGamble??={})[side]=frame.amount+1;done();return true;}
 if(mode==='abilityPower'){frame.target.cloudCityAbilityPowerTurn=state.game.timing.turn;frame.target.cloudCityNoAbilityTurn=state.game.timing.turn;frame.target.cloudCityChasmTurn=state.game.timing.turn;done();return true;}
 if(mode==='higherGround'){markWeaponFired({host:frame.host,weapon:frame.weapon});(frame.target.cloudCityPowerDebuffs??=[]).push({turn:state.game.timing.turn,amount:4});done();return true;}
 if(mode==='zeroVader'){frame.target.cloudCityZeroPowerTurn=state.game.timing.turn;done();return true;}
 if(mode==='relieveAttrition'){(x.dagobahAttritionRelief??={Light:0,Dark:0})[side]+=frame.amount;done();return true;}
 if(mode==='reduceBattle'){drawDestinySeries(side,'reduceBattle',frame.amount,0,draws=>{const amount=PremiereBattle.total(draws)??0;(x.dagobahAttritionRelief??={Light:0,Dark:0})[enemy]+=amount;x[enemy.toLowerCase()+'PowerMod']-=amount;done();});return true;}
 return false;
}
const ccBattleBase={power:cardPowerModifier,immunity:battleImmunity,draw:drawDestinySeries,breakdown:battlePowerBreakdown,prepare:prepareDamageSegment,end:endBattleTiming,vader:vaderBattleDestinyBonus,responses:destinyResponses};
cardPowerModifier=function(card,side,slot,present){let value=ccBattleBase.power(card,side,slot,present);if(!cloudCityEnabled())return value;if(card.cloudCityAbilityPowerTurn===state.game.timing.turn)value+=cardAbility(card);value-=(card.cloudCityPowerDebuffs??[]).filter(record=>record.turn===state.game.timing.turn).reduce((sum,record)=>sum+record.amount,0);return card.cloudCityZeroPowerTurn===state.game.timing.turn?-(card.power??0):value;};
battleImmunity=function(side,card,slot,...args){return cloudCityEnabled()&&card.cloudCityPunchTurn===state.game.timing.turn?Infinity:ccBattleBase.immunity(side,card,slot,...args);};
drawDestinySeries=function(side,purpose,count,modifier,complete){
 if(!cloudCityEnabled()||purpose!=='battle'||!battleSession)return ccBattleBase.draw(side,purpose,count,modifier,complete);
 const x=battleSession;
 ccBattleBase.draw(side,purpose,count,modifier,draws=>{
  if(!x.cloudCityGamble?.[side]||draws.length<2){complete(draws);return;}
  const candidates=draws.slice(-x.cloudCityGamble[side]);delete x.cloudCityGamble[side];
  ccChoose(side,candidates[0].card,'GamblerDestiny',candidates.map((draw,i)=>({args:[i],draw,card:draw.card,label:draw.card.name+' ('+draw.value+') NICHT zählen'})),choice=>{choice.draw.cancelled=true;complete(draws);},{shown:candidates.map(draw=>draw.card),publicView:true});
 });
};
battlePowerBreakdown=function(...args){const result=ccBattleBase.breakdown(...args);if(cloudCityEnabled()&&battleSession?.cloudCitySwapPower&&!battleSession.decidedPower&&!battleSession.damage?.power)return {...result,Light:{...result.Light,power:result.Dark.power},Dark:{...result.Dark,power:result.Light.power}};return result;};
prepareDamageSegment=function(){ccBattleBase.prepare();if(cloudCityEnabled()&&battleSession?.cloudCityPirates&&battleSession.damage){const result=battleSession.damage.result;battleSession.cloudCityPiratesLoser=result.lightTotal<result.darkTotal?'Light':result.darkTotal<result.lightTotal?'Dark':null;}};
vaderBattleDestinyBonus=function(side,slot){if(!cloudCityEnabled())return ccBattleBase.vader(side,slot);let bonus=ccBattleBase.vader(side,slot);if(ccEffects('Light:2670').some(effect=>ccEntry(effect.host)?.slot===slot)&&side==='Dark')bonus=0;bonus+=battleCandidates(side,slot).flatMap(card=>card.attachments??[]).filter(effect=>effect.id==='Dark:2699'&&ccText(effect)).length;return bonus;};
destinyResponses=function(side,frame){const options=ccBattleBase.responses(side,frame);return cloudCityEnabled()&&ccEffects('Light:2670').some(effect=>ccEntry(effect.host)?.slot===battleSession?.site)?options.filter(option=>option.kind!=='tarkinCancel'):options;};
endBattleTiming=function(site,result,...args){
 if(cloudCityEnabled()){
  const records=(state.cloudCityPursuit??[]).filter(record=>record.site===site);state.cloudCityPursuit=(state.cloudCityPursuit??[]).filter(record=>record.site!==site);
  const winner=result?.lightTotal>result?.darkTotal?'Light':result?.darkTotal>result?.lightTotal?'Dark':null;
  for(const record of records)if(record.side===winner&&record.target.captured){const entry=ccEntry(record.target);if(entry&&detachTableCard(entry.side,entry.slot,record.target))rallyCaptive(record.target,site);}
 }
 return ccBattleBase.end(site,result,...args);
};

function ccBeforeBattleCard(side,draw,substitute){
 const frame={kind:'cloudCityBeforeBattleCard',side,site:battleSession?.site};
 withShipWeaponResponse(frame,()=>{const target=battleSession?.cloudCitySmoke?.[side];if(target){delete battleSession.cloudCitySmoke[side];substitute({card:target,value:cardAbility(target),cancelled:false,cloudCityReplacement:true});}else draw();});
}
