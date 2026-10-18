import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import crypto from "crypto"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email } = body

    // ❌ Validate
    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    console.log("🔍 Checking user:", email)

    const cleanEmail = email.trim()

    // 🔍 Check if user exists
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .ilike("email", cleanEmail)
      .maybeSingle()

    if (userError || !user) {
      // Prevent user enumeration
      return NextResponse.json({
        message: "If an account exists with this email, password reset instructions have been sent.",
      })
    }

    // 🔐 Generate reset token
    const token = crypto.randomBytes(32).toString("hex")

    // ⏳ Expiry (15 minutes)
    const expiry = new Date(Date.now() + 1000 * 60 * 15)

    // 💾 Save token in DB
    const { error: updateError } = await supabase
      .from("users")
      .update({
        reset_token: token,
        reset_token_expiry: expiry.toISOString(),
      })
      .eq("id", user.id)

    if (updateError) {
      console.error("❌ DB update failed:", updateError)
      return NextResponse.json(
        { error: "Failed to process password reset" },
        { status: 500 }
      )
    }

    // 🔗 Create reset link (frontend route)
    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "") || "http://localhost:3000"
    const resetLink = `${origin}/reset-password?token=${token}`

    if (process.env.NODE_ENV !== "production") {
      console.log("📩 RESET LINK (DEV ONLY):", resetLink)
    }

    return NextResponse.json({
      message: "If an account exists with this email, password reset instructions have been sent.",
      ...(process.env.NODE_ENV !== "production" ? { devResetLink: resetLink } : {}),
    })

  } catch (err) {
    console.error("❌ Forgot password error:", err)

    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    )
  }
}