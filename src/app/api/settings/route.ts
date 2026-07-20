import { NextRequest } from 'next/server';
import { getSettings, saveSettings } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const s = getSettings();
    return Response.json({
      llmApiKey: s.llmApiKey || '',
      llmBaseUrl: s.llmBaseUrl || '',
      llmModel: s.llmModel || '',
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { llmApiKey, llmBaseUrl, llmModel } = body;

    const updates: any = {};
    if (llmApiKey !== undefined) updates.llmApiKey = llmApiKey;
    if (llmBaseUrl !== undefined) updates.llmBaseUrl = llmBaseUrl;
    if (llmModel !== undefined) updates.llmModel = llmModel;

    saveSettings(updates);
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
