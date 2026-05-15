#!/usr/bin/env pwsh
# ============================================================
# generate-pet-art.ps1
# Generate launch pets via Pollinations.ai (free, no API key).
#
# Usage:
#   .\scripts\generate-pet-art.ps1                # generate 5/day (default)
#   .\scripts\generate-pet-art.ps1 -PetIds 1,2,3  # specific ones
#   .\scripts\generate-pet-art.ps1 -All           # all 30 in one go
#   .\scripts\generate-pet-art.ps1 -Force         # overwrite existing
# ============================================================

[CmdletBinding()]
param(
  [int[]]$PetIds = @(),
  [switch]$All,
  [switch]$Force
)

Add-Type -AssemblyName System.Web 2>$null
$petDir = Join-Path $PSScriptRoot "..\web-game\assets\pets"
New-Item -ItemType Directory -Path $petDir -Force | Out-Null
Set-Location $petDir

$style = "Thick clean black outlines, saturated colors, soft rim lighting, magical glow. Anime digital painting style. High detail, polished. Single character only, full body shown, no text, no watermark. PURE WHITE BACKGROUND, plain white background, isolated on white, sticker style on white background, no scenery, no dark backdrop, no grey backdrop."

$pets = @(
  @{id=1;  name='emberlet';     desc='baby fire firefly creature. Round bulbous orange-and-yellow gradient body, oversized head, huge sparkly anime eyes with catch lights, curved smile, tiny antennae, small translucent fairy wings with flame edges, ember-tail glowing.'},
  @{id=2;  name='flarepup';     desc='child fire fox creature. Furry orange-red body with cream chest, oversized head with huge sparkly anime eyes, large flame mane, two flame-tipped tails, mischievous grin showing tiny fangs.'},
  @{id=3;  name='volcanine';    desc='teen fire wolf creature. Sleek crimson and obsidian body, oversized head with sharp sparkly anime eyes, glowing magma plates along back, smoke wisps from snout, fierce confident pose.'},
  @{id=4;  name='bubblet';      desc='baby water tadpole creature. Soft aqua-blue body with white belly, oversized head with huge sparkly anime eyes, dew-drop tuft on top, tiny fin-like ears, shy gentle smile.'},
  @{id=5;  name='splashkin';    desc='child water dolphin creature. Smooth aqua body with white underside, oversized head with playful anime eyes, droplet markings, large flippers, water swirl orbiting, happy smile.'},
  @{id=6;  name='tidewarden';   desc='teen water whale creature. Deep blue and pearl-white body, oversized head with wise gentle anime eyes, coral crown growing from head, water spout above, majestic serene pose.'},
  @{id=7;  name='seedling';     desc='baby grass rabbit creature. Pale green-and-cream body, oversized head with big curious anime eyes, single curled sprout on head like a horn, flower bud on chest, soft smile.'},
  @{id=8;  name='sproutling';   desc='child grass fawn creature. Pale green and yellow body, oversized head with gentle anime eyes, blooming flower crown of three small flowers, vine-like tail, soft hooves.'},
  @{id=9;  name='bloomheart';   desc='teen grass deer creature. Leafy green body with antlers made of vines and pink cherry blossoms, oversized head with serene anime eyes, butterflies orbiting, gentle smile.'},
  @{id=10; name='pebbit';       desc='baby rock mole creature. Round grey stone body with cute carved face, mossy green tuft on top, oversized head with sparkly anime eyes, small flat paws, gentle smile.'},
  @{id=11; name='boulderon';    desc='child rock armadillo creature. Grey-brown rocky shell with crystal nubs on shoulders, oversized head with determined anime eyes, sturdy four-legged stance.'},
  @{id=12; name='glimmerlet';   desc='baby light moth creature. Pearl-white body with golden glimmer particles, oversized head with luminous anime eyes, tiny shimmering wings, soft halo around it, calm expression.'},
  @{id=13; name='lumora';       desc='child light fox creature. Sparkling silver-white fur with golden wing-tip markings on cheeks, oversized head with luminous anime eyes, ethereal glow, gentle smile.'},
  @{id=14; name='wispy';        desc='baby dark ghost creature. Translucent pale purple wisp body, smoke-trail tail, oversized head with friendly closed half-moon eyes, tongue out playful.'},
  @{id=15; name='shadewing';    desc='child dark bat creature. Dark purple velvet body, oversized head with one big glowing yellow anime eye and one closed, small fangs, expressive ears.'},
  @{id=16; name='pinkpuff';     desc='round cotton-candy slime creature. Soft fluffy pink body, oversized head with dot anime eyes, tiny stubby legs, perpetual content smile.'},
  @{id=17; name='mintmite';     desc='tiny grass bug creature. Pale mint leaf-shaped body with six little insect legs, oversized head with sweet anime eyes, dewdrop on top, sweet smile.'},
  @{id=18; name='cocoabean';    desc='round bean creature. Smooth brown body with cream belly, oversized head with sleepy half-closed anime eyes, tiny arms folded.'},
  @{id=19; name='snowpup';      desc='fluffy snow puppy creature. White fluffy fur, oversized head with bright ice-blue anime eyes, tiny ice-blue paws, snowflake patterns on ears, joyful expression.'},
  @{id=20; name='crystab';      desc='baby crystal cub creature. Tiny pearl-and-rainbow geode body, oversized head with shimmering anime eyes, small crystal horns, refraction sparkles inside.'},
  @{id=21; name='prismling';    desc='child crystal deer creature. Geometric crystalline body with prism shards as antlers, oversized head with rainbow-light anime eyes, rainbow light scattering off it.'},
  @{id=22; name='crystadragon'; desc='teen crystal dragon creature. Glowing prismatic gem scales, wings of pure crystal, oversized head with luminous anime eyes glowing with inner light, powerful stance.'},
  @{id=23; name='zaplet';       desc='baby thunder mouse creature. Yellow-and-cream round body with lightning-bolt cowlick, oversized head with alert anime eyes, sparks crackling around cheeks, energetic pose.'},
  @{id=24; name='voltspark';    desc='child thunder cat creature. Bright yellow body with electric blue zigzags, oversized head with fierce anime eyes, lightning-shaped tail, paws crackling with electricity.'},
  @{id=25; name='tempestor';    desc='teen storm dragon creature. Storm-cloud body wrapped around a glowing yellow energy core, lightning crackling along its serpentine form, oversized head with powerful anime eyes.'},
  @{id=26; name='petalfox';     desc='flower fox creature. Pink-and-green fur, petal-shaped ears, blossom crown, vine-tail with flowers, oversized head with gentle anime eyes, soft elegant pose.'},
  @{id=27; name='aquadot';      desc='polka-dot koi fish creature. Blue and white body with elegant flowing fins, oversized head with calm wise anime eyes, golden whiskers, swimming pose.'},
  @{id=28; name='magmite';      desc='lava-rock creature. Dark obsidian body with glowing orange magma cracks, oversized head with fierce anime eyes, small flame above head, fierce grin.'},
  @{id=29; name='cloudkin';     desc='fluffy cloud rabbit creature. Soft white cloud-shaped body, oversized head with dreamy cyan anime eyes, drifting cloud wisps, peaceful expression.'},
  @{id=30; name='celestiaph';   desc='divine angel pegasus creature, legendary tier. Stunning gold-and-pearl-white body, halo of sun rays, prismatic feathered wings spread wide, oversized head with awe-inspiring radiant anime eyes, crown of light, regal pose.'}
)

# Determine which pets to process
if ($PetIds.Count -gt 0) {
  $pets = $pets | Where-Object { $PetIds -contains $_.id }
} elseif (-not $All) {
  # Default: 5/day mode — find the next 5 unfinished pets
  $existing = Get-ChildItem -File -Filter "??-*.png" -ErrorAction SilentlyContinue |
              ForEach-Object { [int]($_.Name -replace '^(\d{2})-.*', '$1') }
  $pets = $pets | Where-Object { $existing -notcontains $_.id } | Select-Object -First 5
  if ($pets.Count -eq 0) {
    Write-Host "All 30 pets already generated. Use -Force to regenerate or -PetIds to redo specific ones." -ForegroundColor Yellow
    exit 0
  }
}

Write-Host ""
Write-Host "=== Smooth Giraffe pet art generator (Pollinations.ai) ===" -ForegroundColor Cyan
Write-Host "  Output: $petDir"
Write-Host "  Pets:   $($pets.Count) to process"
Write-Host ""

$generated = 0; $skipped = 0; $failed = 0
foreach ($p in $pets) {
  $fn = "{0:D2}-{1}.png" -f $p.id, $p.name
  if ((Test-Path $fn) -and -not $Force) {
    Write-Host "  skip  $fn (exists)" -ForegroundColor DarkGray
    $skipped++
    continue
  }
  $fullPrompt = "Chibi cute animal monster, $($p.desc) $style"
  $encoded    = [System.Web.HttpUtility]::UrlEncode($fullPrompt)
  $seed       = $p.id * 7
  $url        = "https://image.pollinations.ai/prompt/$encoded`?width=512&height=512&nologo=true&model=flux&enhance=true&seed=$seed"

  Write-Host "  gen   $fn..." -NoNewline
  try {
    Invoke-WebRequest -Uri $url -OutFile $fn -TimeoutSec 120 -UseBasicParsing
    $kb = [math]::Round((Get-Item $fn).Length/1KB, 1)
    Write-Host " OK ($kb KB)" -ForegroundColor Green
    $generated++
  } catch {
    Write-Host " FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $failed++
  }
  Start-Sleep -Seconds 2     # politeness pause
}

Write-Host ""
Write-Host "=== Done generating ===" -ForegroundColor Cyan
Write-Host "  Generated: $generated · Skipped: $skipped · Failed: $failed"
Write-Host ""

# Auto-remove white backgrounds via flood-fill — makes PNGs truly transparent
if ($generated -gt 0) {
  Write-Host "Removing white backgrounds (flood-fill)..." -ForegroundColor Cyan
  $pyCandidates = @(
    "C:\Users\Zen See\AppData\Local\Python\pythoncore-3.14-64\python.exe",
    "python.exe",
    "python3.exe"
  )
  $py = $pyCandidates | Where-Object { Get-Command $_ -ErrorAction SilentlyContinue } | Select-Object -First 1
  if ($py) {
    $script = Join-Path $PSScriptRoot "remove-pet-bg.py"
    & $py $script
  } else {
    Write-Host "  WARN: no Python found, skipping bg removal" -ForegroundColor Yellow
    Write-Host "        Install Python + Pillow + numpy then run scripts/remove-pet-bg.py" -ForegroundColor Yellow
  }
}
Write-Host ""
Write-Host "All pet files:"
Get-ChildItem -File -Filter "??-*.png" -ErrorAction SilentlyContinue | Sort-Object Name |
  Format-Table Name, @{N='KB';E={[math]::Round($_.Length/1KB,1)}}
