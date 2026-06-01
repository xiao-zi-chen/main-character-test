param(
    [string]$HostName = "connect.nma1.seetacloud.com",
    [int]$Port = 47721,
    [string]$User = "root",
    [string]$RemoteDir = "/root/pave_opd_project",
    [string]$Package = "pave_opd_server_package.zip"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Package)) {
    throw "Package not found: $Package. Run pack_for_server.ps1 first."
}

Write-Host "Creating remote directory..."
ssh -p $Port "$User@$HostName" "mkdir -p '$RemoteDir'"

Write-Host "Uploading $Package..."
scp -P $Port $Package "${User}@${HostName}:$RemoteDir/"

Write-Host "Unpacking on server..."
ssh -p $Port "$User@$HostName" "cd '$RemoteDir' && unzip -o '$Package'"

Write-Host "Done. Connect with:"
Write-Host "ssh -p $Port $User@$HostName"
