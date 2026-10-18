'use client';

import dynamic from 'next/dynamic';
import type { Spec } from '@json-render/core';

const SmartUIRenderer = dynamic(() => import('./renderer'), {
  loading: () => (
    <div role="status" className="not-prose my-6 grid min-h-48 place-items-center rounded-xl border text-sm text-muted-foreground">
      正在加载交互练习…
    </div>
  ),
});

export function SmartUIClient(props: { spec: Spec; code: string }) {
  return <SmartUIRenderer {...props} />;
}
