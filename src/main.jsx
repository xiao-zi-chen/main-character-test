import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight, ArrowRight, ArrowLeft, ChevronDown, Check, X, Play, Pause,
  Volume2, VolumeX, RotateCcw, Download, Share2, Sparkles,
  Film, ShieldCheck, Crown, Sun, Ghost, BookOpen,
  ScanLine, Gem, MessageCircleHeart, Orbit, Flower2, CookingPot, Wrench, FileCheck2, BriefcaseBusiness, Clapperboard, Cpu, LockKeyhole,
} from 'lucide-react';
import { SESSION_SIZE, questionById, newProgress } from './question-session.js';
import { roles, hiddenRoles, roleById, mediaPath } from './data/roles.js';
import { relationships } from './data/relationships.js';
import { readHiddenState, saveHiddenState, canViewRole } from './hidden-rules.js';
import { answeredCount, getResult, isAnswer, isComplete, readProgress, saveProgress } from './engine.js';
import { AnswerScale } from './components/AnswerScale.jsx';
import { WorldArt, Stardust, DestinyRadar, AwakeningArt, worldPath } from './visuals/Cinematic.jsx';
import { durationLabel, formatPlaybackTime, mediaAsset } from './media.js';
import { questionCopy } from './data/question-copy.js';
import { mediaBaseUrl } from './runtime-config.js';
import { downloadRoleCard } from './visuals/share-card.js';
import './styles.css';
import './cinema.css';
import './season2.css';
import './experience.css';

import './simple.css';
import {SimpleHeader, SimpleHome, SimpleFooter, CharacterGallery} from './components/SimpleExperience.jsx';
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
  if (['/', '/test', '/reveal', '/result', '/characters'].includes(hash)) return hash;
  if (hash.startsWith('/role/') && Object.hasOwn(roleById, hash.slice(6))) return hash;
  return '/';
}
function go(route) { window.location.hash = route; }


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
    {media?.hasAudio && muted && !failed && <button className="native-sound-button" onClick={hearDialogue}><Volume2 size={15}/> 听原声</button>}
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

function Quiz({ quiz, setQuiz, onFinish, storageOkay }) {
  const { answers, index, questionIds } = quiz;
  const sessionQuestions = questionIds.map(id => questionById[id]);
  const question = {...sessionQuestions[index],...questionCopy[questionIds[index]]};
  const selected = answers[question.id];
  const count = answeredCount(answers, questionIds);
  const actIndex = Math.floor(index / 5);
  const heading = useRef(null);
  const choose = useCallback(value => {
    setQuiz(old => ({ ...old, answers: { ...old.answers, [old.questionIds[old.index]]: value }, submitted: false }));
    return true;
  }, [setQuiz]);
  const next = useCallback(() => {
    if (!isAnswer(selected)) return;
    if (window.NBTICollector?.answer(question.id, selected) === false) return;
    if (index === SESSION_SIZE - 1) {
      setQuiz(old => ({ ...old, submitted: true }));
      window.NBTICollector?.complete();
      onFinish();
    }
    else setQuiz(old => ({ ...old, index: Math.min(old.index + 1, SESSION_SIZE - 1) }));
  }, [selected, index, question.id, onFinish, setQuiz]);
  const previous = useCallback(() => setQuiz(old => ({ ...old, index: Math.max(0, old.index - 1) })), [setQuiz]);
  useLayoutEffect(() => { window.NBTICollector?.start({resume:true,questionIds}); }, [questionIds]);
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
    <div className="quiz-topline"><button className="text-button" onClick={() => go('/')}><ArrowLeft size={16} /> 返回片场</button><span>{storageOkay ? <><ShieldCheck size={13} /> 进度已保存在此浏览器</> : '浏览器暂时无法保存，请在本页完成测试'}</span><span className="quiz-counter">{String(index + 1).padStart(2, '0')} <span>/ {SESSION_SIZE}</span></span></div>
    <div className="quiz-progress" role="progressbar" aria-label="答题进度" aria-valuenow={count} aria-valuemin={0} aria-valuemax={SESSION_SIZE}><i style={{ width: `${count / SESSION_SIZE * 100}%` }} /></div>
    <div className="quiz-layout"><aside className="quiz-sidebar"><span className="eyebrow muted">THE STORY UNFOLDS</span><h2>故事的走向，<br/>由你落笔。</h2><div className="quiz-world-window"><WorldArt role={actRole}/><span>CHAPTER 0{actIndex+1}<strong>{acts[actIndex].title}</strong></span></div><div className="act-list">{acts.map((act, i) => <div className={`act ${i === actIndex ? 'current' : ''} ${i < actIndex ? 'done' : ''}`} key={act.title} aria-current={i === actIndex ? 'step' : undefined}><span className="act-number">{i < actIndex ? <Check size={16} /> : `0${i + 1}`}</span><div><h3>第{['一', '二', '三', '四'][i]}幕 · {act.title}</h3><p>{act.description}</p></div></div>)}</div></aside>
      <section className="question-section" aria-labelledby="question-title">
        <div className="question-meta"><span>第{['一', '二', '三', '四'][actIndex]}幕 <i /> {acts[actIndex].title}</span><span>SCENE {String(index + 1).padStart(2, '0')}</span></div>
        <div className="question-content" key={question.id}><span className="question-kicker">主角请就位 · 你的第 {index + 1} 个选择</span><h1 id="question-title" ref={heading} tabIndex={-1}>{question.prompt}</h1>
          <AnswerScale value={selected} options={question.options} onChoose={choose} />
        </div>
        <div className="question-actions"><button className="text-button" disabled={index === 0} onClick={previous}><ArrowLeft size={16} /> 上一题</button><button className="button button-lime" disabled={!isAnswer(selected)} onClick={next}>{index === SESSION_SIZE - 1 ? '揭晓我的主角' : '下一幕'}{index === SESSION_SIZE - 1 ? <Sparkles size={18} /> : <ArrowRight size={19} />}</button></div>
      </section>
    </div>
  </main>;
}

function Reveal({ onDone, role }) {
  const reduced = useReducedMotion();
  useEffect(() => { const timer = window.setTimeout(onDone, reduced ? 300 : 2400); return () => window.clearTimeout(timer); }, [onDone, reduced]);
  return <main id="main-content" className="reveal-page" aria-live="polite"><Stardust color={role.color}/><AwakeningArt role={role}/><span className="eyebrow">YOUR DESTINY IS CALLING</span><h1>平行世界的你，<br/><em>即将觉醒。</em></h1><p>20 个选择已落定。正在揭开你的主角身份。</p><div className="reveal-loading"><i/></div><span className="reveal-small">故事就绪 · 高光将至</span></main>;
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
  const relationship = relationships[role.id];
  async function save() { setSaving(true); try { await saveRoleCard(role,manifest[role.id]); toast('角色卡已生成，正在下载'); } catch { toast('角色卡生成失败，请重试'); } finally { setSaving(false); } }
  return <main id="main-content" className="result-page page-width" style={{ '--role-color': role.color }}>
    <div className="result-topline"><button className="text-button" onClick={() => go('/')}><ArrowLeft size={15} /> 返回片场</button><span>{generic ? '角色图鉴 · 人生预告' : '选角完成 · 你的剧本已就位'}<Check size={14} /></span><span>ARCHIVE / {role.number}</span></div>
    <div className="result-layout"><div className="result-media"><div className="result-orbit"/><VideoPlayer key={role.id} role={role} media={manifest[role.id]} /><div className="result-film-caption"><Film size={14} /><span>{manifest[role.id]?.status === 'final' ? `你的 ${durationLabel(manifest[role.id])}高光时刻` : `${durationLabel(manifest[role.id])}动态分镜 · 真人版待接入`}</span><a href={mediaPath(role,'mp4',manifest[role.id]?.revision)} download={`${role.name}.mp4`} aria-label="下载角色短片"><Download size={15} /></a></div></div>
      <div className="result-copy"><div className="eyebrow"><Star /> {generic ? 'MEET THE CHARACTER' : 'THE LEAD IS YOU'}</div><p className="result-intro">{generic ? '这一种平行人生，叫作——' : '平行世界里的你，是——'}</p><div className="result-type"><span>{role.genre}</span><small>NO. {role.number} / {roles.length}</small></div><h1>{role.name}</h1>{role.hidden && <span className="hidden-result-badge"><LockKeyhole size={14}/> 隐藏剧本已解锁</span>}<p className="result-tagline">{relationship.identity}</p><div className="talent-tags">{role.talents.map(talent => <span key={talent}><Star />{talent}</span>)}</div>
        <div className="result-actions"><button className="button button-lime" onClick={generic ? onStart : save} disabled={saving}>{generic ? '测测我的主角人设' : saving ? '生成中…' : '保存我的角色卡'}{generic ? <ArrowUpRight size={19} /> : <Download size={19} />}</button><button className="button button-outline" onClick={() => onShare(role)}><Share2 size={18} />分享剧本</button></div>{!generic && <button className="text-button restart-button" onClick={onRestart}><RotateCcw size={14} /> 再选一次，我有别的剧本</button>}
      </div>
    </div>
    <section className="relationship-section" aria-labelledby="relationship-title"><span className="eyebrow muted">YOU, IN SOMEONE ELSE'S STORY</span><h2 id="relationship-title">和你相处，会发现</h2><dl className="relationship-details"><div><dt>熟人眼里的你</dt><dd>{relationship.familiar}</dd></div><div><dt>你的偏爱藏在这里</dt><dd>{relationship.affection}</dd></div><div><dt>最容易被误会的瞬间</dt><dd>{relationship.friction}</dd></div></dl></section>
    <section className="relationship-bond" aria-label="你的剧情搭档"><div className="partner-panel"><div className="partner-icon" style={{ '--partner-color': partner.color }}><RoleIcon role={partner} size={29} /></div><div><small>{relationship.bond}</small><h3>{partner.name}</h3></div><button className="text-button" onClick={() => onPreview(partner)}>看看 TA 的剧本 <ArrowUpRight size={17} /></button></div><p className="bond-chemistry">{relationship.chemistry}</p><div className="bond-invitation"><p>{relationship.prompt}</p><button className="button button-outline" onClick={() => onShare(role)}><Share2 size={17}/> 找 TA 来认领</button></div></section>
    <details className="result-more"><summary>展开剧情与性格倾向 <ChevronDown size={18}/></summary>    <div className="result-detail-grid"><section className="story-panel"><span className="eyebrow muted">YOUR HIGHLIGHT SCENE</span><h2>如果镜头给到你。</h2><p>{role.description}</p><p>{role.story}</p><ol className="scene-beats">{role.beats.map((beat,i)=><li key={beat}><span>{["开局","反转","高光"][i]}</span><p>{beat}</p></li>)}</ol><DialogueScript role={role}/><div className="director-note"><Star /><div><span>给主角的一句话</span><p>{role.reminder}</p></div></div></section>
      {!generic && scores ? <section className="traits-panel"><div className="trait-heading"><div><span className="eyebrow muted">YOUR CHARACTER DNA</span><h2>你的主角底色</h2></div><ScanLine size={25} /></div><p className="trait-explanation">根据你的选择呈现的倾向，不是能力评分。</p><DestinyRadar scores={scores} color={role.color}/><p className="radar-caption">各维度量表倾向 · 下方为你的明显倾向</p><div className="traits">{(showAll ? scores : [...scores].sort((a,b)=>Math.abs(b.value-50)-Math.abs(a.value-50)).slice(0,5)).map(score => <div className="trait" key={score.id}><div><span>{score.label}</span><span>{score.value < 50 ? score.low : score.high}<b>{score.value < 50 ? 100-score.value : score.value}%</b></span></div><div className="trait-track"><i style={{ width: `${score.value < 50 ? 100-score.value : score.value}%` }} /></div></div>)}</div><button className="text-button all-traits" onClick={() => setShowAll(v=>!v)}>{showAll ? '收起倾向' : '查看全部 10 个倾向'}<ChevronDown size={15} className={showAll ? 'rotated' : ''} /></button></section> : <section className="generic-panel"><RoleIcon role={role} size={56} strokeWidth={1} /><h2>这会是你的主角剧本吗？</h2><p>20 个日常选择，找到属于你的那一种人生。</p><button className="button button-outline" onClick={onStart}>现在开始选角 <ArrowUpRight size={18} /></button></section>}
    </div>
</details>
    <p className="result-disclaimer">这是一次关于选择与想象的娱乐测试。角色性别属于剧情设定；你的人生，远比任何一种人设丰富。</p>
  </main>;
}

function App() {
  const [route, setRoute] = useState(routeFromHash);
  const [quiz, setQuiz] = useState(() => { try { return readProgress(window.localStorage); } catch { return newProgress(); } });
  const [hiddenState, setHiddenState] = useState(() => { try { return readHiddenState(window.localStorage); } catch { return {enabled:false,unlocked:[]}; } });
  const secretTaps = useRef({count:0,time:0});
  const [storageOkay, setStorageOkay] = useState(true);
  const [manifest, setManifest] = useState({});
  const [modal, setModal] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimer = useRef(null);
  const count = answeredCount(quiz.answers, quiz.questionIds);
  const complete = isComplete(quiz.answers, quiz.questionIds) && quiz.submitted === true;
  const displayCount = count === SESSION_SIZE && !complete ? SESSION_SIZE - 1 : count;
  const currentResult = complete ? getResult(quiz.answers,{hiddenEnabled:hiddenState.enabled,questionIds:quiz.questionIds}) : null;
  useEffect(()=>{try{saveHiddenState(window.localStorage,hiddenState);}catch{}},[hiddenState]);
  useEffect(()=>{
    if(route==='/result' && currentResult?.role.hidden && hiddenState.enabled){
      setHiddenState(old=>old.unlocked.includes(currentResult.role.id)?old:{...old,unlocked:[...old.unlocked,currentResult.role.id]});
    }
  },[route,currentResult?.role.id,hiddenState.enabled]);
  const closeModal = useCallback(() => setModal(null), []);
  const reduced = useReducedMotion();
  useEffect(() => { document.body.dataset.screen=route; return () => { delete document.body.dataset.screen; }; }, [route]);
  useEffect(() => () => { if (route === '/test') window.NBTICollector?.leave(); }, [route]);
  useEffect(() => { const update = () => { setRoute(routeFromHash()); setModal(null); window.scrollTo({ top: 0, behavior: 'instant' }); }; window.addEventListener('hashchange',update); return () => window.removeEventListener('hashchange', update); }, []);
  useEffect(() => { try { setStorageOkay(saveProgress(window.localStorage,quiz.answers,quiz.index,quiz.submitted,quiz.questionIds)); } catch { setStorageOkay(false); } }, [quiz]);
  useEffect(() => { fetch(`${mediaBaseUrl()}media/manifest.json`,{cache:'no-cache'}).then(response=>response.ok?response.json():{}).then(setManifest).catch(()=>{}); return ()=>clearTimeout(toastTimer.current); }, []);
  useEffect(() => {
    // A restart changes the answers and URL in the same click. The hashchange
    // event can arrive after the new answers, so guard the actual current URL.
    const activeRoute=routeFromHash();
    if ((activeRoute === '/result' || activeRoute === '/reveal') && !complete) go(count ? '/test' : '/');
  }, [route, complete, count]);
  useEffect(() => { document.title = route === '/test' ? `第 ${quiz.index+1} 题 · 主角请就位` : route === '/result' && complete ? `${currentResult.role.name} · 我的主角剧本` : '主角请就位 — 这一世，轮到你当主角。'; }, [route,quiz,complete,hiddenState.enabled]);
  const onStart = () => { if (!complete) window.NBTICollector?.start({ resume: count > 0, questionIds: quiz.questionIds }); setModal(null); go(complete ? '/result' : '/test'); };
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
    const relationship=relationships[role.id];
    const text=`我的主角人设是「${role.name}」：${relationship.identity}\n${relationship.prompt}\n${role.hidden?'这是隐藏剧本，解锁后可查看。':'我的剧情搭档是「'+roleById[role.partner].name+'」，你来认领吗？'}\n${url.href}`;
    try { if(!navigator.clipboard?.writeText) throw new Error(); await navigator.clipboard.writeText(text); toast(role.hidden?'邀请已复制；隐藏剧本需好友解锁后查看':'角色和搭档邀请已复制，发给你想到的那个人'); }
    catch { setModal({ kind: 'share', url: url.href, text }); }
  }
  const requestedRole = route.startsWith('/role/') && Object.hasOwn(roleById, route.slice(6)) ? roleById[route.slice(6)] : null;
  const lockedRole = requestedRole?.hidden && !canViewRole(requestedRole,hiddenState);
  const resultRole = lockedRole ? null : requestedRole;
  let content;
  if(lockedRole) content=<main id="main-content" className="page-width hidden-gate"><LockKeyhole size={46}/><span className="eyebrow">UNLISTED SCRIPT</span><h1>这份隐藏剧本，还没有解锁</h1><p>它需要彩蛋设置与特殊的答题组合。先回到片场，看看招牌里藏着什么。</p><button className="button button-lime" onClick={()=>go('/')}>回到片场 <ArrowRight size={18}/></button></main>;
  else if(route === '/test') content=<Quiz quiz={quiz} setQuiz={setQuiz} onFinish={onFinish} storageOkay={storageOkay} />;
  else if(route === '/reveal' && complete) content=<Reveal onDone={onDone} role={currentResult.role} />;
  else if((route === '/result' && complete) || resultRole) content=<Result key={resultRole?.id ?? 'mine'} result={resultRole ? {role:resultRole} : currentResult} generic={Boolean(resultRole)} manifest={manifest} onRestart={()=>setModal({kind:'restart'})} onStart={onStart} onShare={onShare} toast={toast} onPreview={onPreview} />;
  else if(route === '/characters') content=<CharacterGallery manifest={manifest} hiddenState={hiddenState} onPreview={onPreview} onHiddenHint={()=>setModal({kind:'hidden-hint'})}/>;
  else content=<SimpleHome count={displayCount} onStart={onStart} manifest={manifest}/>;
  return <><a className="skip-link" href="#main-content" onClick={event=>{event.preventDefault();const main=document.getElementById('main-content');main?.setAttribute('tabindex','-1');main?.focus();}}>跳转到主要内容</a>{route !== '/test' && <SimpleHeader onSecretTap={onSecretTap} onAbout={()=>setModal({kind:'about'})}/> }{content}{route!=='/reveal' && route!=='/test' && <SimpleFooter/>}
    {modal?.kind==='about' && <Modal title="关于测试" onClose={closeModal} className="small-modal"><h2>你的选择，你的故事。</h2><p>每轮从 40 道日常情境中抽取 20 道，约 2 分钟。按平时的反应回答，就会遇见属于你的人设和搭档。</p><p>这是剧情娱乐测试，没有标准答案，也不是心理诊断。进度保存在当前浏览器，随时可以回来继续。网站会匿名记录选择与答题用时，用于改进测试。</p><button className="button button-lime" onClick={onStart}>开始我的故事 <ArrowRight size={18}/></button></Modal>}
    {modal?.kind==='role' && <Modal title={modal.role.name+'的角色预告'} onClose={closeModal} className="role-modal"><VideoPlayer role={modal.role} media={manifest[modal.role.id]}/><div className="modal-role-copy"><h2>{modal.role.name}</h2><p className="modal-tagline">{relationships[modal.role.id].identity}</p><p className="preview-relationship">{relationships[modal.role.id].familiar}</p><button className="button button-lime" onClick={onStart}>测测我的主角人设 <ArrowRight size={18}/></button><button className="preview-profile" onClick={()=>{closeModal();go('/role/'+modal.role.id);}}>认识这个人和 TA 的搭档 <ArrowRight size={16}/></button></div></Modal>}
    {modal?.kind==='hidden-hint' && <Modal title="隐藏剧本线索" onClose={closeModal} className="small-modal"><LockKeyhole className="modal-symbol" size={32}/><h2>有些剧本，不在常规名单里。</h2><p>试着连续点击首页左上角的“主角请就位”五次，进入彩蛋导演室。开启彩蛋设置后，再由你的完整答案决定是否揭晓。</p><button className="button button-lime" onClick={()=>{closeModal();go('/');}}>去片场看看 <ArrowRight size={18}/></button></Modal>}
    {modal?.kind==='secrets' && <Modal title="彩蛋导演室" onClose={closeModal} className="small-modal secret-settings"><Clapperboard className="modal-symbol" size={34}/><h2>彩蛋导演室</h2><p>开启后，特殊的答题组合才有机会产生两份隐藏剧本。普通结果仍然照常匹配。</p><label className="secret-toggle"><input type="checkbox" checked={hiddenState.enabled} onChange={event=>setHiddenState(old=>({...old,enabled:event.target.checked}))}/><span>允许解锁隐藏剧本</span></label><p className="secret-count">已解锁 {hiddenState.unlocked.length} / {hiddenRoles.length} 份隐藏档案</p><button className="button button-lime" onClick={()=>{closeModal();onStart();}}>带着这个设置继续 <ArrowRight size={18}/></button><button className="text-button" onClick={()=>{setHiddenState({enabled:false,unlocked:[]});toast('彩蛋记录已清空，隐藏模式已关闭');}}>清空彩蛋记录并关闭</button></Modal>}
    {modal?.kind==='restart' && <Modal title="重新选角" onClose={closeModal} className="small-modal"><RotateCcw className="modal-symbol" size={31} /><h2>再开一个新剧本？</h2><p>重新测试会重新抽取 20 道题，并清空本轮回答。你可以先保存角色卡，也可以保留答案回去修改。</p><button className="button button-lime" onClick={()=>{const fresh=newProgress();window.NBTICollector?.start({resume:false,questionIds:fresh.questionIds});setQuiz(fresh);setModal(null);go('/test');}}>重新开始 <ArrowRight size={18} /></button><button className="button button-outline" onClick={()=>{window.NBTICollector?.start({resume:true,questionIds:quiz.questionIds});setQuiz(old=>({...old,index:0,submitted:false}));setModal(null);go('/test');}}>保留答案，回去修改</button><button className="text-button" onClick={closeModal}>先留在这个剧本</button></Modal>}
    {modal?.kind==='share' && <Modal title="分享角色链接" onClose={closeModal} className="small-modal"><Share2 className="modal-symbol" size={31} /><h2>这段关系，让 TA 来认领。</h2><textarea className="share-input share-invitation" aria-label="角色分享邀请" value={modal.text} readOnly onFocus={event=>event.target.select()} /><button className="button button-lime" onClick={closeModal}>完成 <Check size={18} /></button></Modal>}
    <div className={`toast ${toastMessage?'visible':''}`} role="status" aria-live="polite"><Check size={16} />{toastMessage}</div>
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
