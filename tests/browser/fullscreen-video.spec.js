import {test,expect} from '@playwright/test';

test('film fills portrait and landscape viewports with only close UI and holds its ending frame',async({page},testInfo)=>{
  await page.goto('/#/role/chovy-son');
  await page.getByRole('button',{name:'观看儿子我chovy的短片',exact:true}).click();
  const video=page.locator('dialog video');
  await expect(page.locator('dialog button')).toHaveCount(1);
  await expect(page.locator('dialog h2,dialog .video-controls,dialog .video-duration')).toHaveCount(0);
  await expect(video).toHaveJSProperty('controls',false);
  await expect(video).toHaveJSProperty('loop',false);
  for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1440,height:1050}]) {
    await page.setViewportSize(viewport);
    await expect.poll(()=>page.locator('dialog').evaluate(element=>{
      const r=element.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)];
    })).toEqual([0,0,viewport.width,viewport.height]);
    await expect(page.getByRole('button',{name:'关闭弹窗'})).toBeInViewport();
  }
  await expect.poll(()=>video.evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(2);
  await video.evaluate(async v=>{v.currentTime=v.duration-.15;await v.play();});
  await expect.poll(()=>video.evaluate(v=>v.paused && v.currentTime>v.duration-.1)).toBe(true);
  const ending=await video.evaluate(v=>v.currentTime);
  await page.waitForTimeout(1200);
  expect(await video.evaluate(v=>v.currentTime)).toBe(ending);
  await video.click();
  await expect(video).toHaveJSProperty('paused',true);
  await page.screenshot({path:`.work/fullscreen-ending-${testInfo.project.name}.png`});
  await page.getByRole('button',{name:'关闭弹窗'}).click();
  await expect(page.getByRole('heading',{level:1})).toHaveText('儿子我chovy');
});
