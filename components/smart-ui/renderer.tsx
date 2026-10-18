'use client';

import { JSONUIProvider, Renderer } from '@json-render/react';
import type { Spec } from '@json-render/core';
import { RotateCcwIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { JsonSource } from './json-source';
import { registry } from './registry';
import './smart-ui.css';

/** Preview / JSON frame. Each block owns its state; reset re-mounts the provider. */
export default function SmartUIRenderer({ spec, code }: { spec: Spec; code: string }) {
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <div
      data-smart-ui="true"
      data-smart-ui-ready={ready}
      className="smart-ui not-prose my-6 min-w-0 rounded-xl border bg-background text-foreground"
    >
      <Tabs defaultValue="preview" className="gap-0">
        <div className="smart-ui-toolbar flex items-center justify-between gap-3 border-b px-3 py-1.5">
          <TabsList aria-label="显示方式">
            <TabsTrigger value="preview" className="px-3">预览</TabsTrigger>
            <TabsTrigger value="json" className="px-3">JSON</TabsTrigger>
          </TabsList>
          <button
            type="button"
            disabled={!ready}
            aria-label="重置交互"
            onClick={() => setRevision((value) => value + 1)}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
          >
            <RotateCcwIcon aria-hidden className="size-3.5" />
            <span className="max-xs:sr-only">重置</span>
          </button>
        </div>
        <TabsContent value="preview" keepMounted className="smart-ui-preview p-4 text-[0.9375rem] leading-relaxed [overflow-wrap:anywhere] sm:p-5">
          <fieldset disabled={!ready} aria-label="交互内容" className="smart-ui-canvas m-0 min-w-0 border-0 p-0">
            <JSONUIProvider key={`${code}:${revision}`} registry={registry} initialState={spec.state ?? {}}>
              <Renderer spec={spec} registry={registry} />
            </JSONUIProvider>
          </fieldset>
        </TabsContent>
        <TabsContent value="json" className="p-0">
          <JsonSource code={code} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
