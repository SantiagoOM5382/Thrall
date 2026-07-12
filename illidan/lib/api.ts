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
 * Public (unauthenticated) fetch against thrall — for the showcase pages.
 * Defaults to ISR caching (revalidate 1h) so pages render statically.
 * Pass `cache: "no-store"` to opt out.
 */
export async function apiFetchPublic<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${process.env.THRALL_URL}/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...(options?.cache ? {} : { next: { revalidate: 3600 } }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(body.error ?? `API error ${res.status}`, res.status)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}
