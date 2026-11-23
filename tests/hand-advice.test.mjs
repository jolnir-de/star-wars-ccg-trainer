import test from 'node:test';
import assert from 'node:assert/strict';
import {savedPosition} from './support/anh-save-harness.mjs';
const lightSetup=`locations(['Light:2447']);hand('Light','Light:2052','Light:1593','Light:265','Light:2217');`;
const fixture=(extra={})=>savedPosition({name:'Hand advice',format:'premiere',rulesVersion:34,phase:2,setup:lightSetup,...extra});
const entries=h=>JSON.parse(h.run(`JSON.stringify(handAdviceModel(legalActions(state,playerSide())).entries.map(e=>({id:e.card.id,playable:e.playable,reason:e.reason})))`));

test('Hand frames distinguish legal plays, insufficient Force, missing hosts and missing triggers',async()=>{
 const h=await fixture();h.run(`state.used.push(...state.force.splice(2));handAdviceCache=null;`);
 const cards=entries(h);assert.equal(cards[0].playable,true);assert.equal(cards[1].playable,false);assert.match(cards[1].reason,/Benötigt 3 Force.*2 Force/);assert.match(cards[2].reason,/kein zulässiges Ziel/);assert.match(cards[3].reason,/Auslöser|Ziel/);
 const before=h.run(`JSON.stringify({state,battleSession})`);h.run(`handAdviceCache=null;handAdviceModel(legalActions(state,playerSide()));`);assert.equal(h.run(`JSON.stringify({state,battleSession})`),before,'Advice must not spend Force, advance RNG or modify game state');
});
test('The recommended card is legal, highlights one actual hand instance and can be selected without playing',async()=>{
 const h=await fixture();assert.equal(h.run(`handAdviceModel(legalActions(state,playerSide())).recommendation.card.id`),'Light:1593');
 const before=h.snapshot();h.run(`const advice=handAdviceModel(legalActions(state,playerSide()));select(advice.recommendation.index);`);assert.equal(h.snapshot(),before);assert.match(h.elements.get('hand').innerHTML,/hand-recommended/);assert.equal((h.elements.get('hand').innerHTML.match(/hand-recommended/g)??[]).length,1);assert.equal(h.run('selected'),1);
});
test('Phase and opponent priority override nominal affordability',async()=>{
 const h=await fixture({phase:4});assert.ok(entries(h).every(e=>!e.playable));assert.match(entries(h)[0].reason,/Ausspielen-Phase/);assert.equal(h.run(`handAdviceModel(legalActions(state,playerSide())).recommendation`),null);
});
test('Force-loss payments do not turn discarded hand cards green',async()=>{
 const h=await fixture();h.run(`beginForceLoss('Light',1,{reason:'test',hoth:true});handAdviceCache=null;`);assert.ok(entries(h).every(e=>!e.playable));assert.match(entries(h)[0].reason,/Force-Verlust/);assert.equal(h.run(`handAdviceModel(legalActions(state,'Light')).recommendation`),null);
});
test('Dark Side advice uses the Dark hand and can answer an opponent deployment',async()=>{
 const h=await fixture({player:'Dark',active:'Light',setup:`locations(['Light:2447']);hand('Light','Light:2052');hand('Dark','Dark:1263');`});
 h.act({kind:'deploy',side:'Light',where:"action.card.id==='Light:2052'"});assert.equal(entries(h)[0].playable,true);assert.equal(h.run(`handAdviceModel(legalActions(state,'Dark')).recommendation.card.id`),'Dark:1263');
});
test('Recommendation does not inspect the opposing hand or Reserve Deck order',async()=>{
 const h=await fixture({setup:lightSetup+`hand('Dark','Dark:634');`});const before=h.run(`handAdviceModel(legalActions(state,'Light')).recommendation.card.id`);
 h.run(`state.botHand=state.botHand.map(c=>({...c,...catalog.find(x=>x.id==='Dark:2216'),instanceId:c.instanceId}));state.botDeck.reverse();handAdviceCache=null;`);assert.equal(h.run(`handAdviceModel(legalActions(state,'Light')).recommendation.card.id`),before);
});
test('Displaying and selecting the same revision reuses advice without another relaxed enumeration',async()=>{
 const h=await fixture();h.run(`handAdviceCache=null;const originalQuote=unaffordableCardOffers;let quoteCalls=0;unaffordableCardOffers=(...args)=>{quoteCalls++;return originalQuote(...args);};handAdviceModel(legalActions(state,'Light'));handAdviceModel(legalActions(state,'Light'));`);assert.equal(h.run('quoteCalls'),1);
});
test('Sabacc hand is not described as a set of ordinary deployable cards',async()=>{
 const h=await fixture();h.run(`state.cloudCitySabacc={hands:{Light:[state.hand[0]],Dark:[]}};handAdviceCache=null;renderHandAdvice(handAdviceModel([]));`);assert.equal(h.elements.get('handAdvice').hidden,true);
});

test('Advice tolerates a partial legacy position without a game or a hand',async()=>{
 const h=await fixture();h.run(`state={locations:[],light:[],dark:[]};`);assert.equal(h.run(`handAdviceModel([]).entries.length`),0);
 h.run(`state.hand=[{name:'Legacy card'}];`);assert.equal(h.run(`handAdviceModel([]).entries[0].playable`),false);
});

test('Replacing a hand outside the action runner invalidates cached advice',async()=>{
 const h=await fixture();h.run(`handAdviceModel(legalActions(state,playerSide()));state.hand=[state.hand[0]];`);assert.equal(entries(h).length,1);
 h.run(`state.hand.push({...state.hand[0],instanceId:'additional-copy'});`);assert.equal(entries(h).length,2);
});
