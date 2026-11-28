// V3 renders the arithmetic recorded by the rules engine. No card-text math here.
let shownDrainSite=null;
function drainSourceMarkup(source){
 if(!source)return '<span class="drain-muted">Regelgrenze</span>';
 return '<button type="button" class="drain-source" onclick="inspectDrainSource('+escapeHTML(JSON.stringify(source.id))+')">'+escapeHTML(source.name??source.id)+'</button>'+(source.copiedFrom?'<small>kopierter Spieltext: '+drainSourceMarkup(source.copiedFrom)+'</small>':'');
}
function drainRowMarkup(row,site){
 const canceled=row.status==='canceled',unused=row.status==='unused',amount=unused?row.amount:row.chosen??row.amount;
 const scope=Number.isInteger(row.sourceSite)?row.sourceSite===site?'am Drain-Ort':'bei '+(state.locations[row.sourceSite]?.name??'Standort '+row.sourceSite):row.source?'global':'';
 return '<tr class="'+(canceled||unused?'drain-inactive':'')+'"><td>'+(row.kind==='base'?'':amount>=0?'+':'')+amount+(canceled?' aufgehoben':unused?' nicht gewählt':'')+'</td><td>'+escapeHTML(row.label)+(scope?'<small>'+escapeHTML(scope)+'</small>':'')+'</td><td>'+drainSourceMarkup(row.source)
 +(row.via?'<small>über '+drainSourceMarkup(row.via)+'</small>':'')+(row.suppressedBy?.length?'<small>aufgehoben durch '+row.suppressedBy.map(drainSourceMarkup).join(', ')+'</small>':'')+'</td></tr>';
}
function drainBreakdownMarkup(snapshot,site){
 if(!snapshot)return '';
 const rows=snapshot.rows.filter(row=>row.kind!=='cost'),costs=snapshot.rows.filter(row=>row.kind==='cost');
 const base=rows.find(row=>row.kind==='base');
 return '<div class="drain-explanation"><div class="drain-table-scroll"><table><caption>Grundwert, Boni und Abzüge</caption><thead><tr><th>Force</th><th>Berechnung</th><th>Quellkarte</th></tr></thead><tbody>'+rows.map(row=>drainRowMarkup(row,site)).join('')+'</tbody><tfoot><tr><th>'+snapshot.total+'</th><th colspan="2">Force Drain insgesamt</th></tr></tfoot></table></div>'
 +(base?.details?.length?'<details><summary>Wie entsteht der Grundwert '+snapshot.base+'?</summary><div class="drain-table-scroll"><table><tbody>'+base.details.map(row=>drainRowMarkup(row,site)).join('')+'</tbody></table></div></details>':'')
 +'<p class="drain-cost">Ausführungskosten: <strong>'+snapshot.cost+' Force</strong> · getrennt vom gegnerischen Verlust.</p>'
 +(costs.length?'<div class="drain-table-scroll"><table><tbody>'+costs.map(row=>drainRowMarkup(row,site)).join('')+'</tbody></table></div>':'')+'</div>';
}
function drainLossMarkup(item){
 if(!item?.loss)return '';
 return '<section class="drain-loss-summary"><h3>Tatsächlicher Force-Verlust: '+item.loss.amount+'</h3>'
 +item.loss.rows.map(row=>'<p>'+(row.amount>=0?'+':'')+row.amount+' · '+escapeHTML(row.label)+' · '+drainSourceMarkup(row.source)+'</p>').join('')
 +'<p>'+item.paid+' Karten verloren'+(item.status==='complete'?' · abgeschlossen':' · noch '+(state.pendingForceLoss?.drainExplanationId===item.id?state.pendingForceLoss.remaining:Math.max(0,item.loss.amount-item.paid)))+'.</p>'
 +(item.loss.from==='deck'?'<p>Verlust aus dem Reserve Deck vorgeschrieben: '+drainSourceMarkup(item.loss.fromSource)+'</p>':'')+'</section>';
}
function latestDrainExplanation(site){return state?.drainExplanations?.findLast(item=>item.site===site&&item.turn===state.game.timing.turn);}
function drainExplanationTrigger(site,canDrain){
 const item=latestDrainExplanation(site);if(!canDrain&&!item)return '';
 return '<button type="button" class="drain-calculation-trigger" aria-haspopup="dialog" onclick="openDrainCalculation('+site+')">'+(canDrain?'Drain-Berechnung':item.status==='announced'?'Laufender Drain · Berechnung':'Drain-Ergebnis ansehen')+'</button>';
}
function openDrainCalculation(site){
 if(!state?.locations[site])return;shownDrainSite=site;
 if(el('extraActionDialog').open)el('extraActionDialog').close();
 renderDrainCalculation();if(!el('drainCalculationDialog').open)el('drainCalculationDialog').showModal();
}
function inspectDrainSource(id){inspectDeckCard(id);}
function renderDrainCalculation(){
 if(shownDrainSite===null||!state?.locations[shownDrainSite])return;
 const site=shownDrainSite,item=latestDrainExplanation(site),plan=drainPlan(playerSide(),site),bonus=plan?.optional??0;
 el('drainCalculationTitle').textContent='Force Drain · '+state.locations[site].name;
 let markup='';
 if(plan){markup='<p>Vorschau · '+playerSide()+' Side. Beim Auflösen werden die Werte nach möglichen Antworten erneut berechnet.</p>'+drainBreakdownMarkup(V3DrainTrace.snapshot(plan,0),site);
 if(bonus)markup+='<p>Freiwillige Boni: Wähle bei der Ansage, wie viele du verwendest. Die Übersicht oben zeigt den Drain ohne freiwillige Boni.</p>';
 markup+='<div class="drain-confirm">'+legalActions(state,playerSide()).filter(action=>action.kind==='drain'&&action.args[0]===site).map(action=>'<button type="button" data-drain-bonus="'+action.bonus+'" onclick="confirmDrainExplanation('+site+','+action.bonus+')">Drain ansagen · '+action.amount+' Force'+(action.bonus?' · +'+action.bonus+' freiwillig':' · ohne freiwilligen Bonus')+'</button>').join('')+'</div>';
 }else if(item){
 markup='<p>'+escapeHTML(item.side+' Side · '+({announced:'angesagt, Antworten noch offen',resolved:'aufgelöst',paying:'Verlust wird bezahlt',complete:'abgeschlossen',canceled:'aufgehoben'}[item.status]??item.status))+'</p>';
 markup+=drainBreakdownMarkup(item.resolved??item.announced,site);
 if(item.status==='announced'){const live=forceDrainEffects(item.side,site);markup+='<h3>Aktueller Stand im Antwortfenster</h3>'+(live?drainBreakdownMarkup(V3DrainTrace.snapshot(live,item.announced.bonus),site):'<p>Der Drain ist momentan nicht mehr zulässig. Antworten sind noch offen.</p>');}
 if(item.status==='canceled')markup+='<p class="drain-canceled">Kein Force-Verlust.'+(item.canceledBy?' Aufgehoben durch '+drainSourceMarkup(item.canceledBy):' '+escapeHTML(item.reason??''))+'</p>';
 markup+=drainLossMarkup(item);
 }else markup='<p>An diesem Ort kann momentan kein Force Drain angesagt werden.</p>';
 el('drainCalculationBody').innerHTML=markup;
}
function confirmDrainExplanation(site,bonus){
 const action=legalActions(state,playerSide()).find(action=>action.kind==='drain'&&action.args[0]===site&&action.bonus===bonus);
 if(!action){renderDrainCalculation();return false;}
 el('drainCalculationDialog').close();return dispatchUI(action);
}
function drainResponseMarkup(window){
 const frame=window.kind==='drain'?window:state.game?.responses?.find(frame=>frame.kind==='drain');if(!frame)return '';
 const item=currentDrainExplanation(frame.side,frame.site),plan=forceDrainEffects(frame.side,frame.site);
 return '<details class="drain-response" open><summary>Force Drain nachvollziehen'+(item?' · angesagt '+item.announced.total+' Force':'')+'</summary>'+(plan?drainBreakdownMarkup(V3DrainTrace.snapshot(plan,frame.bonus),frame.site):'<p>Momentan kein zulässiger Drain. Die offenen Antworten werden noch abgewickelt.</p>')+'</details>';
}
function pendingDrainExplanationMarkup(pending){
 const item=state.drainExplanations?.find(item=>item.id===pending.drainExplanationId);
 return item?'<details class="drain-response"><summary>Warum '+item.loss.amount+' Force verlieren?</summary>'+drainBreakdownMarkup(item.resolved,item.site)+drainLossMarkup(item)+'</details>':'';
}
