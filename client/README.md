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

When the project first opens, add these via Package Manager:

- **Cinemachine** (free, Unity) — camera system
- **TextMeshPro** (free, Unity) — text rendering
- **Newtonsoft.Json** (`com.unity.nuget.newtonsoft-json`, free) — JSON serialization (more robust than JsonUtility for nested objects)
- **DOTween Pro** (Asset Store, ~$15) — UI/object animation

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

## Phase 0 verification (the Boot scene)

Acceptance criteria for shipping Phase 0:
- [ ] GameManager initializes Api/Auth/Time without errors
- [ ] Anonymous sign-up creates a row in `users` table (visible in Supabase Studio)
- [ ] `monster_species` table query returns 30 rows (proves PostgREST + RLS work)
- [ ] A 3D placeholder cube appears in the scene as the pet

## Phase 1 onward

See the master plan: `../design/PLAN.md`

## Coding conventions

- C# in `SmoothGiraffe.<Feature>` namespaces
- Public types one per file
- Async methods end in `Async`
- Use `await` not `.Result` to avoid Unity main-thread deadlocks
- All server calls go through `ApiClient` — never instantiate HttpClient elsewhere
