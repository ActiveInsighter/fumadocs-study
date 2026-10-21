"use client"

import * as React from "react"

export type ChartMotionState = {
  /** The figure has scrolled into view at least once. */
  isInView: boolean
  /** Entrance animation allowed: in view, no reduced-motion, no data saver. */
  shouldAnimate: boolean
}

const ChartMotionContext = React.createContext<ChartMotionState>({
  isInView: true,
  shouldAnimate: false,
})

export const ChartMotionProvider = ChartMotionContext.Provider

export function useChartMotion(): ChartMotionState {
  return React.useContext(ChartMotionContext)
}

type NetworkInformationLike = { saveData?: boolean }

/** Reduced motion or an explicit data-saver request both disable chart tweens. */
export function useReducedChartMotion(): boolean {
  const [reduced, setReduced] = React.useState(false)

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection
    const update = () => setReduced(query.matches || connection?.saveData === true)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  return reduced
}

/** Flips to true once the element first intersects the viewport. */
export function useInViewOnce<T extends Element>(ref: React.RefObject<T | null>): boolean {
  const [inView, setInView] = React.useState(false)

  React.useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])

  return inView
}
