import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {buildWeb,v3SourceAssets} from '../scripts/build-web.mjs';
import data from '../v3/engine/premiere-data.js';
const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root),'utf8');
const sha=body=>createHash('sha256').update(body.replaceAll('\r\n','\n')).digest('hex');
const lock=JSON.parse(await read('v3/v2-baseline.json'));

test('The stable V2 source and all its game inputs retain their release baseline',async()=>{
 assert.equal(lock.commit,'c85d8ff9a2e864c05dc83e5394516ca6a57effa4');assert.equal(lock.publishedRevision,'86c5d193b834d79d');
 for(const file of lock.sources)assert.equal(sha(await read(file.path)),file.sha256,'V2 must remain unchanged: '+file.path);
});

test('V3 has independent modules, decks, storage keys and a distinct save format',async()=>{
 const html=await read('v3.html');assert.match(html,/const saveKey='swccg\.v3\.autosave'/);assert.match(html,/const saveVersion=3;/);assert.match(html,/const autoBotKey='swccg\.v3\.autoBot'/);
 assert.doesNotMatch(html,/swccg\.v2\./);assert.doesNotMatch(html,/(?:src="|readLocalJson\(')(?:engine|data)\//);
 assert.match(html,/href="v2.html"/);assert.match(await read('v3/assets/playfield-views.js'),/swccg\.v3\.tableView/);
 for(const path of v3SourceAssets){assert.ok(path.startsWith('v3/'));assert.ok((await read(path)).length>0);}
});

test('All six V3 catalogs and every V3 deck choice pass the isolated V3 validator',async()=>{
 const names=['premiere','a-new-hope','hoth','dagobah','cloud-city','jabbas-palace'],catalogs=[];
 for(const [index,name]of names.entries())catalogs.push(data.readCatalog(JSON.parse(await read('v3/data/'+name+'.json')),String(index+1)));
 assert.equal(catalogs.flat().length,1188);
 const starters=JSON.parse(await read('v3/data/premiere-starter-decks.json')),themes=JSON.parse(await read('v3/data/premiere-themed-decks.json'));
 for(const [index,name]of names.entries()){
  const format=names.slice(0,index+1).join('-'),variants=JSON.parse(await read('v3/data/'+(index<2?'play-format-decks':name+'-decks')+'.json'));
  const choices=data.readFormatDeckChoices(format,starters,themes,variants,catalogs.slice(0,index+1).flat());
  for(const side of ['light','dark']){assert.ok(choices[side].length>=8,format+' '+side+' retains its eight theme choices');for(const choice of choices[side])assert.equal(choice.deck.cards.length,60);}
 }
});

test('The combined release preserves every stable V2 game file and bounds independent V3 downloads',async()=>{
 const output=await mkdtemp(join(tmpdir(),'swccg-v3-release-'));
 try{
  const release=await buildWeb(output),files=new Map(release.files.map(file=>[file.path,file]));
  for(const file of lock.files)assert.equal(files.get(file.path)?.sha256,file.sha256,'Published V2 file changed: '+file.path);
  assert.deepEqual(release.variants,{v2:{version:'2.19.3',entry:'v2.html',status:'stable'},v3:{version:'3.0.0-preview.1',entry:'v3.html',status:'preview'}});
  assert.equal(files.has('v3/v2-baseline.json'),false);assert.equal(files.has('V3_TODO.md'),false);
  const game=await readFile(join(output,'v3.html'),'utf8');assert.equal((game.match(/<script src="v3\/engine\/[^\"]+\.[a-f0-9]{12}\.js"/g)??[]).length,10);
  const startup=new Set([...game.matchAll(/(?:src|href)="((?:v3\/engine|v3\/assets|assets)\/[^"?]+)(?:\?[^\"]*)?"/g)].map(m=>m[1]));
  for(const name of ['premiere','premiere-starter-decks','premiere-themed-decks','premiere-supplemental-cards','play-format-decks','a-new-hope','deck-overview'])startup.add(release.files.find(f=>new RegExp('^v3/data/'+name+'\\.[a-f0-9]+\\.json$').test(f.path)).path);
  const initial=release.files.filter(f=>f.path==='v3.html'||startup.has(f.path));
  assert.ok(initial.every(f=>!/^engine\/|^data\/|collector-|cloud-city|jabbas-palace|dagobah|hoth/.test(f.path)));
  assert.ok(initial.reduce((n,f)=>n+f.gzipBytes,0)<600*1024,'V3 startup keeps the 600 KiB budget');
  assert.ok(release.files.filter(f=>f.path.startsWith('v3/')||f.path==='v3.html').reduce((n,f)=>n+f.gzipBytes,0)<1000*1024,'Separate V3 code/data: 1000 KiB');
  for(const edition of ['dagobah','cloud-city','jabbas-palace'])assert.ok(release.files.filter(f=>new RegExp('^v3/(engine|data)/'+edition+'[.-]').test(f.path)).reduce((n,f)=>n+f.gzipBytes,0)<180*1024,edition+' remains lazy and bounded');
  const path=release.files.find(f=>/^v3\/data\/premiere\.[a-f0-9]+\.json$/.test(f.path)).path,data=JSON.parse(await readFile(join(output,path),'utf8'));
  assert.equal(data.cards.filter(c=>c.printText!=null).length,16,'same sixteen public texts, no private additions');
 }finally{
  const target=resolve(output);if(!target.startsWith(resolve(tmpdir())+sep)||!target.includes('swccg-v3-release-'))throw Error('Unexpected temporary directory');await rm(target,{recursive:true});
 }
});
