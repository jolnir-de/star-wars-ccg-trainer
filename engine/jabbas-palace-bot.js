'use strict';
const jpBotBase={value:hothBotValue,prompt:hothPromptChoice};
hothBotValue=function(offer,view){
 if(!jpEnabled()||!String(offer.mode??'').startsWith('cc:jp:'))return jpBotBase.value(offer,view);
 const mode=offer.mode.slice(6),cost=offer.cost??0,side=view.side;
 if(['ignoreSeeker','peekLight','peekDark','reorderForce'].includes(mode))return -2;
 if(mode==='detonate'){
  const site=jpEntry(offer.card)?.slot;if(site===undefined)return -5;
  const value=actor=>jpUnits().filter(e=>e.slot===site&&ccOwner(e.card)===actor&&!e.card.imprisoned&&['Character','Vehicle','Starship'].includes(e.card.type)).reduce((n,e)=>n+(e.card.power??0)+(e.card.deploy??0),0);
  return value(PremiereGame.otherSide(side))>value(side)+4?2:-4;
 }
 if(mode==='rennekPower')return battleSession?.site===jpEntry(offer.card)?.slot?1-cost*.3:-2;
 if(['cancelDrain','alienCancelDrain','deflect','namedCancel','helperCancel','dungeonRelease','freeHan','mindRelease','wrapCapture','assassinate','behead','reeDestiny','vulDestiny'].includes(mode))return 3-cost*.3;
 if(['deployReserve','storedAlien','czReact','deviceDeploy','passengerDeploy'].includes(mode))return 1.8-cost*.2;
 if(['search','lostEquipment','retrieveTop','exchange','quick','nonuniqueSearch','signal','undercover'].includes(mode))return 1.7-cost*.25;
 if(mode==='trapDoor')return offer.target&&ccOwner(offer.target)!==side?2:-2;
 return 1.1-cost*.25;
};
hothPromptChoice=function(offers,frame){
 if(!jpEnabled()||!frame?.mode?.startsWith('hothDagCloudJP'))return jpBotBase.prompt(offers,frame);
 if(frame.botChoice)return frame.botChoice(offers);
 if(frame.mode==='hothDagCloudJPHoloDestiny')return offers.find(o=>o.args[0]===2)??offers[0];
 if(frame.mode==='hothDagCloudJPStartingEffect')return offers.slice().sort((a,b)=>Number(['Dark:2188','Dark:2096','Light:2665','Light:198'].includes(b.card?.id))-Number(['Dark:2188','Dark:2096','Light:2665','Light:198'].includes(a.card?.id)))[0];
 if(frame.mode==='hothDagCloudJPDoOrDie')return offers.find(o=>o.to!==undefined)??offers[0];
 return jpBotBase.prompt(offers,frame);
};
