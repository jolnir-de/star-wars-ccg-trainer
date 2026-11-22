'use strict';
function jpJawaLeader(side,card){return card.id===(side==='Light'?'Light:1380':'Dark:1378')&&jpHas(side,side==='Light'?'Light:1408':'Dark:2817');}
function jpDoallyn(side){return jpAll(side,'Light:2227').some(e=>sitePlanet(state.locations[e.slot])==='tatooine');}
const jpComboBase={unique:cardUniquenessLimit,effects:hothEffectOptions,settle:settleHothEffect,table:tableEffectOptions,gear:utinniGearBonus,alter:alterTarget,traits:characterTraits,defense:PremiereWeapons.defense,location:locationEffectOptions,cancel:cancelTableEffect,forfeit:cardForfeitValueAt};
cardUniquenessLimit=function(card){if(jpEnabled()&&(jpJawaLeader(ccOwner(card),card)||card.id==='Light:2646'&&jpDoallyn(ccOwner(card))||card.id==='Light:1913'&&state.jpPlastoidEffect))return Infinity;return jpComboBase.unique(card);};
tableEffectOptions=function(side){return jpComboBase.table(side).filter(o=>!jpEnabled()||!jpJawaLeader(side,o.card));};
locationEffectOptions=function(side,index){const card=jpOwn(side).hand[index];return jpEnabled()&&(card?.id==='Light:1913'&&state.jpPlastoidEffect||card?.id==='Light:2646'&&jpDoallyn(side))?[]:jpComboBase.location(side,index);};
hothEffectOptions=function(side,window=null){
 const out=jpComboBase.effects(side,window);if(!jpEnabled()||window||state.activeSide!==side||state.phase!==2||battleSession)return out;
 jpOwn(side).hand.forEach((card,index)=>{
  const add=(args,label,extra={})=>out.push({card,index,choice:[index,...args],label:card.name+' · '+label,cost:0,...extra});
  if(jpJawaLeader(side,card)&&withinDeploymentLimit(card,side)){add(['free'],'Kostenlos auslegen',{jpJawa:true});if(forceBudget(side)>=6&&forceBudget(PremiereGame.otherSide(side))>=6)add(['both'],'6 Force je Spieler verwenden',{cost:6,jpJawa:true,opposingCost:6});}
  if(card.id==='Light:1913'&&state.jpPlastoidEffect&&withinDeploymentLimit(card,side))for(const [i,e]of jpUnits().entries())if(e.side===side&&!e.unavailable&&['Rebel','Alien'].includes(e.card.subType)&&state.locations[e.slot]?.locationTags?.includes('Mobile')&&jpAt(side,e.slot,'Light:828'))add([i],e.card.name+' verkleiden',{host:e.card,jpPlastoid:true});
  if(card.id==='Light:2646'&&jpDoallyn(side)&&withinDeploymentLimit(card,side))for(const [i,e]of jpUnits().entries())if(e.side===side&&!e.unavailable&&e.card.type==='Character'&&sitePlanet(state.locations[e.slot])==='tatooine')add([i],e.card.name+' ausrüsten',{host:e.card,jpMask:true});
 });return out;
};
settleHothEffect=function(frame){
 if(!jpEnabled()||!frame.jpJawa&&!frame.jpPlastoid&&!frame.jpMask)return jpComboBase.settle(frame);
 if(frame.cancelled){loseOwnedCard(frame.card,frame.side);return;}
 if(frame.jpJawa&&frame.opposingCost)spendForce(PremiereGame.otherSide(frame.side),frame.opposingCost);
 const effect={card:frame.card,target:frame.host??frame.side,...(frame.host?{host:frame.host}:{})};if(frame.jpPlastoid){frame.card.type='Effect';frame.card.jpDisguise=true;}
 if(frame.host)(frame.host.attachments??=[]).push(frame.card);(state.tableEffects??=[]).push(effect);
};
utinniGearBonus=function(card,slot){let value=jpComboBase.gear(card,slot);if(jpEnabled()&&card.attachments?.some(c=>c.id==='Light:2646')&&jpDoallyn(ccOwner(card))&&sitePlanet(state.locations[slot])==='tatooine')value+=2;return value;};
cardForfeitValueAt=function(card,side,slot,...args){let n=jpComboBase.forfeit(card,side,slot,...args);if(jpEnabled()&&jpSpecies(card,'jawa')){
  const effects=ccEffects(side==='Light'?'Light:1380':'Dark:1378',side),leader=jpHas(side,side==='Light'?'Light:1408':'Dark:2817');
  // The original rule grants one non-cumulative point. A leader makes the
  // effect double and cumulative, so add only the difference here.
  if(effects.length&&leader)n+=effects.length*2-1;
 }return n;
};
characterTraits=function(card){const out=jpComboBase.traits(card);return jpEnabled()&&card.attachments?.some(c=>c.id==='Light:1913')?[...new Set([...out,'spy'])]:out;};
PremiereWeapons.defense=function(card,...args){const n=jpComboBase.defense(card,...args);return jpEnabled()&&card.attachments?.some(c=>c.id==='Light:1913')?Math.max(5,n??0):n;};
alterTarget=function(card,site){if(jpEnabled()&&(card?.id==='Light:1913'&&state.jpPlastoidEffect||card?.id==='Light:2646'&&jpDoallyn(ccOwner(card))))return false;return jpComboBase.alter(card,site);};
jpContinuous.push(()=>{if(jpHas('Light','Light:828'))state.jpPlastoidEffect=true;});
ccProviders.push(side=>{
 if(!jpEnabled()||state.activeSide!==side||state.phase!==1||battleSession)return [];const out=[],enemy=PremiereGame.otherSide(side);
 for(const [i,e]of jpAll(side,'Dark:2790').entries())if(jpUnused(e.card,'controlFire'))for(const weapon of e.card.weapons??[])for(const [j,target]of jpUnits().entries())if(target.side===enemy&&target.slot===e.slot&&!target.unavailable&&PremiereLocations.physicalPlace(target)===PremiereLocations.physicalPlace(e)){
  const shot=weaponShot(weapon,e.card,target.card,PremiereWeapons.defense(target.card,cardAbility(target.card),craftStats(target.card,target.slot)));if(!shot||shot.effect==='jpVibro'||shot.cost*2>forceBudget(side))continue;
  out.push(jpOption(e.card,'controlFire',[i,weapon.instanceId,j],weapon.name+' → '+target.card.name+' (doppelte Force)',()=>{ccMark(e.card,'jp:controlFire');fireImmediateWeapon(side,{...shot,cost:shot.cost*2,weapon,host:e.card,target:target.card,from:e.slot,targetSlot:target.slot},()=>{});return true;},{cost:shot.cost*2}));
 }return out;
});
const jpDarkDealExtra=side=>jpAll(side,'Dark:122').filter(e=>CloudCityRules.city(state.locations[e.slot])).length;

function jpRaycProtection(card){return PremiereUnits.fighter(card)&&card.occupants?.some(e=>e.role==='pilot'&&e.card.id==='Light:2026'&&PremiereUnits.active(e.card)&&jpLive(e.card));}
function jpKraytAnswer(source,draw,skip,resolve){const taym=jpAll('Dark','Dark:2488').find(e=>sitePlanet(state.locations[e.slot])==='tatooine');if(!taym)return false;jpChoose('Dark',taym.card,'Krayt',[{args:['cancel'],label:'Krayt-Dragon-Bones-Ergebnis '+draw.value+' aufheben'},{args:['resolve'],label:'Ergebnis ausführen'}],choice=>{if(choice.args[0]==='cancel')skip();else resolve();});return true;}
const jpTallonBase=legalActions;
legalActions=function(position,side,...args){const out=jpTallonBase(position,side,...args);return !jpEnabled()||position!==state?out:out.filter(a=>a.rule?.mode!=='tallonRoll'||!jpRaycProtection(a.target?.card??a.target??a.entry?.card??{}));};

const jpGravelBase=gravelStormOptions;
gravelStormOptions=function(side){return jpGravelBase(side).filter(o=>!jpEnabled()||!['Light:784','Light:1447'].includes(o.target.id)&&!(o.target.attachments?.some(c=>c.id==='Light:2646'&&jpLive(c))&&jpDoallyn(ccOwner(o.target))));};
