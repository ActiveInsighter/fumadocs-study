# JSXGraph authoring

`components/jsxgraph` exports three globally registered MDX components:

- `FunctionPlot` renders editable 2D functions, implicit equations, and parametric curves.
- `SurfacePlot` renders real 3D surfaces and space curves through JSXGraph View3D, including two-parameter surfaces such as a torus.
- `JSXGraphBoard` initializes a custom browser board with `onInit(board)`. Put callbacks in a dedicated `'use client'` component; server MDX cannot send callbacks across the React server/client boundary.

Visit `/docs/math/function-plot/` for six interactive examples. Formula fields and drawing buttons let readers change the construction, while visibility switches, numeric parameter inputs, sliders, animation controls, and probes support comparison and measurement. The board toolbar offers view reset, full screen, and SVG export. A 3D SVG records the current camera projection.

JSXGraph 1.14.0 is pinned in npm. It is imported in the browser when a board approaches the viewport; no CDN script or runtime service is needed. Board IDs are unique, resize handling is built in, and unmount cleanup releases boards and custom cleanup callbacks. Components use local styles and native form controls.

## 2D functions and equations

No import is needed inside MDX:

```mdx
<FunctionPlot
  title="编辑函数并绘制"
  boundingBox={[-5, 5, 5, -5]}
  parameters={[{ name: 'a', label: '系数 a', min: -3, max: 3, value: 1, step: 0.1 }]}
  plots={[
    { type: 'function', expression: 'a*x^2', domain: [-4, 4], probe: true },
    { type: 'implicit', expression: 'x^2+y^2=4', dashed: true },
    { type: 'parametric', x: '2*cos(t)', y: 'sin(t)', range: [0, 6.283185307179586] },
  ]}
/>
```

The default editor exposes expression fields and explicit drawing controls. Readers can add and remove 2D curves, toggle their visibility, and change expressions. `editable={false}` hides the formula editor for a fixed lesson. Parameter controls remain available. A function with `probe: true` adds a draggable point, coordinate readout, and a tangent switch.

| Prop | Meaning |
| --- | --- |
| `plots` | Array of `function`, `implicit`, and `parametric` definitions |
| `parameters` | `{ name, min, max, value, label?, step? }[]`; generates numeric inputs, sliders, and animation controls |
| `points` | `{ x, y, name?, fixed?, color? }[]`; points are draggable unless fixed |
| `boundingBox` | `[left, top, right, bottom]`, default `[-5, 5, 5, -5]`; equal coordinate units can expand the visible range to fit the container |
| `height` | Board height in pixels, from `200` to `1200` |
| `axis` / `grid` | Coordinate axes and grid, both default to `true` |
| `editable` | Formula editor, default `true` |
| `title` / `description` | Board heading and instructions |

All 2D plots accept `label`, `color`, and `dashed`. Function plots accept an optional `domain: [min, max]` and `probe: true`. Parametric curves use `x`, `y`, and a finite `range: [min, max]`, with `t` as the independent variable.

An implicit equation such as `x^2+2*y^2=c` is a planar level set. It shows positions with a shared function value; the 3D graph `z=x^2+2*y^2` is a surface and belongs in `SurfacePlot`.

## 3D surfaces and space curves

```mdx
<SurfacePlot
  title="二元函数的曲面"
  height={480}
  box={[[-2, 2], [-2, 2], [-4, 8]]}
  parameters={[{ name: 'a', min: -1, max: 1, value: 1, step: 0.1 }]}
  plots={[{
    type: 'surface',
    expression: 'a*x^2+y^2',
    domain: [[-2, 2], [-2, 2]],
    label: 'z = ax²+y²',
  }]}
/>
```

A `surface` evaluates `z=f(x,y)`. Its `domain` limits the two input coordinates. A `parametric-curve` evaluates three functions of `t`; a `parametric-surface` evaluates three functions of `u` and `v`:

```mdx
<SurfacePlot
  title="螺旋线"
  box={[[-2, 2], [-2, 2], [0, 6]]}
  plots={[{
    type: 'parametric-curve',
    x: 'cos(t)',
    y: 'sin(t)',
    z: '0.4*t',
    range: [0, 12.566370614359172],
  }]}
/>

<SurfacePlot
  title="环面"
  box={[[-3, 3], [-3, 3], [-1, 1]]}
  mesh={16}
  plots={[{
    type: 'parametric-surface',
    x: '(2+0.7*cos(v))*cos(u)',
    y: '(2+0.7*cos(v))*sin(u)',
    z: '0.7*sin(v)',
    ranges: [[0, 6.283185307179586], [0, 6.283185307179586]],
  }]}
/>
```

| Prop | Meaning |
| --- | --- |
| `plots` | Array of `surface`, `parametric-curve`, and `parametric-surface` definitions; each accepts `label` and `color` |
| `box` | `[[xmin,xmax],[ymin,ymax],[zmin,zmax]]`, the displayed coordinate ranges |
| `parameters` | Same parameter definitions and controls as `FunctionPlot` |
| `mesh` | Surface sampling density from `8` to `32`, default `14` |
| `probe` | Show a point inspector with inputs for coordinates or curve/surface parameters and live XYZ values; default `true` |
| `editable` | Formula fields and update buttons, default `true` |
| `height` / `title` / `description` | Board dimensions, heading, and instructions |

Drag empty space with the left mouse button or a single touch to rotate. View buttons provide isometric, top, front, and side projections. “适应图像” fits the current visible geometry using finite samples without changing its coordinate values; reset restores the authored space box. Toggle plots individually to compare constructions. Surface controls switch filled faces and the overlay mesh independently, with a density slider for the overlay. The inspector selects a plot and evaluates a position on it: `x,y` for an explicit surface, `t` for a curve, or `u,v` for a parametric surface.

## Expressions and interaction

Expressions use JSXGraph's JessieCode math syntax: write `a*x^2`, `sin(x)`, `sqrt(x)`, and `PI`. Use explicit multiplication and radians. Do not use LaTeX, JavaScript callbacks, or `Math.sin`. Explicit functions and surfaces take only their right-hand expression. Implicit 2D curves accept `F(x,y)` for `F=0` or `lhs=rhs`; inequalities are unsupported.

Parameter names must be unique identifiers and cannot shadow coordinate variables (`x`, `y`, `z`), curve/surface variables (`t`, `u`, `v`), or common math functions. Formula editing changes the local reader's board; it does not rewrite the MDX source. Set initial formulas and parameters in the document to publish a lasting example.

Changing a parameter updates live geometry. Formula edits are applied through the editor's drawing/update button. “重置参数” restores the authored parameter values, while “重置视图” restores the initial camera or 2D view. Each board has independent state. In 2D, select “平移” for direct dragging or “取点” for probe control and ordinary touch scrolling. Wheel zoom requires Shift. Theme changes recolor existing geometry and preserve the viewport.

Implicit rendering and 3D sampling are numerical. Isolated zeros, singularities, discontinuities, and tiny components can be missed. Narrow the domain, increase the surface mesh within its supported range, or use a more suitable analytic representation. A picture alone does not establish whether an equation has solutions.

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
    // Return cleanup for any custom event listeners or timers if needed.
  }, []);

  return <JSXGraphBoard title="拖动圆心或圆上的点" onInit={setup} />;
}
```

Import the custom component into its MDX page, or register it in `components/mdx.tsx` for reuse. Keep `onInit`, `options`, and `boundingBox` references stable: changing construction props recreates the board. `options` accepts `Partial<BoardAttributes>` and overrides wrapper defaults. Return a cleanup function from `onInit` for custom listeners and timers.

## Validation and remote builds

Run relevant unit tests and type checks locally, without a production build:

```sh
npm test -- tests/jsxgraph.test.ts tests/jsxgraph-surface.test.ts tests/knowledge2-browser-readiness.test.ts
npm run typecheck
```

To inspect the document without exporting the full corpus, start the development server with `npx next dev --port 3107` and open `/docs/math/function-plot/`. The browser checks in `scripts/verify-jsxgraph-browser.js` cover the interactive document; use the project Playwright CLI setup and inspect screenshots in `.playwright-cli`. `scripts/verify-jsxgraph-touch.js` uses a real touch-enabled context for scrolling, panning and parameter entry; `scripts/verify-jsxgraph-3d.js` exercises all three 3D plot types, camera controls and touch rotation.

Production builds run in GitHub Actions. Push the feature branch, then dispatch `deploy-cloudflare-worker-assets.yml` with that branch as the workflow ref. `deploy=false` validates the static package and retains build artifacts. `deploy=true` publishes a **branch preview** when the ref is a feature branch. Only a `main` ref selects the production Worker and updates `https://fumadocscf.any1.tech`.

The workflow's “Select Cloudflare Worker target” step chooses `fumadocs-static-docs` for `main` and `fumadocs-preview-<branch>` for other branches. A successful upload and completed verification are separate steps; check the final workflow result and its deployment URL.

API reference: [JSXGraph documentation](https://jsxgraph.org/docs/) (Functiongraph, ImplicitCurve, Curve, Glider, Tangent, View3D, Surface3D, Curve3D).
