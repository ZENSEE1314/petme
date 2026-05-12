# Design Concepts — Generation Queue (v2 — expanded for 30-pet dex)

Status: **BLOCKED on Gemini API quota** (free tier exhausted 2026-05-12).
Resumes on quota reset (~24h) OR paid tier upgrade (~$0.04/image).

The plan is now **30 pets at v1.0 launch** across 6 rarity tiers + ~12 evolution lines. We don't generate all 30 here — we generate concepts for **one representative of each rarity tier**, plus the logo, eggs, and environment. Then we pick the visual direction we like and either commission an artist or batch-generate the rest in that same style.

To run any block: paste it into PowerShell. Each `Set-Location` line jumps to the right output folder.

---

## 1. Game Logo  →  `design/concepts/logo/`

```powershell
Set-Location "C:\Users\Zen See\smooth-giraffe\design\concepts\logo"
gemini --yolo "/generate 'Wide horizontal game logo banner (16:9 aspect ratio) for Smooth Giraffe — a cute 3D virtual pet collection game inspired by Digimon and Pokemon. Playful chibi-style text reading SMOOTH GIRAFFE in bubbly rounded letters. A small chibi monster mascot character (round body, big sparkly eyes) peeks from behind the letters. Vibrant pastel gradient background (peach, mint, lavender). Soft 3D plastic-toy shading, sparkle accents. Centered composition. No realistic animals.' --count=3"
```

## 2. Starter Eggs (3 elemental)  →  `design/concepts/eggs/`

```powershell
Set-Location "C:\Users\Zen See\smooth-giraffe\design\concepts\eggs"

gemini --yolo "/generate 'Three-quarter view of a chibi 3D Digimon-style monster egg. FIRE element: warm orange and red gradient shell with golden flame-shaped markings, sitting on a small wooden stand. Soft plastic-toy 3D shading, big rounded shape, subtle inner glow. Centered on a clean pastel cream background. No text.' --count=2"

gemini --yolo "/generate 'Three-quarter view of a chibi 3D Digimon-style monster egg. WATER element: aqua blue and white gradient shell with wave-shaped markings, sitting on a small coral stand. Soft plastic-toy 3D shading, big rounded shape, subtle inner shimmer. Centered on a clean pastel cream background. No text.' --count=2"

gemini --yolo "/generate 'Three-quarter view of a chibi 3D Digimon-style monster egg. GRASS element: vibrant green and cream gradient shell with leaf-shaped markings, sitting on a small mossy stand. Soft plastic-toy 3D shading, big rounded shape, tiny sprouts on top. Centered on a clean pastel cream background. No text.' --count=2"
```

## 3. Egg Rarity Variants (gacha-tier eggs)  →  `design/concepts/eggs/`

These are the *shop* eggs, distinct from the elemental starter eggs above.

```powershell
Set-Location "C:\Users\Zen See\smooth-giraffe\design\concepts\eggs"

# Common
gemini --yolo "/generate 'Plain chibi 3D monster egg, white shell with simple gray spots, sitting on a small wooden stand. COMMON rarity feel — humble, plain, friendly. Soft 3D plastic-toy shading, big rounded shape. Pastel cream background.' --count=1"

# Rare (blue border equivalent)
gemini --yolo "/generate 'Chibi 3D monster egg with iridescent blue shell, soft glowing star patterns, sitting on a polished silver stand. RARE rarity feel — special, sought-after. Soft plastic-toy 3D shading. Glowing aura. Pastel background.' --count=1"

# Epic (purple)
gemini --yolo "/generate 'Chibi 3D monster egg with deep purple shell, swirling galaxy patterns, floating slightly above a crystal stand. EPIC rarity feel — magical, mysterious. Inner light, soft 3D plastic-toy shading, particle sparkles around it.' --count=1"

# Legendary (gold)
gemini --yolo "/generate 'Chibi 3D monster egg with shining gold shell, intricate sun-burst patterns, on an ornate pedestal with golden chains. LEGENDARY rarity feel — heroic, prestigious. Strong inner glow, sparkles, light beams. Soft 3D plastic-toy shading on a dark velvet background.' --count=1"

# Mythic (holographic)
gemini --yolo "/generate 'Chibi 3D monster egg with iridescent holographic rainbow shell, shifting opal patterns, floating above a clouded crystal stand. MYTHIC rarity feel — otherworldly, one-of-a-kind. Strong glow, particle aura, soft 3D plastic-toy shading. Magical dark background with stars.' --count=2"
```

## 4. Rarity-Tier Monster Concepts  →  `design/concepts/monsters/`

One monster per rarity, to define the visual style ladder.

```powershell
Set-Location "C:\Users\Zen See\smooth-giraffe\design\concepts\monsters"

# Common — Fire Baby (a 'humble' starter design)
gemini --yolo "/generate 'Full body chibi 3D virtual pet monster, baby stage, COMMON rarity. Round bulbous body, oversized head, huge sparkly eyes, tiny stubby limbs. Fire element: warm orange body, small flame-tuft hair, ember-tail. Curious expression. Simple clean design, friendly. Low-poly 3D, soft pastel shading, Digimon-meets-Pokemon. White background, three-quarter view, centered. Gray rarity border subtle aura.' --count=2"

# Uncommon — slightly more design flair
gemini --yolo "/generate 'Full body chibi 3D virtual pet monster, child stage, UNCOMMON rarity. Round body but with one distinguishing feature like extra ears or a small fin. Water element: aqua-blue body with white belly, droplet-tuft hair, fin-like ears, dolphin tail. Playful expression. Low-poly 3D, soft pastel shading, Digimon-meets-Pokemon. White background, three-quarter view. Subtle green rarity glow.' --count=2"

# Rare — clearly more impressive design
gemini --yolo "/generate 'Full body chibi 3D virtual pet monster, teen stage, RARE rarity. More elaborate design: dual-tone body, decorative element on head like a small horn or crown of leaves. Grass element: pale green and yellow body, sprouting flower crown, vine-like tail. Confident pose. Low-poly 3D, soft pastel shading, Digimon-meets-Pokemon. White background, three-quarter view. Soft blue rarity glow aura.' --count=2"

# Epic — magical / cool
gemini --yolo "/generate 'Full body chibi 3D virtual pet monster, adult stage, EPIC rarity. Bold magical design: glowing energy patterns on body, larger size, dramatic stance. Dark element: deep midnight purple body with glowing crescent moon mark, smoke-wisp tail, glowing yellow eyes. Mysterious confident pose. Low-poly 3D, soft pastel shading with strong purple glow accents. White background, three-quarter view. Strong purple rarity aura.' --count=2"

# Legendary — heroic / iconic
gemini --yolo "/generate 'Full body chibi 3D virtual pet monster, adult stage, LEGENDARY rarity. Iconic heroic design: ornate features, regal stance, golden accents throughout. Light element: pearl-white body with golden wing-tips, halo of soft light around head, prismatic feathered tail. Majestic gentle expression, slightly larger and more polished than other monsters. Low-poly 3D, soft pastel shading with strong golden glow. White background, three-quarter view. Strong gold rarity aura with sparkles.' --count=2"

# Mythic — event-tier showstopper
gemini --yolo "/generate 'Full body chibi 3D virtual pet monster, MYTHIC event rarity. Otherworldly design with holographic iridescent body, shifting rainbow colors, ethereal floating pose. Themed for Halloween event: pumpkin-spirit motif with glowing carved face on chest, candle-flame floating above head, ghostly trailing wisps. Magical and unique. Low-poly 3D, soft pastel shading with strong holographic glow. Dark starry background, three-quarter view. Maximum sparkle and aura effects.' --count=2"
```

## 5. Environment / Backgrounds  →  `design/concepts/environment/`

```powershell
Set-Location "C:\Users\Zen See\smooth-giraffe\design\concepts\environment"

# Bedroom / main hub
gemini --yolo "/generate 'Cozy 3D chibi virtual pet bedroom interior, isometric view. Warm wooden floor, pastel-painted walls, small pet bed in corner, food bowl, water bowl, toy chest with stuffed animals spilling out, picture frame on wall, soft window light streaming in. Style: low-poly 3D, Animal Crossing meets Digimon vibe, soft saturated colors, plastic-toy shading. No characters, just the empty room.' --count=2"

# Farm
gemini --yolo "/generate 'Small chibi 3D farm garden plot, isometric view. A 3-by-3 grid of tilled soil patches in the middle of a grass clearing, surrounded by a small white picket fence, a watering can on the ground, scattered seeds, a wooden sign post. Plants in different growth stages: tiny sprout, half-grown carrot leaves, ripe red apple. Cute and friendly. Low-poly 3D, Stardew Valley meets Pokemon. No characters.' --count=2"

# Battle arena
gemini --yolo "/generate 'Chibi 3D PvP battle arena platform, viewed from a low angle. Two circular pads facing each other on a floating sky-island in the clouds, soft particles, dramatic crystal column in background, magical floor patterns lighting up. Style: low-poly 3D, vibrant saturated colors, Pokemon Stadium meets Genshin Impact. No characters on the pads.' --count=2"

# Shop interior
gemini --yolo "/generate 'Cozy chibi 3D shop interior, isometric view. Wooden shelves stacked with colorful eggs of different rarities, jars of seeds, food bowls, accessories, a small counter with a cash register, hanging lantern lights, pastel walls. Friendly inviting vibe. Low-poly 3D, Animal Crossing shop feel. No characters.' --count=2"

# Egg hatching scene (UI background)
gemini --yolo "/generate 'A glowing chibi 3D monster egg floating in a beam of soft light, swirling magical particles and stars around it, dark gradient backdrop fading to deep purple at edges. The egg appears about to hatch, cracks of golden light radiating outward. Centered composition, dramatic and magical. Used as background for egg hatching ceremony UI.' --count=2"
```

## 6. UI Icon Set  →  `design/concepts/ui/` (create folder first)

```powershell
New-Item -ItemType Directory -Path "C:\Users\Zen See\smooth-giraffe\design\concepts\ui" -Force
Set-Location "C:\Users\Zen See\smooth-giraffe\design\concepts\ui"

# 4 currency icons
gemini --yolo "/icon 'Stack of gold coins, chibi 3D plastic-toy style, soft shading, transparent background friendly' --sizes='64,128,256' --type='currency-icon' --corners='rounded'"
gemini --yolo "/icon 'Polished cyan gemstone, faceted, soft inner glow, chibi 3D plastic-toy style' --sizes='64,128,256' --type='currency-icon' --corners='rounded'"
gemini --yolo "/icon 'Sparkling purple stardust particles in a glass vial, chibi 3D plastic-toy style, soft glow' --sizes='64,128,256' --type='currency-icon' --corners='rounded'"
gemini --yolo "/icon 'Carnival trade ticket with a heart symbol, chibi 3D plastic-toy style' --sizes='64,128,256' --type='currency-icon' --corners='rounded'"

# Stat icons (HP, ATK, DEF, SPD, INT)
gemini --yolo "/icon 'Red heart for HP stat, chibi 3D plastic-toy style' --sizes='64,128' --type='stat-icon'"
gemini --yolo "/icon 'Orange fist for ATK stat, chibi 3D plastic-toy style' --sizes='64,128' --type='stat-icon'"
gemini --yolo "/icon 'Blue shield for DEF stat, chibi 3D plastic-toy style' --sizes='64,128' --type='stat-icon'"
gemini --yolo "/icon 'Yellow lightning bolt for SPD stat, chibi 3D plastic-toy style' --sizes='64,128' --type='stat-icon'"
gemini --yolo "/icon 'Purple brain or sparkle for INT stat, chibi 3D plastic-toy style' --sizes='64,128' --type='stat-icon'"

# Rarity badge frames
gemini --yolo "/icon 'Gray badge frame with subtle gradient, COMMON rarity, chibi 3D plastic-toy style' --sizes='128,256' --type='badge'"
gemini --yolo "/icon 'Green badge frame with leaf accents, UNCOMMON rarity, chibi 3D plastic-toy style' --sizes='128,256' --type='badge'"
gemini --yolo "/icon 'Blue badge frame with crystal accents, RARE rarity, chibi 3D plastic-toy style' --sizes='128,256' --type='badge'"
gemini --yolo "/icon 'Purple badge frame with galaxy swirl, EPIC rarity, chibi 3D plastic-toy style' --sizes='128,256' --type='badge'"
gemini --yolo "/icon 'Gold badge frame with sunburst rays, LEGENDARY rarity, chibi 3D plastic-toy style' --sizes='128,256' --type='badge'"
gemini --yolo "/icon 'Holographic iridescent rainbow badge frame, MYTHIC rarity, chibi 3D plastic-toy style' --sizes='128,256' --type='badge'"
```

---

## After Generation

1. Pick favorite per category → rename to `*_FINAL.png`
2. Move losers to `_rejects/` subfolder (gitignored, useful for variations later)
3. Use the final logo + 1 rarity-tier monster as the "style bible" — share it with your 3D modeller when commissioning the full 30-pet dex
4. Drop final icons into `client/Assets/Art/UI/`

## Recommended generation order (when quota resets)

If quota is limited, do these first:

1. **Logo × 3** (defines brand)
2. **5 rarity-tier monsters × 2 each** (defines style ladder)
3. **5 egg rarity variants × 1 each** (defines gacha visuals)
4. Everything else later

That's ~17 images, well under most daily quotas.
