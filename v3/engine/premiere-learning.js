const PremiereLearning = (() => {
  const hands = {
    force: ['Light:1593', 'Light:2052', 'Light:221', 'Light:2838', 'Light:608', 'Light:259', 'Light:2040', 'Light:917'],
    battle: ['Light:2052', 'Light:221', 'Light:2838', 'Light:608', 'Light:265', 'Light:2040', 'Light:2250', 'Light:305'],
    movement: ['Light:2052', 'Light:221', 'Light:2907', 'Light:80', 'Light:259', 'Light:2040', 'Light:2250', 'Light:917'],
    'dark-control': ['Light:259', 'Light:259', 'Light:265', 'Light:2052', 'Light:2040', 'Light:2838', 'Light:2907', 'Light:221'],
  };
  const darkControlHand = ['Dark:634', 'Dark:1061', 'Dark:2355', 'Dark:1279', 'Dark:191', 'Dark:2600', 'Dark:1264', 'Dark:2848'];
  const lessons = {
    force: {
      title: 'Force und Deploy', seed: 1091, darkStart: 'Dark:2458', phase: 0, steps: [
        ['Aktiviere 3 Force. Die 2 Light-Icons und deine persönliche Force ergeben zusammen 3.', action => action.kind === 'activate' && action.args[0] === 3],
        ['Geh über Kontrolle in die Ausspielen-Phase. Wähle Luke und spiele ihn für 3 Force bei Docking Bay 94 aus.',
          action => action.kind === 'deploy' && action.cardId === 'Light:1593' && action.args[1] === 0],
        ['Spiele einen Rebel Trooper an Lukes Site aus. Lukes Ability 4 erfüllt die Bedingung für den kostenlosen Deploy.',
          action => action.kind === 'deploy' && action.cardId === 'Light:2052' && action.args[1] === 0],
      ],
    },
    battle: {
      title: 'Bodenkampf mit Blaster', seed: 1092, darkStart: 'Dark:2458', phase: 3, steps: [
        ['Beginne für 1 Force ein Battle bei Docking Bay 94. Dort haben beide Seiten Presence.', action => action.kind === 'battle' && action.args[0] === 0],
        ['Feuere mit dem Blaster des Rebel Troopers auf den Stormtrooper. Der Schuss kostet 1 Force. Destiny muss seine Verteidigung übertreffen.',
          action => action.kind === 'fireWeapon'],
        ['Ziehe mit Ability 4 oder höher Battle Destiny. Wickelt danach Forfeit, Force Loss und das Kampfende ab.',
          (action, settled) => settled && action.kind === 'passDamage'],
      ],
    },
    movement: {
      title: 'Fahrzeug- und Raumbewegung', seed: 1093, darkStart: 'Dark:1426', phase: 4, steps: [
        ['Öffne „Bewegen“ bei Docking Bay 94 und fahre mit Lukes X-34 ins Dune Sea. Mit Luke an Bord kostet der Landspeed 0 Force.',
          action => action.kind === 'move' && action.args[0] === 0 && action.args[2] === 2 && action.args[3] === 'Landspeed'],
        ['Öffne „Bewegen“ bei Dantooine. Fliege den X-wing für 1 Force nach Kessel. Die Distanz von 3 Parsec liegt innerhalb seiner Hyperspeed 5.',
          action => action.kind === 'move' && action.args[0] === 3 && action.args[2] === 1 && action.args[3] === 'Hyperspeed'],
      ],
    },
    'dark-control': {
      title: 'Dark Side · Kontrolle und Kampf', side: 'Dark', seed: 1094, fixedSeed: true, darkStart: 'Dark:2458', phase: 1, steps: [
        ['Dein Stormtrooper hat in Jundland Wastes Presence. Weil Light dort keine Presence hat, kontrollierst du den Ort. Klicke „Force Drain · 2 Force“. Zum Light-Force-Icon kommt der Ortsbonus von +1 hinzu.',
          action => action.kind === 'drain' && action.args[0] === 1],
        ['Geh in die Ausspielen-Phase. Wähle Vader und spiele ihn für 6 Force bei Docking Bay 94 aus. Das Dark-Force-Icon erlaubt dir den Deploy bei Luke.',
          action => action.kind === 'deploy' && action.cardId === 'Dark:634' && action.args[1] === 0],
        ['Spiele Grand Moff Tarkin für 4 Force an Vaders Ort aus. Beide müssen am selben Battle teilnehmen, damit Tarkin eine gegnerische Destiny aufheben kann.',
          action => action.kind === 'deploy' && action.cardId === 'Dark:1061' && action.args[1] === 0],
        ['Geh in die Kampfphase. An Docking Bay 94 haben beide Seiten Presence. Öffne die Kampfvorschau und bestätige „Kampf beginnen · 1 Force“.',
          action => action.kind === 'battle' && action.args[0] === 0],
        ['Ziehe Dark Battle Destiny. Vader erhöht deinen Draw um 1. Lass danach den Light-Bot entscheiden und wähle im Antwortfenster „Tarkin: gegnerisches Destiny aufheben“.',
          action => action.kind === 'destinyResponse' && action.args[0] === 'tarkinCancel'],
      ],
    },
  };

  const lesson = key => Object.hasOwn(lessons, key) ? lessons[key] : null;
  function take(cards, id) {
    const index = cards.findIndex(card => card.id === id);
    if (index < 0) throw Error('Für die Übung fehlt '+id);
    return cards.splice(index, 1)[0];
  }

  function arrangeHands(key, lightDeck, darkDeck) {
    lightDeck.push(...hands[key].map(id => take(lightDeck, id)).reverse());
    if (key === 'dark-control') darkDeck.push(...darkControlHand.map(id => take(darkDeck, id)).reverse());
  }

  function prepare(key, state, game, units) {
    if (key === 'battle') {
      const trooper = take(state.deck, 'Light:2052');
      trooper.weapons = [take(state.deck, 'Light:259')];
      state.light[0].push(trooper, take(state.deck, 'Light:1593'));
      state.dark[0].push(takeDark('Dark:2355'));
      game.moveTop(state.deck, state.force, 2);
      state.deck.push(take(state.deck, 'Light:917'));
    } else if (key === 'movement') {
      state.locations[2] = take(state.deck, 'Light:2448');
      state.locations.push(take(state.deck, 'Light:608'));
      for (const board of [state.light, state.dark]) board.push([]);
      const vehicle = take(state.deck, 'Light:1609');
      units.add(vehicle, take(state.deck, 'Light:1593'), 'driver', 'Light');
      state.light[0].push(vehicle);
      state.light[3].push(take(state.deck, 'Light:2838'));
      game.moveTop(state.deck, state.force);
    } else if (key === 'dark-control') {
      state.dark[1].push(take(state.botDeck, 'Dark:2355'));
      state.light[0].push(take(state.deck, 'Light:1593'));
      const darkDestiny = take(state.botDeck, 'Dark:264');
      game.moveTop(state.botDeck, state.botForce, 11);
      state.botDeck.push(darkDestiny);
      state.deck.push(take(state.deck, 'Light:917'));
    }
    function takeDark(id) {
      if (state.botDeck.some(card => card.id === id)) return take(state.botDeck, id);
      const card = take(state.botHand, id);
      game.moveTop(state.botDeck, state.botHand);
      return card;
    }
    state.activated = lessons[key].phase !== 0;
    game.setPhase(state, lessons[key].phase);
  }

  function progress(key, actions, battleActive) {
    const {side = 'Light', steps} = lessons[key];
    let index = 0;
    for (const action of actions) {
      if (!steps[index]) break;
      if ((action.side === side || index === 2 && key === 'battle') &&
          steps[index][1](action, !battleActive)) index++;
    }
    return {total: steps.length, index, hint: steps[index]?.[0]};
  }

  const timings = [
    [/^(activationDraw|forceGeneration|forceIconPower)$/, 'Bei der Force-Generierung oder Aktivierung'],
    [/^(stealDroid|wuherControl|controlTheft|recycleHand|seekerMove|forceDrain|controlSiteDrain|weaponDrain|assault)$/, 'In der Kontrollphase oder beim Force Drain'],
    [/^(moveReact|shipReact|characterDeployReact|counter|namedCancellation|cancelNamedInterrupt|barrier|emergencyDeployment)$/, 'Im passenden Antwortfenster'],
    [/^(.*Deploy.*|.*Discount|deploy.*|tableEffect|locationEffect|reserveInsert|lostPileCover|rotateLocation|rotateExpandedText|transferBolt)$/i, 'Beim Ausspielen oder Platzieren, gemäß Ziel und Kosten im Spieltext'],
    [/^(.*Landspeed|landspeed|.*Move|cantinaMove|dockingTransit|shipDocking|freeTransport|groupRelocation|.*Board.*|freeTransport|transportDriver)$/i, 'Bei einer passenden Bewegung oder einem Besatzungswechsel'],
    [/^(.*Battle.*|battle.*|.*Destiny|chokeAfterBattle|defendingPower|combinedWeaponFire|weaponShot|weaponDestiny|projectorFire|overload|blasterScope|poisonStinger|shipWeaponPenalty)$/i, 'Im zugehörigen Kampfschritt oder bei der betreffenden Destiny'],
    [/^(.*Forfeit|forfeit|.*Immunity|.*ForceLoss|substituteHit|regenerate|larsLegacy)$/i, 'Bei Forfeit, Attrition oder dem im Text genannten Verlust'],
    [/^(search.*|retrieve.*|shufflePile|pileInterrupt|cardInformation|wager|duel|limitedResources|gravelStorm)$/i, 'Bei der im Spieltext genannten Aktion oder Auswahl'],
  ];
  const typeRules = {
    Location: ['Beim Auslegen und solange der Ort im Spiel ist', 'Die eigenen Force-Icons dieses Orts zählen bei der nächsten eigenen Aktivierung. Presence und Control werden getrennt pro Seite geprüft.'],
    Character: ['Beim Ausspielen und solange der Charakter am passenden Ort ist', 'Spiele den Charakter an einer zulässigen Site aus. Ab Ability 1 kann er dort allein Presence herstellen.'],
    Vehicle: ['Beim Ausspielen, Besetzen oder Bewegen', 'Wähle während der Bewegungsphase ein erreichbares Ziel. Stelle vorher die nötige Besatzung.'],
    Starship: ['Beim Ausspielen, Besetzen, Bewegen oder im Raumkampf', 'Für Hyperspeed prüft der Trainer Pilot, Navigation und die Parsec-Distanz zwischen den Systemen.'],
    Device: ['Beim Anbringen, Aufstellen oder beim im Text genannten Ereignis', 'Die auswählbaren Träger oder Ziele erscheinen, sobald die Voraussetzungen am Ort erfüllt sind.'],
    Effect: ['Beim Ausspielen und bei der im Text genannten Bedingung', 'Spiele den Effect auf sein zulässiges Ziel aus. Ein örtlicher Effect erscheint zusammen mit der Location.'],
    Interrupt: ['Wenn der im Spieltext genannte Auslöser erfüllt ist', 'Öffne das passende Antwortfenster. Der Interrupt wird angeboten, solange Ziel, Zeitpunkt und Kosten passen.'],
    Weapon: ['Beim Ausrüsten und im Waffen-Segment oder beim Auslöser des Waffentyps', 'Rüste einen zulässigen Träger aus und wähle im Waffen-Segment ein Ziel. Der Trainer prüft die auf der Karte angegebene Trefferbedingung.'],
  };
  const examples = [
    [/forceDrain|controlSiteDrain|weaponDrain/i, 'Du kontrollierst den Ort in deiner Kontrollphase. Vergleiche den angebotenen Force Drain mit den gegnerischen Force-Icons.'],
    [/free.*Deploy|characterDeploy|shipDeploy|.*Discount/i, 'Vergleiche die Deploy-Kosten an einem passenden und einem anderen Ort. Nur beim erfüllten Auslöser greift die Sonderregel.'],
    [/counter|barrier|moveReact|shipReact|characterDeployReact/i, 'Die auslösende Aktion öffnet ein Antwortfenster. Wähle die Karte dort, solange du Priorität und ein zulässiges Ziel hast.'],
    [/attrition|forfeit/i, 'Prüfe vor dem Forfeit, welche fällige Attrition diese Karte abdeckt und ob der Kartentext sie schützt.'],
    [/night/i, 'Liegt Nightfall oder Sunsdown am zugehörigen System, zeigt die Site die aktiven Nachtbedingungen mit Quelle an.'],
    [/piloted|pilot|astromech|crew/i, 'Wechsle die relevante Karte auf den Piloten- oder Astromechplatz und vergleiche die angezeigten Werte am Ort.'],
    [/battle|destiny|weaponShot/i, 'Prüfe im Kampf bei erfüllter Bedingung den angezeigten Wert und das aktuelle Antwortfenster.'],
  ];

  function cardGuide(card, effects) {
    const jediTest=Number(card.type?.match(/^Jedi Test #([1-5])$/)?.[1]);
    if(jediTest)return {
      explanation:card.texts?.explanationDe||card.gametext,
      timing:'Auslegen in deiner Ausspielen-Phase. '+(jediTest===3?'Versuch am Ende eines eigenen Zuges ohne Kampf, Force Drain oder anderen Jedi-Test.':'Versuch zu Beginn deiner Kontrollphase, bevor du andere reguläre Aktionen ausführst.'),
      example:jediTest===1?'Wähle Great Warrior in deiner Hand. Unter der Playmat wählst du Trainingsort, Mentor und Schüler. Zum Beispiel: Yoda als Mentor, Son Of Skywalker als Schüler. Beide müssen zum Versuch am Test anwesend sein.':jediTest===2?'Nach bestandenem Test 1 spielst du A Jedi’s Strength aus deiner Hand auf eine unbesetzte Dagobah-Site. Bewege den Schüler dorthin. Zu Beginn einer späteren Kontrollphase klickst du in deinem Spielbereich auf „Jedi-Test 2 versuchen“.':'Die Ausbildung zeigt den aktuellen Test, seinen Standort und den nächsten Schritt. Die Tests 1 bis 5 werden einzeln in Reihenfolge gespielt; der nächste Test wird nicht automatisch aus dem Deck genommen.'
    };
    const [timing, example] = typeRules[card.type] ?? ['Beim genannten Auslöser', 'Prüfe den Spieltext und wähle ein angebotenes Ziel.'];
    const eventTiming = effects.map(rule => timings.find(([match]) => match.test(rule.event))?.[1] ??
      (rule.duration === 'continuous' ? 'Solange die genannte Bedingung erfüllt ist' : timing));
    return {
      explanation: card.texts?.explanationDe || effects.map(rule => rule.summary).filter(Boolean).join(' ') ||
        (card.gametext?.trim() ? 'Der englische Spieltext nennt Voraussetzungen, Kosten und Ergebnis dieser Karte.' :
          'Diese Karte hat keinen eigenen Spieltext. Es gelten die Grundregeln ihres Kartentyps.'),
      timing: [...new Set(eventTiming)].join(' · ') || timing,
      example: examples.find(([match]) => effects.some(rule => match.test(rule.event)))?.[1] ?? example,
    };
  }

  return {lesson, arrangeHands, prepare, progress, cardGuide};
})();

if (typeof module !== 'undefined') module.exports = PremiereLearning;
