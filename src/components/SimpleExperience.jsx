import React, { useEffect, useState } from 'react';
import { ArrowRight, ScanLine, Info } from 'lucide-react';
import { SESSION_SIZE } from '../question-session.js';
import homeCover from '../assets/home-black-hole.png';
import { ThemeToggle } from './ThemeToggle.jsx';
import { getParticipationDisplay, peekParticipationDisplay } from '../participation.js';

export function SimpleHeader({ onAbout }) {
  return <header className="simple-header"><a href="#/" className="simple-brand" aria-label="人格测试，返回首页"><ScanLine size={22}/><span>人格测试</span></a><nav aria-label="主导航"><ThemeToggle/><button onClick={onAbout} aria-label="关于测试" title="关于测试"><Info size={20}/></button></nav></header>;
}

export function SimpleHome({ count, onStart }) {
  const [participation, setParticipation] = useState(peekParticipationDisplay);
  useEffect(() => {
    let active = true;
    getParticipationDisplay().then(value => { if (active) setParticipation(value); });
    return () => { active = false; };
  }, []);
  return <main id="main-content" className="simple-home">
    {participation && <p className="opening-participation">目前 <span className="opening-participation-number">{participation}+</span> 人次完成测试</p>}
    <section className="opening-scene opening-poster" aria-labelledby="opening-title">
      <h1 id="opening-title" className="opening-heading">看见你自己</h1>
      <img className="opening-image" src={homeCover} alt="黑洞封面：认真回答，直面自我；映照真实的你自己" fetchPriority="high"/>
      <div className="opening-copy">
        <button className="opening-start" onClick={onStart}>{count === SESSION_SIZE ? '查看我的人格解析' : count > 0 ? `继续测试 · ${count}/${SESSION_SIZE}` : '开始人格测试'}<ArrowRight size={20}/></button>
        <span className="opening-note">20 个选择 · 约 2 分钟 · 无需登录</span>
      </div>
    </section>
  </main>;
}

export function SimpleFooter() {
  return <footer className="simple-footer"><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">辽ICP备2026023653号</a></footer>;
}
