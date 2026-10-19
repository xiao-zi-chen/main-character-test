import {test,expect} from '@playwright/test';
import {regularRoles} from '../../src/data/roles.js';
import {relationships} from '../../src/data/relationships.js';

test('every result shows one character and both share buttons open the same script',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    window.shared=[];
    Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.shared.push(text)},configurable:true});
  });
  for(const role of regularRoles) {
    await page.goto(`/#/role/${role.id}`);
    await expect(page.locator('.result-tagline')).toHaveText(relationships[role.id].identity);
    await expect(page.locator('.relationship-details > div')).toHaveCount(3);
    const share=page.getByRole('button',{name:'分享剧本',exact:true});
    await expect(share).toHaveCount(2);
    await expect(page.locator('.film-cast,.relationship-bond')).toHaveCount(0);
    await share.first().click();
    await page.getByRole('button',{name:'复制剧本邀请',exact:true}).click();
    const invitation=await page.evaluate(()=>window.shared.at(-1));
    expect(invitation).toContain(role.name);
    expect(invitation).toContain(`#/role/${role.id}`);
    await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
    await share.last().click();
    await page.getByRole('button',{name:'复制剧本邀请',exact:true}).click();
    expect(await page.evaluate(()=>window.shared.at(-1))).toBe(invitation);
    await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('manual sharing preserves the script when clipboard access fails',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'share',{value:undefined});
    Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('denied'))}});
  });
  await page.goto('/#/role/social-shield');
  await page.getByRole('button',{name:'分享剧本',exact:true}).last().click();
  await expect(page.getByRole('textbox',{name:'角色分享邀请'})).toHaveValue(/那我给了呗[\s\S]*#\/role\/social-shield/);
});
