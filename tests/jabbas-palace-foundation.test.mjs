import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support/jabbas-palace-harness.mjs';
test('JP catalog has exactly 180 cards; format contains only the six regular sets',()=>{const {run}=harness();assert.equal(run(`catalog.filter(c=>c.set==='6').length`),180);assert.deepEqual(Array.from(run('PremiereData.PLAY_FORMATS[JabbasPalaceRules.FORMAT]')),['1','2','3','4','5','6']);assert.equal(run('jpEnabled()&&cloudCityEnabled()&&dagobahEnabled()&&hothEnabled()'),true);});
test('Palace sites are on Tatooine; its entrance separates interior sites from the exterior',()=>{const {run}=harness();assert.equal(run(`sitePlanet(card('Dark:1356'))`),'tatooine');assert.equal(run(`PremiereLocations.region(card('Dark:1356'))`),'Tatooine');assert.deepEqual(Array.from(run(`initialLocationOrder([card('Dark:1360'),card('Light:2443'),card('Dark:1356'),card('Dark:2452'),card('Dark:1357')])`)),[1,3,4,2,0]);});
