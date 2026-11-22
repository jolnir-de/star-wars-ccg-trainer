'use strict';
jpInterruptProviders.push(({card,window,offer})=>{
 if(!window?.card)return;
 const names={'Light:756':['3720 to 1'],'Dark:2617':['never tell me the odds'],'Dark:193':['as good as gone','innocent scoundrel'],'Light:2771':['you are beaten'],'Dark:2831':['clash of sabers']};
 if(names[card.id]?.includes(jpTitle(window.card)))offer('namedCancel',[],'Genannte Karte aufheben',(parent,done)=>{PremiereGame.cancelResponse(state.game,parent);done();},{pile:['Light:756','Dark:2617','Dark:193'].includes(card.id)?'Used':'Lost',immuneSense:['Light:756','Dark:2617'].includes(card.id)});
 if(card.id==='Light:1546'&&window.kind==='battle'&&window.side==='Dark'&&battleCandidates('Light',window.site).filter(c=>c.type==='Character').length===1&&battleCandidates('Light',window.site).some(c=>ccPersona(c,'Han'))&&jpOwn('Light').deck.some(c=>ccPersona(c,'Chewie')))offer('chewieReact',[],'Chewbacca kostenlos aus Reserve als Verstärkung deployen',(_parent,done)=>jpOfferDeploy('Light',card,'deck',c=>ccPersona(c,'Chewie'),{free:true,site:window.site,react:true},done));
});
const jpAnswersBase={interrupts:hothInterruptOptions,responses:interruptResponses,drain:forceDrainEffects,cancel:cancelTableEffect};
hothInterruptOptions=function(side,window=null){
 const out=jpAnswersBase.interrupts(side,window);if(!jpEnabled()||!window)return out;const own=jpOwn(side),enemy=PremiereGame.otherSide(side),jawas=jpAll(side).filter(e=>jpSpecies(e.card,'jawa')).length;
 own.hand.forEach((card,index)=>{
  const utinni=jpTitle(card)==='utinni!',bith=jpTitle(card)==='bith shuffle';if(!utinni&&!bith)return;
  const leaders=jpAll(side).filter(e=>['Light:174','Dark:1128'].includes(e.card.id));
  const canUtinni=utinni&&jawas>=3&&leaders.length&&(window.kind==='drain'&&window.side===enemy&&sitePlanet(state.locations[window.site])==='tatooine'||window.card&&jpTitle(window.card)==='control');
  const canBith=bith&&window.kind==='drain'&&window.side===enemy&&jpAll(side,'Light:1660').some(e=>adjacentSites(e.slot,window.site)&&ccPresent(side,e.slot).some(c=>c!==e.card&&characterTraits(c).includes('musician')));
  if(canUtinni||canBith)out.push({card,index,choice:[index,'cc:jp:helperCancel'],mode:'cc:jp:helperCancel',cost:0,label:card.name+' · '+(window.kind==='drain'?'Force Drain':'Control')+' aufheben',rule:{pile:card.subType==='Used'?'Used':'Lost'},jpResolve(parent,done){PremiereGame.cancelResponse(state.game,parent);done();}});
 });return out;
};
interruptResponses=function(side,window){const options=jpAnswersBase.responses(side,window);return jpEnabled()&&window.immuneSense?options.filter(o=>o.interrupt!=='sense'):options;};
ccResponseProviders.push((side,window)=>{
 if(!jpEnabled()||!window.card)return [];const out=[],targets=[window.target,...window.targets??[]].filter(Boolean),name=jpTitle(window.card);
 if(['torture','sonic bombardment'].includes(name)||/^ai+! aa+! ag+!$/.test(name))for(const e of jpAll(side,'Light:13'))if(targets.some(c=>c.type==='Character'&&jpEntry(c)?.slot===e.slot))out.push(jpOption(e.card,'cancelTorture',[e.card.instanceId],'Gerade zielende Karte aufheben',()=>{PremiereGame.cancelResponse(state.game,window);ccAnswer(side,window);return true;}));
 return out;
});
// Keep cancellation replacements identical for location and table Effects.
function jpNightCancellation(effect,site,cancel){
 const side=ccOwner(effect.card),name=jpTitle(effect.card),region=sitePlanet(state.locations[site])??jpTitle(state.locations[site]);
 const cause=state.resolvingInterrupts?.at(-1)?.side??PremiereGame.responseWindow(state.game)?.side;
 const witness=['nightfall','sunsdown'].includes(name)&&cause===PremiereGame.otherSide(side)?jpAll(side,name==='nightfall'?'Light:2292':'Dark:2804').find(e=>isSite(state.locations[e.slot])&&sitePlanet(state.locations[e.slot])===region):null;
 const result=cancel();if(!witness)return result;
 const lost=jpOwn(side).lost,index=lost.indexOf(effect.card);if(index>=0){lost.splice(index,1);jpOwn(side).used.push(effect.card);}
 (state.hothDeferred??=[]).push(()=>jpChoose(side,witness.card,'NightRetrieve',[{args:['yes'],label:'2 Force zurückholen'},{args:['no'],label:'Keine Force zurückholen'}],choice=>{if(choice.args[0]==='yes')PremiereGame.retrieveForce(state,side,2);}));return result;
}
cancelTableEffect=function(effect,...args){
 if(!jpEnabled())return jpAnswersBase.cancel(effect,...args);
 if(['Light:198','Dark:697'].includes(effect.card.id)&&effect.support?.length)return hothCancelEffect(effect,...args);
 const gift=effect.card.id==='Light:25',host=effect.host;
 const result=jpNightCancellation(effect,effect.site??state.locations.findIndex(l=>l===effect.target),()=>jpAnswersBase.cancel(effect,...args));
 if(gift&&host?.jpGiftSpy){delete host.jpGiftSpy;delete host.undercover;}return result;
};
const jpNightLocationBase=cancelLocationEffect;
cancelLocationEffect=function(site,effect,...args){return !jpEnabled()?jpNightLocationBase(site,effect,...args):jpNightCancellation(effect,site,()=>jpNightLocationBase(site,effect,...args));};
