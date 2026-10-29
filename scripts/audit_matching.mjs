import { mkdir, writeFile } from 'node:fs/promises';
import { dimensions } from '../src/data/questions.js';
import { regularRoles as roles } from '../src/data/roles.js';
import { SCALE_MAX } from '../src/data/answer-scale.js';
import { MATCHING_VERSION } from '../src/data/role-calibration.js';
import { drawQuestions, questionById } from '../src/question-session.js';
import { getResult } from '../src/engine.js';
import { SAMPLE_MODELS, sampleDimensionUnits, seededRandom } from './lib/role-samples.mjs';

const report = {
  matchingVersion: MATCHING_VERSION,
  seed: 73190422, samplesPerScenario: 50000,
  assumptions: 'Synthetic legal 20-question sheets, using actual drawQuestions/getResult, no database or real users. Independent holdout seed. Each of five answer styles is reported separately; these are not predictions of live user frequencies.',
  scenarios: {},
};
for (const model of SAMPLE_MODELS) {
  const random = seededRandom(report.seed);
  const before = Object.fromEntries(roles.map(role => [role.id, 0]));
  const after = { ...before };
  const extras = [];
  let originalRankTotal = 0;
  for (let sample = 0; sample < report.samplesPerScenario; sample++) {
    const questionIds = drawQuestions(random);
    const answers = {};
    for (const dimension of dimensions) {
      const ids = questionIds.filter(id => questionById[id].dimension === dimension.id);
      const values = sampleDimensionUnits(random, model, ids.length);
      ids.forEach((id, i) => { answers[id] = questionById[id].highAnswer === 'A' ? SCALE_MAX - values[i] : values[i]; });
    }
    const result = getResult(answers, { questionIds });
    const rawRanking = [...result.ranking].sort((a, b) => a.distance - b.distance || a.role.number.localeCompare(b.role.number));
    before[rawRanking[0].role.id]++;
    after[result.role.id]++;
    extras.push(result.ranking[0].distance - rawRanking[0].distance);
    originalRankTotal += rawRanking.findIndex(item => item.role.id === result.role.id) + 1;
  }
  const summary = counts => {
    const shares = Object.values(counts).map(count => count / report.samplesPerScenario * 100).sort((a, b) => b - a);
    return { minPercent: shares.at(-1), maxPercent: shares[0], topThreePercent: shares.slice(0, 3).reduce((a, b) => a + b, 0),
      clientAndChefPercent: (counts['royal-client'] + counts['royal-chef']) / report.samplesPerScenario * 100,
      concentration: shares.reduce((sum, percent) => sum + (percent / 100) ** 2, 0) };
  };
  extras.sort((a, b) => a - b);
  report.scenarios[model] = {
    before: summary(before), after: summary(after),
    meanExtraDistance: extras.reduce((a, b) => a + b, 0) / extras.length,
    p95ExtraDistance: extras[Math.floor(extras.length * .95)],
    meanOriginalRank: originalRankTotal / report.samplesPerScenario,
    distribution: roles.map(role => ({ id: role.id, name: role.name, before: before[role.id], after: after[role.id] })),
  };
  console.log(JSON.stringify({ model, ...report.scenarios[model], distribution: undefined }));
}
const directory = new URL('../.work/matching/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('balanced-report.json', directory), JSON.stringify(report, null, 2) + '\n');
const labels = { uniform15: '15档随机选择', fiveShortcuts: '五个快捷档', endpoints: '偏向两端选择', centerBiased: '偏向中间选择', consistentTrait: '同维度保持倾向' };
const minimumLabel = value => value.toFixed(value > 0 && value < .01 ? 3 : 2);
const lines = [
  '角色匹配均衡验证（仅本地）', `算法版本：${MATCHING_VERSION}`, `每类 ${report.samplesPerScenario} 份，合计 ${report.samplesPerScenario * SAMPLE_MODELS.length} 份合成答卷。`,
  '使用实际抽题、正反向计分与结果函数；测试种子独立于训练；没有写入数据库。',
  '以下比例仅代表指定模拟选择习惯，不是线上真实用户概率。', '',
  '选择模型 | 原最高占比 | 新最低~最高占比 | 原前三合计→新前三合计 | 甲乙合计 原→新',
  ...Object.entries(report.scenarios).map(([model, { before, after }]) => `${labels[model]} | ${before.maxPercent.toFixed(2)}% | ${minimumLabel(after.minPercent)}%~${after.maxPercent.toFixed(2)}% | ${before.topThreePercent.toFixed(2)}%→${after.topThreePercent.toFixed(2)}% | ${before.clientAndChefPercent.toFixed(2)}%→${after.clientAndChefPercent.toFixed(2)}%`),
  '', '仍按性格相似度匹配，通过固定偏置降低原画像分布带来的集中。',
  '同答卷同结果，不会为了避免重复强行抽取其他角色。',
  '原始维度分数、画像和距离不变；28个角色自身画像与量表近似答案均保持可达。',
  '完整逐角色分布、原始距离增量与原始排名见 balanced-report.json。',
];
await writeFile(new URL('balanced-report.txt', directory), lines.join('\n') + '\n');
