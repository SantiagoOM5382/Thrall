import { describe, it, expect } from 'vitest'
import { signToken, verifyToken } from '../../src/lib/jwt'

describe('dev role', () => {
  it('signs and verifies a dev token', async () => {
    const token = await signToken({ sub: 'u1', role: 'dev', brandId: 'b1', name: 'Dev' })
    const payload = await verifyToken(token)
    expect(payload.role).toBe('dev')
  })
})
