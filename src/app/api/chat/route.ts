import { NextRequest } from 'next/server';
import { getSettings } from '@/lib/db';
import { processMessage } from '@/lib/orchestrator';
import { currentUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, workflowId, message } = body;

    if (!message || (!sessionId && !workflowId)) {
      return Response.json({ error: '缺少必填参数' }, { status: 400 });
    }

    const user = currentUser();
    const settings = getSettings(user?.userId);
    if (!settings.llmApiKey) {
      return Response.json({ error: '请先在设置页配置 LLM API Key' }, { status: 400 });
    }

    const config = {
      apiKey: settings.llmApiKey,
      baseUrl: settings.llmBaseUrl || 'https://api.openai.com/v1',
      model: settings.llmModel || 'gpt-4o',
    };

    const result = await processMessage(
      { sessionId: sessionId || undefined, workflowId: workflowId || undefined, message, userId: user?.userId },
      config,
    );

    return Response.json(result);
  } catch (err: any) {
    console.error('Chat API error:', err.message);
    if (err.cause) console.error('  cause:', err.cause);
    return Response.json({ error: err.message || '内部错误' }, { status: 500 });
  }
}
