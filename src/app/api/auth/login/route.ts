import { NextRequest, NextResponse } from 'next/server';
import { createAuthSession, verifyUserPassword, addAuditLog } from '@/lib/db';
import { AUTH_COOKIE } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  if (!rateLimit(`login:${ip}`, 10, 60_000)) return NextResponse.json({ error: '登录尝试过于频繁，请稍后再试' }, { status: 429 });
  const { email, password } = await request.json();
  const user = verifyUserPassword(String(email || ''), String(password || ''));
  if (!user) return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
  addAuditLog(user.userId, 'login', user.userId, '登录成功');
  const response = NextResponse.json({ user: { userId: user.userId, email: user.email, role: user.role } });
  response.cookies.set(AUTH_COOKIE, createAuthSession(user.userId), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return response;
}
