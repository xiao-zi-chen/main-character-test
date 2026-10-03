import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight, ArrowRight, ArrowLeft, ChevronDown, Check, X, Play, Pause,
  Volume2, VolumeX, RotateCcw, Download, Share2, Sparkles,
  Film, Clock3, ShieldCheck, Crown, Sun, Ghost, BookOpen,
  ScanLine, Gem, MessageCircleHeart, Orbit, Flower2, CookingPot, Wrench, FileCheck2, BriefcaseBusiness, Clapperboard, Cpu, LockKeyhole,
} from 'lucide-react';
import { questions } from './data/questions.js';
import { roles, regularRoles, hiddenRoles, roleById, mediaPath } from './data/roles.js';
import { readHiddenState, saveHiddenState, canViewRole } from './hidden-rules.js';
import { answeredCount, getResult, isAnswer, isComplete, readProgress, saveProgress } from './engine.js';
import { AnswerScale } from './components/AnswerScale.jsx';
import { WorldArt, WorldPortal, RolePoster, Stardust, DestinyRadar, AwakeningArt, worldPath } from './visuals/Cinematic.jsx';
import { worldNotes } from './visuals/world-art.js';
import { durationLabel, formatPlaybackTime, collectionDuration, mediaAsset } from './media.js';
import { questionCopy } from './data/question-copy.js';
import { mediaBaseUrl } from './runtime-config.js';
import { downloadRoleCard } from './visuals/share-card.js';
import './styles.css';
import './cinema.css';
import './season2.css';

const iconMap = { Crown, Sun, Ghost, BookOpen, ScanLine, Gem, MessageCircleHeart, Orbit, Flower2, CookingPot, Wrench, FileCheck2, BriefcaseBusiness, Clapperboard, Cpu, Sparkles, ShieldCheck };
const acts = [
  { title: '本能登场', description: '听听你的第一反应', caption: '不必想太久，第一直觉就很好。' },
  { title: '人际江湖', description: '在关系里，看见自己', caption: '没有标准答案，也没有需要扮演的人。' },
  { title: '野心觉醒', description: '找到你心里的那团火', caption: '普通的日常，也藏着你的主角线索。' },
  { title: '命运落笔', description: '你的剧本，快要揭晓', caption: '最后一幕，继续做最真实的自己。' },
];

function Star({ className = '', ...props }) {
  return <svg viewBox="0 0 48 48" className={`star-mark ${className}`} fill="currentColor" aria-hidden="true" {...props}><path d="m24 0 5.5 18.5L48 24l-18.5 5.5L24 48l-5.5-18.5L0 24l18.5-5.5Z" /></svg>;
}
function RoleIcon({ role, ...props }) { const Icon = iconMap[role.icon]; return <Icon {...props} />; }
function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReduced(media.matches); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  return reduced;
}
function routeFromHash() {
  const hash = window.location.hash.slice(1) || '/';
  if (['/', '/test', '/reveal', '/result'].includes(hash)) return hash;
  if (hash.startsWith('/role/') && Object.hasOwn(roleById, hash.slice(6))) return hash;
  return '/';
}
function go(route) { window.location.hash = route; }

function Header({ route, count, onStart, onSection, onSecretTap }) {
  return <header className="site-header">
    <a className="wordmark" href="#/" onClick={onSecretTap} aria-label="主角请就位，返回首页"><span className="brand-icon"><Star /></span><span>主角请就位<small>THE MAIN CHARACTER PROJECT</small></span></a>
    <nav aria-label="主导航">
      <button className={route === '/' ? 'active' : ''} onClick={() => onSection('characters')}>主角图鉴</button>
      <button onClick={() => onSection('how-it-works')}>测试说明</button>
      {count === 40 && <button onClick={() => go('/result')}>我的剧本</button>}
    </nav>
    <button className="header-cta" onClick={onStart}>{count === 40 ? '我的主角人生' : count > 0 ? '继续选角' : '开启我的剧本'}<ArrowUpRight size={17} /></button>
  </header>;
}

function Footer({ onSection }) {
  return <footer className="site-footer"><a href="#/" className="footer-brand"><Star /> 主角请就位</a><p>人生没有标准剧本。你，就是主角。</p><button onClick={() => onSection('faq')}>关于这场测试 <ArrowUpRight size={14} /></button><span className="footer-note">FOR FUN. FOR YOUR OWN STORY.</span><small className="footer-authors">作者：陈嘉恒、卜俊程、李家兴、肖宇诚</small></footer>;
}

function Modal({ title, onClose, children, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const onKey = event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const nodes = ref.current?.querySelectorAll('button:not([disabled]), a[href], input, [tabindex="0"]');
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
      <button className="modal-close icon-button" aria-label="关闭弹窗" onClick={onClose}><X size={22} /></button>{children}
    </section>
  </div>;
}

function VideoPlayer({ role, media, autoplay = true }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  const status=media?.status;
  const seconds=playbackSeconds || (Number(media?.duration) || 0);
  const lengthLabel=durationLabel({duration:seconds});
  const src = mediaPath(role, 'mp4', media?.revision);
  const poster = mediaAsset(role,media);
  useEffect(() => {
    setFailed(false);setPlaying(false);setProgress(0);setPlaybackSeconds(0);
    const video = ref.current;
    const pauseOther = event => {if(event.detail!==video) video?.pause();};
    document.addEventListener('casting:video-play',pauseOther);
    if (autoplay && !reduced && video) video.play().catch(() => setPlaying(false));
    return ()=>document.removeEventListener('casting:video-play',pauseOther);
  }, [autoplay, reduced, src]);
  function toggle() {
    if (!ref.current || failed) return;
    if (ref.current.paused) ref.current.play().catch(() => setPlaying(false)); else ref.current.pause();
  }
  function hearDialogue() {
    setMuted(false);
    if(ref.current) {ref.current.muted=false;ref.current.play().catch(()=>setPlaying(false));}
  }
  return <div className="video-player" style={{ '--role-color': role?.color ?? '#d0f75b' }}>
    <video ref={ref} src={src} poster={poster} muted={muted} loop playsInline preload="metadata" aria-label={`${role.name}，${lengthLabel}${status === 'final' ? '角色视频' : '动态分镜'}`} onLoadedMetadata={event=>setPlaybackSeconds(event.currentTarget.duration)} onPlay={event => {setPlaying(true);document.dispatchEvent(new CustomEvent('casting:video-play',{detail:event.currentTarget}));}} onPause={() => setPlaying(false)} onError={() => { setFailed(true); setPlaying(false); }} onTimeUpdate={event => { const video=event.currentTarget;setProgress(Number.isFinite(video.duration)&&video.duration>0?video.currentTime/video.duration*100:0); }} />
    <span className="video-label"><span />{status === 'final' ? '主角高光时刻' : '动态分镜预览'}</span>
    <span className="video-duration">{formatPlaybackTime(seconds)}</span>
    {media?.nativeDialogue && muted && !failed && <button className="native-sound-button" onClick={hearDialogue}><Volume2 size={15}/> 听原声</button>}
    {!playing && !failed && <button className="big-play" onClick={toggle} aria-label="播放视频"><Play size={29} fill="currentColor" /></button>}
    {failed && <div className="video-error"><Film /><p>这场好戏暂时无法播放</p><span>你仍然可以查看下方的完整角色剧本。</span></div>}
    {status === 'final' && !media?.embeddedTitle && <div className="final-video-title"><small>你的主角身份</small><strong>{role.name}</strong></div>}
    <div className="video-controls"><button className="icon-button" aria-label={playing ? '暂停视频' : '播放视频'} onClick={toggle} disabled={failed}>{playing ? <Pause size={18} /> : <Play size={18} />}</button><span className="video-track"><i style={{ width: `${Math.min(progress, 100)}%` }} /></span><button className="icon-button" aria-label={muted ? '开启声音' : '关闭声音'} onClick={() => setMuted(value => !value)} disabled={failed||media?.hasAudio===false}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button></div>
  </div>;
}

function DialogueScript({ role }) {
  if(!role.dialogue?.length) return null;
  return <details className="dialogue-script"><summary><MessageCircleHeart size={16}/><span>原生对白脚本</span><ChevronDown size={15}/></summary><ol>{role.dialogue.map((line,index)=><li key={index}><span>0{index+1}</span><p>{line}</p></li>)}</ol></details>;
}

function Home({ count, onStart, onPreview, manifest, hiddenState, onHiddenHint }) {
  const [filter, setFilter] = useState('全部剧本');
  const [activeWorld, setActiveWorld] = useState(roleById['villain-calmer']);
  const movieLength=collectionDuration(manifest);
  const available = roles.filter(role => canViewRole(role, hiddenState)).sort((a,b)=>Number(b.collection==='season2')-Number(a.collection==='season2')||a.number.localeCompare(b.number));
  const shown = filter === '全部剧本' ? available : available.filter(role => filter==='第二季新角'?role.collection==='season2':role.category===filter);
  const locked = hiddenRoles.filter(role => !canViewRole(role, hiddenState));
  function explore() { document.getElementById('characters')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); }
  return <main id="main-content" className="home-main" style={{'--world-color':activeWorld.color}}>
    <section className="cinematic-hero" aria-labelledby="hero-title">
      <div className="hero-nebula"/><Stardust color={activeWorld.color}/><span className="hero-outline-word" aria-hidden="true">PROTAGONIST</span>
      <div className="hero page-width">
        <div className="hero-copy">
          <div className="eyebrow hero-eyebrow"><Sparkles size={13}/><span>平行宇宙 · 主角觉醒测试</span><i>VOL. 02</i></div>
          <h1 id="hero-title">这一世，<br/>轮到你当<span className="hero-last"><em>主角</em><span className="hero-title-spark">✧</span><span className="title-period">。</span></span></h1>
          <div className="hero-title-caption"><span/> EVERY ORDINARY SOUL. AN EXTRAORDINARY STORY.</div>
          <p className="hero-description">开局觉醒系统，还是重生改写命运？<br/>40 个日常选择，找到独属于你的那场爽文人生。</p>
          <div className="hero-action-row"><button className="button button-lime hero-button" onClick={onStart}>{count === 40 ? '查看我的主角剧本' : count > 0 ? `继续我的选角 · ${count}/40` : '测测我的主角人设'}<span><ArrowUpRight size={22}/></span></button><button className="hero-secondary" onClick={explore}>先逛逛平行世界 <ArrowRight size={15}/></button></div>
          <div className="hero-facts"><span><Clock3 size={13}/> 约 5 分钟</span><span><ShieldCheck size={13}/> 无需登录</span><span><Star/> 只凭第一直觉</span></div>
          <div className="hero-metrics"><div><strong>40<span>道</span></strong><small>日常选择，藏着伏笔</small></div><div><strong>{roles.length}<span>种</span></strong><small>主角人生，等你解锁</small></div><div><strong>{movieLength===null?'—':String(movieLength).padStart(2,'0')}<span>{movieLength===null?'短片':'秒'}</span></strong><small>你的专属高光时刻</small></div></div>
        </div>
        <WorldPortal role={activeWorld} onSelect={setActiveWorld} onPreview={onPreview} media={manifest[activeWorld.id]}/>
      </div>
      <div className="hero-bottom-line page-width"><button onClick={explore}><span className="scroll-indicator"/>下滑，发现另一种你 <span>SCROLL TO DISCOVER</span></button></div>
    </section>

    <div className="story-ribbon" aria-hidden="true"><div><span>不必拿别人的剧本</span><Star /><span>每一种你 都有高光</span><Star /><span>YOUR STORY STARTS HERE</span><Star /><span>今天 主角是你</span><Star /></div></div>

    <section className="character-section page-width" id="characters" aria-labelledby="character-title">
      <div className="section-heading"><div><span className="eyebrow muted"><span className="section-index">01 /</span> THE MULTIVERSE ARCHIVE</span><h2 id="character-title">你的隐藏身份，<span>是哪一种？</span></h2></div><p>有人一念唤醒诸神，有人重生执掌棋局。<br/>十八个开放世界，还有两份等待解锁的隐藏剧本。</p></div>
      <div className="gallery-toolbar"><div className="filter-tabs" aria-label="按题材筛选">{['全部剧本', '第二季新角', '爽文开挂', '古装大女主', '脑洞异世界'].map(value => <button key={value} aria-pressed={filter === value} className={value === filter ? 'selected' : ''} onClick={() => setFilter(value)}>{value}{value === '全部剧本' && <span>{regularRoles.length}＋{hiddenRoles.length}</span>}</button>)}</div><span className="gallery-hint"><Play size={12} /> 点击，偷看{movieLength===null?'':` ${movieLength} 秒`}主角人生</span></div>
      <div className="role-grid">{shown.map(role => <button className="role-card" key={role.id} style={{ '--role-color': role.color }} onClick={() => onPreview(role)} aria-label={`预览${role.name}`}>
        <RolePoster role={role} media={manifest[role.id]}/>
        {role.collection==='season2' && <span className="season-label">{role.hidden?'隐藏档案 · 已解锁':'第二季 · 新角色'}</span>}
        <div className="role-card-heading"><span>{worldNotes[role.id].power}</span><ArrowUpRight size={16}/></div><p>{role.tagline}</p>
      </button>)}
      {(filter==='全部剧本'||filter==='第二季新角') && locked.map((role,index)=><button className="role-card mystery-role" key={role.id} onClick={onHiddenHint} aria-label={`查看隐藏剧本${index+1}的线索`}><div className="mystery-poster"><LockKeyhole size={34}/><span>UNLISTED SCRIPT</span><strong>未公开的剧本</strong><p>片场招牌里，似乎还藏着一个入口。</p><small>需要彩蛋设置与特殊答案组合</small></div><div className="role-card-heading"><span>隐藏角色 · 尚未解锁</span><ArrowUpRight size={16}/></div></button>)}
      </div>
      <div className="archive-end"><span/><p>你不需要成为任何人。<em>你只需要，成为你。</em></p><span/></div>
    </section>

    <section className="how-section page-width" id="how-it-works" aria-labelledby="how-title">
      <div className="how-intro"><span className="eyebrow muted">A SMALL TEST. A NEW PERSPECTIVE.</span><h2 id="how-title">入戏很简单。<br /><span>做自己就好。</span></h2><p>不用准备，不用找“正确答案”。<br />一切从你的第一反应开始。</p></div>
      <div className="how-steps">{[
        ['01', '40 个日常选择', '从“想不想续摊”到“要不要试试新鲜事”，选更像平时的你的那一个。', <ScanLine />],
        ['02', '找到你的主角底色', '从探索欲、社交节奏、目标感等十个倾向，匹配你的专属剧情人设。', <Sparkles />],
        ['03', '领取你的高光剧本', '看一段角色高光短片，读你的主角档案，再把角色卡留给自己。', <Film />],
      ].map(([number, title, text, icon]) => <div className="how-step" key={number}><span className="step-num">{number}</span><div><h3>{title}</h3><p>{text}</p></div><span className="step-icon">{icon}</span></div>)}</div>
    </section>

    <section className="bottom-cta page-width"><div><span className="eyebrow">THE NEXT SCENE IS YOURS</span><h2>别等彩蛋了。<br />你就是<span>主线剧情。</span></h2><button className="button button-dark" onClick={onStart}>开启我的主角人生 <ArrowUpRight size={23} /></button></div><Star className="cta-star" /><span className="cta-footnote">40 个选择 / 18 个常规角色＋2 个隐藏角色 / 一个独一无二的你</span></section>

    <section className="faq-section page-width" id="faq"><h2>开场之前，你可能想知道</h2><div className="faq-list">
      <details><summary>这是 MBTI 测试吗？<ChevronDown size={17} /></summary><p>这是借鉴人格测试交互方式的剧情娱乐测试，并非 MBTI 量表或心理诊断。40 道日常情境题会映射到 10 个选择倾向，先匹配 18 种常规主角；开启彩蛋设置且命中特殊答案组合时，还能解锁 2 种隐藏主角。角色不分好坏，也没有标准答案。</p></details>
      <details><summary>我的回答会保存在哪里？<ChevronDown size={17} /></summary><p>答题选择和用时会匿名保存，用于研究数据收集；同一浏览器使用同一匿名编号。</p></details>
      <details><summary>结果会受性别影响吗？可以重新测试吗？<ChevronDown size={17} /></summary><p>测试不收集性别。女王、小祖宗等称呼属于虚构剧情设定，任何人都可能匹配到它们。你可以在结果页选择重新测试，也可以回到题目修改答案。每一版的你，都值得一个新剧本。</p></details>
    </div></section>
  </main>;
}

function Quiz({ quiz, setQuiz, onFinish, storageOkay }) {
  const { answers, index } = quiz;
  const question = {...questions[index],...questionCopy[questions[index].id]};
  const selected = answers[question.id];
  const count = answeredCount(answers);
  const actIndex = Math.floor(index / 10);
  const heading = useRef(null);
  const choose = useCallback(value => {
    setQuiz(old => ({ ...old, answers: { ...old.answers, [questions[old.index].id]: value }, submitted: false }));
    return true;
  }, [setQuiz]);
  const next = useCallback(() => {
    if (!isAnswer(selected)) return;
    if (window.NBTICollector?.answer(questions[index].id, selected) === false) return;
    if (index === questions.length - 1) {
      setQuiz(old => ({ ...old, submitted: true }));
      window.NBTICollector?.complete();
      onFinish();
    }
    else setQuiz(old => ({ ...old, index: Math.min(old.index + 1, 39) }));
  }, [selected, index, onFinish, setQuiz]);
  const previous = useCallback(() => setQuiz(old => ({ ...old, index: Math.max(0, old.index - 1) })), [setQuiz]);
  useLayoutEffect(() => { window.NBTICollector?.show(question.id); }, [question.id]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [index]);
  useEffect(() => {
    const onKey = event => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || ['INPUT', 'TEXTAREA'].includes(event.target.tagName) || event.target.closest('[role="slider"]')) return;
      if (['a', 'A', '1'].includes(event.key)) { event.preventDefault(); choose(0); }
      if (['b', 'B', '2'].includes(event.key)) { event.preventDefault(); choose(14); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); previous(); }
      if ((event.key === 'Enter' && event.target.tagName !== 'BUTTON' && event.target.tagName !== 'A') || event.key === 'ArrowRight') { event.preventDefault(); next(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [choose, previous, next]);
  const actRole=roles[[1,6,5,8][actIndex]];
  return <main id="main-content" className="quiz-page page-width" style={{'--world-color':actRole.color}}>
    <div className="quiz-topline"><button className="text-button" onClick={() => go('/')}><ArrowLeft size={16} /> 返回片场</button><span>{storageOkay ? <><ShieldCheck size={13} /> 进度已保存在此浏览器</> : '浏览器暂时无法保存，请在本页完成测试'}</span><span className="quiz-counter">{String(index + 1).padStart(2, '0')} <span>/ 40</span></span></div>
    <div className="quiz-progress" role="progressbar" aria-label="答题进度" aria-valuenow={count} aria-valuemin={0} aria-valuemax={40}><i style={{ width: `${count / 40 * 100}%` }} /></div>
    <div className="quiz-layout"><aside className="quiz-sidebar"><span className="eyebrow muted">THE STORY UNFOLDS</span><h2>故事的走向，<br/>由你落笔。</h2><div className="quiz-world-window"><WorldArt role={actRole}/><span>CHAPTER 0{actIndex+1}<strong>{acts[actIndex].title}</strong></span></div><div className="act-list">{acts.map((act, i) => <div className={`act ${i === actIndex ? 'current' : ''} ${i < actIndex ? 'done' : ''}`} key={act.title} aria-current={i === actIndex ? 'step' : undefined}><span className="act-number">{i < actIndex ? <Check size={16} /> : `0${i + 1}`}</span><div><h3>第{['一', '二', '三', '四'][i]}幕 · {act.title}</h3><p>{act.description}</p></div></div>)}</div></aside>
      <section className="question-section" aria-labelledby="question-title">
        <div className="question-meta"><span>第{['一', '二', '三', '四'][actIndex]}幕 <i /> {acts[actIndex].title}</span><span>SCENE {String(index + 1).padStart(2, '0')}</span></div>
        <div className="question-content" key={question.id}><span className="question-kicker">想象一下这个场景——</span><h1 id="question-title" ref={heading} tabIndex={-1}>{question.prompt}</h1><p className="question-hint">如果是你，更接近哪一种反应？</p>
          <AnswerScale value={selected} options={question.options} onChoose={choose} />
        </div>
        <div className="question-actions"><button className="text-button" disabled={index === 0} onClick={previous}><ArrowLeft size={16} /> 上一题</button><span className="keyboard-tip">按 <kbd>←</kbd> / <kbd>→</kbd> 调整，点击下方按钮确认</span><button className="button button-lime" disabled={!isAnswer(selected)} onClick={next}>{index === 39 ? '揭晓我的主角' : '下一幕'}{index === 39 ? <Sparkles size={18} /> : <ArrowRight size={19} />}</button></div>
        <div className="question-reassurance"><Star />{acts[actIndex].caption}</div>
      </section>
    </div>
  </main>;
}

function Reveal({ onDone, role }) {
  const reduced = useReducedMotion();
  useEffect(() => { const timer = window.setTimeout(onDone, reduced ? 300 : 2400); return () => window.clearTimeout(timer); }, [onDone, reduced]);
  return <main id="main-content" className="reveal-page" aria-live="polite"><Stardust color={role.color}/><AwakeningArt role={role}/><span className="eyebrow">YOUR DESTINY IS CALLING</span><h1>平行世界的你，<br/><em>即将觉醒。</em></h1><p>40 个选择已落定。正在揭开你的主角身份。</p><div className="reveal-loading"><i/></div><span className="reveal-small">故事就绪 · 高光将至</span></main>;
}

async function saveRoleCard(role, media) {
  const portraitUrl=media?.status==='final'?mediaAsset(role,media):worldPath(role);
  await downloadRoleCard(role,portraitUrl);
}

function Result({ result, generic, manifest, onRestart, onStart, onShare, toast, onPreview }) {
  const { role, scores } = result;
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const partner = roleById[role.partner];
  async function save() { setSaving(true); try { await saveRoleCard(role,manifest[role.id]); toast('角色卡已生成，正在下载'); } catch { toast('角色卡生成失败，请重试'); } finally { setSaving(false); } }
  return <main id="main-content" className="result-page page-width" style={{ '--role-color': role.color }}>
    <div className="result-world-backdrop"><WorldArt role={role}/></div>
    <div className="result-topline"><button className="text-button" onClick={() => go('/')}><ArrowLeft size={15} /> 返回片场</button><span>{generic ? '角色图鉴 · 人生预告' : '选角完成 · 你的剧本已就位'}<Check size={14} /></span><span>ARCHIVE / {role.number}</span></div>
    <div className="result-awakened"><span/><Sparkles size={14}/>{generic?'一张来自平行世界的角色邀请':'主角身份已觉醒 · 这是属于你的那束光'}<span/></div>
    <div className="result-layout"><div className="result-media"><div className="result-orbit"/><VideoPlayer key={role.id} role={role} media={manifest[role.id]} /><div className="result-film-caption"><Film size={14} /><span>{manifest[role.id]?.status === 'final' ? `你的 ${durationLabel(manifest[role.id])}高光时刻` : `${durationLabel(manifest[role.id])}动态分镜 · 真人版待接入`}</span><a href={mediaPath(role,'mp4',manifest[role.id]?.revision)} download={`${role.name}.mp4`} aria-label="下载角色短片"><Download size={15} /></a></div></div>
      <div className="result-copy"><div className="eyebrow"><Star /> {generic ? 'MEET THE CHARACTER' : 'THE LEAD IS YOU'}</div><p className="result-intro">{generic ? '这一种平行人生，叫作——' : '平行世界里的你，是——'}</p><div className="result-type"><span>{role.genre}</span><small>NO. {role.number} / {roles.length}</small></div><h1>{role.name}</h1>{role.hidden && <span className="hidden-result-badge"><LockKeyhole size={14}/> 隐藏剧本已解锁</span>}<p className="result-tagline">{role.tagline}</p><div className="talent-tags">{role.talents.map(talent => <span key={talent}><Star />{talent}</span>)}</div><p className="result-description">{role.description}</p><blockquote>{role.quote}</blockquote>
        <div className="result-actions"><button className="button button-lime" onClick={generic ? onStart : save} disabled={saving}>{generic ? '测测我的主角人设' : saving ? '生成中…' : '保存我的角色卡'}{generic ? <ArrowUpRight size={19} /> : <Download size={19} />}</button><button className="button button-outline" onClick={() => onShare(role)}><Share2 size={18} />分享剧本</button></div>{!generic && <button className="text-button restart-button" onClick={onRestart}><RotateCcw size={14} /> 再选一次，我有别的剧本</button>}
      </div>
    </div>
    <div className="result-detail-grid"><section className="story-panel"><span className="eyebrow muted">YOUR HIGHLIGHT SCENE</span><h2>如果镜头给到你。</h2><p>{role.story}</p><ol className="scene-beats">{role.beats.map((beat,i)=><li key={beat}><span>{["开局","反转","高光"][i]}</span><p>{beat}</p></li>)}</ol><DialogueScript role={role}/><div className="director-note"><Star /><div><span>给主角的一句话</span><p>{role.reminder}</p></div></div></section>
      {!generic && scores ? <section className="traits-panel"><div className="trait-heading"><div><span className="eyebrow muted">YOUR CHARACTER DNA</span><h2>你的主角底色</h2></div><ScanLine size={25} /></div><p className="trait-explanation">根据你的选择呈现的倾向，不是能力评分。</p><DestinyRadar scores={scores} color={role.color}/><p className="radar-caption">各维度量表倾向 · 下方为你的明显倾向</p><div className="traits">{(showAll ? scores : [...scores].sort((a,b)=>Math.abs(b.value-50)-Math.abs(a.value-50)).slice(0,5)).map(score => <div className="trait" key={score.id}><div><span>{score.label}</span><span>{score.value < 50 ? score.low : score.high}<b>{score.value < 50 ? 100-score.value : score.value}%</b></span></div><div className="trait-track"><i style={{ width: `${score.value < 50 ? 100-score.value : score.value}%` }} /></div></div>)}</div><button className="text-button all-traits" onClick={() => setShowAll(v=>!v)}>{showAll ? '收起倾向' : '查看全部 10 个倾向'}<ChevronDown size={15} className={showAll ? 'rotated' : ''} /></button></section> : <section className="generic-panel"><RoleIcon role={role} size={56} strokeWidth={1} /><h2>这会是你的主角剧本吗？</h2><p>40 个日常选择，找到属于你的那一种人生。</p><button className="button button-outline" onClick={onStart}>现在开始选角 <ArrowUpRight size={18} /></button></section>}
    </div>
    <div className="partner-panel"><div className="partner-icon" style={{ '--partner-color': partner.color }}><RoleIcon role={partner} size={29} /></div><div><small>编剧为你安排的搭档</small><h3>{partner.name}<span>一起演，这集更精彩。</span></h3></div><button className="text-button" onClick={() => onPreview(partner)}>看看 TA 的剧本 <ArrowUpRight size={17} /></button></div>
    <p className="result-disclaimer">这是一次关于选择与想象的娱乐测试。角色性别属于剧情设定；你的人生，远比任何一种人设丰富。</p>
  </main>;
}

function App() {
  const [route, setRoute] = useState(routeFromHash);
  const [quiz, setQuiz] = useState(() => { try { return readProgress(window.localStorage); } catch { return { answers: {}, index: 0, submitted: false }; } });
  const [hiddenState, setHiddenState] = useState(() => { try { return readHiddenState(window.localStorage); } catch { return {enabled:false,unlocked:[]}; } });
  const secretTaps = useRef({count:0,time:0});
  const [storageOkay, setStorageOkay] = useState(true);
  const [manifest, setManifest] = useState({});
  const [modal, setModal] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimer = useRef(null);
  const count = answeredCount(quiz.answers);
  const complete = isComplete(quiz.answers) && quiz.submitted === true;
  const displayCount = count === questions.length && !complete ? questions.length - 1 : count;
  const currentResult = complete ? getResult(quiz.answers,{hiddenEnabled:hiddenState.enabled}) : null;
  useEffect(()=>{try{saveHiddenState(window.localStorage,hiddenState);}catch{}},[hiddenState]);
  useEffect(()=>{
    if(route==='/result' && currentResult?.role.hidden && hiddenState.enabled){
      setHiddenState(old=>old.unlocked.includes(currentResult.role.id)?old:{...old,unlocked:[...old.unlocked,currentResult.role.id]});
    }
  },[route,currentResult?.role.id,hiddenState.enabled]);
  const closeModal = useCallback(() => setModal(null), []);
  const reduced = useReducedMotion();
  useEffect(() => () => { if (route === '/test') window.NBTICollector?.leave(); }, [route]);
  useEffect(() => { const update = () => { setRoute(routeFromHash()); setModal(null); window.scrollTo({ top: 0, behavior: 'instant' }); }; window.addEventListener('hashchange',update); return () => window.removeEventListener('hashchange', update); }, []);
  useEffect(() => { try { setStorageOkay(saveProgress(window.localStorage,quiz.answers,quiz.index,quiz.submitted)); } catch { setStorageOkay(false); } }, [quiz]);
  useEffect(() => { fetch(`${mediaBaseUrl()}media/manifest.json`,{cache:'no-cache'}).then(response=>response.ok?response.json():{}).then(setManifest).catch(()=>{}); return ()=>clearTimeout(toastTimer.current); }, []);
  useEffect(() => {
    // A restart changes the answers and URL in the same click. The hashchange
    // event can arrive after the new answers, so guard the actual current URL.
    const activeRoute=routeFromHash();
    if ((activeRoute === '/result' || activeRoute === '/reveal') && !complete) go(count ? '/test' : '/');
  }, [route, complete, count]);
  useEffect(() => { document.title = route === '/test' ? `第 ${quiz.index+1} 题 · 主角请就位` : route === '/result' && complete ? `${currentResult.role.name} · 我的主角剧本` : '主角请就位 — 这一世，轮到你当主角。'; }, [route,quiz,complete,hiddenState.enabled]);
  const onStart = () => { if (!complete) window.NBTICollector?.start({ resume: count > 0 }); setModal(null); go(complete ? '/result' : '/test'); };
  const onSection = id => { if(route !== '/') go('/'); setTimeout(()=>document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' }),route==='/'?0:80); };
  const toast = message => { setToastMessage(message); clearTimeout(toastTimer.current); toastTimer.current=setTimeout(()=>setToastMessage(''),3400); };
  const onPreview = role => {if(canViewRole(role,hiddenState))setModal({kind:'role',role});else setModal({kind:'hidden-hint'});};
  const onSecretTap = event => {
    const now=Date.now();secretTaps.current={count:now-secretTaps.current.time<5000?secretTaps.current.count+1:1,time:now};
    if(secretTaps.current.count>=5){event.preventDefault();secretTaps.current.count=0;setModal({kind:'secrets'});}
  };
  const onFinish = useCallback(() => go('/reveal'), []);
  const onDone = useCallback(() => go('/result'), []);
  async function onShare(role) {
    const url=new URL(window.location.href);url.hash=`/role/${role.id}`;
    try { if(!navigator.clipboard?.writeText) throw new Error(); await navigator.clipboard.writeText(url.href); toast(role.hidden?'隐藏链接已复制；好友解锁后可见，也可直接分享角色卡':'角色链接已复制，分享给朋友看看吧'); }
    catch { setModal({ kind: 'share', url: url.href }); }
  }
  const requestedRole = route.startsWith('/role/') && Object.hasOwn(roleById, route.slice(6)) ? roleById[route.slice(6)] : null;
  const lockedRole = requestedRole?.hidden && !canViewRole(requestedRole,hiddenState);
  const resultRole = lockedRole ? null : requestedRole;
  let content;
  if(lockedRole) content=<main id="main-content" className="page-width hidden-gate"><LockKeyhole size={46}/><span className="eyebrow">UNLISTED SCRIPT</span><h1>这份隐藏剧本，还没有解锁</h1><p>它需要彩蛋设置与特殊的答题组合。先回到片场，看看招牌里藏着什么。</p><button className="button button-lime" onClick={()=>go('/')}>回到片场 <ArrowRight size={18}/></button></main>;
  else if(route === '/test') content=<Quiz quiz={quiz} setQuiz={setQuiz} onFinish={onFinish} storageOkay={storageOkay} />;
  else if(route === '/reveal' && complete) content=<Reveal onDone={onDone} role={currentResult.role} />;
  else if((route === '/result' && complete) || resultRole) content=<Result key={resultRole?.id ?? 'mine'} result={resultRole ? {role:resultRole} : currentResult} generic={Boolean(resultRole)} manifest={manifest} onRestart={()=>setModal({kind:'restart'})} onStart={onStart} onShare={onShare} toast={toast} onPreview={onPreview} />;
  else content=<Home count={displayCount} onStart={onStart} onPreview={onPreview} manifest={manifest} hiddenState={hiddenState} onHiddenHint={()=>setModal({kind:'hidden-hint'})} />;
  return <><a className="skip-link" href="#main-content" onClick={event=>{event.preventDefault();const main=document.getElementById('main-content');main?.setAttribute('tabindex','-1');main?.focus();}}>跳转到主要内容</a><Header route={route} count={displayCount} onStart={onStart} onSection={onSection} onSecretTap={onSecretTap} />{content}{route!=='/reveal' && <Footer onSection={onSection} />}
    {modal?.kind==='role' && <Modal title={`${modal.role.name}的角色预告`} onClose={closeModal} className="role-modal"><VideoPlayer role={modal.role} media={manifest[modal.role.id]} /><div className="modal-role-copy" style={{'--role-color':modal.role.color}}><span className="eyebrow">CHARACTER {modal.role.number} / {roles.length}</span><span className="genre-badge">{modal.role.genre}</span><h2>{modal.role.name}</h2><p className="modal-tagline">{modal.role.tagline}</p><div className="modal-story"><span>这一幕，轮到 TA</span><p>{modal.role.story}</p></div><DialogueScript role={modal.role}/><div className="modal-tags">{modal.role.talents.map(t=><span key={t}>{t}</span>)}</div><button className="button button-lime" onClick={onStart}>{complete?'查看我的主角剧本':'解锁我的主角人设'}<ArrowUpRight size={20} /></button><small className="preview-note">{manifest[modal.role.id]?.status==='final'?`${durationLabel(manifest[modal.role.id])}角色高光短片`:'当前为动态分镜预览，真人版成片待接入。'}</small></div></Modal>}
    {modal?.kind==='hidden-hint' && <Modal title="隐藏剧本线索" onClose={closeModal} className="small-modal"><LockKeyhole className="modal-symbol" size={32}/><h2>有些剧本，不在常规名单里。</h2><p>试着连续点击首页左上角的“主角请就位”五次，进入彩蛋导演室。开启彩蛋设置后，再由你的完整答案决定是否揭晓。</p><button className="button button-lime" onClick={()=>{closeModal();go('/');}}>去片场看看 <ArrowRight size={18}/></button></Modal>}
    {modal?.kind==='secrets' && <Modal title="彩蛋导演室" onClose={closeModal} className="small-modal secret-settings"><Clapperboard className="modal-symbol" size={34}/><h2>彩蛋导演室</h2><p>开启后，特殊的答题组合才有机会产生两份隐藏剧本。普通结果仍然照常匹配。</p><label className="secret-toggle"><input type="checkbox" checked={hiddenState.enabled} onChange={event=>setHiddenState(old=>({...old,enabled:event.target.checked}))}/><span>允许解锁隐藏剧本</span></label><p className="secret-count">已解锁 {hiddenState.unlocked.length} / {hiddenRoles.length} 份隐藏档案</p><button className="button button-lime" onClick={()=>{closeModal();onStart();}}>带着这个设置继续 <ArrowRight size={18}/></button><button className="text-button" onClick={()=>{setHiddenState({enabled:false,unlocked:[]});toast('彩蛋记录已清空，隐藏模式已关闭');}}>清空彩蛋记录并关闭</button></Modal>}
    {modal?.kind==='restart' && <Modal title="重新选角" onClose={closeModal} className="small-modal"><RotateCcw className="modal-symbol" size={31} /><h2>再开一个新剧本？</h2><p>重新测试会清空这次的 40 道回答。你可以先保存角色卡，也可以保留答案回去修改。</p><button className="button button-lime" onClick={()=>{window.NBTICollector?.start({resume:false});setQuiz({answers:{},index:0,submitted:false});setModal(null);go('/test');}}>重新开始 <ArrowRight size={18} /></button><button className="button button-outline" onClick={()=>{window.NBTICollector?.start({resume:true});setQuiz(old=>({...old,index:0,submitted:false}));setModal(null);go('/test');}}>保留答案，回去修改</button><button className="text-button" onClick={closeModal}>先留在这个剧本</button></Modal>}
    {modal?.kind==='share' && <Modal title="分享角色链接" onClose={closeModal} className="small-modal"><Share2 className="modal-symbol" size={31} /><h2>把这个剧本，分享出去。</h2><p>复制下方链接发给朋友。链接只展示角色，不会展示你的答题记录。对方需要能够访问这个网站地址。</p><input className="share-input" aria-label="角色分享链接" value={modal.url} readOnly onFocus={event=>event.target.select()} /><button className="button button-lime" onClick={closeModal}>完成 <Check size={18} /></button></Modal>}
    <div className={`toast ${toastMessage?'visible':''}`} role="status" aria-live="polite"><Check size={16} />{toastMessage}</div>
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
