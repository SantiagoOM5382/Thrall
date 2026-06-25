import { cookies } from "next/headers"

const COOKIE_NAME = "arthas_token"

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
    this.name = "ApiError"
  }
}

/**
 * Server-side fetch wrapper. Reads the httpOnly cookie and forwards the JWT
 * as a Bearer token to thrall. Use only from Server Components / Server Actions.
 */
export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  const res = await fetch(`${process.env.THRALL_URL}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
    cache: options?.cache ?? "no-store",
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(body.error ?? `API error ${res.status}`, res.status)
  }

  // Some endpoints (e.g. 204) may have no body.
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/** Public (unauthenticated) fetch against thrall — for landing/model pages. */
export async function apiFetchPublic<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${process.env.THRALL_URL}/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    cache: options?.cache ?? "no-store",
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(body.error ?? `API error ${res.status}`, res.status)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}
