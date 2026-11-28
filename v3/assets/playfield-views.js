/* Presentation preferences stay outside the saved match and its command log. */
(()=>{
 'use strict';
 const key='swccg.v3.tableView',names={classic:'Klassisch',command:'Kommandozentrale',table:'Direkt am Spieltisch'};
 let mode='classic',pending=null,mounts=null;
 try{const saved=localStorage.getItem(key);if(Object.hasOwn(names,saved))mode=saved;}catch{}
 const get=id=>document.getElementById(id);
 const text=value=>escapeHTML(value);
 function remember(node){const anchor=document.createComment('original '+node.id);node.before(anchor);return {node,anchor};}
 function restore({node,anchor}){anchor.after(node);}
 function init(){
  if(mounts)return;
  mounts={selection:remember(get('playmatSelection')),phase:remember(get('phaseDisplayPlayer')),
   step:remember(get('step')),force:remember(get('forceControls')),bot:remember(get('botTurnPanel'))};
  get('tableViewChoice').value=mode;
  get('tableViewChoice').addEventListener('change',event=>{
   mode=Object.hasOwn(names,event.target.value)?event.target.value:'classic';pending=null;
   try{localStorage.setItem(key,mode);}catch{}
   get('tableViewStatus').textContent=names[mode]+' gewählt.';
   // Reparent the existing controls; changing the view never dispatches a game action.
   if(state)render();else layout();
  });
 }
 function layout(){
  get('gameTable').dataset.view=mode;
  get('turnGuide').hidden=mode==='classic';
  get('tableActionRail').hidden=mode==='classic';
  if(mode==='classic'){
   for(const mount of Object.values(mounts))restore(mount);
   return;
  }
  get('tableActionRail').append(get('playmatSelection'),get('tableActionPreview'));
  get('guidePhases').append(get('phaseDisplayPlayer'));
  get('guideActions').append(get('forceControls'),get('step'),get('botTurnPanel'));
 }
 function scene(location){
  const name=(location?.name??'').replace(/^•+\s*/,'').toLowerCase();
  if(name.startsWith('hoth'))return 'hoth';
  if(name.startsWith('tatooine'))return 'tatooine';
  if(name.startsWith('death star'))return 'deathstar';
  if(name.startsWith('yavin')||name.startsWith('endor')||name.startsWith('dagobah'))return 'forest';
  if(name.startsWith('cloud city'))return 'cloudcity';
  return 'space';
 }
 function decorate(){
  for(let slot=0;slot<state.locations.length;slot++){
   const column=get('playmatLocation'+slot);if(column)column.dataset.scene=scene(state.locations[slot]);
  }
 }
 const supported=action=>['deploy','deployWithPilot','move'].includes(action?.kind);
 function current(action){
  if(!state||action.gameId!==currentGame()?.id||action.revision!==currentGame()?.revision)return null;
  return legalActions(state,playerSide()).find(option=>option.side===action.side&&sameOffer(option,action.kind,action.args));
 }
 function guide(view,action){
  const own=view.players[playerSide()],active=view.activeSide===playerSide(),reason=pendingActionReason();
  const sceneNames=[...new Set(state.locations.filter(Boolean).map(loc=>(loc.name??'').split(':')[0]))];
  get('guideSector').textContent=sceneNames.join(' · ')||'Spieltisch';
  get('guideTitle').textContent=view.winner?'Partie beendet':reason?'Entscheidung offen':
   action?'Aktion bestätigen':active?'Deine Phase: '+german[view.phase]:'Gegner am Zug: '+german[view.phase];
  get('guideHint').textContent=reason|| (action?'Prüfe Kosten und Ziel in der Aktionsvorschau.':!active?
   'Antwortfenster bleiben verfügbar. Der Bot-Zug folgt deiner gewählten Automatik.':
   ['Aktiviere Force oder gehe zur Kontrolle weiter.','Verfügbare Force Drains stehen direkt an den Orten.',
    'Wähle eine Handkarte und anschließend ein zulässiges Ziel.','Wähle eine Kampfvorschau direkt am Ort.',
    'Wähle eine Einheit oder öffne die Bewegung an ihrem Ort.','Ziehe Karten aus der Force Pile oder beende deinen Zug.'][view.phase]);
  get('guideForce').textContent=own.forceCount+' Force verfügbar';
  if(mode!=='classic')for(const [index,item] of [...get('phaseListPlayer').children].entries()){
   if(!view.winner&&index===view.phase)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');
  }
  get('guideConfirm').hidden=!action;
  get('guideConfirm').onclick=action?confirm:null;
  get('guideConfirm').textContent=action?(action.kind==='move'?'Bewegung ausführen':'Karte ausspielen')+' · '+playmatActionCost(action):'';
 }
 function controlLabel(slot){
  const light=PremiereLocations.control(state,'Light',slot,cardAbility),dark=PremiereLocations.control(state,'Dark',slot,cardAbility);
  return light===true?'Light Side':dark===true?'Dark Side':light===null||dark===null?'Ungeklärt':'Keine Seite';
 }
 function renderPreview(action){
  const area=get('tableActionPreview');
  if(!action){pending=null;area.innerHTML='<h2>Aktionsvorschau</h2><p class="hint">Wähle eine Karte und dann Ausspielen oder Bewegen. Kosten und Ziel erscheinen hier vor der Bestätigung.</p>';return;}
  const card=action.card??PremiereGame.zones(state,action.side).hand[action.args[0]],slot=cardActionSlot(action);
  const cost=cardActionForceCost(action),force=PremiereGame.zones(state,action.side).force.length;
  const target=state.locations[slot],from=action.kind==='move'?state.locations[action.from??action.args[0]]:null;
  const facts=[['Von',from?.name??'Deine Hand'],['Nach',target?.name??'Gewähltes Ziel'],
   ['Force-Kosten',playmatActionCost(action)],['Deine Force',cost===null?'Kosten noch offen':force+' → '+(force-cost)],
   ['Kontrolle am Ziel jetzt',controlLabel(slot)]];
  const response=PremiereGame.responseWindow(state.game);
  area.innerHTML='<h2 id="tablePreviewTitle" tabindex="-1">'+(action.kind==='move'?'Bewegung prüfen':'Ausspielen prüfen')+'</h2>'
   +'<p><strong>'+text(card?.name??playmatActionLabel(action))+'</strong>'+(action.pilot?' mit '+text(action.pilot.name):'')+'</p>'
   +'<dl>'+facts.map(([label,value])=>'<div><dt>'+text(label)+'</dt><dd>'+text(value)+'</dd></div>').join('')+'</dl>'
   +'<p class="hint">'+(response?'Die Aktion wird im laufenden Antwortfenster abgewickelt.':
    'Die Karte wechselt zum Ziel. Presence und Kontrolle werden dort nach den Regeln neu bestimmt; ein späteres Antwortfenster kann die Aktion noch beeinflussen.')+'</p>'
   +'<p class="preview-unpaid" role="status">Vorschau · noch keine Force ausgegeben.</p>'
   +'<button type="button" class="preview-confirm">'+(action.kind==='move'?'Bewegung ausführen':'Karte ausspielen')+'</button> '
   +'<button type="button" class="preview-cancel">Abbrechen</button>';
  area.querySelector('.preview-confirm').onclick=confirm;
  area.querySelector('.preview-cancel').onclick=()=>{pending=null;render();};
 }
 function preview(action){
  const offer=current(action);if(!offer)return false;
  if(mode==='classic')return dispatchUI(offer);
  pending={kind:offer.kind,side:offer.side,args:[...offer.args],gameId:offer.gameId,revision:offer.revision};
  // Movement targets can originate in a dialog; reveal the same table preview without payment.
  if(get('movementDialog').open)get('movementDialog').close();
  render();get('tablePreviewTitle')?.focus({preventScroll:true});return false;
 }
 function confirm(){
  const action=pending&&current(pending);pending=null;
  if(!action){render();return false;}
  return dispatchUI(action);
 }
 function update(view){
  init();const action=pending&&current(pending);if(pending&&!action)pending=null;
  layout();decorate();renderPreview(action);guide(view,action);
 }
 globalThis.previewTableAction=preview;
 globalThis.PremiereTableViews={update,shouldPreview:action=>mode!=='classic'&&supported(action)};
 init();
})();
