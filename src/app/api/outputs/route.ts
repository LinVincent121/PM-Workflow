import { NextRequest } from 'next/server';
import { listOutputs, getOutput, createOutput, updateOutput, renameOutput, deleteOutput, saveOutputVersion, getOutputVersions } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const outputId = searchParams.get('outputId');
    if (outputId) {
      const output = getOutput(outputId);
      if (!output) return Response.json({ error: '产出不存在' }, { status: 404 });
      const versions = getOutputVersions(outputId);
      return Response.json({ ...output, versions });
    }
    const outputs = listOutputs();
    return Response.json(outputs);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { outputId, sessionId, workflowId, title, version, content } = body;

    if (!sessionId || !workflowId || !title || !version || !content) {
      return Response.json({ error: '缺少必填参数' }, { status: 400 });
    }

    if (outputId) {
      // Update existing
      updateOutput(outputId, title, version, content);
      // Save version snapshot
      saveOutputVersion(crypto.randomUUID(), outputId, content, version, title);
      return Response.json({ outputId });
    } else {
      // Create new
      const id = crypto.randomUUID();
      createOutput(id, sessionId, workflowId, title, version, content);
      saveOutputVersion(crypto.randomUUID(), id, content, version, title);
      return Response.json({ outputId: id });
    }
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { outputId, title } = await request.json();
    if (!outputId || !title) return Response.json({ error: '缺少参数' }, { status: 400 });
    renameOutput(outputId, title);
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { outputId } = await request.json();
    if (!outputId) return Response.json({ error: '缺少 outputId' }, { status: 400 });
    deleteOutput(outputId);
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
