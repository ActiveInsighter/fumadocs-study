"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

const CHART_THEMES = {
  light: "",
  dark: ".dark",
} as const

type ChartTheme = keyof typeof CHART_THEMES

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<ChartTheme, string> }
  )
}

type ChartContextValue = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextValue | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

type ChartContainerProps = React.ComponentProps<"div"> & {
  config: ChartConfig
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"]
}

function ChartContainer({
  id,
  className,
  children,
  config,
  style,
  ...props
}: ChartContainerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [initialDimension, setInitialDimension] = React.useState<{
    width: number
    height: number
  } | null>(null)
  const uniqueId = React.useId()
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`
  const chartVariables = Object.fromEntries(
    Object.entries(config).flatMap(([key, item]) =>
      item.color ? [[`--color-${key}`, item.color]] : [],
    ),
  ) as React.CSSProperties
  const themeStyles = buildChartThemeStyles(chartId, config)

  React.useEffect(() => {
    const node = containerRef.current
    if (!node) return

    const updateDimension = () => {
      const { width, height } = node.getBoundingClientRect()

      if (width <= 0 || height <= 0) {
        setInitialDimension(null)
        return
      }

      const nextDimension = {
        width: Math.round(width),
        height: Math.round(height),
      }

      setInitialDimension((currentDimension) => {
        if (
          currentDimension?.width === nextDimension.width &&
          currentDimension.height === nextDimension.height
        ) {
          return currentDimension
        }

        return nextDimension
      })
    }

    updateDimension()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateDimension)
      return () => window.removeEventListener("resize", updateDimension)
    }

    const observer = new ResizeObserver(updateDimension)
    observer.observe(node)

    return () => observer.disconnect()
  }, [])

  return (
    <ChartContext.Provider value={{ config }}>
      {themeStyles ? <style dangerouslySetInnerHTML={{ __html: themeStyles }} /> : null}
      <div
        ref={containerRef}
        data-chart={chartId}
        data-slot="chart"
        className={cn("relative flex aspect-video justify-center text-xs", className)}
        // Keep the outer box measurable during hydration. The responsive child
        // is mounted only after this box reports a positive size, so Recharts
        // never measures a hidden Tab or media-query branch as zero-sized.
        style={{ minHeight: 1, minWidth: 1, ...chartVariables, ...style }}
        {...props}
      >
        {initialDimension ? (
          <RechartsPrimitive.ResponsiveContainer
            initialDimension={initialDimension}
            minHeight={1}
            minWidth={1}
          >
            {children}
          </RechartsPrimitive.ResponsiveContainer>
        ) : null}
      </div>
    </ChartContext.Provider>
  )
}

type ChartTooltipContentProps = {
  className?: string
  active?: boolean
  label?: React.ReactNode
  payload?: RechartsPrimitive.TooltipPayload
  labelFormatter?: (label: React.ReactNode, payload: RechartsPrimitive.TooltipPayload) => React.ReactNode
  valueFormatter?: (value: unknown, name: unknown, item: RechartsPrimitive.TooltipPayloadEntry, index: number, payload: RechartsPrimitive.TooltipPayload) => React.ReactNode
  labelClassName?: string
} & {
  hideLabel?: boolean
  hideIndicator?: boolean
  indicator?: "line" | "dot" | "dashed"
  nameKey?: string
  labelKey?: string
  color?: string
}

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  valueFormatter,
  color,
  nameKey,
  labelKey,
}: ChartTooltipContentProps) {
  const { config } = useChart()

  if (!active || !payload?.length) {
    return null
  }

  const tooltipLabel = labelKey
    ? getPayloadValue(payload[0]?.payload, labelKey) ?? label
    : label
  const tooltipLabelNode = toReactNode(tooltipLabel)
  const formattedLabel = labelFormatter
    ? labelFormatter(tooltipLabelNode, payload)
    : tooltipLabelNode

  return (
    <div
      className={cn(
        "grid min-w-32 items-start gap-1.5 border bg-background px-2.5 py-1.5 text-xs shadow-xl",
        className,
      )}
    >
      {!hideLabel && formattedLabel ? (
        <div className={cn("font-medium", labelClassName)}>{formattedLabel}</div>
      ) : null}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const dataKey = getDataKey(item.dataKey)
          const itemConfig = dataKey ? config[dataKey] : undefined
          const itemColor = color ?? item.color ?? item.payload?.fill ?? "currentColor"
          const value = valueFormatter
            ? valueFormatter(item.value, item.name, item, index, payload)
            : toReactNode(item.value)
          const name = nameKey
            ? getPayloadValue(item.payload, nameKey) ?? itemConfig?.label ?? item.name ?? dataKey
            : itemConfig?.label ?? item.name ?? dataKey

          return (
            <div className="flex w-full items-center gap-2" key={`${dataKey ?? item.name ?? "value"}-${index}`}>
              {!hideIndicator ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "block shrink-0",
                    indicator === "dot" && "size-2 rounded-full",
                    indicator === "line" && "h-2.5 w-1 rounded-none",
                    indicator === "dashed" && "w-0 border-[1.5px] border-dashed bg-transparent",
                  )}
                  style={{ backgroundColor: indicator === "dashed" ? "transparent" : itemColor, borderColor: itemColor }}
                />
              ) : null}
              <span className="flex flex-1 justify-between gap-4">
                <span className="text-muted-foreground">{toReactNode(name)}</span>
                <span className="font-mono font-medium tabular-nums text-foreground">{toReactNode(value)}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type ChartLegendContentProps = {
  className?: string
  payload?: readonly RechartsPrimitive.LegendPayload[]
  hideIcon?: boolean
}

function ChartLegendContent({
  className,
  payload,
  hideIcon = false,
}: ChartLegendContentProps) {
  if (!payload?.length) {
    return null
  }

  return (
    <div className={cn("flex items-center justify-center gap-4", className)}>
      {payload.map((item) => (
        <div className="flex items-center gap-1.5" key={item.value}>
          {!hideIcon ? (
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: item.color }}
            />
          ) : null}
          {item.value}
        </div>
      ))}
    </div>
  )
}

function buildChartThemeStyles(chartId: string, config: ChartConfig): string {
  const themedItems = Object.entries(config).filter(([, item]) => item.theme)
  if (themedItems.length === 0) return ""

  return (Object.entries(CHART_THEMES) as [ChartTheme, string][])
    .map(([theme, prefix]) => {
      const variables = themedItems
        .map(([key, item]) => {
          const color = item.theme?.[theme]
          return color ? `  --color-${key}: ${color};` : null
        })
        .filter(Boolean)
        .join("\n")

      return variables
        ? `${prefix ? `${prefix} ` : ""}[data-chart="${chartId}"] {\n${variables}\n}`
        : ""
    })
    .filter(Boolean)
    .join("\n")
}

function getDataKey(dataKey: unknown): string | undefined {
  return typeof dataKey === "string" ? dataKey : undefined
}

function getPayloadValue(payload: unknown, key: string): unknown {
  if (!payload || typeof payload !== "object") {
    return undefined
  }

  return key in payload ? (payload as Record<string, unknown>)[key] : undefined
}

function toReactNode(value: unknown): React.ReactNode {
  if (value === null || value === undefined || typeof value === "boolean") {
    return undefined
  }

  if (typeof value === "string" || typeof value === "number") {
    return value
  }

  return String(value)
}

const ChartTooltip = RechartsPrimitive.Tooltip
const ChartLegend = RechartsPrimitive.Legend

export {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  useChart,
}
