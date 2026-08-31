import { NextRequest } from 'next/server';
import { listOutputs, getOutput, createOutput, updateOutput, renameOutput, deleteOutput, saveOutputVersion, getOutputVersions, findDuplicateOutput } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { addAuditLog } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const outputId = searchParams.get('outputId');
    const folderId = searchParams.get('folderId');
    if (outputId) {
      const output = getOutput(outputId, currentUser()?.userId);
      if (!output) return Response.json({ error: '产出不存在' }, { status: 404 });
      const versions = getOutputVersions(outputId);
      return Response.json({ ...output, versions });
    }
    const outputs = listOutputs(folderId || undefined, currentUser()?.userId);
    return Response.json(outputs);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { outputId, sessionId, workflowId, title, version, content, folderId } = body;

    if (!sessionId || !workflowId || !title || !version || !content) {
      return Response.json({ error: '缺少必填参数' }, { status: 400 });
    }

    if (outputId) {
      // Update existing
      updateOutput(outputId, title, version, content, currentUser()?.userId);
      if (currentUser()) addAuditLog(currentUser()!.userId, 'update_output', outputId, title);
      saveOutputVersion(crypto.randomUUID(), outputId, content, version, title);
      if (currentUser()) addAuditLog(currentUser()!.userId, 'update_output_version', outputId, version);
      return Response.json({ outputId });
    } else {
      // Check for duplicate title in the same folder
      if (folderId && findDuplicateOutput(folderId, title, version)) {
        return Response.json({ error: '同一文件夹下已存在同名+同版本的产出，请修改标题或版本号' }, { status: 409 });
      }
      // Create new
      const id = crypto.randomUUID();
      createOutput(id, sessionId, workflowId, title, version, content, folderId || null, currentUser()?.userId);
      if (currentUser()) addAuditLog(currentUser()!.userId, 'create_output', id, title);
      saveOutputVersion(crypto.randomUUID(), id, content, version, title);
      if (currentUser()) addAuditLog(currentUser()!.userId, 'create_output_version', id, version);
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
    renameOutput(outputId, title, currentUser()?.userId);
    if (currentUser()) addAuditLog(currentUser()!.userId, 'rename_output', outputId, title);
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { outputId } = await request.json();
    if (!outputId) return Response.json({ error: '缺少 outputId' }, { status: 400 });
    deleteOutput(outputId, currentUser()?.userId);
    if (currentUser()) addAuditLog(currentUser()!.userId, 'delete_output', outputId, '删除产出物');
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
