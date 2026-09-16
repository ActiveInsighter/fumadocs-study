export type CarouselSlideState =
  | "active"
  | "prev"
  | "next"
  | "far-prev"
  | "far-next"
  | "hidden"

export function clampCarouselIndex(index: number, itemCount: number): number {
  if (itemCount <= 0 || !Number.isFinite(index)) return 0

  return Math.min(Math.max(Math.trunc(index), 0), itemCount - 1)
}
export function getPreviousCarouselIndex(
  activeIndex: number,
  itemCount: number,
): number {
  if (itemCount <= 0) return 0

  return Math.max(clampCarouselIndex(activeIndex, itemCount) - 1, 0)
}

export function getNextCarouselIndex(
  activeIndex: number,
  itemCount: number,
): number {
  if (itemCount <= 0) return 0

  return Math.min(clampCarouselIndex(activeIndex, itemCount) + 1, itemCount - 1)
}

export function getAdjacentSlideState(
  slideIndex: number,
  activeIndex: number,
  itemCount: number,
): CarouselSlideState {
  if (
    itemCount <= 0 ||
    slideIndex < 0 ||
    slideIndex >= itemCount ||
    activeIndex < 0 ||
    activeIndex >= itemCount
  ) {
    return "hidden"
  }

  if (slideIndex === activeIndex) return "active"
  if (slideIndex === activeIndex - 1) return "prev"
  if (slideIndex === activeIndex + 1) return "next"

  return slideIndex < activeIndex ? "far-prev" : "far-next"
}
