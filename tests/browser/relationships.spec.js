import {test,expect} from '@playwright/test';
import {regularRoles,roleById} from '../../src/data/roles.js';
import {relationships} from '../../src/data/relationships.js';

test('only same-film pairs show a partner and both share buttons share the same script',async({page})=>{
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
    await expect(share).toHaveCount(role.castIds.length===2 ? 2 : 1);
    await share.first().click();
    const invitation=await page.evaluate(()=>window.shared.at(-1));
    expect(invitation).toContain(role.name);
    expect(invitation).toContain(`#/role/${role.id}`);
    if(role.castIds.length===2) {
      await expect(page.locator('.partner-panel h3')).toHaveText(roleById[role.partner].name);
      await share.last().click();
      expect(await page.evaluate(()=>window.shared.at(-1))).toBe(invitation);
    } else {
      await expect(page.locator('.relationship-bond,.film-cast')).toHaveCount(0);
      expect(invitation).not.toContain('搭档');
    }
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
