import { markSessionRead } from '@/lib/db';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();
    if (!sessionId) return Response.json({ error: '缺少 sessionId' }, { status: 400 });
    markSessionRead(sessionId);
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
