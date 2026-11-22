import test from 'node:test';
import {checkSavedSteps} from './support/anh-save-harness.mjs';
const action=(side,mode,expect)=>({kind:'hothAction',side,where:`action.mode==='cc:jp:${mode}'`,expect});
const choose=(side,args,expect,privateFor)=>({kind:'finishCardInformation',side,args,expect,privateFor});
const cases=[{
 name:'Holoprojector private search survives reload and JSON import',phase:1,
 setup:`locations(['Light:1354']);const r2=put('Light',0,'Light:136');r2.attachments=[take('Light:1151')];top('Light','Light:1956');`,
 steps:[action('Light','holo',"state.pendingCardView.mode==='hothDagSearch'"),choose('Light',[0],"state.hand.some(c=>c.id==='Light:1956')")]
},{
 name:'Shasa’s private Force Pile reorder resumes during the opponent’s turn',phase:1,active:'Dark',
 setup:`locations(['Light:1354']);put('Light',0,'Light:2247');`,
 steps:[action('Light','reorderForce',"state.pendingCardView.mode==='hothDagCloudJPOrder'"),...Array.from({length:8},(_,i)=>choose('Light',[0],i===7?'!state.pendingCardView':undefined,i===7?undefined:'Dark'))]
},{
 name:'Leia’s free captive deployment preserves custody after every action',
 setup:`locations(['Dark:1357']);put('Dark',0,'Dark:1346');put('Light',0,'Light:2052');hand('Light','Light:1945');`,
 steps:[action('Light','leiaCaptive',"state.dark[0][0].escortedCaptive?.id==='Light:1945'&&state.dark[0][0].escortedCaptive.captured")]
},{
 name:'Dungeon release of frozen Leia retains retrieval and all 120 cards',phase:1,
 setup:`locations(['Dark:1356']);put('Light',0,'Light:2052');const captive=put('Dark',0,'Light:1945');captive.captured=true;captive.frozen=true;captive.imprisoned=true;captive.controller='Dark';`,
 steps:[action('Light','dungeonRelease',"state.light[0].some(c=>c.id==='Light:1945'&&!c.captured&&!c.frozen)")]
},{
 name:'Thermal Detonator resumes at R2-D2’s area-destiny choice',active:'Dark',
 setup:`locations(['Dark:1357']);const hunter=put('Dark',0,'Dark:287');hunter.weapons=[take('Dark:2556')];put('Light',0,'Light:1992');top('Dark','Dark:1264','Dark:264','Dark:620');`,
 steps:[action('Dark','detonate',"state.pendingCardView.mode==='hothDagCloudJPAreaDestiny'"),choose('Light',[5],"!state.pendingCardView&&state.light[0].some(c=>c.id==='Light:1992')")]
}];
for(const spec of cases)test('Jabba’s Palace autosave: '+spec.name,()=>checkSavedSteps({...spec,format:'premiere-a-new-hope-hoth-dagobah-cloud-city-jabbas-palace',rulesVersion:34}));
