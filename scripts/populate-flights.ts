import { supabase } from "../lib/supabase"
import { airports } from "../lib/airports"

// ============================================================================
// NAVIGO FLIGHT INVENTORY POPULATION SCRIPT (Next 3 Calendar Months)
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

// Distance / duration estimation helper
function getRouteMetadata(origin: string, dest: string) {
  const domesticAirports = new Set(["DEL", "BLR", "BOM", "MAA", "HYD", "CCU"])
  const isDomestic = domesticAirports.has(origin) && domesticAirports.has(dest)

  if (isDomestic) {
    const pair = [origin, dest].sort().join("-")
    let duration = "2h 15m"
    let basePrice = 5200

    switch (pair) {
      case "BLR-DEL":
        duration = "2h 45m"
        basePrice = 5800
        break
      case "BOM-DEL":
        duration = "2h 10m"
        basePrice = 4950
        break
      case "DEL-MAA":
        duration = "2h 50m"
        basePrice = 5400
        break
      case "DEL-HYD":
        duration = "2h 15m"
        basePrice = 4800
        break
      case "CCU-DEL":
        duration = "2h 15m"
        basePrice = 4900
        break
      case "BLR-BOM":
        duration = "1h 45m"
        basePrice = 4200
        break
      case "BLR-MAA":
        duration = "0h 55m"
        basePrice = 3200
        break
      case "BLR-HYD":
        duration = "1h 10m"
        basePrice = 3400
        break
      case "BLR-CCU":
        duration = "2h 30m"
        basePrice = 5600
        break
      case "BOM-MAA":
        duration = "1h 55m"
        basePrice = 4400
        break
      case "BOM-HYD":
        duration = "1h 25m"
        basePrice = 3600
        break
      case "BOM-CCU":
        duration = "2h 35m"
        basePrice = 5800
        break
      case "HYD-MAA":
        duration = "1h 10m"
        basePrice = 3200
        break
      case "CCU-MAA":
        duration = "2h 15m"
        basePrice = 4700
        break
      case "CCU-HYD":
        duration = "2h 05m"
        basePrice = 4500
        break
    }

    return {
      airline: "IndiGo",
      aircraftType: AIRCRAFT_MAP["A320"],
      duration,
      basePrice,
      departure_time: "07:30:00",
      arrival_time: "10:15:00",
    }
  }

  // India <-> DXB
  if ((domesticAirports.has(origin) && dest === "DXB") || (origin === "DXB" && domesticAirports.has(dest))) {
    return {
      airline: "Emirates",
      aircraftType: AIRCRAFT_MAP["Boeing 777-300ER"],
      duration: "3h 45m",
      basePrice: 19500,
      departure_time: "09:00:00",
      arrival_time: "12:45:00",
    }
  }

  // India <-> SIN
  if ((domesticAirports.has(origin) && dest === "SIN") || (origin === "SIN" && domesticAirports.has(dest))) {
    return {
      airline: "Singapore Airlines",
      aircraftType: AIRCRAFT_MAP["Boeing 787-8 Dreamliner"],
      duration: "4h 45m",
      basePrice: 18500,
      departure_time: "11:00:00",
      arrival_time: "17:15:00",
    }
  }

  // India <-> SFO
  if ((domesticAirports.has(origin) && dest === "SFO") || (origin === "SFO" && domesticAirports.has(dest))) {
    return {
      airline: "Air India",
      aircraftType: AIRCRAFT_MAP["Boeing 777-300ER"],
      duration: "16h 00m",
      basePrice: 72000,
      departure_time: "02:30:00",
      arrival_time: "07:30:00",
    }
  }

  // DXB <-> SIN
  if ((origin === "DXB" && dest === "SIN") || (origin === "SIN" && dest === "DXB")) {
    return {
      airline: "Emirates",
      aircraftType: AIRCRAFT_MAP["Airbus A380-800"],
      duration: "7h 30m",
      basePrice: 38000,
      departure_time: "03:15:00",
      arrival_time: "15:00:00",
    }
  }

  // DXB <-> SFO
  if ((origin === "DXB" && dest === "SFO") || (origin === "SFO" && dest === "DXB")) {
    return {
      airline: "Emirates",
      aircraftType: AIRCRAFT_MAP["Airbus A380-800"],
      duration: "15h 50m",
      basePrice: 84000,
      departure_time: "08:45:00",
      arrival_time: "13:35:00",
    }
  }

  // SIN <-> SFO
  return {
    airline: "Singapore Airlines",
    aircraftType: AIRCRAFT_MAP["Boeing 777-300ER"],
    duration: "14h 40m",
    basePrice: 79000,
    departure_time: "19:00:00",
    arrival_time: "18:40:00",
  }
}

// Generate calendar date strings between start and end inclusive
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

export async function populateFlights() {
  console.log("==================================================================")
  console.log("✈️  NAVIGO: 3-MONTH FLIGHT POPULATION & VERIFICATION")
  console.log("==================================================================")

  const startDate = "2026-10-18"
  const endDate = "2027-01-18"
  const travelDates = getDatesInRange(startDate, endDate)

  console.log(`📅 Target Date Range: ${startDate} to ${endDate} (${travelDates.length} calendar days)`)
  console.log(`🏢 Registered Airports (${airports.length}):`, airports.map((a) => a.code).join(", "))

  // 1. Build all 72 directed route pairs
  const validPairs: { origin: string; destination: string }[] = []
  for (const a of airports) {
    for (const b of airports) {
      if (a.code !== b.code) {
        validPairs.push({ origin: a.code, destination: b.code })
      }
    }
  }
  console.log(`🌐 Total Valid Route Combinations: ${validPairs.length} pairs`)

  // 2. Query existing flight templates in DB
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

  console.log(`🔎 Existing flights in DB: ${existingFlights?.length || 0} covering ${flightMapByPair.size} route pairs`)

  // 3. Ensure every valid pair has at least 1 flight template in `flights` table
  let newFlightTemplatesCount = 0
  const allUsableFlights: any[] = [...(existingFlights || [])]

  for (const pair of validPairs) {
    const key = `${pair.origin}->${pair.destination}`
    if (!flightMapByPair.has(key) || flightMapByPair.get(key)!.length === 0) {
      const meta = getRouteMetadata(pair.origin, pair.destination)
      const newFlight = {
        airline: meta.airline,
        origin: pair.origin,
        destination: pair.destination,
        departure_time: meta.departure_time,
        arrival_time: meta.arrival_time,
        duration: meta.duration,
        stops: 0,
        stop_airport: null,
        base_price: meta.basePrice,
        aircraft: meta.aircraftType.name,
        aircraft_type_id: meta.aircraftType.id,
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
        console.error(`❌ Failed to insert flight template ${key}:`, insErr)
        continue
      }

      allUsableFlights.push(inserted)
      if (!flightMapByPair.has(key)) flightMapByPair.set(key, [])
      flightMapByPair.get(key)!.push(inserted)
      newFlightTemplatesCount++
    }
  }

  console.log(`✅ Flight templates ensured: ${allUsableFlights.length} total (${newFlightTemplatesCount} newly added)`)

  // 4. Query existing flight_instances in the 3-month window to guarantee idempotency
  console.log("🔎 Fetching existing flight_instances in target date range for idempotency check...")
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

    if (pErr) {
      throw new Error(`Failed to query existing instances: ${pErr.message}`)
    }
    if (!page || page.length === 0) break

    for (const inst of page) {
      existingInstanceKeys.add(`${inst.flight_id}_${String(inst.travel_date).slice(0, 10)}`)
    }
    if (page.length < PAGE_SIZE) break
    fetchFrom += PAGE_SIZE
  }
  console.log(`⚡ Existing instances in date range: ${existingInstanceKeys.size}`)

  // 5. Generate missing instances
  // For each route pair, we populate daily departures using the route's flight templates
  const instancesToInsert: any[] = []
  let skippedCount = 0

  for (const pair of validPairs) {
    const key = `${pair.origin}->${pair.destination}`
    const flightsOnRoute = flightMapByPair.get(key) || []
    if (flightsOnRoute.length === 0) continue

    // Use up to 2 distinct flight schedules per day if multiple flights exist on that route
    const selectedFlights = flightsOnRoute.slice(0, 2)

    for (const travelDate of travelDates) {
      for (let fIdx = 0; fIdx < selectedFlights.length; fIdx++) {
        const flight = selectedFlights[fIdx]
        const instanceKey = `${flight.id}_${travelDate}`

        if (existingInstanceKeys.has(instanceKey)) {
          skippedCount++
          continue
        }

        // Determine seating and pricing
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
          gate: `G${((Math.abs(flight.id.charCodeAt(0) + fIdx * 7)) % 24) + 1}`,
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
  console.log(`• Date Range:                     ${startDate} to ${endDate} (${travelDates.length} days)`)
  console.log(`• Total Flight Templates:         ${allUsableFlights.length} (${newFlightTemplatesCount} added)`)
  console.log(`• Flight Instances Created:       ${insertedCount}`)
  console.log(`• Flight Instances Skipped:       ${skippedCount} (idempotent duplicate prevention)`)
  console.log(`• Insertion Failures:             ${failureCount}`)
  console.log(`• Total Live Inventory In Range:  ${existingInstanceKeys.size + insertedCount} departures`)
  console.log("==================================================================")
}

if (require.main === module || process.argv[1]?.includes("populate-flights")) {
  populateFlights()
    .then(() => {
      console.log("✅ Flight population completed successfully!")
      process.exit(0)
    })
    .catch((err) => {
      console.error("🔥 Flight population error:", err)
      process.exit(1)
    })
}
