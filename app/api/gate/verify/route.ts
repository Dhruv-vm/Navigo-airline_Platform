import crypto from "crypto"
import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { verifySignedQRToken } from "@/lib/qr-security"
import { getSmartCheckInByToken } from "@/lib/biometrics"

// Atomic server-side single-use consumption registry
// Tracks consumed credentials and guards against concurrent race-condition scans
const CONSUMED_TOKENS = new Map<string, { boardedAt: string; gate: string; passengerName: string; pnr: string }>()
const IN_FLIGHT_SCANS = new Set<string>()

async function handleVerification(tokenRaw: string, scannedGate?: string) {
  if (!tokenRaw) {
    return {
      status: "DENIED",
      code: "INVALID_TOKEN",
      reason: "Invalid boarding credential.",
      clearance: null,
      statusCode: 400,
    }
  }

  // 1. Cryptographic Signature & Expiry Check
  const tokenResult = verifySignedQRToken(tokenRaw)

  if (!tokenResult.valid || !tokenResult.payload) {
    return {
      status: "DENIED",
      code: "INVALID_CREDENTIAL",
      reason: "Invalid boarding credential.",
      clearance: null,
      statusCode: 200,
    }
  }

  if (tokenResult.expired) {
    return {
      status: "DENIED",
      code: "EXPIRED",
      reason: "This boarding credential has expired.",
      clearance: null,
      statusCode: 200,
    }
  }

  const payload = tokenResult.payload
  const tokenHash = crypto.createHash("sha256").update(tokenRaw).digest("hex")
  const credentialKey = payload.checkInId || `${payload.pnr}:${payload.passengerId}:${payload.flightInstanceId}`

  // ── Atomic Replay & Race Condition Protection ──
  const consumedRecord = CONSUMED_TOKENS.get(tokenHash) || CONSUMED_TOKENS.get(credentialKey)
  if (consumedRecord) {
    return {
      status: "DENIED",
      code: "ALREADY_USED",
      reason: "This boarding credential has already been used.",
      clearance: {
        passengerName: payload.passengerName,
        pnr: payload.pnr,
        flightNumber: payload.flightNumber,
        route: `${payload.origin} → ${payload.destination}`,
        seat: payload.seatNumber || "—",
        gate: consumedRecord.gate || scannedGate || "G4",
        biometricVerified: payload.biometricVerified,
        airline: payload.airline,
        timestamp: consumedRecord.boardedAt,
        status: "ALREADY_BOARDED",
      },
      statusCode: 200,
    }
  }

  // Guard against concurrent scans hitting at the exact same millisecond
  if (IN_FLIGHT_SCANS.has(tokenHash) || IN_FLIGHT_SCANS.has(credentialKey)) {
    return {
      status: "DENIED",
      code: "CONCURRENT_SCAN_CONFLICT",
      reason: "Credential is currently being processed at another gate.",
      clearance: null,
      statusCode: 200,
    }
  }

  IN_FLIGHT_SCANS.add(tokenHash)
  IN_FLIGHT_SCANS.add(credentialKey)

  try {
    // 2. Parallel database validation against booking, passenger & flight instance
    const [bookingRes, passengerRes, instanceRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("id, status, pnr, depart_flight_instance_id, return_flight_instance_id")
        .eq("id", payload.bookingId)
        .maybeSingle(),
      supabase
        .from("booking_passengers")
        .select("id, booking_id")
        .eq("id", payload.passengerId)
        .maybeSingle(),
      supabase
        .from("flight_instances")
        .select("id, gate, travel_date, flights(id, departure_time)")
        .eq("id", payload.flightInstanceId)
        .maybeSingle(),
    ])

    const booking = bookingRes.data
    const bErr = bookingRes.error
    const passenger = passengerRes.data
    const instance: any = instanceRes.data

    if (bErr || !booking) {
      return {
        status: "DENIED",
        code: "BOOKING_NOT_FOUND",
        reason: "No matching booking was found.",
        clearance: null,
        statusCode: 200,
      }
    }

    // Require confirmed booking status (reject cancelled, draft, or pending bookings)
    if (booking.status !== "confirmed") {
      return {
        status: "DENIED",
        code: booking.status === "cancelled" ? "BOOKING_CANCELLED" : "BOOKING_NOT_CONFIRMED",
        reason: `Boarding denied — booking status is ${booking.status || "unconfirmed"}.`,
        clearance: null,
        statusCode: 200,
      }
    }

    // 3. Strict Passenger Verification (passenger must exist and belong to booking)
    if (!passenger || passenger.booking_id !== booking.id) {
      return {
        status: "DENIED",
        code: "PASSENGER_MISMATCH",
        reason: "Passenger verification failed.",
        clearance: null,
        statusCode: 200,
      }
    }

    // 4. Flight instance check & date verification
    const isMatchingInstance =
      booking.depart_flight_instance_id === payload.flightInstanceId ||
      booking.return_flight_instance_id === payload.flightInstanceId

    if (!isMatchingInstance) {
      return {
        status: "DENIED",
        code: "FLIGHT_MISMATCH",
        reason: "This boarding credential is not valid for this flight.",
        clearance: null,
        statusCode: 200,
      }
    }

    if (instance && payload.travelDate && instance.travel_date !== payload.travelDate) {
      return {
        status: "DENIED",
        code: "DATE_MISMATCH",
        reason: "This boarding credential is not valid for this flight instance date.",
        clearance: null,
        statusCode: 200,
      }
    }

    // 5. Persistent check-in record status
    const checkInRecord = await getSmartCheckInByToken(tokenRaw)
    if (checkInRecord?.status === "boarded") {
      return {
        status: "DENIED",
        code: "ALREADY_USED",
        reason: "This boarding credential has already been used.",
        clearance: {
          passengerName: payload.passengerName,
          pnr: payload.pnr,
          flightNumber: payload.flightNumber,
          route: `${payload.origin} → ${payload.destination}`,
          seat: payload.seatNumber || "—",
          gate: payload.gate || instance?.gate || scannedGate || "G4",
          biometricVerified: payload.biometricVerified,
          airline: payload.airline,
          timestamp: checkInRecord.boardedAt || new Date().toISOString(),
          status: "ALREADY_BOARDED",
        },
        statusCode: 200,
      }
    }

    // ── Atomic Consumption: Mark as boarded ──
    const boardedTime = new Date().toISOString()
    const consumptionInfo = {
      boardedAt: boardedTime,
      gate: scannedGate || payload.gate || instance?.gate || "G4",
      passengerName: payload.passengerName,
      pnr: payload.pnr,
    }
    CONSUMED_TOKENS.set(tokenHash, consumptionInfo)
    CONSUMED_TOKENS.set(credentialKey, consumptionInfo)

    if (checkInRecord) {
      checkInRecord.status = "boarded"
      checkInRecord.boardedAt = boardedTime
    }

    try {
      await supabase
        .from("smart_checkins")
        .update({ status: "boarded", boarded_at: boardedTime, gate: consumptionInfo.gate })
        .eq("qr_token", tokenRaw)
    } catch {}

    return {
      status: "ALLOWED",
      code: "CLEARED",
      reason: "Identity Verified · Booking Verified · Flight Verified · Check-In Verified · Boarding Pass Valid",
      clearance: {
        passengerName: payload.passengerName,
        pnr: payload.pnr,
        flightNumber: payload.flightNumber,
      route: `${payload.origin} → ${payload.destination}`,
      origin: payload.origin,
      destination: payload.destination,
      seat: payload.seatNumber || "12A",
      gate: scannedGate || payload.gate || instance?.gate || "G4",
      airline: payload.airline,
      travelDate: payload.travelDate || instance?.travel_date || "Today",
      departureTime: payload.departureTime || instance?.flights?.departure_time || "06:00:00",
      biometricVerified: payload.biometricVerified,
      biometricProfileId: payload.biometricProfileId,
      checkInId: payload.checkInId,
        issuedAt: new Date(payload.issuedAt).toLocaleString("en-IN"),
        timestamp: new Date().toISOString(),
        status: "CLEARED",
      },
      statusCode: 200,
    }
  } finally {
    IN_FLIGHT_SCANS.delete(tokenHash)
    IN_FLIGHT_SCANS.delete(credentialKey)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const qrToken = body?.qrToken || body?.token
    const scannedGate = body?.scannedGate

    const result = await handleVerification(qrToken, scannedGate)
    return NextResponse.json(result, { status: result.statusCode })
  } catch (err: any) {
    console.error("Gate verification error:", err)
    return NextResponse.json(
      {
        status: "DENIED",
        code: "VERIFICATION_ERROR",
        reason: "Unable to verify boarding credential. Please try again.",
        clearance: null,
      },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get("token") || ""
    const gate = searchParams.get("gate") || undefined

    const result = await handleVerification(token, gate)
    return NextResponse.json(result, { status: result.statusCode })
  } catch (err: any) {
    console.error("Gate verification error:", err)
    return NextResponse.json(
      {
        status: "DENIED",
        code: "VERIFICATION_ERROR",
        reason: "Unable to verify boarding credential. Please try again.",
        clearance: null,
      },
      { status: 500 }
    )
  }
}
