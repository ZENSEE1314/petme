# Design Concepts — Generation Queue

Status: **BLOCKED on Gemini API quota** (free tier exhausted on `gemini-3.1-pro` as of 2026-05-12).
Resumes automatically when quota resets (~24h) OR upgrade to paid tier (~$0.04/image, no daily cap).

To run all of these once unblocked, paste each command into PowerShell from the indicated folder.

---

## 1. Game Logo  →  `design/concepts/logo/`

```powershell
Set-Location "C:\Users\Zen See\smooth-giraffe\design\concepts\logo"
gemini --yolo "/generate 'Wide horizontal game logo banner (16:9 aspect ratio) for Smooth Giraffe — a cute 3D virtual pet game inspired by Digimon and Pokemon. Playful chibi-style text reading SMOOTH GIRAFFE in bubbly rounded letters. A small chibi monster mascot character (round body, big sparkly eyes) peeks from behind the letters. Vibrant pastel gradient background (peach, mint, lavender). Soft 3D plastic-toy shading, sparkle accents. Centered composition. No realistic animals.' --count=3"
```

## 2. Starter Eggs (3 elemental)  →  `design/concepts/eggs/`

```powershell
Set-Location "C:\Users\Zen See\smooth-giraffe\design\concepts\eggs"

# Fire egg
gemini --yolo "/generate 'Three-quarter view of a chibi 3D Digimon-style monster egg. The egg is the FIRE element: warm orange and red gradient shell with golden flame-shaped markings running down the sides, sitting on a small wooden stand. Soft plastic-toy 3D shading, big rounded shape, subtle inner glow. Centered on a clean pastel cream background. No text.' --count=2"

# Water egg
gemini --yolo "/generate 'Three-quarter view of a chibi 3D Digimon-style monster egg. The egg is the WATER element: aqua blue and white gradient shell with wave-shaped markings running down the sides, sitting on a small coral stand. Soft plastic-toy 3D shading, big rounded shape, subtle inner shimmer. Centered on a clean pastel cream background. No text.' --count=2"

# Grass egg
gemini --yolo "/generate 'Three-quarter view of a chibi 3D Digimon-style monster egg. The egg is the GRASS element: vibrant green and cream gradient shell with leaf-shaped markings running down the sides, sitting on a small mossy stand. Soft plastic-toy 3D shading, big rounded shape, tiny sprouts on top. Centered on a clean pastel cream background. No text.' --count=2"
```

## 3. Baby Monsters (3 starters)  →  `design/concepts/monsters/`

```powershell
Set-Location "C:\Users\Zen See\smooth-giraffe\design\concepts\monsters"

# Fire baby
gemini --yolo "/generate 'Full body chibi 3D virtual pet monster, baby stage. Round bulbous body, oversized head, huge sparkly eyes, tiny stubby limbs. Fire element design: warm orange body, flame-tuft hair on top of head, small ember-shaped tail. Cheerful curious expression. Style: low-poly 3D, soft pastel shading, very Digimon-meets-Pokemon. Clean white background, centered, three-quarter view.' --count=2"

# Water baby
gemini --yolo "/generate 'Full body chibi 3D virtual pet monster, baby stage. Round bulbous body, oversized head, huge sparkly eyes, tiny stubby limbs. Water element design: soft aqua-blue body, droplet-shaped tuft on top of head, fin-like ears. Shy gentle expression. Style: low-poly 3D, soft pastel shading, very Digimon-meets-Pokemon. Clean white background, centered, three-quarter view.' --count=2"

# Grass baby
gemini --yolo "/generate 'Full body chibi 3D virtual pet monster, baby stage. Round bulbous body, oversized head, huge sparkly eyes, tiny stubby limbs. Grass element design: pale green body, single sprout-leaf on top of head, small flower bud on chest. Bright energetic expression. Style: low-poly 3D, soft pastel shading, very Digimon-meets-Pokemon. Clean white background, centered, three-quarter view.' --count=2"
```

## 4. Pet's Room Environment  →  `design/concepts/environment/`

```powershell
Set-Location "C:\Users\Zen See\smooth-giraffe\design\concepts\environment"

# Bedroom hub
gemini --yolo "/generate 'Cozy 3D chibi virtual pet bedroom interior, isometric view. Warm wooden floor, pastel-painted walls, small pet bed in corner with a tiny pillow, food bowl, water bowl, toy chest with stuffed animals spilling out, picture frame on wall, soft window light streaming in. Style: low-poly 3D, Animal Crossing meets Digimon vibe, soft saturated colors, plastic-toy shading. No characters, just the empty room ready for a pet to live in.' --count=2"

# Farm/garden
gemini --yolo "/generate 'Small chibi 3D farm garden plot, isometric view. A 3-by-3 grid of tilled soil patches in the middle of a grass clearing, surrounded by a small white picket fence, a watering can on the ground, scattered seeds, a wooden sign post. A few plants in different growth stages: tiny sprout, half-grown carrot leaves, ripe red apple. Cute and friendly. Style: low-poly 3D, Stardew Valley meets Pokemon, soft saturated colors. No characters.' --count=2"
```

---

## After Generation

1. Pick favorite per category, rename to `LOGO_FINAL.png`, `EGG_FIRE_FINAL.png` etc.
2. Move losers to `_rejects/` subfolder per category (don't delete — useful for variations later)
3. Update `design/GDD.md` with chosen visual direction
4. Replace placeholder cube in Unity with these chibi monsters once 3D modeling commission lands
