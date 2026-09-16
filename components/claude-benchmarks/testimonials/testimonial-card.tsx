import type { Ref } from "react"

import styles from "./testimonial-carousel.module.css"
import type { Testimonial } from "./types"

interface TestimonialCardProps {
  readonly item: Testimonial
  readonly index: number
  readonly total: number
  readonly isActive: boolean
  readonly cardRef?: Ref<HTMLElement>
}
export function TestimonialCard({
  item,
  index,
  total,
  isActive,
  cardRef,
}: TestimonialCardProps) {
  return (
    <article
      aria-hidden={!isActive}
      aria-label={`Testimonial ${index + 1} of ${total}`}
      className={styles.card}
      ref={cardRef}
      tabIndex={isActive ? 0 : -1}
    >
      <div className={styles.body}>
        <span className={styles.label}>Quote</span>
        <blockquote className={styles.quote}>
          <p>{item.quote}</p>
        </blockquote>
      </div>

      <div className={styles.split}>
        <div className={styles.cell}>
          <span className={styles.label}>Company</span>
          <span className={styles.value}>{item.company}</span>
        </div>
        <div className={styles.cell}>
          <span className={styles.label}>Author</span>
          <span className={styles.value}>{item.author}</span>
        </div>
      </div>
    </article>
  )
}
