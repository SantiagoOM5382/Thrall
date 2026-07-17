import { describe, it, expect } from 'vitest'
import app from '../../src/app'

describe('GET /api/top-services', () => {
  it('lists active boost services', async () => {
    const res = await app.request('/api/top-services')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    const codes = body.map((s: { code: string }) => s.code)
    expect(codes).toContain('top_perfil_24h')
    for (const s of body) {
      expect(s.tokensCost).toBeGreaterThan(0)
      expect(s.durationHours).toBeGreaterThan(0)
    }
  })
})
