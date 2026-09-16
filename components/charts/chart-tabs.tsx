"use client"

import { useLayoutEffect, useRef, useState } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import {
  getNextVisibleChartTabId,
  getOverflowChartTabIds,
  getVisibleChartTabIds,
  type ChartTab,
  type ChartTabVisibilityOptions,
} from "./chart-tabs-model"

import styles from "./chart-tabs.module.css"

export type ChartTabsClassNames = {
  root?: string
  list?: string
  tab?: string
  moreButton?: string
  menu?: string
  menuItem?: string
  moreIcon?: string
  moreIconVertical?: string
}

export type ChartTabsProps = ChartTabVisibilityOptions & {
  tabs: readonly ChartTab[]
  value: string
  onChange: (id: string) => void
  ariaLabel?: string
  panelIdPrefix: string
  classNames?: ChartTabsClassNames
}

export function ChartTabs({
  tabs,
  value,
  onChange,
  ariaLabel = "Chart views",
  panelIdPrefix,
  classNames,
  compactBreakpoint,
  compactVisibleCount,
  mediumBreakpoint,
  mediumVisibleCount,
}: ChartTabsProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [containerWidth, setContainerWidth] = useState(1440)

  useLayoutEffect(() => {
    const node = rootRef.current
    if (!node) return

    const updateWidth = () => {
      const nextWidth = Math.round(node.getBoundingClientRect().width)
      if (nextWidth > 0) {
        setContainerWidth((currentWidth) =>
          currentWidth === nextWidth ? currentWidth : nextWidth,
        )
      }
    }

    updateWidth()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth)
      return () => window.removeEventListener("resize", updateWidth)
    }

    const observer = new ResizeObserver(updateWidth)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const visibilityOptions = {
    compactBreakpoint,
    compactVisibleCount,
    mediumBreakpoint,
    mediumVisibleCount,
  }
  const visibleIds = getVisibleChartTabIds(tabs, containerWidth, visibilityOptions)
  const visibleIdSet = new Set(visibleIds)
  const overflowIds = getOverflowChartTabIds(tabs, containerWidth, visibilityOptions)
  const overflowIdSet = new Set(overflowIds)
  const visibleTabs = tabs.filter((tab) => visibleIdSet.has(tab.id))
  const overflowTabs = tabs.filter((tab) => overflowIdSet.has(tab.id))
  const activeOverflowTab = overflowTabs.find((tab) => tab.id === value)

  const focusTab = (id: string) => {
    window.requestAnimationFrame(() => tabRefs.current[id]?.focus())
  }

  const moveFocus = (currentId: string, direction: 1 | -1) => {
    const nextId = getNextVisibleChartTabId(
      tabs,
      currentId,
      direction,
      containerWidth,
      visibilityOptions,
    )
    onChange(nextId)
    focusTab(nextId)
  }

  return (
    <div
      className={cn(styles.root, classNames?.root)}
      data-tab-count={tabs.length}
      ref={rootRef}
    >
      <TabsList
        aria-label={ariaLabel}
        className={cn(styles.list, classNames?.list)}
        variant="line"
      >
        {visibleTabs.map((tab) => (
          <TabsTrigger
            aria-controls={`${panelIdPrefix}-panel-${tab.id}`}
            className={cn(styles.tab, classNames?.tab)}
            data-selected={value === tab.id ? "true" : undefined}
            id={`${panelIdPrefix}-tab-${tab.id}`}
            key={tab.id}
            ref={(node) => {
              tabRefs.current[tab.id] = node
            }}
            value={tab.id}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault()
                moveFocus(tab.id, 1)
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault()
                moveFocus(tab.id, -1)
              } else if (event.key === "Home") {
                event.preventDefault()
                const firstId = visibleIds[0] ?? tab.id
                onChange(firstId)
                focusTab(firstId)
              } else if (event.key === "End") {
                event.preventDefault()
                const lastId = visibleIds.at(-1) ?? tab.id
                onChange(lastId)
                focusTab(lastId)
              }
            }}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {overflowTabs.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={
              activeOverflowTab
                ? `More views, current: ${activeOverflowTab.label}`
                : "More views"
            }
            className={cn(styles.moreButton, classNames?.moreButton)}
            data-active={activeOverflowTab ? "true" : undefined}
          >
            <MoreIcon classNames={classNames} />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className={cn(styles.menu, classNames?.menu)}
            sideOffset={8}
          >
            <DropdownMenuGroup>
              {overflowTabs.map((tab) => (
                <DropdownMenuItem
                  className={cn(styles.menuItem, classNames?.menuItem)}
                  data-active={value === tab.id ? "true" : undefined}
                  key={tab.id}
                  onClick={() => onChange(tab.id)}
                >
                  {tab.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}

function MoreIcon({ classNames }: { classNames?: ChartTabsClassNames }) {
  return (
    <svg
      aria-hidden="true"
      className={cn(styles.moreIcon, classNames?.moreIcon)}
      viewBox="0 0 12 12"
    >
      <line x1="1" x2="11" y1="6" y2="6" />
      <line
        className={cn(styles.moreIconVertical, classNames?.moreIconVertical)}
        x1="6"
        x2="6"
        y1="1"
        y2="11"
      />
    </svg>
  )
}
