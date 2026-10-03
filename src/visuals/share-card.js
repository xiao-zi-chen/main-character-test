// A portrait-first sharing layout. The full source image stays visible:
// artwork, text and decoration each have their own space on the card.
export async function createRoleCard(role, portraitUrl) {
  await document.fonts.ready;
  const portrait=new Image();
  // COS images need CORS permission to keep the canvas exportable.
  portrait.crossOrigin='anonymous';
  portrait.src=portraitUrl;
  await portrait.decode();
  if(!portrait.naturalWidth || !portrait.naturalHeight) throw new Error('封面尺寸无效');

  const canvas=document.createElement('canvas');
  canvas.width=900;
  canvas.height=1920;
  const ctx=canvas.getContext('2d');
  if(!ctx) throw new Error('无法创建角色卡');

  ctx.fillStyle='#090f1a';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle='#454754';
  ctx.strokeRect(28,28,844,1864);

  ctx.fillStyle=role.color;
  ctx.beginPath();
  ctx.moveTo(65,55);ctx.lineTo(69,69);ctx.lineTo(83,73);ctx.lineTo(69,77);
  ctx.lineTo(65,91);ctx.lineTo(61,77);ctx.lineTo(47,73);ctx.lineTo(61,69);
  ctx.closePath();ctx.fill();
  ctx.font='bold 23px "Microsoft YaHei", sans-serif';
  ctx.fillText('主角请就位',96,82);
  ctx.font='13px Arial, sans-serif';
  ctx.fillText('THE MAIN CHARACTER PROJECT',256,81);
  ctx.textAlign='right';
  ctx.fillText(`${role.hidden?'SECRET':'NO.'} ${role.number} / ${roles.length}`,810,81);
  ctx.textAlign='left';

  const frame={x:90,y:128,width:720,height:1280};
  ctx.fillStyle='#111b2a';
  ctx.fillRect(frame.x,frame.y,frame.width,frame.height);
  // Contain the complete image. 720×1280 source covers render at native size.
  // Other aspect ratios retain the full composition with centered margins.
  const scale=Math.min(frame.width/portrait.naturalWidth,frame.height/portrait.naturalHeight);
  const width=portrait.naturalWidth*scale;
  const height=portrait.naturalHeight*scale;
  ctx.drawImage(portrait,frame.x+(frame.width-width)/2,frame.y+(frame.height-height)/2,width,height);
  ctx.strokeStyle='#465268';
  ctx.strokeRect(frame.x-4,frame.y-4,frame.width+8,frame.height+8);

  ctx.fillStyle=role.color;
  ctx.font='20px "Microsoft YaHei", sans-serif';
  ctx.fillText(`我的主角剧本 / ${role.genre}`,90,1468,720);
  ctx.fillStyle='#f8efe2';
  ctx.font='bold 64px "Microsoft YaHei", sans-serif';
  ctx.fillText(role.name,87,1563,723);
  ctx.fillStyle='#b4b9ca';
  ctx.font='26px "Microsoft YaHei", sans-serif';
  ctx.fillText(role.tagline,90,1630,720);

  ctx.font='20px "Microsoft YaHei", sans-serif';
  let chipX=90,chipY=1681;
  for(const talent of role.talents) {
    const chipWidth=Math.min(720,Math.ceil(ctx.measureText(talent).width)+28);
    if(chipX+chipWidth>810) { chipX=90;chipY+=55; }
    ctx.fillStyle='#172436';ctx.fillRect(chipX,chipY,chipWidth,41);
    ctx.strokeStyle='#3e4d63';ctx.strokeRect(chipX+.5,chipY+.5,chipWidth-1,40);
    ctx.fillStyle=role.color;ctx.fillText(talent,chipX+14,chipY+28,chipWidth-28);
    chipX+=chipWidth+12;
  }

  ctx.strokeStyle='#383f50';
  ctx.beginPath();ctx.moveTo(90,1805);ctx.lineTo(810,1805);ctx.stroke();
  ctx.fillStyle='#929aae';
  ctx.font='20px "Microsoft YaHei", sans-serif';
  ctx.fillText('人生没有标准剧本。你，就是主角。',90,1856,720);
  ctx.fillStyle='#74849a';ctx.font='14px "Microsoft YaHei", sans-serif';
  ctx.fillText('作者：陈嘉恒、卜俊程、李家兴、肖宇诚',90,1880,720);
  return canvas;
}

export async function downloadRoleCard(role, portraitUrl) {
  const canvas=await createRoleCard(role,portraitUrl);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob) throw new Error('角色卡生成失败');
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download=`我的主角剧本-${role.name}.png`;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}
import { roles } from '../data/roles.js';
