/**
 * Chart export: SVG, PNG and CSV.
 *
 * The exported SVG is self-contained: computed styles (including colours that
 * come from CSS variables, color-mix() or oklch()) are inlined as plain rgb
 * attributes, and the figure title, legend and footnote are redrawn as SVG
 * text around the plot. No dependency on html-to-canvas: only the plot is
 * vector data, the rest is laid out here with simple text metrics.
 *
 * Limitation: web fonts are not embedded, so exported text falls back to the
 * viewer's system sans-serif.
 */

import type { ChartDatum } from "./types"

export type ExportLegendItem = { label: string; color: string }

export type ExportMeta = {
  title: string
  subtitle?: string
  footnote?: string
  legend?: readonly ExportLegendItem[]
}

const INLINE_PROPERTIES = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "paint-order",
] as const

const COLOR_PROPERTIES = new Set(["fill", "stroke"])

export function exportFileName(title: string, extension: string): string {
  const slug = title
    .normalize("NFKC")
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
  return `${slug || "chart"}.${extension}`
}

/** Greedy wrap by estimated width; CJK text may break between any two glyphs. */
export function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const advance = (char: string) => (/[⺀-鿿＀-￯]/.test(char) ? fontSize : fontSize * 0.55)
  const tokens = text.match(/[⺀-鿿＀-￯]|[^\s⺀-鿿＀-￯]+|\s+/g) ?? []
  const lines: string[] = []
  let line = ""
  let width = 0

  for (const token of tokens) {
    const tokenWidth = [...token].reduce((sum, char) => sum + advance(char), 0)
    if (/^\s+$/.test(token)) {
      if (line) {
        line += " "
        width += fontSize * 0.3
      }
      continue
    }
    if (width + tokenWidth > maxWidth && line.trim()) {
      lines.push(line.trimEnd())
      line = ""
      width = 0
    }
    line += token
    width += tokenWidth
  }
  if (line.trim()) lines.push(line.trimEnd())
  return lines
}

export function toCsv(rows: readonly ChartDatum[], columns: readonly { key: string; label: string }[]): string {
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  const header = columns.map((column) => escape(column.label)).join(",")
  const body = rows.map((row) => columns.map((column) => escape(row[column.key])).join(","))
  return [header, ...body].join("\n")
}

const colorCache = new Map<string, string>()

/** Normalises any CSS colour (oklch, color-mix, var-resolved) to rgb()/rgba(). */
function toRgb(color: string): string {
  if (!color || color === "none" || color.startsWith("url(")) return color
  const cached = colorCache.get(color)
  if (cached) return cached

  let result = color
  try {
    const canvas = document.createElement("canvas")
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (context) {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = "#000"
      context.fillStyle = color
      context.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
      result = a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${(a ?? 0) / 255})`
    }
  } catch {
    // Keep the original value; modern SVG renderers understand it.
  }
  colorCache.set(color, result)
  return result
}

/** Resolves `var(--token)` and friends against `context` to a concrete colour. */
export function resolveCssColor(context: Element, value: string): string {
  if (!/var\(|color-mix\(/.test(value)) return toRgb(value)
  const probe = document.createElement("span")
  probe.style.color = value
  probe.style.display = "none"
  context.append(probe)
  const resolved = getComputedStyle(probe).color
  probe.remove()
  return toRgb(resolved)
}

function inlineStyles(source: Element, target: Element) {
  const sourceNodes = [source, ...source.querySelectorAll("*")]
  const targetNodes = [target, ...target.querySelectorAll("*")]

  sourceNodes.forEach((node, index) => {
    const clone = targetNodes[index]
    if (!clone) return
    const style = getComputedStyle(node)
    if (style.display === "none" || style.visibility === "hidden" || node.closest("[data-chart-export='ignore']")) {
      clone.setAttribute("data-export-remove", "")
      return
    }
    for (const property of INLINE_PROPERTIES) {
      const value = style.getPropertyValue(property)
      if (!value) continue
      clone.setAttribute(property, COLOR_PROPERTIES.has(property) ? toRgb(value) : value)
    }
    clone.removeAttribute("class")
    clone.removeAttribute("style")
    clone.removeAttribute("tabindex")
  })

  target.querySelectorAll("[data-export-remove]").forEach((node) => node.remove())
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char] ?? char)
}

/** Builds a standalone SVG document for the figure that contains `plot`. */
export function buildExportSvg(plot: SVGSVGElement, figure: HTMLElement, meta: ExportMeta): { svg: string; width: number; height: number } {
  const rect = plot.getBoundingClientRect()
  const plotWidth = Math.round(rect.width)
  const plotHeight = Math.round(rect.height)
  const figureStyle = getComputedStyle(figure)
  const background = toRgb(figureStyle.getPropertyValue("--chart-panel").trim() || figureStyle.backgroundColor || "#ffffff")
  const ink = toRgb(figureStyle.getPropertyValue("--chart-ink").trim() || "#141413")
  const muted = toRgb(figureStyle.getPropertyValue("--chart-muted").trim() || "#5e5d59")
  const font = "Inter, 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif"

  const pad = 28
  const width = plotWidth + pad * 2
  const contentWidth = plotWidth
  const parts: string[] = []
  let y = pad

  const titleLines = wrapText(meta.title, contentWidth, 18)
  for (const line of titleLines) {
    y += 22
    parts.push(`<text x="${pad}" y="${y}" font-size="18" font-weight="600" fill="${ink}">${escapeXml(line)}</text>`)
  }
  if (meta.subtitle) {
    for (const line of wrapText(meta.subtitle, contentWidth, 13)) {
      y += 19
      parts.push(`<text x="${pad}" y="${y}" font-size="13" fill="${muted}">${escapeXml(line)}</text>`)
    }
  }

  const legend = meta.legend ?? []
  if (legend.length > 0) {
    y += 14
    let x = pad
    let rowY = y + 12
    for (const item of legend) {
      const itemWidth = 18 + item.label.length * 7.4 + 18
      if (x + itemWidth > pad + contentWidth && x > pad) {
        x = pad
        rowY += 22
      }
      parts.push(`<circle cx="${x + 6}" cy="${rowY - 4}" r="5.5" fill="${toRgb(item.color)}" stroke="${ink}" stroke-width="1"/>`)
      parts.push(`<text x="${x + 17}" y="${rowY}" font-size="13" fill="${ink}">${escapeXml(item.label)}</text>`)
      x += itemWidth
    }
    y = rowY + 6
  }

  y += 14
  const clone = plot.cloneNode(true) as SVGSVGElement
  inlineStyles(plot, clone)
  clone.setAttribute("x", String(pad))
  clone.setAttribute("y", String(y))
  clone.setAttribute("width", String(plotWidth))
  clone.setAttribute("height", String(plotHeight))
  if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${plotWidth} ${plotHeight}`)
  parts.push(new XMLSerializer().serializeToString(clone))
  y += plotHeight

  if (meta.footnote) {
    y += 8
    for (const line of wrapText(meta.footnote, contentWidth, 12)) {
      y += 17
      parts.push(`<text x="${pad}" y="${y}" font-size="12" fill="${muted}">${escapeXml(line)}</text>`)
    }
  }

  const height = Math.ceil(y + pad)
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${font}">`,
    `<rect width="100%" height="100%" fill="${background}"/>`,
    ...parts,
    "</svg>",
  ].join("")

  return { svg, width, height }
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadSvg(svg: string, fileName: string) {
  triggerDownload(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), fileName)
}

export function downloadCsv(csv: string, fileName: string) {
  // BOM so spreadsheet apps detect UTF-8 for Chinese labels.
  triggerDownload(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }), fileName)
}

export async function downloadPng(svg: string, width: number, height: number, fileName: string, scale = 2) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }))
  try {
    const image = new Image()
    image.decoding = "async"
    image.src = url
    await image.decode()
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas 2D context unavailable")
    context.scale(scale, scale)
    context.drawImage(image, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
    if (!blob) throw new Error("PNG encoding failed")
    triggerDownload(blob, fileName)
  } finally {
    URL.revokeObjectURL(url)
  }
}
