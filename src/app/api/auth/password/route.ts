import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { setUserPassword, verifyUserPassword, addAuditLog } from '@/lib/db';

export async function POST(request: NextRequest) {
  const user = currentUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const { currentPassword, newPassword } = await request.json();
  if (!newPassword || String(newPassword).length < 8) return NextResponse.json({ error: '新密码至少需要 8 位' }, { status: 400 });
  if (!verifyUserPassword(user.email, String(currentPassword || ''))) return NextResponse.json({ error: '当前密码错误' }, { status: 400 });
  setUserPassword(user.userId, String(newPassword));
  addAuditLog(user.userId, 'change_password', user.userId, '修改密码');
  return NextResponse.json({ ok: true });
}
