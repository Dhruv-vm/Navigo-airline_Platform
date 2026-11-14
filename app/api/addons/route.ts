import { NextResponse } from "next/server"
import { getAddonsCatalog, updateAddonPrice, toggleAddonActive } from "@/lib/addons-catalog"
import { recordAdminAuditLog, getAdminFromRequest } from "@/lib/admin-auth"

export async function GET() {
  return NextResponse.json({ addons: getAddonsCatalog() })
}

export async function POST(req: Request) {
  try {
    const admin = getAdminFromRequest(req)
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized administrative access" }, { status: 401 })
    }

    const body = await req.json()
    const { action, id, price } = body

    if (action === "UPDATE_PRICE" && id && typeof price === "number") {
      const updated = updateAddonPrice(id, price)
      recordAdminAuditLog(
        admin,
        "UPDATE_ADDON_PRICE",
        `Addon: ${id} → ₹${price}`
      )
      return NextResponse.json({ success: true, addons: updated })
    }

    if (action === "TOGGLE_ACTIVE" && id) {
      const updated = toggleAddonActive(id)
      recordAdminAuditLog(
        admin,
        "TOGGLE_ADDON_STATUS",
        `Addon: ${id}`
      )
      return NextResponse.json({ success: true, addons: updated })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err: any) {
    console.error("Addon update error")
    return NextResponse.json({ error: "Failed to update addon" }, { status: 500 })
  }
}
