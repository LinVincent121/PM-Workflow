import { NextRequest } from 'next/server';
import { getSession, renameSession, getSettings, addAuditLog } from '@/lib/db';
import { generateTitle } from '@/lib/title-generator';
import { currentUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();
    if (!sessionId) return Response.json({ error: '缺少 sessionId' }, { status: 400 });

    const user = currentUser();
    const session = getSession(sessionId, user?.userId);
    if (!session) return Response.json({ error: '会话不存在' }, { status: 404 });

    const userMessages = session.messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) {
      return Response.json({ error: '会话中暂无用户消息' }, { status: 400 });
    }

    // Only generate if no custom name yet
    const settings = getSettings(currentUser()?.userId);
    if (!settings.llmApiKey) {
      return Response.json({ error: '请先配置 LLM API Key' }, { status: 400 });
    }
    const title = await generateTitle(session.messages, {
      apiKey: settings.llmApiKey,
      baseUrl: settings.llmBaseUrl,
      model: settings.llmModel,
    });

    renameSession(sessionId, title, user?.userId);
    if (user) addAuditLog(user.userId, 'rename_session', sessionId, title);
    return Response.json({ title });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
