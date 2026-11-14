import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { computeDynamicPrice } from '@/lib/pricing'
import { getAdminFromRequest } from '@/lib/admin-auth'

// ✅ FIXED — departure_time / arrival_time are "HH:MM:SS" strings, NOT ISO datetimes.
// Parsing them as `new Date("06:00:00")` gives Invalid Date → NaN duration.
// We now compute duration by splitting on ":" and doing pure arithmetic.
function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number)
  return h * 60 + (m || 0)
}

function getDurationMinutes(flight: any): number {
  const dep = parseTimeToMinutes(flight.departure_time || "00:00")
  let arr = parseTimeToMinutes(flight.arrival_time || "00:00")
  if (arr < dep) arr += 24 * 60
  return arr - dep
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function deriveFlightNumber(airline: string, id: string): string {
  let hash = 0
  for (let i = 0; i < (id || "").length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
    hash |= 0
  }
  const num = 100 + (Math.abs(hash) % 899)
  const a = (airline || "").toLowerCase()
  if (a.includes("indigo")) return `6E-${num}`
  if (a.includes("air india")) return `AI-${num}`
  if (a.includes("vistara")) return `UK-${num}`
  if (a.includes("emirates")) return `EK-${num}`
  if (a.includes("akasa")) return `QP-${num}`
  if (a.includes("qatar")) return `QR-${num}`
  if (a.includes("japan")) return `JL-${num}`
  if (a.includes("singapore")) return `SQ-${num}`
  return `NVG-${num}`
}

// GET flights
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const origin = searchParams.get('origin')
  const destination = searchParams.get('destination')

  // ✅ FIXED — frontend sends the outbound date as `depart` (matches roundtrip's
  // `return` param naming), not `date`. Accept `depart` as primary, fall back
  // to `date` in case any other caller uses that name.
  const date = searchParams.get('depart') || searchParams.get('date')

  // ✅ FIXED — a flight search is meaningless without a date, since seat
  // inventory is per flight_instance, not per flight. Reject early instead
  // of silently returning every date for the route.
  if (!date) {
    return NextResponse.json(
      { error: 'A travel date is required to search flights.' },
      { status: 400 }
    )
  }

  let query = supabase
    .from("flights")
    .select(`
      id,
      airline,
      origin,
      destination,
      departure_time,
      arrival_time,
      duration,
      aircraft,
      base_price,
      stops,
      stop_airport,
      flight_instances (
        id,
        travel_date,
        available_seats,
        seats_economy,
        seats_premium_economy,
        seats_business,
        seats_first,
        tax_amount,
        fee_amount,
        gate
      )
    `)

  if (origin) query = query.eq('origin', origin)
  if (destination) query = query.eq('destination', destination)

  const { data, error } = await query

  if (error) {
    console.error("Flights search error")
    return NextResponse.json({ error: "Failed to search flights" }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json([])
  }

  // 🔥 STEP 1: Standardized Dynamic Pricing Engine
  const enhancedData = await Promise.all(
    data.map(async (flight) => {
      const instances = Array.isArray(flight.flight_instances) ? flight.flight_instances : []
      let instance = date
        ? instances.find((inst: any) => String(inst.travel_date || "").slice(0, 10) === date)
        : instances[0]

      if (!instance && date) {
        // Auto-seed flight_instance row so that bookings and seat maps have a valid UUID foreign key
        try {
          const econ = 144
          const prem = 18
          const biz = 12
          const first = 6
          const total = econ + prem + biz + first
          const { data: newInst } = await supabase
            .from("flight_instances")
            .insert({
              flight_id: flight.id,
              travel_date: date,
              available_seats: total,
              seats_economy: econ,
              seats_premium_economy: prem,
              seats_business: biz,
              seats_first: first,
              tax_amount: Math.round((Number(flight.base_price) || 4500) * 0.12),
              fee_amount: 450,
              gate: `G${(Math.abs(String(flight.id).charCodeAt(0) || 1) % 20) + 1}`,
            })
            .select()
            .maybeSingle()

          if (newInst) {
            instance = newInst
          }
        } catch (e) {
          console.warn("Could not auto-create flight instance:", e)
        }
      }

      if (!instance) {
        instance = instances[0]
      }

      const basePrice = Number(flight.base_price) || 5200
      const availableSeats = Number(instance?.available_seats ?? 94)
      const travelDateStr = String(instance?.travel_date || date || new Date().toISOString().slice(0, 10))

      const pricing = computeDynamicPrice({
        basePrice,
        availableSeats,
        travelDate: travelDateStr,
      })

      const final_price = pricing.finalPrice
      const durationMins = getDurationMinutes(flight)
      const duration = formatDuration(durationMins)
      const flightNumber = (flight as any).flight_number || deriveFlightNumber(flight.airline, flight.id)

      return {
        ...flight,
        flight_number: flightNumber,
        flight_instance_id: instance?.id || flight.id,
        travel_date: travelDateStr,
        available_seats: availableSeats,
        seats_economy: instance?.seats_economy ?? 120,
        seats_premium_economy: instance?.seats_premium_economy ?? 24,
        seats_business: instance?.seats_business ?? 12,
        seats_first: instance?.seats_first ?? 0,
        tax_amount: instance?.tax_amount ?? Math.round(final_price * 0.12),
        fee_amount: instance?.fee_amount ?? Math.round(final_price * 0.07),
        gate: instance?.gate || "G1",
        status: "SCHEDULED",
        final_price,
        duration,
        duration_minutes: durationMins,
      }
    })
  )

  // 🔥 STEP 2: Ranking (Best Flights)
  const rankedFlights = [...enhancedData].sort((a, b) => {
    const priceWeight = 0.7
    const durationWeight = 0.3
    const scoreA = a.final_price * priceWeight + a.duration_minutes * durationWeight
    const scoreB = b.final_price * priceWeight + b.duration_minutes * durationWeight
    return scoreA - scoreB
  })

  // 🔥 STEP 3: Find Cheapest & Fastest
  const cheapest = [...enhancedData].sort((a, b) => a.final_price - b.final_price)[0]
  const fastest = [...enhancedData].sort((a, b) => a.duration_minutes - b.duration_minutes)[0]

  // 🔥 STEP 4: Tagging
  const taggedFlights = rankedFlights.map((flight, index) => {
    const tags: string[] = []
    if (index === 0) tags.push("Best")
    if (flight.id === cheapest.id) tags.push("Cheapest")
    if (flight.id === fastest.id) tags.push("Fastest")
    if (tags.length === 0) tags.push("Recommended")
    return { ...flight, tags }
  })

  return NextResponse.json(taggedFlights)
}

// CREATE flight (Restricted to authenticated airline administrators)
export async function POST(req: Request) {
  const admin = getAdminFromRequest(req)
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized administrative access" }, { status: 401 })
  }

  const body = await req.json()

  const { data, error } = await supabase
    .from('flights')
    .insert([body])
    .select()

  if (error) {
    console.error("Flight creation error")
    return NextResponse.json({ error: "Failed to create flight record" }, { status: 500 })
  }

  return NextResponse.json(data)
}