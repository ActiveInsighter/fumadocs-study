import {
  ClaudeBenchmarkCharts,
  ClaudeTestimonialCarousel,
} from '@/components/claude-benchmarks';
import type { MDXComponents } from 'mdx/types';
import {
  EnglishReading, Evidence, ExamArticle, Option, Paragraph, Question, Solution, Translation,
} from '@/components/english-study';

const englishStudyComponents: MDXComponents = {
  EnglishReading, Evidence, ExamArticle, Option, Paragraph, Question, Solution, Translation,
};

/**
 * Components that are intentionally available to one documentation page.
 * Keep feature-specific dependencies here instead of growing the global MDX
 * registry or making the catch-all docs route know about every feature.
 */
const pageComponentRegistry: Record<string, MDXComponents> = {
  'english/claude-benchmarks.mdx': {
    ClaudeBenchmarkCharts,
    ClaudeTestimonialCarousel,
  },
};

export function getPageMDXComponents(path: string): MDXComponents | undefined {
  const normalized = normalizePagePath(path);
  if (normalized.startsWith('english/kaoyan-zhenxiang-1026/')) return englishStudyComponents;
  return pageComponentRegistry[normalized];
}

function normalizePagePath(path: string): string {
  return path.replaceAll('\\', '/');
}
