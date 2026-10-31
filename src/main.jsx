import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, ArrowLeft, Check, RotateCcw, Sparkles, ShieldCheck } from 'lucide-react';
import { SESSION_SIZE, questionById, newProgress } from './question-session.js';
import { answeredCount, isAnswer, isComplete, readProgress, saveProgress, scoreAnswers } from './engine.js';
import { AnswerScale } from './components/AnswerScale.jsx';
import { Modal } from './components/Modal.jsx';
import { QuestionArt } from './components/QuestionArt.jsx';
import { ReactionPreview } from './components/ReactionPreview.jsx';
import { ThemeToggle } from './components/ThemeToggle.jsx';
import { SimpleHeader, SimpleHome, SimpleFooter } from './components/SimpleExperience.jsx';
import { MirrorCard, PersonalityResult, PersonalityReveal } from './components/PersonalityResult.jsx';
import { PersonalitySharePage, PersonalityShareDialog } from './components/PersonalityShare.jsx';
import { questionCopy } from './data/question-copy.js';
import { SCALE_MIN, SCALE_MAX } from './data/answer-scale.js';
import { preloadQuestionArt, preloadQuestionReactions } from './question-art.js';
import './styles.css';
import './cinema.css';
import './season2.css';
import './experience.css';
import './simple.css';
import './question-art.css';
import './theme.css';
import './personality.css';

const acts = [
  { title: '第一反应', description: '面对日常的选择' },
  { title: '与人相处', description: '关系中的你' },
  { title: '内心倾向', description: '听听自己的想法' },
  { title: '完成拼图', description: '最后五个选择' },
];

function routeFromHash() {
  const hash = window.location.hash.slice(1) || '/';
  return ['/', '/test', '/reveal', '/mirror', '/result', '/card', '/share'].includes(hash) ? hash : '/';
}
function go(route) { window.location.hash = route; }

function Quiz({ quiz, setQuiz, onFinish, onRestart, storageOkay }) {
  const { answers, index, questionIds } = quiz;
  const sessionQuestions = questionIds.map(id => questionById[id]);
  const question = {...sessionQuestions[index],...questionCopy[questionIds[index]]};
  const selected = answers[question.id];
  const count = answeredCount(answers, questionIds);
  const actIndex = Math.floor(index / 5);
  const heading = useRef(null);
  const [submitError, setSubmitError] = useState('');
  const [collectionRecovery, setCollectionRecovery] = useState(null);
  const [reactionPreview, setReactionPreview] = useState(null);
  const [navigationFeedback, setNavigationFeedback] = useState('');
  const previewSequence = useRef(0);
  const previewOpen = useRef(false);
  const navigationPending = useRef(false);
  const closeReactionPreview = useCallback(() => {
    if (!previewOpen.current) return;
    previewOpen.current = false;
    setReactionPreview(null);
    window.NBTICollector?.show(question.id);
  }, [question.id]);
  const openReactionPreview = useCallback(() => {
    if (!isAnswer(selected) || previewOpen.current || navigationPending.current) return;
    // Looking at the picture is voluntary and does not submit an answer or add thinking time.
    window.NBTICollector?.leave();
    previewOpen.current = true;
    setReactionPreview({ questionId: question.id, value: selected, sequence: ++previewSequence.current });
  }, [question.id, selected]);
  const choose = useCallback(value => {
    if (previewOpen.current || navigationPending.current) return false;
    setNavigationFeedback('');
    setQuiz(old => ({ ...old, answers: { ...old.answers, [old.questionIds[old.index]]: value }, submitted: false }));
    return true;
  }, [setQuiz]);
  const next = useCallback(() => {
    if (collectionRecovery || previewOpen.current || navigationPending.current) return;
    if (!isAnswer(selected)) {
      setNavigationFeedback('先选好你的反应，再点击下一题。');
      return;
    }
    navigationPending.current = true;
    setNavigationFeedback('');
    setSubmitError('');
    const collector = window.NBTICollector;
    if (typeof collector?.answer !== 'function' || typeof collector?.complete !== 'function' || typeof collector?.leave !== 'function') {
      navigationPending.current = false;
      setSubmitError('答题记录服务暂未加载，答案还在，请重新加载页面后继续。');
      setCollectionRecovery('reload');
      return;
    }
    try {
      if (collector.answer(question.id, selected) !== true) throw new Error('Answer was not recorded');
      // Advancing to the next question confirms the current answer once.
      collector.leave();
      if (index === SESSION_SIZE - 1 && collector.complete() !== true) {
        navigationPending.current = false;
        setSubmitError('本轮答题记录未能完整恢复，请重新开始测试，以准确记录选择和用时。');
        setCollectionRecovery('restart');
        return;
      }
    } catch {
      navigationPending.current = false;
      setSubmitError('这一步暂时未能保存，答案还在，请再试一次。');
      return;
    }
    if (index === SESSION_SIZE - 1) {
      setQuiz(old => ({ ...old, submitted: true }));
      onFinish();
    } else setQuiz(old => ({ ...old, index: index + 1 }));
  }, [selected, index, question.id, collectionRecovery, setQuiz, onFinish]);
  const previous = useCallback(() => {
    if (collectionRecovery || previewOpen.current || navigationPending.current) return;
    if (index === 0) {
      setNavigationFeedback('这已经是第一题了。');
      return;
    }
    navigationPending.current = true;
    window.NBTICollector?.leave();
    setNavigationFeedback('');
    setSubmitError('');
    setQuiz(old => ({ ...old, index: Math.max(0, old.index - 1) }));
  }, [index, collectionRecovery, setQuiz]);
  useLayoutEffect(() => {
    setCollectionRecovery(null);
    setSubmitError('');
    const collector = window.NBTICollector;
    if (typeof collector?.start !== 'function' || typeof collector?.snapshot !== 'function') return;
    collector.start({resume:true,questionIds});
    const state = collector.snapshot();
    const run = state.runs.find(item => item.session.id === state.activeSessionId);
    const recorded = new Set(run?.answers.map(answer => answer.questionId));
    // Earlier pages were confirmed by advancing. A later page can still contain a
    // local draft after Back, so it must not be mistaken for a lost event.
    if (questionIds.slice(0, index).some(id => !recorded.has(id))) {
      setSubmitError('本轮答题记录未能完整恢复，请重新开始测试，以准确记录选择和用时。');
      setCollectionRecovery('restart');
    }
  }, [questionIds]);
  useLayoutEffect(() => {
    navigationPending.current = false;
    setNavigationFeedback('');
    window.NBTICollector?.show(question.id);
  }, [question.id]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [index]);
  useEffect(() => { preloadQuestionArt(questionIds[index + 1]); }, [index, questionIds]);
  useEffect(() => { preloadQuestionReactions(question.id); }, [question.id]);
  useEffect(() => {
    const onKey = event => {
      if (previewOpen.current || navigationPending.current || document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]') || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.closest('[role="slider"], [contenteditable="true"]')) return;
      if (['a', 'A', '1'].includes(event.key)) { event.preventDefault(); choose(SCALE_MIN); }
      if (['b', 'B', '2'].includes(event.key)) { event.preventDefault(); choose(SCALE_MAX); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); previous(); }
      if ((event.key === 'Enter' && event.target.tagName !== 'BUTTON' && event.target.tagName !== 'A') || event.key === 'ArrowRight') { event.preventDefault(); next(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [choose, previous, next]);
  const actColor = '#b6c3e0';
  return <main id="main-content" className="quiz-page page-width" inert={Boolean(reactionPreview)} style={{'--world-color':actColor}}>
    <div className="quiz-topline"><button className="text-button" onClick={() => go('/')}><ArrowLeft size={16} /> 返回首页</button><span>{storageOkay ? <><ShieldCheck size={13} /> 进度已保存在此浏览器</> : '浏览器暂时无法保存，请在本页完成测试'}</span><ThemeToggle/><span className="quiz-counter">{String(index + 1).padStart(2, '0')} <span>/ {SESSION_SIZE}</span></span></div>
    <div className="quiz-progress" role="progressbar" aria-label="答题进度" aria-valuenow={count} aria-valuemin={0} aria-valuemax={SESSION_SIZE}><i style={{ width: `${count / SESSION_SIZE * 100}%` }} /></div>
    <div className="quiz-layout"><aside className="quiz-sidebar"><div className="act-list">{acts.map((act, i) => <div className={`act ${i === actIndex ? 'current' : ''} ${i < actIndex ? 'done' : ''}`} key={act.title} aria-current={i === actIndex ? 'step' : undefined}><span className="act-number">{i < actIndex ? <Check size={16} /> : `0${i + 1}`}</span><div><h3>第{['一', '二', '三', '四'][i]}幕 · {act.title}</h3><p>{act.description}</p></div></div>)}</div></aside>
      <section className="question-section" aria-labelledby="question-title">
        <div className="question-meta"><span>第{['一', '二', '三', '四'][actIndex]}幕 <i /> {acts[actIndex].title}</span><span>SCENE {String(index + 1).padStart(2, '0')}</span></div>
        <div className="question-content" key={question.id}><span className="question-kicker">人格测试 · 你的第 {index + 1} 个选择</span>
          <div className="question-scene"><QuestionArt id={question.id} kind="scene" alt="本题情境" priority zoomable/><h1 id="question-title" ref={heading} tabIndex={-1}>{question.prompt}</h1></div>
          <AnswerScale value={selected} options={question.options} onChoose={choose} questionId={question.id}/>
          <div className="question-preview-slot">{isAnswer(selected) && <button type="button" className="question-preview-trigger button button-outline" onClick={openReactionPreview}><Sparkles size={17}/>查看我的反应</button>}</div>
          {reactionPreview?.questionId === question.id && <ReactionPreview key={reactionPreview.sequence} questionId={question.id} value={reactionPreview.value} onClose={closeReactionPreview}/>}
        </div>
        {submitError && <div className="quiz-submit-error" role="alert"><p>{submitError}</p>{collectionRecovery && <button className="text-button" onClick={collectionRecovery === 'reload' ? () => window.location.reload() : onRestart}>{collectionRecovery === 'reload' ? '重新加载页面' : '重新开始测试'}<RotateCcw size={14}/></button>}</div>}
        <nav className="question-actions" aria-label="题目导航">
          <button type="button" className="button button-outline" disabled={index === 0 || Boolean(collectionRecovery) || Boolean(reactionPreview)} onClick={previous}><ArrowLeft size={19}/>上一题</button>
          <button type="button" className="button button-lime" disabled={!isAnswer(selected) || Boolean(collectionRecovery) || Boolean(reactionPreview)} onClick={next}>{index === SESSION_SIZE - 1 ? '揭晓我的人格' : '下一题'}{index === SESSION_SIZE - 1 ? <Sparkles size={18}/> : <ArrowRight size={19}/>}</button>
        </nav>
        {navigationFeedback && <p className="quiz-navigation-feedback" role="status">{navigationFeedback}</p>}
      </section>
    </div>
  </main>;
}

function App() {
  const [route, setRoute] = useState(routeFromHash);
  const [quiz, setQuiz] = useState(() => {
    try { return readProgress(window.localStorage); } catch { return newProgress(); }
  });
  const [storageOkay, setStorageOkay] = useState(true);
  const [modal, setModal] = useState(null);
  const count = answeredCount(quiz.answers, quiz.questionIds);
  const complete = isComplete(quiz.answers, quiz.questionIds) && quiz.submitted === true;
  const scores = complete ? scoreAnswers(quiz.answers, quiz.questionIds) : null;
  const cardOpen = complete && (route === '/mirror' || route === '/card');
  const displayCount = count === SESSION_SIZE && !complete ? SESSION_SIZE - 1 : count;
  const closeModal = useCallback(() => setModal(null), []);
  const onFinish = useCallback(() => go('/reveal'), []);
  const onRevealed = useCallback(() => go('/mirror'), []);
  const onDone = useCallback(() => go('/result'), []);

  useLayoutEffect(() => {
    document.body.dataset.screen = route;
    return () => { delete document.body.dataset.screen; };
  }, [route]);
  useEffect(() => {
    const update = () => {
      const nextRoute = routeFromHash();
      setRoute(nextRoute);
      setModal(current => nextRoute === '/share' && current === 'share' ? current : null);
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => {
    if (route === '/test' || cardOpen) return;
    const main = document.getElementById('main-content');
    main?.setAttribute('tabindex', '-1');
    main?.focus({ preventScroll: true });
  }, [route, cardOpen]);
  useEffect(() => () => {
    if (route === '/test') window.NBTICollector?.leave();
  }, [route]);
  useEffect(() => {
    try { setStorageOkay(saveProgress(window.localStorage, quiz.answers, quiz.index, quiz.submitted, quiz.questionIds)); }
    catch { setStorageOkay(false); }
  }, [quiz]);
  useEffect(() => {
    const activeRoute = routeFromHash();
    if (['/result', '/reveal', '/mirror', '/card'].includes(activeRoute) && !complete) go(count ? '/test' : '/');
  }, [route, complete, count]);
  useEffect(() => {
    document.title = route === '/test' ? `第 ${quiz.index + 1} 题 · 人格测试`
      : route === '/result' && complete ? '我的人格解析'
      : route === '/share' ? '看见你自己 · 来做人格测试'
      : cardOpen ? '我的人格卡片' : '看见你自己 · 人格测试';
  }, [route, quiz.index, complete, cardOpen]);

  const onStart = () => {
    if (!complete) window.NBTICollector?.start({ resume: count > 0, questionIds: quiz.questionIds });
    setModal(null);
    go(complete ? '/result' : '/test');
  };
  const restartQuiz = () => {
    const fresh = newProgress();
    window.NBTICollector?.start({ resume: false, questionIds: fresh.questionIds });
    setQuiz(fresh);
    setModal(null);
    go('/test');
  };
  const editQuiz = () => {
    window.NBTICollector?.start({ resume: true, questionIds: quiz.questionIds });
    setQuiz(old => ({ ...old, index: 0, submitted: false }));
    setModal(null);
    go('/test');
  };
  const openShare = () => {
    // WeChat/QQ forward the current URL, so put even their menu shares on the public landing page.
    if (window.location.search) window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
    go('/share');
    setModal('share');
  };

  let content;
  if (route === '/test') {
    content = <Quiz key={quiz.questionIds.join(',')} quiz={quiz} setQuiz={setQuiz} onFinish={onFinish} onRestart={restartQuiz} storageOkay={storageOkay}/>;
  } else if (route === '/reveal' && complete) {
    content = <PersonalityReveal onDone={onRevealed}/>;
  } else if (cardOpen) {
    content = <MirrorCard key={route} reveal={route === '/mirror'} onClose={onDone}/>;
  } else if (route === '/result' && complete) {
    content = <PersonalityResult scores={scores} onViewCard={() => go('/card')} onRestart={() => setModal('restart')} onShare={openShare}/>;
  } else if (route === '/share') {
    content = <PersonalitySharePage complete={complete} onStart={onStart} onShare={openShare}/>;
  } else {
    content = <SimpleHome count={displayCount} onStart={onStart}/>;
  }

  return <>
    {!cardOpen && <a className="skip-link" href="#main-content" onClick={event => {
      event.preventDefault();
      const main = document.getElementById('main-content');
      main?.setAttribute('tabindex', '-1');
      main?.focus();
    }}>跳转到主要内容</a>}
    {!cardOpen && route !== '/test' && <SimpleHeader onAbout={() => setModal('about')}/>}
    {content}
    {!cardOpen && route !== '/test' && route !== '/reveal' && <SimpleFooter/>}
    {modal === 'share' && <PersonalityShareDialog onClose={closeModal}/>}
    {modal === 'about' && <Modal title="关于测试" onClose={closeModal} className="small-modal">
      <h2>从日常选择，看看你自己。</h2>
      <p>每轮从 40 道情境题中抽取 20 道，根据你的回答呈现十个维度的倾向。</p>
      <p>这是娱乐测试，没有标准答案，也不是心理诊断。进度保存在当前浏览器，网站会匿名记录选择与答题用时。</p>
      <button className="button button-lime" onClick={onStart}>开始测试 <ArrowRight size={18}/></button>
    </Modal>}
    {modal === 'restart' && <Modal title="重新测试" onClose={closeModal} className="small-modal">
      <RotateCcw size={31}/>
      <h2>再看看另一个时刻的你？</h2>
      <p>重新测试会抽取新一轮 20 道题。也可以保留这轮答案，从第一题开始修改。</p>
      <button className="button button-lime" onClick={restartQuiz}>重新开始 <ArrowRight size={18}/></button>
      <button className="button button-outline" onClick={editQuiz}>保留答案，回去修改</button>
      <button className="text-button" onClick={closeModal}>先留在这里</button>
    </Modal>}
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
