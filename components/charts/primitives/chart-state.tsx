"use client"

import * as React from "react"

import styles from "./chart-figure.module.css"

export function ChartEmpty({ message = "暂无可绘制的数据", height }: { message?: string; height?: number }) {
  return (
    <div className={styles.state} role="status" style={height ? { minHeight: height } : undefined}>
      <svg aria-hidden="true" className={styles.stateIcon} viewBox="0 0 24 24">
        <path d="M3 20h18M6 16l4-5 3 3 5-7" />
      </svg>
      <span>{message}</span>
    </div>
  )
}

type BoundaryProps = {
  children: React.ReactNode
  height?: number
  onShowTable?: () => void
}

type BoundaryState = { error: Error | null }

/**
 * A rendering failure in one chart (bad data shape, unsupported prop) must
 * not take the whole MDX page down. The reader keeps the table fallback.
 */
export class ChartErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: Error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[charts] render failed", error)
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className={styles.state} role="alert" style={this.props.height ? { minHeight: this.props.height } : undefined}>
        <span>图表渲染失败，请检查数据格式。</span>
        {this.props.onShowTable ? (
          <button className={styles.stateAction} onClick={this.props.onShowTable} type="button">
            改为查看数据表
          </button>
        ) : null}
      </div>
    )
  }
}
