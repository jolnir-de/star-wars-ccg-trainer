import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import premiere from '../engine/premiere-data.js';

const json = async name => JSON.parse(await readFile(new URL('../data/' + name + '.json', import.meta.url), 'utf8'));
const output = new URL('../data/deck-overview.json', import.meta.url);
export async function buildDeckOverview() {
  const cards = (await Promise.all(['premiere', 'a-new-hope', 'hoth', 'dagobah', 'cloud-city', 'jabbas-palace'].map(async (name, index) =>
    premiere.readCatalog(await json(name), String(index + 1))))).flat();
  const byId = new Map(cards.map(card => [card.id, card]));
  const formats = {};
  for (const name of ['hoth', 'dagobah', 'cloud-city','jabbas-palace']) {
    const decks = await json(name + '-decks');
    for (const [format, sides] of Object.entries(decks.formats)) {
      formats[format] = Object.fromEntries(Object.entries(sides).map(([side, definitions]) => [side.toLowerCase(), definitions.map(deck => {
        const cover = byId.get(deck.theme.cover);
        assert.ok(cover?.image && deck.cards.some(card => card.id === cover.id), 'Cover must belong to its deck');
        return {id: deck.theme.id, name: deck.theme.name,
          cover: {id: cover.id, name: cover.name, image: cover.image}};
      })]));
    }
  }
  return {schema: 1, formats};
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const overview = await buildDeckOverview();
  if (process.argv.includes('--check')) {
    assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), overview, 'Deck overview is stale; run node scripts/build-deck-overview.mjs');
    console.log('Deckübersicht: 64 Hoth-/Dagobah-/Cloud-City-/Jabba’s-Palace-Decks mit passenden Covern geprüft.');
  } else await writeFile(output, JSON.stringify(overview, null, 2) + '\n');
}
