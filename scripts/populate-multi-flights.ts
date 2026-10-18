import { supabase } from "../lib/supabase"
import { airports } from "../lib/airports"
import fs from "fs"
import path from "path"

// ============================================================================
// NAVIGO MULTI-FLIGHT POPULATION & VERIFICATION SCRIPT
// Ensures 3-4 diverse flight options per route with Singapore Airlines & logos
// ============================================================================

const AIRCRAFT_MAP: Record<string, { id: string; name: string; total: number; econ: number; prem: number; biz: number; first: number }> = {
  "A320": {
    id: "d54bbac2-c011-422f-b96a-c5da4909a427",
    name: "A320",
    total: 180,
    econ: 144,
    prem: 18,
    biz: 12,
    first: 6,
  },
  "A321": {
    id: "19afcc03-6fa1-4d4f-ab5a-3bb34b05472c",
    name: "A321",
    total: 220,
    econ: 176,
    prem: 24,
    biz: 16,
    first: 4,
  },
  "Boeing 787-8 Dreamliner": {
    id: "2d7ae529-4801-44e5-b69a-2bb4821cc13d",
    name: "Boeing 787-8 Dreamliner",
    total: 256,
    econ: 156,
    prem: 24,
    biz: 18,
    first: 8,
  },
  "Boeing 777-300ER": {
    id: "db5bb6cf-60b7-4c91-813f-49b984e8fc53",
    name: "Boeing 777-300ER",
    total: 354,
    econ: 298,
    prem: 24,
    biz: 40,
    first: 8,
  },
  "Airbus A380-800": {
    id: "129f5600-1b88-45f5-943c-29ce28e6f796",
    name: "Airbus A380-800",
    total: 484,
    econ: 390,
    prem: 54,
    biz: 72,
    first: 14,
  },
}

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

function formatMinutesToTime(mins: number): string {
  const normalized = ((mins % (24 * 60)) + (24 * 60)) % (24 * 60)
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h 00m`
}

function getBaseRouteInfo(origin: string, dest: string): { durationMins: number; basePrice: number; category: "domestic" | "singapore" | "dubai" | "sfo" | "intl" } {
  const domesticAirports = new Set(["DEL", "BLR", "BOM", "MAA", "HYD", "CCU"])
  const isDomestic = domesticAirports.has(origin) && domesticAirports.has(dest)

  if (isDomestic) {
    const pair = [origin, dest].sort().join("-")
    let durationMins = 135
    let basePrice = 5200

    switch (pair) {
      case "BLR-DEL": durationMins = 165; basePrice = 5800; break
      case "BOM-DEL": durationMins = 130; basePrice = 4950; break
      case "DEL-MAA": durationMins = 170; basePrice = 5400; break
      case "DEL-HYD": durationMins = 135; basePrice = 4800; break
      case "CCU-DEL": durationMins = 135; basePrice = 4900; break
      case "BLR-BOM": durationMins = 105; basePrice = 4200; break
      case "BLR-MAA": durationMins = 55; basePrice = 3200; break
      case "BLR-HYD": durationMins = 70; basePrice = 3400; break
      case "BLR-CCU": durationMins = 150; basePrice = 5600; break
      case "BOM-MAA": durationMins = 115; basePrice = 4400; break
      case "BOM-HYD": durationMins = 85; basePrice = 3600; break
      case "BOM-CCU": durationMins = 155; basePrice = 5800; break
      case "HYD-MAA": durationMins = 70; basePrice = 3200; break
      case "CCU-MAA": durationMins = 135; basePrice = 4700; break
      case "CCU-HYD": durationMins = 125; basePrice = 4500; break
    }
    return { durationMins, basePrice, category: "domestic" }
  }

  // Singapore routes
  if (origin === "SIN" || dest === "SIN") {
    if (origin === "DXB" || dest === "DXB") {
      return { durationMins: 450, basePrice: 38000, category: "intl" }
    }
    if (origin === "SFO" || dest === "SFO") {
      return { durationMins: 880, basePrice: 79000, category: "sfo" }
    }
    // India <-> SIN
    let durationMins = 285
    let basePrice = 18500
    const indAirport = origin === "SIN" ? dest : origin
    if (indAirport === "DEL") { durationMins = 330; basePrice = 21000 }
    else if (indAirport === "BOM") { durationMins = 315; basePrice = 19800 }
    else if (indAirport === "MAA") { durationMins = 240; basePrice = 15500 }
    else if (indAirport === "HYD") { durationMins = 275; basePrice = 17500 }
    else if (indAirport === "CCU") { durationMins = 250; basePrice = 16000 }
    return { durationMins, basePrice, category: "singapore" }
  }

  // Dubai routes
  if (origin === "DXB" || dest === "DXB") {
    if (origin === "SFO" || dest === "SFO") {
      return { durationMins: 950, basePrice: 84000, category: "sfo" }
    }
    // India <-> DXB
    let durationMins = 225
    let basePrice = 19500
    const indAirport = origin === "DXB" ? dest : origin
    if (indAirport === "BLR") { durationMins = 245; basePrice = 19000 }
    else if (indAirport === "BOM") { durationMins = 200; basePrice = 18000 }
    else if (indAirport === "MAA") { durationMins = 260; basePrice = 19500 }
    else if (indAirport === "HYD") { durationMins = 240; basePrice = 18500 }
    else if (indAirport === "CCU") { durationMins = 290; basePrice = 20500 }
    return { durationMins, basePrice, category: "dubai" }
  }

  // SFO routes (India <-> SFO)
  let durationMins = 960
  let basePrice = 72000
  const indAirport = origin === "SFO" ? dest : origin
  if (indAirport === "BOM") { durationMins = 990; basePrice = 74000 }
  else if (indAirport === "BLR") { durationMins = 1020; basePrice = 76000 }
  return { durationMins, basePrice, category: "sfo" }
}

// Generate desirable 4-flight schedule template for any route
function getIdealSchedule(origin: string, dest: string) {
  const { durationMins, basePrice, category } = getBaseRouteInfo(origin, dest)

  if (category === "singapore") {
    return [
      {
        airline: "Singapore Airlines",
        aircraft: AIRCRAFT_MAP["Boeing 787-8 Dreamliner"],
        departure_time: "11:00:00",
        arrival_time: formatMinutesToTime(parseTimeToMinutes("11:00:00") + durationMins),
        duration: formatDuration(durationMins),
        base_price: basePrice,
      },
      {
        airline: "IndiGo",
        aircraft: AIRCRAFT_MAP["A321"],
        departure_time: "06:15:00",
        arrival_time: formatMinutesToTime(parseTimeToMinutes("06:15:00") + durationMins + 15),
        duration: formatDuration(durationMins + 15),
        base_price: Math.round(basePrice * 0.74), // Budget low fare
      },
      {
        airline: "Air India",
        aircraft: AIRCRAFT_MAP["Boeing 787-8 Dreamliner"],
        departure_time: "15:45:00",
        arrival_time: formatMinutesToTime(parseTimeToMinutes("15:45:00") + durationMins + 10),
        duration: formatDuration(durationMins + 10),
        base_price: Math.round(basePrice * 0.90),
      },
      {
        airline: "Vistara",
        aircraft: AIRCRAFT_MAP["A321"],
        departure_time: "21:30:00",
        arrival_time: formatMinutesToTime(parseTimeToMinutes("21:30:00") + durationMins),
        duration: formatDuration(durationMins),
        base_price: Math.round(basePrice * 0.96),
      },
    ]
  }

  if (category === "dubai") {
    return [
      {
        airline: "Emirates",
        aircraft: AIRCRAFT_MAP["Boeing 777-300ER"],
        departure_time: "09:00:00",
        arrival_time: formatMinutesToTime(parseTimeToMinutes("09:00:00") + durationMins),
        duration: formatDuration(durationMins),
        base_price: basePrice,
      },
      {
        airline: "IndiGo",
        aircraft: AIRCRAFT_MAP["A321"],
        departure_time: "06:45:00",
        arrival_time: formatMinutesToTime(parseTimeToMinutes("06:45:00") + durationMins + 10),
        duration: formatDuration(durationMins + 10),
        base_price: Math.round(basePrice * 0.72),
      },
      {
        airline: "Air India",
        aircraft: AIRCRAFT_MAP["Boeing 787-8 Dreamliner"],
        departure_time: "14:15:00",
        arrival_time: formatMinutesToTime(parseTimeToMinutes("14:15:00") + durationMins),
        duration: formatDuration(durationMins),
        base_price: Math.round(basePrice * 0.88),
      },
      {
        airline: "Qatar Airways",
        aircraft: AIRCRAFT_MAP["Boeing 787-8 Dreamliner"],
        departure_time: "22:15:00",
        arrival_time: formatMinutesToTime(parseTimeToMinutes("22:15:00") + durationMins + 15),
        duration: formatDuration(durationMins + 15),
        base_price: Math.round(basePrice * 0.94),
      },
    ]
  }

  if (category === "sfo") {
    if (origin === "SIN" || dest === "SIN") {
      return [
        {
          airline: "Singapore Airlines",
          aircraft: AIRCRAFT_MAP["Boeing 777-300ER"],
          departure_time: "19:00:00",
          arrival_time: formatMinutesToTime(parseTimeToMinutes("19:00:00") + durationMins),
          duration: formatDuration(durationMins),
          base_price: basePrice,
        },
        {
          airline: "Singapore Airlines",
          aircraft: AIRCRAFT_MAP["Boeing 787-8 Dreamliner"],
          departure_time: "09:15:00",
          arrival_time: formatMinutesToTime(parseTimeToMinutes("09:15:00") + durationMins),
          duration: formatDuration(durationMins),
          base_price: Math.round(basePrice * 0.95),
        },
        {
          airline: "Air India",
          aircraft: AIRCRAFT_MAP["Boeing 777-300ER"],
          departure_time: "23:30:00",
          arrival_time: formatMinutesToTime(parseTimeToMinutes("23:30:00") + durationMins + 30),
          duration: formatDuration(durationMins + 30),
          base_price: Math.round(basePrice * 0.89),
        },
      ]
    }
    return [
      {
        airline: "Air India",
        aircraft: AIRCRAFT_MAP["Boeing 777-300ER"],
        departure_time: "02:30:00",
        arrival_time: formatMinutesToTime(parseTimeToMinutes("02:30:00") + durationMins),
        duration: formatDuration(durationMins),
        base_price: basePrice,
      },
      {
        airline: "Singapore Airlines",
        aircraft: AIRCRAFT_MAP["Boeing 777-300ER"],
        departure_time: "13:00:00",
        arrival_time: formatMinutesToTime(parseTimeToMinutes("13:00:00") + durationMins + 45),
        duration: formatDuration(durationMins + 45),
        base_price: Math.round(basePrice * 1.08),
      },
      {
        airline: "Emirates",
        aircraft: AIRCRAFT_MAP["Airbus A380-800"],
        departure_time: "19:45:00",
        arrival_time: formatMinutesToTime(parseTimeToMinutes("19:45:00") + durationMins + 60),
        duration: formatDuration(durationMins + 60),
        base_price: Math.round(basePrice * 1.15),
      },
    ]
  }

  // Domestic routes
  return [
    {
      airline: "IndiGo",
      aircraft: AIRCRAFT_MAP["A320"],
      departure_time: "06:30:00",
      arrival_time: formatMinutesToTime(parseTimeToMinutes("06:30:00") + durationMins),
      duration: formatDuration(durationMins),
      base_price: Math.round(basePrice * 0.86), // Cheapest morning
    },
    {
      airline: "Air India",
      aircraft: AIRCRAFT_MAP["A320"],
      departure_time: "11:45:00",
      arrival_time: formatMinutesToTime(parseTimeToMinutes("11:45:00") + durationMins + 5),
      duration: formatDuration(durationMins + 5),
      base_price: Math.round(basePrice * 1.02),
    },
    {
      airline: "Vistara",
      aircraft: AIRCRAFT_MAP["A321"],
      departure_time: "17:15:00",
      arrival_time: formatMinutesToTime(parseTimeToMinutes("17:15:00") + durationMins),
      duration: formatDuration(durationMins),
      base_price: Math.round(basePrice * 1.12), // Premium Best
    },
    {
      airline: "Akasa Air",
      aircraft: AIRCRAFT_MAP["A320"],
      departure_time: "21:15:00",
      arrival_time: formatMinutesToTime(parseTimeToMinutes("21:15:00") + durationMins),
      duration: formatDuration(durationMins),
      base_price: Math.round(basePrice * 0.88), // Late budget
    },
  ]
}

function getDatesInRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = []
  const current = new Date(startDateStr)
  const end = new Date(endDateStr)
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10))
    current.setDate(current.getDate() + 1)
  }
  return dates
}

export async function populateMultiFlights() {
  console.log("==================================================================")
  console.log("✈️  NAVIGO: MULTI-FLIGHT SCHEDULE POPULATION (3-4 Flights/Route)")
  console.log("==================================================================")

  const startDate = "2026-10-18"
  const endDate = "2027-01-18"
  const travelDates = getDatesInRange(startDate, endDate)
  console.log(`📅 Target Date Range: ${startDate} to ${endDate} (${travelDates.length} days)`)

  // 1. Compute valid route pairs
  const validPairs: { origin: string; destination: string }[] = []
  for (const a of airports) {
    for (const b of airports) {
      if (a.code !== b.code) {
        validPairs.push({ origin: a.code, destination: b.code })
      }
    }
  }
  console.log(`🌐 Total Valid Route Combinations: ${validPairs.length} pairs`)

  // 2. Fetch all existing flights from DB
  const { data: existingFlights, error: flErr } = await supabase
    .from("flights")
    .select("id, airline, origin, destination, base_price, departure_time, arrival_time, duration, aircraft, aircraft_type_id")

  if (flErr) {
    throw new Error(`Failed to query flights: ${flErr.message}`)
  }

  const flightMapByPair = new Map<string, any[]>()
  for (const fl of existingFlights || []) {
    const key = `${fl.origin}->${fl.destination}`
    if (!flightMapByPair.has(key)) flightMapByPair.set(key, [])
    flightMapByPair.get(key)!.push(fl)
  }

  console.log(`🔎 Current flight templates in DB: ${existingFlights?.length || 0}`)

  // 3. For each route pair, ensure 3 to 4 distinct flight templates exist
  let newFlightTemplatesCount = 0
  const allUsableFlights: any[] = [...(existingFlights || [])]

  for (const pair of validPairs) {
    const key = `${pair.origin}->${pair.destination}`
    const existingForRoute = flightMapByPair.get(key) || []
    const idealSchedules = getIdealSchedule(pair.origin, pair.destination)

    // Check if we need more flights for this route
    for (const ideal of idealSchedules) {
      // Check if an existing flight on this route already matches this airline & departure hour
      const alreadyHas = existingForRoute.some((ef) => {
        const sameAirline = ef.airline?.toLowerCase() === ideal.airline.toLowerCase()
        const efHour = parseInt(ef.departure_time?.split(":")[0] || "0", 10)
        const idHour = parseInt(ideal.departure_time.split(":")[0], 10)
        return sameAirline && Math.abs(efHour - idHour) <= 2
      })

      if (!alreadyHas) {
        const newFlight = {
          airline: ideal.airline,
          origin: pair.origin,
          destination: pair.destination,
          departure_time: ideal.departure_time,
          arrival_time: ideal.arrival_time,
          duration: ideal.duration,
          stops: 0,
          stop_airport: null,
          base_price: ideal.base_price,
          aircraft: ideal.aircraft.name,
          aircraft_type_id: ideal.aircraft.id,
          rating: null,
          rating_count: 0,
          on_time_pct: null,
        }

        const { data: inserted, error: insErr } = await supabase
          .from("flights")
          .insert([newFlight])
          .select()
          .single()

        if (insErr) {
          console.error(`❌ Failed to insert flight template ${key} (${ideal.airline}):`, insErr)
          continue
        }

        allUsableFlights.push(inserted)
        existingForRoute.push(inserted)
        flightMapByPair.set(key, existingForRoute)
        newFlightTemplatesCount++
      }
    }
  }

  console.log(`✅ Flight templates after expansion: ${allUsableFlights.length} total (${newFlightTemplatesCount} newly added)`)

  // 4. Query all existing flight_instances in the 3-month window for idempotency
  console.log("🔎 Fetching existing flight_instances in target date range for idempotency...")
  const existingInstanceKeys = new Set<string>()
  let fetchFrom = 0
  const PAGE_SIZE = 1000
  while (true) {
    const { data: page, error: pErr } = await supabase
      .from("flight_instances")
      .select("flight_id, travel_date")
      .gte("travel_date", startDate)
      .lte("travel_date", endDate)
      .range(fetchFrom, fetchFrom + PAGE_SIZE - 1)

    if (pErr) throw new Error(`Failed to query existing instances: ${pErr.message}`)
    if (!page || page.length === 0) break

    for (const inst of page) {
      existingInstanceKeys.add(`${inst.flight_id}_${String(inst.travel_date).slice(0, 10)}`)
    }
    if (page.length < PAGE_SIZE) break
    fetchFrom += PAGE_SIZE
  }
  console.log(`⚡ Existing instances in date range: ${existingInstanceKeys.size}`)

  // 5. Generate missing instances for EVERY flight template on EVERY route
  const instancesToInsert: any[] = []
  let skippedCount = 0

  for (const pair of validPairs) {
    const key = `${pair.origin}->${pair.destination}`
    const flightsOnRoute = flightMapByPair.get(key) || []
    if (flightsOnRoute.length === 0) continue

    for (const travelDate of travelDates) {
      for (let fIdx = 0; fIdx < flightsOnRoute.length; fIdx++) {
        const flight = flightsOnRoute[fIdx]
        const instanceKey = `${flight.id}_${travelDate}`

        if (existingInstanceKeys.has(instanceKey)) {
          skippedCount++
          continue
        }

        const acKey = Object.keys(AIRCRAFT_MAP).find((k) => (flight.aircraft || "").includes(k)) || "A320"
        const ac = AIRCRAFT_MAP[acKey] || AIRCRAFT_MAP["A320"]
        const basePrice = Number(flight.base_price) || 5200

        instancesToInsert.push({
          flight_id: flight.id,
          travel_date: travelDate,
          available_seats: ac.total,
          seats_economy: ac.econ,
          seats_premium_economy: ac.prem,
          seats_business: ac.biz,
          seats_first: ac.first,
          tax_amount: Math.round(basePrice * 0.12),
          fee_amount: 450,
          gate: `G${((Math.abs((flight.id || "a").charCodeAt(0) + fIdx * 7)) % 24) + 1}`,
        })
      }
    }
  }

  console.log(`📦 Generated ${instancesToInsert.length} instances to insert (skipped ${skippedCount} already existing)`)

  // 6. Batch insert instances into Supabase (batches of 250)
  const BATCH_SIZE = 250
  let insertedCount = 0
  let failureCount = 0

  for (let i = 0; i < instancesToInsert.length; i += BATCH_SIZE) {
    const batch = instancesToInsert.slice(i, i + BATCH_SIZE)
    const { error: batchErr } = await supabase.from("flight_instances").insert(batch)

    if (batchErr) {
      console.error(`❌ Batch insert failed at offset ${i}:`, batchErr)
      failureCount += batch.length
    } else {
      insertedCount += batch.length
      process.stdout.write(`\r🚀 Inserted ${insertedCount} / ${instancesToInsert.length} instances...`)
    }
  }

  console.log("\n==================================================================")
  console.log("📊 POPULATION SUMMARY & STATISTICS")
  console.log("==================================================================")
  console.log(`• Airports Covered:               ${airports.length}`)
  console.log(`• Valid Route Pairs:              ${validPairs.length} directed pairs`)
  console.log(`• Total Flight Templates:         ${allUsableFlights.length} (${newFlightTemplatesCount} added)`)
  console.log(`• Flight Instances Created:       ${insertedCount}`)
  console.log(`• Flight Instances Skipped:       ${skippedCount} (idempotent duplicate prevention)`)
  console.log(`• Insertion Failures:             ${failureCount}`)
  console.log(`• Total Live Inventory In Range:  ${existingInstanceKeys.size + insertedCount} departures`)
  console.log("==================================================================")
}

if (require.main === module || process.argv[1]?.includes("populate-multi-flights")) {
  populateMultiFlights()
    .then(() => {
      console.log("✅ Multi-flight population completed successfully!")
      process.exit(0)
    })
    .catch((err) => {
      console.error("🔥 Multi-flight population error:", err)
      process.exit(1)
    })
}
