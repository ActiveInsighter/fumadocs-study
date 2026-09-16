import {
  ClaudeBenchmarkCharts,
  ClaudeTestimonialCarousel,
} from '@/components/claude-benchmarks';
import type { MDXComponents } from 'mdx/types';

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
  return pageComponentRegistry[normalizePagePath(path)];
}

function normalizePagePath(path: string): string {
  return path.replaceAll('\\', '/');
}
