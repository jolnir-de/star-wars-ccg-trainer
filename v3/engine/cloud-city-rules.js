'use strict';
const CloudCityRules=(()=>{
 const VERSION=33,FORMAT='premiere-a-new-hope-hoth-dagobah-cloud-city';
 const title=card=>String(card?.name??'').replace(/^(?:[•*]|<>)+\s*/,'').toLowerCase();
 const cloud=card=>card?.type==='Location'&&card.subType==='Sector'&&/cloud/.test(title(card));
 const city=card=>card?.type==='Location'&&/^cloud city:/.test(title(card));
 const sector=card=>cloud(card)&&/^bespin: cloud city$/.test(title(card));
 const car=card=>card?.type==='Vehicle'&&/cloud car/i.test(card.subType??'');
 const fighter=card=>card?.type==='Starship'&&(/Starfighter|Squadron/.test(card.subType??'')||/deploys? and moves? like a starfighter/i.test(card.gametext??''));
 const cloudCapable=card=>fighter(card)||car(card)||card?.type==='Vehicle'&&/Shuttle|Patrol/.test(card.subType??'');
 const gambler=card=>card?.characteristics?.includes('gambler');
 const wild=card=>card?.type==='Character'&&(/\blando\b/.test(title(card))||card.personas?.includes('Lando'))||card?.type==='Effect'&&title(card)==='weather vane';
 const clone=card=>card?.type==='Location'||card?.type==='Character'&&(title(card)==='ugnaught'||card.characteristics?.includes('ugnaught')||/\bugnaught\b/i.test(card.lore??''));
 function sabaccValues(hand,assignments=[],isGambler=false){
  const nonClones=hand.flatMap((card,i)=>clone(card)?[]:[wild(card)?assignments[i]:card.destiny]);
  return hand.map((card,i)=>{const value=assignments[i];if(wild(card)){if(!Number.isInteger(value)||value<1||value>6)throw Error('Wild card value must be 1–6');return value;}
   if(clone(card)){if(!nonClones.length)return 0;if(isGambler&&value===0)return 0;if(!nonClones.includes(value))throw Error('Clone must match a non-clone value');return value;}
   return Number.isFinite(card.destiny)?card.destiny:0;});
 }
 function sabaccResult(light,dark){
  if(light.perfect&&dark.perfect)return null;
  if(light.perfect)return 'Light';if(dark.perfect)return 'Dark';
  if(light.total<=11&&dark.total>11)return 'Light';if(dark.total<=11&&light.total>11)return 'Dark';
  const l=Math.abs(11-light.total),d=Math.abs(11-dark.total);
  return l<d?'Light':d<l?'Dark':light.count<dark.count?'Light':dark.count<light.count?'Dark':null;
 }
 const perfect=(hand,modifier=0)=>hand.length===2&&!modifier&&hand.every(card=>!wild(card)&&!clone(card))&&hand.reduce((sum,card)=>sum+(card.destiny??0),0)===11;
 return Object.freeze({VERSION,FORMAT,title,cloud,city,sector,car,fighter,cloudCapable,gambler,wild,clone,sabaccValues,sabaccResult,perfect});
})();
if(typeof module!=='undefined')module.exports=CloudCityRules;
