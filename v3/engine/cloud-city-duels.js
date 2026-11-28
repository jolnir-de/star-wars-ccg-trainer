'use strict';
const ccDuelBase={options:duelOptions,settle:settleDuel,limit:withinDeploymentLimit};
// Epic Events use their own deployment permission, not the Effect/Sense/Alter
// route. Keep the printed card type intact.
ccProviders.push(side=>state.activeSide!==side||state.phase!==2||battleSession?[]:ccOwn(side).hand.flatMap((card,index)=>card.id==='Dark:879'&&withinDeploymentLimit(card,side)?[ccOption(card,'epicDeploy',[index],'Epic Duel auf dem Tisch auslegen',()=>{
 ccOwn(side).hand.splice(ccOwn(side).hand.indexOf(card),1);(state.tableEffects??=[]).push({card,target:side});openDeploymentReaction(side,[card]);return true;
})]:[]));
duelOptions=function(side){
 if(!cloudCityEnabled())return ccDuelBase.options(side);
 if(side!=='Dark'||ownForceBudget(side)<1||state.cloudCityDuel)return [];
 const copies=ccOwn(side).hand.flatMap((card,index)=>card.id==='Dark:2517'?[{card,index}]:[]),epic=ccEffects('Dark:879',side).length>0;
 return state.locations.flatMap((loc,site)=>{if(!isSite(loc))return [];const vader=ccPresent(side,site).find(card=>ccPersona(card,'Vader')&&card.type==='Character'),obi=ccPresent('Light',site).find(card=>ccPersona(card,'Obi-Wan')&&card.type==='Character');return vader&&obi?copies.flatMap(({card,index})=>[...(epic?[{args:[index,site,'epic'],card,index,site,vader,obi,cost:1,epic:true,label:card.name+' · Epic Duel bei '+loc.name}]:[]),{args:[index,site,'regular'],card,index,site,vader,obi,cost:1,epic:false,label:card.name+' · reguläres Duell bei '+loc.name}]):[];});
};
function ccCrossLuke(card,site){
 if(!detachTableCard('Light',site,card))return false;
 card.cloudCityCrossed=true;card.cloudCityOriginalName=card.name;card.cloudCityOriginalPersonas=card.personas?.slice()??[];
 card.name=card.name.replace(/Luke(?: Skywalker)?/i,'Son Of Vader');card.personas=['Son Of Vader'];card.subType=card.subType==='Rebel'?'Imperial':card.subType;card.owner='Dark';card.controller='Dark';
 // Named cards refer to the old persona, even when a crossed character retains its own text.
 for(const weapon of [...card.weapons??[]])if(/luke|skywalker|anakin/i.test(weapon.name)){card.weapons.splice(card.weapons.indexOf(weapon),1);loseOwnedCard(weapon,ccOwner(weapon));}
 ccOwn('Dark').board[site].push(card);return true;
}
function ccEpicDuel(frame){
 const {side,vader,obi:target,site}=frame,isLuke=ccPersona(target,'Luke'),duel={side,card:frame.card,site,participants:{Dark:[vader],Light:[target]},extra:{Light:0,Dark:0}};state.cloudCityDuel=duel;
 const finish=(winner,fallen=[])=>{delete state.cloudCityDuel;queueRuleResponse({kind:'cloudCityDuelEnd',side,winner,site,participants:duel.participants,fallen});loseOwnedCard(frame.card,side);if(frame.duringBattle&&battleSession?.weaponTurn===side)finishWeaponAction(side,false);};
 withShipWeaponResponse({kind:'cloudCityDuelBegin',side,card:frame.card,site,duel},()=>{
  drawDestinySeries('Dark','cloudCityDuel',(frame.epic?2:0)+duel.extra.Dark,frame.epic&&ownLightsaber(vader)?1:0,dark=>drawDestinySeries('Light','cloudCityDuel',(frame.epic?2:0)+duel.extra.Light,frame.epic&&ownLightsaber(target)?1:0,light=>{
   const base=(card,side)=>frame.epic?cardAbility(card):Math.max(0,(card.power??0)+cardPowerModifier(card,side,site)-tacticalPenalty(card))+(ownLightsaber(card)?2:0);
   const d=(PremiereBattle.total(dark)??0)+base(vader,'Dark'),l=(PremiereBattle.total(light)??0)+base(target,'Light');log((frame.epic?'Epic Duel':'Duell')+' · Dark '+d+' / Light '+l+'.');
   if(d===l){finish(null);return;}
   if(!frame.epic){const loser=d<l?vader:target,winner=d<l?'Light':'Dark';loseTableCard(PremiereGame.otherSide(winner),site,loser,true);finish(winner,[loser]);return;}
   if(d<l){loseTableCard('Dark',site,vader,true);dagoLoss('Dark',isLuke?9:6,'Epic Duel',()=>finish('Light',[vader]));return;}
   if(!isLuke){loseTableCard('Light',site,target,true);dagoLoss('Light',9,'Epic Duel',()=>finish('Dark',[target]));return;}
   const ability=cardAbility(target);ccChoose('Light',frame.card,'LukeFate',[{args:['cross'],label:'Zur Dark Side wechseln und '+ability+' Force verlieren'},{args:['lost'],label:'Luke und '+(3*ability)+' Force verlieren'}],choice=>{
    if(choice.args[0]==='lost'){loseTableCard('Light',site,target);dagoLoss('Light',3*ability,'Epic Duel',()=>finish('Dark',[target]));return;}
    const response={kind:'cloudCityLukeCross',side:'Dark',card:frame.card,target,site};withShipWeaponResponse(response,answer=>{if((answer??response).loseInstead)loseTableCard('Light',site,target);else ccCrossLuke(target,site);dagoLoss('Light',ability,'Epic Duel',()=>finish('Dark'));});
   });
  }));
 });
}
settleDuel=function(frame){if(!cloudCityEnabled()||frame.cancelled)return ccDuelBase.settle(frame);return ccEpicDuel(frame);};
withinDeploymentLimit=function(card,side){if(cloudCityEnabled()&&card.type==='Character'&&ccPersona(card,'Lando')&&ccUnits().some(entry=>entry.card!==card&&entry.card.type==='Character'&&ccPersona(entry.card,'Lando')))return false;if(cloudCityEnabled()&&state.outOfPlay?.some(unit=>sameTitleOrPersona(card,unit)||unit.cloudCityOriginalPersonas?.some(persona=>card.personas?.includes(persona))))return false;return ccDuelBase.limit(card,side);};
ccInterruptProviders.push(({add,card,index,side,window})=>{
 if(window?.kind!=='cloudCityDuelBegin'||!['Light:578','Dark:964','Light:133'].includes(card.id))return;
 const duel=window.duel;
 if(card.id==='Light:578'||card.id==='Dark:964')add(card,index,'duelDestiny',[],'Eine zusätzliche Duell-Destiny');
 if(card.id==='Light:133')for(const host of duel.participants[side])for(const pile of ['hand','deck'])for(const [i,weapon]of ccOwn(side)[pile].entries())if(weapon.type==='Weapon'&&weapon.uniquenessLimit===1&&ccMatchingWeapon(weapon,host)&&withinDeploymentLimit(weapon,side))add(card,index,'matchingWeapon',[pile,i],weapon.name+' kostenlos auf '+host.name,{weapon,host,pileName:pile});
});
const ccDuelSettle=ccSettleBattleInterrupt;
ccSettleBattleInterrupt=function(frame,parent,done){if(frame.mode==='cc:duelDestiny'){parent.duel.extra[frame.side]++;done();return true;}return ccDuelSettle(frame,parent,done);};
