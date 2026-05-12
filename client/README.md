# Smooth Giraffe — Client (Unity)

Unity 2022.3 LTS · cross-platform (WebGL + iOS + Android + Desktop).

## Setup

1. Install **Unity Hub** from https://unity.com/download
2. Install **Unity 2022.3 LTS** via Unity Hub, with these build modules:
   - WebGL Build Support
   - Android Build Support (with OpenJDK + Android SDK + NDK)
   - iOS Build Support
   - Linux/Mac/Windows Build Support (whichever desktop target you want)
3. Open Unity Hub → Add → select `client/`
4. Open the project. Unity will import packages and set up `Library/` (gitignored).

## Required Unity packages

Install via **Window → Package Manager** before pressing Play:

| Package | How to add | Why |
|---|---|---|
| **Newtonsoft.Json** `com.unity.nuget.newtonsoft-json` | Package Manager → `+` → Add package by name | **Required** — ApiClient uses it for all JSON. JsonUtility too limited. |
| **TextMeshPro** | Auto-prompted on first launch ("Import TMP Essentials") | UI text |
| **Cinemachine** | Package Manager → Unity Registry | Camera system (Phase 2+) |
| **DOTween Pro** (~$15) | Asset Store | Animations (Phase 2+) |

## Layout

```
client/Assets/Scripts/
├── Core/
│   ├── GameManager.cs        # Global singleton, owns Api/Auth/Time
│   └── TimeService.cs        # Server-time sync for clock-cheat detection
├── Net/
│   ├── ApiClient.cs          # HttpClient wrapper for Supabase REST + Functions
│   └── AuthManager.cs        # Supabase auth, PlayerPrefs persistence
├── Pet/
│   └── PetState.cs           # Client mirror of the `monsters` table row
├── Farm/                     # (TBD Phase 3)
├── Battle/                   # (TBD Phase 6) — must mirror server battle math
├── Training/                 # (TBD Phase 5)
├── Shop/                     # (TBD Phase 4)
└── UI/                       # (TBD per phase)
```

## Configuring the backend

1. Open the Boot scene (TBD — Phase 0 deliverable)
2. Select the `GameManager` GameObject
3. In Inspector, paste your Supabase project URL + anon key from
   Supabase Dashboard → Settings → API

**Do NOT commit these values.** The fields are inspector-only and won't end up in version control. Use Unity's player-pref or a local `Secrets.asset` ScriptableObject (gitignored).

## Phase 0 — running the Boot scene

**TL;DR:**

1. Backend live? `..\scripts\setup.ps1` from repo root, then `..\scripts\verify.ps1`
2. Open this Unity project (`client/`)
3. Install **Newtonsoft.Json** package (see table above)
4. Menu: **Smooth Giraffe → Create Boot Scene** ← *one click, builds everything*
5. Press **Play**

What you should see:

- A cozy lavender background with a floor
- "Booting…" then "Sign in to start." status text top-center
- Email / password / display-name fields with three buttons: **Sign Up**, **Sign In**, **Anon**
- After signing up: balances appear (🪙 0 💎 0 ✨ 0 🎟️ 0), then the starter picker (🔥/💧/🌿)
- After picking a starter: a pink cube bobbing gently — your placeholder pet
- Balances update to 🪙 50 🎟️ 1 (signup bonus from `claim-starter`)

**Why "Anon" might fail:** Supabase anonymous sign-ins are off by default. To enable them: Supabase Dashboard → Authentication → Providers → Anonymous → toggle on. Or just use Sign Up.

### Acceptance criteria (Phase 0)

- [ ] GameManager initializes Api/Auth/Time without errors (console log: `GameManager ready`)
- [ ] Sign-up creates a row in `users` table (visible in Supabase Studio)
- [ ] After `claim-starter`, a row appears in `monsters` with your `is_starter=TRUE` pet
- [ ] Cube is visible and animating
- [ ] Balances reflect the +50 coins +1 ticket signup bonus

### If something goes wrong

| Symptom | Fix |
|---|---|
| `backend config missing` in console | `scripts\setup.ps1` didn't write `Assets/Resources/Config.json`. Re-run it. |
| `The type or namespace name 'Newtonsoft' could not be found` | Install the Newtonsoft.Json package (see table above). |
| `Sign-up failed: API 400: ... already registered` | That email is already in use — try a different one, or use Sign In. |
| `Claim failed: API 409: you already have a starter` | You're already past Phase 0! 🎉 |
| Cube doesn't appear | Check the `PetController` component is on the cube. Re-run the scene builder. |

## Phase 1 onward

See the master plan: `../design/PLAN.md`

## Coding conventions

- C# in `SmoothGiraffe.<Feature>` namespaces
- Public types one per file
- Async methods end in `Async`
- Use `await` not `.Result` to avoid Unity main-thread deadlocks
- All server calls go through `ApiClient` — never instantiate HttpClient elsewhere
