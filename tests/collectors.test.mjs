import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {checkCollectorData, extractCollectorCards} from '../scripts/import-collectors.mjs';

test('collector catalogs cover 27 releases and 26 validated lists without private texts', async () => {
  assert.deepEqual(await checkCollectorData(), {editions:27,lists:26,cards:2557,verifiedSource:false});
  const registry=JSON.parse(await readFile(new URL('../data/editions.json',import.meta.url),'utf8'));
  assert.deepEqual(registry.editions.filter(e=>e.playable).map(e=>e.id), ['premiere','a-new-hope','hoth','dagobah','cloud-city','jabbas-palace']);
  assert.equal(registry.editions.find(e=>e.id==='premiere').releaseDate,'1995-12');
  assert.equal(registry.editions.find(e=>e.id==='theed-palace').releaseDate,'2001-12-12');
  assert.equal(registry.editions.find(e=>e.id==='special-edition').cardCount,324);
  assert.equal(registry.editions.find(e=>e.id==='reflections-ii').boxTopperCount,5);
  for(const id of ['tatooine','coruscant','theed-palace'])assert.equal(registry.editions.find(e=>e.id===id).variantCount,9);
  for(const id of ['premiere','a-new-hope']){
    const game=JSON.parse(await readFile(new URL('../data/'+id+'.json',import.meta.url),'utf8'));
    const collection=JSON.parse(await readFile(new URL('../data/collector-'+id+'.json',import.meta.url),'utf8'));
    assert.deepEqual(new Set(collection.cards.map(c=>c.id)),new Set(game.cards.map(c=>c.id)));
  }
});

test('collector extraction retains previews and AI but removes legacy and presentation duplicates', () => {
  const base={side:'Light',id:1,legacy:false,set:'7',gempId:'7_1',rarity:'R',printings:[{set:'105'},{set:'7'}],front:{title:'A card',type:'Character',imageUrl:'https://res.starwarsccg.org/cards/test.gif'}};
  const rows=extractCollectorCards([base,{...base,id:2,front:{...base.front,title:'A card (AI)'}},{...base,id:3,front:{...base.front,title:'A card (Readable)'}},{...base,id:4,legacy:true}], '105');
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(c=>c.variant),['Standard','AI']);
  assert.equal(rows[0].catalogId,'7_1');
  assert.equal(Object.hasOwn(rows[0],'gametext'),false);
  assert.equal(Object.hasOwn(rows[0],'printText'),false);
});
