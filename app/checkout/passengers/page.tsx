"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import Navbar from "@/components/navbar"
import {
  Select as UiSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
}

type PassengerType = "adult" | "child" | "infant"

type Passenger = {
  localId: string
  type: PassengerType
  age?: number
  title: string
  firstName: string
  middleName: string
  lastName: string
  dob: string
  gender: string
  nationality: string
  frequentFlyer: string
  email: string
  countryCode: string
  mobile: string
  isPrimaryContact: boolean
  sourceSavedId?: string
}

// Shape returned by GET /api/saved-passengers (snake_case, straight from DB)
type SavedPassenger = {
  id: string
  title: string | null
  first_name: string
  middle_name: string | null
  last_name: string
  date_of_birth: string | null
  gender: string | null
  nationality: string | null
  frequent_flyer: string | null
}

type FieldErrors = Partial<Record<keyof Passenger, string>>

const STORAGE_KEY = "navigo:checkoutSelection" // flight selection — not personal data, stays global
const PAX_DRAFT_BASE_KEY = "navigo:passengerDraft"
const BOOKING_ID_BASE_KEY = "navigo:bookingId"
const MAX_PASSENGERS = 9

const airlineLogos: Record<string, string> = {
  "IndiGo": "/airlines/indigo.png",
  "Air India": "/airlines/airindia.png",
  "Vistara": "/airlines/vistara.png",
  "Akasa Air": "/airlines/akasa.png",
  "Emirates": "/airlines/emirates.png",
  "Qatar Airways": "/airlines/qatar.png",
  "Singapore Airlines": "/airlines/singapore.png",
  "Singapore": "/airlines/singapore.png",
  "SIA": "/airlines/singapore.png",
  "Navigo Airlines": "/logo.png",
  "Navigo": "/logo.png",
}

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

function decodeUserIdFromToken(token: string): string | null {
  try {
    const payload = token.split(".")[1]
    const decoded = JSON.parse(atob(payload))
    return decoded?.userId ?? null
  } catch {
    return null
  }
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("token")
}

function emptyPassenger(type: PassengerType = "adult", isPrimaryContact = false): Passenger {
  return {
    localId: makeId(),
    type,
    title: "",
    firstName: "",
    middleName: "",
    lastName: "",
    dob: "",
    gender: "",
    nationality: "India",
    frequentFlyer: "",
    email: "",
    countryCode: "+91",
    mobile: "",
    isPrimaryContact,
  }
}

function savedPassengerToPassenger(sp: SavedPassenger, isPrimaryContact: boolean): Passenger {
  return {
    localId: makeId(),
    type: "adult",
    title: sp.title || "",
    firstName: sp.first_name || "",
    middleName: sp.middle_name || "",
    lastName: sp.last_name || "",
    dob: sp.date_of_birth || "",
    gender: sp.gender || "",
    nationality: sp.nationality || "India",
    frequentFlyer: sp.frequent_flyer || "",
    email: "",
    countryCode: "+91",
    mobile: "",
    isPrimaryContact,
    sourceSavedId: sp.id,
  }
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

const steps = [
  { id: 1, label: "Search" },
  { id: 2, label: "Select" },
  { id: 3, label: "Passengers" },
  { id: 4, label: "Seats" },
  { id: 5, label: "Add-ons" },
  { id: 6, label: "Payment" },
  { id: 7, label: "Confirmed" },
]

const requiredFields: (keyof Passenger)[] = ["title", "firstName", "lastName", "dob", "gender", "nationality"]

function validatePassenger(p: Passenger): FieldErrors {
  const errors: FieldErrors = {}
  for (const field of requiredFields) {
    if (!String(p[field] ?? "").trim()) {
      errors[field] = "Required"
    }
  }
  if (p.isPrimaryContact) {
    if (!p.email.trim()) errors.email = "Required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) errors.email = "Invalid email"
    if (!p.mobile.trim()) errors.mobile = "Required"
    else if (!/^\d{6,12}$/.test(p.mobile)) errors.mobile = "Invalid number"
  }
  return errors
}

export default function PassengerDetailsPage() {
  const router = useRouter()

  const [selection, setSelection] = useState<CheckoutSelection | null>(null)
  const [loadState, setLoadState] = useState<"loading" | "found" | "missing">("loading")
  const [passengers, setPassengers] = useState<Passenger[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [errorsByPassenger, setErrorsByPassenger] = useState<Record<string, FieldErrors>>({})
  const [mounted, setMounted] = useState(false)
  const [pulseSavings, setPulseSavings] = useState(false)

  const [authToken, setAuthToken] = useState<string | null>(null)
  const [storageNamespace, setStorageNamespace] = useState<string>("guest")
  const [savedPassengers, setSavedPassengers] = useState<SavedPassenger[]>([])
  const [saveForNextTime, setSaveForNextTime] = useState(true)

  const paxDraftKey = `${PAX_DRAFT_BASE_KEY}:${storageNamespace}`
  const bookingIdKey = `${BOOKING_ID_BASE_KEY}:${storageNamespace}`

  // ✅ NEW: how many passenger slots this booking is actually allowed to
  // have — driven by what was chosen at search time (selection.passengers),
  // not a flat app-wide ceiling. MAX_PASSENGERS is kept only as an absolute
  // safety cap in case selection.passengers is ever missing/corrupted.
  const maxPassengers = Math.min(Math.max(1, selection?.passengers || 1), MAX_PASSENGERS)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const token = getAuthToken()
    const namespace = token ? decodeUserIdFromToken(token) || "guest" : "guest"
    setAuthToken(token)
    setStorageNamespace(namespace)

    const localPaxDraftKey = `${PAX_DRAFT_BASE_KEY}:${namespace}`
    const localBookingIdKey = `${BOOKING_ID_BASE_KEY}:${namespace}`

    try {
      let raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw && typeof window !== "undefined" && window.location.search.includes("demo=1")) {
        const mockSelection: CheckoutSelection = {
          departFlight: {
            id: "fl_1",
            flight_instance_id: "inst_1",
            airline: "IndiGo",
            origin: "DEL",
            destination: "BLR",
            departure_time: "06:00",
            arrival_time: "08:45",
            aircraft: "A320neo",
            stops: 0,
            final_price: 5684,
            duration: "2h 45m",
            travel_date: "2026-10-25",
          },
          returnFlight: {
            id: "fl_2",
            flight_instance_id: "inst_2",
            airline: "IndiGo",
            origin: "BLR",
            destination: "DEL",
            departure_time: "19:30",
            arrival_time: "22:15",
            aircraft: "A320neo",
            stops: 0,
            final_price: 5684,
            duration: "2h 45m",
            travel_date: "2026-10-28",
          },
          passengers: 1,
          mode: "roundtrip",
          totalPrice: 13528,
          origin: "DEL",
          destination: "BLR",
          savedAt: Date.now(),
        }
        raw = JSON.stringify(mockSelection)
        sessionStorage.setItem(STORAGE_KEY, raw)
      }
      if (!raw) { setLoadState("missing"); return }
      const parsed = JSON.parse(raw) as CheckoutSelection

      setSelection(parsed)
      setLoadState("found")

      const draftRaw = sessionStorage.getItem(localPaxDraftKey)
      // ✅ FIX: a cached draft from a PREVIOUS search (different passenger
      // count) was being restored as-is, with no check against what THIS
      // search actually asked for — e.g. a leftover 2-passenger draft
      // would still show 2 slots on a fresh 1-passenger search, silently
      // bypassing the "don't allow more than searched-for" cap entirely,
      // since the array was already oversized before that cap logic ever
      // runs. Now the draft is trimmed/padded to match parsed.passengers
      // right here, at load time.
      const targetCount = Math.min(Math.max(1, parsed.passengers || 1), MAX_PASSENGERS)

      let initial: Passenger[]
      if (draftRaw) {
        const draft = JSON.parse(draftRaw) as Passenger[]
        if (Array.isArray(draft) && draft.length > 0) {
          if (draft.length > targetCount) {
            initial = draft.slice(0, targetCount)
            if (!initial.some((p) => p.isPrimaryContact)) {
              initial[0] = { ...initial[0], isPrimaryContact: true }
            }
          } else if (draft.length < targetCount) {
            const extra = Array.from({ length: targetCount - draft.length }, () => emptyPassenger("adult", false))
            initial = [...draft, ...extra]
          } else {
            initial = draft
          }
        } else {
          initial = Array.from({ length: targetCount }, (_, i) => emptyPassenger("adult", i === 0))
        }
      } else {
        initial = Array.from({ length: targetCount }, (_, i) => emptyPassenger("adult", i === 0))
      }
      setPassengers(initial)
      setExpandedId(initial[0].localId)

      const savedBookingId = sessionStorage.getItem(localBookingIdKey)
      if (savedBookingId) setBookingId(savedBookingId)
    } catch (err) {
      console.error("Failed to read checkout selection:", err)
      setLoadState("missing")
    }

    if (token) {
      fetch("/api/saved-passengers", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : { passengers: [] }))
        .then((data) => setSavedPassengers(data.passengers || []))
        .catch((err) => console.error("Failed to load saved passengers:", err))
    }
  }, [])

  useEffect(() => {
    if (passengers.length === 0) return
    try {
      sessionStorage.setItem(paxDraftKey, JSON.stringify(passengers))
    } catch (err) {
      console.error("Failed to persist passenger draft:", err)
    }
  }, [passengers, paxDraftKey])

  useEffect(() => {
    const t = setTimeout(() => setPulseSavings(true), 700)
    return () => clearTimeout(t)
  }, [])

  const [bookingId, setBookingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ✅ NEW: which saved-passenger ids are already applied to SOME slot in
  // this booking — used to grey those out everywhere else so the same
  // saved passenger can't be picked into two different slots by accident.
  const usedSavedIds = useMemo(
    () => new Set(passengers.map((p) => p.sourceSavedId).filter((id): id is string => !!id)),
    [passengers]
  )

  const updatePassenger = (localId: string, patch: Partial<Passenger>) => {
    setPassengers((prev) => prev.map((p) => (p.localId === localId ? { ...p, ...patch } : p)))
  }

  const replacePassenger = (localId: string, next: Passenger) => {
    setPassengers((prev) => prev.map((p) => (p.localId === localId ? { ...next, localId, isPrimaryContact: p.isPrimaryContact } : p)))
  }

  // ✅ NEW: reset one slot back to a blank form — the "start a new
  // passenger instead" option in the saved-passenger section. Keeps the
  // slot's original localId so React reconciliation, expandedId, and
  // errorsByPassenger all stay correctly associated with this card.
  const resetPassengerToBlank = (localId: string) => {
    setPassengers((prev) =>
      prev.map((p) => {
        if (p.localId !== localId) return p
        const blank = emptyPassenger(p.type, p.isPrimaryContact)
        return { ...blank, localId }
      })
    )
  }

  const validateAndCollapse = (localId: string) => {
    const passenger = passengers.find((p) => p.localId === localId)
    if (!passenger) return
    const errors = validatePassenger(passenger)
    setErrorsByPassenger((prev) => ({ ...prev, [localId]: errors }))
    if (Object.keys(errors).length === 0) {
      setExpandedId((current) => (current === localId ? null : current))
    }
  }

  const addPassenger = () => {
    if (passengers.length >= maxPassengers) return
    const next = emptyPassenger("adult", false)
    setPassengers((prev) => [...prev, next])
    setExpandedId(next.localId)
  }

  const removePassenger = (localId: string) => {
    setPassengers((prev) => prev.filter((p) => p.localId !== localId))
    setErrorsByPassenger((prev) => {
      const { [localId]: _, ...rest } = prev
      return rest
    })
  }

  const handleSetPrimaryContact = (localId: string) => {
    setPassengers((prev) => prev.map((p) => ({ ...p, isPrimaryContact: p.localId === localId })))
  }

  const allValid = useMemo(() => {
    return passengers.every((p) => Object.keys(validatePassenger(p)).length === 0)
  }, [passengers])

  const handleContinue = async () => {
    if (isSaving) return
    const allErrors: Record<string, FieldErrors> = {}
    let hasErrors = false
    for (const p of passengers) {
      const errors = validatePassenger(p)
      allErrors[p.localId] = errors
      if (Object.keys(errors).length > 0) hasErrors = true
    }
    setErrorsByPassenger(allErrors)

    if (hasErrors) {
      const firstInvalid = passengers.find((p) => Object.keys(allErrors[p.localId] || {}).length > 0)
      if (firstInvalid) setExpandedId(firstInvalid.localId)
      return
    }

    if (!selection) return

    if (!authToken) {
      setSaveError("Please sign in to continue with your booking.")
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          bookingId: bookingId || undefined,
          departFlightInstanceId: selection.departFlight.flight_instance_id,
          returnFlightInstanceId: selection.returnFlight?.flight_instance_id || null,
          passengers: passengers.map((p) => ({
            type: p.type,
            age: p.age,
            title: p.title,
            firstName: p.firstName,
            middleName: p.middleName,
            lastName: p.lastName,
            dob: p.dob,
            gender: p.gender,
            nationality: p.nationality,
            frequentFlyer: p.frequentFlyer,
            email: p.email,
            countryCode: p.countryCode,
            mobile: p.mobile,
            isPrimaryContact: p.isPrimaryContact,
          })),
          baseFare,
          taxesAndFees,
          seatSelectionPrice: 0,
          mealsPrice: 0,
          totalPrice: total,
          saveForNextTime,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save passenger details")

      setBookingId(data.bookingId)
      sessionStorage.setItem(bookingIdKey, data.bookingId)
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...selection,
          bookingId: data.bookingId,
          savedPassengers: data.passengers,
        })
      )

      router.push("/checkout/seats")
    } catch (err) {
      console.error("Failed to save booking:", err)
      setSaveError(err instanceof Error ? err.message : "Something went wrong saving your details. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  if (loadState === "loading") {
    return (
      <div className="min-h-screen bg-[#060B14] text-white flex items-center justify-center">
        <p className="text-slate-500 text-sm tracking-wide">Preparing your details…</p>
      </div>
    )
  }

  if (loadState === "missing" || !selection) {
    return (
      <div className="min-h-screen bg-[#060B14] text-white flex flex-col items-center justify-center gap-4">
        <p className="text-slate-300">We couldn't find an active booking.</p>
        <button onClick={() => router.push("/")}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-[#060B14] font-semibold">
          Search Flights
        </button>
      </div>
    )
  }

  const { departFlight, returnFlight } = selection
  const isRoundTrip = !!returnFlight
  const baseFare = (departFlight.final_price + (returnFlight?.final_price || 0)) * passengers.length
  const taxesAndFees = Math.round(baseFare * 0.19)
  const total = baseFare + taxesAndFees

  return (
    <div className="min-h-screen bg-[#060B14] text-white relative overflow-x-hidden">
      <PageStyles />

      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 via-amber-400 to-amber-300 z-10" />
      <div className="pointer-events-none fixed top-[-200px] left-[15%] w-[600px] h-[600px] bg-amber-500/[0.04] blur-[160px] rounded-full" />
      <div className="pointer-events-none fixed top-[10%] right-[5%] w-[450px] h-[450px] bg-blue-500/[0.035] blur-[150px] rounded-full" />
      <div className="pointer-events-none fixed bottom-[-200px] right-[10%] w-[500px] h-[500px] bg-cyan-400/[0.04] blur-[160px] rounded-full" />

      <Navbar />

      <div className={`relative max-w-7xl mx-auto px-6 pt-24 pb-32 transition-all duration-700 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}>
        <Stepper activeId={3} />

        <div className="space-y-3">
          <div className="transition-all duration-500 ease-out" style={{ transitionDelay: mounted ? "80ms" : "0ms" }}>
            <BoardingPassMini
              flight={departFlight}
              travelDate={departFlight.travel_date}
              tag={isRoundTrip ? "Departure" : undefined}
            />
          </div>

          {isRoundTrip && (
            <div className="transition-all duration-500 ease-out" style={{ transitionDelay: mounted ? "130ms" : "0ms" }}>
              <BoardingPassMini
                flight={returnFlight}
                travelDate={returnFlight.travel_date}
                tag="Return"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-12 gap-6 mt-6">
          <div className="col-span-12 lg:col-span-8 space-y-5">
            <div
              className="relative bg-gradient-to-r from-[#0C1729]/95 via-[#0F1E33]/98 to-[#0A1424]/95 border border-white/[0.12] rounded-3xl p-5 sm:p-6 shadow-[0_15px_35px_rgba(0,0,0,0.35)] backdrop-blur-2xl flex items-center justify-between flex-wrap gap-4 ticket-edge overflow-hidden transition-all duration-500 ease-out"
              style={{ transitionDelay: mounted ? "180ms" : "0ms", opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(12px)" }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 via-amber-400/80 to-transparent" />
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-cyan-400/10 border border-cyan-400/25 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.15)] shrink-0">
                  <span className="text-lg">👤</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-display font-bold text-base sm:text-lg text-white">Passenger Details</p>
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-cyan-300 bg-cyan-400/10 border border-cyan-400/20 rounded-full px-2 py-0.5">
                      Gov ID Required
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Enter names exactly as shown on government-issued photo identification
                  </p>
                </div>
              </div>
              {!authToken ? (
                <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-2.5">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-semibold text-slate-200">Book faster next time!</p>
                    <p className="text-[11px] text-slate-400">Sign in to autofill saved passengers</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/login")}
                    className="text-xs font-bold text-amber-300 bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 rounded-xl px-4 py-2 transition-all hover:scale-[1.02] shadow-[0_0_12px_rgba(251,191,36,0.15)] cursor-pointer"
                  >
                    Sign In
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2.5 bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-2.5 text-xs text-slate-300 cursor-pointer select-none hover:border-white/20 transition-colors">
                  <Checkbox checked={saveForNextTime} onChange={() => setSaveForNextTime((v) => !v)} />
                  <span className="font-medium">Save these details for future bookings</span>
                </label>
              )}
            </div>

            <div className="space-y-4">
              {passengers.map((passenger, index) => (
                <PassengerCard
                  key={passenger.localId}
                  index={index}
                  passenger={passenger}
                  isExpanded={expandedId === passenger.localId}
                  errors={errorsByPassenger[passenger.localId] || {}}
                  canRemove={passengers.length > 1}
                  entranceDelay={220 + index * 90}
                  mounted={mounted}
                  savedPassengers={savedPassengers}
                  usedSavedIds={usedSavedIds}
                  onToggle={() => setExpandedId((cur) => (cur === passenger.localId ? null : passenger.localId))}
                  onCollapseWithValidation={() => validateAndCollapse(passenger.localId)}
                  onChange={(patch) => updatePassenger(passenger.localId, patch)}
                  onUseSaved={(sp) => replacePassenger(passenger.localId, savedPassengerToPassenger(sp, passenger.isPrimaryContact))}
                  onUseBlank={() => resetPassengerToBlank(passenger.localId)}
                  onRemove={() => removePassenger(passenger.localId)}
                  onSetPrimaryContact={() => handleSetPrimaryContact(passenger.localId)}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={addPassenger}
              disabled={passengers.length >= maxPassengers}
              className="w-full rounded-3xl border border-dashed border-cyan-400/30 bg-cyan-400/[0.02] hover:bg-cyan-400/[0.06] hover:border-cyan-400/50 py-4 px-6 text-sm text-cyan-300 hover:text-cyan-200 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center gap-1.5 add-passenger-btn group cursor-pointer shadow-[0_10px_25px_rgba(0,0,0,0.2)]"
            >
              <span className="flex items-center gap-2 font-display font-bold text-sm tracking-wide">
                <span className="w-5 h-5 rounded-full bg-cyan-400/20 border border-cyan-400/40 flex items-center justify-center text-xs group-hover:scale-110 transition-transform">
                  +
                </span>
                Add Another Passenger
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {passengers.length >= maxPassengers
                  ? `All ${maxPassengers} passenger${maxPassengers > 1 ? "s" : ""} from your search added`
                  : `You selected ${maxPassengers} passenger${maxPassengers > 1 ? "s" : ""} at search — ${maxPassengers - passengers.length} more to add`}
              </span>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center text-sm shrink-0">
                  🛡️
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">256-Bit SSL</p>
                  <p className="text-[11px] text-slate-500">Bank-grade data encryption</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3.5">
                <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-sm shrink-0">
                  ⚡
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">Instant Ticketing</p>
                  <p className="text-[11px] text-slate-500">Direct airline GDS issuance</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-sm shrink-0">
                  💬
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">24/7 Support</p>
                  <p className="text-[11px] text-slate-500">NavBot & concierge desk</p>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <TripSummary
              departFlight={departFlight}
              returnFlight={returnFlight}
              passengerCount={passengers.length}
              baseFare={baseFare}
              taxesAndFees={taxesAndFees}
              total={total}
              pulseSavings={pulseSavings}
              canContinue={allValid}
              isSaving={isSaving}
              saveError={saveError}
              onContinue={handleContinue}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function Stepper({ activeId }: { activeId: number }) {
  const progressPct = ((activeId - 1) / (steps.length - 1)) * 100

  return (
    <div className="flex items-center justify-between mb-8 sm:mb-10 flex-wrap gap-y-4">
      <button
        type="button"
        onClick={() => history.back()}
        className="group flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-slate-300 hover:text-white border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-amber-400/40 transition-all shrink-0 cursor-pointer shadow-sm"
      >
        <span className="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center text-xs group-hover:-translate-x-0.5 transition-transform" aria-hidden>
          ←
        </span>
        <span>Back to Flights</span>
      </button>

      <div className="relative hidden md:flex items-center flex-1 max-w-2xl ml-8">
        <div className="absolute left-3 right-3 h-[2px] bg-white/[0.08] rounded-full" />
        <div
          className="absolute left-3 h-[2px] bg-gradient-to-r from-emerald-400 via-amber-400 to-[#D4AF37] rounded-full transition-all duration-500"
          style={{ width: `calc(${progressPct}% - ${progressPct > 0 ? 24 : 0}px)` }}
        />
        <div className="relative flex items-center justify-between w-full">
          {steps.map((step) => {
            const isDone = step.id < activeId
            const isCurrent = step.id === activeId
            return (
              <div key={step.id} className="flex flex-col items-center gap-1.5 bg-[#060B14] px-1.5 z-10">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold border-2 transition-all ${
                    isCurrent
                      ? "border-[#D4AF37] bg-[#D4AF37]/20 text-[#E8C766] shadow-[0_0_15px_rgba(212,175,55,0.4)] scale-110"
                      : isDone
                      ? "border-emerald-400/80 bg-emerald-400/15 text-emerald-300"
                      : "border-white/15 bg-white/[0.03] text-slate-500"
                  }`}
                >
                  {isDone ? <span className="tick-pop inline-block font-bold">✓</span> : step.id}
                </span>
                <span
                  className={`text-[11px] whitespace-nowrap tracking-wide ${
                    isCurrent
                      ? "text-[#E8C766] font-bold"
                      : isDone
                      ? "text-emerald-300/80 font-medium"
                      : "text-slate-500 font-medium"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex md:hidden items-center gap-1.5">
        {steps.map((step) => (
          <span
            key={step.id}
            className={`h-1.5 rounded-full transition-all ${
              step.id < activeId
                ? "bg-emerald-400 w-2"
                : step.id === activeId
                ? "bg-amber-400 w-5"
                : "bg-white/15 w-1.5"
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function BoardingPassMini({ flight, travelDate, tag }: { flight: StoredFlight; travelDate?: string; tag?: "Departure" | "Return" }) {
  const isReturn = tag === "Return"
  const logo = airlineLogos[flight.airline] || "/airlines/default.png"

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.004 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className="relative bg-gradient-to-r from-[#0C1729]/95 via-[#0F1E33]/98 to-[#0A1424]/95 border border-white/[0.12] rounded-3xl p-4 sm:p-5 lg:px-7 lg:py-4 shadow-[0_15px_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl overflow-hidden group"
    >
      {/* Top dynamic glowing hairline */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent ${
          isReturn ? "via-cyan-400" : "via-amber-400"
        } to-transparent`}
      />

      <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
        {/* Airline & Aircraft Pod */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center overflow-hidden shadow-md ring-1 ring-white/10 shrink-0 group-hover:scale-105 transition-transform">
            <img src={logo} alt={flight.airline} className="w-7 h-7 object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              {tag && (
                <span
                  className={`text-[10px] uppercase tracking-wider font-extrabold rounded-full px-2.5 py-0.5 border ${
                    isReturn
                      ? "text-cyan-300 bg-cyan-400/15 border-cyan-400/30"
                      : "text-amber-300 bg-amber-400/15 border-amber-400/30"
                  }`}
                >
                  {tag}
                </span>
              )}
              <p className="font-display font-bold text-base text-white">{flight.airline}</p>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              {flight.aircraft} <span className="text-slate-600">•</span> Economy
            </p>
          </div>
        </div>

        {/* Schedule & Animated Flight Timeline */}
        <div className="flex items-center gap-3 sm:gap-6 flex-1 justify-center max-w-md mx-auto">
          {/* Departure */}
          <div className="text-right shrink-0">
            <div className="flex items-baseline justify-end gap-1.5">
              <p className="font-display text-lg sm:text-2xl font-black tabular-nums text-white">
                {formatTime(flight.departure_time)}
              </p>
              <span className="font-display text-xs font-black text-amber-300 uppercase">
                {flight.origin}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              {formatDateLabel(flight.departure_time, travelDate)}
            </p>
          </div>

          {/* Animated Flight Vector Track */}
          <div className="flex flex-col items-center flex-1 min-w-[70px] max-w-[130px] px-2">
            <p className="text-[10px] text-slate-300 mb-1 font-semibold tracking-wide whitespace-nowrap">
              {flight.duration || "--"}
            </p>
            <div className="relative w-full h-[2.5px] bg-white/10 rounded-full flex items-center overflow-visible">
              <div
                className={`absolute inset-0 rounded-full bg-gradient-to-r ${
                  isReturn ? "from-cyan-400/60 to-blue-400/60" : "from-amber-400/60 to-amber-300/60"
                }`}
              />
              <div className="timeline-comet absolute h-[2.5px] w-6 rounded-full bg-gradient-to-r from-transparent via-white to-transparent shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
              <div className="absolute -left-1 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-cyan-400/30" />
              <div className="absolute left-1/2 -translate-x-1/2 -top-2 flex flex-col items-center">
                <span className="plane-bob text-[10px] text-amber-300 select-none">✈</span>
              </div>
              <div className="absolute -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30" />
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 font-medium whitespace-nowrap">
              {flight.stops ? `${flight.stops} stop` : "Non-stop"}
            </p>
          </div>

          {/* Arrival */}
          <div className="text-left shrink-0">
            <div className="flex items-baseline gap-1.5">
              <p className="font-display text-lg sm:text-2xl font-black tabular-nums text-white">
                {formatTime(flight.arrival_time)}
              </p>
              <span className="font-display text-xs font-black text-cyan-300 uppercase">
                {flight.destination}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              {formatDateLabel(flight.arrival_time, travelDate)}
            </p>
          </div>
        </div>

        {/* Change Flight CTA */}
        <button
          type="button"
          onClick={() => history.back()}
          className="relative overflow-hidden px-4 py-2 rounded-full border border-white/10 bg-white/[0.04] text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.08] hover:border-amber-400/40 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <span>✏️</span>
          <span>Edit Flight</span>
        </button>
      </div>
    </motion.div>
  )
}

const PAX_COLORS = [
  { ring: "border-cyan-400/40", bg: "bg-cyan-400/15", text: "text-cyan-300", glow: "shadow-[0_0_12px_rgba(34,211,238,0.2)]" },
  { ring: "border-amber-400/40", bg: "bg-amber-400/15", text: "text-amber-300", glow: "shadow-[0_0_12px_rgba(251,191,36,0.2)]" },
  { ring: "border-violet-400/40", bg: "bg-violet-400/15", text: "text-violet-300", glow: "shadow-[0_0_12px_rgba(167,139,250,0.2)]" },
  { ring: "border-emerald-400/40", bg: "bg-emerald-400/15", text: "text-emerald-300", glow: "shadow-[0_0_12px_rgba(52,211,153,0.2)]" },
]

function SavedPassengerSection({
  savedPassengers,
  usedSavedIds,
  currentSourceId,
  onUseSaved,
  onUseBlank,
}: {
  savedPassengers: SavedPassenger[]
  usedSavedIds: Set<string>
  currentSourceId?: string
  onUseSaved: (sp: SavedPassenger) => void
  onUseBlank: () => void
}) {
  if (savedPassengers.length === 0) return null

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 backdrop-blur-md">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-slate-300 flex items-center gap-2">
          <span>⚡</span>
          <span>Quick Autofill from Saved Profiles</span>
        </p>
        <span className="text-[11px] text-slate-500 hidden sm:inline">Click a card to populate fields</span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {savedPassengers.map((sp) => {
          const isThisSlot = sp.id === currentSourceId
          const usedElsewhere = usedSavedIds.has(sp.id) && !isThisSlot
          return (
            <button
              key={sp.id}
              type="button"
              disabled={usedElsewhere}
              onClick={() => onUseSaved(sp)}
              className={`group flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-2xl border text-left transition-all cursor-pointer ${
                isThisSlot
                  ? "border-amber-400/70 bg-amber-400/10 text-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.15)] ring-1 ring-amber-400/30"
                  : usedElsewhere
                  ? "border-white/[0.05] bg-white/[0.01] text-slate-600 cursor-not-allowed opacity-60"
                  : "border-white/[0.1] bg-white/[0.03] hover:border-amber-400/40 hover:bg-white/[0.06] text-slate-200"
              }`}
            >
              <span
                className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 transition-transform ${
                  isThisSlot
                    ? "bg-amber-400/25 text-amber-300 ring-1 ring-amber-400/40"
                    : usedElsewhere
                    ? "bg-white/[0.05] text-slate-600"
                    : "bg-white/[0.08] text-slate-300 group-hover:scale-105"
                }`}
              >
                {(sp.first_name?.[0] ?? "?").toUpperCase()}
                {(sp.last_name?.[0] ?? "").toUpperCase()}
              </span>
              <span className="text-xs">
                <span className="block font-bold leading-tight">
                  {sp.title ? `${sp.title} ` : ""}
                  {sp.first_name} {sp.last_name}
                </span>
                {sp.date_of_birth && (
                  <span className="block text-[10px] text-slate-400 leading-tight mt-0.5 font-medium">
                    DOB {sp.date_of_birth}
                  </span>
                )}
              </span>
              {usedElsewhere && (
                <span className="text-[9px] uppercase font-bold tracking-wider ml-1 shrink-0 text-slate-500 bg-white/[0.04] px-1.5 py-0.5 rounded">
                  In Use
                </span>
              )}
            </button>
          )
        })}
        <button
          type="button"
          onClick={onUseBlank}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl border border-dashed text-xs font-bold transition-all cursor-pointer ${
            !currentSourceId
              ? "border-cyan-400/70 bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-400/30 shadow-[0_0_12px_rgba(34,211,238,0.15)]"
              : "border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/[0.06] hover:border-cyan-400/50"
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-cyan-400/20 flex items-center justify-center text-[11px] leading-none">
            +
          </span>
          <span>New / Blank</span>
        </button>
      </div>
    </div>
  )
}

function PassengerCard({
  index,
  passenger,
  isExpanded,
  errors,
  canRemove,
  entranceDelay,
  mounted,
  savedPassengers,
  usedSavedIds,
  onToggle,
  onCollapseWithValidation,
  onChange,
  onUseSaved,
  onUseBlank,
  onRemove,
  onSetPrimaryContact,
}: {
  index: number
  passenger: Passenger
  isExpanded: boolean
  errors: FieldErrors
  canRemove: boolean
  entranceDelay: number
  mounted: boolean
  savedPassengers: SavedPassenger[]
  usedSavedIds: Set<string>
  onToggle: () => void
  onCollapseWithValidation: () => void
  onChange: (patch: Partial<Passenger>) => void
  onUseSaved: (sp: SavedPassenger) => void
  onUseBlank: () => void
  onRemove: () => void
  onSetPrimaryContact: () => void
}) {
  const isComplete = Object.keys(errors).length === 0 && passenger.firstName && passenger.lastName
  const label =
    passenger.type === "adult"
      ? `Adult ${index + 1}`
      : passenger.type === "child"
      ? `Child ${index + 1}${passenger.age ? ` (Age ${passenger.age})` : ""}`
      : `Infant ${index + 1}`
  const paxColor = PAX_COLORS[index % PAX_COLORS.length]

  return (
    <div
      className="relative bg-gradient-to-br from-[#0C1729]/95 via-[#0F1E33]/98 to-[#0A1424]/95 border border-white/[0.12] rounded-3xl overflow-hidden transition-all duration-500 ease-out card-enter ticket-edge shadow-[0_15px_40px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
      style={{
        transitionDelay: mounted ? `${entranceDelay}ms` : "0ms",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
      }}
    >
      {/* Top indicator hairline */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] transition-all duration-500 bg-gradient-to-r ${
          isComplete
            ? "from-emerald-400 via-emerald-300 to-transparent"
            : isExpanded
            ? "from-amber-400 via-amber-300 to-transparent"
            : "from-cyan-400/40 via-blue-400/40 to-transparent"
        }`}
      />

      <button
        type="button"
        onClick={isExpanded ? onCollapseWithValidation : onToggle}
        className="w-full flex items-center justify-between px-6 py-4 sm:py-5 text-left cursor-pointer group hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3.5 flex-wrap">
          <span
            className={`w-8 h-8 rounded-xl border flex items-center justify-center text-xs font-display font-extrabold ${paxColor.bg} ${paxColor.ring} ${paxColor.text} ${paxColor.glow}`}
          >
            {index + 1}
          </span>
          <span className="font-display font-bold text-base text-white tracking-tight">
            {passenger.firstName ? `${passenger.title ? `${passenger.title} ` : ""}${passenger.firstName} ${passenger.lastName}` : label}
          </span>
          {passenger.isPrimaryContact && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-extrabold tracking-wider text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-full px-2.5 py-0.5 shadow-[0_0_10px_rgba(251,191,36,0.15)]">
              <span>★</span> Primary Contact
            </span>
          )}
          {isComplete && !isExpanded && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-400/10 border border-emerald-400/25 rounded-full px-2.5 py-0.5 check-pop">
              <span>✓</span> Complete
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {canRemove && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-400/10 cursor-pointer"
            >
              <span aria-hidden>🗑</span> Remove
            </span>
          )}
          {!isExpanded && (
            <span className="text-xs font-bold text-cyan-300 group-hover:text-cyan-200 transition-colors px-2.5 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/20">
              Edit
            </span>
          )}
          <span
            className="text-slate-400 group-hover:text-white transition-transform duration-300 ease-out text-sm"
            style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
            aria-hidden
          >
            ▾
          </span>
        </div>
      </button>

      <div className="grid transition-all duration-400 ease-out" style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <div className={`px-6 pb-6 pt-2 space-y-5 transition-opacity duration-300 ${isExpanded ? "opacity-100 delay-100" : "opacity-0"}`}>
            <SavedPassengerSection
              savedPassengers={savedPassengers}
              usedSavedIds={usedSavedIds}
              currentSourceId={passenger.sourceSavedId}
              onUseSaved={onUseSaved}
              onUseBlank={onUseBlank}
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Title">
                <Select
                  value={passenger.title}
                  error={!!errors.title}
                  onChange={(v) => onChange({ title: v })}
                  options={["Mr", "Mrs", "Ms", "Dr"]}
                  placeholder="Select"
                />
              </Field>
              <Field label="First Name" className="col-span-1">
                <TextInput
                  value={passenger.firstName}
                  error={!!errors.firstName}
                  onChange={(v) => onChange({ firstName: v })}
                  placeholder="Arjun"
                />
              </Field>
              <Field label="Middle Name (Optional)">
                <TextInput
                  value={passenger.middleName}
                  onChange={(v) => onChange({ middleName: v })}
                  placeholder="Kumar"
                />
              </Field>
              <Field label="Last Name">
                <TextInput
                  value={passenger.lastName}
                  error={!!errors.lastName}
                  onChange={(v) => onChange({ lastName: v })}
                  placeholder="Sharma"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Date of Birth">
                <TextInput
                  type="date"
                  value={passenger.dob}
                  error={!!errors.dob}
                  onChange={(v) => onChange({ dob: v })}
                />
              </Field>
              <Field label="Gender">
                <Select
                  value={passenger.gender}
                  error={!!errors.gender}
                  onChange={(v) => onChange({ gender: v })}
                  options={["Male", "Female", "Other"]}
                  placeholder="Select"
                />
              </Field>
              <Field label="Nationality">
                <Select
                  value={passenger.nationality}
                  error={!!errors.nationality}
                  onChange={(v) => onChange({ nationality: v })}
                  options={["India", "United States", "United Kingdom", "UAE", "Singapore"]}
                  placeholder="Select"
                />
              </Field>
              <Field label="Frequent Flyer (Optional)">
                <TextInput
                  value={passenger.frequentFlyer}
                  onChange={(v) => onChange({ frequentFlyer: v })}
                  placeholder="AI12345678"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Email Address" helper="For ticket & flight updates">
                <TextInput
                  type="email"
                  value={passenger.email}
                  error={!!errors.email}
                  errorText={errors.email}
                  onChange={(v) => onChange({ email: v })}
                  placeholder="arjun.sharma@email.com"
                />
              </Field>
              <Field label="Mobile Number" helper="For instant SMS boarding alerts">
                <PhoneInput
                  countryCode={passenger.countryCode}
                  mobile={passenger.mobile}
                  error={!!errors.mobile}
                  errorText={errors.mobile}
                  onCountryChange={(v) => onChange({ countryCode: v })}
                  onMobileChange={(v) => onChange({ mobile: v })}
                />
              </Field>
            </div>

            <div className="pt-2 border-t border-white/[0.06]">
              <label className="flex items-center gap-3 cursor-pointer select-none group bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3.5 hover:bg-white/[0.04] transition-colors">
                <Checkbox checked={passenger.isPrimaryContact} onChange={onSetPrimaryContact} />
                <div className="flex-1">
                  <p className={`text-xs font-bold transition-colors ${passenger.isPrimaryContact ? "text-cyan-300" : "text-slate-200 group-hover:text-white"}`}>
                    Designate as Primary Contact
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    All e-tickets, terminal gates, and flight status notifications will be sent to this traveller
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, helper, children, className }: { label: string; helper?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">{label}</label>
        {helper && <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">{helper}</span>}
      </div>
      {children}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  errorText,
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  error?: boolean
  errorText?: string
}) {
  const [shake, setShake] = useState(false)
  const prevError = useRef(error)

  useEffect(() => {
    if (error && !prevError.current) {
      setShake(true)
      const t = setTimeout(() => setShake(false), 350)
      return () => clearTimeout(t)
    }
    prevError.current = error
  }, [error])

  return (
    <div>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`field-input w-full rounded-xl bg-[#08111F]/90 px-3.5 py-2.5 text-sm font-medium text-white placeholder:text-slate-500 outline-none transition-all duration-200 border shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]
        ${error ? "border-rose-400/60 text-rose-100" : "border-white/[0.10] focus:border-amber-400/70"}
        ${shake ? "field-shake" : ""}`}
      />
      {error && errorText && <p className="text-[11px] font-semibold text-rose-400 mt-1">{errorText}</p>}
    </div>
  )
}

function Select({
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  error?: boolean
}) {
  return (
    <UiSelect value={value || undefined} onValueChange={onChange}>
      <SelectTrigger
        className={`field-input w-full rounded-xl bg-[#08111F]/90 px-3.5 py-2.5 text-sm font-medium text-white border shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] h-auto
        ${error ? "border-rose-400/60" : "border-white/[0.10] data-[state=open]:border-amber-400/70"}`}
      >
        <SelectValue placeholder={placeholder || "Select"} />
      </SelectTrigger>
      <SelectContent className="bg-[#0B1526] border-white/10 text-white rounded-xl shadow-2xl backdrop-blur-xl p-1.5">
        {options.map((opt) => (
          <SelectItem key={opt} value={opt} className="rounded-lg py-2 px-3 text-sm focus:bg-amber-400/15 focus:text-amber-200 cursor-pointer">
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </UiSelect>
  )
}

function PhoneInput({
  countryCode,
  mobile,
  onCountryChange,
  onMobileChange,
  error,
  errorText,
}: {
  countryCode: string
  mobile: string
  onCountryChange: (v: string) => void
  onMobileChange: (v: string) => void
  error?: boolean
  errorText?: string
}) {
  const countries = [
    { code: "+91", flag: "🇮🇳" },
    { code: "+1", flag: "🇺🇸" },
    { code: "+44", flag: "🇬🇧" },
    { code: "+971", flag: "🇦🇪" },
  ]

  return (
    <div>
      <div className="flex gap-2">
        <UiSelect value={countryCode} onValueChange={onCountryChange}>
          <SelectTrigger className="field-input rounded-xl bg-[#08111F]/90 px-3 py-2.5 text-sm font-medium text-white border border-white/[0.10] shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] data-[state=open]:border-amber-400/70 h-auto w-[96px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0B1526] border-white/10 text-white min-w-[120px] rounded-xl shadow-2xl backdrop-blur-xl p-1.5">
            {countries.map((c) => (
              <SelectItem key={c.code} value={c.code} className="rounded-lg py-2 px-3 text-sm focus:bg-amber-400/15 focus:text-amber-200 cursor-pointer">
                {c.flag} {c.code}
              </SelectItem>
            ))}
          </SelectContent>
        </UiSelect>
        <input
          type="tel"
          value={mobile}
          placeholder="98765 43210"
          onChange={(e) => onMobileChange(e.target.value.replace(/[^\d]/g, ""))}
          className={`field-input flex-1 rounded-xl bg-[#08111F]/90 px-3.5 py-2.5 text-sm font-medium text-white placeholder:text-slate-500 outline-none transition-all duration-200 border shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] tracking-wide
          ${error ? "border-rose-400/60 text-rose-100" : "border-white/[0.10] focus:border-amber-400/70"}`}
        />
      </div>
      {error && errorText && <p className="text-[11px] font-semibold text-rose-400 mt-1">{errorText}</p>}
    </div>
  )
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all duration-200 shrink-0 cursor-pointer
      ${checked ? "bg-cyan-400 border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.4)]" : "bg-white/[0.04] border-white/20 hover:border-white/40"}`}
    >
      {checked && <span className="tick-pop text-[#060B14] text-[11px] font-black leading-none">✓</span>}
    </button>
  )
}

function TripSummary({ departFlight, returnFlight, passengerCount, baseFare, taxesAndFees, total, pulseSavings, canContinue, isSaving, saveError, onContinue }: {
  departFlight: StoredFlight; returnFlight: StoredFlight | null; passengerCount: number
  baseFare: number; taxesAndFees: number; total: number
  pulseSavings: boolean; canContinue: boolean; isSaving: boolean; saveError: string | null; onContinue: () => void
}) {
  const displayedTotal = useCountUp(total, 900)
  const isRoundTrip = !!returnFlight

  return (
    <div className="sticky top-24 space-y-4">
      <div className="relative bg-gradient-to-b from-[#0C1729]/95 via-[#0F1E33]/98 to-[#0A1424]/95 border border-white/[0.12] rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl ticket-edge">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 via-amber-400 to-amber-300" />
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <p className="text-xs uppercase tracking-[0.18em] font-extrabold text-slate-300 flex items-center gap-2">
            <span>✈️</span> Trip Summary
          </p>
          <span className="text-xs font-bold text-cyan-300 bg-cyan-400/10 border border-cyan-400/20 rounded-full px-2.5 py-1">
            {passengerCount} Passenger{passengerCount > 1 ? "s" : ""}
          </span>
        </div>

        <TripSummaryLeg flight={departFlight} tag={isRoundTrip ? "Departure" : undefined} />

        {returnFlight && (
          <>
            <div className="relative px-6">
              <div className="border-t border-dashed border-white/[0.12]" />
              <span className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-[#060B14]" />
              <span className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-[#060B14]" />
            </div>
            <TripSummaryLeg flight={returnFlight} tag="Return" />
          </>
        )}

        <div className="relative px-6">
          <div className="border-t border-dashed border-white/[0.12]" />
          <span className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-[#060B14]" />
          <span className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-[#060B14]" />
        </div>

        <div className="px-6 py-5 space-y-2.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">{passengerCount} x Adult{isRoundTrip ? " (Round Trip)" : ""}</span>
            <span className="text-slate-200 font-semibold">₹{baseFare.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Taxes & Airport Fees</span>
            <span className="text-slate-200 font-semibold">₹{taxesAndFees.toLocaleString("en-IN")}</span>
          </div>
        </div>

        <div className="px-6 pb-2">
          <div className="border border-amber-400/30 bg-amber-400/[0.08] rounded-2xl px-5 py-4 flex items-end justify-between mb-4 shadow-[0_0_20px_rgba(251,191,36,0.12)]">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Total Price</p>
              <p className="text-[11px] text-slate-500 mt-0.5">All taxes & fees included</p>
            </div>
            <span className="font-display text-3xl font-black text-amber-300 tabular-nums leading-none">
              ₹{displayedTotal.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        <div className="px-6 space-y-2.5 mb-3">
          <div className={`rounded-2xl border px-4 py-3 flex items-start gap-3 bg-emerald-400/[0.08] border-emerald-400/20 ${pulseSavings ? "savings-pulse" : ""}`}>
            <span className="text-base text-emerald-400 mt-0.5" aria-hidden>✓</span>
            <div>
              <p className="text-[13px] font-bold text-emerald-300">You're getting a good fare</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Great choice — one of our guaranteed best fares</p>
            </div>
          </div>
          <div className="rounded-2xl border px-4 py-3 flex items-start gap-3 bg-violet-400/[0.06] border-violet-400/15 relative overflow-hidden shimmer-card">
            <span className="text-base mt-0.5" aria-hidden>✨</span>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-violet-300">Unlock AI Deals</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Book now and unlock ₹1,200 exclusive savings</p>
            </div>
            <span className="text-violet-300 self-center">→</span>
          </div>
        </div>

        <div className="px-6 pb-6 pt-1">
          <button onClick={onContinue} disabled={isSaving}
            className={`continue-btn w-full px-6 py-4 rounded-full font-bold text-sm tracking-wide pill-cta transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_10px_30px_rgba(251,191,36,0.3)]
            ${!canContinue ? "opacity-90" : ""} ${isSaving ? "opacity-70 cursor-not-allowed" : ""}`}>
            {isSaving ? (
              <><span className="w-4 h-4 border-2 border-[#060B14]/30 border-t-[#060B14] rounded-full spin-loader" />Saving details…</>
            ) : (
              <>Continue to Seat Selection<span className="continue-arrow" aria-hidden>→</span></>
            )}
          </button>
          {saveError && <p className="text-[11px] text-rose-400 text-center mt-3">{saveError}</p>}
          <p className="text-[11px] text-slate-500 text-center mt-2.5">Next: choose seats for all passengers</p>
        </div>
      </div>
      <NavBotTip />
    </div>
  )
}

function TripSummaryLeg({ flight, tag }: { flight: StoredFlight; tag?: "Departure" | "Return" }) {
  const isReturn = tag === "Return"

  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center overflow-hidden shadow-sm ring-1 ring-white/10 shrink-0">
            <img src={airlineLogos[flight.airline] || "/airlines/default.png"} alt={flight.airline} className="w-5 h-5 object-contain" />
          </div>
          <p className="text-sm font-bold text-white">{flight.airline}</p>
          {tag && (
            <span
              className={`text-[9.5px] uppercase tracking-wider font-extrabold rounded-full px-2 py-0.5 border ${
                isReturn
                  ? "text-cyan-300 bg-cyan-400/15 border-cyan-400/30"
                  : "text-amber-300 bg-amber-400/15 border-amber-400/30"
              }`}
            >
              {tag}
            </span>
          )}
        </div>
        <span className="text-[10px] font-semibold text-cyan-300 bg-cyan-400/10 border border-cyan-400/20 rounded-full px-2 py-0.5">
          Economy
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-lg font-black text-white tabular-nums leading-none">
            {formatTime(flight.departure_time)}
          </p>
          <p className="font-display text-xs font-black text-amber-300 uppercase mt-1">{flight.origin}</p>
        </div>

        <div className="flex flex-col items-center flex-1 px-3">
          <p className="text-[10px] text-slate-400 mb-1 font-medium">{flight.duration || "--"}</p>
          <div className="relative w-full h-[2px] bg-white/10 rounded-full flex items-center overflow-visible">
            <div
              className={`absolute inset-0 rounded-full bg-gradient-to-r ${
                isReturn ? "from-cyan-400/60 to-blue-400/60" : "from-amber-400/60 to-amber-300/60"
              }`}
            />
            <div className="timeline-comet absolute h-[2px] w-4 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">{flight.stops ? `${flight.stops} stop` : "Non-stop"}</p>
        </div>

        <div className="text-right">
          <p className="font-display text-lg font-black text-white tabular-nums leading-none">
            {formatTime(flight.arrival_time)}
          </p>
          <p className="font-display text-xs font-black text-cyan-300 uppercase mt-1">{flight.destination}</p>
        </div>
      </div>
      <p className="text-[11px] text-slate-400 font-medium mt-2">
        {formatDateLabel(flight.departure_time, flight.travel_date)}
      </p>
    </div>
  )
}

function useCountUp(target: number, durationMs: number) {
  const [value, setValue] = useState(0)
  const startRef = useRef<number | null>(null)
  const fromRef = useRef(0)

  useEffect(() => {
    fromRef.current = value
    startRef.current = null
    let raf: number
    const tick = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const progress = Math.min(1, elapsed / durationMs)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(fromRef.current + (target - fromRef.current) * eased))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  return value
}

function NavBotTip() {
  return (
    <div className="bg-gradient-to-br from-cyan-400/[0.06] to-transparent border border-cyan-400/15 rounded-2xl p-5 flex items-start gap-3">
      <span className="text-2xl shrink-0" aria-hidden>🤖</span>
      <div>
        <p className="text-xs font-semibold text-cyan-300">NavBot Tip</p>
        <p className="text-sm text-slate-300 mt-1">Want a window seat?</p>
        <p className="text-xs text-slate-500 mt-0.5">Select your preferred seats in the next step.</p>
      </div>
    </div>
  )
}

function PageStyles() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&display=swap');

      .font-display { font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif; letter-spacing: -0.01em; }

      .ticket-edge { position: relative; }
      .ticket-edge::before {
        content: "";
        position: absolute;
        inset: 3px;
        border: 1px solid rgba(212,175,55,0.10);
        border-radius: inherit;
        pointer-events: none;
      }

      .pill-cta {
        background: linear-gradient(90deg, #38BDF8 0%, #60A5FA 30%, #D4AF37 70%, #FBBF24 100%);
        color: #060B14;
        box-shadow: 0 8px 30px rgba(56,189,248,0.18), 0 8px 30px rgba(251,191,36,0.18);
      }
      .pill-cta:hover { filter: brightness(1.06); }

      @keyframes stepPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0.35); } 50% { box-shadow: 0 0 0 6px rgba(251,191,36,0); } }
      .step-pulse { animation: stepPulse 2s ease-out infinite; }
      @keyframes tickPop { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.3); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
      .tick-pop { animation: tickPop 320ms cubic-bezier(0.34,1.56,0.64,1); }
      .check-pop { animation: tickPop 320ms cubic-bezier(0.34,1.56,0.64,1); display: inline-block; }
      .field-input:focus,
      .field-input[data-state="open"] { transform: scale(1.008); box-shadow: 0 0 0 3px rgba(251,191,36,0.12); border-color: rgba(251,191,36,0.5) !important; }
      @keyframes fieldShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
      .field-shake { animation: fieldShake 280ms ease-in-out; }
      .add-passenger-btn:hover { box-shadow: 0 0 0 1px rgba(34,211,238,0.15), 0 8px 24px rgba(34,211,238,0.08); }
      .card-enter:hover { transform: translateY(-2px) !important; }
      @keyframes savingsPulse { 0% { box-shadow: 0 0 0 0 rgba(52,211,153,0.25); } 70% { box-shadow: 0 0 0 8px rgba(52,211,153,0); } 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); } }
      .savings-pulse { animation: savingsPulse 1.6s ease-out 1; }
      .shimmer-card::after { content: ""; position: absolute; top: 0; left: -100%; width: 60%; height: 100%; background: linear-gradient(100deg, transparent, rgba(167,139,250,0.08), transparent); animation: shimmerSweep 3.5s ease-in-out infinite; }
      @keyframes shimmerSweep { 0% { left: -60%; } 100% { left: 130%; } }
      .continue-btn:hover { transform: scale(1.03); box-shadow: 0 12px 36px rgba(251,191,36,0.25); }
      .continue-btn:active { transform: scale(0.98); filter: brightness(1.05); }
      .continue-btn:hover .continue-arrow { transform: translateX(3px); }
      .continue-arrow { display: inline-block; transition: transform 200ms ease-out; }
      @keyframes spin { to { transform: rotate(360deg); } }
      .spin-loader { animation: spin 700ms linear infinite; }
      @keyframes navbotFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      .navbot-float { animation: navbotFloat 4s ease-in-out infinite; }
      .navbot-bounce { animation: navbotFloat 0.6s ease-in-out infinite; transform: scale(1.05); }
      @keyframes tooltipIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      .navbot-tooltip { animation: tooltipIn 180ms ease-out; }

      @keyframes cometTravel {
        0% { left: 0%; opacity: 0; }
        15% { opacity: 1; }
        85% { opacity: 1; }
        100% { left: 100%; opacity: 0; }
      }
      .timeline-comet {
        animation: cometTravel 2.4s ease-in-out infinite;
      }
      @keyframes planeFloat {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-2px) scale(1.1); }
      }
      .plane-bob {
        animation: planeFloat 2.6s ease-in-out infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        .step-pulse, .tick-pop, .check-pop, .field-shake,
        .savings-pulse, .shimmer-card::after, .navbot-float, .navbot-bounce,
        .navbot-tooltip, .timeline-comet, .plane-bob { animation: none !important; }
      }
    `}</style>
  )
}