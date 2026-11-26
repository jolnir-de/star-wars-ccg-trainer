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
  await page.getByRole('button',{name:'Jedi-Ausbildung öffnen',exact:true}).click();
  await page.getByLabel('Dagobah-Bonus für Jedi-Test 1',{exact:true}).selectOption('5');await page.getByRole('button',{name:'Jedi-Test 1 versuchen',exact:true}).click();
  assert.match(await page.locator('#jediTrainingControls').innerText(),/bestanden: 1 ✓/);await page.getByRole('button',{name:'Jedi-Test 2 auswählen',exact:true}).click();
  await page.keyboard.press('Escape');
  await page.locator('#step').click();await page.getByLabel('Trainingsort wählen',{exact:true}).selectOption('1');await page.getByLabel('Mentor wählen',{exact:true}).selectOption(ids.mentor);
  await page.getByRole('button',{name:/^Jedi-Test 2 auslegen/}).click();assert.match(await page.locator('#jediTrainingControls').innerText(),/persönlicher Landspeed/);
  await page.locator('#step').click();await page.locator('#step').click();
  await page.evaluate(()=>{if(state.pendingCardView?.side==='Dark'){const pass=legalActions(state,'Dark').find(o=>o.kind==='finishCardInformation'&&o.args.includes('done'));if(pass)performAction(pass);}});
  await page.getByRole('button',{name:/^Aktionen für.*Leia Organa/}).click();
  await page.locator('#playmatSelection .playmat-action-group').filter({hasText:'Dagobah: Training Area'}).getByRole('button',{name:/Landspeed/}).click();
  await page.evaluate(()=>{state.game.timing.turn+=2;PremiereGame.setPhase(state,1);checkpoint('phase:start',()=>{});render();});await page.getByRole('button',{name:'Jedi-Ausbildung öffnen',exact:true}).click();await page.getByRole('button',{name:'Jedi-Test 2 versuchen',exact:true}).click();
  assert.match(await page.locator('#jediTrainingControls').innerText(),/bestanden: 1 ✓ · 2 ✓/);
  // Reproduce two simultaneous Test-1 pupils and a drawn R2-D2. Its 2/5
  // decision used to sit above the board, leaving the training UI blocked.
  await page.evaluate(()=>{
   const game=state.game,seen=new Set(),pool=[];
   function collect(value,key){
    if(key==='starterDecks'||!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
    if(value.instanceId)pool.push({...structuredClone([...catalog,...aNewHopeCatalog,...hothCatalog,...dagobahCatalog].find(c=>c.id===value.id)),instanceId:value.instanceId,owner:value.owner});
    for(const [name,item] of Object.entries(value))collect(item,name);
   }
   collect(state);if(pool.length!==120)throw Error('fixture must retain all 120 instances');
   state=PremiereGame.createState(game,pool.filter(c=>c.owner==='Light'),pool.filter(c=>c.owner==='Dark'),[],[],'Light');
   for(const side of PremiereGame.sides){const z=PremiereGame.zones(state,side);z.deck.push(...z.hand.splice(0));}
   const take=id=>{const z=PremiereGame.zones(state,id.split(':')[0]),i=z.deck.findIndex(c=>c.id===id);if(i<0)throw Error('fixture missing '+id);return z.deck.splice(i,1)[0];};
   state.locations=['Light:603','Light:601','Light:600','Light:598','Light:602'].map(take);state.locationOrder=initialLocationOrder(state.locations);state.light=state.locations.map(()=>[]);state.dark=state.locations.map(()=>[]);
   const yoda=take('Light:2865'),luke=take('Light:2304'),pilot=take('Light:2040'),trooper=take('Light:2052');state.light[0].push(yoda,luke,pilot,trooper);
   state.tableEffects=[take('Light:1071'),take('Light:1071')].map((card,i)=>{const mentor=[yoda,luke][i],apprentice=[pilot,trooper][i];apprentice.dagobahApprentice=true;apprentice.dagobahMentorId=mentor.instanceId;return {card,mentor,apprentice,target:apprentice,site:0,dagobah:true};});
   state.hand.push(take('Light:30'));state.deck.push(take('Light:1332'),take('Light:1992'));
   state.activated=true;state.botTurn=null;PremiereGame.setPhase(state,1);state.dagobahTrainingWindow=game.timing.turn;selected=-1;selectedTableCard=null;handAdviceCache=null;render();
  });
  const training=page.locator('#jediTrainingControls');
  if(!await page.locator('#extraActionDialog').evaluate(dialog=>dialog.open))await page.getByRole('button',{name:'Jedi-Ausbildung öffnen',exact:true}).click();
  assert.equal(await page.locator('#board').getByRole('button',{name:/Jedi-Test 1 versuchen/}).count(),0);
  await training.locator('.jedi-training-row').filter({hasText:'Rebel Pilot'}).getByRole('button',{name:'Jedi-Test 1 versuchen',exact:true}).click();
  assert.equal(await page.evaluate(()=>state.pendingCardView?.mode),'destinyValue');
  assert.equal(await page.locator('#extraActionDialog').evaluate(dialog=>dialog.open),true);
  await page.locator('#extraActionDialog').getByRole('button',{name:'Playmat ansehen',exact:true}).click();
  assert.equal(await page.evaluate(()=>state.pendingCardView?.mode),'destinyValue');
  await page.getByRole('button',{name:'Offene Entscheidung',exact:true}).click();
  assert.equal(await page.locator('#extraActionDialog #jediTrainingControls').count(),1);
  await training.getByRole('button',{name:'Destiny 5 wählen',exact:true}).click();
  assert.match(await training.innerText(),/Rebel Pilot · Bestanden ✓[\s\S]*11 \+ Ability 2 = 13/);
  await training.locator('.jedi-training-row').filter({hasText:'Rebel Trooper'}).getByRole('button',{name:'Jedi-Test 1 versuchen',exact:true}).click();
  assert.match(await training.innerText(),/Rebel Trooper · Nicht bestanden[\s\S]*10 \+ Ability 1 = 11/);
  assert.equal(await page.locator('#board').getByRole('button',{name:/Jedi-Test 1 versuchen/}).count(),0);
  await training.screenshot({path:'.hosting-qa-jedi-results.png'});
  await training.getByRole('button',{name:'Jedi-Test 2 auswählen',exact:true}).click();
  assert.match(await page.locator('#playmatSelection').innerText(),/Kontrollphase|Ausspielen|Deploy/i);
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow at '+width);}
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>{
   closeExtraAction();const game=state.game,seen=new Set(),pool=[];
   function collect(value,key){if(key==='starterDecks'||!value||typeof value!=='object'||seen.has(value))return;seen.add(value);if(value.instanceId)pool.push({...structuredClone([...catalog,...aNewHopeCatalog,...hothCatalog,...dagobahCatalog].find(c=>c.id===value.id)),instanceId:value.instanceId,owner:value.owner});for(const [name,item] of Object.entries(value))collect(item,name);}
   collect(state);if(pool.length!==120)throw Error('battle fixture must retain all instances');
   state=PremiereGame.createState(game,pool.filter(c=>c.owner==='Light'),pool.filter(c=>c.owner==='Dark'),[],[],'Light');
   for(const side of PremiereGame.sides){const z=PremiereGame.zones(state,side);z.deck.push(...z.hand.splice(0));}
   const take=id=>{const z=PremiereGame.zones(state,id.split(':')[0]),i=z.deck.findIndex(c=>c.id===id);if(i<0)throw Error('fixture missing '+id);return z.deck.splice(i,1)[0];};
   state.locations=[take('Light:2447')];state.locationOrder=[0];state.light=[[take('Light:2304'),take('Light:1495'),take('Light:1495'),take('Light:2052'),take('Light:2052'),take('Light:2052')]];
   const victim=state.botDeck.filter(c=>c.type==='Character'&&c.ability>0).sort((a,b)=>a.power-b.power)[0];if(!victim)throw Error('bot needs a character');state.botDeck.splice(state.botDeck.indexOf(victim),1);state.dark=[[victim]];
   PremiereGame.moveTop(state.deck,state.force,8);PremiereGame.moveTop(state.botDeck,state.botForce,8);state.activated=true;state.botTurn=null;PremiereGame.setPhase(state,3);el('autoBot').checked=false;el('autoBotDamage').checked=true;selected=-1;selectedTableCard=null;handAdviceCache=null;
   const battle=legalActions(state,'Light').find(o=>o.kind==='battle');if(!battle)throw Error('fixture needs a legal battle');dispatchUI(battle);
   for(let i=0;i<30&&battleSession?.segment!=='damage';i++){const action=PremiereGame.sides.flatMap(side=>legalActions(state,side)).find(o=>['passWeapons','skipDestiny','passResponse'].includes(o.kind));if(!action)throw Error('battle fixture stalled '+JSON.stringify({segment:battleSession?.segment,view:state.pendingCardView?.mode,response:PremiereGame.responseWindow(state.game)?.kind,offers:PremiereGame.sides.flatMap(side=>legalActions(state,side)).map(o=>({kind:o.kind,side:o.side,args:o.args}))}));dispatchUI(action);}
   if(battleSession?.segment!=='damage')throw Error('damage not reached');
   if(battleSession.damage.priority==='Light')dispatchUI(legalActions(state,'Light').find(o=>o.kind==='passDamage'));
  });
  await page.waitForFunction(()=>state.botLost.length>1&&!automaticBotDamageAction());
  assert.equal(await page.locator('#autoBot').isChecked(),false);
  assert.equal(await page.locator('#autoBotDamage').isChecked(),true);
  assert.equal(await page.evaluate(()=>PremiereGame.zones(state,botSide()).lost.length>1),true);
  assert.deepEqual(errors,[]);
 }finally{try{await browser?.close();}finally{server.closeAllConnections();await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}}
});
