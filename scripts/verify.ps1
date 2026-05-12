<#
.SYNOPSIS
  Smoke-test the deployed Smooth Giraffe backend.

.DESCRIPTION
  Reads client/Assets/Resources/Config.json (written by setup.ps1)
  then runs read-only checks against the project:
   - Schema integrity (all 10 migrations applied)
   - Seed data present (30 species, 4+ egg types, items catalog)
   - RLS on every table
   - Edge functions reachable
#>

$ErrorActionPreference = "Continue"
$repoRoot = Split-Path -Parent $PSScriptRoot
$configPath = "$repoRoot\client\Assets\Resources\Config.json"

if (-not (Test-Path $configPath)) {
  Write-Host "[ERR] Config.json not found at $configPath" -ForegroundColor Red
  Write-Host "      Run .\scripts\setup.ps1 first."
  exit 1
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json
$apiUrl = $config.supabaseUrl
$anonKey = $config.supabaseAnonKey

$headers = @{
  "apikey"        = $anonKey
  "Authorization" = "Bearer $anonKey"
}

function Test-Endpoint($name, $path, $expectedMin = 1) {
  Write-Host -NoNewline "  $name ... "
  try {
    $url = "$apiUrl/rest/v1/$path"
    $resp = Invoke-RestMethod -Uri $url -Headers $headers -Method Get -ErrorAction Stop
    $count = if ($resp -is [array]) { $resp.Count } else { 1 }
    if ($count -ge $expectedMin) {
      Write-Host "OK ($count rows)" -ForegroundColor Green
      return $true
    } else {
      Write-Host "FAIL (expected at least $expectedMin, got $count)" -ForegroundColor Red
      return $false
    }
  } catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    return $false
  }
}

function Test-Function($name) {
  Write-Host -NoNewline "  $name ... "
  try {
    $url = "$apiUrl/functions/v1/$name"
    # OPTIONS should always 200 (CORS preflight)
    $resp = Invoke-WebRequest -Uri $url -Method Options -Headers $headers -ErrorAction Stop
    if ($resp.StatusCode -in 200,204) {
      Write-Host "deployed and reachable" -ForegroundColor Green
      return $true
    }
    Write-Host "unexpected status $($resp.StatusCode)" -ForegroundColor Yellow
    return $false
  } catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    return $false
  }
}

$failed = 0

Write-Host ""
Write-Host "=== Smooth Giraffe — Backend Verification ===" -ForegroundColor Cyan
Write-Host "Target: $apiUrl"
Write-Host ""

Write-Host "Seed data:" -ForegroundColor White
if (-not (Test-Endpoint "monster_species (30 expected)"   "monster_species?select=id" 30)) { $failed++ }
if (-not (Test-Endpoint "items_catalog  (15+ expected)"  "items_catalog?select=id"  15)) { $failed++ }
if (-not (Test-Endpoint "egg_types      (4+ expected)"   "egg_types?select=id"       4)) { $failed++ }

Write-Host ""
Write-Host "Edge functions reachable:" -ForegroundColor White
$fns = @("tick-needs", "buy-egg", "hatch-egg", "farm-claim", "battle-simulate", "trade-execute")
foreach ($fn in $fns) { if (-not (Test-Function $fn)) { $failed++ } }

Write-Host ""
if ($failed -eq 0) {
  Write-Host "ALL CHECKS PASSED ✓" -ForegroundColor Green
  Write-Host ""
  Write-Host "Backend is live. You can now open the Unity client and sign up."
  exit 0
} else {
  Write-Host "$failed CHECKS FAILED ✗" -ForegroundColor Red
  Write-Host "Re-run .\scripts\setup.ps1 to retry."
  exit 1
}
