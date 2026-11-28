'use strict';
const JabbasPalaceRules=(()=>{
 const VERSION=34,FORMAT='premiere-a-new-hope-hoth-dagobah-cloud-city-jabbas-palace';
 const title=card=>String(card?.name??'').replace(/^(?:[•*]|<>)+\s*/,'').toLowerCase();
 const palace=card=>card?.type==='Location'&&(/^jabba['’]s palace:/.test(title(card))||title(card)==="tatooine: jabba's palace");
 const desert=card=>card?.type==='Location'&&(/\bdesert\b/.test(title(card))||card.locationTags?.includes('Desert'));
 // Lore also mentions enemies, employers and vehicles. Those mentions do not
 // make the character a member of that species (e.g. Trandoshans hate Wookiees).
 const speciesIds={
  jawa:['Light:1373','Dark:1372','Dark:643','Light:1136','Light:174','Light:1408','Light:1988','Dark:1128','Dark:2817'],
  'tusken raider':['Dark:2648','Dark:2683'],kitonak:['Light:784','Light:1447'],saurin:['Light:2173','Light:1012'],
  snivvian:['Light:2916','Light:2810','Light:1014','Light:2292'],yarkora:['Light:2156','Light:2844'],
  'ishi tib':['Light:1329','Light:2247'],elom:['Light:828','Light:2420'],gamorrean:['Dark:1009','Dark:1862'],
  nikto:['Dark:1041','Dark:1448','Dark:1780','Dark:1802','Dark:2706','Dark:2724','Dark:2827'],
  whiphid:['Dark:1342','Dark:2804'],skrilling:['Dark:1928','Dark:2275'],
  corellian:['Light:1098','Light:529','Light:2035','Light:2786','Light:2128','Light:1482','Light:1890','Dark:791','Dark:700','Dark:1633'],
  rodian:['Dark:1073','Dark:2117','Dark:214'],weequay:['Dark:2788','Dark:2789','Dark:2790','Dark:2791'],
  hutt:['Dark:1346'],advosze:['Dark:67'],wookiee:['Light:394'],ugnaught:['Dark:2661','Dark:2662','Light:2903'],
  miner:['Light:2592','Dark:2591','Light:1964'],ewok:[]
 };
 const species=(card,name)=>card?.type==='Character'&&((card.characteristics??[]).some(trait=>trait.toLowerCase()===name.toLowerCase())||(speciesIds[name.toLowerCase()]??[]).includes(card.jpRuleOriginalId??card.id));
 const nonunique=card=>card?.uniquenessLimit!==1;
 const female=card=>/\b(she|her|female)\b/i.test(card?.lore??'')||['Light:221','Light:1489','Light:1495','Light:1943','Dark:2613','Light:1092','Light:1393','Light:1842','Light:1945','Light:1482','Light:1505','Light:2247'].includes(card?.jpRuleOriginalId??card?.id);
 return Object.freeze({VERSION,FORMAT,title,palace,desert,species,nonunique,female});
})();
if(typeof module!=='undefined')module.exports=JabbasPalaceRules;
