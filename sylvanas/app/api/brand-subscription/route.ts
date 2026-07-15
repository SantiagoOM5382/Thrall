import { NextResponse } from "next/server"
import { apiFetch, ApiError } from "@/lib/api"
import {
  DEFAULT_SUBSCRIPTION_STATE,
  type SubscriptionState,
} from "@/lib/subscription-context"

export async function GET() {
  try {
    const data = await apiFetch<SubscriptionState>("/brand/subscription")
    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
      return NextResponse.json(DEFAULT_SUBSCRIPTION_STATE)
    }
    return NextResponse.json(DEFAULT_SUBSCRIPTION_STATE, { status: 200 })
  }
}
