import { CircleAlertIcon } from 'lucide-react';
import { parseStudySpec } from '@/lib/smart-ui/validate';
import { SmartUIClient } from './lazy';

/** No generated JavaScript: only validated JSON reaches the client renderer. */
export function SmartUI({ code }: { code: string }) {
  try {
    const spec = parseStudySpec(code);
    return <SmartUIClient spec={spec} code={code} />;
  } catch (error) {
    return (
      <aside role="alert" className="not-prose my-6 rounded-xl border border-dashed p-5 text-foreground">
        <p className="m-0 flex items-center gap-2 text-[0.9375rem] font-medium">
          <CircleAlertIcon aria-hidden className="size-4 shrink-0" />
          交互内容暂时无法显示
        </p>
        <p className="mt-1 mb-0 text-sm text-muted-foreground">请修正 json-render 代码块。正文仍可正常阅读。</p>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">查看校验信息</summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-(--docs-code-block-background) p-3 font-mono text-[0.8125rem] whitespace-pre-wrap">
            {error instanceof Error ? error.message : 'JSON 格式无效'}
          </pre>
        </details>
      </aside>
    );
  }
}
