import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import data from '../../engine/premiere-data.js';
const root=new URL('../../',import.meta.url);
const html=readFileSync(new URL('v2.html',root),'utf8');
const inline=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/load\(\);\s*$/,'');
const scripts=['data','game','battle','units','locations','card-rules','weapons','bot','learning','session']
 .map(name=>readFileSync(new URL('engine/premiere-'+name+'.js',root),'utf8'));
const files=Object.fromEntries(['premiere','premiere-starter-decks','premiere-themed-decks','premiere-supplemental-cards','play-format-decks','a-new-hope','hoth','hoth-decks','dagobah','dagobah-decks','cloud-city','cloud-city-decks','jabbas-palace','jabbas-palace-decks']
 .map(name=>['data/'+name+'.json',JSON.parse(readFileSync(new URL('data/'+name+'.json',root),'utf8'))]));
const cards=[...data.readCatalog(files['data/premiere.json']),...data.readCatalog(files['data/a-new-hope.json'],'2'),...data.readCatalog(files['data/hoth.json'],'3'),...data.readCatalog(files['data/dagobah.json'],'4'),...data.readCatalog(files['data/cloud-city.json'],'5'),...data.readCatalog(files['data/jabbas-palace.json'],'6')];

function definitions(spec){
 const ids=[...spec.setup.matchAll(/['"]((?:Light|Dark):\d+)['"]/g)].map(match=>match[1]);
 const definitions={};
 for(const side of ['Light','Dark']){
  const starting=side==='Light'?'Light:2447':'Dark:673',filler=side==='Light'?'Light:2052':'Dark:2355';
  const counts=new Map([[starting,1]]);
  for(const id of ids.filter(id=>id.startsWith(side+':')))counts.set(id,(counts.get(id)??0)+1);
  for(const [id,n] of Object.entries(spec.copies??{}))if(id.startsWith(side+':'))counts.set(id,Math.max(counts.get(id)??0,n));
  const total=[...counts.values()].reduce((n,v)=>n+v,0);assert.ok(total<60,spec.name+' fixture fits in a deck');
  counts.set(filler,(counts.get(filler)??0)+60-total);
  definitions[side]={cards:[...counts].map(([id,count])=>({id,count})),startingLocations:[starting]};
 }
 const result={schema:1,decks:definitions};
 data.readStarterDecks(result,cards,{format:spec.format??'premiere-a-new-hope',cardRulesVersion:spec.rulesVersion??30});
 return result;
}

export async function savedPosition(spec,value){
 const storage=new Map(),elements=new Map(),timers=new Map();let timer=0;
 const localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
 const document={getElementById(id){if(!elements.has(id))elements.set(id,{value:'',checked:true,style:{},dataset:{},innerHTML:'',textContent:'',open:false,validity:{valid:true},showModal(){this.open=true},close(){this.open=false},focus(){}});return elements.get(id)}};
 const context=vm.createContext({document,console,Math,Number,String,Array,RegExp,Set,structuredClone,Error,localStorage,confirm:()=>true,
  setTimeout(fn){timers.set(++timer,fn);return timer},clearTimeout:id=>timers.delete(id),location:{hostname:''},
  fetch:async path=>files[path]?{ok:true,json:async()=>structuredClone(files[path])}:{ok:false,status:404}});
 const run=code=>vm.runInContext(code,context);
 for(const script of scripts)run(script);
 if(spec.format?.startsWith('premiere-a-new-hope-hoth'))for(const name of ['rules','card-rules','session','interrupts','creatures','mines','timing'])run(readFileSync(new URL('engine/hoth-'+name+'.js',root),'utf8'));
 if(spec.format?.startsWith('premiere-a-new-hope-hoth-dagobah'))for(const name of ['rules','card-rules','session','jedi','space','creatures','units','effects','weapons','locations','interrupts','timing','abilities','passives'])run(readFileSync(new URL('engine/dagobah-'+name+'.js',root),'utf8'));
 if(spec.format?.startsWith('premiere-a-new-hope-hoth-dagobah-cloud-city'))for(const name of ["rules","card-rules","session","space","sabacc","captives","devices","freezing","locations","weather-vane","units","weapons","effects","abilities","reacts","interrupts","battle","duels","storage","timing","layout","support","captive-battle","reactions","answers","information","drains","nabrun","limits","bot"])run(readFileSync(new URL('engine/cloud-city-'+name+'.js',root),'utf8'));
 if(spec.format==='premiere-a-new-hope-hoth-dagobah-cloud-city-jabbas-palace')for(const name of ["rules","card-rules","session","layout","units","abilities","locations","creatures","weapons","devices","effects","sabacc","interrupts","battle","captives","storage","support","reacts","vehicles","timing","combinations","answers","droids","numbers","attacks","personas","choices","mindscan","bot"])run(readFileSync(new URL('engine/jabbas-palace-'+name+'.js',root),'utf8'));
 run(inline);
 if(value){storage.clear();storage.set(run('saveKey'),value)}
 await run('load()');
 if(spec.format?.startsWith('premiere-a-new-hope-hoth')){run('loadHothScript=async()=>{}');await run(spec.format==='premiere-a-new-hope-hoth-dagobah-cloud-city-jabbas-palace'?'ensureJabbasPalaceFormat()':spec.format==='premiere-a-new-hope-hoth-dagobah-cloud-city'?'ensureCloudCityFormat()':spec.format==='premiere-a-new-hope-hoth-dagobah'?'ensureDagobahFormat()':'ensureHothFormat()');}
 // Only the starting position is arranged. No pending window, response, legal-action,
 // save, import, or replay handler is replaced: these are exercised by real commands.
 run(`const qaAllInstances=new Map();const qaFinishSetup=finishSetup;finishSetup=function(){
  const result=qaFinishSetup();if(!result)return result;
  const game=state.game,pool=[...state.locations.filter(Boolean),...PremiereGame.sides.flatMap(side=>{const z=PremiereGame.zones(state,side);return [...z.deck,...z.hand,...z.force,...z.used,...z.lost]})];
  qaAllInstances.clear();for(const card of pool)qaAllInstances.set(card.instanceId,card.id);
  state=PremiereGame.createState(game,pool.filter(c=>c.owner==='Light'),pool.filter(c=>c.owner==='Dark'),[],[],${JSON.stringify(spec.active??'Light')});
  for(const side of PremiereGame.sides){const z=PremiereGame.zones(state,side);z.deck.push(...z.hand.splice(0));}
  const take=id=>{for(const side of PremiereGame.sides)for(const name of ['deck','hand','force','used','lost']){const pile=PremiereGame.zones(state,side)[name],i=pile.findIndex(c=>c.id===id);if(i>=0)return pile.splice(i,1)[0]}throw Error('Fixture missing '+id)};
  const locations=ids=>{state.locations=ids.map(take);state.light=ids.map(()=>[]);state.dark=ids.map(()=>[]);state.locationOrder=initialLocationOrder(state.locations)};
  const put=(side,slot,id)=>{const card=take(id);PremiereGame.zones(state,side).board[slot].push(card);return card};
  const hand=(side,...ids)=>PremiereGame.zones(state,side).hand.push(...ids.map(take));
  const topRequests=[];const top=(side,...ids)=>topRequests.push([side,ids]);
  state.phase=${spec.phase??2};state.activated=true;state.botTurn=null;
  ${spec.setup}
  for(const side of PremiereGame.sides)PremiereGame.moveTop(PremiereGame.zones(state,side).deck,PremiereGame.zones(state,side).force,8);
  for(const [side,ids] of topRequests)PremiereGame.zones(state,side).deck.push(...ids.reverse().map(take));
  return result;
 };
 function qaPrivateView(side){const previous=state.game.playerSide;state.game.playerSide=side;try{const frame=state.pendingCardView,markup=cardInformationMarkup(legalActions(state,side));return frame.shown.length>0&&frame.shown.every(card=>!markup.includes(escapeHTML(card.name)))}finally{state.game.playerSide=previous}}
 function qaInventory(){
  const seen=new Set(),cards=[];function visit(value,key){if(key==='starterDecks'||!value||typeof value!=='object'||seen.has(value))return;seen.add(value);if(value.instanceId)cards.push(value.instanceId);for(const [name,item] of Object.entries(value))visit(item,name)}visit(state);return cards;
 }
 function qaMissingCards(){const present=new Set(qaInventory());return [...qaAllInstances].filter(([instance])=>!present.has(instance)).map(([,id])=>id)}
 function qaSnapshot(){
  const offers=PremiereGame.sides.flatMap(side=>legalActions(state,side).map(({kind,args,cost,label})=>({side,kind,args,cost,label})));
  return JSON.stringify({state,battleSession,offers,views:PremiereGame.sides.map(side=>PremiereGame.playerView(state,side))},(key,value)=>{
   if(['starterDecks','gametext','lore','texts','images','guide','notes','source'].includes(key))return undefined;
   if(key==='id'&&typeof value==='number')return 0;
   return typeof value==='function'?undefined:value;
  });
 }
 function qaAct(kind,side,args,where){const action=legalActions(state,side,args?{kind,args}:undefined).find(action=>action.kind===kind&&(args===undefined||JSON.stringify(action.args)===JSON.stringify(args))&&(!where||where(action)));if(!action)throw Error('No '+kind+' for '+side+' '+JSON.stringify(args)+'; mode '+state.pendingCardView?.mode+'; response '+PremiereGame.responseWindow(state.game)?.kind);return dispatchUI(action)}
 el('autoBot').checked=false;el('autoBotBattle').checked=false;`);
 const definition=definitions(spec),rules=spec.rulesVersion??30;
 if(!value){
  run(`const qaFormat=${JSON.stringify(spec.format??'premiere-a-new-hope')};selectPlayFormat(qaFormat);const qaDefinition=${JSON.stringify(definition)};
   const qaDecks=readStarterDecks(qaDefinition,[...catalog,...aNewHopeCatalog,...(hothCatalog??[]),...(dagobahCatalog??[]),...(cloudCityCatalog??[]),...(jabbasPalaceCatalog??[])],{format:qaFormat,cardRulesVersion:${rules}});
   beginSavedScenario(7001,false,qaDecks,${rules},2,undefined,${JSON.stringify(spec.player??'Light')},undefined,qaFormat);
   activateSave({version:saveVersion,seed:7001,cardRevision:REVISION,expansionRevision:REVISION,cardRulesVersion:${rules},botStrategyVersion:2,playerSide:${JSON.stringify(spec.player??'Light')},trainingBattle:false,decks:qaDefinition,commands:[],playFormat:qaFormat});
   const qaStart=legalActions(null,playerSide()).find(action=>action.kind==='chooseStart');dispatchUI(qaStart);dispatchUI(legalActions(null,playerSide()).find(action=>action.kind==='beginGame'));launchOpen=false;presentGame();`);
 }
 return {run,elements,tick(){const [id,callback]=timers.entries().next().value??[];if(!callback)return false;timers.delete(id);callback();return true},saved:()=>localStorage.getItem(run('saveKey')),snapshot:()=>run('qaSnapshot()'),act(step){
  const {kind,side='Light',args,where}=step;return run(`qaAct(${JSON.stringify(kind)},${JSON.stringify(side)},${JSON.stringify(args)},${where?'action=>('+where+')':'undefined'})`);
 }};
}

export async function checkSavedSteps(spec){
 const first=await savedPosition(spec);const checkpoints=[{value:first.saved(),snapshot:first.snapshot()}];
 for(const step of spec.steps){
  assert.equal(first.act(step),true,spec.name+' '+step.kind);
  if(step.expect)assert.equal(first.run(step.expect),true,spec.name+' '+step.expect);
  if(step.privateFor)assert.equal(first.run('qaPrivateView('+JSON.stringify(step.privateFor)+')'),true,spec.name+' hides the private view');
  const inventory=JSON.parse(first.run('JSON.stringify(qaInventory())'));assert.equal(new Set(inventory).size,inventory.length,spec.name+' has no duplicate instances');const missing=JSON.parse(first.run('JSON.stringify(qaMissingCards())'));const mode=first.run('state.pendingCardView?.mode');assert.ok(missing.every(id=>spec.inFlight?.[id]?.includes(mode)),spec.name+' only declared resolving cards may be outside state: '+missing);assert.equal(inventory.length+missing.length,120);
  checkpoints.push({value:first.saved(),snapshot:first.snapshot()});
 }
 assert.ok(checkpoints.every(c=>c.value),spec.name+' saved after every action');
 for(const [index,checkpoint] of checkpoints.entries()){
  const reload=await savedPosition(spec,checkpoint.value);
  assert.equal(reload.run('resumeGameFromUI()'),true,spec.name+' resumes step '+index);
  assert.equal(reload.snapshot(),checkpoint.snapshot,spec.name+' identical state, RNG, options and both player views at '+index);
  if(index<spec.steps.length){assert.equal(reload.act(spec.steps[index]),true);assert.equal(reload.snapshot(),checkpoints[index+1].snapshot,spec.name+' identical continuation after '+index);}
  const serialized=JSON.stringify(JSON.parse(checkpoint.value));
  assert.equal(reload.run(`replayScenario(parseSavedGame(${JSON.stringify(serialized)}))`),true,spec.name+' JSON scenario import');
  assert.equal(reload.snapshot(),checkpoint.snapshot);
  const broken=JSON.parse(checkpoint.value);broken.commands.push({type:'action',kind:'finishCardInformation',side:'Light',args:['invalid-choice']});
  assert.equal(reload.run(`replayScenario(parseSavedGame(${JSON.stringify(JSON.stringify(broken))}))`),false,spec.name+' rejects invalid continuation');
  assert.equal(reload.snapshot(),checkpoint.snapshot,spec.name+' failed import preserves the current position');
 }
 return first;
}
