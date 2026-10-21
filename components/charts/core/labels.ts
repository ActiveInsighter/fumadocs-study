/**
 * Direct-label placement for point marks (effort levels, milestones…).
 *
 * Works in pixel space after the scales are known: each label may sit above or
 * below its point, and the side with the lowest collision cost wins. Costs are
 * weighted so overlapping another label is worse than crossing a line, which is
 * worse than crossing a point, which is worse than leaving the preferred side.
 */

export type LabelSide = "above" | "below"

export type LabelPoint = {
  id: string
  x: number
  y: number
  text: string
  group: string
  /** Author override. "hide" keeps the point but drops its label. */
  side?: LabelSide | "hide"
}

export type LabelSegment = { x1: number; y1: number; x2: number; y2: number }

export type LabelBounds = { x: number; y: number; width: number; height: number }

export type PlacedLabel = {
  id: string
  side: LabelSide
  x: number
  /** Baseline y of the text. */
  y: number
  box: Box
}

type Box = { left: number; top: number; right: number; bottom: number }

export type PlaceLabelOptions = {
  segments?: readonly LabelSegment[]
  bounds?: LabelBounds
  radius?: number
  gap?: number
  fontSize?: number
  /** Average glyph advance as a fraction of the font size. */
  charWidth?: number
}

const COST_LABEL = 100
const COST_BOUNDS = 60
const COST_SEGMENT = 8
const COST_POINT = 6
const COST_UNPREFERRED = 1

export function estimateTextWidth(text: string, fontSize: number, charWidth = 0.56): number {
  let units = 0
  for (const char of text) {
    // CJK glyphs are roughly square; Latin glyphs average a bit over half an em.
    units += /[⺀-鿿＀-￯]/.test(char) ? 1 : charWidth
  }
  return units * fontSize
}

export function placePointLabels(
  points: readonly LabelPoint[],
  {
    segments = [],
    bounds,
    radius = 7,
    gap = 5,
    fontSize = 12,
    charWidth = 0.56,
  }: PlaceLabelOptions = {},
): Map<string, PlacedLabel> {
  const placed = new Map<string, PlacedLabel>()
  const placedBoxes: Box[] = []

  const boxFor = (point: LabelPoint, side: LabelSide): Box => {
    const width = estimateTextWidth(point.text, fontSize, charWidth) + 4
    const top = side === "above" ? point.y - radius - gap - fontSize : point.y + radius + gap
    return { left: point.x - width / 2, right: point.x + width / 2, top, bottom: top + fontSize }
  }

  // Place the most constrained points first: those with close neighbours.
  const ordered = [...points]
    .filter((point) => point.side !== "hide")
    .sort((a, b) => crowding(b, points) - crowding(a, points))

  for (const point of ordered) {
    const preferred = preferredSide(point, points)
    const sides: LabelSide[] = point.side && point.side !== "hide" ? [point.side] : ["above", "below"]

    let best: { side: LabelSide; box: Box; cost: number } | undefined
    for (const side of sides) {
      const box = boxFor(point, side)
      let cost = side === preferred ? 0 : COST_UNPREFERRED
      for (const other of placedBoxes) if (intersects(box, other)) cost += COST_LABEL
      if (bounds && !inside(box, bounds)) cost += COST_BOUNDS
      for (const segment of segments) if (segmentHitsBox(segment, box)) cost += COST_SEGMENT
      for (const other of points) {
        if (other.id === point.id) continue
        if (circleHitsBox(other.x, other.y, radius, box)) cost += COST_POINT
      }
      if (!best || cost < best.cost) best = { side, box, cost }
    }

    if (!best) continue
    placedBoxes.push(best.box)
    placed.set(point.id, {
      id: point.id,
      side: best.side,
      x: point.x,
      y: best.box.bottom - fontSize * 0.22,
      box: best.box,
    })
  }

  return placed
}

/** Points sitting above the other groups label upwards, the rest downwards. */
function preferredSide(point: LabelPoint, points: readonly LabelPoint[]): LabelSide {
  let nearest: LabelPoint | undefined
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const other of points) {
    if (other.group === point.group) continue
    const distance = Math.abs(other.x - point.x) + Math.abs(other.y - point.y) * 0.5
    if (distance < nearestDistance) {
      nearest = other
      nearestDistance = distance
    }
  }
  if (!nearest) return "above"
  return nearest.y >= point.y ? "above" : "below"
}

function crowding(point: LabelPoint, points: readonly LabelPoint[]): number {
  let score = 0
  for (const other of points) {
    if (other.id === point.id) continue
    const distance = Math.hypot(other.x - point.x, other.y - point.y)
    if (distance < 60) score += 60 - distance
  }
  return score
}

function intersects(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

function inside(box: Box, bounds: LabelBounds): boolean {
  return (
    box.left >= bounds.x - 2 &&
    box.right <= bounds.x + bounds.width + 2 &&
    box.top >= bounds.y - 2 &&
    box.bottom <= bounds.y + bounds.height + 2
  )
}

function circleHitsBox(cx: number, cy: number, r: number, box: Box): boolean {
  const nearestX = Math.max(box.left, Math.min(cx, box.right))
  const nearestY = Math.max(box.top, Math.min(cy, box.bottom))
  return (cx - nearestX) ** 2 + (cy - nearestY) ** 2 < r * r
}

function segmentHitsBox(segment: LabelSegment, box: Box): boolean {
  const steps = 16
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps
    const x = segment.x1 + (segment.x2 - segment.x1) * t
    const y = segment.y1 + (segment.y2 - segment.y1) * t
    if (x > box.left && x < box.right && y > box.top && y < box.bottom) return true
  }
  return false
}
