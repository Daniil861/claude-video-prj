import { cookies } from 'next/headers';
import { decodeJwt } from 'jose';
import { SESSION_COOKIE } from './auth-cookie';

const FALLBACK_MAX_AGE_SECONDS = 60 * 60;

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** Stores the token in an httpOnly cookie that expires together with the JWT. */
export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: readMaxAge(token),
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

function readMaxAge(token: string): number {
  try {
    const { exp } = decodeJwt(token);
    const secondsLeft = exp ? exp - Math.floor(Date.now() / 1000) : 0;
    return secondsLeft > 0 ? secondsLeft : FALLBACK_MAX_AGE_SECONDS;
  } catch {
    return FALLBACK_MAX_AGE_SECONDS;
  }
}
