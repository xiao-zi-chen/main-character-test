param(
    [string]$HostName = "connect.nma1.seetacloud.com",
    [int]$Port = 47721,
    [string]$User = "root",
    [string]$PublicKeyPath = "$env:USERPROFILE\.ssh\id_rsa.pub"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $PublicKeyPath)) {
    throw "Public key not found: $PublicKeyPath"
}

Write-Host "Installing public key to ${User}@${HostName}:${Port}"
Write-Host "You will be prompted for the server password once. The password is not saved."

$pub = Get-Content -Raw $PublicKeyPath
$remote = "umask 077; mkdir -p ~/.ssh; touch ~/.ssh/authorized_keys; cat >> ~/.ssh/authorized_keys; awk '!seen[`$0]++' ~/.ssh/authorized_keys > ~/.ssh/authorized_keys.tmp; mv ~/.ssh/authorized_keys.tmp ~/.ssh/authorized_keys; chmod 700 ~/.ssh; chmod 600 ~/.ssh/authorized_keys; echo SSH_KEY_INSTALLED"

$pub | ssh -o StrictHostKeyChecking=accept-new -p $Port "${User}@${HostName}" $remote

Write-Host "Testing key login..."
ssh -o BatchMode=yes -p $Port "${User}@${HostName}" "echo SSH_OK && hostname"
