import { listSessions, deleteSession, renameSession, getSession } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    if (sessionId) {
      const session = getSession(sessionId);
      if (!session) return Response.json({ error: '会话不存在' }, { status: 404 });
      return Response.json(session);
    }
    const sessions = listSessions();
    return Response.json(sessions);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { sessionId } = await request.json();
    if (!sessionId) return Response.json({ error: '缺少 sessionId' }, { status: 400 });
    deleteSession(sessionId);
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { sessionId, name } = await request.json();
    if (!sessionId || !name) return Response.json({ error: '缺少参数' }, { status: 400 });
    renameSession(sessionId, name);
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
