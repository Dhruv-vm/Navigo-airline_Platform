import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/auth"

// POST /api/bookings/[bookingId]/confirm
//
// ✅ CHANGED: the PNR is now generated HERE, not on the client. Previously
// the payment page generated a PNR locally and sent it to this route to
// store — meaning what the traveler saw on screen (and in their PDF) was
// only ever a guess about what actually landed in Supabase, not a
// guaranteed reflection of it. Now this route is the single source of
// truth: it generates the PNR, writes it, and returns it — the client
// only ever displays what this response contains, and the idempotent
// "already confirmed" branch below returns the PNR that's actually in the
// row rather than risking a second, different value.
//
// ⚠️ Requires migration_confirm_booking.sql to have been run once.
// If your `status` column doesn't accept "confirmed", change
// CONFIRMED_STATUS below to match your schema.

const CONFIRMED_STATUS = "confirmed"

// No ambiguous glyphs (no 0/O, 1/I) — reads clean on a boarding pass.
// Duplicated from bookingUtils.ts on purpose: that file lives under
// app/checkout/payment/ and this route lives under a different branch of
// the app router, so it's a tiny (6-line) copy rather than a cross-tree
// import.
function generatePnr(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let out = ""
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

type ConfirmPayload = {
  amountPaid: number
  paymentMethod: "card" | "upi"
  redeemedPoints?: number
  gatewayMode?: "sandbox" | "live"
  razorpayPaymentId?: string
  razorpayOrderId?: string
  razorpaySignature?: string
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params
    const body = (await req.json()) as ConfirmPayload

    if (!bookingId) {
      return NextResponse.json({ error: "Missing booking id" }, { status: 400 })
    }
    if (typeof body.amountPaid !== "number" || isNaN(body.amountPaid) || body.amountPaid < 0) {
      return NextResponse.json({ error: "Valid amountPaid is required" }, { status: 400 })
    }

    const user = getUserFromRequest(req)

    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("id, status, pnr, user_id, total_price")
      .eq("id", bookingId)
      .single()

    if (fetchError || !booking) {
      console.error("CONFIRM BOOKING - LOOKUP ERROR:", fetchError)
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    if (booking.user_id && (!user || user.userId !== booking.user_id)) {
      return NextResponse.json({ error: "Unauthorized access to this booking" }, { status: 403 })
    }

    // ── Payment Gateway Mode: Sandbox vs Live ──
    const isLiveConfigured = Boolean(process.env.RAZORPAY_KEY_SECRET || process.env.STRIPE_SECRET_KEY)
    const isLiveModeRequested = process.env.PAYMENT_GATEWAY_MODE === "live" || body.gatewayMode === "live"
    let gatewayMode: "sandbox" | "live" = "sandbox"

    if (isLiveModeRequested && isLiveConfigured) {
      if (process.env.RAZORPAY_KEY_SECRET) {
        const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = body
        if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
          return NextResponse.json(
            { error: "Missing required live payment proof (razorpayPaymentId, razorpayOrderId, razorpaySignature)" },
            { status: 400 }
          )
        }
        const crypto = await import("crypto")
        const expectedSignature = crypto
          .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
          .update(`${razorpayOrderId}|${razorpayPaymentId}`)
          .digest("hex")

        if (expectedSignature !== razorpaySignature) {
          return NextResponse.json(
            { error: "Invalid live payment signature verification failed" },
            { status: 400 }
          )
        }
      }

      const trustedTotalPrice = Number(booking.total_price || 0)
      const redeemedPoints = Math.max(0, Math.floor(Number(body.redeemedPoints || 0)))
      const pointsDiscount = Math.floor(redeemedPoints / 2)
      if (trustedTotalPrice > 0) {
        const expectedMin = Math.max(1, trustedTotalPrice - pointsDiscount)
        if (body.amountPaid < expectedMin - 1 || body.amountPaid > trustedTotalPrice + 1) {
          return NextResponse.json(
            { error: `Live payment amount mismatch: expected ₹${expectedMin}, received ₹${body.amountPaid}` },
            { status: 400 }
          )
        }
      }
      gatewayMode = "live"
    } else {
      // Fake/Sandbox payment mode — allows seamless checkout testing without payment gateway hurdles
      gatewayMode = "sandbox"
    }

    const finalPaidAmount = typeof body.amountPaid === "number" && body.amountPaid > 0
      ? body.amountPaid
      : Number(booking.total_price || 0)

    // Idempotent — a retried request (e.g. after a network blip on the
    // client) always gets back the PNR that's genuinely in the row,
    // never a freshly generated one.
    const currentStatus = (booking.status || "").toLowerCase()

    if (currentStatus === CONFIRMED_STATUS.toLowerCase()) {
      return NextResponse.json({
        bookingId,
        status: CONFIRMED_STATUS,
        pnr: booking.pnr,
        gatewayMode,
        alreadyConfirmed: true,
      })
    }

    if (currentStatus !== "draft") {
      return NextResponse.json(
        { error: `Booking is in "${booking.status}" state and can't be confirmed` },
        { status: 409 }
      )
    }

    // Generate + write, retrying only on an actual PNR collision
    let finalPnr = ""
    let lastError: { code?: string; message: string } | null = null

    for (let attempt = 0; attempt < 5; attempt++) {
      finalPnr = generatePnr()
      const { error } = await supabase
        .from("bookings")
        .update({
          status: CONFIRMED_STATUS,
          hold_expires_at: null,
          pnr: finalPnr,
          payment_method: `${body.paymentMethod || "card"}:${gatewayMode}`,
          paid_amount: finalPaidAmount,
          paid_at: new Date().toISOString(),
        })
        .eq("id", bookingId)
        .eq("status", "draft") // guards against a race with a concurrent confirm

      if (!error) {
        lastError = null
        break
      }
      lastError = error
      if (error.code !== "23505") break // only retry on a PNR collision
    }

    if (lastError) {
      console.error("CONFIRM BOOKING - UPDATE ERROR:", lastError)
      return NextResponse.json({ error: "Failed to confirm booking" }, { status: 500 })
    }

    return NextResponse.json({
      bookingId,
      status: CONFIRMED_STATUS,
      pnr: finalPnr,
      gatewayMode,
      amountPaid: finalPaidAmount,
    })
  } catch (err) {
    console.error("CONFIRM BOOKING - SERVER ERROR:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}