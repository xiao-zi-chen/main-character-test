import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Clapperboard, Info, Search, LockKeyhole } from 'lucide-react';
import { roles } from '../data/roles.js';
import { relationships } from '../data/relationships.js';
import { canViewRole } from '../hidden-rules.js';
import { mediaAsset } from '../media.js';
import { SESSION_SIZE } from '../question-session.js';

export function SimpleHeader({ onSecretTap, onAbout }) {
  return <header className="simple-header"><a href="#/" className="simple-brand" onClick={onSecretTap} aria-label="主角请就位，返回首页"><Clapperboard size={22}/><span>主角请就位</span></a><nav aria-label="主导航"><button onClick={onAbout} aria-label="关于测试" title="关于测试"><Info size={20}/></button></nav></header>;
}

export function SimpleHome({ count, onStart, manifest }) {
  const role=roles.find(item=>item.id==='plot-rewriter');
  return <main id="main-content" className="simple-home"><section className="opening-scene" aria-labelledby="opening-title"><img className="opening-image" src={mediaAsset(role,manifest[role.id])} alt="月光下的白衣主角" fetchPriority="high"/><div className="opening-shade"/><div className="opening-copy"><p className="opening-caption">每一种你，都值得一场好戏</p><h1 id="opening-title">主角请就位</h1><p className="opening-description">找到你的人设。<br/>也找到那个，和你接得上戏的人。</p><button className="opening-start" onClick={onStart}>{count===SESSION_SIZE?'查看我的主角剧本':count>0?`继续测试 · ${count}/${SESSION_SIZE}`:'测测我的主角人设'}<ArrowRight size={20}/></button><span className="opening-note">20 个选择 · 约 2 分钟 · 无需登录</span></div></section></main>;
}

export function CharacterGallery({manifest,hiddenState,onPreview,onHiddenHint}) {
  const [query,setQuery]=useState('');
  const available=roles.filter(role=>canViewRole(role,hiddenState));
  const matched=available.filter(role=>`${role.name}${relationships[role.id].identity}`.includes(query.trim()));
  return <main id="main-content" className="simple-gallery"><a className="gallery-back" href="#/"><ArrowLeft size={16}/> 返回首页</a><div className="gallery-heading"><div><h1>故事里的人</h1><p>看看谁像你，谁像你身边的人。</p></div><label className="gallery-search"><Search size={18}/><input aria-label="搜索角色" placeholder="找一个人设" value={query} onChange={event=>setQuery(event.target.value)}/></label></div><div className="simple-gallery-grid">{matched.map(role=><button className="simple-character" key={role.id} onClick={()=>onPreview(role)} aria-label={`预览${role.name}`}><div className="simple-character-image"><img src={mediaAsset(role,manifest[role.id],'poster')} alt="" loading="lazy"/><ArrowRight size={19}/></div><h2>{role.name}</h2><p>{relationships[role.id].identity}</p></button>)}</div>{!matched.length&&<p className="gallery-empty">还没找到这个人设，换个关键词试试。</p>}{!query.trim()&&available.length<roles.length&&<button className="gallery-secret" onClick={onHiddenHint}><LockKeyhole size={17}/> 还有一些故事，等你亲自遇见 <ArrowRight size={16}/></button>}</main>;
}

export function SimpleFooter() {
  return <footer className="simple-footer"><span>拾壹 / 我燃起来了 / FhwuTrqr / Le Prince Grenouille</span><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">辽ICP备2026023653号</a></footer>;
}
