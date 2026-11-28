import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {chromium} from 'playwright-core';
import {buildWeb} from './build-web.mjs';
import {startLocalV2Server} from './serve-v2-local.mjs';

test('Parallel V2/V3 games retain isolated saves, preferences, data, imports and all six formats',{timeout:240000},async()=>{
 const output=await mkdtemp(join(tmpdir(),'swccg-v3-browser-'));let server,browser;
 try{
  await buildWeb(output);server=startLocalV2Server({port:0,siteRoot:output,reportPath:null});await once(server,'listening');
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({channel:process.env.SWCCG_CHROMIUM_CHANNEL||'chrome'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
  page.on('dialog',dialog=>dialog.accept());
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
  await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const ready=async path=>{await page.goto(origin+path);await page.waitForFunction(()=>!document.querySelector('#start').disabled);};
  const stateOf=target=>target.evaluate(()=>({seed:currentGame().seed,side:playerSide(),format:currentGame().playFormat,phase:state.phase,active:state.activeSide,
   hand:PremiereGame.zones(state,playerSide()).hand.map(card=>card.id),force:PremiereGame.zones(state,playerSide()).force.length,saved:localStorage.getItem(saveKey)}));
  const start=async(path,side='Dark',format='premiere')=>{
   await ready(path);await page.locator('#launchSides [data-side="'+side.toLowerCase()+'"]').click();
   await page.locator('[data-deck-format="'+format+'"] [data-deck]').first().click();await page.waitForFunction(()=>!document.querySelector('#start').disabled);
   await page.locator('#start').click();await page.evaluate(()=>{
    for(let n=0;n<30;n++){
     const choice=legalActions(null,playerSide()).find(action=>action.kind==='chooseStart');if(!choice||!dispatchUI(choice))throw Error('start choice missing '+JSON.stringify({setup:!!setupDecks,offers:legalActions(null,playerSide()).map(a=>a.kind)}));
     if(!setupDecks.revealed.collision)break;
     if(!dispatchUI(legalActions(null,playerSide()).find(action=>action.kind==='retrySetup')))throw Error('retry missing');
    }
    if(!dispatchUI(legalActions(null,playerSide()).find(action=>action.kind==='beginGame')))throw Error('begin missing');
   });
  };
  const activate=async target=>target.evaluate(()=>{const offers=legalActions(state,playerSide()),action=offers.filter(a=>a.kind==='activate').at(-1)??offers.find(a=>a.kind==='advance');if(!action||!dispatchUI(action))throw Error('first action missing '+JSON.stringify({phase:state.phase,active:state.activeSide,offers:offers.map(a=>({kind:a.kind,args:a.args}))}));});
  const resume=async()=>{await page.getByRole('button',{name:'Partie fortsetzen',exact:true}).click();await page.waitForFunction(()=>!!state&&!launchOpen);};

  await page.goto(origin+'/');assert.ok(await page.getByRole('link',{name:'V2 spielen oder fortsetzen →',exact:true}).isVisible());
  assert.ok(await page.getByRole('link',{name:'V3 ausprobieren →',exact:true}).isVisible());
  await page.locator('section[aria-labelledby="versionen"]').screenshot({path:'.hosting-qa-v3-version-choice.png'});
  assert.equal(requests.some(url=>/\/(v3\/)?(?:engine|data)\//.test(new URL(url).pathname)),false,'home loads neither game');
  requests.length=0;await start('/v2.html');await activate(page);let v2=await stateOf(page);
  assert.equal(requests.some(url=>new URL(url).pathname.startsWith('/v3/')),false,'V2 does not download V3');
  assert.equal(JSON.parse(v2.saved).version,1);
  requests.length=0;await start('/v3.html');await activate(page);const v3=await stateOf(page);
  assert.equal(JSON.parse(v3.saved).version,3);assert.equal(await page.evaluate(()=>localStorage.getItem('swccg.v2.autosave')),v2.saved);
  assert.equal(requests.some(url=>/^\/(?:engine|data)\//.test(new URL(url).pathname)),false,'V3 uses its own game modules and catalogs');
  assert.equal(requests.some(url=>/^\/v3\/(?:engine|data)\/.*(?:hoth|dagobah|cloud-city|jabbas-palace|collector-)/.test(new URL(url).pathname)),false,'later-edition game data remain lazy; visible cover art is allowed');
  assert.match(await page.locator('.variant-notice').innerText(),/Entwicklungsversion/);
  await page.locator('.variant-notice').screenshot({path:'.hosting-qa-v3-preview-notice.png'});
  await page.locator('#tableViewChoice').selectOption('table');
  assert.equal(await page.evaluate(()=>importScenario(localStorage.getItem('swccg.v2.autosave'))),false,'V3 rejects a V2 import');
  assert.deepEqual(await stateOf(page),v3,'wrong-version import preserves active V3');
  // Two independent windows in one browser tab. This tests live storage and
  // actions without opening additional tabs or touching a user's browser profile.
  await page.evaluate(()=>{const frame=document.createElement('iframe');frame.name='parallelV2';frame.id='parallelV2';frame.src='v2.html';frame.style='width:100%;height:600px';document.body.append(frame);});
  await page.locator('#parallelV2').contentFrame().locator('#resumeGame').waitFor({state:'visible'});
  const frame=page.frame({name:'parallelV2'});await frame.evaluate(()=>{if(!resumeGameFromUI())throw Error('parallel V2 resume failed');});
  assert.deepEqual(await stateOf(frame),v2);
  await frame.locator('#tableViewChoice').selectOption('command');
  await frame.evaluate(()=>{if(!dispatchUI(legalActions(state,playerSide()).find(a=>a.kind==='advance')))throw Error('parallel V2 advance failed');});
  const oldPhase=v2.phase;v2=await stateOf(frame);assert.notEqual(v2.phase,oldPhase);assert.deepEqual(await stateOf(page),v3,'V2 action leaves live V3 unchanged');
  assert.equal(await page.locator('#tableViewChoice').inputValue(),'table');
  assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('swccg.v2.tableView'),localStorage.getItem('swccg.v3.tableView')]),['command','table']);
  await page.locator('#parallelV2').evaluate(node=>node.remove());
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#start').disabled);await resume();assert.deepEqual(await stateOf(page),v3);
  await ready('/v2.html');await resume();assert.deepEqual(await stateOf(page),v2);
  assert.equal(await page.evaluate(()=>importScenario(localStorage.getItem('swccg.v3.autosave'))),false,'V2 rejects a V3 import');assert.deepEqual(await stateOf(page),v2);

  const formats=['premiere','premiere-a-new-hope','premiere-a-new-hope-hoth','premiere-a-new-hope-hoth-dagobah','premiere-a-new-hope-hoth-dagobah-cloud-city','premiere-a-new-hope-hoth-dagobah-cloud-city-jabbas-palace'];
  for(const format of formats)for(const side of ['Light','Dark']){
   await start('/v3.html',side,format);const expected=await stateOf(page);assert.equal(expected.format,format);assert.equal(expected.side,side);
   await page.reload();await page.waitForFunction(()=>!document.querySelector('#start').disabled);await resume();assert.deepEqual(await stateOf(page),expected);
   assert.equal(await page.evaluate(()=>localStorage.getItem('swccg.v2.autosave')),v2.saved,'all V3 formats preserve V2');
  }
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no V3 page overflow at '+width);}
  assert.deepEqual(errors,[]);
 }finally{
  try{await browser?.close();}finally{if(server){server.closeAllConnections();await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
   const target=resolve(output);if(!target.startsWith(resolve(tmpdir())+sep)||!target.includes('swccg-v3-browser-'))throw Error('Unexpected temporary directory');await rm(target,{recursive:true});}
 }
});
