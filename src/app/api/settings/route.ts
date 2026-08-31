import { NextRequest } from 'next/server';
import { getSettings, saveSettings, addAuditLog } from '@/lib/db';
import { currentUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const user = currentUser();
    const s = getSettings(user?.userId);
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
    const user = currentUser();
    if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
    const body = await request.json();
    const { llmApiKey, llmBaseUrl, llmModel } = body;

    const updates: any = {};
    if (llmApiKey !== undefined) updates.llmApiKey = llmApiKey;
    if (llmBaseUrl !== undefined) updates.llmBaseUrl = llmBaseUrl;
    if (llmModel !== undefined) updates.llmModel = llmModel;

    saveSettings(user.userId, updates);
    addAuditLog(user.userId, 'update_settings', user.userId, '更新模型配置');
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
