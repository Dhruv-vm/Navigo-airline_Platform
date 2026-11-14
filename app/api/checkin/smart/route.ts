import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/auth"
import { generateSignedQRToken } from "@/lib/qr-security"
import { saveSmartCheckIn, getBiometricProfile, saveBiometricProfile } from "@/lib/biometrics"
import { deriveFlightNumber } from "@/app/checkout/payment/bookingUtils"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      bookingId,
      passengerId,
      flightInstanceId,
      pnr,
      biometricProfileId: providedBioId,
      faceEmbedding,
      passengerName: rawPaxName,
    } = body

    if (!pnr || !bookingId) {
      return NextResponse.json({ error: "Missing required booking identifiers" }, { status: 400 })
    }

    // 1. Fetch booking record
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("id, pnr, user_id, depart_flight_instance_id")
      .eq("id", bookingId)
      .single()

    if (bErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const targetInstanceId = flightInstanceId || booking.depart_flight_instance_id

    // Fetch passenger, instance, and seat in parallel
    const [passengersRes, instanceRes, seatRowRes] = await Promise.all([
      supabase
        .from("booking_passengers")
        .select("id, title, first_name, last_name")
        .eq("booking_id", booking.id),
      supabase
        .from("flight_instances")
        .select("id, travel_date, gate, flights(airline, origin, destination, departure_time)")
        .eq("id", targetInstanceId)
        .single(),
      supabase
        .from("booking_seats")
        .select("seat_number")
        .eq("booking_id", booking.id)
        .eq("flight_instance_id", targetInstanceId)
        .maybeSingle(),
    ])

    const passengers = passengersRes.data
    const instance: any = instanceRes.data
    const seatRow = seatRowRes.data

    const pax = (passengers || []).find((p: any) => p.id === passengerId) || passengers?.[0]
    const passengerName = pax
      ? `${pax.title ? pax.title + " " : ""}${pax.first_name} ${pax.last_name}`.trim()
      : rawPaxName || "Traveler"

    const flight: any = Array.isArray(instance?.flights) ? instance?.flights[0] : instance?.flights
    const airline = flight?.airline || "Navigo Airlines"
    const flightNumber = deriveFlightNumber(airline, targetInstanceId)
    const seatNumber = seatRow?.seat_number || "Auto"
    const gate = instance?.gate || "TBA"

    // 2. Resolve or create Biometric Profile
    const authUser = getUserFromRequest(req)
    const userId = booking.user_id || authUser?.userId || "guest-passenger"
    let bioProfileId = providedBioId

    if (!bioProfileId && userId !== "guest-passenger") {
      const existingProfile = await getBiometricProfile(userId)
      if (existingProfile && existingProfile.isActive) {
        bioProfileId = existingProfile.biometricProfileId
      } else {
        const newProfile = await saveBiometricProfile({
          userId,
          consentGiven: true,
          faceEmbedding,
          seedName: passengerName,
        })
        bioProfileId = newProfile.biometricProfileId
      }
    }

    if (!bioProfileId) {
      bioProfileId = `BIO-NVG-${Date.now().toString(36).toUpperCase()}`
    }

    const checkInId = `CHK-NVG-${crypto.randomUUID().slice(0, 8).toUpperCase()}`

    // 3. Generate Secure Signed Cryptographic QR Token
    const qrToken = generateSignedQRToken({
      pnr: booking.pnr,
      bookingId: booking.id,
      passengerId: pax?.id || "pax-1",
      passengerName,
      flightInstanceId: targetInstanceId,
      flightNumber,
      airline,
      origin: flight?.origin || "DEL",
      destination: flight?.destination || "BLR",
      travelDate: instance?.travel_date || new Date().toISOString().split("T")[0],
      departureTime: flight?.departure_time || "06:00:00",
      seatNumber,
      gate,
      biometricVerified: true,
      biometricProfileId: bioProfileId,
      checkInId,
      validityHours: 72,
    })

    // 4. Save Smart Check-in Record
    const checkInRecord = await saveSmartCheckIn({
      id: crypto.randomUUID(),
      bookingId: booking.id,
      passengerId: pax?.id || "pax-1",
      flightInstanceId: targetInstanceId,
      userId: booking.user_id || undefined,
      biometricProfileId: bioProfileId,
      pnr: booking.pnr,
      qrToken,
      status: "registered",
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      gate,
      createdAt: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: "Navigo Smart Boarding Enabled! Cryptographic gate pass created.",
      checkInId,
      qrToken,
      smartBoardingReady: true,
      details: {
        pnr: booking.pnr,
        passengerName,
        flightNumber,
        airline,
        origin: flight?.origin || "DEL",
        destination: flight?.destination || "BLR",
        seatNumber,
        gate,
        biometricProfileId: bioProfileId,
      },
    })
  } catch (err: any) {
    console.error("Smart checkin error:", err)
    return NextResponse.json({ error: "Failed to complete Smart Check-In" }, { status: 500 })
  }
}
