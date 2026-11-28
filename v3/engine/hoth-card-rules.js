'use strict';

// Loaded together with the Hoth session. Existing registrations are never replaced.
const HothCardRules = (() => {
 const definitions=[];
 const effect=(event,summary,fields={})=>({event,summary,since:31,cost:0,duration:'continuous',...fields});
 const printed=(printedSide,event,summary,fields={})=>effect(event,summary,{printedSide,...fields});
 const register=(ids,effects,complete=true)=>ids.forEach(id=>definitions.push({id,effects,complete}));
 const drain=(side,amount=1)=>printed(side,'forceDrain','Bei Kontrolle Force Drain '+(amount>0?'+':'')+amount+'.',{amount});
 register(['Light:1163','Dark:1162'],['Light','Dark'].map(side=>printed(side,'fleetPower','Bei Kontrolle unterstützt jedes eigene Starship Battles an Hoth-Sites mit +1 Power.',{region:'hoth'})));
 register(['Light:5582'],[drain('Light'),drain('Dark'),printed('Light','hothTrooperDeploy','Echo Base Trooper deployen hier für 1 Force weniger.')]);
 register(['Light:1169'],[printed('Light','hothLeaderPower','Bei Kontrolle erhöht jeder eigene Leader hier die gesamte Power in Battles an Hoth-Locations um 1.'),
  printed('Dark','extraBattleDestiny','Als Angreifer hier eine zusätzliche Battle Destiny ziehen.',{amount:1}),drain('Dark',-1)]);
 register(['Light:1171'],[printed('Light','hothRaise','Bei Kontrolle einmal pro Zug für 4 Force eine konvertierte Hoth-Site anheben.')]);
 register(['Light:1173'],[printed('Light','dockingTransit','Docking-Bay-Transit von hier kostet 1 Force.',{cost:1}),
  printed('Dark','dockingTransit','Docking-Bay-Transit von hier kostet 3 Force.',{cost:3}),printed('Dark','hothArrivalTax','Docking-Bay-Transit hierher kostet 4 zusätzliche Force.',{amount:4})]);
 register(['Light:1174'],[printed('Light','hothMedicalDeploy','Einmal pro Zug den nächsten Medical Droid für 2 Force weniger ausspielen.'),
  printed('Dark','hothImperialDrain','Bei Kontrolle und eigenem Imperial present: Force Drain +1.')]);
 register(['Light:5586'],[...['Light','Dark'].map(side=>printed(side,'hothGenerator','Energieschild für Echo Base und Marker 1–3; Marker 4–6 oder Pflichtsuche nach North Ridge im Reserve; bei Zerstörung verliert Light 8 Force.')),printed('Light','hothGeneratorPower','Eigene Artillerie hier wird vom Generator gespeist.')]);
 register(['Light:5590'],['Light','Dark'].map(side=>printed(side,'hothNotEpic','North Ridge zählt bei Berechnungen von Epic Events nicht.')));
 register(['Light:5591'],[printed('Light','weaponDestiny','Jeder eigene Waffen-Destiny-Draw von hier erhält +1.',{amount:1}),
  printed('Dark','hothGeneration','Bei Kontrolle Force-Generierung +1.',{amount:1})]);
 register(['Light:1854'],[printed('Light','hothHunterForfeit','Bei Kontrolle haben sämtliche gegnerischen Bounty Hunters Forfeit −2.'),
  printed('Dark','hothHunterPilot','Eigene Bounty Hunter als Piloten geben Starships hier +1 zusätzliche Power.')]);
 register(['Dark:6353'],[printed('Dark','weaponDestiny','Jeder eigene Waffen-Destiny-Draw von hier erhält +1.',{amount:1}),drain('Dark'),
  printed('Light','forfeit','Eigene Troopers hier haben Forfeit −1.',{targets:'trooper',amount:-1})]);
 register(['Dark:1168'],[printed('Dark','hothIgnition','Commence Primary Ignition gegen Hoth erhält +1.'),
  printed('Light','hothTakeoffFree','Bei Kontrolle ist die Bewegung eigener Starships von Hoth-Sites zum Hoth-System frei.')]);
 register(['Dark:1170'],[printed('Dark','hothRaiseAll','Bei eigener Besetzung alle eigenen konvertierten Hoth-Locations anheben.')]);
 register(['Dark:1172'],[printed('Dark','dockingTransit','Docking-Bay-Transit von hier kostet 2 Force.',{cost:2}),printed('Light','dockingTransit','Docking-Bay-Transit von hier kostet 1 Force.',{cost:1})]);
 register(['Dark:6354'],[printed('Dark','hothIceJump','In eigener Bewegungsphase kostenlos zwischen Ice Plains und Mountains wechseln.'),
  printed('Light','hothGeneratorDrainPenalty','Bei Kontrolle und Generatoren auf dem Tisch Force Drain −1.')]);
 register(['Dark:6358'],[printed('Dark','hothAtatFree','Eigene AT-ATs bewegen sich kostenlos hierher.')]);
 register(['Dark:6359'],[printed('Dark','hothWampaFree','Eigene Wampas deployen hier kostenlos.'),printed('Light','hothGeneratorDrainPenalty','Bei Kontrolle und Generatoren auf dem Tisch Force Drain −1.')]);
 register(['Dark:1853'],[printed('Dark','hothHunterDeploy','Eigene Bounty Hunters deployen hier für 2 Force weniger.')]);

 for(const [id,targets,cost,summary] of [
  ['Light:135','warrior',2,'Für 2 Force auf eigenen Warrior: Artillerie auf demselben Planeten fernbedienen und einmal in eigener Control feuern.'],
  ['Light:811','trooper',0,'Auf eigenen Trooper: beliebig viele Waffen und Devices; an einer Planeten-Site immun gegen Attrition unter 3.'],
  ['Light:1165','rebel-or-warrior',0,'Auf einen Rebel oder Warrior: auf Hoth Power/Forfeit +1 und Schutz vor Frostbite, Exposure und Ice Storm.'],
  ['Light:1990','r-unit',0,'Auf einen R-Unit-Droid: Suchbonus +3 am selben/benachbarten Site und React-Flucht eigener Characters present vor Creature-Angriffen.'],
  ['Dark:692','star-destroyer',3,'Für 3 Force auf einen Star Destroyer: Armor +2 und vorhandene Attrition-Immunität um 2 erhöhen.'],
  ['Dark:823','atat-cannon',2,'Für 2 Force auf eine AT-AT Cannon: Reichweite zwei Sites; Target The Main Generator +1.'],
  ['Dark:1925','warrior',0,'Auf einen Warrior: Blaster-Rifle- und Artillerie-Draws +1; optional einem Droid present Power +1 geben, bis er nicht mehr present ist oder die Verstärkung abgeschaltet wird.'],
  ['Dark:1949','droid',1,'Auf eigenen Probe Droid kostenlos und X +2; auf anderem eigenen Droid für 1 Force, in eigener Control bei Kontrolle eine zufällige gegnerische Handkarte ansehen.'],
 ])register([id],[effect('device',summary,{targets,cost,allowOpponent:['Light:1165','Light:1990','Dark:692','Dark:823','Dark:1925'].includes(id)})]);

 register(['Light:2119'],[effect('pilotAttritionImmunity','Mit Luke als Pilot immun gegen Attrition unter 3.',{pilot:'luke',persona:'luke',below:3}),effect('hothReact','Darf nur auf Hoth reagieren.')]);
 register(['Light:2120'],[effect('pilotAttritionImmunity','Mit Zev als Pilot immun gegen Attrition unter 3.',{pilot:'zev senesca',below:3}),effect('hothSearchBonus','Suchgruppe +2, wenn alle Piloten mit suchen.')]);
 register(['Light:2121'],[effect('pilotAttritionImmunity','Mit Wedge als Pilot immun gegen Attrition unter 3.',{pilot:'wedge antilles',below:3}),effect('hothReact','Darf nur auf Hoth reagieren.')]);
 register(['Light:2294'],[effect('hothReact','Darf auf Hoth reagieren; permanenter Pilot hat Ability 1.')]);
 register(['Light:2480'],[effect('reactAway','Kann aus einem Battle heraus reagieren.'),effect('hothTauntaun','Ability ¼; ein Reiter; nur auf Hoth deployen; Opfer schützt einen Reiter vor Exposure.')]);
 register(['Light:1665'],[effect('hothTransport','Ein Pilot, vier Passagiere, ein Fahrzeug; Deploy und Bewegung wie Starfighter; permanenter Pilot Ability 1.')]);
 register(['Dark:267','Dark:274'],[effect('attritionImmunity','Immun gegen Attrition unter 4.',{below:4}),effect('hothAtat','Zwei Piloten, acht Passagiere; Landspeed niemals über 1.')]);
 register(['Dark:269'],[effect('attritionImmunity','Immun gegen Attrition unter 4.',{below:4}),effect('hothAtat','Ein Pilot und acht Passagiere; permanenter Pilot Ability 2; Landspeed niemals über 1.')]);
 register(['Dark:272'],[effect('hothReact','Darf reagieren.'),effect('hothScout','Ein Pilot oder Passagier; auf Hoth Power +1; permanenter Pilot Ability 1.')]);
 register(['Dark:2339'],[effect('hothStalker','Probe Droids deployen kostenlos zu Sites desselben Systems; sechs Piloten, acht Passagiere, zwei Fahrzeuge und vier TIEs.')]);
 register(['Dark:2657'],[effect('hothTyrant','Tractor-Beam-Destiny +1; sechs Piloten, acht Passagiere, zwei Fahrzeuge und vier TIEs.')]);

 for(const [ids,event,summary,cost] of [
  [['Light:987','Dark:986'],'locationEffect','Auf Hoth-System: am Zugende verliert der aktive Spieler je ungeschütztem Character an nächtlichen Markern 1 Force, bei vermissten 2.',0],
  [['Light:1241','Dark:1240'],'locationEffect','Vom äußersten Marker zieht der Sturm in eigener Control nach innen, kehrt um und verlässt Hoth. Characters present werden vermisst.',0],
  [['Light:184'],'tableEffect','Für 4 Force auslegen; einen gerade verlorenen Non-Droid als Patienten halten und in eigener Deploy für X Force auf die Hand nehmen.',4],
  [['Light:736'],'tableEffect','Während einer Deploy-Phase auf eine Creature außer Space Slug, wenn eigener bewaffneter Character am selben Site: Ferocity um eigene Destiny verringern.',0],
  [['Light:805'],'locationEffect','Bei Besetzung von drei Echo-Sites auf Generatoren: an Systemen Deploy −1, Force Drain +2 und Battle-Power +3; fünf besetzte Hoth-Sites des Gegners heben den Effect auf. Immun gegen Alter.',0],
  [['Light:889'],'locationEffect','Auf eigene War Room: Ion Cannon einmal in eigener Move-Phase feuern; Medium Transports desselben Planeten bewegen kostenlos, Hyperspeed +2 und Immunität unter 3.',0],
  [['Light:2481'],'tableEffect','Für 1 Force auslegen: jede gegnerische Destiny löst je nach Wert die zugehörige Used-, Force-, Retrieval- oder Deploy-Folge aus.',1],
  [['Light:2530'],'locationEffect','Medium Transport von Hoth-Site zum Zielsystem führen, doppelte Passagierzahl zurückholen; danach Hoth-Battles +2 Power.',0],
  [['Dark:327'],'tableEffect','Nach Bewegung eines Imperial zu Echo auslegen; bei eigener Echo-Presence Hoth-Site-Battles +1 Power.',0],
  [['Dark:650'],'locationEffect','Für 3 Force auf Außen-Site, gegnerischen Smuggler wählen: dessen Spieler verliert jede eigene Control 1 Force; bei Ankunft kommt der Smuggler auf Used.',3],
  [['Dark:651'],'locationEffect','Auf ein System: eigene Power +1 je eigenem Starship present; Troopers und Combat Vehicles shuttlen zu verwandten Sites kostenlos.',0],
  [['Dark:990'],'tableEffect','Auf gegnerischen Character allein an Wampa Cave: Power 0, keine Bewegung; Lichtschwert oder Ability über 4 hebt ihn auf. Eine Mahlzeit steigert Ferocity dauerhaft um 2.',0],
  [['Dark:1142'],'tableEffect','Nach gegnerischem Missing mit Ability über 2: Rebel mit Ability über 2 desselben Planeten vom Battle ausschließen, bis der Vermisste nicht mehr missing ist.',0],
  [['Dark:1253'],'locationEffect','Für 4 Force bei mindestens drei gegnerischen Force mehr: hier, angrenzend und bei Vader nur mit Presence Force aktivieren.',4],
  [['Dark:1270'],'locationEffect','Bei Kontrolle ohne Drain in eigener Control erzeugt der Gegner hier in seinem nächsten Zug keine Force.',0],
  [['Dark:1673'],'locationEffect','Für 2 Force auf Außen-Site: Ziel-Character darf den Planeten nicht verlassen und sich nicht vom Zielort entfernen; bei Ankunft aufheben.',2],
  [['Dark:1706'],'tableEffect','Nach Han-Verlust oder Missing auf Chewie: Wookiee-Interrupts sperren; Chewies Spieler verliert jedes Zugende 1 Force. Bei Han auf dem Tisch aufgehoben.',0],
  [['Dark:2098'],'locationEffect','Für 2 Force auf Rebel-Base-War-Room: ausgewählten Rebel mit Forfeit über 4 oder gegnerischen Leader zum Ziel schicken; dort keine gegnerischen Battle-/Drain-Initiierungen.',2],
  [['Dark:2266'],'tableEffect','Für 2 Force auslegen: keine React-Bewegung oder React-Deploys an Locations mit Droid present; Scomp Link Access hebt den Effect auf.',2],
  [['Dark:2541'],'locationEffect','Zwischen Echo Docking Bay und innerstem Marker: bei Nacht darf die Bay nur zu/von Echo-Sites passiert werden.',0],
  [['Dark:2572'],'tableEffect','Auf männlichen Character, weiblichen Character wählen: Ziel Power −2; bei gemeinsamem Present aufgehoben.',0],
  [['Dark:2615'],'tableEffect','Für 2 Force auslegen: Nicht-Creature-Vehicles an nächtlichen Markern haben Power, Maneuver und Landspeed 0.',2],
  [['Dark:2772'],'locationEffect','Auf Docking Bay: ausgewählte Waffe auf Vehicle/Starfighter kann bis zur Ankunft nicht feuern.',0],
 ])register(ids,[effect(event,summary,{cost})]);
 for(const [id,summary] of [
  ['Light:5300','Einmal pro Zug eigenen gerade verlorenen Non-Droid vom selben Site auf Used retten; Bacta-Tank-X −2.'],
  ['Light:345','Am Defensive Perimeter Power +1; eigene Fahrzeuge bewegen sich kostenlos zu seinem Site hin.'],
  ['Light:498','Nur auf Hoth deployen. Pilot +3 Power, Rogue 1 Maneuver +2; Immunität unter 3; andere Rogue-Squadron-Piloten/Kanoniere am selben Hoth-Site Forfeit +1.'],
  ['Light:595','Als Passagier Waffen-Destiny +1, auf Rogue 1 oder mit Luke stattdessen +3.'],
  ['Light:707','Mit Biggs Power +2. Pilot +2 Power, bei Star Destroyer present stattdessen +3; Rogue 4 Maneuver +2.'],
  ['Light:807','Nur auf Hoth deployen; an anderen Sites Power −1.'],
  ['Light:808','Nur auf Hoth deployen. Echo Base Troopers hier Deploy −1; eigene Troopers dürfen zu seinem Hoth-Site reagieren.'],
  ['Light:815','Andere eigene Droids present außer Power Droids erhalten Power +1. Destiny 0; als Battle Destiny bei niedrigerer eigener Power diese einmal verdoppeln.'],
  ['Light:1001','Einmal pro Zug einen getroffenen, forfeiteten Non-Droid von hier oder angrenzend auf Used retten; Bacta-Tank-X kumulativ −2.'],
  ['Light:1018','Rebels present with him an Hoth-Site Power +1; Death Squadron für 1 Force aufheben; an Echo braucht der Gegner einen zusätzlichen Site gegen Echo Base Operations.'],
  ['Light:1391','Pilot +2 Power; mit Rebel-Leader in Battle gegnerische gesamte Battle Destiny −1.'],
  ['Light:1404','Kann Battles initiieren und nimmt daran teil. An Hoth/Yavin-4-Site Power +1 je anderem eigenen Droid present; mit eigenem Droid present ein Leader.'],
  ['Light:1621','Auf Hoth keine gegnerischen Reacts zu Echo; Breached Defenses für 1 Force aufheben. Cantina Power +1 und Local Trouble für 1 Force aufheben.'],
  ['Light:1997','In eigener Control verliert der Gegner je Spy present 1 Force, bei Droid oder Undercover 2, bei beidem 4.'],
  ['Light:2004','Aboard Capital: dessen Power und Hyperspeed +1; Immunität unter 3.'],
  ['Light:2045','Kostenlos zum gegnerisch initiierten Battle reagieren, wenn dort eigener Rebel mit Ability über 2 oder Rebel-Leader ist.'],
  ['Light:2126','Als Passagier Waffen-Destiny seines Trägers +1.'],
  ['Light:2128','Pilot Power und Maneuver +1; Gegner kann nicht zur oder von derselben Location reagieren.'],
  ['Light:2249','Nach eigenem Battle-Beginn dürfen noch nicht kämpfende Troopers von benachbarten Sites sofort eine reguläre Bewegung hierher machen.'],
  ['Light:2413','Pilot +2 Power. Eigene Starships von seinem Exterior-Site bewegen kostenlos; an Echo Docking Bay einmal pro Zug einen Hoth-Character vor Shield Doors schützen.'],
  ['Light:2483','Als Creature-Vehicle-Reiter Power +2; auf Tauntaun eine Battle Destiny ziehen, falls sonst nicht möglich.'],
  ['Light:2606','Deploy nur Hoth/Yavin 4; gegnerische Imperials und Aliens können von seinem Site nicht zu Echo oder Yavin-4-Interior weiterziehen.'],
  ['Light:2618','Pilot +2 Power. An War Room Waffen-Destiny eigener Planet Defender Ion Cannon desselben Planeten +1.'],
  ['Light:2782','An Außen-Planeten-Site/Docking Bay einmal pro Zug für 1 verlorene Force ein getroffenes Craft von hier/angrenzend/verwandtem System auf Used retten.'],
  ['Light:2796','Als Passagier Waffen-Destiny +1; auf Rogue 3 oder mit Wedge/Jek stattdessen +3.'],
  ['Light:2836','Einmal eigene Control X zufällige gegnerische Handkarten ansehen, X = Dark-Icons am selben Site. Eigene Destiny mit scan im Titel +2.'],
  ['Light:2911','Pilot +2 Power; auf Rogue 2 Maneuver +3 und eine Battle Destiny, falls sonst nicht möglich.'],
  ['Dark:62','Pilot +2 Power; eigene Capitals am selben System Deploy −1. Bei Vader auf dem Tisch und gegnerischem React zu seiner Location verloren.'],
  ['Dark:160','Als Combat-Vehicle-Pilot Power +2, auf AT-AT stattdessen +3.'],
  ['Dark:363','Pilot +2 Power, Tyrant +3. Aboard Star Destroyer einmal eigene Control dessen Tractor Beam benutzen.'],
  ['Dark:368','Mit Vader am selben Site Power +1. Pilot +2, Executor +3. Für 1 Force Probe Droid im Reserve suchen, auf die Hand nehmen und mischen.'],
  ['Dark:1000','Einmal pro Zug einen getroffenen, forfeiteten Non-Droid vom selben oder angrenzenden Site auf Used retten.'],
  ['Dark:1029','Mit Ozzel am selben Site Power +1. Imperials am selben Hoth-Site Power +1. Combat-Pilot +3; auf Blizzard 1 Armor +1 und Battle Destiny, falls sonst nicht möglich.'],
  ['Dark:1272','Als Passagier Waffen-Destiny seines Trägers +1.'],
  ['Dark:1521','Pilot +2 Power; Tyrant Armor +1. Mit Imperial-Leader im Battle gegnerische gesamte Battle Destiny −1.'],
  ['Dark:1950','Nur bei Star Destroyer auf dem Tisch deployen. Einmal eigene Control X zufällige Handkarten ansehen (Light-Icons hier); kann drainen, Battle initiieren und kämpfen.'],
  ['Dark:2295','Nur auf Hoth deployen; an anderen Sites Power −1.'],
  ['Dark:2296','Nur auf Hoth deployen. Snowtroopers hier Deploy −1; Troopers dürfen zu seinem Hoth-Site reagieren.'],
 ])register([id],[effect('hothCharacter',summary),...(id==='Dark:368'?[effect('unitReserveSearch','Für 1 Force Probe Droid im Reserve suchen.',{names:['probe droid'],display:'Probe Droid',cost:1})]:[])]);
 register(['Dark:2737'],[effect('hothCreature','Habitat Hoth; Wampa Cave oder unbesetzter Marker zum Deploy. Ferocity 3 plus Destiny, Abwehr 3. Gegner wählt bei besiegtem Character zwischen Fressen und möglichem Versetzen zur Cave.')]);
 register(['Dark:2422'],[effect('hothEpic','Eigene Control: AT-AT Cannon in Reichweite feuern. Destiny plus Ability eines gewählten Piloten plus kontrollierte Hoth-Sites plus Kartenboni über 8 zerstört Generatoren; Light verliert 8 Force. Sonst Epic auf Used.')]);
 const counters=new Map([
  ['Light:615',['dark collaboration','lone pilot']],
  ['Light:1902',['probe telemetry']],
  ['Light:2805',['scruffy-looking nerf herder',"i'd just as soon kiss a wookiee",'furry fury','this is just wrong','death mark','mournful roar','takeel','ket maliss']],
  ['Dark:995',['wookiee roar',"han's back",'life debt']],
  ['Dark:1552',['lightsaber proficiency']],
  ['Dark:1869',['the first transport is away!','hyper escape']],
  ['Dark:2187',['solo han',"warrior's courage",'i know']],
  ['Dark:2645',["han's toolkit",'crash site memorial']],
 ]);
 for(const [id,summary] of [
  ['Light:167','Nach Battle-Beginn einen führenden T-47 wählen; die anderen T-47s hier erhalten für diesen Zug Power +1, Attrition-Immunität und Schutz vor Waffen.'],
  ['Light:615','Used: Dark Collaboration oder Lone Pilot aufheben. Lost: bei zwei gegnerischen Imperials mit Ability über 2 für 2 Force zwei Destiny von gegnerischer Power und Attrition abziehen.'],
  ['Light:920','Nach gegnerischem Außen-Battle mit mehr als doppelter Power für 1 Force alle eigenen Characters present an einen benachbarten Site ohne gegnerische Presence zurückziehen; Battle aufheben.'],
  ['Light:1220','Creature Vehicle opfern, um einen Character present bis Zugende vor Wetter zu schützen; Ronto schützt zwei. Oder Tzizvvts Power bis zu dessen Bewegung verdoppeln.'],
  ['Light:1330','Für 3 Force eine gerade gegnerisch ausgespielte Figur/Ausrüstung auf die Hand zurückgeben; im nächsten gegnerischen Zug eine Karte desselben Titels kostenlos deployen.'],
  ['Light:1589','Vor Waffen-Destiny gegen Combat Vehicle einen Draw um 1 (Used) oder 3 (Lost) erhöhen.'],
  ['Light:1773','Eigenen Vermissten bei eigenem bemannten Fahrzeug auf Used retten; alternativ den Versuch aufheben, einen Character im Battle zu verstecken.'],
  ['Light:1836','Vor einem Power-Harpoon-Draw die Ability eines gewählten Piloten des Trägers addieren.'],
  ['Light:1902','Für 1 Force eine verdeckte Location-Karte ansehen oder gegnerische Hand ansehen und Droid-Spies/Infantry Mines dort auf Used legen; alternativ Probe Telemetry aufheben.'],
  ['Light:2137','Mit Luke und Chewie im Battle zwei Battle Destiny ergänzen; alternativ mit Rebel und Alien +4 Power.'],
  ['Light:2671','In eigener Control mit eigenem Warrior ein Vehicle mit Armor present angreifen; Destiny-Bonus durch Granate/Lichtschwert, bei Erfolg Vehicle und Granate verlieren.'],
  ['Light:2734','Nach gegnerischem AT-AT-Deploy oder Bewegung zu Planeten-Site bis zu drei passende Außen-Sites im Reserve suchen und sofort deployen.'],
  ['Light:2805','Die genannten Gegenkarten aufheben oder Renneks Power bis Zugende verdoppeln.'],
  ['Light:2881','Nach gegnerischem Battle-Beginn bei Vader auf dem Tisch einen beteiligten Leader mit Ability unter 6 wählen; wenn Gegner nicht gewinnt, Forfeit 0 und verloren, Ozzel aus dem Spiel.'],
  ['Light:2888','In eigener Control für 1 Force einen eigenen Hoth-Character mit Ability über 1 zu Dagobah mit eigener Presence versetzen; Dagobah-Site ohne Kosten/Presence.'],
  ['Dark:18','Nach gegnerischem Planeten-Site-Deploy das passende System im Reserve suchen und sofort deployen.'],
  ['Dark:465','Character am Marker mit Destiny (nachts +2) über Ability bis Zugende an Bewegung hindern.'],
  ['Dark:466','Nach AT-AT-Bewegung zum innersten Marker eine unterirdische Hoth-Site mit Destiny über der Markernummer einstürzen lassen.'],
  ['Dark:513','Nach gegnerischem React ein eigenes Vehicle/Starship in Reichweite als reguläre Bewegung an diese Location bewegen.'],
  ['Dark:584','Mit bemanntem AT-AT ein gegnerisches Nicht-Creature-Vehicle present hier/angrenzend mit Destiny über 3 abstürzen lassen; AT-AT mit Vehicle-Waffe gibt +1.'],
  ['Dark:684','Nach Verlust eines AT-AT/AT-ST, Sail Barge oder Planet Defender Ion Cannon am Site Destiny ziehen; alle Karten mit dieser Destiny dort verlieren.'],
  ['Dark:733','Vor Waffen-Destiny gegen Combat Vehicle einen Draw um 1 (Used) oder 3 (Lost) erhöhen.'],
  ['Dark:913','Gegner verliert je Vermisstem 1 Force; alternativ einen vermissten Character bei Nacht verlieren lassen.'],
  ['Dark:916','Eigene Control: X Force für alle Characters present/missing an nächtlichen Außen-Markern bezahlen; ungeschützte Characters verlieren.'],
  ['Dark:995','Used: Wookiee Roar, Han’s Back oder Life Debt aufheben. Lost: mit Han und Chewie im Battle zwei Destiny von gegnerischer Power und Attrition abziehen.'],
  ['Dark:1114','Eigene Control: Character allein an eigenem Außen-Site außer Docking Bay mit Destiny +3 über Ability vermisst machen.'],
  ['Dark:1226','Für 3 Force eine gerade gegnerisch ausgespielte Figur/Ausrüstung auf die Hand zurückgeben; im nächsten gegnerischen Zug eine Karte desselben Titels kostenlos deployen.'],
  ['Dark:1285','1 Force verlieren, danach 2 Force aktivieren (Used) oder 4 (Lost).'],
  ['Dark:1552','Lightsaber Proficiency aufheben; alternativ gegen Ability unter 4 während Battle/Drain mit Lichtschwert Destiny ziehen: über Ability Character, bei Gleichstand Schwert verlieren.'],
  ['Dark:1826','Stehlen/Treffen/Verlieren eines eigenen Droid verhindern und bis Zugende schützen; alternativ einen Binary Droid bis Zugende ausschalten.'],
  ['Dark:1869','Tractor-Beam-Destiny +2; alternativ The First Transport Is Away! oder Hyper Escape aufheben.'],
  ['Dark:1953','Für 2 Force X nicht-einzigartige Karten aus einem Lost Pile entfernen, X = Probe Droids auf dem Tisch; alternativ Deploy-Bonus auf Planet des alleinigen eigenen Probe Droid.'],
  ['Dark:2187','Used: Solo Han, Warrior’s Courage oder I Know aufheben. Lost: mit Han und Leia im Battle zwei Destiny von gegnerischer Power und Attrition abziehen.'],
  ['Dark:2209','Eigenen Droid verlieren, um Attrition hier für diesen Zug aufzuheben; alternativ Waffen auf eigenen Droid umlenken und ursprünglichen Forfeit verwenden.'],
  ['Dark:2353','Creature Vehicle am Marker mit Destiny (nachts +2) verlieren lassen: Tauntaun über 5, andere über 3.'],
  ['Dark:2399','1 Force verlieren und bis zu drei Troopers im Reserve suchen, auf die Hand nehmen und mischen.'],
  ['Dark:2511','Eigene Control mit Probe Droid am Site: eigenes Starship zum zugehörigen System bewegen; es bewegt sich in diesem Zug nicht erneut.'],
  ['Dark:2627','Mit bemanntem AT-AT/AT-ST Character, abgestürztes oder unbemanntes Vehicle ohne Armor present zertrampeln: Destiny über Ability bzw. unter 7.'],
  ['Dark:2645','Used: Rettung eines getroffenen Craft/Droid auf Used oder Han’s Toolkit aufheben. Lost: Crash Site Memorial aufheben.'],
  ['Dark:2732','Mit bemanntem AT-AT Artillerie hier/angrenzend angreifen: Destiny +1 über Forfeit verliert Waffe; über 6 zusätzlich einen zufälligen gegnerischen Character am Ziel-Site.'],
  ['Dark:2736','Mit bemanntem AT-AT beliebig viele gegnerische Troopers present hier/angrenzend wählen; Destiny über deren Anzahl verliert alle ausgewählten.'],
  ['Dark:2842','Creature Vehicle bei Creature wählen; Ferocity über Maneuver plus Landspeed frisst das Vehicle und erhöht Ferocity dauerhaft um 2.'],
 ])register([id],[effect('hothInterrupt',summary),...(id==='Dark:1826'?[effect('droidShutdown','Gegnerischen gezielten Verlust, Treffer oder Diebstahl eines eigenen Droids aufheben; Schutz bis Zugende.')]:[]),...(counters.has(id)?[effect('namedCancellation','Genannte Karte aufheben.',{names:counters.get(id)})]:[])]);
 for(const [ids,summary] of [
  [['Light:109'],'Auf Skywalker mit Ability über 3: optional Drain +1. Kostenlos zwei Destiny gegen Character/Creature; Treffer setzt Forfeit auf 0.'],
  [['Light:161'],'Artillerie am Außen-Planeten-Site: Warrior und Energie erforderlich. Für 2 Force Vehicle hier/angrenzend angreifen; Destiny +2 über Armor stürzt es ab, +1 über Maneuver trifft.'],
  [['Light:515'],'Für 2 Force auf Warrior. Wurf am selben/angrenzenden Site: bei Destiny 0 nur Werfer verloren, sonst alle Characters/Waffen/Devices present mit dieser Destiny; Granate verloren.'],
  [['Light:793'],'Für 2 Force auf T-47. Für 1 Force Destiny gegen Character/Creature −1, gegen Vehicle +2; über Abwehr getroffen.'],
  [['Light:1044'],'Artillerie am Außen-Planeten-Site mit Warrior und Energie: für 2 Force Character/Creature/Vehicle hier/angrenzend beschießen; gegen Character/Creature Destiny +2.'],
  [['Light:1307','Dark:1306'],'Infantry Mine bei eigenem Mining Droid außen: bei passendem Deploy oder Bewegung ohne Vehicle/Starfighter ein Ziel wählen. Destiny +2 über Ability verliert den Character; Mine immer verloren.'],
  [['Light:1664'],'Artillerie am Site mit Warrior und Energie: für 2 Force bis zwei Characters oder zwei Creatures an demselben/angrenzenden Site mit zwei Destiny gegen gesamte Abwehr treffen. Zwei Warriors bewegen sie für zusätzliche 1 Force.'],
  [['Light:1910'],'Artillerie an Außen-Rebel-Base-Site: mit Warrior/Energie während Battle für 2 Force Capital am verwandten System beschießen. Destiny +3 über Armor verliert seine Waffen und setzt Power/Hyperspeed auf 0.'],
  [['Light:1929'],'Für 2 Force auf Combat-/Shuttle-Vehicle: für 1 Force AT-AT/AT-ST mit Destiny plus eigener Maneuver über 8 abstürzen lassen; Destiny 0 stürzt den eigenen Träger ab.'],
  [['Light:2383'],'Für 1 Force auf Starfighter, kostenlos auf Falcon. Für 1 Force Character/Creature am selben Site mit Destiny +1 über Abwehr treffen.'],
  [['Light:2710','Dark:2709'],'Vehicle Mine bei eigenem Mining Droid außen: Starfighter (Abwehr 5) oder Nicht-Creature-Vehicle bei Deploy/Bewegung/Überqueren mit Destiny +2 über Abwehr verlieren; Mine immer verloren.'],
  [['Dark:158'],'Für 2 Force auf AT-AT. Für 2 Force Starfighter (Abwehr 3), Character/Creature (+1) oder Vehicle (+2) hier/angrenzend beschießen; über Abwehr getroffen.'],
  [['Dark:894'],'Artillerie am Site mit Warrior/Energie: für 2 Force Destiny +1 gegen Character/Creature/Vehicle oder gelandeten Starfighter (Abwehr 5) am selben Site. Zwei Warriors bewegen sie für zusätzliche 1 Force.'],
  [['Dark:1952'],'Kostenlos auf Probe Droid: kostenlos Artillerie (Abwehr 5), Character oder Creature present beschießen; über Abwehr Artillerie verloren, sonst Treffer.'],
 ])register(ids,[effect('hothWeapon',summary)]);
 PremiereCardRules.registerExpansion(definitions);
 return Object.freeze({definitions});
})();
