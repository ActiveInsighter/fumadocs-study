import {
  StudyAreaChart,
  StudyBarChart,
  StudyHistogram,
  StudyLineChart,
  StudyPieChart,
  StudyScatterChart,
} from '@/components/charts';
import { Mermaid } from '@/components/mdx/mermaid';
import { MindMap } from '@/components/mdx/mind-map';
import { InlineSvg } from '@/components/mdx/inline-svg';
import { WordCardModeToggle, WordCards } from '@/components/vocabulary/word-cards';
import * as AccordionComponents from 'fumadocs-ui/components/accordion';
import * as FilesComponents from 'fumadocs-ui/components/files';
import * as StepsComponents from 'fumadocs-ui/components/steps';
import * as TabsComponents from 'fumadocs-ui/components/tabs';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

/**
 * Global MDX component registry.
 *
 * Cards and Callout are included by Fumadocs' default mapping. The additional
 * official component groups below are registered globally so documentation can
 * use Tabs, Accordions, Steps, Files, TypeTable, Mermaid, WordCards, the shared
 * vocabulary display toggle, MindMap, inline SVG diagrams and the reusable Study
 * chart family
 * without repeating imports in every MDX file.
 *
 * Feature-specific compositions (for example the Claude benchmark experience)
 * stay page-scoped in components/mdx/page-components.tsx.
 */
export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    ...AccordionComponents,
    ...FilesComponents,
    ...StepsComponents,
    ...TabsComponents,
    Mermaid,
    MindMap,
    InlineSvg,
    StudyAreaChart,
    StudyBarChart,
    StudyHistogram,
    StudyLineChart,
    StudyPieChart,
    StudyScatterChart,
    TypeTable,
    WordCardModeToggle,
    WordCards,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
