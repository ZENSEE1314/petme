// ============================================================
// battle-simulate — async PvP fight
// 1. Find opponent within ±100 trophies
// 2. Run deterministic battle sim with a random seed
// 3. Record full replay log, credit rewards, update trophies
//
// Critical: this same logic must exist client-side (in C# port)
// for replay animation. Identical seed in = identical outcome out.
//
// Request:  { team_monster_ids: string[] }   — 1..3 monsters
// Response: { battle_id, result, replay_seed, replay_log, rewards, trophy_delta }
// ============================================================

import {
  getServiceClient,
  getUserId,
  jsonResponse,
  errorResponse,
  CORS_HEADERS,
} from "../_shared/supabase.ts";

const TROPHY_RANGE = 100;
const WIN_TROPHIES = 20;
const LOSS_TROPHIES = -10;
const WIN_COINS_PER_TROPHY = 5;
const FRAGMENT_DROP_CHANCE = 0.05; // 5% per win

interface MonsterSnapshot {
  id: string;
  species_id: number;
  nickname: string | null;
  level: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  intl: number;
  current_hp: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return errorResponse("POST only", 405);

  let userId: string;
  try { userId = await getUserId(req); }
  catch (e) { return errorResponse(String(e), 401); }

  const { team_monster_ids } = await req.json().catch(() => ({}));
  if (!Array.isArray(team_monster_ids) || team_monster_ids.length === 0 || team_monster_ids.length > 3) {
    return errorResponse("team_monster_ids must be a 1-3 element array");
  }

  const supabase = getServiceClient();

  // Load attacker's team + trophies
  const { data: attackerTeam, error: teamErr } = await supabase
    .from("monsters")
    .select("*")
    .in("id", team_monster_ids)
    .eq("owner_id", userId);
  if (teamErr || !attackerTeam?.length) return errorResponse("invalid team", 400);

  const { data: attacker } = await supabase
    .from("users")
    .select("trophies, league")
    .eq("id", userId)
    .single();

  // Find opponent within trophy range (random pick among matches)
  const tMin = Math.max(0, (attacker?.trophies ?? 0) - TROPHY_RANGE);
  const tMax = (attacker?.trophies ?? 0) + TROPHY_RANGE;

  const { data: candidates } = await supabase
    .from("users")
    .select("id, trophies")
    .gte("trophies", tMin)
    .lte("trophies", tMax)
    .neq("id", userId)
    .limit(50);

  if (!candidates?.length) {
    return errorResponse("no opponent available — try again later", 503);
  }

  const opponent = candidates[Math.floor(Math.random() * candidates.length)];

  // Load opponent's strongest 3 monsters
  const { data: defenderTeam } = await supabase
    .from("monsters")
    .select("*")
    .eq("owner_id", opponent.id)
    .order("level", { ascending: false })
    .limit(3);
  if (!defenderTeam?.length) {
    return errorResponse("opponent has no monsters available", 503);
  }

  // Run simulation
  const seed = Math.floor(Math.random() * 1_000_000_000);
  const attackerSnapshot = attackerTeam.map(snapshotMonster);
  const defenderSnapshot = defenderTeam.map(snapshotMonster);
  const sim = simulate(attackerSnapshot, defenderSnapshot, seed);

  // Update trophies (zero-sum)
  const trophyAtk = sim.result === "attacker_win" ? WIN_TROPHIES : LOSS_TROPHIES;
  const trophyDef = -trophyAtk;
  const newAtkTrophies = Math.max(0, (attacker?.trophies ?? 0) + trophyAtk);
  const newDefTrophies = Math.max(0, opponent.trophies + trophyDef);

  await supabase.from("users").update({ trophies: newAtkTrophies, league: leagueFor(newAtkTrophies) }).eq("id", userId);
  await supabase.from("users").update({ trophies: newDefTrophies, league: leagueFor(newDefTrophies) }).eq("id", opponent.id);

  // Rewards (winner-only for v1.0; losers get small consolation in v1.1)
  const coinsReward = sim.result === "attacker_win" ? WIN_COINS_PER_TROPHY * WIN_TROPHIES : 0;
  const fragmentDrop = sim.result === "attacker_win" && Math.random() < FRAGMENT_DROP_CHANCE;

  if (coinsReward > 0) {
    await supabase.from("currency_ledger").insert({
      user_id: userId,
      currency: "coins",
      delta: coinsReward,
      reason: "battle_win",
      ref_id: `seed:${seed}`,
    });
  }

  if (fragmentDrop) {
    const { data: frag } = await supabase
      .from("egg_fragments")
      .select("count")
      .eq("user_id", userId)
      .maybeSingle();
    await supabase.from("egg_fragments").upsert({
      user_id: userId,
      count: (frag?.count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    });
  }

  // Persist battle record
  const { data: battle } = await supabase.from("battles").insert({
    attacker_id: userId,
    defender_id: opponent.id,
    attacker_team: attackerSnapshot,
    defender_team: defenderSnapshot,
    result: sim.result,
    replay_seed: seed,
    replay_log: sim.log,
    trophy_delta_atk: trophyAtk,
    trophy_delta_def: trophyDef,
    coins_reward: coinsReward,
    egg_fragment_drop: fragmentDrop,
  }).select().single();

  return jsonResponse({
    battle_id: battle?.id,
    result: sim.result,
    replay_seed: seed,
    replay_log: sim.log,
    trophy_delta: trophyAtk,
    coins_reward: coinsReward,
    egg_fragment_drop: fragmentDrop,
  });
});

// ============================================================
// Pure simulation — must mirror client-side C# port exactly
// ============================================================

function snapshotMonster(m: Record<string, unknown>): MonsterSnapshot {
  return {
    id: m.id as string,
    species_id: m.species_id as number,
    nickname: (m.nickname as string) ?? null,
    level: m.level as number,
    hp: m.hp as number,
    atk: m.atk as number,
    def: m.def as number,
    spd: m.spd as number,
    intl: m.intl as number,
    current_hp: m.hp as number,
  };
}

function simulate(team_a: MonsterSnapshot[], team_b: MonsterSnapshot[], seed: number) {
  const log: Array<{ turn: number; actor: "a" | "b"; target_idx: number; damage: number; attacker_idx: number }> = [];
  const rng = mulberry32(seed);
  let a_idx = 0, b_idx = 0, turn = 0;

  while (a_idx < team_a.length && b_idx < team_b.length && turn < 100) {
    turn++;
    const a = team_a[a_idx];
    const b = team_b[b_idx];

    // Higher SPD goes first; ties → attacker
    const a_first = a.spd >= b.spd;
    const order: ("a" | "b")[] = a_first ? ["a", "b"] : ["b", "a"];

    for (const actor of order) {
      const atkr = actor === "a" ? a : b;
      const dfdr = actor === "a" ? b : a;
      if (atkr.current_hp <= 0 || dfdr.current_hp <= 0) continue;

      const dmg = computeDamage(atkr, dfdr, rng);
      dfdr.current_hp = Math.max(0, dfdr.current_hp - dmg);
      log.push({
        turn,
        actor,
        attacker_idx: actor === "a" ? a_idx : b_idx,
        target_idx: actor === "a" ? b_idx : a_idx,
        damage: dmg,
      });
      if (dfdr.current_hp <= 0) break;
    }

    if (a.current_hp <= 0) a_idx++;
    if (b.current_hp <= 0) b_idx++;
  }

  const result = a_idx >= team_a.length ? "defender_win" : b_idx >= team_b.length ? "attacker_win" : "draw";
  return { result, log };
}

// Pokemon-inspired damage formula
function computeDamage(atkr: MonsterSnapshot, dfdr: MonsterSnapshot, rng: () => number): number {
  const power = atkr.atk;
  const base = (((2 * atkr.level / 5 + 2) * power * atkr.atk / Math.max(1, dfdr.def)) / 50) + 2;
  const randomFactor = 0.85 + rng() * 0.15;       // 0.85-1.0
  return Math.max(1, Math.floor(base * randomFactor));
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function leagueFor(trophies: number): string {
  if (trophies >= 5000) return "champion";
  if (trophies >= 3000) return "diamond";
  if (trophies >= 1500) return "gold";
  if (trophies >= 500)  return "silver";
  return "bronze";
}
