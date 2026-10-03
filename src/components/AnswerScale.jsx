import React, { useRef, useState } from 'react';
import { isAnswer } from '../engine.js';
import { SCALE_MIN, SCALE_MAX } from '../data/answer-scale.js';
import './answer-scale.css';

const labels = ['更接近左侧', '偏左', '中立', '偏右', '更接近右侧'];
const middle = (SCALE_MIN + SCALE_MAX) / 2;
const labelFor = value => labels[Math.floor(value / 3)];

export function AnswerScale({ value, options, onChoose }) {
  const track = useRef(null);
  const gesture = useRef(null);
  const [draft, setDraft] = useState(null);
  const answered = isAnswer(value);
  const displayed = draft ?? (answered ? value : middle);
  const cellCount = SCALE_MAX - SCALE_MIN + 1;
  const commit = next => { onChoose(next); setDraft(null); };
  const pointerValue = clientX => {
    const bounds = track.current.getBoundingClientRect();
    return Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.floor((clientX - bounds.left) / bounds.width * cellCount)));
  };
  const cancel = () => { gesture.current = null; setDraft(null); };
  const onKeyDown = event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const change = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -3, PageUp: 3 }[event.key];
    let next;
    if (change !== undefined) next = Math.max(SCALE_MIN, Math.min(SCALE_MAX, displayed + change));
    else if (event.key === 'Home') next = SCALE_MIN;
    else if (event.key === 'End') next = SCALE_MAX;
    else if (event.key === 'Enter' || event.key === ' ') next = displayed;
    else return;
    event.preventDefault();
    event.stopPropagation();
    if (!gesture.current) commit(next);
  };
  return <div className={`answer-scale ${answered ? 'has-answer' : ''}`}>
    <div className="answer-scale-anchors" aria-label="量表两端的反应">
      {options.map((option, index) => <div className="answer-scale-anchor" key={index} id={index === 0 ? 'answer-scale-left' : 'answer-scale-right'}>
        <span>{index === 0 ? '左侧反应' : '右侧反应'}</span><p>{option}</p>
      </div>)}
    </div>
    <div className="answer-scale-instruction" id="answer-scale-help">点击或拖动标记，选择更接近平时的你的位置</div>
    <div ref={track} className={`answer-scale-track ${draft !== null ? 'dragging' : ''}`} role="slider" tabIndex={0}
      aria-label="选择你的倾向" aria-describedby="answer-scale-left answer-scale-right answer-scale-help answer-scale-selection"
      aria-valuemin={SCALE_MIN} aria-valuemax={SCALE_MAX} aria-valuenow={displayed}
      aria-valuetext={answered || draft !== null ? `${labelFor(displayed)}，第 ${displayed + 1} / ${cellCount} 档` : '尚未选择，点击量表或按 Enter 确认中立'}
      data-selected={answered ? 'true' : 'false'}
      onKeyDown={onKeyDown}
      onPointerDown={event => {
        if (event.isPrimary === false || event.button !== 0 || gesture.current) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        const next = pointerValue(event.clientX);
        gesture.current = { pointerId: event.pointerId };
        event.currentTarget.setPointerCapture(event.pointerId);
        setDraft(next);
      }}
      onPointerMove={event => {
        if (gesture.current?.pointerId !== event.pointerId) return;
        const next = pointerValue(event.clientX);
        setDraft(next);
      }}
      onPointerUp={event => {
        if (gesture.current?.pointerId !== event.pointerId) return;
        const next = pointerValue(event.clientX);
        gesture.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        commit(next);
      }}
      onPointerCancel={event => { if (gesture.current?.pointerId === event.pointerId) cancel(); }}
      onLostPointerCapture={() => { if (gesture.current) cancel(); }}>
      {Array.from({ length: cellCount }, (_, index) => <span key={index} className={`answer-scale-cell ${index % 3 === 2 && index !== cellCount - 1 ? 'major-boundary' : ''}`} aria-hidden="true" />)}
      <span className="answer-scale-thumb" style={{ left: `${(displayed - SCALE_MIN + .5) / cellCount * 100}%` }} aria-hidden="true"><i /></span>
    </div>
    <div className="answer-scale-labels" aria-hidden="true">{labels.map((label, index) => <span key={label} className={(answered || draft !== null) && index === Math.floor(displayed / 3) ? 'active' : ''}>{label}</span>)}</div>
    <p className="answer-scale-selection" id="answer-scale-selection" role="status" aria-live="polite">
      {answered ? <><span className="scale-selection-mark">✓</span> 已选择：{labelFor(value)}<small>第 {value + 1} / {cellCount} 档</small></> : '尚未选择 · 中间位置不会自动作答'}
    </p>
  </div>;
}
