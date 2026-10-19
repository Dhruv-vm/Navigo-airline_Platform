"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

export type PriceInsightFlight = {
  final_price: number
  base_price?: number
  occupancy_pct?: number
  days_until_departure?: number
  price_factor?: number
  airline?: string
}

export default function PriceInsight({
  flights,
}: {
  flights: PriceInsightFlight[]
}) {
  const insight = useMemo(() => computeInsight(flights), [flights])
  const [alertSet, setAlertSet] = useState(false)

  if (!insight) {
    return (
      <div className="relative bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] p-5 rounded-3xl border border-white/[0.08] ticket-edge overflow-hidden shadow-xl">
        <div className="top-accent-line" />
        <h3 className="font-display text-sm font-bold text-slate-200">Price Intelligence</h3>
        <p className="text-xs text-slate-500 mt-2">
          Search for flights to see real-time predictive fare insights.
        </p>
      </div>
    )
  }

  const {
    label,
    labelColor,
    score,
    message,
    advice,
    lowestPrice,
    avgPrice,
    occupancy,
    projectedTrend,
  } = insight

  const handleSetAlert = () => {
    setAlertSet(true)
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("open_navibot", {
          detail: {
            query: `Track fares for this route. Current lowest is ₹${lowestPrice.toLocaleString("en-IN")}.`,
          },
        })
      )
    }
  }

  return (
    <div className="relative bg-gradient-to-b from-[#0D1A2C]/95 via-[#0A1424]/98 to-[#070E1A]/98 p-5 sm:p-6 rounded-3xl border border-white/[0.09] space-y-5 ticket-edge overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
      <div className="top-accent-line" />

      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-16 -right-16 w-44 h-44 bg-cyan-400/[0.05] blur-2xl rounded-full" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 w-44 h-44 bg-amber-400/[0.05] blur-2xl rounded-full" />

      {/* HEADER & SCORE GAUGE */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400" />
            </span>
            <h3 className="font-display text-base font-bold text-white tracking-tight">Price Intelligence</h3>
          </div>
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm"
            style={{
              backgroundColor: `${labelColor}22`,
              color: labelColor,
              border: `1px solid ${labelColor}45`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: labelColor }} />
            {label} Demand
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-sm text-slate-100 font-semibold leading-snug">
              {advice}
            </p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {message}
            </p>
          </div>
          <ScoreGauge score={score} color={labelColor} />
        </div>

        {/* METRICS STRIP */}
        <div className="grid grid-cols-2 gap-2.5 mt-4 pt-3.5 border-t border-white/[0.06]">
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-3 hover:border-amber-400/30 transition-colors">
            <p className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-semibold">Lowest Fare</p>
            <p className="font-board text-base font-extrabold gold-glow-text mt-0.5">
              ₹{lowestPrice.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-3 hover:border-cyan-400/30 transition-colors">
            <p className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-semibold">Route Average</p>
            <p className="font-board text-base font-extrabold text-slate-200 mt-0.5">
              ₹{avgPrice.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-dashed border-white/[0.1]" />

      {/* PRICE TREND & INTERACTIVE CHART */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="font-display text-sm font-bold text-white tracking-tight">Price Trend & Forecast</h3>
          <span className="text-[10px] font-mono text-cyan-300 font-bold bg-cyan-400/10 px-2.5 py-0.5 rounded-full border border-cyan-400/25">
            {occupancy}% Capacity
          </span>
        </div>

        <p className="text-xs text-slate-400 mb-3 leading-relaxed">
          {projectedTrend.directionLabel}
        </p>

        <TrendChart points={projectedTrend.points} />
      </div>

      {/* NAVIBOT INTERACTIVE FARE ALERT WIDGET */}
      <div className="border-t border-dashed border-white/[0.1] pt-3">
        <button
          type="button"
          onClick={handleSetAlert}
          className="w-full text-left rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.05] hover:bg-cyan-400/[0.1] hover:border-cyan-400/40 p-3.5 flex items-center justify-between gap-3 transition-all duration-200 group cursor-pointer shadow-sm hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-cyan-400/10 border border-cyan-400/25 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
              🤖
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-cyan-300 group-hover:text-cyan-200 transition-colors flex items-center gap-1.5">
                <span>{alertSet ? "Fare Alert Active ✓" : "Track Real-Time Fares"}</span>
              </p>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {alertSet ? "NaviBot AI will notify on drops" : "Ask NaviBot AI to monitor this route"}
              </p>
            </div>
          </div>
          <span className="text-xs text-cyan-300 font-bold group-hover:translate-x-1 transition-transform shrink-0">
            →
          </span>
        </button>
      </div>

      <style jsx>{`
        @keyframes insightBadgePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.3); }
          50% { box-shadow: 0 0 0 7px rgba(74, 222, 128, 0); }
        }
        .insight-badge-pulse {
          animation: insightBadgePulse 2.2s ease-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .insight-badge-pulse { animation: none !important; }
        }
      `}</style>
    </div>
  )
}

// --- GAUGE COMPONENT ---------------------------------------------------------

function ScoreGauge({ score, color }: { score: number; color: string }) {
  const pct = Math.min(1, Math.max(0, score / 5))
  const angle = pct * 180
  const radius = 38
  const cx = 46
  const cy = 46

  const startAngle = 180
  const endAngle = 180 - angle
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const x1 = cx + radius * Math.cos(toRad(startAngle))
  const y1 = cy - radius * Math.sin(toRad(startAngle))
  const x2 = cx + radius * Math.cos(toRad(endAngle))
  const y2 = cy - radius * Math.sin(toRad(endAngle))

  const largeArc = angle > 180 ? 1 : 0

  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    setDrawn(false)
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)))
    return () => cancelAnimationFrame(t)
  }, [score])

  return (
    <div className="relative w-[92px] h-[64px] shrink-0">
      <svg viewBox="0 0 92 54" className="w-full h-full overflow-visible">
        {/* Track */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={7}
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`}
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={drawn ? 0 : 100}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }}
        />
        {/* Pointer tip dot */}
        {drawn && (
          <circle
            cx={x2}
            cy={y2}
            r={4.5}
            fill="#FFFFFF"
            stroke={color}
            strokeWidth={2}
            className="filter drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
        <p className="font-board text-xl font-black leading-none text-white tracking-tight">{score.toFixed(1)}</p>
        <p className="text-[10px] text-slate-500 font-mono mt-0.5">of 5.0</p>
      </div>
    </div>
  )
}

// --- INTERACTIVE TREND CHART -------------------------------------------------

function TrendChart({ points }: { points: { label: string; price: number }[] }) {
  const [drawn, setDrawn] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const pointsKey = points.map((p) => p.price).join(",")

  useEffect(() => {
    setDrawn(false)
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)))
    return () => cancelAnimationFrame(t)
  }, [pointsKey])

  if (!points.length) return null

  const width = 280
  const height = 110
  const padding = 14

  const prices = points.map((p) => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const span = max - min || 1

  const coords = points.map((p, i) => {
    const x = padding + (i / (points.length - 1 || 1)) * (width - padding * 2)
    const y = height - padding - ((p.price - min) / span) * (height - padding * 2)
    return { x, y, ...p }
  })

  const linePath = coords
    .map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`))
    .join(" ")

  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`

  return (
    <div className="relative">
      {/* Floating active point tooltip */}
      <AnimatePresence>
        {hoveredIdx !== null && coords[hoveredIdx] && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#060D1A] border border-amber-400/40 px-2.5 py-1 rounded-lg text-[10px] font-board font-bold shadow-lg text-amber-200 z-10 pointer-events-none whitespace-nowrap"
          >
            {coords[hoveredIdx].label}: ₹{coords[hoveredIdx].price.toLocaleString("en-IN")}
          </motion.div>
        )}
      </AnimatePresence>

      <svg viewBox={`0 0 ${width} ${height + 24}`} className="w-full h-auto overflow-visible">
        <defs>
          <linearGradient id="priceTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Subtle grid lines */}
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />

        {/* Shaded Area */}
        <path
          d={areaPath}
          fill="url(#priceTrendFill)"
          style={{ opacity: drawn ? 1 : 0, transition: "opacity 500ms ease-out 400ms" }}
        />

        {/* Trajectory Stroke */}
        <path
          d={linePath}
          fill="none"
          stroke="#FBBF24"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={drawn ? 0 : 100}
          style={{ transition: "stroke-dashoffset 750ms cubic-bezier(0.22,1,0.36,1)" }}
        />

        {/* Interactive Data Points */}
        {coords.map((c, i) => {
          const isHovered = hoveredIdx === i
          return (
            <g
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <circle
                cx={c.x}
                cy={c.y}
                r={isHovered ? 6 : i === coords.length - 1 ? 4.5 : 3.5}
                fill={isHovered ? "#FFFFFF" : i === coords.length - 1 ? "#F59E0B" : "#FDE68A"}
                stroke={isHovered ? "#F59E0B" : "transparent"}
                strokeWidth={2}
                style={{
                  transformOrigin: `${c.x}px ${c.y}px`,
                  transform: drawn ? "scale(1)" : "scale(0)",
                  opacity: drawn ? 1 : 0,
                  transition: `all 200ms ease-out, transform 300ms cubic-bezier(0.34,1.56,0.64,1) ${450 + i * 80}ms`,
                }}
              />
              <circle cx={c.x} cy={c.y} r={14} fill="transparent" />
            </g>
          )
        })}

        {/* Milestone Labels */}
        {coords.map((c, i) => (
          <text
            key={`label-${i}`}
            x={c.x}
            y={height + 18}
            textAnchor="middle"
            fontSize="9"
            fontFamily="monospace"
            fill={hoveredIdx === i ? "#FDE68A" : "#94A3B8"}
            fontWeight={hoveredIdx === i ? "bold" : "normal"}
            style={{ opacity: drawn ? 1 : 0, transition: `opacity 250ms ease-out ${450 + i * 80}ms` }}
          >
            {c.label}
          </text>
        ))}
      </svg>
    </div>
  )
}

// --- INSIGHT DERIVATION ALGORITHM --------------------------------------------

function computeInsight(flights: PriceInsightFlight[]) {
  const valid = flights.filter((f) => typeof f.final_price === "number")
  if (!valid.length) return null

  const sortedByPrice = [...valid].sort((a, b) => a.final_price - b.final_price)
  const reference = sortedByPrice[0]

  const lowestPrice = reference.final_price
  const avgPrice = Math.round(
    valid.reduce((sum, f) => sum + f.final_price, 0) / valid.length
  )

  const daysOut = typeof reference.days_until_departure === "number" ? reference.days_until_departure : 14
  const occupancy = typeof reference.occupancy_pct === "number" ? reference.occupancy_pct : 60
  const factor = typeof reference.price_factor === "number" ? reference.price_factor : lowestPrice / (reference.base_price || 3500)

  let rawScore = 2.5
  if (daysOut <= 1) {
    rawScore = 4.8
  } else if (daysOut <= 3) {
    rawScore = 4.2
  } else if (daysOut <= 7) {
    rawScore = 3.1
  } else if (daysOut <= 14) {
    rawScore = 1.9
  } else {
    rawScore = 1.2
  }

  if (occupancy > 80) rawScore += 0.5
  if (factor > 1.25) rawScore += 0.4
  if (factor < 0.95) rawScore -= 0.3

  const score = clamp(rawScore, 0.6, 4.9)

  let label: string
  let labelColor: string
  let advice: string
  let message: string

  if (score <= 2.1) {
    label = "Low"
    labelColor = "#34D399"
    advice = "Best time to book."
    message = `Fares for this travel date are at a competitive low. Book now to lock in this rate.`
  } else if (score <= 3.4) {
    label = "Typical"
    labelColor = "#FBBF24"
    advice = "Fair market price."
    message = `Prices are in the typical range for this route. Fares are predicted to rise as departure nears.`
  } else {
    label = "High"
    labelColor = "#F87171"
    advice = "High demand period."
    message = daysOut <= 3
      ? `Seats are filling rapidly with departure approaching in ${daysOut} ${daysOut === 1 ? "day" : "days"}. Book immediately to avoid further price spikes.`
      : `Prices are currently elevated due to high route demand (${occupancy}% capacity).`
  }

  const directionLabel =
    daysOut <= 3
      ? "Prices are near peak and will increase as departure nears"
      : daysOut <= 10
      ? "Fares predicted to rise by ~15-25% over the next 4–6 days"
      : "Prices expected to remain steady then rise 2 weeks before departure"

  const projectedTrend = {
    directionLabel,
    points: buildProjectedTrend(lowestPrice, daysOut),
  }

  return {
    label,
    labelColor,
    score,
    advice,
    message,
    lowestPrice,
    avgPrice,
    occupancy,
    projectedTrend,
  }
}

function buildProjectedTrend(currentPrice: number, daysOut: number) {
  if (daysOut <= 3) {
    return [
      { label: "Today", price: currentPrice },
      { label: "+12h", price: Math.round((currentPrice * 1.08) / 10) * 10 },
      { label: "+24h", price: Math.round((currentPrice * 1.18) / 10) * 10 },
      { label: "Gate", price: Math.round((currentPrice * 1.32) / 10) * 10 },
    ]
  }

  if (daysOut <= 10) {
    const today = new Date()
    return [0, 2, 4, daysOut].map((offset, idx) => {
      const growth = idx === 0 ? 1.0 : idx === 1 ? 1.07 : idx === 2 ? 1.18 : 1.30
      const d = new Date(today)
      d.setDate(d.getDate() + offset)
      const label = idx === 0 ? "Today" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
      return {
        label,
        price: Math.round((currentPrice * growth) / 10) * 10,
      }
    })
  }

  const sampleOffsets = [0, 4, 8, 12, daysOut]
  const today = new Date()

  return sampleOffsets.map((offset, idx) => {
    const growth = idx === 0 ? 1.0 : idx === 1 ? 1.04 : idx === 2 ? 1.12 : idx === 3 ? 1.22 : 1.38
    const d = new Date(today)
    d.setDate(d.getDate() + offset)
    const label = idx === 0 ? "Today" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })

    return {
      label,
      price: Math.round((currentPrice * growth) / 10) * 10,
    }
  })
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}