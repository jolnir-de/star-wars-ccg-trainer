const PremiereLocations = (() => {
  const V3DrainTrace = typeof module !== 'undefined' ? require('./drain-explanation.js') : globalThis.V3DrainTrace;
  const units = typeof PremiereUnits === 'undefined' ? require('./premiere-units.js') : PremiereUnits;
  const bothSides = ['Light', 'Dark'];
  const opposite = side => side === 'Light' ? 'Dark' : 'Light';
  const title = card => (card?.name ?? '').replace(/^•+\s*/, '').split(' (')[0];
  const system = card => ['System','Sector'].includes(card?.subType);
  const region = card => card?.cloudCityPlanet?.replace(/^./,letter=>letter.toUpperCase()) ?? (/^Jabba's Palace:/.test(title(card)) ? 'Tatooine' : /^Cloud City:/.test(title(card)) ? 'Bespin' : system(card) ? title(card) : title(card).split(':')[0]);
  function hothMarker(card) {
    if(card?.type!=='Location'||card.subType!=='Site'||region(card).toLowerCase()!=='hoth')return null;
    const match=(card.name??'').match(/\(([1-7])(?:st|nd|rd|th) Marker\)/i);
    return match?Number(match[1]):null;
  }
  const prison = card => card?.type === 'Location' && card.subType === 'Site' &&
    (/\bPrison\b/i.test(title(card)) || ['Death Star: Detention Block Corridor','Cloud City: Security Tower',"Jabba's Palace: Dungeon"].includes(title(card)));
  const inactive = card => card.captured || card.missing || card.inactive || card.concealed;
  const enclosed = card => units.enclosed(card) ||
    card.subType === 'Enclosed';

  function entries(state, side) {
    const board = side === 'Light' ? state.light : state.dark;
    const result = [];
    function visit(card, slot, carriers = [], blocked = false, captive = false) {
      if (!card) return;
      if(state.besiegedBattle?.cards.includes(card)){carriers=[];blocked=false;}
      const unavailable = blocked || inactive(card);
      const held = captive || !!card.captured;
      result.push({card, side, slot, carriers, unavailable, captive:held});
      for (const occupant of card.occupants ?? []) visit(occupant.card, slot, [card, ...carriers], unavailable);
      if (card.escortedCaptive) visit(card.escortedCaptive, slot, carriers, true, true);
      for (const captive of card.additionalCaptives ?? []) visit(captive, slot, carriers, true, true);
      for (const attachment of [...(card.weapons ?? []), ...(card.attachments ?? [])]){
        visit(attachment, slot, carriers, unavailable, held);
      }
    }
    board?.forEach((row, slot) => row.forEach(card => visit(card, slot)));
    return result;
  }

  function find(state, card) {
    for (const side of bothSides) {
      const entry = entries(state, side).find(item => item.card === card);
      if (entry) return entry;
    }
    return null;
  }

  function at(state, card, slot) {
    const entry = find(state, card), target = state.locations?.[slot];
    return !!entry && !!target && (entry.slot === slot ||
      (system(target) && (!system(state.locations[entry.slot])||target.subType==='System'&&state.locations[entry.slot]?.cloudCityPlanet) && region(state.locations[entry.slot]) === region(target)));
  }

  function aboard(state, card, carrier) {
    const entry = find(state, card);
    return !!entry && (entry.carriers.includes(carrier) ||
      (!!carrier.instanceId && state.locations[entry.slot]?.hostInstanceId === carrier.instanceId));
  }

  function presentAt(entry, place) {
    return !entry.unavailable && physicalPlace(entry) === place;
  }

  function physicalPlace(entry) { return entry.carriers.find(enclosed) ?? entry.slot; }

  function present(state, card, place) {
    const entry = find(state, card);
    return !!entry && presentAt(entry, place);
  }

  function presentCards(state, side, place) {
    return entries(state, side).filter(entry => presentAt(entry, place)).map(entry => entry.card);
  }

  function activeCards(state, side) {
    return entries(state, side).filter(entry => !entry.unavailable).map(entry => entry.card);
  }

  function cardsOnTable(state, side) { return entries(state, side).map(entry => entry.card); }

  function presence(state, side, slot, ability) {
    if (!state.locations?.[slot]) return false;
    let known = 0, uncertain = false;
    for (const {card} of entries(state, side).filter(entry => entry.slot === slot && !entry.unavailable)) {
      if (card.undercover) continue;
      if ((state.game?.cardRulesVersion??0)>=32&&['premiere-a-new-hope-hoth-dagobah','premiere-a-new-hope-hoth-dagobah-cloud-city'].includes(state.game?.playFormat)&&['Dark:9','Dark:1245'].includes(card.id)&&!units.textSuppressed(card))return true;
      if (card.presence === true || (state.game?.cardRulesVersion??0)>=31 && ['Light:1404','Dark:1950'].includes(card.id) && !units.textSuppressed(card)) return true;
      if (card.type && !['Character', 'Vehicle', 'Starship', 'Creature'].includes(card.type)&&!['Light:694','Dark:1274'].includes(state.locations[slot]?.id)) continue;
      const value = ability(card);
      if (Number.isFinite(value)) known += value;
      else uncertain = true;
    }
    return known >= 1 ? true : uncertain ? null : false;
  }

  function control(state, side, slot, ability) {
    const own = presence(state, side, slot, ability), enemy = presence(state, opposite(side), slot, ability);
    if (own === false || enemy === true) return false;
    return own === true && enemy === false ? true : null;
  }

  function effectsAt(state, slot) {
    return state.locationEffects?.[slot] ?? [];
  }

  function printedSide(state, slot, side) {
    if(typeof cloudCityEnabled==='function'&&cloudCityEnabled()&&typeof ccDecree==='function'&&ccDecree('Dark'))return side;
    return effectsAt(state, slot).filter(effect => effect.card.id === 'Light:2110').length % 2
      ? opposite(side) : side;
  }

  function ruleEntriesAt(state, slot, side, event) {
    if(state.locations?.[slot]?.collapsed || state.locations?.[slot]?.blownAway)return [];
    if(typeof dagobahLocationTextCancelled==='function'&&dagobahLocationTextCancelled(state,slot))return [];
    const registry = typeof PremiereCardRules === 'undefined' ? require('./premiere-card-rules.js') : PremiereCardRules;
    const version = state.game?.cardRulesVersion ?? Infinity;
    const card = state.locations?.[slot], printed = printedSide(state, slot, side);
    const activeRules = (location, textSide) => registry.effects(location,event).filter(rule => rule.printedSide===textSide &&
      (!rule.printedClause || (location.gametext ?? '').split(/[.!?]\s+/).some(line =>
        line.trim().replace(/[.!?]$/, '').toLowerCase() === (textSide + ': ' + rule.printedClause).toLowerCase())));
    const local = units.textSuppressed(card)?[]:activeRules(card,printed).map(rule=>({rule,card,slot}));
    if(version<21||!card||system(card)||event==='dockingTransit'||!state.locationEffects) return local;
    const order=state.locationOrder??state.locations.map((_,index)=>index),position=order.indexOf(slot);
    if(position<0)return local;
    const expanded=[order[position-1],order[position+1]].flatMap(neighbor=>{
      const source=state.locations[neighbor];
      if(!source||system(source)||region(source)!==region(card)||units.textSuppressed(source))return [];
      const modifier=effectsAt(state,neighbor).find(({card})=>card.id==='Dark:914'&&!units.textSuppressed(card));
      if(!modifier||printedSide(state,neighbor,modifier.card.side)!==side)return [];
      return activeRules(source,modifier.card.side).map(rule=>({rule,card:source,slot:neighbor,via:modifier.card}));
    });
    return local.concat(expanded);
  }

  function rulesAt(state,slot,side,event){return ruleEntriesAt(state,slot,side,event).map(entry=>entry.rule);}

  function ruleAt(state, slot, side, event) {
    return rulesAt(state,slot,side,event)[0];
  }

  function iconCalculation(state,slot,side){
    const card=state.locations[slot],details=[];
    if(card?.collapsed||card?.blownAway)return {value:0,details};
    const printedSideValue=printedSide(state,slot,side),printed=card?.icons?.[printedSideValue.toLowerCase()];
    if(!Number.isInteger(printed))return {value:null,details};
    details.push(V3DrainTrace.term('icons',printed,card,'Gedruckte '+printedSideValue+'-Icons',slot));
    const effects=effectsAt(state,slot);
    if(printedSideValue!==side){const revolution=effects.find(effect=>effect.card.id==='Light:2110');details.push(V3DrainTrace.term('note',0,revolution?.card,'Revolution vertauscht die Icon-Seiten',slot));}
    const bothSidesBonus=Math.max(0,...effects.map(effect=>effect.iconBonus??0)),source=effects.find(effect=>effect.iconBonus===bothSidesBonus);
    if(bothSidesBonus)details.push(V3DrainTrace.term('icons',bothSidesBonus,source?.card,'Zusätzliche Icons für beide Seiten',slot));
    for(const effect of effects)if(effect.icons?.[side])details.push(V3DrainTrace.term('icons',effect.icons[side],effect.card,'Icon-Änderung',slot));
    const raw=printed+bothSidesBonus+effects.reduce((sum,effect)=>sum+(effect.icons?.[side]??0),0),value=Math.max(0,raw);
    if(raw<0)details.push(V3DrainTrace.term('icons',-raw,null,'Icons mindestens 0',slot));
    return typeof jpIconCalculation==='function'?jpIconCalculation(state,slot,side,{value,details}):{value,details};
  }
  function icons(state,slot,side){return iconCalculation(state,slot,side).value;}

  function nightEffectsAt(state, slot) {
    const site = state.locations[slot];
    if (!site || system(site)) return [];
    return state.locations.flatMap((card, index) =>
      system(card) && region(card) === region(site) ? effectsAt(state, index).filter(effect => effect.nightfall) : []);
  }

  function conditions(state, slot, side) {
    const card = state.locations[slot], tags = card?.locationTags ?? [];
    const transit = ruleAt(state, slot, side, 'dockingTransit');
    const registry = typeof PremiereCardRules === 'undefined' ? require('./premiere-card-rules.js') : PremiereCardRules;
    const collapsedBay = card?.collapsed && registry.effects(card,'dockingTransit').length>0;
    return {interior: tags.includes('Interior'), exterior: tags.includes('Exterior'),
      scompLink: tags.includes('Scomp Link'), dockingBay: !!transit||!!collapsedBay, transitCost: transit?.cost ?? (collapsedBay?0:null),
      night: !!ruleAt(state,slot,side,'alwaysNight') || !!nightEffectsAt(state, slot).length || (state.nightSites?.includes(slot) ?? (!!state.nightConditions && !system(card)))};
  }

  function forceGeneration(state, side) {
    let count = 1, unknown = 0;
    state.locations.forEach((card, slot) => {
      if (!card || effectsAt(state, slot).some(effect => effect.justiceMode === 'generation')) return;
      const value = icons(state, slot, side);
      if (value === null) unknown++;
      else count += value;
    });
    for (const {card, slot, unavailable} of entries(state, side)) {
      const location = state.locations[slot];
      if (!unavailable && card.id === 'Light:1593' && location &&
          !effectsAt(state, slot).some(effect => effect.justiceMode === 'generation') &&
          !(state.game?.cardRulesVersion >= 7 && units.textSuppressed(card)) &&
          (system(location) || region(location) !== 'Tatooine')) count++;
    }
    return {count, unknown};
  }

  const lightsabers = new Set(['Light:109','Light:1386', 'Light:1813', 'Dark:620', 'Dark:2702']);

  function drain(state, side, slot, ability) {
    const location = state.locations[slot];
    if (!location || control(state, side, slot, ability) !== true) return null;
    const opposing = opposite(side);
    if (presentCards(state, opposing, slot).some(card => card.undercover)) return null;
    const effects = effectsAt(state, slot);
    if (effects.some(effect => effect.drainForbiddenFor === side)) return null;
    const base = icons(state, slot, opposing);
    if (base === null) return null;
    let plan=V3DrainTrace.base(base,location,side,slot,iconCalculation(state,slot,opposite(side)).details);
    plan=V3DrainTrace.modify(plan,ruleEntriesAt(state,slot,side,'forceDrain').map(entry=>V3DrainTrace.term('modifier',entry.rule.amount,entry.card,'Standort-Spieltext',entry.slot,{via:V3DrainTrace.ref(entry.via)})));
    const controlled=ruleEntriesAt(state,slot,side,'controlSiteDrain')[0];
    if(controlled){const amount=state.locations.filter((card,index)=>card&&!system(card)&&region(card)===controlled.rule.region&&control(state,side,index,ability)===true).length;plan=V3DrainTrace.modify(plan,[V3DrainTrace.term('modifier',amount,controlled.card,'Kontrollierte Sites',controlled.slot)]);}
    plan=V3DrainTrace.modify(plan,effects.filter(effect=>effect.drainModifier?.[side]).map(effect=>V3DrainTrace.term('modifier',effect.drainModifier[side],effect.card,'Effect am Standort',slot)));
    const present = presentCards(state, side, slot);
    const weapons = present.flatMap(host=>{
      const eligible=(host.weapons??[]).filter(weapon=>lightsabers.has(weapon.id)&&units.canUseWeapon(state,host,weapon));
      return (units.usesMultipleWeapons(host)?eligible:eligible.slice(0,1)).map(weapon=>({host,weapon}));
    });
    return V3DrainTrace.optional(plan,weapons.map(({weapon})=>V3DrainTrace.term('optional',1,weapon,'Freiwilliger Lichtschwert-Bonus',slot)),weapons);
  }

  return {aboard, activeCards, at, cardsOnTable, entries, physicalPlace, conditions, control, drain, effectsAt, forceGeneration, hothMarker, icons, presence, prison,
    findEntry: find, nightEffectsAt, occupy: presence, present, presentAt, presentCards, printedSide, iconCalculation, ruleAt, rulesAt, ruleEntriesAt};
})();

if (typeof module !== 'undefined') module.exports = PremiereLocations;
