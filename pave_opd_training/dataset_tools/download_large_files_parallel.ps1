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

function Complete-File {
    param([string]$Path, [Int64]$Bytes)
    if (-not (Test-Path -LiteralPath $Path)) { return $false }
    return ((Get-Item -LiteralPath $Path).Length -eq $Bytes)
}

$files = @(
    @{
        Name = "coco_train2014";
        Url = "http://images.cocodataset.org/zips/train2014.zip";
        Out = "coco2014\train2014.zip";
        Bytes = 13510573713
    },
    @{
        Name = "coco_val2014";
        Url = "http://images.cocodataset.org/zips/val2014.zip";
        Out = "coco2014\val2014.zip";
        Bytes = 6645013297
    },
    @{
        Name = "vg_images_part1";
        Url = "https://cs.stanford.edu/people/rak248/VG_100K_2/images.zip";
        Out = "visual_genome\images.zip";
        Bytes = 9731705982
    },
    @{
        Name = "vg_images_part2";
        Url = "https://cs.stanford.edu/people/rak248/VG_100K_2/images2.zip";
        Out = "visual_genome\images2.zip";
        Bytes = 5471658058
    },
    @{
        Name = "textvqa_train_val_images";
        Url = "https://dl.fbaipublicfiles.com/textvqa/images/train_val_images.zip";
        Out = "textvqa\train_val_images.zip";
        Bytes = 7072297970
    }
)

New-Dir $Root
New-Dir (Join-Path $Root "_logs")
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$started = @()

foreach ($f in $files) {
    $out = Join-Path $Root $f.Out
    New-Dir (Split-Path -Parent $out)
    if (Complete-File -Path $out -Bytes ([Int64]$f.Bytes)) {
        Write-Host "[skip] $($f.Name) complete"
        continue
    }

    $stdout = Join-Path $Root ("_logs\large_$($f.Name)_$stamp.out.log")
    $stderr = Join-Path $Root ("_logs\large_$($f.Name)_$stamp.err.log")
    $args = @(
        "--noproxy", "*",
        "--location",
        "--fail",
        "--retry", "30",
        "--retry-delay", "5",
        "--connect-timeout", "30",
        "--continue-at", "-",
        "--output", $out,
        $f.Url
    )
    $p = Start-Process -FilePath "curl.exe" -ArgumentList $args -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    $started += [PSCustomObject]@{
        Name = $f.Name
        Pid = $p.Id
        Output = $out
        ExpectedBytes = [Int64]$f.Bytes
        Log = $stderr
    }
    Write-Host "[start] $($f.Name) pid=$($p.Id) -> $out"
}

$started | Format-Table -AutoSize
