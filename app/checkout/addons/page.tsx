"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/navbar"
import { RollingPriceCounter } from "@/components/rolling-price-counter"
import {
  Sparkles,
  Luggage,
  Armchair,
  Utensils,
  Briefcase,
  ShieldCheck,
  Plane,
  Clock,
  ChevronUp,
  Check,
  Coffee,
  Wifi,
  Zap,
  Edit3,
  ShieldAlert,
  ArrowRight,
  Headphones,
  RotateCcw,
} from "lucide-react"

type StoredFlight = {
  id: string
  flight_instance_id: string
  airline: string
  origin: string
  destination: string
  departure_time: string
  arrival_time: string
  aircraft: string
  stops?: number
  final_price: number
  duration?: string
  travel_date?: string
  flight_number?: string
}

type CheckoutSelection = {
  departFlight: StoredFlight
  returnFlight: StoredFlight | null
  passengers: number
  mode: string
  totalPrice: number
  origin: string | null
  destination: string | null
  savedAt: number
  bookingId?: string
  holdExpiresAt?: string
  seatSelectionPrice?: number
  savedPassengers?: any[]
  addons?: { id: string; title: string; variant: string; price: number }[]
  addonsTotal?: number
}

const STORAGE_KEY = "navigo:checkoutSelection"

function buildFlightSearchUrl(selection: CheckoutSelection): string {
  const params = new URLSearchParams()
  if (selection.origin) params.set("origin", selection.origin)
  if (selection.destination) params.set("destination", selection.destination)
  if (selection.departFlight?.travel_date) params.set("depart", selection.departFlight.travel_date)
  if (selection.returnFlight?.travel_date) params.set("return", selection.returnFlight.travel_date)
  params.set("passengers", String(selection.passengers))
  if (selection.mode) params.set("mode", selection.mode)
  return `/flights?${params.toString()}`
}

const airlineLogos: Record<string, string> = {
  "IndiGo": "/airlines/indigo.png",
  "Air India": "/airlines/airindia.png",
  "Vistara": "/airlines/vistara.png",
  "Akasa Air": "/airlines/akasa.png",
  "Emirates": "/airlines/emirates.png",
  "Qatar Airways": "/airlines/qatar.png",
  "Japan Airlines": "/airlines/jal.png",
  "Singapore Airlines": "/airlines/singapore.png",
  "Singapore": "/airlines/singapore.png",
  "SIA": "/airlines/singapore.png",
  "Navigo Airlines": "/logo.png",
  "Navigo": "/logo.png",
}

const CITY_NAMES: Record<string, string> = {
  DEL: "Delhi",
  BOM: "Mumbai",
  BLR: "Bengaluru",
  MAA: "Chennai",
  CCU: "Kolkata",
  HYD: "Hyderabad",
  GOI: "Goa",
  COK: "Kochi",
  AMD: "Ahmedabad",
  PNQ: "Pune",
  DXB: "Dubai",
  SIN: "Singapore",
  LHR: "London",
  HND: "Tokyo",
  JFK: "New York",
}

type CategoryId = "recommended" | "baggage" | "comfort" | "meals" | "essentials" | "insurance" | "airport"

type AddonVariant = { label: string; price: number; originalPrice?: number }
type Addon = {
  id: string
  title: string
  desc: string
  category: Exclude<CategoryId, "recommended">
  iconType: "baggage" | "legroom" | "meal" | "lounge" | "priority" | "insurance" | "wifi" | "fasttrack"
  discountPct?: number
  variants: AddonVariant[]
}

const RECOMMENDED_ADDONS: Addon[] = [
  {
    id: "baggage",
    title: "Excess Baggage Allowance",
    desc: "Pre-book extra check-in baggage at up to 20% discounted airport rates.",
    category: "baggage",
    iconType: "baggage",
    discountPct: 20,
    variants: [
      { label: "10 kg", price: 600, originalPrice: 750 },
      { label: "15 kg", price: 900, originalPrice: 1125 },
      { label: "20 kg", price: 1200, originalPrice: 1500 },
    ],
  },
  {
    id: "legroom",
    title: "Premium Legroom Seat",
    desc: "Enjoy up to 34 inches of pitch with emergency exit or bulkhead seating.",
    category: "comfort",
    iconType: "legroom",
    discountPct: 15,
    variants: [{ label: "1 Seat", price: 1700, originalPrice: 2000 }],
  },
  {
    id: "meal",
    title: "Chef's Gourmet Meal",
    desc: "Pre-order warm gourmet meals crafted by award-winning culinary partners.",
    category: "meals",
    iconType: "meal",
    discountPct: 10,
    variants: [{ label: "1 Meal", price: 360, originalPrice: 400 }],
  },
  {
    id: "lounge",
    title: "Executive Lounge Access",
    desc: "Unwind before boarding with complimentary hot buffet, high-speed Wi-Fi, and plush seating.",
    category: "airport",
    iconType: "lounge",
    discountPct: 20,
    variants: [{ label: "1 Pass", price: 960, originalPrice: 1200 }],
  },
]

const MORE_ADDONS: Addon[] = [
  {
    id: "priority",
    title: "Priority Boarding & Baggage",
    desc: "Breeze through the gate first and receive your luggage on priority delivery.",
    category: "airport",
    iconType: "priority",
    variants: [{ label: "Add Service", price: 500 }],
  },
  {
    id: "insurance",
    title: "Comprehensive Flight Cover",
    desc: "Medical emergencies, baggage loss, trip cancellation and delays protected up to ₹10,00,000.",
    category: "insurance",
    iconType: "insurance",
    variants: [{ label: "Add Cover", price: 700 }],
  },
  {
    id: "wifi",
    title: "High-Speed In-Flight Wi-Fi",
    desc: "Stream, browse, and stay in touch above 35,000 feet with satellite broadband.",
    category: "essentials",
    iconType: "wifi",
    variants: [{ label: "Flight Pass", price: 250 }],
  },
  {
    id: "fasttrack",
    title: "Airport Security Fast Track",
    desc: "Skip long lines with dedicated security lanes at major international terminals.",
    category: "airport",
    iconType: "fasttrack",
    variants: [{ label: "Express Pass", price: 800 }],
  },
]

const ALL_ADDONS = [...RECOMMENDED_ADDONS, ...MORE_ADDONS]

const CATEGORIES: { id: CategoryId; label: string; sub: string; icon: any }[] = [
  { id: "recommended", label: "Recommended", sub: "Handpicked for your trip", icon: Sparkles },
  { id: "baggage", label: "Baggage", sub: "Extra baggage allowance", icon: Luggage },
  { id: "comfort", label: "Seats & Comfort", sub: "Extra legroom & cabin upgrades", icon: Armchair },
  { id: "meals", label: "In-Flight Dining", sub: "Warm meals & refreshments", icon: Utensils },
  { id: "essentials", label: "Travel Essentials", sub: "Wi-Fi & inflight kits", icon: Briefcase },
  { id: "insurance", label: "Travel Protection", sub: "Complete trip assurance", icon: ShieldCheck },
  { id: "airport", label: "Airport Privileges", sub: "Lounges & priority boarding", icon: Plane },
]

const HOLD_MINUTES = 15

const steps = [
  { id: 1, label: "Search" },
  { id: 2, label: "Select" },
  { id: 3, label: "Passengers" },
  { id: 4, label: "Seats" },
  { id: 5, label: "Add-ons" },
  { id: 6, label: "Payment" },
]

function formatTime(timeStr?: string): string {
  if (!timeStr) return "--:--"
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (match) {
    const hours = Number(match[1])
    const minutes = match[2]
    const period = hours >= 12 ? "PM" : "AM"
    const displayHour = hours % 12 === 0 ? 12 : hours % 12
    return `${displayHour}:${minutes} ${period}`
  }
  const d = new Date(timeStr)
  if (isNaN(d.getTime())) return "--:--"
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function formatDateLabel(dateStr?: string): string {
  if (!dateStr) return "Mon, 19 Oct"
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
  } catch {
    return dateStr
  }
}

function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`
}

export default function AddonsPage() {
  const router = useRouter()

  const [selection, setSelection] = useState<CheckoutSelection | null>(null)
  const [loadState, setLoadState] = useState<"loading" | "found" | "missing">("loading")
  const [mounted, setMounted] = useState(false)

  const [chosen, setChosen] = useState<Record<string, number>>({})
  const [activeCategory, setActiveCategory] = useState<CategoryId>("recommended")
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [dynamicCatalog, setDynamicCatalog] = useState<any[]>([])

  useEffect(() => {
    fetch("/api/addons")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.addons) setDynamicCatalog(d.addons)
      })
      .catch(() => {})
  }, [])

  const activeAllAddons = useMemo(() => {
    if (!dynamicCatalog || dynamicCatalog.length === 0) return ALL_ADDONS
    const priceMap = new Map(dynamicCatalog.map((c) => [c.id, c.price]))
    return ALL_ADDONS.map((addon) => {
      const matchedPrice =
        priceMap.get(`addon-${addon.id}`) ||
        priceMap.get(addon.id) ||
        (addon.id === "baggage" && priceMap.get("addon-bag-15")) ||
        (addon.id === "meal" && priceMap.get("addon-meal-exec")) ||
        (addon.id === "lounge" && priceMap.get("addon-lounge-del")) ||
        (addon.id === "priority" && priceMap.get("addon-priority-board")) ||
        (addon.id === "wifi" && priceMap.get("addon-wifi-high")) ||
        (addon.id === "insurance" && priceMap.get("addon-insurance")) ||
        (addon.id === "fasttrack" && priceMap.get("addon-priority-board"))

      if (matchedPrice !== undefined) {
        return {
          ...addon,
          variants: addon.variants.map((v) => ({ ...v, price: matchedPrice })),
        }
      }
      return addon
    })
  }, [dynamicCatalog])

  const activeRecommendedAddons = useMemo(() => {
    return activeAllAddons.filter((a) =>
      ["baggage", "legroom", "meal", "lounge"].includes(a.id)
    )
  }, [activeAllAddons])

  const activeMoreAddons = useMemo(() => {
    return activeAllAddons.filter(
      (a) => !["baggage", "legroom", "meal", "lounge"].includes(a.id)
    )
  }, [activeAllAddons])

  const [msLeft, setMsLeft] = useState<number | null>(null)

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) {
        // DEMO MODE FALLBACK for instant preview & inspection
        if (typeof window !== "undefined" && window.location.search.includes("demo=1")) {
          const mockSelection: CheckoutSelection = {
            origin: "DEL",
            destination: "BLR",
            passengers: 1,
            mode: "roundtrip",
            totalPrice: 27000,
            seatSelectionPrice: 28851,
            savedAt: Date.now(),
            bookingId: "demo-booking-addons-123",
            holdExpiresAt: new Date(Date.now() + 14 * 60 * 1000 + 50 * 1000).toISOString(),
            departFlight: {
              id: "flight-del-blr-1",
              flight_instance_id: "fi-del-blr-1",
              airline: "Akasa Air",
              origin: "DEL",
              destination: "BLR",
              departure_time: "21:15",
              arrival_time: "00:00",
              aircraft: "Boeing 737 MAX",
              stops: 0,
              final_price: 14500,
              duration: "2h 45m",
              travel_date: "2026-10-19",
              flight_number: "QP-1382",
            },
            returnFlight: {
              id: "flight-blr-del-2",
              flight_instance_id: "fi-blr-del-2",
              airline: "IndiGo",
              origin: "BLR",
              destination: "DEL",
              departure_time: "13:15",
              arrival_time: "17:45",
              aircraft: "Airbus A320neo",
              stops: 1,
              final_price: 12500,
              duration: "4h 30m",
              travel_date: "2026-10-24",
              flight_number: "6E-5204",
            },
          }
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(mockSelection))
          setSelection(mockSelection)
          setLoadState("found")
          return
        }

        setLoadState("missing")
        return
      }

      const parsed = JSON.parse(raw) as CheckoutSelection
      if (!parsed.bookingId) {
        setLoadState("missing")
        return
      }
      setSelection(parsed)
      setLoadState("found")
    } catch (err) {
      console.error("Failed to read checkout selection:", err)
      setLoadState("missing")
    }
  }, [])

  useEffect(() => {
    if (!selection?.holdExpiresAt) return
    const expiresAt = new Date(selection.holdExpiresAt).getTime()

    const tick = () => {
      const remaining = expiresAt - Date.now()
      setMsLeft(remaining)
      if (remaining <= 0) {
        router.push("/checkout/seats")
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [selection?.holdExpiresAt, router])

  const toggleAddon = (addon: Addon, variantIndex = 0) => {
    setChosen((prev) => {
      const next = { ...prev }
      if (addon.id in next) delete next[addon.id]
      else next[addon.id] = variantIndex
      return next
    })
  }

  const setVariant = (addonId: string, variantIndex: number) => {
    setChosen((prev) => (addonId in prev ? { ...prev, [addonId]: variantIndex } : prev))
  }

  const { addonsTotal, addonsSavings, selectedList } = useMemo(() => {
    let total = 0
    let savings = 0
    const list: { addon: Addon; variant: AddonVariant }[] = []
    for (const [id, variantIdx] of Object.entries(chosen)) {
      const addon = activeAllAddons.find((a) => a.id === id)
      if (!addon) continue
      const variant = addon.variants[variantIdx]
      if (!variant) continue
      total += variant.price
      if (variant.originalPrice) savings += variant.originalPrice - variant.price
      list.push({ addon, variant })
    }
    return { addonsTotal: total, addonsSavings: savings, selectedList: list }
  }, [chosen, activeAllAddons])

  const categoryAddons = useMemo(
    () => (activeCategory === "recommended" ? [] : activeAllAddons.filter((a) => a.category === activeCategory)),
    [activeCategory, activeAllAddons]
  )

  const handleContinue = () => {
    if (!selection) return
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...selection,
          addons: selectedList.map(({ addon, variant }) => ({
            id: addon.id,
            title: addon.title,
            variant: variant.label,
            price: variant.price,
          })),
          addonsTotal,
        })
      )
    } catch (err) {
      console.error("Failed to persist add-ons:", err)
    }
    router.push("/checkout/payment")
  }

  async function handleEditFlight() {
    if (!selection?.bookingId) {
      router.push(buildFlightSearchUrl(selection!))
      return
    }
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
      await fetch(`/api/bookings/${selection.bookingId}/seats`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const { holdExpiresAt, seatSelectionPrice, ...rest } = selection
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
    } catch (err) {
      console.warn("Failed to release held seats before editing flight:", err)
    }
    router.push(buildFlightSearchUrl(selection))
  }

  if (loadState === "loading") {
    return (
      <PageShell>
        <CenteredMessage text="Loading custom flight enhancements…" />
      </PageShell>
    )
  }

  if (loadState === "missing" || !selection) {
    return (
      <PageShell>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-amber-400 mb-2">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <p className="text-slate-300 font-medium">We couldn't find an active booking session with seats reserved.</p>
          <p className="text-sm text-slate-500 max-w-md">Please choose your seats first so we can hold your reservation while you select add-ons.</p>
          <button
            onClick={() => router.push("/checkout/seats")}
            className="mt-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-bold hover:brightness-110 transition-all shadow-lg"
          >
            Go to Seat Selection
          </button>
        </div>
      </PageShell>
    )
  }

  const { departFlight, returnFlight } = selection
  const isRoundTrip = !!returnFlight
  const baseFare = (departFlight.final_price + (returnFlight?.final_price || 0)) * selection.passengers
  const taxesAndFees = Math.round(baseFare * 0.19)
  const seatSelectionPrice = selection.seatSelectionPrice || 0
  const tripTotal = baseFare + taxesAndFees + seatSelectionPrice + addonsTotal
  const activeCategoryMeta = CATEGORIES.find((c) => c.id === activeCategory)!

  return (
    <PageShell selection={selection} router={router}>
      {/* Mobile Category Chips */}
      <CategoryChips active={activeCategory} onChange={setActiveCategory} />

      {/* Itinerary Header & Hold Timer Bar */}
      <div className={`flex items-center justify-between gap-4 mb-3.5 transition-all duration-500 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
          <p className="text-xs font-semibold text-slate-300 tracking-wide">Confirmed Flight Itinerary</p>
        </div>
        {msLeft !== null && <HoldTimer msLeft={msLeft} holdMinutes={HOLD_MINUTES} />}
      </div>

      {/* Luxury Flight Ticket Summary Cards */}
      <div className={`space-y-3 transition-all duration-500 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        <FlightTicketSummaryCard
          flight={departFlight}
          tag={isRoundTrip ? "Departure Flight" : undefined}
          isReturn={false}
          onEditFlight={handleEditFlight}
        />
        {isRoundTrip && (
          <FlightTicketSummaryCard
            flight={returnFlight}
            tag="Return Flight"
            isReturn={true}
            onEditFlight={handleEditFlight}
          />
        )}
      </div>

      {/* Main Add-ons Layout: Rail + Grid + Summary */}
      <div className="grid grid-cols-12 gap-6 mt-6">
        {/* Left Desktop Category Navigation Rail */}
        <div className="hidden lg:block lg:col-span-3">
          <CategoryRail active={activeCategory} onChange={setActiveCategory} />
        </div>

        {/* Center Add-ons Catalog Section */}
        <div className="col-span-12 lg:col-span-6 space-y-6">
          {/* Calm, Elevated Offer Banner */}
          <div className="relative bg-gradient-to-br from-[#0D1A2C] via-[#0B1729] to-[#0A1424] border border-white/[0.1] rounded-2xl p-5 sm:p-6 ticket-edge overflow-hidden shadow-lg">
            <div className="pointer-events-none absolute -top-16 -right-10 w-56 h-56 bg-[#D4AF37]/[0.08] blur-[90px] rounded-full" aria-hidden />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-400/10 border border-amber-400/25 px-2.5 py-0.5 rounded-full">
                    Exclusive Flight Upgrades
                  </span>
                </div>
                <h2 className="font-display text-lg sm:text-xl font-bold text-white tracking-tight">
                  Make your journey more comfortable
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md leading-relaxed">
                  Tailor your flight with pre-booked baggage, chef-curated meals, and executive lounge access.
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3.5 py-2.5 shadow-sm">
                <span className="text-base" aria-hidden>🎁</span>
                <div className="text-left">
                  <p className="text-xs font-semibold text-amber-200">Bundle & Save</p>
                  <p className="text-[11px] text-slate-400">Save up to 20% on pre-booked packages</p>
                </div>
              </div>
            </div>
          </div>

          {/* Catalog Listing */}
          {activeCategory === "recommended" ? (
            <>
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <div>
                    <h3 className="font-display text-base sm:text-lg font-bold text-white tracking-tight">
                      Recommended Enhancements
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Popular comfort additions chosen by Navigo travelers</p>
                  </div>
                  <span className="text-xs font-medium text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
                    4 curated options
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeRecommendedAddons.map((addon) => (
                    <AddonCard
                      key={addon.id}
                      addon={addon}
                      isSelected={addon.id in chosen}
                      variantIndex={chosen[addon.id] ?? 0}
                      onToggle={(vi) => toggleAddon(addon, vi)}
                      onVariantChange={(vi) => setVariant(addon.id, vi)}
                    />
                  ))}
                </div>
              </div>

              {/* More Add-ons Horizontal Row */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-white tracking-tight">
                      Additional Travel Perks
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Quick additions for seamless transit</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {activeMoreAddons.map((addon) => (
                    <AddonCard
                      key={addon.id}
                      addon={addon}
                      isSelected={addon.id in chosen}
                      variantIndex={chosen[addon.id] ?? 0}
                      onToggle={(vi) => toggleAddon(addon, vi)}
                      onVariantChange={(vi) => setVariant(addon.id, vi)}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div>
              <div className="mb-4">
                <h3 className="font-display text-lg font-bold text-white tracking-tight">{activeCategoryMeta.label}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{activeCategoryMeta.sub}</p>
              </div>

              {categoryAddons.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-12 text-center text-sm text-slate-400">
                  No add-on packages available in this specific category for this route.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {categoryAddons.map((addon) => (
                    <AddonCard
                      key={addon.id}
                      addon={addon}
                      isSelected={addon.id in chosen}
                      variantIndex={chosen[addon.id] ?? 0}
                      onToggle={(vi) => toggleAddon(addon, vi)}
                      onVariantChange={(vi) => setVariant(addon.id, vi)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reassurance Footer Badges */}
          <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between flex-wrap gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <div>
                <p className="text-slate-200 font-semibold">100% Guaranteed Booking</p>
                <p className="text-[11px] text-slate-400">Direct airline fulfillment</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400">
                <RotateCcw className="w-4 h-4" />
              </span>
              <div>
                <p className="text-slate-200 font-semibold">Flexible Modifications</p>
                <p className="text-[11px] text-slate-400">Change up to 3h before flight</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
                <Headphones className="w-4 h-4" />
              </span>
              <div>
                <p className="text-slate-200 font-semibold">24/7 Priority Concierge</p>
                <p className="text-[11px] text-slate-400">Instant flight assistant</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sticky Trip Summary Sidebar */}
        <div className="col-span-12 lg:col-span-3">
          <TripSummary
            selection={selection}
            baseFare={baseFare}
            taxesAndFees={taxesAndFees}
            seatSelectionPrice={seatSelectionPrice}
            selectedList={selectedList}
            addonsTotal={addonsTotal}
            addonsSavings={addonsSavings}
            tripTotal={tripTotal}
            open={summaryOpen}
            onToggleOpen={() => setSummaryOpen((v) => !v)}
            onRemoveAddon={(id) =>
              setChosen((prev) => {
                const next = { ...prev }
                delete next[id]
                return next
              })
            }
            onContinue={handleContinue}
          />
        </div>
      </div>
    </PageShell>
  )
}

// ---------------------------------------------------------------------------
// HoldTimer — Aerospace pill with radial countdown and calm typography
// ---------------------------------------------------------------------------

function HoldTimer({ msLeft, holdMinutes }: { msLeft: number; holdMinutes: number }) {
  const totalSeconds = Math.max(0, Math.floor(msLeft / 1000))
  const mm = Math.floor(totalSeconds / 60)
  const ss = totalSeconds % 60
  const urgent = totalSeconds <= 120

  const radius = 13
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(1, Math.max(0, totalSeconds / (holdMinutes * 60)))
  const dashOffset = circumference * (1 - pct)

  return (
    <div
      className={`inline-flex items-center gap-2.5 rounded-full border pl-2.5 pr-4 py-1.5 transition-all shadow-sm ${
        urgent
          ? "border-rose-400/40 bg-rose-500/[0.1] text-rose-200"
          : "border-amber-400/30 bg-[#0E1A2C]/90 text-amber-100"
      }`}
      role="timer"
      aria-live="polite"
    >
      <svg width="30" height="30" viewBox="0 0 30 30" className="shrink-0 -rotate-90" aria-hidden>
        <circle cx="15" cy="15" r={radius} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/10" />
        <circle
          cx="15"
          cy="15"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${urgent ? "text-rose-400" : "text-amber-400"}`}
        />
      </svg>
      <div className="flex items-baseline gap-1.5 leading-none">
        <span className="text-[11px] text-slate-400 font-medium">Seats held:</span>
        <span className={`font-display text-sm font-bold tabular-nums ${urgent ? "text-rose-300 font-extrabold" : "text-amber-300"}`}>
          {mm}:{ss.toString().padStart(2, "0")}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CategoryRail (desktop) & CategoryChips (mobile)
// ---------------------------------------------------------------------------

function CategoryRail({ active, onChange }: { active: CategoryId; onChange: (id: CategoryId) => void }) {
  return (
    <div className="sticky top-24 space-y-1.5 bg-[#0C1729]/80 border border-white/[0.08] rounded-2xl p-2.5 backdrop-blur-md shadow-lg">
      <div className="px-3 pt-2 pb-2 border-b border-white/[0.06] mb-1">
        <p className="text-xs font-bold text-white tracking-tight">Categories</p>
        <p className="text-[11px] text-slate-400">Filter flight services</p>
      </div>

      {CATEGORIES.map((cat) => {
        const isActive = active === cat.id
        const Icon = cat.icon
        return (
          <button
            key={cat.id}
            onClick={() => onChange(cat.id)}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
              isActive
                ? "bg-gradient-to-r from-amber-400/[0.14] to-transparent border border-amber-400/40 text-white shadow-sm"
                : "border border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                isActive ? "bg-amber-400 text-slate-950 font-bold" : "bg-white/[0.05] text-slate-400"
              }`}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className={`block text-xs font-semibold truncate ${isActive ? "text-white" : "text-slate-300"}`}>
                {cat.label}
              </span>
              <span className="block text-[10.5px] text-slate-500 truncate">{cat.sub}</span>
            </div>
            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
          </button>
        )
      })}
    </div>
  )
}

function CategoryChips({ active, onChange }: { active: CategoryId; onChange: (id: CategoryId) => void }) {
  return (
    <div className="lg:hidden -mx-6 px-6 mb-4 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-2 w-max py-1">
        {CATEGORIES.map((cat) => {
          const isActive = active === cat.id
          const Icon = cat.icon
          return (
            <button
              key={cat.id}
              onClick={() => onChange(cat.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "border-amber-400/60 bg-amber-400/15 text-amber-200 shadow-sm"
                  : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {cat.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AddonHeroVisual — Rich ambient themed graphic for each add-on type
// ---------------------------------------------------------------------------

function AddonHeroVisual({ type, discountPct }: { type: Addon["iconType"]; discountPct?: number }) {
  const getVisual = () => {
    switch (type) {
      case "baggage":
        return {
          icon: <Luggage className="w-8 h-8 text-amber-300" />,
          accent: "from-amber-500/20 via-amber-400/5 to-transparent",
          aura: "bg-amber-400/20",
          tag: "Check-in Luggage",
        }
      case "legroom":
        return {
          icon: <Armchair className="w-8 h-8 text-cyan-300" />,
          accent: "from-cyan-500/20 via-cyan-400/5 to-transparent",
          aura: "bg-cyan-400/20",
          tag: "Cabin Comfort",
        }
      case "meal":
        return {
          icon: <Utensils className="w-8 h-8 text-emerald-300" />,
          accent: "from-emerald-500/20 via-emerald-400/5 to-transparent",
          aura: "bg-emerald-400/20",
          tag: "Gourmet Dining",
        }
      case "lounge":
        return {
          icon: <Coffee className="w-8 h-8 text-amber-300" />,
          accent: "from-amber-500/25 via-amber-400/10 to-transparent",
          aura: "bg-amber-400/25",
          tag: "VIP Access",
        }
      case "priority":
        return {
          icon: <Plane className="w-8 h-8 text-blue-300" />,
          accent: "from-blue-500/20 via-blue-400/5 to-transparent",
          aura: "bg-blue-400/20",
          tag: "Fast Boarding",
        }
      case "insurance":
        return {
          icon: <ShieldCheck className="w-8 h-8 text-teal-300" />,
          accent: "from-teal-500/20 via-teal-400/5 to-transparent",
          aura: "bg-teal-400/20",
          tag: "Full Protection",
        }
      case "wifi":
        return {
          icon: <Wifi className="w-8 h-8 text-sky-300" />,
          accent: "from-sky-500/20 via-sky-400/5 to-transparent",
          aura: "bg-sky-400/20",
          tag: "Satellite Link",
        }
      case "fasttrack":
        return {
          icon: <Zap className="w-8 h-8 text-yellow-300" />,
          accent: "from-yellow-500/20 via-yellow-400/5 to-transparent",
          aura: "bg-yellow-400/20",
          tag: "Express Lane",
        }
    }
  }

  const v = getVisual()

  return (
    <div className={`relative h-28 overflow-hidden bg-gradient-to-br ${v.accent} border-b border-white/[0.06] flex items-center justify-center`}>
      <div className={`pointer-events-none absolute w-24 h-24 ${v.aura} blur-[36px] rounded-full`} />
      
      {/* Discount Pill */}
      {discountPct && (
        <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 z-10 shadow-sm">
          Save {discountPct}%
        </span>
      )}

      {/* Tag Badge */}
      <span className="absolute top-3 right-3 text-[10px] font-medium text-slate-400 bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 rounded-md">
        {v.tag}
      </span>

      {/* Main Center Icon Tile */}
      <div className="relative w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.12] flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.3)] backdrop-blur-md">
        {v.icon}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AddonCard — Polished, spacious, calm luxury card
// ---------------------------------------------------------------------------

function AddonCard({
  addon,
  isSelected,
  variantIndex,
  onToggle,
  onVariantChange,
}: {
  addon: Addon
  isSelected: boolean
  variantIndex: number
  onToggle: (variantIndex: number) => void
  onVariantChange: (variantIndex: number) => void
}) {
  const variant = addon.variants[variantIndex] || addon.variants[0]

  return (
    <div
      className={`group relative rounded-2xl border overflow-hidden transition-all duration-300 ticket-edge flex flex-col justify-between ${
        isSelected
          ? "border-amber-400/60 bg-[#0E1A2C]/90 shadow-[0_0_28px_rgba(212,175,55,0.16)] ring-1 ring-amber-400/30"
          : "border-white/[0.08] bg-[#0A1424]/80 hover:border-white/20 hover:bg-[#0D192C]/80"
      }`}
    >
      <div>
        <AddonHeroVisual type={addon.iconType} discountPct={addon.discountPct} />
        
        <div className="p-4 sm:p-5">
          <h4 className="font-display font-bold text-white text-sm sm:text-base tracking-tight">
            {addon.title}
          </h4>
          <p className="text-xs text-slate-400 mt-1 mb-4 leading-relaxed line-clamp-2">
            {addon.desc}
          </p>

          {/* Variant Selector & Price Area */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
            {addon.variants.length > 1 ? (
              <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] border border-white/[0.08] p-1">
                {addon.variants.map((v, i) => (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => onVariantChange(i)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      i === variantIndex
                        ? "bg-amber-400 text-slate-950 shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate-400 font-medium">{variant.label}</span>
            )}

            <div className="flex items-baseline gap-1.5 shrink-0 text-right">
              {variant.originalPrice && (
                <span className="text-xs text-slate-500 line-through tabular-nums">
                  {formatINR(variant.originalPrice)}
                </span>
              )}
              <span className="font-display text-base font-extrabold text-amber-300 tabular-nums">
                {formatINR(variant.price)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action CTA Button */}
      <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0">
        <button
          type="button"
          onClick={() => onToggle(variantIndex)}
          className={`w-full py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            isSelected
              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/20"
              : "bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 hover:brightness-110 shadow-md"
          }`}
        >
          {isSelected ? (
            <>
              <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
              <span>Added to Booking</span>
            </>
          ) : (
            <>
              <span>+ Add to Booking</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FlightTicketSummaryCard — Boarding Pass Ticket architecture matching Seats
// ---------------------------------------------------------------------------

function FlightTicketSummaryCard({
  flight,
  tag,
  isReturn,
  onEditFlight,
}: {
  flight: StoredFlight
  tag?: string
  isReturn: boolean
  onEditFlight?: () => void
}) {
  const logo = airlineLogos[flight.airline] || "/airlines/default.png"
  const originCity = CITY_NAMES[flight.origin] || flight.origin
  const destCity = CITY_NAMES[flight.destination] || flight.destination
  const flightNum = flight.flight_number || "NAV-420"

  return (
    <div className="relative bg-gradient-to-r from-[#0C1729]/95 via-[#0E1C33]/95 to-[#091220]/95 border border-white/[0.12] rounded-2xl p-4 sm:px-6 sm:py-3.5 shadow-md backdrop-blur-xl ticket-edge overflow-hidden">
      {/* Signature Livery Strip */}
      <div
        className={`absolute top-0 bottom-0 left-0 w-1.5 bg-gradient-to-b ${
          isReturn ? "from-cyan-400 via-blue-500 to-indigo-500" : "from-amber-300 via-amber-400 to-amber-600"
        }`}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Airline Branding & Aircraft */}
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden shadow-sm ring-1 ring-white/10 shrink-0 p-1">
            <img src={logo} alt={flight.airline} className="w-7 h-7 object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-display font-bold text-sm sm:text-base text-white tracking-tight">{flight.airline}</p>
              <span className="font-mono text-[10px] font-bold text-slate-300 bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/[0.08]">
                {flightNum}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {flight.aircraft} <span className="text-slate-600">•</span> Economy Class
            </p>
          </div>
        </div>

        {/* Center: Flight Vector Telemetry */}
        <div className="flex items-center gap-4 sm:gap-6 flex-1 justify-center max-w-xl">
          {/* Origin */}
          <div className="text-left shrink-0">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {originCity}
            </p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-display text-lg sm:text-xl font-bold text-white tabular-nums">
                {flight.origin}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-slate-300 tabular-nums">
                {formatTime(flight.departure_time)}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {formatDateLabel(flight.travel_date)}
            </p>
          </div>

          {/* Timeline Vector */}
          <div className="flex flex-col items-center flex-1 max-w-[180px] px-2">
            <span className="text-[10.5px] text-slate-300 font-bold mb-1 font-mono">
              {flight.duration || "2h 45m"}
            </span>
            <div className="flex items-center w-full max-w-[150px] gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-cyan-400/20 shrink-0" />
              <div className="h-[2px] flex-1 bg-gradient-to-r from-cyan-400/60 via-amber-400/80 to-amber-400/60 rounded-full" />
              <span aria-hidden className="text-amber-300 text-xs shrink-0 select-none">✈</span>
              <div className="h-[2px] flex-1 bg-gradient-to-r from-amber-400/60 via-emerald-400/80 to-emerald-400/60 rounded-full" />
              <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20 shrink-0" />
            </div>
            <span className="text-[9.5px] text-emerald-400 font-semibold mt-1 uppercase tracking-wide">
              {(flight.stops ?? 0) > 0 ? `${flight.stops} Stop` : "Non-stop"}
            </span>
          </div>

          {/* Destination */}
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {destCity}
            </p>
            <div className="flex items-baseline justify-end gap-1 mt-0.5">
              <span className="font-display text-lg sm:text-xl font-bold text-white tabular-nums">
                {flight.destination}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-slate-300 tabular-nums">
                {formatTime(flight.arrival_time)}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {formatDateLabel(flight.travel_date)}
            </p>
          </div>
        </div>

        {/* Right: Tag and Edit CTA */}
        <div className="flex items-center gap-2.5 ml-auto">
          {tag && (
            <span
              className={`text-[10px] uppercase tracking-wider font-bold rounded-full px-3 py-1 border flex items-center gap-1.5 ${
                isReturn
                  ? "text-cyan-300 bg-cyan-400/15 border-cyan-400/30"
                  : "text-amber-300 bg-amber-400/15 border-amber-400/30"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isReturn ? "bg-cyan-400" : "bg-amber-400"}`} />
              {tag}
            </span>
          )}
          <button
            onClick={onEditFlight}
            className="text-xs text-slate-300 hover:text-white transition-all flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 hover:border-amber-400/40 bg-white/[0.04] hover:bg-white/[0.08] cursor-pointer"
          >
            <span>Edit flight</span>
            <Edit3 className="w-3 h-3 text-amber-400" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PerforatedDivider — Boarding Pass notch motif
// ---------------------------------------------------------------------------

function PerforatedDivider() {
  return (
    <div className="relative px-5 my-1">
      <div className="border-t border-dashed border-white/[0.12]" />
      <span className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-[#060B14]" />
      <span className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-[#060B14]" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// TripSummary — Elevated Sidebar with Rolling Price Counter & Clean Layout
// ---------------------------------------------------------------------------

function TripSummary({
  selection,
  baseFare,
  taxesAndFees,
  seatSelectionPrice,
  selectedList,
  addonsTotal,
  addonsSavings,
  tripTotal,
  open,
  onToggleOpen,
  onRemoveAddon,
  onContinue,
}: {
  selection: CheckoutSelection
  baseFare: number
  taxesAndFees: number
  seatSelectionPrice: number
  selectedList: { addon: Addon; variant: AddonVariant }[]
  addonsTotal: number
  addonsSavings: number
  tripTotal: number
  open: boolean
  onToggleOpen: () => void
  onRemoveAddon: (id: string) => void
  onContinue: () => void
}) {
  return (
    <div className="sticky top-24 space-y-4">
      <div className="relative bg-gradient-to-b from-[#0C1729]/98 via-[#0E1C33]/98 to-[#091220]/98 border border-white/[0.12] rounded-2xl overflow-hidden shadow-xl ticket-edge">
        {/* Header Accordion Toggle */}
        <button
          onClick={onToggleOpen}
          className="w-full px-5 py-4 flex items-center justify-between text-left cursor-pointer hover:bg-white/[0.02] transition-colors"
        >
          <div>
            <p className="font-display text-sm font-bold text-white tracking-wide">Reservation Summary</p>
            <p className="text-xs text-slate-400 mt-0.5">
              <span className="font-bold text-amber-300">{selection.origin}</span> →{" "}
              <span className="font-bold text-cyan-300">{selection.destination}</span> · {selection.passengers} Passenger{selection.passengers > 1 ? "s" : ""}
            </p>
          </div>
          <span className={`text-slate-400 transition-transform duration-200 shrink-0 ${open ? "" : "-rotate-180"}`} aria-hidden>
            <ChevronUp className="w-4 h-4" />
          </span>
        </button>

        <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
          <div className="overflow-hidden">
            <PerforatedDivider />

            {/* Selected Add-ons Manifest */}
            <div className="px-5 py-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">
                  Custom Add-ons {selectedList.length > 0 && `(${selectedList.length})`}
                </span>
                {selectedList.length > 0 && (
                  <span className="text-xs font-bold text-emerald-400 tabular-nums">
                    +{formatINR(addonsTotal)}
                  </span>
                )}
              </div>

              {selectedList.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-1">No additional add-ons selected yet</p>
              ) : (
                <div className="space-y-2 pt-1">
                  {selectedList.map(({ addon, variant }) => (
                    <div key={addon.id} className="flex items-center justify-between gap-2 text-xs py-1 px-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <span className="flex items-center gap-2 text-slate-200 truncate min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        <span className="truncate">{addon.title}</span>
                        <span className="text-slate-400">({variant.label})</span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-amber-300 font-semibold tabular-nums">{formatINR(variant.price)}</span>
                        <button
                          onClick={() => onRemoveAddon(addon.id)}
                          className="text-slate-500 hover:text-rose-400 transition-colors p-0.5 cursor-pointer"
                          aria-label={`Remove ${addon.title}`}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <PerforatedDivider />

            {/* Fare Breakdown */}
            <div className="px-5 py-3.5">
              <span className="text-xs font-semibold text-slate-400 block mb-2.5">Fare Breakdown</span>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Flight Base Fare</span>
                  <span className="text-slate-300 font-medium tabular-nums">{formatINR(baseFare)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Aviation Taxes & Fees</span>
                  <span className="text-slate-300 font-medium tabular-nums">{formatINR(taxesAndFees)}</span>
                </div>
                {seatSelectionPrice > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Seat Selection</span>
                    <span className="text-slate-300 font-medium tabular-nums">{formatINR(seatSelectionPrice)}</span>
                  </div>
                )}
                {addonsTotal > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-400">Selected Add-ons</span>
                    <span className="text-emerald-400 font-semibold tabular-nums">{formatINR(addonsTotal)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Total Price Banner with Rolling Counter */}
        <div className="px-5 py-4 border-t border-white/[0.08] bg-[#0A1424]/90">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wide">Total Fare</span>
            <span className="text-[11px] text-slate-500 font-medium">All taxes included</span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-sm font-semibold text-slate-300">Amount to Pay</span>
            <RollingPriceCounter value={tripTotal} size="md" />
          </div>
        </div>

        {/* Savings Badge */}
        {addonsSavings > 0 && (
          <div className="mx-5 mb-4 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
            <span className="text-emerald-400 shrink-0">🏷</span>
            <span>You're saving {formatINR(addonsSavings)} on pre-booked packages!</span>
          </div>
        )}

        {/* Continue Button */}
        <div className="px-5 pb-5">
          <button
            onClick={onContinue}
            className="w-full py-3.5 rounded-xl font-bold bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 hover:brightness-110 shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <span>Proceed to Payment</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* NavBot Concierge Card */}
      <NavBotTip />
    </div>
  )
}

function NavBotTip() {
  return (
    <div className="relative bg-gradient-to-br from-cyan-500/[0.08] to-[#0A1424] border border-cyan-400/20 rounded-2xl p-4 flex items-start gap-3 shadow-md overflow-hidden">
      <div className="w-9 h-9 rounded-xl bg-cyan-400/15 border border-cyan-400/25 flex items-center justify-center text-cyan-300 text-lg shrink-0">
        🤖
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-cyan-200">Have questions about add-ons?</p>
        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
          NavBot AI can recommend baggage allowance or meal options for your itinerary.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PageShell — Responsive Layout and Progress Stepper
// ---------------------------------------------------------------------------

function PageShell({
  children,
  selection,
  router,
}: {
  children: React.ReactNode
  selection?: CheckoutSelection
  router?: ReturnType<typeof useRouter>
}) {
  return (
    <div className="min-h-screen bg-[#060B14] text-white relative overflow-x-hidden selection:bg-amber-400/30">
      <PageStyles />
      <div className="pointer-events-none fixed inset-0 opacity-[0.05] mix-blend-overlay grain-layer" />
      <div className="pointer-events-none fixed top-[-200px] left-[15%] w-[600px] h-[600px] bg-[#D4AF37]/[0.05] blur-[160px] rounded-full" />
      <div className="pointer-events-none fixed bottom-[-200px] right-[10%] w-[500px] h-[500px] bg-cyan-400/[0.05] blur-[160px] rounded-full" />

      <Navbar />

      <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 pt-24 pb-16">
        <div className="flex items-center justify-between gap-6 mb-8">
          <button
            onClick={() => router?.push("/checkout/seats")}
            className="group flex items-center gap-2 pl-2 pr-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-400 hover:text-white border border-transparent hover:border-white/10 hover:bg-white/[0.04] transition-all shrink-0 cursor-pointer"
          >
            <span className="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center group-hover:bg-white/10 transition-colors" aria-hidden>
              ←
            </span>
            Back to seat map
          </button>
          <Stepper currentStepId={5} />
        </div>
        {children}
      </div>
    </div>
  )
}

function Stepper({ currentStepId }: { currentStepId: number }) {
  const progressPct = ((currentStepId - 1) / (steps.length - 1)) * 100
  return (
    <div className="relative hidden md:flex items-center flex-1 max-w-xl">
      <div className="absolute left-4 right-4 h-[2px] bg-white/[0.08] rounded-full" />
      <div
        className="absolute left-4 h-[2px] bg-gradient-to-r from-emerald-400 to-amber-400 rounded-full transition-all duration-500"
        style={{ width: `calc(${progressPct}% - ${progressPct > 0 ? 28 : 0}px)` }}
      />
      <div className="relative flex items-center justify-between w-full">
        {steps.map((step) => {
          const isDone = step.id < currentStepId
          const isCurrent = step.id === currentStepId
          return (
            <div key={step.id} className="flex flex-col items-center gap-1.5 bg-[#060B14] px-1">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  isCurrent
                    ? "border-amber-400 bg-amber-400/20 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.3)]"
                    : isDone
                    ? "border-emerald-400/80 bg-emerald-400/15 text-emerald-300"
                    : "border-white/15 bg-white/[0.03] text-slate-600"
                }`}
              >
                {isDone ? "✓" : step.id}
              </span>
              <span className={`text-[11px] whitespace-nowrap font-medium ${isCurrent ? "text-amber-300 font-bold" : isDone ? "text-emerald-300/80" : "text-slate-600"}`}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <p className="text-slate-400 text-sm font-medium tracking-wide">{text}</p>
    </div>
  )
}

function PageStyles() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800&display=swap');
      .font-display { font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif; letter-spacing: -0.01em; }

      .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
      .no-scrollbar::-webkit-scrollbar { display: none; }

      .ticket-edge { position: relative; }
      .ticket-edge::before {
        content: "";
        position: absolute;
        inset: 1px;
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: inherit;
        pointer-events: none;
      }

      .grain-layer {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
      }
    `}</style>
  )
}