import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import data from '../engine/premiere-data.js';
import learning from '../engine/premiere-learning.js';
import {harness} from './support/dagobah-harness.mjs';
import {savedPosition,checkSavedSteps} from './support/anh-save-harness.mjs';
const notes=JSON.parse(readFileSync(new URL('../data/dagobah-card-notes.json',import.meta.url),'utf8'));
const payload=JSON.parse(readFileSync(new URL('../data/dagobah.json',import.meta.url),'utf8'));
const setup=run=>run(`state.game.cardRulesVersion=35;const yoda=card('Light:2865'),luke=card('Light:2304'),leia=card('Light:1495');state.light[3]=[yoda,luke,leia];const complete=(id,n,pupil=luke)=>{const t=card(id);t.dagobahJediTest=n;(pupil.attachments??=[]).push(t);pupil.dagobahApprentice=true;pupil.dagobahMentorId=yoda.instanceId;};const play=mode=>performAction(legalActions(state,'Light').find(action=>action.mode===mode));`);

test('All 180 Dagobah explanations are German, curated, and survive catalog loading without replacing source text',()=>{
 const catalog=data.readCatalog(payload,'4');assert.equal(catalog.length,180);assert.deepEqual(Object.keys(notes).sort(),catalog.map(c=>c.id).sort());
 for(const card of catalog){assert.equal(card.texts.explanationDe,notes[card.id].explanationDe);assert.notEqual(card.texts.explanationDe,card.gametext);assert.ok(card.texts.explanationDe.length>45,card.id);assert.equal(card.gametext,payload.cards.find(c=>c.id===card.id).rawFront.gametext);assert.equal(card.texts.print,null);}
 const text=id=>notes[id].explanationDe;
 assert.match(text('Light:157'),/jederzeit.*Ruhezeit bleibt/);assert.match(text('Light:1084'),/unter dem Lost Pile/);assert.match(text('Dark:181'),/im Used Pile/);
 assert.match(text('Light:155'),/< 3.*< 6/);assert.match(text('Dark:2915'),/−1.*gefangen|gefangen.*−1/);
});

test('Every Jedi Test has a specific German timing and a usable example',()=>{
 for(const card of data.readCatalog(payload,'4').filter(c=>/^Jedi Test/.test(c.type))){const guide=learning.cardGuide(card,[]);assert.equal(guide.explanation,notes[card.id].explanationDe);assert.match(guide.timing,/Ausspielen-Phase/);assert.match(guide.example,/Test|Great Warrior/);}
});

test('A completed test frees the mentor for a new pupil, while an unfinished test reserves the mentor',()=>{
 const {run}=harness();setup(run);run(`state.hand=[card('Light:1071')];play('dago:testDeploy');`);
 assert.equal(run(`dagoJediTargets('Light',1,3).length`),0);
 run(`dagoCompleteJedi(state.tableEffects[0]);state.hand=[card('Light:1071')];`);
 assert.ok(run(`dagoJediTargets('Light',1,3).some(pair=>pair.apprentice.card===leia)`));
 run(`state.game.cardRulesVersion=34;`);assert.equal(run(`dagoJediTargets('Light',1,3).some(pair=>pair.apprentice.card===leia)`),false,'legacy rule replay keeps its target order');
});

test('Printed Jedi ability and simultaneous mentor roles cannot produce illegal pupils',()=>{
 const {run}=harness();setup(run);run(`const obi=card('Light:1803');state.light[3].push(obi);`);
 assert.equal(run(`dagoJediTargets('Light',1,3).some(pair=>pair.apprentice.card===obi)`),false);
 assert.ok(run(`dagoJediTargets('Light',1,3).some(pair=>pair.mentor.card===obi)`));
 run(`state.hand=[card('Light:1071')];performAction(legalActions(state,'Light').find(o=>o.mode==='dago:testDeploy'&&o.mentor===obi&&o.apprentice===leia));`);
 assert.equal(run(`dagoJediTargets('Light',1,3).some(pair=>pair.apprentice.card===obi)`),false);
 run(`state.tableEffects=[];state.light[3]=[luke];const ship=card('Light:2057');ship.occupants=[{card:yoda,role:'passenger'}];state.light[3].push(ship);`);
 assert.ok(run(`dagoJediTargets('Light',1,3).some(pair=>pair.mentor.card===yoda&&pair.apprentice.card===luke)`),'here permits a target aboard at that site');
 run(`state.hand=[card('Light:1071')];play('dago:testDeploy');PremiereGame.setPhase(state,1);checkpoint('phase:start',()=>{});`);
 assert.equal(run(`dagoJediOptions('Light').some(o=>o.mode==='dago:testAttempt')`),false,'attempting requires physical presence');
 run(`ship.occupants=[];state.light[3].push(yoda);`);assert.equal(run(`dagoJediOptions('Light').some(o=>o.mode==='dago:testAttempt')`),true);
});

test('The same pupil can change mentors between tests and then move to Jedi Test two',()=>{
 const {run}=harness();setup(run);run(`state.hand=[card('Light:1071')];performAction(legalActions(state,'Light').find(o=>o.mode==='dago:testDeploy'&&o.apprentice===leia));dagoCompleteJedi(state.tableEffects[0]);const obi=card('Light:1803');state.light[3].push(obi);state.hand=[card('Light:30')];`);
 assert.ok(run(`performAction(legalActions(state,'Light').find(o=>o.mode==='dago:testDeploy'&&o.site===4&&o.mentor===obi&&o.apprentice===leia))`));
 assert.equal(run(`state.tableEffects[0].mentor===obi`),true);
 run(`PremiereGame.setPhase(state,4);`);assert.equal(run(`performAction(legalActions(state,'Light').find(o=>o.kind==='move'&&o.card===leia&&o.to===4))`),true);
 run(`PremiereGame.setPhase(state,1);checkpoint('phase:start',()=>{});state.deck=[{...card('Light:259'),destiny:6}];`);assert.equal(run(`play('dago:testAttempt')`),true);assert.equal(run(`dagoCompleted('Light',2)`),true);
});

test('Captured training targets pause without losing the test, and can resume after release',()=>{
 const {run}=harness();setup(run);run(`state.hand=[card('Light:1071')];play('dago:testDeploy');yoda.captured=true;dagoJediContinuous();PremiereGame.setPhase(state,1);checkpoint('phase:start',()=>{});`);
 assert.equal(run(`state.tableEffects.length`),1);assert.equal(run(`dagoJediOptions('Light').some(o=>o.mode==='dago:testAttempt')`),false);
 run(`delete yoda.captured;`);assert.equal(run(`dagoJediOptions('Light').some(o=>o.mode==='dago:testAttempt')`),true);
});

test('The optional Dagobah-site bonus is a real validated choice and a failed test cannot be retried that turn',()=>{
 const {run}=harness();setup(run);run(`state.hand=[card('Light:1071')];play('dago:testDeploy');PremiereGame.setPhase(state,1);checkpoint('phase:start',()=>{});state.deck=[{...card('Light:259'),destiny:1}];const before=state.deck.length;`);
 assert.equal(run(`performAction({...legalActions(state,'Light').find(o=>o.mode==='dago:testAttempt'),args:['dago:testAttempt',state.tableEffects[0].card.instanceId,99]})`),false);
 assert.equal(run(`state.deck.length===before`),true);
 assert.equal(run(`performAction(legalActions(state,'Light').find(o=>o.mode==='dago:testAttempt'&&o.args.at(-1)===0))`),true);
 assert.equal(run(`dagoCompleted('Light',1)`),false);assert.equal(run(`dagoJediOptions('Light').some(o=>o.mode==='dago:testAttempt')`),false);
});

for(const n of [1,2,3,4])test('Jedi Test '+n+' requires a strict success threshold',()=>{
 for(const plus of [0,1]){const {run}=harness();setup(run);run(`const ids=['Light:1071','Light:30','Light:752','Light:2272'];for(let i=1;i<${n};i++)complete(ids[i-1],i,leia);const test=card(ids[${n}-1]);const site=${n===2?4:n===3?5:n===4?6:3};state.tableEffects=[{card:test,site,mentor:yoda,apprentice:leia,target:leia}];state.light[3]=[yoda,luke];state.light[site].push(leia);state.deck=[{...card('Light:259'),destiny:11+${n}-cardAbility(leia)-dagoTrainingModifier(state.tableEffects[0])+${plus}}];`);
  if(n===3){run(`PremiereGame.setPhase(state,5);checkpoint('turn:end',()=>{});const first=state.pendingCardView.choices.find(c=>c.args[0]==='attempt');finishDagobahChoice(state.pendingCardView,...first.args);`);}else run(`PremiereGame.setPhase(state,1);checkpoint('phase:start',()=>{});play('dago:testAttempt');`);
  assert.equal(run(`dagoCompleted('Light',${n})`),plus===1,'equality must fail, one above must succeed');
 }
});

test('Completed Test two blocks ordinary low-ability draws but preserves explicit if-unable-to-otherwise text',()=>{
 const {run}=harness();setup(run);run(`complete('Light:30',2);state.dark[4]=[card('Dark:2355')];`);assert.equal(run(`battleDestinyDrawCount('Dark',4,5)`),0);
 run(`state.dark[4]=[card('Dark:1524')];`);assert.equal(run(`battleDestinyDrawCount('Dark',4,1)`),1);
 run(`state.game.cardRulesVersion=34;`);assert.equal(run(`battleDestinyDrawCount('Dark',4,1)`),0);
});

test('All five tests can be played in sequence through actions, including movement, end-turn testing and meditation',()=>{
 const {run}=harness();setup(run);run(`const ids=['Light:1071','Light:30','Light:752','Light:2272','Light:1332'];const nextTurn=()=>{state.game.timing.turn+=2;state.movedThisTurn=[];checkpoint('turn:start',()=>{});};`);
 for(const n of [1,2,3,4,5]){
  run(`nextTurn();PremiereGame.setPhase(state,2);state.hand=[card(ids[${n}-1])];var site=${n===2?4:n===3?5:n===4?6:n===5?6:3};`);
  assert.equal(run(`performAction(legalActions(state,'Light').find(o=>o.mode==='dago:testDeploy'&&o.site===site&&o.apprentice===leia))`),true,'deploy test '+n);
  if(n>1&&n<5){run(`PremiereGame.setPhase(state,4);`);assert.equal(run(`performAction(legalActions(state,'Light').find(o=>o.kind==='move'&&o.card===leia&&o.to===site))`),true,'walk to test '+n);}
  run(`state.deck=[{...card('Light:259'),destiny:6},{...card('Light:259'),destiny:6}];`);
  if(n===3)run(`PremiereGame.setPhase(state,5);checkpoint('turn:end',()=>{});const first=state.pendingCardView.choices.find(c=>c.args[0]==='attempt');finishDagobahChoice(state.pendingCardView,...first.args);`);
  else{run(`nextTurn();PremiereGame.setPhase(state,1);checkpoint('phase:start',()=>{});`);assert.equal(run(`play('dago:testAttempt')`),true);}
  if(n===5){assert.equal(run(`dagoCompleted('Light',5)`),false);run(`nextTurn();checkpoint('turn:end',()=>{});{const choice=state.pendingCardView.choices[0];finishDagobahChoice(state.pendingCardView,...choice.args);}`);}
  assert.equal(run(`dagoCompleted('Light',${n})`),true,'complete test '+n);
 }
 assert.equal(run(`JSON.stringify(leia.attachments.filter(c=>c.dagobahJediTest).map(c=>c.dagobahJediTest))`),'[1,2,3,4,5]');assert.equal(run(`cardAbility(leia)`),5);
});

const uiSpec={name:'Jedi selector',format:'premiere-a-new-hope-hoth-dagobah',rulesVersion:35,phase:2,setup:`locations(['Light:598','Light:602','Light:600','Light:601','Light:603','Dark:599']);put('Light',0,'Light:2865');put('Light',0,'Light:1803');put('Light',0,'Light:2304');hand('Light','Light:1071','Light:1495','Light:30');`};
test('Unaffordable pupil quotes keep stable target IDs beside other affordable mentor pairs',async()=>{
 const h=await savedPosition(uiSpec);h.run(`state.used.push(...state.force.splice(2));select(0);const related=o=>o.mode==='dago:testDeploy';const quoted=unaffordableCardOffers('Light',related,legalActions(state,'Light').filter(related)).find(o=>o.option.mentor.id==='Light:2865'&&o.option.apprentice.id==='Light:1495');`);
 assert.equal(h.run(`!!quoted`),true);assert.match(h.run(`quoted.reason`),/Benötigt 3 Force.*2 Force/);
 h.run(`setJediChoice('apprentice',state.hand[1].instanceId);`);assert.match(h.elements.get('playmatSelection').innerHTML,/Benötigt 3 Force/);
 h.run(`state.force.push(state.used.pop());state.game.revision++;render();`);assert.equal(h.run(`JSON.stringify(legalActions(state,'Light').find(o=>o.mode==='dago:testDeploy'&&o.mentor.id==='Light:2865'&&o.apprentice.id==='Light:1495').args)===JSON.stringify(quoted.option.args)`),true);
 assert.equal(h.elements.get('playmatSelection').innerHTML.includes('<button disabled>Jedi-Test 1 auslegen'),false);
});
test('UI offers explicit mentor/student choices, marks a paired hand deployment playable and explains Test two',async()=>{
 const h=await savedPosition(uiSpec);h.run(`select(0);`);const markup=h.elements.get('playmatSelection').innerHTML;
 assert.match(markup,/aria-label="Mentor wählen"/);assert.match(markup,/aria-label="Schüler wählen"/);assert.match(markup,/Yoda/);assert.match(markup,/Obi-Wan/);
 assert.equal(h.run(`handAdviceModel(legalActions(state,playerSide())).entries[1].playable`),true);
 h.run(`select(2);`);assert.match(h.elements.get('playmatSelection').innerHTML,/zuerst Jedi-Test 1 abgeschlossen/);
});

test('An explicitly chosen mentor and apprentice survive autosave/reload and scenario import',async()=>{
 await checkSavedSteps({...uiSpec,steps:[{kind:'hothAction',where:`action.mode==='dago:testDeploy'&&action.mentor.id==='Light:1803'&&action.apprentice.id==='Light:1495'`,expect:`state.tableEffects[0].mentor.id==='Light:1803'&&state.tableEffects[0].apprentice.id==='Light:1495'`} ]});
});

test('A chosen zero-site training bonus and its failed attempt replay identically after reload',async()=>{
 await checkSavedSteps({name:'Jedi bonus replay',format:'premiere-a-new-hope-hoth-dagobah',rulesVersion:35,phase:1,
  setup:`locations(['Light:598','Light:602']);const mentor=put('Light',0,'Light:2865'),apprentice=put('Light',0,'Light:1495');hand('Light','Light:1071');const testCard=state.hand.pop();apprentice.dagobahApprentice=true;apprentice.dagobahMentorId=mentor.instanceId;state.tableEffects=[{card:testCard,site:0,target:apprentice,mentor,apprentice,dagobah:true}];state.dagobahTrainingWindow=state.game.timing.turn;top('Light','Light:1602');`,
  steps:[{kind:'hothAction',where:`action.mode==='dago:testAttempt'&&action.args.at(-1)===0`,expect:`state.tableEffects.length===1&&!dagoJediOptions('Light').some(o=>o.mode==='dago:testAttempt')`}]
 });
});
