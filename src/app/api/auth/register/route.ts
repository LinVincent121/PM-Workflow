import { NextRequest, NextResponse } from 'next/server';
import { createEmailVerification, consumeEmailVerification, createUser, getUserByEmail, markEmailVerified, createAuthSession, addAuditLog } from '@/lib/db';
import { sendVerificationCode } from '@/lib/mailer';
import { AUTH_COOKIE } from '@/lib/auth';
import { randomInt } from 'crypto';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!rateLimit(`register:${ip}`, 10, 60_000)) return NextResponse.json({ error: '操作过于频繁，请稍后再试' }, { status: 429 });
    const { email, password, code } = await request.json();
    const normalized = String(email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) return NextResponse.json({ error: '请输入有效邮箱' }, { status: 400 });
    if (!password || String(password).length < 8) return NextResponse.json({ error: '密码至少需要 8 位' }, { status: 400 });
    if (!code) {
      if (getUserByEmail(normalized)) return NextResponse.json({ error: '该邮箱已注册' }, { status: 409 });
      const verifyCode = String(randomInt(100000, 1000000));
      createEmailVerification(normalized, verifyCode);
      await sendVerificationCode(normalized, verifyCode);
      return NextResponse.json({ ok: true, message: '验证码已发送' });
    }
    if (!consumeEmailVerification(normalized, String(code))) return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 });
    if (getUserByEmail(normalized)) return NextResponse.json({ error: '该邮箱已注册' }, { status: 409 });
    const user = createUser(normalized, String(password));
    markEmailVerified(user.userId);
    addAuditLog(user.userId, 'register', user.userId, '注册成功');
    const response = NextResponse.json({ user: { userId: user.userId, email: user.email, role: 'user' } }, { status: 201 });
    response.cookies.set(AUTH_COOKIE, createAuthSession(user.userId), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
    return response;
  } catch (error: any) { return NextResponse.json({ error: error.message || '注册失败' }, { status: 500 }); }
}
