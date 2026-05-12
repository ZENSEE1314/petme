-- ============================================================
-- 010_seed.sql — Initial catalog data for v1.0 launch
-- 30-pet dex · 5 crop seeds · 4 egg types · sample event
-- ============================================================

-- ============================================================
-- ITEMS CATALOG (seeds + food + items)
-- ============================================================

INSERT INTO items_catalog (id, name, type, sub_type, description, price_coins, price_gems, effect, rarity) VALUES
-- Seeds (plantable)
(101, 'Carrot Seed',          'seed', 'vegetable', 'Grows into a carrot in 15 minutes.', 2,    NULL, '{"crop_item":201,"grow_seconds":900}'::jsonb,    'common'),
(102, 'Wheat Seed',           'seed', 'grain',     'Grows into wheat in 1 hour.',         5,    NULL, '{"crop_item":202,"grow_seconds":3600}'::jsonb,   'common'),
(103, 'Strawberry Seed',      'seed', 'fruit',     'Grows in 4 hours.',                   25,   NULL, '{"crop_item":203,"grow_seconds":14400}'::jsonb,  'uncommon'),
(104, 'Apple Tree Sapling',   'seed', 'tree',      'Permanent plot, harvest weekly.',     500,  NULL, '{"crop_item":204,"grow_seconds":43200,"permanent":true,"reharvest_seconds":604800}'::jsonb, 'rare'),
(105, 'Golden Mushroom Spore','seed', 'special',   'Grows in 24 hours into a rare boost.',1000, 50,   '{"crop_item":205,"grow_seconds":86400}'::jsonb,  'epic'),

-- Crops (harvested output, sellable or feedable)
(201, 'Carrot',          'crop', 'vegetable', 'Crunchy. +10 hunger.', NULL, NULL, '{"hunger":10}'::jsonb,             'common'),
(202, 'Wheat',           'crop', 'grain',     'Goes in bread.',       NULL, NULL, '{"hunger":15}'::jsonb,             'common'),
(203, 'Strawberry',      'crop', 'fruit',     '+10 hunger +5 mood.',  NULL, NULL, '{"hunger":10,"mood":5}'::jsonb,    'uncommon'),
(204, 'Apple',           'crop', 'fruit',     '+15 hunger +5 mood.',  NULL, NULL, '{"hunger":15,"mood":5}'::jsonb,    'rare'),
(205, 'Golden Mushroom', 'crop', 'special',   '+30 mood + XP boost.', NULL, NULL, '{"mood":30,"xp_boost":1.5,"xp_boost_duration":3600}'::jsonb, 'epic'),

-- Food items (shop-bought, not grown)
(301, 'Pet Kibble',     'food', 'staple', 'Basic monster food. +20 hunger.', 10, NULL, '{"hunger":20}'::jsonb, 'common'),
(302, 'Premium Meal',   'food', 'premium','+50 hunger +10 mood.',            50, 5,    '{"hunger":50,"mood":10}'::jsonb, 'uncommon'),
(303, 'Birthday Cake',  'food', 'special','+100 hunger +30 mood.',           NULL, 30, '{"hunger":100,"mood":30}'::jsonb, 'rare'),

-- Medicine
(401, 'Soap Bar',       'medicine', 'hygiene', '+50 cleanliness.',           20, NULL, '{"cleanliness":50}'::jsonb, 'common'),
(402, 'Bubble Bath',    'medicine', 'hygiene', '+100 cleanliness +5 mood.',  60, NULL, '{"cleanliness":100,"mood":5}'::jsonb, 'uncommon'),
(403, 'Energy Drink',   'medicine', 'energy',  '+50 energy (skip sleep).',  100, 10,   '{"energy":50}'::jsonb, 'rare'),

-- Toys
(501, 'Squeaky Ball',  'toy', 'classic', '+15 mood when played with.', 30,  NULL, '{"mood":15}'::jsonb, 'common'),
(502, 'Plush Friend',  'toy', 'comfort', '+25 mood, refills daily.',  150, 15,   '{"mood":25,"refresh":"daily"}'::jsonb, 'uncommon'),

-- Evolution stones
(601, 'Sun Stone',  'evolution_stone', NULL, 'Forces light-path evolution.',  NULL, 100, '{"evolution":"light"}'::jsonb, 'epic'),
(602, 'Moon Stone', 'evolution_stone', NULL, 'Forces dark-path evolution.',   NULL, 100, '{"evolution":"dark"}'::jsonb,  'epic')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- EGG TYPES (gacha catalog)
-- ============================================================

INSERT INTO egg_types (id, name, tier, description, price_coins, price_gems, price_stardust, hatch_seconds, drop_weights, daily_limit, sprite_path) VALUES
(1, 'Common Egg',  'common', 'A simple egg. Mostly common pets.',              100,  NULL, NULL, 300,    '{"common":0.70,"uncommon":0.25,"rare":0.04,"epic":0.01}'::jsonb,                  10, 'eggs/common.png'),
(2, 'Rare Egg',    'rare',   'Better odds for stronger pets.',                500,  50,   NULL, 1800,   '{"uncommon":0.50,"rare":0.35,"epic":0.12,"legendary":0.03}'::jsonb,               10, 'eggs/rare.png'),
(3, 'Epic Egg',    'epic',   'Powerful pets await.',                           NULL, 30,   NULL, 7200,   '{"rare":0.60,"epic":0.30,"legendary":0.10}'::jsonb,                                10, 'eggs/epic.png'),
(4, 'Mythic Egg',  'mythic', 'Event-only egg with the highest rarities.',     NULL, NULL, 100,  21600,  '{"legendary":0.50,"mythic":0.50}'::jsonb,                                          10, 'eggs/mythic.png'),
(5, 'Starter Egg', 'starter','Hatches one of the three elemental starters.',  NULL, NULL, NULL, 60,     '{"starter":1.0}'::jsonb,                                                           NULL, 'eggs/starter.png')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- MONSTER SPECIES — the 30-pet launch dex
-- 12 evolution lines + standalone variants
-- Distribution: 15 Common · 9 Uncommon · 4 Rare · 2 Epic · 1 Legendary (event Mythics excluded)
-- ============================================================

-- Line 1: FIRE starter (Common -> Uncommon -> Rare)
INSERT INTO monster_species (id, name, rarity, element, stage, evolution_line, evolves_from, base_stats, is_starter) VALUES
(1, 'Emberlet',  'common',   'fire', 'baby',  1, NULL, '{"hp":45,"atk":55,"def":40,"spd":50,"int":40}'::jsonb, TRUE),
(2, 'Flarepup',  'uncommon', 'fire', 'child', 1, 1,    '{"hp":60,"atk":70,"def":55,"spd":65,"int":50}'::jsonb, FALSE),
(3, 'Volcanine', 'rare',     'fire', 'teen',  1, 2,    '{"hp":80,"atk":95,"def":70,"spd":85,"int":65}'::jsonb, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Line 2: WATER starter
INSERT INTO monster_species (id, name, rarity, element, stage, evolution_line, evolves_from, base_stats, is_starter) VALUES
(4, 'Bubblet',   'common',   'water', 'baby',  2, NULL, '{"hp":55,"atk":40,"def":50,"spd":45,"int":50}'::jsonb, TRUE),
(5, 'Splashkin', 'uncommon', 'water', 'child', 2, 4,    '{"hp":70,"atk":55,"def":65,"spd":60,"int":65}'::jsonb, FALSE),
(6, 'Tidewarden','rare',     'water', 'teen',  2, 5,    '{"hp":90,"atk":70,"def":85,"spd":75,"int":85}'::jsonb, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Line 3: GRASS starter
INSERT INTO monster_species (id, name, rarity, element, stage, evolution_line, evolves_from, base_stats, is_starter) VALUES
(7, 'Seedling',  'common',   'grass', 'baby',  3, NULL, '{"hp":50,"atk":45,"def":55,"spd":40,"int":55}'::jsonb, TRUE),
(8, 'Sproutling','uncommon', 'grass', 'child', 3, 7,    '{"hp":65,"atk":60,"def":70,"spd":55,"int":70}'::jsonb, FALSE),
(9, 'Bloomheart','rare',     'grass', 'teen',  3, 8,    '{"hp":85,"atk":75,"def":90,"spd":70,"int":90}'::jsonb, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Line 4-6: 2-stage common lines (no evolution branching, just baby->child)
INSERT INTO monster_species (id, name, rarity, element, stage, evolution_line, evolves_from, base_stats) VALUES
(10, 'Pebbit',  'common',   'neutral', 'baby',  4, NULL, '{"hp":55,"atk":50,"def":55,"spd":40,"int":40}'::jsonb),
(11, 'Boulderon','uncommon','neutral', 'child', 4, 10,   '{"hp":75,"atk":65,"def":75,"spd":50,"int":55}'::jsonb),

(12, 'Glimmerlet','common', 'light',   'baby',  5, NULL, '{"hp":45,"atk":45,"def":45,"spd":55,"int":55}'::jsonb),
(13, 'Lumora',   'uncommon','light',   'child', 5, 12,   '{"hp":60,"atk":60,"def":60,"spd":70,"int":75}'::jsonb),

(14, 'Wispy',    'common',  'dark',    'baby',  6, NULL, '{"hp":40,"atk":50,"def":40,"spd":60,"int":50}'::jsonb),
(15, 'Shadewing','uncommon','dark',    'child', 6, 14,   '{"hp":55,"atk":70,"def":55,"spd":80,"int":65}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Lines 7-10: standalone Commons (1-stage cute pets that don't evolve)
INSERT INTO monster_species (id, name, rarity, element, stage, evolution_line, base_stats) VALUES
(16, 'Pinkpuff', 'common', 'neutral', 'child', 7,  '{"hp":50,"atk":35,"def":55,"spd":40,"int":55}'::jsonb),
(17, 'Mintmite', 'common', 'grass',   'child', 8,  '{"hp":45,"atk":40,"def":45,"spd":60,"int":50}'::jsonb),
(18, 'Cocoabean','common', 'neutral', 'child', 9,  '{"hp":55,"atk":45,"def":50,"spd":45,"int":45}'::jsonb),
(19, 'Snowpup',  'common', 'water',   'child', 10, '{"hp":50,"atk":45,"def":50,"spd":50,"int":50}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Lines 11-12: 3-stage Epic chains
-- Crystal line (common -> rare -> epic)
INSERT INTO monster_species (id, name, rarity, element, stage, evolution_line, evolves_from, base_stats) VALUES
(20, 'Crystab',   'common','light',  'baby', 11, NULL, '{"hp":40,"atk":40,"def":60,"spd":40,"int":60}'::jsonb),
(21, 'Prismling','rare',   'light',  'child',11, 20,   '{"hp":65,"atk":65,"def":85,"spd":65,"int":85}'::jsonb),
(22, 'Crystadragon','epic','light',  'teen', 11, 21,   '{"hp":95,"atk":90,"def":105,"spd":85,"int":110}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Storm line
INSERT INTO monster_species (id, name, rarity, element, stage, evolution_line, evolves_from, base_stats) VALUES
(23, 'Zaplet',  'common', 'neutral', 'baby', 12, NULL, '{"hp":40,"atk":55,"def":40,"spd":70,"int":50}'::jsonb),
(24, 'Voltspark','rare',  'neutral', 'child',12, 23,   '{"hp":60,"atk":85,"def":60,"spd":100,"int":75}'::jsonb),
(25, 'Tempestor','epic',  'neutral', 'teen', 12, 24,   '{"hp":90,"atk":110,"def":85,"spd":120,"int":95}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Extra commons to fill out the dex
INSERT INTO monster_species (id, name, rarity, element, stage, evolution_line, base_stats) VALUES
(26, 'Petalfox','uncommon','grass', 'child', 13, '{"hp":60,"atk":65,"def":55,"spd":75,"int":60}'::jsonb),
(27, 'Aquadot', 'uncommon','water', 'child', 14, '{"hp":65,"atk":50,"def":70,"spd":60,"int":65}'::jsonb),
(28, 'Magmite', 'uncommon','fire',  'child', 15, '{"hp":60,"atk":75,"def":60,"spd":55,"int":55}'::jsonb),
(29, 'Cloudkin','rare',    'light', 'teen',  16, '{"hp":75,"atk":75,"def":75,"spd":85,"int":90}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- The launch Legendary (1 of 30)
INSERT INTO monster_species (id, name, rarity, element, stage, evolution_line, base_stats, trade_cooldown_h) VALUES
(30, 'Celestiaph', 'legendary', 'light', 'mega', 17, '{"hp":110,"atk":105,"def":110,"spd":100,"int":120}'::jsonb, 168)
ON CONFLICT (id) DO NOTHING;
