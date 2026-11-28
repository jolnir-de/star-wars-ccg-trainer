const PremiereBattle = (() => {
  function printedDestiny(card) {
    if (!card) return null;
    if (card.type === 'Location') return 0;
    if (card.id === 'Light:319') return Math.PI;
    if (['Dark:816','Light:815'].includes(card.id) && /destiny equals zero/i.test(card.gametext ?? '')) return 0;
    return Number.isFinite(card.destiny) ? card.destiny : null;
  }

  function draw(piles, modifier = 0) {
    const card = piles.deck.pop();
    if (!card) return null;
    const printed = printedDestiny(card);
    return {card, value: printed === null ? null : Math.max(0, printed + modifier), cancelled: false};
  }

  function settle(piles, destiny) {
    if (destiny) piles.used.push(destiny.card);
    return destiny;
  }

  function total(draws) {
    return draws.some(draw => !draw.cancelled && draw.value === null) ? null :
      draws.reduce((sum, draw) => sum + (draw.cancelled ? 0 : draw.value), 0);
  }

  function result(power, destiny) {
    const {Light: light, Dark: dark} = destiny;
    if (![light.battle, dark.battle, light.power, dark.power, light.attrition, dark.attrition].every(Number.isFinite)) return null;
    const lightTotal = power.Light + light.battle + light.power;
    const darkTotal = power.Dark + dark.battle + dark.power;
    return {lightTotal,darkTotal,lightDamage:Math.max(0,darkTotal-lightTotal),darkDamage:Math.max(0,lightTotal-darkTotal),
      lightAttrition:dark.battle+dark.attrition,darkAttrition:light.battle+light.attrition};
  }

  function forfeit(debt, value) {
    debt.damage = Math.max(0, debt.damage - value);
    debt.attrition = Math.max(0, debt.attrition - value);
  }

  return {draw, forfeit, printedDestiny, result, settle, total};
})();

if (typeof module !== 'undefined') module.exports = PremiereBattle;
