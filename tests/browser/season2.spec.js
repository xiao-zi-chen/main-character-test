import {test,expect} from '@playwright/test';
import {hiddenRoles,roleById} from '../../src/data/roles.js';
import {questions,dimensions} from '../../src/data/questions.js';
import {HIDDEN_STORAGE_KEY} from '../../src/hidden-rules.js';

function answersFor(role) {
  const answers={};dimensions.forEach((dim,i)=>{const items=questions.filter(q=>q.dimension===dim.id);const n=Math.round(role.profile[i]/100*items.length);items.forEach((q,j)=>{const endpoint=j<n?q.highAnswer:q.highAnswer==='A'?'B':'A';answers[q.id]=endpoint==='A'?0:14;});});return answers;
}
async function openSecrets(page) {
  for(let i=0;i<5;i++) await page.getByRole('link',{name:'主角请就位，返回首页',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'彩蛋导演室'})).toBeVisible();
}

test('new season exposes eight new regular roles, native dialogue, and author credit',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.footer-authors')).toHaveText('作者：陈嘉恒、卜俊程、李家兴、肖宇诚');
  await page.getByRole('button',{name:'第二季新角',exact:true}).click();
  await expect(page.getByRole('button',{name:/^预览/})).toHaveCount(8);
  await expect(page.locator('.mystery-role')).toHaveCount(2);
  for(const role of hiddenRoles) await expect(page.getByText(role.name,{exact:true})).toHaveCount(0);
  await page.goto('/#/role/villain-calmer');
  await expect(page.locator('.video-duration')).toHaveText('00:15');
  await page.getByRole('button',{name:'听原声',exact:true}).click();
  await expect.poll(()=>page.locator('video').evaluate(v=>!v.muted&&!v.paused&&v.currentTime>0)).toBe(true);
  await page.getByRole('button',{name:'关闭声音',exact:true}).click();
  await expect.poll(()=>page.locator('video').evaluate(v=>v.muted)).toBe(true);
  await page.locator('.dialogue-script summary').click();
  for(const line of roleById['villain-calmer'].dialogue) await expect(page.locator('.dialogue-script')).toContainText(line);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('secret entry, opt-in, both earned unlocks, persistence, and reset work end to end',async({page})=>{
  test.setTimeout(120000);
  await page.goto('/');
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
    const role=hiddenRoles[round],answers=answersFor(role);
    if(round) {
      await page.goto('/#/result');
      await page.getByRole('button',{name:'再选一次，我有别的剧本'}).click();
      await page.getByRole('dialog').getByRole('button',{name:'重新开始',exact:true}).click();
      await expect(page).toHaveURL(/#\/test$/);
    }
    for(let i=0;i<questions.length;i++) {
      const slider=page.getByRole('slider');
      await slider.focus();
      await slider.press(answers[questions[i].id]===0?'Home':'End');
      await page.getByRole('button',{name:i===39?'揭晓我的主角':'下一幕',exact:true}).click();
    }
    await expect(page).toHaveURL(/#\/result$/);
    await expect(page.getByRole('heading',{level:1})).toHaveText(role.name);
    await expect(page.locator('.hidden-result-badge')).toBeVisible();
    await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)).unlocked,HIDDEN_STORAGE_KEY)).toContain(role.id);
    await page.reload();
    await expect(page.getByRole('heading',{level:1})).toHaveText(role.name);
    await page.goto(`/#/role/${role.id}`);
    await expect(page.getByRole('heading',{level:1})).toHaveText(role.name);
    await page.goto('/#/');
    await expect(page.getByRole('button',{name:/^预览/})).toHaveCount(19+round);
  }
  await openSecrets(page);
  await expect(page.locator('.secret-count')).toContainText('2 / 2');
  await page.getByRole('button',{name:'清空彩蛋记录并关闭'}).click();
  await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
  await expect(page.getByRole('button',{name:/^预览/})).toHaveCount(18);
  await expect(page.locator('.mystery-role')).toHaveCount(2);
  await page.goto(`/#/role/${hiddenRoles[0].id}`);
  await expect(page.getByRole('heading',{level:1})).toHaveText('这份隐藏剧本，还没有解锁');
});
