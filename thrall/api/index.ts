import app from '../src/app'

export const config = { runtime: 'nodejs' }

// Vercel's Node runtime invokes Web-standard fetch handlers. Delegate
// every HTTP method to the Hono app's fetch (basePath '/api' matches the
// incoming request URL).
const handler = (req: Request) => app.fetch(req)

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
export const PATCH = handler
export const OPTIONS = handler
export const HEAD = handler
