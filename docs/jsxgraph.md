# JSXGraph authoring

`components/jsxgraph` exports two globally registered MDX components:

- `FunctionPlot`: serializable props for authored MDX. See `/docs/math/function-plot/` for working examples and the prop reference.
- `JSXGraphBoard`: a browser-only board initialized by `onInit(board)`. Use callbacks in a dedicated `'use client'` component, since server MDX cannot send a JavaScript callback across the React server/client boundary.

JSXGraph 1.14.0 is pinned in npm. The library is loaded with `import('jsxgraph')` inside a client effect only when the board approaches the viewport. No CDN script or runtime service is needed. Board styles are scoped locally; the package's exports do not expose its distributed CSS. Board IDs are unique, resize handling is built in, and effects free boards and any returned cleanup on unmount or configuration/theme changes. The wrapper uses native accessible view buttons and parameter sliders.

## Custom construction

```tsx
'use client';

import { useCallback } from 'react';
import type { Board } from 'jsxgraph';
import { JSXGraphBoard } from '@/components/jsxgraph';

export function CircleConstruction() {
  const setup = useCallback((board: Board) => {
    const center = board.create('point', [0, 0], { name: 'O' });
    const edge = board.create('point', [2, 0], { name: 'A' });
    board.create('circle', [center, edge], { strokeColor: '#2563eb' });
    // Optionally return a cleanup for your own listeners or timers.
  }, []);

  return <JSXGraphBoard title="拖动圆心或圆上的点" onInit={setup} />;
}
```

Import this custom component into its MDX page, or register it in `components/mdx.tsx` for repeated use. Keep `onInit`, `options`, and `boundingBox` references stable when the parent rerenders; changing construction props recreates the board. `options` accepts `Partial<BoardAttributes>` and overrides wrapper defaults.

## Expressions and interaction

FunctionPlot uses JSXGraph's JessieCode expression compiler with explicit `x`, `y`, `t`, and parameter arguments. Write `a*x^2`, `sin(x)`, `sqrt(x)`, and `PI`; do not use JavaScript or LaTeX. Implicit curves accept either `F(x,y)` for `F=0` or `lhs=rhs`. Parameter names must be unique identifiers and cannot shadow the coordinate variables or common math functions. Expressions are authored in trusted repository documents, not accepted from arbitrary visitors.

Sliders update existing curves through live arguments and `board.update()`. They preserve zoom, pan, and draggable point positions. “重置参数” restores parameter values; “重置视图” restores the initial bounding box, adjusted to equal coordinate units. Theme changes recreate the construction with matching axes. Plain scrolling is reserved for the page; mouse panning and wheel zoom require Shift.

Use `implicit` plots for two-variable level sets `f(x,y)=c`. A surface `z=f(x,y)` is a three-dimensional construction and can be implemented with JSXGraph's View3D API inside a custom client component. Implicit rendering is numerical; isolated zeros, singularities, and tiny components may require a smaller domain or a different representation.

## Validation and remote builds

Local checks: `npm test -- tests/jsxgraph.test.ts` and `npm run typecheck` (no production build). To inspect the actual document without exporting the corpus, use `npx next dev` and open `/docs/math/function-plot/`.

For repeatable browser verification, start development on port 3107, then run:

```sh
playwright-cli -s=jsxgraph open http://localhost:3107/docs/math/function-plot/
playwright-cli -s=jsxgraph run-code --filename=scripts/verify-jsxgraph-browser.js
```

This checks actual SVG curve paths, live function and implicit-equation values,
slider resets, preserved zoom, point dragging, mobile resizing, dark mode, and
board disposal/remount during client navigation. Screenshots are saved in the
local `.playwright-cli` directory.

Push the feature branch and dispatch the existing `deploy-cloudflare-worker-assets.yml` workflow with that branch as the ref. Set `deploy=false` to validate the full static package and retain artifacts; set `deploy=true` only when publishing the branch to the production Cloudflare site is intended. Production builds run in GitHub Actions.

API reference: https://jsxgraph.org/docs/ (Functiongraph, ImplicitCurve, Curve, Glider, Tangent, JXG.Board).
