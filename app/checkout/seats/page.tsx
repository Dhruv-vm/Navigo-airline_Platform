"use client"

import { useEffect, useMemo, useState, useRef, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import Navbar from "@/components/navbar"
import {
  Plane,
  Clock,
  ArrowRight,
  Check,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Wifi,
  Zap,
  Armchair,
  Coffee,
  Lock,
  Info,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Ticket,
  Luggage,
  AlertCircle,
  X,
  ChevronRight,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StoredFlight = {
  id: string | number
  flight_instance_id?: string | number
  airline: string
  origin: string
  destination: string
  departure_time: string
  arrival_time: string
  aircraft: string
  stops?: number
  final_price: number
  base_price?: number
  available_seats?: number
  duration?: string
  travel_date?: string
}

type StoredPassenger = {
  id: string
  booking_id?: string
  passenger_index?: number
  passenger_type?: string
  age?: number | null
  title?: string
  first_name: string
  middle_name?: string | null
  last_name: string
  date_of_birth?: string | null
  gender?: string | null
  nationality?: string | null
  frequent_flyer?: string | null
  email?: string | null
  country_code?: string | null
  mobile?: string | null
  is_primary_contact?: boolean
  firstName?: string
  lastName?: string
  type?: string
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
  savedPassengers?: StoredPassenger[]
}

type ApiSeat = {
  id: string
  seatNumber: string
  row: number
  col: string
  cabinClass: string
  seatType: string
  price: number
  isWindow: boolean
  isAisle: boolean
  isAvailable: boolean
  isMine: boolean
  myPassengerId: string | null
}

type LegSeatMap = {
  flightInstanceId: string
  flight: StoredFlight
  label: string
  seats: ApiSeat[]
  hasSeatMap: boolean
}

type SelectionMap = Record<string, string>

const STORAGE_KEY = "navigo:checkoutSelection"

const AIRPORT_CITIES: Record<string, string> = {
  DEL: "Delhi",
  BOM: "Mumbai",
  BLR: "Bengaluru",
  MAA: "Chennai",
  CCU: "Kolkata",
  HYD: "Hyderabad",
  COK: "Kochi",
  GOI: "Goa",
  DXB: "Dubai",
  SIN: "Singapore",
  LHR: "London",
  JFK: "New York",
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

function paxFirstName(p: StoredPassenger, fallbackIndex: number): string {
  return p.first_name || p.firstName || `Passenger`
}

function paxLastName(p: StoredPassenger, fallbackIndex: number): string {
  return p.last_name || p.lastName || `${fallbackIndex + 1}`
}

function paxInitials(p: StoredPassenger, fallbackIndex: number): string {
  const f = paxFirstName(p, fallbackIndex)
  const l = paxLastName(p, fallbackIndex)
  return `${f[0] ?? "P"}${l[0] ?? ""}`.toUpperCase()
}

function paxFullName(p: StoredPassenger, fallbackIndex: number): string {
  return `${paxFirstName(p, fallbackIndex)} ${paxLastName(p, fallbackIndex)}`.trim()
}

function paxTypeLabel(p: StoredPassenger): string {
  const t = (p.passenger_type || p.type || "adult").toLowerCase()
  if (t.startsWith("child")) return "Child"
  if (t.startsWith("infant")) return "Infant"
  return "Adult"
}

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

function formatDateLabel(timeStr?: string, travelDate?: string): string {
  const source = travelDate || timeStr
  if (!source) return ""
  if (/^\d{1,2}:\d{2}/.test(source) && !travelDate) return ""
  const d = new Date(source)
  if (isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
}

function formatDuration(flight: StoredFlight): string {
  if (flight.duration) return flight.duration
  const dep = parseTimeToMinutes(flight.departure_time)
  const arr = parseTimeToMinutes(flight.arrival_time)
  if (dep === null || arr === null) return "--"
  let diff = arr - dep
  if (diff < 0) diff += 24 * 60
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return `${h}h ${m}m`
}

function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

// ---------------------------------------------------------------------------
// Cabin Class Config
// ---------------------------------------------------------------------------

const CABIN_CLASSES = [
  { key: "economy",         label: "Economy Class",   tier: "I",   fromPrice: 2500, pitch: "30\" Standard Pitch", desc: "Ergonomic comfort, USB power & cabin refreshments" },
  { key: "premium_economy", label: "Premium Economy",  tier: "II",  fromPrice: 6000, pitch: "36\" Extra Legroom", desc: "6 inches extra legroom, priority baggage & dining" },
  { key: "business",        label: "Business Class",  tier: "III", fromPrice: 12000, pitch: "180° Lie-Flat Bed", desc: "Direct aisle access, lounge access & gourmet cuisine" },
  { key: "first",           label: "First Class",     tier: "IV",  fromPrice: 28000, pitch: "Private Enclosed Suite", desc: "Sliding privacy doors, fine dining & VIP concierge" },
] as const

type CabinKey = (typeof CABIN_CLASSES)[number]["key"]

const CABIN_PERKS: Record<CabinKey, { icon: "wifi" | "zap" | "armchair" | "coffee" | "luggage"; label: string; desc: string }[]> = {
  economy: [
    { icon: "armchair", label: "Standard 30\" Seat Pitch", desc: "Ergonomic recline & adjustable headrest" },
    { icon: "luggage", label: "7kg Cabin Baggage", desc: "Carry-on luggage included" },
    { icon: "coffee", label: "In-Flight Refreshments", desc: "Complimentary snacks & beverages" },
    { icon: "zap", label: "USB Power Outlets", desc: "Device charging at every seat" },
  ],
  premium_economy: [
    { icon: "armchair", label: "Extra Legroom 36\" Pitch", desc: "Up to 6 inches of dedicated stretch room" },
    { icon: "luggage", label: "Priority Baggage Handling", desc: "First bags unloaded at baggage carousel" },
    { icon: "coffee", label: "Enhanced Multi-Course Dining", desc: "Chef-selected hot meal options" },
    { icon: "wifi", label: "High-Speed In-Flight Wi-Fi", desc: "Complimentary messaging package" },
  ],
  business: [
    { icon: "armchair", label: "180° Full Lie-Flat Bed", desc: "Spacious direct aisle access pod" },
    { icon: "coffee", label: "Curated Gourmet Menu", desc: "Fine dining with sommelier selections" },
    { icon: "wifi", label: "Full Flight Wi-Fi Access", desc: "Stream, work and browse high speed" },
    { icon: "luggage", label: "Business Lounge Access", desc: "Complimentary lounge before departure" },
  ],
  first: [
    { icon: "armchair", label: "Private Enclosed Suite", desc: "Sliding privacy doors & 80\" flat bed" },
    { icon: "coffee", label: "A La Carte Fine Dining", desc: "Dine on demand with premium cellar" },
    { icon: "wifi", label: "Personal VIP Concierge", desc: "Dedicated flight attendant service" },
    { icon: "luggage", label: "First Class Lounge Access", desc: "Private suites and spa at terminal" },
  ],
}

const CABIN_PRAISE: Record<CabinKey, { title: string; body: string }> = {
  economy: { title: "Smart Standard Selection", body: "Optimal balance of value and high cabin comfort." },
  premium_economy: { title: "Premium Comfort Upgrade", body: "Generous extra legroom and priority boarding privileges." },
  business: { title: "Executive Class Reserved", body: "Traveling in maximum luxury with lie-flat relaxation." },
  first: { title: "First Class Suite Reserved", body: "The pinnacle of private aviation comfort in the sky." },
}

const PAX_COLORS = [
  { ring: "border-cyan-400",   bg: "bg-cyan-400/10",   text: "text-cyan-300",   badge: "bg-cyan-400/20 text-cyan-200 border-cyan-400/30",   dot: "bg-cyan-400",   glow: "shadow-[0_0_18px_rgba(34,211,238,0.35)]"   },
  { ring: "border-amber-400",  bg: "bg-amber-400/10",  text: "text-amber-300",  badge: "bg-amber-400/20 text-amber-200 border-amber-400/30",  dot: "bg-amber-400",  glow: "shadow-[0_0_18px_rgba(251,191,36,0.35)]"  },
  { ring: "border-violet-400", bg: "bg-violet-400/10", text: "text-violet-300", badge: "bg-violet-400/20 text-violet-200 border-violet-400/30", dot: "bg-violet-400", glow: "shadow-[0_0_18px_rgba(167,139,250,0.35)]" },
  { ring: "border-emerald-400",bg: "bg-emerald-400/10",text: "text-emerald-300",badge: "bg-emerald-400/20 text-emerald-200 border-emerald-400/30",dot: "bg-emerald-400",glow: "shadow-[0_0_18px_rgba(52,211,153,0.35)]"  },
]

function paxColor(index: number) {
  return PAX_COLORS[index % PAX_COLORS.length]
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function SeatSelectionPage() {
  const router = useRouter()

  const [selection, setSelection] = useState<CheckoutSelection | null>(null)
  const [loadState, setLoadState] = useState<"loading" | "found" | "missing">("loading")

  const [legs, setLegs] = useState<LegSeatMap[]>([])
  const [legsLoading, setLegsLoading] = useState(true)
  const [legsError, setLegsError] = useState<string | null>(null)

  const [fetchedPassengers, setFetchedPassengers] = useState<StoredPassenger[] | null>(null)

  const [activeLegIndex, setActiveLegIndex] = useState(0)
  const [activePassengerIndex, setActivePassengerIndex] = useState(0)
  const [picks, setPicks] = useState<SelectionMap>({})
  const [activeCabin, setActiveCabin] = useState<CabinKey>("economy")
  const [zoom, setZoom] = useState(100)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [skipModalOpen, setSkipModalOpen] = useState(false)
  const [skipStep, setSkipStep] = useState<"cabin" | "mode" | "error">("cabin")
  const [skipCabin, setSkipCabin] = useState<CabinKey>("economy")
  const [skipErrorMessage, setSkipErrorMessage] = useState<string | null>(null)
  const [skipPartialNote, setSkipPartialNote] = useState<string | null>(null)

  // 1. Load checkout selection from storage or support demo=1 query parameter
  useEffect(() => {
    try {
      let raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw && typeof window !== "undefined" && window.location.search.includes("demo=1")) {
        const mockSelection: CheckoutSelection = {
          bookingId: "demo-booking-123",
          departFlight: {
            id: "54d600c7-aca1-4aa9-897e-43d433f827c7",
            flight_instance_id: "54d600c7-aca1-4aa9-897e-43d433f827c7",
            airline: "Akasa Air",
            origin: "DEL",
            destination: "BLR",
            departure_time: "21:15",
            arrival_time: "00:00",
            aircraft: "A320",
            stops: 0,
            final_price: 5104,
            duration: "2h 45m",
            travel_date: "2026-10-19",
          },
          returnFlight: {
            id: "261d2701-4de0-4cc4-8853-1dac9bbb3421",
            flight_instance_id: "261d2701-4de0-4cc4-8853-1dac9bbb3421",
            airline: "Akasa Air",
            origin: "BLR",
            destination: "DEL",
            departure_time: "07:30",
            arrival_time: "10:15",
            aircraft: "A320",
            stops: 0,
            final_price: 5104,
            duration: "2h 45m",
            travel_date: "2026-10-24",
          },
          passengers: 1,
          mode: "roundtrip",
          totalPrice: 10208,
          origin: "DEL",
          destination: "BLR",
          savedAt: Date.now(),
          savedPassengers: [
            {
              id: "pax-1",
              first_name: "Shreya",
              last_name: "viralam",
              passenger_type: "adult",
              is_primary_contact: true,
            },
          ],
        }
        raw = JSON.stringify(mockSelection)
        sessionStorage.setItem(STORAGE_KEY, raw)
      }

      if (!raw) { setLoadState("missing"); return }
      const parsed = JSON.parse(raw) as CheckoutSelection
      if (!parsed.bookingId) { setLoadState("missing"); return }

      setSelection(parsed)
      setLoadState("found")
    } catch (err) {
      console.error("Failed to read checkout selection:", err)
      setLoadState("missing")
    }
  }, [])

  // 2. Fetch passengers for booking
  useEffect(() => {
    if (loadState !== "found" || !selection?.bookingId) return

    if (selection.bookingId === "demo-booking-123" && selection.savedPassengers) {
      setFetchedPassengers(selection.savedPassengers)
      return
    }

    let cancelled = false
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

    fetch(`/api/bookings/${selection.bookingId}/passengers`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        const rows: StoredPassenger[] | undefined = data.passengers ?? data
        if (Array.isArray(rows) && rows.length) {
          setFetchedPassengers(rows)
        }
      })
      .catch((err) => console.warn("[seats] passenger fetch failed:", err))

    return () => {
      cancelled = true
    }
  }, [loadState, selection])

  // 3. Fetch seat maps for departure and return legs
  useEffect(() => {
    if (loadState !== "found" || !selection) return

    const fetchLegs = async () => {
      setLegsLoading(true)
      setLegsError(null)

      const legsToFetch: { flight: StoredFlight; label: string }[] = [
        { flight: selection.departFlight, label: "Departure" },
      ]
      if (selection.returnFlight) {
        legsToFetch.push({ flight: selection.returnFlight, label: "Return" })
      }

      try {
        const results = await Promise.all(
          legsToFetch.map(async ({ flight, label }) => {
            const instanceId = String(flight.flight_instance_id ?? flight.id)

            const res = await fetch(
              `/api/flights/${instanceId}/seats?bookingId=${selection.bookingId}`
            )
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || `Failed to load seats for ${label.toLowerCase()} flight`)

            return {
              flightInstanceId: instanceId,
              flight,
              label,
              seats: data.seats as ApiSeat[],
              hasSeatMap: data.hasSeatMap as boolean,
            }
          })
        )

        setLegs(results)

        if (results[0]?.seats?.length) {
          const firstCabin = results[0].seats[0].cabinClass as CabinKey
          if (firstCabin) setActiveCabin(firstCabin)
        }

        setPicks((prev) => {
          const next = { ...prev }
          results.forEach((leg, legIndex) => {
            leg.seats.forEach((seat) => {
              if (seat.isMine && seat.myPassengerId) {
                next[`${legIndex}:${seat.myPassengerId}`] = seat.id
              }
            })
          })
          return next
        })
      } catch (err: any) {
        console.error("Failed to fetch seat maps:", err)
        setLegsError(err?.message || "Couldn't load seat maps. Please try again.")
      } finally {
        setLegsLoading(false)
      }
    }

    fetchLegs()
  }, [loadState, selection])

  const passengers: StoredPassenger[] = useMemo(() => {
    if (fetchedPassengers?.length) return fetchedPassengers
    if (selection?.savedPassengers?.length) return selection.savedPassengers
    const count = selection?.passengers || 1
    return Array.from({ length: count }, (_, i) => ({
      id: `passenger-${i}`,
      first_name: "Passenger",
      last_name: `${i + 1}`,
      passenger_type: "adult",
    }))
  }, [selection, fetchedPassengers])

  const activeLeg = legs[activeLegIndex]
  const activePassenger = passengers[activePassengerIndex]

  const visibleSeats = useMemo(() => {
    if (!activeLeg) return []
    return activeLeg.seats.filter((s) => s.cabinClass === activeCabin)
  }, [activeLeg, activeCabin])

  const availableCabins = useMemo(() => {
    if (!activeLeg) return [...CABIN_CLASSES]
    const found = new Set(activeLeg.seats.map((s) => s.cabinClass))
    const filtered = CABIN_CLASSES.filter((c) => found.has(c.key))
    return filtered.length ? filtered : [...CABIN_CLASSES]
  }, [activeLeg])

  const cheapestInCabin = useMemo(() => {
    const priced = visibleSeats.filter((s) => s.price > 0)
    if (!priced.length) return null
    return Math.min(...priced.map((s) => s.price))
  }, [visibleSeats])

  const totalSeatPrice = useMemo(() => {
    let total = 0
    legs.forEach((leg, legIndex) => {
      passengers.forEach((p) => {
        const seatId = picks[`${legIndex}:${p.id}`]
        const seat = leg.seats.find((s) => s.id === seatId)
        if (seat) total += seat.price
      })
    })
    return Math.round(total)
  }, [legs, passengers, picks])

  const seatsSelectedCount = useMemo(() => {
    if (!activeLeg) return 0
    return passengers.filter((p) => !!picks[`${activeLegIndex}:${p.id}`]).length
  }, [activeLeg, activeLegIndex, passengers, picks])

  const allSeatsAssigned = useMemo(() => {
    return legs
      .map((leg, i) => ({ leg, i }))
      .filter(({ leg }) => leg.hasSeatMap)
      .every(({ i }) => passengers.every((p) => !!picks[`${i}:${p.id}`]))
  }, [legs, passengers, picks])

  function selectSeat(seat: ApiSeat) {
    if (!seat.isAvailable) return
    const key = `${activeLegIndex}:${activePassenger.id}`

    setPicks((prev) => {
      const next = { ...prev }
      Object.keys(next).forEach((k) => {
        if (k.startsWith(`${activeLegIndex}:`) && next[k] === seat.id) delete next[k]
      })
      next[key] = seat.id

      const nextPaxIdx = passengers.findIndex(
        (p, i) => i > activePassengerIndex && !next[`${activeLegIndex}:${p.id}`]
      )
      if (nextPaxIdx !== -1) {
        setActivePassengerIndex(nextPaxIdx)
      } else if (activeLegIndex < legs.length - 1) {
        setActiveLegIndex(activeLegIndex + 1)
        setActivePassengerIndex(0)
      }
      return next
    })
  }

  function clearSeat(passengerId: string) {
    setPicks((prev) => {
      const next = { ...prev }
      delete next[`${activeLegIndex}:${passengerId}`]
      return next
    })
  }

  function pickedSeatIdsForLeg(source: SelectionMap, legIndex: number): Set<string> {
    const ids = new Set<string>()
    Object.entries(source).forEach(([key, seatId]) => {
      if (key.startsWith(`${legIndex}:`)) ids.add(seatId)
    })
    return ids
  }

  function passengersMissingSeat(source: SelectionMap, legIndex: number): StoredPassenger[] {
    return passengers.filter((p) => !source[`${legIndex}:${p.id}`])
  }

  function checkCabinAvailability(cabin: CabinKey): string | null {
    for (const [legIndex, leg] of legs.entries()) {
      if (!leg.hasSeatMap) continue
      const missing = passengersMissingSeat(picks, legIndex)
      if (!missing.length) continue
      const claimed = pickedSeatIdsForLeg(picks, legIndex)
      const free = leg.seats.filter((s) => s.cabinClass === cabin && s.isAvailable && !claimed.has(s.id))
      if (free.length < missing.length) {
        const cabinLabel = CABIN_CLASSES.find((c) => c.key === cabin)?.label ?? cabin
        return `Only ${free.length} ${cabinLabel} seat${free.length === 1 ? "" : "s"} left on the ${leg.label.toLowerCase()} flight, but ${missing.length} passenger${missing.length === 1 ? "" : "s"} still need${missing.length === 1 ? "s" : ""} one.`
      }
    }
    return null
  }

  function shuffleArray<T>(arr: T[]): T[] {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }

  function findTogetherBlock(cabinSeats: ApiSeat[], claimed: Set<string>, count: number): ApiSeat[] | null {
    const byRow = new Map<number, ApiSeat[]>()
    cabinSeats.forEach((s) => {
      const arr = byRow.get(s.row) || []
      arr.push(s)
      byRow.set(s.row, arr)
    })
    const rowEntries = shuffleArray(Array.from(byRow.entries()))
    for (const [, rowSeats] of rowEntries) {
      const sorted = [...rowSeats].sort((a, b) => a.col.localeCompare(b.col))
      const groups = shuffleArray(groupByAisle(sorted))
      for (const group of groups) {
        for (let start = 0; start <= group.length - count; start++) {
          const slice = group.slice(start, start + count)
          if (slice.every((s) => s.isAvailable && !claimed.has(s.id))) return slice
        }
      }
    }
    return null
  }

  function runAutoAssign(cabin: CabinKey, mode: "random" | "together") {
    let anyPartial = false

    setPicks((prev) => {
      const next = { ...prev }

      legs.forEach((leg, legIndex) => {
        if (!leg.hasSeatMap) return
        const missing = passengersMissingSeat(next, legIndex)
        if (!missing.length) return

        const claimed = pickedSeatIdsForLeg(next, legIndex)
        const cabinSeats = leg.seats.filter((s) => s.cabinClass === cabin)

        let assigned: ApiSeat[] = []

        if (mode === "together") {
          const block = findTogetherBlock(cabinSeats, claimed, missing.length)
          if (block) assigned = block
          else anyPartial = true
        }

        if (assigned.length < missing.length) {
          const usedIds = new Set(assigned.map((s) => s.id))
          const pool = shuffleArray(
            cabinSeats.filter((s) => s.isAvailable && !claimed.has(s.id) && !usedIds.has(s.id))
          )
          assigned = [...assigned, ...pool.slice(0, missing.length - assigned.length)]
        }

        missing.forEach((p, i) => {
          const seat = assigned[i]
          if (seat) next[`${legIndex}:${p.id}`] = seat.id
        })
      })

      return next
    })

    setActiveCabin(cabin)
    setSkipPartialNote(
      anyPartial ? "Couldn't fit everyone in one row on every leg — closest available seats were used instead." : null
    )
    setSkipModalOpen(false)
  }

  function openSkipModal() {
    setSkipCabin(activeCabin)
    setSkipErrorMessage(null)
    setSkipStep("cabin")
    setSkipModalOpen(true)
  }

  function handleSkipCheck() {
    const reason = checkCabinAvailability(skipCabin)
    if (reason) {
      setSkipErrorMessage(reason)
      setSkipStep("error")
    } else {
      setSkipStep("mode")
    }
  }

  async function handleEditFlight() {
    if (!selection?.bookingId) {
      if (selection) router.push(buildFlightSearchUrl(selection))
      return
    }
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
      await fetch(`/api/bookings/${selection.bookingId}/seats`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    } catch (err) {
      console.warn("Failed to release held seats before editing flight:", err)
    }
    router.push(buildFlightSearchUrl(selection))
  }

  async function handleContinue() {
    if (submitting || !selection?.bookingId || !allSeatsAssigned) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      const payload = {
        legs: legs
          .map((leg, originalIndex) => ({ leg, originalIndex }))
          .filter(({ leg }) => leg.hasSeatMap)
          .map(({ leg, originalIndex }) => ({
            flightInstanceId: leg.flightInstanceId,
            seats: passengers
              .map((p) => {
                const seatId = picks[`${originalIndex}:${p.id}`]
                const seat = leg.seats.find((s) => s.id === seatId)
                if (!seat) return null
                return { passengerId: p.id, seatId: seat.id, seatNumber: seat.seatNumber, price: Math.round(seat.price) }
              })
              .filter((s): s is NonNullable<typeof s> => s !== null),
          })),
      }

      if (payload.legs.every((l) => l.seats.length === 0)) {
        router.push("/checkout/addons")
        return
      }

      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
      const res = await fetch(`/api/bookings/${selection.bookingId}/seats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data?.error || "Couldn't save your seat selection. Please try again.")
        if (data?.conflict) {
          setLegsLoading(true)
          const refreshed = await Promise.all(
            legs.map(async (leg) => {
              const r = await fetch(`/api/flights/${leg.flightInstanceId}/seats?bookingId=${selection.bookingId}`)
              const d = await r.json()
              return { ...leg, seats: d.seats as ApiSeat[], hasSeatMap: d.hasSeatMap }
            })
          )
          setLegs(refreshed)
          setLegsLoading(false)
        }
        setSubmitting(false)
        return
      }

      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...selection, holdExpiresAt: data.holdExpiresAt, seatSelectionPrice: data.seatSelectionPrice ?? totalSeatPrice })
      )
      router.push("/checkout/addons")
    } catch (err) {
      console.error("Failed to save seat selection:", err)
      setSubmitError("Something went wrong saving your seats. Please try again.")
      setSubmitting(false)
    }
  }

  if (loadState === "loading") {
    return (
      <PageShell>
        <CenteredMessage text="Initializing cockpit telemetry & seat map…" />
      </PageShell>
    )
  }

  if (loadState === "missing" || !selection) {
    return (
      <PageShell>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-amber-300">
            <Ticket className="w-7 h-7" />
          </div>
          <p className="text-slate-300 font-display font-bold text-lg">We couldn't find an active booking session</p>
          <p className="text-sm text-slate-500 max-w-md">Please complete passenger details or start a fresh flight search to assign seats.</p>
          <button
            onClick={() => router.push("/checkout/passengers")}
            className="px-6 py-3 rounded-full gold-cta font-semibold text-sm mt-2 flex items-center gap-2 cursor-pointer"
          >
            <span>Go to Passenger Details</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </PageShell>
    )
  }

  if (legsLoading) {
    return (
      <PageShell selection={selection} router={router}>
        <CenteredMessage text="Loading live aircraft cabin layout…" />
      </PageShell>
    )
  }

  if (legsError) {
    return (
      <PageShell selection={selection} router={router}>
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-center px-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-300">
            <AlertCircle className="w-7 h-7" />
          </div>
          <p className="text-slate-300 font-display font-bold text-lg">{legsError}</p>
          <button
            onClick={() => router.refresh()}
            className="px-6 py-2.5 rounded-full bg-white/10 text-white font-medium hover:bg-white/15 transition-all text-sm cursor-pointer"
          >
            Try again
          </button>
        </div>
      </PageShell>
    )
  }

  const cabinMeta = CABIN_CLASSES.find((c) => c.key === activeCabin)
  const activeLegFlight = legs[activeLegIndex]?.flight ?? selection.departFlight
  const isRoundTrip = legs.length > 1

  return (
    <PageShell selection={selection} router={router}>
      {/* 1. AEROSPACE LEG SELECTOR DECK (Only if roundtrip) */}
      {isRoundTrip && (
        <div className="mb-4">
          <LegSelectorDeck
            legs={legs}
            activeIndex={activeLegIndex}
            onChangeIndex={setActiveLegIndex}
            passengers={passengers}
            picks={picks}
          />
        </div>
      )}

      {/* 2. LUXURY BOARDING PASS TICKET STUB FLIGHT HEADER */}
      <FlightTicketHeader
        flight={activeLegFlight}
        legLabel={legs[activeLegIndex]?.label ?? (isRoundTrip ? "Departure" : undefined)}
        isReturn={activeLegIndex === 1}
        onEditFlight={handleEditFlight}
      />

      {/* 3. THREE-COLUMN COCKPIT SEAT SELECTION LAYOUT */}
      <div className="grid grid-cols-12 gap-6 mt-6">
        {/* LEFT COLUMN: Cabin Tiers & Aircraft Specs */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <CabinClassRail
            cabins={availableCabins}
            active={activeCabin}
            onChange={setActiveCabin}
          />
          <AircraftCockpitHudCard flight={activeLegFlight} activeCabin={activeCabin} />
        </div>

        {/* CENTER COLUMN: Aircraft Cabin Fuselage & Seat Map */}
        <div className="col-span-12 lg:col-span-6 space-y-4">
          {activeLeg && !activeLeg.hasSeatMap ? (
            <NoSeatMapCard />
          ) : activeLeg && visibleSeats.length === 0 ? (
            <EmptyCabinCard cabinLabel={cabinMeta?.label ?? activeCabin} />
          ) : activeLeg ? (
            <SeatMapCard
              leg={activeLeg}
              visibleSeats={visibleSeats}
              picks={picks}
              activeLegIndex={activeLegIndex}
              activePassenger={activePassenger}
              activePassengerIndex={activePassengerIndex}
              passengers={passengers}
              activeCabin={activeCabin}
              cabinLabel={cabinMeta?.label ?? "Cabin"}
              cheapestInCabin={cheapestInCabin}
              seatsSelectedCount={seatsSelectedCount}
              totalPassengers={passengers.length}
              zoom={zoom}
              onZoomChange={setZoom}
              onSelectSeat={selectSeat}
            />
          ) : null}
        </div>

        {/* RIGHT COLUMN: Reservation Manifest & Total Price */}
        <div className="col-span-12 lg:col-span-3">
          <SeatSummary
            legs={legs}
            passengers={passengers}
            picks={picks}
            activeLegIndex={activeLegIndex}
            activePassengerIndex={activePassengerIndex}
            activeCabin={activeCabin}
            totalSeatPrice={totalSeatPrice}
            allSeatsAssigned={allSeatsAssigned}
            submitting={submitting}
            submitError={submitError}
            onSelectPassenger={setActivePassengerIndex}
            onClearSeat={clearSeat}
            onContinue={handleContinue}
            onSkip={openSkipModal}
          />
        </div>
      </div>

      {/* Helper floating note if auto-assignment was partial */}
      {skipPartialNote && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-[#0D1A2C] border border-[#D4AF37]/40 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <span className="text-amber-400 text-base shrink-0">⚠</span>
          <p className="text-xs text-slate-200">{skipPartialNote}</p>
          <button
            onClick={() => setSkipPartialNote(null)}
            className="ml-3 text-slate-500 hover:text-white text-xs cursor-pointer"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Skip / Auto-Assign Modal */}
      {skipModalOpen && (
        <SkipSeatModal
          step={skipStep}
          cabin={skipCabin}
          errorMessage={skipErrorMessage}
          onCabinChange={setSkipCabin}
          onCheck={handleSkipCheck}
          onBackToCabin={() => setSkipStep("cabin")}
          onChooseMode={(mode) => runAutoAssign(skipCabin, mode)}
          onClose={() => setSkipModalOpen(false)}
        />
      )}
    </PageShell>
  )
}

// ---------------------------------------------------------------------------
// 1. LegSelectorDeck — Sleek Aerospace Switcher (Replaces loud yellow pill)
// ---------------------------------------------------------------------------

function LegSelectorDeck({
  legs,
  activeIndex,
  onChangeIndex,
  passengers,
  picks,
}: {
  legs: LegSeatMap[]
  activeIndex: number
  onChangeIndex: (i: number) => void
  passengers: StoredPassenger[]
  picks: SelectionMap
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-1.5 rounded-2xl bg-[#0B1526]/80 border border-white/[0.08] backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.35)] w-fit">
      {legs.map((leg, i) => {
        const isActive = activeIndex === i
        const isReturn = i === 1
        const assignedCount = passengers.filter((p) => !!picks[`${i}:${p.id}`]).length
        const isComplete = assignedCount === passengers.length

        return (
          <button
            key={leg.flightInstanceId}
            onClick={() => onChangeIndex(i)}
            className={`group relative flex items-center gap-3.5 px-5 py-2.5 rounded-xl border transition-all duration-300 cursor-pointer ${
              isActive
                ? "bg-gradient-to-r from-[#11223B] via-[#0F1D33] to-[#0D1829] border-[#D4AF37]/80 shadow-[0_0_24px_rgba(212,175,55,0.22)]"
                : "border-transparent bg-transparent hover:bg-white/[0.03] hover:border-white/10"
            }`}
          >
            {/* Active Aura Spotlight */}
            {isActive && (
              <span
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-400/[0.08] to-cyan-400/[0.05] pointer-events-none"
                aria-hidden
              />
            )}

            {/* Radar status beacon */}
            <div className="relative flex items-center justify-center shrink-0">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isComplete
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                    : isActive
                    ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                    : "bg-slate-600"
                }`}
              />
            </div>

            {/* Route & Leg Telemetry */}
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isActive ? "text-amber-300" : "text-slate-400"
                  }`}
                >
                  {leg.label} Leg
                </span>
                <span className="text-slate-600 text-xs">•</span>
                <span
                  className={`font-display font-black text-sm tracking-tight ${
                    isActive ? "text-white" : "text-slate-300 group-hover:text-white"
                  }`}
                >
                  {leg.flight.origin} → {leg.flight.destination}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isComplete ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3 inline" /> Seats Assigned ({assignedCount}/{passengers.length})
                  </span>
                ) : (
                  <span className={isActive ? "text-amber-300/80" : "text-slate-500"}>
                    {assignedCount} of {passengers.length} assigned
                  </span>
                )}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2. FlightTicketHeader — Boarding Pass Ticket Stub Architecture
// ---------------------------------------------------------------------------

function FlightTicketHeader({
  flight,
  legLabel,
  isReturn,
  onEditFlight,
}: {
  flight: StoredFlight
  legLabel?: string
  isReturn?: boolean
  onEditFlight?: () => void
}) {
  const originCity = AIRPORT_CITIES[flight.origin] || flight.origin
  const destCity = AIRPORT_CITIES[flight.destination] || flight.destination
  const logo = airlineLogos[flight.airline] || "/airlines/default.png"
  const flightNum = (flight as any).flight_number || "NAV-420"

  return (
    <div className="relative bg-gradient-to-r from-[#0C1729]/95 via-[#0E1C33]/95 to-[#091220]/95 border border-white/[0.12] rounded-2xl p-4 sm:px-6 sm:py-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl ticket-edge overflow-hidden">
      {/* Signature Livery Strip */}
      <div
        className={`absolute top-0 bottom-0 left-0 w-1.5 bg-gradient-to-b ${
          isReturn ? "from-cyan-400 via-blue-500 to-indigo-500" : "from-amber-300 via-amber-400 to-amber-600"
        }`}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Airline Branding & Model */}
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden shadow-md ring-1 ring-white/10 shrink-0 p-1">
            <img src={logo} alt={flight.airline} className="w-7 h-7 object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-display font-black text-sm sm:text-base text-white tracking-tight">{flight.airline}</p>
              <span className="font-mono text-[10px] font-bold text-slate-300 bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/[0.08]">
                {flightNum}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {flight.aircraft} <span className="text-slate-600">•</span> Airbus Single-Aisle
            </p>
          </div>
        </div>

        {/* Center: Route Telemetry & Serene Flight Vector (No disturbing animation) */}
        <div className="flex items-center gap-4 sm:gap-6 flex-1 justify-center max-w-xl">
          {/* Origin */}
          <div className="text-left shrink-0">
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
              {originCity}
            </p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-display text-xl sm:text-2xl font-black text-white tabular-nums">
                {flight.origin}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-slate-300 tabular-nums">
                {formatTime(flight.departure_time)}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
              {formatDateLabel(flight.departure_time, flight.travel_date) || "Mon, 19 Oct"}
            </p>
          </div>

          {/* Timeline Vector — Serene & Clean without disturbing animations */}
          <div className="flex flex-col items-center flex-1 max-w-[200px] px-2">
            <span className="text-[10.5px] text-slate-300 font-extrabold tracking-wide mb-1 font-mono">
              {formatDuration(flight)}
            </span>
            <div className="flex items-center w-full max-w-[170px] gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-cyan-400/20 shrink-0" />
              <div className="h-[2px] flex-1 bg-gradient-to-r from-cyan-400/60 via-amber-400/80 to-amber-400/60 rounded-full" />
              <span aria-hidden className="text-amber-300 text-xs shrink-0 select-none">✈</span>
              <div className="h-[2px] flex-1 bg-gradient-to-r from-amber-400/60 via-emerald-400/80 to-emerald-400/60 rounded-full" />
              <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20 shrink-0" />
            </div>
            <span className="text-[9.5px] text-emerald-400 font-bold mt-1 uppercase tracking-wider">
              {(flight.stops ?? 0) > 0 ? `${flight.stops} Stop` : "Nonstop"}
            </span>
          </div>

          {/* Destination */}
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
              {destCity}
            </p>
            <div className="flex items-baseline justify-end gap-1 mt-0.5">
              <span className="font-display text-xl sm:text-2xl font-black text-white tabular-nums">
                {flight.destination}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-slate-300 tabular-nums">
                {formatTime(flight.arrival_time)}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
              {formatDateLabel(flight.arrival_time, flight.travel_date) || "Mon, 19 Oct"}
            </p>
          </div>
        </div>

        {/* Right: Leg Pill & Edit Flight CTA */}
        <div className="flex items-center gap-2.5 ml-auto">
          {legLabel && (
            <span
              className={`text-[10px] uppercase tracking-wider font-black rounded-full px-3 py-1 border flex items-center gap-1.5 ${
                isReturn
                  ? "text-cyan-300 bg-cyan-400/15 border-cyan-400/30"
                  : "text-amber-300 bg-amber-400/15 border-amber-400/30"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isReturn ? "bg-cyan-400" : "bg-amber-400"}`} />
              {legLabel}
            </span>
          )}
          <button
            onClick={onEditFlight}
            className="text-xs text-slate-300 hover:text-white transition-all flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 hover:border-amber-400/40 bg-white/[0.04] hover:bg-white/[0.08] cursor-pointer"
          >
            <span>Edit flight</span>
            <span aria-hidden>✎</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3. CabinClassRail — Cockpit Flight Deck Class Controller (Left Column)
// ---------------------------------------------------------------------------

function CabinClassRail({
  cabins,
  active,
  onChange,
}: {
  cabins: readonly (typeof CABIN_CLASSES)[number][]
  active: CabinKey
  onChange: (k: CabinKey) => void
}) {
  return (
    <div className="relative bg-gradient-to-b from-[#0C1729]/95 to-[#091220]/95 border border-white/[0.1] rounded-2xl p-4 shadow-[0_12px_32px_rgba(0,0,0,0.35)] ticket-edge">
      <div className="flex items-center justify-between mb-1">
        <p className="font-display text-sm font-bold text-white tracking-wide">Choose Your Tier</p>
        <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400/80">I → IV</span>
      </div>
      <p className="text-[11px] text-slate-400 mb-3.5">Select cabin to view corresponding seat map</p>

      <div className="space-y-1.5">
        {cabins.map((c) => {
          const isActive = active === c.key
          return (
            <button
              key={c.key}
              onClick={() => onChange(c.key)}
              className={`cabin-row group relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-gradient-to-r from-amber-400/[0.12] via-amber-400/[0.06] to-transparent border-[#D4AF37] shadow-[0_0_24px_rgba(212,175,55,0.18)]"
                  : "border-white/[0.06] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
              }`}
            >
              {/* Roman numeral metal badge */}
              <span
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-display text-xs font-black border transition-all ${
                  isActive
                    ? "bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 text-[#060B14] border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.4)]"
                    : "bg-white/[0.04] text-slate-400 border-white/[0.08] group-hover:text-slate-200"
                }`}
              >
                {c.tier}
              </span>

              {/* Title, Pitch & Price */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className={`block text-xs font-bold truncate ${isActive ? "text-white" : "text-slate-300"}`}>
                    {c.label}
                  </span>
                  <span className={`text-[11px] font-mono font-bold tabular-nums ${isActive ? "text-amber-300" : "text-slate-400"}`}>
                    ₹{c.fromPrice.toLocaleString("en-IN")}
                  </span>
                </div>
                <span className={`block text-[10px] mt-0.5 truncate ${isActive ? "text-amber-200/80" : "text-slate-500"}`}>
                  {c.pitch}
                </span>
              </div>

              {/* Active check pill */}
              {isActive && (
                <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-[#060B14] flex items-center justify-center text-[10px] font-bold shrink-0 shadow-sm">
                  ✓
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 4. AircraftCockpitHudCard — Specifications & Cabin Amenities HUD (Left Column)
// ---------------------------------------------------------------------------

function AircraftCockpitHudCard({ flight, activeCabin }: { flight: StoredFlight; activeCabin: CabinKey }) {
  const perks = CABIN_PERKS[activeCabin]

  function renderIcon(icon: string) {
    switch (icon) {
      case "wifi":
        return <Wifi className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
      case "zap":
        return <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      case "armchair":
        return <Armchair className="w-3.5 h-3.5 text-blue-400 shrink-0" />
      case "coffee":
        return <Coffee className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      case "luggage":
        return <Luggage className="w-3.5 h-3.5 text-violet-400 shrink-0" />
      default:
        return <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
    }
  }

  return (
    <div className="relative bg-gradient-to-b from-[#0C1729]/95 to-[#091220]/95 border border-white/[0.1] rounded-2xl p-4 shadow-[0_12px_32px_rgba(0,0,0,0.35)] ticket-edge">
      {/* Aircraft Telemetry Header */}
      <div className="flex items-center gap-3 mb-3 pb-2.5 border-b border-white/[0.08]">
        <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-amber-400 text-sm shrink-0">
          <Plane className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs font-bold text-white tracking-tight">{flight.aircraft || "Airbus A320-200"}</p>
          <p className="text-[10px] text-slate-400 font-mono">Mach 0.82 • 36,000 ft Cruise</p>
        </div>
      </div>

      {/* Perks 2x2 Grid */}
      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
        Cabin Inclusions
      </p>
      <div className="grid grid-cols-2 gap-2">
        {perks.map((perk) => (
          <div key={perk.label} className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center gap-2">
            <div className="shrink-0">{renderIcon(perk.icon)}</div>
            <p className="text-[10px] font-semibold text-slate-200 truncate">{perk.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 5. SeatMapCard — Cinematic Aircraft Cabin Fuselage & Interactive Seats
// ---------------------------------------------------------------------------

function groupByAisle(sortedCols: ApiSeat[]): ApiSeat[][] {
  const groups: ApiSeat[][] = []
  let current: ApiSeat[] = []
  sortedCols.forEach((seat) => {
    current.push(seat)
    if (seat.isAisle) {
      groups.push(current)
      current = []
    }
  })
  if (current.length) groups.push(current)
  return groups
}

function SeatMapCard({
  leg,
  visibleSeats,
  picks,
  activeLegIndex,
  activePassenger,
  activePassengerIndex,
  passengers,
  activeCabin,
  cabinLabel,
  cheapestInCabin,
  seatsSelectedCount,
  totalPassengers,
  zoom,
  onZoomChange,
  onSelectSeat,
}: {
  leg: LegSeatMap
  visibleSeats: ApiSeat[]
  picks: SelectionMap
  activeLegIndex: number
  activePassenger: StoredPassenger
  activePassengerIndex: number
  passengers: StoredPassenger[]
  activeCabin: CabinKey
  cabinLabel: string
  cheapestInCabin: number | null
  seatsSelectedCount: number
  totalPassengers: number
  zoom: number
  onZoomChange: (z: number) => void
  onSelectSeat: (seat: ApiSeat) => void
}) {
  const rows = useMemo(() => {
    const byRow = new Map<number, ApiSeat[]>()
    visibleSeats.forEach((seat) => {
      const arr = byRow.get(seat.row) || []
      arr.push(seat)
      byRow.set(seat.row, arr)
    })
    return Array.from(byRow.entries()).sort((a, b) => a[0] - b[0])
  }, [visibleSeats])

  const seatOwnerMap = useMemo(() => {
    const map: Record<string, number> = {}
    passengers.forEach((p, i) => {
      const seatId = picks[`${activeLegIndex}:${p.id}`]
      if (seatId) map[seatId] = i
    })
    return map
  }, [passengers, picks, activeLegIndex])

  const firstRowSeats = rows[0]?.[1] ?? []
  const sortedCols = [...firstRowSeats].sort((a, b) => a.col.localeCompare(b.col))
  const colGroups = groupByAisle(sortedCols)

  const podSize = activeCabin === "first" ? 92 : activeCabin === "business" ? 72 : 46
  const scaledPod = Math.round(podSize * (zoom / 100))

  return (
    <div className="relative bg-gradient-to-br from-[#0D1A2C] via-[#0B1729] to-[#0A1424] border border-[#D4AF37]/15 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.3)] ticket-edge">
      {/* signature accent bar — the same blue → gold pairing used for the
          "BEST" highlight and "Continue" button on the flights results page,
          so this card reads as part of the same product instead of a bare panel */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-400 via-[#D4AF37] to-[#E8C766]" />

      <div
        className="pointer-events-none absolute -top-24 -left-16 w-72 h-72 bg-blue-500/[0.07] blur-[100px] rounded-full"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-16 w-72 h-72 bg-[#D4AF37]/[0.06] blur-[100px] rounded-full"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative px-5 py-4 border-b border-[#D4AF37]/10 bg-white/[0.02]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center text-[#E8C766] text-xs shrink-0">
              ⛶
            </span>
            <p className="font-display text-base font-semibold text-white">{cabinLabel}</p>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-blue-300 bg-blue-500/[0.1] border border-blue-400/25 rounded-full px-3 py-1">
            <span aria-hidden>ⓘ</span> Tap a seat to view details
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <LegendChip variant="available" label="Available" />
          <LegendChip variant="selected" label="Selected" />
          <LegendChip variant="booked" label="Booked" />
          <LegendChip variant="locked" label="Locked" price={cheapestInCabin ?? undefined} />
        </div>
      </div>

      {/* Aerodynamic Cockpit Nose Cone & Forward Cabin Header */}
      <div className="relative flex flex-col items-center pt-5 pb-2">
        <div className="relative w-40 h-12 flex flex-col items-center justify-center border-t border-x border-[#D4AF37]/30 rounded-t-full bg-gradient-to-b from-[#D4AF37]/[0.08] to-transparent shadow-[inset_0_3px_10px_rgba(212,175,55,0.06)]">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="text-[9px] uppercase font-bold tracking-widest text-[#E8C766]">Cockpit Deck</span>
          </div>
          <span className="text-[9px] font-mono text-slate-400">HEADING 184° • A320</span>
          {/* Subtle windshield contour */}
          <div className="absolute top-1 w-20 h-0.5 rounded-full bg-cyan-400/30 blur-[1px]" />
        </div>

        {/* Forward Galley & Lavatory Indicators */}
        <div className="flex items-center justify-between w-60 pt-1.5 text-[10px] text-slate-400 font-medium border-b border-white/[0.06] pb-1.5">
          <span className="flex items-center gap-1 text-slate-400">🚻 FWD Lavatory</span>
          <span className="text-[#D4AF37]/80 font-mono text-[9px] font-bold">▲ FORWARD ▲</span>
          <span className="flex items-center gap-1 text-slate-400">🍽 FWD Galley</span>
        </div>
      </div>

      <div className="relative flex justify-center pb-3 overflow-x-auto">
        <div className="flex items-center gap-8" style={{ paddingLeft: 28 }}>
          {colGroups.map((group, gi) => (
            <div key={gi} className="flex items-center gap-2" style={{ gap: Math.max(6, scaledPod * 0.12) }}>
              {group.map((s) => (
                <span
                  key={s.col}
                  className="inline-flex items-center justify-center rounded-md bg-white/[0.04] border border-white/[0.06] text-[10px] font-semibold text-[#C9A227]/80 tracking-wide"
                  style={{ width: scaledPod, height: 18 }}
                >
                  {s.col}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="relative px-5 pb-6 overflow-x-auto">
        <div className="pointer-events-none absolute top-0 bottom-6 left-1 w-3 rounded-full bg-gradient-to-b from-white/[0.05] via-white/[0.02] to-white/[0.05] border border-white/[0.06] hidden sm:block" />
        <div className="pointer-events-none absolute top-0 bottom-6 right-1 w-3 rounded-full bg-gradient-to-b from-white/[0.05] via-white/[0.02] to-white/[0.05] border border-white/[0.06] hidden sm:block" />

        <div className="flex flex-col items-center gap-2.5" style={{ gap: Math.max(9, scaledPod * 0.16) }}>
          {rows.map(([rowNum, rowSeats], rowIdx) => {
            const sorted = [...rowSeats].sort((a, b) => a.col.localeCompare(b.col))
            const groups = groupByAisle(sorted)
            const isExitRow = rowNum === 12 || rowNum === 14
            return (
              <div key={rowNum} className="flex flex-col items-center">
                {isExitRow && (
                  <div className="flex items-center justify-center gap-2 my-1 py-0.5 px-3 rounded-md bg-[#D4AF37]/[0.07] border border-[#D4AF37]/25 mb-1.5">
                    <span className="text-[#E8C766] text-[10px]">🚪</span>
                    <span className="text-[9px] font-bold text-[#E8C766] uppercase tracking-widest font-mono">
                      Overwing Emergency Exit • Extra Legroom
                    </span>
                    <span className="text-[#E8C766] text-[10px]">🚪</span>
                  </div>
                )}
                <div
                  className={`flex items-center gap-8 rounded-xl ${rowIdx % 2 === 0 ? "bg-white/[0.012]" : ""}`}
                  style={{ paddingBlock: Math.max(2, scaledPod * 0.04) }}
                >
                  <span className="w-5 text-right text-[11px] text-[#C9A227]/60 font-display tabular-nums shrink-0">{rowNum}</span>
                  {groups.map((group, gi) => (
                    <div key={gi} className="flex items-center" style={{ gap: Math.max(6, scaledPod * 0.12) }}>
                      {group.map((seat) => {
                        const ownerIdx = seatOwnerMap[seat.id]
                        const isMe = picks[`${activeLegIndex}:${activePassenger.id}`] === seat.id
                        const isOtherPax = ownerIdx !== undefined && !isMe
                        const color = ownerIdx !== undefined ? paxColor(ownerIdx) : null

                        return (
                          <GoldSeatPod
                            key={seat.id}
                            seat={seat}
                            size={scaledPod}
                            cabin={activeCabin}
                            isMe={isMe}
                            isOtherPax={isOtherPax}
                            color={color}
                            onClick={() => onSelectSeat(seat)}
                          />
                        )
                      })}
                    </div>
                  ))}
                  <span className="w-5 text-left text-[11px] text-[#C9A227]/60 font-display tabular-nums shrink-0">{rowNum}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between mt-8 px-6 text-[10px] text-slate-400 font-medium border-t border-white/[0.06] pt-3">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span>🚻</span> AFT Lavatory
          </span>
          <span className="text-slate-500 font-mono text-[9px]">▼ AFT ▼</span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span>🚪</span> AFT Exit
          </span>
        </div>
      </div>

      <div className="relative flex items-center justify-between px-5 py-3 border-t border-[#D4AF37]/10 bg-white/[0.015]">
        <p className="text-[11px] text-slate-500">
          <span className={seatsSelectedCount === totalPassengers ? "text-emerald-300" : "text-[#E8C766]"}>
            {seatsSelectedCount} of {totalPassengers}
          </span>{" "}
          seats selected
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onZoomChange(Math.max(70, zoom - 10))}
            className="w-7 h-7 rounded-md border border-white/10 text-slate-300 hover:bg-white/5 flex items-center justify-center text-sm"
          >
            −
          </button>
          <span className="text-xs text-slate-400 w-10 text-center tabular-nums">{zoom}%</span>
          <button
            onClick={() => onZoomChange(Math.min(150, zoom + 10))}
            className="w-7 h-7 rounded-md border border-white/10 text-slate-300 hover:bg-white/5 flex items-center justify-center text-sm"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}

function SeatIcon({ size, className, filled = false }: { size: number; className?: string; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M7.5 4.75C7.5 3.78 8.28 3 9.25 3h5.5c.97 0 1.75.78 1.75 1.75V12h1.75A1.75 1.75 0 0120 13.75v2.5a1 1 0 01-1 1h-1v1.75a.5.5 0 01-1 0V17.25H7v1.75a.5.5 0 01-1 0V17.25H5a1 1 0 01-1-1v-2.5A1.75 1.75 0 015.75 12H7.5V4.75z"
        fill={filled ? "currentColor" : "none"}
        fillOpacity={filled ? 1 : 0}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function GoldSeatPod({
  seat,
  size,
  cabin,
  isMe,
  isOtherPax,
  color,
  onClick,
}: {
  seat: ApiSeat
  size: number
  cabin: CabinKey
  isMe: boolean
  isOtherPax: boolean
  color: (typeof PAX_COLORS)[number] | null
  onClick: () => void
}) {
  const taken = !seat.isAvailable

  if (cabin === "first") {
    return (
      <IllustratedSeatPod
        seat={seat}
        size={size}
        taken={taken}
        isMe={isMe}
        isOtherPax={isOtherPax}
        color={color}
        onClick={onClick}
      />
    )
  }

  if (cabin === "business") {
    return (
      <BusinessSeatPod
        seat={seat}
        size={size}
        taken={taken}
        isMe={isMe}
        isOtherPax={isOtherPax}
        color={color}
        onClick={onClick}
      />
    )
  }

  const iconSize = Math.max(11, Math.round(size * 0.4))
  const isExtraLegroom = seat.seatType === "extra_legroom"

  let style: React.CSSProperties = {
    width: size,
    height: size * 1.06,
  }
  let borderClass = "border-white/[0.14]"
  let innerClass = "text-slate-500"

  if (isMe) {
    style.background = "linear-gradient(160deg, #F1D98A 0%, #D4AF37 50%, #B8860B 100%)"
    style.boxShadow = "0 4px 16px rgba(212,175,55,0.45), inset 0 1px 0 rgba(255,255,255,0.4)"
    borderClass = "border-[#F1D98A]"
    innerClass = "text-[#060B14]"
  } else if (isOtherPax && color) {
    style.background = `linear-gradient(160deg, transparent, transparent)`
    borderClass = color.ring
    innerClass = color.text
  } else if (taken) {
    style.backgroundImage =
      "repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1.5px, transparent 1.5px, transparent 6px)"
    style.backgroundColor = "rgba(255,255,255,0.02)"
    borderClass = "border-white/[0.07]"
    innerClass = "text-[#B8860B]/80"
  } else if (isExtraLegroom) {
    style.background = "linear-gradient(160deg, rgba(212,175,55,0.14), rgba(212,175,55,0.04))"
    borderClass = "border-[#D4AF37]/45"
    innerClass = "text-[#E8C766]/85"
  } else {
    style.background = "linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))"
  }

  const otherPaxBgClass = isOtherPax && color ? color.bg.replace("/10", "/50") : ""

  return (
    <button
      onClick={onClick}
      disabled={taken}
      title={`${seat.seatNumber}${isExtraLegroom ? " · Extra legroom" : ""}${seat.price > 0 ? ` · +₹${Math.round(seat.price).toLocaleString("en-IN")}` : ""}`}
      style={style}
      className={`seat-btn relative flex items-center justify-center transition-all duration-150 group shrink-0 border-2 rounded-t-[42%] rounded-b-[16%] ${borderClass} ${otherPaxBgClass} ${
        taken ? "cursor-not-allowed" : "cursor-pointer hover:-translate-y-0.5 hover:border-[#E8C766]/70"
      } ${isMe ? "seat-pop" : ""}`}
    >
      {seat.isWindow && !taken && !isMe && !isOtherPax && (
        <span className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-sky-300/60" aria-hidden />
      )}
      {isExtraLegroom && !taken && !isMe && !isOtherPax && (
        <span className="absolute bottom-1 text-[#E8C766]/70" style={{ fontSize: size * 0.16 }} aria-hidden>
          ⌄⌄
        </span>
      )}

      {taken ? (
        <LockIcon size={Math.max(10, iconSize * 0.8)} className={innerClass} filled />
      ) : isMe ? (
        <span className={`font-bold ${innerClass}`} style={{ fontSize: Math.max(10, size * 0.26) }}>
          ✓
        </span>
      ) : isOtherPax && color ? (
        <span className={`font-bold ${innerClass}`} style={{ fontSize: Math.max(10, size * 0.24) }}>
          {seat.col}
        </span>
      ) : (
        <SeatIcon size={iconSize} className={innerClass} />
      )}
    </button>
  )
}

function BusinessSeatPod({
  seat,
  size,
  taken,
  isMe,
  isOtherPax,
  color,
  onClick,
}: {
  seat: ApiSeat
  size: number
  taken: boolean
  isMe: boolean
  isOtherPax: boolean
  color: (typeof PAX_COLORS)[number] | null
  onClick: () => void
}) {
  const ART_RATIO = 1110 / 1104
  const height = size * ART_RATIO
  const badge = { left: "13%", top: "43%", width: "27%", height: "27%" }
  const ringColor = isMe ? (color ? color.dot : "bg-violet-400") : isOtherPax && color ? color.dot : null

  return (
    <button
      onClick={onClick}
      disabled={taken}
      title={`${seat.seatNumber}${seat.price > 0 ? ` · +₹${Math.round(seat.price).toLocaleString("en-IN")}` : ""}`}
      style={{ width: size, height }}
      className={`seat-btn group relative shrink-0 transition-all duration-200 ${
        taken ? "cursor-not-allowed" : "cursor-pointer hover:-translate-y-0.5"
      } ${isMe ? "seat-pop" : ""}`}
    >
      {ringColor && (
        <span className={`absolute inset-[6%] rounded-[24%] ${ringColor} opacity-25 blur-lg`} aria-hidden />
      )}

      <img
        src="/seats/business-class-seat-pod.png"
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className={`relative w-full h-full object-contain select-none transition-all duration-200 ${
          !taken ? "group-hover:brightness-110" : ""
        }`}
        style={{ filter: taken ? "grayscale(65%) brightness(0.55)" : undefined }}
      />

      <div className="absolute flex items-center justify-center" style={badge}>
        {taken ? (
          <span className="w-[62%] h-[62%] rounded-full bg-[#3a2410]/90 border border-[#D4AF37]/70 flex items-center justify-center">
            <LockIcon size={Math.max(11, size * 0.14)} className="text-[#E8C766]" filled />
          </span>
        ) : isMe ? (
          <span
            className={`w-[62%] h-[62%] rounded-full ${color ? color.dot : "bg-violet-400"} flex items-center justify-center font-bold text-[#060B14]`}
            style={{ fontSize: Math.max(11, size * 0.14) }}
          >
            ✓
          </span>
        ) : isOtherPax && color ? (
          <span
            className={`w-[62%] h-[62%] rounded-full ${color.bg.replace("/10", "/70")} border ${color.ring} flex items-center justify-center font-bold ${color.text}`}
            style={{ fontSize: Math.max(11, size * 0.14) }}
          >
            {seat.col}
          </span>
        ) : (
          <span className="text-slate-300 font-light group-hover:text-violet-300 transition-colors" style={{ fontSize: Math.max(14, size * 0.2) }}>
            +
          </span>
        )}
      </div>

      {!taken && !isMe && !isOtherPax && seat.price > 0 && (
        <span
          className="absolute text-[9px] leading-none px-1.5 py-0.5 rounded bg-[#060B14]/90 border border-violet-400/30 text-violet-300/80 whitespace-nowrap"
          style={{ top: size * 0.02, right: -4 }}
        >
          +₹{Math.round(seat.price).toLocaleString("en-IN")}
        </span>
      )}
    </button>
  )
}

function IllustratedSeatPod({
  seat,
  size,
  taken,
  isMe,
  isOtherPax,
  color,
  onClick,
}: {
  seat: ApiSeat
  size: number
  taken: boolean
  isMe: boolean
  isOtherPax: boolean
  color: (typeof PAX_COLORS)[number] | null
  onClick: () => void
}) {
  const ART_RATIO = 795 / 829
  const height = size * ART_RATIO
  const badge = { left: "21%", top: "12%", width: "36%", height: "36%" }
  const ringColor = isMe ? (color ? color.dot : "bg-[#D4AF37]") : isOtherPax && color ? color.dot : null

  return (
    <button
      onClick={onClick}
      disabled={taken}
      title={`${seat.seatNumber}${seat.price > 0 ? ` · +₹${Math.round(seat.price).toLocaleString("en-IN")}` : ""}`}
      style={{ width: size, height }}
      className={`seat-btn group relative shrink-0 transition-all duration-200 ${
        taken ? "cursor-not-allowed" : "cursor-pointer hover:-translate-y-0.5"
      } ${isMe ? "seat-pop" : ""}`}
    >
      {ringColor && (
        <span
          className={`absolute inset-[6%] rounded-[24%] ${ringColor} opacity-25 blur-lg`}
          aria-hidden
        />
      )}

      <img
        src="/seats/first-class-seat-pod.png"
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className={`relative w-full h-full object-contain select-none transition-all duration-200 ${
          !taken ? "group-hover:brightness-110" : ""
        }`}
        style={{
          filter: taken ? "grayscale(65%) brightness(0.55)" : undefined,
        }}
      />

      <div
        className="absolute flex items-center justify-center"
        style={badge}
      >
        {taken ? (
          <span className="w-[62%] h-[62%] rounded-full bg-[#3a2410]/90 border border-[#D4AF37]/70 flex items-center justify-center">
            <LockIcon size={Math.max(12, size * 0.15)} className="text-[#E8C766]" filled />
          </span>
        ) : isMe ? (
          <span
            className={`w-[62%] h-[62%] rounded-full ${color ? color.dot : "bg-[#D4AF37]"} flex items-center justify-center font-bold text-[#060B14]`}
            style={{ fontSize: Math.max(11, size * 0.15) }}
          >
            ✓
          </span>
        ) : isOtherPax && color ? (
          <span
            className={`w-[62%] h-[62%] rounded-full ${color.bg.replace("/10", "/70")} border ${color.ring} flex items-center justify-center font-bold ${color.text}`}
            style={{ fontSize: Math.max(11, size * 0.15) }}
          >
            {seat.col}
          </span>
        ) : (
          <span
            className="text-slate-300 font-light group-hover:text-[#E8C766] transition-colors"
            style={{ fontSize: Math.max(15, size * 0.22) }}
          >
            +
          </span>
        )}
      </div>

      {!taken && !isMe && !isOtherPax && seat.price > 0 && (
        <span
          className="absolute text-[9px] leading-none px-1.5 py-0.5 rounded bg-[#060B14]/90 border border-[#D4AF37]/30 text-[#C9A227]/80 whitespace-nowrap"
          style={{ top: size * 0.02, right: -4 }}
        >
          +₹{Math.round(seat.price).toLocaleString("en-IN")}
        </span>
      )}
    </button>
  )
}

function LockIcon({
  size = 14,
  className = "",
  filled = false,
}: {
  size?: number
  className?: string
  filled?: boolean
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect
        x="4" y="11" width="16" height="9" rx="2.5"
        fill={filled ? "currentColor" : "none"}
        fillOpacity={filled ? 0.18 : 1}
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M7.5 11V7.5a4.5 4.5 0 019 0V11" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="15.5" r="1.4" fill="currentColor" />
    </svg>
  )
}

function LegendChip({
  variant,
  label,
  price,
}: {
  variant: "available" | "selected" | "booked" | "locked"
  label: string
  price?: number
}) {
  const swatchStyle: React.CSSProperties =
    variant === "selected"
      ? { background: "linear-gradient(160deg, #F1D98A 0%, #D4AF37 50%, #B8860B 100%)" }
      : variant === "booked"
      ? {
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1.5px, transparent 1.5px, transparent 5px)",
          backgroundColor: "rgba(255,255,255,0.03)",
        }
      : variant === "locked"
      ? { background: "rgba(212,175,55,0.12)" }
      : { background: "rgba(255,255,255,0.04)" }

  const borderClass =
    variant === "selected"
      ? "border-[#F1D98A]"
      : variant === "booked"
      ? "border-white/[0.1]"
      : variant === "locked"
      ? "border-[#D4AF37]/40"
      : "border-white/[0.16]"

  return (
    <div className="flex items-center gap-1.5">
      <span
        style={swatchStyle}
        className={`relative w-4 h-[17px] rounded-t-[42%] rounded-b-[16%] border flex items-center justify-center ${borderClass}`}
      >
        {variant === "selected" && <span className="text-[#060B14] text-[8px] font-bold">✓</span>}
        {variant === "booked" && <LockIcon size={7} className="text-[#B8860B]/90" filled />}
        {variant === "locked" && <LockIcon size={7} className="text-[#E8C766]" filled />}
      </span>
      <span className="text-[11px] text-slate-400">
        {label}
        {typeof price === "number" && <span className="text-slate-600"> · ₹{Math.round(price).toLocaleString("en-IN")}</span>}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 7. Rolling Price Counter & Digit Odometer
// ---------------------------------------------------------------------------

function RollingDigit({
  char,
  delay = 0,
}: {
  char: string
  delay?: number
}) {
  if (char < "0" || char > "9") {
    return (
      <span className="inline-block px-[1px] text-amber-300 font-display font-black select-none">
        {char}
      </span>
    )
  }

  const digit = parseInt(char, 10)

  return (
    <span
      className="inline-block relative overflow-hidden h-[1.18em] leading-[1.18em] min-w-[0.62em] text-center align-baseline select-none font-display font-black text-amber-300"
    >
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
            className="h-[1.18em] leading-[1.18em] flex items-center justify-center text-amber-300 text-center"
          >
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  )
}

function RollingPriceCounter({
  value,
  className = "",
}: {
  value: number
  className?: string
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

  return (
    <div className={`relative inline-flex flex-col items-end ${className}`}>
      {/* Updating micro-status pill */}
      <AnimatePresence>
        {isUpdating && (
          <motion.span
            initial={{ opacity: 0, y: -4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="absolute -top-4 right-0 text-[8.5px] font-mono font-bold text-amber-300 bg-amber-400/20 border border-amber-400/40 px-1.5 py-0.2 rounded-full whitespace-nowrap tracking-wider shadow-[0_0_8px_rgba(251,191,36,0.3)]"
          >
            CALCULATING…
          </motion.span>
        )}
      </AnimatePresence>

      <motion.div
        animate={isUpdating ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="inline-flex items-baseline font-mono tabular-nums"
      >
        <span className="font-display font-black text-amber-400 mr-1 text-xl sm:text-2xl select-none">
          ₹
        </span>
        <div className="inline-flex items-baseline text-2xl sm:text-3xl font-display font-black text-amber-300">
          {chars.map((ch, idx) => {
            const revIdx = len - 1 - idx
            const delay = idx * 0.04
            return (
              <RollingDigit
                key={`digit-rev-${revIdx}-${ch === "," ? "comma" : "num"}`}
                char={ch}
                delay={delay}
              />
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 8. SeatSummary — Reservation Manifest & Total Fare (Right Column)
// ---------------------------------------------------------------------------

function SeatSummary({
  legs,
  passengers,
  picks,
  activeLegIndex,
  activePassengerIndex,
  activeCabin,
  totalSeatPrice,
  allSeatsAssigned,
  submitting,
  submitError,
  onSelectPassenger,
  onClearSeat,
  onContinue,
  onSkip,
}: {
  legs: LegSeatMap[]
  passengers: StoredPassenger[]
  picks: SelectionMap
  activeLegIndex: number
  activePassengerIndex: number
  activeCabin: CabinKey
  totalSeatPrice: number
  allSeatsAssigned: boolean
  submitting: boolean
  submitError: string | null
  onSelectPassenger: (i: number) => void
  onClearSeat: (passengerId: string) => void
  onContinue: () => void
  onSkip: () => void
}) {
  const activeLeg = legs[activeLegIndex]
  const assignedCount = passengers.filter((p) => !!picks[`${activeLegIndex}:${p.id}`]).length
  const praise = CABIN_PRAISE[activeCabin]

  return (
    <div className="sticky top-20 space-y-4">
      <div className="relative bg-gradient-to-b from-[#0C1729]/98 via-[#0E1B31]/98 to-[#091220]/98 border border-white/[0.12] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.4)] ticket-edge">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <p className="font-display text-sm font-bold text-white tracking-wide">Reservation Manifest</p>
            <p className="text-[10.5px] text-slate-400">Assign seat per passenger</p>
          </div>
          <span
            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
              assignedCount === passengers.length
                ? "bg-emerald-400/15 border-emerald-400/30 text-emerald-300"
                : "bg-amber-400/15 border-amber-400/30 text-amber-300"
            }`}
          >
            {assignedCount}/{passengers.length} Assigned
          </span>
        </div>

        {/* Passenger Cards */}
        <div className="p-4 space-y-2.5">
          {passengers.map((p, pIdx) => {
            const seatId = picks[`${activeLegIndex}:${p.id}`]
            const seat = activeLeg?.seats.find((s) => s.id === seatId)
            const color = paxColor(pIdx)
            const isActive = activePassengerIndex === pIdx

            return (
              <div
                key={p.id}
                onClick={() => onSelectPassenger(pIdx)}
                className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-r from-amber-400/[0.12] to-transparent border-[#D4AF37] shadow-[0_0_18px_rgba(212,175,55,0.15)]"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                }`}
              >
                {/* Avatar with initials */}
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${color.dot} text-[#060B14] shadow-sm`}
                >
                  {paxInitials(p, pIdx)}
                </span>

                {/* Name & Type */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{paxFullName(p, pIdx)}</p>
                  <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
                    <span className="text-slate-400 font-medium">{paxTypeLabel(p)}</span>
                    <span className="text-slate-600">•</span>
                    {seat ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Seat Assigned
                      </span>
                    ) : isActive ? (
                      <span className="text-amber-400 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Selecting Seat
                      </span>
                    ) : (
                      <span className="text-slate-500 font-medium">No Seat</span>
                    )}
                  </div>
                </div>

                {/* Assigned Seat Badge or Prompt */}
                {seat ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <span className="inline-flex items-center font-mono text-xs font-black text-amber-300 bg-amber-400/15 border border-amber-400/30 rounded-lg px-2 py-0.5 shadow-sm">
                        {seat.seatNumber}
                      </span>
                      <p className="text-[10px] text-slate-400 font-mono tabular-nums mt-0.5">
                        {seat.price > 0 ? `+₹${Math.round(seat.price).toLocaleString("en-IN")}` : "Included"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onClearSeat(p.id)
                      }}
                      className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/30 flex items-center justify-center transition-all cursor-pointer"
                      title="Clear assigned seat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[10.5px] text-amber-300/90 font-semibold bg-amber-400/10 border border-amber-400/25 px-2.5 py-1 rounded-lg shrink-0">
                    Pick a seat
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Ticket Perforation Line */}
        <div className="relative my-1 px-5">
          <div className="border-t border-dashed border-white/15" />
          <span className="absolute -left-3 -top-2.5 w-5 h-5 rounded-full bg-[#060B14] border-r border-white/10" />
          <span className="absolute -right-3 -top-2.5 w-5 h-5 rounded-full bg-[#060B14] border-l border-white/10" />
        </div>

        {/* Total Seat Price Pod */}
        <div className="p-3.5 sm:p-4">
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#12233f]/90 via-[#0d1b33]/90 to-[#0a1426]/90 border border-amber-400/25 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_8px_24px_rgba(0,0,0,0.35)] relative overflow-hidden">
            {/* Top row: Label & Assigned Badge */}
            <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-white/[0.08]">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] shrink-0" />
                <span className="text-[10.5px] font-mono uppercase tracking-wider text-slate-300 font-bold whitespace-nowrap">
                  Total Seat Fare
                </span>
              </div>
              <span className="text-[9.5px] font-mono text-amber-300 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                {assignedCount}/{passengers.length} Assigned
              </span>
            </div>

            {/* Bottom row: Subtitle & Rolling Price Counter */}
            <div className="flex items-end justify-between gap-2 pt-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] text-slate-400 font-medium leading-tight">
                  {Math.round(totalSeatPrice) === 0 ? "Complimentary selection" : "Added to booking total"}
                </p>
                <p className="text-[9.5px] text-slate-400 mt-0.5 font-mono">
                  {assignedCount === 0 ? "Standard allocation" : `${assignedCount} seat${assignedCount > 1 ? "s" : ""} selected`}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <RollingPriceCounter value={totalSeatPrice} />
              </div>
            </div>
          </div>
        </div>

        {/* Praise / In-Flight perk banner if seats selected */}
        {assignedCount > 0 && (
          <div className="mx-5 mb-4 p-3 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-emerald-300">{praise.title}</p>
              <p className="text-[10.5px] text-emerald-300/70 leading-tight mt-0.5">{praise.body}</p>
            </div>
          </div>
        )}

        {submitError && (
          <div className="mx-5 mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <p className="text-xs text-rose-300">{submitError}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-5 pt-0 space-y-3">
          <button
            onClick={onContinue}
            disabled={!allSeatsAssigned || submitting}
            className={`continue-cta relative overflow-hidden w-full px-6 py-3.5 rounded-full font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              allSeatsAssigned && !submitting ? "pill-cta shadow-[0_8px_30px_rgba(251,191,36,0.35)]" : "bg-white/10 text-slate-400"
            }`}
          >
            {allSeatsAssigned && !submitting && (
              <span className="shimmer-sweep absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-20deg]" />
            )}
            <span className="relative">{submitting ? "Securing Seats…" : "Continue to Add-ons"}</span>
            {!submitting && <ArrowRight className="w-4 h-4 relative" />}
          </button>

          {!allSeatsAssigned && (
            <p className="text-[10.5px] text-slate-400 text-center leading-tight">
              Please choose a seat for all passengers on each flight leg to continue
            </p>
          )}

          <button
            onClick={onSkip}
            className="w-full text-xs text-slate-400 hover:text-amber-300 transition-colors py-1 cursor-pointer flex items-center justify-center gap-1"
          >
            <span>Skip seat selection & auto-assign</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 8. SkipSeatModal — Cabin Auto-Assignment Modal
// ---------------------------------------------------------------------------

function SkipSeatModal({
  step,
  cabin,
  errorMessage,
  onCabinChange,
  onCheck,
  onBackToCabin,
  onChooseMode,
  onClose,
}: {
  step: "cabin" | "mode" | "error"
  cabin: CabinKey
  errorMessage: string | null
  onCabinChange: (c: CabinKey) => void
  onCheck: () => void
  onBackToCabin: () => void
  onChooseMode: (mode: "random" | "together") => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 backdrop-blur-md px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-gradient-to-b from-[#0E1C33] to-[#091220] border border-amber-400/30 rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden p-6"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {step === "cabin" && (
          <div>
            <div className="w-10 h-10 rounded-2xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-amber-300 mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-display font-black text-lg text-white mb-1">Smart Auto-Assign</h3>
            <p className="text-xs text-slate-400 mb-5">
              Select your desired cabin tier and we will automatically allocate optimal available seats.
            </p>

            <div className="grid grid-cols-2 gap-2.5 mb-5">
              {CABIN_CLASSES.map((c) => {
                const isActive = cabin === c.key
                return (
                  <button
                    key={c.key}
                    onClick={() => onCabinChange(c.key)}
                    className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isActive
                        ? "border-[#D4AF37] bg-amber-400/[0.12] shadow-[0_0_15px_rgba(251,191,36,0.2)]"
                        : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <span className={`text-xs font-bold ${isActive ? "text-amber-300" : "text-white"}`}>
                      {c.label}
                    </span>
                    <span className={`text-[10px] font-mono ${isActive ? "text-amber-200/80" : "text-slate-400"}`}>
                      from ₹{c.fromPrice.toLocaleString("en-IN")}
                    </span>
                  </button>
                )
              })}
            </div>

            <button
              onClick={onCheck}
              className="w-full py-3.5 rounded-full gold-cta font-bold text-sm tracking-wide cursor-pointer shadow-lg"
            >
              Verify Availability & Assign
            </button>
          </div>
        )}

        {step === "mode" && (
          <div>
            <h3 className="font-display font-black text-lg text-white mb-1">Seating Preference</h3>
            <p className="text-xs text-slate-400 mb-5">
              How would you like our flight system to allocate your seats?
            </p>

            <div className="space-y-3">
              <button
                onClick={() => onChooseMode("together")}
                className="w-full flex items-center gap-3.5 p-4 rounded-xl border border-white/10 bg-white/[0.03] hover:border-amber-400/50 hover:bg-amber-400/[0.05] transition-all text-left cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-amber-300 shrink-0">
                  <Armchair className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Sit Together in Same Row</p>
                  <p className="text-[10.5px] text-slate-400">Place travelers in adjacent contiguous seats</p>
                </div>
              </button>

              <button
                onClick={() => onChooseMode("random")}
                className="w-full flex items-center gap-3.5 p-4 rounded-xl border border-white/10 bg-white/[0.03] hover:border-amber-400/50 hover:bg-amber-400/[0.05] transition-all text-left cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/25 flex items-center justify-center text-cyan-300 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Fastest Available</p>
                  <p className="text-[10.5px] text-slate-400">Instant assignment from nearest open slots</p>
                </div>
              </button>
            </div>

            <button
              onClick={onBackToCabin}
              className="w-full mt-4 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              ← Choose a different cabin
            </button>
          </div>
        )}

        {step === "error" && (
          <div>
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400 mb-3">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h3 className="font-display font-black text-lg text-white mb-1">Cabin Sold Out</h3>
            <p className="text-xs text-slate-400 mb-5">{errorMessage}</p>
            <button
              onClick={onBackToCabin}
              className="w-full py-3.5 rounded-full gold-cta font-bold text-sm tracking-wide cursor-pointer"
            >
              Select Another Cabin
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 9. PageShell & Stepper
// ---------------------------------------------------------------------------

const STEPS = [
  { id: 1, label: "Search" },
  { id: 2, label: "Select" },
  { id: 3, label: "Passengers" },
  { id: 4, label: "Seats" },
  { id: 5, label: "Add-ons" },
  { id: 6, label: "Payment" },
]

function PageShell({
  children,
  selection,
  router,
}: {
  children?: ReactNode
  selection?: CheckoutSelection | null
  router?: ReturnType<typeof useRouter>
}) {
  return (
    <div className="min-h-screen bg-[#060B14] text-white relative overflow-x-hidden">
      <PageStyles />

      {/* Top Brand Glow Accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 via-amber-400 to-amber-300 z-10" />

      {/* Atmospheric Ambient Lighting */}
      <div className="pointer-events-none fixed top-[-200px] left-[15%] w-[600px] h-[600px] bg-amber-500/[0.04] blur-[160px] rounded-full" />
      <div className="pointer-events-none fixed top-[10%] right-[5%] w-[450px] h-[450px] bg-blue-500/[0.035] blur-[150px] rounded-full" />
      <div className="pointer-events-none fixed bottom-[-200px] right-[10%] w-[500px] h-[500px] bg-cyan-400/[0.04] blur-[160px] rounded-full" />

      <Navbar />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-16">
        {/* Top Bar with Back Navigation & Journey Stepper */}
        <div className="flex items-center justify-between gap-6 mb-4">
          <button
            onClick={() => router?.push("/checkout/passengers")}
            className="group flex items-center gap-2 pl-2 pr-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-400 hover:text-white border border-transparent hover:border-white/10 hover:bg-white/[0.04] transition-all cursor-pointer shrink-0"
          >
            <span className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center group-hover:bg-amber-400 group-hover:text-[#060B14] transition-all">
              ←
            </span>
            <span>Back to passengers</span>
          </button>

          <Stepper activeId={4} />
        </div>

        {children}
      </div>
    </div>
  )
}

function Stepper({ activeId }: { activeId: number }) {
  const progressPct = ((activeId - 1) / (STEPS.length - 1)) * 100

  return (
    <div className="relative hidden md:flex items-center flex-1 max-w-xl">
      <div className="absolute left-4 right-4 h-[2px] bg-white/[0.08] rounded-full" />
      <div
        className="absolute left-4 h-[2px] bg-gradient-to-r from-emerald-400 to-amber-400 rounded-full transition-all duration-500"
        style={{ width: `calc(${progressPct}% - ${progressPct > 0 ? 28 : 0}px)` }}
      />

      <div className="relative flex items-center justify-between w-full">
        {STEPS.map((step) => {
          const isDone = step.id < activeId
          const isCurrent = step.id === activeId
          return (
            <div key={step.id} className="flex flex-col items-center gap-1 bg-[#060B14] px-1">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-bold border-2 transition-all ${
                  isCurrent
                    ? "border-amber-400 bg-amber-400/20 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.4)]"
                    : isDone
                    ? "border-emerald-400/80 bg-emerald-400/15 text-emerald-300"
                    : "border-white/10 bg-white/[0.03] text-slate-500"
                }`}
              >
                {isDone ? "✓" : step.id}
              </span>
              <span
                className={`text-[10px] whitespace-nowrap ${
                  isCurrent ? "text-amber-300 font-bold" : isDone ? "text-emerald-300/80" : "text-slate-500"
                }`}
              >
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
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
      <p className="text-slate-400 text-xs tracking-wider uppercase font-mono">{text}</p>
    </div>
  )
}

function EmptyCabinCard({ cabinLabel }: { cabinLabel: string }) {
  return (
    <div className="bg-[#0D1A2C]/80 border border-white/10 rounded-2xl p-10 text-center">
      <div className="w-12 h-12 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto mb-3 text-amber-300">
        <Armchair className="w-6 h-6" />
      </div>
      <p className="text-slate-200 font-bold text-sm">No {cabinLabel} seats configured on this flight</p>
      <p className="text-xs text-slate-500 mt-1">Please select an available cabin tier from the left menu.</p>
    </div>
  )
}

function NoSeatMapCard() {
  return (
    <div className="bg-[#0D1A2C]/80 border border-white/10 rounded-2xl p-10 text-center">
      <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto mb-3 text-slate-400">
        <Plane className="w-6 h-6" />
      </div>
      <p className="text-slate-200 font-bold text-sm">Seat selection is managed at airport check-in</p>
      <p className="text-xs text-slate-500 mt-1">Your seats will be assigned complimentary upon boarding pass issuance.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 10. PageStyles
// ---------------------------------------------------------------------------

function PageStyles() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@600;700;800;900&display=swap');

      .font-display {
        font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif;
        letter-spacing: -0.01em;
      }

      .gold-cta {
        background: linear-gradient(135deg, #FDE68A 0%, #D4AF37 45%, #B45309 100%);
        color: #060B14;
        box-shadow: 0 8px 30px rgba(212,175,55,0.25);
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .gold-cta:hover {
        filter: brightness(1.08);
        transform: translateY(-1px);
      }

      .pill-cta {
        background: linear-gradient(90deg, #38BDF8 0%, #60A5FA 25%, #FBBF24 75%, #F59E0B 100%);
        color: #060B14;
        box-shadow: 0 8px 30px rgba(56,189,248,0.2), 0 8px 30px rgba(251,191,36,0.2);
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .pill-cta:hover {
        filter: brightness(1.08);
        transform: translateY(-1px);
      }

      .ticket-edge {
        position: relative;
      }
      .ticket-edge::before {
        content: "";
        position: absolute;
        inset: 2px;
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: inherit;
        pointer-events: none;
      }

      @keyframes seatPop {
        0% { transform: scale(0.85); }
        50% { transform: scale(1.15); }
        100% { transform: scale(1); }
      }
      .seat-pop {
        animation: seatPop 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      @keyframes shimmerSweep {
        0% { transform: translateX(-120%); }
        100% { transform: translateX(120%); }
      }
      .shimmer-sweep {
        animation: shimmerSweep 4.5s ease-in-out infinite;
      }

      .cabin-row:hover {
        transform: translateY(-1px);
      }
      .continue-cta:hover:not(:disabled) {
        transform: translateY(-1px) scale(1.01);
      }
      .continue-cta:active:not(:disabled) {
        transform: translateY(0) scale(0.99);
      }

      @media (prefers-reduced-motion: reduce) {
        .seat-pop, .shimmer-sweep {
          animation: none !important;
        }
      }
    `}</style>
  )
}