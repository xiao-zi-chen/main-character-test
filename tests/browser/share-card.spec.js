import { test, expect } from '@playwright/test';
import { roles } from '../../src/data/roles.js';
import { HIDDEN_STORAGE_KEY } from '../../src/hidden-rules.js';
import { drawQuestions } from '../../src/question-session.js';
import { questions, dimensions } from '../../src/data/questions.js';
import { STORAGE_KEY, getResult } from '../../src/engine.js';
import { SCALE_MAX } from '../../src/data/answer-scale.js';
import { createHash } from 'node:crypto';

function answersFor(role,questionIds) {
  return Object.fromEntries(questionIds.map(id=>{const q=questions.find(item=>item.id===id);const units=Math.round(role.profile[dimensions.findIndex(d=>d.id===q.dimension)]*SCALE_MAX/100);return [id,q.highAnswer==='A'?SCALE_MAX-units:units];}));
}

test('all 28 saved character cards load the full artwork, description and homepage QR without cropping', async ({ page })=>{
  test.setTimeout(150000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const profiles={};
  const manifest=await (await page.request.get('/media/manifest.json')).json();
  const questionIds=drawQuestions();
  for(const role of roles) {
    const answers=answersFor(role,questionIds);
    expect(getResult(answers,{hiddenEnabled:Boolean(role.hidden),questionIds}).role.id).toBe(role.id);
    profiles[role.id]=answers;
  }
  await page.addInitScript(({key,profiles,hiddenKey,hiddenIds,questionIds})=>{
    const role=new URL(location.href).searchParams.get('shareCardRole');
    if(profiles[role]) {
      localStorage.setItem(key,JSON.stringify({version:5,questionIds,answers:profiles[role],index:19,submitted:true}));
      localStorage.setItem(hiddenKey,JSON.stringify({version:1,enabled:hiddenIds.includes(role),unlocked:[]}));
    }
  },{key:STORAGE_KEY,profiles,questionIds,hiddenKey:HIDDEN_STORAGE_KEY,hiddenIds:roles.filter(role=>role.hidden).map(role=>role.id)});
  for(const role of roles) {
    await page.goto(`/?shareCardRole=${role.id}#/result`);
    await expect(page.getByRole('heading',{level:1})).toHaveText(role.name);
    await expect(page.locator('.result-media img')).toHaveAttribute('src',/\?v=/);
    await page.getByRole('button',{name:'保存我的角色卡',exact:true}).click();
    const image=page.locator('.save-role-card');
    await expect(image).toBeVisible();
    const entry=manifest[role.id];
    expect(entry.cardSource).toBe('composite-film-reference');
    expect(entry.cardTitle).toBe(role.name);
    expect(entry.cardDescription).toBe(role.description);
    expect(entry.cardTagline).toBe(role.tagline);
    expect(entry.cardQrUrl).toBe('https://www.nbti.cn/');
    expect(entry.cardLayoutVersion).toBe(1);
    expect(entry.cardArtworkSize).toEqual([1024,1536]);
    expect(entry.cardArtwork).not.toBe(entry.card);
    expect(entry.cardArtworkSha256).toMatch(/^[a-f0-9]{64}$/);
    const expectedSize=entry.cardSize;
    expect(expectedSize[0]).toBe(1024);
    expect(expectedSize[1]).toBeGreaterThan(entry.cardArtworkSize[1]);
    await expect.poll(()=>image.evaluate(img=>[img.naturalWidth,img.naturalHeight])).toEqual(expectedSize);
    const imageUrl=await image.getAttribute('src');
    expect(imageUrl).toMatch(/\.png\?v=/);
    expect(imageUrl).toContain(`/media/${entry.card}`);
    const response=await page.request.get(imageUrl);
    expect(response.headers()['content-type']).toContain('image/png');
    const png=await response.body();
    expect(png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(createHash('sha256').update(png).digest('hex')).toBe(entry.cardSha256);
    expect([png.readUInt32BE(16),png.readUInt32BE(20)]).toEqual(expectedSize);
    const display=await image.evaluate(img=>({width:img.clientWidth,height:img.clientHeight}));
    expect(display.width).toBeGreaterThan(0);
    expect(Math.abs(display.height-display.width*expectedSize[1]/expectedSize[0]),`${role.name}: the complete artwork and footer must retain their native aspect ratio`).toBeLessThanOrEqual(1.5);
  }
  expect(errors).toEqual([]);
});
