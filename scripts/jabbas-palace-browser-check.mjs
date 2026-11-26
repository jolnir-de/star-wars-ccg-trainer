import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {startLocalV2Server} from './serve-v2-local.mjs';

test('Jabba’s Palace loads on demand, offers eight decks per side, and resumes both sides with the correct format',{timeout:180000},async()=>{
 const server=startLocalV2Server({port:0,reportPath:null});let browser;
 try{
  await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({channel:process.env.SWCCG_CHROMIUM_CHANNEL||'chrome'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
  await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await page.goto(origin+'/v2.html');await page.waitForFunction(()=>!document.querySelector('#start').disabled);
  assert.equal(requests.some(url=>/jabbas-palace(?:-|\.)/.test(url)),false,'No Jabba’s Palace game assets at initial startup');
  for(const side of ['light','dark']){
   await page.evaluate(()=>{localStorage.clear();});await page.reload();await page.waitForFunction(()=>!document.querySelector('#start').disabled);
   await page.locator('#launchSides [data-side="'+side+'"]').click();
   const tiles=page.locator('[data-deck-format="premiere-a-new-hope-hoth-dagobah-cloud-city-jabbas-palace"] [data-deck]');await tiles.first().waitFor();assert.equal(await tiles.count(),8);
   for(const format of ['premiere','premiere-a-new-hope','premiere-a-new-hope-hoth','premiere-a-new-hope-hoth-dagobah-cloud-city-jabbas-palace'])assert.equal(await page.locator('[data-deck-format="'+format+'"] [data-deck]').count(),8);
   assert.equal(await page.getByRole('button',{name:'Jabba’s Palace-Decks laden',exact:true}).count(),0);
   assert.equal(await page.evaluate(()=>!!jabbasPalaceCatalog||!!hothCatalog),false,'Showing all decks loads no expansion card catalog');
   const before=await page.evaluate(()=>({format:launchFormat(),deck:deckSelector(launchFaction).value}));
   assert.ok(await tiles.first().locator('img[data-launch-src]').count(),'Offscreen covers wait for scrolling');
   if(side==='light'){
    await page.route('**/data/jabbas-palace.json',route=>route.abort(),{times:1});
    await page.locator('[data-deck-format="premiere-a-new-hope-hoth-dagobah-cloud-city-jabbas-palace"] .launch-deck-guide').first().click();
    await page.waitForFunction(()=>document.querySelector('#playFormatHint').textContent.includes('Bitte erneut'));
    assert.deepEqual(await page.evaluate(()=>({format:launchFormat(),deck:deckSelector(launchFaction).value})),before,'Failed preview retains the selected deck');
   }else{
    await tiles.first().click();
    await page.waitForFunction(()=>launchFormat()==='premiere-a-new-hope-hoth-dagobah-cloud-city-jabbas-palace');
    await page.waitForFunction(()=>!document.querySelector('#start').disabled);
   }
   await page.locator('[data-deck-format="premiere-a-new-hope-hoth-dagobah-cloud-city-jabbas-palace"] .launch-deck-guide').first().click();
   await page.locator('#starterDeckDialog').waitFor({state:'visible'});
   assert.match(await page.locator('#starterDeckTitle').innerText(),/Die Palastbotschafter|Jabbas Verbrecherhof/);
   await page.locator('#starterDeckCards .deck-card-link').first().click();assert.equal(await page.locator('#cardInspector').isVisible(),true);
   await page.evaluate(()=>{for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();});
   await tiles.first().click();await page.locator('#start').click();
   await page.waitForFunction(()=>!!setupDecks&&!state);
   await page.evaluate(()=>{let tries=0;do{const offer=legalActions(null,playerSide()).find(action=>action.kind==='chooseStart');if(!offer||!dispatchUI(offer))throw Error('Missing start choice');if(!setupDecks.revealed.collision)break;if(++tries>30)throw Error('Repeated start collision');dispatchUI(legalActions(null,playerSide()).find(action=>action.kind==='retrySetup'));}while(true);if(!dispatchUI(legalActions(null,playerSide()).find(action=>action.kind==='beginGame')))throw Error('Start rejected');saveActiveGame();render();});
   const expected=await page.evaluate(()=>({format:state.game.playFormat,side:state.game.playerSide,light:state.game.starterDecks.light?.theme?.id??state.game.starterDecks.Light?.theme?.id}));
   assert.equal(expected.format,'premiere-a-new-hope-hoth-dagobah-cloud-city-jabbas-palace');assert.equal(expected.side,side==='light'?'Light':'Dark');
   await page.reload();await page.waitForFunction(()=>!document.querySelector('#start').disabled);
   const resumed=await page.evaluate(async()=>{await resumeGameFromUI();return {format:state.game.playFormat,side:state.game.playerSide};});
   assert.equal(resumed.format,expected.format);assert.equal(resumed.side,expected.side);
   await page.evaluate(()=>{const z=PremiereGame.zones(state,playerSide());if(!z.force.length)z.force.push(z.deck.pop());spendForce(playerSide(),1);z.used.at(-1).dagobahFaceUp=true;render();});
   if(await page.locator('#extraActionDialog').evaluate(dialog=>dialog.open)){
    const revision=await page.evaluate(()=>currentGame().revision);
    await page.locator('#extraActionDialog').getByRole('button',{name:'Playmat ansehen',exact:true}).click();
    assert.equal(await page.evaluate(()=>currentGame().revision),revision,'viewing the playmat does not resolve the pending decision');
   }
   await page.locator('#pilesPlayer .pile-face-up').click();
   assert.match(await page.locator('#cardInspector').innerText(),/Offenliegende oberste Karte/);
   await page.evaluate(()=>{recirculate(playerSide());render();});
   assert.equal(await page.locator('#cardInspector').isVisible(),false,'Recirculation closes the exposed Used-Pile card');
  }
  assert.deepEqual(errors,[]);
 }finally{try{await browser?.close();}finally{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}}
});
