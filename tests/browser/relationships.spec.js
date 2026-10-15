import { test, expect } from '@playwright/test';
import { regularRoles, roleById } from '../../src/data/roles.js';
import { relationships } from '../../src/data/relationships.js';

test.beforeEach(async ({page}) => {
  await page.addInitScript(() => Object.defineProperty(navigator,'share',{value:undefined,configurable:true}));
});

test('social identities, reciprocal partners and share invitations work for every regular role', async ({page,context}) => {
  test.setTimeout(120000);
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const role of regularRoles) {
    await page.goto(`/#/role/${role.id}`);
    await expect(page.locator('.result-tagline')).toHaveText(relationships[role.id].identity);
    await expect(page.locator('.relationship-details > div')).toHaveCount(3);
    await expect(page.locator('.partner-panel h3')).toHaveText(roleById[role.partner].name);
    await page.getByRole('button',{name:'找 TA 来认领'}).click();
    const invitation=await page.evaluate(()=>navigator.clipboard.readText());
    expect(invitation).toContain(role.name);
    expect(invitation).toContain(roleById[role.partner].name);
    expect(invitation).toContain(relationships[role.id].prompt);
    expect(invitation).toContain(`#/role/${role.id}`);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('manual sharing preserves the invitation when clipboard access fails',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('denied'))}}));
  await page.goto('/#/role/social-shield');
  await page.getByRole('button',{name:'找 TA 来认领'}).click();
  await expect(page.getByRole('textbox',{name:'角色分享邀请'})).toHaveValue(/门面担当[\s\S]*猫老板情绪翻译官[\s\S]*#\/role\/social-shield/);
});
