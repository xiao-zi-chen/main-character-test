import {test,expect} from '@playwright/test';
import {hiddenRoles,roleById} from '../../src/data/roles.js';
import { STORAGE_KEY } from '../../src/engine.js';
import {questions,dimensions} from '../../src/data/questions.js';
import {HIDDEN_STORAGE_KEY} from '../../src/hidden-rules.js';

function answersFor(role,questionIds) {
  return Object.fromEntries(questionIds.map(id=>{const q=questions.find(item=>item.id===id);const units=Math.round(role.profile[dimensions.findIndex(d=>d.id===q.dimension)]*14/100);return [id,q.highAnswer==='A'?14-units:units];}));
}
async function openSecrets(page) {
  for(let i=0;i<5;i++) await page.getByRole('link',{name:'主角请就位，返回首页',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'彩蛋导演室'})).toBeVisible();
}

test('directory exposes regular roles, native dialogue, and author credit',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.simple-footer > span')).toHaveText('拾壹 / 我燃起来了 / FhwuTrqr / Le Prince Grenouille');
  await page.goto('/#/characters');
  await expect(page.getByRole('button',{name:/^预览/})).toHaveCount(18);
  await expect(page.locator('.gallery-secret')).toBeVisible();
  for(const role of hiddenRoles) await expect(page.getByText(role.name,{exact:true})).toHaveCount(0);
  await page.goto('/#/role/villain-calmer');
  await page.getByRole('button',{name:/^观看.*的短片$/}).click();
  await expect(page.locator('.video-duration')).toHaveText('00:15');
  await expect.poll(()=>page.locator('video').evaluate(v=>!v.muted&&!v.paused&&v.currentTime>0)).toBe(true);
  await page.getByRole('button',{name:'关闭声音',exact:true}).click();
  await expect.poll(()=>page.locator('video').evaluate(v=>v.muted)).toBe(true);
  await page.getByRole('button',{name:'开启声音',exact:true}).click();
  await expect.poll(()=>page.locator('video').evaluate(v=>!v.muted&&!v.paused)).toBe(true);
  await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
  await expect(page.locator('.dialogue-script')).toHaveCount(0);
  await expect(page.locator('.relationship-section')).toContainText('你的偏爱藏在这里');
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('secret entry, opt-in, both earned unlocks, persistence, and reset work end to end',async({page})=>{
  test.setTimeout(120000);
  await page.goto('/#/characters');
  await expect(page.getByRole('button',{name:/^预览/})).toHaveCount(18);
  for(const role of hiddenRoles) {
    await page.goto(`/#/role/${role.id}`);
    await expect(page.getByRole('heading',{level:1})).toHaveText('这份隐藏剧本，还没有解锁');
    await expect(page.locator('video')).toHaveCount(0);
    await expect(page.getByText(role.name,{exact:true})).toHaveCount(0);
  }
  await page.goto('/#/');
  await openSecrets(page);
  await page.getByRole('checkbox',{name:'允许解锁隐藏剧本'}).check();
  await page.getByRole('button',{name:'带着这个设置继续'}).click();
  await expect(page).toHaveURL(/#\/test$/);
  for(let round=0;round<hiddenRoles.length;round++) {
    const role=hiddenRoles[round];
    if(round) {
      await page.goto('/#/result');
      await page.getByRole('button',{name:'再选一次，我有别的剧本'}).click();
      await page.getByRole('dialog').getByRole('button',{name:'重新开始',exact:true}).click();
      await expect(page).toHaveURL(/#\/test$/);
    }
    const questionIds=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).questionIds,STORAGE_KEY);
    const answers=answersFor(role,questionIds);
    for(let i=0;i<questionIds.length;i++) {
      const slider=page.getByRole('slider');
      await slider.focus();
      await slider.press('Home');
      for(let step=0;step<answers[questionIds[i]];step++) await slider.press('ArrowRight');
      await page.getByRole('button',{name:i===19?'揭晓我的主角':'下一幕',exact:true}).click();
    }
    await expect(page).toHaveURL(/#\/result$/);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
    await expect(page.getByRole('heading',{level:1})).toHaveText(role.name);
    await expect(page.locator('.hidden-result-badge')).toBeVisible();
    await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)).unlocked,HIDDEN_STORAGE_KEY)).toContain(role.id);
    await page.reload();
    await expect(page.getByRole('heading',{level:1})).toHaveText(role.name);
    await page.goto(`/#/role/${role.id}`);
    await expect(page.getByRole('heading',{level:1})).toHaveText(role.name);
    await page.goto('/#/characters');
    await expect(page.getByRole('button',{name:/^预览/})).toHaveCount(19+round);
  }
  await openSecrets(page);
  await expect(page.locator('.secret-count')).toContainText('2 / 2');
  await page.getByRole('button',{name:'清空彩蛋记录并关闭'}).click();
  await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
  await page.goto('/#/characters');
  await expect(page.getByRole('button',{name:/^预览/})).toHaveCount(18);
  await expect(page.locator('.gallery-secret')).toBeVisible();
  await page.goto(`/#/role/${hiddenRoles[0].id}`);
  await expect(page.getByRole('heading',{level:1})).toHaveText('这份隐藏剧本，还没有解锁');
});
