import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {startLocalV2Server} from './serve-v2-local.mjs';

test('three live table views preserve a match, preview payment and survive resume', {timeout:120000},async()=>{
 const server=startLocalV2Server({port:0,reportPath:null});let browser;
 try{
  await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({channel:process.env.SWCCG_CHROMIUM_CHANNEL||'chrome'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(7000);
  page.setDefaultNavigationTimeout(30000);
  const errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>requests.push(request.url()));
  await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await page.goto(origin+'/v2.html');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
  await page.locator('#launchSides [data-side="light"]').click();
  await page.locator('#matchSettings summary').click();await page.locator('#gameMode').selectOption('force');
  await page.getByRole('button',{name:'Übung starten',exact:true}).click();
  const choice=page.getByLabel('Spielfeldansicht',{exact:true});
  const snapshot=()=>page.evaluate(()=>JSON.stringify({revision:currentGame().revision,random:currentGame().randomState,
   phase:state.phase,hand:state.hand,force:state.force,board:state.light,commands:activeSave?.commands,save:localStorage.getItem(saveKey)}));
  const before=await snapshot(),requestCount=requests.length;
  for(const mode of ['command','table','classic','command']){
   await choice.selectOption(mode);assert.equal(await snapshot(),before,'Layout must not mutate the game');
   assert.equal(await page.locator('#gameTable').getAttribute('data-view'),mode);
   assert.equal(await page.locator('#step').count(),1);assert.equal(await page.locator('#forceControls').count(),1);
   assert.equal(await page.locator('#turnGuide').isVisible(),mode!=='classic');
  }
  assert.ok(!requests.slice(requestCount).some(url=>/data\//.test(url)),'View switching must not load catalogs');
  await page.getByRole('button',{name:'Force aktivieren',exact:true}).click();
  await page.locator('#step').click();await page.locator('#step').click();
  await page.getByRole('button',{name:/Luke Skywalker auswählen$/}).click();
  const unpaid=await snapshot();
  await page.locator('#playmatSelection').getByRole('button',{name:/^Ausspielen/}).first().click();
  assert.equal(await snapshot(),unpaid,'Preview must not spend Force or change the save');
  assert.match(await page.locator('#tableActionPreview').textContent(),/3 → 0/);
  await page.locator('#tableActionPreview').getByRole('button',{name:'Abbrechen',exact:true}).click();
  assert.equal(await snapshot(),unpaid);
  await page.locator('#playmatSelection').getByRole('button',{name:/^Ausspielen/}).first().click();
  await choice.selectOption('table');assert.equal(await snapshot(),unpaid);
  assert.equal(await page.locator('#guideConfirm').isVisible(),false,'Switching clears unconfirmed actions');
  await page.locator('#playmatSelection').getByRole('button',{name:/^Ausspielen/}).first().click();
  await page.locator('#guideConfirm').click();
  assert.equal(await page.evaluate(()=>state.force.length),0);
  assert.equal(await page.evaluate(()=>state.light.flat().filter(c=>c.id==='Light:1593').length),1);
  assert.equal(await page.locator('#guideConfirm').isVisible(),false);
  const paid=await snapshot();
  await page.reload();await page.locator('#resumeGame').click();
  assert.equal(await choice.inputValue(),'table');assert.equal(await snapshot(),paid);
  assert.equal(await page.locator('#botHand .card-back').count(),8,'Hidden opponent hand remains concealed');
  for(const width of [1440,768,390,320]){
   await page.setViewportSize({width,height:950});
   for(const mode of ['classic','command','table']){
    await choice.selectOption(mode);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow at '+width+' '+mode);
   }
  }
  await page.setViewportSize({width:1440,height:1000});await choice.selectOption('command');
  await page.locator('#gameTable').screenshot({path:'.hosting-qa-view-command.png'});
  await choice.selectOption('table');await page.locator('#gameTable').screenshot({path:'.hosting-qa-view-table.png'});
  await page.locator('#configureGame').click();
  if(!await page.locator('#matchSettings').evaluate(node=>node.open))await page.locator('#matchSettings summary').click();
  await page.locator('#gameMode').selectOption('movement');
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Übung starten',exact:true}).click();
  const move=await page.evaluate(()=>legalActions(state,playerSide()).find(option=>option.kind==='move'));
  assert.ok(move);const moveBefore=await snapshot();
  await page.evaluate(action=>previewTableAction(action),move);assert.equal(await snapshot(),moveBefore);
  await page.locator('#tableActionPreview').getByRole('button',{name:'Bewegung ausführen',exact:true}).click();
  assert.notEqual(await snapshot(),moveBefore);assert.equal(await page.locator('#guideConfirm').isVisible(),false);
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
