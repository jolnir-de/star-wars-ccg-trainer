import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {chromium} from 'playwright-core';
import {buildWeb} from './build-web.mjs';
import {startLocalV2Server} from './serve-v2-local.mjs';
import {savedPosition} from '../tests/support/v3-save-harness.mjs';

const format='premiere-a-new-hope-hoth-dagobah-cloud-city';
const scenario=side=>({name:'browser drain '+side,format,phase:1,player:side,active:side,setup:side==='Light'
 ?`locations(['Light:438']);const host=put('Light',0,'Light:1803');host.weapons=[take('Light:1813')];hand('Dark','Dark:520');`
 :`locations(['Light:2471']);const host=put('Dark',0,'Dark:634');host.weapons=[take('Dark:2702')];hand('Light','Light:521');`});
// The fixture only arranges the initial 120 real instances. Every subsequent
// action, response, save and reload uses the unmodified game handlers.
async function installFixture(page,spec){await page.evaluate(spec=>{
 const previous=finishSetup;finishSetup=function(){const result=previous();if(!result)return result;
 const game=state.game,pool=[...state.locations.filter(Boolean),...PremiereGame.sides.flatMap(side=>{const z=PremiereGame.zones(state,side);return [...z.deck,...z.hand,...z.force,...z.used,...z.lost];})];
 if(pool.length!==120)throw Error('Expected 120 real instances');state=PremiereGame.createState(game,pool.filter(c=>c.owner==='Light'),pool.filter(c=>c.owner==='Dark'),[],[],spec.active);
 for(const side of PremiereGame.sides){const z=PremiereGame.zones(state,side);z.deck.push(...z.hand.splice(0));}
 const take=id=>{for(const side of PremiereGame.sides)for(const name of ['deck','hand','force','used','lost']){const pile=PremiereGame.zones(state,side)[name],i=pile.findIndex(c=>c.id===id);if(i>=0)return pile.splice(i,1)[0];}throw Error('Missing '+id);};
 const locations=ids=>{state.locations=ids.map(take);state.light=ids.map(()=>[]);state.dark=ids.map(()=>[]);state.locationOrder=initialLocationOrder(state.locations);};
 const put=(side,slot,id)=>{const card=take(id);PremiereGame.zones(state,side).board[slot].push(card);return card;};
 const hand=(side,...ids)=>PremiereGame.zones(state,side).hand.push(...ids.map(take));
 state.phase=spec.phase;state.activated=true;state.botTurn=null;eval(spec.setup);
 for(const side of PremiereGame.sides)PremiereGame.moveTop(PremiereGame.zones(state,side).deck,PremiereGame.zones(state,side).force,8);return result;
 };el('autoBot').checked=false;el('autoBotBattle').checked=false;
},spec);}

test('V3 explains drains, links sources, resumes answers and retains actual results in the published package',{timeout:180000},async()=>{
 const output=await mkdtemp(join(tmpdir(),'swccg-v3-drain-browser-'));let browser,server;
 try{
  await buildWeb(output);server=startLocalV2Server({port:0,siteRoot:output,reportPath:null});await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({channel:process.env.SWCCG_CHROMIUM_CHANNEL||'chrome'});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const ready=async()=>{await page.goto(origin+'/v3.html');await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.evaluate(()=>ensureCloudCityFormat());};
  for(const side of ['Light','Dark']){
   const spec=scenario(side),h=await savedPosition(spec),initial=h.saved();await ready();await installFixture(page,spec);await page.evaluate(value=>importScenario(value),initial);
   assert.equal(await page.evaluate(()=>state.activeSide),side);
   await page.locator('#playmatLocation0').getByRole('button',{name:'Drain-Berechnung',exact:true}).click();
   const dialog=page.locator('#drainCalculationDialog');assert.equal(await dialog.evaluate(d=>d.open),true);assert.match(await dialog.innerText(),/Grundwert.*Boni.*Abzüge/s);assert.match(await dialog.innerText(),/Ausführungskosten: 0 Force/);
   await dialog.getByRole('button',{name:side==='Light'?"•Cloud City: Carbonite Chamber":"•Tatooine: Obi-Wan's Hut",exact:true}).first().click();assert.equal(await page.locator('#cardInspector').evaluate(d=>d.open),true);await page.locator('#cardInspector').getByRole('button',{name:'Schließen',exact:true}).click();
   for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});assert.ok(await dialog.evaluate(d=>d.getBoundingClientRect().width<=innerWidth),'dialog fits '+width);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
   await page.setViewportSize({width:1440,height:1000});await dialog.screenshot({path:'.hosting-qa-v3-drain-'+side.toLowerCase()+'.png'});
   await dialog.locator('[data-drain-bonus="1"]').click();assert.equal(await page.evaluate(()=>state.drainExplanations.at(-1).announced.bonus),1);
   const before=await page.evaluate(()=>JSON.stringify(state.drainExplanations));await page.reload();await page.waitForFunction(()=>!document.querySelector('#start').disabled);await installFixture(page,spec);await page.getByRole('button',{name:'Partie fortsetzen',exact:true}).click();await page.waitForFunction(()=>!!state&&!launchOpen);
   assert.equal(await page.evaluate(()=>JSON.stringify(state.drainExplanations)),before);
   assert.match(await page.locator('#extraActionDialog').innerText(),/Force Drain nachvollziehen/);
   await page.evaluate(()=>{for(let n=0;n<6&&PremiereGame.responseWindow(state.game);n++){const w=PremiereGame.responseWindow(state.game),pass=legalActions(state,w.priority).find(a=>a.kind==='passResponse');if(!pass||!dispatchUI(pass))throw Error('Cannot pass response');}});
   assert.equal(await page.evaluate(()=>state.drainExplanations.at(-1).status),'complete');
   await page.locator('#playmatLocation0').getByRole('button',{name:'Drain-Ergebnis ansehen',exact:true}).click();assert.match(await dialog.innerText(),/Tatsächlicher Force-Verlust/);assert.match(await dialog.innerText(),/Karten verloren · abgeschlossen/);assert.match(await page.locator('#log').innerText(),/Drain-Berechnung: Grundwert/);
  }
  assert.deepEqual(errors,[]);
 }finally{try{await browser?.close();}finally{if(server){server.closeAllConnections();await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}const target=resolve(output);if(!target.startsWith(resolve(tmpdir())+sep)||!target.includes('swccg-v3-drain-browser-'))throw Error('Unexpected temporary directory');await rm(target,{recursive:true});}}
});
