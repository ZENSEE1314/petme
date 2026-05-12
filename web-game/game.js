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

// Frozen defaults — captured at module load. Used by resetAdminOverrides()
// to restore SPECIES/ITEMS/EGG_TYPES in-place (the *_BY_ID maps keep
// pointing at the same objects, so they update automatically).
const DEFAULTS = {
  species: JSON.parse(JSON.stringify(SPECIES)),
  items:   JSON.parse(JSON.stringify(ITEMS)),
  eggs:    JSON.parse(JSON.stringify(EGG_TYPES)),
};

// ------------------------------------------------------------
// State
// ------------------------------------------------------------

let state = null;

function defaultState() {
  return {
    schemaVersion: 2,
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
      101: 5,  // 5 free Carrot Seeds — bootstrap farm
      102: 2,  // 2 free Wheat Seeds
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
    // Farm
    farmPlots: Array.from({ length: 9 }, (_, i) => ({
      idx: i,
      seedItemId: null,
      plantedAt: null,
      readyAt: null,
      wateredAt: null,
      isPermanent: false,
      reharvestSeconds: 0,
    })),
    // Training
    trainCooldowns: { atk: 0, def: 0, spd: 0, intl: 0 },
    // Events
    eventProgress: {},   // { [eventId]: { [questId]: count, claimed: bool } }
    eventStats: { spendCoins: 0 },  // session-wide stat trackers for event quests
    // Admin overrides — { species: {[id]: {...patch}}, items: {...}, eggs: {...} }
    adminOverrides: { species: {}, items: {}, eggs: {} },
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

/**
 * Toggle sleep on/off for the active pet.
 * - When asleep, the per-tick energy decay reverses to a +0.1/min gain
 *   (= +1 every 10 real-world minutes), tracked via `sleepingSince`.
 * - Hunger and cleanliness still decay as normal (pet still ages).
 * - Auto-wakes at energy == 100.
 */
function sleepPet() {
  const pet = getActivePet();
  if (!pet) throw new Error('no active pet');
  if (pet.sleepingSince) {
    pet.sleepingSince = null;        // wake up
  } else {
    pet.sleepingSince = Date.now();  // fall asleep
  }
  saveState();
  return pet;
}

function isSleeping(pet) {
  return !!pet?.sleepingSince;
}

/**
 * Seconds until the pet earns its next whole +1 energy point.
 * Returns 0 if not sleeping or already at max.
 */
function secondsToNextEnergyPoint(pet) {
  if (!pet?.sleepingSince || pet.energy >= 100) return 0;
  const fraction = pet.energy - Math.floor(pet.energy);
  const energyNeeded = 1 - fraction;
  // +0.1 / min  =>  seconds = (energyNeeded / 0.1) * 60
  return Math.max(0, Math.ceil((energyNeeded / CONFIG.sleepEnergyGainPerMin) * 60));
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
  if (minutesElapsed < 0.01) return;   // <0.6s — skip

  for (const m of state.monsters) {
    // Hunger + cleanliness always decay (pet ages whether awake or asleep)
    m.hunger      = clamp(m.hunger      - CONFIG.hungerDecayPerMin      * minutesElapsed, 0, 100);
    m.cleanliness = clamp(m.cleanliness - CONFIG.cleanlinessDecayPerMin * minutesElapsed, 0, 100);

    // Energy: gain while sleeping, decay while awake
    if (m.sleepingSince) {
      m.energy = clamp(m.energy + CONFIG.sleepEnergyGainPerMin * minutesElapsed, 0, 100);
      if (m.energy >= 100) m.sleepingSince = null;   // auto-wake at full
    } else {
      m.energy = clamp(m.energy - CONFIG.energyDecayPerMin * minutesElapsed, 0, 100);
    }

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
  if (cost.coins) bumpEventQuest('spend_coins', cost.coins);
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
  if (cost.coins) bumpEventQuest('spend_coins', cost.coins);

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
  bumpEventQuest('hatch_eggs', 1);
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
  if (won) bumpEventQuest('win_battles', 1);
  saveState();

  return { ...sim, won, trophyDelta, coinsReward, fragmentDrop, npcTeam };
}

// ------------------------------------------------------------
// Farm — plant, water, harvest. Real-time, clock-driven.
// ------------------------------------------------------------

function plantSeed(plotIdx, seedItemId) {
  const plot = state.farmPlots[plotIdx];
  if (!plot) throw new Error('plot not found');
  if (plot.seedItemId) throw new Error('plot occupied');
  if ((state.inventory[seedItemId] || 0) < 1) throw new Error('out of seeds');
  const seed = ITEM_BY_ID[seedItemId];
  if (!seed || seed.type !== 'seed') throw new Error('not a seed');

  state.inventory[seedItemId]--;
  if (state.inventory[seedItemId] <= 0) delete state.inventory[seedItemId];

  const eff = seed.effect;
  plot.seedItemId = seedItemId;
  plot.plantedAt = Date.now();
  plot.readyAt = Date.now() + eff.grow_seconds * 1000;
  plot.wateredAt = null;
  plot.isPermanent = !!eff.permanent;
  plot.reharvestSeconds = eff.reharvest_seconds || 0;
  saveState();
  return plot;
}

function waterPlot(plotIdx) {
  const plot = state.farmPlots[plotIdx];
  if (!plot) throw new Error('plot not found');
  if (!plot.seedItemId) throw new Error('nothing to water');
  if (plot.wateredAt) throw new Error('already watered this cycle');
  plot.wateredAt = Date.now();
  // Water also speeds growth by 10% of remaining time
  const remaining = Math.max(0, plot.readyAt - Date.now());
  plot.readyAt = Date.now() + Math.floor(remaining * 0.9);
  saveState();
  return plot;
}

function harvestPlot(plotIdx) {
  const plot = state.farmPlots[plotIdx];
  if (!plot) throw new Error('plot not found');
  if (!plot.seedItemId) throw new Error('plot is empty');
  if (Date.now() < plot.readyAt) throw new Error('not ready');

  const seed = ITEM_BY_ID[plot.seedItemId];
  const cropItemId = seed.effect.crop_item;
  const baseYield = 1;
  const wateredBonus = plot.wateredAt ? 1 : 0;
  const totalYield = baseYield + wateredBonus;

  state.inventory[cropItemId] = (state.inventory[cropItemId] || 0) + totalYield;

  if (plot.isPermanent) {
    plot.readyAt = Date.now() + plot.reharvestSeconds * 1000;
    plot.wateredAt = null;
  } else {
    plot.seedItemId = null;
    plot.plantedAt = null;
    plot.readyAt = null;
    plot.wateredAt = null;
    plot.isPermanent = false;
    plot.reharvestSeconds = 0;
  }
  saveState();
  return { cropItemId, qty: totalYield };
}

function sellCrop(itemId, qty) {
  const item = ITEM_BY_ID[itemId];
  if (!item || item.type !== 'crop') throw new Error('not a crop');
  if ((state.inventory[itemId] || 0) < qty) throw new Error('not enough');
  // Sell price = 5x seed price approx, hard-coded here
  const sellPrices = { 201: 5, 202: 25, 203: 80, 204: 200, 205: 600 };
  const price = (sellPrices[itemId] || 5) * qty;
  state.inventory[itemId] -= qty;
  if (state.inventory[itemId] <= 0) delete state.inventory[itemId];
  credit(price, 'coins');
  saveState();
  return price;
}

// ------------------------------------------------------------
// Training — click-spam mini-game per stat
// ------------------------------------------------------------

function startTraining(stat) {
  const def = TRAINING_DEFS.find(d => d.stat === stat);
  if (!def) throw new Error('unknown stat');
  const pet = getActivePet();
  if (!pet) throw new Error('no active pet');
  if (pet.energy < TRAINING_CONFIG.energyCost) throw new Error(`needs ${TRAINING_CONFIG.energyCost} energy`);
  const cd = state.trainCooldowns[stat] || 0;
  if (Date.now() < cd) {
    throw new Error(`cooldown ${Math.ceil((cd - Date.now())/1000)}s left`);
  }
  return def;
}

function finishTraining(stat, taps) {
  const pet = getActivePet();
  if (!pet) throw new Error('no active pet');
  let gain = 0;
  for (const t of TRAINING_CONFIG.thresholds) {
    if (taps >= t.taps) { gain = t.gain; break; }
  }
  pet[stat === 'intl' ? 'intl' : stat] += gain;
  pet.energy = Math.max(0, pet.energy - TRAINING_CONFIG.energyCost);
  state.trainCooldowns[stat] = Date.now() + TRAINING_CONFIG.cooldownSeconds * 1000;
  saveState();
  return { gain, taps };
}

// ------------------------------------------------------------
// Events — quest tracking
// ------------------------------------------------------------

function getActiveEvent() {
  const now = Date.now();
  return EVENTS.find(e => now >= e.startAt && now <= e.endAt) || null;
}

function eventProgress(eventId, questId) {
  return state.eventProgress[eventId]?.[questId] || 0;
}

function bumpEventQuest(type, amount = 1) {
  const event = getActiveEvent();
  if (!event) return;
  for (const quest of event.quests) {
    if (quest.type !== type) continue;
    state.eventProgress[event.id] ??= {};
    state.eventProgress[event.id][quest.id] = (state.eventProgress[event.id][quest.id] || 0) + amount;
  }
}

function claimEventQuest(questId) {
  const event = getActiveEvent();
  if (!event) throw new Error('no active event');
  const quest = event.quests.find(q => q.id === questId);
  if (!quest) throw new Error('quest not found');
  const progress = eventProgress(event.id, questId);
  if (progress < quest.goal) throw new Error('not yet complete');
  state.eventProgress[event.id] ??= {};
  if (state.eventProgress[event.id][questId + '_claimed']) throw new Error('already claimed');

  const r = quest.reward;
  if (r.coins)     credit(r.coins,    'coins');
  if (r.gems)      credit(r.gems,     'gems');
  if (r.stardust)  credit(r.stardust, 'stardust');
  if (r.tickets)   credit(r.tickets,  'tickets');
  if (r.fragments) state.player.fragments += r.fragments;

  state.eventProgress[event.id][questId + '_claimed'] = true;
  saveState();
  return r;
}

function claimEventFinalReward() {
  const event = getActiveEvent();
  if (!event) throw new Error('no active event');
  const allDone = event.quests.every(q =>
    eventProgress(event.id, q.id) >= q.goal
  );
  if (!allDone) throw new Error('finish all quests first');
  if (state.eventProgress[event.id]?.finalClaimed) throw new Error('already claimed');

  const r = event.finalReward;
  if (r.stardust) credit(r.stardust, 'stardust');
  if (r.mythicEgg) {
    // Give them a Mythic Egg
    const mythicType = EGG_BY_ID[4];
    // Mythic egg drop weights only allow legendary in v0.1 (no mythic species seeded)
    const rolledRarity = 'legendary';
    const pool = SPECIES.filter(s => s.rarity === rolledRarity && !s.isStarter);
    const picked = pool[Math.floor(Math.random() * pool.length)] || SPECIES.find(s => s.id === 30);
    state.eggs.push({
      id: uuid(),
      eggTypeId: mythicType.id,
      predeterminedSpeciesId: picked.id,
      predeterminedShiny: Math.random() < (1 / 1024),  // boosted shiny for event egg
      rolledRarity,
      acquiredAt: Date.now(),
      readyAt: Date.now() + 30000,  // 30s for prototype
      hatchedAt: null,
    });
  }
  state.eventProgress[event.id] ??= {};
  state.eventProgress[event.id].finalClaimed = true;
  saveState();
  return r;
}

// ------------------------------------------------------------
// Admin overrides — edit any catalog value at runtime.
// ------------------------------------------------------------

/**
 * Apply currently-stored overrides to the live SPECIES / ITEMS / EGG_TYPES
 * arrays. The *_BY_ID maps update automatically because they share object
 * references with the arrays.
 */
function applyAdminOverrides() {
  const ov = state.adminOverrides || { species: {}, items: {}, eggs: {} };

  for (const [idStr, patch] of Object.entries(ov.species || {})) {
    const sp = SPECIES.find(s => s.id === Number(idStr));
    if (!sp) continue;
    if (patch.name)  sp.name  = patch.name;
    if (patch.emoji) sp.emoji = patch.emoji;
    if (patch.rarity && RARITY[patch.rarity]) sp.rarity = patch.rarity;
    sp.baseStats = sp.baseStats || {};
    for (const k of ['hp','atk','def','spd','intl']) {
      if (patch[k] !== undefined && patch[k] !== '') sp.baseStats[k] = Number(patch[k]);
    }
  }

  for (const [idStr, patch] of Object.entries(ov.items || {})) {
    const it = ITEMS.find(i => i.id === Number(idStr));
    if (!it) continue;
    if (patch.name)  it.name  = patch.name;
    if (patch.emoji) it.emoji = patch.emoji;
    for (const k of ['priceCoins','priceGems','priceStardust']) {
      if (patch[k] !== undefined) it[k] = patch[k] === '' || patch[k] === null ? null : Number(patch[k]);
    }
    if (it.effect && patch.growSeconds !== undefined && patch.growSeconds !== '') {
      it.effect.grow_seconds = Number(patch.growSeconds);
    }
  }

  for (const [idStr, patch] of Object.entries(ov.eggs || {})) {
    const e = EGG_TYPES.find(x => x.id === Number(idStr));
    if (!e) continue;
    if (patch.name)  e.name = patch.name;
    if (patch.emoji) e.emoji = patch.emoji;
    for (const k of ['priceCoins','priceGems','priceStardust']) {
      if (patch[k] !== undefined) e[k] = patch[k] === '' || patch[k] === null ? null : Number(patch[k]);
    }
    if (patch.hatchSeconds !== undefined && patch.hatchSeconds !== '') {
      e.hatchSeconds = Number(patch.hatchSeconds);
    }
  }
}

/** Patch a single record. Persists to state.adminOverrides and re-applies. */
function setAdminOverride(category, id, patch) {
  if (!['species','items','eggs'].includes(category)) throw new Error('bad category');
  state.adminOverrides ??= { species: {}, items: {}, eggs: {} };
  state.adminOverrides[category][id] ??= {};
  Object.assign(state.adminOverrides[category][id], patch);
  applyAdminOverrides();
  saveState();
}

/** Restore everything to data.js defaults, discard overrides. */
function resetAdminOverrides() {
  // Reset live arrays in-place so existing *_BY_ID maps stay valid
  for (let i = 0; i < SPECIES.length; i++) {
    const fresh = JSON.parse(JSON.stringify(DEFAULTS.species[i]));
    Object.keys(SPECIES[i]).forEach(k => delete SPECIES[i][k]);
    Object.assign(SPECIES[i], fresh);
  }
  for (let i = 0; i < ITEMS.length; i++) {
    const fresh = JSON.parse(JSON.stringify(DEFAULTS.items[i]));
    Object.keys(ITEMS[i]).forEach(k => delete ITEMS[i][k]);
    Object.assign(ITEMS[i], fresh);
  }
  for (let i = 0; i < EGG_TYPES.length; i++) {
    const fresh = JSON.parse(JSON.stringify(DEFAULTS.eggs[i]));
    Object.keys(EGG_TYPES[i]).forEach(k => delete EGG_TYPES[i][k]);
    Object.assign(EGG_TYPES[i], fresh);
  }
  state.adminOverrides = { species: {}, items: {}, eggs: {} };
  saveState();
}

// ------------------------------------------------------------
// Bootstrap (called from index.html)
// ------------------------------------------------------------

function bootGame() {
  const loaded = loadState();
  if (loaded) {
    state = loaded;
    // Migrations from v1 → v2 (farm + training + events)
    if (state.player.fragments == null) state.player.fragments = 0;
    if (!state.battleHistory) state.battleHistory = [];
    if (!state.farmPlots) {
      state.farmPlots = Array.from({ length: 9 }, (_, i) => ({
        idx: i, seedItemId: null, plantedAt: null, readyAt: null,
        wateredAt: null, isPermanent: false, reharvestSeconds: 0,
      }));
    }
    if (!state.trainCooldowns) state.trainCooldowns = { atk: 0, def: 0, spd: 0, intl: 0 };
    if (!state.eventProgress) state.eventProgress = {};
    if (!state.eventStats) state.eventStats = { spendCoins: 0 };
    if (!state.adminOverrides) state.adminOverrides = { species: {}, items: {}, eggs: {} };
    state.schemaVersion = 2;
    applyAdminOverrides();
    tickDecay();
  }
  return state !== null;
}

// Expose for ui.js + debugging
window.game = {
  // state access
  get state() { return state; },
  species, ITEM_BY_ID, EGG_BY_ID, SPECIES, ITEMS, EGG_TYPES, RARITY, ELEMENT, CONFIG,
  TRAINING_DEFS, TRAINING_CONFIG, EVENTS,
  // lifecycle
  bootGame, hasSave, newGame, resetGame, saveState, loadState,
  // pet
  claimStarter, getActivePet, setActivePet, useItem, sleepPet, isSleeping, secondsToNextEnergyPoint, playWithPet, petPet,
  // shop / eggs
  buyItem, buyEgg, hatchEgg, canBuyMoreEggsToday, redeemFragments,
  // battle
  runBattle,
  // farm
  plantSeed, waterPlot, harvestPlot, sellCrop,
  // training
  startTraining, finishTraining,
  // events
  getActiveEvent, eventProgress, claimEventQuest, claimEventFinalReward,
  // admin
  applyAdminOverrides, setAdminOverride, resetAdminOverrides,
  // tick
  tickDecay,
};
