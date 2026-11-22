const PremiereCardRules = (() => {
  const cards = new Map();
  const register = (ids, effects, complete = false) => {
    for (const id of ids) cards.set(id, { effects, complete });
  };
  const continuous = (event, summary, targets, test, fields = {}) => ({
    event, summary, targets, test, cost: 0, duration: 'continuous', expires: 'when the condition ends', ...fields,
  });
  const atLocation = (printedSide, event, targets, amount, summary, legacy = false) =>
    continuous(event, summary, targets, 'registered Premiere locations', { printedSide, amount, legacy });
  const characterStat = (event, amount, summary, options) => continuous(event, summary, 'character at a site',
    'registered character stat rules', { amount, since: 2, ...options });
  const printed = (printedSide, event, summary, fields = {}, test = 'registered location text follows printed sides') =>
    continuous(event, summary, 'active side of location', test, { printedSide, legacy: true, ...fields });
  const drain = side => printed(side, 'forceDrain', 'Wer diese Seite kontrolliert, erhält beim Force Drain hier +1.', { amount: 1 });
  const weaponDestiny = printed('Dark', 'weaponDestiny', 'Jeder eigene Waffen-Destiny-Draw von hier erhält +1.', { amount: 1 });
  const minimumSix = side => printed(side, 'minimumBattleAbility', 'Für reguläre Battle Destiny ist hier mindestens Ability 6 erforderlich.', { amount: 6 });

  for (const [id, light, dark] of [
    ['Light:676', 1, 1], ['Dark:675', 2, 0], ['Light:2447', 1, 2],
    ['Dark:2446', 2, 1], ['Light:2853', 0, 2], ['Dark:2852', 1, 1],
  ]) {
    register([id], [['Light', light], ['Dark', dark]].map(([side, cost]) =>
      printed(side, 'dockingTransit', 'Docking-Bay-Transit von dieser Seite kostet ' + cost + ' Force.', { cost })), true);
  }
  register(['Light:608'], [
    printed('Light', 'shipDeploy', 'Capital Starships werden hier für 2 Force weniger und Starfighters für 1 Force weniger ausgespielt.',
      { fighterDiscount: 1, capitalDiscount: 2 }),
    drain('Dark'),
  ], true);
  register(['Dark:607'], [
    printed('Dark', 'shipReact', 'Eigene Starships können sich als React hierher bewegen.', {}, 'starships react to the printed side of Dantooine'),
  ], true);
  register(['Dark:79'], [
    printed('Dark', 'controlSiteDrain', 'Beim Force Drain hier zählt jede kontrollierte Death-Star-Site als +1.', { region: 'Death Star' }),
  ], true);
  register(['Light:672'], [
    drain('Light'),
    printed('Light', 'releasePrisoners', 'Bei Kontrolle werden die auf dem Todesstern inhaftierten Charaktere an ihrer jeweiligen Site befreit.',
      { since: 5, region: 'death star' }, 'Detention Block releases only imprisoned characters'),
  ], true);
  register(['Dark:669'], [
    drain('Light'),
    printed('Dark', 'freeNamedDeploy', 'Bei Kontrolle werden Wrong Turn und Retract The Bridge frei ausgespielt.',
      { since: 5, names: ['wrong turn', 'retract the bridge'] }, 'Central Core waives Wrong Turn'),
    printed('Light', 'cancelSiteDevice', 'Bei Kontrolle wird Death Star Tractor Beam aufgehoben.',
      { since: 5, name: 'death star tractor beam' }, 'Central Core cancels the Tractor Beam'),
    printed('Light','tractorRelease','Wird der Traktorstrahl aufgehoben, wählt Light für gehaltene Schiffe zwischen Start und Flucht.',
      {since:21},'Central Core releases captured ships and waives Retract The Bridge'),
  ]);
  register(['Dark:654'],[continuous('mobileSystem','Bei Parsec 0 ausspielen, gegen Revolution immun. Dark kann das System einmal pro Move Phase für 1 Force um einen Parsec bewegen oder in einen passenden Orbit einschwenken. Als Starting Location lässt es Light beginnen.','Death Star system','Central Core releases captured ships and waives Retract The Bridge',{since:21})], true);
  register(['Dark:667'],[continuous('locationEffect','Für 2 Force auf Docking Bay 327 ausspielen. Nach einem Battle am Death Star System können zwei Destiny für 2 Force ein gegnerisches Nicht-Mon-Calamari-Schiff bei Destiny über Defense einfangen.','Docking Bay 327 and non-Mon-Calamari ship','Central Core releases captured ships and waives Retract The Bridge',{siteDevice:'death-star-tractor-beam',exactSite:'death star: docking bay 327',cost:2,since:21})], true);
  register(['Dark:2103'],[
    continuous('pileInterrupt','In der eigenen Deploy Phase die Interior Death Star Sites neu anordnen. Ihre Karten bleiben daran. Docking Bay 327 bleibt außen. Die Force-Kosten entsprechen der Zahl der Interior Sites und entfallen bei Kontrolle über Central Core.','interior Death Star sites','Central Core releases captured ships and waives Retract The Bridge',{mode:'retractBridge',pile:'Lost',since:21}),
    continuous('namedCancellation','Hebt On The Edge auf.','On The Edge','Central Core releases captured ships and waives Retract The Bridge',{names:['on the edge'],since:21}),
  ], true);
  register(['Light:680'], [
    printed('Light', 'deployWithoutIcons', 'Diese Seite darf hier ohne eigene Presence oder Force-Icons ausspielen.'),
    drain('Light'),
  ], true);
  register(['Dark:673'], [weaponDestiny, drain('Light')], true);
  register(['Dark:2461'], [weaponDestiny, drain('Dark')], true);
  register(['Dark:678'], [
    printed('Dark', 'militaryCorridorMove', 'Imperials dürfen in ihrer Move Phase frei von hier zu einer Death-Star-Site ziehen.'),
    drain('Light'),
  ], true);
  register(['Light:2448'], [minimumSix('Dark')], true);
  register(['Light:2455'], [
    printed('Light', 'jawaDeploy', 'Deine Jawas kosten hier 1 eigene Force, bei anwesendem Sandcrawler sind sie frei.', { freeWithCrawler: true }),
  ], true);
  register(['Light:2462'], [
    printed('Light', 'characterDeploy', 'Beru Lars und Luke Skywalker werden hier für 1 Force weniger ausgespielt.',
      { names: ['beru lars','luke skywalker'], amount: 1 }),
    weaponDestiny,
  ], true);
  register(['Light:2466'], [
    printed('Light', 'cantinaMove', 'In deiner Control Phase kannst du frei zwischen Mos Eisley und der Cantina ziehen.'),
  ], true);
  register(['Light:2471'], [
    printed('Light', 'characterDeploy', 'Obi-Wan Kenobi wird hier für 3 Force weniger ausgespielt.', { names: ['obi-wan kenobi'], amount: 3 }),
    drain('Dark'),
  ], true);
  register(['Light:2858'], [
    printed('Light', 'firstTurn', 'Wählt Light diese Location als Starting Location, beginnt Light Side.',
      { since: 4 }, 'Massassi Throne Room starts the Light turn'),
    drain('Dark'),
  ], true);
  for (const [id, side, subtype] of [['Light:2855', 'Light', 'Rebel'], ['Dark:2854', 'Dark', 'Imperial']]) {
    const effects = [printed(side, 'aloneInJungle', 'Ein alleiniger ' + subtype + ' erhält hier im Battle Power +2 und ist immun gegen Attrition.',
      { subtype, amount: 2, since: 4 }, 'Jungle bonuses require an active character alone at the site')];
    if (side === 'Light') effects.push(drain('Dark'));
    register([id], effects, true);
  }

  register(['Light:2440'], [
    atLocation('Light', 'power', 'alien', 1, 'Light-Aliens erhalten am Ort Power +1.'),
    atLocation('Dark', 'forfeit', 'alien-except-tusken', 1, 'Dark-Aliens außer Tusken Raiders erhalten Forfeit +1.'),
  ], true);
  register(['Dark:2439'], [
    atLocation('Dark', 'power', 'alien-except-tusken', 1, 'Dark-Aliens außer Tusken Raiders erhalten Power +1.'),
    atLocation('Light', 'forfeit', 'alien', 1, 'Light-Aliens erhalten am Ort Forfeit +1.'),
  ], true);
  register(['Dark:2454'], [
    atLocation('Light', 'power', 'jawa', -1, 'Light-Jawas erhalten am Ort Power −1.'),
    atLocation('Light', 'forfeit', 'jawa', -1, 'Light-Jawas erhalten am Ort Forfeit −1.', true),
    printed('Dark', 'jawaDeploy', 'Deine Jawas kosten hier 1 eigene Force.'),
  ], true);
  register(['Dark:2458'], [
    atLocation('Dark', 'forfeit', 'tusken', 1, 'Dark-Tusken Raiders erhalten am Ort Forfeit +1.', true),
    drain('Dark'),
    minimumSix('Light'),
  ], true);
  register(['Dark:2465'], [
    atLocation('Dark', 'power', 'underworld', 1, 'Dark-Spione, Diebe, Kopfgeldjäger und Schmuggler erhalten Power +1.'),
    atLocation('Dark', 'forfeit', 'underworld', 1, 'Dieselben Charaktere erhalten Forfeit +1.'),
  ], true);

  for (const [ids, region] of [[['Light:2430', 'Dark:2429'], 'tatooine'], [['Light:2849', 'Dark:2848'], 'yavin 4']]) {
    register(ids, [continuous('fleetPower', 'Bei Kontrolle des Systems zählt jedes eigene anwesende Schiff als +1 Gesamt-Power in zugehörigen Site-Battles.',
      'regional-site-battle', 'registered fleet power', { region })], true);
  }

  for (const [id, printedSide, targets] of [['Dark:682', 'Dark', 'rebel-trooper-or-y-wing'], ['Light:2859', 'Light', 'stormtrooper-or-tie']]) {
    register([id], [
      continuous('warRoomForfeit', 'Bei Kontrolle mit einem Leader am Ort erleiden die betroffenen Karten auf dem Tisch Forfeit −1.', targets,
        'registered Premiere locations', { printedSide, amount: -1 }),
      continuous('extraBattleDestiny', 'Die Seite mit diesem Ortswortlaut erhält beim Initiieren hier einen zusätzlichen Battle-Destiny-Draw.',
        'battle-initiator', 'War Room', { printedSide: printedSide === 'Dark' ? 'Light' : 'Dark',
          printedClause: 'If you initiate a battle here, add one battle destiny', amount: 1, duration: 'battle', expires: 'battle end' }),
    ], true);
  }

  for (const [id, ally] of [['Light:2052', 'Rebel'], ['Dark:2355', 'Imperial']]) {
    register([id], [{ event: 'freeSiteDeploy', cost: 0, targets: ally, duration: 'instant', expires: 'after deploy',
      summary: 'Deploy frei an einer Site mit einem eigenen ' + ally + ' mit Ability über 2.', test: 'registered free deployment' }], true);
  }
  register(['Light:2'], [
    continuous('nighttimeRebelAlien', 'Bei Nacht erhalten deine Rebels und Aliens an derselben Planetensite +2 Power.',
      'allied Rebels and aliens', 'Tooex grants power and station immunity only under nighttime conditions', { amount:2, since:14 }),
    continuous('nighttimeRebelAlienImmunity', 'Ist Hydroponics Station dort anwesend, sind diese Karten zusätzlich immun gegen Attrition unter 3.',
      'allied Rebels and aliens', 'Tooex grants power and station immunity only under nighttime conditions', { below:3, since:14 }),
  ],true);
  register(['Dark:934'], [
    continuous('battleCostFromIcons','Ohne anwesenden Droiden wird der Kampfpreis für beide Seiten auf die Zahl der bei Trevagg anwesenden Force-Icons gesetzt.',
      'his location', 'Feltipern Trevagg resets the cost using icons present with him', {since:15}),
  ],true);
  register(['Dark:1011'], [
    continuous('imperialDiscount','Ist dort ein Rebel mit Ability über 2, werden Imperials an Garindans Location für 1 Force weniger ausgespielt.',
      'Imperials at his location', 'Garindan enables deployment and adjacent moves only with an eligible Rebel', {amount:1,since:15}),
    continuous('imperialMove','Bei derselben Bedingung können Imperials in deiner Move Phase kostenlos von einer angrenzenden Site zu Garindan ziehen.',
      'Imperials at an adjacent site', 'Garindan enables deployment and adjacent moves only with an eligible Rebel', {since:15}),
  ],true);
  register(['Dark:1445'], [
    continuous('cannotBoardEnclosed','Kann nicht auf Starfighter oder in geschlossene Fahrzeuge einsteigen.',
      'starfighters and enclosed vehicles', 'Kitik cannot board and is lost when Kal shares her site', {since:15}),
    continuous('lostWithKal','Geht sofort verloren, sobald Kal’Falnl C’ndros an derselben Site ist.',
      'same site as Kal’Falnl C’ndros', 'Kitik cannot board and is lost when Kal shares her site', {since:15}),
  ],true);
  register(['Dark:1922'], [
    continuous('combatPartner','Im Kampf an derselben Site wie Dr. Evazan erhält Ponda Baba +3 Power, sofern dort kein gegnerisches Lichtschwert anwesend ist.',
      'battle at the same site as Dr. Evazan', 'Ponda Baba gains power with Evazan unless a lightsaber is present', {amount:3,since:15}),
    continuous('pilotPower','Verleiht dem von ihm pilotierten Schiff +2 Power.',
      'piloted starship', 'Ponda Baba gains power with Evazan unless a lightsaber is present', {amount:2,legacy:true}),
  ],true);
  register(['Dark:2783'], [
    continuous('mechanicImmunity','Eigene Fahrzeuge und Droiden an derselben Location sind immun gegen Attrition unter 2.',
      'own vehicles and droids at his location', 'Treadwell protects friendly vehicles, droids and fighters', {below:2,since:15}),
    continuous('dockingMechanicImmunity','An einer Docking Bay schützt Treadwell eigene Starfighter am zugehörigen System und an zugehörigen Sektoren vor Attrition unter 3.',
      'own fighters at the related system and sectors', 'Treadwell protects friendly vehicles, droids and fighters', {below:3,since:15}),
  ],true);
  register(['Light:1883'], [
    { event: 'freeSiteDeploy', cost: 0, targets: 'moisture-farm', duration: 'instant', expires: 'after deploy',
      summary: 'Owen Lars wird an Lars’ Moisture Farm frei ausgespielt.', test: 'registered free deployment' },
    characterStat('characterPower', 2, 'Owen erhält an derselben Site wie Beru oder ein Vaporator Power +2.', { companions: ['Light:221', 'Light:2705'] }),
    continuous('larsLegacy','Geht Owen im gegnerischen Zug vom Tisch verloren, erhält Luke bis Ende deines nächsten Zugs +3 Power.',
      'Luke persona','Beru and Owen give Luke separate bonuses until the end of the next owner turn',{ amount:3,duration:'next owner turn',expires:'end of next owner turn',since:13 }),
  ], true);
  register(['Light:221'], [
    characterStat('characterForfeit', 2, 'Beru erhält an derselben Site wie Owen oder eine Hydroponics Station Forfeit +2.', { companions: ['Light:1883', 'Light:1196'] }),
    continuous('larsLegacy','Geht Beru im gegnerischen Zug vom Tisch verloren, erhält Luke bis Ende deines nächsten Zugs +3 Power.',
      'Luke persona','Beru and Owen give Luke separate bonuses until the end of the next owner turn',{ amount:3,duration:'next owner turn',expires:'end of next owner turn',since:13 }),
  ], true);
  register(['Dark:406'], [
    characterStat('characterPower', 1, 'Chief Bast erhält an derselben Site wie Tarkin Power +1.', { companions: ['Dark:1061'] }),
    continuous('pilotPower','Ein von Bast pilotiertes Schiff erhält +2 Power.','piloted ship','Chief Bast evacuates with a non-droid at the same system',{amount:2,legacy:true}),
    continuous('bastEvacuation','Wenn bei einem System gerade ein Battle gestartet wurde, darf Bast sich mit einem anwesenden eigenen Nicht-Droiden zu einer zugehörigen Site verlegen.',
      'Bast and one present friendly non-droid','Chief Bast evacuates with a non-droid at the same system',{since:21}),
  ]);
  register(['Dark:478'], [
    characterStat('characterPower', 1, 'Yularen erhält an derselben Site wie Tarkin, Bast oder Dodonna Power +1.',
      { companions: ['Dark:1061', 'Dark:406', 'Light:1021'] }),
  ], true);
  register(['Dark:12'], [
    characterStat('characterPower', 1, 'Fivedesix erhält an derselben Site wie Motti oder Yularen Power +1.', { companions: ['Dark:60', 'Dark:478'] }),
    continuous('droidDeployTax', 'Verteuert gegnerische Droiden und eigene Mouse Droids beim Ausspielen an dieselbe Location um 1 Force.',
      'opposing droid or friendly mouse droid at same location', 'Fivedesix taxes opposing droids and friendly mouse droids at the location', { amount: 1, since: 9 }),
    continuous('nightImmunity', 'Bei Nacht immun gegen Attrition.', 'Fivedesix at a nighttime site',
      'Fivedesix taxes opposing droids and friendly mouse droids at the location', { legacy: true }),
  ], true);
  register(['Dark:643'], [
    characterStat('characterPower', 2, 'Dathcha erhält an Sites außerhalb von Tatooine Power +2.', { outsideRegion: 'tatooine' }),
    continuous('jawaDeploy', 'An einer Tatooine-Site können beide Spieler je 2 Force für seinen Deploy bezahlen. Jawa Camp kann diese Kosten ersetzen.',
      'Tatooine site and both Force Piles', 'Dathcha pays with both Force Piles even when deploying aboard',
      { cost: 2, opposingCost: 2, duration: 'instant', expires: 'after deploy', legacy: true }),
  ], true);
  register(['Light:1373','Dark:1372'], [
    continuous('jawaDeploy', 'Kann nur auf Tatooine ausgespielt werden. Normalerweise bezahlen beide Spieler je 1 Force. Jawa Camp kann die Kosten ersetzen.',
      'Tatooine site and both Force Piles', 'Jawa deployment honors the Tatooine restriction', { cost: 1, opposingCost: 1, duration: 'instant', expires: 'after deploy', legacy: true }),
  ], true);
  register(['Dark:668'], [
    characterStat('characterPower', -1, 'Der Death Star Trooper verliert außerhalb der Death-Star-Sites 1 Power.', { outsideRegion: 'death star' }),
    continuous('deployRegion', 'Nur auf dem Death Star ausspielbar. Spätere Bewegung an andere erlaubte Orte bleibt möglich.',
      'Death Star site', 'Death Star Trooper can deploy only on the Death Star', { region: 'death star', legacy: true }),
  ], true);
  register(['Dark:2834'], [
    continuous('wuherControl', 'Zu Beginn der eigenen Control-Phase gehen alle an derselben Site anwesenden Waffen und Droiden verloren.',
      'all weapons and droids present at same site', 'Wuher clears the Cantina and acts only at the start of Control elsewhere',
      { duration: 'instant', expires: 'after resolving', legacy: true }),
    continuous('wuherCantina', 'Wenn Wuher in der Cantina ist, gehen Waffen und Droiden dort sofort verloren.',
      'all weapons and droids at Cantina', 'Wuher clears the Cantina and acts only at the start of Control elsewhere',
      { duration: 'instant', expires: 'after resolving', legacy: true }),
  ], true);
  register(['Dark:1027'], [
    characterStat('characterForfeit', 1, 'Tagge erhält an einer Site Forfeit +1 je anwesendem Imperial Trooper.', { eachPresent: 'imperial-trooper' }),
  ], true);
  register(['Dark:634'], [
    continuous('battleDestiny', 'In einem Battle gibt Vader jedem eigenen Battle-Destiny-Draw +1.', 'own battle destiny',
      'Vader increases each Dark battle destiny', { amount: 1, legacy: true }),
    continuous('pilotPower', 'Vader erhöht die Power des pilotierten Schiffs um 3. In seiner Custom TIE gibt er stattdessen Power +4 und Maneuver +3.',
      'piloted starship', 'Vader and Tarkin apply their printed pilot bonuses', { amount: 3 }),
    continuous('attritionImmunity', 'Vader ist immun gegen Attrition unter 5.', 'Vader', 'immune Vader still requires vulnerable Trooper forfeit', { below: 5 }),
  ], true);
  register(['Dark:1061'], [
    continuous('pilotPower', 'Tarkin erhöht die Power des pilotierten Schiffs um 2.', 'piloted starship',
      'Vader and Tarkin apply their printed pilot bonuses', { amount: 2 }),
    { event: 'cancelBattleDraw', summary: 'Ist Tarkin mit Vader am selben Battle beteiligt, kann er einmal pro Battle einen gegnerischen Destiny-Draw aufheben.',
      cost: 0, targets: 'just drawn opposing destiny in battle', duration: 'instant', expires: 'after cancellation',
      test: 'Tarkin with Vader cancels', legacy: true },
  ], true);
  register(['Light:1021'], [
    characterStat('rebelAura', 1, 'Mit Dodonna an einer Yavin-4-Site anwesende Rebels erhalten Power +1.', { region: 'yavin 4' }),
    continuous('plannerSupport','Erhöht Rebel Planners um 1 oder verdoppelt den Beitrag, wenn Dodonna an derselben Site ist.',
      'Rebel Planners','Dodonna modifies Rebel Planners and cancels Wrong Turn',{since:21}),
    continuous('cancelWrongTurn','Kann für 1 Force Wrong Turn beim Ausspielen oder auf dem Tisch aufheben.',
      'Wrong Turn','Dodonna modifies Rebel Planners and cancels Wrong Turn',{cost:1,since:21}),
  ]);
  register(['Light:1495'], [
    characterStat('rebelAura', 1, 'Mit Leia an einer Death-Star-Site anwesende Rebels erhalten Power +1.', { region: 'death star' }),
    continuous('attritionImmunity', 'Leia hat diplomatische Immunität gegen Attrition unter 2.',
      'Leia Organa', 'Leia improves Death Star Rebels but not herself', { below: 2, legacy: true }),
  ], true);
  register(['Dark:2648'], [
    characterStat('tuskenPower', 1, 'Ein anderer anwesender nicht einzigartiger Tusken Raider gibt Power +1. Vier eigene anwesende Raider geben insgesamt weitere Power +2.',
      { groupAmount: 2, minimum: 4 }),
    continuous('deployRegion', 'Kann nur auf Tatooine ausgespielt werden.',
      'Tatooine site', 'Tusken Raiders count present non-unique copies', { region: 'tatooine', legacy: true }),
  ], true);
  register(['Dark:741'], [
    continuous('forceIconPower', 'Erhält +1 Power pro Dark-Force-Icon an der Location und weitere +2 bei Nacht.',
      'this character', 'Djas Puhr counts Dark Force icons and nighttime', { amount: 1, nightAmount: 2, since: 7 }),
    continuous('attritionImmunity', 'Djas Puhr ist immun gegen Attrition unter 3.',
      'Djas Puhr', 'Djas Puhr counts Dark Force icons and nighttime', { below: 3, since: 7 }),
  ], true);
  register(['Dark:816'], [
    continuous('nonPowerDroidAura', 'Erhöht die Power jedes eigenen anwesenden Droiden außer Power Droids um 1.',
      'friendly non-power droid present', 'EG-6 boosts friendly non-power droids', { amount: 1, legacy: true }),
    continuous('battlePowerDouble', 'Destiny ist 0. Als Battle Destiny kann sie bei geringerer eigener Power die eigene Power einmal pro Battle verdoppeln.',
      'your power present before destiny', 'EG-6 battle destiny doubles underdog Dark present power', { duration: 'once per battle', expires: 'after battle', legacy: true }),
  ], true);

  const device = (id, targets, cost, summary, fields) => register([id], [continuous('device', summary, targets,
    'registered devices', { cost, ...fields })], true);
  device('Light:2435', 'rebel-or-alien', 1, 'Rebel oder Alien erhält auf Tatooine Power und Forfeit +2.', { bonus: 'tatooine-belt' });
  device('Dark:2360', 'imperial-or-alien', 1, 'Imperial oder Alien erhält Power und Forfeit +1, auf dem Death Star jeweils +2.', { bonus: 'stormtrooper-belt' });
  for (const id of ['Light:997', 'Dark:996']) {
    device(id, 'starship-at-system-with-bay', 0, 'Die Tanks erhöhen Hyperspeed, Power und Maneuver des Schiffs um 1.', { bonus: 'supply-tanks' });
  }
  register(['Dark:489'], [
    continuous('device', 'Comlink kostet beim Deploy 1 Force und eröffnet Deploy-React-Optionen am Ort des Trägers oder an einer Nachbar-Site.',
      'character', 'Comlink equips', { cost: 1, since: 2, deployReact: true }),
    continuous('reusableComlink','Kann auf einer Figur beider Seiten liegen. Aktiviert bei jedem passenden gegnerischen Battle oder Force Drain normale Deploys als React.',
      'host location or adjacent site','Comlink and CZ-3 apply normal React deployment rules',{since:18}),
  ],true);
  register(['Light:593'], [
    continuous('characterDeployReact','Beim gegnerischen Battle oder Force Drain an CZ-3s Location oder einer angrenzenden Site kannst du dort Karten zum normalen Preis als React ausspielen.',
      'host location or adjacent site','Comlink and CZ-3 apply normal React deployment rules',{since:18}),
  ],true);
  register(['Light:735','Dark:734'], [
    continuous('disarmedEffect','In jeder Control Phase auf eine bewaffnete gegnerische Figur an einer Site mit eigener bewaffneter Figur ausspielen. Die Figur verliert ihre Waffen, hat −1 Power und kann keine Waffen tragen. Immun gegen Alter.',
      'armed opposing character at the same site','both Disarmed effects remove existing weapons',{since:18}),
  ],true);
  register(['Dark:262'], [
    continuous('tableEffect','Auf der eigenen Tischseite ausspielen. Kann jederzeit eigene Charakterwaffen von einer Site aufnehmen.',
      'character weapons at any site','Blaster Rack stores weapons and loses them when canceled',{ownSide:true,weaponRack:true,since:18}),
    continuous('rackRelease','In deiner Deploy Phase darfst du die Waffe für ihre normalen Deploy-Kosten einem berechtigten eigenen Charakter geben.',
      'eligible friendly character','Blaster Rack stores weapons and loses them when canceled',{since:18}),
  ],true);
  for(const [id,target] of [['Light:68','Jedi'],['Dark:1208','Dark Jedi']]){
    register([id],[
      continuous('tableEffect','Für 1 Force auf einem eigenen '+target+' ausspielen.',
        'friendly '+target,'Affect Mind and Lack of Faith reduce total ability',{ownSide:true,characterTarget:'force-user',cost:1,since:19}),
      continuous('reduceOpposingAbility','An einer Site hat der Gegner insgesamt 2 Ability weniger, solange ein eigener Träger und kein gegnerischer '+(target==='Jedi'?'Dark Jedi':'Jedi')+' anwesend sind.',
        'opponent at the site','Affect Mind and Lack of Faith reduce total ability',{amount:2,since:19}),
    ],true);
  }
  register(['Light:695'],[
    continuous('tableEffect','Für 2 Force auf einem Imperial ausspielen. Vader, der Emperor und Stormtrooper sind ausgenommen.',
      'eligible Imperial','Demotion cancels text and reduces power',{characterTarget:'demotion',cost:2,cancelsHostText:true,since:19}),
    continuous('demotionPower','Der betroffene Imperial hat 2 Power weniger und sein Kartentext ist aufgehoben.',
      'host Imperial','Demotion cancels text and reduces power',{amount:-2,since:19}),
  ],true);
  register(['Light:1380','Dark:1378'],[
    continuous('tableEffect','Für jeweils 3 Force von beiden Seiten auf deiner Tischseite ausspielen. Ohne ausreichende Force auf beiden Seiten ist der Deploy gesperrt.',
      'own side of table','both Jawa effects charge each player and add forfeit',{ownSide:true,cost:3,opposingCost:3,since:19}),
    continuous('globalJawaForfeit','Alle eigenen Jawas erhalten +1 Forfeit.',
      'friendly Jawas on table','both Jawa effects charge each player and add forfeit',{amount:1,since:19}),
  ],true);
  register(['Light:821'],[
    continuous('device','Für 1 Force an einem Warrior einer beliebigen Seite anlegen.','warrior',
      'Electrobinoculars only shows the owner the top card',{cost:1,allowOpponent:true,since:20}),
    continuous('cardInformation','Für 2 Force die oberste Karte des eigenen Reserve Decks ansehen und wahlweise oben auf die eigene Force Pile legen.',
      'top of own Reserve Deck','Electrobinoculars only shows the owner the top card',{mode:'electrobinoculars',cost:2,since:20}),
  ],true);
  register(['Dark:1617'],[
    continuous('tableEffect','Für 2 Force beim gegnerischen Reserve Deck ausspielen.','opposing reserve',
      'Macroscan keeps its peek private and expands it at night',{cost:2,since:20}),
    continuous('cardInformation','Für 1 Force die oberste Reserve-Karte des Gegners ansehen. Bei Nachtbedingungen dürfen bis zu drei Karten angesehen werden.',
      'opposing reserve','Macroscan keeps its peek private and expands it at night',{mode:'macroscan',cost:1,since:20}),
  ],true);
  for(const [id,mode,cost,description,test] of [
    ['Dark:1460','labria',0,'Einmal je eigener Control Phase die oberste eigene Reserve-Karte offen zeigen. Fahrzeuge und Schiffe gehen verloren. Andere Karten oben auf eine der drei eigenen Force-Piles legen.','Labria reveals a card and chooses a valid pile'],
    ['Light:1489','leesub',1,'Einmal je eigener Control Phase für 1 Force einen Kartentyp und eine verdeckte Position in der gegnerischen Hand wählen. Die gewählte Karte wird aufgedeckt. Bei richtiger Wahl geht sie verloren.','Leesub chooses a card position without seeing the hand'],
    ['Dark:1613','miiyoom',0,'Einmal je eigener Control Phase für jede gegnerische Handkarte 1 Force ausgeben. Die Hand wird offengelegt. Alle einzigartigen männlichen Rebels und Aliens darin gehen verloren.','M’iiyoom reveals the hand and loses only unique male Rebels and aliens'],
  ]){
    register([id],[continuous('cardInformation',description,'own Control phase',test,{mode,cost,ownControl:true,since:20})],true);
  }
  for(const [id,mode,cost,pile,description,test] of [
    ['Dark:2176','scanning',1,'Used','Gegnerische Hand für 1 Force aufdecken. Du darfst einen Rebel daraus oben auf die gegnerische Used Pile legen.','Scanning Crew and Radar Scanner reveal both hands correctly'],
    ['Light:2011','radar',1,'Used','Mit eigenem Fahrzeug oder Schiff auf dem Tisch die gegnerische Hand für 1 Force aufdecken. Du darfst dort Jawas außer Dathcha sowie Tusken Raiders auf die gegnerische Used Pile legen.','Scanning Crew and Radar Scanner reveal both hands correctly'],
    ['Dark:2632','trinto',0,'Used','In deiner Battle Phase eine Destiny ziehen. Jede gegnerische Karte in der Used Pile mit dieser Destiny geht verloren.','Trinto Duaba loses only cards matching the drawn destiny'],
    ['Dark:2650','scavengers',1,'Lost','Für 1 Force Destiny ziehen. Liegt sie unter der Zahl der Tusken Raiders auf dem Tisch, darfst du die gegnerische Used Pile durchsuchen. Gefundene Fahrzeuge, Waffen und Devices gehen verloren.','Tusken Scavengers checks the Tusken count before searching'],
  ]){
    register([id],[continuous('pileInterrupt',description,'opponent '+(mode==='scanning'||mode==='radar'?'hand':'Used Pile'),
      test,{mode,cost,pile,duration:'instant',since:21})]);
  }
  register(['Dark:1579'],[
    continuous('pileInterrupt','Für 1 Force gegnerische Used Pile durchsuchen. Alle dort gefundenen Droiden gehen verloren.',
      'opposing Used Pile','Look Sir, Droids can search the Used Pile or destroy a droid',{mode:'findDroids',cost:1,pile:'Lost',since:21}),
    continuous('pileInterrupt','Oder einen Droiden auf dem Tisch für seine regulären Deploy-Kosten zerstören.',
      'droid on table','Look Sir, Droids can search the Used Pile or destroy a droid',{mode:'destroyDroid',pile:'Lost',since:21}),
  ]);
  for(const [id,mode,cost,summary,test] of [
    ['Light:352','cantinaBrawl',2,'In der Cantina ziehen beide Spieler Destiny. Figuren beider Seiten mit einer der gezogenen Ability-Zahlen gehen verloren.','Cantina Brawl matches both destiny draws'],
    ['Light:468','collision',1,'Zwei oder mehr gegnerische Schiffe an einem System oder Sektor wählen. Ist Destiny kleiner als ihre Zahl, verliert der Gegner ein Schiff seiner Wahl.','Collision lets the opponent select a ship to lose'],
    ['Dark:649','deadJawa',0,'Bei mindestens zwei anwesenden Stormtroopern gegnerische Jawas auswählen. Bei Destiny über der Zielzahl gehen alle gewählten Jawas verloren.','Dead Jawa counts the chosen Jawas'],
  ]){
    register([id],[continuous('pileInterrupt',summary,'eligible cards at a location',test,
      {mode,cost,pile:'Lost',duration:'instant',since:21})]);
  }
  register(['Light:985','Dark:467'],[
    continuous('battleAccident','Zu Beginn eines Site-Battles möglich, wenn der Gegner dort mindestens zwei Figuren und eine Waffe hat. Bei Destiny unter der Zahl seiner Figuren verliert der Gegner eine davon nach eigener Wahl.',
      'opponent characters and at least one weapon at the battle site','both battle accidents let the defending side choose a loss',
      {mode:'accident',cost:0,pile:'Lost',duration:'instant',since:21}),
  ]);
  for(const [id,power,needsHyperdrive] of [['Light:24',0,true],['Dark:622',1,false]]){
    register([id],[
      continuous('pileInterrupt','Ein Starfighter erhält bis Ende des Zugs +2 Maneuver'+(power?' und +1 Power':'')+' sowie +2 Hyperspeed'+(needsHyperdrive?'.':' mit Hyperdrive.')+
       ' Auch nach einer auf Maneuver gezielten Destiny möglich.',
       'eligible starfighter','both Maneuvers cards affect movement and weapon defense',{mode:'shipManeuvers',cost:0,pile:'Used',power,needsHyperdrive,since:21}),
    ]);
  }
  register(['Light:1120'],[
    continuous('shipWeaponPenalty','Wenn eine gegnerische Schiffswaffe gerade dein Raumschiff anzielt, erhält jeder Destiny-Draw dieser Waffe im laufenden Kampf −2.',
      'opponent starship weapon','Hear Me Baby applies to each draw',{amount:-2,pile:'Used',since:21}),
  ]);
  register(['Light:2423'],[
    continuous('device','Für 2 Force an einem Raumschiff anlegen und dessen Maneuver um 1 erhöhen.',
      'starship','Targeting Computer doubles fire',{cost:2,allowOpponent:true,since:21}),
    continuous('doubleWeaponFire','Erlaubt zwei getrennte oder kombinierte Schüsse mit derselben Schiffswaffe als eine Aktion. Jeder Destiny-Draw dabei erhält −1.',
      'ship weapon','Targeting Computer doubles fire',{penalty:-1,since:21}),
  ]);
  register(['Light:2325'],[
    continuous('tableEffect','Für 1 Force auf einem eigenen Raumschiff ausspielen. Dessen Armor oder Maneuver erhöht sich um 2.',
      'friendly starship','Special Modifications follows the selected stat and Falcon crew',{cost:1,hullEffect:true,since:21}),
    continuous('falconModification','Mit Han, Lando oder Chewie als Pilot des Millennium Falcon erhält er zusätzlich +2 Power und Forfeit.',
      'Falcon with named pilot','Special Modifications follows the selected stat and Falcon crew',{amount:2,since:21}),
  ]);
  register(['Light:1803'],[
    continuous('attritionImmunity','Immun gegen Attrition unter 5.','Obi-Wan',
      'Obi-Wan and the Cape can make an ability-one character move for free',{below:5,legacy:true}),
    continuous('battleMoveAway','Nach Battle-Initiierung einen anwesenden gegnerischen Charakter mit Ability 1 für 1 Force fortschicken. Kann er sich nicht bewegen, geht er verloren.',
      'opposing ability-one character','Obi-Wan and the Cape can make an ability-one character move for free',{mode:'singleExpel',cost:1,since:21}),
  ]);
  register(['Light:1810'],[
    continuous('tableEffect','Für 2 Force auf einen eigenen Rebel oder Alien ausspielen. Der Träger ist immun gegen Attrition unter 5.',
      'friendly Rebel or Alien','Obi-Wan and the Cape can make an ability-one character move for free',{characterTarget:'cape',cost:2,since:21}),
    continuous('battleMoveAway','Wie Obi-Wan kann der anwesende Träger nach Battle-Initiierung einen gegnerischen Charakter mit Ability 1 kostenlos fortschicken oder verlieren lassen.',
      'opposing ability-one character','Obi-Wan and the Cape can make an ability-one character move for free',{mode:'singleExpel',cost:1,since:21}),
  ]);
  for(const [id,mode,cost,summary,test] of [
    ['Light:1707','moveAlong',1,'Nach Battle-Initiierung bei deinem anwesenden Jedi eine Destiny ziehen. Wähle so viele gegnerische Figuren mit Ability 1, die sich kostenlos entfernen müssen oder verloren gehen.','Move Along selects targets equal to destiny'],
    ['Light:1755','narrowEscape',0,'Nach gegnerischer Battle-Initiierung bei einem anwesenden Rebel mit Ability über 2 müssen alle eigenen Karten mit Ability ihren Landspeed nutzen, um die Site zu verlassen.','Narrow Escape pays regular Landspeed costs'],
    ['Light:1197','hyperEscape',0,'Nach Battle-Initiierung an einem System oder Sektor müssen alle eigenen Schiffe und Fahrzeuge versuchen, sich mit regulärer Bewegung zu entfernen.','Hyper Escape leaves out-of-range ships behind'],
  ]){
    register([id],[continuous('battleMoveAway',summary,'eligible battle participants',test,{mode,cost,pile:'Used',since:21})]);
  }
  register(['Light:2102', 'Dark:2833'], [
    continuous('tableEffect', 'Liegt auf der gegnerischen Tischseite. Die Warriors dieser Seite kosten beim Deploy 1 Force mehr.',
      'opposing table', 'Central Core waives Wrong Turn', { since: 5, cost: 3, warriorDeploy: 1, expires: 'when canceled' }),
  ], true);
  register(['Light:2277'], [
    { event: 'cancelTableEffect', summary: 'Kann Wrong Turn beim Ausspielen oder auf dem Tisch als Lost Interrupt aufheben.',
      targets: ['Dark:2833'], cost: 0, duration: 'instant', expires: 'after cancellation', test: 'Skywalkers cancels Wrong Turn', since: 5 },
    continuous('combinedBattleDestiny','Ergänzt zwei Battle Destiny, wenn Luke und Leia gemeinsam kämpfen.',
      'Luke and Leia in battle','Skywalkers responds to Imperial Barrier or adds battle destiny',{draws:2,since:21}),
    continuous('cancelNamedInterrupt','Hebt gerade gespieltes Imperial Barrier auf.',
      'Imperial Barrier','Skywalkers responds to Imperial Barrier or adds battle destiny',{targets:['Dark:1263'],since:21}),
    continuous('namedCancellation','Hebt Retract The Bridge beim Ausspielen oder auf dem Tisch auf.',
      'Retract The Bridge','Skywalkers responds to Imperial Barrier or adds battle destiny',{names:['retract the bridge'],since:21}),
  ]);
  register(['Light:1039'], [
    continuous('extraBattleDestiny', 'Kämpft Luke zusammen mit Obi-Wan oder Yoda, können zwei Battle Destiny hinzugefügt werden.',
      'Luke and Obi-Wan or Yoda participating in same battle', 'Gift of the Mentor pairs Luke with a mentor', { amount: 2, duration: 'rest of battle', legacy: true }),
    continuous('searchLightsaber', 'Für 1 Force ein Lichtschwert aus dem Reserve Deck aufdecken und auf die Hand nehmen. Danach wird das Reserve Deck gemischt.',
      'lightsaber in own Reserve Deck', 'Gift of the Mentor searches only for a lightsaber', { cost: 1, duration: 'instant', expires: 'after resolving', since: 10 }),
  ], true);
  const defendingDestiny = (summary, draws, fields) =>
    continuous('defendingDestiny', summary, 'sole defending character', 'Defending battle interrupts distinguish lone characters and printed modes',
      { draws, duration: 'rest of battle', expires: 'after battle', since: 11, ...fields });
  register(['Dark:1691'], [
    defendingDestiny('Verteidigt Tarkin allein, zwei Battle Destiny hinzufügen.',2,{ character: 'grand moff tarkin' }),
    defendingDestiny('Verteidigt ein Alien allein, eine Battle Destiny hinzufügen.',1,{ subType: 'Alien' }),
  ], true);
  register(['Light:2297'], [
    defendingDestiny('Verteidigt Han eine Site allein, zwei Battle Destiny hinzufügen.',2,{ character: 'han solo', siteOnly: true }),
    defendingDestiny('Verteidigt ein Alien eine Site allein, eine Battle Destiny hinzufügen.',1,{ subType: 'Alien', siteOnly: true }),
  ], true);
  register(['Light:2740'], [
    defendingDestiny('Verteidigt ein Warrior eine Site allein, eine Battle Destiny hinzufügen.',1,{ warrior: true, siteOnly: true }),
    defendingDestiny('Verteidigt Leia eine Site allein, zwei Battle Destiny hinzufügen.',2,{ character: 'leia organa', siteOnly: true }),
  ], true);
  register(['Dark:1578'], [
    defendingDestiny('Verteidigt ein Warrior eine Site allein, eine Battle Destiny hinzufügen.',1,{ warrior:true,siteOnly:true,since:12 }),
    defendingDestiny('Verteidigt Tagge eine Site allein, zwei Battle Destiny hinzufügen.',2,{ character:'general tagge',siteOnly:true,since:12 }),
  ],true);
  for(const [id,character,faction] of [['Light:1455','obi-wan kenobi','Rebel'],['Dark:2701','darth vader','Imperial']]){
    register([id],[
      defendingDestiny('Verteidigt '+character+' eine Site allein, +1 Power und eine zusätzliche Battle Destiny.',1,
        { character,siteOnly:true,power:1,since:12 }),
      defendingDestiny('Verteidigt ein anderer '+faction+' mit mehr als 2 Ability eine Site allein, eine Battle Destiny hinzufügen.',1,
        { subType:faction,except:character,minimumAbility:3,siteOnly:true,since:12 }),
    ],true);
  }
  register(['Light:994'],[
    defendingDestiny('Verteidigt ein eigener Pilot oder permanenter Pilot im All allein, eine Battle Destiny hinzufügen.',1,
      { pilot:true,spaceOnly:true,since:12 }),
    defendingDestiny('Verteidigt Luke im All allein, +1 Power und eine zusätzliche Battle Destiny.',1,
      { character:'luke skywalker',spaceOnly:true,power:1,since:12 }),
  ],true);
  register(['Dark:1576'],[
    defendingDestiny('Verteidigt ein eigener Pilot oder permanenter Pilot im All allein, eine Battle Destiny hinzufügen.',1,
      { pilot:true,spaceOnly:true,since:12 }),
    defendingDestiny('Verteidigt Motti im All allein, zwei Battle Destiny hinzufügen.',2,
      { character:'admiral motti',spaceOnly:true,since:12 }),
  ],true);
  for(const [id, own, opponent, special, summary] of [
    ['Dark:391','grand moff tarkin','Rebel','leia organa','Kämpft Tarkin gegen einen Rebel mit mehr als 2 Ability, eine zusätzliche Destiny ziehen. Gegen Leia sind es zwei.'],
    ['Light:2531','luke skywalker','Imperial','darth vader','Kämpft Luke gegen einen Imperial mit mehr als 2 Ability, eine zusätzliche Destiny ziehen. Gegen Vader sind es zwei.'],
  ]){
    register([id],[
      continuous('opposedDestiny', summary, 'own named character and an opposing character of ability > 2',
        'Paired combat interrupts check opposing ability and the named opponent',
        { own, opponent, special, duration: 'rest of battle', expires: 'after battle', since: 11 }),
    ],true);
  }
  register(['Dark:1215'],[
    continuous('opposedDestiny','Kämpft ein eigener Dark Jedi gegen einen Rebel mit mehr als 2 Ability, eine Battle Destiny hinzufügen. Gegen Luke sind es zwei.',
      'Dark Jedi and opposing Rebel of ability > 2','I Have You Now identifies a Dark Jedi and the chosen Rebel',
      { ownRank:'Dark Jedi',opponent:'Rebel',special:'luke skywalker',duration:'rest of battle',expires:'after battle',since:13 }),
  ],true);
  register(['Light:1874'],[
    continuous('openingDestiny','Für 1 Force eine Battle Destiny hinzufügen, wenn der Gegner gerade im All einen Kampf initiiert hat und dort ein eigenes Schiff mit Maneuver über 3 ist.',
      'opposing just initiated battle in space; own starship with maneuver > 3','Out of Nowhere responds only to an opposing space battle',
      { cost:1,draws:1,duration:'rest of battle',expires:'after battle',since:13 }),
  ],true);
  register(['Light:1104'],[
    continuous('replacementBattleDestiny','Für 1 Force eine eigene gerade gezogene Battle Destiny ersetzen, wenn eine eigene beteiligte Figur mehr als 2 Ability hat.',
      'own just drawn battle destiny','Han’s Dice replaces a battle destiny after the response window',
      { cost:1,duration:'instant',expires:'after resolving',since:13 }),
  ],true);
  register(['Dark:2406'],[
    continuous('swapBattleDestiny','Für 1 Force die beiden Destiny-Werte tauschen, nachdem beide Seiten je eine Battle Destiny erfolgreich gezogen haben.',
      'both single completed battle destiny draws','Takeel swaps individual draws and leaves the total modifiers in place',
      { cost:1,duration:'instant',expires:'after resolving',since:13 }),
  ],true);
  register(['Dark:2634'],[
    continuous('trooperCharge','Ein beteiligter eigener Trooper erhält +2 Power für diesen Kampf, ein Death Star Trooper +3. Er muss anschließend forfeitet werden.',
      'own participating Imperial trooper','Trooper Charge targets a trooper and makes its forfeit mandatory',
      { amount:2,specialAmount:3,duration:'rest of battle',expires:'after battle',since:13 }),
  ],true);
  for(const [id, characters, cost] of [
    ['Light:1102','Han',1],['Light:1500','Leia',1],['Light:1600','Luke',1],
    ['Light:2105','Obi-Wan',1],['Dark:2528','Vader, Tarkin, Motti oder Tagge',2],
  ]){
    const test='Named Premiere retrieval and searches work during either turn';
    register([id], [
      continuous('retrieveNamedCharacter', 'Für '+cost+' Force eine der genannten Figuren aus dem Lost Pile auf den Used Pile holen.',
        characters,test,{ cost, duration: 'instant', expires: 'after resolving', since: 10 }),
      continuous('searchNamedCharacter', 'Für '+(cost+2)+' Force eine der genannten Figuren aus dem Reserve Deck aufdecken und auf die Hand nehmen. Danach das Deck mischen.',
        characters,test,{ cost: cost+2, duration: 'instant', expires: 'after resolving', since: 10 }),
    ],true);
  }
  register(['Dark:613'], [
    { event: 'cancelTableEffect', summary: 'Kann Restricted Deployment beim Ausspielen oder auf dem Tisch als Lost Interrupt aufheben.',
      targets: ['Light:2102'], cost: 0, duration: 'instant', expires: 'after cancellation', test: 'Skywalkers cancels Wrong Turn', since: 5 },
    continuous('battleDestinyPair','Mit Tarkin und Tagge oder Motti im selben Battle zwei Battle Destiny hinzufügen.',
      'matching characters in battle','Dark Collaboration counters Rebel Barrier or adds two Battle Destiny',{since:21}),
    continuous('cancelNamedInterrupt','Kann Rebel Barrier beim Ausspielen aufheben.','Rebel Barrier',
      'Dark Collaboration counters Rebel Barrier or adds two Battle Destiny',{targets:['Light:2033'],since:21}),
  ]);
  register(['Light:2033','Dark:1263'],[
    continuous('barrier','Für 1 Force ein gerade ausgespieltes gegnerisches Schiff oder eine Figur am Bewegen und Kämpfen hindern. Hält bis Zugende.',
      'just deployed opposing ship or character','both Barriers restrict only the card just deployed',{cost:1,pile:'Used',since:21}),
  ]);
  register(['Light:2041'],[
    continuous('locationEffect','Für 1 Force im Massassi War Room oder an einer Docking Bay ausspielen.',
      'Massassi War Room or docking bay','Dodonna modifies Rebel Planners and cancels Wrong Turn',{cost:1,rebelPlanners:true,since:21}),
    continuous('plannerPower','Erhöht deine Gesamt-Power am zugehörigen System und den zugehörigen Sektoren um die Zahl eigener anwesender Schiffe.',
      'allied ships present at the related location','Dodonna modifies Rebel Planners and cancels Wrong Turn',{since:21}),
  ]);
  register(['Dark:914'],[
    continuous('locationEffect','An einer Site ausspielen. Der eigene gedruckte Standorttext gilt zusätzlich an beiden unmittelbar benachbarten Sites.',
      'adjacent sites on the same planet or mobile system','Expand The Empire copies one side and follows Revolution',
      {cost:0,expandsText:true,since:21}),
  ]);
  for(const [id,region] of [['Light:2860','yavin 4'],['Dark:665','death star']]){
    register([id],[
      continuous('locationEffect','Für 2 Force an einer passenden Site ausspielen. Wähle +1 auf gegnerischen Deploy, +1 gegnerische Mindest-Ability für Battle Destiny oder +1 eigene Gesamt-Power. Die Site und beide Nachbar-Sites sind betroffen.',
        'site and immediately adjacent sites','both Sentry cards apply the selected modifier',{cost:2,sentryRegion:region,since:21}),
    ]);
  }
  register(['Dark:932'],[
    continuous('tableEffect','Auf einem Capital Starship ausspielen.',
      'capital starship','Fear Will Keep Them In Line needs control at the ship’s location',{capitalHost:true,since:21}),
    continuous('controlledSitePower','Wenn das Schiff an einem von dir kontrollierten System oder Sektor ist, +1 Gesamt-Power in Kämpfen an zugehörigen Sites.',
      'battles at related sites','Fear Will Keep Them In Line needs control at the ship’s location',{amount:1,since:21}),
  ]);
  for(const [ids,skill,summary,test] of [
    [['Light:826','Dark:190'],'pilot','Gibt einer eigenen Figur ohne Pilot-Skill diesen Skill und +2 Power für das pilotierte Schiff. Gibt einem vorhandenen Piloten stattdessen +1 Schiff-Power.','both pilot trainers grant pilot skill or a ship power bonus'],
    [['Light:2157','Dark:1430'],'warrior','Gibt einer eigenen Figur ohne Warrior-Skill diesen Skill. Ein vorhandener Warrior erhält stattdessen +1 Power.','both warrior trainers grant warrior skill or character power'],
    [['Light:2141'],'smuggler','Gibt einer eigenen Figur ohne Smuggler-Skill diesen Skill. Ein vorhandener Smuggler erhält stattdessen +1 Power.','Rycar Ryjerd grants smuggler skill or character power'],
  ]){
    register(ids,[continuous('tableEffect',summary+' Immun gegen Alter.','own character',test,
      {ownSide:true,trainingSkill:skill,since:16})],true);
  }
  for (const [id, targets] of [['Light:348', 'rebel-or-jawa'], ['Dark:347', 'imperial-or-jawa']]) {
    register([id], [
      continuous('device', 'Caller wird an einen eigenen berechtigten Träger angelegt.', targets, 'Caller steals', { since: 3 }),
      { event: 'stealDroid', summary: 'In deiner Control Phase kannst du einen gegnerischen Droiden mit Restraining Bolt an derselben Site übernehmen. Der Bolt geht auf die Hand seines Besitzers.',
        targets: 'opposing restrained droid at same site', cost: 0, duration: 'permanent', expires: 'when control changes', test: 'Caller steals', since: 3 },
      continuous('droidTheftOwnership', 'Der Droide gehört dir für die restliche Partie oder bis er erneut gestohlen wird. Bei einem Persona-Konflikt wählst du, welche Kopie verloren geht.',
        'stolen droid', 'both Callers update ownership and resolve duplicate personas', { since:14 }),
    ],true);
  }
  register(['Light:2100', 'Dark:2099'], [
    continuous('restrainDroid', 'Kostet keine Force. Wird an einen Droiden an einer Site angelegt und sperrt dessen Bewegung und Kartentext.', 'droid at site',
      'Restraining Bolt blocks', { since: 3 }),
    { event: 'transferBolt', summary: 'In deiner Deploy Phase kannst du den Bolt kostenlos an einen anderen Droiden an derselben Site übertragen.',
      targets: 'another droid at same site', cost: 0, duration: 'instant', expires: 'after transfer', test: 'Restraining Bolt blocks', since: 3 },
  ], true);
  register(['Light:2385','Dark:575'], [
    continuous('assault', 'Für 1 Force einen gegnerischen Force Drain aufheben. Pro gegnerischer anwesender Figur, Schiff oder Fahrzeug eine Destiny ziehen und die Summe mit der gegnerischen Power vergleichen. Die Seite mit dem niedrigeren Wert verliert die Differenz an Force.',
      'opposing Force drain and units present', 'both Premiere Assault cards compare destiny against present power',
      { cost: 1, duration: 'instant', expires: 'after resolving', legacy: true }),
  ], true);
  register(['Dark:1555'], [
    continuous('limitedResources', 'Hat die Gegenseite höchstens zwei Handkarten, verliert sie in deinem Zug 4 Force und in ihrem Zug 2 Force. Mit Fusion Generator Supply Tanks an Bord eines Starships verliert sie 2 Force weniger.',
      'opponent with at most two cards in hand', 'Limited Resources applies hand size, turn and ship tanks',
      { duration: 'instant', expires: 'after resolving', since: 10 }),
  ], true);
  register(['Dark:777'], [
    continuous('locationEffect', 'Der unbewegliche Droid Detector sperrt Droiden-Deploy an einer Innen-Site. Ab dem folgenden Zug gehen dort anwesende Droiden jeweils am Zugende verloren.',
      'interior site', 'Droid Detector bars', { since: 3, siteDevice: 'droid-detector', requiredTag: 'Interior' }),
  ], true);
  register(['Light:1196'], [
    continuous('locationEffect','Unbewegliches Device für 1 Force an einer Außen-Site von Tatooine.','exterior Tatooine site',
      'Hydroponics Station offers each permitted activation draw',{ cost:1,siteDevice:'hydroponics',requiredTag:'Exterior',deployRegion:'tatooine',since:13 }),
    continuous('activationDraw','Die erste aktivierte Karte darf direkt auf die Hand. Mit einem Vaporator auf dem Tisch gilt das auch für die zweite.',
      'first activated card; second with a Vaporator','Hydroponics Station offers each permitted activation draw',{ since:13 }),
  ],true);
  register(['Light:2705'], [
    continuous('locationEffect','Unbewegliches Device für 1 Force an einer Tatooine-Site.','Tatooine site',
      'Vaporator protects its site and adjacent sites from Gravel Storm',{ cost:1,siteDevice:'vaporator',deployRegion:'tatooine',since:13 }),
    continuous('gravelProtection','Schützt Figuren hier und an benachbarten Sites vor Gravel Storm.','characters at or next to the site',
      'Vaporator protects its site and adjacent sites from Gravel Storm',{ since:13 }),
  ],true);
  register(['Dark:1064'], [
    continuous('gravelStorm','An ausgewählten Tatooine-Sites eine gegnerische anwesende Figur anzielen. Sie geht verloren, wenn Destiny höher als ihre Ability ist.',
      'opposing character present at a listed unprotected site','Vaporator protects its site and adjacent sites from Gravel Storm',
      { sites:['dune sea','jundland wastes',"beggar\'s canyon","lars\' moisture farm",'jawa camp','mos eisley'],duration:'instant',expires:'after resolving',since:13 }),
  ],true);
  register(['Light:1778', 'Dark:2373'], [
    continuous('locationEffect', 'Legt ein Planetensystem unter Nachtbedingungen für dessen Sites. In Battles dort zählen zusätzliche Destiny-Draws nur zur Power. Spione werden an Nacht-Sites frei ausgespielt.',
      'planet system', 'Nightfall and Sunsdown', { since: 3, nightfall: true }),
  ], true);

  for (const [ids, name, directTarget, drawTarget] of [
    [['Light:2217', 'Dark:2216'], 'Sense', 'Alter', 'Interrupt oder React'],
    [['Light:95', 'Dark:94'], 'Alter', 'Sense', 'Effect oder Utinni Effect'],
  ]) {
    register(ids, [
      { event: 'counter', mode: 'direct', name, targets: directTarget.toLowerCase(), cost: 0, duration: 'instant', expires: 'after resolution',
        summary: 'Hebt gerade gespieltes ' + directTarget + ' ohne Destiny auf.', test: 'Sense and Alter offer', since: 3 },
      { event: 'counter', mode: 'destiny', name, targets: drawTarget, cost: 0, duration: 'instant', expires: 'after resolution',
        summary: 'Hebt ' + drawTarget + ' auf, wenn Destiny unter der höchsten Ability eines eigenen Charakters auf dem Tisch liegt.',
        test: 'Sense and Alter offer', since: 3 },
    ]);
  }
  register(['Dark:304'], [
    continuous('namedCancellation', 'Hebt eine der auf der Karte genannten Spielkarten ohne Destiny auf. Der Interrupt kommt nach erfolgreicher Ausführung in den Used Pile.',
      'named interrupt or effect','Boring Conversation Anyway cancels only named cards',{since:21,
        names:['report to lord vader','scomp link access','rebel planners','rebel reinforcements','gift of the mentor','panic',
          "don't get cocky",'skywalkers','demotion','combined attack','surprise assault']}),
  ]);
  register(['Dark:1880'], [
    continuous('overload','Zielt auf eine aktive Waffe außer Gaderffii Stick und Ewok-Waffen. Destiny unter dem Waffen-Destiny kostet die Waffe. Bei 0 geht zusätzlich die tragende Figur oder das Schiff verloren.',
      'weapon in play','Overload compares weapon destiny and removes a carrier on zero',{since:21}),
  ]);
  register(['Light:781'], [
    continuous('droidShutdown','Hebt den gegnerischen Versuch auf, deinen Droiden gezielt zu treffen, zu stehlen, zu verlieren oder zu fangen. Schützt ihn für den Rest des Zugs vor weiteren solchen Versuchen.',
      'own droid directly targeted by the opponent','Droid Shutdown protects a directly targeted droid for the turn',{since:21}),
  ]);
  register(['Dark:768'], [
    continuous('pilotPower','Gibt jedem von Evazan pilotierten Schiff +2 Power.','piloted ship','Evazan operates immediately after any other character is hit or disarmed',{amount:2,legacy:true}),
    continuous('evazanOperation','Darf eine andere gerade getroffene oder entwaffnete Figur am selben physischen Ort sofort verlieren lassen.',
      'other character just hit or Disarmed','Evazan operates immediately after any other character is hit or disarmed',{since:21}),
  ]);
  register(['Dark:502'], [
    continuous('pilotPower','Gibt jedem von Praji pilotierten Schiff +2 Power.','piloted ship','Praji suppresses the droid text only while present',{amount:2,legacy:true}),
    continuous('pilotHyperspeed','Gibt Devastator +1 Hyperspeed, wenn Praji selbst das Schiff pilotiert.','Devastator','Praji suppresses the droid text only while present',{amount:1,legacy:true}),
    continuous('droidTextSuppression','Hält den Spieltext von C-3PO oder R2-D2 am Ort auf, solange Praji dort anwesend ist.',
      'C-3PO and R2-D2 at the location','Praji suppresses the droid text only while present',{since:21}),
  ]);
  register(['Light:343'], [
    continuous('droidRebelPairs','Gibt an derselben Site +2 Gesamt-Power für jedes eigene anwesende Droide/Rebel-Paar. C-3PO zählt mit.',
      'friendly present Rebel and droid pairs','C-3PO counts distinct pairs and adds forfeit to R2-D2',{amount:2,since:21}),
    continuous('artooForfeit','Gibt dem mit C-3PO anwesenden R2-D2 +2 Forfeit.',
      'R2-D2 present with C-3PO','C-3PO counts distinct pairs and adds forfeit to R2-D2',{amount:2,since:21}),
  ]);
  for(const [id,other] of [['Light:761','Dark:2884'],['Dark:2884','Light:761']]){
    register([id],[
      continuous('battleDamageModifier','Wenn der Gegner gerade einen Kampf begonnen hat, verdreifacht den Battle Damage der später unterlegenen Seite. Kann alternativ die Wirkung der gegnerischen Karte verdreifachen.',
        'just initiated battle or opposing battle damage interrupt','battle damage multipliers leave attrition unchanged',
        {multiplier:3,amplify:other,since:21}),
    ]);
  }
  register(['Light:1236'], [
    continuous('battleDamageModifier','Wenn du einen Kampf mit weniger Power angefangen hast und ihn gewinnst, erleidet die Dark Side doppelten Battle Damage, mit Han am Kampfort dreifachen.',
      'just initiated battle with Light Side at lower power','Bad Feeling modifies damage only when the underdog wins',
      {multiplier:2,ownBattle:true,withHan:3,since:21}),
  ]);
  register(['Light:1331'], [
    continuous('reduceForceLoss','Du darfst für jedes eingesetzte Force einen Punkt eines bevorstehenden Force-Verlusts begleichen.',
      'own Force loss result','It Could Be Worse spends Force and It’s Worse modifies the original loss',{since:21}),
  ]);
  register(['Dark:1338'], [
    continuous('increaseForceLoss','Hebt It Could Be Worse auf und erhöht dessen ursprünglichen Force-Verlust um die eingesetzte Force. Alternativ verliert die Light Side nach Force-Verlust aus einem Battle eine weitere Force.',
      'It Could Be Worse or Light Force loss from battle','It Could Be Worse spends Force and It’s Worse modifies the original loss',{since:21}),
  ]);
  for(const id of ['Light:38','Dark:22']){
    register([id],[
      continuous('reserveInsert','Einmal pro Partie im eigenen Deploy verdeckt in das gegnerische Reserve Deck einmischen. Sobald die Karte oben liegt, geht sie verloren. Der Gegner kann in diesem Zug keine weitere Force aktivieren.',
        'opponent’s Reserve Deck with at least two cards','reserve inserts stop activation when reached and do not add Life Force',{since:21}),
    ]);
  }
  for(const [id,mode,pile,summary,test] of [
    ['Light:222','beruStew','Lost','Beide Seiten aktivieren sofort 2 Force in der Reihenfolge, die die aktive Seite bestimmt. Light darf zusätzlich je nach Anzahl von Beru, Owen und Hydroponics Stations aktivieren.','Beru Stew activates on both sides in the turn player’s order'],
    ['Light:2764','doomed','Used','Bei weniger als 15 Life Force in der gegnerischen Control Phase spielbar. Halbiere jeden Force-Verlust bis Zugende. Mit R2-D2 oder C-3PO auf dem Tisch abrunden, sonst aufrunden.','We’re Doomed halves individual losses only during the turn'],
    ['Dark:2762','trashCompactor','Lost','Alle Karten im Trash Compactor werden verloren. Die Site bleibt im Spiel.','the Trash Compactor destroys both sides’ cards at its site'],
  ]){
    register([id],[continuous('pileInterrupt',summary,mode,test,{mode,pile,since:21})]);
  }
  register(['Light:917','Dark:2897'], [
    continuous('lostPileCover','Wird neben einem beliebigen Lost Pile ausgelegt. Dieser Stapel liegt verdeckt und Kämpfe, Handverluste sowie Rückholaktionen zeigen die Karte beim jeweiligen Vorgang. Karten, die direkt aus Life Force verloren werden, bleiben dabei verdeckt.',
      'one Lost Pile','cover effects keep losses from Life Force hidden and leave legal retrieval intact',{since:21}),
  ]);
  for(const [id,weaponType,targets] of [['Light:483','Starship',['Starship']],['Dark:1932',null,['Character','Vehicle']]]){
    register([id],[
      continuous('combinedWeaponFire','Bündelt mindestens zwei passende Waffen mit normalen Kosten gegen ein gemeinsames Ziel. Jede Waffe wertet die gemeinsame Waffen-Destiny in der festgelegten Reihenfolge aus.',
        targets.join(' or '),'both sides can combine applicable weapons against one target',{weaponType,validTargets:targets,since:21}),
    ]);
  }
  register(['Light:758'], [
    continuous('combinedBattleDestiny','Ergänzt zwei Battle Destiny, wenn Luke und Han gemeinsam kämpfen.','Luke and Han in battle',
      'Don’t Get Cocky adds destiny or removes a TIE ln at battle initiation',{draws:2,since:21}),
    continuous('battleTieLoss','Wenn Dark gerade einen Raumkampf begonnen hat, wähle einen anwesenden TIE/ln, der verloren geht.',
      'TIE/ln present at a just initiated opposing battle','Don’t Get Cocky adds destiny or removes a TIE ln at battle initiation',{since:21}),
  ]);
  register(['Light:1749','Dark:824'], [
    continuous('groupRelocation','Außerhalb eines Battles darfst du eigene Charaktere von einer Site gemeinsam zu einer anderen Site versetzen. Ziehe Destiny als Force-Kosten. Ohne Zahlung geht der Interrupt in die Lost Pile.',
      'selected friendly characters at one site','Nabrun and Elis relocate only the selected group, at the drawn cost',{since:21}),
  ]);
  register(['Light:1321'], [
    continuous('garbageChute','Bei einem gerade begonnenen Battle an einer anderen Death-Star-Site wechseln alle beteiligten eigenen Charaktere kostenlos in den Trash Compactor. Der Battle wird aufgehoben.',
      'just initiated Death Star battle','the garbage chute cancels a Death Star battle and moves its Light characters',{since:21}),
  ]);
  register(['Dark:253'], [
    continuous('tableEffect','Auf der eigenen Tischseite ausspielen.','own side of table','Blast Door Controls cancels the listed interrupts',{ownSide:true,since:21}),
    continuous('autoCancelNamed','Hebt Into The Garbage Chute, Flyboy, Narrow Escape, Blast The Door, Kid! und Rebel Barrier auf.',
      'listed Light Side Interrupt','Blast Door Controls cancels the listed interrupts',{ids:['Light:1321','Light:1755','Light:2033','Light:255'],
        names:['blast the door, kid!'],since:21}),
  ]);
  register(['Dark:993'], [
    continuous('pileInterrupt','Ziehe für 2 Force Destiny. Liegt sie unter der Zahl an Stormtroopers auf dem Tisch, ist die gegnerische Bewegung bis Zugende blockiert. Schmuggler und ihre Schiffe sind ausgenommen.',
      'opposing movement','Full Scale Alert blocks opposing movement except smugglers and their starships',
      {mode:'fullScaleAlert',pile:'Lost',cost:2,since:21}),
  ]);
  for(const [id,ships,summary] of [
    ['Light:882',false,'Wenn ein eigenes Capital Starship gleich verloren geht, versetzt du seine eigenen Charaktere an eine beliebige Planet-Site.'],
    ['Dark:888',true,'Wenn ein eigenes Capital Starship gleich verloren geht und Tarkin nicht an Bord ist, versetzt du seine eigenen Charaktere an eine Planet-Site oder vollständig auf ein anderes eigenes Capital Starship mit genügend Platz.'],
  ]){
    register([id],[continuous('shipEvacuation',summary,'characters aboard a capital starship about to be lost',
      'both evacuations save crew before a capital ship is lost',{ships,since:21})]);
  }
  register(['Light:1827'], [
    continuous('oldBen','Für 1 Force kehrt derselbe gerade an einer Tatooine-Site forfeitet Charakter zurück, sofern er nicht Obi-Wan ist.',
      'same friendly character just forfeited at Tatooine','Old Ben returns the exact forfeited card outside the battle',{cost:1,since:21}),
  ]);
  register(['Dark:1440'], [
    continuous('kintanStrider','Für 1 Force nach gegnerischem Charakterverlust den eigenen obersten Charakter im Lost Pile auf die Hand nehmen.',
      'friendly character nearest the top of the Lost Pile','Kintan Strider takes the closest character into hand',{cost:1,since:21}),
  ]);
  register(['Dark:1237'], [
    continuous('postBattleStarfighter','Für 1 Force nach einem Raumkampf einen dortigen gegnerischen Starfighter mit Maneuver wählen. Destiny über dessen Maneuver lässt ihn verloren gehen.',
      'opposing starfighter with maneuver at the battle location','A Problem Here targets only starfighters at the finished battle',{cost:1,since:21}),
  ]);
  register(['Light:1893','Dark:830'], [
    continuous('emergencyDeployment','Bei einem gerade vom Gegner begonnenen Kampf mit mehr als der doppelten eigenen Power bis zu 3 Reserve-Karten aufdecken. Erlaubte Karten können kostenlos regelgerecht ausgespielt werden. Alle übrigen aufgedeckten Karten gehen verloren.',
      'up to three cards from the defender’s Reserve Deck','Panic and Emergency Deployment reveal cards and allow only eligible free deployments',
      {limit:3,since:21}),
  ]);
  for(const [id,optional] of [['Light:2043',true],['Dark:1282',false]]){
    register([id],[
      continuous('pileInterrupt','Wenn der Gegner mehr Charaktere und Schiffe auf dem Tisch hat, nutze 1 Force und ziehe Destiny. Hole entsprechend viele passende Truppen oder Jäger aus deiner Lost Pile zurück.',
        optional?'Rebel Troopers or Y-wings':'Stormtroopers or TIE/lns','both Reinforcements cards retrieve only their printed units',
        {mode:'reinforcements',pile:'Lost',cost:1,optional,since:21}),
    ]);
  }
  register(['Light:1050'], [
    continuous('crewCapacity','Zwei Plätze für Piloten oder Passagiere und ein zusätzlicher Astromech-Platz.',
      'two shared crew seats and one astromech','Gold 5 and the Black Squadron ships use their printed crew capacities',{since:21}),
  ]);
  register(['Dark:247','Dark:249'], [
    continuous('crewCapacity','Ein Platz für einen Piloten. Für die Teilnahme im Weltraum muss ein Pilot an Bord sein.',
      'one pilot seat','Gold 5 and the Black Squadron ships use their printed crew capacities',{since:21}),
  ]);
  register(['Light:2785'], [
    continuous('mechanicImmunity','Eigene Fahrzeuge und Droiden am selben Ort sind immun gegen Attrition unter 2.',
      'friendly vehicles and droids at same location','the Light mechanic protects units and can cancel Lateral Damage',{below:2,since:21}),
    continuous('dockingMechanicImmunity','An einer Docking Bay sind die eigenen Starfighter am zugehörigen System und an Sektoren immun gegen Attrition unter 3.',
      'friendly starfighters at a related system or sector','the Light mechanic protects units and can cancel Lateral Damage',{below:3,since:21}),
    continuous('cancelLateralDamage','An einer Docking Bay darf WED-9-M1 Lateral Damage aufheben.',
      'Lateral Damage','the Light mechanic protects units and can cancel Lateral Damage',{since:21}),
  ]);
  register(['Dark:1480'], [
    continuous('locationEffect','Auf einem System ausspielen und ein gegnerisches Schiff als Ziel wählen. Seine Power und sein Forfeit werden auf 0 gesetzt. Dort darf das Ziel sofort und bei Fehlschlag in den eigenen Move Phases zur Reparatur Destiny ziehen.',
      'opposing starship','Lateral Damage resets ship values until a successful repair',{mission:'lateral-damage',since:21}),
  ]);
  register(['Dark:2214'], [
    continuous('locationEffect','Für 2 Force an einer Tatooine-Site ohne Docking Bay ausspielen. Ziele auf einen Trooper am Todesstern. Solange dieser bei dem Effect bleibt, erhält der Gegner in Tatooine-Battles +1 Attrition.',
      'trooper at a Death Star location','the detachment adds attrition even without battle destiny',{cost:2,mission:'detachment',since:21}),
  ]);
  register(['Dark:2397'], [
    continuous('tacticalRecall','Nach einem gewonnenen Battle auf einer anderen Yavin-4-Site ausspielen. Ein beteiligter Warrior verliert 2 Power und Forfeit, Leia je 3, bis er die Site erreicht.',
      'warrior from the just won battle','Tactical Re-Call penalizes a participating warrior until reaching the site',{since:21}),
    continuous('locationEffect','Verfolgt das Ziel bis zur Yavin-4-Site.','recall target','Tactical Re-Call penalizes a participating warrior until reaching the site',
      {mission:'tactical-recall',since:21}),
  ]);
  for(const id of ['Light:1402','Dark:1688']){
    register([id],[
      continuous('tableEffect','Auf der eigenen Tischseite ausspielen.','own table','ability spent on battle power cannot also count toward destiny',
        {ownSide:true,since:21}),
      continuous('convertAbilityToPower','Im Battle bis zu einer Force pro anwesender eigener Ability einsetzen. Jede eingesetzte Force erhöht die Gesamt-Power um 1. Diese Ability steht für Battle Destiny nicht mehr zur Verfügung.',
        'present friendly ability','ability spent on battle power cannot also count toward destiny',{since:21}),
    ]);
  }
  register(['Light:1554'], [
    continuous('tableEffect','Auf einen eigenen Charakter mit Ability über 2 und Lichtschwert ausspielen. Der Effect geht verloren, wenn der Träger sein Lichtschwert verliert.',
      'friendly character with a lightsaber','Lightsaber Proficiency adds battle power and optional Force drain',{characterTarget:'saber-user',since:21}),
    continuous('saberTraining','Der Träger erhält im Battle +3 Power. Wo er anwesend ist, kann er den Force Drain um 1 erhöhen.',
      'trained character with lightsaber','Lightsaber Proficiency adds battle power and optional Force drain',{amount:3,drain:1,since:21}),
  ]);
  register(['Light:1643'], [
    continuous('tableEffect','Für 3 Force auf der eigenen Tischseite ausspielen. Mit C-3PO auf dem Tisch kostenlos.',
      'own table','Mantellian Savrip permits hand forfeits only after a loss',{ownSide:true,freeWithThreepio:true,cost:3,since:21}),
    continuous('handForfeit','Nach einem verlorenen Battle dürfen Charaktere, Schiffe und Fahrzeuge direkt aus der Hand für ihren Forfeit-Wert verloren gehen.',
      'friendly unit in hand with a forfeit value','Mantellian Savrip permits hand forfeits only after a loss',{since:21}),
  ]);
  register(['Light:2412'], [
    continuous('substituteHit','Kann an derselben Site anstelle eines getroffenen eigenen Charakters forfeitet werden. Beide Karten werden zuvor von Waffenfolgen befreit.',
      'other hit friendly character at same site','Talz restores both hits before forfeiting',{since:21}),
    continuous('nightPower','Unter Nachtbedingungen hat Talz +2 Power.','nighttime conditions','Talz restores both hits before forfeiting',{amount:2,since:21}),
  ]);
  register(['Dark:1720'], [
    continuous('myoPower','Bei Lirin Car’n oder einem Bounty Hunter anwesend +1 Power.',
      'Lirin Car’n or a bounty hunter physically present','Myo regenerates in battle and gains power with a bounty hunter',{amount:1,since:21}),
    continuous('regenerate','Bei Verlust oder Forfeit als Folge eines Battles oben auf die Used Pile legen.',
      'Myo lost from battle','Myo regenerates in battle and gains power with a bounty hunter',{since:21}),
  ]);
  register(['Dark:1958'], [
    continuous('battlePrediction','Wenn die Dark Side dort einen Kampf beginnt und Prophetess anwesend ist, sagt sie den Gewinner vorher. Richtige Vorhersage holt zufällig eine verlorene Karte zurück. Bei falscher Vorhersage oder Gleichstand verliert Dark 1 Force.',
      'Dark initiated battle with Prophetess present','Prophetess predicts only while active and settles once',{since:21}),
    continuous('attritionImmunity','Immun gegen Attrition unter 3.','Prophetess','Prophetess predicts only while active and settles once',{below:3,legacy:true}),
  ]);
  for(const [id,mode,cost,pile,summary,test] of [
    ['Dark:2242','setStun',2,'Lost','Zielt für 2 Force auf einen gegnerischen Charakter. Bei Destiny über dessen Ability gehen der Charakter und seine Ausrüstung auf die Hand der jeweiligen Eigentümer zurück.','Set For Stun returns the character and each attachment to its owner'],
    ['Dark:2410','tallonRoll',0,'Used','Wähle eigenen TIE/ln und gegnerischen Rebel Starfighter am selben System oder Sektor. Beide ziehen Destiny und zählen eigene Power hinzu, Dark auch Maneuver. Niedrigerer Wert verliert das Schiff.','Tallon Roll handles ties and failed destiny draws'],
    ['Dark:1904','chokeTrooper',0,'Lost','Einen gegnerischen Rebel Trooper sofort verlieren lassen.','Physical Choke can act after winning before battle damage'],
    ['Dark:1767','nevar',0,'Lost','Sind beide Spione an derselben Site, ziehe Destiny gegen den gegnerischen Spion. Ab Gesamt-Destiny über 2 geht er verloren. Für einen Undercover-Spion zählt +2.','Nevar Yalnal can target an undercover spy'],
  ]){
    const extra=id==='Dark:1904'?[continuous('chokeAfterBattle','Nach einem gewonnenen Battle mit eigenem Dark Jedi vor Ort für 1 Force Destiny gegen die Ability eines gegnerischen dort anwesenden Charakters ziehen. Liegt sie darüber, geht das Ziel verloren.',
     'opposing character at a won battle','Physical Choke can act after winning before battle damage',{cost:1,since:21})]:[];
    register([id],[continuous('pileInterrupt',summary,mode,test,{mode,pile,cost,since:21}),...extra]);
  }
  register(['Dark:2901'], [
    continuous('vaderObiDestiny','Wenn Darth Vader und Obi-Wan am selben Battle teilnehmen, darf Dark eine Battle Destiny hinzufügen.',
      'Darth Vader and Obi-Wan in battle','Your Powers Are Weak adds a draw or cancels named cards',{draws:1,since:21}),
    continuous('namedCancellation','Hebt Return Of A Jedi, Jedi Lightsaber, Jedi Presence oder Old Ben auf.',
      'one named card','Your Powers Are Weak adds a draw or cancels named cards',
      {names:['return of a jedi','jedi lightsaber','jedi presence','old ben'],since:21}),
  ]);
  for(const [id,mode,cost,summary,targets] of [
    ['Light:1406','kabe',0,'Bei Destiny unter der Destiny-Zahl stiehlt Kabe Device oder Charakterwaffe. Waffen kann sie kostenlos an einen Warrior weitergeben.','opposing character weapon or device at same site'],
    ['Light:1690','momaw',0,'Übernimmt ein an derselben Site anwesendes benanntes Reittier oder Wesen.','Bantha, Dewback, Wampa, Rancor, Bubo or Dragonsnake at same site'],
    ['Light:2811','wioslea',1,'Zieht für 1 Force Destiny. Über der Ziel-Destiny darf Wioslea das Ziel für seine Deploy-Kosten kaufen.','opposing unoccupied transport vehicle or droid present'],
    ['Dark:2613','tonnika',2,'Zweimal pro eigener Control Phase je zwei Destiny ziehen. Mindestens eine 2 erlaubt bis zu zwei Waffen oder zwei Devices zu stehlen oder zu zerstören.','weapons or devices present'],
  ])register([id],[...(cards.get(id)?.effects??[]),continuous('controlTheft',summary,targets,'Control theft respects target type, payment and ownership',{mode,cost,since:21})]);
  register(['Dark:1238'],[continuous('navSabotage','Für 1 Force gegen einen Nav Computer oder Astromech Destiny ziehen. Über 1 geht das Ziel verloren. Beim Computer bleibt der Effect am Schiff und ermöglicht einen Astromech.','nav computer or astromech aboard a starship','Navigation sabotage removes only the chosen navigator',{cost:1,since:21})]);
  for(const [id,actor,names] of [
    ['Light:2180','r-unit',["we're all gonna be a lot thinner!",'boring conversation anyway']],
    ['Dark:1265','imperial-leader',['scomp link access','into the garbage chute, flyboy']],
  ])register([id],[
    continuous('pileInterrupt','Mit dem passenden Charakter am Scomp Link ein Reserve Deck 20 Sekunden ansehen, dann mischen und zurücklegen.',
     'either Reserve Deck','Scomp access requires a qualified actor and preserves secrecy',{mode:'scompPeek',actor,pile:'Used',since:21}),
    continuous('namedCancellation','An einem Scomp Link auf dem Todesstern kann die Karte einen der genannten Interrupts aufheben.',
     'named interrupt on the Death Star','Scomp access requires a qualified actor and preserves secrecy',{names,actor,since:21}),
  ]);
  for(const [id,mode,cost,pile,targets,summary] of [
    ['Light:1187','handRefresh',1,'Used','friendly droid at Dune Sea or Scomp link','Tauscht die übrige Hand gegen dieselbe Anzahl Reserve-Karten. Mit C-3PO oder R2-D2 kommt eine hinzu.'],
    ['Light:2319','speederSale',0,'Used','friendly vehicle or droid at Mos Eisley or Wioslea','Zwei Destiny bestimmen das Angebot und aktivieren ebenso viel Force. Lukes X-34 verwendet drei. Das verkaufte Ziel geht verloren.'],
    ['Light:2509','makerRetrieval',1,'Lost','friendly droid and at least five Force lost to drains this opponent control phase','Nach insgesamt 5 verlorener Force durch gegnerische Drains mit einem Droiden für 1 Force Destiny ziehen und zufällige Karten zurückholen.'],
  ])register([id],[continuous('pileInterrupt',summary,targets,'Control and Scomp pile Interrupts',{mode,cost,pile,since:21})]);
  for(const [id,mission,trigger,summary] of [
    ['Light:1913','plastoid-armor','stormtrooper-loss','Nach dem Verlust eines Stormtroopers am Todesstern eine eigene Figur von außerhalb dorthin schicken. Dort erhält sie Armor 5, das Spy-Merkmal sowie +2 Power und Forfeit.'],
    ['Light:2646','breath-mask','tatooine-win','Nach einem Sieg an einer Tatooine-Site eine eigene Figur von außerhalb dorthin schicken. Auf Tatooine verleiht die Maske +2 Power und Forfeit und schützt vor genau 3 Attrition.'],
    ['Dark:1599','luke-recall',null,'Ziele an einer Tatooine-Site auf einen Rebel. Power und Forfeit −1, bei Luke −3. Bei Forfeit 0 geht er verloren. Beim Erreichen der Site wird der Effect aufgehoben.'],
  ])register([id],[continuous('locationEffect',summary,mission,'Utinni effects persist, arrive and equip',{mission,trigger,since:21})]);
  register(['Dark:1401'],[
    continuous('tableEffect','Falls eine der benannten Locations oder Jabba’s Sail Barge ausliegt, auf einen Alien ausspielen.','alien','Juri Juice inhibits battle ability and is removed by a move without driving',{characterTarget:'juri-alien',since:21}),
    continuous('juriJuice','Verhindert Battle Ability und Kabes Diebstahl. Der Träger hebt den Effect durch entsprechende Bewegung ohne Fahren auf.','host','Juri Juice inhibits battle ability and is removed by a move without driving',{since:21}),
  ]);
  register(['Dark:1709'],[...(cards.get('Dark:1709')?.effects??[]),continuous('mouseUtinni','Der Mouse Droid wird an der Site eines Utinni-Ziels ausgespielt. Er kann den Effect aufnehmen, mitführen und an das Ziel liefern. Danach geht er auf die Hand. Kessel Run ist ausgenommen.','targeted Utinni Effect except Kessel Run','Mouse Droid carries and delivers a targeted Utinni Effect',{since:21})]);
  register(['Light:730'],[continuous('poisonStinger','Reagiert einmal pro Zug auf eine gegnerische Figur, die am selben Ort eine Waffe abgefeuert hat. Für 1 Force trifft Dice bei Destiny gleich Ability.','opposing character just fired a weapon','Dice Ibegon stings the character who fired',{cost:1,since:21})]);
  register(['Light:942'],[continuous('wager','Einmal in der eigenen Control Phase für 1 Force drei Destiny gegen zwei des Gegners ziehen. Wer mehr hat, darf eine zufällige verlorene Karte zurückholen.','both players','Figrin resolves a wager and offers random retrieval',{cost:1,since:21})]);
  register(['Dark:619'],[continuous('locationEffect','An einer Site mit Nachtbedingungen je ein Destiny für jeden anwesenden Nicht-Droiden ziehen. Bei Destiny über Ability schläft die Figur bis Ende des nächsten Dark-Zugs.','night site characters other than droids','Dark Hours sleeps eligible characters and expires',{darkHours:true,since:21})]);
  register(['Dark:266'],[continuous('blasterScope','Wird auf den eigenen Blaster oder das Concussion Rifle aus Dagobah gelegt. Erlaubt die Zielwahl an einer benachbarten Site. Ein Treffer dort wird als Verlust nach dem Battle abgehandelt.','friendly blaster or 4-LOM Concussion Rifle','Blaster Scope targets and loses an adjacent nonparticipant',{since:21})]);
  register(['Dark:1815'],[continuous('locationEffect','Wird an einer Site ausgelegt. Eigene automatisierte Waffen an derselben oder einer benachbarten Site erhalten +1 auf die gesamte Waffen-Destiny.','site','Holocam boosts automated weapons and borrows adjacent power',{siteDevice:'observation-holocam',since:21}),
    continuous('holocamPower','Fügt im Battle einmal die Power einer eigenen anwesenden Figur an einer benachbarten kontrollierten Site hinzu.','friendly character at an adjacent controlled site','Holocam boosts automated weapons and borrows adjacent power',{since:21})]);
  register(['Light:1834'],[continuous('pileInterrupt','Wähle für 1 Force einen Rebel mit Ability über 2 und eine Zahl von 1 bis 6. Bei höherer Destiny darfst du entsprechend viel Force zurückholen, sonst geht der Rebel verloren.','Rebel on table with ability greater than 2','On The Edge requires a higher destiny and offers retrieval',{mode:'onTheEdge',pile:'Lost',cost:1,since:21})]);
  register(['Light:1794'],[continuous('nobleSacrifice','Nach einem gegnerischen Charakter-Deploy einen eigenen Charakter mit derselben Power aus dem Spiel nehmen, auch einen Gefangenen. Optional Force in Höhe seines Forfeits zurückholen.','own character with equal power, including captive','Noble Sacrifice removes the equal-power captive',{since:21})]);
  for(const id of ['Light:2689','Dark:2688'])register([id],[
    continuous('pileInterrupt','Ein eigener Jawa an der Location nimmt einen Utinni Effect als eigene Karte auf die Hand.','Utinni Effect at a Jawa’s location','Utinni steals only where a Jawa is present and cancels Jawa titles',{mode:'utinniSteal',pile:'Used',since:21}),
    continuous('namedCancellation','Hebt einen Interrupt oder Effect mit dem Wort Jawa im Titel auf.','named Jawa Interrupt or Effect','Utinni steals only where a Jawa is present and cancels Jawa titles',{nameWord:'jawa',since:21}),
  ]);
  register(['Dark:2517'],[continuous('duel','Bei Präsenz Vaders und Obi-Wans an derselben Site für 1 Force ein Duell beginnen. Je +2 Power mit Lichtschwert. Der Verlierer wird aus dem Spiel entfernt. Gleichstand lässt beide im Spiel.','Darth Vader and Obi-Wan at the same physical site','The Circle Is Now Complete compares one saber bonus for each duelist',{cost:1,since:21})]);
  register(['Light:1125'],[
    continuous('helpObi','Obi-Wan an einer eigenen kontrollierten Site gibt einem Battle anderswo einen Teil seiner Ability für Battle Destiny. Diese Ability bleibt für den Rest des Zugs verbraucht.','Obi-Wan at a controlled site away from the battle','Help Me Obi-Wan spends ability and reacts',{since:21}),
    continuous('helpRebel','Ein Rebel kann als React von einer benachbarten Site zu einem Battle ziehen.','Rebel at an adjacent site','Help Me Obi-Wan spends ability and reacts',{since:21}),
  ]);
  register(['Light:2570'],[
    continuous('pileInterrupt','Verliere einen Droiden, um für diesen Zug die eigene Attrition an seiner Site aufzuheben.','friendly droid at a site','This Is All Your Fault redirects a shot and cancels attrition',{mode:'droidAttrition',pile:'Used',since:21}),
    continuous('droidRedirect','Lenkt eine gegnerische Waffe auf einen eigenen Droiden am selben Ort. Bei Treffer übernimmt der Droide die Forfeit-Zahl des ursprünglichen Ziels.','friendly droid at the original target location','This Is All Your Fault redirects a shot and cancels attrition',{since:21}),
  ]);
  register(['Dark:1565'],[continuous('pileInterrupt','Zu Beginn der eigenen Battle Phase in der Cantina für 1 Force zwei Stormtrooper gegen einen gegnerischen Charakter kämpfen lassen. Optional eine Battle Destiny hinzufügen und die Cantina für weitere Battles dieses Zugs sperren.','two Stormtroopers and one opposing character in the Cantina','Local Trouble limits the Cantina battle to three chosen characters',{mode:'localTrouble',pile:'Lost',cost:1,since:21})]);
  register(['Light:585'],[continuous('tableEffect','Auf die eigene Tischseite ausspielen. Danach dürfen gerade verlorene Fahrzeuge, Droiden, Waffen und Devices als Unterstützung hier gestapelt werden. In jeder eigenen Deploy Phase einmal mit einer Handkarte tauschen.','just lost vehicle, droid, weapon or device','Crash Site Memorial stacks only subsequent losses and exchanges once',{ownSide:true,memorial:true,since:21})]);
  register(['Light:2863'],[continuous('locationEffect','An einer Location ausspielen und einen gegnerischen Charakter benennen. Mig kann sich wie ein Charakter bewegen. Wenn das Ziel ihn einholt, wird er aufgehoben. Bis dahin verliert der Gegner in Battles an Migs Site und ihren Nachbar-Sites 1 Gesamt-Power.','opposing character','Yerka Mig moves and is canceled by the pursuing character',{mission:'yerka-mig',since:21})]);
  register(['Dark:1857'],[continuous('locationEffect','An einer Yavin-4-Site einen Imperial benennen. Wenn er die Site erreicht, wird der Effect an ihn angelegt. Bei einem eigenen Force Drain dort +1. Danach darf die Kette kostenlos an einen eigenen Imperial an einer benachbarten kontrollierten Site weitergegeben werden.','Imperial and adjacent controlled site','Organa’s necklace follows its carrier and passes after a drain',{mission:'necklace',since:21})]);
  register(['Light:215'],[continuous('locationEffect','Für 3 Force an einer Außen-Site auf Tatooine ausspielen, im Beggar’s Canyon kostenlos. In eigenen Zügen darfst du mit gegnerischer Force bezahlen. Bei insgesamt mehr als einer geliehenen Force geht Beggar am Zugende verloren. Der vorgeschriebene Gegneranteil am Jawa-Deploy zählt dabei nicht.','exterior Tatooine site and costs paid with opposing Force','Beggar counts borrowed Force across actions and loses at turn end',{beggar:true,since:21})]);
  register(['Light:2514', 'Dark:1831'], [
    { event: 'shufflePile', summary: 'Mische das nicht leere Reserve Deck, den Used Pile oder den Lost Pile einer beliebigen Seite, ohne Karten aufzudecken.',
      cost: 0, targets: 'Reserve Deck, Used Pile or Lost Pile', duration: 'instant', expires: 'after shuffle', test: 'Pile shuffling', since: 3 },
  ], true);
  register(['Dark:1939'], [
    continuous('locationEffect', 'Ergänzt je ein Light- und Dark-Force-Icon an einer Location. Mehrere Kopien am selben Ort geben den Bonus einmal.',
      'location', 'registered location effects', { expires: 'when canceled', iconBonus: 1 }),
  ], true);
  register(['Light:2110'], [
    continuous('rotateLocation', 'Revolution kostet 3 Force. Es vertauscht Force-Icons und Spieltextseiten. Alter kann die Ausspielaktion aufheben oder die ursprüngliche Ausrichtung wiederherstellen.',
      'location', 'Alter restores a rotated location', { cost: 3, since: 2, expires: 'when canceled' }),
    continuous('rotateExpandedText','Expand The Empire wechselt mit der gedrehten Site die begünstigte Seite.',
      'Expand The Empire on that site','Expand The Empire copies one side and follows Revolution',{since:21}),
  ]);
  register(['Light:664'], [
    continuous('locationEffect', 'Ein eigener Droide holt die Pläne von einer Death-Star-Site außerhalb der Docking Bay und bringt sie zu einer Yavin-4-Site. Drei Destiny-Draws bestimmen die Rückgewinnung.',
      'droid-outside-death-star', 'Death Star Plans tracks', { expires: 'completion, cancellation or target lost', mission: 'death-star-plans' }),
  ], true);
  register(['Light:1429'], [
    continuous('locationEffect', 'Ein eigener Schmuggler fliegt von einem anderen System nach Kessel und zurück. Ein gegnerischer Destiny-Draw von 0 kostet das Schiff. Bei Rückkehr wird die beim Ausspielen festgelegte Parsec-Distanz an Force zurückgeholt.',
      'smuggler-aboard-starship', 'Kessel Run tracks', { expires: 'completion, cancellation or target lost', mission: 'kessel-run', since: 2 }),
  ], true);
  register(['Light:1870'], [
    continuous('locationEffect', 'Ein Rebel von Tatooine reist nach Alderaan. Bei Ankunft werden pro eigenem Force-Attuned-Charakter 1 Force und pro Force-Sensitive-Charakter oder Jedi 2 Force zurückgeholt.',
      'Rebel on Tatooine', 'Our Most Desperate Hour reaches Alderaan', { expires: 'completion, cancellation or target lost', mission: 'desperate-hour', since: 3 }),
  ], true);
  register(['Light:305'], [
    continuous('kesselSmuggler', 'BoShek darf einen Kessel Run anstelle eines Schmugglers fliegen.',
      'BoShek aboard a starship', 'Kessel Run tracks', { since: 2 }),
    continuous('pilotPower', 'Ein von BoShek gesteuertes Schiff erhält +3 Power.',
      'piloted ship', 'Premiere pilots apply bonuses only while piloting', { amount: 3, legacy: true }),
    continuous('attritionImmunity', 'BoShek ist immun gegen Attrition unter 3.',
      'BoShek', 'Premiere pilots apply bonuses only while piloting', { below: 3, legacy: true }),
  ], true);
  register(['Light:2040','Dark:1279'], [
    continuous('pilotPower', 'Ein von dieser Karte gesteuertes Schiff erhält +2 Power.',
      'piloted ship', 'Premiere pilots apply bonuses only while piloting', { amount: 2, legacy: true }),
  ], true);
  register(['Light:2038','Dark:1286'], [
    continuous('cannotMove', 'Diese Karte darf sich nicht bewegen. Sie kann von einem Transporter getragen werden.',
      'this character', 'Premiere guards gain defending power and cannot move', { since: 7 }),
    continuous('defendingPower', 'Wenn diese Karte einen Kampf verteidigt, erhält sie +4 Power.',
      'defending participant', 'Premiere guards gain defending power and cannot move', { amount: 4, since: 7 }),
  ], true);
  register(['Light:1556','Dark:1557'], [
    continuous('defuseMine', 'Kann im eigenen Zug für 1 Force eine Mine am selben Site entschärfen.',
      'revealed mine at same site', 'Premiere mining droids defuse mines at the same site', { cost: 1, duration: 'instant', expires: 'after resolving' }),
  ], true);
  register(['Light:1995'], [
    continuous('astromechStats', 'An Bord eines Starfighters steigen Power, Maneuver und Hyperspeed um je 1.',
      'starfighter aboard', 'Premiere navigation droids improve only their supported craft', { amount: 1, legacy: true }),
  ], true);
  register(['Light:2000','Dark:2001'], [
    continuous('vehicleDroidStats', 'An Bord eines Nicht-Kreaturenfahrzeugs steigen Power, Maneuver und Landspeed um je 1.',
      'non-creature vehicle aboard', 'Premiere navigation droids improve only their supported craft', { amount: 1, legacy: true }),
    continuous('transportDriver', 'Dieser Droide kann Transportfahrzeuge fahren.',
      'transport vehicle', 'Premiere navigation droids improve only their supported craft', { legacy: true }),
  ], true);
  for (const [id, ship, power, maneuver] of [
    ['Light:239','Red 3',2,1], ['Light:1098','Millennium Falcon',2,2], ['Dark:790','Black 2',3,1], ['Dark:791','Black 3',3,1],
    ['Light:1390','Red 6',2,1], ['Light:1924','Gold 5',2,1],
  ]) {
    const test = 'Premiere matching pilots grant maneuver and one fallback destiny';
    const effects = [
      continuous('pilotPower', 'Das gesteuerte Schiff erhält +' + power + ' Power.', 'piloted ship', test, { amount: power, legacy: true }),
      continuous('matchingPilot', 'Beim Steuern von ' + ship + ' gelten +' + maneuver + ' Maneuver und eine Battle Destiny, falls kein regulärer Draw möglich ist.',
        ship, test, { amount: maneuver, legacy: true }),
    ];
    if (id === 'Light:1098') effects.push(continuous('redrawOwnDestiny', 'Einmal pro Battle für 1 Force eigenes gerade gezogenes Destiny neu ziehen.',
      'own just drawn destiny', 'Han can pay for one replacement', { cost: 1, duration: 'once per battle', expires: 'after battle', legacy: true }));
    register([id], effects, true);
  }
  for (const [id, ship, squadron] of [['Light:799','Gold 1','gold'],['Light:2067','Red 1','red']]) {
    const test='Premiere squadron leaders raise only other matching pilots’ forfeit';
    register([id], [
      continuous('pilotPower', 'Das gesteuerte Schiff erhält +2 Power.', 'piloted ship', test, { amount: 2, legacy: true }),
      continuous('matchingPilot','Beim Steuern von '+ship+' gelten +1 Maneuver und eine Battle Destiny, falls sonst kein Draw möglich ist.',
        ship,test,{ amount:1,legacy:true }),
      continuous('squadronForfeit','Andere Piloten der eigenen Staffel an derselben Location erhalten +1 Forfeit.',
        squadron+' squadron pilot at same location',test,{ squadron,amount:1,since:12 }),
    ],true);
  }
  register(['Dark:60'],[
    continuous('imperialFleetDiscount','Mit mindestens zwei imperialen Raumschiffen auf dem Tisch kostet Motti 2 Force weniger.',
      'Imperial starships on table','Motti discounts his deploy and reduces Rebel pilot forfeit at the system',{ amount:2,legacy:true }),
    continuous('pilotPower','Das gesteuerte Schiff erhält +2 Power.','piloted ship',
      'Motti discounts his deploy and reduces Rebel pilot forfeit at the system',{ amount:2,legacy:true }),
    continuous('rebelPilotForfeit','Rebel-Piloten am selben System verlieren 1 Forfeit.','Rebel pilots at the same system',
      'Motti discounts his deploy and reduces Rebel pilot forfeit at the system',{ amount:-1,since:12 }),
  ],true);
  for(const [id,rank,faction] of [['Light:1389','Jedi Knight','Rebel'],['Dark:621','Dark Jedi','Imperial']]){
    register([id],[
      continuous('doubleBattlePower','Für 1 Force verdoppeln alle anderen beteiligten '+faction+
        '-Figuren am Ort ihre Kampf-Power, wenn ein eigener '+rank+' anwesend ist.',
        'present Jedi and other participating '+faction+' characters','Jedi Presence doubles only other matching participants',
        { rank,faction,cost:1,duration:'rest of battle',expires:'after battle',since:12 }),
    ],true);
  }
  register(['Light:1593'], [
    continuous('forceGeneration', 'Außerhalb von Tatooine erhöht Luke die eigene gesamte Force-Generierung um 1.',
      'Light Side total Force generation', 'Luke adds Force off Tatooine and his Red 5 maneuver bonus', { amount: 1, legacy: true }),
    continuous('pilotPower', 'Ein von Luke gesteuertes Schiff erhält +3 Power.',
      'piloted ship', 'Luke adds Force off Tatooine and his Red 5 maneuver bonus', { amount: 3, legacy: true }),
    continuous('matchingPilot', 'Beim Steuern von Red 5 erhält das Schiff +2 Maneuver.',
      'Red 5', 'Luke adds Force off Tatooine and his Red 5 maneuver bonus', { amount: 2, legacy: true }),
    continuous('attritionImmunity', 'Luke ist immun gegen Attrition unter 3.',
      'Luke Skywalker', 'Luke adds Force off Tatooine and his Red 5 maneuver bonus', { below: 3, legacy: true }),
  ], true);
  register(['Dark:1539'], [
    continuous('shipWeaponDiscount', 'Waffen kosten auf dem von Tanbris gesteuerten Schiff 1 Force weniger.',
      'Starship weapons that deploy on his ship', 'Tanbris discounts only weapons on the ship he pilots', { amount: 1, since: 7 }),
    continuous('pilotPower', 'Ein von Tanbris gesteuertes Schiff erhält +2 Power. Ein Starfighter erhält außerdem −1 Maneuver.',
      'piloted ship', 'Tanbris discounts only weapons on the ship he pilots', { amount: 2, legacy: true }),
  ], true);
  register(['Light:2625','Dark:2029'], [
    continuous('tableEffect', 'Für 1 Force auf der eigenen Tischseite ausspielen.', 'own side of table',
      'Traffic Control and Reactor Terminal recycle selected cards only during Control', { cost: 1, ownSide: true, since: 8 }),
    continuous('recycleHand', 'In der eigenen Control-Phase beliebig viele Handkarten in gewählter Reihenfolge auf den Used Pile legen.',
      'own hand and top of own Used Pile', 'Traffic Control and Reactor Terminal recycle selected cards only during Control',
      { duration: 'instant', expires: 'after resolving', since: 8 }),
  ], true);
  register(['Dark:1989'], [
    continuous('capitalAstromech', 'An Bord eines Capital Starships steigen Power und Hyperspeed um 1. Das Schiff ist immun gegen Attrition unter 3.',
      'capital starship aboard', 'R1-G4 modifies capital ships and cannot board fighters', { below: 3, amount: 1, legacy: true }),
    continuous('boardingRestriction', 'Darf nicht an Bord von Starfightern.', 'starfighters',
      'R1-G4 modifies capital ships and cannot board fighters', { legacy: true }),
  ], true);
  register(['Light:1407'], [
    continuous('pilotPower', 'Ein von Kal’Falnl gesteuertes Schiff erhält +2 Power.',
      'piloted ship', 'Kal’Falnl can pilot capital ships and move three sites', { amount: 2, since: 7 }),
    continuous('boardingRestriction', 'Darf nicht an Bord von Starfightern und geschlossenen Fahrzeugen.', 'starfighters and enclosed vehicles',
      'Kal’Falnl can pilot capital ships and move three sites', { legacy: true }),
    continuous('landspeed', 'Hat Landspeed 3.', 'this character', 'Kal’Falnl can pilot capital ships and move three sites', { amount: 3, legacy: true }),
    continuous('opposingDestinyZero', 'Haben beide Spieler genau eine Battle Destiny gezogen und ist deine höher, wird die gegnerische Battle Destiny auf 0 gesetzt.',
      'opponent in same battle', 'Kal’Falnl sets opposite single battle destiny to zero', { duration: 'rest of battle', legacy: true }),
  ], true);
  const starfighterTest = 'Premiere starfighter pilots and capacity follow their printed slots';
  const permanentPilot = continuous('permanentPilot', 'Der permanente Pilot stellt Ability 1 bereit.',
    'this starfighter', starfighterTest, { amount: 1, legacy: true });
  const capacityRule = (summary, capacity) => continuous('crewCapacity', summary, 'characters aboard',
    starfighterTest, { capacity, legacy: true });
  register(['Light:2838','Dark:2595'], [permanentPilot], true);
  register(['Dark:2600'], [
    permanentPilot,
    continuous('capitalDeployDiscount', 'Kostet 1 Force weniger bei einem Imperial Capital Starship am selben System.',
      'same system as an Imperial capital starship', 'TIE Fighter deploy discount needs an Imperial capital ship at the system',
      { amount: 1, legacy: true }),
  ], true);
  register(['Light:2907'], [permanentPilot, capacityRule('Kann einen zusätzlichen Piloten oder Passagier aufnehmen.', { shared: 1 })], true);
  register(['Light:2057'], [capacityRule('Kann einen Piloten aufnehmen.', { pilot: 1 })], true);
  register(['Light:2060'], [capacityRule('Kann einen Piloten und einen Astromech aufnehmen.', { pilot: 1, astromech: 1 })], true);
  register(['Light:1677'], [
    continuous('crewCapacity', 'Kann zwei Piloten und zwei Passagiere aufnehmen und auf dem System andocken.',
      'pilot and passenger capacity and docking', 'Falcon requires an active pilot and its namesake pilots grant immunity',
      { capacity: { pilot: 2, passenger: 2 }, legacy: true }),
    continuous('pilotedImmunity', 'Mit Han, Chewie oder Lando als Pilot ist der Falcon immun gegen Attrition unter 5.',
      'Han, Chewie or Lando piloting', 'Falcon requires an active pilot and its namesake pilots grant immunity',
      { below: 5, legacy: true }),
    continuous('requiresPilot', 'Ohne aktiven Piloten kann der Falcon seine Power, Maneuver und Hyperspeed nicht nutzen.',
      'active pilot aboard', 'Falcon requires an active pilot and its namesake pilots grant immunity', { legacy: true }),
  ], true);
  register(['Dark:2357'], [
    continuous('device', 'Wird kostenlos auf einem eigenen Trooper ausgespielt.', 'own trooper',
      'Stormtrooper Backpack expands weapon use and offers planet-site immunity', { legacy: true }),
    continuous('multipleWeapons', 'Der Trooper darf mehrere Waffen und Devices einsetzen.',
      'equipped trooper', 'Stormtrooper Backpack expands weapon use and offers planet-site immunity', { legacy: true }),
    continuous('planetImmunity', 'An einer Planetensite ist der Trooper immun gegen Attrition unter 3.',
      'equipped trooper at planet site', 'Stormtrooper Backpack expands weapon use and offers planet-site immunity',
      { below: 3, legacy: true }),
  ], true);
  register(['Light:1045'], [
    continuous('crewCapacity', 'Kann insgesamt bis zu zwei Piloten oder Passagiere aufnehmen.', 'up to two pilots and passengers combined',
      'Gold 1, Custom TIE and Ubrikkian follow their individual rules', { capacity: { shared: 2 }, legacy: true }),
  ], true);
  register(['Dark:2700'], [
    continuous('crewCapacity', 'Kann einen Piloten aufnehmen.', 'one pilot',
      'Gold 1, Custom TIE and Ubrikkian follow their individual rules', { capacity: { pilot: 1 }, legacy: true }),
    continuous('pilotedImmunity', 'Wird der TIE von Vader gesteuert, ist er immun gegen Attrition unter 4.', 'Vader as pilot',
      'Gold 1, Custom TIE and Ubrikkian follow their individual rules', { below: 4, legacy: true }),
  ], true);
  const carriersTest = 'Premiere transports enforce crew, cargo and docking capacity';
  for (const [id, ability, slots, summary] of [
    ['Light:530',1,{ pilot: 3, passenger: 4, cargo: 1 },'Drei Piloten, vier Passagiere und ein Fahrzeug.'],
    ['Dark:723',2,{ pilot: 6, passenger: 8, cargo: 2, hangar: 4 },'Sechs Piloten, acht Passagiere, zwei Fahrzeuge und vier TIEs.'],
    ['Dark:1291',1,{ pilot: 6, passenger: 8, cargo: 2, hangar: 4 },'Sechs Piloten, acht Passagiere, zwei Fahrzeuge und vier TIEs.'],
    ['Dark:2602',1,{ pilot: 1, passenger: 2, crew: 2 },'Kann einen Piloten und einen Passagier oder zwei Passagiere aufnehmen.'],
  ]) {
    const effects = [
      continuous('crewCapacity', summary, 'allowed crew and cargo', carriersTest, { capacity: slots, legacy: true }),
      continuous('permanentPilot', 'Der permanente Pilot stellt Ability ' + ability + ' bereit.',
        'this starship', carriersTest, { amount: ability, legacy: true }),
    ];
    if (slots.cargo) effects.push(continuous('shipDocking', 'Kann mit einem anderen Schiff am selben System zum Transfer andocken.',
      'friendly Starship at same system', carriersTest, { cost: 1, legacy: true }));
    register([id], effects, true);
  }
  register(['Dark:191'], [
    continuous('crewCapacity', 'Kann zwei Passagiere tragen. Eigene Ability ist ½.', 'two passengers', carriersTest,
      { capacity: { passenger: 2 }, legacy: true }),
    continuous('moveReact', 'Kann auf einen gerade initiierten Battle oder Force Drain im Bewegungsradius reagieren.',
      'exterior site of opposing battle or drain', 'a Bantha has half ability', { legacy: true }),
    continuous('tuskenAura', 'Jeder Tusken Raider am selben Außen-Site erhält +1 Power.',
      'Tusken Raider at the same exterior site', 'a Bantha has half ability', { amount: 1, legacy: true }),
  ], true);
  const transportTest = 'Premiere transport reacts honor the route, passengers and printed cost';
  const battleDrainReact = continuous('moveReact', 'Kann auf einen gerade initiierten Battle oder Force Drain mit einer Bewegung reagieren.',
    'location of opposing battle or drain', transportTest, { legacy: true });
  register(['Light:2250'], [
    {...battleDrainReact, summary: 'Kann als React zu einer benachbarten Site ziehen.', targets: 'adjacent site'},
  ], true);
  for(const [id,movement] of [['Light:2161','Nur zu Planetensites verlegbar.'],['Dark:2160','Darf nicht zu mobilen Sites ziehen.']]){
    register([id], [
      continuous('sandcrawlerDeploy', 'Nur an einer Tatooine-Site ausspielbar. '+movement,
        'Tatooine site', 'both Sandcrawlers enforce their destination and capacity', { since:14 }),
      continuous('crewCapacity', 'Kann einen Fahrer und sieben Passagiere aufnehmen.',
        'driver and passengers aboard', 'both Sandcrawlers enforce their destination and capacity', { capacity:{driver:1,passenger:7}, legacy:true }),
      continuous('jawaForfeit', 'Jeder Jawa an derselben Außen-Site erhält +1 Forfeit. Der Bonus stapelt sich nicht.',
        'Jawa at the same exterior site', 'both Sandcrawlers enforce their destination and capacity', { amount:1, since:14 }),
    ],true);
  }
  register(['Light:1548','Dark:1547'], [
    battleDrainReact,
    continuous('liftTubeMovement', 'Kann vier Passagiere tragen. Einsatz und Bewegung sind auf innere mobile Sites beschränkt. Es braucht keinen Fahrer.',
      'interior mobile sites and passengers', transportTest, { capacity: { passenger: 4 }, legacy: true }),
  ], true);
  register(['Dark:2660'], [
    battleDrainReact,
    continuous('crewCapacity', 'Kann einen Fahrer und zwei Passagiere aufnehmen.', 'driver and passengers aboard',
      'Gold 1, Custom TIE and Ubrikkian follow their individual rules', { capacity: { driver: 1, passenger: 2 }, legacy: true }),
  ], true);
  for(const [id, passengers, riders] of [
    ['Light:1609',2,'Luke'], ['Light:2307',3,'Luke, Beru oder Owen']
  ]) {
    register([id], [
      battleDrainReact,
      continuous('crewCapacity', 'Kann einen Fahrer und ' + passengers + ' Passagiere aufnehmen.',
        'driver and passengers aboard', transportTest, { capacity: { driver: 1, passenger: passengers }, legacy: true }),
      continuous('freeTransport', 'Fährt kostenlos, wenn ' + riders + ' an Bord ist.',
        riders, transportTest, { legacy: true }),
    ], true);
  }
  for(const [ids, cost, bonus] of [
    [['Light:259','Dark:1264'], 1, 0], [['Light:265','Dark:264'], 2, 1],
  ]) {
    const test = 'Premiere blasters enforce mount, cost and strict defense threshold';
    register(ids, [
      continuous('weaponDeploy', 'Für ' + cost + ' Force an einem eigenen Warrior ausspielen.',
        'own warrior', test, { cost, duration: 'while equipped', legacy: true }),
      continuous('weaponShot', 'Für ' + cost + ' Force eine Waffen-Destiny ziehen. Ein Treffer benötigt Destiny' +
        (bonus ? ' +1' : '') + ' über dem Verteidigungswert.',
        'character, creature or vehicle', test, { cost, amount: bonus, duration: 'damage segment', legacy: true }),
    ], true);
  }
  register(['Light:1503'], [
    continuous('weaponDeploy', 'Kostet 1 Force auf Leia oder 2 Force auf einem anderen eigenen Warrior.',
      'Leia or own warrior', 'named pistols use alternative deploy costs', { cost: 1, fallbackCost: 2, legacy: true }),
    continuous('weaponShot', 'Feuert kostenlos. Destiny −1 muss über dem Verteidigungswert liegen. Feuert Leia, ist der Forfeit eines getroffenen Ziels 0.',
      'character, creature or vehicle', 'Premiere blasters enforce mount, cost and strict defense threshold', { amount: -1, duration: 'damage segment', legacy: true }),
  ], true);
  register(['Light:1106'], [
    continuous('weaponDeploy', 'Kostet 1 Force auf Han oder 3 Force auf einem anderen eigenen Warrior.',
      'Han or own warrior', 'named pistols use alternative deploy costs', { cost: 1, fallbackCost: 3, legacy: true }),
    continuous('weaponShot', 'Kostet 1 Force zum Feuern. Destiny +1 muss über der Verteidigung liegen. Feuert Han, ist der Forfeit eines getroffenen Ziels 0.',
      'character, creature or vehicle', 'named pistols use alternative deploy costs', { cost: 1, amount: 1, duration: 'damage segment', legacy: true }),
  ], true);
  const saberTest = 'lightsabers enforce named and ability-based costs';
  const saberDrain = continuous('weaponDrain', 'Kann einen eigenen Force Drain am selben Ort um 1 erhöhen.',
    'own Force drain where present', 'using a lightsaber during a drain', { amount: 1, duration: 'one drain', legacy: true });
  register(['Light:1386','Dark:620'], [
    continuous('weaponDeploy', 'Auf einen eigenen Warrior ausspielen. Kosten sind 7 minus dessen Ability.',
      'own warrior', saberTest, { costFormula: '7 - ability', legacy: true }),
    continuous('weaponShot', 'Zum Angriff erneut 7 minus Ability bezahlen. Zwei Destiny ziehen und bei Summe über der Verteidigung treffen.',
      'character or creature', saberTest, { costFormula: '7 - ability', duration: 'damage segment', legacy: true }),
    saberDrain,
  ], true);
  for (const [id, bearer] of [['Light:1813','Obi-Wan'],['Dark:2702','Vader']]) {
    register([id], [
      continuous('weaponDeploy', 'Wird kostenlos auf ' + bearer + ' ausgespielt.', bearer, saberTest, { legacy: true }),
      continuous('weaponShot', 'Feuert kostenlos. Zwei Destiny ziehen. Liegt die Summe über der Verteidigung, ist das Ziel getroffen und sein Forfeit 0.',
        'character or creature', saberTest, { duration: 'damage segment', legacy: true }),
      saberDrain,
    ], true);
  }
  for (const [id, mounts, cost, result, test] of [
    ['Light:1962','X-wing, Y-wing oder B-wing',1,'Destiny über der Verteidigung trifft.','all ship armaments enforce their printed mounts'],
    ['Light:1971','Corellian Corvette oder Falcon',2,'Gegen Starfighter zählt Destiny +1. Ein Wert über der Verteidigung trifft.','all ship armaments enforce their printed mounts'],
    ['Dark:303','TIE Advanced x1',1,'Destiny −1 gegen Capital Starships und Destiny +1 gegen Starfighter. Ein Wert über der Verteidigung trifft.','all ship armaments enforce their printed mounts'],
    ['Dark:1327','Star Destroyer',2,'Ist Destiny +2 höher als die Verteidigung, gehen die Schiffswaffen des Ziels verloren. Verteidigung und Hyperspeed werden auf 0 gesetzt.','a successful Ion Cannon destroys ship weapons'],
  ]) {
    register([id], [
      continuous('weaponDeploy', 'Für ' + cost + ' Force auf ' + mounts + ' ausspielen.', mounts, test,
        { cost, duration: 'while equipped', legacy: true }),
      continuous('weaponShot', 'Für 1 Force auf ein Starship feuern. ' + result,
        'opposing starship', test, { cost: 1, duration: id === 'Dark:1327' ? 'while target remains in play' : 'damage segment', legacy: true }),
    ], true);
  }
  register(['Dark:146'], [
    continuous('weaponDeploy', 'Für 3 Force auf einem eigenen Warrior ausspielen.', 'own warrior', 'Assault Rifle fires from an adjacent location',
      { cost: 3, duration: 'while equipped', legacy: true }),
    continuous('weaponShot', 'Für 2 Force ein Ziel am selben oder benachbarten Site angreifen. Destiny +1 muss über der Verteidigung liegen.',
      'character, creature or vehicle at same or adjacent site', 'Assault Rifle fires from an adjacent location',
      { cost: 2, amount: 1, duration: 'damage segment', legacy: true }),
  ], true);
  register(['Dark:1002'], [
    continuous('weaponDeploy', 'Für 2 Force auf einem Tusken Raider ausspielen.', 'Tusken Raider', 'Gaderffii Stick blocks the chosen bearer',
      { cost: 2, duration: 'while equipped', legacy: true }),
    continuous('weaponShot', 'Direkt nach Kampfbeginn kostenlos zwei Destiny gegen eine Figur ziehen. Bei Summe über 5 sind deren Waffen für diesen Kampf blockiert.',
      'character in just initiated battle', 'Gaderffii Stick blocks the chosen bearer',
      { duration: 'rest of battle', expires: 'after battle', legacy: true }),
  ], true);
  register(['Dark:1551'], [
    continuous('weaponDeploy', 'Für 2 Force auf einem eigenen Warrior ausspielen.', 'own warrior', 'Light Repeating Blaster Rifle needs a present power droid',
      { cost: 2, duration: 'while equipped', legacy: true }),
    continuous('weaponShot', 'Mit eigenem Power Droid oder Fusion Generator vor Ort darf der Warrior wiederholt feuern. Jeder Schuss kostet 2 Force. Destiny +1 muss über der Verteidigung liegen.',
      'character, creature or vehicle', 'Light Repeating Blaster Rifle needs a present power droid',
      { cost: 2, amount: 1, duration: 'weapon segment', legacy: true }),
  ], true);
  register(['Dark:2644'], [
    continuous('weaponDeploy', 'Für 3 Force auf einem eigenen Star Destroyer oder einem mobilen System ausspielen.',
      'Star Destroyer or mobile system', 'all ship armaments enforce their printed mounts', { cost: 3, duration: 'while equipped', legacy: true }),
    continuous('weaponShot', 'Für 2 Force auf ein Starship feuern und zwei Destiny ziehen. Gegen Capital Starships zieht die Batterie 2 ab, gegen andere Schiffe 5. Ein Wert über der Verteidigung trifft.',
      'opposing Starship', 'all ship armaments enforce their printed mounts', { cost: 2, duration: 'damage segment', legacy: true }),
  ], true);
  register(['Light:2610','Dark:2609'], [
    continuous('mineDeploy', 'Ein eigener Mining Droid legt die Mine auf der Gegenseite derselben Site aus. An Außen-Sites kann er Karten verdeckt als Minenfeld vergraben.',
      'site with friendly mining droid', 'a buried mine and a dud are hidden', { duration: 'until detonation or removal', legacy: true }),
    continuous('mineExplosion', 'Die ausgelegte Mine explodiert am Anfang deines nächsten Zugs. Destiny gibt die Anzahl gegnerischer Figuren an derselben Site vor, die der Gegner verliert. Der Gegner wählt. Die Mine geht ebenfalls verloren.',
      'opposing characters present with mine', 'each Timer Mine waits for its owner', { duration: 'instant', expires: 'after resolving', legacy: true }),
  ], true);
  for(const [id,description,since] of [
    ['Light:2400','Tagge oder einen Warrior mit Ability unter 3'],
    ['Light:2426','Tarkin oder einen Alien mit Ability unter 3'],
    ['Dark:1096','Han oder einen Alien mit Ability unter 3'],
    ['Dark:1592','Luke mit Ability unter 4 oder einen Piloten mit Ability unter 3'],
    ['Light:1705','Motti oder einen Piloten mit Ability unter 3',28],
    ['Dark:1496','Leia oder einen Warrior mit Ability unter 3',28],
  ]){
    register([id],[
      continuous('seekerDeploy','Für 1 Force an einer unbesetzten Site auf der Gegenseite auslegen.',
        'unoccupied site','seekers use the opposing Move phase', {cost:1,since,legacy:true}),
      continuous('seekerMove','Bewegt sich in der gegnerischen Move Phase wie ein Undercover Spy. Der Docking-Bay-Text der eigenen Seite gilt.',
        'site movement in opponent move phase','seekers use the opposing Move phase',{since:since??17}),
      continuous('seekerStrike','Wählt '+description+' am selben physischen Ort. Ziel und Seeker gehen sofort verloren.',
        'eligible character on either side','seekers automatically resolve their chosen target',{since,legacy:true}),
    ],true);
  }
  register(['Dark:1479'],[
    continuous('projectorDeploy','Für 2 Force an einer Innen-Site auslegen.',
      'interior site','the Laser Projector deploys inside',{cost:2,legacy:true}),
    continuous('projectorFire','Zielt kostenlos auf Figuren, Kreaturen oder Seeker am selben physischen Ort. Destiny minus 1 muss über der Verteidigung liegen.',
      'character, creature or seeker','Laser Projector checks destiny and targets',{legacy:true}),
    continuous('projectorDefense','Der Laser Projector kann mit jeder dort verwendbaren Waffe angegriffen werden. Sein Verteidigungswert ist 1.',
      'projector','the Laser Projector deploys inside',{defense:1,legacy:true}),
  ],true);
  const blockKesselRun = continuous('blockKesselRun', 'Wer die Seite mit diesem Ortswortlaut kontrolliert, verhindert oder hebt Kessel Run auf.',
    'Kessel Run at Kessel', 'Kessel Run tracks', { printedSide: 'Dark', since: 2 });
  register(['Light:1427'], [drain('Light'), blockKesselRun], true);
  register(['Dark:1426'], [
    printed('Dark', 'shipDeploy', 'Eigene Schiffe kosten 1 Force weniger. Mit Tarkin an Bord eines Schiffs hier sind es 2 Force weniger.',
      { fighterDiscount: 1, capitalDiscount: 1, tarkinDiscount: 2 }),
    minimumSix('Light'),
    blockKesselRun,
  ], true);
  register(['Light:80'], [
    continuous('opponentBattleDestiny', 'Die Light-Seite von Alderaan zieht von jedem gegnerischen Battle-Destiny-Draw 1 ab.',
      'opponent at Alderaan', 'Alderaan reduces opposing destiny', { printedSide: 'Light', amount: -1, legacy: true }),
    drain('Dark'),
  ], true);

  register(['Light:2418'], [
    continuous('shipDeployWithoutPresence', 'Die Tantive IV darf an einem System ohne eigene Presence oder eigene Force-Icons deployen.',
      'system', 'A New Hope ships deploy and dock with their printed limits', { since:26 }),
    capacityRule('Bietet drei Piloten- und vier Passagierplätze, hat Ship Docking und einen permanenten Piloten mit Ability 2.',
      { pilot:3, passenger:4 }),
  ], true);
  register(['Light:2389'], [
    continuous('weapon', 'Für 1 Force auf einem eigenen Y- oder B-wing auslegen oder auf ein gegnerisches Schiff feuern. Übersteigt Destiny dessen Verteidigung, verliert es seine Schiffswaffen, Verteidigung und Hyperspeed fallen auf 0.',
      'opposing starship', 'A New Hope space weapons use their printed hosts and outcomes', { since:26 }),
  ], true);
  register(['Dark:872'], [
    continuous('weapon', 'Für 1 Force auf einem eigenen TIE auslegen oder auf ein gegnerisches Schiff feuern. Gegen Capitals zählt Destiny minus 2. Ein höherer Wert als die Verteidigung trifft.',
      'opposing starship', 'A New Hope space weapons use their printed hosts and outcomes', { since:26 }),
  ], true);
  for(const [id,faction] of [['Dark:1267','Imperial'],['Light:2035','Rebel']]){
    const tested='A New Hope commanders apply their printed modifiers at the same site';
    const rules=[continuous('commanderForfeit', 'Eigene '+faction+'-Charaktere am selben Site erhalten +1 Forfeit, außer der Commander selbst und andere Leader.',
      'other non-leader characters of the same faction', tested, { faction, since:26 })];
    if(faction==='Rebel')rules.push(continuous('bothanDeploy', 'Bothan-Spione darfst du am selben Ort kostenlos ausspielen.',
      'friendly Bothan spies', tested, { since:26 }));
    register([id],rules,true);
  }
  register(['Dark:1340'], [
    continuous('captiveDrain', 'Erhöht beim Detention Block Corridor den eigenen Force Drain um die Anzahl anwesender Gefangener.',
      'captives present at Detention Block Corridor', 'A New Hope detention and Force drains respect physical presence', { since:26 }),
    continuous('restrainingBoltImmunity', 'Immun gegen Restraining Bolt.', 'IT-O',
      'A New Hope detention and Force drains respect physical presence', { since:26 }),
  ], true);
  register(['Dark:1588'], [
    continuous('detentionPower', 'Power +2 im Detention Block Corridor und Control Room. Zusätzlich +2 bei anwesendem gegnerischen Alien, stattdessen +3 bei Wookiee, Talz oder Ewok.',
      'opposing aliens present at the same site', 'A New Hope detention and Force drains respect physical presence', { since:26 }),
  ], true);
  register(['Dark:1700'], [
    continuous('drainFromReserve', 'Bei einem Force Drain an seiner oder einer benachbarten Site verliert der Gegner nach Möglichkeit vom Reserve Deck.',
      'opposing player losing Force to a drain', 'A New Hope detention and Force drains respect physical presence', { since:26 }),
  ], true);
  register(['Dark:1697'], [
    continuous('pileInterrupt', 'Used: Hat der Gegner mindestens 13 Handkarten, behält er acht zufällig ausgewählte Karten. Die übrigen Karten kommen verdeckt in die Used Pile.',
      'opponent with at least 13 cards in hand', 'Monnok distinguishes Used and Lost modes and respects hidden hand contents',
      { mode:'trimHand', pile:'Used', cost:0, since:26 }),
    continuous('pileInterrupt', 'Lost: Für 4 Force deckt der Gegner seine Hand auf und verliert alle Kopien jedes mehrfach vorhandenen Kartentitels.',
      'opposing hand', 'Monnok distinguishes Used and Lost modes and respects hidden hand contents',
      { mode:'revealDuplicates', pile:'Lost', cost:4, since:26 }),
  ], true);
  register(['Dark:2094'], [
    continuous('pilotPower', 'Das pilotierte Schiff erhält +1 Power.', 'piloted ship',
      'A New Hope ships deploy and dock with their printed limits', { amount:1, since:26 }),
    continuous('matchingPilot', 'Auf Black 2, Black 3 und Black 4 gibt der Reserve Pilot +1 Maneuver und einen Battle-Destiny-Draw, falls sonst kein Draw möglich ist.',
      'Black 2, Black 3 or Black 4', 'A New Hope ships deploy and dock with their printed limits', { amount:1, since:26 }),
  ], true);

  register(['Light:318'], [
    continuous('weapon', 'Bowcaster wird am eigenen Warrior ausgelegt und kostet beim Auslegen und Feuern 7 minus seine Power, mindestens 1 Force. Ein Destiny-Draw mit +1 gegen Charaktere oder +2 gegen Creatures muss die Verteidigung übertreffen.',
      'opposing character or creature', 'A New Hope ground weapons distinguish bearers and creature targets', { since:27 }),
  ], true);
  for(const [id,preferred] of [['Light:1606','Luke oder Owen Lars'],['Dark:2687','URoRRuR’R’R oder Chief Bast']]){
    register([id],[continuous('weapon', 'Kostet 1 Force auf '+preferred+', 3 auf einem anderen eigenen Nicht-Droiden. Ein Schuss kostet 1 Force. Destiny erhält gegen Charaktere −1 beziehungsweise gegen Creatures +2 und muss die Verteidigung übertreffen.',
      'opposing character or creature', 'A New Hope ground weapons distinguish bearers and creature targets', { since:27 })],true);
  }
  register(['Light:2059'], [
    capacityRule('Red 2 bietet Platz für einen Piloten und einen Astromech.', {pilot:1,astromech:1}),
    continuous('pilotAttritionImmunity', 'Mit Wedge als Pilot ist Red 2 immun gegen Attrition unter 3.', 'Red 2',
      'A New Hope starships enforce matching pilots and noncumulative orbital support', { pilot:'wedge', below:3, since:27 }),
  ], true);
  register(['Dark:2715'], [
    capacityRule('Bietet Platz für vier Piloten, sechs Passagiere, ein Fahrzeug und drei TIEs. Hat Ship Docking und einen permanenten Piloten mit Ability 1.',
      {pilot:4,passenger:6,cargo:1,hangar:3}),
    continuous('orbitalSupportPower', 'Erhöht die Gesamt-Power in Battles an den Sites des umkreisten Planeten um 1.', 'related planet site',
      'A New Hope starships enforce matching pilots and noncumulative orbital support', { amount:1, since:27 }),
  ], true);
  register(['Light:2003','Dark:2002'], [
    continuous('ionRepair', 'Das Schiff erhält +1 Power und +1 Maneuver. An Bord eines eigenen, ionengeschädigten Schiffs repariert der Droide in deiner Kontrollphase Verteidigung und Hyperspeed.',
      'starship carrying this astromech', 'A New Hope pilots and droids add bonuses in the correct seat and phase', { since:27 }),
  ], true);
  register(['Dark:362'], [
    continuous('unitReserveSearch', 'Einmal pro eigener Kontrollphase für 2 Force einen Scanning Crew im Reserve Deck suchen, aufdecken, auf die Hand nehmen und mischen.',
      'Scanning Crew in own Reserve Deck', 'A New Hope officers search without discarding themselves',
      { cost:2, names:['scanning crew'], display:'Scanning Crew', controlOnly:true, since:27 }),
  ], true);
  register(['Dark:611'], [
    continuous('pilotPower', 'Gibt einem von Danz Borin pilotierten Schiff +3 Power.', 'piloted starship',
      'A New Hope pilots and droids add bonuses in the correct seat and phase', { amount:3, since:27 }),
    continuous('passengerWeaponDestiny', 'Als Passagier erhöht Danz Borin jeden Waffen-Destiny-Draw seines Trägers um 1.', 'weapon fired by his carrier',
      'A New Hope pilots and droids add bonuses in the correct seat and phase', { amount:1, since:27 }),
  ], true);
  register(['Dark:2683'], [
    continuous('tuskenFallbackDestiny', 'Deploy nur auf Tatooine. Erlaubt in einem Battle mit einem weiteren Tusken Raider an derselben Site einen Battle-Destiny-Draw, wenn keiner sonst möglich ist.',
      'battle at the same site as another Tusken Raider', 'A New Hope Tusken leader deploys on Tatooine and grants a fallback destiny', { since:27 }),
  ], true);
  register(['Light:2786'], [
    continuous('pilotPower', 'Das pilotierte Schiff erhält +3 Power.', 'piloted starship',
      'A New Hope pilots and droids add bonuses in the correct seat and phase', { amount:3, since:27 }),
    continuous('matchingPilot', 'Auf Red 2 gibt Wedge +2 Maneuver und eine Battle Destiny, wenn sonst keine möglich ist.',
      'Red 2', 'A New Hope starships enforce matching pilots and noncumulative orbital support', { amount:2, since:27 }),
    continuous('unitReserveSearch', 'Für 1 Force eine Corellian Slip im Reserve Deck suchen, aufdecken, auf die Hand nehmen und mischen.',
      'Corellian Slip in own Reserve Deck', 'A New Hope officers search without discarding themselves',
      { cost:1, names:['corellian slip'], display:'Corellian Slip', since:27 }),
  ], true);
  register(['Light:534'], [
    continuous('tallonSlip', 'Nach einer gegnerischen Tallon Roll Maneuver und die Ability eines eigenen Piloten des betroffenen Jägers addieren.',
      'pilot of starfighter targeted by Tallon Roll', 'Corellian Slip modifies Tallon Roll or reduces one opposing fighter', { since:27 }),
    continuous('pileInterrupt', 'Alternativ verliert ein gegnerischer Starfighter bis Ende des Zugs 1 Maneuver.',
      'opposing starfighter', 'Corellian Slip modifies Tallon Roll or reduces one opposing fighter',
      { mode:'shipManeuverPenalty', pile:'Used', cost:0, since:27 }),
  ], true);
  for(const [id,target,description] of [['Light:1572','tie','TIEs'],['Dark:153','nav','Raumschiffe mit gedrucktem Nav-Computer-Icon']]){
    register([id],[
      continuous('tableEffect','Für 3 Force auf der gegnerischen Tischseite ausspielen.', 'opposing side of table',
        'A New Hope ship taxes and Willard respect icons, controller and war room', { cost:3, since:27 }),
      continuous('shipDeployTax','Gegnerische '+description+' kosten beim Ausspielen 1 Force mehr.', description,
        'A New Hope ship taxes and Willard respect icons, controller and war room', { target, amount:1, since:27 }),
    ],true);
  }
  register(['Light:504'], [
    continuous('warRoomShipPower', 'Vom eigenen kontrollierten War Room aus erhalten die eigenen Rebel-Raumschiffe am zugehörigen System +1 Power.',
      'friendly Rebel starships at related system', 'A New Hope ship taxes and Willard respect icons, controller and war room', { since:27 }),
    continuous('unitTableCancel', 'Darf Astromech Shortage für 1 Force aufheben.',
      'Astromech Shortage', 'A New Hope ship taxes and Willard respect icons, controller and war room', { target:'Dark:153',cost:1,since:27 }),
  ], true);
  register(['Light:527'], [
    printed('Light','corelliaDeployReact','Falcon und Corellian Corvettes dürfen hier als Deploy-React ausgespielt werden.',
      {since:27}, 'A New Hope system and officer reacts respect ship factions and range'),
    printed('Dark','shipDepartureRange','Eigene Schiffe erhalten beim Abflug von Corellia +1 Hyperspeed.',
      {targets:'starship',amount:1,since:27}, 'A New Hope system and officer reacts respect ship factions and range'),
  ],true);
  register(['Light:2017'], [
    printed('Light','shipReact','Eigene Schiffe dürfen als React nach Ralltiir ziehen.',{since:27},
      'A New Hope system and officer reacts respect ship factions and range'),
    printed('Dark','shipDeploy','Eigene Capital Starships kosten hier 2 Force weniger.',{capitalDiscount:2,since:27},
      'A New Hope system and officer reacts respect ship factions and range'),
  ],true);
  register(['Dark:2016'], [
    printed('Dark','power','Die Devastator erhält hier +1 Power.',{targets:'devastator',amount:1,since:27}),
    printed('Dark','shipTravelFree','Die Devastator reist kostenlos von und zu Ralltiir.',{targets:'devastator',amount:1,since:27}),
    printed('Light','power','Die Tantive IV erhält hier +1 Power.',{targets:'tantive',amount:1,since:27}),
  ],true);
  for(const [id,faction,regions] of [
    ['Light:493','rebel (starship)',['yavin 4','hoth','endor']],['Dark:1824','imperial (starship)',['death star']],
  ]){
    const effects=[continuous('officerShipReact','An einer passenden Site ermöglicht der Offizier eigenen Schiffen seiner Fraktion einen React zum System.',
      faction, 'A New Hope system and officer reacts respect ship factions and range', {faction,regions,since:27})];
    if(id==='Dark:1824')effects.push(continuous('pilotPower','Ein von Evax pilotiertes Schiff erhält +2 Power.', 'piloted ship',
      'A New Hope system and officer reacts respect ship factions and range', {amount:2,since:27}));
    register([id],effects,true);
  }
  register(['Light:255','Dark:2368'], [
    continuous('interiorExclusion', 'Nach Beginn eines Battles an einer Innen-Site für 1 Force auf beiden Seiten alle Anführer und Charaktere mit Ability über 2 für dieses Battle ausschließen.',
      'eligible participants in an interior battle', 'Interior battle interrupts exclude both sides without removing cards', { cost:1,since:27 }),
  ],true);
  for(const [id,condition] of [['Light:1183','sunsdown'],['Dark:1035','nightfall']]){
    register([id],[
      continuous('damageRelief', 'Wenn du das Battle verloren hast und im Damage-Segment keine Karte mehr forfeiten kannst, hebe den übrigen Battle Damage auf. Diese Spielweise ist immun gegen Sense.',
        'own remaining battle damage', 'Houjix and Ghhhk relieve damage only after the last available forfeit', { since:27 }),
      continuous('namedCancellation','Alternativ '+condition+' aufheben.',condition,
        'Houjix and Ghhhk relieve damage only after the last available forfeit', { names:[condition],since:27 }),
    ],true);
  }
  register(['Light:1081'], [
    continuous('sharedNamedInterruptLimit','Einmal pro Zug über alle Varianten.', 'the same interrupt title',
      'Grimtaash shares its once-per-turn limit across all three modes', { since:27 }),
    continuous('pileInterrupt','Used: Bei mindestens 13 gegnerischen Handkarten bleiben acht zufällig gewählte Karten auf der Hand. Die übrigen gehen verdeckt auf die Used Pile.',
      'opponent with at least 13 cards in hand', 'Grimtaash shares its once-per-turn limit across all three modes', {mode:'trimHand',pile:'Used',since:27}),
    continuous('pileInterrupt','Lost: Für 4 Force die gegnerische Hand aufdecken lassen. Alle Kopien mehrfach vorhandener Titel gehen verloren.',
      'opposing hand', 'Grimtaash shares its once-per-turn limit across all three modes', {mode:'revealDuplicates',pile:'Lost',cost:4,since:27}),
    continuous('namedCancellation','Lost: Molator aufheben, auch an einem Holosite.', 'Molator',
      'Grimtaash shares its once-per-turn limit across all three modes', {names:['molator'],since:27}),
  ],true);
  register(['Light:751'], [
    continuous('musicianBattleAbility','Jeder andere Musiker an derselben Site erhöht die für Battle Destiny erforderliche Ability für beide Seiten um 1.',
      'other musicians at the same site', 'A New Hope musician modifiers distinguish at from present with', {since:27}),
  ],true);
  register(['Light:1242'], [
    continuous('musicianDrainTax','Der Gegner bezahlt beim Force Drain an einer benachbarten Site 1 Force je weiterem mit Ickabel anwesenden Musiker.',
      'other musicians physically present with Ickabel', 'A New Hope musician modifiers distinguish at from present with', {since:27}),
  ],true);
  register(['Light:1013'], [
    continuous('garoufForfeit','An derselben Site auf Tatooine erhalten eigene Figuren +1 Forfeit. Auf Hoth erhalten gegnerische Figuren an derselben Site −1 Forfeit. Ein Tax Collector an derselben Site setzt den Text aus.',
      'characters at Garouf’s site', 'A New Hope site modifiers check affiliation, leader and tax collector', {since:27}),
    continuous('pilotPower','Ein von Garouf pilotiertes Schiff erhält +1 Power, sofern sein Text aktiv ist.', 'piloted ship',
      'A New Hope site modifiers check affiliation, leader and tax collector', {amount:1,since:27}),
  ],true);
  register(['Dark:2117'], [
    continuous('rodianAura','Eigene Kopfgeldjäger und Schmuggler an derselben Site erhalten +1 Power. Greedo erhält stattdessen −1 Power.',
      'friendly bounty hunters and smugglers at same site', 'A New Hope site modifiers check affiliation, leader and tax collector', {since:27}),
    continuous('pilotPower','Ein vom Rodian pilotiertes Schiff erhält +1 Power.', 'piloted ship',
      'A New Hope site modifiers check affiliation, leader and tax collector', {amount:1,since:27}),
  ],true);
  register(['Light:2857'], [
    printed('Light','massassiShipPower','Wer die Massassi Ruins mit einem eigenen Leader kontrolliert, gibt seinen Schiffen am Death Star System +1 Power.',
      {since:27}, 'A New Hope site modifiers check affiliation, leader and tax collector'),
    drain('Dark'),
  ],true);
  register(['Light:2056'], [
    continuous('device','Für 1 Force an ein eigenes Raumschiff anlegen.', 'friendly starship',
      'Space deploy reacts follow ship, attachment and Black 4 requirements', {targets:'starship',cost:1,since:27}),
    continuous('battleSpaceDeployReact','Erlaubt bei einem Battle am selben System oder Sektor einen Deploy-React.', 'battle at host system or sector',
      'Space deploy reacts follow ship, attachment and Black 4 requirements', {since:27}),
  ],true);
  register(['Dark:2604'], [
    permanentPilot,
    continuous('spaceDeployReact','Erlaubt Deploy-React am selben System oder Sektor.', 'same system or sector',
      'Space deploy reacts follow ship, attachment and Black 4 requirements', {since:27}),
  ],true);
  register(['Dark:250'], [
    capacityRule('Kann einen Piloten aufnehmen.', {pilot:1}),
    continuous('blackFourReact','Darf mit einem Piloten als React zu einem Battle mit eigenem TIE deployen. Liegt dort Black 2 oder Black 3, ist dieser Deploy kostenlos.',
      'battle with a friendly TIE', 'Space deploy reacts follow ship, attachment and Black 4 requirements', {since:27}),
  ],true);
  register(['Dark:792'], [
    continuous('pilotPower','Ein von DS-61-4 pilotiertes Schiff erhält +3 Power.', 'piloted starship',
      'Space deploy reacts follow ship, attachment and Black 4 requirements', {amount:3,since:27}),
    continuous('matchingPilot','Auf Black 4 gibt DS-61-4 bei fehlenden anderen Möglichkeiten eine Battle Destiny.', 'Black 4',
      'Space deploy reacts follow ship, attachment and Black 4 requirements', {since:27}),
    continuous('unitReserveSearch','Darf für 1 Force Lone Pilot aus dem Reserve Deck suchen, aufdecken, auf die Hand nehmen und mischen.', 'Lone Pilot in Reserve Deck',
      'A New Hope officers search without discarding themselves', {cost:1,names:['lone pilot'],display:'Lone Pilot',since:27}),
  ],true);
  register(['Light:2063'], [
    capacityRule('Kann einen Piloten aufnehmen.', {pilot:1}),
    continuous('problemTargetBonus','Wer I’ve Got A Problem Here auf Red 6 spielt, darf zum Destiny-Draw +2 addieren.', 'Red 6 targeted by that interrupt',
      'Red 6 gives a choice for the extra destiny on A Problem Here', {since:27}),
  ],true);

  register(['Light:2673','Dark:2672'], [
    continuous('tableEffect','Auf eigenen Spion an einer Site ausspielen. In der eigenen Deploy Phase an einer Site kann der Spion die Tarnung aufgeben. Gegen Alter immun.',
      'friendly spy at a site','Undercover spies cross the table and move during the opposing turn',{characterTarget:'undercover',ownSide:true,since:28}),
    continuous('undercoverEffect','Lässt den Spion die gegnerische Seite infiltrieren. Bei Enttarnung geht der Effect verloren.',
      'attached spy','Undercover spies cross the table and move during the opposing turn',{since:28}),
  ],true);
  register(['Dark:2659'], [
    continuous('deployUndercover','Wird ausschließlich an einer Site als Undercover-Spion eingesetzt.','site',
      'U-3PO deploys under cover and Light can take him',{since:28}),
    continuous('spyBattlePower','Untercover steuert U-3PO seine Power zu Light im Battle an seiner Site bei.','Light at the battle',
      'U-3PO deploys under cover and Light can take him',{since:28}),
    continuous('stealOnBrokenCover','Wird er enttarnt, darf Light ihn übernehmen.','Light Side',
      'U-3PO deploys under cover and Light can take him',{since:28}),
  ],true);
  register(['Dark:1587'], [
    continuous('detectSpy','Einmal pro eigener Control Phase darf er einen Undercover-Spion an derselben Site bei Destiny gleich Ability enttarnen.',
      'undercover spy at the same site','Treidum exposes a spy only on matching ability',{since:28}),
    continuous('dockingControlPower','Aus dem Docking Control Room 327 erhält die eigene Seite +2 Gesamt-Power an Docking Bay 327.',
      'Docking Bay 327','Treidum exposes a spy only on matching ability',{amount:2,since:28}),
  ],true);
  register(['Light:762'], [
    continuous('pileInterrupt','Bei beiden Spionen an derselben Site geht der gegnerische Spion bei Destiny über 2 verloren. Gegen Undercover zählt +2.',
      'opposing spy at the same site','Double Agent targets spies or converts the Tonnika Sisters',{mode:'nevar',physical:true,pile:'Lost',since:28}),
    continuous('pileInterrupt','Alternativ wechseln die gegnerischen Tonnika Sisters an einer Site mitsamt Ausrüstung zu Light.',
      'opposing Tonnika Sisters at a site','Double Agent targets spies or converts the Tonnika Sisters',{mode:'tonnikaConvert',pile:'Lost',since:28}),
  ],true);

  register(['Light:282'], [
    continuous('pileInterrupt','Die gewählte Seite aktiviert 1 Force.','either player',
      'Blue Milk chooses a player or cancels Juri Juice and Hypo',{mode:'blueMilk',pile:'Used',since:28}),
    continuous('namedCancellation','Hebt Juri Juice oder Hypo auf und geht auf die Lost Pile.','Juri Juice or Hypo',
      'Blue Milk chooses a player or cancels Juri Juice and Hypo',{names:['juri juice','hypo'],since:28}),
  ],true);
  register(['Light:1872'], [
    continuous('pileInterrupt','Für 2 Force in der eigenen Control Phase ein eingefangenes Schiff freigeben. Mit Central Core im Spiel ist der Death Star Tractor Beam ausgenommen.',
      'captured starship','Out Of Commission releases a ship or removes a random card',{mode:'outOfCommissionRelease',cost:2,pile:'Used',since:28}),
    continuous('pileInterrupt','Eine zufällige Karte der gegnerischen Lost Pile oder von einem gegnerischen Blaster Rack aus dem Spiel nehmen.', 'opposing Lost Pile or Blaster Rack',
      'Out Of Commission releases a ship or removes a random card',{mode:'outOfCommissionRemove',pile:'Used',since:28}),
  ],true);
  register(['Dark:2577'], [
    continuous('namedCancellation','Hebt I’m Here To Rescue You, Plastoid Armor, Out Of Commission, Alternatives To Fighting, Cell 2187 oder Ewok Rescue auf.',
      'listed Interrupts and Effects','This Is Some Rescue cancels the listed cards',{names:["i'm here to rescue you",'plastoid armor','out of commission','alternatives to fighting','cell 2187','ewok rescue'],since:28}),
  ],true);
  register(['Light:1413'], [
    printed('Light','kashyyykDeploy','Eigene Wookiees und Schmuggler werden hier für 2 Force weniger eingesetzt.',{amount:2,since:28},'Kashyyyk applies its modifiers to the printed side'),
    printed('Dark','minimumBattleAbility','Dark benötigt hier mindestens Ability 6 für reguläre Battle Destiny.',{amount:6,since:28},'Kashyyyk applies its modifiers to the printed side'),
  ],true);
  register(['Dark:1412'], [
    drain('Dark'),
    printed('Dark','kashyyykForfeit','Bei Kontrolle verlieren alle Wookiees auf dem Tisch 3 Forfeit.',{amount:3,since:28},'Kashyyyk applies its modifiers to the printed side'),
    printed('Light','kashyyykCrew','Eigene Schiffe mit einem Wookiee an Bord erhalten +2 Power und Forfeit.',{amount:2,since:28},'Kashyyyk applies its modifiers to the printed side'),
  ],true);

  register(['Light:127'], [
    continuous('nightPower','Unter Nachtbedingungen +1 Power.','site under nighttime conditions','Arcona retreats as a react and gains power at night',{amount:1,since:28}),
    continuous('reactAway','Kann bei Beginn eines gegnerischen Battles an derselben Site als React wegziehen.','battle at the same site',
      'Arcona retreats as a react and gains power at night',{since:28}),
  ],true);
  register(['Light:1605'], [
    continuous('tableEffect','Für 2 Force an einen eigenen Rebel oder Alien anlegen.','friendly Rebel or Alien',
      'Luke’s Cape grants Force and attrition immunity',{characterTarget:'cape',cost:2,since:28}),
    continuous('capeGeneration','Außerhalb Tatooines erzeugt der Umhang 1 zusätzliche Force.','carrying character outside Tatooine',
      'Luke’s Cape grants Force and attrition immunity',{amount:1,since:28}),
    continuous('grantedAttritionImmunity','Der Träger ist immun gegen Attrition unter 3.','carrying character',
      'Luke’s Cape grants Force and attrition immunity',{below:3,since:28}),
  ],true);
  register(['Light:2658'], [
    continuous('deployPhaseLandspeed','Kann Landspeed nur in der eigenen Deploy Phase nutzen. Bewegt sich dabei für 1 Force bis zu zwei Sites weit. Andere Bewegungsarten bleiben verfügbar.',
      'landspeed between sites','Tzizvvt flies during Deploy and retains other movement',{range:2,since:28}),
    continuous('tzizvvtPower','Hat +1 Power im Trash Compactor, an einer Dagobah-Site oder an derselben Site wie Dark Waters oder Tarkin.',
      'listed sites or cards','Tzizvvt flies during Deploy and retains other movement',{amount:1,since:28}),
  ],true);

  register(['Light:2173'], [
    continuous('saurinUnbolt','Für 1 Force einen Restraining Bolt an derselben Site verlieren lassen.','restraining bolt at the same site',
      'Saurin removes bolts and receives extra power from Sai’torr',{cost:1,since:28}),
    continuous('saurinProtection','Erhält durch angelegtes Sai’torr Kal Fas zusätzlich +1 Power.','host of Sai’torr Kal Fas',
      'Saurin removes bolts and receives extra power from Sai’torr',{amount:1,since:28}),
  ],true);
  register(['Dark:519'], [
    permanentPilot,
    capacityRule('Kann 6 Piloten, 8 Passagiere, 2 Fahrzeuge und 4 TIEs aufnehmen und an andere Schiffe andocken.',
      {pilot:6,passenger:8,cargo:2,hangar:4}),
    continuous('conquestPeek','Darf direkt nach Eröffnung eines Battles gegen den Millennium Falcon die gegnerische Hand ansehen.',
      'opposing hand','Conquest peeks privately after initiating against Falcon',{since:28}),
  ],true);
  register(['Dark:626'], [
    continuous('locationEffect','Auf einer Außen-Site außer Hoth oder einer Innen-Site eines Fahrzeugs ausspielen. Gegnerische Force Drains sind hier −1. Ein anwesendes Sumpfwesen schützt vor Alter.',
      'exterior planet site or interior vehicle site','Dark Waters dampens drains and swamp creatures protect it from Alter',{darkWaters:true,since:28}),
  ],true);
  register(['Dark:1994'], [
    continuous('astromechShipStats','An Bord eines Starfighters +1 Power, Maneuver und Hyperspeed.','starfighter',
      'ANH astromech stats and R2-Q2’s private Reserve view',{fighter:true,power:1,maneuver:1,hyperspeed:1,since:28}),
    continuous('cardInformation','Für 1 Force während der eigenen Draw Phase an einem Scomp Link die obersten drei Karten des eigenen Reserve Deck ansehen.',
      'own Reserve Deck','ANH astromech stats and R2-Q2’s private Reserve view',{mode:'q2Peek',cost:1,since:28}),
  ],true);
  register(['Dark:1999'], [
    continuous('astromechShipStats','An Bord des eigenen Capitals +1 Power und +2 Hyperspeed.','friendly capital starship',
      'ANH astromech stats and R2-Q2’s private Reserve view',{capital:true,power:1,hyperspeed:2,below:4,since:28}),
    continuous('deathStarHyperspeed','An Central Core erhält der Todesstern Hyperspeed 2.','Death Star system',
      'R3-T6 doubles the Death Star movement range from Central Core',{amount:2,since:28}),
  ],true);

  register(['Light:1668','Dark:2392'], [
    continuous('tableEffect','Auf eine eigene Figur ohne Thief-Skill oder auf eine Waffe ausspielen. Gegen Alter immun.','own non-thief or any weapon',
      'Merc Sunlet and Swilla Corey can grant theft or protect a weapon',{thiefTraining:true,since:28}),
    continuous('thiefTraining','Der Träger wird Thief und darf einmal pro eigener Control Phase ein Device an derselben Site bei Destiny unter dessen Destiny-Zahl stehlen.',
      'character carrying the effect','Merc Sunlet and Swilla Corey can grant theft or protect a weapon',{since:28}),
    continuous('protectWeaponFromTheft','Eine mit diesem Effect belegte Waffe kann nicht gestohlen werden.','weapon carrying the effect',
      'Merc Sunlet and Swilla Corey can grant theft or protect a weapon',{since:28}),
  ],true);
  register(['Light:2151'], [
    continuous('pileInterrupt','In der eigenen Control Phase bei einem eigenen Undercover-Spion Ausrüstung oder Fahrzeuge bei Destiny über Deploy verlieren lassen. Ein Thief kann ein zulässiges Ziel stattdessen stehlen.',
      'weapon, device or vehicle at an undercover spy’s site','Sabotage removes or steals equipment and Informant can cancel it',
      {mode:'spySabotage',pile:'Used',since:28}),
    continuous('namedCancellation','Hebt Informant auf.','Informant','Sabotage removes or steals equipment and Informant can cancel it',
      {names:['informant'],since:28}),
  ],true);
  register(['Dark:1308'], [
    continuous('informantReact','Beginnt der Gegner ein Battle bei einem eigenen Undercover-Spion, dürfen eigene Figuren kostenlos von angrenzenden Sites dorthin reagieren.',
      'friendly characters at adjacent sites','Informant offers a free react for selected adjacent characters',{mode:'informantReact',pile:'Used',since:28}),
    continuous('namedCancellation','Hebt Sabotage auf.','Sabotage','Sabotage removes or steals equipment and Informant can cancel it',
      {names:['sabotage'],since:28}),
  ],true);
  register(['Light:1229'], [
    continuous('pileInterrupt','Ein Spion im Detention Block Corridor versucht, einen Gefangenen dort zu befreien. Schlägt der Vergleich fehl, wird der Spion gefangen genommen.',
      'spy and captive at the Detention Block Corridor','I’m Here To Rescue You resolves the ability contest and unblocks captives',
      {mode:'spyRescue',pile:'Used',since:28}),
    continuous('namedCancellation','Hebt Spice Mines Of Kessel auf und lässt dessen Gefangenen frei.','Spice Mines Of Kessel',
      'I’m Here To Rescue You resolves the ability contest and unblocks captives',{names:['spice mines of kessel'],since:28}),
  ],true);

  register(['Light:1136'], [
    continuous('jawaPayment','Wird nur an Tatooine-Sites für je 2 Force von beiden Spielern ausgespielt.','Tatooine site',
      'Het Nkik pays both sides and counts stormtroopers unless Reegesk is present',{cost:2,since:28}),
    continuous('hetStormtrooperPower','Erhält +1 Power pro Stormtrooper am selben Site, außer wenn Reegesk anwesend ist.','stormtroopers or Reegesk at Het’s site',
      'Het Nkik pays both sides and counts stormtroopers unless Reegesk is present',{since:28}),
  ],true);
  register(['Light:1189'], [
    continuous('hunchback','Bei einem gegnerischen Force Drain an einer Nachbar-Site für 1 Force die gegnerische Force Pile nach einem Titel mit „back“ durchsuchen. Eine passende Karte aus dem Spiel nehmen und die Pile mischen.',
      'opposing Force Pile','Hunchback searches a neighboring drainer’s Force Pile privately',{cost:1,since:28}),
  ],true);
  register(['Light:1377'], [
    continuous('weapon','Kostet bei einem Jawa 1 Force, bei einem Warrior 3. Für 1 Force auf einen Character schießen. Ein Droid wechselt bei Destiny +1 über Forfeit die Seite. Ein anderer Character wird bei Destiny gleich Verteidigung vom Battle ausgeschlossen.',
      'opposing character','Jawa Ion Gun steals droids or excludes ordinary characters',{since:28}),
  ],true);
  register(['Dark:1376'], [
    continuous('weapon','Kostenlos auf einen eigenen Jawa ausspielen und gegen Characters oder Creatures feuern. Bei Destiny minus 1 über Verteidigung getroffen. Bei Destiny 0 gehen Waffe und Schütze verloren.',
      'opposing character or creature','Jawa Blaster explodes on zero destiny',{since:28}),
  ],true);
  register(['Dark:2075'], [
    continuous('reegeskSalvage','Einmal pro eigener Control Phase 1 Force verlieren, um ein zulässiges Fahrzeug, einen Droiden, eine Charakterwaffe oder ein Device aus der gegnerischen Lost Pile oder vom Crash Site Memorial als eigene Karte auf die Hand zu nehmen.',
      'opposing Lost Pile or Crash Site Memorial','Reegesk pays a Force loss before taking eligible salvage',{since:28}),
  ],true);

  register(['Light:529'],[
    continuous('corellianEquipment','Einmal pro Zug kostet eine Waffe oder ein Device auf einem Rebel an derselben Site 1 Force weniger.',
      'equipment deployment on a Rebel at the same site','Corellian reduces one Rebel equipment deployment each turn',{amount:1,since:28}),
  ],true);
  for(const [id,mode,limit,label,targets] of [
    ['Light:2174','radar',14,'Radar Scanner','Jawas, Tusken Raiders und Stormtrooper'],
    ['Dark:1198','scanning',13,'Scanning Crew','Karten mit „Rebel“ im Titel'],
  ]){
    register([id],[
      continuous('tableEffect','Wird auf der eigenen Tischseite ausgespielt.','own side','Scanner support applies immunity and correct hand thresholds',
        {ownSide:true,since:28}),
      continuous('scannerSupport',label+' ist gegen Sense immun. Ab '+limit+' Handkarten verliert der Gegner '+targets+' in seiner Hand.',
        'opposing hand','Scanner support applies immunity and correct hand thresholds',{mode,limit,since:28}),
    ],true);
  }
  register(['Light:2222'],[
    continuous('device','Für 1 Force auf ein eigenes Nicht-Kreatur-Fahrzeug ausspielen.','friendly non-creature vehicle',
      'Sensor Panel improves its vehicle and adds an optional Radar Scanner target',{targets:'non-creature-vehicle',cost:1,since:28}),
    continuous('sensorPanel','Das Fahrzeug erhält +1 Power und +1 Landspeed. Einmal pro Zug für 1 Force einen weiteren Effect oder Interrupt aus einer durch Radar Scanner aufgedeckten Gegnerhand auf Used legen.',
      'host vehicle and Radar Scanner’s revealed hand','Sensor Panel improves its vehicle and adds an optional Radar Scanner target',{since:28}),
  ],true);
  register(['Dark:1275'],[
    continuous('locationEffect','Beim Deploy festlegen: Entweder bei einem gegnerischen Vorsprung von mindestens 4 Force die Force-Generierung am Ort aufheben oder den Ort gegen Revolution immun machen.',
      'target location','Imperial Justice chooses a single function and leaves drain icons intact',{imperialJustice:true,since:28}),
  ],true);

  register(['Light:819','Dark:487'], [
    continuous('tableEffect','Für 1 Force einen Starfighter mit permanentem Piloten wählen. Bei Destiny über 2 ausspielen, sonst verlieren. Gegen Alter immun.',
      'starfighter with permanent pilots','Both pilot ejection Effects replace permanent pilots with capacity',{ejectPilot:true,cost:1,since:28}),
    continuous('removePermanentPilots','Permanente Piloten fallen aus. Je entfernter Pilot entsteht ein zusätzlicher Pilotenplatz.',
      'host starfighter','Both pilot ejection Effects replace permanent pilots with capacity',{since:28}),
  ],true);
  for(const [id,trigger,name] of [['Light:1752','Light:2514','Bith Shuffle'],['Dark:2490','Dark:1831','Ommni Box']]){
    register([id],[
      continuous('shufflePeek','Nach '+name+' entweder nochmals blind mischen oder pro weiterem am selben Site anwesenden Musiker eine Karte oben ansehen.',
        'deck or pile just shuffled','Both shuffle musicians can privately peek or reshuffle',{trigger,since:28}),
    ],true);
  }
  register(['Light:2916'], [
    continuous('beforeBattleDestiny','Für 1 Force direkt vor dem ersten gegnerischen Battle-Destiny-Draw am selben Ort dessen Gesamt-Battle-Destiny um 1 senken.',
      'opponent about to draw battle destiny','Zutton reduces the total once before a battle destiny draw',{cost:1,amount:1,since:28}),
  ],true);

  register(['Light:1674'],[
    continuous('binaryForfeit','Gewährt Nicht-Droiden an derselben und benachbarten Sites +2 Forfeit. Beide Spieler können für 1 Force ein- oder ausschalten.',
      'non-droids at same and adjacent sites','ANH Binary droid can be switched by either player',{since:29}),
  ],true);
  for(const [id,summary] of [
    ['Dark:1126','Einmal in eigener Deploy Phase eine Hand- oder Force-Karte verdeckt unterlegen. Power ist 1 plus Kartenzahl. Bei Verlust gehen die Karten verloren.'],
    ['Dark:687','Bei Nacht für 1 Force vom Battle ausschließen. An einer revolvierten Site verliert der Gegner in der eigenen Control Phase 1 Force.'],
    ['Dark:605','Einmal pro Battle für 1 Force die Soup einer gegnerischen gerade verlorenen Nicht-Droiden-Figur aufnehmen. Power ist 1 plus Ability aller bisherigen Opfer.'],
    ['Dark:1073','In der gegnerischen Control Phase einen Schmuggler bedrohen. Der Gegner kann seine Force Pile einsetzen und gleich viel Aktivierung erlauben, sonst entscheidet Destiny plus Greedos Ability über 6.'],
  ])register([id],[continuous('anhCharacter',summary,'character and eligible targets','ANH character actions preserve costs, hidden cards and timing',{since:29})],true);

  for(const [id,amount] of [['Light:1298',1],['Dark:227',3]])register([id],[
    continuous('shuttleVehicle','Permanenter Pilot mit Ability 1. Darf reagieren oder als reguläre Bewegung kostenlos Characters zwischen der Site und einem Schiff am zugehörigen System shutteln.',
      'characters between site and related orbit','ANH shuttle vehicles preserve range, seats and regular movement',{amount,since:29}),
  ],true);
  register(['Dark:1685'],[continuous('floaterReact','Kostenlose Bewegung mit Jabba oder Kopfgeldjäger an Bord. Kostenloser Battle-React zu eigenem Thief, Smuggler oder Bounty Hunter.',
    'friendly underworld in battle','ANH Floater reacts for free to eligible allies',{since:29})],true);
  register(['Light:2298'],[
    continuous('tableEffect','Auf einen Warrior oder Scout legen. Gibt Scout-Skill und React oder einem vorhandenen Scout +2 Power nach einem React.',
      'warrior or scout','ANH Solomahal distinguishes training from react bonus',{scoutTraining:true,since:29}),
    continuous('scoutReact','Der Träger kann reagieren. Vorhandene Scouts erhalten dann +2 Power bis Zugende.',
      'attached character','ANH Solomahal distinguishes training from react bonus',{since:29}),
  ],true);
  register(['Light:2006'],[continuous('ra7Transfer','Kann bis zu vier Charakterwaffen tragen und in der eigenen Deploy Phase kostenlos mit anderen eigenen Characters present transferieren.',
    'character weapons','ANH RA7 transfers weapons for free and respects capacity',{since:29})],true);

  for(const [id,cost,tax] of [['Light:1062',1,false],['Dark:2505',1,false],['Light:2802',3,true],['Dark:2555',3,true]])
    register([id],[continuous('grabInterrupt','Als Antwort auf gegnerischen Interrupt ausspielen. Hält ihn nach Auflösung fest und beschränkt weitere gleichnamige Interrupts.',
      'opponent just played interrupt','ANH grabbers enforce shared uniqueness and escalating costs',{cost,tax,since:29})],true);
  register(['Light:64'],[
    continuous('pileInterrupt','Eine eigene Handkarte aus Attack Run, You’re All Clear Kid, Trench oder Rebel Tech aus dem Spiel nehmen und 1 Force zurückholen.',
      'own hand','ANH Advance Preparation pays the selected cost before retrieval',{mode:'advancePrepare',pile:'Used',since:29}),
    continuous('pileInterrupt','Für 3 Force Attack Run aus Lost auf Used zurückholen.','own Lost Pile',
      'ANH Advance Preparation pays the selected cost before retrieval',{mode:'advanceRecover',cost:3,pile:'Lost',since:29}),
  ],true);

  register(['Light:2048','Dark:1284'],[continuous('squadLeader','Andere eigene Troopers (Light auch Rebel Guards) present erhalten +1 Forfeit. Erlaubt Guards Bewegung und einem Squad aus genau vier Figuren gemeinsame Landspeed für 1 Force.',
    'other friendly troopers at same site','ANH squad leaders share movement cost and free guards',{since:29})],true);
  register(['Dark:67'],[continuous('advosze','Pilotiert mit +2 Power. Waffen oder Devices aus der Hand am selben Ort aktivieren 1 Force. Nur ein Advosze pro Location.',
    'same location','ANH Advosze receives equipment kickbacks and rejects voluntary collisions',{since:29})],true);
  register(['Dark:1558'],[continuous('coverCharge','Jeder weitere Musiker present erhöht Character-Deploy und kostenpflichtige Character-Bewegung hierher um 1 Force.',
    'characters arriving at same site','ANH Lirin cover charge counts present musicians and preserves free movement',{since:29})],true);
  register(['Dark:2784'],[continuous('septoid','Forfeit beginnt bei 7 und sinkt um absorbierten Schaden. Bleibt nach Forfeit im Spiel, außer getroffen oder auf null reduziert.',
    'self','ANH Septoid absorbs damage without leaving until exhausted or hit',{since:29})],true);

  register(['Light:1214','Dark:1770'],[continuous('anhResponse','Nach dem vierten Character-Deploy am selben Ort dessen Gruppe am Battle hindern oder nach gegnerischem Battle-React das Battle aufheben.',
    'deployment or completed react','ANH Bad Feeling and Ngok answer completed actions',{badFeeling:true,since:29})],true);
  register(['Light:1987'],[continuous('anhResponse','Elis-Transport für 2 Force vernichten oder einem gerade ausgespielten Schmuggler Bewegung verbieten.',
    'completed transport or deployment','ANH transport retaliation and smuggler stop respect response timing',{transport:'Dark:824',smugglerStop:true,since:29})],true);
  register(['Dark:1844'],[continuous('anhResponse','Nach Nabrun-Transport für 2 Force Nabrun verlieren und transportierte Rebels fangen oder einem gerade ausgespielten Schmuggler Bewegung verbieten.',
    'completed transport or deployment','ANH transport retaliation and smuggler stop respect response timing',{transport:'Light:1749',smugglerStop:true,since:29}),
    continuous('namedCancellation','Kessel Run aufheben.','Kessel Run','ANH transport retaliation and smuggler stop respect response timing',{names:['kessel run'],since:29})],true);
  register(['Light:100'],[continuous('anhResponse','Für 3 Force einen gerade begonnenen Raumbattle aufheben.',
    'battle at system or sector','ANH Alternatives cancels space battles and frees captured crews',{spaceBattle:true,since:29}),
    continuous('pileInterrupt','Besieged aufheben.','Besieged','ANH Alternatives cancels space battles and frees captured crews',{mode:'cancelBesieged',pile:'Used',cost:0,since:29}),
    continuous('pileInterrupt','Eigene Characters aus einem gefangenen Schiff kostenlos zu einer Docking Bay befreien.','captured starship','ANH Alternatives cancels space battles and frees captured crews',{mode:'escapeCapturedShip',pile:'Used',cost:0,since:29})],true);

  register(['Light:319'],[continuous('brainiac','Berechnet Power aus Händen und Force-Icons ohne Rundung. Deploy entspricht Light-Handgröße, Forfeit Dark-Handgröße, Destiny ist π.',
    'all hands and locations','ANH Brainiac keeps irrational destiny and dynamic values',{since:29})],true);
  register(['Light:1992'],[continuous('astromechShipStats','Gibt einem Starfighter +2 Power, Maneuver und Hyperspeed (+3 auf Red 5).',
    'occupied starfighter','ANH R2D2 chooses destiny and offers Scomp reactions',{fighter:true,amount:2,redFive:true,since:29}),
    continuous('r2Destiny','Wählt beim eigenen Destiny-Draw 2 oder 5. Bei gegnerischem Draw am Scomp Link optional aktivieren oder ziehen.',
    'destiny draws','ANH R2D2 chooses destiny and offers Scomp reactions',{since:29})],true);
  register(['Light:416'],[printed('Light','clakdor','Bei Occupation sind alle Bith Characters Destiny +2.',{since:29},'ANH Clakdor and Kiffex modify only qualifying states'),
    printed('Dark','clakdor','Bei Control Bith Destiny −1 und Ghhhk Power +2 am Holosite.',{since:29},'ANH Clakdor and Kiffex modify only qualifying states')],true);
  register(['Dark:1434'],[printed('Light','kiffex','Bei Occupation mit genau zwei Schiffen hier +2 Gesamtpower.',{since:29},'ANH Clakdor and Kiffex modify only qualifying states'),
    printed('Dark','kiffex','Bei Occupation mit genau zwei Schiffen hier +2 Gesamtpower und überall doppelte Tonnika Sisters.',{since:29},'ANH Clakdor and Kiffex modify only qualifying states')],true);
  register(['Dark:1453'],[continuous('tableEffect','Für 1 Force auf die eigene Tischseite ausspielen.','own side','ANH Krayt bones resolves every numbered destiny consequence',{ownSide:true,cost:1,since:29}),
    continuous('kraytBones','Gegnerische Destiny löst die nummerierte automatische Folge aus.','opposing destiny','ANH Krayt bones resolves every numbered destiny consequence',{since:29})],true);

  register(['Light:394'],[continuous('chewbacca','Power +1 am selben Ort wie Han, Pilot +2 und Falcon Maneuver +1. Eigene getroffene Fahrzeuge, Schiffe und Droiden am selben Site gehen bei Verlust auf Used.',
   'same location and same site','ANH Chewbacca repairs hits and receives Han and Falcon bonuses',{since:29})],true);
  register(['Dark:2635'],[continuous('felth','Auf Tatooine werden Local Trouble und Look Sir Droids Used. Bei Friendly Fire am selben Site darf Felths Gegner das Opfer wählen.',
   'Tatooine and same site','ANH Felth changes interrupt destination and accident chooser',{since:29})],true);
  register(['Dark:891'],[continuous('pileInterrupt','Alle Revolutions aufheben; für jede verliert der Besitzer 1 Force.','Revolutions','ANH Evader cancels revolutions and rescues eligible recent losses',{mode:'evaderRevolutions',pile:'Used',since:29}),
   continuous('anhResponse','Gerade verlorenen Vader, Custom TIE oder Imperial von Death Star auf Used verlegen.','just lost card','ANH Evader cancels revolutions and rescues eligible recent losses',{evader:true,since:29})],true);
  register(['Light:2824'],[continuous('defendingDestiny','Wenn Chewie allein an einem Site verteidigt, zwei Battle Destiny hinzufügen.','defending Chewbacca','ANH Wookiee Roar supports defense, search and mouse droids',{character:'chewbacca',siteOnly:true,draws:2,since:29}),
   continuous('pileInterrupt','Für 3 Force Chewbacca im Reserve Deck suchen.','Reserve Deck','ANH Wookiee Roar supports defense, search and mouse droids',{mode:'roarSearch',pile:'Lost',cost:3,since:29}),
   continuous('pileInterrupt','Einen Mouse Droid auf dem Tisch verlieren lassen.','mouse droid','ANH Wookiee Roar supports defense, search and mouse droids',{mode:'roarMouse',pile:'Lost',since:29})],true);
  register(['Light:1507'],[continuous('anhResponse','Nach verlorenem Battle mit eigenem Wookiee einen Gegner present mit Ability unter 5 entwaffnen.','opposing character present','ANH Let The Wookiee Win disarms after an eligible lost battle',{wookieDisarm:true,since:29}),
   continuous('holositeDestiny','Ein Battle Destiny am Holosite hinzufügen.','holosite battle','ANH Let The Wookiee Win disarms after an eligible lost battle',{since:29})],true);

  register(['Light:1619','Dark:1618'],[continuous('device','Auf einen eigenen Sandcrawler ausspielen.','sandcrawler','ANH suction devices compare ability and let the owner choose destination',{since:29}),
   continuous('suction','Einmal eigene Control Phase einen Character present mit Destiny über Ability auf Used oder den zugehörigen Sandcrawler-Innenraum verlegen.','character present','ANH suction devices compare ability and let the owner choose destination',{since:29})],true);
  register(['Light:2082'],[continuous('locationEffect','Für 1 Force an einer Site ausspielen. Bewegt sich wie ein Character.','any site','ANH Remote grants one temporary bonus or cancels a seeker',{siteDevice:'remote',mobileRemote:true,cost:1,since:29}),
   continuous('remote','Einmal eigene Control Power oder Forfeit eines Characters present +1 bis Zugende, oder für 2 Force einen Seeker present aufheben.','present character or seeker','ANH Remote grants one temporary bonus or cancels a seeker',{since:29})],true);
  register(['Dark:1955'],[continuous('tableEffect','Auf einen Droiden außer R2-D2 und C-3PO legen. Eigener Droide kostet 1, gegnerischer 2 Force.','droid','ANH Program Trap counts the whole site but explodes only among present characters',{characterTarget:'program-trap',cost:1,since:29}),
   continuous('programTrap','Destiny gleich Character-Zahl am selben Site lässt alle Characters present verlieren.','all destiny draws','ANH Program Trap counts the whole site but explodes only among present characters',{since:29})],true);
  register(['Light:943'],[continuous('device','Auf eigenen Astromech legen.','astromech','ANH extinguisher prevents explosions and protects its ship',{since:29}),
   continuous('fireExtinguisher','Löscht explodierende Program Trap. Schiff an Bord immun gegen Lateral Damage und Ionenkanonen. Auf R2-D2 am Site verlieren, um gerade begonnenen Battle aufzuheben.','same place or occupied starship','ANH extinguisher prevents explosions and protects its ship',{since:29})],true);

  for(const [id,owner] of [['Light:2165','Light'],['Dark:2164','Dark']])register([id],[
   continuous('vehicleSite','Auf einen konkreten eigenen Sandcrawler ausspielen. Innenraum bleibt an dieses Fahrzeug gebunden.','friendly Sandcrawler','ANH crawler sites follow their host and lose their contents with it',{since:29}),
   printed(owner,'vehicleSiteTransit','Eigene Characters wechseln kostenlos zum Fahrzeug beziehungsweise dessen Site.',{cost:0,since:29},'ANH crawler sites follow their host and lose their contents with it'),
   printed(owner==='Light'?'Dark':'Light','vehicleSiteTransit','Characters dürfen für je 1 Force ein- und austreten.',{cost:1,since:29},'ANH crawler sites follow their host and lose their contents with it'),
   printed(owner,'forfeit','Jeder Jawa hier Forfeit +2.',{targets:'jawa',amount:2,since:29},'ANH crawler sites follow their host and lose their contents with it'),
   ...['Light','Dark'].map(side=>printed(side,'alwaysNight','Hier gelten Nachtbedingungen.',{since:29},'ANH crawler sites follow their host and lose their contents with it')),
  ],true);
  register(['Light:2125'],[continuous('rogueTrample','Bantha mit Ability ½, zwei Reitern und React. Zu Battle-Beginn einen Tusken Raider present nach Wahl verlieren lassen.','Tusken Raider present','ANH Rogue Bantha tramples before optional battle responses',{since:29})],true);
  register(['Light:2908','Dark:2596'],[continuous('squadron','Drei passende Starfighters am selben Ort ersetzen. Übertragbare Besatzung und Ausrüstung wählen, übrige Karten gehen auf Used. Permanente Piloten: Ability 3.','three matching starfighters','ANH squadrons transfer optional crew and send replaced cards to Used',{since:29})],true);

  register(['Light:694','Dark:1274'],['Light','Dark'].map(side=>printed(side,'holosite','Dejarik-Regeln: nur Dejariks/Hologramme, Destiny als Spielwerte, normaler Text ausgesetzt, bei Kontrolle auf die Hand nehmen.',{since:29},'ANH holosites use destiny values and suspend ordinary text')),true);
  register(['Dark:2438'],['Light','Dark'].map(side=>printed(side,'bluffs','Dark legt einmal im eigenen Zug einen verdeckten Bluff. Jeder gibt kumulativ +1 Drain. Light kann in Dark Deploy aufdecken.',{since:29},'ANH Bluffs conceal cards and distinguish legal free deployment from loss')),true);
  register(['Dark:1478'],[continuous('laserGate','Zwischen Interior-Mobile-Sites: blockiert Fahrzeuge außer Lift Tube und Characters mit Power plus Ability höchstens 4. Waffenabwehr 3.','adjacent interior mobile sites','ANH Laser Gate blocks passage and is a weapon target from either side',{since:29})],true);
  register(['Dark:1200'],[continuous('device','Auf eigenes IT-O legen.','it0','ANH Hypo asks a truthful question or grants a drain bonus',{since:29}),
   continuous('hypo','Einmal eigene Control mit Captive present: Ja/Nein-Frage zur gegnerischen Hand oder Force Drain +1. Antwort darf durch 1 Force Verlust ersetzt werden.','captive present','ANH Hypo asks a truthful question or grants a drain bonus',{since:29})],true);

  register(['Dark:2620'],[continuous('device','Für 2 Force auf einen eigenen Star Destroyer legen.','star-destroyer','ANH Tractor Beam holds crewed ships and releases them when its holder loses the device',{cost:2,since:29}),
   continuous('tractorDevice','Am Battle-Ende für 2 Force ein gegnerisches Schiff außer Mon-Calamari-Star-Cruiser mit Destiny über Abwehr fangen.','opposing starship present','ANH Tractor Beam holds crewed ships and releases them when its holder loses the device',{since:29})],true);
  register(['Dark:223'],[continuous('tableEffect','Auf ein gefangenes Schiff legen.','captured starship','ANH Besieged isolates trapped crew and selected attacking characters',{capturedHost:true,since:29}),
   continuous('besieged','Ausgewählte eigene Characters present kämpfen gegen eingeschlossene Characters wie an einem Site.','captured starship crew','ANH Besieged isolates trapped crew and selected attacking characters',{since:29})],true);
  register(['Dark:2754'],[continuous('anhResponse','Für 1 Force eine gerade aus Battle verloren gehende Figur stattdessen fangen, nach Anwendung des Forfeit-Wertes.','about to lose opposing character','ANH We Have A Prisoner replaces a paid battle forfeit with capture',{prisoner:true,since:29}),
   continuous('pileInterrupt','Alle Characters auf einem gefangenen Schiff für je 2 Force fangen.','captured ship crew','ANH We Have A Prisoner replaces a paid battle forfeit with capture',{mode:'captureShipCrew',pile:'Lost',since:29})],true);
  register(['Light:385'],[continuous('locationEffect','Auf eine Death-Star-Site außer Docking Bay legen und eigenen Spy/Leader außerhalb Death Star wählen. Bei Ankunft Destiny ziehen und so viele Gefangene befreien.','own spy or leader','ANH Cell 2187 releases chosen captives after its target arrives',{mission:'cell2187',since:29})],true);
  register(['Dark:2330'],[continuous('locationEffect','Auf Kessel: Gefangenen und Trooper-Eskorte wählen. Bei Ankunft Forfeit zurückholen und Gefangenen verlieren; Verlust der Eskorte befreit den Gefangenen.','escorted captive','ANH Spice Mines completes only with its designated captive and escort',{mission:'spiceMines',trigger:'special',since:29}),
   continuous('spiceMines','Verfolgt den vorgesehenen Gefangenen samt Eskorte nach Kessel.','captive and escort','ANH Spice Mines completes only with its designated captive and escort',{since:29})],true);

  register(['Light:169'],[continuous('attackRunEpic','Trench-Anflug mit 1–3 Starfighters, TIE-Verfolgung, Deckungsfeuer, zwei Destiny und Pull Up. Gesamt über 15 zerstört Death Star.','Death Star Trench','ANH Attack Run selects a lead and wingmen before cover fire',{since:29})],true);
  register(['Dark:508'],[continuous('ignitionEpic','In eigener Control Phase einen umkreisten Planeten mit Superlaser beschießen. Ziel-Sites bezahlen, Gegner wählt Z, Destiny plus Y minus Z über 8 zerstört das System.','orbited planet','ANH Primary Ignition pays site cost and lets the opponent choose Z',{since:29})],true);
  register(['Light:509'],[continuous('tableEffect','Auf Superlaser legen.','superlaser','ANH recharging conceals eight Force cards and returns them on cancellation',{recharge:true,since:29}),
   continuous('recharge','Zum Feuern auf Planeten sind acht verdeckt gestapelte Force-Karten nötig. Dark darf oben aus Force stapeln. Nach Systemschuss aufgehoben; Stapel auf Used.','host superlaser','ANH recharging conceals eight Force cards and returns them on cancellation',{since:29})],true);
  register(['Dark:2378'],[continuous('weapon','Nur auf Death Star bei Parsec 0. Für 4 Force zwei Destiny gegen Capital an Death Star oder umkreistem System.','capital starship','ANH Superlaser deploys only at parsec zero and targets capitals',{since:29})],true);
  register(['Light:681'],[printed('Light','trenchManeuver','Trench-Regeln; Starfighter Maneuver −2.',{since:29},'ANH Trench restricts deployment and changes maneuver and weapon cost'),
   printed('Dark','trenchWeapons','Trench-Regeln; Waffen hier feuern kostenlos und Turbolaser kann hier deployen.',{since:29},'ANH Trench restricts deployment and changes maneuver and weapon cost')],true);

  register(['Light:1047'],[continuous('goldRescue','Zwei Pilot-/Passagierplätze. Gold 2 darf statt eines anderen getroffenen Starfighters in Trench forfeitet werden.','hit friendly starfighter in Trench','ANH Gold 2 sacrifices itself to save another hit starfighter',{since:29})],true);
  register(['Light:2061'],[capacityRule('Ein Pilot und ein Astromech.',{pilot:1,astromech:1}),
   continuous('pilotAttritionImmunity','Mit Luke als Pilot immun gegen Attrition unter 4.','Luke piloting','ANH Red 5 and Tiree apply matching pilot and Attack Run bonuses',{pilot:'luke skywalker',below:4,since:29}),
   continuous('redFiveAttack','Beim Feuern im Attack Run Gesamt +1.','lead starfighter','ANH Red 5 and Tiree apply matching pilot and Attack Run bonuses',{since:29})],true);
  register(['Light:2611'],[continuous('tireeAttack','Pilot +2 Power, auf Gold 2 Maneuver +1 und in Trench Attack Run +1.','Gold 2 piloted','ANH Red 5 and Tiree apply matching pilot and Attack Run bonuses',{since:29})],true);
  register(['Light:2050'],[continuous('techAttack','An eigener War Room kumulativ Attack Run +1.','own war room','ANH Tech and Gunner bonuses accumulate and their searches pay with the source',{since:29}),
   continuous('unitReserveSearch','In eigener Control Tech von eigener War Room auf Used legen, Trench im Reserve suchen und mischen.','Reserve Deck','ANH Tech and Gunner bonuses accumulate and their searches pay with the source',{names:['death star: trench'],display:'Death Star: Trench',controlOnly:true,warRoom:true,costUsed:true,since:29})],true);
  register(['Dark:657'],[continuous('gunnerIgnition','Auf Death Star kumulativ Commence Primary Ignition +2.','Death Star','ANH Tech and Gunner bonuses accumulate and their searches pay with the source',{since:29}),
   continuous('unitReserveSearch','In eigener Control Gunner von Death Star auf Used legen, Superlaser im Reserve suchen und mischen.','Reserve Deck','ANH Tech and Gunner bonuses accumulate and their searches pay with the source',{names:['superlaser'],display:'Superlaser',controlOnly:true,deathStar:true,costUsed:true,since:29})],true);

  register(['Light:2851'],[printed('Light','epicRoom','Bei Kontrolle und Leader hier Attack Run +1.',{epic:'attackRun',leader:true,amount:1,optional:true,since:29},'ANH epic rooms require control and leaders for the printed positive bonus'),
   printed('Dark','epicRoom','Bei Kontrolle Attack Run −1.',{epic:'attackRun',amount:-1,since:29},'ANH epic rooms require control and leaders for the printed positive bonus'),drain('Dark')],true);
  register(['Dark:670'],[printed('Dark','epicRoom','Bei Kontrolle und Leader hier Commence Primary Ignition +1.',{epic:'ignition',leader:true,amount:1,optional:true,since:29},'ANH epic rooms require control and leaders for the printed positive bonus'),
   printed('Light','epicRoom','Bei Kontrolle Commence Primary Ignition −1.',{epic:'ignition',amount:-1,optional:true,since:29},'ANH epic rooms require control and leaders for the printed positive bonus'),drain('Light')],true);
  register(['Dark:1640'],[continuous('locationEffect','Auf Trench legen.','Death Star Trench','ANH Maneuver Check resolves each departing opposing starfighter',{siteDevice:'maneuver-check',exactSite:'death star: trench',since:29}),
   continuous('maneuverCheck','Jeder gegnerische Starfighter beim Verlassen: eigene Destiny plus Maneuver unter 5 verliert ihn.','departing opposing starfighters','ANH Maneuver Check resolves each departing opposing starfighter',{since:29})],true);
  register(['Light:2563'],[continuous('locationEffect','Einmal im Spiel für 2 Force auf Dantooine legen. Death Star muss zuerst Dantooine erreichen, bevor CPI spielbar ist.','Death Star','ANH Dantooine diversion blocks ignition until the mobile system arrives',{mission:'dantooine',trigger:'special',cost:2,since:29}),
   continuous('dantooineBlock','Blockiert Commence Primary Ignition bis Death Star Dantooine erreicht.','Death Star','ANH Dantooine diversion blocks ignition until the mobile system arrives',{since:29})],true);
  register(['Light:2892'],[continuous('cancelNamedInterrupt','I’m On The Leader aufheben, immun gegen Sense.','I’m On The Leader','ANH All Clear cancels the leader and ejects only one actual TIE',{targets:['Dark:1230'],since:29}),
   continuous('pileInterrupt','Für 1 Force während Attack Run einen TIE zurück zu Death Star schicken. Mit Matching Pilot im Lead Attack Run +1.','TIE in Trench','ANH All Clear cancels the leader and ejects only one actual TIE',{mode:'allClearRun',cost:1,pile:'Used',since:29})],true);

  register(['Dark:1230'],[continuous('pileInterrupt','Während Attack Run gegnerischen Starfighter mit Destiny plus TIE-Zahl über Maneuver verlieren lassen.','Attack Run starfighter','ANH Leader targets attack-run fighters and improves ordinary weapon destiny',{mode:'leaderKill',pile:'Lost',since:29}),
   continuous('pileInterrupt','Einen Starfighter bis Zugende Waffen-Destiny +1 geben.','any starfighter','ANH Leader targets attack-run fighters and improves ordinary weapon destiny',{mode:'leaderWeapon',pile:'Lost',since:29})],true);
  register(['Light:2308','Dark:2290'],[continuous('pileInterrupt','In eigener Control Phase eine eigene Waffe abfeuern; Treffer sofort verlieren. Han darf +1, URoRRuR’R’R +2 zu jedem Draw addieren. Seeker-Abwehr 4.','legal weapon target','ANH control firing resolves costs, optional shooter bonus and immediate hits',{mode:'controlFire',pile:'Lost',since:29})],true);
  register(['Dark:729'],[continuous('dianoga','Habitat: Dagobah außen, Trash Compactor und Dark Waters. Ferocity ist letzte Mahlzeit plus Destiny, Abwehr Slither 5. Pflichtangriffe, freiwillige Angriffe und Creature-Kämpfe sind getrennt von Battles.','creature habitat and eligible prey','ANH Dianoga attacks select a side then random prey and remember the last meal',{since:29})],true);

  // The four original Sense/Alter registrations retain their earlier version for saved games.
  const legacyCounters = new Set(['Light:95','Light:2217','Dark:94','Dark:2216']);
  for (const [id, definition] of cards) {
    if (legacyCounters.has(id) || definition.effects.some(rule => rule.since === 21)) definition.complete = true;
  }

  function entry(card) {
    const definition = cards.get(card.id);
    return { cardId: card.id, source: card.images?.slip ?? card.images?.print ?? null, text: card.texts?.active ?? card.gametext ?? null,
      effects: definition?.effects ?? [], complete: definition?.complete ?? false };
  }

  function effects(card, event) {
    return (cards.get(card?.id)?.effects ?? []).filter(effect => effect.event === event);
  }

  function registerExpansion(definitions) {
    const seen=new Set();
    for(const definition of definitions) {
      if(!/^\w+:\d+$/.test(definition.id)||cards.has(definition.id)||seen.has(definition.id)||!Array.isArray(definition.effects)||
        definition.effects.some(effect=>typeof effect.event!=='string'||typeof effect.summary!=='string'||![31,32,33,34].includes(effect.since)))
        throw new Error('Ungültige oder bereits registrierte Erweiterungsregel: '+definition.id);
      seen.add(definition.id);
    }
    for(const {id,effects,complete=false} of definitions)cards.set(id,{effects,complete});
  }
  return Object.freeze({ entry, effects, registerExpansion });
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PremiereCardRules;
