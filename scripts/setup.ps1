<#
.SYNOPSIS
  One-shot bootstrap for the Smooth Giraffe backend.

.DESCRIPTION
  - Verifies Supabase CLI is installed (installs to user-local path if missing)
  - Logs you into Supabase (opens browser, ~30s)
  - Links the local repo to a Supabase project (creates one if you don't have one)
  - Pushes the 10 SQL migrations
  - Deploys all 6 edge functions
  - Generates client/.env with your project URL + anon key for Unity

.EXAMPLE
  .\scripts\setup.ps1
  .\scripts\setup.ps1 -ProjectRef abcdefghij1234567890
#>

[CmdletBinding()]
param(
  [string]$ProjectRef = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Write-Step($msg) { Write-Host ""; Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  [ERR] $msg" -ForegroundColor Red }

# ============================================================
# 1. Supabase CLI
# ============================================================
Write-Step "Checking Supabase CLI"
$supabaseExe = "supabase"
$localExe = "$env:USERPROFILE\AppData\Local\Programs\supabase\supabase.exe"

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  if (Test-Path $localExe) {
    $supabaseExe = $localExe
    Write-Ok "Using local Supabase CLI: $localExe"
  } else {
    Write-Warn "Supabase CLI not found. Installing to $env:USERPROFILE\AppData\Local\Programs\supabase ..."
    $installDir = "$env:USERPROFILE\AppData\Local\Programs\supabase"
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/supabase/cli/releases/latest" -UserAgent "smooth-giraffe-setup"
    $asset = $release.assets | Where-Object { $_.name -like "*windows_amd64.tar.gz" } | Select-Object -First 1
    $dl = Join-Path $installDir $asset.name
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $dl -UseBasicParsing
    tar -xzf $dl -C $installDir
    Remove-Item $dl
    $supabaseExe = $localExe
    Write-Ok "Installed $($release.tag_name)"
  }
} else {
  Write-Ok "Supabase CLI present: $(supabase --version)"
}

# ============================================================
# 2. Login
# ============================================================
Write-Step "Checking Supabase login"
$loggedIn = $false
try {
  $projectsRaw = & $supabaseExe projects list 2>&1
  if ($LASTEXITCODE -eq 0) { $loggedIn = $true }
} catch { }

if (-not $loggedIn) {
  Write-Warn "Not logged in. Opening browser for auth..."
  & $supabaseExe login
  if ($LASTEXITCODE -ne 0) { Write-Err "Login failed"; exit 1 }
}
Write-Ok "Logged in"

# ============================================================
# 3. Get/Choose project ref
# ============================================================
Write-Step "Selecting Supabase project"
if (-not $ProjectRef) {
  Write-Host "  Your existing projects:"
  & $supabaseExe projects list
  Write-Host ""
  $ProjectRef = Read-Host "Paste the Reference ID of the project to use (or press Enter to create a new one)"
}

if (-not $ProjectRef) {
  $orgList = & $supabaseExe orgs list --output json | ConvertFrom-Json
  $orgId = $orgList[0].id
  $name = Read-Host "Project name (e.g. smooth-giraffe)"
  $region = Read-Host "Region (e.g. us-east-1, eu-west-1, ap-southeast-1)"
  $dbPassword = Read-Host "Database password (save this somewhere!)" -AsSecureString
  $plainPwd = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))
  & $supabaseExe projects create $name --org-id $orgId --region $region --db-password $plainPwd
  Write-Host "Refresh project list:"
  & $supabaseExe projects list
  $ProjectRef = Read-Host "Paste the Reference ID of the newly created project"
}

Write-Ok "Using project: $ProjectRef"

# ============================================================
# 4. Link
# ============================================================
Write-Step "Linking local repo to Supabase project"
Set-Location "$repoRoot\server"
& $supabaseExe link --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { Write-Err "Link failed"; exit 1 }
Write-Ok "Linked"

# ============================================================
# 5. Push migrations
# ============================================================
Write-Step "Pushing migrations (10 SQL files)"
& $supabaseExe db push
if ($LASTEXITCODE -ne 0) { Write-Err "Migration push failed"; exit 1 }
Write-Ok "Schema deployed"

# ============================================================
# 6. Deploy edge functions
# ============================================================
Write-Step "Deploying edge functions"
$functions = @("tick-needs", "buy-egg", "hatch-egg", "farm-claim", "battle-simulate", "trade-execute")
foreach ($fn in $functions) {
  Write-Host "  Deploying $fn..."
  $extraArgs = @()
  if ($fn -eq "tick-needs") { $extraArgs += "--no-verify-jwt" }
  & $supabaseExe functions deploy $fn @extraArgs
  if ($LASTEXITCODE -ne 0) { Write-Warn "Deploy of $fn failed (continuing)"; continue }
  Write-Ok "$fn deployed"
}

# ============================================================
# 7. Cron secret
# ============================================================
Write-Step "Generating CRON_SECRET for tick-needs"
$cronSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
& $supabaseExe secrets set "CRON_SECRET=$cronSecret"
Write-Ok "CRON_SECRET set"
Write-Host "  (You will need this when scheduling the cron job in Supabase Dashboard)"
Write-Host "  CRON_SECRET = $cronSecret"

# ============================================================
# 8. Write Unity config
# ============================================================
Write-Step "Writing Unity client config"
Set-Location $repoRoot
$apiUrl = "https://$ProjectRef.supabase.co"
$anonKeyRaw = & $supabaseExe projects api-keys --project-ref $ProjectRef --output json | ConvertFrom-Json
$anonKey = ($anonKeyRaw | Where-Object { $_.name -eq "anon" }).api_key

$configPath = "$repoRoot\client\Assets\Resources\Config.json"
New-Item -ItemType Directory -Path (Split-Path $configPath) -Force | Out-Null
$config = @{
  supabaseUrl     = $apiUrl
  supabaseAnonKey = $anonKey
  cronSecret      = $cronSecret
} | ConvertTo-Json
Set-Content -Path $configPath -Value $config -Encoding UTF8
Write-Ok "Wrote $configPath"
Write-Warn "Config.json is gitignored — never commit it."

# ============================================================
# Done
# ============================================================
Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host " SETUP COMPLETE" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Manual steps remaining (must do in Supabase Dashboard):"
Write-Host ""
Write-Host "  1. Schedule the tick-needs cron:"
Write-Host "       Database -> Cron Jobs -> New cron job"
Write-Host "       Schedule: 0 * * * *  (every hour at :00)"
Write-Host "       Method: POST"
Write-Host "       URL: $apiUrl/functions/v1/tick-needs"
Write-Host "       Headers: X-Cron-Secret: $cronSecret"
Write-Host ""
Write-Host "  2. Open Unity project at: $repoRoot\client"
Write-Host "     (Config.json will auto-load via Resources/)"
Write-Host ""
Write-Host "  3. Run verify script when ready:"
Write-Host "       .\scripts\verify.ps1"
Write-Host ""
