// ============================================================
// claim-starter — give a new player their chosen starter monster.
//
// Rules:
// - User must have zero monsters already.
// - Chosen species must be a starter (is_starter = TRUE).
// - The created monster is flagged is_starter (untradable forever)
//   and gets a 50-coin + 1-ticket signup bonus to bootstrap them.
//
// Request:  { species_id: number }   // 1 (Emberlet) | 4 (Bubblet) | 7 (Seedling)
// Response: { monster_id, species_id, species_name }
// ============================================================

import {
  getServiceClient,
  getUserId,
  jsonResponse,
  errorResponse,
  CORS_HEADERS,
} from "../_shared/supabase.ts";

const SIGNUP_BONUS_COINS = 50;
const SIGNUP_BONUS_TICKETS = 1;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return errorResponse("POST only", 405);

  let userId: string;
  try { userId = await getUserId(req); }
  catch (e) { return errorResponse(String(e), 401); }

  const { species_id } = await req.json().catch(() => ({}));
  if (!species_id || typeof species_id !== "number") {
    return errorResponse("species_id required");
  }

  const supabase = getServiceClient();

  // 1. Ensure user has no monsters yet
  const { count: existingCount } = await supabase
    .from("monsters")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);
  if ((existingCount ?? 0) > 0) {
    return errorResponse("you already have a starter", 409);
  }

  // 2. Validate species is a starter
  const { data: species, error: spErr } = await supabase
    .from("monster_species")
    .select("id, name, base_stats, is_starter, trade_cooldown_h")
    .eq("id", species_id)
    .single();
  if (spErr || !species) return errorResponse("unknown species");
  if (!species.is_starter) return errorResponse("not a starter species");

  // 3. Create the monster
  const stats = species.base_stats as { hp: number; atk: number; def: number; spd: number; int: number };
  const { data: monster, error: insertErr } = await supabase
    .from("monsters")
    .insert({
      owner_id: userId,
      species_id: species.id,
      is_starter: true,           // permanent flag — never tradable
      level: 1,
      xp: 0,
      hp: stats.hp,
      atk: stats.atk,
      def: stats.def,
      spd: stats.spd,
      intl: stats.int,
      hunger: 100,
      cleanliness: 100,
      energy: 100,
      mood: 90,                   // a happy starter
    })
    .select("id, species_id")
    .single();
  if (insertErr || !monster) return errorResponse(insertErr?.message ?? "create failed", 500);

  // 4. Signup bonus — coins + 1 trade ticket
  await supabase.from("currency_ledger").insert([
    { user_id: userId, currency: "coins",   delta: SIGNUP_BONUS_COINS,  reason: "signup_bonus", ref_id: monster.id },
    { user_id: userId, currency: "tickets", delta: SIGNUP_BONUS_TICKETS, reason: "signup_bonus", ref_id: monster.id },
  ]);

  return jsonResponse({
    monster_id: monster.id,
    species_id: species.id,
    species_name: species.name,
  });
});
