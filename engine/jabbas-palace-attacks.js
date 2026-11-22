'use strict';
const jpAttackBase={power:creaturePower,resolve:hothResolveCreaturePower,candidates:battleCandidates};
creaturePower=function(card,...args){let value=jpAttackBase.power(card,...args);if(jpEnabled()){if(card.id==='Dark:103'&&state.creatureAttack?.fighters.includes(card))value+=3+(state.creatureAttack.jpAmaninBonus?.[card.instanceId]??0);if(state.creatureAttack?.fighters[0]===card)value+=state.creatureAttack.jpSkullPower??0;}return value;};
hothResolveCreaturePower=function(addDestiny){
 const attack=state.creatureAttack;if(!jpEnabled()||!attack)return jpAttackBase.resolve(addDestiny);
 const sources=attack.fighters.filter(c=>c.id==='Dark:103'&&jpLive(c));if(!sources.length||attack.jpAmaninAnswered)return jpAttackBase.resolve(addDestiny);
 attack.jpAmaninAnswered=true;attack.jpAmaninBonus={};
 const choose=()=>{const card=sources.shift();if(!card){jpAttackBase.resolve(addDestiny);return;}
  jpChoose(attack.fighterSide,card,'AmaninAttack',[{args:['draw'],label:'Eine zusätzliche Destiny zur Angriffs-Power'},{args:['skip'],label:'Keine zusätzliche Destiny ziehen'}],choice=>{if(choice.args[0]==='draw')drawDestinySeries(attack.fighterSide,'attack',1,0,draws=>{attack.jpAmaninBonus[card.instanceId]=PremiereBattle.total(draws)??0;choose();});else choose();});
 };choose();
};
battleCandidates=function(side,slot,...args){const candidates=jpAttackBase.candidates(side,slot,...args);return jpEnabled()&&battleSession?.initiator===side?candidates.filter(c=>c.id!=='Light:183'):candidates;};
const jpMonkMove=hothMovementAllowed;
const jpAmaninLoss=loseTableCard;
loseTableCard=function(side,slot,card,...args){
 const attack=state.creatureAttack,amanin=jpEnabled()&&!args[0]&&attack?.creature===card&&attack.fighters.length===1&&attack.fighters[0].id==='Dark:103'&&jpLive(attack.fighters[0])&&!card.cardIcons?.includes('Selective Creature')?attack.fighters[0]:null;
 if(!amanin)return jpAmaninLoss(side,slot,card,...args);
 args[0]=true;const result=jpAmaninLoss(side,slot,card,...args);
 if(result&&!jpEntry(card))(state.hothDeferred??=[]).push(()=>jpChoose(attack.fighterSide,amanin,'AmaninRetrieve',[{args:['yes'],label:(card.deploy??0)+' Force zurückholen'},{args:['no'],label:'Nicht zurückholen'}],choice=>{if(choice.args[0]==='yes')PremiereGame.retrieveForce(state,attack.fighterSide,card.deploy??0);}));
 return result;
};
hothMovementAllowed=function(side,card,from,to,kind){return !(jpEnabled()&&card?.id==='Light:183'&&state.locations[to]?.hostInstanceId)&&jpMonkMove(side,card,from,to,kind);};
ccResponseProviders.push((side,window)=>{
 if(!jpEnabled()||window.kind!=='dagobahCreatureInitiated')return [];const out=[];
 for(const e of jpAll(side,'Dark:1009'))if(e.slot===window.site&&PremiereLocations.presentAt(e,e.slot))out.push(jpOption(e.card,'guardSacrifice',[e.card.instanceId],'Gamorrean Guard opfern · Creature-Angriff aufheben',()=>{jpRemove(e.card);window.cancelled=true;ccAnswer(side,window);return true;}));return out;
});

const jpSkullTarget=card=>card.type==='Character'&&!isDroid(card)||card.type==='Creature'||HothRules.creatureVehicle(card);
function jpSkullOptions(side){
 const own=jpOwn(side);return own.hand.flatMap((card,index)=>card.id==='Light:2276'?own.lost.flatMap((target,i)=>jpSkullTarget(target)?[{card,index,target,cost:0,mode:'cc:jp:skullPower',choice:[index,'cc:jp:skullPower',i],label:card.name+' · '+target.name+' aus dem Spiel nehmen',rule:{pile:'Lost'}}]:[]):[]);
}
function jpSkullPower(side,target){const own=jpOwn(side),index=own.lost.indexOf(target);if(index<0)return false;own.lost.splice(index,1);(state.outOfPlay??=[]).push(target);const value=PremiereBattle.printedDestiny(target)??0;if(battleSession)battleSession[side.toLowerCase()+'PowerMod']+=value;else state.creatureAttack.jpSkullPower=(state.creatureAttack.jpSkullPower??0)+value;return true;}
jpInterruptProviders.push(({card,side,window,offer})=>{if(!window&&card.id==='Light:2276'&&battleSession?.segment==='weapons')for(const option of jpSkullOptions(side).filter(o=>o.card===card))offer('skullPower',option.choice.slice(2),option.label,(_parent,done)=>{jpSkullPower(side,option.target);done();});});
const jpSkullBase={choices:creatureChoices,finish:finishCreatureChoice,settle:settleHothInterrupt};
creatureChoices=function(frame){const out=jpSkullBase.choices(frame);if(jpEnabled()&&frame.mode==='creatureFight'&&frame.side===state.creatureAttack.fighterSide)out.push(...jpSkullOptions(frame.side).map(option=>({args:['jpSkull',option.index,jpOwn(frame.side).lost.indexOf(option.target)],card:option.card,label:option.label})));return out;};
finishCreatureChoice=function(frame,...args){if(!jpEnabled()||args[0]!=='jpSkull')return jpSkullBase.finish(frame,...args);const option=jpSkullOptions(frame.side).find(o=>o.index===args[1]&&jpOwn(frame.side).lost.indexOf(o.target)===args[2]);if(!option)return false;state.pendingCardView=null;return announceHothInterrupt(frame.side,{...option,jpCreatureSkull:true});};
settleHothInterrupt=function(frame,parent){if(!jpEnabled()||!frame.jpCreatureSkull)return jpSkullBase.settle(frame,parent);if(!frame.cancelled)jpSkullPower(frame.side,frame.target);finishPileInterrupt(frame);if(state.creatureAttack)showCreature('creatureFight',frame.side);};
