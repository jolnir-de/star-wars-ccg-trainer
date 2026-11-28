import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, sep, posix} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import vm from 'node:vm';
import {buildWeb, webPages} from '../scripts/build-web.mjs';

test('public release is self-contained, versioned, small and excludes private material', async () => {
  const output = await mkdtemp(join(tmpdir(), 'swccg-web-release-'));
  try {
    const release = await buildWeb(output);
    const paths = new Set(release.files.map(file => file.path));
    for (const file of release.files) {
      assert.ok(!/local-print|drucktexte|\.env|\.git|tests\/|node_modules|README|package-lock/i.test(file.path));
      const body = await readFile(join(output, file.path));
      assert.equal(createHash('sha256').update(body).digest('hex'), file.sha256);
      if (file.kind === 'asset') assert.ok(file.path.includes('.' + file.sha256.slice(0, 12) + '.'));
      if (file.path.endsWith('.js')) new vm.Script(body.toString(), {filename: file.path});
    }
    for (const page of webPages) {
      const html = await readFile(join(output, page), 'utf8');
      for (const [, url] of html.replace(/<script>[\s\S]*?<\/script>/g, '').matchAll(/(?:src|href)="([^"]+)"/g)) {
        if (/^(?:https?:|#)/.test(url)) continue;
        let target = posix.normalize(posix.join(posix.dirname(page), url.split('#')[0].split('?')[0]));
        if (url.endsWith('/') || url.includes('/#')) target = posix.join(target, 'index.html');
        assert.ok(paths.has(target), page + ' references missing ' + target);
      }
      for (const [, url] of html.matchAll(/readLocalJson\('(data\/[^']+)'\)/g)) assert.ok(paths.has(url), url);
    }
    const game = await readFile(join(output, 'v2.html'), 'utf8');
    assert.equal((game.match(/<script src="engine\/[^\"]+\.[a-f0-9]{12}\.js"/g) || []).length, 10);
    assert.match(game, /data\/premiere\.[a-f0-9]{12}\.json/);
    const registryPath = release.files.find(file => /^data\/editions\.[a-f0-9]+\.json$/.test(file.path)).path;
    const registry = JSON.parse(await readFile(join(output, registryPath), 'utf8'));
    for (const edition of registry.editions.filter(e => e.cardsUrl)) {
      assert.match(edition.cardsUrl, /\.[a-f0-9]{12}\.json$/);
      assert.ok(paths.has(edition.cardsUrl), 'Hashed collector data must exist: '+edition.id);
    }
    const home = await readFile(join(output, 'index.html'), 'utf8');
    assert.doesNotMatch(home, /<script|fetch\(/);
    assert.equal((home.match(/data-banner-edition=/g)??[]).length,6,'Homepage reuses all six playable edition banners');
    assert.equal((home.match(/faction-card-backs\.[a-f0-9]+\.svg#/g)??[]).length,2,'Homepage uses the original Light/Dark card backs');
    assert.ok(gzipSync(home).length < 12000, 'Homepage gzip budget: 12 KB');
    const bannerArt = release.files.filter(file => file.path.startsWith('assets/edition-banners/'));
    assert.equal(bannerArt.length, 27, 'One prepared banner for every registered edition');
    assert.ok(bannerArt.reduce((n, f) => n + f.gzipBytes, 0) < 800 * 1024, 'All lazily loaded banner art: 800 KiB');
    const coverArt=release.files.filter(file=>/^assets\/faction-card-backs\.[a-f0-9]+\.svg$/.test(file.path));
    assert.equal(coverArt.length,1,'Both original card backs share one self-contained asset');
    assert.ok(coverArt[0].gzipBytes<320*1024,'Lossless original card backs: 320 KiB gzip');
    const gameStartup = new Set([...game.matchAll(/(?:src|href)="((?:engine|assets)\/[^"?]+)(?:\?[^\"]*)?"/g)].map(match => match[1]));
    for (const name of ['premiere', 'premiere-starter-decks', 'premiere-themed-decks', 'premiere-supplemental-cards', 'play-format-decks', 'a-new-hope', 'deck-overview']) {
      gameStartup.add(release.files.find(file => new RegExp('^data/' + name + '\\.[a-f0-9]+\\.json$').test(file.path)).path);
    }
    const initialFiles = release.files.filter(file => file.path === 'v2.html' || gameStartup.has(file.path));
    assert.ok(initialFiles.every(file => !/jabbas-palace|cloud-city|dagobah|hoth|collector-/.test(file.path)), 'Later editions and collectors stay outside the startup bundle');
    assert.ok(initialFiles.reduce((n, f) => n + f.gzipBytes, 0) < 600 * 1024, 'Initial game code and data retain the 600 KiB gzip budget');
    const v2Files=release.files.filter(file=>!file.path.startsWith('v3/')&&file.path!=='v3.html');
    assert.ok(v2Files.filter(file => /(?:engine|data)\/dagobah[.-]/.test(file.path)).reduce((n, f) => n + f.gzipBytes, 0) < 180 * 1024, 'On-demand V2 Dagobah rules and decks: 180 KiB gzip');
    assert.ok(v2Files.filter(file => !bannerArt.includes(file)&&!coverArt.includes(file)).reduce((n, f) => n + f.gzipBytes, 0) < 1000 * 1024, 'V2 keeps its original complete-package budget: 1000 KiB gzip');
    assert.equal(release.files.filter(file=>/^engine\/cloud-city-all\./.test(file.path)).length,1,'Cloud City uses one optional script request');
    assert.ok(v2Files.filter(file=>/(?:engine|data)\/cloud-city[.-]/.test(file.path)).reduce((n,f)=>n+f.gzipBytes,0)<180*1024,'Optional V2 Cloud City rules and decks: 180 KiB gzip');
    assert.equal(release.files.filter(file=>/^engine\/jabbas-palace-all\./.test(file.path)).length,1,'Jabba’s Palace uses one optional script request');
    assert.ok(v2Files.filter(file=>/(?:engine|data)\/jabbas-palace[.-]/.test(file.path)).reduce((n,f)=>n+f.gzipBytes,0)<180*1024,'Optional V2 Jabba’s Palace rules and decks: 180 KiB gzip');
    const premierePath = release.files.find(file => /^data\/premiere\.[a-f0-9]+\.json$/.test(file.path)).path;
    const data = JSON.parse(await readFile(join(output, premierePath), 'utf8'));
    assert.equal(data.cards.filter(card => card.printText != null).length, 16);
    const config = await readFile(join(output, '.htaccess'), 'utf8');
    assert.match(config, /max-age=31536000, immutable/);
    assert.match(config, /Cache-Control "no-cache"/);
    assert.match(config, /DEFLATE/);
    assert.match(config, /Require all denied/);
    assert.equal((await readdir(output)).includes('.git'), false);
    await assert.rejects(buildWeb(output), /muss leer sein/);
  } finally {
    const target = resolve(output);
    if (!target.startsWith(resolve(tmpdir()) + sep) || !target.includes('swccg-web-release-')) throw new Error('Unexpected cleanup path');
    await rm(target, {recursive: true});
  }
});
