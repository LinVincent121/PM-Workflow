import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deleteAuthSession, addAuditLog } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { AUTH_COOKIE } from '@/lib/auth';

export async function POST() {
  const token = cookies().get(AUTH_COOKIE)?.value;
  if (token) { const uid=currentUser()?.userId; if(uid) addAuditLog(uid,'logout',uid,'退出登录'); deleteAuthSession(token); }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, '', { httpOnly: true, expires: new Date(0), path: '/' });
  return response;
}
