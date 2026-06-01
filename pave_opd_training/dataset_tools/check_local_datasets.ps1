param(
    [string]$Root = ""
)

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if ([string]::IsNullOrWhiteSpace($Root)) {
    $Root = Join-Path $ProjectRoot "raw_datasets"
}

$expected = @(
    @{ Path = "coco2014\annotations_trainval2014.zip"; Bytes = 252872794 },
    @{ Path = "coco2014\train2014.zip"; Bytes = 13510573713 },
    @{ Path = "coco2014\val2014.zip"; Bytes = 6645013297 },
    @{ Path = "visual_genome\annotations\image_data.json.zip"; Bytes = 1780854 },
    @{ Path = "visual_genome\annotations\objects.json.zip"; Bytes = 55323929 },
    @{ Path = "visual_genome\annotations\attributes.json.zip"; Bytes = 83280561 },
    @{ Path = "visual_genome\annotations\relationships.json.zip"; Bytes = 77904473 },
    @{ Path = "visual_genome\annotations\region_descriptions.json.zip"; Bytes = 127377968 },
    @{ Path = "visual_genome\annotations\question_answers.json.zip"; Bytes = 24776315 },
    @{ Path = "visual_genome\annotations\scene_graphs.json.zip"; Bytes = 114018504 },
    @{ Path = "visual_genome\annotations\synsets.json.zip"; Bytes = 595386 },
    @{ Path = "visual_genome\images.zip"; Bytes = 9731705982 },
    @{ Path = "visual_genome\images2.zip"; Bytes = 5471658058 },
    @{ Path = "vqav2\v2_Questions_Train_mscoco.zip"; Bytes = 7239401 },
    @{ Path = "vqav2\v2_Questions_Val_mscoco.zip"; Bytes = 3494929 },
    @{ Path = "vqav2\v2_Annotations_Train_mscoco.zip"; Bytes = 21708861 },
    @{ Path = "vqav2\v2_Annotations_Val_mscoco.zip"; Bytes = 10518930 },
    @{ Path = "textvqa\TextVQA_0.5.1_train.json"; Bytes = 21634937 },
    @{ Path = "textvqa\TextVQA_0.5.1_val.json"; Bytes = 3116162 },
    @{ Path = "textvqa\TextVQA_0.5.1_test.json"; Bytes = 2770520 },
    @{ Path = "textvqa\TextVQA_Rosetta_OCR_v0.2_train.json"; Bytes = 65815367 },
    @{ Path = "textvqa\train_val_images.zip"; Bytes = 7072297970 },
    @{ Path = "textocr\TextOCR_0.1_train.json"; Bytes = 279887401 },
    @{ Path = "textocr\TextOCR_0.1_val.json"; Bytes = 40028022 },
    @{ Path = "textocr\TextOCR_0.1_test.json"; Bytes = 436594 }
)

function Format-Bytes {
    param([Int64]$Bytes)
    if ($Bytes -ge 1GB) { return ("{0:N2} GB" -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1MB) { return ("{0:N2} MB" -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ("{0:N2} KB" -f ($Bytes / 1KB)) }
    return "$Bytes B"
}

$rows = foreach ($item in $expected) {
    $path = Join-Path $Root $item.Path
    $exists = Test-Path -LiteralPath $path
    $actual = if ($exists) { (Get-Item -LiteralPath $path).Length } else { 0 }
    [PSCustomObject]@{
        Status = if ($actual -eq [Int64]$item.Bytes) { "OK" } elseif ($actual -gt 0) { "PARTIAL" } else { "MISSING" }
        File = $item.Path
        Actual = Format-Bytes $actual
        Expected = Format-Bytes ([Int64]$item.Bytes)
    }
}

$rows | Format-Table -AutoSize

if (Test-Path -LiteralPath $Root) {
    $total = (Get-ChildItem -LiteralPath $Root -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    Write-Host ""
    Write-Host ("Total downloaded under {0}: {1}" -f $Root, (Format-Bytes ([Int64]$total)))
}

$hfDirs = @("llava_instruct_150k", "rlhf_v", "rlaif_v", "sharegpt4v")
foreach ($dir in $hfDirs) {
    $path = Join-Path $Root $dir
    if (Test-Path -LiteralPath $path) {
        $count = (Get-ChildItem -LiteralPath $path -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
        $size = (Get-ChildItem -LiteralPath $path -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
        Write-Host ("HF {0}: files={1}, size={2}" -f $dir, $count, (Format-Bytes ([Int64]$size)))
    } else {
        Write-Host ("HF {0}: MISSING" -f $dir)
    }
}
