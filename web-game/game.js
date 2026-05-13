// ============================================================
// game.js — core state, persistence, time decay, gacha, battle.
// All gameplay actions live here. UI rendering is in ui.js.
// State is saved to localStorage on every change.
// ============================================================

'use strict';

// ------------------------------------------------------------
// Accounts — multiple save slots stored in localStorage.
// Each account has its own "save key" so saves don't collide.
//
//   accounts list :  localStorage['smooth-giraffe-accounts']
//                    [{ id, displayName, createdAt, isAdmin }]
//   current acct  :  localStorage['smooth-giraffe-current']
//                    "<account-id>"  or absent
//   per-acct save :  localStorage['smooth-giraffe-save-v1:<account-id>']
//                    serialized game state for that account
//
// Old saves stored at the unsuffixed 'smooth-giraffe-save-v1' key
// are migrated into a default account on first boot.
// ------------------------------------------------------------

const ACCOUNTS_KEY        = 'smooth-giraffe-accounts';
const CURRENT_ACCOUNT_KEY = 'smooth-giraffe-current';
const SAVE_KEY_PREFIX     = 'smooth-giraffe-save-v1';
const LEGACY_SAVE_KEY     = 'smooth-giraffe-save-v1';      // legacy unsuffixed
let currentAccountId      = null;

function listAccounts() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveAccountsList(list) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

function getCurrentAccount() {
  if (!currentAccountId) return null;
  return listAccounts().find(a => a.id === currentAccountId) || null;
}

function setCurrentAccount(accountId) {
  currentAccountId = accountId;
  if (accountId) localStorage.setItem(CURRENT_ACCOUNT_KEY, accountId);
  else           localStorage.removeItem(CURRENT_ACCOUNT_KEY);
}

function createAccount(displayName, opts = {}) {
  displayName = (displayName || '').trim();
  if (!displayName) throw new Error('display name required');
  if (displayName.length > 20) throw new Error('display name too long (20 max)');
  const accounts = listAccounts();
  if (accounts.some(a => a.displayName.toLowerCase() === displayName.toLowerCase())) {
    throw new Error(`an account named "${displayName}" already exists in this browser`);
  }
  const acct = {
    id: uuid(),
    displayName,
    createdAt: Date.now(),
    // First-ever account is auto-admin (so you can edit your own game).
    isAdmin: opts.isAdmin ?? (accounts.length === 0),
  };
  accounts.push(acct);
  saveAccountsList(accounts);
  return acct;
}

function deleteAccount(accountId) {
  const accounts = listAccounts().filter(a => a.id !== accountId);
  saveAccountsList(accounts);
  localStorage.removeItem(saveKeyFor(accountId));
  if (currentAccountId === accountId) setCurrentAccount(null);
}

function saveKeyFor(accountId) {
  return `${SAVE_KEY_PREFIX}:${accountId}`;
}

function migrateLegacySave() {
  // If accounts list is empty AND legacy save exists, lift it into a default account.
  if (listAccounts().length > 0) return;
  const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
  if (!legacy) return;
  try {
    const parsed = JSON.parse(legacy);
    const acct = createAccount(parsed?.player?.name || 'Trainer', { isAdmin: true });
    localStorage.setItem(saveKeyFor(acct.id), legacy);
    localStorage.removeItem(LEGACY_SAVE_KEY);
    setCurrentAccount(acct.id);
  } catch (e) {
    console.error('legacy save migration failed:', e);
  }
}

// Resolve the current save key (per-account when logged in, legacy otherwise).
function getSaveKey() {
  if (!currentAccountId) currentAccountId = localStorage.getItem(CURRENT_ACCOUNT_KEY);
  return currentAccountId ? saveKeyFor(currentAccountId) : LEGACY_SAVE_KEY;
}

// Legacy constant kept for any test code referencing it.
const SAVE_KEY = LEGACY_SAVE_KEY;
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
    // Social — local-only (no backend). NPC friends auto-reply via chat.
    friends: [],                // [{ id, name, emoji, addedAt, isNpc }]
    chats: {},                  // { [friendId]: [{ from:'me'|'them', text, at }] }
    pendingNpcReplies: [],      // queue of NPC chat replies to fire on tick
    issuedHelpCodes: {},        // { [code]: { plotIndex, plotId, createdAt } } — I issued, friend redeems
    receivedHelpCodes: {},      // { [code]: { friendName, plotIndex, claimed:bool } } — friend issued, I redeem
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(getSaveKey());
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('loadState failed:', e);
    return null;
  }
}

function saveState() {
  try {
    localStorage.setItem(getSaveKey(), JSON.stringify(state));
  } catch (e) {
    console.error('saveState failed:', e);
  }
}

/** Load the save for a specific account ID (admin "view as" mode). */
function loadStateForAccount(accountId) {
  try {
    const raw = localStorage.getItem(saveKeyFor(accountId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
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
  localStorage.removeItem(getSaveKey());
  state = null;
}

/** Switch the active account. Subsequent load/save target that account's slot. */
function switchAccount(accountId) {
  const acct = listAccounts().find(a => a.id === accountId);
  if (!acct) throw new Error('account not found');
  setCurrentAccount(accountId);
  state = null;   // force a fresh load on next bootGame()
}

/** Sign out — clears the current pointer but keeps all save slots intact. */
function signOut() {
  setCurrentAccount(null);
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

// Energy cost per action type (consumed when applying item or interaction).
const ENERGY_COST = {
  pet:    1,    // free 🤚 button
  play:   8,    // free 🎾 button
  toy:    5,    // using a toy item
  food:   0,    // eating doesn't cost energy
  crop:   0,
  medicine: 2,  // bathing / soap / etc.
  evolution_stone: 0,
};

function useItem(itemId) {
  const item = ITEM_BY_ID[itemId];
  if (!item) throw new Error('unknown item');
  if ((state.inventory[itemId] || 0) < 1) throw new Error('out of ' + item.name);
  const pet = getActivePet();
  if (!pet) throw new Error('no active pet');

  // Energy gating by item type
  const energyCost = ENERGY_COST[item.type] ?? 0;
  if (energyCost > 0 && pet.energy < energyCost) {
    throw new Error(`needs ${energyCost} energy — let your pet rest`);
  }

  state.inventory[itemId]--;
  if (state.inventory[itemId] <= 0) delete state.inventory[itemId];

  applyEffect(pet, item.effect);
  if (energyCost > 0) pet.energy = Math.max(0, pet.energy - energyCost);

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

function petPet() {  // free interaction, tiny mood boost — costs 1 energy
  const pet = getActivePet();
  if (!pet) throw new Error('no active pet');
  if (pet.energy < ENERGY_COST.pet) throw new Error('needs energy — let your pet rest');
  applyEffect(pet, { mood: 2 });
  pet.energy = Math.max(0, pet.energy - ENERGY_COST.pet);
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
    // Hunger + cleanliness still decay over real time.
    m.hunger      = clamp(m.hunger      - CONFIG.hungerDecayPerMin      * minutesElapsed, 0, 100);
    m.cleanliness = clamp(m.cleanliness - CONFIG.cleanlinessDecayPerMin * minutesElapsed, 0, 100);

    // Energy:
    //   - Gains while sleeping (+1 per 10 min real time).
    //   - Does NOT decay over time when awake — only player actions
    //     (training / petting / playing / cleaning / toys) consume it.
    if (m.sleepingSince) {
      m.energy = clamp(m.energy + CONFIG.sleepEnergyGainPerMin * minutesElapsed, 0, 100);
      if (m.energy >= 100) m.sleepingSince = null;   // auto-wake at full
    }

    recomputeMood(m);
  }
  state.lastTickAt = now;
  saveState();
}

// ------------------------------------------------------------
// Shop — item purchases
// ------------------------------------------------------------

/**
 * Buy an item. If the item has prices in multiple currencies, `currency`
 * picks which one to charge. If omitted, falls back to the first set price
 * in coin → gem → stardust order (back-compat).
 */
function buyItem(itemId, currency) {
  const item = ITEM_BY_ID[itemId];
  if (!item) throw new Error('unknown item');

  const availablePrices = itemAvailablePrices(item);
  if (availablePrices.length === 0) throw new Error(`${item.name} not purchasable`);

  let chosen;
  if (currency) {
    chosen = availablePrices.find(p => p.currency === currency);
    if (!chosen) throw new Error(`${item.name} has no ${currency} price`);
  } else {
    chosen = availablePrices[0];
  }

  const cost = { [chosen.currency]: chosen.amount };
  spend(cost, 'buy_' + item.id);
  state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
  if (chosen.currency === 'coins') bumpEventQuest('spend_coins', chosen.amount);
  saveState();
}

function itemAvailablePrices(item) {
  const out = [];
  if (item.priceCoins   != null) out.push({ currency: 'coins',    amount: item.priceCoins });
  if (item.priceGems    != null) out.push({ currency: 'gems',     amount: item.priceGems });
  if (item.priceStardust!= null) out.push({ currency: 'stardust', amount: item.priceStardust });
  return out;
}

function eggAvailablePrices(egg) {
  const out = [];
  if (egg.priceCoins   != null) out.push({ currency: 'coins',    amount: egg.priceCoins });
  if (egg.priceGems    != null) out.push({ currency: 'gems',     amount: egg.priceGems });
  if (egg.priceStardust!= null) out.push({ currency: 'stardust', amount: egg.priceStardust });
  return out;
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

function buyEgg(eggTypeId, currency) {
  resetDailyCapIfNeeded();
  if (state.eggPurchasesToday.count >= CONFIG.dailyEggCap) {
    throw new Error(`daily egg cap reached (${CONFIG.dailyEggCap})`);
  }

  const eggType = EGG_BY_ID[eggTypeId];
  if (!eggType) throw new Error('unknown egg type');

  const prices = eggAvailablePrices(eggType);
  if (prices.length === 0) throw new Error(`${eggType.name} not for sale`);

  let chosen;
  if (currency) {
    chosen = prices.find(p => p.currency === currency);
    if (!chosen) throw new Error(`${eggType.name} has no ${currency} price`);
  } else {
    chosen = prices[0];
  }

  const cost = { [chosen.currency]: chosen.amount };
  spend(cost, 'egg_purchase');
  state.eggPurchasesToday.count++;
  if (chosen.currency === 'coins') bumpEventQuest('spend_coins', chosen.amount);

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

/**
 * Dice-roll battle:
 *   Each turn, the active attacker rolls 1d6.
 *   Damage = (roll × attacker.atk - defender.def), minimum 1.
 *   Type-effectiveness multiplier still applies (Fire>Grass etc.).
 *   The two teams take turns rolling; first to reach 0 HP loses.
 *   Speed decides who rolls first; ties go to the attacker.
 */
function computeDiceDamage(roll, atkr, dfdr) {
  const typeMul = TYPE_CHART[atkr.element]?.[dfdr.element] ?? 1;
  const raw = roll * atkr.atk - dfdr.def;
  return Math.max(1, Math.floor(raw * typeMul));
}

function simulateBattle(teamA, teamB, seed) {
  const log = [];
  const rng = mulberry32(seed);
  let aIdx = 0, bIdx = 0, turn = 0;
  const roll = () => 1 + Math.floor(rng() * 6);   // 1..6

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

      const r = roll();
      const dmg = computeDiceDamage(r, atkr, dfdr);
      dfdr.currentHp = Math.max(0, dfdr.currentHp - dmg);

      log.push({
        turn, actor,
        attackerIdx: actor === 'a' ? aIdx : bIdx,
        targetIdx:   actor === 'a' ? bIdx : aIdx,
        roll: r,                          // 1..6, the die face
        atk: atkr.atk,
        def: dfdr.def,
        damage: dmg,
        attackerName: atkr.name,
        attackerEmoji: atkr.emoji,
        targetName:   dfdr.name,
        targetEmoji:  dfdr.emoji,
        targetHpAfter: dfdr.currentHp,
        targetHpMax:  dfdr.hp,
      });

      if (dfdr.currentHp <= 0) {
        log.push({ turn, actor, fainted: actor === 'a' ? bIdx : aIdx,
                   targetName: dfdr.name, targetEmoji: dfdr.emoji });
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

/**
 * Cooldowns are now per-monster-per-stat:
 *   state.trainCooldowns[monsterId][stat] = unixMs when next training is allowed.
 * Older saves with the flat `state.trainCooldowns[stat]` shape are migrated
 * to the active pet's row on first boot.
 */
function startTraining(stat, monsterId) {
  const def = TRAINING_DEFS.find(d => d.stat === stat);
  if (!def) throw new Error('unknown stat');
  const pet = monsterId
    ? state.monsters.find(m => m.id === monsterId)
    : getActivePet();
  if (!pet) throw new Error('pet not found');
  if (pet.energy < TRAINING_CONFIG.energyCost) throw new Error(`needs ${TRAINING_CONFIG.energyCost} energy`);
  const cd = state.trainCooldowns?.[pet.id]?.[stat] || 0;
  if (Date.now() < cd) {
    throw new Error(`cooldown ${Math.ceil((cd - Date.now())/1000)}s left`);
  }
  return { def, pet };
}

function finishTraining(stat, taps, monsterId) {
  const pet = monsterId
    ? state.monsters.find(m => m.id === monsterId)
    : getActivePet();
  if (!pet) throw new Error('pet not found');
  let gain = 0;
  for (const t of TRAINING_CONFIG.thresholds) {
    if (taps >= t.taps) { gain = t.gain; break; }
  }
  pet[stat === 'intl' ? 'intl' : stat] += gain;
  pet.energy = Math.max(0, pet.energy - TRAINING_CONFIG.energyCost);
  state.trainCooldowns ??= {};
  state.trainCooldowns[pet.id] ??= {};
  state.trainCooldowns[pet.id][stat] = Date.now() + TRAINING_CONFIG.cooldownSeconds * 1000;
  saveState();
  return { gain, taps, pet };
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
// Friends — local list, NPC friends simulate chat + plant watering
// ------------------------------------------------------------

const NPC_REPLIES = [
  "How's your pet doing? 🐾",
  "Got any new eggs hatching?",
  "I just got a shiny! ✨",
  "Want to trade?",
  "My monster just evolved! 🎉",
  "Lol my carrot rotted 😅",
  "Need anything? I can help!",
  "Have you tried the dice battle? It's wild.",
  "Battle me sometime!",
];

function addFriend(name) {
  name = (name || '').trim();
  if (!name) throw new Error('name required');
  if (name.length > 20) throw new Error('name too long');
  state.friends ??= [];
  if (state.friends.some(f => f.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`${name} is already on your friend list`);
  }
  const emojis = ['🦊','🐯','🐰','🐻','🐼','🐨','🐸','🦄','🐲','🦁'];
  const f = {
    id: uuid(),
    name,
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    addedAt: Date.now(),
    isNpc: true,
  };
  state.friends.push(f);
  state.chats ??= {};
  state.chats[f.id] = [
    { from: 'them', text: `Hi! I'm ${name}. Glad to be your friend! ${f.emoji}`, at: Date.now() },
  ];
  saveState();
  return f;
}

function removeFriend(friendId) {
  state.friends = (state.friends || []).filter(f => f.id !== friendId);
  if (state.chats) delete state.chats[friendId];
  saveState();
}

function sendMessage(friendId, text) {
  text = (text || '').trim();
  if (!text) return;
  if (text.length > 200) throw new Error('message too long');
  state.chats ??= {};
  state.chats[friendId] ??= [];
  state.chats[friendId].push({ from: 'me', text, at: Date.now() });

  // Queue NPC reply for 2–6 seconds later
  const f = (state.friends || []).find(x => x.id === friendId);
  if (f?.isNpc) {
    const lowText = text.toLowerCase();
    let reply;
    if (/help|water|plant/.test(lowText)) {
      // Trigger an auto-water — friend will "water" the player's first growing plot
      reply = null; // handled below
    } else if (/hi|hello|hey/.test(lowText)) {
      reply = `Hey ${state.player.name}! ${f.emoji}`;
    } else if (/trade/.test(lowText)) {
      reply = `Trading isn't live yet — soon though! Wanna battle instead?`;
    } else {
      reply = NPC_REPLIES[Math.floor(Math.random() * NPC_REPLIES.length)];
    }
    const fireAt = Date.now() + 2000 + Math.random() * 4000;
    state.pendingNpcReplies ??= [];
    if (reply) {
      state.pendingNpcReplies.push({ friendId, text: reply, fireAt });
    } else {
      // Help request — schedule a water + reply
      state.pendingNpcReplies.push({ friendId, helpRequest: true, fireAt });
    }
  }
  saveState();
}

function processNpcReplies() {
  if (!state.pendingNpcReplies?.length) return false;
  const now = Date.now();
  let changed = false;
  for (let i = state.pendingNpcReplies.length - 1; i >= 0; i--) {
    const r = state.pendingNpcReplies[i];
    if (r.fireAt > now) continue;

    if (r.helpRequest) {
      // NPC tries to water the player's first growing plot
      const plot = (state.farmPlots || []).find(p => p.seedItemId && !plotIsReady(p));
      const friend = state.friends.find(f => f.id === r.friendId);
      if (plot && friend) {
        const code = generateHelpCode();
        state.receivedHelpCodes ??= {};
        state.receivedHelpCodes[code] = {
          friendName: friend.name,
          plotIndex: plot.idx,
          claimed: false,
          createdAt: now,
        };
        state.chats[r.friendId].push({
          from: 'them',
          text: `🚿 I watered your plant! Use claim code: ${code} (or tap "Claim help" in your Farm).`,
          at: now,
        });
      } else {
        state.chats[r.friendId].push({
          from: 'them',
          text: `Hmm, you don't have any plants growing right now!`,
          at: now,
        });
      }
    } else {
      state.chats[r.friendId].push({ from: 'them', text: r.text, at: now });
    }
    state.pendingNpcReplies.splice(i, 1);
    changed = true;
  }
  if (changed) saveState();
  return changed;
}

function plotIsReady(plot) {
  return plot.readyAt && Date.now() >= plot.readyAt;
}

// ------------------------------------------------------------
// Plant help — share link + claim code
// ------------------------------------------------------------

function generateHelpCode() {
  // Short, easy-to-share alphanumeric code (no ambiguous chars)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function issueHelpLinkForPlot(plotIdx) {
  const plot = (state.farmPlots || [])[plotIdx];
  if (!plot) throw new Error('plot not found');
  if (!plot.seedItemId) throw new Error('plot is empty — nothing to water');
  const code = generateHelpCode();
  state.issuedHelpCodes ??= {};
  state.issuedHelpCodes[code] = {
    plotIndex: plotIdx,
    createdAt: Date.now(),
  };
  saveState();
  const payload = btoa(JSON.stringify({
    ownerName: state.player.name,
    code,
    plotIndex: plotIdx,
  }));
  return { code, payload };
}

/** Friend's side: redeem a help payload to get a claim code to send back. */
function friendWaterPlant(payload) {
  const decoded = JSON.parse(atob(payload));
  return {
    ownerName: decoded.ownerName,
    plotIndex: decoded.plotIndex,
    claimCode: decoded.code,
  };
}

/** Player's side: paste a claim code received from a friend → -5 min. */
function claimHelpCode(code) {
  code = (code || '').toUpperCase().trim();
  if (!code) throw new Error('code required');

  // Two paths:
  //   (a) Code I issued — friend opened my link and is sending it back
  //   (b) Code my NPC friend "issued" via chat — already stored locally
  let plotIndex = null;
  let source = null;

  if (state.issuedHelpCodes?.[code]) {
    plotIndex = state.issuedHelpCodes[code].plotIndex;
    delete state.issuedHelpCodes[code];
    source = 'shared';
  } else if (state.receivedHelpCodes?.[code] && !state.receivedHelpCodes[code].claimed) {
    plotIndex = state.receivedHelpCodes[code].plotIndex;
    state.receivedHelpCodes[code].claimed = true;
    source = 'npc';
  } else {
    throw new Error('invalid or already-claimed code');
  }

  const plot = (state.farmPlots || [])[plotIndex];
  if (!plot || !plot.readyAt) throw new Error('plot has been harvested already');

  plot.readyAt -= 5 * 60 * 1000;  // -5 minutes
  // Also ensure it doesn't go negative-current — clamp to now
  if (plot.readyAt < Date.now()) plot.readyAt = Date.now();
  saveState();
  return { plotIndex, source, minutesOff: 5 };
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
    // Effect amounts (heal values). Empty string deletes the effect key.
    it.effect = it.effect || {};
    for (const k of ['hunger','cleanliness','energy','mood']) {
      if (patch[k] !== undefined) {
        if (patch[k] === '' || patch[k] === null) delete it.effect[k];
        else it.effect[k] = Number(patch[k]);
      }
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

// Admin: direct player-state edits (no overrides layer — just mutate state).
const PLAYER_FIELDS = ['name','coins','gems','stardust','tickets','trophies','fragments'];

function setPlayerField(field, value) {
  if (!PLAYER_FIELDS.includes(field)) throw new Error('bad player field');
  if (field === 'name') {
    state.player.name = String(value || 'Trainer').slice(0, 20);
  } else {
    const n = Number(value);
    state.player[field] = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }
  saveState();
}

function setInventoryQty(itemId, qty) {
  const id = Number(itemId);
  if (!ITEM_BY_ID[id]) throw new Error('unknown item');
  const n = Math.max(0, Math.floor(Number(qty) || 0));
  if (n === 0) delete state.inventory[id];
  else state.inventory[id] = n;
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
  // Run one-time migration of legacy single-save data into the first account
  migrateLegacySave();
  // Restore the current-account pointer from localStorage
  currentAccountId = localStorage.getItem(CURRENT_ACCOUNT_KEY);
  // If pointer is stale (account was deleted), drop it
  if (currentAccountId && !listAccounts().find(a => a.id === currentAccountId)) {
    setCurrentAccount(null);
  }
  // Bail early if no account selected — caller will show the login screen
  if (!currentAccountId) {
    state = null;
    return false;
  }

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
    // Migrate flat cooldowns (per-stat) to per-monster-per-stat shape
    if (!state.trainCooldowns) {
      state.trainCooldowns = {};
    } else if (state.trainCooldowns.atk !== undefined || state.trainCooldowns.def !== undefined) {
      const old = state.trainCooldowns;
      state.trainCooldowns = {};
      const active = state.activePetId;
      if (active) {
        state.trainCooldowns[active] = {
          atk: old.atk || 0, def: old.def || 0,
          spd: old.spd || 0, intl: old.intl || 0,
        };
      }
    }
    if (!state.eventProgress) state.eventProgress = {};
    if (!state.eventStats) state.eventStats = { spendCoins: 0 };
    if (!state.adminOverrides) state.adminOverrides = { species: {}, items: {}, eggs: {} };
    if (!state.friends) state.friends = [];
    if (!state.chats) state.chats = {};
    if (!state.pendingNpcReplies) state.pendingNpcReplies = [];
    if (!state.issuedHelpCodes) state.issuedHelpCodes = {};
    if (!state.receivedHelpCodes) state.receivedHelpCodes = {};
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
  // accounts (multi-save in same browser)
  listAccounts, getCurrentAccount, createAccount, deleteAccount,
  switchAccount, signOut, loadStateForAccount,
  // pet
  claimStarter, getActivePet, setActivePet, useItem, sleepPet, isSleeping, secondsToNextEnergyPoint, playWithPet, petPet,
  // shop / eggs
  buyItem, buyEgg, hatchEgg, canBuyMoreEggsToday, redeemFragments,
  itemAvailablePrices, eggAvailablePrices,
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
  setPlayerField, setInventoryQty, PLAYER_FIELDS,
  // social
  addFriend, removeFriend, sendMessage, processNpcReplies,
  // plant help
  issueHelpLinkForPlot, friendWaterPlant, claimHelpCode,
  // tick
  tickDecay,
};
