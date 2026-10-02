$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$siteUrl = 'http://127.0.0.1:5173/'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) { throw 'Please install Node.js 20.19+ or 22.12+ first: https://nodejs.org/' }
$viteEntry = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'
if (-not (Test-Path -LiteralPath $viteEntry)) {
    Push-Location -LiteralPath $projectRoot
    try { & npm.cmd install; if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' } }
    finally { Pop-Location }
}
$alreadyRunning = $false
try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $siteUrl -TimeoutSec 2
    $alreadyRunning = $response.Content -match 'main-character-casting'
    if (-not $alreadyRunning) { throw 'Port 5173 is occupied by another application.' }
} catch {
    if ($_.Exception.Message -match 'occupied') { throw }
}
if (-not $alreadyRunning) {
    $logDirectory = Join-Path $projectRoot '.work'
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    $serverProcess = Start-Process -FilePath $nodeCommand.Source -ArgumentList @(('"' + $viteEntry + '"'), '--host', '127.0.0.1', '--port', '5173', '--strictPort') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'site-server.log') -RedirectStandardError (Join-Path $logDirectory 'site-server-error.log')
    $serverReady = $false
    for ($attempt = 0; $attempt -lt 25; $attempt++) {
        Start-Sleep -Milliseconds 250
        try { $startupResponse = Invoke-WebRequest -UseBasicParsing -Uri $siteUrl -TimeoutSec 1; if ($startupResponse.Content -match 'main-character-casting') { $serverReady = $true; break } } catch {}
        if ($serverProcess.HasExited) { throw 'Server stopped. Check .work/site-server-error.log.' }
    }
    if (-not $serverReady) { throw 'Server did not become ready. Check .work/site-server.log.' }
}
Write-Host "Website ready: $siteUrl"
Start-Process $siteUrl
