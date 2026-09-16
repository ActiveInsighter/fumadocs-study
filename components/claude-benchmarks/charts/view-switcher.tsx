"use client"

import { ChartTabs } from "@/components/charts/chart-tabs"

import type { BenchmarkTab } from "./types"

import styles from "./view-switcher.module.css"

type ViewSwitcherProps = {
  tabs: readonly BenchmarkTab[]
  value: string
  onChange: (id: string) => void
  ariaLabel?: string
  panelIdPrefix: string
}

export function ViewSwitcher({
  tabs,
  value,
  onChange,
  ariaLabel = "Views",
  panelIdPrefix,
}: ViewSwitcherProps) {
  return (
    <ChartTabs
      ariaLabel={ariaLabel}
      classNames={{
        root: styles.switcherRow,
        list: styles.tabs,
        tab: styles.tab,
        moreButton: styles.moreButton,
        menu: styles.menu,
        menuItem: styles.menuItem,
        moreIcon: styles.moreIcon,
        moreIconVertical: styles.moreIconVertical,
      }}
      compactVisibleCount={1}
      mediumVisibleCount={3}
      onChange={onChange}
      panelIdPrefix={panelIdPrefix}
      tabs={tabs}
      value={value}
    />
  )
}
