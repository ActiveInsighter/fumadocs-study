"use client"

import type { ReactNode } from "react"

import { ChartFigure } from "./primitives/chart-figure"

export { useChartMotion } from "./primitives/chart-motion"

export type StudyChartFrameProps = {
  id?: string
  title: string
  description?: string
  ariaLabel?: string
  footnote?: string
  legend?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Compatibility wrapper for custom plots written against the first chart
 * frame. New code should use ChartFigure directly, which adds the toolbar,
 * interactive legend and table view.
 */
export function StudyChartFrame({ id, title, description, footnote, legend, children, className }: StudyChartFrameProps) {
  return (
    <ChartFigure className={className} exportFormats={false} footnote={footnote} id={id} subtitle={description} title={title}>
      {legend}
      {children}
    </ChartFigure>
  )
}
