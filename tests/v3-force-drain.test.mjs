import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/v3-drain-harness.mjs';
import {harness as v2Cloud} from './support/cloud-city-harness.mjs';
import {harness as v2JP} from './support/jabbas-palace-harness.mjs';
import {checkSavedSteps,savedPosition} from './support/v3-save-harness.mjs';
import trace from '../v3/engine/drain-explanation.js';
const cloud='premiere-a-new-hope-hoth-dagobah-cloud-city',jp=cloud+'-jabbas-palace';
const setup=`state.phase=1;state.locations[0]=card('Light:2447');state.light[0]=[card('Light:1593')];state.dark[0]=[];`;
function assertArithmetic(h,side='Light',site=0){
 const result=JSON.parse(h.run(`JSON.stringify((()=>{const p=forceDrainEffects('${side}',${site});return p?V3DrainTrace.snapshot(p,p.optional):null})())`));
 assert.ok(result);const rows=result.rows.filter(trace.active).filter(row=>row.kind!=='cost');
 assert.equal(rows.reduce((sum,row)=>sum+(row.chosen??row.amount),0),result.total,'visible source rows reproduce actual total');
 for(const row of result.rows)if(row.amount&&['modifier','optional'].includes(row.kind))assert.ok(row.source?.id,'a card-driven term has a public source');
 assert.equal(result.total,h.run(`drainAmount(forceDrainEffects('${side}',${site}),forceDrainEffects('${side}',${site}).optional)`));
 return result;
}
test('trace arithmetic distinguishes cost, chosen/unused optional bonuses and the zero floor',()=>{
 const card={id:'Light:1386',name:'Lightsaber',instanceId:'one',side:'Light'};
 let plan=trace.base(1,card,'Light',0);plan=trace.modify(plan,[trace.term('modifier',-3,card,'penalty',0)]);plan=trace.optional(plan,[trace.term('optional',1,card,'saber',0)],[{weapon:card}]);plan=trace.cost(plan,[trace.term('cost',2,card,'tax')]);
 const zero=trace.snapshot(plan,0);assert.equal(zero.total,0);assert.equal(zero.cost,2);assert.equal(zero.rows.find(row=>row.kind==='optional').status,'unused');assert.equal(zero.rows.find(row=>row.kind==='floor').amount,2);
 const chosen=trace.snapshot(plan,1);assert.equal(chosen.rows.find(row=>row.kind==='optional').chosen,1);assert.equal(chosen.rows.find(row=>row.kind==='floor').amount,1);
 assert.equal(JSON.stringify(zero).includes('instanceId'),false,'source references cannot masquerade as inventory cards');
});
const cases=[
 ['Premiere location, effect, necklace and optional saber',setup+`state.game.playFormat='premiere';state.light[0][0].weapons=[card('Light:1386')];state.locationEffects[0]=[{card:card('Dark:1264'),drainModifier:{Light:-1}}];`],
 ['opponent printed site bonus and own weapon under Decree',`state.locations[0]=card('Light:459');state.dark[0]=[card('Dark:634')];state.dark[0][0].weapons=[card('Dark:2702')];state.light[0]=[];ccDecree=side=>side==='Light';`,'Dark'],
 ['negative site modifier under Decree',`state.locations[0]=card('Dark:449');state.light[0]=[card('Light:1593')];state.dark[0]=[];ccDecree=side=>side==='Dark';`],
 ['Jedi Test 1 suppresses each positive but preserves penalties',setup+`const pupil=card('Light:2304'),test=card('Light:1071');test.dagobahJediTest=1;pupil.attachments=[test];state.light[3]=[pupil];state.dark[0]=[card('Dark:308')];state.light[0]=[];state.locationEffects[0]=[{card:card('Dark:1264'),drainModifier:{Dark:2}},{card:card('Dark:1264'),drainModifier:{Dark:-1}}];`,'Dark'],
 ['Hoth system global bonus',setup+`state.locations[0]=card('Light:229');state.light[0]=[card('Light:2838')];state.tableEffects=[{card:card('Light:805'),target:'Light'}];`],
 ['Cloud City location and global Dark bonus',setup+`state.locations[0]=card('Dark:458');state.light[0]=[];state.dark[0]=[card('Dark:634')];state.tableEffects=[{card:card('Dark:614'),target:'Dark'}];`,'Dark'],
 ['Jabba EV-9D9 without fabricated presence',`state.phase=1;state.locations[0]=card('Dark:1355');state.light[0]=[];state.dark[0]=[card('Dark:887'),card('Dark:594')];`,'Dark',true],
 ['Projection and Alien global penalty',setup+`state.tableEffects=[{card:card('Light:25'),target:'Light'}];state.locations[0]=card('Dark:1357');state.dark[0]=[card('Dark:1009')];state.light[0]=[];state.locationEffects[0]=[{card:card('Light:1956'),site:0}];`,'Dark',true],
 ['Audience source on a different site',setup+`state.locations[1]=card('Dark:1353');state.dark[1]=[card('Dark:1003')];state.locations[0]=card('Dark:1357');state.dark[0]=[card('Dark:1009')];state.light[0]=[];`,'Dark',true],
 ['B’omarr Monk / Ithorian explain icon-derived base',setup+`state.locations[0]=card('Light:2855');state.light[0].push(card('Light:183'),card('Light:1339'));`,'Light',true],
];
for(const [name,position,side='Light',isJP=false]of cases)test('V3 source rows preserve V2 arithmetic: '+name,()=>{
 const old=isJP?v2JP():v2Cloud(),next=harness([],isJP);
 for(const h of [old,next])h.run(`state.game.cardRulesVersion=35;`+position);
 const numeric=h=>JSON.parse(h.run(`JSON.stringify((()=>{const p=forceDrainEffects('${side}',0);return p&&{base:p.base,modifier:p.modifier,optional:p.optional,weapons:p.weapons.map(w=>w.weapon?.id??w.host?.id)}})())`));
 assert.deepEqual(numeric(next),numeric(old));assertArithmetic(next,side);
});
test('bonus suppression identifies Great Warrior, retains enemy card bonuses and records canceled sabers',()=>{
 const h=harness();h.run(`state.locations[0]=card('Light:459');state.dark[0]=[card('Dark:634')];state.dark[0][0].weapons=[card('Dark:2702')];state.light[0]=[];const pupil=card('Light:2304'),test=card('Light:1071');test.dagobahJediTest=1;pupil.attachments=[test];state.light[3]=[pupil];`);
 const s=assertArithmetic(h,'Dark');assert.ok(s.rows.some(row=>row.kind==='optional'&&row.status==='canceled'&&row.suppressedBy.some(source=>source.id==='Light:1071')));assert.ok(s.rows.some(row=>trace.active(row)&&row.amount===1&&row.source?.id==='Light:459'));
});
test('Expand The Empire retains adjacent printed source and enabling effect',()=>{
 const h=harness();h.run(`state.locations[0]=card('Light:2471');state.locations[1]=card('Dark:2461');state.locationOrder=[0,1,2,3,4];state.dark[1]=[card('Dark:634')];state.light[1]=[];state.locationEffects[0]=[{card:card('Dark:914')}];`);
 const entries=JSON.parse(h.run("JSON.stringify(PremiereLocations.ruleEntriesAt(state,1,'Dark','forceDrain').map(e=>({id:e.card.id,via:e.via?.id,slot:e.slot})))"));
 assert.ok(entries.some(entry=>entry.via==='Dark:914'&&entry.slot===0));assertArithmetic(h,'Dark',1);
});
for(const [side,put]of [['Light','Light:2052'],['Dark','Dark:2355']])test('drain result survives every saved command and import for '+side,async()=>{
 await checkSavedSteps({name:'drain '+side,active:side,player:side,phase:1,setup:`locations(['Light:2447']);put('${side}',0,'${put}');`,steps:[{kind:'drain',side,expect:"state.drainExplanations.at(-1).status==='complete'&&state.drainExplanations.at(-1).paid===1"}]});
});
test('Control cancellation, both passes and autosave preserve the announced calculation',async()=>{
 await checkSavedSteps({name:'drain cancellation',format:cloud,active:'Dark',player:'Light',phase:1,setup:`locations(['Light:2447']);put('Dark',0,'Dark:2355');hand('Light','Light:521');`,steps:[
 {kind:'drain',side:'Dark',expect:"state.drainExplanations.at(-1).status==='announced'"},
 {kind:'interruptResponse',side:'Light'}, {kind:'passResponse',side:'Dark'}, {kind:'passResponse',side:'Light',expect:"state.drainExplanations.at(-1).status==='canceled'&&!state.pendingForceLoss&&state.drainExplanations.at(-1).canceledBy.id==='Light:521'"}
 ]});
});

test('local musician taxes and global drain costs have individual cost-only source rows',()=>{
 const h=harness();h.run(`state.phase=1;state.activeSide='Dark';state.locations[0]=card('Light:2471');state.locations[1]=card('Light:2440');state.locationOrder=[0,1,2,3,4];state.dark[0]=[card('Dark:634')];state.light[0]=[];state.light[1]=[card('Light:1242'),card('Light:942')];state.tableEffects=[{card:card('Light:2741'),target:'Light'}];`);
 const p=JSON.parse(h.run("JSON.stringify(drainPlan('Dark',0))"));assert.equal(p.cost,2);assert.deepEqual(p.trace.filter(row=>row.kind==='cost').map(row=>row.source.id).sort(),['Light:1242','Light:2741']);
 const s=trace.snapshot(p,0);assert.equal(s.total,3);assert.equal(s.cost,2);
});
test('loss limits show Resistance and We’re Doomed separately from drain arithmetic',()=>{
 const h=harness([],true);h.run(`state.phase=1;state.activeSide='Dark';state.locations[0]=card('Light:2471');state.light[0]=[];state.dark[0]=[card('Dark:634')];state.tableEffects=[{card:card('Light:2665'),target:'Light'}];state.doomedTurn=state.game.timing.turn;state.doomedSource=V3DrainTrace.ref(card('Light:2764'));initiateForceDrain('Dark',0,0);`);
 const record=JSON.parse(h.run('JSON.stringify(state.drainExplanations.at(-1))'));assert.equal(record.resolved.total,3);assert.equal(record.loss.amount,1);assert.deepEqual(record.loss.rows.map(row=>[row.source.id,row.amount]),[['Light:2665',-1],['Light:2764',-1]]);
});
test('hidden bluff identity never enters a public explanation or log',()=>{
 const h=harness();h.run(`state.phase=1;state.activeSide='Dark';state.locations[0]=card('Dark:2438');state.locations[0].bluffs=[card('Dark:634')];state.dark[0]=[card('Dark:2355')];state.light[0]=[];initiateForceDrain('Dark',0,0);`);
 const text=h.run('JSON.stringify(state.drainExplanations)');assert.ok(text.includes('Bluff'));assert.equal(text.includes('Dark:634'),false);assert.equal(text.includes('Darth Vader'),false);assertArithmetic(h,'Dark');
});
test('negative modifiers are clamped at zero with an explicit rule row',()=>{
 const h=harness();h.run(setup+`state.locationEffects[0]=[{card:card('Dark:1264'),drainModifier:{Light:-5}}];`);const s=assertArithmetic(h);assert.equal(s.total,0);assert.equal(s.rows.find(row=>row.kind==='floor').amount,4);
});
test('a loss paid by the player resumes and imports while individual choices remain open',async()=>{
 await checkSavedSteps({name:'pending drain loss',active:'Dark',player:'Light',phase:1,setup:`locations(['Light:2471']);put('Dark',0,'Dark:2355');`,steps:[
  {kind:'drain',side:'Dark',expect:"state.pendingForceLoss.remaining===3&&state.drainExplanations.at(-1).status==='paying'"},
  {kind:'loseForce',side:'Light',where:"action.args[0]==='deck'",expect:"state.drainExplanations.at(-1).paid===1&&state.pendingForceLoss.remaining===2"},
  {kind:'loseForce',side:'Light',where:"action.args[0]==='deck'"},
  {kind:'loseForce',side:'Light',where:"action.args[0]==='deck'",expect:"!state.pendingForceLoss&&state.drainExplanations.at(-1).status==='complete'&&state.drainExplanations.at(-1).paid===3"}
 ]});
});

test('a loss reduction larger than the debt records the actual reduction, not a negative loss',()=>{
 const h=harness([],true);h.run(`state.phase=1;state.activeSide='Dark';state.locations[0]=card('Light:2471');state.light[0]=[];state.dark[0]=[card('Dark:634')];initiateForceDrain('Dark',0,0);const debt=state.pendingForceLoss;settleLossAdjustment({interrupt:'reduceForceLoss',side:'Light',card:card('Light:1331'),debt,key:'remaining',amount:5});`);
 const item=JSON.parse(h.run('JSON.stringify(state.drainExplanations.at(-1))'));assert.equal(item.status,'complete');assert.equal(item.loss.amount,0);assert.equal(item.loss.rows.at(-1).amount,-3);assert.equal(item.loss.rows.at(-1).source.id,'Light:1331');
});
test('a response-time modifier changes the live calculation while retaining the original announcement',async()=>{
 const h=await savedPosition({name:'live drain',format:cloud,active:'Dark',player:'Light',phase:1,setup:`locations(['Light:2471']);put('Dark',0,'Dark:634');hand('Light','Light:521');`});
 h.act({kind:'drain',side:'Dark'});h.run(`state.locationEffects[0]=[{card:state.hand[0],drainModifier:{Dark:-1}}];`);
 assert.equal(h.run('state.drainExplanations.at(-1).announced.total'),3);
 assert.match(h.run('drainResponseMarkup(PremiereGame.responseWindow(state.game))'),/angesagt 3 Force/);
 assert.equal(h.run("V3DrainTrace.snapshot(forceDrainEffects('Dark',0),0).total"),2);
});

test('drain provenance replays identically for both sides in every released V3 format',async()=>{
 const formats=['premiere','premiere-a-new-hope','premiere-a-new-hope-hoth','premiere-a-new-hope-hoth-dagobah',cloud,jp];
 for(const format of formats)for(const side of ['Light','Dark'])await checkSavedSteps({name:format+' '+side,format,active:side,player:side,phase:1,setup:`locations(['Light:2447']);put('${side}',0,'${side==='Light'?'Light:2052':'Dark:2355'}');`,steps:[{kind:'drain',side,expect:"state.drainExplanations.at(-1).status==='complete'&&state.drainExplanations.at(-1).resolved.total===1"}]});
});
