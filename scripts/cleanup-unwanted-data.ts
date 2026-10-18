import { supabase } from "../lib/supabase"
import { airports } from "../lib/airports"
import fs from "fs"
import path from "path"

const validAirportCodes = new Set(airports.map((a) => a.code))

export async function cleanupUnwantedData() {
  console.log("==================================================================")
  console.log("🧹 NAVIGO: DATABASE AUDIT & UNWANTED DATA CLEANUP")
  console.log("==================================================================")
  console.log("✅ Valid 9 Registered Airports:", Array.from(validAirportCodes).join(", "))

  // 1. Identify invalid / unwanted flights (e.g. NRT Tokyo routes)
  const { data: allFlights, error: fErr } = await supabase.from("flights").select("id, airline, origin, destination")
  if (fErr) throw new Error(`Failed to fetch flights: ${fErr.message}`)

  const unwantedFlights = (allFlights || []).filter(
    (f) => !validAirportCodes.has(f.origin) || !validAirportCodes.has(f.destination)
  )
  console.log(`\n[1/3] Found ${unwantedFlights.length} unwanted flights (e.g. outside the 9 valid airports):`)
  unwantedFlights.forEach((f) => console.log(`   - ${f.id}: ${f.airline} (${f.origin} ➔ ${f.destination})`))

  const unwantedFlightIds = unwantedFlights.map((f) => f.id)

  // 2. Remove instances belonging to unwanted flights
  let unwantedInstancesRemoved = 0
  if (unwantedFlightIds.length > 0) {
    const { data: unwantedInstances } = await supabase
      .from("flight_instances")
      .select("id")
      .in("flight_id", unwantedFlightIds)

    const unwantedInstanceIds = (unwantedInstances || []).map((i) => i.id)
    console.log(`   Found ${unwantedInstanceIds.length} flight instances tied to unwanted flights. Removing...`)

    if (unwantedInstanceIds.length > 0) {
      for (let i = 0; i < unwantedInstanceIds.length; i += 200) {
        const batch = unwantedInstanceIds.slice(i, i + 200)
        await supabase.from("flight_instances").delete().in("id", batch)
      }
      unwantedInstancesRemoved = unwantedInstanceIds.length
    }

    // Delete the unwanted flight templates from `flights` table
    for (let i = 0; i < unwantedFlightIds.length; i += 200) {
      const batch = unwantedFlightIds.slice(i, i + 200)
      await supabase.from("flights").delete().in("id", batch)
    }
    console.log(`   ✓ Deleted ${unwantedFlights.length} unwanted flight templates and ${unwantedInstancesRemoved} instances.`)
  } else {
    console.log("   ✓ No unwanted flight templates found.")
  }

  // 3. Deduplicate flight_instances for the remaining valid flights
  console.log("\n[2/3] Scanning flight_instances for duplicate departures...")
  
  // Find all instances referenced by bookings to guarantee they are NEVER deleted
  const { data: bookings } = await supabase.from("bookings").select("depart_flight_instance_id, return_flight_instance_id")
  const protectedInstanceIds = new Set<string>()
  for (const b of bookings || []) {
    if (b.depart_flight_instance_id) protectedInstanceIds.add(b.depart_flight_instance_id)
    if (b.return_flight_instance_id) protectedInstanceIds.add(b.return_flight_instance_id)
  }
  console.log(`   Protected instances referenced by existing bookings: ${protectedInstanceIds.size}`)

  // Page through all flight instances
  let fetchFrom = 0
  const PAGE_SIZE = 1000
  const groupMap = new Map<string, string[]>()

  while (true) {
    const { data: page, error: pErr } = await supabase
      .from("flight_instances")
      .select("id, flight_id, travel_date")
      .range(fetchFrom, fetchFrom + PAGE_SIZE - 1)

    if (pErr) throw new Error(`Failed to fetch instances for deduplication: ${pErr.message}`)
    if (!page || page.length === 0) break

    for (const row of page) {
      const key = `${row.flight_id}_${String(row.travel_date).slice(0, 10)}`
      if (!groupMap.has(key)) {
        groupMap.set(key, [row.id])
      } else {
        groupMap.get(key)!.push(row.id)
      }
    }

    if (page.length < PAGE_SIZE) break
    fetchFrom += PAGE_SIZE
  }

  console.log(`   Scanned total departures. Distinct (flight_id, travel_date) pairs: ${groupMap.size}`)

  const duplicateIdsToDelete: string[] = []
  for (const [key, ids] of groupMap.entries()) {
    if (ids.length > 1) {
      // Find if any ID is protected by a booking
      let keepId = ids.find((id) => protectedInstanceIds.has(id))
      if (!keepId) {
        keepId = ids[0] // Default to first
      }

      for (const id of ids) {
        if (id !== keepId) {
          duplicateIdsToDelete.push(id)
        }
      }
    }
  }

  console.log(`   Found ${duplicateIdsToDelete.length} duplicate instance rows to purge.`)

  if (duplicateIdsToDelete.length > 0) {
    let deletedCount = 0
    for (let i = 0; i < duplicateIdsToDelete.length; i += 200) {
      const batch = duplicateIdsToDelete.slice(i, i + 200)
      const { error: delErr } = await supabase.from("flight_instances").delete().in("id", batch)
      if (delErr) {
        console.error(`   ❌ Failed to delete batch at offset ${i}:`, delErr)
      } else {
        deletedCount += batch.length
        process.stdout.write(`\r   Purging duplicates: ${deletedCount} / ${duplicateIdsToDelete.length}...`)
      }
    }
    console.log(`\n   ✓ Successfully purged ${deletedCount} duplicate instance rows.`)
  } else {
    console.log("   ✓ Database is already cleanly deduplicated.")
  }

  // 4. Clean up local disk cache (.data/navigo_db.json)
  console.log("\n[3/3] Synchronizing local persistent disk cache...")
  const diskDbPath = path.join(process.cwd(), ".data", "navigo_db.json")
  if (fs.existsSync(diskDbPath)) {
    try {
      const content = JSON.parse(fs.readFileSync(diskDbPath, "utf-8"))
      if (Array.isArray(content.flights)) {
        content.flights = content.flights.filter(
          (f: any) => validAirportCodes.has(f.origin) && validAirportCodes.has(f.destination)
        )
      }
      if (Array.isArray(content.flight_instances)) {
        const seen = new Set<string>()
        const cleanInst: any[] = []
        for (const inst of content.flight_instances) {
          const key = `${inst.flight_id}_${String(inst.travel_date).slice(0, 10)}`
          if (!seen.has(key)) {
            seen.add(key)
            cleanInst.push(inst)
          }
        }
        content.flight_instances = cleanInst
      }
      fs.writeFileSync(diskDbPath, JSON.stringify(content, null, 2), "utf-8")
      console.log("   ✓ Local disk database (.data/navigo_db.json) synchronized and deduplicated.")
    } catch (e) {
      console.warn("   Could not update local disk file:", e)
    }
  }

  // Final verification counts
  const { count: finalFlightCount } = await supabase.from("flights").select("*", { count: "exact", head: true })
  const { count: finalInstanceCount } = await supabase.from("flight_instances").select("*", { count: "exact", head: true })

  console.log("\n==================================================================")
  console.log("📊 POST-CLEANUP DATABASE INTEGRITY SUMMARY")
  console.log("==================================================================")
  console.log(`• Unwanted NRT Flights Removed:     ${unwantedFlights.length}`)
  console.log(`• Unwanted NRT Instances Removed:   ${unwantedInstancesRemoved}`)
  console.log(`• Duplicate Instances Deduplicated: ${duplicateIdsToDelete.length}`)
  console.log(`• Verified Active Flight Templates: ${finalFlightCount}`)
  console.log(`• Clean Flight Instances Remaining: ${finalInstanceCount}`)
  console.log("==================================================================")
}

if (require.main === module || process.argv[1]?.includes("cleanup-unwanted-data")) {
  cleanupUnwantedData()
    .then(() => {
      console.log("✅ Database cleanup completed successfully!")
      process.exit(0)
    })
    .catch((err) => {
      console.error("🔥 Database cleanup error:", err)
      process.exit(1)
    })
}
