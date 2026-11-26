import test from 'node:test';
import assert from 'node:assert/strict';
import {savedPosition,checkSavedSteps} from './support/anh-save-harness.mjs';

const setup=`locations(['Light:603','Light:601','Light:600','Light:598','Light:602']);
const yoda=put('Light',0,'Light:2865'),luke=put('Light',0,'Light:2304'),pilot=put('Light',0,'Light:2040'),trooper=put('Light',0,'Light:2052');
hand('Light','Light:1071','Light:1071','Light:30');
state.tableEffects=state.hand.splice(0,2).map((card,i)=>{
 const mentor=[yoda,luke][i],apprentice=[pilot,trooper][i];
 apprentice.dagobahApprentice=true;apprentice.dagobahMentorId=mentor.instanceId;
 return {card,mentor,apprentice,target:apprentice,site:0,dagobah:true};
});
state.dagobahTrainingWindow=state.game.timing.turn;top('Light','Light:1992','Light:1332');`;
const spec={name:'Two pupils with a Destiny choice',format:'premiere-a-new-hope-hoth-dagobah',rulesVersion:35,phase:1,copies:{'Light:2272':1},setup};
const attempt={kind:'hothAction',where:`action.mode==='dago:testAttempt'&&action.args.at(-1)===5`};

test('Training decisions appear beside the pupils, results explain success/failure, and the other pupil can still try',async()=>{
 const h=await savedPosition(spec);assert.equal(h.act(attempt),true);
 assert.equal(h.run(`state.pendingCardView.mode`),'destinyValue');
 assert.match(h.elements.get('jediTrainingControls').innerHTML,/Versuch läuft.*Destiny 2 wählen.*Destiny 5 wählen/s);
 assert.equal(h.elements.get('controlPanel').innerHTML,'','the decision has one location, without duplicate control IDs');
 assert.equal(h.act({kind:'finishCardInformation',args:[5]}),true);
 assert.match(h.elements.get('jediTrainingControls').innerHTML,/Rebel Pilot · Bestanden ✓.*inklusive Boni 11 \+ Ability 2 = 13/s);
 assert.match(h.elements.get('jediTrainingControls').innerHTML,/Jedi-Test 2 auswählen/);
 assert.equal(h.run(`dagoJediOptions('Light').filter(o=>o.mode==='dago:testAttempt').length`),6);
 assert.equal(h.act(attempt),true);
 assert.match(h.elements.get('jediTrainingControls').innerHTML,/Rebel Trooper · Nicht bestanden.*inklusive Boni 10 \+ Ability 1 = 11/s);
 assert.match(h.elements.get('jediTrainingControls').innerHTML,/In diesem Zug bereits versucht/);
 assert.equal(h.run(`dagoJediOptions('Light').some(o=>o.mode==='dago:testAttempt')`),false);
 assert.equal(h.run(`!!state.dagobahTrainingResolution`),false);
 assert.ok(h.run(`!document.getElementById('board').innerHTML.includes('Dagobah-Bonus +')`),'no six repeated training buttons in each location column');
});

test('Both training outcomes and an unresolved Destiny choice survive autosave, reload and scenario import',async()=>{
 await checkSavedSteps({...spec,steps:[
  {...attempt,expect:`state.pendingCardView.mode==='destinyValue'&&!!state.dagobahTrainingResolution`},
  {kind:'finishCardInformation',args:[5],expect:`state.dagobahTrainingResults[0].passed&&state.dagobahTrainingWindow===state.game.timing.turn`},
  {...attempt,expect:`state.dagobahTrainingResults.length===2&&!state.dagobahTrainingResults[1].passed`}
 ]});
});

test('A low chosen Destiny visibly fails without spending the other pupil’s attempt',async()=>{
 const h=await savedPosition(spec);h.act(attempt);h.act({kind:'finishCardInformation',args:[2]});
 assert.equal(h.run(`state.dagobahTrainingResults[0].total`),10);
 assert.match(h.elements.get('jediTrainingControls').innerHTML,/Rebel Pilot · Nicht bestanden/);
 assert.equal(h.run(`dagoJediOptions('Light').filter(o=>o.mode==='dago:testAttempt').length`),6);
 assert.equal(h.act(attempt),true);
});

test('An opposing trained apprentice’s Destiny reaction keeps the beginning-of-Control window open; an ordinary search closes it',async()=>{
 await checkSavedSteps({...spec,name:'Training through a converted apprentice reaction',format:spec.format+'-cloud-city',
  setup:setup+`const converted=put('Dark',1,'Light:1495'),completed=take('Light:752');completed.dagobahJediTest=3;converted.attachments=[completed];`,
  steps:[attempt,{kind:'finishCardInformation',args:[5],expect:`PremiereGame.responseWindow(state.game)?.purpose==='training'`},
   {kind:'interruptResponse',side:'Dark',args:[-1,'dago:testThree'],expect:`state.dagobahTrainingWindow===state.game.timing.turn&&!!state.dagobahTrainingResolution`},
   {kind:'passResponse'},{kind:'passResponse',side:'Dark',expect:`state.dagobahTrainingResults[0].total===12&&!state.dagobahTrainingResults[0].passed`},
   {...attempt,where:attempt.where+`&&action.card===state.tableEffects[1].card`},
   {kind:'passResponse',side:'Dark'},{kind:'passResponse',expect:`state.dagobahTrainingResults.length===2&&state.dagobahTrainingWindow===state.game.timing.turn`},
   {kind:'hothAction',where:`action.mode==='dago:trainingSearch'`,expect:`state.dagobahTrainingWindow===undefined`}
  ]});
});
