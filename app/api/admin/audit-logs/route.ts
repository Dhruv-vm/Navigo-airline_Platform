import { NextResponse } from "next/server"
import { getAdminAuditLogs, recordAdminAuditLog, getAdminFromRequest } from "@/lib/admin-auth"

export async function GET(req: Request) {
  const admin = getAdminFromRequest(req)
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized administrative access" }, { status: 401 })
  }

  try {
    const logs = getAdminAuditLogs(100)
    return NextResponse.json({ logs })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch audit trail" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const currentAdmin = getAdminFromRequest(req)
  if (!currentAdmin) {
    return NextResponse.json({ error: "Unauthorized administrative access" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { admin, action, target, details } = body

    const log = recordAdminAuditLog(
      admin || currentAdmin,
      action || "MANUAL_OVERRIDE",
      target || "System",
      details
    )

    return NextResponse.json({ success: true, log })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to record audit log" }, { status: 500 })
  }
}
