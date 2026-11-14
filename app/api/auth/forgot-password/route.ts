import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import crypto from "crypto"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    const cleanEmail = email.trim().toLowerCase()

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .ilike("email", cleanEmail)
      .maybeSingle()

    if (userError || !user) {
      // Prevent user enumeration: always return the same generic message
      return NextResponse.json({
        message: "If an account exists with this email, password reset instructions have been sent.",
      })
    }

    // Generate cryptographically secure reset token
    const token = crypto.randomBytes(32).toString("hex")

    // Token expiry (15 minutes)
    const expiry = new Date(Date.now() + 1000 * 60 * 15)

    // Save token in DB
    const { error: updateError } = await supabase
      .from("users")
      .update({
        reset_token: token,
        reset_token_expiry: expiry.toISOString(),
      })
      .eq("id", user.id)

    if (updateError) {
      console.error("DB update failed during password reset")
      return NextResponse.json(
        { error: "Failed to process password reset request" },
        { status: 500 }
      )
    }

    // Server-side only: never return the reset token or link over the network to the client
    if (process.env.NODE_ENV !== "production") {
      const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "") || "http://localhost:3000"
      console.log("Password reset link generated for server logs only:", `${origin}/reset-password?token=${token}`)
    }

    return NextResponse.json({
      message: "If an account exists with this email, password reset instructions have been sent.",
    })

  } catch (err) {
    console.error("Forgot password error occurred")
    return NextResponse.json(
      { error: "Failed to process password reset request" },
      { status: 500 }
    )
  }
}