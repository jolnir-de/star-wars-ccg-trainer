import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const base=['data','game','battle','units','locations','card-rules','weapons','bot','learning','session'].map(name=>'premiere-'+name);
const hoth=['rules','card-rules','session','interrupts','creatures','mines','timing'].map(name=>'hoth-'+name);
const dagobah=['rules','card-rules','session','jedi','space','creatures','units','effects','weapons','locations','interrupts','timing','abilities','passives'].map(name=>'dagobah-'+name);
export function harness(extra=[],jp=false){
 const context=vm.createContext({console,structuredClone,Math,Set,Map,publishGame(){},render(){}});
 vm.runInContext(read('v3/engine/drain-explanation.js'),context);
 for(const name of new Set([...base,...hoth,...dagobah,...['rules','card-rules','session','space','sabacc','captives','devices','freezing','locations','weather-vane','units','weapons','effects','abilities','reacts','interrupts','battle','duels','storage','timing','layout','support','captive-battle','reactions','answers','information','drains','nabrun','limits','bot',...extra].map(name=>'cloud-city-'+name)]))vm.runInContext(read('v3/engine/'+name+'.js'),context);
 if(jp)for(const name of ["rules","card-rules","session","layout","units","abilities","locations","creatures","weapons","devices","effects","sabacc","interrupts","battle","captives","storage","support","reacts","vehicles","timing","combinations","answers","droids","numbers","attacks","personas","choices","mindscan","bot"])vm.runInContext(read('v3/engine/jabbas-palace-'+name+'.js'),context);
 context.payloads=['premiere','a-new-hope','hoth','dagobah','cloud-city',...(jp?['jabbas-palace']:[])].map(name=>JSON.parse(read('v3/data/'+name+'.json')));
 const run=(code,timeout)=>vm.runInContext(code,context,timeout?{timeout}:undefined);
 run(`catalog=payloads.flatMap((payload,i)=>PremiereData.readCatalog(payload,String(i+1)));let serial=0;
 const card=id=>{const source=catalog.find(card=>card.id===id);if(!source)throw Error('Unknown card '+id);return {...structuredClone(source),instanceId:'cloud-test-'+(++serial),owner:source.side}};
 const pile=(side='Light',count=20)=>Array.from({length:count},()=>card(side==='Light'?'Light:259':'Dark:1264'));
 const game=PremiereGame.actionState(100,7);game.cardRulesVersion=35;game.playFormat=CloudCityRules.FORMAT;game.playerSide='Light';
 state=PremiereGame.createState(game,[],[],['Light:438','Dark:447','Light:229','Light:464','Light:226'].map(card),[0,1,2,3,4],'Light');
 state.locations[2].cloudCityPlanet='bespin';state.locations[3].cloudCityPlanet='bespin';state.force=pile();state.botForce=pile('Dark');state.deck=pile();state.botDeck=pile('Dark');PremiereGame.setPhase(state,2);`);
 if(jp)run('state.game.playFormat=JabbasPalaceRules.FORMAT');
 return {run,set(name,value){context[name]=value;}};
}
