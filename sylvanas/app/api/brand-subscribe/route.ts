import { NextResponse } from "next/server"
import { apiFetch, ApiError } from "@/lib/api"

export async function POST() {
  try {
    const data = await apiFetch<Record<string, unknown>>("/brand/subscribe", {
      method: "POST",
    })
    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "unknown_error" }, { status: 500 })
  }
}
