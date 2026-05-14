# Pet artwork — generation plan (animal-chibi style)

The web-game currently uses emoji placeholders for pets. Real artwork is queued — blocked on Gemini API daily quota.

## ✅ Style direction locked in

Inspired by user-supplied reference (a fiery chibi firefly):

- **Cute animal-based chibi** — each pet is recognizably an animal × element fusion, not an abstract blob
- **Thick black outlines** — clean digital line art, all strokes ~2-3px equivalent
- **Saturated warm colors** with **soft rim lighting** + **magical glow**
- **Big anime eyes** with 2–3 catch lights, expressive simple smile
- **Element-themed accents** (flame wings for fire, water droplet ears for water, leaf crowns for grass, etc.)
- **Transparent background** (or pure white if PNG transparency unavailable)
- **Square 1:1** ratio, centered, clear silhouette

## Master prompt template

```
Chibi cute animal monster — [NAME], a [STAGE] [ELEMENT] [ANIMAL] creature.
[KEY FEATURES: body shape, color gradient, special parts, expression].
[ELEMENT FLOURISH: flames / water / leaves / lightning / etc.].
Thick clean black outlines, saturated warm colors, soft rim lighting,
magical glow. Transparent background, centered, no text, no watermark.
Square format. Anime / digital painting style. High detail, polished.
```

## Status

🚫 **Quota exhausted** on Gemini's free `gemini-3.1-pro` tier (the CLI uses it as its orchestrator). Any Nano Banana call returns HTTP 429.

### Three paths to actual images

| Option | Cost | Speed | What you do |
|---|---|---|---|
| **Wait** | Free | ~24h cycles | Quota resets daily near midnight Pacific |
| **Upgrade Gemini API** ★ recommended | ~$0.04 / image · ≈ $1.20 for all 30 | Few minutes | Enable billing at https://aistudio.google.com → run `scripts/generate-pet-art.ps1` |
| **fal.ai** | ~$0.025 / image with Nano Banana there | Few minutes | Set `FAL_KEY` env var → use fal-ai-media skill |

## Per-pet prompts (final, ready to fire)

### 🔥 Fire line (Line 1)
1. **Emberlet** (common · baby) — A baby fire firefly creature. Round bulbous orange-and-yellow gradient body, oversized head, tiny antennae, small translucent fairy wings with flame edges, ember-tail glowing.
2. **Flarepup** (uncommon · child) — A young fire-fox creature. Furry orange-red body with cream chest, large flame mane, two flame-tipped tails, mischievous grin showing fangs.
3. **Volcanine** (rare · teen) — A noble fire-wolf creature. Sleek crimson and obsidian body, glowing magma plates along back, smoke from snout, fierce confident pose.

### 💧 Water line (Line 2)
4. **Bubblet** (common · baby) — A baby water-tadpole creature. Soft aqua-blue body with white belly, oversized head, dew-drop tuft on top, tiny fin-like ears, shy gentle smile.
5. **Splashkin** (uncommon · child) — A young water-dolphin creature. Smooth aqua body with white underside, droplet markings, large flippers, playful smiling eyes, water swirl around it.
6. **Tidewarden** (rare · teen) — A regal water-whale creature. Deep blue and pearl-white body, coral crown growing from head, gentle wise eyes, water spout above, majestic pose.

### 🌿 Grass line (Line 3)
7. **Seedling** (common · baby) — A baby grass-rabbit creature. Pale green-and-cream body, single curled sprout on head like a horn, flower bud on chest, big curious eyes.
8. **Sproutling** (uncommon · child) — A young grass-fawn creature. Pale green and yellow body, blooming flower crown of three small flowers, vine-like tail, soft hooves.
9. **Bloomheart** (rare · teen) — A graceful grass-deer creature. Leafy green body with antlers made of vines and pink cherry blossoms, butterflies orbiting, serene smile.

### 2-stage commons
10. **Pebbit** (common · baby) — A baby rock-mole creature. Round grey stone body with cute carved face, mossy green tuft on top, small flat paws.
11. **Boulderon** (uncommon · child) — A young rock-armadillo creature. Grey-brown rocky shell with crystal nubs on shoulders, sturdy stance, determined expression.
12. **Glimmerlet** (common · baby) — A baby light-moth creature. Pearl-white body with golden glimmer particles, tiny shimmering wings, soft halo around it, calm expression.
13. **Lumora** (uncommon · child) — A young light-fox creature. Sparkling silver-white fur with golden wing-tip markings on cheeks, ethereal glow, gentle smile.
14. **Wispy** (common · baby) — A baby dark-ghost creature. Translucent pale purple wisp body, smoke-trail tail, friendly closed half-moon eyes, tongue out.
15. **Shadewing** (uncommon · child) — A young dark-bat creature. Dark purple velvet body, one big glowing yellow eye and one closed, small fangs, expressive ears.

### Standalone commons
16. **Pinkpuff** (common) — A round cotton-candy slime creature. Soft fluffy pink body, tiny stubby legs, dot eyes, perpetual content smile.
17. **Mintmite** (common) — A tiny grass-bug creature. Pale mint leaf-shaped body with six little insect legs, dewdrop on top, sweet smile.
18. **Cocoabean** (common) — A round bean creature. Smooth brown body with cream belly, sleepy half-closed eyes, tiny arms folded.
19. **Snowpup** (common) — A fluffy snow-puppy creature. White fluffy fur, tiny ice-blue paws, snowflake patterns on ears, joyful expression.

### 💎 Crystal Epic chain (Line 11)
20. **Crystab** (common · baby) — A baby crystal-cub creature. Tiny pearl-and-rainbow geode body, small crystal horns, refraction sparkles inside.
21. **Prismling** (rare · child) — A young crystal-deer creature. Geometric crystalline body with prism shards as antlers, rainbow light scattering off it.
22. **Crystadragon** (epic · teen) — A majestic crystal-dragon creature. Glowing prismatic gem scales, wings of pure crystal, powerful stance, eyes glowing with inner light.

### ⚡ Storm Epic chain (Line 12)
23. **Zaplet** (common · baby) — A baby thunder-mouse creature. Yellow-and-cream round body with lightning-bolt cowlick, sparks crackling around cheeks, alert energetic pose.
24. **Voltspark** (rare · child) — A young thunder-cat creature. Bright yellow body with electric blue zigzags, lightning-shaped tail, fierce smile, paws crackling.
25. **Tempestor** (epic · teen) — A majestic storm-dragon creature. Storm-cloud body wrapped around a glowing yellow energy core, lightning crackling along its serpentine form.

### Filler uncommons + rare + legendary
26. **Petalfox** (uncommon) — A flower-fox creature. Pink-and-green fur, petal-shaped ears, blossom crown, vine-tail with flowers, soft elegant pose.
27. **Aquadot** (uncommon) — A polka-dot koi-fish creature. Blue and white body with elegant flowing fins, golden whiskers, calm wise smile, swimming pose.
28. **Magmite** (uncommon) — A lava-rock creature. Dark obsidian body with glowing orange magma cracks, small flame above head, fierce grin.
29. **Cloudkin** (rare · teen) — A fluffy cloud-rabbit creature. Soft white cloud-shaped body, cyan eye highlights, drifting cloud wisps, dreamy expression.
30. **Celestiaph** (legendary · mega) — A divine angel-pegasus creature. Stunning gold-and-pearl-white body, halo of sun rays, prismatic feathered wings spread wide, crown of light, regal awe-inspiring pose.

## One-shot batch script

Drop this in `scripts/generate-pet-art.ps1` and run when API is available:

```powershell
#!/usr/bin/env pwsh
# Generate all 30 launch pets in animal-chibi style.
# Prereqs: gemini CLI installed, GEMINI_API_KEY env var set, billing enabled.

$env:NANOBANANA_MODEL = "gemini-2.5-flash-image"   # cheaper than pro
$petDir = "$PSScriptRoot\..\web-game\assets\pets"
New-Item -ItemType Directory -Path $petDir -Force | Out-Null
Set-Location $petDir

$style = "Thick clean black outlines, saturated warm colors, soft rim lighting, magical glow. Transparent background, centered, no text, no watermark. Square format. Anime / digital painting style. High detail, polished."

$pets = @(
  @{id=1;  name='Emberlet';     prompt='Chibi cute animal monster — Emberlet, a baby fire firefly creature. Round bulbous orange-and-yellow gradient body, oversized head, tiny antennae, small translucent fairy wings with flame edges, ember-tail glowing.'},
  @{id=2;  name='Flarepup';     prompt='Chibi cute animal monster — Flarepup, a child fire-fox creature. Furry orange-red body with cream chest, large flame mane, two flame-tipped tails, mischievous grin showing fangs.'},
  @{id=3;  name='Volcanine';    prompt='Chibi cute animal monster — Volcanine, a teen fire-wolf creature. Sleek crimson and obsidian body, glowing magma plates along back, smoke from snout, fierce confident pose.'},
  @{id=4;  name='Bubblet';      prompt='Chibi cute animal monster — Bubblet, a baby water-tadpole creature. Soft aqua-blue body with white belly, oversized head, dew-drop tuft on top, tiny fin-like ears, shy gentle smile.'},
  @{id=5;  name='Splashkin';    prompt='Chibi cute animal monster — Splashkin, a child water-dolphin creature. Smooth aqua body with white underside, droplet markings, large flippers, playful smiling eyes, water swirl around it.'},
  @{id=6;  name='Tidewarden';   prompt='Chibi cute animal monster — Tidewarden, a teen water-whale creature. Deep blue and pearl-white body, coral crown growing from head, gentle wise eyes, water spout above, majestic pose.'},
  @{id=7;  name='Seedling';     prompt='Chibi cute animal monster — Seedling, a baby grass-rabbit creature. Pale green-and-cream body, single curled sprout on head like a horn, flower bud on chest, big curious eyes.'},
  @{id=8;  name='Sproutling';   prompt='Chibi cute animal monster — Sproutling, a child grass-fawn creature. Pale green and yellow body, blooming flower crown of three small flowers, vine-like tail, soft hooves.'},
  @{id=9;  name='Bloomheart';   prompt='Chibi cute animal monster — Bloomheart, a teen grass-deer creature. Leafy green body with antlers made of vines and pink cherry blossoms, butterflies orbiting, serene smile.'},
  @{id=10; name='Pebbit';       prompt='Chibi cute animal monster — Pebbit, a baby rock-mole creature. Round grey stone body with cute carved face, mossy green tuft on top, small flat paws.'},
  @{id=11; name='Boulderon';    prompt='Chibi cute animal monster — Boulderon, a child rock-armadillo creature. Grey-brown rocky shell with crystal nubs on shoulders, sturdy stance, determined expression.'},
  @{id=12; name='Glimmerlet';   prompt='Chibi cute animal monster — Glimmerlet, a baby light-moth creature. Pearl-white body with golden glimmer particles, tiny shimmering wings, soft halo around it, calm expression.'},
  @{id=13; name='Lumora';       prompt='Chibi cute animal monster — Lumora, a child light-fox creature. Sparkling silver-white fur with golden wing-tip markings on cheeks, ethereal glow, gentle smile.'},
  @{id=14; name='Wispy';        prompt='Chibi cute animal monster — Wispy, a baby dark-ghost creature. Translucent pale purple wisp body, smoke-trail tail, friendly closed half-moon eyes, tongue out.'},
  @{id=15; name='Shadewing';    prompt='Chibi cute animal monster — Shadewing, a child dark-bat creature. Dark purple velvet body, one big glowing yellow eye and one closed, small fangs, expressive ears.'},
  @{id=16; name='Pinkpuff';     prompt='Chibi cute animal monster — Pinkpuff, a round cotton-candy slime creature. Soft fluffy pink body, tiny stubby legs, dot eyes, perpetual content smile.'},
  @{id=17; name='Mintmite';     prompt='Chibi cute animal monster — Mintmite, a tiny grass-bug creature. Pale mint leaf-shaped body with six little insect legs, dewdrop on top, sweet smile.'},
  @{id=18; name='Cocoabean';    prompt='Chibi cute animal monster — Cocoabean, a round bean creature. Smooth brown body with cream belly, sleepy half-closed eyes, tiny arms folded.'},
  @{id=19; name='Snowpup';      prompt='Chibi cute animal monster — Snowpup, a fluffy snow-puppy creature. White fluffy fur, tiny ice-blue paws, snowflake patterns on ears, joyful expression.'},
  @{id=20; name='Crystab';      prompt='Chibi cute animal monster — Crystab, a baby crystal-cub creature. Tiny pearl-and-rainbow geode body, small crystal horns, refraction sparkles inside.'},
  @{id=21; name='Prismling';    prompt='Chibi cute animal monster — Prismling, a child crystal-deer creature. Geometric crystalline body with prism shards as antlers, rainbow light scattering off it.'},
  @{id=22; name='Crystadragon'; prompt='Chibi cute animal monster — Crystadragon, a teen crystal-dragon creature. Glowing prismatic gem scales, wings of pure crystal, powerful stance, eyes glowing with inner light.'},
  @{id=23; name='Zaplet';       prompt='Chibi cute animal monster — Zaplet, a baby thunder-mouse creature. Yellow-and-cream round body with lightning-bolt cowlick, sparks crackling around cheeks, alert energetic pose.'},
  @{id=24; name='Voltspark';    prompt='Chibi cute animal monster — Voltspark, a child thunder-cat creature. Bright yellow body with electric blue zigzags, lightning-shaped tail, fierce smile, paws crackling.'},
  @{id=25; name='Tempestor';    prompt='Chibi cute animal monster — Tempestor, a teen storm-dragon creature. Storm-cloud body wrapped around a glowing yellow energy core, lightning crackling along its serpentine form.'},
  @{id=26; name='Petalfox';     prompt='Chibi cute animal monster — Petalfox, a flower-fox creature. Pink-and-green fur, petal-shaped ears, blossom crown, vine-tail with flowers, soft elegant pose.'},
  @{id=27; name='Aquadot';      prompt='Chibi cute animal monster — Aquadot, a polka-dot koi-fish creature. Blue and white body with elegant flowing fins, golden whiskers, calm wise smile, swimming pose.'},
  @{id=28; name='Magmite';      prompt='Chibi cute animal monster — Magmite, a lava-rock creature. Dark obsidian body with glowing orange magma cracks, small flame above head, fierce grin.'},
  @{id=29; name='Cloudkin';     prompt='Chibi cute animal monster — Cloudkin, a fluffy cloud-rabbit creature. Soft white cloud-shaped body, cyan eye highlights, drifting cloud wisps, dreamy expression.'},
  @{id=30; name='Celestiaph';   prompt='Chibi cute animal monster — Celestiaph, a divine angel-pegasus creature. Stunning gold-and-pearl-white body, halo of sun rays, prismatic feathered wings spread wide, crown of light, regal awe-inspiring pose.'}
)

foreach ($p in $pets) {
  $fn = "{0:D2}-{1}.png" -f $p.id, $p.name.ToLower()
  if (Test-Path $fn) { Write-Host "  skip  $fn (exists)"; continue }
  Write-Host "  gen   $fn..."
  $fullPrompt = "$($p.prompt) $style"
  gemini --yolo "/generate '$fullPrompt' --count=1" | Out-Null
  # Rename whatever the CLI dropped to our canonical filename
  $latest = Get-ChildItem -File -Filter "*.png" | Where-Object { $_.Name -notlike "??-*.png" } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($latest) { Move-Item $latest.FullName $fn -Force }
  Start-Sleep -Seconds 3   # be polite + avoid per-minute rate limit
}

Write-Host ""
Write-Host "Done. Generated files:"
Get-ChildItem -File -Filter "??-*.png" | Sort-Object Name | Format-Table Name, @{N='KB';E={[math]::Round($_.Length/1KB,1)}}
```

## Wiring images into the game (one-time, after generation)

In `data.js`, every species has `id` matching the filename. To swap emoji → real art, add this to `ui.js`:

```js
function petArt(s, size = 96) {
  // Filename pattern: 01-emberlet.png  →  /assets/pets/01-emberlet.png
  const fn = `${String(s.id).padStart(2,'0')}-${s.name.toLowerCase()}.png`;
  return `<img class="pet-image" src="assets/pets/${fn}" alt="${s.name}"
               style="width:${size}px;height:${size}px"
               onerror="this.outerHTML='<span class=pet-emoji>${s.emoji}</span>'">`;
}
```

Then replace `${s.emoji}` with `${petArt(s, 108)}` in the pet card / dex card / shop card renders. The `onerror` handler falls back to the emoji if the image fails to load, so the game stays playable during partial generation.

Add CSS:
```css
.pet-image {
  object-fit: contain;
  image-rendering: -webkit-optimize-contrast;
  filter: drop-shadow(0 8px 16px rgba(0,0,0,0.18));
}
```

## Until then

The emoji + rarity halo + 3D drop-shadow + bob animation from v0.9 does a decent job of evoking the right vibe. The moment you have the real images, the swap is a single PR.
