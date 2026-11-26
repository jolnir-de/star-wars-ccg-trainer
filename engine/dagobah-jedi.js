'use strict';
const dagoJediCards=()=>dagoUnits().filter(entry=>!entry.unavailable&&entry.card.type==='Character');
const dagoTrainingRevision=()=>state.game.cardRulesVersion>=35;
const dagoTrainingSites=()=>state.locations.filter(loc=>isSite(loc)&&DagobahRules.dagobah(loc)&&!loc.genericLimit).length;
function dagoCompleted(side,number){if(dagoEffects('Dark:918').length)return false;return dagoJediCards().filter(entry=>entry.side===side).some(entry=>entry.card.attachments?.some(card=>card.dagobahJediTest===number&&!PremiereUnits.textSuppressed(card)));}
function dagoJediTargets(side,number,site){
 const own=dagoJediCards().filter(entry=>entry.side===side),pending=(state.tableEffects??[]).filter(effect=>DagobahRules.testNumber(effect.card));
 const mentors=own.filter(entry=>DagobahRules.dagobah(state.locations[entry.slot])&&cardAbility(entry.card)>2&&!entry.card.dagobahApprentice);
 const pairs=[];
 for(const mentor of mentors)for(const apprentice of own.concat(number===1?dagoOwn(side).hand.filter(card=>card.type==='Character').map(card=>({card,slot:site,inHand:true,side})):[])){
  if(!DagobahRules.mentorAllowed(mentor.card,apprentice.card,cardAbility)||number===1&&mentor.slot!==site)continue;
  if(dagoTrainingRevision()&&DagobahRules.jedi(apprentice.card))continue;
  if(pending.some(effect=>effect.apprentice===apprentice.card||effect.mentor===mentor.card&&effect.apprentice!==apprentice.card||dagoTrainingRevision()&&effect.mentor===apprentice.card))continue;
  if(!dagoTrainingRevision()&&own.some(entry=>entry.card!==apprentice.card&&entry.card.dagobahMentorId===mentor.card.instanceId))continue;
  const tests=apprentice.card.attachments?.filter(card=>card.dagobahJediTest)??[];
  if(tests.some(card=>card.dagobahJediTest===number)||number>1&&!tests.some(card=>card.dagobahJediTest===number-1))continue;
  if(number===1&&!apprentice.inHand&&apprentice.slot!==site)continue;
  const cost=apprentice.inHand?crewDeployCost(apprentice.card,side,state.locations[site]):0;
  if(cost>forceBudget(side)||apprentice.inHand&&!withinDeploymentLimit(apprentice.card,side))continue;
  pairs.push({mentor,apprentice,cost});
 }
 return pairs;
}
function dagoJediOptions(side){
 const options=[],own=dagoOwn(side),turn=state.game.timing.turn;
 if(state.activeSide!==side||battleSession)return options;
 if(state.phase===2)own.hand.forEach((card,index)=>{
  const number=DagobahRules.testNumber(card);if(!number)return;
  state.locations.forEach((loc,site)=>{
   if(!isSite(loc)||!DagobahRules.dagobah(loc)||number===2&&PremiereGame.sides.some(actor=>PremiereLocations.occupy(state,actor,site,cardAbility)===true)||number===3&&!/dagobah: (jungle|cave)$/.test(dagoTitle(loc))||number===4&&!/dagobah: (swamp|bog clearing)$/.test(dagoTitle(loc)))return;
   for(const [pairIndex,pair] of dagoJediTargets(side,number,site).entries())options.push(dagoOption(card,'testDeploy',[index,site,pairIndex],'Mentor: '+pair.mentor.card.name+' → Schüler: '+pair.apprentice.card.name+(pair.apprentice.inHand?' (aus der Hand)':'')+' bei '+loc.name,{site,cost:pair.cost,mentor:pair.mentor.card,apprentice:pair.apprentice.card,resolve(){
    own.hand.splice(own.hand.indexOf(card),1);spendForce(side,pair.cost);
    if(pair.apprentice.inHand){own.hand.splice(own.hand.indexOf(pair.apprentice.card),1);own.board[site].push(pair.apprentice.card);openDeploymentReaction(side,[pair.apprentice.card]);}
    pair.apprentice.card.dagobahApprentice=true;pair.apprentice.card.dagobahMentorId=pair.mentor.card.instanceId;
    (state.tableEffects??=[]).push({card,site,target:pair.apprentice.card,mentor:pair.mentor.card,apprentice:pair.apprentice.card,dagobah:true});
    log(card.name+' richtet sich an '+pair.apprentice.card.name+' mit Mentor '+pair.mentor.card.name+'.');return true;
   }}));
  });
 });
 if(state.phase===1&&state.dagobahTrainingWindow===turn)for(const effect of state.tableEffects??[]){
  const n=DagobahRules.testNumber(effect.card);if(!n||n===3||!dagoJediCanAttempt(effect,side))continue;
  const bonuses=dagoTrainingRevision()&&n!==5?Array.from({length:dagoTrainingSites()+1},(_,i)=>dagoTrainingSites()-i):[undefined];
  for(const bonus of bonuses)options.push(dagoOption(effect.card,'testAttempt',[effect.card.instanceId,...(bonus===undefined?[]:[bonus])],'Jedi-Test '+n+' versuchen'+(bonus===undefined?'':' · Dagobah-Bonus +'+bonus),{site:effect.site,resolve(){return dagoAttemptJedi(effect,bonus);}}));
 }
 return options;
}
function dagoJediCanAttempt(effect,side){
 const {card,mentor,apprentice,site}=effect,number=DagobahRules.testNumber(card),a=dagoEntry(apprentice),m=dagoEntry(mentor);
 return (card.owner??card.side)===side&&a&&!a.unavailable&&m&&!m.unavailable&&a.slot===site&&PremiereLocations.physicalPlace(a)===site&&DagobahRules.dagobah(state.locations[m.slot])&&
  (number!==1||m.slot===site&&PremiereLocations.physicalPlace(m)===site)&&!apprentice.dagobahMeditationUntil&&!(apprentice.dagobahRestUntil>=state.game.timing.turn)&&!dagoEffects('Dark:918').length&&!dagoEffects('Light:157',side).some(rest=>rest.host===apprentice&&rest.restUntil>=state.game.timing.turn)&&!PremiereGame.wasUsed(state.game,'turn',dagoUsed(card,'attempt'));
}
function dagoTrainingModifier(effect,siteBonus=dagoTrainingSites()){
 const {mentor,apprentice,card}=effect,n=DagobahRules.testNumber(card);
 let bonus=siteBonus;
 if(mentor.id==='Light:2865'&&dagoText(mentor))bonus++;
 if(mentor.attachments?.some(card=>card.id==='Light:2873'&&!PremiereUnits.textSuppressed(card)))bonus++;
 if(apprentice.attachments?.some(card=>card.id==='Light:2078'&&!PremiereUnits.textSuppressed(card)))bonus++;
 if(apprentice.attachments?.some(card=>card.id==='Dark:1115'&&!PremiereUnits.textSuppressed(card)&&!state.tableEffects?.find(effect=>effect.card===card)?.pilotMode))bonus-=2;
 if(dagoUnits().some(entry=>entry.card===mentor&&entry.carriers.includes(apprentice))&&apprentice.attachments?.some(card=>card.id==='Light:1602'))bonus++;
 if(dagoEffects('Dark:336').length)bonus-=Math.max(0,cardAbility(apprentice)-n);
 if(dagoEffects('Light:157').some(rest=>rest.target===card&&rest.apprentice===apprentice))bonus+=3;
 return bonus;
}
function dagoAttemptJedi(effect,siteBonus){
 const side=effect.card.owner??effect.card.side;if(!dagoJediCanAttempt(effect,side))return false;
 if(siteBonus!==undefined&&(!Number.isInteger(siteBonus)||siteBonus<0||siteBonus>dagoTrainingSites()))return false;
 PremiereGame.useOnce(state.game,'turn',dagoUsed(effect.card,'attempt'));(state.dagobahTurnActivity??={})[side]={...(state.dagobahTurnActivity?.[side]??{}),test:true,turn:state.game.timing.turn};
 const n=DagobahRules.testNumber(effect.card);
 if(n===5){effect.apprentice.dagobahMeditationUntil=state.game.timing.turn+2;effect.meditation=true;return true;}
 drawDestinySeries(side,'training',1,dagoTrainingModifier(effect,siteBonus),draws=>{
  const destiny=draws.length?PremiereBattle.total(draws):null,total=destiny===null?null:destiny+cardAbility(effect.apprentice);
  log('Jedi-Test '+n+' · Trainings-Destiny '+destiny+' + Ability '+cardAbility(effect.apprentice)+' = '+total+' (benötigt > '+(11+n)+').');
  if(Number.isFinite(total)&&total>11+n)dagoCompleteJedi(effect);
 });return true;
}
function dagoCompleteJedi(effect){
 const {card,apprentice}=effect,side=card.owner??card.side,n=DagobahRules.testNumber(card);
 const at=state.tableEffects.indexOf(effect);if(at<0)return;state.tableEffects.splice(at,1);
 card.dagobahJediTest=n;(apprentice.attachments??=[]).push(card);delete apprentice.dagobahMeditationUntil;
 log(apprentice.name+' schließt Jedi-Test '+n+' ab.');
 const exchange=()=>dagoJediExchange(side,card);
 if(n===5){
  const candidates=PremiereGame.reserveCards(dagoOwn(side).deck).slice(-2).reverse();
  if(candidates.length){const choices=candidates.flatMap((chosen,index)=>(chosen.destinyValues?.length?chosen.destinyValues:[PremiereBattle.printedDestiny(chosen)]).map(value=>({args:[index,value],card:chosen,label:chosen.name+' · Destiny '+value})));
   dagoPrompt(side,card,'TestFiveCard',choices,choice=>{const chosen=choice.card,deck=dagoOwn(side).deck;deck.splice(deck.indexOf(chosen),1);card.support=[chosen];card.dagobahDestinyValue=choice.args[1];state.pendingCardView=null;exchange();return true;},{publicView:true});return;
  }
 }
 exchange();
}
function dagoJediExchange(side,source){
 const z=dagoOwn(side),tests=z.lost.filter(DagobahRules.testNumber);if(!tests.length||!z.hand.length)return;
 const choices=tests.flatMap((test,index)=>z.hand.map((card,hand)=>({args:[index,hand],card:test,label:card.name+' gegen '+test.name+' austauschen'}))).concat({args:['done'],label:'Nicht tauschen'});
 dagoPrompt(side,source,'TestExchange',choices,choice=>{state.pendingCardView=null;if(choice.args[0]!=='done'){const test=tests[choice.args[0]],card=z.hand[choice.args[1]];z.lost[z.lost.indexOf(test)]=card;z.hand[choice.args[1]]=test;}return true;});
}
function dagoJediContinuous(){
 for(const effect of (state.tableEffects??[]).slice())if(DagobahRules.testNumber(effect.card)){
  const a=dagoEntry(effect.apprentice),m=dagoEntry(effect.mentor);
  if(!a||!m||(dagoTrainingRevision()?DagobahRules.jedi(effect.apprentice):/Jedi/.test(effect.apprentice.subType))){state.tableEffects.splice(state.tableEffects.indexOf(effect),1);loseOwnedCard(effect.card,effect.card.owner??effect.card.side);}
 }
}
function dagoJediTiming(event,tasks){
 const side=state.activeSide,turn=state.game.timing.turn;
 if(event==='turn:start')state.dagobahTurnActivity={[side]:{turn}};
 if(event==='phase:start'&&state.phase===1)state.dagobahTrainingWindow=turn;
 if(event==='phase:start'&&state.phase===4)for(const effect of state.tableEffects??[])if(DagobahRules.testNumber(effect.card)===2&&(effect.card.owner??effect.card.side)===side)tasks.push(done=>{
  const choices=state.locations.flatMap((loc,to)=>adjacentSites(effect.site,to)?[{args:[to],label:loc.name}]:[]).concat({args:['done'],label:'Jedi-Test nicht versetzen'});
  dagoPrompt(PremiereGame.otherSide(effect.card.owner??effect.card.side),effect.card,'MoveTest',choices,choice=>{if(choice.args[0]!=='done')effect.site=choice.args[0];state.pendingCardView=null;done();return true;});
 });
 if(event==='turn:end')for(const effect of (state.tableEffects??[]).slice()){
  const n=DagobahRules.testNumber(effect.card),activity=state.dagobahTurnActivity?.[side];
  if(n===5&&effect.meditation&&effect.apprentice.dagobahMeditationUntil<=turn&&dagoJediCanFinishMeditation(effect,side))tasks.push(done=>{dagoCompleteJedi(effect);if(state.pendingCardView)(state.hothDeferred??=[]).push(done);else done();});
  if(n===3&&!activity?.battle&&!activity?.drain&&!activity?.test&&dagoJediCanAttempt(effect,side))tasks.push(done=>{
   const attempts=dagoTrainingRevision()?Array.from({length:dagoTrainingSites()+1},(_,i)=>({args:['attempt',dagoTrainingSites()-i],label:'Domain Of Evil versuchen · Dagobah-Bonus +'+(dagoTrainingSites()-i)})):[{args:['attempt'],label:'Domain Of Evil versuchen'}];
   dagoPrompt(side,effect.card,'AttemptThree',[...attempts,{args:['done'],label:'Nicht versuchen'}],choice=>{state.pendingCardView=null;if(choice.args[0]==='attempt')dagoAttemptJedi(effect,choice.args[1]);if(state.pendingCardView)(state.hothDeferred??=[]).push(done);else done();return true;});
  });
 }
}
function dagoJediCanFinishMeditation(effect,side){return (effect.card.owner??effect.card.side)===side&&dagoEntry(effect.apprentice)&&!dagoEntry(effect.apprentice).unavailable&&dagoEntry(effect.mentor)&&!dagoEntry(effect.mentor).unavailable;}
const dagoPerformBefore=performAction;
performAction=function(action,...rest){
 const before=state?.phase,turn=state?.game?.timing.turn,result=dagoPerformBefore(action,...rest);
 if(result&&dagobahEnabled()){
  if(before===1&&turn===state.game.timing.turn&&!(action.kind==='hothAction'&&action.args[0]==='dago:testAttempt')&&!['passResponse','finishCardInformation','loseForce','timingTrigger'].includes(action.kind))delete state.dagobahTrainingWindow;
  if(['battle','drain'].includes(action.kind))for(const side of action.kind==='battle'?PremiereGame.sides:[action.side])(state.dagobahTurnActivity??={})[side]={...(state.dagobahTurnActivity?.[side]??{}),[action.kind]:true,turn:state.game.timing.turn};
  if(action.kind==='battle')state.dagobahTurnActivity[action.side].initiatedBattle=true;
 }
 return result;
};
const dagoDrawBefore=drawDestinySeries;
drawDestinySeries=function(side,kind,count,modifier,complete){
 const source=dagobahEnabled()&&!dagoEffects('Dark:918').length&&dagoJediCards().filter(entry=>entry.side===side).flatMap(entry=>entry.card.attachments??[]).find(card=>card.dagobahJediTest===5&&card.support?.length);
 if(!source||count<=0)return dagoDrawBefore(side,kind,count,modifier,complete);
 const collected=[];
 const next=()=>{if(collected.length>=count){complete(collected);return;}
  dagoPrompt(side,source,'SubstituteDestiny',[{args:['use'],label:'Gespeicherte Destiny '+source.dagobahDestinyValue+' verwenden'},{args:['draw'],label:'Regulär Destiny ziehen'}],choice=>{
   state.pendingCardView=null;
   if(choice.args[0]==='use'){const draw={card:source.support[0],value:source.dagobahDestinyValue,cancelled:false,substituted:true};collected.push(draw);hothDestinyTriggers(side,draw,next,kind);}
   else dagoDrawBefore(side,kind,1,modifier,draws=>{if(!draws.length){complete(collected);return;}collected.push(...draws);next();});return true;
  });
 };next();
};
