 
import { type NextRequest, NextResponse } from "next/server"

/**
 * GET /api/dashboard-stats  ⟶  https://wisdom-walk-app.onrender.com/api/admin/dashboard/stats
 */
export async function GET(request: NextRequest) {
  try {
    // Accept the token from either the Authorization header or an adminToken cookie
    const bearer =
      request.headers.get("authorization") ??
      (request.cookies.get("adminToken") ? `Bearer ${request.cookies.get("adminToken")!.value}` : "")

    const backendRes = await fetch("https://wisdom-walk-app.onrender.com/api/admin/dashboard/stats", {
      headers: {
        Authorization: bearer,
        "x-auth-token": bearer.replace(/^Bearer\s+/i, ""), // fallback for some middleware
      },
      cache: "no-store",
    })

    // Pass backend JSON straight through
    const data = await backendRes.json()
    return NextResponse.json(data, { status: backendRes.status })
  } catch (error) {
    console.error("dashboard-stats proxy error:", error)
    return NextResponse.json({ success: false, message: "Unable to fetch dashboard stats." }, { status: 502 })
  }
}
