#!/usr/bin/env pwsh
# ============================================================
# generate-pet-art.ps1
# Generate all 30 launch pets in animal-chibi style using Nano Banana.
#
# Prereqs:
#   - gemini CLI installed
#   - $env:GEMINI_API_KEY set
#   - billing enabled at https://aistudio.google.com (~$1.20 for all 30)
#
# Usage:
#   .\scripts\generate-pet-art.ps1
#   .\scripts\generate-pet-art.ps1 -PetIds 1,2,3   # regenerate specific ones
#   .\scripts\generate-pet-art.ps1 -Force          # overwrite existing
# ============================================================

[CmdletBinding()]
param(
  [int[]]$PetIds = @(),
  [switch]$Force
)

$env:NANOBANANA_MODEL = "gemini-2.5-flash-image"
$petDir = Join-Path $PSScriptRoot "..\web-game\assets\pets"
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

# Filter to requested IDs (or all)
if ($PetIds.Count -gt 0) {
  $pets = $pets | Where-Object { $PetIds -contains $_.id }
}

Write-Host ""
Write-Host "=== Smooth Giraffe pet art generator ===" -ForegroundColor Cyan
Write-Host "  Style:  animal-chibi · thick outlines · saturated · glow"
Write-Host "  Output: $petDir"
Write-Host "  Pets:   $($pets.Count) to process"
Write-Host ""

$generated = 0; $skipped = 0; $failed = 0
foreach ($p in $pets) {
  $fn = "{0:D2}-{1}.png" -f $p.id, $p.name.ToLower()
  if ((Test-Path $fn) -and -not $Force) {
    Write-Host "  skip  $fn (exists, use -Force to overwrite)" -ForegroundColor DarkGray
    $skipped++
    continue
  }

  Write-Host "  gen   $fn..." -NoNewline
  $fullPrompt = "$($p.prompt) $style"
  $cmd = "/generate '$($fullPrompt -replace `"'`", `"''`")' --count=1"
  $out = gemini --yolo $cmd 2>&1 | Out-String

  if ($LASTEXITCODE -ne 0) {
    Write-Host " FAILED" -ForegroundColor Red
    $failed++
    # Rate-limit?  Back off and try next.
    if ($out -match "429|quota") { Start-Sleep -Seconds 30 }
    continue
  }

  # Find the freshly-created PNG and rename it
  $latest = Get-ChildItem -File -Filter "*.png" |
            Where-Object { $_.Name -notmatch "^\d{2}-" } |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
  if ($latest) {
    Move-Item $latest.FullName $fn -Force
    Write-Host " OK" -ForegroundColor Green
    $generated++
  } else {
    Write-Host " (no output file found)" -ForegroundColor Yellow
    $failed++
  }
  Start-Sleep -Seconds 3   # politeness pause
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host "  Generated: $generated"
Write-Host "  Skipped:   $skipped"
Write-Host "  Failed:    $failed"
Write-Host ""
Write-Host "Files:"
Get-ChildItem -File -Filter "??-*.png" | Sort-Object Name |
  Format-Table Name, @{N='KB';E={[math]::Round($_.Length/1KB,1)}}
