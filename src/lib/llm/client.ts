// ─── LLM Adapter – OpenAI-compatible API ───

import type { ChatMessage, LLMConfig } from '@/types';

/**
 * Sanitize message content that might contain problematic escape sequences
 * for JSON parsers (e.g. backslash-x sequences in raw text).
 */
function sanitizeContent(content: string | any[]): string | any[] {
  if (typeof content === 'string') {
    return content.replace(/\\x([0-9a-fA-F]{2})(?![0-9a-fA-F])/g, '\\\\x$1');
  }
  // Multimodal content: array of { type, text/image_url }
  if (Array.isArray(content)) {
    return content.map((part: any) => {
      if (part.type === 'text' && typeof part.text === 'string') {
        return { ...part, text: part.text.replace(/\\x([0-9a-fA-F]{2})(?![0-9a-fA-F])/g, '\\\\x$1') };
      }
      return part;
    });
  }
  return content;
}

export async function callLLM(
  config: LLMConfig,
  messages: ChatMessage[],
  stream: boolean = false,
): Promise<{ content: string; usage?: { prompt: number; completion: number } }> {
  const base = config.baseUrl.replace(/\/$/, '');
  const url = `${base}/chat/completions`;

  const cleanMessages = messages.map((m) => ({
    role: m.role,
    content: sanitizeContent(m.content),
  }));

  const body: any = {
    model: config.model,
    messages: cleanMessages,
    temperature: 0.7,
    max_tokens: 8192,
    stream: false,
  };

  const bodyJson = JSON.stringify(body);
  // Warn but send — if the model provider chokes, it's a provider-side issue
  if (bodyJson.length > 100_000) {
    console.warn(`[LLM] Request body is ${bodyJson.length} chars — consider truncating context`);
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: bodyJson,
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown');
    const preview = errText.substring(0, 300);
    // Map common HTTP errors to Chinese-friendly messages
    if (res.status === 401) {
      throw new Error(`API Key 无效 (401)：请检查 Settings 页面中的 API Key 是否正确`);
    }
    if (res.status === 404) {
      throw new Error(`API 端点不存在 (404)：请检查 Settings 页面中的 Base URL 是否正确。当前：${config.baseUrl}`);
    }
    if (res.status === 429) {
      throw new Error(`API 请求频率超限 (429)：请稍后重试或检查 API 配额`);
    }
    throw new Error(`LLM API error ${res.status}: ${preview}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  const usage = data.usage ? { prompt: data.usage.prompt_tokens, completion: data.usage.completion_tokens } : undefined;

  return { content, usage };
}

/**
 * Streaming version using SSE.
 */
export async function* streamLLM(
  config: LLMConfig,
  messages: ChatMessage[],
): AsyncGenerator<string, void, unknown> {
  let base = config.baseUrl.replace(/\/$/, '');
  if (!base.endsWith('/v1') && !base.includes('/v1/')) {
    base = base + '/v1';
  }
  const url = `${base}/chat/completions`;

  const cleanMessages = messages.map((m) => ({
    role: m.role,
    content: sanitizeContent(m.content),
  }));

  const body = {
    model: config.model,
    messages: cleanMessages,
    temperature: 0.7,
    max_tokens: 8192,
    stream: true,
  };

  const bodyJson = JSON.stringify(body);
  if (bodyJson.length > 100_000) {
    console.warn(`[LLM Stream] Request body is ${bodyJson.length} chars — consider truncating context`);
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: bodyJson,
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown');
    const preview = errText.substring(0, 300);
    // Map common HTTP errors to Chinese-friendly messages
    if (res.status === 401) {
      throw new Error(`API Key 无效 (401)：请检查 Settings 页面中的 API Key 是否正确`);
    }
    if (res.status === 404) {
      throw new Error(`API 端点不存在 (404)：请检查 Settings 页面中的 Base URL 是否正确。当前：${config.baseUrl}`);
    }
    if (res.status === 429) {
      throw new Error(`API 请求频率超限 (429)：请稍后重试或检查 API 配额`);
    }
    throw new Error(`LLM API error ${res.status}: ${preview}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;

      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // skip parse errors for partial chunks
      }
    }
  }
}
