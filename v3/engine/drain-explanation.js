/* Arithmetic provenance for V3. References are public scalars, never card objects. */
const V3DrainTrace=(()=>{
 const ref=card=>card?{id:card.jpRuleOriginalId??card.id,name:card.name,...(card.jpRuleOriginalId&&card.jpMindscan?.target?{copiedFrom:{id:card.jpMindscan.target.id,name:card.jpMindscan.target.name}}:{}),uid:card.instanceId,owner:card.controller??card.owner??card.side}:null;
 const term=(kind,amount,card,label,site,extra={})=>({kind,amount,source:ref(card),label,sourceSite:site,...extra});
 const active=row=>!row.status||row.status==='applied';
 const sum=rows=>rows.filter(active).reduce((n,row)=>n+row.amount,0);
 const append=(plan,rows)=>({...plan,trace:[...(plan.trace??[]),...rows]});
 function base(value,card,side,site,details=[]){return {base:value,modifier:0,optional:0,weapons:[],trace:[term('base',value,card,'Grundwert: wirksame Force-Icons von '+(side==='Light'?'Dark':'Light')+' Side',site,{details})]};}
 function modify(plan,rows){return {...append(plan,rows),modifier:plan.modifier+sum(rows)};}
 function optional(plan,rows,weapons){return {...append(plan,rows),optional:plan.optional+sum(rows),weapons:plan.weapons.concat(weapons)};}
 function cost(plan,rows){return {...append(plan,rows),cost:(plan.cost??0)+sum(rows)};}
 const key=row=>[row.kind,row.source?.uid??row.source?.id,row.sourceSite,row.label,row.amount].join('|');
 function replace(plan,rows,by){
  const remaining=rows.slice(),trace=(plan.trace??[]).map(row=>{
   if(!['modifier','optional'].includes(row.kind))return row;
   const index=remaining.findIndex(next=>key(next)===key(row));
   if(index>=0){remaining.splice(index,1);const {status,suppressedBy,...rest}=row;return rest;}
   return {...row,status:'canceled',suppressedBy:by.map(ref)};
  });
  return {...plan,modifier:sum(rows),optional:0,weapons:[],trace:trace.concat(remaining)};
 }
 function rebase(plan,value,details){return {...plan,base:value,trace:(plan.trace??[]).map(row=>row.kind==='base'?{...row,amount:value,details:details??row.details}:row)};}
 function snapshot(plan,bonus=0){
  let left=Math.min(bonus,plan.optional);const rows=(plan.trace??[]).map(row=>{
   if(row.kind!=='optional'||!active(row))return {...row};
   const chosen=Math.min(left,row.amount);left-=chosen;return {...row,chosen,status:chosen?'applied':'unused'};
  });
  const raw=plan.base+plan.modifier+Math.min(bonus,plan.optional),total=Math.max(0,raw);
  if(raw<0)rows.push(term('floor',-raw,null,'Force Drain kann nicht negativ sein'));
  return {base:plan.base,modifier:plan.modifier,bonus:Math.min(bonus,plan.optional),total,cost:plan.cost??0,rows};
 }
 return {ref,term,active,sum,append,base,modify,optional,cost,replace,rebase,snapshot};
})();
if(typeof module!=='undefined')module.exports=V3DrainTrace;
else globalThis.V3DrainTrace=V3DrainTrace;

function drainSuppressionSources(side){
 const cards=[];
 if(typeof dagobahEnabled==='function'&&dagobahEnabled()&&dagoCompleted(side,1))for(const entry of dagoJediCards())if(entry.side===side)cards.push(...(entry.card.attachments??[]).filter(card=>card.dagobahJediTest===1&&!PremiereUnits.textSuppressed(card)));
 if(typeof cloudCityEnabled==='function'&&cloudCityEnabled()&&ccDecree(side))cards.push(...ccEffects('Dark:1268',side).map(effect=>effect.card));
 return cards;
}
function drainRuleTerms(side,site,event='forceDrain'){
 return PremiereLocations.ruleEntriesAt(state,site,side,event).map(({rule,card,slot,via})=>V3DrainTrace.term('modifier',rule.amount,card,'Standort-Spieltext',slot,{via:V3DrainTrace.ref(via)}));
}

// Records are deterministic public summaries, not a second rules engine.
function currentDrainExplanation(side,site){return state?.drainExplanations?.findLast(item=>item.turn===state.game.timing.turn&&item.side===side&&item.site===site&&item.status==='announced');}
function announceDrainExplanation(side,site,plan,bonus){
 const history=state.drainExplanations??=[],turn=state.game.timing.turn;
 const item={id:turn+':'+side+':'+site+':'+history.length,turn,side,site,location:V3DrainTrace.ref(state.locations[site]),status:'announced',announced:V3DrainTrace.snapshot(plan,bonus),paid:0};
 history.push(item);if(history.length>12)history.splice(0,history.length-12);return item;
}
function resolvedDrainExplanation(side,site,plan,bonus){
 const item=currentDrainExplanation(side,site);if(!item)return null;
 item.status='resolved';item.resolved=V3DrainTrace.snapshot(plan,bonus);
 item.resolved.cost=item.announced.cost;item.resolved.rows.push(...item.announced.rows.filter(row=>row.kind==='cost'));
 log('Drain-Berechnung: '+drainExplanationText(item.resolved)+'.');return item;
}
function drainExplanationText(snapshot){
 const sign=n=>(n>=0?'+':'')+n;
 const sources=snapshot.rows.filter(row=>V3DrainTrace.active(row)&&row.kind!=='base'&&row.kind!=='cost'&&(row.kind!=='optional'||row.chosen)).map(row=>sign(row.chosen??row.amount)+' '+(row.source?.name??row.label));
 return 'Grundwert '+snapshot.base+(sources.length?' '+sources.join(' '):'')+' = '+snapshot.total+' Force';
}
function recordDrainLoss(terms,payer,input,amount,loss){
 const item=state.drainExplanations?.findLast(item=>item.status==='resolved'&&item.site===terms.locationIndex&&item.side===PremiereGame.otherSide(payer));
 if(!item)return;
 terms.drainExplanationId=item.id;
 const rows=terms.drainLimits??[];
 if(amount!==input)rows.push({...V3DrainTrace.term('loss',amount-input,null,'We’re Doomed: halbierter Verlust'),source:state.doomedSource??null});
 if(loss!==amount)rows.push(V3DrainTrace.term('loss',loss-amount,null,'Auf vorhandene Hand und Life Force begrenzt'));
 item.loss={amount:loss,rows,from:terms.from??'choice',fromSource:terms.fromSource};item.status=loss?'paying':'complete';
 log('Force-Verlust: '+item.resolved.total+(rows.length?' '+rows.map(row=>(row.amount>=0?'+':'')+row.amount+' '+(row.source?.name??row.label)).join(' '):'')+' = '+loss+' Force. Ausführungskosten: '+item.resolved.cost+' Force.');
}
let drainActionSource=null,drainResolvingSource=null;
function withDrainAction(action,run){const previous=drainActionSource,resolving=drainResolvingSource;drainActionSource=action.card??null;drainResolvingSource=null;try{return run();}finally{drainActionSource=previous;drainResolvingSource=resolving;}}
if(typeof PremiereGame!=='undefined'){
 const pass=PremiereGame.passResponse,cancel=PremiereGame.cancelResponse;
 PremiereGame.passResponse=function(game,side){const result=pass(game,side);if(result&&result!==true)drainResolvingSource=result.card??null;return result;};
 PremiereGame.cancelResponse=function(game,frame){const result=cancel(game,frame);if(result&&frame.kind==='drain'){
  const item=currentDrainExplanation(frame.side,frame.site);if(item){item.status='canceled';item.canceledBy=V3DrainTrace.ref(drainResolvingSource??drainActionSource);log('Force Drain aufgehoben'+(item.canceledBy?' durch '+item.canceledBy.name:'')+'; kein Force-Verlust.');}
 }return result;};
}
