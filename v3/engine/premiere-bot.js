const PremiereBot = (() => {
  const unit = card => card && ['Character', 'Vehicle', 'Starship'].includes(card.type);
  const strength = card => (card?.power ?? 0) * 0.55 + (card?.ability ?? 0) * 0.4;
  const value = card => card?.redundant ? 0.5 : unit(card) ? 2 + strength(card) : card?.type === 'Location' ? 2 : 1.8;
  const siteValue = site => 1.6 + 1.45 * (site?.drain ?? 0) + 0.35 * (site?.generation ?? 0);

  const styles = Object.freeze({
    defensive: {label:'Defensiv', description:'Hält kontrollierte Orte und spart Force für Antworten.', responseReserve:2,
      reservePenalty:1.9, forceWeight:0.55, battleThreshold:2.6, controlBonus:1.5, leaveControl:1.65, pressure:0.8},
    balanced: {label:'Ausgewogen', description:'Verteilt Force zwischen Aufbau, Bewegung und Kämpfen.', responseReserve:0,
      reservePenalty:1.45, forceWeight:0.55, battleThreshold:0.9, controlBonus:0, leaveControl:1, pressure:1},
    offensive: {label:'Offensiv', description:'Sucht günstige Kämpfe und verstärkt umkämpfte Orte.', responseReserve:0,
      reservePenalty:1.05, forceWeight:0.43, battleThreshold:0.15, controlBonus:0, leaveControl:0.8, pressure:1.6},
  });
  const isStyle = style => typeof style === 'string' && Object.hasOwn(styles, style);
  const profile = view => isStyle(view.style) ? styles[view.style] : styles.balanced;

  function startingLocation(cards, options, fraction, side = 'Dark') {
    const ships = cards.filter(card => card.type === 'Starship').length;
    const ground = cards.filter(card => card.type === 'Character' || card.type === 'Vehicle').length;
    const own = side.toLowerCase(), rival = side === 'Dark' ? 'light' : 'dark';
    const score = location => !location ? -Infinity : 2 * (location.icons[own] ?? 0) - (location.icons[rival] ?? 0) * 0.5 +
      (location.subType === 'System' ? Math.min(ships, 12) * 0.22 : Math.min(ground, 18) * 0.1) +
      (location.locationTags?.includes('Exterior') ? 0.25 : 0);
    const strongest = Math.max(...options.map(score));
    const tied = options.flatMap((location, index) => score(location) === strongest ? [index] : []);
    return tied[Math.floor(fraction * tied.length)];
  }

  function drawGoal(view) {
    // Expansion starts may have no usable deployment access. An unusable full
    // hand must not prevent drawing the location or unit that opens the game.
    if(view.needsDeployAccess)return view.hand.length+1;
    const units = view.hand.filter(card => unit(card) && !card.redundant && !card.needsCrew && (card.ability > 0 || card.type === 'Starship'));
    const holdsSites = view.sites.some(site => site?.own);
    return holdsSites ? (units.length >= 2 ? 3 : 5) : (units.length ? 5 : 7);
  }

  function reserve(view, phase = view.phase) {
    const draw = view.life > 3 ? Math.min(3, Math.max(0, drawGoal(view) - view.hand.length)) : 0;
    const battle = phase <= 3 && view.sites.some(site => site?.own && site.rival && site.margin >= 1);
    const fire = battle && view.sites.some(site => site?.own && site.rival && site.readyWeapons);
    const movement = phase < 4 && view.sites.some(site => site?.routes);
    return draw + Number(battle) + Number(fire) + Number(movement) + profile(view).responseReserve;
  }

  function cost(view, action, keep = reserve(view)) {
    const {forceWeight, reservePenalty} = profile(view);
    return action.cost * forceWeight + Math.max(0, Math.min(view.force, keep) - (view.force - action.cost)) * reservePenalty;
  }

  const responseCost = (view, action) => cost(view, action, reserve(view) - profile(view).responseReserve);
  const savingForResponses = view => profile(view).responseReserve > 0 && view.force <= profile(view).responseReserve &&
    (view.sites.some(site => site?.own) || view.hand.some(card => card?.type === 'Interrupt'));
  const guardsControl = (site, power) => site?.controlled && site.threatened && power > 0;

  // Use a common distribution for unrevealed destiny, independent of deck order and contents.
  function hitChance(draws, threshold) {
    let totals = [1];
    for (let count = 0; count < draws; count++) {
      const next = Array(totals.length + 6).fill(0);
      totals.forEach((chance, sum) => {
        for (let destiny = 0; destiny <= 6; destiny++) next[sum + destiny] += chance / 7;
      });
      totals = next;
    }
    return draws ? totals.reduce((sum, chance, destiny) => sum + (destiny > threshold ? chance : 0), 0) : 0;
  }

  function movement(view, action) {
    const from = view.sites[action.from], to = view.sites[action.to];
    if (!to) return -Infinity;
    const enters = action.from !== action.to;
    const claim = enters && to.ownKnown && !to.own && !to.rival && to.rivalKnown && action.bringsPresence;
    const style = profile(view);
    const contest = enters && to.rival ? (to.margin + action.unitPower >= 2 ? 1.6 * style.pressure : -2.5) : 0;
    const retreat = enters && from?.rival && from.margin < -2 && !to.rival ? 1.6 : 0;
    const leaves = action.leavesControl ? siteValue(from) : 0;
    const defend = enters && guardsControl(to, action.unitPower) ? style.controlBonus : 0;
    return (claim ? siteValue(to) + 0.6 : 0) + contest + retreat + defend - leaves * style.leaveControl + action.carrierGain - cost(view, action);
  }

  function deployment(view, action) {
    const site = view.sites[action.site];
    if (action.kind === 'deployLocation' || action.kind === 'convertLocation') {
      return (action.card?.icons?.own ?? 0) * 1.5 - (action.card?.icons?.rival ?? 0) * 0.8 + action.locationSupport;
    }
    if (action.kind === 'equip') return (site?.rival && site.own ? 3 : 0.8) + action.carrierGain - cost(view, action);
    if (action.kind === 'deployDevice' || action.kind === 'deployAutomated') return 1.2 + action.carrierGain - cost(view, action);
    if (action.kind === 'deploy' || action.kind === 'deployWithPilot') {
      const claim = site?.rivalKnown && !site.rival && site.ownKnown && !site.own && action.bringsPresence;
      const style = profile(view);
      const reinforcement = site?.rival ? (site.margin + action.unitPower >= 1 ? 2.4 * style.pressure : -1.3) : 0;
      const defend = guardsControl(site, action.unitPower) ? style.controlBonus : 0;
      return 0.6 + action.unitPower * 0.55 + action.unitAbility * 0.38 + action.carrierGain +
        (claim ? siteValue(site) + 1 : 0) + reinforcement + defend - cost(view, action);
    }
    return 1.3 + action.effectValue - cost(view, action);
  }

  function damage(view, action) {
    const debt = view.debt;
    switch (action.kind) {
      case 'battleForfeit':
      case 'talzForfeit':
      case 'battleHandForfeit': {
        const coverage = Math.min(debt.damage, action.value) + (action.immune ? 0 : Math.min(debt.attrition, action.value));
        return Number(!!action.mandatory) * 80 + Number(debt.attrition > 0 && !action.immune) * 24 +
          coverage * 2 - value(action.card) - action.collateral;
      }
      case 'battleForceLoss':
      case 'loseForce': return action.mode === 'hand' ? 14 - value(action.card) : 11 - (view.life <= debt.damage + 2 ? 8 : 0) - Number(action.mode === 'force');
      case 'reduceForceLoss': return 14 + action.amount * 1.2 - cost(view, action);
      case 'pileInterrupt': return action.effectValue > 0 ? 26 + action.effectValue - cost(view, action) : -Infinity;
      case 'passDamage': return 70;
      case 'damageRelief': return 92;
      default: return -Infinity;
    }
  }

  function score(view, action) {
    const site = view.sites[action.site];
    if (view.debt) return damage(view, action);
    switch (action.kind) {
      case 'activate': return action.amount + action.immediateDraw * (view.hand.length < 3 ? 0.35 : -0.4) + 0.1;
      case 'draw': return !savingForResponses(view) && view.life > (view.sites.some(site => site?.own) ? 2 : 1) && view.hand.length < drawGoal(view) ? 2 : -1;
      case 'deployLocation': case 'convertLocation': case 'deploy': case 'deployWithPilot': case 'equip':
      case 'deployDevice': case 'deployBolt': case 'deployAutomated': case 'deployTableEffect': case 'deployLocationEffect':
      case 'deployReserveInsert': case 'deployLostPileEffect': case 'navSabotage': case 'revolution':
        return deployment(view, action);
      case 'move': case 'transport': case 'moveSeeker': return movement(view, action);
      case 'recycleHand': return view.hand.length >= 5 && action.card?.redundant ? 1 : 0;
      case 'battle': return (site?.margin ?? -99) - profile(view).battleThreshold - cost(view, action);
      case 'drain': return 1 + action.amount * 2;
      case 'fireWeapon': case 'computerFire': case 'combinedAttack': case 'gaderffii':
        return action.hit ? -2 : hitChance(Math.min(action.draws, view.reserveCount), action.defense - action.bonus) *
          (3.4 + strength(action.target) + Number(action.effect === 'capture') * 2) + action.effectValue - cost(view, action);
      case 'react': case 'reactDeploy':
        if (view.window === 'drain') return (action.bringsPresence ? 2 + (view.drain ?? 0) * 2 : -2) -
          (action.leavesControl ? siteValue(view.sites[action.from]) * profile(view).leaveControl : 0) - responseCost(view, action);
        return (site?.margin ?? 0) + action.unitPower < -4 ? -3 :
          action.unitPower * 0.8 + action.unitAbility * 0.6 - (action.leavesControl ? siteValue(view.sites[action.from]) * profile(view).leaveControl : 0) - responseCost(view, action);
      case 'interruptResponse':
        return action.effectValue + strength(action.target) * 0.4 - responseCost(view, action);
      case 'destinyResponse': return action.effectValue - responseCost(view, action);
      case 'destiny': return 4;
      case 'skipDestiny': return 0;
      case 'battlePrediction': return (action.mode === view.side) === (view.sites[view.battleSite]?.margin >= 0) ? 4 : 1;
      case 'passWeapons': case 'passResponse': return 0;
      case 'retrieve': case 'searchReserve': return 2.5 + action.effectValue - cost(view, action);
      case 'takeFromReserve': return action.card ? value(action.card) : 0;
      case 'finishCardInformation': return (['done','keep','decline'].includes(action.mode) ? 0 : 0.7) + action.effectValue;
      case 'custody': case 'prisonerTransfer': return (['deliver','imprison','seize'].includes(action.mode) ? 4 : 0) + action.effectValue;
      case 'automatedTarget': return action.targetSide === view.rival ? value(action.card) : -value(action.card);
      case 'timingTrigger': return action.effectValue;
      case 'duel': return action.effectValue - cost(view, action);
      case 'hothAction': case 'anhCharacter': case 'battleEffect': case 'pileInterrupt': case 'cardInformation': case 'weaponEffect': case 'holocamPower':
      case 'cancelTableEffect': case 'cancelNamedWeapon': case 'controlTheft': case 'deviceAction': case 'limitedResources':
      case 'lateralRepair': case 'lateralMechanic': case 'gravelStorm':
        return action.effectValue - cost(view, action);
      default: return -Infinity;
    }
  }

  function choose(view, actions, required = false) {
    let best = null, bestScore = required ? -Infinity : 0;
    for (const action of actions) {
      const points = score(view, action);
      if (points > bestScore) { bestScore = points; best = action.index; }
    }
    // Forced engine prompts can include a single action with no strategic alternatives.
    return best ?? (required ? actions[0]?.index ?? null : null);
  }

  function explain(view, action) {
    const site = view.sites[action.site];
    const fallback = 'Der Einsatz verbessert die eigene Stellung bei den sichtbaren Kräften.';
    switch (action.kind) {
      case 'battle': return 'Battle begonnen. Sichtbare Power, mögliche Destiny-Ziehungen und Waffen ergeben einen geschätzten Vorteil.';
      case 'drain': return 'Force Drain gewählt. Der kontrollierte Ort erlaubt '+action.amount+' Force-Verlust für die Gegenseite.';
      case 'deployLocation': case 'convertLocation':
        return 'Location ausgelegt. Ihre Force-Icons und die passenden Einheiten unterstützen den eigenen Aufbau.';
      case 'deploy': case 'deployWithPilot':
        if (profile(view).controlBonus && guardsControl(site, action.unitPower)) return 'Deploy verstärkt einen kontrollierten Ort in Reichweite gegnerischer Einheiten.';
        if (site?.rival) return 'Deploy verstärkt die eigene Seite an einem umkämpften Ort.';
        if (site?.ownKnown && site.rivalKnown && !site.own && action.bringsPresence) return 'Deploy bringt eigene Presence an einen freien Ort.';
        return 'Deploy baut die eigene Stellung aus.';
      case 'move': case 'transport': case 'moveSeeker':
        if (action.from === action.to) return 'Besatzung angepasst. Die Änderung verbessert den Einsatz der Einheit.';
        if (site?.rival) return 'Bewegung verstärkt einen umkämpften Ort.';
        if (site?.ownKnown && site.rivalKnown && !site.own && action.bringsPresence) return 'Bewegung erschließt einen freien Ort für eigene Presence.';
        return 'Bewegung gewählt. Die neue Position ist günstiger.';
      case 'draw': return view.sites.some(position => position?.own) ? 'Karte gezogen, um die Hand für weitere Aktionen aufzufüllen.' :
        'Karte gezogen, um wieder Presence aufzubauen.';
      case 'fireWeapon': case 'computerFire': case 'combinedAttack': case 'gaderffii':
        return 'Waffe eingesetzt. Die sichtbare Verteidigung und der mögliche Nutzen rechtfertigen den Schuss.';
      case 'react': case 'reactDeploy': return view.window === 'drain' ? 'React gewählt, um den drohenden Force Drain zu stoppen.' :
        'React gewählt, um die eigene Seite im Battle zu verstärken.';
      case 'interruptResponse': case 'destinyResponse': return 'Antwort gespielt. Sie kann den angekündigten Effekt oder einen offenliegenden Destiny-Wert beeinflussen.';
      case 'battleEffect': case 'equip': case 'deployTableEffect': case 'deployLocationEffect': return fallback;
      case 'battleForfeit': case 'talzForfeit': case 'battleHandForfeit':
        return action.mandatory ? 'Forfeit gewählt, um einen Pflichtverlust abzuwickeln.' :
          'Forfeit gewählt, um ausstehenden Battle Damage oder Attrition abzudecken.';
      case 'passResponse': return 'Im Antwortfenster gepasst. Keine verfügbare Antwort hatte einen ausreichenden Vorteil.';
      default: return '';
    }
  }

  function explainPass(view, actions, phase) {
    if (phase === 5 && actions.some(action => action.kind === 'draw') && savingForResponses(view))
      return 'Behält Force für Reacts und Interrupts zurück.';
    const battles = actions.filter(action => action.kind === 'battle');
    if (phase === 3 && battles.length) {
      if (battles.every(action => (view.sites[action.site]?.margin ?? -99) <= profile(view).battleThreshold))
        return 'Kein Battle begonnen. Der geschätzte Vorteil reicht bei den sichtbaren Kräften nicht aus.';
      return 'Kein Battle begonnen. Der geschätzte Vorteil rechtfertigt die Force-Ausgaben nicht.';
    }
    const moves = actions.filter(action => ['move', 'transport'].includes(action.kind));
    if (phase === 4 && moves.length && moves.every(action => action.leavesControl))
      return 'Hält die Stellung. Die verfügbaren Bewegungen würden einen kontrollierten Ort aufgeben.';
    return '';
  }

  return {startingLocation, choose, styles, isStyle, explain, explainPass};
})();

if (typeof module !== 'undefined') module.exports = PremiereBot;
