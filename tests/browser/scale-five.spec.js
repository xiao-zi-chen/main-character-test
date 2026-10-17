import {test,expect} from '@playwright/test';
import {STORAGE_KEY} from '../../src/engine.js';
import {QUESTIONNAIRE_VERSION} from '../../src/data/answer-scale.js';

test('five labeled choices select exactly 0–4 and submit only on Next',async({page})=>{
  await page.goto('/#/test');
  const labels=['更接近左侧','偏左','中立','偏右','更接近右侧'];
  const slider=page.getByRole('slider');
  await expect(slider).toHaveAttribute('aria-valuemax','4');
  await expect(page.locator('.answer-scale-cell')).toHaveCount(5);
  for(let value=0;value<5;value++) {
    await page.getByRole('button',{name:labels[value],exact:true}).click();
    await expect(slider).toHaveAttribute('aria-valuenow',String(value));
    await expect(page.getByRole('button',{name:labels[value],exact:true})).toHaveAttribute('aria-pressed','true');
  }
  expect(await page.evaluate(()=>window.NBTICollector.snapshot().runs.flatMap(r=>r.answers))).toEqual([]);
  for(const value of [5,7,14,-1,2.5]) {
    expect(await page.evaluate(value=>{const state=window.NBTICollector.snapshot();const run=state.runs.find(r=>r.session.id===state.activeSessionId);return window.NBTICollector.answer(run.questionId,value);},value)).toBe(false);
  }
  await page.getByRole('button',{name:'下一幕',exact:true}).click();
  const state=await page.evaluate(()=>window.NBTICollector.snapshot());
  const run=state.runs.find(r=>r.session.id===state.activeSessionId);
  expect(run.answers.map(a=>a.scaleValue)).toEqual([4]);
  expect(run.session.questionnaireVersion).toBe(QUESTIONNAIRE_VERSION);
});

test('old 15-level progress is not reinterpreted and its unsynced outbox retains the original values',async({page})=>{
  await page.route('**/api/collect',route=>route.fulfill({status:503,body:'unavailable'}));
  await page.addInitScript(()=>{
    localStorage.setItem('main-character-casting:v3',JSON.stringify({version:3,answers:{'1.1':3},index:1}));
    localStorage.setItem('nbti:collector:v1',JSON.stringify({version:2,participantToken:'a'.repeat(64),participantId:null,activeSessionId:'old-session',runs:[{
      session:{id:'old-session',questionnaireVersion:'nbti-2026-10-15-sample20',participantId:null,questionIds:['1.1'],startedAt:'2026-10-16T00:00:00Z',completedAt:null,totalElapsedMs:null},
      answers:[{eventId:'old-event',sequence:1,questionId:'1.1',scaleValue:14,responseTimeMs:1234,answeredAt:'2026-10-16T00:00:02Z'}],
      syncedCount:0,syncedSession:false,syncedCompletedAt:null,activeElapsedMs:1234,questionElapsedMs:0,questionId:'1.1'
    }]}));
  });
  await page.goto('/#/test');
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  await expect(page.getByRole('slider')).toHaveAttribute('data-selected','false');
  const state=await page.evaluate(()=>window.NBTICollector.snapshot());
  expect(state.participantToken).toBe('a'.repeat(64));
  expect(state.runs.find(r=>r.session.id==='old-session').answers[0]).toMatchObject({scaleValue:14,responseTimeMs:1234});
  expect(state.activeSessionId).not.toBe('old-session');
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).answers,STORAGE_KEY)).toEqual({});
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('main-character-casting:v3')).answers)).toEqual({'1.1':3});
});
