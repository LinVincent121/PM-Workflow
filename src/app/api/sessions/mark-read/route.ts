import { markSessionRead, addAuditLog } from '@/lib/db';
import { NextRequest } from 'next/server';
import { currentUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();
    if (!sessionId) return Response.json({ error: '缺少 sessionId' }, { status: 400 });
    const user = currentUser();
    markSessionRead(sessionId, user?.userId);
    if (user) addAuditLog(user.userId, 'mark_session_read', sessionId, '标记会话已读');
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
