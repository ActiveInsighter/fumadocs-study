'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const EXPECTED_EXAM_START = new Date('2026-12-19T08:30:00+08:00').getTime();

const encouragements = [
  '不用突然变得很厉害，今天比昨天多会一道题就够了。',
  '把不会的题留下痕迹，它们会慢慢变成你的分数。',
  '稳定不是每天状态都满格，而是状态一般也能继续。',
  '先完成，再漂亮；先把这一页学明白。',
  '真正拉开差距的，常常是那些普通但没有放弃的下午。',
  '错题不是扣分记录，是下一次拿分的地图。',
  '今天记住的一个结论，会在考场上替你省下一分钟。',
  '别和整本书较劲，只处理眼前这一小节。',
  '专注四十分钟，比焦虑四个小时更接近答案。',
  '进度可以慢，方向别乱；重复本身就是复利。',
  '有些知识第一次只是见面，第二次才认识，第三次才会用。',
  '你不需要等状态来，开始之后状态才会来。',
] as const;

const modules = [
  { name: '政治', detail: '框架与时事', href: '/docs/politics' },
  { name: '英语', detail: '词汇与阅读', href: '/docs/english' },
  { name: '数学', detail: '知识与题型', href: '/docs/math' },
  { name: '专业课', detail: '408 知识结构', href: '/docs/408' },
] as const;

const countdownUnits = [
  { key: 'days', label: '天' },
  { key: 'hours', label: '时' },
  { key: 'minutes', label: '分' },
  { key: 'seconds', label: '秒' },
] as const;

type Remaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function getRemaining(now: number): Remaining {
  const totalSeconds = Math.max(0, Math.floor((EXPECTED_EXAM_START - now) / 1000));
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function CountdownUnit({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 border-l border-[var(--line)] px-4 first:border-l-0 first:pl-0 last:pr-0 dark:border-border sm:px-5">
      <dt className="text-xs text-[var(--ink-soft)] dark:text-muted-foreground">{label}</dt>
      <dd className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-[var(--ink)] dark:text-foreground sm:text-4xl">
        {value}
      </dd>
    </div>
  );
}

export function StudyHome() {
  const [remaining, setRemaining] = useState<Remaining | null>(null);
  const [encouragementIndex, setEncouragementIndex] = useState(0);

  useEffect(() => {
    const tick = () => setRemaining(getRemaining(Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const dayIndex = Math.floor(Date.now() / 86_400_000);
    setEncouragementIndex(dayIndex % encouragements.length);
  }, []);

  const countdown = {
    days: remaining ? String(remaining.days) : '—',
    hours: remaining ? pad(remaining.hours) : '—',
    minutes: remaining ? pad(remaining.minutes) : '—',
    seconds: remaining ? pad(remaining.seconds) : '—',
  };

  const nextEncouragement = () => {
    setEncouragementIndex((current) => (current + 1) % encouragements.length);
  };

  return (
    <main className="relative isolate min-h-[calc(100dvh-4rem)] overflow-hidden bg-[var(--paper)] text-[var(--ink)] dark:bg-black dark:text-foreground">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-32 top-16 h-80 w-80 rounded-full border border-[var(--coral-mid)] bg-[var(--coral-soft)] dark:border-[var(--coral-deep)] dark:bg-[var(--coral-ink)]" />
        <div className="absolute right-24 top-32 h-2 w-2 rounded-full bg-[var(--coral-deep)] dark:bg-[var(--coral-light)]" />
        <div className="absolute bottom-0 left-0 h-px w-full bg-[var(--line)] dark:bg-border" />
      </div>

      <section className="relative mx-auto grid w-full max-w-6xl gap-14 px-6 py-14 sm:px-10 sm:py-20 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)] lg:items-center lg:gap-20 lg:px-14 lg:py-24">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ink-soft)] dark:text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-[var(--coral-deep)] dark:bg-[var(--coral-light)]" aria-hidden="true" />
            2027 考研学习
          </p>

          <h1 className="mt-7 max-w-3xl font-serif text-5xl leading-[1.08] tracking-tight text-[var(--ink)] dark:text-foreground sm:text-6xl lg:text-7xl">
            把今天学明白，
            <br className="hidden sm:block" />
            明天就会轻一点。
          </h1>

          <p className="mt-7 max-w-xl text-base leading-8 text-[var(--ink-soft)] dark:text-muted-foreground sm:text-lg">
            把政治、英语、数学与 408 的资料放在同一张桌面上，按自己的节奏，打开下一节。
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link
              href="/docs/politics"
              className="inline-flex items-center gap-3 rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-medium text-[var(--paper)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--coral-deep)] motion-reduce:transition-none dark:bg-foreground dark:text-black"
            >
              开始学习
              <span aria-hidden="true">↗</span>
            </Link>
            <Link
              href="/blog"
              className="text-sm font-medium text-[var(--ink-soft)] underline decoration-[var(--line)] underline-offset-8 transition-colors hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--coral-deep)] motion-reduce:transition-none dark:text-muted-foreground dark:decoration-border dark:hover:text-foreground"
            >
              读一篇学习笔记
            </Link>
          </div>

          <aside className="mt-14 max-w-xl border-l-2 border-[var(--coral-mid)] pl-5 dark:border-[var(--coral-deep)]">
            <p className="text-xs font-medium text-[var(--ink-soft)] dark:text-muted-foreground">今日提醒</p>
            <p className="mt-3 text-lg leading-8 text-[var(--ink)] dark:text-foreground sm:text-xl">
              “{encouragements[encouragementIndex]}”
            </p>
            <button
              type="button"
              onClick={nextEncouragement}
              className="mt-3 border-b border-[var(--line)] py-1 text-sm text-[var(--ink-soft)] transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--coral-deep)] motion-reduce:transition-none dark:border-border dark:text-muted-foreground dark:hover:border-foreground dark:hover:text-foreground"
            >
              换一句
            </button>
          </aside>
        </div>

        <div className="space-y-8">
          <section
            className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] p-6 dark:border-border dark:bg-card sm:p-8"
            aria-labelledby="countdown-heading"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-medium text-[var(--coral-deep)] dark:text-[var(--coral-light)]">时间刻度</p>
                <h2 id="countdown-heading" className="mt-2 text-xl font-medium tracking-tight">
                  距离预计初试还有
                </h2>
              </div>
              <span className="pt-1 text-xs tabular-nums text-[var(--ink-soft)] dark:text-muted-foreground">2026.12.19</span>
            </div>

            <dl className="mt-9 grid grid-cols-4">
              {countdownUnits.map((unit) => (
                <CountdownUnit key={unit.key} value={countdown[unit.key]} label={unit.label} />
              ))}
            </dl>

            <p className="mt-8 border-t border-[var(--line)] pt-4 text-xs leading-5 text-[var(--ink-soft)] dark:border-border dark:text-muted-foreground">
              2027 年考研初试时间尚未正式公布，暂按 2026 年 12 月 19 日 08:30（北京时间）计算。
            </p>
          </section>

          <nav aria-labelledby="modules-heading">
            <div className="flex items-end justify-between gap-4">
              <h2 id="modules-heading" className="text-xl font-medium tracking-tight">
                学习模块
              </h2>
              <span className="text-xs text-[var(--ink-soft)] dark:text-muted-foreground">从一门开始</span>
            </div>
            <ul className="mt-4 grid border-t border-[var(--line)] dark:border-border sm:grid-cols-2 sm:gap-x-8">
              {modules.map((item) => (
                <li key={item.name} className="border-b border-[var(--line)] dark:border-border">
                  <Link
                    href={item.href}
                    className="group flex items-center justify-between gap-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--coral-deep)]"
                  >
                    <span>
                      <span className="block font-medium text-[var(--ink)] dark:text-foreground">{item.name}</span>
                      <span className="mt-1 block text-xs text-[var(--ink-soft)] dark:text-muted-foreground">{item.detail}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-lg text-[var(--coral-deep)] transition-transform group-hover:translate-x-1 motion-reduce:transition-none dark:text-[var(--coral-light)]"
                    >
                      ↗
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>
    </main>
  );
}
