// ─── LLM Adapter – OpenAI-compatible API ───

import type { ChatMessage, LLMConfig } from '@/types';

export async function callLLM(
  config: LLMConfig,
  messages: ChatMessage[],
  stream: boolean = false,
): Promise<{ content: string; usage?: { prompt: number; completion: number } }> {
  const base = config.baseUrl.replace(/\/$/, '');
  const url = `${base}/chat/completions`;

  const body: any = {
    model: config.model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: 0.7,
    max_tokens: 8192,
    stream: false,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown');
    throw new Error(`LLM API error ${res.status}: ${errText.substring(0, 500)}`);
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
  // Normalize base URL: strip trailing slash, ensure /v1 if missing for known providers
  let base = config.baseUrl.replace(/\/$/, '');
  // Auto-append /v1 for common providers that expect it
  if (!base.endsWith('/v1') && !base.includes('/v1/')) {
    // For OpenAI-compatible APIs, default to /v1 endpoint
    base = base + '/v1';
  }
  const url = `${base}/chat/completions`;

  const body = {
    model: config.model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: 0.7,
    max_tokens: 8192,
    stream: true,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown');
    throw new Error(`LLM API error ${res.status}: ${errText.substring(0, 500)}`);
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
