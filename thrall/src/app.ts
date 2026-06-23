import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authRoutes } from './routes/auth'
import { usersRoutes } from './routes/users'
import { modelsRoutes } from './routes/models'
import { imagesRoutes } from './routes/images'
import { payMethodsRoutes } from './routes/pay-methods'
import { servicesRoutes } from './routes/services'
import { reportsRoutes } from './routes/reports'

const app = new Hono().basePath('/api')

app.use('*', cors({
  origin: process.env.FRONTEND_URL ?? '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}))

app.route('/auth', authRoutes)
app.route('/users', usersRoutes)
app.route('/models', modelsRoutes)
app.route('/images', imagesRoutes)
app.route('/pay-methods', payMethodsRoutes)
app.route('/services', servicesRoutes)
app.route('/reports', reportsRoutes)

app.get('/health', (c) => c.json({ ok: true }))

export default app
