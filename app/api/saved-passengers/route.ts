import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/auth"

// GET /api/saved-passengers
// Returns the logged-in user's saved passenger book — used to offer
// "reuse a saved passenger" on a NEW booking. This is scoped strictly
// to user_id, so there is no cross-user leakage.
export async function GET(req: Request) {
  const user = getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("saved_passengers")
    .select("id, title, first_name, middle_name, last_name, date_of_birth, gender, nationality, frequent_flyer, updated_at")
    .eq("user_id", user.userId)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("[GET /api/saved-passengers]", error)
    return NextResponse.json({ error: "Failed to retrieve saved passengers" }, { status: 500 })
  }

  return NextResponse.json({ passengers: data ?? [] })
}