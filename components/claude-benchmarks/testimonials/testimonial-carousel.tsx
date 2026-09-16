"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react"

import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

import { claudeTestimonials } from "../data"
import {
  clampCarouselIndex,
  getAdjacentSlideState,
  getNextCarouselIndex,
  getPreviousCarouselIndex,
} from "./model"
import styles from "./testimonial-carousel.module.css"
import { TestimonialCard } from "./testimonial-card"
import type { Testimonial } from "./types"

export interface ClaudeTestimonialCarouselProps {
  readonly items?: readonly Testimonial[]
  readonly initialIndex?: number
  readonly ariaLabel?: string
  readonly className?: string
  readonly onIndexChange?: (index: number) => void
}

type ArrowDirection = "previous" | "next"

const MOBILE_BREAKPOINT = 992
const PROGRAMMATIC_SCROLL_TIMEOUT = 600

function CarouselArrow({
  direction,
  disabled,
  onClick,
}: {
  readonly direction: ArrowDirection
  readonly disabled: boolean
  readonly onClick: () => void
}) {
  return (
    <button
      aria-label={`${direction === "previous" ? "Previous" : "Next"} quote`}
      className={`${styles.arrowButton} ${direction === "previous" ? styles.arrowPrevious : styles.arrowNext}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <ChevronDown aria-hidden="true" className={styles.arrowIcon} />
    </button>
  )
}

export function ClaudeTestimonialCarousel({
  items = claudeTestimonials,
  initialIndex = 0,
  ariaLabel = "Testimonials",
  className,
  onIndexChange,
}: ClaudeTestimonialCarouselProps) {
  const itemCount = items.length
  const initialActiveIndex = clampCarouselIndex(initialIndex, itemCount)
  const [selectedIndex, setSelectedIndex] = useState(initialActiveIndex)
  const activeIndex = clampCarouselIndex(selectedIndex, itemCount)
  const [stageHeight, setStageHeight] = useState<number | null>(null)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const activeIndexRef = useRef(initialActiveIndex)
  const activeCardRef = useRef<HTMLElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const slideRefs = useRef<Array<HTMLDivElement | null>>([])
  const scrollFrameRef = useRef<number | null>(null)
  const mobileScrollReadyRef = useRef(false)
  const programmaticScrollTargetRef = useRef<number | null>(null)
  const programmaticScrollTimerRef = useRef<number | null>(null)

  useEffect(() => {
    activeIndexRef.current = activeIndex
  }, [activeIndex])

  useEffect(() => {
    const updateViewport = () => {
      setIsMobileViewport(window.innerWidth <= MOBILE_BREAKPOINT)
    }

    updateViewport()
    window.addEventListener("resize", updateViewport)

    return () => window.removeEventListener("resize", updateViewport)
  }, [])

  const commitIndex = useCallback(
    (nextIndex: number) => {
      const safeIndex = clampCarouselIndex(nextIndex, itemCount)
      if (safeIndex === activeIndexRef.current) return

      activeIndexRef.current = safeIndex
      setSelectedIndex(safeIndex)
      onIndexChange?.(safeIndex)
    },
    [itemCount, onIndexChange],
  )

  useLayoutEffect(() => {
    if (!activeCardRef.current) return

    const measureCard = () => {
      const height = Math.ceil(activeCardRef.current?.getBoundingClientRect().height ?? 0)
      if (height > 0) setStageHeight((currentHeight) => (currentHeight === height ? currentHeight : height))
    }

    measureCard()
    const observer = new ResizeObserver(measureCard)
    observer.observe(activeCardRef.current)

    return () => observer.disconnect()
  }, [activeIndex, itemCount])

  const clearProgrammaticScroll = useCallback(() => {
    programmaticScrollTargetRef.current = null
    if (programmaticScrollTimerRef.current !== null) {
      window.clearTimeout(programmaticScrollTimerRef.current)
      programmaticScrollTimerRef.current = null
    }
  }, [])

  const scrollToIndex = useCallback((index: number, behavior?: ScrollBehavior) => {
    const stage = stageRef.current
    const slide = slideRefs.current[index]
    if (!stage || !slide || window.innerWidth > MOBILE_BREAKPOINT) return

    const target = slide.offsetLeft - (stage.clientWidth - slide.clientWidth) / 2
    const maxScroll = Math.max(stage.scrollWidth - stage.clientWidth, 0)
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const scrollBehavior = behavior ?? (reducedMotion ? "auto" : "smooth")
    const isAnimatedScroll = scrollBehavior === "smooth" || (scrollBehavior === "auto" && !reducedMotion)

    if (isAnimatedScroll) {
      programmaticScrollTargetRef.current = index
      if (programmaticScrollTimerRef.current !== null) {
        window.clearTimeout(programmaticScrollTimerRef.current)
      }
      programmaticScrollTimerRef.current = window.setTimeout(
        clearProgrammaticScroll,
        PROGRAMMATIC_SCROLL_TIMEOUT,
      )
    } else {
      clearProgrammaticScroll()
    }

    stage.scrollTo({
      behavior: scrollBehavior,
      left: Math.min(Math.max(target, 0), maxScroll),
    })
  }, [clearProgrammaticScroll])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    stage.addEventListener("scrollend", clearProgrammaticScroll)
    return () => stage.removeEventListener("scrollend", clearProgrammaticScroll)
  }, [clearProgrammaticScroll])

  useEffect(() => {
    const needsInitialPosition = !mobileScrollReadyRef.current
    mobileScrollReadyRef.current = false
    if (itemCount === 0 || !isMobileViewport) return

    const frame = window.requestAnimationFrame(() => {
      scrollToIndex(activeIndex, needsInitialPosition ? "auto" : undefined)
      mobileScrollReadyRef.current = true
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeIndex, isMobileViewport, itemCount, scrollToIndex])

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current)
      clearProgrammaticScroll()
    }
  }, [clearProgrammaticScroll])

  const handleScroll = useCallback(() => {
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current)

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      const stage = stageRef.current
      if (
        !stage ||
        !mobileScrollReadyRef.current ||
        !isMobileViewport ||
        programmaticScrollTargetRef.current !== null
      ) return

      const center = stage.scrollLeft + stage.clientWidth / 2
      let closestIndex = activeIndexRef.current
      let closestDistance = Number.POSITIVE_INFINITY

      slideRefs.current.slice(0, itemCount).forEach((slide, index) => {
        if (!slide) return
        const slideCenter = slide.offsetLeft + slide.clientWidth / 2
        const distance = Math.abs(slideCenter - center)
        if (distance < closestDistance) {
          closestDistance = distance
          closestIndex = index
        }
      })

      commitIndex(closestIndex)
    })
  }, [commitIndex, isMobileViewport, itemCount])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        commitIndex(getPreviousCarouselIndex(activeIndexRef.current, itemCount))
      }
      if (event.key === "ArrowRight") {
        event.preventDefault()
        commitIndex(getNextCarouselIndex(activeIndexRef.current, itemCount))
      }
    },
    [commitIndex, itemCount],
  )

  const handlePrevious = () => {
    const nextIndex = getPreviousCarouselIndex(activeIndexRef.current, itemCount)
    commitIndex(nextIndex)
    scrollToIndex(nextIndex)
  }

  const handleNext = () => {
    const nextIndex = getNextCarouselIndex(activeIndexRef.current, itemCount)
    commitIndex(nextIndex)
    scrollToIndex(nextIndex)
  }

  const rootClassName = cn(styles.carousel, className)
  const stageStyle = stageHeight === null
    ? undefined
    : ({ "--stage-height": `${stageHeight}px` } as CSSProperties)

  if (itemCount === 0) {
    return (
      <div className={rootClassName} role="status">
        No testimonials available.
      </div>
    )
  }

  return (
    <section aria-label={ariaLabel} className={rootClassName} data-claude-full-bleed="true">
      <nav aria-label="Testimonial pagination" className={styles.pagination}>
        <button
          className={styles.paginationButton}
          disabled={activeIndex === 0}
          onClick={handlePrevious}
          type="button"
        >
          Previous
        </button>
        <p aria-live="polite" className={styles.paginationCount}>
          {activeIndex + 1} of {itemCount}
        </p>
        <button
          className={styles.paginationButton}
          disabled={activeIndex === itemCount - 1}
          onClick={handleNext}
          type="button"
        >
          Next
        </button>
      </nav>

      <div
        aria-label={`${ariaLabel} cards`}
        className={styles.stage}
        data-measured={stageHeight === null ? "false" : "true"}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        ref={stageRef}
        role="region"
        style={stageStyle}
        tabIndex={0}
      >
        {items.map((item, index) => {
          const isActive = index === activeIndex
          const state = getAdjacentSlideState(index, activeIndex, itemCount)

          return (
            <div
              aria-hidden={!isActive}
              className={styles.slide}
              data-index={index}
              data-slide={state}
              key={`${item.company}-${item.author}-${index}`}
              ref={(element) => {
                slideRefs.current[index] = element
              }}
            >
              <TestimonialCard
                cardRef={isActive ? activeCardRef : undefined}
                index={index}
                isActive={isActive}
                item={item}
                total={itemCount}
              />
            </div>
          )
        })}
        <div aria-hidden="true" className={`${styles.veil} ${styles.veilLeft}`} />
        <div aria-hidden="true" className={`${styles.veil} ${styles.veilRight}`} />
      </div>

      <div className={styles.stripControls}>
        <p aria-live="polite" className={styles.mobileCounter}>
          {String(activeIndex + 1).padStart(2, "0")} / {String(itemCount).padStart(2, "0")}
        </p>
        <div className={styles.arrowControls}>
          <CarouselArrow
            direction="previous"
            disabled={activeIndex === 0}
            onClick={handlePrevious}
          />
          <CarouselArrow
            direction="next"
            disabled={activeIndex === itemCount - 1}
            onClick={handleNext}
          />
        </div>
      </div>
    </section>
  )
}
