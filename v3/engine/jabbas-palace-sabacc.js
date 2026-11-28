'use strict';
const jpSabaccVariant=card=>['Light:797','Dark:796'].includes(card.id)?'dune':['Light:1351','Dark:1350'].includes(card.id)?'palace':null;
function jpSabaccEligible(e,source){if(e.unavailable||e.card.type!=='Character')return false;return jpSabaccVariant(source)==='dune'?jpSpecies(e.card,'jawa')&&sitePlanet(state.locations[e.slot])==='tatooine':jpPalace(state.locations[e.slot])&&['gambler','gangster','smuggler','information broker'].some(t=>characterTraits(e.card).includes(t));}
function jpSabaccWild(card){const variant=state.cloudCitySabacc.jpVariant,title=jpTitle(card);return !variant?CloudCityRules.wild(card):variant==='dune'?card.type==='Location'&&/sandcrawler/.test(title)||['magnetic suction tube','jawa siesta','jawa pack'].includes(title):card.id==='Dark:1364'||jpDesert(card);}
function jpSabaccClone(card){if(jpSabaccWild(card))return false;const variant=state.cloudCitySabacc.jpVariant;return !variant?CloudCityRules.clone(card):variant==='dune'?card.type==='Location'&&sitePlanet(card)==='tatooine'||PremiereUnits.crawler(card)||/jawa ion gun|utinni!/.test(jpTitle(card)):card.subType==='Alien'||jpPalace(card);}
function jpSabaccValues(hand,assigned,gambler,side){
 const g=state.cloudCitySabacc,non=hand.flatMap((c,i)=>jpSabaccClone(c)?[]:[jpSabaccWild(c)?assigned[i]:c.destiny??0]);
 return hand.map((c,i)=>{const value=assigned[i];if(jpSabaccWild(c)){const min=g.jpVariant==='dune'?0:1,max=g.jpVariant==='dune'?7:6;if(!Number.isInteger(value)||value<min||value>max)throw Error('Ungültiger JP-Sabacc-Wild-Wert');return value;}
  if(jpSabaccClone(c)){const participant=g.players[side];if(value===4&&g.jpVariant==='palace'&&(gambler||ccPersona(participant,'Jabba'))||value===0&&!g.jpVariant&&gambler)return value;if(participant?.id==='Light:722'&&participant.destiny===value)return value;if(!non.length)return 0;if(!non.includes(value))throw Error('Clone muss einen erlaubten Wert kopieren');return value;}return c.destiny??0;
 });
}
const jpSabaccStake=(card,variant)=>variant==='dune'?card.type==='Device'||isDroid(card)&&!Number.isFinite(card.armor):card.type==='Weapon'&&card.subType==='Character'||card.type==='Character'&&card.subType==='Alien'&&JabbasPalaceRules.nonunique(card);
const jpSabaccBase={options:hothInterruptOptions,settle:settleHothInterrupt};
hothInterruptOptions=function(side,window=null){const out=jpSabaccBase.options(side,window);if(!jpEnabled()||window||battleSession||state.cloudCitySabacc||!PremiereGame.sides.every(s=>PremiereGame.reserveCards(jpOwn(s).deck).length>=2))return out;
 jpOwn(side).hand.forEach((card,index)=>{if(!jpSabaccVariant(card))return;for(const [i,e]of jpUnits().entries())if(e.side===side&&jpSabaccEligible(e,card))out.push({card,index,mode:'cc:jp:sabacc',choice:[index,'cc:jp:sabacc',i],label:card.name+' · '+e.card.name,cost:0,rule:{pile:card.subType==='Used'?'Used':'Lost'},participant:e.card});});return out;
};
settleHothInterrupt=function(frame,parent){if(jpEnabled()&&frame.mode==='cc:jp:sabacc'){if(frame.cancelled){finishPileInterrupt(frame);return;}ccStartSabacc(frame.side,frame.card,frame.participant,()=>finishPileInterrupt(frame));return;}return jpSabaccBase.settle(frame,parent);};
