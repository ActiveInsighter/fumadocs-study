'use client';

import { useState, type ReactNode } from 'react';

type Props = {
  id: string;
  type: 'single' | 'essay';
  tags?: string;
  stem: ReactNode;
  options: { content: ReactNode; correct: boolean }[];
  solution: ReactNode;
  evidence: boolean;
};

export function StudyQuestion({ id, type, tags, stem, options, solution, evidence }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [draft, setDraft] = useState('');
  const answer = options.findIndex((option) => option.correct);
  const actionClass = 'rounded-lg border border-fd-border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-fd-ring disabled:opacity-50';
  return <section id={id} aria-label="原创巩固题" className="my-5 min-w-0 scroll-mt-24 rounded-xl border border-fd-border p-4">
    {tags ? <p className="mt-0 text-xs text-fd-muted-foreground">{tags}</p> : null}
    <div id={`${id}-stem`}>{stem}</div>
    {type === 'single' ? <fieldset disabled={submitted} aria-labelledby={`${id}-stem`} className="my-4 grid gap-2 border-0 p-0">
      {options.map((option, index) => <label key={index} className="flex cursor-pointer items-start gap-3 rounded-lg border border-fd-border p-3 has-checked:bg-fd-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-fd-ring">
        <input type="radio" name={id} value={index} checked={selected === index}
          onChange={() => setSelected(index)} className="mt-1 shrink-0" />
        <span className="shrink-0 font-medium">{String.fromCharCode(65 + index)}.</span>
        <div className="min-w-0 [&>p]:my-0">{option.content}</div>
      </label>)}
    </fieldset> : <label className="my-4 block text-sm">
      我的作答
      <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={4}
        className="mt-2 block w-full rounded-lg border border-fd-border bg-fd-background p-3 text-fd-foreground"
        placeholder="先独立完成，再对照参考解析。" />
    </label>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className={actionClass} disabled={submitted || (type === 'single' && selected === null)}
        onClick={() => setSubmitted(true)}>{type === 'single' ? '提交答案' : '查看参考解析'}</button>
      {submitted ? <button type="button" className={actionClass} onClick={() => {
        setSubmitted(false); setSelected(null); setDraft('');
      }}>重新作答</button> : null}
      {submitted && evidence ? <a className={actionClass} href={`#evidence-${id}`}>原文定位</a> : null}
    </div>
    <div aria-live="polite">
      {submitted ? <div className="mt-4 border-t border-fd-border pt-4">
        <p className="font-medium">{type === 'essay' ? '请对照参考解析自评。'
          : `${selected === answer ? '回答正确' : '回答有误'} · 参考答案：${String.fromCharCode(65 + answer)}`}</p>
        {solution}
      </div> : null}
    </div>
  </section>;
}
