// ============================================================
// game.js — core state, persistence, time decay, gacha, battle.
// All gameplay actions live here. UI rendering is in ui.js.
// State is saved to localStorage on every change.
// ============================================================

'use strict';

const SAVE_KEY = 'smooth-giraffe-save-v1';
const SPECIES_BY_ID = Object.fromEntries(SPECIES.map(s => [s.id, s]));
const EGG_BY_ID = Object.fromEntries(EGG_TYPES.map(e => [e.id, e]));
const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));

// ------------------------------------------------------------
// State
// ------------------------------------------------------------

let state = null;

function defaultState() {
  return {
    schemaVersion: 1,
    player: {
      name: 'Trainer',
      createdAt: Date.now(),
      coins:    CONFIG.signupCoins,
      gems:     CONFIG.signupGems,
      stardust: 0,
      tickets:  CONFIG.signupTickets,
      trophies: 0,
      fragments: 0,
    },
    monsters: [],
    inventory: {
      301: 3,  // 3 free Pet Kibble
      401: 2,  // 2 free Soap
      501: 1,  // 1 free Squeaky Ball
    },
    eggs: [],
    pity: {
      common:    { rare: 0, epic: 0, legendary: 0 },
      rare:      { rare: 0, epic: 0, legendary: 0 },
      epic:      { rare: 0, epic: 0, legendary: 0 },
      mythic:    { rare: 0, epic: 0, legendary: 0 },
    },
    activePetId: null,
    lastTickAt: Date.now(),
    eggPurchasesToday: { date: today(), count: 0 },
    battleHistory: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('loadState failed:', e);
    return null;
  }
}

function saveState() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('saveState failed:', e);
  }
}

function newGame(displayName) {
  state = defaultState();
  state.player.name = (displayName || 'Trainer').slice(0, 20);
  saveState();
}

function hasSave() {
  return loadState() !== null;
}

function resetGame() {
  localStorage.removeItem(SAVE_KEY);
  state = null;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function uuid() {
  return crypto?.randomUUID?.() ||
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function species(id) { return SPECIES_BY_ID[id]; }

// ------------------------------------------------------------
// Currency
// ------------------------------------------------------------

function canAfford(cost) {
  const p = state.player;
  if (cost.coins    && p.coins    < cost.coins)    return false;
  if (cost.gems     && p.gems     < cost.gems)     return false;
  if (cost.stardust && p.stardust < cost.stardust) return false;
  if (cost.tickets  && p.tickets  < cost.tickets)  return false;
  return true;
}

function spend(cost, reason) {
  if (!canAfford(cost)) throw new Error('insufficient funds for ' + reason);
  const p = state.player;
  if (cost.coins)    p.coins    -= cost.coins;
  if (cost.gems)     p.gems     -= cost.gems;
  if (cost.stardust) p.stardust -= cost.stardust;
  if (cost.tickets)  p.tickets  -= cost.tickets;
}

function credit(amount, currency) {
  const p = state.player;
  if (currency === 'coins')    p.coins    = clamp(p.coins + amount, 0, CONFIG.coinsCap);
  if (currency === 'gems')     p.gems    += amount;
  if (currency === 'stardust') p.stardust += amount;
  if (currency === 'tickets')  p.tickets  = clamp(p.tickets + amount, 0, CONFIG.ticketsCap);
}

// ------------------------------------------------------------
// Monster care actions
// ------------------------------------------------------------

function claimStarter(speciesId) {
  if (state.monsters.length > 0) throw new Error('you already have a starter');
  const sp = species(speciesId);
  if (!sp || !sp.isStarter) throw new Error('not a starter species');

  const monster = {
    id: uuid(),
    speciesId: sp.id,
    nickname: '',
    isStarter: true,
    isShiny: false,
    level: 1,
    xp: 0,
    hp: sp.baseStats.hp,
    atk: sp.baseStats.atk,
    def: sp.baseStats.def,
    spd: sp.baseStats.spd,
    intl: sp.baseStats.intl,
    hunger: 100,
    cleanliness: 100,
    energy: 100,
    mood: 90,
    createdAt: Date.now(),
  };
  state.monsters.push(monster);
  state.activePetId = monster.id;
  saveState();
  return monster;
}

function getActivePet() {
  if (!state.activePetId) return null;
  return state.monsters.find(m => m.id === state.activePetId) || null;
}

function setActivePet(id) {
  if (state.monsters.find(m => m.id === id)) {
    state.activePetId = id;
    saveState();
  }
}

function applyEffect(monster, effect) {
  if (effect.hunger)      monster.hunger      = clamp(monster.hunger      + effect.hunger,      0, 100);
  if (effect.cleanliness) monster.cleanliness = clamp(monster.cleanliness + effect.cleanliness, 0, 100);
  if (effect.energy)      monster.energy      = clamp(monster.energy      + effect.energy,      0, 100);
  if (effect.mood)        monster.mood        = clamp(monster.mood        + effect.mood,        0, 100);
  recomputeMood(monster);
}

function recomputeMood(monster) {
  // Mood = avg(needs), with smoothing — preserves bonuses from toys/cake
  const derived = (monster.hunger + monster.cleanliness + monster.energy) / 3;
  monster.mood = clamp(Math.round((monster.mood + derived) / 2), 0, 100);
}

function useItem(itemId) {
  const item = ITEM_BY_ID[itemId];
  if (!item) throw new Error('unknown item');
  if ((state.inventory[itemId] || 0) < 1) throw new Error('out of ' + item.name);
  const pet = getActivePet();
  if (!pet) throw new Error('no active pet');

  state.inventory[itemId]--;
  if (state.inventory[itemId] <= 0) delete state.inventory[itemId];
  applyEffect(pet, item.effect);
  saveState();
  return { item, pet };
}

function sleepPet() {
  const pet = getActivePet();
  if (!pet) throw new Error('no active pet');
  applyEffect(pet, { energy: 50, cleanliness: -5 });  // a nap costs a bit of clean
  saveState();
  return pet;
}

function playWithPet() {
  const pet = getActivePet();
  if (!pet) throw new Error('no active pet');
  applyEffect(pet, { mood: 10, energy: -8 });
  saveState();
  return pet;
}

function petPet() {  // free interaction, tiny mood boost
  const pet = getActivePet();
  if (!pet) throw new Error('no active pet');
  applyEffect(pet, { mood: 2 });
  saveState();
  return pet;
}

// ------------------------------------------------------------
// Real-time decay (called every UI tick)
// ------------------------------------------------------------

function tickDecay() {
  const now = Date.now();
  const minutesElapsed = (now - state.lastTickAt) / 60000;
  if (minutesElapsed < 0.05) return;  // less than 3s — skip

  for (const m of state.monsters) {
    m.hunger      = clamp(m.hunger      - CONFIG.hungerDecayPerMin      * minutesElapsed, 0, 100);
    m.cleanliness = clamp(m.cleanliness - CONFIG.cleanlinessDecayPerMin * minutesElapsed, 0, 100);
    m.energy      = clamp(m.energy      - CONFIG.energyDecayPerMin      * minutesElapsed, 0, 100);
    recomputeMood(m);
  }
  state.lastTickAt = now;
  saveState();
}

// ------------------------------------------------------------
// Shop — item purchases
// ------------------------------------------------------------

function buyItem(itemId) {
  const item = ITEM_BY_ID[itemId];
  if (!item) throw new Error('unknown item');
  const cost = {};
  if (item.priceCoins) cost.coins = item.priceCoins;
  else if (item.priceGems) cost.gems = item.priceGems;
  else throw new Error(`${item.name} not purchasable`);

  spend(cost, 'buy_' + item.id);
  state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
  saveState();
}

// ------------------------------------------------------------
// Egg gacha — with pity, predetermined-at-purchase
// ------------------------------------------------------------

function resetDailyCapIfNeeded() {
  if (state.eggPurchasesToday.date !== today()) {
    state.eggPurchasesToday = { date: today(), count: 0 };
  }
}

function canBuyMoreEggsToday() {
  resetDailyCapIfNeeded();
  return state.eggPurchasesToday.count < CONFIG.dailyEggCap;
}

function buyEgg(eggTypeId) {
  resetDailyCapIfNeeded();
  if (state.eggPurchasesToday.count >= CONFIG.dailyEggCap) {
    throw new Error(`daily egg cap reached (${CONFIG.dailyEggCap})`);
  }

  const eggType = EGG_BY_ID[eggTypeId];
  if (!eggType) throw new Error('unknown egg type');

  // Try cheapest currency that has price set
  let cost = {};
  if (eggType.priceCoins) cost = { coins: eggType.priceCoins };
  else if (eggType.priceGems) cost = { gems: eggType.priceGems };
  else if (eggType.priceStardust) cost = { stardust: eggType.priceStardust };
  else throw new Error(`${eggType.name} not for sale`);

  if (!canAfford(cost)) {
    // For dual-priced eggs, try alternate
    if (eggType.priceGems && cost.coins) {
      const alt = { gems: eggType.priceGems };
      if (canAfford(alt)) cost = alt;
      else throw new Error(`need ${eggType.priceCoins} coins or ${eggType.priceGems} gems`);
    } else {
      throw new Error('insufficient funds');
    }
  }

  spend(cost, 'egg_purchase');
  state.eggPurchasesToday.count++;

  // Roll rarity (pity-aware)
  const rolledRarity = rollRarityWithPity(eggType);

  // Pick a species from that rarity tier
  const pool = SPECIES.filter(s => s.rarity === rolledRarity && !s.isStarter);
  const fallbackPool = SPECIES.filter(s => s.rarity === rolledRarity);
  const actualPool = pool.length ? pool : fallbackPool;
  const picked = actualPool.length
    ? actualPool[Math.floor(Math.random() * actualPool.length)]
    : SPECIES.filter(s => s.rarity === 'common')[0];

  const isShiny = Math.random() < (1 / 4096);
  const egg = {
    id: uuid(),
    eggTypeId: eggType.id,
    predeterminedSpeciesId: picked.id,
    predeterminedShiny: isShiny,
    rolledRarity,
    acquiredAt: Date.now(),
    readyAt: Date.now() + eggType.hatchSeconds * 1000,
    hatchedAt: null,
  };
  state.eggs.push(egg);
  saveState();
  return egg;
}

function rollRarityWithPity(eggType) {
  const pity = state.pity[eggType.tier];
  if (!pity) throw new Error('no pity row for tier ' + eggType.tier);

  let forced = null;
  if (pity.legendary + 1 >= CONFIG.pityLegendary) forced = 'legendary';
  else if (pity.epic + 1 >= CONFIG.pityEpic)      forced = 'epic';
  else if (pity.rare + 1 >= CONFIG.pityRare)      forced = 'rare';

  let rolled;
  if (forced && eggType.dropWeights[forced]) {
    rolled = forced;
  } else {
    rolled = weightedRoll(eggType.dropWeights);
  }

  // Update counters
  const rareOrAbove      = ['rare','epic','legendary','mythic'].includes(rolled);
  const epicOrAbove      = ['epic','legendary','mythic'].includes(rolled);
  const legendaryOrAbove = ['legendary','mythic'].includes(rolled);
  pity.rare      = rareOrAbove      ? 0 : pity.rare + 1;
  pity.epic      = epicOrAbove      ? 0 : pity.epic + 1;
  pity.legendary = legendaryOrAbove ? 0 : pity.legendary + 1;

  return rolled;
}

function weightedRoll(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [k, w] of Object.entries(weights)) {
    if (r < w) return k;
    r -= w;
  }
  return Object.keys(weights)[0];
}

function hatchEgg(eggId) {
  const egg = state.eggs.find(e => e.id === eggId);
  if (!egg) throw new Error('egg not found');
  if (egg.hatchedAt) throw new Error('already hatched');
  if (Date.now() < egg.readyAt) throw new Error('egg not ready');

  const sp = species(egg.predeterminedSpeciesId);
  const monster = {
    id: uuid(),
    speciesId: sp.id,
    nickname: '',
    isStarter: false,
    isShiny: egg.predeterminedShiny,
    level: 1,
    xp: 0,
    hp: sp.baseStats.hp,
    atk: sp.baseStats.atk,
    def: sp.baseStats.def,
    spd: sp.baseStats.spd,
    intl: sp.baseStats.intl,
    hunger: 100,
    cleanliness: 100,
    energy: 100,
    mood: 80,
    createdAt: Date.now(),
  };
  state.monsters.push(monster);
  egg.hatchedAt = Date.now();
  // Remove hatched eggs after 5 seconds visually (handled in UI), but mark now
  saveState();
  return { monster, species: sp };
}

function redeemFragments() {
  if (state.player.fragments < CONFIG.fragmentsPerFreeEgg) {
    throw new Error(`need ${CONFIG.fragmentsPerFreeEgg} fragments`);
  }
  state.player.fragments -= CONFIG.fragmentsPerFreeEgg;
  const eggType = EGG_BY_ID[1];  // free Common Egg
  const rolledRarity = rollRarityWithPity(eggType);
  const pool = SPECIES.filter(s => s.rarity === rolledRarity && !s.isStarter);
  const picked = pool[Math.floor(Math.random() * pool.length)] || SPECIES[0];
  const egg = {
    id: uuid(),
    eggTypeId: eggType.id,
    predeterminedSpeciesId: picked.id,
    predeterminedShiny: false,
    rolledRarity,
    acquiredAt: Date.now(),
    readyAt: Date.now() + eggType.hatchSeconds * 1000,
    hatchedAt: null,
  };
  state.eggs.push(egg);
  saveState();
  return egg;
}

// ------------------------------------------------------------
// Battle — deterministic, mirrors server/battle-simulate
// ------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function snapshotForBattle(monster) {
  const sp = species(monster.speciesId);
  return {
    monsterId: monster.id,
    speciesId: monster.speciesId,
    name: monster.nickname || sp.name,
    emoji: sp.emoji,
    element: sp.element,
    level: monster.level,
    hp: monster.hp,
    atk: monster.atk,
    def: monster.def,
    spd: monster.spd,
    intl: monster.intl,
    currentHp: monster.hp,
  };
}

function buildNpcTeam(playerTrophies, size = 3) {
  const power = 50 + playerTrophies * 0.05;
  const candidates = SPECIES.filter(s => !s.isStarter);
  const team = [];
  for (let i = 0; i < size; i++) {
    const sp = candidates[Math.floor(Math.random() * candidates.length)];
    const lvl = clamp(Math.round(1 + power / 40 + (Math.random() - 0.5) * 2), 1, 30);
    const stats = sp.baseStats;
    team.push({
      monsterId: 'npc-' + i,
      speciesId: sp.id,
      name: sp.name,
      emoji: sp.emoji,
      element: sp.element,
      level: lvl,
      hp:   Math.floor(stats.hp   * (0.9 + lvl * 0.05)),
      atk:  Math.floor(stats.atk  * (0.9 + lvl * 0.05)),
      def:  Math.floor(stats.def  * (0.9 + lvl * 0.05)),
      spd:  Math.floor(stats.spd  * (0.9 + lvl * 0.05)),
      intl: Math.floor(stats.intl * (0.9 + lvl * 0.05)),
      currentHp: Math.floor(stats.hp * (0.9 + lvl * 0.05)),
    });
  }
  return team;
}

function computeDamage(atkr, dfdr, rng) {
  const base = (((2 * atkr.level / 5 + 2) * atkr.atk * atkr.atk / Math.max(1, dfdr.def)) / 50) + 2;
  const typeMul = TYPE_CHART[atkr.element]?.[dfdr.element] ?? 1;
  const randomFactor = 0.85 + rng() * 0.15;
  return Math.max(1, Math.floor(base * randomFactor * typeMul));
}

function simulateBattle(teamA, teamB, seed) {
  const log = [];
  const rng = mulberry32(seed);
  let aIdx = 0, bIdx = 0, turn = 0;

  while (aIdx < teamA.length && bIdx < teamB.length && turn < 50) {
    turn++;
    const a = teamA[aIdx];
    const b = teamB[bIdx];
    const aFirst = a.spd >= b.spd;
    const order = aFirst ? ['a','b'] : ['b','a'];

    for (const actor of order) {
      const atkr = actor === 'a' ? a : b;
      const dfdr = actor === 'a' ? b : a;
      if (atkr.currentHp <= 0 || dfdr.currentHp <= 0) continue;
      const dmg = computeDamage(atkr, dfdr, rng);
      dfdr.currentHp = Math.max(0, dfdr.currentHp - dmg);
      log.push({ turn, actor, attackerIdx: actor === 'a' ? aIdx : bIdx,
                 targetIdx: actor === 'a' ? bIdx : aIdx, damage: dmg,
                 attackerName: atkr.name, targetName: dfdr.name,
                 targetHpAfter: dfdr.currentHp, targetHpMax: dfdr.hp });
      if (dfdr.currentHp <= 0) {
        log.push({ turn, actor, fainted: actor === 'a' ? bIdx : aIdx,
                   targetName: dfdr.name });
        break;
      }
    }

    if (a.currentHp <= 0) aIdx++;
    if (b.currentHp <= 0) bIdx++;
  }

  const result = aIdx >= teamA.length ? 'defender_win'
               : bIdx >= teamB.length ? 'attacker_win'
               : 'draw';
  return { result, log, finalTeams: { a: teamA, b: teamB }, seed };
}

function runBattle(teamMonsterIds) {
  if (!Array.isArray(teamMonsterIds) || teamMonsterIds.length === 0 || teamMonsterIds.length > 3) {
    throw new Error('team must be 1-3 monsters');
  }
  const team = teamMonsterIds.map(id => {
    const m = state.monsters.find(x => x.id === id);
    if (!m) throw new Error('monster not found in your collection');
    return snapshotForBattle(m);
  });
  const npcTeam = buildNpcTeam(state.player.trophies, team.length);
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const sim = simulateBattle(team, npcTeam, seed);

  const won = sim.result === 'attacker_win';
  const trophyDelta = won ? CONFIG.winTrophies : CONFIG.lossTrophies;
  state.player.trophies = Math.max(0, state.player.trophies + trophyDelta);
  const coinsReward = won ? CONFIG.winCoinsPerTrophy * CONFIG.winTrophies : 0;
  const fragmentDrop = won && Math.random() < CONFIG.fragmentDropChance;

  if (coinsReward > 0) credit(coinsReward, 'coins');
  if (fragmentDrop) state.player.fragments++;

  state.battleHistory.unshift({
    at: Date.now(), won, trophyDelta, coinsReward, fragmentDrop,
    yourTeam: team.map(t => t.name).join(', '),
    npcTeam:  npcTeam.map(t => t.name).join(', '),
  });
  state.battleHistory = state.battleHistory.slice(0, 20);
  saveState();

  return { ...sim, won, trophyDelta, coinsReward, fragmentDrop, npcTeam };
}

// ------------------------------------------------------------
// Bootstrap (called from index.html)
// ------------------------------------------------------------

function bootGame() {
  const loaded = loadState();
  if (loaded) {
    state = loaded;
    // Migration: ensure newer fields exist
    if (state.player.fragments == null) state.player.fragments = 0;
    if (!state.battleHistory) state.battleHistory = [];
    tickDecay();
  }
  return state !== null;
}

// Expose for ui.js + debugging
window.game = {
  // state access
  get state() { return state; },
  species, ITEM_BY_ID, EGG_BY_ID, SPECIES, ITEMS, EGG_TYPES, RARITY, ELEMENT, CONFIG,
  // lifecycle
  bootGame, hasSave, newGame, resetGame, saveState, loadState,
  // pet
  claimStarter, getActivePet, setActivePet, useItem, sleepPet, playWithPet, petPet,
  // shop / eggs
  buyItem, buyEgg, hatchEgg, canBuyMoreEggsToday, redeemFragments,
  // battle
  runBattle,
  // tick
  tickDecay,
};
