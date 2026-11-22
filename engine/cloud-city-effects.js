'use strict';
function ccAllEffects(){return [...state.tableEffects??[],...Object.entries(state.locationEffects??{}).flatMap(([site,list])=>list.map(effect=>({...effect,site:Number(site)})))];}
function ccAtSame(a,b){const x=ccEntry(a),y=ccEntry(b);return !!x&&!!y&&PremiereLocations.physicalPlace(x)===PremiereLocations.physicalPlace(y);}
function ccRebelBase(slot){return /hoth|yavin 4/.test(ccPlanet(state.locations[slot])??'');}
function ccDecree(side){return ccEffects('Dark:1268',side).length>0&&(state.locations.filter((loc,i)=>ccRebelBase(i)&&ccControl(side,i)).length>=2||state.locations.some((loc,i)=>isSite(loc)&&loc.locationTags?.includes('Planet')&&ccControl(side,i))&&state.locations.filter((loc,i)=>loc?.type==='Location'&&loc.subType==='System'&&ccControl(side,i)).length>=2);}
function ccLeiaNear(side,slot){return ccEffects('Light:1493',side).some(effect=>{const entry=ccEntry(effect.host);return entry&&!entry.unavailable&&ccRebelBase(entry.slot)&&(entry.slot===slot||adjacentSites(entry.slot,slot));});}
function ccFrozenAt(slot){return ccUnits().some(entry=>entry.slot===slot&&entry.card.frozen);}
function ccEffectOptions(side,window=null){
 const out=[],own=ccOwn(side),enemy=PremiereGame.otherSide(side),all=ccUnits();
 const add=(card,index,args,label,extra={})=>{const cost=extra.cost??0;if(cost<=forceBudget(side)&&withinDeploymentLimit(card,side))out.push({card,index,choice:[index,...args],label:card.name+' · '+label,cost,...extra});};
 own.hand.forEach((card,index)=>{
  if(card.set!=='5'||card.type!=='Effect'||ccOwner(card)!==side)return;
  if(window){
   if(card.id==='Dark:87'&&window.kind==='cloudCityWouldHit'&&window.shot?.target.type==='Character'&&/lightsaber/i.test(window.shot.weapon.name)&&/carbonite chamber/.test(ccTitle(state.locations[window.site]))&&['hit','zero'].includes(window.shot.effect))add(card,index,[],'Getroffenen Charakter einfrieren',{host:window.shot.target,site:window.site,freezeHit:true});
   if(card.id==='Dark:714'&&['cloudCityFrozen','cloudCityCaptured'].includes(window.kind)&&window.target?.subType==='Rebel')all.forEach((entry,i)=>{if(!entry.unavailable&&entry.card!==window.target&&entry.card.subType==='Rebel')add(card,index,[i],entry.card.name,{host:entry.card,captive:window.target});});
   if(card.id==='Dark:2524'&&window.kind==='cloudCityFrozen'&&ccPersona(window.target,'Luke')&&all.some(entry=>entry.side===side&&!entry.unavailable&&ccPersona(entry.card,'Vader'))){
    state.locations.forEach((loc,site)=>{if(/detention block corridor/.test(ccTitle(loc)))add(card,index,[site],'Luke und Vader hierher bringen',{site,captive:window.target,target:window.target});});
    all.forEach((entry,i)=>{if(ccPersona(entry.card,'Emperor')&&!entry.unavailable)add(card,index,[i],entry.card.name,{host:entry.card,captive:window.target,target:window.target});});
   }
   if(['Light:66','Dark:1201','Dark:1701'].includes(card.id)&&['battleEnd','cloudCityDuelEnd'].includes(window.kind)&&window.winner===side){
    const involved=window.participants??{},fallen=window.fallen??[];
    if(card.id==='Light:66')for(const target of fallen)if(ccOwner(target)===enemy&&cardAbility(target)>3)for(const [i,entry]of all.entries())if(entry.side===side&&!entry.unavailable&&involved[side]?.includes(entry.card)&&PremiereUnits.hasSkill(entry.card,'warrior'))add(card,index,[i],entry.card.name,{host:entry.card,darkJedi:/Dark Jedi/.test(target.abilityType??'')||cardAbility(target)>=6});
    if(card.id==='Dark:1201'&&involved.Dark?.some(unit=>ccPersona(unit,'Vader')))all.forEach((entry,i)=>{if(entry.side===enemy&&ccPersona(entry.card,'Luke')&&cardAbility(entry.card)<6&&involved.Light?.includes(entry.card))add(card,index,[i],entry.card.name,{host:entry.card});});
    if(card.id==='Dark:1701'&&involved[side]?.some(unit=>ownLightsaber(unit)))all.forEach((entry,i)=>{if(entry.side===enemy&&!entry.unavailable&&entry.card.type==='Character'&&entry.slot===window.site)add(card,index,[i],entry.card.name+' entwaffnen',{host:entry.card});});
   }
   return;
  }
  if(state.activeSide!==side||state.phase!==2||battleSession)return;
  const tableCosts={'Light:392':0,'Dark:48':0,'Light:414':0,'Dark:46':0,'Light:583':3,'Light:989':0,'Dark:1268':0};
  if(Object.hasOwn(tableCosts,card.id))add(card,index,[],'Auf Tisch auslegen',{cost:tableCosts[card.id]});
  if(card.id==='Light:989')add(card,index,['force'],'Gegnerischen Force Pile sperren',{forceBarrier:enemy,blockedForce:ccOwn(enemy).force.slice(),expires:state.game.timing.turn+(state.activeSide===enemy?0:1)});
  if(['Light:54','Dark:2101'].includes(card.id)){
   if(!own.deck.some(unit=>unit.id===card.id))add(card,index,['insert'],'Eigenes Reserve Deck vor Inserts schützen',{insertOwn:true});
   for(const from of state.locationOrder??[])for(const to of state.locationOrder??[])if(from<to&&adjacentSites(from,to)&&[from,to].every(slot=>state.locations[slot]?.locationTags?.includes('Mobile')))add(card,index,[from,to],'Zugang zwischen zwei mobilen Sites',{site:from,to});
  }
  state.locations.forEach((loc,site)=>{
   if(!loc)return;
   if(card.id==='Light:84'&&isSite(loc)&&confirmedPresence(side,site)===true)add(card,index,[site],loc.name,{site,cost:2});
   if(card.id==='Light:217'&&CloudCityRules.sector(loc))add(card,index,[site],loc.name,{site});
   if(card.id==='Light:1112'&&loc.subType==='System'&&['rendezvous point','hoth','yavin 4','alderaan','sullust'].includes(ccTitle(loc)))add(card,index,[site],loc.name,{site});
   if(card.id==='Dark:614'&&CloudCityRules.sector(loc)&&ccControl(side,site)&&state.locations.filter((unit,i)=>CloudCityRules.city(unit)&&ccControl(side,i)).length>=3)add(card,index,[site],loc.name,{site});
   if(card.id==='Dark:2323'&&PremiereLocations.prison(loc))add(card,index,[site],loc.name,{site});
   if(card.id==='Dark:972'&&PremiereLocations.conditions(state,site,side).dockingBay)all.forEach((entry,i)=>{if(entry.side===enemy&&!entry.unavailable&&PremiereUnits.fighter(entry.card)&&ccPlanet(state.locations[entry.slot])===ccPlanet(loc)&&(CloudCityRules.cloud(state.locations[entry.slot])||state.locations[entry.slot]?.subType==='System'))add(card,index,[site,i],entry.card.name+' → '+loc.name,{site,target:entry.card});});
  });
  all.forEach((entry,i)=>{
   const host=entry.card;
   if(card.id==='Dark:2768'&&all.some(entry=>entry.side===enemy&&!entry.unavailable&&ccPersona(entry.card,'Luke'))&&host.captured&&['Han','Leia','Chewie'].some(persona=>ccPersona(host,persona)))add(card,index,[i],host.name,{host,target:all.find(e=>ccPersona(e.card,'Luke'))?.card??'Luke'});
   if(entry.unavailable)return;
   if(card.id==='Light:737'&&isDroid(host)&&Number.isFinite(host.armor))add(card,index,[i],host.name,{host,cost:/ig-88/.test(ccTitle(host))?0:4});
   if(['Light:1132','Light:1157'].includes(card.id)&&entry.side===side&&isDroid(host))add(card,index,[i],host.name,{host});
   if(card.id==='Light:1145'&&ccPersona(host,'C-3PO'))add(card,index,[i],host.name,{host});
   if(card.id==='Light:1493'&&ccPersona(host,'Leia'))add(card,index,[i],host.name,{host});
   if(card.id==='Light:2670'&&ccPersona(host,'Vader'))add(card,index,[i],host.name,{host});
   if(card.id==='Dark:316'&&entry.side===enemy&&host.type==='Character'&&!isDroid(host))add(card,index,[i],host.name,{host});
   if(card.id==='Dark:2697'&&host.subType==='Rebel'&&cardAbility(host)>2)add(card,index,[i],host.name,{host});
   if(card.id==='Dark:1210'&&entry.side===enemy&&CloudCityRules.gambler(host))add(card,index,[i],host.name,{host});
   if(card.id==='Dark:2699'&&entry.side===side&&['Imperial','Alien'].includes(host.subType))add(card,index,[i],host.name,{host,cost:3});
  });
 });return out;
}
const ccEffectBase={options:hothEffectOptions,settle:settleHothEffect,power:cardPowerModifier,total:hothBattlePower,charCost:characterDeployCost,crewCost:crewDeployCost,craftCost:craftDeployCost,immunity:battleImmunity,draws:battleDestinyDrawCount,ability:cardAbility,forfeit:cardForfeitValueAt,stats:craftStats,text:PremiereUnits.textSuppressed,drain:forceDrainEffects,move:hothMovementAllowed,travel:travelOptions,deploy:openDeploymentReaction,begin:initiateBattleFor,lose:loseTableCard,cancel:cancelTableEffect};
hothEffectOptions=function(side,window=null){return ccEffectBase.options(side,window).concat(cloudCityEnabled()?ccEffectOptions(side,window):[]);};
settleHothEffect=function(frame){
 if(!cloudCityEnabled()||frame.card.set!=='5')return ccEffectBase.settle(frame);
 if(frame.cancelled){loseOwnedCard(frame.card,frame.side);return;}
 const {card,side,host}=frame;
 if(frame.insertOwn){card.insertedIntoReserveBy=side;const deck=ccOwn(side).deck;deck.push(card);deck.splice(0,deck.length,...PremiereGame.shuffleReserve(deck,state.game));return;}
 const effect={...frame,target:frame.target??side,cloudCity:true};delete effect.kind;
 if(host){(host.attachments??=[]).push(card);(state.tableEffects??=[]).push(effect);}else if(Number.isInteger(frame.site))(state.locationEffects[frame.site]??=[]).push(effect);else(state.tableEffects??=[]).push(effect);
 if(frame.freezeHit){const target=ccEntry(host);if(target&&!host.captured){const attempt={kind:'cloudCityFreezeResult',side,card,target:host,site:target.slot,total:Infinity};withShipWeaponResponse(attempt,answer=>{if((answer??attempt).cancelled){hothCancelEffect(effect);return;}if(captureCharacter(host,target.slot)){host.frozen=true;const original=state.game.responses.find(window=>window.kind==='cloudCityWouldHit'&&window.shot?.target===host);if(original)original.replaced=true;queueRuleResponse({kind:'cloudCityFrozen',side,target:host,site:target.slot});}});}}
 if(card.id==='Dark:1701'){
  for(const device of [...host.attachments??[]])if(device.id==='Light:244'){host.attachments.splice(host.attachments.indexOf(device),1);loseOwnedCard(device,ccOwner(device));}
  for(const weapon of host.weapons??[])loseOwnedCard(weapon,ccOwner(weapon));host.weapons=[];
 }
};
function ccEffectDeployBonus(card,side,slot){let bonus=0;
 if(card.subType==='Rebel'&&ccEffects('Light:989',side).some(effect=>!effect.forceBarrier)&&ccFrozenAt(slot))bonus-=2;
 if(card.subType==='Rebel'&&card.uniquenessLimit!==1&&ccLeiaNear(side,slot))bonus-=2;
 if(card.type==='Starship'&&PremiereUnits.fighter(card)&&card.uniquenessLimit!==1&&ccEffects('Light:1493',side).some(effect=>ccEntry(effect.host)?.slot===slot&&state.locations[slot]?.subType==='System'))bonus-=2;
 if(ccEffects('Light:1112',side).some(effect=>effect.site===slot))bonus-=card.type==='Starship'?2:card.pilot?1:0;
 return bonus;
}
characterDeployCost=function(card,loc,side){const cost=ccEffectBase.charCost(card,loc,side);return cost===null||!cloudCityEnabled()?cost:Math.max(0,cost+ccEffectDeployBonus(card,side,state.locations.indexOf(loc)));};
crewDeployCost=function(card,side,loc){const cost=ccEffectBase.crewCost(card,side,loc);return cloudCityEnabled()?Math.max(0,cost+ccEffectDeployBonus(card,side,state.locations.indexOf(loc))):cost;};
craftDeployCost=function(card,loc,side,...rest){const cost=ccEffectBase.craftCost(card,loc,side,...rest);return cost===null||!cloudCityEnabled()?cost:Math.max(0,cost+ccEffectDeployBonus(card,side,state.locations.indexOf(loc)));};
cardPowerModifier=function(card,side,slot,present){let value=ccEffectBase.power(card,side,slot,present);if(!cloudCityEnabled())return value;
 if(card.subType==='Rebel'&&battleSession?.site===slot&&ccEffects('Light:989',side).some(effect=>!effect.forceBarrier)&&ccFrozenAt(slot))value+=2;
 if(card.subType==='Rebel'&&card.uniquenessLimit!==1&&ccLeiaNear(side,slot))value+=2;
 for(const effect of ccAllEffects().filter(effect=>effect.host===card&&ccText(effect.card))){if(['Light:66','Light:2670'].includes(effect.card.id))value+=2;if(effect.card.id==='Dark:1701')value--;}
 if(ccEffects('Dark:1201').some(effect=>effect.host===card&&ccUnits().some(entry=>ccPersona(entry.card,'Vader')&&entry.slot===slot&&!entry.unavailable)))return -(card.power??0);
 return value;
};
hothBattlePower=function(side,slot){return ccEffectBase.total(side,slot)+(cloudCityEnabled()&&CloudCityRules.city(state.locations[slot])&&ccEffects('Dark:614',side).length?4:0);};
battleImmunity=function(side,card,slot,...args){if(cloudCityEnabled()){if(card.cloudCityChasmTurn===state.game.timing.turn)return 0;if(card.attachments?.some(effect=>effect.id==='Dark:2699'&&ccText(effect)))return Math.max(5,ccEffectBase.immunity(side,card,slot,...args));}return ccEffectBase.immunity(side,card,slot,...args);};
PremiereUnits.textSuppressed=function(card){return ccEffectBase.text(card)||cloudCityEnabled()&&!!card?.attachments?.some(effect=>effect.id==='Dark:1210'&&!ccEffectBase.text(effect));};
let ccDestinySuppression=null;
cardAbility=function(card){return cloudCityEnabled()&&ccDestinySuppression?.has(card)?0:ccEffectBase.ability(card);};
battleDestinyDrawCount=function(side,slot,ability,...rest){
 if(!cloudCityEnabled())return ccEffectBase.draws(side,slot,ability,...rest);
 const suppressed=new Set(ccEffects('Dark:714').map(effect=>effect.host));for(const entry of ccUnits())if(entry.card.cloudCityNoAbilityTurn===state.game.timing.turn)suppressed.add(entry.card);
 const reduction=ccUnits().filter(entry=>entry.side===side&&entry.slot===slot&&!entry.unavailable&&suppressed.has(entry.card)).reduce((n,entry)=>n+(ccEffectBase.ability(entry.card)??0),0);let draws;
 ccDestinySuppression=suppressed;try{draws=ccEffectBase.draws(side,slot,Math.max(0,ability-reduction),...rest);}finally{ccDestinySuppression=null;}

 return draws;
};
cardForfeitValueAt=function(card,side,slot,...args){if(cloudCityEnabled()&&ccEffects('Dark:1201').some(effect=>effect.host===card&&ccUnits().some(entry=>ccPersona(entry.card,'Vader')&&entry.slot===slot&&!entry.unavailable)))return 0;return ccEffectBase.forfeit(card,side,slot,...args);};
forceDrainEffects=function(side,slot){const plan=ccEffectBase.drain(side,slot);if(!plan||!cloudCityEnabled())return plan;let modifier=plan.modifier;if(CloudCityRules.city(state.locations[slot])&&ccEffects('Dark:614',side).length&&!dagoCompleted(PremiereGame.otherSide(side),1))modifier+=2;if(ccDecree(PremiereGame.otherSide(side)))modifier=Math.min(0,modifier);return {...plan,modifier};};
hothMovementAllowed=function(side,card,from,to,kind){if(!ccEffectBase.move(side,card,from,to,kind)||!cloudCityEnabled())return !cloudCityEnabled()?ccEffectBase.move(side,card,from,to,kind):false;return !ccEffects('Dark:972').some(effect=>effect.target===card&&to!==effect.site&&ccPlanet(state.locations[to])!==ccPlanet(state.locations[effect.site]));};
travelOptions=function(card,side,from,to,react=false){
 const options=ccEffectBase.travel(card,side,from,to,react);if(!cloudCityEnabled()||card.type!=='Character')return options;
 const order=boardLocationOrder(),a=order.indexOf(from),b=order.indexOf(to),path=order.slice(Math.min(a,b),Math.max(a,b)+1),titles=new Set();
 for(const effect of ccAllEffects())if(['Light:54','Dark:2101'].includes(effect.card.id)&&ccOwner(effect.card)!==side&&path.includes(effect.site)&&path.includes(effect.to)&&adjacentSites(effect.site,effect.to))titles.add(ccTitle(effect.card));
 return titles.size?options.map(option=>option.kind==='Landspeed'?{...option,cost:option.cost+titles.size}:option):options;
};
openDeploymentReaction=function(side,cards){if(cloudCityEnabled()&&state.phase===2&&!state.cloudCitySpecialDeploy&&cards.some(card=>cardAbility(card)>0))(state.cloudCityAbilityDeployed??={})[side]=state.game.timing.turn;return ccEffectBase.deploy(side,cards);};
initiateBattleFor=function(side,site,...args){if(cloudCityEnabled())for(const card of battleCandidates(side,site))card.cloudCityBattledTurn=state.game.timing.turn;return ccEffectBase.begin(side,site,...args);};
ccTiming.push(event=>{
 const tasks=[],side=state.activeSide,enemy=PremiereGame.otherSide(side),turn=state.game.timing.turn;
 for(const effect of ccAllEffects()){
  const id=effect.card.id,owner=ccOwner(effect.card);if(effect.card.set!=='5')continue;
  const loss=(payer,amount)=>tasks.push(next=>dagoLoss(payer,amount,effect.card.name,next));
  if(event==='phase:end'&&state.phase===2&&owner===enemy&&['Light:414','Dark:46'].includes(id)&&state.cloudCityAbilityDeployed?.[side]!==turn)loss(side,2);
  if(event==='phase:start'&&state.phase===4){if(id==='Light:66'&&owner===enemy)loss(side,effect.darkJedi?2:1);if(id==='Dark:1201'&&owner===side)loss(enemy,2);}
  if(event==='phase:start'&&state.phase===5&&id==='Dark:2768'&&owner===enemy)loss(side,effect.host.frozen?3:2);
  if(event==='turn:end'){
   if(id==='Dark:1701'&&owner===enemy)loss(side,1);
   if(id==='Light:2670'&&owner===enemy&&effect.host.cloudCityBattledTurn!==turn&&ccUnits().some(entry=>entry.side===owner&&!entry.unavailable&&cardAbility(entry.card)>3))loss(side,2);
   if(id==='Light:737'&&owner===enemy){const target=ccEntry(effect.host);if(target&&ccPresent(side,target.slot).some(card=>/ig-88/.test(ccTitle(effect.host))?PremiereUnits.bountyHunter(card):card.subType==='Imperial'))tasks.push(next=>{loseTableCard(target.side,target.slot,target.card);next();});}
   if(effect.forceBarrier===side&&turn>=effect.expires)tasks.push(next=>{hothCancelEffect(effect);next();});
  }
 }return tasks;
});
ccContinuousProviders.push(()=>{
 for(const effect of ccAllEffects()){
  const id=effect.card.id,side=ccOwner(effect.card),enemy=PremiereGame.otherSide(side);if(effect.card.set!=='5')continue;
  if(effect.host&&!ccEntry(effect.host)){hothCancelEffect(effect);continue;}
  if(['Light:414','Dark:46'].includes(id)&&ccUnits().filter(entry=>entry.side===enemy&&!entry.unavailable&&cardAbility(entry.card)>0).length>ccUnits().filter(entry=>entry.side===side&&!entry.unavailable&&cardAbility(entry.card)>0).length)hothCancelEffect(effect);
  if(id==='Light:1112'&&ccControl(enemy,effect.site))hothCancelEffect(effect);
  if(id==='Dark:614'&&state.locations.filter((loc,slot)=>ccPlanet(loc)==='bespin'&&PremiereLocations.occupy(state,enemy,slot,cardAbility)===true).length>=4+(typeof jpDarkDealExtra==='function'&&jpEnabled()?jpDarkDealExtra(side):0))hothCancelEffect(effect);
  if(id==='Dark:972'&&ccEntry(effect.target)?.slot===effect.site)hothCancelEffect(effect);
  if(id==='Dark:2768'&&ccUnits().some(entry=>ccPersona(entry.card,'Luke')&&ccAtSame(entry.card,effect.host)))hothCancelEffect(effect);
 }
});
const ccInsertBase={top:dagoResolveTop,reveal:revealReserveInserts,destiny:hothDestinyTriggers};
dagoResolveTop=function(side,next){const top=ccOwn(side).deck.at(-1);if(!cloudCityEnabled()||!PremiereGame.isReserveInsert(top)||!['Light:54','Dark:2101'].includes(top.id))return ccInsertBase.top(side,next);const z=ccOwn(side),owner=top.insertedIntoReserveBy;for(let i=z.deck.length-1;i>=0;i--){const card=z.deck[i];if(card===top||PremiereGame.isReserveInsert(card)&&card.insertedIntoReserveBy!==owner){z.deck.splice(i,1);const actor=card.insertedIntoReserveBy;delete card.insertedIntoReserveBy;loseOwnedCard(card,actor);}}z.deck.splice(0,z.deck.length,...PremiereGame.shuffleReserve(z.deck,state.game));dagoResolveTop(side,next);};
revealReserveInserts=function(side){if(cloudCityEnabled()&&ccOwn(side).deck.at(-1)?.set==='5'&&PremiereGame.isReserveInsert(ccOwn(side).deck.at(-1)))return;return ccInsertBase.reveal(side);};
hothDestinyTriggers=function(side,draw,next,purpose){return ccInsertBase.destiny(side,draw,next,purpose);};
function ccAutomaticDestiny(side,draw,next){
 if(draw.cancelled||draw.cloudCityChasm||!Number.isFinite(draw.value)||draw.card.uniquenessLimit!==1||!['Light:392','Dark:48'].some(id=>ccEffects(id).length)){next();return;}
 const match=entry=>entry.card.uniquenessLimit===1&&ccTitle(entry.card)===ccTitle(draw.card);
 const duplicate=ccUnits().find(match)??state.locations.filter(Boolean).map(card=>({card})).find(match)??ccAllEffects().find(match);
 if(!duplicate){next();return;}draw.value=0;draw.modifier=0;draw.cloudCityChasm=true;loseOwnedCard(draw.card,side,'destiny');
 if(duplicate.card.type!=='Character'){next();return;}
 duplicate.card.cloudCityChasmTurn=state.game.timing.turn;const owner=duplicate.side??ccOwner(duplicate.card);
 ccChoose(owner,draw.card,'Chasm',[{args:['force'],label:'2 Force verlieren'},{args:['character'],card:duplicate.card,label:duplicate.card.name+' verlieren'}],choice=>{if(choice.args[0]==='character'){loseTableCard(owner,duplicate.slot,duplicate.card);next();}else dagoLoss(owner,2,'Chasm / Abyss',next);});
}
const ccDestinySettle=PremiereBattle.settle;
PremiereBattle.settle=function(piles,draw){return cloudCityEnabled()&&draw.cloudCityChasm?draw:ccDestinySettle(piles,draw);};
