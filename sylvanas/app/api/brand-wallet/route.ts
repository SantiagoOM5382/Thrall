import { NextResponse } from "next/server"
import { apiFetch, ApiError } from "@/lib/api"

export async function GET() {
  try {
    const data = await apiFetch<{ tokensBalance: number; tokenDiscountPercent: number }>("/brand/wallet")
    return NextResponse.json(data)
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500
    return NextResponse.json({ tokensBalance: 0, tokenDiscountPercent: 0 }, { status })
  }
}
