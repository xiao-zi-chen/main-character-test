import { test, expect } from '@playwright/test';
import { roles } from '../../src/data/roles.js';
import { HIDDEN_STORAGE_KEY } from '../../src/hidden-rules.js';
import { drawQuestions } from '../../src/question-session.js';
import { questions, dimensions } from '../../src/data/questions.js';
import { STORAGE_KEY, getResult } from '../../src/engine.js';
import { SCALE_MAX } from '../../src/data/answer-scale.js';

function answersFor(role,questionIds) {
  return Object.fromEntries(questionIds.map(id=>{const q=questions.find(item=>item.id===id);const units=Math.round(role.profile[dimensions.findIndex(d=>d.id===q.dimension)]*SCALE_MAX/100);return [id,q.highAnswer==='A'?SCALE_MAX-units:units];}));
}

test('exported portraits preserve all 28 individual portraits at their native aspect ratios', async ({ page },testInfo)=>{
  test.setTimeout(150000);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const profiles={};
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
    const portraitUrl=await page.locator('.result-media img').getAttribute('src');
    await page.getByRole('button',{name:'保存我的角色卡',exact:true}).click();
    const image=page.locator('.save-role-card');
    await expect(image).toBeVisible();
    await expect.poll(()=>image.evaluate(img=>img.naturalWidth)).toBe(900);
    const imageUrl=await image.getAttribute('src');
    expect(imageUrl).toMatch(/\.png\?v=/);
    const response=await page.request.get(imageUrl);
    expect(response.headers()['content-type']).toContain('image/png');
    const png=(await response.body()).toString('base64');
    const comparison=await page.evaluate(async ({png,portraitUrl})=>{
      const original=new Image();original.src=portraitUrl;
      const exported=new Image();exported.src=`data:image/png;base64,${png}`;
      await Promise.all([original.decode(),exported.decode()]);
      const source=document.createElement('canvas');source.width=900;source.height=1920;
      const sourceContext=source.getContext('2d');
      sourceContext.fillStyle='#111b2a';sourceContext.fillRect(90,128,720,1280);
      const scale=Math.min(720/original.naturalWidth,1280/original.naturalHeight);
      const width=original.naturalWidth*scale,height=original.naturalHeight*scale;
      sourceContext.drawImage(original,90+(720-width)/2,128+(1280-height)/2,width,height);
      const output=document.createElement('canvas');output.width=exported.naturalWidth;output.height=exported.naturalHeight;
      const outputContext=output.getContext('2d');outputContext.drawImage(exported,0,0);
      // Compare the complete source, including all four corners, the head and
      // the bottom of the image. A square crop or fading overlay must fail.
      const expected=sourceContext.getImageData(90,128,720,1280).data;
      const actual=outputContext.getImageData(90,128,720,1280).data;
      let differentChannels=0;
      for(let i=0;i<expected.length;i++) if(expected[i]!==actual[i]) differentChannels++;
      return {size:[exported.naturalWidth,exported.naturalHeight],sourceSize:[original.naturalWidth,original.naturalHeight],differentChannels};
    },{png,portraitUrl});
    expect(comparison.sourceSize.every(size=>size>0)).toBe(true);
    expect(comparison.size).toEqual([900,1920]);
    expect(comparison.differentChannels,`${role.name}: the complete original photo must remain intact`).toBe(0);
  }
  expect(errors).toEqual([]);
});
