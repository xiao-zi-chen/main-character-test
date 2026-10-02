import React, { useEffect, useId, useMemo, useRef } from 'react';
import { Play, Sparkles, Crown, Ghost, Flower2, Sun, MessageCircleHeart, Wrench, BriefcaseBusiness } from 'lucide-react';
import { roles, regularRoles, roleById, mediaPath } from '../data/roles.js';
import { worldSvg, worldNotes } from './world-art.js';
import { durationLabel, durationSeconds, mediaAsset } from '../media.js';

const BASE = import.meta.env.BASE_URL;
export const worldPath = role => `${BASE}worlds/${role.id}.svg`;

export function WorldArt({ role, className = '', ...props }) {
  const id = useId();
  const html = useMemo(() => worldSvg(role, id), [role, id]);
  return <div className={`world-art ${className}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} {...props} />;
}

export function Stardust({ color = '#dfbb83' }) {
  const canvas = useRef(null);
  useEffect(() => {
    const node = canvas.current;
    const ctx = node.getContext('2d');
    if (!ctx) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0, height = 0, frame = 0, visible = true, lastPaint = 0;
    const stars = Array.from({ length: 52 }, (_, i) => ({ x: (i * .6180339) % 1, y: (i * .381967 + .14) % 1, radius: i % 8 === 0 ? 1.65 : .7, speed: .35 + (i % 7) / 7 }));
    const paint = time => {
      ctx.clearRect(0, 0, width, height);
      stars.forEach((star, i) => {
        const y = (star.y * height - (preference.matches ? 0 : time * .007 * star.speed) + height * 100) % height;
        const x = star.x * width + Math.sin(time * .0002 + i) * (preference.matches ? 0 : 6);
        ctx.globalAlpha = .15 + (i % 5) * .1;
        ctx.fillStyle = color;
        ctx.beginPath();ctx.arc(x,y,star.radius,0,Math.PI*2);ctx.fill();
      });
    };
    const tick = time => { if (visible && !document.hidden && time - lastPaint > 32) { paint(time);lastPaint=time; } frame=requestAnimationFrame(tick); };
    const resize = () => {
      const rect = node.getBoundingClientRect();width=rect.width;height=rect.height;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      node.width=width*pixelRatio;node.height=height*pixelRatio;ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);paint(0);
    };
    const motion = () => { cancelAnimationFrame(frame);paint(0);if(!preference.matches) frame=requestAnimationFrame(tick); };
    const observer = new ResizeObserver(resize);observer.observe(node);
    const visibility = new IntersectionObserver(entries => { visible=entries[0].isIntersecting; });visibility.observe(node);
    preference.addEventListener('change',motion);resize();motion();
    return () => { cancelAnimationFrame(frame);observer.disconnect();visibility.disconnect();preference.removeEventListener('change',motion); };
  }, [color]);
  return <canvas className="stardust" ref={canvas} aria-hidden="true" />;
}

const portals = [
  {role:roleById['villain-calmer'],label:'反派降温',icon:MessageCircleHeart},
  {role:roleById['immortal-support'],label:'修仙售后',icon:Wrench},
  {role:roleById['dragon-office-worker'],label:'龙王打卡',icon:BriefcaseBusiness},
  {role:roleById['lucky-disaster'],label:'锦鲤翻盘',icon:Sparkles},
  {role:roles[1],label:'国运觉醒',icon:Sun},
  {role:roles[5],label:'重生翻盘',icon:Crown},
];

export function WorldPortal({ role, onSelect, onPreview, media }) {
  const stage = useRef(null);
  const index = portals.findIndex(portal=>portal.role.id===role.id);
  const scene = worldNotes[role.id];
  function move(event) {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect=event.currentTarget.getBoundingClientRect();
    stage.current?.style.setProperty('--tilt-x',`${((event.clientX-rect.left)/rect.width-.5)*9}deg`);
    stage.current?.style.setProperty('--tilt-y',`${((event.clientY-rect.top)/rect.height-.5)*-7}deg`);
  }
  function reset() { stage.current?.style.setProperty('--tilt-x','0deg');stage.current?.style.setProperty('--tilt-y','0deg'); }
  return <div className="world-portal" style={{'--world-color':role.color}}>
    <div className="portal-coordinate"><span><i/>平行世界信号已接通</span><span>UNIVERSE / {role.number}</span></div>
    <div className="portal-stage" onPointerMove={move} onPointerLeave={reset}>
      <div className="portal-orbit orbit-one"/><div className="portal-orbit orbit-two"/>
      <div className="portal-depth" ref={stage}>
        <div className="portal-card-back back-left"><WorldArt role={roles[3]}/><span>改写命运</span></div>
        <div className="portal-card-back back-right"><WorldArt role={roles[6]}/><span>心声外放</span></div>
        <button className="portal-main-card" onClick={()=>onPreview(role)} aria-label={`观看${role.name}专属预告`}>
          <div className="portal-scene" key={role.id}>{media?.status==='final'?<img className="portal-native-portrait" src={mediaAsset(role,media)} alt=""/>:<WorldArt role={role}/>}</div>
          <div className="portal-card-top"><span>命 运 档 案</span><b>{role.number}<i>/{roles.length}</i></b></div>
          <div className="portal-card-bottom"><span>{role.genre} · {scene.label}</span><strong>{role.name}</strong><small>{role.english}</small></div>
          <span className="portal-play"><Play size={15} fill="currentColor"/> 解锁{durationLabel(media)}预告</span>
        </button>
        <div className="floating-seal"><Sparkles size={20}/><div><small>主角光环</small><strong>等待你的觉醒</strong></div><span>✧</span></div>
        <div className="floating-ability"><span className="ability-diamond">✦</span><span>天赋载入<strong>{scene.power}</strong></span></div>
      </div>
      <span className="portal-floor"/><span className="portal-sideword">YOUR OTHER LIFE</span>
    </div>
    <div className="world-selector" aria-label="切换平行世界">{portals.map(({role:option,label,icon:Icon})=><button key={option.id} onClick={()=>onSelect(option)} aria-pressed={role.id===option.id} className={role.id===option.id?'active':''}><Icon size={16}/><span>{label}</span></button>)}</div>
    <div className="world-caption"><p key={role.id}>{scene.chapter}</p><span>{String(index+1).padStart(2,'0')}<i>/ {String(portals.length).padStart(2,'0')}</i></span></div>
  </div>;
}

export function RolePoster({ role, media }) {
  const note = worldNotes[role.id];
  const seconds=durationSeconds(media);
  return <div className="role-poster cinematic-poster">
    <img src={media?.status==='final' ? mediaAsset(role,media,'poster') : worldPath(role)} alt={`${role.name}角色海报`} loading="lazy" />
    <span className="poster-shine"/>
    <div className="role-poster-top"><span>{role.genre}</span><span>{role.number}</span></div>
    <div className="poster-inscription"><small>{note.label}</small><h3>{role.name}</h3><span>{role.english}</span></div>
    <span className="role-card-play"><Play size={18} fill="currentColor"/></span>
    <div className="poster-bottomline"><span>PERSONALITY / {role.number}</span><span>{seconds===null?'PREVIEW':`${String(seconds).padStart(2,'0')} SEC`}</span></div>
  </div>;
}

export function DestinyRadar({ scores, color }) {
  const cx=190,cy=155,radius=99;
  const point=(value,index,extra=0)=>{const angle=-Math.PI/2+index*Math.PI*2/10;return [cx+Math.cos(angle)*(radius*value+extra),cy+Math.sin(angle)*(radius*value+extra)];};
  const polygon=value=>scores.map((_,i)=>point(value,i).join(',')).join(' ');
  const values=scores.map((score,i)=>point(score.value/100,i));
  return <svg className="destiny-radar" viewBox="0 0 380 310" role="img" aria-label="十个选择倾向雷达图，具体倾向见下方列表">
    {[.25,.5,.75,1].map(scale=><polygon key={scale} points={polygon(scale)} fill="none" stroke="currentColor" opacity={scale===1?.3:.14}/>) }
    {scores.map((score,i)=>{const outer=point(1,i);const label=point(1,i,31);return <g key={score.id}><path d={`M${cx},${cy}L${outer[0]},${outer[1]}`} stroke="currentColor" opacity=".12"/><text x={label[0]} y={label[1]} fill="currentColor" textAnchor="middle" dominantBaseline="central">{score.label}</text></g>;})}
    <polygon points={values.map(p=>p.join(',')).join(' ')} fill={color} fillOpacity=".17" stroke={color} strokeWidth="1.5"/>
    {values.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="2.7" fill={color}/>)}
    <circle cx={cx} cy={cy} r="2" fill={color}/>
  </svg>;
}

export function AwakeningArt({ role }) {
  const i=Number(role.number)-1;
  return <div className="awakening-art" style={{'--world-color':role.color}} aria-hidden="true"><div className="awakening-halo"/><div className="awakening-card awakening-left"><WorldArt role={regularRoles[(i+3)%regularRoles.length]}/></div><div className="awakening-card awakening-center"><WorldArt role={role}/><span>YOUR DESTINY AWAITS</span></div><div className="awakening-card awakening-right"><WorldArt role={regularRoles[(i+6)%regularRoles.length]}/></div><div className="awakening-scan"/></div>;
}
