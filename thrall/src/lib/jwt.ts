import { SignJWT, jwtVerify } from 'jose'

export interface TokenPayload {
  sub: string
  role: 'admin' | 'monitor' | 'model'
  brandId: string
  name: string
}

function getSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET!)
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getSecret())
  return payload as unknown as TokenPayload
}
