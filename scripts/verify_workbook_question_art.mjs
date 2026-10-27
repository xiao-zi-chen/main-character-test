import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const workspaceRoot = new URL('../../', import.meta.url);
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
const digestPattern = /^[a-f0-9]{64}$/;
const scales = Array.from({ length: 5 }, (_, index) => `scale-${index}`);
const kinds = ['scene', 'left', 'right', ...scales];
const expectedIds = Array.from({ length: 10 }, (_, dimension) =>
  Array.from({ length: 4 }, (_, item) => `${dimension + 1}.${item + 1}`)).flat();
const levelOverrides = { '7.4': [1, 5, 4, 3, 2], '8.1': [5, 4, 3, 2, 1] };

// Read dimensions from the actual WebP payload, including lossless exports.
function webpSize(buffer, file) {
  assert.ok(buffer.length >= 20, `Truncated image: ${file}`);
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF', `Invalid RIFF header: ${file}`);
  assert.equal(buffer.toString('ascii', 8, 12), 'WEBP', `Invalid WebP format: ${file}`);
  assert.equal(buffer.readUInt32LE(4) + 8, buffer.length, `Invalid RIFF length: ${file}`);
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    assert.ok(start + length <= buffer.length, `Truncated WebP chunk: ${file}`);
    if (type === 'VP8X') {
      assert.ok(length >= 10, `Invalid VP8X header: ${file}`);
      return [buffer.readUIntLE(start + 4, 3) + 1, buffer.readUIntLE(start + 7, 3) + 1];
    }
    if (type === 'VP8L') {
      assert.ok(length >= 5 && buffer[start] === 0x2f, `Invalid VP8L header: ${file}`);
      const dimensions = buffer.readUInt32LE(start + 1);
      return [(dimensions & 0x3fff) + 1, ((dimensions >>> 14) & 0x3fff) + 1];
    }
    if (type === 'VP8 ') {
      assert.ok(length >= 10, `Invalid VP8 header: ${file}`);
      assert.equal(buffer.subarray(start + 3, start + 6).toString('hex'), '9d012a', `Invalid VP8 frame: ${file}`);
      return [buffer.readUInt16LE(start + 6) & 0x3fff, buffer.readUInt16LE(start + 8) & 0x3fff];
    }
    offset = start + length + (length % 2);
  }
  assert.fail(`Missing WebP dimensions: ${file}`);
}

function pngSize(buffer, file) {
  assert.ok(buffer.length >= 24, `Truncated source PNG: ${file}`);
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `Invalid source PNG: ${file}`);
  assert.equal(buffer.toString('ascii', 12, 16), 'IHDR', `Missing PNG dimensions: ${file}`);
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

function nonemptyString(value, label) {
  assert.ok(typeof value === 'string' && value.trim().length > 0, `Missing ${label}`);
}

export async function verifyWorkbookQuestionArt({ manifest, root, questions, questionCopy, questionReactions }) {
  assert.equal(manifest.importType, 'workbook-images');
  nonemptyString(manifest.revision, 'artwork revision');
  assert.equal(manifest.imageCount, 320, 'Expected eight image paths for each of forty questions');
  assert.equal(manifest.uniqueImageCount, 200, 'Expected five independent source images per question');
  assert.deepEqual(Object.keys(manifest.questions).sort(), [...expectedIds].sort(), 'Artwork must cover exactly the forty question IDs');
  assert.deepEqual(questions.map(question => question.id).sort(), [...expectedIds].sort(), 'Unexpected question bank');
  assert.deepEqual(Object.keys(questionCopy).sort(), [...expectedIds].sort(), 'Display copy must cover the entire question bank');
  assert.deepEqual(Object.keys(questionReactions).sort(), [...expectedIds].sort(), 'Image descriptions must cover the entire question bank');
  assert.equal(manifest.sourceWorkbook.file, 'prompt.xlsx');
  assert.equal(manifest.sourceWorkbook.sheet, '完整题库');
  assert.match(manifest.sourceWorkbook.sha256, digestPattern, 'Invalid workbook SHA256');
  assert.equal(sha256(await readFile(new URL('prompt.xlsx', workspaceRoot))), manifest.sourceWorkbook.sha256, 'Source workbook changed');

  const outputHashes = new Set();
  const sourceHashes = new Set();
  const sourceCache = new Map();
  const sourceFormats = new Set();
  let totalBytes = 0;
  let fileCount = 0;
  for (const question of questions) {
    const { id } = question;
    const entry = manifest.questions[id];
    const levels = levelOverrides[id] ?? [1, 2, 3, 4, 5];
    const [dimension, item] = id.split('.').map(Number);
    assert.equal(entry.sourceRow, 2 + (dimension - 1) * 4 + item - 1, `Wrong workbook row: ${id}`);
    nonemptyString(entry.sourcePrompt, `source question: ${id}`);
    assert.equal(entry.sourcePrompt, questionCopy[id].prompt, `Question copy differs from workbook: ${id}`);
    assert.equal(entry.sourceOptions.length, 2, `Expected two source options: ${id}`);
    entry.sourceOptions.forEach((option, index) => nonemptyString(option, `source option ${index}: ${id}`));
    assert.deepEqual(entry.sourceOptions, questionCopy[id].options, `Choice order differs from workbook: ${id}`);
    assert.deepEqual(entry.scaleSourceLevels, levels, `Wrong source image order: ${id}`);
    assert.equal(entry.sceneSourceLevel, 3, `Scene must use original third image: ${id}`);
    assert.deepEqual(Object.keys(entry.assets).sort(), [...kinds].sort(), `Expected eight image paths: ${id}`);
    assert.equal(questionReactions[id].length, 5, `Expected five image descriptions: ${id}`);

    const questionOutputHashes = new Set();
    const questionSourceHashes = new Set();
    for (const kind of kinds) {
      const asset = entry.assets[kind];
      const sourceLevel = kind === 'scene' ? 3 : kind === 'left' ? levels[0] : kind === 'right' ? levels[4] : levels[Number(kind.slice(6))];
      const expectedPath = `${id.replace('.', '-')}/${kind}.webp`;
      assert.ok(['PNG', 'WEBP'].includes(asset.sourceFormat), `Unsupported source format: ${id}/${kind}`);
      const expectedSource = `alter_images/${id}/${id}_${sourceLevel}.${asset.sourceFormat.toLowerCase()}`;
      assert.equal(asset.file, expectedPath, `Noncanonical output path: ${id}/${kind}`);
      assert.equal(asset.sourceLevel, sourceLevel, `Wrong source level: ${id}/${kind}`);
      assert.equal(asset.sourceFile, expectedSource, `Noncanonical source path: ${id}/${kind}`);
      assert.equal(asset.importMethod, asset.sourceFormat === 'WEBP' ? 'byte-copy' : 'lossless-conversion');
      sourceFormats.add(asset.sourceFormat);
      assert.match(asset.sha256, digestPattern, `Invalid image SHA256: ${expectedPath}`);
      assert.match(asset.sourceSha256, digestPattern, `Invalid source SHA256: ${expectedPath}`);
      nonemptyString(asset.prompt, `source image prompt: ${expectedPath}`);
      assert.match(asset.promptSha256, digestPattern, `Invalid prompt SHA256: ${expectedPath}`);
      assert.equal(sha256(asset.prompt), asset.promptSha256, `Prompt provenance mismatch: ${expectedPath}`);
      assert.deepEqual(asset.size, [1536, 1024], `Unexpected declared dimensions: ${expectedPath}`);

      const buffer = await readFile(new URL(expectedPath, root));
      assert.equal(sha256(buffer), asset.sha256, `Changed image: ${expectedPath}`);
      assert.equal(buffer.length, asset.bytes, `Wrong byte count: ${expectedPath}`);
      assert.deepEqual(webpSize(buffer, expectedPath), asset.size, `Wrong actual dimensions: ${expectedPath}`);
      if (!sourceCache.has(expectedSource)) {
        const source = await readFile(new URL(expectedSource, workspaceRoot));
        sourceCache.set(expectedSource, { hash: sha256(source), bytes: source.length,
          size: asset.sourceFormat === 'PNG' ? pngSize(source, expectedSource) : webpSize(source, expectedSource) });
      }
      const source = sourceCache.get(expectedSource);
      assert.equal(source.hash, asset.sourceSha256, `Changed source image: ${expectedSource}`);
      assert.deepEqual(source.size, asset.size, `Source dimensions changed: ${expectedSource}`);
      if (asset.sourceFormat === 'WEBP') {
        assert.equal(asset.sha256, source.hash, `Supplied WebP must be copied unchanged: ${expectedSource}`);
        assert.equal(asset.bytes, source.bytes, `Supplied WebP byte length changed: ${expectedSource}`);
      }

      if (kind.startsWith('scale-')) {
        const index = Number(kind.slice(6));
        const label = ['更接近左侧', '偏左', '中立', '偏右', '更接近右侧'][index];
        assert.equal(questionReactions[id][index].caption, `${label}：${asset.prompt}`, `Description does not match image order: ${expectedPath}`);
        assert.ok(!questionOutputHashes.has(asset.sha256), `Duplicate scale image: ${expectedPath}`);
        assert.ok(!questionSourceHashes.has(asset.sourceSha256), `Duplicate scale source: ${expectedPath}`);
        assert.ok(!outputHashes.has(asset.sha256), `Image reused across questions: ${expectedPath}`);
        assert.ok(!sourceHashes.has(asset.sourceSha256), `Source reused across questions: ${expectedSource}`);
        questionOutputHashes.add(asset.sha256);
        questionSourceHashes.add(asset.sourceSha256);
        outputHashes.add(asset.sha256);
        sourceHashes.add(asset.sourceSha256);
      }
      totalBytes += buffer.length;
      fileCount++;
    }

    // These three aliases are intentionally the only repeated image payloads.
    for (const [alias, index] of [['left', 0], ['right', 4], ['scene', levels.indexOf(3)]]) {
      const { file: aliasPath, ...aliasAsset } = entry.assets[alias];
      const { file: scalePath, ...scaleAsset } = entry.assets[`scale-${index}`];
      assert.deepEqual(aliasAsset, scaleAsset, `Alias must match mapped scale image: ${aliasPath} / ${scalePath}`);
    }
    assert.equal(questionOutputHashes.size, 5, `Expected five distinct images: ${id}`);
    assert.equal(questionSourceHashes.size, 5, `Expected five distinct sources: ${id}`);
  }
  assert.equal(fileCount, manifest.imageCount);
  assert.equal(outputHashes.size, manifest.uniqueImageCount);
  assert.equal(sourceHashes.size, manifest.uniqueImageCount);
  assert.equal(sourceCache.size, 200);
  assert.deepEqual(manifest.sourceImageFormats, [...sourceFormats].sort());
  const sourceFiles = (await readdir(new URL('alter_images/', workspaceRoot), { recursive: true }))
    .filter(file => /\.(png|webp)$/i.test(file)).map(file => `alter_images/${file.replaceAll('\\', '/')}`);
  assert.deepEqual(sourceFiles.sort(), [...sourceCache.keys()].sort(), 'Unexpected or missing source images');
  for (const report of manifest.sourceReports) {
    assert.match(report.file, /^alter_images\/[\w.-]+\.json$/, 'Noncanonical report path');
    assert.match(report.sha256, digestPattern);
    assert.equal(sha256(await readFile(new URL(report.file, workspaceRoot))), report.sha256, `Source report changed: ${report.file}`);
    assert.ok(Number.isInteger(report.verifiedImageCount) && report.verifiedImageCount > 0);
  }
  console.log(`Verified 40 workbook questions, ${fileCount} WebP paths, ${outputHashes.size} distinct images, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB, matching source files, prompts and A/B order.`);
}
