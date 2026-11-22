import {readFileSync} from 'node:fs';
import {harness as cloudHarness} from './cloud-city-harness.mjs';
export function harness(){const h=cloudHarness();const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
 for(const name of ["rules","card-rules","session","layout","units","abilities","locations","creatures","weapons","devices","effects","sabacc","interrupts","battle","captives","storage","support","reacts","vehicles","timing","combinations","answers","droids","numbers","attacks","personas","choices","mindscan","bot"])h.run(read('engine/jabbas-palace-'+name+'.js'));
 h.set('jpPayload',JSON.parse(read('data/jabbas-palace.json')));h.run(`catalog.push(...PremiereData.readCatalog(jpPayload,'6'));state.game.cardRulesVersion=34;state.game.playFormat=JabbasPalaceRules.FORMAT;`);return h;}
