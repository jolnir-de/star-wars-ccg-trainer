'use strict';
const ccBotBase={value:hothBotValue,prompt:hothPromptChoice};
hothBotValue=function(offer,view){
 if(!cloudCityEnabled())return ccBotBase.value(offer,view);
 const mode=(offer.mode??offer.ability??'').replace(/^cc:/,''),side=view.side,enemy=PremiereGame.otherSide(side),cost=offer.cost??0;
 if(!String(offer.mode??'').startsWith('cc:'))return ccBotBase.value(offer,view);
 if(['cancel','cancelDestiny','freezeBonus','impressive','hanRedraw','guardDrain','scanTax','weaponPlus','swingMiss','shieldHit','punchIt','extraDestiny','trooperAssault','abilityPower','smoke','duelDestiny'].includes(mode))return 3-cost*0.35;
 if(['freeze','freeFrozen','weatherRescue','weatherCapture','deliverAdditional','takeFrozen','securityRelease','redemptionPatient'].includes(mode))return 2.5-cost*0.35;
 if(['deviceForfeit','forfeitCaptive','chewieRelief','hanLeiaRelief'].includes(mode))return battleSession?.damage?.debt[side]?.damage>0||battleSession?.damage?.debt[side]?.attrition>0?2:-2;
 if(mode==='chooseCloudDrain')return state.cloudCityDrainBoost?-2:0.8;
 if(['search','securityLando','activate','salvage','raiseSite','retrieveDroid','asteroid'].includes(mode))return 1.8-cost*0.3;
 if(mode==='cloudDeploy')return 1.2;
 if(mode==='deviceDeploy')return 1.1-cost*0.15;
 if(mode==='playStored')return 1;
 if(mode==='storeCard')return ccOwn(side).hand.length>4?0.2:-2;
 if(['usedView','lookLost','rotatePile','interface','equipmentUsed','returnHand','toVane','rearrange'].includes(mode))return -1;
 if(mode==='surrender'||mode==='loseVane')return offer.target&&ccOwner(offer.target)===enemy?2:-3;
 if(mode==='clash'||mode==='strangle'||mode==='killHit'||mode==='retwinDestroy'||mode==='insult')return 2.3-cost*0.35;
 if(mode==='captiveFury'){const totals=battleTotals(offer.site),captives=ccUnits().filter(entry=>entry.slot===offer.site).flatMap(entry=>ccCaptives(entry.card)).filter(card=>!card.frozen);return totals[side.toLowerCase()+'Power']+captives.reduce((sum,card)=>sum+(card.power??0),0)>totals[enemy.toLowerCase()+'Power']+2?2:-2;}
 if(mode==='offEdge')return view.life>10?0.1:-2;
 if(mode==='sabacc')return ccOwn(side).hand.length<5&&view.life>8?0.2:-1;
 if(mode==='weatherDeploy')return ccVanes().length?-1:0.5;
 if(mode==='sell')return ccOwn(side).deck.length>5?0.5:-1;
 if(mode==='retwinHide')return battleSession?.hitUnits?.[side]?.includes(offer.card)?2:-1;
 if(mode==='bribeJerrol')return 0.5;
 if(mode==='convertLando')return 4;
 return 0.7-cost*0.2;
};
hothPromptChoice=function(offers,frame){
 if(!cloudCityEnabled())return ccBotBase.prompt(offers,frame);
 if(frame?.mode==='hothDagSearch'){const choices=offers.filter(offer=>offer.card);return choices.sort((a,b)=>((b.card.power??0)+(b.card.ability??0)-(b.card.deploy??0)*0.4)-((a.card.power??0)+(a.card.ability??0)-(a.card.deploy??0)*0.4))[0]??ccBotBase.prompt(offers,frame);}
 if(!frame?.mode?.startsWith('hothDagCloud'))return ccBotBase.prompt(offers,frame);
 if(frame.botChoice)return frame.botChoice(offers);
 if(frame.mode==='hothDagCloudLukeFate')return offers.find(offer=>offer.args[0]==='cross')??offers[0];
 if(frame.mode==='hothDagCloudGamblerDestiny')return offers.reduce((best,offer)=>(offer.draw?.value??Infinity)<(best.draw?.value??Infinity)?offer:best,offers[0]);
 if(frame.mode==='hothDagCloudScoundrel')return offers.find(offer=>offer.args[0]==='target')??offers[0];
 if(frame.mode==='hothDagCloudRitePassage')return offers.find(offer=>offer.args[0]==='move')??offers.find(offer=>offer.args[0]==='force')??offers[0];
 if(frame.mode==='hothDagCloudChasm')return offers.find(offer=>offer.args[0]===(lifeForceRemaining(frame.side)>5?'force':'character'))??offers[0];
 return ccBotBase.prompt(offers,frame);
};
