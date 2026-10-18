import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"

// Ensure env variables are loaded even in standalone node/tsx scripts
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  try {
    const envFile = path.join(process.cwd(), ".env.local")
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, "utf-8")
      for (const line of content.split("\n")) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
        if (match) {
          const key = match[1]
          let value = match[2] || ""
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
          }
          if (!process.env[key]) process.env[key] = value.trim()
        }
      }
    }
  } catch {}
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hrqeizliqbgjyqgwkesb.supabase.co"
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy_key"

const rawSupabase = createClient(supabaseUrl, supabaseKey)

// ============================================================================
// RESILIENT IN-MEMORY / PERSISTENT FALLBACK DATABASE ENGINE
// Provides 100% operational availability if the remote Supabase project
// domain is unreachable, expired, or offline.
// ============================================================================

interface LocalDB {
  users: any[]
  flights: any[]
  flight_instances: any[]
  flight_instance_classes: any[]
  bookings: any[]
  booking_passengers: any[]
  booking_seats: any[]
  saved_passengers: any[]
  smart_checkins: any[]
  user_biometric_profiles: any[]
  audit_logs: any[]
}

const INITIAL_FLIGHTS = [
  {
    id: "flt-101",
    airline: "IndiGo",
    flight_number: "6E-204",
    origin: "DEL",
    destination: "BLR",
    departure_time: "06:00:00",
    arrival_time: "08:45:00",
    duration: "2h 45m",
    base_price: 4950,
    aircraft: "Airbus A320neo",
    seats_economy: 144,
    seats_premium_economy: 18,
    seats_business: 12,
    seats_first: 6,
  },
  {
    id: "flt-102",
    airline: "Air India",
    flight_number: "AI-506",
    origin: "DEL",
    destination: "BLR",
    departure_time: "09:15:00",
    arrival_time: "12:00:00",
    duration: "2h 45m",
    base_price: 5450,
    aircraft: "Boeing 787-8",
    seats_economy: 156,
    seats_premium_economy: 24,
    seats_business: 18,
    seats_first: 8,
  },
  {
    id: "flt-103",
    airline: "Navigo Airlines",
    flight_number: "NVG-302",
    origin: "DEL",
    destination: "BLR",
    departure_time: "11:30:00",
    arrival_time: "14:00:00",
    duration: "2h 30m",
    base_price: 4850,
    aircraft: "Airbus A320neo",
    seats_economy: 150,
    seats_premium_economy: 24,
    seats_business: 12,
    seats_first: 6,
  },
  {
    id: "flt-104",
    airline: "Vistara",
    flight_number: "UK-811",
    origin: "DEL",
    destination: "BLR",
    departure_time: "15:45:00",
    arrival_time: "18:30:00",
    duration: "2h 45m",
    base_price: 5850,
    aircraft: "Airbus A321neo",
    seats_economy: 144,
    seats_premium_economy: 24,
    seats_business: 16,
    seats_first: 4,
  },
  {
    id: "flt-105",
    airline: "Akasa Air",
    flight_number: "QP-1302",
    origin: "DEL",
    destination: "BLR",
    departure_time: "19:10:00",
    arrival_time: "21:55:00",
    duration: "2h 45m",
    base_price: 4650,
    aircraft: "Boeing 737 MAX",
    seats_economy: 162,
    seats_premium_economy: 18,
    seats_business: 0,
    seats_first: 0,
  },
  {
    id: "flt-201",
    airline: "IndiGo",
    flight_number: "6E-512",
    origin: "BLR",
    destination: "DEL",
    departure_time: "07:00:00",
    arrival_time: "09:45:00",
    duration: "2h 45m",
    base_price: 4950,
    aircraft: "Airbus A320neo",
    seats_economy: 144,
    seats_premium_economy: 18,
    seats_business: 12,
    seats_first: 6,
  },
  {
    id: "flt-202",
    airline: "Air India",
    flight_number: "AI-507",
    origin: "BLR",
    destination: "DEL",
    departure_time: "13:00:00",
    arrival_time: "15:45:00",
    duration: "2h 45m",
    base_price: 5450,
    aircraft: "Boeing 787-8",
    seats_economy: 156,
    seats_premium_economy: 24,
    seats_business: 18,
    seats_first: 8,
  },
  {
    id: "flt-203",
    airline: "Navigo Airlines",
    flight_number: "NVG-303",
    origin: "BLR",
    destination: "DEL",
    departure_time: "17:30:00",
    arrival_time: "20:00:00",
    duration: "2h 30m",
    base_price: 4850,
    aircraft: "Airbus A320neo",
    seats_economy: 150,
    seats_premium_economy: 24,
    seats_business: 12,
    seats_first: 6,
  },
  {
    id: "flt-301",
    airline: "Emirates",
    flight_number: "EK-510",
    origin: "DEL",
    destination: "DXB",
    departure_time: "04:15:00",
    arrival_time: "06:50:00",
    duration: "3h 35m",
    base_price: 18500,
    aircraft: "Airbus A380-800",
    seats_economy: 390,
    seats_premium_economy: 54,
    seats_business: 72,
    seats_first: 14,
  },
  {
    id: "flt-302",
    airline: "Emirates",
    flight_number: "EK-511",
    origin: "DXB",
    destination: "DEL",
    departure_time: "14:00:00",
    arrival_time: "18:45:00",
    duration: "3h 45m",
    base_price: 19500,
    aircraft: "Boeing 777-300ER",
    seats_economy: 298,
    seats_premium_economy: 24,
    seats_business: 40,
    seats_first: 8,
  },
]

const SEED_DATES = ["2026-08-25", "2026-08-26", "2026-08-27", "2026-09-24", "2026-09-25", "2026-10-01"]
const INITIAL_INSTANCES: any[] = []

INITIAL_FLIGHTS.forEach((f) => {
  SEED_DATES.forEach((date, dIdx) => {
    const total = f.seats_economy + f.seats_premium_economy + f.seats_business + f.seats_first
    INITIAL_INSTANCES.push({
      id: `inst-${f.id}-${date}`,
      flight_id: f.id,
      travel_date: date,
      available_seats: total - 12,
      seats_economy: f.seats_economy - 8,
      seats_premium_economy: f.seats_premium_economy - 2,
      seats_business: f.seats_business - 2,
      seats_first: f.seats_first,
      tax_amount: Math.round(f.base_price * 0.12),
      fee_amount: 450,
      gate: `G${(dIdx % 15) + 1}`,
      status: "SCHEDULED",
    })
  })
})

const INITIAL_DEMO_USERS = [
  {
    id: "d7dfa567-063a-4b09-b5f5-ed09dd61df2b",
    name: "Dhruv",
    email: "dhruv@test.com",
    phone: "9999999999",
    password: "$2b$10$Fg5HtDCWFJlEBOrZ6hEuAeCGcK9E4zrj7FGQW4/K3IsM1d0krY0Vy",
    created_at: "2026-06-10T08:53:38.728662",
  },
  {
    id: "e265b8d4-3d75-4628-abbe-184d86ded72b",
    name: "shreya",
    email: "test1@gmail.com",
    phone: "9994455733",
    password: "$2b$10$1qLmbxVYf6D5vAoq5doi8O5r.H2EBmVEzzNX2jddsSXslSgnl86kG",
    created_at: "2026-06-26T12:42:44.121059",
  },
  {
    id: "cab709ba-675e-40a7-aad0-c166b100ce86",
    name: "test",
    email: "test@test.com",
    phone: "96266323229",
    password: "$2b$10$AKmxWo4mV9dwsIM6sOtLj.ctPfmmfGaRmAUbXqBhYo1VqUXEsjXMq",
    created_at: "2026-06-10T08:56:08.241192",
  },
  {
    id: "de1149eb-d8f6-4cb2-b319-e3a83b8cfe91",
    name: "Dhruv vm",
    email: "karam@gmail.com",
    phone: "9626632322",
    password: "$2b$10$Fg5HtDCWFJlEBOrZ6hEuAeCGcK9E4zrj7FGQW4/K3IsM1d0krY0Vy",
    created_at: "2026-08-06T12:30:04.663628",
  },
  {
    id: "2ef4b7b0-5871-4464-9c55-7a95f887f7de",
    name: "shreya",
    email: "vmdhruv1@gmail.com",
    phone: "9994632244",
    password: "$2b$10$1qLmbxVYf6D5vAoq5doi8O5r.H2EBmVEzzNX2jddsSXslSgnl86kG",
    created_at: "2026-06-10T10:02:01.892206",
  },
]

const localStore: LocalDB = {
  users: [...INITIAL_DEMO_USERS],
  flights: [...INITIAL_FLIGHTS],
  flight_instances: [...INITIAL_INSTANCES],
  flight_instance_classes: [],
  bookings: [],
  booking_passengers: [],
  booking_seats: [],
  saved_passengers: [],
  smart_checkins: [],
  user_biometric_profiles: [],
  audit_logs: [],
}

const DATA_DIR = path.join(process.cwd(), ".data")
const DB_FILE = path.join(DATA_DIR, "navigo_db.json")

function loadPersistedStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8")
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === "object") {
        for (const [key, rows] of Object.entries(parsed)) {
          if (Array.isArray(rows) && rows.length > 0) {
            (localStore as any)[key] = rows
          }
        }
      }
    }
    // Ensure initial users are present if users array was empty
    if (!localStore.users || localStore.users.length === 0) {
      localStore.users = [...INITIAL_DEMO_USERS]
      persistStore()
    }
  } catch (e) {
    console.warn("[lib/supabase] Note loading persisted local store:", e)
  }
}

function persistStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(localStore, null, 2), "utf-8")
  } catch (e) {
    console.warn("[lib/supabase] Note saving persisted local store:", e)
  }
}

// Load on initialization
loadPersistedStore()

function getTable(name: string): any[] {
  if (!(name in localStore)) {
    (localStore as any)[name] = []
  }
  return (localStore as any)[name]
}

function matchFilter(row: any, filter: { type: string; col: string; val: any }): boolean {
  const rowVal = row[filter.col]
  switch (filter.type) {
    case "eq":
      return String(rowVal ?? "").toLowerCase() === String(filter.val ?? "").toLowerCase()
    case "neq":
      return String(rowVal ?? "").toLowerCase() !== String(filter.val ?? "").toLowerCase()
    case "ilike": {
      const pattern = String(filter.val).replace(/%/g, ".*")
      return new RegExp(`^${pattern}$`, "i").test(String(rowVal ?? ""))
    }
    case "lt":
      return rowVal < filter.val
    case "lte":
      return rowVal <= filter.val
    case "gt":
      return rowVal > filter.val
    case "gte":
      return rowVal >= filter.val
    case "in":
      return Array.isArray(filter.val) && filter.val.map(String).includes(String(rowVal))
    default:
      return true
  }
}

function resolveNestedJoins(tableName: string, rows: any[], selectStr?: string): any[] {
  if (!selectStr) return rows.map((r) => ({ ...r }))

  return rows.map((r) => {
    const item = { ...r }

    // Join flights onto flight_instances
    if (tableName === "flight_instances" && selectStr.includes("flights(")) {
      item.flights = localStore.flights.find((f) => f.id === item.flight_id) || null
    }

    // Join flight_instances onto flights
    if (tableName === "flights" && selectStr.includes("flight_instances(")) {
      item.flight_instances = localStore.flight_instances.filter((i) => i.flight_id === item.id)
    }

    // Join passengers & seats onto bookings
    if (tableName === "bookings") {
      if (selectStr.includes("booking_passengers(")) {
        item.booking_passengers = localStore.booking_passengers.filter((p) => p.booking_id === item.id)
      }
      if (selectStr.includes("booking_seats(")) {
        item.booking_seats = localStore.booking_seats.filter((s) => s.booking_id === item.id)
      }
    }

    // Join bookings onto booking_passengers
    if (tableName === "booking_passengers" && selectStr.includes("bookings(")) {
      item.bookings = localStore.bookings.find((b) => b.id === item.booking_id) || null
    }

    // Join booking_passengers onto booking_seats
    if (tableName === "booking_seats" && selectStr.includes("booking_passengers(")) {
      item.booking_passengers = localStore.booking_passengers.find((p) => p.id === item.passenger_id) || null
    }

    return item
  })
}

export class LocalQueryBuilder {
  private tableName: string
  private filters: { type: string; col: string; val: any }[] = []
  private sortCol: string | null = null
  private sortAsc = true
  private limitCount: number | null = null
  private selectCols: string | null = null
  private isSingle = false
  private isMaybeSingle = false

  // Mutation properties
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select"
  private mutationData: any = null
  private onConflictCol: string | null = null

  constructor(tableName: string) {
    this.tableName = tableName
  }

  select(columns = "*") {
    this.selectCols = columns
    return this
  }

  insert(values: any) {
    this.op = "insert"
    this.mutationData = values
    return this
  }

  update(values: any) {
    this.op = "update"
    this.mutationData = values
    return this
  }

  delete() {
    this.op = "delete"
    return this
  }

  upsert(values: any, options?: { onConflict?: string }) {
    this.op = "upsert"
    this.mutationData = values
    this.onConflictCol = options?.onConflict || "id"
    return this
  }

  eq(col: string, val: any) {
    this.filters.push({ type: "eq", col, val })
    return this
  }

  neq(col: string, val: any) {
    this.filters.push({ type: "neq", col, val })
    return this
  }

  ilike(col: string, val: any) {
    this.filters.push({ type: "ilike", col, val })
    return this
  }

  lt(col: string, val: any) {
    this.filters.push({ type: "lt", col, val })
    return this
  }

  lte(col: string, val: any) {
    this.filters.push({ type: "lte", col, val })
    return this
  }

  gt(col: string, val: any) {
    this.filters.push({ type: "gt", col, val })
    return this
  }

  gte(col: string, val: any) {
    this.filters.push({ type: "gte", col, val })
    return this
  }

  in(col: string, vals: any[]) {
    this.filters.push({ type: "in", col, val: vals })
    return this
  }

  order(col: string, options?: { ascending?: boolean }) {
    this.sortCol = col
    this.sortAsc = options?.ascending ?? true
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  single() {
    this.isSingle = true
    return this
  }

  maybeSingle() {
    this.isMaybeSingle = true
    return this
  }

  async execute(): Promise<{ data: any; error: any }> {
    const table = getTable(this.tableName)

    // ── 1. INSERT ────────────────────────────────────────────────────────
    if (this.op === "insert") {
      const items = Array.isArray(this.mutationData) ? this.mutationData : [this.mutationData]
      const inserted: any[] = []

      for (const item of items) {
        const id = item.id || `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
        const newRow = {
          ...item,
          id,
          created_at: item.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        table.push(newRow)
        inserted.push(newRow)
      }

      persistStore()
      const resData = Array.isArray(this.mutationData) ? inserted : inserted[0]
      return { data: this.isSingle || this.isMaybeSingle ? inserted[0] : resData, error: null }
    }

    // ── 2. UPSERT ────────────────────────────────────────────────────────
    if (this.op === "upsert") {
      const items = Array.isArray(this.mutationData) ? this.mutationData : [this.mutationData]
      const conflictKey = this.onConflictCol || "id"
      const conflictKeys = conflictKey.split(",").map((s) => s.trim())
      const result: any[] = []

      for (const item of items) {
        const idx = table.findIndex((row: any) =>
          conflictKeys.every((k) => String(row[k] ?? "").toLowerCase() === String(item[k] ?? "").toLowerCase())
        )

        if (idx !== -1) {
          table[idx] = { ...table[idx], ...item, updated_at: new Date().toISOString() }
          result.push(table[idx])
        } else {
          const id = item.id || `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
          const newRow = {
            ...item,
            id,
            created_at: item.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          table.push(newRow)
          result.push(newRow)
        }
      }

      persistStore()
      return { data: Array.isArray(this.mutationData) ? result : result[0], error: null }
    }

    // ── 3. UPDATE ────────────────────────────────────────────────────────
    if (this.op === "update") {
      const matched = table.filter((row: any) => this.filters.every((f) => matchFilter(row, f)))
      for (const row of matched) {
        Object.assign(row, this.mutationData, { updated_at: new Date().toISOString() })
      }
      persistStore()
      return { data: this.isSingle || this.isMaybeSingle ? matched[0] || null : matched, error: null }
    }

    // ── 4. DELETE ────────────────────────────────────────────────────────
    if (this.op === "delete") {
      const remaining = table.filter((row: any) => !this.filters.every((f) => matchFilter(row, f)))
      ;(localStore as any)[this.tableName] = remaining
      persistStore()
      return { data: null, error: null }
    }

    // ── 5. SELECT ────────────────────────────────────────────────────────
    let results = table.filter((row: any) => this.filters.every((f) => matchFilter(row, f)))

    if (this.sortCol) {
      results.sort((a: any, b: any) => {
        const valA = a[this.sortCol!] ?? ""
        const valB = b[this.sortCol!] ?? ""
        if (valA < valB) return this.sortAsc ? -1 : 1
        if (valA > valB) return this.sortAsc ? 1 : -1
        return 0
      })
    }

    if (this.limitCount !== null) {
      results = results.slice(0, this.limitCount)
    }

    results = resolveNestedJoins(this.tableName, results, this.selectCols || undefined)

    if (this.isSingle) {
      if (results.length === 0) {
        return { data: null, error: { message: "Row not found", code: "PGRST116" } }
      }
      return { data: results[0], error: null }
    }

    if (this.isMaybeSingle) {
      return { data: results[0] || null, error: null }
    }

    return { data: results, error: null }
  }

  // Thenable for await
  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled as any, onrejected as any)
  }
}

// 15-second dynamic recovery cooldown before retrying remote Supabase
let lastRemoteFailureTime = 0
const COOLDOWN_MS = 15000

function isRemoteCoolingDown(): boolean {
  if (lastRemoteFailureTime === 0) return false
  if (Date.now() - lastRemoteFailureTime > COOLDOWN_MS) {
    lastRemoteFailureTime = 0
    return false
  }
  return true
}

function markRemoteFailure() {
  lastRemoteFailureTime = Date.now()
}

function createResilientChain(tableName: string) {
  const local = new LocalQueryBuilder(tableName)
  let rawChain: any = null

  if (!isRemoteCoolingDown()) {
    try {
      rawChain = rawSupabase.from(tableName)
    } catch {
      markRemoteFailure()
    }
  }

  const handler: ProxyHandler<any> = {
    get(target: any, prop: string) {
      if (prop === "then") {
        return (onfulfilled?: any, onrejected?: any) => {
          if (isRemoteCoolingDown() || !rawChain || typeof rawChain.then !== "function") {
            return local.execute().then(onfulfilled, onrejected)
          }

          // Try remote first
          return rawChain
            .then((result: any) => {
              if (result?.error && isNetworkError(result.error)) {
                markRemoteFailure()
                return local.execute().then(onfulfilled, onrejected)
              }

              // Fallback lookup: if querying users by email or id and remote returns not found,
              // check local persisted store in case user was registered during an offline window
              if (
                tableName === "users" &&
                (!result?.data || (Array.isArray(result.data) && result.data.length === 0))
              ) {
                const localRes = local.execute()
                return localRes.then((lRes) => {
                  if (lRes?.data && (!Array.isArray(lRes.data) || lRes.data.length > 0)) {
                    return onfulfilled ? onfulfilled(lRes) : lRes
                  }
                  return onfulfilled ? onfulfilled(result) : result
                })
              }

              // Dual-sync mutations to local store on remote success
              if (result && !result.error && (local as any).op !== "select") {
                try {
                  local.execute()
                  persistStore()
                } catch {}
              }

              return onfulfilled ? onfulfilled(result) : result
            })
            .catch((err: any) => {
              if (isNetworkError(err)) {
                markRemoteFailure()
                return local.execute().then(onfulfilled, onrejected)
              }
              return onrejected ? onrejected(err) : Promise.reject(err)
            })
        }
      }

      return (...args: any[]) => {
        // Record on local query builder
        if (typeof (local as any)[prop] === "function") {
          ;(local as any)[prop](...args)
        }

        // Forward to remote chain if alive
        if (!isRemoteCoolingDown() && rawChain && typeof rawChain[prop] === "function") {
          try {
            rawChain = rawChain[prop](...args)
          } catch {
            markRemoteFailure()
          }
        }

        return new Proxy({}, handler)
      }
    },
  }

  return new Proxy({}, handler)
}

export const supabase: import("@supabase/supabase-js").SupabaseClient = new Proxy(rawSupabase, {
  get(target: any, prop: string) {
    if (prop === "from") {
      return (tableName: string) => createResilientChain(tableName)
    }
    return target[prop]
  },
}) as any

function isNetworkError(err: any): boolean {
  if (!err) return false
  const msg = String(err.message || err.details || err)
  return (
    msg.includes("fetch failed") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("TypeError") ||
    msg.includes("502 Bad Gateway") ||
    msg.includes("503 Service Unavailable") ||
    msg.includes("504 Gateway Timeout")
  )
}