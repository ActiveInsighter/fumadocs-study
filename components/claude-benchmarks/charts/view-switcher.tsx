"use client"

import { useRef, useSyncExternalStore } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"

import { getNextTabId, getOverflowTabIds, getVisibleTabIds } from "./model"
import type { BenchmarkTab } from "./types"

import styles from "./view-switcher.module.css"

type ViewSwitcherProps = {
  tabs: readonly BenchmarkTab[]
  value: string
  onChange: (id: string) => void
  ariaLabel?: string
  panelIdPrefix: string
}

const subscribeToViewport = (onStoreChange: () => void) => {
  window.addEventListener("resize", onStoreChange)
  return () => window.removeEventListener("resize", onStoreChange)
}

const getViewportWidth = () => window.innerWidth
const getServerViewportWidth = () => 1440

export function ViewSwitcher({
  tabs,
  value,
  onChange,
  ariaLabel = "Views",
  panelIdPrefix,
}: ViewSwitcherProps) {
  const viewportWidth = useSyncExternalStore(subscribeToViewport, getViewportWidth, getServerViewportWidth)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const visibleIds = getVisibleTabIds(tabs, viewportWidth)
  const overflowIds = getOverflowTabIds(tabs, viewportWidth)
  const activeOverflowTab = tabs.find((tab) => tab.id === value && overflowIds.includes(tab.id))

  const focusTab = (id: string) => {
    window.requestAnimationFrame(() => tabRefs.current[id]?.focus())
  }

  const moveFocus = (currentId: string, direction: 1 | -1) => {
    const nextId = getNextTabId(tabs, currentId, direction, viewportWidth)
    onChange(nextId)
    focusTab(nextId)
  }

  return (
    <div className={styles.switcherRow} data-tab-count={tabs.length}>
      <TabsList aria-label={ariaLabel} className={styles.tabs} variant="line">
        {tabs.map((tab, index) => (
          <TabsTrigger
            aria-controls={`${panelIdPrefix}-panel-${tab.id}`}
            className={styles.tab}
            data-tab-index={index}
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

      {overflowIds.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={activeOverflowTab ? `More views, current: ${activeOverflowTab.label}` : "More views"}
            className={`${styles.tab} ${styles.moreButton}`}
            data-active={activeOverflowTab ? "true" : undefined}
          >
            <MoreIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={styles.menu} sideOffset={8}>
            <DropdownMenuGroup>
              {tabs
                .filter((tab) => overflowIds.includes(tab.id))
                .map((tab) => (
                  <DropdownMenuItem
                    className={styles.menuItem}
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

function MoreIcon() {
  return (
    <svg aria-hidden="true" className={styles.moreIcon} viewBox="0 0 12 12">
      <line x1="1" x2="11" y1="6" y2="6" />
      <line className={styles.moreIconVertical} x1="6" x2="6" y1="1" y2="11" />
    </svg>
  )
}
