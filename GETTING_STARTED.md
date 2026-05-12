# Getting Started

The fastest path from a fresh clone to a running backend + Unity client.

## TL;DR

```powershell
git clone https://github.com/ZENSEE1314/petme.git
cd petme
.\scripts\setup.ps1     # one-shot: installs CLI, logs in, pushes schema, deploys functions
.\scripts\verify.ps1    # smoke test: 30 pets in dex, all functions reachable
```

Then open `client/` in Unity 2022.3 LTS.

---

## Prerequisites

| Tool | Required for | Install |
|---|---|---|
| **PowerShell 5.1+** | Setup scripts | Bundled with Windows |
| **Node.js 18+** | npm dependencies if any | https://nodejs.org |
| **Git** | Clone + push | https://git-scm.com |
| **Supabase account** | Backend hosting (free tier) | https://supabase.com — sign up |
| **Unity Hub** | Build the game client | https://unity.com/download |
| **Unity 2022.3 LTS** | Game engine | Install via Unity Hub with WebGL + Android + iOS modules |

The setup script will install **Supabase CLI** for you (to `~/AppData/Local/Programs/supabase/`).

---

## Step 1 — Run the setup script

```powershell
.\scripts\setup.ps1
```

It will:

1. Install Supabase CLI (if missing) — *user-local, no admin needed*
2. Open a browser tab to log you into Supabase
3. List your existing projects, or create a new one for you
4. Link the local repo to your chosen Supabase project
5. Push all 10 SQL migrations (creates the full schema)
6. Deploy 6 edge functions (`tick-needs`, `buy-egg`, `hatch-egg`, `farm-claim`, `battle-simulate`, `trade-execute`)
7. Generate a random `CRON_SECRET` and set it on your project
8. Write `client/Assets/Resources/Config.json` so the Unity client knows where to call

Typical runtime: **3–5 minutes**.

---

## Step 2 — Schedule the cron job

This one step the script *can't* do for you (Supabase doesn't expose cron scheduling via CLI yet).

1. Go to your Supabase Dashboard → **Database → Cron Jobs → New cron job**
2. **Schedule**: `0 * * * *` (every hour at :00)
3. **Method**: POST
4. **URL**: `https://YOUR-REF.supabase.co/functions/v1/tick-needs`
5. **Headers**: `X-Cron-Secret: <the secret printed by setup.ps1>`
6. Save.

This is what decays your pets' hunger/cleanliness/energy in real time, server-side, so device-clock cheats don't work.

---

## Step 3 — Verify

```powershell
.\scripts\verify.ps1
```

Expected output:

```
=== Smooth Giraffe — Backend Verification ===
Target: https://abc.supabase.co

Seed data:
  monster_species (30 expected) ... OK (30 rows)
  items_catalog  (15+ expected) ... OK (20 rows)
  egg_types      (4+ expected)  ... OK (5 rows)

Edge functions reachable:
  tick-needs ... deployed and reachable
  buy-egg ... deployed and reachable
  hatch-egg ... deployed and reachable
  farm-claim ... deployed and reachable
  battle-simulate ... deployed and reachable
  trade-execute ... deployed and reachable

ALL CHECKS PASSED ✓
```

---

## Step 4 — Open the Unity client and run Boot scene

1. Open **Unity Hub** → Add → select `client/` folder in this repo
2. Open in **Unity 2022.3 LTS** (first import takes ~5 minutes — Library/ generates)
3. Install **Newtonsoft.Json**:
   - **Window → Package Manager → `+` → Add package by name…**
   - Name: `com.unity.nuget.newtonsoft-json`
   - Hit Add
4. Wait for Unity to recompile (~30 seconds)
5. **Smooth Giraffe → Create Boot Scene** in the menu bar
   - This script builds the entire scene programmatically: camera, light, floor,
     placeholder cube, UI canvas with sign-in panel and starter picker, all
     wired up to `BootController`. No manual dragging needed.
6. Press **▶ Play**

### What you should see

- Lavender background with a wood-tone floor
- "Booting…" top-center, then "Sign in to start."
- Form with **Email** / **Password** / **Display Name** fields and three buttons
- Sign up with any email/password → balances appear → starter picker shows up
- Pick 🔥 / 💧 / 🌿 → a pink cube appears, bobbing gently — your first pet!
- Balances: 🪙 50 🎟️ 1 (signup bonus from `claim-starter`)

### Phase 0 acceptance test ✅

- [ ] No errors in the Console
- [ ] Sign-up creates a row in `users` table (verify in Supabase Studio)
- [ ] After picking a starter, a row appears in the `monsters` table with `is_starter = true`
- [ ] Cube is visible and animating
- [ ] Balances reflect the +50 coin +1 ticket signup bonus
- [ ] `currency_ledger` has 2 rows for that user with `reason = 'signup_bonus'`

When all six pass, **Phase 0 is shipped.** Move on to Phase 1 (the care loop — feed, clean, play, sleep).

---

## What's deployed when you finish Steps 1–3

| Layer | Components |
|---|---|
| **Postgres** | 4-currency ledger, 30-pet dex, 4 egg types, 5 crops, ~20 items, all RLS policies, all triggers |
| **Edge functions** | `tick-needs` (cron), `buy-egg` (gacha), `hatch-egg`, `farm-claim`, `battle-simulate`, `trade-execute` |
| **Auth** | Email + password, anonymous sign-up. Sessions persist via refresh token. |
| **Cron** | Hourly tick of every active monster's needs |

---

## Troubleshooting

**`supabase: command not found`**
→ Restart PowerShell (PATH was just updated). Or call directly:
`& "$env:USERPROFILE\AppData\Local\Programs\supabase\supabase.exe" --version`

**`db push` fails with "permission denied"**
→ You're not on the right project. `supabase link --project-ref YOUR_REF` first.

**`verify.ps1` says `monster_species (30 expected) ... FAIL`**
→ Migrations didn't apply. Re-run `supabase db push` from `server/`.

**Edge function returns 500 on first call**
→ Cold start can take ~5 seconds. Retry once. Persistent 500s mean missing env vars
— check Dashboard → Edge Functions → your function → Logs.

**Unity says "backend config missing"**
→ `client/Assets/Resources/Config.json` is missing. Re-run `setup.ps1`, or copy
`Config.example.json` to `Config.json` and fill in manually.

---

## Costs

The whole thing runs on **free tiers**:

| Service | Free tier | When you'll outgrow it |
|---|---|---|
| Supabase | 500MB DB, 50K MAU, 500K edge function calls/mo | ~1,000 active players |
| Unity | Personal license up to $200K revenue | Past first big launch |
| GitHub | Unlimited public + private repos | Never (for this) |

Expected total monthly cost during development: **$0**.
Expected after launch (50K players): **~$60/mo** (Supabase Pro tier).
