import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {v2SourceAssets,v3SourceAssets} from './build-web.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=path=>readFile(resolve(root,path),'utf8');
const hash=body=>createHash('sha256').update(body.replaceAll('\r\n','\n')).digest('hex');
for(const path of ['v3.html','v3'])try{await access(resolve(root,path));throw Error('V3 existiert bereits. Ihre Entwicklung nicht durch eine neue Kopie überschreiben.');}catch(error){if(error.code!=='ENOENT')throw error;}
for(const target of v3SourceAssets){
 const original=target.slice(3);let body=await read(original);
 if(original==='assets/playfield-views.js')body=body.replaceAll('swccg.v2.','swccg.v3.');
 await mkdir(dirname(resolve(root,target)),{recursive:true});await writeFile(resolve(root,target),body);
}
let html=await read('v2.html');
html=html.replaceAll('engine/','v3/engine/').replaceAll('data/','v3/data/').replaceAll('assets/playfield-views.js','v3/assets/playfield-views.js')
 .replaceAll('swccg.v2.','swccg.v3.').replaceAll('swccg-partie-','swccg-v3-partie-').replaceAll('V2','V3')
 .replace("const trainerVersion='2.19.3'","const trainerVersion='3.0.0-preview.1'").replace('const saveVersion=1;','const saveVersion=3;');
html=html.replace('<style>','<link rel="stylesheet" href="assets/version-picker.css"><style>');
html=html.replace('<main>','<main>\n<section class="variant-notice" aria-label="V3 Entwicklungsversion"><div><strong>V3 · Entwicklungsversion</strong><p>Eigenständige Vorschau auf Basis von V2.19.3. Die Verbesserungen entstehen hier schrittweise. V2 behält ihren eigenen Spielstand.</p></div><a href="v2.html">V2 weiterspielen →</a></section>');
await writeFile(resolve(root,'v3.html'),html);
const release=JSON.parse(await read('dist/v2-baseline-release/release.json'));
const sourcePaths=['v2.html',...v2SourceAssets,'assets/edition-banners.js'];
const sources=await Promise.all(sourcePaths.map(async path=>({path,sha256:hash(await read(path))})));
const files=release.files.filter(file=>file.path==='v2.html'||file.kind==='asset'&&!/^data\/collector-|^data\/editions\.|^assets\/(collectors|site|home-covers)\./.test(file.path)).map(({path,sha256})=>({path,sha256}));
await writeFile(resolve(root,'v3/v2-baseline.json'),JSON.stringify({schema:1,version:'2.19.3',commit:'c85d8ff9a2e864c05dc83e5394516ca6a57effa4',publishedRevision:release.revision,sources,files},null,2)+'\n');
console.log('Isolierte V3-Quellen erstellt; V2-Dateien nicht verändert.');
