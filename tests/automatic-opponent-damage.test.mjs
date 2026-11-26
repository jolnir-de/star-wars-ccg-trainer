import test from 'node:test';
import assert from 'node:assert/strict';
import {savedPosition} from './support/anh-save-harness.mjs';

for(const player of ['Light','Dark'])test('Opponent damage resolves automatically for a '+player+' player, with manual turns and replayable commands',async()=>{
 const enemy=player==='Light'?'Dark':'Light',hero=player==='Light'?'Light:1803':'Dark:634',trooper=player==='Light'?'Light:2052':'Dark:2355',victim=enemy==='Light'?'Light:2052':'Dark:2355';
 const spec={name:'Automatic losses '+player,player,active:player,phase:3,rulesVersion:35,
  setup:`locations(['Light:2447']);put('${player}',0,'${hero}');for(let i=0;i<6;i++)put('${player}',0,'${trooper}');put('${enemy}',0,'${victim}');hand('${enemy}','${victim}');`,copies:{[trooper]:8,[victim]:3}};
 const h=await savedPosition(spec);h.run(`el('autoBot').checked=false;el('autoBotDamage').checked=true;`);h.act({kind:'battle',side:player,args:[0]});
 for(let i=0;i<30&&h.run(`battleSession?.segment!=='damage'`);i++){
  const next=JSON.parse(h.run(`JSON.stringify(PremiereGame.sides.flatMap(side=>legalActions(state,side)).find(o=>['passWeapons','skipDestiny','passResponse'].includes(o.kind)))`));
  assert.ok(next,'battle must reach damage through normal decisions');h.act(next);
 }
 assert.equal(h.run(`battleSession?.segment`),'damage');
 assert.equal(h.run(`!!automaticBotDamageAction()`),true);
 const before=h.run(`PremiereGame.zones(state,botSide()).lost.length`);
 for(let i=0;i<200&&h.run(`!!automaticBotDamageAction()`);i++)assert.equal(h.tick(),true,'an automatic loss action has a scheduled timer');
 assert.equal(h.run(`!!automaticBotDamageAction()`),false);
 assert.equal(h.run(`!battleSession||battleSession.damage.debt[botSide()].damage===0`),true,'remaining bot damage is fully paid');
 assert.ok(h.run(`PremiereGame.zones(state,botSide()).lost.length`)>before+1,'all bot losses continue through alternating empty player passes');
 assert.equal(h.run(`PremiereGame.zones(state,playerSide()).lost.length`),0,'no player losses are chosen automatically');
 assert.equal(h.run(`el('autoBot').checked`),false,'the general manual-turn preference is unchanged');
 const reload=await savedPosition(spec,h.saved());assert.equal(reload.run('resumeGameFromUI()'),true);assert.equal(reload.snapshot(),h.snapshot());
});

test('The automatic regulator stops when the player must choose real losses',async()=>{
 const h=await savedPosition({name:'Player losses stay manual',phase:3,rulesVersion:35,copies:{'Dark:2355':8},
  setup:`locations(['Light:2447']);put('Light',0,'Light:2052');put('Dark',0,'Dark:634');for(let i=0;i<6;i++)put('Dark',0,'Dark:2355');`});
 h.run(`el('autoBot').checked=false;el('autoBotDamage').checked=true;`);h.act({kind:'battle',args:[0]});
 for(let i=0;i<30&&h.run(`battleSession?.segment!=='damage'`);i++)h.act(JSON.parse(h.run(`JSON.stringify(PremiereGame.sides.flatMap(side=>legalActions(state,side)).find(o=>['passWeapons','skipDestiny','passResponse'].includes(o.kind)))`)));
 for(let i=0;i<20&&h.run(`!!automaticBotDamageAction()`);i++)assert.equal(h.tick(),true);
 assert.equal(h.run(`battleSession.damage.priority`),'Light');
 assert.ok(h.run(`battleSession.damage.debt.Light.damage`)>0);
 assert.equal(h.run(`automaticBotDamageAction()`),null);
 assert.equal(h.run(`state.lost.length`),0);
 assert.ok(h.run(`legalActions(state,'Light').some(o=>o.kind==='battleForfeit'||o.kind==='battleForceLoss')`));
});
