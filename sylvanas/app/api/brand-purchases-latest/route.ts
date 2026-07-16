import { NextResponse } from "next/server"
import { apiFetch, ApiError } from "@/lib/api"

export async function GET() {
  try {
    const data = await apiFetch<{ latest: unknown }>("/brand/purchases/latest")
    return NextResponse.json(data)
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500
    return NextResponse.json({ latest: null }, { status })
  }
}
