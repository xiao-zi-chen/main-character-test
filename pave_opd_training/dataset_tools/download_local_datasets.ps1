param(
    [string]$Root = "",
    [switch]$SkipHuggingFace,
    [switch]$SkipLargeImages
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

function Format-Bytes {
    param([Int64]$Bytes)
    if ($Bytes -ge 1GB) { return ("{0:N2} GB" -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1MB) { return ("{0:N2} MB" -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ("{0:N2} KB" -f ($Bytes / 1KB)) }
    return "$Bytes B"
}

function Test-CompleteFile {
    param(
        [string]$Path,
        [Int64]$ExpectedBytes
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        return $false
    }
    if ($ExpectedBytes -le 0) {
        return ((Get-Item -LiteralPath $Path).Length -gt 0)
    }
    return ((Get-Item -LiteralPath $Path).Length -eq $ExpectedBytes)
}

function Download-File {
    param(
        [string]$Name,
        [string]$Url,
        [string]$OutFile,
        [Int64]$ExpectedBytes = 0
    )

    New-Dir (Split-Path -Parent $OutFile)
    if (Test-CompleteFile -Path $OutFile -ExpectedBytes $ExpectedBytes) {
        Write-Host "[skip] $Name already complete: $OutFile"
        return
    }

    if (Test-Path -LiteralPath $OutFile) {
        $cur = (Get-Item -LiteralPath $OutFile).Length
        Write-Host "[resume] $Name current=$(Format-Bytes $cur) expected=$(Format-Bytes $ExpectedBytes)"
    } else {
        Write-Host "[download] $Name expected=$(Format-Bytes $ExpectedBytes)"
    }

    & curl.exe `
        --noproxy "*" `
        --location `
        --fail `
        --retry 20 `
        --retry-delay 5 `
        --connect-timeout 30 `
        --continue-at - `
        --output $OutFile `
        $Url

    if (-not (Test-CompleteFile -Path $OutFile -ExpectedBytes $ExpectedBytes)) {
        $actual = if (Test-Path -LiteralPath $OutFile) { (Get-Item -LiteralPath $OutFile).Length } else { 0 }
        throw "Incomplete download: $Name actual=$(Format-Bytes $actual) expected=$(Format-Bytes $ExpectedBytes)"
    }
    Write-Host "[done] $Name -> $OutFile"
}

function Download-HfDataset {
    param(
        [string]$Repo,
        [string]$LocalDir,
        [string[]]$Includes
    )

    New-Dir $LocalDir
    $env:HF_ENDPOINT = "https://hf-mirror.com"
    $env:NO_PROXY = "*"
    $env:no_proxy = "*"

    foreach ($include in $Includes) {
        Write-Host "[hf] $Repo include=$include"
        & hf download $Repo `
            --type dataset `
            --local-dir $LocalDir `
            --include $include
    }
}

New-Dir $Root
New-Dir (Join-Path $Root "_logs")
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$log = Join-Path $Root "_logs\download_$stamp.log"
Start-Transcript -Path $log -Append | Out-Null

try {
    Write-Host "Root: $Root"
    Write-Host "Log:  $log"

    $existingCocoAnn = Join-Path $ProjectRoot "annotations_trainval2014.zip"
    $cocoAnnOut = Join-Path $Root "coco2014\annotations_trainval2014.zip"
    New-Dir (Split-Path -Parent $cocoAnnOut)
    if ((Test-Path -LiteralPath $existingCocoAnn) -and (-not (Test-Path -LiteralPath $cocoAnnOut))) {
        Copy-Item -LiteralPath $existingCocoAnn -Destination $cocoAnnOut
        Write-Host "[copy] existing COCO annotations -> $cocoAnnOut"
    }

    $smallFiles = @(
        @{
            Name = "COCO 2014 annotations";
            Url = "http://images.cocodataset.org/annotations/annotations_trainval2014.zip";
            Out = "coco2014\annotations_trainval2014.zip";
            Bytes = 252872794
        },
        @{
            Name = "Visual Genome image metadata";
            Url = "https://homes.cs.washington.edu/~ranjay/visualgenome/data/dataset/image_data.json.zip";
            Out = "visual_genome\annotations\image_data.json.zip";
            Bytes = 1780854
        },
        @{
            Name = "Visual Genome objects";
            Url = "https://homes.cs.washington.edu/~ranjay/visualgenome/data/dataset/objects.json.zip";
            Out = "visual_genome\annotations\objects.json.zip";
            Bytes = 55323929
        },
        @{
            Name = "Visual Genome attributes";
            Url = "https://homes.cs.washington.edu/~ranjay/visualgenome/data/dataset/attributes.json.zip";
            Out = "visual_genome\annotations\attributes.json.zip";
            Bytes = 83280561
        },
        @{
            Name = "Visual Genome relationships";
            Url = "https://homes.cs.washington.edu/~ranjay/visualgenome/data/dataset/relationships.json.zip";
            Out = "visual_genome\annotations\relationships.json.zip";
            Bytes = 77904473
        },
        @{
            Name = "Visual Genome region descriptions";
            Url = "https://homes.cs.washington.edu/~ranjay/visualgenome/data/dataset/region_descriptions.json.zip";
            Out = "visual_genome\annotations\region_descriptions.json.zip";
            Bytes = 127377968
        },
        @{
            Name = "Visual Genome question answers";
            Url = "https://homes.cs.washington.edu/~ranjay/visualgenome/data/dataset/question_answers.json.zip";
            Out = "visual_genome\annotations\question_answers.json.zip";
            Bytes = 24776315
        },
        @{
            Name = "Visual Genome scene graphs";
            Url = "https://homes.cs.washington.edu/~ranjay/visualgenome/data/dataset/scene_graphs.json.zip";
            Out = "visual_genome\annotations\scene_graphs.json.zip";
            Bytes = 114018504
        },
        @{
            Name = "Visual Genome synsets";
            Url = "https://homes.cs.washington.edu/~ranjay/visualgenome/data/dataset/synsets.json.zip";
            Out = "visual_genome\annotations\synsets.json.zip";
            Bytes = 595386
        },
        @{
            Name = "VQA-v2 train questions";
            Url = "https://s3.amazonaws.com/cvmlp/vqa/mscoco/vqa/v2_Questions_Train_mscoco.zip";
            Out = "vqav2\v2_Questions_Train_mscoco.zip";
            Bytes = 7239401
        },
        @{
            Name = "VQA-v2 val questions";
            Url = "https://s3.amazonaws.com/cvmlp/vqa/mscoco/vqa/v2_Questions_Val_mscoco.zip";
            Out = "vqav2\v2_Questions_Val_mscoco.zip";
            Bytes = 3494929
        },
        @{
            Name = "VQA-v2 train annotations";
            Url = "https://s3.amazonaws.com/cvmlp/vqa/mscoco/vqa/v2_Annotations_Train_mscoco.zip";
            Out = "vqav2\v2_Annotations_Train_mscoco.zip";
            Bytes = 21708861
        },
        @{
            Name = "VQA-v2 val annotations";
            Url = "https://s3.amazonaws.com/cvmlp/vqa/mscoco/vqa/v2_Annotations_Val_mscoco.zip";
            Out = "vqav2\v2_Annotations_Val_mscoco.zip";
            Bytes = 10518930
        },
        @{
            Name = "TextVQA train";
            Url = "https://dl.fbaipublicfiles.com/textvqa/data/TextVQA_0.5.1_train.json";
            Out = "textvqa\TextVQA_0.5.1_train.json";
            Bytes = 21634937
        },
        @{
            Name = "TextVQA val";
            Url = "https://dl.fbaipublicfiles.com/textvqa/data/TextVQA_0.5.1_val.json";
            Out = "textvqa\TextVQA_0.5.1_val.json";
            Bytes = 3116162
        },
        @{
            Name = "TextVQA test";
            Url = "https://dl.fbaipublicfiles.com/textvqa/data/TextVQA_0.5.1_test.json";
            Out = "textvqa\TextVQA_0.5.1_test.json";
            Bytes = 2770520
        },
        @{
            Name = "TextVQA Rosetta OCR train";
            Url = "https://dl.fbaipublicfiles.com/textvqa/data/TextVQA_Rosetta_OCR_v0.2_train.json";
            Out = "textvqa\TextVQA_Rosetta_OCR_v0.2_train.json";
            Bytes = 65815367
        },
        @{
            Name = "TextOCR train";
            Url = "https://dl.fbaipublicfiles.com/textvqa/data/textocr/TextOCR_0.1_train.json";
            Out = "textocr\TextOCR_0.1_train.json";
            Bytes = 279887401
        },
        @{
            Name = "TextOCR val";
            Url = "https://dl.fbaipublicfiles.com/textvqa/data/textocr/TextOCR_0.1_val.json";
            Out = "textocr\TextOCR_0.1_val.json";
            Bytes = 40028022
        },
        @{
            Name = "TextOCR test";
            Url = "https://dl.fbaipublicfiles.com/textvqa/data/textocr/TextOCR_0.1_test.json";
            Out = "textocr\TextOCR_0.1_test.json";
            Bytes = 436594
        }
    )

    foreach ($item in $smallFiles) {
        Download-File -Name $item.Name -Url $item.Url -OutFile (Join-Path $Root $item.Out) -ExpectedBytes ([Int64]$item.Bytes)
    }

    if (-not $SkipLargeImages) {
        $largeFiles = @(
            @{
                Name = "COCO 2014 train images";
                Url = "http://images.cocodataset.org/zips/train2014.zip";
                Out = "coco2014\train2014.zip";
                Bytes = 13510573713
            },
            @{
                Name = "COCO 2014 val images";
                Url = "http://images.cocodataset.org/zips/val2014.zip";
                Out = "coco2014\val2014.zip";
                Bytes = 6645013297
            },
            @{
                Name = "Visual Genome images part 1";
                Url = "https://cs.stanford.edu/people/rak248/VG_100K_2/images.zip";
                Out = "visual_genome\images.zip";
                Bytes = 9731705982
            },
            @{
                Name = "Visual Genome images part 2";
                Url = "https://cs.stanford.edu/people/rak248/VG_100K_2/images2.zip";
                Out = "visual_genome\images2.zip";
                Bytes = 5471658058
            },
            @{
                Name = "TextVQA train/val images";
                Url = "https://dl.fbaipublicfiles.com/textvqa/images/train_val_images.zip";
                Out = "textvqa\train_val_images.zip";
                Bytes = 7072297970
            }
        )

        foreach ($item in $largeFiles) {
            Download-File -Name $item.Name -Url $item.Url -OutFile (Join-Path $Root $item.Out) -ExpectedBytes ([Int64]$item.Bytes)
        }
    }

    if (-not $SkipHuggingFace) {
        Download-HfDataset `
            -Repo "liuhaotian/LLaVA-Instruct-150K" `
            -LocalDir (Join-Path $Root "llava_instruct_150k") `
            -Includes @("*.json", "README.md")

        Download-HfDataset `
            -Repo "openbmb/RLHF-V-Dataset" `
            -LocalDir (Join-Path $Root "rlhf_v") `
            -Includes @("*.parquet", "README.md")

        Download-HfDataset `
            -Repo "openbmb/RLAIF-V-Dataset" `
            -LocalDir (Join-Path $Root "rlaif_v") `
            -Includes @("*.parquet", "README.md")

        Download-HfDataset `
            -Repo "Lin-Chen/ShareGPT4V" `
            -LocalDir (Join-Path $Root "sharegpt4v") `
            -Includes @("*.json", "README.md")
    }

    Write-Host "[complete] local dataset download finished"
}
finally {
    Stop-Transcript | Out-Null
}
