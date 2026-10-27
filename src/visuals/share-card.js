import qr from '../../content/character-card-qr.json';
export const CARD_SITE_URL = 'https://www.nbti.cn/';
export const CARD_LAYOUT_VERSION = 1;
const FONT = '"Microsoft YaHei", "PingFang SC", sans-serif';
function wrapText(ctx, text, width) {
  const lines = [];
  let line = '';
  for (const character of Array.from(text)) {
    if (line && ctx.measureText(line + character).width > width) {
      if (/^[，。！？；：、）》」』】]$/.test(character) && Array.from(line).length > 1) {
        const letters = Array.from(line), tail = letters.pop();
        lines.push(letters.join('')); line = tail + character;
      } else { lines.push(line); line = character; }
    } else line += character;
  }
  if (line) lines.push(line);
  return lines;
}
function drawQr(ctx, box) {
  if (qr.url !== CARD_SITE_URL || qr.modules.length < 21 || qr.modules.some(row => row.length !== qr.modules.length || row.some(cell => cell !== 0 && cell !== 1))) throw new Error('二维码数据无效');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(box.x, box.y, box.size, box.size);
  ctx.fillStyle = '#000000';
  qr.modules.forEach((row,y) => row.forEach((dark,x) => {
    if (dark) ctx.fillRect(box.x+(x+4)*box.moduleSize,box.y+(y+4)*box.moduleSize,box.moduleSize,box.moduleSize);
  }));
}
// Preserve the original artwork; append readable text and a scannable code.
export async function createRoleCard(role, artworkUrl) {
  await document.fonts.ready;
  const artwork = new Image(); artwork.crossOrigin = 'anonymous'; artwork.src = artworkUrl;
  await artwork.decode();
  if (artwork.naturalWidth !== 1024 || artwork.naturalHeight !== 1536) throw new Error('角色原图须为1024×1536');
  if (!role.tagline || !role.description) throw new Error('角色简介不能为空');
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建角色卡');
  ctx.font = `600 46px ${FONT}`;
  const taglineLines = wrapText(ctx,role.tagline,896);
  ctx.font = `38px ${FONT}`;
  const descriptionLines = wrapText(ctx,role.description,896);
  const taglineTop = 1636, descriptionTop = taglineTop+taglineLines.length*64+28;
  const descriptionBottom = descriptionTop+descriptionLines.length*58;
  const size = (qr.modules.length+8)*8;
  const height = Math.max(2496,Math.ceil((descriptionBottom+40+48+size+68)/32)*32);
  const qrBox = {x:64,y:height-68-size,moduleSize:8,size};
  const dividerY = qrBox.y-48;
  canvas.width=1024; canvas.height=height;
  ctx.fillStyle='#101a16'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(artwork,0,0);
  ctx.strokeStyle='#9d8050'; ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(22,1536);ctx.lineTo(22,height-24);ctx.lineTo(1002,height-24);ctx.lineTo(1002,1536);ctx.stroke();
  ctx.textBaseline='top';ctx.fillStyle='#c0a673';ctx.font=`28px ${FONT}`;
  ctx.fillText('我的主角剧本',64,1576);
  ctx.fillStyle='#f2e7ce';ctx.font=`600 46px ${FONT}`;
  taglineLines.forEach((line,i)=>ctx.fillText(line,64,taglineTop+i*64));
  ctx.fillStyle='#d0d8cd';ctx.font=`38px ${FONT}`;
  descriptionLines.forEach((line,i)=>ctx.fillText(line,64,descriptionTop+i*58));
  ctx.strokeStyle='#4c5546';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(64,dividerY);ctx.lineTo(960,dividerY);ctx.stroke();
  drawQr(ctx,qrBox);
  const footerX=qrBox.x+qrBox.size+48,footerY=qrBox.y+34;
  ctx.fillStyle='#f2e7ce';ctx.font=`600 40px ${FONT}`;ctx.fillText('你会是哪一种主角？',footerX,footerY);
  ctx.fillStyle='#c1cdbf';ctx.font=`32px ${FONT}`;ctx.fillText('扫码，领取你的主角剧本',footerX,footerY+66);
  ctx.fillStyle='#d8bc83';ctx.font='32px Arial, sans-serif';ctx.fillText('www.nbti.cn',footerX,footerY+124);
  ctx.fillStyle='#91a18f';ctx.font=`24px ${FONT}`;ctx.fillText('主角请就位 · NBTI',footerX,footerY+178);
  canvas.cardLayout={version:CARD_LAYOUT_VERSION,width:canvas.width,height,
    artwork:{x:0,y:0,width:1024,height:1536},
    tagline:{text:role.tagline,lines:taglineLines,x:64,y:taglineTop,fontSize:46,lineHeight:64,width:896},
    description:{text:role.description,lines:descriptionLines,x:64,y:descriptionTop,fontSize:38,lineHeight:58,width:896},
    qr:{...qrBox,url:CARD_SITE_URL,quietZoneModules:4},dividerY};
  return canvas;
}