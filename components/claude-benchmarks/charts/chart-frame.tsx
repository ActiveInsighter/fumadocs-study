"use client"

import * as React from "react"
import { useEffect, useId, useRef, useState } from "react"
import type { ReactNode } from "react"

import type { ChartColor, ChartPattern } from "./types"
import { getChartColorToken } from "./model"

import styles from "./benchmark-charts.module.css"

export type LegendItem = {
  label: string
  color: ChartColor
  emphasis?: boolean
  pattern?: ChartPattern
}

export type ChartFrameProps = {
  id?: string
  title: string
  subtitle?: string
  ariaLabel: string
  footnote?: string
  legend?: readonly LegendItem[]
  children: ReactNode
}

type ChartMotionContextValue = {
  isInView: boolean
  shouldAnimate: boolean
}

const ChartMotionContext = React.createContext<ChartMotionContextValue>({
  isInView: true,
  shouldAnimate: false,
})

export function ChartFrame({
  id,
  title,
  subtitle,
  ariaLabel,
  footnote,
  legend,
  children,
}: ChartFrameProps) {
  const plotRef = useRef<HTMLDivElement>(null)
  const [isInView, setIsInView] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const titleId = useId()
  const legendPrefix = useId().replace(/:/g, "")
  const titleAnchor = id ? `${id}-title` : titleId

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updateMotionPreference = () => setReducedMotion(motionQuery.matches)
    updateMotionPreference()
    motionQuery.addEventListener("change", updateMotionPreference)

    return () => motionQuery.removeEventListener("change", updateMotionPreference)
  }, [])

  useEffect(() => {
    const node = plotRef.current

    if (!node || typeof IntersectionObserver === "undefined") {
      setIsInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <figure className={styles.frame} aria-label={ariaLabel} id={id}>
      <div className={styles.panel}>
        <figcaption className={styles.caption} id={titleAnchor}>
          <span className={styles.title}>{title}</span>
          {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
        </figcaption>
        {legend?.length ? (
            <ul className={styles.legend} aria-label="Series">
            {legend.map((item, index) => (
              <li className={styles.legendItem} key={item.label}>
                <LegendSwatch index={index} item={item} prefix={legendPrefix} />
                <span>{item.emphasis ? <strong className={styles.emphasis}>{item.label}</strong> : item.label}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <ChartMotionContext.Provider value={{ isInView, shouldAnimate: isInView && !reducedMotion }}>
          <div ref={plotRef} className={styles.plot} data-in-view={isInView ? "true" : "false"}>
            {children}
          </div>
        </ChartMotionContext.Provider>
      </div>
      {footnote ? <p className={styles.footnote}>{footnote}</p> : null}
    </figure>
  )
}

function LegendSwatch({
  index,
  item,
  prefix,
}: {
  index: number
  item: LegendItem
  prefix: string
}) {
  const patternId = `${prefix}-legend-${index}-${item.pattern ?? "solid"}`
  const color = getChartColorToken(item.color)
  const fill = item.pattern ? `url(#${patternId})` : color

  return (
    <svg aria-hidden="true" className={styles.swatch} viewBox="0 0 14 14">
      {item.pattern ? (
        <defs>
          <pattern height="6" id={patternId} patternUnits="userSpaceOnUse" width="6">
            <rect fill={color} height="6" width="6" />
            {item.pattern === "dots" ? (
              <>
                <circle cx="1.5" cy="1.5" fill="var(--claude-chart-ink)" r="0.8" />
                <circle cx="4.5" cy="4.5" fill="var(--claude-chart-ink)" r="0.8" />
              </>
            ) : (
              <path d="M-1 1 l2 -2 M0 6 l6 -6 M5 7 l2 -2" stroke="var(--claude-chart-ink)" strokeWidth="1" />
            )}
          </pattern>
        </defs>
      ) : null}
      <rect fill={fill} height="13" stroke="var(--claude-chart-ink)" strokeWidth="1" width="13" x="0.5" y="0.5" />
    </svg>
  )
}

export function useChartMotion(): ChartMotionContextValue {
  return React.useContext(ChartMotionContext)
}
