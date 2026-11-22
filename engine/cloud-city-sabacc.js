'use strict';
const ccSabaccEligible=entry=>!entry.unavailable&&entry.card.type==='Character'&&CloudCityRules.city(state.locations[entry.slot])&&['gambler','smuggler','thief'].some(trait=>PremiereUnits.hasSkill(entry.card,trait));
const ccSabaccWild=card=>typeof jpSabaccWild==='function'&&jpEnabled()&&state.cloudCitySabacc?.jpVariant?jpSabaccWild(card):CloudCityRules.wild(card);
const ccSabaccClone=card=>typeof jpSabaccClone==='function'&&jpEnabled()&&state.cloudCitySabacc?.jpVariant?jpSabaccClone(card):CloudCityRules.clone(card);
const ccSabaccGambler=card=>CloudCityRules.gambler(card);
const ccSabaccValues=(hand,assigned,gambler,side)=>typeof jpSabaccValues==='function'&&jpEnabled()&&(state.cloudCitySabacc?.jpVariant||state.cloudCitySabacc?.players?.[side]?.id==='Light:722')?jpSabaccValues(hand,assigned,gambler,side):CloudCityRules.sabaccValues(hand,assigned,gambler);
const ccSabaccPerfect=(hand,modifier=0)=>hand.length===2&&!modifier&&hand.every(card=>!ccSabaccWild(card)&&!ccSabaccClone(card))&&hand.reduce((n,c)=>n+(c.destiny??0),0)===11;
const ccSabaccCards=side=>(state.cloudCitySabacc?.hands?.[side]??[]).map(card=>({...card,destiny:Math.max(0,(card.destiny??0)+clakdorDestinyModifier(card)+(tonnikaFactor(card)-1)*(card.destiny??0)+(typeof jpVulBonus==='function'&&jpEnabled()?jpVulBonus(card,'destiny'):0))}));
function ccEndSabacc(next){
 const game=state.cloudCitySabacc;if(!game)return;
 for(const side of PremiereGame.sides)ccOwn(side).used.push(...game.hands[side].splice(0));
 delete state.cloudCitySabacc;
 if(state.pendingCardView?.mode?.startsWith('hothDagCloudSabacc'))state.pendingCardView=null;
 next?.();
}
function ccSabaccDraw(side,count,next){
 const game=state.cloudCitySabacc;if(!game)return;
 if(!count){next();return;}
 dagoResolveTop(side,()=>{
  if(state.cloudCitySabacc!==game)return;
  const card=ccOwn(side).deck.pop();
  if(!card){ccEndSabacc(game.complete);return;}
  delete card.dagobahFaceUp;game.hands[side].push(card);
  dagoResolveTop(side,()=>ccSabaccDraw(side,count-1,next));
 });
}
function ccSabaccScore(side){
 const game=state.cloudCitySabacc,hand=ccSabaccCards(side),values=ccSabaccValues(hand,game.values[side],CloudCityRules.gambler(game.players[side]),side);
 const modifier=game.modifiers[side]??0;
 return {total:Math.max(0,values.reduce((a,b)=>a+b,0)+modifier),count:hand.length,perfect:ccSabaccPerfect(hand,modifier)};
}
function ccSabaccStakes(winner,perfect=false){
 const game=state.cloudCitySabacc;if(!winner){ccEndSabacc(game.complete);return;}
 const loser=PremiereGame.otherSide(winner),hand=game.hands[loser];
 const stake=card=>game.jpVariant?jpSabaccStake(card,game.jpVariant):card.type==='Weapon'||card.type==='Device'||PremiereUnits.fighter(card);
 const transfer=card=>{hand.splice(hand.indexOf(card),1);if(stake(card)){card.owner=winner;card.controller=winner;card.cloudCityStolen=true;if(card.type==='Starship')card.subType=card.subType.replace(winner==='Light'?/Imperial/g:/Rebel/g,winner==='Light'?'Rebel':'Imperial');ccOwn(winner).used.push(card);}else ccOwn(loser).lost.push(card);};
 if(perfect){for(const card of hand.slice())transfer(card);ccEndSabacc(game.complete);return;}
 let remaining=game.jpVariant==='dune'&&game.players[winner]?.id==='Light:1988'?2:1;
 const choose=()=>{
  const eligible=hand.some(stake)?hand.filter(stake):hand;
  if(!eligible.length||!remaining){ccEndSabacc(game.complete);return;}
  ccChoose(winner,game.card,'SabaccStakes',eligible.map((card,index)=>({args:[index],card,label:stake(card)?card.name+' als Einsatz übernehmen':card.name+' verlieren lassen'})),choice=>{transfer(choice.card);remaining--;choose();},{shown:hand.slice(),publicView:true});
 };choose();
}
function ccSabaccReveal(perfectWinner){
 const game=state.cloudCitySabacc;if(!game)return;
 if(perfectWinner!==undefined){
  const winner=perfectWinner==='draw'?null:perfectWinner;
  log('Cloud City Sabacc · '+(winner?winner+' gewinnt mit perfektem Sabacc.':'Beide Spieler haben perfekten Sabacc.'));
  ccChoose(game.side,game.card,'SabaccReveal',[{args:['done'],label:winner?winner+' gewinnt doppelt':'Gleichstand · Sabacc beenden'}],()=>ccSabaccStakes(winner,true),{shown:[...game.hands.Light,...game.hands.Dark],publicView:true});return;
 }
 const light=ccSabaccScore('Light'),dark=ccSabaccScore('Dark'),winner=CloudCityRules.sabaccResult(light,dark);
 log('Cloud City Sabacc · Light '+light.total+' / Dark '+dark.total+(winner?' · '+winner+' gewinnt.':' · Gleichstand.'));
 ccChoose(game.side,game.card,'SabaccReveal',[{args:['done'],label:winner?winner+' gewinnt · Einsätze abwickeln':'Gleichstand · Sabacc beenden'}],()=>ccSabaccStakes(winner,!!winner&&(winner==='Light'?light:dark).perfect),{shown:[...game.hands.Light,...game.hands.Dark],publicView:true});
}
function ccSabaccAssign(index=0){
 const game=state.cloudCitySabacc;if(!game)return;
 if(index>=2){ccSabaccReveal();return;}
 const side=index===0?PremiereGame.otherSide(game.side):game.side,hand=ccSabaccCards(side),assigned=game.values[side];
 const wild=hand.findIndex((card,i)=>ccSabaccWild(card)&&assigned[i]===undefined);
 const clone=hand.findIndex((card,i)=>ccSabaccClone(card)&&assigned[i]===undefined);
 if(wild>=0||clone>=0){
  const position=wild>=0?wild:clone;
  let values=wild>=0?(game.jpVariant==='dune'?[0,1,2,3,4,5,6,7]:[1,2,3,4,5,6]):[...new Set(hand.flatMap((card,i)=>ccSabaccClone(card)?[]:[ccSabaccWild(card)?assigned[i]:card.destiny??0]))];
  if(wild<0&&(!game.jpVariant&&CloudCityRules.gambler(game.players[side])||game.jpVariant==='palace'&&(CloudCityRules.gambler(game.players[side])||ccPersona(game.players[side],'Jabba'))))values=[...new Set([game.jpVariant?4:0,...values])];
  if(wild<0&&!values.length)values=[0];
  if(wild<0&&game.players[side]?.id==='Light:722')values=[...new Set([game.players[side].destiny??0,...values])];
  ccChoose(side,game.card,'SabaccValue',values.map(value=>({args:[value],label:hand[position].name+' = '+value})),choice=>{assigned[position]=choice.args[0];ccSabaccAssign(index);},{shown:game.hands[side].slice(),publicView:false,
   botChoice:offers=>offers.reduce((best,offer)=>Math.abs(11-(hand.reduce((sum,card,i)=>sum+(i===position?offer.args[0]:ccSabaccClone(card)?0:assigned[i]??card.destiny??0),0)))<Math.abs(11-(hand.reduce((sum,card,i)=>sum+(i===position?best.args[0]:ccSabaccClone(card)?0:assigned[i]??card.destiny??0),0)))?offer:best)});
  return;
 }
 if(game.modifiers[side]===undefined&&game.players[side]&&ccPersona(game.players[side],'Lando')&&ccText(game.players[side])){
  const base=ccSabaccValues(hand,assigned,CloudCityRules.gambler(game.players[side]),side).reduce((a,b)=>a+b,0);
  ccChoose(side,game.card,'SabaccLando',[-1,0,1].map(amount=>({args:[amount],label:'Lando · Gesamtwert '+Math.max(0,base+amount)})),choice=>{game.modifiers[side]=choice.args[0];ccSabaccAssign(index+1);},{shown:game.hands[side].slice(),botChoice:offers=>offers.reduce((best,offer)=>Math.abs(11-base-offer.args[0])<Math.abs(11-base-best.args[0])?offer:best)});
 }else ccSabaccAssign(index+1);
}
function ccSabaccTurn(side){
 const game=state.cloudCitySabacc;if(!game)return;
 if(game.passed.Light&&game.passed.Dark){ccSabaccAssign();return;}
 if(game.passed[side]){ccSabaccTurn(PremiereGame.otherSide(side));return;}
 if(game.hands[side].length>=6||!PremiereGame.reserveCards(ccOwn(side).deck).length){game.passed[side]=true;ccSabaccTurn(PremiereGame.otherSide(side));return;}
 ccChoose(side,game.card,'SabaccDraw',[{args:['draw'],label:'Eine weitere Sabacc-Karte ziehen'},{args:['pass'],label:'Passen · keine weiteren Karten ziehen'}],choice=>{
  if(choice.args[0]==='pass'){game.passed[side]=true;ccSabaccTurn(PremiereGame.otherSide(side));}
  else ccSabaccDraw(side,1,()=>ccSabaccTurn(PremiereGame.otherSide(side)));
 },{shown:game.hands[side].slice(),publicView:false,botChoice:offers=>offers.find(offer=>offer.args[0]===(ccSabaccCards(side).reduce((sum,card)=>sum+(ccSabaccWild(card)?1:ccSabaccClone(card)?0:card.destiny??0),0)>=8?'pass':'draw'))});
}
function ccStartSabacc(side,source,participant,complete){
 const enemy=PremiereGame.otherSide(side),jpVariant=typeof jpSabaccVariant==='function'&&jpEnabled()?jpSabaccVariant(source):null,candidates=ccUnits().filter(entry=>entry.side===enemy&&(jpVariant?jpSabaccEligible(entry,source):ccSabaccEligible(entry)));
 const game=state.cloudCitySabacc={side,card:source,jpVariant,players:{[side]:participant,[enemy]:null},hands:{Light:[],Dark:[]},values:{Light:[],Dark:[]},modifiers:{},passed:{Light:false,Dark:false},complete};
 const deal=()=>ccSabaccDraw(side,2,()=>ccSabaccDraw(enemy,2,()=>{
  const perfect=PremiereGame.sides.map(actor=>ccSabaccPerfect(ccSabaccCards(actor)));
  if(perfect.some(Boolean))ccSabaccReveal(perfect.every(Boolean)?'draw':perfect[0]?'Light':'Dark');else ccSabaccTurn(enemy);
 }));
 if(!candidates.length){deal();return;}
 ccChoose(enemy,source,'SabaccPlayer',candidates.map((entry,index)=>({args:[index],card:entry.card,label:entry.card.name+' am Sabacc beteiligen'})).concat({args:['none'],label:'Ohne eigenen Charakter spielen'}),choice=>{if(choice.card)game.players[enemy]=choice.card;deal();});
}
const ccSabaccBefore={options:hothInterruptOptions,settle:settleHothInterrupt};
hothInterruptOptions=function(side,window=null){
 const out=ccSabaccBefore.options(side,window);if(!cloudCityEnabled()||window||battleSession||state.cloudCitySabacc||!PremiereGame.sides.every(actor=>PremiereGame.reserveCards(ccOwn(actor).deck).length>=2))return out;
 const participants=ccUnits().filter(entry=>entry.side===side&&ccSabaccEligible(entry));
 ccOwn(side).hand.forEach((card,index)=>{if(!['Light:433','Dark:432'].includes(card.id))return;for(const [i,entry] of participants.entries())out.push({card,index,mode:'cc:sabacc',choice:[index,'cc:sabacc',i],label:card.name+' · '+entry.card.name,cost:0,rule:{pile:card.subType==='Used'?'Used':'Lost'},participant:entry.card});});return out;
};
settleHothInterrupt=function(frame,parent){if(cloudCityEnabled()&&frame.mode==='cc:sabacc'){if(frame.cancelled){finishPileInterrupt(frame);return;}ccStartSabacc(frame.side,frame.card,frame.participant,()=>finishPileInterrupt(frame));}else ccSabaccBefore.settle(frame,parent);};

ccContinuousProviders.push(()=>{const game=state.cloudCitySabacc;if(game){const entry=ccEntry(game.players[game.side]);if(!entry||entry.unavailable){log('Sabacc endet: Der auslösende Teilnehmer ist nicht mehr verfügbar.');ccEndSabacc(game.complete);}}});
