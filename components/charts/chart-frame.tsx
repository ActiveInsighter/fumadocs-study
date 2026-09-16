"use client"

import * as React from "react"
import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

import styles from "./chart-frame.module.css"

type ChartMotionContextValue = {
  isInView: boolean
  shouldAnimate: boolean
}

const ChartMotionContext = React.createContext<ChartMotionContextValue>({
  isInView: true,
  shouldAnimate: false,
})

export type StudyChartFrameProps = {
  id?: string
  title: string
  description?: string
  ariaLabel?: string
  footnote?: string
  legend?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function StudyChartFrame({
  id,
  title,
  description,
  ariaLabel,
  footnote,
  legend,
  children,
  className,
}: StudyChartFrameProps) {
  const plotRef = useRef<HTMLDivElement>(null)
  const [isInView, setIsInView] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const generatedTitleId = React.useId()
  const titleId = id ? `${id}-title` : generatedTitleId

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
    <figure
      aria-label={ariaLabel ?? title}
      className={cn(styles.frame, className)}
      id={id}
    >
      <div className={styles.panel}>
        <figcaption className={styles.caption} id={titleId}>
          <span className={styles.title}>{title}</span>
          {description ? <span className={styles.description}>{description}</span> : null}
        </figcaption>
        {legend ? <div className={styles.legend}>{legend}</div> : null}
        <ChartMotionContext.Provider
          value={{ isInView, shouldAnimate: isInView && !reducedMotion }}
        >
          <div
            className={styles.plot}
            data-in-view={isInView ? "true" : "false"}
            ref={plotRef}
          >
            {children}
          </div>
        </ChartMotionContext.Provider>
      </div>
      {footnote ? <p className={styles.footnote}>{footnote}</p> : null}
    </figure>
  )
}

export function useChartMotion(): ChartMotionContextValue {
  return React.useContext(ChartMotionContext)
}
