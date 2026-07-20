import { NextRequest } from 'next/server';
import { getSettings } from '@/lib/db';
import { processMessageStream } from '@/lib/orchestrator';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, workflowId, message } = body;

    if (!message || (!sessionId && !workflowId)) {
      return Response.json({ error: '缺少必填参数' }, { status: 400 });
    }

    const settings = getSettings();
    if (!settings.llmApiKey) {
      return Response.json({ error: '请先在设置页配置 LLM API Key' }, { status: 400 });
    }

    const config = {
      apiKey: settings.llmApiKey,
      baseUrl: settings.llmBaseUrl || 'https://api.openai.com/v1',
      model: settings.llmModel || 'gpt-4o',
    };

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of processMessageStream(
            { sessionId: sessionId || undefined, workflowId: workflowId || undefined, message },
            config,
          )) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
        } catch (err: any) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: err.message || '内部错误', done: true })}\n\n`),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: any) {
    console.error('Chat stream API error:', err);
    return Response.json({ error: err.message || '内部错误' }, { status: 500 });
  }
}
