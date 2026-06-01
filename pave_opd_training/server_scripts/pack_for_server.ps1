$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path "."
$PackageDir = Join-Path $ProjectRoot "server_package"
$ZipPath = Join-Path $ProjectRoot "pave_opd_server_package.zip"

if (Test-Path $PackageDir) {
    Remove-Item -Recurse -Force $PackageDir
}
if (Test-Path $ZipPath) {
    Remove-Item -Force $ZipPath
}

New-Item -ItemType Directory -Path $PackageDir | Out-Null
Copy-Item -Recurse -Path (Join-Path $ProjectRoot "pave_opd_training") -Destination $PackageDir
Copy-Item -Path (Join-Path $ProjectRoot "pave_opd_training_plan.md") -Destination $PackageDir

Get-ChildItem -Path $PackageDir -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force
Get-ChildItem -Path $PackageDir -Recurse -File -Include "*.pyc", "*.pyo" | Remove-Item -Force

Compress-Archive -Path (Join-Path $PackageDir "*") -DestinationPath $ZipPath
Write-Host "Created $ZipPath"
