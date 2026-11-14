import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/auth"
import { getBiometricProfile } from "@/lib/biometrics"
import { deriveFlightNumber } from "@/app/checkout/payment/bookingUtils"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const pnr = (body?.pnr || "").trim().toUpperCase()
    const lastName = (body?.lastName || "").trim().toLowerCase()

    if (!pnr) {
      return NextResponse.json({ error: "Please provide a valid 6-character PNR reference" }, { status: 400 })
    }

    // 1. Fetch booking record
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("pnr", pnr)
      .single()

    if (bErr || !booking) {
      return NextResponse.json(
        { error: `No active booking found for PNR ${pnr}. Please verify your reference code.` },
        { status: 404 }
      )
    }

    // 2. Fetch passengers, flight instances, and seats in parallel
    const instanceIds = [booking.depart_flight_instance_id, booking.return_flight_instance_id].filter(Boolean)
    
    const [passengersRes, instancesRes, seatsRes] = await Promise.all([
      supabase
        .from("booking_passengers")
        .select("id, booking_id, passenger_index, passenger_type, title, first_name, last_name, email, is_primary_contact")
        .eq("booking_id", booking.id)
        .order("passenger_index", { ascending: true }),
      instanceIds.length > 0
        ? supabase
            .from("flight_instances")
            .select("id, travel_date, gate, flights(id, airline, origin, destination, departure_time, arrival_time, aircraft)")
            .in("id", instanceIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from("booking_seats")
        .select("flight_instance_id, passenger_id, seat_number, cabin_class")
        .eq("booking_id", booking.id),
    ])

    const paxList = passengersRes.data || []
    
    // Security check: require matching last name unless caller is the authenticated booking owner
    const authUser = getUserFromRequest(req)
    const isOwner = Boolean(authUser && booking.user_id && authUser.userId === booking.user_id)

    if (!isOwner) {
      if (!lastName) {
        return NextResponse.json(
          { error: "Passenger last name is required to retrieve booking details" },
          { status: 400 }
        )
      }
      const match = paxList.some((p: any) => (p.last_name || "").toLowerCase() === lastName)
      if (!match) {
        return NextResponse.json(
          { error: `Last name "${body?.lastName || ""}" does not match booking record for PNR ${pnr}.` },
          { status: 400 }
        )
      }
    }

    const instanceMap = new Map((instancesRes.data || []).map((inst: any) => [inst.id, inst]))
    const seats = seatsRes.data || []

    // 5. Build legs
    const legs = []
    if (booking.depart_flight_instance_id && instanceMap.has(booking.depart_flight_instance_id)) {
      const inst = instanceMap.get(booking.depart_flight_instance_id)
      const f = inst.flights
      legs.push({
        legLabel: booking.return_flight_instance_id ? "Departure" : null,
        flightInstanceId: inst.id,
        airline: f?.airline || "Navigo Airlines",
        flightNumber: deriveFlightNumber(f?.airline || "Navigo", inst.id),
        origin: f?.origin || "DEL",
        destination: f?.destination || "BLR",
        travelDate: inst.travel_date,
        departureTime: f?.departure_time,
        arrivalTime: f?.arrival_time,
        aircraft: f?.aircraft || "Airbus A320neo",
        gate: inst.gate || "G4",
      })
    }

    if (booking.return_flight_instance_id && instanceMap.has(booking.return_flight_instance_id)) {
      const inst = instanceMap.get(booking.return_flight_instance_id)
      const f = inst.flights
      legs.push({
        legLabel: "Return",
        flightInstanceId: inst.id,
        airline: f?.airline || "Navigo Airlines",
        flightNumber: deriveFlightNumber(f?.airline || "Navigo", inst.id),
        origin: f?.origin || "BLR",
        destination: f?.destination || "DEL",
        travelDate: inst.travel_date,
        departureTime: f?.departure_time,
        arrivalTime: f?.arrival_time,
        aircraft: f?.aircraft || "Airbus A320neo",
        gate: inst.gate || "G4",
      })
    }

    if (legs.length === 0) {
      legs.push({
        legLabel: null,
        flightInstanceId: booking.depart_flight_instance_id || "flt-inst-01",
        airline: "Navigo Airlines",
        flightNumber: "NVG-302",
        origin: "DEL",
        destination: "BLR",
        travelDate: new Date().toISOString().split("T")[0],
        departureTime: "06:00:00",
        arrivalTime: "08:30:00",
        aircraft: "Airbus A320neo",
        gate: "G4",
      })
    }

    // 6. Check Biometric Profile strictly for authenticated owner
    let hasBiometricProfile = false
    let biometricProfileInfo: any = null
    if (isOwner && booking.user_id) {
      const biometricProfile = await getBiometricProfile(booking.user_id)
      if (biometricProfile && biometricProfile.isActive) {
        hasBiometricProfile = true
        biometricProfileInfo = {
          lastVerifiedAt: biometricProfile.lastVerifiedAt,
          isActive: true,
        }
      }
    }

    // Mask sensitive contact details for non-owners to prevent PNR-based data harvesting
    const maskEmail = (em?: string) => {
      if (!em || !em.includes("@")) return "—"
      const [u, d] = em.split("@")
      if (u.length <= 2) return `${u[0]}***@${d}`
      return `${u[0]}***${u[u.length - 1]}@${d}`
    }

    const formattedPassengers = paxList.map((p) => {
      const rawEmail = p.email || booking.contact_email
      return {
        id: p.id,
        name: `${p.title ? p.title + " " : ""}${p.first_name} ${p.last_name}`.trim(),
        firstName: p.first_name,
        lastName: p.last_name,
        email: isOwner ? rawEmail : maskEmail(rawEmail),
        isPrimary: p.is_primary_contact,
        type: p.passenger_type,
      }
    })

    const formattedSeats = (seats || []).map((s) => ({
      flightInstanceId: s.flight_instance_id,
      passengerId: s.passenger_id,
      seatNumber: s.seat_number,
      cabinClass: s.cabin_class,
    }))

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        pnr: booking.pnr,
        status: booking.status,
        totalPrice: booking.total_price,
        travelDate: legs[0]?.travelDate || null,
        legs,
        passengers: formattedPassengers,
        seats: formattedSeats,
      },
      hasBiometricProfile,
      biometricProfile: biometricProfileInfo,
      canSmartCheckIn: true,
    })
  } catch (err: any) {
    console.error("Check-in PNR verification error occurred")
    return NextResponse.json({ error: "Failed to verify booking reference" }, { status: 500 })
  }
}
