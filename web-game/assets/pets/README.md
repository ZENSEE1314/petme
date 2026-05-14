# Pet artwork — generation plan

The web-game currently uses emoji placeholders for pets. Real chibi 3D art is queued — blocked on Gemini API daily quota.

## Status

🚫 **Quota exhausted** on Gemini's free `gemini-3.1-pro` tier (which the CLI uses as its orchestrator model). Trying to call any Nano Banana command returns 429 even when targeting the cheaper `gemini-2.5-flash-image` model.

Resolution options:
1. **Wait for daily reset** — usually midnight Pacific
2. **Upgrade Gemini API to paid tier** — ~$0.04 per image, no daily cap. 30 images ≈ $1.20.
3. **Use fal.ai** as an alternative — requires API key setup in `~/.config/fal/credentials`

## Style guide (one prompt to rule them all)

Every monster image should share this aesthetic so the dex feels like one consistent set:

> **Cute chibi 3D virtual pet game character — [NAME], a [STAGE] [ELEMENT] monster. [DISTINCT FEATURES]. Round bulbous body, oversized head, huge sparkly eyes, tiny stubby limbs. Soft 3D plastic-toy shading. Digimon-meets-Pokemon aesthetic. Square format 512×512, centered composition, clean soft cream background. No text, no watermark.**

## Per-species prompts

Below is the queue for the 30 launch pets. Drop `gemini --yolo "/generate '...'"` (or fal-ai equivalent) in front of each prompt and the result lands in `web-game/assets/pets/`.

### Fire line — Line 1
- **1 Emberlet (common, baby)** — Warm orange body, small flame tuft on head, ember-shaped tail. Curious expression.
- **2 Flarepup (uncommon, child)** — Foxy orange-red body, larger flame mane, two tails with ember tips. Mischievous look.
- **3 Volcanine (rare, teen)** — Sleek crimson dragon-pup, glowing volcanic-rock plates on back, smoke wisps from snout.

### Water line — Line 2
- **4 Bubblet (common, baby)** — Soft aqua-blue body, water-droplet tuft on head, fin-like ears. Shy gentle expression.
- **5 Splashkin (uncommon, child)** — Dolphin-pup body with white belly, droplet-pattern markings, finned tail. Playful.
- **6 Tidewarden (rare, teen)** — Whale-like majestic blue, coral crown, gentle eyes, water swirls around it.

### Grass line — Line 3
- **7 Seedling (common, baby)** — Pale green body, single sprout-leaf on head, small flower bud on chest. Bright.
- **8 Sproutling (uncommon, child)** — Pale green and yellow body, sprouting flower crown, vine-like tail.
- **9 Bloomheart (rare, teen)** — Larger leafy body with full flower crown of pink petals, confident pose.

### 2-stage commons
- **10 Pebbit (common, baby)** — Round grey rock-pet with cute face carved in, mossy green tuft on top.
- **11 Boulderon (uncommon, child)** — Bigger grey-brown rocky body, crystal nubs sprouting from shoulders.
- **12 Glimmerlet (common, baby)** — Pearl-white body with golden glimmer particles, soft halo of light.
- **13 Lumora (uncommon, child)** — Sparkling silver-white body with golden wing-tip markings, ethereal glow.
- **14 Wispy (common, baby)** — Translucent pale purple ghost-pet, smoke-trail body, friendly closed eyes.
- **15 Shadewing (uncommon, child)** — Bat-like dark purple body with one bigger glowing yellow eye, fangs.

### Standalone commons
- **16 Pinkpuff (common)** — Cotton-candy pink puffball, tiny limbs, dot eyes, content smile.
- **17 Mintmite (common)** — Pale mint green leaf-shaped body, tiny insect legs, dewdrop on top.
- **18 Cocoabean (common)** — Round brown bean body, soft cream belly, sleepy half-closed eyes.
- **19 Snowpup (common)** — Fluffy white snow-puppy, blue paws, tiny snowflake patterns.

### Crystal Epic chain — Line 11
- **20 Crystab (common, baby)** — Tiny crystal-shaped pearl body with rainbow refractions inside.
- **21 Prismling (rare, child)** — Geometric crystal body with multiple prism shards, rainbow light scattering.
- **22 Crystadragon (epic, teen)** — Majestic crystal dragon, full body of glowing prismatic gems, strong wing crystals.

### Storm Epic chain — Line 12
- **23 Zaplet (common, baby)** — Yellow-and-white round body with lightning-bolt tuft, energetic pose.
- **24 Voltspark (rare, child)** — Larger yellow body with electric blue accents, lightning aura.
- **25 Tempestor (epic, teen)** — Storm-cloud body wrapped around a yellow energy core, lightning crackling.

### Filler uncommons + rare + legendary
- **26 Petalfox (uncommon)** — Pink-and-green flower-fox, petal tail, blossom crown.
- **27 Aquadot (uncommon)** — Polka-dot blue koi-pet, fancy fins, tiny coral details.
- **28 Magmite (uncommon)** — Tiny lava-rock pet with glowing orange cracks, small fire halo.
- **29 Cloudkin (rare, teen)** — Fluffy white cloud-shaped pet with cyan eye highlights, drifting wisps.
- **30 Celestiaph (legendary, mega)** — Stunning gold-and-white pearl angelic pet, halo of sun rays, prismatic feathered wings, awe-inspiring pose.

## One-shot batch script (run when quota resets)

```powershell
# scripts/generate-pet-art.ps1
$env:NANOBANANA_MODEL = "gemini-2.5-flash-image"
$petDir = "C:\Users\Zen See\smooth-giraffe\web-game\assets\pets"
Set-Location $petDir

$prompts = @(
  @{id=1;  name='Emberlet';     desc='baby fire monster. Warm orange body, small flame tuft, ember-shaped tail, curious'},
  @{id=2;  name='Flarepup';     desc='child fire monster. Foxy orange-red body, large flame mane, two tails with ember tips'},
  # ... fill in for all 30
)

foreach ($p in $prompts) {
  $fn = "$($p.id)-$($p.name.ToLower()).png"
  if (Test-Path $fn) { Write-Host "skip $fn"; continue }
  $prompt = "Cute chibi 3D virtual pet game character. $($p.desc). Round bulbous body, oversized head, huge sparkly eyes, tiny stubby limbs. Soft 3D plastic-toy shading. Digimon-meets-Pokemon aesthetic. Square format, centered, clean soft cream background. No text, no watermark."
  gemini --yolo "/generate '$prompt' --count=1"
  # Rename the output
  $latest = Get-ChildItem -File | Where-Object { $_.Name -like "generated-*.png" } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($latest) { Move-Item $latest.FullName $fn -Force }
  Start-Sleep -Seconds 2  # be polite to the API
}
```

## Wiring images into the game (once they exist)

In `data.js`, every species already has `id` matching the filename. To make the UI use real art:

```js
// In ui.js — replace `s.emoji` with this helper everywhere
function petArt(s, monster) {
  // Try real image first, fall back to emoji
  const src = `assets/pets/${s.id}-${s.name.toLowerCase()}.png`;
  return `<img src="${src}" alt="${s.name}" class="pet-image" onerror="this.replaceWith(this.dataset.fallback || '${s.emoji}')" data-fallback="${s.emoji}">`;
}
```

Then add CSS:
```css
.pet-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: -webkit-optimize-contrast;
}
```

Until then, emoji + the new rarity halo / drop shadow / 3D feel does a pretty great job. 🦒
