import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {roles} from '../../src/data/roles.js';
const selection=JSON.parse(await readFile(new URL('../../content/selected-films.json',import.meta.url),'utf8'));

test('the selected directory contains exactly 28 named people and keeps the author credit',async({page})=>{
  await page.goto('/');
  await expect(page.locator('.simple-footer > span')).toHaveText('拾壹 / 我燃起来了 / FhwuTrqr / Le Prince Grenouille');
  await page.goto('/#/characters');
  await expect(page.getByRole('button',{name:/^预览/})).toHaveCount(28);
  await expect(page.locator('.gallery-secret')).toHaveCount(0);
  for(const role of roles) await expect(page.getByRole('button',{name:`预览${role.name}`,exact:true})).toBeVisible();
});

test('each dual cast member has a distinct URL, portrait and personality while sharing the exact film URL',async({page})=>{
  test.setTimeout(120000);
  for(const film of selection.films.filter(f=>f.cast.length===2)) {
    const portraits=[],descriptions=[],videos=[];
    for(const person of film.cast) {
      await page.goto(`/#/role/${person.id}`);
      await expect(page.getByRole('heading',{level:1})).toHaveText(person.name);
      await expect(page.locator('.film-cast a')).toHaveCount(2);
      await expect(page.locator('.film-cast a[aria-current="page"]')).toHaveAttribute('href',`#/role/${person.id}`);
      portraits.push(await page.locator('.result-media img').getAttribute('src'));
      descriptions.push(await page.locator('.relationship-details').innerText());
      await page.getByRole('button',{name:`观看${person.name}的短片`,exact:true}).click();
      videos.push(await page.locator('dialog video').getAttribute('src'));
      await expect(page.locator('dialog video')).toHaveJSProperty('muted',false);
      await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
    }
    expect(new Set(portraits).size,film.id).toBe(2);
    expect(new Set(descriptions).size,film.id).toBe(2);
    expect(new Set(videos).size,film.id).toBe(1);
    await page.locator(`.film-cast a[href="#/role/${film.cast[0].id}"]`).click();
    await expect(page.getByRole('heading',{level:1})).toHaveText(film.cast[0].name);
  }
});
