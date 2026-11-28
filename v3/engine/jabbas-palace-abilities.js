'use strict';
let jpEnumerating=false;
function jpDeployOptions(side,source,pile,filter,{free=false,site=null,host=null,react=false}={}){
 if(jpEnumerating)return [];const own=jpOwn(side),cards=own[pile].filter(filter),out=[];jpEnumerating=true;
 try{for(const card of cards){const handIndex=own.hand.length;own.hand.push(card);const oldFree=state.jpFreeDeploy;state.jpFreeDeploy=free?card:null;
  let actions;try{actions=ccAsDeployment(side,()=>legalActions(state,side).filter(a=>a.card===card&&(['deploy','deployWithPilot','equip','deployDevice','deployBolt','deployAutomated','deployLocationEffect','deployTableEffect','deployLostPileEffect','transport','hothAction'].includes(a.kind))&&(!Number.isInteger(site)||ccNabrunDeployment(a,site))&&(!host||a.host===host||a.carrier===host||a.target===host)));}finally{own.hand.splice(handIndex,1);state.jpFreeDeploy=oldFree;}
  for(const action of actions)out.push(jpOption(source,'deployReserve',[source.instanceId,pile,card.instanceId,action.kind,...action.args],card.name+' · '+(action.label??'aus '+pile+' ausspielen'),()=>{const i=own[pile].indexOf(card);if(i<0)return false;own[pile].splice(i,1);own.hand.push(card);const previous=state.jpFreeDeploy;state.jpFreeDeploy=free?card:null;let result;try{result=ccAsDeployment(side,()=>executeAction(action));}finally{state.jpFreeDeploy=previous;}
   if(!result||own.hand.includes(card)){const at=own.hand.indexOf(card);if(at>=0){own.hand.splice(at,1);own[pile].splice(i,0,card);}if(!result)return false;}
   if(pile==='deck')own.deck.splice(0,own.deck.length,...PremiereGame.shuffleReserve(own.deck,state.game));if(react)(state.reactedThisTurn??=[]).push(card);return true;
  },{cost:free?0:action.cost??0,site:action.site??action.to??action.slot,card,target:action.target,host:action.host}));
 }}finally{jpEnumerating=false;}return out;
}
function jpOfferDeploy(side,source,pile,filter,settings,done=()=>{}){
 const choices=jpDeployOptions(side,source,pile,filter,settings).map((option,i)=>({args:[i],option,card:option.card,label:option.label}));choices.push({args:['pass'],label:'Nicht deployen'});
 jpChoose(side,source,'Deploy',choices,choice=>{if(choice.option)choice.option.resolve(side);done();});
}
function jpPeek(side,source,cards,done=()=>{}){jpChoose(side,source,'Peek',[{args:['done'],label:'Schließen'}],done,{shown:cards.slice(),publicView:false});}
function jpReorder(side,source,pile,done=()=>{}){const remaining=pile.slice(),chosen=[];const choose=()=>{if(!remaining.length){pile.splice(0,pile.length,...chosen);done();return;}jpChoose(side,source,'Order',remaining.map((card,i)=>({args:[i],card,label:card.name+' · nächste Karte von unten'})),choice=>{remaining.splice(remaining.indexOf(choice.card),1);chosen.push(choice.card);choose();},{shown:remaining.slice(),publicView:false});};choose();}
function jpRelease(card,site){const e=jpEntry(card);if(!e||!card.captured)return false;if(!detachTableCard(e.side,e.slot,card))return false;if(card.imprisoned||card.frozen){rallyCaptive(card,site);return true;}(state.pendingCustody??=[]).push({side:'Light',card,slot:site,released:true});return true;}
function jpAbilityOptions(side){
 if(jpEnumerating||!jpEnabled())return [];const out=[],own=jpOwn(side),enemy=PremiereGame.otherSide(side),active=state.activeSide===side,control=active&&state.phase===1&&!battleSession,turn=state.game.timing.turn;
 for(const [index,e]of jpUnits().entries()){
  const card=e.card;if(e.side!==side||e.unavailable||!jpLive(card))continue;
  const add=(mode,label,cost,resolve,args=[],scope='turn')=>{if(cost<=forceBudget(side)&&jpUnused(card,mode,scope))out.push(jpOnce(card,mode,[index,...args],label,cost,resolve,scope));};
  const search=(filter,cost=0,allowed=control,mode='search')=>{if(allowed&&own.deck.some(filter))add(mode,'Reserve Deck durchsuchen ('+cost+' Force)',cost,()=>{dagoSearch(side,card,'deck',filter);return true;});};
  if(card.id==='Light:136')search(c=>['Light:1132','Light:25'].includes(c.id));
  if(['Light:174','Dark:1128'].includes(card.id))search(c=>jpTitle(c)==='utinni!'||jpSpecies(c,'jawa'));
  if(card.id==='Dark:887')search(c=>jpTitle(c)==='torture'||/power droid/i.test((c.characteristics??[]).join(' ')+c.lore));
  if(card.id==='Dark:1713')search(c=>c.subType==='Alien'&&c!==card&&['smuggler','information broker','thief','spy'].some(t=>characterTraits(c).includes(t)),3,control&&jpPalace(state.locations[e.slot])&&jpControl(side,e.slot));
  if(card.id==='Dark:2724')search(c=>c.type==='Weapon'&&c.subType==='Vehicle',0,control&&ccPresent(side,e.slot).some(c=>jpSpecies(c,'advosze')));
  if(card.id==='Dark:2906')search(c=>jpTitle(c)==='we have a prisoner',0,control&&ccPresent(side,e.slot).some(c=>PremiereUnits.bountyHunter(c)||jpSpecies(c,'rodian')));
  if(card.id==='Light:1014')search(c=>isSite(c)&&sitePlanet(c)===sitePlanet(state.locations[e.slot]),2,control&&isExteriorPlanetSite(state.locations[e.slot]));
  if(card.id==='Light:2903'&&control&&own.lost.some(c=>['Device','Weapon'].includes(c.type)))add('lostEquipment','Waffe/Gerät aus Lost Pile nehmen',3,()=>{dagoSearch(side,card,'lost',c=>['Weapon','Device'].includes(c.type));return true;});
  if(card.id==='Light:197'){
   const top=own.lost.at(-1);if(top&&(['Weapon','Device'].includes(top.type)||top.type==='Vehicle'&&/Transport/.test(top.subType??'')))add('retrieveTop',top.name+' zurückholen',1,()=>{PremiereGame.retrieveForce(state,side,1);return true;});
   if(control&&own.hand.length&&own.lost.some(c=>['Weapon','Device'].includes(c.type)))for(const [i,c]of own.hand.entries())add('exchange',c.name+' gegen Waffe/Gerät tauschen',0,()=>{own.hand.splice(own.hand.indexOf(c),1);own.used.push(c);dagoSearch(side,card,'lost',c=>['Weapon','Device'].includes(c.type));return true;},[i]);
  }
  if(card.id==='Light:387'&&control&&jpOwn(enemy).hand.length)add('stealHand','Zufällige gegnerische Handkarte ansehen',0,()=>{const hand=jpOwn(enemy).hand,target=hand[Math.floor(PremiereGame.random(state.game)*hand.length)];jpChoose(side,card,'Chadra',[{args:['done'],label:target.type==='Weapon'&&target.subType==='Character'?'Waffe stehlen':'Schließen'}],()=>{if(target.type==='Weapon'&&target.subType==='Character'){hand.splice(hand.indexOf(target),1);target.owner=side;target.controller=side;own.hand.push(target);}},{shown:[target],publicView:false});return true;});
  if(card.id==='Light:1329'&&active&&state.phase===5&&own.deck.length)for(const [i,c]of own.hand.entries())add('drawExchange',c.name+' unter Used legen und Reserve-Karte ziehen',0,()=>{own.hand.splice(own.hand.indexOf(c),1);own.used.unshift(c);dagoDrawIntoHand(side,1,()=>{});return true;},[i]);
  if(card.id==='Light:1393'&&active)for(const [i,target]of ccPresent(enemy,e.slot).entries())if(target.subType==='Alien'&&!JabbasPalaceRules.female(target)&&cardAbility(target)<3)add('charm',target.name+' · Forfeit 0',1,()=>{target.jpForfeitZeroTurn=turn;return true;},[i]);
  if(card.id==='Light:1842'&&control&&jpOwn(enemy).hand.length)add('revealHand','Gegnerische Hand offenlegen',jpOwn(enemy).hand.length,()=>{const hand=jpOwn(enemy).hand;jpChoose(side,card,'Oola',[{args:['done'],label:'Einzigartige männliche Imperials/Aliens unter Used legen'}],()=>{for(const c of hand.slice())if(c.type==='Character'&&c.uniquenessLimit===1&&!JabbasPalaceRules.female(c)&&['Imperial','Alien'].includes(c.subType)){hand.splice(hand.indexOf(c),1);jpOwn(enemy).used.push(c);}},{shown:hand.slice(),publicView:true});return true;});
  if(card.id==='Light:2087'&&active&&forceBudget(side)>=1&&(card.jpPowerTurn!==turn||(card.jpPowerBonus??0)<3))out.push(jpOption(card,'rennekPower',[index],'Power +1 (1 Force; höchstens dreimal)',()=>{spendForce(side,1);if(card.jpPowerTurn!==turn)card.jpPowerBonus=0;card.jpPowerTurn=turn;card.jpPowerBonus++;return true;},{cost:1}));
  if(card.id==='Light:2156'&&battleSession?.site===e.slot&&ccPresent(enemy,e.slot).some(c=>c.subType==='Alien'))for(const actor of PremiereGame.sides)if(jpOwn(actor).deck.length)add('peek'+actor,actor+' Reserve-Deck oben ansehen',3,()=>{dagoResolveTop(actor,()=>jpPeek(side,card,[jpOwn(actor).deck.at(-1)].filter(Boolean)));return true;},[actor],'battle');
  if(card.id==='Light:2247'&&!active&&state.phase===1&&!battleSession&&jpOwn(enemy).force.length)add('reorderForce','Gegnerischen Force Pile ansehen und ordnen',3,()=>{jpReorder(side,card,jpOwn(enemy).force);return true;});
  if(card.id==='Dark:2706'&&control&&jpPalace(state.locations[e.slot]))add('wager','Wette: niedrigerer Draw verliert 1 Force',2,()=>{drawDestinySeries(side,'jpWager',1,0,a=>drawDestinySeries(enemy,'jpWager',1,0,b=>{if(a.length&&b.length&&PremiereBattle.total(a)!==PremiereBattle.total(b))dagoLoss(PremiereBattle.total(a)<PremiereBattle.total(b)?side:enemy,1,card.name);}));return true;});
  if(card.id==='Dark:1633'&&control)for(const [i,target]of jpUnits().entries())if(target.card!==card&&PremiereLocations.physicalPlace(target)===PremiereLocations.physicalPlace(e)&&!target.unavailable&&(target.card.type==='Creature'||HothRules.creatureVehicle(target.card)&&!(target.card.occupants?.length)))add('snare',target.card.name+' stehlen',0,()=>{if(!detachTableCard(target.side,target.slot,target.card))return false;target.card.owner=side;target.card.controller=side;own.board[e.slot].push(target.card);return true;},[i]);
  if(card.id==='Light:2844'&&control)for(const [i,target]of jpUnits().entries())if(target.slot===e.slot&&target.card.undercover)add('breakCover',target.card.name+' enttarnen',0,()=>{drawDestinySeries(side,'jpYarkora',1,0,draws=>{if(!draws.length)return;const base=PremiereBattle.total(draws),count=jpAll(side).filter(e=>jpSpecies(e.card,'yarkora')).length;jpChoose(side,card,'Yarkora',Array.from({length:count+1},(_,n)=>({args:[n],label:'Destiny '+(base-n)})),choice=>{if(base-choice.args[0]===cardAbility(target.card))delete target.card.undercover;});});return true;},[i]);
  if(card.id==='Light:13'&&active){const prisoners=jpUnits().filter(target=>target.slot===e.slot&&target.card.imprisoned);if(prisoners.length)add('release','Zufälligen inhaftierten Gefangenen befreien',0,()=>{drawDestinySeries(side,'jp8D8',1,0,draws=>{if(draws.length&&PremiereBattle.total(draws)>3){const p=prisoners[Math.floor(PremiereGame.random(state.game)*prisoners.length)];jpRelease(p.card,p.slot);}});return true;});}
  if(card.id==='Light:2415'&&active&&state.phase===2&&jpUnused(card,'undercover','game'))for(const option of jpDeployOptions(side,card,'deck',c=>jpTitle(c)==='undercover',{host:card,site:e.slot})){const resolve=option.resolve;option.resolve=actor=>{ccMark(card,'jp:undercover','game');return resolve(actor);};out.push(option);}
  if(card.id==='Light:1964'&&active&&state.phase===2&&CloudCityRules.city(state.locations[e.slot])&&jpUnused(card,'deployRebel'))for(const option of jpDeployOptions(side,card,'deck',c=>c.subType==='Rebel'&&JabbasPalaceRules.nonunique(c),{site:e.slot})){const resolve=option.resolve;option.resolve=actor=>{ccMark(card,'jp:deployRebel');return resolve(actor);};out.push(option);}
 }
 return out;
}
ccProviders.push(side=>jpEnabled()?jpAbilityOptions(side):[]);
const jpFreeBase={crew:crewDeployCost,weapon:weaponDeployCost};
crewDeployCost=function(card,...args){return jpEnabled()&&state.jpFreeDeploy===card?0:jpFreeBase.crew(card,...args);};
weaponDeployCost=function(card,...args){return jpEnabled()&&state.jpFreeDeploy===card?0:jpFreeBase.weapon(card,...args);};
