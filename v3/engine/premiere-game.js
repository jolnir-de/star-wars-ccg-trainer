const PremiereGame = (() => {
  const sides = ['Light', 'Dark'];
  const otherSide = side => side === 'Light' ? 'Dark' : 'Light';
  const turnMarkers = ['creatureAttacksThisTurn','attackedCreatureSitesThisTurn','movedThisTurn', 'deployedThisTurn', 'drainedSitesThisTurn', 'drainedCardsThisTurn',
    'battledSitesThisTurn', 'battledCardsThisTurn', 'weaponUsersThisTurn', 'weaponUsesThisTurn', 'reactedThisTurn', 'cancelledReactTitles', 'comlinkUsedBy'];

  function actionState(id, seed) {
    return {id, seed, randomState: seed, revision: 0, actions: [], responses: [],
      timing: {turn: 0, phase: 0, battle: 0, used: {}, effects: [], pending: null}};
  }

  function random(game) {
    // Mulberry32. Keep the cursor in the game so a saved state can continue it.
    game.randomState = (game.randomState + 0x6d2b79f5) >>> 0;
    let n = game.randomState;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  }

  function shuffle(cards, game) {
    const shuffled = cards.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random(game) * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  const isReserveInsert = card => !!card?.insertedIntoReserveBy;
  const reserveCards = deck => (deck ?? []).filter(card => !isReserveInsert(card));

  function shuffleReserve(deck, game) {
    const hasPlayableCard = deck.some(card => !isReserveInsert(card));
    let shuffled;
    do {
      shuffled = shuffle(deck, game);
    } while (hasPlayableCard && isReserveInsert(shuffled.at(-1)));
    return shuffled;
  }

  function copyDeck(deck, side) {
    return {...deck, cards: deck.cards.map((card, index) => ({...card,
      instanceId: `${side}:${index + 1}`, owner: side})), setAside: new Set()};
  }

  function createState(game, deck, botDeck, locations, locationOrder, firstSide = 'Dark') {
    const state = {game, turn: 1, phase: 0, activeSide: firstSide, activated: false,
      deck, botDeck, hand: [], botHand: [], locations, locationOrder, convertedLocations: {}, locationEffects: {},
      light: locations.map(() => []), dark: locations.map(() => []),
      force: [], used: [], lost: [], botForce: [], botUsed: [], botLost: [], lostPileEffects: [], tableEffects: [],
      log: [], botReason: 'Bot wartet.', botHistory: [], botTurn: null,
      pendingForceLoss: null, gameWinner: null, nightConditions: false};
    resetTurn(state, firstSide);
    for (let i = 0; i < 8; i++) {
      moveTop(deck, state.hand);
      moveTop(botDeck, state.botHand);
    }
    return state;
  }

  function zones(state, side) {
    return side === 'Light'
      ? {hand: state.hand, deck: state.deck, force: state.force, used: state.used, lost: state.lost, board: state.light}
      : {hand: state.botHand, deck: state.botDeck, force: state.botForce, used: state.botUsed, lost: state.botLost, board: state.dark};
  }

  function moveTop(source, destination, count = 1) {
    const moved = [];
    while (count-- > 0 && source.length) {
      const card = source.pop();
      destination.push(card);
      moved.push(card);
    }
    return moved;
  }

  function recirculate(deck, used) {
    if (!used.length) return false;
    deck.unshift(...used.splice(0));
    return true;
  }

  function lossChoices(state, side, preferred) {
    const {hand, deck, force, used} = zones(state, side);
    const piles = {deck: isReserveInsert(deck?.at(-1)) ? [] : deck, force, used};
    if (Object.hasOwn(piles, preferred) && piles[preferred]?.length) return [{args: [preferred]}];
    const sabacc = state.cloudCitySabacc?.hands?.[side];
    const cards = (sabacc ?? hand ?? []).map((card, i) => ({args: [sabacc ? 'sabacc' : 'hand', i], card})).filter(choice=>choice.card!==state.hothPayingInterrupt);
    if (preferred === 'hand' && cards.length) return cards;
    return [...cards,
      ...Object.entries(piles).filter(([, pile]) => pile?.length).map(([zone]) => ({args: [zone]}))];
  }

  function loseForce(state, side, zone, index) {
    const {hand, deck, force, used, lost} = zones(state, side);
    if (zone === 'sabacc') {
      const cards=state.cloudCitySabacc?.hands?.[side];
      if(!Number.isInteger(index)||!cards?.[index])return null;
      const [card]=cards.splice(index,1);lost.push(card);return card;
    }
    if (zone === 'hand') {
      if (!Number.isInteger(index) || !hand[index]) return null;
      const [card] = hand.splice(index, 1);
      lost.push(card);
      return card;
    }
    const piles = {deck, force, used};
    if (!Object.hasOwn(piles, zone) || !piles[zone]?.length || isReserveInsert(piles[zone].at(-1))) return null;
    return moveTop(piles[zone], lost)[0];
  }

  function retrieveForce(state, side, count) {
    const {lost, used} = zones(state, side);
    return moveTop(lost, used, count);
  }

  function retrieveCard(state, side, index) {
    const {lost, used} = zones(state, side);
    if (!Number.isInteger(index) || !lost[index]) return null;
    const [card] = lost.splice(index, 1);
    used.push(card);
    return card;
  }

  function lostPileFaceDown(state, side) {
    return (state.lostPileEffects ?? []).some(effect => effect.target === side);
  }

  function playerView(state, side) {
    if (!state || !sides.includes(side)) return null;
    const clone = card => {
      if (!card) return card;
      const visible = JSON.parse(JSON.stringify(card));
      function conceal(unit) {
        if(unit.bluffs&&side!=='Dark')unit.bluffs=unit.bluffs.map(()=>({faceDown:true}));
        if(unit.escortedCaptive)conceal(unit.escortedCaptive);
        for(const captive of unit.additionalCaptives??[])conceal(captive);
        if(unit.cloudCityStored&&(unit.controller??unit.owner??unit.side)!==side)unit.cloudCityStored=unit.cloudCityStored.map(()=>({faceDown:true}));
        if (unit.salt) unit.salt = unit.salt.map(() => ({faceDown:true}));
        for (const item of [...(unit.weapons ?? []), ...(unit.attachments ?? []),
          ...(unit.occupants ?? []).map(occupant => occupant.card)]) conceal(item);
      }
      conceal(visible);
      return visible;
    };
    const players = Object.fromEntries(sides.map(player => {
      const piles = zones(state, player);
      const faceDown = lostPileFaceDown(state, player);
      const reserveCount = (piles.deck ?? []).some(isReserveInsert) ? null : piles.deck?.length ?? 0;
      const hand=state.cloudCitySabacc?.hands?.[player]??piles.hand;
      return [player, {handCount: hand?.length ?? 0, reserveCount,
        forceCount: piles.force?.length ?? 0, usedCount: piles.used?.length ?? 0,
        ...(piles.used?.at(-1)?.dagobahFaceUp?{usedTop:clone(piles.used.at(-1))}:{}),
        ...(piles.deck?.at(-1)?.dagobahFaceUp&&!isReserveInsert(piles.deck.at(-1))?{reserveTop:clone(piles.deck.at(-1))}:{}),
        lostCount: piles.lost?.length ?? 0, lostFaceDown: faceDown,
        lostTop: faceDown ? null : clone(piles.lost?.at(-1)) ?? null,
        lostEffects: (state.lostPileEffects ?? []).filter(effect => effect.target === player).map(effect => clone(effect.card)),
        tableEffects: (state.tableEffects ?? []).filter(effect => effect.target === player).map(effect => clone(effect.card)),
        board: (piles.board ?? []).map(row => row.map(clone)),
        ...(player === side ? {hand: (hand ?? []).map(clone)} : {})}];
    }));
    return {phase: state.phase, activeSide: state.activeSide, turn: state.turn,
      winner: state.gameWinner, locations: state.locations.map(clone), players, outOfPlay:(state.outOfPlay??[]).map(clone),
      buriedCounts: state.locations.map((_, slot) => (state.buriedMines ?? []).filter(record=>record.slot===slot).length),
      convertedLocations: state.locations.map((_, slot) => (state.convertedLocations?.[slot] ?? []).map(clone)),
      locationEffects: state.locations.map((_, slot) => (state.locationEffects?.[slot] ?? []).map(effect => clone(effect.card)))};
  }

  function setupView(setup, side) {
    if (!setup || !sides.includes(side)) return null;
    const reveal = setup.revealed;
    return {seed: setup.game.seed, revealed: reveal ? JSON.parse(JSON.stringify(reveal)) : null};
  }

  function lifeForce(state, side) {
    const {deck, force, used} = zones(state, side);
    const draws = state.game?.responses.filter(frame=>frame.kind==='destiny'&&frame.side===side&&frame.draw).length??0;
    return (state.cloudCitySabacc?.hands?.[side]?.length??0)+Number(state.pendingCardView?.mode==='destinyValue'&&state.pendingCardView.side===side)+reserveCards(deck).length + (force?.length ?? 0) + (used?.length ?? 0) + draws;
  }

  function outcome(state) {
    if (state.gameWinner || state.pendingForceLoss || state.pendingReserveSearch || state.pendingCustody?.length || state.automatedPending || state.pendingCardView || state.attackRun || state.creatureAttack || state.creatureClashInProgress || responseWindow(state.game) || state.game?.timing.pending) return state.gameWinner ?? null;
    const light = lifeForce(state, 'Light'), dark = lifeForce(state, 'Dark');
    if (!light && !dark) return 'Simultaneous';
    if (!light) return 'Dark';
    if (!dark) return 'Light';
    return null;
  }

  function expire(game, scope) {
    if (!game) return;
    game.timing[scope]++;
    game.timing.effects = game.timing.effects.filter(effect => effect.scope !== scope);
    delete game.timing.used[scope];
  }

  function setPhase(state, phase) {
    if (state.phase !== phase) expire(state.game, 'phase');
    state.phase = phase;
  }

  function resetTurn(state, side) {
    expire(state.game, 'turn');
    expire(state.game, 'phase');
    state.activeSide = side;
    state.phase = 0;
    state.activated = false;
    for (const marker of turnMarkers) state[marker] = [];
  }

  function useOnce(game, scope, key) {
    const uses = game.timing.used[scope] ??= [];
    if (uses.includes(key)) return false;
    uses.push(key);
    return true;
  }

  function wasUsed(game, scope, key) {
    return game.timing.used[scope]?.includes(key) ?? false;
  }

  function responseWindow(game) {
    return game?.responses.at(-1) ?? null;
  }

  function openResponse(game, frame) {
    const window = {...frame, priority: otherSide(frame.side), passes: 0, cancelled: false};
    game.responses.push(window);
    return window;
  }

  function passResponse(game, side) {
    const window = responseWindow(game);
    if (!window || window.priority !== side) return false;
    if (++window.passes === 2) {
      game.responses.pop();
      return window;
    }
    window.priority = otherSide(side);
    return true;
  }

  function cancelResponse(game, window) {
    if (!game.responses.includes(window) || window.cancelled) return false;
    window.cancelled = true;
    return true;
  }

  function removeCancelledResponse(game) {
    if (!responseWindow(game)?.cancelled) return null;
    return game.responses.pop();
  }

  function answer(game, side, frame) {
    const parent = responseWindow(game);
    if (!parent || parent.priority !== side) return false;
    parent.passes = 0;
    parent.priority = otherSide(side);
    return openResponse(game, {...frame, side});
  }

  function registerTrigger(game, trigger) {
    if (typeof trigger.id !== 'string' || typeof trigger.resolve !== 'function' ||
        !sides.includes(trigger.side) || !['game', 'turn', 'phase', 'battle'].includes(trigger.scope) ||
        game.timing.effects.some(effect => effect.id === trigger.id)) return false;
    game.timing.effects.push(trigger);
    return true;
  }

  function checkpoint(game, event, activeSide, continuation, optionalPriority = activeSide) {
    const effects = game?.timing.effects.filter(effect => effect.event === event &&
      (!effect.once || !wasUsed(game, effect.scope, effect.id)) && (!effect.when || effect.when())) ?? [];
    if (!effects.length) return continuation();
    game.timing.pending = {event, effects, activeSide, optionalPriority, priority: optionalPriority, passes: 0, continuation};
  }

  function triggerOptions(game, side) {
    const pending = game?.timing.pending;
    if (!pending) return [];
    const mandatory = pending.effects.filter(effect => effect.mandatory);
    if (mandatory.length) return side === pending.activeSide ? mandatory : [];
    if (side !== pending.priority) return [];
    return [...pending.effects.filter(effect => effect.side === side), {id: null, label: 'Passen'}];
  }

  function resolveTrigger(game, side, id) {
    const pending = game?.timing.pending;
    const effect = triggerOptions(game, side).find(option => option.id === id);
    if (!effect) return false;
    if (id === null) pending.passes++;
    else {
      pending.effects = pending.effects.filter(option => option !== effect);
      if (effect.once) useOnce(game, effect.scope, effect.id);
      effect.resolve();
      pending.effects = pending.effects.filter(option => !option.when || option.when());
      pending.passes = 0;
    }
    if (!pending.effects.length || pending.passes === 2) {
      game.timing.pending = null;
      pending.continuation();
    } else pending.priority = effect.mandatory ? pending.optionalPriority : otherSide(side);
    return true;
  }

  function offer(game, side, kind, args = [], details = {}) {
    return {...details, kind, side, args, gameId: game?.id, revision: game?.revision};
  }

  function execute(game, action, legalActions, resolve) {
    if (!action || !sides.includes(action.side) || !Array.isArray(action.args)) return false;
    if (game && (game.executing || action.gameId !== game.id || action.revision !== game.revision)) return false;
    const valid = legalActions(action.side, action).find(option => option.kind === action.kind &&
      option.args.length === action.args.length &&
      option.args.every((arg, i) => arg === action.args[i]));
    if (!valid) return false;
    if (game) game.executing = true;
    try {
      const result = resolve(valid);
      if (result && game) {
        const entry={kind: valid.kind, side: valid.side, args: valid.args.slice()};
        if (game.lesson && valid.card) entry.cardId=valid.card.id;
        game.actions.push(entry);
        game.revision++;
      }
      return result;
    } finally {
      if (game) game.executing = false;
    }
  }

  return {actionState, answer, cancelResponse, checkpoint, copyDeck, createState, execute, expire,
    lifeForce, lossChoices, loseForce, lostPileFaceDown, moveTop, offer, openResponse, otherSide, outcome, passResponse, playerView, random,
    recirculate, registerTrigger, removeCancelledResponse, resetTurn, resolveTrigger, responseWindow,
    retrieveCard, retrieveForce, setPhase, setupView, shuffle, shuffleReserve, isReserveInsert, reserveCards, sides, triggerOptions, useOnce, wasUsed, zones};
})();

if (typeof module !== 'undefined') module.exports = PremiereGame;
