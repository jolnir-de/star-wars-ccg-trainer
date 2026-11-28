'use strict';

// Pure Hoth rules. The session loads this module only when the Hoth format is requested.
const HothRules = (() => {
  const VERSION = 31;
  const title = card => String(card?.name ?? '').replace(/^[•*]+\s*/, '').toLowerCase();
  const marker = card => card?.type === 'Location' && card.subType === 'Site' && /^hoth:/.test(title(card))
    ? Number(title(card).match(/\(([1-7])(?:st|nd|rd|th) marker\)/)?.[1]) || null : null;
  const onHoth = card => card?.type === 'Location' && /^hoth(?::|$)/.test(title(card));
  const echo = card => onHoth(card) && /: echo /.test(title(card));
  const generator = card => card?.id === 'Light:5586' && !card.blownAway && !card.collapsed && !card.gameTextCancelled && !card.faceDown;
  const live = card => !!card && !card.captured && !card.missing && !card.inactive && !card.switchedOff;
  const text = card => live(card) && !card.gameTextCancelled && !card.asleep &&
    !card.attachments?.some(item => item.suppressesHostText || ['Light:2100','Dark:2099'].includes(item.id));
  const units = (state, side) => {
    const result=[];
    function visit(card,slot,carriers=[]) {
      result.push({card,slot,carriers,side});
      for(const entry of card.occupants ?? [])visit(entry.card,slot,[card,...carriers]);
    }
    (side==='Light'?state.light:state.dark)?.forEach((row,slot)=>row.forEach(card=>visit(card,slot)));
    return result;
  };
  function shielded(state, slot, seen = new Set()) {
    if(!state?.locations?.some(generator) || seen.has(slot))return false;
    seen.add(slot);
    const site=state.locations[slot];
    if(!site)return false;
    if(site.hostInstanceId) {
      const host=['Light','Dark'].flatMap(side=>units(state,side)).find(entry=>entry.card.instanceId===site.hostInstanceId);
      return !!host && shielded(state,host.slot,seen);
    }
    return echo(site) || marker(site)!==null && marker(site)<=3;
  }
  const boundary = locations => locations.some(card => [4,5,6].includes(marker(card)));
  function generatorPlan(locations, reserve) {
    if(boundary(locations))return {allowed:true,search:false};
    const index=reserve.findIndex(card=>onHoth(card)&&marker(card)===4);
    return index>=0?{allowed:true,search:true,index}:{allowed:false,search:true};
  }
  function canDeploy(state, side, card, slot) {
    return side!=='Dark' || !['Character','Vehicle','Starship'].includes(card?.type) || !shielded(state,slot);
  }
  function canTravel(state, side, from, to, kind) {
    return side!=='Dark' || ![from,to].some(slot=>shielded(state,slot)) ||
      ['Landspeed','Einsteigen','Aussteigen','Rolle wechseln','Board','Disembark'].includes(kind);
  }
  function markerExtremes(state) {
    const sites=state.locations.map((card,slot)=>({card,slot,marker:marker(card)})).filter(entry=>entry.marker!==null);
    sites.sort((a,b)=>a.marker-b.marker);
    return {inner:sites[0]?.slot??null,outer:sites.at(-1)?.slot??null,sites};
  }
  function stormStep(state, slot, direction = -1) {
    const {sites}=markerExtremes(state),index=sites.findIndex(entry=>entry.slot===slot);
    if(index<0)return {lost:true};
    if(index===0)direction=1;
    const next=sites[index+direction];
    return next?{slot:next.slot,direction}:{lost:true};
  }
  const protectedFromWeather = (card,turn) => card.weatherProtectionTurn===turn ||
    !card.missing&&!card.inactive&&card.attachments?.some(item=>item.id==='Light:1165'&&text(item));
  function searchBonus(state, side, slot, party) {
    let bonus=party.reduce((sum,card)=>sum+(card.characteristics?.some(trait=>trait.toLowerCase()==='scout')?2:1),0);
    const region=title(state.locations[slot]).split(':')[0];
    const sites=(state.locationOrder??state.locations.map((_,i)=>i)).filter(i=>state.locations[i]?.subType==='Site'&&title(state.locations[i]).split(':')[0]===region);
    if(['Light','Dark'].flatMap(actor=>units(state,actor)).some(entry=>(entry.slot===slot||sites.includes(entry.slot)&&Math.abs(sites.indexOf(entry.slot)-sites.indexOf(slot))===1)&&text(entry.card)&&entry.card.attachments?.some(item=>item.id==='Light:1990'&&(item.owner??item.side)===side&&text(item)&&(typeof PremiereUnits==='undefined'||PremiereUnits.canUseDevice(state,entry.card,item)))))bonus+=3;
    for(const {card,slot:vehicleSlot} of units(state,side)) {
      if(vehicleSlot!==slot || card.id!=='Light:2120' || !text(card))continue;
      const pilots=(card.occupants??[]).filter(entry=>entry.role==='pilot'&&live(entry.card));
      if(pilots.length&&pilots.every(entry=>party.includes(entry.card))) {bonus+=2;break;}
    }
    return bonus;
  }
  const combat = card => card?.type==='Vehicle'&&/^Combat\b/.test(card.subType??'');
  const atat = card => combat(card)&&/\bAT-AT\b/.test(card.subType);
  const t47 = card => combat(card)&&/\bT-47\b/.test(card.subType);
  const creatureVehicle = card => card?.type==='Vehicle'&&card.subType==='Creature';
  const artillery = card => card?.type==='Weapon'&&/^Artillery\b/.test(card.subType??'');
  const pilotIdentity = (pilot,name) => title(pilot).includes(name) || pilot.personas?.some(item=>item.toLowerCase()===name);
  function crewWeaponBonus(host) {
    if(!text(host))return 0;
    const crew=host.occupants??[];
    // Different gunner titles combine; additional copies of one title do not stack.
    const passengers=[...new Map(crew.filter(entry=>entry.role==='passenger'&&text(entry.card)).map(entry=>[entry.card.id,entry])).values()];
    return passengers.reduce((sum,{card})=>sum+
      (['Light:2126','Dark:1272'].includes(card.id)?1:
       card.id==='Light:595'?(host.id==='Light:2119'||crew.some(entry=>live(entry.card)&&pilotIdentity(entry.card,'luke'))?3:1):
       card.id==='Light:2796'?(host.id==='Light:2121'||crew.some(entry=>live(entry.card)&&['wedge','jek'].some(name=>pilotIdentity(entry.card,name)))?3:1):0),0);
  }
  function pilotPower(host,pilot,ordinary) {
    if(!text(pilot))return 0;
    if(pilot.id==='Dark:160'&&combat(host))return atat(host)?3:2;
    if(pilot.id==='Dark:1029'&&combat(host))return 3;
    if(pilot.id==='Dark:363'&&host.id==='Dark:2657')return 3;
    if(pilot.id==='Dark:368'&&/executor/.test(title(host)))return 3;
    return ordinary;
  }
  return Object.freeze({VERSION,title,marker,onHoth,echo,generator,live,text,units,shielded,boundary,generatorPlan,canDeploy,
    canTravel,markerExtremes,stormStep,protectedFromWeather,searchBonus,combat,atat,t47,creatureVehicle,artillery,crewWeaponBonus,pilotPower});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=HothRules;
