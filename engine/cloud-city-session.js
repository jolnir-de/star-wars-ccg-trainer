'use strict';
const cloudCityEnabled=()=>!!state&&(currentGame()?.cardRulesVersion??0)>=33&&[CloudCityRules.FORMAT,'premiere-a-new-hope-hoth-dagobah-cloud-city-jabbas-palace'].includes(currentGame()?.playFormat);
const ccProviders=[],ccTiming=[],ccContinuousProviders=[],ccResponseProviders=[];
const ccUnits=()=>hothAllUnits();
const ccOwn=side=>PremiereGame.zones(state,side);
const ccTitle=CloudCityRules.title;
const ccOwner=card=>card?.controller??card?.owner??card?.side;
const ccEntry=card=>PremiereLocations.findEntry(state,card);
const ccText=card=>DagobahRules.live(card)&&!PremiereUnits.textSuppressed(card);
const ccEffects=(id,side)=>[...(state.tableEffects??[]),...Object.entries(state.locationEffects??{}).flatMap(([site,list])=>list.map(effect=>({...effect,site:Number(site)})))].filter(effect=>effect.card.id===id&&ccText(effect.card)&&(!side||ccOwner(effect.card)===side)&&(!effect.host||ccEntry(effect.host)&&(!ccEntry(effect.host).unavailable||['Dark:316','Dark:2697','Dark:379','Dark:87','Dark:2768','Dark:1192'].includes(id))));
const ccPresent=(side,slot)=>PremiereLocations.presentCards(state,side,slot);
const ccControl=(side,slot)=>PremiereLocations.control(state,side,slot,cardAbility)===true;
const ccUse=(card,mode)=>'cloud:'+card.instanceId+':'+mode;
const ccUsed=(card,mode,scope='turn')=>PremiereGame.wasUsed(state.game,scope,ccUse(card,mode));
const ccMark=(card,mode,scope='turn')=>PremiereGame.useOnce(state.game,scope,ccUse(card,mode));
const ccOn=(card,id)=>card?.id===id&&ccText(card);
const ccAt=(side,slot,id)=>ccPresent(side,slot).some(card=>ccOn(card,id));
const ccPersona=(card,name)=>!card?.cloudCityCrossed&&((card?.personas??[]).some(persona=>persona.toLowerCase()===name.toLowerCase())||new RegExp('\\b'+name+'\\b','i').test(ccTitle(card)));
function ccBlockedForce(side){const force=ccOwn(side).force;let blocked=0;for(const effect of ccEffects('Light:989'))if(effect.forceBarrier===side)for(let i=0;i<force.length;i++)if(effect.blockedForce.includes(force[i]))blocked=Math.max(blocked,i+1);return blocked;}
function ccOption(card,mode,args,label,resolve,extra={}){return {card,mode:'cc:'+mode,args:['cc:'+mode,...args],label:card.name+' · '+label,cost:0,resolve,...extra};}
function ccPrompt(side,card,mode,choices,choose,extra={}){dagoPrompt(side,card,'Cloud'+mode,choices,choose,extra);}
function ccChoose(side,card,mode,choices,complete,extra={}){
 if(!choices.length){complete(null);return;}
 ccPrompt(side,card,mode,choices,choice=>{state.pendingCardView=null;complete(choice);return true;},extra);
}
function ccOnceAction(card,mode,args,label,cost,resolve,extra={}){
 return ccOption(card,mode,args,label,side=>{spendForce(side,cost);ccMark(card,mode);return resolve(side);},{cost,...extra});
}
function ccActionOptions(side){
 if(!cloudCityEnabled()||state.gameWinner||state.pendingCardView||state.pendingForceLoss)return [];
 const window=PremiereGame.responseWindow(state.game);
 if(window)return window.priority===side?ccResponseProviders.flatMap(provider=>provider(side,window)):[];
 return ccProviders.flatMap(provider=>provider(side));
}
const ccSessionBase={actions:hothActionOptions,play:playHothAction,checkpoint:hothCheckpoint,continuous:hothContinuous};
hothActionOptions=function(side){
 const base=ccSessionBase.actions(side);
 return cloudCityEnabled()?base.filter(option=>option.card?.set!=='5'||!String(option.mode).startsWith('dago:')).concat(ccActionOptions(side)):base;
};
playHothAction=function(side,...args){
 if(!cloudCityEnabled()||!String(args[0]).startsWith('cc:'))return ccSessionBase.play(side,...args);
 const option=ccActionOptions(side).find(option=>option.args.length===args.length&&option.args.every((value,i)=>value===args[i]));
 return !!option&&option.cost<=forceBudget(side)&&option.resolve(side,option)!==false;
};
hothCheckpoint=function(event,next){return !cloudCityEnabled()?ccSessionBase.checkpoint(event,next):hothRunTasks(ccTiming.flatMap(provider=>provider(event)),()=>ccSessionBase.checkpoint(event,next));};
hothContinuous=function(){ccSessionBase.continuous();if(cloudCityEnabled())for(const provider of ccContinuousProviders)provider();};
const ccResponsesBase={legal:legalActions,has:hasInterruptResponse};
legalActions=function(position,side,request){
 const out=ccResponsesBase.legal(position,side,request),window=position?.game&&PremiereGame.responseWindow(position.game);
 if(!cloudCityEnabled()||position!==state||position.pendingCardView||position.pendingForceLoss||position.pendingCustody?.length||!window||window.priority!==side)return out;
 return out.concat(ccResponseProviders.flatMap(provider=>provider(side,window)).map(option=>PremiereGame.offer(state.game,side,'hothAction',option.args,option)));
};
hasInterruptResponse=function(frame){return ccResponsesBase.has(frame)||cloudCityEnabled()&&PremiereGame.sides.some(side=>ccResponseProviders.some(provider=>provider(side,frame).length));};
function ccAnswer(side,window){if(PremiereGame.responseWindow(state.game)===window){window.priority=PremiereGame.otherSide(side);window.passes=0;}}
