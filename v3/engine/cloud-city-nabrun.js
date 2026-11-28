'use strict';
function ccAsDeployment(side,run){
 const old={phase:state.phase,active:state.activeSide,view:state.pendingCardView,responses:state.game.responses,special:state.cloudCitySpecialDeploy};
 state.phase=2;state.activeSide=side;state.pendingCardView=null;state.game.responses=[];state.cloudCitySpecialDeploy=true;
 try{return run();}finally{const children=state.game.responses;state.phase=old.phase;state.activeSide=old.active;state.pendingCardView=state.pendingCardView??old.view;state.game.responses=old.responses.concat(children);if(old.special)state.cloudCitySpecialDeploy=old.special;else delete state.cloudCitySpecialDeploy;}
}
function ccNabrunDeployment(action,site){
 if(action.mode==='cc:playStored')return ccNabrunDeployment(action.storedAction,site);
 const deployments=['deploy','deployWithPilot','equip','deployDevice','deployBolt','deployAutomated','deployLocationEffect','deployTableEffect','revolution'];
 if(action.kind==='transport'&&action.args[0]==='deployAboard')return action.to===site;
 if(action.kind==='hothAction'&&!['Interrupt','Location'].includes(action.card?.type)&&!ccEntry(action.card))return action.site===site||action.target&&ccEntry(action.target)?.slot===site||action.host&&ccEntry(action.host)?.slot===site;
 if(!deployments.includes(action.kind))return false;
 if(action.kind==='deployTableEffect')return !!action.host&&ccEntry(action.host)?.slot===site;
 return [action.site,action.to,action.siteIndex,action.slot,action.host&&ccEntry(action.host)?.slot].some(value=>value===site)||action.args[1]===site;
}
function ccShowNabrun(){
 const record=state.cloudCityNabrun;if(!record)return;
 let choices=ccAsDeployment(record.side,()=>legalActions(state,record.side).filter(action=>(ccOwn(record.side).hand.includes(action.card)||action.mode==='cc:playStored')&&ccNabrunDeployment(action,record.site)).map((action,i)=>({args:[i],card:action.card,action,label:action.label??action.card.name})));
 choices=choices.concat({args:['done'],label:'Sofortiges Deployen beenden'});record.waiting=false;
 ccChoose(record.side,record.card,'NabrunDeploy',choices,choice=>{
  if(choice.args[0]==='done'){delete state.cloudCityNabrun;finishPileInterrupt(record.frame);return;}
  record.waiting=true;const fromHand=ccOwn(record.side).hand.includes(choice.card);ccAsDeployment(record.side,()=>{const result=executeAction(choice.action);if(result&&fromHand&&!ccOwn(record.side).hand.includes(choice.card))ccEquipmentKickback(record.side,choice.card);return result;});
  if(!state.pendingCardView&&!state.pendingForceLoss&&(!PremiereGame.responseWindow(state.game)||PremiereGame.responseWindow(state.game)===record.parent))ccShowNabrun();
 });
}
const ccNabrunBase={settle:ccSettleBattleInterrupt,charCost:characterDeployCost,crewCost:crewDeployCost};
ccSettleBattleInterrupt=function(frame,parent,done){
 if(frame.mode!=='cc:nabrunDeploy')return ccNabrunBase.settle(frame,parent,done);
 const card=frame.target,owner=ccOwner(card),own=ccOwn(owner);let found=false;
 for(const pile of ['used','hand','deck']){const index=own[pile].indexOf(card);if(index>=0){own[pile].splice(index,1);found=true;break;}}
 if(!found)for(const effect of ccAllEffects()){const index=effect.support?.indexOf(card)??-1;if(index>=0){effect.support.splice(index,1);found=true;break;}}
 if(found&&!own.lost.includes(card))loseOwnedCard(card,owner);
 state.cloudCityNabrun={side:frame.side,site:frame.site,card:frame.card,frame,parent,waiting:false};ccShowNabrun();return true;
};
characterDeployCost=function(card,loc,side){return cloudCityEnabled()&&state.cloudCityNabrun?.side===side&&state.cloudCityNabrun.site===state.locations.indexOf(loc)&&characterTraits(card).includes('trooper')?0:ccNabrunBase.charCost(card,loc,side);};
crewDeployCost=function(card,side,loc){return cloudCityEnabled()&&state.cloudCityNabrun?.side===side&&state.cloudCityNabrun.site===state.locations.indexOf(loc)&&characterTraits(card).includes('trooper')?0:ccNabrunBase.crewCost(card,side,loc);};
ccContinuousProviders.push(()=>{const record=state.cloudCityNabrun;if(record?.waiting&&!state.pendingCardView&&!state.pendingForceLoss&&!state.pendingCustody?.length&&(!PremiereGame.responseWindow(state.game)||PremiereGame.responseWindow(state.game)===record.parent))ccShowNabrun();});
