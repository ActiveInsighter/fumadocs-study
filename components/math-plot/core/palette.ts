import type { PlotColor } from './types';

/** Resolved plot colours (6-digit hex) read from the --mp-* custom properties on the figure. */
export interface Palette {
  series: Record<PlotColor, string>;
  ink: string;
  muted: string;
  grid: string;
  gridMinor: string;
  canvas: string;
  ramp: string[];
  dark: boolean;
}

export const SERIES_ORDER: PlotColor[] = ['blue', 'coral', 'green', 'teal', 'amber', 'plum'];
export const REGION_ORDER: PlotColor[] = ['blue', 'amber', 'green', 'plum', 'teal', 'coral'];

const FALLBACK: Palette = {
  series: {
    blue: '#5b67b3',
    green: '#5f7d3f',
    coral: '#c8613f',
    teal: '#3f8a8f',
    amber: '#c08a2c',
    plum: '#9a5a86',
    gray: '#8a867c',
    ink: '#24231f',
  },
  ink: '#24231f',
  muted: '#77736a',
  grid: '#e7e3da',
  gridMinor: '#f2efe9',
  canvas: '#fffefb',
  ramp: ['#3f4e9a', '#4b8a96', '#8fb26d', '#e3b55a', '#d4704d'],
  dark: false,
};

export function readPalette(element: Element | null): Palette {
  if (!element || typeof window === 'undefined') return FALLBACK;
  const style = getComputedStyle(element);
  const read = (name: string, fallback: string) => {
    const value = style.getPropertyValue(name).trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  };
  const series = Object.fromEntries(
    (Object.keys(FALLBACK.series) as PlotColor[]).map((key) => [key, read(`--mp-${key}`, FALLBACK.series[key])]),
  ) as Record<PlotColor, string>;
  return {
    series,
    ink: read('--mp-ink', FALLBACK.ink),
    muted: read('--mp-muted', FALLBACK.muted),
    grid: read('--mp-grid', FALLBACK.grid),
    gridMinor: read('--mp-grid-minor', FALLBACK.gridMinor),
    canvas: read('--mp-canvas', FALLBACK.canvas),
    ramp: [1, 2, 3, 4, 5].map((i) => read(`--mp-ramp-${i}`, FALLBACK.ramp[i - 1])),
    dark: document.documentElement.classList.contains('dark'),
  };
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, alpha: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Sample a multi-stop ramp at t ∈ [0, 1]; returns linear 0–1 RGB. */
export function rampAt(stops: string[], t: number): [number, number, number] {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  const scaled = clamped * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const a = hexToRgb(stops[i]);
  const b = hexToRgb(stops[i + 1]);
  return [
    (a[0] + (b[0] - a[0]) * f) / 255,
    (a[1] + (b[1] - a[1]) * f) / 255,
    (a[2] + (b[2] - a[2]) * f) / 255,
  ];
}
