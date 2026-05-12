// ============================================================
// tick-needs — cron edge function, runs hourly
// Decays hunger/cleanliness/energy on every active monster,
// recomputes mood, and rolls the 7-day mood window forward.
// Scheduled via Supabase cron: 0 * * * *  (every hour at :00)
// ============================================================

import { getServiceClient, jsonResponse, errorResponse } from "../_shared/supabase.ts";

// Decay rates from GDD §7
const HUNGER_DECAY_PER_HOUR     = 10;
const CLEANLINESS_DECAY_PER_HOUR = 8;
const ENERGY_DECAY_PER_HOUR     = 12;
const MOOD_HISTORY_DAYS = 7;

Deno.serve(async (req) => {
  // Cron jobs hit with X-Cron-Secret header for auth
  const secret = req.headers.get("X-Cron-Secret");
  if (secret !== Deno.env.get("CRON_SECRET")) {
    return errorResponse("unauthorized", 401);
  }

  const supabase = getServiceClient();
  const now = new Date();

  // Pull all monsters that need ticking (last_tick_at > 1 hour ago)
  const cutoff = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const { data: monsters, error } = await supabase
    .from("monsters")
    .select("id, hunger, cleanliness, energy, mood, mood_history, last_tick_at")
    .lt("last_tick_at", cutoff);

  if (error) return errorResponse(error.message, 500);
  if (!monsters?.length) return jsonResponse({ ticked: 0 });

  let ticked = 0;

  for (const m of monsters) {
    const lastTick = new Date(m.last_tick_at);
    const hoursElapsed = Math.floor(
      (now.getTime() - lastTick.getTime()) / (60 * 60 * 1000),
    );
    if (hoursElapsed < 1) continue;

    const newHunger      = Math.max(0, m.hunger      - HUNGER_DECAY_PER_HOUR      * hoursElapsed);
    const newCleanliness = Math.max(0, m.cleanliness - CLEANLINESS_DECAY_PER_HOUR * hoursElapsed);
    const newEnergy      = Math.max(0, m.energy      - ENERGY_DECAY_PER_HOUR      * hoursElapsed);

    // Mood derives from the three needs (capped 0-100)
    const newMood = Math.round((newHunger + newCleanliness + newEnergy) / 3);

    // Roll mood history forward (keep 7 days)
    const history: number[] = Array.isArray(m.mood_history) ? m.mood_history : [];
    history.push(newMood);
    while (history.length > MOOD_HISTORY_DAYS * 24) history.shift();

    await supabase
      .from("monsters")
      .update({
        hunger: newHunger,
        cleanliness: newCleanliness,
        energy: newEnergy,
        mood: newMood,
        mood_history: history,
        last_tick_at: now.toISOString(),
      })
      .eq("id", m.id);

    ticked++;
  }

  return jsonResponse({ ticked, scanned: monsters.length });
});
