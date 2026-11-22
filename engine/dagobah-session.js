'use strict';
const dagobahEnabled=()=>!!state&&typeof DagobahRules!=='undefined'&&(currentGame()?.cardRulesVersion??0)>=32&&[DagobahRules.FORMAT,'premiere-a-new-hope-hoth-dagobah-cloud-city','premiere-a-new-hope-hoth-dagobah-cloud-city-jabbas-palace'].includes(currentGame()?.playFormat);
const dagoUnits=()=>hothAllUnits();
const dagoOwn=side=>PremiereGame.zones(state,side);
const dagoEntry=card=>PremiereLocations.findEntry(state,card);
const dagoParasiteHost=card=>dagoUnits().find(entry=>entry.card.instanceId===card?.dagobahParasiteHostId)?.card;
const dagoClawParent=card=>dagoUnits().find(entry=>entry.card.instanceId===card?.dagobahClawParentId)?.card;
const dagoText=card=>DagobahRules.live(card)&&!card.dagobahArmDormant&&!PremiereUnits.textSuppressed(card);
const dagoTitle=card=>DagobahRules.title(card);
const dagoEffects=(id,side)=>[...(state.tableEffects??[]),...Object.entries(state.locationEffects??{}).flatMap(([site,list])=>list.map(effect=>({...effect,site:Number(site)})))].filter(effect=>effect.card.id===id&&!PremiereUnits.textSuppressed(effect.card)&&(!side||(effect.card.owner??effect.card.side)===side)&&!([effect.host,typeof effect.target==='object'?effect.target:null].filter(Boolean).some(card=>dagoEntry(card)?.unavailable)));
const dagoUsed=(card,key='')=>'dagobah:'+card.instanceId+':'+key;
function dagoRelocationAllowed(side,card,from,to,kind='relocate'){return !movementPrevented(card)&&dagoMoveAllowed(side,card,from,to,kind)&&hothMovementAllowed(side,card,from,to,kind)&&HothRules.canTravel(state,side,from,to,kind);}
function dagoOption(card,mode,args,label,extra={}){return {card,mode:'dago:'+mode,args:['dago:'+mode,...args],label:card.name+' · '+label,cost:0,...extra};}
function dagoCanDeploy(card,loc,side){
 if(!loc)return false;
 if(card.type==='Character'&&dagoEffects('Light:838',side).some(effect=>state.locations[effect.site]===loc))return true;
 if(card.id==='Light:2865'&&!DagobahRules.dagobah(loc))return false;
 if(card.id==='Light:2304'&&!['dagobah','cloud city'].includes(sitePlanet(loc)??locationGroup(loc)))return false;
 if(DagobahRules.sector(loc)&&['Character','Vehicle'].includes(card.type))return false;
 if(/dagobah: jungle/.test(dagoTitle(loc))&&dagoLocationText(state.locations.indexOf(loc))&&['Starship','Vehicle'].includes(card.type))return false;
 if(!DagobahRules.dagobah(loc))return true;
 if(['Character','Vehicle','Starship'].includes(card.type))return ['Light:2865','Light:2304'].includes(card.id)||card.type==='Starship'&&PremiereUnits.fighter(card)&&loc.id==='Light:598'&&side===dagoLocationPlayer(state.locations.indexOf(loc),'Light')||card.type==='Character'&&dagoEffects('Light:838',side).some(effect=>state.locations[effect.site]===loc);
 return true;
}
function dagoMoveAllowed(side,card,from,to,kind){
 if(!card||!Number.isInteger(to))return true;
 const origin=state.locations[from],destination=state.locations[to];
 if(card.dagobahMeditationUntil||card.dagobahNoMoveUntil>=state.game.timing.turn)return false;
 const test=state.tableEffects?.find(effect=>DagobahRules.testNumber(effect.card)===2&&effect.apprentice===card);
 if(test&&kind&&kind!=='Landspeed')return false;
 if(card.dagobahNeuralUntil>=state.game.timing.turn&&kind==='Landspeed')return false;
 if(dagoUnits().some(entry=>entry.carriers.includes(card)&&state.tableEffects?.some(effect=>DagobahRules.testNumber(effect.card)===2&&effect.apprentice===entry.card)))return false;
 if(/dagobah: jungle/.test(dagoTitle(destination))&&dagoLocationText(to)&&['Starship','Vehicle'].includes(card.type))return false;
 if([origin,destination].some(DagobahRules.dagobah)&&/shuttle|transport-card/i.test(kind))return false;
 return true;
}
function dagoActionAllowed(action){
 if(action.card?.type==='Interrupt'&&dagoEffects('Dark:185',PremiereGame.otherSide(action.side)).length&&/bad feeling/i.test(action.card.name))return false;
 if(['deploy','deployWithPilot','reactDeploy'].includes(action.kind)&&!dagoCanDeploy(action.card??action.ship,state.locations[action.to??action.site??action.args[1]],action.side))return false;
 if(action.kind==='transport'&&action.args[0]==='deployAboard'&&!dagoCanDeploy(action.card,state.locations[action.to],action.side))return false;
 if(['move','transport','react','groupRelocation','transitGroup'].includes(action.kind)){
  const kind=action.kind==='move'?action.args[3]??action.movement:action.kind==='transport'?action.args[0]:action.kind==='groupRelocation'?'transport-card':action.kind;
  if(!dagoMoveAllowed(action.side,action.card,action.from,action.to??action.site,kind))return false;
 }
 if(['battle','drain'].includes(action.kind)&&!dagoCanInitiate(action.side,action.args[0],action.kind))return false;
 return true;
}
function dagoCanInitiate(side,site,kind){
 if(kind==='drain'&&dagoTitle(state.locations[site])==='dagobah')return false;
 if(kind==='battle'){
  const all=dagoUnits().filter(entry=>entry.slot===site&&!entry.unavailable&&PremiereLocations.presentAt(entry,site));
  for(const entry of all){
   const stick=entry.card.attachments?.find(card=>card.id==='Light:2872'&&!PremiereUnits.textSuppressed(card));
   const yoda=entry.card.id==='Light:2865'&&dagoText(entry.card);
   if(!stick&&!yoda)continue;
   if(stick&&((stick.owner??stick.side)===side))continue;
   if(!all.some(other=>other.side!==entry.side&&other.card.type==='Character'&&cardAbility(other.card)>3))return false;
  }
  if(state.dagobahNoBattles?.[side]===state.game.timing.turn)return false;
 }
 return true;
}
function dagoActionOptions(side){
 if(!state||state.gameWinner||state.pendingCardView||state.pendingForceLoss||PremiereGame.responseWindow(state.game))return [];
 return [...dagoSpaceOptions(side),...dagoJediOptions(side),...dagoCreatureOptions(side),...dagoUnitOptions(side),...dagoUtilityOptions(side)];
}
function playDagobahAction(side,...args){
 const choice=dagoActionOptions(side).find(option=>option.args.length===args.length&&option.args.every((value,i)=>value===args[i]));if(!choice)return false;
 if(choice.cost>forceBudget(side))return false;
 const result=choice.resolve(side,choice)!==false;if(result&&choice.device&&choice.deviceHost)PremiereUnits.recordDeviceUse(state,choice.deviceHost,choice.device);return result;
}
function dagoCardChoices(frame){return frame.choices??[];}
function finishDagobahChoice(frame,...args){
 const choice=dagoCardChoices(frame).find(option=>option.args.length===args.length&&option.args.every((value,i)=>value===args[i]));if(!choice)return false;
 return frame.choose(choice,...args)!==false;
}
function dagoPrompt(side,card,mode,choices,choose,extra={}){
 state.pendingCardView={mode:'hothDag'+mode,side,card,shown:choices.filter(option=>option.card).map(option=>option.card),choices,choose,...extra};
}
function dagoLoss(side,amount,reason,next=()=>{}){hothForceLoss(side,amount,reason,next);}
function dagoContinuous(){dagoJediContinuous();dagoSpaceContinuous();dagoCreatureContinuous();dagoEffectContinuous();}
function dagoCheckpoint(event,next){
 const tasks=[];dagoContinuous();dagoJediTiming(event,tasks);dagoSpaceTiming(event,tasks);dagoCreatureTiming(event,tasks);dagoEffectTiming(event,tasks);
 hothRunTasks(tasks,next);
}
// Delegate older rule versions and formats to the unchanged shared engine.
const dagoBase={hothActions:hothActionOptions,hothPlay:playHothAction,hothAllowed:hothActionAllowed,hothChoices:hothCardChoices,hothFinish:finishHothChoice,hothPrompt:hothPromptChoice,hothCheckpoint,hothContinuous,
 deploy:boardDeployCost,characterLocationAllowed,characterCost:characterDeployCost,crewCost:crewDeployCost,craftCost:craftDeployCost,travel:travelOptions,locationPositions:locationPositionsForCard,conversion:conversionTarget,drain:forceDrainEffects,ability:cardAbility,power:cardPowerModifier,stats:craftStats,immunity:battleImmunity};
hothActionOptions=function(side){return dagoBase.hothActions(side).concat(dagobahEnabled()?dagoActionOptions(side):[]);};
playHothAction=function(side,...args){return dagobahEnabled()&&String(args[0]).startsWith('dago:')?playDagobahAction(side,...args):dagoBase.hothPlay(side,...args);};
hothActionAllowed=function(action){return dagoBase.hothAllowed(action)&&(!dagobahEnabled()||dagoActionAllowed(action));};
hothCardChoices=function(frame){return dagobahEnabled()&&frame.mode?.startsWith('hothDag')?dagoCardChoices(frame):dagoBase.hothChoices(frame);};
finishHothChoice=function(frame,...args){return dagobahEnabled()&&frame.mode?.startsWith('hothDag')?finishDagobahChoice(frame,...args):dagoBase.hothFinish(frame,...args);};
hothPromptChoice=function(offers,frame){return dagobahEnabled()&&frame.mode?.startsWith('hothDag')?(frame.botChoice?.(offers)??offers.find(option=>option.args[0]==='done')??offers[0]):dagoBase.hothPrompt(offers,frame);};
hothCheckpoint=function(event,next){return dagobahEnabled()?dagoCheckpoint(event,()=>dagoBase.hothCheckpoint(event,next)):dagoBase.hothCheckpoint(event,next);};
hothContinuous=function(){dagoBase.hothContinuous();if(dagobahEnabled())dagoContinuous();};
boardDeployCost=function(card,loc,side,free=false){if(dagobahEnabled()&&!dagoCanDeploy(card,loc,side))return null;return dagoBase.deploy(card,loc,side,free);};
characterLocationAllowed=function(card,loc){return dagobahEnabled()&&DagobahRules.dagobah(loc)&&dagoEffects('Light:838',card.controller??card.owner??card.side).some(effect=>state.locations[effect.site]===loc)?true:dagoBase.characterLocationAllowed(card,loc);};
characterDeployCost=function(card,loc,side){const cost=dagoBase.characterCost(card,loc,side);return cost;};
crewDeployCost=function(card,side,loc){const cost=dagoBase.crewCost(card,side,loc);return Math.max(0,cost+(dagobahEnabled()?dagoCrewModifier(card,side,state.locations.indexOf(loc)):0));};
craftDeployCost=function(card,loc,side,pilot=null){const cost=dagoBase.craftCost(card,loc,side,pilot);return cost===null?null:Math.max(0,cost+(dagobahEnabled()?dagoDeployModifier(card,side,state.locations.indexOf(loc)):0));};
travelOptions=function(card,side,from,to,react=false){return dagobahEnabled()?dagoTravel(card,side,from,to,react,()=>dagoBase.travel(card,side,from,to,react)):dagoBase.travel(card,side,from,to,react);};
locationPositionsForCard=function(side,card){return dagobahEnabled()&&(DagobahRules.sector(card)||DagobahRules.cave(card)||card?.id==='Dark:2343')?[]:dagoBase.locationPositions(side,card);};
conversionTarget=function(side,index){return dagobahEnabled()&&dagoOwn(side).hand[index]?.genericLimit?-1:dagoBase.conversion(side,index);};
cardAbility=function(card){const value=dagoBase.ability(card);return dagobahEnabled()&&Number.isFinite(value)?Math.max(value,...(card?.attachments??[]).map(test=>test.dagobahJediTest??0)):value;};
cardPowerModifier=function(card,side,slot,present){return dagoBase.power(card,side,slot,present)+(dagobahEnabled()?dagoPowerModifier(card,side,slot):0);};
craftStats=function(card,slot,...args){const stats=dagoBase.stats(card,slot,...args);return dagobahEnabled()?dagoCraftStats(card,slot,stats):stats;};
battleImmunity=function(side,card,slot,...args){const original=dagoBase.immunity(side,card,slot,...args);return dagobahEnabled()?Math.max(original,dagoImmunity(side,card,slot)):original;};
forceDrainEffects=function(side,slot){const plan=dagoBase.drain(side,slot);return !plan||!dagobahEnabled()?plan:dagoDrainPlan(side,slot,plan);};
