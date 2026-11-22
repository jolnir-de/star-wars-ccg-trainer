import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {harness} from './support/jabbas-palace-harness.mjs';
const json=name=>JSON.parse(readFileSync(new URL('../data/'+name+'.json',import.meta.url),'utf8'));
const deckSources={starters:json('premiere-starter-decks'),themes:json('premiere-themed-decks'),variants:json('jabbas-palace-decks')};
for(let index=0;index<8;index++)test('Jabba’s Palace complete match keeps 120 cards and ends: themed pair '+(index+1),{timeout:180000},()=>{
 const fixture=harness();fixture.set('qaSources',deckSources);fixture.set('qaIndex',index);
 const result=fixture.run(`
 const qaFormat='premiere-a-new-hope-hoth-dagobah-cloud-city-jabbas-palace',qaChoices=PremiereData.readFormatDeckChoices(qaFormat,qaSources.starters,qaSources.themes,qaSources.variants,catalog);
 const qaDecks={light:qaChoices.light[qaIndex+1].deck,dark:qaChoices.dark[(qaIndex+3)%8+1].deck},qaPlayer=qaIndex%2?'Dark':'Light';
 start(913+qaIndex,true,false,qaDecks,34,3,qaPlayer,'balanced',qaFormat);
 const qaChooseStart=()=>{const offered=legalActions(null,playerSide()).find(action=>action.kind==='chooseStart');if(!offered||!performAction(offered))throw Error('Jabba’s Palace setup missing');};
 qaChooseStart();for(let i=0;setupDecks.revealed.collision;i++){if(i>30)throw Error('setup loop');requestAction('retrySetup',playerSide());qaChooseStart();}
 if(!requestAction('beginGame',playerSide()))throw Error('Jabba’s Palace setup rejected');
 function qaInventory(){const seen=new Set(),ids=[];function walk(value,key){if(!value||typeof value!=='object'||seen.has(value)||key==='starterDecks')return;seen.add(value);if(value.instanceId)ids.push(value.instanceId);for(const [name,child] of Object.entries(value))walk(child,name);}walk(state);return ids;}
 const qaInitial=new Map();{const seen=new Set();function visit(o){if(!o||typeof o!=='object'||seen.has(o))return;seen.add(o);if(o.instanceId)qaInitial.set(o.instanceId,o.id);for(const [k,v]of Object.entries(o))if(k!=='starterDecks')visit(v);}visit(state);}
 const qaRecent=[];let qaSteps=0,qaBattles=0,qaCloudCity=0;
 for(;qaSteps<1800&&!state.gameWinner;qaSteps++){
  const inventory=qaInventory();if(inventory.length!==120||new Set(inventory).size!==120)throw Error('Jabba’s Palace card balance '+qaIndex+'/'+qaSteps+': '+inventory.length+' missing '+JSON.stringify([...qaInitial].filter(([id])=>!inventory.includes(id)))+' recent '+JSON.stringify(qaRecent)+' pending '+state.pendingCardView?.mode+' window '+PremiereGame.responseWindow(state.game)?.kind);
  const player=playerSide(),bot=botSide(),own=legalActions(state,player),rival=legalActions(state,bot);
  const forced=!!(PremiereGame.responseWindow(state.game)||state.pendingCardView||state.pendingForceLoss||state.pendingReserveSearch||state.game.timing.pending||state.automatedPending||state.pendingCustody?.length||battleSession);
  if(!forced&&state.botTurn){if(!botNextStep())throw Error('Jabba’s Palace bot stalled '+qaIndex+'/'+qaSteps);continue;}
  const actor=own.length?player:bot,offers=own.length?own:rival;
  const previous=state.game.playerSide;state.game.playerSide=PremiereGame.otherSide(actor);
  let choice;
  try{choice=forced?botPromptAction(offers):choosePlannedBotAction(offers);}finally{state.game.playerSide=previous;}
  choice??=offers.find(action=>action.kind==='advance')??offers.find(action=>action.kind==='activate')??offers[0];
  qaRecent.push([choice?.kind,choice?.card?.id,choice?.mode,choice?.args]);if(qaRecent.length>6)qaRecent.shift();
  if(!choice||!performAction(choice))throw Error('Jabba’s Palace stalled '+qaIndex+'/'+qaSteps+' '+state.phase+' '+actor+' '+state.pendingCardView?.mode+' '+offers.map(o=>o.kind+':'+o.args.join(',')).join('|'));
  if(choice.kind==='battle')qaBattles++;if(choice.kind==='hothAction')qaCloudCity++;
 }
 const inventory=qaInventory();JSON.stringify({winner:state.gameWinner,steps:qaSteps,cards:inventory.length,unique:new Set(inventory).size,battles:qaBattles,hoth:qaCloudCity,turn:state.turn});
 `,150000);
 const match=JSON.parse(result);assert.equal(match.cards,120);assert.equal(match.unique,120);assert.ok(match.winner,'match must end, '+result);assert.ok(match.steps<1800);
});
