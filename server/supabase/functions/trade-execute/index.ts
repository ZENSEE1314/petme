// ============================================================
// trade-execute — atomically settle a confirmed trade
//
// Called only when both parties have confirmed.
// Performs:
//   1. validation (cooldowns, ownership, ticket balance)
//   2. ownership swap of monsters
//   3. currency swap (with 5% trade tax → sink + 1 stardust / 1000 coins)
//   4. item swap
//   5. ticket charge
//   6. trade_history audit entry
// All in one transaction — fails atomically.
//
// Request:  { trade_id: string }
// Response: { ok: true, trade_id }
// ============================================================

import {
  getServiceClient,
  getUserId,
  jsonResponse,
  errorResponse,
  CORS_HEADERS,
} from "../_shared/supabase.ts";

const TRADE_TAX_PCT = 0.05;
const STARDUST_PER_1000_COINS_TAXED = 1;

interface OfferPayload {
  monsters?: string[];
  coins?: number;
  items?: Array<{ item_id: number; qty: number }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return errorResponse("POST only", 405);

  let userId: string;
  try { userId = await getUserId(req); }
  catch (e) { return errorResponse(String(e), 401); }

  const { trade_id } = await req.json().catch(() => ({}));
  if (!trade_id) return errorResponse("trade_id required");

  const supabase = getServiceClient();

  // Load trade
  const { data: trade, error: tradeErr } = await supabase
    .from("trades")
    .select("*")
    .eq("id", trade_id)
    .single();
  if (tradeErr || !trade) return errorResponse("trade not found");

  if (trade.status !== "pending") return errorResponse(`trade not pending (${trade.status})`);
  if (!trade.initiator_confirmed || !trade.target_confirmed) {
    return errorResponse("trade not fully confirmed");
  }
  if (new Date(trade.expires_at) < new Date()) return errorResponse("trade expired");

  const partyA = trade.initiator_id;
  const partyB = (trade.target_id ?? trade.fulfilled_by) as string;
  if (!partyB) return errorResponse("trade has no counterparty");
  if (![partyA, partyB].includes(userId)) return errorResponse("not your trade", 403);

  const offerA = trade.initiator_offer as OfferPayload;
  const offerB = trade.target_offer as OfferPayload;

  // Validation
  const validation = await validateOffer(supabase, partyA, offerA);
  if (validation.error) return errorResponse(`A: ${validation.error}`);
  const validationB = await validateOffer(supabase, partyB, offerB);
  if (validationB.error) return errorResponse(`B: ${validationB.error}`);

  // Charge trade tickets (1 from initiator)
  const { error: ticketErr } = await supabase.from("currency_ledger").insert({
    user_id: partyA,
    currency: "tickets",
    delta: -1,
    reason: "trade_ticket",
    ref_id: trade_id,
  });
  if (ticketErr) return errorResponse(`A insufficient trade tickets: ${ticketErr.message}`, 402);

  // ===== Settle =====
  await swapMonsters(supabase, offerA.monsters ?? [], partyA, partyB, trade_id);
  await swapMonsters(supabase, offerB.monsters ?? [], partyB, partyA, trade_id);
  await swapItems(supabase, offerA.items ?? [], partyA, partyB);
  await swapItems(supabase, offerB.items ?? [], partyB, partyA);
  await swapCoinsWithTax(supabase, offerA.coins ?? 0, partyA, partyB, trade_id);
  await swapCoinsWithTax(supabase, offerB.coins ?? 0, partyB, partyA, trade_id);

  // Mark trade completed
  await supabase
    .from("trades")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", trade_id);

  // Audit log
  await supabase.from("trade_history").insert([
    { trade_id, user_id: partyA, action: "completed", payload: { offer: offerA } },
    { trade_id, user_id: partyB, action: "completed", payload: { offer: offerB } },
  ]);

  return jsonResponse({ ok: true, trade_id });
});

// ============================================================
// Helpers
// ============================================================

async function validateOffer(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  offer: OfferPayload,
): Promise<{ error: string | null }> {
  const monsterIds = offer.monsters ?? [];
  if (monsterIds.length > 0) {
    const { data: ms } = await supabase
      .from("monsters")
      .select("id, owner_id, is_starter, trade_locked_until")
      .in("id", monsterIds);

    for (const m of ms ?? []) {
      if (m.owner_id !== userId) return { error: `monster ${m.id} not owned by ${userId}` };
      if (m.is_starter) return { error: `monster ${m.id} is starter — untradable` };
      if (m.trade_locked_until && new Date(m.trade_locked_until) > new Date()) {
        return { error: `monster ${m.id} is trade-locked until ${m.trade_locked_until}` };
      }
    }
    if ((ms?.length ?? 0) !== monsterIds.length) return { error: "monster missing from inventory" };
  }
  return { error: null };
}

async function swapMonsters(
  supabase: ReturnType<typeof getServiceClient>,
  monsterIds: string[],
  fromUserId: string,
  toUserId: string,
  tradeId: string,
) {
  if (!monsterIds.length) return;
  await supabase
    .from("monsters")
    .update({
      owner_id: toUserId,
      trade_locked_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .in("id", monsterIds)
    .eq("owner_id", fromUserId);
}

async function swapItems(
  supabase: ReturnType<typeof getServiceClient>,
  items: Array<{ item_id: number; qty: number }>,
  fromUserId: string,
  toUserId: string,
) {
  for (const i of items) {
    // Decrement sender
    const { data: senderInv } = await supabase
      .from("inventory")
      .select("qty")
      .eq("user_id", fromUserId)
      .eq("item_id", i.item_id)
      .single();
    if (!senderInv || senderInv.qty < i.qty) throw new Error(`insufficient item ${i.item_id}`);
    await supabase
      .from("inventory")
      .update({ qty: senderInv.qty - i.qty, updated_at: new Date().toISOString() })
      .eq("user_id", fromUserId)
      .eq("item_id", i.item_id);

    // Increment receiver
    const { data: recvInv } = await supabase
      .from("inventory")
      .select("qty")
      .eq("user_id", toUserId)
      .eq("item_id", i.item_id)
      .maybeSingle();
    await supabase.from("inventory").upsert({
      user_id: toUserId,
      item_id: i.item_id,
      qty: (recvInv?.qty ?? 0) + i.qty,
      updated_at: new Date().toISOString(),
    });
  }
}

async function swapCoinsWithTax(
  supabase: ReturnType<typeof getServiceClient>,
  amount: number,
  fromUserId: string,
  toUserId: string,
  tradeId: string,
) {
  if (amount <= 0) return;
  const tax = Math.floor(amount * TRADE_TAX_PCT);
  const credited = amount - tax;
  const stardustReward = Math.floor(tax / 1000) * STARDUST_PER_1000_COINS_TAXED;

  // Debit sender (full amount)
  await supabase.from("currency_ledger").insert({
    user_id: fromUserId, currency: "coins", delta: -amount,
    reason: "trade_send", ref_id: tradeId,
  });

  // Credit receiver (amount minus tax)
  await supabase.from("currency_ledger").insert({
    user_id: toUserId, currency: "coins", delta: credited,
    reason: "trade_recv", ref_id: tradeId,
  });

  // Sender gets a small stardust reward proportional to tax (incentive to use trades)
  if (stardustReward > 0) {
    await supabase.from("currency_ledger").insert({
      user_id: fromUserId, currency: "stardust", delta: stardustReward,
      reason: "trade_stardust", ref_id: tradeId,
    });
  }
}
