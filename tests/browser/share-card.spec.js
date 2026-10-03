import { test, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { roles } from '../../src/data/roles.js';
import { HIDDEN_STORAGE_KEY } from '../../src/hidden-rules.js';
import { questions, dimensions } from '../../src/data/questions.js';
import { STORAGE_KEY, getResult } from '../../src/engine.js';

function answersFor(role) {
  const answers={};
  dimensions.forEach((dimension,index)=>{
    const items=questions.filter(question=>question.dimension===dimension.id);
    const positive=Math.round(role.profile[index]/100*items.length);
    items.forEach((question,i)=>{ const endpoint=i<positive?question.highAnswer:question.highAnswer==='A'?'B':'A';answers[question.id]=endpoint==='A'?0:14; });
  });
  return answers;
}

test('exported portraits preserve every pixel of all twenty original covers', async ({ page },testInfo)=>{
  test.setTimeout(150000);
  const directory=`.work/share-card-fix/${testInfo.project.name}`;
  await mkdir(directory,{recursive:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const profiles={};
  for(const role of roles) {
    const answers=answersFor(role);
    expect(getResult(answers,{hiddenEnabled:Boolean(role.hidden)}).role.id).toBe(role.id);
    profiles[role.id]=answers;
  }
  await page.addInitScript(({key,profiles,hiddenKey,hiddenIds})=>{
    const role=new URL(location.href).searchParams.get('shareCardRole');
    if(profiles[role]) {
      localStorage.setItem(key,JSON.stringify({version:2,answers:profiles[role],index:39,submitted:true}));
      localStorage.setItem(hiddenKey,JSON.stringify({version:1,enabled:hiddenIds.includes(role),unlocked:[]}));
    }
  },{key:STORAGE_KEY,profiles,hiddenKey:HIDDEN_STORAGE_KEY,hiddenIds:roles.filter(role=>role.hidden).map(role=>role.id)});
  for(const role of roles) {
    await page.goto(`/?shareCardRole=${role.id}#/result`);
    await expect(page.getByRole('heading',{level:1})).toHaveText(role.name);
    await expect(page.locator('.result-media video')).toHaveAttribute('poster',/\?v=/);
    const portraitUrl=await page.locator('.result-media video').getAttribute('poster');
    const downloading=page.waitForEvent('download');
    await page.getByRole('button',{name:'保存我的角色卡',exact:true}).click();
    const download=await downloading;
    const filename=`${directory}/${role.id}.png`;
    await download.saveAs(filename);
    expect(download.suggestedFilename()).toBe(`我的主角剧本-${role.name}.png`);

    const png=(await readFile(filename)).toString('base64');
    const comparison=await page.evaluate(async ({png,portraitUrl})=>{
      const original=new Image();original.src=portraitUrl;
      const exported=new Image();exported.src=`data:image/png;base64,${png}`;
      await Promise.all([original.decode(),exported.decode()]);
      const source=document.createElement('canvas');source.width=original.naturalWidth;source.height=original.naturalHeight;
      const sourceContext=source.getContext('2d');sourceContext.drawImage(original,0,0);
      const output=document.createElement('canvas');output.width=exported.naturalWidth;output.height=exported.naturalHeight;
      const outputContext=output.getContext('2d');outputContext.drawImage(exported,0,0);
      // Compare the complete source, including all four corners, the head and
      // the bottom of the image. A square crop or fading overlay must fail.
      const expected=sourceContext.getImageData(0,0,720,1280).data;
      const actual=outputContext.getImageData(90,128,720,1280).data;
      let differentChannels=0;
      for(let i=0;i<expected.length;i++) if(expected[i]!==actual[i]) differentChannels++;
      return {size:[exported.naturalWidth,exported.naturalHeight],sourceSize:[original.naturalWidth,original.naturalHeight],differentChannels};
    },{png,portraitUrl});
    expect(comparison.sourceSize).toEqual([720,1280]);
    expect(comparison.size).toEqual([900,1920]);
    expect(comparison.differentChannels,`${role.name}: the complete original photo must remain intact`).toBe(0);
  }
  expect(errors).toEqual([]);
});
