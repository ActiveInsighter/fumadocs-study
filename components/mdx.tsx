import {
  StudyAreaChart,
  StudyBarChart,
  StudyHistogram,
  StudyLineChart,
  StudyPieChart,
  StudyScatterChart,
} from '@/components/charts';
import { MathPlot2D, MathPlot3D } from '@/components/math-plot';
import { Mermaid } from '@/components/mdx/mermaid';
import { MindMap } from '@/components/mdx/mind-map';
import { InlineSvg } from '@/components/mdx/inline-svg';
import {
  AddressBits,
  ArrayTrack,
  BlockGrid,
  FlowGraph,
  MotionStage,
  SequenceDiagram,
  StageBadge,
  StageCase,
  StageNode,
  StageReveal,
  StageSwitch,
  StageText,
} from '@/components/motion-stage';
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
 * vocabulary display toggle, MindMap, inline SVG diagrams, the reusable Study
 * chart family, the MotionStage animated-demo family and the interactive math
 * plots (MathPlot2D / MathPlot3D)
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
    MathPlot2D,
    MathPlot3D,
    Mermaid,
    MindMap,
    InlineSvg,
    MotionStage,
    StageReveal,
    StageSwitch,
    StageCase,
    StageText,
    StageNode,
    StageBadge,
    SequenceDiagram,
    ArrayTrack,
    BlockGrid,
    AddressBits,
    FlowGraph,
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
