// ============================================================
// data.js — read-only catalog for the browser prototype.
// Mirrors server/supabase/migrations/010_seed.sql so when the real
// backend comes online, the prototype data lines up 1:1.
// ============================================================

const RARITY = {
  common:    { label: 'Common',    color: '#9ca3af', glow: 'rgba(156,163,175,0.4)' },
  uncommon:  { label: 'Uncommon',  color: '#22c55e', glow: 'rgba(34,197,94,0.4)' },
  rare:      { label: 'Rare',      color: '#3b82f6', glow: 'rgba(59,130,246,0.5)' },
  epic:      { label: 'Epic',      color: '#a855f7', glow: 'rgba(168,85,247,0.55)' },
  legendary: { label: 'Legendary', color: '#f59e0b', glow: 'rgba(245,158,11,0.6)' },
  mythic:    { label: 'Mythic',    color: '#ec4899', glow: 'rgba(236,72,153,0.7)' },
};

const ELEMENT = {
  fire:    { label: 'Fire',    emoji: '🔥' },
  water:   { label: 'Water',   emoji: '💧' },
  grass:   { label: 'Grass',   emoji: '🌿' },
  light:   { label: 'Light',   emoji: '✨' },
  dark:    { label: 'Dark',    emoji: '🌑' },
  neutral: { label: 'Neutral', emoji: '⚪' },
};

// Rock-paper-scissors-plus matrix. Values: damage multiplier.
const TYPE_CHART = {
  fire:    { grass: 1.5, water: 0.5, fire: 1, light: 1, dark: 1, neutral: 1 },
  water:   { fire: 1.5,  grass: 0.5, water: 1, light: 1, dark: 1, neutral: 1 },
  grass:   { water: 1.5, fire: 0.5,  grass: 1, light: 1, dark: 1, neutral: 1 },
  light:   { dark: 1.5,  light: 1,   fire: 1, water: 1, grass: 1, neutral: 1 },
  dark:    { light: 1.5, dark: 1,    fire: 1, water: 1, grass: 1, neutral: 1 },
  neutral: { fire: 1, water: 1, grass: 1, light: 1, dark: 1, neutral: 1 },
};

const SPECIES = [
  // Line 1: Fire starter
  { id: 1,  name: 'Emberlet',    emoji: '🔥', rarity: 'common',   element: 'fire',  stage: 'baby',  line: 1,  baseStats: { hp: 45, atk: 55, def: 40, spd: 50, intl: 40 }, isStarter: true },
  { id: 2,  name: 'Flarepup',    emoji: '🦊', rarity: 'uncommon', element: 'fire',  stage: 'child', line: 1,  evolvesFrom: 1, baseStats: { hp: 60, atk: 70, def: 55, spd: 65, intl: 50 } },
  { id: 3,  name: 'Volcanine',   emoji: '🐉', rarity: 'rare',     element: 'fire',  stage: 'teen',  line: 1,  evolvesFrom: 2, baseStats: { hp: 80, atk: 95, def: 70, spd: 85, intl: 65 } },
  // Line 2: Water starter
  { id: 4,  name: 'Bubblet',     emoji: '💧', rarity: 'common',   element: 'water', stage: 'baby',  line: 2,  baseStats: { hp: 55, atk: 40, def: 50, spd: 45, intl: 50 }, isStarter: true },
  { id: 5,  name: 'Splashkin',   emoji: '🐬', rarity: 'uncommon', element: 'water', stage: 'child', line: 2,  evolvesFrom: 4, baseStats: { hp: 70, atk: 55, def: 65, spd: 60, intl: 65 } },
  { id: 6,  name: 'Tidewarden',  emoji: '🐋', rarity: 'rare',     element: 'water', stage: 'teen',  line: 2,  evolvesFrom: 5, baseStats: { hp: 90, atk: 70, def: 85, spd: 75, intl: 85 } },
  // Line 3: Grass starter
  { id: 7,  name: 'Seedling',    emoji: '🌱', rarity: 'common',   element: 'grass', stage: 'baby',  line: 3,  baseStats: { hp: 50, atk: 45, def: 55, spd: 40, intl: 55 }, isStarter: true },
  { id: 8,  name: 'Sproutling',  emoji: '🌿', rarity: 'uncommon', element: 'grass', stage: 'child', line: 3,  evolvesFrom: 7, baseStats: { hp: 65, atk: 60, def: 70, spd: 55, intl: 70 } },
  { id: 9,  name: 'Bloomheart',  emoji: '🌸', rarity: 'rare',     element: 'grass', stage: 'teen',  line: 3,  evolvesFrom: 8, baseStats: { hp: 85, atk: 75, def: 90, spd: 70, intl: 90 } },
  // 2-stage commons
  { id: 10, name: 'Pebbit',      emoji: '🪨', rarity: 'common',   element: 'neutral', stage: 'baby',  line: 4,  baseStats: { hp: 55, atk: 50, def: 55, spd: 40, intl: 40 } },
  { id: 11, name: 'Boulderon',   emoji: '⛰️', rarity: 'uncommon', element: 'neutral', stage: 'child', line: 4,  evolvesFrom: 10, baseStats: { hp: 75, atk: 65, def: 75, spd: 50, intl: 55 } },
  { id: 12, name: 'Glimmerlet',  emoji: '✨', rarity: 'common',   element: 'light',   stage: 'baby',  line: 5,  baseStats: { hp: 45, atk: 45, def: 45, spd: 55, intl: 55 } },
  { id: 13, name: 'Lumora',      emoji: '🌟', rarity: 'uncommon', element: 'light',   stage: 'child', line: 5,  evolvesFrom: 12, baseStats: { hp: 60, atk: 60, def: 60, spd: 70, intl: 75 } },
  { id: 14, name: 'Wispy',       emoji: '👻', rarity: 'common',   element: 'dark',    stage: 'baby',  line: 6,  baseStats: { hp: 40, atk: 50, def: 40, spd: 60, intl: 50 } },
  { id: 15, name: 'Shadewing',   emoji: '🦇', rarity: 'uncommon', element: 'dark',    stage: 'child', line: 6,  evolvesFrom: 14, baseStats: { hp: 55, atk: 70, def: 55, spd: 80, intl: 65 } },
  // Standalone commons
  { id: 16, name: 'Pinkpuff',    emoji: '🌷', rarity: 'common',   element: 'neutral', stage: 'child', line: 7,  baseStats: { hp: 50, atk: 35, def: 55, spd: 40, intl: 55 } },
  { id: 17, name: 'Mintmite',    emoji: '🍃', rarity: 'common',   element: 'grass',   stage: 'child', line: 8,  baseStats: { hp: 45, atk: 40, def: 45, spd: 60, intl: 50 } },
  { id: 18, name: 'Cocoabean',   emoji: '🫘', rarity: 'common',   element: 'neutral', stage: 'child', line: 9,  baseStats: { hp: 55, atk: 45, def: 50, spd: 45, intl: 45 } },
  { id: 19, name: 'Snowpup',     emoji: '🐶', rarity: 'common',   element: 'water',   stage: 'child', line: 10, baseStats: { hp: 50, atk: 45, def: 50, spd: 50, intl: 50 } },
  // Crystal Epic chain
  { id: 20, name: 'Crystab',     emoji: '💎', rarity: 'common', element: 'light', stage: 'baby',  line: 11, baseStats: { hp: 40, atk: 40, def: 60, spd: 40, intl: 60 } },
  { id: 21, name: 'Prismling',   emoji: '🔮', rarity: 'rare',   element: 'light', stage: 'child', line: 11, evolvesFrom: 20, baseStats: { hp: 65, atk: 65, def: 85, spd: 65, intl: 85 } },
  { id: 22, name: 'Crystadragon',emoji: '🦄', rarity: 'epic',   element: 'light', stage: 'teen',  line: 11, evolvesFrom: 21, baseStats: { hp: 95, atk: 90, def: 105, spd: 85, intl: 110 } },
  // Storm Epic chain
  { id: 23, name: 'Zaplet',      emoji: '⚡', rarity: 'common', element: 'neutral', stage: 'baby',  line: 12, baseStats: { hp: 40, atk: 55, def: 40, spd: 70, intl: 50 } },
  { id: 24, name: 'Voltspark',   emoji: '🌩️', rarity: 'rare',   element: 'neutral', stage: 'child', line: 12, evolvesFrom: 23, baseStats: { hp: 60, atk: 85, def: 60, spd: 100, intl: 75 } },
  { id: 25, name: 'Tempestor',   emoji: '🌪️', rarity: 'epic',   element: 'neutral', stage: 'teen',  line: 12, evolvesFrom: 24, baseStats: { hp: 90, atk: 110, def: 85, spd: 120, intl: 95 } },
  // More uncommons / rare
  { id: 26, name: 'Petalfox',    emoji: '🦊', rarity: 'uncommon', element: 'grass', stage: 'child', line: 13, baseStats: { hp: 60, atk: 65, def: 55, spd: 75, intl: 60 } },
  { id: 27, name: 'Aquadot',     emoji: '🐠', rarity: 'uncommon', element: 'water', stage: 'child', line: 14, baseStats: { hp: 65, atk: 50, def: 70, spd: 60, intl: 65 } },
  { id: 28, name: 'Magmite',     emoji: '🌋', rarity: 'uncommon', element: 'fire',  stage: 'child', line: 15, baseStats: { hp: 60, atk: 75, def: 60, spd: 55, intl: 55 } },
  { id: 29, name: 'Cloudkin',    emoji: '☁️', rarity: 'rare',     element: 'light', stage: 'teen',  line: 16, baseStats: { hp: 75, atk: 75, def: 75, spd: 85, intl: 90 } },
  // The launch Legendary
  { id: 30, name: 'Celestiaph',  emoji: '👑', rarity: 'legendary', element: 'light', stage: 'mega', line: 17, baseStats: { hp: 110, atk: 105, def: 110, spd: 100, intl: 120 } },
];

const EGG_TYPES = [
  {
    id: 1, name: 'Common Egg',  tier: 'common',  emoji: '🥚',
    priceCoins: 100, priceGems: null, priceStardust: null,
    hatchSeconds: 60,                       // shortened from 300 for prototype playability
    dropWeights: { common: 0.70, uncommon: 0.25, rare: 0.04, epic: 0.01 },
  },
  {
    id: 2, name: 'Rare Egg',    tier: 'rare',    emoji: '🥚',
    priceCoins: 500, priceGems: 50, priceStardust: null,
    hatchSeconds: 180,                      // shortened from 1800
    dropWeights: { uncommon: 0.50, rare: 0.35, epic: 0.12, legendary: 0.03 },
  },
  {
    id: 3, name: 'Epic Egg',    tier: 'epic',    emoji: '🥚',
    priceCoins: null, priceGems: 30, priceStardust: null,
    hatchSeconds: 300,                      // shortened from 7200
    dropWeights: { rare: 0.60, epic: 0.30, legendary: 0.10 },
  },
  {
    id: 4, name: 'Mythic Egg',  tier: 'mythic',  emoji: '🌈',
    priceCoins: null, priceGems: null, priceStardust: 100,
    hatchSeconds: 600,                      // shortened from 21600
    dropWeights: { legendary: 0.5, mythic: 0.5 },  // mythic falls back to legendary in v0.1 (no mythic species seeded)
  },
];

const ITEMS = [
  // Food
  { id: 301, name: 'Pet Kibble',    type: 'food', emoji: '🍖', priceCoins: 10,  priceGems: null, effect: { hunger: 20 } },
  { id: 302, name: 'Premium Meal',  type: 'food', emoji: '🍱', priceCoins: 50,  priceGems: 5,    effect: { hunger: 50, mood: 10 } },
  { id: 303, name: 'Birthday Cake', type: 'food', emoji: '🎂', priceCoins: null, priceGems: 30,  effect: { hunger: 100, mood: 30 } },
  // Hygiene
  { id: 401, name: 'Soap Bar',      type: 'medicine', emoji: '🧼', priceCoins: 20, priceGems: null, effect: { cleanliness: 50 } },
  { id: 402, name: 'Bubble Bath',   type: 'medicine', emoji: '🛁', priceCoins: 60, priceGems: null, effect: { cleanliness: 100, mood: 5 } },
  { id: 403, name: 'Energy Drink',  type: 'medicine', emoji: '⚡', priceCoins: 100, priceGems: 10, effect: { energy: 50 } },
  // Toys
  { id: 501, name: 'Squeaky Ball',  type: 'toy', emoji: '⚾', priceCoins: 30, priceGems: null, effect: { mood: 15 } },
  { id: 502, name: 'Plush Friend',  type: 'toy', emoji: '🧸', priceCoins: 150, priceGems: 15, effect: { mood: 25 } },
];

// Constants used by gameplay
const CONFIG = {
  // Decay rates (per minute for prototype playability — 60x faster than GDD's per-hour)
  hungerDecayPerMin:     1.0,
  cleanlinessDecayPerMin:0.8,
  energyDecayPerMin:     1.2,

  // Currency caps
  coinsCap:   999999,
  ticketsCap: 30,

  // Signup bonus
  signupCoins:   100,
  signupGems:    30,
  signupTickets: 1,

  // Pity thresholds (per egg tier)
  pityRare:      50,
  pityEpic:      100,
  pityLegendary: 200,

  // Daily egg cap (resets at local midnight)
  dailyEggCap: 10,

  // Battle rewards
  winTrophies: 20,
  lossTrophies: -10,
  winCoinsPerTrophy: 5,
  fragmentDropChance: 0.05,

  // Egg fragments
  fragmentsPerFreeEgg: 10,
};
