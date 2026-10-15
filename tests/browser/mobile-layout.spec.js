import { test, expect } from '@playwright/test';

test('simple home, directory and result fit narrow and landscape screens', async ({ page }) => {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const viewport of [{width:320,height:568},{width:390,height:844},{width:852,height:393}]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect.poll(()=>page.locator('.opening-image').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
    await expect(page.getByRole('button',{name:'测测我的主角人设',exact:true})).toBeInViewport();
    const bounds=await page.locator('.opening-copy').evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return a.top>=b.top&&a.bottom<=b.bottom;});
    expect(bounds).toBe(true);
    await page.screenshot({path:`.work/simple-home-${viewport.width}.png`,fullPage:true});
    await page.goto('/#/characters');
    await expect(page.locator('.simple-character')).toHaveCount(18);
    await page.locator('.simple-character').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
    await page.goto('/#/role/plot-rewriter');
    await expect(page.locator('.relationship-section')).toBeVisible();
    await expect(page.locator('.result-more')).not.toHaveAttribute('open','');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`.work/simple-result-${viewport.width}.png`,fullPage:true});
  }
  expect(errors).toEqual([]);
});
