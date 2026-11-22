'use strict';
function jpReplacementAllowed(card,entry,side){
 const old=entry.card,loc=state.locations[entry.slot];
 if(card.type!=='Character'||old.type!=='Character'||card.uniquenessLimit!==1||old.uniquenessLimit!==1||(old.captured?old.owner??old.side:ccOwner(old))!==side||!sameTitleOrPersona(card,old)||card.id===old.id)return false;
 if(card.id==='Light:1945'){
  const escort=jpUnits().find(e=>ccCaptives(e.card).includes(old));
  if(!old.captured||!escort||!ccPersona(escort.card,'Jabba')&&!PremiereUnits.bountyHunter(escort.card))return false;
 }else if(!characterLocationAllowed(card,loc))return false;
 const oldPower=old.frozen?0:Math.max(0,(old.power??0)+cardPowerModifier(old,side,entry.slot));
 const newPower=(card.power??0)*(card.id==='Light:2730'?jpVulFactor(side):1);
 if(newPower<oldPower||cardAbility(card)<cardAbility(old))return false;
 if(entry.carriers[0]){const carrier=entry.carriers[0],seat=carrier.occupants?.find(e=>e.card===old);if(seat&&!PremiereUnits.accepts(carrier,card,seat.role,seat,ccCaptives(old).length))return false;}
 return true;
}
function jpReplacementAttachmentAllowed(item,card){
 if(item.type==='Weapon')return weaponDeployCost(item,card)!==null;
 if(item.id==='Dark:1394')return card.subType==='Alien'&&!ccPersona(card,'Boba Fett')&&!ccPersona(card,'Jabba');
 if(['Light:126','Light:1138','Light:1151'].includes(item.id))return PremiereUnits.rUnit(card);
 if(item.id==='Dark:1637')return ['Alien','Imperial'].includes(card.subType)&&!ccPersona(card,'Boba Fett')&&!ccPersona(card,'Vader');
 if(item.id==='Dark:1192')return ['smuggler','gambler','thief'].some(t=>characterTraits(card).includes(t));
 if(item.id==='Dark:2697')return card.subType==='Rebel'&&cardAbility(card)>2;
 if(item.id==='Dark:316')return card.type==='Character'&&!isDroid(card);
 if(activeCardRules(item,'undercoverEffect').length)return isSpyCharacter(card);
 const rule=activeCardRules(item,'device')[0]??activeCardRules(item,'tableEffect')[0];
 return !rule?.targets||['own side of table','any character'].includes(rule.targets)||matchesRegisteredTarget(card,rule.targets);
}
function jpReplaceReferences(old,card){
 const seen=new Set();
 const visit=value=>{if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
  if(value instanceof Set){if(value.delete(old))value.add(card);for(const child of value)visit(child);return;}
  if(value instanceof Map){if(value.has(old)){const child=value.get(old);value.delete(old);value.set(card,child);}for(const [key,child]of value){if(child===old)value.set(key,card);else visit(child);}return;}
  for(const key of Object.keys(value)){if(key==='starterDecks')continue;if(value[key]===old)value[key]=card;else visit(value[key]);}
 };visit(state);
}
function jpPersonaReplace(side,card,entry){
 if(!jpReplacementAllowed(card,entry,side))return false;
 const old=entry.card,own=jpOwn(side),original=catalog.find(c=>c.id===old.id),excluded=new Set(['instanceId','owner','weapons','attachments']);
 const index=own.hand.indexOf(card);if(index<0)return false;own.hand.splice(index,1);
 // Carry residual conditions, not printed statistics or the outgoing card's ID.
 for(const key of Object.keys(old))if(!excluded.has(key)&&!Object.hasOwn(original??{},key))card[key]=old[key];
 card.weapons=[];card.attachments=[];
 for(const key of ['weapons','attachments'])for(const item of old[key]??[]){
  if(jpReplacementAttachmentAllowed(item,card))card[key].push(item);
  else{const record=ccAllEffects().find(e=>e.card===item);if(record)hothCancelEffect(dagoOriginalEffect(record));else loseOwnedCard(item,ccOwner(item));}
 }
 jpReplaceReferences(old,card);old.weapons=[];old.attachments=[];
 for(const key of Object.keys(old))if(!['instanceId','owner','weapons','attachments'].includes(key)&&!Object.hasOwn(original??{},key))delete old[key];
 // A persona replacement is neither deployment nor a just-lost event.
 own.lost.push(old);log(old.name+' wird durch '+card.name+' ersetzt.');return true;
}
ccProviders.push(side=>{
 if(!jpEnabled()||jpEnumerating||state.activeSide!==side||state.phase!==2||battleSession)return [];
 const out=[];jpOwn(side).hand.forEach((card,index)=>{for(const [i,e]of jpUnits().entries())if(jpReplacementAllowed(card,e,side))out.push(jpOption(card,'personaReplace',[index,i],e.card.name+' kostenlos ersetzen',()=>jpPersonaReplace(side,card,e),{site:e.slot,target:e.card}));});return out;
});
