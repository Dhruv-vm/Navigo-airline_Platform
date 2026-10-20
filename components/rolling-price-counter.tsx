"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

export function RollingDigit({
  char,
  delay = 0,
  textColor = "text-amber-300",
}: {
  char: string
  delay?: number
  textColor?: string
}) {
  if (char < "0" || char > "9") {
    return (
      <span className={`inline-block px-[1px] font-display font-black select-none ${textColor}`}>
        {char}
      </span>
    )
  }

  const digit = parseInt(char, 10)

  return (
    <span className={`inline-block relative overflow-hidden h-[1.18em] leading-[1.18em] min-w-[0.62em] text-center align-baseline select-none font-display font-black ${textColor}`}>
      <motion.span
        className="flex flex-col w-full"
        initial={false}
        animate={{ y: `-${digit * 10}%` }}
        transition={{
          type: "spring",
          stiffness: 160,
          damping: 20,
          mass: 0.85,
          delay,
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span
            key={n}
            className={`h-[1.18em] leading-[1.18em] flex items-center justify-center text-center ${textColor}`}
          >
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  )
}

export function RollingPriceCounter({
  value,
  className = "",
  size = "md",
  textColor = "text-amber-300",
  currencyColor = "text-amber-400",
  showBadge = true,
}: {
  value: number
  className?: string
  size?: "sm" | "md" | "lg"
  textColor?: string
  currencyColor?: string
  showBadge?: boolean
}) {
  const rounded = Math.round(value)
  const [isUpdating, setIsUpdating] = useState(false)
  const prevRef = useRef(rounded)
  const isFirstMount = useRef(true)

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    if (prevRef.current !== rounded) {
      prevRef.current = rounded
      setIsUpdating(true)
      const timer = setTimeout(() => setIsUpdating(false), 750)
      return () => clearTimeout(timer)
    }
  }, [rounded])

  const formatted = rounded.toLocaleString("en-IN")
  const chars = formatted.split("")
  const len = chars.length

  const sizeClasses = {
    sm: {
      currency: "text-base sm:text-lg mr-0.5",
      numbers: "text-lg sm:text-xl",
    },
    md: {
      currency: "text-xl sm:text-2xl mr-1",
      numbers: "text-2xl sm:text-3xl",
    },
    lg: {
      currency: "text-2xl sm:text-3xl mr-1.5",
      numbers: "text-3xl sm:text-4xl",
    },
  }[size]

  return (
    <div className={`relative inline-flex flex-col items-end ${className}`}>
      {/* Updating micro-status pill */}
      <AnimatePresence>
        {showBadge && isUpdating && (
          <motion.span
            initial={{ opacity: 0, y: -4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="absolute -top-4 right-0 text-[8.5px] font-mono font-bold text-amber-300 bg-amber-400/20 border border-amber-400/40 px-1.5 py-0.2 rounded-full whitespace-nowrap tracking-wider shadow-[0_0_8px_rgba(251,191,36,0.3)]"
          >
            UPDATING…
          </motion.span>
        )}
      </AnimatePresence>

      <motion.div
        animate={isUpdating ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="inline-flex items-baseline tabular-nums"
      >
        <span className={`font-display font-black select-none ${currencyColor} ${sizeClasses.currency}`}>
          ₹
        </span>
        <div className={`inline-flex items-baseline font-display font-black ${textColor} ${sizeClasses.numbers}`}>
          {chars.map((ch, idx) => {
            const revIdx = len - 1 - idx
            const delay = idx * 0.035
            return (
              <RollingDigit
                key={`digit-rev-${revIdx}-${ch === "," ? "comma" : "num"}`}
                char={ch}
                delay={delay}
                textColor={textColor}
              />
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
