import { confirmAnswer, navigateQuestion } from './quiz-helpers.js';
import { test, expect } from '@playwright/test';
import { questions, dimensions } from '../../src/data/questions.js';
import { hiddenRoles } from '../../src/data/roles.js';
import { STORAGE_KEY } from '../../src/engine.js';

test('home loads one cover and result loads video only after an explicit request', async ({ page }) => {
  const mediaRequests=[];
  page.on('request', request => { if(request.url().includes('/media/')) mediaRequests.push(request.url()); });
  await page.goto('/');
  await expect.poll(()=>page.locator('.opening-image').evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
  await expect(page.locator('.opening-image')).toHaveAttribute('src', /^data:image\/webp;base64,/);
  expect(mediaRequests.filter(url=>url.includes('plot-rewriter-selected.webp'))).toHaveLength(0);
  expect(mediaRequests.some(url=>url.includes('.mp4'))).toBe(false);
  await page.goto('/#/role/plot-rewriter');
  await expect(page.locator('.result-video-preview img')).toBeVisible();
  expect(mediaRequests.some(url=>url.includes('.mp4'))).toBe(false);
  await page.getByRole('button',{name:'观看心之所向的短片'}).click();
  await expect.poll(()=>page.locator('dialog video').evaluate(video=>video.currentTime>0&&!video.muted)).toBe(true);
  const player=await page.locator('dialog video').boundingBox();
  expect(player.width).toBeGreaterThan(200);
  expect(player.y+player.height).toBeLessThanOrEqual(page.viewportSize().height);
  await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'观看心之所向的短片'})).toBeFocused();
});

test('blocked autoplay keeps sound enabled and permits a manual play request', async ({ page }) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    let rejectNext = true;
    window.videoPlayMutes = [];
    HTMLMediaElement.prototype.play = function () {
      window.videoPlayMutes.push(this.muted);
      if (rejectNext) {
        rejectNext = false;
        this.dispatchEvent(new Event('waiting'));
        return Promise.reject(new DOMException('User interaction required', 'NotAllowedError'));
      }
      return play.call(this);
    };
  });
  await page.goto('/#/role/plot-rewriter');
  await page.getByRole('button', { name: '观看心之所向的短片' }).click();
  const video = page.locator('dialog video');
  await expect(page.locator('dialog button')).toHaveCount(1);
  await expect(page.locator('.video-loading')).toHaveCount(0);
  await expect(video).toHaveJSProperty('muted', false);
  expect(await page.evaluate(() => window.videoPlayMutes)).toEqual([false]);
  await video.click();
  await expect.poll(() => video.evaluate(element => element.currentTime > 0 && !element.paused && !element.muted)).toBe(true);
  expect(await page.evaluate(() => window.videoPlayMutes)).toEqual([false, false]);
});

test('modal traps keyboard focus, keeps text readable and restores its trigger', async ({ page }) => {
  await page.goto('/');
  const trigger=page.getByRole('button',{name:'关于测试',exact:true});
  await trigger.click();
  const dialog=page.getByRole('dialog');
  for(let i=0;i<6;i++) {
    await page.keyboard.press(i%2?'Shift+Tab':'Tab');
    expect(await dialog.evaluate(element=>element.contains(document.activeElement))).toBe(true);
  }
  const button=dialog.getByRole('button',{name:'开始我的故事'});
  const colors=await button.evaluate(element=>{const style=getComputedStyle(element);return {text:style.color,background:style.backgroundColor};});
  expect(colors.text).toBe('rgb(24, 39, 30)');
  expect(colors.background).toBe('rgb(220, 233, 212)');
  const close=await dialog.getByRole('button',{name:'关闭弹窗'}).boundingBox();
  expect(close.width).toBeGreaterThanOrEqual(44);
  expect(close.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.goto('/#/characters');
  await page.locator('.simple-character').first().click();
  const roleButton=page.locator('.modal-role-copy>.button');
  expect(await roleButton.evaluate(element=>getComputedStyle(element).backgroundColor)).toBe('rgb(220, 233, 212)');
  expect(await roleButton.evaluate(element=>getComputedStyle(element).color)).toBe('rgb(24, 39, 30)');
});

test('every reachable modal closes from outside and preserves inside clicks, image menus and drags', async ({ page }) => {
  await page.route('**/api/collect', route => route.fulfill({ json: { ok: true } }));
  async function checkModal(title, insideSelector) {
    const dialog = page.getByRole('dialog', { name: title, exact: true });
    await expect(dialog).toBeVisible();
    const inside = dialog.locator(insideSelector).first();
    await inside.click();
    await expect(dialog).toBeVisible();
    if (insideSelector === 'img') {
      expect(await inside.evaluate(element => element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))).toBe(true);
      await expect(dialog).toBeVisible();
    }
    const bounds = await inside.boundingBox();
    await inside.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: bounds.x + 1, clientY: bounds.y + 1, button: 0 });
    await dialog.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 2, clientY: 2, button: 0 });
    await dialog.dispatchEvent('click', { clientX: 2, clientY: 2 });
    await expect(dialog).toBeVisible();
    await page.mouse.click(2, 2);
    await expect(dialog).toHaveCount(0);
  }
  await page.goto('/');
  await page.getByRole('button', { name: '关于测试', exact: true }).click();
  await checkModal('关于测试', 'h2');
  if (hiddenRoles.length) {
    for (let i = 0; i < 5; i++) await page.locator('.simple-brand').click();
    await checkModal('彩蛋导演室', 'h2');
  }
  await page.goto('/#/characters');
  await page.getByRole('button', { name: '预览心之所向', exact: true }).click();
  await checkModal('心之所向的角色预告', 'h2');
  if (hiddenRoles.length) {
    await page.locator('.gallery-secret').click();
    await checkModal('隐藏剧本线索', 'h2');
  }
  await page.goto('/#/role/plot-rewriter');
  await page.getByRole('button', { name: '观看心之所向的短片', exact: true }).click();
  await checkModal('心之所向的短片', 'video');
  await page.getByRole('button', { name: '分享剧本', exact: true }).first().click();
  await checkModal('分享剧本', 'h2');
  await page.goto('/#/test');
  await page.getByRole('button', { name: '放大当前画面', exact: true }).click();
  await checkModal('查看画面', 'img');

  const questionIds = dimensions.flatMap(dimension => questions.filter(question => question.dimension === dimension.id).slice(0, 2).map(question => question.id));
  await page.evaluate(({ key, questionIds }) => {
    localStorage.setItem(key, JSON.stringify({ version: 5, questionIds, answers: Object.fromEntries(questionIds.map(id => [id, 7])), index: 19, submitted: true }));
  }, { key: STORAGE_KEY, questionIds });
  await page.goto('/?modal-check=result#/result');
  await page.getByRole('button', { name: '保存我的角色卡', exact: true }).click();
  await checkModal('保存角色卡', 'img');
  await page.getByRole('button', { name: '再选一次，我有别的剧本', exact: true }).click();
  await checkModal('重新选角', 'h2');
  await expect(page).toHaveURL(/#\/result$/);
});

test('landscape close control remains tappable', async ({page})=>{
  await page.setViewportSize({width:852,height:393});
  await page.goto('/#/role/royal-chef');
  await page.getByRole('button',{name:/^观看.*的短片$/}).click();
  const close=page.getByRole('button',{name:'关闭弹窗'});
  await expect(close).toBeInViewport();
  const box=await close.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await close.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a failed short film can be retried without losing the result', async ({ page }) => {
  let blocked=true;
  await page.route('**/media/film-follow-your-heart.mp4*', route=>blocked?route.abort():route.continue());
  await page.goto('/#/role/plot-rewriter');
  await page.getByRole('button',{name:'观看心之所向的短片'}).click();
  const retry=page.locator('dialog video');
  await expect.poll(()=>retry.evaluate(video=>Boolean(video.error))).toBe(true);
  blocked=false;
  await retry.click();
  await expect.poll(()=>page.locator('dialog video').evaluate(video=>video.currentTime>0&&!video.paused)).toBe(true);
  await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
  await expect(page.getByRole('heading',{level:1})).toHaveText('心之所向');
});

test('collection rejection shows a recoverable error and preserves the chosen response', async ({ page }) => {
  await page.goto('/#/test');
  await page.getByRole('slider').press('End');
  await page.evaluate(()=>{
    const original=window.NBTICollector.answer;
    let rejected=false;
    window.NBTICollector={...window.NBTICollector,answer:(...args)=>{if(!rejected){rejected=true;return false;}return original(...args);}};
  });
  await navigateQuestion(page, 'next');
  await expect(page.getByRole('alert')).toContainText('答案还在');
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuenow','14');
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  await confirmAnswer(page);
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 20');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('blocked browser storage still allows the current quiz to continue', async ({ page }) => {
  await page.addInitScript(()=>{
    Storage.prototype.getItem=()=>{throw new DOMException('Blocked','SecurityError');};
    Storage.prototype.setItem=()=>{throw new DOMException('Blocked','SecurityError');};
  });
  await page.goto('/#/test');
  await expect(page.locator('.quiz-topline')).toContainText('浏览器暂时无法保存');
  await page.locator('.answer-scale-anchor').first().click();
  await confirmAnswer(page);
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 20');
});

test('a missing collector preserves the selected draft and offers a page reload', async ({ page }) => {
  await page.goto('/#/test');
  await page.getByRole('slider').press('End');
  await page.evaluate(() => { window.NBTICollector = undefined; });
  await navigateQuestion(page, 'next');
  await expect(page.getByRole('alert')).toContainText('答题记录服务暂未加载');
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuenow', '14');
  await page.getByRole('button', { name: '重新加载页面', exact: true }).click();
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuenow', '14');
  await confirmAnswer(page);
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 20');
});

test('lost confirmed records require an explicit new attempt without inventing timings', async ({ page }) => {
  await page.goto('/#/test');
  for (let i = 0; i < 2; i++) {
    await page.getByRole('slider').press('Home');
    await confirmAnswer(page);
  }
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('main-character-casting:v5')));
  // The outgoing document saves on pagehide. Remove only its collector state
  // in the next document, before collector.js can restore it.
  await page.addInitScript(() => localStorage.removeItem('nbti:collector:v1'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('答题记录未能完整恢复');
  await expect(page.locator('.quiz-counter')).toHaveText('03 / 20');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('main-character-casting:v5')).answers)).toEqual(before.answers);
  expect(await page.evaluate(() => window.NBTICollector.snapshot().runs[0].answers)).toEqual([]);
  await page.getByRole('button', { name: '重新开始测试', exact: true }).click();
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  await expect(page.getByRole('slider')).toHaveAttribute('data-selected', 'false');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('slider').press('End');
  await confirmAnswer(page);
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 20');
});

test('an unconfirmed completion cannot reveal a result and offers a fresh attempt', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/#/test');
  for (let i = 0; i < 20; i++) {
    await page.getByRole('slider').press('Home');
    if (i === 19) await page.evaluate(() => { window.NBTICollector = { ...window.NBTICollector, complete: () => false }; });
    if (i === 19) await navigateQuestion(page, 'next');
    else await confirmAnswer(page);
  }
  await expect(page).toHaveURL(/#\/test$/);
  await expect(page.getByRole('alert')).toContainText('答题记录未能完整恢复');
  await navigateQuestion(page, 'next');
  await expect(page.locator('.quiz-counter')).toHaveText('20 / 20');
  const state = await page.evaluate(() => ({
    progress: JSON.parse(localStorage.getItem('main-character-casting:v5')),
    collector: window.NBTICollector.snapshot()
  }));
  expect(state.progress.submitted).toBe(false);
  expect(state.collector.runs.find(run => run.session.id === state.collector.activeSessionId).answers).toHaveLength(20);
  expect(state.collector.runs.find(run => run.session.id === state.collector.activeSessionId).session.completedAt).toBeNull();
  await expect(page.getByRole('button', { name: '重新开始测试', exact: true })).toBeVisible();
});

test('phone sharing uses the native sheet and cancelling it does not show an error', async ({ page },testInfo) => {
  test.skip(testInfo.project.name!=='mobile');
  await page.addInitScript(()=>{
    window.sharedInvitations=[];
    Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{
      window.sharedInvitations.push(data);
      throw new DOMException('Cancelled','AbortError');
    }});
  });
  await page.goto('/#/role/plot-rewriter');
  await page.getByRole('button',{name:'分享剧本',exact:true}).first().click();
  await page.getByRole('button',{name:'分享给朋友',exact:true}).click();
  const invitations=await page.evaluate(()=>window.sharedInvitations);
  expect(invitations).toHaveLength(1);
  expect(invitations[0].text).toContain('心之所向');
  expect(invitations[0].url).toContain('#/role/plot-rewriter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.share-status')).not.toContainText('无法');
  await expect(page.locator('.toast.visible')).toHaveCount(0);
});
