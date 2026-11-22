import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import data from '../engine/premiere-data.js';
import {harness} from './support/jabbas-palace-harness.mjs';
const json=name=>JSON.parse(readFileSync(new URL('../data/'+name+'.json',import.meta.url),'utf8'));
test('All 180 JP cards are released only at version 34 and covered by sixteen legal sixty-card decks',()=>{
 const cards=['premiere','a-new-hope','hoth','dagobah','cloud-city','jabbas-palace'].flatMap((name,i)=>data.readCatalog(json(name),String(i+1)));
 const choices=data.readFormatDeckChoices('premiere-a-new-hope-hoth-dagobah-cloud-city-jabbas-palace',json('premiere-starter-decks'),json('premiere-themed-decks'),json('jabbas-palace-decks'),cards),{run}=harness();
 assert.equal(cards.length,1188);assert.equal(run('JabbasPalaceCardRules.definitions.length'),180);assert.equal(run('JabbasPalaceCardRules.definitions.filter(r=>r.complete).length'),180);
 for(const side of ['light','dark']){const decks=choices[side].filter(o=>o.deck.theme);assert.equal(decks.length,8);for(const {deck,definition}of decks){assert.equal(deck.cards.length,60);assert.ok(deck.cards.every(c=>c.side.toLowerCase()===side&&Number(c.set)<=6));assert.ok(deck.cards.some(c=>c.id===definition.theme.cover));assert.ok(['start','opening','tactics'].every(key=>typeof definition.strategy[key]==='string'&&definition.strategy[key].length>40));assert.ok(definition.startingLocations.every(id=>!cards.find(c=>c.id===id)?.locationTags.includes('Vehicle Site')));}
  const covered=new Set(decks.flatMap(o=>o.deck.cards.map(c=>c.id)));for(const card of cards.filter(c=>c.set==='6'&&c.side.toLowerCase()===side)){assert.ok(covered.has(card.id),card.name);assert.equal(data.isReleasedExpansionCard(card,34),true);assert.equal(data.isReleasedExpansionCard(card,33),false);}
 }
});
