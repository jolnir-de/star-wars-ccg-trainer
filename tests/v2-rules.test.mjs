import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../v2.html',import.meta.url),'utf8');
const cardDataScript=readFileSync(new URL('../engine/premiere-data.js',import.meta.url),'utf8');
const gameScript=readFileSync(new URL('../engine/premiere-game.js',import.meta.url),'utf8');
const battleScript=readFileSync(new URL('../engine/premiere-battle.js',import.meta.url),'utf8');
const unitScript=readFileSync(new URL('../engine/premiere-units.js',import.meta.url),'utf8');
const weaponScript=readFileSync(new URL('../engine/premiere-weapons.js',import.meta.url),'utf8');
const locationScript=readFileSync(new URL('../engine/premiere-locations.js',import.meta.url),'utf8');
const cardRulesScript=readFileSync(new URL('../engine/premiere-card-rules.js',import.meta.url),'utf8');
const sessionScript=readFileSync(new URL('../engine/premiere-session.js',import.meta.url),'utf8');
const botScript=readFileSync(new URL('../engine/premiere-bot.js',import.meta.url),'utf8');
const learningScript=readFileSync(new URL('../engine/premiere-learning.js',import.meta.url),'utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if(!js)throw Error('V2 script missing');
function harness({storage={getItem:()=>null,setItem:()=>{}},confirmNewGame=()=>true}={}){
 const elements=new Map();
 const timers=new Map();
 let timerId=0;
 const document={getElementById(id){
  if(!elements.has(id))elements.set(id,{
   value:'',checked:true,style:{},dataset:{},innerHTML:'',textContent:'',open:false,validity:{valid:true},
   showModal(){this.open=true;},close(){this.open=false;},focus(){},
  });
  return elements.get(id);
 }};
 const context=vm.createContext({document,console,Math,Number,String,Array,RegExp,Set,structuredClone,fetch:async()=>({ok:false}),Error,
  localStorage:storage,confirm:confirmNewGame,setTimeout(callback){timers.set(++timerId,callback);return timerId;},
  clearTimeout:id=>timers.delete(id)});
 vm.runInContext(cardDataScript,context);
 vm.runInContext(gameScript,context);
 vm.runInContext(battleScript,context);
 vm.runInContext(unitScript,context);
 vm.runInContext(locationScript,context);
 vm.runInContext(cardRulesScript,context);
 vm.runInContext(weaponScript,context);
 vm.runInContext(botScript,context);
 vm.runInContext(learningScript,context);
 vm.runInContext(sessionScript,context);
 vm.runInContext(js.replace(/load\(\);\s*$/,''),context);
 const run=code=>vm.runInContext(code,context);
 return {run,elements,tick(){
  const [id,callback]=timers.entries().next().value??[];
  if(!callback)return false;
  timers.delete(id);callback();return true;
 }};
}
test('deployment rejects characters at systems and insufficient force',()=>{
 const {run}=harness();
 run("state={locations:[{name:'Tatooine',type:'Location',subType:'System'}],force:[],light:[[]],dark:[[]]};");
 assert.equal(run("checkDeployment({name:'Luke',type:'Character',deploy:1},state.locations[0])"),false);
});
test('deployment accepts an affordable character at a site',()=>{
 const {run}=harness();
 run("state={locations:[{name:'Tatooine: Mos Eisley',type:'Location',subType:'Site',icons:{light:1,dark:0}}],force:[{}],light:[[]],dark:[[]]};");
 assert.equal(run("checkDeployment({name:'Rebel',type:'Character',deploy:1},state.locations[0])"),true);
});
test('site neighborhoods follow related table rows instead of storage slots',()=>{
 const {run}=harness();
 run(`state={locations:[
  {name:'Tatooine: A',type:'Location',subType:'Site'}, {name:'Hoth: B',type:'Location',subType:'Site'},
  {name:'Tatooine: C',type:'Location',subType:'Site'}, {name:'Tatooine: D',type:'Location',subType:'Site'},
  {name:'Tatooine',type:'Location',subType:'System'}
 ]}`);
 assert.equal(run('adjacentSites(0,1)'),false);
 assert.equal(run('adjacentSites(0,2)&&adjacentSites(2,0)'),true);
 assert.equal(run('adjacentSites(0,3)'),false);
 assert.equal(run('adjacentSites(3,4)'),false);
});
test('ongoing effects belong to their controller and disclose targets without exposing concealed cards',()=>{
 const {run}=harness();
 run(`catalog=PremiereData.readCatalog(${readFileSync(new URL('../data/premiere.json',import.meta.url),'utf8')});
 const pick=id=>catalog.find(c=>c.id===id);
 state={locations:[{name:'Tatooine: Site'}],light:[[]],dark:[[]],tableEffects:[{card:pick('Light:1778'),target:'Light'},{card:{...pick('Dark:2897'),concealed:true},target:'Light'}],lostPileEffects:[{card:pick('Dark:2897'),target:'Light'}],locationEffects:{0:[{card:pick('Light:2110')}]}};`);
 assert.deepEqual(Array.from(run("ongoingEffects('Light').map(e=>e.card.id)")),['Light:1778','Light:2110']);
 assert.deepEqual(Array.from(run("ongoingEffects('Dark').map(e=>e.card.id)")),['Dark:2897']);
 assert.match(run("ongoingEffects('Dark')[0].details"),/Betrifft Light Side/);
});
test('Imperial Barrier has an inspectable temporary effect that expires at the next turn',()=>{
 const {run}=harness();
 run(`catalog=PremiereData.readCatalog(${readFileSync(new URL('../data/premiere.json',import.meta.url),'utf8')});
 const target={name:'Luke Skywalker',type:'Character'};
 state={game:{timing:{turn:3}},locations:[{name:'Tatooine: Site'}],light:[[target]],dark:[[]],barredCards:new Map([[target,3]])};`);
 assert.equal(run("ongoingEffects('Dark').length"),1);
 assert.match(run("ongoingEffects('Dark')[0].details"),/Luke Skywalker.*weder kämpfen noch sich bewegen.*Interrupt/);
 assert.equal(run("ongoingEffects('Light').length"),0);
 run('state.game.timing.turn++');assert.equal(run("ongoingEffects('Dark').length"),0);
});
test('Hoth topology orders numbered markers and keeps Wampa Cave outside Echo Base interiors',()=>{
 const {run}=harness();const snapshot=JSON.parse(readFileSync(new URL('../data/hoth.json',import.meta.url),'utf8'));
 run(`const qaHoth=PremiereData.readCatalog(${JSON.stringify(snapshot)},PremiereData.HOTH);
 state={locations:['Dark:6359','Dark:6354','Light:5586','Light:1171','Light:1173','Light:1163','Light:5590','Light:5591','Light:5582'].map(id=>qaHoth.find(c=>c.id===id))};
 state.locationOrder=initialLocationOrder(state.locations);`);
 assert.deepEqual(Array.from(run('state.locationOrder')),[3,4,2,7,8,6,1,0,5]);
 assert.equal(run('adjacentSites(0,1)'),true);assert.equal(run('adjacentSites(0,3)'),false);
 run("state.locations.push({name:'Hoth: Generic exterior',type:'Location',subType:'Site',locationTags:['Exterior']})");
 assert.deepEqual(Array.from(run('initialLocationOrder(state.locations)')),[3,4,2,7,8,6,1,9,0,5]);
});
test('Hoth marker deployment offers only numerically valid insertion points despite absent markers',()=>{
 const {run}=harness();const snapshot=JSON.parse(readFileSync(new URL('../data/hoth.json',import.meta.url),'utf8'));
 run(`const qaHoth=PremiereData.readCatalog(${JSON.stringify(snapshot)},PremiereData.HOTH);
 state={phase:2,activeSide:'Light',hand:[qaHoth.find(c=>c.id==='Light:5590')],locations:['Dark:6359','Light:5586','Light:5582'].map(id=>qaHoth.find(c=>c.id===id))};
 state.locationOrder=initialLocationOrder(state.locations);`);
 assert.deepEqual(Array.from(run("locationDeployPositions('Light',0)")),[2]);
});
test('regular site movement allows a deployed character but blocks a second regular move',()=>{
 const {run}=harness();
 run("const character={name:'Rebel',type:'Character',deploy:1};state={phase:4,botTurn:null,locations:[{name:'Hoth: A',type:'Location',subType:'Site'},{name:'Hoth: B',type:'Location',subType:'Site'}],light:[[character],[]],force:[{}],movedThisTurn:[],deployedThisTurn:[character]};");
 assert.equal(run("movementOptions().length"),1);
 run("state.deployedThisTurn=[];state.movedThisTurn=[character]");
 assert.equal(run("movementOptions().length"),0);
});

test('Force generation includes personal Force and both location icon sources',()=>{
 const {run}=harness();
 run("state={locations:[{icons:{light:2,dark:1}},{icons:{light:0,dark:2}}]};");
 assert.equal(run("forceFromLocations('Light').count"),3);
 assert.equal(run("forceFromLocations('Dark').count"),4);
});
test('activation respects requested amount and Reserve Deck size',()=>{
 const {run}=harness();
 run("state={locations:[{icons:{light:2,dark:1}}],deck:[{id:1},{id:2}],botDeck:[],force:[],botForce:[],log:[]};");
 assert.equal(run("activate('Light',3)"),2);
 assert.equal(run("state.deck.length"),0);
 assert.equal(run("state.force.length"),2);
});
test('battle destiny requires Light decision before Dark draw',()=>{
 const {run}=harness();
 run("state={phase:3,locations:[{name:'Hoth: A'}],light:[[{ability:4,power:2}]],dark:[[{ability:4,power:2}]],deck:[{name:'A',destiny:3}],botDeck:[{name:'B',destiny:2}],used:[],botUsed:[],log:[],force:[],botForce:[]};battleSession={site:0,lightCard:null,darkCard:null,lightDestiny:null,darkDestiny:null,lightLoss:[],darkLoss:[],lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0};");
 run("battleDestiny('Dark')");
 assert.equal(run("state.botDeck.length"),1);
 assert.equal(run("battleSession.darkCard"),null);
});

test('Tooex nighttime power effect applies only to allied Rebel or alien at same site',()=>{
 const {run}=harness();
 run("const tooex={id:'Light:2',name:'2X-3KPR (Tooex)',gametext:'Where present under nighttime conditions, each of your Rebels and aliens at same planet site are power +2'};const rebel={id:'Light:4',name:'Rebel',power:2,characteristics:['rebel']};state={nightConditions:true,locations:[{name:'Tatooine: A',type:'Location',subType:'Site'}],light:[[tooex,rebel]],dark:[[]]};");
 assert.equal(run("cardPowerModifier(state.light[0][1],'Light',0)"),2);
 run("state.nightConditions=false");
 assert.equal(run("cardPowerModifier(state.light[0][1],'Light',0)"),0);
 run("state.nightConditions=true;state.light[0].shift()");
 assert.equal(run("cardPowerModifier(state.light[0][0],'Light',0)"),0);
});

test('Tooex does not grant nighttime bonus at a system or unqualified location',()=>{
 const {run}=harness();
 run("const tooex={id:'Light:2',gametext:'nighttime conditions'};const rebel={characteristics:['rebel'],power:2};state={nightConditions:true,locations:[{name:'Tatooine',type:'Location',subType:'System'}],light:[[tooex,rebel]],dark:[[]]};");
 assert.equal(run("cardPowerModifier(state.light[0][1],'Light',0)"),0);
});

test('every catalog card receives an explicit effect coverage status',()=>{
 const {run}=harness();
 run("catalog=[{id:'Light:2',name:'Tooex',gametext:'nighttime conditions'},{id:'Dark:99',name:'Other',gametext:'Power +1'},{id:'Test:Blank',name:'Blank',gametext:''},{id:'Dark:613',name:'Counter',gametext:'Interrupt'},{id:'Test:Ship',name:'Ship',type:'Starship',gametext:'Permanent pilot aboard provides ability of 1.'}]");
 assert.equal(run("effectCoverage().total"),5);
 assert.equal(run("effectCoverage().complete.length"),2);
 assert.equal(run("effectCoverage().partial.length"),1);
 assert.equal(run("effectCoverage().unimplemented.length"),1);
 assert.equal(run("effectCoverage().withoutText.length"),1);
 assert.equal(run("cardEffectStatus(catalog[1]).startsWith('OFFEN')"),true);
});

test('both Used Piles recirculate at the end of either player turn',()=>{
 const {run}=harness();
 run("state={deck:[{id:'L0'}],used:[{id:'L1'},{id:'L2'}],botDeck:[{id:'D0'}],botUsed:[{id:'D1'}],log:[]};");
 run("recirculateBoth()");
 assert.equal(run("state.used.length"),0);
 assert.equal(run("state.botUsed.length"),0);
 assert.equal(run("state.deck.length"),3);
 assert.equal(run("state.botDeck.length"),2);
 assert.equal(run("state.deck.map(x=>x.id).join(',')"),'L1,L2,L0');
 assert.equal(run("state.botDeck.map(x=>x.id).join(',')"),'D1,D0');
});
test('same named location cannot be deployed twice',()=>{
 const {run}=harness();
 run(`state={phase:2,activeSide:'Light',locations:[{name:'•Tatooine: Mos Eisley',side:'Dark',type:'Location',subType:'Site'},null],
  hand:[{name:'Tatooine: Mos Eisley',side:'Light',type:'Location',subType:'Site'}],light:[[],[]],dark:[[],[]]}`);
 assert.equal(run("locationDeployPositions('Light',0).length"),0);
});
test('battle damage and attrition stay separate',()=>{
 const {run}=harness();
 run("state={phase:3,locations:[{name:'Hoth: A'}],light:[[{ability:4,power:4}]],dark:[[{ability:4,power:7}]]};battleSession={site:0,lightDestiny:2,darkDestiny:1,lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0};");
 assert.equal(run("battleDamagePreview().lightDamage"),2);
 assert.equal(run("battleDamagePreview().darkDamage"),0);
});

test('Control phase: confirmed exclusive presence enables drain equal to opposing icons',()=>{
 const {run}=harness();
 run("state={phase:1,activeSide:'Light',botTurn:null,locations:[{name:'Tatooine: A',icons:{light:1,dark:2}}],light:[[{name:'Rebel',ability:2}]],dark:[[]],drainedSitesThisTurn:[],pendingForceLoss:null,gameWinner:null};");
 assert.equal(run("forceDrainValue('Light',0)"),2);
 run("state.dark[0]=[{name:'Imperial',ability:1}]");
 assert.equal(run("forceDrainValue('Light',0)"),null);
 run("state.dark[0]=[{name:'Unknown',ability:null}]");
 assert.equal(run("forceDrainValue('Light',0)"),null);
 run("state.dark[0]=[];state.light[0]=[{name:'Droid',ability:0}]");
 assert.equal(run("forceDrainValue('Light',0)"),null);
});
test('Force drain cannot be initiated twice at the same location',()=>{
 const {run}=harness();
 run("state={phase:1,activeSide:'Light',botTurn:null,locations:[{name:'Tatooine: A',icons:{light:1,dark:1}}],light:[[{name:'Rebel',ability:1}]],dark:[[]],drainedSitesThisTurn:[0],pendingForceLoss:null,gameWinner:null};");
 assert.equal(run("forceDrainValue('Light',0)"),null);
});
test('Force drain bot pays from chosen hand and life-force piles into Lost Pile',()=>{
 const {run}=harness();
 run("state={turn:1,phase:1,activeSide:'Light',activated:true,botTurn:null,locations:[{name:'Tatooine: A',icons:{light:1,dark:2}}],light:[[{name:'Rebel',type:'Character',ability:1,power:2}]],dark:[[]],drainedSitesThisTurn:[],pendingForceLoss:null,gameWinner:null,deck:[{name:'Reserve L'}],force:[],used:[],hand:[],lost:[],botDeck:[{name:'Reserve D'}],botForce:[],botUsed:[{name:'Used D'}],botHand:[{name:'Hand D'}],botLost:[],log:[],botHistory:[],botReason:''};");
 assert.equal(run("initiateForceDrain('Light',0)"),true);
 assert.equal(run("state.botLost.length"),2);
 assert.equal(run("state.botHand.length"),0);
 assert.equal(run("state.botUsed.length"),0);
 assert.equal(run("state.botDeck.length"),1);
 assert.equal(run("state.pendingForceLoss"),null);
 assert.equal(run("state.drainedSitesThisTurn.length"),1);
});
test('Dark Force drain makes Light player choose from hand or a Life Force pile',()=>{
 const {run}=harness();
 run("state={turn:1,phase:1,activeSide:'Dark',activated:false,botTurn:{steps:[],index:0},locations:[{name:'Hoth: A',icons:{light:2,dark:0}}],light:[[]],dark:[[{name:'Imperial',ability:1,power:1}]],drainedSitesThisTurn:[],pendingForceLoss:null,gameWinner:null,deck:[{name:'Reserve L'}],force:[{name:'Force L'}],used:[],hand:[{name:'Hand L'}],lost:[],botDeck:[{name:'Reserve D'}],botForce:[],botUsed:[],botHand:[],botLost:[],log:[],botHistory:[],botReason:''};");
 assert.equal(run("initiateForceDrain('Dark',0)"),true);
 assert.equal(run("state.pendingForceLoss.remaining"),2);
 assert.equal(run("loseForceForDrain('Light','force')"),true);
 assert.equal(run("state.pendingForceLoss.remaining"),1);
 assert.equal(run("loseForceForDrain('Light','hand',0)"),true);
 assert.equal(run("state.pendingForceLoss"),null);
 assert.equal(run("state.lost.length"),2);
 assert.equal(run("state.deck.length"),1);
});
test('Life Force depletion ends the game even while the losing player holds cards',()=>{
 const {run}=harness();
 run("state={turn:1,phase:1,activeSide:'Light',activated:true,botTurn:null,locations:[{name:'Tatooine: A',icons:{light:1,dark:1}}],light:[[{name:'Rebel',ability:1,power:2,type:'Character'}]],dark:[[]],drainedSitesThisTurn:[],pendingForceLoss:null,gameWinner:null,deck:[{name:'Reserve L'}],force:[],used:[],hand:[],lost:[],botDeck:[{name:'Reserve D'}],botForce:[],botUsed:[],botHand:[],botLost:[],log:[],botHistory:[],botReason:''};");
 assert.equal(run("initiateForceDrain('Light',0)"),true);
 assert.equal(run("state.botDeck.length"),0);
 assert.equal(run("state.gameWinner"),'Light');
 assert.equal(run("state.pendingForceLoss"),null);
});

test('Battle initiation consumes exactly 1 Force and prevents repeat at same site',()=>{
 const {run}=harness();
 run("render=()=>{};renderBattle=()=>{};state={phase:3,activeSide:'Light',botTurn:null,gameWinner:null,pendingForceLoss:null,locations:[{name:'Tatooine: Mos Eisley'}],light:[[{ability:2,power:3}]],dark:[[{ability:1,power:2}]],force:[{id:'bottom'},{id:'top'}],used:[],battledSitesThisTurn:[],log:[]}");
 assert.equal(run("canInitiateBattle(0)"),true);
 assert.equal(run("battleAnalysis(0)"),true);
 assert.equal(run("state.force.length"),1);
 assert.equal(run("state.used[0].id"),'top');
 assert.equal(run("state.battledSitesThisTurn.includes(0)"),true);
 run("closeBattle()");
 assert.equal(run("canInitiateBattle(0)"),false);
 assert.equal(run("battleAnalysis(0)"),false);
 assert.equal(run("state.force.length"),1);
 assert.equal(run("state.used.length"),1);
});

test('Battle initiation fails closed without cost, presence or correct phase',()=>{
 const {run}=harness();
 run("render=()=>{};renderBattle=()=>{};state={phase:3,activeSide:'Light',botTurn:null,gameWinner:null,pendingForceLoss:null,locations:[{name:'Tatooine: Mos Eisley'}],light:[[{ability:2}]],dark:[[{ability:1}]],force:[],used:[],battledSitesThisTurn:[],log:[]}");
 assert.equal(run("canInitiateBattle(0)"),false);
 assert.equal(run("battleAnalysis(0)"),false);
 run("state.force.push({id:'f'})");
 assert.equal(run("canInitiateBattle(0)"),true);
 run("state.dark[0][0].ability=null");
 assert.equal(run("canInitiateBattle(0)"),false);
 run("state.dark[0][0].ability=1;state.phase=2");
 assert.equal(run("canInitiateBattle(0)"),false);
 run("state.phase=3;state.pendingForceLoss={payer:'Light',remaining:1}");
 assert.equal(run("canInitiateBattle(0)"),false);
 run("state.pendingForceLoss=null;state.activeSide='Dark'");
 assert.equal(run("canInitiateBattle(0)"),false);
 run("state.activeSide='Light';state.gameWinner='Dark'");
 assert.equal(run("canInitiateBattle(0)"),false);
});

test('Battle site limit resets on a new turn',()=>{
 const {run}=harness();
 run("render=()=>{};renderBattle=()=>{};recirculateBoth=()=>{};botBegin=()=>{};state={phase:5,activeSide:'Light',botTurn:null,gameWinner:null,pendingForceLoss:null,activated:true,locations:[{name:'Tatooine: Mos Eisley'}],light:[[{ability:2}]],dark:[[{ability:1}]],force:[{id:'f'}],used:[],battledSitesThisTurn:[0],drainedSitesThisTurn:[],log:[]}");
 run("advance()");
 assert.equal(run("state.battledSitesThisTurn.length"),0);
 assert.equal(run("state.activeSide"),'Dark');
});

test('non-spy deployment needs friendly Force icons or confirmed presence',()=>{
 const {run}=harness();
 run("state={locations:[{name:'Hoth: A',type:'Location',subType:'Site',icons:{light:0,dark:1}}],force:[{}],botForce:[{}],light:[[]],dark:[[]]};const rebel={name:'Rebel',type:'Character',deploy:1,side:'Light'};");
 assert.equal(run("checkDeployment(rebel,state.locations[0])"),false);
 run("state.locations[0].icons.light=1");
 assert.equal(run("checkDeployment(rebel,state.locations[0])"),true);
 run("state.locations[0].icons.light=0;state.light[0]=[{name:'Luke',ability:2}]");
 assert.equal(run("checkDeployment(rebel,state.locations[0])"),true);
 run("state.light[0]=[{name:'Unresolved',ability:null}]");
 assert.equal(run("checkDeployment(rebel,state.locations[0])"),false);
});
test('spies ignore local Force-icon and presence requirement but still pay deploy costs',()=>{
 const {run}=harness();
 run("state={locations:[{name:'Death Star: A',type:'Location',subType:'Site',icons:{light:0,dark:0}}],force:[{}],botForce:[],light:[[]],dark:[[]]};const spy={name:'Leia Organa',type:'Character',deploy:1,characteristics:['spy']};");
 assert.equal(run("checkDeployment(spy,state.locations[0])"),true);
 run("state.force=[]");
 assert.equal(run("checkDeployment(spy,state.locations[0])"),false);
 run("state.force=[{}];spy.characteristics=[];spy.lore='Secret Imperial spy.'");
 assert.equal(run("checkDeployment(spy,state.locations[0])"),true);
 run("spy.lore='Soldier with no special training'");
 assert.equal(run("checkDeployment(spy,state.locations[0])"),false);
});
test('bot considers only legal Dark deployments and can use spies',()=>{
 const {run}=harness();
 run("state={phase:2,activeSide:'Dark',locations:[{name:'Hoth: A',type:'Location',subType:'Site',icons:{light:1,dark:0}},{name:'Hoth: B',type:'Location',subType:'Site',icons:{light:0,dark:2}}],force:[{}],botForce:[{}],light:[[],[]],dark:[[],[]],botHand:[{name:'Stormtrooper',side:'Dark',type:'Character',deploy:1}]};const deployOptions=()=>legalActions(state,'Dark').filter(option=>option.kind==='deploy');");
 assert.equal(run("deployOptions().length"),1);
 assert.equal(run("deployOptions()[0].args[1]"),1);
 run("state.locations[1].icons.dark=0");
 assert.equal(run("deployOptions().length"),0);
 run("state.botHand[0].characteristics=['spy']");
 assert.equal(run("deployOptions().length"),2);
 run("state.botForce=[]");
 assert.equal(run("deployOptions().length"),0);
});
test('character cannot deploy directly to a system even with own icons',()=>{
 const {run}=harness();
 run("state={locations:[{name:'Tatooine',type:'Location',subType:'System',icons:{light:2,dark:1}}],force:[{}],botForce:[{}],light:[[]],dark:[[]]};");
 assert.equal(run("checkDeployment({name:'Luke',type:'Character',deploy:1,characteristics:['spy']},state.locations[0])"),false);
});

test('battle forfeit covers attrition and battle damage simultaneously',()=>{
 const {run}=harness();
 run("render=()=>{};renderBattle=()=>{};state={phase:3,gameWinner:null,locations:[{name:'Hoth'}],light:[[{name:'Rebel',power:4,forfeit:4}]],dark:[[{name:'Trooper',power:7,forfeit:2}]],hand:[{name:'Hand'}],deck:[{name:'Deck'}],force:[{name:'Force'}],used:[],lost:[],botHand:[],botDeck:[{name:'DDeck'}],botForce:[],botUsed:[],botLost:[],log:[]};battleSession={site:0,lightCard:{name:'Destiny L'},darkCard:{name:'Destiny D'},lightDestiny:0,darkDestiny:2,lightLoss:[0],darkLoss:[],lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0,resolved:false}");
 assert.equal(run("battleForfeitPlan('Light').incoming"),2);
 assert.equal(run("battleDamagePreview().lightDamage"),5);
 assert.equal(run("resolveBattleLosses()"),true);
 assert.equal(run("state.lost.length"),1);
 assert.equal(run("state.pendingForceLoss.remaining"),1);
 assert.equal(run("state.pendingForceLoss.reason"),'battleDamage');
 assert.equal(run("battleSession"),null);
 assert.equal(run("loseForceForDrain('Light','hand',0)"),true);
 assert.equal(run("state.pendingForceLoss"),null);
 assert.equal(run("state.lost.length"),2);
});
test('battle remains unresolved if some attrition is uncovered while cards remain',()=>{
 const {run}=harness();
 run("render=()=>{};renderBattle=()=>{};state={phase:3,gameWinner:null,locations:[{name:'Hoth'}],light:[[{name:'Light',power:5,forfeit:2}]],dark:[[{name:'A',power:2,forfeit:1},{name:'B',power:1,forfeit:1}]],hand:[],deck:[{name:'LD'}],force:[],used:[],lost:[],botHand:[],botDeck:[{name:'DD'}],botForce:[],botUsed:[],botLost:[],log:[]};battleSession={site:0,lightCard:{name:'Destiny L'},darkCard:{name:'Destiny D'},lightDestiny:3,darkDestiny:0,lightLoss:[],darkLoss:[0],lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0,resolved:false}");
 assert.equal(run("battleForfeitPlan('Dark').valid"),false);
 assert.equal(run("resolveBattleLosses()"),false);
 assert.equal(run("state.dark[0].length"),2);
 assert.equal(run("state.botLost.length"),0);
 run("battleSession.darkLoss=[0,1]");
 assert.equal(run("battleForfeitPlan('Dark').valid"),true);
});
test('bot automatically pays remaining battle damage from its hand and Life Force',()=>{
 const {run}=harness();
 run("render=()=>{};renderBattle=()=>{};state={phase:3,gameWinner:null,locations:[{name:'Hoth'}],light:[[{name:'Light',power:5,forfeit:2}]],dark:[[{name:'Dark',power:2,forfeit:2}]],hand:[],deck:[{name:'LD'}],force:[],used:[],lost:[],botHand:[{name:'DH1'},{name:'DH2'}],botDeck:[{name:'DD'}],botForce:[{name:'DF'}],botUsed:[],botLost:[],log:[]};battleSession={site:0,lightCard:{name:'Destiny L'},darkCard:{name:'Destiny D'},lightDestiny:2,darkDestiny:0,lightLoss:[],darkLoss:[0],lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0,resolved:false}");
 assert.equal(run("battleForfeitPlan('Dark').remainingDamage"),3);
 assert.equal(run("resolveBattleLosses()"),true);
 assert.equal(run("state.botLost.length"),4);
 assert.equal(run("state.pendingForceLoss"),null);
 assert.equal(run("state.gameWinner"),null);
});
test('skipped battle destiny cannot generate attrition via a manual destiny bonus',()=>{
 const {run}=harness();
 run("state={phase:3,locations:[{name:'Hoth'}],light:[[{name:'L',power:2,forfeit:1}]],dark:[[{name:'D',power:2,forfeit:1}]]};battleSession={site:0,lightCard:{name:'Freiwillig verzichtet'},darkCard:{name:'Destiny D'},lightDestiny:0,darkDestiny:0,lightBonus:6,darkBonus:0,lightPowerMod:0,darkPowerMod:0,lightLoss:[],darkLoss:[]}");
 assert.equal(run("battleAttritionAgainst('Dark')"),0);
 assert.equal(run("battleAttritionAgainst('Light')"),0);
});
test('unneeded extra forfeits are refused when all debts already satisfied',()=>{
 const {run}=harness();
 run("state={phase:3,locations:[{name:'Hoth'}],light:[[{name:'A',power:2,forfeit:5},{name:'B',power:2,forfeit:5}]],dark:[[{name:'D',power:5,forfeit:1}]]};battleSession={site:0,lightCard:{name:'Destiny L'},darkCard:{name:'Destiny D'},lightDestiny:0,darkDestiny:0,lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0,lightLoss:[0,1],darkLoss:[]}");
 assert.equal(run("battleForfeitPlan('Light').valid"),false);
});

test('Dark side character uses one Force to move to adjacent site and cannot move twice',()=>{
 const {run}=harness();
 run("render=()=>{};const trooper={name:'Stormtrooper',type:'Character',deploy:1,ability:1};state={phase:0,activeSide:'Dark',botTurn:{steps:[],index:0},locations:[{name:'Tatooine: A',type:'Location',subType:'Site',icons:{light:0}},{name:'Tatooine: B',type:'Location',subType:'Site',icons:{light:2}}],light:[[],[]],dark:[[trooper],[]],botForce:[{id:'one'}],botUsed:[],movedThisTurn:[],log:[]};");
 assert.equal(run("movementOptionsFor('Dark').length"),0);
 run("state.phase=4");
 assert.equal(run("movementOptionsFor('Dark').length"),1);
 assert.equal(run("moveCharacterFor('Dark',0,0,1)"),true);
 assert.equal(run("state.botForce.length"),0);
 assert.equal(run("state.botUsed.length"),1);
 assert.equal(run("state.dark[0].length"),0);
 assert.equal(run("state.dark[1][0].name"),'Stormtrooper');
 assert.equal(run("movementOptionsFor('Dark').length"),0);
 assert.equal(run("moveCharacterFor('Dark',1,0,0)"),false);
});

test('movement options reject wrong side, wrong phase and insufficient Force',()=>{
 const {run}=harness();
 run("const rebel={name:'Rebel',type:'Character',deploy:1};const trooper={name:'Trooper',type:'Character',deploy:1};state={phase:4,activeSide:'Light',botTurn:null,locations:[{name:'Hoth: A',type:'Location',subType:'Site'},{name:'Hoth: B',type:'Location',subType:'Site'}],light:[[rebel],[]],dark:[[trooper],[]],force:[{}],botForce:[{}],movedThisTurn:[],log:[]};");
 assert.equal(run("movementOptionsFor('Light').length"),1);
 assert.equal(run("movementOptionsFor('Dark').length"),0);
 run("state.phase=3");
 assert.equal(run("movementOptionsFor('Light').length"),0);
 run("state.phase=4;state.force=[]");
 assert.equal(run("movementOptionsFor('Light').length"),0);
 run("state.activeSide='Dark';state.botTurn={steps:[],index:0}");
 assert.equal(run("movementOptionsFor('Light').length"),0);
 assert.equal(run("movementOptionsFor('Dark').length"),1);
 run("state.botForce=[]");
 assert.equal(run("movementOptionsFor('Dark').length"),0);
});

test('Dark bot schedules a Move phase and moves toward opponent Force icons',()=>{
 const {run}=harness();
 assert.equal(run("botPlan().map(s=>s.kind).join(',')"),'activate,control,deploy,battle,move,draw,finish');
 run("render=()=>{};const trooper={name:'Trooper',type:'Character',deploy:1,ability:1};state={turn:2,phase:0,activeSide:'Dark',botTurn:{steps:[{kind:'move'}],index:0},locations:[{name:'Tatooine: A',type:'Location',subType:'Site',icons:{light:0,dark:1}},{name:'Tatooine: B',type:'Location',subType:'Site',icons:{light:2,dark:0}}],light:[[],[]],dark:[[trooper],[]],botForce:[{id:'force'}],botUsed:[],movedThisTurn:[],botHistory:[],log:[]};");
 run("botNextStep()");
 assert.equal(run("state.dark[1][0].name"),'Trooper');
 assert.equal(run("state.botUsed.length"),1);
 assert.equal(run("state.botForce.length"),0);
 assert.equal(run("state.movedThisTurn.length"),1);
 assert.equal(run("state.botHistory[0].includes('Move: Bot bewegt')"),true);
});

test('Dark bot does not spend Force when no legal adjacent destination exists',()=>{
 const {run}=harness();
 run("render=()=>{};const trooper={name:'Trooper',type:'Character',deploy:1,ability:1};state={turn:2,activeSide:'Dark',phase:0,botTurn:{steps:[{kind:'move'}],index:0},locations:[{name:'Tatooine: A',type:'Location',subType:'Site',icons:{light:0}},{name:'Hoth: B',type:'Location',subType:'Site',icons:{light:2}}],light:[[],[]],dark:[[trooper],[]],botForce:[{id:'force'}],botUsed:[],movedThisTurn:[],botHistory:[],log:[]};");
 run("botNextStep()");
 assert.equal(run("state.dark[0].length"),1);
 assert.equal(run("state.botForce.length"),1);
 assert.equal(run("state.botUsed.length"),0);
});

test('droids count as zero ability, cannot create presence, and do not block allied known ability',()=>{
 const {run}=harness();
 run("const bot={id:'Dark:816',name:'EG-6',type:'Character',subType:'Droid',ability:null,power:0};state={locations:[{name:'Tatooine: Cantina',type:'Location',subType:'Site'}],light:[[]],dark:[[bot]]};");
 assert.equal(run("cardAbility(state.dark[0][0])"),0);
 assert.equal(run("confirmedPresence('Dark',0)"),false);
 assert.equal(run("battleTotals(0).darkAbility"),0);
 run("state.dark[0].push({name:'Officer',type:'Character',subType:'Imperial',ability:4,power:2})");
 assert.equal(run("confirmedPresence('Dark',0)"),true);
 assert.equal(run("battleTotals(0).darkAbility"),4);
});
test('unknown non-droid ability remains unknown when no known presence or destiny threshold exists',()=>{
 const {run}=harness();
 run("state={locations:[{name:'Hoth: Site',type:'Location',subType:'Site'}],light:[[{name:'Unknown',type:'Character',subType:'Alien',ability:null,power:2}]],dark:[[]]};");
 assert.equal(run("cardAbility(state.light[0][0])"),null);
 assert.equal(run("confirmedPresence('Light',0)"),null);
 assert.equal(run("battleTotals(0).lightAbility"),null);
 run("state.light[0].push({name:'Rebel',type:'Character',ability:4,power:2})");
 assert.equal(run("confirmedPresence('Light',0)"),true);
 assert.equal(run("battleTotals(0).lightAbility"),4);
});
test('EG-6 boosts friendly non-power droids present, but not itself, power droids or enemies',()=>{
 const {run}=harness();
 run("const eg={id:'Dark:816',name:'EG-6',type:'Character',subType:'Droid',power:0,extraText:['Power Droid'],gametext:'Adds 1 to power of each of your droids present, except power droids.'};const astromech={name:'R1',type:'Character',subType:'Droid',power:2};const otherPower={name:'Power Droid',type:'Character',subType:'Droid',power:3,extraText:['Power Droid']};const lightDroid={name:'R2',type:'Character',subType:'Droid',power:1};state={locations:[{name:'Tatooine: A',type:'Location',subType:'Site'}],light:[[lightDroid]],dark:[[eg,astromech,otherPower]]};");
 assert.equal(run("cardPowerModifier(state.dark[0][1],'Dark',0)"),1);
 assert.equal(run("cardPowerModifier(state.dark[0][0],'Dark',0)"),0);
 assert.equal(run("cardPowerModifier(state.dark[0][2],'Dark',0)"),0);
 assert.equal(run("cardPowerModifier(state.light[0][0],'Light',0)"),0);
 assert.equal(run("battleTotals(0).darkPower"),6);
 run("state.dark[0].push(state.dark[0][0])");
 assert.equal(run("cardPowerModifier(state.dark[0][1],'Dark',0)"),2);
});
test('starred EG-6 destiny is explicitly zero, locations are zero, unknown non-locations stay unknown',()=>{
 const {run}=harness();
 assert.equal(run("printedBattleDestiny({id:'Dark:816',type:'Character',destiny:NaN,gametext:'*Destiny equals zero'})"),0);
 assert.equal(run("printedBattleDestiny({type:'Location',subType:'Site',destiny:null})"),0);
 assert.equal(run("printedBattleDestiny({type:'Character',destiny:null})"),null);
 assert.equal(run("printedBattleDestiny({type:'Character',destiny:3})"),3);
});
test('EG-6 battle destiny doubles underdog Dark present power once, not battle destiny',()=>{
 const {run}=harness();
 run("render=()=>{};renderBattle=()=>{};state={phase:3,locations:[{name:'Tatooine: A',type:'Location',subType:'Site'}],light:[[{name:'Rebel',type:'Character',ability:4,power:5}]],dark:[[{name:'Trooper',type:'Character',ability:4,power:3}]],deck:[],used:[],botDeck:[{id:'Dark:816',name:'EG-6',destiny:NaN,gametext:'*Destiny equals zero, but if drawn as a battle destiny where you have less power than opponent, your total power present is doubled (once per battle).'}],botUsed:[],log:[]};battleSession={site:0,lightCard:{name:'Freiwillig verzichtet'},darkCard:null,lightDestiny:0,darkDestiny:null,lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0};");
 run("battleDestiny('Dark')");
 assert.equal(run("battleSession.darkDestiny"),0);
 assert.equal(run("battleSession.darkPowerDoubled"),true);
 assert.equal(run("battleDamagePreview().darkTotal"),6);
 assert.equal(run("battleDamagePreview().lightDamage"),1);
 assert.equal(run("state.botUsed.length"),1);
});
test('EG-6 destiny does not double Dark power if already tied or stronger',()=>{
 const {run}=harness();
 run("render=()=>{};renderBattle=()=>{};state={phase:3,locations:[{name:'Tatooine: A',type:'Location',subType:'Site'}],light:[[{name:'Rebel',type:'Character',ability:4,power:3}]],dark:[[{name:'Trooper',type:'Character',ability:4,power:3}]],deck:[],used:[],botDeck:[{id:'Dark:816',name:'EG-6',destiny:NaN,gametext:'*Destiny equals zero, but if drawn as a battle destiny where you have less power than opponent, your total power present is doubled (once per battle).'}],botUsed:[],log:[]};battleSession={site:0,lightCard:{name:'Freiwillig verzichtet'},darkCard:null,lightDestiny:0,darkDestiny:null,lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0};");
 run("battleDestiny('Dark')");
 assert.equal(run("battleSession.darkPowerDoubled"),undefined);
 assert.equal(run("battleDamagePreview().darkTotal"),3);
});


test('printed unconditional immunity is strict and conditional/granted immunity is excluded',()=>{
 const {run}=harness();
 assert.equal(run("printedAttritionImmunityBelow({gametext:'Immune to attrition < 5.'})"),5);
 assert.equal(run("printedAttritionImmunityBelow({gametext:\"Adds 1 to power. 'Diplomatic' immunity to attrition < 2.\"})"),2);
 assert.equal(run("printedAttritionImmunityBelow({gametext:'Immune to attrition < 5 if Han pilots.'})"),null);
 assert.equal(run("printedAttritionImmunityBelow({gametext:'Adds immunity to attrition < 2 to all vehicles.'})"),null);
 assert.equal(run("immuneToBattleAttrition({gametext:'Immune to attrition < 5.'},4)"),true);
 assert.equal(run("immuneToBattleAttrition({gametext:'Immune to attrition < 5.'},5)"),false);
});
test('immune Vader still requires vulnerable Trooper forfeit when attrition is 4',()=>{
 const {run}=harness();
 run("state={phase:3,locations:[{name:'Tatooine: A'}],light:[[{name:'Rebel',forfeit:7,power:8,ability:4}]],dark:[[{name:'Vader',forfeit:8,power:6,gametext:'Immune to attrition < 5.'},{name:'Trooper',forfeit:2,power:2}]]};battleSession={site:0,lightCard:{name:'Draw'},darkCard:{name:'Freiwillig verzichtet'},lightDestiny:4,darkDestiny:0,lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0,lightLoss:[],darkLoss:[]};");
 assert.equal(run("battleForfeitPlan('Dark').valid"),false);
 run("battleSession.darkLoss=[1]");
 assert.equal(run("battleForfeitPlan('Dark').valid"),true);
 assert.equal(run("battleForfeitPlan('Dark').sum"),2);
 run("battleSession.darkLoss=[0]");
 assert.equal(run("battleForfeitPlan('Dark').valid"),false);
});
test('at immunity threshold Vader must be eligible for attrition',()=>{
 const {run}=harness();
 run("state={phase:3,locations:[{name:'Hoth: A'}],light:[[{name:'Rebel',forfeit:7,power:5,ability:4}]],dark:[[{name:'Vader',forfeit:8,power:6,gametext:'Immune to attrition < 5.'}]]};battleSession={site:0,lightCard:{name:'Draw'},darkCard:{name:'Freiwillig verzichtet'},lightDestiny:5,darkDestiny:0,lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0,lightLoss:[],darkLoss:[]};");
 assert.equal(run("battleForfeitPlan('Dark').valid"),false);
 run("battleSession.darkLoss=[0]");
 assert.equal(run("battleForfeitPlan('Dark').valid"),true);
});
test('immune Vader can forfeit to cover battle damage only after Trooper covers attrition',()=>{
 const {run}=harness();
 run("state={phase:3,locations:[{name:'Hoth: A'}],light:[[{name:'Rebel',forfeit:7,power:10,ability:4}]],dark:[[{name:'Vader',forfeit:8,power:6,gametext:'Immune to attrition < 5.'},{name:'Trooper',forfeit:2,power:2}]]};battleSession={site:0,lightCard:{name:'Draw'},darkCard:{name:'Freiwillig verzichtet'},lightDestiny:4,darkDestiny:0,lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0,lightLoss:[],darkLoss:[0,1]};");
 assert.equal(run("battleDamagePreview().darkDamage"),6);
 assert.equal(run("battleForfeitPlan('Dark').valid"),true);
 assert.equal(run("battleForfeitPlan('Dark').remainingDamage"),0);
});
test('all immune cards survive attrition without forfeit but battle damage remains payable',()=>{
 const {run}=harness();
 run("state={phase:3,locations:[{name:'Hoth: A'}],light:[[{name:'Rebel',power:10,ability:4}]],dark:[[{name:'Vader',forfeit:8,power:6,gametext:'Immune to attrition < 5.'}]]};battleSession={site:0,lightCard:{name:'Draw'},darkCard:{name:'Freiwillig verzichtet'},lightDestiny:4,darkDestiny:0,lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0,lightLoss:[],darkLoss:[]};");
 assert.equal(run("battleForfeitPlan('Dark').valid"),true);
 assert.equal(run("battleForfeitPlan('Dark').remainingDamage"),8);
});


test('Premiere location text raises battle destiny threshold only for the named side',()=>{
 const {run}=harness();
 run("state={locations:[{id:'Light:2448',name:'Tatooine: Dune Sea',type:'Location',subType:'Site',gametext:'Light: Blank. Dark: Total ability of 6 or more required for you to draw battle destiny here.'},{id:'Dark:2458',name:'Tatooine: Jundland Wastes',type:'Location',subType:'Site',gametext:'Dark: Your Tusken Raiders are forfeit +1. Light: Total ability of 6 or more required for you to draw battle destiny here.'},{id:'Dark:1426',name:'Kessel',type:'Location',subType:'System',gametext:'Dark: Blank. Light: Total ability of 6 or more required for you to draw battle destiny here.'},{name:'Hoth: A',type:'Location',subType:'Site',gametext:'Dark: Blank.'}]};");
 assert.equal(run("minimumBattleDestinyAbility('Dark',0)"),6);
 assert.equal(run("minimumBattleDestinyAbility('Light',0)"),4);
 assert.equal(run("minimumBattleDestinyAbility('Light',1)"),6);
 assert.equal(run("minimumBattleDestinyAbility('Dark',1)"),4);
 assert.equal(run("minimumBattleDestinyAbility('Light',2)"),6);
 assert.equal(run("minimumBattleDestinyAbility('Dark',3)"),4);
});
test('Dark bot must skip destiny at Dune Sea with ability 4 despite having Force',()=>{
 const {run}=harness();
 run("render=()=>{};renderBattle=()=>{};state={phase:3,locations:[{name:'Tatooine: Dune Sea',type:'Location',subType:'Site',gametext:'Light: Blank. Dark: Total ability of 6 or more required for you to draw battle destiny here.'}],light:[[{name:'L',ability:4,power:2}]],dark:[[{name:'D',ability:4,power:2}]],deck:[],used:[],botDeck:[{name:'Dark destiny',destiny:5}],botUsed:[],log:[]};battleSession={site:0,lightCard:{name:'Freiwillig verzichtet'},darkCard:null,lightDestiny:0,darkDestiny:null,lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0};");
 run("botDestinyDecision()");
 assert.equal(run("battleSession.darkCard.name"),'Freiwillig verzichtet');
 assert.equal(run("battleSession.darkDestiny"),0);
 assert.equal(run("state.botDeck.length"),1);
 assert.equal(run("state.botUsed.length"),0);
});
test('Dark bot draws battle destiny at Dune Sea with ability at least 6',()=>{
 const {run}=harness();
 run("render=()=>{};renderBattle=()=>{};state={phase:3,locations:[{name:'Tatooine: Dune Sea',type:'Location',subType:'Site',gametext:'Light: Blank. Dark: Total ability of 6 or more required for you to draw battle destiny here.'}],light:[[{name:'L',ability:4,power:2}]],dark:[[{name:'D',ability:6,power:2}]],deck:[],used:[],botDeck:[{name:'Dark destiny',destiny:5}],botUsed:[],log:[]};battleSession={site:0,lightCard:{name:'Freiwillig verzichtet'},darkCard:null,lightDestiny:0,darkDestiny:null,lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0};");
 run("botDestinyDecision()");
 assert.equal(run("battleSession.darkDestiny"),5);
 assert.equal(run("state.botDeck.length"),0);
 assert.equal(run("state.botUsed.length"),1);
});
test('Vader increases each Dark battle destiny draw and therefore opposing attrition',()=>{
 const {run}=harness();
 run("render=()=>{};renderBattle=()=>{};state={phase:3,locations:[{name:'Hoth: A',type:'Location',subType:'Site'}],light:[[{name:'Rebel',ability:4,power:4}]],dark:[[{id:'Dark:634',name:'Vader',ability:6,power:6,gametext:'When in battle, adds 1 to each of your battle destiny draws. Immune to attrition < 5.'}]],deck:[],used:[],botDeck:[{name:'Destiny D',type:'Character',destiny:2}],botUsed:[],log:[]};battleSession={site:0,lightCard:{name:'Freiwillig verzichtet'},darkCard:null,lightDestiny:0,darkDestiny:null,lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0};");
 run("battleDestiny('Dark')");
 assert.equal(run("battleSession.darkDestiny"),3);
 assert.equal(run("battleAttritionAgainst('Light')"),3);
 assert.equal(run("battleDamagePreview().darkTotal"),9);
 assert.equal(run("state.botDeck.length"),0);
 assert.equal(run("state.botUsed.length"),1);
});
test('Vader bonus does not apply when absent, and never generates attrition from skipped destiny',()=>{
 const {run}=harness();
 run("render=()=>{};renderBattle=()=>{};state={phase:3,locations:[{name:'Hoth: A',type:'Location',subType:'Site'}],light:[[{name:'Rebel',ability:4,power:4}]],dark:[[{name:'Trooper',ability:4,power:3}]],deck:[],used:[],botDeck:[{name:'Destiny D',destiny:2}],botUsed:[],log:[]};battleSession={site:0,lightCard:{name:'Freiwillig verzichtet'},darkCard:null,lightDestiny:0,darkDestiny:null,lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0};");
 run("battleDestiny('Dark')");
 assert.equal(run("battleSession.darkDestiny"),2);
 run("battleSession.darkCard=null;battleSession.darkDestiny=null;state.dark[0].push({id:'Dark:634',name:'Vader',gametext:'When in battle, adds 1 to each of your battle destiny draws.'});skipDestiny('Dark')");
 assert.equal(run("battleSession.darkDestiny"),0);
 assert.equal(run("battleAttritionAgainst('Light')"),0);
});

test('Death Star War Room grants actual second Light battle destiny only to the initiator',()=>{
 const {run}=harness();
 run("render=()=>{};renderBattle=()=>{};state={phase:3,locations:[{id:'Dark:682',name:'Death Star: War Room',type:'Location',subType:'Site',gametext:'Dark: If you control, with a leader here, all Rebel Troopers are forfeit -1. Light: If you initiate a battle here, add one battle destiny.'}],light:[[{ability:4,power:5}]],dark:[[{ability:4,power:4}]],deck:[{name:'Second',destiny:2},{name:'First',destiny:3}],used:[],botDeck:[],botUsed:[],log:[]};battleSession={site:0,initiator:'Light',lightCard:null,darkCard:{name:'Freiwillig verzichtet'},lightDestiny:null,darkDestiny:0,lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0};");
 assert.equal(run("battleDestinyDrawCount('Light',0,4)"),2);
 run("battleDestiny('Light')");
 assert.equal(run("battleSession.lightDestiny"),5);
 assert.equal(run("battleSession.lightDrawCards.length"),2);
 assert.equal(run("state.deck.length"),0);
 assert.equal(run("state.used.length"),2);
 assert.equal(run("battleAttritionAgainst('Dark')"),5);
 assert.equal(run("battleDamagePreview().lightTotal"),10);
});
test('War Room bonus allows one added battle destiny with ability below four',()=>{
 const {run}=harness();
 run("render=()=>{};renderBattle=()=>{};state={phase:3,locations:[{id:'Dark:682',name:'Death Star: War Room',type:'Location',subType:'Site',gametext:'Light: If you initiate a battle here, add one battle destiny.'}],light:[[{ability:1,power:1}]],dark:[[{ability:4,power:4}]],deck:[{name:'Bonus',destiny:4}],used:[],botDeck:[],botUsed:[],log:[]};battleSession={site:0,initiator:'Light',lightCard:null,darkCard:{name:'Freiwillig verzichtet'},lightDestiny:null,darkDestiny:0,lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0};");
 assert.equal(run("battleDestinyDrawCount('Light',0,1)"),1);
 run("battleDestiny('Light')");
 assert.equal(run("battleSession.lightDestiny"),4);
 assert.equal(run("state.used.length"),1);
});
test('War Room bonus is side- and initiator-specific and fails closed on missing printed text',()=>{
 const {run}=harness();
 run("state={locations:[{id:'Dark:682',name:'Death Star: War Room',type:'Location',subType:'Site',gametext:'Light: If you initiate a battle here, add one battle destiny.'}]};battleSession={site:0,initiator:'Dark'};");
 assert.equal(run("printedWarRoomExtraBattleDestiny('Light',0)"),0);
 assert.equal(run("battleDestinyDrawCount('Dark',0,4)"),1);
 run("battleSession.initiator='Light'");
 assert.equal(run("printedWarRoomExtraBattleDestiny('Light',0)"),1);
 assert.equal(run("printedWarRoomExtraBattleDestiny('Dark',0)"),0);
 run("state.locations[0].gametext='Light: Another unrelated ability.'");
 assert.equal(run("printedWarRoomExtraBattleDestiny('Light',0)"),0);
 assert.equal(run("battleDestinyDrawCount('Light',0,null)"),null);
});
test('Massassi War Room adds Dark battle destiny with Vader +1 on every actual draw',()=>{
 const {run}=harness();
 run("render=()=>{};renderBattle=()=>{};state={phase:3,locations:[{id:'Light:2859',name:'Yavin 4: Massassi War Room',type:'Location',subType:'Site',gametext:'Light: If you control, with a leader here, all Stormtroopers are forfeit -1. Dark: If you initiate a battle here, add one battle destiny.'}],light:[[{ability:4,power:4}]],dark:[[{id:'Dark:634',name:'Vader',ability:6,power:6,gametext:'When in battle, adds 1 to each of your battle destiny draws.'}]],deck:[],used:[],botDeck:[{name:'Second',destiny:2},{name:'First',destiny:1}],botUsed:[],log:[]};battleSession={site:0,initiator:'Dark',lightCard:{name:'Freiwillig verzichtet'},darkCard:null,lightDestiny:0,darkDestiny:null,lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0};");
 assert.equal(run("battleDestinyDrawCount('Dark',0,6)"),2);
 run("battleDestiny('Dark')");
 assert.equal(run("battleSession.darkDestiny"),5);
 assert.equal(run("battleSession.darkDrawCards.length"),2);
 assert.equal(run("state.botUsed.length"),2);
 assert.equal(run("battleAttritionAgainst('Light')"),5);
});
test('Two entitled draws with only one Reserve card draw only once and never invent destiny',()=>{
 const {run}=harness();
 run("render=()=>{};renderBattle=()=>{};state={phase:3,locations:[{id:'Dark:682',name:'Death Star: War Room',type:'Location',subType:'Site',gametext:'Light: If you initiate a battle here, add one battle destiny.'}],light:[[{ability:4,power:2}]],dark:[[{ability:4,power:2}]],deck:[{name:'Only',destiny:6}],used:[],botDeck:[],botUsed:[],log:[]};battleSession={site:0,initiator:'Light',lightCard:null,darkCard:{name:'Freiwillig verzichtet'},lightDestiny:null,darkDestiny:0,lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0};");
 run("battleDestiny('Light')");
 assert.equal(run("battleSession.lightDestiny"),6);
 assert.equal(run("battleSession.lightDrawCards.length"),1);
 assert.equal(run("state.used.length"),1);
 assert.equal(run("state.deck.length"),0);
});

test('Dark bot can initiate exactly one battle at a site for 1 Force',()=>{
 const {run}=harness();
 run("render=()=>{};renderBattle=()=>{};state={phase:3,activeSide:'Dark',botTurn:{steps:[],index:0},locations:[{name:'Hoth: A'}],light:[[{ability:2,power:3}]],dark:[[{ability:4,power:5}]],force:[],used:[],botForce:[{id:'one'},{id:'two'}],botUsed:[],battledSitesThisTurn:[],log:[]};");
 assert.equal(run("canInitiateBattleFor('Dark',0)"),true);
 assert.equal(run("initiateBattleFor('Dark',0)"),true);
 assert.equal(run("state.botForce.length"),1);
 assert.equal(run("state.botUsed[0].id"),'two');
 assert.equal(run("battleSession.initiator"),'Dark');
 assert.equal(run("state.battledSitesThisTurn.includes(0)"),true);
 assert.equal(run("canInitiateBattleFor('Dark',0)"),false);
});
test('Dark bot battle step follows deploy and draws destiny before human Light side',()=>{
 const {run}=harness();
 run("render=()=>{};renderBattle=()=>{};state={turn:2,phase:2,activeSide:'Dark',botTurn:{steps:[{kind:'battle'},{kind:'move'}],index:0},locations:[{name:'Hoth: A',type:'Location',subType:'Site'}],light:[[{name:'Rebel',ability:4,power:3,forfeit:3}]],dark:[[{name:'Trooper',ability:4,power:4,forfeit:4}]],force:[],used:[],deck:[{name:'Light destiny',destiny:2}],botDeck:[{name:'Dark destiny',destiny:3}],botForce:[{name:'Payment'}],botUsed:[],battledSitesThisTurn:[],log:[],botHistory:[]};");
 run("botNextStep()");
 assert.equal(run("state.phase"),3);
 assert.equal(run("battleSession.initiator"),'Dark');
 assert.equal(run("battleSession.darkDestiny"),3);
 assert.equal(run("battleSession.lightCard"),null);
 assert.equal(run("state.botUsed.length"),2);
 assert.equal(run("state.botTurn.index"),1);
 run("botNextStep()");
 assert.equal(run("state.botTurn.index"),1);
 run("battleDestiny('Light')");
 assert.equal(run("battleSession.lightDestiny"),2);
});
test('battle destiny is always drawn by the initiator first',()=>{
 const {run}=harness();
 run("render=()=>{};renderBattle=()=>{};state={phase:3,locations:[{name:'Hoth: A',type:'Location',subType:'Site'}],light:[[{ability:4,power:2,forfeit:2}]],dark:[[{ability:4,power:2,forfeit:2}]],deck:[{name:'L',destiny:5}],botDeck:[{name:'D',destiny:2}],used:[],botUsed:[],log:[]};battleSession={site:0,initiator:'Dark',lightCard:null,darkCard:null,lightDestiny:null,darkDestiny:null,lightLoss:[],darkLoss:[],lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0};");
 run("battleDestiny('Light')");
 assert.equal(run("state.deck.length"),1);
 assert.equal(run("battleSession.lightCard"),null);
 run("botDestinyDecision()");
 assert.equal(run("battleSession.darkDestiny"),2);
 run("battleDestiny('Light')");
 assert.equal(run("battleSession.lightDestiny"),5);
 assert.equal(run("state.used.length"),1);
});
test('Dark bot selects mandatory nonimmune forfeit while preserving immune Vader',()=>{
 const {run}=harness();
 run("state={phase:3,locations:[{name:'Hoth: A'}],light:[[{name:'Rebel',ability:4,power:10,forfeit:7}]],dark:[[{name:'Vader',ability:6,power:6,forfeit:8,gametext:'Immune to attrition < 5.'},{name:'Trooper',ability:1,power:2,forfeit:2}]],log:[]};battleSession={site:0,initiator:'Dark',lightCard:{name:'Draw'},darkCard:{name:'Freiwillig verzichtet'},lightDestiny:4,darkDestiny:0,lightLoss:[],darkLoss:[],lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0,botForfeitsPending:true};");
 assert.equal(run("botChooseForfeits()"),true);
 assert.equal(run("battleSession.darkLoss.join(',')"),'1');
 assert.equal(run("battleSession.botForfeitsPending"),false);
 assert.equal(run("battleForfeitPlan('Dark').valid"),true);
});
test('Dark bot cannot battle without Force, confirmed presence, or correct phase',()=>{
 const {run}=harness();
 run("render=()=>{};state={turn:1,phase:3,activeSide:'Dark',botTurn:{steps:[{kind:'battle'}],index:0},locations:[{name:'Hoth: A'}],light:[[{ability:4,power:2}]],dark:[[{ability:4,power:2}]],botForce:[],botUsed:[],battledSitesThisTurn:[],log:[],botHistory:[]};");
 assert.equal(run("canInitiateBattleFor('Dark',0)"),false);
 run("state.botForce=[{id:'f'}];state.dark[0][0].ability=null");
 assert.equal(run("canInitiateBattleFor('Dark',0)"),false);
 run("state.dark[0][0].ability=4;state.phase=2");
 assert.equal(run("canInitiateBattleFor('Dark',0)"),false);
 // The bot advances its own phase to Battle; unresolved presence must still prevent initiation.
 run("state.dark[0][0].ability=null;botNextStep()");
 assert.equal(run("state.botForce.length"),1);
 assert.equal(run("battleSession"),null);
 assert.equal(run("state.botTurn.index"),1);
});

test('initiated battles cannot be abandoned before paying attrition and damage',()=>{
 const {run}=harness();
 run("render=()=>{};renderBattle=()=>{};state={phase:3,activeSide:'Light',botTurn:null,locations:[{name:'Hoth: A'}],light:[[{ability:4,power:3}]],dark:[[{ability:1,power:2}]],force:[{id:'f'}],used:[],battledSitesThisTurn:[],log:[]};");
 assert.equal(run("battleAnalysis(0)"),true);
 assert.equal(run("closeBattle()"),false);
 assert.equal(run("battleSession.initiator"),'Light');
 assert.equal(run("state.used.length"),1);
});

test('weapon hit obliges forfeiture even when attrition and battle damage are zero',()=>{
 const {run}=harness();
 run("render=()=>{};renderBattle=()=>{};const hit={name:'Hit trooper',power:4,ability:4,forfeit:3};state={phase:3,locations:[{name:'Tatooine: A'}],light:[[hit]],dark:[[{name:'Dark',power:4,ability:1,forfeit:1}]],lost:[],botLost:[],log:[],deck:[],used:[],botDeck:[],botUsed:[],force:[],botForce:[]};battleSession={site:0,initiator:'Light',lightDestiny:0,darkDestiny:0,lightCard:{name:'Skipped'},darkCard:{name:'Skipped'},lightLoss:[],darkLoss:[],weaponHits:{Light:[],Dark:[]},lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0};");
 assert.equal(run("recordBattleWeaponHit('Light',0)"),true);
 assert.equal(run("battleSession.lightLoss.includes(0)"),true);
 assert.equal(run("battleForfeitPlan('Light').valid"),true);
 run("toggleLoss('Light',0)");
 assert.equal(run("battleSession.lightLoss.includes(0)"),true);
 assert.equal(run("resolveBattleLosses()"),true);
 assert.equal(run("state.lost[0].name"),'Hit trooper');
 assert.equal(run("state.light[0].length"),0);
});
test('weapon hit cannot be ignored even if the target is immune to attrition',()=>{
 const {run}=harness();
 run("state={phase:3,locations:[{name:'Tatooine: A'}],light:[[{name:'Immune',forfeit:5,gametext:'Immune to attrition < 5.'}]],dark:[[]],log:[]};battleSession={site:0,lightCard:{name:'Drawn'},darkCard:{name:'Drawn'},lightDestiny:0,darkDestiny:1,lightLoss:[],darkLoss:[],lightBonus:0,darkBonus:0,lightPowerMod:0,darkPowerMod:0};");
 assert.equal(run("recordBattleWeaponHit('Light',0)"),true);
 assert.equal(run("battleForfeitPlan('Light').valid"),true);
 run("battleSession.lightLoss=[]");
 assert.equal(run("battleForfeitPlan('Light').valid"),false);
});
test('weapon hit registration rejects invalid targets and phases',()=>{
 const {run}=harness();
 run("state={phase:3,locations:[{name:'Site'}],light:[[{name:'L'}]],dark:[[]],log:[]};battleSession={site:0,lightLoss:[],darkLoss:[]};");
 assert.equal(run("recordBattleWeaponHit('Dark',0)"),false);
 assert.equal(run("recordBattleWeaponHit('Light',2)"),false);
 assert.equal(run("recordBattleWeaponHit('Other',0)"),false);
 assert.equal(run("recordBattleWeaponHit('Light',0)"),true);
 assert.equal(run("recordBattleWeaponHit('Light',0)"),true);
 assert.equal(run("battleSession.weaponHits.Light.length"),1);
 run("state.phase=4");
 assert.equal(run("recordBattleWeaponHit('Light',0)"),false);
});

const starterLists=JSON.parse(readFileSync(new URL('../data/premiere-starter-decks.json',import.meta.url),'utf8'));
const themedLists=readFileSync(new URL('../data/premiere-themed-decks.json',import.meta.url),'utf8');
const supplementalCards=readFileSync(new URL('../data/premiere-supplemental-cards.json',import.meta.url),'utf8');
const playFormatLists=readFileSync(new URL('../data/play-format-decks.json',import.meta.url),'utf8');
const expansionCards=readFileSync(new URL('../data/a-new-hope.json',import.meta.url),'utf8');

async function premiereHarness(deckLists=starterLists,browser){
 const fixture=harness(browser);
 const {run}=fixture;
 const snapshot=readFileSync(new URL('../data/premiere.json',import.meta.url),'utf8');
 run('globalThis.location={hostname:'+JSON.stringify(browser?.hostname??'')+'};');
 run(`fetch=async path=>{
  if(path==='data/premiere.json')return {ok:true,json:async()=>JSON.parse(${JSON.stringify(snapshot)})};
  if(path==='data/premiere-starter-decks.json'&&${deckLists!==null})return {ok:true,json:async()=>(${JSON.stringify(deckLists)})};
  if(path==='data/premiere-themed-decks.json')return {ok:true,json:async()=>JSON.parse(${JSON.stringify(themedLists)})};
  if(path==='data/premiere-supplemental-cards.json')return {ok:true,json:async()=>JSON.parse(${JSON.stringify(supplementalCards)})};
  if(path==='data/play-format-decks.json')return {ok:true,json:async()=>JSON.parse(${JSON.stringify(playFormatLists)})};
  if(path==='data/a-new-hope.json')return {ok:true,json:async()=>JSON.parse(${JSON.stringify(expansionCards)})};
  if(path==='local-print-texts.json'){
   globalThis.requestedLocalPrints=true;
   const report=${JSON.stringify(browser?.localPrintReport??null)};
   if(report)return {ok:true,json:async()=>report};
  }
  return {ok:false,status:404};
 }`);
 await run('load()');
 return fixture;
}

test('the card inspector separates rules text, print scan, lore, German notes and special values',async()=>{
 const {run,elements}=await premiereHarness();
 assert.match(html,/<dialog id="cardInspector"[^>]+aria-labelledby="cardInspectorTitle">/);
 assert.equal(elements.get('cardInspector').open,false);
 run(`state={trainingBattle:true,botHand:[catalog.find(card=>card.id==='Dark:816'),catalog.find(card=>card.id==='Dark:1767')]};
  el('showBotHand').checked=true;inspectCard('Dark',0,'hand')`);
 assert.equal(elements.get('cardInspector').open,true);
 assert.equal(elements.get('cardInspectorTitle').textContent,run("state.botHand[0].name"));
 const eg6=elements.get('cardInspectorBody').innerHTML;
 assert.match(eg6,/Destiny \* \(Sonderwert\)/);
 assert.match(eg6,/Aktiver Spieltext.*Korrekturslip.*Drucktext im Kartenscan.*Lore.*Deutsche Erklärung/);
 run("inspectCard('Dark',1,'hand')");
 assert.match(elements.get('cardInspectorBody').innerHTML,/Aktiver Spieltext.*Verknüpfte Vor-Errata-Fassung/);
 run("closeCard();el('showBotHand').checked=false;inspectCard('Dark',0,'hand')");
 assert.equal(elements.get('cardInspector').open,false);
});

test('the local inspector uses scan-matched print text and keeps both location sides separate',async()=>{
 const localPrintReport={schema:1,cards:[
  {id:'Light:2',status:'sight',scanUrl:'https://res.starwarsccg.org/cards/Premiere-Light/large/2x3kpr.gif',printText:'Printed < text'},
  {id:'Light:672',status:'sight',scanUrl:'https://res.starwarsccg.org/cards/Premiere-Light/large/deathstardetentionblockcontrolroom.gif',
   printText:{Light:'Printed Light Side text',Dark:''}},
  {id:'Dark:816',status:'sight',scanUrl:'https://res.starwarsccg.org/cards/Premiere-Dark/large/wrong-scan.gif',printText:'Wrong scan'},
 ]};
 const {run,elements}=await premiereHarness(starterLists,{hostname:'127.0.0.1',localPrintReport});
 assert.equal(run('localPrintTexts.size'),2);
 run(`state={hand:[catalog.find(card=>card.id==='Light:2')],botHand:[catalog.find(card=>card.id==='Dark:816')]};inspectCard('Light',0,'hand')`);
 const body=elements.get('cardInspectorBody');
 assert.match(body.innerHTML,/Aktiver Spieltext.*<h3>Drucktext<\/h3><p[^>]*>Printed &lt; text/);
 assert.equal(run('state.hand[0].texts.print'),null);
 run(`showCardWithStats(catalog.find(card=>card.id==='Light:672'))`);
 assert.match(body.innerHTML,/<h3>Drucktext<\/h3>.*Light Side<\/b><br>Printed Light Side text.*Dark Side<\/b><br>Feld im Scan leer/);
 run(`state.trainingBattle=true;el('showBotHand').checked=true;inspectCard('Dark',0,'hand')`);
 assert.match(body.innerHTML,/Drucktext im Kartenscan · Transkription offen/);

 const publicPage=await premiereHarness(starterLists,{hostname:'example.com',localPrintReport});
 assert.equal(publicPage.run('globalThis.requestedLocalPrints'),undefined);
 assert.equal(publicPage.run('localPrintTexts.size'),0);
});

test('hand images select directly and a separate magnifier opens the inspector',async()=>{
 const {run,elements}=await premiereHarness();
 run(`start(0);chooseStart(startingLocationChoices(setupDecks.light)[1].index);beginStartingGame()`);
 const hand=elements.get('hand').innerHTML;
 assert.match(hand,/<button class="card-face"[^>]*id="handCard0"[^>]*aria-pressed="false"[^>]*onclick="select\(0,\d+,\d+\)"><img/);
 assert.match(hand,/<button class="hand-card-inspect"[^>]*aria-haspopup="dialog"[^>]*onclick="inspectCard\('Light',0,'hand'\)"/);
 assert.doesNotMatch(hand,/<b>|>Details<\/button>/);
 assert.equal(run('select(0)'),true);
 assert.equal(run('selected'),0);
 assert.equal(elements.get('cardInspector').open,false);
 assert.match(elements.get('hand').innerHTML,/id="handCard0" aria-pressed="true"/);
 run("inspectCard('Light',0,'hand',0)");
 assert.equal(elements.get('cardInspector').open,true);
 assert.equal(run('selected'),0);
 assert.equal(elements.get('selectInspectorCard').hidden,false);
 run("el('selectInspectorCard').onclick()");
 assert.equal(run('selected'),0);
 assert.equal(elements.get('cardInspector').open,false);
 assert.match(elements.get('hand').innerHTML,/class="card hand-card [^"]*\bchosen\b/);

 run(`const ship={name:'Test Ship',type:'Starship',ionDamage:true,
  weapons:[{name:'Test Weapon'}],occupants:[{role:'pilot',card:{name:'Test Pilot'}}]};
  state.light[0].push(ship);inspectCard('Light',0,'field',0)`);
 const field=run('renderPlaymatColumn(state.locations[0],0)');
 assert.match(field,/class="location-name">[^<]+/);
 assert.match(field,/aria-label="Test Ship ansehen" onclick="inspectCard\('Light',0,'field',0\)"/);
 assert.doesNotMatch(field,/<b>Test Ship|hand-card-inspect|>Test (?:Weapon|Pilot)</);
 assert.match(field,/class="playmat-stack"[^>]+>.*aria-label="Waffe · Test Weapon ansehen".*aria-label="Pilot · Test Pilot ansehen"/);
 assert.equal(elements.get('selectInspectorCard').hidden,false);
 assert.match(elements.get('cardInspectorBody').innerHTML,/Ionenschaden.*Besatzung und Ausrüstung.*Test Weapon.*Pilot · Test Pilot/);
 run("inspectStackLayer('Light',0,0,1)");
 assert.equal(elements.get('cardInspectorTitle').textContent,'Test Pilot');
 run("el('selectInspectorCard').onclick()");
 assert.equal(run('selectedTableCard===ship.occupants[0].card'),true);
 assert.match(elements.get('playmatSelection').innerHTML,/Test Pilot/);
});

test('playmat shows adjusted Deploy costs and exact engine targets, and cannot play an unaffordable quote',async()=>{
 const {run,elements}=await premiereHarness();
 run(`const card=id=>({...catalog.find(item=>item.id===id)});
  const sites=['Light:2471','Light:2447'].map(card);
  state=PremiereGame.createState(PremiereGame.actionState(73,1),[],[],sites,[0,1],'Light');
  setupDecks=null;state.phase=2;state.hand=[card('Light:1803')];
  state.force=Array.from({length:3},()=>({name:'Force'}));
  state.deck.push({name:'Life'});state.botDeck.push({name:'Life'});select(0);`);
 const panel=elements.get('playmatSelection');
 assert.match(panel.innerHTML,/Obi-Wan&#39;s Hut.*Ausspielen.*playmat-action-cost">2 Force/s);
 assert.match(panel.innerHTML,/Docking Bay 94.*Benötigt 5 Force\. Verfügbar: 3 Force/s);
 assert.match(elements.get('board').innerHTML,/blocked-target[^>]*id="playmatLocation1".*Ziel nicht bezahlbar/s);
 assert.equal(run("requestAction('deploy','Light',[0,1])"),false);
 assert.equal(run("forceBudget('Light')"),3);
 assert.ok(run("dispatchUI(legalActions(state,'Light').find(offer=>offer.kind==='deploy'&&offer.args[1]===0))"));
 assert.equal(run("state.light[0][0].id"),'Light:1803');
 run(`state.phase=4;state.movedThisTurn=[state.light[0][0]];
  selectTableCard('unit',0,0,'Light',null,currentGame().id,currentGame().revision);`);
 assert.match(panel.innerHTML,/bereits regulär bewegt/);
 assert.doesNotMatch(panel.innerHTML,/&quot;kind&quot;:&quot;move&quot;/);
 run(`state.phase=2;state.hand=[card('Light:1803')];select(0)`);
 assert.match(panel.innerHTML,/Ausspiellimit dieser Karte ist bereits erreicht/);
 run(`state.hand=[card('Light:2110')];state.locationEffects={};
  state.locations=[];state.locationOrder=[];state.light=[];state.dark=[];state.force=Array.from({length:4},()=>({}));select(0)`);
 assert.match(panel.innerHTML,/kein zulässiges Ziel/);
});

test('Premiere snapshot loads the four supported blasters into the starter decks',async()=>{
 const {run}=await premiereHarness();
 assert.equal(run("catalog.find(c=>c.name==='Rebel Trooper').warrior"),true);
 assert.deepEqual(JSON.parse(run('JSON.stringify(catalog.filter(basicWeaponRule).map(c=>c.id))')),['Light:259','Light:265','Dark:264','Dark:1264']);
 for(const side of ['light','dark']){
  assert.equal(run(`new Set(setupDecks.${side}.cards.filter(basicWeaponRule).map(c=>c.id)).size`),2);
 }
});

test('fixed starter lists load 60 cards per side and each new game gets independent copies',async()=>{
 const {run,elements}=await premiereHarness();
 assert.equal(elements.get('start').disabled,false);
 for(const [side,key] of [['Light','light'],['Dark','dark']]){
  const expected=starterLists.decks[side].cards.flatMap(({id,count})=>Array(count).fill(id));
  assert.equal(expected.length,60);
  const deck=`setupDecks.${key}`;
  assert.deepEqual(JSON.parse(run(`JSON.stringify(${deck}.cards.map(card=>card.id))`)),expected);
  assert.equal(run(`new Set(${deck}.cards).size`),60);
  assert.deepEqual(JSON.parse(run(`JSON.stringify(startingLocationChoices(${deck}).map(x=>x.card.id))`)),starterLists.decks[side].startingLocations);
  run(`${deck}.cards[0].power=999`);
  run('start()');
  assert.notEqual(run(`${deck}.cards[0].power`),999);
 }
});

test('starter deck buttons open only the selected 60-card list on demand',async()=>{
 const {run,elements}=await premiereHarness();
 run("el('autoBotDeck').checked=false;renderLaunch()");
 const dialog=run("el('starterDeckDialog')");
 const list=run("el('starterDeckCards')");
 assert.match(html,/<dialog id="starterDeckDialog"[^>]+aria-labelledby="starterDeckTitle">/);
 assert.match(html,/<form method="dialog"><button autofocus>Schließen<\/button><\/form>/);
 assert.equal(list.innerHTML,'');
 assert.equal(elements.has('effectCoverage'),false);
 assert.equal(dialog.open,false);

 for(const [side,card,otherCard] of [['Light','Rebel Trooper','Stormtrooper'],['Dark','Stormtrooper','Rebel Trooper']]){
  const button=elements.get('view'+side+'Deck');
  assert.equal(button.disabled,false);
  dialog.open=false;
  button.onclick();
  assert.equal(dialog.open,true);
  assert.equal(elements.get('starterDeckTitle').textContent,side+' Side Deck · 60 Karten');
  assert.ok(list.innerHTML.includes('10 × '+card));
  assert.ok(!list.innerHTML.includes('10 × '+otherCard));
  assert.equal([...list.innerHTML.matchAll(/<li><button [^>]*>(\d+) × /g)].reduce((total,entry)=>total+Number(entry[1]),0),60);
 }

 run('showEffectCoverage()');
 assert.match(elements.get('effectCoverage').textContent,/OFFENE KARTEN/);
});

function assertStartingDecksPreserved(run,lists){
 for(const [side,hand,deck,lost] of [['Light','state.hand','state.deck','state.lost'],['Dark','state.botHand','state.botDeck','state.botLost']]){
  assert.equal(run(`${hand}.length`),8);
  assert.equal(run(`${lost}.length`),0);
  const board=`state.locations.filter(card=>card?.side==='${side}')`;
  const ids=JSON.parse(run(`JSON.stringify([...${hand},...${deck},...${board}].map(card=>card.id).sort())`));
  assert.deepEqual(ids,lists.decks[side].cards.flatMap(({id,count})=>Array(count).fill(id)).sort());
 }
 assert.equal(run('state.light.length===state.locations.length&&state.dark.length===state.locations.length'),true);
 assert.equal(run('state.locations.at(-1)'),null);
}

test('the bot commits a concealed start and both locations are revealed before shuffling',async()=>{
 const {run,elements}=await premiereHarness();
 const lockedBotId=run('setupDecks.darkChoice.card.id');
 assert.equal(run('setupDecks.revealed'),null);
 assert.doesNotMatch(elements.get('setupOptions').innerHTML,/Gleichzeitig aufgedeckte Startorte/);
 assert.equal(run("chooseStart(setupDecks.light.cards.findIndex(card=>card.id==='Light:80'))"),false);
 assert.equal(run('chooseStart(null)'),false);
 assert.equal(run('beginStartingGame()'),false);
 assert.equal(run('setupDecks.darkChoice.card.id'),lockedBotId);

 assert.equal(run('chooseStart(setupDecks.light.startingIndices[1])'),true);
 const reveal=elements.get('setupOptions').innerHTML;
 assert.match(reveal,/Gleichzeitig aufgedeckte Startorte.*Light Side.*Dark Side/);
 assert.match(reveal,/Tatooine: Dune Sea/);
 assert.ok(reveal.includes(run('setupDecks.darkChoice.card.name')));
 assert.equal(run('state'),null);
 run('retryStartingLocations()');
 assert.equal(run('chooseStart(setupDecks.light.startingIndices[2])'),false);
 assert.equal(run('beginStartingGame()'),true);
 assert.equal(run('state.locations[0].id'),starterLists.decks.Light.startingLocations[1]);
 assert.equal(run('state.locations[1].id'),lockedBotId);
 assert.equal(run('state.activeSide'),'Dark');
 assert.equal(run('state.deck.length===51&&state.botDeck.length===51'),true);
 assertStartingDecksPreserved(run,starterLists);
});

async function startingCollisionHarness(lists){
 const {run,elements}=await premiereHarness(lists);
 // Seed 0 chooses the first available bot location on both contested rounds.
 run('start(0,true,false,starterDecks,latestCardRulesVersion,1)');
 return {run,elements};
}

test('matching titles on both sides set aside each copy and repeated collisions preserve both decks',async()=>{
 const lists=structuredClone(starterLists);
 lists.decks.Dark.cards.find(card=>card.id==='Dark:1426').id='Dark:607';
 lists.decks.Dark.startingLocations=['Dark:2446','Dark:607','Dark:2458'];
 const {run,elements}=await startingCollisionHarness(lists);
 for(const [lightId,darkId] of [['Light:2447','Dark:2446'],['Light:608','Dark:607']]){
  const index=run(`startingLocationChoices(setupDecks.light).find(x=>x.card.id==='${lightId}').index`);
  assert.equal(run(`chooseStart(${index})`),true);
  assert.equal(run('setupDecks.revealed.darkChoice.card.id'),darkId);
  assert.equal(run('setupDecks.revealed.collision'),true);
  assert.equal(elements.get('instruction').textContent,'Gleicher Ortsname');
  assert.match(elements.get('setupOptions').innerHTML,/Gleichzeitig aufgedeckte Startorte.*Light Side.*Dark Side.*Erneut wählen/);
  assert.equal(run('beginStartingGame()'),false);
  assert.equal(run('state'),null);
  assert.equal(run('setupDecks.light.cards.length===60&&setupDecks.dark.cards.length===60'),true);
  run('retryStartingLocations()');
  assert.equal(run(`chooseStart(${index})`),false);
  assert.equal(run(`startingLocationChoices(setupDecks.dark).some(x=>x.card.id==='${darkId}')`),false);
 }
 run('chooseStart(startingLocationChoices(setupDecks.light)[0].index);beginStartingGame()');
 assert.equal(run("state.locations[0].id==='Light:2448'&&state.locations[1].id==='Dark:2458'"),true);
 assertStartingDecksPreserved(run,lists);
});

test('another copy of a colliding starter title remains available',async()=>{
 const lists=structuredClone(starterLists);
 lists.decks.Light.startingLocations=['Light:2447'];
 lists.decks.Light.cards.find(card=>card.id==='Light:2447').count=2;
 lists.decks.Light.cards.find(card=>card.id==='Light:2052').count--;
 lists.decks.Dark.startingLocations=['Dark:2446','Dark:1426'];
 const {run}=await startingCollisionHarness(lists);
 assert.equal(run('startingLocationChoices(setupDecks.light).length'),1);
 const first=run('startingLocationChoices(setupDecks.light)[0].index');
 run(`chooseStart(${first});retryStartingLocations()`);
 const second=run('startingLocationChoices(setupDecks.light)[0].index');
 assert.notEqual(second,first);
 assert.equal(run(`chooseStart(${first})`),false);
 run(`chooseStart(${second});beginStartingGame()`);
 assert.equal(run('state.locations[0].id'),'Light:2447');
 assert.equal(run("[...state.deck,...state.hand].filter(card=>card.id==='Light:2447').length"),1);
 assertStartingDecksPreserved(run,lists);
});

for(const sideWithoutStart of ['Light','Dark','both']){
 test(`the game starts when ${sideWithoutStart} has no alternative after a collision`,async()=>{
  const lists=structuredClone(starterLists);
  lists.decks.Light.startingLocations=sideWithoutStart==='Dark'?['Light:2447','Light:2448']:['Light:2447'];
  lists.decks.Dark.startingLocations=sideWithoutStart==='Light'?['Dark:2446','Dark:2458']:['Dark:2446'];
  const {run,elements}=await startingCollisionHarness(lists);
  run('chooseStart(startingLocationChoices(setupDecks.light)[0].index);retryStartingLocations()');
  if(sideWithoutStart==='Dark'){
   assert.equal(run('chooseStart(startingLocationChoices(setupDecks.light)[0].index)'),true);
  }else{
   assert.match(elements.get('setupOptions').innerHTML,/&quot;kind&quot;:&quot;chooseStart&quot;.*&quot;args&quot;:\[null\]/);
   assert.equal(run('chooseStart(null)'),true);
  }
  assert.match(elements.get('setupOptions').innerHTML,/Kein Startort verfügbar/);
  assert.equal(run('beginStartingGame()'),true);
  const chosen=sideWithoutStart==='Light'?['Dark:2458']:sideWithoutStart==='Dark'?['Light:2448']:[];
  assert.deepEqual(JSON.parse(run('JSON.stringify(state.locations.filter(Boolean).map(card=>card.id))')),chosen);
  assert.equal(run('state.deck.length'),sideWithoutStart==='Dark'?51:52);
  assert.equal(run('state.botDeck.length'),sideWithoutStart==='Light'?51:52);
  assertStartingDecksPreserved(run,lists);
 });
}

test('starter validation rejects invalid IDs, side, quantities and starting locations',async()=>{
 const {run}=await premiereHarness();
 const assertInvalid=(mutate,message)=>{
  const copy=structuredClone(starterLists);
  mutate(copy.decks.Light);
  assert.throws(()=>run(`readStarterDecks(${JSON.stringify(copy)},catalog)`),message);
 };
 assertInvalid(deck=>{deck.cards[0].id='Light:unknown'},/Unbekannte oder seitenfremde/);
 assertInvalid(deck=>{deck.cards[0].id='Dark:191'},/Unbekannte oder seitenfremde/);
 assertInvalid(deck=>{deck.cards[1].id=deck.cards[0].id},/Doppelter Eintrag/);
 assertInvalid(deck=>{deck.cards[0].count=1.5},/Ungültige Kartenanzahl/);
 assertInvalid(deck=>{deck.cards[0].count=2},/Erwartet sind 60 Karten/);
 assertInvalid(deck=>{deck.startingLocations=['Light:2052']},/Ungültige Starting Location/);
 assertInvalid(deck=>{deck.startingLocations=['Light:1427']},/Ungültige Starting Location/);
 assertInvalid(deck=>{deck.startingLocations.push(deck.startingLocations[0])},/unterschiedliche Namen/);

});

test('the game stays disabled when the local starter deck file is missing',async()=>{
 const {run,elements}=await premiereHarness(null);
 assert.equal(elements.get('start').disabled,true);
 assert.match(elements.get('hint').textContent,/data\/premiere-starter-decks\.json.*404/);
 assert.equal(run('setupDecks'),null);
});

function weaponBattleHarness(initiator='Light'){
 const fixture=harness();
 const {run}=fixture;
 run(`
 const rifle={id:'Light:265',side:'Light',name:'Blaster Rifle',type:'Weapon',subType:'Character'};
 const blaster={id:'Dark:1264',side:'Dark',name:'Imperial Blaster',type:'Weapon',subType:'Character'};
 const rebel={side:'Light',name:'Rebel',type:'Character',warrior:true,ability:2,power:3,deploy:1,forfeit:2};
 const officer={side:'Light',name:'Officer',type:'Character',ability:1,power:0,deploy:1,forfeit:2};
 const trooper={side:'Dark',name:'Trooper',type:'Character',warrior:true,ability:3,power:3,deploy:1,forfeit:2};
 const forceCards=()=>Array.from({length:5},(_,i)=>({name:'Force '+i}));
 state={turn:1,phase:2,activeSide:'${initiator}',botTurn:${initiator==='Dark'?'{steps:[],index:0}':'null'},locations:[
  {name:'Tatooine: A',type:'Location',subType:'Site'}, {name:'Tatooine: B',type:'Location',subType:'Site'}
 ],light:[[rebel,officer],[]],dark:[[trooper],[]],hand:[rifle],botHand:[blaster],
 deck:[{name:'Battle draw',destiny:5},{name:'Weapon draw',destiny:3}],
 botDeck:[{name:'Bot battle draw',destiny:5},{name:'Bot weapon draw',destiny:4}],
 force:forceCards(),botForce:forceCards(),used:[],botUsed:[],lost:[],botLost:[],log:[],botHistory:[],battledSitesThisTurn:[]};`);
 return fixture;
}

test('Light equips a blaster through the playmat only on an eligible warrior and it moves with its host',()=>{
 const {run}=weaponBattleHarness();
 run('select(0)');
 assert.match(run('renderPlaymatColumn(state.locations[0],0)'),/&quot;kind&quot;:&quot;equip&quot;[^>]*&quot;args&quot;:\[0,0,0\]/);
 assert.doesNotMatch(run('renderPlaymatColumn(state.locations[0],0)'),/&quot;kind&quot;:&quot;equip&quot;[^>]*&quot;args&quot;:\[0,0,1\]/);
 assert.equal(run("deployWeaponFor('Dark',0,0,0)"),false);
 assert.equal(run("deployWeaponFor('Light',0,0,1)"),false);
 assert.equal(run("deployWeaponFor('Light',0,1,0)"),false);
 run('equipSelectedWeapon(0,0)');
 assert.equal(run('rebel.weapons[0]===rifle&&state.hand.length===0&&state.force.length===3&&state.used.length===2'),true);
 run('state.phase=4');
 assert.equal(run('moveCharacter(0,0,1)'),true);
 assert.equal(run('state.light[1][0].weapons[0]===rifle'),true);
});

test('Dark bot equips an affordable weapon on its warrior during Deploy',()=>{
 const {run}=weaponBattleHarness('Dark');
 assert.match(run('botDeployPhase()[0]'),/Trooper erhält Imperial Blaster/);
 assert.equal(run('trooper.weapons[0]===blaster&&state.botForce.length===4&&state.botUsed.length===1'),true);
});

test('battle alternates weapon actions, hit warriors can return fire, and attached weapons follow forfeited hosts',()=>{
 const {run,elements}=weaponBattleHarness();
 run('rebel.weapons=[rifle];trooper.weapons=[blaster];state.phase=3;');
 assert.equal(run('battleAnalysis(0)'),true);
 assert.match(elements.get('battleControls').innerHTML,/&quot;kind&quot;:&quot;fireWeapon&quot;[^>]*&quot;args&quot;:\[0,0,0\]/);
 assert.doesNotMatch(elements.get('battleControls').innerHTML,/Light Battle Destiny ziehen/);
 assert.equal(run("fireBattleWeapon('Dark',0,0,0)"),false);
 assert.equal(run("fireBattleWeapon('Light',0,0,9)"),false);
 assert.equal(run('state.force.length===4&&state.deck.length===2'),true);
 run("skipDestiny('Light')");
 assert.equal(run('battleSession.lightCard'),null);
 assert.equal(run("fireBattleWeapon('Light',0,0,0)"),true);
 assert.equal(run("battleSession.weaponHits.Dark.includes(0)&&state.used.at(-1).name==='Weapon draw'"),true);
 assert.equal(run("battleTotals(0).darkPower===3&&battleSession.darkCard===null"),true);
 assert.match(elements.get('battleControls').innerHTML,/&quot;kind&quot;:&quot;fireWeapon&quot;[^>]*&quot;side&quot;:&quot;Dark&quot;[^>]*>Waffenaktion des Bots zeigen/);
 assert.equal(run('botWeaponDecision()'),true);
 assert.equal(run("battleSession.weaponHits.Light.includes(0)&&state.botUsed.at(-1).name==='Bot weapon draw'"),true);
 assert.equal(run('state.force.length===2&&state.botForce.length===4'),true);
 assert.equal(run("fireBattleWeapon('Light',0,0,0)"),false);
 assert.equal(run("passBattleWeapons('Light')"),true);
 assert.equal(run('botWeaponDecision()'),true);
 assert.equal(run('battleSession.weaponTurn'),null);
 run("skipDestiny('Light');botDestinyDecision()");
 assert.equal(run('resolveBattleLosses()'),true);
 assert.equal(run('state.lost.includes(rebel)&&state.lost.includes(rifle)&&state.botLost.includes(trooper)&&state.botLost.includes(blaster)'),true);
 assert.equal(run("'weapons' in rebel||'weapons' in trooper"),false);
});

test('weapon destiny equal to the target defense misses, even for the initiator',()=>{
 const {run}=weaponBattleHarness('Dark');
 run('trooper.weapons=[blaster];state.botDeck.at(-1).destiny=2;state.phase=3;');
 assert.equal(run("initiateBattleFor('Dark',0)"),true);
 assert.equal(run('battleSession.weaponTurn'),'Dark');
 assert.equal(run('botWeaponDecision()'),true);
 assert.equal(run("battleSession.weaponHits.Light.length===0&&state.botForce.length===3&&battleSession.darkCard===null"),true);
});

test('an empty Reserve Deck cannot hit and does not refund the weapon action',()=>{
 const {run}=weaponBattleHarness();
 run('rebel.weapons=[rifle,rifle];state.deck=[];state.phase=3;battleAnalysis(0);');
 assert.equal(run("fireBattleWeapon('Light',0,0,0)"),true);
 assert.equal(run('battleSession.weaponHits.Dark.length===0&&state.used.length===3&&state.force.length===2'),true);
 assert.equal(run('botWeaponDecision()'),true);
 assert.equal(run("fireBattleWeapon('Light',0,1,0)"),false);
});

async function craftHarness(){
 const {run,elements}=await premiereHarness();
 run(`
 launchOpen=false;
 const card=id=>({...catalog.find(c=>c.id===id)});
 const ship=card('Light:2838'), scout=card('Dark:2602'), tie=card('Dark:2600');
 const bantha=card('Dark:191'), tusken=card('Dark:2648');
 const dantooine=card('Light:608'), kessel=card('Dark:1426'), alderaan=card('Light:80'), tatooine=card('Light:2430');
 const dock=card('Light:2447'), dunes=card('Light:2448'), cantina=card('Light:2440');
 const forcePile=()=>Array.from({length:5},(_,i)=>({name:'Force '+i}));
 state={turn:1,phase:2,activeSide:'Light',botTurn:null,locations:[dantooine,kessel,dock,dunes,cantina,alderaan,tatooine],
  light:[[],[],[],[],[],[],[]],dark:[[],[],[],[],[],[],[]],hand:[ship],botHand:[scout,bantha],
  deck:[card('Light:259')],botDeck:[card('Dark:1264')],
  force:forcePile(),botForce:forcePile(),used:[],botUsed:[],lost:[],botLost:[],log:[],botHistory:[],battledSitesThisTurn:[]};`);
 return {run,elements};
}

test('only the driver contributes battle-destiny ability aboard an enclosed Sandcrawler',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(268,0);state.game.cardRulesVersion=24;state.phase=3;
  const crawler=card('Light:2161'),driver=card('Light:1593'),passenger=card('Light:1803');
  PremiereUnits.add(crawler,driver,'passenger','Light');
  PremiereUnits.add(crawler,passenger,'passenger','Light');
  state.light[2]=[crawler];state.dark[2]=[card('Dark:2355')];`);
 assert.equal(run("confirmedPresence('Light',2)&&battleTotals(2).lightAbility===0"),true);
 run("crawler.occupants[0].role='driver'");
 assert.equal(run("battleTotals(2).lightAbility===4&&requestAction('battle','Light',[2])"),true);
 assert.ok(run("legalActions(state,'Light').some(offer=>offer.kind==='destiny')"));
});

test('landed and unpiloted ships and vehicles use the powered-down defense values',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(269,0);state.game.cardRulesVersion=24;
  const black=card('Dark:247'),pilot=card('Dark:790'),speeder=card('Light:1609');
  const armedFreighter=card('Light:530');armedFreighter.occupants=[];
  const defenseAt=(card,slot)=>PremiereWeapons.defense(card,cardAbility(card),craftStats(card,slot));`);
 assert.equal(run('defenseAt(black,0)'),0);
 assert.equal(run('defenseAt(speeder,2)'),0);
 assert.equal(run('defenseAt(armedFreighter,2)'),2);
 run("PremiereUnits.add(black,pilot,'pilot','Dark')");
 assert.equal(run('defenseAt(black,0)'),run('black.maneuver+1'));
 assert.equal(run('defenseAt(black,2)'),0);
 assert.equal(run("craftStats(black,2,true).powered&&craftStats(black,2).power===0"),true);
});

test('Premiere pilots apply bonuses only while piloting',async()=>{
 const {run}=await craftHarness();
 for(const [pilotId,shipId,side,bonus] of [
  ['Light:305','Light:530','Light',3],['Light:2040','Light:530','Light',2],['Dark:1279','Dark:723','Dark',2]
 ]){
  const result=JSON.parse(run(`(()=>{
   const pilot=card('${pilotId}'),ship=card('${shipId}');
   const base=craftStats(ship,0).power;
   PremiereUnits.add(ship,pilot,'passenger','${side}');
   const passenger=craftStats(ship,0).power-base;
   ship.occupants[0].role='pilot';
   const piloted=craftStats(ship,0).power-base;
   pilot.gameTextCancelled=true;
   return JSON.stringify({passenger,piloted,suppressed:craftStats(ship,0).power-base});
  })()`));
  assert.deepEqual(result,{passenger:0,piloted:bonus,suppressed:0});
 }
 assert.equal(run("printedAttritionImmunityBelow(card('Light:305'))"),3);
});

test('Premiere guards gain defending power and cannot move',async()=>{
 const {run}=await craftHarness();
 run(`const rebelGuard=card('Light:2038'),imperialGuard=card('Dark:1286'),speeder=card('Light:1609');
  state.light[2]=[rebelGuard,speeder];state.dark[2]=[imperialGuard];state.phase=4;`);
 assert.equal(run("legalActions(state,'Light').some(option=>['move','transport'].includes(option.kind)&&option.card===rebelGuard)"),false);
 run("state.activeSide='Dark';state.botTurn={steps:[],index:0}");
 assert.equal(run("legalActions(state,'Dark').some(option=>option.kind==='move'&&option.card===imperialGuard)"),false);
 assert.equal(run("battleTotals(2,'Light').darkPower-battleTotals(2).darkPower"),4);
 assert.equal(run("battleTotals(2,'Dark').lightPower-battleTotals(2).lightPower"),4);
 assert.equal(run("battleTotals(2,'Light').lightPower-battleTotals(2).lightPower"),0);
 assert.equal(run("battleTotals(2,'Dark').darkPower-battleTotals(2).darkPower"),0);
 run("state.game=PremiereGame.actionState(1,0);state.game.cardRulesVersion=6");
 assert.equal(run("battleTotals(2,'Dark').lightPower-battleTotals(2).lightPower"),0);
});

test('Premiere mining droids defuse mines at the same site',async()=>{
 const {run}=await craftHarness();
 for(const [side,droidId,mineId] of [
  ['Light','Light:1556','Dark:2609'],['Dark','Dark:1557','Light:2610']
 ]){
  const observed=JSON.parse(run(`(()=>{
   const side='${side}',enemy=PremiereGame.otherSide(side),droid=card('${droidId}'),mine=card('${mineId}');
   const own=PremiereGame.zones(state,side),opposing=PremiereGame.zones(state,enemy);
   state.activeSide=side;state.phase=2;state.botTurn=side==='Dark'?{steps:[],index:0}:null;
   own.board[2]=[];own.board[3]=[droid];opposing.board[2]=[mine];opposing.board[3]=[];
   const defuse=()=>legalActions(state,side).find(action=>action.kind==='weaponEffect'&&action.args[0]==='defuse');
   const nearby=Boolean(defuse());
   own.board[3]=[];own.board[2]=[droid];
   droid.gameTextCancelled=true;
   const suppressed=Boolean(defuse());
   droid.gameTextCancelled=false;state.activeSide=enemy;
   const offTurn=Boolean(defuse());
   state.activeSide=side;
   const startingForce=own.force.length,success=performAction(defuse());
   return JSON.stringify({nearby,suppressed,offTurn,success,paid:startingForce-own.force.length,lost:opposing.lost.includes(mine)});
  })()`));
  assert.deepEqual(observed,{nearby:false,suppressed:false,offTurn:false,success:true,paid:1,lost:true});
 }
});

test('Premiere navigation droids improve only their supported craft',async()=>{
 const {run}=await craftHarness();
 for(const [droidId,hostId,side,role,fields] of [
  ['Light:1995','Light:2060','Light','astromech',['power','maneuver','hyperspeed']],
  ['Light:2000','Light:1609','Light','driver',['power','maneuver','landspeed']],
  ['Dark:2001','Dark:2660','Dark','driver',['power','maneuver','landspeed']]
 ]){
  assert.equal(run(`(()=>{
   const droid=card('${droidId}'),ship=card('${hostId}'),driver=card('${side==='Light'?'Light:2040':'Dark:2355'}');
   if(!PremiereUnits.accepts(ship,droid,'${role}'))return false;
   PremiereUnits.add(ship,driver,'${role==='driver'?'driver':'pilot'}','${side}');
   const base=craftStats(ship,0);
   if('${role}'==='driver')ship.occupants=[];
   PremiereUnits.add(ship,droid,'${role}','${side}');
   const stats=craftStats(ship,0);
   return stats.powered&&${JSON.stringify(fields)}.every(field=>stats[field]===base[field]+1);
  })()`),true,droidId);
 }
 assert.equal(run("PremiereUnits.accepts(card('Dark:191'),card('Dark:2001'),'driver')"),false);
});

test('Premiere matching pilots grant maneuver and one fallback destiny',async()=>{
 const {run}=await craftHarness();
 for(const [pilotId,shipId,side,power,maneuver] of [
  ['Light:239','Light:2060','Light',2,1],['Light:1098','Light:1677','Light',2,2],
  ['Dark:790','Dark:247','Dark',3,1],['Dark:791','Dark:249','Dark',3,1]
 ]){
  const actual=JSON.parse(run(`(()=>{
   const pilot=card('${pilotId}'),ship=card('${shipId}'),side='${side}';
   const board=PremiereGame.zones(state,side).board;
   board[0]=[ship];
   PremiereUnits.add(ship,pilot,'pilot',side);
   const stats=craftStats(ship,0);
   const fallback=battleDestinyDrawCount(side,0,1),regular=battleDestinyDrawCount(side,0,6);
   ship.id='unmatched';const wrongShip=battleDestinyDrawCount(side,0,1);
   ship.id='${shipId}';pilot.gameTextCancelled=true;
   return JSON.stringify({power:stats.power-ship.power,maneuver:stats.maneuver-ship.maneuver,
    fallback,regular,wrongShip,suppressed:battleDestinyDrawCount(side,0,1)});
  })()`));
  assert.deepEqual(actual,{power,maneuver,fallback:1,regular:1,wrongShip:0,suppressed:0});
 }
 for(const [pilotId,shipName] of [['Light:1390','Red 6'],['Light:1924','Gold 5']]){
  assert.equal(run(`(()=>{
   const pilot=card('${pilotId}'),ship={...card('Light:2060'),id:'matching-ship',name:'•${shipName}'};
   state.light[0]=[ship];PremiereUnits.add(ship,pilot,'pilot','Light');
   return craftStats(ship,0).power===ship.power+2&&craftStats(ship,0).maneuver===ship.maneuver+1&&
    battleDestinyDrawCount('Light',0,1)===1;
  })()`),true);
 }
});

test('Luke adds Force off Tatooine and his Red 5 maneuver bonus',async()=>{
 const {run}=await craftHarness();
 run(`const luke=card('Light:1593'),red5={...card('Light:2060'),id:'Light:2068',name:'•Red 5'};
  const baseline=forceFromLocations('Light').count;
  state.light[2]=[luke];`);
 assert.equal(run("forceFromLocations('Light').count-baseline"),0);
 run("state.light[2]=[];state.light[6]=[red5];PremiereUnits.add(red5,luke,'pilot','Light')");
 assert.equal(run("forceFromLocations('Light').count-baseline"),1);
 assert.equal(run("craftStats(red5,6).maneuver-red5.maneuver"),2);
 assert.equal(run("craftStats(red5,6).power-red5.power"),3);
 assert.equal(run("printedAttritionImmunityBelow(luke)"),3);
 run("red5.id='Not Red 5'");
 assert.equal(run("craftStats(red5,6).maneuver-red5.maneuver"),0);
});

test('Premiere starfighter pilots and capacity follow their printed slots',async()=>{
 const {run}=await craftHarness();
 run(`const xwing=card('Light:2838'),tieAdvanced=card('Dark:2595'),ywing=card('Light:2907'),
  red1=card('Light:2057'),red3=card('Light:2060'),pilot=card('Light:2040'),rebel=card('Light:2052'),droid=card('Light:1995');`);
 assert.equal(run('[xwing,tieAdvanced,ywing].every(ship=>craftStats(ship,0).ability===1)'),true);
 assert.equal(run("[xwing,tieAdvanced].some(ship=>PremiereUnits.accepts(ship,pilot,'pilot')||PremiereUnits.accepts(ship,rebel,'passenger'))"),false);
 assert.equal(run("PremiereUnits.accepts(ywing,pilot,'pilot')&&PremiereUnits.accepts(ywing,rebel,'passenger')"),true);
 run("PremiereUnits.add(ywing,rebel,'passenger','Light')");
 assert.equal(run("PremiereUnits.accepts(ywing,pilot,'pilot')"),false);
 assert.equal(run("[red1,red3].every(ship=>!craftStats(ship,0).powered&&PremiereUnits.accepts(ship,pilot,'pilot'))"),true);
 assert.equal(run("PremiereUnits.accepts(red1,droid,'astromech')"),false);
 run("PremiereUnits.add(red3,pilot,'pilot','Light');PremiereUnits.add(red3,droid,'astromech','Light')");
 assert.equal(run("craftStats(red3,0).powered&&PremiereUnits.roles(red3,rebel).length===0&&PremiereUnits.roles(red3,droid).length===0"),true);
});

test('Premiere transport reacts honor the route, passengers and printed cost',async()=>{
 const {run}=await craftHarness();
 run(`const tube=card('Light:1548'),darkTube=card('Dark:1547'),speeder=card('Light:1609'),v35=card('Light:2307'),
  wolf=card('Light:2250'),luke=card('Light:1593'),beru=card('Light:221'),guard=card('Light:2038');
  const estimate=(side,site,kind='battle')=>reactOptions(side,{kind,site,side:PremiereGame.otherSide(side)});
  state.locationOrder=[0,1,2,3,4,5,6];
  state.locations[2]=card('Dark:673');state.locations[3]=card('Dark:678');state.locations[4]=card('Dark:682');
  state.light[2]=[tube];state.dark[2]=[darkTube];`);
 assert.equal(run("estimate('Light',4).some(option=>option.card===tube&&option.cost===1)"),true);
 assert.equal(run("estimate('Dark',3,'drain').some(option=>option.card===darkTube)"),true);
 assert.equal(run("estimate('Light',4,'deploy').length"),0);
 assert.equal(run("estimate('Dark',4).some(option=>option.card===darkTube)"),true);
 run("tube.occupants=[1,2,3,4].map(()=>({role:'passenger',card:guard}));state.locations[4]=card('Light:2448')");
 assert.equal(run("PremiereUnits.roles(tube,guard).length===0&&estimate('Light',4).length===0"),true);
 run(`state.locations[2]=card('Light:2447');state.locations[3]=card('Light:2448');state.locations[4]=card('Light:2462');
  state.light[2]=[speeder,v35,wolf];PremiereUnits.add(speeder,luke,'driver','Light');PremiereUnits.add(v35,beru,'driver','Light');`);
 assert.equal(run("estimate('Light',3).some(option=>option.card===wolf&&option.cost===1)"),true);
 assert.equal(run("estimate('Light',4).some(option=>option.card===wolf)"),false);
 assert.equal(run("estimate('Light',3).filter(option=>option.card!==wolf).every(option=>option.cost===0)&&estimate('Light',3).length===3"),true);
 run("speeder.gameTextCancelled=true;state.reactedThisTurn=[beru]");
 assert.equal(run("estimate('Light',3).length===1&&estimate('Light',3)[0].card===wolf"),true);
});

test('Premiere blasters enforce mount, cost and strict defense threshold',async()=>{
 const {run}=await craftHarness();
 for(const [id,deploy,fire,bonus,effect] of [
  ['Light:259',1,1,0,'hit'],['Dark:1264',1,1,0,'hit'],['Light:265',2,2,1,'hit'],['Dark:264',2,2,1,'hit'],['Light:1503',1,0,-1,'zero']
 ]){
  const result=JSON.parse(run(`(()=>{
   const weapon=card('${id}'),host=card('${id.startsWith('Light')?'Light:1495':'Dark:2355'}'),target=card('Dark:2355');
   const shot=PremiereWeapons.shot(weapon,host,target,host.ability,target.ability);
   const craft=card('Dark:191'),starship=card('Dark:2595'),officer=card('Dark:1279');
   return JSON.stringify({deploy:PremiereWeapons.deployCost(weapon,host,host.ability),fire:shot.cost,
    bonus:shot.bonus,effect:shot.effect,defense:shot.defense,officer:PremiereWeapons.deployCost(weapon,officer,officer.ability),
    starship:Boolean(PremiereWeapons.shot(weapon,host,starship,host.ability,3)),
    creature:Boolean(PremiereWeapons.shot(weapon,host,craft,host.ability,3))});
  })()`));
  assert.deepEqual(result,{deploy,fire,bonus,effect,defense:1,officer:null,starship:false,creature:true});
 }
});

test('Djas Puhr counts Dark Force icons and nighttime',async()=>{
 const {run}=await craftHarness();
 run("const djas=card('Dark:741');state.dark[2]=[djas];state.locations[2]=card('Dark:682')");
 assert.equal(run("cardPowerModifier(djas,'Dark',2)"),2);
 run("state.nightSites=[2]");
 assert.equal(run("cardPowerModifier(djas,'Dark',2)"),4);
 assert.equal(run("printedAttritionImmunityBelow(djas)"),3);
 run('djas.gameTextCancelled=true');
 assert.equal(run("cardPowerModifier(djas,'Dark',2)"),0);
});

test('Leia improves Death Star Rebels but not herself',async()=>{
 const {run}=await craftHarness();
 run("const leia=card('Light:1495'),rebel=card('Light:2052'),alien=card('Light:305');state.light[2]=[leia,rebel,alien]");
 assert.equal(run("cardPowerModifier(rebel,'Light',2)"),0);
 run("state.locations[2]=card('Dark:682')");
 assert.equal(run("cardPowerModifier(rebel,'Light',2)"),1);
 assert.equal(run("cardPowerModifier(leia,'Light',2)+cardPowerModifier(alien,'Light',2)"),0);
 assert.equal(run("printedAttritionImmunityBelow(leia)"),2);
});

test('TIE Fighter deploy discount needs an Imperial capital ship at the system',async()=>{
 const {run}=await craftHarness();
 run("const fighter=card('Dark:2600'),capital=card('Dark:723'),neutral=card('Light:530');const base=craftDeployCost(fighter,state.locations[6],'Dark')");
 assert.equal(run('base'),run('fighter.deploy'));
 run("state.dark[6]=[neutral];state.dark[0]=[capital]");
 assert.equal(run("craftDeployCost(fighter,state.locations[6],'Dark')"),run('base'));
 run("state.dark[6]=[capital];state.dark[0]=[]");
 assert.equal(run("craftDeployCost(fighter,state.locations[6],'Dark')"),run('base-1'));
 assert.equal(run('craftStats(fighter,6).ability'),1);
});

test('Premiere transports enforce crew, cargo and docking capacity',async()=>{
 const {run}=await craftHarness();
 for(const [id,ability,capacity] of [
  ['Light:530',1,{pilot:3,passenger:4,cargo:1,hangar:0}],
  ['Dark:723',2,{pilot:6,passenger:8,cargo:2,hangar:4}],
  ['Dark:1291',1,{pilot:6,passenger:8,cargo:2,hangar:4}],
  ['Dark:2602',1,{pilot:1,passenger:2,cargo:0,hangar:0}],
 ]){
  assert.equal(run(`craftStats(card('${id}'),0).ability`),ability);
  for(const [role,limit] of Object.entries(capacity)){
   const expected=JSON.stringify(Array.from({length:limit+1},(_,i)=>i<limit));
   assert.equal(run(`(()=>{
    const ship=card('${id}'),role='${role}', results=[];
    const passengerId=({pilot:'Light:2040',passenger:'Light:2052',cargo:'Light:1609',hangar:'Dark:2600'})[role];
    for(let seat=0;seat<=${limit};seat++){
     const passenger=card(passengerId),accepted=PremiereUnits.accepts(ship,passenger,role);
     results.push(accepted);
     if(accepted)PremiereUnits.add(ship,passenger,role,ship.side);
    }
    return JSON.stringify(results);
   })()`),expected,id+' '+role);
  }
 }
 assert.equal(run("['Light:530','Dark:723','Dark:1291'].every(id=>canDock(card(id),scout,0))"),true);
 assert.equal(run("canDock(card('Dark:2595'),scout,0)"),false);
 run("PremiereUnits.add(scout,card('Dark:1279'),'pilot','Dark');PremiereUnits.add(scout,tusken,'passenger','Dark')");
 assert.equal(run("PremiereUnits.accepts(scout,tusken,'passenger')"),false);
 assert.equal(run("PremiereUnits.accepts(bantha,tusken,'passenger')&&cardAbility(bantha)===0.5"),true);
 run("PremiereUnits.add(bantha,tusken,'passenger','Dark');PremiereUnits.add(bantha,card('Dark:2355'),'passenger','Dark')");
 assert.equal(run("PremiereUnits.accepts(bantha,tusken,'passenger')"),false);
});

test('Tanbris discounts only weapons on the ship he pilots',async()=>{
 const {run}=await craftHarness();
 run(`const tanbris=card('Dark:1539'),destroyer=card('Dark:723'),other=card('Dark:1291'),ion=card('Dark:1327');
  state.activeSide='Dark';state.botTurn={steps:[],index:0};state.dark[0]=[destroyer,other];state.botHand=[ion];
  PremiereUnits.add(destroyer,tanbris,'passenger','Dark');`);
 assert.equal(run("weaponPlacementOptions('Dark',ion).every(choice=>choice.cost===2)"),true);
 run("destroyer.occupants[0].role='pilot'");
 assert.equal(run("weaponPlacementOptions('Dark',ion).find(choice=>choice.host===destroyer).cost"),1);
 assert.equal(run("weaponPlacementOptions('Dark',ion).find(choice=>choice.host===other).cost"),2);
 const before=run('state.botForce.length');
 assert.equal(run("requestAction('equip','Dark',[0,0,0])&&destroyer.weapons[0]===ion"),true);
 assert.equal(run('state.botForce.length'),before-1);
 run("const black=card('Dark:247');PremiereUnits.add(black,tanbris,'pilot','Dark')");
 assert.equal(run('craftStats(black,0).power-black.power'),2);
 assert.equal(run('craftStats(black,0).maneuver-black.maneuver'),-1);
});

test('R1-G4 modifies capital ships and cannot board fighters',async()=>{
 const {run}=await craftHarness();
 run(`const r1=card('Dark:1989'),destroyer=card('Dark:723'),baseline=craftStats(destroyer,0);
  state.dark[0]=[destroyer];battleSession={site:0,participants:{Light:[],Dark:[destroyer]}};
  PremiereUnits.add(destroyer,r1,'passenger','Dark');`);
 assert.equal(run("PremiereUnits.accepts(scout,card('Dark:2355'),'passenger')&&!PremiereUnits.accepts(scout,r1,'passenger')"),true);
 assert.equal(run("craftStats(destroyer,0).power===baseline.power+1&&craftStats(destroyer,0).hyperspeed===baseline.hyperspeed+1"),true);
 assert.equal(run("battleImmunity('Dark',destroyer)"),3);
 run('r1.gameTextCancelled=true');
 assert.equal(run("battleImmunity('Dark',destroyer)"),0);
});

test('Kal’Falnl can pilot capital ships and move three sites',async()=>{
 const {run}=await craftHarness();
 run(`const kal=card('Light:1407'),corvette=card('Light:530');
  state.locations[5]=card('Light:2462');state.locationOrder=[0,1,2,3,4,5,6];
  state.locations[4]=card('Light:2471');`);
 assert.equal(run(`PremiereUnits.accepts(corvette,kal,'pilot')&&!PremiereUnits.accepts(card('Light:2907'),kal,'pilot')&&
  !PremiereUnits.accepts(card('Light:2161'),kal,'passenger')`),true);
 assert.equal(run("travelOptions(kal,'Light',2,5)[0].kind"),'Landspeed');
 run("PremiereUnits.add(corvette,kal,'pilot','Light')");
 assert.equal(run('craftStats(corvette,0).power-corvette.power'),2);
});

test('Kal’Falnl sets opposite single battle destiny to zero',async()=>{
 const {run}=await craftHarness();
 run(`const kal=card('Light:1407');state.game=PremiereGame.actionState(58,1);state.game.cardRulesVersion=7;
  state.light[2]=[kal];state.dark[2]=[card('Dark:2355')];state.phase=3;
  requestAction('battle','Light',[2]);requestAction('passWeapons','Light');requestAction('passWeapons','Dark');
  Object.assign(battleSession,{lightCard:{name:'draw'},darkCard:{name:'draw'},lightDestiny:4,darkDestiny:3,drawCounts:{Light:1,Dark:1}});
  settlePowerSegment();`);
 assert.equal(run('battleSession.darkDestiny'),0);
 assert.equal(run('battleSession.lightDestiny'),4);
});

test('Traffic Control and Reactor Terminal recycle selected cards only during Control',async()=>{
 const {run}=await craftHarness();
 for(const [id,side,first,second] of [
  ['Light:2625','Light','Light:2052','Light:2040'],['Dark:2029','Dark','Dark:2355','Dark:1279'],
 ]){
  assert.equal(run(`(()=>{
   const cardSide='${side}',opponent=PremiereGame.otherSide(cardSide),own=PremiereGame.zones(state,cardSide);
   const effect=card('${id}'),topFirst=card('${first}'),topSecond=card('${second}');
   setupDecks=null;state.game=PremiereGame.actionState(131,1);state.game.cardRulesVersion=8;
   state.activeSide=cardSide;state.phase=2;state.botTurn=cardSide==='Dark'?{steps:[],index:0}:null;
   own.hand.splice(0,own.hand.length,effect,topFirst,topSecond);
   const before=own.force.length;
   if(!requestAction('deployTableEffect',cardSide,[0])||!state.tableEffects.some(record=>record.card===effect&&record.target===cardSide))return false;
   if(own.force.length!==before-1||requestAction('recycleHand',cardSide,[0]))return false;
   state.phase=1;state.activeSide=opponent;
   if(requestAction('recycleHand',cardSide,[0]))return false;
   state.activeSide=cardSide;
   if(!requestAction('recycleHand',cardSide,[1])||!requestAction('recycleHand',cardSide,[0]))return false;
   return own.force.length===before-1&&own.hand.length===0&&own.used.at(-1)===topFirst&&own.used.at(-2)===topSecond;
  })()`),true);
 }
});

test('Gold 1, Custom TIE and Ubrikkian follow their individual rules',async()=>{
 const {run}=await craftHarness();
 run(`const gold=card('Light:1045'),custom=card('Dark:2700'),ubrikkian=card('Dark:2660'),vader=card('Dark:634');
  const trooper=card('Dark:2355'),darkPilot=card('Dark:1279'),lightPilot=card('Light:2040');
  PremiereUnits.add(gold,lightPilot,'pilot','Light');PremiereUnits.add(gold,card('Light:2052'),'passenger','Light');`);
 assert.equal(run("!PremiereUnits.accepts(gold,lightPilot,'pilot')&&!PremiereUnits.accepts(gold,lightPilot,'passenger')"),true);
 run("battleSession={site:0,participants:{Light:[],Dark:[custom]}};state.dark[0]=[custom];PremiereUnits.add(custom,darkPilot,'pilot','Dark')");
 assert.equal(run("battleImmunity('Dark',custom)"),0);
 run("custom.occupants=[];PremiereUnits.add(custom,vader,'pilot','Dark')");
 assert.equal(run("battleImmunity('Dark',custom)"),4);
 assert.equal(run("!PremiereUnits.accepts(custom,darkPilot,'pilot')&&!PremiereUnits.accepts(custom,trooper,'passenger')"),true);
 run("state.dark[2]=[ubrikkian];PremiereUnits.add(ubrikkian,trooper,'driver','Dark')");
 assert.equal(run("reactOptions('Dark',{kind:'battle',side:'Light',site:3}).some(option=>option.card===ubrikkian&&option.cost===1)"),true);
 assert.equal(run("!PremiereUnits.accepts(ubrikkian,trooper,'driver')&&PremiereUnits.accepts(ubrikkian,trooper,'passenger')"),true);
});

test('Fivedesix taxes opposing droids and friendly mouse droids at the location',async()=>{
 const {run}=await craftHarness();
 run(`const five=card('Dark:12'),mouse=card('Dark:1709'),droid=card('Light:1995'),friendly=card('Dark:2001');
  const base=(droid,slot)=>crewDeployCost(droid,droid.side,state.locations[slot]);
  state.dark[2]=[five];`);
 assert.equal(run('base(mouse,2)-base(mouse,3)'),1);
 assert.equal(run('base(droid,2)-base(droid,3)'),1);
 assert.equal(run('base(friendly,2)-base(friendly,3)'),0);
 run("state.nightSites=[2];battleSession={site:2,participants:{Light:[],Dark:[five]}}");
 assert.equal(run("battleImmunity('Dark',five)"),Infinity);
 run('five.gameTextCancelled=true');
 assert.equal(run('base(mouse,2)-base(mouse,3)'),0);
 assert.equal(run("battleImmunity('Dark',five)"),0);
});

test('Dathcha pays with both Force Piles even when deploying aboard',async()=>{
 const {run}=await craftHarness();
 run(`const crawler=card('Dark:2160'),dathcha=card('Dark:643');state.dark[2]=[crawler];
  state.activeSide='Dark';state.botTurn={steps:[],index:0};state.botHand=[dathcha];state.force=state.force.slice(0,1);
  const deployAboard=()=>legalActions(state,'Dark').find(option=>option.kind==='transport'&&option.args[0]==='deployAboard'&&option.args[5]==='passenger');`);
 assert.equal(run('Boolean(deployAboard())'),false);
 run('state.force.push(...forcePile().slice(0,2));const lightBefore=state.force.length,darkBefore=state.botForce.length');
 assert.equal(run('deployAboard().cost===2&&deployAboard().opponentCost===2&&performAction(deployAboard())'),true);
 assert.equal(run('state.force.length===lightBefore-2&&state.botForce.length===darkBefore-2&&crawler.occupants[0].card===dathcha'),true);
});

test('Dathcha pays a Restricted Deployment surcharge only from the Dark Force Pile',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(262,0);state.game.cardRulesVersion=23;
  const dathcha=card('Dark:643');state.activeSide='Dark';state.botHand=[dathcha];state.hand=[];
  state.tableEffects=[{card:card('Light:2102'),target:'Dark'}];
  state.botForce=state.botForce.slice(0,2);state.force=state.force.slice(0,2);`);
 assert.equal(run("requestAction('deploy','Dark',[0,2])"),false);
 run('state.botForce.push({name:"Restricted Deployment surcharge"})');
 assert.equal(run("requestAction('deploy','Dark',[0,0])"),false);
 assert.ok(run("requestAction('deploy','Dark',[0,2])"));
 assert.equal(run('state.botUsed.length===3&&state.used.length===2&&state.dark[2].includes(dathcha)'),true);
});

test('Death Star Trooper can deploy only on the Death Star',async()=>{
 const {run}=await craftHarness();
 run("const trooper=card('Dark:668');state.locations[3]=card('Dark:673');state.dark[2]=[trooper]");
 assert.equal(run("characterDeployCost(trooper,state.locations[2],'Dark')"),null);
 assert.equal(run("characterDeployCost(trooper,state.locations[3],'Dark')"),run("trooper.deploy"));
 assert.equal(run("cardPowerModifier(trooper,'Dark',2)"),-1);
 assert.equal(run("cardPowerModifier(trooper,'Dark',3)"),0);
});

test('Wuher clears the Cantina and acts only at the start of Control elsewhere',async()=>{
 const {run}=await craftHarness();
 run(`const wuher=card('Dark:2834'),droid=card('Light:1995'),later=card('Light:2000'),blaster=card('Dark:1264');
  const trooper=card('Dark:2355');trooper.weapons=[blaster];
  state.game=PremiereGame.actionState(135,1);state.game.cardRulesVersion=9;
  state.activeSide='Dark';state.botTurn={steps:[],index:0};state.phase=0;
  state.dark[2]=[wuher,trooper];state.light[2]=[droid];`);
 assert.equal(run('changePhase(1);state.lost.includes(droid)&&state.botLost.includes(blaster)'),true);
 run('state.light[2]=[later];findAutomatedWeapons()');
 assert.equal(run('state.light[2].includes(later)'),true);
 run("state.locations[2]=card('Light:2440');findAutomatedWeapons()");
 assert.equal(run('state.lost.includes(later)'),true);
});

test('Gift of the Mentor searches only for a lightsaber',async()=>{
 const {run}=await craftHarness();
 run(`const gift=card('Light:1039'),lightsaber=card('Light:1386'),blaster=card('Light:259');
  state.game=PremiereGame.actionState(82,1);state.game.cardRulesVersion=10;
  state.hand=[gift];state.deck=[blaster,lightsaber,card('Light:1593')];state.activeSide='Dark';
  const before=state.force.length;`);
 assert.equal(run("requestAction('searchReserve','Light',[0])&&state.force.length===before-1"),true);
 assert.equal(run("legalActions(state,'Light').length===1&&legalActions(state,'Light')[0].card===lightsaber"),true);
 assert.equal(run("requestAction('takeFromReserve','Light',[1])"),false);
 assert.equal(run("requestAction('takeFromReserve','Light',[0])&&state.hand.includes(lightsaber)&&state.deck.includes(blaster)&&state.lost.includes(gift)"),true);
});

test('Gift of the Mentor pairs Luke with a mentor',async()=>{
 const {run}=await craftHarness();
 run(`const luke=card('Light:1593'),obi=card('Light:1803'),gift=card('Light:1039'),yoda={...obi,name:'•Yoda'};
  state.game=PremiereGame.actionState(83,1);state.game.cardRulesVersion=10;
  state.light[2]=[luke,obi];state.dark[2]=[card('Dark:2355')];state.hand=[gift];state.phase=3;`);
 assert.equal(run("requestAction('battle','Light',[2])&&battleEffectOptions('Light').some(option=>option.card===gift)"),true);
 run('state.light[2][1]=yoda;refreshBattleParticipants()');
 assert.equal(run("requestAction('battleEffect','Light',[0])&&battleSession.extraDraws.Light===2"),true);
});

test('Named Premiere retrieval and searches work during either turn',async()=>{
 const {run}=await craftHarness();
 for(const [interruptId,targetId,side,cost] of [
  ['Light:1102','Light:1098','Light',1],['Light:1500','Light:1495','Light',1],['Light:1600','Light:1593','Light',1],
  ['Light:2105','Light:1803','Light',1],['Dark:2528','Dark:1061','Dark',2],
 ]){
  assert.equal(run(`(()=>{
   const side='${side}',target=card('${targetId}'),second=card('${targetId}'),wrong=card('Light:2052');
   const own=PremiereGame.zones(state,side);
   state.game=PremiereGame.actionState(81,1);state.game.cardRulesVersion=10;
   state.activeSide=PremiereGame.otherSide(side);state.phase=1;
   own.force.splice(0,own.force.length,...forcePile(),...forcePile());
   own.hand.splice(0,own.hand.length,card('${interruptId}'),card('${interruptId}'));
   own.lost.splice(0,own.lost.length,wrong,target);own.deck.splice(0,own.deck.length,wrong,second);
   if(requestAction('retrieve',side,[0,0]))return false;
   if(!requestAction('retrieve',side,[0,1])||own.used.at(-1)!==target||own.force.length!==10-${cost})return false;
   if(!requestAction('searchReserve',side,[0])||own.force.length!==8-2*${cost})return false;
   if(requestAction('takeFromReserve',side,[1])||!requestAction('takeFromReserve',side,[0]))return false;
   return own.hand.includes(second)&&own.deck.includes(wrong)&&!own.deck.includes(second);
  })()`),true,interruptId);
 }
});

test('Falcon requires an active pilot and its namesake pilots grant immunity',async()=>{
 const {run}=await craftHarness();
 run(`const falcon=card('Light:1677'),han=card('Light:1098');
  state.light[0]=[falcon];battleSession={site:0,participants:{Light:[falcon],Dark:[]}};`);
 assert.equal(run("craftStats(falcon,0).power===0&&craftStats(falcon,0).hyperspeed===0&&PremiereWeapons.defense(falcon,0,craftStats(falcon,0))===0"),true);
 run("PremiereUnits.add(falcon,han,'passenger','Light')");
 assert.equal(run("!craftStats(falcon,0).powered&&battleImmunity('Light',falcon)===0"),true);
 run("falcon.occupants[0].role='pilot'");
 assert.equal(run("craftStats(falcon,0).powered&&battleImmunity('Light',falcon)===5&&PremiereUnits.hasDock(falcon)"),true);
});

test('Stormtrooper Backpack expands weapon use and offers planet-site immunity',async()=>{
 const {run}=await craftHarness();
 run(`const trooper=card('Dark:2355'),pilot=card('Dark:1279'),backpack=card('Dark:2357'),blaster=card('Dark:1264'),rifle=card('Dark:264');
  state.activeSide='Dark';state.botTurn={steps:[],index:0};state.botHand=[backpack];state.dark[2]=[trooper,pilot];`);
 assert.equal(run("deviceHosts('Dark',0).map(option=>option.host.id).join(',')"),'Dark:2355');
 assert.equal(run("requestAction('deployDevice','Dark',[0,2,0])&&trooper.attachments[0]===backpack"),true);
 run("PremiereUnits.recordWeaponUse(state,trooper,blaster);battleSession={site:2,participants:{Light:[],Dark:[trooper]}}");
 assert.equal(run("PremiereUnits.canUseWeapon(state,trooper,rifle)&&battleImmunity('Dark',trooper)===3"),true);
 run('battleSession.site=0;state.dark[2]=[];state.dark[0]=[trooper]');
 assert.equal(run("battleImmunity('Dark',trooper)"),0);
});

test('Limited Resources applies hand size, turn and ship tanks',async()=>{
 const {run,elements}=await craftHarness();
 run(`const limited=card('Dark:1555'),tank=card('Light:997');
  setupDecks=null;state.game=PremiereGame.actionState(93,1);state.game.cardRulesVersion=10;state.activeSide='Dark';
  state.botHand=[limited];state.hand=[ship,card('Light:1593'),card('Light:1373')];`);
 assert.equal(run("requestAction('limitedResources','Dark',[0])"),false);
 run('state.hand.pop();state.activeSide="Light"');
 assert.equal(run("limitedResourcesOptions('Dark')[0].amount"),2);
 run('ship.attachments=[tank];state.light[0]=[ship];state.hand.shift()');
 assert.equal(run("limitedResourcesOptions('Dark').length"),0);
 run('state.activeSide="Dark"');
 assert.equal(run("botBegin();botNextStep()&&state.pendingForceLoss.remaining===2&&state.botLost.includes(limited)"),true);
 run('renderControlPanel()');
 assert.match(elements.get('controlPanel').innerHTML,/Limited Resources/);
});

test('Defending battle interrupts distinguish lone characters and printed modes',async()=>{
 for(const [interruptId,defenderId,side,expected] of [
  ['Dark:1691','Dark:1061','Dark',[2]],['Dark:1691','Dark:741','Dark',[1]],
  ['Light:2297','Light:1098','Light',[2]],['Light:2297','Light:305','Light',[1]],
  ['Light:2740','Light:1495','Light',[1,2]],
 ]){
  const {run}=await craftHarness();
  run(`const side='${side}',opponent=PremiereGame.otherSide(side),defender=card('${defenderId}'),interrupt=card('${interruptId}'),
   own=PremiereGame.zones(state,side),other=PremiereGame.zones(state,opponent);
   setupDecks=null;state.game=PremiereGame.actionState(91,1);state.game.cardRulesVersion=11;
   state.phase=3;state.activeSide=opponent;state.botTurn=opponent==='Dark'?{steps:[],index:0}:null;
   own.board[2]=[defender];other.board[2]=[card(opponent==='Dark'?'Dark:2355':'Light:2052')];
   own.hand.splice(0,own.hand.length,interrupt);other.hand.splice(0);
   requestAction('battle',opponent,[2]);requestAction('passWeapons',opponent);
   const draws=()=>legalActions(state,side).filter(action=>action.kind==='battleEffect').map(option=>option.args[1]);`);
  assert.deepEqual(JSON.parse(run('JSON.stringify(draws())')),expected,interruptId+' '+defenderId);
  run("const droid=card('Light:1995');own.board[2].push(droid);refreshBattleParticipants()");
  assert.equal(run('draws().length'),0,'a droid is also a participating character');
  run('own.board[2].pop();refreshBattleParticipants()');
  assert.equal(run(`requestAction('battleEffect',side,[0,${expected.at(-1)}])&&battleSession.extraDraws[side]===${expected.at(-1)}`),true);
 }
});

test('Premiere squadron leaders raise only other matching pilots’ forfeit',async()=>{
 const {run}=await craftHarness();
 run(`const dutch=card('Light:799'),pops=card('Light:1924'),leader=card('Light:2067'),biggs=card('Light:239'),pilot=card('Light:2040'),
  red=card('Light:2057');state.light[0]=[dutch,pops,leader,biggs,pilot,red];battleSession={site:0};`);
 assert.equal(run("battleForfeitValue(dutch,'Light')-dutch.forfeit"),0);
 assert.equal(run("battleForfeitValue(leader,'Light')-leader.forfeit"),0);
 assert.equal(run("battleForfeitValue(pops,'Light')-pops.forfeit"),1);
 assert.equal(run("battleForfeitValue(biggs,'Light')-biggs.forfeit"),1);
 assert.equal(run("battleForfeitValue(pilot,'Light')-pilot.forfeit"),0);
 run("state.light[0].splice(state.light[0].indexOf(pilot),1);PremiereUnits.add(red,pilot,'pilot','Light')");
 assert.equal(run("battleForfeitValue(pilot,'Light')-pilot.forfeit"),1);
 run('leader.gameTextCancelled=true');
 assert.equal(run("battleForfeitValue(pilot,'Light')-pilot.forfeit"),0);
});

test('Motti discounts his deploy and reduces Rebel pilot forfeit at the system',async()=>{
 const {run}=await craftHarness();
 run(`const motti=card('Dark:60'),destroyer=card('Dark:723'),other=card('Dark:1291'),pilot=card('Light:2040'),rebel=card('Light:2052'),
  corvette=card('Light:530');battleSession={site:0};`);
 assert.equal(run("crewDeployCost(motti,'Dark',state.locations[2])"),run('motti.deploy'));
 run("state.dark[0]=[destroyer];state.dark[1]=[other];PremiereUnits.add(destroyer,motti,'pilot','Dark')");
 assert.equal(run("crewDeployCost(motti,'Dark',state.locations[2])"),run('motti.deploy-2'));
 assert.equal(run('craftStats(destroyer,0).power-destroyer.power'),2);
 run("state.light[0]=[corvette];PremiereUnits.add(corvette,pilot,'pilot','Light');PremiereUnits.add(corvette,rebel,'passenger','Light')");
 assert.equal(run("battleForfeitValue(pilot,'Light')-pilot.forfeit"),-1);
 assert.equal(run("battleForfeitValue(rebel,'Light')-rebel.forfeit"),0);
 run("state.dark[1].push(state.dark[0].pop())");
 assert.equal(run("battleForfeitValue(pilot,'Light')-pilot.forfeit"),0);
});

test('Jedi Presence doubles only other matching participants',async()=>{
 for(const [side,cardId,jediId,factionId,enemyId] of [
  ['Light','Light:1389','Light:1803','Light:2052','Dark:2355'],
  ['Dark','Dark:621','Dark:634','Dark:2355','Light:2052'],
 ]){
  const {run}=await craftHarness();
  run(`const side='${side}',opponent=PremiereGame.otherSide(side),jedi=card('${jediId}'),faction=card('${factionId}'),
   interrupt=card('${cardId}'),own=PremiereGame.zones(state,side),other=PremiereGame.zones(state,opponent);
   setupDecks=null;state.game=PremiereGame.actionState(131,1);state.game.cardRulesVersion=12;state.activeSide=side;state.phase=3;
   state.botTurn=side==='Dark'?{steps:[],index:0}:null;
   own.board[2]=[jedi,faction];other.board[2]=[card('${enemyId}')];own.hand.splice(0,own.hand.length,interrupt);other.hand.splice(0);
   const total=()=>battleTotals(2)[side.toLowerCase()+'Power'];`);
  assert.equal(run("requestAction('battle',side,[2])"),true);
  assert.equal(run("requestAction('battleEffect',side,[0,null,1])"),false);
  const before=run('total()'),force=run('own.force.length');
  assert.equal(run("requestAction('battleEffect',side,[0,null,0])"),true);
  assert.equal(run('own.force.length'),force-1);
  assert.equal(run('total()-faction.power'),before);
  assert.equal(run('battleSession.doubledPowerCards.has(jedi)'),false);
  run('own.board[2].pop()');
  assert.equal(run('total()'),run('jedi.power'));
 }
});

test('Lone warrior and pilot interrupts distinguish sites, space and additional power',async()=>{
 for(const [id,side,defenderId,carrierId,location,choice,expectedPower,expectedDestiny] of [
  ['Dark:1578','Dark','Dark:1027',null,2,[0,2],0,2],
  ['Light:1455','Light','Light:1803',null,2,[0,1,null,1],1,1],
  ['Dark:2701','Dark','Dark:634',null,2,[0,1,null,1],1,1],
  ['Light:994','Light','Light:1593','Light:2060',0,[0,1,null,1],1,1],
  ['Dark:1576','Dark','Dark:60','Dark:247',0,[0,2],0,2],
  ['Light:994','Light','Light:2838',null,0,[0,1],0,1],
  ['Dark:1576','Dark','Dark:2600',null,0,[0,1],0,1],
 ]){
  const {run}=await craftHarness();
  run(`const side='${side}',opponent=PremiereGame.otherSide(side),slot=${location},defender=card('${defenderId}'),interrupt=card('${id}'),
   own=PremiereGame.zones(state,side),other=PremiereGame.zones(state,opponent);
   const fighterId=${JSON.stringify(carrierId)},fighter=fighterId?card(fighterId):null;
   if(fighter)PremiereUnits.add(fighter,defender,'pilot',side);
   const opponentCard=slot===0?(opponent==='Dark'?'Dark:2600':'Light:2838'):(opponent==='Dark'?'Dark:2355':'Light:2052');
   own.board[slot]=[fighter??defender];other.board[slot]=[card(opponentCard)];
   own.hand.splice(0,own.hand.length,interrupt);other.hand.splice(0);
   setupDecks=null;state.game=PremiereGame.actionState(133,1);state.game.cardRulesVersion=12;
   state.activeSide=opponent;state.phase=3;state.botTurn=opponent==='Dark'?{steps:[],index:0}:null;
   requestAction('battle',opponent,[slot]);requestAction('passWeapons',opponent);
   const total=()=>battleTotals(slot)[side.toLowerCase()+'Power'];`);
  const before=run('total()');
  assert.equal(run("requestAction('battleEffect',side,[0,3])"),false,id);
  assert.equal(run(`requestAction('battleEffect',side,${JSON.stringify(choice)})`),true,id);
  assert.equal(run('battleSession.extraDraws[side]'),expectedDestiny,id);
  assert.equal(run('total()')-before,expectedPower,id);
 }
});

test('Paired combat interrupts check opposing ability and the named opponent',async()=>{
 for(const [interruptId,ownId,ordinaryId,specialId,rejectedId,side] of [
  ['Dark:391','Dark:1061','Light:1098','Light:1495','Light:2052','Dark'],
  ['Light:2531','Light:1593','Dark:60','Dark:634','Dark:2355','Light'],
  ['Dark:1215','Dark:634','Light:1098','Light:1593','Light:2052','Dark']
 ]){
  const {run}=await craftHarness();
  run(`const side='${side}',opponent=PremiereGame.otherSide(side),unit=card('${ownId}'),interrupt=card('${interruptId}'),
   own=PremiereGame.zones(state,side),other=PremiereGame.zones(state,opponent),draw=()=>battleEffectOptions(side)[0]?.draws;
   setupDecks=null;state.game=PremiereGame.actionState(92,1);state.game.cardRulesVersion=13;
   state.phase=3;state.activeSide=side;state.botTurn=side==='Dark'?{steps:[],index:0}:null;
   const guard=card('${rejectedId}');guard.weapons=[card(opponent==='Dark'?'Dark:1264':'Light:259')];
   own.board[2]=[unit];other.board[2]=[guard];
   own.hand.splice(0,own.hand.length,interrupt);other.hand.splice(0);
   requestAction('battle',side,[2]);`);
  assert.equal(run('draw()'),undefined);
  run(`other.board[2]=[card('${ordinaryId}')];refreshBattleParticipants()`);
  assert.equal(run('draw()'),1,interruptId);
  run(`other.board[2]=[card('${specialId}')];refreshBattleParticipants()`);
  assert.equal(run('draw()'),2);
  assert.equal(run("requestAction('battleEffect',side,[0,1,0])"),false);
  assert.equal(run("requestAction('battleEffect',side,[0,2,0])&&battleSession.extraDraws[side]===2"),true);
 }
});

test('Out of Nowhere responds only to an opposing space battle',async()=>{
 const {run}=await craftHarness();
 run(`const fighter=card('Light:2838'),enemy=card('Dark:2600'),interrupt=card('Light:1874');
  setupDecks=null;state.game=PremiereGame.actionState(45,1);state.game.cardRulesVersion=13;
  state.activeSide='Dark';state.botTurn={steps:[],index:0};state.phase=3;state.light[0]=[fighter];state.dark[0]=[enemy];
  state.hand=[interrupt];state.botHand=[];
  const opening={kind:'battle',site:0,side:'Dark'};`);
 assert.equal(run("interruptResponses('Light',{...opening,site:2}).length"),0);
 assert.equal(run("fighter.maneuver=3;interruptResponses('Light',opening).length"),0);
 run('fighter.maneuver=4');
 assert.equal(run("requestAction('battle','Dark',[0])&&requestAction('interruptResponse','Light',[0])"),true);
 assert.equal(run("requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
 assert.equal(run("battleSession.extraDraws.Light===1&&state.used.includes(interrupt)"),true);
});

test('Han’s Dice replaces a battle destiny after the response window',async()=>{
 const {run}=await craftHarness();
 run(`const obi=card('Light:1803'),dice=card('Light:1104'),original={name:'Erster Zug',destiny:1},second={name:'Ersatz',destiny:5};
  setupDecks=null;state.game=PremiereGame.actionState(46,1);state.game.cardRulesVersion=13;
  state.light[2]=[obi];state.dark[2]=[card('Dark:2355')];state.hand=[dice];state.botHand=[];state.deck=[second,original];state.phase=3;
  requestAction('battle','Light',[2]);requestAction('destiny','Light');requestAction('passResponse','Dark');`);
 assert.equal(run("requestAction('destinyResponse','Light',['hansDice',0])"),true);
 assert.equal(run("PremiereGame.responseWindow(state.game).interrupt"),'hansDice');
 assert.equal(run(`requestAction('passResponse','Dark')&&requestAction('passResponse','Light')&&
  requestAction('passResponse','Dark')&&requestAction('passResponse','Light')`),true);
 assert.equal(run('battleSession.lightDestiny===5&&battleSession.drawCounts.Light===1&&state.used.includes(original)&&state.used.includes(dice)'),true);
});

test('Takeel swaps individual draws and leaves the total modifiers in place',async()=>{
 const {run}=await craftHarness();
 run(`const takeel=card('Dark:2406');
  setupDecks=null;state.game=PremiereGame.actionState(47,1);state.game.cardRulesVersion=13;state.phase=3;
  state.light[2]=[card('Light:1803')];state.dark[2]=[{...card('Dark:2355'),ability:4}];
  state.hand=[];state.botHand=[takeel];state.deck.push({name:'Light Destiny',destiny:5});state.botDeck.push({name:'Dark Destiny',destiny:1});
  requestAction('battle','Light',[2]);battleSession.lightBonus=2;battleSession.darkBonus=3;
  requestAction('destiny','Light');requestAction('destiny','Dark');`);
 assert.equal(run("PremiereGame.responseWindow(state.game).kind"),'battleDestinyResults');
 assert.equal(run("requestAction('passResponse','Light')&&requestAction('interruptResponse','Dark',[0])"),true);
 assert.equal(run("requestAction('passResponse','Light')&&requestAction('passResponse','Dark')"),true);
 assert.equal(run("battleSession.lightDestiny===1&&battleSession.darkDestiny===5&&battleSession.lightBonus===2&&battleSession.darkBonus===3&&state.botLost.includes(takeel)"),true);
 assert.equal(run("requestAction('passResponse','Light')&&requestAction('passResponse','Dark')&&battleSession.segment==='damage'"),true);
});

test('Trooper Charge targets a trooper and makes its forfeit mandatory',async()=>{
 const {run}=await craftHarness();
 run(`const trooper=card('Dark:668'),motti=card('Dark:60'),charge=card('Dark:2634');
  setupDecks=null;state.game=PremiereGame.actionState(48,1);state.game.cardRulesVersion=13;state.phase=3;
  state.locations[2]=card('Dark:673');state.light[2]=[card('Light:2052')];state.dark[2]=[trooper,motti];
  state.activeSide='Dark';state.botTurn={steps:[],index:0};state.hand=[];state.botHand=[charge];
  requestAction('battle','Dark',[2]);const before=battleTotals(2).darkPower;`);
 assert.equal(run("requestAction('battleEffect','Dark',[0,'charge',1])"),false);
 assert.equal(run("requestAction('battleEffect','Dark',[0,'charge',0])&&battleTotals(2).darkPower===before+3"),true);
 assert.equal(run("requestAction('passWeapons','Light')&&requestAction('passWeapons','Dark')&&requestAction('skipDestiny','Dark')&&requestAction('skipDestiny','Light')"),true);
 assert.equal(run("requestAction('passDamage','Dark')"),false);
 assert.equal(run("botDamageAction().card===trooper&&performAction(botDamageAction())&&state.botLost.includes(trooper)"),true);
});

test('both Premiere Restraining Bolts block boarding moves and transfer for free',async()=>{
 const {run}=await craftHarness();
 run(`const lightBolt=card('Light:2100'),darkBolt=card('Dark:2099'),droid=card('Light:2000'),other=card('Dark:2001');
  const landspeeder=card('Light:1609');PremiereUnits.add(landspeeder,droid,'passenger','Light');
  state.light[2]=[landspeeder];state.dark[2]=[other];state.hand=[lightBolt];`);
 const light=run("legalActions(state,'Light').find(action=>action.kind==='deployBolt'&&action.host===droid).args");
 assert.equal(run(`requestAction('deployBolt','Light',${JSON.stringify(light)})`),true);
 assert.equal(run("transportOptions('Light').some(option=>option.card===droid)"),false);
 assert.equal(run("performAction(legalActions(state,'Light').find(option=>option.kind==='deviceAction'&&option.args[0]==='transferBolt'))"),true);
 run("state.activeSide='Dark';state.botHand=[darkBolt];state.botTurn={steps:[],index:0}");
 assert.equal(run("performAction(legalActions(state,'Dark').find(action=>action.kind==='deployBolt'&&action.host===droid))"),true);
 assert.equal(run("PremiereUnits.restrainingBolt(droid)===darkBolt&&PremiereUnits.restrainingBolt(other)===lightBolt"),true);
});

test('registered Premiere locations apply their printed sides and exceptions',async()=>{
 const {run}=await craftHarness();
 run(`const jawa=card('Light:1373'),spy=card('Dark:1011');
  state.locations[2]=card('Light:2440');state.light[2]=[jawa];state.dark[2]=[tusken,spy];battleSession={site:2};`);
 assert.equal(run("cardPowerModifier(jawa,'Light',2)"),1);
 assert.equal(run("battleForfeitValue(spy,'Dark')"),run('spy.forfeit+1'));
 assert.equal(run("battleForfeitValue(tusken,'Dark')"),run('tusken.forfeit'));
 run("state.locations[2]=card('Dark:2439')");
 assert.equal(run("cardPowerModifier(spy,'Dark',2)"),1);
 assert.equal(run("cardPowerModifier(tusken,'Dark',2)"),0);
 assert.equal(run("battleForfeitValue(jawa,'Light')"),run('jawa.forfeit+1'));
 run("state.locations[2]=card('Dark:2454')");
 assert.equal(run("cardPowerModifier(jawa,'Light',2)"),-1);
 assert.equal(run("battleForfeitValue(jawa,'Light')"),run('jawa.forfeit-1'));
 run("const rebel=card('Light:2052');state.light[2].push(rebel);state.locations[2]=card('Dark:2465');state.locations[4]=card('Dark:682');state.dark[4]=[card('Dark:1027')]");
 assert.equal(run("cardPowerModifier(spy,'Dark',2)"),1);
 assert.equal(run("battleForfeitValue(spy,'Dark')"),run('spy.forfeit+1'));
 assert.equal(run("battleForfeitValue(rebel,'Light')"),run('rebel.forfeit-1'));
 run("state.light[4]=[card('Light:1593')]");
 assert.equal(run("battleForfeitValue(rebel,'Light')"),run('rebel.forfeit'));
});

test('registered fleet power counts only ships at a controlled related system',async()=>{
 const {run}=await craftHarness();
 run("state.light[6]=[ship,card('Light:2907')];state.light[2]=[card('Light:2052')]");
 assert.equal(run('battleTotals(2).lightPower'),3);
 assert.equal(run('fleetPowerAtSite("Light",6)'),0);
 run('state.dark[6]=[tie]');
 assert.equal(run('battleTotals(2).lightPower'),1);
 assert.equal(run('fleetPowerAtSite("Dark",2)'),0);
});

test('registered location text follows printed sides even after Revolution',async()=>{
 const {run}=await craftHarness();
 run(`const locationRules=side=>PremiereLocations.conditions(state,2,side);
  state.locations[2]=card('Dark:675');`);
 assert.equal(run("locationRules('Dark').transitCost"),0);
 assert.equal(run("locationRules('Light').transitCost"),2);
 run(`state.locationEffects={2:[{card:card('Light:2110')}]};
  state.locations[3]=card('Light:2462');state.locations[4]=card('Light:680');`);
 assert.equal(run("locationRules('Dark').transitCost"),2);
 assert.equal(run("locationRules('Light').transitCost"),0);
 assert.equal(run("PremiereLocations.ruleAt(state,3,'Dark','weaponDestiny').amount"),1);
 assert.equal(run("PremiereLocations.ruleAt(state,3,'Light','weaponDestiny')"),undefined);
 assert.equal(run("hasDeployPresence('Light',state.locations[4])"),true);
 assert.equal(run("hasDeployPresence('Dark',state.locations[4])"),false);
 assert.equal(run("characterDeployCost(card('Light:1593'),state.locations[3],'Light')"),2);
 assert.equal(run("characterDeployCost(card('Light:1021'),state.locations[3],'Light')"),3);
});

test('Central Core waives Wrong Turn only for its controlling side and the tax applies to warriors',async()=>{
 const {run,elements}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(130,1);
  const core=card('Dark:669'),wrongTurn=card('Dark:2833'),trooper=card('Light:2052'),droid=card('Light:2');
  state.activeSide='Dark';state.botTurn={steps:[],index:0};state.locations[4]=core;
  state.botHand=[wrongTurn,card('Dark:2833')];state.botForce=[];`);
 assert.equal(run("requestAction('deployTableEffect','Dark',[0])"),false);
 run("state.botForce=forcePile()");
 assert.equal(run("legalActions(state,'Dark').find(action=>action.kind==='deployTableEffect').cost"),3);
 run("state.dark[4]=[card('Dark:2355')];state.light[4]=[card('Light:1593')]");
 assert.equal(run("legalActions(state,'Dark').find(action=>action.kind==='deployTableEffect').cost"),3);
 run("state.light[4]=[]");
 assert.equal(run("legalActions(state,'Dark').find(action=>action.kind==='deployTableEffect').cost"),0);
 assert.equal(run("requestAction('deployTableEffect','Dark',[0])&&state.botForce.length===5&&state.botUsed.length===0"),true);
 assert.match(elements.get('botEffects').innerHTML,/Wrong Turn/);
 assert.equal(run("requestAction('deployTableEffect','Dark',[0])"),false);
 assert.equal(run("boardDeployCost(trooper,dock,'Light')"),2);
 assert.equal(run("boardDeployCost(droid,dock,'Light')"),2);
 run("state.light[2]=[card('Light:1593')]");
 assert.equal(run("boardDeployCost(trooper,dock,'Light')"),0);
});

test('Skywalkers cancels Wrong Turn on table and during deployment as a Lost Interrupt',async()=>{
 for(const pending of [false,true]){
  const {run}=await craftHarness();
  run(`setupDecks=null;state.game=PremiereGame.actionState(131,1);
   const wrongTurn=card('Dark:2833'),skywalkers=card('Light:2277');
   state.activeSide='Dark';state.botTurn={steps:[],index:0};state.botHand=[wrongTurn];
   state.tableEffects=[];state.hand=${pending}?[skywalkers]:[];`);
  assert.equal(run("requestAction('deployTableEffect','Dark',[0])"),true);
  if(pending)assert.equal(run("requestAction('interruptResponse','Light',[0])"),true);
  else{
   run("state.hand=[skywalkers]");
   assert.equal(run("requestAction('cancelTableEffect','Light',[0,0])"),true);
  }
  assert.equal(run("requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
  assert.equal(run("state.tableEffects.length===0&&state.botLost.includes(wrongTurn)&&state.lost.includes(skywalkers)"),true);
  assert.equal(run("state.botUsed.length"),3);
 }
});

test('Detention Block releases only imprisoned characters on the Death Star after gaining control',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(132,1);state.phase=4;
  state.locations[2]=card('Light:672');state.locations[3]=card('Dark:673');state.locations[4]=card('Dark:682');
  state.locationOrder=[0,1,4,2,3,5,6];
  const prisoner={...card('Light:1495'),captured:true,imprisoned:true};
  const escorted={...card('Light:221'),captured:true},elsewhere={...card('Light:1098'),captured:true,imprisoned:true};
  state.dark[3]=[prisoner,escorted];state.dark[5]=[elsewhere];state.light[4]=[card('Light:1593')];
  state.dark[2]=[card('Dark:2355')];`);
 assert.equal(run("requestAction('move','Light',[4,0,2,'Landspeed'])"),true);
 assert.equal(run("state.dark[3].includes(prisoner)&&prisoner.captured"),true);
 run("state.activeSide='Dark';state.botTurn={steps:[],index:0}");
 assert.equal(run("requestAction('move','Dark',[2,0,3,'Landspeed'])"),true);
 assert.equal(run("state.light[3].includes(prisoner)&&!prisoner.captured&&!prisoner.imprisoned"),true);
 assert.equal(run("state.dark[3].includes(escorted)&&escorted.captured&&state.dark[5].includes(elsewhere)&&elsewhere.captured"),true);
});

async function captureHarness(destiny,atPrison=false){
 const fixture=await craftHarness(),{run}=fixture;
 run(`setupDecks=null;state.game=PremiereGame.actionState(134,1);state.game.cardRulesVersion=6;state.game.botStrategyVersion=1;
  state.activeSide='Dark';state.botTurn={steps:[],index:0};state.locationOrder=[0,1,2,3,4,5,6];
  state.locations[2]=card('Dark:682');state.locations[3]=card('Dark:673');state.locations[4]=card('Light:672');
  const captureSite=${atPrison?3:2},hunter=card('Dark:741'),trooper=card('Dark:2355');
  const prisoner=card('Light:1495'),blaster=card('Light:1503'),snare={...supplementalCatalog[0]};
  prisoner.weapons=[blaster];state.light[captureSite]=[prisoner];state.dark[captureSite]=[hunter,trooper];
  state.botHand=[snare];state.botDeck=[{name:'Waffen-Destiny',destiny:${destiny}}];
  const dark=(kind,args=[])=>requestAction(kind,'Dark',args);
  const light=(kind,args=[])=>requestAction(kind,'Light',args);
  const custody=kind=>legalActions(state,'Dark').find(option=>option.kind==='custody'&&option.args[0]===kind);
  const transfer=kind=>legalActions(state,'Dark').find(option=>option.kind==='prisonerTransfer'&&option.args[0]===kind);
  const shot=()=>legalActions(state,'Dark').find(option=>option.kind==='fireWeapon'&&option.target===prisoner);`);
 return fixture;
}

test('the bot uses printed capture rules, then escorts, imprisons and transfers a captive for free',async()=>{
 const {run,elements}=await captureHarness(6);
 assert.equal(run("dark('equip',[0,captureSite,1])"),false,'a regular Stormtrooper cannot equip the rifle');
 assert.equal(run("dark('equip',[0,captureSite,0])&&hunter.weapons[0]===snare&&state.botForce.length===4"),true);
 run('state.phase=3;');
 assert.equal(run("dark('battle',[captureSite])&&shot().cost===2&&shot().bonus===-1"),true);
 assert.equal(run("botWeaponAction().effect==='capture'&&performAction(botWeaponAction())"),true);
 assert.equal(run('state.botForce.length===1&&state.pendingCustody[0].card===prisoner&&prisoner.captured'),true);
 assert.equal(run("!!custody('imprison')||light('passWeapons')"),false,'must decide immediately, at a location without prison');
 assert.match(elements.get('battleDetails').innerHTML,/Gefangenenentscheidung des Bots zeigen/);
 assert.equal(run("performAction(botCustodyAction())&&hunter.escortedCaptive===prisoner&&battleSession===null"),true);
 assert.equal(run("withinDeploymentLimit(card('Light:1495'),'Light')||withinDeploymentLimit(card('Light:1503'),'Light')"),false);
 assert.equal(run("cardAbility(hunter)>0&&PremiereLocations.findEntry(state,prisoner).unavailable"),true);
 assert.match(elements.get('board').innerHTML,/Eskorte · •Leia Organa/);
 assert.equal(run("Boolean(transfer('deliver'))"),false,'only in the Dark Move phase');
 run('state.phase=4;');
 assert.equal(run("Boolean(transfer('deliver'))"),false,'only at the prison');
 assert.equal(run("botMove()&&state.botForce.length===0&&PremiereLocations.findEntry(state,prisoner).slot===3"),true);
 assert.equal(run("botMove()&&!hunter.escortedCaptive&&state.dark[3].includes(prisoner)&&prisoner.imprisoned"),true);
 assert.match(elements.get('board').innerHTML,/Inhaftiert/);
 assert.equal(run("performAction(transfer('take'))&&hunter.escortedCaptive===prisoner&&!prisoner.imprisoned"),true);
 assert.equal(run("performAction(transfer('deliver'))&&state.botForce.length===0"),true);
 run("state.dark[3]=[prisoner];state.light[3]=[card('Light:1593')];state.activeSide='Light';state.botTurn=null");
 assert.equal(run("PremiereLocations.control(state,'Light',3,cardAbility)"),true);
 assert.equal(run("state.dark[3].includes(prisoner)"),true);
 assert.equal(run("light('move',[3,0,4,'Landspeed'])"),true);
 assert.equal(run("state.light[3].includes(prisoner)&&prisoner.weapons[0]===blaster&&!prisoner.captured&&!prisoner.imprisoned"),true);
 assert.equal(run("state.lost.includes(prisoner)||state.used.includes(prisoner)"),false);
});

test('failed snares leave the target active, and successful snares can imprison it immediately at the prison',async()=>{
 const failed=await captureHarness(4);
 assert.equal(failed.run("dark('equip',[0,captureSite,0]);state.phase=3;dark('battle',[captureSite]);performAction(shot())"),true);
 assert.equal(failed.run("state.light[captureSite].includes(prisoner)&&!state.pendingCustody&&!prisoner.captured"),true);
 const prison=await captureHarness(4,true);
 assert.equal(prison.run("dark('equip',[0,captureSite,0]);state.phase=3;dark('battle',[captureSite]);performAction(shot())"),true);
 assert.equal(prison.run("botCustodyAction().args[0]"),'imprison','Corridor adds 1 to Dark weapon destiny');
 assert.equal(prison.run("performAction(botCustodyAction())&&prisoner.imprisoned&&state.dark[captureSite].includes(prisoner)"),true);
});

test('a captive needs an extra passenger seat, and removing the escort gives Light a Rally or Escape choice',async()=>{
 const {run,elements}=await captureHarness(6);
 run("dark('equip',[0,captureSite,0]);state.phase=3;dark('battle',[captureSite]);performAction(shot());performAction(botCustodyAction())");
 assert.equal(run("PremiereUnits.accepts(card('Dark:1547'),hunter,'passenger')"),true);
 assert.equal(run("PremiereUnits.accepts({...card('Dark:1547'),occupants:[1,2,3].map(()=>({card:trooper,role:'passenger'}))},hunter,'passenger')"),false);
 assert.equal(run("loseTableCard('Dark',captureSite,hunter)&&state.pendingCustody[0].side==='Light'"),true);
 run('render()');
 assert.match(elements.get('playerCustodyControls').innerHTML,/Rally/);
 assert.equal(run("dark('custody',['escape'])"),false);
 assert.equal(run("light('custody',['escape'])&&state.used.includes(prisoner)&&state.lost.includes(blaster)&&!prisoner.captured"),true);
 run(`const transport=card('Dark:1547'),second=card('Light:1593');
  second.captured=true;trooper.escortedCaptive=second;
  state.dark[captureSite]=[transport];PremiereUnits.add(transport,trooper,'passenger','Dark');`);
 assert.equal(run("loseTableCard('Dark',captureSite,transport)&&state.lost.includes(second)&&!state.pendingCustody.length"),true);
});

test('Central Core cancels the Tractor Beam when Light gains control',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(133,1);state.phase=4;
  state.locations[2]=card('Dark:669');state.locations[3]=card('Dark:675');state.locationOrder=[0,1,2,3,4,5,6];
  const beam={name:'Death Star Tractor Beam',type:'Device',side:'Dark'};
  state.locationEffects={3:[{card:beam}]};state.light[3]=[card('Light:1593')];`);
 assert.equal(run("state.locationEffects[3].length"),1);
 assert.equal(run("requestAction('move','Light',[3,0,2,'Landspeed'])"),true);
 assert.equal(run("state.locationEffects[3].length===0&&state.botLost.includes(beam)"),true);
});

test('Mos Eisley applies one bonus to the Tonnika Sisters as a combo card',async()=>{
 const {run}=await craftHarness();
 run(`const sisters=card('Dark:2613');state.locations[2]=card('Dark:2465');state.dark[2]=[sisters];battleSession={site:2};`);
 assert.equal(run("cardPowerModifier(sisters,'Dark',2)"),1);
 assert.equal(run("battleForfeitValue(sisters,'Dark')"),run('sisters.forfeit+1'));
 run("state.locationEffects={2:[{card:card('Light:2110')}]};");
 assert.equal(run("cardPowerModifier(sisters,'Dark',2)"),0);
 assert.equal(run("battleForfeitValue(sisters,'Dark')"),run('sisters.forfeit'));
});

test('Massassi Throne Room starts the Light turn only when chosen under the new rules',async()=>{
 const {run,elements}=await premiereHarness();
 run(`const decks={light:deckChoices.light.find(({deck})=>deck.theme?.id==='massassi-widerstand').deck,dark:starterDecks.dark};
  function setupLocation(id,version){
   start(7,true,false,decks,version);
   const index=startingLocationChoices(setupDecks.light).find(option=>option.card.id===id).index;
   return chooseStart(index)&&beginStartingGame();
  }`);
 assert.equal(run("setupLocation('Light:2858',4)"),true);
 assert.equal(run("state.activeSide==='Light'&&!state.botTurn&&state.hand.length===8&&state.botHand.length===8"),true);
 assert.match(elements.get('log').textContent,/Light Side beginnt/);
 assert.equal(run("requestAction('activate','Light',[1])"),true);
 assert.equal(run("setupLocation('Light:2858',3)"),true);
 assert.equal(run("state.activeSide==='Dark'&&!!state.botTurn"),true);
 assert.equal(run("setupLocation('Light:2859',4)"),true);
 assert.equal(run("state.activeSide==='Dark'&&!!state.botTurn"),true);
});

test('Jungle bonuses require an active character alone at the site',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(124,1);
  const rebel=card('Light:2052'),trooper=card('Dark:2355'),droid=card('Light:2'),speeder=card('Light:2307');
  state.locations[2]=card('Light:2855');state.light[2]=[rebel,speeder];state.dark[2]=[trooper];`);
 assert.equal(run("battleTotals(2).lightPower===rebel.power+2"),true);
 assert.equal(run("battleTotals(2).darkPower===trooper.power"),true);
 run("PremiereUnits.add(speeder,droid,'passenger','Light');speeder.enclosed=true");
 assert.equal(run("battleTotals(2).lightPower===rebel.power"),true);
 run("droid.inactive=true;state.phase=3");
 assert.equal(run("requestAction('battle','Light',[2])&&battleImmunity('Light',rebel)===Infinity"),true);
 run("battleSession=null;state.locations[2]=card('Dark:2854')");
 assert.equal(run("battleTotals(2).darkPower===trooper.power+2"),true);
 assert.equal(run("battleTotals(2).lightPower===rebel.power"),true);
});

test('starships react to the printed side of Dantooine with an affordable legal route',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(125,1);
  state.locations[0]=card('Dark:607');state.dark[6]=[scout];state.light[0]=[card('Light:2907')];
  state.phase=1;const drain={kind:'drain',side:'Light',site:0};`);
 assert.equal(run("reactOptions('Dark',drain).some(choice=>choice.card===scout&&choice.cost===1)"),true);
 run("state.locationEffects={0:[{card:card('Light:2110')}]};");
 assert.equal(run("reactOptions('Dark',drain).length"),0);
});

test('a character moving from Mos Eisley to the Cantina cannot participate in a second drain that turn',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(126,1);
  const luke=card('Light:1593'),rebel=card('Light:2052');
  state.locations[2]=card('Light:2466');state.light[2]=[luke];state.light[4]=[rebel];
  state.phase=1;state.botHand=[];state.botDeck=forcePile();`);
 assert.equal(run("requestAction('drain','Light',[2])"),true);
 assert.equal(run("state.drainedCardsThisTurn.includes(luke)&&forceDrainValue('Light',4)===2"),true);
 assert.equal(run("requestAction('move','Light',[2,0,4,'Mos Eisley'])"),true);
 assert.equal(run("confirmedPresence('Light',4)&&forceDrainValue('Light',4)===null"),true);
 assert.equal(run("requestAction('drain','Light',[4])"),false);
 run("PremiereGame.resetTurn(state,'Light');state.phase=1");
 assert.equal(run("forceDrainValue('Light',4)"),2);
});

test('Vader and Tarkin apply their printed pilot bonuses',async()=>{
 const {run}=await craftHarness();
 run(`const vader=card('Dark:634'),tarkin=card('Dark:1061'),custom=card('Dark:2700'),destroyer=card('Dark:1291');
  const customPower=custom.power,customManeuver=custom.maneuver;PremiereUnits.add(custom,vader,'pilot','Dark');
  PremiereUnits.add(destroyer,tarkin,'pilot','Dark');`);
 assert.equal(run('craftStats(custom,1).power'),run('customPower+4'));
 assert.equal(run('craftStats(custom,1).maneuver'),run('customManeuver+3'));
 assert.equal(run('craftStats(destroyer,1).power'),run('destroyer.power+2'));
 run("custom.occupants=[];PremiereUnits.add(destroyer,vader,'pilot','Dark')");
 assert.equal(run('craftStats(custom,1).powered'),false);
 assert.equal(run('craftStats(destroyer,1).power'),run('destroyer.power+5'));
});

test('registered free deployment requires the qualifying ally or farm',async()=>{
 const {run}=await craftHarness();
 run(`const rebel=card('Light:2052'),owen=card('Light:1883');
  state.locations[3]=card('Light:2462');state.hand=[rebel,owen];state.force=[];
  state.light[2]=[{type:'Character',subType:'Rebel',ability:2}];`);
 assert.equal(run('boardDeployCost(rebel,dock,"Light")'),null);
 run('state.light[2][0].ability=3');
 assert.equal(run('boardDeployCost(rebel,dock,"Light")'),0);
 assert.equal(run('boardDeployCost(owen,state.locations[3],"Light")'),0);
 assert.equal(run('boardDeployCost(owen,dock,"Light")'),null);
 assert.equal(run("requestAction('deploy','Light',[0,2]).cost"),0);
 run("state.activeSide='Dark';state.botTurn={steps:[],index:0};state.botHand=[card('Dark:2355')];state.botForce=[];state.dark[2]=[card('Dark:1061')]");
 assert.equal(run("requestAction('deploy','Dark',[0,2]).cost"),0);
 assert.equal(run('state.used.length+state.botUsed.length'),0);
});

test('registered devices charge their costs, validate their mounts and apply continuous stats',async()=>{
 const {run,elements}=await craftHarness();
 run(`const belt=card('Light:2435'),rebel=card('Light:2052'),droid=card('Light:2');
  state.hand=[belt,card('Light:997')];state.light[2]=[rebel,droid];state.light[6]=[ship];state.light[0]=[card('Light:2907')];
  state.force=[];const baseStats=craftStats(ship,6);`);
 assert.equal(run("requestAction('deployDevice','Light',[0,2,0])"),false);
 run('state.force=forcePile();select(0)');
 assert.match(elements.get('board').innerHTML,/Rebel Trooper ausrüsten \(1 Force\)/);
 assert.equal(run("requestAction('deployDevice','Light',[0,2,1])"),false);
 assert.equal(run("requestAction('deployDevice','Light',[0,2,0])"),true);
 assert.equal(run("requestAction('deployDevice','Light',[0,0,0])"),false);
 assert.equal(run("requestAction('deployDevice','Light',[0,6,0])"),true);
 assert.ok(run('state.used.length===1&&craftStats(ship,6).power===baseStats.power+1&&craftStats(ship,6).hyperspeed===baseStats.hyperspeed+1&&craftStats(ship,6).maneuver===baseStats.maneuver+1'));
 run("rebel.attachments.push({...belt});battleSession={site:2}");
 assert.equal(run("cardPowerModifier(rebel,'Light',2)"),2);
 assert.equal(run("battleForfeitValue(rebel,'Light')"),run('rebel.forfeit+2'));
 run(`battleSession=null;state.activeSide='Dark';state.botTurn={steps:[],index:0};state.botHand=[card('Dark:2360')];
  state.locations[3]=card('Dark:675');state.dark[3]=[card('Dark:2355')];`);
 assert.equal(run("requestAction('deployDevice','Dark',[0,3,0])"),true);
 assert.equal(run("cardPowerModifier(state.dark[3][0],'Dark',3)"),2);
 assert.equal(run("cardPowerModifier(state.dark[3][0],'Dark',2)"),1);
});

test('card rule registry returns source, active text and test references across the full catalog',async()=>{
 const {run}=await premiereHarness();
 assert.equal(run('catalog.length'),324);
 assert.ok(run(`catalog.every(card=>{
  const entry=PremiereCardRules.entry(card);
  return entry.cardId===card.id&&entry.source===(card.images.slip??card.images.print)&&entry.text===card.gametext&&
   entry.effects.every(rule=>rule.test&&rule.event&&rule.targets&&rule.expires&&Number.isInteger(rule.cost));
 })`));
 assert.ok(run('catalog.every(card=>{const entry=PremiereCardRules.entry(card);return entry.complete&&entry.effects.length>0;})'));
 assert.equal(run('effectCoverage().complete.length'),324);
});

test('Restraining Bolt blocks movement and active text, and Caller steals from the other side',async()=>{
 const {run,elements}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(97,8);state.game.cardRulesVersion=13;
  const rebel=card('Light:2052'),tooex=card('Light:2'),power=card('Dark:816'),droid=card('Dark:2001');
  const bolt=card('Light:2100'),caller=card('Light:348');
  state.light[2]=[rebel,tooex];state.dark[2]=[power,droid];state.hand=[caller,bolt];state.force=[];`);
 assert.equal(run("cardPowerModifier(droid,'Dark',2)"),1);
 assert.equal(run("requestAction('deployDevice','Light',[0,2,1])"),false);
 assert.equal(run("requestAction('deployDevice','Light',[0,2,0])"),true);
 run('select(0)');
 assert.match(elements.get('board').innerHTML,/Restraining Bolt an .*Eegee-Six.*Dark Side/);
 assert.equal(run("requestAction('deployBolt','Light',[0,3,1])"),false);
 assert.equal(run("performAction(legalActions(state,'Light').find(action=>action.kind==='deployBolt'&&action.host===power))"),true);
 assert.equal(run("state.used.length===0&&cardPowerModifier(droid,'Dark',2)===0"),true);
 assert.equal(run("travelOptions(power,'Dark',2,3).length"),0);
 assert.equal(run("requestAction('deviceAction','Light',['stealDroid',1])"),false);
 assert.equal(run("performAction(legalActions(state,'Light').find(action=>action.kind==='deviceAction'&&action.target.card===droid))"),true);
 assert.equal(run("!PremiereUnits.restrainingBolt(power)&&PremiereUnits.restrainingBolt(droid)===bolt"),true);
 assert.equal(run("cardPowerModifier(droid,'Dark',2)"),1);
 run("state.phase=1;presentGame()");
 assert.match(elements.get('board').innerHTML,/Caller · .*übernehmen/);
 assert.equal(run("performAction(legalActions(state,'Light').find(action=>action.kind==='deviceAction'))"),true);
 assert.equal(run("state.light[2].includes(droid)&&!state.dark[2].includes(droid)&&state.hand[0]===bolt"),true);
 assert.equal(run("droid.side==='Dark'&&droid.controller==='Light'&&!PremiereUnits.textSuppressed(droid)"),true);
 assert.equal(run("loseTableCard('Light',2,droid)&&state.botLost.includes(droid)&&!state.lost.includes(droid)"),true);
});

test('Droid Detector bars droid deploy immediately and removes present droids only from later turns',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(98,8);
  state.locations[2]=card('Dark:673');const droid=card('Light:2'),other=card('Dark:816');
  state.light[2]=[droid,card('Light:1593')];state.dark[2]=[other];
  state.activeSide='Dark';state.botTurn={steps:[],index:0};state.botHand=[card('Dark:777')];state.hand=[card('Light:95')];`);
 assert.equal(run("requestAction('deployLocationEffect','Dark',[0,3])"),false);
 assert.equal(run("requestAction('deployLocationEffect','Dark',[0,2])"),true);
 assert.equal(run("!PremiereGame.responseWindow(state.game)&&!legalActions(state,'Light').some(action=>action.kind==='alterLocationEffect')"),true);
 assert.equal(run("characterLocationAllowed(droid,state.locations[2])"),false);
 assert.equal(run("characterLocationAllowed(droid,dunes)"),true);
 assert.equal(run("characterLocationAllowed(state.light[2][1],state.locations[2])"),true);
 run("endTurn('Dark')");
 assert.equal(run("state.light[2].includes(droid)&&state.dark[2].includes(other)"),true);
 run("endTurn('Light')");
 assert.equal(run("state.lost.includes(droid)&&state.botLost.includes(other)&&state.light[2][0].id==='Light:1593'"),true);
});

test('Our Most Desperate Hour reaches Alderaan aboard a ship and retrieves Force by character ability',async()=>{
 const {run,elements}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(102,8);
  const han=card('Light:1098'),luke=card('Light:1593'),obi=card('Light:1803'),falcon=card('Light:1677');
  const mission=card('Light:1870');
  state.light[2]=[han];state.light[3]=[luke,obi];state.dark[2]=[card('Dark:634')];
  state.hand=[mission];state.force=forcePile();
  state.lost=Array.from({length:6},(_,i)=>({name:'Lost '+i}));`);
 assert.equal(run("requestAction('deployLocationEffect','Light',[0,6,0])"),false);
 assert.equal(run("requestAction('deployLocationEffect','Light',[0,5,0])"),true);
 assert.match(elements.get('log').textContent,/Alderaan.*Han Solo/);
 run("state.light[2].splice(0,1);PremiereUnits.add(falcon,han,'pilot','Light');state.light[6]=[falcon];state.phase=4");
 assert.equal(run("requestAction('move','Light',[6,0,5,'Hyperspeed'])"),true);
 assert.equal(run("state.light[5][0]===falcon&&state.locationEffects[5].length===0&&state.lost.includes(mission)"),true);
 assert.equal(run("state.used.filter(card=>card.name.startsWith('Lost')).map(card=>card.name).join(',')"),'Lost 5,Lost 4,Lost 3,Lost 2,Lost 1');
});

test('Nightfall and Sunsdown enable free Spy deployment and Power Destiny limited to related sites',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(109,9);
  const spy=card('Dark:1011'),nightfall=card('Light:1778'),sunsdown=card('Dark:2373');
  state.locations[4]=card('Dark:673');state.hand=[nightfall];state.botHand=[sunsdown];
  state.light[2]=[card('Light:2052')];state.dark[2]=[card('Dark:2355')];`);
 const column=slot=>run(`renderPlaymatColumn(state.locations[${slot}],${slot})`);
 assert.doesNotMatch(column(2),/location-night/);
 assert.equal(run("requestAction('deployLocationEffect','Light',[0,2])"),false);
 assert.equal(run("requestAction('deployLocationEffect','Light',[0,6])"),true);
 assert.match(column(2),/location-night">Nacht aktiv · Nightfall</);
 assert.doesNotMatch(column(4),/location-night/);
 assert.doesNotMatch(column(6),/location-night/);
 assert.equal(run("PremiereLocations.conditions(state,2,'Dark').night"),true);
 assert.equal(run("PremiereLocations.conditions(state,4,'Dark').night"),false);
 assert.equal(run("characterDeployCost(spy,dock,'Dark')"),0);
 assert.equal(run("characterDeployCost(spy,state.locations[4],'Dark')"),run('spy.deploy'));
 run("state.activeSide='Dark';state.botTurn={steps:[],index:0}");
 assert.equal(run("requestAction('deployLocationEffect','Dark',[0,6])"),true);
 assert.match(column(2),/location-night">Nacht aktiv · Nightfall \+ Sunsdown</);
 run(`state.phase=3;state.activeSide='Light';state.botTurn=null;
  state.deck=[{name:'Light Life'},{name:'L power 1',destiny:2},{name:'L power 2',destiny:3}];
  state.botDeck=[{name:'Dark Life'},{name:'D power 1',destiny:4},{name:'D power 2',destiny:5}];`);
 assert.equal(run("requestAction('battle','Light',[2])&&requestAction('skipDestiny','Light')&&requestAction('skipDestiny','Dark')"),true);
 assert.equal(run("battleSession.powerDestiny.Light"),5);
 assert.equal(run("battleSession.powerDestiny.Dark"),9);
 assert.equal(run("battleSession.damage.debt.Light.attrition+battleSession.damage.debt.Dark.attrition"),0);
 run('cancelLocationEffect(6,PremiereLocations.effectsAt(state,6)[0])');
 assert.match(column(2),/location-night">Nacht aktiv · Sunsdown</);
 run('cancelLocationEffect(6,PremiereLocations.effectsAt(state,6)[0])');
 assert.doesNotMatch(column(2),/location-night/);
});

test('registered location effects add icons once and can be canceled by Alter',async()=>{
 const {run,elements}=await craftHarness();
 run(`const presence=()=>card('Dark:1939');setupDecks=null;state.game=PremiereGame.actionState(95,4);
  state.activeSide='Dark';state.botHand=[presence(),presence(),presence()];state.botTurn={steps:[],index:0};
  state.light[2]=[card('Light:1593')];state.hand=[];
  state.deck=[{name:'Low destiny',destiny:1},{name:'Low destiny',destiny:1}];`);
 assert.equal(run("requestAction('deployLocationEffect','Dark',[0,99])"),false);
 assert.equal(run("requestAction('deployLocationEffect','Dark',[0,2])"),true);
 assert.equal(run("requestAction('deployLocationEffect','Dark',[0,2])"),true);
 assert.equal(run("requestAction('deployLocationEffect','Dark',[0,3])"),false);
 assert.equal(run("PremiereLocations.icons(state,2,'Dark')+PremiereLocations.icons(state,2,'Light')"),4);
 run("state.hand=[card('Light:95'),card('Light:95')];render()");
 assert.match(elements.get('controlPanel').innerHTML,/Presence Of The Force.*aufheben/);
 for(const icons of [2,1]){
  assert.equal(run("requestAction('alterLocationEffect','Light',[0,2,0])&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
  assert.equal(run("PremiereLocations.icons(state,2,'Light')"),icons);
 }
 assert.equal(run("state.botLost.filter(card=>card.id==='Dark:1939').length"),2);
});

test('Death Star Plans tracks the chosen droid, rejects the docking bay and retrieves once at Yavin 4',async()=>{
 const {run,elements}=await craftHarness();
 run(`const plans=card('Light:664'),droid=card('Light:2');setupDecks=null;state.game=PremiereGame.actionState(111,0);
  state.locations=[card('Dark:678'),card('Dark:675'),card('Light:2853'),dock];state.locationOrder=[0,1,2,3];
  state.light=[[],[],[],[droid]];state.dark=[[],[],[],[]];state.hand=[plans];
  state.deck=[{name:'Ordinary reserve'},{name:'First',destiny:1},{name:'Second',destiny:1},{name:'Third',destiny:1}];
  state.lost=[{name:'Lost A'},{name:'Lost B'},{name:'Lost C'}];state.force=forcePile().concat(forcePile());`);
 run("inspectCard('Light',0,'hand',0)");
 assert.match(elements.get('cardInspectorBody').innerHTML,/Level 4 Military Corridor.*Tooex.*als Ziel/);
 run('closeCard();select(0)');
 assert.match(run('renderPlaymatColumn(state.locations[0],0)'),/Tooex.*als Ziel/);
 assert.doesNotMatch(run('renderPlaymatColumn(state.locations[1],1)'),/Tooex.*als Ziel/);
 assert.equal(run("requestAction('deployLocationEffect','Light',[0,1,0])"),false);
 assert.equal(run("requestAction('deployLocationEffect','Light',[0,0,0])"),true);
 assert.equal(run('state.locationEffects[0][0].target===droid'),true);
 run('state.phase=4');
 for(const [from,to,kind] of [[3,1,'Docking-Bay-Transit'],[1,0,'Landspeed'],[0,1,'Landspeed'],[1,2,'Docking-Bay-Transit']]){
  run('state.movedThisTurn=[]');
  assert.ok(run(`requestAction('move','Light',[${from},0,${to},'${kind}'])`));
  if(to===0)assert.ok(run('state.locationEffects[0][0].plansCollected'));
 }
 assert.equal(run('state.locationEffects[0].length'),0);
 assert.equal(run('state.lost.length===1&&state.lost[0]===plans&&state.deck.length===1'),true);
 assert.ok(run("state.used.some(card=>card.name==='Lost A')&&state.used.some(card=>card.name==='Lost C')"));
});

async function kesselHarness(pilotId='Light:305'){
 const fixture=await craftHarness();
 fixture.run(`const runner=card('${pilotId}'),falcon=card('Light:1677'),mission=card('Light:1429');
  setupDecks=null;state.game=PremiereGame.actionState(112,4);state.hand=[mission];
  state.light[0]=[falcon];PremiereUnits.add(falcon,runner,'pilot','Light');
  const runOffer=()=>legalActions(state,'Light').find(action=>action.kind==='deployLocationEffect');`);
 return fixture;
}

test('Kessel Run tracks BoShek and fixes retrieval at the original Parsec distance',async()=>{
 const {run,elements}=await kesselHarness();
 assert.ok(run("runOffer().target===runner&&runOffer().distance===3"));
 run("inspectCard('Light',0,'hand',0)");
 assert.match(elements.get('cardInspectorBody').innerHTML,/BoShek.*Dantooine.*Kessel.*3 Force zurückholen/);
 assert.ok(run('performAction(runOffer())'));
 run("state.phase=4;state.botDeck=[{name:'Safe destiny',destiny:2}];state.lost=forcePile();");
 assert.ok(run("requestAction('move','Light',[0,0,1,'Hyperspeed'])"));
 assert.ok(run("state.locationEffects[1][0].reachedKessel&&state.botUsed.at(-1).name==='Safe destiny'"));
 run('state.locations[0]={...dantooine,parsec:3};state.movedThisTurn=[]');
 assert.ok(run("requestAction('move','Light',[1,0,0,'Hyperspeed'])"));
 assert.ok(run('state.locationEffects[1].length===0&&state.lost.length===3&&state.lost.at(-1)===mission&&state.light[0][0]===falcon'));
});

test('Kessel Run tracks target legality, control, a zero draw and an empty Reserve Deck',async()=>{
 const blocked=await kesselHarness('Light:1098');
 const {run}=blocked;
 run('state.dark[1]=[tie]');
 assert.equal(run('runOffer()'),undefined);
 run('state.dark[1]=[]');
 assert.ok(run('performAction(runOffer())'));
 run("state.phase=4;state.activeSide='Dark';state.botTurn={steps:[],index:0};state.dark[6]=[scout]");
 assert.ok(run("requestAction('move','Dark',[6,0,1,'Hyperspeed'])"));
 assert.ok(run('state.locationEffects[1].length===0&&state.lost.includes(mission)'));

 const invalid=await kesselHarness('Light:239');
 assert.equal(invalid.run('runOffer()'),undefined);
 for(const succeeds of [false,true]){
  const attempt=await kesselHarness();
  assert.ok(attempt.run('performAction(runOffer())'));
  attempt.run(`state.phase=4;state.botDeck=${succeeds?'[]':"[{name:'Zero',destiny:0}]"}`);
  assert.ok(attempt.run("requestAction('move','Light',[0,0,1,'Hyperspeed'])"));
  assert.equal(attempt.run('state.light[1].includes(falcon)'),succeeds);
  assert.equal(attempt.run('state.lost.includes(mission)'),!succeeds);
 }
});

test('registered character stat rules respect same site, physical presence and faction',async()=>{
 const {run}=await craftHarness();
 run(`const beru=card('Light:221'),owen=card('Light:1883'),dodonna=card('Light:1021'),leia=card('Light:1495'),rebel=card('Light:2052'),
  bast=card('Dark:406'),yularen=card('Dark:478'),motti=card('Dark:60'),fivedesix=card('Dark:12'),tagge=card('Dark:1027'),
  dsTrooper=card('Dark:668'),dathcha=card('Dark:643');state.locations[3]=card('Light:2853');state.locations[4]=card('Dark:675');
  state.light[2]=[beru,owen];state.light[3]=[dodonna,rebel];state.light[4]=[leia,{...rebel}];
  state.dark[2]=[bast,card('Dark:1061'),fivedesix,motti,tagge,dsTrooper,card('Dark:2355'),dathcha];state.dark[3]=[yularen];
  battleSession={site:2};`);
 assert.equal(run("cardPowerModifier(owen,'Light',2)"),2);
 assert.equal(run("battleForfeitValue(beru,'Light')-beru.forfeit"),2);
 assert.equal(run("cardPowerModifier(bast,'Dark',2)"),1);
 assert.equal(run("cardPowerModifier(fivedesix,'Dark',2)"),1);
 assert.equal(run("cardPowerModifier(yularen,'Dark',3)"),1);
 assert.equal(run("battleForfeitValue(tagge,'Dark')-tagge.forfeit"),2);
 assert.equal(run("cardPowerModifier(dsTrooper,'Dark',2)"),-1);
 assert.equal(run("cardPowerModifier(dathcha,'Dark',2)"),0);
 assert.equal(run("cardPowerModifier(dathcha,'Dark',4)"),2);
 assert.equal(run("cardPowerModifier(rebel,'Light',3)"),1);
 assert.equal(run("cardPowerModifier(dodonna,'Light',3)"),0);
 assert.equal(run("cardPowerModifier(state.light[4][1],'Light',4)"),1);
 run('state.light[2].shift();state.dark[2].splice(1,1)');
 assert.equal(run("cardPowerModifier(owen,'Light',2)"),0);
 assert.equal(run("cardPowerModifier(bast,'Dark',2)"),0);
});

test('Tusken Raiders count present non-unique copies and Alderaan reduces opposing destiny',async()=>{
 const {run}=await craftHarness();
 run("state.dark[2]=[tusken];state.locations[0]=alderaan");
 assert.equal(run('battleTotals(2).darkPower'),1);
 run("state.dark[2].push(card('Dark:2648'),card('Dark:2648'),card('Dark:2648'))");
 assert.equal(run('battleTotals(2).darkPower'),10);
 assert.equal(run("alderaanBattleDestinyPenalty('Dark',0)"),1);
 assert.equal(run("alderaanBattleDestinyPenalty('Light',0)"),0);
 run("state.locationEffects={0:[{card:card('Light:2110')}]} ");
 assert.equal(run("alderaanBattleDestinyPenalty('Dark',0)"),0);
 assert.equal(run("alderaanBattleDestinyPenalty('Light',0)"),1);
});

test('Comlink equips a character and opens a paid Deploy-React from an adjacent site',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(113,1);state.game.cardRulesVersion=17;state.activeSide='Dark';
  const carrier=card('Dark:1027'),comlink=card('Dark:489'),reinforcement=card('Dark:2355');
  state.dark[2]=[carrier];state.dark[6]=[tie];state.botHand=[comlink,reinforcement,card('Dark:2355')];
  state.locationOrder=[2,3,4,6,5,1,0];state.light[3]=[card('Light:2052')];`);
 assert.equal(run("requestAction('deployDevice','Dark',[0,6,0])"),false);
 assert.equal(run("requestAction('deployDevice','Dark',[0,2,0])"),true);
 assert.ok(run('carrier.attachments[0]===comlink&&state.botForce.length===4'));
 run("state.phase=1;state.activeSide='Light'");
 assert.ok(run("requestAction('drain','Light',[3])&&PremiereGame.responseWindow(state.game).kind==='drain'"));
 assert.ok(run("requestAction('reactDeploy','Dark',[0,-1])&&requestAction('passResponse','Light')&&requestAction('passResponse','Dark')"));
 assert.deepEqual(JSON.parse(run('JSON.stringify({deployed:state.dark[3].includes(reinforcement),loss:state.pendingForceLoss??null,force:state.botForce.length})')),
  {deployed:true,loss:null,force:3});
 assert.equal(run("reactDeployOptions('Dark',{kind:'drain',side:'Light',site:3}).length"),0);
 run("PremiereGame.resetTurn(state,'Light')");
 assert.ok(run("reactDeployOptions('Dark',{kind:'drain',side:'Light',site:3}).length>0"));
});

test('Alter restores a rotated location and can also cancel a pending Revolution',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(114,2);const revolution=card('Light:2110');
  state.hand=[revolution];state.botHand=[];state.locations[3]={...dunes,icons:{light:1,dark:3}};
  state.dark[3]=[card('Dark:1061')];state.botDeck=[{name:'Low destiny',destiny:1}];`);
 assert.ok(run("requestAction('revolution','Light',[0,3])&&PremiereLocations.icons(state,3,'Light')===3"));
 run("state.botHand=[card('Dark:94')]");
 assert.ok(run("requestAction('alterLocationEffect','Dark',[0,3,0])&&requestAction('passResponse','Light')&&requestAction('passResponse','Dark')"));
 assert.ok(run("PremiereLocations.icons(state,3,'Light')===1&&state.lost.includes(revolution)"));
 run("state.hand=[card('Light:2110')];state.force=forcePile();state.botHand=[card('Dark:94')];state.botDeck=[{name:'Low destiny',destiny:1}]");
 assert.ok(run("requestAction('revolution','Light',[0,3])&&PremiereGame.responseWindow(state.game).kind==='locationEffect'"));
 assert.ok(run("requestAction('interruptResponse','Dark',[0])&&requestAction('passResponse','Light')&&requestAction('passResponse','Dark')"));
 assert.ok(run("PremiereLocations.icons(state,3,'Light')===1&&state.force.length===2&&state.game.responses.length===0"));
});

test('learning decks contain planet systems, exterior sites, piloted starships and a Dark Bantha',async()=>{
 const {run}=await premiereHarness();
 for(const side of ['light','dark']){
  run(`var craftTestDeck=setupDecks.${side}.cards`);
  assert.ok(run('craftTestDeck.filter(isPlanetSystem).length')>=2);
  assert.ok(run('craftTestDeck.filter(isExteriorPlanetSite).length')>=2);
  assert.equal(run('craftTestDeck.some(c=>c.type===\'Starship\'&&cardAbility(c)===1)'),true);
  assert.equal(run('craftTestDeck.some(isBantha)'),side==='dark');
 }
});

test('ship deployment pays actual costs at a valid system and requires a supported pilot and friendly presence',async()=>{
 const {run}=await craftHarness();
 assert.equal(run("boardDeployCost(ship,dock,'Light')"),2);
 assert.equal(run("boardDeployCost(card('Light:1677'),dantooine,'Light')"),null);
 assert.equal(run("boardDeployCost(scout,dantooine,'Dark')"),null);
 assert.equal(run("boardDeployCost(card('Light:530'),dantooine,'Light')"),2);
 assert.equal(run("boardDeployCost(tie,kessel,'Dark')"),0);
 run("state.dark[6].push(card('Dark:1291'))");
 assert.equal(run("boardDeployCost(tie,tatooine,'Dark')"),0);
 run('play(0,0)');
 assert.equal(run('state.light[0].includes(ship)&&state.force.length===4&&state.used.length===1'),true);
 assert.equal(run("confirmedPresence('Light',0)"),true);
});

test('deployment respects single and multiple Premiere uniqueness dots',async()=>{
 const {run}=await craftHarness();
 run("const devastator=card('Dark:723'), talz=card('Light:2412');state.botForce=forcePile().concat(forcePile());");
 assert.equal(run("boardDeployCost(devastator,kessel,'Dark')"),7);
 run('state.dark[1].push({...devastator});state.light[2].push({...talz},{...talz})');
 assert.equal(run("boardDeployCost(devastator,kessel,'Dark')"),null);
 assert.notEqual(run("boardDeployCost(talz,dock,'Light')"),null);
 run('state.light[2].push({...talz})');
 assert.equal(run("boardDeployCost(talz,dock,'Light')"),null);
});

test('hyperspeed uses parsec distance, requires a nav computer, and costs one regular move',async()=>{
 const {run,elements}=await craftHarness();
 run("state.phase=4;state.light[5]=[ship];render()");
 assert.match(elements.get('board').innerHTML,/id="movementTrigger5"/);
 assert.doesNotMatch(elements.get('board').innerHTML,/Hyperspeed, 1 Force|Hyperspeed \(1 Force\)/);
 run('openMovement(5)');
 assert.match(elements.get('movementOptions').innerHTML,/Tatooine · Hyperspeed \(1 Force\)/);
 assert.equal(run('moveCharacter(5,0,1)'),false);
 assert.equal(run('moveCharacter(5,0,2)'),false);
 run('ship.navComputer=false');
 assert.equal(run('moveCharacter(5,0,6)'),false);
 run('ship.navComputer=true');
 assert.equal(run('moveCharacter(5,0,6)'),true);
 assert.equal(run('moveCharacter(6,0,0)'),false);
 assert.equal(run('state.light[6][0]===ship&&state.force.length===4&&state.used.length===1'),true);
});

test('the bot deploys ships and Banthas and chooses legal Hyperspeed in its Move phase',async()=>{
 const {run}=await craftHarness();
 run("state.activeSide='Dark';state.botTurn={steps:[{kind:'move'}],index:0}");
 assert.match(run('botDeployPhase().join(";")'),/Raumschiff TIE Scout .*Kessel.*Fahrzeug Bantha .*Docking Bay/);
 assert.equal(run('state.dark[1][0]===scout&&state.dark[2][0]===bantha&&state.botForce.length===3'),true);
 run('botNextStep()');
 assert.equal(run('state.dark[6][0]===scout&&state.botForce.length===2'),true);
});

test('a Bantha has half ability, boosts Tusken power outdoors and cannot move into an interior-only site',async()=>{
 const {run}=await craftHarness();
 assert.equal(run("boardDeployCost(bantha,cantina,'Dark')"),null);
 assert.equal(run("boardDeployCost(bantha,kessel,'Dark')"),null);
 run('state.dark[2]=[bantha]');
 assert.equal(run('cardAbility(bantha)'),0.5);
 assert.equal(run("confirmedPresence('Dark',2)"),false);
 run('state.dark[2].push(tusken);state.phase=4;state.activeSide="Dark";state.botTurn={steps:[],index:0}');
 assert.equal(run('battleTotals(2).darkPower'),3);
 assert.equal(run("moveCharacterFor('Dark',2,0,3)"),true);
 assert.equal(run('battleTotals(2).darkPower'),1);
 assert.equal(run('regularMoveKind(bantha,3,4)'),null);
});

test('the Bantha defends against Blasters with maneuver rather than ability',async()=>{
 const {run}=await craftHarness();
 run(`const light=card('Light:2052');light.weapons=[card('Light:259')];
  state.light[2]=[light];state.dark[2]=[bantha,tusken];state.phase=3;
  state.deck=[{name:'Destiny 2',destiny:2}];battleAnalysis(2);`);
 assert.equal(run("fireBattleWeapon('Light',0,0,0)"),true);
 assert.equal(run('battleSession.weaponHits.Dark.length'),0);
 assert.match(run('state.log[0]'),/Verteidigung 2.*kein Treffer/);
});

test('space battles use permanent-pilot ability and apply the system Battle Destiny rules',async()=>{
 const {run}=await craftHarness();
 run('state.light[1]=[ship,{...ship},{...ship},{...ship}];state.dark[1]=[scout];state.phase=3;battleAnalysis(1)');
 assert.equal(run('battleTotals(1).lightAbility'),4);
 assert.equal(run("minimumBattleDestinyAbility('Light',1)"),6);
 assert.equal(run("minimumBattleDestinyAbility('Dark',1)"),4);
 run("battleDestiny('Light')");
 assert.equal(run('battleSession.lightCard'),null);
 run(`battleSession=null;state.activeSide='Dark';state.botTurn={steps:[],index:0};
  state.light[5]=[ship];state.dark[5]=[scout,{...scout},{...scout},{...scout}];
  state.botDeck=[{name:'Destination draw',destiny:0}];initiateBattleFor('Dark',5);botDestinyDecision()`);
 assert.equal(run('battleSession.darkDestiny'),0);
 assert.equal(run("state.log.some(entry=>entry.includes('Alderaan reduziert'))"),true);
});

test('Playmat uses official card image URLs for locations and accessible fallback',()=>{
 const {run}=harness();
 assert.match(html,/<header class="brand-header"><img[^>]+alt="Star Wars Customizable Card Game Logo"/);
 assert.match(html,/id="board" class="playmat"/);
 assert.match(run("locationCardVisual({name:'Hoth: Echo Base',image:'https://res.starwarsccg.org/cards/example.gif'})"),/src="https:\/\/res.starwarsccg.org\/cards\/example.gif"/);
 assert.match(run("locationCardVisual({name:'Unknown',image:null})"),/kein Kartenbild/);
 assert.match(run("locationCardVisual(null)"),/Freier Location-Platz/);
});
test('Playmat places Dark above location art and Light below and retains actions',()=>{
 const {run}=harness();
 assert.match(html,/id="botHand"[\s\S]*id="board"[\s\S]*id="hand"/);
 run("state={phase:0,locations:[{name:'Hoth: Echo Base',image:'https://res.starwarsccg.org/cards/example.gif'}],light:[[{name:'Rebel'}]],dark:[[{name:'Trooper'}]],hand:[],force:[],botTurn:null};");
 const content=run("renderPlaymatColumn(state.locations[0],0)");
 assert.ok(content.indexOf('DARK · 1')<content.indexOf('Location-Karte: Hoth: Echo Base'));
 assert.ok(content.indexOf('Location-Karte: Hoth: Echo Base')<content.indexOf('LIGHT · 1'));
 assert.doesNotMatch(content,/<button disabled>Ausspielen<\/button>/);
 assert.doesNotMatch(content,/<button [^>]*disabled[^>]*>Kampfvorschau/);
});

test('the hand phase lists follow the current turn through setup, play and game end',async()=>{
 const {run,elements}=await premiereHarness();
 assert.match(html,/id="botHand"[\s\S]*id="phaseListBot"[\s\S]*id="board"[\s\S]*id="hand"[\s\S]*id="phaseListPlayer"/);
 assert.match(html,/id="forceControls"[^>]*><\/div>\s*<section[^>]+id="drainLossControls"[^>]*><\/section>\s*<figure[^>]+id="pilesPlayer"/);
 assert.match(html,/id="phaseDisplayPlayer"[^>]*>\s*<button id="step"[^>]*>[^<]*<\/button>\s*<p id="turnStatusPlayer"/);
 assert.match(html,/class="table-sidebar table-bot"[\s\S]*id="botHistory"[\s\S]*class="table-sidebar table-info"[\s\S]*id="phaseHelpText"[\s\S]*id="log"/);
 assert.equal(elements.get('gameTable').hidden,true);
 const assertPhase=(active,phase)=>{
  for(const [side,role] of [['Dark','Bot'],['Light','Player']]){
   const list=elements.get('phaseList'+role).innerHTML;
   assert.equal([...list.matchAll(/<li\b/g)].length,6);
   const highlighted=[...list.matchAll(/<li aria-current="step">([^<]+)<\/li>/g)].map(match=>match[1]);
   assert.deepEqual(highlighted,side===active?[phase]:[]);
   const label=!active?'Partie beendet':side!==active?'Wartet':side==='Dark'?'Bot ist am Zug':'Du bist am Zug';
   assert.equal(elements.get('turnStatus'+role).textContent,label);
  }
 };

 run('start(1,true,true,starterDecks,latestCardRulesVersion,1);chooseStart(startingLocationChoices(setupDecks.light)[1].index);beginStartingGame()');
 assert.equal(elements.get('gameTable').hidden,false);
 assert.equal(elements.get('gameMessage').hidden,true);
 assert.equal(elements.get('forceControls').hidden,true);
 assertPhase('Dark','Aktivieren');
 assert.match(elements.get('phaseHelpText').textContent,/Aktiviere/);
 run('botNextStep();botNextStep()');
 assertPhase('Dark','Kontrolle');
 assert.match(elements.get('phaseHelpText').textContent,/Kontrolle/);
 assert.match(elements.get('botHistory').textContent,/Control/);
 assert.match(elements.get('log').textContent,/Control/);
 run('for(let i=0;i<5;i++)botNextStep()');
 assertPhase('Light','Aktivieren');
 assert.equal(elements.get('forceControls').hidden,false);
 assert.match(elements.get('forceControls').innerHTML,/Force aktivieren/);
 run("requestAction('activate','Light',[1]);requestAction('advance','Light')");
 assertPhase('Light','Kontrolle');
 run("state.gameWinner='Light';render()");
 assertPhase(null);
 assert.equal(elements.get('gameMessage').hidden,false);
 assert.match(elements.get('instruction').textContent,/Light Side gewinnt/);
 run('start(1)');
 assert.equal(elements.get('gameTable').hidden,true);
});

test('both playmat pile diagrams show their own counts and follow card movement',async()=>{
 const {run,elements}=await premiereHarness();
 const diagram=side=>elements.get(side==='Light'?'pilesPlayer':'pilesBot').innerHTML;
 const assertPiles=(side,reserve,force,used,lost,life)=>{
  const markup=diagram(side);
  for(const [label,count] of [['Reserve Deck',reserve],['Force Pile',force],['Used Pile',used],['Lost Pile',lost],['Life Force',life]]){
   assert.ok(markup.includes(label+' <strong>'+count+'</strong>'),label+' count for '+side);
  }
 };
 run('start(1,true,false,starterDecks,latestCardRulesVersion,1);chooseStart(startingLocationChoices(setupDecks.light)[1].index);beginStartingGame()');
 assertPiles('Dark',51,0,0,0,51);
 assertPiles('Light',51,0,0,0,51);
 assert.match(diagram('Dark'),/cards\/darkcardback\.png/);
 assert.match(diagram('Light'),/cards\/lightcardback\.png/);
 assert.equal((diagram('Light').match(/class="side-card-back"/g)||[]).length,1);
 assert.match(diagram('Light'),/Am Zugende unter das Reserve Deck.*Reserve Deck <strong.*Aktivieren.*→.*Force Pile.*Ausgeben.*→.*Used Pile.*↓.*Auf die Hand ziehen/);

 const activation=run("forceFromLocations('Dark').count");
 run('botNextStep()');
 assertPiles('Dark',51-activation,activation,0,0,51);
 assertPiles('Light',51,0,0,0,51);
 run("for(let i=0;i<6;i++)botNextStep();requestAction('activate','Light',[1])");
 assertPiles('Light',50,1,0,0,51);
 run('PremiereGame.moveTop(state.force,state.used);render()');
 assertPiles('Light',50,0,1,0,51);
 run('recirculateBoth();render()');
 assertPiles('Light',51,0,0,0,51);
 run('PremiereGame.moveTop(state.deck,state.lost);render()');
 assertPiles('Light',50,0,0,1,50);
});

test('lost piles reveal only their top card and keep covered bot hands face down',async()=>{
 const {run,elements}=await premiereHarness();
 run(`start(1);chooseStart(startingLocationChoices(setupDecks.light)[1].index);beginStartingGame();
  el('showBotHand').checked=false;
  state.botHand=[{name:'Hidden Bot Card'}];
  state.deck.push({name:'Latest Loss',type:'Character'},{name:'Earlier Loss',type:'Character'});
  PremiereGame.loseForce(state,'Light','deck');
  PremiereGame.loseForce(state,'Light','deck');
  render()`);
 const ownPile=elements.get('pilesPlayer');
 assert.match(ownPile.innerHTML,/Lost Pile <strong>2<\/strong>/);
 assert.match(ownPile.innerHTML,/Latest Loss/);
 assert.doesNotMatch(ownPile.innerHTML,/Earlier Loss/);
 assert.match(elements.get('botHand').innerHTML,/darkcardback\.png/);
 assert.doesNotMatch(elements.get('botHand').innerHTML,/Hidden Bot Card/);
 run("inspectLostTop('Light')");
 assert.equal(elements.get('cardInspectorTitle').textContent,'Latest Loss');
 assert.equal(elements.get('cardInspector').open,true);
 run("closeCard();PremiereGame.retrieveForce(state,'Light',1);render()");
 assert.match(ownPile.innerHTML,/Earlier Loss/);
 assert.doesNotMatch(ownPile.innerHTML,/Latest Loss/);
});

async function eyesInTheDarkHarness(){
 const fixture=await premiereHarness();
 fixture.run(`start(1,true,false,starterDecks,latestCardRulesVersion,1);chooseStart(startingLocationChoices(setupDecks.light)[1].index);
  const copies=setupDecks.light.cards.filter(isLostPileEffect).length;
  beginStartingGame();
  for(let i=0;i<7;i++)botNextStep();
  state.phase=2;
  const eyes=catalog.find(card=>card.side==='Light'&&isLostPileEffect(card));
  state.hand=[eyes];state.botHand=[];`);
 return fixture;
}

test('Eyes In The Dark covers a chosen pile and conceals all Life Force losses while allowing retrieval',async()=>{
 const {run,elements}=await eyesInTheDarkHarness();
 assert.equal(run('copies'),1);
 assert.deepEqual(JSON.parse(run(`JSON.stringify(legalActions(state,'Light').filter(action=>
  action.kind==='deployLostPileEffect').map(action=>action.args))`)),[[0,'Light'],[0,'Dark']]);
 assert.equal(run("state.phase=1;requestAction('deployLostPileEffect','Light',[0,'Light'])"),false);
 assert.equal(run("state.phase=2;requestAction('deployLostPileEffect','Light',[0,'Unknown'])"),false);
 run("state.lost.push({name:'Previously Visible'});inspectLostTop('Light')");
 assert.equal(elements.get('cardInspector').open,true);
 assert.equal(run("requestAction('deployLostPileEffect','Light',[0,'Light'])"),true);
 assert.equal(elements.get('cardInspector').open,false);
 run("inspectLostTop('Light')");
 assert.equal(elements.get('cardInspector').open,false);
 assert.match(elements.get('pilesPlayer').innerHTML,/Lost Pile verdeckt.*Eyes In The Dark/);
 assert.doesNotMatch(elements.get('pilesPlayer').innerHTML,/Previously Visible|lost-top-card/);
 assert.doesNotMatch(elements.get('pilesBot').innerHTML,/Lost Pile verdeckt/);

 run(`for(const zone of ['deck','force','used']){
  PremiereGame.zones(state,'Light')[zone].push({name:'Secret '+zone});
  beginForceLoss('Light',1,{reason:'drain',from:zone});
  if(!requestAction('loseForce','Light',[zone]))throw new Error('Loss did not resolve');
 }`);
 assert.equal(run('state.lost.length'),4);
 for(const viewer of ['Light','Dark']){
  assert.doesNotMatch(run(`JSON.stringify(PremiereGame.playerView(state,'${viewer}'))`),/Secret|Previously Visible/);
 }
 assert.doesNotMatch(elements.get('log').textContent,/Secret/);
 assert.match(elements.get('log').textContent,/eine verdeckte Karte/);
 run(`state.hand=[{name:'Public Hand Loss'}];
  beginForceLoss('Light',1,{reason:'drain',from:'hand'});
  requestAction('loseForce','Light',['hand',0]);
  const unit={name:'Public Table Loss',type:'Character'};
  state.light[0].push(unit);loseTableCard('Light',0,unit);render()`);
 assert.match(elements.get('log').textContent,/Public Hand Loss/);
 assert.match(elements.get('log').textContent,/Public Table Loss/);
 assert.doesNotMatch(elements.get('pilesPlayer').innerHTML,/Public Hand Loss|Public Table Loss/);

 run(`const luke=catalog.find(card=>locationTitle(card)==='luke skywalker');
  state.lost.push(luke);state.hand=[catalog.find(card=>card.id==='Light:1600')];
  state.force.push({name:'Force Payment'});render()`);
 assert.equal(run("requestAction('retrieve','Light',[0])&&requestAction('finishCardInformation','Light',['recover',state.lost.indexOf(luke)])"),true);
 assert.equal(run('state.used.includes(luke)&&PremiereGame.lostPileFaceDown(state,\'Light\')'),true);
 assert.match(elements.get('log').textContent,/Luke Skywalker/);
});

test('Alter can uncover a pile after Eyes In The Dark is on the table',async()=>{
 const {run,elements}=await eyesInTheDarkHarness();
 run("state.botLost.push({name:'Visible Again'});state.dark[0].push({name:'Imperial',type:'Character',ability:4})");
 assert.equal(run("requestAction('deployLostPileEffect','Light',[0,'Dark'])"),true);
 assert.match(elements.get('pilesBot').innerHTML,/Lost Pile verdeckt/);
 assert.doesNotMatch(elements.get('pilesBot').innerHTML,/Visible Again/);
 run("state.botHand=[catalog.find(card=>card.id==='Dark:94')];state.botDeck.push({name:'Destiny',destiny:1})");
 assert.equal(run("requestAction('alterLostPileEffect','Dark',[0,0])"),true);
 assert.match(elements.get('controlPanel').innerHTML,/Antwortfenster · Alter/);
 assert.equal(run("requestAction('passResponse','Light')&&requestAction('passResponse','Dark')"),true);
 assert.match(elements.get('pilesBot').innerHTML,/Visible Again/);
 assert.doesNotMatch(elements.get('pilesBot').innerHTML,/Lost Pile verdeckt/);
 assert.equal(run('state.lost.includes(eyes)&&state.lostPileEffects.length===0'),true);
});

test('a Light Effect in hand shows legal targets in the popup and plays through the normal action path',async()=>{
 const {run,elements}=await eyesInTheDarkHarness();
 run("state.phase=1;inspectCard('Light',0,'hand')");
 const body=elements.get('cardInspectorBody');
 assert.match(body.innerHTML,/In deiner Ausspielen-Phase/);
 assert.doesNotMatch(body.innerHTML,/Side Lost Pile verdecken/);
 run("state.phase=2;inspectCard('Light',0,'hand')");
 assert.match(body.innerHTML,/Light Side Lost Pile verdecken \(0 Force\).*Dark Side Lost Pile verdecken \(0 Force\)/);
 assert.equal(elements.get('selectInspectorCard').hidden,true);
 run("select(0)");
 assert.match(elements.get('playmatSelection').innerHTML,/Light Side.*0 Force.*Dark Side.*0 Force/s);
 run("playInspectorEffect(legalActions(state,'Light').find(action=>action.kind==='deployLostPileEffect'&&action.target==='Dark'))");
 assert.equal(elements.get('cardInspector').open,false);
 assert.equal(run("state.hand.length===0&&PremiereGame.lostPileFaceDown(state,'Dark')"),true);
});

test('an unsupported Effect or an unaffordable Revolution shows why the card cannot be played',async()=>{
 const {run,elements}=await eyesInTheDarkHarness();
 run(`state.hand=[catalog.find(card=>card.id==='Light:2110'),{id:'test-effect',type:'Effect',name:'Untested'}];
  state.force=[{name:'Force'}];inspectCard('Light',0,'hand');`);
 const body=elements.get('cardInspectorBody');
 assert.match(body.innerHTML,/Revolution braucht 3 Force\. Du hast 1/);
 run("inspectCard('Light',1,'hand')");
 assert.match(body.innerHTML,/Effect ist in V2 noch nicht spielbar/);
 run("state.force.push({name:'Force'},{name:'Force'});inspectCard('Light',0,'hand')");
 assert.match(body.innerHTML,/Force-Icons und Spieltext vertauschen \(3 Force\)/);
});

test('Alter must draw below the highest ability to stop Eyes In The Dark from deploying',async()=>{
 for(const destiny of [1,4]){
  const {run,elements}=await eyesInTheDarkHarness();
  run(`state.botHand=[catalog.find(card=>card.id==='Dark:94')];
   state.dark[0].push({name:'Imperial',type:'Character',ability:4});
   state.botDeck.push({name:'Destiny',destiny:${destiny}})`);
  assert.equal(run("requestAction('deployLostPileEffect','Light',[0,'Dark'])"),true);
  assert.match(elements.get('controlPanel').innerHTML,/Antwortfenster · Eyes In The Dark/);
  assert.equal(run("requestAction('interruptResponse','Dark',[0])&&requestAction('passResponse','Light')&&requestAction('passResponse','Dark')"),true);
  if(destiny===4)assert.equal(run("requestAction('passResponse','Light')&&requestAction('passResponse','Dark')"),true);
  assert.equal(run("PremiereGame.lostPileFaceDown(state,'Dark')"),destiny===4);
  assert.equal(run('state.lost.includes(eyes)'),destiny===1);
 }
});

async function darkLostPileEffectHarness(){
 const fixture=await premiereHarness();
 fixture.run(`start(1,true,false,starterDecks,latestCardRulesVersion,1);chooseStart(startingLocationChoices(setupDecks.light)[1].index);
  const copies=setupDecks.dark.cards.filter(isLostPileEffect).length;
  beginStartingGame();
  const darkEffect=catalog.find(card=>card.side==='Dark'&&isLostPileEffect(card));
  state.botHand=[darkEffect];
  botNextStep();botNextStep();`);
 return fixture;
}

test('Dark deploys Your Eyes Can Deceive You from its starter deck and conceals its Life Force losses',async()=>{
 const {run,elements}=await darkLostPileEffectHarness();
 assert.equal(run('copies'),1);
 assert.equal(run("requestAction('deployLostPileEffect','Dark',[0,'Dark'])"),false);
 const force=run('state.botForce.length');
 assert.equal(run('botNextStep()'),true);
 assert.equal(run('state.botForce.length'),force);
 assert.equal(run("state.lostPileEffects[0].card===darkEffect&&state.lostPileEffects[0].target==='Dark'"),true);
 assert.match(elements.get('botHistory').textContent,/Your Eyes Can Deceive You/);
 assert.match(elements.get('pilesBot').innerHTML,/Lost Pile verdeckt.*Your Eyes Can Deceive You/);
 assert.doesNotMatch(elements.get('pilesPlayer').innerHTML,/Lost Pile verdeckt/);
 run(`state.botDeck.push({name:'Hidden Dark Card'});
  beginForceLoss('Dark',1,{reason:'drain',from:'deck'});`);
 assert.equal(run("state.botLost.at(-1).name==='Hidden Dark Card'"),true);
 assert.doesNotMatch(elements.get('log').textContent,/Hidden Dark Card/);
 assert.doesNotMatch(run("JSON.stringify(PremiereGame.playerView(state,'Light'))"),/Hidden Dark Card/);
});

test('Dark has both legal targets and covers Light when Dark is already covered',async()=>{
 const {run}=await darkLostPileEffectHarness();
 run(`state.lostPileEffects.push({card:catalog.find(card=>card.id==='Light:917'),target:'Dark'});
  requestAction('botStep','Dark',['deploy']);`);
 assert.deepEqual(JSON.parse(run(`JSON.stringify(legalActions(state,'Dark').filter(action=>
  action.kind==='deployLostPileEffect').map(action=>action.target))`)),['Light','Dark']);
 run('botDeployPhase()');
 assert.equal(run("state.lostPileEffects[1].card===darkEffect&&state.lostPileEffects[1].target==='Light'"),true);
});

test('Light can cancel Your Eyes Can Deceive You with Alter and the bot resumes its Deploy phase',async()=>{
 const {run,elements}=await darkLostPileEffectHarness();
 run(`state.hand=[catalog.find(card=>card.id==='Light:95')];
  state.light[0].push({name:'Rebel',type:'Character',ability:4});
  state.deck.push({name:'Destiny',destiny:1});`);
 assert.equal(run('botNextStep()'),true);
 assert.equal(run("state.botTurn.decision==='deploy'"),true);
 assert.match(elements.get('controlPanel').innerHTML,/Antwortfenster · Your Eyes Can Deceive You.*Alter/);
 assert.equal(run("requestAction('interruptResponse','Light',[0])&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
 assert.equal(run("state.botLost.includes(darkEffect)&&!PremiereGame.lostPileFaceDown(state,'Dark')"),true);
 assert.equal(run("botNextStep()&&state.phase===2&&state.botTurn.decision===undefined"),true);
});

test('location art opens a detailed card inspector without changing game state',()=>{
 const {run,elements}=harness();
 run("state={locations:[{name:'Tatooine: Mos Eisley',type:'Location',subType:'Site',image:'https://res.starwarsccg.org/cards/test.gif',icons:{light:1,dark:2},gametext:'Some location effect'}],light:[[]],dark:[[]],phase:0,hand:[],force:[],botTurn:null};");
 const markup=run("renderPlaymatColumn(state.locations[0],0)");
 assert.match(markup,/onclick="inspectLocation\(0\)"/);
 assert.equal(run("inspectLocation(0)"),true);
 assert.equal(elements.get('cardInspector').open,true);
 assert.equal(elements.get('cardInspectorTitle').textContent,'Tatooine: Mos Eisley');
 assert.match(elements.get('cardInspectorBody').innerHTML,/Force-Icons · Light 1 \/ Dark 2/);
 assert.match(elements.get('cardInspectorBody').innerHTML,/Some location effect/);
 assert.equal(run("state.locations[0].name"),'Tatooine: Mos Eisley');
 run('closeCard()');
 assert.equal(run("inspectLocation(9)"),false);
 assert.equal(elements.get('cardInspector').open,false);
});
test('initial location choices include original image thumbnails',async()=>{
 const {elements}=await premiereHarness();
 const markup=elements.get('setupOptions').innerHTML;
 assert.match(markup,/start-location-option/);
 assert.match(markup,/<img[^>]+tatooinedunesea\.gif/i);
 assert.match(markup,/Tatooine: Dune Sea/);
});

test('Light may deploy successive locations beyond original three-slot board',()=>{
 const {run}=harness();
 run("render=()=>{};state={phase:2,activeSide:'Light',locations:[{name:'Hoth: A',type:'Location',subType:'Site'} ,null],light:[[],[]],dark:[[],[]],hand:[{name:'Hoth: B',type:'Location',subType:'Site'},{name:'Hoth: C',type:'Location',subType:'Site'}],force:[],used:[],deployedThisTurn:[],log:[]};");
 run('playLocation(0,1)');
 assert.equal(run("state.locations.length"),3);
 assert.equal(run("state.locations[2]===null"),true);
 assert.equal(run("state.light.length"),3);
 run('playLocation(0,2)');
 assert.equal(run("state.locations.length"),4);
 assert.equal(run("state.locations[3]===null"),true);
 assert.equal(run("state.hand.length"),0);
});
test('Dark bot deploy phase plays multiple affordable characters and pays Force per card',()=>{
 const {run}=harness();
 run("render=()=>{};state={phase:2,activeSide:'Dark',botTurn:{steps:[],index:0},locations:[{name:'Hoth: A',type:'Location',subType:'Site',icons:{dark:1,light:0}},null],light:[[],[]],dark:[[],[]],botHand:[{name:'Trooper A',type:'Character',deploy:1,ability:1},{name:'Trooper B',type:'Character',deploy:2,ability:1}],botForce:[{id:1},{id:2},{id:3}],botUsed:[],deployedThisTurn:[],log:[]};");
 const actions=run("botDeployPhase()");
 assert.equal(actions.length,2);
 assert.equal(run("state.dark[0].length"),2);
 assert.equal(run("state.botHand.length"),0);
 assert.equal(run("state.botForce.length"),0);
 assert.equal(run("state.botUsed.length"),3);
});
test('Dark bot multi-deploy cannot spend more Force than available',()=>{
 const {run}=harness();
 run("state={phase:2,activeSide:'Dark',botTurn:{steps:[],index:0},locations:[{name:'Hoth: A',type:'Location',subType:'Site',icons:{dark:1,light:0}},null],light:[[],[]],dark:[[],[]],botHand:[{name:'Trooper A',type:'Character',deploy:1,ability:1},{name:'Trooper B',type:'Character',deploy:2,ability:1}],botForce:[{id:1}],botUsed:[],deployedThisTurn:[],log:[]};");
 assert.equal(run("botDeployPhase().length"),1);
 assert.equal(run("state.botHand.length"),1);
 assert.equal(run("state.botForce.length"),0);
});
test('Location deploy rejects duplicate titles, invalid insertion positions and the wrong side or phase',()=>{
 const {run}=harness();
 run("state={phase:2,activeSide:'Light',locations:[{name:'Hoth: A',type:'Location',subType:'Site'},null],light:[[],[]],dark:[[],[]],hand:[{name:'Hoth: A',type:'Location'},{name:'Hoth: B',type:'Location'}],log:[]};");
 assert.equal(run("deployLocationFromHand('Light',0,1)"),false);
 assert.equal(run("deployLocationFromHand('Light',1,2)"),false);
 assert.equal(run("deployLocationFromHand('Dark',1,1)"),false);
 assert.equal(run("state.locations.length"),2);
 run('state.phase=3');
 assert.equal(run("deployLocationFromHand('Light',1,1)"),false);
 run('state.phase=2');
 assert.equal(run("deployLocationFromHand('Light',1,1)"),true);
 assert.equal(run("state.locations.length"),3);
});

test('starting locations use their geographic order while keeping the original location references',async()=>{
 const {run,elements}=await premiereHarness();
 run('start(1,true,false,starterDecks,latestCardRulesVersion,1)');
 run('chooseStart(setupDecks.light.startingIndices[1]);beginStartingGame()');
 assert.equal(run("state.locations[0].id==='Light:2448'&&state.locations[1].id==='Dark:2446'"),true);
 assert.equal(run('boardLocationOrder().join()'),'1,0');
 assert.equal(run('adjacentSites(0,1)'),true);
 const board=elements.get('board').innerHTML;
 assert.ok(board.indexOf('inspectLocation(1)')<board.indexOf('inspectLocation(0)'));
});

test('Tatooine insertion preserves the spaceport block, offers exterior gaps and keeps units on their sites',async()=>{
 const {run,elements}=await craftHarness();
 run(`const rebel=card('Light:2052');const stormtrooper=card('Dark:2355');
  state.locations=[tatooine,card('Dark:682'),dunes,null];
  state.light=[[],[],[rebel],[]];state.dark=[[],[],[stormtrooper],[]];
  state.hand=[cantina,dock,card('Light:2466'),card('Light:2462')];
  state.drainedSitesThisTurn=[2];state.battledSitesThisTurn=[2];`);
 assert.equal(run('boardLocationOrder().join()'),'2,0,1');
 assert.equal(run("locationDeployPositions('Light',0).join()"),'0');
 run('playLocation(0,0)');
 assert.equal(run('adjacentSites(3,2)'),true);
 assert.equal(run("locationDeployPositions('Light',0).join()"),'1');
 run('playLocation(0,1)');
 assert.equal(run('adjacentSites(3,2)'),false);
 assert.equal(run('adjacentSites(3,4)&&adjacentSites(4,2)'),true);
 assert.equal(run("locationDeployPositions('Light',0).join()"),'2');
 run('playLocation(0,2);select(0)');
 assert.equal(run("locationDeployPositions('Light',0).join()"),'3,4');
 assert.equal(run("deployLocationFromHand('Light',0,2)"),false);
 const board=elements.get('board').innerHTML;
 assert.match(board,/&quot;kind&quot;:&quot;deployLocation&quot;[^>]*&quot;args&quot;:\[0,3\]/);
 assert.match(board,/&quot;kind&quot;:&quot;deployLocation&quot;[^>]*&quot;args&quot;:\[0,4\]/);
 assert.doesNotMatch(board,/&quot;kind&quot;:&quot;deployLocation&quot;[^>]*&quot;args&quot;:\[0,2\]/);

 run('playLocation(0,3)');
 assert.equal(run('boardLocationOrder().join()'),'3,4,5,6,2,0,1');
 assert.equal(run('state.locations[2]===dunes&&state.light[2][0]===rebel&&state.dark[2][0]===stormtrooper'),true);
 assert.equal(run('state.drainedSitesThisTurn[0]===2&&state.battledSitesThisTurn[0]===2'),true);
 assert.equal(run('adjacentSites(6,2)&&!adjacentSites(5,2)&&!adjacentSites(2,0)&&!adjacentSites(2,1)'),true);
 run('state.phase=4');
 assert.equal(run('moveCharacter(2,0,5)'),false);
 assert.equal(run('moveCharacter(2,0,6)'),true);
 assert.equal(run('state.light[6][0]===rebel&&state.dark[2][0]===stormtrooper&&state.force.length===4'),true);
});

test('the bot inserts Death Star and Yavin 4 sites using the same legal order',async()=>{
 const {run}=await craftHarness();
 run(`state.activeSide='Dark';state.botTurn={steps:[],index:0};
  state.locations=[card('Dark:682'),card('Dark:2848'),card('Light:2859'),null];
  state.light=[[],[],[],[]];state.dark=[[],[],[],[]];
  state.botHand=[card('Dark:675'),card('Dark:669'),card('Dark:2852'),card('Dark:2854')];`);
 assert.equal(run('botDeployPhase().length'),4);
 assert.equal(run('boardLocationOrder().map(slot=>state.locations[slot].id).join()'),
  'Dark:682,Dark:669,Dark:675,Light:2859,Dark:2852,Dark:2854,Dark:2848');
 assert.equal(run('adjacentSites(4,3)&&adjacentSites(2,5)&&adjacentSites(5,6)'),true);
 assert.equal(run('adjacentSites(3,2)||adjacentSites(6,1)'),false);
 assert.equal(run('state.botForce.length'),5);
});

test('a seed and the recorded action choices reproduce setup and both sides’ zone order',async()=>{
 const {run}=await premiereHarness();
 run(`start(1);
  chooseStart(startingLocationChoices(setupDecks.light)[1].index);
  beginStartingGame();
  for(let i=0;i<7;i++)botNextStep();
  requestAction('activate','Light',[1]);
  requestAction('advance','Light');
  const recorded=state.game.actions.slice();
  const snapshot=()=>JSON.stringify([state.phase,state.activeSide,state.locations,state.light,state.dark,
   state.deck,state.botDeck,state.force,state.botForce,state.hand,state.botHand,state.used,state.botUsed,state.game.randomState]);
  const original=snapshot();
  start(1,false);`);
 assert.equal(run('recorded.every(action=>requestAction(action.kind,action.side,action.args,false))'),true);
 assert.equal(run('snapshot()===original'),true);
 assert.equal(run(`new Set([...state.deck,...state.botDeck,...state.force,...state.botForce,...state.hand,...state.botHand,
  ...state.used,...state.botUsed,...state.lost,...state.botLost,...state.locations.filter(Boolean),...state.light.flat(),...state.dark.flat()]
  .flatMap(card=>[card,...(card.weapons??[])]).map(card=>card.instanceId)).size`),120);
});

function autosaveStorage(){
 const values=new Map();
 return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
}

test('selectable Premiere decks complete matches with legal decisions and conserve all card instances',async()=>{
 const {run}=await premiereHarness();
 run(`presentGame=()=>{};
 function inventory(){
  const roots=[...state.locations.filter(Boolean),...(state.outOfPlay??[]),...Object.values(state.convertedLocations??{}).flat(),
   ...Object.values(state.locationWeapons??{}).flat(),
   ...Object.values(state.locationEffects??{}).flat().map(effect=>effect.card),
   ...[...(state.buriedMines??[]),...(state.lostPileEffects??[])].map(effect=>effect.card)];
  if(state.blasterRack)roots.push(state.blasterRack.card,...state.blasterRack.weapons);
  for(const effect of state.tableEffects??[]){
   if(!effect.host)roots.push(effect.card);
   roots.push(...(effect.support??[]),...(effect.weapons??[]));
  }
  for(const side of PremiereGame.sides){
   const {deck,hand,force,used,lost,board}=PremiereGame.zones(state,side);
   roots.push(...deck,...hand,...force,...used,...lost,...board.flat());
  }
  function walk(card){
   return [card.instanceId,...[...(card.weapons??[]),...(card.attachments??[]),
    ...(card.occupants??[]).map(entry=>entry.card),...(card.escortedCaptive?[card.escortedCaptive]:[])].flatMap(walk)];
  }
  return roots.flatMap(walk);
 }
 function playMatch(seed,cardRulesVersion=latestCardRulesVersion,botVersion=cardRulesVersion===0?0:1,decks=starterDecks,player='Light'){
  start(seed,true,false,decks,cardRulesVersion,botVersion,player);
  const bot=PremiereGame.otherSide(player);
  const choose=()=>{
   const choices=startingLocationChoices(setupDecks[player.toLowerCase()]);
   return chooseStart(choices[1]?.index??choices[0]?.index??null);
  };
  choose();
  for(let retries=0;setupDecks.revealed.collision;retries++){if(retries>40)throw Error("Setup collision loop "+seed);retryStartingLocations();choose();}
  beginStartingGame();
  const summary={seed,ground:false,space:false,responses:0,reactions:0,botActions:0,validated:0};
  for(let step=0;step<1600&&!state.gameWinner;step++){
   if(!PremiereGame.responseWindow(state.game)&&!battleSession&&!state.game.timing.pending&&
      !state.pendingCardView&&!state.pendingReserveSearch&&!state.pendingCustody?.length&&!state.automatedPending){
    const ids=inventory();
    if(ids.length!==120||new Set(ids).size!==120||ids.some(id=>!id))throw Error('Card balance at '+seed+'/'+step);
    summary.validated++;
   }
   const own=legalActions(state,player),rival=legalActions(state,bot);
   const response=PremiereGame.responseWindow(state.game);
   if(response)summary.responses++;
   if(battleSession)summary[isSystem(state.locations[battleSession.site])?'space':'ground']=true;
   if(rival.some(action=>['botStep','botDecision'].includes(action.kind))&&
      !state.pendingForceLoss&&!battleSession&&!response&&!state.game.timing.pending&&!state.automatedPending&&
      !state.pendingCardView&&!state.pendingReserveSearch&&!state.pendingCustody?.length){
    if(!botNextStep())throw Error('Bot refused a step at '+seed+'/'+step);
    summary.botActions++;
    continue;
   }
   const preferred=['resolveMine','automatedTarget','reactDeploy','react','interruptResponse','passResponse','timingTrigger','battlePrediction','duel','custody','takeFromReserve',
    'fireWeapon','battleEffect','passWeapons','destiny','skipDestiny','battleForfeit','battleForceLoss','passDamage','loseForce',
    'deployLocation','convertLocation','deployWithPilot','equip','deploy','battle','drain','activate','draw','advance','skipSeekerMove','passSpyMovement'];
   const options=own.length?own:rival;
   let action;
   if(!own.length&&botVersion===2)action=botPromptAction(rival);
   if(!own.length&&battleSession?.weaponTurn===bot)action=botWeaponAction();
   if(!own.length&&battleSession?.damage?.priority===bot)action=botDamageAction();
   if(!action&&state.pendingCardView){
    action=options.find(option=>['confirm','deploy','recover','relocate','pay','retrieve','done','pass'].includes(option.args[0]))??options[0];
   }
   action??=preferred.map(kind=>kind==='activate'?options.filter(action=>action.kind===kind).at(-1):
    options.find(action=>action.kind===kind)).find(Boolean);
   if(!action||!performAction(action))throw Error('Unresolved '+(action?.kind??options.map(option=>option.kind))+' at '+seed+'/'+step+' phase '+state.phase);
   if(['react','reactDeploy','interruptResponse'].includes(action.kind))summary.reactions++;
  }
  const ids=inventory();
  if(ids.length!==120||new Set(ids).size!==120||ids.some(id=>!id))throw Error('Final card balance at '+seed);
  return {...summary,winner:state.gameWinner,turn:state.turn,trace:JSON.stringify(state.game.actions)};
 }`);
 const matches=[3,4,9].map(seed=>JSON.parse(run(`JSON.stringify(playMatch(${seed}))`)));
 assert.ok(matches.every(match=>match.winner&&match.botActions>0&&match.validated>0));
 assert.deepEqual(new Set(matches.map(match=>match.winner)),new Set(['Light','Dark']));
 assert.ok(matches.some(match=>match.ground&&match.space&&match.reactions>0),
  JSON.stringify(matches.map(({trace,...match})=>match)));
 const legacy=JSON.parse(run('JSON.stringify(playMatch(4,0))'));
 assert.ok(legacy.winner&&legacy.ground&&legacy.space,
  JSON.stringify({...legacy,trace:undefined}));
 assert.deepEqual(JSON.parse(run('JSON.stringify(playMatch(4))')),matches.find(match=>match.seed===4));
 const planned=JSON.parse(run('JSON.stringify(playMatch(4,latestCardRulesVersion,2))'));
 assert.ok(planned.winner&&planned.botActions>0&&planned.validated>0,JSON.stringify({...planned,trace:undefined}));
 assert.deepEqual(JSON.parse(run('JSON.stringify(playMatch(4,latestCardRulesVersion,2))')),planned);
 const themes=JSON.parse(run(`JSON.stringify(deckChoices.light.slice(1).map(({deck:light},index)=>
  playMatch(index+6,latestCardRulesVersion,2,{light,dark:deckChoices.dark[index+1].deck})))`));
 assert.ok(themes.every(match=>match.winner&&match.botActions>0&&match.validated>0),JSON.stringify(themes.map(({trace,...summary})=>summary)));
 const crossMatches=JSON.parse(run(`JSON.stringify(deckChoices.light.map(({deck:light},index)=>
  playMatch(index+20,latestCardRulesVersion,2,{light,dark:deckChoices.dark[(index+2)%deckChoices.dark.length].deck})))`));
 assert.ok(crossMatches.every(match=>match.winner&&match.botActions>0&&match.validated>0),JSON.stringify(crossMatches.map(({trace,...summary})=>summary)));
 const darkPlayer=JSON.parse(run("JSON.stringify(playMatch(4,latestCardRulesVersion,2,starterDecks,'Dark'))"));
 assert.ok(darkPlayer.winner&&darkPlayer.botActions>0&&darkPlayer.validated>0&&(darkPlayer.ground||darkPlayer.space),
  JSON.stringify({...darkPlayer,trace:undefined}));
 const mixed=JSON.parse(run(`const choices=formatDeckChoices[mixedFormat];
  const decks={light:choices.light.find(({deck})=>deck.theme?.id==='korvette-und-jaeger').deck,
   dark:choices.dark.find(({deck})=>deck.theme?.id==='imperiale-garnison').deck};
  const tatooine={light:choices.light.find(({deck})=>deck.theme?.id==='tatooine-verbuendete').deck,
   dark:choices.dark.find(({deck})=>deck.theme?.id==='tusken-ueberfall').deck};
  JSON.stringify([playMatch(19,latestCardRulesVersion,3,decks,'Light'),playMatch(21,latestCardRulesVersion,3,decks,'Dark'),
   playMatch(22,latestCardRulesVersion,3,tatooine,'Light')])`));
 const expanded=JSON.parse(run(`JSON.stringify(['rote-staffel','droidenstuetzpunkt','jedi-auf-tatooine','rettungsteam','corellianische-eskorte','bith-ensemble'].flatMap((id,index)=>{
  const choices=formatDeckChoices[mixedFormat],decks={light:choices.light.find(({deck})=>deck.theme?.id===id).deck,
   dark:choices.dark.find(({deck})=>deck.theme?.id===['schwarze-staffel','blockade-von-kessel','imperiale-sondereinheit','imperiales-spionagenetz','schwarze-eskorte','jawa-schrottmarkt'][index]).deck};
  return ['Light','Dark'].map((side,n)=>playMatch(31+index*2+n,latestCardRulesVersion,3,decks,side));
 }))`));
 assert.ok(expanded.every(match=>match.winner&&match.validated>0),JSON.stringify(expanded.map(({trace,...summary})=>summary)));
 assert.ok(mixed.every(match=>match.winner&&match.botActions>0&&match.validated>0),
  JSON.stringify(mixed.map(({trace,...summary})=>summary)));
});

function startSavedGame(run,seed=0){
 run(`const act=(kind,side='Light',args=[])=>dispatchUI(PremiereGame.offer(currentGame(),side,kind,args));
  el('autoBotDeck').checked=false;el('gameSeed').value='${seed}';el('trainingBattle').checked=false;el('start').onclick();`);
}

test('every Premiere card has a visible inspector guide and a readable image fallback',async()=>{
 const {run}=await premiereHarness();
 assert.equal(run(`catalog.length===324&&catalog.every(card=>{
  const details=cardTextDetails(card);
  return ['Aktiver Spieltext','Deutsche Erklärung','Auslösezeitpunkt','Beispiel','Stand der Umsetzung'].every(label=>
   details.includes('<h3>'+label+'</h3><p'));
 })`),true);
 assert.match(run(`showCardWithStats(catalog[0]);el('cardInspectorBody').innerHTML`),/inspector-fallback.*Kartenbild nicht verfügbar/);
});

test('playmat shows a public active location effect only where it applies',()=>{
 const {run}=reactHarness();
 run(`state.locationEffects[0]=[{card:{name:'Expand The Empire'}}];state.drainedSitesThisTurn=[1];`);
 const column=slot=>run(`renderPlaymatColumn(state.locations[${slot}],${slot})`);
 assert.match(column(0),/Aktive Bedingungen.*Expand The Empire/);
 assert.doesNotMatch(column(1),/Expand The Empire/);
 assert.match(column(1),/Force Drain in diesem Zug angesagt/);
 assert.doesNotMatch(column(0),/Force Drain in diesem Zug angesagt/);
});

test('Force and Deploy exercise preserves the fixed hand, replays safe Undo and records the completed goal',async()=>{
 const storage=autosaveStorage();
 const fixture=await premiereHarness(starterLists,{storage});
 const {run}=fixture;
 run(`startNewGame(undefined,false,'force');saveActiveGame();
 const playLesson=(kind,filter=()=>true)=>dispatchUI(legalActions(state,'Light').find(action=>action.kind===kind&&filter(action)));`);
 const opening=run('JSON.stringify(state.hand.map(card=>card.id))');
 const cursor=run('state.game.randomState');
 assert.equal(run("state.activeSide==='Light'&&state.phase===0&&state.hand[0].id==='Light:1593'"),true);
 assert.equal(run("playLesson('activate',action=>action.args[0]===3)&&undoAvailable"),true);
 const reload=await premiereHarness(starterLists,{storage});
 assert.equal(reload.run('resumeGameFromUI()&&undoLearningStep()'),true);
 assert.equal(reload.run('state.game.randomState'),cursor);
 assert.equal(reload.run('JSON.stringify(state.hand.map(card=>card.id))'),opening);
 assert.equal(reload.run("state.force.length===0&&state.game.seed===1091&&!state.activated&&activeSave.commands.length===0"),true);
 assert.ok(run(`lastSavedValue=localStorage.getItem(saveKey);
  playLesson('advance')&&playLesson('advance')&&playLesson('deploy',a=>a.args[1]===0&&a.card.id==='Light:1593')&&
  playLesson('deploy',a=>a.args[1]===0&&a.card.id==='Light:2052'&&a.cost===0)`));
 assert.match(fixture.elements.get('lessonHint').textContent,/Übung abgeschlossen/);
 assert.equal(run('undoLearningStep()'),false);
});

test('ground-battle exercise fires its assigned weapon and finishes real battle damage',async()=>{
 const {run}=await premiereHarness();
 run(`startNewGame(undefined,false,'battle');
 const playLesson=(kind,filter=()=>true)=>dispatchUI(legalActions(state,'Light').find(action=>action.kind===kind&&filter(action)));`);
 assert.equal(run("playLesson('battle',a=>a.args[0]===0)&&playLesson('fireWeapon')"),true);
 assert.equal(run("battleSession.hitUnits.Dark.some(card=>card.id==='Dark:2355')"),true);
 assert.equal(run(`for(let step=0;battleSession&&step<40;step++){
  const light=legalActions(state,'Light');
  const preferred=['passResponse','passWeapons','destiny','skipDestiny','battleForfeit','battleForceLoss','passDamage'];
  const offer=preferred.map(kind=>light.find(action=>action.kind===kind)).find(Boolean)??botPromptAction();
  if(!offer||!dispatchUI(offer))break;
 }!battleSession&&lessonProgress().index===3&&!undoAvailable&&state.botLost.some(card=>card.id==='Dark:2355')`),true);
});

test('movement exercise uses both real movement rules and can restart and reload the exact action trace',async()=>{
 const {run,elements}=await premiereHarness(starterLists,{storage:autosaveStorage()});
 run("startNewGame(undefined,false,'movement');saveActiveGame()");
 assert.equal(run(`const moves=()=>legalActions(state,'Light').filter(action=>action.kind==='move');
  const go=(from,to)=>dispatchUI(moves().find(action=>action.from===from&&action.to===to));
  moves().some(action=>action.from===0&&action.to===2&&action.cost===0)&&go(0,2)&&
  moves().some(action=>action.from===3&&action.to===1&&action.cost===1)&&go(3,1)&&lessonProgress().index===2`),true);
 const snapshot=run('JSON.stringify(scenarioSnapshot())');
 run(`const recorded=${JSON.stringify(snapshot)}`);
 assert.equal(run('endGameFromUI()&&openGameReview()'),true);
 assert.match(elements.get('gameReviewEvents').innerHTML,/Landspeed.*Hyperspeed/);
 assert.equal(run("!state&&closedReview.scenario.seed===1093&&JSON.stringify(closedReview.scenario)===recorded"),true);
 assert.equal(run('restartScenario()&&state.phase===4&&lessonProgress().index===0&&activeSave.commands.length===0'),true);
 assert.equal(run("importScenario(recorded)&&lessonProgress().index===2&&state.light[1][0].id==='Light:2838'"),true);
 assert.equal(run('undoLearningStep()&&lessonProgress().index===1'),true);
});

test('Dark Side exercise drains a controlled site, brings Vader and Tarkin together and resumes their real battle',async()=>{
 const storage=autosaveStorage();
 const {run,elements}=await premiereHarness(starterLists,{storage});
 assert.equal(run("startNewGame(777,false,'dark-control')"),true);
 run('saveActiveGame()');
 assert.equal(run("currentGame().seed===1094&&playerSide()==='Dark'&&state.activeSide==='Dark'&&state.phase===1&&!state.botTurn"),true);
 assert.equal(run("confirmedPresence('Dark',1)===true&&confirmedPresence('Light',1)===false&&forceDrainValue('Dark',1)===2"),true);
 assert.equal(run("state.botForce.length===11&&state.botHand[0].id==='Dark:634'&&state.botHand[1].id==='Dark:1061'&&state.light[0][0].id==='Light:1593'"),true);
 assert.match(elements.get('lessonHint').textContent,/Presence.*kontrollierst.*Force Drain · 2 Force/);
 assert.ok(run(`const playLesson=(kind,match=()=>true)=>dispatchUI(legalActions(state,'Dark').find(a=>a.kind===kind&&match(a)));
  playLesson('drain',a=>a.args[0]===1)&&state.lost.length===2&&playLesson('advance')&&
  playLesson('deploy',a=>a.card.id==='Dark:634'&&a.args[1]===0)&&playLesson('deploy',a=>a.card.id==='Dark:1061'&&a.args[1]===0)&&playLesson('advance')`));
 assert.equal(run('lessonProgress().index'),3);
 assert.equal(run("openBattlePreview(findOffer(legalActions(state,'Dark'),'battle',0))&&state.botForce.length===1"),true);
 assert.equal(run("el('battlePreviewConfirm').onclick()&&state.botForce.length===0&&battleSession.segment==='power'"),true);
 const reload=await premiereHarness(starterLists,{storage});
 assert.equal(reload.run('resumeGameFromUI()'),true);
 assert.equal(reload.run("playerSide()==='Dark'&&battleSession.initiator==='Dark'&&lessonProgress().index===4"),true);
 assert.equal(reload.run(`const expected=printedBattleDestiny(state.botDeck.at(-1))+1;
  const playLesson=(side,kind)=>dispatchUI(legalActions(state,side).find(a=>a.kind===kind));
  playLesson('Dark','destiny')&&battleSession.darkDestiny===expected&&playLesson('Light','destiny')&&
  legalActions(state,'Dark').some(a=>a.kind==='destinyResponse'&&a.args[0]==='tarkinCancel')`),true);
 assert.equal(reload.run("playLesson('Dark','destinyResponse')&&lessonProgress().index===5"),true);
 assert.match(reload.elements.get('battleLessonHint').textContent,/Übung abgeschlossen/);
 assert.equal(reload.run("playLesson('Light','passResponse')&&playLesson('Dark','passResponse')&&battleSession.lightDestiny===0"),true);
 assert.equal(reload.run("restartScenario()&&state.phase===1&&state.botForce.length===11&&state.lost.length===0&&lessonProgress().index===0"),true);
});

test('free play gates learning reveals and the review omits covered losses and private card views',async()=>{
 const {run,elements}=await premiereHarness(starterLists,{storage:autosaveStorage()});
 run(`startNewGame(0);chooseStart(startingLocationChoices(setupDecks.light)[1].index);beginStartingGame();
  state.botHand[0]={name:'Secret Bot Hand'};
  state.botDeck.push({name:'Secret Lost Card'});
  el('showBotHand').checked=true;
  state.lostPileEffects=[{target:'Dark',card:{name:'Your Eyes Can Deceive You'}}];
  beginForceLoss('Dark',1,{reason:'drain',from:'deck'});
  state.pendingCardView={side:'Dark',mode:'macroscan',card:{name:'Macro Scan'},shown:[{name:'Secret Deck Peek'}]};
  render();inspectCard('Dark',0,'hand');inspectLostTop('Dark');`);
 assert.equal(elements.get('phaseHelp').hidden,true);
 assert.equal(elements.get('lessonPanel').hidden,true);
 assert.equal(elements.get('cardInspector').open,false);
 for(const id of ['controlPanel','botHand','pilesBot','log','botHistory']){
  assert.doesNotMatch((elements.get(id).innerHTML??'')+(elements.get(id).textContent??''),/Secret/);
 }
 assert.equal(run('undoLearningStep()'),false);
 assert.equal(run('endGameFromUI()&&openGameReview()'),true);
 assert.doesNotMatch(elements.get('gameReviewEvents').innerHTML,/Secret/);
 assert.match(elements.get('gameReviewEvents').innerHTML,/verdeckte Karte/);
});

test('learning Undo stops at a voluntarily revealed bot hand and at a private draw',async()=>{
 const {run}=await premiereHarness(starterLists,{storage:autosaveStorage()});
 run(`startNewGame(undefined,false,'force');saveActiveGame();
 const playLesson=(kind,filter=()=>true)=>dispatchUI(legalActions(state,'Light').find(action=>action.kind===kind&&filter(action)));
 playLesson('activate',action=>action.args[0]===3);
 el('showBotHand').checked=true;el('showBotHand').onchange();
 el('showBotHand').checked=false;el('showBotHand').onchange();`);
 assert.equal(run('undoLearningStep()'),false);
 assert.equal(run("playLesson('advance')&&undoLearningStep()&&state.phase===0&&state.activated"),true);
 assert.equal(run('undoLearningStep()'),false);
 assert.equal(run(`for(let step=0;step<5;step++)playLesson('advance');
  playLesson('draw')&&state.hand.length===9&&!undoLearningStep()`),true);
});

test('selected theme decks set the starting locations and are saved, replayed and previewed',async()=>{
 const storage=autosaveStorage();
 const {run,elements}=await premiereHarness(starterLists,{storage});
 run("el('autoBotDeck').checked=false;renderLaunch()");
 assert.equal(elements.get('selectLightDeck').innerHTML.match(/<option/g).length,8);
 assert.equal(elements.get('selectDarkDeck').innerHTML.match(/<option/g).length,8);
 run("el('selectLightDeck').value='falcon-kessel';el('selectLightDeck').onchange();el('viewLightDeck').onclick()");
 assert.match(elements.get('starterDeckTitle').textContent,/Kessel Run · 60 Karten/);
 assert.match(elements.get('starterDeckCards').innerHTML,/3 × •Millennium Falcon/);
 run("el('selectDarkDeck').value='imperiale-garnison';el('selectDarkDeck').onchange()");
 assert.match(elements.get('setupOptions').innerHTML,/Tatooine: Docking Bay 94.*Dantooine.*Yavin 4/);
 startSavedGame(run,19);
 assert.equal(run("act('chooseStart','Light',[setupDecks.light.startingIndices[0]])&&act('beginGame')"),true);
 assert.equal(run("state.locations[0].id"),'Light:2447');
 assert.match(run("state.locations[1].name"),/Death Star:/);
 const key=run('saveKey'),saved=JSON.parse(storage.getItem(key));
 assert.equal(saved.decks.decks.Light.theme.id,'falcon-kessel');
 assert.equal(saved.decks.decks.Dark.theme.id,'imperiale-garnison');
 const zones="JSON.stringify([state.locations,state.deck,state.botDeck,state.hand,state.botHand])";
 const original=run(zones);
 run("el('selectDarkDeck').value='blockade-von-kessel';el('selectDarkDeck').onchange()");
 assert.equal(run(zones),original);
 const reload=await premiereHarness(starterLists,{storage});
 assert.equal(reload.run("el('resumeGame').onclick()"),true);
 assert.equal(reload.run(zones),original);
 assert.equal(reload.elements.get('selectLightDeck').value,'falcon-kessel');
 assert.equal(reload.elements.get('selectDarkDeck').value,'imperiale-garnison');
});

test('the bot picks a seeded theme from the opposite side and autosave preserves its choice',async()=>{
 const storage=autosaveStorage();
 const {run,elements}=await premiereHarness(starterLists,{storage});
 for(const [side,ownDeck,opponent] of [['Light','falcon-kessel','Dark'],['Dark','vaders-jagd','Light']]){
  run(`el('playerSideChoice').value='${side}';deckSelector('${side.toLowerCase()}').value='${ownDeck}';
   deckSelector('${opponent.toLowerCase()}').value='starter';startNewGame(4)`);
  const botDeck="currentGame().starterDecks[botSide().toLowerCase()]";
  const chosen=run(`deckId(${botDeck})`);
  assert.notEqual(chosen,'starter');
  assert.equal(run(`deckId(currentGame().starterDecks[playerSide().toLowerCase()])`),ownDeck);
  assert.equal(run(`${botDeck}.cards.length===60&&${botDeck}.cards.every(card=>card.side==='${opponent}')`),true);
  assert.ok(elements.get('stats').textContent.includes(run(`deckName(${botDeck})`)));
  assert.equal(run(`startNewGame(4);deckId(${botDeck})`),chosen);
  const varied=run(`new Set([0,1,2,3,4,5,6].map(seed=>{startNewGame(seed);return deckId(${botDeck})})).size`);
  assert.ok(varied>1);
  run('startNewGame(4);saveActiveGame()');
  const saved=JSON.parse(storage.getItem(run('saveKey')));
  assert.equal(saved.decks.decks[opponent].theme.id,chosen);
  const reload=await premiereHarness(starterLists,{storage});
  assert.equal(reload.run('resumeGameFromUI()'),true);
  assert.equal(reload.run(`deckId(${botDeck})`),chosen);
  reload.run(`showStarterDeck('${opponent.toLowerCase()}')`);
  assert.equal(reload.elements.get('starterDeckTitle').textContent,reload.run(`deckName(${botDeck})+' · 60 Karten'`));
 }
});

test('the two additional Premiere decks start together and preserve their cards through autosave',async()=>{
 const storage=autosaveStorage();
 const {run}=await premiereHarness(starterLists,{storage});
 run("el('selectLightDeck').value='rebellen-spezialeinsatz';el('selectDarkDeck').value='imperiale-sondereinheit'");
 startSavedGame(run,801);
 assert.equal(run(`const pick=()=>act('chooseStart','Light',legalActions(null,'Light')[0].args);
  pick()&&(!setupDecks.revealed.collision||act('retrySetup')&&pick())&&act('beginGame')`),true);
 const snapshot="JSON.stringify([state.locations,state.deck.map(c=>c.id),state.botDeck.map(c=>c.id),state.hand.map(c=>c.id),state.botHand.map(c=>c.id)])";
 const opening=run(snapshot);
 assert.equal(run(`const lists=currentGame().starterDecks;
  lists.light.cards.some(card=>card.id==='Light:2385')&&lists.dark.cards.some(card=>card.id==='Dark:2517')`),true);
 const reload=await premiereHarness(starterLists,{storage});
 assert.equal(reload.run('resumeGameFromUI()'),true);
 assert.equal(reload.run(snapshot),opening);
 assert.equal(reload.elements.get('selectLightDeck').value,'rebellen-spezialeinsatz');
 assert.equal(reload.elements.get('selectDarkDeck').value,'imperiale-sondereinheit');
});

test('a mixed match keeps its format through save, reload and restart and rejects forged deck editions',async()=>{
 const storage=autosaveStorage();
 const {run}=await premiereHarness(starterLists,{storage});
 run(`el('playFormat').value='premiere-a-new-hope';el('playFormat').onchange();
  el('selectLightDeck').value='korvette-und-jaeger';el('selectDarkDeck').value='imperiale-garnison';`);
 startSavedGame(run,91);
 assert.equal(run(`act('chooseStart','Light',legalActions(null,'Light')[0].args)&&act('beginGame')`),true);
 assert.equal(run(`currentGame().starterDecks.light.cards.some(card=>card.id==='Light:2418')&&
  currentGame().starterDecks.dark.cards.some(card=>card.id==='Dark:1340')`),true);
 const snapshot=JSON.parse(run('JSON.stringify(scenarioSnapshot())'));
 assert.equal(snapshot.playFormat,'premiere-a-new-hope');
 assert.equal(snapshot.expansionRevision,snapshot.cardRevision);
 const zones='JSON.stringify([state.locations,state.deck,state.botDeck,state.hand,state.botHand])';
 const opening=run(zones);
 const reopened=await premiereHarness(starterLists,{storage});
 assert.equal(reopened.run('resumeGameFromUI()'),true);
 assert.equal(reopened.run(zones),opening);
 assert.equal(reopened.run('currentGame().playFormat'),'premiere-a-new-hope');
 assert.equal(reopened.run('restartScenario()'),true);
 assert.equal(reopened.run('currentGame().playFormat'),'premiere-a-new-hope');
 assert.equal(reopened.run('currentGame().starterDecks.light.theme.id'),'korvette-und-jaeger');
 assert.equal(run(`const forged=${JSON.stringify(snapshot)};
  forged.playFormat='premiere';delete forged.expansionRevision;
  replayScenario(forged,[],false)`),false);
 assert.equal(run(`forged.playFormat='premiere-a-new-hope';forged.expansionRevision=REVISION;
  forged.decks.decks.Dark.cards[0].id='Dark:729';forged.cardRulesVersion=28;replayScenario(forged,[],false)`),false);
 assert.equal(run(`forged.cardRulesVersion=29;replayScenario(forged,[],false)`),true);
 assert.equal(run(`forged.decks.decks.Dark.cards[0].id='Dark:2915';replayScenario(forged,[],false)`),false);
});

test('a legacy scenario can still restart with the four original Garrison additions',async()=>{
 const {run}=await premiereHarness();
 assert.equal(run(`const legacyGarrison=JSON.parse(${JSON.stringify(themedLists)}).decks.Dark[0];
  const legacy={seed:17,trainingBattle:false,cardRulesVersion:25,botStrategyVersion:2,commands:[],
   decks:{schema:1,decks:{Light:selectedDeck('light').definition,Dark:legacyGarrison}}};
  replayScenario(legacy,legacy.commands,false)&&currentGame().playFormat===undefined&&
   currentGame().starterDecks.dark.cards.filter(card=>card.id==='Dark:2915').length===3`),true);
});

test('A New Hope detention and Force drains respect physical presence',async()=>{
 const {run}=await premiereHarness();
 run(`state=null;setupDecks=null;const findCard=id=>structuredClone([...catalog,...aNewHopeCatalog].find(card=>card.id===id));
  const it=findCard('Dark:1340'),guard=findCard('Dark:1588'),mosep=findCard('Dark:1700');
  const captive={...findCard('Light:1593'),captured:true,imprisoned:true};
  const prison=findCard('Dark:673'),adjacent=findCard('Dark:682');
  prison.icons.light=2;adjacent.icons.light=2;
  const enemy={name:'Wookiee',type:'Character',subType:'Alien',characteristics:['wookiee'],ability:2};
  state={phase:1,activeSide:'Dark',locations:[prison,adjacent],dark:[[it,guard,captive],[mosep]],light:[[],[]],
   deck:[{name:'Deck'}],hand:[{name:'Hand'}],used:[],force:[{name:'Force'}],botDeck:[{}],botForce:[],
   botHand:[],botUsed:[],lost:[],botLost:[],log:[]};
  state.game=PremiereGame.actionState(900,7);state.game.cardRulesVersion=26;state.game.playerSide='Light';
  const forceLossChoices=()=>legalActions(state,'Light').filter(action=>action.kind==='loseForce');`);
 assert.equal(run(`locationTitle(prison)`),'death star: detention block corridor');
 assert.equal(run(`forceDrainEffects('Dark',0).modifier-forceDrainEffects('Dark',1).modifier`),1);
 assert.equal(run(`siteDroids().some(entry=>entry.card===it)`),false);
 assert.equal(run(`cardPowerModifier(guard,'Dark',0)`),2);
 assert.equal(run(`state.light[0].push(enemy);cardPowerModifier(guard,'Dark',0)`),5);
 assert.equal(run(`enemy.inactive=true;cardPowerModifier(guard,'Dark',0)`),2);
 assert.equal(run(`state.light[0]=[];resolveForceDrain('Dark',0,0);JSON.stringify(forceLossChoices().map(o=>o.args[0]))`),'["deck"]');
 assert.equal(run(`loseForceForDrain('Light','hand',0)`),false);
 assert.equal(run(`loseForceForDrain('Light','deck')&&forceLossChoices().some(o=>o.args[0]==='hand')`),true);
});

test('A New Hope ships deploy and dock with their printed limits',async()=>{
 const {run}=await premiereHarness();
 run(`const lookup=id=>structuredClone([...catalog,...aNewHopeCatalog].find(card=>card.id===id));
  const corvette=lookup('Light:2418'),pilot=lookup('Light:2040'),black=lookup('Dark:247'),reserve=lookup('Dark:2094');
  const system={name:'Tatooine',type:'Location',subType:'System',parsec:7,locationTags:['Planet'],icons:{light:0,dark:1}};
  setupDecks=null;state={locations:[system],light:[[]],dark:[[black]],force:Array(5).fill({}),botForce:[],log:[]};
  state.game=PremiereGame.actionState(901,8);state.game.cardRulesVersion=26;`);
 assert.equal(run(`boardDeployCost(corvette,system,'Light')`),5);
 assert.equal(run(`boardDeployCost(lookup('Light:530'),system,'Light')`),null);
 assert.equal(run(`state.light[0].push(corvette);craftStats(corvette,0).ability`),2);
 assert.equal(run(`canDock(corvette,black,0)`),true);
 assert.equal(run(`corvette.occupants=Array.from({length:3},()=>({card:{...pilot},role:'pilot'}));
  !PremiereUnits.accepts(corvette,pilot,'pilot')&&PremiereUnits.accepts(corvette,pilot,'passenger')`),true);
 assert.equal(run(`const stockPower=black.power,stockManeuver=black.maneuver;
  PremiereUnits.add(black,reserve,'pilot','Dark');
  craftStats(black,0).power===stockPower+1&&craftStats(black,0).maneuver===stockManeuver+1&&battleDestinyDrawCount('Dark',0,1)===1`),true);
});

test('A New Hope commanders apply their printed modifiers at the same site',async()=>{
 const {run}=await premiereHarness();
 run(`const findCard=id=>structuredClone([...catalog,...aNewHopeCatalog].find(card=>card.id===id));
  const commander=findCard('Light:2035'),rebel=findCard('Light:2040'),leader=findCard('Light:1021'),warrior=findCard('Dark:2355');
  const spy={...rebel,characteristics:['bothan','spy']};
  const site=findCard('Light:2447');setupDecks=null;
  state={locations:[site],light:[[commander,rebel,leader]],dark:[[warrior]],force:[],botForce:[],log:[]};`);
 assert.equal(run(`cardForfeitValueAt(rebel,'Light',0)===rebel.forfeit+1&&cardForfeitValueAt(leader,'Light',0)===leader.forfeit&&
  cardForfeitValueAt(warrior,'Dark',0)===warrior.forfeit&&crewDeployCost(spy,'Light',site)===0`),true);
 assert.equal(run(`state.light[0].push({...commander});cardForfeitValueAt(rebel,'Light',0)`),run(`rebel.forfeit+1`));
 assert.equal(run(`state.light[0]=[];state.dark[0].push(findCard('Dark:1267'));cardForfeitValueAt(warrior,'Dark',0)`),run(`warrior.forfeit+1`));
});

test('A New Hope space weapons use their printed hosts and outcomes',async()=>{
 const {run}=await premiereHarness();
 assert.equal(run(`const card=id=>structuredClone([...catalog,...aNewHopeCatalog].find(x=>x.id===id));
  const ion=card('Light:2389'),laser=card('Dark:872'),tie=card('Dark:2600'),wing=card('Light:2907'),capital=card('Light:2418');
  PremiereWeapons.deployCost(ion,wing)===1&&PremiereWeapons.deployCost(ion,card('Light:2052'))===null&&
  PremiereWeapons.deployCost(laser,tie)===1&&PremiereWeapons.deployCost(laser,capital)===null&&
  PremiereWeapons.shot(laser,tie,capital,0,4).bonus===-2&&PremiereWeapons.shot(laser,tie,wing,0,4).bonus===0&&
  PremiereWeapons.shot(ion,wing,tie,0,2).effect==='ion'`),true);
});

test('A New Hope ground weapons distinguish bearers and creature targets',async()=>{
 const {run}=await premiereHarness();
 assert.equal(run(`const lookup=id=>[...catalog,...aNewHopeCatalog].find(card=>card.id===id);
  const bow=lookup('Light:318'),rifle=lookup('Light:1606'),tuskenRifle=lookup('Dark:2687');
  const luke={...lookup('Light:1593'),power:4},owen=lookup('Light:1883'),bast=lookup('Dark:406');
  const alien=lookup('Dark:2683'),trooper=lookup('Dark:2355'),droid=lookup('Light:1995'),bantha=lookup('Dark:191');
  setupDecks=null;state={locations:[lookup('Light:2447')],light:[[luke]],dark:[[trooper,bantha]]};
  const cost=weaponDeployCost(bow,luke),shot=weaponShot(bow,luke,trooper,2);
  luke.power=8;
  cost===3&&shot.cost===3&&shot.bonus===1&&weaponShot(bow,luke,bantha,3).cost===1&&
  weaponShot(bow,luke,bantha,3).bonus===2&&PremiereWeapons.deployCost(rifle,owen)===1&&
  PremiereWeapons.deployCost(rifle,droid)===null&&PremiereWeapons.deployCost(tuskenRifle,bast)===1&&
  PremiereWeapons.deployCost(tuskenRifle,alien)===1&&PremiereWeapons.deployCost(tuskenRifle,trooper)===3&&
  weaponShot(tuskenRifle,bast,bantha,3).bonus===2&&weaponShot(rifle,luke,trooper,2).bonus===-1`),true);
});

test('A New Hope starships enforce matching pilots and noncumulative orbital support',async()=>{
 const {run}=await premiereHarness();
 assert.equal(run(`const lookup=id=>structuredClone([...catalog,...aNewHopeCatalog].find(card=>card.id===id));
  const red=lookup('Light:2059'),wedge=lookup('Light:2786'),victory=lookup('Dark:2715'),droid=lookup('Light:1995');
  setupDecks=null;state={locations:[lookup('Light:2430'),lookup('Light:2447'),lookup('Light:2853')],
   light:[[red],[],[]],dark:[[victory,{...victory}],[],[]]};
  const canBoard=PremiereUnits.accepts(red,wedge,'pilot')&&PremiereUnits.accepts(red,droid,'astromech');
  const before=battleImmunity('Light',red,0,[]);
  PremiereUnits.add(red,wedge,'pilot','Light');
  canBoard&&before===0&&battleImmunity('Light',red,0,[])===3&&orbitalSupportPower('Dark',1)===1&&
   orbitalSupportPower('Dark',2)===0&&craftStats(victory,0).ability===1&&PremiereUnits.hasDock(victory)`),true);
});

test('A New Hope pilots and droids add bonuses in the correct seat and phase',async()=>{
 const {run}=await premiereHarness();
 assert.equal(run(`const lookup=id=>structuredClone([...catalog,...aNewHopeCatalog].find(card=>card.id===id));
  const dark=lookup('Dark:2715'),light=lookup('Light:2907'),danz=lookup('Dark:611'),r5a=lookup('Dark:2002'),r5d=lookup('Light:2003');
  setupDecks=null;state={locations:[lookup('Light:2430')],activeSide:'Dark',phase:2,light:[[light]],dark:[[dark]],log:[]};
  state.game=PremiereGame.actionState(910,0);
  const shot={host:dark,from:0};
  PremiereUnits.add(dark,danz,'pilot','Dark');
  const pilots=craftStats(dark,0).power===dark.power+3&&weaponDestinyModifier('Dark',shot)===0;
  dark.occupants[0].role='passenger';
  PremiereUnits.add(light,r5d,'passenger','Light');PremiereUnits.add(dark,r5a,'passenger','Dark');
  const passengers=craftStats(dark,0).power===dark.power+1&&craftStats(light,0).maneuver===light.maneuver+1&&weaponDestinyModifier('Dark',shot)===1;
  light.ionDamage=dark.ionDamage=true;
  restoreIonDamage();const stillDamaged=dark.ionDamage===true;
  state.phase=1;restoreIonDamage();
  pilots&&passengers&&stillDamaged&&light.ionDamage===true&&craftStats(dark,0).hyperspeed===dark.hyperspeed`),true);
});

test('A New Hope officers search without discarding themselves',async()=>{
 const {run}=await premiereHarness();
 assert.equal(run(`const khurgee=aNewHopeCatalog.find(card=>card.id==='Dark:362'),crew=catalog.find(card=>card.name==='Scanning Crew');
  const site=catalog.find(card=>card.id==='Dark:682');setupDecks=null;
  state={locations:[site],activeSide:'Dark',phase:1,light:[[]],dark:[[khurgee]],botDeck:[crew,{name:'Other'}],
   botForce:[{},{},{},{}],botHand:[],botUsed:[],botLost:[],log:[]};state.game=PremiereGame.actionState(911,0);
  const action=unitReserveSearchOptions('Dark')[0];
  !!action&&beginUnitReserveSearch('Dark',action.args[0])&&reserveSearchChoices(state.pendingReserveSearch)[0]?.card===crew&&finishReserveSearch(0)&&
   state.botHand[0]===crew&&state.dark[0][0]===khurgee&&state.botLost.length===0&&state.botForce.length===2&&unitReserveSearchOptions('Dark').length===0`),true);
});

test('A New Hope Tusken leader deploys on Tatooine and grants a fallback destiny',async()=>{
 const {run}=await premiereHarness();
 assert.equal(run(`const leader=aNewHopeCatalog.find(card=>card.id==='Dark:2683'),raider=catalog.find(card=>card.id==='Dark:2648');
  const desert=catalog.find(card=>card.id==='Light:2447'),death=catalog.find(card=>card.id==='Dark:682');setupDecks=null;
  state={locations:[desert,death],light:[[],[]],dark:[[leader],[]]};
  const alone=battleDestinyDrawCount('Dark',0,2)===0;state.dark[0].push(raider);
  alone&&battleDestinyDrawCount('Dark',0,3)===1&&battleDestinyDrawCount('Dark',0,4)===1&&
   characterLocationAllowed(leader,desert)&&!characterLocationAllowed(leader,death)&&matchesRegisteredTarget(leader,'tusken')`),true);
});

test('Corellian Slip modifies Tallon Roll or reduces one opposing fighter',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(214,0);state.activeSide='Dark';
  state.botTurn={steps:[],index:0};const roll=card('Dark:2410');const slip=aNewHopeCatalog.find(unit=>unit.id==='Light:534');
  state.light[6]=[ship];state.dark[6]=[tie];state.botHand=[roll];state.hand=[{...slip},{...slip}];
  state.botDeck=[{name:'Imperial destiny',destiny:1}];state.deck=[{name:'Rebel destiny',destiny:1}];
  const before=craftStats(tie,6).maneuver;
  const slow=pileInterruptOptions('Light').find(action=>action.rule.mode==='shipManeuverPenalty');`);
 assert.equal(run(`!!slow&&playPileInterrupt('Light',...slow.args)&&craftStats(tie,6).maneuver===Math.max(0,before-1)`),true);
 assert.equal(run(`requestAction('pileInterrupt','Dark',[0,'tallonRoll',6,0,0])`),true);
 assert.equal(run(`const response=legalActions(state,'Light').find(action=>action.responseKind==='tallonSlip');
  !!response&&performAction(response)`),true);
 assert.equal(run(`for(let step=0;step<8&&PremiereGame.responseWindow(state.game);step++){
   const next=PremiereGame.responseWindow(state.game).priority;requestAction('passResponse',next);
  }
  !PremiereGame.responseWindow(state.game)&&state.used.some(unit=>unit.id===slip.id)&&!state.lost.includes(ship)`),true);
});

test('A New Hope ship taxes and Willard respect icons, controller and war room',async()=>{
 const {run}=await premiereHarness();
 const result=JSON.parse(run(`const lookup=id=>structuredClone([...catalog,...aNewHopeCatalog].find(card=>card.id===id));
  const room=lookup('Light:2859'),system=lookup('Light:2849'),officer=lookup('Light:504'),red=lookup('Light:2059');
  const wedge=lookup('Light:2786'),tie=lookup('Dark:2600'),l=lookup('Light:1572'),d=lookup('Dark:153');
  setupDecks=null;state={locations:[room,system],light:[[officer],[red]],dark:[[],[]],
   tableEffects:[],force:[{}],used:[],lost:[],botLost:[],log:[]};state.game=PremiereGame.actionState(912,0);
  PremiereUnits.add(red,wedge,'pilot','Light');
  const fresh={...red,occupants:[]},armed=craftStats(red,1),noTax=craftDeployCost(fresh,system,'Light',wedge),tiePrice=craftDeployCost(tie,system,'Dark');
  state.tableEffects.push({card:l,target:'Dark'},{card:d,target:'Light'});
  const taxes=craftDeployCost(fresh,system,'Light',wedge)===noTax+1&&craftDeployCost({...fresh,navComputer:false},system,'Light',wedge)===noTax&&
   craftDeployCost(tie,system,'Dark')===tiePrice+1;
  const cancelled=performUnitTableCancel('Light',1)&&state.botLost.includes(d)&&state.force.length===0;
  state.light[0]=[];
  JSON.stringify({taxes,cancelled,warRoomPower:armed.power-red.power,matchingManeuver:armed.maneuver-red.maneuver,
   pilotPower:craftStats(red,1).power-red.power})`));
 assert.deepEqual(result,{taxes:true,cancelled:true,warRoomPower:4,matchingManeuver:2,pilotPower:3});
});

test('A New Hope system and officer reacts respect ship factions and range',async()=>{
 const {run}=await premiereHarness();
 const result=JSON.parse(run(`const lookup=id=>structuredClone([...catalog,...aNewHopeCatalog].find(card=>card.id===id));
  const corellia=lookup('Light:527'),ralltiir=lookup('Light:2017'),darkRalltiir=lookup('Dark:2016'),
   yavin=lookup('Light:2849'),warRoom=lookup('Light:2859'),death=lookup('Dark:654'),bridge=lookup('Dark:682');
  const tantive=lookup('Light:2418'),devastator=lookup('Dark:723'),evax=lookup('Dark:1824'),lajaie=lookup('Light:493');
  const longRoute={...yavin,parsec:corellia.parsec+devastator.hyperspeed+1};
  setupDecks=null;state={locations:[corellia,ralltiir,yavin,warRoom,death,bridge,longRoute],
   light:[[tantive],[],[],[lajaie],[],[],[]],dark:[[devastator],[],[],[],[],[evax],[]],
   hand:[lookup('Light:1677'),lookup('Light:2907'),lookup('Light:2040')],force:Array(12).fill({}),botForce:Array(12).fill({}),log:[]};
  state.game=PremiereGame.actionState(914,0);
  const aloud=site=>reactOptions('Light',{kind:'battle',side:'Dark',site}).some(option=>option.card===tantive);
  const launch=reactDeployOptions('Light',{kind:'battle',side:'Dark',site:0}).map(option=>option.card.id);
  const movement=travelOptions(devastator,'Dark',0,6).some(choice=>choice.kind==='Hyperspeed');
  const incoming=travelOptions(devastator,'Dark',6,0).length;
  const evaxMove=reactOptions('Dark',{kind:'battle',side:'Light',site:4}).some(option=>option.card===devastator);
  const unescorted=aloud(1),launchedByOfficer=aloud(2),wrongFaction=officerShipReact('Light',devastator,2);
  const discounted=craftDeployCost(devastator,ralltiir,'Dark')===devastator.deploy-2;
  state.locations[1]=darkRalltiir;
  const free=travelOptions(devastator,'Dark',0,1).some(choice=>choice.cost===0);
  const power=registeredLocationModifier('power',devastator,'Dark',1)+registeredLocationModifier('power',tantive,'Light',1);
  state.dark[5]=[];const withoutOfficer=officerShipReact('Dark',devastator,4);
  JSON.stringify({launch,movement,incoming,evaxMove,unescorted,launchedByOfficer,wrongFaction,discounted,free,power,withoutOfficer})`));
 assert.deepEqual(result,{launch:['Light:1677'],movement:true,incoming:0,evaxMove:true,unescorted:true,launchedByOfficer:true,
  wrongFaction:false,discounted:true,free:true,power:2,withoutOfficer:false});
});

test('Interior battle interrupts exclude both sides without removing cards',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(915,0);state.phase=3;
  const l=card('Light:1593'),d=card('Dark:1061'),rebel=card('Light:2040'),trooper=card('Dark:2355');
  const door=aNewHopeCatalog.find(unit=>unit.id==='Light:255'),stun=aNewHopeCatalog.find(unit=>unit.id==='Dark:2368');
  state.locations[4]=card('Dark:682');state.light[4]=[l,rebel];state.dark[4]=[d,trooper];
  state.hand=[door];state.botHand=[stun];
  const pass=()=>requestAction('passResponse',PremiereGame.responseWindow(state.game).priority);`);
 assert.equal(run(`requestAction('battle','Light',[4])&&performAction(legalActions(state,'Dark').find(action=>action.responseKind==='interiorExclusion'))`),true);
 assert.equal(run(`pass()&&pass()&&battleSession.excludedUnits.has(l)&&battleSession.excludedUnits.has(d)&&
  !battleSession.excludedUnits.has(rebel)&&!battleSession.excludedUnits.has(trooper)&&state.botLost.includes(stun)&&
  state.light[4].includes(l)&&state.dark[4].includes(d)&&state.botForce.length===4`),true);
});

test('Houjix and Ghhhk relieve damage only after the last available forfeit',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(916,0);state.phase=3;
  const houjix=aNewHopeCatalog.find(unit=>unit.id==='Light:1183'),ghhhk=aNewHopeCatalog.find(unit=>unit.id==='Dark:1035');
  const fighter=card('Light:1593');state.light[4]=[fighter];state.dark[4]=[];state.hand=[houjix];state.botHand=[ghhhk,card('Dark:2216')];
  battleSession={site:4,segmented:true,segment:'damage',participants:{Light:[fighter],Dark:[]},weaponHits:{Light:[],Dark:[]},
   damage:{priority:'Light',passes:0,result:{lightTotal:0,darkTotal:5},debt:{Light:{damage:5,attrition:0,hits:[],immunity:[]}}}};
  const offers=()=>battleDamageOptions('Light');`);
 assert.equal(run(`offers().some(action=>action.kind==='damageRelief')`),false);
 assert.equal(run(`state.light[4]=[];offers().some(action=>action.kind==='damageRelief'&&action.card===houjix)`),true);
 assert.equal(run(`battleDamageAction('Light','damageRelief',[0])&&state.lost.includes(houjix)&&battleSession.damage.debt.Light.damage===0&&
  !PremiereGame.responseWindow(state.game)&&namedCancellation(ghhhk,{type:'Effect',name:'Nightfall'})`),true);
});

test('Grimtaash shares its once-per-turn limit across all three modes',async()=>{
 const {run}=await craftHarness();
 assert.equal(run(`setupDecks=null;state.game=PremiereGame.actionState(917,0);
  const grim=aNewHopeCatalog.find(unit=>unit.id==='Light:1081');state.hand=[{...grim},{...grim}];
  state.botHand=Array.from({length:13},(_,i)=>({name:'Hand '+i}));
  state.tableEffects=[{target:'Dark',card:card('Dark:1688')}];
  const canCancel=tableCancellationOptions('Light').length>0;
  const trim=playPileInterrupt('Light',0,'trimHand');
  canCancel&&trim&&state.botHand.length===8&&tableCancellationOptions('Light').length===0&&
   !pileInterruptOptions('Light').some(offer=>offer.rule.mode==='revealDuplicates')`),true);
});

test('A New Hope musician modifiers distinguish at from present with',async()=>{
 const {run}=await craftHarness();
 assert.equal(run(`setupDecks=null;state.game=PremiereGame.actionState(918,0);state.activeSide='Dark';state.phase=1;
  const pick=id=>aNewHopeCatalog.find(unit=>unit.id===id);
  const doikk={...pick('Light:751')},ickabel={...pick('Light:1242')},figrin=card('Light:942'),crawler=card('Light:2161');
  state.light[2]=[doikk,ickabel,crawler];state.dark[3]=[card('Dark:2355')];
  PremiereUnits.add(crawler,figrin,'passenger','Light');
  const requirements=minimumBattleDestinyAbility('Light',2)===6&&minimumBattleDestinyAbility('Dark',2)===6;
  const outside=musicianDrainCost('Dark',3)===1&&drainPlan('Dark',3)?.cost===1;
  state.light[2].push(figrin);crawler.occupants=[];
  const together=musicianDrainCost('Dark',3)===2;
  state.botForce=[{}];const unaffordable=drainPlan('Dark',3)===null;
  state.botForce.push({});
  requirements&&outside&&together&&unaffordable&&initiateForceDrain('Dark',3)&&state.botForce.length===0`),true);
});

test('A New Hope site modifiers check affiliation, leader and tax collector',async()=>{
 const {run}=await craftHarness();
 assert.equal(run(`setupDecks=null;state.game=PremiereGame.actionState(919,0);
  const pick=id=>aNewHopeCatalog.find(unit=>unit.id===id);
  const garouf=pick('Light:1013'),rodian=pick('Dark:2117'),greedo=pick('Dark:1073'),ruins=pick('Light:2857');
  const luke=card('Light:1593'),trevagg=card('Dark:934'),vader=card('Dark:634'),tantive=pick('Light:2418'),leader=card('Light:1021');
  state.light[2]=[garouf,luke];state.dark[2]=[rodian,{...vader,characteristics:['bounty hunter']},greedo];
  const tatooineForfeit=cardForfeitValueAt(luke,'Light',2)===luke.forfeit+1;
  const aura=cardPowerModifier(state.dark[2][1],'Dark',2)===1&&cardPowerModifier(greedo,'Dark',2)===-1;
  state.dark[2].push(trevagg);const suppressed=cardForfeitValueAt(luke,'Light',2)===luke.forfeit;
  state.dark[2]=[vader];state.locations[2]={...dock,name:'Hoth: Test'};
  const hothForfeit=cardForfeitValueAt(vader,'Dark',2)===vader.forfeit-1;
  state.locations[5]=ruins;state.locations[6]=pick('Dark:654');state.light[5]=[leader];state.light[6]=[tantive];
  const support=craftStats(tantive,6).power===tantive.power+1;
  state.light[5]=[];state.dark[5]=[vader];
  tatooineForfeit&&aura&&suppressed&&hothForfeit&&support&&craftStats(tantive,6).power===tantive.power&&forceDrainEffects('Dark',5).modifier===1`),true);
});

test('Space deploy reacts follow ship, attachment and Black 4 requirements',async()=>{
 const {run}=await craftHarness();
 assert.equal(run(`setupDecks=null;state.game=PremiereGame.actionState(920,0);
  const pick=id=>({...aNewHopeCatalog.find(unit=>unit.id===id)});
  const black=pick('Dark:250'),pil=pick('Dark:792'),vanguard=pick('Dark:2604'),rectenna=pick('Light:2056'),corvette=pick('Light:2418');
  const blackTwo=card('Dark:247');PremiereUnits.add(blackTwo,card('Dark:1279'),'pilot','Dark');
  const battle={kind:'battle',site:6,side:'Light'},drain={kind:'drain',site:6,side:'Light'};
  state.dark[6]=[blackTwo];state.botForce=[];state.botHand=[black,pil,card('Dark:2600')];
  const free=reactDeployOptions('Dark',battle).some(option=>option.card===black&&option.pilot===pil&&option.cost===0);
  const onlyBattle=reactDeployOptions('Dark',drain).length===0;
  state.dark[6]=[tie];
  const affordability=reactDeployOptions('Dark',battle).length===0;state.botForce=forcePile();
  const priced=reactDeployOptions('Dark',battle).some(option=>option.card===black&&option.cost===black.deploy+pil.deploy);
  state.dark[6]=[vanguard];
  const drainReact=reactDeployOptions('Dark',drain).some(option=>option.card.id==='Dark:2600');
  state.light[6]=[corvette];state.hand=[rectenna,card('Light:2907')];
  const mount=devicePlacementOptions('Light',rectenna).some(option=>option.host===corvette&&option.cost===1);
  corvette.attachments=[rectenna];
  const lightReact=()=>reactDeployOptions('Light',{...battle,side:'Dark'}).some(option=>option.card.id==='Light:2907');
  const withRectenna=lightReact();corvette.attachments=[];
  PremiereUnits.add(black,pil,'pilot','Dark');state.dark[6]=[black];
  free&&onlyBattle&&affordability&&priced&&drainReact&&mount&&withRectenna&&!lightReact()&&
  craftStats(black,6).power===black.power+3&&battleDestinyDrawCount('Dark',6,2)===1`),true);
});

test('Red 6 gives a choice for the extra destiny on A Problem Here',async()=>{
 const {run}=await craftHarness();
 assert.equal(run(`setupDecks=null;state.game=PremiereGame.actionState(921,0);
  const red={...aNewHopeCatalog.find(unit=>unit.id==='Light:2063')};
  PremiereUnits.add(red,card('Light:1390'),'pilot','Light');
  const maneuver=craftStats(red,6).maneuver,problem=card('Dark:1237');
  state.light[6]=[red];state.botHand=[problem];state.hand=[];state.botDeck=[{name:'Weapon Test',destiny:maneuver-1}];
  const frame={kind:'finishedBattle',side:'Light',site:6};PremiereGame.openResponse(state.game,frame);
  const eligible=recentlyLostOptions('Dark',frame).filter(action=>action.target===red);
  const bonus=eligible.find(action=>action.modifier===2),started=!!bonus&&requestAction('interruptResponse','Dark',bonus.args);
  for(let step=0;step<10&&PremiereGame.responseWindow(state.game);step++){
   requestAction('passResponse',PremiereGame.responseWindow(state.game).priority);
  }
  started&&eligible.length===2&&state.lost.includes(red)&&state.botLost.includes(problem)`),true);
});

test('Monnok distinguishes Used and Lost modes and respects hidden hand contents',async()=>{
 const {run}=await premiereHarness();
 run(`const monnok=aNewHopeCatalog.find(card=>card.id==='Dark:1697');
  const setupMonnok=hand=>{
   setupDecks=null;
   state={locations:[],light:[],dark:[],activeSide:'Dark',phase:1,hand,botHand:[{...monnok}],
    force:[],used:[],lost:[],deck:[{}],botForce:Array.from({length:4},()=>({})),botUsed:[],botLost:[],botDeck:[{}],log:[]};
   state.game=PremiereGame.actionState(902,7);state.game.cardRulesVersion=26;
  };
  const names=n=>Array.from({length:n},(_,i)=>({name:'Hidden '+i,side:'Light'}));`);
 assert.equal(run(`setupMonnok(names(12));pileInterruptOptions('Dark').some(o=>o.rule.mode==='trimHand')`),false);
 assert.equal(run(`setupMonnok(names(13));playPileInterrupt('Dark',0,'trimHand')&&state.hand.length===8&&state.used.length===5&&
  state.botUsed[0].id===monnok.id&&state.botForce.length===4&&!state.log.some(text=>text.includes('Hidden'))`),true);
 const selected=run(`state.used.map(card=>card.name).join(',')`);
 assert.equal(run(`setupMonnok(names(13));playPileInterrupt('Dark',0,'trimHand');state.used.map(card=>card.name).join(',')`),selected);
 assert.equal(run(`setupMonnok(['Luke Skywalker','•Luke Skywalker','Commander Luke Skywalker'].map(name=>({name,side:'Light'})));
  playPileInterrupt('Dark',0,'revealDuplicates')&&state.hand[0].name==='Commander Luke Skywalker'&&state.hand.length===1&&
  state.lost.length===2&&state.botUsed.length===4&&state.botLost[0].id===monnok.id&&
  state.log.some(text=>text.includes('deckt die Hand auf'))`),true);
});

test('reloading an expired Scomp Link Access peek keeps its cards concealed and still permits the required shuffle',async()=>{
 const lists={schema:1,decks:{
  Light:{startingLocations:['Light:2858'],cards:[
   {id:'Light:2858',count:1},{id:'Light:2447',count:19},{id:'Light:2180',count:19},
   {id:'Light:1995',count:19},{id:'Light:2907',count:2},
  ]},
  Dark:{startingLocations:['Dark:2458'],cards:[{id:'Dark:2458',count:1},{id:'Dark:2355',count:59}]},
 }};
 const storage=autosaveStorage();
 const {run,elements}=await premiereHarness(lists,{storage});
 startSavedGame(run,5);
 assert.ok(run(`Date.now=()=>1000;
  const playPeek=(kind,check=()=>true)=>dispatchUI(legalActions(state,'Light').find(action=>action.kind===kind&&check(action)));
  act('chooseStart','Light',legalActions(null,'Light')[0].args)&&act('beginGame')&&
  playPeek('activate',offer=>offer.args[0]===3)&&playPeek('advance')&&playPeek('advance')&&
  playPeek('deployLocation',offer=>offer.card.id==='Light:2447')&&
  playPeek('deploy',offer=>offer.card.id==='Light:1995'&&offer.location.id==='Light:2447')&&
  playPeek('pileInterrupt',offer=>offer.args[1]==='scompPeek'&&offer.args[2]==='Dark')`));
 assert.match(elements.get('controlPanel').innerHTML,/data-scomp-peek/);
 assert.equal(run("JSON.parse(localStorage.getItem(saveKey)).peekDeadline"),21000);
 const reload=await premiereHarness(lists,{storage});
 assert.equal(reload.run('Date.now=()=>30000;resumeGameFromUI()'),true);
 assert.doesNotMatch(reload.elements.get('controlPanel').innerHTML,/data-scomp-peek|Stormtrooper/);
 assert.match(reload.elements.get('controlPanel').innerHTML,/Reserve Deck mischen/);
 assert.equal(reload.run("dispatchUI(legalActions(state,'Light')[0])&&!state.pendingCardView"),true);
 assert.equal(reload.run("'peekDeadline' in JSON.parse(localStorage.getItem(saveKey))"),false);
});

test('legacy autosaves resume without applying new registered card rules retroactively',async()=>{
 const storage=autosaveStorage();
 const {run}=await premiereHarness(starterLists,{storage});
 startSavedGame(run);
 const key=run('saveKey'),saved=JSON.parse(storage.getItem(key));
 assert.equal(saved.cardRulesVersion,run('latestCardRulesVersion'));
 assert.equal(saved.playFormat,'premiere');
 assert.equal(saved.botStrategyVersion,3);
 assert.equal(saved.botPlayStyle,'balanced');
 const oldPlanner={...saved,botStrategyVersion:2};
 delete oldPlanner.botPlayStyle;
 storage.setItem(key,JSON.stringify(oldPlanner));
 const previous=await premiereHarness(starterLists,{storage});
 assert.equal(previous.run('resumeGameFromUI()'),true);
 assert.equal(previous.run('currentGame().botStrategyVersion'),2);
 delete saved.cardRulesVersion;
 delete saved.playFormat;
 delete saved.botStrategyVersion;
 delete saved.botPlayStyle;
 delete saved.playerSide;
 storage.setItem(key,JSON.stringify(saved));
 const reload=await premiereHarness(starterLists,{storage});
 assert.ok(reload.run("el('resumeGame').onclick()"));
 assert.equal(reload.run('currentGame().cardRulesVersion'),0);
 assert.equal(reload.run('currentGame().botStrategyVersion'),0);
 assert.equal(reload.run('playerSide()'), 'Light');
 assert.equal(reload.run("activeCardRules(catalog.find(card=>card.id==='Light:2052'),'freeSiteDeploy').length"),0);
});

test('Dark Side gets its own hand, phase actions and a repeatable Light bot turn after reload',async()=>{
 const storage=autosaveStorage();
 const {run,elements}=await premiereHarness(starterLists,{storage});
 run("el('playerSideChoice').value='Dark';el('botPlayStyle').value='offensive'");
 startSavedGame(run,4);
 assert.equal(run("playerSide()==='Dark'&&botSide()==='Light'&&!!setupDecks.lightChoice&&!('lightChoice' in PremiereGame.setupView(setupDecks,'Dark'))"),true);
 assert.equal(run(`const pick=()=>act('chooseStart','Dark',legalActions(null,'Dark')[0].args);
  pick();while(setupDecks.revealed.collision){act('retrySetup','Dark');pick()}
  act('beginGame','Dark');`),true);
 assert.match(elements.get('playerHandTitle').textContent,/Dark Side/);
 assert.match(elements.get('botHand').innerHTML,/lightcardback\.png/);
 assert.match(elements.get('hand').innerHTML,/inspectCard\('Dark',0,'hand'\)/);
 assert.equal(run("!PremiereGame.playerView(state,'Dark').players.Light.hand&&select(0)"),true);
 assert.equal(run(`const action=(kind,side='Dark')=>dispatchUI(legalActions(state,side).find(option=>option.kind===kind));
  const stepBot=()=>runBotStep(legalActions(state,'Light').find(option=>['botStep','botDecision'].includes(option.kind)));
  for(let i=0;state.botTurn&&i<50;i++)if(!stepBot())break;
  action('activate')&&[0,1,2,3,4,5].every(()=>action('advance'))&&state.activeSide==='Light'&&stepBot();`),true);
 const snapshot="JSON.stringify([playerSide(),state.activeSide,state.phase,state.botTurn?.index,state.hand.map(c=>c.instanceId),state.botHand.map(c=>c.instanceId)])";
 const expected=run(snapshot);
 const saved=JSON.parse(storage.getItem(run('saveKey')));
 assert.equal(saved.botPlayStyle,'offensive');
 assert.throws(()=>run(`parseSavedGame(${JSON.stringify(JSON.stringify({...saved,botPlayStyle:'__proto__'}))})`),/Unbekannter Spielstand/);
 const reload=await premiereHarness(starterLists,{storage});
 assert.equal(reload.run('resumeGameFromUI()'),true);
 assert.equal(reload.run(snapshot),expected);
 assert.equal(reload.run('currentGame().botPlayStyle'),'offensive');
 assert.equal(reload.elements.get('botPlayStyle').value,'offensive');
 assert.equal(reload.elements.get('playerSideChoice').value,'Dark');
 assert.match(reload.elements.get('turnStatusBot').textContent,/Bot ist am Zug/);
});

test('ending the active game preserves an autosave changed by another tab',async()=>{
 const storage=autosaveStorage();
 const {run}=await premiereHarness(starterLists,{storage});
 startSavedGame(run);
 const key=run('saveKey'),otherSave=JSON.stringify({...JSON.parse(storage.getItem(key)),seed:4});
 storage.setItem(key,otherSave);
 assert.equal(run("el('endGame').onclick()"),true);
 assert.equal(storage.getItem(key),otherSave);
 assert.equal(run('currentGame()'),undefined);
 assert.equal(run("el('resumeGame').hidden"),false);
});

test('autosave restores a partially completed bot turn and keeps the original starter decks',async()=>{
 const storage=autosaveStorage();
 const {run}=await premiereHarness(starterLists,{storage});
 const readSave=()=>storage.getItem(run('saveKey'));
 assert.equal(readSave(),null);
 startSavedGame(run);
 assert.equal(JSON.parse(readSave()).commands.length,0);
 assert.equal(run("act('chooseStart','Light',[setupDecks.light.startingIndices[1]])"),true);
 assert.equal(JSON.parse(readSave()).commands.length,1);
 assert.equal(run("act('beginGame')"),true);
 run("el('botNext').onclick()");
 const saved=readSave();
 assert.equal(JSON.parse(saved).commands.at(-1).type,'bot');
 assert.match(run("state.botHistory[0]"),/Activate/);
 assert.equal(run("act('advance')"),false);
 assert.equal(readSave(),saved);
 const snapshot='JSON.stringify([state.phase,state.botTurn,state.deck,state.botDeck,state.botForce,state.botHistory,state.log])';
 const actual=run(snapshot);

 const newDecks=structuredClone(starterLists);
 newDecks.decks.Dark.cards.find(card=>card.id==='Dark:1279').count--;
 newDecks.decks.Dark.cards.find(card=>card.id==='Dark:2355').count++;
 const reload=await premiereHarness(newDecks,{storage,confirmNewGame:()=>false});
 assert.equal(reload.run("el('resumeGame').hidden"),false);
 assert.equal(reload.run('currentGame()'),undefined);
 reload.run("el('start').onclick()");
 assert.equal(reload.run("el('resumeGame').hidden"),false);
 assert.equal(readSave(),saved);
 assert.equal(reload.run("el('resumeGame').onclick()"),true);
 assert.equal(reload.run(snapshot),actual);
 assert.equal(reload.run("el('resumeGame').hidden"),true);
 assert.equal(reload.run("currentGame().starterDecks.dark.cards.filter(card=>card.id==='Dark:1279').length"),3);
 reload.run("el('botNext').onclick()");
 assert.equal(reload.run('state.phase'),1);
 assert.equal(JSON.parse(readSave()).commands.length,4);
});

test('automatic bot turns are saved and continue after reload, stopping at Light decisions',async()=>{
 const storage=autosaveStorage();
 const first=await premiereHarness(starterLists,{storage});
 const {run,tick,elements}=first;
 startSavedGame(run,0);
 assert.equal(run("act('chooseStart','Light',[setupDecks.light.startingIndices[1]])&&act('beginGame')"),true);
 assert.equal(tick(),false);
 run('setAutoBot(true)');
 assert.equal(elements.get('botNext').hidden,true);
 assert.equal(tick(),true);
 const saved=JSON.parse(storage.getItem(run('saveKey')));
 assert.equal(saved.commands.at(-1).type,'bot');
 assert.equal(saved.commands.at(-1).adaptive,true);
 const second=await premiereHarness(starterLists,{storage});
 assert.equal(second.run("el('autoBot').checked"),true);
 assert.equal(second.tick(),false);
 assert.equal(second.run("el('resumeGame').onclick()"),true);
 assert.equal(second.run('currentGame().revision'),saved.revision);
 for(let step=0;step<24&&second.tick();step++){}
 assert.equal(second.run("state.activeSide==='Light'&&state.phase===0&&!state.activated"),true);
 assert.equal(second.tick(),false);
 assert.match(second.elements.get('botHistory').textContent,/Activate/);
 assert.match(second.elements.get('botHistory').textContent,/Bot beendet seinen Lernzug/);
 assert.doesNotMatch(second.elements.get('log').textContent,/Bot beendet|Dark aktiviert/);
});

test('a saved live battle resumes in the damage segment and accepts the remaining payment',async()=>{
 const storage=autosaveStorage();
 const {run}=await premiereHarness(starterLists,{storage});
 startSavedGame(run);
 run('start(0,true,false,starterDecks,latestCardRulesVersion,0);activeSave.botStrategyVersion=0;delete activeSave.botPlayStyle');
 assert.equal(run(`act('chooseStart','Light',[setupDecks.light.startingIndices[1]])&&act('beginGame')`),true);
 run("for(let i=0;state.botTurn&&i<8;i++)el('botNext').onclick()");
 assert.equal(run(`act('activate','Light',[4])&&act('advance')&&act('advance')&&act('deploy','Light',[1,0])&&
  act('advance')&&act('battle','Light',[0])&&act('skipDestiny')&&act('skipDestiny','Dark')`),true);
 assert.equal(run("battleSession.segment==='damage'&&battleSession.damage.debt.Light.damage===1"),true);
 const snapshot='JSON.stringify([state.force,state.lost,state.hand,state.log,battleSession.damage])';
 const actual=run(snapshot);
 const reload=await premiereHarness(starterLists,{storage});
 assert.equal(reload.run("el('resumeGame').onclick()"),true);
 assert.equal(reload.run(snapshot),actual);
 assert.equal(reload.run("el('battleAnalysis').open"),true);
 assert.equal(reload.run(`dispatchUI(PremiereGame.offer(currentGame(),'Light','battleForceLoss',['force']))`),true);
 assert.equal(reload.run('battleSession.damage.debt.Light.damage'),0);
 assert.equal(reload.run('state.lost.length'),1);
});

test('an invalid saved command leaves the saved data in place and offers a new game',async()=>{
 const storage=autosaveStorage();
 const {run}=await premiereHarness(starterLists,{storage});
 startSavedGame(run);
 const key=run('saveKey');
 const data=JSON.parse(storage.getItem(key));
 data.commands.push({type:'action',kind:'invalid',side:'Light',args:[]});
 const invalid=JSON.stringify(data);
 storage.setItem(key,invalid);
 const reload=await premiereHarness(starterLists,{storage});
 assert.equal(reload.run("el('resumeGame').onclick()"),false);
 assert.equal(reload.run('currentGame()'),undefined);
 assert.match(reload.run("el('gameSaveStatus').textContent"),/konnte.*nicht fortgesetzt/);
 assert.equal(storage.getItem(key),invalid);
 assert.equal(reload.run("el('start').disabled"),false);
});

test('the public view omits opponent hands and all Life Force order, including in setup',async()=>{
 const {run,elements}=await premiereHarness();
 run('start(1)');
 assert.equal(run('PremiereGame.setupView(setupDecks,"Light").revealed'),null);
 assert.equal(run('"darkChoice" in PremiereGame.setupView(setupDecks,"Light")'),false);
 run('chooseStart(startingLocationChoices(setupDecks.light)[1].index);beginStartingGame()');
 elements.get('showBotHand').checked=false;
 run('render()');
 assert.match(elements.get('botHand').innerHTML,/Verdeckt/);
 assert.equal(run(`PremiereGame.sides.every(side=>{
  const view=PremiereGame.playerView(state,side),own=view.players[side],opponent=view.players[PremiereGame.otherSide(side)];
  return own.hand.length===8&&opponent.handCount===8&&!('hand' in opponent)&&
   [own,opponent].every(piles=>['deck','force','used'].every(zone=>!(zone in piles)));
 })`),true);
 run(`const copy=PremiereGame.playerView(state,'Light');copy.players.Light.hand[0].name='changed';`);
 assert.equal(run("state.hand[0].name==='changed'"),false);
});

test('UI action versions reject duplicate clicks, wrong-side targets and unaffordable options',()=>{
 const {run}=weaponBattleHarness();
 run(`state.game=PremiereGame.actionState(12,1);select(0);
  const equip=findOffer(legalActions(state,'Light'),'equip',0,0,0);`);
 assert.equal(run("performAction({...equip,side:'Dark'})"),false);
 assert.equal(run('performAction({...equip,args:[0,0,9]})'),false);
 assert.equal(run('performAction({...equip,gameId:11})'),false);
 assert.equal(run('dispatchUI(equip)'),true);
 assert.equal(run('dispatchUI(equip)'),false);
 assert.equal(run('state.used.length===2&&state.game.actions.length===1'),true);
 run(`state.hand=[rifle];const second=findOffer(legalActions(state,'Light'),'equip',0,0,0);state.force=[];`);
 assert.equal(run('performAction(second)'),false);
 assert.equal(run('state.hand[0]===rifle&&state.used.length===2'),true);
});

function reactHarness(){
 const session=harness();
 session.run(`const nearby={name:'Hoth: Exterior A',type:'Location',subType:'Site',locationTags:['Planet','Exterior'],icons:{light:1,dark:1}};
  const target={...nearby,name:'Hoth: Exterior B',icons:{...nearby.icons}};
  const wolfman={name:'Shistavanen Wolfman',id:'Light:2250',instanceId:'Light:9',type:'Character',deploy:2,ability:2};
  const imperial={name:'Imperial',type:'Character',ability:3};
  state=PremiereGame.createState(PremiereGame.actionState(21,1),[],[],[nearby,target],[0,1]);
  state.phase=1;state.botTurn={steps:[],index:0};
  state.light[0].push(wolfman);state.dark[1].push(imperial);
  state.force.push({name:'React cost'});state.deck.push({name:'Life L'});
  state.botDeck.push({name:'Life D',destiny:4},{name:'Sense Destiny',destiny:2});`);
 return session;
}

test('a Wolfman can pay once and react in the opposing turn to cancel an unresolved Force Drain',()=>{
 const {run,elements}=reactHarness();
 assert.equal(run("requestAction('drain','Dark',[1])"),true);
 assert.match(elements.get('playerReactControls').innerHTML,/Antwortfenster.*Shistavanen Wolfman/);
 assert.match(elements.get('playmatSelection').innerHTML,/Hoth: Exterior B.*React bewegen.*Shistavanen Wolfman.*1 Force/s);
 assert.match(elements.get('board').innerHTML,/playmat-action-target[^>]*id="playmatLocation1"/);
 assert.equal(elements.get('playerReactControls').hidden,false);
 assert.equal(elements.get('controlPanel').style.display,'none');
 assert.equal(run("requestAction('passResponse','Dark')"),false);
 assert.equal(run("requestAction('draw','Light')"),false);
 assert.equal(run("requestAction('react','Light',[0,0])"),true);
 assert.equal(run("state.light[0][0]===wolfman&&state.used[0].name==='React cost'"),true);
 assert.equal(run("requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
 assert.equal(run('state.light[1][0]===wolfman&&state.pendingForceLoss===null&&state.game.responses.length===0'),true);
 assert.equal(elements.get('playerReactControls').hidden,true);
 assert.equal(run("PremiereGame.wasUsed(state.game,'turn','react:Light:9')"),true);
 assert.equal(run("requestAction('drain','Dark',[1])"),false);
});

test('Dark player sees playable Reacts and Interrupt costs on the playmat without seeing the Light bot hand',async()=>{
 const {run,elements}=await premiereHarness();
 run(`const card=id=>({...catalog.find(item=>item.id===id)});
  const sites=['Dark:2458','Dark:2446'].map(card);
  state=PremiereGame.createState(PremiereGame.actionState(94,1),[],[],sites,[0,1],'Light');
  setupDecks=null;state.game.playerSide='Dark';state.game.cardRulesVersion=latestCardRulesVersion;
  state.phase=1;state.botTurn={steps:[],index:0};
  state.dark[0].push(card('Dark:191'));state.light[1].push(card('Light:1593'));
  state.botHand=[card('Dark:575')];state.hand=[{name:'Secret Light card'}];
  state.deck.push({name:'Life'});state.botDeck.push({name:'Life'});
  state.botForce.push({name:'Force'});
  PremiereGame.openResponse(state.game,{kind:'drain',site:1,side:'Light'});presentGame();`);
 const panel=elements.get('playmatSelection');
 assert.match(panel.innerHTML,/React bewegen.*Bantha.*1 Force/s);
 assert.match(panel.innerHTML,/Counter Assault.*1 Force/s);
 assert.doesNotMatch(panel.innerHTML,/Secret Light card/);
 run('state.botForce.length=0;select(0)');
 assert.match(panel.innerHTML,/Counter Assault.*Benötigt 1 Force\. Verfügbar: 0 Force/s);
 assert.doesNotMatch(panel.innerHTML,/&quot;kind&quot;:&quot;interruptResponse&quot;/);
 assert.equal(run("requestAction('interruptResponse','Dark',[0])"),false);
});

test('battle React appears on the Light side and follows the player back to the playmat',()=>{
 const {run,elements}=reactHarness();
 run(`state.phase=3;state.botForce.push({name:'Battle Force'});
  state.light[1].push({name:'Rebel',type:'Character',ability:2,power:1});
  el('autoBot').checked=false;`);
 assert.equal(run("requestAction('battle','Dark',[1])"),true);
 assert.match(elements.get('battleDetails').innerHTML,/battle-side light.*Deine React-Aktionen.*Shistavanen Wolfman.*battle-side dark/s);
 assert.equal(elements.get('battleResponses').style.display,'none');
 assert.equal(elements.get('playerReactControls').hidden,true);
 run('battleOnPlaymat=battleSession;presentGame()');
 assert.equal(elements.get('playerReactControls').hidden,false);
 assert.match(elements.get('playerReactControls').innerHTML,/Shistavanen Wolfman/);
 assert.equal(elements.get('controlPanel').style.display,'none');
 run('returnToBattle()');
 assert.equal(elements.get('playerReactControls').hidden,true);
});

test('Sense can interrupt a paid React, and Alter can cancel the pending Sense in stack order',()=>{
 for(const counter of [false,true]){
  const {run}=reactHarness();
  run(`state.botHand.push({id:'Dark:2216',name:'Sense'});
   if(${counter})state.hand.push({id:'Light:95',name:'Alter'});`);
  assert.equal(run(`requestAction('drain','Dark',[1])&&requestAction('react','Light',[0,0])&&
   requestAction('interruptResponse','Dark',[0])`),true);
  if(counter){
   assert.equal(run(`requestAction('interruptResponse','Light',[0])&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')`),true);
   assert.equal(run("state.botLost[0].name==='Sense'&&state.used[1].name==='Alter'&&state.botDeck.length===2"),true);
  }
  assert.equal(run("requestAction('passResponse','Light')&&requestAction('passResponse','Dark')"),true);
  if(counter)assert.equal(run('state.light[1][0]===wolfman&&state.pendingForceLoss===null'),true);
  else {
   assert.equal(run('state.light[0][0]===wolfman&&state.used.length===1'),true);
   assert.equal(run("state.botUsed.map(card=>card.name).join()"),'Sense Destiny,Sense');
   assert.equal(run("requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
   assert.equal(run("state.pendingForceLoss.payer"),'Light');
  }
 }
});

test('Sense and Alter offer the matching modes and resolve from the top of the response stack',()=>{
 const {run,elements}=reactHarness();
 run(`state.botHand=[{id:'Dark:2216',name:'Sense'},{id:'Dark:2216',name:'Sense'}];
  state.hand=[{id:'Light:95',name:'Alter'}];`);
 assert.equal(run(`requestAction('drain','Dark',[1])&&requestAction('react','Light',[0,0])&&
  requestAction('interruptResponse','Dark',[0])&&requestAction('interruptResponse','Light',[0])`),true);
 assert.equal(run("legalActions(state,'Dark').filter(action=>action.kind==='interruptResponse').map(action=>action.counterMode).join(',')"),'direct');
 assert.equal(run("requestAction('interruptResponse','Dark',[0,'wrong'])"),false);
 assert.equal(run("requestAction('interruptResponse','Dark',[0])&&requestAction('passResponse','Light')&&requestAction('passResponse','Dark')"),true);
 assert.equal(run("state.lost[0].name==='Alter'&&state.botUsed[0].name==='Sense'&&state.botDeck.length===2"),true);
 assert.equal(run("requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
 assert.equal(run("state.botUsed.map(card=>card.name).join(',')"),'Sense,Sense Destiny,Sense');
 assert.equal(run("state.light[0].includes(wolfman)"),true);
 assert.match(elements.get('log').textContent,/Destiny 2 gegen Ability 3/);
});

test('Alter rejects an immune Effect both during deployment and on table',async()=>{
 const {run}=await eyesInTheDarkHarness();
 run("state.hand[0]={...eyes,gametext:eyes.gametext+' (Immune to Alter.)'};state.botHand=[catalog.find(card=>card.id==='Dark:94')];state.dark[0].push({type:'Character',name:'Imperial',ability:4})");
 assert.equal(run("requestAction('deployLostPileEffect','Light',[0,'Dark'])"),true);
 assert.equal(run("PremiereGame.responseWindow(state.game)"),null);
 assert.equal(run("requestAction('alterLostPileEffect','Dark',[0,0])"),false);
 assert.equal(run("state.botHand.length===1&&PremiereGame.lostPileFaceDown(state,'Dark')"),true);
});

test('Pile shuffling preserves private information and Sense can cancel before the shuffle',async()=>{
 for(const blocked of [false,true]){
  const {run,elements}=await craftHarness();
  run(`setupDecks=null;state.game=PremiereGame.actionState(103,9);
   const shuffle=card('Light:2514');state.hand=[shuffle];state.force=[];
   state.botDeck=[{name:'Sentinel Life'},{name:'Sense Destiny',destiny:1}];
   state.botLost=['Alpha','Bravo','Charlie','Delta'].map(name=>({name}));
   state.lostPileEffects=[{card:card('Dark:2897'),target:'Dark'}];
   state.dark[2]=[card('Dark:634')];state.botHand=${blocked}?[card('Dark:2216')]:[];
   const cards=state.botLost.slice(),previous=state.game.randomState;select(0);`);
  assert.match(elements.get('controlPanel').innerHTML,/The Bith Shuffle · Dark Lost Pile mischen/);
  assert.doesNotMatch(elements.get('controlPanel').innerHTML,/Alpha|Bravo|Charlie|Delta/);
  assert.equal(run("requestAction('shufflePile','Light',[0,'Dark','force'])"),false);
  assert.equal(run("requestAction('shufflePile','Light',[0,'Light','lost'])"),false);
  assert.equal(run("requestAction('shufflePile','Light',[0,'Dark','lost'])"),true);
  if(blocked)assert.equal(run("requestAction('interruptResponse','Dark',[0])&&requestAction('passResponse','Light')&&requestAction('passResponse','Dark')"),true);
  assert.equal(run("state.botLost.every(card=>cards.includes(card))&&state.botLost.length===cards.length"),true);
  assert.equal(run("state.game.randomState===previous"),blocked);
  assert.equal(run("state.lost.includes(shuffle)"),blocked);
  assert.equal(run("state.used.includes(shuffle)"),!blocked);
 }
});

test('Sense may answer Sense only with Destiny and an eligible character',()=>{
 const {run}=reactHarness();
 run(`state.botHand=[{id:'Dark:2216',name:'Sense'}];state.hand=[{id:'Light:2217',name:'Sense'}];
  state.deck.push({name:'Equal',destiny:2});`);
 assert.equal(run(`requestAction('drain','Dark',[1])&&requestAction('react','Light',[0,0])&&
  requestAction('interruptResponse','Dark',[0])`),true);
 run("wolfman.ability=0");
 assert.equal(run("requestAction('interruptResponse','Light',[0])"),false);
 run("wolfman.ability=2");
 assert.equal(run("legalActions(state,'Light').filter(action=>action.kind==='interruptResponse').map(action=>action.counterMode).join(',')"),'destiny');
 assert.equal(run("requestAction('interruptResponse','Light',[0])&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
 assert.equal(run("state.used.map(card=>card.name).join(',')"),'React cost,Equal,Sense');
 assert.equal(run("state.botLost.length===0&&PremiereGame.responseWindow(state.game).side==='Dark'"),true);
});

test('phase checkpoints give the active side the order of mandatory triggers and then alternate optional priority',()=>{
 const {run}=reactHarness();
 run(`PremiereGame.resetTurn(state,'Light');state.botTurn=null;state.activated=true;
  const observed=[];
  function register(id,side,mandatory,scope,event){PremiereGame.registerTrigger(state.game,{id,side,mandatory,scope,event,once:true,label:id,resolve(){observed.push(id)}})}
  register('first','Light',true,'phase','phase:end');
  register('second','Dark',true,'phase','phase:end');
  register('optional','Dark',false,'game','phase:end');
  register('entry','Light',true,'turn','phase:start');`);
 assert.equal(run("requestAction('advance','Light')&&state.phase===0"),true);
 assert.equal(run("legalActions(state,'Light').map(x=>x.label).join()"),'first,second');
 assert.equal(run("requestAction('timingTrigger','Dark',['second'])"),false);
 assert.equal(run("requestAction('timingTrigger','Light',[null])"),false);
 assert.equal(run("requestAction('timingTrigger','Light',['second'])&&requestAction('timingTrigger','Light',['first'])"),true);
 assert.equal(run("requestAction('timingTrigger','Light',[null])"),true);
 assert.equal(run("requestAction('timingTrigger','Dark',['optional'])&&state.phase===1"),true);
 assert.equal(run("requestAction('timingTrigger','Light',['entry'])"),true);
 assert.equal(run('observed.join()'),'second,first,optional,entry');
 assert.equal(run("state.game.timing.effects.map(x=>x.id).join()"),'optional,entry');
 assert.equal(run("PremiereGame.wasUsed(state.game,'game','optional')&&PremiereGame.wasUsed(state.game,'turn','entry')"),true);
 assert.equal(run("PremiereGame.useOnce(state.game,'battle','shot')&&!PremiereGame.useOnce(state.game,'battle','shot')"),true);
 assert.equal(run("PremiereGame.expire(state.game,'battle');PremiereGame.useOnce(state.game,'battle','shot')"),true);
 assert.equal(run("PremiereGame.resetTurn(state,'Dark');!PremiereGame.wasUsed(state.game,'turn','entry')&&PremiereGame.wasUsed(state.game,'game','optional')"),true);
});

test('Life Force is evaluated after the complete loss payment and locks both sides',()=>{
 const {run}=reactHarness();
 run(`state.light[0]=[];state.force=[];state.deck=[{name:'Last Life Force'}];
  state.locations[1].icons.light=2;state.hand=[{name:'Last hand card'}];
  const drain=legalActions(state,'Dark').find(x=>x.kind==='drain');`);
 assert.equal(run('performAction(drain)'),true);
 assert.equal(run("requestAction('loseForce','Light',['deck'])"),true);
 assert.equal(run('state.gameWinner'),null);
 assert.equal(run('state.pendingForceLoss.remaining'),1);
 assert.equal(run("requestAction('loseForce','Light',['hand',0])"),true);
 assert.equal(run('state.gameWinner'),'Dark');
 assert.equal(run("legalActions(state,'Dark').length+legalActions(state,'Light').length"),0);
 assert.equal(run('performAction(drain)'),false);
});

test('the opponent gets the next optional priority when there is an eligible phase action',()=>{
 const {run}=reactHarness();
 run(`PremiereGame.resetTurn(state,'Light');state.botTurn=null;
  PremiereGame.registerTrigger(state.game,{id:'dark-option',side:'Dark',event:'phase:priority',scope:'phase',label:'Dark option',
   resolve(){state.botReason='resolved'}});`);
 assert.equal(run("requestAction('activate','Light',[0])"),true);
 assert.equal(run("legalActions(state,'Light').length"),0);
 assert.equal(run("legalActions(state,'Dark').map(option=>option.label).join()"),'Dark option,Passen');
 assert.equal(run("requestAction('advance','Light')"),false);
 assert.equal(run("requestAction('timingTrigger','Dark',['dark-option'])&&state.botReason==='resolved'"),true);
 assert.equal(run("requestAction('advance','Light')&&state.phase===1"),true);
});

test('simultaneous Life Force depletion shows a draw and locks the game',()=>{
 const {run,elements}=reactHarness();
 run(`PremiereGame.resetTurn(state,'Light');state.botTurn=null;state.activated=true;state.force=[];
  state.botDeck.length=1;
  PremiereGame.registerTrigger(state.game,{id:'both-lose',side:'Dark',mandatory:true,event:'phase:end',scope:'phase',label:'Both lose',
   resolve(){PremiereGame.moveTop(state.deck,state.lost);PremiereGame.moveTop(state.botDeck,state.botLost)}});`);
 assert.equal(run("requestAction('advance','Light')&&state.gameWinner===null"),true);
 assert.equal(run("requestAction('timingTrigger','Light',['both-lose'])"),true);
 assert.equal(run('state.gameWinner'),'Simultaneous');
 assert.equal(run("legalActions(state,'Dark').length+legalActions(state,'Light').length"),0);
 assert.match(run('state.log.join("\\n")'),/SPIELENDE – Unentschieden/);
 run('render()');
 assert.equal(elements.get('gameMessage').hidden,false);
 assert.equal(elements.get('instruction').textContent,'Unentschieden – beide Life Forces gleichzeitig aufgebraucht');
 assert.equal(elements.get('step').disabled,true);
});

test('location conversion stacks opposing printings without moving units or compatible effects',async()=>{
 const {run,elements}=await premiereHarness();
 run(`const catalogCard=id=>({...catalog.find(card=>card.id===id)});
  const darkBay=catalogCard('Dark:2446'),lightBay=catalogCard('Light:2447'),revolution=catalogCard('Light:2110');
  const guard={ability:1,name:'Guard'},effect={card:{name:'Location effect',side:'Dark'},requiredTag:'Scomp Link'};
  const incompatible={card:{name:'Inapplicable effect',side:'Dark'},requiredTag:'Mobile'};
  state=PremiereGame.createState(PremiereGame.actionState(41,0),[],[],[darkBay,null],[0]);setupDecks=null;
  state.deck=[{name:'Life L'}];state.botDeck=[{name:'Life D'}];state.force=[{},{},{}];state.phase=2;state.activeSide='Light';
  state.dark[0].push(guard);state.hand=[revolution,lightBay];state.locationEffects={0:[effect,incompatible]};`);
 assert.equal(run("requestAction('revolution','Light',[0,0])"),true);
 assert.equal(run("PremiereLocations.conditions(state,0,'Light').transitCost"),1);
 run('select(0)');
 assert.match(elements.get('board').innerHTML,/Konvertieren/);
 assert.equal(run("requestAction('convertLocation','Light',[0,0])"),true);
 assert.equal(run(`state.locations[0]===lightBay&&state.dark[0][0]===guard&&state.convertedLocations[0][0]===darkBay&&
  state.locationEffects[0][0]===effect&&state.locationEffects[0][1].card===revolution&&state.botLost[0]===incompatible.card&&state.locationOrder.join()==='0'`),true);
 assert.equal(run("PremiereLocations.conditions(state,0,'Light').transitCost"),2);
 assert.equal(run("PremiereLocations.icons(state,0,'Light')===lightBay.icons.dark"),true);
 run('inspectLocation(0)');
 assert.match(elements.get('cardInspectorBody').innerHTML,/Scomp Link.*Docking Bay.*darunter|Scomp Link.*Docking Bay.*Darunter/);
 run('state.hand=[{...lightBay}]');
 assert.equal(run("requestAction('convertLocation','Light',[0,0])"),false);
 assert.equal(run("requestAction('deployLocation','Light',[0,0])"),false);
});

test('at, present, aboard, Occupy and Control differ for enclosed units, droids and spies',()=>{
 const {run}=reactHarness();
 run(`const passenger={type:'Character',ability:2},droid={type:'Character',subType:'Droid'},
  ship={type:'Starship',occupants:[{card:passenger,role:'passenger'},{card:droid,role:'passenger'}]},
  spy={type:'Character',ability:3,undercover:true};
  state.locations[0]={name:'Hoth',type:'Location',subType:'System'};
  state.light=[[ship],[]];state.dark=[[],[spy]];`);
 assert.equal(run('PremiereLocations.at(state,passenger,0)&&PremiereLocations.aboard(state,passenger,ship)'),true);
 assert.equal(run('PremiereLocations.present(state,passenger,ship)&&!PremiereLocations.present(state,passenger,0)'),true);
 assert.equal(run("PremiereLocations.occupy(state,'Light',0,cardAbility)&&PremiereLocations.control(state,'Light',0,cardAbility)"),true);
 assert.equal(run("confirmedPresence('Dark',1)"),false);
 run('state.light[1].push(wolfman);state.activeSide="Light";state.botTurn=null;');
 assert.equal(run("PremiereLocations.at(state,wolfman,0)&&PremiereLocations.control(state,'Light',1,cardAbility)"),true);
 assert.equal(run("forceDrainValue('Light',1)"),null);
 run('spy.undercover=false;');
 assert.equal(run("confirmedPresence('Dark',1)&&!PremiereLocations.control(state,'Light',1,cardAbility)"),true);
});

test('Luke modifies Force off Tatooine, zero icons are known, and activation stops at the Reserve limit',()=>{
 const {run}=reactHarness();
 run(`PremiereGame.resetTurn(state,'Light');state.botTurn=null;
  state.light[0]=[{id:'Light:1593',ability:4,type:'Character'}];
  state.locations[0].icons.light=0;state.locations[1].icons.light=null;`);
 assert.equal(run("JSON.stringify(forceFromLocations('Light'))"),'{"count":2,"unknown":1}');
 run("state.locations[0].name='Tatooine: Dune Sea'");
 assert.equal(run("forceFromLocations('Light').count"),1);
 run("state.locations[0].name='Alderaan';state.locations[0].subType='System'");
 assert.equal(run("requestAction('activate','Light',[2])"),false);
 assert.equal(run("requestAction('activate','Light',[1])"),true);
 assert.equal(run("state.deck.length===0&&state.force.at(-1).name==='Life L'"),true);
});

test('printed drain bonuses, penalties and zero drains share the per-location turn limit',()=>{
 const {run}=reactHarness();
 run(`state.light[0]=[];state.dark[0]=[{type:'Character',ability:1}];
  state.locations[0].icons.light=0;state.locations[1].id='Dark:2458';
  state.locationEffects={1:[{card:{id:'test modifier'},drainModifier:{Dark:-1}}]};`);
 assert.equal(run("forceDrainValue('Dark',0)"),0);
 assert.equal(run("forceDrainValue('Dark',1)"),1);
 assert.equal(run("requestAction('drain','Dark',[0])&&state.pendingForceLoss===null"),true);
 assert.equal(run("requestAction('drain','Dark',[0])"),false);
 assert.equal(run("requestAction('drain','Dark',[1])&&state.pendingForceLoss.remaining===1"),true);
});

test('Surprise Assault replaces a Force Drain with the destiny comparison and shared loss choices',()=>{
 const {run}=reactHarness();
 run(`state.light[0]=[];imperial.power=2;state.hand=[{id:'Light:2385',name:'Surprise Assault'}];
  state.deck.push({name:'Assault Destiny',destiny:3});`);
 assert.equal(run("requestAction('drain','Dark',[1])&&requestAction('interruptResponse','Light',[0])"),true);
 assert.equal(run("requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
 assert.equal(run(`state.lost[0].name==='Surprise Assault'&&state.used.map(card=>card.name).join()===
  'React cost,Assault Destiny'&&state.botLost.length===1&&state.pendingForceLoss===null`),true);
});

test('both Premiere Assault cards compare destiny against present power',()=>{
 const {run}=reactHarness();
 run(`state.activeSide='Light';state.botTurn=null;wolfman.power=2;
  state.botHand=[{id:'Dark:575',name:'Counter Assault'}];state.botForce=[{name:'Counter cost'}];
  state.botDeck.push({name:'Counter Destiny',destiny:3});`);
 assert.equal(run("requestAction('drain','Light',[0])&&requestAction('interruptResponse','Dark',[0])"),true);
 assert.equal(run("requestAction('passResponse','Light')&&requestAction('passResponse','Dark')"),true);
 assert.equal(run("state.botLost[0].name==='Counter Assault'&&state.pendingForceLoss.payer==='Light'&&state.pendingForceLoss.remaining===1"),true);
});

test('Counter Assault at a system counts the starship once and includes its added pilot power',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(263,0);state.game.cardRulesVersion=23;
  const fighter=card('Light:2838'),pilot=card('Light:2040'),assault=card('Dark:575');
  PremiereUnits.add(fighter,pilot,'pilot','Light');
  state.light[0]=[fighter];state.phase=1;state.botHand=[assault];state.hand=[];
  state.botDeck=[{name:'Remaining reserve',destiny:4},{name:'Assault destiny',destiny:5}];`);
 assert.equal(run(`requestAction('drain','Light',[0])&&requestAction('interruptResponse','Dark',[0])&&
  requestAction('passResponse','Light')&&requestAction('passResponse','Dark')`),true);
 assert.equal(run('!state.pendingForceLoss&&state.botDeck.length===1&&state.botLost.includes(assault)'),true);
 assert.equal(run('state.botUsed.length===2&&state.botUsed.at(-1).destiny===5&&battleSession===null'),true);
});

test('named retrieval declares no target before responses, then offers only named personas to its player',async()=>{
 const {run,elements}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(264,0);state.game.cardRulesVersion=23;state.game.botStrategyVersion=2;
  const empire=card('Dark:2528'),tarkin=card('Dark:1061'),tagge=card('Dark:1027'),other=card('Dark:2355');
  state.botHand=[empire];state.botLost=[tarkin,other,tagge];state.hand=[];state.phase=1;setAutoBot(false);`);
 assert.match(elements.get('controlPanel').innerHTML,/Interrupt des Bots zeigen/);
 assert.doesNotMatch(elements.get('controlPanel').innerHTML,/Tarkin|Tagge/);
 assert.equal(run("requestAction('retrieve','Dark',[0,2])"),false);
 assert.equal(run("dispatchUI(offTurnBotInterrupt())&&state.pendingCardView.mode==='namedRecovery'&&state.botUsed.length===2"),true);
 assert.deepEqual(JSON.parse(run("JSON.stringify(legalActions(state,'Dark').map(action=>action.args))")),[['recover',0],['recover',2]]);
 assert.doesNotMatch(elements.get('controlPanel').innerHTML,/Tarkin|Tagge/);
 assert.equal(run("requestAction('finishCardInformation','Dark',['recover',1])"),false);
 assert.equal(run("requestAction('finishCardInformation','Dark',['recover',2])&&state.botUsed.at(-1)===tagge&&state.botLost.includes(empire)"),true);
});

test('the four Light recovery Interrupts recover and search for their printed personas',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(265,0);state.game.cardRulesVersion=23;state.phase=1;
  state.activeSide='Dark';state.botHand=[];
  function checkNamedInterrupt(id,targetId){
   const target=card(targetId),other=card('Light:2052');
   state.lost=[other,target];
   state.hand=[card(id)];
   state.force=forcePile();
   if(!requestAction('retrieve','Light',[0])||requestAction('finishCardInformation','Light',['recover',0])||
      !requestAction('finishCardInformation','Light',['recover',1])||state.used.at(-1)!==target)return false;
   state.deck=[other,target];state.used=[];state.lost=[];
   state.hand=[card(id)];
   return requestAction('searchReserve','Light',[0])&&requestAction('takeFromReserve','Light',[0])&&state.hand[0]===target&&
    state.force.length===1&&state.deck[0]===other;
  }`);
 for(const [id,target] of [[1102,1098],[1500,1495],[1600,1593],[2105,1803]]){
  assert.equal(run(`checkNamedInterrupt('Light:${id}','Light:${target}')`),true);
 }
});

test('Force loss respects a required pile and retrieval preserves the remaining pile order',async()=>{
 const {run}=await premiereHarness();
 run(`const source=id=>({...catalog.find(card=>card.id===id)});
  const interrupt=source('Light:2105'),obi=source('Light:1803'),bottom={name:'Bottom'},last={name:'Top'};
  state=PremiereGame.createState(PremiereGame.actionState(42,0),[],[],[],[]);setupDecks=null;
  state.activeSide='Light';state.phase=1;state.deck=[bottom,last];state.botDeck=[{name:'Life D'}];
  state.force=[{name:'Cost'}];state.lost=[{name:'First'},obi,{name:'Third'}];state.hand=[interrupt];
  beginForceLoss('Light',1,{reason:'drain',from:'deck'});`);
 assert.equal(run("requestAction('loseForce','Light',['force'])"),false);
 assert.equal(run("requestAction('loseForce','Light',['deck'])"),true);
 assert.equal(run('state.deck[0]===bottom&&state.lost.at(-1)===last'),true);
 assert.equal(run("requestAction('retrieve','Light',[0])&&requestAction('finishCardInformation','Light',['recover',1])"),true);
 assert.equal(run('state.used.at(-1)===obi&&state.lost.at(-1)===interrupt'),true);
 assert.equal(run("PremiereGame.retrieveForce(state,'Light',2)[1]===last&&state.lost.map(card=>card.name).join()==='First,Third'"),true);
});

test('named Reserve searches spend Force before revealing choices, then transfer one card and shuffle',async()=>{
 const {run,elements}=await craftHarness();
 run(`const interrupt=card('Dark:2528'),motti=card('Dark:60'),tarkin=card('Dark:1061'),other=card('Dark:2355');
  setupDecks=null;state.game=PremiereGame.actionState(45,99);state.activeSide='Dark';state.phase=1;
  state.botTurn={steps:botPlan(),index:2};state.botDeck=[motti,other,tarkin];state.botHand=[interrupt];state.hand=[];`);
 assert.equal(run("requestAction('takeFromReserve','Dark',[0])"),false);
 assert.equal(run("requestAction('searchReserve','Dark',[1])"),false);
 assert.equal(run("requestAction('searchReserve','Dark',[0])"),true);
 assert.equal(run('state.botUsed.length===4&&state.botHand.length===0&&state.botDeck.length===3'),true);
 assert.doesNotMatch(elements.get('controlPanel').innerHTML,/Motti|Tarkin/);
 assert.equal(run("requestAction('takeFromReserve','Light',[1])||requestAction('takeFromReserve','Dark',[3])"),false);
 assert.equal(run("requestAction('takeFromReserve','Dark',[1])"),true);
 assert.equal(run("state.botHand[0]===tarkin&&state.botDeck.length===2&&state.botDeck.includes(motti)&&state.botDeck.includes(other)&&state.botLost[0]===interrupt"),true);
 assert.equal(run("state.game.randomState!==99&&!state.pendingReserveSearch"),true);
});

test('a Reserve search with no match still consumes the Interrupt and shuffles; Sense stops a search before looking',async()=>{
 for(const cancel of [false,true]){
  const {run}=await craftHarness();
  run(`setupDecks=null;state.game=PremiereGame.actionState(46,99);state.phase=1;
   const interrupt=card('Light:1600'),other=card('Light:2052'),second=card('Light:2040');
   state.hand=[interrupt];state.deck=[other,second];state.botHand=[];`);
  if(cancel)run(`const sense=card('Dark:2216');state.botHand=[sense];state.dark[2]=[card('Dark:634')];
   state.botDeck=[{name:'Destiny',destiny:1}];`);
  assert.equal(run("requestAction('searchReserve','Light',[0])"),true);
  if(cancel){
   assert.equal(run("requestAction('interruptResponse','Dark',[0])&&requestAction('passResponse','Light')&&requestAction('passResponse','Dark')"),true);
   assert.equal(run('state.game.randomState===99'),true);
  }else{
   assert.equal(run("requestAction('takeFromReserve','Light',[null])"),true);
   assert.equal(run('state.game.randomState!==99'),true);
  }
  assert.equal(run('!state.pendingReserveSearch&&state.hand.length===0&&state.used.length===3&&state.lost[0]===interrupt&&state.deck.length===2'),true);
 }
});

test('the bot makes another legal drain after Light pays the previous one',()=>{
 const {run}=reactHarness();
 run(`state.light[0]=[];state.dark[0]=[{type:'Character',ability:1}];
  state.locations[1].icons.light=2;state.phase=0;
  state.botTurn={steps:[{kind:'control'},{kind:'deploy'}],index:0};
  state.deck.push({name:'Extra 1'},{name:'Extra 2'});state.hand=[{name:'Hand loss'}];`);
 assert.equal(run('botNextStep()&&state.pendingForceLoss.locationIndex===1'),true);
 assert.equal(run('botNextStep()'),false);
 assert.equal(run("requestAction('loseForce','Light',['hand',0])&&requestAction('loseForce','Light',['force'])"),true);
 assert.equal(run('botNextStep()&&state.pendingForceLoss.locationIndex===0&&state.phase===1'),true);
 assert.equal(run("requestAction('loseForce','Light',['deck'])&&botNextStep()&&state.phase===2"),true);
});

test('the bot reevaluates distinct battle sites before leaving the Battle phase',()=>{
 const {run}=reactHarness();
 run(`state.locations.forEach((_,slot)=>{
  state.light[slot]=[{name:'Rebel '+slot,type:'Character',ability:1,power:1,forfeit:1}];
  state.dark[slot]=[{name:'Imperial '+slot,type:'Character',ability:1,power:2,forfeit:1}];
 });
 state.hand=[{name:'First damage'},{name:'Second damage'}];
 state.phase=2;state.botForce=[{name:'Battle cost 1'},{name:'Battle cost 2'}];
 state.botTurn={steps:botPlan(),index:3};
 function finishBattle(){
  for(let step=0;step<24&&battleSession;step++){
   const pass=PremiereGame.sides.flatMap(side=>legalActions(state,side)).find(action=>
    ['passResponse','passWeapons','skipDestiny','passDamage'].includes(action.kind)||
    (action.kind==='battleForceLoss'&&action.args[0]==='hand'));
   if(!pass||!performAction(pass))return false;
  }
  return !battleSession;
 }`);
 assert.equal(run('botNextStep()&&state.phase===3&&battleSession.site===0'),true);
 assert.equal(run('finishBattle()'),true);
 assert.equal(run('botNextStep()&&state.phase===3&&battleSession.site===1'),true);
 assert.equal(run('finishBattle()'),true);
 assert.equal(run('botNextStep()&&state.phase===4&&state.battledSitesThisTurn.join()=== "0,1"'),true);
});

test('strategic bot spends its last Force taking a drain location before arming an isolated unit',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(98,0);state.game.botStrategyVersion=1;state.activeSide='Dark';state.botTurn={steps:[],index:0};");
 run("state.dark[2]=[card('Dark:2355')];state.botHand=[card('Dark:1264'),card('Dark:2355')];state.botForce=[{}];state.locations[3]={...dunes,icons:{light:3,dark:1}};");
 assert.ok(run("legalActions(state,'Dark').some(option=>option.kind==='equip')"));
 assert.equal(run("botDeploymentChoice(legalActions(state,'Dark')).args.join()"),'1,3');
 assert.ok(run("botDeployPhase().some(text=>text.includes('Stormtrooper')&&text.includes('Dune Sea'))"));
 assert.equal(run('state.dark[3].length===1&&!state.dark[2][0].weapons?.length&&state.botForce.length===0'),true);
});

test('strategic bot holds a controlled drain and moves a spare unit into safe control',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(99,0);state.game.botStrategyVersion=1;state.activeSide='Dark';state.botTurn={steps:[],index:0};state.phase=4;");
 run("state.locationOrder=[2,3,4,6,5,1,0];state.locations[2]={...dock,icons:{light:3,dark:1}};state.dark[2]=[card('Dark:2355')];state.light[3]=[card('Light:1593')];");
 assert.ok(run("legalActions(state,'Dark').some(option=>option.kind==='move'&&option.to===3)"));
 assert.equal(run('botMove()'),false);
 run("state.light[3]=[];state.dark[2].push(card('Dark:2355'))");
 assert.equal(run('botMove()&&state.dark[2].length===1&&state.dark[3].length===1'),true);
});

test('strategic bot gives up redundant cards before losing an important unit or Life Force',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(100,0);state.game.botStrategyVersion=1;state.activeSide='Light';state.botTurn=null;");
 run("const vader=card('Dark:634'),duplicate=card('Dark:2446');state.botHand=[vader,duplicate];state.botDeck=[{}];");
 assert.equal(run("beginForceLoss('Dark',1,{reason:'drain'})"),1);
 assert.equal(run('state.botLost[0]===duplicate&&state.botHand[0]===vader&&state.botDeck.length===1'),true);
});

test('strategic bot shoots at a worthwhile target with favorable odds',()=>{
 const {run}=weaponBattleHarness('Dark');
 run(`state.game=PremiereGame.actionState(101,0);state.game.botStrategyVersion=1;state.phase=3;
  rebel.power=8;rebel.armor=8;trooper.weapons=[blaster];`);
 assert.equal(run("requestAction('battle','Dark',[0])"),true);
 assert.equal(run('botWeaponAction().target===officer'),true);
});

test('planned bot start weights printed icons and its own fleet without reading the rival deck',()=>{
 const {run}=harness();
 run(`const locations=[
  {type:'Location',subType:'Site',icons:{dark:0,light:2}},
  {type:'Location',subType:'Site',icons:{dark:1,light:1}},
  {type:'Location',subType:'System',icons:{dark:1,light:1}},
 ];`);
 assert.equal(run("PremiereBot.startingLocation(Array(12).fill({type:'Starship'}),locations,0)"),2);
 assert.equal(run("PremiereBot.startingLocation(Array(12).fill({type:'Character'}),locations,0)"),1);
});

test('planned bot sees the same position and weapon offer despite hidden destinations and decks',()=>{
 const {run}=weaponBattleHarness('Dark');
 run(`state.game=PremiereGame.actionState(260,0);state.game.botStrategyVersion=2;state.phase=3;
  rebel.power=8;rebel.armor=8;trooper.weapons=[blaster];`);
 assert.equal(run("requestAction('battle','Dark',[0])"),true);
 assert.equal(run('botWeaponAction().target===officer'),true);
 run(`const plannerView=()=>JSON.stringify(plannedBotPosition(legalActions(state,'Dark')));
  const before=plannerView();
  state.hand=[{name:'Secret opponent card',power:100,type:'Character',ability:7}];
  state.deck.reverse();state.botDeck.reverse();
  state.force[0]={name:'Secret force card',destiny:100};
  state.botDeck[0]={name:'Secret destiny',destiny:100};`);
 assert.equal(run('plannerView()===before'),true);
 assert.doesNotMatch(run('plannerView()'),/Secret|gametext|instanceId|randomState/);
 assert.equal(run('botWeaponAction().target===officer'),true);
 run("state.botDeck=[]");
 assert.equal(run('botWeaponAction().kind'),'passWeapons');
});

test('styled Light and Dark bots choose battles at distinct thresholds and explain them from visible facts',()=>{
 for(const side of ['Light','Dark']){
  const {run,elements}=weaponBattleHarness(side);
  run(`const actor='${side}',rival=PremiereGame.otherSide(actor);
   state.game=PremiereGame.actionState(262,0);state.game.botStrategyVersion=3;state.game.playerSide=rival;
   state.phase=3;state.botTurn={steps:botPlan(),index:4};
   const own=PremiereGame.zones(state,actor),other=PremiereGame.zones(state,rival);
   own.force.push(...forceCards());
   const unit=actor==='Light'?rebel:trooper;
   unit.power=4;
   const choices=()=>legalActions(state,actor).filter(action=>action.kind==='battle');
   const pick=style=>{state.game.botPlayStyle=style;return choosePlannedBotAction(choices())?.kind??null};`);
  assert.equal(run("pick('offensive')"),'battle');
  assert.equal(run("pick('balanced')"),null);
  assert.equal(run("unit.power=2;pick('offensive')"),null);
  assert.equal(run("unit.power=5;pick('balanced')"),'battle');
  assert.equal(run("pick('defensive')"),null);
  run(`unit.power=4;pick('offensive');
   const forecast=()=>JSON.stringify(plannedBotPosition(choices()));const before=forecast();
   other.hand.splice(0,other.hand.length,{name:'Secret hand',type:'Character',power:100,ability:100});
   other.deck[0]={name:'Secret reserve',destiny:100};other.force[0]={name:'Secret force',destiny:100};`);
  assert.equal(run("forecast()===before&&pick('offensive')==='battle'"),true);
  assert.ok(run('botNextStep()&&battleSession.initiator===actor'));
  assert.match(elements.get('botHistory').textContent,/Battle begonnen.*Sichtbare Power.*geschätzten Vorteil/s);
  assert.doesNotMatch(elements.get('botHistory').textContent,/Secret/);
 }
});

test('a defensive bot keeps a controlled location and retains Force in the Draw phase',()=>{
 const {run,elements}=reactHarness();
 run(`state.game.botStrategyVersion=3;state.game.botPlayStyle='defensive';state.activeSide='Dark';
   state.phase=4;state.botTurn={steps:botPlan(),index:5};state.light[0]=[];state.botForce=Array.from({length:8},()=>({}));
   state.locations[0].icons={light:2,dark:1};
   const moving=()=>movementOptionsFor('Dark').length&&choosePlannedBotAction(legalActions(state,'Dark'))?.kind;`);
 assert.equal(run("state.game.botPlayStyle='balanced';moving()"),'move');
 assert.equal(run("state.game.botPlayStyle='defensive';moving()"),undefined);
 assert.equal(run('botNextStep()&&state.phase===5&&state.dark[1].includes(imperial)'),true);
 assert.match(elements.get('botHistory').textContent,/Hält die Stellung.*kontrollierten Ort/);
 run(`state.botForce.length=2;
   const drawing=()=>choosePlannedBotAction(legalActions(state,'Dark'))?.kind;`);
 assert.equal(run("state.game.botPlayStyle='offensive';drawing()"),'draw');
 assert.equal(run("state.game.botPlayStyle='defensive';drawing()"),undefined);
 assert.equal(run("botNextStep()&&state.activeSide==='Light'&&state.botForce.length===2"),true);
 assert.match(elements.get('botHistory').textContent,/Behält Force für Reacts und Interrupts zurück/);
});

test('planned bot saves its Force for better deployment and crews an eligible fighter',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(261,0);state.game.botStrategyVersion=2;
  state.activeSide='Dark';state.botTurn={steps:botPlan(),index:3};state.activated=true;
  state.locations[3]={...dunes,icons:{light:3,dark:1}};
  state.dark[2]=[card('Dark:2355')];state.botHand=[card('Dark:1264'),card('Dark:2355')];state.botForce=[{}];`);
 assert.equal(run("legalActions(state,'Dark').some(action=>action.kind==='equip')"),true);
 assert.equal(run('botNextStep()&&state.dark[3].length===1&&state.dark[2][0].weapons===undefined'),true);
 run(`state.dark=[[scout]];state.light=[[]];state.botHand=[card('Dark:1279')];state.botForce=forcePile();
  state.locations=[{...kessel,icons:{dark:1,light:0}}];`);
 assert.ok(run("legalActions(state,'Dark').some(action=>action.kind==='transport'&&action.args[0]==='deployAboard'&&action.args[5]==='pilot')"));
 assert.equal(run("botNextStep()&&scout.occupants?.some(entry=>entry.role==='pilot')"),true);
});

test('planned bot rebuilds its hand and keeps its last Life Force',()=>{
 const {run}=reactHarness();
 run(`state.game.botStrategyVersion=2;state.phase=4;state.dark=[[],[]];
  state.botTurn={steps:botPlan(),index:5};state.botDeck=[];state.botHand=[];
  state.botForce=Array.from({length:6},(_,index)=>({name:'Force '+index}));`);
 assert.equal(run("botNextStep()&&state.phase===5"),true);
 assert.equal(run(`for(let i=0;i<7&&state.botTurn;i++)botNextStep();
  state.botHand.length===5&&lifeForceRemaining('Dark')===1&&state.activeSide==='Light'`),true);
});

test('planned bot passes on a React without Presence and pays attrition with the cheaper sufficient unit',()=>{
 const {run}=reactHarness();
 run(`state.game.botStrategyVersion=2;
  const blank={type:'Weapon',power:0,ability:0}, veteran={type:'Character',power:7,ability:4}, guard={type:'Character',power:1,ability:1};
  state.botHand=[blank];
  const opts=[PremiereGame.offer(state.game,'Dark','reactDeploy',[0,-1,1],{card:blank,cost:1}),
   PremiereGame.offer(state.game,'Dark','passResponse')];
  PremiereGame.openResponse(state.game,{kind:'drain',side:'Light',site:1,amount:2});`);
 assert.equal(run("botPromptAction(opts).kind"),'passResponse');
 run(`state.game.responses=[];
  state.dark[1]=[veteran,guard];
  battleSession={site:1,damage:{debt:{Dark:{damage:1,attrition:2,immunity:[]}}}};
  const forfeits=[veteran,guard].map((card,index)=>PremiereGame.offer(state.game,'Dark','battleForfeit',[index],{card,value:3}));`);
 assert.equal(run('botPromptAction(forfeits).card===guard'),true);
});

test('the bot skips a legal battle when the opponent is favored after estimated Destiny',()=>{
 const {run}=reactHarness();
 run(`state.phase=2;state.botTurn={steps:botPlan(),index:3};state.botForce=[{name:'Battle cost'}];
  state.light[0]=[{name:'Rebel',type:'Character',ability:4,power:4}];
  state.dark=[[{name:'Imperial',type:'Character',ability:2,power:5}],[]];`);
 assert.equal(run("botNextStep()&&state.phase===3&&!battleSession&&state.botForce.length===1"),true);
 assert.match(run('state.botHistory[0]'),/fehlt ein Vorteil/);
 assert.equal(run("legalActions(state,'Dark').some(action=>action.kind==='battle')"),true);
 assert.equal(run("botNextStep()&&state.phase===4&&!battleSession"),true);
});

test('the bot draws several cards to rebuild, preserves its last Life Force and can replay a one-card turn',()=>{
 for(const [adaptive,count,forceCount] of [[true,5,6],[true,2,3],[false,1,6]]){
  const {run}=reactHarness();
  run(`state.activeSide='Dark';state.dark=[[],[]];state.phase=4;state.botTurn={steps:botPlan(),index:5};
   state.botDeck=[];state.botHand=[];state.botUsed=[];
   state.botForce=Array.from({length:${forceCount}},(_,index)=>({name:'Force '+index}));`);
  assert.equal(run(`botNextStep(true,${adaptive})`),true);
  assert.equal(run('state.botHand.length'),count);
  assert.equal(run('state.botForce.length'),forceCount-count);
  assert.equal(run('state.gameWinner'),null);
  assert.equal(run("state.game.actions.filter(action=>action.kind==='draw').length"),count);
 }
});
test('each move reevaluates the available cards and legacy replay can leave the phase after one',()=>{
 for(const repeatPhase of [false,true]){
  const {run}=reactHarness();
  run(`state.phase=3;state.light=[[],[]];
   state.locations[1].icons.light=2;
   state.dark=[[{name:'First',type:'Character',ability:1},{name:'Second',type:'Character',ability:1}],[]];
   state.botForce=[{name:'Move 1'},{name:'Move 2'}];state.botTurn={steps:botPlan(),index:4};`);
  assert.equal(run('botNextStep()&&state.phase===4&&state.dark[1].length===1'),true);
  assert.equal(run(`botNextStep(${repeatPhase})`),true);
  assert.equal(run('state.phase'),repeatPhase?4:5);
  assert.equal(run('state.dark[1].length'),repeatPhase?2:1);
  if(repeatPhase)assert.equal(run('botNextStep()&&state.phase===5&&state.movedThisTurn.length===2'),true);
 }
});

test('lightsabers offer an optional bonus, and a forbidden location offers no drain',()=>{
 const {run}=reactHarness();
 run(`state.activeSide='Light';state.botTurn=null;
  state.dark[1]=[];wolfman.weapons=[{id:'Light:1386',type:'Weapon'}];`);
 assert.equal(run("legalActions(state,'Light').filter(action=>action.kind==='drain').map(action=>action.amount).join()"),'1,2');
 const column='renderPlaymatColumn(state.locations[0],0)';
 assert.match(run(column),/>Force Drain · 1 Force<\/button>.*>Force Drain · 2 Force \(\+1 Bonus\)<\/button>/);
 run('state.locations[0].icons.dark=0');
 assert.match(run(column),/>Force Drain · 0 Force<\/button>/);
 run("state.locationEffects={0:[{card:{id:'test modifier'},drainForbiddenFor:'Light'}]};");
 assert.equal(run("requestAction('drain','Light',[0,1])"),false);
 assert.doesNotMatch(run(column),/class="playmat-drain-actions"/);
});

test('Jawa deployment honors the Tatooine restriction and both players’ printed payments',async()=>{
 const {run}=await premiereHarness();
 run(`const card=id=>({...catalog.find(c=>c.id===id)}),jawa=card('Dark:1372'),camp=card('Dark:2454');
  const nonTatooine={name:'Hoth: A',type:'Location',subType:'Site',icons:{dark:2,light:1}};
  const other={name:'Tatooine: Another Site',type:'Location',subType:'Site',icons:{dark:2,light:1}};
  state=PremiereGame.createState(PremiereGame.actionState(43,0),[],[],[camp,nonTatooine,other],[0,2,1]);setupDecks=null;
  state.activeSide='Dark';state.phase=2;state.botTurn={steps:[],index:0};state.botHand=[jawa,{...jawa}];
  state.botForce=[{name:'Dark bottom'},{name:'Dark top'}];state.botDeck=[{}];state.deck=[{}];`);
 assert.equal(run("requestAction('deploy','Dark',[0,1])"),false);
 assert.equal(run("requestAction('deploy','Dark',[0,2])"),false);
 assert.ok(run("requestAction('deploy','Dark',[0,0])"));
 run("state.force=[{name:'Light payment'}]");
 assert.ok(run("requestAction('deploy','Dark',[0,2])"));
 assert.equal(run("state.dark[0].length===1&&state.dark[2].length===1&&state.used[0].name==='Light payment'&&state.botUsed.length===2"),true);
});

test('starfighters deploy with a manual pilot as one paid action and use the matching pilot bonuses',async()=>{
 const {run,elements}=await craftHarness();
 run("const red=card('Light:2060'),biggs=card('Light:239');state.hand=[red,biggs];select(0)");
 assert.match(elements.get('board').innerHTML,/Mit .*Biggs Darklighter ausspielen/);
 assert.equal(run("requestAction('deploy','Light',[0,0])"),false);
 assert.ok(run("requestAction('deployWithPilot','Light',[0,0,1])"));
 assert.equal(run(`state.hand.length===0&&state.light[0][0]===red&&red.occupants[0].card===biggs&&
  craftStats(red,0).power===5&&craftStats(red,0).maneuver===5&&craftStats(red,0).ability===biggs.ability`),true);
 assert.equal(run("PremiereLocations.aboard(state,biggs,red)&&!PremiereLocations.present(state,biggs,0)"),true);
 run('state.dark[0]=[tie];state.dark[2]=[bantha]');
 const field=run('renderPlaymatColumn(state.locations[0],0)');
 assert.match(field,/dark-zone.*?Power <b>1<\/b>.*?Ability <b>1<\/b>/);
 assert.match(run('renderPlaymatColumn(state.locations[2],2)'),/dark-zone.*?Power <b>1<\/b>.*?Ability <b>0,5<\/b>/);
 assert.match(field,/light-zone.*?aria-label="Pilot · [^"]*Biggs Darklighter ansehen".*?Power <b>5<\/b>.*?Ability <b>2<\/b>/);
});

test('Playmat distinguishes unknown Location status and marks only the actual hit card instance aboard',async()=>{
 const {run}=await craftHarness();
 run(`const damaged=card('Light:1677'),other=card('Light:1677'),hitPilot=card('Light:1098'),otherPilot=card('Light:1098');
  state.light[6]=[damaged,other];
  PremiereUnits.add(damaged,hitPilot,'pilot','Light');
  PremiereUnits.add(other,otherPilot,'pilot','Light');
  state.light[2]=[{name:'Unbekannte Ability',type:'Character'}];
  state.dark[2]=[card('Dark:2355')];
  battleSession={site:6,hitUnits:{Light:[hitPilot],Dark:[]}};`);
 const battleSite=run('renderPlaymatColumn(state.locations[6],6,false,[])');
 assert.equal((battleSite.match(/class="card-hit-label"/g)??[]).length,1);
 assert.match(battleSite,/aria-label="Pilot · [^"]*Han Solo ansehen · Getroffen" onclick="inspectStackLayer\('Light',6,0,0\)"/);
 const otherSite=run('renderPlaymatColumn(state.locations[2],2,false,[])');
 assert.match(otherSite,/dark-zone.*aria-label="Control · unbekannt"/);
 assert.match(otherSite,/light-zone.*aria-label="Presence · unbekannt"/);
 assert.doesNotMatch(otherSite,/class="card-hit-label"/);
 run('battleSession=null');
 assert.doesNotMatch(run('renderPlaymatColumn(state.locations[6],6,false,[])'),/class="card-hit-label"/);
});

test('a parked unpiloted fighter cannot take off until an eligible pilot boards',async()=>{
 const {run}=await craftHarness();
 run("const xwing=card('Light:2057'),leader=card('Light:2067');state.hand=[xwing];");
 assert.ok(run("requestAction('deploy','Light',[0,2])"));
 run("state.phase=4;state.light[2].push(leader);");
 assert.equal(run("movementOptionsFor('Light').some(move=>move.card===xwing)"),false);
 assert.equal(run("requestAction('transport','Light',['embark',2,2,1,0,'pilot'])"),true);
 assert.equal(run("requestAction('move','Light',[2,0,6,'Starten'])"),true);
 assert.equal(run("state.light[6][0]===xwing&&state.force.length===3&&xwing.occupants[0].card===leader"),true);
});

test('a landspeeder can move several sites for free with Luke and only one regular move per turn',async()=>{
 const {run}=await craftHarness();
 run(`const speeder=card('Light:1609'),luke=card('Light:1593');
  state.locations[4]=card('Light:2466');state.locationOrder=[0,1,2,4,3,6,5];
  state.phase=4;state.light[2]=[speeder,luke];state.force=[];`);
 assert.equal(run("requestAction('move','Light',[2,0,3,'Landspeed'])"),false);
 assert.equal(run("requestAction('transport','Light',['embark',2,2,1,0,'driver'])"),true);
 assert.equal(run("requestAction('move','Light',[2,0,3,'Landspeed'])"),true);
 assert.equal(run("requestAction('move','Light',[3,0,4,'Landspeed'])"),false);
 assert.equal(run("state.light[3][0]===speeder&&PremiereLocations.present(state,luke,3)&&state.used.length===0"),true);
});

test('Lift Tubes use interior mobile routes, and a grouped Docking Bay Transit pays once',async()=>{
 const {run}=await craftHarness();
 run(`const tube=card('Light:1548'),a=card('Light:2052'),b=card('Light:2040');
  state.locations[0]=card('Dark:669');state.locations[1]=card('Dark:678');state.locations[5]=card('Dark:675');
  state.locationOrder=[0,1,5,4,2,3,6];state.phase=4;state.light[0]=[tube];state.light[2]=[a,b];`);
 assert.equal(run("requestAction('move','Light',[0,0,5,'Landspeed'])"),true);
 assert.equal(run("requestAction('move','Light',[5,0,2,'Landspeed'])"),false);
 assert.equal(run("requestAction('transitGroup','Light',[2,5])"),true);
 assert.equal(run("state.light[5].includes(a)&&state.light[5].includes(b)&&state.used.length===2"),true);
});

test('selected units transit together, leaving unselected cards and their movement available',async()=>{
 const {run}=await craftHarness();
 run(`const a=card('Light:2052'),b=card('Light:2040'),c=card('Light:1098');
  const blaster=card('Light:259');a.weapons=[blaster];
  state.locations[5]=card('Dark:675');state.phase=4;state.light[2]=[a,b,c];
  const transit=legalActions(state,'Light').find(action=>action.kind==='transitGroup');`);
 assert.match(run("transportGroupMarkup(transit)"),/type="checkbox".*type="checkbox".*type="checkbox"/);
 assert.equal(run("requestAction('transitGroup','Light',[2,5,0,0])"),false);
 assert.equal(run("requestAction('transitGroup','Light',[2,5,0,99])"),false);
 assert.equal(run('state.light[2].length===3&&state.used.length===0'),true);
 run(`openMovement(2);
  const status={};
  const form={querySelector:()=>status,querySelectorAll:()=>[{value:'0'},{value:'2'}]};
  submitTransportGroup(form,transit);`);
 assert.equal(run("el('movementDialog').open"),false);
 assert.equal(run("state.light[2].length===1&&state.light[2][0]===b&&state.light[5].length===2&&state.light[5][0]===a&&state.light[5][1]===c&&a.weapons[0]===blaster"),true);
 assert.equal(run("state.used.length===1&&state.movedThisTurn.includes(a)&&state.movedThisTurn.includes(c)&&!state.movedThisTurn.includes(b)"),true);
});

test('group movement offers affordable shared destinations and pauses when a mine opens a decision',async()=>{
 const {run}=await craftHarness();
 run(`const first=card('Light:2052'),second=card('Light:2040'),mine=card('Dark:2609');
  setupDecks=null;state.game=PremiereGame.actionState(119,0);state.phase=4;state.light[2]=[first,second];
  state.buriedMines=[{side:'Dark',slot:3,card:mine}];state.botDeck=[{name:'Mine Destiny',destiny:1}];
  state.force=forcePile().slice(0,1);`);
 assert.equal(run('groupMovePlans(2,[0,1]).length'),0);
 run('state.force=forcePile().slice(0,2);state.light[2][1]=ship');
 assert.ok(run("groupMoveOptions(2,legalActions(state,'Light')).some(move=>move.card===ship&&move.movementKind==='Starten')"));
 assert.equal(run('groupMovePlans(2,[0,1]).length'),0);
 run(`state.light[2][1]=second;
  openMovement(2);
  const form={dataset:{slot:'2'},querySelectorAll:()=>[{value:'0'},{value:'1'}]};
  submitGroupMove(form,{value:'3'});`);
 assert.ok(run("state.light[3].includes(first)&&state.light[2].includes(second)&&state.used.length===1&&state.automatedPending?.kind==='mine'"));
 assert.equal(run("el('movementDialog').open"),false);
 assert.ok(run("state.log.some(message=>message.includes('1 von 2 Karten bewegt'))"));
});

test('shuttling to a capital ship, a docked transfer and cargo survival respect roles and timing',async()=>{
 const {run}=await craftHarness();
 run(`const big=card('Light:530'),other=card('Light:1677'),han=card('Light:1098'),cargo=card('Light:2161');
  state.phase=4;state.light[2]=[han,cargo];state.light[6]=[big,other];`);
 assert.equal(run("requestAction('transport','Light',['shuttleUp',2,6,0,0,'passenger'])"),true);
 assert.equal(run("requestAction('transport','Light',['dock',6,1,0,0,'pilot'])"),true);
 assert.equal(run("craftStats(other,6).power===5&&other.occupants[0].card===han"),true);
 assert.equal(run("requestAction('transport','Light',['shuttleUp',2,6,0,0,'cargo'])"),true);
 assert.equal(run("PremiereLocations.aboard(state,cargo,big)&&state.used.length===3"),true);
 assert.equal(run("requestAction('transport','Light',['shuttleDown',6,2,0,0,''])"),false);
});

test('docking moves multiple chosen passengers for one Force and validates final capacity atomically',async()=>{
 const {run}=await craftHarness();
 run(`const big=card('Light:530'),other=card('Light:1677'),han=card('Light:1098'),trooper=card('Light:2052'),luke=card('Light:1593');
  state.phase=4;state.light[6]=[big,other];
  PremiereUnits.add(big,han,'passenger','Light');PremiereUnits.add(big,trooper,'passenger','Light');
  PremiereUnits.add(other,luke,'passenger','Light');`);
 assert.match(run("transportGroupMarkup(legalActions(state,'Light').find(action=>action.kind==='dockGroup'))"),/Andocken.*Transfer ausführen/);
 assert.equal(run("requestAction('dockGroup','Light',[6,0,1,0,0,'passenger',0,1,'passenger'])"),false);
 assert.equal(run("requestAction('dockGroup','Light',[6,0,1,0,0,'passenger',0,0,'pilot'])"),false);
 assert.equal(run("big.occupants.length===2&&other.occupants.length===1&&state.used.length===0"),true);
 assert.equal(run("requestAction('dockGroup','Light',[6,0,1,0,0,'passenger',0,1,'passenger',1,0,'passenger'])"),true);
 assert.equal(run("big.occupants.length===1&&big.occupants[0].card===luke&&other.occupants[0].card===han&&other.occupants[1].card===trooper&&state.used.length===1"),true);
});

test('legacy saves keep their Seeker Control-phase docking actions',async()=>{
 const {run}=await craftHarness();
 run(`const first=card('Light:530'),second=card('Light:1677'),seeker=card('Dark:1096'),han=card('Light:1098');
  state.game=PremiereGame.actionState(42,1);state.game.cardRulesVersion=16;state.activeSide='Dark';state.botTurn={steps:[],index:0};
  state.light[6]=[first,second];PremiereUnits.add(first,seeker,'seeker','Dark');
  PremiereUnits.add(second,han,'pilot','Light');seeker.tableSide='Light';
  state.phase=4;`);
 assert.equal(run("seekerMoves('Dark').some(move=>move.args[2]==='dock')"),false);
 run("state.phase=1;const transfer=()=>legalActions(state,'Dark').find(action=>action.kind==='moveSeeker'&&action.args[2]==='dock');");
 assert.equal(run("!!transfer()"),true);
 assert.equal(run("performAction(transfer())"),true);
 assert.equal(run("!first.occupants.length&&second.occupants.some(entry=>entry.card===seeker&&entry.role==='seeker')&&state.botUsed.length===1"),true);
 assert.equal(run("!state.automatedPending&&state.light[6][1]===second&&state.botForce.length===4"),true);
 run('han.ability=2;findAutomatedWeapons()');
 assert.equal(run('state.lost.includes(han)&&state.botLost.includes(seeker)'),true);
});

test('a carrier loss loses attachments and crew under their owners, except Bantha passengers',async()=>{
 const {run}=await craftHarness();
 run(`const rebel=card('Light:2052'),vader=card('Dark:634');
  const lost=[],safe=[];PremiereUnits.add(bantha,vader,'passenger','Dark');
  PremiereUnits.remove(bantha,card=>lost.push(card),card=>safe.push(card));
  PremiereUnits.add(ship,rebel,'pilot','Light');ship.weapons=[card('Light:259')];
  PremiereUnits.remove(ship,card=>lost.push(card),card=>safe.push(card));`);
 assert.equal(run('safe[0]===vader&&lost.includes(rebel)&&lost.length===4&&!ship.occupants&&!ship.weapons'),true);
});

test('CZ-3 offers a paid Deploy-React at the adjacent drain and the arrival cancels it',()=>{
 const {run}=reactHarness();
 run(`state.light[0]=[{type:'Character',subType:'Droid',id:'Light:593'}];
  state.hand=[{id:'Light:2052',side:'Light',type:'Character',deploy:1,ability:1,name:'Rebel'}];`);
 assert.equal(run("requestAction('drain','Dark',[1])&&requestAction('reactDeploy','Light',[0,-1])"),true);
 assert.equal(run('state.light[1].length===0&&state.used.length===1&&state.hand.length===0'),true);
 assert.equal(run("requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
 assert.equal(run("state.light[1][0].name==='Rebel'&&state.pendingForceLoss===null&&state.game.responses.length===0"),true);
});

test('an active astromech supplies navigation and hyperspeed, and disabling the ship blocks the move',async()=>{
 const {run}=await craftHarness();
 run(`const red=card('Light:2060'),pilot=card('Light:239'),r2=card('Light:1995');
  state.light[5]=[red];state.phase=4;red.navComputer=false;
  PremiereUnits.add(red,pilot,'pilot','Light');`);
 assert.equal(run("movementOptionsFor('Light').some(move=>move.kind==='Hyperspeed')"),false);
 run("PremiereUnits.add(red,r2,'astromech','Light')");
 assert.equal(run("craftStats(red,5).hyperspeed===6&&movementOptionsFor('Light').some(move=>move.kind==='Hyperspeed')"),true);
 run('red.disabled=true');
 assert.equal(run("movementOptionsFor('Light').some(move=>move.kind==='Hyperspeed')"),false);
});

function segmentedBattleHarness(side='Light'){
 const fixture=weaponBattleHarness(side);
 fixture.run('state.game=PremiereGame.actionState(90,1);state.phase=3;state.trainingBattle=false;');
 return fixture;
}

test('battle preview is read-only, quotes ready weapons after payment and checks the offer again on confirm',()=>{
 const {run,elements}=segmentedBattleHarness();
 run(`rebel.weapons=[rifle];rebel.ability=4;trooper.gametext='Immune to attrition < 4.';
  const offer=()=>legalActions(state,'Light').find(action=>action.kind==='battle');
  const snapshot=()=>JSON.stringify({force:state.force,used:state.used,deck:state.deck,random:state.game.randomState,
   revision:state.game.revision,battle:battleSession,marked:state.battledCardsThisTurn});`);
 const before=run('snapshot()');
 assert.equal(run('openBattlePreview(offer())'),true);
 assert.equal(elements.get('battlePreview').open,true);
 assert.equal(run('snapshot()'),before);
 const sides=elements.get('battlePreviewSides');
 assert.match(sides.innerHTML,/Light Side.*Power 3.*1 möglich.*Blaster Rifle.*Rebel.*Trooper.*Dark Side.*Trooper · unter 4/s);
 assert.doesNotMatch(sides.innerHTML,/Battle draw|Weapon draw|Bot battle draw|Bot weapon draw/);
 assert.equal(elements.get('battlePreviewConfirm').textContent,'Kampf beginnen · 1 Force');
 run(`el('battlePreview').close();state.force.length=1;openBattlePreview(offer());`);
 assert.doesNotMatch(sides.innerHTML,/Blaster Rifle/);
 assert.match(sides.innerHTML,/kein bezahlbarer Schuss/);
 const gatedSnapshot=run('snapshot()');
 assert.equal(run("state.game.revision++;el('battlePreviewConfirm').onclick()"),false);
 assert.equal(elements.get('battlePreviewConfirm').disabled,true);
 assert.match(elements.get('battlePreviewStatus').textContent,/Spielstand hat sich geändert/);
 assert.equal(run('JSON.parse(snapshot()).force.length'),JSON.parse(gatedSnapshot).force.length);
 run("el('battlePreview').close();openBattlePreview(offer())");
 assert.equal(run("el('battlePreviewConfirm').onclick()"),true);
 assert.ok(run('battleSession&&state.force.length===0&&state.used.length===1'));
});

test('the Dark player previews troop power and both sides before paying for a battle',()=>{
 const {run,elements}=segmentedBattleHarness('Dark');
 run(`state.game.playerSide='Dark';state.botTurn=null;trooper.weapons=[blaster];
  openBattlePreview(legalActions(state,'Dark').find(action=>action.kind==='battle'))`);
 const markup=elements.get('battlePreviewSides').innerHTML;
 assert.match(markup,/Light Side.*Power 3.*Dark Side.*Power 3.*Imperial Blaster/s);
 assert.equal(run('state.botForce.length'),5);
 assert.equal(run("el('battlePreviewConfirm').onclick()"),true);
 assert.equal(run('state.botForce.length'),4);
 assert.match(elements.get('battlePriority').textContent,/Waffen · Priorität: Dark Side · Du bist dran/);
});

test('a regular battle advances from weapons through power to individual damage payments',()=>{
 const {run,elements}=segmentedBattleHarness();
 run('rebel.weapons=[rifle];');
 assert.equal(run("requestAction('trainingNight','Light',[true])"),false);
 assert.equal(run("requestAction('battle','Light',[0])&&battleSession.segment==='weapons'"),true);
 assert.equal(run("requestAction('trainingModifier','Light',['Light','power',12])"),false);
 assert.doesNotMatch(elements.get('battleDetails').innerHTML,/Manuelle Karten-Effekte/);
 assert.equal(run("requestAction('destiny','Light')"),false);
 assert.equal(run("requestAction('fireWeapon','Light',[0,0,0])&&battleSession.lastHit.card===trooper"),true);
 assert.equal(run("requestAction('passWeapons','Dark')&&requestAction('passWeapons','Light')&&battleSession.segment==='power'"),true);
 assert.equal(run("requestAction('skipDestiny','Light')&&requestAction('skipDestiny','Dark')&&battleSession.segment==='damage'"),true);
 assert.match(elements.get('battlePriority').textContent,/Schaden · Priorität: Light Side/);
 assert.match(elements.get('battleDetails').innerHTML,/Kampfergebnis · Gleichstand.*Battle Destiny 0 · verzichtet|Battle Destiny 0 · verzichtet.*Kampfergebnis · Gleichstand/s);
 assert.equal(run("requestAction('passDamage','Light')"),true);
 assert.equal(run("requestAction('passDamage','Dark')"),false);
 assert.match(elements.get('battleDetails').innerHTML,/Pflicht-Forfeits Trooper/);
 assert.equal(run("botDamageAction().kind"),'battleForfeit');
 assert.equal(run("performAction(botDamageAction())&&state.botLost.includes(trooper)"),true);
 assert.doesNotMatch(elements.get('battleDetails').innerHTML,/Pflicht-Forfeits Trooper/);
 assert.match(elements.get('battleDetails').innerHTML,/Battle Damage · 0 offen \(zu Beginn 0\)/);
 assert.equal(run("requestAction('passDamage','Light')&&performAction(botDamageAction())&&battleSession===null"),true);
});

test('the battle dialog shows facing participants, the current segment and active player',()=>{
 const {run,elements,tick}=segmentedBattleHarness();
 run('rebel.weapons=[rifle];setAutoBot(true);');
 assert.equal(run("requestAction('battle','Light',[0])"),true);
 assert.equal(elements.get('battleAnalysis').open,true);
 assert.match(elements.get('battleTitle').textContent,/Bodenkampf.*Tatooine/);
 assert.match(elements.get('battleDetails').innerHTML,/aria-current="step">Waffen<\/li>/);
 assert.match(elements.get('battleDetails').innerHTML,/battle-side light.*Rebel.*battle-side dark.*Trooper/);
 assert.match(elements.get('battlePriority').textContent,/Du bist dran/);
 assert.equal(tick(),false);
 assert.equal(run("requestAction('fireWeapon','Light',[0,0,0])"),true);
 assert.match(elements.get('battleDetails').innerHTML,/Trooper<small>Getroffen/);
 assert.match(elements.get('battleDetails').innerHTML,/Letzte Kampfaktionen.*feuert Blaster Rifle/);
 assert.match(elements.get('battleDetails').innerHTML,/Waffenergebnisse.*Blaster Rifle.*Destiny 4 gegen Verteidigung 3.*Treffer/s);
 assert.match(elements.get('battlePriority').textContent,/Bot entscheidet automatisch/);
 assert.equal(tick(),true);
 assert.match(elements.get('battlePriority').textContent,/Du bist dran/);
 assert.equal(tick(),false);
});

test('game log resets each turn and the latest bot log stays readable until the next Dark turn',()=>{
 const {run}=reactHarness();
 run("state.botHistory=['Alter Bot-Eintrag'];state.log=['Alter Spielzug'];endTurn('Dark')");
 assert.match(run("state.botHistory.join(' ')"),/Alter Bot-Eintrag/);
 assert.doesNotMatch(run("state.log.join(' ')"),/Alter Spielzug|Bot beendet/);
 run("log('Light-Aktion');endTurn('Light')");
 assert.doesNotMatch(run("state.botHistory.join(' ')"),/Alter Bot-Eintrag/);
 assert.doesNotMatch(run("state.log.join(' ')"),/Light-Aktion/);
 assert.match(run("state.log.join(' ')"),/Dark Side beginnt/);
});

test('Han can pay for one replacement after revealing destiny, and only the replacement counts',()=>{
 const {run,elements}=segmentedBattleHarness();
 run(`rebel.id='Light:1098';rebel.ability=4;state.deck=[{name:'Replacement',destiny:5},{name:'First draw',destiny:1}];`);
 assert.equal(run("requestAction('battle','Light',[0])&&requestAction('destiny','Light')"),true);
 assert.equal(run("state.used.length===1&&lifeForceRemaining('Light')===7"),true);
 assert.equal(elements.get('battleAnalysis').open,true);
 assert.match(elements.get('battleResponses').innerHTML,/First draw/);
 assert.equal(run("requestAction('destinyResponse','Light',['hanRedraw'])"),false);
 assert.equal(run("requestAction('passResponse','Dark')&&requestAction('destinyResponse','Light',['hanRedraw'])"),true);
 assert.equal(run("requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
 assert.equal(run("battleSession.lightDestiny===5&&state.used.slice(-2).map(card=>card.name).join()==='First draw,Replacement'"),true);
 assert.equal(run("PremiereGame.wasUsed(state.game,'battle','hanRedraw')"),true);
});

test('Tarkin with Vader cancels an opposing draw without creating attrition',()=>{
 const {run,elements}=segmentedBattleHarness();
 run(`rebel.ability=4;state.dark[0].push({id:'Dark:1061',type:'Character',name:'Grand Moff Tarkin',ability:3,power:2,forfeit:4},
  {id:'Dark:634',type:'Character',name:'Darth Vader',ability:6,power:6,forfeit:6});`);
 assert.equal(run("requestAction('battle','Light',[0])&&requestAction('destiny','Light')"),true);
 assert.match(elements.get('battlePriority').textContent,/Power & Destiny · Antwortfenster · Priorität: Dark Side/);
 assert.match(elements.get('battleDetails').innerHTML,/Gerade aufgedeckt · Battle Destiny · Weapon draw · 3/);
 assert.equal(run("requestAction('destinyResponse','Dark',['tarkinCancel'])"),true);
 assert.equal(run("requestAction('passResponse','Light')&&requestAction('passResponse','Dark')"),true);
 assert.equal(run("battleSession.lightDestiny===0&&!battleSession.battleDrawSucceeded.Light&&state.used.at(-1).name==='Weapon draw'"),true);
 assert.match(elements.get('battleDetails').innerHTML,/Battle Destiny · Weapon draw · aufgehoben/);
 assert.equal(run("requestAction('skipDestiny','Dark')&&battleSession.damage.debt.Dark.attrition===0"),true);
});

test('a printed battle Interrupt grants real draws and keeps the weapon segment open for passes',()=>{
 const {run}=segmentedBattleHarness();
 run(`rebel.name='•Luke Skywalker';officer.name='•Han Solo';rebel.ability=4;
  state.hand.push({id:'Light:758',name:"Don't Get Cocky",type:'Interrupt'});
  state.deck=[{name:'Spare',destiny:6},{name:'Third',destiny:3},{name:'Second',destiny:2},{name:'First',destiny:1}];`);
 assert.equal(run("requestAction('battle','Light',[0])&&battleSession.segment==='weapons'"),true);
 assert.equal(run("requestAction('battleEffect','Light',[1])&&battleSession.extraDraws.Light===2"),true);
 assert.equal(run("requestAction('passWeapons','Dark')&&requestAction('passWeapons','Light')"),true);
 assert.equal(run("requestAction('destiny','Light')&&battleSession.lightDestiny===6&&state.deck[0].name==='Spare'"),true);
});

test('The Circle Is Now Complete pays once, applies the saber bonus and removes only the losing persona',async()=>{
 const {run,elements}=await craftHarness();
 run(`const vader=card('Dark:634'),obi=card('Light:1803'),interrupt=card('Dark:2517'),blaster=card('Dark:1264');
  setupDecks=null;state.game=PremiereGame.actionState(43,1);state.activeSide='Dark';state.botTurn={steps:botPlan(),index:2};state.phase=1;
  state.dark[2]=[vader];state.light[3]=[obi];state.botHand=[interrupt];
  vader.weapons=[blaster];obi.weapons=[card('Light:1813')];state.hand=[];`);
 assert.equal(run("requestAction('duel','Dark',[0,2])"),false);
 assert.equal(run("state.botForce.length===5&&state.botHand[0]===interrupt"),true);
 run('state.light[2]=state.light[3].splice(0);const reserveCount=state.botDeck.length;');
 assert.equal(run("requestAction('duel','Dark',[0,2])"),true);
 assert.equal(run("state.outOfPlay[0]===vader&&state.botLost.includes(blaster)&&state.botLost.includes(interrupt)"),true);
 assert.equal(run("!state.botLost.includes(vader)&&state.light[2][0]===obi&&state.botUsed.length===1&&state.botDeck.length===reserveCount&&!battleSession"),true);
 assert.equal(run("withinDeploymentLimit(card('Dark:634'),'Dark')"),false);
 assert.match(elements.get('outOfPlay').textContent,/Darth Vader/);
});

test('the duel can be played in an opposing priority window and canceled with Sense',async()=>{
 const {run}=await craftHarness();
 run(`const vader=card('Dark:634'),obi=card('Light:1803'),interrupt=card('Dark:2517'),sense=card('Light:2217');
  state.game=PremiereGame.actionState(44,1);state.phase=0;
  state.dark[2]=[vader];state.light[2]=[obi];state.botHand=[interrupt];
  state.deck=[{name:'Spare',destiny:2},{name:'Sense Destiny',destiny:1}];state.hand=[sense];
  registerDuelTiming();`);
 assert.equal(run("requestAction('duel','Dark',[0,2])"),false);
 assert.equal(run("requestAction('activate','Light',[0])&&requestAction('timingTrigger','Dark',['premiere-duel'])"),true);
 assert.equal(run("requestAction('interruptResponse','Light',[0])&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
 assert.equal(run("state.botLost.includes(interrupt)&&state.used.includes(sense)&&!state.outOfPlay&&state.dark[2][0]===vader&&state.light[2][0]===obi"),true);
});

test('Prophetess predicts before Battle and receives exactly one reward or loss after power is decided',()=>{
 for(const predicted of ['Dark','Light']){
  const {run,elements}=segmentedBattleHarness('Dark');
  run(`const prophetess={id:'Dark:1958',name:'Prophetess',type:'Character',power:1,ability:1,forfeit:3};
   trooper.ability=1;state.dark[0].push(prophetess);
   const reward={name:'Lost card'};state.botLost=[reward];
   const randomBefore=state.game.randomState;`);
  assert.equal(run("requestAction('battle','Dark',[0])&&battleSession.segment==='initiation'"),true);
  assert.match(elements.get('battleControls').innerHTML,/Vorhersage des Bots zeigen/);
  assert.equal(run("requestAction('skipDestiny','Dark')||requestAction('battlePrediction','Light',['Light'])"),false);
  assert.equal(run(`requestAction('battlePrediction','Dark',['${predicted}'])&&battleSession.segment==='power'`),true);
  assert.equal(run("requestAction('skipDestiny','Dark')&&requestAction('skipDestiny','Light')"),true);
  assert.equal(run("battleSession.segment==='damage'"),true);
  if(predicted==='Dark'){
   assert.equal(run('state.botUsed.includes(reward)&&state.botLost.length===0&&state.game.randomState!==randomBefore'),true);
  }else{
   assert.equal(run('state.botLost.includes(reward)&&state.botLost.includes(blaster)&&state.botHand.length===0'),true);
  }
 }
});

test('Evazan operates immediately after any other character is hit or disarmed',()=>{
 const {run}=segmentedBattleHarness('Dark');
 run(`state.light[0]=[rebel];trooper.weapons=[blaster];state.dark[0].push({id:'Dark:768',name:'Dr. Evazan',type:'Character',ability:2,power:2,forfeit:3});`);
 assert.equal(run("requestAction('battle','Dark',[0])&&requestAction('fireWeapon','Dark',[0,0,0])"),true);
 assert.equal(run("PremiereGame.responseWindow(state.game)?.kind==='evazanWindow'&&requestAction('passResponse','Light')&&requestAction('interruptResponse','Dark',[-1,'evazan',0])"),true);
 assert.equal(run("requestAction('passResponse','Light')&&requestAction('passResponse','Dark')"),true);
 assert.equal(run("state.lost.includes(rebel)&&battleSession===null&&state.battledCardsThisTurn.includes(rebel)"),true);
});

test('damage freezes inherited immunity and an immune pilot may still forfeit to cover damage and attrition',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(91,1);state.phase=3;
  const falcon=card('Light:1677'),han=card('Light:1098'),enemy=card('Dark:723');
  PremiereUnits.add(falcon,han,'pilot','Light');state.light[0]=[falcon];state.dark[0]=[enemy];
  state.botDeck=[{name:'Dark destiny',destiny:4}];
  state.dark[0].push({...scout});`);
 assert.equal(run("requestAction('battle','Light',[0])&&requestAction('skipDestiny','Light')"),true);
 assert.equal(run("requestAction('destiny','Dark')"),false); // Permanent pilot abilities sum to only 3.
 run('enemy.occupants=[{role:"pilot",card:card("Dark:791")}];refreshBattleParticipants();');
 assert.equal(run("requestAction('destiny','Dark')"),true);
 assert.equal(run("battleSession.damage.debt.Light.immunity.includes(han)&&battleSession.damage.debt.Light.immunity.includes(falcon)"),true);
 assert.equal(run("requestAction('battleForfeit','Light',[1])&&state.lost.includes(han)"),true);
 assert.equal(run("battleSession.damage.debt.Light.immunity.includes(falcon)&&battleSession.damage.debt.Light.attrition===0"),true);
});

test('Battle, Power and Attrition Destiny use separate totals and actually draw from the deck',()=>{
 const {run,elements}=segmentedBattleHarness();
 run(`rebel.ability=4;state.deck=[{name:'Attrition',destiny:3},{name:'Power',destiny:2},{name:'Location',type:'Location'}];`);
 assert.equal(run("requestAction('battle','Light',[0])"),true);
 run("scheduleBattleDestiny('Light','power',1);scheduleBattleDestiny('Light','attrition',1);");
 assert.equal(run("requestAction('destiny','Light')&&requestAction('skipDestiny','Dark')"),true);
 assert.equal(run("battleSession.lightDestiny===0&&battleSession.damage.debt.Dark.damage===2&&battleSession.damage.debt.Dark.attrition===3"),true);
 assert.equal(run('state.deck.length===0&&state.used.length===4'),true);
 assert.match(elements.get('battleDetails').innerHTML,/Battle Destiny · Location · 0.*Power Destiny · Power · 2.*Attrition Destiny · Attrition · 3/s);
 assert.match(elements.get('battleDetails').innerHTML,/3 Power \+ 0 Battle Destiny \+ 2 weitere Power = <b>5.*3 Attrition gegen Dark Side/s);
});

test('damage payments alternate even when forfeiting removes all presence on the losing side',()=>{
 const {run,elements}=segmentedBattleHarness();
 run(`state.light[0]=[rebel];trooper.power=7;
  state.lostPileEffects=[{card:{name:'Eyes In The Dark'},target:'Light'}];
  const lostFromHand=state.hand[0].name;
  state.force.at(-1).name='Hidden Battle Loss';`);
 assert.equal(run("requestAction('battle','Light',[0])&&requestAction('skipDestiny','Light')&&requestAction('skipDestiny','Dark')"),true);
 assert.equal(run("requestAction('battleForceLoss','Light',['hand',0])"),true);
 assert.equal(run("requestAction('battleForfeit','Light',[0])"),false);
 assert.equal(run("requestAction('passDamage','Dark')&&requestAction('battleForfeit','Light',[0])"),true);
 assert.equal(run("!confirmedPresence('Light',0)&&battleSession.damage.debt.Light.damage===1&&battleSession.segment==='damage'"),true);
 assert.equal(run("requestAction('passDamage','Dark')&&requestAction('battleForceLoss','Light',['force'])"),true);
 assert.ok(elements.get('log').textContent.includes(run('lostFromHand')));
 assert.match(elements.get('log').textContent,/verliert eine verdeckte Karte für Battle Damage/);
 assert.doesNotMatch(elements.get('log').textContent,/Hidden Battle Loss/);
 assert.equal(run("requestAction('passDamage','Dark')&&requestAction('passDamage','Light')&&battleSession===null"),true);
});

test('using a lightsaber during a drain locks that carrier to the same weapon for the turn',()=>{
 const {run}=segmentedBattleHarness();
 run(`const saber={id:'Light:1386',type:'Weapon',side:'Light',name:'Lightsaber'};
  rebel.weapons=[saber,rifle];state.phase=1;state.locations[0].icons={light:1,dark:1};state.dark[0]=[];`);
 assert.equal(run("requestAction('drain','Light',[0,1])"),true);
 assert.equal(run("state.weaponUsesThisTurn[0].weapon===saber"),true);
 run('state.dark[0]=[trooper];state.phase=3;');
 assert.equal(run("requestAction('battle','Light',[0])&&battleSession.segment==='power'"),true);
 assert.equal(run("requestAction('fireWeapon','Light',[0,1,0])"),false);
});

test('all 25 Premiere weapons have a rule and deck validation admits them',async()=>{
 const {run}=await premiereHarness();
 assert.equal(run(`catalog.filter(card=>card.type==='Weapon').filter(card=>PremiereWeapons.definition(card)||
  PremiereWeapons.seeker(card)||PremiereWeapons.mine(card)).length`),25);
 const lists=structuredClone(starterLists);
 lists.decks.Light.cards.find(card=>card.id==='Light:259').id='Light:1962';
 assert.equal(run(`readStarterDecks(${JSON.stringify(lists)},catalog).light.cards.length`),60);
});

test('named pistols use alternative deploy costs and reset forfeit only for their named bearer',async()=>{
 const {run}=await premiereHarness();
 run(`const card=id=>({...catalog.find(c=>c.id===id)}),han=card('Light:1098'),leia=card('Light:1495'),rebel=card('Light:2052');
  const hanPistol=card('Light:1106'),leiaPistol=card('Light:1503'),enemy=card('Dark:2648');
  setupDecks=null;state=PremiereGame.createState(PremiereGame.actionState(115,2),[],[],[card('Light:2448')],[0]);
  state.phase=2;state.activeSide='Light';state.light[0]=[han,leia,rebel];state.dark[0]=[enemy];
  state.hand=[hanPistol,leiaPistol];state.force=Array.from({length:8},()=>({}));
  state.deck=[{name:'Spare'},{name:'Blaster draw',destiny:5}];state.botDeck=[{name:'Life'}];`);
 assert.equal(run("weaponDeployOptions('Light',0).map(option=>option.cost).join()"),'1,3,3');
 assert.equal(run("weaponDeployOptions('Light',1).map(option=>option.cost).join()"),'2,1,2');
 assert.equal(run("PremiereWeapons.shot(leiaPistol,leia,enemy,leia.ability,1).cost"),0);
 assert.equal(run("PremiereWeapons.shot(hanPistol,rebel,enemy,rebel.ability,1).effect"),'hit');
 assert.equal(run("requestAction('equip','Light',[0,0,0])"),true);
 run('state.phase=3;');
 assert.equal(run("requestAction('battle','Light',[0])&&requestAction('fireWeapon','Light',[0,0,0])"),true);
 // Han's optional redraw gives both sides an opportunity to respond to this weapon draw.
 assert.equal(run("requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
 assert.equal(run("battleSession.zeroForfeit.includes(enemy)&&battleForfeitValue(enemy,'Dark')===0"),true);
});

test('lightsabers enforce named and ability-based costs and use two draws against character and creature defense',async()=>{
 const {run}=await premiereHarness();
 assert.equal(run(`const byId=id=>catalog.find(card=>card.id===id);
  const obi=byId('Light:1803'),generic=byId('Light:1386'),named=byId('Light:1813'),bantha=byId('Dark:191');
  const result=PremiereWeapons.shot(generic,obi,bantha,obi.ability,bantha.maneuver);
  PremiereWeapons.deployCost(generic,obi,obi.ability)===1&&result.cost===1&&result.draws===2&&
  PremiereWeapons.deployCost(named,obi,obi.ability)===0&&PremiereWeapons.deployCost(named,byId('Light:2052'),1)===null;`),true);
});

test('Assault Rifle fires from an adjacent location only into the active battle',()=>{
 const {run}=segmentedBattleHarness('Dark');
 run(`const rifleman={name:'Rifleman',type:'Character',warrior:true,side:'Dark',ability:2,
  weapons:[{id:'Dark:146',side:'Dark',type:'Weapon',subType:'Character',name:'Assault Rifle'}]};state.dark[1]=[rifleman];
  const bystander={name:'Other Light',type:'Character',ability:1};state.light[1]=[bystander];`);
 assert.equal(run("requestAction('battle','Dark',[0])&&battleSession.segment==='weapons'"),true);
 assert.equal(run("battleWeaponOptions('Dark').every(option=>option.from===1&&option.target!==bystander)"),true);
 assert.equal(run("requestAction('fireWeapon','Dark',[0,0,0])"),false);
 assert.equal(run("requestAction('fireWeapon','Dark',[0,0,0,1])&&battleSession.hitUnits.Light.includes(rebel)"),true);
});

test('Light Repeating Blaster Rifle needs a present power droid and fires consecutively with a cost per shot',()=>{
 const {run}=segmentedBattleHarness('Dark');
 run(`trooper.weapons=[{id:'Dark:1551',side:'Dark',type:'Weapon',subType:'Character',name:'Light Repeating Blaster Rifle'}];
  state.botForce.push({},{});rebel.ability=2;`);
 assert.equal(run("battleSession={site:0,lightCard:null,darkCard:null};battleWeaponOptions('Dark').length"),0);
 run("battleSession=null;state.dark[0].push({id:'Dark:816',name:'EG-6',type:'Character',subType:'Droid'});");
 assert.equal(run("requestAction('battle','Dark',[0])&&requestAction('fireWeapon','Dark',[0,0,0])"),true);
 assert.equal(run("battleSession.weaponTurn==='Dark'&&battleSession.repeatingWeapon===trooper.weapons[0]"),true);
 assert.equal(run("requestAction('fireWeapon','Dark',[0,0,1])&&state.botForce.length===2"),true);
 assert.equal(run("battleSession.hitUnits.Light.length===2&&requestAction('passWeapons','Dark')&&battleSession.weaponTurn==='Light'"),true);
});

test('Gaderffii Stick blocks the chosen bearer only in the just-initiated battle',()=>{
 const {run}=segmentedBattleHarness('Dark');
 run(`trooper.name='Tusken Raider';trooper.weapons=[{id:'Dark:1002',side:'Dark',type:'Weapon',subType:'Character',name:'Gaderffii Stick'}];rebel.weapons=[rifle];`);
 assert.equal(run("requestAction('battle','Dark',[0])&&battleSession.segment==='initiation'"),true);
 assert.equal(run("requestAction('passResponse','Light')&&requestAction('gaderffii','Dark',[0,0,0])"),true);
 assert.equal(run("battleSession.blockedWeapons[0]===rebel&&state.botForce.length===4"),true);
 assert.equal(run("requestAction('passResponse','Light')&&requestAction('passResponse','Dark')&&battleSession.segment==='power'"),true);
});

test('a successful Ion Cannon destroys ship weapons and permanently resets defense and hyperspeed without a hit',async()=>{
 const {run}=await craftHarness();
 run(`const destroyer=card('Dark:1291'),ion=card('Dark:1327'),torpedoes=card('Light:1962');
  setupDecks=null;state.game=PremiereGame.actionState(116,0);state.phase=3;state.activeSide='Dark';state.botTurn={steps:[],index:0};
  state.light[1]=[ship];ship.weapons=[torpedoes];state.dark[1]=[destroyer];destroyer.weapons=[ion];
  state.botDeck=[{name:'Ion destiny',destiny:3}];`);
 assert.equal(run("requestAction('battle','Dark',[1])&&requestAction('fireWeapon','Dark',[0,0,0])"),true);
 assert.equal(run("ship.ionDamage&&state.lost.includes(torpedoes)&&ship.weapons.length===0&&!battleSession.hitUnits.Light.length"),true);
 assert.equal(run("craftStats(ship,1).hyperspeed===0&&craftStats(ship,1).maneuver===0&&craftStats(ship,1).power===3"),true);
});

test('the Laser Projector deploys inside and can itself be destroyed by a legal weapon',async()=>{
 const {run}=await craftHarness();
 run(`const projector=card('Dark:1479'),light=card('Light:2052'),dark=card('Dark:2355');
  setupDecks=null;state.game=PremiereGame.actionState(117,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};state.botHand=[projector];
  state.light[4]=[light];state.dark[4]=[dark];light.weapons=[card('Light:265')];
  state.deck=[{name:'Shot',destiny:3}];`);
 assert.equal(run("requestAction('deployAutomated','Dark',[0,3])"),false);
 assert.equal(run("requestAction('deployAutomated','Dark',[0,4])"),true);
 run("state.activeSide='Light';state.phase=3;state.botTurn=null;");
 assert.equal(run("requestAction('battle','Light',[4])&&requestAction('fireWeapon','Light',[0,0,1])"),true);
 assert.equal(run("state.botLost.includes(projector)&&state.dark[4].length===1&&!battleSession.hitUnits.Dark.length"),true);
});

test('seekers automatically resolve their chosen target on either side',async()=>{
 const {run,elements}=await craftHarness();
 run(`const seeker=card('Light:2400'),enemy=card('Dark:2355'),ally=card('Light:2052');ally.ability=1;
  setupDecks=null;state.game=PremiereGame.actionState(118,0);state.hand=[seeker];state.light[3]=[ally];state.dark[3]=[enemy];
  state.locationOrder=[0,1,2,3,4,6,5];`);
 assert.equal(run("requestAction('deployAutomated','Light',[0,3])"),false);
 assert.equal(run("requestAction('deployAutomated','Light',[0,2])"),true);
 assert.equal(run("seekerMoves('Light').length"),0);
 run("state.activeSide='Dark';state.phase=4;state.botTurn={steps:[],index:0};const choice=legalActions(state,'Light').find(action=>action.kind==='moveSeeker'&&action.to===3);");
 assert.equal(run('performAction(choice)&&state.automatedPending.kind==="seeker"'),true);
 assert.match(elements.get('controlPanel').innerHTML,/Ziel des Seekers/);
 assert.equal(run("requestAction('automatedTarget','Light',[1])&&state.botLost.includes(enemy)&&state.lost.includes(seeker)"),true);
 assert.equal(run('state.light[3].includes(ally)'),true);
});

test('each Timer Mine waits for its owner’s next turn and the targeted side chooses its character',()=>{
 for(const side of ['Light','Dark']){
  const {run}=segmentedBattleHarness(side);
  run(`const mine={id:'${side==='Light'?'Light:2610':'Dark:2609'}',side:'${side}',type:'Weapon',name:'Timer Mine'};
   const droid={id:'${side==='Light'?'Light:1556':'Dark:1557'}',type:'Character',subType:'Droid',name:'Mining Droid'};
   const own=PremiereGame.zones(state,'${side}'),enemy=PremiereGame.zones(state,PremiereGame.otherSide('${side}'));
   own.hand.push(mine);own.board[0].push(droid);own.deck.push({name:'Mine draw',destiny:1});state.phase=2;`);
  assert.equal(run(`requestAction('deployAutomated','${side}',[1,0])`),true);
  assert.equal(run('own.board[0].includes(mine)&&!state.automatedPending'),true);
  run(`endTurn('${side}');findAutomatedWeapons();`);
  assert.equal(run('own.board[0].includes(mine)'),true);
  run(`endTurn(PremiereGame.otherSide('${side}'));findAutomatedWeapons();`);
  assert.equal(run('own.lost.includes(mine)&&state.automatedPending.remaining===1'),true);
  assert.equal(run(`requestAction('automatedTarget',PremiereGame.otherSide('${side}'),[0])&&enemy.lost.length===1`),true);
 }
});

test('Disarmed works during the opposing Control phase and prevents later weapon transfer onto the character',async()=>{
 const {run}=await craftHarness();
 run(`const own=card('Light:2052'),target=card('Dark:2355'),weapon=card('Dark:264'),other=card('Dark:1279');
  own.weapons=[card('Light:259')];target.weapons=[weapon];other.weapons=[card('Dark:264')];
  state.activeSide='Dark';state.botTurn={steps:[],index:0};state.phase=1;
  state.light[2]=[own];state.dark[2]=[target,other];state.hand=[card('Light:735')];`);
 assert.equal(run("performAction(legalActions(state,'Light').find(option=>option.args[0]==='disarm'))"),true);
 assert.equal(run("state.botLost.includes(weapon)&&cardPowerModifier(target,'Dark',2)===-1"),true);
 run("state.phase=2;state.botHand=[card('Dark:264')];");
 assert.equal(run("weaponDeployOptions('Dark',0).some(option=>option.host===target)||weaponEffectOptions('Dark').some(option=>option.target?.host===target)"),false);
});

test('all ship armaments enforce their printed mounts, targeting families and shot modifiers',async()=>{
 const {run}=await craftHarness();
 assert.equal(run(`const torps=card('Light:1962'),quad=card('Light:1971'),boosted=card('Dark:303'),ion=card('Dark:1327'),turbo=card('Dark:2644');
  const corvette=card('Light:530'),destroyer=card('Dark:1291'),advanced=card('Dark:2595');
  PremiereWeapons.deployCost(torps,ship,1)===1&&PremiereWeapons.deployCost(torps,corvette,1)===null&&
  PremiereWeapons.deployCost(quad,corvette,1)===2&&PremiereWeapons.shot(quad,corvette,ship,1,4).bonus===1&&
  PremiereWeapons.deployCost(boosted,advanced,1)===1&&PremiereWeapons.shot(boosted,advanced,destroyer,1,5).bonus===-1&&
  PremiereWeapons.deployCost(ion,ship,1)===null&&PremiereWeapons.deployCost(ion,destroyer,1)===2&&
  PremiereWeapons.deployCost(turbo,{type:'Location',subType:'System',locationTags:['Mobile']},0)===3&&
  PremiereWeapons.shot(turbo,destroyer,ship,1,4).draws===2&&PremiereWeapons.shot(turbo,destroyer,ship,1,4).bonus===-5;`),true);
});

test('Combined Attack pays for two legally mounted weapons and applies their combined result in the chosen order',async()=>{
 const {run,elements}=await craftHarness();
 run(`const corvette=card('Light:530'),wing=card('Light:2838'),target=card('Dark:2600'),attack=card('Light:483');
  const quad=card('Light:1971'),torpedo=card('Light:1962');
  setupDecks=null;state.game=PremiereGame.actionState(47,1);state.phase=3;state.light[6]=[corvette,wing];
  target.maneuver=4;state.dark[6]=[target];corvette.weapons=[quad];wing.weapons=[torpedo];
  state.hand=[attack];state.botHand=[];state.deck=[{name:'Reserve'},{name:'First destiny',destiny:2},{name:'Second destiny',destiny:2}];`);
 assert.equal(run("requestAction('battle','Light',[6])&&battleSession.weaponTurn==='Light'"),true);
 assert.match(elements.get('battleControls').innerHTML,/Combined Attack.*Kombiniert feuern/);
 run('const remainingForce=state.force;state.force=remainingForce.slice(0,1);');
 assert.equal(run("requestAction('combinedAttack','Light',[0,0,1,0])"),false);
 run('state.force=remainingForce;');
 assert.equal(run("requestAction('combinedAttack','Light',[0,0,0,0])||requestAction('combinedAttack','Light',[0,0,0])"),false);
 assert.equal(run('state.force.length===4&&state.hand[0]===attack&&state.deck.length===3'),true);
 assert.equal(run("requestAction('combinedAttack','Light',[0,0,1,0])"),true);
 assert.equal(run("state.force.length===2&&state.used.length===5&&state.deck.length===1&&state.lost.includes(attack)"),true);
 assert.equal(run("battleSession.hitUnits.Dark[0]===target&&battleSession.usedWeapons[0]===torpedo&&battleSession.usedWeapons[1]===quad&&battleSession.weaponTurn==='Dark'"),true);
 assert.match(run('state.log.join("\\n")'),/Combined Attack 5 gegen Verteidigung 4 · Treffer/);
});

test('a buried mine and a dud are hidden until crossed by a vehicle, whose crew is eligible for loss',async()=>{
 const {run,elements}=await craftHarness();
 run(`const mine=card('Light:2610'),dud={name:'Hidden Dud',side:'Light'},droid=card('Light:1556'),
  vehicle=card('Dark:2660'),driver=card('Dark:2355');
  setupDecks=null;state.game=PremiereGame.actionState(119,0);state.hand=[mine,dud];state.light[3]=[droid];
  state.locations[4]=card('Light:2466');state.locationOrder=[0,1,2,3,4,6,5];
  state.deck=[{name:'Mine Destiny',destiny:1}];`);
 assert.equal(run("!requestAction('buryMineCard','Light',[0,2])&&requestAction('buryMineCard','Light',[0,3])&&requestAction('buryMineCard','Light',[0,3])"),true);
 assert.equal(run(`const view=PremiereGame.playerView(state,'Dark');view.buriedCounts[3]===2&&!JSON.stringify(view).includes('Hidden Dud')`),true);
 assert.match(elements.get('board').innerHTML,/2 verdeckte Karten/);
 run("state.activeSide='Dark';state.phase=4;state.botTurn={steps:[],index:0};state.dark[2]=[vehicle];PremiereUnits.add(vehicle,driver,'driver','Dark');");
 assert.equal(run("requestAction('move','Dark',[2,0,4,'Landspeed'])&&state.automatedPending.kind==='mine'"),true);
 assert.equal(run("state.buriedMines.length===0&&state.lost.includes(dud)&&state.lost.includes(mine)"),true);
 assert.equal(run("requestAction('automatedTarget','Dark',[0])&&state.botLost.includes(driver)&&state.dark[4][0]===vehicle"),true);
});

test('all four seekers distinguish named characters from their printed fallback and ability ceilings',async()=>{
 const {run}=await premiereHarness();
 assert.equal(run(`const card=id=>catalog.find(c=>c.id===id);
  const han=card('Light:1098'),tarkin=card('Dark:1061'),luke=card('Light:1593');
  PremiereWeapons.seekerTarget(card('Light:2400'),{type:'Character',warrior:true},2)&&
  !PremiereWeapons.seekerTarget(card('Light:2400'),{type:'Character',warrior:true},3)&&
  PremiereWeapons.seekerTarget(card('Light:2426'),tarkin,2)&&
  PremiereWeapons.seekerTarget(card('Dark:1096'),han,2)&&
  PremiereWeapons.seekerTarget(card('Dark:1592'),luke,3)&&!PremiereWeapons.seekerTarget(card('Dark:1592'),luke,4);`),true);
});

test('Overload compares weapon destiny and removes a carrier on zero',async()=>{
 const {run}=await craftHarness();
 run(`const a=card('Light:2052'),b=card('Light:239'),weapon=card('Light:265');
  setupDecks=null;state.game=PremiereGame.actionState(120,0);state.light[2]=[a,b];a.weapons=[weapon];
  state.botHand=[card('Dark:1880')];state.botDeck=[{name:'Empty-site Draw',type:'Location'}];`);
 assert.equal(run("performAction(legalActions(state,'Light').find(action=>action.args[0]==='transfer'))"),true);
 assert.equal(run('a.weapons.length===0&&b.weapons[0]===weapon&&state.used.length===2'),true);
 run("state.phase=4;");
 assert.equal(run("performAction(legalActions(state,'Dark').find(action=>action.args[0]==='overload'))"),true);
 assert.equal(run("state.lost.includes(weapon)&&state.lost.includes(b)&&state.light[2][0]===a&&state.botUsed.length===1"),true);
});

test('Hydroponics Station offers each permitted activation draw',async()=>{
 const {run,elements}=await craftHarness();
 run(`const station=card('Light:1196'),vaporator=card('Light:2705');
  setupDecks=null;state.game=PremiereGame.actionState(121,0);state.hand=[station,vaporator];
  const first={name:'First'},second={name:'Second'},third={name:'Third'};`);
 assert.equal(run("!requestAction('deployLocationEffect','Light',[0,4])&&requestAction('deployLocationEffect','Light',[0,3])"),true);
 assert.equal(run("state.force.length===4&&activationDrawAllowance('Light')===1"),true);
 run("state.phase=0;state.deck=[third,second,first];");
 assert.equal(run("!requestAction('activate','Light',[2,2])&&requestAction('activate','Light',[2,1])"),true);
 assert.equal(run("state.hand[1]===first&&state.force.at(-1)===second&&state.deck[0]===third"),true);
 run("state.phase=2;");
 assert.equal(run("!requestAction('deployLocationEffect','Light',[0,0])&&requestAction('deployLocationEffect','Light',[0,4])"),true);
 run("state.phase=0;state.activated=false;state.deck=[third,second,first];presentGame();");
 assert.match(elements.get('forceControls').innerHTML,/Erste aktivierte Karte.*Zweite aktivierte Karte/);
 assert.equal(run("requestAction('activate','Light',[2,2])"),true);
 assert.equal(run("state.hand.at(-1)===second&&state.force.at(-1)===first&&state.deck[0]===third"),true);
});

test('Vaporator protects all characters at its site and neighbors from Gravel Storm',async()=>{
 const {run}=await craftHarness();
 run(`const vaporator=card('Light:2705'),storm=card('Dark:1064'),local=card('Light:2052'),remote=card('Light:2052'),inside=card('Light:2052');
  setupDecks=null;state.game=PremiereGame.actionState(122,0);state.hand=[vaporator];state.botHand=[storm];
  state.locations[5]=card('Light:2462');state.locations[5].name='Tatooine: Jundland Wastes';
  state.locationOrder=[4,2,3,5,6,0,1];state.light[2]=[local];state.light[3]=[card('Light:2052')];
  state.light[4]=[inside];state.light[5]=[remote];state.botDeck=[{name:'Spare'},{name:'High',destiny:3}];`);
 assert.equal(run("requestAction('deployLocationEffect','Light',[0,2])"),true);
 run("state.activeSide='Dark';state.phase=1;state.botTurn={steps:[],index:0};");
 assert.equal(run("const storms=legalActions(state,'Dark').filter(action=>action.kind==='gravelStorm');storms.length===1&&storms[0].target===remote"),true);
 assert.equal(run("performAction(storms[0])&&state.lost.includes(remote)&&state.botLost.includes(storm)&&state.botUsed.at(-1).destiny===3"),true);
 assert.equal(run("state.light[3].length===1&&state.light[4][0]===inside"),true);
 run("state.botHand=[card('Dark:1064')];state.botDeck=[{name:'Tie',destiny:1}];state.light[5]=[remote];");
 assert.equal(run("remote.ability=1;performAction(legalActions(state,'Dark').find(action=>action.kind==='gravelStorm'))&&state.light[5][0]===remote"),true);
});

test('Beru and Owen give Luke cumulative power through the next Light turn when lost on the Dark turn',async()=>{
 const {run}=await craftHarness();
 run(`const beru=card('Light:221'),owen=card('Light:1883'),luke=card('Light:1593');
  setupDecks=null;state.game=PremiereGame.actionState(123,0);state.activeSide='Dark';state.light[2]=[beru,owen];`);
 assert.equal(run("loseTableCard('Light',2,beru)&&loseTableCard('Light',2,owen)&&state.lost.includes(beru)&&state.lost.includes(owen)"),true);
 run("state.light[2]=[luke];const bonus=()=>cardPowerModifier(luke,'Light',2);");
 assert.equal(run("bonus()"),6);
 assert.equal(run("PremiereGame.resetTurn(state,'Light');bonus()"),6);
 assert.equal(run("PremiereGame.resetTurn(state,'Dark');bonus()"),0);
 assert.equal(run("PremiereGame.resetTurn(state,'Light');state.light[2].push(beru);loseTableCard('Light',2,beru);bonus()"),0);
});

test('Tooex grants power and station immunity only under nighttime conditions',async()=>{
 const {run}=await craftHarness();
 run(`const station=card('Light:1196'),tooex=card('Light:2'),rebel=card('Light:2052'),dark=card('Dark:2355');
  setupDecks=null;state.game=PremiereGame.actionState(124,0);state.hand=[station];state.light[3]=[rebel,tooex];state.dark[3]=[dark];`);
 assert.equal(run("requestAction('deployLocationEffect','Light',[0,3])"),true);
 run("state.phase=3;state.nightConditions=true;requestAction('battle','Light',[3]);");
 assert.equal(run("cardPowerModifier(rebel,'Light',3)===2&&battleImmunity('Light',rebel)===3"),true);
 assert.equal(run("cardPowerModifier(dark,'Dark',3)===0&&battleImmunity('Dark',dark)===0"),true);
 assert.equal(run("station.gameTextCancelled=true;cardPowerModifier(rebel,'Light',3)===2&&battleImmunity('Light',rebel)===0"),true);
 assert.equal(run("station.gameTextCancelled=false;tooex.gameTextCancelled=true;battleImmunity('Light',rebel)===0"),true);
 assert.equal(run("tooex.gameTextCancelled=false;state.nightConditions=false;cardPowerModifier(rebel,'Light',3)===0&&battleImmunity('Light',rebel)===0"),true);
});

test('both Sandcrawlers enforce their destination and capacity and grant non-cumulative Jawa forfeit',async()=>{
 const {run}=await craftHarness();
 run(`const l=card('Light:2161'),d=card('Dark:2160'),jawa=catalog.find(c=>c.side==='Light'&&c.name==='Jawa');
  const pilot=card('Light:2052'),interior=state.locations[4];
  const offset=()=>battleForfeitValue(jawa,'Light')-jawa.forfeit;
  setupDecks=null;state.game=PremiereGame.actionState(125,0);state.hand=[l];state.light[3]=[pilot,jawa];`);
 assert.equal(run("requestAction('deploy','Light',[0,3])&&craftDeployCost(d,dunes,'Dark')===d.deploy"),true);
 assert.equal(run("craftDeployCost(l,dantooine,'Light')===null&&craftDeployCost(d,interior,'Dark')===null"),true);
 for(const side of ['Light','Dark']){
  const crawler=side==='Light'?'l':'d';
  const crew=side==='Light'?'Light:2052':'Dark:2355';
  assert.equal(run(`(()=>{
   const host=${crawler},driver=card('${crew}');
   if(!PremiereUnits.accepts(host,driver,'driver'))return false;
   PremiereUnits.add(host,driver,'driver','${side}');
   for(let i=0;i<7;i++){
    const passenger=card('${crew}');
    if(!PremiereUnits.accepts(host,passenger,'passenger'))return false;
    PremiereUnits.add(host,passenger,'passenger','${side}');
   }
   return !PremiereUnits.accepts(host,card('${crew}'),'driver')&&!PremiereUnits.accepts(host,card('${crew}'),'passenger');
  })()`),true);
 }
 run("state.locationOrder=[2,3,4,6,0,1,5];state.phase=4;state.dark[3]=[d];");
 assert.equal(run("travelOptions(l,'Light',3,2).some(move=>move.kind==='Landspeed')&&travelOptions(d,'Dark',3,2).some(move=>move.kind==='Landspeed')"),true);
 run("state.locations[2]={...dock,locationTags:['Exterior','Mobile']};");
 assert.equal(run("!travelOptions(d,'Dark',3,2).length&&!travelOptions(l,'Light',3,2).length"),true);
 run("state.locations[2]=dock;battleSession={site:3};");
 assert.equal(run("offset()"),1);
 run("d.gameTextCancelled=true;l.gameTextCancelled=true;");
 assert.equal(run("offset()"),0);
});

test('both Callers update ownership and resolve duplicate personas',async()=>{
 for(const side of ['Light','Dark']){
  const {run}=await craftHarness();
  const opponent=side==='Light'?'Dark':'Light';
  run(`const side='${side}',opponent='${opponent}';
   const caller=card('${side==='Light'?'Light:348':'Dark:347'}'),bolt=card('${side==='Light'?'Dark:2099':'Light:2100'}');
   const host=card('${side==='Light'?'Light:2052':'Dark:2355'}');
   const original=card('${side==='Light'?'Light:1995':'Dark:816'}');
   const target=card('${side==='Light'?'Dark:2001':'Light:2000'}');
   original.personas=['Shared Droid'];target.personas=['Shared Droid'];target.uniquenessLimit=1;
   setupDecks=null;state.game=PremiereGame.actionState(126,0);state.activeSide=side;
   const own=PremiereGame.zones(state,side),rival=PremiereGame.zones(state,opponent);
   own.hand.splice(0,own.hand.length,caller);own.board[3]=[host];own.board[2]=[original];
   rival.hand.length=0;rival.board[3]=[target];target.attachments=[bolt];
   state.botTurn=side==='Dark'?{steps:[],index:0}:null;`);
  assert.equal(run("requestAction('deployDevice',side,[0,3,0])"),true);
  assert.equal(run("!deviceActions(side).some(option=>option.args[0]==='stealDroid')"),true);
  run("state.phase=1;const choices=legalActions(state,side).filter(action=>action.kind==='deviceAction');");
  assert.equal(run("choices.length===2&&choices.some(action=>action.lostDroid.card===target)"),true);
  assert.equal(run("performAction(choices.find(action=>action.lostDroid.card===original))"),true);
  assert.equal(run("target.owner===side&&target.side===opponent&&rival.hand.includes(bolt)&&own.lost.includes(original)&&own.board[3].includes(target)"),true);
  assert.equal(run("loseTableCard(side,3,target)&&own.lost.includes(target)&&!rival.lost.includes(target)"),true);
  run("own.lost.splice(own.lost.indexOf(target),1);own.hand.push(target);state.phase=2;");
  assert.equal(run("requestAction('deploy',side,[own.hand.indexOf(target),3])&&own.board[3].includes(target)"),true);
 }
});

test('Feltipern Trevagg resets the cost using icons present with him and checks for droids',async()=>{
 const {run,elements}=await craftHarness();
 run(`const trevagg=card('Dark:934'),droid=card('Dark:2783'),trooper=card('Dark:2355'),rebel=card('Light:2052');
  const crawler=card('Dark:2160');
  setupDecks=null;state.game=PremiereGame.actionState(127,0);state.phase=3;state.force=forcePile().slice(0,2);
  state.locations[2]=card('Light:2462');state.light[2]=[rebel];state.dark[2]=[trevagg,trooper];`);
 assert.equal(run("battleInitiationCost(2)"),3);
 assert.equal(run("requestAction('battle','Light',[2])"),false);
 run("state.force=forcePile();presentGame();");
 assert.match(elements.get('board').innerHTML,/Kampfvorschau · 3 Force/);
 assert.equal(run("battleOpeningPreview('Light',2).cost"),3);
 run("state.dark[2].push(droid)");
 assert.equal(run("battleInitiationCost(2)"),1);
 run("state.dark[2]=[crawler,trooper];PremiereUnits.add(crawler,trevagg,'passenger','Dark');state.force=[];");
 assert.equal(run("openBattlePreview(findOffer(legalActions(state,'Light'),'battle',2))&&state.used.length===0"),true);
 assert.equal(elements.get('battlePreviewConfirm').textContent,'Kampf beginnen · 0 Force');
 assert.equal(run("el('battlePreviewConfirm').onclick()&&state.used.length===0"),true);
});

test('Garindan enables deployment and adjacent moves only with an eligible Rebel',async()=>{
 const {run}=await craftHarness();
 run(`const garindan=card('Dark:1011'),leia=card('Light:1593'),trooper=card('Dark:2355');
  setupDecks=null;state.game=PremiereGame.actionState(128,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};
  state.locationOrder=[2,3,4,6,0,1,5];state.botHand=[trooper];state.botForce=[];
  state.dark[3]=[garindan];state.dark[2]=[card('Dark:2355')];`);
 assert.equal(run("requestAction('deploy','Dark',[0,3])"),false);
 run("state.light[3]=[leia];");
 assert.equal(run("requestAction('deploy','Dark',[0,3])&&state.dark[3].includes(trooper)"),true);
 run("state.phase=4;");
 assert.equal(run("const mover=state.dark[2][0];requestAction('move','Dark',[2,0,3,'Landspeed'])&&state.dark[3].includes(mover)&&!state.botUsed.length"),true);
 run("leia.ability=2;");
 assert.equal(run("garindanBenefit('Dark',3,'imperialMove')"),null);
});

test('Kitik cannot board and is lost when Kal shares her site',async()=>{
 const {run}=await craftHarness();
 run(`const kitik=card('Dark:1445'),kal=card('Light:1407'),other=card('Dark:2355');
  setupDecks=null;state.game=PremiereGame.actionState(129,0);state.phase=4;state.locationOrder=[2,3,4,6,0,1,5];
  state.light[2]=[kal];state.dark[3]=[other,kitik];`);
 assert.equal(run("PremiereUnits.accepts(card('Dark:2160'),kitik,'passenger')||PremiereUnits.accepts(card('Dark:2602'),kitik,'pilot')"),false);
 assert.equal(run("PremiereUnits.accepts(card('Dark:1291'),kitik,'passenger')"),true);
 assert.equal(run("requestAction('move','Light',[2,0,3,'Landspeed'])&&state.botLost.includes(kitik)&&state.light[3].includes(kal)&&state.dark[3].includes(other)"),true);
});

test('Ponda Baba gains power with Evazan unless a lightsaber is present and adds ship power as pilot',async()=>{
 const {run}=await craftHarness();
 run(`const ponda=card('Dark:1922'),evazan=card('Dark:768'),luke=card('Light:1593'),saber=card('Light:1386'),destroyer=card('Dark:1291');
  setupDecks=null;state.game=PremiereGame.actionState(130,0);state.phase=3;
  state.dark[3]=[ponda,evazan];state.light[3]=[luke];`);
 assert.equal(run("requestAction('battle','Light',[3])&&combatPartnerPower(ponda,'Dark',3)===3"),true);
 const boosted=run("battleTotals(3).darkPower");
 run("luke.weapons=[saber];");
 assert.equal(run("battleTotals(3).darkPower"),boosted-3);
 run("luke.weapons=[];state.dark[3]=[ponda];PremiereUnits.add(destroyer,ponda,'pilot','Dark');");
 assert.equal(run("combatPartnerPower(ponda,'Dark',3)===0&&craftStats(destroyer,6).power===destroyer.power+2"),true);
});

test('Treadwell protects friendly vehicles, droids and fighters from attrition',async()=>{
 const {run}=await craftHarness();
 run(`const droid=card('Dark:2783'),vehicle=card('Dark:2660'),foreign=card('Light:1609'),tieFighter=card('Dark:2600');
  const other=card('Dark:2001');
  setupDecks=null;state.game=PremiereGame.actionState(131,0);state.dark[2]=[droid,vehicle,other];state.light[2]=[foreign];state.dark[6]=[tieFighter];`);
 run("state.phase=3;battleSession={site:2,participants:{Light:[foreign],Dark:[droid,vehicle,other]}};");
 assert.equal(run("battleImmunity('Dark',vehicle)===2&&battleImmunity('Dark',other)===2&&battleImmunity('Light',foreign)===0"),true);
 run("battleSession.site=6;");
 assert.equal(run("battleImmunity('Dark',tieFighter)"),3);
 run("droid.gameTextCancelled=true;");
 assert.equal(run("battleImmunity('Dark',tieFighter)"),0);
 run("droid.gameTextCancelled=false;state.dark[2]=[vehicle,other];state.dark[3]=[droid];");
 assert.equal(run("battleImmunity('Dark',tieFighter)"),0);
});

test('both pilot trainers grant pilot skill or a ship power bonus',async()=>{
 for(const side of ['Light','Dark']){
  const {run}=await craftHarness();
  const [first,existing,trainer,craft,droid]=side==='Light'
   ?['Light:2052','Light:2040','Light:826','Light:530','Light:1995']
   :['Dark:2355','Dark:1279','Dark:190','Dark:1291','Dark:816'];
  run(`const side='${side}',actor=card('${first}'),pilot=card('${existing}'),droid=card('${droid}'),
   trainer=card('${trainer}'),second=card('${trainer}'),craft=card('${craft}');
   setupDecks=null;state.game=PremiereGame.actionState(132,0);state.activeSide=side;
   const own=PremiereGame.zones(state,side);
   own.hand.splice(0,own.hand.length,trainer,second);own.board[3]=[actor,pilot,droid];
   state.botTurn=side==='Dark'?{steps:[],index:0}:null;`);
  assert.equal(run("!PremiereUnits.accepts(craft,actor,'pilot')&&!requestAction('deployTableEffect',side,[0,2])"),true);
  assert.equal(run("requestAction('deployTableEffect',side,[0,0])&&PremiereUnits.accepts(craft,actor,'pilot')&&actor.attachments[0]===trainer"),true);
  assert.equal(run("requestAction('deployTableEffect',side,[0,2])"),true);
  assert.equal(run("PremiereUnits.trainingPower(actor,true)===2&&PremiereUnits.trainingPower(pilot,true)===1&&!alterTarget(trainer)"),true);
  run("PremiereUnits.add(craft,actor,'pilot',side);own.board[3]=[craft,pilot,droid];");
  assert.equal(run("craftStats(craft,6).power"),run("craft.power+2"));
  run("cancelTableEffect(state.tableEffects[0]);");
  assert.equal(run("craft.occupants[0].role==='passenger'&&!PremiereUnits.hasSkill(actor,'pilot')&&own.lost.includes(trainer)"),true);
 }
});

test('both warrior trainers grant warrior skill or character power and leave with the host',async()=>{
 for(const side of ['Light','Dark']){
  const {run}=await craftHarness();
  const ids=side==='Light'?['Light:2040','Light:2052','Light:2157','Light:265']:['Dark:1279','Dark:2355','Dark:1430','Dark:264'];
  run(`const side='${side}',recruit=card('${ids[0]}'),veteran=card('${ids[1]}'),trainer=card('${ids[2]}'),
   second=card('${ids[2]}'),blaster=card('${ids[3]}');
   setupDecks=null;state.game=PremiereGame.actionState(133,0);state.activeSide=side;
   const own=PremiereGame.zones(state,side);own.hand.splice(0,own.hand.length,trainer,second,blaster);
   own.board[3]=[recruit,veteran];state.botTurn=side==='Dark'?{steps:[],index:0}:null;`);
  assert.equal(run("!weaponDeployOptions(side,2).some(option=>option.host===recruit)"),true);
  assert.equal(run("requestAction('deployTableEffect',side,[0,0])&&requestAction('deployTableEffect',side,[0,2])"),true);
  assert.equal(run("weaponDeployOptions(side,0).some(option=>option.host===recruit)&&PremiereUnits.canEscort(recruit)"),true);
  assert.equal(run("cardPowerModifier(recruit,side,3)===0&&cardPowerModifier(veteran,side,3)===1"),true);
  assert.equal(run("loseTableCard(side,3,recruit)&&own.lost.includes(trainer)&&!state.tableEffects.some(effect=>effect.card===trainer)"),true);
 }
});

test('Rycar Ryjerd grants smuggler skill or character power',async()=>{
 const {run}=await craftHarness();
 run(`const rebel=card('Light:2040'),smuggler=card('Light:1098'),rycar=card('Light:2141'),copy=card('Light:2141');
  setupDecks=null;state.game=PremiereGame.actionState(134,0);state.hand=[rycar,copy];
  state.light[3]=[rebel,smuggler];`);
 assert.equal(run("!matchesRegisteredTarget(rebel,'underworld')&&matchesRegisteredTarget(smuggler,'underworld')"),true);
 assert.equal(run("requestAction('deployTableEffect','Light',[0,0])&&requestAction('deployTableEffect','Light',[0,2])"),true);
 assert.equal(run("matchesRegisteredTarget(rebel,'underworld')&&cardPowerModifier(rebel,'Light',3)===0&&cardPowerModifier(smuggler,'Light',3)===1"),true);
 assert.equal(run("state.force.length===5&&state.tableEffects.length===2&&!alterTarget(rycar)"),true);
});

test('all four seekers use the opposing Move phase, start unoccupied and kill both target and seeker',async()=>{
 for(const [side,id,targetId] of [
  ['Light','Light:2400','Dark:2355'],['Light','Light:2426','Dark:2648'],
  ['Dark','Dark:1096','Light:1407'],['Dark','Dark:1592','Light:2040'],
 ]){
  const {run}=await craftHarness();
  run(`const side='${side}',opponent=PremiereGame.otherSide(side),seeker=card('${id}'),target=card('${targetId}');
   setupDecks=null;state.game=PremiereGame.actionState(135,0);state.activeSide=side;
   const own=PremiereGame.zones(state,side),rival=PremiereGame.zones(state,opponent);
   own.hand.splice(0,own.hand.length,seeker);rival.board[3]=[target];
   state.locationOrder=[2,3,4,6,0,1,5];state.botTurn=side==='Dark'?{steps:[],index:0}:null;`);
  assert.equal(run("!requestAction('deployAutomated',side,[0,3])&&requestAction('deployAutomated',side,[0,2])"),true);
  assert.equal(run("own.force.length===4&&seeker.tableSide===opponent&&!confirmedPresence(side,2)"),true);
  assert.equal(run("state.phase=1;seekerMoves(side).length"),0);
  assert.equal(run("state.phase=4;seekerMoves(side).length"),0);
  run("state.activeSide=opponent;state.botTurn=opponent==='Dark'?{steps:[{kind:'draw'}],index:0}:null;");
  assert.equal(run("const movement=legalActions(state,side).find(action=>action.kind==='moveSeeker'&&action.to===3);performAction(movement)"),true);
  assert.equal(run("own.lost.includes(seeker)&&rival.lost.includes(target)&&own.used.length===2"),true);
 }
});

test('a Light seeker can pass during the Dark move phase and uses its owner’s docking bay text',async()=>{
 const {run,elements}=await craftHarness();
 run(`const seeker=card('Light:2400'),speeder=card('Dark:2660');
  setupDecks=null;state.game=PremiereGame.actionState(136,0);state.activeSide='Dark';
  state.locations[4]=card('Light:2853');
  state.phase=4;state.light[2]=[seeker];state.dark[2]=[speeder];
  state.botTurn={steps:[{kind:'draw'}],index:0};presentGame();`);
 assert.match(elements.get('controlPanel').innerHTML,/Seeker-Bewegung beenden/);
 assert.equal(run("const moves=seekerMoves('Light');moves.some(move=>move.to===4&&move.args[2]==='transit'&&move.cost===1)&&!moves.some(move=>move.host===speeder)"),true);
 assert.equal(run("!legalActions(state,'Dark').some(action=>action.kind==='botStep')&&requestAction('skipSeekerMove','Light')"),true);
 assert.equal(run("legalActions(state,'Dark').some(action=>action.kind==='botStep')&&!seekerMoves('Light').length"),true);
});

test('Laser Projector checks destiny and targets before marking a hit',async()=>{
 const {run}=await craftHarness();
 run(`const projector=card('Dark:1479'),target=card('Light:2052'),enemySeeker=card('Light:2426');
  const trooper=card('Dark:2355');
  setupDecks=null;state.game=PremiereGame.actionState(137,0);state.activeSide='Dark';state.phase=3;
  state.dark[4]=[projector,trooper];state.light[4]=[target,enemySeeker];state.botTurn={steps:[],index:0};
  state.botDeck=[{name:'High',destiny:4}];`);
 assert.equal(run("requestAction('battle','Dark',[4])&&battleSession.weaponTurn==='Dark'"),true);
 assert.equal(run("battleWeaponOptions('Dark').some(shot=>shot.target===enemySeeker&&shot.defense===1&&shot.cost===0)"),true);
 run("const choices=()=>legalActions(state,'Dark').filter(action=>action.kind==='fireWeapon');state.botDeck=[];");
 assert.equal(run("choices().length"),0);
 run("state.botDeck=[{name:'High',destiny:4}];");
 assert.equal(run("performAction(choices().find(action=>action.target===target))&&battleSession.hitUnits.Light.includes(target)&&state.botForce.length===4"),true);
});

test('Comlink and CZ-3 apply normal React deployment rules to crew and Devices',async()=>{
 for(const side of ['Light','Dark']){
  const {run}=await craftHarness();
  const opponent=side==='Light'?'Dark':'Light';
  run(`const side='${side}',opponent='${opponent}',source=card('${side==='Light'?'Light:593':'Light:2052'}');
   const crew=card('${side==='Light'?'Light:2052':'Dark:2355'}'),driver=card('${side==='Light'?'Light:2040':'Dark:1279'}');
   const carrier=card('${side==='Light'?'Light:1609':'Dark:2660'}'),device=card('${side==='Light'?'Light:2435':'Dark:2360'}');
   const comlink=card('Dark:489'),own=PremiereGame.zones(state,side),rival=PremiereGame.zones(state,opponent);
   setupDecks=null;state.game=PremiereGame.actionState(138,0);
   own.hand.splice(0,own.hand.length,crew,device);rival.hand.length=0;
   state.locationOrder=[4,3,2,6,0,1,5];
   own.board[3]=[carrier,card('${side==='Light'?'Light:2052':'Dark:2355'}')];
   rival.board[3]=[card('${side==='Light'?'Dark:2355':'Light:2052'}')];
   PremiereUnits.add(carrier,driver,'driver',side);`);
  if(side==='Dark'){
   run("rival.board[2]=[source];state.activeSide='Dark';own.hand.unshift(comlink);");
   assert.equal(run("requestAction('deployDevice','Dark',[0,2,0,'Light'])&&source.attachments.includes(comlink)"),true);
  }else run("own.board[2]=[source];");
  run("state.activeSide=opponent;state.phase=3;state.botTurn=opponent==='Dark'?{steps:[],index:0}:null;");
  assert.equal(run("requestAction('battle',opponent,[3])"),true);
  assert.equal(run(`const offer=(placement)=>legalActions(state,side).find(action=>action.kind==='reactDeploy'&&action.placement===placement);
   offer('device')?.cost===1&&offer('crew')?.item===carrier`),true);
  const startingForce=run("own.force.length");
  assert.equal(run("performAction(offer('crew'))&&requestAction('passResponse',opponent)&&requestAction('passResponse',side)"),true);
  assert.equal(run("carrier.occupants.some(entry=>entry.card===crew)&&!own.board[3].includes(crew)"),true);
  assert.equal(run("requestAction('passResponse',opponent)&&performAction(offer('device'))"),true);
  assert.equal(run("requestAction('passResponse',opponent)&&requestAction('passResponse',side)"),true);
  assert.equal(run("PremiereLocations.findEntry(state,device)?.slot"),3);
  assert.equal(run("own.force.length"),startingForce-2);
  run("own.hand.push(card(side==='Light'?'Light:2052':'Dark:2355'));");
  assert.equal(run("reactDeployOptions(side,{kind:'battle',side:opponent,site:2}).length>0"),true);
  run("(side==='Light'?source:comlink).gameTextCancelled=true;");
  assert.equal(run("reactDeployOptions(side,{kind:'battle',side:opponent,site:2}).length"),0);
 }
});

test('both Disarmed effects remove existing weapons only with an armed character present',async()=>{
 for(const side of ['Light','Dark']){
  const {run}=await craftHarness();
  run(`const side='${side}',opponent=PremiereGame.otherSide(side);
   const own=PremiereGame.zones(state,side),rival=PremiereGame.zones(state,opponent);
   const actor=card(side==='Light'?'Light:2052':'Dark:2355'),target=card(side==='Light'?'Dark:2355':'Light:2052');
   const disarmed=card(side==='Light'?'Light:735':'Dark:734'),weapon=card(side==='Light'?'Dark:1264':'Light:259');
   setupDecks=null;state.game=PremiereGame.actionState(139,0);state.activeSide=opponent;state.phase=1;
   own.hand.splice(0,own.hand.length,disarmed);target.weapons=[weapon];own.board[3]=[actor];rival.board[3]=[target];`);
  assert.equal(run("const action=()=>legalActions(state,side).find(option=>option.args[0]==='disarm');!action()"),true);
  run("actor.weapons=[card(side==='Light'?'Light:259':'Dark:1264')];");
  assert.equal(run("performAction(action())&&rival.lost.includes(weapon)&&own.hand.length===0"),true);
  assert.equal(run("PremiereWeapons.disarmed(target)&&PremiereWeapons.deployCost(weapon,target,1)===null&&cardPowerModifier(target,opponent,3)===-1&&!alterTarget(disarmed)"),true);
 }
});

test('Blaster Rack stores weapons, releases them at their normal price and loses them when canceled',async()=>{
 const {run}=await craftHarness();
 run(`const rack=card('Dark:262'),second=card('Dark:262'),weapon=card('Dark:1264'),owner=card('Dark:2355'),recipient=card('Dark:2355');
  setupDecks=null;state.game=PremiereGame.actionState(140,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};
  state.hand=[];state.botHand=[rack,second];state.dark[3]=[owner];state.dark[2]=[recipient];owner.weapons=[weapon];`);
 assert.equal(run("requestAction('deployTableEffect','Dark',[0])&&requestAction('deployTableEffect','Dark',[0])&&blasterRacks().length===2"),true);
 run("state.activeSide='Light';state.phase=5;state.botTurn=null;");
 assert.equal(run("const store=()=>legalActions(state,'Dark').find(action=>action.args[0]==='rackIn'&&action.rack.card===second);performAction(store())"),true);
 assert.equal(run("!owner.weapons.length&&blasterRacks()[1].weapons[0]===weapon&&!legalActions(state,'Dark').some(action=>action.args[0]==='rackOut')"),true);
 run("state.activeSide='Dark';state.phase=2;state.botTurn={steps:[],index:0};");
 assert.equal(run("performAction(legalActions(state,'Dark').find(action=>action.args[0]==='rackOut'&&action.target.host===recipient))"),true);
 assert.equal(run("recipient.weapons[0]===weapon&&state.botUsed.length===1&&performAction(store())"),true);
 run("state.hand=[card('Light:95')];state.light[3]=[card('Light:1593')];state.deck=[{name:'Low',destiny:1}];");
 assert.equal(run("requestAction('cancelTableEffect','Light',[0,1])&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
 assert.equal(run("blasterRacks().length===1&&state.botLost.includes(second)&&state.botLost.includes(weapon)"),true);
});

test('Affect Mind and Lack of Faith reduce total ability only at a site without the opposing Jedi',async()=>{
 for(const side of ['Light','Dark']){
  const {run}=await craftHarness();
  const ids=side==='Light'?['Light:68','Light:1803','Light:1593','Dark:1279','Dark:634']:
   ['Dark:1208','Dark:634','Dark:1279','Light:2040','Light:1803'];
  run(`const side='${side}',opponent=PremiereGame.otherSide(side),effect=card('${ids[0]}'),jedi=card('${ids[1]}');
   const invalid=card('${ids[2]}'),rivalOne=card('${ids[3]}'),rivalTwo=card('${ids[3]}'),counter=card('${ids[4]}');
   setupDecks=null;state.game=PremiereGame.actionState(141,0);state.activeSide=side;
   const own=PremiereGame.zones(state,side),rival=PremiereGame.zones(state,opponent);
   own.hand.splice(0,own.hand.length,effect);rival.hand.length=0;
   state.botTurn=side==='Dark'?{steps:[],index:0}:null;
   own.board[3]=[invalid,jedi];rival.board[3]=[rivalOne,rivalTwo];`);
  assert.equal(run("!requestAction('deployTableEffect',side,[0,0])&&requestAction('deployTableEffect',side,[0,1])"),true);
  assert.equal(run("own.force.length===4&&jedi.attachments.includes(effect)&&jediAbilityReduction(opponent,3)===2"),true);
  assert.equal(run("battleTotals(3)[opponent.toLowerCase()+'Ability']===Math.max(0,cardAbility(rivalOne)+cardAbility(rivalTwo)-2)"),true);
  run("rival.board[3].push(counter);");
  assert.equal(run("jediAbilityReduction(opponent,3)"),0);
  run("rival.board[3].pop();own.board[3]=[invalid];own.board[6]=[jedi];");
  assert.equal(run("jediAbilityReduction(opponent,3)===0&&jediAbilityReduction(opponent,6)===0"),true);
 }
});

test('Demotion cancels text and reduces power on eligible Imperials until Alter removes the Effect',async()=>{
 const {run}=await craftHarness();
 run(`const effect=card('Light:695'),praji=card('Dark:502'),vader=card('Dark:634'),stormtrooper=card('Dark:2355');
  setupDecks=null;state.game=PremiereGame.actionState(142,0);state.hand=[effect];state.dark[3]=[vader,stormtrooper,praji];state.botHand=[];
  const admiral=card('Dark:723');`);
 assert.equal(run("const demotions=legalActions(state,'Light').filter(action=>action.kind==='deployTableEffect');demotions.length===1&&demotions[0].host===praji&&performAction(demotions[0])"),true);
 assert.equal(run("state.force.length===3&&PremiereUnits.textSuppressed(praji)&&cardPowerModifier(praji,'Dark',3)===-2"),true);
 run("PremiereUnits.add(admiral,praji,'pilot','Dark');state.dark[3]=[vader,stormtrooper];state.dark[6]=[admiral];");
 assert.equal(run("craftStats(admiral,6).power===admiral.power&&craftStats(admiral,6).hyperspeed===admiral.hyperspeed"),true);
 run("state.botHand=[card('Dark:94')];state.botDeck=[{name:'Low',destiny:1}];");
 assert.equal(run("requestAction('cancelTableEffect','Dark',[0,0])&&requestAction('passResponse','Light')&&requestAction('passResponse','Dark')"),true);
 assert.equal(run("!PremiereUnits.textSuppressed(praji)&&state.lost.includes(effect)&&craftStats(admiral,6).power===admiral.power+2&&craftStats(admiral,6).hyperspeed===admiral.hyperspeed+1"),true);
});

test('both Jawa effects charge each player and add forfeit only to their own Jawas',async()=>{
 for(const side of ['Light','Dark']){
  const {run}=await craftHarness();
  run(`const side='${side}',opponent=PremiereGame.otherSide(side);
   const effect=card(side==='Light'?'Light:1380':'Dark:1378'),jawa=card(side==='Light'?'Light:1373':'Dark:1372');
   const rivalJawa=card(side==='Light'?'Dark:1372':'Light:1373'),other=card(side==='Light'?'Light:2052':'Dark:2355');
   const own=PremiereGame.zones(state,side),rival=PremiereGame.zones(state,opponent);
   setupDecks=null;state.game=PremiereGame.actionState(143,0);state.activeSide=side;
   own.hand.splice(0,own.hand.length,effect);rival.hand.length=0;
   state.botTurn=side==='Dark'?{steps:[],index:0}:null;const reserve=rival.force.splice(2,3);
   own.board[3]=[jawa,other];rival.board[3]=[rivalJawa];`);
  assert.equal(run("!requestAction('deployTableEffect',side,[0])&&own.force.length===5&&rival.force.length===2"),true);
  assert.equal(run("rival.force.push(...reserve);requestAction('deployTableEffect',side,[0])"),true);
  assert.equal(run("own.force.length===2&&rival.force.length===2&&own.used.length===3&&rival.used.length===3"),true);
  run("battleSession={site:3};");
  assert.equal(run("battleForfeitValue(jawa,side)===jawa.forfeit+1&&battleForfeitValue(rivalJawa,opponent)===rivalJawa.forfeit&&battleForfeitValue(other,side)===other.forfeit"),true);
  run("cancelTableEffect(state.tableEffects[0]);");
  assert.equal(run("battleForfeitValue(jawa,side)===jawa.forfeit&&own.lost.includes(effect)"),true);
 }
});

test('Electrobinoculars only shows the owner the top card and can move it to Force',async()=>{
 const {run,elements}=await craftHarness();
 run(`const binoculars=card('Light:821'),enemy=card('Dark:2355'),droid=card('Light:1995'),secret={name:'Own blind top'};
  setupDecks=null;state.game=PremiereGame.actionState(144,0);state.hand=[binoculars];state.dark[3]=[enemy];state.light[3]=[droid];
  state.deck=[{name:'Own later card'},secret];`);
 assert.equal(run("!requestAction('deployDevice','Light',[0,3,0])&&requestAction('deployDevice','Light',[0,3,0,'Dark'])"),true);
 assert.equal(run("const look=()=>legalActions(state,'Light').find(action=>action.kind==='cardInformation');performAction(look())"),true);
 assert.equal(run("!legalActions(state,'Dark').length&&state.force.length===2"),true);
 assert.match(elements.get('controlPanel').innerHTML,/Own blind top/);
 assert.doesNotMatch(run("state.log.join(' ')"),/Own blind top/);
 assert.equal(run("requestAction('finishCardInformation','Light',['force'])&&state.force.at(-1)===secret"),true);
 assert.equal(run("performAction(look())&&requestAction('finishCardInformation','Light',['deck'])&&state.deck.at(-1).name==='Own later card'"),true);
});

test('Macroscan keeps its peek private and expands it at night',async()=>{
 const {run,elements}=await craftHarness();
 run(`const scan=card('Dark:1617');
  setupDecks=null;state.game=PremiereGame.actionState(145,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};
  state.botHand=[scan];state.hand=[];state.deck=[{name:'Hidden Bottom'},{name:'Hidden Third'},{name:'Hidden Second'},{name:'Hidden Top'}];`);
 assert.equal(run("requestAction('deployTableEffect','Dark',[0])&&state.botForce.length===3"),true);
 run("state.activeSide='Light';state.phase=5;state.botTurn=null;");
 assert.equal(run("const scanDeck=()=>legalActions(state,'Dark').find(action=>action.kind==='cardInformation');performAction(scanDeck())"),true);
 assert.equal(run("state.pendingCardView.shown.length===1&&state.pendingCardView.shown[0].name==='Hidden Top'"),true);
 assert.doesNotMatch(elements.get('controlPanel').innerHTML,/Hidden Top/);
 assert.equal(run("requestAction('finishCardInformation','Dark',['deck'])"),true);
 run("state.nightConditions=true;");
 assert.equal(run("performAction(scanDeck())&&state.pendingCardView.shown.map(card=>card.name).join() === 'Hidden Top,Hidden Second,Hidden Third'"),true);
 assert.equal(run("requestAction('finishCardInformation','Dark',['deck'])&&state.deck.length===4&&state.botForce.length===1"),true);
});

test('Labria reveals a card and chooses a valid pile once per Control phase',async()=>{
 const {run,elements}=await craftHarness();
 run(`const labria=card('Dark:1460'),rebel=card('Dark:2355'),fighter=card('Dark:2600');
  setupDecks=null;state.game=PremiereGame.actionState(146,0);state.activeSide='Dark';state.phase=1;state.botTurn={steps:[],index:0};
  state.dark[3]=[labria];state.botDeck=[fighter,rebel];`);
 assert.equal(run("const look=()=>legalActions(state,'Dark').find(action=>action.kind==='cardInformation');performAction(look())&&state.pendingCardView.shown[0]===rebel"),true);
 assert.match(elements.get('controlPanel').innerHTML,/Stormtrooper/);
 assert.equal(run("requestAction('finishCardInformation','Dark',['used'])&&state.botUsed.at(-1)===rebel&&!look()"),true);
 run("PremiereGame.resetTurn(state,'Dark');state.phase=1;");
 assert.equal(run("performAction(look())&&!state.pendingCardView&&state.botLost.includes(fighter)"),true);
});

test('Leesub chooses a card position without seeing the hand',async()=>{
 const {run,elements}=await craftHarness();
 run(`const leesub=card('Light:1489'),target=card('Dark:2355'),vehicle=card('Dark:2660');
  setupDecks=null;state.game=PremiereGame.actionState(147,0);state.phase=1;
  state.light[3]=[leesub];state.botHand=[target,vehicle];`);
 assert.equal(run("const guess=()=>legalActions(state,'Light').find(action=>action.kind==='cardInformation');performAction(guess())"),true);
 assert.match(elements.get('controlPanel').innerHTML,/Tipp abgeben/);
 assert.doesNotMatch(elements.get('controlPanel').innerHTML,/Stormtrooper|Ubrikkian/);
 assert.equal(run("!requestAction('finishCardInformation','Light',['Weapon',2])&&requestAction('finishCardInformation','Light',['Starship',0])"),true);
 assert.equal(run("state.botHand[0]===target&&state.botHand[1]===vehicle&&state.force.length===4&&!guess()"),true);
 run("PremiereGame.resetTurn(state,'Light');state.phase=1;");
 assert.equal(run("performAction(guess())&&requestAction('finishCardInformation','Light',['Character',0])&&state.botLost.includes(target)"),true);
});

test('M’iiyoom reveals the hand and loses only unique male Rebels and aliens',async()=>{
 const {run}=await craftHarness();
 run(`const onith=card('Dark:1613'),han=card('Light:1098'),leia=card('Light:1495'),owen=card('Light:1883'),
   trooper=card('Light:2052'),r2=card('Light:1995');
  setupDecks=null;state.game=PremiereGame.actionState(148,0);state.activeSide='Dark';state.phase=1;
  state.botTurn={steps:[],index:0};state.dark[3]=[onith];state.hand=[han,leia,owen,trooper,r2];
  const extra=state.botForce.pop();`);
 assert.equal(run("const reveal=()=>legalActions(state,'Dark').find(action=>action.kind==='cardInformation');!reveal()"),true);
 assert.equal(run("state.botForce.push(extra);performAction(reveal())&&state.botUsed.length===5&&state.botForce.length===0"),true);
 assert.equal(run("state.lost.includes(han)&&state.lost.includes(owen)&&state.hand.length===3&&[leia,trooper,r2].every(card=>state.hand.includes(card))"),true);
 assert.match(run("state.log.join(' ')"),/deckt die Hand auf.*Han Solo.*Leia Organa.*Owen Lars/);
});

test('Scanning Crew and Radar Scanner reveal both hands correctly and move only eligible targets',async()=>{
 const {run,elements}=await craftHarness();
 run(`const scan=card('Dark:2176'),radar=card('Light:2011'),rebel=card('Light:2052'),luke=card('Light:1593'),weapon=card('Light:259');
  setupDecks=null;state.game=PremiereGame.actionState(149,0);state.hand=[rebel,luke,weapon];
  state.botHand=[scan];state.activeSide='Dark';state.phase=2;state.botTurn={steps:[],index:0};`);
 assert.equal(run("requestAction('pileInterrupt','Dark',[0,'scanning'])&&state.pendingCardView.shown.length===3"),true);
 assert.match(elements.get('controlPanel').innerHTML,/Rebel Trooper.*Luke Skywalker.*Blaster/);
 assert.equal(run("!requestAction('finishCardInformation','Dark',['move',2])&&requestAction('finishCardInformation','Dark',['move',1])"),true);
 assert.equal(run("state.used.at(-1)===luke&&state.botUsed.at(-1)===scan&&state.hand.includes(rebel)"),true);
 run(`const jawa=card('Dark:1372'),dathcha={name:'Dathcha',type:'Character',subType:'Alien',characteristics:['jawa']};
  state.hand=[radar];state.botHand=[jawa,tusken,dathcha];state.activeSide='Light';state.botTurn=null;
  const reveal=()=>requestAction('pileInterrupt','Light',[0,'radar']);`);
 assert.equal(run("reveal()"),false);
 run("state.light[6]=[ship];");
 assert.equal(run("reveal()&&state.pendingCardView.publicView&&!requestAction('finishCardInformation','Light',['move',2])"),true);
 assert.equal(run("requestAction('finishCardInformation','Light',['move',1])&&requestAction('finishCardInformation','Light',['move',0])"),true);
 assert.equal(run("state.botUsed.at(-1)===jawa&&state.botUsed.at(-2)===tusken&&state.botHand[0]===dathcha&&state.used.at(-1)===radar"),true);
});

test('Trinto Duaba loses only cards matching the drawn destiny in their owner’s order',async()=>{
 const {run}=await craftHarness();
 run(`const trinto=card('Dark:2632'),lower={name:'Lower',destiny:1},first={name:'First loss',destiny:2},second={name:'Second loss',destiny:2};
  setupDecks=null;state.game=PremiereGame.actionState(150,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};
  state.botHand=[trinto];state.hand=[];state.used=[first,lower,second];state.botDeck=[{name:'Match',destiny:2}];`);
 assert.equal(run("requestAction('pileInterrupt','Dark',[0,'trinto'])"),false);
 run("state.phase=3;");
 assert.equal(run("requestAction('pileInterrupt','Dark',[0,'trinto'])&&state.pendingCardView.side==='Light'"),true);
 assert.equal(run("requestAction('finishCardInformation','Light',['order',1])&&requestAction('finishCardInformation','Light',['order',0])"),true);
 assert.equal(run("state.used[0]===lower&&state.lost[0]===second&&state.lost[1]===first&&state.botUsed.at(-1)===trinto"),true);
});

test('Tusken Scavengers checks the Tusken count before searching and handles optional searches',async()=>{
 const {run,elements}=await craftHarness();
 run(`const scavengers=card('Dark:2650'),kept=card('Light:2052'),device=card('Light:821');
  setupDecks=null;state.game=PremiereGame.actionState(151,0);state.activeSide='Dark';
  state.botTurn={steps:[],index:0};state.dark[3]=[tusken,card('Dark:2648')];state.used=[kept,device];
  state.hand=[];state.botHand=[scavengers,card('Dark:2650')];state.botDeck=[{name:'Low',destiny:1},{name:'Tie',destiny:2}];`);
 assert.equal(run("const scavenge=()=>requestAction('pileInterrupt','Dark',[0,'scavengers']);scavenge()&&!state.pendingCardView&&state.used.length===2"),true);
 assert.equal(run("scavenge()&&state.pendingCardView.mode==='scavenge'"),true);
 assert.equal(run("requestAction('finishCardInformation','Dark',['search'])&&state.pendingCardView.shown.includes(kept)"),true);
 assert.doesNotMatch(elements.get('controlPanel').innerHTML,/Rebel Trooper|Electrobinoculars/);
 assert.equal(run("requestAction('finishCardInformation','Dark',['done'])&&state.used.length===1&&state.used[0]===kept&&state.lost.includes(device)"),true);
});

test('Look Sir, Droids can search the Used Pile or destroy a droid using its deploy cost',async()=>{
 const {run}=await craftHarness();
 run(`const look=card('Dark:1579'),second=card('Dark:1579'),usedDroid=card('Light:1995'),onTable=card('Light:2'),rebel=card('Light:2052');
  setupDecks=null;state.game=PremiereGame.actionState(152,0);
  state.botHand=[look,second];state.hand=[];state.light[3]=[onTable,rebel];state.used=[usedDroid];`);
 assert.equal(run("requestAction('pileInterrupt','Dark',[0,'findDroids'])&&requestAction('finishCardInformation','Dark',['done'])"),true);
 assert.equal(run("state.botLost.includes(look)&&state.lost.includes(usedDroid)&&state.botForce.length===4"),true);
 assert.equal(run(`const options=legalActions(state,'Dark').filter(action=>action.kind==='pileInterrupt');
  options.length===1&&options[0].entry.card===onTable&&options[0].cost===onTable.deploy&&performAction(options[0])`),true);
 assert.equal(run("state.lost.includes(onTable)&&state.light[3].includes(rebel)&&state.botLost.includes(second)"),true);
});

test('Cantina Brawl matches both destiny draws and includes inactive characters',async()=>{
 const {run}=await craftHarness();
 run(`const brawl=card('Light:352'),a=card('Light:2052'),b=card('Dark:1279'),safe=card('Dark:634'),droid=card('Light:2');
  setupDecks=null;state.game=PremiereGame.actionState(153,0);state.hand=[brawl];state.botHand=[];
  a.missing=true;state.light[4]=[a,droid];state.dark[4]=[b,safe];
  state.deck=[{name:'One',destiny:1}];state.botDeck=[{name:'Two',destiny:2}];`);
 assert.equal(run("!requestAction('pileInterrupt','Light',[0,'cantinaBrawl',3])&&requestAction('pileInterrupt','Light',[0,'cantinaBrawl',4])"),true);
 assert.equal(run("state.lost.includes(a)&&state.botLost.includes(b)&&state.dark[4].includes(safe)&&state.light[4].includes(droid)&&state.force.length===3"),true);
});

test('Collision lets the opponent select a ship to lose at the named system',async()=>{
 const {run}=await craftHarness();
 run(`const collision=card('Light:468'),first=card('Dark:2600'),second=card('Dark:2600');
  setupDecks=null;state.game=PremiereGame.actionState(154,0);state.hand=[collision];state.botHand=[];
  state.dark[6]=[first];state.deck=[{name:'Low',destiny:1}];`);
 assert.equal(run("requestAction('pileInterrupt','Light',[0,'collision',6])"),false);
 run("state.dark[6].push(second);");
 assert.equal(run("requestAction('pileInterrupt','Light',[0,'collision',6])&&state.pendingCardView.side==='Dark'"),true);
 assert.equal(run("requestAction('finishCardInformation','Dark',['lose',1])&&state.botLost.includes(second)&&state.dark[6][0]===first&&state.lost.includes(collision)"),true);
});

test('Dead Jawa counts the chosen Jawas and leaves unchosen targets alone',async()=>{
 const {run}=await craftHarness();
 run(`const interrupt=card('Dark:649'),first=card('Light:1373'),second=card('Light:1373');
  setupDecks=null;state.game=PremiereGame.actionState(155,0);state.botHand=[interrupt];state.hand=[];
  state.dark[3]=[card('Dark:2355'),card('Dark:2355')];state.light[3]=[first,second];state.botDeck=[{name:'Two',destiny:2}];`);
 assert.equal(run("requestAction('pileInterrupt','Dark',[0,'deadJawa',3])&&!requestAction('finishCardInformation','Dark',['confirm'])"),true);
 assert.equal(run("requestAction('finishCardInformation','Dark',['toggle',1])&&requestAction('finishCardInformation','Dark',['confirm'])"),true);
 assert.equal(run("state.lost.includes(second)&&state.light[3][0]===first&&state.botLost.includes(interrupt)"),true);
});

test('both battle accidents let the defending side choose a loss before weapon actions',async()=>{
 for(const side of ['Light','Dark']){
  const {run}=await craftHarness();
  run(`const side='${side}',opponent=PremiereGame.otherSide(side);
   const own=PremiereGame.zones(state,side),rival=PremiereGame.zones(state,opponent);
   const accident=card(side==='Light'?'Light:985':'Dark:467'),fighter=card(side==='Light'?'Light:2052':'Dark:2355');
   const first=card(side==='Light'?'Dark:2355':'Light:2052'),second=card(side==='Light'?'Dark:2355':'Light:2052');
   setupDecks=null;state.game=PremiereGame.actionState(156,0);state.phase=3;state.activeSide=opponent;
   state.botTurn=opponent==='Dark'?{steps:[],index:0}:null;
   own.hand.splice(0,own.hand.length,accident);rival.hand.length=0;
   own.board[3]=[fighter];rival.board[3]=[first,second];own.deck.splice(0,own.deck.length,{name:'Low',destiny:1});
   first.weapons=[card(side==='Light'?'Dark:1264':'Light:259')];`);
  assert.equal(run("requestAction('battle',opponent,[3])&&requestAction('interruptResponse',side,[0,'accident'])"),true);
  assert.equal(run("requestAction('passResponse',opponent)&&requestAction('passResponse',side)&&state.pendingCardView.side===opponent"),true);
  assert.equal(run("requestAction('finishCardInformation',opponent,['lose',1])&&rival.lost.includes(second)&&rival.board[3][0]===first&&own.lost.includes(accident)"),true);
 }
});

test('both Maneuvers cards affect movement and weapon defense until the current turn ends',async()=>{
 const {run}=await craftHarness();
 run(`const light=card('Light:24'),dark=card('Dark:622');
  setupDecks=null;state.game=PremiereGame.actionState(157,0);
  state.light[6]=[ship];state.dark[6]=[tie];state.hand=[light];state.botHand=[dark];`);
 assert.equal(run("const lightMoves=legalActions(state,'Light').filter(action=>action.kind==='pileInterrupt');lightMoves.length===1&&lightMoves[0].entry.card===ship&&performAction(lightMoves[0])"),true);
 assert.equal(run("craftStats(ship,6).maneuver===ship.maneuver+2&&craftStats(ship,6).hyperspeed===ship.hyperspeed+2"),true);
 assert.equal(run("performAction(legalActions(state,'Dark').find(action=>action.kind==='pileInterrupt'&&action.entry.card===tie))"),true);
 assert.equal(run("craftStats(tie,6).maneuver===tie.maneuver+2&&craftStats(tie,6).power===tie.power+1&&craftStats(tie,6).hyperspeed===null"),true);
 run("PremiereGame.resetTurn(state,'Dark');");
 assert.equal(run("craftStats(ship,6).maneuver===ship.maneuver&&craftStats(tie,6).power===tie.power"),true);
});

test('Hear Me Baby applies to each draw and a Maneuvers card can raise defense after destiny',async()=>{
 const {run}=await craftHarness();
 run(`const defense=card('Light:1120'),dodge=card('Light:24'),destroyer=card('Dark:1291'),weapon=card('Dark:1327');
  setupDecks=null;state.game=PremiereGame.actionState(158,0);state.activeSide='Dark';state.phase=3;state.botTurn={steps:[],index:0};
  state.hand=[defense,dodge];state.botHand=[];state.light[6]=[ship];state.dark[6]=[destroyer];
  destroyer.weapons=[weapon];state.botDeck=[{name:'Second',destiny:4},{name:'First',destiny:4}];`);
 assert.equal(run("requestAction('battle','Dark',[6])&&performAction(legalActions(state,'Dark').find(action=>action.kind==='fireWeapon'))"),true);
 assert.equal(run("PremiereGame.responseWindow(state.game).kind==='weaponTarget'&&requestAction('interruptResponse','Light',[0,'shipTiming'])"),true);
 assert.equal(run("requestAction('passResponse','Dark')&&requestAction('passResponse','Light')&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
 assert.equal(run("PremiereGame.responseWindow(state.game).kind==='weaponDefense'&&requestAction('interruptResponse','Light',[0,'shipTiming'])"),true);
 assert.equal(run("requestAction('passResponse','Dark')&&requestAction('passResponse','Light')&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
 assert.equal(run("state.used.includes(defense)&&state.used.includes(dodge)&&battleSession.weaponDestinyPenalty.get(weapon)===-2&&!ship.ionDamage"),true);
});

test('Targeting Computer doubles fire and asks for the second target after the first shot',async()=>{
 const {run}=await craftHarness();
 run(`const computer=card('Light:2423'),torpedoes=card('Light:1962'),other=card('Dark:2600');
  setupDecks=null;state.game=PremiereGame.actionState(159,0);state.hand=[computer];state.botHand=[];
  state.light[6]=[ship];state.dark[6]=[tie,other];ship.weapons=[torpedoes];state.deck=[{name:'Second',destiny:6},{name:'First',destiny:6}];`);
 assert.equal(run("requestAction('deployDevice','Light',[0,6,0])&&craftStats(ship,6).maneuver===ship.maneuver+1"),true);
 run("state.phase=3;");
 assert.equal(run("requestAction('battle','Light',[6])&&legalActions(state,'Light').some(action=>action.kind==='computerFire'&&action.mode==='combined')"),true);
 assert.equal(run("performAction(legalActions(state,'Light').find(action=>action.kind==='computerFire'&&action.mode==='separate'))&&state.pendingCardView.mode==='computerAim'"),true);
 assert.equal(run("requestAction('finishCardInformation','Light',['shoot',1])&&battleSession.hitUnits.Dark.includes(other)&&state.deck.length===0"),true);
});

test('Special Modifications follows the selected stat and Falcon crew',async()=>{
 const {run}=await craftHarness();
 run(`const mod=card('Light:2325'),falcon=card('Light:1677'),han=card('Light:1098');
  setupDecks=null;state.game=PremiereGame.actionState(160,0);state.hand=[mod];state.botHand=[];
  state.light[6]=[falcon];PremiereUnits.add(falcon,han,'pilot','Light');`);
 assert.equal(run("const base=craftStats(falcon,6);const effect=legalActions(state,'Light').find(action=>action.kind==='deployTableEffect');effect.hullStat==='maneuver'&&performAction(effect)"),true);
 assert.equal(run("craftStats(falcon,6).maneuver===base.maneuver+2&&craftStats(falcon,6).power===base.power+2"),true);
 run("battleSession={site:6};");
 assert.equal(run("battleForfeitValue(falcon,'Light')===falcon.forfeit+2"),true);
 assert.equal(run("falcon.occupants.length=0;!falconModificationBonus(falcon)"),true);
});

test('Obi-Wan and the Cape can make an ability-one character move for free',async()=>{
 for(const isCape of [false,true]){
  const {run}=await craftHarness();
  run(`const host=card('${isCape?'Light:1593':'Light:1803'}'),cape=card('Light:1810'),enemy=card('Dark:2355'),other=card('Dark:1279');
   setupDecks=null;state.game=PremiereGame.actionState(161,0);state.hand=${isCape?'[cape]':'[]'};
   state.botHand=[];state.light[3]=[host];state.dark[3]=[enemy,other];state.locationOrder=[2,3,4,6,0,1,5];`);
  if(isCape)assert.equal(run("requestAction('deployTableEffect','Light',[0,0])&&host.attachments[0]===cape"),true);
  run("state.activeSide='Dark';state.phase=3;state.botTurn={steps:[],index:0};state.botForce=[];state.botForce.push({name:'Battle Force'});");
  assert.equal(run("requestAction('battle','Dark',[3])&&performAction(legalActions(state,'Light').find(action=>action.kind==='interruptResponse'&&action.args[1]==='retreatAbility'))"),true);
  assert.equal(run("requestAction('passResponse','Dark')&&requestAction('passResponse','Light')&&requestAction('finishCardInformation','Dark',[0,2])"),true);
  assert.equal(run("state.dark[2].includes(enemy)&&state.dark[3].includes(other)&&!state.botForce.length"),true);
 }
});

test('Move Along selects targets equal to destiny before the opponent retreats',async()=>{
 const {run}=await craftHarness();
 run(`const interrupt=card('Light:1707'),obi=card('Light:1803'),first=card('Dark:2355'),second=card('Dark:2355');
  setupDecks=null;state.game=PremiereGame.actionState(162,0);state.hand=[interrupt];state.botHand=[];
  state.light[3]=[obi];state.dark[3]=[first,second];state.locationOrder=[2,3,4,6,0,1,5];
  state.activeSide='Dark';state.phase=3;state.botTurn={steps:[],index:0};state.deck=[{name:'One',destiny:1}];`);
 assert.equal(run("requestAction('battle','Dark',[3])&&requestAction('interruptResponse','Light',[0,'retreatInterrupt'])"),true);
 assert.equal(run("requestAction('passResponse','Dark')&&requestAction('passResponse','Light')&&state.pendingCardView.mode==='retreatTargets'"),true);
 assert.equal(run("requestAction('finishCardInformation','Light',['choose',1])&&requestAction('finishCardInformation','Dark',[0,2])"),true);
 assert.equal(run("state.dark[3][0]===first&&state.dark[2].includes(second)&&state.used.includes(interrupt)"),true);
});

test('Narrow Escape pays regular Landspeed costs and Hyper Escape leaves out-of-range ships behind',async()=>{
 const land=await craftHarness(),space=await craftHarness();
 land.run(`const escape=card('Light:1755'),luke=card('Light:1593');
  setupDecks=null;state.game=PremiereGame.actionState(163,0);state.activeSide='Dark';state.phase=3;state.botTurn={steps:[],index:0};
  state.hand=[escape];state.botHand=[];state.light[3]=[luke];state.dark[3]=[card('Dark:2355')];state.locationOrder=[2,3,4,6,0,1,5];`);
 assert.equal(land.run("requestAction('battle','Dark',[3])&&requestAction('interruptResponse','Light',[0,'retreatInterrupt'])&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
 assert.equal(land.run("requestAction('finishCardInformation','Light',[0,2])&&state.force.length===4&&state.light[2].includes(luke)&&state.used.includes(escape)"),true);
 space.run(`const escape=card('Light:1197'),stalled=card('Light:2838');stalled.hyperspeed=0;
  setupDecks=null;state.game=PremiereGame.actionState(164,0);state.activeSide='Dark';state.phase=3;state.botTurn={steps:[],index:0};
  state.hand=[escape];state.botHand=[];state.light[1]=[ship,stalled];state.dark[1]=[tie];state.locations[0].parsec=5;`);
 assert.equal(space.run("requestAction('battle','Dark',[1])&&requestAction('interruptResponse','Light',[0,'retreatInterrupt'])&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
 assert.equal(space.run("requestAction('finishCardInformation','Light',[0,0])&&requestAction('finishCardInformation','Light',[0,null])"),true);
 assert.equal(space.run("state.light[0].includes(ship)&&state.light[1].includes(stalled)&&state.force.length===4&&state.used.includes(escape)"),true);
});

test('both Barriers restrict only the card just deployed and expire with its turn',async()=>{
 for(const side of ['Light','Dark']){
  const {run}=await craftHarness();
  run(`const side='${side}',other=PremiereGame.otherSide(side);
   const barrier=card(side==='Light'?'Light:2033':'Dark:1263'),deploy=card(side==='Light'?'Dark:2355':'Light:2052');
   const already=card(deploy.id),own=PremiereGame.zones(state,side),rival=PremiereGame.zones(state,other);
   setupDecks=null;state.game=PremiereGame.actionState(165,0);state.activeSide=other;
   state.botTurn=other==='Dark'?{steps:[],index:0}:null;
   own.hand.splice(0,own.hand.length,barrier);rival.hand.splice(0,rival.hand.length,deploy);rival.board[3]=[already];`);
  assert.equal(run("requestAction('deploy',other,[0,3])&&requestAction('interruptResponse',side,[0,'barrier',0])"),true);
  assert.equal(run("requestAction('passResponse',other)&&requestAction('passResponse',side)&&requestAction('passResponse',other)&&requestAction('passResponse',side)"),true);
  assert.equal(run("own.force.length===4&&own.used.includes(barrier)&&!battleCandidates(other,3).includes(deploy)&&battleCandidates(other,3).includes(already)"),true);
  assert.equal(run("movementPrevented(deploy)&&!movementPrevented(already)"),true);
  run("PremiereGame.resetTurn(state,side);");
  assert.equal(run("!movementPrevented(deploy)&&battleCandidates(other,3).includes(deploy)"),true);
 }
});

test('Barrier on either card of a simultaneous deployment stops both the ship and pilot',async()=>{
 for(const [side,shipId,pilotId,barrierId,target] of [
  ['Light','Light:2060','Light:239','Dark:1263',0],
  ['Dark','Dark:247','Dark:790','Light:2033',1],
 ]){
  const {run}=await craftHarness();
  run(`const side='${side}',other=PremiereGame.otherSide(side),fighter=card('${shipId}'),pilot=card('${pilotId}'),barrier=card('${barrierId}');
   const own=PremiereGame.zones(state,side),rival=PremiereGame.zones(state,other);
   setupDecks=null;state.game=PremiereGame.actionState(270,0);state.game.cardRulesVersion=25;
   state.activeSide=side;state.botTurn=side==='Dark'?{steps:[],index:0}:null;
   own.hand.splice(0,own.hand.length,fighter,pilot);rival.hand.splice(0,rival.hand.length,barrier);
   state.locations[0].icons={light:2,dark:2};rival.board[0]=[side==='Light'?tie:ship];`);
  assert.equal(run(`requestAction('deployWithPilot',side,[0,0,1])&&requestAction('interruptResponse',other,[0,'barrier',${target}])`),true);
  assert.equal(run("requestAction('passResponse',side)&&requestAction('passResponse',other)&&requestAction('passResponse',side)&&requestAction('passResponse',other)"),true);
  assert.equal(run("rival.used.includes(barrier)&&rival.force.length===4&&barredThisTurn(fighter)&&barredThisTurn(pilot)&&confirmedPresence(side,0)"),true);
  run('state.phase=3');
  assert.equal(run("!requestAction('battle',side,[0])&&battleCandidates(side,0).length===0"),true);
  run('PremiereGame.resetTurn(state,side);state.phase=3');
  assert.equal(run("!movementPrevented(fighter)&&!movementPrevented(pilot)&&legalActions(state,side).some(option=>option.kind==='battle')"),true);
 }
});

test('a pilot stopped by Barrier contributes neither ship stats nor battle destiny bonuses',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(271,0);state.game.cardRulesVersion=25;
  const fighter=card('Light:2060'),biggs=card('Light:239'),barrier=card('Dark:1263');
  state.light[0]=[ship,fighter];state.dark[0]=[tie];state.hand=[biggs];state.botHand=[barrier];`);
 assert.equal(run(`const aboard=legalActions(state,'Light').find(option=>option.kind==='transport'&&option.args[0]==='deployAboard'&&option.carrier===fighter&&option.args[5]==='pilot');
  !!aboard&&performAction(aboard)&&requestAction('interruptResponse','Dark',[0,'barrier',0])`),true);
 assert.equal(run("requestAction('passResponse','Light')&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')&&requestAction('passResponse','Dark')"),true);
 assert.equal(run("barredThisTurn(biggs)&&!barredThisTurn(fighter)&&craftStats(fighter,0).powered"),true);
 run('state.phase=3');
 assert.equal(run("requestAction('battle','Light',[0])&&activeBattleUnits('Light').includes(fighter)&&!activeBattleUnits('Light').includes(biggs)"),true);
 assert.equal(run("!craftStats(fighter,0).powered&&craftStats(fighter,0).maneuver===0&&battleAbilityAt(fighter,0)===0&&battleTotals(0).lightPower===craftStats(ship,0).power"),true);
 assert.equal(run("battleDestinyDrawCount('Light',0,battleTotals(0).lightAbility)<1"),true);
});

test('C-3PO cannot pair its battle power bonus with a Rebel excluded by Imperial Barrier',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(272,0);state.game.cardRulesVersion=25;
  const threepio=card('Light:343'),blocked=card('Light:2052'),rebel=card('Light:1593'),r2=card('Light:1995');
  state.light[3]=[threepio,rebel];state.dark[3]=[card('Dark:2355')];state.hand=[blocked];state.botHand=[card('Dark:1263')];`);
 assert.equal(run("requestAction('deploy','Light',[0,3])&&requestAction('interruptResponse','Dark',[0,'barrier',0])"),true);
 assert.equal(run("requestAction('passResponse','Light')&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')&&requestAction('passResponse','Dark')"),true);
 // A second active droid would form a second pair if the excluded Rebel still counted.
 run('state.light[3].push(r2);state.phase=3');
 assert.equal(run("requestAction('battle','Light',[3])&&battleTotals(3).lightPower===rebel.power+threepio.power+r2.power+2"),true);
});

test('Dark Collaboration counters Rebel Barrier or adds two Battle Destiny',async()=>{
 const {run}=await craftHarness();
 run(`const collaboration=card('Dark:613'),barrier=card('Light:2033'),unit=card('Dark:2355');
  const tarkin=card('Dark:1061'),motti=card('Dark:60');
  setupDecks=null;state.game=PremiereGame.actionState(166,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};
  state.botHand=[unit,collaboration];state.hand=[barrier];state.light[3]=[card('Light:2052')];`);
 assert.equal(run("requestAction('deploy','Dark',[0,3])&&requestAction('interruptResponse','Light',[0,'barrier',0])&&requestAction('interruptResponse','Dark',[0,'named'])"),true);
 assert.equal(run("requestAction('passResponse','Light')&&requestAction('passResponse','Dark')"),true);
 assert.equal(run("state.botLost.includes(collaboration)&&state.lost.includes(barrier)&&!barredThisTurn(unit)"),true);
 run("requestAction('passResponse','Dark');requestAction('passResponse','Light');state.phase=3;state.dark[3].push(tarkin,motti);state.botHand=[card('Dark:613')];");
 assert.equal(run("requestAction('battle','Dark',[3])&&requestAction('battleEffect','Dark',[0])&&battleSession.extraDraws.Dark===2"),true);
});

test('Dodonna modifies Rebel Planners and cancels Wrong Turn',async()=>{
 const {run}=await craftHarness();
 run(`const planner=card('Light:2041'),dodonna=card('Light:1021'),wrongTurn=card('Dark:2833');
  setupDecks=null;state.game=PremiereGame.actionState(167,0);state.hand=[planner];state.botHand=[];
  state.locations[4]=card('Light:2859');state.locations[6]=card('Light:2849');state.light[6]=[ship,card('Light:2838')];`);
 assert.equal(run("!requestAction('deployLocationEffect','Light',[0,3])&&requestAction('deployLocationEffect','Light',[0,4])"),true);
 assert.equal(run("rebelPlannerPower('Light',6)"),2);
 run("state.light[3]=[dodonna];");
 assert.equal(run("rebelPlannerPower('Light',6)"),3);
 run("state.light[3]=[];state.light[4]=[dodonna];");
 assert.equal(run("rebelPlannerPower('Light',6)"),4);
 run("state.activeSide='Dark';state.botTurn={steps:[],index:0};state.botHand=[wrongTurn];");
 assert.equal(run("requestAction('deployTableEffect','Dark',[0])&&requestAction('interruptResponse','Light',[-1,'dodonna'])"),true);
 assert.equal(run("requestAction('passResponse','Dark')&&requestAction('passResponse','Light')&&state.botLost.includes(wrongTurn)&&!state.tableEffects?.length"),true);
});

test('Expand The Empire copies one side and follows Revolution',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(168,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};state.locations[4]=card('Light:2462');state.locationOrder=[2,3,4,6,0,1,5];state.botHand=[card('Dark:914')];state.hand=[card('Light:2110')]");
 assert.equal(run("requestAction('deployLocationEffect','Dark',[0,4])&&PremiereLocations.ruleAt(state,3,'Dark','weaponDestiny')?.amount===1"),true);
 assert.equal(run("!PremiereLocations.ruleAt(state,2,'Dark','weaponDestiny')&&!PremiereLocations.ruleAt(state,6,'Dark','weaponDestiny')"),true);
 run("state.activeSide='Light';const icons=PremiereLocations.icons(state,3,'Light');");
 assert.equal(run("requestAction('revolution','Light',[0,4])&&PremiereLocations.ruleAt(state,3,'Light','weaponDestiny')?.amount===1&&!PremiereLocations.ruleAt(state,3,'Dark','weaponDestiny')&&PremiereLocations.icons(state,3,'Light')===icons"),true);
 run("cancelLocationEffect(4,state.locationEffects[4].find(effect=>effect.card.id==='Light:2110'));");
 assert.equal(run("PremiereLocations.ruleAt(state,3,'Dark','weaponDestiny')?.amount"),1);
});

test('an expanded War Room changes on-table forfeits but leaves Savrip hand forfeits intact',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(273,0);state.game.cardRulesVersion=25;
  const expand=card('Dark:914'),leader=card('Dark:1061'),trooper=card('Light:2052'),inHand=card('Light:2052'),wing=card('Light:1050');
  state.locations[4]=card('Dark:682');state.locations[5]=card('Dark:678');state.locationOrder=[2,3,4,5,6,0,1];
  state.activeSide='Dark';state.botTurn={steps:[],index:0};state.botHand=[expand];state.dark[5]=[leader];
  state.light[3]=[trooper];state.light[0]=[wing];state.hand=[inHand];`);
 assert.equal(run("cardForfeitValueAt(trooper,'Light',3)===trooper.forfeit&&requestAction('deployLocationEffect','Dark',[0,4])"),true);
 assert.equal(run("cardForfeitValueAt(trooper,'Light',3)===trooper.forfeit-1&&cardForfeitValueAt(wing,'Light',0)===wing.forfeit-1"),true);
 run(`state.activeSide='Light';state.botTurn=null;state.phase=3;state.botHand=[];state.dark[3]=[card('Dark:634')];
  state.tableEffects=[{card:card('Light:1643'),target:'Light'}];`);
 assert.equal(run("requestAction('battle','Light',[3])&&requestAction('skipDestiny','Light')&&requestAction('skipDestiny','Dark')"),true);
 assert.equal(run(`const forfeits=legalActions(state,'Light');
  forfeits.find(option=>option.kind==='battleForfeit')?.value===trooper.forfeit-1&&
  forfeits.find(option=>option.kind==='battleHandForfeit')?.value===inHand.forfeit&&requestAction('battleHandForfeit','Light',[0])&&state.lost.includes(inHand)`),true);
});

test('Expand The Empire adds a second printed drain bonus without copying Force icons',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(274,0);state.game.cardRulesVersion=25;
  state.activeSide='Dark';state.botTurn={steps:[],index:0};state.botHand=[card('Dark:914')];state.hand=[];
  state.locations[3]=card('Dark:2458');state.locations[4]=card('Light:2471');state.locationOrder=[2,3,4,5,6,0,1];
  state.dark[4]=[card('Dark:2355')];const icons=PremiereLocations.icons(state,4,'Light');`);
 assert.equal(run("requestAction('deployLocationEffect','Dark',[0,3])"),true);
 run('state.phase=1');
 assert.equal(run("forceDrainValue('Dark',4)"),run('icons+2'));
 assert.equal(run("requestAction('drain','Dark',[4])"),true);
 assert.equal(run('state.pendingForceLoss?.remaining'),run('icons+2'));
});

test('both Sentry cards apply the selected modifier',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(169,0);state.locations[2]=card('Light:2853');state.locations[3]=card('Light:2855');state.locations[4]=card('Dark:669');state.locations[5]=card('Dark:673');state.locationOrder=[2,3,4,5,6,0,1];state.hand=[card('Light:2860')];state.botHand=[card('Dark:665')];const base=minimumBattleDestinyAbility('Light',5);");
 assert.equal(run("!requestAction('deployLocationEffect','Light',[0,4,'deploy'])&&requestAction('deployLocationEffect','Light',[0,3,'deploy'])&&state.force.length===3"),true);
 assert.equal(run("sentryModifier('Dark',2,'deploy')===1&&sentryModifier('Dark',3,'deploy')===1&&sentryModifier('Dark',4,'deploy')===0&&sentryModifier('Light',2,'deploy')===0"),true);
 run("state.activeSide='Dark';state.botTurn={steps:[],index:0};");
 assert.equal(run("requestAction('deployLocationEffect','Dark',[0,4,'destiny'])&&minimumBattleDestinyAbility('Light',5)===base+1&&sentryModifier('Dark',5,'destiny')===0"),true);
 run("state.locationEffects[4][0].sentryMode='power';");
 assert.equal(run("sentryModifier('Dark',5,'power')===1&&minimumBattleDestinyAbility('Light',5)===base"),true);
});

test('Fear Will Keep Them In Line needs control at the ship’s location',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(170,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};const destroyer=card('Dark:1291'),effect=card('Dark:932');state.dark[6]=[destroyer];state.botHand=[effect];");
 assert.equal(run("performAction(legalActions(state,'Dark').find(action=>action.kind==='deployTableEffect'&&action.host===destroyer))&&destroyer.attachments.includes(effect)"),true);
 assert.equal(run("fearPowerAtSite('Dark',3)===1&&fearPowerAtSite('Light',3)===0&&fearPowerAtSite('Dark',1)===0"),true);
 run("state.light[6]=[ship];");
 assert.equal(run("fearPowerAtSite('Dark',3)"),0);
});

test('Boring Conversation Anyway cancels only named cards',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(171,0);state.locations[4]=card('Light:2859');const planner=card('Light:2041'),counter=card('Dark:304');state.hand=[planner];state.botHand=[counter]");
 assert.equal(run("requestAction('deployLocationEffect','Light',[0,4])&&requestAction('interruptResponse','Dark',[0,'named'])"),true);
 assert.equal(run("requestAction('passResponse','Light')&&requestAction('passResponse','Dark')&&state.lost.includes(planner)&&state.botUsed.includes(counter)"),true);
 run("state.botHand=[card('Dark:304')];const deployed=card('Light:2041');state.locationEffects={4:[{card:deployed},{card:card('Light:2110')}]};");
 assert.equal(run("const options=legalActions(state,'Dark').filter(action=>action.kind==='alterLocationEffect');options.length===1&&options[0].args[2]===0&&performAction(options[0])"),true);
 assert.equal(run("requestAction('passResponse','Light')&&requestAction('passResponse','Dark')&&state.lost.includes(deployed)&&state.locationEffects[4][0].card.id==='Light:2110'"),true);
 run("state.botHand=[card('Dark:304')];PremiereGame.openResponse(state.game,{kind:'interrupt',side:'Light',card:card('Light:2180'),interrupt:'pileInterrupt'});");
 assert.equal(run("legalActions(state,'Dark').some(action=>action.kind==='interruptResponse'&&action.args[1]==='named')"),true);
});

test('counter destiny needs a real highest-ability character and gives a choice between tied characters',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(172,0);state.hand=[card('Light:2217')];state.light[6]=[ship];PremiereGame.openResponse(state.game,{kind:'interrupt',side:'Dark',card:card('Dark:2176'),interrupt:'pileInterrupt'});");
 assert.equal(run("!legalActions(state,'Light').some(action=>action.kind==='interruptResponse')"),true);
 run("const first=card('Light:1593'),second={...first,name:'Another Rebel'};state.light[3]=[first,second,card('Light:343')];state.deck=[{name:'Equal destiny',destiny:cardAbility(first)}];");
 assert.equal(run("const responses=legalActions(state,'Light').filter(action=>action.kind==='interruptResponse');responses.length===2&&responses[0].counterCharacter===first&&responses[1].counterCharacter===second&&performAction(responses[1])"),true);
 assert.equal(run("requestAction('passResponse','Dark')&&requestAction('passResponse','Light')&&PremiereGame.responseWindow(state.game)?.card.id==='Dark:2176'"),true);
});

test('Droid Shutdown protects a directly targeted droid for the turn',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(173,0);const threepio=card('Light:343'),shutdown=card('Light:781');state.light[3]=[threepio];state.hand=[shutdown];state.botHand=[card('Dark:1579')];");
 assert.equal(run("performAction(legalActions(state,'Dark').find(action=>action.args[1]==='destroyDroid'))&&requestAction('interruptResponse','Light',[0,'droidShutdown'])"),true);
 assert.equal(run("requestAction('passResponse','Dark')&&requestAction('passResponse','Light')&&droidProtectedFrom(threepio,'Dark')&&state.used.includes(shutdown)&&state.light[3].includes(threepio)"),true);
 run("state.botHand=[card('Dark:1579')];");
 assert.equal(run("!legalActions(state,'Dark').some(action=>action.args[1]==='destroyDroid')"),true);
 run("PremiereGame.resetTurn(state,'Dark');state.botForce.push({name:'Activated Force'});");
 assert.equal(run("legalActions(state,'Dark').some(action=>action.args[1]==='destroyDroid')"),true);
});

test('C-3PO counts distinct pairs and adds forfeit to R2-D2',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(174,0);const threepio=card('Light:343'),artoo={...card('Light:1995'),name:'R2-D2 (Artoo-Detoo)'},luke=card('Light:1593');state.light[3]=[threepio,artoo,luke];");
 assert.equal(run("droidRebelPower(3,state.light[3])"),2);
 run("state.light[3].push(card('Light:2052'),card('Light:239'));battleSession={site:3};");
 assert.equal(run("droidRebelPower(3,state.light[3])===4&&battleForfeitValue(artoo,'Light')===artoo.forfeit+2"),true);
});

test('Praji suppresses the droid text only while present',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(175,0);const praji=card('Dark:502'),threepio=card('Light:343'),devastator=card('Dark:723');state.dark[3]=[praji];state.light[3]=[threepio,card('Light:1593')];");
 assert.equal(run("prajiSuppresses(threepio)&&droidRebelPower(3,state.light[3])===0"),true);
 run("state.dark[3]=[];state.dark[6]=[devastator];PremiereUnits.add(devastator,praji,'pilot','Dark');");
 assert.equal(run("!prajiSuppresses(threepio)&&droidRebelPower(3,state.light[3])===2&&craftStats(devastator,6).hyperspeed===devastator.hyperspeed+1"),true);
});

test('battle damage multipliers leave attrition unchanged',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(176,0);state.phase=3;state.light[3]=[card('Light:1803')];state.dark[3]=[card('Dark:2355')];state.hand=[card('Light:761')];state.botHand=[card('Dark:2884')];");
 assert.equal(run("requestAction('battle','Light',[3])&&requestAction('interruptResponse','Dark',[0,'battleDamage'])&&requestAction('interruptResponse','Light',[0,'battleDamage'])"),true);
 assert.equal(run("for(let i=0;i<6;i++)requestAction('passResponse',PremiereGame.responseWindow(state.game).priority);!PremiereGame.responseWindow(state.game)"),true);
 run("battleSession.lightDestiny=1;battleSession.darkDestiny=0;const base=battleTotals(3,'Light');");
 assert.equal(run("const result=battleDamagePreview();result.darkDamage===9*(base.lightPower+1-base.darkPower)&&result.darkAttrition===1&&state.lost.some(card=>card.id==='Light:761')&&state.botLost.some(card=>card.id==='Dark:2884')"),true);
});

test('Bad Feeling modifies damage only when the underdog wins',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(177,0);state.phase=3;const han=card('Light:1098');state.light[3]=[han];state.dark[3]=[card('Dark:634')];state.hand=[card('Light:1236')];state.botHand=[];");
 assert.equal(run("requestAction('battle','Light',[3])&&requestAction('passResponse','Dark')&&requestAction('interruptResponse','Light',[0,'battleDamage'])&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
 run("battleSession.lightDestiny=0;battleSession.darkDestiny=0;const losing=battleDamagePreview();");
 assert.equal(run("losing.lightDamage===losing.darkTotal-losing.lightTotal"),true);
 run("battleSession.lightDestiny=9;const winning=battleDamagePreview();");
 assert.equal(run("winning.darkDamage===3*(winning.lightTotal-winning.darkTotal)&&state.used.some(card=>card.id==='Light:1236')"),true);
});

test('It Could Be Worse spends Force and It’s Worse modifies the original loss',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(178,0);state.hand=[card('Light:1331')];state.botHand=[];beginForceLoss('Light',2,{reason:'drain'});");
 assert.equal(run("requestAction('reduceForceLoss','Light',[0,1])&&state.pendingForceLoss.remaining===1&&state.force.length===4&&state.used.some(card=>card.id==='Light:1331')"),true);
 run("state.hand=[card('Light:1331')];state.botHand=[card('Dark:1338')];beginForceLoss('Light',2,{reason:'drain'});");
 assert.equal(run("requestAction('reduceForceLoss','Light',[0,2])&&requestAction('interruptResponse','Dark',[0,'increaseLoss',3])"),true);
 assert.equal(run("requestAction('passResponse','Light')&&requestAction('passResponse','Dark')&&state.pendingForceLoss.remaining===5&&state.pendingForceLoss.reason==='drain'&&state.lost.some(card=>card.id==='Light:1331')&&state.botLost.some(card=>card.id==='Dark:1338')"),true);
 run("state.botHand=[card('Dark:1338')];beginForceLoss('Light',1,{reason:'battleDamage'});");
 assert.equal(run("requestAction('loseForce','Light',['force'])&&requestAction('interruptResponse','Dark',[0,'increaseLoss',1])&&requestAction('passResponse','Light')&&requestAction('passResponse','Dark')"),true);
 assert.equal(run("state.pendingForceLoss?.remaining===1&&requestAction('loseForce','Light',['force'])&&!state.pendingForceLoss"),true);
});

test('reserve inserts stop activation when reached and do not add Life Force',async()=>{
 for(const side of ['Light','Dark']){
  const {run}=await craftHarness();
  run(`setupDecks=null;state.game=PremiereGame.actionState(179,1);
   const side='${side}',opponent=PremiereGame.otherSide(side),own=PremiereGame.zones(state,side),rival=PremiereGame.zones(state,opponent);
   const trap=card(side==='Light'?'Light:38':'Dark:22');
   state.activeSide=side;state.botTurn=side==='Dark'?{steps:[],index:0}:null;
   own.hand.splice(0,own.hand.length,trap,card(trap.id));rival.deck.splice(0,rival.deck.length,{name:'One'});`);
  assert.equal(run("!requestAction('deployReserveInsert',side,[0])"),true);
  run("rival.deck.push({name:'Two'},{name:'Three'});const life=lifeForceRemaining(opponent);");
  assert.equal(run("requestAction('deployReserveInsert',side,[0])&&!requestAction('deployReserveInsert',side,[0])"),true);
  assert.equal(run("rival.deck.includes(trap)&&rival.deck.at(-1)!==trap&&PremiereGame.playerView(state,side).players[opponent].reserveCount===null&&lifeForceRemaining(opponent)===life"),true);
  run("PremiereGame.resetTurn(state,opponent);rival.deck.splice(rival.deck.indexOf(trap),1);rival.deck.splice(rival.deck.length-1,0,trap);const forceCount=rival.force.length;");
  assert.equal(run("activateReserve(opponent,3).activated===1&&rival.force.length===forceCount+1&&own.lost.includes(trap)&&activationLocked(opponent)"),true);
  run("PremiereGame.resetTurn(state,side);");
  assert.equal(run("!activationLocked(opponent)"),true);
 }
});

test('Beru Stew activates on both sides in the turn player’s order',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(180,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};state.hand=[card('Light:222')];state.botHand=[];state.light[3]=[card('Light:221'),card('Light:1883')];state.deck=forcePile();state.botDeck=forcePile();");
 assert.equal(run("requestAction('pileInterrupt','Light',[0,'beruStew'])&&state.pendingCardView.side==='Dark'&&requestAction('finishCardInformation','Dark',['first','Dark'])"),true);
 assert.equal(run("state.force.length===7&&state.botForce.length===7&&state.pendingCardView?.side==='Light'&&state.pendingCardView?.maximum===2&&requestAction('finishCardInformation','Light',['extra',1])"),true);
 assert.equal(run("!state.pendingCardView&&state.force.length===8&&state.botForce.length===7&&state.lost.some(card=>card.id==='Light:222')"),true);
});

test('We’re Doomed halves individual losses only during the turn',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(181,0);state.hand=[card('Light:2764')];state.botHand=[];");
 assert.equal(run("!requestAction('pileInterrupt','Light',[0,'doomed'])"),true);
 run("state.activeSide='Dark';state.phase=1;state.botTurn={steps:[],index:0};");
 assert.equal(run("requestAction('pileInterrupt','Light',[0,'doomed'])&&beginForceLoss('Light',5,{reason:'drain'})===3"),true);
 run("state.light[0]=[card('Light:343')];");
 assert.equal(run("beginForceLoss('Light',5,{reason:'drain'})===2&&state.used.some(card=>card.id==='Light:2764')"),true);
 run("PremiereGame.resetTurn(state,'Light');");
 assert.equal(run("beginForceLoss('Light',5,{reason:'drain'})===5"),true);
});

test('Beru Stew resolves as much Force as possible even when neither player has a Reserve Deck',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(267,0);state.game.cardRulesVersion=24;
  const stew=card('Light:222');state.hand=[stew,card('Light:222')];state.botHand=[];
  state.deck=[];state.botDeck=[];`);
 assert.equal(run("requestAction('pileInterrupt','Light',[0,'beruStew'])&&requestAction('finishCardInformation','Light',['first','Dark'])"),true);
 assert.equal(run("state.force.length===5&&state.botForce.length===5&&state.lost.includes(stew)&&!state.pendingCardView"),true);
 assert.equal(run("requestAction('pileInterrupt','Light',[0,'beruStew'])"),false);
});

test('the Trash Compactor destroys both sides’ cards at its site',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(182,0);const compactor=card('Light:680'),light=card('Light:343'),dark=card('Dark:2355'),safe=card('Light:1593');state.locations[3]=compactor;state.light[3]=[light];state.dark[3]=[dark];state.light[4]=[safe];state.hand=[];state.botHand=[card('Dark:2762')];light.missing=true;");
 assert.equal(run("!requestAction('pileInterrupt','Dark',[0,'trashCompactor',4])&&requestAction('pileInterrupt','Dark',[0,'trashCompactor',3])"),true);
 assert.equal(run("state.locations[3]===compactor&&state.lost.includes(light)&&state.botLost.includes(dark)&&state.light[4].includes(safe)&&state.botLost.some(card=>card.id==='Dark:2762')"),true);
});

test('cover effects keep losses from Life Force hidden and leave legal retrieval intact',async()=>{
 for(const effectId of ['Light:917','Dark:2897']){
  const {run,elements}=await craftHarness();
  run(`setupDecks=null;state.game=PremiereGame.actionState(183,0);const cover=card('${effectId}');
   state.lostPileEffects=[{card:cover,target:'Light'}];
   const chosen=[{name:'Hidden Alpha'},{name:'Hidden Beta'}];state.used=chosen.slice();
   const trinto=card('Dark:2632'),view={side:'Dark',opponent:'Light',card:trinto,interruptFrame:{side:'Dark',card:trinto,rule:{pile:'Used'}}};
   startUsedPileLoss(view,chosen.slice());`);
  assert.equal(run("state.pendingCardView?.shown.length===0&&legalActions(state,'Light').every(choice=>!choice.label?.includes('Hidden'))"),true);
  assert.equal(run("requestAction('finishCardInformation','Light',['order',1])&&requestAction('finishCardInformation','Light',['order',0])"),true);
  assert.equal(run("state.lost[0]===chosen[1]&&state.lost.at(-1)===chosen[0]&&PremiereGame.playerView(state,'Light').players.Light.lostTop===null"),true);
  assert.doesNotMatch(elements.get('log').textContent,/Hidden Alpha|Hidden Beta/);
  assert.equal(run("PremiereGame.retrieveForce(state,'Light',1)[0]===chosen[0]"),true);
 }
});

test('both sides can combine applicable weapons against one target',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(184,0);state.phase=3;state.activeSide='Dark';state.botTurn={steps:[],index:0};const first=card('Dark:2355'),second=card('Dark:2355'),luke=card('Light:1593'),precise=card('Dark:1932');first.weapons=[card('Dark:1264')];second.weapons=[card('Dark:1264')];state.dark[3]=[first,second];state.light[3]=[luke];state.hand=[];state.botHand=[precise];state.botDeck=[{name:'Second',destiny:2},{name:'First',destiny:3}];");
 assert.equal(run("requestAction('battle','Dark',[3])&&!requestAction('combinedAttack','Dark',[0,0,1,1])"),true);
 assert.equal(run("requestAction('combinedAttack','Dark',[0,0,1,0])&&state.botLost.includes(precise)&&battleSession.hitUnits.Light.includes(luke)&&state.botDeck.length===0"),true);
});

test('Don’t Get Cocky adds destiny or removes a TIE ln at battle initiation',async()=>{
 const ground=await craftHarness(),space=await craftHarness();
 ground.run("setupDecks=null;state.game=PremiereGame.actionState(185,0);state.phase=3;state.light[3]=[card('Light:1593'),card('Light:1098')];state.dark[3]=[card('Dark:2355')];state.hand=[card('Light:758')];state.botHand=[];");
 assert.equal(ground.run("requestAction('battle','Light',[3])&&requestAction('battleEffect','Light',[0])&&battleSession.extraDraws.Light===2"),true);
 space.run("setupDecks=null;state.game=PremiereGame.actionState(186,0);state.phase=3;state.activeSide='Dark';state.botTurn={steps:[],index:0};const advanced=card('Dark:2595');state.dark[6]=[tie,advanced];state.light[6]=[ship];state.hand=[card('Light:758')];state.botHand=[];");
 assert.equal(space.run("requestAction('battle','Dark',[6])&&!requestAction('interruptResponse','Light',[0,'loseTie',1])&&requestAction('interruptResponse','Light',[0,'loseTie',0])"),true);
 assert.equal(space.run("requestAction('passResponse','Dark')&&requestAction('passResponse','Light')&&state.botLost.includes(tie)&&state.dark[6].includes(advanced)"),true);
});

test('Nabrun and Elis relocate only the selected group, at the drawn cost',async()=>{
 for(const side of ['Light','Dark']){
  const {run,elements}=await craftHarness();
  run(`setupDecks=null;state.game=PremiereGame.actionState(187,0);
   state.game.playerSide='${side}';
   const side='${side}',actor=PremiereGame.zones(state,side),enemy=PremiereGame.zones(state,PremiereGame.otherSide(side));
   const transport=card(side==='Light'?'Light:1749':'Dark:824'),first=card(side==='Light'?'Light:2052':'Dark:2355'),other=card(first.id);
   actor.hand.splice(0,actor.hand.length,transport);enemy.hand.length=0;actor.board[3]=[first,other];actor.deck.splice(0,actor.deck.length,{name:'Cost',destiny:2});`);
  assert.equal(run("requestAction('groupRelocation',side,[0,3])&&requestAction('finishCardInformation',side,['toggle',1])&&!requestAction('finishCardInformation',side,['relocate',6])&&requestAction('finishCardInformation',side,['relocate',2])"),true);
  assert.match(elements.get('playmatSelection').innerHTML,/2 Force für die Verlegung einsetzen/);
  assert.equal(run("actor.force.length===5&&requestAction('finishCardInformation',side,['pay'])&&actor.force.length===3&&actor.used.includes(transport)&&actor.board[3][0]===first&&actor.board[2][0]===other"),true);
 }
});

test('the garbage chute cancels a Death Star battle and moves its Light characters',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(188,0);state.phase=3;state.activeSide='Dark';state.botTurn={steps:[],index:0};const chute=card('Light:1321'),luke=card('Light:1593');state.locations[3]=card('Dark:673');state.locations[4]=card('Light:680');state.light[3]=[luke];state.dark[3]=[card('Dark:2355')];state.hand=[chute];state.botHand=[];");
 assert.equal(run("requestAction('battle','Dark',[3])&&requestAction('interruptResponse','Light',[0,'garbageChute'])&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
 assert.equal(run("state.used.includes(chute)&&state.light[4].includes(luke)&&battleSession===null&&PremiereGame.responseWindow(state.game)===null"),true);
});

test('Blast Door Controls cancels the listed interrupts',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(189,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};const controls=card('Dark:253'),chute=card('Light:1321'),luke=card('Light:1593');state.locations[3]=card('Dark:673');state.locations[4]=card('Light:680');state.light[3]=[luke];state.dark[3]=[card('Dark:2355')];state.hand=[chute];state.botHand=[controls];");
 assert.equal(run("requestAction('deployTableEffect','Dark',[0])&&state.tableEffects[0].card===controls"),true);
 run("state.phase=3;");
 assert.equal(run("requestAction('battle','Dark',[3])&&requestAction('interruptResponse','Light',[0,'garbageChute'])"),true);
 assert.equal(run("state.lost.includes(chute)&&state.light[3].includes(luke)&&PremiereGame.responseWindow(state.game)?.kind==='battle'"),true);
});

test('Full Scale Alert blocks opposing movement except smugglers and their starships',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(190,0);const luke=card('Light:1593'),han=card('Light:1098'),falcon=card('Light:1677');state.light[3]=[luke,han];state.light[6]=[falcon,ship];state.dark[3]=[card('Dark:2355'),card('Dark:2355')];state.hand=[];state.botHand=[card('Dark:993')];state.botDeck=[{name:'Low Destiny',destiny:1}];");
 assert.equal(run("requestAction('pileInterrupt','Dark',[0,'fullScaleAlert'])&&movementPrevented(luke)&&movementPrevented(falcon)&&movementPrevented(ship)&&!movementPrevented(han)"),true);
 run("state.light[3].pop();PremiereUnits.add(falcon,han,'pilot','Light');");
 assert.equal(run("!movementPrevented(falcon)&&movementPrevented(ship)"),true);
 run("PremiereGame.resetTurn(state,'Dark');");
 assert.equal(run("!movementPrevented(luke)&&!movementPrevented(ship)"),true);
});

test('both evacuations save crew before a capital ship is lost',async()=>{
 for(const side of ['Light','Dark']){
  const {run}=await craftHarness();
  run(`setupDecks=null;state.game=PremiereGame.actionState(191,0);
   const side='${side}',other=PremiereGame.otherSide(side),own=PremiereGame.zones(state,side),enemy=PremiereGame.zones(state,other);
   const capital=card(side==='Light'?'Light:530':'Dark:1291'),safe=card('Dark:723');
   const pilot=card(side==='Light'?'Light:1098':'Dark:502'),escape=card(side==='Light'?'Light:882':'Dark:888');
   own.board[6]=[capital];if(side==='Dark')own.board[1]=[safe];
   PremiereUnits.add(capital,pilot,'pilot',side);own.hand.splice(0,own.hand.length,escape);enemy.hand.length=0;
   loseTableCard(side,6,capital);openQueuedRuleResponse();`);
  assert.equal(run("own.board[6].includes(capital)&&!own.lost.includes(capital)&&PremiereGame.responseWindow(state.game)?.kind==='shipLoss'"),true);
  assert.equal(run("const evacuate=legalActions(state,side).find(action=>action.destination&&(side==='Dark'?action.destination.ship===safe:action.destination.slot===3));performAction(evacuate)"),true);
  assert.equal(run("requestAction('passResponse',other)&&requestAction('passResponse',side)&&requestAction('passResponse',other)&&requestAction('passResponse',side)"),true);
  assert.equal(run("own.lost.includes(capital)&&!own.lost.includes(pilot)&&own.used.includes(escape)&&(side==='Dark'?safe.occupants[0].card===pilot:own.board[3].includes(pilot))"),true);
 }
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(192,0);const capital=card('Dark:1291'),tarkin=card('Dark:1061');state.dark[6]=[capital];state.botHand=[card('Dark:888')];PremiereUnits.add(capital,tarkin,'pilot','Dark');");
 assert.equal(run("loseTableCard('Dark',6,capital)&&state.botLost.includes(tarkin)&&!state.ruleResponses?.length"),true);
});

test('Old Ben returns the exact forfeited card outside the battle',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(193,0);state.phase=3;const old=card('Light:1827'),luke=card('Light:1593'),older=card('Light:1593');state.light[3]=[luke];state.dark[3]=[card('Dark:2355')];state.hand=[old];state.botHand=[];state.lost=[older];");
 assert.equal(run("requestAction('battle','Light',[3])&&requestAction('skipDestiny','Light')&&requestAction('skipDestiny','Dark')"),true);
 run("battleSession.damage.debt.Light.damage=1;");
 assert.equal(run("requestAction('battleForfeit','Light',[0])&&requestAction('passResponse','Dark')&&requestAction('interruptResponse','Light',[0,'oldBen'])"),true);
 assert.equal(run("requestAction('passResponse','Dark')&&requestAction('passResponse','Light')&&state.light[3][0]===luke&&state.lost.includes(older)&&!battleSession.participants.Light.includes(luke)"),true);
});

test('Kintan Strider takes the closest character into hand',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(194,0);const striker=card('Dark:1440'),fresh=card('Dark:2355'),old=card('Dark:2355');state.botHand=[striker];state.botLost=[old,fresh,card('Dark:1264')];state.hand=[];state.light[3]=[card('Light:1593')];loseTableCard('Light',3,state.light[3][0]);openQueuedRuleResponse();");
 assert.equal(run("requestAction('interruptResponse','Dark',[0,'kintan'])&&requestAction('passResponse','Light')&&requestAction('passResponse','Dark')"),true);
 assert.equal(run("state.botHand.includes(fresh)&&state.botLost.includes(old)&&state.botLost.includes(striker)&&state.botForce.length===4"),true);
});

test('A Problem Here targets only starfighters at the finished battle',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(195,0);const shot=card('Dark:1237'),capital=card('Light:530');state.light[6]=[ship,capital];state.botHand=[shot];state.hand=[];state.botDeck=[{name:'High destiny',destiny:8}];endBattleTiming(6);openQueuedRuleResponse();");
 assert.equal(run("const calls=legalActions(state,'Dark').filter(action=>action.kind==='interruptResponse');calls.length===1&&calls[0].target===ship&&performAction(calls[0])"),true);
 assert.equal(run("requestAction('passResponse','Light')&&requestAction('passResponse','Dark')&&state.lost.includes(ship)&&state.light[6].includes(capital)&&state.botLost.includes(shot)"),true);
});

test('Panic and Emergency Deployment reveal cards and allow only eligible free deployments',async()=>{
 for(const side of ['Light','Dark']){
  const {run}=await craftHarness();
  run(`setupDecks=null;state.game=PremiereGame.actionState(196,0);state.phase=3;
   const side='${side}',opponent=PremiereGame.otherSide(side),own=PremiereGame.zones(state,side),enemy=PremiereGame.zones(state,opponent);
   const response=card(side==='Light'?'Light:1893':'Dark:830'),arrival=card(side==='Light'?'Light:2052':'Dark:2355'),location=card(side==='Light'?'Light:2448':'Dark:2458');
   state.activeSide=opponent;state.botTurn=opponent==='Dark'?{steps:[],index:0}:null;
   own.hand.splice(0,own.hand.length,response);own.force.length=0;enemy.hand.length=0;
   own.deck.splice(0,own.deck.length,location,arrival);own.board[3]=[{type:'Character',ability:1,power:1}];
   enemy.board[3]=[{type:'Character',ability:1,power:4}];`);
  assert.equal(run("requestAction('battle',opponent,[3])&&!requestAction('interruptResponse',side,[0,'emergency',3])&&requestAction('interruptResponse',side,[0,'emergency',2])"),true);
  assert.equal(run("requestAction('passResponse',opponent)&&requestAction('passResponse',side)&&state.pendingCardView.mode==='emergencyDeploy'"),true);
  assert.equal(run("const option=legalActions(state,side).find(action=>action.card===arrival&&action.destination?.slot===3);performAction(option)&&own.board[3].includes(arrival)&&!own.force.length"),true);
  assert.equal(run("requestAction('finishCardInformation',side,['done'])&&own.lost.includes(location)&&own.used.includes(response)"),true);
 }
});

test('both Reinforcements cards retrieve only their printed units',async()=>{
 for(const side of ['Light','Dark']){
  const {run}=await craftHarness();
  run(`setupDecks=null;state.game=PremiereGame.actionState(197,0);
   const side='${side}',own=PremiereGame.zones(state,side),enemy=PremiereGame.zones(state,PremiereGame.otherSide(side));
   const response=card(side==='Light'?'Light:2043':'Dark:1282'),fighter=card(side==='Light'?'Light:2907':'Dark:2600');
   const soldier=card(side==='Light'?'Light:2052':'Dark:2355'),other=card(side==='Light'?'Light:530':'Dark:1291');
   own.hand.splice(0,own.hand.length,response);enemy.hand.length=0;enemy.board[3]=[card('Light:1593')];
   own.lost.splice(0,own.lost.length,fighter,soldier,other);own.deck.splice(0,own.deck.length,{name:'Destiny',destiny:2});`);
  assert.equal(run("requestAction('pileInterrupt',side,[0,'reinforcements'])&&state.pendingCardView.remaining===2"),true);
  assert.equal(run("requestAction('finishCardInformation',side,['recover',0])&&requestAction('finishCardInformation',side,['recover',0])"),true);
  assert.equal(run("own.used.includes(fighter)&&own.used.includes(soldier)&&own.lost.includes(other)&&own.lost.includes(response)"),true);
 }
});

test('Skywalkers responds to Imperial Barrier or adds battle destiny',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(198,0);const sky=card('Light:2277'),barrier=card('Dark:1263'),luke=card('Light:1593');state.hand=[luke,sky];state.botHand=[barrier];");
 assert.equal(run("requestAction('deploy','Light',[0,3])&&requestAction('interruptResponse','Dark',[0,'barrier',0])&&requestAction('interruptResponse','Light',[0,'named'])"),true);
 assert.equal(run("requestAction('passResponse','Dark')&&requestAction('passResponse','Light')&&state.lost.includes(sky)&&state.botLost.includes(barrier)&&!barredThisTurn(luke)"),true);
});

test('Gold 5 and the Black Squadron ships use their printed crew capacities',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(199,0);const gold=card('Light:1050'),first=card('Dark:247'),second=card('Dark:249'),dutch=card('Light:1924'),runit=card('Light:1995'),luke=card('Light:1593');");
 assert.equal(run("PremiereUnits.accepts(gold,dutch,'pilot')&&PremiereUnits.accepts(gold,runit,'astromech')&&!PremiereUnits.accepts(first,runit,'passenger')"),true);
 run("PremiereUnits.add(gold,dutch,'pilot','Light');PremiereUnits.add(gold,luke,'passenger','Light');PremiereUnits.add(gold,runit,'astromech','Light');");
 assert.equal(run("!PremiereUnits.accepts(gold,card('Light:1098'),'pilot')&&!PremiereUnits.accepts(gold,card('Light:1995'),'astromech')"),true);
 assert.equal(run("for(const [fighter,id] of [[first,'Dark:790'],[second,'Dark:791']]){const pilot=card(id);PremiereUnits.add(fighter,pilot,'pilot','Dark');} [first,second].every(fighter=>fighter.occupants.length===1&&!PremiereUnits.accepts(fighter,card('Dark:502'),'pilot'))"),true);
});

test('the Light mechanic protects units and can cancel Lateral Damage',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(200,0);const mechanic=card('Light:2785'),effect=card('Dark:1480');state.light[2]=[mechanic];state.light[6]=[ship];state.hand=[];state.botHand=[];battleSession={site:6,participants:{Light:[ship],Dark:[]}};");
 assert.equal(run("battleImmunity('Light',ship)"),3);
 run("battleSession=null;state.locationEffects={1:[{card:effect,target:ship}]};");
 assert.equal(run("requestAction('lateralMechanic','Light',[1,0])&&state.botLost.includes(effect)&&state.locationEffects[1].length===0"),true);
});

test('Chief Bast evacuates with a non-droid at the same system',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(201,0);state.phase=3;const bast=card('Dark:406'),tarkin=card('Dark:1061'),capital=card('Dark:1291'),droid=card('Dark:816');state.light[6]=[ship];state.dark[6]=[capital];state.hand=[];state.botHand=[];PremiereUnits.add(capital,bast,'pilot','Dark');PremiereUnits.add(capital,tarkin,'passenger','Dark');PremiereUnits.add(capital,droid,'passenger','Dark');");
 assert.equal(run("requestAction('battle','Light',[6])&&!requestAction('interruptResponse','Dark',[-1,'bast',1,3])&&requestAction('interruptResponse','Dark',[-1,'bast',0,3])"),true);
 assert.equal(run("requestAction('passResponse','Light')&&requestAction('passResponse','Dark')&&state.dark[3].includes(tarkin)&&state.dark[3].includes(bast)&&capital.occupants[0].card===droid"),true);
});

test('Lateral Damage resets ship values until a successful repair',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(202,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};const effect=card('Dark:1480');state.botHand=[effect];state.hand=[];state.light[6]=[ship];");
 assert.equal(run("requestAction('deployLocationEffect','Dark',[0,1,0])&&craftStats(ship,6).power===0"),true);
 run("battleSession={site:6};");
 assert.equal(run("battleForfeitValue(ship,'Light')"),0);
 run("battleSession=null;state.light[6]=[];state.light[1]=[ship];state.deck=[{name:'Repair destiny',destiny:3}];progressLocationMissions();");
 assert.equal(run("requestAction('lateralRepair','Light',[1,0])&&state.botLost.includes(effect)&&craftStats(ship,1).power===ship.power"),true);
});

test('the detachment adds attrition even without battle destiny',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(203,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};const effect=card('Dark:2214'),trooper=card('Dark:668');state.locations[5]=card('Dark:673');state.dark[5]=[trooper];state.botHand=[effect];state.hand=[];");
 assert.equal(run("!requestAction('deployLocationEffect','Dark',[0,2,0])&&requestAction('deployLocationEffect','Dark',[0,3,0])&&detachmentAttrition(4,'Light')===0"),true);
 run("state.dark[5]=[];state.dark[3]=[trooper];");
 assert.equal(run("detachmentAttrition(4,'Light')===1&&detachmentAttrition(4,'Dark')===0&&detachmentAttrition(5,'Light')===0"),true);
});

test('Tactical Re-Call penalizes a participating warrior until reaching the site',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(204,0);const recall=card('Dark:2397'),leia=card('Light:1495');leia.warrior=true;state.locations[4]=card('Light:2855');state.light[3]=[leia];state.botHand=[recall];state.hand=[];endBattleTiming(3,{lightTotal:2,darkTotal:4},{Light:[leia],Dark:[]});openQueuedRuleResponse();");
 assert.equal(run("requestAction('interruptResponse','Dark',[0,'tacticalRecall',4,0])&&requestAction('passResponse','Light')&&requestAction('passResponse','Dark')&&tacticalPenalty(leia)===3"),true);
 run("state.light[3]=[];state.light[4]=[leia];");
 assert.equal(run("requestAction('passResponse','Light')&&requestAction('passResponse','Dark')&&state.botLost.includes(recall)&&tacticalPenalty(leia)===0"),true);
});

test('ability spent on battle power cannot also count toward destiny',async()=>{
 for(const side of ['Light','Dark']){
  const {run}=await craftHarness();
  run(`setupDecks=null;state.game=PremiereGame.actionState(205,0);state.phase=3;
   const side='${side}',opponent=PremiereGame.otherSide(side),own=PremiereGame.zones(state,side),enemy=PremiereGame.zones(state,opponent);
   state.activeSide=side;state.botTurn=side==='Dark'?{steps:[],index:0}:null;
   const unit=card(side==='Light'?'Light:1593':'Dark:634');unit.ability=4;own.board[2]=[unit];
   enemy.board[2]=[{type:'Character',power:1,ability:1}];own.hand.length=0;enemy.hand.length=0;
   state.tableEffects=[{target:side,card:card(side==='Light'?'Light:1402':'Dark:1688')}];`);
  assert.equal(run("requestAction('battle',side,[2])&&battleDestinyDrawCount(side,2,4)===1&&requestAction('abilityPower',side,[0,1])"),true);
  assert.equal(run("battleSession.bonusPower[side]===1&&battleDestinyDrawCount(side,2,4)===0"),true);
 }
});

test('Lightsaber Proficiency adds battle power and optional Force drain',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(206,0);const effect=card('Light:1554'),luke=card('Light:1593'),saber=card('Light:1386');luke.weapons=[saber];state.light[3]=[luke];state.hand=[effect];state.botHand=[];");
 assert.equal(run("requestAction('deployTableEffect','Light',[0,0])&&saberTraining(luke).amount===3&&battleTotals(3,'Light').lightPower===luke.power+3"),true);
 run("state.phase=1;");
 assert.equal(run("drainPlan('Light',3).optional===2"),true);
 run("loseTableCard('Light',3,saber);refreshSaberTraining();");
 assert.equal(run("!saberTraining(luke)&&state.lost.includes(effect)&&state.tableEffects.length===0"),true);
});

test('Disarmed removes Lightsaber Proficiency before any further Force drain',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(275,0);state.game.cardRulesVersion=25;
  const effect=card('Light:1554'),luke=card('Light:1593'),saber=card('Light:1386'),trooper=card('Dark:2355');
  luke.weapons=[saber];trooper.weapons=[card('Dark:1230')];state.light[3]=[luke];state.dark[3]=[trooper];
  state.hand=[effect];state.botHand=[card('Dark:734')];`);
 assert.equal(run("requestAction('deployTableEffect','Light',[0,0])&&saberTraining(luke).amount===3"),true);
 run('state.phase=1');
 assert.equal(run(`const disarm=legalActions(state,'Dark').find(option=>option.kind==='weaponEffect'&&option.args[0]==='disarm');
  !!disarm&&performAction(disarm)&&state.lost.includes(saber)&&state.lost.includes(effect)&&!state.tableEffects.length`),true);
 run('state.dark[3]=[]');
 assert.equal(run("drainPlan('Light',3).optional===0&&!requestAction('drain','Light',[3,1])"),true);
});

test('Mantellian Savrip permits hand forfeits only after a loss',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(207,0);const threepio=card('Light:343'),sav=card('Light:1643'),pilot=card('Light:1098');state.light[4]=[threepio];state.light[3]=[card('Light:2052')];state.dark[3]=[card('Dark:634')];state.hand=[sav,pilot];state.botHand=[];");
 assert.equal(run("requestAction('deployTableEffect','Light',[0])&&state.force.length===5"),true);
 run("state.phase=3;");
 assert.equal(run("requestAction('battle','Light',[3])&&requestAction('skipDestiny','Light')&&requestAction('skipDestiny','Dark')"),true);
 assert.equal(run("battleSession.damage.result.darkTotal>battleSession.damage.result.lightTotal&&requestAction('battleHandForfeit','Light',[0])&&state.lost.includes(pilot)&&battleSession.damage.debt.Light.damage===0"),true);
});

test('Talz restores both hits before forfeiting',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(208,0);state.phase=3;const talz=card('Light:2412'),luke=card('Light:1593');state.light[3]=[talz,luke];state.dark[3]=[card('Dark:634')];state.hand=[];state.botHand=[];");
 assert.equal(run("requestAction('battle','Light',[3])"),true);
 run("battleSession.hitUnits.Light=[talz,luke];battleSession.zeroForfeit=[talz,luke];");
 assert.equal(run("requestAction('skipDestiny','Light')&&requestAction('skipDestiny','Dark')&&requestAction('talzForfeit','Light',[0,1])"),true);
 assert.equal(run("state.lost.includes(talz)&&state.light[3][0]===luke&&battleForfeitValue(luke,'Light')===luke.forfeit&&!battleSession.damage.debt.Light.hits.length"),true);
});

test('Myo regenerates in battle and gains power with a bounty hunter',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(209,0);const myo=card('Dark:1720'),hunter=card('Dark:741');state.dark[3]=[myo,hunter];state.light[3]=[card('Light:1593')];state.hand=[];state.botHand=[];");
 assert.equal(run("cardPowerModifier(myo,'Dark',3)"),1);
 run("state.phase=3;");
 assert.equal(run("requestAction('battle','Light',[3])&&loseTableCard('Dark',3,myo)&&state.botUsed.at(-1)===myo&&!state.botLost.includes(myo)"),true);
});

test('Prophetess predicts only while active and settles once',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(210,0);state.phase=3;state.activeSide='Dark';state.botTurn={steps:[],index:0};const prophet=card('Dark:1958');prophet.gameTextCancelled=true;state.dark[3]=[prophet,card('Dark:2355')];state.light[3]=[card('Light:2052')];state.hand=[];state.botHand=[];");
 assert.equal(run("requestAction('battle','Dark',[3])&&!battleSession.prediction"),true);
});

test('Set For Stun returns the character and attached cards to their owners',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(211,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};const stun=card('Dark:2242'),luke=card('Light:1593'),saber=card('Light:1386');luke.weapons=[saber];state.light[3]=[luke];state.botHand=[stun];state.hand=[];state.botDeck=[{name:'Stun destiny',destiny:6}];");
 assert.equal(run("requestAction('pileInterrupt','Dark',[0,'setStun',0])&&state.hand.includes(luke)&&state.hand.includes(saber)&&!state.light[3].includes(luke)"),true);
});

test('Tallon Roll treats a missing destiny as a lost roll',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(212,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};const roll=card('Dark:2410');state.light[6]=[ship];state.dark[6]=[tie];state.botHand=[roll];state.hand=[];state.botDeck=[];state.deck=[{name:'Rebel destiny',destiny:0}];");
 assert.equal(run("requestAction('pileInterrupt','Dark',[0,'tallonRoll',6,0,0])&&state.botLost.includes(tie)&&state.light[6].includes(ship)"),true);
});

test('Physical Choke can lose a Rebel Trooper without a destiny draw',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(213,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};const choke=card('Dark:1904'),trooper={...card('Light:1593'),name:'Rebel Trooper'},luke=card('Light:1593');state.light[3]=[trooper,luke];state.botHand=[choke];state.hand=[];");
 assert.equal(run("!requestAction('pileInterrupt','Dark',[0,'chokeTrooper',1])&&requestAction('pileInterrupt','Dark',[0,'chokeTrooper',0])&&state.lost.includes(trooper)&&!state.lost.includes(luke)"),true);
});

test('Nevar Yalnal adds two against an undercover spy',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(214,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};const nevar=card('Dark:1767'),luke=card('Light:1593'),spy=card('Dark:634');spy.characteristics=['spy'];luke.undercover=true;state.light[3]=[luke];state.dark[3]=[spy];state.botHand=[nevar];state.hand=[];state.botDeck=[{name:'Spy destiny',destiny:1}];");
 assert.equal(run("requestAction('pileInterrupt','Dark',[0,'nevar',0])&&state.lost.includes(luke)"),true);
});

test('Your Powers Are Weak, Old Man cancels an Old Ben response',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(215,0);const weakness=card('Dark:2901'),ben=card('Light:1827');state.hand=[];state.botHand=[weakness];PremiereGame.openResponse(state.game,{kind:'interrupt',interrupt:'oldBen',side:'Light',card:ben});");
 assert.equal(run("requestAction('interruptResponse','Dark',[0,'named'])&&requestAction('passResponse','Light')&&requestAction('passResponse','Dark')&&state.lost.includes(ben)"),true);
});

test('Kabe and Momaw steal the appropriate targets during control',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(216,0);state.phase=1;const kabe=card('Light:1406'),momaw=card('Light:1690'),trooper=card('Dark:668'),blaster=card('Dark:1264');trooper.weapons=[blaster];state.light[3]=[kabe,momaw];state.dark[3]=[trooper,bantha];state.hand=[];state.botHand=[];state.deck=[{name:'Destiny',destiny:0}];");
 assert.equal(run("requestAction('controlTheft','Light',[0,0])&&kabe.weapons.includes(blaster)&&blaster.owner==='Light'&&blaster.kabeHeld"),true);
 assert.equal(run("performAction(legalActions(state,'Light').find(action=>action.kind==='controlTheft'&&action.card===momaw))&&state.light[3].includes(bantha)&&bantha.owner==='Light'"),true);
});

test('Wioslea only buys an unoccupied transport with a successful destiny and payment',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(217,0);state.phase=1;const wioslea=card('Light:2811'),transport=card('Dark:2660');state.light[3]=[wioslea];state.dark[3]=[transport];state.hand=[];state.botHand=[];state.deck=[{name:'Destiny',destiny:6}];");
 assert.equal(run("requestAction('controlTheft','Light',[0,0])&&state.force.length===4&&state.pendingCardView.mode==='wiosleaPurchase'"),true);
 assert.equal(run("requestAction('finishCardInformation','Light',['purchase'])&&transport.owner==='Light'&&state.force.length===4-transport.deploy"),true);
});

test('the Tonnika Sisters require a two and pick a single equipment type',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(218,0);state.phase=1;state.activeSide='Dark';state.botTurn={steps:[],index:0};const sisters=card('Dark:2613'),luke=card('Light:1593'),leia=card('Light:1495'),saber=card('Light:1386'),saber2=card('Light:1386'),device={type:'Device',name:'Test device',owner:'Light'};luke.weapons=[saber];leia.weapons=[saber2];leia.attachments=[device];state.light[3]=[luke,leia];state.dark[3]=[sisters];state.hand=[];state.botHand=[];state.botDeck=[{name:'Destiny',destiny:3},{name:'Destiny',destiny:2}];");
 assert.equal(run("requestAction('controlTheft','Dark',[0])&&requestAction('finishCardInformation','Dark',['steal',0])&&state.pendingCardView.category==='Weapon'"),true);
 assert.equal(run("!legalActions(state,'Dark').some(option=>option.label?.includes(device.name))&&saber.owner==='Dark'"),true);
});

test('Kabe’s stolen blaster can be recovered and redeployed by its new owner',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(250,0);state.phase=1;
  const kabe=card('Light:1406'),luke=card('Light:1593'),trooper=card('Dark:2355'),blaster=card('Dark:1264');
  trooper.weapons=[blaster];state.light[3]=[kabe,luke];state.dark[3]=[trooper];
  state.hand=[];state.botHand=[];state.deck=[{name:'Theft destiny',destiny:0}];`);
 assert.equal(run("requestAction('controlTheft','Light',[0,0])&&kabe.weapons.includes(blaster)&&blaster.kabeHeld"),true);
 assert.equal(run("loseTableCard('Light',3,kabe)&&state.lost.includes(blaster)&&!state.botLost.includes(blaster)"),true);
 run("PremiereGame.retrieveCard(state,'Light',state.lost.indexOf(blaster));recirculate('Light');activateReserve('Light',1);state.phase=5;");
 assert.equal(run("requestAction('draw','Light')&&state.hand[0]===blaster"),true);
 run("state.phase=2;");
 assert.equal(run("!weaponPlacementOptions('Dark',blaster,3).length&&requestAction('equip','Light',[0,3,0])&&luke.weapons.includes(blaster)&&!blaster.kabeHeld"),true);
});

test('a weapon hit still loses the droid when Set For Stun ends the battle early',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(251,0);state.phase=3;
  state.activeSide='Dark';state.botTurn={steps:[],index:0};
  const luke=card('Light:1593'),droid=card('Light:343'),trooper=card('Dark:2355');
  trooper.weapons=[card('Dark:1264')];state.light[3]=[luke,droid];state.dark[3]=[trooper];
  state.hand=[];state.botHand=[card('Dark:2242')];state.botDeck=[{name:'Stun destiny',destiny:6},{name:'Blaster destiny',destiny:1}];`);
 assert.equal(run("requestAction('battle','Dark',[3])&&requestAction('fireWeapon','Dark',[0,0,1])&&battleSession.hitUnits.Light.includes(droid)&&state.light[3].includes(droid)"),true);
 assert.equal(run("requestAction('passWeapons','Light')&&requestAction('pileInterrupt','Dark',[0,'setStun',0])"),true);
 assert.equal(run("battleSession===null&&state.hand.includes(luke)&&state.lost.includes(droid)&&state.light[3].length===0"),true);
});

test('Talz restores a droid’s own forfeit after a redirected weapon shot',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(252,0);state.phase=3;
  state.activeSide='Dark';state.botTurn={steps:[],index:0};
  const luke=card('Light:1593'),droid=card('Light:343'),talz=card('Light:2412'),trooper=card('Dark:2355');
  trooper.weapons=[card('Dark:1264')];state.light[3]=[luke,droid,talz];state.dark[3]=[trooper];
  state.hand=[card('Light:2570')];state.botHand=[];state.botDeck=[{name:'Blaster destiny',destiny:1}];`);
 assert.equal(run("requestAction('battle','Dark',[3])&&requestAction('fireWeapon','Dark',[0,0,0])"),true);
 assert.equal(run("performAction(legalActions(state,'Light').find(action=>action.args[1]==='droidRedirect'))"),true);
 assert.equal(run("for(let i=0;i<4;i++)requestAction('passResponse',PremiereGame.responseWindow(state.game).priority);battleSession.hitUnits.Light.includes(droid)&&!battleSession.hitUnits.Light.includes(luke)&&battleForfeitValue(droid,'Light')===luke.forfeit"),true);
 assert.equal(run("requestAction('passWeapons','Light')&&requestAction('passWeapons','Dark')&&requestAction('skipDestiny','Dark')&&requestAction('skipDestiny','Light')&&requestAction('battleForceLoss','Dark',['force'])"),true);
 assert.equal(run("requestAction('talzForfeit','Light',[2,1])&&state.lost.includes(talz)&&state.light[3].includes(droid)&&battleForfeitValue(droid,'Light')===droid.forfeit"),true);
});

test('navigation sabotage removes only the chosen navigator',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(219,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};const sabotage=card('Dark:1238'),droid=card('Light:1995');state.dark[6]=[scout];state.hand=[];state.botHand=[sabotage];state.botDeck=[{name:'Destiny',destiny:2}];");
 assert.equal(run("requestAction('navSabotage','Dark',[0,0])&&scout.attachments.includes(sabotage)&&!craftStats(scout,6).navComputer&&PremiereUnits.accepts(scout,droid,'astromech')"),true);
});

test('Scomp access requires a qualified actor and preserves secrecy',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(220,0);const access=card('Light:2180'),code=card('Dark:1265'),droid=card('Light:1995'),leader=card('Dark:1061');state.hand=[access];state.botHand=[code];state.light[3]=[droid];state.locations[4]=card('Dark:669');state.dark[4]=[leader];");
 assert.equal(run("!requestAction('pileInterrupt','Light',[0,'scompPeek','Dark'])&&namedCancellation(code,access)"),true);
 run("state.dark[4]=[];state.light[3]=[];state.light[2]=[droid];");
 assert.equal(run("requestAction('pileInterrupt','Light',[0,'scompPeek','Dark'])&&state.pendingCardView.shown[0]===state.botDeck.at(-1)&&state.pendingCardView.expiresAt>Date.now()"),true);
 assert.equal(run("requestAction('finishCardInformation','Light',['done'])&&!state.pendingCardView&&state.used.includes(access)"),true);
});

test('How Did We Get Into This Mess exchanges the remaining hand plus one with Threepio',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(221,0);const mess=card('Light:1187'),threepio=card('Light:343'),old=card('Light:1593');state.hand=[mess,old];state.light[3]=[threepio];state.botHand=[];state.deck=[card('Light:2052'),card('Light:1495')];");
 assert.equal(run("requestAction('pileInterrupt','Light',[0,'handRefresh',0])&&state.used.includes(old)&&state.used.includes(mess)&&state.hand.length===2&&state.force.length===4"),true);
});

test('Spaceport Speeders activates proceeds before losing the vehicle',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(222,0);const sale=card('Light:2319'),dealer=card('Light:2811'),speed=card('Light:2307');state.hand=[sale];state.botHand=[];state.light[3]=[dealer,speed];state.deck=[...forcePile(),{name:'Offer two',destiny:2},{name:'Offer one',destiny:1}];");
 assert.equal(run("requestAction('pileInterrupt','Light',[0,'speederSale',1])&&state.force.length===8&&state.lost.includes(speed)&&state.used.includes(sale)"),true);
});

test('Thank The Maker sums Force lost across drains within the same opposing turn',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(223,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};state.phase=1;const maker=card('Light:2509');state.hand=[maker];state.botHand=[];state.light[3]=[card('Light:343')];");
 assert.equal(run("beginForceLoss('Light',4,{reason:'drain'});for(let i=0;i<4;i++)requestAction('loseForce','Light',['force']);!requestAction('pileInterrupt','Light',[0,'makerRetrieval'])"),true);
 run("state.force.push({name:'Extra Force'});beginForceLoss('Light',1,{reason:'drain'});requestAction('loseForce','Light',['force']);state.deck=[{name:'Retrieve',destiny:2}];");
 assert.equal(run("requestAction('pileInterrupt','Light',[0,'makerRetrieval'])&&state.lost.length===4&&state.lost.includes(maker)"),true);
});

test('Utinni effects persist, arrive and equip the chosen character',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(224,0);const armor=card('Light:1913'),mask=card('Light:2646'),luke=card('Light:1593'),trooper=card('Dark:2355');state.locations[4]=card('Dark:669');state.light[3]=[luke];state.dark[4]=[trooper];state.hand=[armor,mask];state.botHand=[];");
 assert.equal(run("!locationEffectOptions('Light',0).length&&loseTableCard('Dark',4,trooper);openQueuedRuleResponse();requestAction('interruptResponse','Light',[0,'gearMission',0])&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
 run("state.light[3]=[];state.light[4]=[luke];requestAction('passResponse','Dark');requestAction('passResponse','Light');");
 assert.equal(run("wearingUtinniGear(luke,'plastoid-armor')&&isSpyCharacter(luke)&&cardForfeitValueAt(luke,'Light',4)===luke.forfeit+2&&gearMissionOptions('Light',{kind:'finishedBattle',side:'Light',site:3,winner:'Light'}).length===1"),true);
});

test('Luke Luuuuke loses a Rebel reduced to zero forfeit or clears at arrival',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(225,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};const effect=card('Dark:1599'),luke=card('Light:1593');state.light[2]=[luke];state.hand=[];state.botHand=[effect];");
 assert.equal(run("requestAction('deployLocationEffect','Dark',[0,3,0])&&lukeUtinniPenalty(luke)===3&&cardForfeitValueAt(luke,'Light',2)===4"),true);
 run("state.light[2]=[];state.light[3]=[luke];progressLocationMissions();");
 assert.equal(run("state.botLost.includes(effect)&&!lukeUtinniPenalty(luke)"),true);
});

test('Juri Juice inhibits battle ability and is removed by a move without driving',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(226,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};const juri=card('Dark:1401'),kabe=card('Light:1406');state.light[3]=[kabe];state.hand=[];state.botHand=[juri];");
 assert.equal(run("requestAction('deployTableEffect','Dark',[0,0])&&battleCardAbility(kabe)===0&&cardAbility(kabe)===1"),true);
 run("state.activeSide='Light';state.botTurn=null;state.phase=4;state.locationOrder=[0,1,2,3,4,5,6];");
 assert.equal(run("requestAction('move','Light',[3,0,4,'Landspeed'])&&state.botLost.includes(juri)&&battleCardAbility(kabe)===1"),true);
});

test('Mouse Droid carries and delivers a targeted Utinni Effect',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(227,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};const effect=card('Dark:1599'),mouse=card('Dark:1709'),luke=card('Light:1593');state.light[2]=[luke];state.dark[3]=[mouse];state.locationEffects={3:[{card:effect,target:luke}]};state.hand=[];state.botHand=[];");
 assert.equal(run("requestAction('mouseUtinni','Dark',[0,0])&&state.mouseUtinni.has(mouse)&&lukeUtinniPenalty(luke)===3&&!mouseUtinniOptions('Dark').length"),true);
 run("state.dark[3]=[];state.dark[2]=[mouse];");
 assert.equal(run("requestAction('mouseUtinni','Dark',[0,-1])&&state.botHand.includes(mouse)&&state.botLost.includes(effect)&&!state.mouseUtinni.has(mouse)"),true);
});

test('Dice Ibegon stings the character who fired at the same physical place',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(228,0);state.phase=3;const dice=card('Light:730'),trooper=card('Dark:2355');state.light[3]=[dice];state.dark[3]=[trooper];state.hand=[];state.botHand=[];state.deck=[{name:'Poison destiny',destiny:trooper.ability}];requestAction('battle','Light',[3]);afterCharacterFires('Dark',trooper,3,()=>{});");
 assert.equal(run("requestAction('interruptResponse','Light',[-1,'poisonStinger',0])&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')&&battleSession.hitUnits.Dark.includes(trooper)"),true);
});

test('Figrin resolves a wager and offers random retrieval only to the winner',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(229,0);state.phase=1;const figrin=card('Light:942'),prize=card('Light:1495');state.light[3]=[figrin];state.hand=[];state.botHand=[];state.deck=[{destiny:3},{destiny:3},{destiny:3}];state.botDeck=[{destiny:2},{destiny:2}];state.lost=[prize];");
 assert.equal(run("requestAction('wager','Light',[0])&&state.pendingCardView.side==='Light'&&requestAction('finishCardInformation','Light',['retrieve'])&&state.used.includes(prize)&&!wagerOptions('Light').length"),true);
});

test('Dark Hours sleeps eligible characters and expires after the next Dark turn',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(230,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};const hours=card('Dark:619'),night=card('Light:2860'),luke=card('Light:1593'),droid=card('Light:343');state.light[3]=[luke,droid];state.hand=[];state.botHand=[hours];state.botDeck=[{name:'Sleep',destiny:6}];");
 assert.equal(run("!requestAction('deployLocationEffect','Dark',[0,3])"),true);
 run("state.locationEffects={6:[{card:night,nightfall:true}]};");
 assert.equal(run("requestAction('deployLocationEffect','Dark',[0,3])&&luke.asleep&&!droid.asleep&&movementPrevented(luke)&&cardForfeitValueAt(luke,'Light',3)===0"),true);
 assert.equal(run("state.game.timing.turn=3;wakeSleepingCharacters();!luke.asleep"),true);
});

test('Blaster Scope targets and loses an adjacent nonparticipant after battle',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(231,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};state.locationOrder=[0,1,2,3,4,5,6];const scope=card('Dark:266'),weapon=card('Dark:1264'),trooper=card('Dark:2355'),defender=card('Light:1593'),outside=card('Light:2052');trooper.weapons=[weapon];state.dark[3]=[trooper];state.light[3]=[defender];state.light[4]=[outside];state.hand=[];state.botHand=[scope];");
 assert.equal(run("requestAction('weaponEffect','Dark',['scope',0,0])&&weapon.attachments.includes(scope)"),true);
 run("state.phase=3;requestAction('battle','Dark',[3]);const shot=battleWeaponOptions('Dark').find(choice=>choice.target===outside);");
 assert.equal(run("shot?.scopeExternal&&shot.targetSlot===4&&!battleSession.participants.Light.includes(outside)"),true);
 assert.equal(run("applyWeaponResult(shot,'Light',4);state.light[4].includes(outside)&&state.scopeHits.includes(outside)"),true);
 assert.equal(run("endBattleTiming(3);state.lost.includes(outside)"),true);
});

test('Holocam boosts automated weapons and borrows adjacent power without adding a participant',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(232,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};state.locationOrder=[0,1,2,3,4,5,6];const camera=card('Dark:1815'),trooper=card('Dark:2355'),support=card('Dark:634');state.dark[3]=[trooper];state.dark[4]=[support];state.light[3]=[card('Light:1593')];state.hand=[];state.botHand=[camera];");
 assert.equal(run("requestAction('deployLocationEffect','Dark',[0,3])&&holocamDestiny('Dark',4)===1"),true);
 run("state.phase=3;requestAction('battle','Dark',[3]);const offer=holocamPowerOptions('Dark')[0];");
 assert.equal(run("offer.target===support&&requestAction('holocamPower','Dark',offer.args)&&battleSession.bonusPower.Dark===support.power&&!battleSession.participants.Dark.includes(support)"),true);
});

test('On The Edge requires a higher destiny and offers retrieval',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(233,0);const edge=card('Light:1834'),luke=card('Light:1593'),prize=card('Light:2052');state.light[3]=[luke];state.hand=[edge];state.botHand=[];state.lost=[prize];state.deck=[{name:'Higher',destiny:3}];");
 assert.equal(run("requestAction('pileInterrupt','Light',[0,'onTheEdge',0])&&!requestAction('finishCardInformation','Light',['wager',0])&&requestAction('finishCardInformation','Light',['wager',2])"),true);
 assert.equal(run("requestAction('finishCardInformation','Light',['retrieve'])&&state.used.includes(prize)&&state.lost.includes(edge)&&state.light[3].includes(luke)"),true);
});

test('Utinni steals only where a Jawa is present and cancels Jawa titles',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(234,0);const utinni=card('Light:2689'),darkUtinni=card('Dark:2688'),jawa={...card('Light:2052'),name:'Jawa',characteristics:['jawa']},recall=card('Dark:1599');state.hand=[utinni];state.botHand=[];state.locationEffects={3:[{card:recall,target:jawa}]};state.light[4]=[jawa];");
 assert.equal(run("!requestAction('pileInterrupt','Light',[0,'utinniSteal',0])&&namedCancellation(darkUtinni,card('Dark:649'))&&!namedCancellation(utinni,jawa)"),true);
 run("state.light[4]=[];state.light[3]=[jawa];");
 assert.equal(run("requestAction('pileInterrupt','Light',[0,'utinniSteal',0])&&state.hand.includes(recall)&&recall.owner==='Light'"),true);
});

test('Noble Sacrifice removes the equal-power captive',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(235,0);const noble=card('Light:1794'),captive=card('Light:2052'),deployed=card('Dark:2355');captive.captured=true;captive.power=deployed.power;state.dark[3]=[captive,deployed];state.hand=[noble];state.botHand=[];state.lost=[card('Light:343')];openDeploymentReaction('Dark',[deployed]);");
 assert.equal(run("requestAction('interruptResponse','Light',[0,'nobleSacrifice',0])&&state.outOfPlay.includes(captive)&&!captive.captured&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')"),true);
 assert.equal(run("requestAction('finishCardInformation','Light',['retrieve'])&&state.lost.includes(noble)&&state.used.some(card=>card.id==='Light:343')"),true);
});

test('The Circle Is Now Complete compares one saber bonus for each duelist',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(236,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};const obi=card('Light:1809'),vader=card('Dark:634'),duel=card('Dark:2517');obi.name='Obi-Wan Kenobi';obi.type='Character';obi.power=vader.power-1;obi.weapons=[card('Light:1386'),card('Light:1386')];state.light[3]=[obi];state.dark[3]=[vader];state.hand=[];state.botHand=[duel];");
 assert.equal(run("requestAction('duel','Dark',[0,3])&&state.outOfPlay.includes(vader)&&state.light[3].includes(obi)&&state.botLost.includes(duel)"),true);
});

test('Help Me Obi-Wan spends ability outside the battle and offers an adjacent Rebel react',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(237,0);const help=card('Light:1125'),obi=card('Light:1809'),trooper=card('Light:2052');obi.name='Obi-Wan Kenobi';obi.ability=6;state.phase=3;state.light[2]=[obi];state.light[3]=[trooper];state.dark[3]=[card('Dark:634')];state.hand=[help];state.botHand=[];");
 assert.equal(run("helpRebelOptions('Light',{kind:'battle',side:'Dark',site:2}).some(option=>option.rebel===trooper)"),true);
 assert.equal(run("requestAction('battle','Light',[3])&&requestAction('obiAssist','Light',[0,0,3])&&battleCardAbility(obi)===3&&battleTotals(3).lightAbility===4&&state.used.includes(help)"),true);
});

test('This Is All Your Fault redirects a shot and cancels attrition at the cost of a droid',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(238,0);const fault=card('Light:2570'),droid=card('Light:343'),luke=card('Light:1593'),shooter=card('Dark:2355'),weapon=card('Dark:1264');state.phase=3;state.light[3]=[luke,droid];state.dark[3]=[shooter];state.hand=[fault];state.botHand=[];");
 assert.equal(run("droidRedirectOptions('Light',{kind:'weaponTarget',side:'Dark',shot:{target:luke,weapon,host:shooter}})[0].originalForfeit===luke.forfeit"),true);
 assert.equal(run("requestAction('pileInterrupt','Light',[0,'droidAttrition',1])&&attritionPrevented('Light',3)&&!attritionPrevented('Dark',3)&&state.lost.includes(droid)&&state.used.includes(fault)"),true);
});

test('Local Trouble limits the Cantina battle to three chosen characters',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(239,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};state.phase=3;const trouble=card('Dark:1565'),first=card('Dark:2355'),second=card('Dark:2355'),also=card('Dark:634'),luke=card('Light:1593'),trooper=card('Light:2052');state.dark[4]=[first,second,also];state.light[4]=[luke,trooper];state.hand=[];state.botHand=[trouble];");
 assert.equal(run("requestAction('pileInterrupt','Dark',[0,'localTrouble',0,1,1,1])&&battleSession.participants.Dark.length===2&&battleSession.participants.Light[0]===trooper&&battleSession.extraDraws.Dark===1&&state.botForce.length===4"),true);
});

test('Crash Site Memorial stacks only subsequent losses and exchanges once per deploy phase',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(240,0);const memorial=card('Light:585'),early=card('Light:343'),later=card('Light:1995'),trade=card('Light:1593');state.hand=[memorial,trade];state.botHand=[];state.lost=[early];state.light[3]=[later];");
 assert.equal(run("requestAction('deployTableEffect','Light',[0])&&state.tableEffects[0].support.length===0&&loseTableCard('Light',3,later);openQueuedRuleResponse();requestAction('interruptResponse','Light',[0,'memorialStack'])"),true);
 assert.equal(run("requestAction('passResponse','Dark')&&requestAction('passResponse','Light')&&requestAction('memorialExchange','Light',[0,0,0])&&state.hand.includes(later)&&state.lost.includes(early)&&!memorialExchangeOptions('Light').length"),true);
});

test('Yerka Mig moves and can be canceled by the pursuing character',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(241,0);state.locationOrder=[0,1,2,3,4,5,6];const mig=card('Light:2863'),vader=card('Dark:634');state.dark[4]=[vader];state.hand=[mig];state.botHand=[];");
 assert.equal(run("requestAction('deployLocationEffect','Light',[0,3,0])&&migPowerPenalty('Dark',4)===1&&!confirmedPresence('Light',3)"),true);
 run("state.phase=4;requestAction('move','Light',[3,0,4,'Landspeed']);state.activeSide='Dark';state.botTurn={steps:[],index:0};");
 assert.equal(run("state.light[4].includes(mig)&&requestAction('apprehendMig','Dark',[0])&&state.lost.includes(mig)"),true);
});

test('the previous rules version replays Beggar paying one action and expiring immediately',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(242,0);state.game.cardRulesVersion=23;const beggar=card('Light:215'),luke=card('Light:1593');state.light[3]=[luke];state.hand=[beggar];state.botHand=[];");
 assert.equal(run("requestAction('deployLocationEffect','Light',[0,3])&&state.force.length===2&&requestAction('beggarPayment','Light')&&requestAction('finishCardInformation','Light',[2])"),true);
 assert.equal(run("spendForce('Light',3);state.force.length===1&&state.botForce.length===3&&state.botUsed.length===2&&state.lost.includes(beggar)&&!beggarCredit('Light')"),true);
});

test('Beggar counts borrowed Force across actions and loses at turn end, excluding the Jawa opponent share',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(266,0);state.game.cardRulesVersion=24;
  const beggar=card('Light:215'),jawa=card('Light:1373'),trooper=card('Light:2052');
  state.hand=[beggar,jawa,trooper];state.botHand=[];
  const borrow=n=>requestAction('beggarPayment','Light')&&requestAction('finishCardInformation','Light',[n]);`);
 assert.equal(run("requestAction('deployLocationEffect','Light',[0,3])&&borrow(1)"),true);
 run('state.botForce=[{name:"One opposing Force"}];state.force=[]');
 assert.equal(run("requestAction('deploy','Light',[0,3])"),false);
 run('state.botForce.push(...forcePile())');
 assert.ok(run("requestAction('deploy','Light',[0,3])"));
 assert.equal(run('state.botUsed.length===2&&state.beggarLoans.values().next().value.amount===1'),true);
 assert.ok(run("borrow(1)&&requestAction('deploy','Light',[0,3])"));
 assert.equal(run('state.botUsed.length===3&&!state.lost.includes(beggar)&&state.beggarLoans.values().next().value.amount===2'),true);
 assert.equal(run("state.phase=5;advance()&&state.lost.includes(beggar)&&state.beggarLoans.size===0"),true);
});

test('Organa’s necklace follows its carrier and passes after a drain',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(243,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};const jewel=card('Dark:1857'),vader=card('Dark:634'),tarkin=card('Dark:1061');state.locations[2]=card('Light:2855');state.locations[3]=card('Light:2859');state.dark[2]=[vader];state.dark[3]=[tarkin];state.hand=[];state.botHand=[jewel];");
 assert.equal(run("requestAction('deployLocationEffect','Dark',[0,2,0])&&vader.attachments.includes(jewel)&&necklaceCarriers('Dark',2).length===1"),true);
 run("state.phase=1;finishNecklaceDrain('Dark',2);");
 assert.equal(run("requestAction('finishCardInformation','Dark',['passNecklace',2])&&tarkin.attachments.includes(jewel)&&!necklaceCarriers('Dark',2).length"),true);
});

test('Central Core releases a held ship and waives Retract The Bridge without moving cards between sites',async()=>{
 const {run}=await craftHarness();
 run("setupDecks=null;state.game=PremiereGame.actionState(244,0);state.activeSide='Dark';state.botTurn={steps:[],index:0};const extra=id=>({...supplementalCatalog.find(card=>card.id===id)}),bridge=extra('Dark:2103'),beam=extra('Dark:667'),station=extra('Dark:654'),vader=card('Dark:634'),luke=card('Light:1593');state.locations[2]=card('Dark:669');state.locations[3]=card('Dark:682');state.locations[4]=card('Dark:675');state.locations[6]=station;state.locationOrder=[0,1,2,3,4,6,5];state.dark[2]=[vader];state.hand=[];state.botHand=[bridge,beam];state.botDeck=[{destiny:6},{destiny:6}];");
 assert.equal(run("requestAction('pileInterrupt','Dark',[0,'retractBridge'])&&state.botForce.length===5&&requestAction('finishCardInformation','Dark',['orderSite',3])&&requestAction('finishCardInformation','Dark',['orderSite',2])&&state.locationOrder[2]===3&&state.locationOrder[4]===4&&state.dark[2].includes(vader)"),true);
 assert.equal(run("requestAction('deployLocationEffect','Dark',[0,4])&&state.botForce.length===3"),true);
 run("const captured={...card('Light:1677'),occupants:[{card:luke,role:'pilot'}]};state.light[6]=[captured];const offer=tractorBeamOptions('Dark',{site:6})[0];settleTractorBeam({...offer,side:'Dark'});");
 assert.equal(run("captured.tractorCaptured&&state.light[4].includes(captured)"),true);
 run("state.dark[2]=[];state.light[2]=[card('Light:2052')];resolveLocationControlRules();");
 assert.equal(run("state.botLost.includes(beam)&&state.pendingCardView.mode==='tractorRelease'&&requestAction('finishCardInformation','Light',['launch'])&&state.light[6].includes(captured)&&!captured.tractorCaptured"),true);
});

const expansionCardSource = 'const expansionCard=id=>({...aNewHopeCatalog.find(card=>card.id===id)});';

test('both Undercover Effects block enemy drains and allow friendly deployment without presence',async()=>{
 for(const side of ['Light','Dark']){
  const {run}=await craftHarness();
  run(`setupDecks=null;state.game=PremiereGame.actionState(324,0);state.game.cardRulesVersion=28;${expansionCardSource}
   const owner='${side}',enemy=PremiereGame.otherSide(owner),own=PremiereGame.zones(state,owner),rival=PremiereGame.zones(state,enemy);
   const spy=card(owner==='Light'?'Light:1495':'Dark:2613'),cover=expansionCard(owner==='Light'?'Light:2673':'Dark:2672'),unit=card(owner==='Light'?'Light:2052':'Dark:2355');
   state.activeSide=owner;state.locations[3]={...dunes,icons:{light:0,dark:0}};
   own.board[3]=[spy];rival.board[3]=[card(enemy==='Dark'?'Dark:2355':'Light:2052')];
   own.hand.splice(0,own.hand.length,cover,unit);rival.hand.splice(0);`);
  assert.equal(run(`requestAction('deployTableEffect',owner,[0,0])&&spy.undercover&&spy.tableSide===enemy&&
   !confirmedPresence(owner,3)&&confirmedPresence(enemy,3)&&!forceDrainEffects(enemy,3)&&
   legalActions(state,owner).some(action=>action.kind==='deploy'&&action.args[1]===3)`),true);
  assert.match(run('renderPlaymatColumn(state.locations[3],3,false)'),/Undercover/);
  assert.equal(run(`const abandon=spyActions(owner).find(action=>action.card===spy);
   requestAction('spyAction',owner,abandon.args)&&!spy.undercover&&!spy.tableSide&&own.lost.includes(cover)&&!spy.attachments.includes(cover)`),true);
 }
});

test('Undercover moves during the opposite Move phase and cannot board a vehicle card',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(325,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const spy=card('Light:1495'),carrier=card('Dark:191');
  state.light[3]=[spy,carrier];state.locations[3]=dunes;state.locations[4]=cantina;
  state.locationOrder=[0,1,2,3,4,5,6];state.hand=[expansionCard('Light:2673')];state.botHand=[];
  requestAction('deployTableEffect','Light',[0,0]);state.phase=4;`);
 assert.equal(run("undercoverMoves('Light').length"),0);
 assert.equal(run(`state.activeSide='Dark';state.botTurn={steps:[{kind:'move'}],index:0};
  const move=undercoverMoves('Light').find(option=>option.to===4&&option.movement==='Landspeed');
  !transportOptions('Light').some(option=>option.card===spy)&&!legalActions(state,'Dark').some(action=>action.kind==='botStep')&&
  requestAction('spyAction','Light',move.args)&&state.light[4].includes(spy)&&spy.undercover&&!undercoverMoves('Light').length`),true);
});

test('U-3PO deploys under cover and Light can take him',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(326,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const spy=expansionCard('Dark:2659'),lightTrooper=card('Light:2052'),darkTrooper=card('Dark:2355');
  state.activeSide='Dark';state.botTurn={steps:[],index:0};state.hand=[];state.botHand=[spy];
  state.light[3]=[lightTrooper];state.dark[3]=[darkTrooper];`);
 assert.equal(run("!requestAction('deploy','Dark',[0,0])&&requestAction('deploy','Dark',[0,3])&&spy.undercover&&spy.tableSide==='Light'"),true);
 assert.equal(run("battleTotals(3,'Dark').lightPower===battleTotals(3).lightPower+spy.power&&battleTotals(3,'Dark').darkPower===darkTrooper.power"),true);
 assert.equal(run(`const abandon=spyActions('Dark').find(action=>action.card===spy);
  requestAction('spyAction','Dark',abandon.args)&&state.pendingCardView.side==='Light'&&
  requestAction('finishCardInformation','Light',['steal'])&&state.light[3].includes(spy)&&spy.owner==='Light'&&!spy.undercover`),true);
});

test('Treidum exposes a spy only on matching ability and supports the distinct Docking Bay site',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(327,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const spy=card('Light:1495'),officer=expansionCard('Dark:1587');
  state.hand=[expansionCard('Light:2673')];state.botHand=[];state.light[3]=[spy];state.dark[3]=[officer];
  state.locations[3]={...dunes,name:'Death Star: Docking Control Room 327'};state.locations[4]=card('Dark:675');
  requestAction('deployTableEffect','Light',[0,0]);state.phase=1;state.activeSide='Dark';state.botTurn={steps:[],index:0};`);
 assert.equal(run('battleTotals(4).darkPower'),2);
 assert.equal(run(`const detect=spyActions('Dark')[0];
  state.botDeck=[{name:'Incorrect',destiny:4}];
  requestAction('spyAction','Dark',detect.args)&&spy.undercover&&!spyActions('Dark').length`),true);
 assert.equal(run(`PremiereGame.setPhase(state,2);PremiereGame.setPhase(state,1);state.botDeck=[{name:'Correct',destiny:3}];
  requestAction('spyAction','Dark',spyActions('Dark')[0].args)&&!spy.undercover&&state.lost.some(card=>card.id==='Light:2673')`),true);
});

test('Double Agent targets spies or converts the Tonnika Sisters with their equipment',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(328,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const spy=card('Light:1495'),enemy=expansionCard('Dark:2659'),sisters=card('Dark:2613'),weapon=card('Dark:1264');
  sisters.weapons=[weapon];setUndercover(enemy,'Dark');
  state.light[3]=[spy];state.dark[3]=[enemy,sisters];state.botHand=[];
  state.hand=[expansionCard('Light:762'),expansionCard('Light:762')];state.deck=[{name:'Destiny',destiny:1}];`);
 assert.equal(run(`const removal=pileInterruptOptions('Light').find(option=>option.entry?.card===enemy);
  requestAction('pileInterrupt','Light',removal.args)&&state.botLost.includes(enemy)&&!enemy.undercover`),true);
 assert.equal(run(`const conversion=pileInterruptOptions('Light').find(option=>option.rule.mode==='tonnikaConvert');
  requestAction('pileInterrupt','Light',conversion.args)&&state.light[3].includes(sisters)&&sisters.owner==='Light'&&
  sisters.weapons.includes(weapon)&&weapon.owner==='Light'&&state.lost.length===2`),true);
});

test('Blue Milk chooses a player or cancels Juri Juice and Hypo as Lost',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(329,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const milk=expansionCard('Light:282'),juice=card('Dark:1401'),hypo=expansionCard('Dark:1200'),droid=card('Dark:816');
  state.hand=[milk];state.botHand=[];state.botDeck=[{name:'Dark reserve'}];`);
 assert.equal(run(`requestAction('pileInterrupt','Light',[0,'blueMilk',1])&&state.botForce.at(-1).name==='Dark reserve'&&state.used.includes(milk)`),true);
 assert.equal(run(`state.hand=[expansionCard('Light:282')];state.tableEffects=[{card:juice,target:'Dark'}];
  const cancel=tableCancellationOptions('Light')[0];
  requestAction('cancelTableEffect','Light',cancel.args)&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')&&
  state.botLost.includes(juice)&&state.lost.some(card=>card.id==='Light:282')`),true);
 assert.equal(run(`state.hand=[expansionCard('Light:282')];droid.attachments=[hypo];state.dark[3]=[droid];
  const destroy=namedWeaponCancellationOptions('Light')[0];
  requestAction('cancelNamedWeapon','Light',destroy.args)&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')&&
  state.botLost.includes(hypo)&&!droid.attachments.length`),true);
});

test('Out Of Commission releases eligible ships or removes a random card from one chosen pile',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(330,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const held={...ship,inactive:true,tractorCaptured:true},beam=expansionCard('Dark:667'),shot=card('Dark:1264');
  const rack={card:card('Dark:262'),target:'Dark',weapons:[shot]};
  state.phase=1;state.light[2]=[held];state.capturedShips=[{ship:held,bay:2,site:0,side:'Light',beam}];
  state.hand=[expansionCard('Light:1872'),expansionCard('Light:1872')];state.botHand=[];state.tableEffects=[rack];
  state.locations[4]=card('Dark:669');state.botLost=[card('Dark:2355')];`);
 assert.equal(run("!pileInterruptOptions('Light').some(action=>action.rule.mode==='outOfCommissionRelease')"),true);
 assert.equal(run(`state.locations[4]=cantina;const release=pileInterruptOptions('Light').find(action=>action.rule.mode==='outOfCommissionRelease');
  requestAction('pileInterrupt','Light',release.args)&&requestAction('finishCardInformation','Light',['launch'])&&
  state.light[0].includes(held)&&!held.tractorCaptured&&state.force.length===3&&state.used.filter(card=>card.id==='Light:1872').length===1`),true);
 assert.equal(run(`requestAction('pileInterrupt','Light',[0,'outOfCommissionRemove',1])&&state.outOfPlay.includes(shot)&&
  !rack.weapons.length&&state.botLost.length===1`),true);
});

test('This Is Some Rescue cancels the listed Effects and Interrupts as Used',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(331,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const rescue=expansionCard('Dark:2577'),ooc=expansionCard('Light:1872'),target=card('Dark:2355');
  state.hand=[ooc];state.botHand=[rescue];state.botLost=[target];`);
 assert.equal(run(`requestAction('pileInterrupt','Light',[0,'outOfCommissionRemove',0])&&
  requestAction('interruptResponse','Dark',[0,'named'])&&requestAction('passResponse','Light')&&requestAction('passResponse','Dark')&&
  state.lost.includes(ooc)&&state.botUsed.includes(rescue)&&state.botLost.includes(target)&&!state.outOfPlay?.includes(target)`),true);
 assert.equal(run(`['Light:1229','Light:100','Light:385'].every(id=>namedCancellation(rescue,expansionCard(id)))&&namedCancellation(rescue,card('Light:1913'))&&
  namedCancellation(rescue,{name:'Ewok Rescue',type:'Interrupt'})&&!namedCancellation(rescue,expansionCard('Light:282'))`),true);
});

test('both Kashyyyk cards apply their modifiers to the printed side',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(332,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const lightForm=expansionCard('Light:1413'),darkForm=expansionCard('Dark:1412');
  const wookiee={...card('Light:2052'),characteristics:['wookiee'],deploy:3,forfeit:6},han=card('Light:1098');
  state.locations[0]=lightForm;`);
 assert.equal(run(`crewDeployCost(han,'Light',lightForm)===han.deploy-2&&crewDeployCost(wookiee,'Light',lightForm)===1&&
  minimumBattleDestinyAbility('Dark',0)===6&&minimumBattleDestinyAbility('Light',0)===4`),true);
 assert.equal(run(`state.locations[0]=darkForm;state.dark[0]=[{...scout,owner:'Dark'}];state.light[3]=[wookiee];
  cardForfeitValueAt(wookiee,'Light',3)===3&&forceDrainEffects('Dark',0).modifier===1`),true);
 assert.equal(run(`state.dark[0]=[];state.light[0]=[ship];ship.occupants=[{card:wookiee,role:'passenger'}];
  kashyyykCrewBonus(ship,0)===2&&craftStats(ship,0).power===ship.power+2&&cardForfeitValueAt(ship,'Light',0)===ship.forfeit+2&&
  cardForfeitValueAt(wookiee,'Light',0)===6`),true);
});

test('Motti Seeker and Leia Seeker use their printed target families',async()=>{
 for(const [owner,id,kind] of [['Light','Light:1705','pilot'],['Dark','Dark:1496','warrior']]){
  const {run}=await craftHarness();
  run(`setupDecks=null;state.game=PremiereGame.actionState(333,0);state.game.cardRulesVersion=28;${expansionCardSource}
   const owner='${owner}',rival=PremiereGame.otherSide(owner),own=PremiereGame.zones(state,owner),foe=PremiereGame.zones(state,rival);
   const seeker=expansionCard('${id}'),target={...card('Light:2052'),side:rival,ability:2,pilot:false,warrior:false,${kind}:true};
   state.activeSide=owner;state.locationOrder=[0,1,2,3,4,5,6];foe.board[4]=[target];foe.hand.splice(0);own.hand.splice(0,own.hand.length,seeker);`);
  assert.equal(run(`!requestAction('deployAutomated',owner,[0,4])&&requestAction('deployAutomated',owner,[0,3])&&
   seeker.tableSide===rival&&own.force.length===4`),true);
  assert.equal(run(`state.activeSide=rival;state.phase=4;
   const move=seekerMoves(owner).find(option=>option.to===4);
   requestAction('moveSeeker',owner,move.args)&&foe.lost.includes(target)&&own.lost.includes(seeker)`),true);
 }
});

test('Arcona retreats as a React and gains power at night',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(334,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const arcona=expansionCard('Light:127');state.light[3]=[arcona];state.dark[3]=[card('Dark:2355')];
  state.locationOrder=[0,1,2,3,4,5,6];state.activeSide='Dark';state.phase=3;state.botTurn={steps:[],index:0};state.botHand=[];state.hand=[];`);
 assert.equal(run("state.nightSites=[3];battleTotals(3).lightPower===arcona.power+1"),true);
 assert.equal(run(`requestAction('battle','Dark',[3])&&legalActions(state,'Light').some(option=>option.kind==='react'&&option.args[2]===4)&&
  requestAction('react','Light',[3,0,4])&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')&&
  state.light[4].includes(arcona)`),true);
 assert.equal(run("requestAction('passResponse','Dark')&&requestAction('passResponse','Light')&&!battleSession"),true);
});

test('Luke’s Cape grants Force away from Tatooine and grants attrition immunity',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(335,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const cape=expansionCard('Light:1605'),host=card('Light:2052');state.locations[4]=card('Dark:675');
  state.light[4]=[host];state.hand=[cape];state.botHand=[];const startForce=forceFromLocations('Light').count;`);
 assert.equal(run(`requestAction('deployTableEffect','Light',[0,0])&&state.force.length===3&&
  forceFromLocations('Light').count===startForce+1&&battleImmunity('Light',host,4,[])===3`),true);
 assert.equal(run(`state.light[4]=[];state.light[3]=[host];forceFromLocations('Light').count===startForce&&
  battleImmunity('Light',host,3,[])===3`),true);
});

test('Tzizvvt flies during Deploy and retains other movement',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(336,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const flyer=expansionCard('Light:2658'),tarkin=card('Dark:1061');
  state.light[2]=[flyer];state.dark[4]=[tarkin];state.hand=[];state.botHand=[];
  state.locationOrder=[0,1,2,3,4,5,6];`);
 assert.ok(run("requestAction('move','Light',[2,0,4,'Landspeed'])"));
 assert.ok(run('state.light[4].includes(flyer)&&state.force.length===4'));
 const withTarkin=run('battleTotals(4).lightPower');
 assert.equal(withTarkin,run('state.dark[4]=[];battleTotals(4).lightPower+1'));
 assert.equal(run(`state.movedThisTurn=[];state.light[4]=[];state.light[2]=[flyer];state.phase=4;state.locations[4]=card('Dark:675');
  !requestAction('move','Light',[2,0,3,'Landspeed'])&&requestAction('move','Light',[2,0,4,'Docking-Bay-Transit'])`),true);
});

test('Saurin removes bolts and receives extra power from Sai’torr',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(337,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const saurin=expansionCard('Light:2173'),trainer=card('Light:2157'),droid=card('Light:343'),bolt=card('Dark:2099');
  state.light[3]=[saurin,droid];droid.attachments=[bolt];state.hand=[trainer];state.botHand=[];`);
 assert.equal(run(`const base=battleTotals(3).lightPower;
  requestAction('deployTableEffect','Light',[0,0])&&battleTotals(3).lightPower===base+2`),true);
 assert.equal(run(`state.phase=5;state.activeSide='Dark';const removal=weaponEffectOptions('Light').find(option=>option.args[0]==='saurinUnbolt');
  requestAction('weaponEffect','Light',removal.args)&&!PremiereUnits.restrainingBolt(droid)&&state.botLost.includes(bolt)&&state.force.length===4`),true);
});

test('Conquest peeks privately after initiating against Falcon',async()=>{
 const {run,elements}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(338,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const conquest=expansionCard('Dark:519'),falcon=card('Light:1677'),han=card('Light:1098');
  PremiereUnits.add(falcon,han,'pilot','Light');state.activeSide='Dark';state.phase=3;state.botTurn={steps:[],index:0};
  state.light[0]=[falcon];state.dark[0]=[conquest];state.hand=[{name:'Private Falcon card'}];state.botHand=[];
  const cargo=card('Dark:2160');`);
 assert.equal(run(`PremiereUnits.accepts(conquest,cargo,'cargo')&&PremiereUnits.accepts(conquest,tie,'hangar')&&
  PremiereUnits.hasDock(conquest)&&requestAction('battle','Dark',[0])&&requestAction('passResponse','Light')&&
  requestAction('interruptResponse','Dark',[-1,'conquestPeek'])&&state.pendingCardView.shown[0]===state.hand[0]`),true);
 assert.doesNotMatch(run('cardInformationMarkup([])'),/Private Falcon card/);
 assert.ok(elements.get('playmatSelection'));
 assert.equal(run("requestAction('finishCardInformation','Dark',['deck'])&&!state.pendingCardView&&requestAction('passResponse','Light')&&requestAction('passResponse','Dark')"),true);
});

test('Dark Waters dampens drains and swamp creatures protect it from Alter',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(339,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const waters=expansionCard('Dark:626'),creature=expansionCard('Dark:729');
  state.activeSide='Dark';state.botTurn={steps:[],index:0};state.botHand=[waters];state.hand=[];
  state.locations[2]={...dock,name:'Hoth: Test Site'};state.locations[4]=expansionCard('Dark:2164');
  state.light[3]=[card('Light:2052')];`);
 assert.equal(run(`!locationEffectOptions('Dark',0).some(option=>option.args[1]===2)&&
  locationEffectOptions('Dark',0).some(option=>option.args[1]===4)&&requestAction('deployLocationEffect','Dark',[0,3])&&
  forceDrainEffects('Light',3).modifier===-1&&alterTarget(waters,3)`),true);
 assert.equal(run("state.dark[3]=[creature];!alterTarget(waters,3)"),true);
});

test('ANH astromech stats and R2-Q2’s private Reserve view use the actual occupied craft',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(340,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const q2=expansionCard('Dark:1994'),t6=expansionCard('Dark:1999');
  const fighter={...scout,cardIcons:['Scomp Link']},capital=card('Dark:723');
  PremiereUnits.add(fighter,q2,'passenger','Dark');PremiereUnits.add(capital,t6,'passenger','Dark');
  state.dark[0]=[fighter,capital];state.activeSide='Dark';state.phase=5;state.botTurn={steps:[],index:0};state.botHand=[];state.hand=[];
  state.botDeck=[{name:'Fourth'},{name:'Third'},{name:'Second'},{name:'First'}];`);
 assert.equal(run(`craftStats(fighter,0).power===fighter.power+1&&craftStats(fighter,0).maneuver===fighter.maneuver+1&&
  craftStats(fighter,0).hyperspeed===fighter.hyperspeed+1&&craftStats(capital,0).power===capital.power+1&&
  craftStats(capital,0).hyperspeed===capital.hyperspeed+2&&battleImmunity('Dark',capital,0,[])===4`),true);
 assert.equal(run(`const peek=cardInformationOptions('Dark').find(option=>option.card===q2);
  requestAction('cardInformation','Dark',peek.args)&&state.pendingCardView.shown.map(card=>card.name).join(',')==='First,Second,Third'&&
  requestAction('finishCardInformation','Dark',['deck'])&&state.botDeck.at(-1).name==='First'&&state.botForce.length===4`),true);
});

test('R3-T6 doubles the Death Star movement range from Central Core',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(341,0);state.game.cardRulesVersion=28;${expansionCardSource}
  state.locations[0]=expansionCard('Dark:654');state.locations[3]=card('Dark:669');
  state.activeSide='Dark';state.phase=4;state.botTurn={steps:[],index:0};state.hand=[];state.botHand=[];`);
 assert.equal(run("!mobileSystemOptions('Dark').some(option=>option.args[1]===2)"),true);
 assert.equal(run(`state.dark[3]=[expansionCard('Dark:1999')];
  requestAction('moveMobileSystem','Dark',[0,2,-1])&&spaceParsec(state.locations[0])===2&&state.botForce.length===4`),true);
});

test('Merc Sunlet and Swilla Corey can grant theft or protect a weapon',async()=>{
 for(const [owner,id] of [['Light','Light:1668'],['Dark','Dark:2392']]){
  const {run}=await craftHarness();
  run(`setupDecks=null;state.game=PremiereGame.actionState(342,0);state.game.cardRulesVersion=28;${expansionCardSource}
   const owner='${owner}',rival=PremiereGame.otherSide(owner),self=PremiereGame.zones(state,owner),foe=PremiereGame.zones(state,rival);
   const source=card(owner==='Light'?'Light:1495':'Dark:2355'),bolt={...card('Dark:2099'),owner:rival},shot=card('Dark:1264');
   const host=card('Dark:816');host.attachments=[bolt];host.weapons=[shot];
   state.activeSide=owner;self.board[3]=[source];foe.board[3]=[host];
   self.hand.splice(0,self.hand.length,expansionCard('${id}'),expansionCard('${id}'));foe.hand.splice(0);
   self.deck.splice(0,self.deck.length,{name:'Testing destiny',destiny:0});`);
  assert.equal(run(`requestAction('deployTableEffect',owner,[0,0])&&!!spyThiefTraining(source)&&
   requestAction('deployTableEffect',owner,[0,'weapon',0])&&protectedWeapon(shot)`),true);
  assert.equal(run(`state.phase=1;const steal=controlTheftOptions(owner).find(option=>option.target?.card===bolt);
   requestAction('controlTheft',owner,steal.args)&&source.attachments.includes(bolt)&&bolt.owner===owner&&
   !controlTheftOptions(owner).some(option=>option.training)&&!spyCanSteal(owner,PremiereLocations.findEntry(state,shot))`),true);
 }
});

test('Sabotage removes or steals equipment and Informant can cancel it',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(343,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const spy=card('Light:1495'),host=card('Dark:2355'),weapon=card('Dark:1264');
  spy.characteristics.push('thief');setUndercover(spy,'Light');host.weapons=[weapon];
  state.phase=1;state.light[3]=[spy];state.dark[3]=[host];
  state.hand=[expansionCard('Light:2151'),expansionCard('Light:2151')];state.botHand=[expansionCard('Dark:1308')];
  state.deck=[{name:'Success',destiny:3}];`);
 assert.equal(run(`requestAction('pileInterrupt','Light',[0,'spySabotage',0,0])&&requestAction('interruptResponse','Dark',[0,'named'])&&
  requestAction('passResponse','Light')&&requestAction('passResponse','Dark')&&host.weapons.includes(weapon)&&state.botUsed[0].id==='Dark:1308'`),true);
 assert.equal(run(`requestAction('pileInterrupt','Light',[0,'spySabotage',0,0])&&state.pendingCardView.mode==='spySabotage'&&
  requestAction('finishCardInformation','Light',['steal'])&&spy.weapons.includes(weapon)&&weapon.owner==='Light'`),true);
});

test('Informant offers a free react for selected adjacent characters',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(344,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const spy=expansionCard('Dark:2659'),first=card('Dark:2355'),second=card('Dark:2355'),stay=card('Dark:2355');
  setUndercover(spy,'Dark');
  state.phase=3;state.light[3]=[card('Light:1495')];state.dark[3]=[spy,card('Dark:2355')];state.dark[2]=[first,stay];state.dark[4]=[second];
  state.locationOrder=[0,1,2,3,4,5,6];state.hand=[];state.botHand=[expansionCard('Dark:1308')];state.botForce=[];`);
 assert.equal(run(`requestAction('battle','Light',[3])&&requestAction('interruptResponse','Dark',[0,'informantReact'])&&
  requestAction('passResponse','Light')&&requestAction('passResponse','Dark')&&state.pendingCardView.mode==='informantReact'`),true);
 assert.equal(run(`for(const unit of [first,second]){
   const offer=cardInformationChoices(state.pendingCardView).find(option=>option.card===unit);
   requestAction('finishCardInformation','Dark',offer.args);
  }
  requestAction('finishCardInformation','Dark',['done'])&&state.dark[3].includes(first)&&state.dark[3].includes(second)&&
  state.dark[2].includes(stay)&&!state.botForce.length&&state.botUsed[0].id==='Dark:1308'`),true);
});

test('I’m Here To Rescue You resolves the ability contest and unblocks captives',async()=>{
 for(const succeeds of [true,false]){
  const {run}=await craftHarness();
  run(`setupDecks=null;state.game=PremiereGame.actionState(345,0);state.game.cardRulesVersion=28;${expansionCardSource}
   const spy=card('Light:1495'),prisoner={...card('Light:1593'),ability:4,captured:true,imprisoned:true};setUndercover(spy,'Light');
   state.locations[3]=card('Dark:673');state.light[3]=[spy];state.dark[3]=[prisoner];
   state.hand=[expansionCard('Light:1229')];state.botHand=[];state.deck=[{name:'Contest',destiny:${succeeds?2:1}}];`);
  assert.ok(run("requestAction('pileInterrupt','Light',[0,'spyRescue',0,0])"));
  if(succeeds)assert.equal(run("requestAction('custody','Light',['rally'])&&state.light[3].includes(prisoner)&&!prisoner.captured&&spy.undercover"),true);
  else assert.equal(run("requestAction('custody','Dark',['imprison'])&&state.dark[3].includes(spy)&&spy.captured&&!spy.undercover"),true);
 }
});

test('Het Nkik pays both sides and counts stormtroopers unless Reegesk is present',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(346,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const het=expansionCard('Light:1136'),reegesk=expansionCard('Dark:2075'),trooper=card('Dark:2355');
  state.hand=[het];state.botHand=[];state.dark[3]=[trooper];`);
 assert.ok(run("requestAction('deploy','Light',[0,3])&&state.force.length===3&&state.botForce.length===3"));
 const withTrooper=run('battleTotals(3).lightPower');
 assert.equal(withTrooper,run('state.dark[3].push(reegesk);battleTotals(3).lightPower+1'));
});

test('Hunchback searches a neighboring drainer’s Force Pile privately',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(347,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const hunch=expansionCard('Light:1189'),target={name:'Sense and a Backup Plan'},miss={name:'Secret other card'};
  state.phase=1;state.activeSide='Dark';state.botTurn={steps:[],index:0};state.locationOrder=[0,1,2,3,4,5,6];
  state.hand=[];state.botHand=[];state.botForce=[target,miss];
  state.light[2]=[hunch];state.dark[3]=[card('Dark:2355')];`);
 assert.equal(run(`requestAction('drain','Dark',[3])&&requestAction('interruptResponse','Light',[-1,'hunchback',0])&&
  state.force.length===4&&state.pendingCardView.side==='Light'&&!state.pendingCardView.publicView`),true);
 assert.equal(run(`!requestAction('finishCardInformation','Light',['remove',0])&&requestAction('finishCardInformation','Light',['remove',1])&&
  state.botForce[0]===miss&&state.outOfPlay.includes(target)&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')`),true);
});

test('Jawa Ion Gun steals droids or excludes ordinary characters',async()=>{
 for(const targetDroid of [true,false]){
  const {run}=await craftHarness();
  run(`setupDecks=null;state.game=PremiereGame.actionState(348,0);state.game.cardRulesVersion=28;${expansionCardSource}
   const jawa=expansionCard('Light:1136'),gun=expansionCard('Light:1377'),target=card('${targetDroid?'Dark:816':'Dark:2355'}');
   state.phase=3;state.light[3]=[jawa];jawa.weapons=[gun];state.dark[3]=[target,card('Dark:634')];
   state.hand=[];state.botHand=[];state.deck=[{name:'Matched',destiny:${targetDroid?'target.forfeit':'target.ability'}}];`);
  assert.equal(run(`requestAction('battle','Light',[3]);const shot=battleWeaponOptions('Light').find(option=>option.target===target);
   shot.cost===1&&requestAction('fireWeapon','Light',shot.args)`),true);
  if(targetDroid)assert.equal(run("state.light[3].includes(target)&&target.owner==='Light'"),true);
  else assert.equal(run("excludedAtBattle(target,3)&&!battleCandidates('Dark',3).includes(target)&&state.dark[3].includes(target)"),true);
 }
});

test('Jawa Blaster explodes on zero destiny',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(349,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const jawa=card('Dark:1372'),gun=expansionCard('Dark:1376'),target=card('Light:2052');
  state.phase=3;state.activeSide='Dark';state.botTurn={steps:[],index:0};jawa.weapons=[gun];
  state.light[3]=[target];state.dark[3]=[jawa,card('Dark:634')];state.hand=[];state.botHand=[];state.botDeck=[{name:'Zero',destiny:0}];`);
 assert.equal(run(`requestAction('battle','Dark',[3]);const shot=battleWeaponOptions('Dark').find(option=>option.weapon===gun);
  shot.cost===0&&requestAction('fireWeapon','Dark',shot.args)&&state.botLost.includes(gun)&&state.botLost.includes(jawa)&&state.light[3].includes(target)`),true);
});

test('Reegesk pays a Force loss before taking eligible salvage',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(350,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const scavenger=expansionCard('Dark:2075'),salvage=card('Light:259'),capitalGun=card('Light:2835');
  state.phase=1;state.activeSide='Dark';state.botTurn={steps:[],index:0};state.dark[3]=[scavenger];
  state.lost=[salvage,capitalGun];state.botHand=[];state.hand=[];`);
 assert.equal(run(`const choices=controlTheftOptions('Dark');
  choices.length===1&&requestAction('controlTheft','Dark',choices[0].args,false)&&state.pendingForceLoss.reason==='reegesk'&&state.lost.includes(salvage)`),true);
 assert.equal(run(`requestAction('loseForce','Dark',['force'])&&state.botLost.length===1&&state.botHand.includes(salvage)&&
  salvage.owner==='Dark'&&state.lost.includes(capitalGun)&&!controlTheftOptions('Dark').length`),true);
});

test('Corellian reduces one Rebel equipment deployment each turn',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(351,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const corellian=expansionCard('Light:529'),rebel=card('Light:1495');
  state.light[3]=[corellian,rebel];state.hand=[card('Light:265'),card('Light:265')];state.botHand=[];`);
 assert.equal(run(`const first=legalActions(state,'Light').find(option=>option.kind==='equip'&&option.host===rebel);
  first.cost===1&&requestAction('equip','Light',first.args)&&state.force.length===4`),true);
 assert.equal(run(`const second=legalActions(state,'Light').find(option=>option.kind==='equip'&&option.host===rebel);
  second.cost===2&&requestAction('equip','Light',second.args)&&state.force.length===2`),true);
});

test('Scanner support applies immunity and correct hand thresholds',async()=>{
 for(const [owner,id,scan,mode,count] of [['Light','Light:2174','Light:2011','radar',14],['Dark','Dark:1198','Dark:2176','scanning',13]]){
  const {run}=await craftHarness();
  run(`setupDecks=null;state.game=PremiereGame.actionState(352,0);state.game.cardRulesVersion=28;${expansionCardSource}
   const owner='${owner}',rival=PremiereGame.otherSide(owner),self=PremiereGame.zones(state,owner),opposing=PremiereGame.zones(state,rival);
   const support=expansionCard('${id}'),scanner=card('${scan}'),victim=card(owner==='Light'?'Dark:2355':'Light:2052');
   state.activeSide=owner;self.board[0]=[ship];opposing.board[3]=[card(rival==='Light'?'Light:1495':'Dark:634')];
   self.hand.splice(0,self.hand.length,support,scanner);opposing.hand.splice(0,opposing.hand.length);
   requestAction('deployTableEffect',owner,[0]);opposing.hand.push(card(rival==='Light'?'Light:2217':'Dark:2216'),victim);
   while(opposing.hand.length<${count})opposing.hand.push({name:'Other card',type:'Device'});
   const responses=counterResponses(rival,{kind:'interrupt',side:owner,card:scanner,interrupt:'pileInterrupt',rule:{mode:'${mode}'}});
   `);
  assert.equal(run(`!responses.some(answer=>answer.kind==='sense')&&requestAction('pileInterrupt',owner,[0,'${mode}'])&&
   state.pendingCardView.scannerPenalty&&requestAction('finishCardInformation',owner,['done'])&&opposing.lost.includes(victim)`),true);
 }
});

test('Sensor Panel improves its vehicle and adds an optional Radar Scanner target',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(353,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const speeder=card('Light:1609'),driver=card('Light:1593'),panel=expansionCard('Light:2222'),counter=card('Dark:94');
  PremiereUnits.add(speeder,driver,'driver','Light');state.light[3]=[speeder];state.hand=[panel,card('Light:2011')];state.botHand=[counter];
  const before=craftStats(speeder,3);`);
 assert.equal(run(`requestAction('deployDevice','Light',[0,3,0])&&craftStats(speeder,3).power===before.power+1&&
  craftStats(speeder,3).landspeed===before.landspeed+1&&requestAction('pileInterrupt','Light',[0,'radar'])`),true);
 assert.equal(run(`requestAction('finishCardInformation','Light',['sensor',0])&&state.botUsed.includes(counter)&&
  state.force.length===2&&!sensorPanelSources('Light').length`),true);
});

test('Imperial Justice chooses a single function and leaves drain icons intact',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(354,0);state.game.cardRulesVersion=28;${expansionCardSource}
  state.activeSide='Dark';state.phase=2;state.botTurn={steps:[],index:0};
  state.locations=state.locations.map(loc=>({...loc,icons:{light:1,dark:0}}));
  state.hand=[];state.botHand=[expansionCard('Dark:1275'),expansionCard('Dark:1275')];const before=forceFromLocations('Light').count;`);
 assert.equal(run(`requestAction('deployLocationEffect','Dark',[0,3,'generation'])&&forceFromLocations('Light').count===before-1&&
  PremiereLocations.icons(state,3,'Light')===1`),true);
 assert.equal(run(`requestAction('deployLocationEffect','Dark',[0,4,'revolution'])&&forceFromLocations('Light').count===before-1&&
  state.locationEffects[3][0].justiceMode==='generation'&&state.locationEffects[4][0].justiceMode==='revolution'`),true);
 assert.equal(run(`state.hand=[card('Light:2110')];state.botTurn=null;state.activeSide='Light';
  revolutionOptions('Light',0).includes(3)&&!revolutionOptions('Light',0).includes(4)`),true);
});

test('Both pilot ejection Effects replace permanent pilots with capacity',async()=>{
 for(const [owner,id,targetId,pilotId] of [
  ['Light','Light:819','Dark:2600','Dark:1279'],['Dark','Dark:487','Light:2838','Light:1098'],
 ]){
  const {run}=await craftHarness();
  run(`setupDecks=null;state.game=PremiereGame.actionState(355,0);state.game.cardRulesVersion=28;${expansionCardSource}
   const owner='${owner}',rival=PremiereGame.otherSide(owner),self=PremiereGame.zones(state,owner),foe=PremiereGame.zones(state,rival);
   const fighter=card('${targetId}'),pilot=card('${pilotId}'),eject=expansionCard('${id}');
   state.activeSide=owner;foe.board[0]=[fighter];self.hand.splice(0,self.hand.length,eject,expansionCard('${id}'));foe.hand.splice(0);
   self.deck.splice(0,self.deck.length,{name:'Success',destiny:3},{name:'Failed',destiny:2});`);
  assert.equal(run(`const ejectOffer=()=>tableEffectOptions(owner).find(option=>option.host===fighter);
   requestAction('deployTableEffect',owner,ejectOffer().args)&&self.lost.includes(eject)&&permanentPilotAbility(fighter)===1`),true);
  assert.equal(run(`requestAction('deployTableEffect',owner,ejectOffer().args)&&permanentPilotAbility(fighter)===null&&
   !craftStats(fighter,0).powered&&PremiereUnits.accepts(fighter,pilot,'pilot')&&self.force.length===3`),true);
  assert.equal(run(`PremiereUnits.add(fighter,pilot,'pilot',rival);craftStats(fighter,0).powered`),true);
 }
});

test('Both shuffle musicians can privately peek or reshuffle',async()=>{
 for(const [owner,id,interrupt,choice] of [
  ['Light','Light:1752','Light:2514','peek'],['Dark','Dark:2490','Dark:1831','reshuffle'],
 ]){
  const {run}=await craftHarness();
  run(`setupDecks=null;state.game=PremiereGame.actionState(356,0);state.game.cardRulesVersion=28;${expansionCardSource}
   const owner='${owner}',rival=PremiereGame.otherSide(owner),self=PremiereGame.zones(state,owner),foe=PremiereGame.zones(state,rival);
   const musician=expansionCard('${id}'),partner=card('Light:942'),shuffle=card('${interrupt}');
   state.activeSide=owner;self.board[3]=[musician];foe.board[3]=[partner];
   self.hand.splice(0,self.hand.length,shuffle);foe.hand.splice(0);foe.used.push({name:'one'},{name:'two'},{name:'three'});`);
  assert.equal(run(`requestAction('shufflePile',owner,[0,rival,'used'])&&state.pendingCardView.count===1&&!state.pendingCardView.shown.length`),true);
  assert.ok(run(`requestAction('finishCardInformation',owner,['${choice}'])`));
  if(choice==='peek')assert.equal(run(`state.pendingCardView.shown[0]===foe.used.at(-1)&&!state.pendingCardView.publicView&&
   requestAction('finishCardInformation',owner,['done'])`),true);
  assert.equal(run('self.used.includes(shuffle)&&foe.used.length===3'),true);
 }
});

test('Zutton reduces the total once before a battle destiny draw',async()=>{
 const {run}=await craftHarness();
 run(`setupDecks=null;state.game=PremiereGame.actionState(357,0);state.game.cardRulesVersion=28;${expansionCardSource}
  const zutton=expansionCard('Light:2916');state.phase=3;state.activeSide='Dark';state.botTurn={steps:[],index:0};
  state.light[3]=[zutton];state.dark[3]=[{...card('Dark:2355'),ability:6}];
  state.hand=[];state.botHand=[];state.botDeck=[{name:'Destiny',destiny:4}];`);
 assert.equal(run(`requestAction('battle','Dark',[3])&&requestAction('destiny','Dark')&&
  PremiereGame.responseWindow(state.game).kind==='beforeBattleDestiny'&&state.botDeck.length===1`),true);
 assert.equal(run(`requestAction('interruptResponse','Light',[-1,'zutton',0])&&requestAction('passResponse','Dark')&&
  !legalActions(state,'Light').some(option=>option.responseKind==='zutton')&&requestAction('passResponse','Light')&&
  battleSession.darkDestiny===3&&state.force.length===4`),true);
});

async function anhHarness(){
 const fixture=await craftHarness();
 fixture.run(`setupDecks=null;state.game=PremiereGame.actionState(400,0);state.game.cardRulesVersion=29;
 const anh=id=>({...aNewHopeCatalog.find(card=>card.id===id)});state.hand=[];state.botHand=[];`);
 return fixture;
}

test('ANH Leader targets attack-run fighters and improves ordinary weapon destiny',async()=>{
 const {run}=await anhHarness();
 run("const fighter=card('Light:2838');state.locations[0]=anh('Dark:654');state.locations[3]=anh('Light:681');state.light[3]=[fighter];state.dark[3]=[tie];state.attackRun={card:anh('Light:169'),site:3,system:0,light:[fighter],dark:[tie],lead:fighter};state.botHand=[anh('Dark:1230')];state.botDeck=[{destiny:6}];");
 assert.ok(run("requestAction('pileInterrupt','Dark',[0,'leaderKill',0])&&state.lost.includes(fighter)&&!state.attackRun&&state.dark[0].includes(tie)"));
});

test('ANH control firing resolves costs, optional shooter bonus and immediate hits',async()=>{
 for(const [owner,id,shooterId,targetId,weaponId] of [['Light','Light:2308','Light:1098','Dark:2355','Light:259'],['Dark','Dark:2290','Dark:2683','Light:2052','Dark:1264']]){
  const {run}=await anhHarness();
  run(`const owner='${owner}',foe=PremiereGame.otherSide(owner),shooter={...(catalog.find(card=>card.id==='${shooterId}')??aNewHopeCatalog.find(card=>card.id==='${shooterId}'))},target=card('${targetId}');shooter.weapons=[card('${weaponId}')];PremiereGame.zones(state,owner).board[3]=[shooter];PremiereGame.zones(state,foe).board[3]=[target];PremiereGame.zones(state,owner).hand.push(anh('${id}'));state.activeSide=owner;state.phase=1;PremiereGame.zones(state,owner).deck.push({destiny:6});`);
  assert.ok(run("const shot=pileInterruptOptions(owner).find(option=>option.rule.mode==='controlFire');shot&&requestAction('pileInterrupt',owner,shot.args)&&PremiereGame.zones(state,foe).lost.includes(target)&&PremiereGame.zones(state,owner).force.length===4&&!battleSession"),owner);
 }
});

test('ANH Dianoga attacks select a side then random prey and remember the last meal',async()=>{
 const {run}=await anhHarness();
 run("const creature=anh('Dark:729'),victim=card('Light:2052');state.locations[3]={...state.locations[3],name:'Death Star: Trash Compactor'};state.dark[3]=[creature];state.light[3]=[victim];state.activeSide='Dark';state.phase=3;state.botDeck=[{destiny:6}];presentGame=()=>{};");
 assert.ok(run("const attack=creatureActions('Dark').find(option=>option.args[0]==='creatureEat');requestAction('anhCharacter','Dark',attack.args)&&requestAction('finishCardInformation','Dark',['Light'])&&requestAction('finishCardInformation','Dark',['pass'])&&requestAction('finishCardInformation','Light',['pass'])&&state.lost.includes(victim)&&creature.lastMealPower===victim.power&&!state.creatureAttack&&!battleSession"));
 assert.ok(run("!creatureActions('Dark').some(action=>action.args[0]==='creatureEat')&&PremiereWeapons.defense(creature,0)===5&&!battleCandidates('Dark',3).includes(creature)"));
});

test('ANH epic rooms require control and leaders for the printed positive bonus',async()=>{
 const {run}=await anhHarness();
 run("state.locations[3]=anh('Light:2851');state.light[3]=[anh('Light:2048')];state.locations[4]=anh('Dark:670');state.dark[4]=[anh('Dark:1284')];");
 assert.equal(run("epicRoomBonus('attackRun')"),1);
 assert.equal(run("epicRoomBonus('ignition')"),1);
 assert.equal(run("state.light[3]=[card('Light:2052')];epicRoomBonus('attackRun')"),0);
 assert.equal(run("state.dark[3]=[card('Dark:2355')];state.light[3]=[];epicRoomBonus('attackRun')"),-1);
});

test('ANH Maneuver Check resolves each departing opposing starfighter',async()=>{
 const {run}=await anhHarness();
 run("const fighter=card('Light:2907');state.locations[0]=anh('Dark:654');state.locations[3]=anh('Light:681');state.light[3]=[fighter];state.locationEffects={3:[{card:anh('Dark:1640')}]};state.attackRun={card:anh('Light:169'),site:3,system:0,light:[fighter],dark:[]};state.deck=[{destiny:0}];pullUpAttackRun(false);");
 assert.ok(run('state.lost.includes(fighter)&&!state.attackRun&&!state.light[0].includes(fighter)'));
});

test('ANH Dantooine diversion blocks ignition until the mobile system arrives',async()=>{
 const {run}=await anhHarness();
 run("state.locations[6]=anh('Dark:654');state.hand=[anh('Light:2563')];");
 assert.ok(run("requestAction('anhCharacter','Light',['dantooine',0,0])&&PremiereGame.wasUsed(state.game,'game','dantooine')&&state.locationEffects[0][0].target===state.locations[6]"));
 assert.ok(run("state.mobileSystems={'Dark:654':{parsec:1,orbit:0}};progressLocationMissions();!state.locationEffects[0].length&&!epicActions('Light').some(action=>action.args[0]==='dantooine')"));
});

test('ANH All Clear cancels the leader and ejects only one actual TIE',async()=>{
 const {run}=await anhHarness();
 run("state.locations[0]=anh('Dark:654');state.locations[3]=anh('Light:681');const squadron=anh('Dark:2596'),fighter=card('Dark:2600'),red=anh('Light:2061');PremiereUnits.add(red,card('Light:1593'),'pilot','Light');state.dark[3]=[squadron,fighter];state.light[3]=[red];state.attackRun={site:3,system:0,lead:red,light:[red],dark:[squadron,fighter],bonus:0};state.hand=[anh('Light:2892')];");
 assert.ok(run("const options=pileInterruptOptions('Light').filter(option=>option.rule.mode==='allClearRun');options.length===1&&options[0].target===fighter&&requestAction('pileInterrupt','Light',options[0].args)&&state.dark[0].includes(fighter)&&state.attackRun.bonus===1&&state.used.some(card=>card.id==='Light:2892')"));
});

test('ANH Gold 2 sacrifices itself to save another hit starfighter',async()=>{
 const {run}=await anhHarness();
 run("state.locations[3]=anh('Light:681');const gold=anh('Light:1047'),target=card('Light:2838');state.light[3]=[gold,target];state.pendingCardView={mode:'goldRescue',side:'Light',card:gold,gold,target,site:3,shown:[],resume:()=>{}};");
 assert.ok(run("requestAction('finishCardInformation','Light',['sacrifice'])&&state.lost.includes(gold)&&state.light[3].includes(target)"));
});

test('ANH Red 5 and Tiree apply matching pilot and Attack Run bonuses',async()=>{
 const {run}=await anhHarness();
 run("const red=anh('Light:2061'),gold=anh('Light:1047'),tiree=anh('Light:2611'),luke=card('Light:1593');state.locations[3]=anh('Light:681');PremiereUnits.add(red,luke,'pilot','Light');PremiereUnits.add(gold,tiree,'pilot','Light');state.light[3]=[red,gold];");
 assert.equal(run("battleImmunity('Light',red,0,[])"),4);
 assert.equal(run('craftStats(red,0).maneuver'),run('red.maneuver+2'));
 assert.equal(run('craftStats(gold,0).maneuver'),run('gold.maneuver+1'));
 assert.equal(run('attackRunBonus({site:3,lead:red,bonus:0})'),2);
});

test('ANH Tech and Gunner bonuses accumulate and their searches pay with the source',async()=>{
 for(const [owner,id,locId,searchId] of [['Light','Light:2050','Light:2857','Light:681'],['Dark','Dark:657','Dark:669','Dark:2378']]){
  const {run}=await anhHarness();
  run(`const owner='${owner}',source=anh('${id}');state.locations[3]=${owner==='Light'?"card('Light:2859')":"card('Dark:669')"};PremiereGame.zones(state,owner).board[3]=[source,{...source}];state.activeSide=owner;state.phase=1;PremiereGame.zones(state,owner).deck.splice(0,Infinity,anh('${searchId}'));`);
  assert.equal(run(owner==='Light'?'attackRunBonus({site:0,lead:ship,bonus:0})':'ignitionBonus()'),owner==='Light'?2:4);
  assert.ok(run("const search=unitReserveSearchOptions(owner)[0];requestAction('unitReserveSearch',owner,search.args)"),owner+' starts search');
  assert.ok(run("PremiereGame.zones(state,owner).used.includes(source)"),owner+' pays source');
  assert.ok(run("requestAction('takeFromReserve',owner,[0])"),owner+' chooses');
  assert.ok(run("PremiereGame.zones(state,owner).hand[0].id==='"+searchId+"'"),owner+' receives target');
 }
});

test('ANH Attack Run selects a lead and wingmen before cover fire',async()=>{
 const {run}=await anhHarness();
 run("state.locations[0]=anh('Dark:654');state.locations[3]=anh('Light:681');const fighter=card('Light:2838'),torpedo=card('Light:1962'),event=anh('Light:169');fighter.weapons=[torpedo];state.light[0]=[fighter];state.dark[0]=[];state.locationEffects={3:[{card:event}]};state.phase=4;state.deck=[{destiny:4},{destiny:4}];");
 assert.ok(run("requestAction('anhCharacter','Light',['attackRun',3])&&requestAction('finishCardInformation','Light',['toggle',0])&&requestAction('finishCardInformation','Light',['done'])&&requestAction('finishCardInformation','Dark',['done'])&&requestAction('finishCardInformation','Light',[0])&&state.pendingCardView.mode==='runCover'"));
 assert.ok(run("requestAction('finishCardInformation','Dark',['pass'])&&requestAction('finishCardInformation','Light',['pass'])&&requestAction('finishCardInformation','Light',[1])&&!state.attackRun&&state.light[0].includes(fighter)&&!state.light[3].includes(fighter)"));
});

test('ANH Primary Ignition pays site cost and lets the opponent choose Z',async()=>{
 const {run}=await anhHarness();
 run("state.locations[0]=anh('Dark:654');const laser=anh('Dark:2378');state.locationWeapons={0:[laser]};state.mobileSystems={'Dark:654':{parsec:1,orbit:6}};state.locations[3]=card('Dark:673');state.locations[4]=card('Dark:669');state.phase=1;state.activeSide='Dark';state.botHand=[anh('Dark:508')];state.botDeck=[{destiny:6}];");
 assert.ok(run("const ignition=epicActions('Dark').find(action=>action.args[0]==='primaryIgnition');ignition.cost===1&&requestAction('anhCharacter','Dark',ignition.args)&&state.pendingCardView.mode==='ignitionZ'&&requestAction('finishCardInformation','Light',[1])&&state.botUsed.some(card=>card.id==='Dark:508')&&!state.locations[6].blownAway"));
});

test('ANH recharging conceals eight Force cards and returns them on cancellation',async()=>{
 const {run}=await anhHarness();
 run("state.locations[0]=anh('Dark:654');const laser=anh('Dark:2378'),effect=anh('Light:509');state.locationWeapons={0:[laser]};state.hand=[effect];");
 assert.ok(run("const offer=tableEffectOptions('Light')[0];requestAction('deployTableEffect','Light',offer.args)&&state.tableEffects[0].support.length===0&&requestAction('anhCharacter','Dark',['chargeSuperlaser'])&&state.tableEffects[0].support.length===1"));
 assert.ok(run("const recharge=state.tableEffects[0],stored=recharge.support[0];cancelTableEffect(recharge);state.botUsed.includes(stored)&&state.lost.includes(effect)"));
});

test('ANH Superlaser deploys only at parsec zero and targets capitals',async()=>{
 const {run}=await anhHarness();
 run("state.activeSide='Dark';state.locations[0]=anh('Dark:654');state.botHand=[anh('Dark:2378')];");
 assert.ok(run("weaponDeployOptions('Dark',0).length===1&&requestAction('equip','Dark',[0,0,-1])&&state.locationWeapons[0][0].id==='Dark:2378'"));
 assert.equal(run("weaponShot(state.locationWeapons[0][0],state.locations[0],card('Light:530'),5).cost"),4);
 assert.equal(run("weaponShot(state.locationWeapons[0][0],state.locations[0],tie,3)"),null);
});

test('ANH Trench restricts deployment and changes maneuver and weapon cost',async()=>{
 const {run}=await anhHarness();
 run("state.locations[0]=anh('Dark:654');state.locations[3]=anh('Light:681');");
 assert.equal(run("boardDeployCost(card('Light:2052'),state.locations[3],'Light')"),null);
 assert.equal(run("craftStats(card('Light:2838'),3,true).maneuver"),run("card('Light:2838').maneuver-2"));
});

test('ANH Tractor Beam holds crewed ships and releases them when its holder loses the device',async()=>{
 const {run}=await anhHarness();
 run("const holder=card('Dark:723'),beam=anh('Dark:2620'),target=card('Light:530'),crew=card('Light:1098');holder.attachments=[beam];PremiereUnits.add(target,crew,'pilot','Light');state.dark[0]=[holder];state.light[0]=[target];state.botDeck=[{destiny:6}];settleTractorBeam({side:'Dark',card:beam,holder,target,bay:0,site:0});");
 assert.ok(run("state.capturedShips[0].holder===holder&&target.inactive&&state.botDeck.length===0"));
 assert.ok(run("loseTableCard('Dark',0,beam);updateCapturedStarships();state.pendingCardView.mode==='tractorRelease'&&releaseCapturedStarship(state.capturedShips[0],true)&&!target.inactive"));
});

test('ANH Besieged isolates trapped crew and selected attacking characters',async()=>{
 const {run}=await anhHarness();
 run("const holder=card('Dark:723'),beam=anh('Dark:2620'),target=card('Light:530'),crew=card('Light:1098'),attacker=card('Dark:634'),stay=card('Dark:1279');holder.attachments=[beam];PremiereUnits.add(holder,attacker,'pilot','Dark');PremiereUnits.add(holder,stay,'passenger','Dark');PremiereUnits.add(target,crew,'pilot','Light');target.inactive=true;target.attachments=[anh('Dark:223')];state.dark[0]=[holder];state.light[0]=[target];state.capturedShips=[{holder,ship:target,beam,bay:0,site:0,side:'Light'}];state.activeSide='Dark';state.phase=3;");
 assert.ok(run("requestAction('anhCharacter','Dark',['besieged',0])&&requestAction('finishCardInformation','Dark',['toggle',0])&&requestAction('finishCardInformation','Dark',['fight'])&&battleSession.participants.Dark.length===1&&battleSession.participants.Dark[0]===attacker&&battleSession.participants.Light[0]===crew&&!battleSession.participants.Dark.includes(holder)"));
});

test('ANH We Have A Prisoner replaces a paid battle forfeit with capture',async()=>{
 const {run}=await anhHarness();
 run("const target=card('Light:2052');state.light[3]=[target];state.botHand=[anh('Dark:2754')];state.phase=3;presentGame=()=>{};battleSession={site:3,segmented:true,segment:'damage',participants:{Light:[target],Dark:[]},weaponHits:{Light:[],Dark:[]},damage:{priority:'Light',passes:0,result:{lightTotal:0,darkTotal:4},debt:{Light:{damage:4,attrition:2,hits:[],immunity:[]}}}};const originalForfeit=target.forfeit;requestAction('battleForfeit','Light',[0]);");
 assert.ok(run("requestAction('interruptResponse','Dark',[0,'anhResponse','captureBattle'])&&requestAction('passResponse','Light')&&requestAction('passResponse','Dark')&&target.captured&&!state.lost.includes(target)&&state.pendingCustody[0].card===target&&battleSession.damage.debt.Light.damage===Math.max(0,4-originalForfeit)"));
});

test('ANH Cell 2187 releases chosen captives after its target arrives',async()=>{
 const {run}=await anhHarness();
 run("const spy=card('Light:1495'),hostage={...card('Light:2052'),captured:true,imprisoned:true};state.locations[3]=card('Dark:673');state.light[4]=[spy];state.dark[3]=[hostage];state.hand=[anh('Light:385')];state.deck=[{destiny:1}];");
 assert.ok(run("requestAction('deployLocationEffect','Light',[0,3,0]);state.light[4]=[];state.light[3]=[spy];progressLocationMissions();state.pendingCardView.mode==='cellRescue'&&requestAction('finishCardInformation','Light',[0])&&requestAction('custody','Light',['rally'])&&!hostage.captured&&state.light[3].includes(hostage)"));
});

test('ANH Spice Mines completes only with its designated captive and escort',async()=>{
 const {run}=await anhHarness();
 run("const escort=card('Dark:2355'),hostage={...card('Light:2052'),captured:true};escort.escortedCaptive=hostage;state.dark[3]=[escort];state.activeSide='Dark';state.botHand=[anh('Dark:2330')];state.botLost=[{name:'One'},{name:'Two'}];");
 assert.ok(run("const mission=prisonerMissionActions('Dark')[0];requestAction('anhCharacter','Dark',mission.args);state.dark[3]=[];PremiereUnits.add(ship,escort,'passenger','Dark');state.dark[1]=[ship];progressLocationMissions();state.lost.includes(hostage)&&!escort.escortedCaptive&&!state.botLost.some(card=>card.name==='One')"));
});

test('ANH holosites use destiny values and suspend ordinary text',async()=>{
 for(const id of ['Light:694','Dark:1274']){
  const {run}=await anhHarness();
  run(`state.locations[3]=anh('${id}');const molator=card('Dark:1688');state.dark[3]=[molator];`);
  assert.ok(run("isHoloUnit(molator)&&cardAbility(molator)===molator.destiny&&cardForfeitValueAt(molator,'Dark',3)===molator.destiny&&battleTotals(3).darkPower===molator.destiny&&!activeCardRules(molator,'tableEffect').length"));
  assert.equal(run("boardDeployCost(card('Light:2052'),state.locations[3],'Light')"),null);
  assert.ok(run("const back=holoAndBluffActions('Dark').find(action=>action.card===molator);requestAction('anhCharacter','Dark',back.args)&&state.botHand.includes(molator)"));
 }
});

test('ANH Bluffs conceal cards and distinguish legal free deployment from loss',async()=>{
 const {run}=await anhHarness();
 run("state.locations[3]=anh('Dark:2438');state.phase=2;state.activeSide='Dark';state.dark[3]=[card('Dark:1279')];state.botHand=[card('Dark:2355')];");
 assert.ok(run("requestAction('anhCharacter','Dark',['placeBluff',3,0])&&PremiereGame.playerView(state,'Light').locations[3].bluffs[0].faceDown&&!holoAndBluffActions('Dark').some(action=>action.args[0]==='placeBluff')"));
 assert.ok(run("requestAction('anhCharacter','Light',['challengeBluff',3,0])&&requestAction('finishCardInformation','Dark',['deploy'])&&state.dark[3].some(card=>card.id==='Dark:2355')"));
});

test('ANH Laser Gate blocks passage and is a weapon target from either side',async()=>{
 const {run}=await anhHarness();
 run("state.locations[2]=card('Dark:669');state.locations[3]=card('Dark:673');state.locationOrder=[2,3,0,1,4,5,6];const gate=anh('Dark:1478'),weak=card('Light:2052'),strong=card('Light:1593');state.locationEffects={2:[{card:gate,gateTo:3}]};");
 assert.ok(run("laserGateBlocks(weak,'Light',2,3)&&!laserGateBlocks(strong,'Light',2,3)&&weaponTargets('Dark',2,true).some(target=>target.card===gate)&&weaponTargets('Dark',3,true).some(target=>target.card===gate)"));
 assert.equal(run("weaponShot(card('Light:259'),strong,gate,3).defense"),3);
});

test('ANH Hypo asks a truthful question or grants a drain bonus',async()=>{
 const {run}=await anhHarness();
 run("const it0=anh('Dark:1340'),hypo=anh('Dark:1200'),hostage={...card('Light:2052'),captured:true};it0.attachments=[hypo];it0.escortedCaptive=hostage;state.dark[3]=[it0];state.activeSide='Dark';state.phase=1;state.hand=[card('Light:1593')];");
 assert.ok(run("const ask=advancedDeviceActions('Dark').find(option=>option.args[3]==='question');requestAction('anhCharacter','Dark',ask.args)&&requestAction('finishCardInformation','Dark',['Light:1593'])&&cardInformationChoices(state.pendingCardView)[0].args[0]==='yes'&&!cardInformationChoices(state.pendingCardView).some(option=>option.args[0]==='no')&&requestAction('finishCardInformation','Light',['yes'])"));
});

test('ANH crawler sites follow their host and lose their contents with it',async()=>{
 for(const [owner,id,crawlerId] of [['Light','Light:2165','Light:2161'],['Dark','Dark:2164','Dark:2160']]){
  const {run}=await anhHarness();
  run(`const owner='${owner}',crawler=card('${crawlerId}'),interior=anh('${id}');state.activeSide=owner;PremiereGame.zones(state,owner).board[3]=[crawler];PremiereGame.zones(state,owner).hand.push(interior);`);
  assert.ok(run("const offer=vehicleSiteActions(owner)[0];requestAction('anhCharacter',owner,offer.args)&&interior.hostInstanceId===crawler.instanceId"));
  assert.ok(run("const inside=state.locations.indexOf(interior);PremiereLocations.conditions(state,inside,owner).night&&adjacentSites(inside,3)&&!sitePlanet(interior)"));
  run("const jawa=card(owner==='Light'?'Light:1373':'Dark:1372');PremiereGame.zones(state,owner).board[inside]=[jawa];");
  assert.equal(run('cardForfeitValueAt(jawa,owner,inside)'),run('jawa.forfeit+2'));
  assert.ok(run("loseTableCard(owner,3,crawler)&&!state.locations[inside]&&PremiereGame.zones(state,owner).lost.includes(interior)&&PremiereGame.zones(state,owner).lost.includes(jawa)"));
 }
});

test('ANH Rogue Bantha tramples before optional battle responses',async()=>{
 const {run}=await anhHarness();
 run("const rogue=anh('Light:2125'),trampledRaider=card('Dark:2648');state.phase=3;state.light[3]=[rogue,card('Light:2052')];state.dark[3]=[trampledRaider,card('Dark:2355')];");
 assert.equal(run('cardAbility(rogue)'),0.5);
 assert.ok(run("requestAction('battle','Light',[3])&&state.pendingCardView.mode==='rogueTrample'&&requestAction('finishCardInformation','Light',[0])&&state.botLost.includes(trampledRaider)"));
});

test('ANH squadrons transfer optional crew and send replaced cards to Used',async()=>{
 for(const [owner,id,fighterId,pilotId] of [['Light','Light:2908','Light:2907','Light:1098'],['Dark','Dark:2596','Dark:2600','Dark:1279']]){
  const {run}=await anhHarness();
  run(`const owner='${owner}',squadron=anh('${id}'),originals=Array.from({length:3},()=>card('${fighterId}')),pilot=card('${pilotId}');
   state.activeSide=owner;PremiereGame.zones(state,owner).hand.push(squadron);PremiereGame.zones(state,owner).board[0]=originals.slice();
   PremiereUnits.add(originals[0],pilot,'pilot',owner);`);
  assert.ok(run("const formation=formationActions(owner)[0];formation&&requestAction('anhCharacter',owner,formation.args)&&state.pendingCardView.mode==='squadronTransfer'"));
  if(owner==='Light')assert.ok(run("const transfer=squadronTransferChoices(state.pendingCardView).find(choice=>choice.entry?.card===pilot);requestAction('finishCardInformation',owner,transfer.args)"));
  assert.ok(run("requestAction('finishCardInformation',owner,['done'])&&originals.every(ship=>PremiereGame.zones(state,owner).used.includes(ship))&&craftStats(squadron,0).powered&&cardAbility(squadron)===3&&!PremiereUnits.fighter(squadron)"));
  assert.ok(run(owner==='Light'?"squadron.occupants[0].card===pilot":"PremiereGame.zones(state,owner).used.includes(pilot)"));
 }
});

test('ANH suction devices compare ability and let the owner choose destination',async()=>{
 for(const [owner,id,crawlerId,targetId] of [['Light','Light:1619','Light:2161','Dark:2355'],['Dark','Dark:1618','Dark:2160','Light:2052']]){
  const {run}=await anhHarness();
  run(`const owner='${owner}',foe=PremiereGame.otherSide(owner),crawler=card('${crawlerId}'),tube=anh('${id}'),target=card('${targetId}');
   crawler.attachments=[tube];PremiereGame.zones(state,owner).board[3]=[crawler];PremiereGame.zones(state,foe).board[3]=[target];state.activeSide=owner;state.phase=1;PremiereGame.zones(state,owner).deck.push({destiny:6});`);
  assert.ok(run("const action=advancedDeviceActions(owner).find(option=>option.target===target);requestAction('anhCharacter',owner,action.args)&&requestAction('finishCardInformation',owner,['used'])&&PremiereGame.zones(state,foe).used.includes(target)&&!advancedDeviceActions(owner).length"));
 }
});

test('ANH Remote grants one temporary bonus or cancels a seeker',async()=>{
 const {run}=await anhHarness();
 run("const remote=anh('Light:2082'),rebel=card('Light:2052');state.light[3]=[remote,rebel];state.phase=1;const before=cardForfeitValueAt(rebel,'Light',3);");
 assert.ok(run("const action=advancedDeviceActions('Light').find(option=>option.args[3]==='forfeit');requestAction('anhCharacter','Light',action.args)&&cardForfeitValueAt(rebel,'Light',3)===before+1&&!advancedDeviceActions('Light').length"));
 assert.equal(run("state.game.timing.turn++;cardForfeitValueAt(rebel,'Light',3)"),run('before'));
});

test('ANH Program Trap counts the whole site but explodes only among present characters',async()=>{
 const {run}=await anhHarness();
 run("const crawler=card('Light:2161'),droid=card('Light:1995'),passenger=card('Light:2052'),outside=card('Dark:2355'),trap=anh('Dark:1955');droid.attachments=[trap];PremiereUnits.add(crawler,droid,'passenger','Light');PremiereUnits.add(crawler,passenger,'passenger','Light');state.light[3]=[crawler];state.dark[3]=[outside];state.deck=[{destiny:3}];drawDestinySeries('Light','test',1,0,()=>{});");
 assert.ok(run("state.lost.includes(droid)&&state.lost.includes(passenger)&&state.botLost.includes(trap)&&state.dark[3].includes(outside)&&state.light[3].includes(crawler)"));
});

test('ANH extinguisher prevents explosions and protects its ship',async()=>{
 const {run}=await anhHarness();
 run("const droid=card('Light:1995'),trap=anh('Dark:1955'),extinguisher=anh('Light:943');droid.attachments=[trap,extinguisher];state.light[3]=[droid];state.deck=[{destiny:1}];drawDestinySeries('Light','test',1,0,()=>{});");
 assert.ok(run("state.light[3].includes(droid)&&state.botLost.includes(trap)&&droid.attachments.includes(extinguisher)"));
 assert.ok(run("PremiereUnits.add(ship,droid,'passenger','Light');state.light[0]=[ship];state.light[3]=[];fireExtinguisherProtects(ship)&&weaponShot(anh('Light:2389'),tie,ship,5)===null"));
});

test('ANH Chewbacca repairs hits and receives Han and Falcon bonuses',async()=>{
 const {run}=await anhHarness();
 run("const chewie=anh('Light:394'),han=card('Light:1098'),droid=card('Light:1995'),falcon=card('Light:1677');state.light[3]=[chewie,han,droid];");
 assert.equal(run("cardPowerModifier(chewie,'Light',3)"),1);
 assert.ok(run("PremiereUnits.add(falcon,chewie,'pilot','Light');craftStats(falcon,0).maneuver===falcon.maneuver+1"));
 assert.ok(run("battleSession={site:3,hitUnits:{Light:[droid],Dark:[]}};loseTableCard('Light',3,droid)&&state.used.includes(droid)&&!state.lost.includes(droid)"));
});

test('ANH Felth changes interrupt destination and accident chooser',async()=>{
 const {run}=await anhHarness();
 run("const felth=anh('Dark:2635'),look=card('Dark:1576');state.dark[3]=[felth];");
 assert.ok(run("felthMakesUsed({name:'Look Sir, Droids'})"));
 assert.equal(run("state.dark[3]=[];felthMakesUsed({name:'Look Sir, Droids'})"),false);
});

test('ANH Evader cancels revolutions and rescues eligible recent losses',async()=>{
 const {run}=await anhHarness();
 run("state.botHand=[anh('Dark:891')];state.locationEffects={3:[{card:card('Light:2110'),target:state.locations[3]}]};");
 assert.ok(run("requestAction('pileInterrupt','Dark',[0,'evaderRevolutions'],false)&&!state.locationEffects[3].length&&state.pendingForceLoss.payer==='Light'&&state.botUsed[0].id==='Dark:891'"));
 run("state.pendingForceLoss=null;state.botHand=[anh('Dark:891')];const vader=card('Dark:634');state.botLost.push(vader);PremiereGame.openResponse(state.game,{kind:'characterLost',side:'Dark',fallen:vader,site:3});");
 assert.ok(run("requestAction('passResponse','Light')&&requestAction('interruptResponse','Dark',[0,'anhResponse','evaderRecovery'])&&requestAction('passResponse','Light')&&requestAction('passResponse','Dark')&&state.botUsed.includes(vader)"));
});

test('ANH Wookiee Roar supports defense, search and mouse droids',async()=>{
 const {run}=await anhHarness();
 run("state.hand=[anh('Light:2824')];state.dark[3]=[card('Dark:1709')];");
 assert.ok(run("const roar=pileInterruptOptions('Light').find(option=>option.rule.mode==='roarMouse');requestAction('pileInterrupt','Light',roar.args)&&state.botLost.some(card=>card.id==='Dark:1709')"));
 run("state.hand=[anh('Light:2824')];state.deck=[anh('Light:394')];");
 assert.ok(run("requestAction('pileInterrupt','Light',[0,'roarSearch'])&&requestAction('takeFromReserve','Light',[0])&&state.hand[0].id==='Light:394'"));
});

test('ANH Let The Wookiee Win disarms after an eligible lost battle',async()=>{
 const {run}=await anhHarness();
 run("const chewie=anh('Light:394'),target=card('Dark:2355'),gun=card('Dark:1264');target.weapons=[gun];state.light[3]=[chewie];state.dark[3]=[target];state.hand=[anh('Light:1507')];PremiereGame.openResponse(state.game,{kind:'finishedBattle',winner:'Dark',side:'Dark',site:3,participants:{Light:[chewie],Dark:[target]}});");
 assert.ok(run("requestAction('interruptResponse','Light',[0,'anhResponse','wookieDisarm',0])&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')&&PremiereWeapons.disarmed(target)&&state.botLost.includes(gun)"));
});

test('ANH Brainiac keeps irrational destiny and dynamic values',async()=>{
 const {run}=await anhHarness();
 run("const brainiac=anh('Light:319');state.hand=[brainiac];state.botHand=[{},{}];state.locations=state.locations.map(loc=>({...loc,icons:{light:0,dark:0}}));state.light[3]=[brainiac];");
 assert.equal(run('printedBattleDestiny(brainiac)'),Math.PI);
 assert.equal(run('brainiacPower()'),Math.sqrt(3+Math.PI));
 assert.equal(run("crewDeployCost(brainiac,'Light',state.locations[3])"),1);
 assert.equal(run("cardForfeitValueAt(brainiac,'Light',3)"),2);
});

test('ANH R2D2 chooses destiny and offers Scomp reactions',async()=>{
 const {run}=await anhHarness();
 run("state.deck=[anh('Light:1992')];let chosen;drawDestinySeries('Light','test',1,1,draws=>chosen=draws[0].value);");
 assert.ok(run("chosen===undefined&&state.pendingCardView.mode==='destinyValue'&&requestAction('finishCardInformation','Light',[5])&&chosen===6"));
 run("const artoo=anh('Light:1992');state.locations[3]=card('Light:676');state.light[3]=[artoo];state.botDeck=[{destiny:2}];const before=state.force.length;drawDestinySeries('Dark','test',1,0,()=>{});");
 assert.ok(run("state.pendingCardView.mode==='anhDestinyTrigger'&&requestAction('finishCardInformation','Light',['accept'])&&state.force.length===before"));
});

test('ANH Clakdor and Kiffex modify only qualifying states',async()=>{
 const {run}=await anhHarness();
 run("state.locations[0]=anh('Light:416');state.light[0]=[ship];const bith=card('Light:942');");
 assert.equal(run('clakdorDestinyModifier(bith)'),2);
 run("state.locations[0]=anh('Dark:1434');state.dark[0]=[tie,{...tie}];");
 assert.equal(run("kiffexPower('Dark',0)"),2);
 assert.equal(run("tonnikaFactor(card('Dark:2613'))"),run("locationTitle(card('Dark:2613'))==='tonnika sisters'?2:1"));
 assert.equal(run("state.dark[0].push({...tie});kiffexPower('Dark',0)"),0);
});

test('ANH Krayt bones resolves every numbered destiny consequence',async()=>{
 for(const n of [0,1,2,3,4,5,6]){
  const {run}=await anhHarness();
  run(`const bones=anh('Dark:1453');state.tableEffects=[{card:bones,target:'Dark'}];state.deck=[{name:'Draw',destiny:${n}}];
   state.botUsed=[{name:'Used'}];state.botLost=[{name:'Lost'}];state.botHand=[];let finished=false;const before=state.botForce.length;
   state.game.executing=true;drawDestinySeries('Light','test',1,0,()=>finished=true);state.game.executing=false;`);
  if(n===0)assert.ok(run("finished&&state.botHand[0].name==='Used'"));
  if(n===1)assert.ok(run("!finished&&requestAction('loseForce','Dark',['force'],false)&&finished&&state.botLost.length===2"));
  if(n===2)assert.ok(run('finished&&state.botForce.length===before+1'));
  if(n===3)assert.ok(run('finished&&!state.tableEffects.length&&state.botLost.includes(bones)'));
  if(n===4)assert.ok(run("finished&&!state.botLost.length&&state.botUsed.at(-1).name==='Lost'"));
  if(n>=5)assert.ok(run('finished'));
 }
});

test('ANH Bad Feeling and Ngok answer completed actions',async()=>{
 for(const [owner,id,enemy] of [['Light','Light:1214','Dark:2355'],['Dark','Dark:1770','Light:2052']]){
  const {run}=await anhHarness();
  run(`const owner='${owner}',foe=PremiereGame.otherSide(owner),own=PremiereGame.zones(state,owner),rival=PremiereGame.zones(state,foe);
   state.activeSide=foe;own.hand.push(anh('${id}'));const group=Array.from({length:4},()=>card('${enemy}'));rival.board[3]=group;
   state.deploymentLocations=group.map(card=>({card,site:3,side:foe,turn:state.game.timing.turn}));
   openDeploymentReaction(foe,[group[3]]);`);
  assert.ok(run("requestAction('interruptResponse',owner,[0,'anhResponse','prohibitBattle'])&&requestAction('passResponse',foe)&&requestAction('passResponse',owner)&&!battleCandidates(foe,3).length"),id);
 }
});

test('ANH transport retaliation and smuggler stop respect response timing',async()=>{
 for(const [owner,id,transport,targetId] of [['Light','Light:1987','Dark:824','Dark:2355'],['Dark','Dark:1844','Light:1749','Light:2052']]){
  const {run}=await anhHarness();
  run(`const owner='${owner}',foe=PremiereGame.otherSide(owner),own=PremiereGame.zones(state,owner),rival=PremiereGame.zones(state,foe);
   const mover=card('${transport}'),target=card('${targetId}');own.hand.push(anh('${id}'));rival.board[3]=[target];rival.used.push(mover);
   PremiereGame.openResponse(state.game,{kind:'transportCompleted',side:foe,site:3,card:mover,targets:[target]});`);
  assert.ok(run("requestAction('interruptResponse',owner,[0,'anhResponse','transportRetaliation'])&&requestAction('passResponse',foe)&&requestAction('passResponse',owner)&&rival.lost.includes(mover)"),id);
  assert.ok(run(owner==='Light'?'rival.lost.includes(target)':'target.captured'),id);
 }
});

test('ANH Alternatives cancels space battles and frees captured crews',async()=>{
 const {run}=await anhHarness();
 run("state.phase=3;state.light[0]=[ship];state.dark[0]=[tie];state.hand=[anh('Light:100')];");
 assert.ok(run("requestAction('battle','Light',[0])&&requestAction('passResponse','Dark')&&requestAction('interruptResponse','Light',[0,'anhResponse','cancelBattle'])&&requestAction('passResponse','Dark')&&requestAction('passResponse','Light')&&state.force.length===1&&!battleSession"));
 run("state.phase=2;state.hand=[anh('Light:100')];const trapped=card('Light:2052');ship.inactive=true;PremiereUnits.add(ship,trapped,'passenger','Light');state.capturedShips=[{ship,side:'Light',bay:0,site:0,beam:anh('Dark:667')}];");
 assert.ok(run("const escape=pileInterruptOptions('Light').find(option=>option.rule.mode==='escapeCapturedShip');requestAction('pileInterrupt','Light',escape.args)&&state.light[escape.site].includes(trapped)&&!ship.occupants.length"));
});

test('ANH squad leaders share movement cost and free guards',async()=>{
 for(const owner of ['Light','Dark']){
  const {run}=await anhHarness();
  run(`const owner='${owner}',leader=anh(owner==='Light'?'Light:2048':'Dark:1284'),troops=Array.from({length:3},()=>card(owner==='Light'?'Light:2052':'Dark:2355'));
   state.activeSide=owner;state.phase=4;state.locationOrder=[0,1,2,3,4,5,6];PremiereGame.zones(state,owner).board[3]=[leader,...troops];`);
  assert.equal(run('cardForfeitValueAt(troops[0],owner,3)'),run('troops[0].forfeit+1'));
  assert.ok(run("const squad=squadMovementActions(owner).find(option=>option.to===4);requestAction('anhCharacter',owner,squad.args)&&PremiereGame.zones(state,owner).force.length===4&&PremiereGame.zones(state,owner).board[4].length===4"));
 }
});

test('ANH Advosze receives equipment kickbacks and rejects voluntary collisions',async()=>{
 const {run}=await anhHarness();
 run("state.activeSide='Dark';const advosze=anh('Dark:67'),warrior=card('Dark:2355');state.dark[3]=[advosze,warrior];state.botHand=[card('Dark:1264'),anh('Dark:67')];const initial=state.botDeck.length;");
 assert.ok(run("const equip=legalActions(state,'Dark').find(action=>action.kind==='equip');requestAction('equip','Dark',equip.args)&&state.botDeck.length===initial-1"));
 assert.ok(run("!legalActions(state,'Dark').some(action=>action.kind==='deploy'&&action.args[1]===3)"));
});

test('ANH Lirin cover charge counts present musicians and preserves free movement',async()=>{
 const {run}=await anhHarness();
 run("const lirin=anh('Dark:1558'),musician=card('Light:942'),rebel=card('Light:2052');state.dark[3]=[lirin];state.light[3]=[musician];state.light[2]=[rebel];state.locationOrder=[0,1,2,3,4,5,6];");
 assert.equal(run('crewDeployCost(rebel,\'Light\',state.locations[3])'),run('rebel.deploy+1'));
 assert.equal(run("travelOptions(rebel,'Light',2,3)[0].cost"),2);
});

test('ANH Septoid absorbs damage without leaving until exhausted or hit',async()=>{
 const {run}=await anhHarness();
 run(`const droid=anh('Dark:2784');state.phase=3;state.dark[3]=[droid];
  battleSession={site:3,segmented:true,segment:'damage',participants:{Dark:[droid],Light:[]},weaponHits:{Light:[],Dark:[]},
   damage:{priority:'Dark',passes:0,result:{lightTotal:3,darkTotal:0},debt:{Dark:{damage:3,attrition:2,hits:[],immunity:[]}}}};`);
 assert.ok(run("battleDamageAction('Dark','battleForfeit',[0])&&state.dark[3].includes(droid)&&cardForfeitValueAt(droid,'Dark',3)===4&&battleSession.damage.debt.Dark.damage===0"));
 run("battleSession.damage.priority='Dark';battleSession.damage.debt.Dark.damage=5;");
 assert.ok(run("battleDamageAction('Dark','battleForfeit',[0])&&state.botLost.includes(droid)"));
});

test('ANH grabbers enforce uniqueness and escalating costs after resolution',async()=>{
 for(const [id,tax] of [['Light:1062',false],['Light:2802',true],['Dark:2505',false],['Dark:2555',true]]){
  const {run}=await anhHarness();
  run(`const grabber=anh('${id}'),owner=grabber.side,opponent=PremiereGame.otherSide(owner);
   const own=PremiereGame.zones(state,owner),foe=PremiereGame.zones(state,opponent),played=card(opponent==='Dark'?'Dark:1831':'Light:2514');
   own.hand.push(grabber);foe.hand.push(played);foe.used.push({name:'Shuffle me'});
   state.activeSide=opponent;`);
  assert.ok(run("requestAction('shufflePile',opponent,[0,opponent,'used'])&&requestAction('interruptResponse',owner,[0,'grabInterrupt'])"),id);
  assert.ok(run("requestAction('passResponse',opponent)&&requestAction('passResponse',owner)&&state.tableEffects[0].support.includes(played)&&!foe.used.includes(played)"),id);
  run("foe.hand.push({...played});");
  if(tax)assert.ok(run("const next=legalActions(state,opponent).find(action=>action.kind==='shufflePile');next.interruptSurcharge===2"),id);
  else assert.ok(run("!legalActions(state,opponent).some(action=>action.kind==='shufflePile')"),id);
 }
});

test('ANH Advance Preparation pays the selected cost before retrieval',async()=>{
 const {run}=await anhHarness();
 run("state.hand=[anh('Light:64'),anh('Light:169')];const recovery={name:'Recover me'};state.lost=[recovery];");
 assert.ok(run("requestAction('pileInterrupt','Light',[0,'advancePrepare',1])&&state.outOfPlay[0].id==='Light:169'&&state.used.includes(recovery)"));
 run("state.hand=[anh('Light:64')];const attack=anh('Light:169');state.lost=[attack];");
 assert.ok(run("requestAction('pileInterrupt','Light',[0,'advanceRecover'])&&state.force.length===2&&state.used.includes(attack)&&state.lost[0].id==='Light:64'"));
});

test('ANH shuttle vehicles expose range and free orbit transfers',async()=>{
 for(const id of ['Light:1298','Dark:227']){
  const {run}=await anhHarness();
  run(`const shuttle=anh('${id}'),owner=shuttle.side,crew=card(owner==='Light'?'Light:2052':'Dark:2355'),capital=card(owner==='Light'?'Light:530':'Dark:723');
   state.activeSide=owner;state.phase=4;state.locations[0]=tatooine;PremiereGame.zones(state,owner).board[0]=[capital];PremiereGame.zones(state,owner).board[3]=[shuttle,crew];`);
  assert.equal(run('craftStats(shuttle,3).powered'),true);
  assert.equal(run('cardAbility(shuttle)'),1);
  assert.ok(run("const action=shuttleVehicleActions(owner).find(action=>action.target===crew);requestAction('anhCharacter',owner,action.args)&&capital.occupants[0].card===crew"));
 }
});
test('ANH RA7 transfers character weapons without paying deploy costs',async()=>{
 const {run}=await anhHarness();
 run("const droid=anh('Light:2006'),soldier=card('Light:2052'),weapon=card('Light:265');soldier.weapons=[weapon];state.light[3]=[droid,soldier];");
 assert.ok(run("const action=weaponEffectOptions('Light').find(action=>action.args[0]==='transfer'&&action.target.host===droid);action.cost===0&&requestAction('weaponEffect','Light',action.args)&&droid.weapons.includes(weapon)"));
});
test('ANH Solomahal grants scout skill to a warrior and exposes legal reacts',async()=>{
 const {run}=await anhHarness();
 run("const soldier=card('Light:2052');state.light[2]=[soldier];state.hand=[anh('Light:2298')];");
 assert.ok(run("requestAction('deployTableEffect','Light',[0,0])&&PremiereUnits.hasSkill(soldier,'scout')"));
 assert.ok(run("state.locationOrder=[0,1,2,3,4,5,6];reactOptions('Light',{kind:'battle',side:'Dark',site:3}).some(option=>option.card===soldier)"));
});
test('ANH Floater requires an eligible participant for its free react',async()=>{
 const {run}=await anhHarness();
 run("const floater=anh('Dark:1685'),driver=card('Dark:2355');PremiereUnits.add(floater,driver,'driver','Dark');state.dark[2]=[floater];state.dark[3]=[card('Dark:1061')];state.locationOrder=[0,1,2,3,4,5,6];");
 assert.ok(run("!reactOptions('Dark',{kind:'battle',side:'Light',site:3}).length"));
 assert.ok(run("state.dark[3]=[card('Dark:2613')];reactOptions('Dark',{kind:'battle',side:'Light',site:3})[0].cost===0"));
});

test('ANH Binary droid can be switched by either player',async()=>{
 const {run}=await anhHarness();
 run("const binary=anh('Light:1674'),trooper=card('Light:2052');state.light[3]=[binary,trooper];state.locationOrder=[0,1,2,3,4,5,6];");
 assert.equal(run("cardForfeitValueAt(trooper,'Light',3)"),run('trooper.forfeit+2'));
 assert.ok(run("requestAction('anhCharacter','Dark',['binary',0])&&binary.switchedOff&&state.botForce.length===4"));
 assert.equal(run("cardForfeitValueAt(trooper,'Light',3)"),run('trooper.forfeit'));
 assert.ok(run("requestAction('anhCharacter','Light',['binary',0])&&!binary.switchedOff"));
});
test('ANH Hem Dazon keeps salt concealed and loses it with his card',async()=>{
 const {run}=await anhHarness();
 run("const hem=anh('Dark:1126'),salt=card('Dark:634');state.dark[3]=[hem];state.botHand=[salt];state.activeSide='Dark';");
 assert.ok(run("requestAction('anhCharacter','Dark',['salt',0,'hand',0])&&hem.salt[0]===salt&&!anhCharacterActions('Dark').length"));
 assert.equal(run("PremiereGame.playerView(state,'Light').players.Dark.board[3][0].salt[0].name"),undefined);
 assert.equal(run("battleTotals(3).darkPower"),2);
 assert.ok(run("loseTableCard('Dark',3,hem)&&state.botLost.includes(salt)&&!hem.salt"));
});
test('ANH Defel hides only at night and causes loss at a revolved site',async()=>{
 const {run}=await anhHarness();
 run("const defel=anh('Dark:687');defel.weapons=[card('Dark:1264')];state.dark[3]=[defel,card('Dark:2355')];state.light[3]=[card('Light:1495')];state.phase=3;state.activeSide='Dark';state.botTurn={steps:[],index:0};requestAction('battle','Dark',[3]);");
 assert.equal(run("anhCharacterActions('Dark').length"),0);
 assert.ok(run("state.nightSites=[3];requestAction('anhCharacter','Dark',['hide',1])&&battleSession.excludedUnits.has(defel)"));
});
test('ANH Greedo offers a genuine threat payment choice',async()=>{
 const {run}=await anhHarness();
 run("const greedo=anh('Dark:1073'),han=card('Light:1098');state.dark[3]=[greedo];state.light[3]=[han];state.phase=1;state.botDeck=[{destiny:6}];");
 assert.ok(run("requestAction('anhCharacter','Dark',['threat',1,0])&&state.pendingCardView.side==='Light'"));
 assert.ok(run("requestAction('finishCardInformation','Light',['risk'])&&state.lost.includes(han)"));
});
test('ANH Dannik consumes only a just lost opposing non-droid once per battle',async()=>{
 const {run}=await anhHarness();
 run("const dannik=anh('Dark:605'),victim=card('Light:1495');state.dark[3]=[dannik,card('Dark:634')];state.light[3]=[victim,card('Light:1593')];state.phase=3;requestAction('battle','Light',[3]);loseTableCard('Light',3,victim);openQueuedRuleResponse();");
 assert.ok(run("requestAction('interruptResponse','Dark',[-1,'eatSoup',0])&&state.outOfPlay.includes(victim)&&state.soupAbility[dannik.id]===3"));
 assert.equal(run("anhLostResponses('Dark',PremiereGame.responseWindow(state.game)).length"),0);
});
