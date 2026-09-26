import type { ReactNode } from 'react';

export interface ExamQuestionProps {
  year: number;
  number: number;
  kind: '选择题' | '综合题';
  children: ReactNode;
}

export interface ExamAnswerProps {
  answer?: string;
  children: ReactNode;
}

export function ExamQuestion({ year, number, kind, children }: ExamQuestionProps) {
  const questionId = `exam-${year}-question-${number}`;

  return (
    <section
      aria-labelledby={`${questionId}-title`}
      className="exam-question my-8 overflow-hidden rounded-lg border border-fd-border bg-fd-card"
      id={questionId}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-fd-border px-4 py-3 sm:px-5">
        <h3 className="my-0 text-lg font-semibold leading-7" id={`${questionId}-title`}>
          第 {number} 题
        </h3>
        <span className="rounded-md border border-fd-border px-2 py-1 text-xs text-fd-muted-foreground">
          {kind}
        </span>
      </header>
      <div className="exam-question-content space-y-4 px-4 py-4 sm:px-5 sm:py-5">
        {children}
      </div>
    </section>
  );
}

export function ExamAnswer({ answer, children }: ExamAnswerProps) {
  return (
    <details className="exam-answer overflow-hidden rounded-md border border-fd-border bg-fd-background">
      <summary className="cursor-pointer select-none px-4 py-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2">
        <span>参考答案与解析</span>
        {answer ? (
          <span className="ml-3 inline-flex rounded-md bg-fd-muted px-2 py-0.5 text-sm font-semibold">
            {answer}
          </span>
        ) : null}
      </summary>
      <div className="exam-answer-content border-t border-fd-border px-4 py-4">
        {children}
      </div>
    </details>
  );
}
