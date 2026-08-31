import { NextRequest } from 'next/server';
import { listFolders, createFolder, updateFolder, deleteFolder, getFolder } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { addAuditLog } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const folders = listFolders(currentUser()?.userId);
    return Response.json(folders);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, description } = await request.json();
    if (!name || !name.trim()) {
      return Response.json({ error: '文件夹名称不能为空' }, { status: 400 });
    }
    const folder = createFolder(name.trim(), (description || '').trim(), currentUser()?.userId);
    if (currentUser()) addAuditLog(currentUser()!.userId, 'create_folder', folder.folderId, folder.name);
    return Response.json(folder, { status: 201 });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { folderId, name, description } = await request.json();
    if (!folderId || !name || !name.trim()) {
      return Response.json({ error: '缺少必填参数' }, { status: 400 });
    }
    const userId = currentUser()?.userId;
    const existing = getFolder(folderId, userId);
    if (!existing) return Response.json({ error: '文件夹不存在' }, { status: 404 });
    updateFolder(folderId, name.trim(), (description || '').trim(), userId);
    if (userId) addAuditLog(userId, 'update_folder', folderId, name.trim());
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { folderId } = await request.json();
    if (!folderId) return Response.json({ error: '缺少 folderId' }, { status: 400 });
    deleteFolder(folderId, currentUser()?.userId);
    if (currentUser()) addAuditLog(currentUser()!.userId, 'delete_folder', folderId, '删除文件夹');
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
