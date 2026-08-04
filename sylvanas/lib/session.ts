import { cookies } from "next/headers"
import { jwtVerify } from "jose"
import { AUTH_COOKIE_NAME } from "@/lib/cookies"

export interface SessionUser {
  sub: string
  role: "admin" | "monitor" | "model" | "dev"
  brandId: string
  name: string
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error("JWT_SECRET env var is required")
  return new TextEncoder().encode(secret)
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return {
      sub: payload.sub as string,
      role: payload.role as SessionUser["role"],
      brandId: payload.brandId as string,
      name: payload.name as string,
    }
  } catch {
    return null
  }
}
