// ============================================================
// buy-egg — purchase an egg from the shop, roll its contents
// server-authoritatively, charge currency, log everything.
//
// IMPORTANT design rule: the species in the egg is determined
// HERE (at purchase), not later at hatch. This is auditable,
// preventable from client-side reroll cheats, and makes drop
// rates legally verifiable.
//
// Request:  { egg_type_id: number }
// Response: { owned_egg_id, species_id (revealed), ready_at }
// ============================================================

import {
  getServiceClient,
  getUserId,
  jsonResponse,
  errorResponse,
  CORS_HEADERS,
} from "../_shared/supabase.ts";

const DAILY_EGG_PURCHASE_CAP = 10;
const PITY_RARE_PULLS = 50;
const PITY_EPIC_PULLS = 100;
const PITY_LEGENDARY_PULLS = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return errorResponse("POST only", 405);

  let userId: string;
  try { userId = await getUserId(req); }
  catch (e) { return errorResponse(String(e), 401); }

  const { egg_type_id } = await req.json().catch(() => ({}));
  if (!egg_type_id || typeof egg_type_id !== "number") {
    return errorResponse("egg_type_id required");
  }

  const supabase = getServiceClient();

  // 1. Load the egg type
  const { data: eggType, error: eggErr } = await supabase
    .from("egg_types")
    .select("*")
    .eq("id", egg_type_id)
    .single();
  if (eggErr || !eggType) return errorResponse("unknown egg type");
  if (!eggType.is_available) return errorResponse("egg not currently available");

  // 2. Daily purchase cap
  const today = new Date().toISOString().slice(0, 10);
  const { data: dailyLog } = await supabase
    .from("daily_purchase_log")
    .select("egg_count")
    .eq("user_id", userId)
    .eq("purchase_day", today)
    .maybeSingle();

  const eggsToday = dailyLog?.egg_count ?? 0;
  if (eggsToday >= DAILY_EGG_PURCHASE_CAP) {
    return errorResponse(`daily egg cap reached (${DAILY_EGG_PURCHASE_CAP})`, 429);
  }

  // 3. Charge currency (negative ledger insert; trigger enforces balance)
  const charges: Array<{ currency: string; amount: number }> = [];
  if (eggType.price_coins)    charges.push({ currency: "coins",    amount: eggType.price_coins });
  if (eggType.price_gems)     charges.push({ currency: "gems",     amount: eggType.price_gems });
  if (eggType.price_stardust) charges.push({ currency: "stardust", amount: eggType.price_stardust });

  if (charges.length === 0) {
    return errorResponse("egg has no purchase price (event-only?)");
  }

  for (const c of charges) {
    const { error: ledgerErr } = await supabase
      .from("currency_ledger")
      .insert({
        user_id: userId,
        currency: c.currency,
        delta: -c.amount,
        reason: "egg_purchase",
        ref_id: `egg_type:${egg_type_id}`,
      });
    if (ledgerErr) return errorResponse(`insufficient ${c.currency}: ${ledgerErr.message}`, 402);
  }

  // 4. Roll rarity (with pity)
  const rarity = await rollRarityWithPity(supabase, userId, eggType);

  // 5. Pick species from that rarity tier
  const { data: pool } = await supabase
    .from("monster_species")
    .select("id")
    .eq("rarity", rarity)
    .eq("is_event_only", eggType.tier === "mythic");
  if (!pool?.length) return errorResponse(`no species available for rarity ${rarity}`, 500);
  const picked = pool[Math.floor(Math.random() * pool.length)];

  // 6. Shiny roll (1/4096 — v1.1+ but we record it now)
  const isShiny = Math.random() < (1 / 4096);

  // 7. Create owned_egg with hatch timer
  const readyAt = new Date(Date.now() + eggType.hatch_seconds * 1000).toISOString();
  const { data: newEgg, error: insertErr } = await supabase
    .from("owned_eggs")
    .insert({
      owner_id: userId,
      egg_type_id: egg_type_id,
      predetermined_species_id: picked.id,
      predetermined_is_shiny: isShiny,
      ready_at: readyAt,
      acquired_from: "shop",
    })
    .select()
    .single();
  if (insertErr) return errorResponse(insertErr.message, 500);

  // 8. Increment daily purchase log
  await supabase.from("daily_purchase_log").upsert({
    user_id: userId,
    purchase_day: today,
    egg_count: eggsToday + 1,
  });

  return jsonResponse({
    owned_egg_id: newEgg.id,
    species_id: picked.id,
    is_shiny: isShiny,
    rarity,
    ready_at: readyAt,
  });
});

// ----------------------------------------------------------
// Pity-aware rarity roll
// ----------------------------------------------------------
async function rollRarityWithPity(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  eggType: { id: number; tier: string; drop_weights: Record<string, number> },
): Promise<string> {
  // Load pity for this egg tier
  const { data: pity } = await supabase
    .from("pity_counters")
    .select("*")
    .eq("user_id", userId)
    .eq("egg_tier", eggType.tier)
    .maybeSingle();

  const rare = pity?.pulls_since_rare ?? 0;
  const epic = pity?.pulls_since_epic ?? 0;
  const legendary = pity?.pulls_since_legendary ?? 0;

  // Force guarantees
  let forced: string | null = null;
  if (legendary + 1 >= PITY_LEGENDARY_PULLS) forced = "legendary";
  else if (epic + 1 >= PITY_EPIC_PULLS)      forced = "epic";
  else if (rare + 1 >= PITY_RARE_PULLS)      forced = "rare";

  let rolledRarity: string;
  if (forced && eggType.drop_weights[forced]) {
    rolledRarity = forced;
  } else {
    rolledRarity = weightedRoll(eggType.drop_weights);
  }

  // Update pity counters
  const newCounters = {
    user_id: userId,
    egg_tier: eggType.tier,
    pulls_since_rare:      ["rare","epic","legendary","mythic"].includes(rolledRarity) ? 0 : rare + 1,
    pulls_since_epic:      ["epic","legendary","mythic"].includes(rolledRarity)        ? 0 : epic + 1,
    pulls_since_legendary: ["legendary","mythic"].includes(rolledRarity)               ? 0 : legendary + 1,
    updated_at: new Date().toISOString(),
  };
  await supabase.from("pity_counters").upsert(newCounters);

  return rolledRarity;
}

function weightedRoll(weights: Record<string, number>): string {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [k, w] of Object.entries(weights)) {
    if (r < w) return k;
    r -= w;
  }
  return Object.keys(weights)[0];
}
