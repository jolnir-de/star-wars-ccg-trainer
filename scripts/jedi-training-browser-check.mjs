import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {startLocalV2Server} from './serve-v2-local.mjs';

test('German Dagobah popups and explicit Jedi mentor/pupil choices lead from Test one to Test two',{timeout:180000},async()=>{
 const server=startLocalV2Server({port:0,reportPath:null});let browser;
 try{
  await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({channel:process.env.SWCCG_CHROMIUM_CHANNEL||'chrome'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await page.goto(origin+'/v2.html');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
  await page.locator('#launchSides [data-side="light"]').click();await page.locator('[data-deck-format="premiere-a-new-hope-hoth-dagobah"] [data-deck="yodas-schule"]').click();
  await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.locator('#start').click();
  await page.evaluate(()=>{let tries=0;do{dispatchUI(legalActions(null,'Light').find(o=>o.kind==='chooseStart'));if(!setupDecks.revealed.collision)break;if(++tries>30)throw Error('setup loop');dispatchUI(legalActions(null,'Light').find(o=>o.kind==='retrySetup'));}while(true);dispatchUI(legalActions(null,'Light').find(o=>o.kind==='beginGame'));});
  // Arrange a visible legal training position using only the actual 120 deck
  // instances. All decisions after this fixture use normal UI and rule actions.
  const ids=await page.evaluate(()=>{
   const game=state.game,pool=[...state.locations.filter(Boolean),...PremiereGame.sides.flatMap(side=>{const z=PremiereGame.zones(state,side);return [...z.hand,...z.deck,...z.force,...z.used,...z.lost];})];
   state=PremiereGame.createState(game,pool.filter(c=>c.owner==='Light'),pool.filter(c=>c.owner==='Dark'),[],[],'Light');
   for(const side of PremiereGame.sides){const z=PremiereGame.zones(state,side);z.deck.push(...z.hand.splice(0));}
   const take=id=>{const z=PremiereGame.zones(state,id.split(':')[0]),i=z.deck.findIndex(c=>c.id===id);if(i<0)throw Error('fixture missing '+id);return z.deck.splice(i,1)[0];};
   state.locations=['Light:598','Light:602','Light:600','Light:601','Light:603'].map(take);state.locationOrder=initialLocationOrder(state.locations);state.light=state.locations.map(()=>[]);state.dark=state.locations.map(()=>[]);
   const mentor=take('Light:2304'),yoda=take('Light:2865'),trooper=take('Light:2052'),pupil=take('Light:1495');state.light[0].push(mentor,yoda,trooper);state.hand.push(take('Light:1071'),pupil,take('Light:30'));PremiereGame.moveTop(state.deck,state.force,8);
   // Keep the two original high-destiny cards for the training draws.
   for(const id of ['Light:1332','Light:1602']){const z=PremiereGame.zones(state,'Light');let card;for(const name of ['deck','force']){const i=z[name].findIndex(c=>c.id===id);if(i>=0){card=z[name].splice(i,1)[0];break;}}if(!card)throw Error('missing destiny');state.deck.push(card);}
   const high=state.deck.splice(state.deck.findIndex(c=>c.id==='Light:1332'),1)[0];state.deck.push(high);
   state.activated=true;state.botTurn=null;PremiereGame.setPhase(state,2);selected=-1;selectedTableCard=null;handAdviceCache=null;render();return {mentor:mentor.instanceId,pupil:pupil.instanceId};
  });
  assert.equal(await page.evaluate(()=>dagobahCatalog.length===180&&dagobahCatalog.every(c=>cardTextDetails(c).includes(escapeHTML(c.texts.explanationDe)))),true);
  await page.getByRole('button',{name:'Great Warrior auswählen',exact:true}).click();
  await page.getByLabel('Mentor wählen',{exact:true}).selectOption(ids.mentor);await page.getByLabel('Schüler wählen',{exact:true}).selectOption(ids.pupil);
  assert.match(await page.locator('#playmatSelection').innerText(),/Son Of Skywalker.*Leia Organa/s);
  await page.locator('#playmatSelection').screenshot({path:'.hosting-qa-jedi-selection.png'});
  await page.getByRole('button',{name:/^Jedi-Test 1 auslegen/}).click();
  assert.equal(await page.evaluate(()=>state.tableEffects[0].mentor.instanceId),ids.mentor);assert.equal(await page.evaluate(()=>state.tableEffects[0].apprentice.instanceId),ids.pupil);
  await page.evaluate(()=>{state.game.timing.turn+=2;PremiereGame.setPhase(state,1);checkpoint('phase:start',()=>{});render();});
  await page.getByLabel('Dagobah-Bonus für Jedi-Test 1',{exact:true}).selectOption('5');await page.getByRole('button',{name:'Jedi-Test 1 versuchen',exact:true}).click();
  assert.match(await page.locator('#jediTrainingControls').innerText(),/bestanden: 1 ✓/);await page.getByRole('button',{name:'Jedi-Test 2 auswählen',exact:true}).click();
  await page.locator('#step').click();await page.getByLabel('Trainingsort wählen',{exact:true}).selectOption('1');await page.getByLabel('Mentor wählen',{exact:true}).selectOption(ids.mentor);
  await page.getByRole('button',{name:/^Jedi-Test 2 auslegen/}).click();assert.match(await page.locator('#jediTrainingControls').innerText(),/persönlicher Landspeed/);
  await page.locator('#step').click();await page.locator('#step').click();
  await page.evaluate(()=>{if(state.pendingCardView?.side==='Dark'){const pass=legalActions(state,'Dark').find(o=>o.kind==='finishCardInformation'&&o.args.includes('done'));if(pass)performAction(pass);}});
  await page.getByRole('button',{name:/^Aktionen für.*Leia Organa/}).click();
  await page.locator('#playmatSelection .playmat-action-group').filter({hasText:'Dagobah: Training Area'}).getByRole('button',{name:/Landspeed/}).click();
  await page.evaluate(()=>{state.game.timing.turn+=2;PremiereGame.setPhase(state,1);checkpoint('phase:start',()=>{});render();});await page.getByRole('button',{name:'Jedi-Test 2 versuchen',exact:true}).click();
  assert.match(await page.locator('#jediTrainingControls').innerText(),/bestanden: 1 ✓ · 2 ✓/);
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow at '+width);}
  assert.deepEqual(errors,[]);
 }finally{try{await browser?.close();}finally{server.closeAllConnections();await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}}
});
