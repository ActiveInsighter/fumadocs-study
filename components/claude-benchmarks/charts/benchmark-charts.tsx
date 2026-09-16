"use client"

import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"

import { Tabs, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import { InferenceSpeedupChart, GenomeCostChart } from "./bar-charts"
import { BenchmarkTable } from "./benchmark-table"
import { claudeBenchmarkData } from "../data"
import { IndexedCostChart } from "./indexed-cost-chart"
import { ScatterChart } from "./scatter-chart"
import type { ClaudeBenchmarkChartsData } from "../types"
import type { BenchmarkTab } from "./types"
import { ViewSwitcher } from "./view-switcher"

import styles from "./benchmark-charts-layout.module.css"

export interface ClaudeBenchmarkChartsProps {
  readonly data?: ClaudeBenchmarkChartsData
  readonly className?: string
}

export function ClaudeBenchmarkCharts({ data = claudeBenchmarkData, className }: ClaudeBenchmarkChartsProps) {
  const { benchmarkViews, benchmarkModels, scientificTabs, benchmarkTableRows, genomeCostRows, indexedCostGroups, inferenceRows } = data
  const [benchmarkId, setBenchmarkId] = useState(benchmarkViews.tabs[0]?.id ?? "scientific")
  const [scienceId, setScienceId] = useState(scientificTabs[0]?.id ?? "inference")
  const activeBenchmarkView = benchmarkViews.views.find((view) => view.id === benchmarkId)
    ?? benchmarkViews.views[0]
  const activeBenchmarkId = activeBenchmarkView?.id ?? benchmarkViews.tabs[0]?.id ?? "scientific"
  const activeScienceTab = scientificTabs.find((tab) => tab.id === scienceId) ?? scientificTabs[0]
  const activeScienceId = activeScienceTab?.id ?? "inference"

  return (
    <div className={cn(styles.shell, className)}>
      <section className={styles.section} aria-label="Benchmark views">
        <Tabs
          className={styles.tabsRoot}
          value={activeBenchmarkId}
          onValueChange={(value) => {
            if (typeof value === "string") {
              setBenchmarkId(value)
            }
          }}
        >
          <ViewSwitcher
            ariaLabel="Benchmark views"
            panelIdPrefix="benchmark"
            tabs={benchmarkViews.tabs}
            value={activeBenchmarkId}
            onChange={setBenchmarkId}
          />
          <TabStage activeId={activeBenchmarkId}>
            {activeBenchmarkView ? (
              <TabsContent
                aria-labelledby={`benchmark-tab-${activeBenchmarkView.id}`}
                data-benchmark-panel={activeBenchmarkView.id}
                className={styles.tabPanel}
                id={`benchmark-panel-${activeBenchmarkView.id}`}
                key={activeBenchmarkView.id}
                value={activeBenchmarkView.id}
              >
                <ScatterChart view={activeBenchmarkView} />
              </TabsContent>
            ) : null}
          </TabStage>
        </Tabs>
      </section>

      <section className={styles.section} aria-label="Benchmark comparison table">
        <BenchmarkTable models={benchmarkModels} rows={benchmarkTableRows} />
      </section>

      <section className={styles.section} id="scientific-research" aria-labelledby="scientific-research-heading">
        <h3 className={styles.sectionHeading} id="scientific-research-heading">Scientific research</h3>
        <p className={styles.scienceLead}>
          Mythos 5.1 can also improve the speed and cost of scientific workloads. The same editorial figure system keeps these performance measurements readable alongside the benchmark comparisons.
        </p>
        <Tabs
          className={`${styles.tabsRoot} ${styles.scienceTabs}`}
          value={activeScienceId}
          onValueChange={(value) => {
            if (isScientificTabId(value)) {
              setScienceId(value)
            }
          }}
        >
          <ViewSwitcher
            ariaLabel="Scientific research views"
            panelIdPrefix="science"
            tabs={scientificTabs}
            value={activeScienceId}
            onChange={(value) => {
              if (isScientificTabId(value)) {
                setScienceId(value)
              }
            }}
          />
          <TabStage activeId={activeScienceId}>
            {activeScienceTab ? (
              <TabsContent
                aria-labelledby={`science-tab-${activeScienceTab.id}`}
                data-benchmark-panel={activeScienceTab.id}
                className={styles.tabPanel}
                id={`science-panel-${activeScienceTab.id}`}
                key={activeScienceTab.id}
                value={activeScienceTab.id}
              >
                {renderScientificChart(activeScienceTab, inferenceRows, genomeCostRows)}
              </TabsContent>
            ) : null}
          </TabStage>
        </Tabs>
      </section>

      <section className={styles.section} aria-label="Indexed Fable usage cost">
        <IndexedCostChart groups={indexedCostGroups} />
      </section>
    </div>
  )
}

function renderScientificChart(
  tab: BenchmarkTab,
  inferenceRows: ClaudeBenchmarkChartsData["inferenceRows"],
  genomeCostRows: ClaudeBenchmarkChartsData["genomeCostRows"],
) {
  if (tab.id === "inference") {
    return <InferenceSpeedupChart rows={inferenceRows} />
  }

  if (tab.id === "genome-cost") {
    return <GenomeCostChart rows={genomeCostRows} />
  }

  return null
}

function isScientificTabId(value: string): value is "inference" | "genome-cost" {
  return value === "inference" || value === "genome-cost"
}

function TabStage({
  activeId,
  children,
}: {
  activeId: string
  children: ReactNode
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) {
      return
    }

    let frame: number | null = null
    let observer: ResizeObserver | null = null

    const findPanel = () => {
      return Array.from(stage.children).find(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && child.dataset.benchmarkPanel === activeId,
      )
    }

    const measure = (panel: HTMLElement) => {
      const nextHeight = panel.getBoundingClientRect().height
      if (nextHeight > 0) {
        setHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight))
      }
    }

    const connect = () => {
      const panel = findPanel()
      if (!panel) {
        frame = window.requestAnimationFrame(connect)
        return
      }

      measure(panel)

      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(() => measure(panel))
        observer.observe(panel)
      }
    }

    connect()

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame)
      }
      observer?.disconnect()
    }
  }, [activeId])

  return (
    <div
      className={styles.tabStage}
      data-height-ready={height === null ? "false" : "true"}
      ref={stageRef}
      style={height === null ? undefined : { height: `${height}px` }}
    >
      {children}
    </div>
  )
}
