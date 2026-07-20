import { NextRequest } from 'next/server';
import { getSession, renameSession, getSettings } from '@/lib/db';
import { generateTitle } from '@/lib/title-generator';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();
    if (!sessionId) return Response.json({ error: '缺少 sessionId' }, { status: 400 });

    const session = getSession(sessionId);
    if (!session) return Response.json({ error: '会话不存在' }, { status: 404 });

    const userMessages = session.messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) {
      return Response.json({ error: '会话中暂无用户消息' }, { status: 400 });
    }

    // Only generate if no custom name yet
    const settings = getSettings();
    const title = await generateTitle(session.messages, {
      apiKey: settings.llmApiKey,
      baseUrl: settings.llmBaseUrl,
      model: settings.llmModel,
    });

    renameSession(sessionId, title);
    return Response.json({ title });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
