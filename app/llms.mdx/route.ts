import { buildLLMIndex } from '@/lib/llms-index';

export const revalidate = false;
export const dynamic = 'force-static';

export function GET() {
  return new Response(buildLLMIndex(), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
}
