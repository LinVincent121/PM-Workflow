import { NextRequest } from 'next/server';
import { getSettings, createSession, updateSession, getSession, renameSession, addAuditLog } from '@/lib/db';
import { streamLLM } from '@/lib/llm/client';
import { buildFileContext, readFileBase64 } from '@/lib/file-utils';
import type { ChatMessage } from '@/types';
import { currentUser } from '@/lib/auth';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `你是「PM Workbench」内置的 AI 助手，一个通用对话伙伴。你可以：
- 回答各类问题，不限于产品管理
- 提供创意建议、分析与推理
- 帮助撰写、总结、翻译等任务
- 如果用户上传了文件，请仔细阅读并基于文件内容回答

规则：
- 请用中文交流
- 直接回答问题，不要每次都自我介绍
- 不要在回复中透露你的模型名称或版本信息`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionId, files } = body;

    if (!message) {
      return Response.json({ error: '缺少必填参数' }, { status: 400 });
    }

    const settings = getSettings(currentUser()?.userId);
    if (!settings.llmApiKey) {
      return Response.json({ error: '请先在设置页配置 LLM API Key' }, { status: 400 });
    }

    const config = {
      apiKey: settings.llmApiKey,
      baseUrl: settings.llmBaseUrl || 'https://api.openai.com/v1',
      model: settings.llmModel || 'gpt-4o',
    };

    // ── Session management ──
    let sid = sessionId;
    let history: ChatMessage[] = [];

    if (sid) {
      const existing = getSession(sid, currentUser()?.userId);
      if (existing) {
        history = existing.messages;
      } else {
        sid = null as any;
      }
    }

    if (!sid) {
      const session = createSession('chat', currentUser()?.userId);
      sid = session.sessionId;
      // Set temporary title from user's message immediately
      const tempTitle = message.length > 30 ? message.substring(0, 30) + '...' : message;
      try { renameSession(sid, tempTitle, currentUser()?.userId); if (currentUser()) addAuditLog(currentUser()!.userId,'create_session',sid,tempTitle); } catch {}
    }

    // Save user message immediately
    const updatedHistory: ChatMessage[] = [
      ...history,
      { role: 'user', content: message },
    ];
    updateSession(sid, { messages: updatedHistory, status: 'streaming' }, currentUser()?.userId);

    // ── Build LLM messages with file context ──
    const uploadedFiles = Array.isArray(files) ? files : [];
    const images = uploadedFiles.filter((f: any) => f.isImage);
    const docs = uploadedFiles.filter((f: any) => !f.isImage);

    // Build system prompt with file context
    let systemContent = SYSTEM_PROMPT;
    if (docs.length > 0) {
      systemContent += buildFileContext(docs, currentUser()?.userId);
    }

    const systemMessage: ChatMessage = { role: 'system', content: systemContent };

    // Build user message - for multimodal, include images
    let userContent: string | any[];
    if (images.length > 0) {
      // Multimodal: content is an array of text + image parts
      userContent = [{ type: 'text' as const, text: message }];
      for (const img of images) {
      const b64 = readFileBase64(img.fileId, currentUser()?.userId);
        if (b64) {
          userContent.push({
            type: 'image_url' as const,
            image_url: { url: `data:${b64.mimeType};base64,${b64.data}` },
          });
        }
      }
    } else {
      userContent = message;
    }

    const userMessage: ChatMessage = { role: 'user', content: userContent as any };

    const llmMessages: ChatMessage[] = [
      systemMessage,
      ...history,
      userMessage,
    ];

    const encoder = new TextEncoder();
    let fullContent = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sessionId: sid })}\n\n`));

          for await (const chunk of streamLLM(config, llmMessages)) {
            fullContent += chunk;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk, done: false })}\n\n`));
          }

          const finalMessages: ChatMessage[] = [
            ...updatedHistory,
            { role: 'assistant', content: fullContent },
          ];
          updateSession(sid, { messages: finalMessages, status: 'unread' }, currentUser()?.userId);
          if (currentUser()) addAuditLog(currentUser()!.userId, 'llm_response', sid, fullContent.slice(0, 4000));

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: '', done: true })}\n\n`));
        } catch (err: any) {
          // Reset streaming status on error so session isn't stuck
          updateSession(sid, { status: 'idle' }, currentUser()?.userId);
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
    console.error('Simple chat API error:', err);
    return Response.json({ error: err.message || '内部错误' }, { status: 500 });
  }
}
