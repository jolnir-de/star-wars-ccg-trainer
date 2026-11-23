import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {startLocalV2Server} from './serve-v2-local.mjs';

test('Hand frames, reasons and a separate recommendation follow legal actions for both sides',{timeout:120000},async()=>{
 const server=startLocalV2Server({port:0,reportPath:null});let browser;
 try{
  await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({channel:process.env.SWCCG_CHROMIUM_CHANNEL||'chrome'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const signature=()=>page.evaluate(()=>JSON.stringify({state,battleSession,save:localStorage.getItem(saveKey)}));
  for(const side of ['light','dark']){
   await page.goto(origin+'/v2.html');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
   await page.locator('#launchSides [data-side="'+side+'"]').click();
   await page.locator('#matchSettings summary').click();await page.locator('#gameMode').selectOption(side==='light'?'force':'dark-control');await page.locator('#start').click();
   if(side==='light'){
    assert.equal(await page.locator('#hand .hand-playable').count(),0);
    await page.getByRole('button',{name:'Force aktivieren',exact:true}).click();await page.locator('#step').click();await page.locator('#step').click();
   }else await page.locator('#step').click();
   assert.ok(await page.locator('#hand .hand-playable').count()>0);
   if(side==='light')assert.ok(await page.locator('#hand .hand-blocked').count()>0);
   assert.equal(await page.locator('#hand .hand-recommended').count(),1);
   assert.equal(await page.locator('#botHand .hand-recommended').count(),0);
   assert.equal(await page.locator('#botHand .card-back').count(),8);
   const index=await page.evaluate(()=>handAdviceModel(legalActions(state,playerSide())).recommendation.index),before=await signature();
   await page.locator('#handAdvice button').click();assert.equal(await page.evaluate(()=>selected),index);assert.equal(await signature(),before,'A recommendation only selects the card');
   await page.locator('#inspectHandCard'+index).click();assert.equal(await page.locator('#cardInspector').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await signature(),before);
   if(side==='light'){
    assert.match(await page.locator('#hand .hand-blocked').first().getAttribute('title'),/Phase|Ziel|Force|Icon|Presence/);
    await page.getByRole('button',{name:'Rebel Trooper auswählen',exact:true}).click();await page.locator('#playmatSelection').getByRole('button',{name:/^Ausspielen/}).first().click();
    const luke=page.getByRole('button',{name:/Luke Skywalker auswählen$/});assert.equal(await luke.locator('..').getAttribute('data-playable'),'false');assert.match(await luke.locator('..').getAttribute('title'),/Benötigt 3 Force.*2 Force/);
    await luke.click();assert.match(await page.locator('#handAdvice [role="status"]').innerText(),/Benötigt 3 Force.*2 Force/);
    await page.reload();await page.locator('#resumeGame').click();assert.equal(await page.getByRole('button',{name:/Luke Skywalker auswählen$/}).locator('..').getAttribute('data-playable'),'false');
   }
   for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page overflow at '+width);}
   await page.setViewportSize({width:1440,height:1000});await page.locator('#playerSeat').screenshot({path:'.hosting-qa-hand-advice-'+side+'.png'});
   await page.evaluate(()=>{localStorage.clear();});
  }
  assert.deepEqual(errors,[]);
 }finally{try{await browser?.close();}finally{server.closeAllConnections();await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}}
});
