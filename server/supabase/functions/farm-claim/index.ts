// ============================================================
// farm-claim — harvest a ready plot, credit crop to inventory.
// Server-authoritative timer: change-device-clock cheats blocked.
//
// Request:  { plot_id: string }
// Response: { crop_item_id, qty, next_state }
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

  const { plot_id } = await req.json().catch(() => ({}));
  if (!plot_id) return errorResponse("plot_id required");

  const supabase = getServiceClient();

  // Load plot
  const { data: plot, error: plotErr } = await supabase
    .from("farm_plots")
    .select("*, items_catalog:seed_item_id (id, effect)")
    .eq("id", plot_id)
    .eq("user_id", userId)
    .single();
  if (plotErr || !plot) return errorResponse("plot not found");
  if (!plot.seed_item_id) return errorResponse("plot is empty");

  const now = new Date();
  if (!plot.ready_at || new Date(plot.ready_at) > now) {
    const secondsLeft = plot.ready_at
      ? Math.ceil((new Date(plot.ready_at).getTime() - now.getTime()) / 1000)
      : -1;
    return errorResponse(`crop not ready, ${secondsLeft}s left`);
  }

  const seedEffect = (plot.items_catalog as { effect: Record<string, unknown> }).effect;
  const cropItemId = seedEffect.crop_item as number;
  const isPermanent = !!seedEffect.permanent;
  const reharvestSeconds = (seedEffect.reharvest_seconds as number) ?? 0;

  // Yield: base 1, +1 if watered (≈+20% would be float — solo dev uses integer math)
  const baseYield = 1;
  const wateredBonus = plot.watered_at ? 1 : 0;
  const totalYield = baseYield + wateredBonus;

  // Add to inventory (UPSERT)
  const { data: existing } = await supabase
    .from("inventory")
    .select("qty")
    .eq("user_id", userId)
    .eq("item_id", cropItemId)
    .maybeSingle();

  await supabase
    .from("inventory")
    .upsert({
      user_id: userId,
      item_id: cropItemId,
      qty: (existing?.qty ?? 0) + totalYield,
      updated_at: now.toISOString(),
    });

  // Reset or update plot
  if (isPermanent) {
    // Apple tree: stays planted, just resets harvest timer
    const nextHarvestAt = new Date(now.getTime() + reharvestSeconds * 1000).toISOString();
    await supabase
      .from("farm_plots")
      .update({
        ready_at: nextHarvestAt,
        next_harvest_at: nextHarvestAt,
        watered_at: null,
        updated_at: now.toISOString(),
      })
      .eq("id", plot_id);
  } else {
    // Regular crop: plot returns to empty
    await supabase
      .from("farm_plots")
      .update({
        seed_item_id: null,
        planted_at: null,
        ready_at: null,
        watered_at: null,
        updated_at: now.toISOString(),
      })
      .eq("id", plot_id);
  }

  return jsonResponse({
    crop_item_id: cropItemId,
    qty: totalYield,
    permanent: isPermanent,
  });
});
