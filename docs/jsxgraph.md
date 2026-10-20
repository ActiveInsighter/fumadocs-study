# JSXGraph authoring

`components/jsxgraph` exports three globally registered MDX components:

- `FunctionPlot` renders editable 2D graphs: explicit functions, implicit equations, parametric and polar curves.
- `SurfacePlot` renders real 3D scenes through JSXGraph View3D: standard quadric surfaces, implicit surfaces, function surfaces, parametric surfaces and space curves, with a cross-section tool.
- `JSXGraphBoard` is the shared board shell. Use it directly with `onInit(board, { theme })` in a dedicated `'use client'` component for custom constructions; server MDX cannot pass callbacks across the server/client boundary.

Visit `/docs/math/function-plot/` for eight interactive examples. JSXGraph 1.14.0 and KaTeX are imported in the browser only when a board approaches the viewport; no CDN script or runtime service is needed.

## Architecture

```text
components/jsxgraph/
  core/        pure logic shared by 2D and 3D, unit-tested without a browser
    expression.ts   JessieCode compiler, symbol normalization (π θ ² ×), Numeric values, readable errors
    parameters.ts   parameter validation, step snapping, animation loop
    contours.ts     marching squares (implicit slices, cross-sections)
    theme.ts        series palette and board colours read from CSS tokens
    format.ts       number formatting
  ui/          React chrome: board shell, collapsible sections, switches, sliders, KaTeX text, CSS module
  plane/       FunctionPlot: types, validation, plot-kind registry (plots.ts), component
  space/       SurfacePlot: types, validation and runtimes (model.ts), quadric library (quadrics.ts),
               JSXGraph scene builder (scene.ts), component
```

To add a 2D plot type, add a variant to `plane/types.ts` and an entry to `PLOT_KINDS` in `plane/plots.ts` (title, seed, editor fields, validation, construction); the editor, legend and “add plot” menu pick it up automatically. 3D plots are compiled into a `PlotRuntime` (`space/model.ts`): unit-square patches, an optional curve and an optional implicit function. JSXGraph elements keep calling the runtime through a ref, so redrawing a formula or moving a parameter never rebuilds the scene or loses the camera.

Board colours are SVG attributes, so they come from hex `--plot-board-*` tokens in `styles/tokens/components.css` (light and `-dark-` variants). The chrome uses the site's semantic tokens (`--foreground`, `--card`, `--border`, `--radius`).

## 2D functions and curves

```mdx
<FunctionPlot
  title="编辑函数并绘制"
  boundingBox={[-5, 5, 5, -5]}
  parameters={[{ name: 'a', label: '系数 a', min: -3, max: 3, value: 1, step: 0.1 }]}
  plots={[
    { type: 'function', expression: 'a*x^2', probe: true, derivative: true, area: [0, 'a'] },
    { type: 'implicit', expression: 'x^2+y^2=4', dashed: true },
    { type: 'parametric', x: '2*cos(t)', y: 'sin(t)', range: [0, 6.283185307179586] },
    { type: 'polar', expression: '1+cos(t)' },
  ]}
  points={[{ x: 'a', y: 0, name: 'A' }]}
/>
```

| Prop | Meaning |
| --- | --- |
| `plots` | `function`, `implicit`, `parametric` and `polar` definitions; all accept `label`, `color`, `dashed` |
| `parameters` | `{ name, min, max, value, label?, step? }[]` (at most 12); sliders, numeric inputs and play buttons |
| `points` | `{ x, y, name?, fixed?, color? }[]`; numeric coordinates are draggable unless `fixed`, expression coordinates follow the parameters |
| `boundingBox` | `[left, top, right, bottom]`, default `[-5, 5, 5, -5]`; equal units can widen the visible range to the container |
| `height` | Board height in pixels, `200`–`1200` |
| `axis` / `grid` | Coordinate axes and grid, both default `true` |
| `editable` | Formula editor, add/delete/clear/restore, default `true` |

Plot fields:

- `function`: `expression` (right-hand side; a leading `y=` is accepted), optional `domain: [a, b]`, `probe` (draggable point with coordinates, slope and a tangent switch), `derivative` (numerical `f′` curve; readers can toggle it per row) and `area: [a, b]` (shaded signed area with a Simpson-rule readout).
- `implicit`: `F(x,y)` meaning `F=0`, or `lhs=rhs`. Inequalities are rejected.
- `parametric`: `x`, `y` in `t`, and `range`.
- `polar`: `r` as a function of `t` (θ; `θ` and `theta` are accepted), optional `range`, default `[0, 2π]`.

Every range end point and point coordinate is a `Numeric`: a number or a parameter expression such as `'2*a'`. The pointer readout in the corner shows plane coordinates under the mouse.

## 3D surfaces, quadrics and sections

```mdx
<SurfacePlot
  title="单叶双曲面"
  box={[[-4, 4], [-4, 4], [-3, 3]]}
  section={{ axis: 'z', value: 1 }}
  parameters={[{ name: 'c', min: 0.5, max: 2, value: 1, step: 0.1 }]}
  plots={[
    { type: 'quadric', kind: 'hyperboloid-one-sheet', a: 1.5, b: 1, c: 'c' },
    { type: 'implicit-surface', expression: 'x^2+y^2-z^2=-1', color: '#7c3aed' },
  ]}
/>
```

| Plot type | Fields |
| --- | --- |
| `quadric` | `kind`, `a`, `b`, `c` (positive Numeric, default 1), optional `axis` (`x`/`y`/`z`, the symmetry axis), `center: [h, k, l]`, `extent` |
| `implicit-surface` | `expression`: `F(x,y,z)` or `lhs=rhs`, drawn as three families of level curves |
| `surface` | `expression` for `z` in `x`, `y`; optional `domain: [[xmin,xmax],[ymin,ymax]]` |
| `parametric-surface` | `x`, `y`, `z` in `u`, `v`; `ranges` |
| `parametric-curve` | `x`, `y`, `z` in `t`; `range` |

Quadric kinds (canonical forms with symmetry axis `z`):

| `kind` | Equation |
| --- | --- |
| `sphere` | x²+y²+z² = a² |
| `ellipsoid` | x²/a²+y²/b²+z²/c² = 1 |
| `hyperboloid-one-sheet` | x²/a²+y²/b²−z²/c² = 1 |
| `hyperboloid-two-sheets` | −x²/a²−y²/b²+z²/c² = 1 |
| `cone` | x²/a²+y²/b² = z²/c² |
| `elliptic-paraboloid` | x²/a²+y²/b² = z/c |
| `hyperbolic-paraboloid` | x²/a²−y²/b² = z/c |
| `elliptic-cylinder` | x²/a²+y²/b² = 1 |
| `hyperbolic-cylinder` | x²/a²−y²/b² = 1 |
| `parabolic-cylinder` | x²/a² = y/b |

Each quadric card shows the symbolic and the current numeric equation (KaTeX), and readers can switch kind, axis and `a`, `b`, `c` in place. `extent` controls how far open sheets reach (parameter units; for cylinders, the half length).

| Board prop | Meaning |
| --- | --- |
| `box` | `[[xmin,xmax],[ymin,ymax],[zmin,zmax]]`, the displayed coordinate ranges |
| `section` | `true` or `{ axis, value }`: open the cross-section tool on the plane `axis = value` |
| `points` | `{ x, y, z, name?, color? }[]`, Numeric coordinates |
| `opacity` | Initial surface opacity `0.2`–`1`, default `0.9` |
| `mesh` | Facet resolution `8`–`40`, default `14`; the overlay mesh density is adjustable by readers |
| `probe` | Point inspector (`x,y`, `t` or `u,v`), default `true` |
| `projection` | `parallel` (default) or `central` |
| `parameters` / `editable` / `height` / `title` / `description` | As in `FunctionPlot` |

The **cross-section** panel draws the plane `x=k`, `y=k` or `z=k`, highlights its trace on every visible surface and shows the trace flat in an equal-scale inset. For quadrics it prints the trace equation and classifies it (circle, ellipse, hyperbola, parabola, intersecting or parallel lines, a point, or no intersection). “扫描截面” sweeps `k` through the box. Implicit and function surfaces show the substituted equation. Quadric and parametric sheets are cut in their own parameter square, so traces end where the drawn sheet ends.

Toolbar: zoom, reset, isometric/top/front/side views, fit to the visible geometry, auto-rotate, SVG/PNG export and full screen. The display panel toggles faces, mesh and bounding frame and sets mesh density and opacity.

## Expressions and interaction

Expressions use JSXGraph's JessieCode syntax: `a*x^2`, `sin(x)`, `sqrt(x)`, `exp(x)`, `log(x)`, `PI`. Pasted `π`, `θ`, `²`, `³`, `×`, `·`, `−` are normalized. Use explicit multiplication and radians; LaTeX, `Math.sin` and arrow functions are not accepted. Syntax errors and unknown names are reported in plain language and the previous graph is kept.

Parameter names must be unique identifiers and cannot shadow coordinate variables (`x`, `y`, `z`), curve/surface variables (`t`, `u`, `v`, `theta`) or math functions. Formula edits change only the reader's board, not the MDX source.

In 2D, “平移” enables direct dragging; “取点” keeps ordinary touch scrolling. Wheel zoom requires Shift. In 3D, dragging rotates. Theme changes recolor the board without discarding geometry or the camera. On wide containers and in full screen the control panels sit beside the board.

Implicit curves, implicit surfaces and sections are numerical (marching squares). Isolated points, singularities and very thin components can be missed; narrow the box or use an analytic form.

## Custom construction

```tsx
'use client';

import { useCallback } from 'react';
import type { Board } from 'jsxgraph';
import { JSXGraphBoard, type BoardContext } from '@/components/jsxgraph';

export function CircleConstruction() {
  const setup = useCallback((board: Board, { theme }: BoardContext) => {
    const center = board.create('point', [0, 0], { name: 'O' });
    const edge = board.create('point', [2, 0], { name: 'A' });
    // Function-valued colours follow the light/dark theme.
    board.create('circle', [center, edge], { strokeColor: () => theme().accent });
    // Return cleanup for any custom event listeners or timers if needed.
  }, []);

  return <JSXGraphBoard title="拖动圆心或圆上的点" onInit={setup} />;
}
```

Import the custom component into its MDX page, or register it in `components/mdx.tsx` for reuse. Keep `onInit`, `options`, and `boundingBox` references stable: changing construction props recreates the board. `options` accepts `Partial<BoardAttributes>` and overrides wrapper defaults. Return a cleanup function from `onInit` for custom listeners and timers.

## Previewing one page

Do not run a production build locally. For a visual check, bundle only `content/docs/math/function-plot.mdx` with the components (esbuild + `@mdx-js/mdx`, remark-math, rehype-katex) in a scratch directory outside the repository, serve it, and run the browser scripts against it.

## Validation and remote builds

Run relevant unit tests and type checks locally, without a production build:

```sh
npx vitest run tests/jsxgraph.test.ts tests/jsxgraph-surface.test.ts
npx tsc --noEmit
```

Open the one-page preview above or a branch preview at `/docs/math/function-plot/`. The browser checks in `scripts/verify-jsxgraph-browser.js` cover the interactive document; use the project Playwright CLI setup and inspect screenshots in `.playwright-cli`. It covers drawing and error recovery, probe/integral readouts, polar curves, quadric cross-sections and their classification, implicit surfaces and the 3D camera tools. `scripts/verify-jsxgraph-touch.js` uses a real touch-enabled context for scrolling, panning and parameter entry.

Production builds run in GitHub Actions. Push the feature branch, then dispatch `deploy-cloudflare-worker-assets.yml` with that branch as the workflow ref. `deploy=false` validates the static package and retains build artifacts. `deploy=true` publishes a **branch preview** when the ref is a feature branch. Only a `main` ref selects the production Worker and updates `https://fumadocscf.any1.tech`.

The workflow's “Select Cloudflare Worker target” step chooses `fumadocs-static-docs` for `main` and `fumadocs-preview-<branch>` for other branches. A successful upload and completed verification are separate steps; check the final workflow result and its deployment URL.

API reference: [JSXGraph documentation](https://jsxgraph.org/docs/) (Functiongraph, ImplicitCurve, Curve, Glider, Tangent, View3D, ParametricSurface3D, Curve3D).
