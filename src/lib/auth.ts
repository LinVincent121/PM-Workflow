import { cookies } from 'next/headers';
import { getUserBySessionToken, type AuthUser } from './db';

export const AUTH_COOKIE = 'pmwa_session';

export function currentUser(): AuthUser | null {
  const token = cookies().get(AUTH_COOKIE)?.value;
  return token ? getUserBySessionToken(token) : null;
}

export function requireUser(): AuthUser {
  const user = currentUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}

export function requireAdmin(): AuthUser {
  const user = requireUser();
  if (user.role !== 'admin') throw new Error('FORBIDDEN');
  return user;
}
