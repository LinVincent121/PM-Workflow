import type { ChatMessage, LLMConfig } from '@/types';
import { callLLM } from './llm/client';

function textContent(content: ChatMessage['content']): string {
  if (typeof content === 'string') return content;
  return content.map((part: any) => part.type === 'text' ? part.text : '').join(' ');
}

/**
 * Generate a short Chinese title (6-10 characters) from conversation messages.
 */
export async function generateTitle(
  messages: ChatMessage[],
  config: LLMConfig,
): Promise<string> {
  const recent = messages.slice(-6);
  const text = recent
    .map(m => `${m.role === 'user' ? '用户' : '助手'}: ${textContent(m.content).substring(0, 200)}`)
    .join('\n');

  const prompt = [
    '你是一个对话标题生成器。根据以下对话片段，生成一个简洁的标题。（6-10个中文字符）',
    '要求：',
    '1. 必须是6-10个中文字符',
    '2. 概括对话的核心主题',
    '3. 只输出标题文字，不要任何额外内容（不要引号、不要说明）',
    '',
    '对话内容：',
    text,
  ].join('\n');

  const result = await callLLM(config, [
    { role: 'user', content: prompt },
  ]);

  // Strip quotes and whitespace, truncate to 10 chars
  return result.content.trim().replace(/^["「『]|["」』]$/g, '').substring(0, 10);
}
