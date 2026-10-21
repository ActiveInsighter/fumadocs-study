"use client"

import * as React from "react"

import { Tabs, TabsContent } from "@/components/ui/tabs"

import { ChartTabs } from "../chart-tabs"

import styles from "./chart-switcher.module.css"

export type StudyChartSwitcherProps = {
  /** Tab labels, one per child chart. Falls back to each child's `title`. */
  labels?: readonly string[]
  defaultIndex?: number
  ariaLabel?: string
  children: React.ReactNode
}

/**
 * Metric / benchmark switcher: one tab per child chart, text-only tabs that
 * collapse into an overflow menu on narrow screens. Only the active chart is
 * mounted, so hidden panels never measure as zero-sized.
 *
 * ```mdx
 * <StudyChartSwitcher labels={["准确率", "耗时"]}>
 *   <StudyLineChart … />
 *   <StudyBarChart … />
 * </StudyChartSwitcher>
 * ```
 */
export function StudyChartSwitcher({ labels, defaultIndex = 0, ariaLabel = "图表视图", children }: StudyChartSwitcherProps) {
  const items = React.Children.toArray(children).filter(React.isValidElement)
  const prefix = React.useId().replace(/:/g, "")
  const tabs = items.map((child, index) => {
    const title = (child.props as { title?: unknown }).title
    return { id: `view-${index}`, label: labels?.[index] ?? (typeof title === "string" ? title : `视图 ${index + 1}`) }
  })
  const [value, setValue] = React.useState(tabs[Math.min(defaultIndex, tabs.length - 1)]?.id ?? "view-0")
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === value))

  if (items.length === 0) return null

  return (
    <Tabs
      className={styles.root}
      onValueChange={(next) => {
        if (typeof next === "string") setValue(next)
      }}
      value={value}
    >
      <ChartTabs ariaLabel={ariaLabel} onChange={setValue} panelIdPrefix={prefix} tabs={tabs} value={value} />
      <TabsContent
        aria-labelledby={`${prefix}-tab-${value}`}
        className={styles.panel}
        id={`${prefix}-panel-${value}`}
        key={value}
        value={value}
      >
        {items[activeIndex]}
      </TabsContent>
    </Tabs>
  )
}
