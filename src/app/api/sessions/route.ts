import { listSessions, deleteSession, renameSession, getSession, addAuditLog } from '@/lib/db';
import { currentUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const user = currentUser();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    if (sessionId) {
      const session = getSession(sessionId, user?.userId);
      if (!session) return Response.json({ error: '会话不存在' }, { status: 404 });
      return Response.json(session);
    }
    const sessions = listSessions(user?.userId);
    // Filter out empty sessions
    const activeSessions = sessions.filter(s => {
      const session = getSession(s.sessionId, user?.userId);
      return session && session.messages && session.messages.length > 0;
    });
    return Response.json(activeSessions);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = currentUser();
    const { sessionId } = await request.json();
    if (!sessionId) return Response.json({ error: '缺少 sessionId' }, { status: 400 });
    deleteSession(sessionId, user?.userId);
    if (user) addAuditLog(user.userId, 'delete_session', sessionId, '删除会话');
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = currentUser();
    const { sessionId, name } = await request.json();
    if (!sessionId || !name) return Response.json({ error: '缺少参数' }, { status: 400 });
    renameSession(sessionId, name, user?.userId);
    if (user) addAuditLog(user.userId, 'rename_session', sessionId, name);
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
