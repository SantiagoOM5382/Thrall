// Local development HTTP server. On Vercel the app is served via api/index.ts;
// this entry is only for `npm run dev` on localhost.
import 'dotenv/config'
import { serve } from '@hono/node-server'
import app from './app'

const port = Number(process.env.PORT ?? 3001)
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`thrall listening on http://localhost:${info.port}`)
})
