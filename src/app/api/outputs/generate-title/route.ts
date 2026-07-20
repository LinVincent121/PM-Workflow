import { NextRequest } from 'next/server';
import { getSettings } from '@/lib/db';
import { callLLM } from '@/lib/llm/client';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();
    if (!content) return Response.json({ error: '缺少 content' }, { status: 400 });

    const settings = getSettings();
    if (!settings.llmApiKey) {
      return Response.json({ error: '请先配置 LLM API Key' }, { status: 400 });
    }

    const config = {
      apiKey: settings.llmApiKey,
      baseUrl: settings.llmBaseUrl || 'https://api.openai.com/v1',
      model: settings.llmModel || 'gpt-4o',
    };

    const prompt = [
      '你是一个文档标题生成器。根据以下文档内容，生成一个简洁的标题（6-15个中文字符）。',
      '要求：',
      '1. 必须是6-15个中文字符',
      '2. 概括文档的核心主题',
      '3. 只输出标题文字，不要任何额外内容（不要引号、不要说明）',
      '',
      '文档内容：',
      content.substring(0, 1500),
    ].join('\n');

    const result = await callLLM(config, [
      { role: 'user', content: prompt },
    ]);

    const title = result.content.trim().replace(/^["「『]|["」』]$/g, '').substring(0, 15);
    return Response.json({ title });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
