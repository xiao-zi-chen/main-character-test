import { confirmAnswer } from './quiz-helpers.js';
import {test,expect} from '@playwright/test';
import {questions,dimensions} from '../../src/data/questions.js';
import {STORAGE_KEY} from '../../src/engine.js';
import {validQuestionIds} from '../../src/question-session.js';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/collect', route => route.fulfill({ json: { ok: true } }));
});

test('all forty questions fit in one phone screen, including choices and navigation buttons',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='mobile');
  test.setTimeout(120000);
  const fixtures=Object.fromEntries(questions.map(target=>{
    const ids=dimensions.flatMap(d=>questions.filter(q=>q.dimension===d.id).sort((a,b)=>Number(b.id===target.id)-Number(a.id===target.id)).slice(0,2).map(q=>q.id));
    return [target.id,[target.id,...ids.filter(id=>id!==target.id)]];
  }));
  await page.addInitScript(({key,fixtures})=>{const q=new URL(location.href).searchParams.get('question');if(fixtures[q])localStorage.setItem(key,JSON.stringify({version:5,questionIds:fixtures[q],answers:{},index:0,submitted:false}));},{key:STORAGE_KEY,fixtures});
  for(const viewport of [{width:320,height:568},{width:390,height:844}]) {
    await page.setViewportSize(viewport);
    for(const question of questions) {
      await page.goto(`/?question=${question.id}#/test`);
      await expect(page.getByRole('slider')).toBeVisible();
      const layout=await page.evaluate(()=>{
        const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width};};
        return {height:innerHeight,width:innerWidth,scroll:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,quiz:rect('.quiz-layout'),section:rect('.question-section'),scene:rect('.question-scene'),scale:rect('.answer-scale'),meta:rect('.question-meta'),kicker:rect('.question-kicker'),selection:rect('.answer-scale-selection'),heading:rect('#question-title'),anchors:rect('.answer-scale-anchors'),slider:rect('.answer-scale-track'),actions:rect('.question-actions')};
      });
      expect(layout.scroll,`${question.id} at ${viewport.width}`).toBeLessThanOrEqual(layout.height+1);
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width);
      expect(Math.abs(layout.section.width-layout.quiz.width),`${question.id}: question section must fill the phone layout`).toBeLessThanOrEqual(1);
      for(const key of ['scene','scale']) expect(Math.abs(layout[key].width-layout.section.width),`${question.id}: ${key} must fill the question width`).toBeLessThanOrEqual(1);
      for(const key of ['heading','anchors','slider','actions']){expect(layout[key].top).toBeGreaterThanOrEqual(0);expect(layout[key].bottom).toBeLessThanOrEqual(layout.height);}
      expect(layout.heading.bottom).toBeLessThanOrEqual(layout.anchors.top);
      expect(layout.meta.bottom).toBeLessThanOrEqual(layout.heading.top);
      expect(layout.selection.bottom).toBeLessThanOrEqual(layout.actions.top);
      expect(layout.anchors.bottom).toBeLessThanOrEqual(layout.slider.top);
      expect(layout.slider.bottom).toBeLessThanOrEqual(layout.actions.top);
      await page.locator('.answer-scale-labels button').nth(2).click();
      await expect(page.locator('.question-scene img')).toBeInViewport();
      await expect(page.locator('.answer-option-text')).toHaveCount(2);
      await expect(page.locator('.answer-reaction-caption')).toHaveCount(0);
      await expect(page.getByRole('button',{name:'看看我的这一幕',exact:true})).toBeInViewport();
      await expect(page.getByRole('button',{name:'上一题',exact:true})).toBeInViewport();
      await expect(page.getByRole('button',{name:'下一题',exact:true})).toBeInViewport();
      expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height+1);
    }
    await page.screenshot({path:`.work/quiz-screen-${viewport.width}.png`});
  }
});

test('refresh keeps a draw, finish records twenty responses and restart makes a new draw',async({page})=>{
  await page.goto('/#/test');
  const first=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).questionIds,STORAGE_KEY);
  expect(validQuestionIds(first)).toBe(true);
  await page.locator('.answer-scale-anchor').first().click();
  await confirmAnswer(page);
  await page.reload();
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).questionIds,STORAGE_KEY)).toEqual(first);
  for(let i=1;i<20;i++){
    await page.locator('.answer-scale-anchor').last().click();
    await confirmAnswer(page, { final: i === 19 });
  }
  await expect(page).toHaveURL(/#\/result$/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
  const collected=await page.evaluate(()=>window.NBTICollector.snapshot());
  const run=collected.runs.find(r=>r.session.id===collected.activeSessionId);
  expect(run.session.questionnaireVersion).toBe('nbti-2026-10-20-scale15-sample20');
  expect(run.session.questionIds).toEqual(first);
  expect(run.answers).toHaveLength(20);
  expect(run.session.completedAt).toBeTruthy();
  await page.getByRole('button',{name:'再选一次，我有别的剧本'}).click();
  await page.getByRole('button',{name:'重新开始',exact:true}).click();
  const second=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).questionIds,STORAGE_KEY);
  expect(validQuestionIds(second)).toBe(true);expect(second).not.toEqual(first);
  await expect(page.getByRole('slider')).toHaveAttribute('data-selected','false');
});
