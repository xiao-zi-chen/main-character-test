import { test, expect } from '@playwright/test';

test('home loads one cover and result loads video only after an explicit request', async ({ page }) => {
  const mediaRequests=[];
  page.on('request', request => { if(request.url().includes('/media/')) mediaRequests.push(request.url()); });
  await page.goto('/');
  await expect.poll(()=>page.locator('.opening-image').evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
  expect(mediaRequests.filter(url=>url.includes('plot-rewriter.jpg'))).toHaveLength(1);
  expect(mediaRequests.some(url=>url.includes('.mp4'))).toBe(false);
  await page.goto('/#/role/myth-keeper');
  await expect(page.locator('.result-video-preview img')).toBeVisible();
  expect(mediaRequests.some(url=>url.includes('.mp4'))).toBe(false);
  await page.getByRole('button',{name:'观看失落神话继承人的短片'}).click();
  await expect.poll(()=>page.locator('dialog video').evaluate(video=>video.currentTime>0)).toBe(true);
  const player=await page.locator('dialog video').boundingBox();
  expect(player.width).toBeGreaterThan(200);
  expect(player.y+player.height).toBeLessThanOrEqual(page.viewportSize().height);
  await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'观看失落神话继承人的短片'})).toBeFocused();
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

test('landscape video controls stay inside the player and remain tappable', async ({page})=>{
  await page.setViewportSize({width:852,height:393});
  await page.goto('/#/role/royal-chef');
  await page.getByRole('button',{name:/^观看.*的短片$/}).click();
  const layout=await page.locator('.video-player').evaluate(player=>{
    const bounds=player.getBoundingClientRect();
    return {left:bounds.left,right:bounds.right,controls:[...player.querySelectorAll('.video-controls .icon-button')].map(control=>{const box=control.getBoundingClientRect();return {left:box.left,right:box.right,width:box.width,height:box.height};})};
  });
  for(const control of layout.controls){expect(control.left).toBeGreaterThanOrEqual(layout.left);expect(control.right).toBeLessThanOrEqual(layout.right);expect(control.width).toBeGreaterThanOrEqual(44);expect(control.height).toBeGreaterThanOrEqual(44);}
  await expect(page.getByRole('link',{name:'下载角色短片'})).toBeInViewport();
});

test('a failed short film can be retried without losing the result', async ({ page }) => {
  let blocked=true;
  await page.route('**/media/myth-keeper.mp4*', route=>blocked?route.abort():route.continue());
  await page.goto('/#/role/myth-keeper');
  await page.getByRole('button',{name:'观看失落神话继承人的短片'}).click();
  const retry=page.getByRole('button',{name:'重新加载',exact:true});
  await expect(retry).toBeVisible();
  blocked=false;
  await retry.click();
  await expect.poll(()=>page.locator('dialog video').evaluate(video=>video.currentTime>0&&!video.paused)).toBe(true);
  await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
  await expect(page.getByRole('heading',{level:1})).toHaveText('失落神话继承人');
});

test('collection rejection shows a recoverable error and preserves the chosen response', async ({ page }) => {
  await page.goto('/#/test');
  await page.getByRole('slider').press('End');
  await page.evaluate(()=>{
    const original=window.NBTICollector.answer;
    let rejected=false;
    window.NBTICollector={...window.NBTICollector,answer:(...args)=>{if(!rejected){rejected=true;return false;}return original(...args);}};
  });
  await page.getByRole('button',{name:'下一幕',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('答案还在');
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuenow','14');
  await expect(page.locator('.quiz-counter')).toHaveText('01 / 20');
  await page.getByRole('button',{name:'下一幕',exact:true}).click();
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
  await page.getByRole('button',{name:'下一幕',exact:true}).click();
  await expect(page.locator('.quiz-counter')).toHaveText('02 / 20');
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
  await page.goto('/#/role/myth-keeper');
  await page.getByRole('button',{name:'找 TA 来认领'}).click();
  const invitations=await page.evaluate(()=>window.sharedInvitations);
  expect(invitations).toHaveLength(1);
  expect(invitations[0].text).toContain('失落神话继承人');
  expect(invitations[0].url).toContain('#/role/myth-keeper');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.toast.visible')).toHaveCount(0);
});
