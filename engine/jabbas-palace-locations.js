'use strict';
function jpSource(slot,printed){
 const side=ccLocationSource(slot,printed),loc=state.locations[slot];if(!side)return null;
 if(printed==='Dark'&&((loc.id==='Dark:1750'||loc.id==='Dark:2452')&&jpControl('Light',slot)))return null;
 if(jpPalace(loc)&&jpAll(PremiereGame.otherSide(side),'Light:183').some(e=>e.slot===slot))return null;
 return side;
}
function jpLocationOptions(side){
 const out=[],own=jpOwn(side);if(!jpEnabled()||state.activeSide!==side||battleSession||jpEnumerating)return out;
 for(const [slot,loc]of state.locations.entries()){
  if(!loc||!dagoLocationText(slot))continue;const control=state.phase===1,deploy=state.phase===2,occupy=PremiereLocations.occupy(state,side,slot,cardAbility)===true;
  const search=(filter,cost=0)=>{if(control&&own.deck.some(filter)&&jpUnused(loc,'search')&&cost<=forceBudget(side))out.push(jpOnce(loc,'search',[slot],'Reserve Deck durchsuchen',cost,()=>{dagoSearch(side,loc,'deck',filter);return true;}));};
  if(loc.id==='Light:1442'&&side===jpSource(slot,'Light')&&occupy)search(c=>jpDesert(c)||jpSpecies(c,'kitonak')||jpTitle(c)==='sandwhirl');
  if(loc.id==='Dark:1750'&&side===jpSource(slot,'Dark'))search(c=>['bounty','hutt bounty'].includes(jpTitle(c)));
  if(loc.id==='Dark:1356'&&side===jpSource(slot,'Light')&&jpControl(side,slot)&&forceBudget(side)>=3)for(const [i,e]of jpUnits().entries())if(e.slot===slot&&e.card.imprisoned)out.push(jpOption(loc,'dungeonRelease',[slot,i],e.card.name+' befreien (3 Force)',()=>{spendForce(side,3);return jpRelease(e.card,slot);},{cost:3,site:slot}));
  if(loc.id==='Dark:1353'&&side===jpSource(slot,'Light')&&jpControl(side,slot)&&forceBudget(side)>=4&&ccEffects('Dark:2188').length)out.push(jpOption(loc,'cancelScum',[slot],'Scum And Villainy aufheben (4 Force)',()=>{spendForce(side,4);for(const effect of ccEffects('Dark:2188'))hothCancelEffect(dagoOriginalEffect(effect));return true;},{cost:4}));
  if(loc.id==='Light:2593'&&side===jpSource(slot,'Light')&&control&&occupy&&own.hand.length>=3&&own.lost.length&&jpUnused(loc,'exchange'))out.push(jpOnce(loc,'exchange',[slot],'3 Handkarten gegen 1 Lost-Pile-Karte tauschen',0,()=>{const selected=[];const choose=()=>jpChoose(side,loc,'TibrinHand',own.hand.filter(c=>!selected.includes(c)).map((card,i)=>({args:[i],card,label:card.name})),choice=>{selected.push(choice.card);if(selected.length<3){choose();return;}for(const c of selected){own.hand.splice(own.hand.indexOf(c),1);own.used.push(c);}dagoSearch(side,loc,'lost',()=>true);});choose();return true;}));
  let filter=null,scope='turn';
  if(loc.id==='Dark:2452'&&side===jpSource(slot,'Dark')&&deploy)filter=c=>jpPalace(c)&&isSite(c);
  if(loc.id==='Dark:1353'&&side===jpSource(slot,'Dark')&&deploy){filter=c=>c.subType==='Alien';scope='game';}
  if(loc.id==='Light:1354'&&side===jpSource(slot,'Light')&&deploy)filter=c=>c.id==='Light:285';
  if(filter&&jpUnused(loc,'locationDeploy',scope))for(const option of jpDeployOptions(side,loc,'deck',filter,{site:loc.id==='Dark:1353'?slot:null})){const resolve=option.resolve;option.resolve=actor=>{ccMark(loc,'jp:locationDeploy',scope);return resolve(actor);};out.push(option);}
 }
 return out;
}
ccProviders.push(jpLocationOptions);
const jpLocationBase={drain:forceDrainEffects,total:hothBattlePower,generation:forceFromLocations,move:hothMovementAllowed,travel:travelOptions,battleCost:battleInitiationCost,drainResolve:resolveForceDrain};
forceDrainEffects=function(side,slot){const plan=jpLocationBase.drain(side,slot);if(!jpEnabled()||!plan)return plan;const loc=state.locations[slot];let bonus=0;
 if(['Light:1358','Dark:1357'].includes(loc?.id)&&side===jpSource(slot,'Light'))bonus++;
 if(loc?.id==='Dark:1357'&&side===jpSource(slot,'Dark')&&ccPresent(side,slot).some(c=>jpSpecies(c,'gamorrean')))bonus++;
 if(['Light:1442','Dark:1750'].includes(loc?.id)&&side===jpSource(slot,loc.id==='Light:1442'?'Dark':'Light'))bonus--;
 if(loc?.id==='Light:2593'&&side===jpSource(slot,'Dark'))bonus++;
 if(loc?.id==='Dark:1355'&&side===jpSource(slot,'Light')&&ccPresent(side,slot).some(isDroid))bonus++;
 if(jpPalace(loc)&&jpAtAudience(side,'Dark:1003'))bonus++;
 if(jpAtAudience(side,'Light:2507')&&ccPresent(side,slot).some(c=>c.subType==='Alien'&&JabbasPalaceRules.nonunique(c)))bonus++;
 if(CloudCityRules.city(loc)&&jpAll(side,'Light:1964').some(e=>sitePlanet(state.locations[e.slot])==='bespin'))bonus++;
 if(jpAll(side,'Light:128').some(e=>sitePlanet(state.locations[e.slot])==='tatooine')&&isExteriorPlanetSite(loc)){const vapor=ccPresent(side,slot).some(c=>jpTitle(c)==='vaporator'),hydro=ccPresent(side,slot).some(c=>jpTitle(c)==='hydroponics station');bonus+=Number(vapor)+Number(hydro);}
 if(jpTitle(loc)==='alderaan')bonus+=jpAll(side,'Light:2420').some(e=>sitePlanet(state.locations[e.slot])==='yavin 4')?state.locations.filter((l,i)=>sitePlanet(l)==='yavin 4'&&jpControl(side,i)).length:0;
 if(dagoCompleted(PremiereGame.otherSide(side),1)||ccDecree(PremiereGame.otherSide(side)))bonus=Math.min(0,bonus);
 return {...plan,modifier:plan.modifier+bonus};
};
resolveForceDrain=function(side,slot,...args){const plan=drainPlan(side,slot),result=jpLocationBase.drainResolve(side,slot,...args);if(jpEnabled()&&plan&&ccPresent(side,slot).some(c=>c.subType==='Alien')&&(jpAtAudience(side,'Dark:1346')||jpAtAudience(side,'Light:1575')))activateReserve(side,1);return result;};
hothBattlePower=function(side,slot){let value=jpLocationBase.total(side,slot);if(jpEnabled()&&state.locations[slot]?.id==='Light:1435'&&ccPresent(side,slot).filter(c=>c.type==='Starship').length===2)value+=2;return value;};
forceFromLocations=function(side){const value=jpLocationBase.generation(side);if(jpEnabled()&&jpAtAudience(side,'Light:1890')&&state.locations.some(l=>isSystem(l)&&jpTitle(l)==='corellia'))value.count+=2;return value;};
battleInitiationCost=function(slot){if(jpEnabled()&&(jpAt(state.activeSide,slot,'Dark:122')||jpAt(PremiereGame.otherSide(state.activeSide),slot,'Dark:2159')))return 0;return jpLocationBase.battleCost(slot);};
hothMovementAllowed=function(side,card,from,to,kind){
 if(!jpLocationBase.move(side,card,from,to,kind))return false;if(!jpEnabled())return true;const loc=state.locations[from],enemy=PremiereGame.otherSide(side);
 if(card.id==='Light:1037')return false;
 if(loc?.id==='Dark:1360'&&jpSource(from,'Dark')&&jpUnits().some(e=>e.slot===from&&!e.unavailable&&e.card.type==='Creature'))return false;
 if(card.type==='Character'&&jpPalace(state.locations[to])&&cardAbility(card)<4&&jpAt(enemy,from,'Dark:232'))return false;
 if(card.type==='Character'&&jpAt(enemy,to,'Dark:878')&&['spy','gambler','thief'].some(t=>characterTraits(card).includes(t)))return false;
 if(kind==='Landspeed'&&card.type==='Character'&&(jpAt(enemy,from,'Dark:339')&&jpPalace(loc)||jpAt(enemy,from,'Light:2829')&&sitePlanet(loc)==='tatooine'))return false;
 if(/nabrun|elis/i.test(kind)&&jpAll(null,'Light:2263').some(e=>[from,to].some(slot=>e.slot===slot||adjacentSites(e.slot,slot))))return false;
 return true;
};
travelOptions=function(card,side,from,to,react=false){const choices=jpLocationBase.travel(card,side,from,to,react);if(!jpEnabled())return choices;return choices.filter(o=>hothMovementAllowed(side,card,from,to,o.kind)).map(o=>{
 let cost=o.cost;if(o.kind==='Landspeed'&&card.id==='Dark:1346')cost+=2;
 if(o.kind==='Landspeed'&&card.type==='Vehicle'&&card.occupants?.some(e=>e.role==='driver'&&e.card.id==='Dark:1928'&&jpLive(e.card)))cost=0;
 return {...o,cost};});};
const jpGroundBase=groundReach;
const jpWatersBase={options:locationEffectOptions,relocate:dagoRelocateEffectAllowed};
locationEffectOptions=function(side,index){const options=jpWatersBase.options(side,index),card=jpOwn(side).hand[index],rule=card&&locationEffectRule(card);if(jpEnabled()&&rule?.darkWaters&&withinDeploymentLimit(card,side)&&rule.cost<=forceBudget(side))for(const [site,loc]of state.locations.entries())if(loc?.id==='Dark:1360'&&jpSource(site,'Dark')&&!options.some(o=>o.args[1]===site))options.push({card,cost:rule.cost,args:[index,site],label:card.name+' bei '+loc.name});return options;};
dagoRelocateEffectAllowed=function(effect,to){return jpEnabled()&&locationEffectRule(effect.card)?.darkWaters&&state.locations[to]?.id==='Dark:1360'&&!!jpSource(to,'Dark')||jpWatersBase.relocate(effect,to);};
groundReach=function(card,from,to,range){if(jpEnabled()&&card.type==='Character'&&jpDesert(state.locations[from])&&!characterTraits(card).includes('scout')&&!['Light:784','Light:1447'].includes(card.id))range--;return jpGroundBase(card,from,to,range);};
jpContinuous.push(()=>{for(const [slot,loc]of state.locations.entries())if(loc?.id==='Light:1354'&&jpSource(slot,'Light')&&jpControl('Light',slot))for(const effect of ccEffects('Dark:2188'))hothCancelEffect(dagoOriginalEffect(effect));});
