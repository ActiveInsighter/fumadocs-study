/**
 * Series colours stay in JS because JSXGraph receives them as attributes.
 * Each reads on both the white and the black page surface.
 */
export const SERIES_COLORS = ['#2563eb', '#e11d48', '#059669', '#7c3aed', '#d97706', '#0891b2', '#db2777', '#65a30d'];

export const seriesColor = (index: number, color?: string) => color ?? SERIES_COLORS[index % SERIES_COLORS.length];

/** Board colours: --plot-* on the figure, mapped from --plot-board-* tokens in styles/tokens/components.css. */
export interface BoardTheme {
  ink: string;
  muted: string;
  axis: string;
  grid: string;
  paper: string;
  accent: string;
  axisX: string;
  axisY: string;
  axisZ: string;
}

const FALLBACK: Record<'light' | 'dark', BoardTheme> = {
  light: { ink: '#171717', muted: '#737373', axis: '#525252', grid: '#e5e5e5', paper: '#ffffff', accent: '#2563eb', axisX: '#dc2626', axisY: '#16a34a', axisZ: '#2563eb' },
  dark: { ink: '#fafafa', muted: '#a3a3a3', axis: '#a3a3a3', grid: '#262626', paper: '#000000', accent: '#60a5fa', axisX: '#f87171', axisY: '#4ade80', axisZ: '#60a5fa' },
};

export function readBoardTheme(element: Element | null, dark: boolean): BoardTheme {
  const fallback = FALLBACK[dark ? 'dark' : 'light'];
  if (!element || typeof getComputedStyle !== 'function') return fallback;
  const style = getComputedStyle(element);
  const read = (name: string, value: string) => style.getPropertyValue(`--plot-${name}`).trim() || value;
  return {
    ink: read('ink', fallback.ink), muted: read('muted', fallback.muted), axis: read('axis', fallback.axis),
    grid: read('grid', fallback.grid), paper: read('paper', fallback.paper), accent: read('accent', fallback.accent),
    axisX: read('axis-x', fallback.axisX), axisY: read('axis-y', fallback.axisY), axisZ: read('axis-z', fallback.axisZ),
  };
}

/** Hue for JSXGraph's surface shader, which lightens faces by orientation. */
export function colorHue(color: string, index: number): number {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex) return [220, 345, 160, 265, 35][index % 5];
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const maximum = Math.max(r, g, b), delta = maximum - Math.min(r, g, b);
  if (!delta) return 220;
  const hue = maximum === r ? (g - b) / delta : maximum === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return (hue * 60 + 360) % 360;
}
