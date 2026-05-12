// ============================================================
// hatch-egg — open an egg whose timer is up
// Request:  { owned_egg_id: string }
// Response: { monster_id, species_id }
// ============================================================

import {
  getServiceClient,
  getUserId,
  jsonResponse,
  errorResponse,
  CORS_HEADERS,
} from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return errorResponse("POST only", 405);

  let userId: string;
  try { userId = await getUserId(req); }
  catch (e) { return errorResponse(String(e), 401); }

  const { owned_egg_id } = await req.json().catch(() => ({}));
  if (!owned_egg_id) return errorResponse("owned_egg_id required");

  const supabase = getServiceClient();

  // Load the egg
  const { data: egg, error: eggErr } = await supabase
    .from("owned_eggs")
    .select("*, monster_species:predetermined_species_id (id, name, base_stats, is_starter, trade_cooldown_h)")
    .eq("id", owned_egg_id)
    .eq("owner_id", userId)
    .single();
  if (eggErr || !egg) return errorResponse("egg not found");
  if (egg.hatched_at) return errorResponse("egg already hatched");

  // Server-authoritative readiness check — clock cheats blocked
  const now = new Date();
  if (new Date(egg.ready_at) > now) {
    const secondsLeft = Math.ceil((new Date(egg.ready_at).getTime() - now.getTime()) / 1000);
    return errorResponse(`egg not ready, ${secondsLeft}s left`);
  }

  const species = egg.monster_species as {
    id: number;
    name: string;
    base_stats: { hp: number; atk: number; def: number; spd: number; int: number };
    is_starter: boolean;
    trade_cooldown_h: number;
  };

  // Trade-lock the new monster per GDD rules
  const tradeLockUntil = new Date(
    now.getTime() + species.trade_cooldown_h * 60 * 60 * 1000,
  ).toISOString();

  // Create the monster
  const { data: monster, error: insertErr } = await supabase
    .from("monsters")
    .insert({
      owner_id: userId,
      species_id: species.id,
      is_starter: species.is_starter && egg.acquired_from === "starter_quest",
      is_shiny: egg.predetermined_is_shiny,
      level: 1,
      xp: 0,
      hp: species.base_stats.hp,
      atk: species.base_stats.atk,
      def: species.base_stats.def,
      spd: species.base_stats.spd,
      intl: species.base_stats.int,
      hunger: 100,
      cleanliness: 100,
      energy: 100,
      mood: 80,
      trade_locked_until: tradeLockUntil,
    })
    .select()
    .single();
  if (insertErr) return errorResponse(insertErr.message, 500);

  // Mark egg hatched
  await supabase
    .from("owned_eggs")
    .update({ hatched_at: now.toISOString() })
    .eq("id", owned_egg_id);

  return jsonResponse({
    monster_id: monster.id,
    species_id: species.id,
    species_name: species.name,
    is_shiny: egg.predetermined_is_shiny,
    trade_locked_until: tradeLockUntil,
  });
});
