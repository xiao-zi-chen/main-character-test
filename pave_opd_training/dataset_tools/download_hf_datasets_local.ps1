param(
    [string]$Root = ""
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = Join-Path $ProjectRoot "raw_datasets"
}

function New-Dir {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function Start-HfDownload {
    param(
        [string]$Name,
        [string]$Repo,
        [string]$LocalDir,
        [string[]]$Includes
    )

    New-Dir $LocalDir
    $scriptPath = Join-Path $Root ("_logs\hf_$Name.ps1")
    $includeArgs = ($Includes | ForEach-Object { "--include `"$($_)`"" }) -join " "
    $content = @"
`$ErrorActionPreference = "Stop"
`$env:HF_ENDPOINT = "https://hf-mirror.com"
`$env:NO_PROXY = "*"
`$env:no_proxy = "*"
hf download "$Repo" --type dataset --local-dir "$LocalDir" $includeArgs
"@
    Set-Content -LiteralPath $scriptPath -Value $content -Encoding ASCII

    $stdout = Join-Path $Root ("_logs\hf_$Name.out.log")
    $stderr = Join-Path $Root ("_logs\hf_$Name.err.log")
    $p = Start-Process -FilePath "powershell.exe" `
        -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $scriptPath) `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr `
        -PassThru
    [PSCustomObject]@{
        Name = $Name
        Pid = $p.Id
        Repo = $Repo
        LocalDir = $LocalDir
        Log = $stderr
    }
}

New-Dir $Root
New-Dir (Join-Path $Root "_logs")

$jobs = @()
$jobs += Start-HfDownload -Name "llava_instruct_150k" -Repo "liuhaotian/LLaVA-Instruct-150K" -LocalDir (Join-Path $Root "llava_instruct_150k") -Includes @("*.json", "README.md")
$jobs += Start-HfDownload -Name "rlhf_v" -Repo "openbmb/RLHF-V-Dataset" -LocalDir (Join-Path $Root "rlhf_v") -Includes @("*.parquet", "README.md")
$jobs += Start-HfDownload -Name "rlaif_v" -Repo "openbmb/RLAIF-V-Dataset" -LocalDir (Join-Path $Root "rlaif_v") -Includes @("*.parquet", "README.md")
$jobs += Start-HfDownload -Name "sharegpt4v" -Repo "Lin-Chen/ShareGPT4V" -LocalDir (Join-Path $Root "sharegpt4v") -Includes @("*.json", "README.md")

$jobs | Format-Table -AutoSize
