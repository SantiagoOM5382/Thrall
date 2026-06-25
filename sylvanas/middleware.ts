import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { jwtVerify } from "jose"

const COOKIE_NAME = "arthas_token"

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error("JWT_SECRET env var is required")
  return new TextEncoder().encode(secret)
}

async function isValid(token: string | undefined): Promise<boolean> {
  if (!token) return false
  try {
    await jwtVerify(token, getSecret())
    return true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(COOKIE_NAME)?.value

  if (pathname.startsWith("/dashboard")) {
    if (!(await isValid(token))) {
      const res = NextResponse.redirect(new URL("/login", request.url))
      res.cookies.delete(COOKIE_NAME)
      return res
    }
  }

  if (pathname === "/login" && (await isValid(token))) {
    return NextResponse.redirect(new URL("/dashboard/services", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
}
