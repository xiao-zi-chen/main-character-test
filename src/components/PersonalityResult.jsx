import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Clapperboard, RotateCcw, ScanLine, Share2 } from 'lucide-react';
import mirrorLaugh from '../assets/mirror-laugh.gif';

export function PersonalityReveal({ onDone }) {
  const duration = 4000;
  useEffect(() => {
    const timer = window.setTimeout(onDone, duration);
    return () => window.clearTimeout(timer);
  }, [onDone]);
  return <main id="main-content" className="reveal-page simple-reveal" style={{ '--reveal-duration': `${duration}ms` }} aria-live="polite">
    <Clapperboard size={48}/>
    <h1>你的人格，即将揭晓。</h1>
    <p>20 个选择，拼出独一无二的你。</p>
    <div className="reveal-loading"><i/></div>
  </main>;
}

export function MirrorCard({ reveal, onClose }) {
  const surface = useRef(null);
  const [edition, setEdition] = useState('normal');
  useLayoutEffect(() => {
    surface.current?.focus({ preventScroll: true });
  }, [edition]);
  useLayoutEffect(() => {
    const color = document.querySelector('meta[name="theme-color"]');
    const previous = color?.getAttribute('content');
    color?.setAttribute('content', '#000000');
    return () => {
      if (previous !== null && previous !== undefined) color?.setAttribute('content', previous);
    };
  }, []);
  useEffect(() => {
    if (edition !== 'intro' && edition !== 'outro') return;
    const timer = window.setTimeout(() => setEdition(edition === 'intro' ? 'question' : 'normal'), edition === 'intro' ? 600 : 1200);
    return () => window.clearTimeout(timer);
  }, [edition]);
  const advance = () => {
    if (edition === 'intro' || edition === 'outro') return;
    if (edition === 'question') { setEdition('answer'); return; }
    if (edition === 'answer') { setEdition('outro'); return; }
    onClose();
  };

  return <main id="main-content" className="mirror-screen" onKeyDown={event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (edition !== 'normal') setEdition('normal');
      else onClose();
    }
  }}>
    <button ref={surface} type="button" className="mirror-surface" onClick={advance}
      aria-label={reveal ? '人格卡片，轻点返回解析' : edition === 'normal' ? '返回人格解析' : '继续文艺版'}>
      {!reveal && edition === 'normal' && <span className="mirror-message">
        <span>你是谁照照镜子不就知道了吗？</span>
        <img className="mirror-gif" src={mirrorLaugh} alt="大笑的表情动图" draggable={false}/>
      </span>}
      {(edition === 'question' || edition === 'answer' || edition === 'outro') && <span key={edition}
        className={`mirror-literary-line${edition === 'outro' ? ' mirror-literary-leave' : ''}`} aria-live="polite">
        {edition === 'question' ? '所以你到底希望看到什么呢？' : '回答了这么多问题，想必你的心中应该已经有了答案'}
      </span>}
    </button>
    {!reveal && edition === 'normal' && <button type="button" className="mirror-edition-toggle" onClick={() => setEdition('intro')}>切换文艺版</button>}
  </main>;
}

const contexts = {
  explore: '遇到陌生事物时',
  order: '安排生活节奏时',
  logic: '面对不同意见时',
  imagine: '处理眼前的事情时',
  social: '恢复社交能量时',
  steady: '看待自己的进度时',
  purpose: '做出取舍时',
  freedom: '面对既有规则时',
  boundary: '与人建立关系时',
  focus: '走向一个目标时',
};

function describe(score) {
  if (score.value === 50) return '这一轮里，你的选择落在两种倾向之间，会根据具体情境调整。';
  return `${contexts[score.id]}，这一轮的你更倾向于${score.value < 50 ? score.low : score.high}。`;
}

export function PersonalityResult({ scores, onViewCard, onRestart, onShare }) {
  const strongest = [...scores].sort((a, b) => Math.abs(b.value - 50) - Math.abs(a.value - 50)).slice(0, 3);
  const distinctive = strongest.filter(score => score.value !== 50);

  return <main id="main-content" className="personality-result page-width">
    <a className="text-button personality-back" href="#/"><ArrowLeft size={16}/>返回首页</a>
    <section className="personality-card-entry" aria-labelledby="personality-card-title">
      <ScanLine size={28} strokeWidth={1.2}/>
      <p className="personality-eyebrow">PERSONALITY CARD</p>
      <h1 id="personality-card-title">你的人格卡片已生成</h1>
      <button className="button button-lime" onClick={onViewCard}>再次查看我的人格卡片 <ArrowUpRight size={18}/></button>
      <div className="personality-share-entry"><button className="button button-outline" onClick={onShare}><Share2 size={18}/>分享给朋友</button></div>
      <div className="personality-result-actions"><button className="text-button" onClick={onRestart}><RotateCcw size={16}/>重新测试或修改答案</button></div>
    </section>
    <section className="personality-analysis" aria-labelledby="personality-analysis-title">
      <div className="personality-analysis-heading">
        <span className="personality-eyebrow">ABOUT YOU</span>
        <h2 id="personality-analysis-title">人格解析</h2>
        <p>来自这一次的 20 个选择。</p>
      </div>
      <div className="personality-overview">
        <h3>这一轮，你更接近这样的自己</h3>
        <p>{distinctive.length
          ? `你的回答中，相对明显的倾向是：${distinctive.map(score => score.value < 50 ? score.low : score.high).join('、')}。`
          : '这一次，你的十个维度都处在中间位置。不同的情境里，你可能会选择不同的应对方式。'}</p>
      </div>
      <div className="personality-dimensions">
        {scores.map((score, index) => <article className="personality-dimension" key={score.id}>
          <div className="personality-dimension-heading"><span>{String(index + 1).padStart(2, '0')}</span><h3>{score.label}</h3><strong>{score.value === 50 ? '随情境调整' : score.value < 50 ? score.low : score.high}</strong></div>
          <p>{describe(score)}</p>
          <div className="personality-scale" role="meter" aria-label={score.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score.value}
            aria-valuetext={`${score.low}与${score.high}之间的位置：${score.value} / 100`}>
            <i style={{ left: `${score.value}%` }}/>
          </div>
          <div className="personality-poles"><span>{score.low}</span><span>{score.high}</span></div>
        </article>)}
      </div>
      <p className="personality-note">量表呈现本轮回答的倾向，不是能力评分或心理诊断。你也可以在不同的时刻，给出不同的答案。</p>
    </section>
  </main>;
}
