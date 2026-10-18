"use client"

import { useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

const STORAGE_KEY = "navigo:checkoutSelection"

function CheckoutRouter() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      const query = searchParams?.toString() ? `?${searchParams.toString()}` : ""
      
      if (!raw) {
        // No draft selection in session — go to passengers or flights
        router.replace(`/checkout/passengers${query}`)
        return
      }

      const parsed = JSON.parse(raw)
      if (parsed.bookingId) {
        // Booking already created with passengers — proceed to seat selection
        router.replace(`/checkout/seats${query}`)
      } else {
        // Draft flight selection without passengers — proceed to passenger details
        router.replace(`/checkout/passengers${query}`)
      }
    } catch {
      router.replace("/checkout/passengers")
    }
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center text-slate-400 font-mono text-xs gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
      <span>Initializing Navigo Checkout Itinerary…</span>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#020617] flex items-center justify-center text-slate-400 font-mono text-xs">
          Loading checkout…
        </div>
      }
    >
      <CheckoutRouter />
    </Suspense>
  )
}