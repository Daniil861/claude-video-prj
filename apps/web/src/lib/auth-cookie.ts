import { jwtVerify } from 'jose';

export const SESSION_COOKIE = 'access_token';

export interface SessionClaims {
  sub: string;
  email: string;
  exp?: number;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not set — see apps/web/.env.example');
  }

  return new TextEncoder().encode(secret);
}

/**
 * Verifies signature and expiry of a session token. Edge-runtime safe, so the
 * middleware can reject stale cookies before a page ever renders.
 */
export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionClaims;
  } catch {
    return null;
  }
}
