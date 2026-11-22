'use strict';
const jpEnabled=()=>!!state&&(currentGame()?.cardRulesVersion??0)>=34&&currentGame()?.playFormat===JabbasPalaceRules.FORMAT;
const jpTitle=JabbasPalaceRules.title,jpPalace=JabbasPalaceRules.palace,jpDesert=JabbasPalaceRules.desert,jpSpecies=JabbasPalaceRules.species;
const jpLive=card=>ccText(card),jpOwn=ccOwn,jpUnits=ccUnits,jpEntry=ccEntry,jpAt=ccAt,jpControl=ccControl;
const jpAll=(side,id)=>jpUnits().filter(e=>!e.unavailable&&(!side||e.side===side)&&(!id||e.card.id===id)&&jpLive(e.card));
const jpHas=(side,id)=>jpAll(side,id).length>0;
const jpAtAudience=(side,id)=>jpAll(side,id).some(e=>/audience chamber$/.test(jpTitle(state.locations[e.slot])));
const jpSame=(a,b)=>ccAtSame(a,b);
const jpOption=(card,mode,args,label,resolve,extra={})=>ccOption(card,'jp:'+mode,args,label,resolve,extra);
const jpOnce=(card,mode,args,label,cost,resolve,scope='turn')=>jpOption(card,mode,args,label,side=>{spendForce(side,cost);ccMark(card,'jp:'+mode,scope);return resolve(side);},{cost});
const jpUnused=(card,mode,scope='turn')=>!ccUsed(card,'jp:'+mode,scope);
const jpChoose=(side,card,mode,choices,done,extra={})=>ccChoose(side,card,'JP'+mode,choices,done,extra);
const jpRemove=card=>{const e=jpEntry(card);if(e)loseTableCard(e.side,e.slot,card);};
function jpRelocate(card,to){const e=jpEntry(card);if(!e||!detachTableCard(e.side,e.slot,card))return false;jpOwn(e.side).board[to].push(card);hothMoved(e.side,card,e.slot,to);return true;}
function jpGenericStartCollision(a,b){return (currentGame()?.cardRulesVersion??0)>=34&&currentGame()?.playFormat===JabbasPalaceRules.FORMAT&&['Light:2443','Dark:2442'].includes(a.id)&&['Light:2443','Dark:2442'].includes(b.id);}
function jpStartingInterrupts(complete){
 // createState's eight cards have not been displayed. Return them before either
 // Starting Interrupt is chosen, then shuffle and deal only after both resolve.
 for(const side of PremiereGame.sides){const own=jpOwn(side);own.deck.push(...own.hand.splice(0));}
 const chosen={};state.jpStarting=true;
 const select=i=>{if(i===2){resolve(0);return;}const side=PremiereGame.sides[i],cards=jpOwn(side).deck.filter(c=>['Light:2543','Dark:2651'].includes(c.id));if(!cards.length){chosen[side]=null;select(i+1);return;}
  jpChoose(side,cards[0]??{name:'Starting Interrupt'},'StartingSelect',[{args:['pass'],label:'Keinen Starting Interrupt spielen'},...cards.map(c=>({args:[c.instanceId],card:c,label:c.name+' als Starting Interrupt'}))],choice=>{chosen[side]=choice.card??null;select(i+1);},{botChoice:offers=>offers.find(o=>o.card)??offers[0]});
 };
 const order=[state.activeSide,PremiereGame.otherSide(state.activeSide)];
 const finish=()=>{for(const side of PremiereGame.sides){const own=jpOwn(side);own.deck.splice(0,own.deck.length,...PremiereGame.shuffleReserve(own.deck,state.game));PremiereGame.moveTop(own.deck,own.hand,8);}delete state.jpStarting;complete();};
 const resolve=i=>{if(i===2){finish();return;}const side=order[i],card=chosen[side];if(!card){resolve(i+1);return;}const own=jpOwn(side),index=own.deck.indexOf(card);if(index<0){resolve(i+1);return;}own.deck.splice(index,1);own.lost.push(card);
  log(side+' deckt '+card.name+' als Starting Interrupt auf.');
  jpStartingEffects(side,card,()=>resolve(i+1));
 };
 select(0);
}
function jpStartingEffects(side,source,done){
 const options=jpDeployOptions(side,source,'deck',card=>card.type==='Effect'&&!/use \d+ force to deploy/i.test(card.gametext??''),{}).filter(option=>option.cost===0);
 if(!options.length){done();return;}
 jpChoose(side,source,'StartingEffect',options.map((option,i)=>({args:[i],card:option.card,label:option.label,option})),choice=>{choice.option.resolve(side);done();});
}

const jpContinuousBase=hothContinuous;
hothContinuous=function(){jpContinuousBase();if(jpEnabled())for(const provider of jpContinuous)provider();};
const jpContinuous=[];

const jpHologram=card=>card?.characteristics?.some(c=>['hologram','dejarik'].includes(c.toLowerCase()))||holoEligible(card);
