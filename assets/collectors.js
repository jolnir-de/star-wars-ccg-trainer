'use strict';
(() => {
  const byId = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = value => String(value).normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const types = {Character:'Charakter',Creature:'Creature',Device:'Device',Effect:'Effect',Interrupt:'Interrupt',Location:'Location',Starship:'Raumschiff',Vehicle:'Fahrzeug',Weapon:'Waffe',Objective:'Objective','Jedi Test':'Jedi-Test',"Admiral’s Order":'Admiral’s Order'};
  const sideName = side => side === 'Light' ? 'Light Side' : 'Dark Side';
  const cache = new Map();
  let editions = [], selected = null, cards = [], page = 0, loadSequence = 0, inspected = null, back = false;
  const pageSize = 40;
  function releaseLabel(date) {
    const [year, month, day] = date.split('-').map(Number);
    return new Intl.DateTimeFormat('de-DE', {year:'numeric',month:'long',...(day ? {day:'numeric'} : {}),timeZone:'UTC'}).format(new Date(Date.UTC(year, month-1, day || 1)));
  }
  async function json(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }
  function renderEditions() {
    const query = normalize(byId('editionSearch').value), category = byId('editionCategory').value, status = byId('editionStatus').value;
    const shown = editions.filter(e => (!query || normalize(e.name + ' ' + e.releaseDate).includes(query)) && (!category || e.category === category) && (!status || e.playable === (status === 'playable')));
    byId('editionCount').textContent = shown.length + ' von ' + editions.length + ' Veröffentlichungen · chronologisch nach Erscheinen';
    const choice=byId('editionSelect'),matched=shown.some(edition=>edition.id===selected?.id);
    choice.innerHTML=(matched?'':'<option value="" disabled>'+(!shown.length?'Keine passende Edition':'Edition auswählen')+'</option>')
      +shown.map(edition=>'<option value="'+escape(edition.id)+'">'+escape(edition.name+' · '+edition.releaseDate.slice(0,4)+(edition.playable?' · Spielbar':''))+'</option>').join('');
    choice.value=matched?selected.id:'';
    choice.disabled=!shown.length;
    byId('editionGrid').innerHTML = shown.map(e => '<button type="button" class="edition-tile" data-edition="'+escape(e.id)+'" aria-pressed="'+(e.id===selected?.id)+'"><strong>'+escape(e.name)+'</strong><time datetime="'+e.releaseDate+'">'+escape(releaseLabel(e.releaseDate))+'</time><small>'+e.cardCount+' Standardkarten'+(e.variantCount?' · '+e.variantCount+' AI':'')+(e.foilCount?' · '+e.foilCount+' Foils':'')+'</small><small class="'+(e.playable?'playable-mark':'')+'">'+(e.playable?'Im Trainer spielbar':escape(e.category))+'</small></button>').join('');
    if (!shown.length) byId('editionGrid').innerHTML = '<p>Keine Veröffentlichung passt zu diesen Filtern.</p>';
    for (const tile of byId('editionGrid').querySelectorAll('[data-edition]')) window.PremiereEditionBanners.apply(tile, tile.dataset.edition);
  }
  function resetCardFilters() {
    for (const id of ['cardSearch','cardSide','cardType','cardRarity','cardVariant']) byId(id).value = '';
    byId('cardSort').value = 'name';
    page = 0;
  }
  async function chooseEdition(id, updateUrl = true) {
    const edition = editions.find(e => e.id === id);
    if (!edition) return;
    const sequence = ++loadSequence;
    selected = edition; cards = []; resetCardFilters(); renderEditions();
    if (updateUrl) {const url = new URL(location.href); url.searchParams.set('edition', id); history.replaceState(null, '', url);}
    byId('selectedEdition').hidden = false;
    byId('editionTitle').textContent = edition.name;
    const banner = window.PremiereEditionBanners.apply(byId('selectedEditionBanner'), edition.id);
    if (banner) byId('editionBannerArt').src = banner.artwork;
    byId('editionCategoryLabel').textContent = edition.category + ' · ' + (edition.playable?'Im Trainer spielbar':'Sammlerübersicht');
    byId('editionFacts').innerHTML = [['Erstveröffentlichung',releaseLabel(edition.releaseDate)],['Standardkarten',edition.cardCount],['Alternative Bilder',edition.variantCount],['Zusätzliche Foils',edition.foilCount],...(edition.boxTopperCount?[['Zusätzliche Box-Topper-Foils',edition.boxTopperCount]]:[])].map(([label,value])=>'<div><dt>'+escape(label)+'</dt><dd>'+escape(value)+'</dd></div>').join('');
    byId('editionNote').textContent = edition.note || (edition.releaseDate.length===7?'Die Quelle nennt Monat und Jahr, keinen genauen Erscheinungstag.':'');
    byId('playEdition').hidden = !edition.playable;
    byId('editionSource').href = edition.source;
    byId('originalList').hidden = !edition.cardsUrl;
    byId('originalList').href = edition.originalList;
    byId('foilList').href = edition.checklist + (edition.id === 'reflections'?'#page=28':'');
    byId('cardBrowser').hidden = true; byId('retryCards').hidden = true;
    byId('cardLoadStatus').textContent = edition.cardsUrl?'Kartenliste wird geladen …':'Die vollständige Foil-Liste findest du in der verlinkten Originalcheckliste.';
    if (!edition.cardsUrl) return;
    try {
      if (!cache.has(id)) cache.set(id,json(edition.cardsUrl).catch(error => {cache.delete(id); throw error;}));
      const payload = await cache.get(id);
      if (sequence !== loadSequence) return;
      if (payload.schema !== 1 || payload.edition !== id || !Array.isArray(payload.cards)) throw new Error('Ungültige Kartenliste');
      cards = payload.cards;
      for (const [control,field,label] of [['cardType','type','Alle Typen'],['cardRarity','rarity','Alle Seltenheiten']]) {
        const values = [...new Set(cards.map(c=>c[field]).filter(Boolean))].sort();
        byId(control).innerHTML = '<option value="">'+label+'</option>'+values.map(v=>'<option value="'+escape(v)+'">'+escape(control==='cardType'?(types[v]||v):v)+'</option>').join('');
      }
      byId('cardLoadStatus').textContent = 'Liste: '+edition.cardCount+' Standardkarten'+(edition.variantCount?' + '+edition.variantCount+' alternative Bilder':'')+'. Scans öffnen sich per Klick; zusätzliche Foils stehen in der Originalcheckliste.';
      byId('cardBrowser').hidden = false; renderCards();
    } catch {
      if (sequence !== loadSequence) return;
      byId('cardLoadStatus').textContent = 'Die Kartenliste konnte nicht geladen werden. Du kannst es erneut versuchen oder die Original-Kartenliste öffnen.';
      byId('retryCards').hidden = false;
    }
  }
  function filteredCards() {
    const query = normalize(byId('cardSearch').value);
    const shown = cards.filter(c => (!query || normalize(c.name).includes(query)) && ['Side','Type','Rarity','Variant'].every(key=>!byId('card'+key).value || c[key.toLowerCase()]===byId('card'+key).value));
    const sort = byId('cardSort').value;
    const title = card => card.name.replace(/^[•.\s]+/u,'');
    shown.sort((a,b) => (sort==='type'?a.type.localeCompare(b.type):sort==='side'?a.side.localeCompare(b.side):0) || title(a).localeCompare(title(b),'de',{numeric:true,sensitivity:'base'}));
    if (sort === 'name-desc') shown.reverse();
    return shown;
  }
  function renderCards() {
    const shown = filteredCards(), pages = Math.max(1,Math.ceil(shown.length/pageSize));
    page = Math.max(0,Math.min(page,pages-1));
    const start = page * pageSize;
    byId('cardCount').textContent = shown.length+' Treffer · '+(shown.length?start+1:0)+'–'+Math.min(start+pageSize,shown.length)+' angezeigt';
    byId('cardRows').innerHTML = shown.slice(start,start+pageSize).map(c=>'<tr><td><button type="button" class="card-name" data-card="'+escape(c.id)+'">'+escape(c.name)+'</button>'+(c.variant==='AI'?'<span class="variant-badge">AI</span>':'')+'<small class="card-id">Katalog-ID '+escape(c.catalogId)+'</small></td><td>'+sideName(c.side)+'</td><td>'+escape(types[c.type]||c.type)+'</td><td>'+escape(c.rarity||'Nicht angegeben')+'</td></tr>').join('') || '<tr><td colspan="4">Keine Karte passt zu diesen Filtern.</td></tr>';
    byId('previousCards').disabled = page === 0; byId('nextCards').disabled = page >= pages-1;
    byId('cardPage').textContent = 'Seite '+(page+1)+' / '+pages;
  }
  function showScan() {
    const url = back?inspected.backImage:inspected.image;
    byId('collectorScan').replaceChildren();
    if (!url) {byId('collectorScan').textContent = 'Für diese Karte ist kein Scan hinterlegt.'; return;}
    const img = document.createElement('img'); img.alt = inspected.name + (back?' · Rückseite':''); img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
    img.onerror = () => {if(img.parentNode===byId('collectorScan'))byId('collectorScan').textContent = 'Der externe Scan ist gerade nicht verfügbar. Die Kartenangaben bleiben erhalten.';};
    img.src = url; byId('collectorScan').append(img);
    byId('flipCollectorCard').textContent = back?'Vorderseite ansehen':'Rückseite ansehen';
  }
  byId('editionGrid').addEventListener('click',event=>{const tile=event.target.closest('[data-edition]');if(tile){chooseEdition(tile.dataset.edition);byId('selectedEdition').scrollIntoView({block:'start'});}});
  byId('editionSelect').addEventListener('change',event=>{if(event.target.value)chooseEdition(event.target.value);});
  byId('cardRows').addEventListener('click',event=>{
    const button=event.target.closest('[data-card]'); if(!button)return;
    inspected=cards.find(c=>c.id===button.dataset.card); if(!inspected)return; back=false;
    byId('collectorCardTitle').textContent=inspected.name;
    byId('collectorCardMeta').textContent=[selected.name,sideName(inspected.side),types[inspected.type]||inspected.type,inspected.rarity,'Katalog-ID '+inspected.catalogId,inspected.variant].filter(Boolean).join(' · ');
    byId('flipCollectorCard').hidden=!inspected.backImage;showScan();byId('collectorCard').showModal();
  });
  byId('flipCollectorCard').onclick=()=>{back=!back;showScan();};
  byId('closeCollectorCard').onclick=()=>byId('collectorCard').close();
  byId('retryCards').onclick=()=>chooseEdition(selected.id);
  byId('previousCards').onclick=()=>{page--;renderCards();}; byId('nextCards').onclick=()=>{page++;renderCards();};
  for(const id of ['editionSearch','editionCategory','editionStatus'])byId(id).addEventListener(id==='editionSearch'?'input':'change',renderEditions);
  for(const id of ['cardSearch','cardSide','cardType','cardRarity','cardVariant','cardSort'])byId(id).addEventListener(id==='cardSearch'?'input':'change',()=>{page=0;renderCards();});
  json(byId('inhalt').dataset.editionsUrl).then(registry=>{
    if(registry.schema!==1||!Array.isArray(registry.editions))throw new Error('Ungültiges Editionsregister');
    editions=registry.editions;renderEditions();const requested=new URL(location.href).searchParams.get('edition');chooseEdition(editions.some(e=>e.id===requested)?requested:'premiere',false);
  }).catch(()=>{byId('editionCount').textContent='Editionsdaten nicht verfügbar';byId('registryError').hidden=false;byId('registryError').textContent='Die Editionsübersicht konnte nicht geladen werden. Lade die Seite erneut oder verwende den Link zu den Sammlerquellen im Fußbereich.';});
})();
